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
    let initial = null;
    try {
      const snap = await fb.getDoc(ref);
      if (snap.exists() && snap.data().json) initial = JSON.parse(snap.data().json);
    } catch (e) {
      return onDenied(u.email, 'No se ha podido leer la base de datos: ' + e.message);
    }
    onSignedIn(u, initial);
    unsub = fb.onSnapshot(ref, (snap) => {
      if (snap.metadata.hasPendingWrites || !snap.exists()) return;
      const d = snap.data();
      if (d.by === u.email && d.session === SESSION) return; // es nuestro propio guardado
      try { onRemoteState(JSON.parse(d.json), d.by); } catch (e) { /* ignorar */ }
    });
  });
}

const SESSION = Math.random().toString(36).slice(2);

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

export function currentUser() {
  return user;
}

// Guarda con un pequeño retardo para no escribir en cada movimiento.
export function saveRemote(state, onStatus) {
  if (!cloudEnabled || !isAllowed(user)) return;
  clearTimeout(saveTimer);
  onStatus?.('pendiente');
  saveTimer = setTimeout(async () => {
    try {
      await fb.setDoc(fb.doc(db, ...STATE_DOC), {
        json: JSON.stringify(state),
        by: user.email,
        session: SESSION,
        updatedAt: fb.serverTimestamp(),
      });
      onStatus?.('guardado');
    } catch (e) {
      onStatus?.('error: ' + e.message);
    }
  }, 800);
}
