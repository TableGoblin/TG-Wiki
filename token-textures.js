/* Table Goblin token creator: procedural backdrop textures. Each texture paints an N x N canvas from a seed, a pattern scale and the
   time t (0 for a still token); nothing is downloaded. Loaded after token-rings.js. */
(function () {
  "use strict";
  var TG = window.TGTok = window.TGTok || {}, K = TG.rings;
  var TAU = K.TAU, SQ3 = K.SQ3, mk = K.mk, cx2 = K.cx2, clamp01 = K.clamp01, smooth = K.smooth, mix = K.mix, mul = K.mul, hash2 = K.hash2,
      vnoise = K.vnoise, fbm = K.fbm, rng = K.rng, crackAt = K.crackAt, rgbStr = K.rgbStr, hexCell = K.hexCell, rivet = K.rivet, sparkle = K.sparkle;

  // Fills the whole canvas pixel by pixel. f(u, v, x, y) returns [r, g, b] with u, v the 0..1 position scaled by the pattern scale.
  function perPixel(g, N, sc, f) {
    var id = g.createImageData(N, N), D = id.data, i = 0;
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++, i += 4) {
      var c = f((x + 0.5) / N / sc, (y + 0.5) / N / sc, x, y);
      D[i] = c[0]; D[i + 1] = c[1]; D[i + 2] = c[2]; D[i + 3] = 255;
    }
    g.putImageData(id, 0, 0);
  }
  function stars(g, N, R, count, sc) {
    var n = Math.round(count / (sc * sc)), i;
    for (i = 0; i < n; i++) {
      var x = R() * N, y = R() * N, cls = R(), s = N / 1024 * (cls < 0.75 ? 0.7 : cls < 0.95 ? 1.3 : 2.1);
      g.fillStyle = "rgba(" + (225 + R() * 30 | 0) + "," + (225 + R() * 30 | 0) + ",255," + (0.4 + R() * 0.6).toFixed(2) + ")";
      g.beginPath(); g.arc(x, y, s, 0, TAU); g.fill();
    }
    g.fillStyle = "rgba(255,250,235,0.9)";
    for (i = 0; i < 7; i++) {
      var fx = R() * N, fy = R() * N, L = N * (0.012 + R() * 0.014);
      var gr = g.createRadialGradient(fx, fy, 0, fx, fy, L * 0.9); gr.addColorStop(0, "rgba(255,255,255,0.7)"); gr.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = gr; g.beginPath(); g.arc(fx, fy, L * 0.9, 0, TAU); g.fill();
      g.fillStyle = "rgba(255,250,235,0.9)"; sparkle(g, fx, fy, L);
    }
  }

  var TEXTURES = [];
  function add(group, id, name, draw) { TEXTURES.push({ id: id, group: group, name: name, draw: draw }); }

  add("Fantasy", "parchment", "Parchment", function (g, N, o) {
    var sc = o.scale, s = o.seed;
    perPixel(g, N, sc, function (u, v) {
      var c = mix([217, 197, 154], [241, 227, 189], fbm(u * 3, v * 3, s, 4));
      var bl = fbm(u * 1.5, v * 1.5, s + 9, 3); if (bl > 0.6) c = mul(c, 1 - (bl - 0.6) * 0.6);
      c = mul(c, 0.94 + 0.06 * vnoise(u * 160, v * 30, s + 3));
      return c;
    });
    var gr = g.createRadialGradient(N / 2, N / 2, N * 0.3, N / 2, N / 2, N * 0.75);
    gr.addColorStop(0, "rgba(90,50,10,0)"); gr.addColorStop(1, "rgba(90,50,10,0.55)"); g.fillStyle = gr; g.fillRect(0, 0, N, N);
  });
  add("Fantasy", "stone", "Stone floor", function (g, N, o) {
    var sc = o.scale, s = o.seed, cells = 5;
    perPixel(g, N, sc, function (u, v) {
      var gx = u * cells, gy = v * cells, ix = Math.floor(gx), iy = Math.floor(gy), d1 = 9, d2 = 9, best = 0;
      for (var j = -1; j <= 1; j++) for (var i = -1; i <= 1; i++) {
        var cx = ix + i + 0.15 + 0.7 * hash2(ix + i, iy + j, s), cy = iy + j + 0.15 + 0.7 * hash2(ix + i, iy + j, s + 1), d = Math.hypot(gx - cx, gy - cy);
        if (d < d1) { d2 = d1; d1 = d; best = hash2(ix + i, iy + j, s + 2); } else if (d < d2) d2 = d;
      }
      var e = d2 - d1, base = mix([96, 94, 90], [158, 154, 146], best * 0.7 + fbm(u * 30, v * 30, s + 5, 3) * 0.3);
      if (e < 0.05) return mix([42, 40, 37], base, smooth(0.02, 0.05, e) * 0.4);
      return mul(base, 0.85 + 0.15 * smooth(0.05, 0.2, e));
    });
  });
  add("Fantasy", "tiles", "Dungeon tiles", function (g, N, o) {
    var sc = o.scale, s = o.seed, n = 6;
    perPixel(g, N, sc, function (u, v) {
      var fx = u * n, fy = v * n, ix = Math.floor(fx), iy = Math.floor(fy), rx = fx - ix, ry = fy - iy, e = Math.min(rx, ry, 1 - rx, 1 - ry);
      if (e < 0.035) { var moss = fbm(u * 12, v * 12, s + 7, 3); return moss > 0.58 ? mix([44, 40, 34], [62, 84, 38], (moss - 0.58) * 3) : [44, 40, 34]; }
      var chip = hash2(ix, iy, s + 3) > 0.7 && Math.min(Math.hypot(rx, ry), Math.hypot(1 - rx, ry), Math.hypot(rx, 1 - ry), Math.hypot(1 - rx, 1 - ry)) < 0.12;
      if (chip) return [50, 46, 40];
      var base = mix([104, 100, 92], [150, 146, 136], hash2(ix, iy, s) * 0.6 + fbm(u * 18, v * 18, s + 1, 3) * 0.4);
      base = mul(base, 0.8 + 0.2 * smooth(0, 0.08, e));
      return mix(base, [40, 38, 34], crackAt(u, v, 4, s + 2, 0.012) * 0.8);
    });
  });
  add("Fantasy", "grass", "Grass", function (g, N, o) {
    var sc = o.scale, s = o.seed, R = rng(s);
    perPixel(g, N, sc, function (u, v) { return mix([53, 89, 31], [111, 154, 58], fbm(u * 4, v * 4, s, 4)); });
    var n = Math.round(2600 * (N / 1024) * (N / 1024) / Math.max(0.25, sc * sc) * Math.min(1, 1024 / N)), greens = ["#3c6a22", "#5d8d32", "#86b04a"], k = N / 1024 / Math.sqrt(sc);
    g.lineCap = "round";
    for (var i = 0; i < n; i++) {
      var x = R() * N, y = R() * N, L = (10 + R() * 14) * k / Math.sqrt(sc) * sc, lean = (R() - 0.5) * 0.8;
      g.strokeStyle = greens[(R() * 3) | 0]; g.lineWidth = Math.max(0.5, 1.6 * k);
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + lean * L * 0.4, y - L * 0.6, x + lean * L, y - L); g.stroke();
    }
    for (i = 0; i < 26; i++) {
      var fx = R() * N, fy = R() * N, fc = ["#f4e27a", "#ffffff", "#d79ae8"][(R() * 3) | 0];
      g.fillStyle = fc; for (var j = 0; j < 5; j++) { var a = j * TAU / 5; g.beginPath(); g.arc(fx + Math.cos(a) * 2.6 * k, fy + Math.sin(a) * 2.6 * k, 2 * k, 0, TAU); g.fill(); }
      g.fillStyle = "#e0a020"; g.beginPath(); g.arc(fx, fy, 1.6 * k, 0, TAU); g.fill();
    }
  });
  add("Fantasy", "forest", "Forest", function (g, N, o) {
    var s = o.seed, R = rng(s), sc = o.scale;
    var bg = g.createLinearGradient(0, 0, 0, N); bg.addColorStop(0, "#1d3b1f"); bg.addColorStop(1, "#0e1f10"); g.fillStyle = bg; g.fillRect(0, 0, N, N);
    var cols = [[46, 92, 38], [74, 122, 44], [120, 150, 60], [190, 170, 80], [30, 70, 34]];
    for (var i = 0; i < 75; i++) {
      var x = R() * N, y = R() * N * 0.9, r = N * (0.04 + R() * 0.1) * sc, c = cols[(R() * cols.length) | 0], a = 0.25 + R() * 0.45;
      var gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, rgbStr(c, a)); gr.addColorStop(0.7, rgbStr(c, a * 0.6)); gr.addColorStop(1, rgbStr(c, 0));
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    }
    g.globalCompositeOperation = "lighter";
    for (i = 0; i < 4; i++) {
      var x0 = N * (0.1 + R() * 0.8), w = N * (0.05 + R() * 0.07), lg = g.createLinearGradient(0, 0, 0, N);
      lg.addColorStop(0, "rgba(255,240,180,0.18)"); lg.addColorStop(1, "rgba(255,240,180,0)"); g.fillStyle = lg;
      g.beginPath(); g.moveTo(x0, 0); g.lineTo(x0 + w, 0); g.lineTo(x0 + w * 3 + N * 0.15, N); g.lineTo(x0 + N * 0.15, N); g.closePath(); g.fill();
    }
    g.globalCompositeOperation = "source-over";
  });
  add("Sci-fi", "starfield", "Starfield", function (g, N, o) {
    var bg = g.createRadialGradient(N * 0.35, N * 0.3, 0, N / 2, N / 2, N * 0.8); bg.addColorStop(0, "#101a3a"); bg.addColorStop(1, "#03050d");
    g.fillStyle = bg; g.fillRect(0, 0, N, N); stars(g, N, rng(o.seed), 900 * (N / 1024) * (N / 1024) + 60, o.scale);
  });
  add("Sci-fi", "nebula", "Nebula", function (g, N, o) {
    var s = o.seed, sc = o.scale, t1 = o.tint || [150, 60, 200];
    perPixel(g, N, sc, function (u, v) {
      var q = fbm(u * 2.5, v * 2.5, s, 4), n = fbm(u * 2.5 + q * 2.2, v * 2.5 - q * 2.2, s + 1, 5), k = Math.pow(clamp01(n * 1.3 - 0.15), 1.4);
      var c = k < 0.5 ? mix([4, 6, 16], t1, k * 2) : mix(t1, [255, 220, 200], (k - 0.5) * 1.4);
      return mix(c, [40, 120, 200], clamp01(fbm(u * 4, v * 4, s + 3, 3) - 0.55) * 0.9);
    });
    var tmp = mk(N), tg = cx2(tmp); stars(tg, N, rng(s + 11), 700 * (N / 1024) * (N / 1024) + 40, sc);
    g.globalAlpha = 0.6; g.drawImage(tmp, 0, 0); g.globalAlpha = 1;
  });
  add("Sci-fi", "deck", "Deck plating", function (g, N, o) {
    var sc = o.scale, s = o.seed, n = 3;
    perPixel(g, N, sc, function (u, v) {
      var fx = u * n, fy = v * n, ix = Math.floor(fx), iy = Math.floor(fy), rx = fx - ix, ry = fy - iy, e = Math.min(rx, ry, 1 - rx, 1 - ry);
      var base = mix([66, 72, 80], [150, 158, 166], clamp01(0.5 + (vnoise(u * 4, v * 700, s + ix * 3 + iy) - 0.5) * 0.5 + (hash2(ix, iy, s) - 0.5) * 0.3));
      if (e < 0.008) return [24, 26, 30];
      if (e < 0.016) return mix(base, [230, 236, 240], 0.25);
      if (iy % 3 === 1 && ry > 0.42 && ry < 0.58) { var k = Math.floor((u * n * 14 + ry * 4)) % 2; return k ? [210, 168, 20] : [26, 26, 28]; }
      return mul(base, 0.92 + 0.12 * fbm(u * 40, v * 40, s + 4, 2));
    });
    var R = rng(s + 5), cs = N * sc / n, sr = Math.max(1.2, N / 1024 * 5.5);
    for (var ix = 0; ix * cs < N + cs; ix++) for (var iy = 0; iy * cs < N + cs; iy++) {
      [[0.06, 0.06], [0.94, 0.06], [0.06, 0.94], [0.94, 0.94]].forEach(function (q) { rivet(g, (ix + q[0]) * cs, (iy + q[1]) * cs, sr); });
    }
    g.strokeStyle = "rgba(0,0,0,0.25)"; g.lineCap = "round";
    for (var i = 0; i < 30; i++) { var x = R() * N, y = R() * N, L = N * (0.02 + R() * 0.06), a = R() * TAU; g.lineWidth = Math.max(0.6, N / 1024 * 1.5); g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); g.stroke(); }
  });
  add("Sci-fi", "circuit", "Circuit board", function (g, N, o) {
    var sc = o.scale, s = o.seed, R = rng(s);
    perPixel(g, N, sc, function (u, v) { return mul(mix([10, 40, 26], [18, 70, 45], fbm(u * 6, v * 6, s, 3)), 0.95 + 0.05 * Math.sin(u * 900) * Math.sin(v * 900)); });
    var gs = N / 40 * sc, lw = Math.max(0.8, gs * 0.22), copper = "#c99436";
    g.lineCap = "round"; g.lineJoin = "round";
    for (var i = 0; i < Math.round(110 / (sc * sc)); i++) {
      var x = Math.round(R() * N / gs) * gs, y = Math.round(R() * N / gs) * gs, dir = (R() * 4) | 0, steps = 3 + (R() * 12 | 0);
      g.strokeStyle = copper; g.lineWidth = lw; g.beginPath(); g.moveTo(x, y);
      for (var k = 0; k < steps; k++) {
        if (R() < 0.25) { var d2 = (dir + (R() < 0.5 ? 1 : 3)) % 4; x += [gs, 0, -gs, 0][dir] * 0.5 + [gs, 0, -gs, 0][d2] * 0.5; y += [0, gs, 0, -gs][dir] * 0.5 + [0, gs, 0, -gs][d2] * 0.5; dir = d2; }
        else { x += [gs, 0, -gs, 0][dir]; y += [0, gs, 0, -gs][dir]; }
        g.lineTo(x, y);
      }
      g.stroke();
      g.fillStyle = copper; g.beginPath(); g.arc(x, y, lw * 1.6, 0, TAU); g.fill(); g.fillStyle = "#06150d"; g.beginPath(); g.arc(x, y, lw * 0.7, 0, TAU); g.fill();
    }
    for (i = 0; i < Math.round(7 / (sc * sc)); i++) {
      var cw = gs * (3 + R() * 4), ch = gs * (2 + R() * 3), cx = R() * N, cy = R() * N;
      g.fillStyle = "#c0c4c8"; for (var p = 0; p < cw / gs * 2; p++) { g.fillRect(cx + p * gs / 2 + gs * 0.1, cy - gs * 0.35, gs * 0.22, ch + gs * 0.7); }
      g.fillStyle = "#15171a"; g.fillRect(cx, cy, cw, ch); g.fillStyle = "rgba(255,255,255,0.12)"; g.fillRect(cx, cy, cw, ch * 0.18);
    }
  });
  add("Sci-fi", "hexgrid", "Hex grid", function (g, N, o) {
    var sc = o.scale, s = o.seed, t1 = o.tint || [60, 200, 255], size = 26 * sc * N / 1024;
    perPixel(g, N, 1, function (u, v, x, y) {
      var hc = hexCell(x / size, y / size), base = mix([6, 10, 16], [14, 22, 32], fbm(u * 4, v * 4, s, 3)), lit = hash2(hc.q, hc.r, s + 1) > 0.93;
      if (lit) base = mix(base, t1, 0.35 * (1 - hc.h));
      var line = smooth(0.82, 0.96, hc.h);
      return mix(base, mix(t1, [255, 255, 255], 0.2), line * 0.85);
    });
    var tmp = mk(N), tg = cx2(tmp); tg.filter = "blur(" + Math.max(1, N / 256) + "px)"; tg.drawImage(g.canvas, 0, 0); tg.filter = "none";
    g.globalCompositeOperation = "lighter"; g.globalAlpha = 0.5; g.drawImage(tmp, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
  });
  // Phase 3: more textures
  add("Fantasy", "planks", "Wood planks", function (g, N, o) {
    var sc = o.scale, s = o.seed, rows = 7;
    perPixel(g, N, sc, function (u, v) {
      var fy = v * rows, iy = Math.floor(fy), ry = fy - iy, off = hash2(iy, 1, s), fx = u * 1.6 + off, ix = Math.floor(fx), rx = fx - ix;
      if (ry < 0.04 || ry > 0.96 || rx < 0.006) return [28, 18, 10];
      var w = ry * 2.2 + fbm(u * 3, v * 22 + iy * 3, s + iy, 3) * 3, gr = 0.5 + 0.5 * Math.sin(w * TAU);
      var c = mix([96, 60, 32], [166, 116, 70], clamp01(gr * 0.7 + vnoise(u * 300, v * 40, s + 2) * 0.3));
      c = mul(c, 0.85 + 0.3 * hash2(ix, iy, s + 4));
      if ((rx < 0.03 || rx > 0.97) && Math.abs(ry - 0.3) < 0.06 || (rx < 0.03 || rx > 0.97) && Math.abs(ry - 0.7) < 0.06) return [40, 40, 44];
      return c;
    });
  });
  add("Fantasy", "cave", "Cave rock", function (g, N, o) {
    var sc = o.scale, s = o.seed;
    perPixel(g, N, sc, function (u, v) {
      var c = mix([46, 40, 36], [124, 112, 100], fbm(u * 5, v * 5, s, 5));
      c = mix(c, [16, 12, 10], crackAt(u, v, 3, s + 1, 0.025) * 0.9);
      return mix(c, [16, 12, 10], crackAt(u, v, 7, s + 2, 0.012) * 0.6);
    });
    var gr = g.createRadialGradient(N / 2, N / 2, N * 0.15, N / 2, N / 2, N * 0.72);
    gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(0,0,0,0.7)"); g.fillStyle = gr; g.fillRect(0, 0, N, N);
  });
  add("Fantasy", "snow", "Snow", function (g, N, o) {
    var sc = o.scale, s = o.seed, R = rng(s);
    perPixel(g, N, sc, function (u, v) { var n = fbm(u * 3, v * 3, s, 4); return mix([170, 190, 220], [246, 250, 255], smooth(0.25, 0.7, n)); });
    g.fillStyle = "#ffffff";
    for (var i = 0; i < 400 * (N / 1024); i++) { var x = R() * N, y = R() * N; g.globalAlpha = 0.4 + R() * 0.6; g.fillRect(x, y, Math.max(1, N / 700), Math.max(1, N / 700)); }
    g.globalAlpha = 1;
  });
  add("Fantasy", "water", "Water", function (g, N, o) {
    var sc = o.scale, s = o.seed;
    perPixel(g, N, sc, function (u, v) {
      var w = fbm(u * 3, v * 3, s, 3) * 3, c1 = Math.sin(u * 40 + w * 4) * Math.sin(v * 26 - w * 3), k = Math.pow(clamp01(c1 * 0.5 + 0.5), 6);
      return mix(mix([12, 52, 90], [30, 110, 150], fbm(u * 2, v * 2, s + 1, 3)), [210, 240, 255], k * 0.7);
    });
  });
  add("Sci-fi", "holo", "Holo grid", function (g, N, o) {
    var t1 = o.tint || [60, 220, 255], hz = N * 0.42, R = rng(o.seed), sc = o.scale;
    var bg = g.createLinearGradient(0, 0, 0, N); bg.addColorStop(0, "#020409"); bg.addColorStop(0.42, "#0a1830"); bg.addColorStop(1, "#02050a");
    g.fillStyle = bg; g.fillRect(0, 0, N, N);
    var gl = g.createRadialGradient(N / 2, hz, 0, N / 2, hz, N * 0.6); gl.addColorStop(0, rgbStr(t1, 0.45)); gl.addColorStop(1, rgbStr(t1, 0));
    g.fillStyle = gl; g.fillRect(0, 0, N, N);
    g.strokeStyle = rgbStr(t1, 0.8); g.shadowColor = rgbStr(t1); g.shadowBlur = N / 120; g.lineWidth = Math.max(0.8, N / 600);
    var cols = Math.round(18 / sc);
    for (var i = -cols; i <= cols; i++) { g.beginPath(); g.moveTo(N / 2, hz); g.lineTo(N / 2 + i * N / cols * 1.4, N * 1.05); g.stroke(); }
    for (var j = 1; j < 16; j++) { var y = hz + (N - hz) * Math.pow(j / 15, 2.2); g.globalAlpha = 0.3 + 0.7 * j / 15; g.beginPath(); g.moveTo(0, y); g.lineTo(N, y); g.stroke(); }
    g.globalAlpha = 1; g.shadowBlur = 0; stars(g, N, R, 120, 1);
  });
  add("Sci-fi", "alien", "Alien ground", function (g, N, o) {
    var sc = o.scale, s = o.seed;
    perPixel(g, N, sc, function (u, v) {
      var c = mix([20, 60, 64], [86, 52, 120], fbm(u * 4, v * 4, s, 4)), cr = crackAt(u, v, 5, s + 1, 0.03);
      return mix(c, [120, 255, 200], cr * 0.85);
    });
  });

  function texById(id) { for (var i = 0; i < TEXTURES.length; i++) if (TEXTURES[i].id === id) return TEXTURES[i]; return null; }
  // o: { seed, scale, tint (rgb or null), tintAmt 0..1, vignette 0..1, t }
  function paintTexture(id, N, o) {
    var tx = texById(id), cv = mk(N), g = cx2(cv);
    if (!tx) return cv;
    // the glowing sci-fi textures take their glow color from the tint only once the tint is turned up
    tx.draw(g, N, { seed: o.seed | 0, scale: o.scale || 1, tint: o.tint && o.tintAmt > 0 ? o.tint : null, t: o.t || 0 });
    if (o.tint && o.tintAmt > 0) {
      g.save(); g.globalCompositeOperation = "multiply"; g.globalAlpha = o.tintAmt; g.fillStyle = rgbStr(o.tint); g.fillRect(0, 0, N, N); g.restore();
    }
    if (o.vignette > 0) {
      var gr = g.createRadialGradient(N / 2, N / 2, N * 0.22, N / 2, N / 2, N * 0.62);
      gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(0,0,0," + (0.75 * o.vignette).toFixed(3) + ")"); g.fillStyle = gr; g.fillRect(0, 0, N, N);
    }
    return cv;
  }
  TG.textures = { TEXTURES: TEXTURES, texById: texById, paintTexture: paintTexture };
}());
