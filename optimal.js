/*
 * Macro Control Room: optimal-policy benchmarks (specs/POLICY_UNIVERSES_OPTIMAL_POLICY_PLAN.md).
 *
 * Used by the game for the optimal path, both scores, the optimal-rule
 * autopilot and the optimal-move hint. scripts/compare.js compares the two
 * approaches (specs/POLICY_UNIVERSES_OPTIMAL_COMPARISON.md).
 *
 * A. lqRule: the infinite-horizon linear-quadratic optimal rule. The engine's
 *    one-round transition is linearized numerically around the starting point,
 *    and the discounted Riccati equation is solved for the feedback rule
 *    u = -F x. Controls: fiscal stance in spending steps, and the change in the
 *    nominal rate. Loss per round: wU (u - 5)^2 + wPi (pi - 2)^2 plus small
 *    costs of moving each instrument.
 * B. searchPlan: finite-horizon, perfect-foresight search over the players'
 *    own buttons (spending steps, 25 basis point rate steps), by coordinate
 *    search from several starting plans, scored over the game plus tail rounds.
 *
 * Both work on a one-universe game (the benchmarks are per universe).
 */
(function (root) {
  'use strict';
  var E = root.PU && root.PU.engine;
  if (!E && typeof require === 'function') E = require('./engine.js');

  var DEFAULTS = {
    discount: 0.95,   // per round
    // Instrument costs. The rule needs them to choose a mix of the two levers
    // (both move AD), but they are not part of the welfare loss. With tuneCosts
    // on, the costs are not assumed: tunedCosts picks, for each economy, the pair
    // whose rule gives the lowest true welfare loss, so the rule is the best rule
    // of this form judged by the game's own score. costFiscal and costRate are
    // then used only when tuneCosts is off.
    tuneCosts: true,
    costFiscal: 0.05, // loss per (spending step)^2
    costRate: 0.8,    // loss per (percentage point)^2: a 25 bp move costs 0.05, the same as a fiscal step
    tail: 4,          // rounds after the game, with no new policy, counted in every score
    buckets: 5        // policy pipeline slots tracked in the state (lags up to 3, plus the two-round phase-in)
  };

  // ---- State: the economy at the start of a round, as deviations ------------
  // [ad, sras, lras, expected extra inflation, rate in effect, rate set,
  //  AD part set by the real rate, last round's unscaled price level,
  //  the parts of the event's AD and SRAS shifts still in place (they fade),
  //  fiscal pipeline by rounds ahead (B slots), monetary pipeline (B slots)]
  var NS = 10;
  function stateSize(B) { return NS + 2 * B; }

  function extract(u, nextRound, B) {
    var last = u.history[u.history.length - 1];
    var x = [
      u.ad - E.START_AD, u.sras, u.lras, u.expectedExtra || 0,
      u.iEff - E.START_RATE, u.rate - E.START_RATE, u.adMon,
      last.p / (last.nom || 1) - 104,
      u.shockAd || 0, u.shockSras || 0
    ];
    for (var j = 0; j < 2 * B; j++) x.push(0);
    u.pendingDemand.forEach(function (d) {
      var off = d.arrives - nextRound;
      if (off < 0 || off >= B) return;
      if (d.kind === 'monetary') x[NS + B + off] += d.dRate || 0;
      else x[NS + off] += d.shift;
    });
    return x;
  }

  function inject(u, x, round, B, beta) {
    u.ad = E.START_AD + x[0]; u.sras = x[1]; u.lras = x[2]; u.expectedExtra = x[3];
    u.iEff = E.START_RATE + x[4]; u.rate = E.START_RATE + x[5]; u.adMon = x[6];
    u.nom = 1; u.adNom = 0; u.srasNom = 0;
    u.shockAd = x[8]; u.shockSras = x[9];
    u.history = [{ round: round - 1, p: 104 + x[7], nom: 1, y: E.BASE_POTENTIAL }];
    u.pendingDemand = []; u.pendingSupply = [];
    for (var j = 0; j < B; j++) {
      if (x[NS + j]) u.pendingDemand.push({ arrives: round + j, shift: x[NS + j], kind: 'fiscal' });
      if (x[NS + B + j]) u.pendingDemand.push({ arrives: round + j, dRate: x[NS + B + j], shift: -beta * x[NS + B + j], kind: 'monetary' });
    }
  }

  // One round of the true (nonlinear) model from state x with controls
  // c = [spending steps, rate change]. Returns the next state and the round's
  // measures y = [unemployment - 5, inflation - 2].
  function transition(scratch, x, c, round, B, beta) {
    inject(scratch, x, round, B, beta);
    var newRate = scratch.rate + c[1];
    var rec = scratch.step(round, 'none', { spending: c[0], rate: c[1], rateLevel: newRate });
    scratch.rate = newRate;
    return { x: extract(scratch, round + 1, B), y: [rec.unemployment - E.NATURAL_RATE, rec.inflation - E.INFLATION_TARGET] };
  }

  // ---- Small matrix helpers --------------------------------------------------
  function zeros(r, c) { var m = []; for (var i = 0; i < r; i++) { m.push(new Array(c).fill(0)); } return m; }
  function T(a) { return a[0].map(function (_, j) { return a.map(function (r) { return r[j]; }); }); }
  function mul(a, b) {
    var r = a.length, n = b.length, c = b[0].length, o = zeros(r, c);
    for (var i = 0; i < r; i++) for (var k = 0; k < n; k++) { var v = a[i][k]; if (v) for (var j = 0; j < c; j++) o[i][j] += v * b[k][j]; }
    return o;
  }
  function add(a, b, s) { s = s == null ? 1 : s; return a.map(function (r, i) { return r.map(function (v, j) { return v + s * b[i][j]; }); }); }
  function scale(a, s) { return a.map(function (r) { return r.map(function (v) { return v * s; }); }); }
  function inv2(m) {
    var d = m[0][0] * m[1][1] - m[0][1] * m[1][0];
    return [[m[1][1] / d, -m[0][1] / d], [-m[1][0] / d, m[0][0] / d]];
  }
  function maxAbsDiff(a, b) { var m = 0; a.forEach(function (r, i) { r.forEach(function (v, j) { m = Math.max(m, Math.abs(v - b[i][j])); }); }); return m; }

  // ---- A. The linear-quadratic optimal rule ------------------------------------
  // Linearize around the steady state by central differences of the engine.
  function linearize(settings, round, opts) {
    var B = opts.buckets, n = stateSize(B), beta = settings.rateSensitivity != null ? settings.rateSensitivity : E.BETA;
    var scratch = new E.Universe(settings);
    var x0 = new Array(n).fill(0), c0 = [0, 0];
    var base = transition(scratch, x0, c0, round, B, beta);
    var A = zeros(n, n), Bm = zeros(n, 2), C = zeros(2, n), D = zeros(2, 2);
    function col(dx, dc, h, target, ty, j) {
      var p = transition(scratch, x0.map(function (v, i) { return v + (dx === i ? h : 0); }), c0.map(function (v, i) { return v + (dc === i ? h : 0); }), round, B, beta);
      var m = transition(scratch, x0.map(function (v, i) { return v - (dx === i ? h : 0); }), c0.map(function (v, i) { return v - (dc === i ? h : 0); }), round, B, beta);
      for (var i = 0; i < n; i++) target[i][j] = (p.x[i] - m.x[i]) / (2 * h);
      for (i = 0; i < 2; i++) ty[i][j] = (p.y[i] - m.y[i]) / (2 * h);
    }
    for (var j = 0; j < n; j++) col(j, -1, 0.01, A, C, j);
    for (j = 0; j < 2; j++) col(-1, j, 0.01, Bm, D, j);
    return { A: A, B: Bm, C: C, D: D, steady: base };
  }

  function lqRule(settings, opts) {
    opts = Object.assign({}, DEFAULTS, opts || {});
    var sc = E.scoringOf(opts.scoring);
    var round = opts.round || 2;
    var lin = linearize(settings, round, opts);
    var A = lin.A, Bm = lin.B, C = lin.C, D = lin.D, d = opts.discount;
    var W = [[sc.wU, 0], [0, sc.wPi]], R = [[opts.costFiscal, 0], [0, opts.costRate]];
    var Qb = mul(mul(T(C), W), C), N = mul(mul(T(C), W), D), Rb = add(mul(mul(T(D), W), D), R);
    var P = Qb, F = zeros(2, A.length), it;
    for (it = 0; it < 5000; it++) {
      var PB = mul(P, Bm), PA = mul(P, A);
      var G = add(Rb, scale(mul(T(Bm), PB), d));
      F = mul(inv2(G), add(T(N), scale(mul(T(Bm), PA), d)));
      var Pn = add(add(Qb, scale(mul(T(A), PA), d)), mul(add(N, scale(mul(T(A), PB), d)), F), -1);
      var diff = maxAbsDiff(Pn, P);
      P = Pn;
      if (diff < 1e-9) break;
    }
    // The pieces of the solved quadratic needed to re-optimize one instrument
    // when the other is constrained: cost-to-go in u is u'Gu + 2u'Hx + ...
    var Gf = add(Rb, scale(mul(T(Bm), mul(P, Bm)), d));
    var Hf = add(T(N), scale(mul(T(Bm), mul(P, A)), d));
    return { F: F, P: P, G: Gf, H: Hf, iterations: it, lin: lin, opts: opts };
  }

  // The rule's choice for a live universe at the start of `round`, rounded to
  // the players' buttons: whole spending steps and 25 basis point rate steps.
  // When the rate the rule wants is out of reach (the 0% floor, or the 2-point
  // limit on a round's move), the rate is held at what is possible and fiscal
  // policy is re-optimized given it, from the same solved quadratic:
  // u_f = -(H_f x + G_fm u_m) / G_ff.
  function ruleChoice(rule, u, round) {
    var x = extract(u, round, rule.opts.buckets);
    var c = rule.F.map(function (row) { return -row.reduce(function (s, f, j) { return s + f * x[j]; }, 0); });
    var R = E.RANGES;
    var lo = Math.max(R.rate.min, -u.rate), hi = Math.min(R.rate.max, E.RATE_MAX - u.rate);
    if (c[1] < lo || c[1] > hi) {
      c[1] = Math.max(lo, Math.min(hi, c[1]));
      var hx = rule.H[0].reduce(function (s, h, j) { return s + h * x[j]; }, 0);
      c[0] = -(hx + rule.G[0][1] * c[1]) / rule.G[0][0];
    }
    var spending = Math.max(R.spending.min, Math.min(R.spending.max, Math.round(c[0])));
    var rate = Math.max(R.rate.min, Math.min(R.rate.max, Math.round(c[1] * 4) / 4));
    return { spending: spending, rate: rate, raw: c };
  }

  // ---- Playing and scoring a plan ---------------------------------------------
  // game1: a one-universe game right after round 1 (the event round). choose(g, t)
  // returns the choice for round t. Plays rounds 2..rounds, then `tail` rounds
  // with no policy (no new fiscal steps, the real rate held at neutral), and
  // returns the total loss over every round.
  function play(game1, choose, opts) {
    var tail = opts.tail;
    var g = game1.clone({ rounds: game1.rounds + tail });
    var k = g.keys[0], choices = [];
    while (g.round < game1.rounds) {
      var t = g.round + 1, ch = Object.assign({}, choose(g, t) || {});
      if (opts.shocks && opts.shocks[t]) ch.shock = opts.shocks[t];
      choices.push(ch);
      g.step(ch);
    }
    g.autopilot = { monetary: 'neutral', fiscal: false };
    while (!g.isOver()) g.step({});
    var h = g.universes[k].history, L = 0;
    for (var i = 1; i < h.length; i++) L += h[i].loss;
    return { loss: L, history: h, choices: choices, game: g };
  }

  function lqPlan(game1, opts) {
    var u0 = game1.universes[game1.keys[0]], s = u0.settings, rules = {};
    opts = withCosts(s, game1.scoring, opts);
    function ruleFor(t) {
      var lam = E.lambdaAt(s, t);
      if (!rules[lam]) rules[lam] = lqRule(s, Object.assign({}, opts, { round: t, scoring: game1.scoring }));
      return rules[lam];
    }
    return play(game1, function (g, t) {
      var c = ruleChoice(ruleFor(t), g.universes[g.keys[0]], t);
      return { spending: c.spending, rate: c.rate };
    }, opts);
  }

  // No policy: no fiscal steps, and the real rate held at neutral.
  function nonePlan(game1, opts) {
    var g1 = game1.clone();
    g1.autopilot = { monetary: 'neutral', fiscal: false };
    return play(g1, function () { return {}; }, Object.assign({}, DEFAULTS, opts || {}));
  }

  function taylorPlan(game1, opts) {
    var g1 = game1.clone();
    g1.autopilot = { monetary: true, fiscal: false };
    return play(g1, function () { return {}; }, Object.assign({}, DEFAULTS, opts || {}));
  }

  // ---- B. Finite-horizon perfect-foresight search -------------------------------
  function planFromChoices(choices) {
    return choices.map(function (c) { return { spending: c.spending || 0, rate: c.rate || 0 }; });
  }

  function searchPlan(game1, opts) {
    opts = Object.assign({}, DEFAULTS, opts || {});
    var R = E.RANGES;
    var sVals = [], rVals = [];
    for (var v = R.spending.min; v <= R.spending.max; v += R.spending.step) sVals.push(v);
    for (v = R.rate.min; v <= R.rate.max + 1e-9; v += R.rate.step) rVals.push(Math.round(v * 100) / 100);
    var evals = 0;
    function cost(plan) {
      evals++;
      return play(game1, function (g, t) { return plan[t - 2]; }, opts).loss;
    }
    var starts = (opts.starts || []).map(planFromChoices);
    var n = game1.rounds - 1;
    starts.unshift(Array.from({ length: n }, function () { return { spending: 0, rate: 0 }; }));
    var best = null, bestCost = Infinity;
    starts.forEach(function (start) {
      var plan = start.map(function (c) { return { spending: c.spending, rate: c.rate }; });
      var cur = cost(plan);
      for (var sweep = 0; sweep < (opts.maxSweeps || 12); sweep++) {
        var improved = false;
        for (var t = 0; t < n; t++) {
          [['spending', sVals], ['rate', rVals]].forEach(function (pair) {
            var key = pair[0], keep = plan[t][key], bestV = keep;
            pair[1].forEach(function (val) {
              if (val === keep) return;
              plan[t][key] = val;
              var c = cost(plan);
              if (c < cur - 1e-9) { cur = c; bestV = val; improved = true; }
            });
            plan[t][key] = bestV;
          });
        }
        if (!improved) break;
      }
      if (cur < bestCost) { bestCost = cur; best = plan.map(function (c) { return Object.assign({}, c); }); }
    });
    var result = play(game1, function (g, t) { return best[t - 2]; }, opts);
    result.evaluations = evals;
    result.plan = best;
    return result;
  }

  // ---- Tuning the instrument costs to the welfare loss ---------------------------
  // For each pair of costs on the grid, solve the rule and play it in the true
  // model after each of the four events (12 rounds plus the tail, the class's
  // welfare weights), and keep the pair with the lowest average loss relative
  // to no policy. Each event counts equally; the no-policy loss is floored at 1
  // so a mild event cannot dominate. Cached by economy, weights and options.
  var COST_GRID = {
    fiscal: [0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5],
    rate: [0.1, 0.2, 0.4, 0.8, 1.6, 3.2]
  };
  var TUNE_ROUNDS = 12;
  // The economy's parameters that the tuning depends on (not its name or label).
  var MODEL_KEYS = ['lambda', 'multiplier', 'expected', 'credibility', 'inertia', 'rateSensitivity', 'fiscalLag', 'monetaryLag', 'lag', 'lambdaLate', 'switchRound'];
  function tuneKey(settings, scoring, o) {
    var sc = E.scoringOf(scoring);
    return JSON.stringify([MODEL_KEYS.map(function (k) { return settings[k] == null ? null : settings[k]; }),
      persistenceOf(settings), sc.wU, sc.wPi, o.discount, o.tail, COST_GRID]);
  }
  // How fast events fade in the game this economy is in (set on its settings by the game).
  function persistenceOf(settings) { return settings._persistence != null ? settings._persistence : E.PERSISTENCE; }
  // Precomputed results for the presets (tuned_costs.js, written by
  // scripts/tune_costs.js), so the usual games need no tuning at the start;
  // anything else is tuned in the browser (0.1 to 0.3 s on a laptop).
  var TUNED = (root.PU && root.PU.tunedTable) || null;
  if (!TUNED && typeof require === 'function') { try { TUNED = require('./tuned_costs.js'); } catch (e) { TUNED = null; } }
  var tuneCache = {};
  function tunedCosts(settings, scoring, opts) {
    var o = Object.assign({}, DEFAULTS, opts || {});
    var key = tuneKey(settings, scoring, o);
    var fresh = !!(opts && opts.fresh);   // tune now, ignoring the cache and the table
    if (!fresh && tuneCache[key]) return tuneCache[key];
    if (!fresh && TUNED && TUNED[key]) return (tuneCache[key] = TUNED[key]);
    var games = E.EVENTS.map(function (ev) {
      var g = E.createGame({ rounds: TUNE_ROUNDS, shockMode: 'event', event: ev, scoring: scoring, persistence: persistenceOf(settings), noBaseline: true, universes: { a: settings } });
      g.step({});
      return { g: g, none: Math.max(1, nonePlan(g, o).loss) };
    });
    var best = null;
    COST_GRID.fiscal.forEach(function (cf) {
      COST_GRID.rate.forEach(function (cr) {
        var oc = Object.assign({}, o, { tuneCosts: false, costFiscal: cf, costRate: cr });
        var score = 0;
        games.forEach(function (x) { score += lqPlan(x.g, oc).loss / x.none; });
        score /= games.length;
        if (!best || score < best.score - 1e-12) best = { costFiscal: cf, costRate: cr, score: score };
      });
    });
    tuneCache[key] = best;
    return best;
  }
  // The options with the costs filled in: tuned, unless tuning is off.
  function withCosts(settings, scoring, opts) {
    var o = Object.assign({}, DEFAULTS, opts || {});
    if (o.tuneCosts === false) return o;
    var t = tunedCosts(settings, scoring, o);
    return Object.assign(o, { tuneCosts: false, costFiscal: t.costFiscal, costRate: t.costRate });
  }

  // ---- In the game -----------------------------------------------------------
  // The optimal rule as an autopilot: the engine asks for a choice each round.
  // Rules are cached by settings, welfare weights, adjustment speed and options.
  var ruleCache = {};
  function cachedRule(settings, round, scoring, opts) {
    var o = withCosts(settings, scoring, opts);
    var lam = E.lambdaAt(settings, round);
    var key = JSON.stringify([settings, lam, scoring && [scoring.wU, scoring.wPi], o.discount, o.costFiscal, o.costRate]);
    if (!ruleCache[key]) ruleCache[key] = lqRule(settings, Object.assign({}, o, { round: round, scoring: scoring }));
    return ruleCache[key];
  }
  E.setOptimalRule(function (u, round, scoring, opts) {
    var c = ruleChoice(cachedRule(u.settings, round, scoring, opts), u, round);
    return { spending: c.spending, rate: c.rate };
  });

  // A one-universe copy of a game (the benchmarks are per universe).
  function soloGame(game, k) {
    var g = game.clone();
    g.keys = [k];
    var u = g.universes[k];
    g.universes = {}; g.universes[k] = u;
    g.baseline = null;
    g.autopilot = { monetary: false, fiscal: false };
    return g;
  }

  // The benchmark for one universe, from a game right after round 1: the
  // optimal plan by search (started from no change, the no-policy path, the
  // Taylor rule's path and the optimal rule's path), and no policy, each scored over the game plus tail.
  function benchmark(game, k, opts) {
    opts = Object.assign({}, DEFAULTS, opts || {});
    var g1 = soloGame(game, k);
    var none = nonePlan(g1, opts), tay = taylorPlan(g1, opts), lq = lqPlan(g1, opts);
    var n = g1.rounds;
    var taylorStart = tay.history.slice(2, n + 1).map(function (r) { return { spending: 0, rate: r.rate || 0 }; });
    var noneStart = none.history.slice(2, n + 1).map(function (r) { return { spending: 0, rate: r.rate || 0 }; });
    var best = searchPlan(g1, Object.assign({}, opts, { starts: [noneStart, taylorStart, lq.choices] }));
    return { k: k, none: none, taylor: tay, lqRule: lq, optimal: best, tail: opts.tail };
  }

  // Both scores for one universe at the end of a game: the class's path, no
  // policy and the optimal plan, each with the tail rounds counted.
  //   vsNone: percent of the no-policy loss avoided;
  //   achievable: percent of the achievable gain captured (100 = optimal).
  function finalScores(game, k, bench, opts) {
    opts = Object.assign({}, DEFAULTS, opts || {});
    var g = soloGame(game, k);
    g.rounds = game.rounds + opts.tail;
    g.autopilot = { monetary: 'neutral', fiscal: false };
    while (!g.isOver()) g.step({});
    var h = g.universes[k].history, Ly = 0;
    for (var i = 1; i < h.length; i++) Ly += h[i].loss;
    var Ln = bench.none.loss, Lo = Math.min(bench.optimal.loss, Ly);
    var MIN = E.WELFARE_MIN_LOSS;
    return {
      loss: Ly, lossNone: Ln, lossOptimal: Lo,
      vsNone: Ln > MIN ? 100 * (Ln - Ly) / Ln : null,
      achievable: Ln - Lo > MIN ? 100 * (Ln - Ly) / (Ln - Lo) : null,
      history: h
    };
  }

  // The optimal rule described as a Taylor-type rule: fit the rate it sets to
  // last round's inflation and output gap over its own paths after each event.
  // Returns the inflation and gap weights and how well that summary fits (R^2).
  function effectiveWeights(settings, scoring, opts) {
    opts = Object.assign({}, DEFAULTS, opts || {});
    var X = [], Y = [];
    E.EVENTS.forEach(function (ev) {
      var g = E.createGame({ rounds: 12, shockMode: 'event', event: ev, scoring: scoring, persistence: persistenceOf(settings), noBaseline: true, universes: { a: settings } });
      g.step({});
      var p = lqPlan(g, opts), h = p.history;
      for (var t = 2; t <= 12; t++) {
        var last = h[t - 1], r = h[t];
        X.push([1, last.inflation - 2, last.gapPct]);
        Y.push(r.rateLevel - last.inflation - TAYLOR_NEUTRAL);
      }
    });
    // Least squares by the normal equations (3 by 3).
    var XtX = mul(T(X), X), XtY = mul(T(X), Y.map(function (y) { return [y]; }));
    var b = solve3(XtX, XtY.map(function (r) { return r[0]; }));
    var mean = Y.reduce(function (s, y) { return s + y; }, 0) / Y.length, ss = 0, sr = 0;
    Y.forEach(function (y, i) { var f = b[0] + b[1] * X[i][1] + b[2] * X[i][2]; ss += (y - mean) * (y - mean); sr += (y - f) * (y - f); });
    return { inflation: b[1], gap: b[2], r2: ss > 0 ? 1 - sr / ss : 1 };
  }
  var TAYLOR_NEUTRAL = 1;
  function solve3(A, bv) {
    var m = A.map(function (r, i) { return r.concat([bv[i]]); });
    for (var c = 0; c < 3; c++) {
      var piv = c; for (var r = c + 1; r < 3; r++) if (Math.abs(m[r][c]) > Math.abs(m[piv][c])) piv = r;
      var tmp = m[c]; m[c] = m[piv]; m[piv] = tmp;
      for (r = 0; r < 3; r++) if (r !== c) { var f = m[r][c] / m[c][c]; for (var j = c; j < 4; j++) m[r][j] -= f * m[c][j]; }
    }
    return [m[0][3] / m[0][0], m[1][3] / m[1][1], m[2][3] / m[2][2]];
  }

  var optimal = {
    DEFAULTS: DEFAULTS, stateSize: stateSize, extract: extract, transition: transition,
    linearize: linearize, lqRule: lqRule, ruleChoice: ruleChoice,
    play: play, lqPlan: lqPlan, nonePlan: nonePlan, taylorPlan: taylorPlan, searchPlan: searchPlan,
    soloGame: soloGame, benchmark: benchmark, finalScores: finalScores, effectiveWeights: effectiveWeights, cachedRule: cachedRule,
    tunedCosts: tunedCosts, withCosts: withCosts, tuneKey: tuneKey, COST_GRID: COST_GRID
  };
  root.PU = root.PU || {};
  root.PU.optimal = optimal;
  if (typeof module !== 'undefined' && module.exports) module.exports = optimal;
})(typeof window !== 'undefined' ? window : globalThis);
