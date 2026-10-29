/*
 * Macro Control Room: charts over time.
 *
 * PU.charts.render(el, game, opts) draws:
 *   - a short text legend,
 *   - four small multiples by round (real GDP with potential, unemployment,
 *     inflation, price level), both universes on each chart,
 *   - a Phillips curve trace (inflation against unemployment, one point per round).
 * opts: { names: {a, b}, only: 'series' | 'phillips', zone, scoringOff,
 *   showRealRate }. opts.colors may be
 *   passed but is not used: every color comes from tokens.css through CSS
 *   classes and data-slot="a|b", so a theme change restyles with no redraw.
 *   only 'series': the four line charts. only 'phillips': the Phillips trace
 *   alone, larger. Anything else: both.
 *   zone: {unemployment: [lo, hi], inflation: [lo, hi]} (falls back to the
 *   game's scoring zone, then PU.ZONE). scoringOff: no green zone anywhere
 *   (falls back to game.scoring.on === false). showRealRate: adds an
 *   "Interest rates" chart (real rate solid with markers, nominal rate in
 *   effect dash-dot, neutral real rate as a reference line).
 *
 * Games may have one universe (game.keys = ['a']) or two; everything follows
 * game.keys. The unemployment, inflation and price level axes (and the
 * Phillips trace) start from the fixed PU.SCALES ranges and widen, with nice
 * ticks, to take in every played and no-policy value; they never shrink.
 *
 * Each universe's no-policy path (game.noPolicy(k): same event, no choices,
 * no autopilot) is a long-dashed line in the universe color under the played
 * line, on the four line charts and the Phillips trace. Potential GDP is a
 * gray dotted line so the two patterns never look alike.
 *
 * opts.optimal: { a: {history, plan}, b: {...} } or null. When given, each
 * universe's optimal path (perfect foresight, rounds 0..game.rounds; the tail
 * is ignored) is a dash-dot line with hollow diamonds in the universe color,
 * under the played line, on the four line charts and the Phillips trace, with
 * a legend entry and its values in the axis ranges. Null: nothing shows.
 *
 * The green zone (PU.ZONE) is a faint band on the unemployment and inflation
 * charts and a box on the Phillips trace. Under each line chart a small strip
 * marks, per universe, the rounds where fiscal (F) or monetary (M) policy took
 * effect. Every explained element carries data-tip (keys in PU.TIPS) and every
 * data point carries data-tip-text with its values; tips.js shows them.
 *
 * Hand-drawn SVG. Each chart's viewBox width follows the width of its grid
 * cell so text stays readable on a phone and on a projector; the charts are
 * redrawn when the window is resized. Every call redraws from scratch.
 */
(function (root) {
  'use strict';
  root.PU = root.PU || {};

  var WRAP_CLASS = 'pu-charts';
  var NS_GAP = 16;          // grid gap, must match charts.css
  var registered = [];      // elements to redraw on resize

  // ---------- small helpers ----------

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  // One decimal, with a true minus sign and no "-0.0".
  function f1(v) {
    var s = (Math.round(v * 10) / 10).toFixed(1);
    if (s === '-0.0') s = '0.0';
    return s.charAt(0) === '-' ? '−' + s.slice(1) : s;
  }
  function whole(v) { return Math.round(v).toLocaleString('en-US'); }
  function pctTick(v) { return (v < 0 ? '−' + Math.abs(v) : String(v)) + '%'; }

  function zone() {
    return root.PU.ZONE || (root.PU.engine && root.PU.engine.ZONE) || { unemployment: [4.5, 5.5], inflation: [1, 3] };
  }

  // "Keynesian" -> "Keynesian universe"; "Universe A" stays as it is.
  function uName(name) { return /universe/i.test(name) ? name : name + ' universe'; }
  function roundName(r) { return r === 0 ? 'Start' : 'Round ' + r; }

  // Clip a little outside the plot so markers at the edges show in full.
  function clipDef(id, x, y, w, h) {
    var pad = 9;
    return '<defs><clipPath id="' + id + '"><rect x="' + (x - pad) + '" y="' + (y - pad) + '" width="' + (w + 2 * pad) +
      '" height="' + (h + 2 * pad) + '"/></clipPath></defs>';
  }

  // How many sampled points of the polylines fall inside a box (padded).
  function collisions(lines, x0, x1, y0, y1) {
    var hits = 0, pad = 4;
    for (var l = 0; l < lines.length; l++) {
      var L = lines[l];
      for (var x = x0; x <= x1; x += 2) {
        for (var j = 0; j < L.length; j++) {
          var a = L[j], b = L[j + 1] || L[j];
          var ax = Math.min(a[0], b[0]) - 5, bx = Math.max(a[0], b[0]) + 5;
          if (x < ax || x > bx) continue;
          var t = b[0] === a[0] ? 0 : Math.max(0, Math.min(1, (x - a[0]) / (b[0] - a[0])));
          var y = a[1] + t * (b[1] - a[1]);
          if (y >= y0 - pad && y <= y1 + pad) { hits++; break; }
        }
      }
    }
    return hits;
  }

  // Nice tick step for a span and a target count.
  function niceStep(span, target) {
    var raw = span / Math.max(1, target);
    var mag = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10));
    var steps = [1, 2, 2.5, 5, 10];
    for (var i = 0; i < steps.length; i++) {
      if (steps[i] * mag >= raw) return steps[i] * mag;
    }
    return 10 * mag;
  }

  function ticks(lo, hi, step) {
    var out = [];
    var start = Math.ceil(lo / step - 1e-9) * step;
    for (var v = start; v <= hi + 1e-9; v += step) out.push(Math.round(v * 1000) / 1000);
    return out;
  }

  function approxTextWidth(s, size) { return String(s).length * size * 0.56; }

  function setup(game, opts) {
    opts = opts || {};
    var keys = game.keys;
    var names = {};
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      names[k] = (opts.names && opts.names[k]) || ('Universe ' + k.toUpperCase());
    }
    var scoringOff = opts.scoringOff != null ? !!opts.scoringOff : !!(game.scoring && game.scoring.on === false);
    // Optimal paths, cut to rounds 0..game.rounds (the tail is not drawn).
    var optimal = null;
    if (opts.optimal) {
      for (i = 0; i < keys.length; i++) {
        var o = opts.optimal[keys[i]];
        if (o && o.history && o.history.length) {
          optimal = optimal || {};
          optimal[keys[i]] = o.history.slice(0, game.rounds + 1);
        }
      }
    }
    return {
      keys: keys, names: names,
      zone: opts.zone || (game.scoring && game.scoring.zone) || zone(),
      scoringOff: scoringOff,
      showRealRate: !!opts.showRealRate,
      optimal: optimal
    };
  }

  // The optimal path for universe k (rounds 0..game.rounds), or null.
  function optimalOf(cfg, k) { return (cfg && cfg.optimal && cfg.optimal[k]) || null; }

  // Every value of the given fields, played and no-policy (and optimal, when
  // cfg carries it), in every universe.
  function valuesOf(game, fields, withNoPolicy, cfg) {
    var out = [];
    for (var u = 0; u < game.keys.length; u++) {
      var srcs = [game.universes[game.keys[u]].history];
      if (withNoPolicy) { var nh = noPolicyOf(game, game.keys[u]); if (nh) srcs.push(nh); }
      var oh = optimalOf(cfg, game.keys[u]);
      if (oh) srcs.push(oh);
      for (var s = 0; s < srcs.length; s++) {
        for (var i = 0; i < srcs[s].length; i++) {
          for (var f = 0; f < fields.length; f++) {
            var v = srcs[s][i][fields[f]];
            if (typeof v === 'number' && isFinite(v)) out.push(v);
          }
        }
      }
    }
    return out;
  }

  // A fixed range {min, max} with its tick step, widened to take in every
  // value. Unchanged when every value fits; otherwise a nice step for about
  // the same number of ticks, with the ends on that step. Never narrower
  // than the fixed range.
  function expandRange(base, step, values) {
    var lo = base.min, hi = base.max;
    for (var i = 0; i < values.length; i++) { lo = Math.min(lo, values[i]); hi = Math.max(hi, values[i]); }
    if (lo >= base.min && hi <= base.max) return { min: base.min, max: base.max, ticks: ticks(base.min, base.max, step) };
    var st = Math.max(step, niceStep(hi - lo, (base.max - base.min) / step));
    var nlo = Math.floor(lo / st + 1e-9) * st, nhi = Math.ceil(hi / st - 1e-9) * st;
    if (nlo > base.min) nlo = base.min;
    if (nhi < base.max) nhi = base.max;
    return { min: nlo, max: nhi, ticks: ticks(nlo, nhi, st) };
  }

  // The no-policy path for universe k (game.noPolicy), cut to the played
  // length, or null when the game has none.
  function noPolicyOf(game, k) {
    if (!game || typeof game.noPolicy !== 'function') return null;
    var nh = game.noPolicy(k);
    if (!nh || !nh.length) return null;
    var n = game.universes[k].history.length;
    return nh.length > n ? nh.slice(0, n) : nh;
  }
  function hasNoPolicy(game) { return !!noPolicyOf(game, game.keys[0]); }

  // An invisible hover target on a no-policy point. It goes in the hit layer
  // before the played points, so a played marker wins where they overlap.
  function noPolicyHit(x, y, tipText) {
    return '<circle class="pu-pt-hit pu-np-hit" data-tip-text="' + esc(tipText) + '" cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) +
      '" r="8" fill="none" pointer-events="all"/>';
  }

  // A hollow diamond (an optimal-path point): unlike the played markers
  // (circle, square), so the shape tells the paths apart as well as the dashes.
  function diamond(x, y, r) {
    return '<polygon class="pu-opt-mk" points="' + x.toFixed(1) + ',' + (y - r).toFixed(1) + ' ' + (x + r).toFixed(1) + ',' + y.toFixed(1) + ' ' +
      x.toFixed(1) + ',' + (y + r).toFixed(1) + ' ' + (x - r).toFixed(1) + ',' + y.toFixed(1) + '"/>';
  }
  function optimalHit(x, y, tipText) {
    return '<circle class="pu-pt-hit pu-opt-hit" data-tip-text="' + esc(tipText) + '" cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) +
      '" r="8" fill="none" pointer-events="all"/>';
  }
  // The optimal path drawn from screen points [[x, y], ...] (index = round):
  // a dash-dot line, diamonds from round 2 (rounds 0 and 1 are the played
  // ones), and hover targets pushed onto hits. tipOf(i) gives a point's text.
  function optimalPath(u, xy, hits, tipOf) {
    var pts = xy.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ');
    var mk = '';
    for (var i = 2; i < xy.length; i++) {
      mk += diamond(xy[i][0], xy[i][1], 4.5);
      hits.push(optimalHit(xy[i][0], xy[i][1], tipOf(i)));
    }
    return '<g class="pu-opt" data-tip="optimalPath" data-slot="' + slotOf(u) + '"><polyline class="pu-hit" points="' + pts + '"/>' +
      '<polyline class="pu-optimal" points="' + pts + '"/>' + mk + '</g>';
  }

  // Tip key for a universe slot: universeA, universeB.
  function uTip(k) { return 'universe' + String(k).toUpperCase(); }

  // Slot key ('a'|'b') of the u-th universe; colors come from the slot.
  function slotOf(u) { return u === 0 ? 'a' : 'b'; }

  // Marker shape per universe slot so color is not the only signal: A a
  // circle, B a square. cls picks the paint (pu-mk, pu-mk is-latest, pu-mk-solid).
  function marker(idx, x, y, r, cls, extra) {
    extra = extra || '';
    var a = ' class="' + cls + (idx % 2 === 1 ? ' pu-mk-b' : '') + '" data-slot="' + slotOf(idx % 2) + '"' + extra;
    if (idx % 2 === 1) {
      var s = r * 1.8;
      return '<rect x="' + (x - s / 2).toFixed(1) + '" y="' + (y - s / 2).toFixed(1) + '" width="' + s.toFixed(1) +
        '" height="' + s.toFixed(1) + '"' + a + '/>';
    }
    return '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + r + '"' + a + '/>';
  }

  // A data point: universe A a large circle, universe B a small square drawn
  // on top, so a point both share shows a square inside a circle. The latest
  // round is filled.
  function pointMarker(u, x, y, latest) {
    var cls = 'pu-mk' + (latest ? ' is-latest' : '');
    if (u === 0) return marker(0, x, y, latest ? 6 : 4, cls, ' stroke-width="2"');
    return marker(1, x, y, latest ? 4.2 : 2.6, cls, ' stroke-width="' + (latest ? 1.2 : 1.8) + '"');
  }

  // A point with a hover target a little larger than the marker. Returns
  // { hit, mark }: every hit area goes in a layer under every marker, so a
  // visible marker always wins over a neighbour's invisible hit area.
  function hoverPoint(u, x, y, latest, tipText) {
    var t = ' data-tip-text="' + esc(tipText) + '"';
    return {
      hit: '<circle class="pu-pt-hit"' + t + ' cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="8" fill="none" pointer-events="all"/>',
      mark: '<g class="pu-pt"' + t + '>' + pointMarker(u, x, y, latest) + '</g>'
    };
  }
  function layers(list) {
    return list.map(function (p) { return p.hit; }).join('') + list.map(function (p) { return p.mark; }).join('');
  }

  // A thin line made easy to hover: an invisible wide stroke under it.
  function hoverLine(x1, y1, x2, y2, cls, tip) {
    var c = 'x1="' + x1.toFixed(1) + '" x2="' + x2.toFixed(1) + '" y1="' + y1.toFixed(1) + '" y2="' + y2.toFixed(1) + '"';
    return '<g data-tip="' + tip + '"><line ' + c + ' class="pu-hit"/><line ' + c + ' class="' + cls + '"/></g>';
  }

  // An F, M or FM tag centred at (x, y): rounded for universe A, square for
  // universe B. Text is 13px, the smallest size the app uses.
  var TAG_H = 17, TAG_FONT = 13;
  function tagWidth(letters) { return Math.max(TAG_H, letters.length * 9 + 6); }
  function tag(u, x, y, letters) {
    var w = tagWidth(letters), rx = u === 0 ? TAG_H / 2 : 2;
    return '<g data-slot="' + slotOf(u) + '"><rect class="pu-tag-box" x="' + (x - w / 2).toFixed(1) + '" y="' + (y - TAG_H / 2).toFixed(1) +
      '" width="' + w.toFixed(1) + '" height="' + TAG_H + '" rx="' + rx.toFixed(1) + '"/>' +
      '<text class="pu-tag-text" x="' + x.toFixed(1) + '" y="' + (y + TAG_FONT * 0.36).toFixed(1) + '" text-anchor="middle" font-size="' +
      TAG_FONT + '">' + letters + '</text></g>';
  }

  var uid = 0;

  // The shock that hit in a round, as { round, key, label, tip }.
  function shockList(game, cfg) {
    var h = game.universes[cfg.keys[0]].history;
    var S = (root.PU.engine && root.PU.engine.SHOCKS) || {};
    var out = [];
    for (var i = 1; i < h.length; i++) {
      var sk = h[i].shock;
      if (!sk || sk === 'none') continue;
      var info = S[sk] || {};
      out.push({
        round: h[i].round, key: sk, label: info.label || sk,
        // One event at the start uses the shared "event" tip; a shock in the
        // other modes says what it does.
        tipAttr: game.shockMode === 'event' ? 'data-tip="event"'
          : 'data-tip-text="' + esc(roundName(h[i].round) + ': ' + (info.label || sk) + '. ' + (info.what || '')) + '"'
      });
    }
    return out;
  }

  // ---------- one time-series chart ----------
  // spec: { title, field, potential (bool), range {min,max}, ticks [], fmt(v),
  //         ref {value, label, tip}, zone [lo, hi], tipFmt(rec) }
  function seriesChart(game, cfg, spec, width) {
    var keys = cfg.keys;
    var R = game.rounds;
    var tickSize = 13, labelSize = 13;
    var shocks = shockList(game, cfg);

    var m = { left: 58, right: 12, top: 8, bottom: 0 };
    var plotW = width - m.left - m.right;
    var xOf = function (r) { return m.left + (r / R) * plotW; };

    // Shock labels above the plot, in rows so they never overlap.
    var rowsEnd = [], i;
    for (i = 0; i < shocks.length; i++) {
      var w = approxTextWidth(shocks[i].label, labelSize);
      var cx = xOf(shocks[i].round);
      var x0 = Math.max(m.left, Math.min(cx - w / 2, width - m.right - w));
      var row = 0;
      while (row < rowsEnd.length && rowsEnd[row] > x0 - 6) row++;
      rowsEnd[row] = x0 + w;
      shocks[i].row = row; shocks[i].x0 = x0; shocks[i].w = w;
    }
    m.top = 8 + rowsEnd.length * (labelSize + 4);

    // Below the plot: round numbers, then one strip row per universe for the
    // F and M tags. Rows are always reserved so the layout does not jump.
    var stripRow = 20;
    m.bottom = 22 + keys.length * stripRow + 4;
    var plotH = Math.round(Math.max(130, Math.min(200, width * 0.36)));
    var H = m.top + plotH + m.bottom;
    var lo = spec.range.min, hi = spec.range.max;
    var yOf = function (v) { return m.top + (1 - (v - lo) / (hi - lo)) * plotH; };

    var id = 'puc' + (++uid);
    var parts = [clipDef(id, m.left, m.top, plotW, plotH)];

    // Green zone band, with its edges drawn so it reads without the fill.
    if (spec.zone) {
      var zy0 = yOf(spec.zone[1]), zy1 = yOf(spec.zone[0]);
      parts.push('<g data-tip="greenZone"><rect class="pu-zone" x="' + m.left + '" y="' + zy0.toFixed(1) + '" width="' + plotW.toFixed(1) +
        '" height="' + (zy1 - zy0).toFixed(1) + '"/>' +
        '<line class="pu-zone-edge" x1="' + m.left + '" x2="' + (m.left + plotW).toFixed(1) + '" y1="' + zy0.toFixed(1) + '" y2="' + zy0.toFixed(1) + '"/>' +
        '<line class="pu-zone-edge" x1="' + m.left + '" x2="' + (m.left + plotW).toFixed(1) + '" y1="' + zy1.toFixed(1) + '" y2="' + zy1.toFixed(1) + '"/></g>');
    }

    // Shock bands and labels.
    var band = Math.max(4, plotW / R * 0.7);
    for (i = 0; i < shocks.length; i++) {
      var bx = xOf(shocks[i].round) - band / 2;
      var ly = 8 + shocks[i].row * (labelSize + 4) + labelSize - 2;
      parts.push('<g ' + shocks[i].tipAttr + '><rect class="pu-shock-band" x="' + bx.toFixed(1) + '" y="' + m.top + '" width="' +
        band.toFixed(1) + '" height="' + plotH + '"/><text class="pu-shock-label" x="' + (shocks[i].x0 + shocks[i].w / 2).toFixed(1) +
        '" y="' + ly + '" text-anchor="middle" font-size="' + labelSize + '">' + esc(shocks[i].label) + '</text></g>');
    }

    // Light grid and y ticks.
    for (i = 0; i < spec.ticks.length; i++) {
      var ty = yOf(spec.ticks[i]);
      parts.push('<line class="pu-grid" x1="' + m.left + '" x2="' + (m.left + plotW) + '" y1="' + ty.toFixed(1) +
        '" y2="' + ty.toFixed(1) + '"/>');
      // The bottom label sits a little higher so it clears "Round" below it.
      var tyText = ty > m.top + plotH - 2 ? ty : ty + 4;
      parts.push('<text class="pu-tick" x="' + (m.left - 6) + '" y="' + tyText.toFixed(1) +
        '" text-anchor="end" font-size="' + tickSize + '">' + esc(spec.fmt(spec.ticks[i])) + '</text>');
    }

    // X axis: round numbers, with "Round" in the left margin.
    var axisY = m.top + plotH;
    parts.push('<line class="pu-axis" x1="' + m.left + '" x2="' + (m.left + plotW) + '" y1="' + axisY + '" y2="' + axisY + '"/>');
    var every = plotW / R < 22 ? 2 : 1;
    for (var r = 0; r <= R; r += every) {
      parts.push('<text class="pu-tick" x="' + xOf(r).toFixed(1) + '" y="' + (axisY + 16) +
        '" text-anchor="middle" font-size="' + tickSize + '">' + r + '</text>');
    }
    parts.push('<text class="pu-axis-title" x="' + (m.left - 6) + '" y="' + (axisY + 17) + '" text-anchor="end" font-size="' +
      tickSize + '" data-tip="round">Round</text>');

    // Reference line (its label is placed after the data, away from it).
    var ry = null;
    if (spec.ref) {
      ry = yOf(spec.ref.value);
      parts.push(hoverLine(m.left, ry, m.left + plotW, ry, 'pu-ref', spec.ref.tip));
    }

    var body = [], screen = [];
    // Potential GDP: the same in both universes (same shocks, same choices),
    // so one dotted line (long dashes are the no-policy paths).
    if (spec.potential) {
      var h0 = game.universes[keys[0]].history, pp = [], ps = [];
      for (i = 0; i < h0.length; i++) {
        ps.push([xOf(h0[i].round), yOf(h0[i].potential)]);
        pp.push(xOf(h0[i].round).toFixed(1) + ',' + yOf(h0[i].potential).toFixed(1));
      }
      screen.push(ps);
      if (h0.length > 1) {
        body.push('<g data-tip="potentialGdp"><polyline class="pu-hit" points="' + pp.join(' ') + '"/>' +
          '<polyline class="pu-potential" points="' + pp.join(' ') + '"/></g>');
      } else {
        body.push('<g data-tip="potentialGdp"><line class="pu-hit" x1="' + m.left + '" x2="' + (m.left + 24) + '" y1="' + ps[0][1].toFixed(1) +
          '" y2="' + ps[0][1].toFixed(1) + '"/><line class="pu-potential" x1="' + m.left + '" x2="' + (m.left + 24) + '" y1="' +
          ps[0][1].toFixed(1) + '" y2="' + ps[0][1].toFixed(1) + '"/></g>');
      }
    }

    // No-policy paths: long dashes in the universe color, under the played
    // lines. Their hover targets sit under every played point.
    var npHits = [], npLast = [];
    for (var u = 0; u < keys.length; u++) {
      var nk = keys[u], nh = spec.noNoPolicy ? null : noPolicyOf(game, nk);
      if (!nh) continue;
      var nps = [], nxy = [];
      for (i = 0; i < nh.length; i++) {
        var nx = xOf(nh[i].round), ny = yOf(nh[i][spec.field]);
        nps.push([nx, ny]);
        nxy.push(nx.toFixed(1) + ',' + ny.toFixed(1));
        if (i > 0) npHits.push(noPolicyHit(nx, ny, roundName(nh[i].round) + ', ' + uName(cfg.names[nk]) + ', no policy: ' + spec.tipFmt(nh[i])));
      }
      screen.push(nps);
      if (nh.length > 1) {
        body.push('<g class="pu-np" data-tip="noPolicy" data-slot="' + slotOf(u) + '"><polyline class="pu-hit" points="' + nxy.join(' ') + '"/>' +
          '<polyline class="pu-nopolicy" points="' + nxy.join(' ') + '"/></g>');
      }
      npLast.push(cfg.names[nk] + ' ' + spec.tipFmt(nh[nh.length - 1]));
    }

    // Optimal paths: dash-dot with diamonds in the universe color, over the
    // no-policy paths and under the played lines.
    var optLast = [];
    for (u = 0; u < keys.length; u++) {
      var ok = keys[u], oh = spec.noNoPolicy ? null : optimalOf(cfg, ok);
      if (!oh || oh.length < 2) continue;
      var oxy = [];
      for (i = 0; i < oh.length; i++) oxy.push([xOf(oh[i].round), yOf(oh[i][spec.field])]);
      screen.push(oxy);
      body.push(optimalPath(u, oxy, npHits, (function (oh2, nm) {
        return function (j) { return roundName(oh2[j].round) + ', ' + uName(nm) + ', optimal path: ' + spec.tipFmt(oh2[j]); };
      })(oh, cfg.names[ok])));
      optLast.push(cfg.names[ok] + ' round ' + oh[oh.length - 1].round + ' ' + spec.tipFmt(oh[oh.length - 1]));
    }

    // Lines, then points, so every point sits above every line.
    var pointsHtml = [];
    for (u = 0; u < keys.length; u++) {
      var k = keys[u], h = game.universes[k].history;
      // Second series per universe (the nominal rate): a dash-dot line under
      // the main one, with hover targets in the hit layer and no markers.
      var alt = spec.alt || [];
      for (var a = 0; a < alt.length; a++) {
        var as = [], axy = [];
        for (i = 0; i < h.length; i++) {
          var ax = xOf(h[i].round), ay = yOf(h[i][alt[a].field]);
          as.push([ax, ay]);
          axy.push(ax.toFixed(1) + ',' + ay.toFixed(1));
          npHits.push(noPolicyHit(ax, ay, roundName(h[i].round) + ', ' + uName(cfg.names[k]) + ': ' + spec.tipFmt(h[i])));
        }
        screen.push(as);
        if (h.length > 1) {
          body.push('<g data-tip="' + alt[a].tip + '" data-slot="' + slotOf(u) + '"><polyline class="pu-hit" points="' + axy.join(' ') + '"/>' +
            '<polyline class="' + alt[a].cls + '" points="' + axy.join(' ') + '" style="stroke-width:' + (u === 0 ? 3 : 2.5) + 'px"/></g>');
        } else {
          body.push('<g data-tip="' + alt[a].tip + '" data-slot="' + slotOf(u) + '"><line class="' + alt[a].cls + '" x1="' + (as[0][0]).toFixed(1) +
            '" x2="' + (as[0][0] + 24).toFixed(1) + '" y1="' + as[0][1].toFixed(1) + '" y2="' + as[0][1].toFixed(1) + '" style="stroke-width:3px"/></g>');
        }
      }
      var pts = [], ss = [];
      for (i = 0; i < h.length; i++) {
        ss.push([xOf(h[i].round), yOf(h[i][spec.field])]);
        pts.push(xOf(h[i].round).toFixed(1) + ',' + yOf(h[i][spec.field]).toFixed(1));
      }
      screen.push(ss);
      // Universe A is drawn wide underneath and B narrow on top, so where the
      // two paths are the same both stay visible.
      if (h.length > 1) {
        body.push('<g data-tip="' + (spec.lineTip || uTip(k)) + '" data-slot="' + slotOf(u) + '"><polyline class="pu-hit" points="' + pts.join(' ') + '"/>' +
          '<polyline class="pu-line" points="' + pts.join(' ') + '" style="stroke-width:' +
          (u === 0 ? 4 : 2) + 'px"/></g>');
      }
      for (i = 0; i < h.length; i++) {
        var px = ss[i][0], py = ss[i][1];
        var tip = roundName(h[i].round) + ', ' + uName(cfg.names[k]) + ': ' + spec.tipFmt(h[i]);
        // B drawn over A at the same spot: one tip naming both.
        if (u > 0) {
          var ha = game.universes[keys[0]].history[i];
          if (ha && Math.abs(yOf(ha[spec.field]) - py) < 3) {
            tip = roundName(h[i].round) + ', ' + uName(cfg.names[keys[0]]) + ': ' + spec.tipFmt(ha) + '. ' +
              uName(cfg.names[k]) + ': ' + spec.tipFmt(h[i]);
          }
        }
        pointsHtml.push(hoverPoint(u, px, py, i === h.length - 1, tip));
      }
    }
    parts.push('<g clip-path="url(#' + id + ')">' + body.join('') + npHits.join('') + layers(pointsHtml) + '</g>');

    if (spec.ref) {
      var lw = approxTextWidth(spec.ref.label, labelSize) + 4;
      var cands = [
        { x: m.left + plotW - 4, anchor: 'end', above: true },
        { x: m.left + plotW - 4, anchor: 'end', above: false },
        { x: m.left + 6, anchor: 'start', above: true },
        { x: m.left + 6, anchor: 'start', above: false }
      ];
      var best = cands[0], bestHits = Infinity;
      for (i = 0; i < cands.length; i++) {
        var c = cands[i];
        var bx0 = c.anchor === 'end' ? c.x - lw : c.x, bx1 = bx0 + lw;
        var by0 = c.above ? ry - labelSize - 6 : ry + 3, by1 = c.above ? ry - 2 : ry + labelSize + 6;
        var hits = collisions(screen, bx0, bx1, by0, by1);
        if (hits < bestHits) { best = c; bestHits = hits; }
      }
      var ly2 = best.above ? ry - 5 : ry + labelSize + 3;
      parts.push('<text class="pu-ref-label" data-tip="' + spec.ref.tip + '" x="' + best.x.toFixed(1) + '" y="' + ly2.toFixed(1) +
        '" text-anchor="' + best.anchor + '" font-size="' + labelSize + '">' + esc(spec.ref.label) + '</text>');
    }

    // Policy strip: F and M tags where policy took effect in each universe.
    var arrivedText = [];
    var slot = plotW / R;
    for (u = 0; u < keys.length; u++) {
      k = keys[u]; h = game.universes[k].history;
      var sy = axisY + 22 + u * stripRow + stripRow / 2;
      // Row key in the left margin: the universe's marker shape.
      parts.push('<g data-tip="' + uTip(k) + '">' + marker(u, m.left - 12, sy, 3.5, 'pu-mk-solid') + '</g>');
      var got = [];
      for (i = 1; i < h.length; i++) {
        var f = h[i].fiscalArrived, mo = h[i].monetaryArrived;
        if (!f && !mo) continue;
        var x = xOf(h[i].round);
        // Both in one round: one "FM" tag when the two would not fit side by side.
        var g = [];
        if (f && mo && slot >= 2 * TAG_H + 2) {
          g.push(tag(u, x - TAG_H / 2 - 0.5, sy, 'F'));
          g.push(tag(u, x + TAG_H / 2 + 0.5, sy, 'M'));
        } else {
          g.push(tag(u, x, sy, f && mo ? 'FM' : f ? 'F' : 'M'));
        }
        parts.push('<g class="pu-arrived" data-tip="arrived">' + g.join('') + '</g>');
        got.push(h[i].round + (f && mo ? ' (fiscal and monetary)' : f ? ' (fiscal)' : ' (monetary)'));
      }
      if (got.length) arrivedText.push(cfg.names[k] + ' round ' + got.join(', '));
    }

    // aria-label with the latest values.
    var last = game.universes[keys[0]].history.length - 1;
    var bits = [];
    for (u = 0; u < keys.length; u++) {
      bits.push(cfg.names[keys[u]] + ' ' + spec.tipFmt(game.universes[keys[u]].history[last]));
    }
    var aria = spec.title + ' by round, rounds 0 to ' + R + '. ' + (spec.ariaNote ? spec.ariaNote + ' ' : '') +
      roundName(last) + ': ' + bits.join('; ') + '.' +
      (npLast.length ? ' With no policy (dashed lines): ' + npLast.join('; ') + '.' : '') +
      (optLast.length ? ' Optimal path with perfect foresight (dash-dot lines with diamonds): ' + optLast.join('; ') + '.' : '') +
      (spec.ref ? ' Reference line: ' + spec.ref.label + '.' : '') +
      (spec.zone ? ' Green zone ' + spec.zone[0] + '% to ' + spec.zone[1] + '%.' : '') +
      (shocks.length ? ' Event: ' + shocks.map(function (x) { return x.label + ' in round ' + x.round; }).join(', ') + '.' : '') +
      (arrivedText.length ? ' Policy took effect: ' + arrivedText.join('; ') + '.' : '');

    return '<svg role="img" aria-label="' + esc(aria) + '" viewBox="0 0 ' + width + ' ' + H + '" width="100%" ' +
      'preserveAspectRatio="xMidYMid meet" class="pu-svg">' + parts.join('') + '</svg>';
  }

  // ---------- Phillips curve trace ----------
  function phillipsChart(game, cfg, width) {
    var keys = cfg.keys;
    var S0 = root.PU.SCALES, Z = cfg.zone;
    // Axes widen with the data (played and no-policy), never below the fixed scales.
    var RU = expandRange(S0.unemployment, 2, valuesOf(game, ['unemployment'], true, cfg));
    var RI = expandRange(S0.inflation, 5, valuesOf(game, ['inflation'], true, cfg));
    var SU = { min: RU.min, max: RU.max, mark: S0.unemployment.mark }, SI = { min: RI.min, max: RI.max, mark: S0.inflation.mark };
    var H = Math.round(Math.max(260, Math.min(440, width * 0.66)));
    var m = { left: 46, right: 14, top: 12, bottom: 38 };
    var plotW = width - m.left - m.right, plotH = H - m.top - m.bottom;
    var xOf = function (v) { return m.left + (v - SU.min) / (SU.max - SU.min) * plotW; };
    var yOf = function (v) { return m.top + (1 - (v - SI.min) / (SI.max - SI.min)) * plotH; };
    var id = 'puc' + (++uid);
    var p = [clipDef(id, m.left, m.top, plotW, plotH)];
    var i;

    // Green zone box (none when scoring is off).
    if (!cfg.scoringOff) {
      var zx0 = xOf(Z.unemployment[0]), zx1 = xOf(Z.unemployment[1]), zy0 = yOf(Z.inflation[1]), zy1 = yOf(Z.inflation[0]);
      p.push('<rect class="pu-zone pu-zone-box" data-tip="greenZone" x="' + zx0.toFixed(1) + '" y="' + zy0.toFixed(1) + '" width="' +
        (zx1 - zx0).toFixed(1) + '" height="' + (zy1 - zy0).toFixed(1) + '"/>');
    }

    // Light horizontal grid only; ticks on both axes.
    var xt = RU.ticks, yt = RI.ticks;
    for (i = 0; i < yt.length; i++) {
      var ty = yOf(yt[i]);
      p.push('<line class="pu-grid" x1="' + m.left + '" x2="' + (m.left + plotW) + '" y1="' + ty.toFixed(1) + '" y2="' + ty.toFixed(1) + '"/>');
      p.push('<text class="pu-tick" x="' + (m.left - 6) + '" y="' + (ty + 4).toFixed(1) + '" text-anchor="end" font-size="13">' + pctTick(yt[i]) + '</text>');
    }
    for (i = 0; i < xt.length; i++) {
      p.push('<text class="pu-tick" x="' + xOf(xt[i]).toFixed(1) + '" y="' + (m.top + plotH + 16) + '" text-anchor="middle" font-size="13">' +
        pctTick(xt[i]) + '</text>');
    }
    p.push('<text class="pu-axis-title" data-tip="unemployment" x="' + (m.left + plotW / 2).toFixed(1) + '" y="' + (H - 4) +
      '" text-anchor="middle" font-size="13">Unemployment</text>');
    p.push('<text class="pu-axis-title" data-tip="inflation" transform="translate(12 ' + (m.top + plotH / 2).toFixed(1) +
      ') rotate(-90)" text-anchor="middle" font-size="13">Inflation</text>');
    p.push('<line class="pu-axis" x1="' + m.left + '" x2="' + m.left + '" y1="' + m.top + '" y2="' + (m.top + plotH) + '"/>');
    p.push('<line class="pu-axis" x1="' + m.left + '" x2="' + (m.left + plotW) + '" y1="' + (m.top + plotH) + '" y2="' + (m.top + plotH) + '"/>');

    // Reference lines.
    var nx = xOf(SU.mark), iy = yOf(SI.mark);
    p.push(hoverLine(nx, m.top, nx, m.top + plotH, 'pu-ref', 'naturalRate'));
    p.push('<text class="pu-ref-label" data-tip="naturalRate" x="' + (nx + 4).toFixed(1) + '" y="' + (m.top + 13) + '" font-size="13">Natural rate ' + SU.mark + '%</text>');
    p.push(hoverLine(m.left, iy, m.left + plotW, iy, 'pu-ref', 'target'));
    p.push('<text class="pu-ref-label" data-tip="target" x="' + (m.left + plotW - 4) + '" y="' + (iy - 5).toFixed(1) + '" text-anchor="end" font-size="13">Target ' + SI.mark + '%</text>');

    function tipFmt(rec) { return 'unemployment ' + f1(rec.unemployment) + '%, inflation ' + f1(rec.inflation) + '%'; }

    var lines = [], pts = [], labels = [];
    var lastIdx = game.universes[keys[0]].history.length - 1;
    var aStart = null;

    // No-policy paths: long dashes in the universe color, under the played traces.
    var npHits = [], npLast = [];
    for (var u = 0; u < keys.length; u++) {
      var nk = keys[u], nh = noPolicyOf(game, nk);
      if (!nh) continue;
      var nxy = [];
      for (i = 0; i < nh.length; i++) {
        var nx = xOf(nh[i].unemployment), ny = yOf(nh[i].inflation);
        nxy.push(nx.toFixed(1) + ',' + ny.toFixed(1));
        if (i > 0) npHits.push(noPolicyHit(nx, ny, roundName(nh[i].round) + ', ' + uName(cfg.names[nk]) + ', no policy: ' + tipFmt(nh[i])));
      }
      if (nh.length > 1) {
        lines.push('<g class="pu-np" data-tip="noPolicy" data-slot="' + slotOf(u) + '"><polyline class="pu-hit" points="' + nxy.join(' ') + '"/>' +
          '<polyline class="pu-nopolicy" points="' + nxy.join(' ') + '"/></g>');
      }
      npLast.push(cfg.names[nk] + ' ' + tipFmt(nh[nh.length - 1]));
    }

    // Optimal paths: dash-dot with diamonds, over the no-policy paths and
    // under the played traces.
    var optLast = [];
    for (u = 0; u < keys.length; u++) {
      var ok = keys[u], oh = optimalOf(cfg, ok);
      if (!oh || oh.length < 2) continue;
      var oxy = [];
      for (i = 0; i < oh.length; i++) oxy.push([xOf(oh[i].unemployment), yOf(oh[i].inflation)]);
      lines.push(optimalPath(u, oxy, npHits, (function (oh2, nm) {
        return function (j) { return roundName(oh2[j].round) + ', ' + uName(nm) + ', optimal path: ' + tipFmt(oh2[j]); };
      })(oh, cfg.names[ok])));
      optLast.push(cfg.names[ok] + ' round ' + oh[oh.length - 1].round + ' ' + tipFmt(oh[oh.length - 1]));
    }

    for (u = 0; u < keys.length; u++) {
      var k = keys[u], h = game.universes[k].history;
      var xy = [];
      for (i = 0; i < h.length; i++) xy.push(xOf(h[i].unemployment).toFixed(1) + ',' + yOf(h[i].inflation).toFixed(1));
      if (h.length > 1) {
        lines.push('<g data-tip="' + uTip(k) + '" data-slot="' + slotOf(u) + '"><polyline class="pu-hit" points="' + xy.join(' ') + '"/>' +
          '<polyline class="pu-trace" points="' + xy.join(' ') + '" style="stroke-width:' +
          (u === 0 ? 3 : 1.6) + 'px"/></g>');
      }
      for (i = 0; i < h.length; i++) {
        var px = xOf(h[i].unemployment), py = yOf(h[i].inflation);
        var tip = roundName(h[i].round) + ', ' + uName(cfg.names[k]) + ': ' + tipFmt(h[i]);
        if (u > 0) {
          var ha = game.universes[keys[0]].history[i];
          if (ha && Math.abs(xOf(ha.unemployment) - px) < 3 && Math.abs(yOf(ha.inflation) - py) < 3) {
            tip = roundName(h[i].round) + ', ' + uName(cfg.names[keys[0]]) + ': ' + tipFmt(ha) + '. ' + uName(cfg.names[k]) + ': ' + tipFmt(h[i]);
          }
        }
        pts.push(hoverPoint(u, px, py, i === h.length - 1, tip));
      }
      // Labels: "Start" once, and the latest round for each universe.
      // Universe A labels up and left, B down and right.
      var dx = u === 0 ? -9 : 9, dy = u === 0 ? -9 : 18, anchor = u === 0 ? 'end' : 'start';
      var s0 = { x: xOf(h[0].unemployment), y: yOf(h[0].inflation) };
      if (u === 0) {
        aStart = s0;
        labels.push('<text class="pu-round-label" x="' + (s0.x + dx).toFixed(1) + '" y="' + (s0.y + dy).toFixed(1) +
          '" text-anchor="' + anchor + '" font-size="13">Start</text>');
      }
      if (lastIdx > 0) {
        var L = h[lastIdx], lx = xOf(L.unemployment), ly = yOf(L.inflation);
        labels.push('<text class="pu-round-label is-latest" data-slot="' + slotOf(u) + '" x="' + (lx + dx * 1.2).toFixed(1) + '" y="' + (ly + dy).toFixed(1) +
          '" text-anchor="' + anchor + '" font-size="13">Round ' + L.round + '</text>');
      }
    }
    p.push('<g clip-path="url(#' + id + ')">' + lines.join('') + npHits.join('') + layers(pts) + labels.join('') + '</g>');

    var bits = [];
    for (u = 0; u < keys.length; u++) bits.push(cfg.names[keys[u]] + ' ' + tipFmt(game.universes[keys[u]].history[lastIdx]));
    var aria = 'Phillips curve trace: inflation against unemployment, one point per round. ' + roundName(lastIdx) + ': ' +
      bits.join('; ') + '.' + (npLast.length ? ' With no policy (dashed lines): ' + npLast.join('; ') + '.' : '') +
      (optLast.length ? ' Optimal path with perfect foresight (dash-dot lines with diamonds): ' + optLast.join('; ') + '.' : '') +
      (cfg.scoringOff ? '' : ' Green zone: unemployment ' + Z.unemployment[0] + '% to ' + Z.unemployment[1] + '%, inflation ' +
      Z.inflation[0] + '% to ' + Z.inflation[1] + '%.') + ' Reference lines: natural rate ' + SU.mark + '% and inflation target ' + SI.mark + '%.' +
      ' Axes: unemployment ' + pctTick(SU.min) + ' to ' + pctTick(SU.max) + ', inflation ' + pctTick(SI.min) + ' to ' + pctTick(SI.max) + '.';

    return '<svg role="img" aria-label="' + esc(aria) + '" viewBox="0 0 ' + width + ' ' + H + '" width="100%" ' +
      'preserveAspectRatio="xMidYMid meet" class="pu-svg">' + p.join('') + '</svg>';
  }

  // ---------- GDP range: from the data, only ever widening within a game ----------
  function gdpRange(el, game, cfg) {
    var lo = Infinity, hi = -Infinity;
    for (var u = 0; u < game.keys.length; u++) {
      var h = game.universes[game.keys[u]].history;
      for (var i = 0; i < h.length; i++) {
        lo = Math.min(lo, h[i].y, h[i].potential);
        hi = Math.max(hi, h[i].y, h[i].potential);
      }
      var oh = optimalOf(cfg, game.keys[u]) || [];
      for (i = 0; i < oh.length; i++) {
        lo = Math.min(lo, oh[i].y);
        hi = Math.max(hi, oh[i].y);
      }
      var nh = noPolicyOf(game, game.keys[u]) || [];
      for (i = 0; i < nh.length; i++) {
        lo = Math.min(lo, nh[i].y);
        hi = Math.max(hi, nh[i].y);
      }
    }
    var base = (root.PU.engine && root.PU.engine.BASE_POTENTIAL) || 9500;
    lo = Math.min(lo, base - 200);
    hi = Math.max(hi, base + 200);
    var pad = (hi - lo) * 0.04;   // keep lines off the frame
    lo -= pad; hi += pad;
    var prev = el.__puGdp;
    if (prev && prev.game === game) { lo = Math.min(lo, prev.lo); hi = Math.max(hi, prev.hi); }
    var step = niceStep(hi - lo, 3);
    var nlo = Math.floor(lo / step) * step, nhi = Math.ceil(hi / step) * step;
    el.__puGdp = { game: game, lo: nlo, hi: nhi };
    return { min: nlo, max: nhi, ticks: ticks(nlo, nhi, step) };
  }

  // ---------- legend ----------
  function legend(cfg, series, noPolicy) {
    var items = [];
    for (var u = 0; u < cfg.keys.length; u++) {
      var k = cfg.keys[u];
      items.push('<li data-tip="' + uTip(k) + '" tabindex="0"><svg class="pu-key" viewBox="0 0 34 14" width="34" height="14" aria-hidden="true">' +
        '<line x1="1" x2="33" y1="7" y2="7" class="pu-line" data-slot="' + slotOf(u) + '" style="stroke-width:' + (u === 0 ? 4 : 2) + 'px"/>' +
        pointMarker(u, 17, 7, false) + '</svg>' + esc(cfg.names[k]) + '</li>');
    }
    if (noPolicy) {
      // One dashed stroke per universe color, stacked.
      var dl = '';
      for (u = 0; u < cfg.keys.length; u++) {
        var yy = cfg.keys.length > 1 ? (u === 0 ? 4 : 11) : 7.5;
        dl += '<line x1="0" x2="40" y1="' + yy + '" y2="' + yy + '" class="pu-nopolicy" data-slot="' + slotOf(u) + '"/>';
      }
      items.push('<li data-tip="noPolicy" tabindex="0"><svg class="pu-key pu-key-wide" viewBox="0 0 40 15" width="40" height="15" aria-hidden="true">' +
        dl + '</svg>No policy (dashed)</li>');
    }
    if (cfg.optimal) {
      // Dash-dot with a diamond, one row per universe that has a path.
      var ol = '', ok = cfg.keys.filter(function (k) { return optimalOf(cfg, k); });
      for (u = 0; u < cfg.keys.length; u++) {
        if (!optimalOf(cfg, cfg.keys[u])) continue;
        var oy = ok.length > 1 ? (u === 0 ? 4 : 11) : 7.5;
        ol += '<g data-slot="' + slotOf(u) + '"><line x1="0" x2="40" y1="' + oy + '" y2="' + oy + '" class="pu-optimal"/>' +
          diamond(20, oy, ok.length > 1 ? 3 : 4.5) + '</g>';
      }
      items.push('<li data-tip="optimalPath" tabindex="0"><svg class="pu-key pu-key-wide" viewBox="0 0 40 15" width="40" height="15" aria-hidden="true">' +
        ol + '</svg>Optimal (perfect foresight)</li>');
    }
    if (series) {
      items.push('<li data-tip="potentialGdp" tabindex="0"><svg class="pu-key pu-key-wide" viewBox="0 0 40 15" width="40" height="15" aria-hidden="true">' +
        '<line x1="2" x2="38" y1="7.5" y2="7.5" class="pu-potential"/></svg>Potential GDP (dotted)</li>');
    }
    if (!cfg.scoringOff) {
      items.push('<li data-tip="greenZone" tabindex="0"><svg class="pu-key" viewBox="0 0 34 14" width="34" height="14" aria-hidden="true">' +
        '<rect x="1" y="1" width="32" height="12" class="pu-zone pu-zone-box"/></svg>Green zone</li>');
    }
    if (series && cfg.showRealRate) {
      // Line patterns for the Interest rates chart, in ink: the universe
      // color is already given by the universe entries above.
      items.push('<li data-tip="realRate" tabindex="0"><svg class="pu-key pu-key-wide" viewBox="0 0 40 15" width="40" height="15" aria-hidden="true">' +
        '<line x1="1" x2="39" y1="7.5" y2="7.5" class="pu-key-ink"/><circle cx="20" cy="7.5" r="4" class="pu-key-ink-mk"/></svg>Real rate (solid)</li>');
      items.push('<li data-tip="nominalRate" tabindex="0"><svg class="pu-key pu-key-wide" viewBox="0 0 40 15" width="40" height="15" aria-hidden="true">' +
        '<line x1="1" x2="39" y1="7.5" y2="7.5" class="pu-key-ink pu-rate-nominal"/></svg>Nominal rate (dash-dot)</li>');
    }
    if (series) {
      // HTML tags, so the letters keep a 13px size.
      items.push('<li data-tip="arrived" tabindex="0"><span class="pu-key-tags" aria-hidden="true">' +
        '<span class="pu-tag" data-slot="a">F</span><span class="pu-tag" data-slot="a">M</span></span>Policy took effect</li>');
    }
    return '<ul class="pu-legend" aria-label="Chart key">' + items.join('') + '</ul>';
  }

  function cellWidth(wrap) {
    var W = wrap.clientWidth || 0;
    if (!W) return 560;
    var narrow = root.matchMedia ? root.matchMedia('(max-width: 800px)').matches : W < 760;
    var w = narrow ? W : (W - NS_GAP) / 2;
    return Math.round(Math.max(300, Math.min(w, 640)));
  }

  function pctFmt(v) { return Math.abs(v - Math.round(v)) < 1e-9 ? pctTick(Math.round(v)) : f1(v) + '%'; }

  function figure(cls, tipKey, heading, svg) {
    return '<figure class="pu-chart' + (cls ? ' ' + cls : '') + '"><h3><span data-tip="' + tipKey + '" tabindex="0">' +
      esc(heading) + '</span></h3>' + svg + '</figure>';
  }

  function render(el, game, opts) {
    if (!el || !game) return;
    opts = opts || {};
    var old = el.querySelectorAll('.' + WRAP_CLASS);
    for (var i = 0; i < old.length; i++) if (old[i].parentNode === el) el.removeChild(old[i]);

    var wrap = document.createElement('div');
    wrap.className = WRAP_CLASS;
    el.appendChild(wrap);

    var cfg = setup(game, opts);
    var width = cellWidth(wrap);
    var S = root.PU.SCALES, Z = cfg.zone;
    var only = opts.only;

    if (only === 'phillips') {
      var pw = Math.round(Math.max(300, Math.min(wrap.clientWidth || 560, 760)));
      wrap.innerHTML = legend(cfg, false, hasNoPolicy(game)) + figure('pu-chart-phillips pu-chart-solo', 'phillips', 'Phillips curve trace', phillipsChart(game, cfg, pw));
      el.__puCharts = { game: game, opts: opts, width: width };
      if (registered.indexOf(el) < 0) registered.push(el);
      return;
    }

    var gdp = gdpRange(el, game, cfg);
    var ru = expandRange(S.unemployment, 3, valuesOf(game, ['unemployment'], true, cfg));
    var ri = expandRange(S.inflation, 5, valuesOf(game, ['inflation'], true, cfg));
    var rp = expandRange(S.price, 10, valuesOf(game, ['p'], true, cfg));
    var charts = [
      {
        title: 'Real GDP', field: 'y', potential: true, range: gdp, ticks: gdp.ticks, fmt: whole,
        heading: 'Real GDP', tip: 'chartGdp',
        tipFmt: function (r) { return 'real GDP ' + whole(r.y) + ', potential ' + whole(r.potential); }
      },
      {
        title: 'Unemployment', field: 'unemployment', range: ru, ticks: ru.ticks,
        fmt: pctFmt, zone: cfg.scoringOff ? null : Z.unemployment, heading: 'Unemployment', tip: 'chartUnemployment',
        ref: { value: S.unemployment.mark, label: 'Natural rate ' + S.unemployment.mark + '%', tip: 'naturalRate' },
        tipFmt: function (r) { return 'unemployment ' + f1(r.unemployment) + '%'; }
      },
      {
        title: 'Inflation', field: 'inflation', range: ri, ticks: ri.ticks,
        fmt: pctFmt, zone: cfg.scoringOff ? null : Z.inflation, heading: 'Inflation', tip: 'chartInflation',
        ref: { value: S.inflation.mark, label: 'Target ' + S.inflation.mark + '%', tip: 'target' },
        tipFmt: function (r) { return 'inflation ' + f1(r.inflation) + '%'; }
      },
      {
        title: 'Price level', field: 'p', range: rp, ticks: rp.ticks,
        fmt: function (v) { return String(Math.round(v)); }, heading: 'Price level', tip: 'chartPrice',
        tipFmt: function (r) { return 'price level ' + f1(r.p); }
      }
    ];
    if (cfg.showRealRate) {
      // The rate in effect (after lags) and the real rate, per universe. The
      // no-policy twin is left off: its nominal rate never moves.
      var rStar = (root.PU.engine && root.PU.engine.R_STAR != null) ? root.PU.engine.R_STAR : 1;
      var rr = expandRange({ min: -2, max: 6 }, 2, valuesOf(game, ['realRate', 'nominalRate'], false));
      charts.push({
        title: 'Interest rates', field: 'realRate', range: rr, ticks: rr.ticks, fmt: pctFmt,
        heading: 'Interest rates', tip: 'realRate', lineTip: 'realRate', noNoPolicy: true,
        alt: [{ field: 'nominalRate', cls: 'pu-line pu-rate-nominal', tip: 'nominalRate' }],
        ref: { value: rStar, label: 'Neutral real rate ' + rStar + '%', tip: 'realRate' },
        ariaNote: 'Solid lines with markers: real interest rate. Dash-dot lines: nominal interest rate in effect.',
        tipFmt: function (r) { return 'real rate ' + f1(r.realRate) + '%, nominal rate ' + (r.nominalRate || 0).toFixed(2) + '%'; }
      });
    }

    var html = [legend(cfg, true, hasNoPolicy(game)), '<div class="pu-chart-grid">'];
    for (i = 0; i < charts.length; i++) html.push(figure('', charts[i].tip, charts[i].heading, seriesChart(game, cfg, charts[i], width)));
    if (only !== 'series') html.push(figure('pu-chart-phillips', 'phillips', 'Phillips curve trace', phillipsChart(game, cfg, width)));
    html.push('</div>');
    wrap.innerHTML = html.join('');

    el.__puCharts = { game: game, opts: opts, width: width };
    if (registered.indexOf(el) < 0) registered.push(el);
  }

  var resizeTimer = null;
  function onResize() {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      for (var i = 0; i < registered.length; i++) {
        var el = registered[i], st = el.__puCharts;
        if (!st || !el.isConnected) continue;
        var wrap = el.querySelector('.' + WRAP_CLASS);
        if (wrap && cellWidth(wrap) !== st.width) render(el, st.game, st.opts);
      }
    }, 150);
  }
  if (root.addEventListener) root.addEventListener('resize', onResize);

  root.PU.charts = { render: render, _niceStep: niceStep };
})(typeof window !== 'undefined' ? window : globalThis);
