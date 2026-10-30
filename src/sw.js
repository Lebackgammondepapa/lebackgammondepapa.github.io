/* Service worker de la version publique (copié à la racine par build.py, qui remplace __VERSION__).
   Le jeu s'ouvre même sans réseau :
   - la page : réseau d'abord, pour toujours avoir la dernière version publiée ; la copie gardée en cache
     sert quand il n'y a pas de réseau, ou s'il ne répond pas au bout de quelques secondes
   - les polices : cache d'abord (elles ne changent qu'avec un nouveau numéro de version)
   Le jeu en ligne (relais MQTT en wss) ne passe pas par ici. */
const CACHE = 'bg-__VERSION__';
const PAGE = './';
const FONTS = ['fonts/cormorant-garamond-500.woff2', 'fonts/cormorant-garamond-600.woff2', 'fonts/manrope.woff2'];
const PAGE_PATHS = new Set([new URL(PAGE, self.location).pathname, new URL('index.html', self.location).pathname]);
const FONT_PATHS = new Set(FONTS.map(f => new URL(f, self.location).pathname));
const NET_TIMEOUT = 4000;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE)
    .then(c => c.addAll([PAGE, ...FONTS].map(u => new Request(u, { cache: 'no-cache' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('bg-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate' && PAGE_PATHS.has(url.pathname)) {
    const net = fetchPage(req.url);
    e.waitUntil(net.then(r => r.stored, () => { }));
    e.respondWith(answerPage(net));
    return;
  }
  if (FONT_PATHS.has(url.pathname)) e.respondWith(fromCache(req));
});

// page demandée au réseau (revalidée, pas de copie périmée du cache HTTP) ; une bonne réponse remplace la copie en cache
function fetchPage(url) {
  return fetch(url, { cache: 'no-cache' }).then(async res => {
    // Safari refuse de servir une navigation avec une réponse redirigée : on la recopie
    if (res.ok && res.redirected) res = new Response(await res.blob(), { status: res.status, statusText: res.statusText, headers: res.headers });
    let stored = Promise.resolve();
    if (res.ok) { const copy = res.clone(); stored = caches.open(CACHE).then(c => c.put(PAGE, copy)); }
    return { res, stored };
  });
}

async function answerPage(net) {
  const cached = await caches.match(PAGE, { cacheName: CACHE, ignoreVary: true });
  const fromNet = net.then(r => r.res);
  if (!cached) return fromNet;
  return new Promise(resolve => {
    const t = setTimeout(() => resolve(cached), NET_TIMEOUT);
    fromNet.then(res => { clearTimeout(t); resolve(res.ok ? res : cached); }, () => { clearTimeout(t); resolve(cached); });
  });
}

async function fromCache(req) {
  const c = await caches.open(CACHE);
  const hit = await c.match(req, { ignoreSearch: true, ignoreVary: true });
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) c.put(req, res.clone());
  return res;
}
