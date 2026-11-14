// Pestanya «Compra»: preu, enllaç i estat de cada moble (ja el tinc · per comprar · comprat), totals per habitació,
// pressupost i llista per exportar o imprimir.
export const STATUS = [['tinc', 'Ja el tinc'], ['comprar', '🛒 Per comprar'], ['comprat', '✓ Comprat']];
export const statusOf = (it) => it.status || 'tinc';
const eur = (n) => (Math.round((+n || 0) * 100) / 100).toLocaleString('ca', { style: 'currency', currency: 'EUR', maximumFractionDigits: (+n || 0) % 1 ? 2 : 0 });

export function initShop(ctx) {
  // ctx: { el, state(), rooms(), esc, commit, save, select(id), roomName(id), toast }
  const ui = { all: false };
  function totals(items) {
    const t = { comprar: 0, comprat: 0, nComprar: 0, nComprat: 0, sense: 0 };
    for (const it of items) {
      const st = statusOf(it), p = +it.price || 0;
      if (st === 'comprar') { t.comprar += p; t.nComprar++; if (!p) t.sense++; }
      if (st === 'comprat') { t.comprat += p; t.nComprat++; }
    }
    return t;
  }
  function render() {
    const S = ctx.state(), esc = ctx.esc, el = ctx.el;
    if (!el) return;
    const items = S.items || [];
    const T = totals(items), budget = +S.budget || 0;
    const shown = (it) => ui.all || statusOf(it) !== 'tinc' || +it.price > 0;
    const rooms = ctx.rooms();
    const rows = rooms.map((r) => {
      const its = items.filter((i) => i.roomId === r.id && shown(i));
      if (!its.length) return '';
      const rt = totals(its);
      return `<h2>${esc(r.name)} <small>${rt.comprar ? `· per comprar ${eur(rt.comprar)}` : ''}${rt.comprat ? ` · comprat ${eur(rt.comprat)}` : ''}</small></h2>
        <ul class="shop">${its.map((i) => `
          <li data-id="${i.id}" class="st-${statusOf(i)}">
            <button type="button" class="nm" title="Mostra’l al plànol">${esc(i.name)}<small>${i.w}×${i.d}×${i.h}</small></button>
            <select class="st" aria-label="Estat">${STATUS.map(([k, l]) => `<option value="${k}" ${statusOf(i) === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
            <label class="pr"><input type="number" min="0" step="1" value="${+i.price || ''}" placeholder="Preu" aria-label="Preu en euros" />€</label>
            <button type="button" class="lk" title="${i.url ? esc(i.url) : 'Posa l’enllaç de la botiga'}">${i.url ? '🔗' : '＋🔗'}</button>
          </li>`).join('')}</ul>`;
    }).join('');
    el.innerHTML = `
      <h2>Llista de compra</h2>
      <div class="shop-sum">
        <div><b>${eur(T.comprar)}</b><span>per comprar (${T.nComprar})</span></div>
        <div><b>${eur(T.comprat)}</b><span>ja comprat (${T.nComprat})</span></div>
        <div><b>${budget ? eur(budget - T.comprar - T.comprat) : '—'}</b><span>${budget ? 'queda del pressupost' : 'sense pressupost'}</span></div>
      </div>
      ${T.sense ? `<p class="note">⚠ ${T.sense} moble${T.sense > 1 ? 's' : ''} per comprar sense preu.</p>` : ''}
      <div class="row c2">
        <label>Pressupost total (€)<input type="number" id="sh-budget" min="0" step="10" value="${budget || ''}" placeholder="p. ex. 3000" /></label>
        <label class="chk" style="flex-direction:row;align-items:center;gap:6px;margin-top:18px"><input type="checkbox" id="sh-all" ${ui.all ? 'checked' : ''}/> Mostra també el que ja tinc</label>
      </div>
      <div class="btns"><button class="btn secondary small" id="sh-csv">⬇ Exporta (CSV)</button><button class="btn secondary small" id="sh-print">🖨 Imprimeix la llista</button></div>
      ${rows || '<p class="note">Encara no hi ha res per comprar. Tria un moble i, al seu panell, posa’l «🛒 Per comprar» amb el preu; o marca «Mostra també el que ja tinc» per posar-ho aquí mateix.</p>'}`;
    const upd = (id, fn) => { const it = S.items.find((i) => i.id === id); if (!it) return; ctx.commit(); fn(it); ctx.save(); render(); ctx.changed?.(it); };
    el.querySelectorAll('li[data-id]').forEach((li) => {
      const id = li.dataset.id;
      li.querySelector('.nm').addEventListener('click', () => ctx.select(id));
      li.querySelector('.st').addEventListener('change', (e) => upd(id, (it) => { if (e.target.value === 'tinc') delete it.status; else it.status = e.target.value; }));
      li.querySelector('.pr input').addEventListener('change', (e) => upd(id, (it) => { const v = Math.max(0, +e.target.value || 0); if (v) it.price = v; else delete it.price; }));
      li.querySelector('.lk').addEventListener('click', () => {
        const it = S.items.find((i) => i.id === id);
        if (it.url && confirm(`Obre l’enllaç?\n${it.url}\n\n(Cancel·la per canviar-lo)`)) { window.open(it.url, '_blank', 'noopener'); return; }
        const u = prompt('Enllaç de la botiga:', it.url || ''); if (u === null) return;
        upd(id, (x) => { if (u.trim()) x.url = u.trim(); else delete x.url; });
      });
    });
    el.querySelector('#sh-budget').addEventListener('change', (e) => { ctx.commit(); const v = Math.max(0, +e.target.value || 0); if (v) S.budget = v; else delete S.budget; ctx.save(); render(); });
    el.querySelector('#sh-all').addEventListener('change', (e) => { ui.all = e.target.checked; render(); });
    el.querySelector('#sh-csv').addEventListener('click', () => exportCsv(S));
    el.querySelector('#sh-print').addEventListener('click', () => printList(S));
  }
  function lines(S) {
    return (S.items || []).filter((i) => statusOf(i) !== 'tinc' || +i.price > 0).map((i) => ({ room: ctx.roomName(i.roomId), name: i.name, dims: `${i.w}×${i.d}×${i.h}`, status: STATUS.find(([k]) => k === statusOf(i))[1].replace(/^\W+\s/, ''), price: +i.price || 0, url: i.url || '' }));
  }
  function exportCsv(S) {
    const q = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = ['Habitació;Moble;Mides (cm);Estat;Preu (€);Enllaç', ...lines(S).map((l) => [l.room, l.name, l.dims, l.status, String(l.price).replace('.', ','), l.url].map(q).join(';'))].join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    a.download = 'llista-de-compra.csv'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    ctx.toast?.('⬇ Llista desada (s’obre amb Excel o Google Sheets).');
  }
  function printList(S) {
    const esc = ctx.esc, L = lines(S), T = totals(S.items || []);
    const w = window.open('', '_blank');
    if (!w) { ctx.toast?.('El navegador ha bloquejat la finestra d’impressió.'); return; }
    w.document.write(`<!doctype html><html lang="ca"><head><meta charset="utf-8"><title>Llista de compra</title><style>body{font:14px system-ui,sans-serif;margin:24px;color:#222}table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #ddd;padding:6px 8px;text-align:left}th{background:#f3f1ec}td.n{text-align:right;white-space:nowrap}h1{font-size:20px}.t{margin-top:12px;font-weight:700}</style></head><body>
      <h1>Llista de compra</h1>
      <table><tr><th>Habitació</th><th>Moble</th><th>Mides (cm)</th><th>Estat</th><th>Preu</th></tr>${L.map((l) => `<tr><td>${esc(l.room)}</td><td>${esc(l.name)}${l.url ? `<br><small>${esc(l.url)}</small>` : ''}</td><td>${l.dims}</td><td>${esc(l.status)}</td><td class="n">${l.price ? eur(l.price) : '—'}</td></tr>`).join('')}</table>
      <p class="t">Per comprar: ${eur(T.comprar)} · Ja comprat: ${eur(T.comprat)}${+S.budget ? ` · Pressupost: ${eur(S.budget)} (queden ${eur(S.budget - T.comprar - T.comprat)})` : ''}</p>
      <script>setTimeout(()=>print(),300)<\/script></body></html>`);
    w.document.close();
  }
  return { render, totals: () => totals(ctx.state().items || []) };
}
