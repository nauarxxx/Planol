import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';
import { DEFAULT_PLAN } from './plan.js';
import { CATALOG, buildFurniture, newItem } from './furniture.js';
import { generateLayouts, generateLayoutsAsync } from './layout.js';
import { cloudEnabled, initCloud, signIn, signOutUser, saveRemote } from './cloud.js?v=16';
import { mergeStates } from './merge.js';
import { corners, aabb, overlaps, innerRect, outsideAmount, roomAt, allOpenings, DEG } from './geom.js';

// ---------------------------------------------------------------- estado
const STORE_KEY = 'planta3d-v1';
const clone = (o) => JSON.parse(JSON.stringify(o));

function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && Array.isArray(s.rooms) && Array.isArray(s.items)) return s;
    }
  } catch (e) { /* sin almacenamiento */ }
  return clone(DEFAULT_PLAN);
}

// Si el plano por defecto es más nuevo que el guardado, se actualizan las habitaciones
// y se conservan los muebles (se reasignan a la habitación donde caen).
function migratePlan(s) {
  if (!s || (s.version || 1) >= DEFAULT_PLAN.version) return s;
  const fresh = clone(DEFAULT_PLAN);
  s.rooms = fresh.rooms;
  s.version = fresh.version;
  for (const it of s.items || []) {
    const r = roomAt(s.rooms, it.x, it.z);
    it.roomId = r ? r.id : (s.rooms.find((x) => x.kind === 'room') || {}).id;
  }
  return s;
}

let state = migratePlan(loadState());
const ui = { selected: null, view: '3d', wallMode: 'low', snap: true, labels: true, measures: true, layoutRoom: null, proposals: [], seed: 1, addRoom: null, propsOpen: false };
const isMobile = () => window.matchMedia('(max-width: 800px)').matches;
const history = { past: [], future: [] };

let cloudBase = null; // últim estat confirmat al núvol (per fusionar canvis simultanis)
function save(remote = true) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* ignorar */ }
  if (remote) saveRemote(() => state, setSync);
}
function setSync(st, json) {
  if (st === 'guardado' && json) cloudBase = JSON.parse(json);
  const el = document.getElementById('sync');
  if (!el) return;
  el.textContent = st === 'guardado' ? 'Desat al núvol' : st === 'pendiente' ? 'Desant…' : st.startsWith('error') ? 'Error en desar' : st;
  el.title = st;
  el.className = st.startsWith('error') ? 'sync bad' : 'sync';
}
function commit() {
  history.past.push(JSON.stringify(state));
  if (history.past.length > 80) history.past.shift();
  history.future = [];
}
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

const roomById = (id) => state.rooms.find((r) => r.id === id);
const itemById = (id) => state.items.find((i) => i.id === id);
const usableRooms = () => state.rooms.filter((r) => r.kind !== 'void');

// ---------------------------------------------------------------- three.js
const wrap = document.getElementById('canvas-wrap');
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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
sun.shadow.mapSize.set(4096, 4096);
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

function frameCamera(room) {
  const b = planBounds();
  const cx = room ? room.x + room.w / 2 : b.cx;
  const cz = room ? room.z + room.d / 2 : b.cz;
  const size = room ? Math.max(room.w, room.d) * 1.6 + 200 : b.size;
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

function setView(v) {
  ui.view = v;
  camera = v === 'top' ? ortho : persp;
  controls3d.enabled = v !== 'top';
  controlsTop.enabled = v === 'top';
  controls = v === 'top' ? controlsTop : controls3d;
  document.querySelectorAll('[data-view]').forEach((b) => b.classList.toggle('active', b.dataset.view === v));
  rebuildPlan();
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
function floorMaterial(r, worldUV = false) {
  const kind = floorKind(r);
  const base = makeTexture(kind);
  const tex = base.clone();
  const p = base.userData.period;
  if (worldUV) tex.repeat.set(1 / p, 1 / p); else tex.repeat.set(r.w / p, r.d / p);
  tex.needsUpdate = true;
  // El color de l'habitació tenyeix la textura (que és clara i grisa).
  const col = new THREE.Color(r.color || '#c89b6a').multiplyScalar(kind === 'parquet' ? 1.25 : 1.1);
  return new THREE.MeshStandardMaterial({ color: col, map: tex, roughness: kind === 'rajola' ? 0.45 : 0.7, metalness: 0 });
}
const wallTex = makeTexture('estuc');
wallTex.repeat.set(2, 2);
const wallMat = new THREE.MeshStandardMaterial({ color: 0xf3f1ec, roughness: 0.92, map: wallTex });
const wallTopMat = new THREE.MeshStandardMaterial({ color: 0x2b2926, roughness: 0.9 });
const glassMat = new THREE.MeshStandardMaterial({ color: 0x8fbfdc, transparent: true, opacity: 0.55, roughness: 0.1 });
const windowMat = new THREE.MeshStandardMaterial({ color: 0x6fb1d6, roughness: 0.6 });
const railMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, metalness: 0.5, roughness: 0.4 });
const voidMat = new THREE.MeshStandardMaterial({ color: 0x5b6066, roughness: 0.8 });

function disposeGroup(g) {
  g.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material && !Array.isArray(o.material) && o.material.map) { o.material.map.dispose(); o.material.dispose(); }
  });
  g.clear();
}

function wallHeight() {
  const H = state.ceiling || 250;
  if (ui.view === 'top') return Math.min(H, 120);
  return ui.wallMode === 'full' ? H : ui.wallMode === 'low' ? Math.min(H, 100) : 12;
}

// Pieza de pared a lo largo de un eje entre a y b.
function wallPiece(axis, line, a, b, y0, y1, t, material, cap = true) {
  const len = b - a, h = y1 - y0;
  if (len <= 0.5 || h <= 0.5) return;
  const geo = axis === 'x' ? new THREE.BoxGeometry(len + t, h, t) : new THREE.BoxGeometry(t, h, len + t);
  const m = new THREE.Mesh(geo, cap ? [material, material, wallTopMat, material, material, material] : material);
  if (axis === 'x') m.position.set((a + b) / 2, y0 + h / 2, line);
  else m.position.set(line, y0 + h / 2, (a + b) / 2);
  m.castShadow = true;
  m.receiveShadow = true;
  planGroup.add(m);
}

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
  const scale = Math.min(0.32, maxW / c.width, maxH / c.height);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(c.width * scale, c.height * scale), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = 2;
  return mesh;
}

function rebuildPlan() {
  requestRender();
  disposeGroup(planGroup);
  const t = state.wallThickness || 10;
  const H = wallHeight();
  const fullH = state.ceiling || 250;
  const openings = allOpenings(state.rooms);

  for (const r of state.rooms) {
    if (r.kind === 'void') {
      const m = new THREE.Mesh(new THREE.BoxGeometry(r.w, H, r.d), voidMat);
      m.position.set(r.x + r.w / 2, H / 2, r.z + r.d / 2);
      m.castShadow = true;
      planGroup.add(m);
      if (ui.labels) {
        const l = makeLabel([r.name, `${r.w} × ${r.d}`], '#ffffff', 'rgba(40,40,40,0.75)', r.w * 0.85, r.d * 0.6);
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
        const l = makeLabel([r.name, `${r.w} × ${r.d} / ${r.d2} cm`, 'vora en diagonal'], r.estimated ? '#9a5d10' : '#2b2926', 'rgba(255,255,255,0.82)', r.w * 0.8, r.d * 0.6);
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
      for (const [a, b] of solid) wallPiece(e.axis, e.line, a, b, 0, H, t, wallMat);
      for (const o of ops) {
        const a = Math.max(o.a, e.a), b = Math.min(o.b, e.b);
        const top = o.type === 'paso' ? 220 : o.type === 'ventanal' ? Math.min(H, 240) : 210;
        if (H > top) wallPiece(e.axis, e.line, a, b, top, H, t, wallMat);
        if (o.type === 'ventanal') {
          // ventanal doble de suelo a techo: cristal entero con un montante en medio
          wallPiece(e.axis, e.line, a, b, 0, top, 2, glassMat, false);
          const mid = (a + b) / 2;
          wallPiece(e.axis, e.line, mid - 2, mid + 2, 0, top, t, wallTopMat, false);
          wallPiece(e.axis, e.line, a, b, 0, 4, t, wallTopMat, false);
        }
        if (o.type === 'ventana') {
          // antepecho de 90; con paredes bajas se dibuja más bajo para que el cristal se vea desde arriba
          const sill = H > 150 ? 90 : Math.round(H * 0.4);
          wallPiece(e.axis, e.line, a, b, 0, Math.min(sill, H), t, wallMat);
          if (H > sill) wallPiece(e.axis, e.line, a, b, sill, Math.min(210, H), 2, glassMat, false);
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
    }

    if (ui.labels) {
      const lines = [r.name, `${r.w} × ${r.d} cm`];
      if (r.estimated) lines.push('mides estimades');
      const l = makeLabel(lines, r.estimated ? '#9a5d10' : '#2b2926', 'rgba(255,255,255,0.82)', r.w * 0.85, r.d * 0.6);
      l.position.set(r.x + r.w / 2, 0.6, r.z + r.d / 2);
      planGroup.add(l);
    }
  }
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

function rebuildItems() {
  requestRender();
  disposeGroup(itemsGroup);
  meshes.clear();
  for (const it of state.items) {
    const g = buildFurniture(it);
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

function footprintLines(it, y, pad = 2) {
  const cs = corners(it, pad);
  const pts = [];
  for (let i = 0; i < 4; i++) {
    const a = cs[i], b = cs[(i + 1) % 4];
    pts.push(a[0], y, a[1], b[0], y, b[1]);
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
function updateOverlays() {
  requestRender();
  const sel = itemById(ui.selected);
  if (sel) {
    const y = (sel.elev || 0) + sel.h + 2;
    const pts = [...footprintLines(sel, 1.5, 3), ...footprintLines(sel, y, 3)];
    selBox.geometry.dispose();
    selBox.geometry = new THREE.BufferGeometry();
    selBox.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    selBox.visible = true;
  } else selBox.visible = false;

  if (conflictLines) { overlayGroup.remove(conflictLines); conflictLines.geometry.dispose(); }
  const bad = conflicts();
  const pts = [];
  for (const id of bad.keys()) pts.push(...footprintLines(itemById(id), 2, 1));
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  conflictLines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xd32f2f }));
  overlayGroup.add(conflictLines);
  ui.conflicts = bad;
  updateMeasures(sel);
}

// Cotes: distància del moble seleccionat a les quatre parets de la seva habitació.
const measureGroup = new THREE.Group();
overlayGroup.add(measureGroup);
const measureMat = new THREE.LineBasicMaterial({ color: 0x1e88e5 });
const measureLabelCache = new Map();
function measureLabel(text) {
  let tex = measureLabelCache.get(text);
  if (!tex) {
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d');
    ctx.font = '700 40px system-ui, sans-serif';
    c.width = Math.ceil(ctx.measureText(text).width) + 28; c.height = 56;
    ctx.font = '700 40px system-ui, sans-serif';
    ctx.fillStyle = '#1e88e5';
    ctx.beginPath(); ctx.roundRect(0, 0, c.width, c.height, 14); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, c.width / 2, c.height / 2 + 2);
    tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.userData.w = c.width; tex.userData.h = c.height;
    if (measureLabelCache.size > 300) { for (const t of measureLabelCache.values()) t.dispose(); measureLabelCache.clear(); }
    measureLabelCache.set(text, tex);
  }
  const sc = 0.42;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(tex.userData.w * sc, tex.userData.h * sc), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false }));
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = 5;
  return m;
}
function wallDistances(it) {
  const r = roomById(it.roomId);
  if (!r || r.kind === 'void') return null;
  const R = innerRect(r, state.wallThickness || 10);
  const b = aabb(it);
  return { R, b, W: b.x0 - R.x0, E: R.x1 - b.x1, N: b.z0 - R.z0, S: R.z1 - b.z1 };
}
function updateMeasures(sel) {
  for (const o of measureGroup.children) { o.geometry.dispose(); o.material.dispose(); } // la textura (cache) no es destrueix
  measureGroup.clear();
  if (!sel || !ui.measures) return;
  const d = wallDistances(sel);
  if (!d) return;
  const { R, b } = d;
  const y = (sel.elev || 0) + 2.5;
  const pts = [];
  const mx = (b.x0 + b.x1) / 2, mz = (b.z0 + b.z1) / 2;
  const segs = [
    { k: 'W', v: d.W, a: [R.x0, mz], c: [b.x0, mz], tick: 'z' },
    { k: 'E', v: d.E, a: [b.x1, mz], c: [R.x1, mz], tick: 'z' },
    { k: 'N', v: d.N, a: [mx, R.z0], c: [mx, b.z0], tick: 'x' },
    { k: 'S', v: d.S, a: [mx, b.z1], c: [mx, R.z1], tick: 'x' },
  ];
  for (const s of segs) {
    if (s.v < 0.5) continue;
    pts.push(s.a[0], y, s.a[1], s.c[0], y, s.c[1]);
    const t = 6;
    for (const p of [s.a, s.c]) {
      if (s.tick === 'z') pts.push(p[0], y, p[1] - t, p[0], y, p[1] + t);
      else pts.push(p[0] - t, y, p[1], p[0] + t, y, p[1]);
    }
    const l = measureLabel(Math.round(s.v) + ' cm');
    l.position.set((s.a[0] + s.c[0]) / 2, y + 0.5, (s.a[1] + s.c[1]) / 2);
    if (s.tick === 'z') l.position.z -= 14; else l.position.x += 0;
    measureGroup.add(l);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  measureGroup.add(new THREE.LineSegments(geo, measureMat));
}
function distHtml(it) {
  const d = wallDistances(it);
  if (!d) return '';
  const f = (v) => `<b>${Math.round(v)}</b>`;
  return `A les parets: esq. ${f(d.W)} · dreta ${f(d.E)} · dalt ${f(d.N)} · baix ${f(d.S)} cm`;
}

// ---------------------------------------------------------------- interacción
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
let drag = null;

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

renderer.domElement.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  setPointer(e);
  const hits = raycaster.intersectObjects(itemsGroup.children, true);
  const hit = hits.find((h) => h.object.userData.itemId);
  if (hit) {
    const it = itemById(hit.object.userData.itemId);
    select(it.id);
    if (it.locked) return;
    const p = floorPoint();
    if (!p) return;
    drag = { id: it.id, dx: it.x - p.x, dz: it.z - p.z, moved: false, before: JSON.stringify(state) };
    controls.enabled = false;
    renderer.domElement.setPointerCapture(e.pointerId);
  } else {
    drag = { empty: true, x: e.clientX, y: e.clientY };
  }
});

renderer.domElement.addEventListener('pointermove', (e) => {
  if (!drag || drag.empty) return;
  setPointer(e);
  const p = floorPoint();
  if (!p) return;
  const it = itemById(drag.id);
  const step = ui.snap ? 5 : 1;
  it.x = Math.round((p.x + drag.dx) / step) * step;
  it.z = Math.round((p.z + drag.dz) / step) * step;
  drag.moved = true;
  updateItem(it);
  renderProps(true);
});

renderer.domElement.addEventListener('pointerup', (e) => {
  if (drag && drag.empty) {
    if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 4) select(null);
  } else if (drag) {
    const it = itemById(drag.id);
    if (drag.moved) {
      history.past.push(drag.before); history.future = [];
      const r = roomAt(state.rooms, it.x, it.z);
      if (r) it.roomId = r.id;
      save(); renderAll();
    }
    controls.enabled = true;
  }
  drag = null;
});

window.addEventListener('keydown', (e) => {
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
  const it = itemById(ui.selected);
  if (!it) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicate(it); return; }
  if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeItem(it.id); return; }
  if (e.key === 'Escape') { select(null); return; }
  if (it.locked) return;
  const step = e.shiftKey ? 10 : 1;
  let changed = true;
  if (e.key.toLowerCase() === 'r') rotate(it, e.shiftKey ? -90 : 90);
  else if (e.key.toLowerCase() === 'q') rotate(it, -15);
  else if (e.key.toLowerCase() === 'e') rotate(it, 15);
  else if (e.key === 'ArrowLeft') { commit(); it.x -= step; }
  else if (e.key === 'ArrowRight') { commit(); it.x += step; }
  else if (e.key === 'ArrowUp') { commit(); it.z -= step; }
  else if (e.key === 'ArrowDown') { commit(); it.z += step; }
  else changed = false;
  if (changed) { e.preventDefault(); const r = roomAt(state.rooms, it.x, it.z); if (r) it.roomId = r.id; updateItem(it); save(); renderProps(); renderItemList(); }
});

function rotate(it, deg) {
  commit();
  it.rot = (((it.rot || 0) + deg) % 360 + 360) % 360;
  updateItem(it); save(); renderProps();
}

function select(id) {
  ui.selected = id;
  updateOverlays();
  renderProps();
  renderItemList();
}

function duplicate(it) {
  commit();
  const c = { ...clone(it), id: newItem(it.type).id, x: it.x + 20, z: it.z + 20, locked: false };
  state.items.push(c);
  save(); rebuildItems(); select(c.id);
}

function removeItem(id) {
  commit();
  state.items = state.items.filter((i) => i.id !== id);
  if (ui.selected === id) ui.selected = null;
  save(); rebuildItems(); renderAll();
}

// Coloca un mueble nuevo en un sitio libre de la habitación.
function findFreeSpot(it, room) {
  const t = state.wallThickness || 10;
  const R = innerRect(room, t);
  const others = state.items.filter((o) => o.roomId === room.id && o.id !== it.id && o.type !== 'alfombra');
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
  for (let i = 0; i < qty; i++) {
    const it = newItem(type, { ...props, roomId: room.id });
    if (qty > 1) it.name = `${props.name || CATALOG[type].label} ${i + 1}`;
    const p = findFreeSpot(it, room);
    it.x = Math.round(p.x); it.z = Math.round(p.z);
    state.items.push(it);
    last = it;
  }
  save(); rebuildItems();
  if (last) select(last.id);
  renderAll();
}

// ---------------------------------------------------------------- UI
const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const roomOptions = (sel) => usableRooms().map((r) => `<option value="${r.id}" ${r.id === sel ? 'selected' : ''}>${esc(r.name)}</option>`).join('');

document.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('.tabs button').forEach((x) => x.classList.toggle('active', x === b));
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.id === 'tab-' + b.dataset.tab));
}));

document.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
$('#wallMode').addEventListener('change', (e) => { ui.wallMode = e.target.value; rebuildPlan(); });
$('#snap')?.addEventListener('change', (e) => { ui.snap = e.target.checked; }); // l'imant de 5 cm queda actiu sense botó
$('#labels').addEventListener('change', (e) => { ui.labels = e.target.checked; rebuildPlan(); });
$('#measures').addEventListener('change', (e) => { ui.measures = e.target.checked; updateOverlays(); });

// Barra flotant (mòbil) per al moble seleccionat.
const selbar = document.getElementById('selbar');
selbar.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
  const it = itemById(ui.selected);
  if (!it) return;
  const act = b.dataset.act;
  if (act === 'props') { ui.propsOpen = !ui.propsOpen; renderProps(); return; }
  if (it.locked && act !== 'dup') return;
  if (act === 'rl') rotate(it, -90);
  else if (act === 'rr') rotate(it, 90);
  else if (act === 'dup') duplicate(it);
  else if (act === 'del') removeItem(it.id);
}));
function updateSelbar() {
  const it = itemById(ui.selected);
  selbar.hidden = !it;
  selbar.querySelector('[data-act=props]').classList.toggle('on', ui.propsOpen);
}
$('#undo').addEventListener('click', undo);
$('#redo').addEventListener('click', redo);

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
    <div class="btns"><button class="btn" id="f-add">Afegeix al plànol</button></div>
    <p class="note">Exemple ràpid: <button class="btn secondary small" id="f-example">2 cadires + 2 taules + TV</button> a l’habitació triada.</p>
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
  renderItemList();
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
      <li data-id="${i.id}" class="${i.id === ui.selected ? 'sel' : ''}">
        <span class="sw" style="background:${esc(i.color)}"></span>
        <span class="nm">${esc(i.name)}${i.locked ? ' 🔒' : ''}</span>
        ${bad.has(i.id) ? `<span class="badge bad" title="${esc(bad.get(i.id))}">xoc</span>` : ''}
        <span class="dm">${i.w}×${i.d}×${i.h}</span>
      </li>`).join('')}</ul>`;
  }).join('') + (state.items.some((i) => !roomById(i.roomId)) ? '<p class="note">Hi ha mobles fora de qualsevol habitació.</p>' : '');
  el.querySelectorAll('li[data-id]').forEach((li) => li.addEventListener('click', () => select(li.dataset.id)));
}

// --- Panel de propiedades del mueble seleccionado
function renderProps(onlyPos = false) {
  const el = $('#props');
  const it = itemById(ui.selected);
  updateSelbar();
  if (!it) { el.hidden = true; return; }
  if (onlyPos && !el.hidden && el.dataset.id === it.id) {
    $('#p-x').value = it.x; $('#p-z').value = it.z;
    const dl = $('#p-dist'); if (dl) dl.innerHTML = distHtml(it);
    return;
  }
  el.hidden = false;
  el.classList.toggle('collapsed', isMobile() && !ui.propsOpen);
  el.dataset.id = it.id;
  const bad = ui.conflicts?.get(it.id);
  el.innerHTML = `
    <h3><span class="sw" style="width:14px;height:14px;border-radius:3px;background:${esc(it.color)}"></span>${esc(it.name)} ${bad ? `<span class="badge bad">${esc(bad)}</span>` : ''}<button class="close" id="p-close" title="Tanca">×</button></h3>
    <div class="dist" id="p-dist">${distHtml(it)}</div>
    <div class="row c2">
      <label>Nom<input type="text" id="p-name" value="${esc(it.name)}" /></label>
      <label>Tipus<select id="p-type">${Object.entries(CATALOG).map(([k, v]) => `<option value="${k}" ${k === it.type ? 'selected' : ''}>${v.label}</option>`).join('')}</select></label>
    </div>
    <div class="row c3">
      <label>Amplada<input type="number" id="p-w" min="1" value="${it.w}" /></label>
      <label>Fons<input type="number" id="p-d" min="1" value="${it.d}" /></label>
      <label>Alçada<input type="number" id="p-h" min="1" value="${it.h}" /></label>
    </div>
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
    <label style="flex-direction:row;align-items:center;gap:6px;margin:4px 0 8px"><input type="checkbox" id="p-lock" ${it.locked ? 'checked' : ''}/> Fix (no es mou a les propostes)</label>
    <div class="btns">
      <button class="btn secondary small" id="p-rl">⟲ 90°</button>
      <button class="btn secondary small" id="p-rr">⟳ 90°</button>
      <button class="btn secondary small" id="p-dup">Duplica</button>
      <button class="btn danger small" id="p-del">Elimina</button>
    </div>`;
  const num = (id) => +$(id).value;
  const apply = (fn, rebuild) => { commit(); fn(); save(); updateItem(it, rebuild); renderProps(); renderItemList(); };
  $('#p-close').addEventListener('click', () => { if (isMobile()) { ui.propsOpen = false; renderProps(); } else select(null); });
  $('#p-name').addEventListener('change', (e) => apply(() => { it.name = e.target.value; }));
  $('#p-type').addEventListener('change', (e) => apply(() => { it.type = e.target.value; }, true));
  for (const k of ['w', 'd', 'h']) $('#p-' + k).addEventListener('change', () => apply(() => { it[k] = Math.max(1, num('#p-' + k)); }, true));
  $('#p-x').addEventListener('change', () => apply(() => { it.x = num('#p-x'); }));
  $('#p-z').addEventListener('change', () => apply(() => { it.z = num('#p-z'); }));
  $('#p-rot').addEventListener('change', () => apply(() => { it.rot = ((num('#p-rot') % 360) + 360) % 360; }));
  $('#p-elev').addEventListener('change', () => apply(() => { it.elev = Math.max(0, num('#p-elev')); }));
  $('#p-color').addEventListener('change', (e) => apply(() => { it.color = e.target.value; }, true));
  $('#p-lock').addEventListener('change', (e) => apply(() => { it.locked = e.target.checked; }));
  $('#p-room').addEventListener('change', (e) => apply(() => {
    it.roomId = e.target.value;
    const p = findFreeSpot(it, roomById(it.roomId));
    it.x = Math.round(p.x); it.z = Math.round(p.z);
  }));
  $('#p-rl').addEventListener('click', () => rotate(it, -90));
  $('#p-rr').addEventListener('click', () => rotate(it, 90));
  $('#p-dup').addEventListener('click', () => duplicate(it));
  $('#p-del').addEventListener('click', () => removeItem(it.id));
}

// --- Pestaña Distribuir
function renderDistribuir() {
  const el = $('#tab-distribuir');
  if (!roomById(ui.layoutRoom)) {
    const withItems = usableRooms().find((r) => state.items.some((i) => i.roomId === r.id));
    ui.layoutRoom = (withItems || usableRooms()[0])?.id;
  }
  const room = roomById(ui.layoutRoom);
  const its = state.items.filter((i) => i.roomId === ui.layoutRoom);
  const locked = its.filter((i) => i.locked).length;
  el.innerHTML = `
    <h2>Propostes de distribució</h2>
    <div class="row"><label>Habitació<select id="d-room">${roomOptions(ui.layoutRoom)}</select></label></div>
    <p class="note">${its.length ? `${its.length} mobles a ${esc(room.name)}${locked ? `, ${locked} de fixos` : ''}.` : 'Aquesta habitació no té mobles. Afegeix-los a la pestanya Mobles.'}
    L’app prova centenars de col·locacions (TV a la paret, sofà davant de la TV, cadires al voltant de la taula, llit contra la paret, pas lliure davant de les portes) i t’ensenya les millors.</p>
    <div class="btns">
      <button class="btn" id="d-gen" ${its.length ? '' : 'disabled'}>Genera propostes</button>
      <button class="btn secondary" id="d-focus">Mostra l’habitació</button>
    </div>
    <div class="progress" id="d-prog" hidden><div class="bar"></div><span></span></div>
    <div class="layouts" id="d-cards"></div>`;
  $('#d-room').addEventListener('change', (e) => { ui.layoutRoom = e.target.value; ui.proposals = []; renderDistribuir(); });
  $('#d-focus').addEventListener('click', () => frameCamera(room));
  $('#d-gen').addEventListener('click', async () => {
    const btn = $('#d-gen'), prog = $('#d-prog');
    if (btn.disabled) return;
    btn.disabled = true; prog.hidden = false;
    ui.seed = (ui.seed * 9301 + 49297) % 233280 + Date.now() % 1000;
    const show = (f) => { prog.querySelector('.bar').style.width = Math.round(f * 100) + '%'; prog.querySelector('span').textContent = `Provant col·locacions… ${Math.round(f * 100)} %`; };
    show(0);
    ui.proposals = await generateLayoutsAsync(room, its, state.rooms, { wallThickness: state.wallThickness, seed: ui.seed, count: 4 }, show);
    if (!$('#d-gen')) return; // la pestanya s'ha tornat a dibuixar mentrestant
    $('#d-gen').disabled = false; $('#d-prog').hidden = true;
    renderProposals(roomById(ui.layoutRoom));
  });
  renderProposals(room);
}

function renderProposals(room) {
  const el = $('#d-cards');
  if (!el) return;
  el.innerHTML = ui.proposals.map((p, i) => `
    <div class="layout-card" data-i="${i}">
      <canvas width="320" height="240"></canvas>
      <div class="t">${esc(p.name)}</div>
      <div class="r">${esc(p.rating)}</div>
      <div class="btns"><button class="btn small" data-apply="${i}">Aplica</button></div>
    </div>`).join('');
  el.querySelectorAll('.layout-card').forEach((card) => {
    const p = ui.proposals[+card.dataset.i];
    drawPreview(card.querySelector('canvas'), room, p);
    card.addEventListener('click', () => applyProposal(room, p));
  });
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

function drawPreview(cv, room, p) {
  const ctx = cv.getContext('2d');
  const pad = 14;
  const s = Math.min((cv.width - 2 * pad) / room.w, (cv.height - 2 * pad) / room.d);
  const ox = (cv.width - room.w * s) / 2 - room.x * s, oz = (cv.height - room.d * s) / 2 - room.z * s;
  const X = (x) => ox + x * s, Z = (z) => oz + z * s;
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.fillStyle = room.color || '#c89b6a';
  ctx.globalAlpha = 0.35;
  ctx.fillRect(X(room.x), Z(room.z), room.w * s, room.d * s);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = '#2b2926'; ctx.lineWidth = 3;
  ctx.strokeRect(X(room.x), Z(room.z), room.w * s, room.d * s);
  // huecos
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4;
  for (const o of allOpenings(state.rooms)) {
    const edge = o.axis === 'x' ? [room.z, room.z + room.d] : [room.x, room.x + room.w];
    if (!edge.some((l) => Math.abs(l - o.line) < 1)) continue;
    const lim = o.axis === 'x' ? [room.x, room.x + room.w] : [room.z, room.z + room.d];
    const a = Math.max(o.a, lim[0]), b = Math.min(o.b, lim[1]);
    if (b <= a) continue;
    ctx.strokeStyle = o.type === 'ventana' || o.type === 'ventanal' ? '#7fb2d0' : '#ffffff';
    ctx.lineWidth = o.type === 'ventanal' ? 7 : 4;
    ctx.beginPath();
    if (o.axis === 'x') { ctx.moveTo(X(a), Z(o.line)); ctx.lineTo(X(b), Z(o.line)); }
    else { ctx.moveTo(X(o.line), Z(a)); ctx.lineTo(X(o.line), Z(b)); }
    ctx.stroke();
    if (o.type === 'ventanal') { // montante central del ventanal doble
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.beginPath();
      const m = (a + b) / 2;
      if (o.axis === 'x') { ctx.moveTo(X(m), Z(o.line) - 4); ctx.lineTo(X(m), Z(o.line) + 4); }
      else { ctx.moveTo(X(o.line) - 4, Z(m)); ctx.lineTo(X(o.line) + 4, Z(m)); }
      ctx.stroke();
    }
  }
  const its = state.items.filter((i) => i.roomId === room.id).map((i) => ({ ...i, ...(p.placements[i.id] || {}) }));
  its.sort((a, b) => (a.type === 'alfombra' ? -1 : 0) - (b.type === 'alfombra' ? -1 : 0) || (a.elev || 0) - (b.elev || 0));
  for (const it of its) {
    const cs = corners(it);
    ctx.beginPath();
    cs.forEach(([x, z], k) => (k ? ctx.lineTo(X(x), Z(z)) : ctx.moveTo(X(x), Z(z))));
    ctx.closePath();
    ctx.fillStyle = it.color; ctx.globalAlpha = it.type === 'alfombra' ? 0.5 : 0.95; ctx.fill(); ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = 1; ctx.stroke();
    // marca del frente
    const f = { x: Math.sin(it.rot * DEG), z: Math.cos(it.rot * DEG) };
    ctx.strokeStyle = '#d9864d'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(X(it.x), Z(it.z));
    ctx.lineTo(X(it.x + f.x * (it.d / 2)), Z(it.z + f.z * (it.d / 2))); ctx.stroke();
  }
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
    <div class="btns"><button class="btn secondary" id="g-addroom">+ Afegeix una habitació</button></div>`;
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
          </select></label>
        </div>
        <div class="row c4">
          <label>Amplada<input type="number" data-k="w" min="20" value="${r.w}" /></label>
          <label>Fons<input type="number" data-k="d" min="20" value="${r.d}" /></label>
          ${r.kind === 'terrace' ? `<label title="Fons a l’extrem dret si la vora exterior va en diagonal (0 = recta)">Fons dreta<input type="number" data-k="d2" min="0" value="${r.d2 || 0}" /></label>` : ''}
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
        save(); rebuildPlan();
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
function renderDatos() {
  const el = $('#tab-datos');
  el.innerHTML = `
    <h2>Desa i comparteix</h2>
    <p class="note">Tot es desa automàticament en aquest navegador i al núvol. Per passar-ho a un altre ordinador, exporta el fitxer i després importa’l allà.</p>
    <div class="btns">
      <button class="btn" id="x-export">Exporta (.json)</button>
      <label class="btn secondary" style="display:inline-block">Importa<input type="file" id="x-import" accept="application/json,.json" hidden /></label>
      <button class="btn secondary" id="x-png">Captura (.png)</button>
    </div>
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
      commit(); state = s; afterStateReplace(); frameCamera();
    } catch (err) { el.insertAdjacentHTML('beforeend', '<p class="note" style="color:var(--bad)">El fitxer no és vàlid.</p>'); }
  });
  $('#x-png').addEventListener('click', () => {
    renderer.render(scene, camera);
    const a = document.createElement('a');
    a.href = renderer.domElement.toDataURL('image/png'); a.download = 'planta-3d.png'; a.click();
  });
  $('#x-clear').addEventListener('click', () => { commit(); state.items = []; ui.selected = null; afterStateReplace(); });
  $('#x-reset').addEventListener('click', () => { commit(); state = clone(DEFAULT_PLAN); ui.selected = null; afterStateReplace(); frameCamera(); });
}

function renderAll() {
  updateOverlays();
  renderMuebles();
  renderDistribuir();
  renderPlano();
  renderDatos();
  renderProps();
}

// ---------------------------------------------------------------- arranque
window.addEventListener('resize', resize);
new ResizeObserver(resize).observe(wrap);
resize();
rebuildPlan();
rebuildItems();
frameCamera();
renderAll();

controls3d.addEventListener('change', requestRender);
controlsTop.addEventListener('change', requestRender);
function loop() {
  const moved = controls.update();
  if (moved || needsRender) {
    needsRender = false;
    renderer.render(scene, camera);
  }
  requestAnimationFrame(loop);
}
loop();

// ---------------------------------------------------------------- inicio de sesión (Firebase)
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
      acc.querySelector('.who').textContent = u.email;
      if (initial) { history.past = []; history.future = []; const v = initial.version || 1; cloudBase = clone(initial); state = migratePlan(initial); afterStateReplace(v < DEFAULT_PLAN.version); frameCamera(); setSync('guardado'); }
      else save();
    },
    onRemoteState: (s, by) => {
      // Fusió amb els canvis locals que encara no s'han desat: no es perd res de cap dels dos.
      const merged = mergeStates(cloudBase, state, s);
      cloudBase = clone(s);
      const needsResave = JSON.stringify(merged) !== JSON.stringify(s);
      state = migratePlan(merged);
      afterStateReplace(needsResave);
      if (!needsResave) setSync('Actualitzat per ' + by);
    },
  }).catch((e) => showGate(`<p class="gate-err">Error en carregar Firebase: ${esc(e.message)}</p>`));
  document.getElementById('signout').addEventListener('click', () => signOutUser());
}

// Acceso para depuración desde la consola.
window.planta3d = {
  screenOf(x, z, y = 40) {
    const v = new THREE.Vector3(x, y, z).project(camera);
    const r = renderer.domElement.getBoundingClientRect();
    return [r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height];
  },
  get state() { return state; }, get conflicts() { return [...(ui.conflicts || new Map())]; }, generateLayouts, addItems, frameCamera, setView };
