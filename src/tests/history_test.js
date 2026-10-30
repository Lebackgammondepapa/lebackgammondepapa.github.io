// Historique et bilan : parties locales enregistrées une fois, séries, gammons, écran Bilan, effacement, persistance.
const { JSDOM } = require('jsdom'); const fs = require('fs');
const html = '<!doctype html><html><head><meta charset="utf-8"></head><body>' + fs.readFileSync(__dirname + '/../out/backgammon.html', 'utf8') + '</body></html>';
const wait = ms => new Promise(r => setTimeout(r, ms));
let fails = 0;
const sp = t => String(t).replace(/\u00a0/g, ' ');
const check = (ok, label, extra) => { console.log((ok ? 'ok   ' : 'FAIL ') + label + (extra !== undefined ? ' ' + JSON.stringify(extra) : '')); if (!ok) fails++; };

function open(storage) {
  const errors = [];
  const dom = new JSDOM(html, { url: 'https://lebackgammondepapa.github.io/', runScripts: 'dangerously', pretendToBeVisual: true, beforeParse(w) {
    for (const [k, v] of Object.entries(storage || {})) w.localStorage.setItem(k, v);
    w.console.error = (...a) => errors.push(a.join(' '));
    w.HTMLCanvasElement.prototype.getContext = function () { return new Proxy({}, { get: (t, k) => (k === 'createRadialGradient' || k === 'createLinearGradient') ? (() => ({ addColorStop() {} })) : (() => {}), set: () => true }); };
    w.HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,';
    w.requestAnimationFrame = cb => setTimeout(() => cb(w.performance.now()), 16);
    w.matchMedia = q => ({ matches: q.includes('reduced-motion') });
    w.DOMPoint = class { constructor(x, y) { this.x = x; this.y = y; } matrixTransform() { return this; } };
    w.SVGElement.prototype.getScreenCTM = () => ({ inverse: () => ({}) });
    w.SVGElement.prototype.setPointerCapture = () => {}; w.SVGElement.prototype.releasePointerCapture = () => {};
    Object.defineProperty(w.HTMLElement.prototype, 'clientWidth', { get() { return 800; } });
    Object.defineProperty(w.HTMLElement.prototype, 'clientHeight', { get() { return 500; } });
  } });
  dom.window.addEventListener('error', e => errors.push('uncaught: ' + e.message));
  const w = dom.window, d = w.document, N = w.__nacre, G = N.G, $ = id => d.getElementById(id);
  const pe = (type, x, y) => $('board').dispatchEvent(new w.PointerEvent(type, { pointerId: 1, clientX: x, clientY: y, bubbles: true }));
  const drag = async st => { const a = N.topPos(st.from, G.player, G.state), b = N.nextPos(st.to, G.player, G.state); pe('pointerdown', a.x, a.y); pe('pointermove', a.x + 20, a.y + 20); pe('pointermove', b.x, b.y + 14); pe('pointerup', b.x, b.y + 14); await wait(80); };
  const hist = () => JSON.parse(w.localStorage.getItem('nacre.historique') || '[]');
  const dump = () => { const o = {}; for (let i = 0; i < w.localStorage.length; i++) { const k = w.localStorage.key(i); o[k] = w.localStorage.getItem(k); } return o; };
  // fin de partie jouée pour de vrai : il ne reste qu'un pion au joueur p (le moteur décide simple, gammon ou backgammon)
  const finish = async (p, loserOff, extra) => {
    const s = { pts: new Array(24).fill(0), bar: [0, 0], off: [0, 0] };
    const k = p === 1 ? 0 : 1; s.off[k] = 14; s.off[1 - k] = loserOff; s.pts[p === 1 ? 0 : 23] = p;
    const rest = 15 - loserOff - (extra ? 1 : 0); s.pts[p === 1 ? 23 : 0] = -p * rest; if (extra) s.pts[extra] = -p;
    G.state = s; G.player = p; N.beginTurnWithDice([3, 1]);
    if (G.mode === 'ai' && p === -1) { for (let i = 0; i < 40 && G.phase !== 'over'; i++) await wait(100); }
    else { await drag(G.steps[0]); for (let i = 0; i < 20 && G.phase !== 'over'; i++) await wait(50); }
    await wait(50);
  };
  return { w, d, N, G, $, errors, hist, dump, finish };
}

(async () => {
  let A = open({});
  /* 1. bilan vide */
  A.$('statsBtn').click();
  check(!A.$('statsOv').hidden && /Aucune partie terminée/.test(A.$('statsBody').textContent) && A.$('statsClear').hidden, 'Bilan vide : message d\'accueil, pas de bouton Effacer');
  A.$('statsDone').click();
  check(A.$('statsOv').hidden, 'Fermer');

  /* 2. contre l'ordinateur (Intermédiaire) : victoire gammon, défaite simple, puis trois victoires */
  A.$('startBtn').click(); await wait(30);
  const id1 = A.G.gameId;
  await A.finish(1, 0);
  let h = A.hist();
  check(h.length === 1 && h[0].mode === 'ai' && h[0].level === 2 && h[0].won === true && h[0].pts === 2 && h[0].id === id1, 'victoire enregistrée (gammon, niveau 2)', h[0]);
  check(sp(A.$('endH2H').textContent) === 'Contre l\'ordinateur Intermédiaire : 1 victoire, 0 défaite', 'écran de fin : bilan contre ce niveau', sp(A.$('endH2H').textContent));
  A.$('endAgain').click(); await wait(30);
  check(A.G.gameId !== id1, 'Rejouer : nouvelle partie, nouvel identifiant');
  await A.finish(-1, 3);
  h = A.hist();
  check(h.length === 2 && h[1].won === false && h[1].pts === 1, 'défaite simple enregistrée (l\'ordinateur sort son dernier pion)', h[1]);
  for (let i = 0; i < 3; i++) { A.$('endAgain').click(); await wait(30); await A.finish(1, 2); }
  check(A.hist().length === 5 && sp(A.$('endH2H').textContent) === 'Contre l\'ordinateur Intermédiaire : 4 victoires, 1 défaite · 3 victoires de suite', 'série affichée en fin de partie', sp(A.$('endH2H').textContent));

  /* 3. partie abandonnée : pas comptée */
  A.$('endAgain').click(); await wait(30);
  A.$('menuBtn').click(); A.$('abandonBtn').click();
  check(A.hist().length === 5, 'partie abandonnée : non comptée');

  /* 4. niveau Expert : backgammon gagné, et une partie reprise après fermeture garde son identifiant */
  A.d.querySelector('.level[data-level="3"]').click(); A.$('startBtn').click(); await wait(30);
  const id6 = A.G.gameId;
  const keep = A.dump(); A.w.close();
  A = open(keep); await wait(50);
  check(A.G.gameId === id6 && A.G.level === 3, 'partie reprise : même identifiant, même niveau');
  await A.finish(1, 0, 3);
  h = A.hist();
  check(h.length === 6 && h[5].id === id6 && h[5].level === 3 && h[5].pts === 3, 'backgammon contre l\'Expert enregistré une fois', h[5]);

  /* 5. à deux sur cet appareil : Ébène gagne */
  A.$('endMenu').click(); A.d.querySelector('.mode[data-mode="2p"]').click(); A.$('startBtn').click(); await wait(30);
  await A.finish(-1, 1);
  h = A.hist();
  check(h.length === 7 && h[6].mode === '2p' && h[6].winner === -1 && h[6].won === undefined, 'partie à deux enregistrée (Ébène gagne)', h[6]);
  check(sp(A.$('endH2H').textContent) === 'À deux sur cet appareil : Ivoire 0, Ébène 1', 'écran de fin à deux', sp(A.$('endH2H').textContent));

  /* 6. écran Bilan */
  A.$('endMenu').click(); A.$('statsBtn').click();
  const body = A.$('statsBody'), rows = [...body.querySelectorAll('.opp')].map(r => [r.querySelector('.nm').textContent, r.querySelector('.rec').firstChild.textContent.trim(), sp(r.querySelector('.det').textContent)]);
  console.log('     ', JSON.stringify(rows));
  check(/^6 parties · 83 % de victoires$/.test(sp(body.querySelector('.stats-sum').textContent)), 'résumé : 6 parties personnelles, 83 % de victoires', sp(body.querySelector('.stats-sum').textContent));
  check(rows.length === 3 && rows[0][0] === 'À deux sur cet appareil' && rows[1][0] === 'Ordinateur · Expert' && rows[2][0] === 'Ordinateur · Intermédiaire', 'adversaires, du plus récent au plus ancien');
  check(rows[2][1] === '4 – 1' && /80 % de victoires/.test(rows[2][2]) && /gammons : 1 gagné, 0 perdu/.test(rows[2][2]) && /meilleure série : 3 victoires/.test(rows[2][2]) && /en cours : 3 victoires/.test(rows[2][2]), 'Intermédiaire : 4 – 1, gammon, meilleure série, série en cours', rows[2]);
  check(rows[1][1] === '1 – 0' && /gammons : 1 gagné \(dont 1 backgammon\), 0 perdu/.test(rows[1][2]), 'Expert : 1 – 0 avec un backgammon', rows[1]);
  check(rows[0][1] === '0 – 1', 'À deux : Ivoire 0 – Ébène 1', rows[0]);
  const items = [...body.querySelectorAll('.recent li')].map(li => li.querySelector('.rs').textContent);
  check(items.length === 7 && items[0] === 'Ébène gagne' && items[1] === 'Victoire · backgammon' && items[6] === 'Victoire · gammon', 'dernières parties, la plus récente en premier', items);

  /* 7. un prénom d'ami piégé reste du texte */
  h = A.hist(); h.push({ id: 'on-TEST-1-1-0', mode: 'online', code: 'TEST', side: 1, opp: { key: 'n:x', name: '<img src=x onerror="window.__xss=1">' }, won: true, winner: 1, pts: 1, at: Date.now() });
  A.w.localStorage.setItem('nacre.historique', JSON.stringify(h));
  A.$('statsDone').click(); A.$('statsBtn').click(); await wait(30);
  check(!A.$('statsBody').querySelector('img') && A.w.__xss === undefined && A.$('statsBody').querySelector('.opp .nm').textContent.startsWith('<img'), 'prénom affiché tel quel, sans être interprété');

  /* 8. persistance puis effacement */
  const keep2 = A.dump(); A.w.close();
  A = open(keep2); await wait(50);
  A.$('statsBtn').click();
  check(A.$('statsBody').querySelectorAll('.recent li').length === 8, 'après réouverture : historique intact');
  A.$('statsClear').click();
  check(A.hist().length === 8 && /Toucher encore/.test(A.$('statsClear').textContent), 'Effacer : demande de confirmation');
  A.$('statsClear').click();
  check(A.hist().length === 0 && /Aucune partie terminée/.test(A.$('statsBody').textContent), 'second toucher : historique effacé');

  check(A.errors.length === 0, 'aucune erreur', A.errors.slice(0, 3));
  A.w.close();
  console.log(fails ? `${fails} ÉCHEC(S)` : 'ALL OK');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
