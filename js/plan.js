// Plano por defecto. v3: a partir del plano de arquitectura ("Planol Arquitectura cotes 2026-11-13.jpeg")
// y del croquis con cotas ("Planol 2026-11-13 at 15.47.12.jpeg").
// Todas las medidas en centímetros. X hacia la derecha, Z hacia abajo (vista en planta).
// Cada habitación es un rectángulo interior: x, z (esquina superior izquierda), w (ancho X), d (fondo Z).
// estimated: true indica que la medida no aparece en el plano y es una aproximación.
// openings: huecos en las paredes. wall: 'N' | 'S' | 'E' | 'W', offset desde la esquina N/W, width,
// type: 'puerta' | 'ventana' | 'ventanal' (doble, de suelo a techo) | 'paso'.

// Vivienda 3-1 B (Escala B), planta sotacoberta. Superficies útiles del proyecto (abril 2010):
// estar-menjador-cuina 26,80 m² · dormitori 11,00 · bany 5,00 · traster-safareig 7,70 · traster 2,10
// · pas 4,60 · interior 56,80 · terrazas 8,25 · total 65,05 m².
export const DEFAULT_PLAN = {
  version: 27, // v27: banys segons la persona i el vídeo (bany 1: vàter a l'esquerra de la porta, lavabo al davant, banyera a tota la paret de l'esquerra; bany 2: lavabo a l'esquerra i vàter davant de la porta); v26: la porta d’entrada (90) és a la paret de la tele del menjador, a la cantonada amb la cuina; després 226 de paret, el pas al passadís (90) i just després el racó (530 en total, segons la persona i el vídeo); el passadís i les habitacions baixen 90; la nevera torna al taulell de l’est; v25: v25: la porta d'entrada és just abans del menjador (paret est de la cuina, tocant al mur de la nevera) i de la porta al pas del passadís la paret fa 226 (cota del croquis); v24: vàter i lavabo del bany 1 mirant cap a dins; v23: racó del mirall segons la foto: pilar amb el mirall dins del racó, tocant a la paret del passadís; v22: mobles de tot el pis segons el vídeo (menjador, dormitori, office amb llitera, banys); porta del bany 2 cap enfora; v21: cuina segons la foto (mur de la nevera a l'est, pas obert a l'oest, mobles fixos de cuina); v20: biga baixa damunt del racó (element «biga»); v19: racó amb mirall entre el menjador i l'office, passadís 60 més amunt; v18: mur de 72 entre cuina i menjador; v17: finestrals de 164; v16: 'Menjador'; v15: portes de vidre de les terrasses i finestral del dormitori segons les fotos; v14: noms en català; v13: ventana del office de 107, el salón no tiene ventana; v12: office 205×275 con ventana de 167, ventanal doble del dormitorio; v11: baño 1 190×190 y baño 2 107×145 (croquis); v10: cotas del croquis (salón 270×440, terraza 268×130); v9: baño 1 sobre el final del pasillo, baño 2 detrás del fondo; v5: office, armarios repartidos, baño 2 y terraza en diagonal
  ceiling: 250, // estimado: el plano no indica la altura del techo
  ceilingEstimated: true,
  wallThickness: 10,
  rooms: [
    {
      id: 'terraza-cocina', name: 'Terrassa cuina', kind: 'terrace', color: '#b8673f',
      x: 0, z: 0, w: 335, d: 120, d2: 40,
      notes: 'Terrassa de la cuina amb la vora exterior en diagonal: 120 de fons a l’esquerra i 40 a la dreta (≈2,7 m²). Les dues terrasses sumen 8,25 m².',
      estimated: true,
      openings: [],
    },
    {
      id: 'cocina', name: 'Cuina', kind: 'room', color: '#d9c7a3',
      x: 0, z: 120, w: 270, d: 260,
      notes: 'Cuina oberta al menjador (estar-menjador-cuina: 26,80 m² en total). Taulell de 55 de fons (cota del croquis). Vist des de la porta de la terrassa: a l’esquerra (est) el taulell amb la pica, la rentadora i la nevera, que recolza a la paret que separa la cuina del menjador; a la dreta (oest) el taulell amb la placa i la campana, i al fons a la dreta el pas obert al menjador. La porta d’entrada del pis no és a la cuina: és al menjador, just a l’altra banda d’aquesta paret. Llargada de la cuina estimada.',
      estimated: true,
      openings: [
        { wall: 'N', offset: 62, width: 90, type: 'puerta', hinge: 'b' },
        { wall: 'S', offset: 0, width: 115, type: 'paso' },
      ],
    },
    {
      id: 'salon', name: 'Menjador', kind: 'room', color: '#c89b6a',
      x: 0, z: 380, w: 270, d: 530,
      notes: 'Menjador 270 d’ample (paret de la tele 275). Paret de la tele (est), des de la cantonada amb la cuina: porta d’entrada de 90 (s’obre contra la paret de la cuina), 226 de paret amb la tele, el pas de 90 al passadís i, just després, el racó fins a la terrassa: uns 530 en total (la persona diu «una mica més de 500»; abans hi havia 440 del croquis). En entrar es veu la taula a prop de la cuina i el sofà al fons, tocant a la terrassa. Sense finestra: la llum entra per la porta de vidre doble de la terrassa (164, confirmada). Sostre inclinat que baixa cap a la terrassa.',
      estimated: false,
      openings: [
        { wall: 'E', offset: 0, width: 90, type: 'puerta', hinge: 'a' },
        { wall: 'E', offset: 316, width: 90, type: 'paso' },
        { wall: 'S', offset: 53, width: 164, type: 'ventanal' },
      ],
    },
    {
      id: 'raco', name: 'Racó', kind: 'room', color: '#c89b6a',
      x: 270, z: 786, w: 50, d: 124,
      notes: 'Racó obert al menjador, just després del pas al passadís (confirmat per la persona) i fins a la terrassa, amb la biga baixa a sobre. Dins del racó, tocant a la paret del passadís, hi ha el pilar del mirall (≈40 d’ample i 35 de fons) amb el mirall a la cara que mira al menjador. Fons del racó estimat a partir de la foto.',
      estimated: true,
      openings: [{ wall: 'W', offset: 0, width: 124, type: 'paso' }],
    },
    {
      id: 'pilar-mirall', name: 'Pilar del mirall', kind: 'pillar', color: '#f3f1ec',
      x: 285, z: 786, w: 35, d: 40,
      notes: 'Pilar de terra a sostre dins del racó, enganxat a la paret del fons i a la del passadís; el mirall és a la seva cara oest, una mica reculada respecte a la paret del quadre. Al seu costat, cap a la terrassa, el racó queda obert fins al fons (≈50). Mides estimades a partir de la foto.',
      estimated: true,
      openings: [],
    },
    {
      id: 'biga-raco', name: 'Biga del racó', kind: 'beam', color: '#f3f1ec',
      x: 270, z: 786, w: 50, d: 124, h0: 210,
      notes: 'Biga baixa damunt del racó del mirall, de 210 fins al sostre (estimat). A sota només hi caben mobles més baixos.',
      estimated: true,
      openings: [],
    },
    {
      id: 'terraza', name: 'Terrassa', kind: 'terrace', color: '#b8673f',
      x: 0, z: 910, w: 268, d: 130,
      notes: 'Terrassa del menjador: 268 × 130 segons el croquis (≈3,5 m²).',
      estimated: false,
      openings: [],
    },
    {
      id: 'bano', name: 'Bany 1', kind: 'room', color: '#9aa3a8',
      x: 705, z: 495, w: 190, d: 190,
      notes: 'Bany 1: 190 × 190 segons el croquis. Damunt del tram final del passadís; la porta és al racó on acaba el passadís i s’obre contra la paret de la dreta. Entrant: el vàter just a l’esquerra de la porta, al davant un espai buit, a l’esquerra d’aquest espai el lavabo amb mirall i, a tota la paret de l’esquerra, la banyera amb cortina.',
      estimated: false,
      openings: [{ wall: 'S', offset: 115, width: 70, type: 'puerta', hinge: 'b' }],
    },
    {
      id: 'bano2', name: 'Bany 2', kind: 'room', color: '#a7b1b6',
      x: 895, z: 650, w: 107, d: 145,
      notes: 'Bany 2: 107 × 145 segons el croquis (145 de llarg, 107 de fons). S’hi entra per la paret del fons del passadís, al costat de la porta del bany 1.',
      estimated: false,
      openings: [{ wall: 'W', offset: 45, width: 70, type: 'puerta', swing: 'out' }],
    },
    {
      id: 'distribuidor', name: 'Passadís', kind: 'room', color: '#c89b6a',
      x: 270, z: 685, w: 625, d: 100,
      notes: 'Passadís que uneix el menjador amb el bany 1, el bany 2, l’office i el dormitori. 4,60 m² al projecte.',
      estimated: true,
      openings: [],
    },
    {
      id: 'office', name: 'Office', kind: 'room', color: '#c9b9a0',
      x: 320, z: 785, w: 205, d: 275,
      notes: 'Office: 205 (paret de la finestra) × 275 (croquis). Finestra simple de 107: 36 fins a la paret de 275 i 60 fins a l’armari.',
      estimated: false,
      openings: [
        { wall: 'N', offset: 110, width: 80, type: 'puerta' },
        { wall: 'S', offset: 36, width: 107, type: 'ventana' },
      ],
    },
    {
      id: 'armario-dorm', name: 'Armari dormitori', kind: 'room', color: '#bfb3a0',
      x: 525, z: 785, w: 60, d: 195,
      notes: 'Armari encastat del dormitori: 60 de fons (cota del croquis); la llargada (195) és estimada.',
      estimated: true,
      openings: [{ wall: 'E', offset: 10, width: 175, type: 'paso' }],
    },
    {
      id: 'armario-office', name: 'Armari office', kind: 'room', color: '#bfb3a0',
      x: 525, z: 980, w: 60, d: 80,
      notes: 'Armari petit de l’office, al costat de la finestra, a l’extrem de la columna d’armaris. Estimat.',
      estimated: true,
      openings: [{ wall: 'W', offset: 5, width: 70, type: 'paso' }],
    },
    {
      id: 'dormitorio', name: 'Dormitori', kind: 'room', color: '#c08e5e',
      x: 585, z: 785, w: 310, d: 310,
      notes: 'Dormitori 310 × 310 (confirmat). Finestral doble de terra a sostre de 164 (confirmat), a la part dreta de la paret; la posició és estimada a partir de la foto. Sostre inclinat que baixa cap al finestral.',
      estimated: false,
      openings: [
        { wall: 'N', offset: 30, width: 80, type: 'puerta' },
        { wall: 'S', offset: 110, width: 164, type: 'ventanal' },
      ],
    },
  ],
  // Mobles fixos de la cuina (foto del 2026-11-13 des de la porta de la terrassa). Bloquejats: les propostes no els mouen.
  items: [
    { id: 'fix-pica', type: 'encimeraPica', name: 'Taulell amb pica', w: 115, d: 55, h: 90, elev: 0, color: '#e9e4da', x: 237.5, z: 182.5, rot: 270, roomId: 'cocina', locked: true },
    { id: 'fix-rentadora', type: 'rentadora', name: 'Rentadora', w: 60, d: 60, h: 85, elev: 0, color: '#f2f2f0', x: 235, z: 270, rot: 270, roomId: 'cocina', locked: true },
    { id: 'fix-nevera', type: 'nevera', name: 'Nevera', w: 60, d: 65, h: 185, elev: 0, color: '#f2f2f0', x: 232.5, z: 345, rot: 270, roomId: 'cocina', locked: true },
    { id: 'fix-placa', type: 'encimeraPlaca', name: 'Taulell amb placa', w: 160, d: 55, h: 90, elev: 0, color: '#e9e4da', x: 32.5, z: 205, rot: 90, roomId: 'cocina', locked: true },
    { id: 'fix-campana', type: 'campana', name: 'Campana extractora', w: 60, d: 50, h: 40, elev: 155, color: '#9ea3a8', x: 30, z: 255, rot: 90, roomId: 'cocina', locked: true },
    // Menjador (vídeo): taula de fusta amb 4 cadires blanques a prop de la cuina, sofà gris a la paret de l'oest tocant a la terrassa, tauleta blanca, moble baix blanc amb la tele a la paret de l'est entre la porta d'entrada i el passadís.
    { id: 'fix-taula', type: 'mesa', name: 'Taula de menjador', w: 140, d: 80, h: 75, elev: 0, color: '#c89b5a', x: 135, z: 540, rot: 90, roomId: 'salon', locked: false },
    { id: 'fix-cadira1', type: 'silla', name: 'Cadira', w: 45, d: 50, h: 90, elev: 0, color: '#f0eee8', x: 67, z: 510, rot: 90, roomId: 'salon', locked: false },
    { id: 'fix-cadira2', type: 'silla', name: 'Cadira', w: 45, d: 50, h: 90, elev: 0, color: '#f0eee8', x: 67, z: 570, rot: 90, roomId: 'salon', locked: false },
    { id: 'fix-cadira3', type: 'silla', name: 'Cadira', w: 45, d: 50, h: 90, elev: 0, color: '#f0eee8', x: 203, z: 510, rot: 270, roomId: 'salon', locked: false },
    { id: 'fix-cadira4', type: 'silla', name: 'Cadira', w: 45, d: 50, h: 90, elev: 0, color: '#f0eee8', x: 203, z: 570, rot: 270, roomId: 'salon', locked: false },
    { id: 'fix-sofa', type: 'sofa', name: 'Sofà', w: 190, d: 90, h: 85, elev: 0, color: '#6f7378', x: 50, z: 805, rot: 90, roomId: 'salon', locked: false },
    { id: 'fix-tauleta', type: 'mesaCentro', name: 'Tauleta de centre', w: 90, d: 55, h: 45, elev: 0, color: '#f4f4f2', x: 135, z: 805, rot: 90, roomId: 'salon', locked: false },
    { id: 'fix-mobletv', type: 'muebleTv', name: 'Moble TV', w: 77, d: 39, h: 77, elev: 0, color: '#f4f4f2', x: 245.5, z: 528, rot: 270, roomId: 'salon', locked: false },
    { id: 'fix-tv', type: 'tv', name: 'Televisor', w: 80, d: 8, h: 50, elev: 77, color: '#151515', x: 251, z: 528, rot: 270, roomId: 'salon', locked: false },
    // Dormitori (vídeo): llit de matrimoni amb el capçal a la paret de l'est (quadres i aplics), tauletes blanques a cada costat, cortines al finestral.
    { id: 'fix-llit', type: 'cama', name: 'Llit', w: 150, d: 200, h: 55, elev: 0, color: '#e9e7e2', x: 790, z: 950, rot: 270, roomId: 'dormitorio', locked: false },
    { id: 'fix-tauleta-n', type: 'mesita', name: 'Tauleta de nit', w: 45, d: 40, h: 50, elev: 0, color: '#f4f4f2', x: 870, z: 853, rot: 270, roomId: 'dormitorio', locked: false },
    { id: 'fix-tauleta-s', type: 'mesita', name: 'Tauleta de nit', w: 45, d: 40, h: 50, elev: 0, color: '#f4f4f2', x: 870, z: 1047, rot: 270, roomId: 'dormitorio', locked: false },
    // Office (vídeo): llitera blanca de metall sota el sostre inclinat i una tauleta petita.
    { id: 'fix-llitera', type: 'litera', name: 'Llitera', w: 90, d: 200, h: 170, elev: 0, color: '#f4f4f2', x: 372, z: 892, rot: 0, roomId: 'office', locked: false },
    { id: 'fix-tauleta-o', type: 'mesita', name: 'Tauleta', w: 45, d: 40, h: 50, elev: 0, color: '#f4f4f2', x: 350, z: 1020, rot: 0, roomId: 'office', locked: false },
    // Bany 1 (persona i vídeo): entrant, el vàter just a l'esquerra de la porta; al davant de la porta, espai buit; a l'esquerra d'aquest espai, el lavabo; i tota la paret de l'esquerra, la banyera.
    { id: 'fix-banyera', type: 'banyera', name: 'Banyera', w: 180, d: 70, h: 55, elev: 0, color: '#f6f6f4', x: 745, z: 590, rot: 90, roomId: 'bano', locked: true },
    { id: 'fix-vater1', type: 'vater', name: 'Vàter', w: 38, d: 55, h: 42, elev: 0, color: '#f6f6f4', x: 800, z: 652.5, rot: 180, roomId: 'bano', locked: true },
    { id: 'fix-lavabo1', type: 'lavabo', name: 'Lavabo', w: 60, d: 45, h: 85, elev: 0, color: '#f2efe9', x: 811, z: 522.5, rot: 0, roomId: 'bano', locked: true },
    // Bany 2 (persona i vídeo): entrant, el lavabo a l'esquerra i el vàter just davant de la porta (la porta s'obre cap enfora: no hi xoca).
    { id: 'fix-vater2', type: 'vater', name: 'Vàter', w: 38, d: 55, h: 42, elev: 0, color: '#f6f6f4', x: 969.5, z: 730, rot: 270, roomId: 'bano2', locked: true },
    { id: 'fix-lavabo2', type: 'lavabo', name: 'Lavabo', w: 60, d: 40, h: 85, elev: 0, color: '#3a3330', x: 935, z: 675, rot: 0, roomId: 'bano2', locked: true },
    // Racó (foto): mirall alt i estret a la cara del pilar que mira al menjador.
    { id: 'fix-mirall', type: 'mirall', name: 'Mirall', w: 35, d: 2, h: 120, elev: 60, color: '#d9e2e6', x: 284, z: 808.5, rot: 270, roomId: 'raco', locked: true },
  ],
};
