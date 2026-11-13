import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';
import { DEFAULT_PLAN } from './plan.js';
import { CATALOG, buildFurniture, newItem } from './furniture.js';
import { generateLayouts } from './layout.js';
import { cloudEnabled, initCloud, signIn, signOutUser, saveRemote } from './cloud.js?v=3';
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

let state = loadState();
const ui = { selected: null, view: '3d', wallMode: 'low', snap: true, labels: true, layoutRoom: null, proposals: [], seed: 1, addRoom: null };
const history = { past: [], future: [] };

function save(remote = true) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* ignorar */ }
  if (remote) saveRemote(state, setSync);
}
function setSync(st) {
  const el = document.getElementById('sync');
  if (!el) return;
  el.textContent = st === 'guardado' ? 'Guardado en la nube' : st === 'pendiente' ? 'Guardando…' : st.startsWith('error') ? 'Error al guardar' : st;
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
wrap.appendChild(renderer.domElement);

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

scene.add(new THREE.HemisphereLight(0xffffff, 0xb0a898, 2.2));
const sun = new THREE.DirectionalLight(0xffffff, 1.3);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.bias = -0.0005;
scene.add(sun, sun.target);

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
  const s = b.size * 0.8;
  Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 10, far: 4000 });
  sun.shadow.camera.updateProjectionMatrix();
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
const wallMat = new THREE.MeshStandardMaterial({ color: 0xf3f1ec, roughness: 0.9 });
const wallTopMat = new THREE.MeshStandardMaterial({ color: 0x2b2926, roughness: 0.9 });
const glassMat = new THREE.MeshStandardMaterial({ color: 0x9fc3d8, transparent: true, opacity: 0.35, roughness: 0.1 });
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
    const floorMat = new THREE.MeshStandardMaterial({ color: r.color || '#c89b6a', roughness: 0.85 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(r.w, r.d), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(r.x + r.w / 2, 0, r.z + r.d / 2);
    floor.receiveShadow = true;
    floor.userData.roomId = r.id;
    planGroup.add(floor);

    if (r.kind === 'terrace') {
      // Tiles
      const grid = new THREE.GridHelper(Math.max(r.w, r.d), Math.round(Math.max(r.w, r.d) / 33), 0x7a4a30, 0x7a4a30);
      grid.position.set(r.x + r.w / 2, 0.3, r.z + r.d / 2);
      grid.material.opacity = 0.35; grid.material.transparent = true;
      grid.scale.set(r.w / Math.max(r.w, r.d), 1, r.d / Math.max(r.w, r.d));
      planGroup.add(grid);
    }

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
        const top = o.type === 'paso' ? 220 : 210;
        if (H > top) wallPiece(e.axis, e.line, a, b, top, H, t, wallMat);
        if (o.type === 'ventana') {
          wallPiece(e.axis, e.line, a, b, 0, Math.min(90, H), t, wallMat);
          if (H > 90) wallPiece(e.axis, e.line, a, b, 90, Math.min(210, H), 2, glassMat, false);
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
      if (r.estimated) lines.push('medidas estimadas');
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
    if (r && outsideAmount(innerRect(r, t), aabb(it)) > 1) bad.set(it.id, 'Sale de la habitación');
  }
  for (let a = 0; a < solid.length; a++) for (let b = a + 1; b < solid.length; b++) {
    const A = solid[a], B = solid[b];
    const a0 = A.elev || 0, a1 = a0 + A.h, b0 = B.elev || 0, b1 = b0 + B.h;
    if (a1 <= b0 || b1 <= a0) continue;
    const isSeatTable = (x, y) => x.type === 'silla' && ['mesa', 'escritorio'].includes(y.type);
    if (isSeatTable(A, B) || isSeatTable(B, A)) continue; // las sillas pueden meterse bajo la mesa
    if (overlaps(A, B, -1)) {
      bad.set(A.id, 'Choca con ' + B.name);
      bad.set(B.id, 'Choca con ' + A.name);
    }
  }
  return bad;
}

let conflictLines = null;
function updateOverlays() {
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
$('#snap').addEventListener('change', (e) => { ui.snap = e.target.checked; });
$('#labels').addEventListener('change', (e) => { ui.labels = e.target.checked; rebuildPlan(); });
$('#undo').addEventListener('click', undo);
$('#redo').addEventListener('click', redo);

// --- Pestaña Muebles
const addForm = { type: 'silla', qty: 1, roomId: 'salon', ...CATALOG.silla, name: CATALOG.silla.label, elev: 0 };

function renderMuebles() {
  const el = $('#tab-muebles');
  const f = addForm;
  if (!roomById(f.roomId)) f.roomId = usableRooms()[0]?.id;
  el.innerHTML = `
    <h2>Crear mueble</h2>
    <div class="row c2">
      <label>Tipo<select id="f-type">${Object.entries(CATALOG).map(([k, v]) => `<option value="${k}" ${k === f.type ? 'selected' : ''}>${v.label}</option>`).join('')}</select></label>
      <label>Nombre<input type="text" id="f-name" value="${esc(f.name)}" /></label>
    </div>
    <div class="row c3">
      <label>Ancho (cm)<input type="number" id="f-w" min="1" value="${f.w}" /></label>
      <label>Fondo (cm)<input type="number" id="f-d" min="1" value="${f.d}" /></label>
      <label>Alto (cm)<input type="number" id="f-h" min="1" value="${f.h}" /></label>
    </div>
    <div class="row c3">
      <label>Elevación<input type="number" id="f-elev" min="0" value="${f.elev || 0}" title="Altura desde el suelo, por ejemplo una TV colgada" /></label>
      <label>Color<input type="color" id="f-color" value="${f.color}" /></label>
      <label>Cantidad<input type="number" id="f-qty" min="1" max="30" value="${f.qty}" /></label>
    </div>
    <div class="row"><label>Habitación<select id="f-room">${roomOptions(f.roomId)}</select></label></div>
    <div class="btns"><button class="btn" id="f-add">Añadir al plano</button></div>
    <p class="note">Ejemplo rápido: <button class="btn secondary small" id="f-example">2 sillas + 2 mesas + TV</button> en la habitación elegida.</p>
    <h2>En el plano</h2>
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
    addItems('mesa', { name: 'Mesa' }, 2, room);
    addItems('silla', { name: 'Silla' }, 2, room);
    addItems('tv', { name: 'Televisión' }, 1, room);
  });
  renderItemList();
}

function renderItemList() {
  const el = $('#item-list');
  if (!el) return;
  if (!state.items.length) { el.innerHTML = '<p class="note">Todavía no hay muebles. Crea uno arriba y aparecerá en la habitación elegida.</p>'; return; }
  const bad = ui.conflicts || new Map();
  el.innerHTML = usableRooms().map((r) => {
    const its = state.items.filter((i) => i.roomId === r.id);
    if (!its.length) return '';
    return `<h2>${esc(r.name)}</h2><ul class="list">${its.map((i) => `
      <li data-id="${i.id}" class="${i.id === ui.selected ? 'sel' : ''}">
        <span class="sw" style="background:${esc(i.color)}"></span>
        <span class="nm">${esc(i.name)}${i.locked ? ' 🔒' : ''}</span>
        ${bad.has(i.id) ? `<span class="badge bad" title="${esc(bad.get(i.id))}">choque</span>` : ''}
        <span class="dm">${i.w}×${i.d}×${i.h}</span>
      </li>`).join('')}</ul>`;
  }).join('') + (state.items.some((i) => !roomById(i.roomId)) ? '<p class="note">Hay muebles fuera de cualquier habitación.</p>' : '');
  el.querySelectorAll('li[data-id]').forEach((li) => li.addEventListener('click', () => select(li.dataset.id)));
}

// --- Panel de propiedades del mueble seleccionado
function renderProps(onlyPos = false) {
  const el = $('#props');
  const it = itemById(ui.selected);
  if (!it) { el.hidden = true; return; }
  if (onlyPos && !el.hidden && el.dataset.id === it.id) {
    $('#p-x').value = it.x; $('#p-z').value = it.z;
    return;
  }
  el.hidden = false;
  el.dataset.id = it.id;
  const bad = ui.conflicts?.get(it.id);
  el.innerHTML = `
    <h3><span class="sw" style="width:14px;height:14px;border-radius:3px;background:${esc(it.color)}"></span>${esc(it.name)} ${bad ? `<span class="badge bad">${esc(bad)}</span>` : ''}<button class="close" id="p-close" title="Cerrar">×</button></h3>
    <div class="row c2">
      <label>Nombre<input type="text" id="p-name" value="${esc(it.name)}" /></label>
      <label>Tipo<select id="p-type">${Object.entries(CATALOG).map(([k, v]) => `<option value="${k}" ${k === it.type ? 'selected' : ''}>${v.label}</option>`).join('')}</select></label>
    </div>
    <div class="row c3">
      <label>Ancho<input type="number" id="p-w" min="1" value="${it.w}" /></label>
      <label>Fondo<input type="number" id="p-d" min="1" value="${it.d}" /></label>
      <label>Alto<input type="number" id="p-h" min="1" value="${it.h}" /></label>
    </div>
    <div class="row c4">
      <label>X<input type="number" id="p-x" value="${it.x}" /></label>
      <label>Z<input type="number" id="p-z" value="${it.z}" /></label>
      <label>Giro °<input type="number" id="p-rot" step="15" value="${it.rot}" /></label>
      <label>Elev.<input type="number" id="p-elev" min="0" value="${it.elev || 0}" /></label>
    </div>
    <div class="row c2">
      <label>Color<input type="color" id="p-color" value="${it.color}" /></label>
      <label>Habitación<select id="p-room">${roomOptions(it.roomId)}</select></label>
    </div>
    <label style="flex-direction:row;align-items:center;gap:6px;margin:4px 0 8px"><input type="checkbox" id="p-lock" ${it.locked ? 'checked' : ''}/> Fijo (no se mueve en las propuestas)</label>
    <div class="btns">
      <button class="btn secondary small" id="p-rl">⟲ 90°</button>
      <button class="btn secondary small" id="p-rr">⟳ 90°</button>
      <button class="btn secondary small" id="p-dup">Duplicar</button>
      <button class="btn danger small" id="p-del">Eliminar</button>
    </div>`;
  const num = (id) => +$(id).value;
  const apply = (fn, rebuild) => { commit(); fn(); save(); updateItem(it, rebuild); renderProps(); renderItemList(); };
  $('#p-close').addEventListener('click', () => select(null));
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
    <h2>Propuestas de distribución</h2>
    <div class="row"><label>Habitación<select id="d-room">${roomOptions(ui.layoutRoom)}</select></label></div>
    <p class="note">${its.length ? `${its.length} muebles en ${esc(room.name)}${locked ? `, ${locked} fijos` : ''}.` : 'Esta habitación no tiene muebles. Añádelos en la pestaña Muebles.'}
    La app prueba cientos de colocaciones (TV en pared, sofá frente a la TV, sillas alrededor de la mesa, cama contra la pared, paso libre delante de las puertas) y te enseña las mejores.</p>
    <div class="btns">
      <button class="btn" id="d-gen" ${its.length ? '' : 'disabled'}>Generar propuestas</button>
      <button class="btn secondary" id="d-focus">Ver habitación</button>
    </div>
    <div class="layouts" id="d-cards"></div>`;
  $('#d-room').addEventListener('change', (e) => { ui.layoutRoom = e.target.value; ui.proposals = []; renderDistribuir(); });
  $('#d-focus').addEventListener('click', () => frameCamera(room));
  $('#d-gen').addEventListener('click', () => {
    ui.seed = (ui.seed * 9301 + 49297) % 233280 + Date.now() % 1000;
    ui.proposals = generateLayouts(room, its, state.rooms, { wallThickness: state.wallThickness, seed: ui.seed, count: 4 });
    renderProposals(room);
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
      <div class="btns"><button class="btn small" data-apply="${i}">Aplicar</button></div>
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
    ctx.strokeStyle = o.type === 'ventana' ? '#7fb2d0' : '#ffffff';
    ctx.beginPath();
    if (o.axis === 'x') { ctx.moveTo(X(a), Z(o.line)); ctx.lineTo(X(b), Z(o.line)); }
    else { ctx.moveTo(X(o.line), Z(a)); ctx.lineTo(X(o.line), Z(b)); }
    ctx.stroke();
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
      <label>Altura del techo (cm) ${state.ceilingEstimated ? '<span class="badge">estimada</span>' : ''}<input type="number" id="g-ceil" min="150" max="500" value="${state.ceiling}" /></label>
      <label>Grosor de pared (cm)<input type="number" id="g-wall" min="4" max="40" value="${state.wallThickness}" /></label>
    </div>
    <p class="note">Las medidas son interiores, en centímetros. X va de izquierda a derecha y Z de arriba abajo en la vista en planta. Las marcadas como <span class="badge">estimadas</span> no aparecen en el plano: corrígelas cuando las midas.</p>
    <h2>Habitaciones</h2>
    <div id="rooms"></div>
    <div class="btns"><button class="btn secondary" id="g-addroom">+ Añadir habitación</button></div>`;
  $('#g-ceil').addEventListener('change', (e) => { commit(); state.ceiling = Math.max(150, +e.target.value || 250); state.ceilingEstimated = false; save(); rebuildPlan(); renderPlano(); });
  $('#g-wall').addEventListener('change', (e) => { commit(); state.wallThickness = Math.max(4, +e.target.value || 10); save(); rebuildPlan(); updateOverlays(); });
  $('#g-addroom').addEventListener('click', () => {
    commit();
    const b = planBounds();
    const id = 'r' + Math.random().toString(36).slice(2, 7);
    state.rooms.push({ id, name: 'Nueva habitación', kind: 'room', color: '#c89b6a', x: b.x1, z: b.z0, w: 300, d: 300, estimated: true, openings: [] });
    ui.addRoom = id;
    save(); rebuildPlan(); renderAll();
  });
  const wrapR = $('#rooms');
  wrapR.innerHTML = state.rooms.map((r) => `
    <details class="room-card ${r.estimated ? 'est' : ''}" data-id="${r.id}" ${ui.addRoom === r.id ? 'open' : ''}>
      <summary><span class="sw" style="display:inline-block;width:12px;height:12px;border-radius:3px;background:${esc(r.color)}"></span>${esc(r.name)} ${r.estimated ? '<span class="badge">estimada</span>' : ''}<span class="dm">${r.w} × ${r.d}</span></summary>
      <div style="margin-top:10px">
        <div class="row c2">
          <label>Nombre<input type="text" data-k="name" value="${esc(r.name)}" /></label>
          <label>Tipo<select data-k="kind">
            <option value="room" ${r.kind === 'room' ? 'selected' : ''}>Habitación</option>
            <option value="terrace" ${r.kind === 'terrace' ? 'selected' : ''}>Terraza</option>
            <option value="void" ${r.kind === 'void' ? 'selected' : ''}>Hueco (no habitable)</option>
          </select></label>
        </div>
        <div class="row c4">
          <label>Ancho<input type="number" data-k="w" min="20" value="${r.w}" /></label>
          <label>Fondo<input type="number" data-k="d" min="20" value="${r.d}" /></label>
          <label>X<input type="number" data-k="x" value="${r.x}" /></label>
          <label>Z<input type="number" data-k="z" value="${r.z}" /></label>
        </div>
        <div class="row c2">
          <label>Color del suelo<input type="color" data-k="color" value="${esc(r.color)}" /></label>
          <label style="flex-direction:row;align-items:center;gap:6px;margin-top:18px"><input type="checkbox" data-k="estimated" ${r.estimated ? 'checked' : ''}/> Medidas estimadas</label>
        </div>
        ${r.notes ? `<p class="note">${esc(r.notes)}</p>` : ''}
        <div class="openings">
          <label>Puertas, ventanas y pasos (pared, desde la esquina, ancho, tipo)</label>
          ${(r.openings || []).map((o, k) => `
            <div class="op-row" data-op="${k}">
              <select data-ok="wall">${['N', 'S', 'E', 'W'].map((w) => `<option ${o.wall === w ? 'selected' : ''} value="${w}">${{ N: 'Arriba', S: 'Abajo', E: 'Dcha', W: 'Izq' }[w]}</option>`).join('')}</select>
              <input type="number" data-ok="offset" value="${o.offset}" title="Distancia desde la esquina superior o izquierda" />
              <input type="number" data-ok="width" value="${o.width}" title="Ancho del hueco" />
              <select data-ok="type">${['puerta', 'ventana', 'paso'].map((t) => `<option ${o.type === t ? 'selected' : ''}>${t}</option>`).join('')}</select>
              <button data-del-op="${k}" title="Quitar">×</button>
            </div>`).join('')}
          <div class="btns">
            <button class="btn secondary small" data-add-op>+ Hueco</button>
            <button class="btn secondary small" data-focus>Ver</button>
            <button class="btn danger small" data-del-room>Eliminar habitación</button>
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
      else if (['w', 'd', 'x', 'z'].includes(k)) {
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
    <h2>Guardar y compartir</h2>
    <p class="note">Todo se guarda automáticamente en este navegador. Para pasarlo a otro ordenador, exporta el archivo y luego impórtalo allí.</p>
    <div class="btns">
      <button class="btn" id="x-export">Exportar (.json)</button>
      <label class="btn secondary" style="display:inline-block">Importar<input type="file" id="x-import" accept="application/json,.json" hidden /></label>
      <button class="btn secondary" id="x-png">Captura (.png)</button>
    </div>
    <h2>Restablecer</h2>
    <div class="btns">
      <button class="btn danger" id="x-clear">Quitar todos los muebles</button>
      <button class="btn danger" id="x-reset">Volver al plano original</button>
    </div>
    <h2>Atajos</h2>
    <p class="note">
      Arrastrar: mover el mueble · R: girar 90° · Shift+R: girar −90° · Q / E: girar 15° · Flechas: mover 1 cm (Shift: 10 cm) ·
      Supr: eliminar · Ctrl+D: duplicar · Ctrl+Z / Ctrl+Y: deshacer / rehacer · Rueda: zoom · Botón derecho: desplazar la vista.
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
    } catch (err) { el.insertAdjacentHTML('beforeend', '<p class="note" style="color:var(--bad)">El archivo no es válido.</p>'); }
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

function loop() {
  controls.update();
  renderer.render(scene, camera);
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
    try { await signIn(); } catch (e) { showGate(loginHtml('No se ha podido iniciar sesión: ' + esc(e.message))); }
  });
}
const loginHtml = (err = '') => `
  <p>Esta app es privada. Entra con una de las cuentas de Google autorizadas.</p>
  ${err ? `<p class="gate-err">${err}</p>` : ''}
  <button class="btn" id="gate-login">Entrar con Google</button>`;

if (cloudEnabled) {
  showGate('<p>Comprobando la sesión…</p>');
  initCloud({
    onSignedOut: () => showGate(loginHtml()),
    onDenied: (email, msg) => showGate(loginHtml(msg ? esc(msg) : `La cuenta <b>${esc(email || '')}</b> no tiene acceso. Usa una cuenta autorizada con el correo verificado.`)),
    onSignedIn: (u, initial) => {
      document.getElementById('gate').hidden = true;
      const acc = document.getElementById('account');
      acc.hidden = false;
      acc.querySelector('.who').textContent = u.email;
      if (initial) { history.past = []; history.future = []; state = initial; afterStateReplace(false); frameCamera(); setSync('guardado'); }
      else save();
    },
    onRemoteState: (s, by) => { state = s; afterStateReplace(false); setSync('Actualizado por ' + by); },
  }).catch((e) => showGate(`<p class="gate-err">Error al cargar Firebase: ${esc(e.message)}</p>`));
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
