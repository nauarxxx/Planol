// Configuració de l'app: tema i colors, mida de la lletra, assistent, ús del núvol, dades (exporta, escenes, PDF…).
// Les preferències són d'aquest dispositiu (localStorage), no es pugen al núvol.
// El botó ⚙ és una moneda: 1 toc → configuració normal · 3 tocs → gira, es posa vermell · un 4t toc → eines de developer.

const PREFS_KEY = 'planta3d-prefs';
export const PREFS_DEFAULT = {
  theme: 'dark',       // dark | light | auto (el fosc és el que es mostra per defecte)
  accent: '', bg: '', panel: '', ink: '', // buit = color del tema
  wall3d: '#f3f1ec', bg3d: '',  // bg3d buit = segons el tema (fosc o clar)
  font: 'm',           // s | m | l
  wvol: 60,            // volum del so de WALL-E (0 = silenci)
  voice: 2,            // assistent: 0 només text · 1 només veu · 2 text i veu
  autoOpen: 0,         // obrir l'assistent en entrar
  hint: 1,             // mostra la línia d'ajuda de sota del 3D
  shadows: 1,          // ombres al 3D (desactiva-les si el mòbil va lent)
  confirmDel: 0,       // demana confirmació abans d'eliminar un moble
  startView: '3d',     // vista en obrir: 3d | top
  units: 'cm',         // cm | m
  unitLabel: 1,        // escriu la unitat a les cotes
  vib: 1,              // vibra en col·locar un moble (mòbil)
  warn: 'both',        // avís de conflictes: both | visual | sound | none
  voiceName: '',       // veu de WALL-E (nom de la veu del sistema; buit = la catalana que trobi)
  cams: {},            // càmeres desades per estança ('_all' = vista inicial)
  v2: 1, v3: 1,
};
export let prefs = { ...PREFS_DEFAULT };
try {
  const saved = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
  Object.assign(prefs, saved);
  if (!saved.v2) { prefs.theme = 'dark'; prefs.v2 = 1; } // des de la v21 el tema fosc és el que surt per defecte
  if (!saved.v3) { if (prefs.bg3d === '#e9e6e0') prefs.bg3d = ''; prefs.v3 = 1; } // v22: el fons 3D segueix el tema
} catch (e) { /* res */ }

export function savePrefs() {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch (e) { /* res */ }
}

const FONT = { s: '14px', m: '16px', l: '18px' };
export function isDark() {
  return prefs.theme === 'dark' || (prefs.theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
}
export function applyPrefs(api) {
  const root = document.documentElement;
  if (prefs.theme === 'auto') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', prefs.theme);
  for (const k of ['accent', 'bg', 'panel', 'ink']) {
    if (prefs[k]) root.style.setProperty('--' + k, prefs[k]); else root.style.removeProperty('--' + k);
  }
  root.style.fontSize = FONT[prefs.font] || FONT.m;
  const hint = document.getElementById('hint'); if (hint) hint.classList.toggle('off', !+prefs.hint);
  const tb = document.getElementById('theme-btn');
  if (tb) { const d = isDark(); tb.textContent = d ? '☀️' : '🌙'; tb.title = d ? 'Mode clar' : 'Mode fosc'; tb.setAttribute('aria-label', tb.title); }
  const dark = isDark();
  api?.setScenePrefs?.({ wall: prefs.wall3d, bg: prefs.bg3d || (dark ? '#1b1a19' : '#e9e6e0'), ground: prefs.bg3d ? prefs.bg3d : (dark ? '#262421' : '#dcd8d0') });
  api?.setShadows?.(!!+prefs.shadows);
}

const fmtKB = (b) => (b / 1024).toLocaleString('ca', { maximumFractionDigits: 1 }) + ' KB';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Límits del pla gratuït de Firestore (Spark), per si cal vigilar-los.
const FREE = { docBytes: 1048576, writesDay: 20000, readsDay: 50000, storageBytes: 1073741824 };

export function initSettings(api) {
  const modal = document.getElementById('settings');
  const body = modal.querySelector('.modal-body');
  const btn = document.getElementById('settings-btn');
  const open = () => { render(); modal.hidden = false; };
  const close = () => { modal.hidden = true; };
  modal.querySelector('#settings-close').addEventListener('click', close);
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

  // ---- moneda: 3 tocs dins del temps «tap» la giren (vermella); mentre està desbloquejada, un toc obre el mode developer.
  const hop = () => { btn.classList.remove('hop'); void btn.offsetWidth; btn.classList.add('hop'); setTimeout(() => btn.classList.remove('hop'), 950); };
  let armed = false, armT = 0, openT = 0, devOpen = false;
  const taps = [];
  function arm() {
    armed = true; clearTimeout(armT);
    btn.classList.add('flipped'); hop();
    btn.title = 'Eines de developer (toca una altra vegada)';
    armT = setTimeout(relock, api.cfgGet('coin'));
  }
  function relock() {
    clearTimeout(armT); clearTimeout(openT); taps.length = 0;
    if (!armed && !devOpen) return;
    armed = false; devOpen = false;
    btn.classList.remove('flipped'); hop();
    btn.title = 'Configuració';
  }
  btn.addEventListener('click', () => {
    if (devOpen) { api.dev.close(); return; }
    if (armed) { clearTimeout(armT); armed = false; devOpen = true; api.dev.open(); return; } // 4t toc
    if (!modal.hidden) { close(); return; }
    const now = Date.now(), win = api.cfgGet('tap');
    while (taps.length && now - taps[0] > win) taps.shift();
    taps.push(now); clearTimeout(openT);
    if (taps.length >= 3) { taps.length = 0; arm(); return; }
    openT = setTimeout(() => { taps.length = 0; open(); }, api.cfgGet('aiwait'));
  });
  api.onDevClose = relock;

  // ---- botó ràpid de mode fosc / clar
  const tb = document.getElementById('theme-btn');
  tb?.addEventListener('click', () => { prefs.theme = isDark() ? 'light' : 'dark'; savePrefs(); applyPrefs(api); if (!modal.hidden) render(); });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => { if (prefs.theme === 'auto') applyPrefs(api); });

  const cur = (k) => prefs[k] || getComputedStyle(document.documentElement).getPropertyValue('--' + k).trim() || '#000000';
  const toHex = (c) => {
    if (/^#[0-9a-f]{6}$/i.test(c)) return c;
    const ctx = document.createElement('canvas').getContext('2d'); ctx.fillStyle = c; return ctx.fillStyle;
  };
  const chk = (id, k, label) => `<label class="chk"><input type="checkbox" id="${id}" ${+prefs[k] ? 'checked' : ''}/> ${label}</label>`;

  function render() {
    const c = api.cloudInfo();
    const pct = (a, b) => Math.min(100, Math.round(a / b * 1000) / 10);
    const bar = (a, b, warn = 80) => `<div class="meter"><div class="fill ${pct(a, b) >= warn ? 'warn' : ''}" style="width:${pct(a, b)}%"></div></div>`;
    body.innerHTML = `
      <h2>Aspecte</h2>
      <div class="row c2">
        <label>Tema<select id="s-theme">
          <option value="dark" ${prefs.theme === 'dark' ? 'selected' : ''}>Fosc (per defecte)</option>
          <option value="light" ${prefs.theme === 'light' ? 'selected' : ''}>Clar</option>
          <option value="auto" ${prefs.theme === 'auto' ? 'selected' : ''}>Automàtic (segons el sistema)</option>
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
        <label>Fons de l’escena 3D ${prefs.bg3d ? '' : '<small>(segueix el tema)</small>'}<input type="color" data-pref="bg3d" value="${prefs.bg3d || (isDark() ? '#1b1a19' : '#e9e6e0')}" /></label>
      </div>
      <div class="btns"><button class="btn secondary small" id="s-reset-colors">Restaura els colors</button></div>

      <h2>Funcionament</h2>
      <div class="row c2">
        <label>Vista en obrir<select id="s-startview">
          <option value="3d" ${prefs.startView === '3d' ? 'selected' : ''}>3D</option>
          <option value="top" ${prefs.startView === 'top' ? 'selected' : ''}>Planta</option>
        </select></label>
      </div>
      <div class="row c2">
        <label>Unitats<select id="s-units">
          <option value="cm" ${prefs.units === 'cm' ? 'selected' : ''}>Centímetres (270 × 440)</option>
          <option value="m" ${prefs.units === 'm' ? 'selected' : ''}>Metres (2,70 × 4,40)</option>
        </select></label>
        <label>Avís de conflictes (xocs, portes)<select id="s-warn">
          <option value="both" ${prefs.warn === 'both' ? 'selected' : ''}>Visual i so</option>
          <option value="visual" ${prefs.warn === 'visual' ? 'selected' : ''}>Només visual</option>
          <option value="sound" ${prefs.warn === 'sound' ? 'selected' : ''}>Només so</option>
          <option value="none" ${prefs.warn === 'none' ? 'selected' : ''}>Cap</option>
        </select></label>
      </div>
      ${chk('s-unitlabel', 'unitLabel', 'Escriu la unitat a les cotes (p. ex. «85 cm» en lloc de «85»)')}
      ${chk('s-vib', 'vib', 'Vibra en col·locar o encaixar un moble (mòbil)')}
      ${chk('s-shadows', 'shadows', 'Ombres al 3D (desactiva-les si el mòbil va lent)')}
      ${chk('s-hint', 'hint', 'Mostra la línia d’ajuda a sota del 3D')}
      ${chk('s-confirmdel', 'confirmDel', 'Demana confirmació abans d’eliminar un moble')}
      ${chk('s-autoopen', 'autoOpen', 'Obre l’assistent en entrar')}

      <h2>Càmera</h2>
      <p class="note">Col·loca la vista com t’agradi al 3D i desa-la: en obrir l’app o en prémer «Mostra l’estança» tornarà a aquesta vista.</p>
      <div class="row c2">
        <label>Estança<select id="s-cam-room"><option value="_all">Tot el pis (vista inicial)</option>${(api.rooms?.() || []).filter((r) => !['void', 'pillar', 'beam'].includes(r.kind)).map((r) => `<option value="${esc(r.id)}">${esc(r.name)}${prefs.cams?.[r.id] ? ' ✓' : ''}</option>`).join('')}</select></label>
      </div>
      <div class="btns"><button class="btn secondary small" id="s-cam-save">📷 Desa la vista actual</button><button class="btn secondary small" id="s-cam-go">Vés-hi</button><button class="btn danger small" id="s-cam-del">Esborra</button></div>
      <p class="note" id="s-cam-info">${Object.keys(prefs.cams || {}).length ? `${Object.keys(prefs.cams).length} vistes desades.` : 'Cap vista desada: s’enquadra automàticament.'}</p>

      <h2>Assistent WALL-E</h2>
      <div class="row c2">
        <label>Volum del so (${prefs.wvol} %)<input type="range" id="s-wvol" min="0" max="100" step="5" value="${prefs.wvol}" /></label>
        <label>Com respon<select id="s-voice">
          <option value="0" ${+prefs.voice === 0 ? 'selected' : ''}>Només text</option>
          <option value="1" ${+prefs.voice === 1 ? 'selected' : ''}>Només veu</option>
          <option value="2" ${+prefs.voice === 2 ? 'selected' : ''}>Text i veu</option>
        </select></label>
      </div>
      <label>Veu<select id="s-voicename">
        <option value="">Automàtica (la catalana que trobi)</option>
        ${(api.voices?.() || []).map((v) => `<option value="${esc(v.name)}" ${prefs.voiceName === v.name ? 'selected' : ''}>${esc(v.name)} (${esc(v.lang)})</option>`).join('')}
      </select></label>
      <p class="note">${esc(api.voiceInfo())}</p>
      <div class="btns"><button class="btn secondary small" id="s-wtest">Prova el so</button><button class="btn secondary small" id="s-vtest">Prova la veu</button></div>

      <div id="s-dades"></div>

      <h2>Núvol (Firebase, pla gratuït)</h2>
      ${c.enabled ? `
      <p class="note">Tot el plànol es desa en un sol document. Firestore limita cada document a <b>1 MB</b>; el pla gratuït dóna <b>1 GB</b> d’espai, <b>20.000 escriptures</b> i <b>50.000 lectures</b> al dia.</p>
      <div class="stat"><span>Mida del plànol desat</span><b>${fmtKB(c.bytes)} de ${fmtKB(FREE.docBytes)} (${pct(c.bytes, FREE.docBytes)} %)</b></div>${bar(c.bytes, FREE.docBytes)}
      <div class="stat"><span>Escriptures avui, des d’aquest dispositiu</span><b>${c.writes} de ${FREE.writesDay.toLocaleString('ca')}</b></div>${bar(c.writes, FREE.writesDay)}
      <div class="stat"><span>Lectures avui, des d’aquest dispositiu</span><b>${c.reads} de ${FREE.readsDay.toLocaleString('ca')}</b></div>${bar(c.reads, FREE.readsDay)}
      <div class="stat"><span>Espai total que ocupa l’app al núvol</span><b>≈ ${fmtKB(c.bytes + (c.bkBytes || 0))} de 1 GB (${pct(c.bytes + (c.bkBytes || 0), FREE.storageBytes)} %)</b></div>
      <p class="note">${c.items} mobles i ${c.rooms} habitacions${c.bkCount ? ` · ${c.bkCount} còpies de seguretat (${fmtKB(c.bkBytes)})` : ''}. Cada canvi es desa com a màxim un cop cada ${(api.cfgGet('saveDelay') / 1000).toLocaleString('ca')} s, i només compten les escriptures d’aquest dispositiu; les de l’altre mòbil s’han de sumar a part. Per veure el total exacte: consola de Firebase → Firestore → Ús.</p>`
      : '<p class="note">El núvol no està configurat en aquest dispositiu.</p>'}

      <h2>Compte</h2>
      ${api.userEmail?.() ? `<p class="note">Sessió iniciada com <b>${esc(api.userEmail())}</b>.</p><div class="btns"><button class="btn secondary small" id="s-signout">Tanca la sessió</button></div>` : '<p class="note">Sense sessió al núvol en aquest dispositiu.</p>'}

      <h2>Altres</h2>
      <p class="note">Versió: ${esc(api.version)} · ${api.standalone ? 'instal·lada com a app' : 'oberta al navegador'}. Les eines de developer (ajustos avançats, còpies de seguretat, estat JSON) s’obren amb <b>3 tocs</b> al botó ⚙, que gira i es posa vermell, i un 4t toc.</p>
      <div class="btns"><button class="btn danger small" id="s-reset-all">Restaura tota la configuració</button></div>`;

    api.renderDades?.(body.querySelector('#s-dades'));

    const set = (k, v) => { prefs[k] = v; savePrefs(); applyPrefs(api); if (k === 'units' || k === 'unitLabel') api.applyUnits?.(); };
    body.querySelector('#s-theme').addEventListener('change', (e) => set('theme', e.target.value));
    body.querySelector('#s-font').addEventListener('change', (e) => set('font', e.target.value));
    body.querySelector('#s-startview').addEventListener('change', (e) => set('startView', e.target.value));
    body.querySelector('#s-units').addEventListener('change', (e) => set('units', e.target.value));
    body.querySelector('#s-warn').addEventListener('change', (e) => set('warn', e.target.value));
    body.querySelector('#s-voicename').addEventListener('change', (e) => { set('voiceName', e.target.value); api.pickVoice?.(); render(); });
    const camSel = body.querySelector('#s-cam-room');
    body.querySelector('#s-cam-save').addEventListener('click', () => { (prefs.cams ||= {})[camSel.value] = api.getCamera(); savePrefs(); render(); api.toast?.('📷 Vista desada.'); });
    body.querySelector('#s-cam-go').addEventListener('click', () => { close(); api.frame(camSel.value === '_all' ? null : api.rooms().find((r) => r.id === camSel.value)); });
    body.querySelector('#s-cam-del').addEventListener('click', () => { if (prefs.cams) delete prefs.cams[camSel.value]; savePrefs(); render(); });
    body.querySelectorAll('[data-pref]').forEach((inp) => inp.addEventListener('input', () => set(inp.dataset.pref, inp.value)));
    body.querySelector('#s-reset-colors').addEventListener('click', () => {
      for (const k of ['accent', 'bg', 'panel', 'ink']) prefs[k] = '';
      prefs.wall3d = PREFS_DEFAULT.wall3d; prefs.bg3d = ''; prefs.theme = 'dark';
      savePrefs(); applyPrefs(api); render();
    });
    body.querySelector('#s-wvol').addEventListener('input', (e) => { set('wvol', +e.target.value); e.target.parentElement.firstChild.textContent = `Volum del so (${prefs.wvol} %)`; });
    body.querySelector('#s-voice').addEventListener('change', (e) => set('voice', +e.target.value));
    for (const [id, k] of [['s-autoopen', 'autoOpen'], ['s-hint', 'hint'], ['s-shadows', 'shadows'], ['s-confirmdel', 'confirmDel'], ['s-unitlabel', 'unitLabel'], ['s-vib', 'vib']]) {
      body.querySelector('#' + id).addEventListener('change', (e) => set(k, e.target.checked ? 1 : 0));
    }
    body.querySelector('#s-signout')?.addEventListener('click', () => { close(); api.signOut(); });
    body.querySelector('#s-wtest').addEventListener('click', () => api.walleSay(true));
    body.querySelector('#s-vtest').addEventListener('click', () => api.sayTest());
    body.querySelector('#s-reset-all').addEventListener('click', () => { prefs = { ...PREFS_DEFAULT, cams: {} }; savePrefs(); applyPrefs(api); api.applyUnits?.(); render(); });
  }
  return { open, close, render, relock };
}
