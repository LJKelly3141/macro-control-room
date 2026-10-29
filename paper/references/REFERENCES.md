# References: tracker

Rule: no work is cited until its existence is proved. Proof is one of:

- **PDF**: a copy is in `paper/references/pdf/` (kept out of git) and its title page has been checked;
- **DOI**: the DOI resolves in Crossref and the metadata (authors, title, year, journal,
  volume, pages) matches. The PDF is still to be obtained before the paper is submitted.

Only works with proof go into `references.bib`. Everything else stays in the "To verify"
list until we have proof. Checked 2026-10-29.

## Verified, PDF in hand

| Key | Work | Proof | File |
|---|---|---|---|
| taylor1993 | Taylor, J. B. 1993. "Discretion versus Policy Rules in Practice." *Carnegie-Rochester Conference Series on Public Policy* 39: 195–214. | DOI 10.1016/0167-2231(93)90009-L; title page checked (scan from Taylor's Stanford page) | `pdf/taylor1993.pdf` |
| rudebusch1999 | Rudebusch, G., and L. E. O. Svensson. 1999. "Policy Rules for Inflation Targeting." In *Monetary Policy Rules*, ed. J. B. Taylor, 203–262. Chicago: University of Chicago Press. | NBER chapter c7417; title page checked | `pdf/rudebusch1999.pdf` |
| fomc2026 | Federal Open Market Committee. "Statement on Longer-Run Goals and Monetary Policy Strategy." Adopted effective January 24, 2012; as reaffirmed effective January 27, 2026. | federalreserve.gov PDF; text checked | `pdf/fomc_longer_run_goals.pdf` |

## Verified by DOI, PDF still needed

PDFs for these are behind a publisher login. Download them through the UWRF library, save
as `paper/references/pdf/<key>.pdf`, and I will check each title page.

| Key | Work | DOI | Use in the paper |
|---|---|---|---|
| lengwiler2004 | Lengwiler, Y. 2004. "A Monetary Policy Simulation Game." *Journal of Economic Education* 35 (2): 175–183. | 10.3200/JECE.35.2.175-183 | Closest prior game in JEE: the player is a central bank governor |
| woltjer2005 | Woltjer, G. B. 2005. "Decisions and Macroeconomics: Development and Implementation of a Simulation Game." *Journal of Economic Education* 36 (2): 139–144. | 10.3200/JECE.36.2.139-144 | Prior JEE macro simulation (students as firms) |
| mcgoldrick2014 | McGoldrick, K. 2014. "A Guide for Submissions to the *Journal of Economic Education* Instruction Section." *Journal of Economic Education* 45 (2): 166–173. | 10.1080/00220485.2014.889968 | What the Instruction section expects; read first |
| hoyt2019 | Hoyt, G. M., and K. McGoldrick. 2019. "50 Years of Economic Instruction in the *Journal of Economic Education*." *Journal of Economic Education* 50 (2): 168–195. | 10.1080/00220485.2019.1582388 | Context for the Instruction section |
| holt1999 | Holt, C. A. 1999. "Teaching Economics with Classroom Experiments: A Symposium." *Southern Economic Journal* 65 (3): 603–610. | 10.2307/1060819 | Classroom experiments |
| durham2007 | Durham, Y., T. McKinnon, and C. Schulman. 2007. "Classroom Experiments: Not Just Fun and Games." *Economic Inquiry* 45 (1): 162–178. | 10.1111/j.1465-7295.2006.00003.x | Evidence that experiments help learning |
| emerson2004 | Emerson, T. L. N., and B. A. Taylor. 2004. "Comparing Student Achievement across Experimental and Lecture-Oriented Sections of a Principles of Microeconomics Course." *Southern Economic Journal* 70 (3): 672–693. | 10.2307/4135338 | Evidence from principles courses |
| allgood2015 | Allgood, S., W. B. Walstad, and J. J. Siegfried. 2015. "Research on Teaching Economics to Undergraduates." *Journal of Economic Literature* 53 (2): 285–325. | 10.1257/jel.53.2.285 | Survey of the teaching literature |
| watts2008 | Watts, M., and W. E. Becker. 2008. "A Little More than Chalk and Talk: Results from a Third National Survey of Teaching Methods in Undergraduate Economics Courses." *Journal of Economic Education* 39 (3): 273–286. | 10.3200/JECE.39.3.273-286 | Lecture still dominates |
| goffe2014 | Goffe, W. L., and D. Kauper. 2014. "A Survey of Principles Instructors: Why Lecture Prevails." *Journal of Economic Education* 45 (4): 360–375. | 10.1080/00220485.2014.946547 | Barriers to active learning (time, coverage) |
| romer2000 | Romer, D. 2000. "Keynesian Macroeconomics without the LM Curve." *Journal of Economic Perspectives* 14 (2): 149–170. | 10.1257/jep.14.2.149 | Teaching macro with an interest-rate rule. Free on aeaweb.org, but the server refused the script; download in a browser |
| taylor2000 | Taylor, J. B. 2000. "Teaching Modern Macroeconomics at the Principles Level." *American Economic Review* 90 (2): 90–94. | 10.1257/aer.90.2.90 | Taylor rule at the principles level |
| clarida2000 | Clarida, R., J. Galí, and M. Gertler. 2000. "Monetary Policy Rules and Macroeconomic Stability: Evidence and Some Theory." *Quarterly Journal of Economics* 115 (1): 147–180. | 10.1162/003355300554692 | Interest-rate smoothing in the Taylor autopilot |
| friedman1961 | Friedman, M. 1961. "The Lag in Effect of Monetary Policy." *Journal of Political Economy* 69 (5): 447–466. | 10.1086/258537 | Policy lags |
| sargent1975 | Sargent, T. J., and N. Wallace. 1975. "'Rational' Expectations, the Optimal Monetary Instrument, and the Optimal Money Supply Rule." *Journal of Political Economy* 83 (2): 241–254. | 10.1086/260321 | Policy ineffectiveness (the expected-policy share) |
| kydland1977 | Kydland, F. E., and E. C. Prescott. 1977. "Rules Rather than Discretion: The Inconsistency of Optimal Plans." *Journal of Political Economy* 85 (3): 473–491. | 10.1086/260580 | Rules vs discretion; commitment in the optimal path |
| barro1983 | Barro, R. J., and D. B. Gordon. 1983. "Rules, Discretion and Reputation in a Model of Monetary Policy." *Journal of Monetary Economics* 12 (1): 101–121. | 10.1016/0304-3932(83)90051-X | Credibility |
| svensson1997 | Svensson, L. E. O. 1997. "Inflation Forecast Targeting: Implementing and Monitoring Inflation Targets." *European Economic Review* 41 (6): 1111–1146. | 10.1016/S0014-2921(96)00055-4 | Quadratic loss in inflation and output |
| anderson1996 | Anderson, E. W., L. P. Hansen, E. R. McGrattan, and T. J. Sargent. 1996. "Mechanics of Forming and Estimating Dynamic Linear Economies." In *Handbook of Computational Economics*, vol. 1, 171–252. | 10.1016/S1574-0021(96)01006-4 | Linear-quadratic control (the optimal rule). Open staff-report version: Minneapolis Fed Staff Report 198, DOI 10.21034/sr.198 (download timed out; retry) |
| woodford2003 | Woodford, M. 2003. *Interest and Prices: Foundations of a Theory of Monetary Policy*. Princeton: Princeton University Press. | 10.1515/9781400830169 (Crossref lists 2004 for the online edition; print 2003 to confirm from the copyright page) | Interest-rate rules, quadratic welfare loss. Held out of `references.bib` until the year is confirmed |

## To verify

| Work | What is known | What is needed |
|---|---|---|
| Friedman, M. 1968. "The Role of Monetary Policy." *American Economic Review* 58 (1): 1–17. | Confirmed by several course pages and commentaries; no DOI (JSTOR blocks automated checks) | JSTOR copy (UWRF library) |
| Okun, A. M. 1962. "Potential GNP: Its Measurement and Significance." *Proceedings of the Business and Economic Statistics Section*, American Statistical Association, 98–104. | Secondary sources disagree on the last page (103 or 104); reprinted in Okun, *The Political Economy of Prosperity* (Brookings, 1970), 132–145 | A copy of the original or the reprint; settle the pages |
| Mankiw, N. G. *Macroeconomics*. Worth/Macmillan. | The 11th edition (2022) exists (US print ISBN 9781319263904). The dynamic AD/AS chapter's number varies by edition | Which edition you use, and the chapter and page numbers from your copy |
| OpenStax. *Principles of Macroeconomics 3e*. | The book page answers at openstax.org | Authors, year and URL from the book's own citation page |
| Ljungqvist, L., and T. J. Sargent. *Recursive Macroeconomic Theory*. MIT Press. | Only a 2001 review of the first edition came up in Crossref | Edition and year, if we cite it for LQ control |
| Lengwiler (2004) author copy | edoc.unibas.ch record 12557 may hold a free copy | Check the record |
| Woltjer (2003) Maastricht working paper | DOI 10.26481/umamet.2003002 | Only if the JEE version cannot be obtained |
| Federal Reserve Bank of San Francisco, "Chair the Fed" game | Not yet searched | Confirm it exists and still runs, if we discuss web games |
| JEE instructions for authors (Taylor & Francis) | The page blocks automated access | Section names, length limits, abstract length, reference style, AI-use policy |
