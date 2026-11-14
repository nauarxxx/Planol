import * as THREE from 'three';

// Catálogo de tipos de mueble. w = ancho (X local), d = fondo (Z local), h = alto. cm.
// El frente del mueble mira hacia +Z local (hacia donde mira quien se sienta / la pantalla).
// role: cómo lo trata el generador de distribuciones.
export const CATALOG = {
  silla:      { label: 'Cadira',           w: 45,  d: 50,  h: 90,  color: '#e8e4dc', role: 'seat' },
  mesa:       { label: 'Taula',            w: 140, d: 80,  h: 75,  color: '#7a5233', role: 'table' },
  mesaCentro: { label: 'Taula de centre',  w: 100, d: 55,  h: 42,  color: '#5c4030', role: 'coffee' },
  tv:         { label: 'Televisor',        w: 123, d: 8,   h: 72,  color: '#151515', role: 'tv', elev: 50 },
  muebleTv:   { label: 'Moble TV',         w: 160, d: 40,  h: 45,  color: '#3d2b1f', role: 'wall' },
  sofa:       { label: 'Sofà',             w: 200, d: 90,  h: 85,  color: '#6b4a3a', role: 'sofa' },
  sillon:     { label: 'Butaca',           w: 85,  d: 85,  h: 85,  color: '#8a5a44', role: 'armchair' },
  cama:       { label: 'Llit',             w: 150, d: 200, h: 55,  color: '#d6d2cc', role: 'bed' },
  mesita:     { label: 'Tauleta de nit',   w: 45,  d: 40,  h: 50,  color: '#7a5233', role: 'nightstand' },
  armario:    { label: 'Armari',           w: 150, d: 60,  h: 220, color: '#b9a48a', role: 'wall' },
  estanteria: { label: 'Prestatgeria',     w: 80,  d: 30,  h: 180, color: '#a07850', role: 'wall' },
  comoda:     { label: 'Calaixera',        w: 100, d: 45,  h: 80,  color: '#8d6748', role: 'wall' },
  escritorio: { label: 'Escriptori',       w: 120, d: 60,  h: 75,  color: '#9b7653', role: 'desk' },
  alfombra:   { label: 'Catifa',           w: 200, d: 140, h: 1,   color: '#4a4f57', role: 'rug' },
  lampara:    { label: 'Làmpada de peu',   w: 35,  d: 35,  h: 165, color: '#d8c9a0', role: 'corner' },
  planta:     { label: 'Planta',           w: 40,  d: 40,  h: 110, color: '#3f7a3a', role: 'corner' },
  cockpit:    { label: 'Simulador cockpit', w: 150, d: 90, h: 100, color: '#2a2a2e', role: 'desk' },
  encimera:   { label: 'Taulell de cuina',  w: 120, d: 55,  h: 90,  color: '#e9e4da', role: 'wall' },
  encimeraPica: { label: 'Taulell amb pica', w: 120, d: 55, h: 90,  color: '#e9e4da', role: 'wall' },
  encimeraPlaca: { label: 'Taulell amb placa', w: 160, d: 55, h: 90, color: '#e9e4da', role: 'wall' },
  nevera:     { label: 'Nevera',           w: 60,  d: 65,  h: 185, color: '#f2f2f0', role: 'wall' },
  rentadora:  { label: 'Rentadora',        w: 60,  d: 60,  h: 85,  color: '#f2f2f0', role: 'wall' },
  campana:    { label: 'Campana extractora', w: 60, d: 50, h: 40,  color: '#9ea3a8', role: 'wall', elev: 155 },
  litera:     { label: 'Llitera',          w: 90,  d: 200, h: 170, color: '#f4f4f2', role: 'bed' },
  banyera:    { label: 'Banyera',          w: 170, d: 70,  h: 55,  color: '#f6f6f4', role: 'wall' },
  vater:      { label: 'Vàter',            w: 38,  d: 55,  h: 42,  color: '#f6f6f4', role: 'wall' },
  lavabo:     { label: 'Lavabo amb moble', w: 70,  d: 45,  h: 85,  color: '#f2efe9', role: 'wall' },
  mirall:     { label: 'Mirall de paret',  w: 40,  d: 2,   h: 120, color: '#d9e2e6', role: 'wall', elev: 60 },
  llarFoc:    { label: 'Llar de foc',      w: 120, d: 45,  h: 110, color: '#e8e4dc', role: 'wall' },
  caja:       { label: 'Objecte genèric',  w: 60,  d: 60,  h: 60,  color: '#8899aa', role: 'wall' },
};

// Formes alternatives d'un mateix tipus (item.shape) i els seus paràmetres (item.sd = fons del cos, item.lw = ample de l'ala).
// La petjada (w × d) sempre és el rectangle que envolta tota la peça; la forma diu com s'omple.
export const SHAPES = {
  sofa:       [['recte', 'Recte'], ['Le', 'L esquerra'], ['Ld', 'L dreta'], ['U', 'En U']],
  mesa:       [['rect', 'Rectangular'], ['rodona', 'Rodona / ovalada']],
  mesaCentro: [['rect', 'Rectangular'], ['rodona', 'Rodona / ovalada']],
  escritorio: [['recte', 'Recte'], ['Le', 'L esquerra'], ['Ld', 'L dreta']],
  llarFoc:    [['paret', 'De paret'], ['cantonera', 'Cantonera'], ['estufa', 'Estufa'], ['electrica', 'Elèctrica']],
};
export const SHAPE_PARAMS = {
  sofa:       { sd: ['Fons seient', 90], lw: ['Ample chaise', 90] },
  escritorio: { sd: ['Fons taula', 60], lw: ['Ample ala', 60] },
  llarFoc:    { bw: ['Ample de la boca', 60], bh: ['Alçada de la boca', 45] },
};
// Mides que es proposen en triar una forma (es poden canviar després).
export const SHAPE_SIZES = {
  llarFoc: {
    paret: { w: 120, d: 45, h: 110, elev: 0, bw: 70, bh: 50 },
    cantonera: { w: 90, d: 90, h: 110, elev: 0, bw: 55, bh: 50 },
    estufa: { w: 55, d: 50, h: 200, elev: 0, bw: 35, bh: 35 },
    electrica: { w: 100, d: 18, h: 55, elev: 40, bw: 86, bh: 22 },
  },
};
export const hasWing = (shape) => shape === 'Le' || shape === 'Ld' || shape === 'U';
// Paràmetres que es poden ajustar per a la forma actual: [clau, etiqueta, valor per defecte].
export function shapeParams(type, shape) {
  const P = SHAPE_PARAMS[type];
  if (!P) return [];
  if ((type === 'sofa' || type === 'escritorio') && !hasWing(shape)) return [];
  return Object.entries(P).map(([k, [l, dv]]) => [k, l, dv]);
}
// Rectangles [x0, ample, z0, fons] que formen una peça en L o en U dins la petjada w × d (esquena a −z).
export function shapeRects(item) {
  const { w, d } = item, shape = item.shape || 'recte';
  if (!hasWing(shape)) return [[-w / 2, w, -d / 2, d]];
  const def = SHAPE_PARAMS[item.type] || {};
  const sd = Math.min(d, Math.max(40, +item.sd || def.sd?.[1] || 90));
  const lw = Math.min(w / 2 - 2, Math.max(30, +item.lw || def.lw?.[1] || 90));
  const r = [[-w / 2, w, -d / 2, sd]];
  if (shape === 'Le' || shape === 'U') r.push([-w / 2, lw, -d / 2 + sd, d - sd]);
  if (shape === 'Ld' || shape === 'U') r.push([w / 2 - lw, lw, -d / 2 + sd, d - sd]);
  return r;
}

const matCache = new Map();
function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!matCache.has(key)) {
    matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.05, ...opts }));
  }
  return matCache.get(key);
}

function box(group, w, h, d, x, y, z, material) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(Math.max(w, 0.5), Math.max(h, 0.5), Math.max(d, 0.5)), material);
  m.position.set(x, y + h / 2, z);
  m.castShadow = true;
  m.receiveShadow = true;
  group.add(m);
  return m;
}

function cyl(group, r, h, x, y, z, material, rTop = r) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, r, h, 20), material);
  m.position.set(x, y + h / 2, z);
  m.castShadow = true;
  group.add(m);
  return m;
}

function shade(hex, f) {
  const c = new THREE.Color(hex);
  c.multiplyScalar(f);
  return '#' + c.getHexString();
}

function legs(g, w, d, h, t, material, inset = 3) {
  const xs = [-w / 2 + inset + t / 2, w / 2 - inset - t / 2];
  const zs = [-d / 2 + inset + t / 2, d / 2 - inset - t / 2];
  for (const x of xs) for (const z of zs) box(g, t, h, t, x, 0, z, material);
}

// Foc: brases, dos troncs i flames que brillen, dins d'una boca fosca de bw × bh amb vidre al davant (tot mirant a +Z local).
const fireMats = { coal: null, flame: null, flame2: null, glass: null };
function fireMat() {
  fireMats.coal ||= new THREE.MeshStandardMaterial({ color: 0x1a1512, roughness: 1, side: THREE.BackSide });
  fireMats.flame ||= new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0.92 });
  fireMats.flame2 ||= new THREE.MeshBasicMaterial({ color: 0xffd04a, transparent: true, opacity: 0.95 });
  fireMats.glass ||= new THREE.MeshStandardMaterial({ color: 0x223040, transparent: true, opacity: 0.25, roughness: 0.05, metalness: 0.2 });
  return fireMats;
}
function fire(g, bw, bh, depth, y0, zFront) {
  const M = fireMat();
  // la llar és buida: només es veuen les cares de dins (fons, terra, costats i sostre), no la del davant
  const pit = box(g, bw, bh, depth, 0, y0, zFront - depth / 2, M.coal); pit.castShadow = false;
  const logW = bw * 0.7;
  for (const [dz, rot] of [[-depth * 0.3, 0.12], [-depth * 0.55, -0.1]]) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, logW, 10), mat('#5a3a22'));
    log.rotation.z = Math.PI / 2; log.rotation.y = rot; log.position.set(0, y0 + 4, zFront + dz); g.add(log);
  }
  const n = Math.max(2, Math.round(bw / 22));
  for (let i = 0; i < n; i++) {
    const x = -bw * 0.35 + (bw * 0.7) * (i / (n - 1));
    const fh = Math.min(bh - 8, bh * (0.45 + 0.25 * ((i * 37) % 3) / 2));
    const f = new THREE.Mesh(new THREE.ConeGeometry(Math.min(7, bw / (n * 1.6)), fh, 8), M.flame);
    f.position.set(x, y0 + 6 + fh / 2, zFront - depth * 0.45); g.add(f);
    const f2 = new THREE.Mesh(new THREE.ConeGeometry(Math.min(4, bw / (n * 2.8)), fh * 0.6, 8), M.flame2);
    f2.position.set(x, y0 + 6 + fh * 0.3, zFront - depth * 0.4); g.add(f2);
  }
  const gl = box(g, bw, bh, 0.6, 0, y0, zFront - 0.4, M.glass); gl.castShadow = false;
}
// Caixa amb un forat al davant (la boca): fons sencer i, davant, dos muntants, el sòcol i la llinda.
function hollowBox(g, w, h, d, y0, mw, mh, my, rec, m) {
  const zf = d / 2 - rec / 2, sw = (w - mw) / 2, top = h - my - mh;
  box(g, w, h, d - rec, 0, y0, -rec / 2, m);
  if (sw > 0.3) for (const sx of [-1, 1]) box(g, sw, h, rec, sx * (mw / 2 + sw / 2), y0, zf, m);
  if (my > 0.3) box(g, mw, my, rec, 0, y0, zf, m);
  if (top > 0.3) box(g, mw, top, rec, 0, y0 + my + mh, zf, m);
}
// Prisma vertical a partir d'un polígon en planta [[x, z], …], de y0 a y0 + hgt.
function prism(g, pts, y0, hgt, m, k = 1) {
  const sh = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x * k, -z * k)));
  const geo = new THREE.ExtrudeGeometry(sh, { depth: hgt, bevelEnabled: false });
  geo.rotateX(-Math.PI / 2); geo.translate(0, y0, 0); // (x, −z) de la forma → planta (x, z), i l'extrusió cap amunt
  const mesh = new THREE.Mesh(geo, m); mesh.castShadow = true; mesh.receiveShadow = true; g.add(mesh);
  return mesh;
}
function buildFireplace(g, item, main, dark, metal) {
  const { w, d, h } = item;
  const shape = item.shape || 'paret';
  const bw = Math.max(15, Math.min(+item.bw || 60, w - 10)), bh = Math.max(12, Math.min(+item.bh || 45, h - 10));
  const stone = mat(shade(item.color, 0.85), { roughness: 0.95 });
  if (shape === 'estufa') {
    // Estufa de llenya: cos negre sobre potes, porta de vidre i tub de fum fins a dalt (h inclou el tub).
    const iron = mat('#26272a', { roughness: 0.6, metalness: 0.4 });
    const bodyH = Math.min(h, Math.max(60, Math.min(100, h * 0.5)));
    const fw = Math.min(bw, w - 12), fh = Math.min(bh, bodyH - 30), rec = d * 0.6;
    legs(g, w - 4, d - 4, 10, 4, iron, 2);
    hollowBox(g, w, bodyH - 10, d, 10, fw, fh, 12, rec, iron);
    box(g, w + 4, 3, d + 4, 0, bodyH, 0, iron);
    fire(g, fw, fh, rec, 22, d / 2);
    if (h > bodyH + 5) cyl(g, 7, h - bodyH - 3, 0, bodyH + 3, -d * 0.15, iron);
    return;
  }
  if (shape === 'electrica') {
    // Llar de foc elèctrica: panell prim penjat a la paret amb una franja de flames.
    const fw = Math.min(bw, w - 8), fh = Math.min(bh, h - 8), fy = (h - fh) / 2, rec = Math.max(4, d * 0.6);
    hollowBox(g, w, h, d, 0, fw, fh, fy, rec, mat('#1b1c1f', { roughness: 0.3, metalness: 0.3 }));
    fire(g, fw, fh, rec, fy, d / 2);
    return;
  }
  if (shape === 'cantonera') {
    // Cantonera: planta pentagonal tocant les dues parets del darrere (−Z i −X); la boca mira en diagonal.
    const cut = Math.min(w, d) * 0.45;
    const P1 = [w / 2, -d / 2 + cut], P2 = [-w / 2 + cut, d / 2];
    const pent = [[-w / 2, -d / 2], [w / 2, -d / 2], P1, P2, [-w / 2, d / 2]];
    const diag = Math.hypot(P2[0] - P1[0], P2[1] - P1[1]);
    const ux = (P2[0] - P1[0]) / diag, uz = (P2[1] - P1[1]) / diag; // al llarg de la cara diagonal
    const nx = uz, nz = -ux; // normal cap a dins
    const fw = Math.min(bw, diag - 14), my = 18, fh = Math.min(bh, h - my - 20), rec = Math.min(cut, 30);
    const mx = (P1[0] + P2[0]) / 2, mz = (P1[1] + P2[1]) / 2, hw = fw / 2;
    const A = [mx - ux * hw, mz - uz * hw], B = [mx + ux * hw, mz + uz * hw];
    const notched = [pent[0], pent[1], P1, A, [A[0] + nx * rec, A[1] + nz * rec], [B[0] + nx * rec, B[1] + nz * rec], B, P2, pent[4]];
    prism(g, pent, 0, my, main);
    prism(g, notched, my, fh, main);
    prism(g, pent, my + fh, h - my - fh - 5, main);
    prism(g, pent, h - 5, 5, stone, 1.06);
    const sub = new THREE.Group(); sub.position.set(mx, 0, mz); sub.rotation.y = Math.atan2(-nx, -nz); g.add(sub);
    fire(sub, fw, fh, rec, my, 0);
    box(sub, fw + 12, 8, 4, 0, my - 8, 2, stone);
    return;
  }
  // De paret: cos d'obra amb la boca buidada, repisa de pedra a dalt, sòcol i marc fosc al voltant de la boca.
  const by = 14, fh = Math.min(bh, h - by - 16), rec = Math.min(d - 8, 34);
  hollowBox(g, w, h - 6, d, 0, bw, fh, by, rec, main);
  box(g, w + 8, 6, d + 6, 0, h - 6, 3, stone);
  box(g, w + 4, 8, d + 4, 0, 0, 2, stone);
  const fz = d / 2 + 1.5;
  for (const sx of [-1, 1]) box(g, 6, fh + 6, 3, sx * (bw / 2 + 3), by, fz, dark);
  box(g, bw + 12, 6, 3, 0, by + fh, fz, dark);
  fire(g, bw, fh, rec, by, d / 2);
}

// Construye un grupo 3D con origen en el centro de la huella, a nivel del suelo.
export function buildFurniture(item) {
  const g = new THREE.Group();
  const { w, d, h } = item;
  const c = item.color;
  const main = mat(c);
  const dark = mat(shade(c, 0.6));
  const metal = mat('#333333', { metalness: 0.6, roughness: 0.4 });

  switch (item.type) {
    case 'silla': {
      const seatH = Math.min(46, h * 0.5);
      box(g, w, 5, d * 0.9, 0, seatH - 5, d * 0.05, main);
      legs(g, w, d, seatH - 5, 3, metal, 2);
      box(g, w, h - seatH, 5, 0, seatH, -d / 2 + 2.5, main);
      break;
    }
    case 'mesa':
    case 'escritorio': {
      const top = 4;
      if (item.shape === 'rodona') {
        // Taula rodona (o ovalada si w ≠ d) amb peu central.
        const t = cyl(g, w / 2, top, 0, h - top, 0, main); t.scale.z = d / w;
        cyl(g, 5, h - top - 3, 0, 3, 0, dark);
        const b = cyl(g, Math.min(w, d) * 0.3, 3, 0, 0, 0, dark); b.scale.z = d / w;
        break;
      }
      // Recta, en L esquerra o en L dreta: un tauler i potes per cada rectangle de la forma.
      for (const [x0, pw, z0, pd] of shapeRects(item)) {
        box(g, pw, top, pd, x0 + pw / 2, h - top, z0 + pd / 2, main);
        const lg = new THREE.Group(); lg.position.set(x0 + pw / 2, 0, z0 + pd / 2); g.add(lg);
        legs(lg, pw, pd, h - top, 5, dark);
      }
      break;
    }
    case 'mesaCentro': {
      if (item.shape === 'rodona') {
        const t = cyl(g, w / 2, 4, 0, h - 4, 0, main); t.scale.z = d / w;
        const b = cyl(g, w / 2 - 4, 3, 0, 8, 0, dark); b.scale.z = d / w;
        cyl(g, 4, h - 4, 0, 0, 0, dark);
        break;
      }
      box(g, w, 4, d, 0, h - 4, 0, main);
      box(g, w - 8, 3, d - 8, 0, 8, 0, dark);
      legs(g, w, d, h - 4, 4, dark);
      break;
    }
    case 'tv': {
      const t = Math.min(d, 6);
      const screen = mat('#0b0d12', { roughness: 0.2, metalness: 0.3 });
      box(g, w, h, t, 0, 0, 0, mat(c));
      const s = box(g, w - 3, h - 3, 0.6, 0, 1.5, t / 2 + 0.3, screen);
      s.castShadow = false;
      break;
    }
    case 'sofa': {
      // Recte, en L (chaise a l'esquerra o a la dreta) o en U: esquena a −z, el cos principal fa sd de fons i cada chaise lw d'ample.
      const shape = item.shape || 'recte';
      const L = shape === 'Le' || shape === 'U', R = shape === 'Ld' || shape === 'U';
      const [[, , z0, sd], ...wings] = shapeRects(item);
      const arm = Math.min(18, w * 0.12);
      const seatH = Math.min(45, h * 0.55), baseH = seatH - 12, armH = h * 0.72 - baseH;
      box(g, w, baseH, sd, 0, 0, z0 + sd / 2, dark);
      box(g, w - 2 * arm, 12, sd - 20, 0, baseH, z0 + 20 + (sd - 20) / 2, main);
      box(g, w, h - baseH, 20, 0, baseH, z0 + 10, main);
      for (const [x0, lw, wz0, wd] of wings) {
        const left = x0 < 0;
        box(g, lw, baseH, wd, x0 + lw / 2, 0, wz0 + wd / 2, dark);
        const cx = left ? x0 + arm + (lw - arm) / 2 : x0 + (lw - arm) / 2;
        box(g, lw - arm, 12, wd - 2, cx, baseH, wz0 + wd / 2 - 1, main);
      }
      box(g, arm, armH, L ? d : sd, -w / 2 + arm / 2, baseH, L ? 0 : z0 + sd / 2, main);
      box(g, arm, armH, R ? d : sd, w / 2 - arm / 2, baseH, R ? 0 : z0 + sd / 2, main);
      break;
    }
    case 'sillon': {
      const arm = Math.min(16, w * 0.18);
      const seatH = Math.min(44, h * 0.55);
      box(g, w, seatH - 10, d, 0, 0, 0, dark);
      box(g, w - 2 * arm, 10, d - 18, 0, seatH - 10, 9, main);
      box(g, w, h - seatH + 10, 18, 0, seatH - 10, -d / 2 + 9, main);
      box(g, arm, h * 0.75 - (seatH - 10), d, -w / 2 + arm / 2, seatH - 10, 0, main);
      box(g, arm, h * 0.75 - (seatH - 10), d, w / 2 - arm / 2, seatH - 10, 0, main);
      break;
    }
    case 'cama': {
      const frameH = Math.min(30, h * 0.5);
      box(g, w, frameH, d, 0, 0, 0, mat('#5c4030'));
      box(g, w - 6, h - frameH, d - 8, 0, frameH, 3, main);
      box(g, w - 20, 10, 35, 0, h, -d / 2 + 25, mat('#f4f1ec'));
      box(g, w + 4, Math.max(h + 45, 100), 6, 0, 0, -d / 2 - 0, mat('#5c4030'));
      box(g, w - 4, 4, d * 0.55, 0, h, d * 0.2, mat(shade(c, 0.8)));
      break;
    }
    case 'cockpit': {
      // Simulador de conducció: xassís amb rails, seient baquet reclinat al darrere, pedals, volant i tres pantalles al davant (llarg = w, ample = d).
      const s = Math.min(1.6, Math.max(0.6, h / 100)); // escala vertical respecte als 100 cm de referència
      const seatMat = mat(shade(c, 1.15), { roughness: 0.8 });
      const frame = mat('#1c1c20', { metalness: 0.5, roughness: 0.45 });
      const rail = Math.min(10, d * 0.1);
      // xassís: dos rails llargs i dos travessers
      box(g, w, 5 * s, rail, 0, 0, -d / 2 + rail / 2, frame);
      box(g, w, 5 * s, rail, 0, 0, d / 2 - rail / 2, frame);
      box(g, rail, 5 * s, d - 2 * rail, -w / 2 + rail / 2, 0, 0, frame);
      box(g, rail, 5 * s, d - 2 * rail, w / 2 - rail / 2, 0, 0, frame);
      // seient baquet: base, coixí amb laterals, respatller reclinat i reposacaps
      const sw = Math.min(52, d * 0.6), sx = -w / 2 + 38;
      box(g, 40, 14 * s, sw * 0.7, sx, 5 * s, 0, frame);
      box(g, 46, 10 * s, sw, sx, 19 * s, 0, seatMat);
      box(g, 46, 16 * s, 7, sx, 19 * s, -sw / 2 + 3.5, seatMat);
      box(g, 46, 16 * s, 7, sx, 19 * s, sw / 2 - 3.5, seatMat);
      const back = box(g, 10, 62 * s, sw, 0, 0, 0, seatMat);
      back.position.set(sx - 20 - 8, 29 * s, 0); back.rotation.z = -0.32; // reclinat cap enrere
      back.position.y += 31 * s * Math.cos(0.32); back.position.x -= 31 * s * Math.sin(0.32) - 2;
      const head = box(g, 8, 14 * s, 22, 0, 0, 0, seatMat);
      head.position.set(sx - 20 - 8 - 62 * s * Math.sin(0.32) + 4, 29 * s + 62 * s * Math.cos(0.32) + 6 * s, 0); head.rotation.z = -0.32;
      // pedals: caixa inclinada al davant
      const ped = box(g, 24, 12 * s, 30, 0, 0, 0, dark);
      ped.position.set(w / 2 - 30, 7 * s, 0); ped.rotation.z = -0.5;
      // columna i volant
      const col = cyl(g, 2.5, 34 * s, 0, 0, 0, frame);
      col.position.set(w / 2 - 54, 44 * s, 0); col.rotation.z = -1.0; // puja cap al pilot
      const wheel = new THREE.Mesh(new THREE.TorusGeometry(15 * Math.min(1, s), 2.6, 10, 28), dark);
      wheel.position.set(w / 2 - 68, 60 * s, 0); wheel.rotation.y = Math.PI / 2; wheel.rotation.x = 0.35; wheel.castShadow = true;
      g.add(wheel);
      // suport del volant: columna vertical al capdavant del xassís (sense pantalles: només seient, volant i pedals)
      box(g, 8, 40 * s, 10, w / 2 - 40, 0, 0, frame);
      break;
    }
    case 'encimera':
    case 'encimeraPica':
    case 'encimeraPlaca': {
      // Taulell de cuina: mobles baixos amb sòcol i taulell de granit; variant amb pica i aixeta o amb placa d'inducció.
      const granite = mat('#5f5d60', { roughness: 0.35, metalness: 0.1 });
      const top = 4, plinth = 8;
      box(g, w - 4, plinth, d - 6, 0, 0, -3, dark);
      box(g, w, h - top - plinth, d, 0, plinth, 0, main);
      const doors = Math.max(1, Math.round(w / 60));
      for (let i = 1; i < doors; i++) box(g, 0.6, h - top - plinth - 4, 0.6, -w / 2 + (w / doors) * i, plinth + 2, d / 2 + 0.3, dark);
      for (let i = 0; i < doors; i++) box(g, 12, 1.2, 1.5, -w / 2 + (w / doors) * (i + 0.5), h - top - 8, d / 2 + 0.8, metal);
      box(g, w + 2, top, d + 2, 0, h - top, 1, granite);
      if (item.type === 'encimeraPica') {
        const sx = Math.min(w / 2 - 6, 0), bw = Math.min(45, w - 12), bd = Math.min(38, d - 14);
        box(g, bw, 1.2, bd, sx, h - 1.1, -2, mat('#c9cccf', { metalness: 0.7, roughness: 0.3 }));
        box(g, bw - 6, 0.8, bd - 6, sx, h - 0.6, -2, mat('#8a9096', { metalness: 0.6, roughness: 0.35 }));
        const tap = cyl(g, 1.2, 18, sx, h, -d / 2 + 6, metal);
        const spout = box(g, 2, 2, 12, sx, h + 16, -d / 2 + 11, metal);
        spout.castShadow = false; tap.castShadow = false;
      }
      if (item.type === 'encimeraPlaca') {
        const px = Math.min(w / 2 - 32, w / 4), pw = Math.min(58, w - 8), pd = Math.min(50, d - 6);
        box(g, pw, 0.8, pd, px, h, 0, mat('#0d0f12', { roughness: 0.15, metalness: 0.4 }));
        for (const [ox, oz] of [[-13, -11], [13, -11], [-13, 11], [13, 11]]) { const r = cyl(g, 7, 0.4, px + ox, h + 0.8, oz, mat('#2a2d33', { roughness: 0.3 })); r.castShadow = false; }
      }
      break;
    }
    case 'nevera': {
      // Nevera combi: dues portes (congelador a baix), nanses verticals.
      box(g, w, h, d, 0, 0, 0, main);
      const split = h * 0.38;
      box(g, w - 2, 0.6, 0.6, 0, split, d / 2 + 0.3, dark);
      box(g, 2, Math.min(60, h * 0.3), 2.5, -w / 2 + 7, split + 12, d / 2 + 1.2, metal);
      box(g, 2, Math.min(28, split * 0.6), 2.5, -w / 2 + 7, split - Math.min(28, split * 0.6) - 6, d / 2 + 1.2, metal);
      break;
    }
    case 'rentadora': {
      // Rentadora de càrrega frontal: ull de bou rodó i quadre de comandaments a dalt.
      box(g, w, h, d, 0, 0, 0, main);
      const r = Math.min(w, h) * 0.3;
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 2, 28), dark);
      ring.rotation.x = Math.PI / 2; ring.position.set(0, h * 0.45, d / 2 + 1); g.add(ring);
      const glass = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.75, r * 0.75, 1, 28), mat('#30343a', { roughness: 0.2, metalness: 0.3 }));
      glass.rotation.x = Math.PI / 2; glass.position.set(0, h * 0.45, d / 2 + 2.2); g.add(glass);
      box(g, w - 8, 6, 1, 0, h - 10, d / 2 + 0.5, dark);
      const knob = cyl(g, 3, 1.5, w / 2 - 12, h - 8.5, d / 2 + 1, metal); knob.rotation.x = Math.PI / 2;
      break;
    }
    case 'campana': {
      // Campana extractora: cos d'acer i xemeneia cap al sostre.
      box(g, w, Math.min(h, 12), d, 0, 0, 0, metal);
      box(g, w * 0.5, h - Math.min(h, 12), d * 0.5, 0, Math.min(h, 12), -d * 0.2, metal);
      box(g, w * 0.5, 60, d * 0.5, 0, h, -d * 0.2, metal);
      break;
    }
    case 'litera': {
      // Llitera: dos matalassos, quatre pals, baranes a dalt i escala al costat del peu.
      const post = mat('#e8e8e4', { roughness: 0.5, metalness: 0.3 });
      const bedding = mat('#f7f7f5', { roughness: 0.9 });
      const lowY = Math.min(35, h * 0.22), upY = h - 45;
      for (const x of [-w / 2 + 2, w / 2 - 2]) for (const z of [-d / 2 + 2, d / 2 - 2]) box(g, 4, h, 4, x, 0, z, post);
      for (const y of [lowY, upY]) {
        box(g, w - 4, 6, d - 4, 0, y, 0, dark);
        box(g, w - 8, 14, d - 8, 0, y + 6, 0, bedding);
        box(g, w - 20, 6, 30, 0, y + 20, -d / 2 + 22, main); // coixí al capçal
      }
      for (const z of [-d / 2 + 2, d / 2 - 2]) box(g, w - 4, 2, 2, 0, upY + 26, z, post);
      for (const x of [-w / 2 + 2, w / 2 - 2]) box(g, 2, 2, d - 4, x, upY + 26, 0, post);
      for (let k = 0; k < 5; k++) box(g, 2, 2, 24, w / 2 + 1, lowY + 12 + k * 18, d / 2 - 14, post); // escala
      break;
    }
    case 'banyera': {
      // Banyera: cos blanc amb la cubeta enfonsada.
      box(g, w, h, d, 0, 0, 0, main);
      box(g, w - 14, 1.5, d - 14, 0, h - 1.2, 0, mat('#d6e6ec', { roughness: 0.3 }));
      const spout = cyl(g, 1.2, 6, -w / 2 + 12, h, 0, metal); spout.castShadow = false;
      break;
    }
    case 'vater': {
      // Vàter suspès: tassa amb tapa i placa de la cisterna a la paret (darrere, local -z).
      box(g, w, 12, d - 12, 0, 0, 0, main);
      const bowl = box(g, w - 4, 14, d - 14, 0, 0, 1, main);
      bowl.position.y = Math.max(8, h - 22);
      box(g, w - 2, 4, d - 12, 0, Math.max(14, h - 8), 0, mat('#ffffff', { roughness: 0.4 }));
      box(g, w, 2, 6, 0, 0, -d / 2 + 3, dark);
      box(g, w + 10, Math.max(30, h * 1.1), 3, 0, h - 2, -d / 2 + 1.5, mat('#f0f0ee', { roughness: 0.5 }));
      break;
    }
    case 'lavabo': {
      // Lavabo: moble suspès amb calaixos, pica a sobre, aixeta i mirall a la paret.
      const cabH = Math.min(50, h * 0.6);
      box(g, w, cabH, d - 4, 0, h - cabH - 8, -2, main);
      box(g, w - 2, 0.6, 0.6, 0, h - cabH / 2 - 8, d / 2 - 1.5, dark);
      box(g, w + 2, 3, d, 0, h - 11, 0, mat('#c9b45a', { roughness: 0.5 }));
      box(g, Math.min(55, w - 10), 10, Math.min(38, d - 8), 0, h - 10, 0, mat('#ffffff', { roughness: 0.3 }));
      const tap = cyl(g, 1.2, 12, 0, h - 2, -d / 2 + 8, metal); tap.castShadow = false;
      const mirror = box(g, w, 60, 1.2, 0, h + 20, -d / 2 + 0.6, mat('#c7d6dc', { roughness: 0.05, metalness: 0.6 }));
      mirror.castShadow = false;
      break;
    }
    case 'mirall': {
      // Mirall de paret: vidre reflectant amb un marc fi; es penja a la paret (elev) i mira cap a +Z.
      const glass = mat(c, { metalness: 0.6, roughness: 0.08, emissive: c, emissiveIntensity: 0.35 });
      box(g, w, h, Math.max(1, d - 0.5), 0, 0, 0, dark);
      const m = box(g, w - 2, h - 2, 0.5, 0, 1, d / 2, glass);
      m.castShadow = false;
      break;
    }
    case 'llarFoc': {
      buildFireplace(g, item, main, dark, metal);
      break;
    }
    case 'armario': {
      box(g, w, h, d, 0, 0, 0, main);
      const doors = Math.max(1, Math.round(w / 50));
      for (let i = 1; i < doors; i++) {
        box(g, 0.8, h - 6, 0.6, -w / 2 + (w / doors) * i, 3, d / 2 + 0.3, dark);
      }
      for (let i = 0; i < doors; i++) {
        const x = -w / 2 + (w / doors) * (i + 0.5) + (i % 2 ? -w / doors / 2 + 5 : w / doors / 2 - 5);
        box(g, 1.5, 25, 2, x, h / 2 - 12, d / 2 + 1, metal);
      }
      break;
    }
    case 'estanteria': {
      const t = 2.5;
      box(g, t, h, d, -w / 2 + t / 2, 0, 0, main);
      box(g, t, h, d, w / 2 - t / 2, 0, 0, main);
      box(g, w, h, 1, 0, 0, -d / 2 + 0.5, dark);
      const n = Math.max(2, Math.round(h / 35));
      for (let i = 0; i <= n; i++) box(g, w - 2 * t, t, d, 0, Math.min(i * (h / n), h - t), 0, main);
      break;
    }
    case 'comoda':
    case 'mesita':
    case 'muebleTv': {
      box(g, w, h - 6, d, 0, 6, 0, main);
      legs(g, w, d, 6, 4, dark, 2);
      const drawers = item.type === 'muebleTv' ? 1 : Math.max(1, Math.round((h - 6) / 22));
      for (let i = 1; i < drawers; i++) box(g, w - 4, 0.8, 0.6, 0, 6 + ((h - 6) / drawers) * i, d / 2 + 0.3, dark);
      if (item.type === 'muebleTv') {
        const parts = Math.max(1, Math.round(w / 60));
        for (let i = 1; i < parts; i++) box(g, 0.8, h - 10, 0.6, -w / 2 + (w / parts) * i, 8, d / 2 + 0.3, dark);
      }
      break;
    }
    case 'alfombra': {
      const m = box(g, w, Math.max(h, 1), d, 0, 0, 0, main);
      m.castShadow = false;
      break;
    }
    case 'lampara': {
      const r = Math.min(w, d) / 2;
      cyl(g, r * 0.7, 3, 0, 0, 0, metal);
      cyl(g, 1.2, h - 30, 0, 3, 0, metal);
      cyl(g, r, 30, 0, h - 30, 0, mat(c, { emissive: c, emissiveIntensity: 0.25 }), r * 0.7);
      break;
    }
    case 'planta': {
      const r = Math.min(w, d) / 2;
      cyl(g, r * 0.6, Math.min(35, h * 0.35), 0, 0, 0, mat('#b5653a'), r * 0.75);
      const leaves = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), main);
      const lh = h - Math.min(35, h * 0.35);
      leaves.scale.set(1, lh / (2 * r), 1);
      leaves.position.y = Math.min(35, h * 0.35) + lh / 2;
      leaves.castShadow = true;
      g.add(leaves);
      break;
    }
    default:
      box(g, w, h, d, 0, 0, 0, main);
  }
  return g;
}

export function newItem(type, overrides = {}) {
  const base = CATALOG[type] || CATALOG.caja;
  return {
    id: 'i' + Math.random().toString(36).slice(2, 9),
    type,
    name: base.label,
    w: base.w, d: base.d, h: base.h,
    elev: base.elev || 0,
    color: base.color,
    x: 0, z: 0, rot: 0,
    roomId: null,
    locked: false,
    // amb una forma triada, primer les mides típiques d'aquella forma (i els seus paràmetres) i després el que es demani
    ...(overrides.shape && SHAPE_SIZES[type]?.[overrides.shape]) || {},
    ...Object.fromEntries(Object.entries(overrides).filter(([, v]) => v !== undefined)),
  };
}
