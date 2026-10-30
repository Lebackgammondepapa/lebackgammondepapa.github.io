// Vérifie l'alignement du calque fixe et du calque des pions sur plusieurs formats, avec une position de milieu de partie.
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light}html{box-sizing:border-box}body{margin:0;font:14px system-ui}[hidden]{display:none!important}</style></head><body>' + fs.readFileSync(path.join(__dirname, '..', 'out', 'backgammon.html'), 'utf8') + '</body></html>';
fs.writeFileSync('/tmp/bglayout.html', html);
(async () => {
  const b = await chromium.launch();
  for (const [name, opts] of [['phone', { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }], ['desk', { viewport: { width: 1280, height: 760 } }], ['panel', { viewport: { width: 560, height: 820 } }]]) {
    const ctx = await b.newContext(opts); await ctx.addInitScript(() => { try { localStorage.setItem('nacre.sound', 'off'); } catch (e) { } });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('file:///tmp/bglayout.html'); await p.waitForTimeout(400);
    await p.evaluate(() => document.getElementById('startBtn').click()); await p.waitForTimeout(200);
    const info = await p.evaluate(() => {
      const N = window.__nacre, G = N.G; G.gen++;
      const pts = new Array(24).fill(0); Object.assign(pts, { 5: 4, 7: 3, 12: 4, 4: 2, 2: 1, 18: -4, 16: -3, 11: -4, 19: -2, 21: -1 });
      G.state = { pts, bar: [0, 0], off: [1, 1] }; G.player = 1; G.lastDicePlayer = 1; G.tilt = [-4, 5]; G.rolling = false; G.busy = false;
      N.beginTurnWithDice([6, 3]);
      const a = document.getElementById('board').getBoundingClientRect(), c = document.getElementById('boardBg').getBoundingClientRect();
      return { dx: +(a.left - c.left).toFixed(1), dy: +(a.top - c.top).toFixed(1), dw: +(a.width - c.width).toFixed(1), dh: +(a.height - c.height).toFixed(1) };
    });
    await p.waitForTimeout(300); await p.screenshot({ path: `/tmp/layout-${name}.png` });
    console.log(name, 'écart entre calques', JSON.stringify(info), errs.join('|') || 'aucune erreur');
    await ctx.close();
  }
  await b.close();
})();
