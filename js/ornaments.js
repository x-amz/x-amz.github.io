/* Ornament generators for the x-amz.dev lab.
   Law: every mark must be evidently decodable data. Each generator takes real bytes
   and renders a form that can be read back — or, where lossy (rosette, seal),
   is recomputable from a printed seed and annotated with its derivation. */
(function (global) {
  'use strict';

  // ── OpenSSH randomart (drunken bishop), 17×9, standard charset ──
  function drunkenBishop(bytes, title) {
    var W = 17, H = 9;
    var f = new Array(W * H);
    for (var i = 0; i < f.length; i++) f[i] = 0;
    var x = 8, y = 4, sx = 8, sy = 4;
    for (var bi = 0; bi < bytes.length; bi++) {
      var v = bytes[bi];
      for (var st = 0; st < 4; st++) {
        x += (v & 1) ? 1 : -1;
        y += (v & 2) ? 1 : -1;
        x = Math.max(0, Math.min(W - 1, x));
        y = Math.max(0, Math.min(H - 1, y));
        f[y * W + x] = Math.min(f[y * W + x] + 1, 14);
        v >>= 2;
      }
    }
    var chars = ' .o+=*BOX@%&#/^';
    var label = title || '';
    var pad = W - label.length;
    var lpad = Math.max(1, Math.floor(pad / 2) - 1);
    var rpad = Math.max(1, W - label.length - lpad - 2);
    var top = '+' + repeat('-', lpad) + '[' + label + ']' + repeat('-', rpad) + '+';
    if (label === '') top = '+' + repeat('-', W) + '+';
    var lines = [top];
    for (var row = 0; row < H; row++) {
      var line = '|';
      for (var col = 0; col < W; col++) {
        if (col === sx && row === sy) line += 'S';
        else if (col === x && row === y) line += 'E';
        else line += chars[f[row * W + col]];
      }
      lines.push(line + '|');
    }
    lines.push('+' + repeat('-', W) + '+');
    return lines.join('\n');
  }

  // The same walk, as a connected path (for the seal device). Returns points on a WxH grid.
  function bishopPath(bytes) {
    var W = 17, H = 9;
    var x = 8, y = 4;
    var pts = [{ x: x, y: y }];
    for (var bi = 0; bi < bytes.length; bi++) {
      var v = bytes[bi];
      for (var st = 0; st < 4; st++) {
        x += (v & 1) ? 1 : -1;
        y += (v & 2) ? 1 : -1;
        x = Math.max(0, Math.min(W - 1, x));
        y = Math.max(0, Math.min(H - 1, y));
        pts.push({ x: x, y: y });
        v >>= 2;
      }
    }
    return { pts: pts, W: W, H: H };
  }

  // ── Base256: one braille glyph per byte (U+2800 + byte) ──
  function braille(bytes) {
    var out = '';
    for (var i = 0; i < bytes.length; i++) out += String.fromCodePoint(0x2800 + bytes[i]);
    return out;
  }

  // ── ICAO 9303 7-3-1 check digit ──
  function mrzCheck(str) {
    var sum = 0, weights = [7, 3, 1];
    for (var i = 0; i < str.length; i++) {
      var ch = str[i], v = 0;
      if (ch >= '0' && ch <= '9') v = ch.charCodeAt(0) - 48;
      else if (ch >= 'A' && ch <= 'Z') v = ch.charCodeAt(0) - 55;
      sum += v * weights[i % 3];
    }
    return String(sum % 10);
  }

  // Two 44-char MRZ lines over a hex payload; the final digit is a real check digit
  // computed over the full payload (uppercased hex).
  function mrzLines(prefix, hex) {
    var U = hex.toUpperCase();
    var head = prefix.toUpperCase().replace(/[^A-Z0-9<]/g, '<');
    var room1 = 44 - head.length;
    var line1 = head + U.slice(0, room1);
    var rest = U.slice(room1);
    var room2 = 43 - rest.length;
    var line2 = rest + repeat('<', Math.max(0, room2));
    return { line1: line1, line2: line2, check: mrzCheck(U) };
  }

  // ── Data-driven guilloché rosette ──
  // Derivation, printed on every use: ring i is a hypotrochoid with
  // r/R = 0.16 + 0.26·(b[3i]/255), d/R = 0.18 + 0.34·(b[3i+1]/255), phase = 2π·(b[3i+2]/255).
  function rosette(canvas, bytes, opts) {
    opts = opts || {};
    var rings = opts.rings || 5;
    var colA = opts.colA || 'rgba(201,162,39,0.42)';
    var colB = opts.colB || 'rgba(127,191,158,0.34)';
    var dpr = Math.min((global.devicePixelRatio || 1), 2);
    var w = canvas.clientWidth || opts.size || 180;
    var h = canvas.clientHeight || opts.size || 180;
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    var cx = w / 2, cy = h / 2, S = Math.min(w, h) / 2;
    ctx.lineWidth = 0.6;
    for (var ring = 0; ring < rings; ring++) {
      var b0 = bytes[(ring * 3) % bytes.length];
      var b1 = bytes[(ring * 3 + 1) % bytes.length];
      var b2 = bytes[(ring * 3 + 2) % bytes.length];
      var R = S * (0.94 - ring * (0.66 / rings));
      var r = R * (0.16 + (b0 / 255) * 0.26);
      var d = R * (0.18 + (b1 / 255) * 0.34);
      var rot = (b2 / 255) * Math.PI * 2;
      ctx.strokeStyle = (ring % 2 === 0) ? colA : colB;
      ctx.beginPath();
      for (var t = 0; t <= Math.PI * 24; t += 0.02) {
        var px = cx + (R - r) * Math.cos(t + rot) + d * Math.cos(((R - r) / r) * t + rot);
        var py = cy + (R - r) * Math.sin(t + rot) - d * Math.sin(((R - r) / r) * t + rot);
        if (t === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
  }

  // ── 8-level punched tape (teletype convention: sprocket track between bits 3 and 4) ──
  function tapeSVG(bytes, opts) {
    opts = opts || {};
    var cell = opts.cell || 13;
    var ink = opts.ink || '#E4E0D2';
    var dim = opts.dim || 'rgba(228,224,210,0.22)';
    var pad = cell;
    var rows = 9; // 8 data + 1 sprocket
    var wTotal = pad * 2 + bytes.length * cell;
    var hTotal = pad * 2 + rows * cell;
    var p = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + wTotal + ' ' + hTotal + '" width="' + wTotal + '" height="' + hTotal + '" role="img" aria-label="8-level punched tape">'];
    p.push('<rect x="0.5" y="0.5" width="' + (wTotal - 1) + '" height="' + (hTotal - 1) + '" fill="none" stroke="' + dim + '"/>');
    for (var i = 0; i < bytes.length; i++) {
      var x = pad + i * cell + cell / 2;
      var row = 0;
      // bits 7..4 above sprocket, sprocket, bits 3..0 below (MSB at top)
      for (var bit = 7; bit >= 0; bit--) {
        if (bit === 3) { // sprocket hole between tracks
          var ys = pad + row * cell + cell / 2;
          p.push('<circle cx="' + x + '" cy="' + ys + '" r="' + (cell * 0.13) + '" fill="' + ink + '"/>');
          row++;
        }
        var y = pad + row * cell + cell / 2;
        var on = (bytes[i] >> bit) & 1;
        if (on) p.push('<circle cx="' + x + '" cy="' + y + '" r="' + (cell * 0.30) + '" fill="' + ink + '"/>');
        else p.push('<circle cx="' + x + '" cy="' + y + '" r="' + (cell * 0.30) + '" fill="none" stroke="' + dim + '" stroke-width="0.75"/>');
        row++;
      }
    }
    p.push('</svg>');
    return p.join('');
  }

  // ── NDEF URI record (type "U", well-known prefix compression) ──
  var NDEF_PREFIXES = ['', 'http://www.', 'https://www.', 'http://', 'https://'];
  function ndefUri(url) {
    var code = 0, rest = url;
    for (var i = NDEF_PREFIXES.length - 1; i >= 1; i--) {
      if (url.indexOf(NDEF_PREFIXES[i]) === 0) { code = i; rest = url.slice(NDEF_PREFIXES[i].length); break; }
    }
    var payload = [code];
    for (i = 0; i < rest.length; i++) payload.push(rest.charCodeAt(i) & 0x7F);
    // Short record: MB|ME|SR, TNF=0x01 (well-known) → 0xD1; type length 1; payload length; type 'U'
    var bytes = [0xD1, 0x01, payload.length, 0x55].concat(payload);
    return { bytes: bytes, prefixCode: code, prefix: NDEF_PREFIXES[code], rest: rest };
  }

  // ── Constellation from fingerprint bytes: star i at (b[2i], b[2i+1]) ──
  function constellationSVG(bytes, opts) {
    opts = opts || {};
    var size = opts.size || 220;
    var ink = opts.ink || '#E4E0D2';
    var faint = opts.faint || 'rgba(228,224,210,0.18)';
    var accent = opts.accent || '#C9A227';
    var pad = 14;
    var n = Math.floor(bytes.length / 2);
    var pts = [];
    for (var i = 0; i < n; i++) {
      pts.push({
        x: pad + (bytes[2 * i] / 255) * (size - 2 * pad),
        y: pad + (bytes[2 * i + 1] / 255) * (size - 2 * pad)
      });
    }
    var p = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '" role="img" aria-label="Constellation plot of fingerprint bytes">'];
    p.push('<rect x="0.5" y="0.5" width="' + (size - 1) + '" height="' + (size - 1) + '" fill="none" stroke="' + faint + '"/>');
    var path = '';
    for (i = 0; i < pts.length; i++) path += (i === 0 ? 'M' : 'L') + pts[i].x.toFixed(1) + ' ' + pts[i].y.toFixed(1);
    p.push('<path d="' + path + '" fill="none" stroke="' + faint + '" stroke-width="0.75"/>');
    for (i = 0; i < pts.length; i++) {
      var first = i === 0, last = i === pts.length - 1;
      p.push('<circle cx="' + pts[i].x.toFixed(1) + '" cy="' + pts[i].y.toFixed(1) + '" r="' + (first || last ? 3 : 1.8) + '" fill="' + (first || last ? accent : ink) + '"/>');
    }
    p.push('</svg>');
    return p.join('');
  }

  // ── Engraved seal: annular guilloché border + the bishop walk as the center device ──
  function seal(canvas, bytes, opts) {
    opts = opts || {};
    var dpr = Math.min((global.devicePixelRatio || 1), 2);
    var size = opts.size || 220;
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    var cx = size / 2, cy = size / 2, S = size / 2 - 4;
    var ink = opts.ink || '#C9A227';
    var lo = opts.lo || 'rgba(201,162,39,0.35)';
    var hi = opts.hi || 'rgba(228,224,210,0.25)';

    // Border: two hypotrochoid rings clipped to an annulus, params from bytes 0..5
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, S, 0, Math.PI * 2);
    ctx.arc(cx, cy, S * 0.72, 0, Math.PI * 2, true);
    ctx.clip();
    for (var ring = 0; ring < 2; ring++) {
      var b0 = bytes[ring * 3], b1 = bytes[ring * 3 + 1], b2 = bytes[ring * 3 + 2];
      var R = S * 0.97;
      var r = R * (0.10 + (b0 / 255) * 0.14);
      var d = R * (0.10 + (b1 / 255) * 0.18);
      var rot = (b2 / 255) * Math.PI * 2;
      ctx.strokeStyle = lo;
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      for (var t = 0; t <= Math.PI * 26; t += 0.02) {
        var px = cx + (R - r) * Math.cos(t + rot) + d * Math.cos(((R - r) / r) * t + rot);
        var py = cy + (R - r) * Math.sin(t + rot) - d * Math.sin(((R - r) / r) * t + rot);
        if (t === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    ctx.restore();

    // Rim circles
    ctx.strokeStyle = ink; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, S, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.arc(cx, cy, S * 0.72, 0, Math.PI * 2); ctx.stroke();

    // Device: the drunken-bishop walk, engraved (offset highlight + main stroke)
    var walk = bishopPath(bytes);
    var box = S * 0.72 * 1.28; // inscribe the 17×9 grid
    var gw = box, gh = box * (walk.H / walk.W);
    var x0 = cx - gw / 2, y0 = cy - gh / 2;
    function gx(p) { return x0 + (p.x / (walk.W - 1)) * gw; }
    function gy(p) { return y0 + (p.y / (walk.H - 1)) * gh; }
    for (var pass = 0; pass < 2; pass++) {
      ctx.strokeStyle = pass === 0 ? hi : ink;
      ctx.lineWidth = pass === 0 ? 1.4 : 0.8;
      var off = pass === 0 ? 0.7 : 0;
      ctx.beginPath();
      for (var i = 0; i < walk.pts.length; i++) {
        var px2 = gx(walk.pts[i]) + off, py2 = gy(walk.pts[i]) + off;
        if (i === 0) ctx.moveTo(px2, py2); else ctx.lineTo(px2, py2);
      }
      ctx.stroke();
    }
    var s0 = walk.pts[0], sN = walk.pts[walk.pts.length - 1];
    ctx.fillStyle = ink;
    ctx.beginPath(); ctx.arc(gx(s0), gy(s0), 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(gx(sN), gy(sN), 2.2, 0, Math.PI * 2); ctx.fill();
  }

  function repeat(s, n) { return new Array(Math.max(0, n) + 1).join(s); }

  function bytesToHex(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i++) s += (bytes[i] < 16 ? '0' : '') + bytes[i].toString(16);
    return s;
  }

  var api = {
    drunkenBishop: drunkenBishop,
    bishopPath: bishopPath,
    braille: braille,
    mrzCheck: mrzCheck,
    mrzLines: mrzLines,
    rosette: rosette,
    tapeSVG: tapeSVG,
    ndefUri: ndefUri,
    constellationSVG: constellationSVG,
    seal: seal,
    bytesToHex: bytesToHex
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.Ornaments = api;
})(this);
