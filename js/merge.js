// Fusió de l'estat quan dues persones editen alhora des de dos dispositius.
// base = l'últim estat que els dos tenien en comú; local = el d'aquest dispositiu; remote = el que arriba del núvol.
// Es decideix moble a moble: qui l'ha canviat, guanya; si l'han canviat tots dos, guanya el local (és el que estàs veient).

import { mergeById } from './social.js?v=43';

const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const byId = (list) => Object.fromEntries((list || []).map((i) => [i.id, i]));

export function mergeStates(base, local, remote) {
  if (!base || !local) return remote;
  if (!remote) return local;
  const out = {};
  for (const k of new Set([...Object.keys(remote), ...Object.keys(local)])) {
    if (k === 'items') continue;
    if (k === 'log' || k === 'saved') { out[k] = mergeById(base[k], local[k], remote[k]); if (!out[k].length) delete out[k]; continue; } // historial i propostes: s'ajunten
    const lc = !same(base[k], local[k]), rc = !same(base[k], remote[k]);
    out[k] = lc && !rc ? local[k] : remote[k];
  }
  const B = byId(base.items), L = byId(local.items), R = byId(remote.items);
  const ids = [...(remote.items || []).map((i) => i.id), ...(local.items || []).map((i) => i.id).filter((id) => !R[id])];
  const items = [];
  for (const id of ids) {
    const b = B[id], l = L[id], r = R[id];
    const lc = !same(b, l), rc = !same(b, r);
    if (!lc) { if (r) items.push(r); continue; }
    if (!rc) { if (l) items.push(l); continue; }
    if (l && r) { // tots dos l'han canviat: guanya el local, però les notes i els vots de l'altre no es perden
      const notes = [...new Map([...(r.notes || []), ...(l.notes || [])].map((n) => [n.id, n])).values()].sort((a, b) => a.at - b.at);
      const bn = new Set((b?.notes || []).map((n) => n.id)), ln = new Set((l.notes || []).map((n) => n.id));
      const kept = notes.filter((n) => !(bn.has(n.id) && !ln.has(n.id))); // les que s'han esborrat aquí, esborrades
      const m = { ...l };
      if (kept.length) m.notes = kept; else delete m.notes;
      if (r.votes || l.votes) m.votes = { ...(r.votes || {}), ...(l.votes || {}) };
      items.push(m);
    } else items.push(l || r);
  }
  out.items = items;
  return out;
}
