/* Table Goblin token creator: the app. Everything is drawn on canvases in this page. The picture never leaves the device; only the
   settings (ring, backdrop, brush and lettering choices) are remembered in this browser (localStorage), never the picture, its masks or
   the lettering. Loaded after token-rings.js, token-textures.js, token-bgremove.js, token-objects.js and token-export.js. */
(function () {
  "use strict";
  var TG = window.TGTok, K = TG.rings, TX = TG.textures, BG = TG.bg, OB = TG.objects, EX = TG.exporter;
  var M = 1024, C = M / 2, MAX_SRC = 1200, UNDO_MAX = 30, STORE = "tg-token-v1";
  var TAU = K.TAU, LX = K.LX, LY = K.LY, mk = K.mk, cx2 = K.cx2, clamp01 = K.clamp01, hex = K.hex, toHex = K.toHex, mix = K.mix, rng = K.rng;
  var STYLES = K.STYLES, FAMS = K.FAMS, FAM_LABEL = K.FAM_LABEL, FAM_GAME = K.FAM_GAME, styleById = K.styleById, paintRing = K.paintRing;
  function $(id) { return document.getElementById(id); }
  function each(sel, f) { Array.prototype.forEach.call(document.querySelectorAll(sel), f); }

  // ---------- state ----------
  var S = {
    style: "Metal:Gold", fam: "Metal", game: "all", thick: 0.075, rsize: 1, ringColor: "#8a2b2b", tint: false, noRing: false, side: "", sideMark: false,
    shape: "circle", inner: 0.38, bevel: 0, ringGlow: 1, ringFlicker: "strong",
    fillType: "radial", fill1: "#6f93a6", fill2: "#1d2830", tex: "parchment", texScale: 1, texTint: 0, texVig: 0.4, texSeed: 1,
    popTop: false, popLine: 0.4, popShadow: true, dropShadow: false,
    tol: 28, contig: true, edgeSoft: 4, shrink: 0, clean: true, despill: true, smartTo: "cut",
    affects: "picture", brushSoft: 0.4, brushStrength: 1,
    font: "Cinzel", textWhere: "on", textSize: 0.62, textTrack: 0.06, textFill: "#f4e7c3", textStroke: "#1b1208", textStrokeW: 0.14, textUnderPop: false,
    animLen: 1.5
  };
  function loadSettings(obj) {
    Object.keys(S).forEach(function (k) { if (obj && typeof obj[k] === typeof S[k]) S[k] = obj[k]; });
    if (!styleById(S.style)) S.style = "Metal:Gold";
    if (["all", "fantasy", "scifi"].indexOf(S.game) < 0) S.game = "all";
    if (famsShown().indexOf(S.fam) < 0) S.fam = famsShown()[0];
    if (!K.shapeById(S.shape) || K.shapeById(S.shape).id !== S.shape) S.shape = "circle";
    if (["none", "solid", "linear", "radial", "texture"].indexOf(S.fillType) < 0) S.fillType = "radial";
    if (!TX.texById(S.tex)) S.tex = "parchment";
    if (["picture", "ring", "both"].indexOf(S.affects) < 0) S.affects = "picture";
    if (["on", "inside", "outside"].indexOf(S.textWhere) < 0) S.textWhere = "on";
    if ([1, 1.5, 2].indexOf(S.animLen) < 0) S.animLen = 1.5;
    if (S.side && !sideById(S.side)) S.side = "";
    S.font = OB.fontById(S.font).id;
    S.ringGlow = Math.max(0, Math.min(2, S.ringGlow));
    if (["off", "subtle", "strong"].indexOf(S.ringFlicker) < 0) S.ringFlicker = "strong";
    syncR();
  }
  // the ring drawing reads the loop length, Glow and Flicker from the shared ring settings
  function syncR() { K.R.loop = S.animLen; K.R.glow = S.ringGlow; K.R.flick = S.ringFlicker; }
  function persist() { try { localStorage.setItem(STORE, JSON.stringify(S)); } catch (e) { /* storage is optional */ } }
  // Side presets. Player, Enemy and Neutral are the bot's battle-map side colors; Ally is a bluish green that stays apart from red for
  // red-green color blindness. Each also has its own mark shape, so color is never the only signal.
  var SIDES = [
    { id: "player", label: "Player", color: "#3a7ae0", mark: "circle" },
    { id: "ally", label: "Ally", color: "#009e73", mark: "diamond" },
    { id: "enemy", label: "Enemy", color: "#c43e34", mark: "triangle" },
    { id: "neutral", label: "Neutral", color: "#80808a", mark: "square" }
  ];
  function sideById(id) { for (var i = 0; i < SIDES.length; i++) if (SIDES[i].id === id) return SIDES[i]; return null; }
  var GAMES = [["all", "All"], ["fantasy", "Fantasy"], ["scifi", "Sci-fi"]];
  function famsShown() { return FAMS.filter(function (f) { return S.game === "all" || FAM_GAME[f] === "both" || FAM_GAME[f] === S.game; }); }
  try { loadSettings(JSON.parse(localStorage.getItem(STORE) || "{}")); } catch (e) { loadSettings({}); }

  // Picture adjustments, locks, layer visibility and the token's lettering and objects belong to this token only: never stored in the
  // browser, cleared when a new picture loads, kept in a saved project file.
  var F = { bright: 0, contrast: 0, sat: 100, gray: false, sepia: false };
  var L = { ring: false, imgXform: false, imgIn: false, imgOut: false, backdrop: false, objects: false };
  var V = { objects: true, pop: true, ring: true, cover: true, backdrop: true };
  function freshContent() {
    return { top: "", bottom: "", badge: { text: "", shape: "circle", color: "#c43e34", clock: 4 }, mark: { kind: "", clock: 8 }, pip: { color: "", label: "", clock: 2 }, objs: [] };
  }
  var CT = freshContent(), sel = -1, splitLock = false;
  var src = null, srcData = null, fsrc = null, sw = 0, sh = 0, baseScale = 1, fileBase = "token", IM = null, model = null;
  var cut = null, cutG = null, hasCut = false, cover = null, coverG = null, hasCover = false, subj = null, subjG = null, rem = null, subjDirty = false;
  var pop = mk(M), popG = cx2(pop, true), popEff = mk(M), popEffG = cx2(popEff), hasPop = false;
  var ringMask = mk(M), ringMaskG = cx2(ringMask, true), hasRingMask = false, ringTmp = mk(M), ringTmpG = cx2(ringTmp);
  var master = mk(M), mg = cx2(master), tmp = mk(M), tg = cx2(tmp), tint = mk(M), tintG = cx2(tint), dropC = null, dropG = null;
  var strokes = [];   // Smart select strokes, in picture pixels: { kind: 1 keep | 2 remove, r, pts }
  // img: the picture's size and place on the token (exported). cam: the preview camera only (never exported); z is the view zoom,
  // (x, y) the token point at the middle of the view.
  var img = { x: 0, y: 0, zoom: 1, flip: false };
  var cam = { z: 1, x: C, y: C };
  var TOOL_MODE = { move: "move", pan: "move", wand: "cut", keep: "cut", rmv: "cut", erase: "cut", restore: "cut", paint: "backdrop", unpaint: "backdrop",
    pop: "pop", unpop: "pop", rerase: "ring", rrestore: "ring", select: "objects" };
  var lastTool = { move: "move", cut: "wand", backdrop: "paint", pop: "pop", ring: "rerase", objects: "select" };
  var tool = "move", undo = [], redo = [], draft = false, lineActive = 0, hover = null, gesture = null, pts = new Map();
  var picking = null, spaceDown = false, lastXform = 0, animT = 0, playing = false, busy = false;
  var pv = $("pv"), pg = cx2(pv), stage = $("stage"), insetCv = $("insetCv"), ig = cx2(insetCv);

  // ---------- geometry ----------
  function shp() { return K.shapeById(S.shape); }
  function halfR() { return C * S.rsize - 3; }
  function ringR1() { return halfR() * shp().fit; }
  function ringR0() { return S.noRing ? ringR1() : Math.max(ringR1() * 0.3, ringR1() - S.thick * M); }
  function geo(N) { var k = (N || M) / M; return { shape: shp(), cx: C * k, cy: (C + halfR() * shp().oy) * k }; }
  // The token's outline. Every clip and outline goes through here, for every shape. It adds a closed subpath (callers begin the path).
  function shapePath(g, r, cx, cy) {
    var G0 = geo(); cx = cx === undefined ? G0.cx : cx; cy = cy === undefined ? G0.cy : cy;
    K.shapeOutline(g, G0.shape, cx, cy, r);
  }
  var ringCache = { key: "", c: null }, ringFrames = { key: "", f: {} };
  function ringStyle() { return styleById(S.style); }
  function ringLayer(t) {
    if (S.noRing) return null;
    t = t || 0;
    syncR();
    var N = draft || playing ? 512 : M, k = N / M, key = [S.style, S.thick, S.rsize, S.ringColor, S.tint, S.shape, S.ringGlow, S.ringFlicker, S.animLen, N].join("|");
    function paint() { return paintRing(N, ringR0() * k, ringR1() * k, ringStyle(), hex(S.ringColor), S.tint, t, geo(N)); }
    if (t && ringStyle().anim) {   // frames of an animated ring, kept while the settings stay the same
      if (ringFrames.key !== key) ringFrames = { key: key, f: {} };
      var fk = t.toFixed(4);
      if (!ringFrames.f[fk]) ringFrames.f[fk] = paint();
      return ringFrames.f[fk];
    }
    if (ringCache.key !== key) { ringCache.c = paint(); ringCache.key = key; }
    return ringCache.c;
  }
  var innerCache = { key: "", c: null };
  // The inner shadow, from no shade half a ring band inside the inner edge to full shade at the edge, for any shape.
  function innerLayer(r0, band) {
    var key = [S.shape, r0, band, S.inner, S.rsize].join("|");
    if (innerCache.key === key) return innerCache.c;
    var c = innerCache.c || mk(M), g = cx2(c), id = g.createImageData(M, M), D = id.data, G0 = geo(), s0 = r0 - band * 0.5, w = band * 0.5 + 1, A = S.inner * 255;
    for (var y = 0; y < M; y++) for (var x = 0; x < M; x++) {
      var d = K.shapeRad(G0.shape, x + 0.5 - G0.cx, y + 0.5 - G0.cy);
      if (d <= s0) continue;
      D[(y * M + x) * 4 + 3] = A * clamp01((d - s0) / w);
    }
    g.putImageData(id, 0, 0); innerCache = { key: key, c: c };
    return c;
  }
  var texCache = { key: "", c: null };
  function texLayer() {
    var N = draft ? 512 : M, key = [S.tex, S.texScale, S.texTint, S.texVig, S.texSeed, S.fill1, N].join("|");
    if (texCache.key !== key) {
      texCache.c = TX.paintTexture(S.tex, N, { seed: S.texSeed, scale: S.texScale, tint: hex(S.fill1), tintAmt: S.texTint, vignette: S.texVig });
      texCache.key = key;
    }
    return texCache.c;
  }

  // ---------- picture ----------
  function scale() { return baseScale * img.zoom; }
  function place(g, c) {
    g.save(); g.translate(C + img.x, C + img.y); g.scale(scale() * (img.flip ? -1 : 1), scale()); g.drawImage(c, -sw / 2, -sh / 2); g.restore();
  }
  function toSrc(p) { return [(p[0] - C - img.x) / scale() * (img.flip ? -1 : 1) + sw / 2, (p[1] - C - img.y) / scale() + sh / 2]; }
  function tokenToSrcMatrix(g) { var fl = img.flip ? -1 : 1, s = scale(); g.setTransform(fl / s, 0, 0, 1 / s, (-C - img.x) * fl / s + sw / 2, (-C - img.y) / s + sh / 2); }
  function newMask(w, h, full) { var c = mk(w, h), g = cx2(c, true); if (full) { g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); } return c; }
  function setImage(im, name, keep) {
    var w = im.naturalWidth || im.width, h = im.naturalHeight || im.height;
    if (!w || !h) { $("fileErr").textContent = "That picture is empty."; return; }
    var k = keep ? 1 : Math.min(1, MAX_SRC / Math.max(w, h));
    sw = Math.max(1, Math.round(w * k)); sh = Math.max(1, Math.round(h * k));
    src = mk(sw, sh); var sg = cx2(src, true); sg.imageSmoothingQuality = "high"; sg.drawImage(im, 0, 0, sw, sh);
    srcData = sg.getImageData(0, 0, sw, sh); fsrc = src; IM = null; model = null;
    cut = newMask(sw, sh, true); cutG = cx2(cut, true); hasCut = false;
    cover = newMask(sw, sh, false); coverG = cx2(cover, true); hasCover = false;
    subj = mk(sw, sh); subjG = cx2(subj, true); rem = mk(sw, sh);
    popG.clearRect(0, 0, M, M); hasPop = false; ringMaskG.clearRect(0, 0, M, M); hasRingMask = false; strokes = [];
    baseScale = M * 0.86 / Math.min(sw, sh);
    img = { x: 0, y: 0, zoom: 1, flip: false }; syncSize();
    cam = { z: 1, x: C, y: C }; syncCam();
    F = { bright: 0, contrast: 0, sat: 100, gray: false, sepia: false }; syncFilters();
    L = { ring: false, imgXform: false, imgIn: false, imgOut: false, backdrop: false, objects: false }; syncLocks();
    V = { objects: true, pop: true, ring: true, cover: true, backdrop: true };
    CT = freshContent(); sel = -1; syncContent();
    undo = []; redo = []; syncUndo();
    fileBase = (name || "token").replace(/\.[a-z0-9]+$/i, "").replace(/\.tgtoken$/i, "").replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "token";
    $("fileErr").textContent = "";
    renderLayers();
    subjDirty = true; hint(); schedule();
  }
  function loadFile(f) {
    if (!f) return;
    if (/\.json$/i.test(f.name || "")) { openProject(f); return; }
    if (!/^image\//.test(f.type || "") && !/\.(png|jpe?g|webp|gif|bmp|avif)$/i.test(f.name || "")) { $("fileErr").textContent = "That isn't a picture file."; return; }
    var url = URL.createObjectURL(f), im = new Image();
    im.onload = function () { setImage(im, f.name); URL.revokeObjectURL(url); };
    im.onerror = function () { URL.revokeObjectURL(url); $("fileErr").textContent = "Couldn't read that picture. Try a PNG, JPEG, WebP or GIF."; };
    im.src = url;
  }
  function sample() {
    var c = mk(600), g = cx2(c);
    g.fillStyle = "#dfe7d6"; g.fillRect(0, 0, 600, 600);
    g.fillStyle = "#3d6b4f"; g.beginPath(); g.moveTo(170, 600); g.lineTo(215, 360); g.quadraticCurveTo(300, 320, 385, 360); g.lineTo(430, 600); g.closePath(); g.fill();
    g.fillStyle = "#c79a3b"; g.fillRect(200, 470, 200, 22);
    g.fillStyle = "#7fae4a"; g.beginPath(); g.ellipse(300, 285, 78, 86, 0, 0, TAU); g.fill();
    g.beginPath(); g.moveTo(225, 270); g.lineTo(140, 225); g.lineTo(230, 300); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(375, 270); g.lineTo(460, 225); g.lineTo(370, 300); g.closePath(); g.fill();
    g.fillStyle = "#fff6c8"; g.beginPath(); g.arc(270, 282, 13, 0, TAU); g.arc(330, 282, 13, 0, TAU); g.fill();
    g.fillStyle = "#1c1a14"; g.beginPath(); g.arc(272, 284, 6, 0, TAU); g.arc(328, 284, 6, 0, TAU); g.fill();
    g.strokeStyle = "#1c1a14"; g.lineWidth = 5; g.beginPath(); g.arc(300, 318, 26, 0.2, Math.PI - 0.2); g.stroke();
    g.fillStyle = "#5a2d82"; g.beginPath(); g.moveTo(205, 225); g.lineTo(395, 225); g.lineTo(300, 10); g.closePath(); g.fill();
    g.fillStyle = "#3f1f5c"; g.beginPath(); g.ellipse(300, 225, 120, 22, 0, 0, TAU); g.fill();
    g.fillStyle = "#f2d35c"; g.beginPath(); g.arc(300, 150, 12, 0, TAU); g.fill();
    g.strokeStyle = "#7b5530"; g.lineWidth = 14; g.lineCap = "round"; g.beginPath(); g.moveTo(470, 600); g.lineTo(505, 70); g.stroke();
    g.fillStyle = "#7fd8ff"; g.beginPath(); g.arc(506, 62, 26, 0, TAU); g.fill();
    var im = new Image(); im.onload = function () { setImage(im, "goblin-wizard"); }; im.src = c.toDataURL("image/png");
  }

  // ---------- picture adjustments ----------
  function filtersOn() { return F.bright !== 0 || F.contrast !== 0 || F.sat !== 100 || F.gray || F.sepia; }
  function applyFilters() {
    if (!src) return;
    subjDirty = true;
    if (!filtersOn()) { fsrc = src; return; }
    if (!fsrc || fsrc === src) fsrc = mk(sw, sh);
    var d = new ImageData(new Uint8ClampedArray(srcData.data), sw, sh), D = d.data, lut = new Uint8ClampedArray(256), i;
    var c = F.contrast * 2.55, cf = 259 * (c + 255) / (255 * (259 - c)), b = F.bright * 1.28, s = F.gray ? 0 : F.sat / 100;
    for (i = 0; i < 256; i++) lut[i] = cf * (i + b - 128) + 128;
    for (i = 0; i < D.length; i += 4) {
      var r = lut[D[i]], g = lut[D[i + 1]], bl = lut[D[i + 2]], l = r * 0.299 + g * 0.587 + bl * 0.114;
      r = l + (r - l) * s; g = l + (g - l) * s; bl = l + (bl - l) * s;
      if (F.sepia) { var r2 = r * 0.393 + g * 0.769 + bl * 0.189, g2 = r * 0.349 + g * 0.686 + bl * 0.168; bl = r * 0.272 + g * 0.534 + bl * 0.131; r = r2; g = g2; }
      D[i] = r; D[i + 1] = g; D[i + 2] = bl;
    }
    cx2(fsrc, true).putImageData(d, 0, 0);
  }
  function syncFilters() {
    $("fBright").value = F.bright; $("fBrightOut").textContent = String(F.bright);
    $("fContrast").value = F.contrast; $("fContrastOut").textContent = String(F.contrast);
    $("fSat").value = F.sat; $("fSatOut").textContent = F.sat + "%";
    $("fGray").checked = F.gray; $("fSepia").checked = F.sepia; $("fSat").disabled = F.gray;
  }

  // ---------- masks (alpha only) ----------
  function alphaOf(c) {
    var d = cx2(c, true).getImageData(0, 0, c.width, c.height).data, n = c.width * c.height, a = new Uint8Array(n);
    for (var i = 0; i < n; i++) a[i] = d[i * 4 + 3];
    return a;
  }
  function putAlpha(c, a) {
    var g = cx2(c, true), id = g.createImageData(c.width, c.height), D = id.data, n = c.width * c.height;
    for (var i = 0; i < n; i++) { var j = i * 4; D[j] = D[j + 1] = D[j + 2] = 255; D[j + 3] = a[i]; }
    g.putImageData(id, 0, 0);
  }
  function anyBelow(a, v) { for (var i = 0; i < a.length; i++) if (a[i] < v) return true; return false; }
  function anyAbove(a, v) { for (var i = 0; i < a.length; i++) if (a[i] > v) return true; return false; }

  // ---------- cut-out ----------
  function feather(a, w, h, passes) { for (var k = 0; k < passes; k++) a = blur(a, w, h); return a; }
  function rebuildSubject(fast) {
    if (!src) return;
    var base = fsrc || src, useCover = hasCover && V.cover;
    if (fast || (!hasCut && !useCover)) {
      subjG.globalCompositeOperation = "copy"; subjG.drawImage(base, 0, 0); subjG.globalCompositeOperation = "source-over";
      if (hasCut) { subjG.globalCompositeOperation = "destination-in"; subjG.drawImage(cut, 0, 0); }
      if (useCover) { subjG.globalCompositeOperation = "destination-out"; subjG.drawImage(cover, 0, 0); }
      subjG.globalCompositeOperation = "source-over";
    } else {
      var n = sw * sh, i, bd = cx2(base, true).getImageData(0, 0, sw, sh), a;
      if (hasCut) {
        var ca = alphaOf(cut), fa = new Float32Array(n);
        for (i = 0; i < n; i++) fa[i] = ca[i];
        if (S.shrink > 0) fa = erode(fa, sw, sh, S.shrink);
        var passes = S.edgeSoft >= 8 ? 2 : S.edgeSoft >= 2 ? 1 : 0;
        if (passes) fa = feather(fa, sw, sh, passes);
        a = new Uint8Array(n); for (i = 0; i < n; i++) a[i] = fa[i];
        if (S.despill) { var out = new Uint8ClampedArray(bd.data); BG.despill(bd.data, a, sw, sh, model ? model.rgb : [], out); bd = new ImageData(out, sw, sh); }
      } else { a = new Uint8Array(n); a.fill(255); }
      if (useCover) { var cv = alphaOf(cover); for (i = 0; i < n; i++) a[i] = a[i] * (255 - cv[i]) / 255; }
      var D = bd.data; for (i = 0; i < n; i++) D[i * 4 + 3] = D[i * 4 + 3] * a[i] / 255;
      subjG.putImageData(bd, 0, 0);
    }
    if (hasCut) {
      var rg = cx2(rem); rg.globalCompositeOperation = "copy"; rg.drawImage(base, 0, 0);
      rg.globalCompositeOperation = "destination-out"; rg.drawImage(cut, 0, 0); rg.globalCompositeOperation = "source-over";
    }
    subjDirty = false;
  }
  function erode(a, w, h, r) {
    var o = new Float32Array(a.length), x, y, k, m;
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) { m = 255; for (k = -r; k <= r; k++) { var xx = x + k; if (xx >= 0 && xx < w && a[y * w + xx] < m) m = a[y * w + xx]; } o[y * w + x] = m; }
    var o2 = new Float32Array(a.length);
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) { m = 255; for (k = -r; k <= r; k++) { var yy = y + k; if (yy >= 0 && yy < h && o[yy * w + x] < m) m = o[yy * w + x]; } o2[y * w + x] = m; }
    return o2;
  }
  function blur(a, w, h) {
    var o = new Float32Array(a.length), x, y, i;
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) { i = y * w + x; o[i] = (a[x > 0 ? i - 1 : i] + a[i] + a[x < w - 1 ? i + 1 : i]) / 3; }
    var o2 = new Float32Array(a.length);
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) { i = y * w + x; o2[i] = (o[y > 0 ? i - w : i] + o[i] + o[y < h - 1 ? i + w : i]) / 3; }
    return o2;
  }
  function analysis() {   // Lab, edge strength and lightness of the picture, worked out once per picture
    if (!IM) { var n = sw * sh, D = srcData.data, lab = BG.toLab(D, n); IM = { w: sw, h: sh, data: D, lab: lab, grad: BG.gradient(lab, sw, sh), lum: null }; }
    return IM;
  }
  function pictureLocked() { return L.imgIn && L.imgOut; }
  function lockedRegionPath(g) {   // the part of the picture its locks protect, in token units (call with the token-to-picture transform set)
    g.beginPath();
    if (L.imgIn) shapePath(g, ringR0());
    if (L.imgOut) { g.rect(-M * 8, -M * 8, M * 17, M * 17); shapePath(g, ringR0()); }
  }
  // Runs fn, which changes the cut mask, then puts back the cut in any locked region.
  function guardCut(fn) {
    if (!L.imgIn && !L.imgOut) return fn();
    var keep = mk(sw, sh); cx2(keep).drawImage(cut, 0, 0);
    var r = fn();
    cutG.save(); tokenToSrcMatrix(cutG); lockedRegionPath(cutG); cutG.clip(L.imgOut ? "evenodd" : "nonzero");
    cutG.setTransform(1, 0, 0, 1, 0, 0); cutG.globalCompositeOperation = "copy"; cutG.drawImage(keep, 0, 0); cutG.restore();
    return r;
  }
  function applyRemove(rm, clean, fillHoles) {   // cut = min(cut, 255 - rm), then the cleanup
    var a = alphaOf(cut), n = a.length, removed = 0;
    for (var i = 0; i < n; i++) { var v = 255 - rm[i]; if (v < a[i]) { if (a[i] > 127 && v <= 127) removed++; a[i] = v; } }
    if (clean && S.clean) { var mn = Math.max(24, Math.round(n * 0.0008)); BG.cleanup(a, sw, sh, mn, fillHoles ? mn : 0); }
    putAlpha(cut, a); hasCut = anyBelow(a, 255); subjDirty = true;
    return removed;
  }
  function keyOpts() { return { T: S.tol * 0.35, soft: S.edgeSoft * 1.2 + 0.01, contiguous: true }; }
  function autoBackground() {
    if (!src) { say("Choose a picture first."); return; }
    if (pictureLocked()) { say("The cut-out is locked. Unlock it in Layers and locks."); return; }
    pushUndo("cut");
    var im = analysis(), P = srcData.data, edge = [], x, y, j;
    // The backdrop is the color (or colors) covering most of the picture's edge. Seed only from edge pixels of those colors, so a
    // figure that runs off the bottom edge (a robe, a staff) is never taken as background.
    for (x = 0; x < sw; x++) { edge.push(x); if (sh > 1) edge.push((sh - 1) * sw + x); }
    for (y = 1; y < sh - 1; y++) { edge.push(y * sw); if (sw > 1) edge.push(y * sw + sw - 1); }
    var opaque = edge.filter(function (p) { return P[p * 4 + 3] >= 24; }), cl = BG.cluster(im.lab, P, opaque, Math.max(4, S.tol * 0.35));
    var big = cl.filter(function (c) { return c.n >= edge.length * 0.12; }), seeds = [];
    edge.forEach(function (p) { if (P[p * 4 + 3] < 24) seeds.push(p); });
    big.forEach(function (c) { c.members.forEach(function (p) { seeds.push(p); }); });
    model = { lab: big.map(function (c) { return c.lab; }), rgb: big.map(function (c) { return c.rgb; }) };
    var n = 0;
    if (seeds.length && model.lab.length) n = guardCut(function () { return applyRemove(BG.keyFlood(im, seeds, model.lab, keyOpts()), true, true); });
    if (!n) say("Nothing matched the edge color. Raise the tolerance, or use the Magic wand or Smart select.");
    else if (n > sw * sh * 0.97) say("That removed almost everything. Undo, then lower the tolerance.");
    else say("Background removed. Touch up with the Magic wand, Erase and Restore, or press Refine edge.");
    setTool(TOOL_MODE[tool] === "cut" ? tool : "restore", true);
    schedule();
  }
  function wandAt(p) {
    var q = toSrc(p), x = Math.floor(q[0]), y = Math.floor(q[1]);
    if (x < 0 || y < 0 || x >= sw || y >= sh) { say("That spot is outside the picture."); return; }
    if (pictureLocked()) { say("The cut-out is locked. Unlock it in Layers and locks."); return; }
    pushUndo("cut");
    var im = analysis(), sp = y * sw + x, m = [im.lab[sp * 3], im.lab[sp * 3 + 1], im.lab[sp * 3 + 2]];
    var D = srcData.data, rgb = [D[sp * 4], D[sp * 4 + 1], D[sp * 4 + 2]];
    if (!model) model = { lab: [], rgb: [] };
    model.rgb = model.rgb.concat([rgb]).slice(-6); model.lab = model.lab.concat([m]).slice(-6);
    var o = keyOpts(); o.contiguous = S.contig;
    var n = guardCut(function () { return applyRemove(BG.keyFlood(im, [sp], [m], o), true, false); });
    say(n ? "Removed " + Math.round(n * 100 / (sw * sh)) + "% of the picture. Undo if that was too much." : "Nothing left to remove there.");
    if (!n) { undo.pop(); syncUndo(); }
  }
  function refineEdge() {
    if (!src || !hasCut) { say("Remove some background first; Refine edge then snaps the cut to the picture's edges."); return; }
    if (pictureLocked()) { say("The cut-out is locked. Unlock it in Layers and locks."); return; }
    pushUndo("cut");
    guardCut(function () { var a = BG.refineAlpha(analysis(), alphaOf(cut)); putAlpha(cut, a); hasCut = anyBelow(a, 255); });
    subjDirty = true; say("Edge refined. Undo if it looked better before."); schedule();
  }

  // ---------- Smart select ----------
  var smartRun = 0;
  function runSmart() {
    if (!src || !strokes.length) return;
    if (!strokes.some(function (s) { return s.kind === 1; })) { say("Now draw a Keep stroke over the figure."); return; }
    var k = Math.min(1, 300 / Math.max(sw, sh)), gw = Math.max(2, Math.round(sw * k)), gh = Math.max(2, Math.round(sh * k));
    var gc = mk(gw, gh), gg = cx2(gc, true); gg.drawImage(fsrc || src, 0, 0, gw, gh);
    var rgba = gg.getImageData(0, 0, gw, gh).data, lc = mk(gw, gh), lg = cx2(lc, true);
    lg.lineCap = "round"; lg.lineJoin = "round";
    strokes.forEach(function (s) {
      var col = s.kind === 1 ? "#ff0000" : "#0000ff"; lg.strokeStyle = col; lg.fillStyle = col; lg.lineWidth = Math.max(1, s.r * 2 * k);
      lg.beginPath(); s.pts.forEach(function (q, i) { if (i) lg.lineTo(q[0] * k, q[1] * k); else lg.moveTo(q[0] * k, q[1] * k); });
      if (s.pts.length === 1) { lg.arc(s.pts[0][0] * k, s.pts[0][1] * k, Math.max(0.5, s.r * k), 0, TAU); lg.fill(); } else lg.stroke();
    });
    var ld = lg.getImageData(0, 0, gw, gh).data, labels = new Uint8Array(gw * gh);
    for (var i = 0; i < gw * gh; i++) labels[i] = ld[i * 4] > 128 ? 1 : ld[i * 4 + 2] > 128 ? 2 : 0;
    var run = ++smartRun; busy = true; say("Finding the edge...");
    BG.smartSolve(rgba, labels, gw, gh).then(function (mask) {
      if (run !== smartRun || !src) return;
      busy = false;
      applyMaskResult(maskToSource(mask, gw, gh, false), "Smart select done. Add more Keep or Remove strokes to correct it.");
    }, function (e) { if (run !== smartRun) return; busy = false; say(e && e.message === "no-keep" ? "Draw a Keep stroke over the figure first." : "Smart select couldn't run here. Use Remove background, the Magic wand or Erase."); });
  }
  // Scales a small mask (255 = keep) up to the picture, smoothly, then snaps it to the picture's edges.
  function maskToSource(mask, w, h, isFloat) {
    var c = mk(w, h), g = cx2(c), id = g.createImageData(w, h);
    for (var i = 0; i < w * h; i++) { id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = 255; id.data[i * 4 + 3] = isFloat ? mask[i] * 255 : mask[i]; }
    g.putImageData(id, 0, 0);
    var big = mk(sw, sh), bg2 = cx2(big, true); bg2.imageSmoothingQuality = "high"; bg2.drawImage(c, 0, 0, sw, sh);
    var a = alphaOf(big);
    return BG.refineAlpha(analysis(), a, Math.max(2, Math.round(Math.max(sw / w, sh / h) * 1.2)));
  }
  function applyMaskResult(a, msg) {
    if (S.smartTo === "cover") {
      if (L.backdrop) { say("The backdrop is locked. Unlock it in the Background section."); return; }
      var cv = new Uint8Array(a.length); for (var i = 0; i < a.length; i++) cv[i] = 255 - a[i];
      putAlpha(cover, cv); hasCover = anyAbove(cv, 0);
      if (S.fillType === "none") msg += " With Fill set to None the painted area is see-through; pick a texture or color.";
    } else {
      guardCut(function () { putAlpha(cut, a); }); hasCut = anyBelow(alphaOf(cut), 255);
    }
    subjDirty = true; say(msg); schedule();
  }

  // ---------- AI remove ----------
  function aiRemove() {
    if (!src) { say("Choose a picture first."); return; }
    if (S.smartTo !== "cover" && pictureLocked()) { say("The cut-out is locked. Unlock it in Layers and locks."); return; }
    if (busy) return;
    busy = true; $("aiBtn").disabled = true; progress(0.01);
    say("Getting AI remove ready (a one-time download)...");
    BG.aiLoad(function (f, stage) { progress(f); if (stage === "runtime") say("Starting the AI engine..."); }).then(function () {
      say("Looking for the figure..."); progress(0.97);
      return BG.aiMask(fsrc || src);
    }).then(function (m) {
      pushUndo(S.smartTo === "cover" ? "cover" : "cut");
      var a = maskToSource(m, 320, 320, true);
      if (S.clean) BG.cleanup(a, sw, sh, Math.max(24, Math.round(sw * sh * 0.0008)), 0);
      if (!model) model = { lab: [], rgb: [] };
      applyMaskResult(a, "AI remove done. Touch up with Smart select, Erase and Restore, or press Refine edge.");
      if (window.tgEvent) try { window.tgEvent("token-ai-remove"); } catch (e) { /* counting is optional */ }
    }).catch(function () {
      say("AI remove isn't available here. Use Remove background or Smart select.");
    }).then(function () { busy = false; $("aiBtn").disabled = false; progress(-1); });
  }
  function progress(f) {
    var el = $("prog");
    if (f < 0) { el.classList.add("tc-hidden"); return; }
    el.classList.remove("tc-hidden"); el.firstElementChild.style.width = Math.round(f * 100) + "%"; el.setAttribute("aria-valuenow", String(Math.round(f * 100)));
  }

  // ---------- undo and redo ----------
  // One history for every mask (stored as alpha only), the picture's size and place, the lettering and objects, and Smart select's
  // strokes. An entry can cover several kinds at once. Stepping back saves the current state on the other stack.
  function snap(kind) {
    if (kind === "cut") return { a: alphaOf(cut), has: hasCut, w: sw, h: sh };
    if (kind === "cover") return { a: alphaOf(cover), has: hasCover, w: sw, h: sh };
    if (kind === "pop") return { a: alphaOf(pop), has: hasPop };
    if (kind === "ring") return { a: alphaOf(ringMask), has: hasRingMask };
    if (kind === "obj") return { json: JSON.stringify(CT), sel: sel };
    if (kind === "smart") return { strokes: JSON.stringify(strokes) };
    return { x: img.x, y: img.y, zoom: img.zoom, flip: img.flip };
  }
  function restoreSnap(kind, s) {
    if (kind === "cut" || kind === "cover") {
      if (!cut || s.w !== sw || s.h !== sh) return false;
      putAlpha(kind === "cut" ? cut : cover, s.a); if (kind === "cut") hasCut = s.has; else hasCover = s.has; subjDirty = true;
    } else if (kind === "pop") { putAlpha(pop, s.a); hasPop = s.has; }
    else if (kind === "ring") { putAlpha(ringMask, s.a); hasRingMask = s.has; }
    else if (kind === "obj") { CT = JSON.parse(s.json); sel = s.sel < CT.objs.length ? s.sel : -1; syncContent(); }
    else if (kind === "smart") strokes = JSON.parse(s.strokes);
    else { if (s.flip !== img.flip) subjDirty = true; img = { x: s.x, y: s.y, zoom: s.zoom, flip: s.flip }; syncSize(); }
    return true;
  }
  function needsPicture(kind) { return kind === "cut" || kind === "cover" || kind === "smart"; }
  // coalesce: wheel steps and arrow nudges in quick succession make one undo step
  function pushUndo(kinds, coalesce) {
    kinds = [].concat(kinds);
    if (!cut && kinds.some(needsPicture)) return;
    var now = Date.now(), last = undo[undo.length - 1];
    if (coalesce && lastXform && now - lastXform < 800 && last && last.kinds.join() === kinds.join()) { lastXform = now; return; }
    lastXform = coalesce ? now : 0;
    undo.push({ kinds: kinds, s: kinds.map(snap) });
    if (undo.length > UNDO_MAX) undo.shift();
    redo = []; syncUndo();
  }
  function stepHistory(from, to) {
    var u = from.pop(); if (!u) return;
    var cur = { kinds: u.kinds, s: u.kinds.map(snap) }, ok = true;
    u.kinds.forEach(function (k, i) { if (!restoreSnap(k, u.s[i])) ok = false; });
    if (ok) to.push(cur);
    lastXform = 0; syncUndo(); schedule();
  }
  function doUndo() { stepHistory(undo, redo); }
  function doRedo() { stepHistory(redo, undo); }
  function syncUndo() { $("undo").disabled = !undo.length; $("redo").disabled = !redo.length; }

  // ---------- compose ----------
  function fill(g, r) {
    if (S.fillType === "none") return;
    if (S.fillType === "texture") { var tc = texLayer(); g.drawImage(tc, 0, 0, M, M); return; }
    var gr, G0 = geo();
    if (S.fillType === "solid") g.fillStyle = S.fill1;
    else if (S.fillType === "linear") { gr = g.createLinearGradient(0, G0.cy - r, 0, G0.cy + r); gr.addColorStop(0, S.fill1); gr.addColorStop(1, S.fill2); g.fillStyle = gr; }
    else { gr = g.createRadialGradient(G0.cx, G0.cy - r * 0.14, r * 0.05, G0.cx, G0.cy, r * 1.05); gr.addColorStop(0, S.fill1); gr.addColorStop(1, S.fill2); g.fillStyle = gr; }
    g.fillRect(0, 0, M, M);
  }
  function popMask() {
    popEffG.clearRect(0, 0, M, M);
    if (hasPop) popEffG.drawImage(pop, 0, 0);
    if (S.popTop) { popEffG.fillStyle = "#fff"; popEffG.fillRect(0, 0, M, S.popLine * M); }
    return hasPop || S.popTop;
  }
  function sideMark(g, r0, r1) {
    var sd = sideById(S.side); if (!sd || !S.sideMark) return;
    var band = r1 - r0, G0 = geo(), q = K.shapePt(G0.shape, G0.cx, G0.cy, (r0 + r1) / 2, Math.PI / 2), s = band * 0.36;
    g.save(); g.translate(q[0], q[1]); g.beginPath();
    if (sd.mark === "circle") g.arc(0, 0, s, 0, TAU);
    else if (sd.mark === "square") g.rect(-s * 0.86, -s * 0.86, s * 1.72, s * 1.72);
    else if (sd.mark === "diamond") { g.moveTo(0, -s * 1.15); g.lineTo(s * 1.15, 0); g.lineTo(0, s * 1.15); g.lineTo(-s * 1.15, 0); g.closePath(); }
    else { g.moveTo(0, -s * 1.1); g.lineTo(s * 1.1, s * 0.85); g.lineTo(-s * 1.1, s * 0.85); g.closePath(); }
    g.lineJoin = "round"; g.fillStyle = sd.color; g.strokeStyle = "rgba(10,10,12,0.85)"; g.lineWidth = band * 0.13; g.stroke();
    g.fill(); g.strokeStyle = "#ffffff"; g.lineWidth = band * 0.06; g.stroke();
    g.restore();
  }
  function textBand() { var r1 = ringR1(); return S.noRing ? S.thick * M : r1 - ringR0(); }
  function drawLettering(g) {
    if (!CT.top.trim() && !CT.bottom.trim()) return;
    var r1 = ringR1(), r0 = ringR0(), band = textBand(), size = Math.max(10, band * S.textSize), r;
    if (S.textWhere === "inside") r = r0 - size * 0.75; else if (S.textWhere === "outside") r = r1 + size * 0.62; else r = S.noRing ? r1 - band / 2 : (r0 + r1) / 2;
    var G0 = geo(), base = { font: S.font, size: size, track: S.textTrack, fill: S.textFill, stroke: S.textStroke, strokeW: S.textStrokeW, shadow: S.textWhere === "inside" };
    [["top", CT.top], ["bottom", CT.bottom]].forEach(function (tt) {
      var T = Object.assign({}, base, { text: tt[1], pos: tt[0] }), rr = tt[0] === "bottom" && S.textWhere !== "on" ? r + (S.textWhere === "inside" ? size * 0.12 : -size * 0.12) : r;
      OB.ringText(g, G0, rr, T);
    });
  }
  function badgeSpot(clock, r) { var G0 = geo(); return K.shapePt(G0.shape, G0.cx, G0.cy, r, OB.clockAngle(clock)); }
  function drawBadges(g) {
    var r1 = ringR1(), r0 = ringR0(), band = Math.max(S.thick * M, r1 - r0), rm = S.noRing ? r1 - band / 2 : (r0 + r1) / 2, q, sz = Math.max(28, band * 1.05);
    if (CT.pip.color) { q = badgeSpot(CT.pip.clock, rm); OB.badge(g, q[0], q[1], { kind: "pip", color: CT.pip.color, label: CT.pip.label, size: sz * 0.78 }); }
    if (CT.mark.kind) { q = badgeSpot(CT.mark.clock, rm); OB.badge(g, q[0], q[1], { kind: CT.mark.kind, color: CT.mark.kind === "elite" ? "#b8322a" : "#4a6a8a", size: sz * 0.9 }); }
    if (CT.badge.text) { q = badgeSpot(CT.badge.clock, rm); OB.badge(g, q[0], q[1], { kind: "number", text: CT.badge.text, color: CT.badge.color, shape: CT.badge.shape, size: sz }); }
  }
  function drawObjects(g, t) { CT.objs.forEach(function (O) { OB.drawObject(g, O, t); }); }
  function compose(t) {
    t = t || 0;
    if (subjDirty) rebuildSubject(gesture && gesture.kind === "brush");
    var r1 = ringR1(), r0 = ringR0(), ring = V.ring ? ringLayer(t) : null, band = r1 - r0;
    mg.clearRect(0, 0, M, M);
    mg.save(); mg.beginPath(); shapePath(mg, r0 + 0.5); mg.clip();
    if (V.backdrop) fill(mg, r0);
    if (src) place(mg, subj);
    if (ring) {
      if (S.inner > 0) mg.drawImage(innerLayer(r0, band), 0, 0);
      if (S.bevel > 0) {   // a lit lip along the inner edge: dark where it faces away from the light (top left), bright where it faces it
        var G0 = geo(), bw = Math.max(2, band * 0.14), lg = mg.createLinearGradient(G0.cx + LX * r0, G0.cy + LY * r0, G0.cx - LX * r0, G0.cy - LY * r0);
        lg.addColorStop(0, "rgba(0,0,0," + (0.6 * S.bevel).toFixed(3) + ")"); lg.addColorStop(0.5, "rgba(0,0,0,0)");
        lg.addColorStop(1, "rgba(255,255,255," + (0.65 * S.bevel).toFixed(3) + ")");
        mg.strokeStyle = lg; mg.lineWidth = bw; mg.lineJoin = "miter"; mg.beginPath(); shapePath(mg, r0 - bw / 2); mg.stroke();
      }
    }
    mg.restore();
    if (ring) {
      // the ring, less any erased parts (see-through there; the picture stays clipped to the inner edge)
      ringTmpG.globalCompositeOperation = "copy"; ringTmpG.drawImage(ring, 0, 0, M, M); ringTmpG.globalCompositeOperation = "source-over";
      sideMark(ringTmpG, r0, r1);
      if (hasRingMask) { ringTmpG.globalCompositeOperation = "destination-out"; ringTmpG.drawImage(ringMask, 0, 0); ringTmpG.globalCompositeOperation = "source-over"; }
      mg.drawImage(ringTmp, 0, 0);
    }
    if (V.objects && S.textUnderPop) drawLettering(mg);
    if (src && V.pop && popMask()) {
      /* The popped part starts where the inner ring shading starts (where it is still zero), not at the ring's edge, so it covers the
         shading and the bevel and leaves no seam along the ring, whatever the shape. Its shadow falls only on the ring and outside it --
         a shadow cast inward from the cut edge drew the ring's outline right across the figure. The shadow is drawn on its own (the image
         far off-canvas, the shadow offset back) so the popped pixels are drawn once and their soft edges don't darken. */
      var rIn = ring ? Math.max(0, r0 - band * 0.5 - 1) : Math.max(0, r0 - 1);
      tg.clearRect(0, 0, M, M); place(tg, subj);
      tg.globalCompositeOperation = "destination-in"; tg.drawImage(popEff, 0, 0);
      tg.globalCompositeOperation = "destination-out"; tg.beginPath(); shapePath(tg, rIn); tg.fill();
      tg.globalCompositeOperation = "source-over";
      if (S.popShadow) {
        mg.save();
        mg.beginPath(); mg.rect(0, 0, M, M); shapePath(mg, r0); mg.clip("evenodd");
        mg.shadowColor = "rgba(0,0,0,0.5)"; mg.shadowBlur = M * 0.014; mg.shadowOffsetX = M * 4; mg.shadowOffsetY = M * 0.006;
        mg.drawImage(tmp, -M * 4, 0); mg.restore();
      }
      mg.drawImage(tmp, 0, 0);
    }
    if (V.objects) { if (!S.textUnderPop) drawLettering(mg); drawBadges(mg); drawObjects(mg, t); }
    if (S.dropShadow) {   // the whole token, 5% smaller, over a soft shadow below it
      if (!dropC) { dropC = mk(M); dropG = cx2(dropC); }
      dropG.globalCompositeOperation = "copy"; dropG.drawImage(master, 0, 0); dropG.globalCompositeOperation = "source-over";
      var s = 0.95, o = C * (1 - s);
      mg.clearRect(0, 0, M, M); mg.save();
      mg.shadowColor = "rgba(0,0,0,0.55)"; mg.shadowBlur = M * 0.022; mg.shadowOffsetY = M * 0.014;
      mg.drawImage(dropC, o, o - M * 0.008, M * s, M * s); mg.restore();
    }
  }
  function accent() { return getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#2F6C5E"; }
  function isBrush(t) { return ["erase", "restore", "pop", "unpop", "keep", "rmv", "paint", "unpaint", "rerase", "rrestore"].indexOf(t) >= 0; }
  function isCutTool(t) { return t === "wand" || t === "erase" || t === "restore" || t === "keep" || t === "rmv"; }
  function previewT() { return playing ? animT : neonFlickering() ? animT : 0; }
  function draw() {
    compose(previewT());
    var P = pv.width, sc = P / M * cam.z, px = 1 / sc;   // px: one canvas pixel in token units
    pg.setTransform(1, 0, 0, 1, 0, 0); pg.clearRect(0, 0, P, P);
    pg.setTransform(sc, 0, 0, sc, P / 2 - cam.x * sc, P / 2 - cam.y * sc);
    if (src && gesture && (gesture.kind === "pan" || gesture.kind === "pinch")) { pg.save(); pg.globalAlpha = 0.28; place(pg, fsrc || src); pg.restore(); }
    pg.imageSmoothingEnabled = sc < 2; pg.imageSmoothingQuality = "high";   // crisp pixels when zoomed in close
    pg.drawImage(master, 0, 0, M, M);
    pg.imageSmoothingEnabled = true;
    if (src && hasCut && isCutTool(tool)) { pg.save(); pg.globalAlpha = 0.3; place(pg, rem); pg.restore(); }
    if (src && (tool === "keep" || tool === "rmv") && strokes.length) drawStrokes(px);
    if (src && hasCover && V.cover && (tool === "paint" || tool === "unpaint")) {
      tintG.clearRect(0, 0, M, M); place(tintG, cover);
      tintG.globalCompositeOperation = "source-in"; tintG.fillStyle = accent(); tintG.fillRect(0, 0, M, M); tintG.globalCompositeOperation = "source-over";
      pg.save(); pg.globalAlpha = 0.18; pg.drawImage(tint, 0, 0, M, M); pg.restore();
    }
    if (hasRingMask && (tool === "rerase" || tool === "rrestore" || ((tool === "erase" || tool === "restore") && S.affects !== "picture"))) {
      tintG.globalCompositeOperation = "copy"; tintG.drawImage(ringMask, 0, 0);
      tintG.globalCompositeOperation = "source-in"; tintG.fillStyle = accent(); tintG.fillRect(0, 0, M, M); tintG.globalCompositeOperation = "source-over";
      pg.save(); pg.globalAlpha = 0.25; pg.drawImage(tint, 0, 0, M, M); pg.restore();
    }
    if (src && (tool === "pop" || tool === "unpop" || lineActive) && popMask()) {
      tintG.globalCompositeOperation = "copy"; tintG.drawImage(popEff, 0, 0);
      tintG.globalCompositeOperation = "source-in"; tintG.fillStyle = accent(); tintG.fillRect(0, 0, M, M); tintG.globalCompositeOperation = "source-over";
      pg.save(); pg.globalAlpha = 0.32; pg.drawImage(tint, 0, 0, M, M); pg.restore();
    }
    if (S.popTop && (tool === "pop" || tool === "unpop" || lineActive)) {
      pg.save(); pg.setLineDash([8 * px, 6 * px]); pg.strokeStyle = accent(); pg.lineWidth = 2 * px; pg.beginPath(); pg.moveTo(0, S.popLine * M); pg.lineTo(M, S.popLine * M); pg.stroke(); pg.restore();
    }
    if (tool === "select" && sel >= 0 && CT.objs[sel]) drawHandles(CT.objs[sel], px);
    if (hover && isBrush(tool) && !picking && !spaceDown) {
      var r = +$("brush").value;
      pg.save(); pg.lineWidth = 1.5 * px; pg.strokeStyle = "rgba(0,0,0,0.7)"; pg.beginPath(); pg.arc(hover[0], hover[1], r, 0, TAU); pg.stroke();
      pg.strokeStyle = "rgba(255,255,255,0.9)"; pg.beginPath(); pg.arc(hover[0], hover[1], r + 1.5 * px, 0, TAU); pg.stroke();
      if ((tool === "paint" || tool === "unpaint") && S.brushSoft > 0.02) { pg.setLineDash([4 * px, 4 * px]); pg.beginPath(); pg.arc(hover[0], hover[1], r * (1 - S.brushSoft), 0, TAU); pg.stroke(); }
      pg.restore();
    }
    pg.setTransform(1, 0, 0, 1, 0, 0);
    if (cam.z > 1) drawInset();
  }
  function drawStrokes(px) {
    pg.save(); pg.lineCap = "round"; pg.lineJoin = "round"; pg.globalAlpha = 0.55;
    strokes.forEach(function (s) {
      var col = s.kind === 1 ? "#2fbf5f" : "#e0443c", w = s.r * 2 * scale();
      pg.strokeStyle = col; pg.fillStyle = col; pg.lineWidth = Math.max(2 * px, w * 0.5);
      pg.beginPath();
      s.pts.forEach(function (q, i) { var tq = srcToToken(q); if (i) pg.lineTo(tq[0], tq[1]); else pg.moveTo(tq[0], tq[1]); });
      if (s.pts.length === 1) { var t0 = srcToToken(s.pts[0]); pg.arc(t0[0], t0[1], Math.max(2 * px, w * 0.25), 0, TAU); pg.fill(); } else pg.stroke();
    });
    pg.restore();
  }
  function srcToToken(q) { return [(q[0] - sw / 2) * scale() * (img.flip ? -1 : 1) + C + img.x, (q[1] - sh / 2) * scale() + C + img.y]; }
  function handleSpots(O) {
    var hh = OB.objHalf(O), px = M / (pv.width * cam.z) * (pv.width / (pv.getBoundingClientRect().width || pv.width));
    return { corner: OB.fromLocal(O, [hh[0], hh[1]]), rot: OB.fromLocal(O, [0, -hh[1] - 26 * px]), r: 9 * px, hh: hh, px: px };
  }
  function drawHandles(O, px) {
    var H = handleSpots(O), hh = H.hh, ac = accent();
    pg.save(); pg.translate(O.x, O.y); pg.rotate(O.rot || 0);
    pg.setLineDash([6 * px, 4 * px]); pg.strokeStyle = ac; pg.lineWidth = 1.5 * px; pg.strokeRect(-hh[0], -hh[1], hh[0] * 2, hh[1] * 2);
    pg.setLineDash([]); pg.beginPath(); pg.moveTo(0, -hh[1]); pg.lineTo(0, -hh[1] - 26 * H.px); pg.stroke();
    pg.restore();
    [H.corner, H.rot].forEach(function (q, i) {
      pg.fillStyle = i ? "#ffffff" : ac; pg.strokeStyle = i ? ac : "#ffffff"; pg.lineWidth = 2 * px;
      pg.beginPath(); if (i) pg.arc(q[0], q[1], H.r, 0, TAU); else pg.rect(q[0] - H.r, q[1] - H.r, H.r * 2, H.r * 2); pg.fill(); pg.stroke();
    });
  }
  function drawInset() {
    var N = insetCv.width, k = N / M, h = M / (2 * cam.z);
    ig.clearRect(0, 0, N, N); ig.imageSmoothingQuality = "high"; ig.drawImage(master, 0, 0, N, N);
    ig.lineWidth = 2; ig.strokeStyle = "rgba(0,0,0,0.75)"; ig.strokeRect((cam.x - h) * k + 1, (cam.y - h) * k + 1, 2 * h * k - 2, 2 * h * k - 2);
    ig.lineWidth = 1.5; ig.strokeStyle = accent(); ig.strokeRect((cam.x - h) * k + 1, (cam.y - h) * k + 1, 2 * h * k - 2, 2 * h * k - 2);
  }
  var pending = false;
  function schedule() { if (pending) return; pending = true; requestAnimationFrame(function () { pending = false; draw(); }); }

  // ---------- animation in the preview ----------
  // Play runs the animated rings at 512 px while it plays; a flickering neon sign flickers in the preview all the time.
  function animFrames() { return S.animLen <= 1 ? 12 : S.animLen <= 1.5 ? 18 : 20; }
  function neonFlickering() { return V.objects && CT.objs.some(function (O) { return O.style === "neon" && O.neon && OB.neonMode(O.neon) !== "off"; }); }
  function hasAnimation() { return (!S.noRing && V.ring && ringStyle().anim) || neonFlickering(); }
  var tickTimer = 0;
  function tick() {
    clearTimeout(tickTimer);
    if (!(playing || neonFlickering()) || document.hidden) return;
    var n = animFrames(), step = S.animLen / n;
    animT = (Math.floor(((performance.now() / 1000) % S.animLen) / step) * step) || step * 0.001;
    schedule();
    tickTimer = setTimeout(tick, step * 1000);
  }
  function setPlaying(on) {
    playing = on; $("playAnim").setAttribute("aria-pressed", String(on)); $("playAnim").innerHTML = on ? "&#10074;&#10074; Pause" : "&#9654; Play";
    if (on && !hasAnimation()) say("Nothing on this token moves yet. Pick a ring marked ▶, or add a neon sign with flicker on.");
    if (!on) { animT = 0; ringFrames = { key: "", f: {} }; }
    tick(); schedule();
  }
  document.addEventListener("visibilitychange", tick);

  // ---------- view camera (preview only) ----------
  function clampCam() {
    cam.z = Math.min(8, Math.max(1, cam.z));
    var h = M / (2 * cam.z);
    cam.x = Math.min(M - h, Math.max(h, cam.x)); cam.y = Math.min(M - h, Math.max(h, cam.y));
  }
  function setCam(z, p) {   // zoom the view to z, keeping token point p (default: the middle of the view) where it is on screen
    z = Math.min(8, Math.max(1, z)); p = p || [cam.x, cam.y];
    var k = cam.z / z;
    cam.x = p[0] - (p[0] - cam.x) * k; cam.y = p[1] - (p[1] - cam.y) * k; cam.z = z;
    clampCam(); syncCam(); schedule();
  }
  function syncCam() {
    var zoomed = cam.z > 1.001, pct = Math.round(cam.z * 100) + "%";
    $("viewZoom").value = cam.z; $("viewZoomOut").textContent = pct;
    $("viewChip").textContent = "View " + pct + " · Fit"; $("viewChip").classList.toggle("tc-hidden", !zoomed);
    $("inset").classList.toggle("tc-hidden", !zoomed);
    // keep the see-through checkerboard lined up with the token
    var W = pv.clientWidth || 512, cell = 24 * cam.z, ox = W / 2 - cam.x * W / M * cam.z, oy = W / 2 - cam.y * W / M * cam.z;
    stage.style.backgroundSize = cell + "px " + cell + "px";
    stage.style.backgroundPosition = ox + "px " + oy + "px";
  }

  // ---------- export ----------
  // Exports always compose the whole token at full quality; the view camera is never read here.
  function renderToken(N, t) {
    var wasDraft = draft; draft = false;
    var keep = gesture; gesture = null; compose(t || 0); gesture = keep; draft = wasDraft;
    var c = master, size = M;
    if (N !== 256 && N !== 512 && N !== 1024) { var o = mk(N), og = cx2(o, true); og.imageSmoothingQuality = "high"; og.drawImage(master, 0, 0, N, N); schedule(); return o; }
    while (size / 2 >= N) { var h = mk(size / 2), hg = cx2(h, true); hg.imageSmoothingQuality = "high"; hg.drawImage(c, 0, 0, size / 2, size / 2); c = h; size /= 2; }
    if (c === master) { var cp = mk(M); cx2(cp, true).drawImage(master, 0, 0); c = cp; }
    schedule();
    return c;
  }
  function fontsFirst() { var ids = [S.font]; CT.objs.forEach(function (O) { if (O.font) ids.push(O.font); }); return (CT.top || CT.bottom || CT.objs.length) ? OB.fontsReady(ids) : Promise.resolve(); }
  function exportPng(N) {
    fontsFirst().then(function () {
      var c = renderToken(N), name = fileBase + "-token-" + N + ".png";
      function save(url, revoke) { var a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); if (revoke) setTimeout(function () { URL.revokeObjectURL(url); }, 4000); }
      if (c.toBlob) c.toBlob(function (b) { if (b) save(URL.createObjectURL(b), true); else save(c.toDataURL("image/png"), false); }, "image/png");
      else save(c.toDataURL("image/png"), false);
      if (window.tgEvent) try { window.tgEvent("token-download-" + N); } catch (e) { /* counting is optional */ }
      say("Downloaded " + name + ".");
    });
  }
  function exportWebp() {
    fontsFirst().then(function () {
      var c = renderToken(512);
      EX.canvasBytes(c, "image/webp", 0.92).then(function (u) { EX.download(new Blob([u], { type: "image/webp" }), fileBase + "-token-512.webp"); say("Downloaded " + fileBase + "-token-512.webp (" + Math.round(u.length / 1024) + " KB)."); });
    });
  }
  var canCopy = !!(navigator.clipboard && navigator.clipboard.write && window.ClipboardItem);
  function copyImage() {
    if (!canCopy) return;
    var c = renderToken(512);
    var blob = new Promise(function (ok, fail) { c.toBlob(function (b) { if (b) ok(b); else fail(new Error("empty")); }, "image/png"); });
    navigator.clipboard.write([new window.ClipboardItem({ "image/png": blob })]).then(function () {
      say("Copied the 512 px token. Paste it into a Discord message or another app.");
      if (window.tgEvent) try { window.tgEvent("token-copy"); } catch (e) { /* counting is optional */ }
    }, function () { say("Your browser didn't allow copying the picture. Download the PNG instead."); });
  }
  function batchLabel(i, kind) { return kind === "let" ? String.fromCharCode(64 + i) : String(i); }
  function batchBytes(n, kind, N) {
    n = Math.max(2, Math.min(12, n | 0)); N = N || 512;
    var keep = CT.badge.text, files = [], i = 1;
    return fontsFirst().then(function step() {
      if (i > n) { CT.badge.text = keep; schedule(); return EX.zip(files); }
      CT.badge.text = batchLabel(i, kind);
      var c = renderToken(N), lab = batchLabel(i, kind);
      return EX.canvasBytes(c, "image/png").then(function (u) {
        files.push({ name: fileBase + "-token-" + (kind === "let" ? lab : ("0" + lab).slice(-2)) + ".png", data: u }); i++; return step();
      });
    });
  }
  function batchZip() {
    if (busy) return;
    var n = Math.max(2, Math.min(12, +$("batchN").value || 4)), kind = $("batchKind").value; $("batchN").value = n;
    busy = true; say("Making " + n + " tokens...");
    batchBytes(n, kind).then(function (z) {
      EX.download(new Blob([z], { type: "application/zip" }), fileBase + "-tokens.zip");
      say("Downloaded " + fileBase + "-tokens.zip with " + n + " tokens.");
      if (window.tgEvent) try { window.tgEvent("token-batch"); } catch (e) { /* counting is optional */ }
    }, function () { say("Couldn't make the batch. Try again, or download the tokens one by one."); }).then(function () { busy = false; });
  }
  // Animated: frames rendered by the same code as the still token, with the time t stepping through one loop.
  function animFrameData(N, onProgress) {
    var n = animFrames(), step = S.animLen / n, frames = [], i = 0, wasPlaying = playing;
    playing = false;
    return fontsFirst().then(function next() {
      if (i >= n) { playing = wasPlaying; schedule(); return frames; }
      var c = renderToken(N, i === 0 ? 0 : i * step);
      frames.push(cx2(c, true).getImageData(0, 0, N, N)); i++;
      if (onProgress) onProgress(i / n);
      return new Promise(function (ok) { setTimeout(ok, 0); }).then(next);
    });
  }
  function exportAnim(kind) {
    if (busy) return;
    if (!hasAnimation()) { say("Nothing on this token moves yet. Pick a ring marked ▶, or add a neon sign with flicker on."); return; }
    busy = true; progress(0.02); say("Drawing the frames...");
    var N = 512, n = animFrames(), delay = Math.round(S.animLen * 1000 / n);
    animFrameData(N, function (f) { progress(f * 0.7); }).then(function (frames) {
      say(kind === "gif" ? "Encoding the GIF (the encoder downloads the first time)..." : "Encoding the APNG (the encoder downloads the first time)...");
      progress(0.75);
      return kind === "gif" ? EX.gif(frames, N, N, delay) : EX.apng(frames, N, N, delay);
    }).then(function (bytes) {
      var name = fileBase + "-token-512-animated." + (kind === "gif" ? "gif" : "png");
      EX.download(new Blob([bytes], { type: kind === "gif" ? "image/gif" : "image/apng" }), name);
      say("Downloaded " + name + " (" + Math.round(bytes.length / 1024) + " KB). The bot's battle maps show its first frame.");
      if (window.tgEvent) try { window.tgEvent("token-anim-" + kind); } catch (e) { /* counting is optional */ }
    }).catch(function () { say("Couldn't make the animated file here. The encoder may be blocked or offline; the still PNG still works."); })
      .then(function () { busy = false; progress(-1); });
  }

  // ---------- project file ----------
  function maskUrl(c, has) { return has ? c.toDataURL("image/png") : null; }
  function projectData() {
    var d = { app: "table-goblin-token", version: 1, settings: JSON.parse(JSON.stringify(S)), content: JSON.parse(JSON.stringify(CT)),
      locks: Object.assign({}, L), visible: Object.assign({}, V), fileBase: fileBase, picture: null };
    if (src) {
      d.picture = { data: src.toDataURL("image/png"), w: sw, h: sh, img: Object.assign({}, img), filters: Object.assign({}, F),
        masks: { cut: maskUrl(cut, hasCut), cover: maskUrl(cover, hasCover), pop: maskUrl(pop, hasPop), ring: maskUrl(ringMask, hasRingMask) },
        strokes: strokes, model: model };
    } else d.masks = { pop: maskUrl(pop, hasPop), ring: maskUrl(ringMask, hasRingMask) };
    return d;
  }
  function presetData() { return { app: "table-goblin-token", version: 1, preset: true, settings: JSON.parse(JSON.stringify(S)) }; }
  function saveJson(obj, name) { EX.download(new Blob([JSON.stringify(obj)], { type: "application/json" }), name); }
  function loadImg(url) { return new Promise(function (ok, fail) { if (!url) { ok(null); return; } var im = new Image(); im.onload = function () { ok(im); }; im.onerror = fail; im.src = url; }); }
  function drawMask(c, im) { var g = cx2(c, true); g.clearRect(0, 0, c.width, c.height); if (im) g.drawImage(im, 0, 0, c.width, c.height); return !!im; }
  function okUrl(u) { return u === null || u === undefined || (typeof u === "string" && /^data:image\/(png|jpeg|webp);base64,/.test(u)); }
  // Validates and rebuilds a project. A ring preset (no picture) changes the settings only.
  function loadProject(d) {
    if (!d || d.app !== "table-goblin-token" || d.version !== 1 || typeof d.settings !== "object") return Promise.reject(new Error("not a project"));
    var P = d.picture;
    if (P && (!okUrl(P.data) || !P.masks || !["cut", "cover", "pop", "ring"].every(function (k) { return okUrl(P.masks[k]); }))) return Promise.reject(new Error("bad picture"));
    function applySettings() { loadSettings(d.settings); persist(); syncControls(); }
    if (d.preset || !P) { applySettings(); say(d.preset ? "Ring preset applied." : "Settings applied."); return Promise.resolve(); }
    return Promise.all([loadImg(P.data), loadImg(P.masks.cut), loadImg(P.masks.cover), loadImg(P.masks.pop), loadImg(P.masks.ring)]).then(function (ims) {
      setImage(ims[0], (d.fileBase || "token") + ".png", true);
      applySettings();
      hasCut = drawMask(cut, ims[1]); if (!ims[1]) { cutG.fillStyle = "#fff"; cutG.fillRect(0, 0, sw, sh); }
      hasCover = drawMask(cover, ims[2]); hasPop = drawMask(pop, ims[3]); hasRingMask = drawMask(ringMask, ims[4]);
      if (P.img && typeof P.img.zoom === "number") img = { x: +P.img.x || 0, y: +P.img.y || 0, zoom: Math.min(4, Math.max(0.2, P.img.zoom)), flip: !!P.img.flip };
      if (P.filters) { Object.keys(F).forEach(function (k) { if (typeof P.filters[k] === typeof F[k]) F[k] = P.filters[k]; }); syncFilters(); applyFilters(); }
      if (Array.isArray(P.strokes)) strokes = P.strokes.filter(function (s) { return s && (s.kind === 1 || s.kind === 2) && Array.isArray(s.pts); });
      if (P.model && Array.isArray(P.model.rgb) && Array.isArray(P.model.lab)) model = { rgb: P.model.rgb, lab: P.model.lab };
      if (d.content && typeof d.content === "object") { CT = Object.assign(freshContent(), d.content); if (!Array.isArray(CT.objs)) CT.objs = []; }
      if (d.locks) Object.keys(L).forEach(function (k) { L[k] = !!d.locks[k]; });
      if (d.visible) Object.keys(V).forEach(function (k) { if (typeof d.visible[k] === "boolean") V[k] = d.visible[k]; });
      fileBase = d.fileBase || fileBase;
      syncSize(); syncContent(); syncLocks(); renderLayers(); subjDirty = true; schedule();
      say("Project opened. Everything is as you saved it.");
    });
  }
  function openProject(f) {
    var rd = new FileReader();
    rd.onload = function () {
      var d; try { d = JSON.parse(rd.result); } catch (e) { say("That file isn't a token project."); return; }
      loadProject(d).catch(function () { say("That file isn't a token project, or it is damaged."); });
    };
    rd.readAsText(f);
  }

  // ---------- eyedropper ----------
  function startPicking(btn) {
    if (btn.disabled) return;
    if (picking === btn) { stopPicking(); hint(); return; }
    stopPicking(); picking = btn; btn.setAttribute("aria-pressed", "true"); pv.classList.add("pick");
    say("Tap the token to pick a color. Esc cancels.");
  }
  function stopPicking() {
    if (!picking) return;
    picking.setAttribute("aria-pressed", "false"); picking = null; pv.classList.remove("pick"); schedule();
  }
  function pickColor(p) {
    var x = Math.min(M - 1, Math.max(0, Math.floor(p[0]))), y = Math.min(M - 1, Math.max(0, Math.floor(p[1])));
    compose();
    var d = mg.getImageData(x, y, 1, 1).data;
    if (d[3] < 16) { say("That spot is see-through. Tap the picture or the ring."); return; }
    var h = toHex([d[0], d[1], d[2]]), el = $(picking.dataset.pick);
    el.value = h; el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true }));
    stopPicking(); say("Picked " + h + ".");
  }

  // ---------- pointer ----------
  // Pointers are kept as 0..1 fractions of the preview; fromF turns one into a token point through the view camera, so every tool
  // works in token space whatever the view zoom.
  function screenF(e) { var r = pv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; }
  function fromF(f) { return [(f[0] - 0.5) * M / cam.z + cam.x, (f[1] - 0.5) * M / cam.z + cam.y]; }
  function tokenPt(e) { return fromF(screenF(e)); }
  function midF(v) { return [(v[0][0] + v[1][0]) / 2, (v[0][1] + v[1][1]) / 2]; }
  function distF(v) { return Math.max(1e-4, Math.hypot(v[0][0] - v[1][0], v[0][1] - v[1][1])); }
  function brushTargets() {   // which layers the current brush paints
    if (tool === "pop" || tool === "unpop") return ["pop"];
    if (tool === "rerase" || tool === "rrestore") return ["ring"];
    if (tool === "paint" || tool === "unpaint") return ["cover"];
    if (tool === "keep" || tool === "rmv") return ["smart"];
    var out = [];
    if (S.affects !== "ring" && !pictureLocked()) out.push("cut");
    if (S.affects !== "picture" && !L.ring) out.push("ring");
    return out;
  }
  function brushRefusal() {
    if ((tool === "paint" || tool === "unpaint") && L.backdrop) return "The backdrop is locked. Unlock it in the Background section.";
    if ((tool === "rerase" || tool === "rrestore") && L.ring) return "The ring is locked. Unlock it in the Ring section.";
    if (tool === "erase" || tool === "restore") {
      if (S.affects === "picture" && pictureLocked()) return "The cut-out is locked. Unlock it in Layers and locks, or set Affects to Ring.";
      if (S.affects === "ring" && L.ring) return "The ring is locked. Unlock it in the Ring section.";
      if (S.affects === "both" && pictureLocked() && L.ring) return "The cut-out and the ring are both locked.";
    }
    if ((tool === "keep" || tool === "rmv") && pictureLocked() && S.smartTo === "cut") return "The cut-out is locked. Unlock it in Layers and locks.";
    if ((tool === "pop" || tool === "unpop") && !src) return "Choose a picture first.";
    return "";
  }
  function dab(a, b) {
    var rt = +$("brush").value, dx = b[0] - a[0], dy = b[1] - a[1], steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / (rt * 0.3))), i, q;
    var targets = gesture && gesture.targets ? gesture.targets : brushTargets();
    targets.forEach(function (tgt) {
      if (tgt === "pop" || tgt === "ring") {
        var g = tgt === "pop" ? popG : ringMaskG, add = tool === "pop" || tool === "rerase" || tool === "erase";
        g.globalCompositeOperation = add ? "source-over" : "destination-out"; g.fillStyle = "#fff";
        for (i = 0; i <= steps; i++) { q = [a[0] + dx * i / steps, a[1] + dy * i / steps]; g.beginPath(); g.arc(q[0], q[1], rt, 0, TAU); g.fill(); }
        g.globalCompositeOperation = "source-over";
        if (tgt === "pop" && add) hasPop = true;
        if (tgt === "ring" && add) hasRingMask = true;
      } else if (tgt === "cut") {
        var rs = rt / scale();
        cutG.save();
        if (L.imgIn || L.imgOut) { tokenToSrcMatrix(cutG); cutG.beginPath(); if (L.imgIn) { cutG.rect(-M * 8, -M * 8, M * 17, M * 17); shapePath(cutG, ringR0()); cutG.clip("evenodd"); } else { shapePath(cutG, ringR0()); cutG.clip(); } cutG.setTransform(1, 0, 0, 1, 0, 0); }
        cutG.globalCompositeOperation = tool === "erase" ? "destination-out" : "source-over"; cutG.fillStyle = "#fff";
        for (i = 0; i <= steps; i++) { q = toSrc([a[0] + dx * i / steps, a[1] + dy * i / steps]); cutG.beginPath(); cutG.arc(q[0], q[1], rs, 0, TAU); cutG.fill(); }
        cutG.restore(); hasCut = true; subjDirty = true;
      } else if (tgt === "cover") {
        var rc = rt / scale(), soft = S.brushSoft, str = S.brushStrength;
        coverG.save(); coverG.globalCompositeOperation = tool === "paint" ? "source-over" : "destination-out"; coverG.globalAlpha = str * (soft > 0.02 ? 0.5 : 1);
        for (i = 0; i <= steps; i++) {
          q = toSrc([a[0] + dx * i / steps, a[1] + dy * i / steps]);
          if (soft > 0.02) { var gr = coverG.createRadialGradient(q[0], q[1], rc * (1 - soft), q[0], q[1], rc); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(1, "rgba(255,255,255,0)"); coverG.fillStyle = gr; }
          else coverG.fillStyle = "#fff";
          coverG.beginPath(); coverG.arc(q[0], q[1], rc, 0, TAU); coverG.fill();
        }
        coverG.restore(); if (tool === "paint") hasCover = true; subjDirty = true;
      } else if (tgt === "smart") {
        var st = strokes[strokes.length - 1];
        for (i = 1; i <= steps; i++) st.pts.push(toSrc([a[0] + dx * i / steps, a[1] + dy * i / steps]));
      }
    });
  }
  function zoomAbout(z, p) {
    z = Math.min(4, Math.max(0.2, z)); var k = z / img.zoom;
    img.x = p[0] - C - (p[0] - C - img.x) * k; img.y = p[1] - C - (p[1] - C - img.y) * k; img.zoom = z; syncSize();
  }
  function lockedSay() { say("The picture's size and position are locked. Unlock them in the Picture section."); }
  function pansView() { return tool === "pan" || spaceDown || (tool === "move" && L.imgXform); }
  function objAt(p) {
    var pad = 6 * M / (pv.width * cam.z);
    for (var i = CT.objs.length - 1; i >= 0; i--) if (OB.hitObject(CT.objs[i], p, pad)) return i;
    return -1;
  }
  function startObjectGesture(p) {
    if (L.objects) { say("The objects are locked. Unlock them in Layers and locks."); return; }
    var O = sel >= 0 ? CT.objs[sel] : null;
    if (O) {
      var H = handleSpots(O);
      if (Math.hypot(p[0] - H.corner[0], p[1] - H.corner[1]) <= H.r * 1.8) { pushUndo("obj"); gesture = { kind: "objscale", w: O.w, h: O.h, d0: Math.hypot(p[0] - O.x, p[1] - O.y) }; return; }
      if (Math.hypot(p[0] - H.rot[0], p[1] - H.rot[1]) <= H.r * 1.8) { pushUndo("obj"); gesture = { kind: "objrot", r0: O.rot || 0, a0: Math.atan2(p[1] - O.y, p[0] - O.x) }; return; }
    }
    var hit = objAt(p);
    if (hit !== sel) { sel = hit; syncObjForm(); }
    if (hit >= 0) { gesture = { kind: "objmove", p: p, x: CT.objs[hit].x, y: CT.objs[hit].y, pushed: false }; say("Drag to move it; the corner handle resizes it and the round handle turns it."); }
    else say(CT.objs.length ? "Tap an object to select it." : "Add a banner, scroll, plaque, nameplate or neon sign in the Text and objects section.");
  }
  pv.addEventListener("pointerdown", function (e) {
    if (e.button > 1) return;
    try { pv.setPointerCapture(e.pointerId); } catch (err) { /* not every pointer can be captured */ }
    try { pv.focus({ preventScroll: true }); } catch (err) { /* focus is a convenience for the arrow keys */ }
    e.preventDefault();
    var f = screenF(e), p = fromF(f); pts.set(e.pointerId, f); hover = p;
    if (picking) { if (pts.size === 1) pickColor(p); return; }
    if (pts.size === 2) {
      if (gesture && gesture.kind === "brush") { subjDirty = true; if (gesture.smart) runSmart(); }
      var v = Array.from(pts.values());
      if (src && tool === "move" && !pansView()) { pushUndo("xform"); gesture = { kind: "pinch", d: distF(v), zoom: img.zoom, x: img.x, y: img.y, mid: fromF(midF(v)) }; }
      else gesture = { kind: "viewpinch", d: distF(v), z: cam.z, anchor: fromF(midF(v)) };
    } else if (pts.size === 1) {
      if (e.button === 1 || pansView()) gesture = { kind: "view", f: f, x: cam.x, y: cam.y };
      else if (tool === "select") startObjectGesture(p);
      else if (!src && tool !== "rerase" && tool !== "rrestore") say("Choose a picture first.");
      else if (tool === "move") gesture = { kind: "pan", p: p, x: img.x, y: img.y, pushed: false };
      else if (tool === "wand") wandAt(p);
      else {
        var why = brushRefusal(), targets = brushTargets();
        if (why) { say(why); }
        else if (!targets.length) say("Nothing to change there: the layer is locked.");
        else {
          pushUndo(targets.indexOf("smart") >= 0 ? [S.smartTo === "cover" ? "cover" : "cut", "smart"] : targets);
          if (targets[0] === "smart") strokes.push({ kind: tool === "keep" ? 1 : 2, r: +$("brush").value / scale(), pts: [toSrc(p)] });
          gesture = { kind: "brush", last: p, targets: targets, smart: targets[0] === "smart" }; dab(p, p);
        }
      }
    }
    schedule();
  });
  pv.addEventListener("pointermove", function (e) {
    var f = screenF(e), p = fromF(f), v;
    if (pts.has(e.pointerId)) pts.set(e.pointerId, f);
    if (!gesture) { hover = p; if (isBrush(tool)) schedule(); return; }
    if (gesture.kind === "view") {
      cam.x = gesture.x - (f[0] - gesture.f[0]) * M / cam.z; cam.y = gesture.y - (f[1] - gesture.f[1]) * M / cam.z; clampCam(); syncCam();
    } else if (gesture.kind === "pan") {
      if (!gesture.pushed) { pushUndo("xform"); gesture.pushed = true; }
      img.x = gesture.x + p[0] - gesture.p[0]; img.y = gesture.y + p[1] - gesture.p[1];
    } else if (gesture.kind === "pinch" && pts.size >= 2) {
      v = Array.from(pts.values());
      var mid = fromF(midF(v)), z = Math.min(4, Math.max(0.2, gesture.zoom * distF(v) / gesture.d)), k = z / gesture.zoom;
      img.x = mid[0] - C - (gesture.mid[0] - C - gesture.x) * k; img.y = mid[1] - C - (gesture.mid[1] - C - gesture.y) * k; img.zoom = z; syncSize();
    } else if (gesture.kind === "viewpinch" && pts.size >= 2) {
      v = Array.from(pts.values());
      var mf = midF(v);
      cam.z = Math.min(8, Math.max(1, gesture.z * distF(v) / gesture.d));
      cam.x = gesture.anchor[0] - (mf[0] - 0.5) * M / cam.z; cam.y = gesture.anchor[1] - (mf[1] - 0.5) * M / cam.z; clampCam(); syncCam();
    } else if (gesture.kind === "brush") { dab(gesture.last, p); gesture.last = p; }
    else if (gesture.kind === "objmove" && CT.objs[sel]) {
      if (!gesture.pushed) { pushUndo("obj"); gesture.pushed = true; }
      CT.objs[sel].x = gesture.x + p[0] - gesture.p[0]; CT.objs[sel].y = gesture.y + p[1] - gesture.p[1];
    } else if (gesture.kind === "objscale" && CT.objs[sel]) {
      var O = CT.objs[sel], k2 = Math.max(0.15, Math.min(4, Math.hypot(p[0] - O.x, p[1] - O.y) / Math.max(1, gesture.d0)));
      O.w = Math.max(40, Math.min(M * 1.4, gesture.w * k2)); O.h = Math.max(14, Math.min(M, gesture.h * k2));
    } else if (gesture.kind === "objrot" && CT.objs[sel]) {
      var O2 = CT.objs[sel], ang = gesture.r0 + Math.atan2(p[1] - O2.y, p[0] - O2.x) - gesture.a0;
      if (!e.shiftKey) { var snapTo = Math.round(ang / (Math.PI / 12)) * (Math.PI / 12); if (Math.abs(snapTo - ang) < 0.06) ang = snapTo; }
      O2.rot = ang;
    }
    hover = fromF(f);
    schedule();
  });
  function endPointer(e) {
    pts.delete(e.pointerId);
    var wasSmart = gesture && gesture.kind === "brush" && gesture.smart;
    if (gesture && gesture.kind === "brush") subjDirty = true;
    if (!pts.size || (gesture && (gesture.kind === "pinch" || gesture.kind === "viewpinch"))) gesture = null;
    if (!pts.size && e.pointerType !== "mouse") hover = null;
    if (wasSmart && !gesture) runSmart();
    schedule();
  }
  pv.addEventListener("pointerup", endPointer);
  pv.addEventListener("pointercancel", endPointer);
  pv.addEventListener("pointerleave", function () { if (!gesture) { hover = null; schedule(); } });
  pv.addEventListener("auxclick", function (e) { if (e.button === 1) e.preventDefault(); });
  pv.addEventListener("wheel", function (e) {
    if (!src && cam.z === 1 && !e.ctrlKey) return;
    e.preventDefault();
    var p = tokenPt(e), up = e.deltaY < 0;
    // The Picture tool's wheel resizes the picture (as before); Ctrl + wheel, a locked picture and every other tool zoom the view.
    if (!src || e.ctrlKey || e.metaKey || tool !== "move" || L.imgXform) setCam(cam.z * (up ? 1.12 : 1 / 1.12), p);
    else { pushUndo("xform", true); zoomAbout(img.zoom * (up ? 1.07 : 1 / 1.07), p); schedule(); }
  }, { passive: false });
  $("viewChip").addEventListener("click", function () { setCam(1); });
  $("inset").addEventListener("click", function (e) {
    if (!e.detail) { setCam(1); return; }   // keyboard press: show the whole token
    var r = insetCv.getBoundingClientRect();
    cam.x = (e.clientX - r.left) / r.width * M; cam.y = (e.clientY - r.top) / r.height * M; clampCam(); syncCam(); schedule();
  });

  // ---------- keyboard ----------
  function inField(el) { return !!el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable); }
  function nudge(dx, dy) {
    if (tool === "select" && sel >= 0 && CT.objs[sel]) {
      if (L.objects) { say("The objects are locked. Unlock them in Layers and locks."); return; }
      pushUndo("obj", true); CT.objs[sel].x += dx; CT.objs[sel].y += dy; schedule(); return;
    }
    if (!src) return;
    if (L.imgXform) {
      if (cam.z > 1) { cam.x += dx * 4 / cam.z; cam.y += dy * 4 / cam.z; clampCam(); syncCam(); schedule(); } else lockedSay();
      return;
    }
    pushUndo("xform", true); img.x += dx; img.y += dy; schedule();
  }
  function setBrush(v) { var el = $("brush"); el.value = Math.round(Math.min(+el.max, Math.max(+el.min, v))); syncBrush(); hover = hover || [cam.x, cam.y]; schedule(); }
  var KEY_TOOLS = { v: "move", h: "pan", w: "wand", k: "keep", x: "rmv", e: "erase", r: "restore", g: "paint", u: "unpaint", p: "pop", b: "unpop", o: "select" };
  var SHIFT_TOOLS = { e: "rerase", r: "rrestore" };
  var ARROWS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  document.addEventListener("keydown", function (e) {
    var el = document.activeElement, key = e.key || "";
    if (inField(e.target) || inField(el)) return;
    if (e.ctrlKey || e.metaKey) {
      if (e.altKey) return;
      var k = key.toLowerCase();
      if (k === "z" && !e.shiftKey) { e.preventDefault(); doUndo(); }
      else if ((k === "z" && e.shiftKey) || k === "y") { e.preventDefault(); doRedo(); }
      return;
    }
    if (e.altKey) return;
    var onCanvas = el === pv, free = onCanvas || !el || el === document.body;
    if (key === "Escape") {
      if (picking) { stopPicking(); say("Color pick canceled."); }
      else if (tool === "select" && sel >= 0) { sel = -1; syncObjForm(); schedule(); }
      else if (tool !== "move") setTool("move");
      return;
    }
    if ((key === "Delete" || key === "Backspace") && tool === "select" && sel >= 0 && (free || el.tagName === "BUTTON")) { e.preventDefault(); deleteObject(); return; }
    if (key === " ") {
      if (!free) return;
      e.preventDefault();
      if (!spaceDown) { spaceDown = true; pv.classList.add("panning"); schedule(); }
      return;
    }
    if (ARROWS[key]) {
      if (!onCanvas) return;
      e.preventDefault(); var step = e.shiftKey ? 10 : 1; nudge(ARROWS[key][0] * step, ARROWS[key][1] * step); return;
    }
    var lk = key.toLowerCase();
    if (key === "+" || key === "=") setCam(cam.z * 1.25);
    else if (key === "-" || key === "_") setCam(cam.z / 1.25);
    else if (key === "0") setCam(1);
    else if (key === "[") setBrush(+$("brush").value / 1.2);
    else if (key === "]") setBrush(+$("brush").value * 1.2);
    else if (e.shiftKey && SHIFT_TOOLS[lk] && (free || el.tagName === "BUTTON")) setTool(SHIFT_TOOLS[lk]);
    else if (KEY_TOOLS[lk] && !e.shiftKey && (free || el.tagName === "BUTTON")) setTool(KEY_TOOLS[lk]);
    else return;
    e.preventDefault();
  });
  function spaceUp() { if (spaceDown) { spaceDown = false; pv.classList.remove("panning"); schedule(); } }
  document.addEventListener("keyup", function (e) { if (e.key === " ") spaceUp(); });
  window.addEventListener("blur", spaceUp);

  // ---------- controls ----------
  function say(t) { $("status").textContent = t; }
  var ZOOM_HINT = " Scroll or pinch to zoom the view; hold Space and drag to pan it.";
  var HINTS = {
    move: "Drag to move the picture. Scroll, pinch or use Picture size to resize it; Ctrl + scroll zooms the view.",
    pan: "Drag to pan the view. Scroll or pinch to zoom it. The token itself doesn't change.",
    wand: "Tap a patch of background to remove it. Tolerance sets how alike the colors must be." + ZOOM_HINT,
    keep: "Smart select: draw a rough stroke over the figure to keep. Then use Remove on the background; the edge is found for you." + ZOOM_HINT,
    rmv: "Smart select: draw a rough stroke over the background to remove. Add Keep strokes over anything it takes by mistake." + ZOOM_HINT,
    erase: "Paint to remove parts. Affects picks the picture, the ring or both." + ZOOM_HINT,
    restore: "Paint to bring removed parts back. Affects picks the picture, the ring or both." + ZOOM_HINT,
    paint: "Paint the backdrop over the parts of the picture you don't want. Nothing is deleted; Unpaint brings it back." + ZOOM_HINT,
    unpaint: "Paint to bring the picture back where the backdrop covers it." + ZOOM_HINT,
    pop: "Paint over the parts that should sit in front of the ring: a hat, a horn, a sword tip." + ZOOM_HINT,
    unpop: "Paint to send parts back behind the ring." + ZOOM_HINT,
    rerase: "Paint to erase pieces of the ring; erased parts are see-through." + ZOOM_HINT,
    rrestore: "Paint to bring erased parts of the ring back." + ZOOM_HINT,
    select: "Tap an object to select it, then drag it, resize it with the corner handle or turn it with the round handle. Arrow keys nudge it."
  };
  function hint() {
    if (!src && tool !== "select" && tool !== "rerase" && tool !== "rrestore") { say("Choose a picture to start, or try the sample."); return; }
    say(tool === "move" && L.imgXform ? "The picture's size and position are locked, so dragging pans the view. Scroll or pinch to zoom it." : HINTS[tool]);
  }
  function setTool(t, quiet) {
    stopPicking();
    tool = t; var mode = TOOL_MODE[t]; lastTool[mode] = t;
    each("#tools .pill", function (b) { b.setAttribute("aria-pressed", String(b.dataset.tool === t)); b.classList.toggle("tc-hidden", b.dataset.mode !== mode); });
    each("#modes .pill", function (b) { b.setAttribute("aria-pressed", String(b.dataset.mode === mode)); });
    pv.classList.toggle("brush", t !== "move" && t !== "pan" && t !== "select");
    pv.classList.toggle("objtool", t === "select");
    $("brushRow").classList.toggle("tc-hidden", !isBrush(t));
    $("affectsRow").classList.toggle("tc-hidden", t !== "erase" && t !== "restore");
    $("softRow").classList.toggle("tc-hidden", t !== "paint" && t !== "unpaint");
    $("strengthRow").classList.toggle("tc-hidden", t !== "paint" && t !== "unpaint");
    $("smartRow").classList.toggle("tc-hidden", t !== "keep" && t !== "rmv");
    if (!quiet) hint();
    if ((t === "paint" || t === "unpaint") && S.fillType === "none" && !quiet) say("Fill is set to None, so painted backdrop is see-through. Pick a color or a texture in the Background section.");
    schedule();
  }
  each("#tools .pill", function (b) { b.addEventListener("click", function () { setTool(b.dataset.tool); }); });
  each("#modes .pill", function (b) { b.addEventListener("click", function () { setTool(lastTool[b.dataset.mode]); }); });
  function syncAffects() { each("#affects .pill", function (b) { b.setAttribute("aria-pressed", String(b.dataset.aff === S.affects)); }); }
  each("#affects .pill", function (b) { b.addEventListener("click", function () { S.affects = b.dataset.aff; persist(); syncAffects(); schedule(); }); });
  function syncSize() { $("picSize").value = img.zoom; $("picSizeOut").textContent = Math.round(img.zoom * 100) + "%"; }
  $("picSize").addEventListener("pointerdown", function () { pushUndo("xform"); });
  $("picSize").addEventListener("keydown", function (e) { if (/^(Arrow|Page|Home|End)/.test(e.key)) pushUndo("xform", true); });
  $("picSize").addEventListener("input", function (e) { if (L.imgXform) { syncSize(); return; } zoomAbout(+e.target.value, [C, C]); schedule(); });
  function syncBrush() { var v = +$("brush").value; $("brushOut").textContent = (Math.round(v * 2000 / M) / 10) + "%"; }
  $("brush").addEventListener("input", function () { syncBrush(); hover = [cam.x, cam.y]; schedule(); });
  syncBrush();
  $("viewZoom").addEventListener("input", function (e) { setCam(+e.target.value); });
  $("viewMinus").addEventListener("click", function () { setCam(cam.z / 1.25); });
  $("viewPlus").addEventListener("click", function () { setCam(cam.z * 1.25); });
  $("viewFit").addEventListener("click", function () { setCam(1); });
  $("undo").addEventListener("click", doUndo);
  $("redo").addEventListener("click", doRedo);
  $("playAnim").addEventListener("click", function () { setPlaying(!playing); });
  $("flip").addEventListener("click", function () { if (!src || L.imgXform) return; pushUndo("xform"); img.flip = !img.flip; img.x = -img.x; subjDirty = true; schedule(); });
  $("center").addEventListener("click", function () { if (!src || L.imgXform) return; pushUndo("xform"); img.x = 0; img.y = 0; img.zoom = 1; syncSize(); schedule(); });

  // locks and layers (this token only, never stored in the browser)
  var RING_CTRLS = ["noRing", "thick", "rsize", "ringColor", "pickRing", "tint", "ringGlow", "ringFlicker", "sideMark", "inner", "bevel", "clearRingMask", "randomRing"];
  var BACKDROP_CTRLS = ["fillType", "fill1", "fill2", "texScale", "texTint", "texVig", "texShuffle", "coverRemoved", "clearCover"];
  function setLockBtn(id, on, what) {
    var b = $(id); if (!b) return; b.setAttribute("aria-pressed", String(on));
    b.innerHTML = on ? "&#128274; Locked" : "&#128275; Lock";
    b.setAttribute("aria-label", (on ? "Unlock " : "Lock ") + what); b.title = on ? "Locked. Click to unlock." : "Lock " + what;
  }
  function syncLocks() {
    RING_CTRLS.forEach(function (id) { $(id).disabled = L.ring; });
    each("#rings .tc-ring, #sides .pill, #shapes .pill, #templates .tc-ring", function (b) { b.disabled = L.ring; });
    BACKDROP_CTRLS.forEach(function (id) { $(id).disabled = L.backdrop; });
    each("#textures .tc-ring, #fillColors .tc-drop", function (b) { b.disabled = L.backdrop; });
    ["picSize", "flip", "center"].forEach(function (id) { $(id).disabled = L.imgXform; });
    ["autoBg", "refine", "resetCut"].forEach(function (id) { $(id).disabled = pictureLocked(); });
    setLockBtn("lockRing", L.ring, "the ring"); setLockBtn("lockImg", L.imgXform, "the picture's size and position"); setLockBtn("lockBackdrop", L.backdrop, "the backdrop");
    if (L.ring && picking && picking.id === "pickRing") stopPicking();
    renderLayers();
  }
  function lockClick(e, key, onMsg, offMsg) { e.stopPropagation(); L[key] = !L[key]; syncLocks(); say(L[key] ? onMsg : offMsg); }
  $("lockRing").addEventListener("click", function (e) { lockClick(e, "ring", "The ring is locked: its style, size, color and side stay as they are, and it can't be erased.", "The ring is unlocked."); });
  $("lockImg").addEventListener("click", function (e) {
    lockClick(e, "imgXform", "The picture's size and position are locked. Dragging in the Picture tool now pans the view.", "The picture can be moved and resized again.");
  });
  $("lockBackdrop").addEventListener("click", function (e) { lockClick(e, "backdrop", "The backdrop is locked: the fill, texture and painted backdrop stay as they are.", "The backdrop is unlocked."); });
  // The Layers strip: one row per layer, bottom of the list is the bottom of the token. Eyes hide a layer in the preview and the download.
  var LAYERS = [
    { id: "objects", label: "Text, badges and objects", eye: "objects", lock: "objects" },
    { id: "pop", label: "Pop-out", eye: "pop" },
    { id: "ring", label: "Ring", eye: "ring", lock: "ring", note: function () { return L.ring ? "Locked: style, size and color can't change, and it can't be erased" : ""; } },
    { id: "cut", label: "Picture: cut-out", lock: "cut" },
    { id: "xform", label: "Picture: size and position", lock: "imgXform" },
    { id: "cover", label: "Painted backdrop", eye: "cover", note: function () { return "Covers the picture; hide it to see the whole photo again"; } },
    { id: "backdrop", label: "Backdrop: fill or texture", eye: "backdrop", lock: "backdrop" }
  ];
  function iconBtn(txt, pressed, label, onClick, cls) {
    var b = document.createElement("button"); b.type = "button"; b.className = "tc-ic" + (cls ? " " + cls : ""); b.innerHTML = txt;
    b.setAttribute("aria-pressed", String(pressed)); b.setAttribute("aria-label", label); b.title = label; b.addEventListener("click", onClick); return b;
  }
  function renderLayers() {
    var box = $("layerRows"); if (!box) return;
    var focusId = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.lay : null;
    box.innerHTML = "";
    LAYERS.forEach(function (ly) {
      if (ly.id === "cut" && splitLock) {
        [["imgOut", "Picture: outside the ring"], ["imgIn", "Picture: inside the ring"]].forEach(function (pr) {
          var row = document.createElement("div"); row.className = "tc-layer"; var sp = document.createElement("span"); sp.textContent = pr[1]; row.appendChild(sp);
          row.appendChild(iconBtn("&#128065;", false, "", function () {}, "tc-ghost"));
          var lb = iconBtn(L[pr[0]] ? "&#128274;" : "&#128275;", L[pr[0]], (L[pr[0]] ? "Unlock " : "Lock ") + pr[1].toLowerCase(), function () { L[pr[0]] = !L[pr[0]]; syncLocks(); say(L[pr[0]] ? pr[1] + " is locked: brushes and removal tools leave it alone." : pr[1] + " is unlocked."); });
          lb.dataset.lay = pr[0]; row.appendChild(lb); box.appendChild(row);
        });
        return;
      }
      var row = document.createElement("div"); row.className = "tc-layer";
      var sp = document.createElement("span"); sp.textContent = ly.label;
      var note = ly.note ? ly.note() : ""; if (note) { var sm = document.createElement("small"); sm.textContent = note; sp.appendChild(sm); }
      row.appendChild(sp);
      if (ly.eye) {
        var eb = iconBtn(V[ly.eye] ? "&#128065;" : "&#8212;", V[ly.eye], (V[ly.eye] ? "Hide " : "Show ") + ly.label.toLowerCase(), function () { V[ly.eye] = !V[ly.eye]; if (ly.eye === "cover") subjDirty = true; renderLayers(); schedule(); }, V[ly.eye] ? "" : "tc-off");
        eb.dataset.lay = "eye-" + ly.id; row.appendChild(eb);
      } else row.appendChild(iconBtn("&#128065;", false, "", function () {}, "tc-ghost"));
      if (ly.lock) {
        var on = ly.lock === "cut" ? pictureLocked() : L[ly.lock];
        var lb = iconBtn(on ? "&#128274;" : "&#128275;", on, (on ? "Unlock " : "Lock ") + ly.label.toLowerCase(), function () {
          if (ly.lock === "cut") { var v = !pictureLocked(); L.imgIn = v; L.imgOut = v; } else L[ly.lock] = !L[ly.lock];
          syncLocks();
          var now = ly.lock === "cut" ? pictureLocked() : L[ly.lock];
          say(now ? ly.label + " is locked." + (ly.lock === "cut" ? " Erase with Affects set to Ring or Both now changes only the ring." : "") : ly.label + " is unlocked.");
        });
        lb.dataset.lay = "lock-" + ly.id; row.appendChild(lb);
      } else row.appendChild(iconBtn("&#128275;", false, "", function () {}, "tc-ghost"));
      box.appendChild(row);
    });
    var sp2 = document.createElement("div"); sp2.className = "tc-layer-split";
    var lab = document.createElement("label"); lab.className = "tc-check"; var cb = document.createElement("input"); cb.type = "checkbox"; cb.checked = splitLock; cb.id = "splitLock";
    cb.addEventListener("change", function () { splitLock = cb.checked; if (!splitLock && L.imgIn !== L.imgOut) { L.imgIn = L.imgOut = false; } syncLocks(); });
    lab.appendChild(cb); lab.appendChild(document.createTextNode(" Lock the picture inside and outside the ring separately")); sp2.appendChild(lab); box.appendChild(sp2);
    if (focusId) { var fb = box.querySelector('[data-lay="' + focusId + '"]'); if (fb) fb.focus(); }
  }

  var stageEl = stage;
  $("file").addEventListener("change", function (e) { loadFile(e.target.files && e.target.files[0]); e.target.value = ""; });
  $("loadFile").addEventListener("change", function (e) { var f = e.target.files && e.target.files[0]; if (f) openProject(f); e.target.value = ""; });
  $("sample").addEventListener("click", sample);
  stageEl.addEventListener("dragover", function (e) { e.preventDefault(); stageEl.classList.add("dragover"); });
  stageEl.addEventListener("dragleave", function () { stageEl.classList.remove("dragover"); });
  stageEl.addEventListener("drop", function (e) { e.preventDefault(); stageEl.classList.remove("dragover"); loadFile(e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]); });
  window.addEventListener("paste", function (e) {
    if (inField(e.target)) return;
    var items = (e.clipboardData && e.clipboardData.items) || [];
    for (var i = 0; i < items.length; i++) if (items[i].type && items[i].type.indexOf("image/") === 0) { loadFile(items[i].getAsFile()); e.preventDefault(); return; }
  });

  // ring picker
  var dpr = Math.min(2, window.devicePixelRatio || 1), TH = Math.round(46 * dpr);
  function thumb(st) {
    syncR();
    var s = shp(), r1 = (TH / 2 - 1) * s.fit, cy = TH / 2 + (TH / 2 - 1) * s.oy;
    return paintRing(TH, Math.max(r1 * 0.35, r1 - TH * 0.17), r1, st, hex(S.ringColor), S.tint, 0, { shape: s, cx: TH / 2, cy: cy });
  }
  function pillsInto(box, items, pressed, onPick) {
    box.innerHTML = "";
    items.forEach(function (it) {
      var b = document.createElement("button"); b.type = "button"; b.className = "pill"; b.textContent = it[1]; b.dataset.id = it[0];
      b.setAttribute("aria-pressed", String(it[0] === pressed)); b.addEventListener("click", function () { onPick(it[0]); }); box.appendChild(b);
    });
  }
  function renderGames() {
    pillsInto($("games"), GAMES, S.game, function (g) {
      S.game = g;
      if (g === "scifi" && FAM_GAME[S.fam] !== "scifi") S.fam = "Tech";
      if (famsShown().indexOf(S.fam) < 0) S.fam = famsShown()[0];
      persist(); renderGames(); renderFams(); renderRings(); renderTextures(); renderFonts();
    });
  }
  function renderFams() {
    pillsInto($("fams"), famsShown().map(function (f) { return [f, FAM_LABEL[f]]; }), S.fam, function (f) { S.fam = f; persist(); renderFams(); renderRings(); });
  }
  function renderShapes() {
    pillsInto($("shapes"), K.SHAPES.map(function (s) { return [s.id, s.label]; }), S.shape, function (id) {
      if (L.ring) return;
      S.shape = id; persist(); renderShapes(); renderRings(); syncLocks(); schedule();
      if (id !== "circle") say(K.shapeById(id).label + " token. The bot's battle maps show tokens as circles; this shape is for other tabletops and grid maps.");
    });
    each("#shapes .pill", function (b) { b.disabled = L.ring; });
  }
  function selectStyle(id) {
    if (L.ring) return;
    var st = styleById(id); if (!st) return;
    S.style = id; S.noRing = false; $("noRing").checked = false;
    if (st.glow && S.rsize > 0.96) { S.rsize = 0.94; $("rsize").value = S.rsize; $("rsizeOut").textContent = pct(S.rsize); say("Ring size set to 94% so the glow has room around the ring."); }
    persist(); markRings(); schedule();
  }
  function renderRings() {
    var box = $("rings"); box.innerHTML = "";
    STYLES.filter(function (st) { return st.fam === S.fam; }).forEach(function (st) {
      var b = document.createElement("button"); b.type = "button"; b.className = "tc-ring"; b.dataset.id = st.id; b.disabled = L.ring;
      b.setAttribute("aria-pressed", String(st.id === S.style && !S.noRing)); b.setAttribute("aria-label", FAM_LABEL[st.fam] + ": " + st.name + (st.anim ? " (animated)" : ""));
      var cv = thumb(st); b.appendChild(cv); var s = document.createElement("span"); s.textContent = st.name + (st.anim ? " ▶" : ""); b.appendChild(s);
      b.addEventListener("click", function () { selectStyle(st.id); });
      box.appendChild(b);
    });
  }
  function markRings() { each("#rings .tc-ring", function (b) { b.setAttribute("aria-pressed", String(b.dataset.id === S.style && !S.noRing)); }); }
  var thumbTimer = 0;
  function refreshThumbs() { clearTimeout(thumbTimer); thumbTimer = setTimeout(renderRings, 120); }
  function renderSides() {
    var box = $("sides"); box.innerHTML = "";
    SIDES.forEach(function (sd) {
      var b = document.createElement("button"); b.type = "button"; b.className = "pill"; b.dataset.side = sd.id; b.dataset.color = sd.color; b.disabled = L.ring;
      b.setAttribute("aria-pressed", String(S.side === sd.id));
      var i = document.createElement("i"); i.style.background = sd.color; b.appendChild(i); b.appendChild(document.createTextNode(sd.label));
      b.addEventListener("click", function () {
        if (L.ring) return;
        if (S.side === sd.id) { S.side = ""; persist(); renderSides(); schedule(); return; }
        S.side = sd.id; S.ringColor = sd.color; S.tint = true; $("ringColor").value = sd.color; $("tint").checked = true;
        persist(); renderSides(); renderRings(); schedule();
        say(sd.label + " colors set. Tick the side mark for a " + sd.mark + " on the ring as well.");
      });
      box.appendChild(b);
    });
  }
  // texture picker (same Fantasy / Sci-fi / All filter as the rings)
  function renderTextures() {
    var box = $("textures"); box.innerHTML = "";
    TX.TEXTURES.filter(function (t) { return S.game === "all" || (S.game === "fantasy" ? t.group === "Fantasy" : t.group === "Sci-fi"); }).forEach(function (t) {
      var b = document.createElement("button"); b.type = "button"; b.className = "tc-ring"; b.dataset.id = t.id; b.disabled = L.backdrop;
      b.setAttribute("aria-pressed", String(S.fillType === "texture" && S.tex === t.id)); b.setAttribute("aria-label", t.group + " texture: " + t.name);
      var cv = TX.paintTexture(t.id, TH, { seed: S.texSeed, scale: 1, tint: hex(S.fill1), tintAmt: S.texTint, vignette: 0 });
      b.appendChild(cv); var s = document.createElement("span"); s.textContent = t.name; b.appendChild(s);
      b.addEventListener("click", function () { if (L.backdrop) return; S.tex = t.id; S.fillType = "texture"; $("fillType").value = "texture"; syncFill(); persist(); markTextures(); schedule(); });
      box.appendChild(b);
    });
  }
  function markTextures() { each("#textures .tc-ring", function (b) { b.setAttribute("aria-pressed", String(S.fillType === "texture" && b.dataset.id === S.tex)); }); }

  function bindRange(id, key, fmt, opts) {
    var el = $(id), out = $(id + "Out");
    el.value = S[key]; if (out) out.textContent = fmt(S[key]);
    el.addEventListener("input", function () { if (el.disabled) return; S[key] = +el.value; if (out) out.textContent = fmt(S[key]); if (opts && opts.draft) draft = true; if (opts && opts.line) lineActive = 1; if (opts && opts.subj) subjDirty = true; schedule(); });
    el.addEventListener("change", function () { draft = false; persist(); if (opts && opts.thumbs) { refreshThumbs(); renderTemplates(); } if (opts && opts.subj) subjDirty = true; if (opts && opts.line) setTimeout(function () { lineActive = 0; schedule(); }, 1200); schedule(); });
  }
  function pct(v) { return Math.round(v * 100) + "%"; }
  var RANGES = [
    ["thick", "thick", function (v) { return Math.round(v * 200) + "%"; }, { draft: true }], ["rsize", "rsize", pct, { draft: true }],
    ["tol", "tol", function (v) { return String(v); }], ["edgeSoft", "edgeSoft", function (v) { return String(v); }, { subj: true }],
    ["shrink", "shrink", function (v) { return v + " px"; }, { subj: true }], ["popLine", "popLine", pct, { line: true }], ["inner", "inner", pct], ["bevel", "bevel", pct],
    ["ringGlow", "ringGlow", pct, { draft: true, thumbs: true }], ["texScale", "texScale", pct, { draft: true }], ["texTint", "texTint", pct, { draft: true }], ["texVig", "texVig", pct, { draft: true }],
    ["brushSoft", "brushSoft", pct], ["brushStrength", "brushStrength", pct],
    ["textSize", "textSize", pct], ["textTrack", "textTrack", pct], ["textStrokeW", "textStrokeW", pct]
  ];
  RANGES.forEach(function (r) { bindRange(r[0], r[1], r[2], r[3]); });
  function bindCheck(id, key, after) { var el = $(id); el.checked = S[key]; el.addEventListener("change", function () { S[key] = el.checked; persist(); if (after) after(); schedule(); }); }
  bindCheck("noRing", "noRing", markRings);
  bindCheck("tint", "tint", renderRings);
  bindCheck("contig", "contig");
  bindCheck("clean", "clean");
  bindCheck("despill", "despill", function () { subjDirty = true; });
  bindCheck("popTop", "popTop", function () { lineActive = 1; setTimeout(function () { lineActive = 0; schedule(); }, 1500); });
  bindCheck("popShadow", "popShadow");
  bindCheck("sideMark", "sideMark", function () { if (S.sideMark && !S.side) say("Pick a side first: Player, Ally, Enemy or Neutral."); });
  bindCheck("dropShadow", "dropShadow");
  bindCheck("textUnderPop", "textUnderPop");
  $("ringColor").value = S.ringColor;
  $("ringColor").addEventListener("input", function (e) { if (L.ring) return; S.ringColor = e.target.value; refreshThumbs(); schedule(); });
  $("ringColor").addEventListener("change", function () { persist(); });
  function syncFill() {
    $("fillColors").classList.toggle("tc-hidden", S.fillType === "none");
    $("fill2Wrap").classList.toggle("tc-hidden", S.fillType === "solid" || S.fillType === "none" || S.fillType === "texture");
    $("texBox").classList.toggle("tc-hidden", S.fillType !== "texture");
    markTextures();
  }
  $("fillType").value = S.fillType; syncFill();
  $("fillType").addEventListener("change", function (e) { if (L.backdrop) { e.target.value = S.fillType; return; } S.fillType = e.target.value; syncFill(); persist(); schedule(); });
  ["fill1", "fill2"].forEach(function (id) {
    $(id).value = S[id];
    $(id).addEventListener("input", function (e) { if (L.backdrop) return; S[id] = e.target.value; schedule(); });
    $(id).addEventListener("change", function () { persist(); if (id === "fill1" && S.texTint > 0) renderTextures(); });
  });
  $("texShuffle").addEventListener("click", function () { if (L.backdrop) return; S.texSeed = (S.texSeed % 997) + 1 + Math.floor(Math.random() * 50); persist(); renderTextures(); schedule(); });
  $("smartTo").value = S.smartTo;
  $("smartTo").addEventListener("change", function (e) { S.smartTo = e.target.value; persist(); });
  each(".tc-drop", function (b) { b.addEventListener("click", function () { startPicking(b); }); });
  // picture adjustments
  [["fBright", "bright"], ["fContrast", "contrast"], ["fSat", "sat"]].forEach(function (pr) {
    $(pr[0]).addEventListener("input", function (e) { F[pr[1]] = +e.target.value; syncFilters(); applyFilters(); schedule(); });
  });
  [["fGray", "gray"], ["fSepia", "sepia"]].forEach(function (pr) { $(pr[0]).addEventListener("change", function (e) { F[pr[1]] = e.target.checked; syncFilters(); applyFilters(); schedule(); }); });
  $("fDefeated").addEventListener("click", function () { F = { bright: -18, contrast: -12, sat: 100, gray: true, sepia: false }; syncFilters(); applyFilters(); schedule(); });
  $("fReset").addEventListener("click", function () { F = { bright: 0, contrast: 0, sat: 100, gray: false, sepia: false }; syncFilters(); applyFilters(); schedule(); });
  syncFilters();
  $("autoBg").addEventListener("click", autoBackground);
  $("aiBtn").addEventListener("click", aiRemove);
  $("refine").addEventListener("click", refineEdge);
  $("smartClear").addEventListener("click", function () { if (!strokes.length) return; pushUndo("smart"); strokes = []; say("Strokes cleared. The cut stays as it is."); schedule(); });
  $("resetCut").addEventListener("click", function () {
    if (!src || !hasCut) return;
    if (pictureLocked()) { say("The cut-out is locked. Unlock it in Layers and locks."); return; }
    pushUndo(["cut", "smart"]); guardCut(function () { cutG.fillStyle = "#fff"; cutG.fillRect(0, 0, sw, sh); }); hasCut = anyBelow(alphaOf(cut), 255); strokes = []; subjDirty = true;
    say("The whole picture is back. The painted backdrop is kept; clear it in the Background section."); schedule();
  });
  $("coverRemoved").addEventListener("click", function () {
    if (!src || !hasCut) { say("Nothing has been removed yet."); return; }
    if (L.backdrop) { say("The backdrop is locked. Unlock it in the Background section."); return; }
    if (pictureLocked()) { say("The cut-out is locked. Unlock it in Layers and locks."); return; }
    pushUndo(["cut", "cover"]);
    var a = alphaOf(cut), cv = alphaOf(cover);
    for (var i = 0; i < a.length; i++) cv[i] = Math.max(cv[i], 255 - a[i]);
    putAlpha(cover, cv); hasCover = true; cutG.fillStyle = "#fff"; cutG.fillRect(0, 0, sw, sh); hasCut = false; subjDirty = true;
    say(S.fillType === "none" ? "Done: the removed parts are now painted backdrop. Fill is None, so they stay see-through until you pick a color or texture." : "Done: the removed parts are now painted backdrop, and the whole photo is kept underneath.");
    schedule();
  });
  $("clearCover").addEventListener("click", function () {
    if (!hasCover) return;
    if (L.backdrop) { say("The backdrop is locked. Unlock it in the Background section."); return; }
    pushUndo("cover"); coverG.clearRect(0, 0, sw, sh); hasCover = false; subjDirty = true; say("Painted backdrop cleared."); schedule();
  });
  $("clearPop").addEventListener("click", function () { if (!hasPop && !S.popTop) return; if (hasPop) pushUndo("pop"); popG.clearRect(0, 0, M, M); hasPop = false; S.popTop = false; $("popTop").checked = false; persist(); schedule(); });
  $("clearRingMask").addEventListener("click", function () { if (!hasRingMask || L.ring) return; pushUndo("ring"); ringMaskG.clearRect(0, 0, M, M); hasRingMask = false; say("The whole ring is back."); schedule(); });
  each(".tc-dl [data-size]", function (b) { b.addEventListener("click", function () { exportPng(+b.dataset.size); }); });
  $("dlCreature").addEventListener("click", function () { exportPng(+$("creature").value); });
  if (canCopy) $("copyImg").addEventListener("click", copyImage); else $("copyImg").classList.add("tc-hidden");
  if (EX.supportsWebp()) { $("dlWebp").classList.remove("tc-hidden"); $("dlWebp").addEventListener("click", exportWebp); }
  $("batchZip").addEventListener("click", batchZip);
  $("dlApng").addEventListener("click", function () { exportAnim("apng"); });
  $("dlGif").addEventListener("click", function () { exportAnim("gif"); });
  $("ringFlicker").value = S.ringFlicker;
  $("ringFlicker").addEventListener("change", function (e) { if (L.ring) { e.target.value = S.ringFlicker; return; } S.ringFlicker = e.target.value; syncR(); ringFrames = { key: "", f: {} }; persist(); schedule(); });
  $("animLen").value = String(S.animLen);
  $("animLen").addEventListener("change", function (e) { S.animLen = +e.target.value; syncR(); ringFrames = { key: "", f: {} }; persist(); tick(); });
  $("saveProject").addEventListener("click", function () {
    if (!src) { say("Choose a picture first, or save a ring preset."); return; }
    saveJson(projectData(), fileBase + ".tgtoken.json"); say("Saved " + fileBase + ".tgtoken.json. Open it here later to carry on.");
  });
  $("savePreset").addEventListener("click", function () { saveJson(presetData(), "ring-preset.tgtoken.json"); say("Saved ring-preset.tgtoken.json (settings only)."); });

  // ---------- lettering, badges and objects ----------
  function renderFonts() {
    [["font", S.font], ["objFont", sel >= 0 && CT.objs[sel] ? CT.objs[sel].font : S.font]].forEach(function (pr) {
      var el = $(pr[0]); el.innerHTML = "";
      OB.FONTS.forEach(function (f) { var o = document.createElement("option"); o.value = f.id; o.textContent = f.label; o.style.fontFamily = "'" + f.id + "', " + f.fb; el.appendChild(o); });
      el.value = pr[1];
    });
  }
  OB.setFontReady(function (id, ok) {
    if (!ok && (id === S.font || CT.objs.some(function (O) { return O.font === id; }))) say("The " + id + " font couldn't load (offline?), so a system font stands in.");
    schedule();
  });
  function fillClocks() {
    each(".tc-clock", function (el) { el.innerHTML = ""; for (var h = 1; h <= 12; h++) { var o = document.createElement("option"); o.value = String(h); o.textContent = h + " o'clock"; el.appendChild(o); } });
  }
  function syncContent() {
    $("txtTop").value = CT.top; $("txtBottom").value = CT.bottom;
    $("badgeText").value = CT.badge.text; $("badgeShape").value = CT.badge.shape; $("badgeColor").value = CT.badge.color; $("badgeClock").value = String(CT.badge.clock);
    each("#markKind .pill", function (b) { b.setAttribute("aria-pressed", String(b.dataset.mark === CT.mark.kind)); });
    $("markClock").value = String(CT.mark.clock); $("pipKind").value = CT.pip.color; $("pipLabel").value = CT.pip.label; $("pipClock").value = String(CT.pip.clock);
    syncObjForm();
  }
  function contentEdit(fn, coalesce) { if (L.objects) { say("Lettering and objects are locked. Unlock them in Layers and locks."); syncContent(); return; } pushUndo("obj", coalesce); fn(); schedule(); }
  function textField(id, setter) {
    var el = $(id);
    el.addEventListener("input", function () { contentEdit(function () { setter(el.value); }, true); var f = S.font; OB.ensureFont(f); });
  }
  textField("txtTop", function (v) { CT.top = v; });
  textField("txtBottom", function (v) { CT.bottom = v; });
  textField("badgeText", function (v) { CT.badge.text = v.trim(); });
  textField("pipLabel", function (v) { CT.pip.label = v.trim(); });
  [["badgeShape", function (v) { CT.badge.shape = v; }], ["badgeClock", function (v) { CT.badge.clock = +v; }], ["markClock", function (v) { CT.mark.clock = +v; }],
   ["pipKind", function (v) { CT.pip.color = v; }], ["pipClock", function (v) { CT.pip.clock = +v; }]].forEach(function (pr) {
    $(pr[0]).addEventListener("change", function (e) { contentEdit(function () { pr[1](e.target.value); }); });
  });
  $("badgeColor").addEventListener("input", function (e) { contentEdit(function () { CT.badge.color = e.target.value; }, true); });
  each("#markKind .pill", function (b) { b.addEventListener("click", function () { contentEdit(function () { CT.mark.kind = b.dataset.mark; }); syncContent(); }); });
  $("font").addEventListener("change", function (e) { S.font = e.target.value; persist(); say("Loading " + S.font + "..."); OB.ensureFont(S.font).then(function (ok) { if (ok) say(S.font + " is ready."); schedule(); }); schedule(); });
  function syncWhere() { each("#textWhere .pill", function (b) { b.setAttribute("aria-pressed", String(b.dataset.where === S.textWhere)); }); }
  each("#textWhere .pill", function (b) { b.addEventListener("click", function () { S.textWhere = b.dataset.where; persist(); syncWhere(); schedule(); if (S.textWhere === "outside" && S.rsize > 0.9) say("Lower the Ring size to make room for lettering outside the ring."); }); });
  ["textFill", "textStroke"].forEach(function (id) { $(id).value = S[id]; $(id).addEventListener("input", function (e) { S[id] = e.target.value; schedule(); }); $(id).addEventListener("change", persist); });
  // placeable objects
  var OBJ_DEFAULTS = {
    ribbon: { w: 0.62, h: 0.11, color: "#8a2b2b", trim: "#e2c36b", font: "Cinzel", textColor: "#fff3d6", bend: 0.15, text: "Name" },
    scroll: { w: 0.6, h: 0.13, color: "#efe0b8", font: "IM Fell English SC", textColor: "#3a2510", text: "Name" },
    plaque: { w: 0.5, h: 0.12, color: "#d6a640", font: "Cinzel", textColor: "#2e1e04", text: "Name" },
    nameplate: { w: 0.56, h: 0.11, color: "#3ff6ff", font: "Orbitron", textColor: "#e8fbff", text: "UNIT-07" },
    neon: { w: 0.6, h: 0.2, color: "#3ff6ff", font: "Neonderthaw", textColor: "#ffffff", text: "Neon", neon: { color: "#3ff6ff", plate: true, border: false, flicker: "strong", glow: 1 } }
  };
  function addObject(style) {
    if (L.objects) { say("The objects are locked. Unlock them in Layers and locks."); return; }
    var d = JSON.parse(JSON.stringify(OBJ_DEFAULTS[style]));
    var O = { type: "banner", style: style, x: C, y: style === "neon" ? M * 0.2 : M * 0.84, w: d.w * M, h: d.h * M, rot: 0, bend: d.bend || 0, color: d.color, trim: d.trim || "#e2c36b",
      text: d.text, font: d.font, textColor: d.textColor, neon: d.neon || null };
    pushUndo("obj"); CT.objs.push(O); sel = CT.objs.length - 1; OB.ensureFont(O.font);
    setTool("select", true); syncObjForm(); tick(); schedule();
    say("Added a " + (style === "ribbon" ? "banner" : style === "neon" ? "neon sign" : style) + ". Drag it into place; type its text in the Text and objects section.");
  }
  each("#addObjs [data-add]", function (b) { b.addEventListener("click", function () { addObject(b.dataset.add); }); });
  function syncObjForm() {
    var O = sel >= 0 ? CT.objs[sel] : null;
    $("objForm").classList.toggle("tc-hidden", !O);
    if (!O) { schedule(); return; }
    $("objText").value = O.text || ""; renderFonts(); $("objFont").value = O.font;
    $("objColor").value = O.style === "neon" ? (O.neon.color) : O.color; $("objTextColor").value = O.textColor || "#ffffff";
    $("objTextColorWrap").classList.toggle("tc-hidden", O.style === "neon");
    $("objBendRow").classList.toggle("tc-hidden", O.style !== "ribbon"); $("objBend").value = O.bend || 0; $("objBendOut").textContent = pct(O.bend || 0);
    $("neonForm").classList.toggle("tc-hidden", O.style !== "neon");
    if (O.style === "neon") {
      $("neonPlate").checked = O.neon.plate !== false; $("neonBorder").checked = !!O.neon.border; $("neonFlick").value = OB.neonMode(O.neon);
      var ng = typeof O.neon.glow === "number" ? O.neon.glow : 1; $("neonGlow").value = ng; $("neonGlowOut").textContent = pct(ng);
      each("#neonColors .pill", function (b) { b.setAttribute("aria-pressed", String(b.dataset.color === O.neon.color)); });
    }
    schedule();
  }
  function objEdit(fn, coalesce) { var O = CT.objs[sel]; if (!O) return; contentEdit(function () { fn(O); }, coalesce); }
  $("objText").addEventListener("input", function (e) { objEdit(function (O) { O.text = e.target.value; }, true); });
  $("objFont").addEventListener("change", function (e) { objEdit(function (O) { O.font = e.target.value; OB.ensureFont(O.font); }); });
  $("objColor").addEventListener("input", function (e) { objEdit(function (O) { if (O.style === "neon") O.neon.color = e.target.value; else O.color = e.target.value; }, true); });
  $("objTextColor").addEventListener("input", function (e) { objEdit(function (O) { O.textColor = e.target.value; }, true); });
  $("objBend").addEventListener("input", function (e) { $("objBendOut").textContent = pct(+e.target.value); objEdit(function (O) { O.bend = +e.target.value; }, true); });
  $("neonGlow").addEventListener("input", function (e) { $("neonGlowOut").textContent = pct(+e.target.value); objEdit(function (O) { O.neon.glow = +e.target.value; }, true); });
  $("neonFlick").addEventListener("change", function (e) { objEdit(function (O) { O.neon.flicker = e.target.value; }); tick(); });
  [["neonPlate", "plate"], ["neonBorder", "border"]].forEach(function (pr) {
    $(pr[0]).addEventListener("change", function (e) { objEdit(function (O) { O.neon[pr[1]] = e.target.checked; }); tick(); });
  });
  (function () {
    var box = $("neonColors");
    OB.NEON_COLORS.forEach(function (nc) {
      var b = document.createElement("button"); b.type = "button"; b.className = "pill"; b.dataset.color = nc[1]; b.style.color = nc[1];
      var i = document.createElement("i"); i.style.background = nc[1]; b.appendChild(i); var s = document.createElement("span"); s.style.color = "var(--text)"; s.textContent = nc[0]; b.appendChild(s);
      b.addEventListener("click", function () { objEdit(function (O) { O.neon.color = nc[1]; }); syncObjForm(); });
      box.appendChild(b);
    });
  }());
  function deleteObject() {
    if (sel < 0 || !CT.objs[sel]) return;
    if (L.objects) { say("The objects are locked. Unlock them in Layers and locks."); return; }
    pushUndo("obj"); CT.objs.splice(sel, 1); sel = -1; syncObjForm(); say("Object deleted. Undo brings it back."); schedule();
  }
  $("objDelete").addEventListener("click", deleteObject);
  $("objFront").addEventListener("click", function () { objEdit(function (O) { CT.objs.splice(sel, 1); CT.objs.push(O); sel = CT.objs.length - 1; }); });

  // ---------- templates and random ring ----------
  var TEMPLATES = [
    { name: "Knight", s: { style: "Metal:Silver", ringColor: "#3a7ae0", tint: false, shape: "circle", fillType: "radial", fill1: "#8fb3d9", fill2: "#1d2836", font: "Cinzel" } },
    { name: "Necromancer", s: { style: "Runes:Arcane", ringColor: "#6a3fa0", tint: false, shape: "circle", fillType: "texture", tex: "cave", texTint: 0.2, fill1: "#6a3fa0", font: "Pirata One" } },
    { name: "Druid", s: { style: "More:Vines", ringColor: "#4f7d2a", shape: "circle", fillType: "texture", tex: "forest", texTint: 0, font: "Uncial Antiqua" } },
    { name: "Goblin boss", s: { style: "Wood:Walnut", ringColor: "#c43e34", tint: false, shape: "circle", fillType: "texture", tex: "planks", font: "Pirata One" } },
    { name: "Dungeon foe", s: { style: "Stone:Blocks", ringColor: "#c43e34", shape: "square", fillType: "texture", tex: "tiles", font: "IM Fell English SC" } },
    { name: "Starship pilot", s: { style: "Tech:Hull plating", ringColor: "#3ff6ff", shape: "circle", fillType: "texture", tex: "starfield", font: "Orbitron" } },
    { name: "Drone", s: { style: "Tech:HUD reticle", ringColor: "#9dff3f", shape: "hexp", rsize: 0.95, fillType: "texture", tex: "hexgrid", texTint: 0, font: "Share Tech Mono" } },
    { name: "Alien", s: { style: "Energy:Plasma", ringColor: "#b04fff", shape: "hexf", rsize: 0.94, fillType: "texture", tex: "alien", font: "Audiowide" } },
    { name: "Cyber merc", s: { style: "Energy:Neon tube", ringColor: "#ff3fd8", shape: "oct", rsize: 0.94, fillType: "texture", tex: "circuit", font: "Rajdhani" } }
  ];
  function applyTemplate(T) {
    if (L.ring) { say("The ring is locked. Unlock it to use a template."); return; }
    var st = styleById(T.s.style);
    Object.keys(T.s).forEach(function (k) { if (L.backdrop && /^(fill|tex)/.test(k)) return; S[k] = T.s[k]; });
    if (st) { S.fam = st.fam; if (famsShown().indexOf(S.fam) < 0) S.game = "all"; }
    S.noRing = false; persist(); syncControls(); OB.ensureFont(S.font);
    say(T.name + " template applied. Your picture and masks are unchanged.");
  }
  function renderTemplates() {
    var box = $("templates"); box.innerHTML = "";
    TEMPLATES.forEach(function (T) {
      var b = document.createElement("button"); b.type = "button"; b.className = "tc-ring"; b.disabled = L.ring;
      var st = styleById(T.s.style), s = K.shapeById(T.s.shape || "circle"), r1 = (TH / 2 - 1) * s.fit;
      b.appendChild(paintRing(TH, r1 * 0.62, r1, st, hex(T.s.ringColor), !!T.s.tint, 0, { shape: s, cx: TH / 2, cy: TH / 2 + (TH / 2 - 1) * s.oy }));
      var sp = document.createElement("span"); sp.textContent = T.name; b.appendChild(sp);
      b.addEventListener("click", function () { applyTemplate(T); });
      box.appendChild(b);
    });
  }
  function randomRing() {
    if (L.ring) return;
    var R = rng((Math.random() * 1e9) | 0), pool = STYLES.filter(function (st) { return S.game === "all" || FAM_GAME[st.fam] === "both" || FAM_GAME[st.fam] === S.game; });
    var st = pool[Math.floor(R() * pool.length)], hue = R(), col = toHex(K.hsl(hue, 0.55 + R() * 0.3, 0.42 + R() * 0.15));
    var tex = TX.TEXTURES.filter(function (t) { return S.game === "all" || (S.game === "fantasy" ? t.group === "Fantasy" : t.group === "Sci-fi") || FAM_GAME[st.fam] === "both"; });
    var T = { name: "Random", s: { style: st.id, ringColor: col, tint: R() < 0.3 } };
    if (!L.backdrop) { var t = tex[Math.floor(R() * tex.length)]; T.s.fillType = R() < 0.65 ? "texture" : "radial"; T.s.tex = t.id; T.s.fill1 = toHex(K.hsl(hue + 0.5, 0.35, 0.55)); T.s.fill2 = toHex(K.hsl(hue + 0.5, 0.3, 0.14)); T.s.texSeed = 1 + Math.floor(R() * 900); }
    applyTemplate(T); say("Random ring: " + FAM_LABEL[st.fam] + ", " + st.name + ". Press again for another.");
  }
  $("randomRing").addEventListener("click", randomRing);

  // Puts every control back in step with S (after a template, a preset or a project).
  function syncControls() {
    RANGES.forEach(function (r) { var el = $(r[0]), out = $(r[0] + "Out"); el.value = S[r[1]]; if (out) out.textContent = r[2](S[r[1]]); });
    [["noRing", "noRing"], ["tint", "tint"], ["contig", "contig"], ["clean", "clean"], ["despill", "despill"], ["popTop", "popTop"], ["popShadow", "popShadow"],
     ["sideMark", "sideMark"], ["dropShadow", "dropShadow"], ["textUnderPop", "textUnderPop"]].forEach(function (pr) { $(pr[0]).checked = S[pr[1]]; });
    ["ringColor", "fill1", "fill2", "textFill", "textStroke"].forEach(function (id) { $(id).value = S[id]; });
    $("fillType").value = S.fillType; $("smartTo").value = S.smartTo; $("animLen").value = String(S.animLen); $("ringFlicker").value = S.ringFlicker; syncR();
    syncFill(); syncAffects(); syncWhere(); renderFonts();
    renderGames(); renderFams(); renderShapes(); renderRings(); renderSides(); renderTextures(); syncLocks();
    subjDirty = true; schedule();
  }

  function sizeCanvas() {
    var w = pv.getBoundingClientRect().width || 512, P = Math.min(M, Math.max(256, Math.round(w * (window.devicePixelRatio || 1))));
    if (pv.width !== P) { pv.width = pv.height = P; }
    syncCam(); schedule();
  }
  if (window.ResizeObserver) new ResizeObserver(sizeCanvas).observe(stageEl); else window.addEventListener("resize", sizeCanvas);
  sizeCanvas();
  fillClocks(); renderFonts(); renderTemplates(); syncContent(); syncAffects(); syncWhere();
  renderGames(); renderFams(); renderShapes(); renderRings(); renderSides(); renderTextures(); syncLocks(); syncUndo(); setTool("move"); schedule();

  // for checks in a browser console and the page tests. pixel() composes the token as exported (no camera) and reads one pixel.
  window.tgToken = {
    exportPng: exportPng, copyImage: copyImage,
    styles: function () { return STYLES.map(function (s) { return s.id; }); },
    textures: function () { return TX.TEXTURES.map(function (t) { return t.id; }); },
    shapes: function () { return K.SHAPES.map(function (s) { return s.id; }); },
    state: function () {
      return { style: S.style, shape: S.shape, ringGlow: S.ringGlow, ringFlicker: S.ringFlicker, fillType: S.fillType, tex: S.tex, hasImage: !!src, hasCut: hasCut, hasPop: hasPop, hasCover: hasCover, hasRingMask: hasRingMask,
        popTop: S.popTop, tool: tool, mode: TOOL_MODE[tool], affects: S.affects,
        cam: { z: cam.z, x: cam.x, y: cam.y }, img: { x: img.x, y: img.y, zoom: img.zoom, flip: img.flip },
        locks: { ring: L.ring, imgXform: L.imgXform, imgIn: L.imgIn, imgOut: L.imgOut, backdrop: L.backdrop, objects: L.objects },
        layers: { objects: V.objects, pop: V.pop, ring: V.ring, cover: V.cover, backdrop: V.backdrop },
        filters: { bright: F.bright, contrast: F.contrast, sat: F.sat, gray: F.gray, sepia: F.sepia }, undo: undo.length, redo: redo.length,
        game: S.game, side: S.side, picking: picking ? picking.dataset.pick : null, strokes: strokes.length, objects: CT.objs.length, selected: sel,
        text: { top: CT.top, bottom: CT.bottom, font: S.font }, badge: CT.badge.text, mark: CT.mark.kind, pip: CT.pip.color, playing: playing, busy: busy };
    },
    set: function (o) { Object.keys(o).forEach(function (k) { if (k in S) S[k] = o[k]; }); loadSettings(S); syncControls(); },
    content: function (o) { if (o) { Object.keys(o).forEach(function (k) { CT[k] = o[k]; }); syncContent(); schedule(); } return JSON.parse(JSON.stringify(CT)); },
    setCam: function (z, x, y) { cam.z = z; if (x !== undefined) { cam.x = x; cam.y = y; } clampCam(); syncCam(); schedule(); },
    lock: function (name, on) { if (name in L) { L[name] = !!on; syncLocks(); hint(); } },
    layer: function (name, on) { if (name in V) { V[name] = !!on; subjDirty = true; renderLayers(); schedule(); } },
    tool: function (t) { setTool(t); },
    undo: doUndo, redo: doRedo,
    autoBg: autoBackground, refine: refineEdge, aiRemove: aiRemove,
    smart: function (list) { strokes = list.map(function (s) { return { kind: s.kind, r: s.r, pts: s.pts }; }); runSmart(); },
    addObject: addObject, selectObject: function (i) { sel = i; syncObjForm(); schedule(); },
    pixel: function (x, y, t) { var wasDraft = draft; draft = false; compose(t || 0); draft = wasDraft; return Array.prototype.slice.call(mg.getImageData(x, y, 1, 1).data); },
    alpha: function (which, x, y) { var c = which === "cut" ? cut : which === "cover" ? cover : which === "pop" ? pop : ringMask; return c ? cx2(c, true).getImageData(x, y, 1, 1).data[3] : -1; },
    ringFrame: function (id, N, t, shape) { var st = styleById(id), s = K.shapeById(shape || "circle"), r1 = (N / 2 - 1) * s.fit; return st ? paintRing(N, r1 - N * 0.17, r1, st, hex(S.ringColor), S.tint, t || 0, { shape: s, cx: N / 2, cy: N / 2 + (N / 2 - 1) * s.oy }) : null; },
    zipBatch: batchBytes, project: projectData, loadProject: loadProject, frames: animFrameData, hasAnimation: hasAnimation,
    exportAnimBytes: function (kind) { var n = animFrames(); return animFrameData(512).then(function (fr) { return kind === "gif" ? EX.gif(fr, 512, 512, Math.round(S.animLen * 1000 / n)) : EX.apng(fr, 512, 512, Math.round(S.animLen * 1000 / n)); }); },
    exportBytes: function (N, type) { return fontsFirst().then(function () { return EX.canvasBytes(renderToken(N), type || "image/png", 0.92); }); },
    play: setPlaying
  };
})();
