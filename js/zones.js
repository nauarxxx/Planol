// Zones de pas i d'ús: l'espai lliure que necessita cada moble per fer-lo servir (obrir un armari o una nevera,
// treure una cadira, pujar al llit, seure al vàter…). Cada zona és un rectangle en coordenades locals del moble
// (el davant és +Z) i es comprova que no hi hagi cap moble, pilar ni paret a dins.
import { CATALOG } from './furniture.js?v=43';
import { aabb, innerRect, roomAt, structItems, allOpenings, openingsOnRoom, DEG } from './geom.js?v=43';

const front = (it, need, label, extra = {}) => ({ x0: -it.w / 2, x1: it.w / 2, z0: it.d / 2, z1: it.d / 2 + need, dir: [0, 1], need, label, ...extra });
const back = (it, need, label, extra = {}) => ({ x0: -it.w / 2, x1: it.w / 2, z0: -it.d / 2 - need, z1: -it.d / 2, dir: [0, -1], need, label, ...extra });
const side = (it, s, need, label, z0, z1, extra = {}) => (s < 0
  ? { x0: -it.w / 2 - need, x1: -it.w / 2, z0, z1, dir: [-1, 0], need, label, ...extra }
  : { x0: it.w / 2, x1: it.w / 2 + need, z0, z1, dir: [1, 0], need, label, ...extra });

// Zones de cada tipus de moble. any: n'hi ha prou que una zona del mateix grup estigui lliure.
export function useZones(it) {
  const { w, d } = it;
  switch (it.type) {
    case 'cama': {
      const z0 = -d / 2 + 45, z1 = d / 2; // a la capçalera hi van les tauletes
      if (w >= 120) return [side(it, -1, 55, 'Costat esquerre del llit', z0, z1), side(it, 1, 55, 'Costat dret del llit', z0, z1), front(it, 50, 'Peus del llit')];
      return [side(it, -1, 55, 'Un costat per pujar al llit', z0, z1, { any: 'llit' }), side(it, 1, 55, 'Un costat per pujar al llit', z0, z1, { any: 'llit' })];
    }
    case 'litera': return [side(it, -1, 60, 'Un costat per pujar a la llitera', -d / 2, d / 2, { any: 'llit' }), side(it, 1, 60, 'Un costat per pujar a la llitera', -d / 2, d / 2, { any: 'llit' })];
    case 'armario': return [front(it, 70, 'Davant (obrir les portes)')];
    case 'comoda': return [front(it, 55, 'Davant (obrir els calaixos)')];
    case 'mesita': return [front(it, 35, 'Davant (obrir el calaix)')];
    case 'estanteria': return [front(it, 50, 'Davant (agafar coses)')];
    case 'escritorio': return [front(it, 75, 'Lloc per a la cadira', { ignore: ['silla', 'sillon'] })];
    case 'silla': return [back(it, 35, 'Darrere (per treure la cadira)', { ignore: ['mesa', 'escritorio'] })];
    case 'sofa': return [front(it, 35, 'Davant (per a les cames)')];
    case 'sillon': return [front(it, 35, 'Davant (per a les cames)')];
    case 'nevera': return [front(it, 80, 'Davant (obrir la porta)')];
    case 'rentadora': return [front(it, 65, 'Davant (carregar la roba)')];
    case 'encimera': case 'encimeraPica': case 'encimeraPlaca': return [front(it, 80, 'Espai per cuinar')];
    case 'lavabo': return [front(it, 60, 'Davant (rentar-se)')];
    case 'vater': return [front(it, 55, 'Davant (seure)')];
    case 'banyera': return [front(it, 55, 'Per entrar a la banyera')];
    case 'llarFoc': return it.shape === 'cantonera' ? [] : [front(it, 60, 'Distància de seguretat del foc')];
    default: return [];
  }
}

// Rectangle local → caixa en planta (món) segons la posició i el gir del moble.
function worldBox(it, z) {
  const a = (it.rot || 0) * DEG, c = Math.cos(a), s = Math.sin(a);
  const xs = [], zs = [];
  for (const [x, y] of [[z.x0, z.z0], [z.x1, z.z0], [z.x1, z.z1], [z.x0, z.z1]]) { xs.push(it.x + x * c + y * s); zs.push(it.z - x * s + y * c); }
  return { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) };
}
// La mateixa zona però només amb «t» cm de fons (per saber quant espai hi ha de debò).
function shrink(z, t) {
  const o = { ...z };
  if (z.dir[0] > 0) o.x1 = z.x0 + t; else if (z.dir[0] < 0) o.x0 = z.x1 - t;
  if (z.dir[1] > 0) o.z1 = z.z0 + t; else if (z.dir[1] < 0) o.z0 = z.z1 - t;
  return o;
}

// Comprova totes les zones d'un moble. Torna [{label, need, have, ok, box, local}] (agrupant les «any»).
export function checkZones(it, st) {
  const zones = useZones(it);
  if (!zones.length) return [];
  const t = st.wallThickness || 10;
  const room = st.rooms.find((r) => r.id === it.roomId);
  const R = room ? innerRect(room, t) : null;
  const opens = room ? openingsOnRoom(room, allOpenings(st.rooms)).filter((o) => o.type === 'paso' || o.type === 'puerta' || o.type === 'ventanal') : [];
  const pillars = structItems(st.rooms).filter((s) => s.kind === 'pillar').map((s) => ({ box: aabb(s), type: 'pillar' }));
  const others = st.items.filter((o) => o.id !== it.id && o.type !== 'alfombra' && (o.elev || 0) < 120).map((o) => ({ box: aabb(o), type: o.type }));
  const hit = (b, ignore) => {
    for (const o of others.concat(pillars)) {
      if (ignore?.includes(o.type)) continue;
      if (Math.min(b.x1, o.box.x1) - Math.max(b.x0, o.box.x0) > 1 && Math.min(b.z1, o.box.z1) - Math.max(b.z0, o.box.z0) > 1) return true;
    }
    if (!R) return false;
    // fora de l'habitació només es pot passar per un pas, una porta o un finestral
    const out = [['W', b.x0 < R.x0 - 1, 'z'], ['E', b.x1 > R.x1 + 1, 'z'], ['N', b.z0 < R.z0 - 1, 'x'], ['S', b.z1 > R.z1 + 1, 'x']];
    for (const [wall, isOut, ax] of out) {
      if (!isOut) continue;
      const lo = ax === 'z' ? b.z0 : b.x0, hi = ax === 'z' ? b.z1 : b.x1;
      if (!opens.some((o) => o.wall === wall && o.a <= lo + 1 && o.b >= hi - 1)) return true;
      const px = wall === 'W' ? b.x0 + 1 : wall === 'E' ? b.x1 - 1 : (b.x0 + b.x1) / 2, pz = wall === 'N' ? b.z0 + 1 : wall === 'S' ? b.z1 - 1 : (b.z0 + b.z1) / 2;
      const r2 = roomAt(st.rooms, px, pz);
      if (!r2 || r2.kind === 'pillar' || r2.kind === 'void') return true;
    }
    return false;
  };
  const res = zones.map((z) => {
    let have = 0;
    if (!hit(worldBox(it, z), z.ignore)) have = z.need;
    else for (let d = z.need - 5; d >= 5; d -= 5) if (!hit(worldBox(it, shrink(z, d)), z.ignore)) { have = d; break; }
    return { label: z.label, need: z.need, have, ok: have >= z.need - 0.5, local: z, any: z.any };
  });
  // grups «any»: si una de les zones del grup està lliure, el grup és correcte (i es mostra només la millor)
  const out = [], seen = new Set();
  for (const r of res) {
    if (!r.any) { out.push(r); continue; }
    if (seen.has(r.any)) continue; seen.add(r.any);
    const grp = res.filter((x) => x.any === r.any).sort((a, b) => b.have - a.have);
    out.push({ ...grp[0], alts: grp });
  }
  return out;
}

export const hasZones = (it) => useZones(it).length > 0 && !(CATALOG[it.type]?.mount);
