/* Dependency edges for the component diagram.

   The tiers are laid out by CSS; this only draws the connectors between them.
   Every node is positioned by the browser, so the lines are measured from the
   real boxes rather than from anything hard-coded, and they are redrawn when
   the layout reflows. Without JavaScript the tiers still read top-to-bottom —
   the diagram loses its lines, not its meaning. */
(function (global) {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';

  function draw(graph) {
    var svg = document.querySelector('.edges');
    var host = document.querySelector('.diagram');
    if (!svg || !host || !graph || !graph.edges) return;

    function render() {
      while (svg.firstChild) svg.removeChild(svg.firstChild);

      var box = host.getBoundingClientRect();
      svg.setAttribute('viewBox', '0 0 ' + box.width + ' ' + box.height);
      svg.setAttribute('width', box.width);
      svg.setAttribute('height', box.height);

      // Fan multiple edges out across each node's edge so they stay separable.
      var outs = {}, ins = {};
      graph.edges.forEach(function (e) {
        (outs[e.from] = outs[e.from] || []).push(e);
        (ins[e.to] = ins[e.to] || []).push(e);
      });

      graph.edges.forEach(function (e) {
        var a = document.querySelector('[data-node="' + e.from + '"]');
        var b = document.querySelector('[data-node="' + e.to + '"]');
        if (!a || !b) return;

        var ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
        var sameRow = Math.abs(ra.top - rb.top) < 4;
        if (sameRow) return;   // a wrapped tier can put these side by side

        var oi = outs[e.from].indexOf(e), on = outs[e.from].length;
        var ii = ins[e.to].indexOf(e), inn = ins[e.to].length;

        var spread = Math.min(ra.width * 0.5, 90);
        var x1 = ra.left - box.left + ra.width / 2 + (oi - (on - 1) / 2) * (spread / Math.max(on, 1));
        var y1 = ra.bottom - box.top;
        var spreadB = Math.min(rb.width * 0.5, 90);
        var x2 = rb.left - box.left + rb.width / 2 + (ii - (inn - 1) / 2) * (spreadB / Math.max(inn, 1));
        var y2 = rb.top - box.top;

        if (y2 < y1) return;   // never draw upward; the graph is acyclic by build

        var mid = (y1 + y2) / 2;
        var d = 'M' + x1.toFixed(1) + ' ' + y1.toFixed(1) +
                ' C' + x1.toFixed(1) + ' ' + mid.toFixed(1) +
                ' ' + x2.toFixed(1) + ' ' + mid.toFixed(1) +
                ' ' + x2.toFixed(1) + ' ' + y2.toFixed(1);

        var path = document.createElementNS(NS, 'path');
        path.setAttribute('d', d);
        path.setAttribute('class', 'edge edge--' + e.kind);
        if (e.why) {
          var t = document.createElementNS(NS, 'title');
          t.textContent = e.from + ' → ' + e.to + ' — ' + e.why;
          path.appendChild(t);
        }
        svg.appendChild(path);

        var dot = document.createElementNS(NS, 'circle');
        dot.setAttribute('cx', x2.toFixed(1));
        dot.setAttribute('cy', y2.toFixed(1));
        dot.setAttribute('r', '2.5');
        dot.setAttribute('class', 'edge-head edge-head--' + e.kind);
        svg.appendChild(dot);
      });
    }

    render();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(render);
    var t;
    global.addEventListener('resize', function () {
      clearTimeout(t);
      t = setTimeout(render, 120);
    });
  }

  var api = { draw: draw };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.Edges = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
