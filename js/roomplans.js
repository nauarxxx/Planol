// Propostes de WALL-E per a cada estança, dibuixades a mà perquè tinguin sentit (i no a l'atzar):
// el sofà mira la tele, les cadires van al voltant de la taula, el llit té el capçal a una paret amb les tauletes als costats,
// no es tapa cap porta, finestral ni armari i es pot passar de la porta d'entrada al passadís, a la terrassa i a la cuina.
// Fan servir els mobles reals del pis (mateix id, mides i color) i, si cal, algun moble nou per comprar.
// Les posicions es calculen des de l'interior de cada estança, perquè segueixin les parets si se'n canvien les mides.
// Cada proposta es revisa a les proves amb els mateixos criteris que el generador automàtic (checkLayout).
import { CATALOG } from './furniture.js?v=51';
import { innerRect } from './geom.js?v=51';
import { officeProposals } from './officeplans.js?v=51';

const ROT = { N: 0, E: 270, S: 180, W: 90 }; // el davant del moble mira cap a dins de l'habitació

// Un moble: el real (si n'hi ha amb aquest id) o un de nou del catàleg; o = posició i canvis.
function piece(room, have, id, type, o = {}) {
  const real = have(id);
  const c = CATALOG[type] || CATALOG.caja;
  const base = real ? { ...real } : { id, type, name: c.label, w: c.w, d: c.d, h: c.h, color: c.color, elev: c.elev || 0, rot: 0, locked: false };
  return { ...base, ...o, roomId: room.id };
}
// Posició arran d'una paret: `at` és el centre al llarg de la paret (x a N/S, z a E/O), `gap` la separació de la paret.
function wall(R, it, side, at, gap = 0) {
  const rot = ROT[side], d = it.d / 2 + gap;
  if (side === 'N') return { x: at, z: R.z0 + d, rot };
  if (side === 'S') return { x: at, z: R.z1 - d, rot };
  if (side === 'W') return { x: R.x0 + d, z: at, rot };
  return { x: R.x1 - d, z: at, rot };
}
const put = (it, p) => Object.assign(it, p);

// ---------------------------------------------------------------- Menjador
// 270 × 520 per dins. Paret de l'est: porta d'entrada a dalt (s'obre cap a dins), 226 de paret, pas al passadís i el racó del mirall;
// a dalt a l'esquerra, obert a la cuina; a baix, el finestral de la terrassa. La paret de l'oest és sencera.
function menjador(room, t, have) {
  const R = innerRect(room, t);
  const wallE0 = R.z0 + 85, wallE1 = R.z0 + 311; // tros de paret de l'est entre la porta i el pas (226)
  const tvZ = (wallE0 + wallE1) / 2;
  const sala = (tvAt, extra = []) => {
    const tvm = piece(room, have, 'fix-mobletv', 'muebleTv'); put(tvm, wall(R, tvm, 'E', tvAt));
    const tv = piece(room, have, 'fix-tv', 'tv'); put(tv, { ...wall(R, tv, 'E', tvAt, 2), elev: tvm.h });
    const sofa = piece(room, have, 'fix-sofa', 'sofa'); put(sofa, wall(R, sofa, 'W', tvAt));
    const tau = piece(room, have, 'fix-tauleta', 'mesaCentro'); put(tau, { x: R.x0 + sofa.d + 25 + tau.d / 2, z: tvAt, rot: 90 });
    return [tvm, tv, sofa, tau, ...extra];
  };
  // taula amb 4 cadires: dues a un costat llarg i una a cada punta (rot 0 = llarga en x)
  const dining = (cx, cz, sides) => {
    const tb = piece(room, have, 'fix-taula', 'mesa', { x: cx, z: cz, rot: 0 });
    const out = [tb];
    const ch = (n, x, z, rot) => out.push(piece(room, have, `fix-cadira${n}`, 'silla', { x, z, rot }));
    const hw = tb.w / 2, hd = tb.d / 2, tuck = 12, cd = 25 - tuck; // la cadira entra 12 cm sota la taula
    let n = 1;
    for (const s of sides) {
      if (s === 'W') ch(n++, cx - hw - cd, cz, 90);
      if (s === 'E') ch(n++, cx + hw + cd, cz, 270);
      if (s === 'N2') { ch(n++, cx - 35, cz - hd - cd, 0); ch(n++, cx + 35, cz - hd - cd, 0); }
      if (s === 'S2') { ch(n++, cx - 35, cz + hd + cd, 180); ch(n++, cx + 35, cz + hd + cd, 180); }
    }
    return out;
  };
  // taula llarga cap al finestral, a la banda de l'oest, amb dues cadires a cada costat: el pas cap a la terrassa i el passadís queda a l'est
  const diningW = () => {
    const tb = piece(room, have, 'fix-taula', 'mesa');
    put(tb, { x: R.x0 + 40 + tb.d / 2, z: R.z1 - 45 - tb.w / 2, rot: 90 });
    const out = [tb], cd = 25 - 12; // les cadires entren 12 cm sota la taula
    [[-1, -35], [-1, 35], [1, -35], [1, 35]].forEach(([sx, dz], k) => out.push(piece(room, have, `fix-cadira${k + 1}`, 'silla', { x: tb.x + sx * (tb.d / 2 + cd), z: tb.z + dz, rot: sx < 0 ? 90 : 270 })));
    return out;
  };
  const tvUp = R.z0 + 155; // sala més amunt (just després del pas de la cuina): queda lloc per a la taula al fons
  return [
    {
      key: 'menjador-1', name: '🛋 Sofà davant de la tele i taula al costat del finestral',
      note: 'La tele va a la paret llarga de l’entrada i el sofà, just al davant, a la paret de l’altra banda, amb la tauleta al mig. La taula, amb les quatre cadires, va a la banda del finestral: s’hi menja amb llum i queda pas lliure de l’entrada al passadís, a la cuina i a la terrassa.',
      items: [...sala(tvUp), ...diningW()],
    },
    {
      key: 'menjador-2', name: '🛋 Sala amb catifa, llum de peu i planta',
      note: 'Com la primera, però més acollidora: una catifa sota la tauleta, un llum de peu a la punta del sofà per llegir i una planta al costat de la tele. Són tres coses noves (surten a la Compra).',
      items: (() => {
        const base = sala(tvUp);
        const sofa = base.find((i) => i.id === 'fix-sofa'), tvm = base.find((i) => i.id === 'fix-mobletv');
        const rug = piece(room, have, 'pr-catifa', 'alfombra', { w: 200, d: 140, name: 'Catifa de la sala' }); put(rug, { x: R.x0 + sofa.d + 70, z: tvUp, rot: 90 });
        const llum = piece(room, have, 'pr-llum', 'lampara', { name: 'Llum de peu' }); put(llum, { x: R.x0 + 20, z: tvUp + sofa.w / 2 + 22, rot: 90 });
        const pl = piece(room, have, 'pr-planta', 'planta', { w: 35, d: 35, name: 'Planta' }); put(pl, wall(R, pl, 'E', tvm.z + tvm.w / 2 + 25, 2));
        return [...base, rug, llum, pl, ...diningW()];
      })(),
    },
  ];
}

// ---------------------------------------------------------------- Dormitori
// 310 × 310. Porta a la paret de dalt, a l'esquerra; armari encastat a tota la paret de l'oest; finestral a la de baix.
// El llit només té lloc amb el capçal a la paret de l'est (la de la porta i la de l'armari no tenen prou paret, i la de baix és el finestral).
function dormitori(room, t, have) {
  const R = innerRect(room, t);
  const bedAt = (R.z0 + R.z1) / 2;
  const bed = (at = bedAt) => {
    const b = piece(room, have, 'fix-llit', 'cama'); put(b, { x: R.x1 - b.d / 2, z: at, rot: 270 });
    const n = piece(room, have, 'fix-tauleta-n', 'mesita'); put(n, wall(R, n, 'E', at - b.w / 2 - n.w / 2 - 2));
    const s = piece(room, have, 'fix-tauleta-s', 'mesita'); put(s, wall(R, s, 'E', at + b.w / 2 + s.w / 2 + 2));
    return [b, n, s];
  };
  // calaixera a la paret de l'armari, passat l'armari i tocant al finestral: no tapa res i queda pas cap a la tauleta del finestral
  const calaixera = () => { const c = piece(room, have, 'pr-calaixera', 'comoda', { w: 100, d: 45, name: 'Calaixera' }); return put(c, wall(R, c, 'W', R.z1 - 10 - 50)); };
  return [
    {
      key: 'dormitori-1', name: '🛏 Llit centrat i calaixera',
      note: 'El llit al mig de la paret de l’est amb una tauleta a cada costat (com ara) i una calaixera a la paret de l’armari, passat l’armari, al costat del finestral. L’armari es pot obrir i hi ha pas fins a la tauleta del finestral.',
      items: [...bed(), calaixera()],
    },
    {
      key: 'dormitori-2', name: '🛏 Capçal amb quadre, llums de lectura i catifa',
      note: 'El llit com ara amb un quadre damunt del capçal, un llum de paret a cada costat per llegir i una catifa als peus del llit. Tot és de penjar o de terra: no treu gens de pas.',
      items: (() => {
        const b = bed(), bd = b[0];
        const q = piece(room, have, 'pr-quadre-d', 'quadre', { w: 90, h: 60, name: 'Quadre del capçal', elev: 125 }); put(q, wall(R, q, 'E', bedAt));
        const a1 = piece(room, have, 'pr-aplic-d1', 'aplic', { name: 'Llum de lectura 1' }); put(a1, wall(R, a1, 'E', bedAt - bd.w / 2 - 22));
        const a2 = piece(room, have, 'pr-aplic-d2', 'aplic', { name: 'Llum de lectura 2' }); put(a2, wall(R, a2, 'E', bedAt + bd.w / 2 + 22));
        const rug = piece(room, have, 'pr-catifa-d', 'alfombra', { w: 200, d: 90, name: 'Catifa als peus del llit' }); put(rug, { x: R.x1 - bd.d - 40, z: bedAt, rot: 90 });
        return [...b, q, a1, a2, rug];
      })(),
    },
  ];
}

// ---------------------------------------------------------------- Terrassa del menjador
// 268 × 130, s'hi surt pel finestral del menjador (al mig de la paret de dalt).
function terrassa(room, t, have) {
  const R = innerRect(room, t);
  const rail = R.z1 - 35; // els mobles van arran de la barana: davant del finestral queden 60 cm per passar
  return [
    {
      key: 'terrassa-1', name: '☀️ Taula per menjar fora',
      note: 'Una taula de 70 × 70 amb dues cadires arran de la barana, a la banda de l’est, i una planta a la cantonada de l’oest. Davant del finestral queda pas per sortir.',
      items: (() => {
        const tb = piece(room, have, 'pr-taula-t', 'mesa', { w: 70, d: 70, h: 72, name: 'Tauleta exterior', color: '#8a8f94' }); put(tb, { x: R.x1 - 50 - 35 - 13, z: rail, rot: 0 });
        const c1 = piece(room, have, 'pr-cadira-t1', 'silla', { name: 'Cadira exterior 1', color: '#8a8f94' }); put(c1, { x: tb.x - 35 - 13, z: tb.z, rot: 90 });
        const c2 = piece(room, have, 'pr-cadira-t2', 'silla', { name: 'Cadira exterior 2', color: '#8a8f94' }); put(c2, { x: tb.x + 35 + 13, z: tb.z, rot: 270 });
        const pl = piece(room, have, 'pr-planta-t', 'planta', { name: 'Planta' }); put(pl, { x: R.x0 + 25, z: R.z1 - 25, rot: 0 });
        return [tb, c1, c2, pl];
      })(),
    },
    {
      key: 'terrassa-2', name: '☀️ Dues butaques mirant la muntanya',
      note: 'Dues butaques baixes arran de la barana, girades cap a fora, amb una tauleta al mig i una planta a la cantonada. Davant del finestral queda pas per sortir.',
      items: (() => {
        const mk = (id, n, x) => { const b = piece(room, have, id, 'sillon', { w: 70, d: 70, h: 75, name: `Butaca exterior ${n}`, color: '#9a8f80' }); return put(b, { x, z: R.z1 - 35 - 2, rot: 0 }); };
        const b2 = mk('pr-butaca-t2', 2, R.x1 - 37), b1 = mk('pr-butaca-t1', 1, b2.x - 70 - 45);
        const tc = piece(room, have, 'pr-tauleta-t', 'mesaCentro', { w: 40, d: 40, h: 40, name: 'Tauleta exterior' }); put(tc, { x: (b1.x + b2.x) / 2, z: R.z1 - 25, rot: 0 });
        const p1 = piece(room, have, 'pr-planta-t1', 'planta', { name: 'Planta' }); put(p1, { x: R.x0 + 25, z: R.z1 - 25, rot: 0 });
        return [b1, b2, tc, p1];
      })(),
    },
  ];
}

const ROOMS = { salon: menjador, dormitorio: dormitori, terraza: terrassa };

// Totes les propostes de WALL-E per a un estat: { roomId: [{ key, name, note, items }] }.
// have(id): el moble real amb aquest id (per mantenir-ne les mides, el color i la foto), o res.
export function wallEProposals(s, t = 10) {
  const byId = new Map((s.items || []).map((i) => [i.id, i]));
  const have = (id) => byId.get(id);
  const out = {};
  for (const r of s.rooms || []) {
    if (r.id === 'office') { const p = officeProposals(r, t); if (p.length) out[r.id] = p.map((x, i) => ({ key: `office-sim-${i + 1}`, ...x })); continue; }
    const f = ROOMS[r.id];
    if (f) out[r.id] = f(r, t, have);
  }
  return out;
}
