// Miniatura en planta d'una estança amb els seus mobles (targetes de propostes, comparació, propostes desades).
import { corners, allOpenings, allSwings, swingArc, DEG } from './geom.js?v=41';

export function drawPreview(cv, room, p, items, rooms) {
  const ctx = cv.getContext('2d');
  const pad = 14;
  const s = Math.min((cv.width - 2 * pad) / room.w, (cv.height - 2 * pad) / room.d);
  const ox = (cv.width - room.w * s) / 2 - room.x * s, oz = (cv.height - room.d * s) / 2 - room.z * s;
  const X = (x) => ox + x * s, Z = (z) => oz + z * s;
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.fillStyle = room.color || '#c89b6a';
  ctx.globalAlpha = 0.35;
  ctx.fillRect(X(room.x), Z(room.z), room.w * s, room.d * s);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = '#2b2926'; ctx.lineWidth = 3;
  ctx.strokeRect(X(room.x), Z(room.z), room.w * s, room.d * s);
  // huecos
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4;
  for (const o of allOpenings(rooms)) {
    const edge = o.axis === 'x' ? [room.z, room.z + room.d] : [room.x, room.x + room.w];
    if (!edge.some((l) => Math.abs(l - o.line) < 1)) continue;
    const lim = o.axis === 'x' ? [room.x, room.x + room.w] : [room.z, room.z + room.d];
    const a = Math.max(o.a, lim[0]), b = Math.min(o.b, lim[1]);
    if (b <= a) continue;
    ctx.strokeStyle = o.type === 'ventana' || o.type === 'ventanal' ? '#7fb2d0' : '#ffffff';
    ctx.lineWidth = o.type === 'ventanal' ? 7 : 4;
    ctx.beginPath();
    if (o.axis === 'x') { ctx.moveTo(X(a), Z(o.line)); ctx.lineTo(X(b), Z(o.line)); }
    else { ctx.moveTo(X(o.line), Z(a)); ctx.lineTo(X(o.line), Z(b)); }
    ctx.stroke();
    if (o.type === 'ventanal') { // montante central del ventanal doble
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.beginPath();
      const m = (a + b) / 2;
      if (o.axis === 'x') { ctx.moveTo(X(m), Z(o.line) - 4); ctx.lineTo(X(m), Z(o.line) + 4); }
      else { ctx.moveTo(X(o.line) - 4, Z(m)); ctx.lineTo(X(o.line) + 4, Z(m)); }
      ctx.stroke();
    }
  }
  // batents de les portes
  ctx.strokeStyle = 'rgba(90,60,30,.7)'; ctx.lineWidth = 1;
  for (const sw of allSwings(rooms)) {
    if (sw.x1 < room.x || sw.x0 > room.x + room.w || sw.z1 < room.z || sw.z0 > room.z + room.d) continue;
    const arc = swingArc(sw, 10);
    ctx.beginPath(); ctx.moveTo(X(sw.hx), Z(sw.hz));
    arc.forEach(([x, z]) => ctx.lineTo(X(x), Z(z)));
    ctx.closePath(); ctx.stroke();
  }
  const its = items.map((i) => ({ ...i, ...(p.placements[i.id] || {}) }));
  its.sort((a, b) => (a.type === 'alfombra' ? -1 : 0) - (b.type === 'alfombra' ? -1 : 0) || (a.elev || 0) - (b.elev || 0));
  for (const it of its) {
    const cs = corners(it);
    ctx.beginPath();
    cs.forEach(([x, z], k) => (k ? ctx.lineTo(X(x), Z(z)) : ctx.moveTo(X(x), Z(z))));
    ctx.closePath();
    ctx.fillStyle = it.color; ctx.globalAlpha = it.type === 'alfombra' ? 0.5 : 0.95; ctx.fill(); ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = 1; ctx.stroke();
    // marca del frente
    const f = { x: Math.sin(it.rot * DEG), z: Math.cos(it.rot * DEG) };
    ctx.strokeStyle = '#d9864d'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(X(it.x), Z(it.z));
    ctx.lineTo(X(it.x + f.x * (it.d / 2)), Z(it.z + f.z * (it.d / 2))); ctx.stroke();
  }
}
