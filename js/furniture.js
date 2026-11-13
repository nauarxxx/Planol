import * as THREE from 'three';

// Catálogo de tipos de mueble. w = ancho (X local), d = fondo (Z local), h = alto. cm.
// El frente del mueble mira hacia +Z local (hacia donde mira quien se sienta / la pantalla).
// role: cómo lo trata el generador de distribuciones.
export const CATALOG = {
  silla:      { label: 'Silla',            w: 45,  d: 50,  h: 90,  color: '#e8e4dc', role: 'seat' },
  mesa:       { label: 'Mesa',             w: 140, d: 80,  h: 75,  color: '#7a5233', role: 'table' },
  mesaCentro: { label: 'Mesa de centro',   w: 100, d: 55,  h: 42,  color: '#5c4030', role: 'coffee' },
  tv:         { label: 'Televisión',       w: 123, d: 8,   h: 72,  color: '#151515', role: 'tv', elev: 50 },
  muebleTv:   { label: 'Mueble TV',        w: 160, d: 40,  h: 45,  color: '#3d2b1f', role: 'wall' },
  sofa:       { label: 'Sofá',             w: 200, d: 90,  h: 85,  color: '#6b4a3a', role: 'sofa' },
  sillon:     { label: 'Sillón',           w: 85,  d: 85,  h: 85,  color: '#8a5a44', role: 'armchair' },
  cama:       { label: 'Cama',             w: 150, d: 200, h: 55,  color: '#d6d2cc', role: 'bed' },
  mesita:     { label: 'Mesita de noche',  w: 45,  d: 40,  h: 50,  color: '#7a5233', role: 'nightstand' },
  armario:    { label: 'Armario',          w: 150, d: 60,  h: 220, color: '#b9a48a', role: 'wall' },
  estanteria: { label: 'Estantería',       w: 80,  d: 30,  h: 180, color: '#a07850', role: 'wall' },
  comoda:     { label: 'Cómoda',           w: 100, d: 45,  h: 80,  color: '#8d6748', role: 'wall' },
  escritorio: { label: 'Escritorio',       w: 120, d: 60,  h: 75,  color: '#9b7653', role: 'desk' },
  alfombra:   { label: 'Alfombra',         w: 200, d: 140, h: 1,   color: '#4a4f57', role: 'rug' },
  lampara:    { label: 'Lámpara de pie',   w: 35,  d: 35,  h: 165, color: '#d8c9a0', role: 'corner' },
  planta:     { label: 'Planta',           w: 40,  d: 40,  h: 110, color: '#3f7a3a', role: 'corner' },
  caja:       { label: 'Objeto genérico',  w: 60,  d: 60,  h: 60,  color: '#8899aa', role: 'wall' },
};

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
      box(g, w, top, d, 0, h - top, 0, main);
      legs(g, w, d, h - top, 5, dark);
      break;
    }
    case 'mesaCentro': {
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
      const arm = Math.min(18, w * 0.12);
      const seatH = Math.min(45, h * 0.55);
      box(g, w, seatH - 12, d, 0, 0, 0, dark);
      box(g, w - 2 * arm, 12, d - 20, 0, seatH - 12, 10, main);
      box(g, w, h - seatH + 12, 20, 0, seatH - 12, -d / 2 + 10, main);
      box(g, arm, h * 0.72 - (seatH - 12), d, -w / 2 + arm / 2, seatH - 12, 0, main);
      box(g, arm, h * 0.72 - (seatH - 12), d, w / 2 - arm / 2, seatH - 12, 0, main);
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
    ...overrides,
  };
}
