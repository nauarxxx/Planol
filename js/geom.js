// Utilidades geométricas 2D en planta (X, Z), en cm.

export const DEG = Math.PI / 180;

export function corners(it, pad = 0) {
  const a = (it.rot || 0) * DEG;
  const c = Math.cos(a), s = Math.sin(a);
  const hw = it.w / 2 + pad, hd = it.d / 2 + pad;
  // rotación de three.js alrededor de Y: local (lx, lz) -> world (lx*c + lz*s, -lx*s + lz*c)
  return [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([lx, lz]) => [it.x + lx * c + lz * s, it.z - lx * s + lz * c]);
}

export function aabb(it, pad = 0) {
  const cs = corners(it, pad);
  const xs = cs.map((p) => p[0]), zs = cs.map((p) => p[1]);
  return { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) };
}

function project(cs, ax) {
  let mn = Infinity, mx = -Infinity;
  for (const p of cs) {
    const v = p[0] * ax[0] + p[1] * ax[1];
    if (v < mn) mn = v;
    if (v > mx) mx = v;
  }
  return [mn, mx];
}

// Separating Axis Theorem entre dos rectángulos orientados. Devuelve true si se solapan.
export function overlaps(a, b, pad = 0) {
  // Descarte ràpid: si les caixes envolvents no es toquen, no cal el SAT.
  const ra = (Math.hypot(a.w, a.d) / 2 + pad), rb = (Math.hypot(b.w, b.d) / 2 + pad);
  if (Math.abs(a.x - b.x) > ra + rb || Math.abs(a.z - b.z) > ra + rb) return false;
  const ca = corners(a, pad), cb = corners(b, pad);
  for (const cs of [ca, cb]) {
    for (let i = 0; i < 2; i++) {
      const p = cs[i], q = cs[i + 1];
      const ax = [q[1] - p[1], p[0] - q[0]];
      const [a0, a1] = project(ca, ax), [b0, b1] = project(cb, ax);
      if (a1 <= b0 + 0.01 || b1 <= a0 + 0.01) return false;
    }
  }
  return true;
}

export function rectOverlapArea(r, s) {
  const w = Math.min(r.x1, s.x1) - Math.max(r.x0, s.x0);
  const d = Math.min(r.z1, s.z1) - Math.max(r.z0, s.z0);
  return w > 0 && d > 0 ? w * d : 0;
}

export function rectGap(r, s) {
  const dx = Math.max(0, Math.max(r.x0, s.x0) - Math.min(r.x1, s.x1));
  const dz = Math.max(0, Math.max(r.z0, s.z0) - Math.min(r.z1, s.z1));
  return Math.hypot(dx, dz);
}

// Rectángulo interior útil de una habitación (descontando media pared).
export function innerRect(room, t) {
  const h = t / 2;
  return { x0: room.x + h, x1: room.x + room.w - h, z0: room.z + h, z1: room.z + room.d - h };
}

export function outsideAmount(r, box) {
  return Math.max(0, r.x0 - box.x0) + Math.max(0, box.x1 - r.x1) + Math.max(0, r.z0 - box.z0) + Math.max(0, box.z1 - r.z1);
}

export function roomAt(rooms, x, z) {
  // La habitación más pequeña que contiene el punto (por si se solapan).
  let best = null;
  for (const r of rooms) {
    if (r.kind === 'void' || r.kind === 'pillar' || r.kind === 'beam') continue;
    if (x >= r.x && x <= r.x + r.w && z >= r.z && z <= r.z + r.d) {
      if (!best || r.w * r.d < best.w * best.d) best = r;
    }
  }
  return best;
}

// Segmento de pared en coordenadas de mundo para un hueco de una habitación.
export function openingSegment(room, op) {
  switch (op.wall) {
    case 'N': return { axis: 'x', line: room.z, a: room.x + op.offset, b: room.x + op.offset + op.width };
    case 'S': return { axis: 'x', line: room.z + room.d, a: room.x + op.offset, b: room.x + op.offset + op.width };
    case 'W': return { axis: 'z', line: room.x, a: room.z + op.offset, b: room.z + op.offset + op.width };
    case 'E': return { axis: 'z', line: room.x + room.w, a: room.z + op.offset, b: room.z + op.offset + op.width };
  }
  return null;
}

export function allOpenings(rooms) {
  const out = [];
  for (const r of rooms) for (const op of r.openings || []) {
    const seg = openingSegment(r, op);
    if (seg) out.push({ ...seg, type: op.type, roomId: r.id });
  }
  return out;
}

// Huecos que caen sobre los bordes de una habitación (suyos o de habitaciones vecinas).
export function openingsOnRoom(room, openings) {
  const edges = [
    { wall: 'N', axis: 'x', line: room.z, a: room.x, b: room.x + room.w },
    { wall: 'S', axis: 'x', line: room.z + room.d, a: room.x, b: room.x + room.w },
    { wall: 'W', axis: 'z', line: room.x, a: room.z, b: room.z + room.d },
    { wall: 'E', axis: 'z', line: room.x + room.w, a: room.z, b: room.z + room.d },
  ];
  const res = [];
  for (const e of edges) for (const o of openings) {
    if (o.axis !== e.axis || Math.abs(o.line - e.line) > 1) continue;
    const a = Math.max(e.a, o.a), b = Math.min(e.b, o.b);
    if (b - a > 1) res.push({ wall: e.wall, axis: e.axis, line: e.line, a, b, type: o.type });
  }
  return res;
}

// Batent d'una porta: quart de cercle que escombra la fulla en obrir-se.
// op.swing: 'in' (cap a dins de l'habitació, per defecte) | 'out' | 'none'. op.hinge: 'a' (cantonada N/W) | 'b'.
// Torna la frontissa (hx, hz), el radi, la direcció al llarg de la paret (wx, wz), la d'obertura (ix, iz) i la caixa.
export function doorSwing(room, op) {
  if (op.type !== 'puerta' || op.swing === 'none') return null;
  const seg = openingSegment(room, op);
  if (!seg) return null;
  const r = op.width;
  const hingeA = (op.hinge || 'a') === 'a';
  const inward = { N: [0, 1], S: [0, -1], W: [1, 0], E: [-1, 0] }[op.wall];
  const s = op.swing === 'out' ? -1 : 1;
  const ix = inward[0] * s, iz = inward[1] * s;
  let hx, hz, wx, wz;
  if (seg.axis === 'x') { hz = seg.line; hx = hingeA ? seg.a : seg.b; wx = hingeA ? 1 : -1; wz = 0; }
  else { hx = seg.line; hz = hingeA ? seg.a : seg.b; wz = hingeA ? 1 : -1; wx = 0; }
  const xs = [hx, hx + wx * r, hx + ix * r, hx + (wx + ix) * r], zs = [hz, hz + wz * r, hz + iz * r, hz + (wz + iz) * r];
  return { hx, hz, r, wx, wz, ix, iz, x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs), roomId: room.id };
}

// Pilars i bigues com a pseudo-mobles (per comprovar xocs i buscar lloc lliure). Les bigues porten h0 (alçada de sota).
export function structItems(rooms) {
  const out = [];
  for (const r of rooms) {
    if (r.kind !== 'pillar' && r.kind !== 'beam') continue;
    const cx = r.x + r.w / 2, cz = r.z + r.d / 2;
    const host = roomAt(rooms, cx, cz);
    out.push({ id: 'struct:' + r.id, name: r.name, type: r.kind, kind: r.kind, x: cx, z: cz, w: r.w, d: r.d, rot: 0, h: r.kind === 'beam' ? 9999 : 9999, elev: r.kind === 'beam' ? (r.h0 || 210) : 0, roomId: host ? host.id : null, h0: r.h0 || 210, x0: r.x, x1: r.x + r.w, z0: r.z, z1: r.z + r.d });
  }
  return out;
}

export function allSwings(rooms) {
  const out = [];
  for (const r of rooms) for (const op of r.openings || []) { const s = doorSwing(r, op); if (s) out.push(s); }
  return out;
}

// Punts del batent (per dibuixar-lo): arc de la frontissa.
export function swingArc(sw, n = 12) {
  const pts = [];
  for (let k = 0; k <= n; k++) {
    const th = (k / n) * Math.PI / 2;
    pts.push([sw.hx + sw.r * (sw.wx * Math.cos(th) + sw.ix * Math.sin(th)), sw.hz + sw.r * (sw.wz * Math.cos(th) + sw.iz * Math.sin(th))]);
  }
  return pts;
}

// Una caixa (AABB) toca el quart de cercle del batent?
export function boxHitsSwing(box, sw) {
  if (box.x1 <= sw.x0 || box.x0 >= sw.x1 || box.z1 <= sw.z0 || box.z0 >= sw.z1) return false;
  const cx = Math.max(box.x0, Math.min(sw.hx, box.x1)), cz = Math.max(box.z0, Math.min(sw.hz, box.z1));
  return Math.hypot(cx - sw.hx, cz - sw.hz) < sw.r;
}
