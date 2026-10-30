/* ===== Moteur de backgammon =====
   Joueurs : W = +1 (joue de 23 vers 0, jan intérieur 0..5)
             B = -1 (joue de 0 vers 23, jan intérieur 18..23)
   pts[i] > 0 : pions W, pts[i] < 0 : pions B
   BAR = 24 (source), OFF = 25 (destination)
*/
const BAR = 24, OFF = 25;
// variante des anciennes règles anglaises : 0 = pas de limite (règle officielle), 5 = au plus 5 pions par case
let MAX_STACK = 0;
function setMaxStack(n) { MAX_STACK = n || 0; }
const bi = p => (p === 1 ? 0 : 1);

function initState() {
  const pts = new Array(24).fill(0);
  pts[23] = 2; pts[12] = 5; pts[7] = 3; pts[5] = 5;
  pts[0] = -2; pts[11] = -5; pts[16] = -3; pts[18] = -5;
  return { pts, bar: [0, 0], off: [0, 0] };
}
function cloneState(s) { return { pts: s.pts.slice(), bar: s.bar.slice(), off: s.off.slice() }; }
function stateKey(s) { return s.pts.join(',') + '|' + s.bar.join(',') + '|' + s.off.join(','); }

function canBearOff(s, p) {
  if (s.bar[bi(p)] > 0) return false;
  for (let i = 0; i < 24; i++) {
    if (s.pts[i] * p > 0) {
      if (p === 1 && i > 5) return false;
      if (p === -1 && i < 18) return false;
    }
  }
  return true;
}

/* Renvoie {to, hit} ou null */
function stepTarget(s, p, from, d) {
  const k = bi(p);
  if (s.bar[k] > 0) {
    if (from !== BAR) return null;
    const to = p === 1 ? 24 - d : d - 1;
    const v = s.pts[to] * p;
    if (v < -1) return null;
    if (MAX_STACK && v >= MAX_STACK) return null;
    return { to, hit: v === -1 };
  }
  if (from === BAR) return null;
  if (s.pts[from] * p <= 0) return null;
  const to = from - p * d;
  if (to >= 0 && to <= 23) {
    const v = s.pts[to] * p;
    if (v < -1) return null;
    if (MAX_STACK && v >= MAX_STACK) return null;
    return { to, hit: v === -1 };
  }
  if (!canBearOff(s, p)) return null;
  const exact = (p === 1 && to === -1) || (p === -1 && to === 24);
  if (exact) return { to: OFF, hit: false };
  // dépassement : autorisé seulement si aucun pion plus éloigné du bord
  if (p === 1) { for (let i = from + 1; i <= 5; i++) if (s.pts[i] > 0) return null; }
  else { for (let i = from - 1; i >= 18; i--) if (s.pts[i] < 0) return null; }
  return { to: OFF, hit: false };
}

/* Pion sur la barre sans aucune entrée possible, quel que soit le dé (les 6 cases d'arrivée bloquées par l'adversaire,
   ou par ses propres piles de 5 avec la règle maison) : inutile de lancer, la main passe directement */
function closedOut(s, p) {
  if (s.bar[bi(p)] <= 0) return false;
  for (let d = 1; d <= 6; d++) if (stepTarget(s, p, BAR, d)) return false;
  return true;
}

function applyStep(s, p, step) {
  const n = cloneState(s);
  const k = bi(p), ko = bi(-p);
  if (step.from === BAR) n.bar[k]--; else n.pts[step.from] -= p;
  if (step.to === OFF) n.off[k]++;
  else {
    if (step.hit) { n.pts[step.to] = 0; n.bar[ko]++; }
    n.pts[step.to] += p;
  }
  return n;
}

function sources(s, p) {
  if (s.bar[bi(p)] > 0) return [BAR];
  const out = [];
  for (let i = 0; i < 24; i++) if (s.pts[i] * p > 0) out.push(i);
  return out;
}

function diceList(dice) {
  const [a, b] = dice;
  return a === b ? [a, a, a, a] : [a, b];
}

/* Nombre maximal de dés jouables depuis s avec les dés restants rem */
function maxPlayable(s, p, rem) {
  if (rem.length === 0) return 0;
  const uniq = [...new Set(rem)];
  let best = 0;
  for (const d of uniq) {
    const rest = rem.slice(); rest.splice(rest.indexOf(d), 1);
    for (const from of sources(s, p)) {
      const t = stepTarget(s, p, from, d);
      if (!t) continue;
      const v = 1 + maxPlayable(applyStep(s, p, { from, to: t.to, hit: t.hit, die: d }), p, rest);
      if (v > best) best = v;
      if (best === rem.length) return best;
    }
  }
  return best;
}

/* Coups élémentaires autorisés à ce stade du tour.
   required = nombre de dés qu'il reste obligatoirement à jouer. */
function allowedSteps(s, p, rem, required) {
  const out = [];
  if (required <= 0) return out;
  const uniq = [...new Set(rem)];
  for (const d of uniq) {
    const rest = rem.slice(); rest.splice(rest.indexOf(d), 1);
    for (const from of sources(s, p)) {
      const t = stepTarget(s, p, from, d);
      if (!t) continue;
      const step = { from, to: t.to, hit: t.hit, die: d };
      if (1 + maxPlayable(applyStep(s, p, step), p, rest) >= required) out.push(step);
    }
  }
  return out;
}

/* Prépare un tour : dés restants, longueur obligatoire, règle du plus gros dé */
function startTurn(s, p, dice) {
  const rem = diceList(dice);
  let required = maxPlayable(s, p, rem);
  let steps = allowedSteps(s, p, rem, required);
  if (required === 1 && dice[0] !== dice[1]) {
    const big = Math.max(dice[0], dice[1]);
    const bigSteps = steps.filter(st => st.die === big);
    if (bigSteps.length) steps = bigSteps;
  }
  return { rem, required, steps };
}

/* Toutes les séquences complètes (dédoublonnées par position finale) — pour l'IA */
function genTurns(s, p, dice) {
  const rem0 = diceList(dice);
  const required = maxPlayable(s, p, rem0);
  const results = new Map();
  const seen = new Set();
  function rec(state, rem, path) {
    if (path.length === required) {
      const key = stateKey(state);
      if (!results.has(key)) results.set(key, { steps: path, state });
      return;
    }
    const vk = stateKey(state) + '#' + rem.join('');
    if (seen.has(vk)) return; seen.add(vk);
    const uniq = [...new Set(rem)];
    for (const d of uniq) {
      const rest = rem.slice(); rest.splice(rest.indexOf(d), 1);
      for (const from of sources(state, p)) {
        const t = stepTarget(state, p, from, d);
        if (!t) continue;
        const step = { from, to: t.to, hit: t.hit, die: d };
        rec(applyStep(state, p, step), rest, path.concat([step]));
      }
    }
  }
  if (required === 0) return [{ steps: [], state: s }];
  rec(s, rem0, []);
  let arr = [...results.values()];
  if (required === 1 && dice[0] !== dice[1]) {
    const big = Math.max(dice[0], dice[1]);
    const bigs = arr.filter(t => t.steps[0].die === big);
    if (bigs.length) arr = bigs;
  }
  return arr;
}

function pipCount(s, p) {
  let n = 0;
  for (let i = 0; i < 24; i++) {
    const c = s.pts[i] * p;
    if (c > 0) n += c * (p === 1 ? i + 1 : 24 - i);
  }
  return n + 25 * s.bar[bi(p)];
}

function winner(s) {
  if (s.off[0] === 15) return 1;
  if (s.off[1] === 15) return -1;
  return 0;
}
/* 1 = simple, 2 = gammon, 3 = backgammon */
function winPoints(s, w) {
  const l = -w, kl = bi(l);
  if (s.off[kl] > 0) return 1;
  if (s.bar[kl] > 0) return 3;
  for (let i = 0; i < 24; i++) {
    if (s.pts[i] * l > 0) {
      const inWinnerHome = w === 1 ? i <= 5 : i >= 18;
      if (inWinnerHome) return 3;
    }
  }
  return 2;
}

/* ===== IA ===== */
// probabilité approx. d'être touché à distance d (sans blocage)
const HITP = [0, 11, 12, 14, 15, 15, 17, 6, 6, 5, 3, 2, 3, 0, 0, 1, 1, 0, 1, 0, 1, 0, 0, 0, 1].map(x => x / 36);

function homePoints(s, p) {
  let n = 0;
  const lo = p === 1 ? 0 : 18;
  for (let i = lo; i < lo + 6; i++) if (s.pts[i] * p >= 2) n++;
  return n;
}

function sideScore(s, p) {
  const k = bi(p), ko = bi(-p), o = -p;
  let sc = 0;
  const oppHome = homePoints(s, o), myHome = homePoints(s, p);
  const race = isRace(s);
  // positions adverses pouvant frapper
  const hitters = [];
  if (s.bar[ko] > 0) hitters.push(p === 1 ? -1 : 24);
  for (let i = 0; i < 24; i++) if (s.pts[i] * o > 0) hitters.push(i);
  let run = 0, primeBonus = 0;
  for (let step = 0; step < 24; step++) {
    // parcourir du plus loin de la maison vers la maison, pour les primes
    const i = p === 1 ? 23 - step : step;
    const c = s.pts[i] * p;
    if (c >= 2) {
      run++;
      let b = 2;
      const distHome = p === 1 ? i : 23 - i; // 0 = point 1
      if (distHome <= 5) b += 1.5 + (distHome >= 3 ? 1.5 : 0);
      if (distHome === 6) b += 2.5; // bar point
      if (distHome >= 18) b += 1.5; // ancre
      if (race) b = 0.3;
      sc += b;
      if (c > 4) sc -= 0.6 * (c - 4);
    } else {
      if (run >= 3 && !race) primeBonus += run * run * 1.2;
      run = 0;
      if (c === 1 && !race) {
        // blot : risque d'être touché
        let safe = 1;
        for (const h of hitters) {
          const dist = p === 1 ? i - h : h - i;
          if (dist >= 1 && dist <= 24) safe *= (1 - HITP[dist]);
        }
        const risk = 1 - safe;
        const loss = (p === 1 ? 24 - i : i + 1) + 6 + 4 * oppHome;
        sc -= risk * loss;
      }
    }
  }
  if (run >= 3 && !race) primeBonus += run * run * 1.2;
  sc += primeBonus;
  sc -= s.bar[k] * (5 + 4 * oppHome);
  sc += s.off[k] * 2.5;
  return sc;
}

function isRace(s) {
  // plus aucun contact : tous les W sont « devant » tous les B
  if (s.bar[0] || s.bar[1]) return false;
  let maxW = -1, minB = 24;
  for (let i = 0; i < 24; i++) { if (s.pts[i] > 0) maxW = i; if (s.pts[i] < 0 && minB === 24) minB = i; }
  return maxW < minB;
}

function evaluate(s, p) {
  const w = winner(s);
  if (w === p) return 10000;
  if (w === -p) return -10000;
  const pipDiff = pipCount(s, -p) - pipCount(s, p);
  return pipDiff * 1.0 + sideScore(s, p) - sideScore(s, -p);
}

const ALL_ROLLS = (() => {
  const r = [];
  for (let a = 1; a <= 6; a++) for (let b = a; b <= 6; b++) r.push({ dice: [a, b], w: a === b ? 1 / 36 : 2 / 36 });
  return r;
})();

function gauss() { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

/* level: 1 débutant, 2 intermédiaire, 3 expert */
function chooseMove(s, p, dice, level) {
  const turns = genTurns(s, p, dice);
  if (turns.length === 0) return null;
  if (turns.length === 1) return turns[0];
  if (level === 1) {
    // débutant : évaluation grossière + beaucoup de bruit, et un coup au hasard une fois sur trois
    if (Math.random() < 0.35) return turns[Math.floor(Math.random() * turns.length)];
    return best(turns, t => evaluate(t.state, p) + gauss() * 18);
  }
  if (level === 2) {
    return best(turns, t => evaluate(t.state, p) + gauss() * 3);
  }
  // expert : 2 plis sur les meilleurs candidats
  const scored = turns.map(t => ({ t, v: evaluate(t.state, p) })).sort((a, b) => b.v - a.v);
  const cands = scored.slice(0, 6);
  let bestT = null, bestV = -Infinity;
  for (const c of cands) {
    if (winner(c.t.state) === p) return c.t;
    let eq = 0;
    for (const r of ALL_ROLLS) {
      const replies = genTurns(c.t.state, -p, r.dice);
      let bv = -Infinity;
      for (const rep of replies) { const v = evaluate(rep.state, -p); if (v > bv) bv = v; }
      eq += r.w * (-bv);
    }
    if (eq > bestV) { bestV = eq; bestT = c.t; }
  }
  return bestT;
}
function best(arr, f) { let b = null, bv = -Infinity; for (const x of arr) { const v = f(x); if (v > bv) { bv = v; b = x; } } return b; }

if (typeof module !== 'undefined') module.exports = { setMaxStack, BAR, OFF, initState, cloneState, stateKey, stepTarget, closedOut, applyStep, startTurn, allowedSteps, maxPlayable, genTurns, pipCount, winner, winPoints, evaluate, chooseMove, canBearOff, isRace };
