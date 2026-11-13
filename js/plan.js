// Plano por defecto, a partir de la imagen "Planol 2026-11-13".
// Todas las medidas en centímetros. X hacia la derecha, Z hacia abajo (vista en planta).
// Cada habitación es un rectángulo interior: x, z (esquina superior izquierda), w (ancho X), d (fondo Z).
// estimated: true indica que la medida no aparece en el plano y es una aproximación.
// openings: huecos en las paredes. wall: 'N' | 'S' | 'E' | 'W', offset desde la esquina N/W, width, type.

export const DEFAULT_PLAN = {
  version: 1,
  ceiling: 250, // estimado: el plano no indica la altura del techo
  ceilingEstimated: true,
  wallThickness: 10,
  rooms: [
    {
      id: 'salon', name: 'Salón-comedor', kind: 'room', color: '#c89b6a',
      x: 0, z: 300, w: 440, d: 270,
      notes: 'Pared exterior 440, fondo 270, pared de la TV 2,75 m',
      estimated: false,
      openings: [
        { wall: 'E', offset: 60, width: 140, type: 'puerta' },
        { wall: 'S', offset: 150, width: 160, type: 'ventana' },
        { wall: 'N', offset: 195, width: 60, type: 'paso' },
        { wall: 'W', offset: 90, width: 90, type: 'paso' },
      ],
    },
    {
      id: 'terraza', name: 'Terraza', kind: 'terrace', color: '#b8673f',
      x: 440, z: 300, w: 130, d: 268,
      notes: 'Terraza 268 × 130',
      estimated: false,
      openings: [],
    },
    {
      id: 'cocina', name: 'Cocina', kind: 'room', color: '#d9c7a3',
      x: -250, z: 300, w: 250, d: 270,
      notes: 'Encimera de 55 de fondo. Largo y ancho ESTIMADOS: revisar.',
      estimated: true,
      openings: [{ wall: 'W', offset: 80, width: 110, type: 'puerta' }],
    },
    {
      id: 'terraza-cocina', name: 'Terraza cocina', kind: 'terrace', color: '#b8673f',
      x: -380, z: 300, w: 130, d: 270,
      notes: 'Medidas estimadas',
      estimated: true,
      openings: [],
    },
    {
      id: 'bano', name: 'Baño', kind: 'room', color: '#9aa3a8',
      x: 0, z: 50, w: 190, d: 250,
      notes: 'Frente 190 + 140, fondo 145, escalón 107',
      estimated: true,
      openings: [],
    },
    {
      id: 'distribuidor', name: 'Distribuidor', kind: 'room', color: '#c89b6a',
      x: 190, z: 50, w: 70, d: 250,
      notes: 'Pasillo de acceso al baño y al dormitorio (estimado)',
      estimated: true,
      openings: [
        { wall: 'W', offset: 150, width: 75, type: 'puerta' },
        { wall: 'E', offset: 150, width: 80, type: 'puerta' },
      ],
    },
    {
      id: 'dormitorio', name: 'Dormitorio', kind: 'room', color: '#c08e5e',
      x: 260, z: -10, w: 310, d: 310,
      notes: 'Dormitorio principal 310 × 310 (confirmado). Zona armario 205 / 60 / 112.',
      estimated: false,
      openings: [{ wall: 'N', offset: 110, width: 150, type: 'ventana' }],
    },
    {
      id: 'ascensor', name: 'Ascensor', kind: 'void', color: '#555a60',
      x: -140, z: 74, w: 140, d: 226,
      notes: 'Hueco del ascensor (fuera de la vivienda). Lado de 226.',
      estimated: true,
      openings: [],
    },
  ],
  items: [],
};
