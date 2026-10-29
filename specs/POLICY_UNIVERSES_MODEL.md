---
title: "Policy Universes: the economic model"
date: 2026-10-28
---

The model behind the Policy Universes game (`apps/policy_universes/engine.js`), revised
2026-10-28 in response to a referee-style critique: a static price-level picture, a
real-interest-rate channel, expectations that are not assumed anchored, schools of thought
as presets, and scoring tied to the Fed's dual mandate. Every number is illustrative.

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
   effect on output is cancelled and shows up in prices instead (the "share of policy people
   expect": rational expectations).
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

## How the presets play (12 rounds, no policy / Taylor rule, checked 2026-10-28)

**Out of date.** This table predates the changes of 2026-10-28 (the Taylor rule's smoothing,
Monetarist credibility 0.1, no policy as the neutral real rate, fading events) and is to be
redone. Stars are out of 24.

| Event | Keynesian | Neoclassical | New Keynesian | Monetarist | Real world |
|---|---|---|---|---|---|
| Confidence collapses | Lose 3 / Win 11 | Win 19 / Win 19 | Win 15 / Win 18 | Lose 0 / Lose 0 | Win 10 / Win 14 |
| Spending boom | Win 7 / Win 20 | Win 20 / Win 20 | Win 18 / Win 18 | Lose 5 / Lose 10 | Win 14 / Win 17 |
| Oil spike | Win 13 / Win 18 | Win 21 / Win 20 | Win 21 / Win 16 | Lose 11 / Win 20 | Win 14 / Win 18 |
| New technology | Win 24 / Win 24 | Win 23 / Win 24 | Win 24 / Win 24 | Lose 13 / Lose 15 | Win 24 / Win 24 |

Reading it: in the Keynesian economy policy earns roughly two to three times the stars of
doing nothing; in the neoclassical and New Keynesian economies the economy largely fixes
itself. The Monetarist preset (credibility 0, Friedman's adaptive expectations) is the hard
case: after a demand drop, deflation sets in and the Taylor rule hits the 0% floor on the
interest rate, so the real rate stays too high (a zero-lower-bound trap). Even one round of
maximum fiscal stimulus does not pull it out in this calibration; whether the Monetarist
preset should be this unforgiving is an open choice.

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
| Policy rule | Yes: the Taylor autopilot is his rule with his 0.5 weights | Applied to last round's data, in 25 basis point steps, with the game's two-round phase-in |
| Phillips curve | Same structure: expected inflation plus a gap effect plus supply shocks | Curved (not linear) SRAS, plus the separate wage-adjustment speed $\lambda$ |
| Picture | | Static price-level AD/AS, as in the principles slides; a dynamic inflation-axis version is a separate project |
| Additions | | Fiscal levers and multiplier, lags, expected-policy share, Okun's unemployment, dual-mandate scoring |

**Is Mankiw's model nested?** Closer, not exactly. Expectations, the real-rate channel and
the policy rule now match his; the price-level form of AD, the curved SRAS and $\lambda$
keep it from being an exact special case.

## What the model leaves out

- Money, banks, exchange rates, and government debt.
- Interest-rate pass-through is a single sensitivity $\beta$.
- A round is a period of no fixed length.
