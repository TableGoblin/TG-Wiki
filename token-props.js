/* Table Goblin token creator: props, small pictures placed on a token like stickers or costume pieces. The Holiday group has a
   Thanksgiving set and a Christmas set. Every prop is drawn here from vector paths, gradients and highlights; no image files are
   loaded. Each draw function works in its own box of units centered on (0, 0) and takes the time t, so animation frames use the same
   code (lights twinkle, snowflakes drift). At t = 0 everything is at rest and every light is lit, so a still export shows them on.
   Loaded after token-objects.js. */
(function () {
  "use strict";
  var TG = window.TGTok = window.TGTok || {}, K = TG.rings;
  var TAU = K.TAU, mix = K.mix, hex = K.hex, rgbStr = K.rgbStr, rng = K.rng;
  var INK = "rgba(52,28,16,0.9)", WHITE = [255, 255, 255], BLACK = [0, 0, 0];

  // ---------- painting helpers ----------
  function loopP(t) { var L = K.R.loop || 1.5; return ((t || 0) / L) % 1; }        // 0..1 over one animation loop
  function pxk(g) { var m = g.getTransform ? g.getTransform() : { a: 1, b: 0 }; return Math.hypot(m.a, m.b) || 1; }   // device px per unit
  function lit(c, k) { return rgbStr(mix(c, WHITE, k)); }
  function dk(c, k) { return rgbStr(mix(c, BLACK, k)); }
  // A body lit from the top left: light, base, shadow.
  function lgrad(g, x0, y0, x1, y1, c, hi, lo) {
    var gr = g.createLinearGradient(x0, y0, x1, y1);
    gr.addColorStop(0, lit(c, hi === undefined ? 0.35 : hi)); gr.addColorStop(0.5, rgbStr(c)); gr.addColorStop(1, dk(c, lo === undefined ? 0.35 : lo));
    return gr;
  }
  function rgrad(g, cx, cy, r, c, hi, lo) {
    var gr = g.createRadialGradient(cx - r * 0.38, cy - r * 0.42, r * 0.05, cx, cy, r * 1.05);
    gr.addColorStop(0, lit(c, hi === undefined ? 0.45 : hi)); gr.addColorStop(0.55, rgbStr(c)); gr.addColorStop(1, dk(c, lo === undefined ? 0.4 : lo));
    return gr;
  }
  function shadowOn(g, blur, dy) { var k = pxk(g); g.shadowColor = "rgba(0,0,0,0.35)"; g.shadowBlur = blur * k; g.shadowOffsetX = 0; g.shadowOffsetY = dy * k; }
  function shadowOff(g) { g.shadowColor = "transparent"; g.shadowBlur = 0; g.shadowOffsetY = 0; }
  // Fill the current path (with a soft drop shadow), then outline it in warm ink.
  function body(g, style, lw, noShadow) {
    g.save(); if (!noShadow) shadowOn(g, 3, 1.5); g.fillStyle = style; g.fill(); g.restore();
    if (lw) { g.strokeStyle = INK; g.lineWidth = lw; g.lineJoin = "round"; g.lineCap = "round"; g.stroke(); }
  }
  function gloss(g, x, y, rx, ry, a, rot) {
    g.save(); g.fillStyle = "rgba(255,255,255," + (a === undefined ? 0.6 : a) + ")"; g.beginPath(); g.ellipse(x, y, rx, ry, rot || 0, 0, TAU); g.fill(); g.restore();
  }
  function circle(g, x, y, r) { g.beginPath(); g.arc(x, y, r, 0, TAU); }
  function ball(g, x, y, r, c, lw) { circle(g, x, y, r); body(g, rgrad(g, x, y, r, c), lw); gloss(g, x - r * 0.35, y - r * 0.4, r * 0.28, r * 0.18, 0.75, -0.6); }
  // A fluffy edge of small bumps along a polyline (fur trim, pompoms, snow).
  function fluffAdd(g, pts, r) { pts.forEach(function (q) { g.moveTo(q[0] + r, q[1]); g.arc(q[0], q[1], r, 0, TAU); }); }
  function fluff(g, pts, r) { g.beginPath(); fluffAdd(g, pts, r); }

  // ---------- leaf shapes ----------
  var MAPLE = [[0, -1], [0.14, -0.66], [0.36, -0.8], [0.3, -0.42], [0.68, -0.58], [0.56, -0.3], [0.98, -0.2], [0.66, 0.04], [0.8, 0.24], [0.4, 0.2],
    [0.44, 0.48], [0.1, 0.32], [0.05, 0.42]];
  function maplePath(g, s) {
    g.beginPath(); g.moveTo(0, -s);
    MAPLE.slice(1).forEach(function (q) { g.lineTo(q[0] * s, q[1] * s); });
    MAPLE.slice(1).reverse().forEach(function (q) { g.lineTo(-q[0] * s, q[1] * s); });
    g.closePath();
  }
  var OAK = [[0.3, -0.8], [0.13, -0.62], [0.44, -0.44], [0.19, -0.26], [0.5, -0.08], [0.21, 0.1], [0.44, 0.28], [0.15, 0.42], [0.26, 0.58], [0.05, 0.7]];
  function oakSide(g, s, sx) {
    var prev = [0, -1];
    for (var i = 0; i < OAK.length; i++) {
      var q = OAK[i];
      if (i % 2 === 0) g.quadraticCurveTo(sx * q[0] * 1.15 * s, prev[1] * s, sx * q[0] * s, q[1] * s);
      else g.quadraticCurveTo(sx * OAK[i - 1][0] * 1.1 * s, q[1] * s, sx * q[0] * s, q[1] * s);
      prev = q;
    }
  }
  function oakPath(g, s) {
    g.beginPath(); g.moveTo(0, -s); oakSide(g, s, 1);
    // back up the left side: walk the same points in reverse, mirrored
    var pts = OAK.slice().reverse();
    for (var i = 1; i < pts.length; i++) {
      var q = pts[i], p = pts[i - 1];
      if (i % 2 === 1) g.quadraticCurveTo(-q[0] * 1.15 * s, p[1] * s, -q[0] * s, q[1] * s);
      else g.quadraticCurveTo(-p[0] * 1.1 * s, q[1] * s, -q[0] * s, q[1] * s);
    }
    g.quadraticCurveTo(-0.3 * s, -0.95 * s, 0, -s); g.closePath();
  }
  function veins(g, s, col, lw) {
    g.save(); g.strokeStyle = col; g.lineWidth = lw; g.lineCap = "round";
    g.beginPath(); g.moveTo(0, 0.75 * s); g.lineTo(0, -0.8 * s);
    [[-0.45, 0.45], [-0.1, 0.5], [0.22, 0.42]].forEach(function (v) {
      g.moveTo(0, v[0] * s); g.lineTo(v[1] * s, (v[0] - 0.28) * s); g.moveTo(0, v[0] * s); g.lineTo(-v[1] * s, (v[0] - 0.28) * s);
    });
    g.stroke(); g.restore();
  }
  function leaf(g, kind, s, c) {
    if (kind === "maple") maplePath(g, s); else oakPath(g, s);
    body(g, lgrad(g, -s, -s, s, s, c, 0.3, 0.3), s * 0.07);
    veins(g, s, rgbStr(mix(c, [255, 230, 150], 0.55), 0.8), s * 0.05);
    g.save(); g.strokeStyle = dk(c, 0.45); g.lineWidth = s * 0.09; g.lineCap = "round"; g.beginPath(); g.moveTo(0, 0.4 * s); g.lineTo(0.06 * s, 0.85 * s); g.stroke(); g.restore();
  }
  function hollyLeaf(g, L, W, c) {   // along +x from 0 to L
    var n = 4, pts = [];
    for (var i = 0; i <= n; i++) { var x = L * i / n, hw = W * Math.sin(Math.PI * (0.08 + 0.84 * i / n)); pts.push([x, hw]); }
    g.beginPath(); g.moveTo(0, 0);
    for (i = 1; i <= n; i++) { var a = pts[i - 1], b = pts[i]; g.quadraticCurveTo((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 * 0.45, b[0], i === n ? 0 : b[1] * 1.15); }
    for (i = n - 1; i >= 0; i--) { a = pts[i + 1]; b = pts[i]; g.quadraticCurveTo((a[0] + b[0]) / 2, -(a[1] + b[1]) / 2 * 0.45, b[0], i === 0 ? 0 : -b[1] * 1.15); }
    g.closePath();
    body(g, lgrad(g, 0, -W, L * 0.6, W, c, 0.3, 0.45), W * 0.14);
    g.save(); g.strokeStyle = rgbStr(mix(c, [220, 255, 200], 0.5), 0.75); g.lineWidth = W * 0.12; g.lineCap = "round"; g.beginPath(); g.moveTo(L * 0.05, 0); g.lineTo(L * 0.92, 0); g.stroke(); g.restore();
    gloss(g, L * 0.45, -W * 0.35, L * 0.18, W * 0.12, 0.45, 0.05);
  }

  // ---------- light bulbs ----------
  var BULBS = ["#ff3b3b", "#ffd23b", "#39d353", "#3b8bff", "#ff8a2a", "#e85bff"];
  // A twinkle that is fully on at t = 0 and at the end of the loop, so the loop is seamless and a still frame is lit.
  function twinkle(t, i) { var p = loopP(t), k = 1 + (i * 7 + 3) % 3, d = 0.12 * (i % 4); var s = Math.sin(Math.PI * k * p); return 1 - (0.75 + d) * s * s * ((i * 5) % 3 === 0 ? 1 : 0.55); }
  function bulb(g, s, colHex, b) {   // pointing up (-y) from the socket at the origin; s = bulb length
    var c = hex(colHex), w = s * 0.32;
    if (b > 0.05) {   // the glow
      g.save(); g.globalCompositeOperation = "lighter"; g.globalAlpha = 0.55 * b;
      var gr = g.createRadialGradient(0, -s * 0.6, 0, 0, -s * 0.6, s * 0.95);
      gr.addColorStop(0, rgbStr(c, 0.9)); gr.addColorStop(1, rgbStr(c, 0)); g.fillStyle = gr; g.beginPath(); g.arc(0, -s * 0.6, s * 0.95, 0, TAU); g.fill(); g.restore();
    }
    g.beginPath(); g.moveTo(-w * 0.55, -s * 0.2);
    g.bezierCurveTo(-w * 1.25, -s * 0.5, -w * 0.6, -s * 0.98, 0, -s * 1.05); g.bezierCurveTo(w * 0.6, -s * 0.98, w * 1.25, -s * 0.5, w * 0.55, -s * 0.2); g.closePath();
    var on = mix(mix(c, WHITE, 0.25), [40, 40, 50], 0.6 * (1 - b)), gb = g.createLinearGradient(-w, 0, w, 0);
    gb.addColorStop(0, rgbStr(mix(on, WHITE, 0.35))); gb.addColorStop(0.5, rgbStr(on)); gb.addColorStop(1, rgbStr(mix(on, BLACK, 0.35)));
    g.fillStyle = gb; g.fill(); g.strokeStyle = "rgba(20,20,24,0.7)"; g.lineWidth = s * 0.05; g.stroke();
    if (b > 0.05) { g.save(); g.globalAlpha = 0.85 * b; g.fillStyle = lit(c, 0.8); g.beginPath(); g.ellipse(0, -s * 0.55, w * 0.32, s * 0.24, 0, 0, TAU); g.fill(); g.restore(); }
    gloss(g, -w * 0.38, -s * 0.72, w * 0.16, s * 0.12, 0.7, 0.3);
    g.fillStyle = "#1f4a2a"; g.beginPath(); g.rect(-w * 0.62, -s * 0.24, w * 1.24, s * 0.26); g.fill(); g.strokeStyle = "rgba(10,20,12,0.9)"; g.lineWidth = s * 0.04; g.stroke();
  }
  function bulbCol(O, i) { return O.multi === false ? (O.color || "#ffd23b") : BULBS[i % BULBS.length]; }
  function bulbB(O, t, i) { return O.twinkle === false ? 1 : twinkle(t, i); }

  // ---------- the props ----------
  // add(id, label, group, def): def = { bw, bh (the drawing box in units), size (box width as a fraction of the token), at (default spot,
  // fractions), tint (default color, or none), tintLabel, layer ("front" | "under"), anim, scatter, ring, and draw(g, col, t, O) }
  var PROPS = [];
  function add(id, label, group, def) { def.id = id; def.label = label; def.group = group; PROPS.push(def); }

  add("turkeyLeg", "Turkey leg", "thanksgiving", { bw: 100, bh: 70, size: 0.3, at: [0.74, 0.72], layer: "front",
    draw: function (g, col, t, O) {
      g.rotate(-0.5);
      var bone = hex("#f4ead4");
      g.beginPath(); g.rect(4, -5.5, 32, 11); body(g, lgrad(g, 0, -6, 0, 6, bone, 0.3, 0.3), 2.2);
      [[38, -7], [38, 7]].forEach(function (q) { circle(g, q[0], q[1], 7.5); body(g, rgrad(g, q[0], q[1], 7.5, bone, 0.4, 0.25), 2.2, true); });
      g.beginPath(); g.rect(30, -5, 6, 10); g.fillStyle = rgbStr(bone); g.fill();
      var meat = hex("#b9652a");
      g.beginPath(); g.moveTo(12, -8); g.bezierCurveTo(0, -24, -44, -28, -47, -2); g.bezierCurveTo(-48, 22, -8, 26, 12, 8); g.quadraticCurveTo(16, 0, 12, -8); g.closePath();
      body(g, rgrad(g, -20, -2, 30, meat, 0.45, 0.45), 2.4);
      g.save(); g.clip();
      g.strokeStyle = "rgba(110,45,12,0.55)"; g.lineWidth = 2.2; g.lineCap = "round";
      [[-40, 6, -8, 14], [-34, 14, -2, 19], [-20, -2, 6, 3]].forEach(function (s) { g.beginPath(); g.moveTo(s[0], s[1]); g.quadraticCurveTo((s[0] + s[2]) / 2, (s[1] + s[3]) / 2 + 3, s[2], s[3]); g.stroke(); });
      g.restore();
      gloss(g, -26, -13, 12, 5, 0.45, -0.25); gloss(g, -8, -10, 4, 2, 0.5, -0.2);
      g.beginPath(); g.moveTo(8, -8); g.quadraticCurveTo(14, 0, 8, 8); g.strokeStyle = "rgba(255,230,190,0.5)"; g.lineWidth = 1.6; g.stroke();
    } });

  add("pilgrimHat", "Pilgrim hat", "thanksgiving", { bw: 100, bh: 80, size: 0.44, at: [0.5, 0.17], tint: "#2a2a30", tintLabel: "Hat color", layer: "front",
    draw: function (g, col, t, O) {
      var c = hex(col);
      g.beginPath(); g.ellipse(0, 26, 48, 12, 0, 0, TAU); body(g, lgrad(g, 0, 14, 0, 38, c, 0.28, 0.3), 2.4);
      g.beginPath(); g.ellipse(0, 25, 40, 7, 0, Math.PI, TAU); g.strokeStyle = "rgba(255,255,255,0.12)"; g.lineWidth = 1.5; g.stroke();
      g.beginPath(); g.moveTo(-30, 24); g.lineTo(-24, -32); g.quadraticCurveTo(0, -42, 24, -32); g.lineTo(30, 24); g.quadraticCurveTo(0, 33, -30, 24); g.closePath();
      body(g, lgrad(g, -30, -30, 30, 30, c, 0.3, 0.35), 2.4);
      g.beginPath(); g.ellipse(0, -33, 23, 5.5, 0, 0, TAU); g.fillStyle = lit(c, 0.12); g.fill(); g.strokeStyle = INK; g.lineWidth = 1.6; g.stroke();
      // the band
      g.beginPath(); g.moveTo(-28.6, 10); g.quadraticCurveTo(0, 18, 28.6, 10); g.lineTo(29.6, 21); g.quadraticCurveTo(0, 30, -29.6, 21); g.closePath();
      body(g, lgrad(g, 0, 10, 0, 28, mix(c, [30, 20, 14], 0.6), 0.15, 0.3), 1.8, true);
      // the buckle
      var gold = hex("#e8b830");
      g.beginPath(); g.rect(-10, 9, 20, 15); g.rect(-5.5, 13, 11, 7); g.fillStyle = lgrad(g, -10, 9, 10, 24, gold, 0.5, 0.35); g.fill("evenodd"); g.strokeStyle = INK; g.lineWidth = 1.6; g.stroke();
      g.fillStyle = "#c79a20"; g.beginPath(); g.rect(-1, 13, 2, 7); g.fill();
      gloss(g, -16, -14, 4, 14, 0.18, 0.08);
    } });

  add("bonnet", "Pilgrim bonnet", "thanksgiving", { bw: 100, bh: 96, size: 0.5, at: [0.5, 0.36], tint: "#f7f4ec", tintLabel: "Bonnet color", layer: "front",
    draw: function (g, col, t, O) {
      var c = hex(col), sh = mix(c, [120, 132, 165], 0.35);
      // the ties under the chin, then the hood (a U around the face), pleats, a turned-back brim along the opening and the bow
      g.lineCap = "round";
      [-1, 1].forEach(function (s) {
        g.beginPath(); g.moveTo(s * 30, 28); g.quadraticCurveTo(s * 20, 44, s * 3, 42);
        g.strokeStyle = INK; g.lineWidth = 8; g.stroke(); g.strokeStyle = rgbStr(c); g.lineWidth = 5.4; g.stroke();
      });
      g.beginPath(); g.moveTo(-48, 32); g.bezierCurveTo(-54, -28, -28, -50, 0, -50); g.bezierCurveTo(28, -50, 54, -28, 48, 32); g.quadraticCurveTo(40, 37, 30, 32);
      g.bezierCurveTo(32, -6, 16, -24, 0, -24); g.bezierCurveTo(-16, -24, -32, -6, -30, 32); g.quadraticCurveTo(-40, 37, -48, 32); g.closePath();
      body(g, lgrad(g, -44, -50, 44, 32, c, 0.4, 0.3), 2.4);
      g.save(); g.clip();
      g.strokeStyle = rgbStr(sh, 0.55); g.lineWidth = 1.6;
      [-0.95, -0.7, -0.45, -0.2, 0.05, 0.3, 0.55].forEach(function (k) { var a = Math.PI * (1.08 + k * 0.84 / 0.95 * 0.5 + 0.42); g.beginPath(); g.moveTo(Math.cos(a) * 30, -2 + Math.sin(a) * 26); g.lineTo(Math.cos(a) * 52, -2 + Math.sin(a) * 50); g.stroke(); });
      g.restore();
      g.beginPath(); g.moveTo(-36, 32); g.bezierCurveTo(-40, -12, -20, -32, 0, -32); g.bezierCurveTo(20, -32, 40, -12, 36, 32);
      g.lineTo(30, 32); g.bezierCurveTo(32, -6, 16, -24, 0, -24); g.bezierCurveTo(-16, -24, -32, -6, -30, 32); g.closePath();
      body(g, lgrad(g, -36, -32, 36, 32, mix(c, WHITE, 0.3), 0.3, 0.2), 1.8, true);
      g.beginPath(); g.moveTo(-26, -40); g.quadraticCurveTo(0, -48, 26, -40); g.strokeStyle = "rgba(255,255,255,0.6)"; g.lineWidth = 2.4; g.stroke();
      [-1, 1].forEach(function (s) {
        g.beginPath(); g.ellipse(s * 8.5, 42, 8.5, 5, s * 0.35, 0, TAU); body(g, lgrad(g, 0, 37, 0, 47, c, 0.3, 0.3), 1.8, true);
      });
      circle(g, 0, 42, 3.6); body(g, rgrad(g, 0, 42, 3.6, c), 1.6, true);
      [-1, 1].forEach(function (s) { g.beginPath(); g.moveTo(s * 2, 44); g.quadraticCurveTo(s * 6, 50, s * 4, 56); g.strokeStyle = INK; g.lineWidth = 5; g.stroke(); g.strokeStyle = rgbStr(c); g.lineWidth = 3; g.stroke(); });
    } });

  add("leaves", "Autumn leaves", "thanksgiving", { bw: 100, bh: 100, size: 0.42, at: [0.26, 0.76], layer: "front", scatter: true,
    draw: function (g, col, t, O) {
      var R = rng(101 + (O.seed || 0) * 7919), FALL = ["#c8321e", "#e2702a", "#f0a830", "#b5651d", "#9a2c14", "#d99a28", "#c4502a"];
      for (var i = 0; i < 7; i++) {
        var a = i / 7 * TAU + R() * 0.6, rr = 12 + R() * 26, x = Math.cos(a) * rr, y = Math.sin(a) * rr * 0.9, s = 13 + R() * 7;
        g.save(); g.translate(x, y); g.rotate(R() * TAU); leaf(g, R() < 0.55 ? "maple" : "oak", s, hex(FALL[Math.floor(R() * FALL.length)])); g.restore();
      }
    } });

  add("pumpkin", "Small pumpkin", "thanksgiving", { bw: 100, bh: 90, size: 0.3, at: [0.24, 0.74], tint: "#e8822a", tintLabel: "Gourd color", layer: "front",
    draw: function (g, col, t, O) {
      // a plain harvest gourd: ribbed body, a stem, a curl of vine and one leaf
      var c = hex(col);
      [[-25, 22, 0.22], [25, 22, 0.22], [-12, 24, 0.1], [12, 24, 0.1], [0, 23, 0]].forEach(function (L) {
        g.beginPath(); g.ellipse(L[0], 12, L[1], 32, 0, 0, TAU);
        var lc = mix(c, BLACK, L[2]); body(g, rgrad(g, L[0], 8, 34, lc, 0.4, 0.38), 2.2, L[0] !== 0 && Math.abs(L[0]) < 20);
      });
      gloss(g, -6, -6, 5, 11, 0.32, 0.1); gloss(g, -26, 0, 3, 8, 0.22, 0.15);
      g.beginPath(); g.moveTo(-5, -18); g.quadraticCurveTo(-6, -30, 2, -38); g.lineTo(8, -35); g.quadraticCurveTo(3, -28, 5, -18); g.closePath();
      body(g, lgrad(g, -6, -38, 8, -18, hex("#6b4a22"), 0.3, 0.3), 2, true);
      g.beginPath(); g.moveTo(4, -22); g.bezierCurveTo(16, -30, 26, -22, 20, -16); g.bezierCurveTo(14, -10, 10, -20, 18, -22);
      g.strokeStyle = "#4e7a2a"; g.lineWidth = 1.8; g.lineCap = "round"; g.stroke();
      g.save(); g.translate(-14, -24); g.rotate(-1.1); g.scale(0.9, 0.9); maplePath(g, 11); body(g, lgrad(g, -11, -11, 11, 11, hex("#5e8f2e"), 0.3, 0.3), 1.6, true); g.restore();
    } });

  add("cornucopia", "Cornucopia", "thanksgiving", { bw: 124, bh: 90, size: 0.5, at: [0.5, 0.8], layer: "front",
    draw: function (g, col, t, O) {
      var wick = hex("#c58d40");
      g.beginPath(); g.moveTo(26, -30); g.bezierCurveTo(4, -34, -24, -30, -44, -14); g.bezierCurveTo(-56, -4, -60, -20, -50, -28); g.bezierCurveTo(-48, -14, -40, -10, -36, 0);
      g.bezierCurveTo(-20, 16, 4, 28, 26, 30); g.closePath();
      body(g, lgrad(g, -50, -30, 30, 30, wick, 0.3, 0.4), 2.4);
      g.save(); g.clip();
      g.strokeStyle = "rgba(110,64,20,0.55)"; g.lineWidth = 1.6;
      for (var i = 0; i < 7; i++) { var x = 18 - i * 9; g.beginPath(); g.moveTo(x, -40); g.quadraticCurveTo(x - 7 + i, 0, x - 2, 40); g.stroke(); }
      g.strokeStyle = "rgba(255,225,160,0.35)";
      for (i = 0; i < 5; i++) { var y = -24 + i * 12; g.beginPath(); g.moveTo(-60, y + i * 3); g.quadraticCurveTo(-10, y - 6 + i * 2, 30, y); g.stroke(); }
      g.restore();
      g.beginPath(); g.ellipse(26, 0, 11, 30, 0, 0, TAU); body(g, lgrad(g, 16, -30, 36, 30, wick, 0.25, 0.3), 2.4, true);
      g.beginPath(); g.ellipse(27, 0, 7, 25, 0, 0, TAU); g.fillStyle = "#4a2a10"; g.fill();
      // the harvest spilling out
      g.save(); g.translate(42, 18); [[-5, -3], [2, -4], [-2, 3], [5, 3], [1, 9], [-6, 8], [8, -1]].forEach(function (q) { ball(g, q[0], q[1], 5, hex("#6a3a8c"), 1.4); }); g.restore();
      g.beginPath(); g.ellipse(52, 10, 10, 9, 0, 0, TAU); body(g, rgrad(g, 52, 10, 10, hex("#e8822a")), 2); g.beginPath(); g.moveTo(52, 1); g.lineTo(52, 19); g.moveTo(46, 3); g.quadraticCurveTo(44, 10, 46, 17); g.moveTo(58, 3); g.quadraticCurveTo(60, 10, 58, 17); g.strokeStyle = "rgba(120,50,10,0.5)"; g.lineWidth = 1.2; g.stroke();
      g.beginPath(); g.moveTo(26, -30); g.quadraticCurveTo(44, -30, 54, -20); g.quadraticCurveTo(40, -24, 30, -22); g.closePath(); g.fillStyle = "#d9a83a"; g.fill();
      ball(g, 40, -12, 11, hex("#c92c24"), 2.2);
      g.beginPath(); g.moveTo(40, -22); g.lineTo(41, -27); g.strokeStyle = "#5a3a1a"; g.lineWidth = 2; g.stroke();
      g.save(); g.translate(46, -26); g.rotate(0.6); g.beginPath(); g.ellipse(0, 0, 6, 3, 0, 0, TAU); g.fillStyle = "#4f8a2a"; g.fill(); g.restore();
      g.beginPath(); g.moveTo(54, -8); g.bezierCurveTo(48, -4, 50, 4, 58, 6); g.bezierCurveTo(66, 4, 64, -6, 58, -8); g.bezierCurveTo(58, -14, 54, -14, 54, -8); g.closePath();
      body(g, rgrad(g, 58, -2, 9, hex("#b8c43a")), 2);
    } });

  // Christmas lights: straight along their box, or as a garland that follows the ring (mode "ring": the box sits on the ring and only
  // its spot along the outline counts; span is how many degrees of the outline the string covers).
  add("lights", "String of lights", "christmas", { bw: 200, bh: 50, size: 0.6, at: [0.5, 0.5], tint: "#ffd23b", tintLabel: "Bulb color (one color)", layer: "front",
    anim: true, ring: true,
    draw: function (g, col, t, O) {
      var n = 7, step = 200 / n;
      g.beginPath(); g.moveTo(-100, -14);
      for (var i = 0; i < n; i++) g.quadraticCurveTo(-100 + step * (i + 0.5), 0, -100 + step * (i + 1), -14);
      g.strokeStyle = "#1c3a22"; g.lineWidth = 2.4; g.stroke();
      for (i = 0; i < n; i++) {
        g.save(); g.translate(-100 + step * (i + 0.5), -7); g.rotate(Math.PI + (i % 2 ? 0.12 : -0.12)); bulb(g, 26, bulbCol(O, i), bulbB(O, t, i)); g.restore();
      }
    } });

  add("redNose", "Red nose", "christmas", { bw: 100, bh: 100, size: 0.1, at: [0.5, 0.5], tint: "#e3191e", tintLabel: "Nose color", layer: "front",
    draw: function (g, col, t, O) {
      var c = hex(col);
      g.save(); g.globalAlpha = 0.5; var gl = g.createRadialGradient(0, 0, 30, 0, 0, 50); gl.addColorStop(0, rgbStr(c, 0.55)); gl.addColorStop(1, rgbStr(c, 0)); g.fillStyle = gl; circle(g, 0, 0, 50); g.fill(); g.restore();
      circle(g, 0, 0, 38); body(g, rgrad(g, 0, 0, 38, c, 0.5, 0.5), 3.4);
      gloss(g, -13, -16, 11, 7, 0.85, -0.6); gloss(g, -4, -24, 3, 2, 0.9); gloss(g, 18, 20, 9, 3.5, 0.25, -0.8);
    } });

  add("santaHat", "Santa hat", "christmas", { bw: 110, bh: 100, size: 0.5, at: [0.52, 0.16], tint: "#d42027", tintLabel: "Hat color", layer: "front",
    draw: function (g, col, t, O) {
      var c = hex(col);
      g.beginPath(); g.moveTo(-40, 22); g.bezierCurveTo(-38, -14, -16, -44, 8, -44); g.bezierCurveTo(30, -44, 46, -24, 46, 6);
      g.lineTo(38, 6); g.bezierCurveTo(36, -8, 30, -16, 24, -16); g.bezierCurveTo(30, -4, 38, 10, 40, 22); g.closePath();
      body(g, lgrad(g, -40, -44, 40, 22, c, 0.35, 0.4), 2.6);
      g.save(); g.clip();
      g.beginPath(); g.moveTo(24, -16); g.bezierCurveTo(30, -4, 38, 10, 40, 22); g.lineTo(20, 22); g.bezierCurveTo(22, 6, 20, -6, 24, -16); g.fillStyle = dk(c, 0.3); g.fill();
      gloss(g, -18, -18, 6, 20, 0.2, 0.5);
      g.restore();
      // the fur trim and the pompom
      var fur = [], i;
      for (i = 0; i <= 12; i++) { var x = -46 + i * 92 / 12; fur.push([x, 16 + Math.sin(i * 1.7) * 1.5]); fur.push([x, 32 + Math.cos(i * 1.3) * 1.5]); }
      g.save(); shadowOn(g, 3, 1.5); g.beginPath(); g.rect(-46, 16, 92, 16); g.fillStyle = "#f4f4f6"; g.fill(); g.restore();
      fluff(g, fur, 6.2); g.strokeStyle = INK; g.lineWidth = 2.4; g.stroke();
      g.beginPath(); g.rect(-46, 16, 92, 16); fluffAdd(g, fur, 6.2); g.fillStyle = lgrad(g, 0, 10, 0, 38, [246, 247, 250], 0.4, 0.22); g.fill();
      g.beginPath(); g.ellipse(-8, 19, 26, 3, 0, 0, TAU); g.fillStyle = "rgba(255,255,255,0.7)"; g.fill();
      var pp = []; for (i = 0; i < 10; i++) pp.push([42 + Math.cos(i / 10 * TAU) * 7.5, 10 + Math.sin(i / 10 * TAU) * 7.5]);
      fluff(g, pp, 5); g.strokeStyle = INK; g.lineWidth = 2.2; g.stroke();
      fluff(g, pp, 5); g.moveTo(42 + 9, 10); g.arc(42, 10, 9, 0, TAU); g.fillStyle = rgrad(g, 42, 10, 13, [244, 245, 250], 0.4, 0.25); g.fill();
      gloss(g, 38, 6, 3.5, 2.5, 0.8);
    } });

  add("antlers", "Reindeer antlers", "christmas", { bw: 120, bh: 84, size: 0.56, at: [0.5, 0.15], tint: "#8a5a32", tintLabel: "Antler color", layer: "front",
    draw: function (g, col, t, O) {
      var c = hex(col);
      function branch() {
        g.beginPath();
        g.moveTo(14, 38); g.bezierCurveTo(20, 16, 34, 4, 50, -34);          // main beam
        g.moveTo(24, 14); g.quadraticCurveTo(18, -4, 22, -20);               // front tines
        g.moveTo(34, -2); g.quadraticCurveTo(30, -18, 36, -34);
        g.moveTo(42, -16); g.quadraticCurveTo(54, -18, 58, -10);              // back tine
        g.moveTo(30, 6); g.quadraticCurveTo(44, 6, 50, 14);
      }
      [-1, 1].forEach(function (s) {
        g.save(); g.scale(s, 1); g.lineCap = "round"; g.lineJoin = "round";
        branch(); g.save(); shadowOn(g, 3, 1.5); g.strokeStyle = INK; g.lineWidth = 11; g.stroke(); g.restore();
        branch(); var gr = g.createLinearGradient(0, 38, 0, -36); gr.addColorStop(0, dk(c, 0.2)); gr.addColorStop(1, lit(c, 0.35)); g.strokeStyle = gr; g.lineWidth = 7; g.stroke();
        g.save(); g.translate(-1.2, -1.2); branch(); g.strokeStyle = "rgba(255,240,215,0.35)"; g.lineWidth = 2; g.stroke(); g.restore();
        g.restore();
      });
    } });

  add("holly", "Holly sprig", "christmas", { bw: 100, bh: 80, size: 0.3, at: [0.76, 0.24], layer: "front",
    draw: function (g, col, t, O) {
      var gr = hex("#1f7a3a");
      [[-0.35, 0], [Math.PI + 0.35, 0], [-Math.PI / 2 - 0.2, 1]].forEach(function (L) {
        g.save(); g.rotate(L[0]); g.translate(4, 0); hollyLeaf(g, L[2] ? 30 : 44, L[2] ? 10 : 13, L[2] ? mix(gr, BLACK, 0.15) : gr); g.restore();
      });
      [[-6, 4], [6, 5], [0, -5]].forEach(function (q) { ball(g, q[0], q[1], 7, hex("#d61f26"), 1.8); });
    } });

  add("candyCane", "Candy cane", "christmas", { bw: 60, bh: 110, size: 0.2, at: [0.8, 0.66], tint: "#d8202a", tintLabel: "Stripe color", layer: "front",
    draw: function (g, col, t, O) {
      function cane() { g.beginPath(); g.moveTo(8, 48); g.lineTo(8, -26); g.arc(-8, -26, 16, 0, Math.PI, true); g.lineTo(-24, -14); }
      g.lineCap = "round"; g.lineJoin = "round";
      cane(); g.save(); shadowOn(g, 3, 1.5); g.strokeStyle = INK; g.lineWidth = 17; g.stroke(); g.restore();
      cane(); g.strokeStyle = "#fbf8f2"; g.lineWidth = 13; g.stroke();
      // diagonal stripes: a pattern drawn in the cane's own units, so it scales with it
      g.save();
      var tmp = stripeCanvas(col);
      var pat = g.createPattern(tmp, "repeat");
      cane(); g.strokeStyle = pat; g.lineWidth = 13; g.stroke();
      g.restore();
      cane(); var sh = g.createLinearGradient(-30, 0, 16, 0); sh.addColorStop(0, "rgba(0,0,0,0)"); sh.addColorStop(0.75, "rgba(0,0,0,0)"); sh.addColorStop(1, "rgba(0,0,0,0.22)");
      g.strokeStyle = sh; g.lineWidth = 13; g.stroke();
      g.beginPath(); g.moveTo(4, 44); g.lineTo(4, -26); g.arc(-8, -26, 12, 0, -2.4, true); g.strokeStyle = "rgba(255,255,255,0.55)"; g.lineWidth = 2.6; g.stroke();
    } });
  var stripeCache = {};
  function stripeCanvas(col) {   // a tile of diagonal stripes; the pattern is drawn in the prop's own units, so it scales with it
    if (stripeCache[col]) return stripeCache[col];
    var c = K.mk(16, 16), x = K.cx2(c);
    x.fillStyle = col; x.beginPath(); x.moveTo(0, 8); x.lineTo(8, 0); x.lineTo(13, 0); x.lineTo(0, 13); x.closePath(); x.fill();
    x.beginPath(); x.moveTo(8, 16); x.lineTo(16, 8); x.lineTo(16, 13); x.lineTo(13, 16); x.closePath(); x.fill();
    return (stripeCache[col] = c);
  }

  add("present", "Wrapped present", "christmas", { bw: 100, bh: 100, size: 0.3, at: [0.24, 0.74], tint: "#2f8f4e", tintLabel: "Wrap color", layer: "front",
    draw: function (g, col, t, O) {
      var c = hex(col), rib = hex("#f2c94c");
      g.beginPath(); g.rect(-36, -6, 72, 50); body(g, lgrad(g, -36, -6, 36, 44, c, 0.3, 0.35), 2.6);
      g.save(); g.clip(); g.fillStyle = lit(c, 0.35);
      for (var y = 0; y < 50; y += 12) for (var x = -36 + (y / 12 % 2) * 6; x < 40; x += 12) { circle(g, x, y - 2, 2); g.fill(); }
      g.restore();
      g.beginPath(); g.rect(-40, -20, 80, 16); body(g, lgrad(g, -40, -20, 40, -4, c, 0.4, 0.3), 2.6);
      g.save(); g.fillStyle = "rgba(0,0,0,0.2)"; g.fillRect(-36, -4, 72, 4); g.restore();
      g.beginPath(); g.rect(-6, -20, 12, 64); body(g, lgrad(g, -6, 0, 6, 0, rib, 0.4, 0.3), 2, true);
      [-1, 1].forEach(function (s) {
        g.beginPath(); g.moveTo(0, -22); g.bezierCurveTo(s * 10, -46, s * 34, -40, s * 24, -26); g.bezierCurveTo(s * 18, -20, s * 8, -20, 0, -22); g.closePath();
        body(g, lgrad(g, 0, -44, 0, -20, rib, 0.4, 0.35), 2.2);
        g.beginPath(); g.moveTo(s * 2, -22); g.quadraticCurveTo(s * 12, -16, s * 14, -6); g.lineTo(s * 8, -8); g.lineTo(s * 4, -4); g.quadraticCurveTo(s * 4, -14, 0, -20); g.closePath();
        body(g, lgrad(g, 0, -22, 0, -4, rib, 0.2, 0.4), 1.8, true);
      });
      circle(g, 0, -23, 6); body(g, rgrad(g, 0, -23, 6, rib), 2, true);
      gloss(g, -22, -16, 9, 2, 0.4);
    } });

  add("snowflakes", "Snowflakes", "christmas", { bw: 100, bh: 100, size: 0.5, at: [0.5, 0.3], tint: "#ffffff", tintLabel: "Snow color", layer: "front", scatter: true, anim: true,
    draw: function (g, col, t, O) {
      var R = rng(31 + (O.seed || 0) * 6151), p = O.drift === false ? 0 : loopP(t), c = hex(col);
      for (var i = 0; i < 8; i++) {
        var x = (R() - 0.5) * 84, y = (R() - 0.5) * 84, s = 6 + R() * 8, ph = R() * TAU, dir = R() < 0.5 ? -1 : 1;
        g.save();
        g.translate(x + Math.sin(TAU * p + ph) * 3, y + Math.sin(TAU * p * 2 + ph) * 1.5 + Math.sin(TAU * p) * 2);
        g.rotate(ph + dir * p * Math.PI / 3);   // a sixth of a turn per loop: the six-armed flake looks the same at both ends
        flake(g, s, c);
        g.restore();
      }
    } });
  function flake(g, s, c) {
    function arms() {
      g.beginPath();
      for (var k = 0; k < 6; k++) {
        var a = k * Math.PI / 3, ca = Math.cos(a), sa = Math.sin(a);
        g.moveTo(0, 0); g.lineTo(ca * s, sa * s);
        [0.45, 0.72].forEach(function (f) {
          var bx = ca * s * f, by = sa * s * f, l = s * (f < 0.5 ? 0.32 : 0.22);
          [-1, 1].forEach(function (d) { var b = a + d * Math.PI / 4; g.moveTo(bx, by); g.lineTo(bx + Math.cos(b) * l, by + Math.sin(b) * l); });
        });
      }
    }
    g.lineCap = "round"; g.lineJoin = "round";
    arms(); g.strokeStyle = "rgba(60,100,150,0.75)"; g.lineWidth = s * 0.3; g.stroke();
    arms(); g.strokeStyle = rgbStr(c); g.lineWidth = s * 0.15; g.stroke();
    circle(g, 0, 0, s * 0.16); g.fillStyle = rgbStr(mix(c, [200, 230, 255], 0.3)); g.fill();
  }

  add("mistletoe", "Mistletoe", "christmas", { bw: 90, bh: 100, size: 0.3, at: [0.5, 0.12], layer: "front",
    draw: function (g, col, t, O) {
      var lc = hex("#8cae40"), stems = [[-26, 26], [0, 38], [26, 26]];
      g.strokeStyle = "#5f7326"; g.lineWidth = 3; g.lineCap = "round";
      stems.forEach(function (e) { g.beginPath(); g.moveTo(0, -30); g.quadraticCurveTo(e[0] * 0.2, 0, e[0], e[1] - 14); g.stroke(); });
      // a pair of paddle leaves at the end of each stem, fanned out
      stems.forEach(function (e, i) {
        var a0 = Math.atan2(e[1] + 30, e[0]);
        [-0.5, 0.5].forEach(function (d, j) {
          g.save(); g.translate(e[0], e[1] - 14); g.rotate(a0 + d - Math.PI / 2);
          g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(-9, 6, -8, 24, 0, 28); g.bezierCurveTo(8, 24, 9, 6, 0, 0); g.closePath();
          body(g, lgrad(g, -8, 0, 8, 28, (i + j) % 2 ? mix(lc, BLACK, 0.15) : lc, 0.35, 0.35), 1.8);
          g.beginPath(); g.moveTo(0, 3); g.lineTo(0, 22); g.strokeStyle = "rgba(235,250,195,0.6)"; g.lineWidth = 1.2; g.stroke();
          g.restore();
        });
      });
      [[-24, 12], [-18, 16], [-22, 18], [0, 22], [5, 20], [-3, 26], [24, 12], [19, 16], [23, 18]].forEach(function (q) { ball(g, q[0], q[1], 4, hex("#f3efdf"), 1.3); });
      // the red bow at the top
      var rd = hex("#c8202a");
      [-1, 1].forEach(function (s) {
        g.beginPath(); g.moveTo(s * 2, -32); g.lineTo(s * 10, -16); g.lineTo(s * 5, -18); g.lineTo(s * 3, -14); g.closePath(); body(g, rgbStr(mix(rd, BLACK, 0.15)), 1.6, true);
        g.beginPath(); g.ellipse(s * 10, -36, 10, 6, s * 0.3, 0, TAU); body(g, lgrad(g, 0, -42, 0, -30, rd, 0.4, 0.3), 2, true);
      });
      circle(g, 0, -35, 4.5); body(g, rgrad(g, 0, -35, 4.5, rd), 1.8, true);
    } });

  // ---------- extras that fit ----------
  add("scarf", "Knit scarf", "christmas", { bw: 120, bh: 80, size: 0.6, at: [0.5, 0.74], tint: "#c8283a", tintLabel: "Scarf color", layer: "front",
    draw: function (g, col, t, O) {
      var c = hex(col);
      function stripes(x0, x1, y0, y1, vertical) {
        g.save(); g.clip(); g.fillStyle = "rgba(255,255,255,0.85)";
        for (var k = 0; k < 6; k++) { if (vertical) g.fillRect(x0, y0 + 8 + k * 16, x1 - x0, 5); else g.fillRect(x0 + 10 + k * 22, y0, 7, y1 - y0); }
        g.strokeStyle = "rgba(0,0,0,0.12)"; g.lineWidth = 1;
        for (var v = x0; v < x1; v += 4) { g.beginPath(); g.moveTo(v, y0); g.lineTo(v + 2, y1); g.stroke(); }
        g.restore();
      }
      // the hanging tail, then the wrap around the neck, then the knot
      g.beginPath(); g.moveTo(14, -2); g.lineTo(34, -2); g.quadraticCurveTo(36, 18, 32, 36); g.lineTo(12, 34); g.quadraticCurveTo(16, 16, 14, -2); g.closePath();
      body(g, lgrad(g, 12, -2, 36, 36, mix(c, BLACK, 0.08), 0.3, 0.35), 2.4); stripes(8, 40, -2, 40, true);
      g.beginPath(); g.moveTo(12, 34); g.lineTo(32, 36); g.strokeStyle = INK; g.lineWidth = 2.4; g.stroke();
      g.strokeStyle = rgbStr(mix(c, WHITE, 0.15)); g.lineWidth = 2; g.lineCap = "round";
      for (var f = 0; f < 6; f++) { var fx = 13 + f * 3.8; g.beginPath(); g.moveTo(fx, 35); g.lineTo(fx - 0.5, 42); g.stroke(); }
      g.beginPath(); g.moveTo(-56, -18); g.quadraticCurveTo(0, 2, 56, -18); g.lineTo(56, 2); g.quadraticCurveTo(0, 24, -56, 2); g.closePath();
      body(g, lgrad(g, 0, -18, 0, 20, c, 0.3, 0.35), 2.4); stripes(-60, 60, -20, 26, false);
      g.beginPath(); g.moveTo(-50, -12); g.quadraticCurveTo(0, 6, 50, -12); g.strokeStyle = "rgba(255,255,255,0.3)"; g.lineWidth = 2; g.stroke();
      g.beginPath(); g.ellipse(22, 6, 12, 9, 0.2, 0, TAU); body(g, rgrad(g, 22, 6, 12, c), 2.4, true);
    } });

  add("gingerbread", "Gingerbread person", "christmas", { bw: 80, bh: 100, size: 0.24, at: [0.78, 0.7], layer: "front",
    draw: function (g, col, t, O) {
      var c = hex("#b86a32");
      g.beginPath();
      g.arc(0, -28, 17, Math.PI * 0.72, Math.PI * 2.28);
      g.lineTo(30, -14); g.arc(30, -6, 8, -Math.PI / 2, Math.PI / 2); g.lineTo(14, 2);
      g.lineTo(20, 34); g.arc(13, 38, 8, -0.3, Math.PI * 0.95); g.lineTo(0, 22);
      g.lineTo(-5, 38); g.arc(-13, 38, 8, 0.05, Math.PI + 0.3); g.lineTo(-14, 2);
      g.lineTo(-30, 2); g.arc(-30, -6, 8, Math.PI / 2, Math.PI * 1.5); g.closePath();
      body(g, rgrad(g, 0, 0, 44, c, 0.3, 0.35), 2.6);
      g.strokeStyle = "#fffaf0"; g.lineWidth = 2.2; g.lineCap = "round"; g.lineJoin = "round";
      function zig(x0, y0, x1, y1) { g.beginPath(); for (var k = 0; k <= 4; k++) { var x = x0 + (x1 - x0) * k / 4, y = y0 + (y1 - y0) * k / 4 + (k % 2 ? 2.5 : -2.5); if (k) g.lineTo(x, y); else g.moveTo(x, y); } g.stroke(); }
      zig(26, -10, 34, -2); zig(-26, -10, -34, -2); zig(9, 36, 17, 40); zig(-9, 36, -17, 40);
      g.fillStyle = "#2a160a"; circle(g, -6, -31, 2.4); g.fill(); circle(g, 6, -31, 2.4); g.fill();
      g.beginPath(); g.arc(0, -26, 7, 0.3, Math.PI - 0.3); g.strokeStyle = "#fffaf0"; g.stroke();
      [["#d6202a", -6], ["#2f9a4a", 4], ["#d6202a", 14]].forEach(function (b) { ball(g, 0, b[1], 3.6, hex(b[0]), 1.2); });
      gloss(g, -8, -40, 6, 3, 0.25, -0.4);
    } });

  add("elfHat", "Elf hat", "christmas", { bw: 110, bh: 100, size: 0.46, at: [0.5, 0.15], tint: "#2f9a44", tintLabel: "Hat color", layer: "front",
    draw: function (g, col, t, O) {
      var c = hex(col), trim = hex("#d8262e");
      g.beginPath(); g.moveTo(-36, 20); g.bezierCurveTo(-30, -10, -6, -34, 22, -42); g.bezierCurveTo(34, -46, 44, -38, 40, -30);
      g.bezierCurveTo(36, -36, 28, -36, 22, -30); g.bezierCurveTo(14, -16, 28, 0, 36, 20); g.closePath();
      body(g, lgrad(g, -36, -42, 36, 20, c, 0.35, 0.4), 2.6);
      g.save(); g.clip(); g.beginPath(); g.moveTo(22, -30); g.bezierCurveTo(14, -16, 28, 0, 36, 20); g.lineTo(46, 20); g.lineTo(46, -40); g.fillStyle = dk(c, 0.28); g.fill(); g.restore();
      // a scalloped band with a gold bell at the tip
      g.beginPath(); g.moveTo(-42, 14);
      for (var i = 0; i < 7; i++) { var x = -42 + i * 12; g.lineTo(x + 6, 14); g.arc(x + 6, 28, 6, -Math.PI / 2, Math.PI / 2, false); }
      g.lineTo(42, 34); g.lineTo(-42, 34); g.closePath();
      g.beginPath(); g.moveTo(-42, 12); g.lineTo(42, 12); g.lineTo(42, 26);
      for (i = 6; i >= 0; i--) { x = -42 + i * 12 + 6; g.arc(x, 26, 6, 0, Math.PI, false); }
      g.closePath(); body(g, lgrad(g, 0, 12, 0, 32, trim, 0.35, 0.3), 2.4);
      g.beginPath(); g.moveTo(-40, 15); g.lineTo(40, 15); g.strokeStyle = "rgba(255,255,255,0.35)"; g.lineWidth = 1.6; g.stroke();
      ball(g, 41, -28, 6.5, hex("#e8b830"), 2);
      g.beginPath(); g.moveTo(38, -24); g.lineTo(44, -24); g.strokeStyle = "rgba(60,30,0,0.8)"; g.lineWidth = 1.4; g.stroke();
    } });

  add("bauble", "Ornament bauble", "christmas", { bw: 70, bh: 90, size: 0.18, at: [0.82, 0.28], tint: "#2a6fd6", tintLabel: "Bauble color", layer: "front",
    draw: function (g, col, t, O) {
      var c = hex(col), gold = hex("#e8b830");
      g.beginPath(); g.moveTo(0, -42); g.arc(0, -36, 5, -Math.PI / 2, Math.PI * 1.5); g.strokeStyle = "#8a6a20"; g.lineWidth = 2; g.stroke();
      circle(g, 0, 10, 30); body(g, rgrad(g, 0, 10, 30, c, 0.5, 0.5), 2.6);
      g.save(); circle(g, 0, 10, 30); g.clip();
      g.beginPath(); g.ellipse(0, 10, 32, 7, 0, 0, TAU); g.ellipse(0, 10, 32, 3, 0, 0, TAU); g.fillStyle = lgrad(g, 0, 3, 0, 17, gold, 0.4, 0.3); g.fill("evenodd");
      g.fillStyle = "rgba(255,255,255,0.85)"; [-18, -6, 6, 18].forEach(function (x) { circle(g, x, 10 + Math.abs(x) * 0.08, 1.6); g.fill(); });
      g.restore();
      g.beginPath(); g.rect(-8, -26, 16, 8); body(g, lgrad(g, -8, -26, 8, -18, gold, 0.45, 0.35), 2, true);
      g.fillStyle = "rgba(90,60,10,0.5)"; [-4, 0, 4].forEach(function (x) { g.fillRect(x - 0.6, -25, 1.2, 6); });
      gloss(g, -11, -4, 8, 5, 0.75, -0.6); gloss(g, 14, 26, 6, 2.5, 0.25, -0.7);
    } });

  var BY_ID = {};
  PROPS.forEach(function (d) { BY_ID[d.id] = d; });
  function byId(id) { return BY_ID[id] || null; }

  // ---------- the garland along the ring ----------
  // env: { shape, cx, cy, r0, r1 }, set by the page before each compose. The string runs along the band's middle; bulbs point outward.
  var ENV = null;
  function setEnv(e) { ENV = e; }
  function ringMid(e) { return (e.r0 + e.r1) / 2; }
  function isRing(O) { return O && O.type === "prop" && O.prop === "lights" && O.mode === "ring"; }
  function ringAngle(O, e) { return Math.atan2(O.y - e.cy, O.x - e.cx); }
  function snap(O, e) { e = e || ENV; if (!e || !isRing(O)) return; var q = K.shapePt(e.shape, e.cx, e.cy, ringMid(e), ringAngle(O, e)); O.x = q[0]; O.y = q[1]; }
  function drawRing(g, O, t, e) {
    var rm = ringMid(e), s = O.h * 0.52, span = Math.max(20, Math.min(360, O.span || 200)) / 360 * TAU, full = span >= TAU - 0.01;
    var a0 = ringAngle(O, e) - span / 2, len = K.shapePerim(e.shape, rm) * span / TAU, n = Math.max(2, Math.round(len / (s * 1.45)));
    var pins = [], i;
    for (i = 0; i <= n; i++) pins.push(K.shapePt(e.shape, e.cx, e.cy, rm, a0 + span * i / n));
    snap(O, e);
    g.save();
    g.beginPath(); g.moveTo(pins[0][0], pins[0][1]);
    var mids = [];
    for (i = 0; i < n; i++) {
      var A = pins[i], B = pins[i + 1], am = a0 + span * (i + 0.5) / n, q = K.shapePt(e.shape, e.cx, e.cy, rm, am), out = q[2] - Math.PI / 2, sag = -s * 0.3;
      var mx = q[0] + Math.cos(out) * sag, my = q[1] + Math.sin(out) * sag;
      g.quadraticCurveTo(2 * mx - (A[0] + B[0]) / 2, 2 * my - (A[1] + B[1]) / 2, B[0], B[1]);
      mids.push([mx, my, q[2]]);
    }
    g.strokeStyle = "rgba(10,24,14,0.8)"; g.lineWidth = Math.max(1.5, s * 0.16); g.lineCap = "round"; g.stroke();
    g.strokeStyle = "#2a5a32"; g.lineWidth = Math.max(1, s * 0.08); g.stroke();
    mids.forEach(function (m, k) { g.save(); g.translate(m[0], m[1]); g.rotate(m[2]); bulb(g, s, bulbCol(O, k), bulbB(O, t, k)); g.restore(); });
    if (!full) [pins[0], pins[n]].forEach(function (p) { g.fillStyle = "#1f4a2a"; g.beginPath(); g.arc(p[0], p[1], Math.max(1.5, s * 0.12), 0, TAU); g.fill(); });
    g.restore();
  }

  // ---------- placing and drawing ----------
  // O: { type: "prop", prop, x, y, w, h, rot, flip, color, layer: "front" | "under", seed, mode, span, multi, twinkle, drift }
  function draw(g, O, t, env) {
    var d = byId(O.prop); if (!d) return;
    if (isRing(O)) { var e = env || ENV; if (e) { drawRing(g, O, t || 0, e); return; } }
    g.save(); g.translate(O.x, O.y); g.rotate(O.rot || 0); if (O.flip) g.scale(-1, 1);
    g.scale(O.w / d.bw, O.h / d.bh); g.lineJoin = "round";
    d.draw(g, O.color || d.tint || "#888888", t || 0, O);
    g.restore();
  }
  function make(id, M, e) {
    var d = byId(id); if (!d) return null;
    var w = d.size * M, O = { type: "prop", prop: id, x: d.at[0] * M, y: d.at[1] * M, w: w, h: w * d.bh / d.bw, rot: 0, flip: false, color: d.tint || null,
      layer: d.layer || "front", seed: 0 };
    if (id === "lights") {
      O.mode = "ring"; O.span = 200; O.multi = true; O.twinkle = true; O.h = M * 0.11; O.w = O.h * 4;
      if (e) { var q = K.shapePt(e.shape, e.cx, e.cy, ringMid(e), -Math.PI / 2); O.x = q[0]; O.y = q[1]; }
    }
    if (id === "snowflakes") O.drift = true;
    return O;
  }
  function half(O) { return isRing(O) ? [O.h * 0.9, O.h * 0.9] : [O.w / 2, O.h / 2]; }
  // A ring garland is hit along its whole arc, not just its handle box.
  function hitRing(O, p, pad, e) {
    e = e || ENV; if (!e) return false;
    var a = Math.atan2(p[1] - e.cy, p[0] - e.cx), q = K.shapePt(e.shape, e.cx, e.cy, ringMid(e), a);
    if (Math.hypot(p[0] - q[0], p[1] - q[1]) > O.h * 0.9 + pad) return false;
    var span = Math.max(20, Math.min(360, O.span || 200)) / 360 * TAU, da = Math.atan2(Math.sin(a - ringAngle(O, e)), Math.cos(a - ringAngle(O, e)));
    return Math.abs(da) <= span / 2 + 0.05;
  }
  function moves(O) { return O && O.type === "prop" && ((O.prop === "lights" && O.twinkle !== false) || (O.prop === "snowflakes" && O.drift !== false)); }
  // Keeps only well-formed props from a project file (anything else in objs is left to the caller).
  function clean(O) {
    if (!O || O.type !== "prop") return O;
    if (!byId(O.prop)) return null;
    ["x", "y", "w", "h", "rot", "span", "seed"].forEach(function (k) { if (O[k] !== undefined) O[k] = +O[k] || 0; });
    if (!(O.w > 0) || !(O.h > 0)) return null;
    O.flip = !!O.flip; O.layer = O.layer === "under" ? "under" : "front";
    if (O.color && !/^#[0-9a-f]{6}$/i.test(O.color)) O.color = byId(O.prop).tint || null;
    return O;
  }
  function thumb(id, N, dark) {   // a small canvas showing the prop, for the picker
    var d = byId(id), c = K.mk(N), g = K.cx2(c), fit = N * 0.86, k = Math.min(fit / d.bw, fit / d.bh);
    var O = { type: "prop", prop: id, x: N / 2, y: N / 2, w: d.bw * k, h: d.bh * k, rot: 0, color: d.tint || null, seed: 0 };
    if (id === "lights") { O.w = N * 0.95; O.h = O.w / 4; O.multi = true; }
    draw(g, O, 0, null);
    return c;
  }

  TG.props = { PROPS: PROPS, byId: byId, draw: draw, make: make, half: half, hitRing: hitRing, isRing: isRing, snap: snap, setEnv: setEnv,
    moves: moves, clean: clean, thumb: thumb, GROUPS: [["thanksgiving", "Thanksgiving"], ["christmas", "Christmas"]] };
}());
