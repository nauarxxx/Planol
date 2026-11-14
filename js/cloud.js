// Inicio de sesión con Google (Firebase Auth) y guardado en Firestore.
import { firebaseConfig, ALLOWED_EMAILS, STATE_DOC } from './config.js?v=11';

export const cloudEnabled = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

let fb = null, auth = null, db = null, user = null;
let saveTimer = null, unsub = null;

export function isAllowed(u) {
  return Boolean(u && u.emailVerified && ALLOWED_EMAILS.includes((u.email || '').toLowerCase()));
}

export async function initCloud({ onSignedIn, onSignedOut, onDenied, onRemoteState }) {
  if (!cloudEnabled) return;
  fb = await import('../vendor/firebase.js');
  const app = fb.initializeApp(firebaseConfig);
  auth = fb.getAuth(app);
  db = fb.getFirestore(app);
  try { await fb.getRedirectResult(auth); } catch (e) { /* sin redirección pendiente */ }
  fb.onAuthStateChanged(auth, async (u) => {
    if (unsub) { unsub(); unsub = null; }
    user = u;
    if (!u) return onSignedOut();
    if (!isAllowed(u)) {
      const email = u.email;
      await fb.signOut(auth);
      return onDenied(email);
    }
    const ref = fb.doc(db, ...STATE_DOC);
    // Es llegeix l'estat del núvol. Si el mòbil no té connexió (o l'estalvi de bateria la talla), es reintenta
    // i, si no hi ha manera, l'app s'obre igualment amb la còpia d'aquest dispositiu: no es deixa l'usuari fora.
    let initial = null, offline = null;
    for (let i = 0; i < 3; i++) {
      try {
        const snap = await fb.getDoc(ref);
        if (snap.exists() && snap.data().json) initial = JSON.parse(snap.data().json);
        offline = null;
        break;
      } catch (e) {
        if (!OFFLINE_RE.test(String(e.code || '') + ' ' + String(e.message || ''))) return onDenied(u.email, 'No s’ha pogut llegir la base de dades: ' + e.message);
        offline = e;
        await new Promise((r) => setTimeout(r, 700 * (i + 1)));
      }
    }
    onSignedIn(u, initial, offline ? (offline.message || 'sense connexió') : null);
    unsub = fb.onSnapshot(ref, (snap) => {
      if (snap.metadata.hasPendingWrites || !snap.exists()) return;
      const d = snap.data();
      if (d.by === u.email && d.session === SESSION) return; // es nuestro propio guardado
      try { onRemoteState(JSON.parse(d.json), d.by); } catch (e) { /* ignorar */ }
    });
  });
}

const SESSION = Math.random().toString(36).slice(2);
// Errors que volen dir «ara mateix no hi ha connexió», no «no tens permís».
const OFFLINE_RE = /offline|unavailable|network|deadline|timeout|failed to fetch|internet/i;

export async function signIn() {
  const provider = new fb.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    await fb.signInWithPopup(auth, provider);
  } catch (e) {
    if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') {
      await fb.signInWithRedirect(auth, provider);
    } else throw e;
  }
}

export function signOutUser() {
  if (auth) return fb.signOut(auth);
}

// Llegeix l'estat del núvol ara mateix (botó Sincronitza).
export async function loadRemote() {
  if (!cloudEnabled || !db || !isAllowed(user)) return null;
  const snap = await fb.getDoc(fb.doc(db, ...STATE_DOC));
  if (!snap.exists() || !snap.data().json) return null;
  return { state: JSON.parse(snap.data().json), by: snap.data().by || '' };
}
export function currentUser() {
  return user;
}

// Guarda con un pequeño retardo para no escribir en cada movimiento.
// `state` pot ser una funció que retorna l'estat actual, així es desa sempre l'últim i no un de vell.
export function saveRemote(state, onStatus) {
  if (!cloudEnabled || !isAllowed(user)) return;
  clearTimeout(saveTimer);
  onStatus?.('pendiente');
  saveTimer = setTimeout(async () => {
    const json = JSON.stringify(typeof state === 'function' ? state() : state);
    try {
      await fb.setDoc(fb.doc(db, ...STATE_DOC), {
        json,
        by: user.email,
        session: SESSION,
        updatedAt: fb.serverTimestamp(),
      });
      onStatus?.('guardado', json);
    } catch (e) {
      onStatus?.('error: ' + e.message);
    }
  }, saveDelay);
}

// ---- còpies de seguretat ----
// Índex: document planta3d/copies {list: [meta…]} · contingut: planta3d/bk_<id> {json} (en trossos bk_<id>_<n> si és gran).
const BK_INDEX = ['planta3d', 'copies'];
const BK_CHUNK = 700000;
let saveDelay = 800;
export function setSaveDelay(ms) { saveDelay = Math.max(100, +ms || 800); }
export const currentUserEmail = () => user?.email || '';

export async function backupList() {
  if (!cloudEnabled || !db) return [];
  const snap = await fb.getDoc(fb.doc(db, ...BK_INDEX));
  return snap.exists() && Array.isArray(snap.data().list) ? snap.data().list : [];
}
async function backupIndexWrite(list) {
  await fb.setDoc(fb.doc(db, ...BK_INDEX), { list, updatedAt: fb.serverTimestamp() });
}
export async function backupSave(meta, json, onProgress) {
  if (!cloudEnabled || !db || !user) throw new Error('Sense sessió');
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const parts = [];
  for (let i = 0; i < json.length; i += BK_CHUNK) parts.push(json.slice(i, i + BK_CHUNK));
  for (let n = 0; n < parts.length; n++) {
    await fb.setDoc(fb.doc(db, 'planta3d', parts.length === 1 ? 'bk_' + id : `bk_${id}_${n}`), { json: parts[n], b: id, n });
    onProgress?.(n + 1, parts.length);
  }
  const list = await backupList();
  list.unshift({ ...meta, id, chunks: parts.length });
  await backupIndexWrite(list);
  return id;
}
export async function backupLoad(id) {
  const list = await backupList();
  const b = list.find((x) => x.id === id);
  if (!b) throw new Error('La còpia no existeix');
  if ((b.chunks || 1) <= 1) {
    const snap = await fb.getDoc(fb.doc(db, 'planta3d', 'bk_' + id));
    if (!snap.exists()) throw new Error('La còpia està incompleta o trencada');
    return snap.data().json;
  }
  let json = '';
  for (let n = 0; n < b.chunks; n++) {
    const snap = await fb.getDoc(fb.doc(db, 'planta3d', `bk_${id}_${n}`));
    if (!snap.exists()) throw new Error('La còpia està incompleta o trencada');
    json += snap.data().json;
  }
  return json;
}
export async function backupDelete(id) {
  const list = await backupList();
  const b = list.find((x) => x.id === id);
  if (b) {
    // el paquet de Firebase que portem no té deleteDoc: es buida el document (deixa d'ocupar espai)
    if ((b.chunks || 1) <= 1) await fb.setDoc(fb.doc(db, 'planta3d', 'bk_' + id), { deleted: true });
    else for (let n = 0; n < b.chunks; n++) await fb.setDoc(fb.doc(db, 'planta3d', `bk_${id}_${n}`), { deleted: true });
  }
  await backupIndexWrite(list.filter((x) => x.id !== id));
}
