// Entre tots dos: notes i vots a cada moble, propostes desades per votar i comentar, i l'historial de qui ha canviat què.
// Tot es desa amb el plànol (també al núvol) i es fusiona entrada a entrada quan dues persones editen alhora.

const uid = () => Math.random().toString(36).slice(2, 9);
export const when = (ts) => {
  const d = new Date(ts), now = new Date();
  const hm = d.toLocaleTimeString('ca', { hour: '2-digit', minute: '2-digit' });
  return d.toDateString() === now.toDateString() ? `avui ${hm}` : `${d.toLocaleDateString('ca', { day: 'numeric', month: 'short' })} ${hm}`;
};
const LOG_MAX = 200, SAVED_MAX = 20;

// ---------------------------------------------------------------- historial
const snap = (st) => JSON.stringify({ items: st.items, rooms: st.rooms, saved: (st.saved || []).map((p) => ({ id: p.id, v: p.votes, c: (p.comments || []).length })), ceiling: st.ceiling });
// Diferències entre dos estats, en frases curtes («ha mogut «Sofà»»).
export function diffLog(prevJson, st, roomName) {
  if (!prevJson) return [];
  const prev = JSON.parse(prevJson), out = [];
  const P = new Map(prev.items.map((i) => [i.id, i])), N = new Map(st.items.map((i) => [i.id, i]));
  const nm = (i) => `«${i.name}»`;
  for (const [id, i] of N) {
    const o = P.get(id);
    if (!o) { out.push(`ha afegit ${nm(i)} a ${roomName(i.roomId)}`); continue; }
    if (JSON.stringify(o) === JSON.stringify(i)) continue;
    if ((i.notes || []).length > (o.notes || []).length) { const n = i.notes[i.notes.length - 1]; out.push(`ha comentat ${nm(i)}: «${String(n.text).slice(0, 60)}»`); continue; }
    if (JSON.stringify(o.votes || {}) !== JSON.stringify(i.votes || {})) { out.push(`ha votat ${nm(i)}`); continue; }
    if (o.roomId !== i.roomId) out.push(`ha portat ${nm(i)} a ${roomName(i.roomId)}`);
    else if (o.x !== i.x || o.z !== i.z) out.push(`ha mogut ${nm(i)} (${roomName(i.roomId)})`);
    if ((o.rot || 0) !== (i.rot || 0)) out.push(`ha girat ${nm(i)}`);
    if (o.w !== i.w || o.d !== i.d || o.h !== i.h) out.push(`ha canviat les mides de ${nm(i)} a ${i.w}×${i.d}×${i.h}`);
    if ((o.status || '') !== (i.status || '') || (o.price || 0) !== (i.price || 0)) out.push(`ha canviat la compra de ${nm(i)}${i.status === 'comprar' ? ' (per comprar' + (i.price ? `, ${i.price} €` : '') + ')' : i.status === 'comprat' ? ' (comprat)' : ''}`);
    if (o.name !== i.name) out.push(`ha canviat el nom de «${o.name}» a ${nm(i)}`);
    else if (o.color !== i.color || o.shape !== i.shape || o.photo !== i.photo || o.photoLook !== i.photoLook) out.push(`ha canviat l’aspecte de ${nm(i)}`);
    if ((o.group || '') !== (i.group || '')) out.push(i.group ? `ha agrupat ${nm(i)}` : `ha desagrupat ${nm(i)}`);
  }
  const gone = [...P.values()].filter((o) => !N.has(o.id));
  if (gone.length > 3) out.push(`ha tret ${gone.length} mobles`); else for (const o of gone) out.push(`ha tret ${nm(o)} de ${roomName(o.roomId)}`);
  if (JSON.stringify(prev.rooms) !== JSON.stringify(st.rooms) || prev.ceiling !== st.ceiling) out.push('ha canviat el plànol');
  const ps = new Map((prev.saved || []).map((p) => [p.id, p]));
  for (const p of st.saved || []) {
    const o = ps.get(p.id);
    if (!o) out.push(`ha desat una proposta per votar (${roomName(p.roomId)})`);
    else if (JSON.stringify(o.v || {}) !== JSON.stringify(p.votes || {})) out.push(`ha votat «${p.name}»`);
    else if (o.c < (p.comments || []).length) out.push(`ha comentat «${p.name}»`);
  }
  // si es mouen molts mobles alhora (una proposta aplicada), una sola frase
  const moves = out.filter((t) => t.startsWith('ha mogut') || t.startsWith('ha girat'));
  if (moves.length > 3) return [`ha recol·locat ${moves.length} mobles`, ...out.filter((t) => !moves.includes(t))].slice(0, 8);
  return out.slice(0, 8);
}
export function initLog() {
  let base = null;
  return {
    reset(st) { base = snap(st); },
    // Es crida en desar: afegeix a st.log les frases noves (fusionant amb l'última si és el mateix canvi fet ara mateix).
    record(st, who, roomName) {
      const texts = diffLog(base, st, roomName);
      base = snap(st);
      if (!texts.length) return;
      const log = (st.log ||= []);
      const now = Date.now();
      for (const text of texts) {
        const last = log[log.length - 1];
        if (last && last.who === who && last.text === text && now - last.at < 5 * 60e3) { last.at = now; continue; }
        log.push({ id: uid(), at: now, who, text });
      }
      if (log.length > LOG_MAX) log.splice(0, log.length - LOG_MAX);
      base = snap(st);
    },
  };
}
export function logHtml(st, esc, n = 40) {
  const log = (st.log || []).slice(-n).reverse();
  if (!log.length) return '<p class="note">Encara no hi ha canvis registrats. A partir d’ara s’hi apunta qui canvia què.</p>';
  return `<ul class="log">${log.map((e) => `<li><b>${esc(e.who)}</b> ${esc(e.text)}<small>${when(e.at)}</small></li>`).join('')}</ul>`;
}

// ---------------------------------------------------------------- notes i vots d'un moble
export function itemSocialHtml(it, me, esc) {
  const v = it.votes || {}, up = Object.entries(v).filter(([, x]) => x > 0).map(([k]) => k), dn = Object.entries(v).filter(([, x]) => x < 0).map(([k]) => k);
  const notes = it.notes || [];
  return `<div class="social">
    <div class="votes"><button type="button" class="vote ${v[me] > 0 ? 'on' : ''}" data-v="1" title="${up.length ? 'Els agrada a: ' + esc(up.join(', ')) : 'M’agrada'}">👍 ${up.length || ''}</button><button type="button" class="vote ${v[me] < 0 ? 'on' : ''}" data-v="-1" title="${dn.length ? 'No els agrada a: ' + esc(dn.join(', ')) : 'No m’agrada'}">👎 ${dn.length || ''}</button>
      <span class="who">${up.length ? `👍 ${esc(up.join(', '))}` : ''}${dn.length ? ` · 👎 ${esc(dn.join(', '))}` : ''}</span></div>
    <details class="notes" ${notes.length ? 'open' : ''}><summary>💬 Notes${notes.length ? ` (${notes.length})` : ''}</summary>
      <ul>${notes.map((n) => `<li><b>${esc(n.who)}</b> ${esc(n.text)} <small>${when(n.at)}</small>${n.who === me ? `<button type="button" class="del" data-n="${n.id}" title="Esborra la nota">×</button>` : ''}</li>`).join('')}</ul>
      <form class="add"><input type="text" maxlength="300" placeholder="Escriu una nota (p. ex. «m’agrada més en gris»)" /><button class="btn small" type="submit">Envia</button></form>
    </details></div>`;
}
// Enllaça els botons de la secció anterior. change(fn) aplica un canvi al moble (amb desfés i desat).
export function bindItemSocial(root, it, me, change) {
  root.querySelectorAll('.vote').forEach((b) => b.addEventListener('click', () => change(() => {
    const v = (it.votes ||= {}), x = +b.dataset.v;
    if (v[me] === x) delete v[me]; else v[me] = x;
    if (!Object.keys(v).length) delete it.votes;
  })));
  root.querySelectorAll('.notes .del').forEach((b) => b.addEventListener('click', () => change(() => { it.notes = (it.notes || []).filter((n) => n.id !== b.dataset.n); if (!it.notes.length) delete it.notes; })));
  const f = root.querySelector('.notes form');
  f?.addEventListener('submit', (e) => {
    e.preventDefault();
    const t = f.querySelector('input').value.trim(); if (!t) return;
    change(() => { (it.notes ||= []).push({ id: uid(), who: me, at: Date.now(), text: t }); });
  });
}

// ---------------------------------------------------------------- propostes desades per votar
export function saveProposal(st, room, items, me, name, goals) {
  const list = (st.saved ||= []);
  const p = { id: uid(), roomId: room.id, name: name || `Proposta de ${me}`, who: me, at: Date.now(), items: JSON.parse(JSON.stringify(items)), votes: {}, comments: [], goals: goals || [] };
  list.push(p);
  if (list.length > SAVED_MAX) list.splice(0, list.length - SAVED_MAX);
  return p;
}
export function savedHtml(st, roomId, me, esc) {
  const list = (st.saved || []).filter((p) => p.roomId === roomId);
  if (!list.length) return '';
  return `<h2>🗳 Propostes per votar</h2><div class="saved">${list.map((p) => {
    const v = p.votes || {}, up = Object.keys(v).filter((k) => v[k] > 0), dn = Object.keys(v).filter((k) => v[k] < 0);
    return `<div class="saved-card" data-id="${p.id}">
      <canvas width="320" height="200"></canvas>
      <div class="t"><input type="text" class="nm" value="${esc(p.name)}" aria-label="Nom de la proposta" /><small>de ${esc(p.who)} · ${when(p.at)} · ${p.items.length} mobles</small></div>
      ${(p.goals || []).length ? `<div class="g">${p.goals.map((g) => `<span class="${g.ok ? 'ok' : 'bad'}" title="${esc(g.label)}: ${esc(g.text)}">${g.ok ? '✓' : '✗'} ${esc(g.label)}</span>`).join('')}</div>` : ''}
      <div class="votes"><button type="button" class="vote ${v[me] > 0 ? 'on' : ''}" data-v="1">👍 ${up.length || ''}</button><button type="button" class="vote ${v[me] < 0 ? 'on' : ''}" data-v="-1">👎 ${dn.length || ''}</button><span class="who">${up.length ? `👍 ${esc(up.join(', '))}` : ''}${dn.length ? ` · 👎 ${esc(dn.join(', '))}` : ''}</span></div>
      <ul class="cm">${(p.comments || []).map((c) => `<li><b>${esc(c.who)}</b> ${esc(c.text)} <small>${when(c.at)}</small></li>`).join('')}</ul>
      <form class="add"><input type="text" maxlength="300" placeholder="Comenta aquesta proposta" /><button class="btn small" type="submit">Envia</button></form>
      <div class="btns"><button type="button" class="btn small" data-apply>Aplica-la</button><button type="button" class="btn danger small" data-del title="Esborra-la">🗑</button></div>
    </div>`;
  }).join('')}</div>`;
}
// Enllaça les targetes. ctx: { change(fn), apply(p), preview(canvas, p) }
export function bindSaved(root, st, me, ctx) {
  root.querySelectorAll('.saved-card').forEach((card) => {
    const p = (st.saved || []).find((x) => x.id === card.dataset.id); if (!p) return;
    ctx.preview(card.querySelector('canvas'), p);
    card.querySelectorAll('.vote').forEach((b) => b.addEventListener('click', () => ctx.change(() => { const v = (p.votes ||= {}), x = +b.dataset.v; if (v[me] === x) delete v[me]; else v[me] = x; })));
    card.querySelector('.nm').addEventListener('change', (e) => ctx.change(() => { p.name = e.target.value.trim() || p.name; }));
    const f = card.querySelector('form.add');
    f.addEventListener('submit', (e) => { e.preventDefault(); const t = f.querySelector('input').value.trim(); if (t) ctx.change(() => { (p.comments ||= []).push({ id: uid(), who: me, at: Date.now(), text: t }); }); });
    card.querySelector('[data-apply]').addEventListener('click', () => ctx.apply(p));
    card.querySelector('[data-del]').addEventListener('click', () => { if (confirm(`Esborrar «${p.name}»?`)) ctx.change(() => { st.saved = st.saved.filter((x) => x !== p); }); });
  });
}

// ---------------------------------------------------------------- fusió (quan tots dos editen alhora)
// Llistes amb id (log, saved): s'ajunten; dins d'una proposta, els vots i els comentaris també.
export function mergeById(base = [], local = [], remote = []) {
  const B = new Set((base || []).map((x) => x.id)), out = new Map();
  for (const x of remote || []) out.set(x.id, x);
  for (const x of local || []) {
    const r = out.get(x.id);
    if (!r) { if (!B.has(x.id) || (remote || []).some((y) => y.id === x.id)) out.set(x.id, x); continue; } // esborrat al núvol: es queda esborrat
    if (x.votes || x.comments) {
      const cm = new Map([...(r.comments || []), ...(x.comments || [])].map((c) => [c.id, c]));
      out.set(x.id, { ...r, ...x, votes: { ...(r.votes || {}), ...(x.votes || {}) }, comments: [...cm.values()].sort((a, b) => a.at - b.at) });
    } else out.set(x.id, x);
  }
  // el que s'ha esborrat aquí (era a la base i ja no és al local) tampoc es torna a posar
  const L = new Set((local || []).map((x) => x.id));
  for (const id of [...out.keys()]) if (B.has(id) && !L.has(id)) out.delete(id);
  return [...out.values()].sort((a, b) => (a.at || 0) - (b.at || 0));
}
