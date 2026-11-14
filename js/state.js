// Estat desat: càrrega des del dispositiu i actualització quan el plànol per defecte és més nou.
import { DEFAULT_PLAN } from './plan.js?v=43';
import { roomAt } from './geom.js?v=43';

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
  return clone(DEFAULT_PLAN);
}

// Si el plano por defecto es más nuevo que el guardado, se actualizan las habitaciones
// y se conservan los muebles (se reasignan a la habitación donde caen).
export function migratePlan(s) {
  if (!s || (s.version || 1) >= DEFAULT_PLAN.version) return s;
  const fresh = clone(DEFAULT_PLAN);
  const from = s.version || 1;
  // v26 corregeix la paret de la porta d'entrada i baixa 90 el passadís i les habitacions: és una correcció de la persona,
  // per tant passa per davant de les mides que s'haguessin editat abans (els colors de les parets es conserven)
  if (from < 26) {
    delete s.roomsEdited;
    // els mobles es queden a la mateixa habitació: el que hi ha a la meitat de la terrassa del menjador i tot el que és més avall baixa 90
    // (la taula, les cadires i la tele, a prop de la cuina i de la porta, es queden on són)
    for (const it of s.items || []) if (it.z > 380 && !(it.x < 270 && it.z < 640)) it.z += 90;
  }
  if (s.roomsEdited && Array.isArray(s.rooms) && s.rooms.length) {
    // l'usuari ha canviat mides de parets o d'habitacions: es conserven i només s'hi afegeixen les habitacions noves
    const have = new Set(s.rooms.map((r) => r.id));
    for (const r of fresh.rooms) if (!have.has(r.id)) s.rooms.push(r);
  } else {
    // es conserva el color de les parets pintades
    const paint = Object.fromEntries((s.rooms || []).filter((r) => r.walls).map((r) => [r.id, r.walls]));
    for (const r of fresh.rooms) if (paint[r.id]) r.walls = paint[r.id];
    s.rooms = fresh.rooms;
  }
  s.version = fresh.version;
  s.items = s.items || [];
  for (const it of s.items) {
    const r = roomAt(s.rooms, it.x, it.z);
    it.roomId = r ? r.id : (s.rooms.find((x) => x.kind === 'room') || {}).id;
  }
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

