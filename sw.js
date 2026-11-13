// Service worker: guarda l'app al dispositiu perquè obri a l'instant i funcioni sense connexió.
// Els fitxers propis es serveixen de la memòria cau i s'actualitzen en segon pla;
// la pàgina principal es demana primer a la xarxa perquè les novetats arribin de seguida.
const CACHE = 'planta3d-shell-v1';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Firebase, Google: sempre xarxa

  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((res) => { caches.open(CACHE).then((c) => c.put('./index.html', res.clone())); return res; })
      .catch(() => caches.match('./index.html')));
    return;
  }
  e.respondWith(caches.match(req).then((cached) => {
    const fresh = fetch(req).then((res) => { if (res.ok) caches.open(CACHE).then((c) => c.put(req, res.clone())); return res; }).catch(() => cached);
    return cached || fresh;
  }));
});
