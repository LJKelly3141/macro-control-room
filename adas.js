/*
 * Macro Control Room: the AD/AS panel for one universe.
 *
 *   PU.adas.render(el, universe, { name, slot, noPolicy, optimal })
 *
 * The static price-level picture from the course slides: real GDP across,
 * PRICE LEVEL up. Curves come straight from the engine:
 *   AD   = PU.engine.adP(y, rec.ad)
 *   SRAS = PU.engine.srasP(y, rec.sras, rec.lras)
 *   LRAS = vertical at rec.potential
 * so the current equilibrium (rec.y, rec.p) sits on both AD and SRAS.
 * Last round's curves are dashed so the shift shows; past rounds are their
 * own (y, p) points, joined by a thin trail.
 *
 * Curves use the record's ad, sras, lras (the state the round's equilibrium
 * was computed from; the universe's own sras has already adjusted for next
 * round). Every part has a data-tip key from PU.TIPS.
 *
 * Axes. Inflation is not anchored, so the price level can drift far from
 * its start. The price-level range is chosen on every render from this
 * universe's history plus the no-policy point, with a margin and nice ticks,
 * never narrower than MIN_P_SPAN points. Real GDP keeps PU.SCALES.adasY unless
 * a point falls outside it; then it widens to fit. (The two universes can
 * therefore have different price-level axes; the tick labels say so.)
 *
 * opts.noPolicy is the no-policy twin's record for the same round, or null.
 * When given, its (y, p) is marked with a hollow ring labelled "No policy",
 * unless it sits on the current dot.
 *
 * opts.optimal is the optimal path's record for the same round, or null (a
 * benchmark entry {history} or {a: {history}, b: ...} also works: the record
 * for this round is picked out). When given, its (y, p) is marked with a
 * small solid diamond labelled "Optimal" (tip optimalPath), unless it sits on
 * the current dot. The record carries its own nom, ad, sras, lras; only its
 * point is drawn, and the axes include it.
 *
 * The SVG is sized to its container in CSS pixels so labels stay readable
 * from a phone to a projector; it redraws itself when the window resizes.
 * In a wide container (one universe at full width) it is drawn taller.
 *
 * Colors: none here. Parts carry classes and dashboard.css paints them from
 * tokens.css; the universe color comes from data-slot="a|b" on the SVG, so a
 * theme change restyles the diagram with no redraw. opts.slot is 'a' or 'b';
 * without it the slot is read from opts.color (PU.COLORS.b means 'b'), else
 * 'a'. opts.color is never drawn with.
 */
(function (root) {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var TICK_FONT = 13;     // tick labels, px (dashboard.css)
  var LABEL_FONT = 15;    // curve labels and "No policy", px (dashboard.css)
  var CHAR_K = 0.66;      // rough width per character, as a share of the font size (bold)
  var MIN_P_SPAN = 20;    // the price-level axis is never narrower than this
  var OPT_ROOM = 18;      // one gauge caption line at 15px, px (see draw)
  var uid = 0;

  function el(name, attrs, parent) {
    var n = document.createElementNS(NS, name);
    for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function txt(parent, x, y, s, attrs) {
    attrs = attrs || {};
    attrs.x = x.toFixed(1); attrs.y = y.toFixed(1);
    var t = el('text', attrs, parent);
    t.textContent = s;
    return t;
  }
  function slotOf(opts) {
    if (opts.slot === 'a' || opts.slot === 'b') return opts.slot;
    var C = root.PU && root.PU.COLORS;
    if (opts.color && C && C.b && String(opts.color).toLowerCase() === String(C.b).toLowerCase()) return 'b';
    return 'a';
  }
  function comma(x) { return Math.round(x).toLocaleString('en-US'); }
  function p1(x) { return (Math.round(x * 10) / 10).toFixed(1); }

  // A "nice" step (1, 2, 2.5, 5 x 10^k) that splits span into about n parts.
  function niceStep(span, n) {
    var raw = span / n, mag = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10)), f = raw / mag;
    var nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
    return nice * mag;
  }

  // Price-level axis from the points that must show: a margin around them,
  // at least MIN_P_SPAN wide, ends on nice ticks.
  function priceRange(ps) {
    var lo = Math.min.apply(null, ps), hi = Math.max.apply(null, ps);
    var span = hi - lo, pad = Math.max(3, span * 0.15);
    lo -= pad; hi += pad;
    if (hi - lo < MIN_P_SPAN) { var c = (lo + hi) / 2; lo = c - MIN_P_SPAN / 2; hi = c + MIN_P_SPAN / 2; }
    var step = niceStep(hi - lo, 5);
    lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step;
    return { min: lo, max: hi, step: step };
  }

  // Real GDP axis: PU.SCALES.adasY, widened (in steps of 500) only when a point is outside.
  function gdpRange(ys, base) {
    var lo = base.min, hi = base.max;
    var mn = Math.min.apply(null, ys), mx = Math.max.apply(null, ys);
    var pad = 150;
    if (mn - pad < lo) lo = Math.floor((mn - pad) / 500) * 500;
    if (mx + pad > hi) hi = Math.ceil((mx + pad) / 500) * 500;
    var step = hi - lo > 4000 ? 1000 : 500;
    return { min: lo, max: hi, step: step };
  }

  // Points along a curve p(y) from y0 to y1, in data units.
  function sample(f, y0, y1, n) {
    var out = [];
    for (var i = 0; i <= n; i++) {
      var y = y0 + (y1 - y0) * i / n;
      out.push([y, f(y)]);
    }
    return out;
  }

  // SRAS is P = 80 + C / (A - y): it bends up toward a pole at y = A. Read A
  // and C off the engine's own function (two points far to the left of any
  // pole), so the curve can be sampled evenly in both y and P up to the top
  // of the plot without knowing which calibration the engine uses.
  // The engine scales every price by state.nom (expected inflation built into
  // all prices), so the curve is worked out in unscaled terms and scaled back.
  function srasCurve(state, Y, Pin) {
    var E = root.PU.engine;
    var nom = state.nom || 1;
    var P = { min: Pin.min / nom, max: Pin.max / nom };
    function f(y) { return E.srasP(y, state.sras, state.lras); }
    return srasCurveUnscaled(f, Y, P).map(function (pt) { return [pt[0], pt[1] * nom]; });
  }
  function srasCurveUnscaled(f, Y, P) {
    var y1 = -20000, y2 = 0, f1 = f(y1) - 80, f2 = f(y2) - 80;
    var A = (f1 * y1 - f2 * y2) / (f1 - f2), C = f2 * (A - y2);
    if (!(isFinite(A) && isFinite(C) && C > 0)) return sample(f, Y.min, Y.max, 80);
    function yAt(p) { return A - C / (p - 80); }
    var pTop = P.max + (P.max - P.min) * 0.1;
    var yEnd = pTop > 80 ? Math.min(Y.max, yAt(pTop)) : Y.max;
    if (!(yEnd > Y.min)) return [];
    var pts = sample(f, Y.min, yEnd, 60);
    var pa = f(Y.min), pb = f(yEnd);
    if (pa > 80 && pb > pa) {
      for (var i = 1; i < 40; i++) { var p = pa + (pb - pa) * i / 40; pts.push([yAt(p), p]); }
    }
    pts.sort(function (a, b) { return a[0] - b[0]; });
    return pts;
  }

  // Curves for one state in price-level terms.
  function curves(state, Y, P) {
    var E = root.PU.engine;
    return {
      ad: sample(function (y) { return (state.nom || 1) * E.adP(y, state.ad); }, Y.min, Y.max, 2),
      sras: srasCurve(state, Y, P),
      lras: E.potential(state.lras)
    };
  }

  // Where a sampled curve leaves the plot box, scanning from the given end.
  function lastInside(pts, Y, P, fromEnd) {
    var order = pts.slice();
    if (fromEnd) order.reverse();
    function inside(y, p) { return y >= Y.min && y <= Y.max && p >= P.min && p <= P.max; }
    for (var i = 0; i < order.length; i++) {
      var q = order[i];
      if (inside(q[0], q[1])) {
        if (i > 0) {
          var o = order[i - 1];
          var lo = 0, hi = 1;
          for (var k = 0; k < 30; k++) {
            var m = (lo + hi) / 2;
            if (inside(q[0] + (o[0] - q[0]) * m, q[1] + (o[1] - q[1]) * m)) lo = m; else hi = m;
          }
          return [q[0] + (o[0] - q[0]) * lo, q[1] + (o[1] - q[1]) * lo];
        }
        return q;
      }
    }
    return null;
  }

  function overlap(a, b) {
    return a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
  }
  function box(x, y, s, anchor, font) {
    var f = font || LABEL_FONT;
    var w = s.length * CHAR_K * f;
    var x0 = anchor === 'end' ? x - w : (anchor === 'middle' ? x - w / 2 : x);
    return { x0: x0, x1: x0 + w, y0: y - f, y1: y + 3 };
  }
  function charW(f) { return CHAR_K * (f || LABEL_FONT); }

  function shiftWords(cur, prev) {
    if (!prev) return '';
    var out = [];
    function say(name, d) {
      if (Math.abs(d) < 1) return;
      out.push(name + ' shifted ' + (d > 0 ? 'right' : 'left'));
    }
    say('AD', cur.ad - prev.ad);
    say('SRAS', cur.sras - prev.sras);
    say('LRAS', cur.lras - prev.lras);
    return out.length ? ' Since last round: ' + out.join(', ') + '.' : ' No curve shifted since last round.';
  }

  var live = [];  // hosts to redraw on resize
  var timer = null;
  function onResize() {
    clearTimeout(timer);
    timer = setTimeout(function () {
      for (var i = 0; i < live.length; i++) {
        var h = live[i];
        if (!h.el.isConnected) continue;
        if (Math.abs(h.el.clientWidth - h.width) > 8) draw(h.el, h.universe, h.opts);
      }
    }, 150);
  }

  function render(host, universe, opts) {
    var found = false;
    for (var i = 0; i < live.length; i++) {
      if (live[i].el === host) { live[i].universe = universe; live[i].opts = opts; found = true; }
    }
    if (!found) live.push({ el: host, universe: universe, opts: opts, width: 0 });
    if (typeof window !== 'undefined' && window.addEventListener && !render.bound) {
      window.addEventListener('resize', onResize);
      render.bound = true;
    }
    draw(host, universe, opts);
  }

  // A curve: an invisible wide stroke to hover, then the visible line.
  function curve(parent, d, cls, tip, hitWidth) {
    var g = el('g', { 'data-tip': tip }, parent);
    el('path', { d: d, 'class': 'pu-hit', 'stroke-width': hitWidth || 14 }, g);
    el('path', { d: d, 'class': cls }, g);
    return g;
  }

  // Axis ranges for a universe: exported so a test can check the dot stays inside.
  function ranges(hist, np, opt) {
    var S = root.PU.SCALES;
    var ps = hist.map(function (h) { return h.p; });
    var ys = hist.map(function (h) { return h.y; }).concat(hist.map(function (h) { return h.potential; }));
    if (np) { ps.push(np.p); ys.push(np.y); }
    if (opt) { ps.push(opt.p); ys.push(opt.y); }
    return { Y: gdpRange(ys, S.adasY), P: priceRange(ps) };
  }

  // True when this panel sits beside the gauges (its column is a grid row,
  // as in app.css's one-universe layout) rather than under them.
  function sideBySide(host) {
    try {
      var col = host.parentElement;
      return !!(col && root.getComputedStyle && root.getComputedStyle(col).display === 'grid');
    } catch (e) { return false; }
  }

  // A point record (y and p numbers) or null.
  function pointRec(r) { return r && typeof r.y === 'number' && typeof r.p === 'number' && isFinite(r.y) && isFinite(r.p) ? r : null; }
  // The optimal path's record for this round, from a record or a benchmark entry.
  function optRecord(o, round, slot) {
    if (!o) return null;
    if (o[slot] && o[slot].history) o = o[slot];
    if (o.history && o.history.length) o = o.history[round];
    return pointRec(o);
  }
  function diamond(x, y, h) {
    return 'M' + x.toFixed(1) + ' ' + (y - h).toFixed(1) + 'L' + (x + h).toFixed(1) + ' ' + y.toFixed(1) +
      'L' + x.toFixed(1) + ' ' + (y + h).toFixed(1) + 'L' + (x - h).toFixed(1) + ' ' + y.toFixed(1) + 'Z';
  }

  // First label spot that stays in the plot and clears everything taken;
  // failing that, the first spot that stays in the plot.
  function placeLabel(s, spots, taken, L, font) {
    var k, q, firstIn = null;
    for (k = 0; k < spots.length; k++) {
      var b = box(spots[k][0], spots[k][1], s, spots[k][2], font);
      if (b.x0 < L.left || b.x1 > L.right || b.y0 < L.top || b.y1 > L.bottom) continue;
      if (!firstIn) firstIn = spots[k];
      var hit = false;
      for (q = 0; q < taken.length; q++) if (overlap(b, taken[q])) { hit = true; break; }
      if (!hit) return spots[k];
    }
    return firstIn;
  }

  function draw(host, universe, opts, keyRoom) {
    opts = opts || {};
    host.innerHTML = '';
    if (!universe || !universe.history || !universe.history.length) return;
    var hist = universe.history;
    var n = hist.length;
    var rec = hist[n - 1];
    var prev = n > 1 ? hist[n - 2] : null;
    var np = pointRec(opts.noPolicy);
    var opt = optRecord(opts.optimal, rec.round, slotOf(opts));
    var R = ranges(hist, np, opt), Y = R.Y, P = R.P;

    var cw = host.clientWidth || 560;
    for (var i = 0; i < live.length; i++) if (live[i].el === host) live[i].width = cw;
    var width = Math.round(Math.max(280, Math.min(1000, cw)));
    // Taller when the panel is wide (one universe at full width).
    var height = width > 720 ? Math.round(Math.min(540, width * 0.56)) : Math.round(Math.max(240, Math.min(420, width * 0.68)));
    // With the optimal path on, each gauge card gains one caption line. When
    // the gauges sit above this diagram (two universes, or a narrow screen)
    // the drawing gives that line back so the universe column keeps its
    // height; side by side (one universe, wide) the gauges are the shorter
    // column and nothing changes.
    // keyRoom: extra px when "diamond: optimal" wraps the key onto another line.
    var giveBack = opt && !sideBySide(host);
    if (giveBack) height -= OPT_ROOM + (keyRoom || 0);
    var m = { l: 58, r: 12, t: 12, b: 46 };
    var pw = width - m.l - m.r, ph = height - m.t - m.b;
    var top = m.t, bottom = m.t + ph, left = m.l, right = m.l + pw;
    function sx(y) { return m.l + (y - Y.min) / (Y.max - Y.min) * pw; }
    function sy(v) { return m.t + (P.max - v) / (P.max - P.min) * ph; }
    function path(pts) {
      var d = '';
      for (var j = 0; j < pts.length; j++) d += (j ? 'L' : 'M') + sx(pts[j][0]).toFixed(1) + ' ' + sy(pts[j][1]).toFixed(1);
      return d;
    }

    var name = opts.name || 'This universe';
    var label = 'AD/AS diagram for ' + name + ', ' + (rec.round === 0 ? 'start' : 'round ' + rec.round) +
      '. Real GDP ' + comma(rec.y) + ', price level ' + p1(rec.p) +
      ', potential GDP ' + comma(rec.potential) + '.' +
      (prev ? ' Last round the price level was ' + p1(prev.p) + '.' : '') + shiftWords(rec, prev);
    if (np) label += ' With no policy: real GDP ' + comma(np.y) + ', price level ' + p1(np.p) + '.';
    if (opt) label += ' Optimal path: real GDP ' + comma(opt.y) + ', price level ' + p1(opt.p) + '.';

    var svg = el('svg', {
      viewBox: '0 0 ' + width + ' ' + height, width: width, height: height,
      role: 'img', 'aria-label': label, 'class': 'pu-adas-svg' + (width > 720 ? ' pu-adas-wide' : ''), 'data-tip': 'adas', tabindex: '0',
      'data-slot': slotOf(opts)
    }, host);
    var clipId = 'pu-adas-clip-' + (++uid);
    var defs = el('defs', {}, svg);
    var cp = el('clipPath', { id: clipId }, defs);
    el('rect', { x: m.l, y: m.t, width: pw, height: ph }, cp);

    // Frame, light gridlines, tick labels, axis titles.
    el('rect', { x: m.l, y: m.t, width: pw, height: ph, 'class': 'pu-adas-frame' }, svg);
    var g = el('g', { 'class': 'pu-adas-axis' }, svg);
    var yt, pt;
    for (yt = Math.ceil(Y.min / Y.step) * Y.step; yt <= Y.max + 1e-9; yt += Y.step) {
      el('line', { x1: sx(yt), y1: bottom, x2: sx(yt), y2: bottom + 4, 'class': 'pu-adas-tick' }, g);
      txt(g, sx(yt), bottom + 18, comma(yt), { 'text-anchor': 'middle' });
    }
    var pdec = P.step < 1 ? 1 : 0;
    for (pt = P.min; pt <= P.max + 1e-9; pt += P.step) {
      if (pt > P.min + 1e-9 && pt < P.max - 1e-9) el('line', { x1: left, y1: sy(pt), x2: right, y2: sy(pt), 'class': 'pu-adas-grid' }, g);
      el('line', { x1: left - 4, y1: sy(pt), x2: left, y2: sy(pt), 'class': 'pu-adas-tick' }, g);
      txt(g, left - 6, sy(pt) + 4, pt.toFixed(pdec), { 'text-anchor': 'end' });
    }
    txt(g, m.l + pw / 2, height - 6, 'Real GDP', { 'text-anchor': 'middle', 'class': 'pu-adas-title', 'data-tip': 'realGdp' });
    var yl = txt(g, 0, 0, 'Price level', { 'text-anchor': 'middle', 'class': 'pu-adas-title', 'data-tip': 'priceLevel' });
    yl.setAttribute('transform', 'translate(14 ' + (m.t + ph / 2).toFixed(1) + ') rotate(-90)');

    var plot = el('g', { 'clip-path': 'url(#' + clipId + ')' }, svg);
    var cur = curves(rec, Y, P);

    // Last round's curves, dashed, only where they moved.
    if (prev) {
      var old = curves(prev, Y, P);
      if (Math.abs(prev.ad - rec.ad) >= 1) curve(plot, path(old.ad), 'pu-adas-curve pu-adas-old', 'lastRound', 10);
      if ((Math.abs(prev.sras - rec.sras) >= 1 || Math.abs(prev.lras - rec.lras) >= 1) && old.sras.length) {
        curve(plot, path(old.sras), 'pu-adas-curve pu-adas-old', 'lastRound', 10);
      }
      if (Math.abs(prev.lras - rec.lras) >= 1) {
        var ox = sx(old.lras).toFixed(1);
        curve(plot, 'M' + ox + ' ' + top + 'V' + bottom, 'pu-adas-lras pu-adas-old', 'lastRound', 10);
      }
    }

    // Current curves.
    var lx = sx(cur.lras);
    curve(plot, 'M' + lx.toFixed(1) + ' ' + top + 'V' + bottom, 'pu-adas-lras', 'lras');
    curve(plot, path(cur.ad), 'pu-adas-curve pu-adas-ad', 'ad');
    if (cur.sras.length) curve(plot, path(cur.sras), 'pu-adas-curve pu-adas-sras', 'sras');

    // Trail of past equilibria (y, p), oldest faintest, joined by a thin line.
    var trail = el('g', { 'class': 'pu-adas-trail', 'data-tip': 'trail' }, plot);
    if (n > 1) {
      var tpts = hist.map(function (h) { return [h.y, h.p]; });
      el('path', { d: path(tpts), 'class': 'pu-adas-trail-line' }, trail);
    }
    var placed = [];
    // The ranges include every point, so the dot is inside; the clamp is a guard.
    var cxNow = Math.max(left, Math.min(right, sx(rec.y))), cyNow = Math.max(top, Math.min(bottom, sy(rec.p)));
    placed.push({ x0: cxNow - 9, x1: cxNow + 9, y0: cyNow - 9, y1: cyNow + 9 });
    // No-policy point: a hollow ring, skipped when it sits on the current dot.
    var npMark = null;
    if (np) {
      var nx = Math.max(left, Math.min(right, sx(np.y))), ny = Math.max(top, Math.min(bottom, sy(np.p)));
      if (Math.abs(nx - cxNow) > 6 || Math.abs(ny - cyNow) > 6) {
        npMark = { x: nx, y: ny };
        var ng = el('g', { 'class': 'pu-adas-np', 'data-tip': 'noPolicy' }, svg);
        el('circle', { cx: nx, cy: ny, r: 13, 'class': 'pu-hit-fill' }, ng);
        el('circle', { cx: nx, cy: ny, r: 8, 'class': 'pu-adas-np-ring' }, ng);
        placed.push({ x0: nx - 10, x1: nx + 10, y0: ny - 10, y1: ny + 10 });
      }
    }
    // Optimal point: a small solid diamond, skipped when it sits on the current dot.
    var optMark = null;
    if (opt) {
      var ox2 = Math.max(left, Math.min(right, sx(opt.y))), oy2 = Math.max(top, Math.min(bottom, sy(opt.p)));
      if (Math.abs(ox2 - cxNow) > 6 || Math.abs(oy2 - cyNow) > 6) {
        optMark = { x: ox2, y: oy2 };
        placed.push({ x0: ox2 - 9, x1: ox2 + 9, y0: oy2 - 9, y1: oy2 + 9 });
        // Under the current dot, over the curves and the no-policy ring.
        var og = el('g', { 'class': 'pu-adas-opt', 'data-tip': 'optimalPath' }, svg);
        el('circle', { cx: ox2, cy: oy2, r: 13, 'class': 'pu-hit-fill' }, og);
        el('path', { d: diamond(ox2, oy2, 8), 'class': 'pu-adas-opt-mark' }, og);
      }
    }

    var labels = el('g', { 'class': 'pu-adas-labels' }, svg);
    for (i = n - 2; i >= 0; i--) {
      var h = hist[i];
      var age = n - 1 - i;               // 1 = last round
      // Fill fades with age; the ring stays full strength so every dot keeps 3:1.
      var op = Math.max(0.15, 1 - 0.15 * age);
      var hx = sx(h.y), hy = sy(h.p);
      el('circle', { cx: hx, cy: hy, r: 4.5, 'class': 'pu-adas-past', 'fill-opacity': op }, trail);
      // Only the last round gets a name.
      if (age !== 1) continue;
      var s = h.round === 0 ? 'Start' : 'Round ' + h.round;
      var spots = [[hx + 8, hy - 7, 'start'], [hx - 8, hy - 7, 'end'], [hx + 8, hy + 17, 'start'], [hx - 8, hy + 17, 'end']];
      for (var k = 0; k < spots.length; k++) {
        var bx = box(spots[k][0], spots[k][1], s, spots[k][2], TICK_FONT);
        if (bx.x0 < left || bx.x1 > right || bx.y0 < top || bx.y1 > bottom) continue;
        var hit = false;
        for (var q = 0; q < placed.length; q++) if (overlap(bx, placed[q])) { hit = true; break; }
        if (hit) continue;
        placed.push(bx);
        txt(labels, spots[k][0], spots[k][1], s, { 'text-anchor': spots[k][2], 'class': 'pu-adas-roundnum', 'data-tip': 'trail' });
        break;
      }
    }

    // Current equilibrium: a visible dot and a larger invisible hover target.
    var now = el('g', { 'data-tip': 'equilibrium' }, svg);
    el('circle', { cx: cxNow, cy: cyNow, r: 13, 'class': 'pu-hit-fill' }, now);
    el('circle', { cx: cxNow, cy: cyNow, r: 7.5, 'class': 'pu-adas-now' }, now);

    // Curve labels at line ends, off the lines and inside the plot.
    var curveLabels = [];
    var CW = charW();
    function crossesLras(b) { return b.x0 - 3 < lx && b.x1 + 3 > lx; }
    var adEnd = lastInside(cur.ad, Y, P, true);
    if (adEnd) {
      var ax = sx(adEnd[0]), ay = sy(adEnd[1]);
      if (ay > bottom - 22) {
        // Beside where AD leaves the bottom, on whichever side misses LRAS.
        var adR = { s: 'AD', x: Math.min(ax + 10, right - 2 * CW - 4), y: bottom - 7, a: 'start', tip: 'ad' };
        var adL = { s: 'AD', x: ax - 10, y: bottom - 7, a: 'end', tip: 'ad' };
        curveLabels.push(crossesLras(box(adR.x, adR.y, adR.s, adR.a)) && adL.x - 2 * CW > left ? adL : adR);
      } else curveLabels.push({ s: 'AD', x: right - 4, y: Math.min(bottom - 7, ay + 20), a: 'end', tip: 'ad' });
    }
    var srEnd = cur.sras.length ? lastInside(cur.sras, Y, P, true) : null;
    if (srEnd) {
      var rx = sx(srEnd[0]), ry = sy(srEnd[1]);
      if (ry < top + 4) {
        if (rx + 7 + 4 * CW < right) curveLabels.push({ s: 'SRAS', x: rx + 7, y: top + 18, a: 'start', tip: 'sras' });
        else curveLabels.push({ s: 'SRAS', x: rx - 9, y: top + 18, a: 'end', tip: 'sras' });
      } else {
        curveLabels.push({ s: 'SRAS', x: right - 4, y: Math.max(top + 18, ry - 9), a: 'end', tip: 'sras' });
      }
    }
    if (lx >= left && lx <= right) {
      // Top or bottom of the line, right side first, then left; skip spots
      // outside the plot or on another label.
      var cand = [[lx + 6, top + 18, 'start'], [lx - 6, top + 18, 'end'],
                  [lx + 6, bottom - 7, 'start'], [lx - 6, bottom - 7, 'end']].map(function (c) {
        return { s: 'LRAS', x: c[0], y: c[1], a: c[2], tip: 'lras' };
      });
      var pick = lx + 6 + 4 * CW > right ? cand[1] : cand[0];
      for (k = 0; k < cand.length; k++) {
        var cb = box(cand[k].x, cand[k].y, cand[k].s, cand[k].a), clash = cb.x0 < left || cb.x1 > right;
        cb = { x0: cb.x0 - 8, x1: cb.x1 + 8, y0: cb.y0, y1: cb.y1 };  // keep a gap between labels
        for (q = 0; q < curveLabels.length; q++) {
          if (overlap(cb, box(curveLabels[q].x, curveLabels[q].y, curveLabels[q].s, curveLabels[q].a))) clash = true;
        }
        if (!clash) { pick = cand[k]; break; }
      }
      curveLabels.push(pick);
    }
    curveLabels.forEach(function (L) {
      txt(labels, L.x, L.y, L.s, { 'text-anchor': L.a, 'class': 'pu-adas-label pu-adas-label-' + L.tip, 'data-tip': L.tip });
    });

    // "No policy" beside its ring, then "Optimal" beside its diamond: first
    // spot that stays in the plot and clears the dots, the round label, the
    // curve labels, and each other.
    var taken = placed.concat(curveLabels.map(function (L) { return box(L.x, L.y, L.s, L.a); }));
    for (q = 0; q < n - 1; q++) {
      var tx = sx(hist[q].y), ty = sy(hist[q].p);
      taken.push({ x0: tx - 5, x1: tx + 5, y0: ty - 5, y1: ty + 5 });
    }
    var plotBox = { left: left, right: right, top: top, bottom: bottom };
    function spotsAround(mx, my, rad) {
      var away = mx >= cxNow ? 1 : -1;   // prefer the side away from the current dot
      var a = away > 0 ? 'start' : 'end', b = away > 0 ? 'end' : 'start';
      return [[mx + (rad + 5) * away, my + 5, a],
              [mx, my - (rad + 7), 'middle'], [mx, my + rad + 20, 'middle'],
              [mx - (rad + 5) * away, my + 5, b],
              [mx + (rad + 3) * away, my - (rad + 5), a],
              [mx + (rad + 3) * away, my + rad + 16, a]];
    }
    if (npMark) {
      var npick = placeLabel('No policy', spotsAround(npMark.x, npMark.y, 8), taken, plotBox);
      if (npick) {
        txt(labels, npick[0], npick[1], 'No policy', { 'text-anchor': npick[2], 'class': 'pu-adas-np-label', 'data-tip': 'noPolicy' });
        taken.push(box(npick[0], npick[1], 'No policy', npick[2]));
      }
    }
    if (optMark) {
      var opick = placeLabel('Optimal', spotsAround(optMark.x, optMark.y, 8), taken, plotBox);
      if (opick) txt(labels, opick[0], opick[1], 'Optimal', { 'text-anchor': opick[2], 'class': 'pu-adas-opt-label', 'data-tip': 'optimalPath' });
    }

    // A short text key, so nothing relies on color or dash alone.
    var key = document.createElement('p');
    key.className = 'pu-adas-key' + (width > 720 ? ' pu-adas-key-wide' : '');
    key.setAttribute('aria-hidden', 'true');
    var parts = ['Big dot: now'];
    if (prev) parts.push('dashed: last round');
    if (npMark) parts.push('ring: no policy');
    if (optMark) parts.push('diamond: optimal');
    key.textContent = parts.join(' · ');
    host.appendChild(key);
    // If the optimal item pushed the key onto another line, draw once more
    // with that much less height, so the column still keeps its height.
    if (giveBack && optMark && !keyRoom && key.offsetHeight) {
      var hWith = key.offsetHeight;
      key.textContent = parts.slice(0, -1).join(' · ');
      var hWithout = key.offsetHeight;
      key.textContent = parts.join(' · ');
      if (hWith > hWithout) draw(host, universe, opts, hWith - hWithout);
    }
  }

  root.PU = root.PU || {};
  root.PU.adas = {
    render: render,
    // For tests: the axis ranges the diagram uses for a history (and no-policy record).
    ranges: ranges, priceRange: priceRange, slotOf: slotOf, optRecord: optRecord
  };
})(typeof window !== 'undefined' ? window : globalThis);
