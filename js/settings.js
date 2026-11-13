// Configuració de l'app: tema i colors, mida de la lletra, assistent, ús del núvol.
// Les preferències són d'aquest dispositiu (localStorage), no es pugen al núvol.

const PREFS_KEY = 'planta3d-prefs';
export const PREFS_DEFAULT = {
  theme: 'auto',       // auto | light | dark
  accent: '', bg: '', panel: '', ink: '', // buit = color del tema
  wall3d: '#f3f1ec', bg3d: '#e9e6e0',
  font: 'm',           // s | m | l
  wvol: 60,            // volum del so de WALL-E (0 = silenci)
  voice: 2,            // assistent: 0 només text · 1 només veu · 2 text i veu
  autoOpen: 0,         // obrir l'assistent en entrar
};
export let prefs = { ...PREFS_DEFAULT };
try { Object.assign(prefs, JSON.parse(localStorage.getItem(PREFS_KEY) || '{}')); } catch (e) { /* res */ }

export function savePrefs() {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch (e) { /* res */ }
}

const FONT = { s: '14px', m: '16px', l: '18px' };
export function applyPrefs(api) {
  const root = document.documentElement;
  if (prefs.theme === 'auto') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', prefs.theme);
  for (const k of ['accent', 'bg', 'panel', 'ink']) {
    if (prefs[k]) root.style.setProperty('--' + k, prefs[k]); else root.style.removeProperty('--' + k);
  }
  root.style.fontSize = FONT[prefs.font] || FONT.m;
  api?.setScenePrefs?.({ wall: prefs.wall3d, bg: prefs.bg3d });
}

const fmtKB = (b) => (b / 1024).toLocaleString('ca', { maximumFractionDigits: 1 }) + ' KB';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Límits del pla gratuït de Firestore (Spark), per si cal vigilar-los.
const FREE = { docBytes: 1048576, writesDay: 20000, readsDay: 50000, storageBytes: 1073741824 };

export function initSettings(api) {
  const modal = document.getElementById('settings');
  const body = modal.querySelector('.modal-body');
  const open = () => { render(); modal.hidden = false; };
  const close = () => { modal.hidden = true; };
  document.getElementById('settings-btn').addEventListener('click', open);
  modal.querySelector('#settings-close').addEventListener('click', close);
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

  const cur = (k) => prefs[k] || getComputedStyle(document.documentElement).getPropertyValue('--' + k).trim() || '#000000';
  const toHex = (c) => {
    if (/^#[0-9a-f]{6}$/i.test(c)) return c;
    const ctx = document.createElement('canvas').getContext('2d'); ctx.fillStyle = c; return ctx.fillStyle;
  };

  function render() {
    const c = api.cloudInfo();
    const pct = (a, b) => Math.min(100, Math.round(a / b * 1000) / 10);
    const bar = (a, b, warn = 80) => `<div class="meter"><div class="fill ${pct(a, b) >= warn ? 'warn' : ''}" style="width:${pct(a, b)}%"></div></div>`;
    body.innerHTML = `
      <h2>Aspecte</h2>
      <div class="row c2">
        <label>Tema<select id="s-theme">
          <option value="auto" ${prefs.theme === 'auto' ? 'selected' : ''}>Automàtic (segons el sistema)</option>
          <option value="light" ${prefs.theme === 'light' ? 'selected' : ''}>Clar</option>
          <option value="dark" ${prefs.theme === 'dark' ? 'selected' : ''}>Fosc</option>
        </select></label>
        <label>Mida de la lletra<select id="s-font">
          <option value="s" ${prefs.font === 's' ? 'selected' : ''}>Petita</option>
          <option value="m" ${prefs.font === 'm' ? 'selected' : ''}>Normal</option>
          <option value="l" ${prefs.font === 'l' ? 'selected' : ''}>Gran</option>
        </select></label>
      </div>
      <div class="row c4">
        <label>Principal<input type="color" data-pref="accent" value="${toHex(cur('accent'))}" /></label>
        <label>Fons<input type="color" data-pref="bg" value="${toHex(cur('bg'))}" /></label>
        <label>Panells<input type="color" data-pref="panel" value="${toHex(cur('panel'))}" /></label>
        <label>Text<input type="color" data-pref="ink" value="${toHex(cur('ink'))}" /></label>
      </div>
      <div class="row c2">
        <label>Parets 3D<input type="color" data-pref="wall3d" value="${prefs.wall3d}" /></label>
        <label>Fons de l’escena 3D<input type="color" data-pref="bg3d" value="${prefs.bg3d}" /></label>
      </div>
      <div class="btns"><button class="btn secondary small" id="s-reset-colors">Restaura els colors</button></div>

      <h2>Assistent WALL-E</h2>
      <div class="row c2">
        <label>Volum del so (${prefs.wvol} %)<input type="range" id="s-wvol" min="0" max="100" step="5" value="${prefs.wvol}" /></label>
        <label>Com respon<select id="s-voice">
          <option value="0" ${+prefs.voice === 0 ? 'selected' : ''}>Només text</option>
          <option value="1" ${+prefs.voice === 1 ? 'selected' : ''}>Només veu</option>
          <option value="2" ${+prefs.voice === 2 ? 'selected' : ''}>Text i veu</option>
        </select></label>
      </div>
      <p class="note">${esc(api.voiceInfo())}</p>
      <div class="btns"><button class="btn secondary small" id="s-wtest">Prova el so</button><button class="btn secondary small" id="s-vtest">Prova la veu</button></div>

      <h2>Núvol (Firebase, pla gratuït)</h2>
      ${c.enabled ? `
      <p class="note">Tot el plànol es desa en un sol document. Firestore limita cada document a <b>1 MB</b>; el pla gratuït dóna <b>1 GB</b> d’espai, <b>20.000 escriptures</b> i <b>50.000 lectures</b> al dia.</p>
      <div class="stat"><span>Mida del plànol desat</span><b>${fmtKB(c.bytes)} de ${fmtKB(FREE.docBytes)} (${pct(c.bytes, FREE.docBytes)} %)</b></div>${bar(c.bytes, FREE.docBytes)}
      <div class="stat"><span>Escriptures avui, des d’aquest dispositiu</span><b>${c.writes} de ${FREE.writesDay.toLocaleString('ca')}</b></div>${bar(c.writes, FREE.writesDay)}
      <div class="stat"><span>Lectures avui, des d’aquest dispositiu</span><b>${c.reads} de ${FREE.readsDay.toLocaleString('ca')}</b></div>${bar(c.reads, FREE.readsDay)}
      <div class="stat"><span>Espai total que ocupa l’app al núvol</span><b>≈ ${fmtKB(c.bytes)} de 1 GB (${pct(c.bytes, FREE.storageBytes)} %)</b></div>
      <p class="note">${c.items} mobles i ${c.rooms} habitacions. Cada canvi es desa com a màxim un cop cada 0,8 s, i només compten les escriptures d’aquest dispositiu; les de l’altre mòbil s’han de sumar a part. Per veure el total exacte: consola de Firebase → Firestore → Ús.</p>`
      : '<p class="note">El núvol no està configurat en aquest dispositiu.</p>'}

      <h2>Altres</h2>
      <label style="flex-direction:row;align-items:center;gap:6px"><input type="checkbox" id="s-autoopen" ${+prefs.autoOpen ? 'checked' : ''}/> Obre l’assistent en entrar</label>
      <p class="note">Versió: ${esc(api.version)} · ${api.standalone ? 'instal·lada com a app' : 'oberta al navegador'}.</p>
      <div class="btns"><button class="btn danger small" id="s-reset-all">Restaura tota la configuració</button></div>`;

    const set = (k, v) => { prefs[k] = v; savePrefs(); applyPrefs(api); };
    body.querySelector('#s-theme').addEventListener('change', (e) => set('theme', e.target.value));
    body.querySelector('#s-font').addEventListener('change', (e) => set('font', e.target.value));
    body.querySelectorAll('[data-pref]').forEach((inp) => inp.addEventListener('input', () => set(inp.dataset.pref, inp.value)));
    body.querySelector('#s-reset-colors').addEventListener('click', () => {
      for (const k of ['accent', 'bg', 'panel', 'ink']) prefs[k] = '';
      prefs.wall3d = PREFS_DEFAULT.wall3d; prefs.bg3d = PREFS_DEFAULT.bg3d; prefs.theme = 'auto';
      savePrefs(); applyPrefs(api); render();
    });
    body.querySelector('#s-wvol').addEventListener('input', (e) => { set('wvol', +e.target.value); e.target.parentElement.firstChild.textContent = `Volum del so (${prefs.wvol} %)`; });
    body.querySelector('#s-voice').addEventListener('change', (e) => set('voice', +e.target.value));
    body.querySelector('#s-autoopen').addEventListener('change', (e) => set('autoOpen', e.target.checked ? 1 : 0));
    body.querySelector('#s-wtest').addEventListener('click', () => api.walleSay(true));
    body.querySelector('#s-vtest').addEventListener('click', () => api.sayTest());
    body.querySelector('#s-reset-all').addEventListener('click', () => { prefs = { ...PREFS_DEFAULT }; savePrefs(); applyPrefs(api); render(); });
  }
}
