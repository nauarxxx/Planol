// Propostes de l'office fetes a mà amb l'objectiu de la persona (foto del 2026-11-14): simulador de conducció amb
// una pantalla de 50″ penjada a la paret cap on mira (no al simulador) i dos escriptoris, cadascun amb la seva cadira i dos monitors de 27″.
// L'office fa 205 × 275 per dins. La porta és a la cantonada de l'armari (paret de dalt) i s'obre cap a dins contra aquesta paret;
// la finestra és a la paret de baix i l'armari petit a la dreta, a baix. El simulador va a la paret de l'esquerra mirant cap a dalt,
// on la pantalla (112 cm d'ample) cap entre la cantonada i la porta (~120 cm). Un escriptori va sota la finestra i l'altre a la dreta,
// entre la porta i l'armari: allà només hi ha ~115 cm, i dos monitors de 27″ l'un al costat de l'altre (124 cm) toparien amb la porta
// o amb l'armari, per això hi van l'un damunt de l'altre amb un braç.
// Les posicions es calculen a partir de l'interior de l'habitació, perquè segueixin la paret si se'n canvien les mides.
import { innerRect } from './geom.js?v=51';

const MON = { w: 62, d: 20, h: 52 };
const DESK_H = 75;
const MON_UP_H = 38; // monitor de dalt en un braç: només la pantalla (36) i el braç
// pantalla del simulador: 50″ en 16:9 són 110,7 × 62,3 de pantalla; amb el marc, 112 × 65. Centre a l'alçada dels ulls de qui condueix (~100).
export const SIM_TV = { inch: 50, w: 112, h: 65, d: 5, elev: 68 };
const SIM_GAP = 0; // el davant del simulador toca la pantalla (que fa 5 de gruix): els pedals queden a sota

// Paret lliure a l'esquerra de la porta de la paret de dalt (cm, per dins).
export function freeLeftOfDoor(room, t = 10) {
  const R = innerRect(room, t);
  const d = (room.openings || []).find((o) => o.wall === 'N' && o.type === 'puerta');
  return d ? room.x + d.offset - R.x0 : R.x1 - R.x0;
}

function kit(room, t, desks, name, note, extra = null) {
  const R = innerRect(room, t);
  const out = [];
  let n = 0;
  const add = (type, o) => out.push({ id: `of-${type}-${++n}`, type, roomId: room.id, locked: false, elev: 0, ...o });
  // pantalla de 50″ penjada a la paret de la porta, entre la cantonada i la porta, davant del simulador
  const T = SIM_TV;
  add('tvParet', { name: `Pantalla del simulador ${T.inch}″`, w: T.w, d: T.d, h: T.h, elev: T.elev, color: '#151515', x: R.x0 + T.w / 2, z: R.z0 + T.d / 2, rot: 0 });
  // simulador: 150 de llarg (seient a baix, volant a dalt) i 90 d'ample, tocant a la paret de l'esquerra i mirant la pantalla
  add('cockpit', { name: 'Simulador cockpit', w: 150, d: 90, h: 100, color: '#2a2a2e', x: R.x0 + 45, z: R.z0 + T.d + SIM_GAP + 75, rot: 90 });
  desks.forEach((dk, i) => {
    const { wall, at, w = 120, d = 60, stack = false } = dk;
    // rot: cap on mira qui s'hi asseu (el davant de l'escriptori); n = cap a dins de l'habitació
    const P = {
      S: { x: at, z: R.z1 - d / 2, rot: 180, n: [0, -1] },
      E: { x: R.x1 - d / 2, z: at, rot: 270, n: [-1, 0] },
      W: { x: R.x0 + d / 2, z: at, rot: 90, n: [1, 0] },
    }[wall];
    const lab = desks.length > 1 ? ` ${i + 1}` : '';
    add('escritorio', { name: `Escriptori${lab}`, w, d, h: DESK_H, color: '#b08a5c', x: P.x, z: P.z, rot: P.rot });
    // dos monitors de 27″ al fons de l'escriptori: l'un al costat de l'altre o, si no hi caben, l'un damunt de l'altre amb un braç
    const back = d / 2 - MON.d / 2 - 2; // del centre de l'escriptori cap a la paret
    const bx = P.x - P.n[0] * back, bz = P.z - P.n[1] * back;
    if (stack) {
      add('monitor', { name: `Monitor 27″${lab} a`, ...MON, elev: DESK_H, color: '#1d1f24', x: bx, z: bz, rot: P.rot });
      add('monitor', { name: `Monitor 27″${lab} b (braç, a dalt)`, ...MON, h: MON_UP_H, arm: true, elev: DESK_H + MON.h, color: '#1d1f24', x: bx, z: bz, rot: P.rot });
    } else {
      for (const s of [-1, 1]) {
        const along = s * (MON.w / 2 + 0.5);
        const x = bx + (P.n[0] === 0 ? along : 0);
        const z = bz + (P.n[1] === 0 ? along : 0);
        add('monitor', { name: `Monitor 27″${lab}${s < 0 ? ' a' : ' b'}`, ...MON, elev: DESK_H, color: '#1d1f24', x, z, rot: P.rot });
      }
    }
    // cadira d'oficina mig ficada sota l'escriptori, mirant-lo
    const off = d / 2 + 32.5 - 20;
    add('cadiraOficina', { name: `Cadira d’oficina${lab}`, w: 65, d: 65, h: 115, color: '#2b2b30', x: P.x + P.n[0] * off, z: P.z + P.n[1] * off, rot: (P.rot + 180) % 360 });
  });
  if (extra) extra(R, add, out);
  return { name, note, items: out };
}

// Llista de propostes per a l'office (buida si l'habitació és massa petita per al simulador).
export function officeProposals(room, t = 10) {
  if (!room) return [];
  const R = innerRect(room, t);
  if (R.x1 - R.x0 < 190 || R.z1 - R.z0 < 260) return [];
  if (freeLeftOfDoor(room, t) < SIM_TV.w) return []; // la pantalla de 50″ no hi cap al costat de la porta
  const E0 = R.z0 + SIM_TV.d + SIM_GAP + 75; // ~la porta: l'escriptori de la dreta comença on acaba el simulador (i la porta oberta)
  return [
    kit(room, t, [{ wall: 'S', at: R.x0 + 63 }, { wall: 'E', at: E0 + 57.5, w: 115, stack: true }],
      '🏁 Simulador + escriptori a la finestra i a la dreta',
      'Simulador a la paret de l’esquerra mirant la pantalla de 50″, penjada entre la cantonada i la porta. Un escriptori de 120 sota la finestra amb els dos monitors l’un al costat de l’altre, i un de 115 a la dreta amb els monitors l’un damunt de l’altre (al costat no hi caben sense topar amb la porta o amb l’armari). La porta i l’armari queden lliures.'),
    kit(room, t, [{ wall: 'S', at: R.x0 + 63, w: 110, d: 55 }, { wall: 'E', at: E0 + 55, w: 110, d: 55, stack: true }],
      '🏁 Simulador + escriptoris compactes (més pas)',
      'Com l’altra, però amb escriptoris de 110 × 55: hi ha uns 10 cm més de pas entre les cadires i el simulador. Els monitors de l’escriptori de la finestra sobresurten una mica dels costats.'),
    kit(room, t, [{ wall: 'S', at: R.x0 + 70, w: 140 }, { wall: 'E', at: E0 + 57.5, w: 115, stack: true }],
      '🏁 Simulador + escriptori llarg a la finestra',
      'Com la primera, però l’escriptori de la finestra fa 140: hi ha lloc per als dos monitors i encara queda taula per escriure o per al portàtil. L’armari queda lliure.'),
    kit(room, t, [{ wall: 'S', at: R.x0 + 63 }, { wall: 'E', at: E0 + 57.5, w: 115, stack: true }],
      '🏁 Simulador amb prestatge i catifa',
      'Com la primera, amb una catifa sota el simulador (protegeix el terra i apaga el soroll dels pedals) i un prestatge a la paret, damunt del seient, per al casc, els auriculars i els trofeus.',
      (R, add, out) => {
        const sim = out.find((i) => i.type === 'cockpit');
        add('alfombra', { name: 'Catifa del simulador', w: 160, d: 100, h: 1, color: '#3a3d42', x: R.x0 + 52, z: sim.z, rot: 90 });
        add('prestatge', { name: 'Prestatge del simulador', w: 80, d: 22, h: 4, elev: 150, color: '#a07850', x: R.x0 + 11, z: sim.z + 25, rot: 90 });
      }),
  ];
}
