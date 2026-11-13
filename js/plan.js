// Plano por defecto. v3: a partir del plano de arquitectura ("Planol Arquitectura cotes 2026-11-13.jpeg")
// y del croquis con cotas ("Planol 2026-11-13 at 15.47.12.jpeg").
// Todas las medidas en centímetros. X hacia la derecha, Z hacia abajo (vista en planta).
// Cada habitación es un rectángulo interior: x, z (esquina superior izquierda), w (ancho X), d (fondo Z).
// estimated: true indica que la medida no aparece en el plano y es una aproximación.
// openings: huecos en las paredes. wall: 'N' | 'S' | 'E' | 'W', offset desde la esquina N/W, width, type.

// Vivienda 3-1 B (Escala B), planta sotacoberta. Superficies útiles del proyecto (abril 2010):
// estar-menjador-cuina 26,80 m² · dormitori 11,00 · bany 5,00 · traster-safareig 7,70 · traster 2,10
// · pas 4,60 · interior 56,80 · terrazas 8,25 · total 65,05 m².
export const DEFAULT_PLAN = {
  version: 11, // v11: baño 1 190×190 y baño 2 107×145 (croquis); v10: cotas del croquis (salón 270×440, terraza 268×130); v9: baño 1 sobre el final del pasillo, baño 2 detrás del fondo; v5: office, armarios repartidos, baño 2 y terraza en diagonal
  ceiling: 250, // estimado: el plano no indica la altura del techo
  ceilingEstimated: true,
  wallThickness: 10,
  rooms: [
    {
      id: 'terraza-cocina', name: 'Terraza cocina', kind: 'terrace', color: '#b8673f',
      x: 10, z: 0, w: 335, d: 120, d2: 40,
      notes: 'Terraza sobre la cocina con el borde exterior en diagonal: 120 de fondo a la izquierda y 40 a la derecha (≈2,7 m²). Las dos terrazas suman 8,25 m².',
      estimated: true,
      openings: [],
    },
    {
      id: 'cocina', name: 'Cocina', kind: 'room', color: '#d9c7a3',
      x: 10, z: 120, w: 260, d: 260,
      notes: 'Zona de cocina abierta al comedor (estar-menjador-cuina: 26,80 m² en total). Encimera de 55 de fondo (cota del croquis). Largo y ancho estimados.',
      estimated: true,
      openings: [
        { wall: 'N', offset: 60, width: 90, type: 'puerta' },
        { wall: 'S', offset: 20, width: 220, type: 'paso' },
      ],
    },
    {
      id: 'salon', name: 'Salón-comedor', kind: 'room', color: '#c89b6a',
      x: 0, z: 380, w: 270, d: 440,
      notes: 'Salón-comedor 270 × 440 según las cotas del croquis (440 de largo por la pared exterior, 270 de ancho; pared de la tele 275). Entrada desde el rellano.',
      estimated: false,
      openings: [
        { wall: 'E', offset: 15, width: 85, type: 'puerta' },
        { wall: 'E', offset: 275, width: 90, type: 'paso' },
        { wall: 'S', offset: 60, width: 200, type: 'puerta' },
        { wall: 'W', offset: 250, width: 160, type: 'ventana' },
      ],
    },
    {
      id: 'terraza', name: 'Terraza', kind: 'terrace', color: '#b8673f',
      x: 0, z: 820, w: 268, d: 130,
      notes: 'Terraza del salón: 268 × 130 según el croquis (≈3,5 m²).',
      estimated: false,
      openings: [],
    },
    {
      id: 'bano', name: 'Baño', kind: 'room', color: '#9aa3a8',
      x: 670, z: 465, w: 190, d: 190,
      notes: 'Baño 1: 190 × 190 según el croquis (bañera, inodoro y bidé). Encima del tramo final del pasillo; la puerta está en el rincón donde acaba el pasillo.',
      estimated: false,
      openings: [{ wall: 'S', offset: 110, width: 70, type: 'puerta' }],
    },
    {
      id: 'bano2', name: 'Baño 2', kind: 'room', color: '#a7b1b6',
      x: 860, z: 620, w: 107, d: 145,
      notes: 'Baño 2: 107 × 145 según el croquis (145 a lo largo, 107 de fondo). Se entra por la pared del fondo del pasillo, al lado de la puerta del baño 1.',
      estimated: false,
      openings: [{ wall: 'W', offset: 45, width: 70, type: 'puerta' }],
    },
    {
      id: 'distribuidor', name: 'Pasillo', kind: 'room', color: '#c89b6a',
      x: 270, z: 655, w: 590, d: 100,
      notes: 'Pasillo que une el salón con el baño, el baño 2, el lavadero y el dormitorio. 4,60 m² en el proyecto.',
      estimated: true,
      openings: [],
    },
    {
      id: 'office', name: 'Office', kind: 'room', color: '#c9b9a0',
      x: 270, z: 755, w: 220, d: 350,
      notes: 'Office (en el proyecto: traster-safareig, 7,70 m²). Con un armario pequeño en la esquina.',
      estimated: true,
      openings: [
        { wall: 'N', offset: 120, width: 80, type: 'puerta' },
        { wall: 'S', offset: 50, width: 120, type: 'ventana' },
      ],
    },
    {
      id: 'armario-dorm', name: 'Armario dormitorio', kind: 'room', color: '#bfb3a0',
      x: 490, z: 755, w: 60, d: 230,
      notes: 'Armario empotrado del dormitorio: 60 de fondo (cota del croquis); el largo (230) es estimado.',
      estimated: true,
      openings: [{ wall: 'E', offset: 10, width: 210, type: 'paso' }],
    },
    {
      id: 'armario-office', name: 'Armario office', kind: 'room', color: '#bfb3a0',
      x: 490, z: 985, w: 60, d: 80,
      notes: 'Pequeño armario del office, en el extremo de la columna de armarios. Estimado.',
      estimated: true,
      openings: [{ wall: 'W', offset: 5, width: 70, type: 'paso' }],
    },
    {
      id: 'dormitorio', name: 'Dormitorio', kind: 'room', color: '#c08e5e',
      x: 550, z: 755, w: 310, d: 310,
      notes: 'Dormitorio 310 × 310 (confirmado). El proyecto indica 11,00 m² útiles, quizá contando el armario.',
      estimated: false,
      openings: [
        { wall: 'N', offset: 30, width: 80, type: 'puerta' },
        { wall: 'S', offset: 80, width: 150, type: 'ventana' },
      ],
    },
  ],
  items: [],
};
