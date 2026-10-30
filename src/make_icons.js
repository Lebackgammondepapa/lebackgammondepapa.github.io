const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  const sizes = [180, 192, 512];
  const out = await p.evaluate((sizes) => {
    function draw(S) {
      const c = document.createElement('canvas'); c.width = S; c.height = S; const g = c.getContext('2d'); const k = S / 512;
      // fond bleu profond
      const bg = g.createRadialGradient(S * .5, S * .38, S * .05, S * .5, S * .5, S * .75); bg.addColorStop(0, '#2b5597'); bg.addColorStop(.6, '#1a3a74'); bg.addColorStop(1, '#0c1d45');
      g.fillStyle = bg; g.fillRect(0, 0, S, S);
      // flèches discrètes en haut et en bas
      const tri = (x, top, col) => { g.beginPath(); const w = 46 * k, h = 150 * k; if (top) { g.moveTo(x - w, 0); g.lineTo(x + w, 0); g.lineTo(x, h); } else { g.moveTo(x - w, S); g.lineTo(x + w, S); g.lineTo(x, S - h); } g.closePath(); g.fillStyle = col; g.fill(); };
      const xs = [70, 164, 258, 352, 446].map(v => v * k);
      xs.forEach((x, i) => { tri(x, true, i % 2 ? 'rgba(127,161,212,.55)' : 'rgba(215,222,233,.42)'); tri(x, false, i % 2 ? 'rgba(215,222,233,.42)' : 'rgba(127,161,212,.55)'); });
      // pion : ombre, corps, reflets
      function checker(cx, cy, r, white) {
        g.save(); g.shadowColor = 'rgba(4,12,32,.55)'; g.shadowBlur = 26 * k; g.shadowOffsetY = 12 * k;
        g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fillStyle = white ? '#f3f2ec' : '#21478f'; g.fill(); g.restore();
        g.save(); g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.clip();
        const body = g.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
        if (white) { body.addColorStop(0, '#ffffff'); body.addColorStop(.45, '#efeee8'); body.addColorStop(1, '#cfd6e2'); }
        else { body.addColorStop(0, '#4d7fd0'); body.addColorStop(.5, '#22498f'); body.addColorStop(1, '#132c5c'); }
        g.fillStyle = body; g.fillRect(cx - r, cy - r, 2 * r, 2 * r);
        // irisations / veines
        for (let i = 0; i < 9; i++) {
          g.beginPath(); const a0 = i * .7, rr = r * (.35 + (i % 4) * .14);
          g.arc(cx + Math.cos(a0) * r * .25, cy + Math.sin(a0) * r * .2, rr, a0, a0 + 1.6);
          g.strokeStyle = white ? ['rgba(244,214,226,.55)', 'rgba(205,224,245,.6)', 'rgba(236,240,214,.5)'][i % 3] : 'rgba(210,228,255,.28)';
          g.lineWidth = (white ? 9 : 5) * k; g.stroke();
        }
        const gl = g.createRadialGradient(cx - r * .3, cy - r * .38, 0, cx - r * .3, cy - r * .38, r * .9);
        gl.addColorStop(0, 'rgba(255,255,255,.85)'); gl.addColorStop(.45, 'rgba(255,255,255,.12)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gl; g.fillRect(cx - r, cy - r, 2 * r, 2 * r);
        g.restore();
        g.beginPath(); g.arc(cx, cy, r - 1.5 * k, 0, Math.PI * 2); g.strokeStyle = white ? 'rgba(120,135,160,.55)' : 'rgba(8,24,60,.7)'; g.lineWidth = 3 * k; g.stroke();
        g.beginPath(); g.arc(cx, cy, r * .72, 0, Math.PI * 2); g.strokeStyle = white ? 'rgba(255,255,255,.55)' : 'rgba(160,190,240,.35)'; g.lineWidth = 2.2 * k; g.stroke();
      }
      checker(S * .6, S * .58, 128 * k, false);
      checker(S * .4, S * .43, 128 * k, true);
      return c.toDataURL('image/png');
    }
    return sizes.map(s => draw(s));
  }, sizes);
  sizes.forEach((s, i) => fs.writeFileSync(`public/icon-${s}.png`, Buffer.from(out[i].split(',')[1], 'base64')));
  await b.close(); console.log('ok');
})();
