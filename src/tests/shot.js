const { chromium } = require('playwright'); const fs = require('fs');
const page_html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light}body{margin:0;font:14px system-ui}[hidden]{display:none!important}</style></head><body>' + fs.readFileSync('out/backgammon.html', 'utf8') + '</body></html>';
fs.writeFileSync('/tmp/bgpage.html', page_html);
(async () => {
  const b = await chromium.launch();
  const cases = [['desk-wide', { viewport: { width: 1280, height: 760 } }], ['desk-panel', { viewport: { width: 560, height: 820 } }], ['phone-land', { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }]];
  for (const [name, opts] of cases) {
    const ctx = await b.newContext(Object.assign({ colorScheme: 'dark' }, opts)); const p = await ctx.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('file:///tmp/bgpage.html'); await p.waitForTimeout(600);
    await p.click('#startBtn'); await p.waitForTimeout(400);
    await p.click('#mainBtn'); await p.waitForTimeout(4200);
    const info = await p.evaluate(() => ({ device: document.body.dataset.device, stack: document.body.classList.contains('layout-stack'), rotate: !document.getElementById('rotateOv').hidden, sw: document.documentElement.scrollWidth, w: innerWidth }));
    console.log(name, JSON.stringify(info), errs.join('|') || 'no errors');
    await p.screenshot({ path: `/tmp/${name}.png` }); await ctx.close();
  }
  await b.close();
})();
