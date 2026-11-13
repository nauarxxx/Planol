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
  version: 3, // v3: medidas ajustadas a las superficies del proyecto
  ceiling: 250, // estimado: el plano no indica la altura del techo
  ceilingEstimated: true,
  wallThickness: 10,
  rooms: [
    {
      id: 'terraza-cocina', name: 'Terraza cocina', kind: 'terrace', color: '#b8673f',
      x: 100, z: 0, w: 335, d: 90,
      notes: 'Terraza alargada sobre la cocina (≈3 m²). Las dos terrazas suman 8,25 m² en el proyecto.',
      estimated: true,
      openings: [],
    },
    {
      id: 'cocina', name: 'Cocina', kind: 'room', color: '#d9c7a3',
      x: 100, z: 90, w: 260, d: 290,
      notes: 'Zona de cocina abierta al comedor (estar-menjador-cuina: 26,80 m² en total). Encimera de 55 de fondo.',
      estimated: true,
      openings: [
        { wall: 'N', offset: 60, width: 90, type: 'puerta' },
        { wall: 'S', offset: 20, width: 220, type: 'paso' },
      ],
    },
    {
      id: 'salon', name: 'Salón-comedor', kind: 'room', color: '#c89b6a',
      x: 0, z: 380, w: 360, d: 535,
      notes: 'Comedor junto a la cocina y zona de estar junto a la terraza. Con la cocina suma 26,80 m². Entrada desde el rellano.',
      estimated: true,
      openings: [
        { wall: 'E', offset: 15, width: 85, type: 'puerta' },
        { wall: 'E', offset: 275, width: 90, type: 'paso' },
        { wall: 'S', offset: 60, width: 200, type: 'puerta' },
        { wall: 'W', offset: 300, width: 160, type: 'ventana' },
      ],
    },
    {
      id: 'terraza', name: 'Terraza', kind: 'terrace', color: '#b8673f',
      x: 0, z: 915, w: 360, d: 145,
      notes: 'Terraza del salón (≈5,2 m²). En el croquis: 268 × 130.',
      estimated: true,
      openings: [],
    },
    {
      id: 'ascensor', name: 'Ascensor', kind: 'void', color: '#555a60',
      x: 360, z: 475, w: 160, d: 226,
      notes: 'Hueco del ascensor (fuera de la vivienda). Lado de 226.',
      estimated: true,
      openings: [],
    },
    {
      id: 'bano', name: 'Baño', kind: 'room', color: '#9aa3a8',
      x: 520, z: 475, w: 280, d: 180,
      notes: 'Bañera, inodoro y bidé. 5,00 m² en el proyecto.',
      estimated: true,
      openings: [{ wall: 'S', offset: 150, width: 75, type: 'puerta' }],
    },
    {
      id: 'trastero', name: 'Trastero', kind: 'room', color: '#bfb3a0',
      x: 800, z: 510, w: 145, d: 145,
      notes: 'Trastero pequeño al final del pasillo. 2,10 m² en el proyecto.',
      estimated: true,
      openings: [{ wall: 'S', offset: 20, width: 70, type: 'puerta' }],
    },
    {
      id: 'distribuidor', name: 'Pasillo', kind: 'room', color: '#c89b6a',
      x: 360, z: 655, w: 540, d: 100,
      notes: 'Pasillo que une el salón con el baño, el trastero, el lavadero y el dormitorio. 4,60 m² en el proyecto.',
      estimated: true,
      openings: [],
    },
    {
      id: 'safareig', name: 'Lavadero / trastero', kind: 'room', color: '#c9b9a0',
      x: 360, z: 755, w: 220, d: 350,
      notes: 'Traster-safareig: 7,70 m² en el proyecto. Puede usarse como habitación pequeña.',
      estimated: true,
      openings: [
        { wall: 'N', offset: 120, width: 80, type: 'puerta' },
        { wall: 'S', offset: 50, width: 120, type: 'ventana' },
      ],
    },
    {
      id: 'armario-pasillo', name: 'Armario empotrado', kind: 'room', color: '#bfb3a0',
      x: 580, z: 755, w: 60, d: 310,
      notes: 'Armario entre el lavadero y el dormitorio. Estimado.',
      estimated: true,
      openings: [],
    },
    {
      id: 'dormitorio', name: 'Dormitorio', kind: 'room', color: '#c08e5e',
      x: 640, z: 755, w: 310, d: 310,
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
