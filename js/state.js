// Estat desat: càrrega des del dispositiu i actualització quan el plànol per defecte és més nou.
import { DEFAULT_PLAN } from './plan.js?v=51';
import { roomAt } from './geom.js?v=51';
import { wallEProposals } from './roomplans.js?v=51';

export const STORE_KEY = 'planta3d-v1';
export const clone = (o) => JSON.parse(JSON.stringify(o));

export function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && Array.isArray(s.rooms) && Array.isArray(s.items)) return s;
    }
  } catch (e) { /* sin almacenamiento */ }
  const s = clone(DEFAULT_PLAN);
  addWallEProposals(s);
  return s;
}

// Si el plano por defecto es más nuevo que el guardado, se actualizan las habitaciones
// y se conservan los muebles (se reasignan a la habitación donde caen).
// v28: les mides de la persona són per dins (de paret a paret). Fins a la v27 eren fins al mig de la paret,
// així que cada habitació mesurada creix el gruix d'una paret (10) i les que hi ha darrere es desplacen.
// Rectangles de la v27 (fins al mig de les parets), per saber a quina paret era a prop cada moble.
const V27 = {
  'terraza-cocina': [0, 0, 335, 120], cocina: [0, 120, 270, 260], salon: [0, 380, 270, 530], raco: [270, 786, 50, 124],
  'pilar-mirall': [285, 786, 35, 40], 'biga-raco': [270, 786, 50, 124], terraza: [0, 910, 268, 130], bano: [705, 495, 190, 190],
  bano2: [895, 650, 107, 145], distribuidor: [270, 685, 625, 100], office: [320, 785, 205, 275], 'armario-dorm': [525, 785, 60, 195],
  'armario-office': [525, 980, 60, 80], dormitorio: [585, 785, 310, 310],
};
// línies de paret de la v27 que es desplacen: tot el que hi ha a partir de cadascuna es mou 10 més enllà
const X28 = [270, 525, 585, 895, 1002];
export const shiftX28 = (v) => v + 10 * X28.filter((l) => l <= v + 0.5).length;
export const shiftZ28 = (v) => v + (v >= 1039.5 ? 10 : 0);
const rectOf = (r) => (Array.isArray(r) ? { x: r[0], z: r[1], w: r[2], d: r[3] } : r);
const inR = (r, x, z) => x >= r.x - 0.5 && x <= r.x + r.w + 0.5 && z >= r.z - 0.5 && z <= r.z + r.d + 0.5;
// mou un punt (moble) amb la paret de la seva habitació que té més a prop, perquè no quedi separat ni ficat a la paret
function movePoint28(p, olds, news) {
  let id = p.roomId && olds[p.roomId] && inR(rectOf(olds[p.roomId]), p.x, p.z) ? p.roomId : null;
  if (!id) id = Object.keys(olds).find((k) => news[k] && inR(rectOf(olds[k]), p.x, p.z) && !/pilar|biga/.test(k)) || null;
  if (!id || !news[id]) { p.x = shiftX28(p.x); p.z = shiftZ28(p.z); return; }
  const a = rectOf(olds[id]); const b = rectOf(news[id]);
  p.x += (p.x - a.x <= a.x + a.w - p.x) ? b.x - a.x : (b.x + b.w) - (a.x + a.w);
  p.z += (p.z - a.z <= a.z + a.d - p.z) ? b.z - a.z : (b.z + b.d) - (a.z + a.d);
}
function toInner28(s, fresh) {
  const oldRects = {};
  if (s.roomsEdited && Array.isArray(s.rooms)) for (const r of s.rooms) oldRects[r.id] = { x: r.x, z: r.z, w: r.w, d: r.d };
  else Object.assign(oldRects, V27);
  const freshBy = Object.fromEntries(fresh.rooms.map((r) => [r.id, r]));
  if (s.roomsEdited && Array.isArray(s.rooms)) {
    // habitacions que l'usuari ha editat: s'eixamplen igual que les del plànol (les que no ha tocat prenen les noves)
    for (const r of s.rooms) {
      const v = V27[r.id]; const f = freshBy[r.id];
      if (v && f && r.x === v[0] && r.z === v[1] && r.w === v[2] && r.d === v[3]) {
        Object.assign(r, { x: f.x, z: f.z, w: f.w, d: f.d });
        const same = (r.openings || []).length === (f.openings || []).length && (r.openings || []).every((o, k) => o.wall === f.openings[k].wall && o.type === f.openings[k].type);
        if (same) r.openings.forEach((o, k) => { o.offset = f.openings[k].offset; });
        continue;
      }
      const x0 = shiftX28(r.x); const x1 = shiftX28(r.x + r.w); const z0 = shiftZ28(r.z); const z1 = shiftZ28(r.z + r.d);
      for (const o of r.openings || []) {
        if (o.wall === 'N' || o.wall === 'S') o.offset = Math.max(0, shiftX28(r.x + o.offset) - x0);
        else o.offset = Math.max(0, shiftZ28(r.z + o.offset) - z0);
      }
      Object.assign(r, { x: x0, z: z0, w: x1 - x0, d: z1 - z0 });
    }
  }
  const newRects = {};
  for (const r of (s.roomsEdited && Array.isArray(s.rooms) ? s.rooms : fresh.rooms)) newRects[r.id] = { x: r.x, z: r.z, w: r.w, d: r.d };
  for (const it of s.items || []) movePoint28(it, oldRects, newRects);
  for (const sc of s.scenes || []) for (const it of sc.items || []) movePoint28(it, oldRects, newRects);
}

// v30: la porta de l'office és a la cantonada de l'armari (paret de dalt, costat de l'est) i s'obre contra aquesta paret.
// Per a plànols amb mides editades: es manté l'amplada de la porta i es posa a 5 cm de la cantonada.
export function moveOfficeDoor30(s) {
  const r = (s.rooms || []).find((x) => x.id === 'office');
  const d = r && (r.openings || []).find((o) => o.wall === 'N' && o.type === 'puerta');
  if (!d) return;
  const t = s.wallThickness || 10;
  d.offset = Math.max(t / 2, r.w - t / 2 - 5 - d.width);
  if (!d.doorEdited) d.hinge = 'b';
}

// opts.reset: torna a posar el plànol per defecte (eina de desenvolupador) sense moure els mobles com si vinguessin d'una versió antiga
export function migratePlan(s, opts = {}) {
  if (!s || (s.version || 1) >= DEFAULT_PLAN.version) return s;
  const fresh = clone(DEFAULT_PLAN);
  const from = opts.reset ? DEFAULT_PLAN.version : (s.version || 1);
  if (opts.reset) delete s.roomsEdited;
  // v26 corregeix la paret de la porta d'entrada i baixa 90 el passadís i les habitacions: és una correcció de la persona,
  // per tant passa per davant de les mides que s'haguessin editat abans (els colors de les parets es conserven)
  if (from < 26) {
    delete s.roomsEdited;
    // els mobles es queden a la mateixa habitació: el que hi ha a la meitat de la terrassa del menjador i tot el que és més avall baixa 90
    // (la taula, les cadires i la tele, a prop de la cuina i de la porta, es queden on són)
    for (const it of s.items || []) if (it.z > 380 && !(it.x < 270 && it.z < 640)) it.z += 90;
  }
  if (from < 28) toInner28(s, fresh);
  if (s.roomsEdited && Array.isArray(s.rooms) && s.rooms.length) {
    // l'usuari ha canviat mides de parets o d'habitacions: es conserven i només s'hi afegeixen les habitacions noves
    const have = new Set(s.rooms.map((r) => r.id));
    for (const r of fresh.rooms) if (!have.has(r.id)) s.rooms.push(r);
    // v30: la porta de l'office va a la cantonada de l'armari (5 cm de paret), amb la frontissa en aquest costat
    if (from < 30) moveOfficeDoor30(s);
  } else {
    // es conserva el color de les parets pintades
    const paint = Object.fromEntries((s.rooms || []).filter((r) => r.walls).map((r) => [r.id, r.walls]));
    for (const r of fresh.rooms) if (paint[r.id]) r.walls = paint[r.id];
    // i el tipus i el sentit de les portes que l'usuari ha canviat (la mateixa porta: mateixa habitació, paret i ordre a la paret)
    const doorsOn = (r, w) => (r.openings || []).filter((o) => o.type === 'puerta' && o.wall === w);
    for (const r of fresh.rooms) {
      const old = (s.rooms || []).find((x) => x.id === r.id);
      if (!old) continue;
      for (const w of ['N', 'S', 'E', 'W']) {
        const was = doorsOn(old, w);
        doorsOn(r, w).forEach((o, k) => {
          const p = was[k];
          if (!p || !p.doorEdited) return;
          for (const key of ['door', 'swing', 'hinge']) { if (p[key] === undefined) delete o[key]; else o[key] = p[key]; }
          o.doorEdited = true;
        });
      }
    }
    s.rooms = fresh.rooms;
  }
  s.version = fresh.version;
  s.items = s.items || [];
  for (const it of s.items) {
    const r = roomAt(s.rooms, it.x, it.z);
    it.roomId = r ? r.id : (s.rooms.find((x) => x.kind === 'room') || {}).id;
  }
  // v29: propostes de l'office amb el simulador i dos escriptoris (objectiu de la persona), per votar-les i aplicar-les des de Propostes
  // v30: la pantalla del simulador és de 50″ i va penjada a la paret cap on mira; v31: més propostes coherents per a l'office, el menjador,
  // el dormitori i la terrassa. Es refan les de WALL-E (es guarden els vots i els comentaris) i s'hi afegeixen les noves.
  if (from < 29) addWallEProposals(s);
  else if (from < 31) addWallEProposals(s, Date.now(), { replace: true });
  // mobles fixos del plànol (p. ex. els de la cuina) que encara no hi siguin, tret dels que l'usuari hagi esborrat expressament
  const removed = new Set(s.removedFixed || []);
  for (const it of fresh.items || []) {
    const mine = s.items.find((x) => x.id === it.id);
    if (!mine) { if (!removed.has(it.id)) s.items.push(clone(it)); continue; }
    // moble fix del plànol que l'usuari no ha desbloquejat: segueix el plànol nou (p. ex. la nevera quan es mou la porta)
    if (it.locked && mine.locked) Object.assign(mine, { x: it.x, z: it.z, rot: it.rot, w: it.w, d: it.d, h: it.h, roomId: it.roomId });
  }
  return s;
}


// Propostes de WALL-E (dibuixades a mà, coherents) desades a «Propostes per votar» de cada estança.
// Un sol cop: si la persona n'esborra una, no torna. Amb replace (quan canvien les propostes en una versió nova),
// les que ja hi són s'actualitzen (mobles, nom i nota de WALL-E) i se'n guarden els vots i els comentaris;
// les antigues de WALL-E que ja no es fan se'n van.
export function addWallEProposals(s, now = Date.now(), { replace = false } = {}) {
  const list = (s.saved ||= []);
  const all = wallEProposals(s, s.wallThickness || 10);
  const keys = new Set(Object.values(all).flat().map((p) => p.key));
  const ours = (x) => x.who === 'WALL-E' && /^(office-sim|menjador|dormitori|terrassa)-\d+$/.test(x.id);
  if (replace) list.splice(0, list.length, ...list.filter((x) => !ours(x) || keys.has(x.id)));
  const seen = new Set(s.walleSeen || []); // propostes que ja s'han donat alguna vegada (per no tornar a posar les esborrades)
  let n = 0, i = 0;
  for (const [roomId, props] of Object.entries(all)) for (const p of props) {
    const id = p.key, at = now + i++;
    const old = list.find((x) => x.id === id);
    if (old) seen.add(id);
    if (old && replace) {
      old.name = p.name; old.items = p.items; old.roomId = roomId;
      const c = (old.comments || []).find((x) => x.id === `${id}-c`);
      if (c) c.text = p.note;
      n++;
      continue;
    }
    if (old || seen.has(id)) continue; // ja hi és, o la persona l'ha esborrada: no torna
    seen.add(id);
    list.push({ id, roomId, name: p.name, who: 'WALL-E', at, items: p.items, votes: {}, comments: [{ id: `${id}-c`, who: 'WALL-E', at, text: p.note }], goals: [] });
    n++;
  }
  s.walleSeen = [...seen];
  return n;
}
