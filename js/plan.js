// Plano por defecto. v2: a partir del plano de arquitectura ("Planol Arquitectura 2026-11-13.jpeg")
// y del croquis con cotas ("Planol 2026-11-13 at 15.47.12.jpeg").
// Todas las medidas en centímetros. X hacia la derecha, Z hacia abajo (vista en planta).
// Cada habitación es un rectángulo interior: x, z (esquina superior izquierda), w (ancho X), d (fondo Z).
// estimated: true indica que la medida no aparece en el plano y es una aproximación.
// openings: huecos en las paredes. wall: 'N' | 'S' | 'E' | 'W', offset desde la esquina N/W, width, type.

export const DEFAULT_PLAN = {
  version: 2, // v2: distribución según el plano de arquitectura (13/11/2026)
  ceiling: 250, // estimado: el plano no indica la altura del techo
  ceilingEstimated: true,
  wallThickness: 10,
  rooms: [
    {
      id: 'terraza-cocina', name: 'Terraza cocina', kind: 'terrace', color: '#b8673f',
      x: 0, z: 0, w: 270, d: 70,
      notes: 'Terraza alargada junto a la cocina. Medidas estimadas del plano de arquitectura.',
      estimated: true,
      openings: [],
    },
    {
      id: 'cocina', name: 'Cocina', kind: 'room', color: '#d9c7a3',
      x: 40, z: 70, w: 230, d: 220,
      notes: 'Cocina entre la terraza y el comedor. Encimera de 55 de fondo. Medidas estimadas.',
      estimated: true,
      openings: [
        { wall: 'N', offset: 60, width: 90, type: 'puerta' },
        { wall: 'S', offset: 40, width: 90, type: 'paso' },
      ],
    },
    {
      id: 'salon', name: 'Salón-comedor', kind: 'room', color: '#c89b6a',
      x: 0, z: 290, w: 270, d: 440,
      notes: 'Comedor junto a la cocina y zona de estar junto a la terraza. 440 × 270 (del croquis).',
      estimated: false,
      openings: [
        { wall: 'E', offset: 10, width: 85, type: 'puerta' },
        { wall: 'E', offset: 306, width: 90, type: 'paso' },
        { wall: 'S', offset: 35, width: 200, type: 'puerta' },
        { wall: 'W', offset: 250, width: 160, type: 'ventana' },
      ],
    },
    {
      id: 'terraza', name: 'Terraza', kind: 'terrace', color: '#b8673f',
      x: 0, z: 730, w: 268, d: 130,
      notes: 'Terraza del salón 268 × 130 (del croquis).',
      estimated: false,
      openings: [],
    },
    {
      id: 'ascensor', name: 'Ascensor', kind: 'void', color: '#555a60',
      x: 270, z: 370, w: 160, d: 226,
      notes: 'Hueco del ascensor (fuera de la vivienda). Lado de 226.',
      estimated: true,
      openings: [],
    },
    {
      id: 'bano', name: 'Baño', kind: 'room', color: '#9aa3a8',
      x: 430, z: 370, w: 280, d: 215,
      notes: 'Bañera, inodoro y bidé. Medidas estimadas del plano de arquitectura.',
      estimated: true,
      openings: [{ wall: 'S', offset: 140, width: 75, type: 'puerta' }],
    },
    {
      id: 'trastero', name: 'Armario / trastero', kind: 'room', color: '#bfb3a0',
      x: 710, z: 505, w: 145, d: 90,
      notes: 'Pequeño cuarto al final del pasillo. Medidas estimadas.',
      estimated: true,
      openings: [{ wall: 'S', offset: 35, width: 70, type: 'puerta' }],
    },
    {
      id: 'distribuidor', name: 'Pasillo', kind: 'room', color: '#c89b6a',
      x: 270, z: 596, w: 585, d: 100,
      notes: 'Pasillo que une el salón con el baño, el trastero y los dormitorios. Estimado.',
      estimated: true,
      openings: [],
    },
    {
      id: 'dormitorio2', name: 'Dormitorio 2', kind: 'room', color: '#c9a070',
      x: 270, z: 696, w: 215, d: 310,
      notes: 'Dormitorio pequeño junto a la terraza. Medidas estimadas.',
      estimated: true,
      openings: [
        { wall: 'N', offset: 120, width: 80, type: 'puerta' },
        { wall: 'S', offset: 50, width: 120, type: 'ventana' },
      ],
    },
    {
      id: 'armario-pasillo', name: 'Armario empotrado', kind: 'room', color: '#bfb3a0',
      x: 485, z: 696, w: 70, d: 310,
      notes: 'Columna de armarios entre los dos dormitorios. Estimado.',
      estimated: true,
      openings: [],
    },
    {
      id: 'dormitorio', name: 'Dormitorio principal', kind: 'room', color: '#c08e5e',
      x: 555, z: 696, w: 310, d: 310,
      notes: 'Dormitorio principal 310 × 310 (confirmado). Zona armario 205 / 60 / 112.',
      estimated: false,
      openings: [
        { wall: 'N', offset: 30, width: 80, type: 'puerta' },
        { wall: 'S', offset: 80, width: 150, type: 'ventana' },
      ],
    },
  ],
  items: [],
};
