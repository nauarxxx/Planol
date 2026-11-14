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
import { aabb, overlaps, roomAt, parts, doorSwing, boxHitsSwing } from '../js/geom.js';
import { migratePlan } from '../js/state.js';
import { editWall, wallSegments } from '../js/walledit.js';

const clone = (o) => JSON.parse(JSON.stringify(o));
const plan = () => clone(DEFAULT_PLAN);
const room = (st, name) => st.rooms.find((r) => r.name === name);

test('el plànol per defecte té les estances principals amb les mides confirmades', () => {
  const st = plan();
  const m = room(st, 'Menjador'), d = room(st, 'Dormitori');
  assert.ok(m && d);
  assert.deepEqual([m.w, m.d], [270, 530]);
  assert.deepEqual([d.w, d.d], [310, 310]);
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
  assert.deepEqual(segLens(st, d, 'N'), [30, 80, 200]);
  const r = editWall(st, pieceOf(st, d, 'N', 0), 'piece', 40, 1);
  assert.ok(r.ok, r.msg);
  assert.equal(r.kind, 'keep');
  assert.deepEqual(segLens(st, d, 'N'), [40, 80, 190]);
  assert.equal(d.w, 310);
  const r2 = editWall(st, pieceOf(st, d, 'N', 0), 'piece', 300, 1); // no hi cap: el tros del costat només fa 190
  assert.ok(!r2.ok && r2.canGrow);
  assert.deepEqual(segLens(st, d, 'N'), [40, 80, 190]);
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
  assert.deepEqual(segLens(st, d, 'N'), [300, 80, 200]);
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
  assert.equal(s.items.find((i) => i.id === 'fix-nevera').x, 232.5);
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
