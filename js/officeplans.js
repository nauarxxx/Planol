// Propostes de l'office fetes a mà amb l'objectiu de la persona (foto del 2026-11-14): simulador de conducció amb
// una pantalla al davant i dos escriptoris, cadascun amb la seva cadira i dos monitors de 27″.
// L'office fa 205 × 275 per dins, amb la porta a la paret de dalt (s'obre cap a dins), la finestra a la de baix i
// l'armari petit a la dreta, a baix. Amb aquestes tres coses, el simulador només hi cap a la paret de l'esquerra,
// mirant cap a la paret de la porta, on hi ha 105 cm de paret per a la pantalla (43″). Els escriptoris van a les parets que queden.
// Les posicions es calculen a partir de l'interior de l'habitació, perquè segueixin la paret si se'n canvien les mides.
import { innerRect } from './geom.js?v=49';

const MON = { w: 62, d: 20, h: 52 };
const DESK_H = 75;

function kit(room, t, desks, name, note) {
  const R = innerRect(room, t);
  const out = [];
  let n = 0;
  const add = (type, o) => out.push({ id: `of-${type}-${++n}`, type, roomId: room.id, locked: false, elev: 0, ...o });
  // pantalla penjada a la paret de la porta, davant del simulador (43″: 97 × 57)
  add('tvParet', { name: 'Pantalla del simulador 43″', w: 97, d: 5, h: 57, elev: 100, color: '#151515', x: R.x0 + 49, z: R.z0 + 2.5, rot: 0 });
  // simulador: 150 de llarg (seient a baix, volant a dalt) i 90 d'ample, tocant a la paret de l'esquerra i mirant la pantalla
  add('cockpit', { name: 'Simulador cockpit', w: 150, d: 90, h: 100, color: '#2a2a2e', x: R.x0 + 45, z: R.z0 + 75, rot: 90 });
  desks.forEach((dk, i) => {
    const { wall, at, w = 120, d = 60 } = dk;
    // rot: cap on mira qui s'hi asseu (el davant de l'escriptori); n = cap a dins de l'habitació
    const P = {
      S: { x: at, z: R.z1 - d / 2, rot: 180, n: [0, -1] },
      E: { x: R.x1 - d / 2, z: at, rot: 270, n: [-1, 0] },
      W: { x: R.x0 + d / 2, z: at, rot: 90, n: [1, 0] },
    }[wall];
    const lab = desks.length > 1 ? ` ${i + 1}` : '';
    add('escritorio', { name: `Escriptori${lab}`, w, d, h: DESK_H, color: '#b08a5c', x: P.x, z: P.z, rot: P.rot });
    // dos monitors de 27″ al fons de l'escriptori, l'un al costat de l'altre
    const back = d / 2 - MON.d / 2 - 2; // del centre de l'escriptori cap a la paret
    for (const s of [-1, 1]) {
      const along = s * (MON.w / 2 + 0.5);
      const x = P.x - P.n[0] * back + (P.n[0] === 0 ? along : 0);
      const z = P.z - P.n[1] * back + (P.n[1] === 0 ? along : 0);
      add('monitor', { name: `Monitor 27″${lab}${s < 0 ? ' a' : ' b'}`, ...MON, elev: DESK_H, color: '#1d1f24', x, z, rot: P.rot });
    }
    // cadira d'oficina mig ficada sota l'escriptori, mirant-lo
    const off = d / 2 + 32.5 - 20;
    add('cadiraOficina', { name: `Cadira d’oficina${lab}`, w: 65, d: 65, h: 115, color: '#2b2b30', x: P.x + P.n[0] * off, z: P.z + P.n[1] * off, rot: (P.rot + 180) % 360 });
  });
  return { name, note, items: out };
}

// Llista de propostes per a l'office (buida si l'habitació és massa petita per al simulador).
export function officeProposals(room, t = 10) {
  if (!room) return [];
  const R = innerRect(room, t);
  if (R.x1 - R.x0 < 190 || R.z1 - R.z0 < 260) return [];
  return [
    kit(room, t, [{ wall: 'S', at: R.x0 + 63 }, { wall: 'E', at: R.z0 + 132 }],
      '🏁 Simulador + escriptori a la finestra i a la dreta',
      'Simulador a la paret de l’esquerra mirant la pantalla, un escriptori sota la finestra i l’altre a la paret de la dreta. L’armari i la porta queden lliures.'),
    kit(room, t, [{ wall: 'E', at: R.z0 + 132 }, { wall: 'W', at: R.z1 - 63 }],
      '🏁 Simulador + escriptoris a banda i banda',
      'Simulador a la paret de l’esquerra; un escriptori a la dreta i l’altre a l’esquerra, darrere del seient del simulador. La finestra queda lliure.'),
    kit(room, t, [{ wall: 'S', at: R.x0 + 63, w: 110, d: 55 }, { wall: 'E', at: R.z0 + 132, w: 110, d: 55 }],
      '🏁 Simulador + escriptoris compactes (més pas)',
      'Com la primera, però amb escriptoris de 110 × 55: hi ha uns 15 cm més de pas entre les cadires i el simulador. Els monitors sobresurten una mica dels costats.'),
  ];
}
