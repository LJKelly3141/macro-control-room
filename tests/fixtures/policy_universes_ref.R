sras_p <- function(y, shift = 0) 80 + 12000 / (10000 + shift - y)
ad_p <- function(y, shift = 0) 90 + 0.02 * (8800 + shift - y)
equilibrium <- function(ad = 0, sras = 0) {
  y <- uniroot(function(y) sras_p(y, sras) - ad_p(y, ad), c(6000, 9990 + sras), tol = 1e-6)$root
  list(y = y, p = ad_p(y, ad))
}
simulate <- function(lambda, shock_at = 2, shock_ad = 700, periods = 24, policy_at = NA, policy_ad = 1400) {
  ad <- 1400; sras <- 0; out <- vector("list", periods + 1)
  for (t in 0:periods) {
    if (t == shock_at) ad <- shock_ad
    if (!is.na(policy_at) && t == policy_at) ad <- policy_ad
    e <- equilibrium(ad, sras)
    out[[t + 1]] <- data.frame(t = t, y = e$y, p = e$p)
    sras <- sras - lambda * (e$y - 9500)
  }
  do.call(rbind, out)
}
cases <- list(list(1.5,NA),list(0.15,NA),list(1,NA),list(1,4),list(1,8))
res <- lapply(cases, function(c) { s <- simulate(c[[1]], policy_at=c[[2]]); list(lambda=c[[1]], policy_at=if(is.na(c[[2]])) NULL else c[[2]], y=round(s$y,4), p=round(s$p,4)) })
cat(jsonlite::toJSON(res, auto_unbox=TRUE, digits=NA))
