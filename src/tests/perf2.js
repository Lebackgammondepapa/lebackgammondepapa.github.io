// Mesure de rendu contrôlée (sans calcul d'IA) : glisser un pion, lancer les dés, attente avec surbrillances. Processeur ralenti x4.
const { chromium } = require('playwright');
const file = process.argv[2], nobake = process.argv[3] === 'nobake';
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await ctx.addInitScript(nb => { try { localStorage.setItem('nacre.sound', 'off'); } catch (e) { } window.NACRE_BROKERS = []; if (nb) window.__NOBAKE = true; }, nobake);
  const p = await ctx.newPage();
  await p.goto('file://' + file); await p.waitForTimeout(800);
  await p.evaluate(() => { document.querySelector('.mode[data-mode="2p"]').click(); document.getElementById('startBtn').click(); });
  await p.waitForTimeout(1500);
  const cdp = await ctx.newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const res = await p.evaluate(async () => {
    const N = window.__nacre, G = N.G; G.gen = (G.gen || 0) + 1000;
    const wait = ms => new Promise(r => setTimeout(r, ms)); const raf = () => new Promise(r => requestAnimationFrame(r));
    const setPos = () => { const pts = new Array(24).fill(0); Object.assign(pts, { 5: 4, 7: 3, 12: 4, 4: 2, 2: 1, 18: -4, 16: -3, 11: -4, 19: -2, 21: -1 }); G.state = { pts, bar: [0, 0], off: [1, 1] }; G.player = 1; G.lastDicePlayer = 1; G.busy = false; G.rolling = false; };
    const measure = async (fn) => { const fr = []; let last = performance.now(), run = true; const tick = t => { fr.push(t - last); last = t; if (run) requestAnimationFrame(tick); }; requestAnimationFrame(tick); await fn(); run = false; await raf(); return fr.slice(2); };
    const svg = document.getElementById('board'), root = document.getElementById('root');
    const pe = (ty, x, y) => svg.dispatchEvent(new PointerEvent(ty, { pointerId: 1, clientX: x, clientY: y, bubbles: true }));
    setPos(); N.beginTurnWithDice([6, 5]); await wait(300);
    const drag = await measure(async () => {
      for (let rep = 0; rep < 4; rep++) {
        const m = root.getScreenCTM(); const sc = q => new DOMPoint(q.x, q.y).matrixTransform(m);
        const a = sc(N.topPos(12, 1, G.state)), bb = sc(N.topPos(5, 1, G.state));
        pe('pointerdown', a.x, a.y);
        for (let k = 1; k <= 40; k++) { pe('pointermove', a.x + (bb.x - a.x) * k / 40, a.y + (bb.y - a.y) * k / 40 - 20); await raf(); }
        pe('pointercancel', bb.x, bb.y); await wait(400);
      }
    });
    const dice = await measure(async () => {
      for (let rep = 0; rep < 3; rep++) { setPos(); G.phase = 'roll'; G.dice = null; document.getElementById('mainBtn').click(); await wait(1900); }
    });
    setPos(); N.beginTurnWithDice([6, 5]); await wait(200);
    const idle = await measure(() => wait(2500));
    const st = f => { const s = f.slice().sort((x, y) => x - y); const avg = s.reduce((a, x) => a + x, 0) / s.length; return { n: s.length, avg: +avg.toFixed(1), p95: +s[Math.floor(s.length * .95)].toFixed(1), janky: s.filter(x => x > 34).length }; };
    return { drag: st(drag), dice: st(dice), idle: st(idle) };
  });
  console.log((nobake ? 'sans image figée ' : '') + file.split('/').pop(), JSON.stringify(res));
  await b.close();
})();
