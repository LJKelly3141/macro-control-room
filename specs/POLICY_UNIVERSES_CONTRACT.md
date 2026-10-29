# Policy Universes: component contract

Internal build contract for `apps/policy_universes/`. Plan: `specs/POLICY_UNIVERSES_GAME_PLAN.md`.

## Rules for every file

- Plain classic scripts (no ES modules, no `import`), each wrapped in an IIFE that
  attaches to `window.PU`. The app must run from `file://` and from any static server.
- No external libraries, fonts, or network requests. SVG drawn by hand.
- No `localStorage` needed; if used, wrap in try/catch.
- Student-facing text: no em-dashes (no `—`, `&mdash;`, or `--` as a dash). Say "slides",
  never "deck". Plain, short wording for principles students.
- Accessible: every SVG has `role="img"` and an `aria-label` that states the values;
  controls have labels; color is never the only signal (text values beside gauges, line
  labels or a legend in text).
- Works at 360px wide with no horizontal page scroll, and on a projector at 1280px+.
- Use the CSS tokens in `tokens.css` (`--u-a`, `--u-b`, `--accent`, `--rule`, ...).
- Do not edit files you do not own. If you need a change in a shared file, say so in
  your report.

## Shared pieces (already written)

- `engine.js` → `PU.engine`. Read it. Key parts:
  - `PU.engine.PRESETS.{keynesian, neoclassical, realworld}`: `{label, lambda, multiplier,
    expected, lag, lambdaLate, switchRound}`.
  - `PU.engine.RANGES`: min/max/step for every setting and lever.
  - `PU.engine.SHOCKS[key].label`, `PU.engine.SCRIPT` (round → shock key).
  - `PU.engine.createGame({rounds, shockMode: 'scripted'|'custom', universes: {a, b}})`
    returns a `Game`: `game.round`, `game.rounds`, `game.keys`, `game.universes[k]`
    (a `Universe` with `.settings`, `.ad`, `.sras`, `.lras`, `.history`),
    `game.step({demand, supply, shock})`, `game.isOver()`, `game.summary()`,
    `game.nextShock()`.
  - Each history record: `{round, y, p, potential, gap, gapPct, unemployment, inflation,
    ad, sras, lras, shock, demand, supply, policyArrived, points, score}`. Round 0 is the
    starting point.
  - Curves: `PU.engine.adP(y, ad)`, `PU.engine.srasP(y, sras, lras)`,
    `PU.engine.potential(lras)`.
- `scales.js` → `PU.SCALES` (fixed gauge and AD/AS axis ranges) and `PU.COLORS`.
- `index.html`: containers `#settings`, `#controls`, `#gauges-a`, `#adas-a`,
  `#gauges-b`, `#adas-b`, `#name-a`, `#name-b`, `#charts`, `#log`, `#end`. Each panel
  already has its `<h2>`; render below it, do not remove it.

## Components

| File(s) | Owner | API |
|---|---|---|
| `settings.js`, `settings.css` | settings agent | `PU.settings.mount(el, {onChange})`, `PU.settings.get()`, `PU.settings.lock(bool)` |
| `gauges.js`, `adas.js`, `dashboard.css` | dashboard agent | `PU.gauges.render(el, record, opts)`, `PU.adas.render(el, universe, opts)` |
| `charts.js`, `log.js`, `charts.css` | charts agent | `PU.charts.render(el, game, opts)`, `PU.log.render(el, game, opts)` |
| `ui.js`, `app.css`, `index.html` | integration | wires everything; levers, next round, custom shock picker, end screen |

`opts` for views: `{ names: {a, b}, colors: {a, b} }` (gauges and adas get the single
`{name, color}` for their universe).

`PU.settings.get()` returns
`{ rounds, shockMode, universes: { a: {name, preset, lambda, multiplier, expected, lag,
lambdaLate, switchRound}, b: {...} } }`. That object is passed straight to
`PU.engine.createGame` (extra fields like `name` and `preset` are ignored by the engine).

Every `render` call redraws its container from scratch (idempotent) and is called after
each round and on a new game.

## Dev pages

Each agent may make a harness page `apps/policy_universes/dev/<component>.html` that
loads `../engine.js`, `../scales.js`, its own files, and fake data. `dev/` is not
published.

## Round 2 (2026-10-28): game redesign

Logan's direction: too busy; needs fiscal and monetary levers (class splits into Team Fiscal
and Team Monetary, each advises every round); one event at the start that the teams respond
to; a goal with win or lose; AD/AS with inflation on the vertical axis; most options in the
settings window; hover explanations on everything.

**Engine (done, read engine.js):**
- Settings per universe: `{name, preset, lambda, multiplier, expected, fiscalLag, monetaryLag,
  lambdaLate, switchRound}`. `lag` is gone.
- `createGame({rounds, shockMode: 'event'|'scripted'|'custom', event, universes})`. In
  'event' mode `event` (a key of `SHOCKS`, from `EVENTS`) hits in round 1 only. `SHOCKS[k]`
  now has `headline` and `what` for the event card.
- `game.step({spending, taxes, rate, supply, shock})`; `rate` is the change in percentage
  points; `game.rate` is the level (starts at `START_RATE` 3, kept in 0..`RATE_MAX`).
- Records add `spending, taxes, rate, rateLevel, fiscalArrived, monetaryArrived, inZone:
  {unemployment, inflation}, stars` (0..2). `demand` = spending, kept for old code.
- `summary()[k]` adds `stars, maxStars, won` (won = both in the green zone in the final round).
- `E.ZONE` / `PU.ZONE`: `{unemployment: [4.5, 5.5], inflation: [1, 3]}`.

**Tooltips (done, read tips.js):** every explanation lives in `PU.TIPS`. Put a tip on an
element with `PU.tips.attach(el, key)` or the attribute `data-tip="key"` (works on SVG `<g>`,
`<path>`, `<text>` too; hover, focus, and tap all work). Use the existing keys; if a needed
explanation is missing, use `data-tip-text` with plain wording and list it in your report so
it can move into `tips.js`. Do not edit `tips.js`.

**Simplicity rule:** fewer things on screen. No help paragraphs under controls; the
explanation goes in the tooltip. Keep labels short.

## Round 3 (2026-10-28): light and dark themes, accessibility

Logan: light and dark versions of the whole site; the policy levers become a "control board"
console (style B) in light and dark; there are low-contrast problems to fix.

- **All colors come from `tokens.css`.** Read it. Theme is `<html data-theme="light|dark">`, or
  the system setting when unset. A theme change must need no redraw: draw SVG with classes and
  CSS rules that use `var(--...)` (CSS properties such as `fill`/`stroke` accept `var()`;
  SVG presentation attributes like `fill="..."` do not, so do not put colors in attributes or
  in JS). No hex colors anywhere outside `tokens.css` (rgba shadows excepted).
- **Universe colors by slot:** `var(--u-a)` / `var(--u-b)`, soft fills `var(--u-a-soft)` /
  `var(--u-b-soft)`. Mark elements with a class or `data-slot="a|b"`. `opts.colors` is still
  passed but must not be used for drawing. `opts.slot` ('a'|'b') is passed to gauges and adas.
- **Contrast (WCAG 2.1 AA):** text 4.5:1 on its background (3:1 only for text 18.66px bold or
  24px+), UI component borders, tracks, chart lines and focus rings 3:1. Use `--ink`/`--muted`
  for text, `--rule` for control borders, `--grid` only for decorative gridlines that carry no
  meaning alone. Green zone: `--zone` (ink) and `--zone-fill` (band). Up/down: `--up`/`--down`.
  Minimum text size 13px. Color never the only signal.
- Check both themes with a real contrast computation on the rendered page, not by eye.

## Round 4 (2026-10-28): no-policy path, predictions, autopilots, tutorial

Logan: keep the rate range at +/-2; build the no-policy path and predict-before-you-play, but
he is worried about contrast and things being big enough to see from the back of a room;
autopilot for both teams (Taylor rule, balanced budget); a tutorial of the game; tooltips
switchable on and off.

**Engine (done):**
- `createGame({..., autopilot: {monetary: bool, fiscal: bool}})`. Monetary autopilot is a
  smoothed Taylor rule per universe (rates can differ between universes); fiscal autopilot
  is a balanced budget (spending follows tax revenue, so it is cut in a slump).
- Records add `autoRate` (bool), `taylorTarget`, `autoSpending` (AD units before the
  multiplier; negative means a forced cut).
- `game.noPolicy(k)` returns the history of the no-policy twin for universe k: same
  universes, same shocks, no choices, no autopilot. Same length as `game.universes[k].history`.
- `PU.engine.direction(before, after, tol=0.2)` returns 'up' | 'down' | 'same'.

**Visibility rule for this round:** anything new must be readable from the back of a
classroom on a projector: at least 15px text for labels, 18px+ for key numbers, lines at
least 2.5px, and the WCAG AA contrast rules of Round 3 in both themes.

## Round 5 (2026-10-28): harmonize with Mankiw (referee response)

Logan's rulings: (1) static price-level AD/AS picture (a dynamic inflation-axis version is a
later project); (2) a real-rate channel, kept out of the students' way (details in Settings);
(3) expectations are not assumed anchored: credibility is a setting; (4) one universe at a
time by default, two side by side as an option, presets for schools of thought including New
Keynesian and Monetarist; (5) scoring tied to the Fed's dual mandate, adjustable or off.

**Engine (done):**
- Expectations: `pi_e = k * 2 + (1 - k) * pi_last`, `k` = setting `credibility` (0..1).
  `credibility: 0` is Mankiw's adaptive expectations. (`inertia` is gone; old links map
  `inertia` to `1 - credibility`.)
- Real-rate channel: `r = i_effective - pi_e`; AD shifts by `-rateSensitivity * (r - 1)`.
  Setting `rateSensitivity` (beta, 50..300). Records add `expectedInflation`,
  `nominalRate` (the rate in effect after lags), `realRate`.
- Flatter SRAS (game calibration, same start 9,500 / 104). `lambda` now means the share of
  the output gap closed in a round.
- Presets: keynesian, neoclassical, newkeynesian, monetarist, realworld. Each has
  `taylor: bool`: choosing a preset with `taylor: true` should switch the Taylor autopilot on
  (the user can switch it off).
- Taylor autopilot is now exactly Mankiw's rule (0.5, 0.5), no smoothing.
- `createGame({..., scoring: {on, uBand, piBand, wU, wPi}})`: green zone = natural rate
  +/- uBand and 2% +/- piBand; stars = weight per goal in the zone; `summary().won` is null
  when scoring is off. Defaults: on, 0.5, 1, 1, 1. `PU.engine.scoringOf(o)` returns the
  resolved object with `.zone`. Records' `inZone` and `stars` follow it.
- Events resized: demand -350, boom +250, oil SRAS -800.

## Round 6 (2026-10-28): optimal policy on screen (plan step 5)

Logan approved: show the optimal path (perfect-foresight search) as a benchmark with a
"share of the achievable gain" score beside "vs doing nothing"; add the linear-quadratic
optimal rule as an autopilot option for both teams. Plan: specs/POLICY_UNIVERSES_OPTIMAL_POLICY_PLAN.md;
results: specs/POLICY_UNIVERSES_OPTIMAL_COMPARISON.md.

**Engine and optimal.js (done):**
- `game.autopilot.monetary`: false | 'taylor' | 'optimal'; `game.autopilot.fiscal`: false |
  'balanced' | 'optimal' (true still means taylor / balanced). Records add `autoRateMode`
  ('taylor' | 'optimal' | null) and `autoFiscalMode` ('balanced' | 'optimal' | null). With the
  fiscal optimal rule the record's `spending` is the rule's choice.
- `createGame({..., optimal: {discount, costFiscal, costRate, tail}})` options for the optimal rule.
- `PU.optimal` (optimal.js, loaded after engine.js): `benchmark(game, k)` after round 1 returns
  `{none, taylor, lqRule, optimal, tail}`, each `{loss, history, choices}` (optimal also
  `plan`: an array of `{spending, rate}` for rounds 2..N). Histories run rounds 0..N+tail.
- ui.js computes the benchmark per universe right after round 1 and passes it to the views.

**What the views get (from ui.js):** `opts.optimal = { a: {history, plan}, b: {...} }` or
null while it is being computed or when "Show the optimal path" is off. `history[r]` is the
optimal path's record for round r (same fields as any record); `plan[r - 2]` is its choice
for round r (round 1 is the event round with no policy). Draw only rounds 0..game.rounds
(ignore the tail). The optimal path assumes perfect foresight: say so in its tooltip
(tip key `optimalPath`).
