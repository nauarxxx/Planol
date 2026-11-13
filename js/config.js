// Configuración de Firebase.
// Copia aquí el objeto firebaseConfig de la consola de Firebase:
// Configuración del proyecto → General → Tus apps → App web → firebaseConfig.
// (La configuración web de Firebase es pública por diseño; la protección la dan Auth y las reglas.)
// Mientras apiKey esté vacío, la app funciona sin inicio de sesión y guarda solo en este navegador.
export const firebaseConfig = {
  apiKey: 'AIzaSyDY_88gmy6W_IqkApk0uMs1Kgnb1chZzh4',
  authDomain: 'web-inventari.firebaseapp.com',
  projectId: 'web-inventari',
  storageBucket: 'web-inventari.firebasestorage.app',
  messagingSenderId: '738769723363',
  appId: '1:738769723363:web:00089cf758400cf7a78ad6',
  measurementId: 'G-5KL2CNXCYQ',
};

// Mismas cuentas que la regla de Firestore. La seguridad real la pone la regla del servidor;
// esta lista solo sirve para mostrar un aviso claro en la app.
export const ALLOWED_EMAILS = [
  'arnaubalsellsc4@gmail.com',
  'ainhoaguerreroalejo2@gmail.com',
];

// Documento de Firestore donde se guarda el plano y los muebles (compartido entre las cuentas permitidas).
export const STATE_DOC = ['planta3d', 'estado'];
