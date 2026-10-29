---
title: "Macro Control Room: the economic model"
date: 2026-10-28
---

The model behind the Macro Control Room game (`engine.js`; the optimal-policy benchmarks are
in `optimal.js`). The game began as "Policy Universes". Revised 2026-10-28 in response to two
referee-style reviews: a static price-level picture, a real-interest-rate channel,
expectations that are not assumed anchored, schools of thought as presets, scoring tied to
the Fed's dual mandate, a no-policy benchmark that holds the real rate at neutral, events
that fade, and an optimal-policy benchmark. Every number is illustrative.

## The curves (the static price-level AD/AS picture)

| Curve | Equation |
|---|---|
| Aggregate demand (AD) | $P = 90 + 0.02\,(8800 + A - Y)$ |
| Short-run aggregate supply (SRAS) | $P = 80 + \dfrac{105600}{13900 + S + L - Y}$ |
| Long-run aggregate supply (LRAS) | $Y^* = 9500 + L$ |

Start: $Y = 9500 = Y^*$, $P = 104$, inflation 2%, unemployment 5%, nominal rate 3%.

The slides use a steeper SRAS ($80 + 12000/(10000 + S + L - Y)$) through the same starting
point. The game's SRAS is flatter: with the slides' curve a 1% output gap moves the price
level about 4%, a Phillips-curve slope far above Mankiw's illustrative values, and with
adaptive expectations that makes inflation feed on itself within a round or two. The game's
curve gives a slope near 0.5.

## What happens in one round

1. **Expectations.** $\pi^e_t = \kappa \cdot 2 + (1-\kappa)\,\pi_{t-1}$, where $\kappa$ is
   *central bank credibility*. $\kappa = 0$ is Mankiw's adaptive expectations; $\kappa$
   near 1 is a credible central bank with expectations anchored at the 2% target. Wages
   and prices are set to rise by $\pi^e$ and spending in dollars keeps pace, so every price
   on both curves is scaled up by $(\pi^e - 2)$ percent (a nominal price scale, so a long
   inflation or deflation never distorts the curves' shape).
2. **The real interest rate.** $r = i - \pi^e$ (Fisher equation), where $i$ is the nominal
   rate that has reached the economy. AD sits $-\beta\,(r - r^*)$ from where the neutral
   real rate $r^* = 1\%$ would put it. If expected inflation rises and $i$ does not, $r$
   falls and AD rises: the central bank must raise $i$ by more than inflation to cool the
   economy (the Taylor principle).
3. **The event** (round 1 in the default game): confidence collapses, AD $-350$; spending
   boom, AD $+250$; oil spike, SRAS $-800$; new technology, potential $+200$ and AD $+100$.
   **Events fade.** Each round, the part of a demand or cost shock still in place shrinks to
   $\rho$ times what it was ($\rho = 0.9$ by default, adjustable from 0.5 to 1 in Settings;
   1 means permanent): confidence returns and oil prices come back down. At 0.9, half the
   shock is gone after about 7 rounds, so a stimulus or a rate cut that fought it has to be
   wound back as it fades. A gain in potential GDP is permanent.
4. **Policy chosen this round is queued.** Fiscal: $\Delta A = 50m \times$ spending steps
   $- 0.75 \times 50m \times$ tax steps ($m$ = multiplier). Monetary: the nominal rate moves
   in 25 basis point steps. Each policy arrives over two rounds, half after its lag and half
   the round after (fiscal lag 1, monetary lag 0 by default).
   **Why fiscal policy waits and monetary policy does not.** Each round is one decision by the
   class. The textbook splits a policy lag into the *inside lag* (deciding and enacting) and
   the *outside lag* (the economy responding). A spending or tax change still has to pass
   Congress, a long inside lag, so it starts the round after it is chosen. A rate change is
   decided at once, a short inside lag, but borrowing and spending respond slowly, a long
   outside lag, which the two-round phase-in carries. Making monetary policy wait a round as
   well was tested (2026-10-28): it brings back the Taylor rule's swings, and the rule does
   worse than no policy in most cases, which is Friedman's point about lags but would leave
   the classroom with an autopilot that does not work.
5. **Arrivals and expected policy.** Arriving policy shifts AD. A share $x$ of each policy's
   effect on output, in the round it arrives, is cancelled and shows up in prices instead (the
   "share of policy people expect": rational expectations). Wages and prices are reset so that,
   for that share, output stays where it would have been without the policy. This is the
   policy-ineffectiveness idea, limited to the policy's direct effect: the higher prices raise
   measured inflation and so expected inflation, and unless the central bank raises the nominal
   rate to match, the real rate falls and output rises in later rounds. With $x = 1$ and the
   rate held, a fully expected stimulus raises output from its second round on through that
   channel alone.
6. **The economy settles** where AD meets SRAS.
7. **Measures.** Output gap $g = 100(Y - Y^*)/Y^*$; unemployment $u = \max(2,\ 5 - 0.5g)$
   (Okun's rule); inflation $\pi = 2 + 100(P_t/P_{t-1} - 1)$.
8. **Scoring: welfare compared with no policy** (if on). Each round's loss is the dual
   mandate as a quadratic loss, $L_t = w_u (u_t - 5)^2 + w_\pi (\pi_t - 2)^2$ (weights 1 and
   1 by default, adjustable 0 to 2). The game adds up the loss with the class's policy and
   with no policy (the same economy and event, no fiscal change, and the real rate held at
   neutral; see below). Welfare
   score $= 100\,(L_{\text{no policy}} - L_{\text{policy}})/L_{\text{no policy}}$: the share
   of the no-policy loss that policy avoided. When doing nothing loses almost nothing (under
   0.5 loss points) the game shows the change in loss points instead. Win: policy's total
   loss is below no policy's. The green zone (unemployment within $\pm 0.5$ of 5%, inflation
   within $\pm 1$ of 2%, adjustable) stays on the gauges as a guide.
9. **Wages adjust.** SRAS shifts to close a share $\lambda$ of the output gap.

**Autopilots (Settings).** Monetary: Mankiw's Taylor rule,
$i^* = \pi + 1 + 0.5(\pi - 2) + 0.5\,g$, from last round's data; each round the rate moves
half way from where it is to $i^*$ (interest-rate smoothing, as in estimated Taylor rules),
in 25 basis point steps. Without smoothing the rule swung by the full 2 points every round
in the New Keynesian and neoclassical economies.
Fiscal: a balanced budget, spending follows tax revenue (25% of GDP), so it is cut in a
slump and raised in a boom.

**The no-policy path** runs the same economy and event with no fiscal change and a central
bank that holds the real rate at its neutral 1%: each round it sets the nominal rate to
expected inflation plus 1% (at 0% or above), moving in the players' own 25 basis point steps
and phase-in, so no policy is a path the class could have played. The same rule runs in the
rounds after the game that every score counts. Holding the nominal rate fixed is not no
policy: with expectations that follow inflation, it lets the real rate fall as inflation
rises, so a boom or a slump feeds on itself.

## Schools of thought (presets)

| Preset | $\lambda$ | $m$ | $x$ | $\kappa$ | $\beta$ | Taylor rule |
|---|---|---|---|---|---|---|
| Keynesian | 0.10 | 2 | 0% | 0.3 | 75 | off |
| Neoclassical | 0.7 | 1 | 100% | 0.9 | 50 | off |
| New Keynesian | 0.3 | 1.5 | 50% | 0.8 | 100 | on |
| Monetarist | 0.4 | 1 | 30% | 0.1 | 50 | off |
| Real world | 0.10, then 0.5 from round 5 | 2 | 0% | 0.5 | 50 | off |

What the labels mean, and what they do not:

- **Keynesian**: slow wage adjustment, a multiplier of 2, no one sees policy coming.
- **Neoclassical**: fast wage adjustment, a multiplier of 1, policy fully expected, a credible
  central bank. Policy mostly changes prices.
- **New Keynesian**: sticky but adjusting wages, partly expected policy, a credible central
  bank following a Taylor rule.
- **Monetarist**: the game has no money supply. The preset carries Friedman's view through
  expectations that follow past inflation (credibility 0.1), so inflation that is allowed to
  run keeps running, and no lasting trade-off between inflation and unemployment. The central
  bank still sets an interest rate; Friedman's own prescription, a rule of steady money
  growth, is not in the game.
- **Real world**: the OpenStax rule of thumb, Keynesian in the short run (slow adjustment) and
  neoclassical in the long run (fast adjustment from round 5).

Credibility is a fixed setting for the whole game: it does not rise when the central bank
holds inflation down or fall when it lets inflation run.

## How the presets play (12 rounds, checked 2026-10-28)

Welfare score, the share of the no-policy loss avoided, counted over the game plus the 4
tail rounds: the Taylor-rule autopilot (monetary only) / the optimal-rule autopilot (both
levers). Events fade at 90% a round; default welfare weights.

| Event | Keynesian | Neoclassical | New Keynesian | Monetarist | Real world |
|---|---|---|---|---|---|
| Confidence collapses | +32% / +44% | +30% / +43% | +37% / +41% | −1% / +71% | +28% / +47% |
| Spending boom | +36% / +43% | +25% / +41% | +36% / +37% | +34% / +69% | +31% / +48% |
| Oil spike | +2% / +10% | −27% / +13% | −23% / +13% | +0% / +10% | +5% / +19% |
| New technology | +35% / +68% | +28% / +33% | +35% / +29% | +36% / +87% | +28% / +69% |

Total loss with no policy, for scale:

| Event | Keynesian | Neoclassical | New Keynesian | Monetarist | Real world |
|---|---|---|---|---|---|
| Confidence collapses | 14.3 | 16.3 | 10.7 | 69.6 | 12.6 |
| Spending boom | 8.1 | 12.7 | 6.0 | 42.0 | 6.6 |
| Oil spike | 26.5 | 23.6 | 18.6 | 20.8 | 21.7 |
| New technology | 2.6 | 1.7 | 1.3 | 15.3 | 2.1 |

Reading it: policy earns its keep after demand shocks in every economy. The oil spike is the
hard case: it raises unemployment and inflation together, so any policy trades one against
the other, and the Taylor rule does worse than no policy in the neoclassical and New
Keynesian economies. The Monetarist economy loses the most with no policy (expectations
follow inflation down in a slump and up in a boom), so it has the most to gain from good
policy, and the Taylor rule alone does not rescue it from a slump: deflation takes the rate
down to 0.25%, next to the 0% floor, for five rounds, and the score is about the same as no
policy.

## Optimal policy

The game can compare the class's policy with the best achievable, for the same economy and
event, on the players' own buttons (whole spending steps; 25 basis point rate steps, at most 2
points a round, never below 0%). Two approaches, compared in
`specs/POLICY_UNIVERSES_OPTIMAL_COMPARISON.md`:

- **The optimal path (perfect-foresight search).** The whole plan of spending and rate moves
  for every round is chosen to minimize the total welfare loss, played in the full model.
  Coordinate search: starting from no change, the no-policy path, the Taylor rule's path and
  the optimal rule's path, it improves one round's choice at a time until nothing improves. It
  knows the event and the model, which no real central bank does, so it is an upper bound. It
  is computed when the event hits (or at the end of the game when the class picks the shocks).
- **The optimal rule (linear-quadratic).** The engine's one-round transition is linearized
  numerically around the starting point; the state is the position of AD and SRAS, potential
  GDP, expected inflation, the rates set and in effect, the part of the event still in place,
  last round's price level and the policy still on its way. The discounted Riccati equation
  (discount 0.95 a round) gives the rule $u_t = -F x_t$ for the change in spending and in the
  rate, rounded to the buttons. It reacts to the current state only, so a central bank could
  follow it. At the 0% floor, the rate is held and fiscal policy re-chosen from the same
  solution.
- **Instrument costs.** Both levers move AD, so the rule needs a cost on moving each to choose
  a mix. These costs are not part of the score. They are tuned rather than assumed: for each
  economy and pair of welfare weights, the pair (from a grid, 0.002 to 0.5 per fiscal step
  squared, 0.1 to 3.2 per rate point squared) whose rule gives the lowest welfare loss over the
  four events, relative to no policy. The presets are precomputed in `tuned_costs.js`; other
  settings are tuned when the game starts. Settings can switch tuning off and set the costs
  by hand.

**In the game.** With the option on, the optimal path appears on the charts, gauges and
AD/AS panel, the round log shows the optimal plan, and the class gets a second score, the
share of the achievable gain:
$100\,(L_{\text{no policy}} - L_{\text{class}})/(L_{\text{no policy}} - L_{\text{optimal}})$,
where 100% matches the optimal path and 0% is no better than no policy. Every path is scored
over the game plus 4 tail rounds of no policy, so a late stimulus is charged for the inflation
that follows. Either team can hand its lever to the optimal rule ("Autopilot: optimal rule"),
and a separate option shows the optimal rule's move before each round.

**How good is the rule?** Over 180 cases (5 economies, 4 events, 8 to 20 rounds, 3 sets of
welfare weights) its median share of the achievable gain is 89%, against 44% for the Taylor
rule; it does worse than no policy in 1 case, the Taylor rule in 30.

## How it compares with Mankiw's dynamic AD/AS model

Mankiw, *Macroeconomics*, "A Dynamic Model of Economic Fluctuations" (chapter number varies
by edition; check the exact symbols against the edition in use):

| | Mankiw |
|---|---|
| Demand for goods | $Y_t = \bar Y_t - \alpha(r_t - \rho) + \varepsilon_t$ |
| Fisher equation | $r_t = i_t - E_t\pi_{t+1}$ |
| Phillips curve | $\pi_t = E_{t-1}\pi_t + \phi(Y_t - \bar Y_t) + \upsilon_t$ |
| Expectations | $E_t\pi_{t+1} = \pi_t$ |
| Policy rule | $i_t = \pi_t + \rho + \theta_\pi(\pi_t - \pi^*) + \theta_Y(Y_t - \bar Y_t)$ |

| Piece | Now matches Mankiw | Still differs |
|---|---|---|
| Expectations | Yes, with credibility $\kappa = 0$ | $\kappa > 0$ adds anchoring (a New Keynesian extension) |
| Real rate and Fisher equation | Yes: demand responds to $r = i - \pi^e$ relative to a neutral rate | Demand enters as a shift of a price-level AD curve rather than an output equation |
| Policy rule | Yes: the Taylor autopilot's target is his rule with his 0.5 weights | Applied to last round's data, moving half way to the target each round (smoothing), in 25 basis point steps, with the game's two-round phase-in |
| Phillips curve | Same structure: expected inflation plus a gap effect plus supply shocks | Curved (not linear) SRAS, plus the separate wage-adjustment speed $\lambda$ |
| Picture | | Static price-level AD/AS, as in the principles slides; a dynamic inflation-axis version is a separate project |
| Shocks | Demand and supply shocks, as his $\varepsilon_t$ and $\upsilon_t$ | His shocks can follow any path; the game has one event at the start that fades geometrically, at 90% a round by default |
| Additions | | Fiscal levers and multiplier, lags, expected-policy share, Okun's unemployment, dual-mandate scoring, a neutral-real-rate no-policy benchmark, the optimal rule and the optimal path |

**Is Mankiw's model nested?** Closer, not exactly. Expectations, the real-rate channel and
the policy rule now match his; the price-level form of AD, the curved SRAS and $\lambda$
keep it from being an exact special case.

## What the model leaves out

- Money, banks and exchange rates. The Monetarist preset works through expectations, not a
  money supply.
- Government debt: a spending increase has no budget cost, and nothing pushes the government
  to reverse it, apart from the economy overheating as the event fades.
- Credibility that is earned or lost: it is fixed for the game.
- Interest-rate pass-through is a single sensitivity $\beta$.
- A round is a period of no fixed length.
- Curve limits: AD and SRAS can move at most 3,000 and 5,000 from the start; if custom
  settings push the economy past one, the game says so instead of showing a false resting
  point.
