// Mesure de fluidité : durée des images pendant des glissements de pions et un lancer de dés, processeur ralenti x4 (proche d'un téléphone).
const { chromium } = require('playwright'); const fs = require('fs');
const file = process.argv[2]; const nobake = process.argv[3] === 'nobake';
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await ctx.addInitScript((process_nobake) => { try { localStorage.setItem('nacre.sound', 'off'); } catch (e) { } window.NACRE_BROKERS = []; if (process_nobake) window.__NOBAKE = true; }, nobake);
  const p = await ctx.newPage();
  await p.goto('file://' + file); await p.waitForTimeout(800);
  await p.evaluate(() => document.getElementById('startBtn').click()); await p.waitForTimeout(500);
  const cdp = await ctx.newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  // laisser l'ouverture se jouer, puis mesurer les images pendant plusieurs tours de l'ordinateur et du joueur
  const res = await p.evaluate(async () => {
    const N = window.__nacre, G = N.G; const frames = []; let last = performance.now(), run = true;
    const tick = t => { frames.push(t - last); last = t; if (run) requestAnimationFrame(tick); }; requestAnimationFrame(tick);
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const t0 = performance.now();
    while (performance.now() - t0 < 14000) {
      await wait(80);
      if (G.busy || G.rolling) continue;
      if (G.phase === 'choice' && G.player === 1) document.getElementById('mainBtn').click();
      else if (G.phase === 'move' && G.player === 1 && G.required > 0 && G.steps.length) {
        // jeu « au toucher » : sélection puis destination, avec glissement animé
        const st = G.steps[0]; const svg = document.getElementById('board'); const root = document.getElementById('root'); const m = root.getScreenCTM();
        const sc = q => new DOMPoint(q.x, q.y).matrixTransform(m);
        const a = sc(N.topPos(st.from, 1, G.state)), bb = sc(N.nextPos(st.to, 1, G.state));
        const pe = (ty, x, y) => svg.dispatchEvent(new PointerEvent(ty, { pointerId: 1, clientX: x, clientY: y, bubbles: true }));
        // glisser-déposer en 20 étapes pour mesurer aussi le coût du déplacement au doigt
        pe('pointerdown', a.x, a.y);
        for (let k = 1; k <= 20; k++) { pe('pointermove', a.x + (bb.x - a.x) * k / 20, a.y + (bb.y - a.y) * k / 20); await new Promise(r => requestAnimationFrame(r)); }
        pe('pointerup', bb.x, bb.y);
      } else if (G.phase === 'move' && G.player === 1 && G.required === 0) document.getElementById('mainBtn').click();
    }
    run = false;
    const f = frames.slice(5).sort((x, y) => x - y);
    const avg = f.reduce((s, x) => s + x, 0) / f.length;
    return { frames: f.length, avg: +avg.toFixed(1), p95: +f[Math.floor(f.length * .95)].toFixed(1), max: +f[f.length - 1].toFixed(1), janky: f.filter(x => x > 34).length };
  });
  console.log(file.split('/').pop(), JSON.stringify(res));
  await b.close();
})();
