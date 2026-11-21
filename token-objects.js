/* Table Goblin token creator: lettering and objects drawn over the token. Ring text along the outline, number badges, Elite and Weak
   marks, status pips, and placeable banners, scrolls, plaques, nameplates and neon signs. Fonts come from Google Fonts, one family at
   a time when it is first chosen. Loaded after token-rings.js. Props (holiday stickers and costume pieces) are drawn by token-props.js. */
(function () {
  "use strict";
  var TG = window.TGTok = window.TGTok || {}, K = TG.rings;
  var TAU = K.TAU, mix = K.mix, hex = K.hex, rgbStr = K.rgbStr, rng = K.rng, fbm = K.fbm, mk = K.mk, cx2 = K.cx2;

  // ---------- fonts ----------
  // Every family here is on Google Fonts under the SIL Open Font License 1.1 (checked 2026-11-20 against each family's METADATA.pb in
  // the google/fonts repository). Each has a system fallback for offline use.
  var FONTS = [
    { id: "Cinzel", label: "Cinzel", game: "fantasy", w: 700, q: "Cinzel:wght@700", fb: "Georgia, 'Times New Roman', serif" },
    { id: "Uncial Antiqua", label: "Uncial Antiqua", game: "fantasy", w: 400, q: "Uncial+Antiqua", fb: "Georgia, serif" },
    { id: "Pirata One", label: "Pirata One", game: "fantasy", w: 400, q: "Pirata+One", fb: "Georgia, serif" },
    { id: "IM Fell English SC", label: "IM Fell English SC", game: "fantasy", w: 400, q: "IM+Fell+English+SC", fb: "Georgia, serif" },
    { id: "Orbitron", label: "Orbitron", game: "scifi", w: 700, q: "Orbitron:wght@700", fb: "'Segoe UI', system-ui, sans-serif" },
    { id: "Rajdhani", label: "Rajdhani", game: "scifi", w: 700, q: "Rajdhani:wght@700", fb: "'Segoe UI', system-ui, sans-serif" },
    { id: "Audiowide", label: "Audiowide", game: "scifi", w: 400, q: "Audiowide", fb: "'Segoe UI', system-ui, sans-serif" },
    { id: "Share Tech Mono", label: "Share Tech Mono", game: "scifi", w: 400, q: "Share+Tech+Mono", fb: "ui-monospace, Consolas, monospace" },
    { id: "Neonderthaw", label: "Neonderthaw (neon script)", game: "scifi", w: 400, q: "Neonderthaw", fb: "'Brush Script MT', cursive" }
  ];
  function fontById(id) { for (var i = 0; i < FONTS.length; i++) if (FONTS[i].id === id) return FONTS[i]; return FONTS[0]; }
  var fontState = {};   // id -> "loading" | "ok" | "failed"
  var onFontReady = null;
  function ensureFont(id) {
    var f = fontById(id);
    if (fontState[f.id]) return fontState[f.id] === "loading" ? fontState[f.id + ":p"] : Promise.resolve(fontState[f.id] === "ok");
    fontState[f.id] = "loading";
    var link = document.createElement("link"); link.rel = "stylesheet"; link.href = "https://fonts.googleapis.com/css2?family=" + f.q + "&display=swap";
    var p = new Promise(function (ok) {
      var done = false;
      function finish(v) { if (done) return; done = true; fontState[f.id] = v ? "ok" : "failed"; ok(v); if (onFontReady) onFontReady(f.id, v); }
      link.onload = function () {
        if (!document.fonts || !document.fonts.load) { finish(true); return; }
        document.fonts.load(f.w + " 48px '" + f.id + "'").then(function (list) { finish(list && list.length > 0); }, function () { finish(false); });
      };
      link.onerror = function () { finish(false); };
      setTimeout(function () { finish(false); }, 8000);
    });
    fontState[f.id + ":p"] = p;
    document.head.appendChild(link);
    return p;
  }
  function fontCss(id, px) { var f = fontById(id); return f.w + " " + px + "px '" + f.id + "', " + f.fb; }
  function fontsReady(ids) { return Promise.all(ids.map(function (id) { return ensureFont(id); })); }

  // ---------- text along the ring ----------
  // Per-letter placement along the shape's outline at radius r: the top text reads left to right over the top, the bottom text reads
  // left to right under the bottom, both upright. On a polygon's straight side the letters sit in a straight line.
  function advances(g, txt, track) {
    var adv = [], i;
    for (i = 0; i < txt.length; i++) {
      var a = txt[i], b = txt[i + 1];
      adv.push((b ? g.measureText(a + b).width - g.measureText(b).width : g.measureText(a).width) + track);
    }
    return adv;
  }
  // geo: { shape, cx, cy }; T: { text, pos: "top"|"bottom", font, size (px), track (fraction of size), fill, stroke, strokeW (fraction), shadow }
  function ringText(g, geo, r, T) {
    var txt = (T.text || "").trim();
    if (!txt) return 0;
    var size = T.size;
    g.save(); g.font = fontCss(T.font, size); g.textAlign = "center"; g.textBaseline = "middle"; g.lineJoin = "round";
    var adv = advances(g, txt, T.track * size), tot = adv.reduce(function (s, v) { return s + v; }, 0);
    var per = K.shapePerim(geo.shape, r), scale = K.TAU / per;   // angle-coordinate units per pixel along the outline
    var top = T.pos !== "bottom", center = top ? -Math.PI / 2 : Math.PI / 2, dir = top ? 1 : -1, span = tot * scale;
    var a = center - dir * span / 2, flip = top ? 0 : Math.PI;
    var passes = T.shadow ? ["shadow", "stroke", "fill"] : ["stroke", "fill"];
    passes.forEach(function (pass) {
      var aa = a;
      for (var i = 0; i < txt.length; i++) {
        var mid = aa + dir * adv[i] / 2 * scale, rr = top ? r : r, q = K.shapePt(geo.shape, geo.cx, geo.cy, rr, mid);
        g.save(); g.translate(q[0], q[1]); g.rotate(q[2] + flip);
        if (pass === "shadow") { g.shadowColor = "rgba(0,0,0,0.6)"; g.shadowBlur = size * 0.25; g.shadowOffsetY = size * 0.06; g.fillStyle = "rgba(0,0,0,0.6)"; g.fillText(txt[i], 0, 0); }
        else if (pass === "stroke" && T.strokeW > 0) { g.strokeStyle = T.stroke; g.lineWidth = size * T.strokeW; g.strokeText(txt[i], 0, 0); }
        else if (pass === "fill") { g.fillStyle = T.fill; g.fillText(txt[i], 0, 0); }
        g.restore();
        aa += dir * adv[i] * scale;
      }
    });
    g.restore();
    return span / K.TAU * 360;   // degrees of the outline the text covers
  }

  // ---------- badges and pips on a clock face ----------
  function clockAngle(h) { return ((h % 12) / 12) * TAU - Math.PI / 2; }
  // B: { kind: "number"|"elite"|"weak"|"pip", text, color, shape: "circle"|"shield", clock, size (px), label }
  function badge(g, x, y, B) {
    var s = B.size, col = B.color || "#c43e34";
    g.save(); g.translate(x, y); g.lineJoin = "round";
    g.shadowColor = "rgba(0,0,0,0.45)"; g.shadowBlur = s * 0.18; g.shadowOffsetY = s * 0.06;
    g.beginPath();
    if (B.kind === "pip") g.arc(0, 0, s * 0.5, 0, TAU);
    else if (B.shape === "shield") { g.moveTo(-s * 0.55, -s * 0.55); g.lineTo(s * 0.55, -s * 0.55); g.lineTo(s * 0.55, s * 0.05); g.quadraticCurveTo(s * 0.5, s * 0.5, 0, s * 0.7); g.quadraticCurveTo(-s * 0.5, s * 0.5, -s * 0.55, s * 0.05); g.closePath(); }
    else g.arc(0, 0, s * 0.62, 0, TAU);
    var gr = g.createLinearGradient(0, -s * 0.6, 0, s * 0.6), base = hex(col);
    gr.addColorStop(0, rgbStr(mix(base, [255, 255, 255], 0.25))); gr.addColorStop(1, rgbStr(mix(base, [0, 0, 0], 0.25)));
    g.fillStyle = gr; g.fill(); g.shadowColor = "transparent";
    g.strokeStyle = "rgba(10,10,12,0.9)"; g.lineWidth = s * 0.12; g.stroke(); g.strokeStyle = "#ffffff"; g.lineWidth = s * 0.05; g.stroke();
    g.fillStyle = "#ffffff"; g.strokeStyle = "rgba(0,0,0,0.75)"; g.lineWidth = s * 0.1;
    if (B.kind === "elite" || B.kind === "weak") {
      var up = B.kind === "elite", k = s * 0.3;
      g.beginPath(); g.moveTo(-k, up ? k * 0.45 : -k * 0.45); g.lineTo(0, up ? -k * 0.55 : k * 0.55); g.lineTo(k, up ? k * 0.45 : -k * 0.45);
      g.lineCap = "round"; g.stroke(); g.strokeStyle = "#ffffff"; g.lineWidth = s * 0.07; g.stroke();
    } else if (B.kind === "number" && B.text) {
      var fs = s * (B.text.length > 2 ? 0.52 : B.text.length > 1 ? 0.66 : 0.82);
      g.font = "700 " + fs + "px 'IBM Plex Sans', 'Segoe UI', system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
      g.strokeText(B.text, 0, s * (B.shape === "shield" ? 0.02 : 0.04)); g.fillText(B.text, 0, s * (B.shape === "shield" ? 0.02 : 0.04));
    } else if (B.kind === "pip" && B.label) {
      var ls = s * (B.label.length > 1 ? 0.5 : 0.7);
      g.font = "700 " + ls + "px 'IBM Plex Sans', system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
      g.strokeText(B.label, 0, s * 0.04); g.fillText(B.label, 0, s * 0.04);
    }
    g.restore();
  }

  // ---------- placeable objects (Phase 3) ----------
  // O: { type: "banner", style: "ribbon"|"scroll"|"plaque"|"nameplate"|"neon", x, y, w, h, rot, bend, color, trim, text, font, textColor,
  //      neon: { color, plate, border, flicker } } in token pixels. Drawn centered on (x, y).
  var NEON_COLORS = [["cyan", "#3ff6ff"], ["magenta", "#ff3fd8"], ["lime", "#9dff3f"], ["amber", "#ffb43f"], ["red", "#ff3f4a"]];
  function fitFont(g, text, font, maxW, maxH) {
    var px = maxH; g.font = fontCss(font, px);
    var w = g.measureText(text).width;
    if (w > maxW) px = Math.max(6, px * maxW / w);
    g.font = fontCss(font, px);
    return px;
  }
  function bentText(g, text, w, bend, y) {   // text along a gentle arc (bend > 0 arches up)
    if (!bend || Math.abs(bend) < 0.01) { g.fillText(text, 0, y); return; }
    var R = w / (2 * Math.sin(Math.min(1.2, Math.abs(bend) * 2))), sgn = bend > 0 ? 1 : -1, adv = advances(g, text, 0), tot = adv.reduce(function (s, v) { return s + v; }, 0);
    var a = -tot / 2 / R;
    for (var i = 0; i < text.length; i++) {
      var m = a + adv[i] / 2 / R;
      g.save(); g.translate(Math.sin(m) * R, y + sgn * (R - Math.cos(m) * R)); g.rotate(sgn * m); g.fillText(text[i], 0, 0); g.restore();
      a += adv[i] / R;
    }
  }
  function bannerPath(g, w, h, bend) {   // the ribbon's middle strip, arched by bend
    var b = bend * h * 1.6;
    g.beginPath(); g.moveTo(-w / 2, -h / 2); g.quadraticCurveTo(0, -h / 2 - b, w / 2, -h / 2); g.lineTo(w / 2, h / 2); g.quadraticCurveTo(0, h / 2 - b, -w / 2, h / 2); g.closePath();
  }
  function drawObject(g, O, t) {
    var w = O.w, h = O.h, col = hex(O.color || "#8a2b2b"), trim = O.trim || "#e2c36b";
    g.save(); g.translate(O.x, O.y); g.rotate(O.rot || 0);
    g.lineJoin = "round";
    if (O.style === "ribbon") {
      var tw = w * 0.2, dk = rgbStr(mix(col, [0, 0, 0], 0.45)), b = (O.bend || 0) * h * 1.6;
      [-1, 1].forEach(function (s) {   // tails, set back and lower, with a V notch
        var x0 = s * (w / 2 - tw * 0.2), x1 = s * (w / 2 + tw * 0.75), y0 = -h * 0.2, y1 = h * 0.62;
        g.fillStyle = rgbStr(mix(col, [0, 0, 0], 0.22)); g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y0); g.lineTo(x1 - s * tw * 0.35, (y0 + y1) / 2); g.lineTo(x1, y1); g.lineTo(x0, y1); g.closePath(); g.fill();
        g.fillStyle = dk; g.beginPath(); g.moveTo(s * w / 2, -h / 2); g.lineTo(x0, y0 + h * 0.3); g.lineTo(s * w / 2, h / 2); g.closePath(); g.fill();
      });
      bannerPath(g, w, h, O.bend || 0);
      var gr = g.createLinearGradient(0, -h / 2 - b, 0, h / 2); gr.addColorStop(0, rgbStr(mix(col, [255, 255, 255], 0.22))); gr.addColorStop(0.5, rgbStr(col)); gr.addColorStop(1, rgbStr(mix(col, [0, 0, 0], 0.3)));
      g.fillStyle = gr; g.fill(); g.strokeStyle = trim; g.lineWidth = Math.max(1, h * 0.05); g.stroke();
    } else if (O.style === "scroll") {
      var R2 = rng(5), ew = h * 0.28;
      g.beginPath(); g.moveTo(-w / 2 + ew, -h / 2);
      for (var i = 1; i <= 10; i++) g.lineTo(-w / 2 + ew + (w - 2 * ew) * i / 10, -h / 2 + (R2() - 0.5) * h * 0.06);
      g.lineTo(w / 2 - ew, h / 2);
      for (i = 9; i >= 0; i--) g.lineTo(-w / 2 + ew + (w - 2 * ew) * i / 10, h / 2 + (R2() - 0.5) * h * 0.06);
      g.closePath();
      var pg = g.createLinearGradient(0, -h / 2, 0, h / 2); pg.addColorStop(0, "#efe0b8"); pg.addColorStop(0.5, "#f7ecd0"); pg.addColorStop(1, "#d8c393");
      g.fillStyle = pg; g.fill(); g.strokeStyle = "rgba(90,60,20,0.6)"; g.lineWidth = Math.max(1, h * 0.03); g.stroke();
      [-1, 1].forEach(function (s) {
        var cx = s * (w / 2 - ew * 0.9), rg = g.createLinearGradient(cx - ew, 0, cx + ew, 0);
        rg.addColorStop(0, "#b89a62"); rg.addColorStop(0.5, "#f3e4bf"); rg.addColorStop(1, "#9c7f4a");
        g.fillStyle = rg; g.beginPath(); g.ellipse(cx, 0, ew * 0.9, h * 0.62, 0, 0, TAU); g.fill(); g.stroke();
        g.strokeStyle = "rgba(90,60,20,0.55)"; g.beginPath(); g.ellipse(cx, 0, ew * 0.4, h * 0.3, 0, 0.5, 5.5); g.stroke();
      });
    } else if (O.style === "plaque") {
      var r = h * 0.22;
      g.beginPath(); g.moveTo(-w / 2 + r, -h / 2); g.arcTo(w / 2, -h / 2, w / 2, h / 2, r); g.arcTo(w / 2, h / 2, -w / 2, h / 2, r); g.arcTo(-w / 2, h / 2, -w / 2, -h / 2, r); g.arcTo(-w / 2, -h / 2, w / 2, -h / 2, r); g.closePath();
      var mg = g.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2); mg.addColorStop(0, "#fff0b0"); mg.addColorStop(0.35, "#d6a640"); mg.addColorStop(0.7, "#8a6018"); mg.addColorStop(1, "#e8c060");
      g.fillStyle = mg; g.fill(); g.strokeStyle = "#4a3208"; g.lineWidth = Math.max(1, h * 0.06); g.stroke();
      g.strokeStyle = "rgba(255,250,220,0.6)"; g.lineWidth = Math.max(0.6, h * 0.025); g.strokeRect(-w / 2 + h * 0.14, -h / 2 + h * 0.14, w - h * 0.28, h - h * 0.28);
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (q) { K.rivet(g, q[0] * (w / 2 - h * 0.17), q[1] * (h / 2 - h * 0.17), h * 0.06); });
    } else if (O.style === "nameplate") {
      var c = h * 0.35;
      g.beginPath(); g.moveTo(-w / 2 + c, -h / 2); g.lineTo(w / 2 - c, -h / 2); g.lineTo(w / 2, 0); g.lineTo(w / 2 - c, h / 2); g.lineTo(-w / 2 + c, h / 2); g.lineTo(-w / 2, 0); g.closePath();
      var ng = g.createLinearGradient(0, -h / 2, 0, h / 2); ng.addColorStop(0, "rgba(20,30,44,0.92)"); ng.addColorStop(1, "rgba(6,10,16,0.95)");
      g.fillStyle = ng; g.fill();
      var nc = O.color || "#3ff6ff"; g.shadowColor = nc; g.shadowBlur = h * 0.3; g.strokeStyle = nc; g.lineWidth = Math.max(1, h * 0.05); g.stroke(); g.shadowBlur = 0;
      g.strokeStyle = nc; g.lineWidth = Math.max(0.6, h * 0.03);
      for (var k2 = 0; k2 < 4; k2++) { var tx = -w / 2 + c + h * 0.15 + k2 * h * 0.12; g.beginPath(); g.moveTo(tx, h * 0.32); g.lineTo(tx, h * 0.42); g.stroke(); }
    } else if (O.style === "neon") {
      // glow: 0 (unlit glass tubes) .. 2 (wide, bright halo); flicker: "off" | "subtle" | "strong" (older files stored true or false)
      var N2 = O.neon || {}, ncol = N2.color || "#3ff6ff", mode = neonMode(N2), on = K.neonFlicker(t, mode);
      var G = typeof N2.glow === "number" ? Math.max(0, Math.min(2, N2.glow)) : 1, sp = 0.4 + 0.6 * G, dull = rgbStr(mix(hex(ncol), [40, 42, 48], 0.62));
      if (N2.plate !== false) {
        var pr = h * 0.18; g.beginPath(); g.moveTo(-w / 2 + pr, -h / 2); g.arcTo(w / 2, -h / 2, w / 2, h / 2, pr); g.arcTo(w / 2, h / 2, -w / 2, h / 2, pr); g.arcTo(-w / 2, h / 2, -w / 2, -h / 2, pr); g.arcTo(-w / 2, -h / 2, w / 2, -h / 2, pr); g.closePath();
        var bg = g.createLinearGradient(0, -h / 2, 0, h / 2); bg.addColorStop(0, "#1a1c22"); bg.addColorStop(1, "#0b0c10"); g.fillStyle = bg; g.fill();
        g.strokeStyle = "rgba(255,255,255,0.08)"; g.lineWidth = Math.max(1, h * 0.03); g.stroke();
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (q) { g.fillStyle = "#5b616a"; g.beginPath(); g.arc(q[0] * (w / 2 - h * 0.1), q[1] * (h / 2 - h * 0.1), h * 0.035, 0, TAU); g.fill(); });
      }
      if (N2.border) {
        g.save(); g.globalCompositeOperation = G > 0.02 ? "lighter" : "source-over"; g.globalAlpha = G > 0.02 ? Math.min(1, on * (0.35 + 0.65 * G)) : 1;
        var br = h * 0.12; g.beginPath(); g.moveTo(-w / 2 + h * 0.12 + br, -h / 2 + h * 0.12); g.arcTo(w / 2 - h * 0.12, -h / 2 + h * 0.12, w / 2 - h * 0.12, h / 2 - h * 0.12, br);
        g.arcTo(w / 2 - h * 0.12, h / 2 - h * 0.12, -w / 2 + h * 0.12, h / 2 - h * 0.12, br); g.arcTo(-w / 2 + h * 0.12, h / 2 - h * 0.12, -w / 2 + h * 0.12, -h / 2 + h * 0.12, br);
        g.arcTo(-w / 2 + h * 0.12, -h / 2 + h * 0.12, w / 2 - h * 0.12, -h / 2 + h * 0.12, br); g.closePath();
        g.shadowColor = ncol; g.shadowBlur = h * 0.25 * sp * (G > 0.02 ? 1 : 0); g.strokeStyle = G > 0.02 ? ncol : dull; g.lineWidth = h * 0.05; g.stroke(); if (G > 0.02) g.stroke(); if (G > 1.2) g.stroke();
        if (G > 0.02) { g.shadowBlur = 0; g.strokeStyle = rgbStr(mix(hex(ncol), [255, 255, 255], 0.7)); g.lineWidth = h * 0.02; g.stroke(); }
        g.restore();
      }
      if (O.text) {
        g.textAlign = "center"; g.textBaseline = "middle";
        var fsz = fitFont(g, O.text, O.font || "Neonderthaw", w * (N2.border ? 0.76 : 0.88), h * (N2.border ? 0.52 : 0.66));
        g.save(); g.lineJoin = "round"; g.lineCap = "round";
        if (G <= 0.02) {   // switched off: plain glass tubes, no light
          g.strokeStyle = dull; g.lineWidth = Math.max(1, fsz * 0.12); g.strokeText(O.text, 0, fsz * 0.04);
          g.strokeStyle = "rgba(255,255,255,0.18)"; g.lineWidth = Math.max(0.6, fsz * 0.03); g.strokeText(O.text, 0, fsz * 0.02);
          g.restore(); g.restore(); return;
        }
        g.globalCompositeOperation = "lighter"; g.globalAlpha = Math.min(1, on * (0.35 + 0.65 * G));
        g.shadowColor = ncol; g.shadowBlur = fsz * 0.55 * sp; g.strokeStyle = ncol; g.lineWidth = Math.max(1, fsz * 0.12); g.strokeText(O.text, 0, fsz * 0.04); g.strokeText(O.text, 0, fsz * 0.04);
        if (G > 1.2) g.strokeText(O.text, 0, fsz * 0.04);
        g.shadowBlur = fsz * 0.2; g.strokeStyle = rgbStr(mix(hex(ncol), [255, 255, 255], 0.75)); g.lineWidth = Math.max(0.6, fsz * 0.045); g.strokeText(O.text, 0, fsz * 0.04);
        g.restore();
      }
      g.restore(); return;
    }
    if (O.text) {
      g.textAlign = "center"; g.textBaseline = "middle";
      var inner = O.style === "scroll" ? w - h * 0.75 : O.style === "ribbon" ? w * 0.86 : w - h * 0.5;
      var px = fitFont(g, O.text, O.font || "Cinzel", inner, h * 0.58);
      g.fillStyle = O.textColor || (O.style === "scroll" ? "#3a2510" : O.style === "plaque" ? "#2e1e04" : "#fff3d6");
      if (O.style === "nameplate") { g.shadowColor = O.color || "#3ff6ff"; g.shadowBlur = px * 0.4; g.fillStyle = O.textColor || "#e8fbff"; }
      else if (O.style === "ribbon") { g.strokeStyle = "rgba(0,0,0,0.55)"; g.lineWidth = px * 0.12; }
      if (O.style === "ribbon") { g.save(); g.lineJoin = "round"; var y0 = px * 0.04 - (O.bend || 0) * h * 0.8; g.strokeText && bentStroke(g, O.text, w, O.bend || 0, y0); bentText(g, O.text, w, O.bend || 0, y0); g.restore(); }
      else g.fillText(O.text, 0, px * 0.05);
    }
    g.restore();
  }
  function neonMode(N2) { var f = N2.flicker; return f === true ? "strong" : f === false || !f ? "off" : ["off", "subtle", "strong"].indexOf(f) >= 0 ? f : "strong"; }
  function bentStroke(g, text, w, bend, y) {
    var fill = g.fillText; g.fillText = g.strokeText; try { bentText(g, text, w, bend, y); } finally { g.fillText = fill; }
  }
  // Local frame helpers for the Objects tool: point (token px) to the object's own unrotated frame.
  function toLocal(O, p) { var c = Math.cos(-(O.rot || 0)), s = Math.sin(-(O.rot || 0)), dx = p[0] - O.x, dy = p[1] - O.y; return [dx * c - dy * s, dx * s + dy * c]; }
  function fromLocal(O, q) { var c = Math.cos(O.rot || 0), s = Math.sin(O.rot || 0); return [O.x + q[0] * c - q[1] * s, O.y + q[0] * s + q[1] * c]; }
  function objHalf(O) { if (O.type === "prop" && TG.props) return TG.props.half(O); var ext = O.style === "ribbon" ? 1.3 : O.style === "scroll" ? 1.05 : 1; return [O.w / 2 * ext, O.h / 2 * (O.style === "ribbon" ? 1.25 : 1)]; }
  function hitObject(O, p, pad) { var q = toLocal(O, p), hh = objHalf(O); return Math.abs(q[0]) <= hh[0] + pad && Math.abs(q[1]) <= hh[1] + pad; }

  TG.objects = {
    FONTS: FONTS, fontById: fontById, ensureFont: ensureFont, fontCss: fontCss, fontsReady: fontsReady, setFontReady: function (f) { onFontReady = f; },
    ringText: ringText, clockAngle: clockAngle, badge: badge, drawObject: drawObject, NEON_COLORS: NEON_COLORS,
    neonMode: neonMode, toLocal: toLocal, fromLocal: fromLocal, objHalf: objHalf, hitObject: hitObject
  };
}());
