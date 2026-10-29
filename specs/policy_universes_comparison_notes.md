## Findings

1. **The LQ rule is close to the best achievable.** Median 92% of the achievable gain over 180
   cases, against 54% for the Taylor rule. It did worse than doing nothing in 1 case of 180; the
   Taylor rule did in 42, mostly in the New Keynesian and neoclassical economies, where its fixed
   0.5 weights over-react.
2. **The cost of linearization is concentrated where the plan expected.**
   - The only failure is a long spell at the 0% rate floor (neoclassical, confidence collapses,
     20 rounds, inflation weighted double). The linear rule cannot see the floor; applying it
     with the rate held at the floor and fiscal policy re-optimized given that (from the same
     solved quadratic) cut this case from -488% to -43% and removed two other failures, but a
     long spell at the floor still needs foresight that only the search has.
   - The other weak cases (59% to 70%) are the new-technology event, where doing nothing loses
     very little to begin with (achievable gains of 1 to 2 loss points), so small differences
     show up as large percentages.
3. **The search is the upper bound, and it is cheap.** It beat the LQ rule in 167 of 180 cases,
   usually by a few percentage points of the achievable gain.
4. **Both run comfortably in the browser** (Chrome, timed 2026-10-28, worst case over Keynesian,
   Monetarist and New Keynesian games after a demand drop or an oil spike, one universe):

   | CPU | Search, 12 rounds | Search, 20 rounds | LQ rule, any length |
   |---|---|---|---|
   | This laptop | 40 ms | 95 ms | under 5 ms |
   | 4 times slower (a mid-range phone) | 166 ms | 410 ms | under 20 ms |
   | 6 times slower (an older phone) | 246 ms | 621 ms | under 30 ms |

   Two universes double the search time. Nothing needs to be precomputed.

## Recommendation

Ship both, each in the role it is suited for:

- **The search as the "optimal" benchmark path and score** ("share of the achievable gain").
  It uses the true model, the 0% floor and the players' own buttons, so 100% is genuinely the
  best the class could have done with perfect foresight. Computed at game start, behind the
  event card; in "I choose each round" mode, at the end of the game.
- **The LQ rule as "Autopilot: optimal rule"**, beside the Taylor rule. It is a rule a central
  bank could actually follow (it reacts to the current state, with no foresight), it is
  derived from the loss function rather than assumed, and it beats the Taylor rule in most
  cases. Its weights can be shown beside Taylor's 0.5 and 0.5.
- **Say plainly in the game** that the optimal path assumes perfect foresight, and that the
  optimal rule is optimal for a simplified (linear) version of the model and can stumble at
  the 0% rate floor.

Open choices left to Logan are listed in the plan (discount 0.95, instrument costs, spending-only
fiscal plan, 4 tail rounds); the comparison used the recommended values.
