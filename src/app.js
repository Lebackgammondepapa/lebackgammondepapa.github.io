(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const NS = 'http://www.w3.org/2000/svg';
  function el(tag, attrs, parent) { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const easeInOut = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ===== Géométrie (plateau paysage 1000 x 660, taille fixe) ===== */
  const W = 1000, H = 660, FM = 22, TRAY = 64, BARW = 52, R = 30, PH = 250, SP = 58, DS = 46, SLAB_W = TRAY - 18, SLAB_H = 11, fScale = 1;
  const innerL = FM, innerR = W - FM - TRAY - 8, innerT = FM, innerB = H - FM;
  const barL = (innerL + innerR) / 2 - BARW / 2, barR = barL + BARW;
  const PW = (barL - innerL) / 6;
  const trayX = W - FM - TRAY;
  function pointX(i) {
    if (i <= 5) return innerR - PW * (i + .5);
    if (i <= 11) return barL - PW * ((i - 6) + .5);
    if (i <= 17) return innerL + PW * ((i - 12) + .5);
    return barR + PW * ((i - 18) + .5);
  }
  let flip = false; // vue retournée pour le joueur Marbre en ligne (sa maison en bas à droite)
  const isTop = i => flip ? i < 12 : i >= 12;
  const diceX = p => ((p === 1) !== flip) ? barR + 3 * PW : innerL + 3 * PW;
  function stackPos(i, n, k) {
    const x = pointX(i);
    const y = isTop(i) ? innerT + R + 3 + k * SP : innerB - R - 3 - k * SP;
    return { x, y };
  }
  function barPos(p, n, k) { const x = (barL + barR) / 2; const sp = 2 * R - 6;
    const y = ((p === 1) !== flip) ? innerT + 40 + R + k * sp : innerB - 40 - R - k * sp; return { x, y }; }
  function trayPos(p, k) { const step = SLAB_H + 2; return { x: trayX + TRAY / 2, y: ((p === 1) !== flip) ? innerB - 6 - k * step - SLAB_H / 2 : innerT + 6 + k * step + SLAB_H / 2 }; }
  const portrait = false;
  // type d'appareil : téléphone (paysage obligatoire), tablette ou ordinateur (mise en page libre)
  function deviceKind() {
    const mm = q => { try { return window.matchMedia(q).matches; } catch (e) { return false; } };
    const touch = mm('(pointer: coarse)') || (navigator.maxTouchPoints || 0) > 1;
    const hover = mm('(hover: hover) and (pointer: fine)');
    if (!touch || hover) return 'desktop';
    const shortSide = Math.min(screen.width || 0, screen.height || 0) || Math.min(window.innerWidth, window.innerHeight);
    return shortSide < 600 ? 'phone' : 'tablet';
  }
  let DEVICE = deviceKind();
  function updateOrientation() {
    const app = $('app');
    const appW = app.clientWidth, appH = app.clientHeight;
    if (!appW || !appH) return;
    DEVICE = deviceKind();
    document.body.dataset.device = DEVICE;
    const isPortrait = window.innerHeight > window.innerWidth;
    $('rotateOv').hidden = !(DEVICE === 'phone' && isPortrait && $('home').hidden);
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    // fenêtre large : colonnes de part et d'autre ; fenêtre haute : infos au-dessus et en dessous
    const stack = DEVICE !== 'phone' && appW / appH < 1.45;
    document.body.classList.toggle('layout-stack', stack);
    let bw, bh;
    if (stack) {
      const top = document.querySelector('.side.left').offsetHeight || 60, bottom = document.querySelector('.side.right').offsetHeight || 70;
      bh = appH - top - bottom - 28; bw = bh * W / H;
      if (bw > appW - 16) { bw = appW - 16; bh = bw * H / W; }
    } else {
      const minSide = DEVICE === 'phone' ? 104 : 190;
      bh = appH - (DEVICE === 'phone' ? 8 : 32); bw = bh * W / H;
      if (bw > appW - 2 * minSide) { bw = appW - 2 * minSide; bh = bw * H / W; }
    }
    bw = Math.max(bw, 160); bh = bw * H / W;
    svg.style.width = bw + 'px'; svg.style.height = bh + 'px';
  }
  const txt = (p) => portrait ? `rotate(-90 ${p.x} ${p.y})` : '';
  // coordonnées écran -> coordonnées du plateau (tient compte de la rotation)
  function toBoard(ev) {
    const m = root.getScreenCTM(); if (!m) return null;
    const pt = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(m.inverse());
    return { x: pt.x, y: pt.y };
  }
  // zone touchée : index de flèche, BAR, OFF ou null
  function zoneAt(pt) {
    if (!pt) return null;
    if (pt.x >= trayX - 6 && pt.x <= trayX + TRAY + 10) return OFF;
    if (pt.x >= barL - 4 && pt.x <= barR + 4) return BAR;
    const top = flip ? pt.y >= H / 2 : pt.y < H / 2;
    if (pt.x < innerL - 10 || pt.x > innerR + 10) return null;
    if (pt.x < barL) { const c = Math.min(5, Math.max(0, Math.floor((pt.x - innerL) / PW))); return top ? 12 + c : 11 - c; }
    const c = Math.min(5, Math.max(0, Math.floor((pt.x - barR) / PW)));
    return top ? 18 + c : 5 - c;
  }

  /* ===== Thèmes du plateau ===== */
  // noyer moyen : un peu plus clair qu'un noyer foncé, sans aller jusqu'au chêne
  const WALNUT = { tex: 'wood', base: '#5e3d25', dark: '#3a2414', light: '#8f6443', edge: '#22150a', hl: 'rgba(255,222,180,.26)', lip: 'rgba(0,0,0,.42)' };
  const IVORY = { tex: 'ivory', base: '#f2e8d3', vary: '#e3d3b2', rim: '#9a845d', grooves: [.78, .5], grooveDark: 'rgba(105,80,40,.32)', grooveLight: 'rgba(255,255,255,.7)', shade: '#6b5636', gloss: '#ffffff', glossA: .8, text: '#5a4426' };
  const EBONY = { tex: 'ebony', base: '#1c1b1e', vary: '#34323a', rim: '#000000', grooves: [.78, .5], grooveDark: 'rgba(0,0,0,.6)', grooveLight: 'rgba(255,255,255,.14)', shade: '#000000', gloss: '#eceef6', glossA: .5, text: '#efe5cf' };
  const DICE_IVORY = { face: ['#fffbf2', '#f1e9d8', '#d6c9ae'], pip: ['#141212', '#2c2724'], inner: '#ffffff', innerA: .9, edge: '#ad9d80', hl: .5, pipHl: .25 };
  const DICE_EBONY = { face: ['#4a484f', '#26252a', '#0f0f11'], pip: ['#f7f0e1', '#d6ccb6'], inner: '#ffffff', innerA: .14, edge: '#030303', hl: .2, pipHl: .7 };
  const THEMES = {
    marine: {
      name: 'Marine', sides: ['Ivoire', 'Ébène'], ui: { bg: '#0a1020', bg2: '#121c33', fg: '#eef0f6', muted: '#a3adc4', panel: 'rgba(18,28,51,.86)', line: 'rgba(238,240,246,.13)', accent: '#b08d4a', accent2: '#d9b870', ink: '#14100a', chip: 'rgba(217,184,112,.16)' },
      frame: WALNUT, field: { tex: 'felt', base: '#1b2d4f', vary: ['#22395f', '#142340'], vig: '#020610', vigA: .55 },
      ptA: ['#f0e7d1', '#d8c8a4'], ptB: ['#7e9ccb', '#5a78a8'], ptStroke: 'rgba(5,10,30,.3)', ptShine: 'rgba(255,255,255,.16)',
      tray: { base: '#13223d', edge: '#0a1428' }, light: IVORY, dark: EBONY, diceL: DICE_IVORY, diceD: DICE_EBONY,
      hi: '#f2cd72', hiRing: '#fff3d1', hinge: true, shadow: '#03050c'
    }
  };
  const THEME_KEY = 'marine';
  const THEME = THEMES[THEME_KEY];

  /* ===== Textures générées sur canvas ===== */
  function makeTexture(kind) {
    const S = 180, c = document.createElement('canvas'); c.width = S; c.height = S; const g = c.getContext('2d');
    if (kind === 'nacre') {
      g.fillStyle = '#f7f6f1'; g.fillRect(0, 0, S, S);
      const tints = ['rgba(244,214,226,.5)', 'rgba(205,224,245,.6)', 'rgba(236,240,214,.45)', 'rgba(216,206,240,.4)', 'rgba(255,255,255,.75)'];
      for (let i = 0; i < 26; i++) {
        const x = Math.random() * S, y = Math.random() * S, r = 25 + Math.random() * 50;
        const rg = g.createRadialGradient(x, y, 0, x, y, r); const t = tints[i % tints.length];
        rg.addColorStop(0, t); rg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = rg; g.fillRect(0, 0, S, S);
      }
      g.lineCap = 'round';
      for (let i = 0; i < 16; i++) {
        g.beginPath(); let x = Math.random() * S, y = Math.random() * S; g.moveTo(x, y);
        for (let k = 0; k < 4; k++) { const nx = x + (Math.random() - .5) * 120, ny = y + (Math.random() - .5) * 120; g.quadraticCurveTo(x + (Math.random() - .5) * 80, y + (Math.random() - .5) * 80, nx, ny); x = nx; y = ny; }
        g.strokeStyle = `rgba(190,205,230,${.12 + Math.random() * .18})`; g.lineWidth = 2 + Math.random() * 6; g.filter = 'blur(2px)'; g.stroke();
      }
      g.filter = 'none';
    } else if (kind === 'marbre') {
      const lg = g.createLinearGradient(0, 0, S, S); lg.addColorStop(0, '#2a5cae'); lg.addColorStop(.5, '#1d4489'); lg.addColorStop(1, '#2d5fb3');
      g.fillStyle = lg; g.fillRect(0, 0, S, S);
      g.lineCap = 'round';
      for (let i = 0; i < 18; i++) {
        g.beginPath(); let x = Math.random() * S, y = Math.random() * S; g.moveTo(x, y);
        for (let k = 0; k < 5; k++) { const nx = x + (Math.random() - .5) * 90, ny = y + (Math.random() - .5) * 90; g.quadraticCurveTo(x + (Math.random() - .5) * 60, y + (Math.random() - .5) * 60, nx, ny); x = nx; y = ny; }
        const light = i % 3 !== 0;
        g.strokeStyle = light ? `rgba(220,232,250,${.18 + Math.random() * .3})` : `rgba(8,22,56,${.3 + Math.random() * .3})`;
        g.lineWidth = light ? .8 + Math.random() * 2.2 : 2 + Math.random() * 5; g.filter = light ? 'blur(.4px)' : 'blur(2px)';
        g.stroke();
      }
      g.filter = 'none';
      for (let i = 0; i < 10; i++) { const x = Math.random() * S, y = Math.random() * S, r = 20 + Math.random() * 50; const rg = g.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, 'rgba(255,255,255,.14)'); rg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = rg; g.fillRect(0, 0, S, S); }
    } else {
      g.fillStyle = '#c3cddd'; g.fillRect(0, 0, S, S);
      for (let i = 0; i < 16; i++) {
        g.beginPath(); let x = Math.random() * S, y = Math.random() * S; g.moveTo(x, y);
        for (let k = 0; k < 4; k++) { const nx = x + (Math.random() - .5) * 110, ny = y + (Math.random() - .5) * 110; g.quadraticCurveTo(x + (Math.random() - .5) * 70, y + (Math.random() - .5) * 70, nx, ny); x = nx; y = ny; }
        g.strokeStyle = `rgba(105,130,170,${.14 + Math.random() * .22})`; g.lineWidth = .8 + Math.random() * 3; g.filter = 'blur(1.2px)'; g.stroke();
      }
      g.filter = 'none';
      for (let i = 0; i < 8; i++) { const x = Math.random() * S, y = Math.random() * S, r = 30 + Math.random() * 60; const rg = g.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, 'rgba(255,255,255,.28)'); rg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = rg; g.fillRect(0, 0, S, S); }
    }
    return c.toDataURL('image/png');
  }

  function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  function canvasOf(S) { const c = document.createElement('canvas'); c.width = S; c.height = S; return [c, c.getContext('2d')]; }
  // bois : veines ondulées horizontales, périodiques pour que le motif se raccorde
  function texWood(o, S, seed) {
    const [c, g] = canvasOf(S), r = rng(seed);
    g.fillStyle = o.base; g.fillRect(0, 0, S, S);
    const vein = (y0, A, k, ph, w, col, a) => { g.strokeStyle = col; g.globalAlpha = a; g.lineWidth = w; for (const off of [-S, 0, S]) { g.beginPath(); for (let x = -4; x <= S + 4; x += 4) { const y = y0 + off + A * Math.sin(2 * Math.PI * k * x / S + ph) + A * .35 * Math.sin(2 * Math.PI * (k + 2) * x / S + ph * 1.7); if (x === -4) g.moveTo(x, y); else g.lineTo(x, y); } g.stroke(); } };
    for (let i = 0; i < 28; i++) vein(r() * S, 3 + r() * 9, 1 + Math.floor(r() * 2), r() * 6.28, 3 + r() * 12, r() < .6 ? o.dark : o.light, .08 + r() * .2);
    for (let i = 0; i < 110; i++) vein(r() * S, 1 + r() * 5, 1 + Math.floor(r() * 3), r() * 6.28, .5 + r() * 1.4, r() < .72 ? o.dark : o.light, .07 + r() * .2);
    g.globalAlpha = .16; g.fillStyle = o.dark;
    for (let i = 0; i < 700; i++) g.fillRect(r() * S, r() * S, 2 + r() * 6, .8);
    g.globalAlpha = 1;
    return c.toDataURL('image/png');
  }
  // feutre : marbrures très douces + grain fin + quelques fibres
  function texFelt(o, S, seed) {
    const [c, g] = canvasOf(S), r = rng(seed);
    g.fillStyle = o.base; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 16; i++) {
      const x = r() * S, y = r() * S, rad = 40 + r() * 80, col = o.vary[i % 2];
      for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) { const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rad); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.globalAlpha = .4; g.fillStyle = gr; g.fillRect(x + ox - rad, y + oy - rad, 2 * rad, 2 * rad); }
    }
    g.globalAlpha = 1;
    try { const id = g.getImageData(0, 0, S, S), d = id.data; for (let i = 0; i < d.length; i += 4) { const n = (r() - .5) * 20; d[i] += n; d[i + 1] += n; d[i + 2] += n; } g.putImageData(id, 0, 0); } catch (e) { }
    g.globalAlpha = .07; g.strokeStyle = '#ffffff'; g.lineWidth = .6;
    for (let i = 0; i < 220; i++) { const x = r() * S, y = r() * S, a = r() * 6.28, l = 3 + r() * 8; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
    g.globalAlpha = 1;
    return c.toDataURL('image/png');
  }
  // pions : ivoire veiné, ou ébène laqué
  function texChecker(o, S, seed) {
    const [c, g] = canvasOf(S), r = rng(seed);
    g.fillStyle = o.base; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 12; i++) { const x = r() * S, y = r() * S, rad = 30 + r() * 60; const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, o.vary); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.globalAlpha = o.tex === 'ivory' ? .5 : .55; g.fillStyle = gr; g.fillRect(0, 0, S, S); }
    g.lineCap = 'round';
    for (let i = 0; i < (o.tex === 'ivory' ? 18 : 12); i++) {
      g.beginPath(); let x = r() * S, y = r() * S; g.moveTo(x, y);
      for (let k = 0; k < 3; k++) { const nx = x + (r() - .5) * 140, ny = y + (r() - .5) * 40; g.quadraticCurveTo(x + (r() - .5) * 60, y + (r() - .5) * 30, nx, ny); x = nx; y = ny; }
      g.strokeStyle = o.tex === 'ivory' ? 'rgba(140,110,60,.10)' : 'rgba(255,255,255,.07)'; g.lineWidth = 1 + r() * 3; g.stroke();
    }
    g.globalAlpha = 1;
    return c.toDataURL('image/png');
  }
  const TEX_CACHE = {};
  function textureFor(spec, slot) {
    const key = THEME_KEY + ':' + slot;
    if (TEX_CACHE[key]) return TEX_CACHE[key];
    let out;
    if (spec.tex === 'nacre' || spec.tex === 'marbre') out = [makeTexture(spec.tex), 180];
    else if (spec.tex === 'ivoireMarbre') out = [makeTexture('ivoire'), 180];
    else if (spec.tex === 'wood') out = [texWood(spec, 512, slot === 'field' ? 11 : 7), 512];
    else if (spec.tex === 'felt') out = [texFelt(spec, 256, 5), 256];
    else out = [texChecker(spec, 180, spec.tex === 'ivory' ? 3 : 9), 180];
    return (TEX_CACHE[key] = out);
  }

  /* ===== Construction du SVG ===== */
  const svg = $('board');
  svg.style.touchAction = 'none';
  const defs = el('defs', {}, svg);
  function pattern(id, href, size, centered) { const p = el('pattern', { id, patternUnits: 'userSpaceOnUse', width: size, height: size, x: centered ? -size / 2 : 0, y: centered ? -size / 2 : 0 }, defs); el('image', { href, width: size, height: size, preserveAspectRatio: 'none' }, p); }
  function radial(id, stops, attrs) { const g = el('radialGradient', Object.assign({ id }, attrs || {}), defs); stops.forEach(s => el('stop', { offset: s[0], 'stop-color': s[1], 'stop-opacity': s[2] == null ? 1 : s[2] }, g)); }
  function linear(id, stops, attrs) { const g = el('linearGradient', Object.assign({ id }, attrs || {}), defs); stops.forEach(s => el('stop', { offset: s[0], 'stop-color': s[1], 'stop-opacity': s[2] == null ? 1 : s[2] }, g)); }
  const VERT = { x1: 0, y1: 0, x2: 0, y2: 1 }, DIAG = { x1: 0, y1: 0, x2: 1, y2: 1 };
  function buildDefs() {
    const T = THEME; defs.innerHTML = '';
    for (const [id, spec, slot] of [['texL', T.light, 'light'], ['texD', T.dark, 'dark'], ['texFrame', T.frame, 'frame']]) { const [u, s] = textureFor(spec, slot); pattern(id, u, s, slot !== 'frame'); }
    if (T.field.tex !== 'gradient') { const [u, s] = textureFor(T.field, 'field'); pattern('texField', u, s); }
    else radial('field', T.field.stops, { cx: '50%', cy: '40%', r: '75%' });
    radial('fieldVig', [[0, T.field.vig, 0], [.6, T.field.vig, 0], [1, T.field.vig, T.field.vigA]], { cx: '50%', cy: '50%', r: '72%' });
    radial('shadeW', [[0, '#fff', 0], [.62, '#fff', 0], [.86, T.light.shade, .22], [1, T.light.shade, .5]], { cx: '50%', cy: '50%', r: '50%' });
    radial('shadeB', [[0, '#fff', 0], [.62, '#fff', 0], [.86, T.dark.shade, .3], [1, T.dark.shade, .7]], { cx: '50%', cy: '50%', r: '50%' });
    radial('glossW', [[0, T.light.gloss, T.light.glossA], [.5, T.light.gloss, .16], [1, T.light.gloss, 0]], { cx: '36%', cy: '30%', r: '45%' });
    radial('glossB', [[0, T.dark.gloss, T.dark.glossA], [.5, T.dark.gloss, .12], [1, T.dark.gloss, 0]], { cx: '36%', cy: '30%', r: '45%' });
    linear('ptA', [[0, T.ptA[0]], [1, T.ptA[1]]], VERT);
    linear('ptB', [[0, T.ptB[0]], [1, T.ptB[1]]], VERT);
    linear('diceW', [[0, T.diceL.face[0]], [.55, T.diceL.face[1]], [1, T.diceL.face[2]]], DIAG);
    linear('diceB', [[0, T.diceD.face[0]], [.5, T.diceD.face[1]], [1, T.diceD.face[2]]], DIAG);
    if (T.diceD.glass) radial('diceBglass', [[0, '#bfe4ff', .5], [.6, '#bfe4ff', .08], [1, '#bfe4ff', 0]], { cx: '40%', cy: '35%', r: '60%' });
    radial('pipW', [[0, T.diceL.pip[0]], [1, T.diceL.pip[1]]], { cx: '40%', cy: '35%', r: '65%' });
    radial('pipB', [[0, T.diceD.pip[0]], [1, T.diceD.pip[1]]], { cx: '40%', cy: '35%', r: '65%' });
    linear('slabW', [[0, '#ffffff', .55], [.35, '#ffffff', 0], [1, T.light.shade, .45]], VERT);
    linear('slabB', [[0, '#ffffff', .3], [.35, '#ffffff', 0], [1, T.dark.shade, .6]], VERT);
    linear('brass', [[0, '#f6e1a4'], [.45, '#b98f3e'], [1, '#e8c97e']], { x1: 0, y1: 0, x2: 1, y2: 0 });
    const fsh = el('filter', { id: 'chkShadow', x: '-20%', y: '-20%', width: '140%', height: '140%' }, defs); el('feDropShadow', { dx: 0, dy: 3, stdDeviation: 2.2, 'flood-color': T.shadow, 'flood-opacity': .5 }, fsh);
    const fdr = el('filter', { id: 'dragShadow', x: '-40%', y: '-40%', width: '180%', height: '180%' }, defs); el('feDropShadow', { dx: 0, dy: 10, stdDeviation: 6, 'flood-color': T.shadow, 'flood-opacity': .55 }, fdr);
    const fin = el('filter', { id: 'inner', x: '-5%', y: '-5%', width: '110%', height: '110%' }, defs); el('feDropShadow', { dx: 0, dy: 2, stdDeviation: 3, 'flood-color': '#000', 'flood-opacity': .35 }, fin);
  }

  const root = el('g', { id: 'root' }, svg);
  const gStatic = el('g', {}, root), gHi = el('g', {}, root), gChk = el('g', { filter: 'url(#chkShadow)' }, root), gDice = el('g', {}, root), gLabels = el('g', {}, root), gDrag = el('g', {}, root);
  function buildStatic() {
    const T = THEME; gStatic.innerHTML = '';
    // cadre
    el('rect', { x: 0, y: 0, width: W, height: H, rx: 26, fill: 'url(#texFrame)' }, gStatic);
    el('rect', { x: 0, y: 0, width: W, height: H, rx: 26, fill: 'none', stroke: T.frame.hl, 'stroke-width': 2 }, gStatic);
    el('rect', { x: 1.5, y: 1.5, width: W - 3, height: H - 3, rx: 25, fill: 'none', stroke: T.frame.edge, 'stroke-opacity': .7, 'stroke-width': 1.3 }, gStatic);
    if (T.frame.lip) el('rect', { x: innerL - 6, y: innerT - 6, width: innerR - innerL + 12, height: innerB - innerT + 12, rx: 13, fill: 'none', stroke: T.frame.lip, 'stroke-width': 3 }, gStatic);
    // champ de jeu
    el('rect', { x: innerL, y: innerT, width: innerR - innerL, height: innerB - innerT, rx: 10, fill: T.field.tex === 'gradient' ? 'url(#field)' : 'url(#texField)', filter: 'url(#inner)' }, gStatic);
    if (T.field.vigA) el('rect', { x: innerL, y: innerT, width: innerR - innerL, height: innerB - innerT, rx: 10, fill: 'url(#fieldVig)' }, gStatic);
    for (let i = 0; i < 24; i++) {
      const x = pointX(i), top = isTop(i);
      const y0 = top ? innerT : innerB, y1 = top ? innerT + PH : innerB - PH;
      el('path', { d: `M${x - PW / 2 + 2} ${y0} L${x + PW / 2 - 2} ${y0} L${x} ${y1} Z`, fill: i % 2 === 0 ? 'url(#ptA)' : 'url(#ptB)', opacity: .97, stroke: T.ptStroke, 'stroke-width': .8 }, gStatic);
      el('path', { d: `M${x - PW / 2 + 2} ${y0} L${x} ${y1}`, fill: 'none', stroke: T.ptShine, 'stroke-width': 1 }, gStatic);
    }
    // barre centrale
    el('rect', { x: barL, y: innerT - 2, width: BARW, height: innerB - innerT + 4, fill: 'url(#texFrame)' }, gStatic);
    el('rect', { x: barL, y: innerT - 2, width: BARW, height: innerB - innerT + 4, fill: 'none', stroke: T.frame.edge, 'stroke-opacity': .6 }, gStatic);
    if (T.hinge) {
      const cx = barL + BARW / 2;
      el('line', { x1: cx, y1: innerT, x2: cx, y2: innerB, stroke: '#000', 'stroke-opacity': .45, 'stroke-width': 1.2 }, gStatic);
      el('line', { x1: cx + 1.2, y1: innerT, x2: cx + 1.2, y2: innerB, stroke: '#fff', 'stroke-opacity': .08, 'stroke-width': 1 }, gStatic);
      for (const y of [innerT + 70, innerB - 120]) {
        el('rect', { x: cx - 8, y, width: 16, height: 50, rx: 3, fill: 'url(#brass)', stroke: '#5a3f12', 'stroke-width': .8 }, gStatic);
        el('line', { x1: cx, y1: y + 2, x2: cx, y2: y + 48, stroke: '#6b4a16', 'stroke-width': .8 }, gStatic);
        for (const dy of [10, 40]) { el('circle', { cx: cx - 4, cy: y + dy, r: 1.6, fill: '#7a5a22' }, gStatic); el('circle', { cx: cx + 4, cy: y + dy, r: 1.6, fill: '#7a5a22' }, gStatic); }
      }
    }
    // casiers de sortie
    for (const [y, hh] of [[H / 2 + 6, innerB - H / 2 - 6], [innerT, H / 2 - 6 - innerT]]) {
      el('rect', { x: trayX, y, width: TRAY, height: hh, rx: 8, fill: T.tray.base, filter: 'url(#inner)' }, gStatic);
      el('rect', { x: trayX, y, width: TRAY, height: hh, rx: 8, fill: 'none', stroke: T.tray.edge, 'stroke-width': 1.2 }, gStatic);
    }
    const bottom = [H / 2 + 6, innerB - H / 2 - 6], top = [innerT, H / 2 - 6 - innerT];
    for (const [r, [y, hh]] of [[trayHiW, flip ? top : bottom], [trayHiB, flip ? bottom : top]]) { r.setAttribute('x', trayX); r.setAttribute('y', y); r.setAttribute('width', TRAY); r.setAttribute('height', hh); r.setAttribute('fill', T.hi); r.setAttribute('stroke', T.hi); }
  }
  const trayHiW = el('rect', { rx: 8, 'fill-opacity': .18, 'stroke-width': 3, opacity: 0 });
  const trayHiB = el('rect', { rx: 8, 'fill-opacity': .18, 'stroke-width': 3, opacity: 0 });
  // couleurs de l'interface autour du plateau
  function applyThemeUI() {
    const T = THEME, u = T.ui, st = document.documentElement.style;
    const set = (k, v) => st.setProperty(k, v);
    set('--bg', u.bg); set('--bg2', u.bg2); set('--fg', u.fg); set('--muted', u.muted); set('--panel', u.panel); set('--panel-line', u.line);
    set('--accent', u.accent); set('--accent-2', u.accent2); set('--accent-ink', u.ink); set('--chip', u.chip);
    const lb = T.light.base, db = T.dark.base;
    set('--pawn-w', `radial-gradient(circle at 35% 30%, #ffffff 0%, ${lb} 50%, ${T.light.shade} 130%)`);
    set('--pawn-b', `radial-gradient(circle at 35% 30%, ${T.dark.tex === 'marbre' ? '#6d93d9' : '#6a6870'} 0%, ${db} 55%, #000 120%)`);
    set('--pawn-pair', `linear-gradient(90deg, ${lb} 50%, ${db} 50%)`);
    st.colorScheme = 'dark';
    const meta = document.querySelector('meta[name="theme-color"]'); if (meta) meta.setAttribute('content', u.bg);
  }
  buildDefs(); applyThemeUI(); buildStatic();

  /* ===== État de la partie ===== */
  const G = { mode: 'ai', level: 2, state: null, player: 1, phase: 'idle', dice: null, rem: [], required: 0, steps: [], selected: null, history: [], scores: loadScores(), busy: false, lastDicePlayer: 1, tilt: [0, 0, 0, 0], lift: null, drag: null, online: null, turnSteps: [], gen: 0 };
  let RULE5 = true; try { RULE5 = localStorage.getItem('nacre.rule5') !== 'off'; } catch (e) { }
  // règle maison : celui qui gagne le lancer d'ouverture peut relancer ses deux dés une fois
  let RULE_REROLL = true; try { RULE_REROLL = localStorage.getItem('nacre.reroll') !== 'off'; } catch (e) { }
  function syncRuleButtons() {
    document.querySelectorAll('.ruleToggle').forEach(b => { b.textContent = RULE5 ? '5 pions max : oui' : '5 pions max : non'; b.setAttribute('aria-pressed', RULE5 ? 'true' : 'false'); });
    document.querySelectorAll('.rerollToggle').forEach(b => { b.textContent = RULE_REROLL ? 'Relance au départ : oui' : 'Relance au départ : non'; b.setAttribute('aria-pressed', RULE_REROLL ? 'true' : 'false'); });
  }
  function loadScores() { try { const s = JSON.parse(localStorage.getItem('nacre.scores') || 'null'); if (s && typeof s.w === 'number') return s; } catch (e) { } return { w: 0, b: 0 }; }
  function saveScores() { try { localStorage.setItem('nacre.scores', JSON.stringify(G.scores)); } catch (e) { } }
  const isHuman = p => G.mode === '2p' || (G.mode === 'online' ? !!G.online && p === G.online.color : p === 1);
  const isMe = p => G.mode === 'online' && !!G.online && p === G.online.color;
  const sideName = p => THEME.sides[p === 1 ? 0 : 1];
  const nameOf = p => (G.mode === 'online' && G.online && G.online.names && G.online.names[p]) ? G.online.names[p] : sideName(p);
  const LEVELS = { 1: 'Débutant', 2: 'Intermédiaire', 3: 'Expert' };
  const kOf = p => (p === 1 ? 0 : 1);

  /* ===== Rendu ===== */
  function drawChecker(x, y, p, count, parent) {
    const L = p === 1 ? THEME.light : THEME.dark;
    const g = el('g', { transform: `translate(${x} ${y})` }, parent || gChk);
    el('circle', { r: R, fill: p === 1 ? 'url(#texL)' : 'url(#texD)' }, g);
    el('circle', { r: R, fill: p === 1 ? 'url(#shadeW)' : 'url(#shadeB)' }, g);
    if (L.grooves) for (const f of L.grooves) { el('circle', { r: R * f, fill: 'none', stroke: L.grooveDark, 'stroke-width': 1.7 }, g); el('circle', { cx: .5, cy: .8, r: R * f - 1.3, fill: 'none', stroke: L.grooveLight, 'stroke-width': .9 }, g); }
    el('circle', { r: R, fill: p === 1 ? 'url(#glossW)' : 'url(#glossB)' }, g);
    el('circle', { r: R - .5, fill: 'none', stroke: L.rim, 'stroke-opacity': .7, 'stroke-width': 1.2 }, g);
    if (!L.grooves) el('circle', { r: R - 7, fill: 'none', stroke: L.ring, 'stroke-opacity': .35, 'stroke-width': .8 }, g);
    if (count > 1) {
      const t = el('text', { x: 0, y: 0, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-family': 'Manrope, sans-serif', 'font-weight': 700, 'font-size': 20 * fScale, fill: L.text }, g);
      t.textContent = count;
    }
    return g;
  }
  // pion couché dans le casier, vu de la tranche
  function drawSlab(pos, p, k, parent) {
    const g = el('g', { transform: `translate(${pos.x + ((k * 7) % 3 - 1) * .8} ${pos.y})` }, parent || gChk);
    el('rect', { x: -SLAB_W / 2, y: -SLAB_H / 2, width: SLAB_W, height: SLAB_H, rx: 3.5, fill: p === 1 ? 'url(#texL)' : 'url(#texD)' }, g);
    el('rect', { x: -SLAB_W / 2, y: -SLAB_H / 2, width: SLAB_W, height: SLAB_H, rx: 3.5, fill: p === 1 ? 'url(#slabW)' : 'url(#slabB)' }, g);
    el('rect', { x: -SLAB_W / 2, y: -SLAB_H / 2, width: SLAB_W, height: SLAB_H, rx: 3.5, fill: 'none', stroke: (p === 1 ? THEME.light : THEME.dark).rim, 'stroke-opacity': .7, 'stroke-width': .7 }, g);
    return g;
  }
  // position du pion du dessus à un emplacement, et position du prochain pion posé
  function topPos(loc, p, s) {
    if (loc === BAR) { const n = Math.min(s.bar[kOf(p)], 2); return barPos(p, n, n - 1); }
    const n = Math.min(Math.abs(s.pts[loc]), 5); return stackPos(loc, n, Math.max(0, n - 1));
  }
  function nextPos(loc, p, s) {
    if (loc === OFF) return trayPos(p, s.off[kOf(p)]);
    const c = s.pts[loc]; const n = c * p > 0 ? Math.min(Math.abs(c), 5) : 0;
    return stackPos(loc, n + 1, Math.min(n, 4));
  }
  function render() {
    gChk.innerHTML = ''; gHi.innerHTML = ''; gDice.innerHTML = ''; gLabels.innerHTML = '';
    gHi.appendChild(trayHiW); gHi.appendChild(trayHiB); for (const t of [trayHiW, trayHiB]) { t.setAttribute('opacity', 0); t.setAttribute('stroke-width', 3); }
    const s = G.state; if (!s) return;
    const interactive = G.phase === 'move' && isHuman(G.player) && !G.busy;
    const movable = new Set(interactive ? G.steps.map(st => st.from) : []);
    const src = G.drag ? G.drag.from : G.selected;
    const dests = interactive ? destinationsFor(src) : [];
    if (src != null && src !== BAR && !G.drag) {
      const i = src, x = pointX(i), top = isTop(i);
      el('path', { d: `M${x - PW / 2 + 2} ${top ? innerT : innerB} L${x + PW / 2 - 2} ${top ? innerT : innerB} L${x} ${top ? innerT + PH : innerB - PH} Z`, fill: THEME.hi, opacity: .3 }, gHi);
    }
    if (src === BAR && !G.drag) el('rect', { x: barL, y: innerT, width: BARW, height: innerB - innerT, fill: THEME.hi, opacity: .3 }, gHi);
    const liftAt = G.drag ? G.drag.from : G.lift;
    for (let i = 0; i < 24; i++) {
      const c = s.pts[i]; if (!c) continue;
      const p = c > 0 ? 1 : -1; let n = Math.abs(c);
      if (liftAt === i) n--;
      const show = Math.min(n, 5);
      for (let k = 0; k < show; k++) { const pos = stackPos(i, show, k); drawChecker(pos.x, pos.y, p, k === show - 1 && n > 5 ? n : 1); }
      if (movable.has(i) && src == null) { const pos = stackPos(i, Math.max(show, 1), Math.max(show - 1, 0)); el('circle', { cx: pos.x, cy: pos.y, r: R + 5, fill: 'none', stroke: THEME.hi, 'stroke-width': 2.5, class: 'pulse' }, gHi); }
    }
    for (const p of [1, -1]) {
      let n = s.bar[kOf(p)]; if (liftAt === BAR && p === G.player) n--;
      if (n <= 0) continue;
      const show = Math.min(n, 2);
      for (let k = 0; k < show; k++) { const pos = barPos(p, show, k); drawChecker(pos.x, pos.y, p, k === show - 1 && n > 2 ? n : 1); }
      if (movable.has(BAR) && src == null && p === G.player) { const pos = barPos(p, show, show - 1); el('circle', { cx: pos.x, cy: pos.y, r: R + 5, fill: 'none', stroke: THEME.hi, 'stroke-width': 2.5, class: 'pulse' }, gHi); }
    }
    for (const p of [1, -1]) {
      const n = s.off[kOf(p)];
      for (let k = 0; k < n; k++) drawSlab(trayPos(p, k), p, k);
    }
    for (const d of dests) {
      if (d.to === OFF) { (G.player === 1 ? trayHiW : trayHiB).setAttribute('opacity', 1); continue; }
      const pos = nextPos(d.to, G.player, s);
      el('circle', { cx: pos.x, cy: pos.y, r: R - 2, fill: THEME.hi, opacity: d.composite ? .28 : .48, class: 'pulse' }, gHi);
      el('circle', { cx: pos.x, cy: pos.y, r: R + 2, fill: 'none', stroke: THEME.hiRing, 'stroke-width': 2, opacity: .9 }, gHi);
    }
    if (G.dice && !G.rolling) {
      if (G.phase === 'opening-roll') {
        drawDie(diceX(-1), H / 2, G.dice[1], -1, false, G.tilt[1]);
        drawDie(diceX(1), H / 2, G.dice[0], 1, false, G.tilt[0]);
      } else {
        const p = G.lastDicePlayer; const cx = diceX(p);
        const used = usedDice(); const list = diceList(G.dice);
        const n = list.length, span = n === 4 ? 56 : 64;
        list.forEach((d, i) => drawDie(cx + (i - (n - 1) / 2) * span, H / 2, d, p, used[i], G.tilt[i]));
      }
    }
    renderUI();
  }
  function usedDice() {
    const list = diceList(G.dice); const rem = G.rem.slice(); const used = [];
    if (G.phase !== 'move') return list.map(() => false);
    for (const d of list) { const j = rem.indexOf(d); if (j >= 0) { rem.splice(j, 1); used.push(false); } else used.push(true); }
    return used;
  }
  const PIPS = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] };
  function drawDie(cx, cy, v, p, used, tilt, parent) {
    const g = el('g', { opacity: used ? .32 : 1 }, parent || gDice);
    setDieTransform(g, cx, cy, tilt || 0, 1);
    const w = p === 1, D = w ? THEME.diceL : THEME.diceD;
    const k = DS / 46, rx = 10 * k;
    el('rect', { x: -DS / 2, y: -DS / 2, width: DS, height: DS, rx, fill: w ? 'url(#diceW)' : 'url(#diceB)', filter: 'url(#chkShadow)' }, g);
    if (D.glass) el('rect', { x: -DS / 2, y: -DS / 2, width: DS, height: DS, rx, fill: 'url(#diceBglass)' }, g);
    el('rect', { x: -DS / 2 + .8, y: -DS / 2 + .8, width: DS - 1.6, height: DS - 1.6, rx: rx - .6, fill: 'none', stroke: D.inner, 'stroke-opacity': D.innerA, 'stroke-width': 1.2 }, g);
    el('rect', { x: -DS / 2, y: -DS / 2, width: DS, height: DS, rx, fill: 'none', stroke: D.edge, 'stroke-opacity': .9, 'stroke-width': 1 }, g);
    el('ellipse', { cx: -8 * k, cy: -12 * k, rx: 13 * k, ry: 6 * k, fill: '#fff', 'fill-opacity': D.hl, transform: `rotate(-32 ${-8 * k} ${-12 * k})` }, g);
    for (const [dx, dy] of PIPS[v]) {
      el('circle', { cx: dx * 12.5 * k, cy: dy * 12.5 * k, r: 4.2 * k, fill: w ? 'url(#pipW)' : 'url(#pipB)' }, g);
      el('circle', { cx: (dx * 12.5 - 1.2) * k, cy: (dy * 12.5 - 1.4) * k, r: 1.1 * k, fill: '#fff', 'fill-opacity': D.pipHl }, g);
    }
    return g;
  }
  function setDieTransform(g, cx, cy, rot, sc) { g.setAttribute('transform', `translate(${cx} ${cy}) rotate(${rot}) scale(${sc})`); }
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  function renderUI() {
    const s = G.state;
    $('subW').textContent = s ? `${pipCount(s, 1)} pips · ${s.off[0]} sorti${s.off[0] > 1 ? 's' : ''}` : '';
    $('subB').textContent = s ? `${pipCount(s, -1)} pips · ${s.off[1]} sorti${s.off[1] > 1 ? 's' : ''}` : '';
    $('nameW').textContent = sideName(1); $('nameB').textContent = sideName(-1);
    $('lvlB').textContent = G.mode === 'ai' ? LEVELS[G.level] : (G.mode === 'online' ? (nameOf(-1) === sideName(-1) ? 'En ligne' : nameOf(-1)) : '');
    $('lvlW').textContent = G.mode === 'online' ? (nameOf(1) === sideName(1) ? 'En ligne' : nameOf(1)) : '';
    $('whoW').style.order = flip ? 0 : 1; $('whoB').style.order = flip ? 1 : 0;
    $('whoW').classList.toggle('active', G.player === 1 && G.phase !== 'idle');
    $('whoB').classList.toggle('active', G.player === -1 && G.phase !== 'idle');
    $('scW').textContent = G.scores.w; $('scB').textContent = G.scores.b;
    const main = $('mainBtn'), undo = $('undoBtn'), st = $('status');
    undo.hidden = !(G.phase === 'move' && G.history.length > 0 && isHuman(G.player) && !G.busy);
    $('rerollBtn').hidden = !(G.phase === 'choice' && isHuman(G.player) && !G.busy && !G.rolling);
    let title = '', hint = '', label = '';
    const you = G.mode === '2p' ? nameOf(G.player) : 'vous';
    const opp = G.mode === 'online' ? nameOf(-(G.online ? G.online.color : 1)) : 'Marbre';
    switch (G.phase) {
      case 'waiting': title = 'En attente de votre ami'; hint = `Code de la partie : ${G.online ? G.online.code : ''}`; break;
      case 'opening': title = 'Qui commence ?'; hint = 'Chacun lance un dé, le plus fort joue les deux.'; break;
      case 'choice': {
        const d = G.dice || [0, 0];
        if (isHuman(G.player)) { title = `${G.mode === '2p' ? nameOf(G.player) + ' commence' : 'Vous commencez'} avec ${d[0]} et ${d[1]}`; hint = 'Jouez ces dés ou relancez-les une fois.'; label = 'Jouer ces dés'; }
        else { title = `${opp} commence avec ${d[0]} et ${d[1]}`; hint = 'Il garde ses dés ou les relance…'; }
        break;
      }
      case 'opening-roll': title = G.msg || ''; hint = G.hint || ''; break;
      case 'roll': if (isHuman(G.player)) { title = `À ${you} de jouer`; hint = 'Lancer des dés…'; } else { title = `${opp} lance les dés…`; if (G.mode === 'online') hint = G.online && G.online.oppOnline === false ? 'Votre ami n\'a pas la page ouverte.' : ''; } break;
      case 'move':
        if (isHuman(G.player)) {
          if (G.required === 0) { title = 'Tour terminé'; hint = 'Validez pour passer la main.'; label = 'Fin du tour'; }
          else if (G.selected != null) { title = 'Déposez le pion'; hint = 'Touchez une case éclairée, ou le pion pour annuler.'; }
          else { title = `${G.required} coup${G.required > 1 ? 's' : ''} à jouer`; hint = 'Glissez un pion cerclé vers sa case.'; }
        } else { title = `${opp} joue…`; }
        break;
      case 'nomove': title = 'Aucun coup possible'; hint = 'Les dés ne passent pas, la main change.'; break;
      case 'over': title = 'Partie terminée'; label = G.mode === 'online' ? 'Rejouer' : 'Nouvelle partie'; break;
    }
    if (G.mode === 'online' && NET.kind === 'relay' && NET.relay && !NET.relay.connected()) hint = 'Connexion perdue, reconnexion en cours…';
    st.innerHTML = title ? `<b>${esc(title)}</b>${hint ? `<span class="hint">${esc(hint)}</span>` : ''}` : '';
    main.hidden = !label;
    if (label) main.textContent = label;
  }

  /* ===== Sons synthétisés (aucun fichier) : objets qui résonnent, filtrés doux, petite réverbération de pièce ===== */
  const SFX = (() => {
    let ctx = null, noiseBuf = null, bus = null, on = true;
    try { on = localStorage.getItem('nacre.sound') !== 'off'; } catch (e) { }
    function ensure() {
      if (!on) return null;
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
        try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { }
        try { ctx = new AC(); } catch (e) { return null; }
        const sr = ctx.sampleRate;
        const len = Math.floor(sr * .6); noiseBuf = ctx.createBuffer(1, len, sr);
        const nd = noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) nd[i] = Math.random() * 2 - 1;
        // chaîne : bus -> passe-bas doux -> (sec + réverbération) -> compresseur -> sortie
        const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -20; comp.ratio.value = 3; comp.connect(ctx.destination);
        const out = ctx.createGain(); out.gain.value = .7; out.connect(comp);
        const soft = ctx.createBiquadFilter(); soft.type = 'lowpass'; soft.frequency.value = 5200; soft.Q.value = .5;
        bus = ctx.createGain(); bus.connect(soft); soft.connect(out);
        const rv = ctx.createConvolver(); const rl = Math.floor(sr * .45); const ir = ctx.createBuffer(2, rl, sr);
        for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < rl; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / rl, 3.2); }
        rv.buffer = ir; const wet = ctx.createGain(); wet.gain.value = .16; soft.connect(rv); rv.connect(wet); wet.connect(out);
      }
      if (ctx.state === 'suspended') { try { ctx.resume(); } catch (e) { } }
      return ctx.state === 'running' ? ctx : null;
    }
    ['pointerdown', 'touchend', 'keydown', 'click'].forEach(t => window.addEventListener(t, () => { if (on) ensure(); }, { capture: true, passive: true }));
    const rr = (a, b) => a + Math.random() * (b - a);
    // frappe d'un objet : une impulsion très courte qui fait sonner quelques modes (comme un vrai pion ou un dé)
    function strike(t, modes, gain, bright) {
      const src = ctx.createBufferSource(); src.buffer = noiseBuf;
      const env = ctx.createGain(); env.gain.setValueAtTime(1, t); env.gain.exponentialRampToValueAtTime(.001, t + .006);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = bright || 3000;
      src.connect(env); env.connect(lp);
      const k = rr(.96, 1.04);
      for (const [f, g, d, q] of modes) {
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f * k; bp.Q.value = q || 16;
        const mg = ctx.createGain(); mg.gain.setValueAtTime(g * gain * 6, t); mg.gain.exponentialRampToValueAtTime(.0004, t + d);
        lp.connect(bp); bp.connect(mg); mg.connect(bus);
      }
      src.start(t, rr(0, .5)); src.stop(t + .03);
    }
    // souffle filtré (roulement, glissé, corps grave)
    function breath(t, f, dur, gain, attack, type) {
      const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
      const fl = ctx.createBiquadFilter(); fl.type = type || 'lowpass'; fl.frequency.value = f; fl.Q.value = .7;
      const g = ctx.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(.0003, t + dur);
      src.connect(fl); fl.connect(g); g.connect(bus); src.start(t, rr(0, .3)); src.stop(t + dur + .05);
    }
    const T = () => ctx.currentTime + .004;
    const CHECKER = [[640, 1, .11, 14], [1190, .5, .07, 16], [1880, .22, .045, 18]];
    const CHECKER_ON_CHECKER = [[1320, .8, .08, 18], [2240, .38, .05, 20], [3300, .14, .03, 22]];
    const DIE = [[1750, .8, .05, 16], [2900, .35, .035, 18]];
    return {
      get on() { return on; },
      set(v) { on = v; try { localStorage.setItem('nacre.sound', v ? 'on' : 'off'); } catch (e) { } if (v) ensure(); },
      // roulement feutré des dés pendant toute l'animation
      roll(dur) { if (!ensure()) return; breath(T(), 650, dur, .035, .12); },
      // petit choc d'un dé qui roule
      diceTick() { if (!ensure()) return; strike(T(), DIE, rr(.05, .1), 4200); },
      // dé qui se pose, puis se stabilise
      diceLand() { if (!ensure()) return; const t = T(); strike(t, DIE, .2, 3600); breath(t, 260, .06, .05, .004); strike(t + rr(.07, .1), DIE, .07, 3800); },
      // pion saisi : presque rien, un frôlement
      lift() { if (!ensure()) return; breath(T(), 1400, .09, .012, .03); },
      // pion posé : « toc » boisé, plus clair sur un autre pion
      place(stacked) { if (!ensure()) return; const t = T();
        if (stacked) strike(t, CHECKER_ON_CHECKER, .19, 3600);
        else { strike(t, CHECKER, .24, 2800); breath(t, 200, .07, .06, .004); } },
      // frappe : le pion se pose, celui de l'adversaire est chassé
      hit() { if (!ensure()) return; const t = T(); strike(t, CHECKER, .26, 3000); breath(t, 200, .07, .06, .004); strike(t + .075, CHECKER_ON_CHECKER, .12, 3400); },
      // sortie : glissé doux puis le pion se couche dans le casier
      tray() { if (!ensure()) return; const t = T(); breath(t, 700, .2, .02, .07); strike(t + .1, [[900, 1, .09, 12], [1600, .4, .05, 14]], .16, 2400); }
    };
  })();
  function syncSoundButtons() { document.querySelectorAll('.soundToggle').forEach(b => { b.textContent = SFX.on ? 'Son activé' : 'Son coupé'; b.setAttribute('aria-pressed', SFX.on ? 'true' : 'false'); }); }
  document.querySelectorAll('.soundToggle').forEach(b => b.addEventListener('click', () => { SFX.set(!SFX.on); syncSoundButtons(); if (SFX.on) setTimeout(() => SFX.place(false), 30); }));
  syncSoundButtons();
  document.querySelectorAll('.rerollToggle').forEach(b => b.addEventListener('click', () => { RULE_REROLL = !RULE_REROLL; try { localStorage.setItem('nacre.reroll', RULE_REROLL ? 'on' : 'off'); } catch (e) { } syncRuleButtons(); }));
  document.querySelectorAll('.ruleToggle').forEach(b => b.addEventListener('click', () => { RULE5 = !RULE5; try { localStorage.setItem('nacre.rule5', RULE5 ? 'on' : 'off'); } catch (e) { } syncRuleButtons(); }));
  syncRuleButtons();

  /* ===== Animations ===== */
  function animate(ms, step, done) {
    if (reduced) { step(1); done && done(); return; }
    const t0 = performance.now();
    const f = now => { const t = Math.min(1, (now - t0) / ms); step(t); if (t < 1) requestAnimationFrame(f); else done && done(); };
    requestAnimationFrame(f);
  }
  // un pion glisse d'un emplacement à un autre
  function slide(step, p, done) {
    const s = G.state;
    const a = topPos(step.from, p, s), b = nextPos(step.to, p, s);
    G.lift = step.from; render();
    const ghost = drawChecker(a.x, a.y, p, 1, gDrag); ghost.setAttribute('filter', 'url(#dragShadow)');
    const dist = Math.hypot(b.x - a.x, b.y - a.y);
    const off = step.to === OFF;
    const stacked = !off && s.pts[step.to] * p > 0;
    SFX.lift();
    animate(Math.min(560, 240 + dist * .35) + (off ? 160 : 0), t => {
      const e = easeInOut(t); const lift = Math.sin(Math.PI * t);
      const x = a.x + (b.x - a.x) * e, y = a.y + (b.y - a.y) * e;
      if (off) { // il se couche sur la tranche en arrivant
        const f = easeInOut(Math.max(0, (t - .45) / .55));
        const sx = 1 + .12 * lift * (1 - f) + (SLAB_W / (2 * R) - 1) * f, sy = 1 + .12 * lift * (1 - f) + (SLAB_H / (2 * R) - 1) * f;
        ghost.setAttribute('transform', `translate(${x} ${y}) scale(${sx} ${sy})`);
      } else ghost.setAttribute('transform', `translate(${x} ${y}) scale(${1 + .12 * lift})`);
    }, () => { ghost.remove(); G.lift = null; if (step.hit) SFX.hit(); else if (off) SFX.tray(); else SFX.place(stacked); done(); });
  }
  // le pion saisi retombe à l'emplacement b (après dépôt ou retour)
  function settle(ghost, from, to, done, flat) {
    animate(flat ? 260 : 160, t => { const e = easeOut(t); const x = from.x + (to.x - from.x) * e, y = from.y + (to.y - from.y) * e;
      if (flat) { const f = easeInOut(Math.max(0, (t - .3) / .7)); ghost.setAttribute('transform', `translate(${x} ${y}) scale(${1.1 - .1 * e + (SLAB_W / (2 * R) - 1) * f} ${1.1 - .1 * e + (SLAB_H / (2 * R) - 1) * f})`); }
      else ghost.setAttribute('transform', `translate(${x} ${y}) scale(${1.1 - .1 * e})`); }, () => { ghost.remove(); done(); });
  }
  const rnd = () => 1 + Math.floor(Math.random() * 6);
  const randTilt = () => (Math.random() * 14 - 7);
  // lancer de dés : les dés arrivent en culbutant, ralentissent puis se posent inclinés
  function rollDice(spec, done) {
    // spec: [{cx, cy, v, p}] ; les valeurs finales v sont déjà connues
    G.rolling = true; G.busy = true; gDice.innerHTML = ''; gLabels.innerHTML = ''; renderUI();
    const dur = reduced ? 1 : 1500;
    SFX.roll(dur / 1000 * .85);
    const dies = spec.map((d, i) => {
      const dir = ((d.p === 1) !== flip) ? -1 : 1; // arrive du bord
      const startX = d.cx + dir * (110 + i * 30), startY = d.cy + (i % 2 ? 40 : -40);
      const spin = (Math.random() < .5 ? -1 : 1) * (540 + Math.random() * 360);
      const tilt = randTilt();
      const g = drawDie(d.cx, d.cy, rnd(), d.p, false, 0, gDice);
      return { d, g, startX, startY, spin, tilt, face: 0, nextChange: 0 };
    });
    // instants de changement de face : de plus en plus espacés
    const changes = []; for (let t = 0, k = 0; t < .7; k++) { changes.push(t); t += .05 + k * k * .006; } changes.push(.78);
    animate(dur, t => {
      const e = easeOut(t);
      dies.forEach((o, i) => {
        if (o.face < changes.length && t >= changes[o.face]) { o.face++; if (i < 2) { if (o.face === changes.length) { if (i === 0) SFX.diceLand(); else setTimeout(() => SFX.diceTick(), 45); } else SFX.diceTick(); } const v = o.face === changes.length ? o.d.v : rnd(); const ng = drawDie(0, 0, v, o.d.p, false, 0, gDice); gDice.replaceChild(ng, o.g); o.g = ng; }
        const x = o.startX + (o.d.cx - o.startX) * e, y = o.startY + (o.d.cy - o.startY) * e;
        const bounce = t > .78 ? Math.sin((t - .78) / .22 * Math.PI) * 4 : 0;
        const rot = o.spin * (1 - e) + o.tilt * e;
        const sc = 1 + .22 * Math.sin(Math.PI * Math.min(1, t * 1.15)) - bounce * .01;
        setDieTransform(o.g, x, y - bounce, rot, sc);
      });
    }, () => {
      dies.forEach((o, i) => { G.tilt[i] = o.tilt; const ng = drawDie(o.d.cx, o.d.cy, o.d.v, o.d.p, false, o.tilt, gDice); gDice.replaceChild(ng, o.g); });
      G.rolling = false; G.busy = false; done();
    });
  }

  /* ===== Interaction : toucher ou glisser ===== */
  function destinationsFor(src) {
    if (src == null || G.phase !== 'move' || !isHuman(G.player)) return [];
    const out = [], seen = new Set();
    for (const st of G.steps) {
      if (st.from !== src) continue;
      if (!seen.has(st.to)) { seen.add(st.to); out.push({ to: st.to, steps: [st] }); }
      if (G.required >= 2 && st.to !== OFF) {
        const s2 = applyStep(G.state, G.player, st); const rem = G.rem.slice(); rem.splice(rem.indexOf(st.die), 1);
        for (const st2 of allowedSteps(s2, G.player, rem, G.required - 1)) {
          if (st2.from === st.to && !seen.has(st2.to)) { seen.add(st2.to); out.push({ to: st2.to, steps: [st, st2], composite: true }); }
        }
      }
    }
    return out;
  }
  let press = null;
  svg.addEventListener('pointerdown', ev => {
    if (!G.busy && !G.rolling && (G.phase === 'opening' || (G.phase === 'roll' && isHuman(G.player)) || (G.phase === 'move' && isHuman(G.player) && G.required === 0) || G.phase === 'over')) { press = { id: ev.pointerId, boardTap: true, x: ev.clientX, y: ev.clientY }; return; }
    if (G.busy || G.phase !== 'move' || !isHuman(G.player)) return;
    const pt = toBoard(ev); const z = zoneAt(pt); if (pt == null) return;
    press = { id: ev.pointerId, zone: z, x: pt.x, y: pt.y, moved: false, ghost: null };
    const canDrag = z != null && z !== OFF && G.steps.some(st => st.from === z) && (z !== BAR || G.state.bar[kOf(G.player)] > 0);
    if (canDrag) { press.dragFrom = z; try { svg.setPointerCapture(ev.pointerId); } catch (e) { } }
    ev.preventDefault();
  });
  svg.addEventListener('pointermove', ev => {
    if (!press || ev.pointerId !== press.id || press.boardTap) return;
    const pt = toBoard(ev); if (!pt) return;
    if (!press.moved && Math.hypot(pt.x - press.x, pt.y - press.y) < 7) return;
    if (press.dragFrom == null) return;
    if (!press.moved) {
      press.moved = true; G.drag = { from: press.dragFrom }; G.selected = null; render(); SFX.lift();
      press.ghost = drawChecker(pt.x, pt.y, G.player, 1, gDrag); press.ghost.setAttribute('filter', 'url(#dragShadow)');
      press.hover = el('circle', { r: R + 6, fill: 'none', stroke: THEME.hiRing, 'stroke-width': 3, opacity: 0 }, gHi);
    }
    press.ghost.setAttribute('transform', `translate(${pt.x} ${pt.y - 14}) scale(1.1)`);
    const z = zoneAt(pt); const d = destinationsFor(press.dragFrom).find(x => x.to === z);
    if (d && d.to !== OFF) { const np = nextPos(d.to, G.player, G.state); press.hover.setAttribute('cx', np.x); press.hover.setAttribute('cy', np.y); press.hover.setAttribute('opacity', .95); }
    else press.hover.setAttribute('opacity', 0);
    (G.player === 1 ? trayHiW : trayHiB).setAttribute('stroke-width', d && d.to === OFF ? 6 : 3);
  });
  function endPress(ev, cancel) {
    if (!press || ev.pointerId !== press.id) return;
    const p = press; press = null;
    if (p.boardTap) { if (!cancel && Math.hypot(ev.clientX - p.x, ev.clientY - p.y) < 12) mainAction(); return; }
    try { svg.releasePointerCapture(ev.pointerId); } catch (e) { }
    if (!p.moved) { if (!cancel) onTap(p.zone); return; }
    const pt = toBoard(ev); const z = cancel ? null : zoneAt(pt);
    const d = destinationsFor(p.dragFrom).find(x => x.to === z);
    const cur = pt ? { x: pt.x, y: pt.y - 14 } : { x: p.x, y: p.y };
    if (d) {
      const target = nextPos(d.to, G.player, G.state);
      const hit = d.steps.some(s => s.hit), stacked = d.to !== OFF && G.state.pts[d.to] * G.player > 0;
      G.busy = true;
      settle(p.ghost, cur, target, () => { if (hit) SFX.hit(); else if (d.to === OFF) SFX.tray(); else SFX.place(stacked); G.busy = false; G.drag = null; playSteps(d.steps, false); }, d.to === OFF);
    } else {
      const back = topPos(p.dragFrom, G.player, G.state);
      G.busy = true;
      settle(p.ghost, cur, back, () => { SFX.place(true); G.busy = false; G.drag = null; render(); });
    }
  }
  svg.addEventListener('pointerup', ev => endPress(ev, false));
  svg.addEventListener('pointercancel', ev => endPress(ev, true));
  function onTap(where) {
    if (G.busy || G.phase !== 'move' || !isHuman(G.player)) return;
    if (G.selected != null) {
      const d = destinationsFor(G.selected).find(x => x.to === where);
      if (d) { playSteps(d.steps, true); return; }
      if (where === G.selected) { G.selected = null; render(); return; }
    }
    if (where != null && G.steps.some(st => st.from === where)) { G.selected = where; render(); return; }
    G.selected = null; render();
  }
  // joue une suite de coups ; animated = fait glisser le pion (toucher), sinon dépôt direct (glisser)
  function playSteps(steps, animated) {
    G.selected = null;
    let i = 0;
    const applyOne = st => {
      G.history.push({ state: G.state, rem: G.rem.slice(), required: G.required });
      G.state = applyStep(G.state, G.player, st);
      G.rem.splice(G.rem.indexOf(st.die), 1); G.required--; G.turnSteps.push(st);
    };
    const finish = () => {
      G.busy = false;
      if (winner(G.state)) { render(); return gameOver(); }
      G.steps = allowedSteps(G.state, G.player, G.rem, G.required);
      if (G.steps.length === 0) G.required = 0;
      if (G.state.bar[kOf(G.player)] > 0 && G.required > 0) G.selected = BAR;
      render(); snapshot();
    };
    if (!animated) { for (const st of steps) applyOne(st); return finish(); }
    const next = () => {
      if (i >= steps.length) return finish();
      const st = steps[i++];
      G.busy = true;
      slide(st, G.player, () => { applyOne(st); render(); next(); });
    };
    next();
  }
  function undo() {
    if (G.busy) return;
    const h = G.history.pop(); if (!h) return;
    G.turnSteps.pop();
    G.state = h.state; G.rem = h.rem; G.required = h.required; G.selected = null;
    G.steps = allowedSteps(G.state, G.player, G.rem, G.required);
    if (G.history.length === 0) { const t = startTurn(G.state, G.player, G.dice); G.steps = t.steps; }
    if (G.state.bar[kOf(G.player)] > 0) G.selected = BAR;
    render();
  }
  function beginTurnWithDice(dice) {
    G.dice = dice; G.history = []; G.selected = null; G.turnSteps = [];
    const t = startTurn(G.state, G.player, dice);
    G.rem = t.rem; G.required = t.required; G.steps = t.steps;
    if (G.required === 0) { G.phase = 'nomove'; render(); setTimeout(endTurn, 1600); return; }
    G.phase = 'move';
    if (isHuman(G.player)) { if (G.state.bar[kOf(G.player)] > 0) G.selected = BAR; render(); snapshot(); }
    else { render(); if (G.mode === 'ai') setTimeout(aiPlay, 450); }
  }
  function rollFor(p) {
    G.player = p; G.phase = 'roll'; G.rem = []; G.lastDicePlayer = p;
    const dice = [rnd(), rnd()]; G.dice = dice;
    if (G.mode === 'online' && isMe(p)) { const t = startTurn(G.state, p, dice); netWrite({ dice, rem: t.rem, required: t.required, phase: t.required ? 'move' : 'nomove', player: p, lastDicePlayer: p }, { type: 'roll', dice, player: p }); }
    const cx = diceX(p);
    const list = diceList(dice); const n = list.length, span = n === 4 ? 56 : 64;
    G.rolling = true; render();
    rollDice(list.map((v, i) => ({ cx: cx + (i - (n - 1) / 2) * span, cy: H / 2, v, p })), () => beginTurnWithDice(dice));
  }
  // lance les dés tout seul au début d'un tour (pour soi, ou pour l'ordinateur)
  function scheduleAutoRoll(ms) {
    const gen = G.gen, p = G.player, seq = G.online ? G.online.doc.seq : null;
    const tryRoll = n => {
      if (G.gen !== gen || G.player !== p || G.phase !== 'roll') return;
      if (G.online && G.online.doc.seq !== seq) return;
      if (G.mode === 'online' && !isMe(p)) return;
      if (G.busy || G.rolling) { if (n < 40) setTimeout(() => tryRoll(n + 1), 250); return; }
      rollFor(p);
    };
    setTimeout(() => tryRoll(0), ms);
  }
  function endTurn() {
    if (G.phase === 'over') return;
    if (G.mode === 'online' && isMe(G.player)) {
      const pass = G.phase === 'nomove';
      netWrite({ state: G.state, player: -G.player, phase: 'roll', dice: null, rem: [], required: 0 }, { type: pass ? 'pass' : 'turn', steps: G.turnSteps.slice(), dice: G.dice, player: G.player });
    }
    G.player = -G.player; G.phase = 'roll'; G.selected = null; G.history = []; G.turnSteps = []; render(); snapshot();
    if (G.mode !== 'online') scheduleAutoRoll(650);
  }
  function aiPlay() {
    G.busy = true; render();
    setTimeout(() => {
      const mv = chooseMove(G.state, G.player, G.dice, G.level);
      const steps = mv ? mv.steps : [];
      let i = 0;
      const next = () => {
        if (i >= steps.length) { G.busy = false; render(); if (winner(G.state)) return gameOver(); return setTimeout(endTurn, 650); }
        const st = steps[i++];
        slide(st, G.player, () => {
          G.state = applyStep(G.state, G.player, st); G.rem.splice(G.rem.indexOf(st.die), 1); render();
          if (winner(G.state)) { G.busy = false; return gameOver(); }
          setTimeout(next, 180);
        });
      };
      setTimeout(next, 300);
    }, 60);
  }
  // animation du lancer d'ouverture : les deux dés, le verdict, puis les dés rejoignent le côté du gagnant
  function animateOpening(w, b, done) {
    G.phase = 'opening-roll'; G.msg = 'On lance…'; G.hint = ''; G.dice = [w, b]; G.rolling = true; render();
    rollDice([{ cx: diceX(1), cy: H / 2, v: w, p: 1 }, { cx: diceX(-1), cy: H / 2, v: b, p: -1 }], () => {
      if (w === b) { G.msg = `Égalité ${w} à ${b}`; G.hint = 'On relance.'; renderUI(); setTimeout(() => done(true), 1200); return; }
      const p = w > b ? 1 : -1;
      G.msg = `${nameOf(p)} commence`; G.hint = `avec ${Math.max(w, b)} et ${Math.min(w, b)}`; renderUI();
      setTimeout(() => {
        G.lastDicePlayer = p;
        const cx = diceX(p);
        const from = [{ x: diceX(1), y: H / 2 }, { x: diceX(-1), y: H / 2 }];
        const to = ((p === 1) !== flip) ? [{ x: cx - 32, y: H / 2 }, { x: cx + 32, y: H / 2 }] : [{ x: cx + 32, y: H / 2 }, { x: cx - 32, y: H / 2 }];
        const gs = [...gDice.children];
        animate(420, t => { const e = easeInOut(t); gs.forEach((g, i) => { if (!g) return; const a = from[i], bb = to[i]; setDieTransform(g, a.x + (bb.x - a.x) * e, a.y + (bb.y - a.y) * e, G.tilt[i], 1); }); }, () => {
          G.tilt = p === 1 ? [G.tilt[0], G.tilt[1]] : [G.tilt[1], G.tilt[0]];
          done(false, p);
        });
      }, 1200);
    });
  }
  function openingRoll() {
    const w = rnd(), b = rnd();
    if (G.mode === 'online') {
      if (!G.online || G.online.color !== 1) return;
      const starter = w === b ? 0 : (w > b ? 1 : -1);
      if (starter) {
        const d = starter === 1 ? [w, b] : [b, w], t = startTurn(G.state, starter, d), ch = !!G.online.doc.reroll;
        netWrite({ player: starter, phase: ch ? 'choice' : (t.required ? 'move' : 'nomove'), dice: d, rem: ch ? [] : t.rem, required: ch ? 0 : t.required, lastDicePlayer: starter }, { type: 'opening', w, b });
      }
      else netWrite({}, { type: 'opening', w, b, tie: true });
      animateOpening(w, b, (tie) => { if (tie) { setTimeout(openingRoll, 300); return; } hardSync(G.online.doc); });
      return;
    }
    animateOpening(w, b, (tie, p) => { if (tie) { openingRoll(); return; } afterOpening(p, p === 1 ? [w, b] : [b, w]); });
  }
  function afterOpening(p, d) {
    G.player = p; G.lastDicePlayer = p;
    if (!RULE_REROLL) return beginTurnWithDice(d);
    G.dice = d; G.rem = []; G.phase = 'choice'; render(); snapshot();
    if (!isHuman(p)) {
      const gen = G.gen;
      setTimeout(() => { if (G.gen !== gen || G.phase !== 'choice') return; if (aiWantsReroll(d, p)) rollFor(p); else beginTurnWithDice(d); }, 1300);
    }
  }
  // l'ordinateur relance quand ses dés d'ouverture valent moins qu'un lancer moyen
  const OPEN_AVG = {};
  function aiWantsReroll(d, p) {
    const s = G.state;
    const best = dice => { let b = -Infinity; for (const t of genTurns(s, p, dice)) { const v = evaluate(t.state, p); if (v > b) b = v; } return b; };
    const key = p + ':' + (RULE5 ? 5 : 0);
    if (OPEN_AVG[key] == null) { let avg = 0; for (let a = 1; a <= 6; a++) for (let c = a; c <= 6; c++) avg += (a === c ? 1 : 2) / 36 * best([a, c]); OPEN_AVG[key] = avg; }
    const noise = G.level === 1 ? 8 : G.level === 2 ? 2 : 0;
    return best(d) + (Math.random() - .5) * 2 * noise < OPEN_AVG[key];
  }
  function keepOpening() {
    if (G.phase !== 'choice' || !isHuman(G.player) || G.busy || G.rolling) return;
    if (G.mode === 'online') { const t = startTurn(G.state, G.player, G.dice); netWrite({ phase: t.required ? 'move' : 'nomove', rem: t.rem, required: t.required }, { type: 'keep', player: G.player }); }
    beginTurnWithDice(G.dice);
  }
  function rerollOpening() {
    if (G.phase !== 'choice' || !isHuman(G.player) || G.busy || G.rolling) return;
    rollFor(G.player);
  }
  function newGame() {
    if (G.mode === 'online' && G.online) {
      $('endOv').hidden = true;
      netWrite({ state: initState(), player: 1, phase: 'opening', status: 'playing', dice: null, rem: [], required: 0, winner: 0, pts: 0 }, { type: 'new' });
      hardSync(G.online.doc); return;
    }
    if (G.mode === 'online') G.mode = 'ai';
    setMaxStack(RULE5 ? 5 : 0);
    G.state = initState(); G.player = 1; G.phase = 'opening'; G.dice = null; G.rem = []; G.required = 0; G.steps = []; G.selected = null; G.history = []; G.busy = false; G.drag = null; G.lift = null; G.turnSteps = [];
    const gen = ++G.gen;
    $('home').hidden = true; $('endOv').hidden = true; $('pauseOv').hidden = true;
    updateOrientation(); render(); snapshot();
    setTimeout(() => { if (G.gen === gen && G.phase === 'opening' && G.mode !== 'online' && !G.rolling) openingRoll(); }, 800);
  }
  function gameOver() {
    const w = winner(G.state); const pts = winPoints(G.state, w);
    G.phase = 'over'; G.busy = false;
    if (G.mode === 'online') {
      if (G.online && isMe(w) && G.online.doc.status !== 'over') {
        const sc = { w: G.online.doc.scores.w + (w === 1 ? pts : 0), b: G.online.doc.scores.b + (w === -1 ? pts : 0) };
        netWrite({ state: G.state, status: 'over', phase: 'over', winner: w, pts, scores: sc, dice: G.dice, rem: [], required: 0 }, { type: 'turn', steps: G.turnSteps.slice(), dice: G.dice, player: w, over: true });
        G.scores = sc;
      }
    } else { if (w === 1) G.scores.w += pts; else G.scores.b += pts; saveScores(); }
    const label = pts === 1 ? 'partie simple' : pts === 2 ? 'gammon' : 'backgammon';
    const personal = G.mode === 'ai' || G.mode === 'online';
    const youWin = G.mode === 'ai' ? w === 1 : isMe(w);
    $('endLead').textContent = personal ? (youWin ? 'Victoire' : 'Défaite') : 'Partie terminée';
    $('endTitle').textContent = personal ? (youWin ? 'Bien joué' : `${nameOf(w)} l\'emporte`) : `${nameOf(w)} gagne`;
    $('endPts').textContent = `${pts} point${pts > 1 ? 's' : ''} · ${label}`;
    $('tW').textContent = G.scores.w; $('tB').textContent = G.scores.b;
    render(); setTimeout(() => { $('endOv').hidden = false; }, 900); snapshot();
  }

  /* ===== Jeu en ligne : la partie vit dans un document partagé, chaque joueur écrit ses propres coups ===== */
  const NET = { db: null, user: null, room: null, relay: null, kind: null, myId: null, inited: false };
  /* Version publique (hors de Claude) : la partie transite par plusieurs serveurs de relais MQTT gratuits à la fois.
     Il suffit qu'un seul fonctionne pour les deux joueurs ; les doublons sont écartés grâce au numéro de version. */
  const IN_CLAUDE = !!(window.claude && window.claude.use);
  const PUBLIC_URL = 'https://lebackgammondepapa.github.io/';
  const RELAY_BROKERS = window.NACRE_BROKERS || ['wss://broker.emqx.io:8084/mqtt', 'wss://broker.hivemq.com:8884/mqtt', 'wss://mqtt.eclipseprojects.io:443/mqtt', 'wss://test.mosquitto.org:8081'];
  const RELAY_NS = 'nacre-bg-7k2q/v1/';
  const evOf = d => (d && d.event) || {};
  function docCmp(a, b) {
    if (!a && !b) return 0; if (!a) return -1; if (!b) return 1;
    if ((a.seq || 0) !== (b.seq || 0)) return (a.seq || 0) - (b.seq || 0);
    const ea = evOf(a), eb = evOf(b);
    if ((ea.at || 0) !== (eb.at || 0)) return (ea.at || 0) - (eb.at || 0);
    const ba = String(ea.by || ''), bb = String(eb.by || '');
    return ba < bb ? -1 : ba > bb ? 1 : 0;
  }
  function makeRelay() {
    const M = window.mqtt; if (!M || !M.connect) return null;
    const conns = [], topics = new Map(), status = new Set();
    let pres = null;
    const parse = p => { try { const s = typeof p === 'string' ? p : p.toString(); return s ? JSON.parse(s) : null; } catch (e) { return undefined; } };
    const snapOf = d => ({ exists: !!d, data: () => d ? JSON.parse(JSON.stringify(d)) : undefined });
    function entry(topic) { let e = topics.get(topic); if (!e) { e = { topic, latest: null, mine: false, active: false, listeners: new Set(), seen: new Map(), answered: new Set() }; topics.set(topic, e); } return e; }
    function notifyStatus() { status.forEach(fn => { try { fn(); } catch (e) { } }); }
    function pub(conn, topic, d) { try { conn.client.publish(topic, d ? JSON.stringify(d) : '', { qos: 1, retain: true }); } catch (e) { } }
    function subscribeOn(conn, e) {
      try {
        conn.client.subscribe(e.topic, { qos: 1 }, err => {
          if (err) return;
          setTimeout(() => {
            e.answered.add(conn.url);
            // ce serveur n'a rien ou une version plus ancienne : on lui renvoie la nôtre
            if (e.mine && e.latest && conn.ok && docCmp(e.latest, e.seen.get(conn.url)) > 0) pub(conn, e.topic, e.latest);
          }, 1200);
        });
      } catch (err) { }
    }
    function onMessage(conn, topic, payload) {
      if (pres && topic === pres.topic) { pres.onPing(parse(payload)); return; }
      const e = topics.get(topic); if (!e) return;
      const d = parse(payload); if (d === undefined) return;
      e.answered.add(conn.url);
      if (!d) { e.seen.delete(conn.url); return; }
      if (docCmp(d, e.seen.get(conn.url)) > 0) e.seen.set(conn.url, d);
      const c = docCmp(d, e.latest);
      if (c > 0) { e.latest = d; const s = snapOf(d); e.listeners.forEach(fn => { try { fn(s); } catch (err) { } }); }
      else if (c < 0 && e.mine && conn.ok) pub(conn, topic, e.latest);
    }
    RELAY_BROKERS.forEach(url => {
      const conn = { url, client: null, ok: false }; conns.push(conn);
      try { conn.client = M.connect(url, Object.assign({ clientId: 'nacre_' + Math.random().toString(36).slice(2, 12), keepalive: 25, reconnectPeriod: 3000, connectTimeout: 9000, clean: true, resubscribe: false, protocolVersion: 4 }, window.NACRE_MQTT_OPTS || {})); }
      catch (err) { return; }
      conn.client.on('connect', () => {
        conn.ok = true; notifyStatus();
        topics.forEach(e => { if (e.active) subscribeOn(conn, e); });
        if (pres) { try { conn.client.subscribe(pres.topic, { qos: 0 }); } catch (err) { } }
      });
      conn.client.on('close', () => { if (conn.ok) { conn.ok = false; notifyStatus(); } });
      conn.client.on('error', () => { });
      conn.client.on('message', (topic, payload) => onMessage(conn, topic, payload));
    });
    function activate(topic) { const e = entry(topic); if (!e.active) { e.active = true; conns.forEach(c => { if (c.ok) subscribeOn(c, e); }); } return e; }
    const anyOk = () => conns.some(c => c.ok);
    const api = {
      connected: anyOk,
      onStatus(fn) { status.add(fn); return () => status.delete(fn); },
      doc(path) {
        const topic = RELAY_NS + path;
        return {
          get() {
            const e = activate(topic);
            return new Promise((resolve, reject) => {
              const t0 = Date.now();
              const tick = () => {
                const ok = conns.filter(c => c.ok), el = Date.now() - t0;
                const all = ok.length > 0 && ok.every(c => e.answered.has(c.url));
                if (e.latest && (all || el > 1500)) return resolve(snapOf(e.latest));
                if (!e.latest && all && el > 300) return resolve(snapOf(null));
                if (el > 10000) return ok.length ? resolve(snapOf(e.latest)) : reject({ code: 'unavailable' });
                setTimeout(tick, 120);
              };
              tick();
            });
          },
          set(d) {
            const e = activate(topic);
            e.latest = JSON.parse(JSON.stringify(d)); e.mine = true;
            conns.forEach(c => { if (c.ok) pub(c, topic, e.latest); });
            return Promise.resolve(); // un serveur momentanément injoignable la recevra à sa reconnexion
          },
          delete() { const e = activate(topic); e.latest = null; e.mine = false; conns.forEach(c => { if (c.ok) pub(c, topic, null); }); return Promise.resolve(); },
          acquire() { return Promise.resolve({ acquired: true }); },
          onSnapshot(next) { const e = activate(topic); e.listeners.add(next); if (e.latest) { const s = snapOf(e.latest); setTimeout(() => { if (e.listeners.has(next)) next(s); }, 0); } return () => { e.listeners.delete(next); }; }
        };
      },
      // présence : chaque joueur envoie un petit signal toutes les 8 s sur un canal propre à la partie
      presence(code, color, onChange) {
        api.stopPresence();
        const topic = RELAY_NS + 'ping/' + code;
        let last = 0, online = null, lastSent = 0;
        const send = () => { lastSent = Date.now(); conns.forEach(c => { if (c.ok) { try { c.client.publish(topic, JSON.stringify({ c: color, t: lastSent }), { qos: 0, retain: false }); } catch (e) { } } }); };
        const check = () => { const on = Date.now() - last < 22000; if (on !== online) { online = on; onChange(on); } };
        pres = { topic, timers: [], onPing: m => { if (!m || m.c === color) return; const first = Date.now() - last > 22000; last = Date.now(); check(); if (first && Date.now() - lastSent > 1500) send(); } };
        conns.forEach(c => { if (c.ok) { try { c.client.subscribe(topic, { qos: 0 }); } catch (e) { } } });
        send(); pres.timers.push(setInterval(send, 8000), setInterval(check, 4000));
      },
      stopPresence() { if (!pres) return; pres.timers.forEach(clearInterval); const t = pres.topic; pres = null; conns.forEach(c => { if (c.ok) { try { c.client.unsubscribe(t); } catch (e) { } } }); }
    };
    return api;
  }
  function saveDocLocal(d) { try { if (d && d.code) localStorage.setItem('nacre.doc.' + d.code, JSON.stringify(d)); } catch (e) { } }
  function loadDocLocal(code) { try { return JSON.parse(localStorage.getItem('nacre.doc.' + code) || 'null'); } catch (e) { return null; } }
  function myName() { const i = $('onlineName'); return i ? (i.value || '').trim().slice(0, 20) : ''; }
  function syncNames(d) { const on = G.online; if (!on || !d) return; const dn = d.names || {}; if (dn['1']) on.names[1] = dn['1']; if (dn['-1']) on.names[-1] = dn['-1']; }
  const CODE_ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const genCode = () => { let c = ''; for (let i = 0; i < 4; i++) c += CODE_ALPHA[Math.floor(Math.random() * CODE_ALPHA.length)]; return c; };
  function localId() { try { let v = localStorage.getItem('nacre.id'); if (!v) { v = 'anon-' + Math.random().toString(36).slice(2, 10); localStorage.setItem('nacre.id', v); } return v; } catch (e) { return 'anon-' + Math.random().toString(36).slice(2, 10); } }
  async function netInit() {
    if (NET.inited) return NET;
    NET.inited = true;
    if (!IN_CLAUDE) {
      NET.kind = 'relay'; NET.relay = makeRelay(); NET.db = NET.relay; NET.myId = localId();
      if (NET.relay) NET.relay.onStatus(() => { if (G.mode === 'online') renderUI(); });
      return NET;
    }
    NET.kind = 'claude';
    const use = async n => { try { return window.claude && window.claude.use ? await window.claude.use(n) : null; } catch (e) { return null; } };
    NET.db = await use('db');
    NET.user = await use('user');
    try { NET.myId = NET.user ? await NET.user.id() : null; } catch (e) { NET.myId = null; }
    if (!NET.myId) NET.myId = localId();
    NET.room = await use('room');
    return NET;
  }
  function saveOnline(v) { try { if (v) localStorage.setItem('nacre.online', JSON.stringify(v)); else localStorage.removeItem('nacre.online'); } catch (e) { } }
  function loadOnline() { try { return JSON.parse(localStorage.getItem('nacre.online') || 'null'); } catch (e) { return null; } }
  async function checkOnlineAccess() {
    await netInit();
    if (G.mode !== 'online') return;
    if (!NET.db) { onlineMsg(NET.kind === 'relay' ? 'Le jeu en ligne n\'a pas pu démarrer sur cet appareil.' : 'Connectez-vous à votre compte Claude pour jouer en ligne.', true); return; }
    if (NET.kind === 'relay') return;
    let can = null; try { can = NET.user && NET.user.can ? await NET.user.can('data.write') : null; } catch (e) { }
    if (can === false && G.mode === 'online') onlineMsg(describeNetError({ code: 'invalid_argument' }), true);
  }
  function refreshHome() {
    $('levelBox').hidden = G.mode !== 'ai';
    $('onlineBox').hidden = G.mode !== 'online';
    $('startBtn').parentElement.hidden = G.mode === 'online';
    const last = loadOnline();
    $('resumeBtn2').hidden = !(G.mode === 'online' && last && last.code);
    if (last && last.code) $('resumeBtn2').textContent = `Reprendre la partie ${last.code}`;
    $('onlineMsg').textContent = '';
    const rules = $('onlineRules');
    if (rules) {
      if (!IN_CLAUDE) rules.textContent = 'Créez la partie, puis envoyez le lien de cette page et le code à votre ami : il n\'a besoin d\'aucun compte. Le créateur joue les pions clairs.';
      else if (PUBLIC_URL) { rules.textContent = 'Pour jouer avec un ami qui n\'a que le lien, utilisez la version publique du jeu : '; const a = document.createElement('a'); a.href = PUBLIC_URL; a.target = '_blank'; a.rel = 'noopener'; a.textContent = PUBLIC_URL.replace(/^https?:\/\//, ''); rules.appendChild(a); }
    }
    if (G.mode === 'online') checkOnlineAccess();
  }
  function onlineMsg(t, isErr) { const m = $('onlineMsg'); m.textContent = t; m.classList.toggle('err', !!isErr); }
  function describeNetError(e) {
    const code = e && e.code;
    if (code === 'invalid_argument') return 'Ce compte peut voir la page mais pas jouer en ligne. Le créateur doit couper le lien public dans le menu Partager et inviter ce compte par e-mail en tant qu\'Éditeur, puis la page doit être rouverte.';
    if (code === 'not_granted' || code === 'capability_disabled') return 'Le jeu en ligne n\'est pas disponible dans cette fenêtre.';
    if (code === 'quota_exceeded') return 'La base de parties est pleine. Supprimez d\'anciennes parties.';
    if (code === 'unavailable' && NET.kind === 'relay') return 'Impossible de joindre les serveurs de jeu. Vérifiez votre connexion internet, puis réessayez.';
    return (e && e.message) ? e.message : 'Connexion impossible.';
  }
  function newDoc(code) {
    return { v: 1, code, seq: 1, status: 'waiting', host: NET.myId, guest: null, createdAt: Date.now(), state: initState(), player: 1, phase: 'opening', dice: null, rem: [], required: 0, lastDicePlayer: 1, scores: { w: 0, b: 0 }, winner: 0, pts: 0, max5: RULE5, reroll: RULE_REROLL, names: { '1': myName() }, event: { type: 'create', by: NET.myId, at: Date.now() } };
  }
  async function onlineCreate() {
    onlineMsg('Création de la partie…');
    await netInit();
    if (!NET.db) { onlineMsg(NET.kind === 'relay' ? 'Le jeu en ligne n\'a pas pu démarrer sur cet appareil.' : 'Le jeu en ligne demande d\'être connecté à Claude dans cette page.', true); return; }
    try {
      let code, ref, snap;
      for (let i = 0; i < 5; i++) { code = genCode(); ref = NET.db.doc('games/' + code); snap = await ref.get(); if (!snap.exists) break; }
      const doc = newDoc(code);
      await ref.set(doc);
      enterOnline(code, 1, doc, ref);
    } catch (e) { onlineMsg(describeNetError(e), true); }
  }
  async function onlineJoin(codeIn, silent) {
    const code = String(codeIn || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
    if (code.length < 4) { onlineMsg('Entrez le code à 4 lettres.', true); return; }
    onlineMsg('Connexion à la partie ' + code + '…');
    await netInit();
    if (!NET.db) { onlineMsg('Le jeu en ligne demande d\'être connecté à Claude dans cette page.', true); if (silent) { $('home').hidden = false; G.mode = 'online'; refreshHome(); onlineMsg('Impossible de reprendre la partie ' + code + ' ici.', true); } return; }
    try {
      const ref = NET.db.doc('games/' + code);
      const snap = await ref.get();
      let d = snap.exists ? snap.data() : null;
      // version publique : si le serveur a perdu la partie ou en a une version plus ancienne, on republie notre copie locale
      const loc = NET.kind === 'relay' ? loadDocLocal(code) : null;
      if (loc && (loc.host === NET.myId || loc.guest === NET.myId) && docCmp(loc, d) > 0) { await ref.set(loc); d = loc; }
      if (!d) { onlineMsg(`Aucune partie avec le code ${code}.`, true); if (silent) { saveOnline(null); $('home').hidden = false; G.mode = 'online'; refreshHome(); } return; }
      if (d.host === NET.myId) return enterOnline(code, 1, d, ref);
      if (d.guest === NET.myId) return enterOnline(code, -1, d, ref);
      if (d.guest) { onlineMsg('Cette partie a déjà deux joueurs.', true); return; }
      const lease = await ref.acquire({ holder: NET.myId, ttlMs: 5000 });
      if (!lease.acquired) { onlineMsg('Quelqu\'un rejoint cette partie en ce moment, réessayez.', true); return; }
      const d2 = (await ref.get()).data() || d;
      if (d2.guest && d2.guest !== NET.myId) { onlineMsg('Cette partie a déjà deux joueurs.', true); return; }
      const nd = Object.assign({}, d2, { guest: NET.myId, names: Object.assign({}, d2.names || {}, { '-1': myName() }), status: 'playing', seq: (d2.seq || 1) + 1, event: { type: 'join', by: NET.myId, at: Date.now() } });
      await ref.set(nd);
      enterOnline(code, -1, nd, ref);
    } catch (e) { onlineMsg(describeNetError(e), true); }
  }
  function enterOnline(code, color, doc, ref) {
    leaveOnline();
    G.mode = 'online';
    G.online = { code, color, ref, doc, appliedDoc: doc, queue: [], pumping: false, names: {}, oppOnline: null, unsub: null, roomRef: null, unsubPeers: null, openingTimer: null };
    flip = color === -1; buildStatic();
    saveOnline({ code, color });
    $('home').hidden = true; $('endOv').hidden = true; $('pauseOv').hidden = true;
    $('lobbyCode').textContent = code;
    updateOrientation();
    hardSync(doc);
    resolveNames();
    G.online.unsub = ref.onSnapshot(snap => onNetSnap(snap), e => { if (G.online) { onlineMsg(describeNetError(e), true); } });
    if (NET.kind === 'relay' && NET.relay) {
      const on0 = G.online;
      NET.relay.presence(code, color, online => { if (G.online !== on0) return; on0.oppOnline = online; renderUI(); });
    }
    if (NET.room && NET.room.join) {
      try {
        const on0 = G.online;
        Promise.resolve(NET.room.join('g-' + code)).then(r => {
          if (!r || G.online !== on0) { try { r && r.leave && r.leave(); } catch (e) { } return; }
          on0.roomRef = r;
          r.presence({ c: color }).catch(() => { });
          on0.unsubPeers = r.onPeers(ch => { if (G.online !== on0) return; const other = ch.peers.some(pe => !pe.isMe); const was = on0.oppOnline; on0.oppOnline = other; if (was !== other) renderUI(); }, () => { });
        }).catch(() => { });
      } catch (e) { }
    }
  }
  function leaveOnline() {
    const on = G.online; if (!on) return;
    try { on.unsub && on.unsub(); } catch (e) { }
    try { on.unsubPeers && on.unsubPeers(); } catch (e) { }
    try { on.roomRef && on.roomRef.leave && on.roomRef.leave(); } catch (e) { }
    try { NET.relay && NET.relay.stopPresence(); } catch (e) { }
    if (on.openingTimer) clearTimeout(on.openingTimer);
    G.online = null; G.mode = 'ai'; flip = false; buildStatic(); G.scores = loadScores();
    $('lobbyOv').hidden = true;
  }
  async function resolveNames() {
    const on = G.online; if (!on) return;
    syncNames(on.doc); renderUI();
    if (!NET.user || !NET.user.profiles) return;
    const ids = [on.doc.host, on.doc.guest].filter(Boolean);
    try {
      const ps = await NET.user.profiles(ids);
      if (!G.online || G.online !== on) return;
      const nm = id => (id && ps[id] && ps[id].name) ? ps[id].name : '';
      if (!on.names[1]) on.names[1] = nm(on.doc.host) || '';
      if (!on.names[-1]) on.names[-1] = nm(on.doc.guest) || '';
      renderUI();
    } catch (e) { }
  }
  function onNetSnap(snap) {
    const on = G.online; if (!on) return;
    if (!snap.exists) { onlineMsg('La partie a été supprimée.', true); toMenu(); return; }
    const d = snap.data(); if (!d || docCmp(d, on.appliedDoc) <= 0) return;
    on.queue.push(d); pump();
  }
  async function pump() {
    const on = G.online; if (!on || on.pumping) return;
    on.pumping = true;
    try {
      while (G.online === on && on.queue.length) {
        const d = on.queue.shift(); if (docCmp(d, on.appliedDoc) <= 0) continue;
        await handleNet(d);
      }
    } finally { on.pumping = false; }
  }
  const wait = ms => new Promise(r => setTimeout(r, ms));
  async function handleNet(d) {
    const on = G.online; if (!on) return;
    const ev = d.event || {}; const mine = ev.by === NET.myId;
    const sequential = d.seq === (on.appliedDoc ? on.appliedDoc.seq : 0) + 1;
    on.appliedDoc = d; on.doc = d;
    if (d.guest && !on.names[-1]) resolveNames();
    if (!sequential || mine || G.busy || G.rolling) { hardSync(d); return; }
    switch (ev.type) {
      case 'opening': {
        await new Promise(res => animateOpening(ev.w, ev.b, () => res()));
        if (G.online !== on) return;
        hardSync(d); break;
      }
      case 'roll': {
        const p = ev.player; G.player = p; G.phase = 'roll'; G.rem = []; G.lastDicePlayer = p; G.dice = ev.dice; G.rolling = true; render();
        const cx = diceX(p);
        const list = diceList(ev.dice); const n = list.length, span = n === 4 ? 56 : 64;
        await new Promise(res => rollDice(list.map((v, i) => ({ cx: cx + (i - (n - 1) / 2) * span, cy: H / 2, v, p })), res));
        if (G.online !== on) return;
        hardSync(d); break;
      }
      case 'turn': {
        const p = ev.player; const steps = ev.steps || [];
        let ok = p === G.player && G.phase === 'move';
        for (const st of steps) {
          if (!ok) break;
          if (st.from === BAR ? G.state.bar[kOf(p)] <= 0 : G.state.pts[st.from] * p <= 0) { ok = false; break; }
          G.busy = true;
          await new Promise(res => slide(st, p, res));
          if (G.online !== on) return;
          G.state = applyStep(G.state, p, st); const j = G.rem.indexOf(st.die); if (j >= 0) G.rem.splice(j, 1); render();
          await wait(160);
        }
        G.busy = false;
        hardSync(d); break;
      }
      case 'pass': {
        G.phase = 'nomove'; render(); await wait(1200); if (G.online !== on) return;
        hardSync(d); break;
      }
      default: hardSync(d);
    }
  }
  function hardSync(d) {
    const on = G.online; if (!on) return;
    saveDocLocal(d); syncNames(d);
    setMaxStack(d.max5 ? 5 : 0);
    G.state = cloneState(d.state); G.player = d.player; G.dice = d.dice; G.rem = (d.rem || []).slice(); G.required = d.required || 0; G.lastDicePlayer = d.lastDicePlayer || 1;
    G.history = []; G.turnSteps = []; G.selected = null; G.busy = false; G.rolling = false; G.drag = null; G.lift = null; G.steps = [];
    G.scores = d.scores || { w: 0, b: 0 };
    G.phase = d.status === 'waiting' ? 'waiting' : d.phase;
    $('lobbyOv').hidden = G.phase !== 'waiting';
    if (G.phase === 'move' && isMe(G.player)) {
      G.steps = allowedSteps(G.state, G.player, G.rem, G.required);
      if (G.steps.length === 0) G.required = 0;
      if (G.required === 0 && d.rem && d.rem.length === diceList(d.dice || [1, 2]).length && G.steps.length === 0) { /* rien à jouer : on passe */ }
      if (G.state.bar[kOf(G.player)] > 0 && G.required > 0) G.selected = BAR;
    }
    if (G.phase === 'nomove' && isMe(G.player)) setTimeout(() => { if (G.online === on && G.phase === 'nomove') endTurn(); }, 1600);
    if (G.phase === 'roll' && isMe(G.player)) scheduleAutoRoll(700);
    if (G.phase === 'opening' && d.status === 'playing' && on.color === 1) {
      if (on.openingTimer) clearTimeout(on.openingTimer);
      on.openingTimer = setTimeout(() => { on.openingTimer = null; if (G.online === on && on.doc.phase === 'opening' && on.doc.status === 'playing' && !G.busy && !G.rolling) openingRoll(); }, 900);
    }
    if (G.phase === 'over') {
      const w = d.winner, pts = d.pts;
      const label = pts === 1 ? 'partie simple' : pts === 2 ? 'gammon' : 'backgammon';
      const youWin = isMe(w);
      $('endLead').textContent = youWin ? 'Victoire' : 'Défaite';
      $('endTitle').textContent = youWin ? 'Bien joué' : `${nameOf(w)} l'emporte`;
      $('endPts').textContent = `${pts} point${pts > 1 ? 's' : ''} · ${label}`;
      $('tW').textContent = G.scores.w; $('tB').textContent = G.scores.b;
      setTimeout(() => { if (G.online === on && G.phase === 'over') $('endOv').hidden = false; }, 600);
    } else $('endOv').hidden = true;
    render(); snapshot();
  }
  async function netWrite(patch, event) {
    const on = G.online; if (!on) return;
    const d = Object.assign({}, on.doc, patch, { seq: (on.doc.seq || 0) + 1, event: Object.assign({ by: NET.myId, at: Date.now() }, event) });
    on.doc = d; on.appliedDoc = d; saveDocLocal(d);
    try { await on.ref.set(d); }
    catch (e) {
      if (G.online !== on) return;
      onlineMsg(describeNetError(e), true); $('pauseOv').hidden = false; $('pauseMsg').textContent = 'Le coup n\'a pas pu être envoyé. ' + describeNetError(e);
      try { const s = await on.ref.get(); if (s.exists && G.online === on) { on.appliedDoc = null; await handleNet(s.data()); } } catch (e2) { }
    }
  }
  async function cancelLobby() {
    const on = G.online; if (!on) return;
    try { if (on.doc.status === 'waiting' && on.color === 1) await on.ref.delete(); } catch (e) { }
    saveOnline(null); toMenu();
  }
  $('createBtn').addEventListener('click', onlineCreate);
  $('joinBtn').addEventListener('click', () => onlineJoin($('joinCode').value));
  $('joinCode').addEventListener('keydown', e => { if (e.key === 'Enter') onlineJoin($('joinCode').value); });
  $('joinCode').addEventListener('input', () => { const v = $('joinCode').value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4); if (v !== $('joinCode').value) $('joinCode').value = v; });
  $('resumeBtn2').addEventListener('click', () => { const last = loadOnline(); if (last && last.code) onlineJoin(last.code); });
  { const ni = $('onlineName'); try { ni.value = localStorage.getItem('nacre.name') || ''; } catch (e) { }
    ni.addEventListener('input', () => { try { localStorage.setItem('nacre.name', myName()); } catch (e) { } }); }
  $('lobbyCancel').addEventListener('click', cancelLobby);
  function inviteText(code) { const url = location.href.split('#')[0]; return `Viens jouer au backgammon avec moi : ${url}#${code} (code ${code})`; }
  if (!IN_CLAUDE) $('copyCode').textContent = navigator.share ? 'Inviter' : 'Copier l\'invitation';
  $('copyCode').addEventListener('click', () => {
    const code = $('lobbyCode').textContent; const b = $('copyCode');
    const label = b.textContent;
    const t = IN_CLAUDE ? code : inviteText(code);
    if (!IN_CLAUDE && navigator.share) { navigator.share({ title: 'Backgammon', text: t }).catch(() => { }); return; }
    const ok = () => { b.textContent = 'Copié'; setTimeout(() => { b.textContent = label; }, 1500); };
    try { navigator.clipboard.writeText(t).then(ok, () => { const r = document.createRange(); r.selectNodeContents($('lobbyCode')); const s = window.getSelection(); s.removeAllRanges(); s.addRange(r); }); } catch (e) { }
  });

  /* ===== Boutons ===== */
  function mainAction() {
    if (G.busy || G.rolling) return;
    if (G.phase === 'opening') { if (G.mode === 'online') return; return openingRoll(); }
    if (G.phase === 'choice' && isHuman(G.player)) return keepOpening();
    if (G.phase === 'roll' && isHuman(G.player)) return rollFor(G.player);
    if (G.phase === 'move' && G.required === 0 && isHuman(G.player)) return endTurn();
    if (G.phase === 'over') return newGame();
  }
  $('mainBtn').addEventListener('click', mainAction);
  $('undoBtn').addEventListener('click', undo);
  $('rerollBtn').addEventListener('click', rerollOpening);
  $('menuBtn').addEventListener('click', () => { if (G.phase === 'idle' || G.phase === 'over') { $('home').hidden = false; return; } $('pauseOv').hidden = false; });
  $('resumeBtn').addEventListener('click', () => { $('pauseOv').hidden = true; });
  const toMenu = () => { G.gen++; $('pauseOv').hidden = true; $('endOv').hidden = true; $('lobbyOv').hidden = true; leaveOnline(); G.phase = 'idle'; G.state = initState(); G.dice = null; G.busy = false; G.drag = null; G.lift = null; render(); $('home').hidden = false; updateOrientation(); refreshHome(); };
  $('abandonBtn').addEventListener('click', toMenu);
  $('endAgain').addEventListener('click', newGame);
  $('endMenu').addEventListener('click', toMenu);
  document.querySelectorAll('.mode').forEach(b => b.addEventListener('click', () => { document.querySelectorAll('.mode').forEach(x => x.classList.remove('on')); b.classList.add('on'); G.mode = b.dataset.mode; refreshHome(); }));
  document.querySelectorAll('.level').forEach(b => b.addEventListener('click', () => { document.querySelectorAll('.level').forEach(x => x.classList.remove('on')); b.classList.add('on'); G.level = +b.dataset.level; }));
  $('startBtn').addEventListener('click', () => { if (G.mode === 'online') return; newGame(); });
  window.addEventListener('resize', updateOrientation);
  window.addEventListener('orientationchange', () => setTimeout(updateOrientation, 80));

  /* ===== Reprise à chaud ===== */
  function snapshot() { try { window.claude?.hot?.snapshot?.(() => ({ mode: G.mode, level: G.level, state: G.state, player: G.player, phase: G.phase, dice: G.dice, rem: G.rem, required: G.required, lastDicePlayer: G.lastDicePlayer, scores: G.scores, max5: RULE5, online: G.online ? { code: G.online.code } : null })); } catch (e) { } }
  function start(data) {
    updateOrientation(); refreshHome();
    const hashCode = !IN_CLAUDE && /^#[A-Za-z]{4}$/.test(location.hash) ? location.hash.slice(1).toUpperCase() : '';
    if (hashCode && !(data && data.online)) {
      const last = loadOnline();
      if (!(last && last.code === hashCode)) {
        G.mode = 'online'; document.querySelectorAll('.mode').forEach(x => x.classList.toggle('on', x.dataset.mode === 'online'));
        refreshHome(); $('joinCode').value = hashCode;
        onlineMsg(`Invitation reçue : partie ${hashCode}. Entrez votre prénom puis touchez Rejoindre.`);
        netInit();
      }
    }
    if (data && data.online && data.online.code) { G.state = initState(); render(); onlineJoin(data.online.code, true); return; }
    if (data && data.state && data.phase && data.phase !== 'idle' && data.mode !== 'online') {
      Object.assign(G, { mode: data.mode, level: data.level, state: data.state, player: data.player, dice: data.dice, rem: data.rem || [], required: data.required || 0, lastDicePlayer: data.lastDicePlayer || 1 });
      if (data.scores) G.scores = data.scores;
      setMaxStack(data.max5 == null ? (RULE5 ? 5 : 0) : (data.max5 ? 5 : 0));
      G.phase = ['move', 'over', 'opening', 'choice'].includes(data.phase) ? data.phase : 'roll';
      if (G.phase === 'move') { G.steps = allowedSteps(G.state, G.player, G.rem, G.required); if (!isHuman(G.player)) G.phase = 'roll'; }
      $('home').hidden = true; updateOrientation();
      render();
      if (G.phase === 'roll') scheduleAutoRoll(600);
      if (G.phase === 'opening') setTimeout(() => { if (G.phase === 'opening' && !G.rolling) openingRoll(); }, 800);
      if (G.phase === 'choice' && G.dice) afterOpening(G.player, G.dice);
    } else { G.state = initState(); render(); }
  }
  window.__nacre = { G, topPos, nextPos, beginTurnWithDice, afterOpening, NET, onlineCreate, onlineJoin };
  const boot = () => { window.claude?.hot?.ready ? window.claude.hot.ready(start) : start(window.claude?.hot?.data ?? {}); };
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(boot, boot); else boot();
  setTimeout(updateOrientation, 50);
  if (window.ResizeObserver) new ResizeObserver(() => updateOrientation()).observe($('app'));
})();
