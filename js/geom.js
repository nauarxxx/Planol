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

// Mobles amb forma (sofà o escriptori en L o en U): la planta no és un rectangle sencer sinó el cos principal més les ales.
// Cada peça és [x0, ample, z0, fons] en coordenades locals del moble (esquena a −z).
const WING_DEF = { sofa: { sd: 90, lw: 90 }, escritorio: { sd: 60, lw: 60 } };
export const hasWing = (shape) => shape === 'Le' || shape === 'Ld' || shape === 'U';
export function shapeRects(item) {
  const { w, d } = item, shape = item.shape || 'recte';
  if (!hasWing(shape)) return [[-w / 2, w, -d / 2, d]];
  const def = WING_DEF[item.type] || { sd: 90, lw: 90 };
  const sd = Math.min(d, Math.max(40, +item.sd || def.sd));
  const lw = Math.min(w / 2 - 2, Math.max(30, +item.lw || def.lw));
  const r = [[-w / 2, w, -d / 2, sd]];
  if (sd < d - 0.5) {
    if (shape === 'Le' || shape === 'U') r.push([-w / 2, lw, -d / 2 + sd, d - sd]);
    if (shape === 'Ld' || shape === 'U') r.push([w / 2 - lw, lw, -d / 2 + sd, d - sd]);
  }
  return r;
}
// Les peces d'un moble com a rectangles orientats del món ({x, z, w, d, rot}); un moble normal és una sola peça.
export function parts(it) {
  if (!hasWing(it.shape) || !WING_DEF[it.type]) return [it];
  const a = (it.rot || 0) * DEG, c = Math.cos(a), s = Math.sin(a);
  return shapeRects(it).map(([x0, w, z0, d]) => {
    const lx = x0 + w / 2, lz = z0 + d / 2;
    return { x: it.x + lx * c + lz * s, z: it.z - lx * s + lz * c, w, d, rot: it.rot || 0 };
  });
}

// Separating Axis Theorem entre dos rectángulos orientados. Devuelve true si se solapan.
// Si algun dels dos té forma (L, U), es comprova peça a peça: una tauleta dins de la U del sofà no hi xoca.
export function overlaps(a, b, pad = 0) {
  const pa = parts(a), pb = parts(b);
  if (pa.length > 1 || pb.length > 1 || pa[0] !== a || pb[0] !== b) return pa.some((x) => pb.some((y) => overlapsRect(x, y, pad)));
  return overlapsRect(a, b, pad);
}
function overlapsRect(a, b, pad = 0) {
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
    if (seg) out.push({ ...seg, type: op.type, roomId: r.id, door: op.door });
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

// Tipus de porta (op.door): 'batent' (normal, per defecte), 'doble' (dues fulles batents), 'llibre' (plegable, dues fulles que es
// pleguen com un llibre) i 'corredissa'. Les portes antigues amb swing 'none' eren corredisses amagades a la paret.
export const DOOR_KINDS = ['batent', 'corredissa', 'llibre', 'doble'];
export function doorKind(op) {
  if (DOOR_KINDS.includes(op.door)) return op.door;
  return op.swing === 'none' ? 'corredissa' : 'batent';
}
// Cap a on s'obre: 'in' (cap a dins de l'habitació) | 'out' | (corredisses) 'wall' = amagada dins de la paret.
export function doorFace(op) {
  if (op.swing === 'out') return 'out';
  if (doorKind(op) === 'corredissa' && (op.swing === 'wall' || op.swing === 'none')) return 'wall';
  return 'in';
}
// Marc d'una porta: el buit, la frontissa (op.hinge: 'a' = cantonada N/W, 'b' = l'altra), la direcció al llarg de la paret (wx, wz)
// cap al buit des de la frontissa i la d'obertura (ix, iz).
export function doorFrame(room, op) {
  if (op.type !== 'puerta') return null;
  const seg = openingSegment(room, op);
  if (!seg) return null;
  const hingeA = (op.hinge || 'a') === 'a';
  const inward = { N: [0, 1], S: [0, -1], W: [1, 0], E: [-1, 0] }[op.wall];
  const s = op.swing === 'out' ? -1 : 1;
  const ix = inward[0] * s, iz = inward[1] * s;
  let hx, hz, wx, wz;
  if (seg.axis === 'x') { hz = seg.line; hx = hingeA ? seg.a : seg.b; wx = hingeA ? 1 : -1; wz = 0; }
  else { hx = seg.line; hz = hingeA ? seg.a : seg.b; wz = hingeA ? 1 : -1; wx = 0; }
  return { seg, hx, hz, wx, wz, ix, iz, inx: inward[0], inz: inward[1], r: op.width, roomId: room.id };
}
const quarter = (f, hx, hz, wx, wz, r, role) => {
  const xs = [hx, hx + wx * r, hx + f.ix * r, hx + (wx + f.ix) * r], zs = [hz, hz + wz * r, hz + f.iz * r, hz + (wz + f.iz) * r];
  return { hx, hz, r, wx, wz, ix: f.ix, iz: f.iz, x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs), roomId: f.roomId, role };
};
// Caixa des de la frontissa: u al llarg de la paret (u0..u1), v cap a on s'obre (v0..v1).
const strip = (f, u0, u1, v0, v1, ix, iz, role) => {
  const xs = [], zs = [];
  for (const u of [u0, u1]) for (const v of [v0, v1]) { xs.push(f.hx + f.wx * u + ix * v); zs.push(f.hz + f.wz * u + iz * v); }
  return { box: true, x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs), roomId: f.roomId, role };
};
// Espai que escombra una porta en obrir-se (no s'hi pot posar res): quarts de cercle per a les fulles i caixes per a la resta.
export function doorSwings(room, op) {
  const f = doorFrame(room, op);
  if (!f) return [];
  const k = doorKind(op), w = f.r;
  if (k === 'batent') return [quarter(f, f.hx, f.hz, f.wx, f.wz, w, 'leaf')];
  if (k === 'doble') return [quarter(f, f.hx, f.hz, f.wx, f.wz, w / 2, 'leaf'), quarter(f, f.hx + f.wx * w, f.hz + f.wz * w, -f.wx, -f.wz, w / 2, 'leaf')];
  if (k === 'llibre') {
    // la primera fulla gira a la frontissa; la segona, plegada, no s'allunya més de 0,45 × fulla un cop passada la meitat
    const a = w / 2;
    return [quarter(f, f.hx, f.hz, f.wx, f.wz, a, 'fold'), strip(f, a, w, 0, a * 0.45, f.ix, f.iz, 'tail')];
  }
  // corredissa: llisca cap al costat de la frontissa, per la cara triada; amagada dins la paret no ocupa res
  const face = doorFace(op);
  if (face === 'wall') return [];
  const sx = face === 'out' ? -f.inx : f.inx, sz = face === 'out' ? -f.inz : f.inz;
  return [strip(f, -w, w, 0, 12, sx, sz, 'slide')];
}
// Compatibilitat: la primera zona d'una porta (la del batent, si n'hi ha).
export function doorSwing(room, op) { return doorSwings(room, op).find((s) => !s.box) || null; }
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
  for (const r of rooms) for (const op of r.openings || []) out.push(...doorSwings(r, op));
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

// Una caixa (AABB) toca el quart de cercle del batent (o la caixa d'una corredissa o d'una plegable)?
export function boxHitsSwing(box, sw) {
  if (box.x1 <= sw.x0 || box.x0 >= sw.x1 || box.z1 <= sw.z0 || box.z0 >= sw.z1) return false;
  if (sw.box) return true;
  const cx = Math.max(box.x0, Math.min(sw.hx, box.x1)), cz = Math.max(box.z0, Math.min(sw.hz, box.z1));
  return Math.hypot(cx - sw.hx, cz - sw.hz) < sw.r;
}

// Símbol de la porta en planta: línies [{ pts: [[x, z]…], closed }].
export function doorSymbols(room, op, n = 12) {
  const f = doorFrame(room, op);
  if (!f) return [];
  const k = doorKind(op), w = f.r, out = [];
  const pie = (sw) => out.push({ pts: [[sw.hx, sw.hz], ...swingArc(sw, n)], closed: true });
  const P = (u, v, ix = f.ix, iz = f.iz) => [f.hx + f.wx * u + ix * v, f.hz + f.wz * u + iz * v];
  if (k === 'batent' || k === 'doble') for (const sw of doorSwings(room, op)) pie(sw);
  else if (k === 'llibre') {
    const a = w / 2, c = Math.cos(Math.PI / 3), sn = Math.sin(Math.PI / 3);
    out.push({ pts: [P(0, 0), ...swingArc(quarter(f, f.hx, f.hz, f.wx, f.wz, a, 'fold'), n)], closed: false });
    out.push({ pts: [P(0, 0), P(a * c, a * sn), P(2 * a * c, 0)], closed: false }); // les dues fulles mig plegades
  } else {
    const face = doorFace(op);
    const sx = face === 'out' ? -f.inx : f.inx, sz = face === 'out' ? -f.inz : f.inz, v = face === 'wall' ? 0 : 7;
    out.push({ pts: [P(0, v, sx, sz), P(w, v, sx, sz)], closed: false }); // la fulla, tancada
    // fletxa cap a on llisca
    const y = face === 'wall' ? 0 : v + 6;
    out.push({ pts: [P(w * 0.75, y, sx, sz), P(-w * 0.15, y, sx, sz)], closed: false });
    out.push({ pts: [P(-w * 0.15 + 8, y + 5, sx, sz), P(-w * 0.15, y, sx, sz), P(-w * 0.15 + 8, y - 5, sx, sz)], closed: false });
  }
  return out;
}
export function allDoorSymbols(rooms, n = 12) {
  const out = [];
  for (const r of rooms) for (const op of r.openings || []) for (const sym of doorSymbols(r, op, n)) {
    const xs = sym.pts.map((p) => p[0]), zs = sym.pts.map((p) => p[1]);
    out.push({ ...sym, x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) });
  }
  return out;
}

// Una corredissa hi cap? El tros de paret per on llisca (al costat de la frontissa, tan llarg com la porta) ha de ser paret
// sencera per la cara triada: sense cap altre buit i amb una habitació a tocar en tot el tros (si no, toparia amb una cantonada).
export function slideFits(rooms, room, op) {
  const f = doorFrame(room, op);
  if (!f || doorKind(op) !== 'corredissa') return true;
  const { seg } = f, w = f.r;
  const lo = (op.hinge || 'a') === 'a' ? seg.a - w : seg.b, hi = lo + w;
  const face = doorFace(op);
  const dirs = face === 'wall' ? [1, -1] : [face === 'out' ? -1 : 1]; // amagada: n'hi ha prou que hi hagi paret
  for (const o of allOpenings(rooms)) if (o.axis === seg.axis && Math.abs(o.line - seg.line) <= 1 && o.b > lo + 1 && o.a < hi - 1) return false;
  const ok = (d) => {
    const n = seg.axis === 'x' ? { x: 0, z: f.inz * d } : { x: f.inx * d, z: 0 };
    const spans = [];
    for (const r of rooms) {
      if (r.kind && !['room', 'terrace'].includes(r.kind)) continue;
      const edge = seg.axis === 'x' ? (n.z > 0 ? r.z : r.z + r.d) : (n.x > 0 ? r.x : r.x + r.w);
      if (Math.abs(edge - seg.line) > 1) continue;
      spans.push(seg.axis === 'x' ? [r.x, r.x + r.w] : [r.z, r.z + r.d]);
    }
    spans.sort((p, q) => p[0] - q[0]);
    let at = lo;
    for (const [s0, s1] of spans) { if (s0 > at + 1) break; at = Math.max(at, s1); }
    return at >= hi - 1;
  };
  return face === 'wall' ? dirs.some(ok) : dirs.every(ok);
}
