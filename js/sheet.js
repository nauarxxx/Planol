// Plànol en 2D sobre un canvas (per comparar escenes i per imprimir / desar en PDF), amb cotes.
import { corners, allOpenings, allSwings, swingArc, DEG } from './geom.js?v=33';
import { CATALOG } from './furniture.js?v=33';

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
