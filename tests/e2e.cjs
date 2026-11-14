// Prova de punta a punta al navegador (Chromium amb Playwright): node tests/e2e.cjs
// Serveix l'app en local, substitueix Firebase per un mòdul buit i comprova que les funcions principals responen sense errors.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const PORT = +process.env.PORT || 8199;
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.mp3': 'audio/mpeg', '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.gz': 'application/gzip', '.wasm': 'application/wasm' };
const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
  const f = path.join(root, p);
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': mime[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f));
}).listen(PORT);
const STUB = 'export function initializeApp(){return {}}; export function getAuth(){return {}}; export function getFirestore(){return {}}; export async function getRedirectResult(){}; export function onAuthStateChanged(a,cb){ setTimeout(()=>cb(null),50) }; export function signOut(){}; export class GoogleAuthProvider{setCustomParameters(){}}; export function doc(){return {}}; export async function getDoc(){}; export function onSnapshot(){return ()=>{}}; export async function setDoc(){}; export function serverTimestamp(){}; export async function signInWithPopup(){}; export async function signInWithRedirect(){}';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
async function step(name, fn) {
  try { const r = await fn(); results.push({ ok: true, name, r }); } catch (e) { results.push({ ok: false, name, r: String(e.message || e).slice(0, 400) }); }
}
const must = (c, msg) => { if (!c) throw new Error(msg); };

(async () => {
  const br = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const errs = [];
  const ctx = await br.newContext({ viewport: { width: 1280, height: 820 }, acceptDownloads: true });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) errs.push(m.text()); });
  await p.addInitScript(() => { try { if (!localStorage.getItem('planta3d-prefs')) localStorage.setItem('planta3d-prefs', JSON.stringify({ tbStyle: 'classic', v2: 1, v3: 1, v4: 1 })); } catch (e) { /* res */ } });
  await p.route('**/vendor/firebase.js', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: STUB }));
  await p.route('**/sw.js', (r) => r.fulfill({ status: 404, body: '' }));
  const ev = (fn, a) => p.evaluate(fn, a);

  await step('l’app arrenca', async () => {
    await p.goto(`http://localhost:${PORT}/`);
    await p.waitForFunction(() => window.planta3d && window.planta3d.state, null, { timeout: 30000 });
    await sleep(1500); // la pantalla d'inici de sessió surt quan Firebase respon (aquí, sense usuari)
    await ev(() => { document.getElementById('gate').hidden = true; });
    await sleep(300);
    const s = await ev(() => ({ rooms: planta3d.state.rooms.length, items: planta3d.state.items.length, v: planta3d.api.version }));
    must(s.rooms > 5 && s.items > 5, JSON.stringify(s));
    return s;
  });
  await step('vistes 3D, planta i passeig', async () => {
    for (const v of ['top', 'walk', '3d']) { await ev((v) => planta3d.setView(v), v); await sleep(250); }
    return await ev(() => planta3d.ui.view);
  });
  await step('afegir, girar i desfer un moble', async () => {
    const n0 = await ev(() => planta3d.state.items.length);
    await ev(() => { const r = planta3d.state.rooms.find((x) => x.name === 'Menjador'); planta3d.api.addItems('sillon', {}, 1, r.id); });
    const n1 = await ev(() => planta3d.state.items.length);
    must(n1 === n0 + 1, `${n0} → ${n1}`);
    await ev(() => planta3d.api.undo()); await sleep(100);
    must(await ev(() => planta3d.state.items.length) === n0, 'desfer');
    return { n0, n1 };
  });
  await step('botó ↶ mentre s’edita un moble', async () => {
    const n0 = await ev(() => planta3d.state.items.length);
    must(!(await p.isVisible('#p-undo')), 'visible abans d’editar');
    await ev(() => { const r = planta3d.state.rooms.find((x) => x.name === 'Menjador'); planta3d.api.addItems('mesita', {}, 1, r.id); });
    await sleep(150);
    must(await p.isVisible('#p-undo'), 'no surt en posar un moble');
    // girar-lo i desfer només el gir
    await ev(() => planta3d.api.rotateSel(90)); await sleep(100);
    const rot = await ev(() => planta3d.state.items.at(-1).rot);
    await p.click('#p-undo'); await sleep(150);
    must(await ev(() => planta3d.state.items.at(-1).rot) !== rot, 'no ha desfet el gir');
    await p.click('#p-undo'); await sleep(150);
    must(await ev(() => planta3d.state.items.length) === n0, 'no ha tret el moble posat');
    must(!(await p.isVisible('#p-undo')), 'continua visible sense moble');
    return 0;
  });
  await step('la llista de tipus no es tanca sola', async () => {
    await ev(() => planta3d.setTab ? planta3d.setTab('muebles') : document.querySelector('[data-tab="muebles"]')?.click());
    await p.focus('#f-type');
    const same = await ev(() => { const a = document.getElementById('f-type'); planta3d.api.setPlan({}); return document.getElementById('f-type') === a && document.activeElement === a; });
    must(same, 'la llista s’ha tornat a dibuixar mentre era oberta');
    await p.focus('#p-name').catch(() => {}); await ev(() => document.activeElement?.blur()); await sleep(50);
    return 0;
  });
  await step('porta: toc llarg, tipus i sentit d’obertura', async () => {
    const sc = await ev(() => { planta3d.setView('3d'); const r = planta3d.state.rooms.find((x) => x.id === 'bano'); planta3d.frameCamera(r); const o = r.openings[0]; return [r.x + o.offset + o.width / 2, r.z + r.d + 15]; });
    await sleep(500);
    const [x, y] = await ev(([px, pz]) => planta3d.screenOf(px, pz, 0), sc);
    await p.mouse.move(x, y); await p.mouse.down(); await sleep(750); await p.mouse.up(); await sleep(200);
    must(await p.isVisible('#wallpanel [data-kind="llibre"]'), 'el toc llarg no obre el panell de la porta');
    let zf = 0;
    for (const k of ['corredissa', 'llibre', 'doble', 'batent']) {
      await p.click(`#wallpanel [data-kind="${k}"]`); await sleep(150);
      const kind = await ev(() => planta3d.state.rooms.find((x) => x.id === 'bano').openings[0].door || 'batent');
      must(kind === k, `tipus ${k} → ${kind}`);
      zf += await ev(() => planta3d.zFightFaces().length);
    }
    await p.click('#wallpanel [data-swing="out"]'); await sleep(150);
    must(await ev(() => planta3d.state.rooms.find((x) => x.id === 'bano').openings[0].swing === 'out'), 'sentit cap a fora');
    await p.click('#wallpanel [data-swing="in"]'); await p.click('#dp-close'); await sleep(100);
    must(zf === 0, `${zf} cares superposades en canviar el tipus de porta`);
    return 0;
  });
  await step('passeig: triar, arrossegar, girar i afegir mobles i tocar una paret', async () => {
    await ev(() => { planta3d.api.select(null); planta3d.setView('walk'); const r = planta3d.state.rooms.find((x) => x.id === 'salon'); Object.assign(planta3d.walk, { x: r.x + r.w / 2, z: r.z + 120, yaw: Math.PI, pitch: -0.3 }); });
    await sleep(400);
    const t = await ev(() => { const it = planta3d.state.items.find((i) => i.type === 'mesaCentro'); return { id: it.id, x: it.x, z: it.z, sc: planta3d.screenOf(it.x, it.z, it.h - 2) }; });
    await p.mouse.click(t.sc[0], t.sc[1]); await sleep(200);
    must(await ev(() => planta3d.ui.selected) === t.id, 'tocar un moble al passeig no el tria');
    must(await p.isVisible('#selbar'), 'sense barra ràpida al passeig');
    await p.mouse.move(t.sc[0], t.sc[1]); await p.mouse.down();
    for (let k = 1; k <= 6; k++) { await p.mouse.move(t.sc[0] + k * 6, t.sc[1] + k * 4); await sleep(20); }
    await p.mouse.up(); await sleep(150);
    const moved = await ev((id) => { const i = planta3d.state.items.find((x) => x.id === id); return [i.x, i.z]; }, t.id);
    must(moved[0] !== t.x || moved[1] !== t.z, 'arrossegar el moble triat no el mou');
    await p.click('#selbar [data-act=undo]'); await sleep(100);
    await p.keyboard.press('r'); await sleep(100);
    const n0 = await ev(() => planta3d.state.items.length);
    await p.click('#wk-add'); await p.click('#infodlg [data-type="planta"]'); await sleep(200);
    must(await ev(() => planta3d.state.items.length) === n0 + 1, '＋ no afegeix el moble');
    await p.keyboard.press('Escape'); await sleep(100);
    must(await ev(() => planta3d.ui.view === 'walk' && !planta3d.ui.selected), 'Esc ha de deixar el moble sense sortir del passeig');
    const w = await ev(() => { const r = planta3d.state.rooms.find((x) => x.id === 'salon'); return planta3d.screenOf(r.x + r.w / 2, r.z + r.d, 150); });
    await p.mouse.click(w[0], w[1]); await sleep(200);
    must(await p.isVisible('#wallpanel'), 'tocar una paret al passeig no obre el panell');
    await ev(() => { planta3d.setView('3d'); }); await sleep(100);
    return 0;
  });
  await step('la barra ràpida es pot moure amb l’asa i torna al seu lloc', async () => {
    await ev(() => { planta3d.setView('walk'); const it = planta3d.state.items.find((i) => i.type === 'mesaCentro'); planta3d.api.select(it.id); });
    await sleep(200);
    const g = await p.locator('#selbar [data-act=grip]').boundingBox();
    must(g, 'sense asa');
    const vp = await p.locator('#viewport').boundingBox();
    await p.mouse.move(g.x + g.width / 2, g.y + g.height / 2); await p.mouse.down();
    for (let k = 1; k <= 8; k++) { await p.mouse.move(g.x + g.width / 2 + (vp.x + 300 - g.x) * k / 8, g.y + g.height / 2 + (vp.y + 200 - g.y) * k / 8); await sleep(15); }
    await p.mouse.up(); await sleep(150);
    const r = await p.locator('#selbar').boundingBox();
    must(Math.abs(r.y - (vp.y + 200)) < 40, `la barra no s’ha mogut (y ${Math.round(r.y)})`);
    must(await ev(() => !!planta3d.prefs.selbarPos?.walk), 'no es recorda la posició');
    await ev(() => planta3d.api.select(null)); await sleep(50);
    await ev(() => { const it = planta3d.state.items.find((i) => i.type === 'mesaCentro'); planta3d.api.select(it.id); }); await sleep(150);
    const r2 = await p.locator('#selbar').boundingBox();
    must(Math.abs(r2.y - r.y) < 3, 'en tornar a triar el moble la barra no és on s’havia deixat');
    const g2 = await p.locator('#selbar [data-act=grip]').boundingBox();
    await p.mouse.click(g2.x + 5, g2.y + 5); await sleep(60); await p.mouse.click(g2.x + 5, g2.y + 5); await sleep(150);
    must(await ev(() => !planta3d.prefs.selbarPos?.walk && !document.getElementById('selbar').classList.contains('placed')), 'el doble toc no la torna al seu lloc');
    await ev(() => { planta3d.api.select(null); planta3d.setView('3d'); }); await sleep(100);
    return 0;
  });
  await step('panell del moble: zones, notes i vot', async () => {
    const id = await ev(() => { const s = planta3d.state.items.find((i) => i.type === 'sofa'); planta3d.api.select(s.id); return s.id; });
    await sleep(200);
    must(await p.isVisible('#props'), 'panell');
    await p.click('#p-social .vote[data-v="1"]'); await sleep(100);
    await p.click('#p-social details.notes summary');
    await p.fill('#p-social form.add input', 'prova'); await p.click('#p-social form.add button'); await sleep(150);
    const it = await ev((id) => planta3d.state.items.find((x) => x.id === id), id);
    must(it.votes && it.notes?.length === 1, JSON.stringify({ v: it.votes, n: it.notes }));
    must((await ev(() => planta3d.state.log || [])).length >= 2, 'historial');
    return { votes: it.votes };
  });
  await step('propostes amb objectius', async () => {
    await p.click('.tabs button[data-tab="distribuir"]'); await sleep(150);
    const dorm = await ev(() => planta3d.state.rooms.find((x) => x.name === 'Dormitori').id);
    await p.selectOption('#d-room', dorm); await sleep(150);
    await p.click('#d-gen');
    await p.waitForFunction(() => document.querySelector('.prop-nav'), null, { timeout: 90000 });
    return await ev(() => [...document.querySelectorAll('ul.goal-rep li')].map((l) => l.className));
  });
  await step('llista de compra i CSV', async () => {
    await p.click('.tabs button[data-tab="compra"]'); await sleep(150);
    await p.check('#sh-all'); await sleep(100);
    const li = await p.$('ul.shop li');
    must(li, 'sense files');
    await (await li.$('select.st')).selectOption('comprar');
    await sleep(100);
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#sh-csv')]);
    const csv = fs.readFileSync(await dl.path(), 'utf8');
    must(csv.includes('Habitació;Moble'), csv.slice(0, 80));
    return csv.split('\n').length;
  });
  await step('plànol a escala', async () => {
    await ev(() => { const d = document.createElement('div'); d.id = 's-dades'; document.body.appendChild(d); planta3d.api.renderDades(d); window._html = ''; window.open = () => ({ document: { write: (h) => { window._html += h; }, close() {} } }); });
    await p.click('#x-scale'); await sleep(150);
    const h = await ev(() => window._html);
    must(/<svg[^>]*mm"/.test(h) && /@page/.test(h), 'sense SVG');
    await ev(() => document.getElementById('s-dades').remove());
    return /Escala 1:\d+/.exec(h)?.[0];
  });
  await step('cinta mètrica i zones (botons)', async () => {
    await p.click('#tapeBtn'); await sleep(100);
    const on = await ev(() => planta3d.tape?.active);
    await p.keyboard.press('Escape'); await sleep(100);
    await p.click('#zonesBtn'); await sleep(100); await p.click('#zonesBtn');
    return { tape: on };
  });
  await step('cap cara superposada (parets pintades, baranes, finestres, mobles)', async () => {
    // dues cares al mateix pla amb colors diferents parpellegen: no n'hi ha d'haver cap, ni pintant parets ni en cap vista
    const found = {};
    for (const mode of ['low', 'full', 'none']) {
      await ev((m) => { const s = document.getElementById('wallMode'); s.value = m; s.dispatchEvent(new Event('change')); }, mode);
      await ev(() => { const cols = ['#7f9a82', '#c46e4b', '#8fa9bf', '#e3b55b']; planta3d.state.rooms.forEach((r, i) => { if (r.kind === 'room') r.walls = { N: cols[i % 4], S: cols[(i + 1) % 4], E: cols[(i + 2) % 4], W: cols[(i + 3) % 4] }; }); });
      for (const view of ['top', '3d']) { await ev((v) => planta3d.setView(v), view); await sleep(150); const z = await ev(() => planta3d.zFightFaces()); if (z.length) found[mode + '/' + view] = z.slice(0, 3); }
      await ev(() => planta3d.state.rooms.forEach((r) => delete r.walls));
    }
    // tots els mobles del catàleg, en totes les formes
    const cat = await ev(async () => {
      const v = document.querySelector('script[type=module][src*="main.js"]').src.split('?')[1];
      const F = await import('./js/furniture.js?' + v), bad = [];
      for (const type of Object.keys(F.CATALOG)) for (const [shape] of F.SHAPES[type] || [[undefined]]) for (let k = 0; k < 6; k++) {
        const it = F.newItem(type, shape ? { shape, ...(F.SHAPE_SIZES[type]?.[shape] || {}) } : {}); it.id = 'zf' + k;
        if (planta3d.zFightFaces(0.05, [F.buildFurniture(it)]).length) bad.push(type + (shape ? '/' + shape : ''));
      }
      return [...new Set(bad)];
    });
    if (cat.length) found.mobles = cat;
    must(!Object.keys(found).length, JSON.stringify(found).slice(0, 400));
    return 0;
  });
  await step('cap error a la consola', async () => { must(!errs.length, errs.slice(0, 5).join(' | ')); return 0; });

  for (const r of results) console.log(`${r.ok ? '✓' : '✗'} ${r.name}${r.r !== undefined ? ' — ' + JSON.stringify(r.r).slice(0, 200) : ''}`);
  await br.close(); srv.close();
  process.exit(results.every((r) => r.ok) ? 0 : 1);
})().catch((e) => { console.error(e); srv.close(); process.exit(1); });
