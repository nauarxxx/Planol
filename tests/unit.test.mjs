// Proves de la lògica (sense navegador): node --import ./tests/register.mjs --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PLAN } from '../js/plan.js';
import { mergeStates } from '../js/merge.js';
import { diffLog, mergeById } from '../js/social.js';
import { cornerMax, fitCheck } from '../js/fit.js';
import { checkZones } from '../js/zones.js';
import { fitScale, scaleSvg } from '../js/sheet.js';
import { generateLayouts } from '../js/layout.js';
import { evalGoals } from '../js/goals.js';
import { aabb, overlaps, roomAt, innerRect, outsideAmount, allSwings, parts, doorSwing, doorSwings, doorKind, doorFace, doorSymbols, slideFits, boxHitsSwing } from '../js/geom.js';
import { migratePlan, addWallEProposals } from '../js/state.js';
import { wallEProposals } from '../js/roomplans.js';
import { checkLayout } from '../js/layout.js';
import { officeProposals } from '../js/officeplans.js';
import { editWall, wallSegments } from '../js/walledit.js';

const clone = (o) => JSON.parse(JSON.stringify(o));
const plan = () => clone(DEFAULT_PLAN);
const room = (st, name) => st.rooms.find((r) => r.name === name);

test('el plànol per defecte té les estances principals amb les mides confirmades', () => {
  const st = plan();
  const m = room(st, 'Menjador'), d = room(st, 'Dormitori');
  assert.ok(m && d);
  // les mides de la persona són per dins, de paret a paret: el rectangle va fins al mig de la paret (un gruix més)
  const t = st.wallThickness;
  assert.deepEqual([m.w - t, m.d], [270, 530]);
  assert.deepEqual([d.w - t, d.d - t], [310, 310]);
  const o = room(st, 'Office'), b1 = room(st, 'Bany 1'), b2 = room(st, 'Bany 2');
  assert.deepEqual([o.w - t, o.d - t], [205, 275]);
  assert.deepEqual([b1.w - t, b1.d - t], [190, 190]);
  assert.deepEqual([b2.w - t, b2.d - t], [107, 145]);
  const ofw = o.openings.find((x) => x.type === 'ventana');
  assert.equal(ofw.offset - t / 2, 36); // la finestra de l'office, a 36 de la paret de 275 (per dins)
  for (const it of st.items) assert.ok(st.rooms.some((r) => r.id === it.roomId), `moble sense estança: ${it.id}`);
});

test('geometria: caixa girada i encavalcaments', () => {
  const a = { x: 0, z: 0, w: 200, d: 100, rot: 90 };
  const b = aabb(a);
  assert.equal(Math.round(b.x1 - b.x0), 100);
  assert.equal(Math.round(b.z1 - b.z0), 200);
  assert.ok(overlaps(a, { x: 40, z: 0, w: 20, d: 20, rot: 0 }));
  assert.ok(!overlaps(a, { x: 200, z: 0, w: 20, d: 20, rot: 0 }));
  const st = plan(), m = room(st, 'Menjador');
  assert.equal(roomAt(st.rooms, m.x + 10, m.z + 10)?.id, m.id);
});

test('xocs: una tauleta dins de la U (o de la L) del sofà no hi xoca', () => {
  for (const rot of [0, 90, 180, 270, 30]) {
    const a = rot * Math.PI / 180;
    const sofa = { type: 'sofa', shape: 'U', x: 100, z: 100, w: 300, d: 200, rot, sd: 90, lw: 80 };
    const dins = { type: 'mesaCentro', x: 100 + 50 * Math.sin(a), z: 100 + 50 * Math.cos(a), w: 100, d: 60, rot };
    const seient = { ...dins, x: 100 - 60 * Math.sin(a), z: 100 - 60 * Math.cos(a) };
    assert.equal(parts(sofa).length, 3);
    assert.ok(!overlaps(sofa, dins, -1), `girat ${rot}: no hauria de xocar`);
    assert.ok(!overlaps(dins, sofa, -1));
    assert.ok(overlaps(sofa, seient, -1), `girat ${rot}: damunt del seient sí que xoca`);
  }
  const L = { type: 'sofa', shape: 'Le', x: 0, z: 0, w: 260, d: 160, rot: 0, sd: 90, lw: 90 };
  assert.ok(!overlaps(L, { x: 60, z: 40, w: 80, d: 60, rot: 0 }, -1)); // a la banda sense chaise
  assert.ok(overlaps(L, { x: -90, z: 40, w: 60, d: 60, rot: 0 }, -1)); // damunt de la chaise
});

test('fusió: canvis de tots dos dispositius es conserven', () => {
  const base = { rooms: [{ id: 'a', w: 100 }], items: [{ id: 'x', x: 0 }, { id: 'y', x: 0 }, { id: 'z', x: 0 }] };
  const local = { rooms: [{ id: 'a', w: 100 }], items: [{ id: 'x', x: 5 }, { id: 'y', x: 0 }, { id: 'n', x: 1 }] };
  const remote = { rooms: [{ id: 'a', w: 120 }], items: [{ id: 'x', x: 0 }, { id: 'y', x: 9 }, { id: 'z', x: 0 }] };
  const m = mergeStates(base, local, remote);
  assert.equal(m.rooms[0].w, 120);
  assert.equal(m.items.find((i) => i.id === 'x').x, 5);
  assert.equal(m.items.find((i) => i.id === 'y').x, 9);
  assert.ok(!m.items.find((i) => i.id === 'z'));
  assert.ok(m.items.find((i) => i.id === 'n'));
});

test('fusió: notes, vots, historial i propostes desades s’ajunten', () => {
  const n0 = { id: 'n0', at: 1, who: 'A', text: 'hola' };
  const base = { rooms: [], items: [{ id: 'x', x: 0, notes: [n0] }], log: [{ id: 'l1', at: 1 }], saved: [{ id: 's1', at: 1, votes: {}, comments: [] }, { id: 's2', at: 2, votes: {}, comments: [] }] };
  const local = { rooms: [], items: [{ id: 'x', x: 5, notes: [n0, { id: 'n1', at: 3, who: 'A', text: 'meu' }], votes: { A: 1 } }], log: [{ id: 'l1', at: 1 }, { id: 'l2', at: 3 }], saved: [{ id: 's1', at: 1, votes: { A: 1 }, comments: [{ id: 'c1', at: 3 }] }] };
  const remote = { rooms: [], items: [{ id: 'x', x: 9, notes: [n0, { id: 'n2', at: 4, who: 'B', text: 'teu' }], votes: { B: -1 } }], log: [{ id: 'l1', at: 1 }, { id: 'l3', at: 4 }], saved: [{ id: 's1', at: 1, votes: { B: 1 }, comments: [{ id: 'c2', at: 4 }] }, { id: 's2', at: 2, votes: {}, comments: [] }, { id: 's3', at: 5, votes: {}, comments: [] }] };
  const m = mergeStates(base, local, remote);
  const it = m.items[0];
  assert.equal(it.x, 5);
  assert.deepEqual(it.notes.map((n) => n.id), ['n0', 'n1', 'n2']);
  assert.deepEqual(it.votes, { A: 1, B: -1 });
  assert.deepEqual(m.log.map((l) => l.id), ['l1', 'l2', 'l3']);
  assert.deepEqual(m.saved.map((s) => s.id), ['s1', 's3']); // s2 esborrada aquí
  assert.deepEqual(m.saved[0].votes, { A: 1, B: 1 });
  assert.equal(m.saved[0].comments.length, 2);
  assert.deepEqual(mergeById([], [{ id: 'a', at: 2 }], [{ id: 'b', at: 1 }]).map((x) => x.id), ['b', 'a']);
});

test('historial: frases de què ha canviat', () => {
  const st = plan();
  const prev = JSON.stringify({ items: st.items, rooms: st.rooms, saved: [], ceiling: st.ceiling });
  const it = st.items[0];
  it.x += 50; it.rot = (it.rot || 0) + 90;
  st.items.push({ id: 'nou', name: 'Butaca', roomId: st.rooms[0].id, x: 0, z: 0, w: 80, d: 80, h: 90 });
  const t = diffLog(prev, st, (id) => st.rooms.find((r) => r.id === id)?.name);
  assert.ok(t.some((s) => s.startsWith('ha mogut') && s.includes(it.name)), t.join(' | '));
  assert.ok(t.some((s) => s.startsWith('ha girat')));
  assert.ok(t.some((s) => s.includes('«Butaca»')));
  assert.deepEqual(diffLog(null, st, () => ''), []);
});

test('«hi passa?»: girar a la cantonada i verdicte per la porta', () => {
  // un passadís de 90 amb portes de 80: un objecte prim gira; un de 2×2 m no
  assert.ok(cornerMax(90, 90, 40) > 150);
  assert.ok(cornerMax(90, 90, 120) < 100);
  const st = plan();
  const dorm = room(st, 'Dormitori');
  const small = fitCheck({ w: 50, d: 40, h: 60 }, dorm.id, st);
  assert.equal(small.verdict, 'si');
  const huge = fitCheck({ w: 250, d: 220, h: 230 }, dorm.id, st);
  assert.equal(huge.verdict, 'no');
});

test('zones d’ús: un llit contra la paret no té pas a un costat', () => {
  const st = plan();
  const dorm = room(st, 'Dormitori');
  st.items = [{ id: 'b', type: 'cama', name: 'Llit', roomId: dorm.id, w: 150, d: 200, h: 55, rot: 0, x: dorm.x + 10 + 75, z: dorm.z + dorm.d / 2 }];
  const z = checkZones(st.items[0], { ...st, wallThickness: st.wallThickness || 10 });
  assert.ok(z.length >= 2);
  assert.ok(z.some((r) => !r.ok), JSON.stringify(z));
  assert.ok(z.some((r) => r.ok));
});

test('plànol a escala: 1 cm del pis = 0,2 mm a 1:50 i escala automàtica', () => {
  const st = plan();
  const m = room(st, 'Menjador');
  const f = fitScale(st, 'A4', m.id);
  assert.ok([20, 25, 50].includes(f.scale), JSON.stringify(f));
  const whole = fitScale(st, 'A4');
  assert.ok(whole.scale >= 50);
  const r = scaleSvg(st, { scale: 50, roomId: m.id });
  const mm = /width="([\d.]+)mm"/.exec(r.svg)[1], vb = /viewBox="([^"]+)"/.exec(r.svg)[1].split(/\s+/).map(Number);
  assert.ok(Math.abs(+mm / vb[2] - 0.2) < 1e-3);
});

test('propostes: no es trepitgen i porten l’informe d’objectius', () => {
  const st = plan();
  const m = room(st, 'Dormitori');
  const its = st.items.filter((i) => i.roomId === m.id && !i.locked);
  if (!its.length) return;
  const res = generateLayouts(m, its, st.rooms, { wallThickness: st.wallThickness, seed: 7, count: 2, tries: 150, goals: ['zones', 'pas', 'llit'] });
  assert.ok(res.length >= 1);
  assert.ok(Array.isArray(res[0].goals) && res[0].goals.length >= 1);
  const placed = its.map((i) => ({ ...i, ...res[0].placements[i.id] }));
  const solid = placed.filter((i) => i.type !== 'alfombra' && !(i.elev > 0));
  for (let a = 0; a < solid.length; a++) for (let b = a + 1; b < solid.length; b++) {
    const pair = [solid[a].type, solid[b].type].sort().join();
    if (/silla/.test(pair) || /mesita/.test(pair)) continue;
    assert.ok(!overlaps(solid[a], solid[b], -2), `${solid[a].name} i ${solid[b].name} es trepitgen`);
  }
  const ev = evalGoals(placed, m, st.rooms, ['llit'], st.wallThickness);
  assert.equal(typeof ev.penalty, 'number');
});

test('migració: el plànol nou conserva els mobles de l’usuari', () => {
  const old = plan();
  old.version = 1;
  old.items.push({ id: 'meu', name: 'Meu', type: 'sillon', roomId: 'x', x: room(old, 'Menjador').x + 50, z: room(old, 'Menjador').z + 50, w: 80, d: 80, h: 90 });
  const s = migratePlan(old);
  assert.equal(s.version, DEFAULT_PLAN.version);
  assert.equal(s.items.find((i) => i.id === 'meu').roomId, room(s, 'Menjador').id);
});

// Paret de la tele del menjador (v26): porta 90 | 226 | pas 90 | racó 124 (530 en total), la porta a la cantonada amb la cuina
const segLens = (st, r, k) => wallSegments(st.rooms, r, k).map((s) => Math.round(s.b - s.a));
const pieceOf = (st, r, k, i) => { const sg = wallSegments(st.rooms, r, k)[i]; return { room: r, key: k, a: sg.a, b: sg.b }; };

test('mida d’un tros de paret: la paret sencera es manté i el tros del costat s’hi adapta', () => {
  const st = plan(), d = room(st, 'Dormitori');
  assert.deepEqual(segLens(st, d, 'N'), [30, 80, 210]);
  const r = editWall(st, pieceOf(st, d, 'N', 0), 'piece', 40, 1);
  assert.ok(r.ok, r.msg);
  assert.equal(r.kind, 'keep');
  assert.deepEqual(segLens(st, d, 'N'), [40, 80, 200]);
  assert.equal(d.w, 320);
  const r2 = editWall(st, pieceOf(st, d, 'N', 0), 'piece', 300, 1); // no hi cap: el tros del costat només fa 200
  assert.ok(!r2.ok && r2.canGrow);
  assert.deepEqual(segLens(st, d, 'N'), [40, 80, 200]);
});

test('mida d’un tros fins a la cantonada: no es descuadra el pas al passadís; per l’altre costat l’habitació creix', () => {
  const st = plan(), m = room(st, 'Menjador'), pass = room(st, 'Passadís'), cuina = room(st, 'Cuina');
  assert.deepEqual(segLens(st, m, 'E'), [90, 226, 90, 124]);
  const before = JSON.stringify(st);
  const r = editWall(st, pieceOf(st, m, 'E', 1), 'piece', 230, 1); // cap avall: el pas deixaria de quedar davant del passadís
  assert.ok(!r.ok && /Passadís/.test(r.msg), r.msg);
  assert.equal(JSON.stringify(st), before);
  const z0 = { m: m.z, c: cuina.z, p: pass.z };
  const r2 = editWall(st, pieceOf(st, m, 'E', 1), 'piece', 230, -1); // cap amunt: el menjador creix cap a la cuina
  assert.ok(r2.ok, r2.msg);
  assert.equal(m.d, 534);
  assert.deepEqual(segLens(st, m, 'E'), [90, 230, 90, 124]);
  assert.equal(pass.z, z0.p); // el passadís no es mou i el pas hi continua donant
  const paso = m.openings.find((o) => o.type === 'paso' && o.wall === 'E');
  assert.ok(m.z + paso.offset >= pass.z - 1 && m.z + paso.offset + paso.width <= pass.z + pass.d + 1);
});

test('paret sencera: el menjador s’allarga per baix, la terrassa baixa i el racó s’allarga amb ell', () => {
  const st = plan(), m = room(st, 'Menjador'), raco = room(st, 'Racó'), ter = room(st, 'Terrassa');
  const sofa = st.items.find((i) => i.roomId === m.id && i.z > m.z + m.d - 80);
  const sz = sofa?.z;
  const r = editWall(st, pieceOf(st, m, 'E', 1), 'whole', 540, 1);
  assert.ok(r.ok, r.msg);
  assert.equal(m.d, 540);
  assert.equal(ter.z, 920);
  assert.equal(raco.z + raco.d, 920);
  assert.equal(raco.openings[0].width, raco.d); // el racó continua obert del tot al menjador
  if (sofa) assert.equal(sofa.z, sz + 10); // el que és enganxat a la paret de baix la segueix
  for (const it of st.items) { const h = roomAt(st.rooms, it.x, it.z); assert.ok(h, `moble fora del pis: ${it.id}`); }
});

test('paret sencera: si a l’extrem que s’escurça hi ha una porta o una finestra, no es fa', () => {
  const st = plan(), o = room(st, 'Office');
  const before = JSON.stringify(st);
  const r = editWall(st, pieceOf(st, o, 'N', 0), 'whole', 105, 1); // per la dreta hi ha la finestra de la paret de baix
  assert.ok(!r.ok);
  assert.equal(JSON.stringify(st), before);
});

test('migració: si l’usuari ha canviat les mides, es conserven (excepte la correcció de la v26)', () => {
  const v = DEFAULT_PLAN.version;
  try {
    DEFAULT_PLAN.version = v + 1; // un plànol futur: les mides editades es respecten
    const old = plan(); old.version = v; old.roomsEdited = true;
    room(old, 'Menjador').d = 540;
    assert.equal(room(migratePlan(old), 'Menjador').d, 540);
  } finally { DEFAULT_PLAN.version = v; }
  // d'abans de la v26: la paret de la porta s'ha corregit, però els colors es queden i els mobles baixen amb les habitacions
  const old = plan(); old.version = 25; old.roomsEdited = true;
  room(old, 'Menjador').d = 450; room(old, 'Dormitori').walls = { N: '#c46e4b' };
  old.items.push({ id: 'meu', type: 'silla', x: 800, z: 800, w: 45, d: 50, h: 90, roomId: 'dormitorio' });
  const s = migratePlan(old);
  assert.equal(room(s, 'Menjador').d, 530);
  assert.deepEqual(room(s, 'Dormitori').walls, { N: '#c46e4b' });
  assert.equal(s.items.find((i) => i.id === 'meu').z, 890);
  assert.equal(s.items.find((i) => i.id === 'meu').roomId, 'dormitorio');
});

test('si un tros no hi cap, es pot allargar la paret sencera', () => {
  const st = plan(), d = room(st, 'Dormitori');
  const w = pieceOf(st, d, 'N', 0);
  const r = editWall(st, w, 'piece', 300, 1);
  assert.ok(!r.ok && r.canGrow);
  const r2 = editWall(st, w, 'piece', 300, 1, { grow: true });
  assert.ok(r2.ok, r2.msg);
  assert.equal(d.w, r.growTotal);
  assert.deepEqual(segLens(st, d, 'N'), [300, 80, 210]);
});

test('plànol v26: la porta d’entrada és al menjador, a la cantonada amb la cuina, i no xoca amb res', () => {
  const st = plan(), c = st.rooms.find((r) => r.id === 'cocina'), m = room(st, 'Menjador');
  assert.ok(!c.openings.some((o) => o.type === 'puerta' && o.wall === 'E'));
  const door = m.openings.find((o) => o.wall === 'E' && o.type === 'puerta');
  assert.ok(door && door.offset === 0 && door.width === 90);
  const paso = m.openings.find((o) => o.wall === 'E' && o.type === 'paso');
  assert.equal(paso.offset - door.width, 226); // de la porta al pas del passadís
  const pass = room(st, 'Passadís'), raco = room(st, 'Racó');
  assert.ok(m.z + paso.offset >= pass.z && m.z + paso.offset + paso.width <= pass.z + pass.d + 1); // el pas dona al passadís
  assert.equal(raco.z, m.z + paso.offset + paso.width); // el racó, just després
  const sw = doorSwing(m, door);
  for (const it of st.items.filter((i) => i.roomId === 'salon' || i.roomId === 'cocina')) assert.ok(!boxHitsSwing(aabb(it), sw), `la porta xoca amb ${it.name}`);
});

test('migració: els mobles fixos bloquejats segueixen el plànol nou; els desbloquejats no', () => {
  const old = plan(); old.version = 1;
  const nev = old.items.find((i) => i.id === 'fix-nevera'); nev.x = 145; nev.z = 342.5; // on era abans
  const pica = old.items.find((i) => i.id === 'fix-pica'); pica.locked = false; pica.x = 50;
  const s = migratePlan(old);
  assert.equal(s.items.find((i) => i.id === 'fix-nevera').x, 242.5);
  assert.equal(s.items.find((i) => i.id === 'fix-pica').x, 50);
});

test('plànol v27: banys com a la realitat i cap porta xoca amb els mobles', () => {
  const st = plan();
  const b1 = st.rooms.find((r) => r.id === 'bano'), b2 = st.rooms.find((r) => r.id === 'bano2');
  const it = (id) => st.items.find((i) => i.id === id);
  const d1 = b1.openings.find((o) => o.type === 'puerta'), doorX0 = b1.x + d1.offset;
  // bany 1: banyera a tota la paret de l'oest, vàter a la paret de la porta just a l'esquerra, lavabo a la paret del davant
  assert.ok(it('fix-banyera').w >= b1.d - 10 - 1);
  assert.equal(it('fix-vater1').rot, 180);
  assert.ok(it('fix-vater1').x + it('fix-vater1').w / 2 <= doorX0);
  assert.equal(it('fix-lavabo1').rot, 0);
  // bany 2: vàter davant de la porta (paret de l'est) i lavabo a l'esquerra en entrar (paret del nord)
  const d2 = b2.openings.find((o) => o.type === 'puerta'), mid = b2.z + d2.offset + d2.width / 2;
  assert.equal(it('fix-vater2').rot, 270);
  assert.ok(Math.abs(it('fix-vater2').z - mid) <= 10);
  assert.equal(it('fix-lavabo2').rot, 0);
  for (const r of [b1, b2]) for (const o of r.openings.filter((x) => x.type === 'puerta')) {
    const sw = doorSwing(r, o);
    for (const i of st.items) assert.ok(!boxHitsSwing(aabb(i), sw), `la porta de ${r.name} xoca amb ${i.name}`);
  }
  for (const id of ['fix-banyera', 'fix-vater1', 'fix-lavabo1']) assert.equal(roomAt(st.rooms, it(id).x, it(id).z).id, 'bano');
  for (const id of ['fix-vater2', 'fix-lavabo2']) assert.equal(roomAt(st.rooms, it(id).x, it(id).z).id, 'bano2');
});

test('tipus de porta: normal, doble, plegable i corredissa ocupen el lloc que toca', () => {
  const r = { id: 'h', x: 0, z: 0, w: 400, d: 300 };
  const op = { wall: 'N', offset: 100, width: 80, type: 'puerta' };
  const at = (x, z) => ({ x0: x - 1, x1: x + 1, z0: z - 1, z1: z + 1 });
  const hits = (o, x, z) => doorSwings(r, o).some((sw) => boxHitsSwing(at(x, z), sw));
  // normal, frontissa a l'esquerra (x 100), cap a dins: escombra fins a 80 cm
  assert.equal(doorKind(op), 'batent');
  assert.ok(hits(op, 120, 60) && !hits(op, 120, 85));
  // cap a fora: el lloc és a l'altre costat de la paret
  assert.ok(hits({ ...op, swing: 'out' }, 120, -60) && !hits({ ...op, swing: 'out' }, 120, 30));
  // doble: dues fulles de 40, una a cada extrem
  const dbl = { ...op, door: 'doble' };
  assert.equal(doorSwings(r, dbl).length, 2);
  assert.ok(hits(dbl, 110, 30) && hits(dbl, 170, 30) && !hits(dbl, 140, 50));
  // plegable: no s'allunya més de 40 cm de la paret
  const llibre = { ...op, door: 'llibre' };
  assert.ok(hits(llibre, 110, 35) && !hits(llibre, 110, 45) && !hits(llibre, 170, 25));
  // corredissa per dins: només una franja a tocar de la paret, cap a la frontissa (esquerra); amagada a la paret no ocupa res
  const cor = { ...op, door: 'corredissa', hinge: 'a' };
  assert.ok(hits(cor, 50, 5) && !hits(cor, 50, 20) && !hits(cor, 140, 40));
  assert.equal(doorSwings(r, { ...cor, swing: 'wall' }).length, 0);
  // les antigues «no es dibuixa» són corredisses amagades
  assert.deepEqual([doorKind({ ...op, swing: 'none' }), doorFace({ ...op, swing: 'none' })], ['corredissa', 'wall']);
  for (const k of ['batent', 'doble', 'llibre', 'corredissa']) assert.ok(doorSymbols(r, { ...op, door: k }).length > 0, `sense símbol: ${k}`);
});

test('migració: el tipus i el sentit de les portes canviats per l’usuari es conserven', () => {
  const v = DEFAULT_PLAN.version;
  try {
    DEFAULT_PLAN.version = v + 1;
    const old = plan(); old.version = v;
    const b1 = room(old, 'Bany 1').openings.find((o) => o.type === 'puerta');
    Object.assign(b1, { door: 'corredissa', swing: 'wall', hinge: 'a', doorEdited: true });
    const s = migratePlan(old), o = room(s, 'Bany 1').openings.find((x) => x.type === 'puerta');
    assert.deepEqual([o.door, o.swing, o.hinge], ['corredissa', 'wall', 'a']);
    // les que no s'han tocat segueixen el plànol
    assert.equal(room(s, 'Bany 2').openings.find((x) => x.type === 'puerta').swing, 'out');
  } finally { DEFAULT_PLAN.version = v; }
});

test('corredissa: només hi cap si per on llisca hi ha paret sencera', () => {
  const st = plan();
  const b1 = room(st, 'Bany 1'), op = b1.openings.find((o) => o.type === 'puerta');
  // la porta del Bany 1 és a la cantonada de la dreta: cap a la paret del Bany 2 no hi ha lloc; cap a l'altre costat, sí
  assert.ok(!slideFits(st.rooms, b1, { ...op, door: 'corredissa', hinge: 'b' }));
  assert.ok(slideFits(st.rooms, b1, { ...op, door: 'corredissa', hinge: 'a' }));
  assert.ok(slideFits(st.rooms, b1, { ...op, door: 'corredissa', hinge: 'a', swing: 'out' }));
});

test('migració a la v28 (mides per dins): els mobles es mouen amb la paret que tenen a prop', () => {
  const old = plan(); old.version = 27;
  // plànol de la v27: fins al mig de les parets
  const v27 = { salon: [0, 380, 270, 530], dormitorio: [585, 785, 310, 310], bano: [705, 495, 190, 190] };
  for (const [id, [x, z, w, d]] of Object.entries(v27)) Object.assign(old.rooms.find((r) => r.id === id), { x, z, w, d });
  old.items = [
    { id: 'a', name: 'Prop de la paret de la tele', type: 'sillon', roomId: 'salon', x: 245, z: 600, w: 40, d: 40, h: 60, rot: 0 },
    { id: 'b', name: 'Prop del sofà', type: 'sillon', roomId: 'salon', x: 30, z: 600, w: 40, d: 40, h: 60, rot: 0 },
    { id: 'c', name: 'Dormitori, a l’est', type: 'mesita', roomId: 'dormitorio', x: 870, z: 900, w: 40, d: 40, h: 50, rot: 0 },
  ];
  old.scenes = [{ id: 's1', name: 'Escena', items: [{ id: 'a', x: 245, z: 600, roomId: 'salon' }] }];
  const s = migratePlan(old);
  const it = (id) => s.items.find((i) => i.id === id);
  assert.equal(it('a').x, 255);
  assert.equal(it('b').x, 30);
  assert.equal(it('c').x, 910);
  assert.equal(it('c').roomId, 'dormitorio');
  assert.equal(s.scenes[0].items[0].x, 255);
  // tornar a posar el plànol per defecte (eina de desenvolupador) no torna a moure res
  s.version = 0;
  const again = migratePlan(s, { reset: true });
  assert.equal(again.items.find((i) => i.id === 'a').x, 255);
  assert.equal(again.items.find((i) => i.id === 'a').z, 600);
});

test('migració a la v28: si l’usuari havia canviat mides, les seves habitacions també s’eixamplen', () => {
  const old = plan(); old.version = 27; old.roomsEdited = true;
  const v27 = { salon: [0, 380, 270, 500], dormitorio: [585, 785, 310, 310], office: [320, 785, 205, 275], 'armario-dorm': [525, 785, 60, 195] };
  for (const [id, [x, z, w, d]] of Object.entries(v27)) Object.assign(old.rooms.find((r) => r.id === id), { x, z, w, d });
  const s = migratePlan(old);
  const r = (id) => s.rooms.find((x) => x.id === id);
  assert.deepEqual([r('salon').x, r('salon').w, r('salon').d], [0, 280, 500]);
  assert.deepEqual([r('dormitorio').x, r('dormitorio').w], [615, 320]);
  assert.deepEqual([r('office').x, r('office').w], [330, 215]);
});

test('office: propostes amb el simulador, la pantalla i dos escriptoris amb dos monitors hi caben', () => {
  const st = plan(), of = st.rooms.find((r) => r.id === 'office'), t = st.wallThickness;
  const props = officeProposals(of, t);
  assert.ok(props.length >= 2);
  const swings = allSwings(st.rooms);
  const arm = st.rooms.find((r) => r.id === 'armario-office'), op = arm.openings[0];
  const front = { x0: arm.x - 60, x1: arm.x, z0: arm.z + op.offset, z1: arm.z + op.offset + op.width }; // davant de l'armari
  const ok = (a, b) => ['cadiraOficina', 'monitor'].includes(a.type) && b.type === 'escritorio';
  for (const p of props) {
    const its = p.items, n = (ty) => its.filter((i) => i.type === ty).length;
    assert.deepEqual([n('cockpit'), n('tvParet'), n('escritorio'), n('cadiraOficina'), n('monitor')], [1, 1, 2, 2, 4], p.name);
    for (const it of its) {
      assert.ok(outsideAmount(innerRect(of, t), aabb(it)) <= 0.5, `${p.name}: ${it.name} surt de l’office`);
      assert.equal(roomAt(st.rooms, it.x, it.z).id, 'office');
      if ((it.elev || 0) < 200) for (const sw of swings) assert.ok(!boxHitsSwing(aabb(it), sw), `${p.name}: ${it.name} xoca amb una porta`);
      if (!it.elev || it.type === 'monitor') { const b = aabb(it); assert.ok(b.x1 <= front.x0 || b.z1 <= front.z0 || b.z0 >= front.z1, `${p.name}: ${it.name} tapa l’armari`); }
    }
    for (const a of its) for (const b of its) {
      if (a === b || ok(a, b) || ok(b, a) || a.type === 'alfombra' || b.type === 'alfombra') continue; // la catifa va a sota
      const a0 = a.elev || 0, b0 = b.elev || 0;
      if (a0 + a.h <= b0 || b0 + b.h <= a0) continue;
      assert.ok(!overlaps(a, b, -1), `${p.name}: ${a.name} xoca amb ${b.name}`);
    }
    // la pantalla, davant del volant
    const sim = its.find((i) => i.type === 'cockpit'), tv = its.find((i) => i.type === 'tvParet');
    assert.ok(Math.abs(tv.x - sim.x) < 15 && tv.z < sim.z);
    // pantalla de 50″ penjada a la paret (no al simulador), sense tapar la porta
    assert.ok(tv.w >= 110 && tv.d <= 6 && aabb(tv).z0 <= innerRect(of, t).z0 + 0.5);
    const door = of.openings.find((o) => o.wall === 'N' && o.type === 'puerta');
    assert.ok(aabb(tv).x1 <= of.x + door.offset, `${p.name}: la pantalla tapa la porta`);
  }
});

test('migració a la v29: les propostes de l’office es desen per votar, un sol cop', () => {
  const old = plan(); old.version = 28; old.saved = [];
  const s = migratePlan(old);
  const mine = s.saved.filter((p) => p.roomId === 'office');
  assert.equal(mine.length, 4);
  assert.ok(mine.every((p) => p.who === 'WALL-E' && p.comments.length === 1));
  assert.equal(addWallEProposals(s), 0);
  s.saved = s.saved.filter((p) => p.id !== 'office-sim-2'); s.version = 28;
  assert.equal(migratePlan(s).saved.filter((p) => p.roomId === 'office').length, 3); // la que la persona ha esborrat no torna
});

test('migració a la v30: porta de l’office a la cantonada de l’armari i propostes refetes amb la pantalla de 50″', () => {
  const old = plan(); old.version = 29;
  const of = old.rooms.find((r) => r.id === 'office');
  of.openings[0] = { wall: 'N', offset: 110, width: 80, type: 'puerta' };
  const tv43 = { id: 'of-tvParet-1', type: 'tvParet', w: 97, d: 5, h: 57, elev: 100, x: 384, z: 792.5, rot: 0, roomId: 'office' };
  old.saved = [1, 2, 3].map((n) => ({ id: `office-sim-${n}`, roomId: 'office', name: 'vella', who: 'WALL-E', items: [tv43], votes: { a: 1 }, comments: [{ id: `office-sim-${n}-c`, who: 'WALL-E', text: 'vella' }, { id: 'x', who: 'Ainhoa', text: 'm’agrada' }] }));
  old.roomsEdited = true; // amb mides editades, la porta també es corregeix
  const s = migratePlan(old);
  const d = s.rooms.find((r) => r.id === 'office').openings[0];
  assert.deepEqual([d.offset, d.hinge], [125, 'b']);
  const mine = s.saved.filter((p) => p.roomId === 'office');
  assert.deepEqual(mine.map((p) => p.id), ['office-sim-1', 'office-sim-2', 'office-sim-3', 'office-sim-4']);
  for (const p of mine.slice(0, 3)) {
    assert.equal(p.items.find((i) => i.type === 'tvParet').w, 112);
    assert.deepEqual(p.votes, { a: 1 });
    assert.equal(p.comments.length, 2);
    assert.notEqual(p.comments[0].text, 'vella');
  }
});

test('propostes de WALL-E: coherents a totes les estances (sense xocs, portes lliures, pas i tele davant del sofà)', () => {
  const st = plan(), t = st.wallThickness;
  const all = wallEProposals(st, t);
  assert.deepEqual(Object.keys(all).sort(), ['dormitorio', 'office', 'salon', 'terraza']);
  for (const [rid, list] of Object.entries(all)) {
    const room = st.rooms.find((r) => r.id === rid);
    assert.ok(list.length >= 2, rid);
    for (const p of list) {
      const c = checkLayout(room, p.items, st.rooms, { wallThickness: t });
      const bad = Object.entries(c.dbg).filter(([k, v]) => v > 0.5 && /^(choque|fuera|puerta|pilar|biga|accés|finestra):/.test(k) && !/^finestra:Monitor/.test(k));
      assert.deepEqual(bad, [], `${p.key}: ${JSON.stringify(bad)}`);
      assert.ok(!c.dbg.tancat || c.dbg.tancat < 30, `${p.key}: queda espai tancat`);
      for (const it of p.items) assert.equal(roomAt(st.rooms, it.x, it.z)?.id, rid, `${p.key}: ${it.name} fora de l’estança`);
      const ids = p.items.map((i) => i.id); assert.equal(new Set(ids).size, ids.length, `${p.key}: ids repetits`);
      const tv = p.items.find((i) => i.type === 'tv'), sofa = p.items.find((i) => i.type === 'sofa');
      if (tv && sofa) assert.ok(c.dbg['sofa-mira'] === undefined || c.dbg['sofa-mira'] < 30, `${p.key}: el sofà no mira la tele`);
    }
  }
  // els mobles reals es fan servir (mateix id) i les propostes noves de la v31 es desen per votar
  assert.ok(all.salon[0].items.some((i) => i.id === 'fix-sofa') && all.dormitorio[0].items.some((i) => i.id === 'fix-llit'));
  const old = plan(); old.version = 30;
  const s = migratePlan(old);
  for (const k of ['menjador-1', 'dormitori-1', 'terrassa-1', 'office-sim-3']) assert.ok(s.saved.some((p) => p.id === k && p.who === 'WALL-E'), k);
});
