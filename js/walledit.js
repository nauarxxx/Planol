// Editar la mida d'una paret (o d'un tros de paret) des del panell de la paret, i que la resta del pis s'hi adapti.
//
// Una paret és un costat d'una habitació (N, S, E, W). Els trossos són els segments entre portes, passos i finestres.
// - Canviar un tros: la paret sencera es manté; es mouen les obertures del costat triat i el tros sòlid següent
//   s'allarga o s'escurça. Si per aquell costat no hi ha cap més tros sòlid (s'arriba a la cantonada), l'habitació creix.
// - Canviar la paret sencera: l'habitació creix o s'encongeix pel costat triat.
// Quan l'habitació creix, el que hi ha més enllà es desplaça: les habitacions que hi toquen, les que van enganxades
// a aquestes, els pilars i les bigues de dins i els mobles. Les habitacions del costat alineades amb la paret que es
// mou (p. ex. el racó al costat del menjador) s'allarguen amb ella.
// side: +1 = cap a baix / la dreta (Z o X creixent), -1 = cap a dalt / l'esquerra. Mides en cm.

import { openingSegment, aabb, roomAt } from './geom.js?v=43';

const AXIS = { N: 'x', S: 'x', W: 'z', E: 'z' };
const OPP = { N: 'S', S: 'N', W: 'E', E: 'W' };
const isStruct = (q) => q.kind === 'pillar' || q.kind === 'beam';
const P = (u) => (u === 'x' ? ['x', 'w'] : ['z', 'd']);
const Q = (u) => (u === 'x' ? ['z', 'd'] : ['x', 'w']);
const spanU = (r, u) => { const [p, s] = P(u); return [r[p], r[p] + r[s]]; };
const spanV = (r, u) => { const [p, s] = Q(u); return [r[p], r[p] + r[s]]; };
const wallLen = (r, key) => (AXIS[key] === 'x' ? r.w : r.d);

export function edgeOf(r, key) {
  switch (key) {
    case 'N': return { axis: 'x', line: r.z, a: r.x, b: r.x + r.w };
    case 'S': return { axis: 'x', line: r.z + r.d, a: r.x, b: r.x + r.w };
    case 'W': return { axis: 'z', line: r.x, a: r.z, b: r.z + r.d };
    case 'E': return { axis: 'z', line: r.x + r.w, a: r.z, b: r.z + r.d };
  }
  return null;
}

// Trossos d'una paret, en ordre: sòlids i obertures (pròpies o d'una habitació veïna que hi dona).
export function wallSegments(rooms, r, key) {
  const e = edgeOf(r, key);
  const ops = [];
  for (const q of rooms) (q.openings || []).forEach((op, idx) => {
    const sg = openingSegment(q, op);
    if (!sg || sg.axis !== e.axis || Math.abs(sg.line - e.line) > 1) return;
    const a = Math.max(e.a, sg.a), b = Math.min(e.b, sg.b);
    if (b - a <= 1) return;
    const wl = wallLen(q, op.wall);
    ops.push({ a, b, type: op.type, room: q, idx, own: q === r, full: op.offset <= 1 && op.offset + op.width >= wl - 1 });
  });
  ops.sort((x, y) => x.a - y.a);
  const segs = [];
  let p = e.a;
  for (const o of ops) {
    const last = segs[segs.length - 1];
    if (o.a < p - 0.5 && last && !last.solid) { last.b = Math.max(last.b, o.b); last.ops.push(o); p = Math.max(p, o.b); continue; }
    if (o.a > p + 0.5) segs.push({ a: p, b: o.a, solid: true });
    segs.push({ a: Math.max(o.a, p), b: o.b, solid: false, ops: [o] });
    p = o.b;
  }
  if (e.b > p + 0.5) segs.push({ a: p, b: e.b, solid: true });
  return segs;
}

function findSeg(segs, w) {
  let i = segs.findIndex((s) => Math.abs(s.a - w.a) <= 1.5 && Math.abs(s.b - w.b) <= 1.5);
  if (i < 0) { const m = (w.a + w.b) / 2; i = segs.findIndex((s) => s.a <= m && m <= s.b); }
  return i;
}

const TYPE_TXT = { puerta: 'porta', paso: 'pas', ventana: 'finestra', ventanal: 'finestral' };
function segName(s) {
  if (!s) return 'cantonada';
  if (s.solid) return 'tros de ' + Math.round(s.b - s.a);
  const o = s.ops[0];
  return o.full && !o.own ? o.room.name : TYPE_TXT[o.type] || 'buit';
}

// Què hi ha a cada costat del tros, per posar-ho als botons. Torna { '-1': {dir, what}, '1': {dir, what} }.
export function sideInfo(state, w, mode) {
  const u = AXIS[w.key];
  const dir = u === 'z' ? { '-1': '↑ Dalt', 1: '↓ Baix' } : { '-1': '← Esquerra', 1: '→ Dreta' };
  const out = {};
  if (mode === 'whole') {
    const e = edgeOf(w.room, w.key);
    for (const s of [-1, 1]) {
      const act = plan(state.rooms, w.room, u, s > 0 ? e.b : e.a, s, state.wallThickness || 10);
      const names = (k) => [...act].filter(([q, v]) => v === k && q !== w.room && !isStruct(q)).map(([q]) => q.name);
      const list = (v) => v.slice(0, 2).join(', ') + (v.length > 2 ? ` i ${v.length - 2} més` : '');
      const mv = names('shift'), st = names('stretch');
      out[s] = { dir: dir[s], what: [mv.length ? 'mou ' + list(mv) : '', st.length ? 'allarga ' + list(st) : ''].filter(Boolean).join(' · ') || 'no mou res més' };
    }
    return out;
  }
  const segs = wallSegments(state.rooms, w.room, w.key);
  const i = findSeg(segs, w);
  for (const s of [-1, 1]) out[s] = { dir: dir[s], what: segName(segs[i + s]) };
  return out;
}

// Costat per defecte: el que deixa la paret sencera igual (hi ha un tros sòlid per absorbir-ho) o, si no, el que mou menys coses.
export function defaultSide(state, w, mode) {
  if (mode === 'piece') {
    const segs = wallSegments(state.rooms, w.room, w.key);
    const i = findSeg(segs, w);
    const solidAt = (d) => { for (let j = i + d; j >= 0 && j < segs.length; j += d) if (segs[j].solid) return true; return false; };
    if (solidAt(1)) return 1;
    if (solidAt(-1)) return -1;
    // cap tros per absorbir-ho: el costat on es pot fer (p. ex. no cap al pas del passadís)
    const works = (d) => { const st2 = JSON.parse(JSON.stringify(state)), r2 = st2.rooms.find((q) => q.id === w.room.id); return !!r2 && editWall(st2, { ...w, room: r2 }, 'piece', Math.round(w.b - w.a) + 1, d).ok; };
    const ok1 = works(1), ok0 = works(-1);
    if (ok1 !== ok0) return ok1 ? 1 : -1;
  }
  const n = (side) => {
    const u = AXIS[w.key], e = edgeOf(w.room, w.key);
    const act = plan(state.rooms, w.room, u, side > 0 ? e.b : e.a, side, state.wallThickness || 10);
    return [...act.keys()].filter((q) => !isStruct(q)).length;
  };
  return n(-1) < n(1) ? -1 : 1;
}

// Decideix què es desplaça ('shift') i què s'allarga ('stretch') si l'habitació R creix pel tall c cap al costat s.
function plan(rooms, R, u, c, s, t) {
  const tol = t + 2;
  const old = new Map(rooms.map((q) => [q, { u: spanU(q, u), v: spanV(q, u) }]));
  const contains = (A, q) => q.x >= A.x - 1 && q.x + q.w <= A.x + A.w + 1 && q.z >= A.z - 1 && q.z + q.d <= A.z + A.d + 1;
  const inside = new Map(); // pilars i bigues que són dins d'una habitació: van amb ella
  for (const p of rooms) if (isStruct(p)) { const host = rooms.find((q) => q !== p && !isStruct(q) && q.kind !== 'terrace' && contains(q, p)); if (host) inside.set(p, host); }
  const beyond = (q) => (s > 0 ? old.get(q).u[0] >= c - 1 : old.get(q).u[1] <= c + 1);
  // una habitació que té el darrere enganxat a una que no es mou (p. ex. l'office darrere del passadís) no s'arrossega
  const anchored = (p) => {
    const op = old.get(p);
    return rooms.some((q2) => {
      if (q2 === p || q2 === R || isStruct(q2) || beyond(q2)) return false;
      const o2 = old.get(q2);
      const vOv = Math.min(op.v[1], o2.v[1]) - Math.max(op.v[0], o2.v[0]);
      return vOv > 1 && (s > 0 ? Math.abs(o2.u[1] - op.u[0]) <= tol : Math.abs(o2.u[0] - op.u[1]) <= tol);
    });
  };
  const act = new Map();
  const queue = [];
  const mark = (q, k) => { if (!act.has(q)) { act.set(q, k); queue.push(q); } };
  mark(R, 'stretch');
  while (queue.length) {
    const q = queue.shift(), oq = old.get(q), kind = act.get(q);
    for (const p of rooms) {
      if (p === q || act.has(p)) continue;
      const op = old.get(p);
      if (inside.get(p) === q) {
        if (kind === 'shift') mark(p, 'shift');
        else if (Math.abs(op.u[0] - oq.u[0]) <= 1 && Math.abs(op.u[1] - oq.u[1]) <= 1) mark(p, 'stretch'); // biga que cobreix tota l'habitació
        else if (s > 0 ? op.u[1] >= c - 1 : op.u[0] <= c + 1) mark(p, 'shift'); // enganxat a la paret que es mou
        continue;
      }
      if (inside.has(p)) continue; // ja anirà amb la seva habitació
      const uOv = Math.min(op.u[1], oq.u[1]) - Math.max(op.u[0], oq.u[0]);
      const vOv = Math.min(op.v[1], oq.v[1]) - Math.max(op.v[0], oq.v[0]);
      const face = s > 0 ? oq.u[1] : oq.u[0];
      const contact = vOv > 1 && (s > 0 ? op.u[0] >= face - 1 && op.u[0] - face <= tol : op.u[1] <= face + 1 && face - op.u[1] <= tol);
      if (contact) { mark(p, 'shift'); continue; }
      const side = uOv > 1 && vOv > -tol && vOv <= 1;
      if (!side) continue;
      if (beyond(p) && !anchored(p)) mark(p, 'shift');
      else if (kind === 'stretch' && (s > 0 ? Math.abs(op.u[1] - oq.u[1]) <= 1 && op.u[0] < c - 1 : Math.abs(op.u[0] - oq.u[0]) <= 1 && op.u[1] > c + 1)) mark(p, 'stretch');
    }
  }
  return act;
}

function push(state, R, u, c, s, delta) {
  const t = state.wallThickness || 10;
  const act = plan(state.rooms, R, u, c, s, t);
  const [pu] = P(u);
  // mobles: on són abans de moure res
  const homes = (state.items || []).map((it) => {
    const host = state.rooms.find((r) => r.id === it.roomId && !isStruct(r)) || roomAt(state.rooms, it.x, it.z);
    const bb = aabb(it);
    return { it, host, lo: u === 'x' ? bb.x0 : bb.z0, hi: u === 'x' ? bb.x1 : bb.z1 };
  });
  for (const [q, kind] of act) {
    if (kind === 'shift') { q[pu] += s * delta; continue; }
    for (const op of q.openings || []) {
      if (AXIS[op.wall] !== u) continue;
      const full = op.offset <= 1 && op.offset + op.width >= wallLen(q, op.wall) - 1;
      if (full) { op.width += delta; continue; }
      const sg = openingSegment(q, op);
      if (sg.a >= c - 0.5) op.offset += delta;
    }
    const [p, sz] = P(u);
    if (s < 0) q[p] -= delta;
    q[sz] += delta;
  }
  let items = 0;
  for (const h of homes) {
    const k = h.host && act.get(h.host);
    if (!k) continue;
    const cu = h.it[pu];
    const move = k === 'shift' || (s > 0 ? cu >= c || h.hi >= c - 5 : cu <= c || h.lo <= c + 5);
    if (move) { h.it[pu] += s * delta; items++; }
  }
  const names = (k) => [...act].filter(([q, v]) => v === k && q !== R && !isStruct(q)).map(([q]) => q.name);
  return { moved: names('shift'), stretched: names('stretch'), items };
}

function moveOpening(o, d) { o.room.openings[o.idx].offset += d; }
function growOpening(o, delta, side) { const op = o.room.openings[o.idx]; op.width += delta; if (side < 0) op.offset -= delta; }

// Comprova que en escurçar no es trepitja cap porta o finestra de les parets que corren al llarg.
function bandBlocked(rooms, R, key, lo, hi) {
  for (const k of [key, OPP[key]]) for (const sg of wallSegments(rooms, R, k)) {
    if (sg.solid) continue;
    if (Math.min(hi, sg.b) - Math.max(lo, sg.a) > 0.5 && sg.ops.some((o) => !o.full)) return true;
  }
  return false;
}

// Canvia la mida. mode 'piece' (el tros tocat) o 'whole' (la paret sencera).
// Torna { ok, msg, kind: 'keep'|'grow', total, absorbed, moved, stretched, items, sel: {a, b} }.
export function editWall(state, w, mode, newLen, side, opts = {}) {
  const R = w.room, key = w.key, u = AXIS[key];
  newLen = Math.round(+newLen);
  if (!Number.isFinite(newLen)) return { ok: false, msg: 'Escriu una mida en centímetres.' };
  const e = edgeOf(R, key);
  const segs = wallSegments(state.rooms, R, key);
  const finish = (res, sel) => ({ ok: true, ...res, total: Math.round(wallLen(R, key)), sel });

  if (mode === 'whole') {
    const delta = newLen - (e.b - e.a);
    if (Math.abs(delta) < 0.5) return { ok: false, same: true };
    if (newLen < 20) return { ok: false, msg: 'La paret ha de fer com a mínim 20 cm.' };
    const c = side > 0 ? e.b : e.a;
    if (delta < 0 && bandBlocked(state.rooms, R, key, side > 0 ? e.b + delta : e.a, side > 0 ? e.b : e.a - delta)) {
      return { ok: false, msg: 'A l’extrem que s’escurça hi ha una porta o una finestra. Prova l’altre costat o mou-la primer.' };
    }
    const res = push(state, R, u, c, side, delta);
    let { a, b } = w;
    if (side > 0 && Math.abs(b - e.b) <= 1) b += delta;
    if (side < 0 && Math.abs(a - e.a) <= 1) a -= delta;
    return finish({ kind: 'grow', ...res }, { a, b });
  }

  const i = findSeg(segs, w);
  if (i < 0) return { ok: false, msg: 'No trobo aquest tros de paret.' };
  const sg = segs[i];
  const len = sg.b - sg.a, delta = newLen - len;
  if (Math.abs(delta) < 0.5) return { ok: false, same: true };
  if (!sg.solid) {
    const o = sg.ops[0];
    if (o.full) {
      // el buit és tota la paret d'una altra habitació (p. ex. el racó): es canvia la paret d'aquella habitació
      const res = editWall(state, { room: o.room, key: o.room.openings[o.idx].wall, a: o.a, b: o.b }, 'whole', wallLen(o.room, o.room.openings[o.idx].wall) + delta, side);
      if (res.ok) res.total = Math.round(wallLen(R, key));
      if (res.ok) res.sel = side > 0 ? { a: sg.a, b: sg.b + delta } : { a: sg.a - delta, b: sg.b };
      return res;
    }
    if (newLen < 20) return { ok: false, msg: 'Una obertura ha de fer com a mínim 20 cm.' };
  } else if (newLen < 1) return { ok: false, msg: 'El tros ha de fer com a mínim 1 cm.' };
  const sel = side > 0 ? { a: sg.a, b: sg.b + delta } : { a: sg.a - delta, b: sg.b };

  // hi ha un tros sòlid per aquell costat? llavors la paret sencera no canvia
  const between = [];
  let j = i + side;
  while (j >= 0 && j < segs.length && !segs[j].solid) { between.push(segs[j]); j += side; }
  if (!opts.grow && j >= 0 && j < segs.length) {
    const abs = segs[j], left = abs.b - abs.a - delta;
    if (left < 0) return { ok: false, canGrow: true, growTotal: Math.round(e.b - e.a + delta), msg: `No hi cap: el tros del costat només fa ${Math.round(abs.b - abs.a)} cm. Si de debò fa ${newLen}, la paret sencera ha de ser més llarga.` };
    for (const s2 of between) for (const o of s2.ops) {
      if (o.full && !o.own) { // l'obertura és tota una habitació: es mou l'habitació sencera, amb el que té a dins
        const q = o.room, [pu] = P(u), d = side * delta;
        const inside = state.rooms.filter((p) => p !== q && isStruct(p) && p.x >= q.x - 1 && p.x + p.w <= q.x + q.w + 1 && p.z >= q.z - 1 && p.z + p.d <= q.z + q.d + 1);
        for (const it of state.items || []) if (it.roomId === q.id) it[pu] += d;
        for (const p of [q, ...inside]) p[pu] += d;
      } else moveOpening(o, side * delta);
    }
    if (!sg.solid) for (const o of sg.ops) growOpening(o, delta, side);
    return finish({ kind: 'keep', absorbed: Math.round(left), moved: [], stretched: [], items: 0 }, sel);
  }

  // no n'hi ha: s'arriba a la cantonada i l'habitació creix
  const c = side > 0 ? sg.b : sg.a;
  // però si entremig hi ha un pas cap a una habitació que no es mouria (p. ex. el passadís, lligat a la resta del pis),
  // el pas deixaria de quedar davant d'aquella habitació: no es fa i es diu per què
  if (!opts.grow) {
    const act = plan(state.rooms, R, u, c, side, state.wallThickness || 10);
    for (const s2 of between) for (const o of s2.ops) {
      const q = o.own
        ? state.rooms.find((r2) => r2 !== R && r2.kind === 'room' && (() => { const e2 = edgeOf(r2, OPP[key]); return Math.abs(e2.line - e.line) <= 1 && e2.b > o.a + 1 && e2.a < o.b - 1; })())
        : o.room;
      if (q && q !== R && !act.has(q)) {
        return { ok: false, msg: `Darrere hi ha ${o.own ? 'el pas a ' : ''}«${q.name}», que no es pot moure amb aquesta paret: el pas deixaria de quedar-hi davant. Canvia la mida pel costat de l’altra banda o la paret sencera.` };
      }
    }
  }
  if (delta < 0 && bandBlocked(state.rooms, R, OPP[key], side > 0 ? c + delta : c, side > 0 ? c : c - delta)) {
    return { ok: false, msg: 'A la paret del davant, a la mateixa alçada, hi ha una porta o una finestra. Prova l’altre costat.' };
  }
  const res = push(state, R, u, c, side, delta);
  if (!sg.solid) for (const o of sg.ops) growOpening(o, delta, side);
  return finish({ kind: 'grow', ...res }, sel);
}
