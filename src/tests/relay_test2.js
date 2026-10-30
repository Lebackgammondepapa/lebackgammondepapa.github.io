// Tous les serveurs redémarrent en pleine partie (ils oublient tout) : les joueurs doivent republier la partie et continuer.
const { JSDOM } = require('jsdom'); const fs = require('fs'); const ws = require('ws');
const html = fs.readFileSync('../index.html', 'utf8');
const PORTS = [18841, 18842];
let brokers = [];
function startBrokers() { brokers = PORTS.map(port => { const aedes = require('aedes')(); const wss = new ws.WebSocketServer({ port }); wss.on('connection', s => aedes.handle(ws.createWebSocketStream(s))); return { aedes, wss }; }); }
function stopBrokers() { return Promise.all(brokers.map(b => new Promise(r => { for (const c of b.wss.clients) c.terminate(); b.wss.close(() => r()); b.aedes.close(); }))); }
startBrokers();
const errors = [];
function client(id) {
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
    w.NACRE_BROKERS = PORTS.map(p => 'ws://127.0.0.1:' + p); w.NACRE_MQTT_OPTS = { timerVariant: 'native' };
  } });
  dom.window.addEventListener('error', e => errors.push(id + ' uncaught: ' + e.message));
  return dom.window;
}
const wait = ms => new Promise(r => setTimeout(r, ms));
async function play(pairs, stop, max) {
  for (let t = 0; t < max; t++) {
    await wait(60);
    for (const [W, N] of pairs) { const G = N.G; if (G.busy || G.rolling || !G.online || G.player !== G.online.color) continue; const me = G.online.color;
      if (G.phase === 'roll') W.document.getElementById('mainBtn').click();
      else if (G.phase === 'move' && G.required > 0 && G.steps.length) { const st = G.steps[0]; const a = N.topPos(st.from, me, G.state), b = N.nextPos(st.to, me, G.state); const svg = W.document.getElementById('board'); const pe = (ty, x, y) => svg.dispatchEvent(new W.PointerEvent(ty, { pointerId: 1, clientX: x, clientY: y, bubbles: true })); pe('pointerdown', a.x, a.y); pe('pointermove', a.x + 20, a.y); pe('pointermove', b.x, b.y + 14); pe('pointerup', b.x, b.y + 14); }
      else if (G.phase === 'move' && G.required === 0) W.document.getElementById('mainBtn').click(); }
    if (stop()) return t;
  }
  return -1;
}
(async () => {
  const A = client('A'), B = client('B'); await wait(800);
  const NA = A.__nacre, NB = B.__nacre;
  await NA.onlineCreate(); await wait(200); const code = NA.G.online.code;
  await NB.onlineJoin(code); await wait(1200);
  await play([[A, NA], [B, NB]], () => NA.G.online.doc.seq > 25, 2000);
  console.log('avant redémarrage seq', NA.G.online.doc.seq, NB.G.online.doc.seq);
  await stopBrokers(); await wait(1500); startBrokers();
  await wait(6000);
  console.log('après redémarrage : connectés', NA.NET.relay.connected(), NB.NET.relay.connected());
  const end = await play([[A, NA], [B, NB]], () => NA.G.phase === 'over' && NB.G.phase === 'over', 5000);
  console.log('fin', end >= 0 ? 'atteinte' : 'NON atteinte', 'états égaux', JSON.stringify(NA.G.state) === JSON.stringify(NB.G.state), 'seq', NA.G.online.doc.seq, NB.G.online.doc.seq, 'sortis', NA.G.state.off);
  console.log('erreurs:', errors.length ? errors.slice(0, 5) : 'aucune');
  process.exit(0);
})();
