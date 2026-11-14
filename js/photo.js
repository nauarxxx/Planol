// Afegir un moble des d'una foto: la foto del moble (de la botiga, d'un anunci o feta a casa) amb les mides escrites.
// Es llegeix el text de la imatge amb Tesseract (vendor/ocr, sense cap servei extern) i se'n treuen l'amplada, el fons
// i l'alçada, el tipus de moble i un color aproximat. Tot es pot corregir abans d'afegir-lo al plànol.

import { CATALOG } from './furniture.js?v=36';
import { TYPES } from './assistant.js?v=36';

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’'`´]/g, ' ');
const EXTRA = [ // paraules en anglès i francès que surten a les fitxes de les botigues
  ['mesaCentro', ['coffee table', 'table basse', 'side table']], ['escritorio', ['desk', 'bureau']], ['mesita', ['nightstand', 'bedside table', 'table de chevet']],
  ['muebleTv', ['tv bench', 'tv unit', 'tv stand', 'meuble tv']], ['litera', ['bunk bed']], ['sofa', ['couch', 'canape', 'sofa bed']],
  ['sillon', ['armchair', 'fauteuil']], ['cama', ['bed frame', 'bed', 'lit ']], ['armario', ['wardrobe', 'closet', 'armoire']],
  ['estanteria', ['bookcase', 'shelving', 'shelf', 'etagere']], ['comoda', ['chest of drawers', 'dresser', 'commode']],
  ['lampara', ['floor lamp', 'lamp', 'lampe']], ['alfombra', ['rug', 'carpet', 'tapis']], ['llarFoc', ['fireplace', 'wood stove', 'cheminee', 'poele']],
  ['nevera', ['fridge', 'refrigerator', 'frigo']], ['rentadora', ['washing machine', 'washer']], ['mirall', ['mirror', 'miroir']],
  ['banyera', ['bathtub', 'baignoire']], ['vater', ['toilet']], ['lavabo', ['washbasin', 'sink', 'vanity']], ['tv', ['television', 'tv ']],
  ['mesa', ['dining table', 'table']], ['silla', ['chair', 'chaise']],
];

// Llegeix les mides d'un text: «228 x 95 x 83 cm», «Ancho: 228 cm Fondo: 95 Alto: 83», «L 200 cm · W 90 cm», en mm, cm o m.
export function parseDims(text) {
  const t = norm(text).replace(/(\d),(\d)/g, '$1.$2').replace(/[×*]/g, 'x').replace(/\s+/g, ' ');
  const num = '(\\d{1,4}(?:\\.\\d+)?)';
  const unitOf = (u, v) => (u === 'mm' ? v / 10 : u === 'm' && v < 10 ? v * 100 : v);
  const out = {};
  const LBL = {
    w: ['amplada', 'ample', 'ancho', 'anchura', 'width', 'largeur', 'w'],
    l: ['llargada', 'llarg', 'largo', 'longitud', 'length', 'longueur', 'l'],
    d: ['fons', 'profunditat', 'fondo', 'profundidad', 'prof', 'depth', 'profondeur', 'p', 'd'],
    h: ['alcada', 'alt', 'alto', 'altura', 'height', 'hauteur', 'h', 'a'],
  };
  const found = {};
  for (const [k, words] of Object.entries(LBL)) {
    for (const wd of words) {
      const short = wd.length <= 2;
      const re = new RegExp(`(?:^|[^a-z])${wd}${short ? '' : '[a-z]*'}\\.?\\s*[:=]?\\s*${num}\\s*(mm|cm|m)?\\b`, 'g');
      const m = re.exec(t);
      if (m) { found[k] = unitOf(m[2], +m[1]); break; }
    }
  }
  // «A» pot ser «ancho» o «alto»: si ja hi ha amplada i no alçada, es pren com a alçada (ja és el que fa la llista)
  if (found.l && found.w && !found.d) { out.w = found.l; out.d = found.w; } else { if (found.w ?? found.l) out.w = found.w ?? found.l; if (found.d) out.d = found.d; }
  if (found.h) out.h = found.h;
  // tres o dos números seguits amb «x»
  const tri = new RegExp(`${num}\\s*(mm|cm|m)?\\s*x\\s*${num}\\s*(mm|cm|m)?\\s*x\\s*${num}\\s*(mm|cm|m)?`).exec(t);
  const pair = tri ? null : new RegExp(`${num}\\s*(mm|cm|m)?\\s*x\\s*${num}\\s*(mm|cm|m)?`).exec(t);
  if (tri) {
    const u = tri[6] || tri[4] || tri[2];
    const v = [tri[1], tri[3], tri[5]].map((x) => unitOf(u, +x));
    out.w ??= v[0]; out.d ??= v[1]; out.h ??= v[2];
  } else if (pair) {
    const u = pair[4] || pair[2];
    const v = [pair[1], pair[3]].map((x) => unitOf(u, +x));
    out.w ??= v[0]; out.d ??= v[1];
  }
  // sense unitat i números molt grans: són mil·límetres
  for (const k of ['w', 'd', 'h']) if (out[k] !== undefined) { if (out[k] > 600) out[k] /= 10; out[k] = Math.round(out[k]); if (!(out[k] > 0)) delete out[k]; }
  return out;
}
export function guessType(text) {
  const t = ' ' + norm(text).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ') + ' ';
  for (const [k, words] of [...EXTRA, ...TYPES]) {
    if (k === 'caja') continue;
    for (const wd of words) if (t.includes(' ' + norm(wd).trim() + ' ') || t.includes(' ' + norm(wd).trim() + 's ')) return k;
  }
  return null;
}
// Color mitjà del centre de la foto, sense el fons blanc o negre.
function photoColor(img) {
  const c = document.createElement('canvas'); c.width = 48; c.height = 48;
  const x = c.getContext('2d'); x.drawImage(img, img.width * 0.25, img.height * 0.25, img.width * 0.5, img.height * 0.5, 0, 0, 48, 48);
  const d = x.getImageData(0, 0, 48, 48).data;
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < d.length; i += 4) {
    const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]);
    if (mx > 238 && mn > 225) continue; // fons blanc
    if (mx < 18) continue;
    r += d[i]; g += d[i + 1]; b += d[i + 2]; n++;
  }
  if (!n) return null;
  return '#' + [r, g, b].map((v) => Math.round(v / n).toString(16).padStart(2, '0')).join('');
}

let ocrWorker = null;
async function ocr(img, onProgress) {
  const base = new URL('../vendor/ocr/', import.meta.url).href;
  if (!ocrWorker) {
    const T = (await import('../vendor/ocr/tesseract.esm.min.js')).default;
    ocrWorker = await T.createWorker('eng', 1, { workerPath: base + 'worker.min.js', corePath: base, langPath: base, workerBlobURL: false, logger: (m) => { if (m.status === 'recognizing text') onProgress?.(m.progress); } });
  }
  // es llegeix una còpia d'1600 px com a màxim (prou per a les lletres i més ràpid)
  const k = Math.min(1, 1600 / Math.max(img.width, img.height));
  const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  const { data } = await ocrWorker.recognize(c);
  return data.text || '';
}

export function initPhotoAdd(api) {
  const m = document.createElement('div');
  m.id = 'photoadd'; m.className = 'modal'; m.hidden = true;
  m.innerHTML = `
    <div class="gate-card wide pa">
      <div class="modal-head"><h1>📷 Moble des d’una foto</h1><button type="button" class="close" id="pa-close" aria-label="Tanca">×</button></div>
      <p class="note">Fes una foto o tria’n una on es vegi el moble i les seves mides (la fitxa de la botiga, l’etiqueta o un anunci). Llegeixo les mides, el tipus i el color; revisa-ho i afegeix-lo al plànol.</p>
      <div class="pa-grid">
        <div class="pa-left">
          <label class="pa-drop" tabindex="0"><img alt="" hidden /><span class="pa-empty">Toca per fer o triar una foto<br><small>també pots enganxar-ne una (Ctrl+V)</small></span><input type="file" accept="image/*" hidden /></label>
          <div class="progress" id="pa-prog" hidden><div class="bar"></div><span></span></div>
          <details class="pa-text" hidden><summary>Text llegit de la foto</summary><pre></pre></details>
        </div>
        <div class="pa-right">
          <div class="row c2">
            <label>Tipus<select id="pa-type">${Object.entries(CATALOG).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('')}</select></label>
            <label>Nom<input type="text" id="pa-name" /></label>
          </div>
          <label>Mides ràpides (amplada × fons × alçada)<input type="text" id="pa-quick" placeholder="p. ex. 228 x 95 x 83" autocomplete="off" /></label>
          <div class="row c3">
            <label>Amplada<input type="number" id="pa-w" min="1" /></label>
            <label>Fons<input type="number" id="pa-d" min="1" /></label>
            <label>Alçada<input type="number" id="pa-h" min="1" /></label>
          </div>
          <div class="row c2">
            <label>Color<input type="color" id="pa-color" value="#9a8f80" /></label>
            <label>Habitació<select id="pa-room"></select></label>
          </div>
          <label class="chk"><input type="checkbox" id="pa-cat" checked /> Desa’l també a «Els meus mobles», amb la foto</label>
          <div class="btns">
            <button class="btn" id="pa-add">Afegeix al plànol</button>
            <button class="btn secondary" id="pa-a4" title="Si a la foto no hi ha mides escrites: mesura amb un full A4 com a regle">📐 Mesura amb un full A4</button>
          </div>
        </div>
      </div>
    </div>`;
  document.body.appendChild(m);
  const $ = (s) => m.querySelector(s);
  let img = null, file = null, busy = false;
  const fill = (dims) => { for (const k of ['w', 'd', 'h']) if (dims[k]) $('#pa-' + k).value = dims[k]; };
  function setType(k, keepName) {
    const c = CATALOG[k] || CATALOG.caja;
    $('#pa-type').value = k in CATALOG ? k : 'caja';
    if (!keepName || !$('#pa-name').value) $('#pa-name').value = c.label;
    for (const x of ['w', 'd', 'h']) if (!$('#pa-' + x).value) $('#pa-' + x).value = c[x];
  }
  function reset() {
    img = null; file = null;
    $('.pa-drop img').hidden = true; $('.pa-empty').hidden = false; $('.pa-text').hidden = true;
    for (const k of ['w', 'd', 'h', 'quick', 'name']) $('#pa-' + k).value = '';
    $('#pa-room').innerHTML = api.roomOptions();
    setType('caja');
  }
  async function load(f) {
    if (!f || !/^image\//.test(f.type)) return;
    file = f;
    const url = URL.createObjectURL(f);
    img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; }).catch(() => null);
    if (!img) { api.toast('No he pogut obrir la foto.'); return; }
    const pv = $('.pa-drop img'); pv.src = url; pv.hidden = false; $('.pa-empty').hidden = true;
    const col = photoColor(img); if (col) $('#pa-color').value = col;
    const prog = $('#pa-prog'); prog.hidden = false;
    const show = (f2, txt) => { prog.querySelector('.bar').style.width = Math.round(f2 * 100) + '%'; prog.querySelector('span').textContent = txt; };
    show(0.02, 'Llegint les mides de la foto…');
    busy = true;
    try {
      const text = await ocr(img, (p) => show(Math.max(0.05, p), `Llegint les mides de la foto… ${Math.round(p * 100)} %`));
      $('.pa-text pre').textContent = text.trim() || '(no hi he trobat text)';
      $('.pa-text').hidden = false;
      const dims = parseDims(text), type = guessType(text);
      if (type) setType(type);
      fill(dims);
      const firstLine = text.split('\n').map((l) => l.trim()).find((l) => /[a-zà-ú]{3,}/i.test(l) && !/\d{2,}/.test(l));
      if (firstLine && firstLine.length <= 40) $('#pa-name').value = firstLine;
      const n = Object.keys(dims).length;
      show(1, n === 3 ? '✓ He trobat les tres mides. Revisa-les.' : n ? `✓ He trobat ${n === 1 ? 'una mida' : 'dues mides'}; completa la resta.` : 'No hi he vist mides escrites: escriu-les o mesura amb un full A4.');
    } catch (e) {
      show(1, 'No he pogut llegir el text de la foto: escriu les mides a mà.');
      api.log?.('OCR: ' + (e?.message || e));
    } finally { busy = false; }
  }
  $('.pa-drop input').addEventListener('change', (e) => load(e.target.files[0]));
  $('.pa-drop').addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('.pa-drop input').click(); } });
  $('.pa-drop').addEventListener('dragover', (e) => e.preventDefault());
  $('.pa-drop').addEventListener('drop', (e) => { e.preventDefault(); load(e.dataTransfer.files[0]); });
  document.addEventListener('paste', (e) => { if (m.hidden) return; const f = [...(e.clipboardData?.files || [])].find((x) => /^image\//.test(x.type)); if (f) load(f); });
  $('#pa-type').addEventListener('change', (e) => { const c = CATALOG[e.target.value]; $('#pa-name').value = c.label; });
  $('#pa-quick').addEventListener('input', (e) => fill(parseDims(e.target.value.replace(/^\s*(\d)/, '$1'))));
  $('#pa-a4').addEventListener('click', () => api.openMeasure((dims) => fill(dims)));
  const close = () => { m.hidden = true; };
  $('#pa-close').addEventListener('click', close);
  m.addEventListener('click', (e) => { if (e.target === m) close(); });
  $('#pa-add').addEventListener('click', async () => {
    if (busy) { api.toast('Encara estic llegint la foto…'); return; }
    const v = (k) => Math.max(1, Math.round(+$('#pa-' + k).value || 0));
    const it = { type: $('#pa-type').value, name: $('#pa-name').value.trim() || CATALOG[$('#pa-type').value].label, w: v('w'), d: v('d'), h: v('h'), color: $('#pa-color').value };
    if (!(+$('#pa-w').value && +$('#pa-d').value && +$('#pa-h').value)) { api.toast('Falten mides: escriu l’amplada, el fons i l’alçada.'); return; }
    let catalogId;
    if ($('#pa-cat').checked) catalogId = await api.saveToCatalog(it, file);
    let photo;
    if (!catalogId && file && api.shrinkImage) { try { photo = await api.shrinkImage(file, 256, 0.75); } catch (e) { /* sense foto */ } }
    api.addItems(it.type, { ...it, catalogId, photo, photoLook: !!(catalogId || photo) }, 1, $('#pa-room').value); // el moble es veu amb la seva foto
    close();
  });
  return (roomId) => { reset(); if (roomId) $('#pa-room').value = roomId; m.hidden = false; };
}
