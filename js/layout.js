// Generador de distribuciones automáticas.
// Crea muchas distribuciones aleatorias guiadas por reglas (TV en pared, sofá frente a la TV,
// sillas alrededor de la mesa, cama con cabecero en la pared...), las puntúa y devuelve
// las mejores que sean distintas entre sí.

import { CATALOG } from './furniture.js?v=40';
import { evalGoals } from './goals.js?v=40';
import { aabb, overlaps, rectOverlapArea, rectGap, innerRect, outsideAmount, allOpenings, openingsOnRoom, allSwings, structItems, DEG } from './geom.js?v=40';

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const roleOf = (it) => (CATALOG[it.type] || CATALOG.caja).role;
const ORDER = ['bed', 'wall', 'tv', 'sofa', 'table', 'desk', 'armchair', 'coffee', 'seat', 'nightstand', 'corner', 'rug'];

// Rotación (grados) para que el frente mire hacia dentro desde cada pared.
const WALL_ROT = { N: 0, E: 270, S: 180, W: 90 };

function footprint(it, rot) {
  return rot % 180 === 0 ? { fw: it.w, fd: it.d } : { fw: it.d, fd: it.w };
}

function clampInside(p, it, R) {
  const { fw, fd } = footprint(it, ((Math.round(p.rot / 90) * 90) % 360 + 360) % 360);
  p.x = Math.min(Math.max(p.x, R.x0 + fw / 2), R.x1 - fw / 2);
  p.z = Math.min(Math.max(p.z, R.z0 + fd / 2), R.z1 - fd / 2);
  return p;
}

function onWall(it, wall, t, R) {
  const rot = WALL_ROT[wall];
  const { fw, fd } = footprint(it, rot);
  const lerp = (a, b) => a + (b - a) * t;
  switch (wall) {
    case 'N': return { x: lerp(R.x0 + fw / 2, R.x1 - fw / 2), z: R.z0 + fd / 2, rot };
    case 'S': return { x: lerp(R.x0 + fw / 2, R.x1 - fw / 2), z: R.z1 - fd / 2, rot };
    case 'W': return { x: R.x0 + fw / 2, z: lerp(R.z0 + fd / 2, R.z1 - fd / 2), rot };
    case 'E': return { x: R.x1 - fw / 2, z: lerp(R.z0 + fd / 2, R.z1 - fd / 2), rot };
  }
}

const WALLS = ['N', 'E', 'S', 'W'];

function faceTowards(from, to) {
  const a = Math.atan2(to.x - from.x, to.z - from.z) / DEG;
  return ((Math.round(a / 90) * 90) % 360 + 360) % 360;
}

function front(rot) {
  return { x: Math.sin(rot * DEG), z: Math.cos(rot * DEG) };
}

// Versió síncrona (bloqueja la pantalla uns instants).
export function generateLayouts(room, roomItems, allRooms, opts = {}) {
  const g = layoutGenerator(room, roomItems, allRooms, opts);
  let r = g.next();
  while (!r.done) r = g.next();
  return r.value;
}

// Versió asíncrona: treballa a trossos de ~12 ms perquè la pantalla no es congeli i avisa del progrés.
export function generateLayoutsAsync(room, roomItems, allRooms, opts = {}, onProgress = null) {
  return new Promise((resolve) => {
    const g = layoutGenerator(room, roomItems, allRooms, opts);
    const step = () => {
      const t0 = performance.now();
      let r = g.next();
      while (!r.done && performance.now() - t0 < 12) r = g.next();
      if (r.done) return resolve(r.value);
      onProgress?.(r.value);
      setTimeout(step, 0);
    };
    step();
  });
}

function* layoutGenerator(room, roomItems, allRooms, opts = {}) {
  const t = opts.wallThickness ?? 10;
  const count = opts.count ?? 4;
  const tries = opts.tries ?? 2000;
  const rand = mulberry32(opts.seed ?? Date.now());
  CLEAR = opts.clear ?? 60; GAPMIN = opts.gapMin ?? 65;
  const R = innerRect(room, t);
  const doors = openingsOnRoom(room, allOpenings(allRooms));

  // Zonas de paso delante de puertas (no se pueden ocupar) y delante de ventanas (solo muebles altos).
  const keepouts = doors.map((o) => {
    const isWin = o.type === 'ventana' || o.type === 'ventanal';
    const depth = isWin ? 30 : 60;
    let r;
    if (o.wall === 'N') r = { x0: o.a, x1: o.b, z0: R.z0, z1: R.z0 + depth };
    if (o.wall === 'S') r = { x0: o.a, x1: o.b, z0: R.z1 - depth, z1: R.z1 };
    if (o.wall === 'W') r = { x0: R.x0, x1: R.x0 + depth, z0: o.a, z1: o.b };
    if (o.wall === 'E') r = { x0: R.x1 - depth, x1: R.x1, z0: o.a, z1: o.b };
    return { ...r, window: isWin, wall: o.wall };
  });
  // Batents de les portes que cauen dins de l'habitació: tampoc s'hi pot posar res.
  for (const sw of allSwings(allRooms)) {
    const k = { x0: Math.max(sw.x0, R.x0), x1: Math.min(sw.x1, R.x1), z0: Math.max(sw.z0, R.z0), z1: Math.min(sw.z1, R.z1) };
    if (k.x1 - k.x0 > 5 && k.z1 - k.z0 > 5) keepouts.push({ ...k, window: false, wall: null, swing: true });
  }
  // Pilars: no s'hi pot posar res. Bigues: només hi caben mobles més baixos que la biga.
  for (const st of structItems(allRooms)) {
    const k = { x0: Math.max(st.x0, R.x0), x1: Math.min(st.x1, R.x1), z0: Math.max(st.z0, R.z0), z1: Math.min(st.z1, R.z1) };
    if (k.x1 - k.x0 <= 1 || k.z1 - k.z0 <= 1) continue;
    if (st.kind === 'pillar') keepouts.push({ ...k, window: false, wall: null, solid: true });
    else keepouts.push({ ...k, window: false, wall: null, beam: st.h0 });
  }
  const doorWalls = new Set(keepouts.filter((k) => !k.window && !k.solid && k.beam === undefined).map((k) => k.wall));

  const locked = roomItems.filter((i) => i.locked);
  const free = roomItems.filter((i) => !i.locked);
  free.sort((a, b) => ORDER.indexOf(roleOf(a)) - ORDER.indexOf(roleOf(b)) || b.w * b.d - a.w * a.d);

  const candidates = [];
  const goals = opts.goals || [];
  const placedItems = (pl) => [...locked, ...free.map((i) => ({ ...i, ...pl.placements[i.id] }))];
  for (let n = 0; n < tries; n++) {
    const pl = buildCandidate(free, locked, R, rand, doorWalls, keepouts);
    let score = scoreLayout(pl, free, locked, R, keepouts);
    if (goals.length) score += evalGoals(placedItems(pl), room, allRooms, goals, t).penalty; // objectius triats
    candidates.push({ pl, score });
    if (n % 25 === 24) yield n / tries;
  }
  candidates.sort((a, b) => a.score - b.score);

  // Elegir las mejores que sean distintas entre sí.
  const chosen = [];
  for (const c of candidates) {
    if (chosen.length >= count) break;
    if (chosen.every((o) => difference(o.pl, c.pl, free) > 35)) chosen.push(c);
  }
  chosen.forEach((c) => { c.debug = {}; scoreLayout(c.pl, free, locked, R, keepouts, c.debug); });
  return chosen.map((c, i) => ({
    goals: goals.length ? evalGoals(placedItems(c.pl), room, allRooms, goals, t).report : [],
    debug: c.debug,
    score: c.score,
    rating: rate(c.score, c.debug),
    placements: c.pl.placements,
    name: `Proposta ${i + 1}`,
  }));
}

function rate(score, dbg) {
  const sum = (pre, min = 0) => Object.entries(dbg).filter(([k, v]) => k.startsWith(pre) && v > min).length;
  if (sum('choque:') || sum('fuera:', 5)) return 'Hi ha xocs: no hi cap tot';
  if (sum('puerta:')) return 'Bona, però alguna cosa frega una porta o finestra';
  if (sum('accés:')) return 'Bona, però a algun moble no s’hi arriba bé';
  if (score < 250) return 'Molt bona';
  return 'Bona';
}

function difference(a, b, items) {
  if (!items.length) return 0;
  let s = 0;
  for (const it of items) {
    const p = a.placements[it.id], q = b.placements[it.id];
    s += Math.hypot(p.x - q.x, p.z - q.z) + (p.rot !== q.rot ? 25 : 0);
  }
  return s / items.length;
}

function buildCandidate(free, locked, R, rand, doorWalls, keepouts) {
  // Posición en una pared que no tape puertas (ni ventanas si el mueble es alto).
  const blocks = (it, p) => {
    const b = aabb({ ...it, ...p });
    return keepouts.some((k) => (!k.window || it.h + (it.elev || 0) >= 110) && (k.beam === undefined || it.h + (it.elev || 0) > k.beam) && rectOverlapArea(b, k) > 0);
  };
  const collides = (it, p) => {
    const c = { ...it, ...p };
    return [...locked, ...free.filter((o) => placements[o.id]).map((o) => ({ ...o, ...placements[o.id] }))]
      .some((o) => o.id !== it.id && roleOf(o) !== 'rug' && overlaps(c, o));
  };
  const wallSpot = (it, wall, Z, t0) => {
    let first = null;
    for (let k = 0; k < 10; k++) {
      const p = onWall(it, wall, k === 0 && t0 !== undefined ? t0 : rand(), Z);
      if (!first) first = p;
      if (!blocks(it, p) && !collides(it, p)) return p;
    }
    return first;
  };
  const placements = {};
  const extra = { pairs: new Set(), tvId: null, sofaId: null, onTop: new Set() };
  const put = (it, p) => { placements[it.id] = clampInside({ ...p }, it, zone(it)); };
  const placed = (role) => free.filter((i) => roleOf(i) === role && placements[i.id]);
  const pickWall = (avoidDoors = true) => {
    const opts = avoidDoors ? WALLS.filter((w) => !doorWalls.has(w) || rand() < 0.6) : WALLS;
    const list = opts.length ? opts : WALLS;
    return list[Math.floor(rand() * list.length)];
  };
  const lockedTv = locked.find((i) => roleOf(i) === 'tv');

  // Agrupar mesas (si hay varias, a veces se juntan formando una mesa grande).
  const tables = free.filter((i) => roleOf(i) === 'table');
  const joinTables = tables.length > 1 && rand() < 0.5;

  // Zonas: si hay zona de estar (TV/sofá) y comedor (mesa), se reparte la habitación a lo largo.
  const hasLounge = free.some((i) => ['tv', 'sofa'].includes(roleOf(i)));
  const hasDining = free.some((i) => roleOf(i) === 'table');
  const isLounge = (it) => ['tv', 'sofa', 'armchair', 'coffee'].includes(roleOf(it)) || it.type === 'muebleTv' || (roleOf(it) === 'rug' && hasLounge);
  const isDining = (it) => roleOf(it) === 'table';
  let ZL = R, ZD = R;
  if (hasLounge && hasDining && rand() < 0.85) {
    const W = R.x1 - R.x0, D = R.z1 - R.z0;
    const ratio = 0.45 + rand() * 0.17;
    const first = rand() < 0.5;
    if (W >= D) {
      const sx = first ? R.x0 + W * ratio : R.x1 - W * ratio;
      ZL = first ? { ...R, x1: sx } : { ...R, x0: sx };
      ZD = first ? { ...R, x0: sx } : { ...R, x1: sx };
    } else {
      const sz = first ? R.z0 + D * ratio : R.z1 - D * ratio;
      ZL = first ? { ...R, z1: sz } : { ...R, z0: sz };
      ZD = first ? { ...R, z0: sz } : { ...R, z1: sz };
    }
  }
  const zone = (it) => (isLounge(it) ? ZL : isDining(it) ? ZD : R);

  for (const it of free) {
    const role = roleOf(it);
    const R = zone(it);
    const cx = (R.x0 + R.x1) / 2, cz = (R.z0 + R.z1) / 2;
    switch (role) {
      case 'bed':
      case 'desk':
      case 'wall': {
        put(it, wallSpot(it, pickWall(), R));
        break;
      }
      case 'tv': {
        const stand = free.find((i) => i.type === 'muebleTv' && placements[i.id] && !extra.onTop.has(i.id));
        if (stand && rand() < 0.85) {
          const p = placements[stand.id];
          extra.onTop.add(stand.id);
          extra.pairs.add(it.id + '|' + stand.id);
          const f = front(p.rot);
          const back = stand.d / 2 - it.d / 2 - 2;
          put(it, { x: p.x - f.x * back, z: p.z - f.z * back, rot: p.rot, elev: stand.h });
        } else {
          put(it, wallSpot(it, pickWall(), R, 0.2 + rand() * 0.6));
        }
        extra.tvId = extra.tvId || it.id;
        break;
      }
      case 'sofa': {
        const tvIt = extra.tvId ? free.find((i) => i.id === extra.tvId) : lockedTv;
        const tv = tvIt ? (placements[tvIt.id] || tvIt) : null;
        if (tv && !extra.sofaId) {
          const f = front(tv.rot);
          if (rand() < 0.55) {
            // Contra la pared opuesta, frente a la TV.
            const wall = Object.keys(WALL_ROT).find((k) => WALL_ROT[k] === ((tv.rot + 180) % 360));
            const p = onWall(it, wall, 0.5, R);
            if (wall === 'N' || wall === 'S') p.x = tv.x; else p.z = tv.z;
            put(it, blocks(it, p) ? wallSpot(it, wall, R) : p);
          } else {
            const dist = 170 + rand() * 120;
            put(it, { x: tv.x + f.x * dist, z: tv.z + f.z * dist, rot: (tv.rot + 180) % 360 });
          }
          extra.sofaId = it.id;
        } else {
          put(it, wallSpot(it, pickWall(), R));
        }
        break;
      }
      case 'armchair': {
        const tvIt = extra.tvId ? free.find((i) => i.id === extra.tvId) : lockedTv;
        const tv = tvIt ? (placements[tvIt.id] || tvIt) : null;
        const sofa = extra.sofaId ? placements[extra.sofaId] : null;
        if (sofa) {
          // A un lado de la zona de estar, en perpendicular al sofá.
          const sofaIt = free.find((i) => i.id === extra.sofaId);
          const f = front(sofa.rot);
          const side = { x: f.z, z: -f.x };
          let best = null;
          for (let k = 0; k < 10; k++) {
            const sgn = rand() < 0.5 ? 1 : -1;
            const fwd = sofaIt.d / 2 + 20 + rand() * 60;
            const along = sofaIt.w / 2 + it.d / 2 + 10 + rand() * 30;
            const p = { x: sofa.x + f.x * fwd + side.x * along * sgn, z: sofa.z + f.z * fwd + side.z * along * sgn };
            const mid = { x: sofa.x + f.x * fwd, z: sofa.z + f.z * fwd };
            p.rot = rand() < 0.6 ? faceTowards(p, mid) : faceTowards(p, tv || mid);
            clampInside(p, it, R);
            best = best || p;
            if (!collides(it, p)) { best = p; break; }
          }
          put(it, best);
        } else {
          const p = { x: R.x0 + rand() * (R.x1 - R.x0), z: R.z0 + rand() * (R.z1 - R.z0) };
          p.rot = faceTowards(p, tv || { x: cx, z: cz });
          put(it, p);
        }
        break;
      }
      case 'table': {
        const rot = rand() < 0.5 ? 0 : 90;
        if (joinTables && tables[0] !== it && placements[tables[0].id]) {
          // Junto a la anterior mesa, por el lado corto (forman una mesa larga).
          const prev = tables[tables.indexOf(it) - 1];
          const p = placements[prev.id];
          const f = front(p.rot);
          const side = { x: f.z, z: -f.x };
          const off = prev.w / 2 + it.w / 2;
          put(it, { x: p.x + side.x * off, z: p.z + side.z * off, rot: p.rot });
        } else {
          const margin = 70;
          const { fw, fd } = footprint(it, rot);
          const x = R.x0 + margin + fw / 2 + rand() * Math.max(0, R.x1 - R.x0 - 2 * margin - fw);
          const z = R.z0 + margin + fd / 2 + rand() * Math.max(0, R.z1 - R.z0 - 2 * margin - fd);
          if (rand() < 0.2) put(it, wallSpot(it, pickWall(), R));
          else put(it, { x, z, rot });
        }
        break;
      }
      case 'coffee': {
        const sofa = extra.sofaId ? placements[extra.sofaId] : null;
        if (sofa) {
          const sofaIt = free.find((i) => i.id === extra.sofaId);
          const f = front(sofa.rot);
          let off = sofaIt.d / 2 + 35 + it.d / 2;
          const tvIt = extra.tvId ? free.find((i) => i.id === extra.tvId) : lockedTv;
          const tv = tvIt ? (placements[tvIt.id] || tvIt) : null;
          if (tv) {
            // Centrada entre el sofá y la zona de la TV / su mueble.
            const stand = free.find((i) => i.type === 'muebleTv' && extra.onTop.has(i.id));
            const dist = Math.abs((tv.x - sofa.x) * f.x + (tv.z - sofa.z) * f.z) - (stand ? stand.d : 10);
            const freeSpace = dist - sofaIt.d / 2;
            off = sofaIt.d / 2 + Math.max(30, Math.min(45, (freeSpace - it.d) / 2)) + it.d / 2;
          }
          put(it, { x: sofa.x + f.x * off, z: sofa.z + f.z * off, rot: sofa.rot });
        } else {
          put(it, { x: cx + (rand() - 0.5) * 80, z: cz + (rand() - 0.5) * 80, rot: rand() < 0.5 ? 0 : 90 });
        }
        break;
      }
      case 'seat':
        break; // se colocan después, alrededor de las mesas
      case 'nightstand': {
        const beds = placed('bed');
        const used = free.filter((i) => roleOf(i) === 'nightstand' && placements[i.id]).length;
        const bed = beds[Math.floor(used / 2) % Math.max(beds.length, 1)];
        if (bed) {
          const p = placements[bed.id];
          const f = front(p.rot);
          const side = { x: f.z, z: -f.x };
          const sgn = used % 2 === 0 ? 1 : -1;
          const along = bed.w / 2 + it.w / 2 + 3;
          const back = bed.d / 2 - it.d / 2;
          put(it, { x: p.x + side.x * along * sgn - f.x * back, z: p.z + side.z * along * sgn - f.z * back, rot: p.rot });
        } else {
          put(it, wallSpot(it, pickWall(), R));
        }
        break;
      }
      case 'corner': {
        let p;
        for (let k = 0; k < 8; k++) {
          p = onWall(it, WALLS[Math.floor(rand() * 4)], rand() < 0.5 ? 0 : 1, R);
          if (!blocks(it, p)) break;
        }
        put(it, p);
        break;
      }
      case 'rug': {
        const anchor = (extra.sofaId && free.find((i) => roleOf(i) === 'coffee' && placements[i.id])) || tables.find((i) => placements[i.id]);
        if (anchor) {
          const p = placements[anchor.id];
          put(it, { x: p.x, z: p.z, rot: p.rot });
        } else put(it, { x: cx, z: cz, rot: rand() < 0.5 ? 0 : 90 });
        break;
      }
      default:
        put(it, wallSpot(it, pickWall(), R));
    }
  }

  // Sillas alrededor de las mesas (o del escritorio).
  const seats = free.filter((i) => roleOf(i) === 'seat');
  if (seats.length) {
    const anchors = [...free.filter((i) => ['table', 'desk'].includes(roleOf(i))), ...locked.filter((i) => ['table', 'desk'].includes(roleOf(i)))];
    const slots = [];
    if (joinTables && tables.length > 1) {
      // Mesa combinada: calcular la caja conjunta.
      const boxes = tables.map((tb) => aabb({ ...tb, ...placements[tb.id] }));
      const u = { x0: Math.min(...boxes.map((b) => b.x0)), x1: Math.max(...boxes.map((b) => b.x1)), z0: Math.min(...boxes.map((b) => b.z0)), z1: Math.max(...boxes.map((b) => b.z1)) };
      slots.push(...tableSlots(u, seats[0], rand, tables.map((x) => x.id)));
      for (const a of anchors.filter((a) => roleOf(a) === 'desk')) slots.push(...deskSlot(a, placements[a.id] || a, seats[0]));
      for (const a of locked.filter((a) => roleOf(a) === 'table')) slots.push(...tableSlots(aabb(a), seats[0], rand, [a.id]));
    } else {
      for (const a of anchors) {
        const p = placements[a.id] || a;
        if (roleOf(a) === 'desk') slots.push(...deskSlot(a, p, seats[0]));
        else slots.push(...tableSlots(aabb({ ...a, ...p }), seats[0], rand, [a.id]));
      }
    }
    // Repartir alternando entre mesas: ordenar slots por prioridad.
    // Solo huecos donde la silla cabe dentro de la habitación y no choca con otros muebles.
    const others = [...locked, ...free.filter((i) => placements[i.id] && roleOf(i) !== 'rug' && !['table', 'desk'].includes(roleOf(i))).map((i) => ({ ...i, ...placements[i.id] }))];
    const valid = slots.filter((sl) => {
      const c = { ...seats[0], x: sl.x, z: sl.z, rot: sl.rot };
      const b = aabb(c);
      return b.x0 >= R.x0 - 0.5 && b.x1 <= R.x1 + 0.5 && b.z0 >= R.z0 - 0.5 && b.z1 <= R.z1 + 0.5 && !others.some((o) => (o.elev || 0) < 90 && overlaps(c, o));
    });
    valid.sort((a, b) => a.prio - b.prio || rand() - 0.5);
    seats.forEach((s, i) => {
      const slot = valid[i];
      if (slot) {
        put(s, { x: slot.x, z: slot.z, rot: slot.rot });
        for (const tid of slot.tableIds) extra.pairs.add(s.id + '|' + tid);
      } else {
        put(s, wallSpot(s, pickWall(), R));
      }
    });
  }

  return { placements, extra };
}

// Huecos para sillas alrededor de un rectángulo de mesa (AABB).
function tableSlots(b, chair, rand, tableIds) {
  const cw = chair.w + 10, cd = chair.d;
  const tuck = cd * 0.35;
  const w = b.x1 - b.x0, d = b.z1 - b.z0;
  const longX = w >= d;
  const out = [];
  const sides = [
    { side: 'N', len: w, long: longX },
    { side: 'S', len: w, long: longX },
    { side: 'W', len: d, long: !longX },
    { side: 'E', len: d, long: !longX },
  ];
  const oneSide = rand() < 0.3; // a veces todas las sillas en un lado largo
  for (const s of sides) {
    const n = Math.max(0, Math.floor(s.len / cw));
    if (!n) continue;
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n;
      const prioBase = s.long ? 0 : 10;
      const sidePenalty = oneSide && s.long && s.side !== (longX ? 'S' : 'E') ? 5 : 0;
      const prio = prioBase + sidePenalty + Math.abs(t - 0.5) * 2 + (s.side === 'N' || s.side === 'W' ? 0.01 : 0);
      let p;
      if (s.side === 'N') p = { x: b.x0 + w * t, z: b.z0 - cd / 2 + tuck, rot: 0 };
      if (s.side === 'S') p = { x: b.x0 + w * t, z: b.z1 + cd / 2 - tuck, rot: 180 };
      if (s.side === 'W') p = { x: b.x0 - cd / 2 + tuck, z: b.z0 + d * t, rot: 90 };
      if (s.side === 'E') p = { x: b.x1 + cd / 2 - tuck, z: b.z0 + d * t, rot: 270 };
      out.push({ ...p, prio, tableIds });
    }
  }
  return out;
}

function deskSlot(desk, p, chair) {
  const f = front(p.rot);
  const off = desk.d / 2 + chair.d / 2 - chair.d * 0.35;
  return [{ x: p.x + f.x * off, z: p.z + f.z * off, rot: (p.rot + 180) % 360, prio: 1, tableIds: [desk.id] }];
}

// Quadrícula de 10 cm: una cel·la és "transitable" si al seu voltant hi cap un quadrat lliure de 60 cm.
// Es fa un ompliment des de les portes i es mira quines cel·les i quins mobles queden sense accés.
const CELL = 10;
let CLEAR = 60, GAPMIN = 65; // es fixen a cada generació des dels ajustos avançats
function accessibility(items, R, keepouts) {
  const W = Math.ceil((R.x1 - R.x0) / CELL), D = Math.ceil((R.z1 - R.z0) / CELL);
  if (W < 2 || D < 2) return null;
  const occ = new Uint8Array(W * D);
  const solid = items.filter((i) => roleOf(i) !== 'rug' && (i.elev || 0) < 120);
  const boxes = solid.map((i) => aabb(i));
  for (const b of [...boxes, ...keepouts.filter((k) => k.solid)]) {
    const i0 = Math.max(0, Math.floor((b.x0 - R.x0) / CELL)), i1 = Math.min(W - 1, Math.floor((b.x1 - R.x0 - 0.01) / CELL));
    const j0 = Math.max(0, Math.floor((b.z0 - R.z0) / CELL)), j1 = Math.min(D - 1, Math.floor((b.z1 - R.z0 - 0.01) / CELL));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) occ[j * W + i] = 1;
  }
  // Taula de sumes acumulades per saber en O(1) si una finestra de 60×60 és lliure.
  const S = new Int32Array((W + 1) * (D + 1));
  for (let j = 0; j < D; j++) for (let i = 0; i < W; i++) S[(j + 1) * (W + 1) + i + 1] = occ[j * W + i] + S[j * (W + 1) + i + 1] + S[(j + 1) * (W + 1) + i] - S[j * (W + 1) + i];
  const n = Math.round(CLEAR / CELL), h = Math.floor(n / 2);
  const walk = new Uint8Array(W * D);
  let total = 0;
  for (let j = 0; j < D; j++) for (let i = 0; i < W; i++) {
    const i0 = i - h, j0 = j - h, i1 = i0 + n, j1 = j0 + n;
    if (i0 < 0 || j0 < 0 || i1 > W || j1 > D) continue;
    const sum = S[j1 * (W + 1) + i1] - S[j0 * (W + 1) + i1] - S[j1 * (W + 1) + i0] + S[j0 * (W + 1) + i0];
    if (sum === 0) { walk[j * W + i] = 1; total++; }
  }
  if (!total) return null;
  // Llavors: cel·les transitables davant de les portes (si no n'hi ha, es parteix de tot arreu).
  const seen = new Uint8Array(W * D);
  const queue = [];
  for (const k of keepouts) {
    if (k.window || k.solid || k.beam !== undefined) continue;
    const i0 = Math.max(0, Math.floor((k.x0 - R.x0) / CELL)), i1 = Math.min(W - 1, Math.floor((k.x1 - R.x0 - 0.01) / CELL));
    const j0 = Math.max(0, Math.floor((k.z0 - R.z0) / CELL)), j1 = Math.min(D - 1, Math.floor((k.z1 - R.z0 - 0.01) / CELL));
    // la finestra de 60 no cap tocant la paret: es busquen transitables fins a 30 cm més endins
    const ex = h;
    for (let j = Math.max(0, j0 - ex); j <= Math.min(D - 1, j1 + ex); j++) for (let i = Math.max(0, i0 - ex); i <= Math.min(W - 1, i1 + ex); i++) {
      const c = j * W + i;
      if (walk[c] && !seen[c]) { seen[c] = 1; queue.push(c); }
    }
  }
  if (!queue.length) return null;
  let reached = 0;
  while (queue.length) {
    const c = queue.pop();
    reached++;
    const i = c % W, j = (c - i) / W;
    if (i > 0 && walk[c - 1] && !seen[c - 1]) { seen[c - 1] = 1; queue.push(c - 1); }
    if (i < W - 1 && walk[c + 1] && !seen[c + 1]) { seen[c + 1] = 1; queue.push(c + 1); }
    if (j > 0 && walk[c - W] && !seen[c - W]) { seen[c - W] = 1; queue.push(c - W); }
    if (j < D - 1 && walk[c + W] && !seen[c + W]) { seen[c + W] = 1; queue.push(c + W); }
  }
  const blocked = [];
  const pad = CLEAR / 2 + CELL;
  solid.forEach((it, k) => {
    const role = roleOf(it);
    if (role === 'seat' || role === 'coffee' || role === 'tv') return; // s'hi arriba des de la taula, el sofà o el moble de la TV
    const b = boxes[k];
    const i0 = Math.max(0, Math.floor((b.x0 - pad - R.x0) / CELL)), i1 = Math.min(W - 1, Math.floor((b.x1 + pad - R.x0) / CELL));
    const j0 = Math.max(0, Math.floor((b.z0 - pad - R.z0) / CELL)), j1 = Math.min(D - 1, Math.floor((b.z1 + pad - R.z0) / CELL));
    let ok = false;
    for (let j = j0; j <= j1 && !ok; j++) for (let i = i0; i <= i1; i++) if (seen[j * W + i]) { ok = true; break; }
    if (!ok) blocked.push(it.name);
  });
  return { lostCells: total - reached, blocked };
}

function scoreLayout(pl, free, locked, R, keepouts, dbg = null) {
  const add = (k, v) => { if (dbg) dbg[k] = (dbg[k] || 0) + v; return v; };
  const { placements, extra } = pl;
  const items = [...free.map((i) => ({ ...i, ...placements[i.id] })), ...locked];
  const boxes = items.map((i) => aabb(i));
  let s = 0;

  for (let a = 0; a < items.length; a++) {
    const A = items[a], ra = roleOf(A);
    s += add('fuera:' + A.name, outsideAmount(R, boxes[a]) * 40);
    if (ra !== 'rug') {
      for (const k of keepouts) {
        if (k.window && A.h + (A.elev || 0) < 110) continue;
        if (k.beam !== undefined && A.h + (A.elev || 0) <= k.beam) continue;
        const ov = rectOverlapArea(boxes[a], k);
        if (ov > 0) s += add((k.solid ? 'pilar:' : k.beam !== undefined ? 'biga:' : 'puerta:') + A.name, (k.window ? 150 : 500) + ov * 0.3);
      }
    }
    for (let b = a + 1; b < items.length; b++) {
      const B = items[b], rb = roleOf(B);
      if ((ra === 'rug') !== (rb === 'rug')) continue;
      if (extra.pairs.has(A.id + '|' + B.id) || extra.pairs.has(B.id + '|' + A.id)) continue;
      if (ra === 'seat' && (rb === 'table' || rb === 'desk') || rb === 'seat' && (ra === 'table' || ra === 'desk')) {
        // una silla puede meterse algo bajo otra mesa, pero no mucho
        const ov = rectOverlapArea(boxes[a], boxes[b]);
        if (ov > 0) s += add('silla-mesa', 200 + ov * 0.5);
        continue;
      }
      // Objetos a distinta altura (TV colgada sobre un mueble) no chocan.
      const a0 = A.elev || 0, a1 = a0 + A.h, b0 = B.elev || 0, b1 = b0 + B.h;
      if (a1 <= b0 || b1 <= a0) continue;
      if (overlaps(A, B)) {
        s += add('choque:' + A.name + '/' + B.name, 2500 + rectOverlapArea(boxes[a], boxes[b]) * 0.6);
      } else if (ra !== 'rug') {
        const g = rectGap(boxes[a], boxes[b]);
        const bothSeats = ra === 'seat' && rb === 'seat';
        if (g > 0.5 && g < GAPMIN && !bothSeats) s += add('paso', (GAPMIN - g) * 1.2); // pas estret entre mobles
      }
    }
  }

  // Accessibilitat: des de la porta s'ha de poder arribar a cada moble per un pas de 60 cm,
  // i l'espai lliure que queda tancat (sense accés) es penalitza.
  const acc = accessibility(items, R, keepouts);
  if (acc) {
    s += add('tancat', acc.lostCells * 1.5);
    for (const n of acc.blocked) s += add('accés:' + n, 600);
  }

  // TV y sofá: distancia de visión y orientación.
  const tvIt = items.find((i) => roleOf(i) === 'tv');
  const sofa = items.find((i) => roleOf(i) === 'sofa');
  if (tvIt && sofa) {
    const dx = tvIt.x - sofa.x, dz = tvIt.z - sofa.z;
    const dist = Math.hypot(dx, dz) || 1;
    const ideal = Math.max(160, tvIt.w * 1.6);
    s += add('tv-dist', Math.abs(dist - ideal) * 0.6);
    const f = front(sofa.rot);
    const cos = (f.x * dx + f.z * dz) / dist;
    s += add('sofa-mira', (1 - cos) * 250);
    const ft = front(tvIt.rot);
    const cos2 = -(ft.x * dx + ft.z * dz) / dist;
    s += add('tv-mira', (1 - cos2) * 250);
  }
  // Sillones mirando a la TV.
  if (tvIt) for (const a of items.filter((i) => roleOf(i) === 'armchair')) {
    const dx = tvIt.x - a.x, dz = tvIt.z - a.z, dist = Math.hypot(dx, dz) || 1;
    const f = front(a.rot);
    s += add('sillon', (1 - (f.x * dx + f.z * dz) / dist) * 80);
  }
  // Espacio libre central: preferir que los muebles grandes no ocupen el centro si no son mesas.
  const cx = (R.x0 + R.x1) / 2, cz = (R.z0 + R.z1) / 2;
  for (const it of items) {
    const r = roleOf(it);
    if (r === 'wall' || r === 'bed') {
      const d = Math.hypot(it.x - cx, it.z - cz);
      s += add('centro', Math.max(0, 150 - d) * 0.3);
    }
  }
  return s;
}
