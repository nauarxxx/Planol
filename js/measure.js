// Mesurar un moble amb una foto: es marquen les 4 cantonades d'un full A4 (21 × 29,7 cm) que estigui
// recolzat al mateix pla que es vol mesurar (el terra, o la cara frontal del moble) i després dos punts.
// Amb una homografia es passa de píxels a centímetres. Només és exacte per a punts del mateix pla que el full.

const A4 = [[0, 0], [21, 0], [21, 29.7], [0, 29.7]];

function solve(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    if (Math.abs(M[c][c]) < 1e-12) return null;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}
function homography(src, dst) {
  const A = [], b = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i], [u, v] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
  }
  const h = solve(A, b);
  if (!h) return null;
  return ([x, y]) => { const w = h[6] * x + h[7] * y + 1; return [(h[0] * x + h[1] * y + h[2]) / w, (h[3] * x + h[4] * y + h[5]) / w]; };
}

export function initMeasure() {
  const modal = document.getElementById('measure');
  const cv = modal.querySelector('canvas');
  const ctx = cv.getContext('2d');
  const status = modal.querySelector('.ms-status');
  const list = modal.querySelector('.ms-list');
  const file = modal.querySelector('input[type=file]');
  let img = null, pts = [], H = null, measures = [], onUse = null, loupe = null, scale = 1;

  const STEPS = ['Toca la cantonada 1 del full A4 (la de dalt a l’esquerra)', 'Cantonada 2: la de dalt a la dreta (costat curt, 21 cm)', 'Cantonada 3: la de baix a la dreta (costat llarg, 29,7 cm)', 'Cantonada 4: la de baix a l’esquerra'];

  function fit() {
    const maxW = Math.min(modal.clientWidth - 48, 900), maxH = Math.min(window.innerHeight * 0.55, 700);
    scale = img ? Math.min(maxW / img.width, maxH / img.height, 1) : 1;
    cv.width = img ? Math.round(img.width * scale) : 600; cv.height = img ? Math.round(img.height * scale) : 320;
    draw();
  }
  function draw() {
    ctx.clearRect(0, 0, cv.width, cv.height);
    if (!img) { ctx.fillStyle = '#eee'; ctx.fillRect(0, 0, cv.width, cv.height); ctx.fillStyle = '#777'; ctx.font = '15px system-ui'; ctx.textAlign = 'center'; ctx.fillText('Carrega una foto on es vegi un full A4 sencer', cv.width / 2, cv.height / 2); return; }
    ctx.drawImage(img, 0, 0, cv.width, cv.height);
    const P = (p) => [p[0] * scale, p[1] * scale];
    // full
    if (pts.length) {
      ctx.strokeStyle = '#1e88e5'; ctx.lineWidth = 2; ctx.beginPath();
      pts.slice(0, 4).forEach((p, i) => { const [x, y] = P(p); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      if (pts.length >= 4) ctx.closePath();
      ctx.stroke();
      pts.slice(0, 4).forEach((p, i) => { const [x, y] = P(p); ctx.fillStyle = '#1e88e5'; ctx.beginPath(); ctx.arc(x, y, 6, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = 'bold 10px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(i + 1, x, y); });
    }
    // mesures
    ctx.lineWidth = 2;
    measures.forEach((m, i) => {
      const [ax, ay] = P(m.a), [bx, by] = P(m.b);
      ctx.strokeStyle = '#d32f2f'; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      ctx.fillStyle = '#d32f2f'; [[ax, ay], [bx, by]].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 4, 0, 7); ctx.fill(); });
      const lx = (ax + bx) / 2, ly = (ay + by) / 2, txt = `${i + 1}: ${m.cm} cm`;
      ctx.font = 'bold 13px system-ui'; const w = ctx.measureText(txt).width + 10;
      ctx.fillStyle = 'rgba(211,47,47,.9)'; ctx.fillRect(lx - w / 2, ly - 20, w, 18); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(txt, lx, ly - 11);
    });
    const pend = pts.length > 4 ? pts[4] : null;
    if (pend) { const [x, y] = P(pend); ctx.fillStyle = '#d32f2f'; ctx.beginPath(); ctx.arc(x, y, 5, 0, 7); ctx.fill(); }
    // lupa
    if (loupe) {
      const r = 46, z = 2.5, [mx, my] = loupe;
      const lx = mx < cv.width / 2 ? cv.width - r - 8 : r + 8, ly = r + 8;
      ctx.save(); ctx.beginPath(); ctx.arc(lx, ly, r, 0, 7); ctx.clip();
      ctx.drawImage(img, mx / scale - r / z / scale, my / scale - r / z / scale, 2 * r / z / scale, 2 * r / z / scale, lx - r, ly - r, 2 * r, 2 * r);
      ctx.restore();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(lx, ly, r, 0, 7); ctx.stroke();
      ctx.strokeStyle = '#d32f2f'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(lx - 10, ly); ctx.lineTo(lx + 10, ly); ctx.moveTo(lx, ly - 10); ctx.lineTo(lx, ly + 10); ctx.stroke();
    }
  }
  function updateStatus() {
    if (!img) status.textContent = 'Fes una foto on es vegi un full A4 sencer, recolzat al terra davant del moble (per mesurar amplada i fons) o enganxat a la seva cara frontal (per l’alçada).';
    else if (pts.length < 4) status.textContent = STEPS[pts.length];
    else if (pts.length === 4) status.textContent = 'Ara toca el primer punt del que vols mesurar (al mateix pla que el full).';
    else status.textContent = 'Toca el segon punt.';
    list.innerHTML = measures.map((m, i) => `<li><b>${i + 1}</b>: ${m.cm} cm
      <button class="btn secondary small" data-use="w" data-i="${i}">→ amplada</button>
      <button class="btn secondary small" data-use="d" data-i="${i}">→ fons</button>
      <button class="btn secondary small" data-use="h" data-i="${i}">→ alçada</button></li>`).join('');
    list.querySelectorAll('[data-use]').forEach((b) => b.addEventListener('click', () => { const m = measures[+b.dataset.i]; onUse?.({ [b.dataset.use]: Math.round(m.cm) }); status.textContent = `He posat ${Math.round(m.cm)} cm com a ${{ w: 'amplada', d: 'fons', h: 'alçada' }[b.dataset.use]} al formulari.`; }));
    modal.querySelector('#ms-undo').disabled = !pts.length && !measures.length;
  }
  function addPoint(p) {
    if (!img) return;
    pts.push(p);
    if (pts.length === 4) {
      H = homography(pts, A4);
      if (!H) { pts = []; status.textContent = 'Aquests quatre punts no formen un full: torna-ho a provar.'; draw(); return; }
    }
    if (pts.length === 6) {
      const a = H(pts[4]), b = H(pts[5]);
      measures.push({ a: pts[4], b: pts[5], cm: Math.round(Math.hypot(a[0] - b[0], a[1] - b[1]) * 10) / 10 });
      pts.length = 4;
    }
    draw(); updateStatus();
  }
  const pos = (e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * cv.width / r.width, (e.clientY - r.top) * cv.height / r.height]; };
  let down = null;
  cv.addEventListener('pointerdown', (e) => { if (!img) return; down = pos(e); loupe = down; draw(); cv.setPointerCapture(e.pointerId); });
  cv.addEventListener('pointermove', (e) => { if (!down) return; loupe = pos(e); draw(); });
  cv.addEventListener('pointerup', (e) => { if (!down) return; const p = pos(e); down = null; loupe = null; addPoint([p[0] / scale, p[1] / scale]); });
  cv.addEventListener('pointercancel', () => { down = null; loupe = null; draw(); });

  file.addEventListener('change', () => {
    const f = file.files[0]; if (!f) return;
    const im = new Image();
    im.onload = () => { img = im; pts = []; measures = []; H = null; fit(); updateStatus(); };
    im.src = URL.createObjectURL(f);
  });
  modal.querySelector('#ms-undo').addEventListener('click', () => {
    if (pts.length > 4) pts.pop(); else if (measures.length && pts.length === 4) measures.pop(); else pts.pop();
    if (pts.length < 4) H = null;
    draw(); updateStatus();
  });
  modal.querySelector('#ms-clear').addEventListener('click', () => { pts = []; measures = []; H = null; draw(); updateStatus(); });
  modal.querySelector('#measure-close').addEventListener('click', () => { modal.hidden = true; });
  window.addEventListener('resize', () => { if (!modal.hidden) fit(); });

  return function openMeasure(cb) {
    onUse = cb; modal.hidden = false; fit(); updateStatus();
  };
}
