// «Hi passa?»: comprova si un moble es pot entrar des de la porta del pis fins a l'habitació on va,
// passant per totes les portes i passos del camí i pels girs dels passadissos. És un càlcul aproximat:
// prova el moble pla, de cantó i dret, i per als girs fa servir la fórmula de la cantonada entre dos passadissos.
import { allOpenings, roomAt } from './geom.js?v=37';

const DOOR_H = { puerta: 203, ventanal: 210 };
const PASSABLE = new Set(['puerta', 'paso', 'ventanal']);
const solid = (r) => r && !['pillar', 'beam', 'void'].includes(r.kind);

// Llargada màxima d'una peça de gruix t que pot girar d'un passadís d'ample p a un d'ample q (cantonada de 90°).
export function cornerMax(p, q, t) {
  if (t >= p || t >= q) return 0;
  let best = Infinity;
  for (let i = 1; i < 400; i++) {
    const th = (i / 400) * Math.PI / 2, s = Math.sin(th), c = Math.cos(th);
    best = Math.min(best, p / s + q / c - t / (s * c));
  }
  return Math.max(0, best);
}

// Portes i passos amb les dues habitacions que uneixen.
function links(st) {
  const t = st.wallThickness || 10, out = [];
  for (const o of allOpenings(st.rooms)) {
    if (!PASSABLE.has(o.type)) continue;
    const m = (o.a + o.b) / 2, k = t / 2 + 4;
    const A = o.axis === 'x' ? roomAt(st.rooms, m, o.line - k) : roomAt(st.rooms, o.line - k, m);
    const B = o.axis === 'x' ? roomAt(st.rooms, m, o.line + k) : roomAt(st.rooms, o.line + k, m);
    out.push({ ...o, width: o.b - o.a, height: DOOR_H[o.type] || (st.ceiling || 250), A: solid(A) ? A : null, B: solid(B) ? B : null });
  }
  return out;
}

const fmt = (n) => Math.round(n);

// Comprova el camí. dims = {w, d, h}. Torna { verdict: 'si'|'just'|'no', path, steps: [{ok, text}], entrance }.
export function fitCheck(dims, targetRoomId, st) {
  const L = links(st);
  const rooms = st.rooms.filter(solid);
  const target = rooms.find((r) => r.id === targetRoomId);
  if (!target) return { verdict: 'no', steps: [{ ok: false, text: 'No sé a quina habitació va.' }], path: [] };
  // porta del pis: una porta amb una habitació només a un costat (preferim la del menjador)
  const ents = L.filter((l) => l.type === 'puerta' && (!l.A !== !l.B));
  ents.sort((a, b) => (/menjador|sal/i.test((b.A || b.B).name) ? 1 : 0) - (/menjador|sal/i.test((a.A || a.B).name) ? 1 : 0));
  const ent = ents[0];
  if (!ent) return { verdict: 'no', steps: [{ ok: false, text: 'No trobo la porta d’entrada del pis.' }], path: [] };
  const start = ent.A || ent.B;
  // camí més curt (de porta en porta) fins a l'habitació
  const prev = new Map([[start.id, null]]), q = [start];
  while (q.length) {
    const r = q.shift();
    if (r.id === target.id) break;
    for (const l of L) {
      const other = l.A?.id === r.id ? l.B : l.B?.id === r.id ? l.A : null;
      if (!other || prev.has(other.id)) continue;
      prev.set(other.id, { from: r, link: l }); q.push(other);
    }
  }
  if (!prev.has(target.id)) return { verdict: 'no', steps: [{ ok: false, text: `No trobo cap camí fins a ${target.name}.` }], path: [] };
  const hops = [];
  for (let id = target.id; prev.get(id); id = prev.get(id).from.id) hops.unshift({ ...prev.get(id), to: rooms.find((r) => r.id === id) });
  const [a, b, c] = [dims.w, dims.d, dims.h].map(Number).sort((x, y) => x - y);
  const ceil = st.ceiling || 250;
  const steps = [];
  let verdict = 'si';
  const worse = (v) => { if (v === 'no' || (v === 'just' && verdict === 'si')) verdict = v; };
  // una porta: cal que la secció del moble (dues mides) hi càpiga
  const door = (l, name) => {
    const W = l.width, H = Math.min(l.height, ceil);
    // la llargada (c) va en la direcció de la marxa; la secció (a × b) ha de cabre a la porta
    let how = null;
    if (b <= W && a <= H) how = 'pla';
    else if (a <= W && b <= H) how = 'de cantó';
    const ok = !!how;
    if (!ok) worse('no');
    steps.push({ ok, text: `${name} (${fmt(W)} cm d’ample${l.type === 'paso' ? '' : `, ${fmt(H)} d’alt`}): ${ok ? `hi passa ${how}` : `no hi passa: la part més prima del moble fa ${fmt(a)} × ${fmt(b)} cm`}` });
    return ok;
  };
  // gir d'un passadís (habitació estreta) cap a una porta del costat llarg
  const turn = (room, l, entering = false) => {
    const C = Math.min(room.w, room.d), long = room.w >= room.d ? 'x' : 'z';
    if (C > 160 || l.axis !== long) return; // habitació ampla o porta al fons: no cal girar
    let best = null;
    for (const [v, t, len] of [[a, b, c], [b, a, c], [c, a, b]]) { // què va dret (vertical), gruix i llargada en planta
      if (v > Math.min(ceil - 5, l.height)) continue;
      const mx = cornerMax(C, l.width, t);
      if (t <= l.width && (!best || len - mx < best.len - best.mx)) best = { v, t, len, mx };
    }
    if (!best) return;
    const ok = best.len <= best.mx;
    if (!ok) worse('just');
    steps.push({ ok: ok ? true : 'just', text: `${entering ? `Gir en entrar al ${room.name}` : `Gir al ${room.name}`} (${fmt(C)} cm) ${entering ? `des del pas de ${fmt(l.width)}` : `cap a la porta de ${fmt(l.width)}`}: ${ok ? `hi gira (fins a ${fmt(best.mx)} cm de llarg)` : `molt just: el moble fa ${fmt(best.len)} de llarg i el gir en deixa ≈${fmt(best.mx)}; caldrà inclinar-lo o desmuntar-lo`}` });
  };
  door(ent, `Porta del pis`);
  let cur = start;
  for (const h of hops) {
    turn(cur, h.link);
    door(h.link, `${h.link.type === 'paso' ? 'Pas' : h.link.type === 'ventanal' ? 'Finestral' : 'Porta'} de ${cur.name} a ${h.to.name}`);
    if (h !== hops[hops.length - 1]) turn(h.to, h.link, true); // en entrar a un passadís pel costat també cal girar
    cur = h.to;
  }
  return { verdict, steps, path: [start.name, ...hops.map((h) => h.to.name)], dims: [a, b, c] };
}
