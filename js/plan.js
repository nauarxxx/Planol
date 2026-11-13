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
  version: 21, // v21: cuina segons la foto (mur de la nevera a l'est, pas obert a l'oest, mobles fixos de cuina); v20: biga baixa damunt del racó (element «biga»); v19: racó amb mirall entre el menjador i l'office, passadís 60 més amunt; v18: mur de 72 entre cuina i menjador; v17: finestrals de 164; v16: 'Menjador'; v15: portes de vidre de les terrasses i finestral del dormitori segons les fotos; v14: noms en català; v13: ventana del office de 107, el salón no tiene ventana; v12: office 205×275 con ventana de 167, ventanal doble del dormitorio; v11: baño 1 190×190 y baño 2 107×145 (croquis); v10: cotas del croquis (salón 270×440, terraza 268×130); v9: baño 1 sobre el final del pasillo, baño 2 detrás del fondo; v5: office, armarios repartidos, baño 2 y terraza en diagonal
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
      notes: 'Cuina oberta al menjador (estar-menjador-cuina: 26,80 m² en total). Taulell de 55 de fons (cota del croquis). Vist des de la porta de la terrassa: a l’esquerra (est) el taulell amb la pica, la rentadora i la nevera, que recolza al mur que separa la cuina del menjador; a la dreta (oest) el taulell amb la placa i la campana, i al fons a la dreta el pas obert al menjador. Llargada del mur de la nevera (105) i de la cuina estimades.',
      estimated: true,
      openings: [
        { wall: 'N', offset: 62, width: 90, type: 'puerta', hinge: 'b' },
        { wall: 'S', offset: 0, width: 165, type: 'paso' },
      ],
    },
    {
      id: 'salon', name: 'Menjador', kind: 'room', color: '#c89b6a',
      x: 0, z: 380, w: 270, d: 440,
      notes: 'Menjador 270 × 440 segons les cotes del croquis (440 de llarg per la paret exterior, 270 d’ample; paret de la tele 275). Entrada des del replà, a la paret de la tele. Sense finestra: la llum entra per la porta de vidre doble de la terrassa (164, confirmada). Sostre inclinat que baixa cap a la terrassa.',
      estimated: false,
      openings: [
        { wall: 'E', offset: 15, width: 85, type: 'puerta' },
        { wall: 'E', offset: 220, width: 90, type: 'paso' },
        { wall: 'S', offset: 53, width: 164, type: 'ventanal' },
      ],
    },
    {
      id: 'raco', name: 'Racó', kind: 'room', color: '#c89b6a',
      x: 270, z: 740, w: 50, d: 80,
      notes: 'Racó obert al menjador, al costat de la terrassa: després del pas al passadís hi ha el pilar del mirall (≈50 d’ample) i la paret recula uns 50 fins a l’office, amb la biga baixa a sobre. Mides estimades a partir de la foto.',
      estimated: true,
      openings: [{ wall: 'W', offset: 0, width: 80, type: 'paso' }],
    },
    {
      id: 'biga-raco', name: 'Biga del racó', kind: 'beam', color: '#f3f1ec',
      x: 270, z: 740, w: 50, d: 80, h0: 210,
      notes: 'Biga baixa damunt del racó del mirall, de 210 fins al sostre (estimat). A sota només hi caben mobles més baixos.',
      estimated: true,
      openings: [],
    },
    {
      id: 'terraza', name: 'Terrassa', kind: 'terrace', color: '#b8673f',
      x: 0, z: 820, w: 268, d: 130,
      notes: 'Terrassa del menjador: 268 × 130 segons el croquis (≈3,5 m²).',
      estimated: false,
      openings: [],
    },
    {
      id: 'bano', name: 'Bany 1', kind: 'room', color: '#9aa3a8',
      x: 705, z: 405, w: 190, d: 190,
      notes: 'Bany 1: 190 × 190 segons el croquis (banyera, vàter i bidet). Damunt del tram final del passadís; la porta és al racó on acaba el passadís.',
      estimated: false,
      openings: [{ wall: 'S', offset: 110, width: 70, type: 'puerta' }],
    },
    {
      id: 'bano2', name: 'Bany 2', kind: 'room', color: '#a7b1b6',
      x: 895, z: 560, w: 107, d: 145,
      notes: 'Bany 2: 107 × 145 segons el croquis (145 de llarg, 107 de fons). S’hi entra per la paret del fons del passadís, al costat de la porta del bany 1.',
      estimated: false,
      openings: [{ wall: 'W', offset: 45, width: 70, type: 'puerta' }],
    },
    {
      id: 'distribuidor', name: 'Passadís', kind: 'room', color: '#c89b6a',
      x: 270, z: 595, w: 625, d: 100,
      notes: 'Passadís que uneix el menjador amb el bany 1, el bany 2, l’office i el dormitori. 4,60 m² al projecte.',
      estimated: true,
      openings: [],
    },
    {
      id: 'office', name: 'Office', kind: 'room', color: '#c9b9a0',
      x: 320, z: 695, w: 205, d: 275,
      notes: 'Office: 205 (paret de la finestra) × 275 (croquis). Finestra simple de 107: 36 fins a la paret de 275 i 60 fins a l’armari.',
      estimated: false,
      openings: [
        { wall: 'N', offset: 110, width: 80, type: 'puerta' },
        { wall: 'S', offset: 36, width: 107, type: 'ventana' },
      ],
    },
    {
      id: 'armario-dorm', name: 'Armari dormitori', kind: 'room', color: '#bfb3a0',
      x: 525, z: 695, w: 60, d: 195,
      notes: 'Armari encastat del dormitori: 60 de fons (cota del croquis); la llargada (195) és estimada.',
      estimated: true,
      openings: [{ wall: 'E', offset: 10, width: 175, type: 'paso' }],
    },
    {
      id: 'armario-office', name: 'Armari office', kind: 'room', color: '#bfb3a0',
      x: 525, z: 890, w: 60, d: 80,
      notes: 'Armari petit de l’office, al costat de la finestra, a l’extrem de la columna d’armaris. Estimat.',
      estimated: true,
      openings: [{ wall: 'W', offset: 5, width: 70, type: 'paso' }],
    },
    {
      id: 'dormitorio', name: 'Dormitori', kind: 'room', color: '#c08e5e',
      x: 585, z: 695, w: 310, d: 310,
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
    { id: 'fix-pica', type: 'encimeraPica', name: 'Taulell amb pica', w: 120, d: 55, h: 90, elev: 0, color: '#e9e4da', x: 237.5, z: 185, rot: 270, roomId: 'cocina', locked: true },
    { id: 'fix-rentadora', type: 'rentadora', name: 'Rentadora', w: 60, d: 60, h: 85, elev: 0, color: '#f2f2f0', x: 235, z: 275, rot: 270, roomId: 'cocina', locked: true },
    { id: 'fix-nevera', type: 'nevera', name: 'Nevera', w: 60, d: 65, h: 185, elev: 0, color: '#f2f2f0', x: 235, z: 342.5, rot: 180, roomId: 'cocina', locked: true },
    { id: 'fix-placa', type: 'encimeraPlaca', name: 'Taulell amb placa', w: 160, d: 55, h: 90, elev: 0, color: '#e9e4da', x: 32.5, z: 205, rot: 90, roomId: 'cocina', locked: true },
    { id: 'fix-campana', type: 'campana', name: 'Campana extractora', w: 60, d: 50, h: 40, elev: 155, color: '#9ea3a8', x: 30, z: 255, rot: 90, roomId: 'cocina', locked: true },
  ],
};
