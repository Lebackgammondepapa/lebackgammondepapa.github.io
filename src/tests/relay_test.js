// Deux joueurs sur la version publique, trois serveurs MQTT locaux ; on coupe un serveur en pleine partie,
// puis un joueur « recharge la page » et reprend la partie.
const { JSDOM } = require('jsdom'); const fs = require('fs'); const ws = require('ws');
const html = fs.readFileSync('../index.html', 'utf8');
const PORTS = [18831, 18832, 18833];
const brokers = PORTS.map(port => {
  const aedes = require('aedes')(); const wss = new ws.WebSocketServer({ port });
  wss.on('connection', sock => aedes.handle(ws.createWebSocketStream(sock)));
  return { aedes, wss, port };
});
const errors = [];
function client(id, store) {
  const dom = new JSDOM(html, { url: 'https://thomas.github.io/backgammon/', runScripts: 'dangerously', pretendToBeVisual: true, beforeParse(w) {
    w.console.error = (...a) => errors.push(id + ': ' + a.join(' '));
    w.HTMLCanvasElement.prototype.getContext = function () { return new Proxy({}, { get: (t, k) => (k === 'createRadialGradient' || k === 'createLinearGradient') ? (() => ({ addColorStop() {} })) : (() => {}), set: () => true }); };
    w.HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,';
    w.requestAnimationFrame = cb => setTimeout(() => cb(w.performance.now()), 16);
    w.matchMedia = () => ({ matches: true });
    w.DOMPoint = class { constructor(x, y) { this.x = x; this.y = y; } matrixTransform() { return this; } };
    w.SVGElement.prototype.getScreenCTM = () => ({ inverse: () => ({}) });
    w.SVGElement.prototype.setPointerCapture = () => {}; w.SVGElement.prototype.releasePointerCapture = () => {};
    Object.defineProperty(w.HTMLElement.prototype, 'clientWidth', { get() { return 800; } });
    Object.defineProperty(w.HTMLElement.prototype, 'clientHeight', { get() { return 400; } });
    w.NACRE_BROKERS = PORTS.map(p => 'ws://127.0.0.1:' + p);
    w.NACRE_MQTT_OPTS = { timerVariant: 'native' };
    if (store) for (const [k, v] of Object.entries(store)) w.localStorage.setItem(k, v);
  } });
  dom.window.addEventListener('error', e => errors.push(id + ' uncaught: ' + e.message + ' ' + (e.error && e.error.stack)));
  return dom.window;
}
const wait = ms => new Promise(r => setTimeout(r, ms));
async function playUntil(pairs, stopFn, maxTicks) {
  for (let t = 0; t < maxTicks; t++) {
    await wait(60);
    for (const [W, N] of pairs) {
      const G = N.G;
      if (G.busy || G.rolling || !G.online) continue;
      const me = G.online.color;
      if (G.player !== me) continue;
      if (G.phase === 'roll') W.document.getElementById('mainBtn').click();
      else if (G.phase === 'choice') W.document.getElementById(Math.random() < .5 ? 'mainBtn' : 'rerollBtn').click();
      else if (G.phase === 'move' && G.required > 0 && G.steps.length) {
        const st = G.steps[0]; const a = N.topPos(st.from, me, G.state), b = N.nextPos(st.to, me, G.state);
        const svg = W.document.getElementById('board');
        const pe = (type, x, y) => svg.dispatchEvent(new W.PointerEvent(type, { pointerId: 1, clientX: x, clientY: y, bubbles: true }));
        pe('pointerdown', a.x, a.y); pe('pointermove', a.x + 20, a.y); pe('pointermove', b.x, b.y + 14); pe('pointerup', b.x, b.y + 14);
      } else if (G.phase === 'move' && G.required === 0) W.document.getElementById('mainBtn').click();
    }
    if (stopFn()) return t;
  }
  return -1;
}
(async () => {
  const A = client('host'); let B = client('guest');
  await wait(800);
  const NA = A.__nacre; let NB = B.__nacre;
  A.document.getElementById('onlineName').value = 'Thomas';
  B.document.getElementById('onlineName').value = 'Lucas';
  await NA.onlineCreate(); await wait(200);
  const code = NA.G.online.code;
  console.log('créée', code, 'phase', NA.G.phase, 'lobby visible', !A.document.getElementById('lobbyOv').hidden, 'connecté', NA.NET.relay.connected());
  await NB.onlineJoin(code); await wait(1500);
  console.log('B a rejoint, couleur', NB.G.online.color, '| noms vus par A:', JSON.stringify(NA.G.online.names), '| par B:', JSON.stringify(NB.G.online.names));
  // 1re moitié
  await playUntil([[A, NA], [B, NB]], () => (NA.G.state.off[0] + NA.G.state.off[1]) > 0 || NA.G.online.doc.seq > 40, 1500);
  console.log('mi-partie seq', NA.G.online.doc.seq, '— coupure du serveur 1');
  for (const c of brokers[0].wss.clients) c.terminate(); brokers[0].wss.close(); brokers[0].aedes.close();
  await playUntil([[A, NA], [B, NB]], () => NA.G.online.doc.seq > 60, 1500);
  // B « recharge la page »
  const keep = {}; for (let i = 0; i < B.localStorage.length; i++) { const k = B.localStorage.key(i); keep[k] = B.localStorage.getItem(k); }
  const seqBefore = NA.G.online.doc.seq;
  B.close(); await wait(300);
  B = client('guest-reload', keep); await wait(800); NB = B.__nacre;
  await NB.onlineJoin(code); await wait(2500);
  console.log('B reprend : couleur', NB.G.online && NB.G.online.color, 'seq A', seqBefore, 'seq B', NB.G.online && NB.G.online.doc.seq, 'états égaux', JSON.stringify(NA.G.state) === JSON.stringify(NB.G.state));
  const done = await playUntil([[A, NA], [B, NB]], () => NA.G.phase === 'over' && NB.G.phase === 'over', 4000);
  console.log('fin', done >= 0 ? 'atteinte' : 'NON atteinte', '| états égaux', JSON.stringify(NA.G.state) === JSON.stringify(NB.G.state), '| sortis', NA.G.state.off, '| scores', JSON.stringify(NA.G.scores), JSON.stringify(NB.G.scores));
  console.log('écran de fin A:', A.document.getElementById('endTitle').textContent, '| B:', B.document.getElementById('endTitle').textContent, '| présence vue par A:', NA.G.online.oppOnline);
  console.log('erreurs:', errors.length ? errors.slice(0, 6) : 'aucune');
  process.exit(0);
})();
