import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';
import { DEFAULT_PLAN } from './plan.js?v=39';
import { CATALOG, SHAPES, SHAPE_SIZES, hasWing, shapeParams, buildFurniture, newItem, onPhotoLoaded } from './furniture.js?v=39';
import { generateLayouts, generateLayoutsAsync } from './layout.js?v=39';
import { cloudEnabled, initCloud, signIn, signOutUser, saveRemote, loadRemote, setSaveDelay, currentUserEmail, currentUser, backupList, backupSave, backupLoad, backupDelete } from './cloud.js?v=39';
import { mergeStates } from './merge.js?v=39';
import { prefs, applyPrefs, initSettings } from './settings.js?v=39';
import { CFGD, CFGR, cfgClean, initDevCfg } from './devcfg.js?v=39';
import { initAssistant } from './assistant.js?v=39';
import { drawPlan, printSheet, printScale, fitScale } from './sheet.js?v=39';
import { initMeasure } from './measure.js?v=39';
import { initColorPicker } from './colorpicker.js?v=39';
import { initPhotoAdd } from './photo.js?v=39';
import { initTape } from './tape.js?v=39';
import { checkZones } from './zones.js?v=39';
import { fitCheck } from './fit.js?v=39';
import { initShop, STATUS, statusOf } from './shop.js?v=39';
import { GOALS, GOAL_DEFAULT } from './goals.js?v=39';
import { STORE_KEY, clone, loadState, migratePlan } from './state.js?v=39';
import { drawPreview as drawRoomPreview } from './preview.js?v=39';
import { arSupported, startAR as startARView } from './ar.js?v=39';
import { initLayoutGuard, relayout } from './layoutguard.js?v=39';
import { editWall, edgeOf, wallSegments, sideInfo, defaultSide } from './walledit.js?v=39';
import { initLog, logHtml, itemSocialHtml, bindItemSocial, saveProposal, savedHtml, bindSaved } from './social.js?v=39';
import { corners, aabb, overlaps, parts, innerRect, outsideAmount, roomAt, allOpenings, allSwings, swingArc, boxHitsSwing, doorSwing, structItems, DEG } from './geom.js?v=39';

// ---------------------------------------------------------------- estado
let state = migratePlan(loadState());
// Ajustos avançats (mode developer): es desen amb el plànol a state.cfg; si no n'hi ha, valors per defecte.
const cfgGet = (k) => { const v = +(state.cfg?.[k]); return Number.isFinite(v) ? Math.min(CFGR[k][1], Math.max(CFGR[k][0], v)) : CFGD[k]; };
// Registre d'errors per a les eines de developer.
const logBuf = [];
const logAdd = (kind, msg) => { logBuf.push(`${new Date().toLocaleTimeString('ca')} ${kind} ${msg}`); if (logBuf.length > 200) logBuf.shift(); };
window.addEventListener('error', (e) => logAdd('✖', `${e.message} (${(e.filename || '').split('/').pop()}:${e.lineno})`));
window.addEventListener('unhandledrejection', (e) => logAdd('✖', String(e.reason?.message || e.reason)));
{ const ce = console.error.bind(console), cw = console.warn.bind(console); console.error = (...a) => { logAdd('✖', a.map(String).join(' ')); ce(...a); }; console.warn = (...a) => { logAdd('⚠', a.map(String).join(' ')); cw(...a); }; }
const ui = { ws: null, wallSel: null, wallAll: false, selected: null, view: '3d', wallMode: 'low', snap: true, labels: true, measures: true, layoutRoom: null, proposals: [], seed: 1, addRoom: null, propsOpen: false, propHist: {}, propN: {}, propK: {} };
const isMobile = () => window.matchMedia('(max-width: 800px)').matches;
let tape = null; // cinta mètrica (es crea amb l'escena)
let installPrompt = null; // event d'instal·lació de la PWA (Chrome/Edge/Android)
const history = { past: [], future: [] };

let cloudBase = null; // últim estat confirmat al núvol (per fusionar canvis simultanis)
// Comptador d'escriptures i lectures d'avui (només d'aquest dispositiu), per vigilar el pla gratuït.
const CLOUD_KEY = 'planta3d-cloud';
const today = () => new Date().toISOString().slice(0, 10);
let cloudStats = { day: today(), writes: 0, reads: 0 };
try { const c = JSON.parse(localStorage.getItem(CLOUD_KEY) || 'null'); if (c && c.day === today()) cloudStats = c; } catch (e) { /* res */ }
function cloudCount(k) {
  if (cloudStats.day !== today()) cloudStats = { day: today(), writes: 0, reads: 0 };
  cloudStats[k]++;
  try { localStorage.setItem(CLOUD_KEY, JSON.stringify(cloudStats)); } catch (e) { /* res */ }
}
// Qui soc (per a les notes, els vots i l'historial): el nom del compte de Google, o el principi del correu.
function whoAmI() {
  const u = currentUser?.();
  const n = (u?.displayName || '').trim().split(/\s+/)[0] || (u?.email || currentUserEmail() || '').split('@')[0];
  return n ? n[0].toUpperCase() + n.slice(1) : 'Jo';
}
const changeLog = initLog(); // historial de canvis («qui ha canviat què»)
changeLog.reset(state);
function save(remote = true) {
  try {
    changeLog.record(state, whoAmI(), (id) => state.rooms.find((r) => r.id === id)?.name || '—');
    const gl = document.getElementById('g-log'); if (gl) gl.innerHTML = logHtml(state, esc, ui.logAll ? 200 : 25);
  } catch (e) { console.warn('historial', e); }
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* ignorar */ }
  if (remote) saveRemote(() => state, setSync);
}
function setSync(st, json) {
  if (st === 'guardado' && json) { cloudBase = JSON.parse(json); cloudCount('writes'); }
  const el = document.getElementById('sync');
  if (!el) return;
  el.textContent = st === 'guardado' ? 'Desat al núvol' : st === 'pendiente' ? 'Desant…' : st.startsWith('error') ? 'Error en desar' : st;
  el.title = st;
  el.className = st.startsWith('error') ? 'sync bad' : 'sync';
  const btn = document.getElementById('sync-btn');
  if (btn) { btn.dataset.st = st.startsWith('error') ? 'bad' : st === 'pendiente' ? 'pending' : 'ok'; btn.title = el.textContent + ' · toca per sincronitzar'; }
}
function pushHistory(json) {
  history.past.push(json);
  while (history.past.length > cfgGet('histMax')) history.past.shift();
  history.future = [];
}
const commit = () => pushHistory(JSON.stringify(state));
function undo() {
  if (!history.past.length) return;
  history.future.push(JSON.stringify(state));
  state = JSON.parse(history.past.pop());
  afterStateReplace();
}
function redo() {
  if (!history.future.length) return;
  history.past.push(JSON.stringify(state));
  state = JSON.parse(history.future.pop());
  afterStateReplace();
}
function afterStateReplace(remote = true) {
  if (ui.selected && !state.items.find((i) => i.id === ui.selected)) ui.selected = null;
  save(remote); rebuildPlan(); rebuildItems(); renderAll();
}

// Vibració curta (si està activada a la configuració). Només quan l'usuari ja ha tocat la pàgina: si no, el navegador la bloqueja i omple la consola d'avisos.
function vib(pattern) {
  if (!+prefs.vib || !navigator.vibrate || navigator.userActivation?.hasBeenActive === false) return;
  try { navigator.vibrate(pattern); } catch (e) { /* no disponible */ }
}

// Longituds segons les unitats triades a la configuració (cm o m).
function fmtLen(cm, unit = +prefs.unitLabel) {
  if (prefs.units === 'm') return (cm / 100).toLocaleString('ca', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + (unit ? ' m' : '');
  return Math.round(cm) + (unit ? ' cm' : '');
}
const roomById = (id) => state.rooms.find((r) => r.id === id);
const itemById = (id) => state.items.find((i) => i.id === id);
const STRUCT = new Set(['void', 'pillar', 'beam']);
const usableRooms = () => state.rooms.filter((r) => !STRUCT.has(r.kind));

// ---------------------------------------------------------------- three.js
const wrap = document.getElementById('canvas-wrap');
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, cfgGet('pixelRatio')));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
wrap.appendChild(renderer.domElement);
// Només es redibuixa quan canvia alguna cosa (estalvia bateria i CPU).
let needsRender = true;
function requestRender() { needsRender = true; }

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe9e6e0);

const persp = new THREE.PerspectiveCamera(45, 1, 5, 20000);
const ortho = new THREE.OrthographicCamera(-500, 500, 500, -500, -5000, 5000);
let camera = persp;

const controls3d = new OrbitControls(persp, renderer.domElement);
controls3d.enableDamping = true;
controls3d.maxPolarAngle = Math.PI * 0.49;
const controlsTop = new OrbitControls(ortho, renderer.domElement);
controlsTop.enableRotate = false;
controlsTop.screenSpacePanning = true;
controlsTop.enabled = false;
let controls = controls3d;

scene.add(new THREE.HemisphereLight(0xfff6ea, 0xb0a898, 2.6));
const sun = new THREE.DirectionalLight(0xfff1dc, 1.6);
sun.castShadow = true;
{ const sh = state.cfg?.shadow ? cfgGet('shadow') : (window.matchMedia('(max-width: 800px)').matches ? 2048 : 4096); sun.shadow.mapSize.set(sh, sh); }
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 1.5;
scene.add(sun, sun.target);
const fill = new THREE.DirectionalLight(0xdfe9ff, 0.5); // llum de farciment freda des de l'altre costat
scene.add(fill, fill.target);

const planGroup = new THREE.Group();
const itemsGroup = new THREE.Group();
const overlayGroup = new THREE.Group();
scene.add(planGroup, itemsGroup, overlayGroup);

const ground = new THREE.Mesh(new THREE.PlaneGeometry(40000, 40000), new THREE.MeshStandardMaterial({ color: 0xdcd8d0, roughness: 1 }));
ground.rotation.x = -Math.PI / 2;
ground.position.y = -1;
ground.receiveShadow = true;
scene.add(ground);

function planBounds() {
  const rs = state.rooms.length ? state.rooms : [{ x: 0, z: 0, w: 400, d: 400 }];
  const x0 = Math.min(...rs.map((r) => r.x)), x1 = Math.max(...rs.map((r) => r.x + r.w));
  const z0 = Math.min(...rs.map((r) => r.z)), z1 = Math.max(...rs.map((r) => r.z + r.d));
  return { x0, x1, z0, z1, cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, size: Math.max(x1 - x0, z1 - z0) };
}

function resize() {
  const w = wrap.clientWidth, h = wrap.clientHeight;
  renderer.setSize(w, h);
  persp.aspect = w / h;
  persp.updateProjectionMatrix();
  walkCam.aspect = w / h;
  applyWalkFov();
  fitOrtho();
  requestRender();
}

function fitOrtho(target) {
  const b = planBounds();
  const w = wrap.clientWidth || 1, h = wrap.clientHeight || 1;
  const span = (target?.span || b.size) * 0.62;
  const aspect = w / h;
  const hh = aspect > 1 ? span : span / aspect;
  ortho.left = -hh * aspect; ortho.right = hh * aspect; ortho.top = hh; ortho.bottom = -hh;
  ortho.updateProjectionMatrix();
}

// Càmera: desar i recuperar la vista actual (per a les vistes desades de la configuració).
function getCamera() {
  return { view: ui.view === 'walk' ? '3d' : ui.view, pos: persp.position.toArray(), target: controls3d.target.toArray(), tpos: ortho.position.toArray(), ttarget: controlsTop.target.toArray(), zoom: ortho.zoom };
}
function applyCamera(c) {
  if (!c || !c.pos) return false;
  persp.position.fromArray(c.pos); controls3d.target.fromArray(c.target); controls3d.update();
  if (c.tpos) { ortho.position.fromArray(c.tpos); controlsTop.target.fromArray(c.ttarget); ortho.zoom = c.zoom || 1; ortho.updateProjectionMatrix(); controlsTop.update(); }
  if (c.view && c.view !== ui.view && ui.view !== 'walk') setView(c.view);
  requestRender();
  return true;
}
function frameCamera(room) {
  const saved = prefs.cams?.[room ? room.id : '_all'];
  if (saved && applyCamera(saved)) return;
  const b = planBounds();
  const cx = room ? room.x + room.w / 2 : b.cx;
  const cz = room ? room.z + room.d / 2 : b.cz;
  // En vertical (mòbil) la càmera s'allunya una mica més perquè tot el plànol càpiga a l'amplada de la pantalla.
  const asp = (wrap.clientWidth || 1) / (wrap.clientHeight || 1);
  const size = (room ? Math.max(room.w, room.d) * 1.6 + 200 : b.size) * (asp < 1 ? Math.min(1.7, 1 / asp) : 1);
  controls3d.target.set(cx, 0, cz);
  persp.position.set(cx + size * 0.35, size * 0.95, cz + size * 0.85);
  controls3d.update();
  controlsTop.target.set(cx, 0, cz);
  ortho.position.set(cx, 2000, cz + 0.01);
  ortho.zoom = room ? Math.min(4, b.size / size) : 1;
  ortho.updateProjectionMatrix();
  controlsTop.update();
  sun.position.set(b.cx - 600, 1400, b.cz - 300);
  sun.target.position.set(b.cx, 0, b.cz);
  fill.position.set(b.cx + 900, 700, b.cz + 600);
  fill.target.position.set(b.cx, 0, b.cz);
  const s = b.size * 0.8;
  Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 10, far: 4000 });
  sun.shadow.camera.updateProjectionMatrix();
  requestRender();
}

// ---- Passeig en primera persona
const walkCam = new THREE.PerspectiveCamera(70, 1, 2, 10000);
let fovSaved = 80;
try { fovSaved = +localStorage.getItem('planta3d-fov') || 70; } catch (e) { /* res */ }
const walk = { x: 0, z: 0, yaw: 0, pitch: 0, keys: new Set(), gyro: false, q: null, last: 0, fov: fovSaved };
// Zoom del passeig: pessigar al mòbil o roda / Ctrl + i − al PC canvia l'angle de visió (més gran = més camp, "zoom negatiu").
function setWalkFov(f) {
  walk.fov = Math.max(35, Math.min(120, Math.round(f)));
  applyWalkFov();
  try { localStorage.setItem('planta3d-fov', String(walk.fov)); } catch (e) { /* res */ }
  requestRender();
}
// En vertical (mòbil) el valor és l'angle horitzontal, perquè es vegi la mateixa amplada d'habitació que al PC.
function applyWalkFov() {
  const a = walkCam.aspect || 1, f = walk.fov;
  walkCam.fov = a < 1 ? Math.min(118, 2 * Math.atan(Math.tan(f * DEG / 2) / a) / DEG) : f;
  walkCam.updateProjectionMatrix();
}
// Porta d'entrada: una porta que dona a fora del pis (cap habitació a l'altre costat). Es prefereix la del menjador.
function entranceDoor() {
  const found = [];
  for (const r of state.rooms) {
    if (STRUCT.has(r.kind) || r.kind === 'terrace') continue;
    for (const op of r.openings || []) {
      if (op.type !== 'puerta') continue;
      const sw = doorSwing(r, op);
      if (!sw) continue;
      const cx = sw.hx + sw.wx * sw.r / 2, cz = sw.hz + sw.wz * sw.r / 2; // centre de l'obertura
      const out = roomAt(state.rooms, cx - sw.ix * 25, cz - sw.iz * 25);
      if (!out || out.kind === 'void') found.push({ x: cx, z: cz, ix: sw.ix, iz: sw.iz, room: r });
    }
  }
  return found.find((f) => f.room.id === 'salon' || /menjador/i.test(f.room.name)) || found[0] || null;
}
const noControls = { update: () => false, enabled: false };
const HINTS = {
  walk: 'Toca el terra per anar-hi · arrossega per mirar · fletxes / WASD o el joystick per caminar · toca portes, finestres i mobles · el mapa et porta on toquis',
  tape: 'Cinta mètrica: toca dos punts per mesurar (s’enganxa a les cantonades) · Supr desfà l’última · Esc per sortir',
  edit: 'Arrossega un moble per moure’l · Maj o Ctrl + clic per triar-ne uns quants · R / Maj+R girar · Supr esborrar · Ctrl+D duplicar',
};
function setHint() { const h = document.getElementById('hint'); if (h) h.textContent = HINTS[ui.view === 'walk' ? 'walk' : tape?.active ? 'tape' : 'edit']; }
function setView(v) {
  const was = ui.view;
  ui.view = v;
  camera = v === 'top' ? ortho : v === 'walk' ? walkCam : persp;
  controls3d.enabled = v === '3d';
  controlsTop.enabled = v === 'top';
  controls = v === 'top' ? controlsTop : v === 'walk' ? noControls : controls3d;
  document.querySelectorAll('[data-view]').forEach((b) => b.classList.toggle('active', b.dataset.view === v));
  const fv = document.querySelector('#tb-fab .v'); if (fv) fv.textContent = { '3d': '3D', top: '2D', walk: '🚶' }[v];
  document.getElementById('walkbar').hidden = v !== 'walk';
  if (v === 'walk' && tape?.active) setTape(false);
  setHint();
  if (v === 'walk' && was !== 'walk') {
    select(null);
    const ent = entranceDoor();
    if (ent) {
      // a la porta d'entrada, un pas cap a dins, mirant cap a l'habitació
      walk.x = ent.x + ent.ix * 70; walk.z = ent.z + ent.iz * 70;
      const r = ent.room, dx = r.x + r.w / 2 - walk.x, dz = r.z + r.d / 2 - walk.z; // mirant cap al centre de l'habitació
      walk.yaw = Math.hypot(dx, dz) > 30 ? Math.atan2(-dx, -dz) : Math.atan2(-ent.ix, -ent.iz);
    } else {
      const r = api.currentRoom() || usableRooms()[0];
      if (r) { walk.x = r.x + r.w / 2; walk.z = r.z + r.d / 2; }
      walk.yaw = Math.PI;
    }
    walk.pitch = 0; walk.last = performance.now(); walk.target = null;
    setWalkFov(walk.fov);
    const wr = document.getElementById('wk-room'); if (wr) wr.innerHTML = '<option value="">Ves a…</option>' + usableRooms().map((r) => `<option value="${r.id}">${esc(r.name)}</option>`).join('');
    requestAnimationFrame(drawMinimap);
  }
  if (v !== 'walk') { stopGyro(); pointers.clear(); }
  rebuildPlan();
  requestRender();
}
// Parets per on no es pot passar al passeig: les vores de cada habitació, terrassa i pilar, menys les portes, els passos i els finestrals.
let walkWallsCache = null;
function walkWalls() {
  if (walkWallsCache) return walkWallsCache;
  const pass = allOpenings(state.rooms).filter((o) => ['puerta', 'paso', 'ventanal'].includes(o.type));
  const segs = [];
  for (const r of state.rooms) {
    if (!['room', 'terrace', 'pillar'].includes(r.kind || 'room')) continue;
    const edges = [{ axis: 'x', line: r.z, a: r.x, b: r.x + r.w }, { axis: 'x', line: r.z + r.d, a: r.x, b: r.x + r.w }, { axis: 'z', line: r.x, a: r.z, b: r.z + r.d }, { axis: 'z', line: r.x + r.w, a: r.z, b: r.z + r.d }];
    for (const e of edges) {
      const cuts = r.kind === 'pillar' ? [] : pass.filter((o) => o.axis === e.axis && Math.abs(o.line - e.line) <= 1).map((o) => [o.a, o.b]);
      for (const [a, b] of subtractIntervals(e.a, e.b, cuts)) segs.push({ ...e, a, b });
    }
  }
  return (walkWallsCache = segs);
}
function wallGap(x, z) {
  let m = Infinity;
  for (const g of walkWalls()) {
    const [u, v] = g.axis === 'x' ? [x, z] : [z, x];
    const du = u < g.a ? g.a - u : u > g.b ? u - g.b : 0;
    m = Math.min(m, Math.hypot(du, v - g.line));
  }
  return m;
}
// Mou el visitant si no travessa cap paret (o si se n'allunya); si topa, prova de lliscar al llarg de la paret.
function walkTry(nx, nz) {
  const R = 22, here = wallGap(walk.x, walk.z);
  const ok = (x, z) => { const g = wallGap(x, z); return g >= R || g >= here - 0.01; };
  if (ok(nx, nz)) { walk.x = nx; walk.z = nz; return true; }
  if (ok(nx, walk.z)) { walk.x = nx; return true; }
  if (ok(walk.x, nz)) { walk.z = nz; return true; }
  return false;
}
let doorSpots = [];
function walkStep(now) {
  const dt = Math.min(0.1, (now - walk.last) / 1000); walk.last = now;
  let f = 0, s = 0;
  const k = walk.keys;
  if (k.has('f')) f += 1; if (k.has('b')) f -= 1; if (k.has('l')) s -= 1; if (k.has('r')) s += 1;
  if (walk.joy) { f += walk.joy.f; s += walk.joy.s; }
  let moved = false;
  const v = cfgGet('walkSpeed') * dt; // cm per segon
  if (f || s) {
    walk.target = null;
    const dirx = -Math.sin(walk.yaw), dirz = -Math.cos(walk.yaw); // cap on mira (yaw 0 = -z)
    const n = Math.max(1, Math.hypot(f, s));
    walkTry(walk.x + (dirx * f + -dirz * s) * v / n, walk.z + (dirz * f + dirx * s) * v / n);
    moved = true;
  } else if (walk.target) {
    // camina sol fins al punt tocat, girant-se de mica en mica cap allà
    const dx = walk.target.x - walk.x, dz = walk.target.z - walk.z, dist = Math.hypot(dx, dz);
    if (dist < 12) walk.target = null;
    else {
      const want = Math.atan2(-dx, -dz);
      let dy = want - walk.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      if (!walk.q) walk.yaw += dy * Math.min(1, dt * 5);
      const st = Math.min(dist, v * 1.2);
      if (!walkTry(walk.x + dx / dist * st, walk.z + dz / dist * st)) walk.target = null;
    }
    moved = true;
  }
  if (moved) {
    const b = planBounds();
    walk.x = Math.min(b.x1 - 10, Math.max(b.x0 + 10, walk.x)); walk.z = Math.min(b.z1 - 10, Math.max(b.z0 + 10, walk.z));
    // les portes tancades s'obren soles quan t'hi acostes
    for (const d of doorSpots) if (Math.hypot(d.x - walk.x, d.z - walk.z) < 95 && (doors[d.key] ?? 1) < 0.5 && !doorAnims.has(d.key)) toggleDoor(d.key);
    drawMinimap();
  }
  walkCam.position.set(walk.x, cfgGet('eyeHeight'), walk.z);
  if (walk.q) walkCam.quaternion.copy(walk.q);
  else walkCam.rotation.set(walk.pitch, walk.yaw, 0, 'YXZ');
  return moved;
}
// Salta a una habitació: al centre, mirant cap a la paret més llunyana.
function walkToRoom(r) {
  if (!r) return;
  walk.x = r.x + r.w / 2; walk.z = r.z + r.d / 2; walk.target = null;
  walk.yaw = r.w > r.d ? Math.PI / 2 : 0; walk.pitch = 0;
  requestRender(); drawMinimap();
}
// Minimapa del passeig: plànol vist des de dalt amb on ets i cap on mires; tocar-lo et porta a aquell punt.
const minimap = { cv: null, s: 1, ox: 0, oz: 0 };
function drawMinimap() {
  const cv = minimap.cv || (minimap.cv = document.getElementById('wk-map'));
  if (!cv || cv.hidden || ui.view !== 'walk') return;
  const ctx = cv.getContext('2d'), W = cv.width, H = cv.height, b = planBounds(), pad = 8;
  const sc = Math.min((W - 2 * pad) / (b.x1 - b.x0), (H - 2 * pad) / (b.z1 - b.z0));
  Object.assign(minimap, { s: sc, ox: pad + ((W - 2 * pad) - (b.x1 - b.x0) * sc) / 2 - b.x0 * sc, oz: pad + ((H - 2 * pad) - (b.z1 - b.z0) * sc) / 2 - b.z0 * sc });
  const X = (x) => minimap.ox + x * sc, Z = (z) => minimap.oz + z * sc;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(20,19,18,.78)'; ctx.beginPath(); ctx.roundRect(0, 0, W, H, 12); ctx.fill();
  for (const r of state.rooms) {
    if (r.kind === 'void' || r.kind === 'beam') continue;
    ctx.fillStyle = r.kind === 'pillar' ? '#777' : r.kind === 'terrace' ? 'rgba(217,134,77,.35)' : 'rgba(240,236,228,.22)';
    ctx.fillRect(X(r.x), Z(r.z), r.w * sc, r.d * sc);
  }
  ctx.strokeStyle = '#f3efe8'; ctx.lineWidth = 1.6; ctx.beginPath();
  for (const g of walkWalls()) { if (g.axis === 'x') { ctx.moveTo(X(g.a), Z(g.line)); ctx.lineTo(X(g.b), Z(g.line)); } else { ctx.moveTo(X(g.line), Z(g.a)); ctx.lineTo(X(g.line), Z(g.b)); } }
  ctx.stroke();
  ctx.fillStyle = 'rgba(160,150,140,.75)';
  for (const it of state.items) { if (it.type === 'alfombra') continue; const a = aabb(it); ctx.fillRect(X(a.x0), Z(a.z0), (a.x1 - a.x0) * sc, (a.z1 - a.z0) * sc); }
  if (walk.target) { ctx.fillStyle = '#ffd04a'; ctx.beginPath(); ctx.arc(X(walk.target.x), Z(walk.target.z), 3, 0, 7); ctx.fill(); }
  // tu: punt i con de visió
  const px = X(walk.x), pz = Z(walk.z), yaw = walk.q ? new THREE.Euler().setFromQuaternion(walk.q, 'YXZ').y : walk.yaw;
  const dx = -Math.sin(yaw), dz = -Math.cos(yaw), half = (walkCam.fov * (walkCam.aspect || 1)) * DEG / 2, L = 26;
  ctx.fillStyle = 'rgba(217,134,77,.38)'; ctx.beginPath(); ctx.moveTo(px, pz);
  for (const a of [-half, half]) { const c = Math.cos(a), sn = Math.sin(a); ctx.lineTo(px + (dx * c - dz * sn) * L, pz + (dz * c + dx * sn) * L); }
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#d9864d'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(px, pz, 5, 0, 7); ctx.fill(); ctx.stroke();
}
// Giroscopi: orientació del dispositiu → càmera (cal permís a l'iPhone).
let gyroHandler = null;
async function toggleGyro() {
  if (walk.gyro) { stopGyro(); return; }
  try {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      const r = await DeviceOrientationEvent.requestPermission();
      if (r !== 'granted') throw new Error('denied');
    }
  } catch (e) { alert('No s’ha pogut activar el giroscopi. A l’iPhone cal acceptar el permís de moviment.'); return; }
  const zee = new THREE.Vector3(0, 0, 1), euler = new THREE.Euler(), q0 = new THREE.Quaternion(), q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));
  gyroHandler = (e) => {
    if (e.alpha === null || e.alpha === undefined) return;
    const alpha = e.alpha * DEG, beta = e.beta * DEG, gamma = e.gamma * DEG;
    const orient = ((screen.orientation && screen.orientation.angle) || window.orientation || 0) * DEG;
    euler.set(beta, alpha, -gamma, 'YXZ');
    const q = new THREE.Quaternion().setFromEuler(euler).multiply(q1).multiply(q0.setFromAxisAngle(zee, -orient));
    walk.q = q; requestRender();
  };
  window.addEventListener('deviceorientation', gyroHandler);
  walk.gyro = true;
  document.getElementById('wk-gyro').classList.add('on');
}
function stopGyro() {
  if (gyroHandler) window.removeEventListener('deviceorientation', gyroHandler);
  gyroHandler = null; walk.gyro = false; walk.q = null;
  document.getElementById('wk-gyro')?.classList.remove('on');
}

// ---------------------------------------------------------------- plano 3D
// Textures procedimentals (sense fitxers): parquet, rajoles i estuc de paret.
const texCache = new Map();
function hashNoise(x, y, s = 1) { const v = Math.sin(x * 12.9898 + y * 78.233 + s * 37.719) * 43758.5453; return v - Math.floor(v); }
function makeTexture(kind) {
  if (texCache.has(kind)) return texCache.get(kind);
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const ctx = c.getContext('2d');
  let period = 120; // cm que representa el canvas
  if (kind === 'parquet') {
    // Llistons de 15 × 60 cm, encavalcats a la meitat; el to el posa el color de l'habitació.
    const pw = 512 / 8, ph = 512 / 2;
    ctx.fillStyle = '#d2d2d2'; ctx.fillRect(0, 0, 512, 512);
    for (let row = 0; row < 8; row++) {
      const off = (row % 2) * ph / 2;
      for (let k = -1; k < 3; k++) {
        const y = row * pw, x = k * ph + off;
        const l = 0.78 + hashNoise(row, k) * 0.3;
        ctx.fillStyle = `rgb(${Math.round(210 * l)},${Math.round(205 * l)},${Math.round(198 * l)})`;
        ctx.fillRect(x, y, ph, pw);
        // veta
        ctx.strokeStyle = 'rgba(80,50,20,0.10)'; ctx.lineWidth = 1.2;
        for (let g = 0; g < 5; g++) {
          ctx.beginPath();
          const gy = y + 6 + hashNoise(row, k + g * 7) * (pw - 12);
          ctx.moveTo(x, gy); ctx.bezierCurveTo(x + ph * 0.3, gy + (hashNoise(g, row) - 0.5) * 8, x + ph * 0.7, gy + (hashNoise(k, g) - 0.5) * 8, x + ph, gy);
          ctx.stroke();
        }
        ctx.strokeStyle = 'rgba(40,25,10,0.35)'; ctx.lineWidth = 2;
        ctx.strokeRect(x + 1, y + 1, ph - 2, pw - 2);
      }
    }
  } else if (kind === 'rajola') {
    // Rajoles de 30 × 30 cm amb junta clara.
    period = 60;
    const n = 2, s = 512 / n;
    ctx.fillStyle = '#b9b9b9'; ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const l = 0.93 + hashNoise(i, j, 3) * 0.1;
      ctx.fillStyle = `rgb(${Math.round(215 * l)},${Math.round(215 * l)},${Math.round(213 * l)})`;
      ctx.fillRect(i * s + 3, j * s + 3, s - 6, s - 6);
      for (let q = 0; q < 300; q++) {
        ctx.fillStyle = `rgba(0,0,0,${0.02 + hashNoise(q, i + j * 7) * 0.04})`;
        ctx.fillRect(i * s + 3 + hashNoise(q, i, 5) * (s - 6), j * s + 3 + hashNoise(q, j, 9) * (s - 6), 2, 2);
      }
    }
  } else if (kind === 'estuc') {
    period = 100;
    ctx.fillStyle = '#e4e4e4'; ctx.fillRect(0, 0, 512, 512);
    for (let q = 0; q < 9000; q++) {
      ctx.fillStyle = `rgba(${hashNoise(q, 1) < 0.5 ? '255,255,255' : '0,0,0'},${0.03 + hashNoise(q, 2) * 0.05})`;
      ctx.fillRect(hashNoise(q, 3) * 512, hashNoise(q, 4) * 512, 1 + hashNoise(q, 5) * 3, 1 + hashNoise(q, 6) * 3);
    }
  } else {
    ctx.fillStyle = '#d8d8d8'; ctx.fillRect(0, 0, 512, 512);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.userData.period = period;
  texCache.set(kind, tex);
  return tex;
}
// Tipus de terra d'una habitació: el que tingui desat o, si no, segons el tipus/nom.
function floorKind(r) {
  if (r.floor) return r.floor;
  if (r.kind === 'terrace') return 'rajola';
  if (/bany|bano|cuina|cocina|safareig/i.test(r.id + ' ' + r.name)) return 'rajola';
  return 'parquet';
}
const floorMatCache = new Map();
function floorMaterial(r, worldUV = false) {
  const kind = floorKind(r);
  const key = [kind, r.color, worldUV ? 'w' : r.w + 'x' + r.d].join('|');
  if (floorMatCache.has(key)) return floorMatCache.get(key);
  const base = makeTexture(kind);
  const tex = base.clone();
  const p = base.userData.period;
  if (worldUV) tex.repeat.set(1 / p, 1 / p); else tex.repeat.set(r.w / p, r.d / p);
  tex.needsUpdate = true;
  // El color de l'habitació tenyeix la textura (que és clara i grisa).
  const col = new THREE.Color(r.color || '#c89b6a').multiplyScalar(kind === 'parquet' ? 1.25 : 1.1);
  const m = new THREE.MeshStandardMaterial({ color: col, map: tex, roughness: kind === 'rajola' ? 0.45 : 0.7, metalness: 0 });
  if (floorMatCache.size > 200) floorMatCache.clear();
  floorMatCache.set(key, m);
  return m;
}
const wallTex = makeTexture('estuc');
wallTex.repeat.set(2, 2);
const wallMat = new THREE.MeshStandardMaterial({ color: 0xf3f1ec, roughness: 0.92, map: wallTex });
const wallTopMat = new THREE.MeshStandardMaterial({ color: 0x2b2926, roughness: 0.9 });
const glassMat = new THREE.MeshStandardMaterial({ color: 0x8fbfdc, transparent: true, opacity: 0.55, roughness: 0.1 });
const windowMat = new THREE.MeshStandardMaterial({ color: 0x6fb1d6, roughness: 0.6 });
const railMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, metalness: 0.5, roughness: 0.4 });
const voidMat = new THREE.MeshStandardMaterial({ color: 0x5b6066, roughness: 0.8 });
const beamMarkMat = new THREE.MeshStandardMaterial({ color: 0x4a4540, roughness: 0.9, transparent: true, opacity: 0.45 });
const swingMat = new THREE.LineBasicMaterial({ color: 0x8a6a4a });
// Portes: 1 = oberta, 0 = tancada (per defecte obertes, com al plànol). En tocar-ne una, s'obre o es tanca amb animació.
const doors = {};
const doorAnims = new Map();
function doorAngle(d, t) {
  let delta = d.open - d.closed;
  while (delta > Math.PI) delta -= 2 * Math.PI;
  while (delta < -Math.PI) delta += 2 * Math.PI;
  return d.closed + delta * t;
}
function toggleDoor(key) {
  const def = key.includes('|w') ? 0 : 1; // finestres (clau "…|wN") tancades per defecte
  const to = (doors[key] ?? def) > 0.5 ? 0 : 1;
  doorAnims.set(key, { from: doors[key] ?? def, to, t0: performance.now() });
  vib(8);
  requestRender();
}
function stepDoors(now) {
  if (!doorAnims.size) return false;
  for (const [key, a] of doorAnims) {
    const k = Math.min(1, (now - a.t0) / 650);
    const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    doors[key] = a.from + (a.to - a.from) * e;
    if (k >= 1) doorAnims.delete(key);
  }
  planGroup.traverse((o) => { if (o.userData.door && o.userData.door.key !== undefined && doors[o.userData.door.key] !== undefined) o.rotation.y = doorAngle(o.userData.door, doors[o.userData.door.key]); });
  return true;
}
const doorMat = new THREE.MeshStandardMaterial({ color: 0xa98562, roughness: 0.7 });
const frameMat = new THREE.MeshStandardMaterial({ color: 0xf4f4f0, roughness: 0.6 });
// Fulles de finestra: penjades d'una frontissa a cada extrem, giren cap a dins de l'habitació en tocar-les (clau "habitació|wN").
function windowLeaves(r, o, e, a, b, y0, y1, n) {
  const idx = (r.openings || []).indexOf(o);
  const key = r.id + '|w' + (idx < 0 ? Math.round(a) : idx);
  const inward = e.axis === 'x' ? (e.line === r.z ? 1 : -1) : (e.line === r.x ? 1 : -1);
  const ix = e.axis === 'x' ? 0 : inward, iz = e.axis === 'x' ? inward : 0;
  const h = y1 - y0, lw = (b - a) / n;
  for (let k = 0; k < n; k++) {
    // frontissa a l'extrem exterior de cada fulla; la fulla s'estén cap al centre de l'obertura
    const hinge = n === 1 ? a : k === 0 ? a : b;
    const dir = n === 1 ? 1 : k === 0 ? 1 : -1;
    const wx = e.axis === 'x' ? dir : 0, wz = e.axis === 'x' ? 0 : dir;
    const pivot = new THREE.Group();
    if (e.axis === 'x') pivot.position.set(hinge, y0, e.line); else pivot.position.set(e.line, y0, hinge);
    const leaf = new THREE.Group();
    const glass = new THREE.Mesh(new THREE.BoxGeometry(Math.max(4, lw - 6), Math.max(4, h - 6), 1.5), glassMat);
    glass.position.set(lw / 2, h / 2, 0);
    leaf.add(glass);
    const bars = [[lw, 3, lw / 2, 1.5], [lw, 3, lw / 2, h - 1.5], [3, h, 1.5, h / 2], [3, h, lw - 1.5, h / 2]];
    for (const [bw, bh, cx, cy] of bars) { const m = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 3), frameMat); m.position.set(cx, cy, 0); leaf.add(m); }
    leaf.traverse((m) => { m.userData.door = key; });
    pivot.add(leaf);
    pivot.userData.door = { key: key, closed: Math.atan2(-wz, wx), open: Math.atan2(-(iz * 0.94 + wz * 0.34), ix * 0.94 + wx * 0.34), k };
    pivot.rotation.y = doorAngle(pivot.userData.door, doors[key] ?? 0);
    planGroup.add(pivot);
  }
}

function disposeGroup(g) {
  g.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material && !Array.isArray(o.material) && o.material.userData.own) { o.material.map?.dispose(); o.material.dispose(); } // només els materials propis (etiquetes); els compartits (parets, terra) es queden
  });
  g.clear();
}

function wallHeight() {
  const H = state.ceiling || 250;
  if (ui.view === 'top') return Math.min(H, 120);
  if (ui.view === 'walk') return H;
  return ui.wallMode === 'full' ? H : ui.wallMode === 'low' ? Math.min(H, cfgGet('lowWall')) : 12;
}

// Peça de paret al llarg d'un eix entre a i b.
// Amb inSide (+1 / −1: cap a on queda l'habitació) es dibuixa només la meitat del gruix que dona a l'habitació, amb la cara de dins
// pintada del color triat; l'altra meitat la posa l'habitació veïna (amb el seu color) o, si a fora no hi ha cap habitació, aquí mateix.
// Així cada costat d'una paret compartida es pot pintar diferent sense que les cares es barregin.
function wallBox(axis, line, a, b, y0, y1, th, mats, extA, extB) {
  const len = b - a + extA + extB, h = y1 - y0;
  if (b - a <= 0.5 || h <= 0.5) return;
  const geo = axis === 'x' ? new THREE.BoxGeometry(len, h, th) : new THREE.BoxGeometry(th, h, len);
  const m = new THREE.Mesh(geo, mats);
  const mid = (a - extA + b + extB) / 2;
  if (axis === 'x') m.position.set(mid, y0 + h / 2, line);
  else m.position.set(line, y0 + h / 2, mid);
  m.castShadow = true;
  m.receiveShadow = true;
  if (tagEdge) m.userData.wall = tagEdge;
  planGroup.add(m);
}
function wallPiece(axis, line, a, b, y0, y1, t, material, cap = true, inSide = 0, paint = null) {
  const top = cap ? wallTopMat : material;
  if (!inSide) { wallBox(axis, line, a, b, y0, y1, t, cap ? [material, material, top, material, material, material] : material, t / 2, t / 2); return; }
  // cara de dins: índex 4/5 (+z/−z) per a parets al llarg de x, 0/1 (+x/−x) per a les de z
  const inner = [material, material, top, material, material, material];
  inner[axis === 'x' ? (inSide > 0 ? 4 : 5) : (inSide > 0 ? 0 : 1)] = paint || material;
  if (paint && cap) inner[2] = paintTop(paint); // la part de dalt també, perquè la paret pintada es vegi en planta i amb les parets baixes
  wallBox(axis, axis === 'x' ? line + inSide * t / 4 : line + inSide * t / 4, a, b, y0, y1, t / 2, inner, t / 2, t / 2);
  // meitat de fora, només on a l'altre costat no hi ha cap habitació que la dibuixi
  const covered = [];
  for (const r2 of state.rooms) {
    if (r2.kind !== 'room') continue;
    const edge = axis === 'x' ? (inSide > 0 ? r2.z + r2.d : r2.z) : (inSide > 0 ? r2.x + r2.w : r2.x);
    if (Math.abs(edge - line) > 1) continue;
    const lo = axis === 'x' ? r2.x : r2.z, hi = axis === 'x' ? r2.x + r2.w : r2.z + r2.d;
    if (hi > a && lo < b) covered.push([lo, hi]);
  }
  const outer = [material, material, top, material, material, material];
  for (const [s0, s1] of subtractIntervals(a, b, covered)) wallBox(axis, line - inSide * t / 4, s0, s1, y0, y1, t / 2, outer, s0 === a ? t / 2 : 0, s1 === b ? t / 2 : 0);
}
let tagEdge = null; // paret que s'està construint (habitació, eix, extrems)
// Materials de les parets pintades (un per color), amb la mateixa textura d'estuc.
const paintCache = new Map();
function paintMat(hex) {
  if (!hex) return null;
  if (!paintCache.has(hex)) { const m = wallMat.clone(); m.color.set(hex); paintCache.set(hex, m); }
  return paintCache.get(hex);
}
// Cantell de dalt d'una paret pintada: el mateix color, sense ombres (en planta es veu com una línia del color triat).
const paintTopCache = new Map();
function paintTop(pm) {
  const hex = '#' + pm.color.getHexString();
  if (!paintTopCache.has(hex)) paintTopCache.set(hex, new THREE.MeshBasicMaterial({ color: pm.color.clone() }));
  return paintTopCache.get(hex);
}
const WALL_KEY = { nord: 'N', sud: 'S', oest: 'W', est: 'E' };
const WALL_TXT = { N: 'de dalt', S: 'de baix', W: 'de l’esquerra', E: 'de la dreta' };

function subtractIntervals(a, b, cuts) {
  let segs = [[a, b]];
  for (const [c0, c1] of cuts) {
    const next = [];
    for (const [s0, s1] of segs) {
      if (c1 <= s0 || c0 >= s1) { next.push([s0, s1]); continue; }
      if (c0 > s0) next.push([s0, c0]);
      if (c1 < s1) next.push([c1, s1]);
    }
    segs = next;
  }
  return segs;
}

function makeLabel(lines, color = '#2b2926', bg = 'rgba(255,255,255,0.82)', maxW = 1e9, maxH = 1e9) {
  const c = document.createElement('canvas');
  const fs = 44;
  const ctx = c.getContext('2d');
  ctx.font = `600 ${fs}px system-ui, sans-serif`;
  const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 40;
  c.width = Math.ceil(w); c.height = lines.length * (fs + 12) + 24;
  ctx.font = `600 ${fs}px system-ui, sans-serif`;
  ctx.fillStyle = bg;
  ctx.beginPath(); ctx.roundRect(0, 0, c.width, c.height, 18); ctx.fill();
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  lines.forEach((l, i) => {
    ctx.fillStyle = i === 0 ? color : '#77716a';
    ctx.font = `${i === 0 ? 600 : 500} ${i === 0 ? fs : fs * 0.8}px system-ui, sans-serif`;
    ctx.fillText(l, c.width / 2, 14 + i * (fs + 12));
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const scale = Math.min(0.32 * cfgGet('labelScale') / 100, maxW / c.width, maxH / c.height);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(c.width * scale, c.height * scale), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  mesh.material.userData.own = true;
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = 2;
  return mesh;
}

function rebuildPlan() {
  requestRender();
  disposeGroup(planGroup);
  walkWallsCache = null; doorSpots = [];
  const t = state.wallThickness || 10;
  const H = wallHeight();
  const fullH = state.ceiling || 250;
  const openings = allOpenings(state.rooms);

  for (const r of state.rooms) {
    tagEdge = null;
    if (r.kind === 'pillar' || r.kind === 'beam') {
      // Pilar: bloc massís de terra a sostre. Biga: bloc penjat del sostre, des de l'alçada «h0» (per defecte 210) fins al sostre.
      const y0 = r.kind === 'beam' ? Math.min(fullH - 5, r.h0 || 210) : 0;
      const y1 = r.kind === 'beam' ? fullH : H;
      if (r.kind === 'beam' && H < y0) {
        // amb parets baixes o en planta la biga no es penja (quedaria un bloc flotant): es marca al terra com al plànol
        const m = new THREE.Mesh(new THREE.BoxGeometry(r.w, 0.8, r.d), beamMarkMat);
        m.position.set(r.x + r.w / 2, 0.4, r.z + r.d / 2);
        m.userData.wall = { room: r, axis: 'x', line: r.z, a: r.x, b: r.x + r.w, side: 'biga', key: 'N', inSide: -1, whole: true };
        planGroup.add(m);
      } else if (y1 > y0) {
        const pm = paintMat(r.walls?.N) || wallMat;
        const m = new THREE.Mesh(new THREE.BoxGeometry(r.w, y1 - y0, r.d), [pm, pm, r.kind === 'beam' ? pm : wallTopMat, pm, pm, pm]);
        m.position.set(r.x + r.w / 2, (y0 + y1) / 2, r.z + r.d / 2);
        m.castShadow = true; m.receiveShadow = true;
        m.userData.wall = { room: r, axis: 'x', line: r.z, a: r.x, b: r.x + r.w, side: r.kind === 'beam' ? 'biga' : 'pilar', key: 'N', inSide: -1, whole: true };
        planGroup.add(m);
      }
      continue;
    }
    if (r.kind === 'void') {
      const m = new THREE.Mesh(new THREE.BoxGeometry(r.w, H, r.d), voidMat);
      m.position.set(r.x + r.w / 2, H / 2, r.z + r.d / 2);
      m.castShadow = true;
      planGroup.add(m);
      if (ui.labels) {
        const l = makeLabel([r.name, `${fmtLen(r.w, 0)} × ${fmtLen(r.d)}`], '#ffffff', 'rgba(40,40,40,0.75)', r.w * 0.85, r.d * 0.6);
        l.position.set(r.x + r.w / 2, H + 1, r.z + r.d / 2);
        planGroup.add(l);
      }
      continue;
    }
    const sloped = r.kind === 'terrace' && r.d2 > 0 && r.d2 < r.d; // terraza con el borde norte en diagonal
    if (sloped) {
      // Polígono: (x, z) · (x+w, z+d-d2) · (x+w, z+d) · (x, z+d). ShapeGeometry va en XY: Y = -Z.
      const sh = new THREE.Shape();
      sh.moveTo(r.x, -r.z); sh.lineTo(r.x + r.w, -(r.z + r.d - r.d2)); sh.lineTo(r.x + r.w, -(r.z + r.d)); sh.lineTo(r.x, -(r.z + r.d)); sh.closePath();
      const floor = new THREE.Mesh(new THREE.ShapeGeometry(sh), floorMaterial(r, true));
      floor.rotation.x = -Math.PI / 2;
      floor.receiveShadow = true;
      floor.userData.roomId = r.id;
      planGroup.add(floor);
      // Barandilla: oeste, este (más corta), sur y la diagonal.
      const rail = (x1, z1, x2, z2) => {
        const len = Math.hypot(x2 - x1, z2 - z1), ang = Math.atan2(-(z2 - z1), x2 - x1);
        for (const [y0, h, th, mat] of [[95, 5, 5, railMat], [5, 90, 1.5, glassMat]]) {
          const m = new THREE.Mesh(new THREE.BoxGeometry(len + th, h, th), mat);
          m.position.set((x1 + x2) / 2, y0 + h / 2, (z1 + z2) / 2);
          m.rotation.y = ang;
          m.castShadow = mat === railMat;
          planGroup.add(m);
        }
      };
      rail(r.x, r.z, r.x + r.w, r.z + r.d - r.d2);
      rail(r.x, r.z, r.x, r.z + r.d);
      rail(r.x + r.w, r.z + r.d - r.d2, r.x + r.w, r.z + r.d);
      rail(r.x, r.z + r.d, r.x + r.w, r.z + r.d);
      if (ui.labels) {
        const l = makeLabel([r.name, `${fmtLen(r.w, 0)} × ${fmtLen(r.d, 0)} / ${fmtLen(r.d2, 1)}`, 'vora en diagonal'], r.estimated ? '#9a5d10' : '#2b2926', 'rgba(255,255,255,0.82)', r.w * 0.8, r.d * 0.6);
        l.position.set(r.x + r.w * 0.45, 0.6, r.z + r.d * 0.6);
        planGroup.add(l);
      }
      continue;
    }
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(r.w, r.d), floorMaterial(r));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(r.x + r.w / 2, 0, r.z + r.d / 2);
    floor.receiveShadow = true;
    floor.userData.roomId = r.id;
    planGroup.add(floor);

    const edges = [
      { axis: 'x', line: r.z, a: r.x, b: r.x + r.w },
      { axis: 'x', line: r.z + r.d, a: r.x, b: r.x + r.w },
      { axis: 'z', line: r.x, a: r.z, b: r.z + r.d },
      { axis: 'z', line: r.x + r.w, a: r.z, b: r.z + r.d },
    ];
    for (const e of edges) {
      const side = e.axis === 'x' ? (e.line === r.z ? 'nord' : 'sud') : (e.line === r.x ? 'oest' : 'est');
      const key = WALL_KEY[side], inSide = side === 'nord' || side === 'oest' ? 1 : -1, paint = paintMat(r.walls?.[key]);
      tagEdge = { room: r, axis: e.axis, line: e.line, a: e.a, b: e.b, side, key, inSide };
      const ops = openings.filter((o) => o.axis === e.axis && Math.abs(o.line - e.line) <= 1 && o.b > e.a && o.a < e.b);
      const cuts = ops.map((o) => [Math.max(o.a, e.a), Math.min(o.b, e.b)]);
      const solid = subtractIntervals(e.a, e.b, cuts);
      if (r.kind === 'terrace') {
        for (const [a, b] of solid) {
          wallPiece(e.axis, e.line, a, b, 95, 100, 5, railMat, false);
          wallPiece(e.axis, e.line, a, b, 5, 95, 1.5, glassMat, false);
        }
        continue;
      }
      // cada tros de paret entre portes, passos o finestres és un tros a part: en tocar-lo surt la seva mida, no la de la paret sencera
      const edgeTag = tagEdge;
      const piece = (a, b, over) => { tagEdge = { ...edgeTag, a, b, edgeA: e.a, edgeB: e.b, over }; };
      for (const [a, b] of solid) { piece(a, b); wallPiece(e.axis, e.line, a, b, 0, H, t, wallMat, true, inSide, paint); }
      tagEdge = edgeTag;
      if (paint && (ui.view === 'top' || H < 60)) {
        // en planta (o amb les parets amagades) la paret pintada es marca amb una franja del seu color a tocar de la paret
        const bw = 12, off = e.line + inSide * (t / 2 + bw / 2), bm = paintTop(paint);
        for (const [a, b] of solid) {
          const m = new THREE.Mesh(e.axis === 'x' ? new THREE.BoxGeometry(b - a, 0.6, bw) : new THREE.BoxGeometry(bw, 0.6, b - a), bm);
          if (e.axis === 'x') m.position.set((a + b) / 2, 0.5, off); else m.position.set(off, 0.5, (a + b) / 2);
          m.userData.wall = { ...edgeTag, a, b, edgeA: e.a, edgeB: e.b };
          planGroup.add(m);
        }
      }
      for (const o of ops) {
        const a = Math.max(o.a, e.a), b = Math.min(o.b, e.b);
        const top = o.type === 'paso' ? 220 : o.type === 'ventanal' ? Math.min(H, 240) : 210;
        piece(a, b, o.type);
        if (H > top) wallPiece(e.axis, e.line, a, b, top, H, t, wallMat, true, inSide, paint);
        if (o.type === 'ventanal') {
          // finestral de terra a sostre: dues fulles de vidre que s'obren cap a dins en tocar-les, amb un muntant al mig
          const mid = (a + b) / 2;
          wallPiece(e.axis, e.line, mid - 2, mid + 2, 0, top, t, wallTopMat, false);
          wallPiece(e.axis, e.line, a, b, 0, 4, t, wallTopMat, false);
          windowLeaves(r, o, e, a, b, 4, top, 2);
        }
        if (o.type === 'ventana') {
          // ampit de 90; amb parets baixes es dibuixa més avall perquè el vidre es vegi des de dalt
          const sill = H > 150 ? 90 : Math.round(H * 0.4);
          wallPiece(e.axis, e.line, a, b, 0, Math.min(sill, H), t, wallMat, true, inSide, paint);
          if (H > sill + 10) windowLeaves(r, o, e, a, b, sill, Math.min(210, H), b - a > 130 ? 2 : 1);
        }
        if (o.type === 'ventana' || o.type === 'ventanal') {
          // franja azul en el suelo para que la ventana se vea también en la vista en planta
          const strip = new THREE.Mesh(new THREE.BoxGeometry(e.axis === 'x' ? b - a : t + 4, 0.8, e.axis === 'x' ? t + 4 : b - a), windowMat);
          if (e.axis === 'x') strip.position.set((a + b) / 2, 0.4, e.line); else strip.position.set(e.line, 0.4, (a + b) / 2);
          planGroup.add(strip);
        }
        if (o.type === 'puerta' && H > 20) {
          // marco fino para que la puerta se vea en el suelo
          const frame = new THREE.Mesh(new THREE.BoxGeometry(e.axis === 'x' ? b - a : t + 2, 0.6, e.axis === 'x' ? t + 2 : b - a), wallTopMat);
          if (e.axis === 'x') frame.position.set((a + b) / 2, 0.3, e.line); else frame.position.set(e.line, 0.3, (a + b) / 2);
          planGroup.add(frame);
        }
      }
      tagEdge = edgeTag;
    }
    // Batents de les portes d'aquesta habitació: arc al terra i la fulla oberta.
    for (const op of r.openings || []) {
      const sw = doorSwing(r, op);
      if (!sw) continue;
      const arc = swingArc(sw, 14);
      const pts = [];
      for (let k = 0; k < arc.length - 1; k++) pts.push(arc[k][0], 0.9, arc[k][1], arc[k + 1][0], 0.9, arc[k + 1][1]);
      pts.push(sw.hx, 0.9, sw.hz, sw.hx + sw.ix * sw.r, 0.9, sw.hz + sw.iz * sw.r);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      planGroup.add(new THREE.LineSegments(geo, swingMat));
      if (H > 20) {
        // la fulla, penjada de la frontissa: gira entre tancada (seguint la paret) i oberta (cap a dins)
        const key = r.id + '|' + (r.openings || []).indexOf(op);
        doorSpots.push({ key, x: sw.hx + sw.wx * sw.r / 2, z: sw.hz + sw.wz * sw.r / 2 });
        const h = Math.min(H, 205);
        const pivot = new THREE.Group();
        pivot.position.set(sw.hx, 0, sw.hz);
        const leaf = new THREE.Mesh(new THREE.BoxGeometry(sw.r, h, 3), doorMat);
        leaf.position.set(sw.r / 2, h / 2, 0);
        leaf.castShadow = true;
        leaf.userData.door = key;
        pivot.add(leaf);
        pivot.userData.door = { key, closed: Math.atan2(-sw.wz, sw.wx), open: Math.atan2(-sw.iz, sw.ix) };
        pivot.rotation.y = doorAngle(pivot.userData.door, doors[key] ?? 1);
        planGroup.add(pivot);
      }
    }

    if (ui.labels) {
      const lines = [r.name, `${fmtLen(r.w, 0)} × ${fmtLen(r.d, 1)}`];
      if (r.estimated) lines.push('mides estimades');
      const l = makeLabel(lines, r.estimated ? '#9a5d10' : '#2b2926', 'rgba(255,255,255,0.82)', r.w * 0.85, r.d * 0.6);
      l.position.set(r.x + r.w / 2, 0.6, r.z + r.d / 2);
      planGroup.add(l);
    }
  }
  tagEdge = null;
  if (ui.wallSel) drawWallMeasure();
}

// ---------------------------------------------------------------- muebles 3D
const meshes = new Map();
const selBox = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x1e88e5 }));
selBox.visible = false;
overlayGroup.add(selBox);

function placeMesh(it, g) {
  g.position.set(it.x, it.elev || 0, it.z);
  g.rotation.y = (it.rot || 0) * DEG;
}

// Foto d'un moble: la seva pròpia o la del catàleg «Els meus mobles» d'on ve.
const photoOf = (it) => it.photo || (it.catalogId && (state.catalog || []).find((c) => c.id === it.catalogId)?.photo) || '';
onPhotoLoaded(() => requestRender());
function rebuildItems() {
  requestRender();
  disposeGroup(itemsGroup);
  meshes.clear();
  for (const it of state.items) {
    const g = buildFurniture(it, { photo: photoOf(it) });
    g.userData.itemId = it.id;
    g.traverse((o) => { o.userData.itemId = it.id; });
    placeMesh(it, g);
    itemsGroup.add(g);
    meshes.set(it.id, g);
  }
  updateOverlays();
}

function updateItem(it, rebuild = false) {
  const g = meshes.get(it.id);
  if (!g || rebuild) return rebuildItems();
  placeMesh(it, g);
  updateOverlays();
}

// Contorn en planta (un sofà en L o en U es dibuixa amb la seva forma, no com un rectangle).
function footprintLines(it, y, pad = 2) {
  const pts = [];
  for (const p of parts(it)) {
    const cs = corners(p, pad);
    for (let i = 0; i < 4; i++) {
      const a = cs[i], b = cs[(i + 1) % 4];
      pts.push(a[0], y, a[1], b[0], y, b[1]);
    }
  }
  return pts;
}

// Conflictos: muebles que se solapan o que salen de su habitación.
function conflicts() {
  const t = state.wallThickness || 10;
  const bad = new Map();
  const solid = state.items.filter((i) => i.type !== 'alfombra');
  for (const it of solid) {
    const r = roomById(it.roomId);
    if (r && outsideAmount(innerRect(r, t), aabb(it)) > 1) bad.set(it.id, 'Surt de l’habitació');
  }
  const swings = allSwings(state.rooms);
  for (const it of solid) {
    if ((it.elev || 0) >= 200) continue;
    if (swings.some((sw) => boxHitsSwing(aabb(it), sw))) bad.set(it.id, 'Bloqueja una porta');
  }
  // Sostre, pilars i bigues: el moble ha de cabre d'alçada i no pot ocupar un pilar ni passar per sota d'una biga si és més alt.
  const ceil = state.ceiling || 250;
  const structs = structItems(state.rooms);
  for (const it of state.items) {
    const top = (it.elev || 0) + it.h;
    if (top > ceil + 0.5) { bad.set(it.id, `Més alt que el sostre (${Math.round(top)} de ${ceil} cm)`); continue; }
    for (const st of structs) {
      if (!overlaps(it, st, -1)) continue;
      if (st.kind === 'pillar') { bad.set(it.id, `Xoca amb el ${st.name}`); break; }
      if (top > st.h0 + 0.5) { bad.set(it.id, `Topa amb la ${st.name} (${st.h0} cm)`); break; }
    }
  }
  for (let a = 0; a < solid.length; a++) for (let b = a + 1; b < solid.length; b++) {
    const A = solid[a], B = solid[b];
    const a0 = A.elev || 0, a1 = a0 + A.h, b0 = B.elev || 0, b1 = b0 + B.h;
    if (a1 <= b0 || b1 <= a0) continue;
    const isSeatTable = (x, y) => x.type === 'silla' && ['mesa', 'escritorio'].includes(y.type);
    if (isSeatTable(A, B) || isSeatTable(B, A)) continue; // las sillas pueden meterse bajo la mesa
    if (overlaps(A, B, -1)) {
      bad.set(A.id, 'Xoca amb ' + B.name);
      bad.set(B.id, 'Xoca amb ' + A.name);
    }
  }
  return bad;
}

let conflictLines = null;
// So curt d'avís (dues notes baixes) quan apareix un conflicte nou.
let beepCtx = null, lastBeep = 0;
function warnBeep() {
  const now = Date.now(); if (now - lastBeep < 700) return; lastBeep = now;
  try {
    beepCtx ||= new (window.AudioContext || window.webkitAudioContext)();
    const g = beepCtx.createGain(); g.gain.value = 0.0001; g.connect(beepCtx.destination);
    const t0 = beepCtx.currentTime;
    [[330, 0, 0.09], [262, 0.1, 0.14]].forEach(([f, d, len]) => { const o = beepCtx.createOscillator(); o.type = 'triangle'; o.frequency.value = f; o.connect(g); o.start(t0 + d); o.stop(t0 + d + len); });
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.18, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.26);
    vib([30, 40, 30]);
  } catch (e) { /* sense so */ }
}
function updateOverlays() {
  requestRender();
  const sel = itemById(ui.selected);
  if (sel) {
    const pts = [];
    for (const o of selIds().map(itemById)) pts.push(...footprintLines(o, 1.5, 3), ...footprintLines(o, (o.elev || 0) + o.h + 2, 3));
    selBox.geometry.dispose();
    selBox.geometry = new THREE.BufferGeometry();
    selBox.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    selBox.visible = true;
  } else selBox.visible = false;

  if (conflictLines) { overlayGroup.remove(conflictLines); conflictLines.geometry.dispose(); }
  const bad = conflicts();
  const pts = [];
  const visual = prefs.warn === 'both' || prefs.warn === 'visual';
  if (visual) for (const id of bad.keys()) pts.push(...footprintLines(itemById(id), 2, 1));
  if ((prefs.warn === 'both' || prefs.warn === 'sound') && [...bad.keys()].some((id) => !(ui.conflicts || new Map()).has(id))) warnBeep();
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  conflictLines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xd32f2f }));
  overlayGroup.add(conflictLines);
  ui.conflicts = bad;
  updateMeasures(sel);
  updateZones(sel);
}

// Cotes: distància del moble seleccionat a les quatre parets de la seva habitació.
const measureGroup = new THREE.Group();
overlayGroup.add(measureGroup);
const measureMat = new THREE.LineBasicMaterial({ color: 0x1e88e5, depthTest: false });
const measureBadMat = new THREE.LineBasicMaterial({ color: 0xe53935, depthTest: false });
const measureLabelCache = new Map();
function measureLabel(text, bad = false) {
  const key = (bad ? '!' : '') + text;
  let tex = measureLabelCache.get(key);
  if (!tex) {
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d');
    ctx.font = '700 40px system-ui, sans-serif';
    c.width = Math.ceil(ctx.measureText(text).width) + 28; c.height = 56;
    ctx.font = '700 40px system-ui, sans-serif';
    ctx.fillStyle = bad ? '#e53935' : '#1e88e5';
    ctx.beginPath(); ctx.roundRect(0, 0, c.width, c.height, 14); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, c.width / 2, c.height / 2 + 2);
    tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.userData.w = c.width; tex.userData.h = c.height;
    if (measureLabelCache.size > 300) { for (const t of measureLabelCache.values()) t.dispose(); measureLabelCache.clear(); }
    measureLabelCache.set(key, tex);
  }
  const sc = 0.42;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(tex.userData.w * sc, tex.userData.h * sc), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false }));
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = 5;
  return m;
}
// Distància lliure del moble cap a cada costat fins al primer obstacle: la paret, un altre moble (que estigui a la mateixa alçada)
// o un pilar. Si toca o s'encavalca, la distància és ≤ 0 (i la cota surt en vermell).
function wallDistances(it) {
  const r = roomById(it.roomId);
  if (!r || r.kind === 'void') return null;
  const R = innerRect(r, state.wallThickness || 10);
  const b = aabb(it);
  const out = { R, b, W: { v: b.x0 - R.x0, at: R.x0, what: 'paret' }, E: { v: R.x1 - b.x1, at: R.x1, what: 'paret' }, N: { v: b.z0 - R.z0, at: R.z0, what: 'paret' }, S: { v: R.z1 - b.z1, at: R.z1, what: 'paret' } };
  const y0 = it.elev || 0, y1 = y0 + it.h;
  const obst = [];
  if (it.type !== 'alfombra') for (const o of state.items) {
    if (o === it || o.type === 'alfombra') continue;
    const o0 = o.elev || 0; if (o0 + o.h <= y0 + 0.5 || y1 <= o0 + 0.5) continue;
    if ((it.type === 'silla' && ['mesa', 'escritorio'].includes(o.type)) || (o.type === 'silla' && ['mesa', 'escritorio'].includes(it.type))) continue;
    for (const p of parts(o)) obst.push({ box: aabb(p), what: o.name });
  }
  for (const st of structItems(state.rooms)) if (st.kind === 'pillar' || y1 > st.h0 + 0.5) obst.push({ box: aabb(st), what: st.name });
  const ov = (a0, a1, c0, c1) => Math.min(a1, c1) - Math.max(a0, c0) > 1;
  for (const { box: o, what } of obst) {
    if (ov(b.z0, b.z1, o.z0, o.z1)) {
      if (o.x0 < b.x0 && b.x0 - o.x1 < out.W.v) out.W = { v: b.x0 - o.x1, at: o.x1, what };
      if (o.x1 > b.x1 && o.x0 - b.x1 < out.E.v) out.E = { v: o.x0 - b.x1, at: o.x0, what };
    }
    if (ov(b.x0, b.x1, o.x0, o.x1)) {
      if (o.z0 < b.z0 && b.z0 - o.z1 < out.N.v) out.N = { v: b.z0 - o.z1, at: o.z1, what };
      if (o.z1 > b.z1 && o.z0 - b.z1 < out.S.v) out.S = { v: o.z0 - b.z1, at: o.z0, what };
    }
  }
  return out;
}
function updateMeasures(sel) {
  for (const o of measureGroup.children) { o.geometry.dispose(); if (o.material !== measureMat && o.material !== measureBadMat) o.material.dispose(); } // la textura (cache) no es destrueix
  measureGroup.clear();
  if (!sel || !ui.measures) return;
  const d = wallDistances(sel);
  if (!d) return;
  const { b } = d;
  const hit = ui.conflicts?.has(sel.id); // si el moble xoca amb alguna cosa, totes les cotes en vermell
  const y = (sel.elev || 0) + 2.5;
  const ptsOk = [], ptsBad = [];
  const mx = (b.x0 + b.x1) / 2, mz = (b.z0 + b.z1) / 2;
  const segs = [
    { v: d.W.v, a: [d.W.at, mz], c: [b.x0, mz], tick: 'z' },
    { v: d.E.v, a: [b.x1, mz], c: [d.E.at, mz], tick: 'z' },
    { v: d.N.v, a: [mx, d.N.at], c: [mx, b.z0], tick: 'x' },
    { v: d.S.v, a: [mx, b.z1], c: [mx, d.S.at], tick: 'x' },
  ];
  for (const s of segs) {
    const bad = hit || s.v < 0.5;
    if (Math.abs(s.v) < 0.5 && !hit) continue;
    const pts = bad ? ptsBad : ptsOk;
    pts.push(s.a[0], y, s.a[1], s.c[0], y, s.c[1]);
    const t = 6;
    for (const p of [s.a, s.c]) {
      if (s.tick === 'z') pts.push(p[0], y, p[1] - t, p[0], y, p[1] + t);
      else pts.push(p[0] - t, y, p[1], p[0] + t, y, p[1]);
    }
    const l = measureLabel(s.v < -0.5 ? `xoca ${fmtLen(-s.v)}` : fmtLen(Math.max(0, s.v)), bad);
    l.position.set((s.a[0] + s.c[0]) / 2, y + 0.5, (s.a[1] + s.c[1]) / 2);
    if (s.tick === 'z') l.position.z -= 14;
    measureGroup.add(l);
  }
  for (const [pts, mat] of [[ptsOk, measureMat], [ptsBad, measureBadMat]]) {
    if (!pts.length) continue;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const ln = new THREE.LineSegments(geo, mat); ln.renderOrder = 4; measureGroup.add(ln);
  }
}
// Zones de pas i d'ús: verdes si estan lliures, vermelles si hi ha alguna cosa al mig.
const zoneGroup = new THREE.Group();
overlayGroup.add(zoneGroup);
const zoneOkMat = new THREE.MeshBasicMaterial({ color: 0x43a047, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide });
const zoneBadMat = new THREE.MeshBasicMaterial({ color: 0xe53935, transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide });
const zoneEdgeOk = new THREE.LineBasicMaterial({ color: 0x2e7d32 }), zoneEdgeBad = new THREE.LineBasicMaterial({ color: 0xc62828 });
function updateZones(sel) {
  zoneGroup.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  zoneGroup.clear();
  ui.zoneBad = new Map();
  for (const it of state.items) {
    const z = checkZones(it, state);
    const bad = z.filter((r) => !r.ok);
    if (bad.length) ui.zoneBad.set(it.id, bad);
    if (!(ui.zones || (sel === it && ui.measures)) || !z.length) continue;
    const g = new THREE.Group(); g.position.set(it.x, 1.2, it.z); g.rotation.y = (it.rot || 0) * DEG;
    for (const r of z) {
      const L = r.local, w = L.x1 - L.x0, d = L.z1 - L.z0;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), r.ok ? zoneOkMat : zoneBadMat);
      m.rotation.x = -Math.PI / 2; m.position.set((L.x0 + L.x1) / 2, 0, (L.z0 + L.z1) / 2); m.renderOrder = 2; g.add(m);
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(w, d)), r.ok ? zoneEdgeOk : zoneEdgeBad);
      e.rotation.x = -Math.PI / 2; e.position.copy(m.position); g.add(e);
    }
    zoneGroup.add(g);
  }
}
function zonesHtml(it) {
  const z = checkZones(it, state);
  if (!z.length) return '';
  return '<div class="zones">' + z.map((r) => `<span class="${r.ok ? 'ok' : 'bad'}">${r.ok ? '✓' : '✗'} ${esc(r.label)}${r.ok ? ` (${r.need} cm)` : `: cal ${r.need} cm, n’hi ha ${r.have}`}</span>`).join('') + '</div>';
}
function distHtml(it) {
  const d = wallDistances(it);
  if (!d) return '';
  const f = (o) => o.v < -0.5 ? `<b class="bad" title="Xoca amb ${esc(o.what)}">xoca ${Math.round(-o.v)}</b>` : `<b title="Fins a: ${esc(o.what)}">${Math.round(Math.max(0, o.v))}</b>`;
  return `Espai lliure: esq. ${f(d.W)} · dreta ${f(d.E)} · dalt ${f(d.N)} · baix ${f(d.S)} cm`;
}

// ---------------------------------------------------------------- interacción
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
let drag = null;
const pointers = new Map(); // dits a la pantalla (per al pessic del passeig)

// Cinta mètrica (📐): punts on s'enganxa = cantonades dels mobles (a terra i a dalt), de les habitacions i vores dels forats.
tape = initTape({
  group: overlayGroup, camera: () => camera, dom: renderer.domElement, render: requestRender, fmt: (cm) => fmtLen(cm),
  targets: () => [planGroup, itemsGroup, ground],
  snapPoints: () => {
    const pts = [], t = state.wallThickness || 10;
    for (const it of state.items) { const y0 = it.elev || 0; for (const [x, z] of corners(it)) pts.push([x, y0, z], [x, y0 + it.h, z]); }
    for (const r of state.rooms) { if (r.kind === 'void') continue; const R = innerRect(r, t); pts.push([R.x0, 0, R.z0], [R.x1, 0, R.z0], [R.x1, 0, R.z1], [R.x0, 0, R.z1]); }
    for (const o of allOpenings(state.rooms)) { if (o.axis === 'x') pts.push([o.a, 0, o.line], [o.b, 0, o.line]); else pts.push([o.line, 0, o.a], [o.line, 0, o.b]); }
    return pts;
  },
});
function setTape(on) {
  tape.set(on);
  for (const b of document.querySelectorAll('#tapeBtn')) { b.classList.toggle('active', !!on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); }
  document.body.classList.toggle('taping', !!on);
  if (on) { select(null); if (ui.view === 'walk') setView('3d'); toast('📐 Toca dos punts per mesurar. Toca 📐 una altra vegada per acabar.'); }
  setHint(); requestRender();
}
function setZones(on) {
  ui.zones = !!on;
  for (const b of document.querySelectorAll('#zonesBtn')) { b.classList.toggle('active', !!on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); }
  updateOverlays(); renderItemList();
  if (on) { const n = ui.zoneBad?.size || 0; toast(n ? `🟥 ${n} moble${n > 1 ? 's' : ''} sense prou espai per fer-lo servir (en vermell).` : '🟩 Tots els mobles tenen prou espai per fer-los servir.'); }
}
renderer.domElement.addEventListener('wheel', (e) => {
  if (ui.view !== 'walk') return;
  e.preventDefault();
  setWalkFov(walk.fov + Math.sign(e.deltaY) * 4);
}, { passive: false });

// Captura el punter (si el navegador encara el té actiu) perquè el moviment segueixi fora del llenç.
const capture = (e) => { try { renderer.domElement.setPointerCapture(e.pointerId); } catch (err) { /* punter ja alliberat */ } };
function setPointer(e) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
}
function floorPoint() {
  const p = new THREE.Vector3();
  return raycaster.ray.intersectPlane(floorPlane, p) ? p : null;
}

// Gir amb dos dits (mòbil): a la vista 3D i a la planta, girar els dos dits fa girar el plànol al voltant del centre,
// a la vegada que el pessic fa zoom i arrossegar desplaça (això ho fa OrbitControls).
const twist = { touches: new Map(), a0: null, acc: 0, on: false };
const twistAngle = () => { const [a, b] = [...twist.touches.values()]; return Math.atan2(b.y - a.y, b.x - a.x); };
const twistTarget = () => (ui.view === 'top' ? controlsTop : ui.view === '3d' ? controls3d : null);
renderer.domElement.addEventListener('pointerdown', (e) => {
  if (e.pointerType !== 'touch') return;
  twist.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (twist.touches.size === 2 && twistTarget() && !drag?.id) {
    twist.a0 = twistAngle(); twist.acc = 0; twist.on = false;
    if (drag?.empty) drag = null; // dos dits ja no és un toc
  }
}, true);
renderer.domElement.addEventListener('pointermove', (e) => {
  const t = twist.touches.get(e.pointerId); if (!t) return;
  t.x = e.clientX; t.y = e.clientY;
  const c = twistTarget();
  if (twist.touches.size !== 2 || twist.a0 === null || !c) return;
  const a = twistAngle();
  let d = a - twist.a0; d = Math.atan2(Math.sin(d), Math.cos(d)); twist.a0 = a;
  twist.acc += d;
  if (!twist.on && Math.abs(twist.acc) < 0.09) return; // uns 5°: per sota, és un pessic normal
  if (!twist.on) { twist.on = true; d = twist.acc; }
  const cam = c.object, off = cam.position.clone().sub(c.target);
  off.applyAxisAngle(new THREE.Vector3(0, 1, 0), d);
  cam.position.copy(c.target).add(off);
  cam.lookAt(c.target); c.update(); requestRender();
}, true);
const twistEnd = (e) => { twist.touches.delete(e.pointerId); if (twist.touches.size < 2) { twist.a0 = null; twist.on = false; } };
renderer.domElement.addEventListener('pointerup', twistEnd, true);
renderer.domElement.addEventListener('pointercancel', twistEnd, true);

renderer.domElement.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  if (ui.view !== 'walk' && twist.touches.size >= 2) return; // el segon dit gira o fa zoom, no agafa mobles
  if (ui.view === 'walk') {
    // Al passeig tot és interactiu: un toc obre o tanca portes i finestres, selecciona mobles i mostra mides de parets; arrossegar = mirar.
    setPointer(e);
    const ih = raycaster.intersectObjects(itemsGroup.children, true).find((h) => h.object.userData.itemId);
    const ph = raycaster.intersectObjects(planGroup.children, true);
    const dh = ph.find((h) => typeof h.object.userData.door === 'string');
    const wh = ph.find((h) => h.object.userData.wall);
    const near = (h) => h && h.distance < 420; // només el que tens a l'abast (uns 4 m)
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size >= 2) {
      // segon dit: pessic per fer zoom; s'anul·la el toc
      const [a, b] = [...pointers.values()];
      drag = { look: true, pinch: { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, fov0: walk.fov }, x: e.clientX, y: e.clientY, x0: -1e9, y0: -1e9 };
      capture(e); return;
    }
    const fp = floorPoint(), fd = fp ? fp.distanceTo(walkCam.position) : Infinity;
    drag = { look: true, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, item: near(ih) && (!dh || ih.distance <= dh.distance) ? ih.object.userData.itemId : null, door: near(dh) && (!wh || dh.distance <= wh.distance + 1) ? dh.object.userData.door : null, wall: near(wh) ? wh.object.userData.wall : null,
      floor: fp && fd < 1500 && (!wh || fd < wh.distance) && (!ih || fd < ih.distance) ? { x: fp.x, z: fp.z } : null };
    capture(e); return;
  }
  if (tape.active) { drag = { tape: true, x: e.clientX, y: e.clientY }; return; } // la càmera es pot moure; un toc posa un punt
  setPointer(e);
  const hits = raycaster.intersectObjects(itemsGroup.children, true);
  const hit = hits.find((h) => h.object.userData.itemId);
  if (hit) {
    const it = itemById(hit.object.userData.itemId);
    if (e.shiftKey || e.ctrlKey || e.metaKey || ui.multiMode) { select(it.id, true); return; } // afegeix o treu de la selecció
    if (selIds().includes(it.id) && selIds().length > 1) { ui.selected = it.id; } else select(it.id);
    if (it.locked) return;
    const p = floorPoint();
    if (!p) return;
    const ids = selIds().filter((id) => !itemById(id).locked); // es mouen tots els triats (els fixos no)
    drag = { id: it.id, ids, dx: it.x - p.x, dz: it.z - p.z, moved: false, before: JSON.stringify(state) };
    controls.enabled = false;
    capture(e);
  } else {
    const ph = raycaster.intersectObjects(planGroup.children, true);
    const dh = ph.find((h) => typeof h.object.userData.door === 'string');
    const wh = ph.find((h) => h.object.userData.wall);
    drag = { empty: true, x: e.clientX, y: e.clientY, wall: wh ? wh.object.userData.wall : null, door: dh && (!wh || dh.distance <= wh.distance + 1) ? dh.object.userData.door : null };
  }
});

// Toca una paret: se'n veu la llargada amb una línia de cota i un rètol que sempre mira cap a tu (des del costat on ets),
// i s'obre el panell per pintar-la.
const wallMeasureGroup = new THREE.Group();
overlayGroup.add(wallMeasureGroup);
const wmLineMat = new THREE.LineBasicMaterial({ color: 0xd9864d, depthTest: false, transparent: true });
let wallSprite = null;
function wallLabelTexture(lines) {
  const c = document.createElement('canvas'), ctx = c.getContext('2d');
  const f1 = 64, f2 = 30, padX = 30;
  ctx.font = `700 ${f1}px system-ui, sans-serif`; let w = ctx.measureText(lines[0]).width;
  ctx.font = `500 ${f2}px system-ui, sans-serif`; for (const l of lines.slice(1)) w = Math.max(w, ctx.measureText(l).width);
  c.width = Math.ceil(w + padX * 2); c.height = 24 + f1 + (lines.length - 1) * (f2 + 10) + 22;
  ctx.fillStyle = 'rgba(28,26,24,0.88)'; ctx.beginPath(); ctx.roundRect(0, 0, c.width, c.height, 26); ctx.fill();
  ctx.fillStyle = '#d9864d'; ctx.fillRect(0, 0, 10, c.height);
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillStyle = '#ffffff'; ctx.font = `700 ${f1}px system-ui, sans-serif`; ctx.fillText(lines[0], c.width / 2 + 5, 18);
  ctx.fillStyle = '#d8d2ca'; ctx.font = `500 ${f2}px system-ui, sans-serif`;
  lines.slice(1).forEach((l, i) => ctx.fillText(l, c.width / 2 + 5, 24 + f1 + 6 + i * (f2 + 10)));
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  return { tex, aspect: c.width / c.height };
}
// Mida fixa a la pantalla (uns 70 px d'alt), sigui quina sigui la distància o el zoom.
function fitWallSprite() {
  if (!wallSprite) return;
  const hpx = isMobile() ? 58 : 70, frac = hpx / (renderer.domElement.clientHeight || 600);
  const sy = camera.isPerspectiveCamera ? 2 * frac * Math.tan(camera.fov * DEG / 2) : frac * (camera.top - camera.bottom) / camera.zoom;
  wallSprite.scale.set(sy * wallSprite.userData.aspect, sy, 1);
  // el rètol va al mig del tros de paret que es veu a la pantalla (no fora, si la paret és llarga o està tallada)
  const { place, a, b, aspect } = wallSprite.userData;
  if (!place) return;
  const W = renderer.domElement.clientWidth || 800;
  const mx = Math.max(0.2, 1 - (aspect * hpx) / W - 0.03), my = Math.max(0.2, 1 - (hpx * 1.2) / (renderer.domElement.clientHeight || 600));
  const v = new THREE.Vector3();
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i <= 32; i++) {
    const u = a + (b - a) * i / 32;
    v.fromArray(place(u)).project(camera);
    if (v.z < 1 && Math.abs(v.x) <= mx && Math.abs(v.y) <= my) { lo = Math.min(lo, u); hi = Math.max(hi, u); }
  }
  wallSprite.position.fromArray(place(lo <= hi ? (lo + hi) / 2 : (a + b) / 2));
}
function clearWallMeasure() {
  for (const o of wallMeasureGroup.children) { o.geometry?.dispose(); if (o.material && o.material !== wmLineMat) { o.material.map?.dispose(); o.material.dispose(); } }
  wallMeasureGroup.clear(); wallSprite = null;
}
function drawWallMeasure() {
  clearWallMeasure();
  const w = ui.wallSel;
  if (!w || !state.rooms.includes(w.room)) { ui.wallSel = null; return; }
  const len = Math.round(w.b - w.a), H = state.ceiling || 250, t = state.wallThickness || 10;
  const ops = allOpenings(state.rooms).filter((o) => o.axis === w.axis && Math.abs(o.line - w.line) <= 1 && o.b > w.a && o.a < w.b);
  const OPN = { puerta: 'porta', paso: 'pas', ventanal: 'finestral', ventana: 'finestra' };
  const lines = [fmtLen(len, 1), `${w.room.name} · ${fmtLen(H, 1)} d’alt`];
  const whole = w.edgeB !== undefined ? Math.round(w.edgeB - w.edgeA) : null;
  if (w.over) lines[0] = `${OPN[w.over] || w.over} de ${fmtLen(len, 1)}`; // s'ha tocat la paret de damunt d'una porta o d'una finestra
  else if (whole && whole - len > 1) lines.push(`tros de la paret ${WALL_TXT[w.key] || ''} (sencera: ${fmtLen(whole, 1)})`);
  if (ops.length && !w.over && !(whole && whole - len > 1)) lines.push(ops.map((o) => `${OPN[o.type] || o.type} de ${fmtLen(Math.round(Math.min(o.b, w.b) - Math.max(o.a, w.a)), 1)}`).join(' · '));
  // costat des d'on es mira: el de la càmera (en planta, el de dins de l'habitació)
  const camPos = camera.position;
  let side = w.inSide || 1;
  if (ui.view !== 'top') { const d = (w.axis === 'x' ? camPos.z : camPos.x) - w.line; if (Math.abs(d) > 1) side = Math.sign(d); }
  const off = t / 2 + 2, Hn = wallHeight();
  const y = ui.view === 'top' ? Hn + 2 : Math.max(25, Math.min(Hn - 15, ui.view === 'walk' ? 140 : Hn * 0.55));
  const P = (u, yy) => (w.axis === 'x' ? [u, yy, w.line + side * off] : [w.line + side * off, yy, u]);
  const tick = ui.view === 'top' ? 0 : 18;
  const pts = [...P(w.a, y), ...P(w.b, y)];
  for (const u of [w.a, w.b]) { if (tick) pts.push(...P(u, y - tick), ...P(u, y + tick)); else { const q = w.axis === 'x' ? [[u, y, w.line + side * (off - 8)], [u, y, w.line + side * (off + 8)]] : [[w.line + side * (off - 8), y, u], [w.line + side * (off + 8), y, u]]; pts.push(...q[0], ...q[1]); } }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const ln = new THREE.LineSegments(geo, wmLineMat); ln.renderOrder = 9; wallMeasureGroup.add(ln);
  const { tex, aspect } = wallLabelTexture(lines);
  wallSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, depthWrite: false, sizeAttenuation: false, transparent: true }));
  wallSprite.userData.aspect = aspect; wallSprite.renderOrder = 10;
  const place = (u) => { const v = P(u, y); if (ui.view === 'top') { if (w.axis === 'x') v[2] += side * 22; else v[0] += side * 22; } return v; };
  Object.assign(wallSprite.userData, { place, a: w.a, b: w.b });
  wallSprite.position.set(...place((w.a + w.b) / 2));
  wallMeasureGroup.add(wallSprite);
  fitWallSprite();
  const hint = document.getElementById('hint');
  if (hint) { hint.dataset.prev ??= hint.textContent; hint.textContent = `📏 ${lines.join(' · ')}`; }
  requestRender();
}
// Si la càmera passa a l'altre costat de la paret, el rètol i la cota també hi passen.
let wallSideSeen = 0;
function wallSideCheck() {
  const w = ui.wallSel; if (!w || ui.view === 'top') return;
  const d = (w.axis === 'x' ? camera.position.z : camera.position.x) - w.line;
  const s = Math.abs(d) > 1 ? Math.sign(d) : wallSideSeen;
  if (wallSideSeen && s !== wallSideSeen) { wallSideSeen = s; drawWallMeasure(); } else wallSideSeen = s;
}
function showWallMeasure(w) {
  if (w && ui.wallSel && (ui.wallSel.room !== w.room || ui.wallSel.key !== w.key)) ui.wallAll = false; // «totes» només per a la paret on s'ha marcat
  ui.wallSel = w || null;
  if (!w) {
    clearWallMeasure();
    const hint = document.getElementById('hint');
    if (hint && hint.dataset.prev !== undefined) { hint.textContent = hint.dataset.prev; delete hint.dataset.prev; }
    renderWallPanel(); requestRender(); return;
  }
  if (ui.selected) { ui.selected = null; updateOverlays(); renderProps(); renderItemList(); }
  drawWallMeasure();
  renderWallPanel();
}

// Panell per pintar la paret tocada: paleta, selector de color o codi (#rrggbb). Es pot aplicar a totes les parets de l'habitació.
const WALL_PALETTE = [['#f3f1ec', 'Blanc trencat'], ['#e9e2d0', 'Beix'], ['#d8cbb3', 'Sorra'], ['#e8c9b5', 'Rosa terra'], ['#c46e4b', 'Terracota'], ['#e3b55b', 'Mostassa'], ['#c9d6c3', 'Verd sàlvia'], ['#7f9a82', 'Verd oliva'], ['#cfdbe3', 'Blau cel'], ['#8fa9bf', 'Blau grisós'], ['#5c6b73', 'Gris pissarra'], ['#2f3b45', 'Blau nit']];
const normHex = (v) => { let h = String(v || '').trim().replace(/^#/, '').toLowerCase(); if (/^[0-9a-f]{3}$/.test(h)) h = h.split('').map((c) => c + c).join(''); return /^[0-9a-f]{6}$/.test(h) ? '#' + h : null; };
function paintWall(w, hex, all) {
  const r = w.room;
  commit();
  const keys = all ? ['N', 'S', 'E', 'W'] : [w.key];
  r.walls ||= {};
  for (const k of keys) { if (hex) r.walls[k] = hex; else delete r.walls[k]; }
  if (!Object.keys(r.walls).length) delete r.walls;
  save(); rebuildPlan(); renderWallPanel(); requestRender();
  toast(hex ? 'Pintada ✓' : 'Color tret');
}
function renderWallPanel() {
  const el = $('#wallpanel');
  if (!el) return;
  const w = ui.wallSel;
  if (!w) { el.hidden = true; return; }
  const cur = w.room.walls?.[w.key] || '';
  el.hidden = false;
  el.innerHTML = `
    <h3><span class="sw" style="width:14px;height:14px;border-radius:3px;background:${esc(cur || '#f3f1ec')}"></span>${w.whole ? esc(w.room.name) : `Paret ${WALL_TXT[w.key] || ''} · ${esc(w.room.name)}`}<button class="close" id="wp-close" title="Tanca">×</button></h3>
    <div class="dist">${w.over ? 'Damunt d’un buit de ' : 'Aquest tros: '}<b>${fmtLen(Math.round(w.b - w.a), 1)}</b> de llarg · ${fmtLen(state.ceiling || 250, 1)} d’alt${w.edgeB !== undefined && Math.round(w.edgeB - w.edgeA) - Math.round(w.b - w.a) > 1 ? ` · paret sencera ${fmtLen(Math.round(w.edgeB - w.edgeA), 1)}` : ''}</div>
    ${wallSizeHtml(w)}
    <h4 class="wp-sub">🎨 Color</h4>
    <div class="swatches">${WALL_PALETTE.map(([c, n]) => `<button type="button" data-c="${c}" title="${n} ${c}" class="${cur === c ? 'on' : ''}" style="background:${c}"></button>`).join('')}</div>
    <div class="row c2">
      <label>Color<input type="color" id="wp-color" value="${esc(cur || '#f3f1ec')}" /></label>
      <label>Codi<span class="hexrow"><input type="text" id="wp-hex" value="${esc(cur)}" placeholder="#a1b2c3" maxlength="7" autocomplete="off" spellcheck="false" /><button type="button" class="btn small" id="wp-hex-ok">OK</button></span></label>
    </div>
    <label class="chk" ${w.whole ? 'hidden' : ''}><input type="checkbox" id="wp-all" ${ui.wallAll && !w.whole ? 'checked' : ''}/> Totes les parets de l’habitació</label>
    <div class="btns"><button class="btn secondary small" id="wp-clear">Treu el color</button></div>`;
  const all = () => $('#wp-all').checked;
  $('#wp-close').addEventListener('click', () => showWallMeasure(null));
  $('#wp-all').addEventListener('change', (e) => { ui.wallAll = e.target.checked; });
  el.querySelectorAll('.swatches button').forEach((b) => b.addEventListener('click', () => paintWall(w, b.dataset.c, all())));
  $('#wp-color').addEventListener('change', (e) => paintWall(w, normHex(e.target.value), all()));
  const hexApply = () => { const h = normHex($('#wp-hex').value); if (!h) { $('#wp-hex').classList.add('bad'); toast('Escriu un codi de color com #a1b2c3'); return; } paintWall(w, h, all()); };
  $('#wp-hex-ok').addEventListener('click', hexApply);
  $('#wp-hex').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); hexApply(); } });
  $('#wp-hex').addEventListener('input', (e) => e.target.classList.remove('bad'));
  $('#wp-clear').addEventListener('click', () => paintWall(w, null, all()));
  bindWallSize(w);
}

// --- Mida de la paret: es canvia des del mateix panell i el pis s'hi adapta (js/walledit.js).
const wallSingle = (w) => !w.over && Math.round((w.edgeB ?? w.b) - (w.edgeA ?? w.a)) - Math.round(w.b - w.a) <= 1;
function wallSizeUi(w) {
  const id = `${w.room.id}|${w.key}|${Math.round(w.a)}|${Math.round(w.b)}`;
  if (ui.ws?.id !== id) {
    const keep = ui.ws?.keep;
    ui.ws = { id, mode: wallSingle(w) ? 'whole' : 'piece', side: keep || { piece: defaultSide(state, w, 'piece'), whole: defaultSide(state, w, 'whole') } };
  }
  return ui.ws;
}
function wallSideHtml(w) {
  const ws = wallSizeUi(w), info = sideInfo(state, w, ws.mode);
  return `<span>${ws.mode === 'piece' ? 'Què es mou per fer-hi lloc' : 'Per quin extrem creix o s’escurça'}</span>${[-1, 1].map((s) => `<button type="button" data-side="${s}" class="${ws.side[ws.mode] === s ? 'on' : ''}"><b>${info[s].dir}</b><small>${esc(info[s].what)}</small></button>`).join('')}`;
}
function wallSizeHtml(w) {
  const r = w.room;
  if (w.whole || (r.kind === 'terrace' && r.d2 > 0 && r.d2 < r.d)) return '';
  const len = Math.round(w.b - w.a), whole = Math.round((w.edgeB ?? w.b) - (w.edgeA ?? w.a)), single = wallSingle(w);
  return `<h4 class="wp-sub">📏 Mida</h4>
    <div class="wsize">
      <div class="row ${single ? '' : 'c2'}">
        ${single ? '' : `<label>${w.over ? 'Aquest buit' : 'Aquest tros'} (cm)<input type="number" id="wp-len" inputmode="numeric" min="1" step="1" value="${len}" /></label>`}
        <label>${single ? 'Llargada de la paret' : 'Paret sencera'} (cm)<input type="number" id="wp-whole" inputmode="numeric" min="20" step="1" value="${whole}" /></label>
      </div>
      <div class="wside" id="wp-side">${wallSideHtml(w)}</div>
      <div class="btns"><button type="button" class="btn small" id="wp-size">✓ Aplica la mida</button></div>
      <div class="wgrow" id="wp-grow" hidden></div>
    </div>`;
}
function bindWallSize(w) {
  const box = $('#wp-side');
  if (!box) return;
  const ws = wallSizeUi(w);
  const setMode = (m) => { if (ws.mode !== m) { ws.mode = m; box.innerHTML = wallSideHtml(w); } };
  $('#wp-len')?.addEventListener('focus', () => setMode('piece'));
  $('#wp-whole').addEventListener('focus', () => setMode('whole'));
  for (const id of ['#wp-len', '#wp-whole']) {
    const inp = $(id); if (!inp) continue;
    inp.addEventListener('input', () => { inp.classList.remove('bad'); const g = $('#wp-grow'); if (g) g.hidden = true; setMode(id === '#wp-len' ? 'piece' : 'whole'); });
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); applyWallSize(); } });
  }
  // pointerdown per no perdre el focus de la casella (al mòbil es tancaria el teclat i es perdria el mode)
  box.addEventListener('pointerdown', (e) => { if (e.target.closest('button')) e.preventDefault(); });
  box.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-side]'); if (!b) return;
    ws.side[ws.mode] = +b.dataset.side;
    const g = $('#wp-grow'); if (g) g.hidden = true;
    box.innerHTML = wallSideHtml(w);
  });
  $('#wp-size').addEventListener('pointerdown', (e) => e.preventDefault());
  $('#wp-size').addEventListener('click', () => applyWallSize());
}
// Tros de paret (amb les seves mides actuals) que hi ha entre a i b d'una paret.
function wallTagAt(room, key, sel) {
  const e = edgeOf(room, key), segs = wallSegments(state.rooms, room, key);
  const mid = (sel.a + sel.b) / 2;
  const sg = segs.find((s) => Math.abs(s.a - sel.a) <= 1.5 && Math.abs(s.b - sel.b) <= 1.5) || segs.find((s) => s.a <= mid && mid <= s.b) || segs[0];
  const side = Object.keys(WALL_KEY).find((k) => WALL_KEY[k] === key);
  return { room, axis: e.axis, line: e.line, a: sg.a, b: sg.b, side, key, inSide: key === 'N' || key === 'W' ? 1 : -1, edgeA: e.a, edgeB: e.b, over: sg.solid ? undefined : sg.ops[0].type };
}
function applyWallSize(opts = {}) {
  const w = ui.wallSel, ws = ui.ws;
  if (!w || !ws) return;
  const mode = ws.mode, inp = $(mode === 'piece' ? '#wp-len' : '#wp-whole');
  if (!inp) return;
  const before = JSON.stringify(state);
  const totalBefore = Math.round((w.edgeB ?? w.b) - (w.edgeA ?? w.a));
  const res = editWall(state, w, mode, inp.value, ws.side[mode], opts);
  const gr = $('#wp-grow');
  if (!res.ok) {
    if (res.same) return;
    inp.classList.add('bad');
    if (res.canGrow && gr) {
      // no hi cap sense canviar la paret sencera: s'ofereix allargar-la (el que hi ha després es desplaça)
      gr.hidden = false;
      gr.innerHTML = `<p>${esc(res.msg)}</p><button type="button" class="btn secondary small" id="wp-grow-ok">Allarga la paret fins a ${fmtLen(res.growTotal, 1)}</button>`;
      $('#wp-grow-ok').addEventListener('click', () => applyWallSize({ grow: true }));
      relayout();
    } else toast(res.msg);
    return;
  }
  pushHistory(before);
  state.roomsEdited = true;
  save(); rebuildPlan(); rebuildItems(); renderAll();
  const nw = wallTagAt(w.room, w.key, res.sel);
  ui.ws = { id: null, keep: ws.side };
  showWallMeasure(nw);
  if (ui.ws) ui.ws.mode = mode === 'piece' && !wallSingle(nw) ? 'piece' : 'whole';
  renderWallPanel();
  const L = (v) => fmtLen(v, 1);
  let msg;
  if (res.kind === 'keep') msg = `Fet ✓ Aquest tros fa ${L(Math.round(nw.b - nw.a))}. La paret sencera continua fent ${L(res.total)} i el tros del costat ara en fa ${L(res.absorbed)}.`;
  else {
    const grow = res.total >= totalBefore;
    msg = `Fet ✓ La paret sencera ara fa ${L(res.total)} (abans ${L(totalBefore)}).`;
    if (res.moved.length) msg += ` S’ha desplaçat: ${res.moved.join(', ')}.`;
    if (res.stretched.length) msg += ` També s’ha ${grow ? 'allargat' : 'escurçat'}: ${res.stretched.join(', ')}.`;
    if (res.items) msg += ` ${res.items === 1 ? 'Un moble s’ha mogut' : res.items + ' mobles s’han mogut'} amb la paret.`;
  }
  toast(msg);
  vib(12);
}

renderer.domElement.addEventListener('pointermove', (e) => {
  if (drag && drag.look) {
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (drag.pinch) {
      if (pointers.size >= 2) { const [a, b] = [...pointers.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y) || 1; setWalkFov(drag.pinch.fov0 * drag.pinch.d0 / d); }
      return;
    }
    walk.yaw -= (e.clientX - drag.x) * 0.005; walk.pitch = Math.max(-1.2, Math.min(1.2, walk.pitch - (e.clientY - drag.y) * 0.005));
    drag.x = e.clientX; drag.y = e.clientY; walk.q = null; if (walk.gyro) stopGyro();
    requestRender(); return;
  }
  if (tape.active && (!drag || drag.tape) && e.pointerType !== 'touch') { setPointer(e); tape.hover(raycaster); return; }
  if (!drag || drag.empty || drag.tape) return;
  setPointer(e);
  const p = floorPoint();
  if (!p) return;
  const it = itemById(drag.id);
  const step = ui.snap ? cfgGet('snap') : 1;
  const ddx = Math.round((p.x + drag.dx) / step) * step - it.x, ddz = Math.round((p.z + drag.dz) / step) * step - it.z;
  if (!ddx && !ddz) return;
  for (const id of drag.ids) { const o = itemById(id); o.x += ddx; o.z += ddz; const g = meshes.get(id); if (g) placeMesh(o, g); }
  drag.moved = true;
  updateOverlays();
  renderProps(true);
});

renderer.domElement.addEventListener('pointercancel', (e) => { pointers.delete(e.pointerId); if (drag && drag.look) drag = null; });
renderer.domElement.addEventListener('pointerup', (e) => {
  if (drag && drag.look) {
    pointers.delete(e.pointerId);
    if (drag.pinch) { if (pointers.size === 0) drag = null; return; }
    if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 6) {
      if (drag.item) { select(drag.item); vib(8); }
      else if (drag.door) toggleDoor(drag.door);
      else if (drag.floor && roomAt(state.rooms, drag.floor.x, drag.floor.z)) { walk.target = drag.floor; requestRender(); } // toca el terra: hi vas caminant
      else if (drag.wall) showWallMeasure(drag.wall);
    }
    drag = null; return;
  }
  if (drag && drag.tape) {
    if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 6) { setPointer(e); tape.click(raycaster); }
    drag = null; return;
  }
  if (drag && drag.empty) {
    if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 4) { select(null); if (drag.door) toggleDoor(drag.door); else if (drag.wall) showWallMeasure(drag.wall); else if (ui.wallSel) showWallMeasure(null); }
  } else if (drag) {
    const it = itemById(drag.id);
    if (drag.moved) {
      pushHistory(drag.before);
      for (const id of drag.ids) { const o = itemById(id), r = roomAt(state.rooms, o.x, o.z); if (r) o.roomId = r.id; }
      if (drag.ids.length === 1 && CATALOG[it.type]?.mount && nearWall(it) < 45) { snapItem(it); updateItem(it); } // un objecte de paret s'hi torna a enganxar
      save(); renderAll();
      vib(12);
    }
    controls.enabled = true;
  }
  drag = null;
});

const WALK_KEYS = { arrowup: 'f', w: 'f', arrowdown: 'b', s: 'b', arrowleft: 'l', a: 'l', arrowright: 'r', d: 'r' };
window.addEventListener('keyup', (e) => { const k = WALK_KEYS[e.key.toLowerCase()]; if (k) walk.keys.delete(k); });
window.addEventListener('keydown', (e) => {
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
  if (ui.view === 'walk') {
    const k = WALK_KEYS[e.key.toLowerCase()];
    if (k) { walk.keys.add(k); e.preventDefault(); requestRender(); }
    if (e.key === '+' || e.key === '=') { e.preventDefault(); setWalkFov(walk.fov - 5); } // acostar
    if (e.key === '-' || e.key === '_') { e.preventDefault(); setWalkFov(walk.fov + 5); } // allunyar (zoom negatiu)
    if (e.key === 'Escape') setView('3d');
    return;
  }
  if (tape.active) {
    if (e.key === 'Escape') { setTape(false); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); tape.undo(); return; }
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
  const it = itemById(ui.selected);
  if (!it) return;
  const many = selIds().length > 1;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicateSel(); return; }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'g') { e.preventDefault(); if (many) groupSel(!selIds().map(itemById).every((o) => o.group && o.group === it.group)); return; }
  if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeSel(); return; }
  if (e.key === 'Escape') { select(null); return; }
  if (it.locked && !many) return;
  const step = e.shiftKey ? 10 : 1;
  const mv = (dx, dz) => { commit(); for (const o of selIds().map(itemById)) { if (o.locked) continue; o.x += dx; o.z += dz; const r = roomAt(state.rooms, o.x, o.z); if (r) o.roomId = r.id; } };
  let changed = true;
  if (e.key.toLowerCase() === 'r') { rotateSel(e.shiftKey ? -90 : 90); changed = false; }
  else if (e.key.toLowerCase() === 'q' && !many) { rotate(it, -15); changed = false; }
  else if (e.key.toLowerCase() === 'e' && !many) { rotate(it, 15); changed = false; }
  else if (e.key === 'ArrowLeft') mv(-step, 0);
  else if (e.key === 'ArrowRight') mv(step, 0);
  else if (e.key === 'ArrowUp') mv(0, -step);
  else if (e.key === 'ArrowDown') mv(0, step);
  else changed = false;
  if (changed || ['r'].includes(e.key.toLowerCase())) e.preventDefault();
  if (changed) { rebuildItems(); save(); renderProps(); renderItemList(); }
});

function rotate(it, deg) {
  commit();
  it.rot = (((it.rot || 0) + deg) % 360 + 360) % 360;
  updateItem(it); save(); renderProps();
}

// Selecció: un moble (ui.selected, el «principal») i, si n'hi ha, uns quants més (ui.multi).
// Si el moble és d'un grup, es tria tot el grup. add = afegeix-lo o treu-lo de la selecció (Maj/Ctrl + clic).
const groupIds = (id) => { const it = itemById(id); return it?.group ? state.items.filter((i) => i.group === it.group).map((i) => i.id) : [id]; };
function selIds() { if (!ui.selected || !itemById(ui.selected)) return []; return [...new Set([ui.selected, ...(ui.multi || [])])].filter((id) => itemById(id)); }
function select(id, add = false) {
  if (id && ui.wallSel) showWallMeasure(null);
  if (add && id) {
    const cur = new Set(selIds()), grp = groupIds(id);
    if (cur.has(id)) { grp.forEach((x) => cur.delete(x)); ui.selected = [...cur].pop() || null; } else { grp.forEach((x) => cur.add(x)); ui.selected = id; }
    ui.multi = cur;
  } else { ui.selected = id; ui.multi = new Set(id ? groupIds(id) : []); }
  updateOverlays();
  renderProps();
  renderItemList();
}
// Accions sobre tota la selecció.
function selBox2() { const bs = selIds().map((id) => aabb(itemById(id))); return { x0: Math.min(...bs.map((b) => b.x0)), x1: Math.max(...bs.map((b) => b.x1)), z0: Math.min(...bs.map((b) => b.z0)), z1: Math.max(...bs.map((b) => b.z1)) }; }
function rotateSel(deg) {
  const ids = selIds(); if (!ids.length) return;
  if (ids.length === 1) { const it = itemById(ids[0]); if (!it.locked) rotate(it, deg); return; }
  commit();
  const b = selBox2(), cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, a = deg * DEG, c = Math.round(Math.cos(a)), sn = Math.round(Math.sin(a));
  for (const o of ids.map(itemById)) {
    if (o.locked) continue;
    const dx = o.x - cx, dz = o.z - cz;
    o.x = Math.round(cx + dx * c + dz * sn); o.z = Math.round(cz - dx * sn + dz * c);
    o.rot = (((o.rot || 0) + deg) % 360 + 360) % 360;
  }
  rebuildItems(); save(); renderProps(); renderItemList();
}
function duplicateSel() {
  const ids = selIds(); if (!ids.length) return;
  if (ids.length === 1) { duplicate(itemById(ids[0])); return; }
  commit();
  const groups = new Map(), added = [];
  for (const it of ids.map(itemById)) {
    const c = { ...clone(it), id: newItem(it.type).id, x: it.x + 30, z: it.z + 30, locked: false };
    if (it.group) { if (!groups.has(it.group)) groups.set(it.group, 'g' + Math.random().toString(36).slice(2, 8)); c.group = groups.get(it.group); }
    state.items.push(c); added.push(c.id);
  }
  save(); rebuildItems(); ui.selected = added[0]; ui.multi = new Set(added); updateOverlays(); renderProps(); renderItemList();
}
function removeSel() {
  const ids = selIds(); if (!ids.length) return;
  if (ids.length === 1) { removeItem(ids[0]); return; }
  if (+prefs.confirmDel && !confirm(`Eliminar ${ids.length} mobles?`)) return;
  commit();
  state.items = state.items.filter((i) => !ids.includes(i.id));
  const fx = ids.filter((id) => id.startsWith('fix-')); if (fx.length) state.removedFixed = [...new Set([...(state.removedFixed || []), ...fx])];
  ui.selected = null; ui.multi = new Set();
  save(); rebuildItems(); renderAll();
}
function groupSel(on) {
  const ids = selIds(); if (ids.length < 2) return;
  commit();
  const g = 'g' + Math.random().toString(36).slice(2, 8);
  for (const o of ids.map(itemById)) { if (on) o.group = g; else delete o.group; }
  save(); renderProps(); renderItemList();
  toast(on ? `🔗 ${ids.length} mobles agrupats: ara es mouen junts.` : '⛓ Grup desfet.');
}
function alignSel(how) {
  const its = selIds().map(itemById).filter((o) => !o.locked); if (its.length < 2) return;
  commit();
  const B = selBox2();
  if (how === 'dx' || how === 'dz') {
    const k = how === 'dx' ? 'x' : 'z', s2 = [...its].sort((a, b) => a[k] - b[k]), a0 = s2[0][k], a1 = s2[s2.length - 1][k];
    s2.forEach((o, i) => { o[k] = Math.round(a0 + (a1 - a0) * i / (s2.length - 1)); });
  } else for (const o of its) {
    const b = aabb(o);
    if (how === 'x0') o.x += B.x0 - b.x0; else if (how === 'x1') o.x += B.x1 - b.x1; else if (how === 'xc') o.x += (B.x0 + B.x1) / 2 - (b.x0 + b.x1) / 2;
    else if (how === 'z0') o.z += B.z0 - b.z0; else if (how === 'z1') o.z += B.z1 - b.z1; else if (how === 'zc') o.z += (B.z0 + B.z1) / 2 - (b.z0 + b.z1) / 2;
    o.x = Math.round(o.x); o.z = Math.round(o.z);
  }
  rebuildItems(); save(); renderProps(); renderItemList();
}
function moveSelToRoom(roomId) {
  const room = roomById(roomId), its = selIds().map(itemById).filter((o) => !o.locked); if (!room || !its.length) return;
  commit();
  const B = selBox2(), R = innerRect(room, state.wallThickness || 10);
  const dx = Math.round((R.x0 + R.x1) / 2 - (B.x0 + B.x1) / 2), dz = Math.round((R.z0 + R.z1) / 2 - (B.z0 + B.z1) / 2);
  for (const o of its) { o.x += dx; o.z += dz; o.roomId = room.id; }
  rebuildItems(); save(); renderAll();
}

// Enganxa un moble d'esquena a la paret més propera (o, si és de cantonada, a la cantonada més propera amb l'esquena a les dues parets).
// L'esquena del moble és el seu costat −Z local i, en una cantonera, també el −X.
function snapItem(it, corner = false) {
  const r = roomById(it.roomId); if (!r) return;
  const R = innerRect(r, state.wallThickness || 10);
  const dirs = (rot) => { const a = rot * DEG, c = Math.round(Math.cos(a)), sn = Math.round(Math.sin(a)); return { back: [-sn, -c], left: [-c, sn] }; };
  const same = (u, v) => u[0] === v[0] && u[1] === v[1];
  let best = null;
  if (corner) {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const cx = sx < 0 ? R.x0 : R.x1, cz = sz < 0 ? R.z0 : R.z1, dist = Math.hypot(it.x - cx, it.z - cz);
      for (const rot of [0, 90, 180, 270]) {
        const { back, left } = dirs(rot);
        const ok = (same(back, [sx, 0]) && same(left, [0, sz])) || (same(back, [0, sz]) && same(left, [sx, 0]));
        if (ok && (!best || dist < best.dist)) best = { dist, rot, sx, sz };
      }
    }
    if (!best) return;
    it.rot = best.rot;
    const b = aabb({ ...it, x: 0, z: 0 });
    it.x = Math.round(best.sx < 0 ? R.x0 - b.x0 : R.x1 - b.x1); it.z = Math.round(best.sz < 0 ? R.z0 - b.z0 : R.z1 - b.z1);
    return;
  }
  const walls = [{ out: [-1, 0], d: it.x - R.x0 }, { out: [1, 0], d: R.x1 - it.x }, { out: [0, -1], d: it.z - R.z0 }, { out: [0, 1], d: R.z1 - it.z }];
  walls.sort((a, b) => a.d - b.d);
  const w = walls[0];
  it.rot = [0, 90, 180, 270].find((rot) => same(dirs(rot).back, w.out));
  const b = aabb({ ...it, x: 0, z: 0 });
  if (w.out[0]) { it.x = Math.round(w.out[0] < 0 ? R.x0 - b.x0 : R.x1 - b.x1); it.z = Math.round(Math.min(R.z1 - b.z1, Math.max(R.z0 - b.z0, it.z))); }
  else { it.z = Math.round(w.out[1] < 0 ? R.z0 - b.z0 : R.z1 - b.z1); it.x = Math.round(Math.min(R.x1 - b.x1, Math.max(R.x0 - b.x0, it.x))); }
}
// Distància del moble a la paret més propera de la seva habitació.
function nearWall(it) {
  const r = roomById(it.roomId); if (!r) return Infinity;
  const R = innerRect(r, state.wallThickness || 10), b = aabb(it);
  return Math.min(b.x0 - R.x0, R.x1 - b.x1, b.z0 - R.z0, R.z1 - b.z1);
}
function duplicate(it) {
  commit();
  const c = { ...clone(it), id: newItem(it.type).id, x: it.x + 20, z: it.z + 20, locked: false };
  state.items.push(c);
  save(); rebuildItems(); select(c.id);
}

function removeItem(id, ask = true) {
  const it = itemById(id);
  if (!it) return;
  if (ask && +prefs.confirmDel && !confirm(`Eliminar «${it.name}»?`)) return;
  commit();
  state.items = state.items.filter((i) => i.id !== id);
  if (id.startsWith('fix-')) (state.removedFixed ||= []).push(id); // perquè una actualització del plànol no el torni a posar
  if (ui.selected === id) ui.selected = null;
  save(); rebuildItems(); renderAll();
}

// Coloca un mueble nuevo en un sitio libre de la habitación.
function findFreeSpot(it, room) {
  const t = state.wallThickness || 10;
  const R = innerRect(room, t);
  const y0 = it.elev || 0, y1 = y0 + it.h, vert = (o) => (o.elev || 0) < y1 && y0 < (o.elev || 0) + o.h; // només els que són a la mateixa alçada
  const others = state.items.filter((o) => o.roomId === room.id && o.id !== it.id && o.type !== 'alfombra' && vert(o)).concat(structItems(state.rooms).filter((s) => s.roomId === room.id && (s.kind === 'pillar' || (it.elev || 0) + it.h > s.h0)));
  const cx = (R.x0 + R.x1) / 2, cz = (R.z0 + R.z1) / 2;
  let best = { x: cx, z: cz }, bestScore = Infinity;
  for (let gx = R.x0 + it.w / 2; gx <= R.x1 - it.w / 2 + 0.1; gx += 10) {
    for (let gz = R.z0 + it.d / 2; gz <= R.z1 - it.d / 2 + 0.1; gz += 10) {
      const cand = { ...it, x: gx, z: gz };
      const hit = others.some((o) => overlaps(cand, o, 2));
      const s = (hit ? 1e6 : 0) + Math.hypot(gx - cx, gz - cz);
      if (s < bestScore) { bestScore = s; best = { x: gx, z: gz }; }
    }
  }
  return best;
}

function addItems(type, props, qty, roomId) {
  const room = roomById(roomId) || usableRooms()[0];
  commit();
  let last = null;
  const added = [];
  for (let i = 0; i < qty; i++) {
    const it = newItem(type, { ...props, roomId: room.id });
    added.push(it);
    if (qty > 1) it.name = `${props.name || CATALOG[type].label} ${i + 1}`;
    const p = findFreeSpot(it, room);
    it.x = Math.round(p.x); it.z = Math.round(p.z);
    if (CATALOG[type]?.mount) snapItem(it); // quadres, prestatges, cortines…: directes a la paret
    state.items.push(it);
    last = it;
  }
  save(); rebuildItems();
  if (last) select(last.id);
  renderAll();
  return added;
}
// Mou un moble a una altra habitació, a un lloc lliure. Torna false si no hi cap.
function moveItem(id, roomId) {
  const it = itemById(id), room = roomById(roomId);
  if (!it || !room) return false;
  const t = state.wallThickness || 10, R = innerRect(room, t);
  if (Math.min(it.w, it.d) > Math.min(R.x1 - R.x0, R.z1 - R.z0) || Math.max(it.w, it.d) > Math.max(R.x1 - R.x0, R.z1 - R.z0)) return false;
  commit();
  it.roomId = room.id;
  const p = findFreeSpot(it, room);
  it.x = Math.round(p.x); it.z = Math.round(p.z);
  save(); rebuildItems(); select(it.id); renderAll();
  return true;
}

// ---------------------------------------------------------------- UI
const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const roomOptions = (sel) => usableRooms().map((r) => `<option value="${r.id}" ${r.id === sel ? 'selected' : ''}>${esc(r.name)}</option>`).join('');

// Panell lateral (a sota al mòbil): plegable perquè el mapa ocupi tota la pantalla. Tocar la pestanya activa el plega; qualsevol pestanya el desplega.
function setSideCollapsed(on) {
  document.body.classList.toggle('side-collapsed', !!on);
  try { localStorage.setItem('planta3d-side', on ? '1' : '0'); } catch (e) { /* res */ }
  requestAnimationFrame(resize);
}
let sideSaved = null;
try { sideSaved = localStorage.getItem('planta3d-side'); } catch (e) { /* res */ }
if (isMobile() && sideSaved !== '0') document.body.classList.add('side-collapsed');
document.getElementById('side-toggle')?.addEventListener('click', () => setSideCollapsed(!document.body.classList.contains('side-collapsed')));
document.querySelectorAll('.tabs button[data-tab]').forEach((b) => b.addEventListener('click', () => {
  if (isMobile() && b.classList.contains('active') && !document.body.classList.contains('side-collapsed')) { setSideCollapsed(true); return; }
  document.querySelectorAll('.tabs button[data-tab]').forEach((x) => x.classList.toggle('active', x === b));
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.id === 'tab-' + b.dataset.tab));
  if (document.body.classList.contains('side-collapsed')) setSideCollapsed(false);
}));

document.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
$('#wallMode').addEventListener('change', (e) => { ui.wallMode = e.target.value; rebuildPlan(); syncMobileBar(); });
$('#snap')?.addEventListener('change', (e) => { ui.snap = e.target.checked; }); // l'imant de 5 cm queda actiu sense botó
$('#labels').addEventListener('change', (e) => { ui.labels = e.target.checked; rebuildPlan(); syncMobileBar(); });
$('#measures').addEventListener('change', (e) => { ui.measures = e.target.checked; updateOverlays(); syncMobileBar(); });
// Botons d'icona del mòbil: fan el mateix que els controls d'escriptori.
const WALL_CYCLE = { low: 'full', full: 'none', none: 'low' };
const WALL_ICON = { low: '🧱', full: '🏠', none: '▢' };
const WALL_TEXT = { low: 'Parets baixes', full: 'Parets completes', none: 'Parets amagades' };
function syncMobileBar() {
  const w = $('#wallBtn'); if (w) { w.textContent = WALL_ICON[ui.wallMode] || '🧱'; w.title = WALL_TEXT[ui.wallMode] + ' · toca per canviar'; }
  for (const [id, on] of [['#labelsBtn', ui.labels], ['#measBtn', ui.measures]]) { const b = $(id); if (b) { b.classList.toggle('active', !!on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); } }
}
$('#wallBtn')?.addEventListener('click', () => { ui.wallMode = WALL_CYCLE[ui.wallMode] || 'low'; $('#wallMode').value = ui.wallMode; rebuildPlan(); syncMobileBar(); toast(WALL_TEXT[ui.wallMode]); });
$('#labelsBtn')?.addEventListener('click', () => { const c = $('#labels'); c.checked = !c.checked; c.dispatchEvent(new Event('change')); });
$('#measBtn')?.addEventListener('click', () => { const c = $('#measures'); c.checked = !c.checked; c.dispatchEvent(new Event('change')); });
$('#tapeBtn')?.addEventListener('click', () => setTape(!tape.active));
$('#zonesBtn')?.addEventListener('click', () => setZones(!ui.zones));
// Estil «menú flotant»: el botó rodó obre i tanca la barra; mostra la vista actual i es tanca en tocar el plànol o canviar de vista.
const tbFab = $('#tb-fab');
const fabOpen = (on) => { $('#toolbar').classList.toggle('open', on); tbFab?.setAttribute('aria-expanded', on ? 'true' : 'false'); if (tbFab) tbFab.querySelector('.i').textContent = on ? '✕' : '☰'; };
tbFab?.addEventListener('click', () => fabOpen(!$('#toolbar').classList.contains('open')));
renderer.domElement.addEventListener('pointerdown', () => { if ($('#toolbar').classList.contains('open')) fabOpen(false); });
document.querySelectorAll('#toolbar [data-view]').forEach((b) => b.addEventListener('click', () => fabOpen(false)));
syncMobileBar();

// Barra del passeig: botons per caminar (mantenir premut) i giroscopi.
document.querySelectorAll('#walkbar [data-walk]').forEach((b) => {
  const k = b.dataset.walk;
  const on = (e) => { e.preventDefault(); walk.keys.add(k); requestRender(); };
  const off = () => walk.keys.delete(k);
  b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('pointerleave', off);
});
document.getElementById('wk-gyro').addEventListener('click', toggleGyro);
// Joystick (mòbil): arrossega el polze en qualsevol direcció per caminar; com més lluny del centre, més ràpid.
{
  const joy = document.getElementById('wk-joy'), knob = joy?.querySelector('span');
  if (joy) {
    const end = () => { walk.joy = null; knob.style.transform = ''; };
    const move = (e) => {
      const r = joy.getBoundingClientRect(), R = r.width / 2;
      let dx = e.clientX - (r.left + R), dy = e.clientY - (r.top + R); const L = Math.hypot(dx, dy);
      if (L > R) { dx *= R / L; dy *= R / L; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      const dz = 0.12; const n = (v) => (Math.abs(v) < dz ? 0 : v);
      walk.joy = { f: n(-dy / R), s: n(dx / R) }; walk.target = null; requestRender();
    };
    joy.addEventListener('pointerdown', (e) => { e.preventDefault(); try { joy.setPointerCapture(e.pointerId); } catch (err) { /* res */ } move(e); });
    joy.addEventListener('pointermove', (e) => { if (walk.joy || e.buttons) move(e); });
    joy.addEventListener('pointerup', end); joy.addEventListener('pointercancel', end);
  }
}
document.getElementById('wk-room')?.addEventListener('change', (e) => { walkToRoom(roomById(e.target.value)); e.target.value = ''; });
document.getElementById('wk-maptog')?.addEventListener('click', () => { const cv = document.getElementById('wk-map'); cv.hidden = !cv.hidden; document.getElementById('wk-maptog').classList.toggle('on', !cv.hidden); drawMinimap(); });
document.getElementById('wk-map')?.addEventListener('pointerdown', (e) => {
  const cv = e.currentTarget, r = cv.getBoundingClientRect();
  const x = ((e.clientX - r.left) * cv.width / r.width - minimap.ox) / minimap.s, z = ((e.clientY - r.top) * cv.height / r.height - minimap.oz) / minimap.s;
  const room = roomAt(state.rooms, x, z);
  if (room && !STRUCT.has(room.kind) && room.kind !== 'void') { walk.x = x; walk.z = z; walk.target = null; requestRender(); drawMinimap(); }
});
document.getElementById('wk-exit').addEventListener('click', () => setView('3d'));
const openMeasure = initMeasure();
const openPhotoAdd = initPhotoAdd({ roomOptions: () => roomOptions(addForm.roomId), toast, addItems, saveToCatalog, openMeasure, shrinkImage, log: (t) => console.warn(t) });

// Barra flotant (mòbil) per al moble seleccionat.
const selbar = document.getElementById('selbar');
selbar.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
  const it = itemById(ui.selected);
  if (!it) return;
  const act = b.dataset.act;
  if (act === 'props') { ui.propsOpen = !ui.propsOpen; renderProps(); return; }
  if (act === 'multi') { ui.multiMode = !ui.multiMode; updateSelbar(); toast(ui.multiMode ? '☐+ Toca més mobles per afegir-los (o treure’ls) de la selecció.' : 'Selecció normal.'); return; }
  if (it.locked && act !== 'dup' && selIds().length === 1) return;
  if (act === 'rl') rotateSel(-90);
  else if (act === 'rr') rotateSel(90);
  else if (act === 'dup') duplicateSel();
  else if (act === 'del') removeSel();
}));
function updateSelbar() {
  const it = itemById(ui.selected);
  selbar.hidden = !it;
  if (!it) ui.multiMode = false;
  selbar.querySelector('[data-act=props]').classList.toggle('on', ui.propsOpen);
  selbar.querySelector('[data-act=multi]')?.classList.toggle('on', !!ui.multiMode);
  const n = selIds().length, c = selbar.querySelector('[data-act=multi] b'); if (c) c.textContent = n > 1 ? n : '';
}
$('#undo').addEventListener('click', undo);
$('#redo').addEventListener('click', redo);

// Finestra d'informació senzilla (resultats de «Hi passa?», etc.).
function showInfo(title, html) {
  let m = document.getElementById('infodlg');
  if (!m) {
    m = document.createElement('div'); m.id = 'infodlg'; m.className = 'modal'; m.hidden = true;
    m.innerHTML = '<div class="gate-card wide"><div class="modal-head"><h1></h1><button type="button" class="close" aria-label="Tanca">×</button></div><div class="modal-body"></div></div>';
    document.body.appendChild(m);
    m.querySelector('.close').addEventListener('click', () => { m.hidden = true; });
    m.addEventListener('click', (e) => { if (e.target === m) m.hidden = true; });
  }
  m.querySelector('h1').textContent = title; m.querySelector('.modal-body').innerHTML = html; m.hidden = false;
  return m;
}
// «🚪 Hi passa?»: el camí des de la porta del pis fins a l'habitació, porta a porta.
function showFit(src, roomId) {
  const r = fitCheck({ w: src.w, d: src.d, h: src.h }, roomId, state);
  const head = { si: ['ok', '✓ Hi passa'], just: ['warn', '⚠ Molt just: segurament caldrà inclinar-lo o desmuntar-lo'], no: ['bad', '✗ No hi passa'] }[r.verdict];
  showInfo(`🚪 Hi passa? · ${src.name}`, `
    <p class="fit-verdict ${head[0]}">${head[1]}</p>
    <p class="note">${esc(src.name)} (${src.w} × ${src.d} × ${src.h} cm) fins a ${esc(roomById(roomId)?.name || '')}${r.path.length ? `: ${r.path.map(esc).join(' → ')}` : ''}.</p>
    <ul class="fit-steps">${r.steps.map((x) => `<li class="${x.ok === true ? 'ok' : x.ok === 'just' ? 'warn' : 'bad'}">${x.ok === true ? '✓' : x.ok === 'just' ? '⚠' : '✗'} ${esc(x.text)}</li>`).join('')}</ul>
    <p class="note">Càlcul aproximat: prova el moble pla, de cantó i dret, i en els girs dels passadissos fa servir la cantonada entre dos passadissos. No té en compte l’escala de l’edifici ni els poms de les portes. Si queda just, mesura’l de debò.</p>`);
  return r;
}

// --- Pestaña Muebles
const addForm = { type: 'silla', qty: 1, roomId: 'salon', ...CATALOG.silla, name: CATALOG.silla.label, elev: 0 };

function renderMuebles() {
  const el = $('#tab-muebles');
  const f = addForm;
  if (!roomById(f.roomId)) f.roomId = usableRooms()[0]?.id;
  el.innerHTML = `
    <h2>Crea un moble</h2>
    <div class="row c2">
      <label>Tipus<select id="f-type">${Object.entries(CATALOG).map(([k, v]) => `<option value="${k}" ${k === f.type ? 'selected' : ''}>${v.label}</option>`).join('')}</select></label>
      <label>Nom<input type="text" id="f-name" value="${esc(f.name)}" /></label>
    </div>
    <div class="row c3">
      <label>Amplada (cm)<input type="number" id="f-w" min="1" value="${f.w}" /></label>
      <label>Fons (cm)<input type="number" id="f-d" min="1" value="${f.d}" /></label>
      <label>Alçada (cm)<input type="number" id="f-h" min="1" value="${f.h}" /></label>
    </div>
    <div class="row c3">
      <label>Elevació<input type="number" id="f-elev" min="0" value="${f.elev || 0}" title="Alçada des del terra, per exemple una TV penjada" /></label>
      <label>Color<input type="color" id="f-color" value="${f.color}" /></label>
      <label>Quantitat<input type="number" id="f-qty" min="1" max="30" value="${f.qty}" /></label>
    </div>
    <div class="row"><label>Habitació<select id="f-room">${roomOptions(f.roomId)}</select></label></div>
    <div class="btns"><button class="btn" id="f-add">Afegeix al plànol</button><button class="btn secondary" id="f-photo" title="Fes o tria una foto del moble amb les mides: les llegeixo i l’afegeixo al plànol">📷 Des d’una foto</button><button class="btn secondary" id="f-save-cat" title="Guarda aquest moble a «Els meus mobles» per tornar-lo a afegir d’un toc, quan vulguis i a qualsevol habitació">★ Desa a «Els meus mobles»</button></div>
    <p class="note">Exemple ràpid: <button class="btn secondary small" id="f-example">2 cadires + 2 taules + TV</button> a l’habitació triada.</p>
    <h2>Els meus mobles</h2>
    <div id="catalog"></div>
    <h2>Al plànol</h2>
    <div id="item-list"></div>`;
  const read = () => {
    f.name = $('#f-name').value; f.w = +$('#f-w').value || 1; f.d = +$('#f-d').value || 1; f.h = +$('#f-h').value || 1;
    f.elev = +$('#f-elev').value || 0; f.color = $('#f-color').value; f.qty = Math.max(1, Math.min(30, +$('#f-qty').value || 1)); f.roomId = $('#f-room').value;
  };
  el.querySelectorAll('input, select').forEach((i) => i.addEventListener('change', read));
  $('#f-type').addEventListener('change', (e) => {
    const c = CATALOG[e.target.value];
    Object.assign(f, { type: e.target.value, name: c.label, w: c.w, d: c.d, h: c.h, color: c.color, elev: c.elev || 0 });
    renderMuebles();
  });
  $('#f-add').addEventListener('click', () => {
    read();
    addItems(f.type, { name: f.name, w: f.w, d: f.d, h: f.h, elev: f.elev, color: f.color }, f.qty, f.roomId);
  });
  $('#f-example').addEventListener('click', () => {
    read();
    const room = f.roomId;
    addItems('mesa', { name: 'Taula' }, 2, room);
    addItems('silla', { name: 'Cadira' }, 2, room);
    addItems('tv', { name: 'Televisor' }, 1, room);
  });
  $('#f-save-cat').addEventListener('click', () => { read(); saveToCatalog({ type: f.type, name: f.name, w: f.w, d: f.d, h: f.h, elev: f.elev, color: f.color }); });
  $('#f-photo').addEventListener('click', () => { read(); openPhotoAdd(f.roomId); });
  renderCatalog();
  renderItemList();
}

// --- Catàleg dels mobles reals (es desa al núvol amb el plànol)
// «Els meus mobles»: una llista de mobles propis (o vistos a la botiga) amb nom, mides, color, foto i enllaç,
// per tornar-los a afegir al plànol d'un toc quan es vulgui. Es desa amb el plànol (també al núvol).
async function saveToCatalog(src, file = null) {
  let photo = '';
  if (file) { try { photo = await shrinkImage(file, cfgGet('catalogPhoto'), 0.72); } catch (e) { /* sense foto */ } }
  commit();
  const id = 'c' + Math.random().toString(36).slice(2, 8);
  (state.catalog ||= []).push({ id, type: src.type, name: src.name, w: src.w, d: src.d, h: src.h, elev: src.elev || 0, color: src.color, url: '', photo });
  save(); renderCatalog();
  toast(`★ «${src.name}» desat a Els meus mobles.`);
  return id;
}
function renderCatalog() {
  const el = $('#catalog');
  if (!el) return;
  const cat = state.catalog || [];
  if (!cat.length) { el.innerHTML = '<p class="note">Aquí es guarden els vostres mobles (els que ja teniu o els que mireu a la botiga) amb el nom, les mides, el color i una foto, per afegir-los al plànol d’un sol toc quan vulgueu, a qualsevol habitació i tantes vegades com calgui. S’hi desen amb «★ Desa a Els meus mobles» (del formulari de dalt o d’un moble ja col·locat) i, automàticament, amb «📷 Des d’una foto».</p>'; return; }
  el.innerHTML = `<div class="cat">${cat.map((c) => `
    <div class="cat-card" data-id="${c.id}">
      <label class="cat-photo" title="Toca per posar o canviar la foto">${c.photo ? `<img src="${c.photo}" alt="" />` : '<span>📷</span>'}<input type="file" accept="image/*" hidden /></label>
      <div class="cat-body">
        <input type="text" class="cat-name" value="${esc(c.name)}" title="Nom" />
        <div class="dm">${esc(CATALOG[c.type]?.label || c.type)} · ${c.w}×${c.d}×${c.h}</div>
        <label class="dm cat-price">Preu <input type="number" min="0" step="1" value="${+c.price || ''}" placeholder="—" /> €</label>
        ${c.url ? `<a href="${esc(c.url)}" target="_blank" rel="noopener" class="dm">🔗 enllaç</a>` : ''}
        <div class="btns"><button class="btn small" data-cat-add>Afegeix</button><button class="btn secondary small" data-cat-fit title="Hi passa per les portes fins a l’habitació triada a dalt?">🚪</button><button class="btn secondary small" data-cat-link title="Enllaç a la botiga">🔗</button><button class="btn danger small" data-cat-del title="Treu del catàleg">×</button></div>
      </div>
    </div>`).join('')}</div>`;
  el.querySelectorAll('.cat-card').forEach((card) => {
    const c = cat.find((x) => x.id === card.dataset.id);
    card.querySelector('[data-cat-add]').addEventListener('click', () => addItems(c.type, { name: c.name, w: c.w, d: c.d, h: c.h, elev: c.elev, color: c.color, catalogId: c.id, photoLook: c.photo ? true : undefined, price: c.price, url: c.url || undefined }, 1, addForm.roomId));
    card.querySelector('[data-cat-fit]').addEventListener('click', () => showFit(c, addForm.roomId));
    card.querySelector('[data-cat-del]').addEventListener('click', () => { commit(); state.catalog = cat.filter((x) => x !== c); save(); renderCatalog(); });
    card.querySelector('[data-cat-link]').addEventListener('click', () => { const u = prompt('Enllaç del moble (botiga, foto, PDF…):', c.url || ''); if (u === null) return; commit(); c.url = u.trim(); save(); renderCatalog(); });
    card.querySelector('.cat-name').addEventListener('change', (e) => { commit(); c.name = e.target.value; save(); });
    card.querySelector('.cat-price input').addEventListener('change', (e) => { commit(); const v = Math.max(0, +e.target.value || 0); if (v) c.price = v; else delete c.price; save(); });
    card.querySelector('input[type=file]').addEventListener('change', async (e) => {
      const file = e.target.files[0]; if (!file) return;
      try { commit(); c.photo = await shrinkImage(file, cfgGet('catalogPhoto'), 0.72); save(); renderCatalog(); } catch (err) { /* res */ }
    });
  });
}
// Redueix una foto a una miniatura JPEG petita (per no omplir el document del núvol).
function shrinkImage(file, max = 180, q = 0.72) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL('image/jpeg', q));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

function renderItemList() {
  const el = $('#item-list');
  if (!el) return;
  if (!state.items.length) { el.innerHTML = '<p class="note">Encara no hi ha mobles. Crea’n un a dalt i apareixerà a l’habitació triada.</p>'; return; }
  const bad = ui.conflicts || new Map();
  el.innerHTML = usableRooms().map((r) => {
    const its = state.items.filter((i) => i.roomId === r.id);
    if (!its.length) return '';
    return `<h2>${esc(r.name)}</h2><ul class="list">${its.map((i) => `
      <li data-id="${i.id}" class="${selIds().includes(i.id) ? 'sel' : ''}">
        <span class="sw" style="background:${esc(i.color)}"></span>
        <span class="nm">${esc(i.name)}${i.locked ? ' 🔒' : ''}</span>
        ${bad.has(i.id) ? `<span class="badge bad" title="${esc(bad.get(i.id))}">xoc</span>` : ''}
        ${ui.zoneBad?.has(i.id) ? `<span class="badge warn" title="${esc(ui.zoneBad.get(i.id).map((r) => `${r.label}: cal ${r.need} cm, n’hi ha ${r.have}`).join(' · '))}">pas</span>` : ''}
        ${i.notes?.length ? `<span class="badge" title="${esc(i.notes.map((n) => `${n.who}: ${n.text}`).join('\n'))}">💬${i.notes.length}</span>` : ''}
        ${Object.values(i.votes || {}).some((v) => v > 0) ? `<span class="badge" title="Vots">👍${Object.values(i.votes).filter((v) => v > 0).length}</span>` : ''}
        <span class="dm">${i.w}×${i.d}×${i.h}</span>
      </li>`).join('')}</ul>`;
  }).join('') + (state.items.some((i) => !roomById(i.roomId)) ? '<p class="note">Hi ha mobles fora de qualsevol habitació.</p>' : '');
  el.querySelectorAll('li[data-id]').forEach((li) => li.addEventListener('click', (e) => select(li.dataset.id, e.shiftKey || e.ctrlKey || e.metaKey || !!ui.multiMode)));
}

// --- Panel de propiedades del mueble seleccionado
// Camp numèric amb botons − / + per canviar la mida de pressa.
const stepper = (id, v, min = 1) => `<span class="num"><button type="button" data-step="-5" tabindex="-1">−</button><input type="number" id="${id}" min="${min}" value="${v}" /><button type="button" data-step="5" tabindex="-1">+</button></span>`;
// Icona SVG petita de cada forma (vista en planta, esquena a dalt).
function shapeIcon(k) {
  const p = { recte: 'M2 4h20v8H2z', rect: 'M2 4h20v12H2z', rodona: 'M12 3a9 7 0 1 0 0.01 0z', Le: 'M2 4h20v8H10v8H2z', Ld: 'M2 4h20v16h-8v-8H2z', U: 'M2 4h20v16h-6v-8H8v8H2z',
    paret: 'M3 4h18v16h-5v-7H8v7H3z', cantonera: 'M3 3h18v7L10 21H3z', estufa: 'M10 2h4v7h3v11h-2v2h-2v-2h-2v2H9v-2H7V9h3z', electrica: 'M2 8h20v8H2zM5 11h14v2H5z' };
  return `<svg viewBox="0 0 24 24" width="26" height="26"><path d="${p[k] || p.rect}" fill="currentColor" opacity=".85"/></svg>`;
}
function renderGroupProps(ids) {
  const el = $('#props'), its = ids.map(itemById);
  el.hidden = false;
  el.classList.toggle('collapsed', isMobile() && !ui.propsOpen);
  el.dataset.id = 'multi';
  const grouped = its.every((o) => o.group && o.group === its[0].group);
  el.innerHTML = `
    <h3>${its.length} mobles triats ${grouped ? '<span class="badge">🔗 grup</span>' : ''}<button class="close" id="p-close" title="Tanca">×</button></h3>
    <div class="chips">${its.map((o) => `<button type="button" class="chip" data-id="${o.id}" title="Treu-lo de la selecció">${esc(o.name)}${o.locked ? ' 🔒' : ''} ×</button>`).join('')}</div>
    <div class="btns">
      <button class="btn small" id="g-group">${grouped ? '⛓ Desagrupa' : '🔗 Agrupa'}</button>
      <button class="btn secondary small" id="g-rl">⟲ 90°</button>
      <button class="btn secondary small" id="g-rr">⟳ 90°</button>
      <button class="btn secondary small" id="g-dup">Duplica</button>
      <button class="btn danger small" id="g-del">Elimina</button>
    </div>
    <div class="lbl">Alinea</div>
    <div class="btns al">
      <button class="btn secondary small" data-al="x0" title="Alinea les vores de l’esquerra">⇤ Esq.</button>
      <button class="btn secondary small" data-al="xc" title="Centra en horitzontal">↔ Centre</button>
      <button class="btn secondary small" data-al="x1" title="Alinea les vores de la dreta">⇥ Dreta</button>
      <button class="btn secondary small" data-al="z0" title="Alinea les vores de dalt">⤒ Dalt</button>
      <button class="btn secondary small" data-al="zc" title="Centra en vertical">↕ Mig</button>
      <button class="btn secondary small" data-al="z1" title="Alinea les vores de baix">⤓ Baix</button>
      ${its.length >= 3 ? '<button class="btn secondary small" data-al="dx" title="Mateixa distància entre ells, d’esquerra a dreta">Reparteix ↔</button><button class="btn secondary small" data-al="dz" title="Mateixa distància entre ells, de dalt a baix">Reparteix ↕</button>' : ''}
    </div>
    <div class="row"><label>Porta’ls a<select id="g-room"><option value="">Tria una habitació…</option>${roomOptions('')}</select></label></div>
    <p class="note">Maj o Ctrl + clic (al mòbil, ☐+ a la barra) per afegir o treure mobles. Agrupats, es trien i es mouen junts. Ctrl+G agrupa.</p>`;
  $('#p-close').addEventListener('click', () => select(null));
  el.querySelectorAll('.chip').forEach((b) => b.addEventListener('click', () => select(b.dataset.id, true)));
  $('#g-group').addEventListener('click', () => groupSel(!grouped));
  $('#g-rl').addEventListener('click', () => rotateSel(-90));
  $('#g-rr').addEventListener('click', () => rotateSel(90));
  $('#g-dup').addEventListener('click', duplicateSel);
  $('#g-del').addEventListener('click', removeSel);
  el.querySelectorAll('[data-al]').forEach((b) => b.addEventListener('click', () => alignSel(b.dataset.al)));
  $('#g-room').addEventListener('change', (e) => { if (e.target.value) moveSelToRoom(e.target.value); });
}
function renderProps(onlyPos = false) {
  const el = $('#props');
  const it = itemById(ui.selected);
  updateSelbar();
  if (!it) { el.hidden = true; return; }
  if (selIds().length > 1) { if (!onlyPos || el.dataset.id !== 'multi') renderGroupProps(selIds()); return; }
  if (onlyPos && !el.hidden && el.dataset.id === it.id) {
    $('#p-x').value = it.x; $('#p-z').value = it.z;
    const dl = $('#p-dist'); if (dl) dl.innerHTML = distHtml(it);
    const zl = $('#p-zones'); if (zl) zl.innerHTML = zonesHtml(it);
    return;
  }
  el.hidden = false;
  el.classList.toggle('collapsed', isMobile() && !ui.propsOpen);
  el.dataset.id = it.id;
  const bad = ui.conflicts?.get(it.id);
  el.innerHTML = `
    <h3><span class="sw" style="width:14px;height:14px;border-radius:3px;background:${esc(it.color)}"></span>${esc(it.name)} ${bad ? `<span class="badge bad">${esc(bad)}</span>` : ''}<button class="close" id="p-close" title="Tanca">×</button></h3>
    ${(() => { const ph = photoOf(it); return ph ? `<img class="p-photo" src="${ph}" alt="Foto del moble" />` : ''; })()}
    <div class="p-photo-row">
      <label class="btn secondary small" title="Posa una foto a aquest moble (per exemple, la del quadre o la del sofà real)">📷 ${photoOf(it) ? 'Canvia la foto' : 'Posa-hi una foto'}<input type="file" id="p-photo" accept="image/*" hidden /></label>
      ${photoOf(it) && it.type !== 'quadre' ? `<label class="chk"><input type="checkbox" id="p-look" ${it.photoLook ? 'checked' : ''}/> Mostra la foto al moble</label>` : ''}
      ${it.photo ? '<button type="button" class="btn secondary small" id="p-photo-del" title="Treu la foto d’aquest moble">Treu la foto</button>' : ''}
    </div>
    <div class="dist" id="p-dist">${distHtml(it)}</div>
    <div id="p-zones">${zonesHtml(it)}</div>
    <div class="row c2">
      <label>Nom<input type="text" id="p-name" value="${esc(it.name)}" /></label>
      <label>Tipus<select id="p-type">${Object.entries(CATALOG).map(([k, v]) => `<option value="${k}" ${k === it.type ? 'selected' : ''}>${v.label}</option>`).join('')}</select></label>
    </div>
    ${SHAPES[it.type] ? `<div class="shape" id="p-shape">${SHAPES[it.type].map(([k, l], i) => `<button type="button" class="${(it.shape || SHAPES[it.type][0][0]) === k ? 'on' : ''}" data-shape="${k}" title="${l}">${shapeIcon(k)}<small>${l}</small></button>`).join('')}</div>` : ''}
    <div class="row c3">
      <label>Amplada${stepper('p-w', it.w)}</label>
      <label>Fons${stepper('p-d', it.d)}</label>
      <label>Alçada${stepper('p-h', it.h)}</label>
    </div>
    ${shapeParams(it.type, it.shape).length ? `<div class="row c2">${shapeParams(it.type, it.shape).map(([k, l, dv]) => `<label>${l}${stepper('p-' + k, it[k] || dv)}</label>`).join('')}</div>` : ''}
    <div class="row c4">
      <label>X<input type="number" id="p-x" value="${it.x}" /></label>
      <label>Z<input type="number" id="p-z" value="${it.z}" /></label>
      <label>Gir °<input type="number" id="p-rot" step="15" value="${it.rot}" /></label>
      <label>Elev.<input type="number" id="p-elev" min="0" value="${it.elev || 0}" /></label>
    </div>
    <div class="row c2">
      <label>Color<input type="color" id="p-color" value="${it.color}" /></label>
      <label>Habitació<select id="p-room">${roomOptions(it.roomId)}</select></label>
    </div>
    <div class="row c2 p-shop">
      <label>Compra<select id="p-status">${STATUS.map(([k, l]) => `<option value="${k}" ${statusOf(it) === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label>Preu (€)<input type="number" id="p-price" min="0" step="1" value="${+it.price || ''}" placeholder="—" /></label>
    </div>
    <div class="row"><label>Enllaç de la botiga<input type="url" id="p-url" value="${esc(it.url || '')}" placeholder="https://…" /></label></div>
    <div id="p-social">${itemSocialHtml(it, whoAmI(), esc)}</div>
    <label style="flex-direction:row;align-items:center;gap:6px;margin:4px 0 8px"><input type="checkbox" id="p-lock" ${it.locked ? 'checked' : ''}/> Fix (no es mou a les propostes)</label>
    <div class="btns">
      <button class="btn secondary small" id="p-rl">⟲ 90°</button>
      <button class="btn secondary small" id="p-rr">⟳ 90°</button>
      <button class="btn secondary small" id="p-snap" title="${it.shape === 'cantonera' ? 'Porta’l a la cantonada més propera, amb l’esquena a les dues parets' : 'Enganxa’l d’esquena a la paret més propera'}">${it.shape === 'cantonera' ? '◢ A la cantonada' : '⇲ A la paret'}</button>
      <button class="btn secondary small" id="p-dup">Duplica</button>
      <button class="btn secondary small" id="p-cat" title="Desa al catàleg dels meus mobles">★</button>
      <button class="btn secondary small" id="p-fit" title="Comprova si el moble passa per les portes i els passadissos fins aquí">🚪 Hi passa?</button>
      <button class="btn secondary small" id="p-ar" title="Mira el moble a mida real a casa amb la càmera del mòbil" hidden>📱 Veure-ho a casa</button>
      <button class="btn danger small" id="p-del">Elimina</button>
    </div>`;
  const num = (id) => +$(id).value;
  const apply = (fn, rebuild) => { commit(); fn(); save(); updateItem(it, rebuild); renderProps(); renderItemList(); };
  bindItemSocial($('#p-social'), it, whoAmI(), (fn) => { commit(); fn(); save(); renderProps(); renderItemList(); });
  arSupported().then((ok) => { const b = $('#p-ar'); if (b) { b.hidden = !ok && !isMobile(); b.onclick = () => (ok ? startARView(it, { photo: photoOf(it), toast }) : showInfo('Realitat augmentada', '<p>Per veure el moble a mida real a casa cal un mòbil Android amb Chrome (i els Serveis de Google Play per a RA). A l’iPhone el navegador encara no ho permet.</p>')); } });
  $('#p-close').addEventListener('click', () => { if (isMobile()) { ui.propsOpen = false; renderProps(); } else select(null); });
  $('#p-name').addEventListener('change', (e) => apply(() => { it.name = e.target.value; }));
  $('#p-type').addEventListener('change', (e) => apply(() => { it.type = e.target.value; if (it.shape && !SHAPES[it.type]?.some(([k]) => k === it.shape)) { delete it.shape; for (const k of ['sd', 'lw', 'bw', 'bh']) delete it[k]; } }, true));
  for (const k of ['w', 'd', 'h']) $('#p-' + k).addEventListener('change', () => apply(() => { it[k] = Math.max(1, num('#p-' + k)); }, true));
  for (const [k] of shapeParams(it.type, it.shape)) $('#p-' + k)?.addEventListener('change', () => apply(() => { it[k] = Math.max(1, num('#p-' + k)); }, true));
  // Botons − / + de les mides: passos de 5 cm (10 amb el botó dret o mantenint Maj).
  for (const b of el.querySelectorAll('[data-step]')) b.addEventListener('click', (e) => {
    const inp = b.parentElement.querySelector('input'); const st = +b.dataset.step * (e.shiftKey ? 2 : 1);
    inp.value = Math.max(+inp.min || 1, (+inp.value || 0) + st); inp.dispatchEvent(new Event('change'));
  });
  for (const b of el.querySelectorAll('#p-shape button')) b.addEventListener('click', () => apply(() => {
    it.shape = b.dataset.shape;
    const preset = SHAPE_SIZES[it.type]?.[it.shape];
    if (preset) Object.assign(it, preset); // p. ex. una estufa és alta i estreta, una elèctrica es penja a la paret
    for (const [k, , dv] of shapeParams(it.type, it.shape)) if (!it[k]) it[k] = dv;
    if (hasWing(it.shape) && it.d < (it.sd || 0) + 40) it.d = (it.sd || 60) + 70;
    if (it.type === 'llarFoc' && it.shape === 'cantonera') snapItem(it, true); // la cantonera va directa a la cantonada més propera
  }, true));
  $('#p-x').addEventListener('change', () => apply(() => { it.x = num('#p-x'); }));
  $('#p-z').addEventListener('change', () => apply(() => { it.z = num('#p-z'); }));
  $('#p-rot').addEventListener('change', () => apply(() => { it.rot = ((num('#p-rot') % 360) + 360) % 360; }));
  $('#p-elev').addEventListener('change', () => apply(() => { it.elev = Math.max(0, num('#p-elev')); }));
  $('#p-color').addEventListener('change', (e) => apply(() => { it.color = e.target.value; }, true));
  $('#p-lock').addEventListener('change', (e) => apply(() => { it.locked = e.target.checked; }));
  $('#p-status').addEventListener('change', (e) => { apply(() => { if (e.target.value === 'tinc') delete it.status; else it.status = e.target.value; }); shop.render(); });
  $('#p-price').addEventListener('change', (e) => { apply(() => { const v = Math.max(0, +e.target.value || 0); if (v) it.price = v; else delete it.price; }); shop.render(); });
  $('#p-url').addEventListener('change', (e) => { apply(() => { const v = e.target.value.trim(); if (v) it.url = v; else delete it.url; }); shop.render(); });
  $('#p-photo').addEventListener('change', async (e) => {
    const file = e.target.files[0]; if (!file) return;
    try { const ph = await shrinkImage(file, Math.max(256, cfgGet('catalogPhoto')), 0.75); apply(() => { it.photo = ph; if (it.type !== 'quadre') it.photoLook = true; }, true); } catch (err) { toast('No he pogut llegir la foto.'); }
  });
  $('#p-look')?.addEventListener('change', (e) => apply(() => { it.photoLook = e.target.checked; }, true));
  $('#p-photo-del')?.addEventListener('click', () => apply(() => { delete it.photo; if (!photoOf(it)) delete it.photoLook; }, true));
  $('#p-room').addEventListener('change', (e) => apply(() => {
    it.roomId = e.target.value;
    const p = findFreeSpot(it, roomById(it.roomId));
    it.x = Math.round(p.x); it.z = Math.round(p.z);
  }));
  $('#p-rl').addEventListener('click', () => rotate(it, -90));
  $('#p-rr').addEventListener('click', () => rotate(it, 90));
  $('#p-dup').addEventListener('click', () => duplicate(it));
  $('#p-snap').addEventListener('click', () => apply(() => snapItem(it, it.shape === 'cantonera'), true));
  $('#p-cat').addEventListener('click', () => { saveToCatalog(it); document.querySelector('.tabs button[data-tab=muebles]')?.click(); });
  $('#p-del').addEventListener('click', () => removeItem(it.id));
  $('#p-fit').addEventListener('click', () => showFit(it, it.roomId));
}

// --- Pestaña Distribuir
// Equipament típic de cada estança, en variants, per proposar distribucions encara que no hi hagi cap moble
// (o per provar-ne una amb mobles diferents). [tipus, mides/nom opcionals, quantitat]
const normName = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
function roomKits(room) {
  const n = normName(room.name), minSide = Math.min(room.w, room.d), big = room.w * room.d > 120000;
  if (room.kind === 'terrace' || /terrassa|balco/.test(n)) return [
    [['silla', { name: 'Cadira exterior' }, 2], ['mesa', { w: 70, d: 70, name: 'Tauleta exterior' }], ['planta']],
    [['sillon', { w: 70, d: 70, name: 'Butaca exterior' }, 2], ['mesaCentro', { w: 60, d: 40 }], ['planta', {}, 2]],
  ];
  if (/menjador|sala|estar|salo/.test(n)) return [
    [['sofa', { w: Math.min(220, Math.round(minSide * 0.75)) }], ['muebleTv'], ['tv'], ['mesaCentro'], ['mesa', { w: 120, d: 80 }], ['silla', {}, 4]],
    [['sofa'], ['sillon'], ['muebleTv'], ['tv'], ['mesaCentro'], ['estanteria'], ['planta']],
    [['mesa', { w: big ? 160 : 140, d: 90 }], ['silla', {}, big ? 6 : 4], ['estanteria', { w: 120 }], ['sofa', { w: 180 }], ['tv'], ['muebleTv', { w: 120 }]],
    [['sofa', { w: 240, d: 160, shape: 'Ld', name: 'Sofà chaise longue' }], ['tv'], ['muebleTv', { w: 180 }], ['alfombra'], ['lampara'], ['mesaCentro', { w: 80, d: 80 }]],
  ];
  if (/dormitori|habitacio/.test(n)) return [
    [['cama', { w: 150, d: 200 }], ['mesita', {}, 2], ['comoda']],
    [['cama', { w: 160, d: 200 }], ['mesita', {}, 2], ['estanteria'], ['planta']],
    [['cama', { w: 135, d: 190 }], ['mesita'], ['escritorio', { w: 100, d: 50 }], ['silla']],
    [['cama', { w: 180, d: 200, name: 'Llit gran' }], ['mesita', {}, 2], ['sillon'], ['lampara']],
  ];
  if (/office|despatx|estudi/.test(n)) return [
    [['escritorio'], ['silla'], ['estanteria']],
    [['escritorio', { w: 140, d: 60 }], ['silla'], ['estanteria', {}, 2], ['sillon']],
    [['cama', { w: 90, d: 190, name: 'Llit individual' }], ['escritorio', { w: 100, d: 50 }], ['silla'], ['estanteria']],
    [['sofa', { w: 160, d: 80, name: 'Sofà llit' }], ['escritorio', { w: 110, d: 55 }], ['silla'], ['estanteria', { w: 60 }]],
  ];
  if (/cuina/.test(n)) return [
    [['mesa', { w: 120, d: 80 }], ['silla', {}, 4]],
    [['mesa', { w: 80, d: 80, name: 'Taula alta' }], ['silla', { name: 'Tamboret' }, 2], ['planta']],
    [['mesa', { w: 140, d: 80 }], ['silla', {}, 4], ['estanteria', { w: 60, d: 30, name: 'Rebost' }]],
  ];
  if (/passadis|rebedor|distribuidor|entrada/.test(n)) return [
    [['comoda', { w: 80, d: 35, name: 'Moble d’entrada' }], ['planta']],
    [['estanteria', { w: 60, d: 25, name: 'Sabater' }], ['planta']],
  ];
  if (/bany|lavabo|armari|traster|safareig/.test(n)) return [];
  return [[['mesa'], ['silla', {}, 2]], [['estanteria'], ['sillon'], ['planta']]];
}
// Crea els mobles d'un equipament dins d'una habitació (sense col·locar-los encara). Es descarten els que no hi caben.
function kitItems(room, kit) {
  const R = innerRect(room, state.wallThickness || 10), W = R.x1 - R.x0, D = R.z1 - R.z0;
  const out = [];
  for (const [type, over = {}, qty = 1] of kit) {
    for (let i = 0; i < qty; i++) {
      const it = newItem(type, { ...over, roomId: room.id });
      if (qty > 1) it.name = `${over.name || CATALOG[type].label} ${i + 1}`;
      if (Math.min(it.w, it.d) > Math.min(W, D) - 20 || Math.max(it.w, it.d) > Math.max(W, D) - 20 || it.h > (state.ceiling || 250)) continue;
      it.fromKit = true; it.x = room.x + room.w / 2; it.z = room.z + room.d / 2;
      out.push(it);
    }
  }
  return out;
}
const propHist = (id) => (ui.propHist[id] ||= { list: [], idx: -1 });
function roomItemsOf(id) { return state.items.filter((i) => i.roomId === id); }
// Substitueix els mobles d'una habitació per uns altres (queda a Desfés).
function setRoomItems(room, items) {
  commit();
  state.items = state.items.filter((i) => i.roomId !== room.id).concat(clone(items));
  if (ui.selected && !itemById(ui.selected)) ui.selected = null;
  save(); rebuildItems(); renderAll();
}
let propBusy = false;
// Objectius triats per a les propostes (es recorden en aquest dispositiu).
let goalSel = GOAL_DEFAULT;
try { const g = JSON.parse(localStorage.getItem('planta3d-goals') || 'null'); if (Array.isArray(g)) goalSel = g.filter((k) => GOALS.some((x) => x[0] === k)); } catch (e) { /* res */ }
const goalsHtml = (rep) => (rep?.length ? `<ul class="goal-rep">${rep.map((g) => `<li class="${g.ok ? 'ok' : 'bad'}">${g.ok ? '✓' : '✗'} <b>${esc(g.label)}</b>: ${esc(g.text)}</li>`).join('')}</ul>` : '');
async function generateProposal(room) {
  if (propBusy) return;
  const H = propHist(room.id), n = ui.propN[room.id] || 0;
  const cur = roomItemsOf(room.id);
  const kits = roomKits(room);
  const locked = cur.filter((i) => i.locked);
  let items, label;
  // Dues funcions: si l'estança ja té mobles (que es poden moure), només es tornen a col·locar, sense afegir ni treure res;
  // si no en té cap, es proposa un equipament típic i la seva col·locació.
  if (cur.length === locked.length) {
    if (!kits.length) { toast(`${room.name}: aquesta estança no necessita mobles. Afegeix-ne des de la pestanya Mobles si vols.`); return; }
    const k = (ui.propK[room.id] || 0) % kits.length; // cada cop un equipament diferent, en ordre
    ui.propK[room.id] = k + 1;
    items = locked.concat(kitItems(room, kits[k]));
    label = `Equipament ${k + 1} de ${kits.length}`;
  } else { items = clone(cur); label = 'Redistribució'; }
  if (!items.length) { toast('No hi ha mobles per col·locar.'); return; }
  ui.propN[room.id] = n + 1;
  propBusy = true;
  const btn = $('#d-gen'), prog = $('#d-prog');
  if (btn) btn.disabled = true; if (prog) prog.hidden = false;
  ui.seed = (ui.seed * 9301 + 49297) % 233280 + Date.now() % 1000;
  const show = (f) => { const p = $('#d-prog'); if (!p) return; p.querySelector('.bar').style.width = Math.round(f * 100) + '%'; p.querySelector('span').textContent = `Provant col·locacions… ${Math.round(f * 100)} %`; };
  show(0);
  let props = [];
  try {
    props = await generateLayoutsAsync(room, items, state.rooms, { wallThickness: state.wallThickness, seed: ui.seed, count: cfgGet('count'), tries: cfgGet('tries'), clear: cfgGet('clear'), gapMin: cfgGet('gapMin'), goals: goalSel }, show);
  } finally { propBusy = false; }
  if (!props.length) { toast('No he trobat cap col·locació que hi càpiga. Prova amb menys mobles.'); renderDistribuir(); return; }
  const best = props[0];
  const placed = applyPlacements(items, best.placements);
  H.list.length = H.idx + 1;
  H.list.push({ name: `${label} · ${best.rating}`, goals: best.goals, items: placed, alts: props.slice(1).map((p) => ({ name: p.name, rating: p.rating, goals: p.goals, placements: p.placements })), base: items });
  if (H.list.length > 30) H.list.shift();
  H.idx = H.list.length - 1;
  setRoomItems(room, placed);
  frameCamera(room);
}
function renderDistribuir() {
  const el = $('#tab-distribuir');
  if (!roomById(ui.layoutRoom)) {
    const sel = itemById(ui.selected);
    ui.layoutRoom = ((sel && roomById(sel.roomId)) || usableRooms().find((r) => state.items.some((i) => i.roomId === r.id)) || usableRooms()[0])?.id;
  }
  const room = roomById(ui.layoutRoom);
  const its = roomItemsOf(ui.layoutRoom);
  const locked = its.filter((i) => i.locked).length;
  const movable = its.length - locked;
  const kits = roomKits(room);
  const H = propHist(room.id);
  const snap = H.idx >= 0 ? H.list[H.idx] : null;
  const furnish = !movable; // estança sense mobles mòbils → es proposen mobles nous
  el.innerHTML = `
    <h2>Propostes</h2>
    <div class="row"><label>Estança<select id="d-room">${roomOptions(ui.layoutRoom)}</select></label></div>
    <div class="mode-card ${furnish ? 'furnish' : 'move'}">
      <b>${furnish ? '🛋 Moblar l’estança' : '🔀 Redistribuir els mobles'}</b>
      <p>${furnish
        ? (kits.length ? `${esc(room.name)} no té mobles${locked ? ` (a part dels ${locked} fixos)` : ''}: et proposo un equipament típic i com col·locar-lo. Cada proposta en prova un altre (${kits.length} variants).` : `${esc(room.name)} no necessita mobles. Si en vols, afegeix-ne des de la pestanya Mobles.`)
        : `Torno a col·locar els ${movable} mobles de ${esc(room.name)} <b>sense afegir-ne ni treure’n cap</b>${locked ? ` (els ${locked} fixos no es mouen)` : ''}.`}</p>
    </div>
    <details class="goals" ${ui.goalsOpen ? 'open' : ''}><summary>🎯 Objectius (${goalSel.length})</summary>
      ${GOALS.map(([k, l, d]) => `<label class="chk" title="${esc(d)}"><input type="checkbox" data-goal="${k}" ${goalSel.includes(k) ? 'checked' : ''}/> ${esc(l)}</label>`).join('')}
      <p class="note">Les propostes intenten complir els objectius triats i t’expliquen per què.</p>
    </details>
    <div class="btns">
      <button class="btn" id="d-gen" ${furnish && !kits.length ? 'disabled' : ''}>✨ ${furnish ? 'Proposa mobles' : 'Redistribueix'}</button>
      <button class="btn secondary" id="d-focus">Mostra l’estança</button>
      ${movable ? `<button class="btn secondary" id="d-empty" title="Treu els mobles que no són fixos (es pot desfer) per poder demanar un equipament nou">🗑 Buida l’estança</button>` : ''}
    </div>
    <div class="progress" id="d-prog" hidden><div class="bar"></div><span></span></div>
    ${H.list.length ? `<div class="prop-nav">
      <button class="btn secondary small" id="d-prev" ${H.idx > 0 ? '' : 'disabled'} title="Proposta anterior">◀ Anterior</button>
      <span class="cnt">Proposta ${H.idx + 1} de ${H.list.length}<br><small>${esc(snap?.name || '')}</small></span>
      <button class="btn secondary small" id="d-next" ${H.idx < H.list.length - 1 ? '' : 'disabled'} title="Proposta següent">Següent ▶</button>
    </div>${goalsHtml(snap?.goals)}` : ''}
    ${snap?.alts?.length ? `<p class="note">Altres col·locacions amb els mateixos mobles (toca’n una per aplicar-la):</p>` : ''}
    <div class="layouts" id="d-cards"></div>
    <div class="btns">${H.list.length > 1 ? '<button class="btn secondary small" id="d-cmp">⇆ Compara les propostes</button>' : ''}${its.length ? '<button class="btn secondary small" id="d-vote" title="Desa com està ara aquesta estança perquè l’altra persona la pugui votar i comentar">⭐ Desa-la per votar</button>' : ''}</div>
    <div id="d-saved">${savedHtml(state, room.id, whoAmI(), esc)}</div>`;
  $('#d-vote')?.addEventListener('click', () => {
    const nm = prompt('Nom d’aquesta proposta (per votar-la):', snap?.name?.split(' · ')[0] || `${room.name} de ${whoAmI()}`);
    if (nm === null) return;
    commit();
    saveProposal(state, room, roomItemsOf(room.id), whoAmI(), nm.trim(), snap?.goals);
    save(); renderDistribuir(); toast('⭐ Desada. L’altra persona la veurà aquí per votar-la i comentar-la.');
  });
  bindSaved($('#d-saved'), state, whoAmI(), {
    change: (fn) => { commit(); fn(); save(); renderDistribuir(); },
    preview: (cv, p) => drawPreview(cv, room, { placements: Object.fromEntries(p.items.map((i) => [i.id, { x: i.x, z: i.z, rot: i.rot }])) }, p.items),
    apply: (p) => { setRoomItems(room, p.items); toast(`«${p.name}» aplicada (↶ per desfer).`); },
  });
  $('#d-empty')?.addEventListener('click', () => {
    commit();
    state.removedFixed = [...new Set([...(state.removedFixed || []), ...its.filter((i) => !i.locked && i.id.startsWith('fix-')).map((i) => i.id)])];
    state.items = state.items.filter((i) => i.roomId !== room.id || i.locked);
    if (ui.selected && !itemById(ui.selected)) ui.selected = null;
    save(); rebuildItems(); renderAll(); toast(`${room.name} buidada. Ara pots demanar un equipament nou (↶ per desfer).`);
  });
  $('#d-room').addEventListener('change', (e) => { ui.layoutRoom = e.target.value; renderDistribuir(); });
  el.querySelector('details.goals').addEventListener('toggle', (e) => { ui.goalsOpen = e.target.open; });
  el.querySelectorAll('[data-goal]').forEach((c) => c.addEventListener('change', () => {
    goalSel = [...el.querySelectorAll('[data-goal]:checked')].map((x) => x.dataset.goal);
    try { localStorage.setItem('planta3d-goals', JSON.stringify(goalSel)); } catch (err) { /* res */ }
    el.querySelector('details.goals summary').textContent = `🎯 Objectius (${goalSel.length})`;
  }));
  $('#d-focus').addEventListener('click', () => frameCamera(room));
  $('#d-gen').addEventListener('click', () => generateProposal(room));
  $('#d-prev')?.addEventListener('click', () => { if (H.idx > 0) { H.idx--; setRoomItems(room, H.list[H.idx].items); } });
  $('#d-next')?.addEventListener('click', () => { if (H.idx < H.list.length - 1) { H.idx++; setRoomItems(room, H.list[H.idx].items); } });
  $('#d-cmp')?.addEventListener('click', () => compareProposals(room));
  if (snap?.alts?.length) {
    const cards = $('#d-cards');
    cards.innerHTML = snap.alts.map((p, i) => `<div class="layout-card" data-i="${i}"><canvas width="320" height="240"></canvas><div class="t">${esc(p.name)}</div><div class="r">${esc(p.rating)}</div>${p.goals?.length ? `<div class="g">${p.goals.map((g) => `<span class="${g.ok ? 'ok' : 'bad'}" title="${esc(g.label)}: ${esc(g.text)}">${g.ok ? '✓' : '✗'}</span>`).join('')}</div>` : ''}</div>`).join('');
    cards.querySelectorAll('.layout-card').forEach((card) => {
      const p = snap.alts[+card.dataset.i];
      drawPreview(card.querySelector('canvas'), room, p, snap.base);
      card.addEventListener('click', () => {
        const placed = applyPlacements(snap.base, p.placements);
        H.list.length = H.idx + 1;
        H.list.push({ name: `${p.name} · ${p.rating}`, goals: p.goals, items: placed, alts: snap.alts.filter((a) => a !== p).concat([{ name: snap.name.split(' · ')[0], rating: snap.name.split(' · ').slice(1).join(' · '), placements: Object.fromEntries(snap.items.map((i) => [i.id, { x: i.x, z: i.z, rot: i.rot }])) }]), base: snap.base });
        H.idx = H.list.length - 1;
        setRoomItems(room, placed);
      });
    });
  }
}

// Còpia dels mobles amb les posicions d'una proposta (x, z, gir i, si n'hi ha, elevació).
function applyPlacements(items, placements) {
  return items.map((i) => { const p = placements[i.id]; return p ? { ...i, x: Math.round(p.x), z: Math.round(p.z), rot: p.rot, ...(p.elev !== undefined ? { elev: p.elev } : {}) } : { ...i }; });
}
function applyProposal(room, p) {
  commit();
  for (const [id, pos] of Object.entries(p.placements)) {
    const it = itemById(id);
    if (!it) continue;
    it.x = Math.round(pos.x); it.z = Math.round(pos.z); it.rot = pos.rot;
    if (pos.elev !== undefined) it.elev = pos.elev;
  }
  save(); rebuildItems(); renderAll();
}

const drawPreview = (cv, room, p, items = null) => drawRoomPreview(cv, room, p, items || state.items.filter((i) => i.roomId === room.id), state.rooms);

// --- Comparar (propostes o escenes) costat a costat
function showCompare(title, panels) {
  const m = document.getElementById('compare');
  m.querySelector('h1').textContent = title;
  const grid = m.querySelector('.cmp-grid');
  grid.innerHTML = panels.map((p, i) => `<div class="cmp-panel"><canvas width="640" height="520"></canvas><div class="t">${esc(p.title)}</div><div class="r">${esc(p.subtitle || '')}</div>${p.action ? `<div class="btns"><button class="btn small" data-i="${i}">${esc(p.action)}</button></div>` : ''}</div>`).join('');
  grid.querySelectorAll('.cmp-panel').forEach((el, i) => {
    panels[i].draw(el.querySelector('canvas'));
    el.querySelector('button[data-i]')?.addEventListener('click', () => { m.hidden = true; panels[i].onAction?.(); });
  });
  m.hidden = false;
}
function compareProposals(room) {
  const H = propHist(room.id);
  const list = H.list.slice(Math.max(0, H.idx - 3), H.idx + 1);
  showCompare(`Propostes per a ${room.name}`, list.map((snap) => ({
    title: `Proposta ${H.list.indexOf(snap) + 1}`, subtitle: snap.name, action: 'Aplica',
    draw: (cv) => drawPreview(cv, room, { placements: {} }, snap.items),
    onAction: () => { H.idx = H.list.indexOf(snap); setRoomItems(room, snap.items); },
  })));
}
function compareScenes(a, b) {
  const panels = [a, b].map((sc) => ({
    title: sc ? sc.name : 'Ara mateix', subtitle: sc ? `${sc.items.length} mobles · ${new Date(sc.ts).toLocaleString('ca')}` : `${state.items.length} mobles`,
    action: sc ? 'Carrega' : null,
    draw: (cv) => drawPlan(cv, state, { items: sc ? sc.items : state.items, cotes: false, pad: 24, bg: getComputedStyle(document.documentElement).getPropertyValue('--panel').trim() || '#fff' }),
    onAction: () => loadScene(sc),
  }));
  showCompare('Comparació d’escenes', panels);
}
function loadScene(sc) {
  commit();
  state.items = clone(sc.items);
  ui.selected = null;
  save(); rebuildItems(); renderAll();
}

// --- Pestaña Plano
function renderPlano() {
  const el = $('#tab-plano');
  el.innerHTML = `
    <h2>General</h2>
    <div class="row c2">
      <label>Alçada del sostre (cm) ${state.ceilingEstimated ? '<span class="badge">estimada</span>' : ''}<input type="number" id="g-ceil" min="150" max="500" value="${state.ceiling}" /></label>
      <label>Gruix de paret (cm)<input type="number" id="g-wall" min="4" max="40" value="${state.wallThickness}" /></label>
    </div>
    <p class="note">Les mides són interiors, en centímetres. X va d’esquerra a dreta i Z de dalt a baix a la vista en planta. Les marcades com a <span class="badge">estimades</span> no surten al plànol: corregeix-les quan les mesuris.</p>
    <h2>Habitacions</h2>
    <div id="rooms"></div>
    <div class="btns"><button class="btn secondary" id="g-addroom">+ Afegeix una habitació</button></div>
    <h2>🕘 Historial de canvis</h2>
    <p class="note">Qui ha canviat què (es desa amb el plànol i el veieu tots dos).</p>
    <div id="g-log">${logHtml(state, esc, ui.logAll ? 200 : 25)}</div>
    ${(state.log || []).length > 25 ? `<div class="btns"><button class="btn secondary small" id="g-logall">${ui.logAll ? 'Mostra’n menys' : `Mostra-ho tot (${state.log.length})`}</button></div>` : ''}`;
  $('#g-logall')?.addEventListener('click', () => { ui.logAll = !ui.logAll; renderPlano(); });
  $('#g-ceil').addEventListener('change', (e) => { commit(); state.ceiling = Math.max(150, +e.target.value || 250); state.ceilingEstimated = false; save(); rebuildPlan(); renderPlano(); });
  $('#g-wall').addEventListener('change', (e) => { commit(); state.wallThickness = Math.max(4, +e.target.value || 10); save(); rebuildPlan(); updateOverlays(); });
  $('#g-addroom').addEventListener('click', () => {
    commit();
    const b = planBounds();
    const id = 'r' + Math.random().toString(36).slice(2, 7);
    state.rooms.push({ id, name: 'Habitació nova', kind: 'room', color: '#c89b6a', x: b.x1, z: b.z0, w: 300, d: 300, estimated: true, openings: [] });
    ui.addRoom = id;
    save(); rebuildPlan(); renderAll();
  });
  const wrapR = $('#rooms');
  wrapR.innerHTML = state.rooms.map((r) => `
    <details class="room-card ${r.estimated ? 'est' : ''}" data-id="${r.id}" ${ui.addRoom === r.id ? 'open' : ''}>
      <summary><span class="sw" style="display:inline-block;width:12px;height:12px;border-radius:3px;background:${esc(r.color)}"></span>${esc(r.name)} ${r.estimated ? '<span class="badge">estimada</span>' : ''}<span class="dm">${r.w} × ${r.d}</span></summary>
      <div style="margin-top:10px">
        <div class="row c2">
          <label>Nom<input type="text" data-k="name" value="${esc(r.name)}" /></label>
          <label>Tipus<select data-k="kind">
            <option value="room" ${r.kind === 'room' ? 'selected' : ''}>Habitació</option>
            <option value="terrace" ${r.kind === 'terrace' ? 'selected' : ''}>Terrassa</option>
            <option value="void" ${r.kind === 'void' ? 'selected' : ''}>Buit (no habitable)</option>
            <option value="pillar" ${r.kind === 'pillar' ? 'selected' : ''}>Pilar (de terra a sostre)</option>
            <option value="beam" ${r.kind === 'beam' ? 'selected' : ''}>Biga (penjada del sostre)</option>
          </select></label>
        </div>
        <div class="row c4">
          <label>Amplada<input type="number" data-k="w" min="20" value="${r.w}" /></label>
          <label>Fons<input type="number" data-k="d" min="20" value="${r.d}" /></label>
          ${r.kind === 'terrace' ? `<label title="Fons a l’extrem dret si la vora exterior va en diagonal (0 = recta)">Fons dreta<input type="number" data-k="d2" min="0" value="${r.d2 || 0}" /></label>` : ''}
          ${r.kind === 'beam' ? `<label title="Alçada de la part de sota de la biga">Alçada de sota<input type="number" data-k="h0" min="100" value="${r.h0 || 210}" /></label>` : ''}
          <label>X<input type="number" data-k="x" value="${r.x}" /></label>
          <label>Z<input type="number" data-k="z" value="${r.z}" /></label>
        </div>
        <div class="row c3">
          <label>Color del terra<input type="color" data-k="color" value="${esc(r.color)}" /></label>
          <label>Terra<select data-k="floor">${[['', 'Automàtic'], ['parquet', 'Parquet'], ['rajola', 'Rajola'], ['llis', 'Llis']].map(([v, l]) => `<option value="${v}" ${(r.floor || '') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
          <label style="flex-direction:row;align-items:center;gap:6px;margin-top:18px"><input type="checkbox" data-k="estimated" ${r.estimated ? 'checked' : ''}/> Mides estimades</label>
        </div>
        ${r.notes ? `<p class="note">${esc(r.notes)}</p>` : ''}
        <div class="openings">
          <label>Portes, finestres i passos (paret, des de la cantonada, amplada, tipus)</label>
          ${(r.openings || []).map((o, k) => `
            <div class="op-row" data-op="${k}">
              <select data-ok="wall">${['N', 'S', 'E', 'W'].map((w) => `<option ${o.wall === w ? 'selected' : ''} value="${w}">${{ N: 'Dalt', S: 'Baix', E: 'Dreta', W: 'Esq.' }[w]}</option>`).join('')}</select>
              <input type="number" data-ok="offset" value="${o.offset}" title="Distància des de la cantonada superior o esquerra" />
              <input type="number" data-ok="width" value="${o.width}" title="Amplada del buit" />
              <select data-ok="type">${[['puerta', 'porta'], ['ventana', 'finestra'], ['ventanal', 'finestral (terra-sostre, doble)'], ['paso', 'pas']].map(([t, lb]) => `<option value="${t}" ${o.type === t ? 'selected' : ''}>${lb}</option>`).join('')}</select>
              <button data-del-op="${k}" title="Treu">×</button>
              ${o.type === 'puerta' ? `<div class="op-sub">
                <label>S’obre<select data-ok="swing">${[['in', 'cap a dins'], ['out', 'cap a fora'], ['none', 'no es dibuixa (corredissa)']].map(([v, l]) => `<option value="${v}" ${(o.swing || 'in') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
                <label>Frontissa<select data-ok="hinge">${[['a', o.wall === 'N' || o.wall === 'S' ? 'a l’esquerra' : 'a dalt'], ['b', o.wall === 'N' || o.wall === 'S' ? 'a la dreta' : 'a baix']].map(([v, l]) => `<option value="${v}" ${(o.hinge || 'a') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
              </div>` : ''}
            </div>`).join('')}
          <div class="btns">
            <button class="btn secondary small" data-add-op>+ Buit</button>
            <button class="btn secondary small" data-focus>Mostra</button>
            <button class="btn danger small" data-del-room>Elimina l’habitació</button>
          </div>
        </div>
      </div>
    </details>`).join('');

  wrapR.querySelectorAll('.room-card').forEach((card) => {
    const r = roomById(card.dataset.id);
    card.addEventListener('toggle', () => { if (card.open) ui.addRoom = r.id; });
    card.querySelectorAll('[data-k]').forEach((inp) => inp.addEventListener('change', () => {
      commit();
      const k = inp.dataset.k;
      if (k === 'estimated') r.estimated = inp.checked;
      else if (k === 'floor') { if (inp.value) r.floor = inp.value; else delete r.floor; }
      else if (['w', 'd', 'd2', 'x', 'z'].includes(k)) {
        r[k] = +inp.value || 0;
        state.roomsEdited = true;
        if (k === 'w' || k === 'd') r.estimated = card.querySelector('[data-k=estimated]').checked;
      } else r[k] = inp.value;
      ui.addRoom = r.id;
      save(); rebuildPlan(); updateOverlays(); renderAll();
    }));
    card.querySelectorAll('.op-row').forEach((row) => {
      const o = r.openings[+row.dataset.op];
      row.querySelectorAll('[data-ok]').forEach((inp) => inp.addEventListener('change', () => {
        commit();
        const k = inp.dataset.ok;
        o[k] = k === 'offset' || k === 'width' ? +inp.value || 0 : inp.value;
        save(); rebuildPlan(); updateOverlays();
        if (k === 'type' || k === 'wall') renderPlano();
      }));
    });
    card.querySelectorAll('[data-del-op]').forEach((b) => b.addEventListener('click', () => {
      commit(); r.openings.splice(+b.dataset.delOp, 1); ui.addRoom = r.id; save(); rebuildPlan(); renderPlano();
    }));
    card.querySelector('[data-add-op]').addEventListener('click', () => {
      commit(); (r.openings ||= []).push({ wall: 'N', offset: 20, width: 80, type: 'puerta' }); ui.addRoom = r.id; save(); rebuildPlan(); renderPlano();
    });
    card.querySelector('[data-focus]').addEventListener('click', () => frameCamera(r));
    card.querySelector('[data-del-room]').addEventListener('click', () => {
      commit();
      state.rooms = state.rooms.filter((x) => x.id !== r.id);
      state.items.forEach((i) => { if (i.roomId === r.id) i.roomId = null; });
      save(); rebuildPlan(); updateOverlays(); renderAll();
    });
  });
}

// --- Pestaña Datos
function renderDatos(target) {
  const el = target || document.getElementById('s-dades');
  if (!el) return;
  el.innerHTML = `
    <h2>Dades: desa i comparteix</h2>
    <p class="note">Tot es desa automàticament en aquest navegador i al núvol. Per passar-ho a un altre ordinador, exporta el fitxer i després importa’l allà.</p>
    <div class="btns">
      <button class="btn" id="x-export">Exporta (.json)</button>
      <label class="btn secondary" style="display:inline-block">Importa<input type="file" id="x-import" accept="application/json,.json" hidden /></label>
      <button class="btn secondary" id="x-png">Captura (.png)</button>
    </div>
    <h2>Escenes</h2>
    <p class="note">Una escena és una foto de com estan col·locats tots els mobles ara (per exemple «Menjador opció A»). Desa’n diverses, compara-les i torna-hi quan vulguis.</p>
    <div class="btns"><button class="btn" id="sc-save">＋ Desa l’escena actual</button><button class="btn secondary" id="sc-cmp" ${(state.scenes || []).length ? '' : 'disabled'}>⇆ Compara</button></div>
    <div id="sc-list"></div>
    <h2>Imprimeix / PDF</h2>
    <p class="note">Obre una fulla amb el plànol acotat, la llista d’habitacions amb les obertures i tots els mobles amb les mides. Al diàleg d’impressió tria «Desa com a PDF» (al mòbil: Comparteix → Imprimeix → pessiga per fer-lo PDF).</p>
    <div class="btns"><button class="btn" id="x-pdf">🖨 Plànol amb cotes (PDF)</button></div>
    <h2>Plànol a escala</h2>
    <p class="note">Per portar a la botiga o al muntador: el plànol a escala real (a 1:50, 1 m del pis = 2 cm al paper), amb les cotes de les habitacions, els mobles i un regle per comprovar-ho. Imprimeix-lo al 100 %.</p>
    <div class="row c3">
      <label>Què<select id="x-sc-room"><option value="">Tot el pis</option>${roomOptions('')}</select></label>
      <label>Paper<select id="x-sc-paper"><option>A4</option><option>A3</option></select></label>
      <label>Escala<select id="x-sc-scale"><option value="">Automàtica</option><option value="20">1:20</option><option value="25">1:25</option><option value="50">1:50</option><option value="75">1:75</option><option value="100">1:100</option></select></label>
    </div>
    <p class="note" id="x-sc-info"></p>
    <div class="btns"><button class="btn" id="x-scale">📐 Imprimeix a escala</button></div>
    <h2>Instal·la l’app</h2>
    <div id="x-install-status">${installStatusHtml()}</div>
    <div class="btns"><button class="btn" id="x-install" ${isStandalone() ? 'disabled' : ''}>⬇ Instal·la al dispositiu</button></div>
    <h2>Restableix</h2>
    <div class="btns">
      <button class="btn danger" id="x-clear">Treu tots els mobles</button>
      <button class="btn danger" id="x-reset">Torna al plànol original</button>
    </div>
    <h2>Dreceres</h2>
    <p class="note">
      Arrossegar: moure el moble · R: girar 90° · Maj+R: girar −90° · Q / E: girar 15° · Fletxes: moure 1 cm (Maj: 10 cm) ·
      Supr: eliminar · Ctrl+D: duplicar · Ctrl+Z / Ctrl+Y: desfer / refer · Roda: zoom · Botó dret: desplaçar la vista.
    </p>`;
  $('#x-export').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'planta-3d.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  $('#x-import').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const s = JSON.parse(await file.text());
      if (!Array.isArray(s.rooms) || !Array.isArray(s.items)) throw new Error('formato');
      commit(); state = migratePlan(s); afterStateReplace(); frameCamera();
    } catch (err) { el.insertAdjacentHTML('beforeend', '<p class="note" style="color:var(--bad)">El fitxer no és vàlid.</p>'); }
  });
  $('#x-png').addEventListener('click', () => {
    renderer.render(scene, camera);
    const a = document.createElement('a');
    a.href = renderer.domElement.toDataURL('image/png'); a.download = 'planta-3d.png'; a.click();
  });
  $('#x-install').addEventListener('click', () => installApp());
  $('#x-pdf').addEventListener('click', () => printSheet(state));
  const scInfo = () => {
    const rid = $('#x-sc-room').value || null, f = fitScale(state, $('#x-sc-paper').value, rid), a3 = fitScale(state, 'A3', rid);
    $('#x-sc-info').textContent = `En ${$('#x-sc-paper').value} hi cap a 1:${f.scale} (${f.landscape ? 'horitzontal' : 'vertical'}).${$('#x-sc-paper').value === 'A4' && a3.scale < f.scale ? ` En A3, a 1:${a3.scale}.` : ''}`;
  };
  ['#x-sc-paper', '#x-sc-room'].forEach((k) => $(k).addEventListener('change', scInfo)); scInfo();
  $('#x-scale').addEventListener('click', () => { const r = printScale(state, { paper: $('#x-sc-paper').value, scale: +$('#x-sc-scale').value || 0, roomId: $('#x-sc-room').value || null }); if (r.error) toast('El navegador ha bloquejat la finestra: permet les finestres emergents.'); });
  $('#sc-save').addEventListener('click', () => {
    const name = prompt('Nom de l’escena:', `Escena ${(state.scenes || []).length + 1}`);
    if (name === null) return;
    commit();
    (state.scenes ||= []).push({ id: 's' + Math.random().toString(36).slice(2, 8), name: name.trim() || 'Escena', ts: Date.now(), items: clone(state.items) });
    save(); renderDatos();
  });
  $('#sc-cmp').addEventListener('click', () => {
    const sel = [...el.querySelectorAll('.sc-row input:checked')].map((c) => (state.scenes || []).find((s) => s.id === c.value));
    if (sel.length === 2) compareScenes(sel[0], sel[1]);
    else if (sel.length === 1) compareScenes(sel[0], null);
    else { el.querySelector('#sc-hint').hidden = false; }
  });
  const list = el.querySelector('#sc-list');
  const scenes = state.scenes || [];
  list.innerHTML = scenes.length ? `<p class="note" id="sc-hint" hidden>Marca una o dues escenes per comparar-les (una sola es compara amb l’estat actual).</p><ul class="list">${scenes.map((sc) => `
    <li class="sc-row" data-id="${sc.id}">
      <input type="checkbox" value="${sc.id}" title="Marca per comparar" />
      <span class="nm">${esc(sc.name)}</span>
      <span class="dm">${sc.items.length} mobles · ${new Date(sc.ts).toLocaleDateString('ca')}</span>
      <button class="btn small" data-sc-load>Carrega</button>
      <button class="btn secondary small" data-sc-ren title="Canvia el nom">✎</button>
      <button class="btn danger small" data-sc-del title="Elimina">×</button>
    </li>`).join('')}</ul>` : '';
  list.querySelectorAll('.sc-row').forEach((row) => {
    const sc = scenes.find((s) => s.id === row.dataset.id);
    row.querySelector('[data-sc-load]').addEventListener('click', () => { loadScene(sc); });
    row.querySelector('[data-sc-ren]').addEventListener('click', () => { const n = prompt('Nom de l’escena:', sc.name); if (n === null) return; commit(); sc.name = n.trim() || sc.name; save(); renderDatos(); });
    row.querySelector('[data-sc-del]').addEventListener('click', () => { commit(); state.scenes = scenes.filter((s) => s !== sc); save(); renderDatos(); });
  });
  $('#x-clear').addEventListener('click', () => { commit(); state.removedFixed = [...new Set([...(state.removedFixed || []), ...state.items.map((i) => i.id).filter((id) => id.startsWith('fix-'))])]; state.items = []; ui.selected = null; afterStateReplace(); });
  $('#x-reset').addEventListener('click', () => { commit(); state = clone(DEFAULT_PLAN); ui.selected = null; afterStateReplace(); frameCamera(); });
}

const shop = initShop({ el: document.getElementById('tab-compra'), state: () => state, rooms: usableRooms, esc, commit, save, select: (id) => { select(id); const it = itemById(id); if (it) frameCamera(roomById(it.roomId)); }, roomName: (id) => roomById(id)?.name || '', toast, changed: () => { renderProps(); renderItemList(); } });
function renderAll() {
  updateOverlays();
  shop.render();
  renderMuebles();
  renderDistribuir();
  renderPlano();
  renderDatos();
  renderProps();
  window.devTools?.refresh?.();
}

// ---------------------------------------------------------------- arranque
window.addEventListener('resize', resize);
new ResizeObserver(resize).observe(wrap);
resize();
rebuildPlan();
rebuildItems();
frameCamera();
renderAll();
if (location.search.includes('sim=1')) document.body.classList.add('sim');

controls3d.addEventListener('change', requestRender);
controlsTop.addEventListener('change', requestRender);
let perfMode = false, lastFrame = 0;
function loop(now = 0) {
  requestAnimationFrame(loop);
  if (perfMode && now - lastFrame < 31) return; // ~30 fps en mode rendiment
  let moved = controls.update();
  if (ui.view === 'walk') { if (walkStep(performance.now())) moved = true; }
  if (stepDoors(now)) moved = true;
  if (moved || needsRender) {
    needsRender = false; lastFrame = now;
    if (wallSprite) { wallSideCheck(); fitWallSprite(); }
    tape.fit();
    renderer.render(scene, camera);
  }
}
loop();

// ---------------------------------------------------------------- inicio de sesión (Firebase)
// Sincronitza ara: baixa l'estat del núvol, el fusiona amb els canvis d'aquí, el puja i comprova si hi ha una versió nova de l'app.
let syncing = false;
async function syncNow() {
  if (syncing) return;
  const b = document.getElementById('sync-btn');
  syncing = true; b.classList.add('spin'); setSync('Sincronitzant…');
  try {
    if (!navigator.onLine) throw new Error('sense connexió');
    const r = await loadRemote();
    if (r) {
      cloudCount('reads');
      const merged = mergeStates(cloudBase, state, r.state);
      cloudBase = clone(r.state);
      const changed = JSON.stringify(merged) !== JSON.stringify(state);
      state = migratePlan(merged);
      changeLog.reset(state);
      afterStateReplace(true);
      toast(changed ? `↻ Canvis rebuts del núvol (${r.by.split('@')[0] || 'altre dispositiu'}).` : '↻ Tot al dia: no hi havia canvis nous.');
    } else { save(true); toast('↻ Pujat al núvol.'); }
    // versió nova de l'app?
    const html = await fetch('./index.html', { cache: 'no-store' }).then((x) => x.text());
    const m = /main\.js\?v=(\d+)/.exec(html);
    const cur = /main\.js\?v=(\d+)/.exec(document.querySelector('script[type=module]')?.getAttribute('src') || '');
    if (m && cur && m[1] !== cur[1]) {
      toast(`⬇ Versió nova de l’app (v${m[1]}): actualitzant…`);
      try { const ks = await caches.keys(); await Promise.all(ks.map((k) => caches.delete(k))); const regs = await navigator.serviceWorker?.getRegistrations(); for (const reg of regs || []) await reg.unregister(); } catch (e) { /* res */ }
      setTimeout(() => location.reload(), 900);
      return;
    }
    navigator.serviceWorker?.getRegistration?.().then((reg) => reg?.update()).catch(() => {});
  } catch (e) { setSync('error: ' + e.message); toast('⚠️ No s’ha pogut sincronitzar: ' + e.message); }
  finally { syncing = false; b.classList.remove('spin'); }
}
function showGate(html) {
  const g = document.getElementById('gate');
  g.hidden = false;
  g.querySelector('.gate-body').innerHTML = html;
  const b = g.querySelector('#gate-login');
  if (b) b.addEventListener('click', async () => {
    b.disabled = true;
    try { await signIn(); } catch (e) { showGate(loginHtml('No s’ha pogut iniciar la sessió: ' + esc(e.message))); }
  });
}
const loginHtml = (err = '') => `
  <p>Aquesta app és privada. Entra amb un dels comptes de Google autoritzats.</p>
  ${err ? `<p class="gate-err">${err}</p>` : ''}
  <button class="btn" id="gate-login">Entra amb Google</button>`;

if (cloudEnabled) {
  showGate('<p>Comprovant la sessió…</p>');
  initCloud({
    onSignedOut: () => showGate(loginHtml()),
    onDenied: (email, msg) => showGate(loginHtml(msg ? esc(msg) : `El compte <b>${esc(email || '')}</b> no té accés. Fes servir un compte autoritzat amb el correu verificat.`)),
    onSignedIn: (u, initial) => {
      document.getElementById('gate').hidden = true;
      const acc = document.getElementById('account');
      acc.hidden = false;
      cloudCount('reads');
      if (initial) { history.past = []; history.future = []; const v = initial.version || 1; cloudBase = clone(initial); state = migratePlan(initial); changeLog.reset(state); afterStateReplace(v < DEFAULT_PLAN.version); frameCamera(); setSync('guardado'); }
      else save();
      setTimeout(() => { applyCfg(); api.dev?.bkAutoCheck(); }, 1500);
    },
    onRemoteState: (s, by) => {
      // Fusió amb els canvis locals que encara no s'han desat: no es perd res de cap dels dos.
      cloudCount('reads');
      const merged = mergeStates(cloudBase, state, s);
      cloudBase = clone(s);
      const needsResave = JSON.stringify(merged) !== JSON.stringify(s);
      state = migratePlan(merged);
      changeLog.reset(state); // el que ve del núvol ja porta el seu historial
      afterStateReplace(needsResave);
      if (!needsResave) setSync('Actualitzat per ' + String(by).split('@')[0]);
    },
  }).catch((e) => showGate(`<p class="gate-err">Error en carregar Firebase: ${esc(e.message)}</p>`));
  document.getElementById('sync-btn').addEventListener('click', syncNow);
}

// ---------------------------------------------------------------- app instal·lable (PWA)
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => { /* sense SW */ }));
}
function isStandalone() { return ['standalone', 'fullscreen', 'minimal-ui', 'window-controls-overlay'].some((m) => window.matchMedia(`(display-mode: ${m})`).matches) || navigator.standalone === true || document.referrer.startsWith('android-app://'); }
function isIOS() { return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); }
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installPrompt = e; updateInstallUI(); });
window.addEventListener('appinstalled', () => { installPrompt = null; updateInstallUI(); });
window.matchMedia('(display-mode: standalone)').addEventListener?.('change', updateInstallUI);
function updateInstallUI() {
  document.getElementById('install-group').hidden = isStandalone();
  const d = $('#x-install-status');
  if (d) d.innerHTML = installStatusHtml();
}
function installStatusHtml() {
  if (isStandalone()) return '<p class="note">✅ Ja la fas servir com a app instal·lada.</p>';
  if (installPrompt) return '<p class="note">Prem <b>Instal·la</b> i l’app quedarà a l’escriptori o a la pantalla d’inici, amb la seva icona i sense la barra del navegador.</p>';
  if (isIOS()) return '<p class="note">A l’iPhone s’instal·la des de Safari: prem <b>Compartir</b> (el quadrat amb la fletxa) i després <b>Afegeix a la pantalla d’inici</b>.</p>';
  return '<p class="note">Obre-la amb Chrome o Edge i prem <b>Instal·la</b>. Si el botó no surt, al menú del navegador (⋮) tria <b>Instal·la l’app</b> o <b>Afegeix a la pantalla d’inici</b>.</p>';
}
async function installApp() {
  if (installPrompt) {
    installPrompt.prompt();
    try { await installPrompt.userChoice; } catch (e) { /* res */ }
    installPrompt = null; updateInstallUI();
    return;
  }
  const m = document.getElementById('install-help');
  m.querySelector('.modal-body').innerHTML = isIOS()
    ? `<p>A l’iPhone o l’iPad, des de <b>Safari</b>:</p><ol><li>Prem el botó <b>Compartir</b> (el quadrat amb una fletxa cap amunt).</li><li>Tria <b>Afegeix a la pantalla d’inici</b>.</li><li>Prem <b>Afegeix</b>. Ja tens la icona Planta 3D.</li></ol>`
    : `<p>Des de <b>Chrome</b> o <b>Edge</b>:</p><ol><li>Obre el menú del navegador (⋮ o ⋯).</li><li>Tria <b>Instal·la l’app</b> o <b>Afegeix a la pantalla d’inici</b>.</li><li>Confirma. Ja tens la icona Planta 3D.</li></ol>`;
  m.hidden = false;
}
document.getElementById('install').addEventListener('click', installApp);
document.getElementById('install-close').addEventListener('click', () => { document.getElementById('install-help').hidden = true; });
document.getElementById('compare-close').addEventListener('click', () => { document.getElementById('compare').hidden = true; });
updateInstallUI();

// ---------------------------------------------------------------- configuració i assistent
const api = {
  version: 'v39',
  get standalone() { return isStandalone(); },
  rooms: () => state.rooms,
  items: () => state.items,
  ceiling: () => state.ceiling || 250,
  structs: () => structItems(state.rooms),
  wallThickness: () => state.wallThickness || 10,
  currentRoom: () => { const it = itemById(ui.selected); return (it && roomById(it.roomId)) || roomById(ui.layoutRoom) || usableRooms()[0] || null; },
  addItems: (type, props, qty, roomId) => addItems(type, props, qty, roomId),
  removeItem, moveItem, undo, select, frameCamera,
  frame: (room) => { frameCamera(room); if (ui.view === 'top') fitOrtho(); },
  proposals: (room, its, onProgress) => {
    ui.seed = (ui.seed * 9301 + 49297) % 233280 + Date.now() % 1000;
    return generateLayoutsAsync(room, its, state.rooms, { wallThickness: state.wallThickness, seed: ui.seed, count: 4 }, onProgress);
  },
  apply: (room, p) => applyProposal(room, p),
  showProposals: (room, props) => {
    // Propostes de l'assistent: s'afegeixen a l'historial de l'estança i s'aplica la millor.
    if (!props.length) return;
    const H = propHist(room.id), base = clone(roomItemsOf(room.id)), best = props[0];
    const placed = applyPlacements(base, best.placements);
    H.list.length = H.idx + 1;
    H.list.push({ name: `WALL-E · ${best.rating}`, items: placed, alts: props.slice(1).map((p) => ({ name: p.name, rating: p.rating, placements: p.placements })), base });
    H.idx = H.list.length - 1;
    ui.layoutRoom = room.id;
    setRoomItems(room, placed);
    document.querySelector('.tabs button[data-tab=distribuir]')?.click();
  },
  // ---- estat i ajustos (mode developer / assistent d'ordres)
  state: () => state,
  cfg: () => state.cfg || {},
  cfgGet,
  setCfg: (obj) => { commit(); const c = cfgClean(obj); if (Object.keys(c).length) state.cfg = c; else delete state.cfg; save(); applyCfg(); },
  replaceState: (s) => { commit(); state = migratePlan(s); afterStateReplace(); applyCfg(); frameCamera(); },
  remigrate: () => { commit(); state.version = 0; delete state.removedFixed; state = migratePlan(state); afterStateReplace(); },
  save: () => save(true),
  log: () => logBuf,
  toast: (m) => toast(m),
  setPlan: (patch) => { commit(); Object.assign(state, patch); save(); rebuildPlan(); rebuildItems(); renderAll(); },
  setRoom: (id, patch) => { const r = roomById(id); if (!r) return; commit(); Object.assign(r, patch); save(); rebuildPlan(); renderAll(); },
  clearItems: (roomId) => { commit(); const gone = state.items.filter((i) => (!roomId || i.roomId === roomId) && i.id.startsWith('fix-')).map((i) => i.id); if (gone.length) state.removedFixed = [...new Set([...(state.removedFixed || []), ...gone])]; state.items = roomId ? state.items.filter((i) => i.roomId !== roomId) : []; ui.selected = null; afterStateReplace(); },
  setWallMode: (v) => { ui.wallMode = v; const sel = $('#wallMode'); if (sel) sel.value = v; rebuildPlan(); },
  setToggle: (what, on) => { const cb = $('#' + what); if (cb) { cb.checked = on; cb.dispatchEvent(new Event('change')); } },
  setView: (v) => setView(v),
  sync: syncNow, toggleDoor,
  signOut: () => signOutUser(), userEmail: () => currentUserEmail(),
  setShadows: (on) => { if (renderer.shadowMap.enabled !== on) { renderer.shadowMap.enabled = on; scene.traverse((o) => { if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach((m) => { m.needsUpdate = true; }); } }); requestRender(); } },
  renderDades: (el) => renderDatos(el),
  getCamera, applyCamera, simulate,
  applyUnits: () => { rebuildPlan(); updateOverlays(); renderAll(); },
  voices: () => assistant.voices(),
  pickVoice: () => assistant.pickVoice(),
  cloud: { enabled: () => cloudEnabled, user: () => (currentUserEmail() ? { email: currentUserEmail() } : null), backupList, backupSave, backupLoad, backupDelete },
  setScenePrefs: ({ wall, bg, ground: g }) => {
    try { if (wall) wallMat.color.set(wall); if (bg) scene.background.set(bg); if (g) ground.material.color.set(g); } catch (e) { /* color no vàlid */ }
    requestRender();
  },
  cloudInfo: () => { const bk = api.dev?.bkList?.() || []; return { enabled: cloudEnabled, bytes: JSON.stringify(state).length, writes: cloudStats.day === today() ? cloudStats.writes : 0, reads: cloudStats.day === today() ? cloudStats.reads : 0, items: state.items.length, rooms: state.rooms.length, bkCount: bk.length, bkBytes: bk.reduce((a, b) => a + (b.bytes || 0), 0) }; },
  voiceInfo: () => assistant.voiceInfo(),
  walleSay: (f) => assistant.walleSay(f),
  sayTest: () => assistant.sayTest(),
};
// Avís breu a la part de baix.
let toastT = 0;
function toast(msg) {
  const el = document.getElementById('toast'); if (!el) return;
  el.textContent = msg; el.hidden = false; clearTimeout(toastT); relayout();
  toastT = setTimeout(() => { el.hidden = true; }, Math.max(3500, String(msg).length * 55));
}
// Aplica els ajustos avançats que no es llegeixen al moment.
function applyCfg() {
  setSaveDelay(cfgGet('saveDelay'));
  perfMode = cfgGet('perf') === 1;
  renderer.setPixelRatio(perfMode ? 1 : Math.min(window.devicePixelRatio, cfgGet('pixelRatio')));
  api.setShadows(!perfMode && !!+prefs.shadows);
  document.body.classList.toggle('perf', perfMode);
  rebuildPlan();
}
// Simulador de pantalla: l'app dins d'un marc de la mida d'un mòbil (té el seu propi viewport, així que el disseny mòbil s'aplica de debò).
function simulate(w, h, name) {
  const m = document.getElementById('sim');
  m.querySelector('h1').textContent = `${name} · ${w} × ${h}`;
  const fr = m.querySelector('iframe');
  fr.style.width = w + 'px'; fr.style.height = h + 'px';
  const k = Math.min(1, (window.innerHeight - 90) / h, (window.innerWidth - 40) / w);
  fr.style.transform = `scale(${k})`; fr.parentElement.style.width = Math.round(w * k) + 'px'; fr.parentElement.style.height = Math.round(h * k) + 'px';
  fr.src = location.pathname + '?sim=1';
  m.hidden = false;
}
document.getElementById('sim-close').addEventListener('click', () => { const m = document.getElementById('sim'); m.hidden = true; m.querySelector('iframe').src = 'about:blank'; });
api.dev = initDevCfg(api);
const assistant = initAssistant(api);
initColorPicker();
initLayoutGuard();
applyPrefs(api);
initSettings(api);
applyCfg();
if (prefs.startView === 'top') setView('top');

// Acceso para depuración desde la consola.
window.planta3d = {
  screenOf(x, z, y = 40) {
    const v = new THREE.Vector3(x, y, z).project(camera);
    const r = renderer.domElement.getBoundingClientRect();
    return [r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height];
  },
  get state() { return state; }, get conflicts() { return [...(ui.conflicts || new Map())]; }, generateLayouts, addItems, frameCamera, setView, ask: (q) => assistant.ask(q), rAsk: (q) => assistant.rAsk(q), prefs, api, cfgGet, generateProposal, roomKits, walk, minimap, rebuildItems, get tape() { return tape; }, ui,
  showWall(roomId, key = 'N', at) { let w = null; planGroup.traverse((o) => { const u = o.userData.wall; if (!w && u && !u.whole && (!roomId || u.room.id === roomId) && u.key === key && (at === undefined || (u.a <= at && at <= u.b && !u.over))) w = u; }); showWallMeasure(w); return !!w; },
  get wallSel() { return ui.wallSel ? { room: ui.wallSel.room.id, key: ui.wallSel.key } : null; },
  camAz() { const c = ui.view === 'top' ? controlsTop : controls3d; const o = c.object.position.clone().sub(c.target); return Math.atan2(o.x, o.z); } };
