// Assistent WALL-E: entén ordres en català (escrites o per veu) i respon en català.
//  - «posa una taula de 100x100 al menjador»      → afegeix mobles
//  - «hi cap un sofà de 220 al dormitori?»          → comprova si hi cap i on
//  - «com posaries un sofà i una taula al menjador?» → genera propostes i explica la millor
//  - «treu la taula», «mou el sofà al dormitori», «què hi ha al dormitori?», «desfés»…
// No fa servir cap servei extern: tot passa al navegador.

import { CATALOG } from './furniture.js';
import { innerRect, overlaps, aabb, DEG } from './geom.js';
import { prefs } from './settings.js';

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/·/g, '').replace(/[’'`´]/g, ' ').replace(/\s+/g, ' ').trim();
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Sinònims de mobles (català i castellà, per si de cas), els de més paraules primer.
const TYPES = [
  ['mesaCentro', ['taula de centre', 'taula de cafe', 'taula baixa', 'mesa de centro', 'mesa baja']],
  ['muebleTv', ['moble tv', 'moble de tv', 'moble de la tele', 'moble del televisor', 'mueble tv', 'mueble de tv', 'mueble de la tele']],
  ['mesita', ['tauleta de nit', 'tauletes de nit', 'mesita de noche', 'mesitas de noche', 'mesilla', 'mesillas', 'tauleta', 'tauletes']],
  ['escritorio', ['taula d estudi', 'escriptori', 'escriptoris', 'escritorio', 'escritorios']],
  ['lampara', ['lampada de peu', 'lampada', 'lampades', 'lampara', 'lamparas', 'llum de peu']],
  ['mesa', ['taula', 'taules', 'mesa', 'mesas']],
  ['silla', ['cadira', 'cadires', 'silla', 'sillas']],
  ['sofa', ['sofa', 'sofas']],
  ['sillon', ['butaca', 'butaques', 'sillon', 'sillones']],
  ['cama', ['llit', 'llits', 'cama', 'camas']],
  ['armario', ['armari', 'armaris', 'armario', 'armarios']],
  ['estanteria', ['prestatgeria', 'prestatgeries', 'llibreria', 'estanteria', 'estanterias']],
  ['comoda', ['calaixera', 'calaixeres', 'comoda', 'comodas']],
  ['alfombra', ['catifa', 'catifes', 'alfombra', 'alfombras']],
  ['planta', ['planta', 'plantes', 'plantas']],
  ['tv', ['televisor', 'televisors', 'televisio', 'television', 'tele', 'tv']],
  ['caja', ['caixa', 'caixes', 'objecte', 'objectes', 'caja', 'cajas', 'objeto', 'moble', 'mobles', 'mueble', 'muebles']],
];
// Sinònims d'habitacions → paraules que han de ser al nom de l'habitació.
const ROOMS = [
  [['menjador', 'comedor', 'sala', 'salo', 'salon', 'estar'], ['menjador', 'sala', 'salo']],
  [['cuina', 'cocina'], ['cuina']],
  [['dormitori', 'habitacio', 'dormitorio', 'habitacion', 'quarto'], ['dormitori']],
  [['office', 'despatx', 'despacho', 'oficina'], ['office']],
  [['bany', 'lavabo', 'bano', 'aseo'], ['bany']],
  [['passadis', 'pasillo', 'rebedor', 'distribuidor'], ['passadis', 'distribuidor']],
  [['terrassa', 'terraza', 'balco', 'balcon'], ['terrassa']],
];
const NUMW = { un: 1, una: 1, uno: 1, dos: 2, dues: 2, tres: 3, quatre: 4, cuatro: 4, cinc: 5, cinco: 5, sis: 6, seis: 6, set: 7, siete: 7, vuit: 8, ocho: 8, nou: 9, nueve: 9, deu: 10, diez: 10 };
const WALL_NAME = { N: 'la paret de dalt', S: 'la paret de baix', W: 'la paret de l’esquerra', E: 'la paret de la dreta' };
const DIR_NAME = { 0: 'cap avall', 90: 'cap a la dreta', 180: 'cap amunt', 270: 'cap a l’esquerra' };

const ES_ONLY = new Set('donde cuantos cuantas cuanto tengo hay quiero puedes dime pon pones anade borra quita mueve cocina bano habitacion comedor salon dormitorio los las con por favor gracias ahora tambien muy esto eso cual como cuando nuevo nueva cabe cabria mesa silla cama armario'.split(' '));
const CA_ONLY = new Set('on quants quantes tinc hi vull pots digues posa afegeix treu mou cuina bany habitacio menjador dormitori els les amb per gracies ara tambe molt aixo aquest aquesta quin quina com quan nou nova cap cabria taula cadira llit armari'.split(' '));
function isSpanish(t) {
  const ws = t.replace(/[^a-z ]/g, ' ').split(/\s+/).filter(Boolean);
  let es = 0, ca = 0;
  ws.forEach((w) => { if (ES_ONLY.has(w) && !CA_ONLY.has(w)) es++; else if (CA_ONLY.has(w) && !ES_ONLY.has(w)) ca++; });
  return es > ca;
}

function findType(t) {
  for (const [key, words] of TYPES) for (const w of words) {
    const m = new RegExp('(?:^|\\s)' + w + '(?:\\s|$|[?,.!])').exec(t);
    if (m) return { key, word: w, index: m.index };
  }
  return null;
}
// Totes les mencions de mobles d'una frase («un sofà de 200 i dues cadires»).
function findAllTypes(t) {
  const out = [];
  let rest = t, offset = 0;
  for (let k = 0; k < 8; k++) {
    const f = findType(rest);
    if (!f) break;
    const at = f.index + (rest[f.index] === ' ' ? 1 : 0);
    const before = rest.slice(Math.max(0, at - 12), at);
    const qm = /(\d+|un|una|uno|dos|dues|tres|quatre|cuatro|cinc|cinco|sis|seis|set|siete|vuit|ocho|nou|nueve|deu|diez)\s*$/.exec(before);
    const qty = qm ? (NUMW[qm[1]] || +qm[1]) : 1;
    const after = rest.slice(at + f.word.length);
    const stop = after.search(/\s(i|y|,|amb|al|a la|a l|en el|en la|al |mes|tambe)\s|,/);
    const seg = stop >= 0 ? after.slice(0, stop) : after;
    out.push({ key: f.key, qty: Math.min(30, Math.max(1, qty)), dims: parseDims(seg), index: offset + at });
    const cut = at + f.word.length + Math.max(0, stop);
    offset += cut; rest = rest.slice(cut);
  }
  return out;
}
function parseDims(seg) {
  const d = {};
  const num = (s) => { let v = parseFloat(s.replace(',', '.')); if (v > 0 && v < 10) v *= 100; return Math.round(v); }; // «2x1» = metres
  const m = /(\d+(?:[.,]\d+)?)\s*(?:x|×|per|por)\s*(\d+(?:[.,]\d+)?)(?:\s*(?:x|×|per|por)\s*(\d+(?:[.,]\d+)?))?/.exec(seg);
  if (m) { d.w = num(m[1]); d.d = num(m[2]); if (m[3]) d.h = num(m[3]); }
  const a = /(\d+(?:[.,]\d+)?)\s*(?:cm|centimetres|m|metres)?\s*(?:d ample|d amplada|d amplaria|de ample|de ancho|d ancho|de llarg|de largo)/.exec(seg); if (a) d.w = num(a[1]);
  const f = /(\d+(?:[.,]\d+)?)\s*(?:cm|m)?\s*(?:de fons|de fondo|de profunditat|de profundidad)/.exec(seg); if (f) d.d = num(f[1]);
  const h = /(\d+(?:[.,]\d+)?)\s*(?:cm|m)?\s*(?:d alt|d alcada|d alçada|de alto|d altura|de altura)/.exec(seg); if (h) d.h = num(h[1]);
  if (!m && !a && !f && !h) { const s = /\bde (\d+(?:[.,]\d+)?)\s*(?:cm|m)?\b/.exec(seg); if (s) d.w = num(s[1]); }
  return d;
}

function findRoom(t, rooms) {
  // 1) pel nom real (p. ex. «bany 2», «office»)
  let best = null;
  for (const r of rooms) {
    const n = norm(r.name);
    if (n && t.includes(n) && (!best || n.length > norm(best.name).length)) best = r;
  }
  if (best) return best;
  // 2) per sinònims
  for (const [syns, keys] of ROOMS) {
    if (!syns.some((s) => new RegExp('(?:^|\\s)' + s + '(?:\\s|$|[?,.!])').test(t))) continue;
    const num = /(?:bany|bano|lavabo|aseo)\s*(\d)/.exec(t);
    const cands = rooms.filter((r) => keys.some((k) => norm(r.name).includes(k)));
    if (!cands.length) continue;
    if (num) { const c = cands.find((r) => norm(r.name).includes(num[1])); if (c) return c; }
    // la de nom més curt (p. ex. «Cuina» abans que «Terrassa cuina»)
    return cands.sort((a, b) => norm(a.name).length - norm(b.name).length)[0];
  }
  return null;
}

// Comprova si un moble (w × d) cap en una habitació amb els mobles que ja hi ha. Torna el millor lloc.
function fitCheck(spec, room, items, t) {
  const R = innerRect(room, t);
  const W = R.x1 - R.x0, D = R.z1 - R.z0;
  const others = items.filter((i) => i.roomId === room.id && i.type !== 'alfombra');
  let best = null;
  for (const rot of [0, 90]) {
    const fw = rot ? spec.d : spec.w, fd = rot ? spec.w : spec.d;
    if (fw > W + 0.5 || fd > D + 0.5) continue;
    const step = 5;
    for (let x = R.x0 + fw / 2; x <= R.x1 - fw / 2 + 0.01; x += step) {
      for (let z = R.z0 + fd / 2; z <= R.z1 - fd / 2 + 0.01; z += step) {
        const cand = { x, z, w: spec.w, d: spec.d, rot };
        if (others.some((o) => overlaps(cand, o, 1))) continue;
        const gaps = { W: x - fw / 2 - R.x0, E: R.x1 - (x + fw / 2), N: z - fd / 2 - R.z0, S: R.z1 - (z + fd / 2) };
        const minGap = Math.min(...Object.values(gaps));
        const touching = Object.values(gaps).filter((g) => g < 2).length;
        // preferim contra una paret (o en un racó), i amb el màxim de pas lliure davant
        const score = -touching * 1000 + minGap * 2 - Math.max(gaps.N, gaps.S, gaps.E, gaps.W) * 0.5;
        if (!best || score < best.score) best = { x: Math.round(x), z: Math.round(z), rot, gaps, score, fw, fd };
      }
    }
  }
  const spaceOnly = spec.w <= W + 0.5 && spec.d <= D + 0.5 || spec.d <= W + 0.5 && spec.w <= D + 0.5;
  return { fits: !!best, spaceOnly, best, R, W, D, others: others.length };
}

function describePlacement(it, p, R) {
  const b = aabb({ ...it, ...p });
  const gaps = { N: b.z0 - R.z0, S: R.z1 - b.z1, W: b.x0 - R.x0, E: R.x1 - b.x1 };
  const walls = Object.keys(gaps).filter((k) => gaps[k] < 15);
  let where = walls.length ? 'contra ' + walls.map((k) => WALL_NAME[k]).join(' i ') : 'al mig';
  if (walls.length === 2) where = 'al racó de ' + walls.map((k) => WALL_NAME[k].replace('la paret de ', '').replace('la paret de l’', 'l’').replace('la paret de la ', 'la ')).join(' i ');
  const r = ((Math.round((p.rot || 0) / 90) * 90) % 360 + 360) % 360;
  const facing = ['sofa', 'tv', 'cama', 'sillon', 'escritorio', 'muebleTv', 'silla'].includes(it.type) ? ', mirant ' + DIR_NAME[r] : '';
  return `${it.name} ${where}${facing}`;
}

export function initAssistant(api) {
  const fab = document.getElementById('ai-fab');
  const panel = document.getElementById('ai-panel');
  const msgs = panel.querySelector('.ai-msgs');
  const form = panel.querySelector('form');
  const input = panel.querySelector('textarea');
  const mic = panel.querySelector('.ai-mic');
  let pending = null; // acció proposada a l'espera d'un «sí»
  let greeted = false;

  // ---- so de WALL-E (fitxer propi; si falla, so sintètic) ----
  let audio = null, audioBad = false, ctx = null, lastSay = 0;
  function walleSynth(vol) {
    try {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      ctx = ctx || new AC(); if (ctx.state === 'suspended') ctx.resume();
      const t0 = ctx.currentTime + 0.02, g = ctx.createGain(); g.connect(ctx.destination); g.gain.setValueAtTime(1, t0);
      const note = (f0, f1, t, d, type = 'sawtooth') => {
        const o = ctx.createOscillator(), e = ctx.createGain(), bp = ctx.createBiquadFilter();
        o.type = type; o.frequency.setValueAtTime(f0, t0 + t); o.frequency.exponentialRampToValueAtTime(f1, t0 + t + d);
        bp.type = 'bandpass'; bp.frequency.value = 1100; bp.Q.value = 2.2;
        e.gain.setValueAtTime(0, t0 + t); e.gain.linearRampToValueAtTime(vol * 0.55, t0 + t + 0.03); e.gain.exponentialRampToValueAtTime(0.0001, t0 + t + d);
        o.connect(bp); bp.connect(e); e.connect(g); o.start(t0 + t); o.stop(t0 + t + d + 0.05);
      };
      note(210, 330, 0, 0.22); note(330, 520, 0.22, 0.12, 'square'); note(520, 300, 0.36, 0.34); note(300, 420, 0.36, 0.34, 'triangle');
    } catch (e) { /* res */ }
  }
  function walleSay(force) {
    const v = Math.max(0, Math.min(1, (+prefs.wvol || 0) / 100));
    if (v <= 0) return;
    const now = Date.now();
    if (!force && now - lastSay < 2000) return;
    lastSay = now;
    try {
      if (!audio) { audio = new Audio('audio/walle.mp3'); audio.preload = 'auto'; audio.playsInline = true; }
      if (audioBad) return walleSynth(v);
      audio.pause(); audio.currentTime = 0; audio.volume = v;
      const p = audio.play();
      if (p && p.catch) p.catch((err) => { if (err && err.name !== 'NotAllowedError' && err.name !== 'AbortError') { audioBad = true; walleSynth(v); } });
    } catch (e) { audioBad = true; walleSynth(v); }
  }

  // ---- veu: reconeixement (ca-ES) i síntesi ----
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const TTS = 'speechSynthesis' in window;
  let caVoice = null, recog = null;
  function pickVoice() { try { const vs = speechSynthesis.getVoices(); caVoice = vs.find((v) => /^ca([-_]|$)/i.test(v.lang)) || null; } catch (e) { caVoice = null; } }
  if (TTS) { pickVoice(); try { speechSynthesis.addEventListener('voiceschanged', pickVoice); } catch (e) { /* res */ } }
  function voiceInfo() {
    return (SR ? '🎤 Aquest navegador pot escoltar. ' : '⚠️ Aquest navegador no pot escoltar (prova amb Chrome o Safari). ')
      + (caVoice ? '🔊 Té veu catalana per respondre.' : '🔇 No té cap veu catalana: les respostes seran només text (a Android: Ajustos → Text a veu → instal·la el català; a l’iPhone: Ajustos → Accessibilitat → Contingut llegit → Veus → Català).');
  }
  function say(text) {
    if (!TTS || +prefs.voice === 0 || !caVoice) return false;
    const t = String(text).replace(/\p{Extended_Pictographic}|️|‍/gu, '').replace(/[•·→]/g, ',').replace(/\n+/g, '. ').replace(/\s+/g, ' ').trim();
    if (!t) return false;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(t.length > 420 ? t.slice(0, t.lastIndexOf(' ', 420)) + '…' : t);
      u.voice = caVoice; u.lang = caVoice.lang; u.rate = 1.03;
      speechSynthesis.speak(u);
      return true;
    } catch (e) { return false; }
  }
  const sayStop = () => { if (TTS) try { speechSynthesis.cancel(); } catch (e) { /* res */ } };
  function micStop() { if (recog) { const r = recog; recog = null; try { r.abort(); } catch (e) { /* res */ } } mic.classList.remove('on'); }
  function micStart() {
    if (!SR) { bot('🎤 Aquest navegador no pot escoltar. Prova amb Chrome (Android/PC) o Safari (iPhone).'); return; }
    if (recog) { micStop(); return; }
    sayStop();
    const r = new SR();
    r.lang = 'ca-ES'; r.interimResults = true; r.maxAlternatives = 1; r.continuous = false;
    recog = r; mic.classList.add('on');
    let final = '';
    r.onresult = (e) => { let txt = ''; for (const res of e.results) { txt += res[0].transcript; if (res.isFinal) final = txt; } input.value = txt; };
    r.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') bot('🎤 Cal donar permís al micròfon al navegador.');
      else if (e.error === 'no-speech') bot('🎤 No t’he sentit. Toca el micròfon i torna-ho a provar.');
      else if (e.error === 'network') bot('🎤 El reconeixement de veu necessita connexió a internet.');
      else if (e.error !== 'aborted') bot('🎤 Error del micròfon (' + e.error + ').');
    };
    r.onend = () => {
      mic.classList.remove('on');
      if (recog !== r) return;
      recog = null;
      const q = (final || input.value).trim(); input.value = '';
      if (q) ask(q);
    };
    try { r.start(); } catch (e) { micStop(); bot('🎤 No s’ha pogut obrir el micròfon.'); }
  }

  // ---- missatges ----
  function add(cls, html) {
    const d = document.createElement('div');
    d.className = 'ai-m ' + cls; d.innerHTML = html;
    msgs.appendChild(d); msgs.scrollTop = msgs.scrollHeight;
    return d;
  }
  function bot(text, { speak = true, html = false } = {}) {
    if (+prefs.voice !== 1) add('bot', html ? text : esc(text).replace(/\n/g, '<br>'));
    if (speak) say(html ? text.replace(/<[^>]+>/g, ' ') : text);
  }
  const me = (text) => add('me', esc(text));

  function open(v) {
    const show = v ?? panel.hidden;
    panel.hidden = !show;
    fab.setAttribute('aria-expanded', show ? 'true' : 'false');
    if (show) {
      walleSay();
      if (!greeted) { greeted = true; bot('Hola! Sóc WALL-E 🤖 Digue’m coses com «posa una taula de 100x100 al menjador», «hi cap un sofà de 220 al dormitori?» o «com posaries els mobles del menjador?». Escriu «ajuda» per veure-ho tot.'); }
      mic.hidden = !SR || +prefs.voice === 0;
      if (+prefs.voice !== 1) input.focus();
    } else { micStop(); sayStop(); }
  }
  fab.addEventListener('click', () => open());
  panel.querySelector('.ai-close').addEventListener('click', () => open(false));
  form.addEventListener('submit', (e) => { e.preventDefault(); const q = input.value.trim(); if (!q) return; input.value = ''; ask(q); });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } });
  mic.addEventListener('click', micStart);

  const HELP = `Puc fer això (en català):
📦 AFEGIR · «posa una taula de 140x80 al menjador» · «afegeix 4 cadires a la cuina» · «posa un sofà de 2x0,9 al menjador»
📏 HI CAP? · «hi cap un sofà de 220 al dormitori?» · «cabria un armari de 150x60 a l’office?»
🪄 PROPOSTES · «com posaries els mobles del menjador?» · «com ho faries amb un sofà de 200 i una taula al menjador?» · després: «aplica-ho»
🧹 ALTRES · «treu la taula del menjador» · «mou el sofà al dormitori» · «què hi ha al dormitori?» · «quant fa la cuina?» · «mostra el llit» · «desfés»
Les mides van en cm (o en metres si són petites, com 2x1).`;

  function roomsOf() { return api.rooms().filter((r) => r.kind !== 'void'); }
  function itemsIn(room) { return api.items().filter((i) => i.roomId === room.id); }
  function typeLabel(key, qty = 1) { const l = CATALOG[key]?.label || key; return qty > 1 ? `${qty} ${l.toLowerCase()}s` : l.toLowerCase(); }
  function specOf(m) { const c = CATALOG[m.key] || CATALOG.caja; return { w: m.dims.w || c.w, d: m.dims.d || c.d, h: m.dims.h || c.h }; }
  function dimsText(s) { return `${s.w}×${s.d} cm`; }
  function fmtRoom(r) { return r.name; }

  function addMentioned(mentions, room) {
    const added = [];
    for (const m of mentions) {
      const s = specOf(m);
      const its = api.addItems(m.key, { w: s.w, d: s.d, h: s.h, name: CATALOG[m.key]?.label }, m.qty, room.id);
      added.push(...its);
    }
    return added;
  }

  async function proposeFor(room, mentions) {
    let added = [];
    if (mentions.length) added = addMentioned(mentions, room);
    const its = itemsIn(room);
    if (!its.length) { bot(`A ${fmtRoom(room)} no hi ha cap moble. Digue’m què hi vols posar, per exemple «com ho faries amb un sofà i una taula a ${fmtRoom(room)}?».`); return; }
    const wait = add('bot', 'Deixa’m pensar… provant col·locacions 0 %');
    const props = await api.proposals(room, its, (f) => { wait.textContent = `Deixa’m pensar… provant col·locacions ${Math.round(f * 100)} %`; });
    wait.remove();
    if (!props.length) { bot('No he trobat cap col·locació.'); return; }
    const p = props[0];
    const R = innerRect(room, api.wallThickness());
    const lines = Object.entries(p.placements).map(([id, pos]) => { const it = its.find((i) => i.id === id); return it ? describePlacement(it, pos, R) : null; }).filter(Boolean);
    const locked = its.filter((i) => i.locked).length;
    const txt = `${added.length ? `He afegit ${added.map((i) => i.name.toLowerCase()).join(', ')}. ` : ''}Jo ho faria així a ${fmtRoom(room)} (${p.rating.toLowerCase()}):\n• ${lines.join('\n• ')}${locked ? `\n(${locked} moble${locked > 1 ? 's' : ''} fix${locked > 1 ? 'os' : ''} no l’he mogut.)` : ''}\nVols que ho apliqui? Tens ${props.length} propostes més a la pestanya Distribuir.`;
    pending = { kind: 'apply', room, p, props };
    api.showProposals(room, props);
    bot(txt);
  }

  async function ask(q) {
    me(q);
    const t = norm(q);
    const prefix = isSpanish(t) ? 'A mi parla’m en català, va 😉 ' : '';
    const rooms = roomsOf();
    const room = findRoom(t, rooms);
    const mentions = findAllTypes(t);

    // sí / no a una acció pendent
    if (pending && /^(si|si si|si home|va|d acord|endavant|ok|vale|fes ho|aplica|aplica ho|aplical|posa l|posa la|posa ho|posal|afegeix lo|afegeix la|sip|yes)\b/.test(t)) {
      const p = pending; pending = null;
      if (p.kind === 'add') { const its = addMentioned([p.mention], p.room); bot(`${prefix}Fet: ${its.map((i) => i.name.toLowerCase()).join(', ')} a ${fmtRoom(p.room)}.`); api.frame(p.room); return; }
      if (p.kind === 'apply') { api.apply(p.room, p.p); bot(`${prefix}Aplicat. Si no t’agrada, digues «desfés».`); api.frame(p.room); return; }
    }
    if (pending && /^(no|no no|deixa ho|deixa|cancel|cancela|res|para)\b/.test(t)) { pending = null; bot(`${prefix}D’acord, ho deixo.`); return; }

    if (/^(hola|bon dia|bona tarda|bona nit|ei|hey|hi)\b/.test(t) && t.length < 25) { bot(`${prefix}Hola! Què vols que faci amb els mobles?`); return; }
    if (/\b(ajuda|ayuda|help|que pots fer|que puedes hacer|que saps fer)\b/.test(t)) { bot(prefix + HELP); return; }
    if (/\b(desfes|deshacer|desfer|torna enrere|enrere)\b/.test(t)) { api.undo(); bot(`${prefix}Desfet.`); return; }
    if (/\b(aplica|aplicaho|aplical)\b/.test(t)) {
      if (pending?.kind === 'apply') { const p = pending; pending = null; api.apply(p.room, p.p); bot(`${prefix}Aplicat.`); api.frame(p.room); }
      else bot(`${prefix}No tinc cap proposta pendent. Digue’m «com posaries els mobles del menjador?» primer.`);
      return;
    }

    // PROPOSTES
    if (/\b(com (ho )?(faries|posaries|collocaries|distribuiries|ho veus|quedaria)|proposa|proposam|proposem|distribueix|distribuix|ordena|organitza|organitzam|que faries|como lo harias|como pondrias|propon|distribuye|organiza)\b/.test(t)) {
      const r = room || api.currentRoom();
      if (!r) { bot(`${prefix}A quina habitació?`); return; }
      await proposeFor(r, mentions);
      return;
    }

    // HI CAP?
    if (/\b(hi cap|cap|cabria|cabra|cabrien|hi entra|entraria|cabe|cabria|cabrian|entra)\b/.test(t) && mentions.length) {
      const r = room || api.currentRoom();
      if (!r) { bot(`${prefix}A quina habitació?`); return; }
      const m = mentions[0], s = specOf(m);
      const res = fitCheck(s, r, api.items(), api.wallThickness());
      const label = `${typeLabel(m.key)} de ${dimsText(s)}`;
      if (!res.fits) {
        if (!res.spaceOnly) bot(`${prefix}No, ${label} no hi cap a ${fmtRoom(r)}: l’interior fa ${Math.round(res.W)}×${Math.round(res.D)} cm.`);
        else bot(`${prefix}L’habitació fa ${Math.round(res.W)}×${Math.round(res.D)} cm, així que de mida hi cabria, però amb els ${res.others} mobles que ja hi ha no hi queda cap forat lliure. Treu-ne algun o digue’m «com ho faries» i ho reorganitzo.`);
        return;
      }
      const b = res.best;
      const walls = Object.keys(b.gaps).filter((k) => b.gaps[k] < 2);
      const where = walls.length ? 'contra ' + walls.map((k) => WALL_NAME[k]).join(' i ') : 'al mig';
      const freeSide = Object.entries(b.gaps).filter(([, g]) => g >= 2).sort((a, c) => c[1] - a[1])[0];
      bot(`${prefix}Sí, ${label} hi cap a ${fmtRoom(r)}: per exemple ${where}${b.rot ? ' (girat 90°)' : ''}${freeSide ? `, i queden ${Math.round(freeSide[1])} cm lliures fins a ${WALL_NAME[freeSide[0]]}` : ''}. Vols que l’hi posi?`);
      pending = { kind: 'add', room: r, mention: { ...m, qty: 1 } };
      return;
    }

    // TREURE
    if (/\b(treu|elimina|esborra|borra|suprimeix|quita|elimina|retira)\b/.test(t) && mentions.length) {
      const r = room;
      let its = api.items().filter((i) => mentions.some((m) => i.type === m.key) && (!r || i.roomId === r.id));
      if (/\b(tots|totes|todos|todas)\b/.test(t) || mentions[0].qty > 1) its = its.slice(0, mentions[0].qty > 1 ? mentions[0].qty : its.length); else its = its.slice(0, 1);
      if (!its.length) { bot(`${prefix}No trobo cap ${typeLabel(mentions[0].key)}${r ? ' a ' + fmtRoom(r) : ''}.`); return; }
      its.forEach((i) => api.removeItem(i.id));
      bot(`${prefix}He tret ${its.map((i) => i.name.toLowerCase()).join(', ')}. («desfés» si no volies.)`);
      return;
    }

    // MOURE
    if (/\b(mou|mueve|porta|passa|canvia .* (a|al|cap a)|trasllada)\b/.test(t) && mentions.length && room) {
      const it = api.items().find((i) => i.type === mentions[0].key && i.roomId !== room.id) || api.items().find((i) => i.type === mentions[0].key);
      if (!it) { bot(`${prefix}No trobo cap ${typeLabel(mentions[0].key)}.`); return; }
      const ok = api.moveItem(it.id, room.id);
      bot(ok ? `${prefix}He mogut ${it.name.toLowerCase()} a ${fmtRoom(room)}.` : `${prefix}No hi ha lloc per a ${it.name.toLowerCase()} a ${fmtRoom(room)}.`);
      api.frame(room);
      return;
    }

    // AFEGIR
    if (/\b(posa|posam|afegeix|afegeixme|colloca|collocam|fica|crea|vull|necessito|pon|ponme|anade|agrega|coloca|quiero|mete|crea)\b/.test(t) && mentions.length) {
      const r = room || api.currentRoom();
      if (!r) { bot(`${prefix}A quina habitació ho poso?`); pending = null; return; }
      // Si només n'hi ha un, abans de posar-lo mirem si hi cap.
      if (mentions.length === 1 && mentions[0].qty === 1) {
        const s = specOf(mentions[0]);
        const res = fitCheck(s, r, api.items(), api.wallThickness());
        if (!res.fits) { bot(`${prefix}${typeLabel(mentions[0].key)} de ${dimsText(s)} no hi cap a ${fmtRoom(r)}${res.spaceOnly ? ' amb els mobles que ja hi ha' : ` (l’interior fa ${Math.round(res.W)}×${Math.round(res.D)} cm)`}. El poso igualment?`); pending = { kind: 'add', room: r, mention: mentions[0] }; return; }
      }
      const its = addMentioned(mentions, r);
      bot(`${prefix}Fet: ${its.map((i) => `${i.name.toLowerCase()} (${i.w}×${i.d})`).join(', ')} a ${fmtRoom(r)}. Ara el pots arrossegar, o digue’m «com ho faries» i et proposo com col·locar-ho.`);
      api.frame(r);
      return;
    }

    // QUÈ HI HA / QUANTS
    if (/\b(que hi ha|quins mobles|quants|quantes|llista|que hay|cuantos|cuantas|lista)\b/.test(t)) {
      const r = room;
      const list = (rr) => { const its = itemsIn(rr); return its.length ? `${fmtRoom(rr)}: ${its.map((i) => `${i.name.toLowerCase()} (${i.w}×${i.d})`).join(', ')}` : `${fmtRoom(rr)}: res`; };
      if (r) bot(prefix + list(r)); else bot(prefix + rooms.filter((rr) => itemsIn(rr).length).map(list).join('\n') || `${prefix}Encara no hi ha cap moble.`);
      return;
    }

    // MIDES D'UNA HABITACIÓ
    if (/\b(quant fa|quant mesura|mides|mesura|com es de gran|cuanto mide|medidas|que mida)\b/.test(t)) {
      const r = room || api.currentRoom();
      if (!r) { bot(`${prefix}Quina habitació?`); return; }
      const R = innerRect(r, api.wallThickness());
      bot(`${prefix}${fmtRoom(r)} fa ${r.w}×${r.d} cm (${(r.w * r.d / 10000).toFixed(1)} m²)${r.estimated ? ', mides estimades' : ''}; l’interior útil és de ${Math.round(R.x1 - R.x0)}×${Math.round(R.z1 - R.z0)} cm.`);
      api.frame(r);
      return;
    }

    // MOSTRAR
    if (/\b(mostra|ensenya|on es|on esta|on tinc|busca|muestra|donde esta|ensename)\b/.test(t)) {
      if (mentions.length) {
        const it = api.items().find((i) => i.type === mentions[0].key && (!room || i.roomId === room.id));
        if (!it) { bot(`${prefix}No trobo cap ${typeLabel(mentions[0].key)}.`); return; }
        const r = rooms.find((rr) => rr.id === it.roomId);
        api.select(it.id); if (r) api.frame(r);
        bot(`${prefix}${it.name} és a ${r ? fmtRoom(r) : 'fora de les habitacions'}, a ${it.x},${it.z}.`);
        return;
      }
      if (room) { api.frame(room); bot(`${prefix}Aquí tens ${fmtRoom(room)}.`); return; }
    }

    bot(`${prefix}No t’he entès. Prova amb «posa una taula de 100x100 al menjador», «hi cap un sofà de 220 al dormitori?» o «com posaries els mobles del menjador?». Escriu «ajuda» per veure-ho tot.`);
  }

  if (+prefs.autoOpen) setTimeout(() => open(true), 800);

  return { open, walleSay, voiceInfo, sayTest: () => { if (!caVoice) bot('🔇 Aquest dispositiu no té cap veu catalana. Les respostes seran només text.', { speak: false }); else say('Hola! Sóc WALL-E, l’assistent del plànol. Digue’m on poso els mobles.'); }, ask };
}
