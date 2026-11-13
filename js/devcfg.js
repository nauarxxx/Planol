// Configuració avançada (mode developer, vermella): s'obre amb 3 tocs al botó ⚙ (gira la moneda) i un 4t toc.
// Els ajustos es desen al núvol amb el plànol (state.cfg) i surten a ↶ Desfés. També hi ha les còpies de seguretat
// i un editor directe de l'estat (JSON). Mateixa lògica que la web inventari.

export const CFGD = {
  tap: 1200, aiwait: 450, coin: 3000,          // triple toc (ms), espera del toc simple (ms), segons fins a bloquejar la moneda (ms)
  wgap: 2000,                                   // repetició mínima del so de WALL-E (ms)
  histMax: 80,                                  // passos de ↶ Desfés
  saveDelay: 800,                               // ms entre l'últim canvi i el desat al núvol
  tries: 2000, count: 4,                        // intents i propostes del generador
  clear: 60, gapMin: 65,                        // pas lliure mínim (accessibilitat) i pas entre mobles (cm)
  walkSpeed: 160, eyeHeight: 160,               // passeig: cm/s i alçada dels ulls
  snap: 5,                                      // imant (cm)
  lowWall: 100,                                 // alçada de les parets «baixes» (cm)
  shadow: 4096, pixelRatio: 2,                  // resolució de les ombres i píxels per punt màxims
  labelScale: 100,                              // mida de les etiquetes del plànol (%)
  bkMax: 15, bkAuto: 0, bkDays: 15,             // còpies que es guarden · dies entre còpies automàtiques (0 = mai) · dies fins que caduca una còpia (0 = mai)
  perf: 0,                                      // mode rendiment (menys píxels, sense ombres, 30 fps)
  catalogPhoto: 180,                            // mida de les fotos del catàleg (px)
};
export const CFGR = {
  tap: [400, 3000], aiwait: [200, 1000], coin: [1000, 10000], wgap: [500, 10000], histMax: [10, 500], saveDelay: [200, 5000],
  tries: [200, 10000], count: [2, 8], clear: [40, 100], gapMin: [40, 120], walkSpeed: [50, 400], eyeHeight: [100, 200], snap: [1, 20],
  lowWall: [20, 250], shadow: [1024, 8192], pixelRatio: [1, 3], labelScale: [50, 200], bkMax: [1, 50], bkAuto: [0, 60], bkDays: [0, 365], perf: [0, 1], catalogPhoto: [80, 600],
};
export const CFG_LABEL = {
  tap: 'Temps del triple toc', aiwait: 'Espera del toc simple', coin: 'Segons abans de bloquejar la moneda', wgap: 'Repetició mínima del so de WALL-E',
  histMax: 'Passos que guarda Desfés', saveDelay: 'Retard del desat al núvol', tries: 'Intents del generador de propostes', count: 'Propostes que es mostren',
  clear: 'Pas lliure mínim per arribar a un moble', gapMin: 'Pas mínim entre mobles', walkSpeed: 'Velocitat del passeig', eyeHeight: 'Alçada dels ulls al passeig',
  snap: 'Imant', lowWall: 'Alçada de les parets baixes', shadow: 'Resolució de les ombres', pixelRatio: 'Píxels per punt (màxim)', labelScale: 'Mida de les etiquetes',
  bkMax: 'Còpies de seguretat que es guarden', bkAuto: 'Dies entre còpies automàtiques', bkDays: 'Dies fins que caduca una còpia', perf: 'Mode rendiment (0 = no, 1 = sí)', catalogPhoto: 'Mida de les fotos del catàleg',
};
const SEC = new Set(['tap', 'aiwait', 'coin', 'wgap', 'saveDelay']); // es mostren en segons
const UNIT = { tap: 's', aiwait: 's', coin: 's', wgap: 's', histMax: 'passos', saveDelay: 's', tries: 'intents', count: 'propostes', clear: 'cm', gapMin: 'cm', walkSpeed: 'cm/s', eyeHeight: 'cm', snap: 'cm', lowWall: 'cm', shadow: 'px', pixelRatio: '×', labelScale: '%', bkMax: 'còpies', bkAuto: 'dies', bkDays: 'dies', perf: '', catalogPhoto: 'px' };

export function cfgClean(c) {
  const out = {};
  for (const k of Object.keys(CFGD)) {
    const v = +c?.[k];
    if (!Number.isFinite(v) || v === CFGD[k]) continue;
    out[k] = Math.min(CFGR[k][1], Math.max(CFGR[k][0], v));
  }
  return out;
}
export const makeCfgGet = (api) => (k) => { const v = +(api.cfg()?.[k]); return Number.isFinite(v) ? Math.min(CFGR[k][1], Math.max(CFGR[k][0], v)) : CFGD[k]; };

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtKB = (b) => (b / 1024).toLocaleString('ca', { maximumFractionDigits: 1 }) + ' KB';
export const bkWhen = (ts) => { const d = new Date(ts); return d.toLocaleDateString('ca', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' + d.toLocaleTimeString('ca', { hour: '2-digit', minute: '2-digit' }); };

export function initDevCfg(api) {
  const cfgGet = makeCfgGet(api);
  const modal = document.getElementById('devcfg');
  const body = modal.querySelector('.modal-body');
  let bkBusy = false;

  const row = (k, sub) => {
    const sec = SEC.has(k), r = CFGR[k], v = cfgGet(k);
    const show = (x) => sec ? String(x / 1000).replace('.', ',') : String(x);
    return `<label class="cfrow"><span class="cft"><b>${esc(CFG_LABEL[k])}</b><small>Entre ${show(r[0])} i ${show(r[1])} · per defecte ${show(CFGD[k])}${sub ? ' · ' + sub : ''}</small></span><span class="cfin"><input type="number" inputmode="decimal" data-t="${k}" min="${sec ? r[0] / 1000 : r[0]}" max="${sec ? r[1] / 1000 : r[1]}" step="${sec ? 0.1 : 1}" value="${sec ? v / 1000 : v}" /><i>${UNIT[k]}</i></span></label>`;
  };

  function render() {
    const st = api.state();
    const json = JSON.stringify(st);
    const c = api.cloudInfo();
    const box = (v, l) => `<div class="cfstat"><b>${v}</b><small>${l}</small></div>`;
    body.innerHTML = `
      <div class="cfg"><h3>📊 Resum</h3>
        <div class="cfstats">${box(st.items.length, 'mobles')}${box(st.rooms.length, 'habitacions')}${box((st.catalog || []).length, 'al catàleg')}${box((st.scenes || []).length, 'escenes')}${box(fmtKB(json.length), 'estat')}${box(c.writes, 'escriptures avui')}</div>
        <p class="cfn">Versió del plànol: v${st.version || 1} · app ${esc(api.version)} · ${c.enabled ? 'núvol actiu' : 'sense núvol'} · ${api.standalone ? 'instal·lada' : 'al navegador'}.</p>
      </div>
      <div class="cfg"><h3>💾 Còpies de seguretat</h3>
        <p class="cfn">Són manuals, com a la web inventari: es guarden al núvol (col·lecció <b>planta3d</b>, documents <b>bk_…</b>) i <b>caduquen als ${cfgGet('bkDays') || '∞'} dies</b> per estalviar espai. Abans de restaurar-ne una es crea una còpia de l’estat actual, per poder tornar enrere.</p>
        <div class="bkbar"><input type="text" id="bk-name" placeholder="Nom de la còpia (opcional)" /><button class="btn primary" id="bk-create">💾 Crea una còpia</button></div>
        <div class="progress" id="bk-prog" hidden><div class="bar"></div><span></span></div>
        <ul class="bklist" id="bk-list"><li class="bkempty">Carregant…</li></ul>
        ${row('bkMax', 's’esborra la més antiga')}
        ${row('bkDays', '0 = no caduquen; s’esborren en obrir les eines o en crear-ne una')}
        ${row('bkAuto', '0 = desactivada (manual); si toca, es fa en obrir l’app o en tancar-la')}
      </div>
      <div class="cfg"><h3>⏱️ Funcionament</h3><p class="cfn">Temps en segons. Si poses un valor fora del rang, el camp es marca en vermell.</p>
        ${row('tap')}${row('aiwait')}${row('coin')}${row('wgap')}${row('histMax')}${row('saveDelay')}${row('snap')}
      </div>
      <div class="cfg"><h3>🪄 Propostes</h3>
        ${row('tries', 'més intents = millors propostes però més lent')}${row('count')}${row('clear')}${row('gapMin')}
      </div>
      <div class="cfg"><h3>🖼️ 3D i passeig</h3>
        ${row('perf', 'píxels a 1×, sense ombres i 30 fps: per a mòbils lents')}${row('lowWall')}${row('labelScale')}${row('shadow', 'cal recarregar')}${row('pixelRatio', 'cal recarregar')}${row('walkSpeed')}${row('eyeHeight')}${row('catalogPhoto')}
      </div>
      <div class="cfg"><h3>🧪 Estat (JSON)</h3>
        <p class="cfn">L’estat sencer tal com es desa. Pots editar-lo i aplicar-lo (es valida abans; queda a ↶ Desfés). Útil per retocar coses que la interfície no deixa.</p>
        <textarea id="dev-json" rows="10" spellcheck="false">${esc(JSON.stringify(st, null, 1))}</textarea>
        <div class="btns"><button class="btn primary" id="dev-json-apply">Aplica el JSON</button><button class="btn" id="dev-json-copy">Copia</button><button class="btn" id="dev-json-reload">Recarrega</button></div>
      </div>
      <div class="cfg"><h3>🧰 Eines</h3>
        <div class="btns">
          <button class="btn" id="dev-sw">♻️ Neteja la memòria cau i recarrega</button>
          <button class="btn" id="dev-migrate">🔁 Torna a aplicar el plànol per defecte (mantén els mobles)</button>
          <button class="btn" id="dev-resave">☁️ Força el desat al núvol</button>
          <button class="btn" id="dev-log">📋 Mostra el registre</button>
          <button class="btn" id="dev-cfg-export">⬇ Exporta els ajustos (.json)</button>
          <label class="btn" style="display:inline-block">⬆ Importa els ajustos<input type="file" id="dev-cfg-import" accept="application/json,.json" hidden /></label>
        </div>
        <h3>📱 Simulador de pantalla</h3>
        <p class="cfn">Obre l’app en una finestra de la mida d’un mòbil per provar el disseny des del PC (cal tenir la sessió iniciada).</p>
        <div class="btns">
          <button class="btn" data-sim="375x812xiPhone 13 mini">iPhone 13 mini (375 × 812)</button>
          <button class="btn" data-sim="412x915xOnePlus 8T">OnePlus 8T (412 × 915)</button>
          <button class="btn" data-sim="820x1180xiPad">iPad (820 × 1180)</button>
        </div>
        <pre id="dev-logbox" hidden></pre>
      </div>`;
    body.querySelectorAll('input[data-t]').forEach((inp) => inp.addEventListener('input', () => inp.classList.remove('bad')));
    body.querySelector('#bk-create').addEventListener('click', async () => { const n = body.querySelector('#bk-name').value.trim(); const b = await bkCreate(n); if (b) body.querySelector('#bk-name').value = ''; });
    body.querySelector('#dev-json-apply').addEventListener('click', () => {
      try {
        const s = JSON.parse(body.querySelector('#dev-json').value);
        if (!Array.isArray(s.rooms) || !Array.isArray(s.items)) throw new Error('Falten rooms o items');
        api.replaceState(s); api.toast('✓ Estat aplicat. Ho pots desfer amb ↶.'); render();
      } catch (e) { api.toast('⚠️ JSON no vàlid: ' + e.message); }
    });
    body.querySelector('#dev-json-copy').addEventListener('click', () => { navigator.clipboard?.writeText(body.querySelector('#dev-json').value).then(() => api.toast('Copiat.')); });
    body.querySelector('#dev-json-reload').addEventListener('click', render);
    body.querySelector('#dev-sw').addEventListener('click', async () => {
      try { const ks = await caches.keys(); await Promise.all(ks.map((k) => caches.delete(k))); const regs = await navigator.serviceWorker?.getRegistrations(); for (const r of regs || []) await r.unregister(); } catch (e) { /* res */ }
      location.reload();
    });
    body.querySelector('#dev-migrate').addEventListener('click', () => { api.remigrate(); api.toast('Plànol per defecte aplicat.'); render(); });
    body.querySelector('#dev-resave').addEventListener('click', () => { api.save(); api.toast('Desant…'); });
    body.querySelector('#dev-log').addEventListener('click', () => { const p = body.querySelector('#dev-logbox'); p.hidden = !p.hidden; p.textContent = api.log().join('\n') || '(buit)'; });
    body.querySelector('#dev-cfg-export').addEventListener('click', () => {
      const blob = new Blob([JSON.stringify({ app: 'planta3d', version: api.version, ts: Date.now(), cfg: cfgClean(api.cfg()) }, null, 2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'planta3d-ajustos.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });
    body.querySelector('#dev-cfg-import').addEventListener('change', async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try { const j = JSON.parse(await f.text()); const c = cfgClean(j.cfg || j); api.setCfg(c); api.toast(`✓ ${Object.keys(c).length} ajustos importats.`); render(); }
      catch (err) { api.toast('⚠️ El fitxer no és vàlid.'); }
    });
    body.querySelectorAll('[data-sim]').forEach((b) => b.addEventListener('click', () => { const [w, h, name] = b.dataset.sim.split('x'); close(); api.simulate(+w, +h, name); }));
    bkRender();
  }

  function collect() {
    const out = {}; let bad = null;
    for (const inp of body.querySelectorAll('input[data-t]')) {
      const k = inp.dataset.t, v = inp.valueAsNumber, r = CFGR[k];
      const val = SEC.has(k) ? Math.round(v * 1000) : v;
      const ok = Number.isFinite(v) && val >= r[0] && val <= r[1] && (SEC.has(k) || Math.floor(v) === v);
      inp.classList.toggle('bad', !ok);
      if (!ok) { bad = bad || inp; continue; }
      out[k] = val;
    }
    if (bad) { bad.focus(); api.toast('⚠️ Revisa els camps en vermell: només números dins del rang indicat.'); return null; }
    return cfgClean(out);
  }
  modal.querySelector('#dev-save').addEventListener('click', () => {
    const r = collect(); if (!r) return;
    if (JSON.stringify(cfgClean(api.cfg())) === JSON.stringify(r)) { api.toast('No hi ha cap canvi per desar.'); return; }
    api.setCfg(r); api.toast('✓ Ajustos desats. Ho pots desfer des de ↶.'); render();
  });
  modal.querySelector('#dev-reset').addEventListener('click', () => {
    if (!Object.keys(cfgClean(api.cfg())).length) { api.toast('Ja estan tots els valors per defecte.'); return; }
    if (!confirm('Restaurar TOTS els ajustos avançats als valors per defecte?')) return;
    api.setCfg({}); api.toast('↺ Ajustos restaurats.'); render();
  });
  modal.querySelector('#devcfg-close').addEventListener('click', close);

  // ---- còpies de seguretat ----
  let BK = [], bkLoaded = false;
  const prog = (t, p) => { const el = body.querySelector('#bk-prog'); if (!el) return; el.hidden = false; el.querySelector('span').textContent = t; el.querySelector('.bar').style.width = Math.round((p || 0) * 100) + '%'; };
  const progHide = (ms) => setTimeout(() => { const el = body.querySelector('#bk-prog'); if (el && !bkBusy) el.hidden = true; }, ms || 0);
  async function bkLoad() {
    if (!api.cloud.enabled()) { bkLoaded = true; BK = []; return; }
    try { BK = (await api.cloud.backupList()).sort((a, b) => b.ts - a.ts); bkLoaded = true; await bkExpire(); } catch (e) { BK = []; bkLoaded = true; api.toast('⚠️ No s’han pogut llegir les còpies: ' + e.message); }
  }
  // Caducitat: les còpies més velles que «bkDays» s'esborren per estalviar espai (com a la web inventari).
  async function bkExpire() {
    const days = cfgGet('bkDays'); if (days <= 0 || !navigator.onLine) return 0;
    const lim = Date.now() - days * 864e5;
    const old = BK.filter((b) => b.ts < lim);
    for (const b of old) { try { await api.cloud.backupDelete(b.id); BK = BK.filter((x) => x.id !== b.id); } catch (e) { /* ho tornarà a provar */ } }
    return old.length;
  }
  function bkRender() {
    const ul = body.querySelector('#bk-list'); if (!ul) return;
    if (!api.cloud.enabled()) { ul.innerHTML = '<li class="bkempty">Les còpies es guarden al núvol: cal tenir la sessió iniciada.</li>'; return; }
    if (!bkLoaded) { ul.innerHTML = '<li class="bkempty">Carregant les còpies…</li>'; return; }
    if (!BK.length) { ul.innerHTML = '<li class="bkempty">Encara no hi ha cap còpia. Crea’n una amb el botó vermell.</li>'; return; }
    ul.innerHTML = BK.map((b) => {
      const tag = b.kind === 'safe' ? ' <em>🛟 de seguretat</em>' : b.kind === 'auto' ? ' <em>⏰ automàtica</em>' : b.kind === 'bot' ? ' <em>🤖 assistent</em>' : '';
      return `<li class="bki"><button type="button" class="bkrow" data-id="${esc(b.id)}"><span class="bkd">💾</span><span class="bkt"><b>${esc(b.name || 'Còpia de seguretat')}${tag}</b><small>${esc(bkWhen(b.ts))} · ${b.nItems} mobles · ${b.nRooms} habitacions · ${fmtKB(b.bytes || 0)} · ${esc((b.who || '').split('@')[0])}</small></span><span class="bkr">↶</span></button><button type="button" class="bkdel" data-id="${esc(b.id)}" title="Elimina la còpia">🗑️</button></li>`;
    }).join('');
    ul.querySelectorAll('.bkrow').forEach((b) => b.addEventListener('click', () => bkAsk(b.dataset.id, 'restore')));
    ul.querySelectorAll('.bkdel').forEach((b) => b.addEventListener('click', () => bkAsk(b.dataset.id, 'del')));
  }
  function bkAsk(id, mode) {
    if (bkBusy) return;
    const b = BK.find((x) => x.id === id); if (!b) return;
    const info = `${b.name || 'Còpia de seguretat'} · ${bkWhen(b.ts)} · ${b.nItems} mobles`;
    const msg = mode === 'del' ? `Eliminar aquesta còpia?\n${info}\nS’esborrarà de manera definitiva.` : `Restaurar aquesta còpia?\n${info}\n⚠️ Es substituiran TOTS els mobles, habitacions, catàleg, escenes i ajustos actuals, també als altres dispositius. Abans es crea una còpia automàtica de l’estat actual.`;
    if (!confirm(msg)) return;
    if (mode === 'del') bkDelete(id); else bkRestore(id);
  }
  async function bkMake(name, kind) {
    const st = api.state();
    const json = JSON.stringify(st);
    const meta = { ts: Date.now(), name: name || '', who: api.cloud.user()?.email || '', kind, nItems: st.items.length, nRooms: st.rooms.length, bytes: json.length, ver: api.version };
    const id = await api.cloud.backupSave(meta, json, (d, t) => prog(`Pujant la còpia… ${d} / ${t}`, d / t));
    return { id, ...meta };
  }
  async function bkPrune(fresh, protect) {
    const max = cfgGet('bkMax');
    const all = [fresh, ...BK.filter((b) => b.id !== fresh.id)].sort((a, b) => b.ts - a.ts);
    if (all.length <= max) return;
    for (const b of all.slice(max)) { if (b.id === protect || b.id === fresh.id) continue; await api.cloud.backupDelete(b.id); BK = BK.filter((x) => x.id !== b.id); }
  }
  async function bkCreate(name, o = {}) {
    if (bkBusy) return null;
    if (!api.cloud.enabled() || !api.cloud.user()) { api.toast('Cal tenir la sessió iniciada.'); return null; }
    if (!navigator.onLine) { api.toast('Cal connexió a internet per crear una còpia.'); return null; }
    bkBusy = true;
    try {
      prog('Creant la còpia…', 0.05);
      if (!bkLoaded) await bkLoad();
      const b = await bkMake(name, o.kind || 'manual');
      BK.unshift(b);
      prog('Netejant còpies velles…', 1); await bkPrune(b, o.protect); await bkExpire();
      prog('✓ Còpia creada', 1);
      if (!o.quiet) api.toast(`✓ Còpia creada: ${b.nItems} mobles.`);
      return b;
    } catch (e) { api.toast('⚠️ No s’ha pogut crear la còpia: ' + e.message); return null; }
    finally { bkBusy = false; progHide(1800); bkRender(); }
  }
  async function bkDelete(id) {
    if (bkBusy) return; bkBusy = true;
    try { await api.cloud.backupDelete(id); BK = BK.filter((b) => b.id !== id); api.toast('🗑️ Còpia eliminada.'); } catch (e) { api.toast('⚠️ ' + e.message); }
    finally { bkBusy = false; bkRender(); }
  }
  async function bkRestore(id) {
    const b = BK.find((x) => x.id === id); if (!b || bkBusy) return;
    if (!navigator.onLine) { api.toast('Cal connexió a internet per restaurar.'); return; }
    bkBusy = true;
    try {
      prog('Llegint la còpia…', 0.1);
      const json = await api.cloud.backupLoad(id);
      const s = JSON.parse(json);
      if (!s || !Array.isArray(s.rooms) || !Array.isArray(s.items)) throw new Error('La còpia està incompleta o trencada: no s’ha tocat res.');
      prog('Guardant l’estat actual (còpia de seguretat)…', 0.4);
      const safe = await bkMake(`Abans de restaurar «${b.name || bkWhen(b.ts)}»`, 'safe');
      BK.unshift(safe); await bkPrune(safe, id);
      prog('Restaurant…', 0.8);
      api.replaceState(s);
      prog('✓ Còpia restaurada', 1);
      api.toast(`✓ Còpia restaurada: ${b.nItems} mobles. Ja es veu a tots els dispositius.`);
      render();
    } catch (e) { api.toast('⚠️ ' + e.message); prog('⚠️ ' + e.message, 0); }
    finally { bkBusy = false; progHide(2500); bkRender(); }
  }
  let autoDone = false;
  const bkDue = () => { const days = cfgGet('bkAuto'); return days > 0 && Date.now() - (BK.length ? BK[0].ts : 0) >= days * 864e5; };
  async function bkAutoCheck() {
    if (autoDone || !api.cloud.enabled() || !api.cloud.user()) return;
    if (cfgGet('bkAuto') <= 0) return;
    autoDone = true;
    if (!bkLoaded) await bkLoad();
    if (bkDue()) setTimeout(() => { if (bkDue() && !bkBusy) bkCreate('Còpia automàtica', { kind: 'auto', quiet: true }); }, 2000 + Math.random() * 3000);
  }
  // També en tancar o amagar l'app, si toca una còpia automàtica i hi ha canvis des de l'última.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden || bkBusy || !bkLoaded || !api.cloud.enabled() || !api.cloud.user()) return;
    const st = api.state();
    if (bkDue() && (!BK.length || BK[0].nItems !== st.items.length || BK[0].bytes !== JSON.stringify(st).length)) bkCreate('Còpia automàtica (en tancar)', { kind: 'auto', quiet: true });
  });

  async function open() {
    modal.hidden = false; render();
    if (!bkLoaded) { await bkLoad(); bkRender(); }
  }
  function close() { modal.hidden = true; api.onDevClose?.(); }

  return { open, close, cfgGet, bkCreate, bkList: () => BK, bkLoaded: () => bkLoaded, bkLoad, bkAutoCheck, render };
}
