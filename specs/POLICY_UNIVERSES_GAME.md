# Policy Universes: a two-universe policy simulation game

Note to build the plan. Set 2026-10-27. Target: play in class Thu Oct 29 (Module 8,
with 13.3), then post for students to play on their own. Logan knows the timeline is
tight; this note is the plan to build from, not yet an approved spec.

## The idea (Logan)

One simulation the class plays together, then posted to play alone. It compares how
the economy responds to Keynesian and neoclassical policy in different universes: one
built on the neoclassical assumptions and one built on the Keynesian assumptions, in
the context of the tools developed in Chapters 11 to 13. Not Jeopardy; Jeopardy is kept
for reviews.

## Proposed design (from the 2026-10-27 discussion, not yet approved)

- **Two universes, same choices.** Left: Keynesian universe (sticky wages and prices,
  SRAS barely moves, multiplier makes AD changes larger). Right: neoclassical universe
  (flexible wages and prices, vertical LRAS, rational expectations: anticipated policy
  moves mostly the price level). Each round the same shock hits both and the class makes
  one choice that applies to both.
- **Tools on screen:** AD/AS diagram with SRAS moving period by period (the `simulate()`
  engine from `slides/keynesian_slides.qmd` and `slides/neoclassical_slides.qmd`); gap
  arrow; unemployment vs the natural rate; inflation vs a target; multiplier; policy lags;
  Phillips curve short run vs long run (13.2).
- **Levers:** (1) demand policy, a slider from tighten to stimulate; (2) supply-side
  investment (education, technology), costs now, raises potential GDP a few rounds later.
- **Rounds:** about 10 to 12 periods, scripted shocks (demand drop, oil shock, boom,
  productivity gain).
- **Scoring:** points lost each round for unemployment away from the natural rate and
  inflation away from target; bonus for growth in potential. A score per universe.
- **Ending (13.3):** reveal a third "real world" universe that adjusts slowly for 2 to 5
  years and then behaves neoclassically (the OpenStax 13.1 rule of thumb). Discussion
  starts there.
- **Two modes, one file:** in class on the projector (class votes, Logan clicks); on their
  own, the same page on GitHub Pages linked in Module 8, browser and phone, no login.
  Illustrative numbers, stated on screen.
- **Build:** standalone HTML/JS page under `pages/` (not R/plotly), so it runs on GitHub
  Pages and inside a Canvas iframe. Every image or embed checked before calling it ready.

## Open decisions for Logan

1. One demand lever, or separate fiscal and monetary levers?
2. In class: class votes and Logan enters the choice, or one student drives?
3. Solo play: graded reflection, or practice only?
4. If not ready Thursday: fallback for 13.3 day, and does Module 8 get a later due date
   for a solo-play reflection?

## Related changes the same day

- Tue Oct 27 slides (`slides/neoclassical_slides.qmd`) now cover 13.1 and 13.2, so
  Thursday is 13.3 plus the game.
- Not yet done: `schedule.yml` still says Tuesday is "the building blocks" and Thursday is
  "policy implications; balancing". Student-facing calendar text; change only on Logan's word.
