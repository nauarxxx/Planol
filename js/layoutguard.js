// Guarda de la disposició: cap botó ni panell flotant no pot quedar a sobre d'un altre, a cap mida de pantalla ni en cap situació
// (moble triat, panell obert, passeig, WALL-E, avisos…). Després de cada canvi visible es mesura on és cada cosa i:
//   · la barra de selecció puja si toparia amb els controls del passeig;
//   · els panells (moble, paret) s'encongeixen o es desplacen per quedar entre la barra de dalt i els botons de baix,
//     i a l'ordinador s'aparten del xat de WALL-E si és obert;
//   · el minimapa del passeig baixa sota la barra de dalt;
//   · l'avís (toast) puja per sobre dels botons de baix;
//   · el text d'ajuda de baix s'amaga si tocaria res.
const GAP = 8;
const $ = (s) => document.querySelector(s);

function shown(el) {
  if (!el || el.hidden || el.closest('[hidden]')) return false;
  for (let q = el; q && q !== document.body; q = q.parentElement) {
    const c = getComputedStyle(q);
    if (c.display === 'none' || c.visibility === 'hidden' || +c.opacity < 0.05) return false;
  }
  const r = el.getBoundingClientRect();
  return r.width > 2 && r.height > 2;
}
const box = (el) => el.getBoundingClientRect();
const hit = (a, b, m = 0) => a.left < b.right + m && b.left < a.right + m && a.top < b.bottom + m && b.top < a.bottom + m;
const hOverlap = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2;

// Rectangles dels botons de la barra de dalt que es veuen (amb el menú de WALL-E plegat només hi ha el botó rodó).
function toolbarRects() {
  const tb = $('#toolbar'); if (!tb || !shown(tb)) return [];
  return [...tb.querySelectorAll('button, select, label')].filter(shown).map(box).filter((r) => r.width > 2);
}
// Controls de baix que mai es mouen.
function bottomFixed() {
  const out = [];
  for (const s of ['#ai-fab', '#walkbar']) { const el = $(s); if (shown(el)) out.push(...(s === '#walkbar' ? [...el.querySelectorAll('button, select, .joy')].filter(shown).map(box) : [box(el)])); }
  // pestanyes del panell lateral quan és a baix (mòbil)
  const tabs = $('#sidebar .tabs');
  if (tabs && shown(tabs) && box(tabs).top > innerHeight / 2) out.push(box(tabs));
  return out;
}

function resetInline(el, keys) { for (const k of keys) if (el.dataset.lg?.includes(k)) el.style[k] = ''; delete el.dataset.lg; }
function setInline(el, k, v) { el.style[k] = v; el.dataset.lg = (el.dataset.lg || '') + ' ' + k; }

function guard() {
  const vp = $('#viewport'); if (!vp) return;
  const P = box(vp);
  const top = toolbarRects();
  const bottom = bottomFixed();

  // 1) barra de selecció: per sobre dels controls del passeig
  const sel = $('#selbar');
  if (sel) {
    resetInline(sel, ['bottom']);
    if (shown(sel)) {
      const S = box(sel);
      const under = bottom.filter((r) => hOverlap(r, S) && r.top < S.bottom + GAP && r.bottom > S.top - GAP && r.width < P.width * 0.9);
      const walk = $('#walkbar');
      if (under.length && shown(walk)) setInline(sel, 'bottom', `${Math.round(P.bottom - Math.min(...bottom.filter((r) => hOverlap(r, S)).map((r) => r.top)) + GAP)}px`);
    }
  }
  const lows = [...bottom]; if (sel && shown(sel)) lows.push(box(sel));

  // 2) minimapa del passeig: sota la barra de dalt i per sobre dels botons de baix (si cal, més petit)
  const map = $('#wk-map');
  if (map) {
    resetInline(map, ['top', 'bottom', 'width', 'height']);
    if (shown(map)) {
      const M = box(map);
      const tbB = Math.max(P.top, ...top.filter((r) => hOverlap(r, M)).map((r) => r.bottom));
      const blk = lows.filter((r) => hOverlap(r, M));
      const yb = Math.min(P.bottom, ...blk.map((r) => r.top)) - GAP;
      if (M.top < tbB + GAP || M.bottom > yb) {
        const size = Math.max(60, Math.min(M.height, yb - tbB - GAP));
        const tt = M.top < tbB + GAP ? tbB + GAP : Math.min(M.top, yb - size);
        setInline(map, 'top', `${Math.round(tt - P.top)}px`); setInline(map, 'bottom', 'auto');
        setInline(map, 'width', `${Math.round(size)}px`); setInline(map, 'height', `${Math.round(size)}px`);
      }
    }
  }
  const mapR = map && shown(map) ? [box(map)] : [];

  // 3) panells: entre la barra de dalt i els botons de baix (i, a l'ordinador, al costat del xat de WALL-E)
  const chat = ['#ai-panel', '#r-panel'].map($).find((el) => shown(el));
  for (const el of ['#props', '#wallpanel'].map($)) {
    if (!el) continue;
    resetInline(el, ['top', 'bottom', 'maxHeight', 'right', 'width']);
    const wasOff = el.classList.contains('lg-off');
    let off = false;
    if (el.hidden || getComputedStyle(el).display === 'none') { if (wasOff) el.classList.remove('lg-off'); continue; }
    let R = box(el);
    if (chat && innerWidth > 800) {
      const C = box(chat);
      if (hit(R, C)) {
        // a l'esquerra del xat; si no hi cap sencer, més estret; si ni així, s'amaga mentre el xat és obert
        const avail = C.left - P.left - 2 * GAP;
        if (avail >= 200) {
          setInline(el, 'right', `${Math.round(P.right - C.left + GAP)}px`);
          if (avail < R.width) setInline(el, 'width', `${Math.round(avail)}px`);
          R = box(el);
        } else off = true;
      }
    }
    // tot el que hi ha a la barra de dalt (també el menú de WALL-E desplegat) i el minimapa si és a la meitat de dalt queden per sobre
    const mid = P.top + P.height / 2;
    const above = [...top, ...mapR.filter((r) => r.top < mid)].filter((r) => hOverlap(r, R));
    const below = [...lows, ...mapR.filter((r) => r.top >= mid)].filter((r) => hOverlap(r, R) && r.bottom > R.top);
    const topLim = Math.max(P.top + GAP, ...above.map((r) => r.bottom + GAP));
    const botLim = Math.min(P.bottom - GAP, ...below.map((r) => r.top - GAP));
    if (botLim - topLim < 120) off = true; // no hi cap (p. ex. menú obert en un mòbil petit): s'amaga mentrestant
    if (wasOff !== off) el.classList.toggle('lg-off', off); // només si canvia (si no, l'observador entraria en bucle)
    if (off || (R.top >= topLim - 0.5 && R.bottom <= botLim + 0.5)) continue;
    const cs = getComputedStyle(el);
    const natural = el.scrollHeight + parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);
    const h = Math.max(80, Math.min(natural, R.height, botLim - topLim));
    const b = Math.min(R.bottom, botLim);
    const t = Math.max(topLim, b - h);
    setInline(el, 'top', `${Math.round(t - P.top)}px`);
    setInline(el, 'bottom', 'auto');
    setInline(el, 'maxHeight', `${Math.round(Math.min(h, botLim - t))}px`);
  }
  // el xat de WALL-E (i el d'ordres) tampoc no pot pujar per sobre de la barra de dalt en pantalles baixes
  for (const el of ['#ai-panel', '#r-panel'].map($)) {
    if (!el) continue;
    resetInline(el, ['top', 'bottom', 'height']);
    if (!shown(el)) continue;
    const R = box(el);
    const above = top.filter((r) => hOverlap(r, R) && r.top < R.top + 40);
    const below = bottom.filter((r) => hOverlap(r, R) && r.bottom > R.bottom - 40);
    const topLim = Math.max(P.top + GAP, ...above.map((r) => r.bottom + GAP));
    const botLim = Math.min(P.bottom - GAP, ...below.map((r) => r.top - GAP));
    if (R.top >= topLim - 0.5 && R.bottom <= botLim + 0.5) continue;
    const b = Math.min(R.bottom, botLim), tt = Math.max(topLim, b - R.height);
    setInline(el, 'top', `${Math.round(tt - P.top)}px`); setInline(el, 'bottom', 'auto'); setInline(el, 'height', `${Math.round(Math.max(160, b - tt))}px`);
  }
  const panels = ['#props', '#wallpanel'].map($).filter((el) => shown(el) && !el.classList.contains('lg-off')).map(box);
  const chatR = chat && shown(chat) ? box(chat) : null;

  // 4) avís: per sobre de tot el que hi hagi a baix
  const t = $('#toast');
  if (t) {
    resetInline(t, ['bottom', 'left', 'maxWidth']);
    if (shown(t)) {
      // primer, de costat: si hi ha panells alts (moble, paret, xat), l'avís va al tros lliure més ample que deixen
      const tall = [...panels, ...(chatR ? [chatR] : [])].filter((r) => r.height > P.height * 0.3).sort((a, b) => a.left - b.left);
      if (tall.length) {
        let x = P.left + GAP, best = null;
        for (const r of [...tall, { left: P.right, right: P.right }]) {
          const x1 = r.left - GAP;
          if (!best || x1 - x > best[1] - best[0]) best = [x, x1];
          x = Math.max(x, r.right + GAP);
        }
        if (best && best[1] - best[0] > 140) { setInline(t, 'left', `${Math.round((best[0] + best[1]) / 2)}px`); setInline(t, 'maxWidth', `${Math.round(best[1] - best[0])}px`); }
      }
      // després, d'alçada: la posició més baixa on no toqui res (per sobre de cada obstacle, o just sota la barra de dalt)
      const T = box(t), h = T.height;
      const obst = [...lows, ...panels, ...(chatR ? [chatR] : []), ...top, ...mapR];
      const near = obst.filter((r) => hOverlap(r, T));
      const tb = Math.max(P.top, ...top.filter((r) => hOverlap(r, T)).map((r) => r.bottom));
      const cands = [T.bottom, ...near.map((r) => r.top - GAP), tb + GAP + h].filter((y) => y <= T.bottom + 0.5).sort((a, b) => b - a);
      const fits = (yb) => { const r = { left: T.left, right: T.right, top: yb - h, bottom: yb }; return r.top >= P.top && !obst.some((o) => hit(o, r, 1)); };
      let yb = cands.find(fits);
      if (yb === undefined) {
        // no hi ha cap forat lliure (p. ex. xat obert, panell del moble i avís alhora): a sobre dels missatges del xat,
        // o al mig d'un panell, on hi ha text i no botons
        const hard = [...lows, ...top, ...mapR];
        for (const r of [...(chatR ? [chatR] : []), ...panels]) {
          setInline(t, 'left', `${Math.round((r.left + r.right) / 2)}px`); setInline(t, 'maxWidth', `${Math.round(r.width - 2 * GAP)}px`);
          const T2 = box(t), y = (r.top + r.bottom) / 2 + T2.height / 2;
          const rr = { left: T2.left, right: T2.right, top: y - T2.height, bottom: y };
          if (rr.top >= P.top && !hard.some((o) => hit(o, rr, 1))) { yb = y; break; }
        }
      }
      if (yb !== undefined && yb < T.bottom - 0.5) setInline(t, 'bottom', `${Math.round(innerHeight - yb)}px`);
    }
  }

  // 5) text d'ajuda: si tocaria res, s'amaga
  const hint = $('#hint');
  if (hint) {
    // s'amaga amb visibility (no amb display) perquè es pugui mesurar igualment; només es toca la classe si canvia
    let off = false;
    if (!hint.hidden && getComputedStyle(hint).display !== 'none') {
      const H = box(hint);
      const all = [...top, ...lows, ...panels, ...mapR];
      if (t && shown(t)) all.push(box(t));
      if (chat) all.push(box(chat));
      off = H.width > 2 && all.some((r) => hit(r, H, 2));
    }
    if (hint.classList.contains('lg-off') !== off) hint.classList.toggle('lg-off', off);
  }
}

let raf = 0;
export function relayout() { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; try { guard(); } catch (e) { console.warn('layoutguard', e); } }); }

export function initLayoutGuard() {
  addEventListener('resize', relayout);
  addEventListener('orientationchange', () => setTimeout(relayout, 300));
  const mo = new MutationObserver(relayout);
  const watch = ['#toolbar', '#props', '#wallpanel', '#walkbar', '#selbar', '#ai-panel', '#r-panel', '#wk-map', '#toast', '#hint', '#sidebar', '#ai-fab'];
  for (const s of watch) {
    const el = $(s); if (!el) continue;
    mo.observe(el, { attributes: true, attributeFilter: ['hidden', 'class', 'aria-expanded'] });
    if (['#props', '#wallpanel', '#toast', '#hint', '#selbar'].includes(s)) mo.observe(el, { childList: true, subtree: true, characterData: true });
  }
  mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  // les transicions de la barra de WALL-E canvien la mida un moment després
  document.addEventListener('transitionend', relayout, true);
  relayout();
}
