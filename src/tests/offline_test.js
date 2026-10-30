// Jeu hors connexion (version publique) dans Chromium : service worker, polices du site, reprise de partie sans réseau,
// mise à jour de la page dès qu'on est en ligne. Le serveur local imite GitHub Pages (max-age=600, ETag).
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..', '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.woff2': 'font/woff2', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain' };
let indexOverride = null;
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT + path.sep) || /node_modules|\.git/.test(p)) { res.writeHead(404); return res.end(); }
  let body; try { body = p === '/index.html' && indexOverride ? Buffer.from(indexOverride) : fs.readFileSync(file); } catch (e) { res.writeHead(404); return res.end('404'); }
  const etag = '"' + crypto.createHash('sha1').update(body).digest('hex').slice(0, 16) + '"';
  const headers = { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'max-age=600', ETag: etag, Vary: 'Accept-Encoding' };
  if (req.headers['if-none-match'] === etag) { res.writeHead(304, headers); return res.end(); }
  res.writeHead(200, headers); res.end(body);
});
let fails = 0;
const check = (ok, label, extra) => { console.log((ok ? 'ok   ' : 'FAIL ') + label + (extra !== undefined ? ' ' + JSON.stringify(extra) : '')); if (!ok) fails++; };

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://localhost:${server.address().port}/`;
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1000, height: 640 } });
  const page = await context.newPage();
  const errors = [], external = [], fontResp = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  page.on('request', r => { if (/fonts\.(googleapis|gstatic)\.com/.test(r.url())) external.push(r.url()); });
  page.on('response', r => { if (/\/fonts\/.*\.woff2$/.test(r.url())) fontResp.push({ url: r.url().split('/').pop(), sw: r.fromServiceWorker(), status: r.status() }); });
  const G = expr => page.evaluate(new Function('const G = window.__nacre.G; return (' + expr + ');'));
  const untilMyMove = async () => {
    for (let k = 0; k < 160; k++) {
      const s = await G('({ phase: G.phase, player: G.player, busy: G.busy, rolling: G.rolling, required: G.required })');
      if (s.phase === 'move' && s.player === 1 && s.required > 0 && !s.busy) return true;
      if (s.phase === 'choice' && s.player === 1 && !s.busy && !s.rolling) await page.click('#mainBtn', { timeout: 1000 }).catch(() => { });
      await page.waitForTimeout(250);
    }
    return false;
  };
  const toClient = (x, y) => page.evaluate(([x, y]) => { const p = new DOMPoint(x, y).matrixTransform(document.getElementById('board').getScreenCTM()); return { x: p.x, y: p.y }; }, [x, y]);
  const dragFirstStep = async () => {
    const { a, b } = await page.evaluate(() => { const N = window.__nacre, G = N.G, st = G.steps[0]; return { a: N.topPos(st.from, G.player, G.state), b: N.nextPos(st.to, G.player, G.state) }; });
    const A = await toClient(a.x, a.y), B = await toClient(b.x, b.y);
    await page.mouse.move(A.x, A.y); await page.mouse.down(); await page.mouse.move(A.x + 12, A.y + 12, { steps: 3 }); await page.mouse.move(B.x, B.y, { steps: 10 }); await page.mouse.up();
    await page.waitForTimeout(800);
  };
  const fontStatus = () => page.evaluate(async () => { await document.fonts.ready; return [...document.fonts].map(f => `${f.family.replace(/"/g, '')} ${f.weight}:${f.status}`); });

  /* 1. première visite en ligne : le service worker s'installe et garde la page et les polices */
  await page.goto(base);
  const controlled = await page.evaluate(async () => { await navigator.serviceWorker.ready; for (let i = 0; i < 50 && !navigator.serviceWorker.controller; i++) await new Promise(r => setTimeout(r, 100)); return !!navigator.serviceWorker.controller; });
  check(controlled, 'service worker installé et actif');
  const cached = await page.evaluate(async () => { const out = []; for (const k of await caches.keys()) { const c = await caches.open(k); for (const r of await c.keys()) out.push(new URL(r.url).pathname); } return out.sort(); });
  check(['/', '/fonts/cormorant-garamond-500.woff2', '/fonts/cormorant-garamond-600.woff2', '/fonts/manrope.woff2'].every(p => cached.includes(p)), 'page et polices en cache', cached);
  check(external.length === 0, 'aucune police chargée depuis Google', external);

  /* 2. une partie commencée en ligne */
  await page.click('#startBtn');
  check(await untilMyMove(), 'partie contre l\'ordinateur lancée');
  await dragFirstStep();
  const s1 = await G('({ state: G.state, dice: G.dice, rem: G.rem, hist: G.history.length })');
  check(s1.hist === 1, 'un pion joué à la souris', s1.hist);

  /* 3. mode avion : on rouvre l'appli */
  await context.setOffline(true);
  fontResp.length = 0;
  await page.reload();
  await page.waitForFunction(() => window.__nacre && window.__nacre.G.phase !== 'idle', null, { timeout: 8000 }).catch(() => { });
  const s2 = await G('({ state: G.state, dice: G.dice, rem: G.rem, hist: G.history.length, phase: G.phase, home: document.getElementById("home").hidden })');
  check(await page.title() === 'Backgammon', 'sans réseau : la page s\'ouvre');
  check(s2.home && s2.phase === 'move' && JSON.stringify([s2.state, s2.dice, s2.rem, s2.hist]) === JSON.stringify([s1.state, s1.dice, s1.rem, s1.hist]), 'sans réseau : la partie reprend au même endroit', { phase: s2.phase, hist: s2.hist });
  const fs3 = await fontStatus();
  check(fs3.some(f => f.startsWith('Manrope') && f.endsWith(':loaded')) && fs3.some(f => /Cormorant Garamond 600:loaded/.test(f)) && !fs3.some(f => f.endsWith(':error')), 'sans réseau : les polices s\'affichent', fs3);
  check(fontResp.length > 0 && fontResp.every(r => r.sw), 'polices servies par le service worker', fontResp);
  await page.click('#undoBtn');
  check(await G('G.history.length === 0'), 'sans réseau : Annuler fonctionne');
  for (let k = 0; k < 4 && await G('G.required > 0 && G.steps.length > 0'); k++) await dragFirstStep();
  check(await G('G.required === 0'), 'sans réseau : tour joué');
  await page.click('#mainBtn');
  await page.waitForFunction(() => window.__nacre.G.player === 1 && window.__nacre.G.phase === 'move' && !window.__nacre.G.busy, null, { timeout: 30000 }).catch(() => { });
  check(await G('G.player === 1 && G.phase === "move"'), 'sans réseau : l\'ordinateur joue, la main revient');

  /* 4. sans réseau, le jeu en ligne le dit tout de suite */
  await page.click('#menuBtn'); await page.click('#abandonBtn');
  await page.click('.mode[data-mode="online"]');
  const msg = await page.textContent('#onlineMsg');
  check(/Pas de connexion internet/.test(msg), 'sans réseau : message dans l\'onglet En ligne', msg);

  /* 5. lien d'invitation ouvert sans réseau */
  await page.goto('about:blank'); // sinon simple changement d'ancre dans la même page, sans rechargement
  await page.goto(base + '#WXYZ');
  await page.waitForTimeout(600);
  check(await page.inputValue('#joinCode') === 'WXYZ' && /Pas de connexion/.test(await page.textContent('#onlineMsg')), 'invitation sans réseau : page ouverte, code prérempli, message clair');

  /* 6. retour du réseau : une nouvelle version publiée s'affiche tout de suite, puis reste disponible hors connexion */
  await context.setOffline(false);
  indexOverride = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').replace('<title>Backgammon</title>', '<title>Backgammon v2</title>');
  await page.goto(base);
  check(await page.title() === 'Backgammon v2', 'en ligne : la dernière version publiée s\'affiche (malgré max-age=600)', await page.title());
  await page.waitForTimeout(300);
  await context.setOffline(true);
  await page.reload();
  check(await page.title() === 'Backgammon v2', 'hors connexion ensuite : c\'est cette nouvelle version qui s\'ouvre', await page.title());
  await context.setOffline(false);
  indexOverride = null;

  check(errors.length === 0, 'aucune erreur dans la page', errors.slice(0, 4));
  await browser.close(); server.close();
  console.log(fails ? `${fails} ÉCHEC(S)` : 'ALL OK');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
