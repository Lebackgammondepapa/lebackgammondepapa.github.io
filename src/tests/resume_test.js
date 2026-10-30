// Reprise de partie : la partie locale survit à une fermeture de l'appli (rechargement de la page).
// Chaque « rechargement » ferme la fenêtre jsdom et en ouvre une nouvelle avec le même localStorage.
const { JSDOM } = require('jsdom'); const fs = require('fs');
const html = '<!doctype html><html><head><meta charset="utf-8"></head><body>' + fs.readFileSync(__dirname + '/../out/backgammon.html', 'utf8') + '</body></html>';
const URL0 = 'https://lebackgammondepapa.github.io/';
const wait = ms => new Promise(r => setTimeout(r, ms));
let fails = 0;
const check = (ok, label, extra) => { console.log((ok ? 'ok   ' : 'FAIL ') + label + (extra !== undefined ? ' ' + JSON.stringify(extra) : '')); if (!ok) fails++; };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function open(storage, { url = URL0, reduced = true, offline = false } = {}) {
  const errors = [];
  const dom = new JSDOM(html, { url, runScripts: 'dangerously', pretendToBeVisual: true, beforeParse(w) {
    w.localStorage.clear();
    for (const [k, v] of Object.entries(storage || {})) w.localStorage.setItem(k, v);
    w.console.error = (...a) => errors.push(a.join(' '));
    w.HTMLCanvasElement.prototype.getContext = function () { return new Proxy({}, { get: (t, k) => (k === 'createRadialGradient' || k === 'createLinearGradient') ? (() => ({ addColorStop() {} })) : (() => {}), set: () => true }); };
    w.HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,';
    w.requestAnimationFrame = cb => setTimeout(() => cb(w.performance.now()), 16);
    w.matchMedia = q => ({ matches: reduced && q.includes('reduced-motion') });
    w.DOMPoint = class { constructor(x, y) { this.x = x; this.y = y; } matrixTransform() { return this; } };
    w.SVGElement.prototype.getScreenCTM = () => ({ inverse: () => ({}) });
    w.SVGElement.prototype.setPointerCapture = () => {}; w.SVGElement.prototype.releasePointerCapture = () => {};
    Object.defineProperty(w.HTMLElement.prototype, 'clientWidth', { get() { return 800; } });
    Object.defineProperty(w.HTMLElement.prototype, 'clientHeight', { get() { return 500; } });
    if (offline) Object.defineProperty(w.navigator, 'onLine', { get: () => false });
  } });
  dom.window.addEventListener('error', e => errors.push('uncaught: ' + e.message));
  const w = dom.window, d = w.document, N = w.__nacre, G = N.G;
  const pe = (type, x, y) => d.getElementById('board').dispatchEvent(new w.PointerEvent(type, { pointerId: 1, clientX: x, clientY: y, bubbles: true }));
  const drag = async st => { const a = N.topPos(st.from, G.player, G.state), b = N.nextPos(st.to, G.player, G.state); pe('pointerdown', a.x, a.y); pe('pointermove', a.x + 20, a.y + 20); pe('pointermove', b.x, b.y + 14); pe('pointerup', b.x, b.y + 14); await wait(reduced ? 80 : 700); };
  const save = () => JSON.parse(w.localStorage.getItem('nacre.partie') || 'null');
  const dump = () => { const o = {}; for (let i = 0; i < w.localStorage.length; i++) { const k = w.localStorage.key(i); o[k] = w.localStorage.getItem(k); } return o; };
  const reload = (opts) => { const s = dump(); w.close(); return open(s, opts); };
  const hidden = id => d.getElementById(id).hidden;
  // jusqu'à ce que ce soit au joueur 1 (humain) de déplacer ses pions
  const untilMyMove = async () => {
    for (let k = 0; k < 80 && !(G.phase === 'move' && G.player === 1 && G.required > 0 && !G.busy); k++) {
      await wait(250);
      if (!G.busy && !G.rolling && G.player === 1 && (G.phase === 'roll' || G.phase === 'choice')) d.getElementById('mainBtn').click();
    }
    return G.phase === 'move' && G.player === 1;
  };
  return { dom, w, d, N, G, errors, drag, save, dump, reload, hidden, untilMyMove };
}

(async () => {
  /* 1. tour du joueur : position, dés, coups joués et annulation retrouvés */
  let A = open({});
  check(!A.hidden('home') && A.save() === null, 'premier lancement : menu, aucune sauvegarde');
  A.d.getElementById('startBtn').click();
  check(await A.untilMyMove(), 'partie lancée, à moi de jouer', { phase: A.G.phase, dice: A.G.dice });
  check(A.save() && A.save().phase === 'move' && A.save().player === 1, 'sauvegarde au début du tour');
  const before = { state: A.G.state, rem: A.G.rem.slice(), required: A.G.required };
  await A.drag(A.G.steps[0]);
  check(A.G.history.length === 1 && A.save().history.length === 1, 'un pion joué, sauvegardé avec l\'historique');
  const S1 = { state: A.G.state, dice: A.G.dice, rem: A.G.rem, required: A.G.required, level: A.G.level };
  let B = A.reload();
  await wait(100);
  check(B.hidden('home') && B.G.mode === 'ai' && B.G.phase === 'move' && B.G.player === 1, 'réouverture : directement dans la partie', { home: !B.hidden('home'), phase: B.G.phase });
  check(same(B.G.state, S1.state) && same(B.G.dice, S1.dice) && same(B.G.rem, S1.rem) && B.G.required === S1.required, 'même position, mêmes dés, même coup restant');
  check(!B.hidden('undoBtn'), 'bouton Annuler disponible après réouverture');
  B.d.getElementById('undoBtn').click();
  check(same(B.G.state, before.state) && same(B.G.rem, before.rem) && B.G.required === before.required && B.save().history.length === 0, 'annulation du coup d\'avant la fermeture');
  check(B.G.steps.length > 0, 'coups jouables recalculés', B.G.steps.length);

  /* 2. choix d'ouverture (garder ou relancer) */
  B.G.state = B.w.initState(); B.N.afterOpening(1, [6, 5]);
  let C = B.reload();
  await wait(100);
  check(C.G.phase === 'choice' && same(C.G.dice, [6, 5]) && !C.hidden('rerollBtn'), 'choix d\'ouverture retrouvé (Jouer ces dés / Relancer)', { phase: C.G.phase, dice: C.G.dice });
  C.d.getElementById('mainBtn').click();
  check(C.G.phase === 'move' && C.G.required === 2, 'dés gardés, tour normal');

  /* 3. fin de partie : la sauvegarde disparaît */
  const fin = { pts: new Array(24).fill(0), bar: [0, 0], off: [14, 10] }; fin.pts[0] = 1; fin.pts[23] = -5;
  C.G.state = fin; C.N.beginTurnWithDice([3, 1]);
  check(C.save() && C.save().phase === 'move', 'position finale sauvegardée');
  await C.drag(C.G.steps[0]);
  await wait(100);
  check(C.G.phase === 'over' && C.save() === null, 'partie gagnée : plus rien à reprendre', { phase: C.G.phase });
  let D = C.reload();
  await wait(100);
  check(!D.hidden('home') && D.G.phase === 'idle' && D.hidden('resumeLocal'), 'réouverture après la fin : menu normal');

  /* 4. abandon : la sauvegarde disparaît */
  D.d.getElementById('startBtn').click();
  await wait(200);
  check(D.save() && D.save().phase === 'opening', 'nouvelle partie sauvegardée dès l\'ouverture');
  D.d.getElementById('menuBtn').click();
  check(!D.hidden('pauseOv'), 'menu pause');
  D.d.getElementById('abandonBtn').click();
  check(D.save() === null && !D.hidden('home'), 'abandon : sauvegarde effacée, retour au menu');

  /* 5. tour de l'ordinateur interrompu : il le rejoue à la réouverture */
  D.d.getElementById('startBtn').click();
  check(await D.untilMyMove(), 'nouvelle partie, à moi de jouer');
  for (let k = 0; k < 4 && D.G.required > 0 && D.G.steps.length; k++) await D.drag(D.G.steps[0]);
  check(D.G.required === 0 && D.d.getElementById('mainBtn').textContent === 'Fin du tour', 'tour joué, reste à valider');
  D.d.getElementById('mainBtn').click();
  for (let k = 0; k < 40 && !(D.G.player === -1 && D.G.phase === 'move'); k++) await wait(25);
  const sv5 = D.save();
  check(sv5 && sv5.player === -1 && sv5.phase === 'move', 'dés de l\'ordinateur tirés et sauvegardés', sv5 && { p: sv5.player, ph: sv5.phase });
  let E = D.reload();
  await wait(50);
  check(E.G.player === -1 && same(E.G.dice, sv5.dice) && same(E.G.state, sv5.state), 'réouverture pendant le tour de l\'ordinateur : mêmes dés, même position');
  for (let k = 0; k < 60 && E.G.player === -1; k++) await wait(100);
  check(E.G.player === 1 && !same(E.G.state, sv5.state), 'l\'ordinateur a rejoué son tour, la main revient', { player: E.G.player, phase: E.G.phase });

  /* 6. dés en train de rouler au moment de la fermeture : ce sont les mêmes à la réouverture (animations réelles) */
  let F = open({}, { reduced: false });
  F.d.getElementById('startBtn').click();
  let rolled = null;
  for (let k = 0; k < 200 && !rolled; k++) {
    await wait(100);
    if (F.G.phase === 'choice' && F.G.player === 1 && !F.G.busy && !F.G.rolling) F.d.getElementById('rerollBtn').click();
    if (F.G.phase === 'roll' && F.G.rolling && F.G.pending) rolled = F.save();
  }
  check(rolled && rolled.phase === 'roll' && Array.isArray(rolled.pending), 'dés en train de rouler : valeurs déjà sauvegardées', rolled && rolled.pending);
  let F2 = F.reload({ reduced: false });
  await wait(100);
  check(rolled && same(F2.G.dice, rolled.pending) && ['move', 'nomove'].includes(F2.G.phase) && F2.G.player === rolled.player, 'réouverture : mêmes dés, pas de nouveau lancer', { dice: F2.G.dice, phase: F2.G.phase });

  /* 7. une partie en ligne jouée depuis : on ne saute pas dedans, les deux reprises sont proposées */
  const local = F2.dump()['nacre.partie']; const at = JSON.parse(local).at;
  F2.w.close();
  let H = open({ 'nacre.partie': local, 'nacre.online': JSON.stringify({ code: 'ABCD', color: 1, at: at + 1000 }) });
  await wait(100);
  const tab = H.d.querySelector('.mode.on');
  check(!H.hidden('home') && tab && tab.dataset.mode === 'online' && !H.hidden('resumeBtn2'), 'partie en ligne plus récente : menu, onglet En ligne');
  H.d.querySelector('.mode[data-mode="ai"]').click();
  check(!H.hidden('resumeLocal') && H.d.getElementById('startBtn').textContent === 'Nouvelle partie', 'onglet Ordinateur : Reprendre la partie / Nouvelle partie');
  H.d.getElementById('resumeLocal').click();
  await wait(100);
  check(H.hidden('home') && same(H.G.state, JSON.parse(local).state), 'Reprendre la partie : partie locale retrouvée');
  H.w.close();
  let H2 = open({ 'nacre.partie': local, 'nacre.online': JSON.stringify({ code: 'ABCD', color: 1, at: at - 1000 }) });
  await wait(100);
  check(H2.hidden('home') && same(H2.G.state, JSON.parse(local).state), 'partie en ligne plus ancienne : reprise directe de la partie locale');
  H2.w.close();

  /* 8. lien d'invitation : on ouvre le jeu en ligne sans toucher à la partie locale */
  let I = open({ 'nacre.partie': local }, { url: URL0 + '#WXYZ' });
  await wait(100);
  check(!I.hidden('home') && I.d.querySelector('.mode.on').dataset.mode === 'online' && I.d.getElementById('joinCode').value === 'WXYZ' && I.save() !== null, 'invitation : onglet En ligne, code prérempli, partie locale gardée');
  I.w.close();

  /* 9. sans réseau : le jeu en ligne le dit tout de suite, le reste fonctionne */
  let J = open({}, { offline: true });
  J.d.querySelector('.mode[data-mode="online"]').click();
  const msg = () => J.d.getElementById('onlineMsg').textContent;
  check(/Pas de connexion/.test(msg()), 'hors connexion : message dans l\'onglet En ligne', msg());
  J.d.getElementById('createBtn').click(); await wait(50);
  check(/Pas de connexion/.test(msg()) && J.N.NET.inited === false, 'Créer une partie : pas de tentative de connexion');
  J.d.querySelector('.mode[data-mode="ai"]').click();
  J.d.getElementById('startBtn').click();
  check(await J.untilMyMove(), 'hors connexion : partie contre l\'ordinateur normale');

  const errs = [A, B, C, D, E, F, F2, H, H2, I, J].flatMap(x => x.errors);
  check(errs.length === 0, 'aucune erreur', errs.slice(0, 3));
  J.w.close();
  console.log(fails ? `${fails} ÉCHEC(S)` : 'ALL OK');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
