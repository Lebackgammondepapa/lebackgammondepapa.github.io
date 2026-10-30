const { JSDOM } = require('jsdom'); const fs = require('fs');
const html = '<!doctype html><html><head><meta charset="utf-8"></head><body>' + fs.readFileSync('out/backgammon.html', 'utf8') + '</body></html>';
// faux store partagé
const store = new Map(), listeners = new Map();
const clone = o => JSON.parse(JSON.stringify(o));
function notify(path) { const d = store.get(path); for (const fn of (listeners.get(path) || [])) setTimeout(() => fn({ exists: !!d, data: () => d ? clone(d) : undefined }), 20); }
const db = { doc(path) { return {
  async get() { const d = store.get(path); return { exists: !!d, data: () => d ? clone(d) : undefined }; },
  async set(d) { store.set(path, clone(d)); notify(path); },
  async delete() { store.delete(path); notify(path); },
  async acquire() { return { acquired: true }; },
  onSnapshot(fn) { if (!listeners.has(path)) listeners.set(path, []); listeners.get(path).push(fn); notify(path); return () => {}; },
}; } };
const errors = [];
function client(id, name) {
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, beforeParse(w) {
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
    const user = { id: async () => id, profiles: async ids => Object.fromEntries([].concat(ids).map(x => [x, { id: x, name: x === 'u-host' ? 'Thomas' : 'Ami' }])) };
    w.claude = { use: async n => ({ db, user, room: null })[n] || null };
  } });
  dom.window.addEventListener('error', e => errors.push(id + ' uncaught: ' + e.message + ' ' + (e.error && e.error.stack)));
  return dom.window;
}
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const A = client('u-host'), B = client('u-guest');
  await wait(500);
  const NA = A.__nacre, NB = B.__nacre;
  await NA.onlineCreate(); await wait(100);
  const code = NA.G.online.code;
  console.log('code', code, 'A phase', NA.G.phase, 'lobby', !A.document.getElementById('lobbyOv').hidden);
  await NB.onlineJoin(code); await wait(200);
  console.log('B joined color', NB.G.online.color, 'flip ok');
  // boucle de jeu : chacun joue le premier coup légal quand c'est son tour
  let checks = 0, mism = 0;
  for (let t = 0; t < 3000; t++) {
    await wait(60);
    { const a = NA.G, b = NB.G; if (!a.busy && !b.busy && !a.rolling && !b.rolling && a.phase === 'roll' && b.phase === 'roll' && a.player === b.player) { checks++; if (JSON.stringify(a.state) !== JSON.stringify(b.state)) { mism++; if (mism < 3) console.log('MISMATCH at', t, JSON.stringify(a.state.off), JSON.stringify(b.state.off)); } } }
    for (const [W, N] of [[A, NA], [B, NB]]) {
      const G = N.G;
      if (G.busy || G.rolling || !G.online) continue;
      const me = G.online.color;
      if (G.player !== me) continue;
      if (G.phase === 'roll') W.document.getElementById('mainBtn').click();
      else if (G.phase === 'move' && G.required > 0 && G.steps.length) {
        const st = G.steps[0];
        // jeu au toucher : sélection puis destination
        G.selected = st.from; W.__nacre.G.selected = st.from;
        const evt = W.document.createEvent('Event');
        // simplification : appliquer via l'API interne de jeu au toucher
        W.__play && W.__play(st);
        if (!W.__play) { // fallback : simuler pointer events via coordonnées internes
          const a = N.topPos(st.from, me, G.state), b = N.nextPos(st.to, me, G.state);
          const svg = W.document.getElementById('board');
          const pe = (type, x, y) => svg.dispatchEvent(new W.PointerEvent(type, { pointerId: 1, clientX: x, clientY: y, bubbles: true }));
          G.selected = null;
          pe('pointerdown', a.x, a.y); pe('pointermove', a.x + 20, a.y); pe('pointermove', b.x, b.y + 14); pe('pointerup', b.x, b.y + 14);
        }
      } else if (G.phase === 'move' && G.required === 0) W.document.getElementById('mainBtn').click();
    }
    if (NA.G.phase === 'over' && NB.G.phase === 'over') break;
  }
  console.log('consistency checks', checks, 'mismatches', mism);
  const sA = JSON.stringify(NA.G.state), sB = JSON.stringify(NB.G.state);
  console.log('A phase', NA.G.phase, 'B phase', NB.G.phase, 'states equal', sA === sB, 'off', NA.G.state.off, NB.G.state.off, 'scores', NA.G.scores, NB.G.scores, 'seq', store.get('games/' + code).seq);
  console.log('end overlay A', !A.document.getElementById('endOv').hidden, A.document.getElementById('endTitle').textContent, '| B', B.document.getElementById('endTitle').textContent);
  console.log('errors:', errors.length ? errors.slice(0, 5) : 'none');
  process.exit(0);
})();
