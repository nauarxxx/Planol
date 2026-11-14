// Selector de colors propi (com el de Windows): quadre de to i saturació, barra de lluminositat, codi #hex,
// valors RGB o HSV, colors bàsics i colors personalitzats (desats en aquest dispositiu).
// Substitueix el selector del sistema de tots els <input type="color"> de l'app.

const CUSTOM_KEY = 'planta3d-colors';
const BASIC = [
  '#f08080', '#ee3a2c', '#7f4747', '#8e4040', '#3f0b0b', '#a6fcfc', '#73fcfc', '#3a86f0', '#0e2cf5', '#05209a', '#1b4783', '#03136e',
  '#fdfd96', '#fdf953', '#f1a160', '#ef8752', '#7a4419', '#837e26', '#8083f5', '#7c32f2', '#3b7fba', '#040541', '#5e1a63', '#3c0b3d',
  '#a7fc8c', '#a6f74a', '#7bf54d', '#76f163', '#78f483', '#848349', '#f190c1', '#ef89ef', '#e93ff0', '#e7397e', '#8486c6', '#7a1747',
  '#357c22', '#3c7e48', '#3b8282', '#568384', '#1a3b0e', '#123e3d', '#781b81', '#3a0e80', '#000000', '#808080', '#c0c0c0', '#ffffff',
];

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const hex2 = (n) => Math.round(clamp(n, 0, 255)).toString(16).padStart(2, '0');
export const normHex = (v) => { let h = String(v || '').trim().replace(/^#/, '').toLowerCase(); if (/^[0-9a-f]{3}$/.test(h)) h = h.split('').map((c) => c + c).join(''); return /^[0-9a-f]{6}$/.test(h) ? '#' + h : null; };
const toRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const rgbHex = ([r, g, b]) => '#' + hex2(r) + hex2(g) + hex2(b);
function hsv2rgb(h, s, v) {
  const f = (n) => { const k = (n + h / 60) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); };
  return [f(5) * 255, f(3) * 255, f(1) * 255];
}
function rgb2hsv([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, mx ? d / mx : 0, mx];
}
const loadCustom = () => { try { const a = JSON.parse(localStorage.getItem(CUSTOM_KEY) || '[]'); return Array.isArray(a) ? a.filter(normHex).slice(0, 24) : []; } catch { return []; } };
const saveCustom = (a) => { try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(a.slice(0, 24))); } catch { /* sense emmagatzematge */ } };

let modal = null;
function build() {
  modal = document.createElement('div');
  modal.id = 'cpick'; modal.className = 'modal'; modal.hidden = true;
  modal.innerHTML = `
    <div class="cp-card" role="dialog" aria-modal="true" aria-labelledby="cp-title">
      <h2 id="cp-title">Editeu els colors</h2>
      <div class="cp-top">
        <div class="cp-sq" tabindex="0" aria-label="To i saturació"><span class="cp-dot"></span></div>
        <div class="cp-prev"><span class="cp-old" title="Color d’abans"></span><span class="cp-new"></span></div>
        <div class="cp-val" tabindex="0" aria-label="Lluminositat"><span class="cp-knob"></span></div>
        <div class="cp-fields">
          <input type="text" class="cp-hex" maxlength="7" spellcheck="false" autocomplete="off" aria-label="Codi del color" />
          <select class="cp-mode" aria-label="Model de color"><option value="rgb">RGB</option><option value="hsv">HSV</option></select>
          <label><input type="number" class="cp-n" data-i="0" /><span></span></label>
          <label><input type="number" class="cp-n" data-i="1" /><span></span></label>
          <label><input type="number" class="cp-n" data-i="2" /><span></span></label>
        </div>
      </div>
      <div class="cp-bottom">
        <div><div class="cp-lbl">Colors bàsics</div><div class="cp-grid cp-basic">${BASIC.map((c) => `<button type="button" data-c="${c}" style="background:${c}" title="${c}"></button>`).join('')}</div></div>
        <div><div class="cp-lbl">Colors personalitzats <button type="button" class="cp-add" title="Desa el color actual">+</button></div><div class="cp-grid cp-custom"></div></div>
      </div>
      <div class="cp-btns"><button type="button" class="btn cp-ok">D’acord</button><button type="button" class="btn secondary cp-cancel">Cancel·la</button></div>
    </div>`;
  document.body.appendChild(modal);
  return modal;
}

// Obre el selector. Torna una promesa amb el color triat (#rrggbb) o null si es cancel·la.
export function pickColor(initial) {
  const m = modal || build();
  const q = (s) => m.querySelector(s);
  let [h, s, v] = rgb2hsv(toRgb(normHex(initial) || '#ffffff'));
  const start = normHex(initial) || '#ffffff';
  const sq = q('.cp-sq'), val = q('.cp-val'), hexIn = q('.cp-hex'), mode = q('.cp-mode'), nums = [...m.querySelectorAll('.cp-n')];
  const cur = () => rgbHex(hsv2rgb(h, s, v));
  function paint(skip) {
    const c = cur(), pure = rgbHex(hsv2rgb(h, s, 1));
    q('.cp-dot').style.left = (h / 360 * 100) + '%'; q('.cp-dot').style.top = ((1 - s) * 100) + '%';
    val.style.background = `linear-gradient(to bottom, ${pure}, #000)`;
    q('.cp-knob').style.top = ((1 - v) * 100) + '%';
    q('.cp-new').style.background = c;
    if (skip !== 'hex') { hexIn.value = c; hexIn.classList.remove('bad'); }
    if (skip !== 'num') {
      const vals = mode.value === 'rgb' ? toRgb(c) : [Math.round(h), Math.round(s * 100), Math.round(v * 100)];
      nums.forEach((n, i) => { n.value = vals[i]; });
    }
    m.querySelectorAll('.cp-grid button').forEach((b) => b.classList.toggle('on', b.dataset.c === c));
  }
  function labels() {
    const L = mode.value === 'rgb' ? [['Vermell', 255], ['Verd', 255], ['Blau', 255]] : [['To', 359], ['Saturació %', 100], ['Valor %', 100]];
    nums.forEach((n, i) => { n.min = 0; n.max = L[i][1]; n.nextElementSibling.textContent = L[i][0]; });
  }
  function setHex(c) { [h, s, v] = rgb2hsv(toRgb(c)); paint(); }
  function renderCustom() {
    const list = loadCustom();
    q('.cp-custom').innerHTML = Array.from({ length: 24 }, (_, i) => list[i] ? `<button type="button" data-c="${list[i]}" style="background:${list[i]}" title="${list[i]} · mantén premut per treure'l"></button>` : '<span class="cp-empty"></span>').join('');
    q('.cp-custom').querySelectorAll('button').forEach((b) => {
      b.addEventListener('click', () => setHex(b.dataset.c));
      b.addEventListener('contextmenu', (e) => { e.preventDefault(); saveCustom(loadCustom().filter((c) => c !== b.dataset.c)); renderCustom(); paint(); });
    });
  }
  // arrossegar dins del quadre o de la barra
  function drag(el, fn) {
    el.onpointerdown = (e) => {
      e.preventDefault(); try { el.setPointerCapture(e.pointerId); } catch { /* res */ }
      const move = (ev) => { const r = el.getBoundingClientRect(); fn(clamp((ev.clientX - r.left) / r.width, 0, 1), clamp((ev.clientY - r.top) / r.height, 0, 1)); paint(); };
      move(e);
      el.onpointermove = (ev) => { if (ev.buttons || ev.pointerType === 'touch') move(ev); };
      el.onpointerup = el.onpointercancel = () => { el.onpointermove = null; };
    };
  }
  drag(sq, (x, y) => { h = Math.min(359.9, x * 360); s = 1 - y; });
  drag(val, (x, y) => { v = 1 - y; });
  sq.onkeydown = (e) => { const d = { ArrowLeft: [-3, 0], ArrowRight: [3, 0], ArrowUp: [0, 0.02], ArrowDown: [0, -0.02] }[e.key]; if (d) { e.preventDefault(); h = clamp(h + d[0], 0, 359.9); s = clamp(s + d[1], 0, 1); paint(); } };
  val.onkeydown = (e) => { const d = { ArrowUp: 0.02, ArrowDown: -0.02 }[e.key]; if (d) { e.preventDefault(); v = clamp(v + d, 0, 1); paint(); } };
  hexIn.oninput = () => { const c = normHex(hexIn.value); hexIn.classList.toggle('bad', !c && hexIn.value.length > 0); if (c) { [h, s, v] = rgb2hsv(toRgb(c)); paint('hex'); } };
  mode.onchange = () => { labels(); paint(); };
  nums.forEach((n) => { n.oninput = () => {
    const a = nums.map((x) => +x.value || 0);
    if (mode.value === 'rgb') [h, s, v] = rgb2hsv(a); else { h = clamp(a[0], 0, 359.9); s = clamp(a[1], 0, 100) / 100; v = clamp(a[2], 0, 100) / 100; }
    paint('num');
  }; });
  q('.cp-basic').querySelectorAll('button').forEach((b) => { b.onclick = () => setHex(b.dataset.c); });
  q('.cp-add').onclick = () => { const c = cur(); saveCustom([c, ...loadCustom().filter((x) => x !== c)]); renderCustom(); paint(); };
  q('.cp-old').style.background = start;
  q('.cp-old').onclick = () => setHex(start);
  labels(); renderCustom(); paint();
  m.hidden = false;
  setTimeout(() => sq.focus(), 0);
  return new Promise((resolve) => {
    const done = (r) => { m.hidden = true; document.removeEventListener('keydown', key, true); resolve(r); };
    const key = (e) => { if (e.key === 'Escape') { e.preventDefault(); done(null); } else if (e.key === 'Enter' && e.target.tagName !== 'SELECT') { e.preventDefault(); done(cur()); } };
    document.addEventListener('keydown', key, true);
    q('.cp-ok').onclick = () => done(cur());
    q('.cp-cancel').onclick = () => done(null);
    m.onclick = (e) => { if (e.target === m) done(null); };
  });
}

// Tots els <input type="color"> obren aquest selector en lloc del del sistema.
export function initColorPicker() {
  document.addEventListener('click', async (e) => {
    const inp = e.target.closest?.('input[type="color"]');
    if (!inp || inp.disabled) return;
    e.preventDefault();
    const c = await pickColor(inp.value);
    if (!c || !inp.isConnected) return;
    inp.value = c;
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    inp.dispatchEvent(new Event('change', { bubbles: true }));
  }, true);
}
