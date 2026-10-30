const { JSDOM } = require('jsdom'); const fs = require('fs');
const html = '<!doctype html><html><head><meta charset="utf-8"></head><body>' + fs.readFileSync('out/backgammon.html', 'utf8') + '</body></html>';
const errors = [];
const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, beforeParse(w) {
  w.console.error = (...a) => errors.push(a.join(' '));
  w.HTMLCanvasElement.prototype.getContext = function () { return new Proxy({}, { get: (t, k) => (k === 'createRadialGradient' || k === 'createLinearGradient') ? (() => ({ addColorStop() {} })) : (() => {}), set: () => true }); };
  w.HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,';
  w.requestAnimationFrame = cb => setTimeout(() => cb(w.performance.now()), 16);
  w.matchMedia = () => ({ matches: true });
  w.DOMPoint = class { constructor(x, y) { this.x = x; this.y = y; } matrixTransform() { return this; } };
  w.SVGElement.prototype.getScreenCTM = () => ({ inverse: () => ({}) });
  w.SVGElement.prototype.setPointerCapture = () => {}; w.SVGElement.prototype.releasePointerCapture = () => {};
  Object.defineProperty(w.HTMLElement.prototype, 'clientWidth', { get() { return 800; } });
  Object.defineProperty(w.HTMLElement.prototype, 'clientHeight', { get() { return 500; } });
} });
dom.window.addEventListener('error', e => errors.push('uncaught: ' + e.message));
const w = dom.window, d = w.document;
const pe = (type, x, y) => d.getElementById('board').dispatchEvent(new w.PointerEvent(type, { pointerId: 1, clientX: x, clientY: y, bubbles: true }));
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await wait(400);
  d.getElementById('startBtn').click();
  const N = w.__nacre, G = N.G;
  d.getElementById('mainBtn').click();
  for (let k = 0; k < 40 && !(G.phase === 'move' && G.player === 1); k++) { await wait(500); if (G.phase === 'roll' && G.player === 1 && !G.busy && !G.rolling) d.getElementById('mainBtn').click(); }
  console.log('phase', G.phase, 'player', G.player, 'dice', G.dice, 'required', G.required);
  // drag the first legal step
  let st = G.steps[0]; let a = N.topPos(st.from, G.player, G.state), b = N.nextPos(st.to, G.player, G.state);
  pe('pointerdown', a.x, a.y); pe('pointermove', a.x + 20, a.y + 20); pe('pointermove', b.x, b.y + 14); pe('pointerup', b.x, b.y + 14);
  await wait(600);
  console.log('after drag: required', G.required, 'history', G.history.length, 'steps', G.steps.length);
  if (G.steps.length) { st = G.steps[0]; a = N.topPos(st.from, G.player, G.state); b = N.nextPos(st.to, G.player, G.state);
    pe('pointerdown', a.x, a.y); pe('pointerup', a.x, a.y); await wait(50); console.log('selected', G.selected);
    pe('pointerdown', b.x, b.y); pe('pointerup', b.x, b.y); await wait(1200);
    console.log('after tap move: required', G.required, 'history', G.history.length); }
  // sortie des pions : position de fin, 6-5
  { const st0 = { pts: new Array(24).fill(0), bar: [0, 0], off: [12, 10] }; st0.pts[0] = 2; st0.pts[4] = 1; st0.pts[23] = -5; G.state = st0; G.phase = 'move'; G.player = 1; N.beginTurnWithDice([6, 5]); await wait(50);
    console.log('bearoff required', G.required, 'steps', G.steps.map(x => [x.from, x.to]));
    let s1 = G.steps.find(x => x.to === 25); let a1 = N.topPos(s1.from, 1, G.state), b1 = N.nextPos(25, 1, G.state);
    pe('pointerdown', a1.x, a1.y); pe('pointermove', a1.x + 30, a1.y); pe('pointermove', b1.x, b1.y + 14); pe('pointerup', b1.x, b1.y + 14); await wait(700);
    console.log('after drag off: off', G.state.off, 'required', G.required);
    s1 = G.steps.find(x => x.to === 25); if (s1) { a1 = N.topPos(s1.from, 1, G.state); pe('pointerdown', a1.x, a1.y); pe('pointerup', a1.x, a1.y); await wait(30); pe('pointerdown', b1.x, b1.y); pe('pointerup', b1.x, b1.y); await wait(1200); console.log('after tap off: off', G.state.off, 'required', G.required, 'slabs', d.querySelectorAll('#board rect[rx="3.5"]').length / 3); }
  }
  d.getElementById('undoBtn').click(); await wait(50); console.log('after undo required', G.required);
  // redo via tap then end turn
  for (let it = 0; it < 4 && G.required > 0; it++) { st = G.steps[0]; a = N.topPos(st.from, G.player, G.state); b = N.nextPos(st.to, G.player, G.state); pe('pointerdown', a.x, a.y); pe('pointerup', a.x, a.y); await wait(30); pe('pointerdown', b.x, b.y); pe('pointerup', b.x, b.y); await wait(1200); }
  console.log('main button', d.getElementById('mainBtn').textContent); d.getElementById('mainBtn').click();
  await wait(7000);
  console.log('after AI turn: phase', G.phase, 'player', G.player, 'pips', d.getElementById('subB').textContent);
  console.log('errors:', errors.length ? errors : 'none'); process.exit(errors.length ? 1 : 0);
})();
