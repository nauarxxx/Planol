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
