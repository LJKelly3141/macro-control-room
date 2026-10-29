---
title: "Policy Universes: build plan"
date: 2026-10-27
---

Plan for building the Policy Universes simulation app. Design note:
`specs/POLICY_UNIVERSES_GAME.md`. This plan covers the app only. How it is used in class
and in Canvas is planned separately.

## What it is

A stand-alone simulation app that runs on any static server (GitHub Pages, a Canvas
iframe, or a laptop with no network after it loads).

- Plain HTML, CSS and JavaScript. No build step, no server code, no login.
- No external libraries loaded at run time. Charts and gauges are drawn in SVG by the
  app itself, so nothing depends on a CDN.
- Works on a projector, a laptop and a phone.
- All numbers are illustrative, and the app says so on screen.

## Open decision

**Levers.** Recommended: one demand lever, "government spending and taxes" (Ch 12 fiscal
policy), plus one supply lever, "invest in education and technology." Monetary policy is
Ch 15 and has not been taught yet; it can be added later as a second lever.

## The model

The same engine as the Oct 27 slides, ported to JavaScript:

- **Same curves.** `sras_p` and `ad_p` from `slides/neoclassical_slides.qmd:45-46`.
- **Same adjustment rule.** Each round SRAS closes lambda times the output gap
  (`slides/neoclassical_slides.qmd:316`).
- **Engine change needed:** potential GDP is fixed at 9,500 in the R code. It becomes a
  variable so the supply lever and the productivity shock can move LRAS.

## Adjustable settings

Every universe setting is a control on a settings panel, set separately for each
universe. The defaults below are presets, not fixed values.

| Setting | Control | Keynesian preset | Neoclassical preset |
|---|---|---|---|
| Wage and price adjustment (lambda) | Slider, 0 to 1.5 | 0.10 (sticky) | 1.0 (flexible) |
| Spending multiplier on the demand lever | Slider, 1 to 4 | 2 | 1 |
| Share of policy that is expected | Slider, 0 to 1: the share of a policy move that SRAS matches in the same round, so it shows up in the price level instead of output | 0 (moves output) | 1 (mostly the price level moves) |
| Policy lag | Rounds, 0 to 3 | 1 | 1 |

- **Preset buttons:** Keynesian, Neoclassical, and Real world. Real world starts slow and
  turns flexible after a set number of rounds (the OpenStax 13.1 rule of thumb). It adds
  two settings: lambda later, and the round it switches.
- **Reset** returns a universe to its preset.
- **Shareable settings:** the current settings are written into the page address, so a
  link opens the app with those settings. This needs no server.
- Settings lock once round 1 starts and unlock on a new game, so a game's results always
  match one set of settings.

## The rounds

There are 10 rounds by default (adjustable). The same scripted shocks hit both universes:

- Round 2: demand falls
- Round 5: oil shock (SRAS shifts left)
- Round 7: boom
- Round 9: productivity gain

A "custom" option lets the player choose the shock in each round instead.

**Scoring:**

- Each round loses points for unemployment away from 5% and for inflation away from
  target.
- Supply investment costs points now and pays off 3 rounds later.
- Each universe keeps its own score.

## The dashboard

One dashboard per universe, side by side, with the same scales on both so they compare
at a glance.

**Gauges, current period:**

- Real GDP vs potential (the output gap, in percent)
- Unemployment rate, with the 5% natural rate marked
- Inflation rate, with the target marked
- Price level

**Tracking over time:**

- An AD/AS panel for the current round, with the past equilibria as a fading trail.
- Line charts by round for real GDP and potential, unemployment, inflation, and the price
  level. Both universes are drawn on the same chart so the paths compare directly.
- A Phillips curve trace: inflation against unemployment, one point per round.
- A round log: the shock, the policy chosen, and the results in both universes.

**Controls:** the demand lever, the supply lever, and a "next round" button.

**End screen:** both scores, lost output, peak inflation, and the full paths.

## Where it lives

- Source: `apps/policy_universes/` (`index.html`, `app.css`, `engine.js`, `ui.js`).
- Published to `docs/apps/policy_universes/` so GitHub Pages serves it at
  `https://ljkelly3141.github.io/macro_principles/apps/policy_universes/`.
- Copying it there needs either a `resources:` line in `_quarto.yml` or a copy step.
  To be decided when building; neither is done yet.

## Build order and checkpoints

| Step | Work | Checkpoint |
|---|---|---|
| 1 | Port the engine to `engine.js`, with a test against the R numbers | JS matches the slides (flexible stimulus ends at price 104 vs 90; same fast and slow paths) |
| 2 | Settings panel, presets, page-address settings | Changing each setting changes the path as expected; a shared link restores the settings |
| 3 | Gauges and the AD/AS panel | Gauges match the engine values each round |
| 4 | Time-series charts, Phillips trace, round log | Both universes are drawn on the same scales |
| 5 | Levers, scripted and custom shocks, scoring, end screen | Logan plays one full game |
| 6 | Publish to `docs/apps/policy_universes/` | Opens from a static server, in a Canvas iframe, and on a phone; every asset loads, with counts reported |

## Not in this plan

- Class use (Thursday timing, slides, who drives) and any Canvas link.
- `schedule.yml` changes.
- Committing and pushing, which happen only on Logan's word.
