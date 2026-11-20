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
  var R = { loop: 1.5, glow: 1, flick: "strong" };
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

  var FAMS = ["Painted", "Metal", "Runes", "Wood", "Stone", "More", "Tech", "Energy"];
  var FAM_LABEL = { Painted: "Painted", Metal: "Metal", Runes: "Carved runes", Wood: "Wood", Stone: "Stone", More: "More", Tech: "Tech", Energy: "Energy" };
  var FAM_GAME = { Painted: "both", Metal: "both", Runes: "fantasy", Wood: "fantasy", Stone: "fantasy", More: "fantasy", Tech: "scifi", Energy: "scifi" };
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
