/* Account-ID ring rosettes.
   Keyspace: a 12-digit AWS account ID is a 40-bit integer. Encoded base32 (RFC 4648)
   it is exactly 8 characters. Four rings each consume 10 of the 40 bits:
     bits 9..6 → lobe count n = 6 + v      (6..21 — integer, so the curve always closes)
     bits 5..3 → depth = 0.05 + v/7 · 0.09 (radial modulation ≤ 14% — always reads as a ring)
     bits 2..0 → phase = v/8 · 2π/n
   An access key ID encodes its account ID (base32-decode the 16 chars after the
   4-char prefix; first 6 bytes → z; account = ⌊z/128⌋ mod 2^40 — the documented
   extraction). Same account → identical four rings; the key's leftover bits draw
   one extra outer ring. Family resemblance is therefore structural, not styled. */
(function (global) {
  'use strict';

  var B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

  function base32Encode(bytes) {
    var out = '', buf = 0, bits = 0;
    for (var i = 0; i < bytes.length; i++) {
      buf = buf * 256 + bytes[i]; bits += 8;
      while (bits >= 5) {
        var shift = bits - 5;
        var v = Math.floor(buf / Math.pow(2, shift)) % 32;
        out += B32[v]; bits -= 5;
        buf = buf % Math.pow(2, shift);
      }
    }
    if (bits > 0) out += B32[Math.floor(buf * Math.pow(2, 5 - bits)) % 32];
    return out;
  }

  function base32Decode(str) {
    var bytes = [], buf = 0, bits = 0;
    for (var i = 0; i < str.length; i++) {
      var v = B32.indexOf(str[i].toUpperCase());
      if (v < 0) throw new Error('base32: bad char "' + str[i] + '"');
      buf = buf * 32 + v; bits += 5;
      if (bits >= 8) {
        var shift = bits - 8;
        bytes.push(Math.floor(buf / Math.pow(2, shift)) % 256);
        bits -= 8;
        buf = buf % Math.pow(2, shift);
      }
    }
    return bytes;
  }

  var POW40 = Math.pow(2, 40);

  function accountInfo(accountId) {
    var n = typeof accountId === 'string' ? parseInt(accountId, 10) : accountId;
    if (!isFinite(n) || n < 0 || n >= POW40) throw new Error('account id must be a 12-digit number (< 2^40)');
    var bytes = [];
    var t = n;
    for (var i = 4; i >= 0; i--) { bytes[i] = t % 256; t = Math.floor(t / 256); }
    return { account: n, bytes: bytes, base32: base32Encode(bytes), hex: bytes.map(h2).join('') };
  }

  function h2(b) { return (b < 16 ? '0' : '') + b.toString(16); }

  // Documented extraction: account id from an access key id.
  function akidToAccount(akid) {
    var body = akid.trim();
    if (body.length < 20) throw new Error('access key id: expected 20 chars (prefix + 16)');
    var prefix = body.slice(0, 4);
    var b = base32Decode(body.slice(4, 20)); // 16 chars → 10 bytes
    var z = 0;
    for (var i = 0; i < 6; i++) z = z * 256 + b[i];
    var account = Math.floor(z / 128) % POW40;
    return {
      prefix: prefix,
      account: account,
      accountStr: String(account).padStart(12, '0'),
      low7: z % 128,
      tail: b.slice(6),
      bytes: b
    };
  }

  // Deterministic synthetic AKID for demos (labeled as synthetic wherever shown).
  function synthAkid(accountId, variant) {
    var n = typeof accountId === 'string' ? parseInt(accountId, 10) : accountId;
    var low7 = (variant * 53 + 11) % 128;
    var z = n * 128 + low7;
    var b = [];
    var t = z;
    for (var i = 5; i >= 0; i--) { b[i] = t % 256; t = Math.floor(t / 256); }
    var seed = variant * 2654435761 % 4294967296;
    for (i = 0; i < 4; i++) {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      b.push(Math.floor(seed / 65536) % 256);
    }
    return 'AKIA' + base32Encode(b);
  }

  function fieldBits(n40, hi, count) {
    // take `count` bits ending at bit position hi (bit 39 = MSB)
    return Math.floor(n40 / Math.pow(2, hi - count + 1)) % Math.pow(2, count);
  }

  function accountRingSpecs(account) {
    var specs = [];
    for (var ring = 0; ring < 4; ring++) {
      var hi = 39 - ring * 10;
      var nv = fieldBits(account, hi, 4);
      var dv = fieldBits(account, hi - 4, 3);
      var pv = fieldBits(account, hi - 7, 3);
      var n = 6 + nv;
      specs.push({
        n: n,
        depth: 0.05 + (dv / 7) * 0.09,
        phase: (pv / 8) * (2 * Math.PI / n)
      });
    }
    return specs;
  }

  function keyRingSpec(low7, tail) {
    // one outer ring from the key's own bits: 7 low bits + first tail byte
    var v = low7 * 256 + (tail && tail.length ? tail[0] : 0); // 15 bits
    var n = 6 + (v % 16);
    return {
      n: n,
      depth: 0.05 + ((Math.floor(v / 16) % 8) / 7) * 0.09,
      phase: ((Math.floor(v / 128) % 8) / 8) * (2 * Math.PI / n),
      keyRing: true
    };
  }

  function drawRings(canvas, specs, opts) {
    opts = opts || {};
    var dpr = Math.min((global.devicePixelRatio || 1), 2);
    var size = opts.size || canvas.clientWidth || 200;
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    var cx = size / 2, cy = size / 2, S = size / 2 - 3;
    var colA = opts.colA || 'rgba(201,162,39,0.85)';
    var colB = opts.colB || 'rgba(127,191,158,0.75)';
    var colKey = opts.colKey || 'rgba(228,224,210,0.8)';
    // Account rings sit at fixed stations so families align visually;
    // a key ring, if present, is always the dashed outermost.
    var stations = [0.80, 0.635, 0.47, 0.305];
    var ai = 0;
    for (var r = 0; r < specs.length; r++) {
      var spec = specs[r];
      var R = S * (spec.keyRing ? 0.97 : stations[ai++ % stations.length]);
      var col = spec.keyRing ? colKey : (r % 2 === 0 ? colA : colB);
      for (var pass = 0; pass < 2; pass++) {
        ctx.strokeStyle = col;
        ctx.lineWidth = spec.keyRing ? 0.6 : 0.75;
        if (spec.keyRing && ctx.setLineDash) ctx.setLineDash([3, 2.2]);
        else if (ctx.setLineDash) ctx.setLineDash([]);
        var Rp = R + (pass === 0 ? 0 : -2.6);
        ctx.beginPath();
        for (var t = 0; t <= Math.PI * 2 + 0.02; t += 0.008) {
          var rr = Rp * (1 + spec.depth * Math.cos(spec.n * t + spec.phase));
          var px = cx + rr * Math.cos(t);
          var py = cy + rr * Math.sin(t);
          if (t === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
    }
    if (ctx.setLineDash) ctx.setLineDash([]);
  }

  function accountRosette(canvas, accountId, opts) {
    var info = accountInfo(accountId);
    drawRings(canvas, accountRingSpecs(info.account), opts);
    return info;
  }

  function akidRosette(canvas, akid, opts) {
    var x = akidToAccount(akid);
    var specs = accountRingSpecs(x.account).concat([keyRingSpec(x.low7, x.tail)]);
    drawRings(canvas, specs, opts);
    return x;
  }

  /* ── v2: woven bands ──
     Same 10-bit fields per band (resemblance is unchanged), but each band is a
     MIRRORED STRAND PAIR — r = R(1 ± d·cos(nθ+φ)) — which crosses itself 2n times,
     plus a fainter echo pair at n+3, half depth. Four bands interlace into a
     guilloché weave instead of concentric rings. The key's bits are placed by
     algorithm: 'outer' (dashed band outside), 'inner' (tight band around the
     printed prefix), or 'thread' (a single strand woven through all four bands). */

  function wovenBand(ctx, cx, cy, R, spec, colMain, colEcho, dash) {
    for (var variant = 0; variant < 2; variant++) {
      var n = variant === 0 ? spec.n : spec.n + 3;
      var d = variant === 0 ? spec.depth : spec.depth * 0.5;
      var col = variant === 0 ? colMain : colEcho;
      for (var sign = -1; sign <= 1; sign += 2) {
        ctx.strokeStyle = col;
        ctx.lineWidth = variant === 0 ? 0.75 : 0.55;
        if (ctx.setLineDash) ctx.setLineDash(dash || []);
        ctx.beginPath();
        for (var t = 0; t <= Math.PI * 2 + 0.02; t += 0.008) {
          var rr = R * (1 + sign * d * Math.cos(n * t + spec.phase));
          var px = cx + rr * Math.cos(t);
          var py = cy + rr * Math.sin(t);
          if (t === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
    }
    if (ctx.setLineDash) ctx.setLineDash([]);
  }

  function drawWoven(canvas, account, key, opts) {
    opts = opts || {};
    var mode = opts.keyMode || 'outer';
    var dpr = Math.min((global.devicePixelRatio || 1), 2);
    var size = opts.size || canvas.clientWidth || 200;
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    var cx = size / 2, cy = size / 2, S = size / 2 - 3;

    var colA = opts.colA || 'rgba(201,162,39,0.8)';
    var colB = opts.colB || 'rgba(127,191,158,0.7)';
    var echoA = opts.echoA || 'rgba(201,162,39,0.28)';
    var echoB = opts.echoB || 'rgba(127,191,158,0.24)';
    var colKey = opts.colKey || 'rgba(228,224,210,0.75)';
    var echoKey = opts.echoKey || 'rgba(228,224,210,0.22)';

    var specs = accountRingSpecs(account);
    var stations = [0.84, 0.66, 0.48, 0.30];
    for (var i = 0; i < 4; i++) {
      wovenBand(ctx, cx, cy, S * stations[i], specs[i],
        i % 2 === 0 ? colA : colB, i % 2 === 0 ? echoA : echoB, null);
    }

    if (key) {
      var kspec = keyRingSpec(key.low7, key.tail);
      if (mode === 'outer') {
        wovenBand(ctx, cx, cy, S * 0.955, kspec, colKey, echoKey, [3, 2.4]);
      } else if (mode === 'inner') {
        wovenBand(ctx, cx, cy, S * 0.175, kspec, colKey, echoKey, [2.4, 2]);
      } else if (mode === 'thread') {
        // one strand woven radially through all four account bands
        var v = key.low7 * 256 + (key.tail && key.tail.length ? key.tail[0] : 0);
        var m = 2 + (v % 4);                      // 2..5 radial sweeps
        var psi = ((Math.floor(v / 4) % 64) / 64) * Math.PI * 2;
        for (var pass = 0; pass < 2; pass++) {
          ctx.strokeStyle = pass === 0 ? echoKey : colKey;
          ctx.lineWidth = pass === 0 ? 1.5 : 0.7;
          ctx.beginPath();
          for (var t = 0; t <= Math.PI * 2 + 0.02; t += 0.006) {
            var c = 0.57, a = 0.305;
            var rr = S * (c + a * Math.cos(m * t + psi));
            var px = cx + rr * Math.cos(t);
            var py = cy + rr * Math.sin(t);
            if (t === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
          }
          ctx.stroke();
        }
      }
    }

    if (opts.prefix) {
      var fpx = Math.max(10, Math.round(size * 0.062));
      ctx.font = '700 ' + fpx + 'px "B612 Mono", monospace';
      ctx.fillStyle = opts.prefixColor || 'rgba(201,162,39,0.95)';
      ctx.textBaseline = 'middle';
      var track = fpx * 0.28;
      var chars = String(opts.prefix).split('');
      var widths = chars.map(function (ch) { return ctx.measureText(ch).width; });
      var total = widths.reduce(function (a, b) { return a + b; }, 0) + track * (chars.length - 1);
      var x = cx - total / 2;
      for (var ci = 0; ci < chars.length; ci++) {
        ctx.fillText(chars[ci], x, cy + fpx * 0.05);
        x += widths[ci] + track;
      }
    }
  }

  function wovenAccount(canvas, accountId, opts) {
    var info = accountInfo(accountId);
    drawWoven(canvas, info.account, null, opts);
    return info;
  }

  function wovenAkid(canvas, akid, opts) {
    var x = akidToAccount(akid);
    var o = opts || {};
    if (o.prefix === undefined) o.prefix = x.prefix;
    drawWoven(canvas, x.account, x, o);
    return x;
  }

  var api = {
    base32Encode: base32Encode,
    base32Decode: base32Decode,
    accountInfo: accountInfo,
    akidToAccount: akidToAccount,
    synthAkid: synthAkid,
    accountRingSpecs: accountRingSpecs,
    keyRingSpec: keyRingSpec,
    drawRings: drawRings,
    accountRosette: accountRosette,
    akidRosette: akidRosette,
    drawWoven: drawWoven,
    wovenAccount: wovenAccount,
    wovenAkid: wovenAkid
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.Rings = api;
})(this);
