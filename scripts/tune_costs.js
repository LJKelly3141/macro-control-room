// Precompute the tuned instrument costs for every preset and every pair of
// welfare weights the settings allow, and write tuned_costs.js, which the game
// loads so the usual games need no tuning at the start.
//   node scripts/tune_costs.js
// Rerun after any change to the engine, the presets, the cost grid or the
// tuning; tests/test_optimal.js checks the table against a fresh tuning.
const fs = require('node:fs');
const path = require('node:path');
const E = require(path.join(__dirname, '../engine.js'));
const O = require(path.join(__dirname, '../optimal.js'));

const R = E.RANGES.weight, table = {};
const t0 = Date.now();
for (const pre of Object.keys(E.PRESETS)) {
  for (let wU = R.min; wU <= R.max; wU += R.step) for (let wPi = R.min; wPi <= R.max; wPi += R.step) {
    if (wU === 0 && wPi === 0) continue;
    const scoring = { wU, wPi };
    const t = O.tunedCosts(E.PRESETS[pre], scoring, { fresh: true });
    table[O.tuneKey(E.PRESETS[pre], scoring, O.DEFAULTS)] = { costFiscal: t.costFiscal, costRate: t.costRate, score: t.score };
  }
}
const body = `/*
 * Macro Control Room: tuned instrument costs for the presets, for every pair of
 * welfare weights, at the default discount and tail rounds. Written by
 * scripts/tune_costs.js; do not edit by hand.
 */
(function (root) {
  var table = ${JSON.stringify(table, null, 1)};
  root.PU = root.PU || {};
  root.PU.tunedTable = table;
  if (typeof module !== 'undefined' && module.exports) module.exports = table;
})(typeof window !== 'undefined' ? window : globalThis);
`;
fs.writeFileSync(path.join(__dirname, '../tuned_costs.js'), body);
console.log(`${Object.keys(table).length} entries in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
