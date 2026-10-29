# Macro Control Room

A classroom game for principles of macroeconomics. An event hits the economy, and the
class sets fiscal and monetary policy round by round to bring unemployment and inflation
back to target. The economy follows the rules of one school of thought (Keynesian,
neoclassical, New Keynesian, Monetarist, or a "real world" mix), and two economies can be
run side by side with the same choices.

**Play:** <https://ljkelly3141.github.io/macro-control-room/>

Built for ECON 202, Principles of Macroeconomics, at the University of Wisconsin-River Falls.

## What is in the game

- **Teams.** Team Fiscal moves government spending and taxes; Team Monetary moves the
  interest rate in 25 basis point steps. Either team can be handed to an autopilot: a
  Taylor rule or a balanced budget, or the optimal rule derived from the welfare loss.
- **The model.** A static price-level AD/AS model with the same curves as the course
  slides, sticky wages that close part of the output gap each round, inflation
  expectations set by central bank credibility, a real interest rate channel, and events
  that fade over the following rounds.
- **Scoring.** The Fed's dual mandate as a welfare loss: squared distance of unemployment
  from 5% plus squared distance of inflation from 2%. The class wins by beating no policy
  (no change in spending or taxes, and a central bank that holds the real interest rate at
  its neutral 1%), and sees what share of the achievable gain it captured against the
  optimal path.
- **Views.** Gauges, the AD/AS diagram, charts over time with the no-policy and optimal
  paths, a round log, predictions before each round, a guided tour, and tooltips on every
  control. Light and dark modes.
- **Settings.** Number of rounds and universes, the school of thought for each universe
  and every parameter behind it, the event, scoring weights, autopilots, and the optimal
  policy options. Settings travel in the page address, so a set-up game can be shared as a link.

## Running it

The game is plain HTML, CSS and JavaScript with no build step and no dependencies. Open
`index.html` in a browser, or serve the folder with any static server:

```bash
python3 -m http.server 8000
```

## Tests

Requires Node 18 or later.

```bash
node --test tests/test_engine.js tests/test_optimal.js
```

`tests/fixtures/policy_universes_ref.R` regenerates the reference paths the engine is
checked against. `node scripts/tune_costs.js` rebuilds `tuned_costs.js`, the optimal rule's
instrument costs precomputed for the presets; rerun it after changing the engine, the
presets or the tuning (a test checks the table). `node scripts/compare.js` reruns the comparison of the two
optimal-policy approaches and writes `specs/POLICY_UNIVERSES_OPTIMAL_COMPARISON.md`.

## Layout

| Path | Contents |
|---|---|
| `index.html` | The page |
| `engine.js` | The model: universes, the game, presets, scoring |
| `optimal.js` | Optimal policy: the linear-quadratic rule, its tuned instrument costs, and the perfect-foresight search |
| `tuned_costs.js` | The rule's tuned costs for the presets (generated) |
| `ui.js`, `settings.js`, `gauges.js`, `adas.js`, `charts.js`, `log.js`, `tips.js`, `tour.js`, `scales.js` | The screens |
| `*.css` | Styles; `tokens.css` holds the light and dark colors |
| `dev/` | Test pages for single components |
| `tests/` | Engine and optimal-policy tests |
| `scripts/compare.js` | The optimal-policy comparison |
| `scripts/tune_costs.js` | Builds `tuned_costs.js` |
| `specs/` | Design plan, model write-up, build contract, and the optimal-policy plan and comparison |

The game began as "Policy Universes" inside the ECON 202 course site, and the specs keep
that name and refer to paths in that repository.

## Author

Logan J. Kelly, University of Wisconsin-River Falls.
