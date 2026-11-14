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
import { aabb, overlaps, roomAt } from '../js/geom.js';
import { migratePlan } from '../js/state.js';

const clone = (o) => JSON.parse(JSON.stringify(o));
const plan = () => clone(DEFAULT_PLAN);
const room = (st, name) => st.rooms.find((r) => r.name === name);

test('el plànol per defecte té les estances principals amb les mides confirmades', () => {
  const st = plan();
  const m = room(st, 'Menjador'), d = room(st, 'Dormitori');
  assert.ok(m && d);
  assert.deepEqual([m.w, m.d].sort(), [270, 440].sort());
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
