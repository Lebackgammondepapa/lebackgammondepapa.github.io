const E = require('../engine.js');
let bad = 0;
for (const lim of [0, 5]) {
  E.setMaxStack(lim); let maxSeen = 0;
  for (let g = 0; g < 30; g++) {
    let s = E.initState(), p = 1, n = 0;
    while (!E.winner(s) && n < 500) { const d = [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)]; const m = E.chooseMove(s, p, d, 2); if (m) s = m.state; for (const c of s.pts) maxSeen = Math.max(maxSeen, Math.abs(c)); p = -p; n++; }
    if (!E.winner(s)) bad++;
  }
  console.log('limit', lim, 'max stack seen', maxSeen);
  if (lim === 5 && maxSeen > 5) bad++;
}
// cas précis : case à 5 pions bloquée
E.setMaxStack(5);
const s = { pts: new Array(24).fill(0), bar: [0, 0], off: [0, 0] }; s.pts[5] = 5; s.pts[8] = 1; s.pts[23] = -2;
const t = E.startTurn(s, 1, [3, 3]);
console.log('from 8 with 3s:', t.steps.map(x => [x.from, x.to]), 'required', t.required);
if (t.steps.some(x => x.to === 5)) bad++;
console.log(bad ? 'FAIL' : 'OK');
