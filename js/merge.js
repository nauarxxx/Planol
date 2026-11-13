// Fusió de l'estat quan dues persones editen alhora des de dos dispositius.
// base = l'últim estat que els dos tenien en comú; local = el d'aquest dispositiu; remote = el que arriba del núvol.
// Es decideix moble a moble: qui l'ha canviat, guanya; si l'han canviat tots dos, guanya el local (és el que estàs veient).

const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const byId = (list) => Object.fromEntries((list || []).map((i) => [i.id, i]));

export function mergeStates(base, local, remote) {
  if (!base || !local) return remote;
  if (!remote) return local;
  const out = {};
  for (const k of new Set([...Object.keys(remote), ...Object.keys(local)])) {
    if (k === 'items') continue;
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
    items.push(l || r);
  }
  out.items = items;
  return out;
}
