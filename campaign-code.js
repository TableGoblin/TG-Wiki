// Decodes a Table Goblin campaign code (format version 1) in the browser. The same format as campaign_code.py; tests/test_campaign_code.py pins both to the
// same examples. Needs a secure page (https or localhost) for crypto.subtle.
//
//   TGCampaignCode.decode("TG-BC3Y5-V95G5-0Y860").then(function (c) { c.rules.free_archetype; c.allowUncommon; c.levelCap; c.exceptionHashes; });
//
// Rejects with an Error whose message is ready to show the player. exceptionHashes are hashes of lowercased ancestry names (TGCampaignCode.nameHash).
(function () {
  "use strict";
  var RULES_V1 = ["free_archetype", "ancestry_paragon", "dual_class", "skill_paragon", "fa_dedication_gate", "relaxed_mounting", "boosted_reroll", "recall_to_gm", "recall_as_gm"];
  var RULES_V2 = RULES_V1.concat(["automatic_bonus_progression", "gradual_ability_boosts"]);
  var ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  var enc = new TextEncoder();

  function sha(bytes) { return crypto.subtle.digest("SHA-256", bytes).then(function (b) { return new Uint8Array(b); }); }
  function concat(parts) { var n = 0; parts.forEach(function (p) { n += p.length; }); var out = new Uint8Array(n), o = 0; parts.forEach(function (p) { out.set(p, o); o += p.length; }); return out; }

  function stream(nonce, length) {
    var blocks = [], need = Math.ceil(length / 32), i;
    for (i = 0; i < need; i++) blocks.push(sha(concat([enc.encode("tg-rules"), nonce, new Uint8Array([i])])));
    return Promise.all(blocks).then(function (parts) { return concat(parts).slice(0, length); });
  }

  function unb32(text) {
    var n = 0n, i;
    for (i = 0; i < text.length; i++) n = (n << 5n) | BigInt(ALPHABET.indexOf(text[i]));
    var bits = text.length * 5, size = Math.floor(bits / 8);
    if ((n & ((1n << BigInt(bits % 8)) - 1n)) !== 0n) return null;      // unused bits must be zero, as in the Python encoder
    n >>= BigInt(bits % 8);
    var out = new Uint8Array(size);
    for (i = size - 1; i >= 0; i--) { out[i] = Number(n & 255n); n >>= 8n; }
    return out;
  }

  function nameHash(name) {
    return sha(enc.encode(String(name).trim().toLowerCase())).then(function (h) { return ((h[0] << 8) | h[1]) & 0xFFF; });
  }

  function decode(code) {
    var text = String(code || "").toUpperCase().replace(/\s+/g, "").replace(/-/g, "");
    if (text.indexOf("TG") === 0) text = text.slice(2);
    text = text.replace(/O/g, "0").replace(/[IL]/g, "1");
    var bad = text.length < 12 || text.split("").some(function (c) { return ALPHABET.indexOf(c) < 0; });
    if (bad) return Promise.reject(new Error("That isn't a campaign code. Check it against the one pinned in your campaign's character channel."));
    var raw = unb32(text);
    if (!raw) return Promise.reject(new Error("That campaign code has a mistake in it (it doesn't check out). Copy it again from the pinned message."));
    var nonce = raw.slice(0, 3), scrambled = raw.slice(3, raw.length - 2), check = raw.slice(raw.length - 2);
    return stream(nonce, scrambled.length).then(function (ks) {
      var body = new Uint8Array(scrambled.length), i;
      for (i = 0; i < body.length; i++) body[i] = scrambled[i] ^ ks[i];
      return sha(concat([enc.encode("tg-chk"), nonce, body])).then(function (h) {
        if (h[0] !== check[0] || h[1] !== check[1]) throw new Error("That campaign code has a mistake in it (it doesn't check out). Copy it again from the pinned message.");
        var acc = 0n; for (i = 0; i < body.length; i++) acc = (acc << 8n) | BigInt(body[i]);
        var bits = body.length * 8;
        function take(n) { bits -= n; return Number((acc >> BigInt(bits)) & ((1n << BigInt(n)) - 1n)); }
        var version = take(4);
        if (version !== 1 && version !== 2) throw new Error("That campaign code is from a newer version of Table Goblin.");
        var rules = {}; RULES_V2.forEach(function (r) { rules[r] = false; });
        (version === 1 ? RULES_V1 : RULES_V2).forEach(function (r) { rules[r] = take(1) === 1; });
        var uncommon = take(1) === 1, rare = take(1) === 1, cap = take(5), count = take(6);
        if (bits < 12 * count) throw new Error("That campaign code is cut short.");
        var hashes = []; for (i = 0; i < count; i++) hashes.push(take(12));
        return { rules: rules, allowUncommon: uncommon, allowRare: rare, levelCap: cap || null, exceptionHashes: hashes };
      });
    });
  }

  window.TGCampaignCode = { decode: decode, nameHash: nameHash, rules: RULES_V2 };
}());
