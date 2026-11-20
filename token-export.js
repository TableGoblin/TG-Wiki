/* Table Goblin token creator: files the tool writes. A store-only ZIP for batch downloads, the animated APNG (UPNG.js with pako, both
   MIT, pinned on jsDelivr and loaded only when asked for) and the GIF fallback (gifenc, MIT, pinned on jsDelivr). Everything is made in
   this browser and handed to the browser's own download. */
(function () {
  "use strict";
  var TG = window.TGTok = window.TGTok || {};

  // ---------- CRC-32 and a store-only ZIP ----------
  var CRC = (function () { var t = new Uint32Array(256); for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; }());
  function crc32(u8) { var c = 0xFFFFFFFF; for (var i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  // files: [{ name, data: Uint8Array }]. PNGs are already compressed, so entries are stored as they are (method 0).
  function zip(files) {
    var enc = new TextEncoder(), local = [], central = [], off = 0, now = new Date();
    var dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1), dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
    files.forEach(function (f) {
      var name = enc.encode(f.name), crc = crc32(f.data), size = f.data.length;
      var h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
      h.setUint16(10, dosTime, true); h.setUint16(12, dosDate, true); h.setUint32(14, crc, true); h.setUint32(18, size, true); h.setUint32(22, size, true);
      h.setUint16(26, name.length, true); h.setUint16(28, 0, true);
      local.push(new Uint8Array(h.buffer), name, f.data);
      var c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
      c.setUint16(12, dosTime, true); c.setUint16(14, dosDate, true); c.setUint32(16, crc, true); c.setUint32(20, size, true); c.setUint32(24, size, true);
      c.setUint16(28, name.length, true); c.setUint16(30, 0, true); c.setUint16(32, 0, true); c.setUint16(34, 0, true); c.setUint16(36, 0, true);
      c.setUint32(38, 0, true); c.setUint32(42, off, true);
      central.push(new Uint8Array(c.buffer), name);
      off += 30 + name.length + size;
    });
    var cdSize = central.reduce(function (s, a) { return s + a.length; }, 0), e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, cdSize, true); e.setUint32(16, off, true);
    var parts = local.concat(central, [new Uint8Array(e.buffer)]), total = parts.reduce(function (s, a) { return s + a.length; }, 0), out = new Uint8Array(total), o = 0;
    parts.forEach(function (a) { out.set(a, o); o += a.length; });
    return out;
  }

  function download(blob, name) {
    var url = URL.createObjectURL(blob), a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }
  function canvasBytes(c, type, q) {
    return new Promise(function (ok, fail) {
      if (!c.toBlob) { try { var d = c.toDataURL(type, q), b = atob(d.split(",")[1]), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); ok(u); } catch (e) { fail(e); } return; }
      c.toBlob(function (b) { if (!b) { fail(new Error("empty")); return; } b.arrayBuffer().then(function (ab) { ok(new Uint8Array(ab)); }, fail); }, type, q);
    });
  }
  var webpOk = null;
  function supportsWebp() {
    if (webpOk === null) { try { var c = document.createElement("canvas"); c.width = c.height = 2; webpOk = c.toDataURL("image/webp").indexOf("data:image/webp") === 0; } catch (e) { webpOk = false; } }
    return webpOk;
  }

  // ---------- animated exports ----------
  var LIBS = {
    pako: "https://cdn.jsdelivr.net/npm/pako@1.0.11/dist/pako.min.js",
    upng: "https://cdn.jsdelivr.net/npm/upng-js@2.1.0/UPNG.js",
    gifenc: "https://cdn.jsdelivr.net/npm/gifenc@1.0.3/dist/gifenc.esm.js"
  };
  var upngP = null, gifP = null;
  function loadUpng() {
    if (window.UPNG && window.pako) return Promise.resolve(window.UPNG);
    if (!upngP) upngP = (window.pako ? Promise.resolve() : TG.bg.loadScript(LIBS.pako)).then(function () { return window.UPNG ? null : TG.bg.loadScript(LIBS.upng); })
      .then(function () { if (!window.UPNG) throw new Error("UPNG"); return window.UPNG; }, function (e) { upngP = null; throw e; });
    return upngP;
  }
  function loadGifenc() {
    // gifenc ships as an ES module; the dynamic import loads it from the pinned CDN path only when a GIF is asked for
    if (!gifP) gifP = import(LIBS.gifenc).catch(function (e) { gifP = null; throw e; });
    return gifP;
  }
  // frames: [ImageData], delay in ms. APNG keeps soft, see-through edges.
  function apng(frames, w, h, delay) {
    return loadUpng().then(function (UPNG) {
      var bufs = frames.map(function (f) { return f.data.buffer.slice(0); }), dels = frames.map(function () { return delay; });
      return new Uint8Array(UPNG.encode(bufs, w, h, 0, dels));
    });
  }
  // GIF: one see-through color, so edges are hard (pixels are either fully shown or fully clear).
  function gif(frames, w, h, delay) {
    return loadGifenc().then(function (G) {
      var enc = G.GIFEncoder();
      frames.forEach(function (f, i) {
        var pal = G.quantize(f.data, 256, { format: "rgba4444", oneBitAlpha: true }), idx = G.applyPalette(f.data, pal, "rgba4444"), ti = -1;
        for (var k = 0; k < pal.length; k++) if (pal[k][3] === 0) { ti = k; break; }
        var opt = { palette: pal, delay: delay, repeat: 0 };
        if (ti >= 0) { opt.transparent = true; opt.transparentIndex = ti; opt.dispose = 2; }
        enc.writeFrame(idx, w, h, opt);
      });
      enc.finish();
      return enc.bytes();
    });
  }
  TG.exporter = { crc32: crc32, zip: zip, download: download, canvasBytes: canvasBytes, supportsWebp: supportsWebp, apng: apng, gif: gif, LIBS: LIBS, loadUpng: loadUpng, loadGifenc: loadGifenc };
}());
