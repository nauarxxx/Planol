// Estat desat: càrrega des del dispositiu i actualització quan el plànol per defecte és més nou.
import { DEFAULT_PLAN } from './plan.js?v=35';
import { roomAt } from './geom.js?v=35';

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
  s.rooms = fresh.rooms;
  s.version = fresh.version;
  s.items = s.items || [];
  for (const it of s.items) {
    const r = roomAt(s.rooms, it.x, it.z);
    it.roomId = r ? r.id : (s.rooms.find((x) => x.kind === 'room') || {}).id;
  }
  // mobles fixos del plànol (p. ex. els de la cuina) que encara no hi siguin, tret dels que l'usuari hagi esborrat expressament
  const removed = new Set(s.removedFixed || []);
  for (const it of fresh.items || []) if (!removed.has(it.id) && !s.items.some((x) => x.id === it.id)) s.items.push(clone(it));
  return s;
}

