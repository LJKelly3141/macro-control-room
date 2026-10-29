/*
 * Macro Control Room: dial gauges for one universe's current period.
 *
 *   PU.gauges.render(el, record, { name, slot, prev, noPolicy, optimal, fields, zone, scoringOff })
 *
 * record and prev are engine history records (prev is the previous round or
 * null). noPolicy is the no-policy twin's record for the same round, or null:
 * when given, each dial adds a dashed second needle at the no-policy value and
 * a "No policy: x" line (or "Same as no policy" within 0.05, with no needle).
 * optimal is the optimal path's record for the same round, or null (a
 * benchmark entry {history} or {a: {history}, b: ...} also works: the record
 * for this round is picked out). When given, each dial adds a small diamond on
 * the arc at the optimal value (not a needle) and an "Optimal: x" line, or
 * "On the optimal path" within 0.05 with no diamond. Both carry the
 * optimalPath tip. The two comparison lines share one wrapping row. By default two dials, unemployment and inflation; opts.fields may
 * list any of 'unemployment', 'inflation', 'gapPct', 'p'. Dials use the fixed
 * ranges in PU.SCALES so both universes read on identical scales, and the
 * green band is the green zone in opts.zone ({unemployment: [lo, hi],
 * inflation: [lo, hi]}, from PU.zoneFor(scoring)), else PU.ZONE. With
 * opts.scoringOff true there is no green band and no green-zone text. The needle stops at the ends of the
 * dial; the printed value is always the true value. Every part carries a
 * data-tip key from PU.TIPS (tips.js) for its hover explanation.
 *
 * Colors: none here. Every part is drawn with a class, and dashboard.css
 * paints it from tokens.css (the universe color comes from data-slot="a|b"
 * on the wrapper), so a theme change restyles the gauges with no redraw.
 * opts.slot is 'a' or 'b'; without it the slot is read from opts.color
 * (PU.COLORS.b means 'b'), else 'a'. opts.color is never drawn with.
 */
(function (root) {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';

  // Dial geometry in viewBox units.
  var W = 180, H = 114, CX = 90, CY = 96, R = 66, TRACK = 14;

  // Which record field each dial reads, its zone, mark, and tooltip keys.
  var DIALS = {
    unemployment: { key: 'unemployment', field: 'unemployment', pct: true, zone: 'unemployment',
      tip: 'unemployment', markTip: 'naturalRate', markSpeak: 'natural rate 5 percent' },
    inflation: { key: 'inflation', field: 'inflation', pct: true, signed: true, zone: 'inflation',
      tip: 'inflation', markTip: 'target', markSpeak: 'target 2 percent' },
    gapPct: { key: 'gapPct', field: 'gapPct', pct: true, signed: true, mark: 0, markText: '0',
      tip: 'outputGap', markTip: null, markSpeak: 'zero means real GDP is at potential' },
    p: { key: 'price', field: 'p', pct: false, tip: 'priceLevel', markTip: null, markSpeak: null }
  };
  DIALS.price = DIALS.p;
  var DEFAULT_FIELDS = ['unemployment', 'inflation'];

  function el(name, attrs, parent) {
    var n = document.createElementNS(NS, name);
    for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  function html(tag, cls, text, parent) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    if (parent) parent.appendChild(n);
    return n;
  }

  function round1(x) { return Math.round(x * 10) / 10; }

  // Display text: one decimal, a real minus sign, % where it applies.
  function fmt(x, d) {
    var v = round1(x);
    if (v === 0) v = 0; // no "-0.0"
    var s = Math.abs(v).toFixed(1);
    var sign = v < 0 ? '−' : (d.signed && v > 0 ? '+' : '');
    return sign + s + (d.pct ? '%' : '');
  }

  function speakNum(x, d) {
    var v = round1(x);
    if (v === 0) v = 0;
    var s = (v < 0 ? 'minus ' : '') + Math.abs(v).toFixed(1);
    return s + (d.pct ? ' percent' : '');
  }

  // Angle for a value: min on the left (pi), max on the right (0).
  function frac(v, s) { return (v - s.min) / (s.max - s.min); }
  function pt(t, r) {
    var a = Math.PI * (1 - t);
    return [CX + r * Math.cos(a), CY - r * Math.sin(a)];
  }
  // A closed band between radii r0 and r1 from t0 to t1, so it can carry
  // both a fill and an edge.
  function bandPath(t0, t1, r0, r1) {
    var a = pt(t0, r1), b = pt(t1, r1), c = pt(t1, r0), d = pt(t0, r0);
    function f(p) { return p[0].toFixed(2) + ' ' + p[1].toFixed(2); }
    return 'M' + f(a) + ' A' + r1 + ' ' + r1 + ' 0 0 1 ' + f(b) +
      ' L' + f(c) + ' A' + r0 + ' ' + r0 + ' 0 0 0 ' + f(d) + ' Z';
  }

  function slotOf(opts) {
    if (opts.slot === 'a' || opts.slot === 'b') return opts.slot;
    var C = root.PU && root.PU.COLORS;
    if (opts.color && C && C.b && String(opts.color).toLowerCase() === String(C.b).toLowerCase()) return 'b';
    return 'a';
  }

  function arcPath(t0, t1, r) {
    var p0 = pt(t0, r), p1 = pt(t1, r);
    return 'M' + p0[0].toFixed(2) + ' ' + p0[1].toFixed(2) +
      ' A' + r + ' ' + r + ' 0 0 1 ' + p1[0].toFixed(2) + ' ' + p1[1].toFixed(2);
  }

  function zoneOf(d, opts) {
    if (!d.zone || opts.scoringOff) return null;
    var Z = opts.zone || root.PU.ZONE || (root.PU.engine && root.PU.engine.ZONE);
    return Z && Z[d.zone] ? Z[d.zone] : null;
  }

  function inZone(record, d, band) {
    if (record.inZone && d.zone in record.inZone) return !!record.inZone[d.zone];
    var v = record[d.field];
    return v >= band[0] && v <= band[1];
  }

  function change(cur, prev, d) {
    if (prev == null) return { text: 'Starting point', arrow: '', dir: 'none', speak: 'Starting point.' };
    var diff = round1(cur - prev);
    if (diff === 0) return { text: 'No change since last round', arrow: '', dir: 'flat', speak: 'No change since last round.' };
    var up = diff > 0;
    var amt = Math.abs(diff).toFixed(1);
    return {
      text: amt + ' since last round',
      arrow: up ? '▲' : '▼',
      dir: up ? 'up' : 'down',
      speak: (up ? 'Up ' : 'Down ') + amt + (d.pct ? ' points' : '') + ' since last round.'
    };
  }

  // The optimal path's record for this round, from a record or a benchmark entry.
  function optRecord(o, record, slot) {
    if (!o) return null;
    if (o[slot] && o[slot].history) o = o[slot];
    if (o.history && o.history.length) o = o.history[record.round];
    return o && typeof o === 'object' ? o : null;
  }

  // A diamond centered at (x, y) with half-diagonal h.
  function diamond(x, y, h) {
    return 'M' + x.toFixed(2) + ' ' + (y - h).toFixed(2) + ' L' + (x + h).toFixed(2) + ' ' + y.toFixed(2) +
      ' L' + x.toFixed(2) + ' ' + (y + h).toFixed(2) + ' L' + (x - h).toFixed(2) + ' ' + y.toFixed(2) + ' Z';
  }

  // The no-policy comparison for one dial, or null when there is none.
  function npOf(d, np) {
    if (!np || typeof np[d.field] !== 'number' || !isFinite(np[d.field])) return null;
    return np[d.field];
  }

  function dial(d, record, prev, np, opt, opts) {
    var s = root.PU.SCALES[d.key];
    var v = record[d.field];
    var t = frac(v, s);
    var clamped = t < 0 || t > 1;
    var tc = Math.max(0, Math.min(1, t));
    var mark = s.mark != null ? s.mark : d.mark;
    var markText = s.mark != null ? String(s.mark) : d.markText;
    var band = zoneOf(d, opts);
    var good = band ? inZone(record, d, band) : null;
    var ch = change(v, prev ? prev[d.field] : null, d);
    var nv = npOf(d, np);
    var same = nv != null && Math.abs(nv - v) < 0.05;
    var ov = npOf(d, opt);
    var onOpt = ov != null && Math.abs(ov - v) < 0.05;

    var card = html('figure', 'pu-gauge pu-gauge-' + d.key);
    card.setAttribute('data-tip', d.tip);
    card.setAttribute('tabindex', '0');
    if (good != null) card.classList.add(good ? 'pu-in-zone' : 'pu-out-zone');

    html('div', 'pu-gauge-label', s.label, card).setAttribute('aria-hidden', 'true');

    var zoneSpeak = band ? (good ? ', in the green zone' : ', outside the green zone') +
      ' of ' + band[0] + ' to ' + band[1] + ' percent' : '';
    var svg = el('svg', {
      viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'class': 'pu-dial',
      'aria-label': s.label + ' ' + speakNum(v, d) + zoneSpeak +
        (d.markSpeak ? ', ' + d.markSpeak : '') +
        (clamped ? ', beyond the end of the dial' : '') + '. ' + ch.speak +
        (nv == null ? '' : same ? ' Same as with no policy.' : ' With no policy: ' + speakNum(nv, d) + '.') +
        (ov == null ? '' : onOpt ? ' On the optimal path.' : ' Optimal path: ' + speakNum(ov, d) + '.')
    });
    card.appendChild(svg);

    // Track and green zone.
    el('path', { d: arcPath(0, 1, R), 'class': 'pu-dial-track', 'stroke-width': TRACK }, svg);
    if (band) {
      // Pale fill with a darker edge: the edge is what reaches 3:1.
      el('path', {
        d: bandPath(frac(band[0], s), frac(band[1], s), R - TRACK / 2 - 2, R + TRACK / 2 + 2),
        'class': 'pu-dial-band', 'data-tip': 'greenZone'
      }, svg);
    }
    // Natural rate or target mark, with a wider invisible line to hover.
    if (mark != null) {
      var m0 = pt(frac(mark, s), R - TRACK / 2 - 3), m1 = pt(frac(mark, s), R + TRACK / 2 + 4);
      var mg = el('g', d.markTip ? { 'data-tip': d.markTip } : {}, svg);
      el('line', { x1: m0[0], y1: m0[1], x2: m1[0], y2: m1[1], 'class': 'pu-dial-mark' }, mg);
      if (d.markTip) {
        el('line', { x1: m0[0], y1: m0[1], x2: m1[0], y2: m1[1], 'class': 'pu-hit', 'stroke-width': 12 }, mg);
      }
      var ml = pt(frac(mark, s), R + TRACK / 2 + 7);
      var mt = el('text', {
        x: ml[0].toFixed(1), y: (ml[1] - 1).toFixed(1), 'class': 'pu-dial-marklabel',
        'text-anchor': ml[0] < CX - 4 ? 'end' : (ml[0] > CX + 4 ? 'start' : 'middle')
      }, mg);
      mt.textContent = markText + (d.pct ? '%' : '');
    }
    // End labels under the ends of the arc.
    var lo = el('text', { x: CX - R, y: CY + 16, 'class': 'pu-dial-end', 'text-anchor': 'middle' }, svg);
    lo.textContent = (s.min < 0 ? '−' + Math.abs(s.min) : s.min);
    var hi = el('text', { x: CX + R, y: CY + 16, 'class': 'pu-dial-end', 'text-anchor': 'middle' }, svg);
    hi.textContent = s.max;

    // No-policy needle: dashed, under the real one, with a wide hover target.
    if (nv != null && !same) {
      var nt = Math.max(0, Math.min(1, frac(nv, s)));
      var ntip = pt(nt, R - 2);
      var ng = el('g', { 'class': 'pu-dial-np', 'data-tip': 'noPolicy' }, svg);
      el('line', { x1: CX, y1: CY, x2: ntip[0].toFixed(2), y2: ntip[1].toFixed(2), 'class': 'pu-hit', 'stroke-width': 12 }, ng);
      el('line', { x1: CX, y1: CY, x2: ntip[0].toFixed(2), y2: ntip[1].toFixed(2), 'class': 'pu-dial-np-needle' }, ng);
      el('circle', { cx: ntip[0].toFixed(2), cy: ntip[1].toFixed(2), r: 4.5, 'class': 'pu-dial-np-end' }, ng);
    }

    // Needle.
    var tip = pt(tc, R - 2);
    el('line', {
      x1: CX, y1: CY, x2: tip[0].toFixed(2), y2: tip[1].toFixed(2),
      'class': 'pu-dial-needle'
    }, svg);
    el('circle', { cx: CX, cy: CY, r: 6, 'class': 'pu-dial-hub' }, svg);

    // Optimal path: a small diamond on the arc, over the needle so it stays
    // whole when the two are close, with a wider hover target.
    if (ov != null && !onOpt) {
      var ot = Math.max(0, Math.min(1, frac(ov, s)));
      var op = pt(ot, R);
      var og = el('g', { 'class': 'pu-dial-opt', 'data-tip': 'optimalPath' }, svg);
      el('circle', { cx: op[0].toFixed(2), cy: op[1].toFixed(2), r: 12, 'class': 'pu-hit-fill' }, og);
      el('path', { d: diamond(op[0], op[1], 7.5), 'class': 'pu-dial-opt-mark' }, og);
    }

    // Caption: value, zone in words, change. Screen readers get the SVG label.
    var cap = html('figcaption', 'pu-gauge-cap', null, card);
    cap.setAttribute('aria-hidden', 'true');
    html('span', 'pu-gauge-value', fmt(v, d), cap);
    if (band) {
      var z = html('span', 'pu-gauge-zone ' + (good ? 'pu-zone-in' : 'pu-zone-out'), null, cap);
      z.setAttribute('data-tip', 'greenZone');
      html('span', 'pu-zone-mark', good ? '✓' : '✗', z);
      html('span', null, good ? 'In the green zone' : 'Outside the green zone', z);
    }
    if (clamped) html('span', 'pu-gauge-off', 'Beyond the dial', cap);
    var c = html('span', 'pu-gauge-change pu-change-' + ch.dir, null, cap);
    c.setAttribute('data-tip', 'change');
    if (ch.arrow) html('span', 'pu-change-arrow', ch.arrow, c);
    html('span', null, ch.text, c);
    // Comparisons share one row that wraps when the card is narrow.
    var cmp = nv != null || ov != null ? html('span', 'pu-gauge-cmp', null, cap) : null;
    if (nv != null) {
      var npl = html('span', 'pu-gauge-np' + (same ? ' pu-gauge-np-same' : ''), null, cmp);
      npl.setAttribute('data-tip', 'noPolicy');
      if (!same) html('span', 'pu-np-swatch', null, npl);
      html('span', null, same ? 'Same as no policy' : 'No policy: ' + fmt(nv, d), npl);
    }
    if (ov != null) {
      var opl = html('span', 'pu-gauge-opt' + (onOpt ? ' pu-gauge-opt-on' : ''), null, cmp);
      opl.setAttribute('data-tip', 'optimalPath');
      if (!onOpt) html('span', 'pu-opt-swatch', null, opl);
      html('span', null, onOpt ? 'On the optimal path' : 'Optimal: ' + fmt(ov, d), opl);
    }
    return card;
  }

  // The dial scales with its card, and SVG text scales with it. Below the
  // natural width W the text would drop under 13px, so each dial carries
  // --dial-k = W / its width, and dashboard.css grows the text by it.
  var sizer = null;
  function watch(svg) {
    if (typeof ResizeObserver === 'undefined') return;
    if (!sizer) {
      sizer = new ResizeObserver(function (entries) {
        for (var i = 0; i < entries.length; i++) {
          var w = entries[i].contentRect.width;
          if (w > 0) entries[i].target.style.setProperty('--dial-k', (W / w).toFixed(3));
        }
      });
    }
    sizer.observe(svg);
  }

  function render(host, record, opts) {
    opts = opts || {};
    host.innerHTML = '';
    if (!record) return;
    var fields = opts.fields && opts.fields.length ? opts.fields : DEFAULT_FIELDS;
    var slot = slotOf(opts);
    var opt = optRecord(opts.optimal, record, slot);
    var wrap = html('div', 'pu-gauges', null, host);
    wrap.setAttribute('data-slot', slot);
    var grid = html('div', 'pu-gauge-grid', null, wrap);
    grid.style.setProperty('--n', String(fields.length));
    for (var i = 0; i < fields.length; i++) {
      var d = DIALS[fields[i]];
      if (d) grid.appendChild(dial(d, record, opts.prev || null, opts.noPolicy || null, opt, opts));
    }
    var dials = grid.querySelectorAll('.pu-dial');
    for (var j = 0; j < dials.length; j++) watch(dials[j]);
  }

  root.PU = root.PU || {};
  root.PU.gauges = { render: render, slotOf: slotOf, FIELDS: DEFAULT_FIELDS.slice() };
})(typeof window !== 'undefined' ? window : globalThis);
