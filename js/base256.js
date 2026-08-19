/* Base256 — the byte↔Braille codec, canonical table.

   This is the SHIPPED mapping, copied verbatim from the public package
   github.com/x-amz/swift-base256-blob (Sources/Base256/Base256.swift, `encodeChars`).

   It is a fixed permutation of the Braille block, NOT 0x2800 + byte. The law, verified
   over all 256 values: a cell's left dot column (dots 1,2,3,7) read top→bottom, MSB
   first, is the byte's HIGH nibble; the right column (dots 4,5,6,8) read the same way
   is the LOW nibble. So 0x0F fills the right column (⢸) and 0xF0 fills the left (⡇).

   Anchors, for anyone checking: 0x00→⠀ 0x0F→⢸ 0xF0→⡇ 0xFF→⣿ 0x62→⠦ */
(function (global) {
  'use strict';

  var TABLE =
    '⠀⢀⠠⢠⠐⢐⠰⢰⠈⢈⠨⢨⠘⢘⠸⢸' +
    '⡀⣀⡠⣠⡐⣐⡰⣰⡈⣈⡨⣨⡘⣘⡸⣸' +
    '⠄⢄⠤⢤⠔⢔⠴⢴⠌⢌⠬⢬⠜⢜⠼⢼' +
    '⡄⣄⡤⣤⡔⣔⡴⣴⡌⣌⡬⣬⡜⣜⡼⣼' +
    '⠂⢂⠢⢢⠒⢒⠲⢲⠊⢊⠪⢪⠚⢚⠺⢺' +
    '⡂⣂⡢⣢⡒⣒⡲⣲⡊⣊⡪⣪⡚⣚⡺⣺' +
    '⠆⢆⠦⢦⠖⢖⠶⢶⠎⢎⠮⢮⠞⢞⠾⢾' +
    '⡆⣆⡦⣦⡖⣖⡶⣶⡎⣎⡮⣮⡞⣞⡾⣾' +
    '⠁⢁⠡⢡⠑⢑⠱⢱⠉⢉⠩⢩⠙⢙⠹⢹' +
    '⡁⣁⡡⣡⡑⣑⡱⣱⡉⣉⡩⣩⡙⣙⡹⣹' +
    '⠅⢅⠥⢥⠕⢕⠵⢵⠍⢍⠭⢭⠝⢝⠽⢽' +
    '⡅⣅⡥⣥⡕⣕⡵⣵⡍⣍⡭⣭⡝⣝⡽⣽' +
    '⠃⢃⠣⢣⠓⢓⠳⢳⠋⢋⠫⢫⠛⢛⠻⢻' +
    '⡃⣃⡣⣣⡓⣓⡳⣳⡋⣋⡫⣫⡛⣛⡻⣻' +
    '⠇⢇⠧⢧⠗⢗⠷⢷⠏⢏⠯⢯⠟⢟⠿⢿' +
    '⡇⣇⡧⣧⡗⣗⡷⣷⡏⣏⡯⣯⡟⣟⡿⣿';

  var CHARS = Array.from(TABLE);
  var REV = {};
  for (var i = 0; i < CHARS.length; i++) REV[CHARS[i]] = i;

  function glyph(byte) { return CHARS[byte & 0xFF]; }

  function encode(bytes) {
    var out = '';
    for (var i = 0; i < bytes.length; i++) out += CHARS[bytes[i] & 0xFF];
    return out;
  }

  function encodeText(str) {
    var bytes = global.TextEncoder ? new TextEncoder().encode(str) : [];
    if (!global.TextEncoder) for (var i = 0; i < str.length; i++) bytes.push(str.charCodeAt(i) & 0xFF);
    return encode(bytes);
  }

  function decode(str) {
    var out = [];
    Array.from(str).forEach(function (ch) {
      if (!(ch in REV)) throw new Error('Base256: cannot decode ' + ch);
      out.push(REV[ch]);
    });
    return out;
  }

  /* The two nibble columns of a cell, as arrays of 4 booleans read top→bottom.
     Lets a poster draw the dots itself and stay in step with the table. */
  function columns(byte) {
    var hi = (byte >> 4) & 0xF, lo = byte & 0xF, L = [], R = [];
    for (var i = 3; i >= 0; i--) { L.push(!!(hi & (1 << i))); R.push(!!(lo & (1 << i))); }
    return { left: L, right: R };
  }

  var api = { TABLE: CHARS, glyph: glyph, encode: encode, encodeText: encodeText, decode: decode, columns: columns };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.Base256 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
