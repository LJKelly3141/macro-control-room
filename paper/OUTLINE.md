---
title: "Macro Control Room: a browser game for stabilization policy in principles of macroeconomics"
subtitle: "Paper outline for the Journal of Economic Education"
author: "Logan J. Kelly"
date: 2026-10-29
---

Working outline. Citations are keys in `references/references.bib`, which holds only works
whose existence is proved (see `references/REFERENCES.md`). **[VERIFY]** marks a fact still to
be checked; **[CITE?]** marks a claim that needs a source we have not yet found; **[DECIDE]**
marks a choice for the author.

## Target and framing

- **Journal and section.** *Journal of Economic Education*, Economic Instruction section
  (mcgoldrick2014 is the section's guide to submissions; hoyt2019 reviews 50 years of it).
  **[VERIFY]** the section's current name, length limit, abstract length, reference style and
  policy on disclosing software and AI tools, from the Taylor & Francis instructions for authors
  (the page blocks automated access).
- **Contribution in one sentence.** A free, open-source browser game in which a principles class
  runs fiscal and monetary policy after a shock, in an economy built on the AD/AS model students
  already know, scored by the Fed's dual mandate against both doing nothing and the best
  achievable policy.
- **What is new relative to earlier JEE games.** lengwiler2004 puts one player in the central
  bank's chair with a reduced-form model; woltjer2005 has students act as firms. Macro Control
  Room differs in: (1) two teams, fiscal and monetary, deciding together; (2) the static AD/AS
  diagram of the principles course, so the game reinforces the course's own picture; (3)
  schools of thought as presets, and two economies run side by side on the same choices; (4) a
  welfare score with a no-policy benchmark and an optimal-policy benchmark; (5) it runs in any
  browser, on a phone, and inside a learning management system, with nothing to install.
  **[DECIDE]** whether to claim (5) as new; check other web games first ("Chair the Fed", **[VERIFY]**).

## 1. Introduction

- The teaching problem. Students meet AD/AS as comparative statics, and policy as a one-time
  shift. What they rarely experience: lags, expectations, the trade-off in a supply shock, the
  need to unwind policy as a shock fades, and the difference between a rule and discretion.
- Active learning works but is underused: allgood2015 (survey); watts2008 and goffe2014 (lecture
  still dominates; time and coverage are the barriers). Classroom experiments: holt1999,
  durham2007, emerson2004.
- The gap: macro policy games exist (lengwiler2004, woltjer2005) but **[CITE?]** few match the
  principles course's own model or let a whole class play in one period.
- What the paper does: describes the game, the model and its link to Mankiw's dynamic AD/AS
  model, the scoring, a class plan, and checks of the model's behavior.

## 2. The game in class

- **Set-up.** Instructor projects the game; the class splits into Team Fiscal (government
  spending and taxes) and Team Monetary (the interest rate, 25 basis point steps). One event hits
  in round 1; 12 rounds by default.
- **A round.** The class predicts whether unemployment and inflation will rise or fall; teams
  advise; the instructor enters the choices; the class sees gauges, the AD/AS diagram and charts
  over time, against the no-policy path.
- **Win and score.** Win by beating no policy on the dual-mandate welfare loss (fomc2026 for the
  mandate). Optional second score: share of the achievable gain.
- **Teaching tools.** Guided tour, tooltips on every element, predictions with a running tally,
  autopilots (Taylor rule, balanced budget, optimal rule) as comparison cases, an optional hint
  showing the optimal rule's move, "replay this event", settings shared as a link.
- **Figures.** Screenshots of the dashboard, the AD/AS panel, the charts and the results card
  (light theme for print). **[DECIDE]** which three or four.

## 3. The model

Every number illustrative; full equations in an appendix.

- **AD/AS.** Static price-level AD and a curved SRAS, the same starting point as the course
  slides; wages close a share $\lambda$ of the output gap each round.
- **Expectations and credibility.** $\pi^e_t = \kappa \cdot 2 + (1-\kappa)\pi_{t-1}$: adaptive
  expectations at $\kappa = 0$ (the accelerationist view, Friedman 1968 **[VERIFY]**), anchored
  expectations near $\kappa = 1$ (barro1983 on credibility).
- **The real interest rate.** AD responds to $r = i - \pi^e$ relative to a neutral 1%; the
  Taylor principle follows (taylor1993).
- **Expected policy.** A share of policy's direct output effect is offset in wages and prices
  (sargent1975).
- **Lags.** Fiscal policy waits a round (inside lag); a rate change starts at once and builds
  over two rounds (outside lag) (friedman1961). Why monetary policy was not made slower: it
  brings back the Taylor rule's swings.
- **Okun's rule** for unemployment (Okun 1962 **[VERIFY]**).
- **Events fade** at 90% a round; productivity gains are permanent.
- **Schools of thought as parameter sets.** Keynesian, neoclassical, New Keynesian, Monetarist,
  and a "real world" mix (the OpenStax rule of thumb **[VERIFY]** citation). What the labels do and
  do not capture (the Monetarist preset has no money supply).
- **Relation to Mankiw's dynamic AD/AS model** (Mankiw **[VERIFY]** edition and chapter): which
  pieces match (expectations at $\kappa = 0$, the Fisher equation, the Taylor rule's target) and
  which differ (price-level AD, curved SRAS, $\lambda$, fading shocks). romer2000 and taylor2000
  on teaching macro with an interest-rate rule.

## 4. Scoring and the benchmarks

- **Welfare loss.** $L = w_u(u-5)^2 + w_\pi(\pi-2)^2$ per round, summed over the game and four
  tail rounds (svensson1997, woodford2003 **[VERIFY]** year, for quadratic loss functions).
- **No policy.** No fiscal change and the real rate held at neutral. Why holding the nominal rate
  fixed is not "doing nothing" (it lets the real rate fall as inflation rises).
- **The optimal rule.** Linear-quadratic control on the numerically linearized model
  (anderson1996); instrument costs tuned to the welfare loss rather than assumed; rounded to the
  players' buttons. A rule a central bank could follow (kydland1977 on rules vs discretion;
  rudebusch1999 on optimal rules in a backward-looking model).
- **The optimal path.** Perfect-foresight search over the buttons; an upper bound no real
  central bank could reach.
- **Taylor-rule autopilot** with interest-rate smoothing (clarida2000).

## 5. How the model behaves

From `specs/POLICY_UNIVERSES_OPTIMAL_COMPARISON.md` and the model write-up:

- Welfare by school and event, Taylor rule vs the optimal rule (table).
- The optimal rule captures a median 89% of the achievable gain over 180 cases against 44% for
  the Taylor rule; worse than no policy in 1 case vs 30. (Regenerate before submission.)
- What students should see: demand shocks reward policy; the oil spike forces a trade-off; a
  stimulus left in place after the shock fades overheats the economy; with a credible central
  bank there is less for policy to do.
- Robustness: curve limits never bind in the presets; tests (48) guard the behavior.

## 6. Using the game in a principles course

- Where it fits: after AD/AS and fiscal and monetary policy (OpenStax chapters **[VERIFY]**).
- A 75-minute plan: tour (5 min), first game, Keynesian, demand drop (25), debrief (10), second
  game with a different school or two universes side by side (25), wrap-up (10).
- Discussion questions by event and school.
- Variations: autopilot showdowns, the hint switched on for a first game, student-chosen shocks.
- Assessment ideas: prediction tally, a short reflection, exam items on the same scenarios.

## 7. Evidence from the classroom

**[DECIDE]** This was set aside earlier ("drop it for now"). The Instruction section usually
expects some evidence of use (check mcgoldrick2014). Options: a description of use in ECON 202,
Fall 2026, with student comments; prediction accuracy across rounds; a pre/post quiz in a later
term (needs IRB review **[VERIFY]**).

## 8. Limitations

- No money, banks, exchange rates or government debt; credibility fixed for the game.
- Illustrative calibration, round of no fixed length.
- The optimal rule is optimal for a linearized model; the optimal path assumes perfect
  foresight.
- One event per game by default.

## 9. Conclusion and availability

- URL: https://ljkelly3141.github.io/macro-control-room/ ; source: https://github.com/LJKelly3141/macro-control-room
- **[DECIDE]** a licence for the code (none yet), and whether to archive a release with a DOI.

## Appendices

- A. Model equations and parameters by preset.
- B. The optimal rule: state, linearization, Riccati equation, tuning of the instrument costs.
- C. Instructor guide: settings links for each class plan.
- D. Accessibility: contrast, keyboard use, screen-reader text.

## Notes for drafting

- The development history is in `paper/transcript/` (not in git): the full session transcript and
  the raw logs.
- **[DECIDE]** disclosure of software and AI assistance in building the game, per the journal's
  policy once verified.
