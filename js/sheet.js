// Plànol en 2D sobre un canvas (per comparar escenes i per imprimir / desar en PDF), amb cotes.
import { corners, allOpenings, allSwings, swingArc, DEG } from './geom.js?v=40';
import { CATALOG } from './furniture.js?v=40';

// Dibuixa el plànol complet. opts: { items, cotes, labels, furnitureDims, pad, bg, highlight }
export function drawPlan(cv, st, opts = {}) {
  const items = opts.items || st.items;
  const rooms = st.rooms;
  const ctx = cv.getContext('2d');
  const pad = opts.pad ?? 50;
  const xs = rooms.map((r) => r.x), xe = rooms.map((r) => r.x + r.w), zs = rooms.map((r) => r.z), ze = rooms.map((r) => r.z + r.d);
  const bx0 = Math.min(...xs), bx1 = Math.max(...xe), bz0 = Math.min(...zs), bz1 = Math.max(...ze);
  const s = Math.min((cv.width - 2 * pad) / (bx1 - bx0), (cv.height - 2 * pad) / (bz1 - bz0));
  const ox = (cv.width - (bx1 - bx0) * s) / 2 - bx0 * s, oz = (cv.height - (bz1 - bz0) * s) / 2 - bz0 * s;
  const X = (x) => ox + x * s, Z = (z) => oz + z * s;
  const fs = Math.max(9, Math.min(14, cv.width / 60));
  ctx.fillStyle = opts.bg || '#ffffff';
  ctx.fillRect(0, 0, cv.width, cv.height);

  // terres
  for (const r of rooms) {
    if (r.kind === 'void') { ctx.fillStyle = '#8a8e93'; ctx.fillRect(X(r.x), Z(r.z), r.w * s, r.d * s); continue; }
    if (r.kind === 'pillar' || r.kind === 'beam') { ctx.fillStyle = r.kind === 'pillar' ? '#2b2926' : 'rgba(43,41,38,.35)'; ctx.fillRect(X(r.x), Z(r.z), r.w * s, r.d * s); continue; }
    ctx.fillStyle = r.color || '#c89b6a'; ctx.globalAlpha = 0.28;
    if (r.kind === 'terrace' && r.d2 > 0 && r.d2 < r.d) {
      ctx.beginPath(); ctx.moveTo(X(r.x), Z(r.z)); ctx.lineTo(X(r.x + r.w), Z(r.z + r.d - r.d2)); ctx.lineTo(X(r.x + r.w), Z(r.z + r.d)); ctx.lineTo(X(r.x), Z(r.z + r.d)); ctx.closePath(); ctx.fill();
    } else ctx.fillRect(X(r.x), Z(r.z), r.w * s, r.d * s);
    ctx.globalAlpha = 1;
  }
  // parets
  const t = st.wallThickness || 10;
  ctx.lineWidth = Math.max(2, t * s * 0.8); ctx.strokeStyle = '#2b2926'; ctx.lineJoin = 'miter';
  for (const r of rooms) {
    if (r.kind === 'void' || r.kind === 'pillar' || r.kind === 'beam') continue;
    if (r.kind === 'terrace') { ctx.setLineDash([6, 4]); ctx.lineWidth = 1.5; } else { ctx.setLineDash([]); ctx.lineWidth = Math.max(2, t * s * 0.8); }
    if (r.kind === 'terrace' && r.d2 > 0 && r.d2 < r.d) {
      ctx.beginPath(); ctx.moveTo(X(r.x), Z(r.z)); ctx.lineTo(X(r.x + r.w), Z(r.z + r.d - r.d2)); ctx.lineTo(X(r.x + r.w), Z(r.z + r.d)); ctx.lineTo(X(r.x), Z(r.z + r.d)); ctx.closePath(); ctx.stroke();
    } else ctx.strokeRect(X(r.x), Z(r.z), r.w * s, r.d * s);
  }
  ctx.setLineDash([]);
  // obertures
  for (const o of allOpenings(rooms)) {
    const win = o.type === 'ventana' || o.type === 'ventanal';
    ctx.strokeStyle = win ? '#5a9fcc' : '#ffffff';
    ctx.lineWidth = Math.max(2, t * s * 0.8) + (win ? 0 : 1);
    ctx.beginPath();
    if (o.axis === 'x') { ctx.moveTo(X(o.a), Z(o.line)); ctx.lineTo(X(o.b), Z(o.line)); } else { ctx.moveTo(X(o.line), Z(o.a)); ctx.lineTo(X(o.line), Z(o.b)); }
    ctx.stroke();
    if (win) {
      ctx.strokeStyle = '#2b2926'; ctx.lineWidth = 1; ctx.beginPath();
      if (o.axis === 'x') { ctx.moveTo(X(o.a), Z(o.line)); ctx.lineTo(X(o.b), Z(o.line)); } else { ctx.moveTo(X(o.line), Z(o.a)); ctx.lineTo(X(o.line), Z(o.b)); }
      ctx.stroke();
    }
  }
  // batents
  ctx.strokeStyle = '#6b5234'; ctx.lineWidth = 1;
  for (const sw of allSwings(rooms)) {
    const arc = swingArc(sw, 12);
    ctx.beginPath(); ctx.moveTo(X(sw.hx), Z(sw.hz)); arc.forEach(([x, z]) => ctx.lineTo(X(x), Z(z))); ctx.closePath(); ctx.stroke();
  }
  // mobles
  const sorted = [...items].sort((a, b) => (a.type === 'alfombra' ? -1 : 0) - (b.type === 'alfombra' ? -1 : 0) || (a.elev || 0) - (b.elev || 0));
  ctx.font = `${fs - 2}px system-ui, sans-serif`;
  for (const it of sorted) {
    const cs = corners(it);
    ctx.beginPath(); cs.forEach(([x, z], k) => (k ? ctx.lineTo(X(x), Z(z)) : ctx.moveTo(X(x), Z(z)))); ctx.closePath();
    ctx.fillStyle = it.color || '#999'; ctx.globalAlpha = it.type === 'alfombra' ? 0.45 : 0.9; ctx.fill(); ctx.globalAlpha = 1;
    ctx.strokeStyle = opts.highlight && opts.highlight.has(it.id) ? '#d32f2f' : 'rgba(0,0,0,.6)'; ctx.lineWidth = opts.highlight && opts.highlight.has(it.id) ? 2 : 1; ctx.stroke();
    const f = { x: Math.sin((it.rot || 0) * DEG), z: Math.cos((it.rot || 0) * DEG) };
    ctx.strokeStyle = '#d9864d'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(X(it.x), Z(it.z)); ctx.lineTo(X(it.x + f.x * it.d / 2), Z(it.z + f.z * it.d / 2)); ctx.stroke();
    if (opts.furnitureDims !== false && it.w * s > 28 && it.d * s > 14) {
      ctx.fillStyle = '#111'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const lines = [it.name, `${it.w}×${it.d}`];
      const hgt = fs - 2;
      lines.forEach((l, i) => { if (ctx.measureText(l).width < Math.max(it.w, it.d) * s - 4) ctx.fillText(l, X(it.x), Z(it.z) + (i - 0.5) * hgt); });
    }
  }
  // noms i cotes de les habitacions
  ctx.font = `600 ${fs}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const r of rooms) {
    if (opts.labels !== false) {
      ctx.fillStyle = r.kind === 'void' ? '#fff' : '#2b2926';
      ctx.fillText(r.name, X(r.x + r.w / 2), Z(r.z + r.d / 2) - (opts.cotes ? fs * 0.7 : 0));
      if (opts.cotes) { ctx.font = `${fs - 2}px system-ui, sans-serif`; ctx.fillStyle = '#555'; ctx.fillText(`${r.w} × ${r.d} cm`, X(r.x + r.w / 2), Z(r.z + r.d / 2) + fs * 0.7); ctx.font = `600 ${fs}px system-ui, sans-serif`; }
    }
  }
  if (opts.cotes) {
    // línies de cota exteriors: amplada a dalt de cada habitació i fons a l'esquerra, fora del plànol quan es pot
    ctx.strokeStyle = '#1e88e5'; ctx.fillStyle = '#1e88e5'; ctx.lineWidth = 1; ctx.font = `${fs - 2}px system-ui, sans-serif`;
    const dim = (x1, z1, x2, z2, label, side) => {
      const off = 14, tick = 4;
      const nx = side === 'h' ? 0 : -1, nz = side === 'h' ? -1 : 0;
      const ax = X(x1) + nx * off, az = Z(z1) + nz * off, bx = X(x2) + nx * off, bz = Z(z2) + nz * off;
      ctx.beginPath(); ctx.moveTo(ax, az); ctx.lineTo(bx, bz);
      ctx.moveTo(ax - nz * tick, az + nx * tick); ctx.lineTo(ax + nz * tick, az - nx * tick);
      ctx.moveTo(bx - nz * tick, bz + nx * tick); ctx.lineTo(bx + nz * tick, bz - nx * tick);
      ctx.stroke();
      ctx.save(); ctx.translate((ax + bx) / 2 + nx * 8, (az + bz) / 2 + nz * 8);
      if (side === 'v') ctx.rotate(-Math.PI / 2);
      ctx.fillText(label, 0, 0); ctx.restore();
    };
    const done = new Set();
    for (const r of rooms) {
      if (r.kind === 'void' || r.kind === 'pillar' || r.kind === 'beam') continue;
      const topFree = !rooms.some((o) => o !== r && o.z + o.d <= r.z + 1 && o.z + o.d > r.z - 40 && o.x < r.x + r.w && o.x + o.w > r.x);
      const leftFree = !rooms.some((o) => o !== r && o.x + o.w <= r.x + 1 && o.x + o.w > r.x - 40 && o.z < r.z + r.d && o.z + o.d > r.z);
      const kw = 'w' + r.x + ',' + r.z + ',' + r.w, kd = 'd' + r.x + ',' + r.z + ',' + r.d;
      if (topFree && !done.has(kw)) { done.add(kw); dim(r.x, r.z, r.x + r.w, r.z, r.w + '', 'h'); }
      if (leftFree && !done.has(kd)) { done.add(kd); dim(r.x, r.z + r.d, r.x, r.z, r.d + '', 'v'); }
    }
  }
  return { s, X, Z };
}

const esc = (x) => String(x ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Prepara la fulla imprimible (#print-sheet) i obre el diàleg d'impressió: «Desa com a PDF».
export function printSheet(st, opts = {}) {
  const sheet = document.getElementById('print-sheet');
  const cv = document.createElement('canvas');
  cv.width = 2000;
  // proporció segons el plànol
  const xs = st.rooms.map((r) => r.x), xe = st.rooms.map((r) => r.x + r.w), zs = st.rooms.map((r) => r.z), ze = st.rooms.map((r) => r.z + r.d);
  const W = Math.max(...xe) - Math.min(...xs), D = Math.max(...ze) - Math.min(...zs);
  cv.height = Math.round(cv.width * D / W) + 160;
  drawPlan(cv, st, { cotes: true, pad: 80, bg: '#ffffff' });
  const rooms = st.rooms.filter((r) => !['void', 'pillar', 'beam'].includes(r.kind));
  const byRoom = rooms.map((r) => ({ r, its: st.items.filter((i) => i.roomId === r.id) })).filter((x) => x.its.length);
  const date = new Date().toLocaleDateString('ca', { day: 'numeric', month: 'long', year: 'numeric' });
  sheet.innerHTML = `
    <h1>${esc(opts.title || 'Planta 3D · Mobles a mida')}</h1>
    <p class="meta">${date} · mides en cm · sostre ${st.ceiling} cm${st.ceilingEstimated ? ' (estimat)' : ''} · parets de ${st.wallThickness} cm · superfície interior ${(rooms.filter((r) => r.kind === 'room').reduce((a, r) => a + r.w * r.d, 0) / 10000).toFixed(2)} m²</p>
    <img src="${cv.toDataURL('image/png')}" alt="Plànol" />
    <h2>Habitacions</h2>
    <table><thead><tr><th>Habitació</th><th>Amplada</th><th>Fons</th><th>m²</th><th>Obertures</th></tr></thead><tbody>
      ${rooms.map((r) => `<tr><td>${esc(r.name)}${r.estimated ? ' *' : ''}</td><td>${r.w}</td><td>${r.d}${r.d2 ? ' / ' + r.d2 : ''}</td><td>${(r.w * r.d / 10000).toFixed(2)}</td><td>${(r.openings || []).map((o) => `${{ puerta: 'porta', ventana: 'finestra', ventanal: 'finestral', paso: 'pas' }[o.type] || o.type} ${o.width} (${{ N: 'dalt', S: 'baix', E: 'dreta', W: 'esq.' }[o.wall]}, a ${o.offset})`).join(' · ') || '—'}</td></tr>`).join('')}
    </tbody></table>
    <p class="meta">* mides estimades (no surten al plànol de l’arquitecte).</p>
    ${byRoom.length ? `<h2>Mobles</h2>
    <table><thead><tr><th>Habitació</th><th>Moble</th><th>Tipus</th><th>Amplada</th><th>Fons</th><th>Alçada</th><th>Posició (x, z)</th><th>Gir</th></tr></thead><tbody>
      ${byRoom.map(({ r, its }) => its.map((i, k) => `<tr>${k === 0 ? `<td rowspan="${its.length}">${esc(r.name)}</td>` : ''}<td>${esc(i.name)}</td><td>${esc(CATALOG[i.type]?.label || i.type)}</td><td>${i.w}</td><td>${i.d}</td><td>${i.h}${i.elev ? ` (+${i.elev})` : ''}</td><td>${i.x}, ${i.z}</td><td>${i.rot || 0}°</td></tr>`).join('')).join('')}
    </tbody></table>` : ''}
    <p class="meta">Fet amb Planta 3D · ${location.host}${location.pathname}</p>`;
  document.body.classList.add('printing');
  const done = () => { document.body.classList.remove('printing'); window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  setTimeout(() => { try { window.print(); } catch (e) { done(); } setTimeout(done, 60000); }, 150);
}

// ---------------------------------------------------------------- plànol a escala (1:50, 1:75, 1:100) per imprimir
// Fa un SVG amb mides reals en mil·límetres: a 1:50, 1 m del pis = 2 cm al paper. Porta un regle per comprovar-ho.
const PAPER = { A4: [297, 210], A3: [420, 297] };
const MARGIN = 10, TITLE_H = 16;
function bounds(st, roomId) {
  const rs = roomId ? st.rooms.filter((r) => r.id === roomId) : st.rooms;
  return { x0: Math.min(...rs.map((r) => r.x)), x1: Math.max(...rs.map((r) => r.x + r.w)), z0: Math.min(...rs.map((r) => r.z)), z1: Math.max(...rs.map((r) => r.z + r.d)) };
}
// Escala més gran (més detall) que hi cap al paper triat; torna també l'orientació.
export function fitScale(st, paper = 'A4', roomId = null) {
  const b = bounds(st, roomId), W = b.x1 - b.x0 + 120, D = b.z1 - b.z0 + 120; // marge per a les cotes
  for (const k of [20, 25, 50, 75, 100, 150, 200]) {
    for (const land of [true, false]) {
      const [pw, ph] = land ? PAPER[paper] : [...PAPER[paper]].reverse();
      if (W * 10 / k <= pw - 2 * MARGIN && D * 10 / k <= ph - 2 * MARGIN - TITLE_H) return { scale: k, landscape: land };
    }
  }
  return { scale: 200, landscape: true };
}
export function scaleSvg(st, { scale = 50, paper = 'A4', landscape = true, roomId = null, items = true } = {}) {
  const b = bounds(st, roomId), pad = 60;
  const x0 = b.x0 - pad, z0 = b.z0 - pad, W = b.x1 - b.x0 + 2 * pad, D = b.z1 - b.z0 + 2 * pad;
  const mm = (cm) => (cm * 10 / scale).toFixed(2);
  const fs = (pt) => (pt * 0.3528 * scale / 10).toFixed(1); // mida de lletra en cm reals per a «pt» punts al paper
  const t = st.wallThickness || 10, out = [];
  const rooms = st.rooms.filter((r) => !roomId || r.id === roomId || (r.kind === 'pillar' || r.kind === 'beam'));
  const inView = (r) => r.x < b.x1 + pad && r.x + r.w > b.x0 - pad && r.z < b.z1 + pad && r.z + r.d > b.z0 - pad;
  for (const r of rooms.filter(inView)) {
    if (r.kind === 'pillar') { out.push(`<rect x="${r.x}" y="${r.z}" width="${r.w}" height="${r.d}" fill="#2b2926"/>`); continue; }
    if (r.kind === 'beam') { out.push(`<rect x="${r.x}" y="${r.z}" width="${r.w}" height="${r.d}" fill="none" stroke="#2b2926" stroke-width="1.5" stroke-dasharray="8 6"/>`); continue; }
    if (r.kind === 'void') { out.push(`<rect x="${r.x}" y="${r.z}" width="${r.w}" height="${r.d}" fill="#c8c8c8"/>`); continue; }
    const terr = r.kind === 'terrace';
    const shape = terr && r.d2 > 0 && r.d2 < r.d ? `<polygon points="${r.x},${r.z} ${r.x + r.w},${r.z + r.d - r.d2} ${r.x + r.w},${r.z + r.d} ${r.x},${r.z + r.d}"` : `<rect x="${r.x}" y="${r.z}" width="${r.w}" height="${r.d}"`;
    out.push(`${shape} fill="${terr ? '#f4e6dc' : '#f7f4ee'}" stroke="#2b2926" stroke-width="${terr ? 1.5 : t}" ${terr ? 'stroke-dasharray="10 6"' : ''}/>`);
  }
  for (const o of allOpenings(st.rooms)) {
    const win = o.type === 'ventana' || o.type === 'ventanal';
    const [ax, az, bx, bz] = o.axis === 'x' ? [o.a, o.line, o.b, o.line] : [o.line, o.a, o.line, o.b];
    if (!(Math.max(ax, bx) > b.x0 - pad && Math.min(ax, bx) < b.x1 + pad && Math.max(az, bz) > b.z0 - pad && Math.min(az, bz) < b.z1 + pad)) continue;
    out.push(`<line x1="${ax}" y1="${az}" x2="${bx}" y2="${bz}" stroke="${win ? '#cfe6f5' : '#ffffff'}" stroke-width="${t + 1.5}"/>`);
    if (win) out.push(`<line x1="${ax}" y1="${az}" x2="${bx}" y2="${bz}" stroke="#2b2926" stroke-width="1"/>`);
  }
  for (const sw of allSwings(st.rooms)) {
    const arc = swingArc(sw, 16);
    out.push(`<path d="M${sw.hx},${sw.hz} ${arc.map(([x, z]) => `L${x.toFixed(1)},${z.toFixed(1)}`).join(' ')} Z" fill="none" stroke="#6b5234" stroke-width="0.8"/>`);
  }
  if (items) {
    const its = [...st.items].filter((i) => !roomId || i.roomId === roomId).sort((a, c) => (a.type === 'alfombra' ? -1 : 0) - (c.type === 'alfombra' ? -1 : 0) || (a.elev || 0) - (c.elev || 0));
    for (const it of its) {
      const cs = corners(it);
      out.push(`<polygon points="${cs.map(([x, z]) => `${x.toFixed(1)},${z.toFixed(1)}`).join(' ')}" fill="${esc(it.color || '#999')}" fill-opacity="${it.type === 'alfombra' ? 0.25 : 0.35}" stroke="#222" stroke-width="0.8" ${(it.elev || 0) >= 100 ? 'stroke-dasharray="4 3"' : ''}/>`);
      const f = { x: Math.sin((it.rot || 0) * DEG), z: Math.cos((it.rot || 0) * DEG) };
      out.push(`<line x1="${it.x}" y1="${it.z}" x2="${(it.x + f.x * it.d / 2).toFixed(1)}" y2="${(it.z + f.z * it.d / 2).toFixed(1)}" stroke="#d9864d" stroke-width="1"/>`);
      const big = Math.max(it.w, it.d), small = Math.min(it.w, it.d), fsz = +fs(6);
      if (big > fsz * 4 && small > fsz * 1.6) {
        const rot = it.d > it.w * 1.3 ? ((it.rot || 0) % 180 === 0 ? -90 : 0) : ((it.rot || 0) % 180 === 0 ? 0 : -90);
        out.push(`<g transform="translate(${it.x},${it.z}) rotate(${rot})" font-size="${fsz}" text-anchor="middle"><text y="${-fsz * 0.15}" font-weight="600">${esc(it.name)}</text><text y="${fsz * 1.05}">${it.w}×${it.d}×${it.h}</text></g>`);
      }
    }
  }
  // noms, superfície i cotes de les habitacions
  const f9 = fs(9), f7 = fs(7);
  for (const r of rooms.filter(inView)) {
    if (['void', 'pillar', 'beam'].includes(r.kind)) continue;
    out.push(`<g text-anchor="middle"><text x="${r.x + r.w / 2}" y="${r.z + 14 + +f9}" font-size="${f9}" font-weight="700">${esc(r.name)}</text><text x="${r.x + r.w / 2}" y="${r.z + 16 + 2 * +f9}" font-size="${f7}" fill="#555">${r.w} × ${r.d} cm · ${(r.w * r.d / 10000).toFixed(2)} m²</text></g>`);
  }
  const dim = (ax, az, bx, bz, label, nx, nz) => {
    const off = 22, tk = 6, x1 = ax + nx * off, y1 = az + nz * off, x2 = bx + nx * off, y2 = bz + nz * off;
    const vert = ax === bx;
    return `<g stroke="#1e66b0" stroke-width="0.8"><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/><line x1="${x1 - nz * tk}" y1="${y1 - nx * tk}" x2="${x1 + nz * tk}" y2="${y1 + nx * tk}"/><line x1="${x2 - nz * tk}" y1="${y2 - nx * tk}" x2="${x2 + nz * tk}" y2="${y2 + nx * tk}"/></g><text font-size="${f7}" fill="#1e66b0" text-anchor="middle" transform="translate(${(x1 + x2) / 2 + nx * 6},${(y1 + y2) / 2 + nz * 6}) ${vert ? 'rotate(-90)' : ''}">${label}</text>`;
  };
  const done = new Set();
  for (const r of rooms.filter(inView)) {
    if (['void', 'pillar', 'beam'].includes(r.kind)) continue;
    const kw = `w${r.x},${r.z},${r.w}`, kd = `d${r.x},${r.z},${r.d}`;
    if (!done.has(kw)) { done.add(kw); out.push(dim(r.x, r.z, r.x + r.w, r.z, r.w, 0, -1)); }
    if (!done.has(kd)) { done.add(kd); out.push(dim(r.x, r.z, r.x, r.z + r.d, r.d, -1, 0)); }
  }
  // regle: 0 - 1 m - 2 m
  const rx = x0 + 20, rz = z0 + D - 20, seg = 50;
  for (let i = 0; i < 4; i++) out.push(`<rect x="${rx + i * seg}" y="${rz - 6}" width="${seg}" height="6" fill="${i % 2 ? '#fff' : '#222'}" stroke="#222" stroke-width="0.6"/>`);
  out.push(`<g font-size="${f7}" text-anchor="middle"><text x="${rx}" y="${rz - 10}">0</text><text x="${rx + 100}" y="${rz - 10}">1 m</text><text x="${rx + 200}" y="${rz - 10}">2 m</text></g>`);
  return { svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${mm(W)}mm" height="${mm(D)}mm" viewBox="${x0} ${z0} ${W} ${D}" font-family="system-ui, sans-serif" fill="#222">${out.join('')}</svg>`, wmm: +mm(W), hmm: +mm(D), paper, landscape, scale };
}
export function printScale(st, opts = {}) {
  const auto = fitScale(st, opts.paper || 'A4', opts.roomId);
  const o = { paper: 'A4', ...opts, scale: opts.scale || auto.scale, landscape: opts.landscape ?? auto.landscape };
  const r = scaleSvg(st, o);
  const room = opts.roomId ? st.rooms.find((x) => x.id === opts.roomId)?.name : null;
  const date = new Date().toLocaleDateString('ca', { day: 'numeric', month: 'long', year: 'numeric' });
  const [pw, ph] = o.landscape ? PAPER[o.paper] : [...PAPER[o.paper]].reverse();
  const fits = r.wmm <= pw - 2 * MARGIN && r.hmm <= ph - 2 * MARGIN - TITLE_H;
  const w = window.open('', '_blank');
  if (!w) return { error: 'popup' };
  w.document.write(`<!doctype html><html lang="ca"><head><meta charset="utf-8"><title>Plànol 1:${o.scale}${room ? ' · ' + esc(room) : ''}</title>
    <style>@page { size: ${o.paper} ${o.landscape ? 'landscape' : 'portrait'}; margin: ${MARGIN}mm; } html, body { margin: 0; background: #fff; color: #222; font: 11px system-ui, sans-serif; }
    .hd { display: flex; justify-content: space-between; align-items: baseline; height: ${TITLE_H - 4}mm; border-bottom: 0.3mm solid #222; margin-bottom: 2mm; }
    .hd b { font-size: 14px; } .warn { color: #c62828; font-weight: 700; } @media screen { body { padding: 10mm; } .tip { background: #fff6d6; padding: 6px 10px; border-radius: 6px; margin-bottom: 8px; } } @media print { .tip { display: none; } }</style></head><body>
    <div class="tip">Imprimeix-lo a <b>mida real (100 %)</b>, sense «Ajusta a la pàgina». Després comprova amb un regle que la barra «0 – 1 m» del plànol fa ${(1000 / o.scale / 10).toFixed(1)} cm.${fits ? '' : ' <span class="warn">A aquesta escala no hi cap: tria un paper més gran o una escala més petita.</span>'}</div>
    <div class="hd"><b>Planta 3D${room ? ' · ' + esc(room) : ''}</b><span>Escala 1:${o.scale} · ${o.paper} · mides en cm · sostre ${st.ceiling || 250} cm · ${date}</span></div>
    ${r.svg}
    <script>setTimeout(() => print(), 400)<\/script></body></html>`);
  w.document.close();
  return { ...r, fits };
}
