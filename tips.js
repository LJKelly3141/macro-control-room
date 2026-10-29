/*
 * Macro Control Room: hover and tap explanations.
 *
 * PU.TIPS holds every explanation, keyed by name, so all the wording lives in
 * one place. Any element (HTML or SVG) with data-tip="<key>" or
 * data-tip-text="<text>" shows a tooltip on hover, on keyboard focus, and on
 * tap. PU.tips.attach(el, keyOrText) sets the attribute; PU.tips.text(key)
 * returns the wording. Unknown keys are shown as given, so a typo is visible
 * rather than silent.
 */
(function (root) {
  'use strict';
  root.PU = root.PU || {};

  var TIPS = {
    // Game
    mission: 'Your mission is the Federal Reserve\'s dual mandate: maximum employment (unemployment near the natural rate of 5%) and stable prices (inflation near the 2% target). The game measures how much better or worse the economy did because of your policy, compared with doing nothing. You win if your policy beat doing nothing. No policy means no change in spending or taxes, and a central bank that keeps the real interest rate at its neutral 1%, moving the interest rate only to keep up with expected inflation.',
    stars: 'Welfare compared with no policy: the share of the economy\'s losses your policy avoided. Each round\'s loss is the squared distance of unemployment from 5% plus the squared distance of inflation from 2%, so big misses count much more than small ones. +40% means policy cut the losses by 40%; below 0 means doing nothing would have been better.',
    greenZone: 'The green zone is a guide to the dual mandate: unemployment close to the natural rate of 5% and inflation close to the 2% target. Congress gave the Federal Reserve the goals of maximum employment and stable prices; since 2012 the Fed has defined stable prices as 2% inflation. The score itself is the welfare loss, which grows the farther the economy is from 5% and 2%.',
    round: 'Each round is one period of time. The event hits in round 1. After that your policies arrive, and wages and prices adjust.',
    event: 'The event that hit the economy at the start of the game. Both universes get exactly the same event.',
    play: 'Apply both teams\' choices and move the economy forward one round. Policy arrives after its lag, so it may not show up right away.',
    replay: 'Start over with the same event and the same settings, so you can try to do better on exactly the same situation. Your current game ends.',
    newGame: 'Start over with the same settings. A new event is drawn if the event is set to Random.',
    theme: 'Switch between light and dark. Dark mode is easier on the eyes in a dim room; light mode reads best on most projectors.',
    settings: 'Choose the event, the number of rounds, and the rules of each universe. Settings lock once the game starts.',
    universeA: 'Universe A follows one set of rules about how fast wages and prices adjust and how people react to policy. Change them in Settings.',
    universeB: 'Universe B gets the same event and the same policy choices as Universe A, but follows different rules. Compare how each one responds.',
    newkeynesian: 'New Keynesian rules: wages and prices are sticky in the short run but adjust over time, people partly see policy coming, and the central bank is credible, so inflation expectations stay near 2%. Monetary policy is the main tool, and the Taylor rule is switched on.',
    monetarist: 'Monetarist rules (Milton Friedman): monetary policy has strong but temporary effects on output. People form expectations from past inflation, so if the central bank lets inflation run, it keeps rising. There is no lasting trade-off between inflation and unemployment.',
    credibility: 'Central bank credibility: how firmly people believe inflation will return to 2%. At 0%, people expect last round\'s inflation to continue (adaptive expectations), so inflation that gets going keeps going. At 100%, expectations stay anchored at 2% whatever happens.',
    rateSensitivity: 'How strongly spending responds to the real interest rate. Higher values make monetary policy more powerful.',
    showRealRate: 'Show the real interest rate: the interest rate minus expected inflation. Spending responds to the real rate, so if inflation rises and the interest rate does not, borrowing gets cheaper in real terms and spending rises.',
    realRate: 'The real interest rate: the nominal interest rate minus expected inflation (the Fisher equation). Above about 1% it holds spending back; below it, it encourages spending.',
    nominalRate: 'The nominal interest rate: the rate the central bank sets, the one you see quoted.',
    scoring: 'Score the game by welfare: add up each round\'s loss (squared distance of unemployment from 5% plus squared distance of inflation from 2%) with your policy and with no policy, and compare. Turn scoring off to just run the simulation.',
    zoneUnemployment: 'How close to the natural rate of 5% unemployment has to be to show in the green zone on the gauges. The zone is a guide; the score is the welfare loss.',
    zoneInflation: 'How close to the 2% target inflation has to be to show in the green zone on the gauges. The zone is a guide; the score is the welfare loss.',
    weightU: 'How much the welfare loss counts unemployment away from 5%. 1 is equal weight with inflation; 2 counts it double; 0 ignores it.',
    weightPi: 'How much the welfare loss counts inflation away from 2%. 1 is equal weight with unemployment; 2 counts it double; 0 ignores it.',
    keynesian: 'Keynesian rules: wages and prices are sticky, so the economy is slow to fix itself. Government spending has a multiplier. People do not see policy coming, so policy changes output.',
    neoclassical: 'Neoclassical rules: wages and prices are flexible, so the economy returns to potential GDP on its own. People expect policy, so it mostly changes prices, not output.',
    realworld: 'Real world rules: wages and prices adjust slowly at first and faster later. This follows the OpenStax rule of thumb that the economy is Keynesian in the short run and neoclassical in the long run.',

    // Teams and levers
    teamFiscal: 'Team Fiscal advises on government spending and taxes. Fiscal policy is decided by Congress and the President.',
    teamMonetary: 'Team Monetary advises on the interest rate. Monetary policy is decided by the Federal Reserve.',
    spending: 'Government spending. Raising it shifts AD right; cutting it shifts AD left. Each step is 100 of spending, and the multiplier makes the total effect bigger.',
    taxes: 'Taxes. A tax cut leaves people more to spend and shifts AD right; a tax increase shifts AD left. A tax change moves AD a bit less than the same change in spending, because people save part of it.',
    rate: 'The interest rate. Cutting it makes borrowing cheaper, so businesses invest and households buy more, and AD shifts right. Raising it shifts AD left. The rate moves in steps of 25 basis points (0.25 percentage point); each step moves AD by 75. The rate cannot go below 0%. Holding the rate is itself a choice: if expected inflation rises and the rate stays put, the real rate falls and AD shifts right.',
    rateLevel: 'The interest rate after this round\'s change. It started at 3%.',
    supply: 'Supply-side investment in education and technology. It costs stars nothing but takes 3 rounds to raise potential GDP.',
    lagNote: 'When this round\'s choices take effect in each universe. Policy takes time to pass and to change spending.',
    shockPick: 'Pick the shock that hits this round. Only shown when Settings has shocks set to "I choose each round".',

    // Gauges and measures
    unemployment: 'Unemployment rate: the share of people who want a job and cannot find one. It rises when real GDP falls below potential GDP. The natural rate here is 5%.',
    inflation: 'Inflation rate: how fast the price level is rising. It includes 2% background inflation, so it reads 2% when nothing is pushing prices up or down. The target is 2%.',
    outputGap: 'Output gap: how far real GDP is from potential GDP, in percent. Below zero is a recessionary gap; above zero is an inflationary gap.',
    priceLevel: 'Price level: the average level of prices, set to 104 at the start.',
    realGdp: 'Real GDP: the total output of the economy, adjusted for inflation.',
    potentialGdp: 'Potential GDP: what the economy produces when everyone who wants a job has one (unemployment at the natural rate). The LRAS line sits here.',
    naturalRate: 'The natural rate of unemployment, 5% here. Unemployment returns to it when real GDP equals potential GDP.',
    target: 'The inflation target, 2%. Central banks such as the Federal Reserve aim for about 2% inflation.',
    change: 'The change since last round.',

    // AD/AS diagram
    adas: 'The AD/AS model for this universe: the price level up the side, real GDP across. The large dot is where the economy is now.',
    ad: 'Aggregate demand (AD): total spending at each price level. Spending increases, tax cuts, a lower real interest rate, and booms shift it right.',
    sras: 'Short-run aggregate supply (SRAS): how much firms produce at each price level while wages are fixed. It shifts up as expected inflation is built into wages and prices, and shifts when costs such as oil change.',
    lras: 'Long-run aggregate supply (LRAS): potential GDP. In the long run the economy produces here whatever the price level.',
    equilibrium: 'Where AD and SRAS cross: this round\'s real GDP and price level.',
    trail: 'Where the economy was in earlier rounds.',
    lastRound: 'Dashed lines: where the curves were last round, so you can see what shifted.',

    // No-policy path, predictions, autopilot, tutorial
    noPolicy: 'What would have happened with no policy: same event, same universe. No policy means no change in spending or taxes, and a central bank that keeps the real interest rate at its neutral 1%, moving the interest rate only to keep up with expected inflation. Compare it with what your policy did.',
    predict: 'Before you play the round, predict what will happen in each universe. Then play and see if you were right. A change smaller than 0.2 points counts as about the same.',
    predictUp: 'Predict it will rise by more than 0.2 points.',
    predictSame: 'Predict it will stay about the same, within 0.2 points.',
    predictDown: 'Predict it will fall by more than 0.2 points.',
    predictScore: 'How many of your predictions were right so far.',
    atLimit: 'The model holds aggregate demand and supply within limits, so the curves stay where they mean something. These settings pushed the economy past one: the curve stops at the limit and the economy can sit off target for no economic reason. Try higher credibility or a smaller shock.',
    autopilotMonetary: 'Monetary autopilot: a Taylor rule sets the interest rate in each universe. It raises the rate when expected inflation is above 2% or output is above potential, and cuts it when they are below, moving halfway to its target each round.',
    autopilotFiscal: 'Fiscal autopilot: a balanced budget rule. Tax revenue rises and falls with GDP, and spending must follow it, so in a recession spending is cut and in a boom it rises.',
    tipsToggle: 'Turn these explanations on or off.',
    tutorial: 'A short guided tour of the game: the event, the goal, the dashboard, the teams, and how to play a round.',

    welfareRound: 'This round\'s welfare compared with no policy: the no-policy loss minus the loss with your policy. Positive means your policy did better than doing nothing this round.',
    welfareBars: 'One bar per round: up and green when your policy did better than doing nothing that round, down and red when it did worse.',
    optimalPath: 'The optimal path: the best policy the computer found for this economy and this event, choosing spending and the interest rate every round with the same buttons you have. It assumes perfect foresight (it knows exactly how the event will play out), so no real policymaker could do quite this well. It is the benchmark for the share of the achievable gain.',
    achievable: 'Share of the achievable gain: how much of the improvement that was possible your policy captured. 100% means you matched the optimal path; 0% means no better than doing nothing; below 0 means worse than doing nothing. Counted over the game plus 4 rounds after it, so a late sugar rush is charged for its hangover.',
    vsNone: 'Compared with doing nothing: the share of the no-policy loss your policy avoided, counted over the game plus 4 rounds after it. No policy means no change in spending or taxes, and a central bank that keeps the real interest rate at its neutral 1%, moving the interest rate only to keep up with expected inflation.',
    autopilotOptimalMonetary: 'Monetary autopilot, optimal rule: the interest rate rule that minimizes the welfare loss in a simplified (straight-line) version of this economy. It reacts to the current state of the economy, with no foresight, so a central bank could follow it. It can stumble when the rate is stuck at 0%.',
    autopilotOptimalFiscal: 'Fiscal autopilot, optimal rule: the government spending rule that minimizes the welfare loss in a simplified (straight-line) version of this economy, working together with monetary policy. It reacts to the current state, with no foresight.',
    autopilotMode: 'Hand this team to a rule. Off: the class decides. Taylor rule or balanced budget: the classic rules. Optimal rule: the rule derived from the welfare loss for this economy.',
    showHint: 'Before each round, show on each team panel what the optimal rule would do from where the economy is now. Use it as a hint, or to compare with your own advice.',
    hintFiscal: 'What the optimal rule would do with government spending this round, from where the economy is now. It works out the best response in a simplified version of this economy, so it is a strong guide but not a guarantee.',
    hintMonetary: 'What the optimal rule would do with the interest rate this round, from where the economy is now. It works out the best response in a simplified version of this economy, so it is a strong guide but not a guarantee.',
    showOptimal: 'Show the optimal path on the charts, gauges and round log, and score your policy as a share of the achievable gain.',
    discount: 'How much the optimal rule cares about future rounds: 0.95 means a round ahead counts 95% as much as now.',
    tuneCosts: 'The optimal rule needs a cost on moving each lever to choose a mix of the two (both move AD). These costs are not part of your score. With this on, the game tries a range of costs for this economy and keeps the pair whose rule gives the lowest welfare loss over the four events, so the rule is the best of its kind judged by the same loss you are scored on. Turn it off to set the costs by hand.',
    costFiscal: 'A cost on each step of fiscal policy, so the optimal rule moves gradually and does not swing spending around. Used only when the costs are not tuned to the welfare loss.',
    costRate: 'A cost on moving the interest rate, so the optimal rule moves gradually. At 0.8, a 25 basis point move costs 0.05, the same as one fiscal step at 0.05. Used only when the costs are not tuned to the welfare loss.',
    tailRounds: 'Rounds after the game, with no policy (no new spending or tax changes, and the real rate back at neutral), counted in every score, so policy is charged for effects that arrive after the last round.',
    // Tabs
    tabDashboard: 'Where the economy is now in each universe: the two gauges and the AD/AS model.',
    tabTime: 'How real GDP, unemployment, inflation and the price level moved round by round in both universes.',
    tabPhillips: 'Inflation against unemployment, round by round, with the green zone as a box.',
    tabLog: 'A table of every round: the event, both teams\' choices, and the results.',
    tabResults: 'Who won, who lost, and why.',

    // Charts and log
    chartGdp: 'Real GDP each round, with potential GDP as a gray dotted line and the no-policy path dashed. When GDP is below potential, unemployment is above the natural rate.',
    chartUnemployment: 'Unemployment each round. The green band is the green zone.',
    chartInflation: 'Inflation each round. The green band is the green zone.',
    chartPrice: 'The price level each round.',
    phillips: 'The Phillips curve trace: each point is one round, with unemployment across and inflation up. In the short run lower unemployment tends to come with higher inflation. In the long run unemployment returns to the natural rate.',
    log: 'Every round: the event, both teams\' choices, and what happened in each universe.',
    arrived: 'A policy took effect in this universe this round.',

    // Settings
    rounds: 'How many rounds the game lasts.',
    eventSetting: 'The event that hits in round 1. Random picks one when the game starts.',
    shockMode: 'One event: a single event at the start that the teams respond to. Several shocks: a fixed series of shocks during the game. I choose each round: you pick the shock every round.',
    supplyLever: 'Adds a supply-side investment lever to the game.',
    name: 'The name shown for this universe.',
    preset: 'Load a ready-made set of rules. You can change any value after.',
    reset: 'Put this universe back to its preset values.',
    lambda: 'How fast wages and prices adjust. At 0 they never adjust and a gap lasts forever. Higher values close the gap faster: the economy fixes itself.',
    multiplier: 'The spending multiplier: how much total spending changes for each 1 of government spending. Keynesians expect a multiplier above 1.',
    expected: 'How much of a policy people see coming. Expected policy is built into wages and prices at once, so it raises prices instead of output. This is the idea of rational expectations.',
    inertia: 'Inflation inertia: how much of last round\'s inflation (above or below the 2% target) people expect to continue. High inertia means a burst of inflation keeps going and fades slowly. Low inertia means expectations stay anchored at 2%, so inflation snaps back.',
    fiscalLag: 'Rounds before fiscal policy takes effect. Spending and tax changes need to pass Congress and reach the economy.',
    monetaryLag: 'Rounds before an interest rate change takes effect. The Fed decides quickly, but borrowing and spending take time to respond.',
    lambdaLate: 'How fast wages and prices adjust after the switch round.',
    switchRound: 'The round in which the adjustment speed changes.',
    speedsUp: 'Let wages and prices adjust slowly at first and faster later.',
    copyLink: 'Copy a link that opens the game with these settings.'
  };

  var tipEl = null, current = null;
  // Tips can be switched off; the choice is remembered in this browser when it can be.
  var enabled = true;
  try { enabled = root.localStorage.getItem('pu-tips') !== 'off'; } catch (e) { enabled = true; }
  function setEnabled(on) {
    enabled = !!on;
    try { root.localStorage.setItem('pu-tips', enabled ? 'on' : 'off'); } catch (e) { /* storage blocked: fine */ }
    if (typeof document !== 'undefined') document.documentElement.classList.toggle('tips-off', !enabled);
    if (!enabled) hide();
  }

  function text(key) { return TIPS[key] || key; }

  function attach(el, keyOrText) {
    if (!el) return el;
    if (TIPS[keyOrText]) el.setAttribute('data-tip', keyOrText);
    else el.setAttribute('data-tip-text', keyOrText);
    return el;
  }

  function target(node) {
    while (node && node.nodeType === 1) {
      if (node.hasAttribute('data-tip') || node.hasAttribute('data-tip-text')) return node;
      node = node.parentNode;
    }
    return null;
  }

  function ensure() {
    if (tipEl) return tipEl;
    tipEl = document.createElement('div');
    tipEl.className = 'pu-tip';
    tipEl.id = 'pu-tip';
    tipEl.setAttribute('role', 'tooltip');
    tipEl.hidden = true;
    document.body.appendChild(tipEl);
    return tipEl;
  }

  function show(node) {
    if (!enabled) return;
    var t = ensure();
    current = node;
    // An open modal dialog sits in the top layer above the page, so the tip
    // has to live inside it to be seen.
    var host = (node.closest && node.closest('dialog[open]')) || document.body;
    if (t.parentNode !== host) host.appendChild(t);
    t.textContent = node.hasAttribute('data-tip') ? text(node.getAttribute('data-tip')) : node.getAttribute('data-tip-text');
    t.hidden = false;
    if (node.setAttribute && node.tagName && /^(BUTTON|INPUT|SELECT|A|SUMMARY)$/.test(node.tagName)) {
      node.setAttribute('aria-describedby', 'pu-tip');
    }
    var r = node.getBoundingClientRect();
    var tw = t.offsetWidth, th = t.offsetHeight;
    var vw = document.documentElement.clientWidth, vh = document.documentElement.clientHeight;
    var x = Math.min(Math.max(8, r.left + r.width / 2 - tw / 2), vw - tw - 8);
    var y = r.bottom + 8;
    if (y + th > vh - 8) y = Math.max(8, r.top - th - 8);
    t.style.left = x + 'px';
    t.style.top = y + 'px';
  }

  function hide() {
    if (tipEl) tipEl.hidden = true;
    if (current && current.removeAttribute) current.removeAttribute('aria-describedby');
    current = null;
  }

  function install() {
    document.addEventListener('mouseover', function (ev) {
      var n = target(ev.target);
      if (n && n !== current) show(n);
      else if (!n && current) hide();
    });
    // Keyboard focus only: a mouse click on a button should not leave a tip on screen.
    document.addEventListener('focusin', function (ev) {
      var n = target(ev.target);
      var kb = true;
      try { kb = ev.target.matches(':focus-visible'); } catch (e) { kb = true; }
      if (n && kb) show(n);
    });
    document.addEventListener('focusout', hide);
    // Touch: a tap on an element with a tip shows it; a tap elsewhere hides it.
    document.addEventListener('touchstart', function (ev) {
      var n = target(ev.target);
      if (n) show(n); else hide();
    }, { passive: true });
    document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') hide(); });
    root.addEventListener('scroll', hide, true);
  }

  root.PU.TIPS = TIPS;
  root.PU.tips = { attach: attach, text: text, hide: hide, setEnabled: setEnabled, isEnabled: function () { return enabled; } };
  if (typeof document !== 'undefined') document.documentElement.classList.toggle('tips-off', !enabled);
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
    else install();
  }
})(typeof window !== 'undefined' ? window : globalThis);
