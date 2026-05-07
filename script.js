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
  btnCalcHyd: document.getElementById('btn-calc-hyd'),

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
};

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
  els.hydQ.value = Q.toFixed(2); // 自動帶入水理計算的設計流量
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
els.btnCalcHyd.addEventListener('click', () => {
  const Q_target = parseFloat(els.hydQ.value) || 0;
  const n = parseFloat(els.hydN.value) || 0.015;
  const S = parseFloat(els.hydS.value) || 0.03;
  const type = els.secType.value;
  
  const prms = {};
  if (type === 'rect' || type === 'u-shape') prms.b = parseFloat(document.getElementById('sec-b').value);
  if (type === 'trap') {
    prms.b = parseFloat(document.getElementById('sec-b').value);
    prms.z = parseFloat(document.getElementById('sec-z').value);
  }
  if (type === 'circ') prms.D = parseFloat(document.getElementById('sec-d').value);
  if (type === 'v-shape') {
    prms.z1 = parseFloat(document.getElementById('sec-z1').value);
    prms.z2 = parseFloat(document.getElementById('sec-z2').value);
  }

  let H = prms.D || parseFloat(document.getElementById('sec-h').value) || 0;
  let Fb = parseFloat(document.getElementById('sec-fb').value) || 0;

  els.calcStatus.style.display = 'block';
  els.finalResults.classList.add('hidden');

  if (Q_target <= 0 || n <= 0 || S <= 0) {
    els.calcStatus.innerText = '參數錯誤！請確認流量、粗糙係數與坡度大於 0。';
    return;
  }

  // 二分法尋找水深 y
  let y_min = 0.0001;
  let y_max = 20.0; // 假設通常不會超過 20m 深
  let y_mid = 0;
  let attempts = 0;
  const tol = 0.0001;

  // 對於圓形管涵，檢查是否滿管都不夠流
  if (type === 'circ') {
    const qFull = calcQ(prms.D - 0.001, type, prms, n, S);
    if (Q_target > qFull * 1.05) { // 加點容許值
      els.calcStatus.innerText = `🚨 警告：此流量已超過該圓管的最大過水能力 (滿管 Q 約 ${qFull.toFixed(2)} cms)。`;
      return;
    }
    y_max = prms.D * 0.999;
  }

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

  // 若計算達到最大值，可能有問題
  if (y_mid > 19.9) {
    els.calcStatus.innerText = '⚠️ 計算結果未收斂，水深超過 20m，請檢查斷面尺寸是否過小或坡度極緩。';
    return;
  }

  // 取得最終幾何數據
  const geom = getSectionGeom(y_mid, type, prms);
  const V = Q_target / geom.A;

  // 解構容許流量 Qmax 運算步驟 (Hmax -> Amax/Pmax -> Rmax -> Vmax -> Qmax)
  // 1. 計算容許流量的水深 Hmax = 斷面深 H - 出水高 Fb
  const Hmax = Math.max(0, H - Fb);
  
  // 2. 計算斷面積 Amax 與潤周長 Pmax
  const maxGeom = getSectionGeom(Hmax, type, prms);
  const Amax = maxGeom.A;
  const Pmax = maxGeom.P;

  // 3. 計算水力半徑 Rmax
  const Rmax = Pmax > 0 ? Amax / Pmax : 0;

  // 4. 以曼寧公式計算 Hmax 時的流速 Vmax
  const Vmax = Rmax > 0 ? (1 / n) * Math.pow(Rmax, 2 / 3) * Math.sqrt(S) : 0;

  // 5. 計算 Qmax
  const Qmax = Amax * Vmax;

  // 顯示結果
  if (els.outQmax) els.outQmax.innerText = Qmax.toFixed(2);
  els.outYn.innerText = y_mid.toFixed(2);
  els.outV.innerText = V.toFixed(2);
  els.outArea.innerText = geom.A.toFixed(2);
  els.outP.innerText = geom.P.toFixed(2);
  els.outR.innerText = geom.R.toFixed(2);

  // === 安全檢核 ===
  // 1. 流量檢核
  if (Qmax >= Q_target) {
    els.chkFlow.innerText = `OK (${Qmax.toFixed(2)} ≥ ${Q_target.toFixed(2)} cms)`;
    els.chkFlow.style.color = 'var(--accent)';
  } else {
    els.chkFlow.innerText = `斷面不足 (${Qmax.toFixed(2)} < ${Q_target.toFixed(2)} cms)`;
    els.chkFlow.style.color = '#ef4444';
  }

  // 2. 出水高檢核
  const actualFb = H - y_mid;
  if (actualFb >= Fb) {
    els.chkFb.innerText = `OK (${actualFb.toFixed(2)} ≥ ${Fb.toFixed(2)} m)`;
    els.chkFb.style.color = 'var(--accent)';
  } else {
    els.chkFb.innerText = `出水高不足 (${actualFb.toFixed(2)} < ${Fb.toFixed(2)} m)`;
    els.chkFb.style.color = '#ef4444';
  }

  // 3. 流速檢核
  if (V <= 6.1) {
    els.chkVel.innerText = `OK (${V.toFixed(2)} ≤ 6.10 m/s)`;
    els.chkVel.style.color = 'var(--accent)';
  } else {
    els.chkVel.innerText = `流速過快，須設置消能設施 (${V.toFixed(2)} > 6.10 m/s)`;
    els.chkVel.style.color = '#ef4444';
  }

  els.calcStatus.style.display = 'none';
  els.finalResults.classList.remove('hidden');
});

// 狀態儲存與還原 (localStorage)
function saveState() {
  document.querySelectorAll('input:not([id^="sec-"]):not([id="hyd-n"]):not([type="hidden"]), select').forEach(el => {
    if (el.id) appMemory[el.id] = el.value;
  });
  
  const t = els.secType.value;
  if (!appMemory.sections[t]) appMemory.sections[t] = {};
  
  document.querySelectorAll('input[id^="sec-"], #hyd-n').forEach(el => {
    if (el.id) appMemory.sections[t][el.id] = el.value;
  });
  
  localStorage.setItem('hydroState', JSON.stringify(appMemory));
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
        if (id === 'sections') return;
        const el = document.getElementById(id);
        if (el) el.value = appMemory[id];
      });
      
      // 自動觸發水文與水理計算
      calcHydrology();
      els.btnCalcHyd.click();
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
}
