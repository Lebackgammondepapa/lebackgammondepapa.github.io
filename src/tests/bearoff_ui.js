// Situation de Thomas : 4 pions case 1, 1 pion case 3, dés 5 et 2. On touche la case 1 puis le casier : les deux pions doivent sortir.
const { JSDOM } = require('jsdom'); const fs = require('fs'); const path = require('path');
const html = '<!doctype html><html><head><meta charset="utf-8"></head><body>' + fs.readFileSync(path.join(__dirname, '..', 'out', 'backgammon.html'), 'utf8') + '</body></html>';
const errors = [];
const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, beforeParse(w) {
  w.console.error = (...a) => errors.push(a.join(' '));
  w.HTMLCanvasElement.prototype.getContext = function () { return new Proxy({}, { get: (t, k) => (k === 'createRadialGradient' || k === 'createLinearGradient') ? (() => ({ addColorStop() {} })) : (k === 'getImageData' ? (() => ({ data: new Uint8ClampedArray(4) })) : (() => {})), set: () => true }); };
  w.HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,';
  w.requestAnimationFrame = cb => setTimeout(() => cb(w.performance.now()), 16);
  w.matchMedia = () => ({ matches: true });
  w.DOMPoint = class { constructor(x, y) { this.x = x; this.y = y; } matrixTransform() { return this; } };
  w.SVGElement.prototype.getScreenCTM = () => ({ inverse: () => ({}) });
  w.SVGElement.prototype.setPointerCapture = () => {}; w.SVGElement.prototype.releasePointerCapture = () => {};
  Object.defineProperty(w.HTMLElement.prototype, 'clientWidth', { get() { return 800; } });
  Object.defineProperty(w.HTMLElement.prototype, 'clientHeight', { get() { return 400; } });
} });
const w = dom.window, d = w.document; const wait = ms => new Promise(r => setTimeout(r, ms));
const pe = (type, x, y) => d.getElementById('board').dispatchEvent(new w.PointerEvent(type, { pointerId: 1, clientX: x, clientY: y, bubbles: true }));
(async () => {
  await wait(300); d.getElementById('startBtn').click(); await wait(100);
  const N = w.__nacre, G = N.G; G.gen += 100;
  const setup = () => { const pts = new Array(24).fill(0); pts[0] = 4; pts[2] = 1; pts[23] = -15; G.state = { pts, bar: [0, 0], off: [10, 0] }; G.player = 1; G.busy = false; G.rolling = false; N.beginTurnWithDice([5, 2]); };
  // 1) au toucher : case 1, puis casier
  setup(); await wait(50);
  const a = N.topPos(0, 1, G.state), tray = N.nextPos(25, 1, G.state);
  pe('pointerdown', a.x, a.y); pe('pointerup', a.x, a.y); await wait(30);
  console.log('case 1 sélectionnable :', G.selected === 0);
  pe('pointerdown', tray.x, tray.y); pe('pointerup', tray.x, tray.y); await wait(1800);
  console.log('au toucher -> sortis', G.state.off[0], '(attendu 12), reste case 1 :', G.state.pts[0], ', case 3 :', G.state.pts[2], ', coups restants', G.required);
  // 2) au glisser : case 1 vers le casier
  setup(); await wait(50);
  const b = N.topPos(0, 1, G.state);
  pe('pointerdown', b.x, b.y); pe('pointermove', b.x + 20, b.y); pe('pointermove', tray.x, tray.y + 14); pe('pointerup', tray.x, tray.y + 14); await wait(1800);
  console.log('au glisser -> sortis', G.state.off[0], '(attendu 12), coups restants', G.required);
  // 3) l'ordre classique marche toujours : le pion de la case 3 vers le casier avec le 5
  setup(); await wait(50);
  const c = N.topPos(2, 1, G.state);
  pe('pointerdown', c.x, c.y); pe('pointerup', c.x, c.y); await wait(30); pe('pointerdown', tray.x, tray.y); pe('pointerup', tray.x, tray.y); await wait(1200);
  console.log('case 3 puis casier -> sortis', G.state.off[0], ', dé restant', JSON.stringify(G.rem));
  console.log('erreurs :', errors.length ? errors : 'aucune'); process.exit(0);
})();
