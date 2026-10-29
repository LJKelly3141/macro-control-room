---
title: "Policy Universes: optimal policy plan"
date: 2026-10-28
---

Plan for adding an optimal-policy benchmark to the game, so a class's policy can be compared
both with doing nothing and with the best achievable policy. Model:
`specs/POLICY_UNIVERSES_MODEL.md`. Nothing here is built yet.

## Goal

For the economy and event being played, compute the optimal policy for **both instruments**
(fiscal and monetary), using **the same buttons the players have**. Show it as a third path,
and give **two scores**:

- vs doing nothing: $100\,(L_{\text{none}} - L_{\text{yours}})/L_{\text{none}}$ (as now);
- share of the achievable gain: $100\,(L_{\text{none}} - L_{\text{yours}})/(L_{\text{none}} - L_{\text{optimal}})$.

## Two approaches, to be compared before either is shipped

### A. Infinite-horizon linear-quadratic (LQ) optimal rule

The textbook approach to optimal monetary policy (Svensson, Woodford; Clarida, Gali and Gertler).

1. **State** $x_t$: the real positions of AD and SRAS, potential GDP, expected inflation, the
   nominal rate set and the rate in effect, the policy still in the pipeline (fiscal arriving
   next round and the round after; monetary arriving next round), and last round's price level
   (inflation needs it). About 9 variables.
2. **Controls** $u_t$: the change in fiscal stance and the change in the interest rate (taxes
   and spending move AD the same way, so fiscal is one control; see decision 3).
3. **Linearize** the engine's one-round transition around the starting point (potential GDP,
   2% inflation, 3% rate) **numerically**, by finite differences of the engine itself:
   $x_{t+1} \approx A x_t + B u_t$, and the measures $(u_t - 5,\ \pi_t - 2) \approx C x_t + D u_t$.
   Numerical linearization works for any settings, so nothing is hand-derived per preset.
4. **Loss**: $\sum_t \delta^t \big[ w_u (u_t-5)^2 + w_\pi (\pi_t-2)^2 + \rho_f\,(\Delta f_t)^2 + \rho_m\,(\Delta i_t)^2 \big]$:
   the game's welfare loss plus small costs of moving each instrument (decision 2), discounted
   by $\delta$ (decision 1).
5. **Solve** the discounted Riccati equation by iteration (a few 9-by-9 matrix steps, instant in
   the browser) for the optimal feedback rule $u_t = -F x_t$.
6. **Use**: run the rule in the real (nonlinear) game from round 2 on, rounded to the button steps
   and held to the limits (rate at least 0%, at most 2 points a round). This gives the optimal
   path and an "Autopilot: optimal rule" option. The rule's coefficients can be stated in plain
   words beside Taylor's 0.5 and 0.5. The Real world preset recomputes the rule at its switch round.

*Strengths:* infinite horizon (no end-of-game effect), a rule a central bank could follow
(it reacts to the current state, no foresight), instant, explainable.
*Limits:* optimal for the linearized model; ignores the 0% floor, SRAS curvature and button
steps, so it is near-optimal in the real game, least so in large swings or at the floor.

### B. Finite-horizon perfect-foresight search

1. Treat the whole plan (spending, taxes and rate for every round) as the choice.
2. **Coordinate search over the actual buttons**: start from several plans (no policy, the Taylor
   rule's path, the LQ rule's path), improve one round's choice at a time, repeat until nothing
   improves.
3. Score each candidate on the game's rounds **plus 4 tail rounds** with no new policy, so a
   late stimulus is charged for the inflation it causes after the game ends.
4. Runs in the browser at game start, behind the event card (about 0.5 s for 12 rounds on a
   laptop; the engine plays about 190,000 twelve-round games a second in Node).

*Strengths:* uses the true nonlinear model, the 0% floor and the button steps; an upper bound
on what the class could achieve.
*Limits:* perfect foresight and commitment (no real central bank has either); a very good plan,
not a certified global optimum; in "I choose each round" mode the shocks are not known in
advance, so it can only be computed afterward; slower for long games.

## Step 4: the comparison (run here, in Node, before any screens are built)

Both approaches, plus the Taylor rule and no policy, on identical games:

- **Cases:** every preset (Keynesian, Neoclassical, New Keynesian, Monetarist, Real world) by
  every event (4) by game length (8, 12, 20 rounds) by welfare weights (equal; employment
  double; inflation double). 180 cases.
- **All scored the same way:** true nonlinear model, the game's welfare loss over the game plus
  4 tail rounds.
- **Measures:**
  - total loss and both scores for each approach;
  - **the cost of linearization**: how far the LQ rule's loss is above the search's (the gap
    shows where linearization breaks down; expected largest at the 0% floor, as in the
    Monetarist demand drop, and in the oil shock);
  - how each compares with the Taylor rule;
  - compute time in Node, and a check in the browser on a phone-sized setting;
  - stability (does the LQ rule ever make things worse than doing nothing in the real game?).
- **Deliverable:** `specs/POLICY_UNIVERSES_OPTIMAL_COMPARISON.md`, with a results table and a
  recommendation for which approach the game should show (or both: the LQ rule as an autopilot
  and the search as the benchmark path).

## Steps, with checkpoints

| Step | Work | Checkpoint |
|---|---|---|
| 1 | Engine refactor: a copyable state and a one-round transition function, so a game can be branched and replayed; no change to how the game plays | All 30 engine tests still pass; a branched copy plays identically |
| 2 | Approach A in the engine: numerical linearization, Riccati solution, the feedback rule | Tests: the rule reproduces itself on the linear model; it beats no policy and the Taylor rule on small shocks in the real game |
| 3 | Approach B in the engine: coordinate search with tail rounds | Tests: never worse than its starting plans; repeat runs agree |
| 4 | The comparison (above) | **Logan reads the report and chooses what ships** |
| 5 | Screens: third path on the Over time and Phillips tabs, a marker on the AD/AS panel, the optimal plan in the round log, both scores in the sidebar and results, "Autopilot: optimal rule", the new settings under Advanced | Full games in all four setups with no errors; contrast in both themes; static server and iframe checks |
| 6 | Update the model write-up and the Mankiw comparison | Numbers in the write-up match the engine |

## Decisions for Logan

1. **Discount factor $\delta$.** Recommended 0.95 per round. Lower values care less about the
   future and make the rule more aggressive now.
2. **Instrument costs $\rho_f$, $\rho_m$.** Needed because both instruments move AD and would
   otherwise be near substitutes with an undetermined split; they also make policy gradual, as
   central banks are in practice. Recommended: small and equal, set so a 25 basis point move
   costs about the same as one fiscal step, and adjustable under Advanced.
3. **Fiscal: one control or two.** Spending and taxes move AD the same way, differing only in
   strength. Recommended: the optimal plan uses spending only, and says so, so the plan reads
   simply.
4. **Tail rounds.** Recommended 4 rounds after the game with no new policy, for scoring every
   path (the class's, no policy, Taylor, optimal) the same way. This changes today's welfare
   score slightly (it adds the tail).
5. **What ships**: decided after the comparison in step 4.
