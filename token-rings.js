/* Table Goblin token creator: noise helpers, token shapes and the procedural ring styles. Everything here only draws on canvases in
   this browser. Loaded by token-creator.html before token-creator.js. */
(function () {
  "use strict";
  var TG = window.TGTok = window.TGTok || {};
  var TAU = Math.PI * 2, SQ3 = Math.sqrt(3), LX = -0.55, LY = -0.835;   // light from the top left
  function mk(w, h) { var c = document.createElement("canvas"); c.width = w; c.height = h || w; return c; }
  function cx2(c, read) { return c.getContext("2d", read ? { willReadFrequently: true } : undefined); }
  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function smooth(e0, e1, x) { var t = clamp01((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); }
  function hex(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
  function toHex(c) { return "#" + c.map(function (v) { return ("0" + Math.max(0, Math.min(255, Math.round(v))).toString(16)).slice(-2); }).join(""); }
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function mul(a, k) { return [a[0] * k, a[1] * k, a[2] * k]; }
  function rgbStr(c, a) { return "rgba(" + Math.round(c[0]) + "," + Math.round(c[1]) + "," + Math.round(c[2]) + "," + (a === undefined ? 1 : a) + ")"; }
  function hsl(h, s, l) {
    h = ((h % 1) + 1) % 1;
    function f(n) { var k = (n + h * 12) % 12, a = s * Math.min(l, 1 - l); return 255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))); }
    return [f(0), f(8), f(4)];
  }
  var WHITE = [255, 255, 255];

  // ---------- noise ----------
  function hash2(ix, iy, s) {
    var h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(s, 2246822519);
    h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  function vnoise(x, y, s) {
    var ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    var a = hash2(ix, iy, s), b = hash2(ix + 1, iy, s), c = hash2(ix, iy + 1, s), d = hash2(ix + 1, iy + 1, s);
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
  }
  function fbm(x, y, s, oct) {
    var v = 0, amp = 0.5, f = 1, tot = 0;
    for (var i = 0; i < oct; i++) { v += amp * vnoise(x * f, y * f, s + i * 17); tot += amp; amp *= 0.5; f *= 2; }
    return v / tot;
  }
  function rng(seed) {
    var a = seed >>> 0;
    return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function crackAt(u, v, f, s, w) { return 1 - smooth(0, w, Math.abs(fbm(u * f, v * f, s, 4) - 0.5)); }

  // ---------- animation time ----------
  // Every ring, texture and object takes a time t in seconds (0 for a still token). Animated looks repeat every R.loop seconds, so an
  // exported loop has no jump. phase() is 0..TAU over one loop.
  // glow: how brightly the light-emitting ring styles shine (0 unlit .. 2 wide and bright); flick: their flicker, "off" | "subtle" | "strong"
  // len, count: a Sculpted ring's Length and Count (1 and 16 by default); tintOn: "Tint every style" for the ring being painted
  var R = { loop: 1.5, glow: 1, flick: "strong", len: 1, count: 16, tintOn: false };
  function glowSpread() { return 0.4 + 0.6 * R.glow; }   // scales the halo's blur and width: 0.4 at Glow 0, 1 at 100%, 1.6 at 200%
  function phase(t) { return (t || 0) / R.loop * TAU; }
  function frac(x) { return x - Math.floor(x); }
  // mode: "off" (steady), "subtle" (a gentle pulse, no dips) or "strong" (a pulse plus two quick dips per loop); the ring's own by default
  function neonFlicker(t, mode) {   // 1 when still
    mode = mode || R.flick;
    if (!t || mode === "off") return 1;
    if (mode === "subtle") return 0.94 + 0.06 * Math.sin(phase(t));
    var f = frac(t / R.loop), v = 0.9 + 0.1 * Math.sin(phase(t) * 2);
    if ((f > 0.6 && f < 0.64) || (f > 0.69 && f < 0.71)) v *= 0.55;
    return v;
  }

  // ---------- token shapes ----------
  // A shape is a circle or a regular polygon. Polygon sizes are apothems (center to the middle of a side), so a ring band of thickness b
  // is the outline inset by b and the "radius" of any point is its distance to the farthest side line: corners join as miters. The
  // ring's angle coordinate runs evenly along each side, so patterns spaced by angle stay evenly spaced on every side.
  // fit: the outer apothem as a share of the token's half size; oy: how far the shape's center sits below the token's center.
  var SHAPES = [
    { id: "circle", label: "Round", n: 0, phi: 0, fit: 1, oy: 0 },
    { id: "square", label: "Square", n: 4, phi: 0, fit: 1, oy: 0 },
    { id: "hexp", label: "Hex, pointy top", n: 6, phi: 0, fit: Math.cos(Math.PI / 6), oy: 0 },
    { id: "hexf", label: "Hex, flat top", n: 6, phi: Math.PI / 6, fit: Math.cos(Math.PI / 6), oy: 0 },
    { id: "oct", label: "Octagon", n: 8, phi: 0, fit: 1, oy: 0 },
    { id: "tri", label: "Triangle", n: 3, phi: -Math.PI / 6, fit: 1 / SQ3, oy: 1 / (2 * SQ3) }
  ];
  SHAPES.forEach(function (s) {
    if (!s.n) return;
    s.nu = []; s.cs = []; s.sn = [];
    for (var k = 0; k < s.n; k++) { var a = s.phi + k * TAU / s.n; a = Math.atan2(Math.sin(a), Math.cos(a)); s.nu.push(a); }
    s.nu.sort(function (a, b) { return a - b; });
    s.nu.forEach(function (a) { s.cs.push(Math.cos(a)); s.sn.push(Math.sin(a)); });
    s.half = Math.PI / s.n; s.tn = Math.tan(s.half);
  });
  function shapeById(id) { for (var i = 0; i < SHAPES.length; i++) if (SHAPES[i].id === id) return SHAPES[i]; return SHAPES[0]; }
  function wrapA(a) { return a - TAU * Math.floor((a + Math.PI) / TAU); }   // to [-PI, PI)
  function shapeRad(s, dx, dy) {
    if (!s.n) return Math.sqrt(dx * dx + dy * dy);
    var best = -1e9, cs = s.cs, sn = s.sn;
    for (var k = 0; k < s.n; k++) { var v = dx * cs[k] + dy * sn[k]; if (v > best) best = v; }
    return best;
  }
  // Fills o with d (radius), a (angle coordinate) and the outward normal (nx, ny).
  function shapeInfo(s, dx, dy, o) {
    if (!s.n) { var d = Math.sqrt(dx * dx + dy * dy); o.d = d; o.a = Math.atan2(dy, dx); o.nx = d ? dx / d : 0; o.ny = d ? dy / d : 0; return o; }
    var best = -1e9, bi = 0, cs = s.cs, sn = s.sn;
    for (var k = 0; k < s.n; k++) { var v = dx * cs[k] + dy * sn[k]; if (v > best) { best = v; bi = k; } }
    var u = best > 1e-6 ? (-dx * sn[bi] + dy * cs[bi]) / (best * s.tn) : 0;
    o.d = best; o.a = wrapA(s.nu[bi] + Math.max(-1, Math.min(1, u)) * s.half); o.nx = cs[bi]; o.ny = sn[bi];
    return o;
  }
  // The point at radius r and angle coordinate th, and the angle a glyph there is turned by (upright at the top).
  function shapePt(s, cx, cy, r, th) {
    if (!s.n) return [cx + Math.cos(th) * r, cy + Math.sin(th) * r, th + Math.PI / 2];
    var bi = 0, bd = 9;
    for (var k = 0; k < s.n; k++) { var dd = Math.abs(wrapA(th - s.nu[k])); if (dd < bd) { bd = dd; bi = k; } }
    var u = wrapA(th - s.nu[bi]) / s.half;
    return [cx + r * (s.cs[bi] - s.sn[bi] * u * s.tn), cy + r * (s.sn[bi] + s.cs[bi] * u * s.tn), s.nu[bi] + Math.PI / 2];
  }
  // Adds a closed outline at radius r as a subpath (callers begin the path).
  function shapeOutline(g, s, cx, cy, r) {
    if (r <= 0) return;
    if (!s.n) { g.moveTo(cx + r, cy); g.arc(cx, cy, r, 0, TAU); g.closePath(); return; }
    var R0 = r / Math.cos(s.half);
    for (var k = 0; k < s.n; k++) {
      var a = s.nu[k] + s.half, x = cx + Math.cos(a) * R0, y = cy + Math.sin(a) * R0;
      if (k) g.lineTo(x, y); else g.moveTo(x, y);
    }
    g.closePath();
  }
  // Continues the current path along the outline at radius r from angle a0 to a1 (a1 > a0), like g.arc does for a circle.
  function shapeArc(g, s, cx, cy, r, a0, a1) {
    if (!s.n) { g.arc(cx, cy, r, a0, a1); return; }
    var stops = [a0];
    for (var m = -1; m <= 2; m++) for (var k = 0; k < s.n; k++) { var va = s.nu[k] + s.half + m * TAU; if (va > a0 && va < a1) stops.push(va); }
    stops.push(a1); stops.sort(function (x, y) { return x - y; });
    stops.forEach(function (a) { var q = shapePt(s, cx, cy, r, a); g.lineTo(q[0], q[1]); });
  }
  function shapePerim(s, r) { return s.n ? 2 * s.n * r * s.tn : TAU * r; }

  // The geometry the ring decorations draw along: the shape and its center on the canvas being painted.
  var cur = { s: SHAPES[0], cx: 0, cy: 0 };
  function rp(r, th) { return shapePt(cur.s, cur.cx, cur.cy, r, th); }
  function rarc(g, r, a0, a1) { shapeArc(g, cur.s, cur.cx, cur.cy, r, a0, a1); }
  function rring(g, r) { shapeOutline(g, cur.s, cur.cx, cur.cy, r); }
  function rper(r) { return shapePerim(cur.s, r); }
  // ---------- ring styles (procedural, drawn per pixel, then decorations, glow and overlays) ----------
  // pix(p, col, t) returns [r, g, b] or [r, g, b, alpha]. Shades: round or flat bevels lit from the top left, "emit" (light, no bevel),
  // or a custom function. deco is clipped to the band; glow is drawn unclipped and added as light; over is drawn unclipped on top.
  var ROUND = { kind: "round", k: 0.55, spec: 0.35 }, GLOSS = { kind: "round", k: 0.75, spec: 0.8 }, METAL = { kind: "round", k: 0.95, spec: 0.9 },
      FLAT = { kind: "flat", k: 0.5, spec: 0.15 }, SOFT = { kind: "round", k: 0.4, spec: 0.1 }, EMIT = { kind: "emit" };
  function metalPix(dk, lt) {
    var D = hex(dk), L = hex(lt);
    return function (p, col, t) {
      var s = 0.5 + 0.3 * Math.sin(p.a * 2 + 0.7) + 0.17 * Math.sin(p.a * 5 + 2.1);
      var br = vnoise(p.dn * 900, 0.5, 11) - 0.5;
      return mix(D, L, clamp01(s + br * 0.28));
    };
  }
  function woodPix(dk, lt, seed) {
    var D = hex(dk), L = hex(lt);
    return function (p, col, t) {
      var w = p.t * 3.2 + fbm(p.u * 5, p.v * 5, seed, 3) * 3;
      var g = 0.5 + 0.5 * Math.sin(w * Math.PI * 2);
      var fib = vnoise(p.u * 260 + p.v * 40, p.v * 260 - p.u * 40, seed + 3);
      return mix(D, L, clamp01(g * 0.72 + fib * 0.28));
    };
  }
  function fbmPix(dk, lt, f, seed) { var D = hex(dk), L = hex(lt); return function (p, col, t) { return mix(D, L, fbm(p.u * f, p.v * f, seed, 3)); }; }

  var GLYPHS = [
    [[0, -.5, 0, .5], [0, -.5, .3, -.25], [0, -.15, .3, .1]],
    [[0, -.5, 0, .5], [0, -.5, .3, -.2], [.3, -.2, .3, .5]],
    [[0, -.5, 0, .5], [0, -.25, .28, 0], [.28, 0, 0, .25]],
    [[0, -.5, 0, .5], [0, -.5, -.28, -.2], [0, -.5, .28, -.2]],
    [[0, -.5, 0, .5], [-.28, -.2, .28, .2]],
    [[-.28, -.5, .28, .5], [.28, -.5, -.28, .5]],
    [[0, -.5, 0, .5], [0, -.1, .28, -.35], [0, -.1, -.28, -.35]],
    [[-.2, -.5, -.2, .5], [.2, -.5, .2, .5], [-.2, -.2, .2, .1]],
    [[.2, -.5, -.15, -.15], [-.15, -.15, .15, .15], [.15, .15, -.2, .5]],
    [[0, -.5, 0, .5], [0, -.5, .25, -.3], [.25, -.3, 0, -.1], [0, -.1, .25, .1], [.25, .1, 0, .3]],
    [[-.25, -.5, -.25, .5], [.25, -.5, .25, .5], [-.25, -.5, .25, -.2], [.25, -.5, -.25, -.2]],
    [[0, -.5, 0, .5], [0, .5, .28, .3]],
    [[0, -.5, .28, 0], [.28, 0, 0, .5], [0, .5, -.28, 0], [-.28, 0, 0, -.5]],
    [[-.25, -.5, -.25, .5], [-.25, -.5, .25, -.2], [.25, -.2, -.25, .1]],
    [[0, -.5, 0, .5], [-.28, -.1, .28, -.1], [-.28, .15, .28, .15]],
    [[-.28, -.35, .28, .35], [0, -.5, 0, .5]]
  ];
  function glyphPath(g, gl, h) { g.beginPath(); gl.forEach(function (s) { g.moveTo(s[0] * h, s[1] * h); g.lineTo(s[2] * h, s[3] * h); }); }
  function runesDeco(mode, color) {
    return function (g, N, r0, r1, col, t) {
      var band = r1 - r0, rm = (r0 + r1) / 2, h = band * 0.56;
      var n = Math.max(8, Math.floor(rper(rm) / (h * 0.95)));
      g.lineCap = "round"; g.lineJoin = "round";
      for (var k = 0; k < n; k++) {
        var th = k / n * TAU, q = rp(rm, th);
        g.save(); g.translate(q[0], q[1]); g.rotate(q[2]);
        var gl = GLYPHS[(k * 7 + 3) % GLYPHS.length];
        if (mode === "carve") {
          glyphPath(g, gl, h); g.strokeStyle = "rgba(0,0,0,0.62)"; g.lineWidth = h * 0.15; g.stroke();
          g.translate(h * 0.03, h * 0.045); glyphPath(g, gl, h); g.strokeStyle = "rgba(255,255,255,0.2)"; g.lineWidth = h * 0.05; g.stroke();
        } else {
          // glowing runes pulse one after another around the ring when animated
          var pulse = t ? 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(phase(t) - k / n * TAU * 2)) : 1;
          g.globalAlpha = pulse; g.shadowColor = color; g.shadowBlur = h * 0.5 * (0.6 + 0.6 * pulse); glyphPath(g, gl, h); g.strokeStyle = color; g.lineWidth = h * 0.12; g.stroke(); g.stroke();
          g.shadowBlur = 0; glyphPath(g, gl, h); g.strokeStyle = "rgba(255,255,255,0.75)"; g.lineWidth = h * 0.04; g.stroke(); g.globalAlpha = 1;
        }
        g.restore();
      }
    };
  }
  function rivet(g, x, y, sr) {
    g.fillStyle = "rgba(0,0,0,0.45)"; g.beginPath(); g.arc(x + sr * 0.18, y + sr * 0.25, sr, 0, TAU); g.fill();
    var gr = g.createRadialGradient(x - sr * 0.35, y - sr * 0.35, sr * 0.1, x, y, sr);
    gr.addColorStop(0, "#ffffff"); gr.addColorStop(0.35, "#d7dbe0"); gr.addColorStop(1, "#4d535a");
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, sr, 0, TAU); g.fill();
  }
  function studsDeco(g, N, r0, r1, col, t) {
    var band = r1 - r0, rm = (r0 + r1) / 2, sr = band * 0.17, n = Math.max(8, Math.round(rper(rm) / (band * 1.25)));
    for (var k = 0; k < n; k++) { var q = rp(rm, k / n * TAU); rivet(g, q[0], q[1], sr); }
  }
  function stitchDeco(g, N, r0, r1, col, t) {
    var band = r1 - r0;
    g.setLineDash([band * 0.16, band * 0.11]); g.lineCap = "round";
    [r0 + band * 0.2, r1 - band * 0.2].forEach(function (r) {
      g.save(); g.translate(band * 0.01, band * 0.015); g.strokeStyle = "rgba(0,0,0,0.45)"; g.lineWidth = band * 0.07; g.beginPath(); rring(g, r); g.stroke(); g.restore();
      g.strokeStyle = "rgba(236,214,170,0.92)"; g.lineWidth = band * 0.045; g.beginPath(); rring(g, r); g.stroke();
    });
    g.setLineDash([]);
  }
  function vineDeco(g, N, r0, r1, col, t) {
    var band = r1 - r0, rm = (r0 + r1) / 2, R2 = rng(77), waves = 14, i, q;
    g.strokeStyle = "#3b5420"; g.lineWidth = band * 0.07; g.lineCap = "round"; g.lineJoin = "round"; g.beginPath();
    for (i = 0; i <= 720; i++) { var a = i / 720 * TAU; q = rp(rm + Math.sin(a * waves) * band * 0.18, a); if (i) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]); }
    g.stroke();
    var n = Math.max(10, Math.round(rper(rm) / (band * 0.5))), greens = ["#4f7d2a", "#6a9a35", "#87b347", "#3e6b23"];
    for (i = 0; i < n; i++) {
      var th = i / n * TAU + R2() * 0.05, side = i % 2 ? 1 : -1;
      q = rp(rm + Math.sin(th * waves) * band * 0.18 + side * band * 0.1, th);
      var len = band * (0.34 + R2() * 0.12), wid = band * (0.13 + R2() * 0.05);
      g.save(); g.translate(q[0], q[1]); g.rotate(q[2] + side * 0.75);
      g.fillStyle = "rgba(0,0,0,0.3)"; g.beginPath(); g.ellipse(len * 0.05, len * 0.06, len / 2, wid / 2, 0, 0, TAU); g.fill();
      g.fillStyle = greens[Math.floor(R2() * greens.length)]; g.beginPath(); g.ellipse(0, 0, len / 2, wid / 2, 0, 0, TAU); g.fill();
      g.strokeStyle = "rgba(20,40,10,0.55)"; g.lineWidth = Math.max(0.6, band * 0.012); g.beginPath(); g.moveTo(-len / 2, 0); g.lineTo(len / 2, 0); g.stroke();
      g.restore();
    }
  }
  function sparkle(g, x, y, L) {
    g.beginPath(); g.moveTo(x, y - L); g.lineTo(x + L * 0.18, y); g.lineTo(x, y + L); g.lineTo(x - L * 0.18, y); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(x - L, y); g.lineTo(x, y + L * 0.18); g.lineTo(x + L, y); g.lineTo(x, y - L * 0.18); g.closePath(); g.fill();
  }
  function starDeco(g, N, r0, r1, col, t) {
    var band = r1 - r0, R2 = rng(9), n = Math.round(rper((r0 + r1) / 2) / band * 6), i, q;
    for (i = 0; i < n; i++) {
      var th = R2() * TAU, r = r0 + band * (0.15 + R2() * 0.7), s = band * (0.012 + R2() * 0.03);
      q = rp(r, th); g.fillStyle = "rgba(255,255,240," + (0.45 + R2() * 0.55).toFixed(2) + ")"; g.beginPath(); g.arc(q[0], q[1], s, 0, TAU); g.fill();
    }
    g.fillStyle = "#fff8d8";
    for (i = 0; i < 12; i++) { var t2 = R2() * TAU, r2 = r0 + band * (0.3 + R2() * 0.4); q = rp(r2, t2); sparkle(g, q[0], q[1], band * (0.12 + R2() * 0.08)); }
    g.strokeStyle = "#d9b45a"; g.lineWidth = band * 0.045;
    [r0 + band * 0.06, r1 - band * 0.06].forEach(function (r) { g.beginPath(); rring(g, r); g.stroke(); });
  }
  function emberGlow(g, N, r0, r1, col, t) {   // sparks drifting out of the cracks; they rise once per loop when animated
    var band = r1 - r0, R2 = rng(4711), n = Math.max(14, Math.round(rper(r1) / band * 2.2)), f = t ? t / R.loop : 0;
    for (var i = 0; i < n; i++) {
      var th = R2() * TAU, off = R2(), sp = 1 + Math.floor(R2() * 2), life = frac(off + f * sp), drift = (R2() - 0.5) * 0.5;
      var r = r0 + band * (0.2 + life * 1.05), q = rp(r, th + drift * life * band / Math.max(1, r)), s = Math.max(0.6, band * (0.02 + R2() * 0.025));
      var a = Math.sin(life * Math.PI) * 0.9;
      if (a <= 0.02) continue;
      var gr = g.createRadialGradient(q[0], q[1], 0, q[0], q[1], s * 3);
      gr.addColorStop(0, "rgba(255,236,170," + a.toFixed(3) + ")"); gr.addColorStop(0.4, "rgba(255,120,30," + (a * 0.6).toFixed(3) + ")"); gr.addColorStop(1, "rgba(255,60,0,0)");
      g.fillStyle = gr; g.beginPath(); g.arc(q[0], q[1], s * 3, 0, TAU); g.fill();
    }
  }

  var STYLES = [];
  function add(fam, name, pix, shade, deco, extra) {
    var st = { id: fam + ":" + name, fam: fam, name: name, pix: pix, shade: shade, deco: deco || null, glow: null, over: null, anim: false, usesColor: fam === "Painted" };
    if (extra) Object.keys(extra).forEach(function (k) { st[k] = extra[k]; });
    STYLES.push(st);
  }
  // Painted: the ring color
  add("Painted", "Flat", function (p, col, t) { return col; }, FLAT);
  add("Painted", "Glossy", function (p, col, t) { return col; }, GLOSS);
  add("Painted", "Double", function (p, col, t) { return p.t > 0.42 && p.t < 0.58 ? mul(col, 0.42) : col; }, ROUND);
  add("Painted", "Studded", function (p, col, t) { return col; }, FLAT, studsDeco);
  add("Painted", "Rope", function (p, col, t) { return mul(col, 0.68 + 0.45 * (0.5 + 0.5 * Math.sin(p.a * 40 + p.t * 4.5))); }, ROUND);
  add("Painted", "Striped", function (p, col, t) { return Math.floor((p.a / TAU + 0.5) * 16) % 2 ? mix(col, WHITE, 0.6) : col; }, ROUND);
  // Metal
  [["Gold", "#6a4a10", "#ffe48a"], ["Silver", "#5a6068", "#f5f7fa"], ["Bronze", "#5a3512", "#e2a467"], ["Iron", "#26292d", "#a2abb4"],
   ["Copper", "#5c2a14", "#f2a27c"], ["Mithral", "#45657e", "#eaf6ff"], ["Black steel", "#0f1114", "#5b636c"], ["Rose gold", "#7a4040", "#ffd0c0"]]
    .forEach(function (m) { add("Metal", m[0], metalPix(m[1], m[2]), METAL); });
  // Carved runes
  add("Runes", "Stone", fbmPix("#5c5a56", "#9a978f", 9, 101), SOFT, runesDeco("carve"));
  add("Runes", "Gilded", metalPix("#6a4a10", "#ffe48a"), METAL, runesDeco("carve"));
  add("Runes", "Oak", woodPix("#6b4423", "#b07b4c", 5), ROUND, runesDeco("carve"));
  add("Runes", "Arcane", fbmPix("#141230", "#36306e", 7, 102), SOFT, runesDeco("glow", "#8fd3ff"), { anim: true });
  add("Runes", "Infernal", fbmPix("#220a0a", "#5c1a12", 7, 103), SOFT, runesDeco("glow", "#ff7a3c"), { anim: true });
  add("Runes", "Fey", fbmPix("#102c1e", "#2c5e3e", 7, 104), SOFT, runesDeco("glow", "#b8ffb0"), { anim: true });
  add("Runes", "Frost", fbmPix("#6e8496", "#c4d6e4", 7, 105), SOFT, runesDeco("glow", "#3fc4ff"), { anim: true });
  // Wood
  [["Oak", "#6b4423", "#b07b4c"], ["Walnut", "#3a2314", "#74502f"], ["Birch", "#b59a6b", "#ecdcb6"], ["Ebony", "#120e0c", "#3f302a"],
   ["Mahogany", "#4a1a10", "#9a4a2c"], ["Driftwood", "#7d786e", "#c8c2b4"]]
    .forEach(function (w, i) { add("Wood", w[0], woodPix(w[1], w[2], 200 + i), ROUND); });
  // Stone
  add("Stone", "Granite", function (p, col, t) {
    var base = mix([88, 86, 84], [150, 146, 140], fbm(p.u * 10, p.v * 10, 4, 3)), sp = hash2(Math.floor(p.u * 420), Math.floor(p.v * 420), 5);
    return sp < 0.12 ? mul(base, 0.45) : sp > 0.93 ? mix(base, [235, 230, 225], 0.6) : base;
  }, ROUND);
  add("Stone", "Marble", function (p, col, t) {
    var m = Math.sin((p.u * 3 + p.v * 2) * Math.PI * 2 + fbm(p.u * 4, p.v * 4, 21, 4) * 8), vein = Math.pow(1 - Math.abs(m), 10);
    return mix(mix([238, 235, 228], [205, 200, 192], fbm(p.u * 6, p.v * 6, 22, 2)), [110, 108, 112], vein * 0.8);
  }, GLOSS);
  add("Stone", "Slate", function (p, col, t) { return mix([40, 46, 52], [100, 108, 116], fbm(p.u * 3 + p.v * 1.5, p.v * 22 - p.u * 6, 23, 3)); }, FLAT);
  add("Stone", "Sandstone", function (p, col, t) {
    var b = 0.5 + 0.5 * Math.sin(p.t * 9 + fbm(p.u * 4, p.v * 4, 31, 3) * 5);
    return mix([160, 112, 66], [226, 190, 138], b * 0.8 + hash2(Math.floor(p.u * 500), Math.floor(p.v * 500), 32) * 0.2);
  }, ROUND);
  add("Stone", "Blocks", function (p, col, t) {
    var f = (p.a / TAU + 0.5) * 14, bi = Math.floor(f), fr = f - bi;
    if (fr < 0.035 || fr > 0.965 || p.t < 0.07 || p.t > 0.93) return [52, 49, 45];
    var e = Math.min(fr, 1 - fr, (p.t - 0.07) * 0.6, (0.93 - p.t) * 0.6), lip = smooth(0, 0.06, e);
    return mul(mix([109, 106, 99], [168, 163, 152], hash2(bi, 7, 3) * 0.6 + fbm(p.u * 14, p.v * 14, 9, 3) * 0.5), 0.78 + 0.22 * lip);
  }, FLAT);
  add("Stone", "Obsidian", function (p, col, t) { return mix([8, 8, 12], [52, 44, 72], fbm(p.u * 5, p.v * 5, 41, 3) * 0.85); }, { kind: "round", k: 0.9, spec: 1.2 });
  // More
  add("More", "Bone", function (p, col, t) {
    var base = mix([190, 177, 144], [244, 236, 214], fbm(p.u * 7, p.v * 7, 51, 3));
    return hash2(Math.floor(p.u * 300), Math.floor(p.v * 300), 52) < 0.05 ? mul(base, 0.8) : base;
  }, ROUND);
  add("More", "Jade", fbmPix("#145038", "#7ccb98", 6, 61), GLOSS);
  add("More", "Leather", fbmPix("#3e2212", "#7a4a2a", 12, 71), FLAT, stitchDeco);
  add("More", "Ice", function (p, col, t) {
    return mix(mix([150, 195, 225], [232, 246, 255], fbm(p.u * 5, p.v * 5, 81, 3)), WHITE, crackAt(p.u, p.v, 8, 82, 0.03) * 0.85);
  }, GLOSS);
  add("More", "Ember", function (p, col, t) {
    var rock = mix([24, 16, 14], [64, 42, 34], fbm(p.u * 8, p.v * 8, 91, 3)), cr = crackAt(p.u, p.v, 7, 92, 0.05);
    var glow = t ? 0.85 + 0.15 * Math.sin(phase(t) + p.u * 9) : 1;
    return mix(rock, mul(mix([255, 80, 16], [255, 226, 130], cr), glow), cr);
  }, SOFT, null, { glow: emberGlow, anim: true });
  add("More", "Vines", woodPix("#3c2c1a", "#6a5232", 300), ROUND, vineDeco);
  add("More", "Starry", function (p, col, t) { return mix([10, 14, 38], [40, 46, 100], fbm(p.u * 4, p.v * 4, 95, 3)); }, SOFT, starDeco);

  // Tech (sci-fi). Patterns that repeat around the ring use a whole number of cells, so there is no seam where the angle wraps.
  function steelPix(p, col, t) { return mix([60, 68, 76], [170, 180, 190], clamp01(0.5 + 0.3 * Math.sin(p.a * 2 + 0.7) + (vnoise(p.dn * 900, 0.5, 13) - 0.5) * 0.35)); }
  function hexCell(x, y) {   // pointy-top hexes of circumradius 1: axial cell and h = 0 at the center, 1 at the edge
    var qf = SQ3 / 3 * x - y / 3, rf = 2 / 3 * y, sf = -qf - rf, q = Math.round(qf), r = Math.round(rf), s = Math.round(sf);
    var dq = Math.abs(q - qf), dr = Math.abs(r - rf), ds = Math.abs(s - sf);
    if (dq > dr && dq > ds) q = -r - s; else if (dr > ds) r = -q - s;
    var dx = x - SQ3 * (q + r / 2), dy = y - 1.5 * r;
    return { q: q, r: r, h: Math.max(Math.abs(dx), Math.abs(0.5 * dx + SQ3 / 2 * dy), Math.abs(0.5 * dx - SQ3 / 2 * dy)) / (SQ3 / 2) };
  }
  function circuitDeco(g, N, r0, r1, col, t) {
    var band = r1 - r0, R2 = rng(4242), tr = [0.25, 0.5, 0.75], copper = "#d9a441", lw = Math.max(0.5, band * 0.05), pr = Math.max(0.7, band * 0.07), i;
    function pad(r, a) {
      var q = rp(r, a);
      g.fillStyle = copper; g.beginPath(); g.arc(q[0], q[1], pr, 0, TAU); g.fill();
      g.fillStyle = "#06150d"; g.beginPath(); g.arc(q[0], q[1], pr * 0.45, 0, TAU); g.fill();
    }
    g.lineCap = "round"; g.lineJoin = "round";
    var scale = rper((r0 + r1) / 2) / (TAU * (r0 + r1) / 2);
    for (i = 0; i < 36; i++) {
      var ti = Math.floor(R2() * 3), r = r0 + band * tr[ti], a0 = R2() * TAU - Math.PI, a1 = a0 + band * (0.6 + R2() * 2.4) / (r * scale), jog = R2() < 0.55, start = R2() < 0.4;
      g.strokeStyle = copper; g.lineWidth = lw; g.beginPath(); var q0 = rp(r, a0); g.moveTo(q0[0], q0[1]); rarc(g, r, a0, a1);
      if (jog) {
        var tj = ti === 1 ? (R2() < 0.5 ? 0 : 2) : 1, r2 = r0 + band * tr[tj], a2 = a1 + Math.abs(r2 - r) / (r * scale), a3 = a2 + band * (0.3 + R2() * 1.2) / (r2 * scale);
        var q2 = rp(r2, a2); g.lineTo(q2[0], q2[1]); rarc(g, r2, a2, a3); g.stroke(); pad(r2, a3);
      } else { g.stroke(); pad(r, a1); }
      if (start) pad(r, a0);
    }
    var led = rgbStr(mix(col, WHITE, 0.45));
    for (i = 0; i < 6; i++) {
      var q = rp(r0 + band * (R2() < 0.5 ? 0.375 : 0.625), R2() * TAU);
      g.shadowColor = led; g.shadowBlur = band * 0.3 * R.glow; g.fillStyle = R.glow > 0.05 ? led : "#3a3f2a"; g.beginPath(); g.arc(q[0], q[1], Math.max(0.7, band * 0.055), 0, TAU); g.fill();
    }
    g.shadowBlur = 0;
  }
  function hullDeco(g, N, r0, r1, col, t) {
    var band = r1 - r0, R2 = rng(515), sr = band * 0.17 * 0.55, k, q;
    for (k = 0; k < 10; k++) {
      var th = k / 10 * TAU - Math.PI;
      [0.22, 0.78].forEach(function (tt) { var r = r0 + band * tt, qq = rp(r, th + sr * 2.1 / r); rivet(g, qq[0], qq[1], sr); });
    }
    g.lineCap = "round";
    for (k = 0; k < 14; k++) {
      var sa = R2() * TAU, srr = r0 + band * (0.15 + R2() * 0.7), da = band * (0.15 + R2() * 0.35) / srr, dr = band * (R2() - 0.5) * 0.25;
      g.strokeStyle = "rgba(255,255,255,0.2)"; g.lineWidth = Math.max(0.5, band * 0.012); g.beginPath();
      q = rp(srr, sa); g.moveTo(q[0], q[1]); q = rp(srr + dr, sa + da); g.lineTo(q[0], q[1]); g.stroke();
    }
  }
  function chromeDeco(g, N, r0, r1, col, t) {
    var band = r1 - r0, r = r0 + band * 0.68, q = rp(r, -2.75);
    g.strokeStyle = "rgba(255,255,255,0.7)"; g.lineCap = "round"; g.lineJoin = "round"; g.lineWidth = Math.max(0.6, band * 0.06);
    g.beginPath(); g.moveTo(q[0], q[1]); rarc(g, r, -2.75, -1.95); g.stroke();
  }
  function hazardDeco(g, N, r0, r1, col, t) {
    var band = r1 - r0, sr = Math.max(0.6, band * 0.034), k;
    for (k = 0; k < 12; k++) {
      var a = k / 12 * TAU + 0.13;
      [r0 + band * 0.05, r1 - band * 0.05].forEach(function (r) { var q = rp(r, a); rivet(g, q[0], q[1], sr); });
    }
  }
  var TECH_GLYPHS = [   // cells on a 3 x 5 grid: [column, row, width, height]
    [[0, 0, 3, 1], [1, 1, 1, 4]], [[0, 0, 1, 5], [2, 0, 1, 5], [0, 2, 3, 1]], [[0, 0, 3, 1], [0, 4, 3, 1], [0, 0, 1, 5]], [[0, 0, 3, 1], [0, 4, 3, 1], [2, 0, 1, 5]],
    [[1, 0, 1, 1], [1, 2, 1, 1], [1, 4, 1, 1]], [[0, 0, 3, 2], [0, 3, 1, 2], [2, 3, 1, 2]], [[0, 1, 3, 1], [0, 3, 3, 1]], [[0, 0, 1, 5], [0, 4, 3, 1]],
    [[0, 0, 3, 1], [2, 1, 1, 1], [0, 2, 3, 1], [0, 3, 1, 1], [0, 4, 3, 1]], [[0, 0, 1, 5], [2, 0, 1, 5], [0, 0, 3, 1], [0, 4, 3, 1], [1, 2, 1, 1]],
    [[0, 0, 1, 1], [2, 0, 1, 1], [1, 1, 1, 3], [0, 4, 3, 1]], [[0, 2, 3, 1], [1, 0, 1, 5]]
  ];
  function techDeco(g, N, r0, r1, col, t) {
    var band = r1 - r0, h = band * 0.24, cell = h / 5, glow = rgbStr(mix(mix([30, 36, 44], col, Math.min(1, R.glow)), WHITE, 0.35 * Math.min(1, R.glow)));
    g.fillStyle = glow; g.shadowColor = glow; g.shadowBlur = h * 0.6 * R.glow;
    [[0.33, 1], [0.67, -1]].forEach(function (row) {
      var r = r0 + band * row[0], n = Math.max(8, Math.floor(rper(r) / (cell * 4.6)));
      for (var k = 0; k < n; k++) {
        if (hash2(k, row[1] + 2, 707) < 0.16) continue;   // gaps, like a data stream
        var q = rp(r, k / n * TAU), gl = TECH_GLYPHS[Math.floor(hash2(k, row[1] + 5, 708) * TECH_GLYPHS.length)];
        g.save(); g.translate(q[0], q[1]); g.rotate(row[1] > 0 ? q[2] : q[2] - Math.PI);   // the inner row reads the other way
        gl.forEach(function (b) { g.fillRect((b[0] - 1.5) * cell, (b[1] - 2.5) * cell, b[2] * cell * 0.92, b[3] * cell * 0.92); });
        g.restore();
      }
    });
    g.shadowBlur = 0;
  }
  add("Tech", "Hex plating", function (p, col, t) {
    var n = Math.max(3, Math.round(TAU * p.rm / (p.band / 2.2))), size = TAU * p.rm / n / SQ3;
    var x = (p.a / TAU + 0.5) * n * SQ3, y = p.t * p.band / size, hc = hexCell(x, y), q = ((hc.q % n) + n) % n, e = 1 - hc.h;
    var base = mix([42, 49, 56], [86, 97, 108], hash2(q, hc.r, 601));
    if (e < 0.08) return mul(base, 0.32);
    if (hash2(q, hc.r, 602) > 0.89) return mix(mix(base, col, 0.8 * Math.min(1, R.glow)), WHITE, 0.45 * e * Math.min(1, R.glow) + 0.2 * Math.max(0, R.glow - 1));
    if (e < 0.16) return mix(base, WHITE, 0.2);
    return mul(base, 0.94 + 0.12 * vnoise(p.u * 60, p.v * 60, 603));
  }, FLAT);
  add("Tech", "Circuit board", function (p, col, t) {
    var b = mix([12, 42, 28], [19, 74, 48], fbm(p.u * 8, p.v * 8, 611, 3));
    return mul(b, 0.94 + 0.06 * Math.sin(p.u * p.N * 1.5) * Math.sin(p.v * p.N * 1.5));
  }, FLAT, circuitDeco);
  add("Tech", "Hull plating", function (p, col, t) {
    var f = (p.a / TAU + 0.5) * 10, bi = Math.floor(f) % 10, fr = f - Math.floor(f), base = mul(steelPix(p, col, t), 0.9 + 0.2 * hash2(bi, 3, 517));
    if (bi % 5 === 2 && p.t > 0.4 && p.t < 0.6) base = mix(base, col, 0.6);
    if (fr < 0.012 || fr > 0.988) return mul(base, 0.3);
    if (fr < 0.03) return mix(base, WHITE, 0.25);
    return base;
  }, { kind: "round", k: 0.6, spec: 0.5 }, hullDeco);
  add("Tech", "Chrome", function (p, col, t) {
    var n = -Math.cos(Math.PI * p.t) * p.ry + 0.15 * Math.sin(p.a * 3);
    var c = n < 0 ? mix([26, 20, 16], [107, 90, 72], clamp01(n + 1)) : mix([238, 244, 250], [143, 180, 216], clamp01(n));
    return mix(c, [12, 12, 14], smooth(0.06, 0, Math.abs(n)) * 0.9);
  }, { kind: "round", k: 0.95, spec: 1.2 }, chromeDeco);
  add("Tech", "Carbon fiber", function (p, col, t) {
    if (p.t < 0.06 || p.t > 0.94) return col;   // pinstripe
    var w = p.band / 6, n = Math.max(4, Math.round(TAU * p.rm / w / 4) * 4), x = (p.a / TAU + 0.5) * n, y = p.t * p.band / w;
    var fx = Math.floor(x), fy = Math.floor(y), warp = (((fx + fy) % 4) + 4) % 4 < 2, fr = warp ? x - fx : y - fy;
    return mul([58, 63, 70], 1.5 * (0.25 + 0.5 * Math.pow(Math.sin(Math.PI * fr), 0.7) + (warp ? 0.12 : -0.05)));
  }, GLOSS);
  add("Tech", "Hazard stripes", function (p, col, t) {
    if (p.t < 0.1 || p.t > 0.9) return steelPix(p, col, t);
    var nS = Math.max(2, 2 * Math.round(TAU * p.rm / (p.band * 1.1))), P = TAU * p.rm / nS, s = (p.a / TAU + 0.5) * TAU * p.rm;
    var k = ((Math.floor((s + p.t * p.band) / P) % 2) + 2) % 2, base = mul(k ? [242, 194, 0] : [23, 24, 26], 0.85 + 0.15 * fbm(p.u * 20, p.v * 20, 621, 3));
    return fbm(p.u * 40, p.v * 40, 622, 3) > 0.69 ? [128, 130, 128] : base;   // chipped paint shows the primer
  }, FLAT, hazardDeco);
  add("Tech", "Data ring", function (p, col, t) {
    var hw = Math.max(0.7, p.band * 0.018) / p.band;
    if (Math.abs(p.t - 0.1) < hw || Math.abs(p.t - 0.9) < hw) return mix(col, WHITE, 0.3);
    return mix([6, 9, 14], [16, 26, 38], fbm(p.u * 4, p.v * 4, 631, 3));
  }, GLOSS, techDeco);
  // HUD reticle: mostly see-through, hairlines, ticks and a sweeping bearing arc (one turn per loop when animated)
  function hudDeco(g, N, r0, r1, col, t) {
    var band = r1 - r0, c = rgbStr(col), lc = rgbStr(mix(col, WHITE, 0.5)), fine = band > 30, k, q, q2;
    g.strokeStyle = c; g.fillStyle = c; g.lineCap = "butt"; g.shadowColor = c; g.shadowBlur = band * 0.12;
    var step = fine ? 5 : 15;
    for (k = 0; k < 360; k += step) {
      var big = k % 45 === 0, mid = k % 15 === 0, len = band * (big ? 0.7 : mid ? 0.45 : 0.25), th = k / 180 * Math.PI - Math.PI / 2;
      g.lineWidth = Math.max(0.6, band * (big ? 0.05 : 0.025));
      q = rp(r1 - band * 0.12, th); q2 = rp(r1 - band * 0.12 - len, th);
      g.beginPath(); g.moveTo(q[0], q[1]); g.lineTo(q2[0], q2[1]); g.stroke();
    }
    g.lineWidth = Math.max(1, band * 0.11);
    for (k = 0; k < 4; k++) { var a = k * Math.PI / 2 - Math.PI / 2, rr = r0 + band * 0.2; q = rp(rr, a - 0.09); g.beginPath(); g.moveTo(q[0], q[1]); rarc(g, rr, a - 0.09, a + 0.09); g.stroke(); }
    var sw = phase(t) - Math.PI / 2, rb = r0 + band * 0.3;
    g.strokeStyle = lc; g.lineWidth = Math.max(1, band * 0.09); q = rp(rb, sw); g.beginPath(); g.moveTo(q[0], q[1]); rarc(g, rb, sw, sw + 0.52); g.stroke();
    if (fine) {
      g.shadowBlur = 0; g.font = "600 " + Math.round(band * 0.24) + "px 'Share Tech Mono', ui-monospace, monospace"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = lc;
      ["000", "090", "180", "270"].forEach(function (s, i) { var qq = rp(r0 + band * 0.55, i * Math.PI / 2 - Math.PI / 2 + 0.2); g.save(); g.translate(qq[0], qq[1]); g.rotate(qq[2]); g.fillText(s, 0, 0); g.restore(); });
    }
    g.shadowBlur = 0;
  }
  add("Tech", "HUD reticle", function (p, col, t) {
    var hw = Math.max(0.03, 1.2 / p.band);
    if (Math.abs(p.t - 0.08) < hw || Math.abs(p.t - 0.92) < hw) return [col[0], col[1], col[2], 1];
    return [col[0], col[1], col[2], 0.12];
  }, EMIT, hudDeco, { usesColor: true, anim: true, emissive: true });
  // Porthole: a flat bolted flange, a rubber gasket and a polished inner lip, with a glass glare over the picture
  function portShade(rgb, p) {
    var lt, nrm, lam, b;
    if (p.t < 0.36) { lt = p.t / 0.36; nrm = -Math.cos(Math.PI * lt); lam = (p.rx * LX + p.ry * LY) * nrm; b = (1 + lam * 0.9) * (0.8 + 0.2 * Math.sin(Math.PI * lt)); var sp = lam > 0 ? Math.pow(lam, 7) * 255 : 0; return [rgb[0] * b + sp, rgb[1] * b + sp, rgb[2] * b + sp]; }
    if (p.t < 0.45) return rgb;
    lt = (p.t - 0.45) / 0.55; nrm = lt < 0.12 ? -0.85 : lt > 0.88 ? 0.85 : 0; lam = (p.rx * LX + p.ry * LY) * nrm; b = 1 + lam * 0.5;
    return [rgb[0] * b, rgb[1] * b, rgb[2] * b];
  }
  function portDeco(g, N, r0, r1, col, t) {
    var band = r1 - r0, rr = r0 + band * 0.73, br = Math.max(0.8, band * 0.08);
    for (var k = 0; k < 12; k++) {
      var q = rp(rr, k / 12 * TAU + 0.26);
      g.save(); g.translate(q[0], q[1]); g.shadowColor = "rgba(0,0,0,0.5)"; g.shadowBlur = br * 0.8; g.shadowOffsetX = br * 0.2; g.shadowOffsetY = br * 0.3;
      var gr = g.createRadialGradient(-br * 0.3, -br * 0.3, br * 0.1, 0, 0, br);
      gr.addColorStop(0, "#f2f4f6"); gr.addColorStop(0.5, "#9aa2aa"); gr.addColorStop(1, "#3b4148"); g.fillStyle = gr;
      g.beginPath(); for (var j = 0; j < 6; j++) { var a = j * TAU / 6 + 0.3; if (j) g.lineTo(Math.cos(a) * br, Math.sin(a) * br); else g.moveTo(Math.cos(a) * br, Math.sin(a) * br); } g.closePath(); g.fill();
      g.restore();
    }
  }
  function portOver(g, N, r0, r1, col, t) {   // glass glare over the picture, inside the inner edge
    g.save(); g.beginPath(); rring(g, r0); g.clip();
    var q = rp(r0 * 0.55, -2.3), gr = g.createRadialGradient(q[0], q[1], 0, q[0], q[1], r0 * 0.7);
    gr.addColorStop(0, "rgba(255,255,255,0.16)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, N, N);
    g.strokeStyle = "rgba(0,0,0,0.35)"; g.lineWidth = Math.max(1, (r1 - r0) * 0.06); g.beginPath(); rring(g, r0 - g.lineWidth / 2); g.stroke();
    g.restore();
  }
  add("Tech", "Porthole", function (p, col, t) {
    if (p.t < 0.36) return mix([70, 74, 80], [214, 220, 228], 0.55 + 0.25 * Math.sin(p.a * 2 + 0.7));
    if (p.t < 0.45) return [17, 17, 18];
    return mul(steelPix(p, col, t), 0.95);
  }, { kind: "fn", fn: portShade }, portDeco, { over: portOver });

  // Energy (sci-fi): light-emitting styles. They use the ring color directly and many of them glow past the band.
  function haloGlow(width, blur, alpha) {
    return function (g, N, r0, r1, col, t) {
      var band = r1 - r0, a = Math.min(1, alpha * R.glow), sp = glowSpread();
      if (a <= 0) return;
      g.strokeStyle = rgbStr(col, a); g.shadowColor = rgbStr(col, Math.min(1, a * 1.2)); g.lineWidth = band * width * sp; g.shadowBlur = band * blur * sp;
      g.beginPath(); rring(g, (r0 + r1) / 2); g.stroke(); g.stroke(); if (R.glow > 1.2) g.stroke(); g.shadowBlur = 0;
    };
  }
  add("Energy", "Neon tube", function (p, col, t) {
    var i = Math.exp(-Math.pow((p.t - 0.5) / 0.16, 2)), f = neonFlicker(t);
    if (i < 0.1) return [16, 18, 22];
    return mix(mul(col, 0.15), mix(col, WHITE, 0.85 * f), i * f);
  }, EMIT, null, { usesColor: true, anim: true, glow: function (g, N, r0, r1, col, t) {
    var band = r1 - r0, f = neonFlicker(t);
    var a = Math.min(1, 0.55 * f * R.glow), sp = glowSpread();
    if (a <= 0) return;
    g.strokeStyle = rgbStr(col, a); g.shadowColor = rgbStr(col, Math.min(1, f * R.glow)); g.lineWidth = band * 0.35 * sp; g.shadowBlur = band * 0.9 * sp;
    g.beginPath(); rring(g, (r0 + r1) / 2); g.stroke(); g.stroke(); if (R.glow > 1.2) g.stroke(); g.shadowBlur = 0;
  } });
  add("Energy", "Holographic", function (p, col, t) {
    var h = p.a / TAU * 2 + p.t * 0.6 + fbm(p.u * 3, p.v * 3, 641, 3) * 0.5 + (t ? t / R.loop : 0), c = hsl(h, 0.85, 0.68);
    c = mul(c, 0.85 + 0.15 * Math.sin(p.t * 70));
    return [c[0], c[1], c[2], 0.82];
  }, GLOSS, function (g, N, r0, r1, col, t) {
    var band = r1 - r0, R2 = rng(642), sh = t ? phase(t) : 0;
    g.strokeStyle = "rgba(255,255,255,0.5)"; g.lineCap = "round"; g.lineWidth = Math.max(0.6, band * 0.03);
    for (var k = 0; k < 3; k++) { var r = r0 + band * (0.25 + R2() * 0.5), a0 = R2() * TAU - Math.PI + sh, q = rp(r, a0); g.beginPath(); g.moveTo(q[0], q[1]); rarc(g, r, a0, a0 + 0.3 + R2() * 0.5); g.stroke(); }
  }, { anim: true });
  add("Energy", "Energy shield", function (p, col, t) {
    var f = Math.pow(Math.abs(2 * p.t - 1), 2.2), n = Math.max(3, Math.round(TAU * p.rm / (p.band / 3.2))), size = TAU * p.rm / n / SQ3;
    var hc = hexCell((p.a / TAU + 0.5) * n * SQ3, p.t * p.band / size), hx = hc.h > 0.86 ? 1 : 0;
    var rpl = 0.5 + 0.5 * Math.sin(p.a * 9 + fbm(p.u * 4, p.v * 4, 651, 3) * 6 + phase(t));
    var c = mix(col, WHITE, f * 0.7);
    return [c[0], c[1], c[2], clamp01(0.18 + 0.6 * f + 0.3 * hx * rpl)];
  }, EMIT, null, { usesColor: true, anim: true, glow: function (g, N, r0, r1, col, t) {
    var band = r1 - r0, R2 = rng(652), sh = phase(t);
    if (R.glow <= 0) return;
    g.strokeStyle = rgbStr(col, Math.min(1, 0.45 * R.glow)); g.shadowColor = rgbStr(col); g.shadowBlur = band * 0.5 * glowSpread(); g.lineWidth = Math.max(1, band * 0.06);
    [r0, r1].forEach(function (r) { g.beginPath(); rring(g, r); g.stroke(); });
    g.lineCap = "round"; g.strokeStyle = rgbStr(mix(col, WHITE, 0.6), 0.85); g.lineWidth = Math.max(1, band * 0.1);
    for (var k = 0; k < 3; k++) { var a = R2() * TAU - Math.PI + sh * (k % 2 ? 1 : -1) * 0.5, r = r0 + band * (0.3 + R2() * 0.4), q = rp(r, a); g.beginPath(); g.moveTo(q[0], q[1]); rarc(g, r, a, a + 0.18); g.stroke(); }
    g.shadowBlur = 0;
  } });
  add("Energy", "Glitch", function (p, col, t) {
    var row = Math.floor(p.v * p.N / 3), sl = hash2(Math.floor(p.v * 48), 7, 661) > 0.86, tt = p.t;
    if (hash2(Math.floor(p.u * 24), Math.floor(p.v * 24), 662) > 0.97) return [0, 0, 0, 0];
    function bar(x) { return x > 0.15 && x < 0.85 ? 1 : 0; }
    var r = sl ? bar(tt + 0.08) : bar(tt), g2 = bar(tt), b = sl ? bar(tt - 0.08) : bar(tt), k = row % 2 ? 0.7 : 1;
    var base = [10, 12, 16];
    var c = [base[0] + (col[0] - base[0]) * r, base[1] + (col[1] - base[1]) * g2, base[2] + (col[2] - base[2]) * b];
    if (sl) c = [Math.max(c[0], r * 255 * 0.6), c[1], Math.max(c[2], b * 255 * 0.6)];
    return mul(c, k);
  }, EMIT, function (g, N, r0, r1, col, t) {
    var band = r1 - r0, R2 = rng(663);
    g.fillStyle = "rgba(255,255,255,0.8)";
    for (var k = 0; k < 10; k++) { var q = rp(r0 + band * (0.2 + R2() * 0.6), R2() * TAU); g.fillRect(q[0], q[1], band * (0.15 + R2() * 0.4), Math.max(0.6, N / 1024)); }
  }, { usesColor: true });
  add("Energy", "Plasma", function (p, col, t) {
    var ph = phase(t), ox = Math.cos(ph) * 0.35, oy = Math.sin(ph) * 0.35;
    var q = fbm(p.u * 5 + ox, p.v * 5 + oy, 671, 3), n = fbm(p.u * 5 + q * 2.2 - oy, p.v * 5 - q * 2.2 + ox, 672, 3);
    var k = Math.pow(clamp01(n * 1.25), 1.6), c = k < 0.5 ? mix([18, 0, 42], col, k * 2) : mix(col, WHITE, (k - 0.5) * 2);
    c = mix(c, WHITE, crackAt(p.u + ox * 0.1, p.v + oy * 0.1, 9, 673, 0.02) * 0.7);
    return [c[0], c[1], c[2], clamp01(Math.min(p.t, 1 - p.t) * 9)];
  }, EMIT, null, { usesColor: true, anim: true, glow: haloGlow(0.5, 1, 0.45) });
  add("Energy", "Reactor cells", function (p, col, t) {
    var f = (p.a / TAU + 0.5) * 24, ci = Math.floor(f) % 24, fr = f - Math.floor(f);
    if (fr < 0.12 || p.t < 0.2 || p.t > 0.8) return [20, 23, 27];
    if (hash2(ci, 1, 681) < 0.15) return mul(col, 0.2);
    return mix(col, WHITE, 0.5 * (1 - Math.abs(2 * ((p.t - 0.2) / 0.6) - 1)));
  }, { kind: "fn", fn: function (rgb, p) { return p.t < 0.2 || p.t > 0.8 ? shade(rgb, p, FLAT) : rgb; } }, null, { usesColor: true, glow: haloGlow(0.3, 0.6, 0.25) });

  // Sculpted (owner 2026-11-20): rings that aren't a clean band. Drawn as vectors along the token's outline (no pixel pass), so they
  // follow any shape and may reach past the outer edge; anything between the pieces stays see-through. R.len and R.count are the ring's
  // Length and Count settings; R.tintOn is "Tint every style" (the ring color then paints the main material).
  var INKS = "rgba(28,18,12,0.92)";
  function along(r, a0, a1, step) {   // points along the outline at radius r: [x, y, tangent angle, outward nx, ny]
    var n = Math.max(8, Math.ceil(Math.abs(a1 - a0) * rper(r) / TAU / (step || 3))), out = [];
    for (var i = 0; i <= n; i++) { var q = rp(r, a0 + (a1 - a0) * i / n); out.push([q[0], q[1], q[2], Math.sin(q[2]), -Math.cos(q[2])]); }
    return out;
  }
  function lightAt(nx, ny) { return Math.max(0, -(nx * LX + ny * LY)) ; }   // 1 where the outward side faces the light (top left)
  function natural(col, nat) { return R.tintOn ? col : hex(nat); }
  function sPath(g, pts) { g.beginPath(); pts.forEach(function (q, i) { if (i) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]); }); }
  function strokeTube(g, pts, w, base) {   // an inked, shaded tube along a polyline
    g.lineCap = "round"; g.lineJoin = "round";
    sPath(g, pts); g.strokeStyle = INKS; g.lineWidth = w * 1.35; g.stroke();
    sPath(g, pts); g.strokeStyle = rgbStr(base); g.lineWidth = w; g.stroke();
    for (var i = 1; i < pts.length; i++) {
      var q = pts[i], p0 = pts[i - 1], l = lightAt(q[3], q[4]);
      g.strokeStyle = rgbStr(mix(base, WHITE, 0.55), 0.25 + 0.5 * l); g.lineWidth = w * 0.3;
      g.beginPath(); g.moveTo(p0[0] + p0[3] * w * 0.18, p0[1] + p0[4] * w * 0.18); g.lineTo(q[0] + q[3] * w * 0.18, q[1] + q[4] * w * 0.18); g.stroke();
    }
  }
  function wavy(rm, amp, k, ph, step) {   // a strand weaving around the middle of the band
    var pts = along(rm, 0, TAU, step || 2.5), per = rper(rm);
    return pts.map(function (q, i) { var s = i / (pts.length - 1), o = Math.sin(s * k * TAU + ph) * amp; return [q[0] + q[3] * o, q[1] + q[4] * o, q[2], q[3], q[4]]; });
  }
  function nCount(base) { return Math.max(4, Math.round(base * (R.count || 16) / 16)); }

  function barbedOver(g, N, r0, r1, col, t) {
    var band = r1 - r0, rm = (r0 + r1) / 2, steel = natural(col, "#a4adb5"), w = Math.max(1.6, band * 0.14), k = Math.round(rper(rm) / (band * 0.9));
    var A = wavy(rm, band * 0.12, k, 0), B = wavy(rm, band * 0.12, k, Math.PI);
    strokeTube(g, A, w, steel); strokeTube(g, B, w, mul(steel, 0.85));
    // where A crosses over B again (half of each twist), redraw A on top
    var seg = [];
    A.forEach(function (q, i) { var s = i / (A.length - 1); if (Math.sin(s * k * TAU * 2 + Math.PI / 2) > 0) seg.push(q); else if (seg.length) { if (seg.length > 2) strokeTube(g, seg, w, steel); seg = []; } });
    if (seg.length > 2) strokeTube(g, seg, w, steel);
    var nb = nCount(Math.max(6, Math.round(rper(rm) / (band * 1.8))));
    for (var b = 0; b < nb; b++) {
      var q = rp(rm, b / nb * TAU + 0.11), tx = Math.cos(q[2]), ty = Math.sin(q[2]), nx = Math.sin(q[2]), ny = -Math.cos(q[2]), L = band * 0.5 * (R.len || 1);
      [[1, 1], [1, -1]].forEach(function (d) {
        var ex = (tx * 0.55 * d[0] + nx * d[1]) * L, ey = (ty * 0.55 * d[0] + ny * d[1]) * L;
        var pts = [[q[0] - ex, q[1] - ey, 0, nx, ny], [q[0] + ex, q[1] + ey, 0, nx, ny]];
        strokeTube(g, pts, w * 0.75, mix(steel, WHITE, 0.1));
      });
      g.fillStyle = rgbStr(mul(steel, 0.7)); g.strokeStyle = INKS; g.lineWidth = w * 0.3;
      g.beginPath(); g.ellipse(q[0], q[1], w * 1.3, w * 0.9, q[2], 0, TAU); g.fill(); g.stroke();
    }
  }

  function spikesOver(g, N, r0, r1, col, t) {
    var band = r1 - r0, metal = natural(col, "#6f767e"), n = nCount(16), rb = r0 + band * 0.42, len = band * 1.05 * (R.len || 1);
    // the base band, a dark iron hoop
    g.beginPath(); rring(g, rb); rring(g, r0); var gr = g.createLinearGradient(cur.cx - r1, cur.cy - r1, cur.cx + r1, cur.cy + r1);
    gr.addColorStop(0, rgbStr(mix(metal, WHITE, 0.35))); gr.addColorStop(0.5, rgbStr(mul(metal, 0.7))); gr.addColorStop(1, rgbStr(mul(metal, 0.4)));
    g.fillStyle = gr; g.fill("evenodd"); g.strokeStyle = INKS; g.lineWidth = Math.max(1, band * 0.05); g.stroke();
    var half = rper(rb) / n * 0.36;
    for (var i = 0; i < n; i++) {
      var a = (i + 0.5) / n * TAU, q = rp(rb, a), tx = Math.cos(q[2]), ty = Math.sin(q[2]), nx = Math.sin(q[2]), ny = -Math.cos(q[2]);
      var bx = q[0] - nx * band * 0.1, by = q[1] - ny * band * 0.1, tipx = q[0] + nx * len, tipy = q[1] + ny * len, l = lightAt(nx, ny);
      g.beginPath(); g.moveTo(bx - tx * half, by - ty * half); g.lineTo(tipx, tipy); g.lineTo(bx + tx * half, by + ty * half); g.closePath();
      var sg = g.createLinearGradient(bx - tx * half, by - ty * half, bx + tx * half, by + ty * half);
      sg.addColorStop(0, rgbStr(mix(metal, WHITE, 0.25 + 0.4 * l))); sg.addColorStop(0.5, rgbStr(metal)); sg.addColorStop(1, rgbStr(mul(metal, 0.45)));
      g.fillStyle = sg; g.fill(); g.strokeStyle = INKS; g.lineWidth = Math.max(1, band * 0.045); g.lineJoin = "round"; g.stroke();
      g.strokeStyle = "rgba(255,255,255," + (0.25 + 0.4 * l).toFixed(2) + ")"; g.lineWidth = Math.max(0.6, band * 0.025);
      g.beginPath(); g.moveTo(bx - tx * half * 0.3, by - ty * half * 0.3); g.lineTo(tipx - tx * half * 0.05 - nx * len * 0.12, tipy - ty * half * 0.05 - ny * len * 0.12); g.stroke();
    }
    for (i = 0; i < n; i++) { var qq = rp((r0 + rb) / 2, i / n * TAU); rivet(g, qq[0], qq[1], Math.max(1, band * 0.06)); }
  }

  function vinesOver(g, N, r0, r1, col, t) {
    var band = r1 - r0, rm = (r0 + r1) / 2, wood = natural(col, "#5a6b2a"), w = Math.max(2, band * 0.2), k = Math.round(rper(rm) / (band * 2.2));
    var A = wavy(rm, band * 0.18, k, 0, 3), B = wavy(rm, band * 0.18, k, Math.PI + 0.6, 3);
    strokeTube(g, B, w * 0.85, mul(wood, 0.8)); strokeTube(g, A, w, wood);
    var R2 = rng(41), n = nCount(Math.round(rper(rm) / (band * 0.55)));
    [A, B].forEach(function (S, si) {
      for (var i = 0; i < n; i++) {
        var q = S[Math.floor((i + R2() * 0.6) / n * (S.length - 1))], side = (i + si) % 2 ? 1 : -1, L = band * (0.26 + R2() * 0.12) * (R.len || 1);
        var tx = Math.cos(q[2]), ty = Math.sin(q[2]), nx = q[3] * side, ny = q[4] * side, hw = w * 0.42;
        g.beginPath(); g.moveTo(q[0] - tx * hw, q[1] - ty * hw); g.quadraticCurveTo(q[0] + nx * L * 0.6 - tx * hw * 0.2, q[1] + ny * L * 0.6 - ty * hw * 0.2, q[0] + nx * L + tx * L * 0.35, q[1] + ny * L + ty * L * 0.35);
        g.lineTo(q[0] + tx * hw, q[1] + ty * hw); g.closePath();
        g.fillStyle = rgbStr(mix(mul(wood, 0.75), [190, 170, 110], 0.35)); g.fill(); g.strokeStyle = INKS; g.lineWidth = Math.max(0.6, band * 0.025); g.stroke();
      }
    });
    for (var j = 0; j < Math.round(n / 3); j++) {   // a few leaves
      var p = A[Math.floor((j + 0.3) / Math.round(n / 3) * (A.length - 1))], lx = p[0] + p[3] * band * 0.3, ly = p[1] + p[4] * band * 0.3, s = band * 0.3;
      g.save(); g.translate(lx, ly); g.rotate(p[2] + (j % 2 ? 0.6 : -0.6)); g.beginPath(); g.ellipse(0, 0, s, s * 0.45, 0, 0, TAU);
      g.fillStyle = rgbStr(j % 2 ? [74, 122, 46] : [96, 140, 54]); g.fill(); g.strokeStyle = INKS; g.lineWidth = Math.max(0.6, band * 0.03); g.stroke();
      g.beginPath(); g.moveTo(-s * 0.8, 0); g.lineTo(s * 0.8, 0); g.strokeStyle = "rgba(220,240,180,0.6)"; g.stroke(); g.restore();
    }
  }

  // ---- scaled creatures: a body tube along the outline from the head round to the tail ----
  // spec: { rc, w (half width), a0 (head end), a1 (tail end), taper (tail fraction), base, belly }
  function bodyEdges(sp) {
    var pts = along(sp.rc, sp.a0, sp.a1, 2.5), L = [], Rr = [];
    pts.forEach(function (q, i) {
      var s = i / (pts.length - 1), h = sp.w * (s > 1 - sp.taper ? Math.max(0.12, (1 - s) / sp.taper) : s < 0.04 ? 0.86 + s * 3.5 : 1);
      var o = rp(sp.rc + h, sp.a0 + (sp.a1 - sp.a0) * s), n = rp(sp.rc - h, sp.a0 + (sp.a1 - sp.a0) * s);
      L.push([o[0], o[1], h, q[2]]); Rr.push([n[0], n[1], h, q[2]]); q.push(h);
    });
    return { mid: pts, out: L, inn: Rr };
  }
  function drawBody(g, sp, t, scales) {
    var E = bodyEdges(sp), base = sp.base, i;
    g.beginPath(); E.out.forEach(function (q, k) { if (k) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]); });
    for (i = E.inn.length - 1; i >= 0; i--) g.lineTo(E.inn[i][0], E.inn[i][1]);
    g.closePath();
    g.save(); g.shadowColor = "rgba(0,0,0,0.45)"; g.shadowBlur = sp.w * 0.5; g.shadowOffsetY = sp.w * 0.18; g.fillStyle = rgbStr(base); g.fill(); g.restore();
    g.save(); g.clip();
    // belly (inner side) and back shading, lit from the top left
    for (i = 1; i < E.mid.length; i++) {
      var q = E.mid[i], p0 = E.mid[i - 1], h = q[5], l = lightAt(q[3], q[4]);
      g.strokeStyle = rgbStr(sp.belly, 0.95); g.lineWidth = h * 0.7;
      g.beginPath(); g.moveTo(p0[0] - p0[3] * h * 0.62, p0[1] - p0[4] * h * 0.62); g.lineTo(q[0] - q[3] * h * 0.62, q[1] - q[4] * h * 0.62); g.stroke();
      g.strokeStyle = "rgba(255,255,230," + (0.12 + 0.4 * l).toFixed(3) + ")"; g.lineWidth = h * 0.35;
      g.beginPath(); g.moveTo(p0[0] + p0[3] * h * 0.42, p0[1] + p0[4] * h * 0.42); g.lineTo(q[0] + q[3] * h * 0.42, q[1] + q[4] * h * 0.42); g.stroke();
      g.strokeStyle = "rgba(0,0,0," + (0.08 + 0.25 * (1 - l)).toFixed(3) + ")"; g.lineWidth = h * 0.3;
      g.beginPath(); g.moveTo(p0[0] + p0[3] * h * 0.85, p0[1] + p0[4] * h * 0.85); g.lineTo(q[0] + q[3] * h * 0.85, q[1] + q[4] * h * 0.85); g.stroke();
    }
    // scales: staggered arcs, and belly plates across the inner side
    var step = Math.max(3, sp.w * 0.55), acc = 0, row = 0, ph = phase(t);
    for (i = 1; i < E.mid.length; i++) {
      var a = E.mid[i], b = E.mid[i - 1]; acc += Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (acc < step) continue; acc = 0; row++;
      var hh = a[5], tx = Math.cos(a[2]), ty = Math.sin(a[2]), glint = 0.5 + 0.5 * Math.cos(ph - row * 0.35);
      if (scales) for (var j = -1; j <= 2; j++) {
        var o = (j + (row % 2 ? 0.5 : 0)) * hh * 0.42 - hh * 0.1; if (o > hh * 0.9 || o < -hh * 0.3) continue;
        var cx = a[0] + a[3] * o, cy = a[1] + a[4] * o, sr = hh * 0.26;
        g.strokeStyle = rgbStr(mul(base, 0.55), 0.7); g.lineWidth = Math.max(0.5, hh * 0.07);
        g.beginPath(); g.arc(cx, cy, sr, a[2] + Math.PI * 0.5 + (sp.dir > 0 ? 0 : Math.PI), a[2] + Math.PI * 1.5 + (sp.dir > 0 ? 0 : Math.PI)); g.stroke();
        if (glint > 0.92 && t) { g.fillStyle = "rgba(255,255,255," + ((glint - 0.92) * 5).toFixed(3) + ")"; g.beginPath(); g.arc(cx, cy, sr * 0.5, 0, TAU); g.fill(); }
      }
      g.strokeStyle = rgbStr(mul(sp.belly, 0.7), 0.8); g.lineWidth = Math.max(0.5, hh * 0.06);
      g.beginPath(); g.moveTo(a[0] - a[3] * hh * 0.25, a[1] - a[4] * hh * 0.25); g.lineTo(a[0] - a[3] * hh, a[1] - a[4] * hh); g.stroke();
      if (sp.marks && row % 3 === 0) {   // diamond marks down the back
        g.fillStyle = rgbStr(mul(base, 0.5), 0.75); var mx = a[0] + a[3] * hh * 0.3, my = a[1] + a[4] * hh * 0.3, mr = hh * 0.32;
        g.beginPath(); g.moveTo(mx + tx * mr * 1.4, my + ty * mr * 1.4); g.lineTo(mx + a[3] * mr, my + a[4] * mr); g.lineTo(mx - tx * mr * 1.4, my - ty * mr * 1.4); g.lineTo(mx - a[3] * mr, my - a[4] * mr); g.closePath(); g.fill();
      }
    }
    g.restore();
    g.beginPath(); E.out.forEach(function (q, k) { if (k) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]); });
    for (i = E.inn.length - 1; i >= 0; i--) g.lineTo(E.inn[i][0], E.inn[i][1]);
    g.closePath(); g.strokeStyle = INKS; g.lineWidth = Math.max(1, sp.w * 0.12); g.lineJoin = "round"; g.stroke();
    return E;
  }
  // A head drawn in its own frame: +x is the way it faces, +y its back (the outward side of the ring). w is the body's half width.
  function snakeHead(g, w, base, belly, t, bite, tongue) {
    var hl = w * 3.1;
    if (tongue > 0.02) {   // a forked tongue flicking out of the snout
      var L = w * 1.6 * tongue; g.strokeStyle = "#c8263a"; g.lineWidth = Math.max(1, w * 0.14); g.lineCap = "round";
      g.beginPath(); g.moveTo(hl * 0.95, -w * 0.1); g.lineTo(hl * 0.95 + L, -w * 0.1); g.lineTo(hl * 0.95 + L * 1.25, w * 0.15); g.moveTo(hl * 0.95 + L, -w * 0.1); g.lineTo(hl * 0.95 + L * 1.25, -w * 0.38); g.stroke();
    }
    function outline() {   // from the neck (as wide as the body) out to the snout and back; the neck end is left open
      g.moveTo(-w * 0.9, w * 0.62); g.bezierCurveTo(w * 0.3, w * 0.7, w * 0.8, w * 1.35, hl * 0.62, w * 1.2); g.quadraticCurveTo(hl * 0.92, w * 1.0, hl * 0.97, w * 0.5);
      g.quadraticCurveTo(hl * 1.06, w * 0.05, hl * 0.95, -w * 0.25);
      if (bite) { g.lineTo(hl * 0.5, -w * 0.05); g.lineTo(hl * 0.86, -w * 0.52); }
      g.bezierCurveTo(hl * 0.7, -w * 0.95, w * 0.6, -w * 1.1, w * 0.1, -w * 0.75); g.quadraticCurveTo(-w * 0.4, -w * 0.6, -w * 0.9, -w * 0.62);
    }
    g.beginPath(); outline(); g.closePath();
    var gr = g.createLinearGradient(0, w * 1.3, 0, -w * 1.1); gr.addColorStop(0, rgbStr(mix(base, WHITE, 0.3))); gr.addColorStop(0.55, rgbStr(base)); gr.addColorStop(1, rgbStr(belly));
    g.save(); g.shadowColor = "rgba(0,0,0,0.45)"; g.shadowBlur = w * 0.6; g.shadowOffsetY = w * 0.2; g.fillStyle = gr; g.fill(); g.restore();
    g.beginPath(); outline(); g.strokeStyle = INKS; g.lineWidth = Math.max(1, w * 0.13); g.lineJoin = "round"; g.stroke();
    g.strokeStyle = rgbStr(mul(base, 0.55), 0.8); g.lineWidth = Math.max(0.6, w * 0.07);   // mouth line and head plates
    g.beginPath(); g.moveTo(hl * 0.92, -w * 0.18); g.quadraticCurveTo(hl * 0.55, -w * 0.3, w * 0.9, -w * 0.15); g.stroke();
    g.beginPath(); g.moveTo(w * 1.3, w * 0.5); g.quadraticCurveTo(w * 1.9, w * 0.9, hl * 0.75, w * 0.62); g.stroke();
    g.fillStyle = "#1a120c"; g.beginPath(); g.arc(hl * 0.86, w * 0.4, w * 0.08, 0, TAU); g.fill();   // nostril
    var ex = hl * 0.56, ey = w * 0.52, er = w * 0.32;   // the eye with a slit pupil and a brow ridge
    g.fillStyle = "#f4c430"; g.beginPath(); g.ellipse(ex, ey, er, er * 0.82, 0, 0, TAU); g.fill(); g.strokeStyle = INKS; g.lineWidth = Math.max(0.8, w * 0.08); g.stroke();
    g.fillStyle = "#120a06"; g.beginPath(); g.ellipse(ex + er * 0.05, ey, er * 0.16, er * 0.72, 0, 0, TAU); g.fill();
    g.fillStyle = "rgba(255,255,255,0.9)"; g.beginPath(); g.arc(ex - er * 0.35, ey + er * 0.3, er * 0.18, 0, TAU); g.fill();
    g.strokeStyle = rgbStr(mul(base, 0.4)); g.lineWidth = Math.max(0.8, w * 0.12); g.lineCap = "round";
    g.beginPath(); g.moveTo(ex - er * 1.2, ey + er * 1.0); g.quadraticCurveTo(ex, ey + er * 1.55, ex + er * 1.3, ey + er * 0.85); g.stroke();
    return hl;
  }
  function headFrame(g, sp, at, facing) {   // facing +1: toward increasing angle; -1: toward decreasing angle (the way the body runs from it)
    var q = rp(sp.rc, at), ang = q[2] + (facing > 0 ? 0 : Math.PI);
    g.translate(q[0], q[1]); g.rotate(ang);
    if (facing > 0) g.scale(1, -1);   // keep +y outward either way
  }
  function snakeOver(g, N, r0, r1, col, t) {
    var band = r1 - r0, rc = (r0 + r1) / 2, base = natural(col, "#3f8a3a"), belly = mix(base, [238, 222, 150], 0.6), w = band * 0.42, top = -Math.PI / 2;
    var off = w * 3.8 / rc;   // the head's length in angle
    var sp = { rc: rc, w: w, a0: top + off * 0.15, a1: top + TAU - off * 0.55, taper: 0.22, base: base, belly: belly, dir: 1, marks: true };
    drawBody(g, sp, t, true);
    g.save(); headFrame(g, sp, top + off * 0.25, -1); snakeHead(g, w * 1.45, base, belly, t, true, 0); g.restore();
  }
  function twoSnakesOver(g, N, r0, r1, col, t) {
    var band = r1 - r0, rc = (r0 + r1) / 2, w = band * 0.4, top = -Math.PI / 2, off = w * 4.4 / rc, ph = phase(t);
    var c1 = natural(col, "#3f8a3a"), c2 = R.tintOn ? mix(col, [40, 30, 20], 0.35) : hex("#8a6a2a");
    [[c1, 1], [c2, -1]].forEach(function (s, k) {
      var base = s[0], belly = mix(base, [238, 222, 150], 0.6), d = s[1];
      // each snake runs half way round: head at the top, tail crossing the other's at the bottom
      var sp = { rc: rc + (k ? -w * 0.08 : w * 0.08), w: w, a0: top + d * off * 0.75, a1: top + d * (Math.PI + 0.32), taper: 0.3, base: base, belly: belly, dir: d, marks: true };
      drawBody(g, sp, t, true);
      var flick = t ? Math.max(0, Math.sin(ph * 2 + k * Math.PI)) : 0;
      g.save(); headFrame(g, sp, top + d * off * 0.85, -d); snakeHead(g, w * 1.35, base, belly, t, false, Math.pow(flick, 1.5)); g.restore();
    });
  }
  function dragonOver(g, N, r0, r1, col, t) {
    var band = r1 - r0, rc = (r0 + r1) / 2, base = natural(col, "#a8322a"), belly = mix(base, [240, 200, 110], 0.62), w = band * 0.42, top = -Math.PI / 2;
    var off = w * 5 / rc, ph = phase(t);
    var sp = { rc: rc, w: w, a0: top + off * 0.05, a1: top + TAU - off * 1.15, taper: 0.13, base: base, belly: belly, dir: 1, marks: false };
    // wings at the shoulder, behind the body
    [[0.62, 1.0, 0.75], [0.42, 1.15, 1]].forEach(function (wg) {
      var q = rp(rc + w * 0.5, top + wg[0] * 1.4), nx = Math.sin(q[2]), ny = -Math.cos(q[2]), tx = Math.cos(q[2]), ty = Math.sin(q[2]), S = band * 1.7 * wg[1];
      var tipx = q[0] + nx * S * 1.1 + tx * S * 0.6, tipy = q[1] + ny * S * 1.1 + ty * S * 0.6;
      g.beginPath(); g.moveTo(q[0] - tx * w, q[1] - ty * w); g.lineTo(tipx, tipy);
      for (var f = 1; f <= 3; f++) { var bx = q[0] + tx * w * (0.6 + f * 0.9) + nx * S * (0.9 - f * 0.22), by = q[1] + ty * w * (0.6 + f * 0.9) + ny * S * (0.9 - f * 0.22); g.quadraticCurveTo((tipx + bx) / 2 - nx * S * 0.15, (tipy + by) / 2 - ny * S * 0.15, bx, by); }
      g.lineTo(q[0] + tx * w * 2.4, q[1] + ty * w * 2.4); g.closePath();
      g.fillStyle = rgbStr(mix(mul(mix(base, belly, 0.35), 0.8 * wg[2]), [60, 20, 30], 0.15)); g.fill(); g.strokeStyle = INKS; g.lineWidth = Math.max(1, band * 0.04); g.lineJoin = "round"; g.stroke();
      g.strokeStyle = rgbStr(mul(base, 0.45)); g.lineWidth = Math.max(1, band * 0.05);
      g.beginPath(); g.moveTo(q[0], q[1]); g.lineTo(tipx, tipy); g.stroke();
    });
    var E = drawBody(g, sp, t, true);
    // spines down the back
    var acc = 0, step = w * 0.9;
    for (var i = 1; i < E.out.length; i++) {
      var a = E.out[i], b = E.out[i - 1]; acc += Math.hypot(a[0] - b[0], a[1] - b[1]); if (acc < step) continue; acc = 0;
      var m = E.mid[i], h = m[5], tx = Math.cos(m[2]), ty = Math.sin(m[2]), L = h * 0.75;
      g.beginPath(); g.moveTo(a[0] - tx * h * 0.35, a[1] - ty * h * 0.35); g.lineTo(a[0] + m[3] * L + tx * L * 0.45, a[1] + m[4] * L + ty * L * 0.45); g.lineTo(a[0] + tx * h * 0.35, a[1] + ty * h * 0.35); g.closePath();
      g.fillStyle = rgbStr(mix(belly, WHITE, 0.2)); g.fill(); g.strokeStyle = INKS; g.lineWidth = Math.max(0.6, h * 0.08); g.stroke();
    }
    // the tail's spade, just under the jaw
    var tq = rp(rc, sp.a1), ttx = Math.cos(tq[2]), tty = Math.sin(tq[2]), tnx = Math.sin(tq[2]), tny = -Math.cos(tq[2]), s = w * 0.8;
    g.beginPath(); g.moveTo(tq[0] - ttx * s * 0.2, tq[1] - tty * s * 0.2); g.lineTo(tq[0] + tnx * s * 0.8, tq[1] + tny * s * 0.8); g.lineTo(tq[0] + ttx * s * 1.6, tq[1] + tty * s * 1.6);
    g.lineTo(tq[0] - tnx * s * 0.8, tq[1] - tny * s * 0.8); g.closePath(); g.fillStyle = rgbStr(mul(base, 0.85)); g.fill(); g.strokeStyle = INKS; g.lineWidth = Math.max(1, w * 0.12); g.stroke();
    // the head, facing the tail, with horns, a frill, teeth and a flicker of flame
    g.save(); headFrame(g, sp, top + off * 0.12, -1);
    var hw = w * 1.5, hl = hw * 3.1; w = hw;
    g.fillStyle = rgbStr(mix(belly, WHITE, 0.15)); g.strokeStyle = INKS; g.lineWidth = Math.max(1, w * 0.1); g.lineJoin = "round";
    [[0.2, 1.75, -1.3], [0.6, 1.4, -0.75]].forEach(function (h) {   // horns swept back
      g.beginPath(); g.moveTo(w * (h[0] + 0.5), w * 0.6); g.quadraticCurveTo(w * h[0], w * (h[1] + 0.3), w * h[2], w * h[1]); g.quadraticCurveTo(w * (h[0] + 0.1), w * (h[1] - 0.25), w * (h[0] + 0.95), w * 0.55); g.closePath(); g.fill(); g.stroke();
    });
    g.fillStyle = rgbStr(mul(base, 0.7));   // the frill behind the jaw
    g.beginPath(); g.moveTo(w * 0.6, -w * 0.3); g.lineTo(-w * 0.5, -w * 1.2); g.lineTo(w * 0.1, -w * 0.55); g.lineTo(-w * 0.6, -w * 0.4); g.lineTo(w * 0.3, w * 0.1); g.closePath(); g.fill(); g.stroke();
    var fl = t ? 0.55 + 0.45 * Math.sin(ph * 3) * Math.sin(ph * 2 + 1) : 0.4;   // a little flame at the mouth
    g.save(); g.globalCompositeOperation = "lighter";
    var fg = g.createRadialGradient(hl * 1.05, -w * 0.25, 0, hl * 1.05, -w * 0.25, w * (0.6 + fl * 0.5));
    fg.addColorStop(0, "rgba(255,240,170,0.9)"); fg.addColorStop(0.5, "rgba(255,140,30,0.6)"); fg.addColorStop(1, "rgba(255,60,0,0)");
    g.fillStyle = fg; g.beginPath(); g.arc(hl * 1.05, -w * 0.25, w * (0.6 + fl * 0.5), 0, TAU); g.fill(); g.restore();
    snakeHead(g, w, base, belly, t, false, 0);
    g.fillStyle = "#fffaf0"; for (var k = 0; k < 4; k++) { var x = hl * (0.55 + k * 0.1); g.beginPath(); g.moveTo(x, -w * 0.28); g.lineTo(x + w * 0.1, -w * 0.5); g.lineTo(x + w * 0.2, -w * 0.28); g.closePath(); g.fill(); }
    g.restore();
  }

  function chainOver(g, N, r0, r1, col, t) {
    var band = r1 - r0, rm = (r0 + r1) / 2, metal = natural(col, "#9aa3ab"), L = band * 1.05, n = Math.max(8, Math.round(rper(rm) / (L * 0.72)));
    if (n % 2) n++;
    for (var pass = 0; pass < 2; pass++) for (var i = pass; i < n; i += 2) {
      var q = rp(rm, i / n * TAU), lw = pass ? band * 0.13 : band * 0.16, l = lightAt(Math.sin(q[2]), -Math.cos(q[2]));
      g.save(); g.translate(q[0], q[1]); g.rotate(q[2]);
      var hw = pass ? band * 0.13 : band * 0.3, hl = L / 2;
      g.beginPath(); g.moveTo(-hl + hw, -hw); g.lineTo(hl - hw, -hw); g.arc(hl - hw, 0, hw, -Math.PI / 2, Math.PI / 2); g.lineTo(-hl + hw, hw); g.arc(-hl + hw, 0, hw, Math.PI / 2, Math.PI * 1.5); g.closePath();
      g.lineJoin = "round"; g.strokeStyle = INKS; g.lineWidth = lw * 1.5; g.stroke();
      var gr = g.createLinearGradient(0, -hw - lw, 0, hw + lw); gr.addColorStop(0, rgbStr(mix(metal, WHITE, 0.3 + 0.4 * l))); gr.addColorStop(0.5, rgbStr(metal)); gr.addColorStop(1, rgbStr(mul(metal, 0.45)));
      g.strokeStyle = gr; g.lineWidth = lw; g.stroke();
      g.strokeStyle = "rgba(255,255,255," + (0.2 + 0.45 * l).toFixed(2) + ")"; g.lineWidth = lw * 0.25; g.beginPath(); g.moveTo(-hl + hw, -hw - lw * 0.2); g.lineTo(hl - hw, -hw - lw * 0.2); g.stroke();
      g.restore();
    }
  }

  function ropeOver(g, N, r0, r1, col, t) {
    var band = r1 - r0, rm = (r0 + r1) / 2, fiber = natural(col, "#c6a068"), w = band * 0.62, pts = along(rm, 0, TAU, 2);
    strokeTube(g, pts, w, fiber);
    // the twist: diagonal grooves across the rope
    var acc = 0, step = w * 0.42;
    g.strokeStyle = rgbStr(mul(fiber, 0.55), 0.85); g.lineWidth = Math.max(0.7, w * 0.08); g.lineCap = "round";
    for (var i = 1; i < pts.length; i++) {
      var a = pts[i], b = pts[i - 1]; acc += Math.hypot(a[0] - b[0], a[1] - b[1]); if (acc < step) continue; acc = 0;
      var tx = Math.cos(a[2]), ty = Math.sin(a[2]);
      g.beginPath(); g.moveTo(a[0] - a[3] * w * 0.45 - tx * w * 0.2, a[1] - a[4] * w * 0.45 - ty * w * 0.2); g.quadraticCurveTo(a[0] + tx * w * 0.05, a[1] + ty * w * 0.05, a[0] + a[3] * w * 0.45 + tx * w * 0.2, a[1] + a[4] * w * 0.45 + ty * w * 0.2); g.stroke();
    }
    var n = Math.max(3, Math.round(nCount(16) / 3));   // knots
    for (var k = 0; k < n; k++) {
      var q = rp(rm, (k + 0.5) / n * TAU - Math.PI / 2), s = w * 0.85;
      g.save(); g.translate(q[0], q[1]); g.rotate(q[2]);
      g.beginPath(); g.ellipse(0, 0, s, s * 0.82, 0, 0, TAU);
      var gr = g.createRadialGradient(-s * 0.3, -s * 0.35, s * 0.1, 0, 0, s); gr.addColorStop(0, rgbStr(mix(fiber, WHITE, 0.35))); gr.addColorStop(1, rgbStr(mul(fiber, 0.6)));
      g.fillStyle = gr; g.fill(); g.strokeStyle = INKS; g.lineWidth = Math.max(1, w * 0.1); g.stroke();
      g.strokeStyle = rgbStr(mul(fiber, 0.45)); g.lineWidth = Math.max(0.8, w * 0.09);
      g.beginPath(); g.moveTo(-s * 0.8, -s * 0.3); g.bezierCurveTo(-s * 0.2, -s * 0.9, s * 0.5, s * 0.6, s * 0.85, -s * 0.1); g.stroke();
      g.beginPath(); g.moveTo(-s * 0.8, s * 0.35); g.bezierCurveTo(-s * 0.1, s * 0.9, s * 0.4, -s * 0.8, s * 0.8, s * 0.25); g.stroke();
      g.restore();
    }
  }

  function flamesOver(g, N, r0, r1, col, t) {
    var band = r1 - r0, n = nCount(Math.round(rper(r1) / (band * 0.7))), ph = phase(t), R2 = rng(77), hot = R.tintOn ? col : [255, 110, 20];
    var rb = r0 + band * 0.35;
    g.beginPath(); rring(g, rb + band * 0.1); rring(g, r0); var bg = g.createLinearGradient(0, cur.cy - r1, 0, cur.cy + r1);
    bg.addColorStop(0, "rgba(90,20,4,0.95)"); bg.addColorStop(1, "rgba(50,10,2,0.95)"); g.fillStyle = bg; g.fill("evenodd");
    for (var layer = 0; layer < 3; layer++) {
      var cols = [[mix(hot, [200, 30, 0], 0.4), 1.0], [hot, 0.72], [mix(hot, [255, 240, 160], 0.75), 0.42]][layer];
      g.save(); if (layer) g.globalCompositeOperation = "lighter";
      for (var i = 0; i < n; i++) {
        var s1 = R2(), s2 = R2(), a = (i + 0.5 * s1) / n * TAU, q = rp(rb, a), tx = Math.cos(q[2]), ty = Math.sin(q[2]), nx = Math.sin(q[2]), ny = -Math.cos(q[2]);
        var flick = t ? 0.82 + 0.18 * Math.sin(ph * (1 + (i % 3)) + s2 * TAU) : 0.9;
        var H = band * (0.9 + s1 * 0.8) * (R.len || 1) * flick * cols[1], W = rper(rb) / n * 0.65 * (0.8 + s2 * 0.4) * (layer ? cols[1] + 0.15 : 1);
        var sway = (t ? Math.sin(ph + i) * 0.25 : 0.1) * H, tipx = q[0] + nx * H + tx * sway, tipy = q[1] + ny * H + ty * sway;
        g.beginPath(); g.moveTo(q[0] - tx * W, q[1] - ty * W);
        g.bezierCurveTo(q[0] - tx * W + nx * H * 0.5, q[1] - ty * W + ny * H * 0.5, tipx - tx * W * 0.2 - nx * H * 0.2, tipy - ty * W * 0.2 - ny * H * 0.2, tipx, tipy);
        g.bezierCurveTo(tipx + tx * W * 0.5 - nx * H * 0.35, tipy + ty * W * 0.5 - ny * H * 0.35, q[0] + tx * W + nx * H * 0.3, q[1] + ty * W + ny * H * 0.3, q[0] + tx * W, q[1] + ty * W);
        g.closePath(); g.fillStyle = rgbStr(cols[0], layer ? 0.75 : 0.95); g.fill();
      }
      g.restore(); R2 = rng(77);
    }
  }

  function tentaclesOver(g, N, r0, r1, col, t) {
    var band = r1 - r0, rm = (r0 + r1) / 2, flesh = natural(col, "#8a3f8f"), n = Math.max(4, Math.round(nCount(16) / 2.2)), ph = phase(t);
    var under = mix(flesh, [255, 200, 210], 0.55);
    strokeTube(g, along(rm, 0, TAU, 3), band * 0.62, mul(flesh, 0.8));   // a fleshy hoop the arms grow from
    for (var i = 0; i < n; i++) {
      var side = i % 2 ? 1 : -1, q0 = rp(rm, (i + 0.5) / n * TAU), tx = Math.cos(q0[2]), ty = Math.sin(q0[2]), nx = Math.sin(q0[2]), ny = -Math.cos(q0[2]);
      var L = band * 3.4 * (R.len || 1), m = 56, x = q0[0], y = q0[1], pts = [], sway = t ? Math.sin(ph + i * 1.9) * 0.35 : 0, w0 = band * 0.46;
      for (var k = 0; k <= m; k++) {
        var s2 = k / m, ang = side * (0.3 + 4.4 * Math.pow(s2, 2.8) + sway * s2);   // from leaning along the ring to a curl at the tip
        var dx = nx * Math.cos(ang) + tx * Math.sin(ang), dy = ny * Math.cos(ang) + ty * Math.sin(ang);
        pts.push([x, y, Math.atan2(dy, dx), -dy * side, dx * side, w0 * (1 - s2 * 0.88)]);
        var stp = L / m * (1 - s2 * 0.55); x += dx * stp; y += dy * stp;
      }
      var k2;
      for (k2 = 1; k2 < pts.length; k2++) { var a0 = pts[k2 - 1], a1 = pts[k2]; g.lineCap = "round"; g.strokeStyle = INKS; g.lineWidth = a1[5] * 1.25 + 1.2; g.beginPath(); g.moveTo(a0[0], a0[1]); g.lineTo(a1[0], a1[1]); g.stroke(); }
      for (k2 = 1; k2 < pts.length; k2++) {
        a0 = pts[k2 - 1]; a1 = pts[k2]; var l = lightAt(Math.cos(a1[2]), Math.sin(a1[2]));
        g.strokeStyle = rgbStr(mix(flesh, WHITE, 0.08 + 0.12 * l)); g.lineWidth = a1[5]; g.beginPath(); g.moveTo(a0[0], a0[1]); g.lineTo(a1[0], a1[1]); g.stroke();
        g.strokeStyle = rgbStr(under); g.lineWidth = a1[5] * 0.38; g.beginPath();
        g.moveTo(a0[0] + a0[3] * a0[5] * 0.3, a0[1] + a0[4] * a0[5] * 0.3); g.lineTo(a1[0] + a1[3] * a1[5] * 0.3, a1[1] + a1[4] * a1[5] * 0.3); g.stroke();
      }
      for (k2 = 2; k2 < pts.length - 3; k2 += 3) {   // suckers along the inside of the curl
        var q2 = pts[k2], sr = q2[5] * 0.2; if (sr < 0.7) continue;
        g.fillStyle = rgbStr(mix(under, WHITE, 0.35)); g.strokeStyle = rgbStr(mul(flesh, 0.55)); g.lineWidth = Math.max(0.5, sr * 0.4);
        g.beginPath(); g.arc(q2[0] + q2[3] * q2[5] * 0.34, q2[1] + q2[4] * q2[5] * 0.34, sr, 0, TAU); g.fill(); g.stroke();
      }
      for (k2 = 1; k2 < pts.length; k2 += 3) { var p1 = pts[k2]; g.fillStyle = "rgba(255,255,255,0.3)"; g.beginPath(); g.arc(p1[0] - p1[3] * p1[5] * 0.22, p1[1] - p1[4] * p1[5] * 0.22, p1[5] * 0.12, 0, TAU); g.fill(); }
    }
  }

  function bonesOver(g, N, r0, r1, col, t) {
    var band = r1 - r0, rm = (r0 + r1) / 2, ivory = natural(col, "#e9e0c8"), L = band * 1.5, n = Math.max(6, Math.round(rper(rm) / (L * 0.85)));
    for (var i = 0; i < n; i++) {
      var q = rp(rm + (i % 2 ? band * 0.12 : -band * 0.12), i / n * TAU), hl = L / 2, sw = band * 0.14, kr = band * 0.17, l = lightAt(Math.sin(q[2]), -Math.cos(q[2]));
      g.save(); g.translate(q[0], q[1]); g.rotate(q[2] + (i % 2 ? 0.12 : -0.12));
      g.beginPath(); g.rect(-hl + kr, -sw, (hl - kr) * 2, sw * 2);
      [-1, 1].forEach(function (s) { g.moveTo(s * (hl - kr) + kr, -kr * 0.9); g.arc(s * (hl - kr), -kr * 0.9, kr, 0, TAU); g.moveTo(s * (hl - kr) + kr, kr * 0.9); g.arc(s * (hl - kr), kr * 0.9, kr, 0, TAU); });
      g.save(); g.shadowColor = "rgba(0,0,0,0.4)"; g.shadowBlur = band * 0.12; g.shadowOffsetY = band * 0.05; g.strokeStyle = INKS; g.lineWidth = Math.max(1, band * 0.06); g.stroke(); g.restore();
      var gr = g.createLinearGradient(0, -kr * 2, 0, kr * 2); gr.addColorStop(0, rgbStr(mix(ivory, WHITE, 0.4 + 0.3 * l))); gr.addColorStop(0.6, rgbStr(ivory)); gr.addColorStop(1, rgbStr(mix(ivory, [120, 100, 70], 0.45)));
      g.fillStyle = gr; g.fill("nonzero");
      g.strokeStyle = "rgba(120,100,70,0.4)"; g.lineWidth = Math.max(0.5, band * 0.025); g.beginPath(); g.moveTo(-hl * 0.5, sw * 0.4); g.lineTo(hl * 0.5, sw * 0.4); g.stroke();
      g.restore();
    }
  }

  function crystalsOver(g, N, r0, r1, col, t) {
    var band = r1 - r0, gem = natural(col, "#5fc8ff"), n = nCount(Math.round(rper(r1) / (band * 0.55))), R2 = rng(19), ph = phase(t);
    var rb = r0 + band * 0.35;
    g.beginPath(); rring(g, rb + band * 0.12); rring(g, r0); g.fillStyle = "rgba(58,54,66,0.97)"; g.fill("evenodd"); g.strokeStyle = INKS; g.lineWidth = Math.max(1, band * 0.04); g.stroke();
    for (var i = 0; i < n; i++) {
      var a = (i + R2() * 0.7) / n * TAU, q = rp(rb, a), lean = (R2() - 0.5) * 0.7, tx = Math.cos(q[2]), ty = Math.sin(q[2]);
      var nx = Math.sin(q[2]) * Math.cos(lean) + tx * Math.sin(lean), ny = -Math.cos(q[2]) * Math.cos(lean) + ty * Math.sin(lean);
      var H = band * (0.6 + R2() * 0.9) * (R.len || 1), W = band * (0.14 + R2() * 0.1), px = -ny, py = nx, l = lightAt(nx, ny);
      var tip = [q[0] + nx * H, q[1] + ny * H], sh = [q[0] + nx * H * 0.78, q[1] + ny * H * 0.78];
      // two faces of a prism with a pointed tip: a light face and a shadowed face
      var c1 = mix(gem, WHITE, 0.35 + 0.3 * l), c2 = mul(gem, 0.6);
      g.beginPath(); g.moveTo(q[0] - px * W, q[1] - py * W); g.lineTo(sh[0] - px * W, sh[1] - py * W); g.lineTo(tip[0], tip[1]); g.lineTo(sh[0], sh[1]); g.lineTo(q[0], q[1]); g.closePath();
      g.fillStyle = rgbStr(c1, 0.88); g.fill();
      g.beginPath(); g.moveTo(q[0], q[1]); g.lineTo(sh[0], sh[1]); g.lineTo(tip[0], tip[1]); g.lineTo(sh[0] + px * W, sh[1] + py * W); g.lineTo(q[0] + px * W, q[1] + py * W); g.closePath();
      g.fillStyle = rgbStr(c2, 0.9); g.fill();
      g.beginPath(); g.moveTo(q[0] - px * W, q[1] - py * W); g.lineTo(sh[0] - px * W, sh[1] - py * W); g.lineTo(tip[0], tip[1]); g.lineTo(sh[0] + px * W, sh[1] + py * W); g.lineTo(q[0] + px * W, q[1] + py * W);
      g.strokeStyle = INKS; g.lineWidth = Math.max(0.8, band * 0.03); g.lineJoin = "round"; g.stroke();
      var sp = t ? Math.max(0, Math.sin(ph + i * 2.1)) : 0.3;   // a glint that moves from shard to shard
      g.strokeStyle = "rgba(255,255,255," + (0.35 + 0.5 * sp * l).toFixed(2) + ")"; g.lineWidth = Math.max(0.6, W * 0.25);
      g.beginPath(); g.moveTo(q[0] - px * W * 0.55 + nx * H * 0.1, q[1] - py * W * 0.55 + ny * H * 0.1); g.lineTo(sh[0] - px * W * 0.55, sh[1] - py * W * 0.55); g.stroke();
    }
  }
  function sculpt(name, over, extra) {
    add("Sculpted", name, function (p, col, t) { return [0, 0, 0, 0]; }, FLAT, null, Object.assign({ vector: true, over: over, sculpted: true }, extra || {}));
  }
  sculpt("Barbed wire", barbedOver);
  sculpt("Spikes", spikesOver, { lenCount: true });
  sculpt("Thorny vines", vinesOver, { lenCount: true });
  sculpt("Snake", snakeOver, { anim: true });
  sculpt("Two snakes", twoSnakesOver, { anim: true });
  sculpt("Dragon", dragonOver, { anim: true });
  sculpt("Chain", chainOver);
  sculpt("Rope", ropeOver, { lenCount: true });
  sculpt("Flames", flamesOver, { anim: true, lenCount: true });
  sculpt("Tentacles", tentaclesOver, { anim: true, lenCount: true });
  sculpt("Bones", bonesOver);
  sculpt("Crystal shards", crystalsOver, { anim: true, lenCount: true });


  var FAMS = ["Painted", "Metal", "Runes", "Wood", "Stone", "More", "Sculpted", "Tech", "Energy"];
  var FAM_LABEL = { Painted: "Painted", Metal: "Metal", Runes: "Carved runes", Wood: "Wood", Stone: "Stone", More: "More", Sculpted: "Sculpted", Tech: "Tech", Energy: "Energy" };
  var FAM_GAME = { Painted: "both", Metal: "both", Runes: "fantasy", Wood: "fantasy", Stone: "fantasy", More: "fantasy", Sculpted: "both", Tech: "scifi", Energy: "scifi" };
  function styleById(id) { for (var i = 0; i < STYLES.length; i++) if (STYLES[i].id === id) return STYLES[i]; return null; }

  function shade(rgb, p, sh) {
    if (sh.kind === "emit") return rgb;
    if (sh.kind === "fn") return sh.fn(rgb, p);
    var nrm;
    if (sh.kind === "round") nrm = -Math.cos(Math.PI * p.t);
    else { var e = 0.16; nrm = p.t < e ? -0.85 : p.t > 1 - e ? 0.85 : 0; }
    var lam = (p.rx * LX + p.ry * LY) * nrm, b = 1 + lam * sh.k;
    if (sh.kind === "round") b *= 0.84 + 0.16 * Math.sin(Math.PI * p.t);
    b *= 0.72 + 0.28 * Math.min(1, p.t / 0.05, (1 - p.t) / 0.05);
    var sp = sh.spec && lam > 0 ? Math.pow(lam, 7) * sh.spec * 255 : 0;
    var out = [rgb[0] * b + sp, rgb[1] * b + sp, rgb[2] * b + sp];
    if (rgb.length > 3) out.push(rgb[3]);
    return out;
  }
  // geo: { shape, cx, cy } on this canvas (default: a circle in the middle). The band runs from radius r0 to r1 of that shape.
  function paintRing(N, r0, r1, st, col, tint, t, geo) {
    // t is the animation time in seconds (0 for a still token); every pixel, decoration and glow function takes it, so an animated
    // export renders its frames with the same code.
    t = t || 0;
    var sh = geo && geo.shape ? geo.shape : SHAPES[0], cxx = geo && geo.cx !== undefined ? geo.cx : N / 2, cyy = geo && geo.cy !== undefined ? geo.cy : N / 2;
    var cv = mk(N), g = cx2(cv), id = g.createImageData(N, N), D = id.data, p = {}, o = {};
    var ext = sh.n ? r1 / Math.cos(sh.half) + 2 : r1 + 1;
    var x0 = Math.max(0, Math.floor(cxx - ext)), x1 = Math.min(N, Math.ceil(cxx + ext)), y0 = Math.max(0, Math.floor(cyy - ext)), y1 = Math.min(N, Math.ceil(cyy + ext)), band = r1 - r0;
    cur = { s: sh, cx: cxx, cy: cyy };
    p.band = band; p.rm = shapePerim(sh, (r0 + r1) / 2) / TAU; p.N = N; p.time = t;
    var noTint = st.fam === "Painted" || st.usesColor, lit = st.fam === "Energy" || !!st.emissive;
    R.tintOn = !!tint;
    if (st.vector) y1 = y0;   // drawn as vectors only (Sculpted)
    for (var y = y0; y < y1; y++) {
      for (var x = x0; x < x1; x++) {
        var dx = x + 0.5 - cxx, dy = y + 0.5 - cyy;
        shapeInfo(sh, dx, dy, o);
        var d = o.d, cov = clamp01(r1 + 0.5 - d) * clamp01(d - r0 + 0.5);
        if (cov <= 0) continue;
        p.t = clamp01((d - r0) / band); p.a = o.a; p.u = (x + 0.5) / N; p.v = (y + 0.5) / N; p.dn = d / N;
        p.rx = o.nx; p.ry = o.ny;
        var rgb = st.pix(p, col, t), al = rgb.length > 3 ? rgb[3] : 1;
        if (tint && !noTint) {
          var l = (rgb[0] * 0.3 + rgb[1] * 0.59 + rgb[2] * 0.11) / 255;
          rgb = mix(rgb, [col[0] * l * 1.5, col[1] * l * 1.5, col[2] * l * 1.5], 0.65);
        }
        rgb = shade(rgb, p, st.shade);
        if (lit && R.glow !== 1) {   // the Glow setting: dim toward unlit glass below 100%, brighter (and a little more solid) above
          var gk = R.glow;
          if (gk < 1) rgb = [rgb[0] * (0.22 + 0.78 * gk), rgb[1] * (0.22 + 0.78 * gk), rgb[2] * (0.22 + 0.78 * gk)];
          else { var up = 1 + (gk - 1) * 0.35; rgb = [rgb[0] * up + (gk - 1) * 30, rgb[1] * up + (gk - 1) * 30, rgb[2] * up + (gk - 1) * 30]; al = Math.min(1, al * (1 + (gk - 1) * 0.5)); }
        }
        var i = (y * N + x) * 4;
        D[i] = rgb[0]; D[i + 1] = rgb[1]; D[i + 2] = rgb[2]; D[i + 3] = cov * al * 255;
      }
    }
    g.putImageData(id, 0, 0);
    if (st.deco) { g.save(); g.beginPath(); rring(g, r1); rring(g, r0); g.clip("evenodd"); st.deco(g, N, r0, r1, col, t); g.restore(); }
    if (st.glow) { g.save(); g.globalCompositeOperation = "lighter"; st.glow(g, N, r0, r1, col, t); g.restore(); }
    if (st.over) { g.save(); st.over(g, N, r0, r1, col, t); g.restore(); }
    return cv;
  }

  TG.rings = {
    TAU: TAU, SQ3: SQ3, LX: LX, LY: LY, WHITE: WHITE, R: R, mk: mk, cx2: cx2, clamp01: clamp01, smooth: smooth, hex: hex, toHex: toHex, mix: mix, mul: mul,
    rgbStr: rgbStr, hsl: hsl, hash2: hash2, vnoise: vnoise, fbm: fbm, rng: rng, crackAt: crackAt, phase: phase, frac: frac, neonFlicker: neonFlicker,
    SHAPES: SHAPES, shapeById: shapeById, shapeRad: shapeRad, shapeInfo: shapeInfo, shapePt: shapePt, shapeOutline: shapeOutline, shapeArc: shapeArc,
    shapePerim: shapePerim, glowSpread: glowSpread, hexCell: hexCell, rivet: rivet, sparkle: sparkle, steelPix: steelPix,
    STYLES: STYLES, FAMS: FAMS, FAM_LABEL: FAM_LABEL, FAM_GAME: FAM_GAME, styleById: styleById, shade: shade, paintRing: paintRing
  };
}());
