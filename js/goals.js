// Objectius de les propostes: el que es vol prioritzar en col·locar els mobles. Cada objectiu dona una penalització
// (com més gran, pitjor) que se suma a la puntuació de la proposta i una explicació curta de si es compleix.
import { aabb, innerRect, allOpenings, openingsOnRoom, DEG } from './geom.js?v=40';
import { checkZones } from './zones.js?v=40';

export const GOALS = [
  ['zones', 'Espai per fer servir cada moble', 'Que es puguin obrir armaris i calaixos, pujar al llit, treure les cadires…'],
  ['pas', 'Passos amples (80 cm)', 'Que entre els mobles hi hagi pas còmode.'],
  ['espai', 'Més espai lliure al mig', 'Els mobles cap a les parets, el centre lliure.'],
  ['tv', 'TV ben visible des del sofà', 'El sofà mirant la tele, a 1,5–4 m.'],
  ['llit', 'Llit amb el capçal a la paret i sense mirar la porta', 'Capçal contra la paret i els peus no apuntant a la porta.'],
  ['llum', 'Escriptori a prop de la finestra', 'Llum natural a la taula de treball.'],
];
export const GOAL_DEFAULT = ['zones', 'pas'];
const lbl = (k) => GOALS.find((g) => g[0] === k)?.[1] || k;
const fmt = (cm) => (cm >= 100 ? `${(cm / 100).toFixed(1).replace('.', ',')} m` : `${Math.round(cm)} cm`);
const front = (rot) => ({ x: Math.sin((rot || 0) * DEG), z: Math.cos((rot || 0) * DEG) });
const angle = (a, b) => Math.acos(Math.max(-1, Math.min(1, (a.x * b.x + a.z * b.z) / ((Math.hypot(a.x, a.z) * Math.hypot(b.x, b.z)) || 1)))) / DEG;

// items: els mobles de l'estança ja col·locats. Torna { penalty, report: [{key, label, ok, text}] }.
export function evalGoals(items, room, allRooms, keys, t = 10) {
  const R = innerRect(room, t);
  const ops = openingsOnRoom(room, allOpenings(allRooms));
  const solid = items.filter((i) => i.type !== 'alfombra' && (i.elev || 0) < 120);
  let penalty = 0;
  const report = [];
  const add = (key, ok, text, pen) => { penalty += ok ? 0 : pen; report.push({ key, label: lbl(key), ok, text }); };
  for (const key of keys) {
    if (key === 'zones') {
      const st = { rooms: allRooms, items, wallThickness: t };
      let miss = 0, n = 0;
      for (const it of items) for (const z of checkZones(it, st)) { n++; if (!z.ok) miss += z.need - z.have; }
      if (!n) continue;
      add(key, miss < 1, miss < 1 ? 'tots els mobles es poden fer servir' : `falten ${fmt(miss)} d’espai d’ús en total`, miss * 4);
    } else if (key === 'pas') {
      let narrow = 0, worst = Infinity;
      const pairOk = (a, b) => (a.type === 'silla' && ['mesa', 'escritorio'].includes(b.type)) || (a.type === 'mesita' && ['cama', 'litera'].includes(b.type)) || (a.type === 'tv' && b.type === 'muebleTv');
      for (let i = 0; i < solid.length; i++) for (let j = i + 1; j < solid.length; j++) {
        const A = solid[i], B = solid[j];
        if (pairOk(A, B) || pairOk(B, A) || (A.type === 'silla' && B.type === 'silla')) continue;
        const a = aabb(A), b = aabb(B);
        const gx = Math.max(b.x0 - a.x1, a.x0 - b.x1), gz = Math.max(b.z0 - a.z1, a.z0 - b.z1);
        const ovZ = Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0), ovX = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
        let g = null;
        if (gx > 2 && ovZ > 30) g = gx; else if (gz > 2 && ovX > 30) g = gz;
        if (g !== null && g < 80) { narrow++; worst = Math.min(worst, g); penalty += (80 - g) * 3; }
      }
      // també entre mobles i parets: un moble que no toca la paret però en deixa menys de 50 és un racó inútil
      report.push({ key, label: lbl(key), ok: !narrow, text: narrow ? `${narrow} pas${narrow > 1 ? 'sos' : ''} estret${narrow > 1 ? 's' : ''} (el més estret, ${fmt(worst)})` : 'passos de 80 cm o més' });
    } else if (key === 'espai') {
      const mx = (R.x1 - R.x0) * 0.25, mz = (R.z1 - R.z0) * 0.25, C = { x0: R.x0 + mx, x1: R.x1 - mx, z0: R.z0 + mz, z1: R.z1 - mz };
      const area = Math.max(1, (C.x1 - C.x0) * (C.z1 - C.z0));
      let occ = 0;
      for (const it of solid) { const b = aabb(it); occ += Math.max(0, Math.min(b.x1, C.x1) - Math.max(b.x0, C.x0)) * Math.max(0, Math.min(b.z1, C.z1) - Math.max(b.z0, C.z0)); }
      const f = occ / area;
      add(key, f < 0.15, `el centre és lliure al ${Math.round((1 - Math.min(1, f)) * 100)} %`, f * 600);
    } else if (key === 'tv') {
      const tv = items.find((i) => i.type === 'tv' || i.type === 'tvParet'), sofa = items.find((i) => i.type === 'sofa') || items.find((i) => i.type === 'sillon');
      if (!tv || !sofa) continue;
      const v = { x: tv.x - sofa.x, z: tv.z - sofa.z }, d = Math.hypot(v.x, v.z);
      const a1 = angle(front(sofa.rot), v), a2 = angle(front(tv.rot), { x: -v.x, z: -v.z });
      const ok = a1 < 30 && a2 < 35 && d >= 150 && d <= 400;
      add(key, ok, ok ? `el sofà mira la tele a ${fmt(d)}` : a1 >= 30 ? 'el sofà no mira cap a la tele' : a2 >= 35 ? 'la tele no mira cap al sofà' : d < 150 ? `la tele queda massa a prop (${fmt(d)})` : `la tele queda lluny (${fmt(d)})`, 350);
    } else if (key === 'llit') {
      const beds = items.filter((i) => i.type === 'cama' || i.type === 'litera');
      if (!beds.length) continue;
      const doors = ops.filter((o) => o.type === 'puerta' || o.type === 'paso');
      const bad = [];
      for (const b of beds) {
        const f = front(b.rot), bx = b.x - f.x * b.d / 2, bz = b.z - f.z * b.d / 2; // centre del capçal
        const wallGap = Math.min(Math.abs(bx - R.x0), Math.abs(bx - R.x1), Math.abs(bz - R.z0), Math.abs(bz - R.z1));
        if (wallGap > 3) bad.push('el capçal no toca la paret');
        for (const o of doors) {
          const c = o.axis === 'x' ? { x: (o.a + o.b) / 2, z: o.line } : { x: o.line, z: (o.a + o.b) / 2 };
          if (angle(f, { x: c.x - b.x, z: c.z - b.z }) < 22) { bad.push('els peus miren a la porta'); break; }
        }
      }
      add(key, !bad.length, bad.length ? [...new Set(bad)].join(' i ') : 'capçal a la paret i peus lluny de la porta', bad.length * 300);
    } else if (key === 'llum') {
      const desks = items.filter((i) => i.type === 'escritorio' || i.type === 'cockpit');
      const wins = ops.filter((o) => o.type === 'ventana' || o.type === 'ventanal');
      if (!desks.length || !wins.length) continue;
      let worst = 0;
      for (const d of desks) {
        const best = Math.min(...wins.map((o) => { const c = o.axis === 'x' ? { x: (o.a + o.b) / 2, z: o.line } : { x: o.line, z: (o.a + o.b) / 2 }; return Math.hypot(d.x - c.x, d.z - c.z); }));
        worst = Math.max(worst, best);
      }
      add(key, worst <= 160, `l’escriptori és a ${fmt(worst)} de la finestra`, Math.max(0, worst - 160) * 2);
    }
  }
  return { penalty, report };
}
