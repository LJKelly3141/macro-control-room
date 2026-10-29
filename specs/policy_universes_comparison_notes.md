## Findings

Revised 2026-10-28 after two changes to what is compared (review points 3 and 4):

- **No policy** now means no fiscal change and the real rate held at its neutral 1%: the
  nominal rate follows expected inflation, moved in the players' own 25 basis point steps and
  phase-in. Before, it meant the nominal rate held at 3%, which with expectations that follow
  inflation is itself a destabilizing policy. Its path is also one of the search's starting
  plans, so the optimal path is never worse than no policy.
- **The LQ rule's instrument costs are tuned**, not assumed: for each economy and pair of
  welfare weights, the pair of costs (from a grid) whose rule gives the lowest true welfare
  loss over the four events, relative to no policy. Before, they were fixed at 0.05 and 0.8.

1. **The LQ rule is still close to the best achievable.** Median 89% of the achievable gain
   over 180 cases, against 40% for the Taylor rule. It did worse than doing nothing in 5 cases
   of 180, by at most 0.2 loss points; the Taylor rule did in 28, by much more (lowest share
   -196%). The search beat the LQ rule in every case.
2. **The weak spot is now the neoclassical economy** (LQ median 47%, the same as Taylor's 48%).
   With wages that adjust fast, there is little for policy to gain, and the rule's
   linearization costs a larger share of it. Three of the five cases worse than no policy are
   the neoclassical spending boom over 20 rounds.
3. **The old failure at the 0% floor is gone.** The neoclassical demand drop over 20 rounds
   with inflation weighted double was -202% of the achievable gain. Against the new no-policy
   path and with tuned costs, the lowest LQ share in any case is -9%.
4. **The browser cost is small.** The tuned costs for the five presets and every pair of
   welfare weights are precomputed (`tuned_costs.js`), so the usual games need no tuning; other
   settings are tuned at the start of the game. Measured in Chrome, 12 rounds, from pressing
   Play in round 1 until both scores are ready, with the CPU slowed 6 times (an older phone):

   | Game | Time |
   |---|---|
   | Two universes, presets (table) | 1.1 s |
   | One universe, preset (table) | 0.7 s |
   | One universe, custom settings (tuned live) | 1.7 s |

   Tuning alone takes 0.1 to 0.3 s per universe on this laptop.

## Recommendation

Unchanged: the search as the optimal path and the "share of the achievable gain" score, and
the LQ rule as "Autopilot: optimal rule" and the optimal-move hint. Both now use no policy as
defined above, and the rule is judged by the same welfare loss as the class.
