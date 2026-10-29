## Findings

Revised 2026-10-28 after three changes to what is compared (review points 3, 4 and 6):

- **No policy** now means no fiscal change and the real rate held at its neutral 1%: the
  nominal rate follows expected inflation, moved in the players' own 25 basis point steps and
  phase-in. Before, it meant the nominal rate held at 3%, which with expectations that follow
  inflation is itself a destabilizing policy. Its path is also one of the search's starting
  plans, so the optimal path is never worse than no policy.
- **The LQ rule's instrument costs are tuned**, not assumed: for each economy and pair of
  welfare weights, the pair of costs (from a grid) whose rule gives the lowest true welfare
  loss over the four events, relative to no policy. Before, they were fixed at 0.05 and 0.8.
- **Events fade**: each round, what is left of a demand or cost shock shrinks to 90% of what
  it was (half gone after about 7 rounds). Before, every event was permanent.

1. **The LQ rule is still close to the best achievable.** Median 89% of the achievable gain
   over 180 cases, against 44% for the Taylor rule. It did worse than doing nothing in 1 case
   of 180; the Taylor rule did in 30. The search is never worse than no policy.
2. **The weakest economies are the neoclassical (LQ median 60%, Taylor 48%) and the New
   Keynesian (72%, Taylor 70%).** With wages that adjust fast, or a credible central bank,
   there is less for policy to gain, and the rule's linearization costs a larger share of it.
3. **One bad case.** New Keynesian, oil spike, 20 rounds, inflation weighted double: -121% of
   the achievable gain. The rule eases slowly through the game in anticipation of the oil
   shock fading, ends with the rate at 0.25%, and the no-policy rule in the tail rounds then
   pulls the rate back up to about 2.75%, which causes a brief deflation. The old failure at
   the 0% floor (neoclassical demand drop, 20 rounds, -202%) is gone.
4. **The browser cost is small.** The tuned costs for the five presets and every pair of
   welfare weights are precomputed (`tuned_costs.js`), so the usual games need no tuning; other
   settings are tuned at the start of the game. Measured in Chrome, 12 rounds, from pressing
   Play in round 1 until both scores are ready, with the CPU slowed 6 times (an older phone):

   | Game | Time |
   |---|---|
   | Two universes, presets (table) | 1.1 s |
   | One universe, preset (table) | 0.7 s |
   | One universe, custom settings (tuned live) | 1.7 s |

   (Measured before events faded; the search is faster now, 48 ms on average in Node for 12
   rounds against 79 ms.)

   Tuning alone takes 0.1 to 0.3 s per universe on this laptop.

## Recommendation

Unchanged: the search as the optimal path and the "share of the achievable gain" score, and
the LQ rule as "Autopilot: optimal rule" and the optimal-move hint. Both now use no policy as
defined above, and the rule is judged by the same welfare loss as the class.
