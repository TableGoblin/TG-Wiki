/* Table Goblin token creator: background removal. Color keying in OKLab with soft edges, an edge-aware flood, speck cleanup, color
   fringe removal, an edge refine (guided filter), Smart select (Keep and Remove strokes solved by a graph cut in a background worker)
   and the optional AI remove. Everything runs on this device; the AI button downloads a model file from this site and the runtime from
   a pinned CDN, and the picture itself never leaves the browser. */
(function () {
  "use strict";
  var TG = window.TGTok = window.TGTok || {};

  // ---------- OKLab ----------
  // Values are scaled by 100 so L runs 0..100 and a, b about -40..40; distances read like the familiar Lab ones.
  var LIN = new Float32Array(256);
  for (var i = 0; i < 256; i++) { var c = i / 255; LIN[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  function labOf(r, g, b, out, o) {
    var R = LIN[r], G = LIN[g], B = LIN[b];
    var l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B), m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B),
        s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
    out[o] = (0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s) * 100;
    out[o + 1] = (1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s) * 100;
    out[o + 2] = (0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s) * 100;
  }
  function toLab(D, n) { var L = new Float32Array(n * 3); for (var p = 0; p < n; p++) labOf(D[p * 4], D[p * 4 + 1], D[p * 4 + 2], L, p * 3); return L; }
  // Sobel magnitude of the lightness
  function gradient(L, w, h) {
    var G = new Float32Array(w * h);
    for (var y = 1; y < h - 1; y++) for (var x = 1; x < w - 1; x++) {
      var p = y * w + x;
      function l(dx, dy) { return L[(p + dy * w + dx) * 3]; }
      var gx = l(1, -1) + 2 * l(1, 0) + l(1, 1) - l(-1, -1) - 2 * l(-1, 0) - l(-1, 1), gy = l(-1, 1) + 2 * l(0, 1) + l(1, 1) - l(-1, -1) - 2 * l(0, -1) - l(1, -1);
      G[p] = Math.sqrt(gx * gx + gy * gy) / 4;
    }
    return G;
  }
  function d2(L, p, m) { var dl = L[p * 3] - m[0], da = L[p * 3 + 1] - m[1], db = L[p * 3 + 2] - m[2]; return dl * dl + da * da + db * db; }
  function nearest(L, p, model) { var best = 1e9; for (var k = 0; k < model.length; k++) { var v = d2(L, p, model[k]); if (v < best) best = v; } return Math.sqrt(best); }

  // Clusters a list of pixels by Lab color (greedy, radius r). Returns [{lab, rgb, n, members}] biggest first.
  function cluster(L, D, pix, r) {
    var cl = [], r2 = r * r;
    for (var j = 0; j < pix.length; j++) {
      var p = pix[j], best = -1;
      for (var k = 0; k < cl.length; k++) { var c = cl[k], m = [c.s[0] / c.n, c.s[1] / c.n, c.s[2] / c.n]; if (d2(L, p, m) < r2) { best = k; break; } }
      if (best < 0) { if (cl.length >= 64) continue; cl.push({ n: 0, s: [0, 0, 0], rgb: [0, 0, 0], members: [] }); best = cl.length - 1; }
      var cc = cl[best]; cc.n++; cc.s[0] += L[p * 3]; cc.s[1] += L[p * 3 + 1]; cc.s[2] += L[p * 3 + 2];
      cc.rgb[0] += D[p * 4]; cc.rgb[1] += D[p * 4 + 1]; cc.rgb[2] += D[p * 4 + 2]; cc.members.push(p);
    }
    cl.forEach(function (c) { c.lab = [c.s[0] / c.n, c.s[1] / c.n, c.s[2] / c.n]; c.rgb = [c.rgb[0] / c.n, c.rgb[1] / c.n, c.rgb[2] / c.n]; });
    return cl.sort(function (a, b) { return b.n - a.n; });
  }

  // ---------- soft key with an edge-aware flood ----------
  // Returns a Uint8Array "remove" amount per pixel (255 = fully background). Core pixels (within T of the backdrop model) are removed
  // and spread the flood if the step from their neighbor is small and the picture's edge strength is low there. Pixels just past T
  // fade out over `soft`, so hair and glow keep a soft edge.
  function keyFlood(img, seeds, model, o) {
    var w = img.w, h = img.h, n = w * h, L = img.lab, G = img.grad, A = img.data, rm = new Uint8Array(n), T = o.T, S = Math.max(0.01, o.soft);
    var stepT = Math.max(1.5, T * 0.5), gLim = 8 + T * 1.2, T2 = T + S;
    function amt(dist) { return dist <= T ? 255 : dist >= T2 ? 0 : Math.round(255 * (1 - (dist - T) / S)); }
    if (!o.contiguous) {
      for (var p = 0; p < n; p++) { if (A[p * 4 + 3] < 24) { rm[p] = 255; continue; } rm[p] = amt(nearest(L, p, model)); }
      return rm;
    }
    var seen = new Uint8Array(n), stack = new Int32Array(n), sp = 0;
    seeds.forEach(function (s0) { if (!seen[s0]) { seen[s0] = 1; stack[sp++] = s0; rm[s0] = 255; } });
    while (sp) {
      var q = stack[--sp], x = q % w, y = (q - x) / w;
      for (var k = 0; k < 4; k++) {
        var nx = x + (k === 0 ? -1 : k === 1 ? 1 : 0), ny = y + (k === 2 ? -1 : k === 3 ? 1 : 0);
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        var np = ny * w + nx;
        if (seen[np]) continue;
        if (A[np * 4 + 3] < 24) { seen[np] = 1; rm[np] = 255; stack[sp++] = np; continue; }
        var dist = nearest(L, np, model), a = amt(dist);
        var step = Math.sqrt(d2(L, np, [L[q * 3], L[q * 3 + 1], L[q * 3 + 2]]));
        if (dist <= T && step <= stepT && G[np] < gLim) { seen[np] = 1; rm[np] = 255; stack[sp++] = np; }
        else if (a > rm[np]) rm[np] = a;   // a soft edge pixel: partly removed, the flood stops here
      }
    }
    return rm;
  }

  // ---------- cleanup ----------
  // Removes kept islands smaller than minIsland and fills removed holes (not touching the border) smaller than minHole.
  function cleanup(alpha, w, h, minIsland, minHole) {
    var n = w * h, lab = new Int32Array(n).fill(-1), stack = new Int32Array(n), changed = 0;
    function pass(isFg, minSize, setTo, keepBorder) {
      lab.fill(-1); var comps = [], biggest = -1, bigN = 0;
      for (var s = 0; s < n; s++) {
        if (lab[s] >= 0 || isFg(s) === false) continue;
        var id = comps.length, sp = 0, members = [], border = false; stack[sp++] = s; lab[s] = id;
        while (sp) {
          var p = stack[--sp], x = p % w, y = (p - x) / w; members.push(p);
          if (x === 0 || y === 0 || x === w - 1 || y === h - 1) border = true;
          if (x > 0 && lab[p - 1] < 0 && isFg(p - 1)) { lab[p - 1] = id; stack[sp++] = p - 1; }
          if (x < w - 1 && lab[p + 1] < 0 && isFg(p + 1)) { lab[p + 1] = id; stack[sp++] = p + 1; }
          if (y > 0 && lab[p - w] < 0 && isFg(p - w)) { lab[p - w] = id; stack[sp++] = p - w; }
          if (y < h - 1 && lab[p + w] < 0 && isFg(p + w)) { lab[p + w] = id; stack[sp++] = p + w; }
        }
        comps.push({ m: members, border: border });
        if (members.length > bigN) { bigN = members.length; biggest = id; }
      }
      comps.forEach(function (c, id) {
        if (id === biggest || c.m.length >= minSize || (keepBorder && c.border)) return;
        c.m.forEach(function (p) { alpha[p] = setTo; }); changed += c.m.length;
      });
    }
    if (minIsland > 0) pass(function (p) { return alpha[p] > 127; }, minIsland, 0, false);
    if (minHole > 0) pass(function (p) { return alpha[p] <= 127; }, minHole, 255, true);
    return changed;
  }

  // ---------- color fringe removal ----------
  // For edge pixels (partly see-through, or opaque next to a removed pixel), pull the color away from the old backdrop: solve
  // C = a*F + (1 - a)*B for F with the nearest backdrop color B, or blend toward the nearby solid foreground color.
  function despill(D, alpha, w, h, modelRgb, out) {
    var n = w * h;
    for (var p = 0; p < n; p++) {
      var a = alpha[p];
      if (a === 0) continue;
      var x = p % w, y = (p - x) / w, rim = a < 255;
      if (!rim) {
        if ((x > 0 && alpha[p - 1] < 200) || (x < w - 1 && alpha[p + 1] < 200) || (y > 0 && alpha[p - w] < 200) || (y < h - 1 && alpha[p + w] < 200)) rim = true;
        else continue;
      }
      var fr = 0, fg = 0, fb = 0, fn = 0;
      for (var dy = -2; dy <= 2; dy++) for (var dx = -2; dx <= 2; dx++) {
        var xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        var q = yy * w + xx; if (alpha[q] < 250) continue;
        var nb = q !== p && ((xx > 0 && alpha[q - 1] < 200) || (xx < w - 1 && alpha[q + 1] < 200) || (yy > 0 && alpha[q - w] < 200) || (yy < h - 1 && alpha[q + w] < 200));
        if (nb) continue;   // only the solid inside counts as the true color
        fr += D[q * 4]; fg += D[q * 4 + 1]; fb += D[q * 4 + 2]; fn++;
      }
      var C = [D[p * 4], D[p * 4 + 1], D[p * 4 + 2]], B = null, bd = 1e9;
      for (var k = 0; k < modelRgb.length; k++) { var m = modelRgb[k], dd = (C[0] - m[0]) * (C[0] - m[0]) + (C[1] - m[1]) * (C[1] - m[1]) + (C[2] - m[2]) * (C[2] - m[2]); if (dd < bd) { bd = dd; B = m; } }
      var F = fn ? [fr / fn, fg / fn, fb / fn] : null, res = C;
      if (B && a < 255 && a > 70) {
        var aa = a / 255; res = [(C[0] - (1 - aa) * B[0]) / aa, (C[1] - (1 - aa) * B[1]) / aa, (C[2] - (1 - aa) * B[2]) / aa];
        if (F) res = [res[0] * 0.6 + F[0] * 0.4, res[1] * 0.6 + F[1] * 0.4, res[2] * 0.6 + F[2] * 0.4];
      } else if (F && B) {
        var dCB = Math.sqrt(bd), dFB = Math.sqrt((F[0] - B[0]) * (F[0] - B[0]) + (F[1] - B[1]) * (F[1] - B[1]) + (F[2] - B[2]) * (F[2] - B[2]));
        var ae = Math.max(0, Math.min(1, dCB / Math.max(1, dFB)));
        res = [F[0] + (C[0] - F[0]) * ae, F[1] + (C[1] - F[1]) * ae, F[2] + (C[2] - F[2]) * ae];
      } else if (F && a < 255) {
        var t = 1 - a / 255; res = [C[0] + (F[0] - C[0]) * t, C[1] + (F[1] - C[1]) * t, C[2] + (F[2] - C[2]) * t];
      }
      out[p * 4] = res[0]; out[p * 4 + 1] = res[1]; out[p * 4 + 2] = res[2];
    }
  }

  // ---------- refine edge: the guided filter (He, Sun and Tang), luminance guide ----------
  function boxMean(a, w, h, r) {
    var o = new Float32Array(a.length), tmp = new Float32Array(a.length), x, y, s;
    for (y = 0; y < h; y++) {
      var row = y * w; s = 0;
      for (x = -r; x <= r; x++) s += a[row + Math.min(w - 1, Math.max(0, x))];
      for (x = 0; x < w; x++) { tmp[row + x] = s; s += a[row + Math.min(w - 1, x + r + 1)] - a[row + Math.max(0, x - r)]; }
    }
    for (x = 0; x < w; x++) {
      s = 0;
      for (y = -r; y <= r; y++) s += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
      for (y = 0; y < h; y++) { o[y * w + x] = s / ((2 * r + 1) * (2 * r + 1)); s += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x]; }
    }
    return o;
  }
  // I: guide 0..1, P: mask 0..1. Returns the refined mask, changed only in a band around the edge.
  function guided(I, P, w, h, r, eps) {
    var n = w * h, IP = new Float32Array(n), II = new Float32Array(n), i;
    for (i = 0; i < n; i++) { IP[i] = I[i] * P[i]; II[i] = I[i] * I[i]; }
    var mI = boxMean(I, w, h, r), mP = boxMean(P, w, h, r), mIP = boxMean(IP, w, h, r), mII = boxMean(II, w, h, r);
    var A = new Float32Array(n), B = new Float32Array(n);
    for (i = 0; i < n; i++) { var cov = mIP[i] - mI[i] * mP[i], vr = mII[i] - mI[i] * mI[i]; A[i] = cov / (vr + eps); B[i] = mP[i] - A[i] * mI[i]; }
    var mA = boxMean(A, w, h, r), mB = boxMean(B, w, h, r), out = new Float32Array(n);
    for (i = 0; i < n; i++) {
      var band = mP[i] > 0.01 && mP[i] < 0.99;
      out[i] = band ? Math.max(0, Math.min(1, mA[i] * I[i] + mB[i])) : P[i];
    }
    return out;
  }
  function lumOf(D, n) { var I = new Float32Array(n); for (var p = 0; p < n; p++) I[p] = (D[p * 4] * 0.299 + D[p * 4 + 1] * 0.587 + D[p * 4 + 2] * 0.114) / 255; return I; }
  function refineAlpha(img, alpha, radius) {
    var w = img.w, h = img.h, n = w * h, P = new Float32Array(n), i;
    if (!img.lum) img.lum = lumOf(img.data, n);
    for (i = 0; i < n; i++) P[i] = alpha[i] / 255;
    var r = radius || Math.max(2, Math.round(Math.max(w, h) / 300));
    var out = guided(img.lum, P, w, h, r, 2e-3), res = new Uint8Array(n);
    for (i = 0; i < n; i++) res[i] = Math.round(out[i] * 255);
    return res;
  }

  // ---------- Smart select: the graph cut runs in a worker made from this function's text ----------
  function smartWorker() {
    /* global self */
    function lab(r, g, b, out, o) {
      function lin(c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
      var R = lin(r), G = lin(g), B = lin(b);
      var l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B), m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B),
          s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
      out[o] = (0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s) * 100;
      out[o + 1] = (1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s) * 100;
      out[o + 2] = (0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s) * 100;
    }
    // Boykov-Kolmogorov max flow on an 8-connected grid. cap[p*8+k]: residual capacity of the arc from p to its k-th neighbor.
    // tr[p] > 0: residual capacity from the source to p; < 0: from p to the sink.
    function maxflow(w, h, cap, tr) {
      var n = w * h, DX = [-1, 0, 1, -1, 1, -1, 0, 1], DY = [-1, -1, -1, 0, 0, 1, 1, 1], OFF = [], k, p, q;
      for (k = 0; k < 8; k++) OFF.push(DY[k] * w + DX[k]);
      var tree = new Uint8Array(n), parent = new Int8Array(n), queue = new Int32Array(n * 4 + 16), qh = 0, qt = 0, inq = new Uint8Array(n);
      var orphans = new Int32Array(n), on = 0, TERM = 8, NONE = -1;
      function valid(p, k) { var x = p % w + DX[k], y = (p - p % w) / w + DY[k]; return x >= 0 && y >= 0 && x < w && y < h; }
      function push(p) { if (inq[p]) return; inq[p] = 1; queue[qt] = p; qt = (qt + 1) % queue.length; }
      for (p = 0; p < n; p++) {
        parent[p] = NONE;
        if (tr[p] > 0) { tree[p] = 1; parent[p] = TERM; push(p); } else if (tr[p] < 0) { tree[p] = 2; parent[p] = TERM; push(p); }
      }
      function rootOk(p) {   // walks to the terminal; true if the chain is intact
        var steps = 0;
        while (steps++ < n) { var pa = parent[p]; if (pa === TERM) return true; if (pa === NONE) return false; p = p + OFF[pa]; }
        return false;
      }
      var flow = 0;
      while (qh !== qt) {
        p = queue[qh]; qh = (qh + 1) % queue.length; inq[p] = 0;
        if (!tree[p]) continue;
        var found = -1, fk = -1;
        for (k = 0; k < 8 && found < 0; k++) {
          if (!valid(p, k)) continue;
          q = p + OFF[k];
          var c = tree[p] === 1 ? cap[p * 8 + k] : cap[q * 8 + (7 - k)];
          if (c <= 0) continue;
          if (!tree[q]) { tree[q] = tree[p]; parent[q] = 7 - k; push(q); }
          else if (tree[q] !== tree[p]) { found = q; fk = k; }
        }
        if (found < 0) continue;
        push(p);   // p may have more to give
        // the path: s ... a -> b ... t, where a is in the source tree
        var a = tree[p] === 1 ? p : found, b = tree[p] === 1 ? found : p, ka = tree[p] === 1 ? fk : 7 - fk;
        var bott = cap[a * 8 + ka], x = a;
        while (parent[x] !== TERM) { var pk = parent[x], px = x + OFF[pk]; bott = Math.min(bott, cap[px * 8 + (7 - pk)]); x = px; }
        bott = Math.min(bott, tr[x]);
        x = b;
        while (parent[x] !== TERM) { var pk2 = parent[x]; bott = Math.min(bott, cap[x * 8 + pk2]); x = x + OFF[pk2]; }
        bott = Math.min(bott, -tr[x]);
        if (bott <= 0) continue;
        cap[a * 8 + ka] -= bott; cap[b * 8 + (7 - ka)] += bott;
        x = a;
        while (parent[x] !== TERM) {
          var k3 = parent[x], px3 = x + OFF[k3];
          cap[px3 * 8 + (7 - k3)] -= bott; cap[x * 8 + k3] += bott;
          if (cap[px3 * 8 + (7 - k3)] <= 0) { parent[x] = NONE; orphans[on++] = x; }
          x = px3;
        }
        tr[x] -= bott; if (tr[x] <= 0) { parent[x] = NONE; orphans[on++] = x; }
        x = b;
        while (parent[x] !== TERM) {
          var k4 = parent[x], px4 = x + OFF[k4];
          cap[x * 8 + k4] -= bott; cap[px4 * 8 + (7 - k4)] += bott;
          if (cap[x * 8 + k4] <= 0) { parent[x] = NONE; orphans[on++] = x; }
          x = px4;
        }
        tr[x] += bott; if (tr[x] >= 0) { parent[x] = NONE; orphans[on++] = x; }
        flow += bott;
        // adoption
        while (on) {
          var o = orphans[--on], T = tree[o], best = NONE;
          for (k = 0; k < 8; k++) {
            if (!valid(o, k)) continue;
            q = o + OFF[k];
            if (tree[q] !== T) continue;
            var cc = T === 1 ? cap[q * 8 + (7 - k)] : cap[o * 8 + k];
            if (cc > 0 && rootOk(q)) { best = k; break; }
          }
          if (best !== NONE) { parent[o] = best; continue; }
          for (k = 0; k < 8; k++) {
            if (!valid(o, k)) continue;
            q = o + OFF[k];
            if (tree[q] !== T) continue;
            var c2 = T === 1 ? cap[q * 8 + (7 - k)] : cap[o * 8 + k];
            if (c2 > 0) push(q);
            if (parent[q] !== TERM && parent[q] !== NONE && q + OFF[parent[q]] === o) { parent[q] = NONE; orphans[on++] = q; }
          }
          tree[o] = 0;
        }
      }
      return { tree: tree, flow: flow };
    }
    self.onmessage = function (e) {
      var d = e.data, w = d.w, h = d.h, n = w * h, D = d.rgba, lbl = d.labels, L = new Float32Array(n * 3), p, k;
      for (p = 0; p < n; p++) lab(D[p * 4], D[p * 4 + 1], D[p * 4 + 2], L, p * 3);
      // color models: 3D histograms, 16 bins per axis, plus a coarse 8-bin one so unseen colors still get a sensible cost
      function bin(p, nb) {
        var l = Math.min(nb - 1, Math.max(0, Math.floor(L[p * 3] / 100 * nb))), a = Math.min(nb - 1, Math.max(0, Math.floor((L[p * 3 + 1] + 40) / 80 * nb))),
            b = Math.min(nb - 1, Math.max(0, Math.floor((L[p * 3 + 2] + 40) / 80 * nb)));
        return (l * nb + a) * nb + b;
      }
      var HF = new Float32Array(4096), HB = new Float32Array(4096), CF = new Float32Array(512), CB = new Float32Array(512), nf = 0, nb2 = 0;
      var hasRemove = false; for (p = 0; p < n; p++) if (lbl[p] === 2) { hasRemove = true; break; }
      for (p = 0; p < n; p++) {
        var x = p % w, y = (p - x) / w, border = x < 2 || y < 2 || x >= w - 2 || y >= h - 2;
        if (lbl[p] === 1) { HF[bin(p, 16)]++; CF[bin(p, 8)]++; nf++; }
        else if (lbl[p] === 2 || (!hasRemove && border)) { HB[bin(p, 16)]++; CB[bin(p, 8)]++; nb2++; }
      }
      if (!nf) { self.postMessage({ error: "no-keep" }); return; }
      function cost(H, Cc, tot, p) { var pr = 0.6 * H[bin(p, 16)] / tot + 0.4 * Cc[bin(p, 8)] / (tot * 8) + 1e-4; return -Math.log(pr); }
      // smoothness: lambda * exp(-beta * |dLab|^2) / distance
      var DX = [-1, 0, 1, -1, 1, -1, 0, 1], DY = [-1, -1, -1, 0, 0, 1, 1, 1], sum = 0, cnt = 0;
      for (p = 0; p < n; p++) { var xx = p % w; if (xx < w - 1) { var q = p + 1, dl = L[p * 3] - L[q * 3], da = L[p * 3 + 1] - L[q * 3 + 1], db = L[p * 3 + 2] - L[q * 3 + 2]; sum += dl * dl + da * da + db * db; cnt++; } }
      var beta = 1 / (2 * Math.max(1e-3, sum / Math.max(1, cnt))), lambda = 50, SCALE = 100, HARD = 1e8;
      var cap = new Int32Array(n * 8), tr = new Int32Array(n);
      for (p = 0; p < n; p++) {
        var px = p % w, py = (p - px) / w;
        for (k = 0; k < 8; k++) {
          var qx = px + DX[k], qy = py + DY[k]; if (qx < 0 || qy < 0 || qx >= w || qy >= h) continue;
          var qq = qy * w + qx, e1 = L[p * 3] - L[qq * 3], e2 = L[p * 3 + 1] - L[qq * 3 + 1], e3 = L[p * 3 + 2] - L[qq * 3 + 2];
          cap[p * 8 + k] = Math.round(SCALE * lambda * Math.exp(-beta * (e1 * e1 + e2 * e2 + e3 * e3)) / (DX[k] && DY[k] ? Math.SQRT2 : 1));
        }
        var toS, toT;
        if (lbl[p] === 1) { toS = HARD; toT = 0; }
        else if (lbl[p] === 2) { toS = 0; toT = HARD; }
        else { toS = nb2 ? cost(HB, CB, nb2, p) : 3; toT = cost(HF, CF, nf, p); toS = Math.round(toS * SCALE); toT = Math.round(toT * SCALE); }
        tr[p] = toS - toT;
      }
      var res = maxflow(w, h, cap, tr), out = new Uint8Array(n);
      for (p = 0; p < n; p++) out[p] = res.tree[p] === 1 ? 255 : 0;
      self.postMessage({ mask: out, w: w, h: h }, [out.buffer]);
    };
  }
  var worker = null, workerBusy = null;
  function getWorker() {
    if (worker) return worker;
    var src = "(" + smartWorker.toString() + ")();", url = URL.createObjectURL(new Blob([src], { type: "text/javascript" }));
    worker = new Worker(url); URL.revokeObjectURL(url);
    return worker;
  }
  // rgba: grid picture, labels: 0 unknown, 1 keep, 2 remove. Resolves with a Uint8Array mask (255 = keep) on the grid.
  function smartSolve(rgba, labels, w, h) {
    return new Promise(function (ok, fail) {
      var wk;
      try { wk = getWorker(); } catch (e) { fail(e); return; }
      if (workerBusy) workerBusy(new Error("replaced"));
      workerBusy = fail;
      wk.onmessage = function (e) { workerBusy = null; if (e.data.error) fail(new Error(e.data.error)); else ok(e.data.mask); };
      wk.onerror = function (e) { workerBusy = null; fail(e); };
      var cp = new Uint8ClampedArray(rgba), lb = new Uint8Array(labels);
      wk.postMessage({ rgba: cp, labels: lb, w: w, h: h }, [cp.buffer, lb.buffer]);
    });
  }

  // ---------- AI remove (U2-Netp, Apache-2.0, self-hosted; ONNX Runtime Web, MIT, pinned on jsDelivr) ----------
  var ORT_VER = "1.31.1", ORT_BASE = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.31.1/dist/", MODEL_URL = "models/u2netp.onnx", MODEL_BYTES = 4574861;
  var aiSession = null, aiLoading = null;
  function loadScript(url) {
    return new Promise(function (ok, fail) {
      var s = document.createElement("script"); s.src = url; s.async = true; s.crossOrigin = "anonymous";
      s.onload = function () { ok(); }; s.onerror = function () { fail(new Error("script " + url)); };
      document.head.appendChild(s);
    });
  }
  // The model file comes from this site; it is kept in the browser's cache storage so the next use works offline.
  function fetchModel(progress) {
    function read(resp) {
      if (!resp.ok) throw new Error("model " + resp.status);
      var total = +resp.headers.get("content-length") || MODEL_BYTES;
      if (!resp.body || !resp.body.getReader) return resp.arrayBuffer();
      var rd = resp.body.getReader(), parts = [], got = 0;
      return (function pump() {
        return rd.read().then(function (r) {
          if (r.done) { var out = new Uint8Array(got), o = 0; parts.forEach(function (p) { out.set(p, o); o += p.length; }); return out.buffer; }
          parts.push(r.value); got += r.value.length; progress(Math.min(1, got / total)); return pump();
        });
      }());
    }
    var cacheP = window.caches ? caches.open("tg-token-models-v1").catch(function () { return null; }) : Promise.resolve(null);
    return cacheP.then(function (cache) {
      return (cache ? cache.match(MODEL_URL) : Promise.resolve(null)).then(function (hit) {
        if (hit) { progress(1); return hit.arrayBuffer(); }
        return fetch(MODEL_URL).then(function (resp) {
          var copy = cache ? resp.clone() : null;
          return read(resp).then(function (buf) { if (cache && copy) cache.put(MODEL_URL, copy).catch(function () { /* caching is optional */ }); return buf; });
        });
      });
    });
  }
  function aiLoad(progress) {
    if (aiSession) return Promise.resolve(aiSession);
    if (aiLoading) return aiLoading;
    progress = progress || function () {};
    aiLoading = (window.ort ? Promise.resolve() : loadScript(ORT_BASE + "ort.wasm.min.js")).then(function () {
      var ort = window.ort; if (!ort) throw new Error("runtime");
      ort.env.wasm.wasmPaths = ORT_BASE; ort.env.wasm.numThreads = 1;
      progress(0.02, "model");
      return fetchModel(function (f) { progress(0.02 + f * 0.78, "model"); }).then(function (buf) {
        progress(0.82, "runtime");
        return ort.InferenceSession.create(buf, { executionProviders: ["wasm"], graphOptimizationLevel: "all" });
      });
    }).then(function (s) { aiSession = s; aiLoading = null; progress(0.95, "ready"); return s; }, function (e) { aiLoading = null; throw e; });
    return aiLoading;
  }
  // Runs U2-Netp on a 320 x 320 copy of the picture. Resolves with a Float32Array mask (0..1) at 320 x 320.
  function aiMask(srcCanvas) {
    return aiLoad().then(function (session) {
      var S = 320, c = document.createElement("canvas"); c.width = c.height = S;
      var g = c.getContext("2d", { willReadFrequently: true }); g.drawImage(srcCanvas, 0, 0, S, S);
      var D = g.getImageData(0, 0, S, S).data, mx = 1, i;
      for (i = 0; i < S * S; i++) mx = Math.max(mx, D[i * 4], D[i * 4 + 1], D[i * 4 + 2]);
      var mean = [0.485, 0.456, 0.406], std = [0.229, 0.224, 0.225], inp = new Float32Array(3 * S * S);
      for (i = 0; i < S * S; i++) for (var ch = 0; ch < 3; ch++) inp[ch * S * S + i] = (D[i * 4 + ch] / mx - mean[ch]) / std[ch];
      var feeds = {}; feeds[session.inputNames[0]] = new window.ort.Tensor("float32", inp, [1, 3, S, S]);
      return session.run(feeds).then(function (res) {
        var o = res[session.outputNames[0]].data, lo = 1e9, hi = -1e9, out = new Float32Array(S * S);
        for (i = 0; i < S * S; i++) { if (o[i] < lo) lo = o[i]; if (o[i] > hi) hi = o[i]; }
        for (i = 0; i < S * S; i++) out[i] = (o[i] - lo) / Math.max(1e-6, hi - lo);
        return out;
      });
    });
  }

  TG.bg = {
    labOf: labOf, toLab: toLab, gradient: gradient, cluster: cluster, keyFlood: keyFlood, cleanup: cleanup, despill: despill,
    guided: guided, boxMean: boxMean, refineAlpha: refineAlpha, lumOf: lumOf, smartSolve: smartSolve, aiLoad: aiLoad, aiMask: aiMask,
    loadScript: loadScript, ORT_VER: ORT_VER, MODEL_URL: MODEL_URL, MODEL_BYTES: MODEL_BYTES
  };
}());
