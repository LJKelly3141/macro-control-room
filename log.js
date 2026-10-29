/*
 * Macro Control Room: the round log.
 *
 * PU.log.render(el, game, opts) draws a table: one row per round (round 0
 * shown as "Start"), the event (only in a round with a shock), Team Fiscal's
 * and Team Monetary's choices, and for each universe unemployment, inflation,
 * stars, and which policy took effect that round (F fiscal, M monetary). A
 * Supply column appears once any round used the supply lever.
 * Autopilot rounds: Team Monetary reads "Taylor rule: 4.25%" (per universe
 * when the rates differ) and Team Fiscal "Balanced budget: spending −34".
 * When the game has a no-policy twin (game.noPolicy), each universe also gets
 * a "vs no policy" column: played unemployment minus no-policy unemployment.
 * Optimal rule autopilots read "Optimal rule: 3.25%" and "Optimal rule:
 * spending +2". With opts.optimal ({a: {history, plan}, ...}) each universe
 * gets an "Optimal plan" column: plan[r - 2], the perfect-foresight choice
 * for round r (blank at the start and in round 1, the event round).
 * opts: { names: {a, b}, zone, scoringOff, showRealRate, optimal }.
 *   zone: the green zone {unemployment: [lo, hi], inflation: [lo, hi]} used to
 *   shade cells (falls back to the game's scoring zone, then PU.ZONE).
 *   scoringOff: no zone shading and no Stars column (falls back to
 *   game.scoring.on === false). showRealRate: a "Real rate" column per
 *   universe (rec.realRate); when false nothing about the real rate shows.
 * Works with one universe (game.keys = ['a']) or two.
 * opts.colors may be passed but is not used: colors
 * come from tokens.css through charts.css and data-slot="a|b", so a theme
 * change restyles with no redraw. Every call redraws from scratch.
 * Header cells carry data-tip keys from PU.TIPS (tips.js shows them).
 */
(function (root) {
  'use strict';
  root.PU = root.PU || {};

  var WRAP_CLASS = 'pu-log-wrap';
  var CAP_CLASS = 'pu-log-caption';

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  // Numbers with a true minus sign and an explicit plus.
  function signed(v) { return v > 0 ? '+' + v : v < 0 ? '−' + Math.abs(v) : '0'; }
  function signed1(v) { return v > 0 ? '+' + v.toFixed(1) : v < 0 ? '−' + Math.abs(v).toFixed(1) : '0.0'; }
  function pct(v) {
    var s = (Math.round(v * 10) / 10).toFixed(1);
    if (s === '-0.0') s = '0.0';
    return (s.charAt(0) === '-' ? '−' + s.slice(1) : s) + '%';
  }

  // "Spending +2, taxes −1" or "No change".
  function describeFiscal(rec) {
    var out = [], s = rec.spending || 0, t = rec.taxes || 0;
    if (s) out.push('spending ' + signed(s));
    if (t) out.push('taxes ' + signed(t));
    if (!out.length) return 'No change';
    var txt = out.join(', ');
    return txt.charAt(0).toUpperCase() + txt.slice(1);
  }

  // "Rate −1.0 to 2.0%" or "No change".
  function describeMonetary(rec) {
    var r = rec.rate || 0;
    if (Math.abs(r) < 1e-9) return 'No change';
    // Rates move in 25 basis point steps, so two decimals.
    var two = function (v) { return v > 0 ? '+' + v.toFixed(2) : v < 0 ? '\u2212' + Math.abs(v).toFixed(2) : '0.00'; };
    return 'Rate ' + two(r) + ' to ' + (rec.rateLevel != null ? rec.rateLevel : 0).toFixed(2) + '%';
  }

  // Kept for older callers: both teams in one string.
  function describePolicy(rec) {
    var f = describeFiscal(rec), m = describeMonetary(rec);
    if (f === 'No change' && m === 'No change') return 'No change';
    return [f === 'No change' ? '' : f, m === 'No change' ? '' : m].filter(Boolean).join('; ');
  }

  // Short labels for per-universe values in one cell: initials ("K", "N")
  // when they differ, full names otherwise.
  function shortNames(keys, names) {
    var out = {}, seen = {}, ok = true;
    for (var i = 0; i < keys.length; i++) {
      var c = String(names[keys[i]]).trim().charAt(0).toUpperCase();
      if (!c || seen[c]) ok = false;
      seen[c] = true; out[keys[i]] = c;
    }
    if (!ok) for (i = 0; i < keys.length; i++) out[keys[i]] = names[keys[i]];
    return out;
  }

  // One value for every universe, or "K 4.25%, N 2.50%" when they differ.
  function perUniverse(keys, short, vals) {
    var same = true;
    for (var i = 1; i < keys.length; i++) if (vals[keys[i]] !== vals[keys[0]]) same = false;
    if (same) return vals[keys[0]];
    return keys.map(function (k) { return short[k] + ' ' + vals[k]; }).join(', ');
  }

  // Team Monetary on autopilot: "Taylor rule: 4.25%" or "Optimal rule: 3.25%"
  // (per universe when the rates differ), as {text, tip}; null when the rate
  // was set by hand this round.
  function autoMonetary(game, r, short) {
    var keys = game.keys, vals = {}, any = false, mode = 'taylor';
    for (var i = 0; i < keys.length; i++) {
      var rec = game.universes[keys[i]].history[r];
      if (rec.autoRate) { any = true; if (rec.autoRateMode === 'optimal') mode = 'optimal'; }
      vals[keys[i]] = (rec.rateLevel != null ? rec.rateLevel : 0).toFixed(2) + '%';
    }
    if (!any) return null;
    return mode === 'optimal'
      ? { text: 'Optimal rule: ' + perUniverse(keys, short, vals), tip: 'autopilotOptimalMonetary' }
      : { text: 'Taylor rule: ' + perUniverse(keys, short, vals), tip: 'autopilotMonetary' };
  }

  // Team Fiscal on autopilot, as {text, tip}: the optimal rule ("Optimal rule:
  // spending +2", the record's spending is the rule's choice), the balanced
  // budget ("Balanced budget: spending −34", "Balanced budget: no change"), or
  // null when fiscal autopilot is off and no spending was forced.
  function autoFiscal(game, r, short) {
    var keys = game.keys, vals = {}, any = false, opt = false, i;
    for (i = 0; i < keys.length; i++) if (game.universes[keys[i]].history[r].autoFiscalMode === 'optimal') opt = true;
    if (opt) {
      for (i = 0; i < keys.length; i++) {
        var sv = game.universes[keys[i]].history[r].spending || 0;
        if (sv) any = true;
        vals[keys[i]] = signed(sv);
      }
      return { text: any ? 'Optimal rule: spending ' + perUniverse(keys, short, vals) : 'Optimal rule: no change', tip: 'autopilotOptimalFiscal' };
    }
    for (i = 0; i < keys.length; i++) {
      var v = Math.round(game.universes[keys[i]].history[r].autoSpending || 0);
      if (v) any = true;
      vals[keys[i]] = signed(v);
    }
    if (any) return { text: 'Balanced budget: spending ' + perUniverse(keys, short, vals), tip: 'autopilotFiscal' };
    return game.autopilot && game.autopilot.fiscal ? { text: 'Balanced budget: no change', tip: 'autopilotFiscal' } : null;
  }

  // The optimal plan's choice for a round: "Spending +3, rate −1.00" or
  // "No change". c is plan[r - 2], {spending, rate}.
  function describePlan(c) {
    if (!c) return '';
    var out = [], s = c.spending || 0, r = c.rate || 0;
    if (s) out.push('Spending ' + signed(s));
    if (Math.abs(r) > 1e-9) out.push((out.length ? 'rate ' : 'Rate ') + (r > 0 ? '+' + r.toFixed(2) : '\u2212' + Math.abs(r).toFixed(2)));
    return out.length ? out.join(', ') : 'No change';
  }

  function shockLabel(key) {
    if (!key || key === 'none') return '';
    var S = root.PU.engine && root.PU.engine.SHOCKS;
    return (S && S[key] && S[key].label) || key;
  }

  // Stars out of the round's maximum (the scoring weights can be 0 to 2 each).
  var maxStars = 2;
  function stars(n) {
    var s = '';
    for (var i = 0; i < maxStars; i++) s += i < n ? '★' : '☆';
    return '<span aria-hidden="true">' + s + '</span><span class="pu-sr">' + n + ' of ' + maxStars + ' stars</span>';
  }

  function arrivedCell(rec) {
    var t = [], sr = [];
    if (rec.fiscalArrived) { t.push('<span class="pu-tag">F</span>'); sr.push('fiscal'); }
    if (rec.monetaryArrived) { t.push('<span class="pu-tag">M</span>'); sr.push('monetary'); }
    if (!t.length) return '';
    return '<span data-tip="arrived"><span aria-hidden="true">' + t.join('') + '</span><span class="pu-sr">' +
      sr.join(' and ') + ' policy took effect</span></span>';
  }

  // A header label that shows its tip on hover, focus, and tap.
  function tipLabel(key, label) {
    return '<span class="pu-tiplabel" data-tip="' + key + '" tabindex="0">' + label + '</span>';
  }

  function render(el, game, opts) {
    if (game && game.scoring) maxStars = (game.scoring.wU || 0) + (game.scoring.wPi || 0);
    if (!el || !game) return;
    opts = opts || {};
    var i, j;
    var old = el.querySelectorAll('.' + WRAP_CLASS + ', .' + CAP_CLASS);
    for (i = 0; i < old.length; i++) if (old[i].parentNode === el) el.removeChild(old[i]);

    var keys = game.keys;
    var names = {};
    for (i = 0; i < keys.length; i++) {
      names[keys[i]] = (opts.names && opts.names[keys[i]]) || ('Universe ' + keys[i].toUpperCase());
    }
    var scoringOff = opts.scoringOff != null ? !!opts.scoringOff : !!(game.scoring && game.scoring.on === false);
    var Z = opts.zone || (game.scoring && game.scoring.zone) || root.PU.ZONE ||
      (root.PU.engine && root.PU.engine.ZONE) || { unemployment: [4.5, 5.5], inflation: [1, 3] };
    var showReal = !!opts.showRealRate;
    var within = function (v, z) { return v >= z[0] - 1e-9 && v <= z[1] + 1e-9; };
    var first = game.universes[keys[0]].history;
    var lastIdx = first.length - 1;
    var event = game.shockMode === 'event';

    var hasSupply = false;
    for (i = 1; i < first.length; i++) if ((first[i].supply || 0) > 0) { hasSupply = true; break; }

    // Shared columns, then per-universe columns.
    var shared = [
      { label: tipLabel('round', 'Round'), cls: 'num' },
      { label: tipLabel(event ? 'event' : 'log', event ? 'Event' : 'Shock'), cls: '' },
      { label: tipLabel('teamFiscal', 'Team Fiscal'), cls: '' },
      { label: tipLabel('teamMonetary', 'Team Monetary'), cls: '' }
    ];
    if (hasSupply) shared.push({ label: tipLabel('supply', 'Supply'), cls: 'num' });
    var short = shortNames(keys, names);
    // The no-policy twin, for the "vs no policy" column.
    var np = {}, hasNp = typeof game.noPolicy === 'function';
    for (i = 0; i < keys.length && hasNp; i++) {
      np[keys[i]] = game.noPolicy(keys[i]);
      if (!np[keys[i]]) hasNp = false;
    }
    var perU = [
      { label: tipLabel('unemployment', 'Unemployment'), cls: 'num' }
    ];
    if (hasNp) perU.push({ label: tipLabel('noPolicy', 'vs no policy'), cls: 'num pu-log-vs' });
    perU.push({ label: tipLabel('inflation', 'Inflation'), cls: 'num' });
    if (showReal) perU.push({ label: tipLabel('realRate', 'Real rate'), cls: 'num' });
    if (!scoringOff && hasNp) perU.push({ label: tipLabel('welfareRound', 'Welfare'), cls: 'num' });
    perU.push({ label: tipLabel('arrived', 'Took effect'), cls: 'mark' });
    // The optimal plan (perfect foresight), per universe, when ui.js passes it.
    var plans = {}, hasPlan = false;
    for (i = 0; i < keys.length; i++) {
      var ok = opts.optimal && opts.optimal[keys[i]];
      plans[keys[i]] = ok && ok.plan ? ok.plan : null;
      if (plans[keys[i]]) hasPlan = true;
    }
    if (hasPlan) perU.push({ label: tipLabel('optimalPath', 'Optimal plan'), cls: 'pu-log-opt' });

    var h = [];
    h.push('<table class="pu-log">');
    var capText = 'Each round: the event, both teams\' choices, and the results in ' +
      keys.map(function (k) { return names[k]; }).join(' and ') + '.';
    h.push('<caption class="pu-sr">' + esc(capText) + '</caption>');
    h.push('<colgroup span="' + shared.length + '"></colgroup>');
    for (i = 0; i < keys.length; i++) h.push('<colgroup span="' + perU.length + '" class="pu-log-u"></colgroup>');
    h.push('<thead><tr><td colspan="' + shared.length + '" class="pu-log-blank"></td>');
    for (i = 0; i < keys.length; i++) {
      h.push('<th scope="colgroup" colspan="' + perU.length + '" class="pu-log-uname" data-slot="' + (i === 0 ? 'a' : 'b') + '">' +
        tipLabel('universe' + keys[i].toUpperCase(), esc(names[keys[i]])) + '</th>');
    }
    h.push('</tr><tr>');
    for (j = 0; j < shared.length; j++) h.push('<th scope="col"' + (shared[j].cls ? ' class="' + shared[j].cls + '"' : '') + '>' + shared[j].label + '</th>');
    for (i = 0; i < keys.length; i++) {
      for (j = 0; j < perU.length; j++) {
        h.push('<th scope="col" class="' + (j === 0 ? 'pu-log-first ' : '') + perU[j].cls + '">' + perU[j].label + '</th>');
      }
    }
    h.push('</tr></thead><tbody>');

    for (var r = 0; r <= lastIdx; r++) {
      var rec0 = first[r];
      var latest = r === lastIdx;
      var start = r === 0;
      var fis = start ? '' : describeFiscal(rec0), mon = start ? '' : describeMonetary(rec0);
      // Autopilot rounds say what the rule did instead of the teams' levers.
      var autoF = start ? null : autoFiscal(game, r, short), autoM = start ? null : autoMonetary(game, r, short);
      h.push('<tr' + (latest ? ' class="is-latest"' : '') + '>');
      h.push('<th scope="row" class="num">' + (start ? 'Start' : rec0.round) + (latest ? '<span class="pu-sr"> (latest)</span>' : '') + '</th>');
      h.push('<td class="pu-log-event">' + esc(start ? '' : shockLabel(rec0.shock)) + '</td>');
      if (autoF) {
        h.push('<td class="pu-log-auto' + (/no change$/.test(autoF.text) ? ' pu-log-none' : '') + '"><span data-tip="' + autoF.tip + '">' + esc(autoF.text) + '</span></td>');
      } else {
        h.push('<td' + (fis === 'No change' ? ' class="pu-log-none"' : '') + '>' + esc(fis) + '</td>');
      }
      if (autoM) {
        h.push('<td class="pu-log-auto"><span data-tip="' + autoM.tip + '">' + esc(autoM.text) + '</span></td>');
      } else {
        h.push('<td' + (mon === 'No change' ? ' class="pu-log-none"' : '') + '>' + esc(mon) + '</td>');
      }
      if (hasSupply) h.push('<td class="num">' + (start || !rec0.supply ? '' : '+' + rec0.supply) + '</td>');
      for (i = 0; i < keys.length; i++) {
        var rec = game.universes[keys[i]].history[r];
        var zu = !scoringOff && within(rec.unemployment, Z.unemployment), zi = !scoringOff && within(rec.inflation, Z.inflation);
        h.push('<td class="num pu-log-first' + (zu ? ' in-zone" data-tip="greenZone' : '') + '">' + pct(rec.unemployment) + '</td>');
        if (hasNp) {
          // Played minus no-policy unemployment: −1.2 means policy left it 1.2 points lower.
          var nrec = np[keys[i]][r], vs = '';
          if (!start && nrec) {
            var d = Math.round((rec.unemployment - nrec.unemployment) * 10) / 10;
            vs = '<span data-tip="noPolicy">' + signed1(d) + '<span class="pu-sr"> points compared with no policy</span></span>';
          }
          h.push('<td class="num pu-log-vs">' + vs + '</td>');
        }
        h.push('<td class="num' + (zi ? ' in-zone" data-tip="greenZone' : '') + '">' + pct(rec.inflation) + '</td>');
        if (showReal) h.push('<td class="num">' + (rec.realRate != null ? pct(rec.realRate) : '') + '</td>');
        if (!scoringOff && hasNp) {
          // This round's welfare: the no-policy loss minus the loss with policy.
          // Positive means policy did better than doing nothing this round.
          var wrec = np[keys[i]][r], wv = '';
          if (!start && wrec) {
            var gain = Math.round((wrec.loss - rec.loss) * 10) / 10;
            wv = '<span data-tip="welfareRound">' + (gain > 0 ? '+' : '') + signed1(gain).replace(/^\+/, '') +
              '<span class="pu-sr"> loss points compared with no policy</span></span>';
          }
          h.push('<td class="num pu-log-welfare' + (gain > 0 ? ' up' : gain < 0 ? ' down' : '') + '">' + wv + '</td>');
        }
        h.push('<td class="mark">' + arrivedCell(rec) + '</td>');
        if (hasPlan) {
          // Round 1 is the event round (no policy in the plan); start is blank.
          var pl = plans[keys[i]], pc = r >= 2 && pl ? describePlan(pl[r - 2]) : '';
          h.push('<td class="pu-log-opt' + (pc === 'No change' ? ' pu-log-none' : '') + '">' +
            (pc ? '<span data-tip="optimalPath">' + esc(pc) + '</span>' : '') + '</td>');
        }
      }
      h.push('</tr>');
    }
    h.push('</tbody></table>');

    // A short visible line with the log's tip; the full caption is for screen readers.
    var cap = document.createElement('p');
    cap.className = CAP_CLASS;
    cap.setAttribute('aria-hidden', 'true');
    cap.innerHTML = '<span data-tip="log">One row per round.</span>';
    el.appendChild(cap);

    var wrap = document.createElement('div');
    wrap.className = WRAP_CLASS;
    wrap.setAttribute('role', 'region');
    wrap.setAttribute('tabindex', '0');
    wrap.setAttribute('aria-label', 'Round log table, scrolls sideways');
    wrap.innerHTML = h.join('');
    el.appendChild(wrap);
  }

  root.PU.log = {
    render: render, describePolicy: describePolicy,
    describeFiscal: describeFiscal, describeMonetary: describeMonetary
  };
})(typeof window !== 'undefined' ? window : globalThis);
