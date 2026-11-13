// Configuración de Firebase.
// Copia aquí el objeto firebaseConfig de la consola de Firebase:
// Configuración del proyecto → General → Tus apps → App web → firebaseConfig.
// Mientras apiKey esté vacío, la app funciona sin inicio de sesión y guarda solo en este navegador.
export const firebaseConfig = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: '',
};

// Mismas cuentas que la regla de Firestore. La seguridad real la pone la regla del servidor;
// esta lista solo sirve para mostrar un aviso claro en la app.
export const ALLOWED_EMAILS = [
  'arnaubalsellsc4@gmail.com',
  'ainhoaguerreroalejo2@gmail.com',
];

// Documento de Firestore donde se guarda el plano y los muebles (compartido entre las cuentas permitidas).
export const STATE_DOC = ['planta3d', 'estado'];
