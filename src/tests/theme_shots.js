// Capture chaque thème sur une position de milieu de partie, puis assemble une planche 2 x 2.
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const page_html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light}html{box-sizing:border-box}body{margin:0;font:14px system-ui}[hidden]{display:none!important}</style></head><body>' + fs.readFileSync(path.join(__dirname, '..', 'out', 'backgammon.html'), 'utf8') + '</body></html>';
fs.writeFileSync('/tmp/bgthemes.html', page_html);
(async () => {
  const b = await chromium.launch();
  const shots = [];
  for (const key of ['marine']) {
    const ctx = await b.newContext({ viewport: { width: 1100, height: 560 }, deviceScaleFactor: 1.5 });
    await ctx.addInitScript(k => { try { localStorage.setItem('nacre.theme', k); localStorage.setItem('nacre.sound', 'off'); } catch (e) { } }, key);
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('file:///tmp/bgthemes.html'); await p.waitForTimeout(500);
    await p.click('#startBtn'); await p.waitForTimeout(300);
    await p.evaluate(() => {
      const N = window.__nacre, G = N.G; G.gen++;
      const pts = new Array(24).fill(0);
      Object.assign(pts, { 5: 4, 7: 3, 12: 4, 4: 2, 2: 1, 18: -4, 16: -3, 11: -4, 19: -2, 21: -1 });
      G.state = { pts, bar: [0, 0], off: [1, 1] }; G.player = 1; G.lastDicePlayer = 1; G.tilt = [-4, 5, 0, 0];
      N.beginTurnWithDice([6, 3]);
    });
    await p.waitForTimeout(400);
    const file = `/tmp/theme-${key}.png`; await p.screenshot({ path: file }); shots.push([key, file]);
    if (errs.length) console.log(key, 'erreurs', errs);
    await ctx.close();
  }
  if (shots.length < 2) { await b.close(); console.log('ok'); return; }
  // planche
  const ctx = await b.newContext({ viewport: { width: 1650 * 2 / 1.5, height: 840 * 2 / 1.5 + 80 } }); const p = await ctx.newPage();
  const imgs = shots.map(([k, f]) => [k, 'data:image/png;base64,' + fs.readFileSync(f).toString('base64')]);
  await p.setContent(`<html><body style="margin:0;background:#111;display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:10px;font:600 22px system-ui;color:#eee">${imgs.map(([k, u]) => `<div><div style="padding:4px 2px 8px">${{ club: 'Club (feutre vert)', noyer: 'Noyer (bois)', marine: 'Marine (feutre bleu)', nacre: 'Nacre (actuel)' }[k]}</div><img src="${u}" style="width:100%;display:block;border-radius:6px"></div>`).join('')}</body></html>`);
  await p.waitForTimeout(300);
  await p.screenshot({ path: '/tmp/themes-planche.png', fullPage: true });
  await b.close(); console.log('ok');
})();
