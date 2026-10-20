// DOM Elements
const els = {
  // 水文輸入
  l1: document.getElementById('l1'),
  v1: document.getElementById('v1'),
  l2: document.getElementById('l2'),
  h1: document.getElementById('h1'),
  h2: document.getElementById('h2'),
  retT: document.getElementById('return-T'),
  pP: document.getElementById('param-P'),
  cCoeff: document.getElementById('c-coeff'),
  area: document.getElementById('area-ha'),
  
  // 水文輸出
  outT1: document.getElementById('out-t1'),
  outT2: document.getElementById('out-t2'),
  outTc: document.getElementById('out-tc'),
  outIbase: document.getElementById('out-Ibase'),
  outA: document.getElementById('out-A'),
  outC: document.getElementById('out-C'),
  outG: document.getElementById('out-G'),
  outH: document.getElementById('out-H'),
  outI: document.getElementById('out-I'),
  outQ: document.getElementById('out-Q'),

  // 水理輸入
  hydQ: document.getElementById('hyd-q'),
  hydN: document.getElementById('hyd-n'),
  hydS: document.getElementById('hyd-s'),
  secType: document.getElementById('section-type'),
  secParams: document.getElementById('section-params'),

  // 水理輸出
  calcStatus: document.getElementById('calc-status'),
  finalResults: document.getElementById('final-results'),
  outQmax: document.getElementById('out-qmax'),
  outYn: document.getElementById('out-yn'),
  outV: document.getElementById('out-v'),
  outArea: document.getElementById('out-a'),
  outP: document.getElementById('out-p'),
  outR: document.getElementById('out-r'),
  chkFlow: document.getElementById('chk-flow'),
  chkFb: document.getElementById('chk-fb'),
  chkVel: document.getElementById('chk-vel'),

  // 模式切換與直接輸入流量
  tabHydrology: document.getElementById('tab-hydrology'),
  tabDirect: document.getElementById('tab-direct'),
  hydrologyModule: document.getElementById('hydrology-module'),
  directFlowModule: document.getElementById('direct-flow-module'),
  directQInput: document.getElementById('direct-q-input'),
};

// 當前流量來源模式：'hydrology' (無因次降雨強度推估) 或 'direct' (直接輸入洪峰流量)
let currentFlowMode = 'hydrology';

function setFlowMode(mode, shouldSave = true) {
  currentFlowMode = mode === 'direct' ? 'direct' : 'hydrology';

  if (els.tabHydrology && els.tabDirect) {
    els.tabHydrology.classList.toggle('active', currentFlowMode === 'hydrology');
    els.tabDirect.classList.toggle('active', currentFlowMode === 'direct');
  }

  if (els.hydrologyModule && els.directFlowModule) {
    els.hydrologyModule.classList.toggle('hidden', currentFlowMode !== 'hydrology');
    els.directFlowModule.classList.toggle('hidden', currentFlowMode !== 'direct');
  }

  if (currentFlowMode === 'direct') {
    const directQ = parseFloat(els.directQInput ? els.directQInput.value : 0) || 0;
    els.hydQ.value = directQ.toFixed(2);
    calcHydraulics(true);
  } else {
    calcHydrology();
    calcHydraulics(true);
  }

  if (shouldSave) {
    saveState();
  }
}

if (els.tabHydrology) {
  els.tabHydrology.addEventListener('click', () => setFlowMode('hydrology'));
}
if (els.tabDirect) {
  els.tabDirect.addEventListener('click', () => setFlowMode('direct'));
}
if (els.directQInput) {
  els.directQInput.addEventListener('input', () => {
    if (currentFlowMode === 'direct') {
      const directQ = parseFloat(els.directQInput.value) || 0;
      els.hydQ.value = directQ.toFixed(2);
      calcHydraulics(true);
    }
  });
}

// ================= 水文計算 =================

function calcHydrology() {
  const l1 = parseFloat(els.l1.value) || 0; // 流入長度
  const v1 = parseFloat(els.v1.value) || 0; // 漫地流速

  const l2 = parseFloat(els.l2.value) || 0; // 流下長度
  const h1 = parseFloat(els.h1.value) || 0;
  const h2 = parseFloat(els.h2.value) || 0;

  // 1. 流入時間 t1 (分鐘)
  let t1 = 0;
  if (v1 > 0) t1 = l1 / (v1 * 60);

  // 2. 流下時間 t2 (分鐘) - 採用 Rziha 公式: V = 20 * (H/L)^0.6 m/s
  let t2 = 0;
  const dropH = Math.max(0, h1 - h2);
  if (l2 > 0 && dropH > 0) {
    const slope = dropH / l2;
    // v_channel (m/s)
    const v_channel = 20 * Math.pow(slope, 0.6);
    if (v_channel > 0) t2 = l2 / (v_channel * 60);
  }

  // 集流時間 tc
  const tc = t1 + t2;

  // 更新畫面
  els.outT1.innerText = t1.toFixed(2);
  els.outT2.innerText = t2.toFixed(2);
  els.outTc.innerText = tc.toFixed(2);

  // 3. 降雨強度計算 (無因次公式)
  const T = parseFloat(els.retT.value) || 1;
  const P = parseFloat(els.pP.value) || 0;
  
  let Ibase = 0;
  let pA = 0, pB = 55, pC = 0, pG = 0, pH = 0;

  if (P > 0) {
    // 水土保持技術規範無因次公式參數轉換
    Ibase = Math.pow(P / (25.29 + 0.094 * P), 2);
    pA = Math.pow(P / (-189.96 + 0.31 * P), 2);
    pC = Math.pow(P / (-381.71 + 1.45 * P), 2);
    pG = Math.pow(P / (42.89 + 1.33 * P), 2);
    pH = Math.pow(P / (-65.33 + 1.836 * P), 2);
  }

  // 更新顯示
  if (els.outIbase) els.outIbase.innerText = Ibase.toFixed(2);
  if (els.outA) els.outA.innerText = pA.toFixed(4);
  if (els.outC) els.outC.innerText = pC.toFixed(4);
  if (els.outG) els.outG.innerText = pG.toFixed(4);
  if (els.outH) els.outH.innerText = pH.toFixed(4);

  let intensity = 0;
  if (tc > 0) {
    const logT = Math.log10(T);
    intensity = Ibase * (pG + pH * logT) * pA / Math.pow(tc + pB, pC);
  }
  els.outI.innerText = intensity.toFixed(2);

  // 4. 合理化洪峰流量 Q = CIA/360
  const cCoeff = parseFloat(els.cCoeff.value) || 0;
  const area = parseFloat(els.area.value) || 0;
  const Q = (cCoeff * intensity * area) / 360;

  els.outQ.innerText = Q.toFixed(2);
  if (currentFlowMode === 'hydrology') {
    els.hydQ.value = Q.toFixed(2); // 自動帶入水理計算的設計流量
  }
}

// 綁定水文學更新事件
const hydroInputs = [els.l1, els.v1, els.l2, els.h1, els.h2, els.retT, els.pP, els.cCoeff, els.area];
hydroInputs.forEach(input => input.addEventListener('input', calcHydrology));

// ================= 水理計算 =================

let appMemory = { sections: {} };
try {
  const saved = localStorage.getItem('hydroState');
  if (saved) {
    appMemory = JSON.parse(saved);
    if (!appMemory.sections) appMemory.sections = {};
  }
} catch(e) {}

function getDef(id, fallback) {
  const t = els.secType.value;
  if (appMemory.sections[t] && appMemory.sections[t][id] !== undefined) {
    return appMemory.sections[t][id];
  }
  return fallback;
}

// 動態更新斷面參數輸入框
function renderSectionParams() {
  const type = els.secType.value;
  let html = '';
  
  // 底部寬度
  if (type === 'circ') {
    html += `<div class="input-group"><label>管涵直徑 D (m)</label><input type="number" id="sec-d" value="${getDef('sec-d', 1.0)}" step="0.1"></div>`;
  } else if (type !== 'v-shape') {
    html += `<div class="input-group"><label>底部寬度 b (m)</label><input type="number" id="sec-b" value="${getDef('sec-b', 1.0)}" step="0.1"></div>`;
  }
  
  // 斷面深
  if (type !== 'circ') {
    html += `<div class="input-group"><label>斷面深 H (m)</label><input type="number" id="sec-h" value="${getDef('sec-h', 1.0)}" step="0.1"></div>`;
  }

  // 側坡比
  if (type === 'trap') {
    html += `<div class="input-group"><label>側坡比 z (1:z)</label><input type="number" id="sec-z" value="${getDef('sec-z', 0.3)}" step="0.1"></div>`;
  } else if (type === 'v-shape') {
    html += `<div class="input-group"><label>左斜坡比 z1 (1:z)</label><input type="number" id="sec-z1" value="${getDef('sec-z1', 0.3)}" step="0.1"></div>
             <div class="input-group"><label>右斜坡比 z2 (1:z)</label><input type="number" id="sec-z2" value="${getDef('sec-z2', 0.3)}" step="0.1"></div>`;
  }

  // 規範出水高
  let fbDefault = 0.2;
  if (type === 'rect' || type === 'trap') fbDefault = 0.6;
  else if (type === 'v-shape') fbDefault = 0;
  
  html += `<div class="input-group"><label>規範出水高 Fb (m)</label><input type="number" id="sec-fb" value="${getDef('sec-fb', fbDefault)}" step="0.1"></div>`;

  if (type === 'u-shape') {
    html += `<p class="hint" style="margin-top:-10px;margin-bottom:10px;">底部為直徑 b 的半圓形</p>`;
  }

  // 自動切換粗糙係數 n 的推薦初始值
  if (els.hydN) {
    let nDef = 0.015;
    if (type === 'trap') nDef = 0.035;
    else if (type === 'rect' || type === 'u-shape') nDef = 0.015;
    else if (type === 'circ') nDef = 0.013;
    else if (type === 'v-shape') nDef = 0.03;
    
    els.hydN.value = getDef('hyd-n', nDef);
  }

  els.secParams.innerHTML = html;
}

els.secType.addEventListener('change', renderSectionParams);

// 給定 y 求 A, P (各斷面公式)
function getSectionGeom(y, type, prms) {
  let A = 0, P = 0;
  if (type === 'rect') {
    A = prms.b * y;
    P = prms.b + 2 * y;
  } else if (type === 'trap') {
    A = (prms.b + prms.z * y) * y;
    P = prms.b + 2 * y * Math.sqrt(1 + prms.z * prms.z);
  } else if (type === 'circ') {
    if (y >= prms.D) {
      A = (Math.PI / 4) * prms.D * prms.D;
      P = Math.PI * prms.D;
    } else {
      const theta = 2 * Math.acos(1 - (2 * y) / prms.D);
      A = (prms.D * prms.D / 8) * (theta - Math.sin(theta));
      P = (prms.D / 2) * theta;
    }
  } else if (type === 'u-shape') {
    const r = prms.b / 2;
    if (y <= r) { // 仍在半圓部位
      const D = prms.b;
      const theta = 2 * Math.acos(1 - (2 * y) / D);
      A = (D * D / 8) * (theta - Math.sin(theta));
      P = (D / 2) * theta;
    } else { // 超過半圓，進入矩形直行段
      const halfCircA = Math.PI * r * r / 2;
      const halfCircP = Math.PI * r;
      const rectA = prms.b * (y - r);
      const rectP = 2 * (y - r);
      A = halfCircA + rectA;
      P = halfCircP + rectP;
    }
  } else if (type === 'v-shape') {
    A = 0.5 * y * y * (prms.z1 + prms.z2);
    P = y * Math.sqrt(1 + prms.z1 * prms.z1) + y * Math.sqrt(1 + prms.z2 * prms.z2);
  }
  return { A, P, R: P > 0 ? A / P : 0 };
}

// 曼寧公式計算流量 Q given y
function calcQ(y, type, prms, n, S) {
  const { A, R } = getSectionGeom(y, type, prms);
  if (A <= 0 || R <= 0) return 0;
  return (1 / n) * A * Math.pow(R, 2/3) * Math.sqrt(S);
}

// 疊代求解正常水深 (使用二分逼近法 Bisection Method)
function calcHydraulics(isAuto = false) {
  const Q_target = parseFloat(els.hydQ.value) || 0;
  const n = parseFloat(els.hydN.value) || 0.015;
  const S = parseFloat(els.hydS.value) || 0.03;
  const type = els.secType.value;
  
  const prms = {};
  const secBEl = document.getElementById('sec-b');
  const secHEl = document.getElementById('sec-h');
  const secZEl = document.getElementById('sec-z');
  const secZ1El = document.getElementById('sec-z1');
  const secZ2El = document.getElementById('sec-z2');
  const secDEl = document.getElementById('sec-d');
  const secFbEl = document.getElementById('sec-fb');

  if (type === 'rect' || type === 'u-shape') prms.b = secBEl ? parseFloat(secBEl.value) : 1.0;
  if (type === 'trap') {
    prms.b = secBEl ? parseFloat(secBEl.value) : 1.0;
    prms.z = secZEl ? parseFloat(secZEl.value) : 0.3;
  }
  if (type === 'circ') prms.D = secDEl ? parseFloat(secDEl.value) : 1.0;
  if (type === 'v-shape') {
    prms.z1 = secZ1El ? parseFloat(secZ1El.value) : 0.3;
    prms.z2 = secZ2El ? parseFloat(secZ2El.value) : 0.3;
  }

  let H = prms.D || (secHEl ? parseFloat(secHEl.value) : 1.0) || 0;
  let Fb = secFbEl ? parseFloat(secFbEl.value) : 0;

  if (Q_target <= 0 || n <= 0 || S <= 0 || H <= 0) {
    if (!isAuto) {
      els.calcStatus.style.display = 'block';
      els.calcStatus.innerText = '參數錯誤！請確認流量、粗糙係數與坡度大於 0。';
      els.finalResults.classList.add('hidden');
    }
    updateVisualizer();
    return;
  }

  // 二分法尋找水深 y
  let y_min = 0.0001;
  let y_max = H * 1.5;
  const tol = 0.0001;

  if (type === 'circ') {
    const qFull = calcQ(prms.D - 0.001, type, prms, n, S);
    if (Q_target > qFull * 1.05) {
      if (!isAuto) {
        els.calcStatus.style.display = 'block';
        els.calcStatus.innerText = `🚨 警告：此流量已超過該圓管的最大過水能力 (滿管 Q 約 ${qFull.toFixed(2)} cms)。`;
        els.finalResults.classList.add('hidden');
      }
      updateVisualizer();
      return;
    }
    y_max = prms.D * 0.999;
  }

  let y_mid = 0;
  let attempts = 0;
  while (attempts < 100) {
    y_mid = (y_min + y_max) / 2;
    const q_mid = calcQ(y_mid, type, prms, n, S);
    if (Math.abs(q_mid - Q_target) < tol) break;
    if (q_mid < Q_target) {
      y_min = y_mid;
    } else {
      y_max = y_mid;
    }
    attempts++;
  }

  if (y_mid > H * 1.49) {
    if (!isAuto) {
      els.calcStatus.style.display = 'block';
      els.calcStatus.innerText = '⚠️ 計算結果未收斂，水深超過斷面深度 1.5 倍，請檢查斷面尺寸是否過小。';
      els.finalResults.classList.add('hidden');
    }
    updateVisualizer();
    return;
  }

  const geom = getSectionGeom(y_mid, type, prms);
  const V = Q_target / geom.A;
  const Hmax = Math.max(0, H - Fb);
  const maxGeom = getSectionGeom(Hmax, type, prms);
  const Amax = maxGeom.A;
  const Pmax = maxGeom.P;
  const Rmax = Pmax > 0 ? Amax / Pmax : 0;
  const Vmax = Rmax > 0 ? (1 / n) * Math.pow(Rmax, 2 / 3) * Math.sqrt(S) : 0;
  const Qmax = Amax * Vmax;

  // 顯示結果
  if (els.outQmax) els.outQmax.innerText = Qmax.toFixed(2);
  els.outYn.innerText = y_mid.toFixed(2);
  els.outV.innerText = V.toFixed(2);
  els.outArea.innerText = geom.A.toFixed(2);
  els.outP.innerText = geom.P.toFixed(2);
  els.outR.innerText = geom.R.toFixed(2);

  // 安全檢核
  if (Qmax >= Q_target) {
    els.chkFlow.innerText = `OK (${Qmax.toFixed(2)} ≥ ${Q_target.toFixed(2)} cms)`;
    els.chkFlow.style.color = 'var(--accent)';
  } else {
    els.chkFlow.innerText = `斷面不足 (${Qmax.toFixed(2)} < ${Q_target.toFixed(2)} cms)`;
    els.chkFlow.style.color = '#ef4444';
  }

  const actualFb = H - y_mid;
  if (actualFb >= Fb) {
    els.chkFb.innerText = `OK (${actualFb.toFixed(2)} ≥ ${Fb.toFixed(2)} m)`;
    els.chkFb.style.color = 'var(--accent)';
  } else {
    els.chkFb.innerText = `出水高不足 (${actualFb.toFixed(2)} < ${Fb.toFixed(2)} m)`;
    els.chkFb.style.color = '#ef4444';
  }

  if (V <= 6.1) {
    els.chkVel.innerText = `OK (${V.toFixed(2)} ≤ 6.10 m/s)`;
    els.chkVel.style.color = 'var(--accent)';
  } else {
    els.chkVel.innerText = `流速過快，須設置消能設施 (${V.toFixed(2)} > 6.10 m/s)`;
    els.chkVel.style.color = '#ef4444';
  }

  els.calcStatus.style.display = 'none';
  els.finalResults.classList.remove('hidden');
  
  // 計算完畢後更新示意圖
  updateVisualizer();
}

// 繪製斷面示意圖 (SVG)
function updateVisualizer() {
  const container = document.getElementById('section-viz');
  if (!container) return;

  const type = els.secType.value;
  
  // 取得當前參數
  let b = 1.0, H = 1.0, z = 0.3, z1 = 0.3, z2 = 0.3, D = 1.0, Fb = 0.6;
  
  const secBEl = document.getElementById('sec-b');
  const secHEl = document.getElementById('sec-h');
  const secZEl = document.getElementById('sec-z');
  const secZ1El = document.getElementById('sec-z1');
  const secZ2El = document.getElementById('sec-z2');
  const secDEl = document.getElementById('sec-d');
  const secFbEl = document.getElementById('sec-fb');

  if (type === 'rect' || type === 'u-shape' || type === 'trap') {
    if (secBEl) b = parseFloat(secBEl.value) || 0.001;
  }
  if (type !== 'circ') {
    if (secHEl) H = parseFloat(secHEl.value) || 0.001;
  }
  if (type === 'trap') {
    if (secZEl) z = parseFloat(secZEl.value) || 0.0;
  }
  if (type === 'v-shape') {
    if (secZ1El) z1 = parseFloat(secZ1El.value) || 0.0;
    if (secZ2El) z2 = parseFloat(secZ2El.value) || 0.0;
  }
  if (type === 'circ') {
    if (secDEl) D = parseFloat(secDEl.value) || 0.001;
    H = D;
  }
  if (secFbEl) Fb = parseFloat(secFbEl.value) || 0.0;

  // 取得計算出的正常水深
  let yn = 0;
  const ynEl = document.getElementById('out-yn');
  const isResultsHidden = els.finalResults.classList.contains('hidden');
  if (ynEl && ynEl.innerText !== '--' && !isResultsHidden) {
    yn = parseFloat(ynEl.innerText) || 0;
  }

  const drawYn = Math.min(yn, H);
  const actualFb = Math.max(0, H - yn);

  // SVG 畫布設定
  const svgW = 500; // 寬度由 450 拓寬為 500，以防文字被裁切
  const svgH = 300;
  const padL = 110;  // 增加左 Padding 到 110px，配合加大後的 16px 字體
  const padR = 110;  // 增加右 Padding 到 110px
  const padT = 50;
  const padB = 60;
  
  const drawW = svgW - padL - padR;
  const drawH = svgH - padT - padB;
  
  // 計算真實邊界 (底中心為 0,0, Y軸向上)
  let X_min = -b/2;
  let X_max = b/2;
  let Y_min = 0;
  let Y_max = H;
  
  if (type === 'trap') {
    X_min = -b/2 - z * H;
    X_max = b/2 + z * H;
  } else if (type === 'v-shape') {
    X_min = -z1 * H;
    X_max = z2 * H;
  } else if (type === 'circ') {
    X_min = -D/2;
    X_max = D/2;
    Y_max = D;
  } else if (type === 'u-shape') {
    const r = b/2;
    X_min = -r;
    X_max = r;
    Y_max = Math.max(H, r);
  }
  
  const W_real = X_max - X_min;
  const H_real = Y_max - Y_min;
  
  // 比例尺
  const scaleX = drawW / (W_real || 1);
  const scaleY = drawH / (H_real || 1);
  const scale = Math.min(scaleX, scaleY);
  
  // 真實中心映射到 SVG 畫布中央
  const X_center_real = (X_min + X_max) / 2;
  const Y_center_real = (Y_min + Y_max) / 2;
  const svgCX = svgW / 2;
  const svgCY = padT + drawH / 2;
  
  function toSvgX(x) {
    return svgCX + (x - X_center_real) * scale;
  }
  
  function toSvgY(y) {
    return svgCY - (y - Y_center_real) * scale;
  }
  
  // 產生 SVG 外框路徑與水體路徑
  let closedPath = '';
  let svgWaterElement = '';
  let svgChannelElement = '';
  const waterTopY = toSvgY(drawYn);
  
  if (type === 'rect') {
    const svgXL = toSvgX(-b/2), svgXR = toSvgX(b/2);
    const svgYB = toSvgY(0), svgYT = toSvgY(H);
    
    const channelPath = `M ${svgXL} ${svgYT} L ${svgXL} ${svgYB} L ${svgXR} ${svgYB} L ${svgXR} ${svgYT}`;
    closedPath = `M ${svgXL} ${svgYT} L ${svgXL} ${svgYB} L ${svgXR} ${svgYB} L ${svgXR} ${svgYT} Z`;
    
    svgWaterElement = `<path d="${closedPath}" class="svg-water" clip-path="url(#water-clip)" />`;
    svgChannelElement = `<path d="${channelPath}" class="svg-channel" />`;
  } 
  else if (type === 'trap') {
    const svgXLT = toSvgX(-b/2 - z * H), svgXLB = toSvgX(-b/2);
    const svgXRT = toSvgX(b/2 + z * H), svgXRB = toSvgX(b/2);
    const svgYB = toSvgY(0), svgYT = toSvgY(H);
    
    const channelPath = `M ${svgXLT} ${svgYT} L ${svgXLB} ${svgYB} L ${svgXRB} ${svgYB} L ${svgXRT} ${svgYT}`;
    closedPath = `M ${svgXLT} ${svgYT} L ${svgXLB} ${svgYB} L ${svgXRB} ${svgYB} L ${svgXRT} ${svgYT} Z`;
    
    svgWaterElement = `<path d="${closedPath}" class="svg-water" clip-path="url(#water-clip)" />`;
    svgChannelElement = `<path d="${channelPath}" class="svg-channel" />`;
  }
  else if (type === 'v-shape') {
    const svgXLT = toSvgX(-z1 * H), svgXRT = toSvgX(z2 * H);
    const svgYB = toSvgY(0), svgYT = toSvgY(H);
    
    const channelPath = `M ${svgXLT} ${svgYT} L ${toSvgX(0)} ${svgYB} L ${svgXRT} ${svgYT}`;
    closedPath = `M ${svgXLT} ${svgYT} L ${toSvgX(0)} ${svgYB} L ${svgXRT} ${svgYT} Z`;
    
    svgWaterElement = `<path d="${closedPath}" class="svg-water" clip-path="url(#water-clip)" />`;
    svgChannelElement = `<path d="${channelPath}" class="svg-channel" />`;
  }
  else if (type === 'circ') {
    const r = D / 2;
    const svgCX_circle = toSvgX(0);
    const svgCY_circle = toSvgY(r);
    const svgR = r * scale;
    
    svgWaterElement = `<circle cx="${svgCX_circle}" cy="${svgCY_circle}" r="${svgR}" class="svg-water" clip-path="url(#water-clip)" />`;
    svgChannelElement = `<circle cx="${svgCX_circle}" cy="${svgCY_circle}" r="${svgR}" class="svg-channel" />`;
  }
  else if (type === 'u-shape') {
    const r = b / 2;
    const svgXL_top = toSvgX(-r), svgXR_top = toSvgX(r);
    const svgXL_mid = toSvgX(-r), svgXR_mid = toSvgX(r);
    const svgY_top = toSvgY(H);
    const svgY_mid = toSvgY(r);
    const svgR = r * scale;
    
    const channelPath = `M ${svgXL_top} ${svgY_top} L ${svgXL_mid} ${svgY_mid} A ${svgR} ${svgR} 0 0 0 ${svgXR_mid} ${svgY_mid} L ${svgXR_top} ${svgY_top}`;
    closedPath = `M ${svgXL_top} ${svgY_top} L ${svgXL_mid} ${svgY_mid} A ${svgR} ${svgR} 0 0 0 ${svgXR_mid} ${svgY_mid} L ${svgXR_top} ${svgY_top} Z`;
    
    svgWaterElement = `<path d="${closedPath}" class="svg-water" clip-path="url(#water-clip)" />`;
    svgChannelElement = `<path d="${channelPath}" class="svg-channel" />`;
  }

  // 繪製水面線
  let waterTopLine = '';
  if (yn > 0) {
    let wL = toSvgX(0), wR = toSvgX(0);
    if (type === 'rect') {
      wL = toSvgX(-b/2);
      wR = toSvgX(b/2);
    } else if (type === 'u-shape') {
      const r = b / 2;
      if (drawYn <= r) {
        const halfW = Math.sqrt(Math.max(0, r*r - (r-drawYn)*(r-drawYn)));
        wL = toSvgX(-halfW);
        wR = toSvgX(halfW);
      } else {
        wL = toSvgX(-r);
        wR = toSvgX(r);
      }
    } else if (type === 'trap') {
      const wWidth = b/2 + z * drawYn;
      wL = toSvgX(-wWidth);
      wR = toSvgX(wWidth);
    } else if (type === 'v-shape') {
      wL = toSvgX(-z1 * drawYn);
      wR = toSvgX(z2 * drawYn);
    } else if (type === 'circ') {
      const r = D / 2;
      if (drawYn > 0 && drawYn < D) {
        const halfW = Math.sqrt(Math.max(0, r*r - (r-drawYn)*(r-drawYn)));
        wL = toSvgX(-halfW);
        wR = toSvgX(halfW);
      }
    }
    
    if (Math.abs(wL - wR) > 0.1) {
      waterTopLine = `<line x1="${wL}" y1="${waterTopY}" x2="${wR}" y2="${waterTopY}" class="svg-water-top" />`;
    }
  }

  // 繪製尺寸標註線
  let dimensions = '';
  
  // 1. 深度 H 標註 (縮減偏移量至 25px，小數點保留 1 位)
  const dimHX = toSvgX(X_min) - 25;
  const dimHY_top = toSvgY(Y_max);
  const dimHY_bot = toSvgY(0);
  
  dimensions += `<line x1="${toSvgX(X_min)}" y1="${dimHY_top}" x2="${dimHX - 3}" y2="${dimHY_top}" class="svg-dim-extension" />`;
  let extStartX = (type === 'v-shape' || type === 'circ') ? toSvgX(0) : toSvgX(-b/2);
  dimensions += `<line x1="${extStartX}" y1="${dimHY_bot}" x2="${dimHX - 3}" y2="${dimHY_bot}" class="svg-dim-extension" />`;
  dimensions += `<line x1="${dimHX}" y1="${dimHY_top}" x2="${dimHX}" y2="${dimHY_bot}" class="svg-dim-line" marker-start="url(#arrow)" marker-end="url(#arrow)" />`;
  
  const labelH = (type === 'circ') ? 'D' : 'H';
  const valH = (type === 'circ') ? D : H;
  dimensions += `<text x="${dimHX - 6}" y="${(dimHY_top + dimHY_bot)/2}" class="svg-dim-text" text-anchor="end" dominant-baseline="middle">${labelH} = ${valH.toFixed(1)}m</text>`;

  // 2. 底寬 b 標註 (小數點保留 1 位)
  if (type !== 'circ' && type !== 'v-shape') {
    const dimBY = toSvgY(0) + 35;
    const dimBX_left = toSvgX(-b/2);
    const dimBX_right = toSvgX(b/2);
    
    dimensions += `<line x1="${dimBX_left}" y1="${toSvgY(0)}" x2="${dimBX_left}" y2="${dimBY + 5}" class="svg-dim-extension" />`;
    dimensions += `<line x1="${dimBX_right}" y1="${toSvgY(0)}" x2="${dimBX_right}" y2="${dimBY + 5}" class="svg-dim-extension" />`;
    dimensions += `<line x1="${dimBX_left}" y1="${dimBY}" x2="${dimBX_right}" y2="${dimBY}" class="svg-dim-line" marker-start="url(#arrow)" marker-end="url(#arrow)" />`;
    dimensions += `<text x="${(dimBX_left + dimBX_right)/2}" y="${dimBY + 15}" class="svg-dim-text" text-anchor="middle">b = ${b.toFixed(1)}m</text>`;
  }

  // 3. 水深 yn 與出水高 Fb 標註 (縮減偏移量至 25px，小數點保留 1 位)
  if (yn > 0) {
    const dimYnX = toSvgX(X_max) + 25;
    const dimYnY_top = toSvgY(drawYn);
    const dimYnY_bot = toSvgY(0);
    
    let extWaterEndX = toSvgX(0);
    if (type === 'rect') extWaterEndX = toSvgX(b/2);
    else if (type === 'trap') extWaterEndX = toSvgX(b/2 + z * drawYn);
    else if (type === 'v-shape') extWaterEndX = toSvgX(z2 * drawYn);
    else if (type === 'circ') {
      const r = D / 2;
      extWaterEndX = drawYn < D ? toSvgX(Math.sqrt(Math.max(0, r*r - (r-drawYn)*(r-drawYn)))) : toSvgX(0);
    } else if (type === 'u-shape') {
      const r = b / 2;
      extWaterEndX = drawYn <= r ? toSvgX(Math.sqrt(Math.max(0, r*r - (r-drawYn)*(r-drawYn)))) : toSvgX(r);
    }
    
    dimensions += `<line x1="${extWaterEndX}" y1="${dimYnY_top}" x2="${dimYnX + 3}" y2="${dimYnY_top}" class="svg-dim-extension" />`;
    let extBotEndX = (type === 'v-shape' || type === 'circ') ? toSvgX(0) : toSvgX(b/2);
    dimensions += `<line x1="${extBotEndX}" y1="${dimYnY_bot}" x2="${dimYnX + 3}" y2="${dimYnY_bot}" class="svg-dim-extension" />`;
    dimensions += `<line x1="${dimYnX}" y1="${dimYnY_top}" x2="${dimYnX}" y2="${dimYnY_bot}" class="svg-dim-line" marker-start="url(#arrow)" marker-end="url(#arrow)" />`;
    dimensions += `<text x="${dimYnX + 6}" y="${(dimYnY_top + dimYnY_bot)/2}" class="svg-dim-text" text-anchor="start" dominant-baseline="middle">yn = ${yn.toFixed(1)}m</text>`;
    
    // 出水高標註 (實測出水高)
    if (actualFb > 0.05) {
      const dimFbY_top = toSvgY(H);
      const dimFbY_bot = toSvgY(drawYn);
      
      dimensions += `<line x1="${toSvgX(X_max)}" y1="${dimFbY_top}" x2="${dimYnX + 3}" y2="${dimFbY_top}" class="svg-dim-extension" />`;
      dimensions += `<line x1="${dimYnX}" y1="${dimFbY_top}" x2="${dimYnX}" y2="${dimFbY_bot}" class="svg-dim-line" marker-start="url(#arrow)" marker-end="url(#arrow)" />`;
      dimensions += `<text x="${dimYnX + 6}" y="${(dimFbY_top + dimFbY_bot)/2}" class="svg-dim-text" text-anchor="start" dominant-baseline="middle">Fb = ${actualFb.toFixed(1)}m</text>`;
    }
  }

  // 4. 坡度斜率標記 (移至內側、按實際坡度比例自適應長度，垂直標記為 1，水平標記實際設定值，三角形上下倒轉且水平翻轉以平行對齊斜坡，加大字體至 13px)
  let slopeMarker = '';
  if (type === 'trap' && z > 0) {
    const sX = b/2 + (z * H) / 2;
    const sY = H / 2;
    const svgSX = toSvgX(sX);
    const svgSY = toSvgY(sY);
    
    // 三角形大小隨真實比例變化 (垂直固定 30px，水平寬度為 30 * z)
    const triH = 30;
    const triW = triH * z;
    
    slopeMarker = `
      <!-- 內側坡比直角三角形 (上下倒轉 + 水平翻轉，直角在左上，斜邊平行對齊右斜坡) -->
      <path d="M ${svgSX - triW} ${svgSY} L ${svgSX - triW} ${svgSY - triH} L ${svgSX} ${svgSY - triH} Z" class="svg-slope-triangle" />
      <!-- 水平邊標註為實際坡比數值 (移至上方) -->
      <text x="${svgSX - triW/2}" y="${svgSY - triH - 7}" class="svg-dim-text" text-anchor="middle" dominant-baseline="middle" font-size="13px">${z.toFixed(1)}</text>
      <!-- 垂直邊標註為 1 -->
      <text x="${svgSX - triW - 6}" y="${svgSY - triH/2}" class="svg-dim-text" text-anchor="end" dominant-baseline="middle" font-size="13px">1</text>
    `;
  } 
  else if (type === 'v-shape') {
    if (z1 > 0) {
      const sX1 = -(z1 * H) / 2;
      const sY1 = H / 2;
      const svgSX1 = toSvgX(sX1);
      const svgSY1 = toSvgY(sY1);
      
      const triH = 30;
      const triW1 = triH * z1;
      
      slopeMarker += `
        <!-- 左斜坡內側坡比三角形 (上下倒轉 + 水平翻轉，直角在右上，斜邊平行對齊左斜坡) -->
        <path d="M ${svgSX1 + triW1} ${svgSY1} L ${svgSX1 + triW1} ${svgSY1 - triH} L ${svgSX1} ${svgSY1 - triH} Z" class="svg-slope-triangle" />
        <!-- 水平邊標註 (移至上方) -->
        <text x="${svgSX1 + triW1/2}" y="${svgSY1 - triH - 7}" class="svg-dim-text" text-anchor="middle" dominant-baseline="middle" font-size="13px">${z1.toFixed(1)}</text>
        <!-- 垂直邊標註 -->
        <text x="${svgSX1 + triW1 + 6}" y="${svgSY1 - triH/2}" class="svg-dim-text" text-anchor="start" dominant-baseline="middle" font-size="13px">1</text>
      `;
    }
    if (z2 > 0) {
      const sX2 = (z2 * H) / 2;
      const sY2 = H / 2;
      const svgSX2 = toSvgX(sX2);
      const svgSY2 = toSvgY(sY2);
      
      const triH = 30;
      const triW2 = triH * z2;
      
      slopeMarker += `
        <!-- 右斜坡內側坡比三角形 (上下倒轉 + 水平翻轉，直角在左上，斜邊平行對齊右斜坡) -->
        <path d="M ${svgSX2 - triW2} ${svgSY2} L ${svgSX2 - triW2} ${svgSY2 - triH} L ${svgSX2} ${svgSY2 - triH} Z" class="svg-slope-triangle" />
        <!-- 水平邊標註 (移至上方) -->
        <text x="${svgSX2 - triW2/2}" y="${svgSY2 - triH - 7}" class="svg-dim-text" text-anchor="middle" dominant-baseline="middle" font-size="12px">${z2.toFixed(1)}</text>
        <!-- 垂直邊標註 -->
        <text x="${svgSX2 - triW2 - 6}" y="${svgSY2 - triH/2}" class="svg-dim-text" text-anchor="end" dominant-baseline="middle" font-size="12px">1</text>
      `;
    }
  }

  const svgHtml = `
    <svg viewBox="0 0 ${svgW} ${svgH}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="waterGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.75"/>
          <stop offset="100%" stop-color="#1d4ed8" stop-opacity="0.9"/>
        </linearGradient>
        
        <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M 10 0 L 0 5 L 10 10 z" fill="var(--text-muted)" />
        </marker>
        
        <clipPath id="water-clip">
          <rect x="-1000" y="${waterTopY}" width="2000" height="${svgH}" />
        </clipPath>
      </defs>
      

      
      <!-- 2. 水體 -->
      ${svgWaterElement}
      
      <!-- 3. 水面線 -->
      ${waterTopLine}
      
      <!-- 4. 斷面框線 -->
      ${svgChannelElement}
      
      <!-- 5. 標註線與文字 -->
      ${dimensions}
      
      <!-- 6. 坡度標示 -->
      ${slopeMarker}
    </svg>
  `;
  
  container.innerHTML = svgHtml;
}

// 狀態儲存與還原 (localStorage)
function saveState() {
  appMemory.flowMode = currentFlowMode;
  document.querySelectorAll('input:not([id^="sec-"]):not([id="hyd-n"]):not([type="hidden"]), select').forEach(el => {
    if (el.id) appMemory[el.id] = el.value;
  });
  
  const t = els.secType.value;
  if (!appMemory.sections[t]) appMemory.sections[t] = {};
  
  document.querySelectorAll('input[id^="sec-"], #hyd-n').forEach(el => {
    if (el.id) appMemory.sections[t][el.id] = el.value;
  });
  
  localStorage.setItem('hydroState', JSON.stringify(appMemory));
  
  // 任何輸入改變時，自動進行靜默的水理計算以即時更新數據與示意圖
  calcHydraulics(true);
}

document.addEventListener('input', saveState);
document.addEventListener('change', saveState);

function loadState() {
  if (Object.keys(appMemory).length > 1) {
    try {
      if (appMemory['section-type']) {
        els.secType.value = appMemory['section-type'];
      }
      renderSectionParams(); 
      
      // 復原非斷面特化數值
      Object.keys(appMemory).forEach(id => {
        if (id === 'sections' || id === 'flowMode') return;
        const el = document.getElementById(id);
        if (el) el.value = appMemory[id];
      });
      
      // 復原流量來源模式並觸發計算
      const savedMode = appMemory.flowMode || 'hydrology';
      calcHydrology();
      setFlowMode(savedMode, false);
      return true;
    } catch(e) {
      console.error('復原數值失敗', e);
    }
  }
  return false;
}

// 重新輸入 (重置)
document.getElementById('btn-reset').addEventListener('click', () => {
  if (confirm('確定要清除目前的輸入數值，並恢復預設參數嗎？')) {
    localStorage.removeItem('hydroState');
    location.reload();
  }
});

// 初始化
const hasSavedState = loadState();
if (!hasSavedState) {
  renderSectionParams();
  calcHydrology();
  setFlowMode('hydrology', false);
}

// ================= 輸出 A4 報告列印邏輯 =================
const btnPrintReport = document.getElementById('btn-print-report');
if (btnPrintReport) {
  btnPrintReport.addEventListener('click', () => {
    // 1. 設定日期
    const dateEl = document.getElementById('rpt-date');
    if (dateEl) {
      const today = new Date();
      dateEl.innerText = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;
    }

    // 2. 收集水文參數並填入 (依流量模式決定是否顯示水文推估過程)
    const hydroRows = document.querySelectorAll('.rpt-hydro-row');
    const sec1Title = document.getElementById('rpt-sec1-title');
    const rptQdNote = document.getElementById('rpt-qd-note');
    const rptQdEl = document.getElementById('rpt-Qd');

    if (currentFlowMode === 'direct') {
      hydroRows.forEach(row => { row.style.display = 'none'; });
      if (sec1Title) sec1Title.innerText = '一、 已知設計洪峰流量設定';
      if (rptQdNote) rptQdNote.innerText = '直接指定已知設計洪峰流量（快速檢算模式）';
      const directQVal = parseFloat(els.directQInput ? els.directQInput.value : 0) || 0;
      if (rptQdEl) rptQdEl.innerText = directQVal.toFixed(2);
    } else {
      hydroRows.forEach(row => { row.style.display = ''; });
      if (sec1Title) sec1Title.innerText = '一、 設計水文參數與流量推估';
      if (rptQdNote) rptQdNote.innerText = '帶入水理計算之設計流量';

      const hydrologyMap = {
        'l1': 'rpt-l1',
        'v1': 'rpt-v1',
        'l2': 'rpt-l2',
        'return-T': 'rpt-T',
        'param-P': 'rpt-p',
        'c-coeff': 'rpt-c',
        'area-ha': 'rpt-area'
      };

      // 計算流下渠道坡度 S_ch
      const h1_val = parseFloat(document.getElementById('h1').value) || 0;
      const h2_val = parseFloat(document.getElementById('h2').value) || 0;
      const l2_val = parseFloat(document.getElementById('l2').value) || 1;
      const s_ch = Math.max(0, h1_val - h2_val) / l2_val;
      const sChEl = document.getElementById('rpt-slope-ch');
      if (sChEl) sChEl.innerText = s_ch.toFixed(4);

      // 填寫基本水文輸入
      Object.keys(hydrologyMap).forEach(id => {
        const src = document.getElementById(id);
        const dest = document.getElementById(hydrologyMap[id]);
        if (src && dest) {
          dest.innerText = src.value;
        }
      });

      // 填寫水文計算結果
      const hydOutputs = {
        'out-t1': 'rpt-t1',
        'out-t2': 'rpt-t2',
        'out-tc': 'rpt-tc',
        'out-Ibase': 'rpt-ibase',
        'out-I': 'rpt-I',
        'out-Q': 'rpt-Qd'
      };
      Object.keys(hydOutputs).forEach(id => {
        const src = document.getElementById(id);
        const dest = document.getElementById(hydOutputs[id]);
        if (src && dest) {
          dest.innerText = src.innerText;
        }
      });
    }

    // 3. 收集水理參數並填入
    // 翻譯斷面形式
    const secType = els.secType.value;
    const secTypeNames = {
      'trap': '梯形斷面 (Trapezoidal)',
      'rect': '矩形斷面 (Rectangular)',
      'circ': '圓形管涵 (Circular)',
      'u-shape': 'U型溝斷面 (U-Shape)',
      'v-shape': 'V型溝斷面 (V-Shape)'
    };
    const rptSecTypeEl = document.getElementById('rpt-sectype');
    if (rptSecTypeEl) rptSecTypeEl.innerText = secTypeNames[secType] || secType;

    // 水理環境參數
    const hydParams = {
      'hyd-n': 'rpt-n',
      'hyd-s': 'rpt-s'
    };
    Object.keys(hydParams).forEach(id => {
      const src = document.getElementById(id);
      const dest = document.getElementById(hydParams[id]);
      if (src && dest) dest.innerText = src.value;
    });

    // 動態幾何參數填寫 (需要處理特定斷面隱藏不相關表格列)
    const rowB = document.getElementById('row-rpt-b');
    const rowZ = document.getElementById('row-rpt-z');
    const rowH = document.getElementById('row-rpt-h');

    // 重設顯示與標題文字
    if (rowB) rowB.style.display = '';
    if (rowZ) rowZ.style.display = '';
    if (rowH) {
      rowH.style.display = '';
      const labelCell = rowH.cells[0];
      if (labelCell) labelCell.innerText = '渠道深 H';
    }

    const secBEl = document.getElementById('sec-b');
    const secHEl = document.getElementById('sec-h');
    const secZEl = document.getElementById('sec-z');
    const secZ1El = document.getElementById('sec-z1');
    const secZ2El = document.getElementById('sec-z2');
    const secDEl = document.getElementById('sec-d');
    const secFbEl = document.getElementById('sec-fb');

    const rptB = document.getElementById('rpt-b');
    const rptH = document.getElementById('rpt-h');
    const rptZ = document.getElementById('rpt-z');
    const rptFb = document.getElementById('rpt-fb');

    if (rptFb && secFbEl) rptFb.innerText = parseFloat(secFbEl.value).toFixed(1);

    if (secType === 'rect') {
      if (rptB && secBEl) rptB.innerText = parseFloat(secBEl.value).toFixed(1);
      if (rptH && secHEl) rptH.innerText = parseFloat(secHEl.value).toFixed(1);
      if (rowZ) rowZ.style.display = 'none'; // 矩形無坡比
    } 
    else if (secType === 'trap') {
      if (rptB && secBEl) rptB.innerText = parseFloat(secBEl.value).toFixed(1);
      if (rptH && secHEl) rptH.innerText = parseFloat(secHEl.value).toFixed(1);
      if (rptZ && secZEl) rptZ.innerText = `水平 ${parseFloat(secZEl.value).toFixed(1)} : 垂直 1`;
    } 
    else if (secType === 'circ') {
      if (rowB) rowB.style.display = 'none'; // 圓形無底寬
      if (rowZ) rowZ.style.display = 'none'; // 圓形無坡比
      if (rptH && secDEl) {
        const labelCell = rowH.cells[0];
        if (labelCell) labelCell.innerText = '管涵直徑 D';
        rptH.innerText = parseFloat(secDEl.value).toFixed(1);
      }
    } 
    else if (secType === 'u-shape') {
      if (rptB && secBEl) rptB.innerText = parseFloat(secBEl.value).toFixed(1);
      if (rptH && secHEl) rptH.innerText = parseFloat(secHEl.value).toFixed(1);
      if (rowZ) rowZ.style.display = 'none'; // U型底為半圓無側坡
    } 
    else if (secType === 'v-shape') {
      if (rowB) rowB.style.display = 'none'; // V型無底寬
      if (rptH && secHEl) rptH.innerText = parseFloat(secHEl.value).toFixed(1);
      if (rptZ && secZ1El && secZ2El) {
        rptZ.innerText = `左 z1=${parseFloat(secZ1El.value).toFixed(1)} / 右 z2=${parseFloat(secZ2El.value).toFixed(1)}`;
      }
    }

    // 填寫水理檢算結果
    const rptResultMap = {
      'out-yn': 'rpt-yn',
      'out-v': 'rpt-v',
      'out-a': 'rpt-a',
      'out-p': 'rpt-p-val',
      'out-r': 'rpt-r-val',
      'out-qmax': 'rpt-qmax'
    };
    Object.keys(rptResultMap).forEach(id => {
      const src = document.getElementById(id);
      const dest = document.getElementById(rptResultMap[id]);
      if (src && dest) dest.innerText = src.innerText;
    });

    // 4. 填寫安全檢核結論與樣式
    // Qd (依據目前生效的設計流量 hyd-q)
    const Qd_val = parseFloat(els.hydQ.value) || 0;
    const QdRptEl = document.getElementById('chk-rpt-qd');
    if (QdRptEl) QdRptEl.innerText = Qd_val.toFixed(2);

    // Qmax
    const Qmax_val = parseFloat(document.getElementById('out-qmax').innerText) || 0;
    const QmaxRptEl = document.getElementById('chk-rpt-qmax');
    if (QmaxRptEl) QmaxRptEl.innerText = Qmax_val.toFixed(1);

    // 流量檢核結果
    const flowResEl = document.getElementById('chk-rpt-flow-res');
    if (flowResEl) {
      if (Qmax_val >= Qd_val) {
        flowResEl.innerText = '● 合格 (OK)';
        flowResEl.className = 'check-ok';
      } else {
        flowResEl.innerText = '▲ 斷面不足 (NG)';
        flowResEl.className = 'check-warning';
      }
    }

    // 實際出水高 與 Fb
    const yn_val = parseFloat(document.getElementById('out-yn').innerText) || 0;
    const h_val = secType === 'circ' ? (parseFloat(secDEl.value) || 0) : (parseFloat(secHEl.value) || 0);
    const actFb_val = Math.max(0, h_val - yn_val);
    const actFbRptEl = document.getElementById('chk-rpt-actfb');
    if (actFbRptEl) actFbRptEl.innerText = actFb_val.toFixed(1);

    const Fb_val = parseFloat(secFbEl ? secFbEl.value : 0) || 0;
    const FbRptEl = document.getElementById('chk-rpt-fb');
    if (FbRptEl) FbRptEl.innerText = Fb_val.toFixed(1);

    // 出水高檢核結果
    const fbResEl = document.getElementById('chk-rpt-fb-res');
    if (fbResEl) {
      if (actFb_val >= Fb_val) {
        fbResEl.innerText = '● 合格 (OK)';
        fbResEl.className = 'check-ok';
      } else {
        fbResEl.innerText = '▲ 出水高不足 (NG)';
        fbResEl.className = 'check-warning';
      }
    }

    // 流速檢核
    const v_val = parseFloat(document.getElementById('out-v').innerText) || 0;
    const vRptEl = document.getElementById('chk-rpt-v');
    if (vRptEl) vRptEl.innerText = v_val.toFixed(1);

    // 流速檢核結果
    const velResEl = document.getElementById('chk-rpt-vel-res');
    if (velResEl) {
      if (v_val <= 6.1) {
        velResEl.innerText = '● 合格 (OK)';
        velResEl.className = 'check-ok';
      } else {
        velResEl.innerText = '▲ 流速過快 (需消能)';
        velResEl.className = 'check-warning';
      }
    }

    // 5. 複製 SVG 示意圖，並替換 clip-path ID 避免與主網頁 ID 衝突
    const vizContainer = document.getElementById('rpt-viz-container');
    const originalViz = document.getElementById('section-viz');
    if (vizContainer && originalViz) {
      let svgContent = originalViz.innerHTML;
      // 替換 ID 避免衝突
      svgContent = svgContent.replace(/id="water-clip"/g, 'id="print-water-clip"');
      svgContent = svgContent.replace(/url\(#water-clip\)/g, 'url(#print-water-clip)');
      vizContainer.innerHTML = svgContent;
    }

    // 6. 觸發列印
    window.print();
  });
}

// ================= 主題切換 (日夜模式) =================
const themeToggleBtn = document.getElementById('theme-toggle');
const savedTheme = localStorage.getItem('hydroTheme');

if (savedTheme === 'light') {
  document.body.classList.add('light-mode');
}

if (themeToggleBtn) {
  themeToggleBtn.addEventListener('click', () => {
    document.body.classList.toggle('light-mode');
    const currentTheme = document.body.classList.contains('light-mode') ? 'light' : 'dark';
    localStorage.setItem('hydroTheme', currentTheme);
  });
}

