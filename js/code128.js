/* Code 128 (code set B) encoder. Symbol width table sourced from the Code 128
   Wikipedia table (107 symbols, 11 modules each; stop terminates with a 2-module bar).
   Every barcode in the lab is a real, scannable encoding — the ornament law demands it. */
(function (global) {
  'use strict';
  var WIDTHS = ["212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213", "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132", "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211", "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313", "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331", "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111", "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214", "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111", "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141", "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141", "114131", "311141", "411131", "211412", "211214", "211232", "233111"];
  var START_B = 104, STOP = 106;

  function values(text) {
    var vals = [START_B];
    for (var i = 0; i < text.length; i++) {
      var c = text.charCodeAt(i);
      if (c < 32 || c > 126) throw new Error('code128B: unsupported char ' + text[i]);
      vals.push(c - 32);
    }
    var sum = vals[0];
    for (i = 1; i < vals.length; i++) sum += vals[i] * i;
    vals.push(sum % 103);
    vals.push(STOP);
    return vals;
  }

  // Returns array of {width, bar} module runs, plus the raw values for verification.
  function encode(text) {
    var vals = values(text);
    var runs = [];
    for (var i = 0; i < vals.length; i++) {
      var w = WIDTHS[vals[i]];
      for (var j = 0; j < w.length; j++) runs.push({ width: +w[j], bar: j % 2 === 0 });
    }
    runs.push({ width: 2, bar: true }); // stop termination bar
    return { runs: runs, values: vals };
  }

  // SVG string; 1 module = mw px, bars in `ink` color, transparent spaces.
  function svg(text, mw, height, ink) {
    var e = encode(text);
    var x = 0, total = 0, i;
    for (i = 0; i < e.runs.length; i++) total += e.runs[i].width;
    var parts = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + (total * mw) + ' ' + height + '" width="' + (total * mw) + '" height="' + height + '" role="img" aria-label="Code 128 barcode: ' + text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;') + '">'];
    for (i = 0; i < e.runs.length; i++) {
      if (e.runs[i].bar) parts.push('<rect x="' + (x * mw) + '" y="0" width="' + (e.runs[i].width * mw) + '" height="' + height + '" fill="' + ink + '"/>');
      x += e.runs[i].width;
    }
    parts.push('</svg>');
    return parts.join('');
  }

  var api = { encode: encode, svg: svg, values: values, WIDTHS: WIDTHS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.Code128 = api;
})(this);
