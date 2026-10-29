/*
 * Macro Control Room: the model.
 *
 * The same illustrative AD/AS curves as the ECON 202 slides (macro_principles repo,
 * slides/neoclassical_slides.qmd:45-46) and
 * the same adjustment rule as its simulate() (line 316): each round, wages close
 * lambda times the output gap. All numbers are illustrative, not estimated.
 *
 * Plain script, no modules, so the app also runs from file:// and any static
 * server. Exposes window.PU.engine; under Node, module.exports for the tests in
 * tests/test_engine.js.
 *
 * Shifts are in units of real GDP. A positive shift moves a curve right.
 *   AD:   P = 90 + 0.02 * (8800 + ad - y)
 *   SRAS: P = 80 + C / (K + sras + lras - y)
 * The slides use K = 10000, C = 12000. The game uses a flatter SRAS with the
 * same starting point (K = 13900, C = 105600, still through 9,500 and 104):
 * the slides' SRAS moves the price level about 4% for a 1% output gap, which
 * with adaptive expectations makes inflation feed on itself. The flatter
 * curve gives a Phillips-curve slope near 0.5, in line with Mankiw's
 * illustrative values.
 *   LRAS: potential = 9500 + lras
 * Starting point: ad = 1400, sras = 0, lras = 0, so real GDP 9,500 and price 104.
 *
 * Expectations: people expect inflation of
 *   pi_e = k * 2 + (1 - k) * (last round's inflation),
 * where k is the central bank's credibility. k = 0 is Mankiw's adaptive
 * expectations; k near 1 is a credible central bank with expectations
 * anchored at the 2% target. Wages and prices are set to rise by pi_e, and
 * spending in dollars keeps pace, so each round SRAS and AD both shift up by
 * the expected inflation above 2%.
 *
 * Monetary policy works through the real interest rate (the Fisher equation,
 * r = i - pi_e): AD shifts by -beta * (r - r*), with r* = 1%. If inflation
 * expectations rise and the nominal rate does not, the real rate falls and
 * AD rises, so the central bank must raise the nominal rate by more than
 * inflation to cool the economy (the Taylor principle).
 *
 * Policy: Team Fiscal moves government spending and taxes, Team Monetary moves
 * the interest rate. Each arrives as an AD shift after its own lag. A rise in
 * potential GDP also lifts AD by half as much (firms invest in the new
 * technology and incomes rise), so output follows potential part of the way.
 */
(function (root) {
  'use strict';

  var BASE_POTENTIAL = 9500;
  var START_AD = 1400;
  var NATURAL_RATE = 5;      // unemployment at potential, percent
  var TREND_INFLATION = 2;   // inflation with a steady price level, percent
  var INFLATION_TARGET = 2;
  var OKUN = 0.5;            // unemployment points per 1% output gap
  var SUPPLY_DELAY = 3;      // rounds before investment raises potential
  var SUPPLY_GAIN = 50;      // potential GDP added per investment step
  var DEMAND_STEP = 50;      // AD shift per spending step, before the multiplier
  var TAX_SHARE = 0.75;      // a tax step moves AD by this share of a spending step (people save part)
  var RATE_EFFECT = 150;     // AD shift per percentage point of interest rate change, opposite sign
  var START_RATE = 3;        // nominal interest rate at the start, percent
  var R_STAR = 1;            // neutral real rate: START_RATE minus the 2% target
  var BETA = 50;             // AD shift per point of real rate above or below neutral (opposite sign)
  var RATE_MAX = 10;
  var GROWTH_AD_SHARE = 0.5; // AD rises by this share of any rise in potential GDP
  // Autopilot rules.
  // Taylor rule (Mankiw's form, his 0.5 weights): the target rate is the neutral
  // real rate plus inflation, plus half the inflation gap, plus half the output
  // gap. smoothing: each round the rate moves this share of the way to the
  // target, as in estimated Taylor rules (Clarida, Gali and Gertler 2000). With
  // no smoothing the rule chases last round's inflation and swings by the full
  // 2 points every round in the New Keynesian and neoclassical economies.
  var TAYLOR = { neutralReal: R_STAR, onInflation: 0.5, onGap: 0.5, smoothing: 0.5 };
  // Balanced budget: tax revenue is this share of GDP, and spending must move
  // with revenue, so a fall in GDP forces an equal fall in spending.
  var TAX_RATE = 0.25;
  // The budget: tax revenue is TAX_RATE of real GDP plus the tax steps taken;
  // government spending starts at the revenue of the starting economy (a
  // balanced budget) plus the spending steps taken. A spending or tax step is
  // DEMAND_STEP of real GDP, counted when it takes effect. The deficit, G - T,
  // is reported as a percent of real GDP. Revenue falls in a slump, so the
  // deficit opens with no change in policy (an automatic stabilizer).
  var G0 = TAX_RATE * BASE_POTENTIAL;
  // The green zone: the mission is to get both into it and keep them there.
  var ZONE = { unemployment: [4.5, 5.5], inflation: [1, 3] };
  // Limits on how far AD and the wage part of SRAS can move from the start, so
  // stacked policy moves or repeated shocks keep the economy on the chart
  // instead of running the curves past where they mean anything.
  var AD_MIN = START_AD - 3000, AD_MAX = START_AD + 3000;
  var SRAS_MIN = -5000, SRAS_MAX = 5000;

  // Points per round: start at 10, lose 3 per point of unemployment away from
  // the natural rate and 1 per point of inflation away from target, pay 2 per
  // investment step, gain 1 per 100 of potential GDP above where it started.
  // Weights chosen so a well-timed stimulus raises the Keynesian score and
  // lowers the neoclassical one in the scripted game.
  var SCORE = { base: 10, unemployment: 3, inflation: 1, investCost: 2, growthPer100: 1 };

  var CURVES = {
    game: { K: 13900, C: 105600 },
    slides: { K: 10000, C: 12000 }
  };
  var SR = CURVES.game;
  function useCurves(name) { SR = CURVES[name] || CURVES.game; }
  function adP(y, ad) { return 90 + 0.02 * (8800 + ad - y); }
  function srasP(y, sras, lras) { return 80 + SR.C / (SR.K + sras + (lras || 0) - y); }
  // How far SRAS must shift (in GDP units) to move output by one unit at
  // potential: wage adjustment lambda is scaled by this so that lambda is the
  // share of the output gap closed in a round.
  function gapCloseFactor() {
    var srSlope = SR.C / Math.pow(SR.K - BASE_POTENTIAL, 2);
    return (0.02 + srSlope) / srSlope;
  }
  function potential(lras) { return BASE_POTENTIAL + (lras || 0); }

  // Short-run equilibrium by bisection. SRAS minus AD rises in y and goes to
  // +infinity at the SRAS pole, so there is exactly one crossing below it.
  function equilibrium(ad, sras, lras) {
    lras = lras || 0;
    var lo = 0, hi = SR.K + sras + lras - 1e-9;
    var f = function (y) { return srasP(y, sras, lras) - adP(y, ad); };
    for (var i = 0; i < 200 && hi - lo > 1e-9; i++) {
      var mid = (lo + hi) / 2;
      if (f(mid) > 0) hi = mid; else lo = mid;
    }
    var y = (lo + hi) / 2;
    return { y: y, p: adP(y, ad) };
  }

  // The wage shift that puts SRAS through price p at real GDP y.
  function srasThrough(y, p, lras) {
    return SR.C / (Math.max(p, 81) - 80) - SR.K + y - (lras || 0);
  }

  // The wage shift that puts short-run equilibrium at real GDP y for a given AD.
  // SRAS never reaches a price of 80, so y is capped where AD is still above 81.
  function srasFor(y, ad, lras) {
    y = Math.min(y, 8800 + ad + 450);
    return SR.C / (adP(y, ad) - 80) - SR.K + y - (lras || 0);
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  // Schools of thought. credibility: how firmly expectations are anchored at
  // 2% (0 = adaptive, Mankiw's model). Monetarist is 0.1 rather than 0: at 0,
  // with the rate held, a boom or slump feeds on itself until AD or SRAS hits
  // its limit, and the economy then sits frozen off target. taylor: the preset turns the Taylor-rule
  // autopilot on when it is chosen (the game can still override).
  var PRESETS = {
    keynesian: {
      label: 'Keynesian', lambda: 0.10, multiplier: 2, expected: 0, credibility: 0.3, rateSensitivity: 75, fiscalLag: 1, monetaryLag: 0,
      lambdaLate: null, switchRound: null, taylor: false
    },
    neoclassical: {
      label: 'Neoclassical', lambda: 0.7, multiplier: 1, expected: 1, credibility: 0.9, rateSensitivity: 50, fiscalLag: 1, monetaryLag: 0,
      lambdaLate: null, switchRound: null, taylor: false
    },
    newkeynesian: {
      label: 'New Keynesian', lambda: 0.3, multiplier: 1.5, expected: 0.5, credibility: 0.8, rateSensitivity: 100, fiscalLag: 1, monetaryLag: 0,
      lambdaLate: null, switchRound: null, taylor: true
    },
    monetarist: {
      label: 'Monetarist', lambda: 0.4, multiplier: 1, expected: 0.3, credibility: 0.1, rateSensitivity: 50, fiscalLag: 1, monetaryLag: 0,
      lambdaLate: null, switchRound: null, taylor: false
    },
    realworld: {
      label: 'Real world', lambda: 0.10, multiplier: 2, expected: 0, credibility: 0.5, rateSensitivity: 50, fiscalLag: 1, monetaryLag: 0,
      lambdaLate: 0.5, switchRound: 5, taylor: false
    }
  };

  // Ranges for the settings controls.
  var RANGES = {
    lambda: { min: 0, max: 1.5, step: 0.05 },
    multiplier: { min: 1, max: 4, step: 0.1 },
    expected: { min: 0, max: 1, step: 0.05 },
    inertia: { min: 0, max: 1, step: 0.05 },
    credibility: { min: 0, max: 1, step: 0.05 },
    rateSensitivity: { min: 50, max: 300, step: 25 },
    zoneUnemployment: { min: 0.25, max: 2, step: 0.25 },
    zoneInflation: { min: 0.5, max: 3, step: 0.25 },
    weight: { min: 0, max: 2, step: 1 },
    fiscalLag: { min: 0, max: 3, step: 1 },
    monetaryLag: { min: 0, max: 3, step: 1 },
    lambdaLate: { min: 0, max: 1.5, step: 0.05 },
    switchRound: { min: 1, max: 20, step: 1 },
    rounds: { min: 4, max: 20, step: 1 },
    persistence: { min: 0.5, max: 1, step: 0.05 },
    spending: { min: -4, max: 4, step: 1 },
    taxes: { min: -4, max: 4, step: 1 },
    rate: { min: -2, max: 2, step: 0.25 },  // 25 basis points a step
    supply: { min: 0, max: 3, step: 1 }
  };

  // headline and what happens: the event card at the start of a game.
  var SHOCKS = {
    none: { label: 'No shock', ad: 0, sras: 0, lras: 0 },
    demand_drop: {
      label: 'Demand falls', ad: -350, sras: 0, lras: 0,
      headline: 'Consumer confidence collapses',
      what: 'Households and businesses cut spending. AD shifts left: output falls and unemployment rises.'
    },
    boom: {
      label: 'Boom', ad: 250, sras: 0, lras: 0,
      headline: 'A spending boom takes off',
      what: 'Households and businesses spend freely. AD shifts right: output rises above potential and prices climb.'
    },
    oil: {
      label: 'Oil shock', ad: 0, sras: -800, lras: 0,
      headline: 'Oil prices spike',
      what: 'Production costs jump. SRAS shifts left: output falls and prices rise at the same time.'
    },
    productivity: {
      label: 'Productivity gain', ad: 0, sras: 0, lras: 200,
      headline: 'New technology raises productivity',
      what: 'The economy can produce more. LRAS and SRAS shift right, and AD follows part of the way.'
    }
  };
  var EVENTS = ['demand_drop', 'boom', 'oil', 'productivity'];
  // How much of a demand or cost shock is still in place a round later
  // (game option persistence; 1 = permanent).
  var PERSISTENCE = 0.9;

  // The scripted game: round number to shock key.
  var SCRIPT = { 2: 'demand_drop', 5: 'oil', 7: 'boom', 9: 'productivity' };

  function scriptedShock(round) { return SCRIPT[round] || 'none'; }

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function lambdaAt(settings, round) {
    if (settings.lambdaLate != null && settings.switchRound != null && round >= settings.switchRound) {
      return settings.lambdaLate;
    }
    return settings.lambda;
  }

  function unemployment(gapPct) { return Math.max(2, NATURAL_RATE - OKUN * gapPct); }

  function inZone(u, inflation, zone) {
    zone = zone || ZONE;
    return {
      unemployment: u >= zone.unemployment[0] && u <= zone.unemployment[1],
      inflation: inflation >= zone.inflation[0] && inflation <= zone.inflation[1]
    };
  }

  // Scoring: the Fed's dual mandate. opts: { on, uBand, piBand, wU, wPi }:
  // unemployment within uBand of the natural rate, inflation within piBand of
  // the 2% target, and a weight (stars) on each.
  function scoringOf(o) {
    o = o || {};
    var sc = {
      on: o.on !== false,
      uBand: o.uBand != null ? o.uBand : 0.5,
      piBand: o.piBand != null ? o.piBand : 1,
      wU: o.wU != null ? o.wU : 1,
      wPi: o.wPi != null ? o.wPi : 1
    };
    sc.zone = {
      unemployment: [NATURAL_RATE - sc.uBand, NATURAL_RATE + sc.uBand],
      inflation: [INFLATION_TARGET - sc.piBand, INFLATION_TARGET + sc.piBand]
    };
    return sc;
  }
  function credibilityOf(s) {
    if (s.credibility != null) return s.credibility;
    if (s.inertia != null) return 1 - s.inertia;
    return 0.5;
  }

  function roundPoints(u, inflation, supplySteps, pot) {
    var pts = SCORE.base
      - SCORE.unemployment * Math.abs(u - NATURAL_RATE)
      - SCORE.inflation * Math.abs(inflation - INFLATION_TARGET)
      - SCORE.investCost * supplySteps
      + SCORE.growthPer100 * (pot - BASE_POTENTIAL) / 100;
    return Math.round(pts * 10) / 10;
  }

  // One universe: its settings and its state, stepped a round at a time.
  function Universe(settings) {
    this.settings = clone(settings);
    this.ad = START_AD;
    this.sras = 0;
    // The nominal scale of all prices. Expected inflation raises it each round,
    // so AD and SRAS both scale up by that much at every output level. The
    // curves themselves (ad, sras) hold only real shifts, which are capped;
    // the scale is not, so a long inflation or deflation can never hit a cap
    // or the SRAS floor, and the curves keep their shape at any price level.
    this.nom = 1;
    this.adNom = 0;
    this.srasNom = 0;
    this.lras = 0;
    this.pendingDemand = [];  // { arrives, shift, kind: 'fiscal'|'monetary' } with shift already multiplied
    this.pendingSupply = [];  // { arrives, gain }
    this.score = 0;
    this.expectedExtra = 0;   // expected inflation above the 2% target, percent
    this.rate = START_RATE;   // this universe's nominal rate as set (autopilot can differ by universe)
    this.iEff = START_RATE;   // the nominal rate that has reached the economy (after lags)
    this.adMon = 0;           // the part of AD set by the real interest rate
    this.scoring = scoringOf(settings._scoring);
    this.govSteps = 0;        // spending and tax changes that have taken effect, real GDP units
    this.taxSteps = 0;
    this.shockAd = 0;         // the part of AD and SRAS shifts from events still in place (fades with persistence)
    this.shockSras = 0;
    this.atLimit = false;     // set when AD or SRAS is pushed past its limit; read and cleared by record()
    var e = equilibrium(this.ad, this.sras, this.lras);
    this.history = [this.record(0, e, null, 'none', {}, {}, 0)];
  }

  // A full copy that plays on independently (records are never changed after
  // they are made, so the history array is copied but its records are shared).
  Universe.prototype.clone = function () {
    var c = Object.create(Universe.prototype);
    for (var k in this) {
      if (!Object.prototype.hasOwnProperty.call(this, k)) continue;
      var v = this[k];
      if (k === 'history') c[k] = v.slice();
      else if (k === 'pendingDemand' || k === 'pendingSupply') c[k] = v.map(function (d) { return Object.assign({}, d); });
      else if (v && typeof v === 'object') c[k] = clone(v);
      else c[k] = v;
    }
    return c;
  };

  // A move past a limit is cut off and noted (atLimit), so the screens can say
  // the economy has left the range the model can show instead of freezing silently.
  Universe.prototype.setAd = function (v) {
    var real = v - this.adNom;
    if (real < AD_MIN - 1e-9 || real > AD_MAX + 1e-9) this.atLimit = true;
    this.ad = this.adNom + clamp(real, AD_MIN, AD_MAX);
  };
  Universe.prototype.setSras = function (v) {
    var real = v - this.srasNom;
    if (real < SRAS_MIN - 1e-9 || real > SRAS_MAX + 1e-9) this.atLimit = true;
    this.sras = this.srasNom + clamp(real, SRAS_MIN, SRAS_MAX);
  };

  Universe.prototype.raisePotential = function (gain) {
    this.lras += gain;
    this.setAd(this.ad + GROWTH_AD_SHARE * gain);
  };

  // choice: the round's policy; arrived: { fiscal, monetary } booleans.
  Universe.prototype.record = function (round, e, prevP, shock, choice, arrived, points) {
    var pot = potential(this.lras);
    var gap = e.y - pot;
    var gapPct = 100 * gap / pot;
    // A limit hit since the last record (including last round's wage adjustment).
    var hitLimit = !!this.atLimit;
    this.atLimit = false;
    var inflation = prevP == null ? TREND_INFLATION : TREND_INFLATION + 100 * (e.p / prevP - 1);
    var u = unemployment(gapPct);
    var sc = this.scoring || scoringOf();
    var zone = inZone(u, inflation, sc.zone);
    return {
      round: round,
      y: e.y, p: e.p, potential: pot,
      gap: gap, gapPct: gapPct,
      unemployment: u, inflation: inflation,
      ad: this.ad, sras: this.sras, lras: this.lras, nom: this.nom,
      shock: shock,
      spending: choice.spending || 0, taxes: choice.taxes || 0, rate: choice.rate || 0,
      rateLevel: choice.rateLevel != null ? choice.rateLevel : START_RATE,
      autoRate: !!choice.autoRate, taylorTarget: choice.taylorTarget != null ? choice.taylorTarget : null,
      autoRateMode: choice.autoRateMode || null, autoFiscalMode: choice.autoFiscalMode || null,
      autoSpending: choice.autoSpending || 0,
      supply: choice.supply || 0,
      demand: choice.spending || 0,
      fiscalArrived: !!arrived.fiscal, monetaryArrived: !!arrived.monetary,
      policyArrived: !!(arrived.fiscal || arrived.monetary),
      inZone: zone,
      stars: sc.on ? (zone.unemployment ? sc.wU : 0) + (zone.inflation ? sc.wPi : 0) : 0,
      // The round's welfare loss: the dual mandate as a quadratic loss.
      loss: round === 0 ? 0 : sc.wU * Math.pow(u - NATURAL_RATE, 2) + sc.wPi * Math.pow(inflation - INFLATION_TARGET, 2),
      govSpending: G0 + (this.govSteps || 0),
      taxRevenue: TAX_RATE * e.y + (this.taxSteps || 0),
      deficitPct: 100 * (G0 + (this.govSteps || 0) - TAX_RATE * e.y - (this.taxSteps || 0)) / e.y,
      expectedInflation: INFLATION_TARGET + (this.expectedExtra || 0),
      nominalRate: this.iEff, realRate: this.iEff - (INFLATION_TARGET + (this.expectedExtra || 0)),
      points: points, score: this.score,
      atLimit: hitLimit
    };
  };

  // Order within a round: the shock hits, the round's choices are queued, any
  // policy due this round arrives (the expected share is matched by SRAS at
  // once), the economy settles, the round is scored, and then wages adjust.
  // The Taylor rule as in Mankiw: target i = pi + r* + 0.5 (pi - 2) + 0.5 (output gap),
  // from last round's inflation and output gap, held at 0 or above. The rate
  // moves TAYLOR.smoothing of the way to the target, in 25 basis point steps of
  // at most 2 points a round.
  Universe.prototype.taylorChange = function () {
    var last = this.history[this.history.length - 1];
    var target = last.inflation + TAYLOR.neutralReal + TAYLOR.onInflation * (last.inflation - INFLATION_TARGET)
      + TAYLOR.onGap * last.gapPct;
    target = clamp(target, 0, RATE_MAX);
    var want = (1 - TAYLOR.smoothing) * (target - this.rate);
    var change = clamp(Math.round(want * 4) / 4, -2, 2);
    return { change: change, target: target };
  };

  // No monetary policy: the nominal rate that holds the real rate at its neutral
  // level given this round's expected inflation (i = pi_e + r*), at 0 or above.
  // Holding the nominal rate fixed instead would be a policy, and an unstable
  // one: with expectations that follow inflation, a fixed nominal rate lets the
  // real rate fall as inflation rises, so a boom or a slump feeds on itself.
  Universe.prototype.neutralRate = function () {
    return clamp(INFLATION_TARGET + (this.expectedExtra || 0) + R_STAR, 0, RATE_MAX);
  };

  // The spending change a balanced budget forces: revenue moved with GDP last
  // round, so spending moves the same amount (in units of real GDP).
  Universe.prototype.balancedBudgetSpending = function () {
    var h = this.history;
    if (h.length < 2) return 0;
    return TAX_RATE * (h[h.length - 1].y - h[h.length - 2].y);
  };

  // choice: { spending, taxes, rate, rateLevel, supply }. The old form
  // step(round, shock, demand, supply) still works: demand is spending.
  Universe.prototype.step = function (round, shockKey, choice, supplyOld) {
    if (typeof choice !== 'object' || choice === null) choice = { spending: choice || 0, supply: supplyOld || 0 };
    var s = this.settings;
    var fLag = s.fiscalLag != null ? s.fiscalLag : (s.lag != null ? s.lag : 1);
    var mLag = s.monetaryLag != null ? s.monetaryLag : fLag;
    // Expected inflation first: wages and prices are set to rise by what
    // people expect, so SRAS shifts up by that much at last round's output.
    if (this.expectedExtra) {
      this.nom *= 1 + this.expectedExtra / 100;
    }
    // The real rate: with the nominal rate in effect and this round's expected
    // inflation, AD sits beta per point away from where the neutral rate puts it.
    var beta = s.rateSensitivity != null ? s.rateSensitivity : BETA;
    var piE = INFLATION_TARGET + (this.expectedExtra || 0);
    var adMonNow = -beta * ((this.iEff - piE) - R_STAR);
    this.setAd(this.ad + (adMonNow - this.adMon));
    this.adMon = adMonNow;

    // Events fade: each round the part of a demand or cost shock still in
    // place shrinks to `persistence` times what it was (1 = it never fades).
    // A gain in potential GDP is permanent and does not fade.
    var rho = s._persistence != null ? s._persistence : 1;
    if (rho < 1) {
      var dAd = (1 - rho) * this.shockAd, dSras = (1 - rho) * this.shockSras;
      this.setAd(this.ad - dAd); this.shockAd -= dAd;
      this.setSras(this.sras - dSras); this.shockSras -= dSras;
    }
    var shock = SHOCKS[shockKey] || SHOCKS.none;
    this.setAd(this.ad + shock.ad);
    this.setSras(this.sras + shock.sras);
    this.shockAd += shock.ad; this.shockSras += shock.sras;
    if (shock.lras) this.raisePotential(shock.lras);

    // The budget changes behind this round's fiscal choices, in real GDP units.
    var dG = (choice.spending || 0) * DEMAND_STEP + (choice.autoSpending || 0);
    var dT = (choice.taxes || 0) * DEMAND_STEP;
    var fiscal = (choice.spending || 0) * DEMAND_STEP * s.multiplier
      - (choice.taxes || 0) * DEMAND_STEP * s.multiplier * TAX_SHARE
      + (choice.autoSpending || 0) * s.multiplier;
    var dRate = choice.rate || 0;
    // Each policy works through the economy over two rounds: half arrives
    // after its lag and half the round after, so its effect builds gradually.
    // A rate change reaches the economy as a change in the nominal rate in
    // effect, and so in the real rate.
    var self = this;
    if (fiscal) {
      self.pendingDemand.push({ arrives: round + fLag, shift: fiscal / 2, dG: dG / 2, dT: dT / 2, kind: 'fiscal' });
      self.pendingDemand.push({ arrives: round + fLag + 1, shift: fiscal / 2, dG: dG / 2, dT: dT / 2, kind: 'fiscal' });
    }
    if (dRate) {
      self.pendingDemand.push({ arrives: round + mLag, dRate: dRate / 2, shift: -beta * dRate / 2, kind: 'monetary' });
      self.pendingDemand.push({ arrives: round + mLag + 1, dRate: dRate / 2, shift: -beta * dRate / 2, kind: 'monetary' });
    }
    if (choice.supply) this.pendingSupply.push({ arrives: round + SUPPLY_DELAY, gain: choice.supply * SUPPLY_GAIN });

    var before = equilibrium(this.ad, this.sras, this.lras);
    var arrived = { fiscal: false, monetary: false };
    var keep = [];
    for (var i = 0; i < this.pendingDemand.length; i++) {
      var d = this.pendingDemand[i];
      if (d.arrives <= round) {
        this.setAd(this.ad + d.shift);
        if (d.dRate) { this.iEff += d.dRate; this.adMon += d.shift; }
        if (d.dG) this.govSteps += d.dG;
        if (d.dT) this.taxSteps += d.dT;
        arrived[d.kind || 'fiscal'] = true;
      } else keep.push(d);
    }
    this.pendingDemand = keep;
    if ((arrived.fiscal || arrived.monetary) && s.expected > 0) {
      this.setSras(this.sras + s.expected * (srasFor(before.y, this.ad, this.lras) - this.sras));
    }
    keep = [];
    for (i = 0; i < this.pendingSupply.length; i++) {
      var g = this.pendingSupply[i];
      if (g.arrives <= round) this.raisePotential(g.gain); else keep.push(g);
    }
    this.pendingSupply = keep;

    var e = equilibrium(this.ad, this.sras, this.lras);
    e = { y: e.y, p: e.p * this.nom };
    var prevP = this.history[this.history.length - 1].p;
    var rec = this.record(round, e, prevP, shockKey, choice, arrived, 0);
    rec.points = roundPoints(rec.unemployment, rec.inflation, choice.supply || 0, rec.potential);
    this.score = Math.round((this.score + rec.points) * 10) / 10;
    rec.score = this.score;
    this.history.push(rec);

    // Next round's expectations: k * 2% + (1 - k) * this round's inflation.
    this.expectedExtra = (1 - credibilityOf(s)) * (rec.inflation - INFLATION_TARGET);
    rec.expectedNext = INFLATION_TARGET + this.expectedExtra;
    this.setSras(this.sras - lambdaAt(s, round) * gapCloseFactor() * (e.y - rec.potential));
    return rec;
  };

  // A game: two universes, the same shocks and the same choices.
  // opts: { rounds, shockMode: 'event' | 'scripted' | 'custom', event, universes: { a: settings, b: settings } }
  // 'event': one event hits in round 1 (opts.event, a SHOCKS key) and the teams respond.
  // opts.autopilot: { monetary: false | 'taylor' | 'optimal' | 'neutral', fiscal: false | 'balanced' | 'optimal' }
  // 'neutral' is no monetary policy: the nominal rate follows expected inflation
  // so the real rate stays at its neutral 1% (see neutralRate).
  // (true means 'taylor' and 'balanced', as in older links). 'optimal' is the
  // linear-quadratic optimal rule from optimal.js, which registers itself with
  // setOptimalRule; without it, 'optimal' falls back to the plain rule.
  function autopilotOf(a) {
    a = a || {};
    var m = a.monetary === true ? 'taylor' : (a.monetary === 'taylor' || a.monetary === 'optimal' || a.monetary === 'neutral' ? a.monetary : false);
    var f = a.fiscal === true ? 'balanced' : (a.fiscal === 'balanced' || a.fiscal === 'optimal' ? a.fiscal : false);
    return { monetary: m, fiscal: f };
  }
  var optimalRule = null;  // function (universe, round, scoring, opts) -> { spending, rate }
  function setOptimalRule(fn) { optimalRule = fn; }

  // Every game also runs a no-policy twin (game.baseline): same universes, same
  // shocks, no fiscal choices, and the real rate held at neutral (the 'neutral'
  // monetary mode), so the views can show what would have happened if nobody
  // had acted.
  function Game(opts) {
    this.rounds = opts.rounds || 10;
    this.shockMode = opts.shockMode || 'scripted';
    this.event = opts.event || 'demand_drop';
    this.autopilot = autopilotOf(opts.autopilot);
    this.optimalOpts = opts.optimal || {};
    this.scoring = scoringOf(opts.scoring);
    this.persistence = opts.persistence != null ? opts.persistence : PERSISTENCE;
    this.rate = START_RATE;
    this.round = 0;
    this.keys = Object.keys(opts.universes);
    this.universes = {};
    for (var i = 0; i < this.keys.length; i++) {
      var us = clone(opts.universes[this.keys[i]]);
      us._scoring = opts.scoring;
      us._persistence = this.persistence;
      this.universes[this.keys[i]] = new Universe(us);
    }
    this.baseline = opts.noBaseline ? null
      : new Game({ rounds: this.rounds, shockMode: this.shockMode, event: this.event, scoring: opts.scoring, persistence: this.persistence, universes: opts.universes, noBaseline: true, autopilot: { monetary: 'neutral' } });
  }

  // A full copy of the game at its current round (the no-policy twin too), so
  // a game can be branched and replayed. opts.rounds changes the copy's length
  // (to play tail rounds after the game, for example).
  Game.prototype.clone = function (opts) {
    var c = Object.create(Game.prototype);
    c.rounds = opts && opts.rounds != null ? opts.rounds : this.rounds;
    c.shockMode = this.shockMode;
    c.event = this.event;
    c.autopilot = { monetary: this.autopilot.monetary, fiscal: this.autopilot.fiscal };
    c.optimalOpts = this.optimalOpts;
    c.scoring = clone(this.scoring);
    c.persistence = this.persistence;
    c.rate = this.rate;
    c.round = this.round;
    c.keys = this.keys.slice();
    c.universes = {};
    for (var i = 0; i < this.keys.length; i++) c.universes[this.keys[i]] = this.universes[this.keys[i]].clone();
    c.baseline = this.baseline ? this.baseline.clone(opts) : null;
    return c;
  };

  // The no-policy path for one universe (its history), or null.
  Game.prototype.noPolicy = function (k) { return this.baseline ? this.baseline.universes[k].history : null; };

  Game.prototype.shockFor = function (round, choice) {
    if (this.shockMode === 'custom') return (choice && choice.shock) || 'none';
    if (this.shockMode === 'event') return round === 1 ? this.event : 'none';
    return scriptedShock(round);
  };
  Game.prototype.nextShock = function () { return this.shockFor(this.round + 1, null); };
  Game.prototype.isOver = function () { return this.round >= this.rounds; };

  // choice: { spending, taxes, rate, supply, shock }; demand is accepted for
  // spending. rate is the change in the interest rate, held between 0 and
  // RATE_MAX; shock is used only in custom mode.
  Game.prototype.step = function (choice) {
    if (this.isOver()) throw new Error('The game is over.');
    choice = choice || {};
    this.round += 1;
    var shock = this.shockFor(this.round, choice);
    var out = {};
    for (var i = 0; i < this.keys.length; i++) {
      var k = this.keys[i], u = this.universes[k];
      var ap = autopilotOf(this.autopilot);
      var useOpt = optimalRule && (ap.monetary === 'optimal' || ap.fiscal === 'optimal');
      var oc = useOpt ? optimalRule(u, this.round, this.scoring, this.optimalOpts) : null;
      if (!optimalRule) { if (ap.monetary === 'optimal') ap.monetary = 'taylor'; if (ap.fiscal === 'optimal') ap.fiscal = 'balanced'; }
      var c = {
        spending: ap.fiscal === 'optimal' ? oc.spending : ap.fiscal ? 0 : (choice.spending != null ? choice.spending : (choice.demand || 0)),
        taxes: ap.fiscal ? 0 : (choice.taxes || 0),
        supply: choice.supply || 0,
        autoFiscalMode: ap.fiscal || null
      };
      var want = choice.rate || 0;
      if (ap.monetary === 'taylor') {
        var t = u.taylorChange();
        c.autoRate = true; c.autoRateMode = 'taylor'; c.taylorTarget = t.target; want = t.change;
      } else if (ap.monetary === 'neutral') {
        // Moves like the players' own lever: 25 basis point steps, at most 2
        // points a round, through the same phase-in, so no policy is a path the
        // class could have chosen.
        c.autoRate = true; c.autoRateMode = 'neutral';
        want = clamp(Math.round((u.neutralRate() - u.rate) * 4) / 4, -2, 2);
      } else if (ap.monetary === 'optimal') {
        c.autoRate = true; c.autoRateMode = 'optimal'; want = oc.rate;
      }
      {
        var newRate = clamp(u.rate + want, 0, RATE_MAX);
        c.rate = Math.round((newRate - u.rate) * 100) / 100;
        c.rateLevel = newRate;
        u.rate = newRate;
      }
      if (ap.fiscal === 'balanced') c.autoSpending = u.balancedBudgetSpending();
      out[k] = u.step(this.round, shock, c);
    }
    this.rate = this.universes[this.keys[0]].rate;
    if (this.baseline) this.baseline.step({ shock: shock });
    return out;
  };

  // Summary for the end screen.
  // Welfare, round by round, for one universe: its loss, the no-policy loss,
  // and the running welfare score (percent of the no-policy loss avoided).
  Game.prototype.welfareTrack = function (k) {
    var h = this.universes[k].history, np = this.noPolicy(k), out = [];
    var L = 0, Lnp = 0;
    for (var j = 1; j < h.length; j++) {
      L += h[j].loss;
      Lnp += np ? np[j].loss : 0;
      out.push({ round: j, loss: h[j].loss, lossNoPolicy: np ? np[j].loss : null, gain: np ? np[j].loss - h[j].loss : null,
        cumLoss: L, cumLossNoPolicy: Lnp, welfare: welfareOf(L, Lnp) });
    }
    return out;
  };

  // Welfare score: percent of the no-policy loss that policy avoided. When doing
  // nothing loses almost nothing a percent means little, so it is null and the
  // views show the change in loss points instead.
  var WELFARE_MIN_LOSS = 0.5;
  function welfareOf(L, Lnp) { return Lnp > WELFARE_MIN_LOSS ? 100 * (Lnp - L) / Lnp : null; }

  // Summary for the end screen.
  Game.prototype.summary = function () {
    var out = {};
    for (var i = 0; i < this.keys.length; i++) {
      var k = this.keys[i];
      var h = this.universes[k].history, np = this.noPolicy(k);
      var lost = 0, peakInf = -Infinity, maxU = -Infinity, stars = 0, L = 0, Lnp = 0;
      for (var j = 1; j < h.length; j++) {
        stars += h[j].stars;
        L += h[j].loss;
        if (np) Lnp += np[j].loss;
        lost += Math.max(h[j].potential - h[j].y, 0);
        peakInf = Math.max(peakInf, h[j].inflation);
        maxU = Math.max(maxU, h[j].unemployment);
      }
      var last = h[h.length - 1];
      out[k] = {
        score: last.score, lostOutput: lost, peakInflation: peakInf, peakUnemployment: maxU,
        stars: stars, maxStars: (this.scoring.wU + this.scoring.wPi) * (h.length - 1),
        loss: L, lossNoPolicy: np ? Lnp : null, lossAvoided: np ? Lnp - L : null,
        welfare: np ? welfareOf(L, Lnp) : null,
        inZoneAtEnd: last.round > 0 && last.inZone.unemployment && last.inZone.inflation,
        // Won: policy did better than doing nothing (lower total welfare loss).
        // With scoring off, or with no no-policy path, there is no win or loss.
        won: !this.scoring.on || !np || last.round === 0 ? null : L < Lnp - 1e-9
      };
    }
    return out;
  };

  var engine = {
    BASE_POTENTIAL: BASE_POTENTIAL, START_AD: START_AD,
    NATURAL_RATE: NATURAL_RATE, INFLATION_TARGET: INFLATION_TARGET, TREND_INFLATION: TREND_INFLATION,
    autopilotOf: autopilotOf, setOptimalRule: setOptimalRule,
    R_STAR: R_STAR, BETA: BETA, PERSISTENCE: PERSISTENCE, scoringOf: scoringOf, welfareOf: welfareOf, WELFARE_MIN_LOSS: WELFARE_MIN_LOSS, credibilityOf: credibilityOf,
    TAX_SHARE: TAX_SHARE, RATE_EFFECT: RATE_EFFECT, START_RATE: START_RATE, RATE_MAX: RATE_MAX,
    GROWTH_AD_SHARE: GROWTH_AD_SHARE, TAYLOR: TAYLOR, TAX_RATE: TAX_RATE, G0: G0,
    direction: function (before, after, tol) { var d = after - before; tol = tol == null ? 0.2 : tol; return d > tol ? 'up' : d < -tol ? 'down' : 'same'; }, ZONE: ZONE, EVENTS: EVENTS, inZone: inZone,
    OKUN: OKUN, SUPPLY_DELAY: SUPPLY_DELAY, SUPPLY_GAIN: SUPPLY_GAIN, DEMAND_STEP: DEMAND_STEP,
    AD_MIN: AD_MIN, AD_MAX: AD_MAX, SRAS_MIN: SRAS_MIN, SRAS_MAX: SRAS_MAX,
    SCORE: SCORE, PRESETS: PRESETS, RANGES: RANGES, SHOCKS: SHOCKS, SCRIPT: SCRIPT,
    srasThrough: srasThrough, CURVES: CURVES, useCurves: useCurves, gapCloseFactor: gapCloseFactor,
    adP: adP, srasP: srasP, potential: potential, equilibrium: equilibrium, srasFor: srasFor,
    lambdaAt: lambdaAt, scriptedShock: scriptedShock,
    Universe: Universe, Game: Game,
    createGame: function (opts) { return new Game(opts); }
  };

  root.PU = root.PU || {};
  root.PU.engine = engine;
  if (typeof module !== 'undefined' && module.exports) module.exports = engine;
})(typeof window !== 'undefined' ? window : globalThis);
