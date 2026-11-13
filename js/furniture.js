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
  caja:       { label: 'Objecte genèric',  w: 60,  d: 60,  h: 60,  color: '#8899aa', role: 'wall' },
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
