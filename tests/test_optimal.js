// Tests for optimal.js (optimal-policy benchmarks, plan steps 2 and 3).
//   node --test tests/test_optimal.js
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const E = require(path.join(__dirname, '../engine.js'));
const O = require(path.join(__dirname, '../optimal.js'));

function afterEvent(preset, event, rounds) {
  const g = E.createGame({ rounds: rounds || 12, shockMode: 'event', event, noBaseline: true, universes: { a: E.PRESETS[preset] } });
  g.step({});
  return g;
}

test('the starting point is a steady state of the transition the rule is built on', () => {
  for (const pre of Object.keys(E.PRESETS)) {
    const r = O.lqRule(E.PRESETS[pre]);
    for (const v of r.lin.steady.x.concat(r.lin.steady.y)) assert.ok(Math.abs(v) < 1e-6, `${pre}: ${v}`);
  }
});

test('the Riccati iteration converges and the rule is stable on the linear model', () => {
  for (const pre of ['keynesian', 'neoclassical', 'newkeynesian', 'monetarist']) {
    const r = O.lqRule(E.PRESETS[pre]);
    assert.ok(r.iterations < 5000, `${pre} converged`);
    // The losses implied by the linear model die away under the rule.
    const { A, B, C } = r.lin, F = r.F;
    let x = new Array(A.length).fill(0); x[0] = -275;
    let y = [];
    for (let t = 0; t < 80; t++) {
      const u = F.map(row => -row.reduce((s, f, j) => s + f * x[j], 0));
      y = C.map(row => row.reduce((s, c, j) => s + c * x[j], 0));
      x = A.map((row, i) => row.reduce((s, a, j) => s + a * x[j], 0) + B[i][0] * u[0] + B[i][1] * u[1]);
    }
    assert.ok(Math.abs(y[0]) < 0.05 && Math.abs(y[1]) < 0.05, `${pre}: gaps after 80 rounds ${y}`);
  }
});

test('the LQ rule beats doing nothing after a demand drop, and the Taylor rule on average over the events', () => {
  for (const pre of ['keynesian', 'neoclassical', 'newkeynesian', 'monetarist', 'realworld']) {
    const g = afterEvent(pre, 'demand_drop');
    const none = O.nonePlan(g), lq = O.lqPlan(g);
    assert.ok(lq.loss < none.loss, `${pre}: LQ ${lq.loss} vs none ${none.loss}`);
    let L = 0, T = 0;
    for (const ev of E.EVENTS) { const h = afterEvent(pre, ev); L += O.lqPlan(h).loss; T += O.taylorPlan(h).loss; }
    assert.ok(L < T, `${pre}: LQ ${L} vs Taylor ${T} over the four events`);
  }
});

test('tuned instrument costs: chosen from the grid, and no worse than the old fixed costs', () => {
  for (const pre of ['keynesian', 'newkeynesian']) {
    const s = E.PRESETS[pre], sc = E.scoringOf();
    const t = O.tunedCosts(s, sc);
    assert.ok(O.COST_GRID.fiscal.includes(t.costFiscal) && O.COST_GRID.rate.includes(t.costRate));
    let fixed = 0;
    for (const ev of E.EVENTS) {
      const g = E.createGame({ rounds: 12, shockMode: 'event', event: ev, scoring: sc, noBaseline: true, universes: { a: s } });
      g.step({});
      fixed += O.lqPlan(g, { tuneCosts: false, costFiscal: 0.05, costRate: 0.8 }).loss / Math.max(1, O.nonePlan(g).loss);
    }
    assert.ok(t.score <= fixed / 4 + 1e-12, `${pre}: tuned ${t.score} vs fixed ${fixed / 4}`);
    // With tuning off, the costs given are used as they are.
    assert.strictEqual(O.withCosts(s, sc, { tuneCosts: false, costFiscal: 0.3 }).costFiscal, 0.3);
  }
});

test('the optimal path is never worse than no policy (the no-policy path is one of its starts)', () => {
  for (const pre of ['keynesian', 'monetarist']) for (const ev of ['oil', 'boom']) {
    const g = E.createGame({ rounds: 12, shockMode: 'event', event: ev, universes: { k: E.PRESETS[pre] } });
    g.step({});
    const b = O.benchmark(g, 'k');
    assert.ok(b.optimal.loss <= b.none.loss + 1e-9, `${pre} ${ev}: optimal ${b.optimal.loss} vs none ${b.none.loss}`);
  }
});

test('the LQ rule only chooses the players\' buttons', () => {
  const g = afterEvent('keynesian', 'boom');
  const lq = O.lqPlan(g);
  for (const c of lq.choices) {
    assert.ok(Number.isInteger(c.spending) && c.spending >= -4 && c.spending <= 4);
    assert.ok(Math.abs(c.rate * 4 - Math.round(c.rate * 4)) < 1e-9 && c.rate >= -2 && c.rate <= 2);
  }
});

test('the search is never worse than its starting plans, and repeat runs agree', () => {
  const g = afterEvent('keynesian', 'oil');
  const lq = O.lqPlan(g), none = O.nonePlan(g);
  const a = O.searchPlan(g, { starts: [lq.choices] }), b = O.searchPlan(g, { starts: [lq.choices] });
  assert.ok(a.loss <= lq.loss + 1e-9 && a.loss <= none.loss + 1e-9);
  assert.strictEqual(a.loss, b.loss);
  assert.deepStrictEqual(a.plan, b.plan);
});

test('every path is scored over the game plus the tail rounds', () => {
  const g = afterEvent('neoclassical', 'boom', 8);
  const none = O.nonePlan(g);
  assert.strictEqual(none.history.length, 1 + 8 + O.DEFAULTS.tail);
});

test('autopilot modes: the optimal rule drives both teams, Taylor and balanced budget still work', () => {
  const g = E.createGame({ rounds: 12, shockMode: 'event', event: 'boom', autopilot: { monetary: 'optimal', fiscal: 'optimal' }, universes: { k: E.PRESETS.keynesian } });
  while (!g.isOver()) g.step({ spending: 4, rate: -2 });   // manual choices are ignored on autopilot
  const h = g.universes.k.history;
  assert.ok(h.slice(1).every(r => r.autoRateMode === 'optimal' && r.autoFiscalMode === 'optimal'));
  assert.ok(g.summary().k.welfare > 0, `optimal autopilot beats doing nothing: ${g.summary().k.welfare}`);
  const t = E.createGame({ rounds: 4, shockMode: 'event', event: 'boom', autopilot: { monetary: true, fiscal: true }, universes: { k: E.PRESETS.keynesian } });
  t.step({}); const r = t.step({}).k;
  assert.strictEqual(r.autoRateMode, 'taylor'); assert.strictEqual(r.autoFiscalMode, 'balanced');
});

test('final scores: both scores, tail counted, optimal never above the class when the class is optimal', () => {
  const g = E.createGame({ rounds: 12, shockMode: 'event', event: 'demand_drop', universes: { k: E.PRESETS.keynesian } });
  g.step({});
  const b = O.benchmark(g, 'k');
  const plan = b.optimal.plan;
  while (!g.isOver()) g.step(plan[g.round - 1]);   // play the optimal plan itself
  const f = O.finalScores(g, 'k', b);
  assert.ok(Math.abs(f.achievable - 100) < 1e-6, `playing the optimal plan scores ${f.achievable}`);
  assert.ok(f.vsNone > 0);
  assert.strictEqual(f.history.length, 1 + 12 + O.DEFAULTS.tail);
});

test('custom shocks: the benchmark replays the shocks it is given', () => {
  const g = E.createGame({ rounds: 6, shockMode: 'custom', noBaseline: true, universes: { k: E.PRESETS.keynesian } });
  g.step({ shock: 'none' });
  const withShock = O.benchmark(g, 'k', { shocks: { 3: 'oil' } });
  const without = O.benchmark(g, 'k');
  assert.strictEqual(withShock.none.history[3].shock, 'oil');
  assert.ok(withShock.none.loss > without.none.loss);
});

test('the precomputed table of tuned costs matches a fresh tuning (rerun scripts/tune_costs.js if not)', () => {
  const T = require(path.join(__dirname, '../tuned_costs.js'));
  assert.strictEqual(Object.keys(T).length, 5 * 8, 'five presets by eight pairs of welfare weights');
  for (const [pre, sc] of [['keynesian', { wU: 1, wPi: 1 }], ['monetarist', { wU: 2, wPi: 1 }], ['realworld', { wU: 0, wPi: 2 }]]) {
    const key = O.tuneKey(E.PRESETS[pre], sc, O.DEFAULTS);
    const fresh = O.tunedCosts(E.PRESETS[pre], sc, { fresh: true });
    assert.ok(T[key], `${pre} ${JSON.stringify(sc)} is in the table`);
    assert.strictEqual(T[key].costFiscal, fresh.costFiscal, `${pre}: fiscal cost`);
    assert.strictEqual(T[key].costRate, fresh.costRate, `${pre}: rate cost`);
  }
});
