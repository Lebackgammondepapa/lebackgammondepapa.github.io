// Déroulé du tour : fin du tour automatique (annulable), main qui passe sans lancer quand le plateau adverse est fermé
// (contre l'ordinateur et en ligne), réglage « 5 pions maximum par case » dans le menu.
const { JSDOM } = require('jsdom'); const fs = require('fs');
const html = '<!doctype html><html><head><meta charset="utf-8"></head><body>' + fs.readFileSync(__dirname + '/../out/backgammon.html', 'utf8') + '</body></html>';
const wait = ms => new Promise(r => setTimeout(r, ms));
let fails = 0;
const sp = t => String(t).replace(/ /g, ' ');
const check = (ok, label, extra) => { console.log((ok ? 'ok   ' : 'FAIL ') + label + (extra !== undefined ? ' ' + JSON.stringify(extra) : '')); if (!ok) fails++; };
const allErrors = [];

function stubs(w, errors, label) {
  w.console.error = (...a) => errors.push(label + ': ' + a.join(' '));
  w.HTMLCanvasElement.prototype.getContext = function () { return new Proxy({}, { get: (t, k) => (k === 'createRadialGradient' || k === 'createLinearGradient') ? (() => ({ addColorStop() {} })) : (() => {}), set: () => true }); };
  w.HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,';
  w.requestAnimationFrame = cb => setTimeout(() => cb(w.performance.now()), 16);
  w.matchMedia = q => ({ matches: q.includes('reduced-motion') });
  w.DOMPoint = class { constructor(x, y) { this.x = x; this.y = y; } matrixTransform() { return this; } };
  w.SVGElement.prototype.getScreenCTM = () => ({ inverse: () => ({}) });
  w.SVGElement.prototype.setPointerCapture = () => {}; w.SVGElement.prototype.releasePointerCapture = () => {};
  Object.defineProperty(w.HTMLElement.prototype, 'clientWidth', { get() { return 800; } });
  Object.defineProperty(w.HTMLElement.prototype, 'clientHeight', { get() { return 500; } });
}
function open(storage, extra) {
  const dom = new JSDOM(html, { url: 'https://lebackgammondepapa.github.io/', runScripts: 'dangerously', pretendToBeVisual: true, beforeParse(w) {
    for (const [k, v] of Object.entries(storage || {})) w.localStorage.setItem(k, v);
    stubs(w, allErrors, 'local'); if (extra) extra(w);
  } });
  dom.window.addEventListener('error', e => allErrors.push('uncaught: ' + e.message));
  const w = dom.window, d = w.document, N = w.__nacre, G = N.G, $ = id => d.getElementById(id);
  const pe = (type, x, y) => $('board').dispatchEvent(new w.PointerEvent(type, { pointerId: 1, clientX: x, clientY: y, bubbles: true }));
  const drag = async st => { const a = N.topPos(st.from, G.player, G.state), b = N.nextPos(st.to, G.player, G.state); pe('pointerdown', a.x, a.y); pe('pointermove', a.x + 20, a.y + 20); pe('pointermove', b.x, b.y + 14); pe('pointerup', b.x, b.y + 14); await wait(60); };
  const untilMyMove = async () => {
    for (let k = 0; k < 80 && !(G.phase === 'move' && G.player === 1 && G.required > 0 && !G.busy); k++) {
      await wait(200);
      if (!G.busy && !G.rolling && G.player === 1 && G.phase === 'choice') $('mainBtn').click();
    }
    return G.phase === 'move' && G.player === 1;
  };
  const status = () => sp($('status').textContent);
  return { w, d, N, G, $, drag, untilMyMove, status };
}
const empty = () => ({ pts: new Array(24).fill(0), bar: [0, 0], off: [0, 0] });

(async () => {
  /* 1. fin du tour automatique */
  let A = open({});
  A.$('startBtn').click();
  check(await A.untilMyMove(), 'à moi de jouer');
  for (let k = 0; k < 4 && A.G.required > 0 && A.G.steps.length; k++) await A.drag(A.G.steps[0]);
  check(A.G.required === 0 && A.G.player === 1 && A.$('mainBtn').hidden && /Tour terminé/.test(A.status()) && /La main passe/.test(A.status()), 'dés joués : pas de bouton « Fin du tour », la main va passer', A.status());
  check(!A.$('undoBtn').hidden, 'Annuler reste disponible pendant ce temps');
  await wait(1700);
  check(A.G.player === -1, 'la main est passée toute seule', { player: A.G.player, phase: A.G.phase });

  /* 2. annuler pendant le délai : la main ne passe pas, puis repasse après avoir rejoué */
  check(await A.untilMyMove(), 'de nouveau à moi');
  for (let k = 0; k < 4 && A.G.required > 0 && A.G.steps.length; k++) await A.drag(A.G.steps[0]);
  const hist = A.G.history.length;
  await wait(500); A.$('undoBtn').click();
  check(A.G.required === 1 && A.G.history.length === hist - 1, 'Annuler pendant le délai');
  await wait(1800);
  check(A.G.player === 1 && A.G.phase === 'move' && A.G.required === 1, 'la main n\'est pas passée', { player: A.G.player, required: A.G.required });
  await A.drag(A.G.steps[0]);
  await wait(1700);
  check(A.G.player === -1, 'coup rejoué : la main passe ensuite');

  /* 3. je suis sur la barre et le plateau de l'ordinateur est fermé : pas de lancer, il rejoue tout de suite */
  for (let k = 0; k < 60 && !(A.G.phase === 'move' && A.G.player === 1); k++) await wait(100);
  const s3 = empty(); s3.bar[0] = 1; s3.pts[3] = 14; for (let i = 18; i < 24; i++) s3.pts[i] = -2; s3.pts[10] = -3;
  A.G.state = s3; A.G.player = -1; A.G.phase = 'move'; A.G.required = 0; A.G.busy = false; A.G.lastDicePlayer = -1; A.G.gen++;
  const dice3 = A.G.dice;
  A.N.endTurn();
  await wait(800);
  check(A.G.player === -1 && A.G.lastDicePlayer === -1, 'je ne lance pas : l\'ordinateur a de nouveau la main', { player: A.G.player, phase: A.G.phase });
  check(/vous ne pouvez pas rentrer votre pion/.test(A.status()), 'message affiché', A.status());
  for (let k = 0; k < 40 && A.G.phase !== 'move'; k++) await wait(100);
  check(A.G.player === -1 && A.G.dice !== dice3, 'l\'ordinateur relance et joue', { phase: A.G.phase, dice: A.G.dice });

  /* 4. l'ordinateur est sur la barre et mon plateau est fermé : il ne lance pas, je rejoue */
  A.G.gen++;
  const s4 = empty(); s4.bar[1] = 1; s4.pts[20] = -14; for (let i = 0; i < 6; i++) s4.pts[i] = 2; s4.pts[13] = 3;
  A.G.state = s4; A.G.player = 1; A.G.phase = 'move'; A.G.required = 0; A.G.busy = false; A.G.rolling = false; A.G.lastDicePlayer = 1;
  A.N.endTurn();
  for (let k = 0; k < 30 && !(A.G.player === 1 && A.G.phase === 'roll'); k++) await wait(50);
  check(A.G.player === 1 && /Ébène ne peut pas rentrer son pion/.test(A.status()), 'l\'ordinateur passe : à moi, avec le message', A.status());
  for (let k = 0; k < 40 && A.G.phase !== 'move'; k++) await wait(100);
  check(A.G.player === 1 && A.G.phase === 'move' && A.G.lastDicePlayer === 1, 'mes dés se lancent tout seuls', { phase: A.G.phase });

  /* 5. réglage « 5 pions maximum par case » */
  A.$('menuBtn').click(); A.$('abandonBtn').click();
  const sw = A.d.querySelector('.ruleToggle');
  check(sw && sw.classList.contains('on') && sw.getAttribute('aria-pressed') === 'true', 'menu : interrupteur « 5 pions maximum » activé par défaut');
  sw.click();
  check(!sw.classList.contains('on') && A.w.localStorage.getItem('nacre.max5') === 'off', 'désactivé et retenu');
  A.$('startBtn').click(); await wait(50);
  check(A.w.eval('MAX_STACK') === 0, 'partie sans limite de pions');
  const keep = {}; for (let i = 0; i < A.w.localStorage.length; i++) { const k = A.w.localStorage.key(i); keep[k] = A.w.localStorage.getItem(k); }
  A.w.close();
  let B = open(Object.assign({}, keep, { 'nacre.partie': '' }));
  await wait(50);
  check(!B.d.querySelector('.ruleToggle').classList.contains('on'), 'réglage retrouvé à la réouverture');
  B.d.querySelector('.ruleToggle').click(); B.$('startBtn').click(); await wait(50);
  check(B.w.eval('MAX_STACK') === 5, 'réactivé : 5 pions maximum');
  B.w.close();
  let C = open({ 'nacre.rule5': 'off' });
  check(C.d.querySelector('.ruleToggle').classList.contains('on'), 'un ancien réglage retiré du menu ne revient pas par surprise');
  C.w.close();

  /* 6. en ligne : le joueur bloqué ne lance pas, l'autre a la main avec le message */
  const store = new Map(), listeners = new Map(), writes = [];
  const clone = o => JSON.parse(JSON.stringify(o));
  const notify = path => { const dd = store.get(path); for (const fn of (listeners.get(path) || [])) setTimeout(() => fn({ exists: !!dd, data: () => dd ? clone(dd) : undefined }), 20); };
  const db = { doc(path) { return {
    async get() { const dd = store.get(path); return { exists: !!dd, data: () => dd ? clone(dd) : undefined }; },
    async set(dd) { store.set(path, clone(dd)); writes.push(dd.event && dd.event.type); notify(path); },
    async acquire() { return { acquired: true }; },
    onSnapshot(fn) { if (!listeners.has(path)) listeners.set(path, []); listeners.get(path).push(fn); notify(path); return () => {}; },
  }; } };
  const client = (id, name) => {
    const dom = new JSDOM(html, { url: `https://${id}.example/`, runScripts: 'dangerously', pretendToBeVisual: true, beforeParse(w) {
      stubs(w, allErrors, id);
      const user = { id: async () => id, profiles: async ids => Object.fromEntries([].concat(ids).map(x => [x, { id: x, name: x === 'u-host' ? 'Thomas' : 'Papa' }])) };
      w.claude = { use: async n => ({ db, user, room: null })[n] || null };
    } });
    dom.window.addEventListener('error', e => allErrors.push(id + ' uncaught: ' + e.message));
    return dom.window;
  };
  const H = client('u-host'), P = client('u-guest');
  await wait(400);
  await H.__nacre.onlineCreate(); await wait(100);
  const code = H.__nacre.G.online.code;
  await P.__nacre.onlineJoin(code); await wait(3500);
  const path = 'games/' + code, cur = store.get(path);
  // au tour de Papa (pions foncés), un pion sur la barre, le jan de Thomas fermé
  const s6 = empty(); s6.bar[1] = 1; s6.pts[20] = -14; for (let i = 0; i < 6; i++) s6.pts[i] = 2; s6.pts[13] = 3;
  store.set(path, Object.assign(clone(cur), { seq: cur.seq + 1, state: s6, player: -1, phase: 'roll', dice: null, rem: [], required: 0, status: 'playing', event: { type: 'turn', by: 'u-host', at: Date.now(), steps: [], player: 1 } }));
  notify(path);
  const NH = H.__nacre.G, NP = P.__nacre.G;
  for (let k = 0; k < 60 && !(NH.phase === 'move' && NH.player === 1); k++) await wait(100);
  check(writes.includes('blocked'), 'Papa bloqué : son appareil passe la main sans lancer', writes.slice(-4));
  check(NH.player === 1 && NH.phase === 'move' && store.get(path).event.type === 'roll' && store.get(path).event.player === 1, 'Thomas a la main et ses dés sont lancés', { phase: NH.phase, ev: store.get(path).event.type });
  check(NH.notice && sp(NH.notice.text) === 'Plateau fermé : Papa ne peut pas rentrer son pion.' && sp(NP.notice ? NP.notice.text : '') === 'Plateau fermé : vous ne pouvez pas rentrer votre pion.', 'message de chaque côté', [NH.notice && NH.notice.text, NP.notice && NP.notice.text]);
  check(JSON.stringify(NH.state) === JSON.stringify(NP.state), 'mêmes positions des deux côtés');

  check(allErrors.length === 0, 'aucune erreur', allErrors.slice(0, 4));
  console.log(fails ? `${fails} ÉCHEC(S)` : 'ALL OK');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
