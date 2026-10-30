const E = require('../engine.js');
const { BAR, OFF } = E;
let fails = 0;
function eq(name, got, exp) { const ok = JSON.stringify(got) === JSON.stringify(exp); if (!ok) { fails++; console.log('FAIL', name, 'got', JSON.stringify(got), 'exp', JSON.stringify(exp)); } else console.log('ok  ', name); }

// 1. position initiale, 3-1 pour W : 8/5 6/5 doit exister
let s = E.initState();
let turns = E.genTurns(s, 1, [3, 1]);
eq('3-1 has plays', turns.length > 10, true);
const has85 = turns.some(t => t.steps.some(x => x.from === 7 && x.to === 4) && t.steps.some(x => x.from === 5 && x.to === 4));
eq('3-1 makes 5pt', has85, true);

// 2. doubles 6-6 à l'ouverture pour W : 24/18(2) 13/7(2) => 4 pions bougent
turns = E.genTurns(s, 1, [6, 6]);
eq('6-6 len', turns.every(t => t.steps.length === 4), true);

// 3. barre : W a 2 pions sur la barre, B a fermé les points 18..22 (sauf 23)
s = E.initState(); s.pts[23] = 0; s.bar[0] = 2; s.pts[18] = -2; s.pts[19] = -2; s.pts[20] = -2; s.pts[21] = -2; s.pts[22] = -2; s.pts[11] = -3;
let st = E.startTurn(s, 1, [1, 3]);
eq('bar required 1', st.required, 1);
eq('bar only die 1 enter', st.steps.map(x => [x.from, x.to, x.die]), [[BAR, 23, 1]]);
st = E.startTurn(s, 1, [1, 1]);
eq('bar 1-1 required 2 then more', st.required >= 2, true);

// 4. règle du plus gros dé : seul un des deux dés jouable chacun séparément -> le plus gros
s = { pts: new Array(24).fill(0), bar: [0, 0], off: [0, 0] };
s.pts[6] = 1; // W sur le 7-point
s.pts[0] = -2; s.pts[1] = -2; s.pts[2] = -2; s.pts[3] = -2; // B bloque 1..4
// W au 7-pt (index 6) : dé 5 -> index 1 bloqué ; dé 6 -> index 0 bloqué ; dé 2 -> index 4 libre ; dé 3 -> 3 bloqué
s.pts[5] = -1; // index 5 blot B
// dés 2-4 : 2 -> idx4 ok ; 4 -> idx2 bloqué ; après 2 (idx4), 4 -> idx0 bloqué. Après ? 4 d'abord impossible. required = 1, seul le 2 jouable => ok on garde le 2
st = E.startTurn(s, 1, [2, 4]);
eq('only small playable', st.steps.map(x => x.die), [2]);
// dés 1-2 : 1 -> idx5 (frappe) ok ; 2 -> idx4 ok ; 1 puis 2 : idx5 -> idx3 bloqué ; 2 puis 1 : idx4 -> idx3 bloqué ; required = 1 -> doit jouer le 2
st = E.startTurn(s, 1, [1, 2]);
eq('bigger die rule', st.steps.map(x => x.die), [2]);

// 5. sortie : W tous dans la maison
s = { pts: new Array(24).fill(0), bar: [0, 0], off: [0, 12] };
s.pts[0] = 2; s.pts[2] = 2; s.pts[4] = 1; s.pts[23] = -3;
eq('canBearOff', E.canBearOff(s, 1), true);
st = E.startTurn(s, 1, [6, 5]);
// 6 : plus haut pion sur idx4 (5-point) -> sort avec 6 ; 5 : idx4 exact -> sort ; puis 6 : plus haut idx2 -> sort
eq('bearoff required 2', st.required, 2);
const offSteps = st.steps.filter(x => x.to === OFF).map(x => [x.from, x.die]);
eq('bearoff steps', offSteps, [[4, 6], [4, 5]]);
// 1-2 : idx4 ne sort pas ; 1: idx0 sort (exact), idx4->3, idx2->1 ; 2: idx2 sort, idx4->2, ...
st = E.startTurn(s, 1, [1, 2]);
eq('bearoff small dice required 2', st.required, 2);
eq('no overshoot with low die', st.steps.some(x => x.to === OFF && x.from === 4), false);

// 6. gagnant / points
s = { pts: new Array(24).fill(0), bar: [0, 0], off: [15, 0] }; s.pts[3] = -2; s.pts[12] = -13;
eq('winner W', E.winner(s), 1);
eq('backgammon', E.winPoints(s, 1), 3);
s.pts[3] = 0; s.pts[12] = -15;
eq('gammon', E.winPoints(s, 1), 2);
s.off[1] = 1; s.pts[12] = -14;
eq('simple', E.winPoints(s, 1), 1);

// 7. IA : chaque niveau renvoie un coup légal et rapide
for (const lvl of [1, 2, 3]) {
  const t0 = Date.now();
  const mv = E.chooseMove(E.initState(), -1, [4, 2], lvl);
  console.log('level', lvl, 'ms', Date.now() - t0, 'steps', JSON.stringify(mv.steps.map(x => [x.from, x.to])));
  eq('ai legal ' + lvl, mv.steps.length, 2);
}
// expert sur un double (branchement max)
let t0 = Date.now();
let mv = E.chooseMove(E.initState(), -1, [3, 3], 3);
console.log('expert 3-3 ms', Date.now() - t0, JSON.stringify(mv.steps.map(x => [x.from, x.to])));

// 8. partie complète IA vs IA pour vérifier qu'on termine toujours
for (let g = 0; g < 5; g++) {
  let state = E.initState(), p = 1, n = 0;
  while (!E.winner(state) && n < 400) {
    const dice = [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)];
    const m = E.chooseMove(state, p, dice, 2);
    if (m) state = m.state;
    p = -p; n++;
  }
  console.log('game', g, 'winner', E.winner(state), 'turns', n, 'pts', E.winPoints(state, E.winner(state)));
  if (!E.winner(state)) fails++;
}
console.log(fails ? `${fails} FAILURES` : 'ALL OK');
