/*
 * Macro Control Room: wiring. Owns the sidebar (mission, Team Fiscal, Team
 * Monetary, Play), the event card, the tabs, the settings dialog, the results
 * view and the game loop; every other view is drawn by its own file.
 *
 * A game: the event card opens, "begin" plays round 1 (the event hits with no
 * policy yet), then each round the teams advise and Play moves it on.
 *
 * Views measure their container to size their SVG, so a view is drawn only
 * while its tab is showing: after each round the visible tab redraws, and a
 * tab redraws when it is opened.
 */
(function (root) {
  'use strict';
  var PU = root.PU;
  var E = PU.engine;
  var SLOTS = ['a', 'b'];   // the universes in play: ['a'] in one-universe mode
  var TABS = ['dashboard', 'time', 'phillips', 'log', 'results'];

  var game = null;
  var config = null;
  var active = 'dashboard';
  var els = {};

  function $(id) { return document.getElementById(id); }

  function el(tag, attrs, text) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === 'class') n.className = attrs[k];
      else if (k === 'hidden') n.hidden = !!attrs[k];
      else n.setAttribute(k, attrs[k]);
    }
    if (text != null) n.textContent = text;
    return n;
  }

  function names() {
    var out = {};
    SLOTS.forEach(function (s) { out[s] = (config && config.universes[s].name) || ('Universe ' + s.toUpperCase()); });
    return out;
  }
  function colors() { return { a: PU.COLORS.a, b: PU.COLORS.b }; }
  function signed(v) { return (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v); }
  function pct(v) { return v.toFixed(1) + '%'; }
  function starText(n) { return n === 1 ? '1 star' : n + ' stars'; }

  // ---- Sidebar controls -----------------------------------------------------
  // A lever is a console stepper: a minus button, a readout of the change
  // about to be made, and a plus button. describe(v) gives the readout:
  // { big, what, dir } where dir is 'up' (pushes AD right), 'down' or ''.
  function lever(id, label, tip, range, describe, stepTips) {
    var wrap = el('div', { class: 'lever' });
    var name = el('div', { class: 'lever-name', id: id + '-name', 'data-tip': tip }, label);
    var row = el('div', { class: 'stepper' });
    var minus = el('button', { type: 'button', class: 'knob', 'aria-label': stepTips[0], 'data-tip-text': stepTips[0], 'aria-controls': id }, '−');
    var plus = el('button', { type: 'button', class: 'knob', 'aria-label': stepTips[1], 'data-tip-text': stepTips[1], 'aria-controls': id }, '+');
    var ind = el('div', { class: 'readout', id: id, role: 'status', 'aria-live': 'polite', 'aria-labelledby': id + '-name', 'data-tip': tip });
    var big = el('div', { class: 'readout-big' });
    var what = el('div', { class: 'readout-what' });
    var track = el('div', { class: 'readout-track', 'aria-hidden': 'true' });
    var fill = el('b');
    track.appendChild(fill);
    ind.appendChild(big); ind.appendChild(what); ind.appendChild(track);
    row.appendChild(minus); row.appendChild(ind); row.appendChild(plus);
    wrap.appendChild(name); wrap.appendChild(row);

    var api = { wrap: wrap, value: 0, disabled: false, bounds: function () { return [range.min, range.max]; } };
    function draw() {
      var d = describe(api.value);
      big.textContent = d.big;
      what.textContent = d.what;
      ind.className = 'readout' + (d.dir ? ' ' + d.dir : '');
      var half = 50 * Math.abs(api.value) / Math.max(Math.abs(range.min), range.max);
      fill.style.left = (api.value < 0 ? 50 - half : 50) + '%';
      fill.style.width = half + '%';
      var b = api.bounds();
      minus.disabled = api.disabled || api.value - range.step < b[0] - 1e-9;
      plus.disabled = api.disabled || api.value + range.step > b[1] + 1e-9;
    }
    function step(sign) {
      api.value = Math.round((api.value + sign * range.step) * 100) / 100;
      draw();
      updateTiming();
      updateClear();
    }
    minus.addEventListener('click', function () { step(-1); });
    plus.addEventListener('click', function () { step(1); });
    api.set = function (v) { api.value = v; draw(); };
    api.setDisabled = function (on) { api.disabled = !!on; draw(); };
    api.redraw = draw;
    draw();
    return api;
  }

  function buildControls() {
    var host = $('controls');
    var R = E.RANGES;

    var fiscal = el('fieldset', { class: 'team team-fiscal' });
    fiscal.appendChild(el('legend', { 'data-tip': 'teamFiscal' }, 'Team Fiscal'));
    els.fiscalAuto = autoSegment('fiscal');
    fiscal.appendChild(els.fiscalAuto);
    els.spending = lever('lever-spending', 'Government spending', 'spending', R.spending, function (v) {
      if (game && modeOf('fiscal')) return { big: 'Autopilot', what: MODE_WORDS[modeOf('fiscal')], dir: '' };
      if (v > 0) return { big: '▲ ' + signed(v), what: 'More spending: AD shifts right', dir: 'up' };
      if (v < 0) return { big: '▼ ' + signed(v), what: 'Less spending: AD shifts left', dir: 'down' };
      return { big: 'No change', what: 'AD stays put', dir: '' };
    }, ['Spend less: one step down', 'Spend more: one step up']);
    els.taxes = lever('lever-taxes', 'Taxes', 'taxes', R.taxes, function (v) {
      if (game && modeOf('fiscal')) return { big: 'Autopilot', what: MODE_WORDS[modeOf('fiscal')], dir: '' };
      if (v < 0) return { big: '▼ ' + signed(v), what: 'Tax cut: AD shifts right', dir: 'up' };
      if (v > 0) return { big: '▲ ' + signed(v), what: 'Tax rise: AD shifts left', dir: 'down' };
      return { big: 'No change', what: 'AD stays put', dir: '' };
    }, ['Cut taxes: one step down', 'Raise taxes: one step up']);
    fiscal.appendChild(els.spending.wrap);
    fiscal.appendChild(els.taxes.wrap);
    els.fiscalNote = el('p', { class: 'auto-note', hidden: true, 'data-tip': 'autopilotFiscal' });
    fiscal.appendChild(els.fiscalNote);
    els.fiscalHint = el('p', { class: 'hint-note', hidden: true, 'data-tip': 'hintFiscal', 'aria-live': 'polite' });
    fiscal.insertBefore(els.fiscalHint, els.fiscalAuto.nextSibling);   // next to the decision

    var monetary = el('fieldset', { class: 'team team-monetary' });
    monetary.appendChild(el('legend', { 'data-tip': 'teamMonetary' }, 'Team Monetary'));
    els.monetaryAuto = autoSegment('monetary');
    monetary.appendChild(els.monetaryAuto);
    els.rate = lever('lever-rate', 'Interest rate', 'rate', R.rate, function (v) {
      if (game && modeOf('monetary')) return { big: 'Autopilot', what: MODE_WORDS[modeOf('monetary')], dir: '' };
      var now = game ? game.rate : E.START_RATE;
      var next = Math.max(0, Math.min(E.RATE_MAX, now + v));
      var by = Math.abs(v).toFixed(2) + ' from ' + now.toFixed(2) + '%';
      if (v < 0) return { big: next.toFixed(2) + '%', what: '▼ ' + by + ': AD shifts right', dir: 'up' };
      if (v > 0) return { big: next.toFixed(2) + '%', what: '▲ ' + by + ': AD shifts left', dir: 'down' };
      return { big: now.toFixed(2) + '%', what: 'Hold the rate', dir: '' };
    }, ['Cut the rate 25 basis points', 'Raise the rate 25 basis points']);
    // The rate itself stays between 0 and the maximum.
    els.rate.bounds = function () {
      var now = game ? game.rate : E.START_RATE;
      return [Math.max(R.rate.min, -now), Math.min(R.rate.max, E.RATE_MAX - now)];
    };
    monetary.appendChild(els.rate.wrap);
    els.monetaryNote = el('p', { class: 'auto-note', hidden: true, 'data-tip': 'autopilotMonetary' });
    monetary.appendChild(els.monetaryNote);
    els.monetaryHint = el('p', { class: 'hint-note', hidden: true, 'data-tip': 'hintMonetary', 'aria-live': 'polite' });
    monetary.insertBefore(els.monetaryHint, els.monetaryAuto.nextSibling);

    els.supplyWrap = el('fieldset', { class: 'team team-supply', hidden: true });
    els.supplyWrap.appendChild(el('legend', { 'data-tip': 'supply' }, 'Supply side'));
    els.supply = lever('lever-supply', 'Education and technology', 'supply', E.RANGES.supply, function (v) {
      return v > 0 ? { big: '▲ +' + v, what: 'Invest: potential GDP rises in 3 rounds', dir: 'up' }
        : { big: 'None', what: 'No new investment', dir: '' };
    }, ['Invest less', 'Invest more']);
    els.supplyWrap.appendChild(els.supply.wrap);

    els.shockWrap = el('div', { class: 'lever', hidden: true });
    els.shockWrap.appendChild(el('label', { for: 'lever-shock', 'data-tip': 'shockPick' }, 'Shock this round'));
    els.shock = el('select', { id: 'lever-shock', 'data-tip': 'shockPick' });
    Object.keys(E.SHOCKS).forEach(function (k) { els.shock.appendChild(el('option', { value: k }, E.SHOCKS[k].label)); });
    els.shockWrap.appendChild(els.shock);

    host.appendChild(fiscal);
    host.appendChild(monetary);
    host.appendChild(els.supplyWrap);
    host.appendChild(els.shockWrap);

    els.timing = el('p', { class: 'timing', 'data-tip': 'lagNote' });
    host.appendChild(els.timing);

    els.clear = el('button', { type: 'button', class: 'clear-link', hidden: true, 'data-tip-text': 'Set every lever back to no change.' }, 'Clear all to no change');
    els.clear.addEventListener('click', function () { resetLevers(); updateTiming(); });
    host.appendChild(els.clear);

    var actions = el('div', { class: 'actions' });
    els.play = el('button', { type: 'button', class: 'primary', 'data-tip': 'play' }, 'Play round');
    els.reset = el('button', { type: 'button', 'data-tip': 'newGame' }, 'New game');
    actions.appendChild(els.play);
    actions.appendChild(els.reset);
    host.appendChild(actions);
    els.replay = el('button', { type: 'button', class: 'replay-btn', hidden: true, 'data-tip': 'replay' }, 'Replay this event');
    els.replay.addEventListener('click', replayGame);
    host.appendChild(els.replay);

    els.play.addEventListener('click', playRound);
    els.reset.addEventListener('click', function () { newGame(PU.settings.get(), true); });
  }

  // An on/off switch on a team panel that hands the team to its rule. It can be
  // flipped at any point in a game; the rule takes over from the next round.
  // Autopilot modes: monetary false | 'taylor' | 'optimal'; fiscal false | 'balanced' | 'optimal'.
  function modeOf(kind) {
    var m = game ? game.autopilot[kind] : false;
    if (m === true) return kind === 'monetary' ? 'taylor' : 'balanced';
    return m || false;
  }
  var MODE_WORDS = { taylor: 'Taylor rule', balanced: 'Balanced budget rule', optimal: 'Optimal rule' };

  // A three-way control on a team panel: Off, the classic rule, or the optimal
  // rule. It can be changed at any point in a game; the choice applies from the
  // next round.
  function autoSegment(kind) {
    var opts = kind === 'monetary'
      ? [[false, 'Off', 'autopilotMode'], ['taylor', 'Taylor rule', 'autopilotMonetary'], ['optimal', 'Optimal rule', 'autopilotOptimalMonetary']]
      : [[false, 'Off', 'autopilotMode'], ['balanced', 'Balanced budget', 'autopilotFiscal'], ['optimal', 'Optimal rule', 'autopilotOptimalFiscal']];
    var box = el('div', { class: 'auto-seg', role: 'radiogroup', 'aria-label': 'Team ' + (kind === 'monetary' ? 'Monetary' : 'Fiscal') + ' autopilot', 'data-tip': 'autopilotMode' });
    box.appendChild(el('span', { class: 'auto-seg-label' }, 'Autopilot'));
    var row = el('div', { class: 'auto-seg-row' });
    opts.forEach(function (o) {
      var b = el('button', { type: 'button', role: 'radio', 'aria-checked': 'false', 'data-mode': String(o[0]), 'data-tip': o[2] }, o[1]);
      b.addEventListener('click', function () {
        if (!game || game.isOver()) return;
        game.autopilot[kind] = o[0];
        var x = {}; x[kind] = o[0];
        PU.settings.setAutopilot(x);
        if (kind === 'fiscal') { els.spending.set(0); els.taxes.set(0); }
        else els.rate.set(0);
        announce('Team ' + (kind === 'fiscal' ? 'Fiscal' : 'Monetary') + ' autopilot: ' + (o[0] ? o[1] : 'off') + '.');
        renderSidebar();
      });
      row.appendChild(b);
    });
    box.appendChild(row);
    return box;
  }

  function autoSwitch(kind, label, tip) {
    var b = el('button', { type: 'button', class: 'auto-switch', role: 'switch', 'aria-checked': 'false', 'data-tip': tip });
    b.appendChild(el('span', { class: 'auto-knob', 'aria-hidden': 'true' }));
    b.appendChild(el('span', { class: 'auto-label' }, label));
    b.addEventListener('click', function () {
      if (!game || game.isOver()) return;
      var on = !game.autopilot[kind];
      game.autopilot[kind] = on;
      var o = {}; o[kind] = on;
      PU.settings.setAutopilot(o);
      if (kind === 'fiscal') { els.spending.set(0); els.taxes.set(0); }
      else els.rate.set(0);
      announce('Team ' + (kind === 'fiscal' ? 'Fiscal' : 'Monetary') + ' autopilot ' + (on ? 'on' : 'off') + '.');
      renderSidebar();
    });
    return b;
  }

  function resetLevers() {
    [els.spending, els.taxes, els.rate, els.supply].forEach(function (l) { l.set(0); });
    els.shock.value = 'none';
    updateClear();
  }

  function updateClear() {
    if (!els.clear) return;
    els.clear.hidden = ![els.spending, els.taxes, els.rate, els.supply].some(function (l) { return l && l.value !== 0; });
  }

  // ---- Theme ------------------------------------------------------------------
  // Light or dark: remembered in this browser when it can be, otherwise the
  // system setting decides.
  function isDark() {
    var t = document.documentElement.getAttribute('data-theme');
    if (t) return t === 'dark';
    return !!(root.matchMedia && root.matchMedia('(prefers-color-scheme: dark)').matches);
  }
  function setTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    try { root.localStorage.setItem('pu-theme', t); } catch (e) { /* storage blocked: fine */ }
    syncThemeButton();
  }
  function syncThemeButton() {
    var b = $('theme-toggle');
    if (!b) return;
    var dark = isDark();
    b.textContent = dark ? 'Light mode' : 'Dark mode';
    b.setAttribute('aria-pressed', dark ? 'true' : 'false');
  }
  function buildTheme() {
    try { var saved = root.localStorage.getItem('pu-theme'); if (saved === 'light' || saved === 'dark') document.documentElement.setAttribute('data-theme', saved); } catch (e) { /* ignore */ }
    $('theme-toggle').addEventListener('click', function () { setTheme(isDark() ? 'light' : 'dark'); });
    if (root.matchMedia) {
      var mq = root.matchMedia('(prefers-color-scheme: dark)');
      if (mq.addEventListener) mq.addEventListener('change', syncThemeButton);
    }
    syncThemeButton();
  }

  // ---- Dialogs ----------------------------------------------------------------
  function openDialog(d) { if (d.showModal) { if (!d.open) d.showModal(); } else d.setAttribute('open', ''); }
  function closeDialog(d) { if (d.close) { if (d.open) d.close(); } else d.removeAttribute('open'); }

  function buildDialogs() {
    var sd = $('settings-dialog');
    function openSettings() {
      $('unlock-settings').hidden = !(game && game.round > 0);
      openDialog(sd);
    }
    $('open-settings').addEventListener('click', openSettings);
    // From the event card: change settings before the event hits. Closing the
    // settings window at round 0 brings the event card back.
    $('event-settings').addEventListener('click', function () { closeDialog($('event-dialog')); openSettings(); });
    // Locked mid-game or after it: end the game and unlock, keeping the window open.
    $('unlock-settings').addEventListener('click', function () {
      newGame(PU.settings.get(), false);
      $('unlock-settings').hidden = true;
    });
    $('close-settings').addEventListener('click', function () { closeDialog(sd); });
    sd.addEventListener('click', function (ev) { if (ev.target === sd) closeDialog(sd); });
    // Settings changed before the event hit: show the (possibly new) event card.
    sd.addEventListener('close', function () { if (game && game.round === 0) showEventCard(); });

    var tipsBtn = $('tips-toggle');
    function syncTips() { var on = PU.tips.isEnabled(); tipsBtn.textContent = 'Tips: ' + (on ? 'on' : 'off'); tipsBtn.setAttribute('aria-pressed', on ? 'true' : 'false'); }
    tipsBtn.addEventListener('click', function () { PU.tips.setEnabled(!PU.tips.isEnabled()); syncTips(); });
    syncTips();
    $('open-tour').addEventListener('click', function () { if (game && game.round === 0) { closeDialog($('event-dialog')); beginGame(); } startTour(); });
    $('event-tour').addEventListener('click', function () { closeDialog($('event-dialog')); beginGame(); startTour(); });

    $('event-begin').addEventListener('click', function () {
      closeDialog($('event-dialog'));
      beginGame();
    });
    // Escape on the event card still starts the game, so it is never stuck at round 0.
    $('event-dialog').addEventListener('cancel', function (ev) { ev.preventDefault(); closeDialog($('event-dialog')); beginGame(); });
  }

  function showEventCard() {
    if (!game || game.shockMode !== 'event') { return; }
    var ev = E.SHOCKS[game.event];
    $('event-headline').textContent = ev.headline;
    $('event-what').textContent = ev.what;
    openDialog($('event-dialog'));
  }

  // ---- Tabs ---------------------------------------------------------------
  function buildTabs() {
    var buttons = TABS.map(function (t) { return $('tab-' + t); });
    buttons.forEach(function (b, i) {
      b.addEventListener('click', function () { showTab(TABS[i]); });
      b.addEventListener('keydown', function (ev) {
        if (ev.key !== 'ArrowRight' && ev.key !== 'ArrowLeft' && ev.key !== 'Home' && ev.key !== 'End') return;
        var vis = buttons.filter(function (x) { return !x.hidden; });
        var j = vis.indexOf(b);
        if (ev.key === 'ArrowRight') j = (j + 1) % vis.length;
        else if (ev.key === 'ArrowLeft') j = (j - 1 + vis.length) % vis.length;
        else if (ev.key === 'Home') j = 0;
        else j = vis.length - 1;
        ev.preventDefault();
        showTab(vis[j].id.replace('tab-', ''));
        vis[j].focus();
      });
    });
  }

  function showTab(name) {
    active = name;
    TABS.forEach(function (t) {
      var on = t === name;
      var b = $('tab-' + t);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
      b.tabIndex = on ? 0 : -1;
      $('panel-' + t).hidden = !on;
    });
    renderActive();
  }

  // ---- Game loop --------------------------------------------------------------
  // sameEvent: replay the event of the game just played (even if the event
  // setting is Random), so the class can try the same situation again.
  function newGame(cfg, withCard, sameEvent) {
    config = cfg;
    var event = sameEvent || (cfg.event && cfg.event !== 'random' ? cfg.event : E.EVENTS[Math.floor(Math.random() * E.EVENTS.length)]);
    SLOTS = cfg.universeCount === 2 ? ['a', 'b'] : ['a'];
    scoring = E.scoringOf(cfg.scoring);
    var unis = {};
    SLOTS.forEach(function (k) { unis[k] = cfg.universes[k]; });
    $('universe-b').hidden = SLOTS.length < 2;
    document.querySelector('.universes').classList.toggle('single', SLOTS.length < 2);
    renderMissionText();
    game = E.createGame({
      rounds: cfg.rounds, shockMode: cfg.shockMode || 'event', event: event,
      persistence: cfg.persistence,
      autopilot: cfg.autopilot || { monetary: false, fiscal: false },
      optimal: optimalOpts(cfg),
      scoring: cfg.scoring,
      universes: unis
    });
    predictTally = { right: 0, total: 0 };
    bench = null; benchPending = false; finals = null; snap1 = null;
    clearPredictions();
    $('predict-result').textContent = '';
    PU.settings.lock(false);
    resetLevers();
    els.shockWrap.hidden = game.shockMode !== 'custom';
    els.supplyWrap.hidden = !cfg.supplyLever;
    $('tab-results').hidden = true;
    if (active === 'results') active = 'dashboard';
    announce('New game. ' + (game.shockMode === 'event' ? E.SHOCKS[event].headline + '.' : ''));
    renderSidebar();
    showTab(active);
    if (withCard) showEventCard();
  }

  // The event hits in round 1, before the teams have acted.
  function beginGame() {
    if (!game || game.round !== 0) return;
    PU.settings.lock(true);
    var out = game.step({});
    afterRoundOne();
    announce(roundSummary(out, true));
    renderSidebar();
    renderActive();
  }

  function playRound() {
    if (!game || game.isOver()) return;
    if (game.round === 0 && game.shockMode === 'event') { beginGame(); return; }
    if (game.round === 0) PU.settings.lock(true);
    var choice = {
      spending: els.spending.value, taxes: els.taxes.value,
      rate: els.rate.value, supply: els.supply.value, shock: els.shock.value
    };
    var before = {};
    SLOTS.forEach(function (s) { var h = game.universes[s].history; before[s] = h[h.length - 1]; });
    var out = game.step(choice);
    if (game.round === 1) afterRoundOne();
    gradePredictions(before, out);
    announce(roundSummary(out, false));
    resetLevers();
    renderSidebar();
    if (game.isOver()) {
      onGameOver();
      renderSidebar();
      $('tab-results').hidden = false;
      showTab('results');
    } else {
      renderActive();
    }
  }

  function roundSummary(out, eventRound) {
    var n = names(), rec = out.a;
    var bits = ['Round ' + rec.round + '.'];
    if (rec.shock !== 'none') bits.push((E.SHOCKS[rec.shock].headline || E.SHOCKS[rec.shock].label) + '.');
    SLOTS.forEach(function (s) {
      bits.push(n[s] + ': unemployment ' + pct(out[s].unemployment) + ', inflation ' + pct(out[s].inflation) +
        ', ' + starText(out[s].stars) + '.');
    });
    if (eventRound) bits.push('Now the teams advise.');
    return bits.join(' ');
  }

  function announce(t) { $('live').textContent = t; }

  // ---- Sidebar ----------------------------------------------------------------
  function renderSidebar() {
    var n = names();
    var ev = game.shockMode === 'event' ? E.SHOCKS[game.event]
      : (game.shockMode === 'scripted' ? { headline: 'Several shocks will hit during the game' } : { headline: 'You choose the shock each round' });
    $('event-line').textContent = (game.round === 0 && game.shockMode === 'event') ? 'Event: press Play to see what hits' : ev.headline;

    $('round-status').textContent = game.isOver()
      ? 'Game over'
      : (game.round === 0 ? 'Round 1 of ' + game.rounds : 'Round ' + (game.round + 1) + ' of ' + game.rounds);

    var sc = $('scores');
    sc.textContent = '';
    sc.hidden = !scoring.on;
    var sum = game.summary();
    if (scoring.on) SLOTS.forEach(function (s) {
      var row = el('div', { class: 'score-row', 'data-slot': s });
      row.appendChild(el('span', { class: 'score-name' }, n[s]));
      var started = game.round > 0;
      var rs = started ? (finals ? finals[s] : runningScores(s)) : null;
      var gained = rs && (finals ? rs.lossNone - rs.loss : rs.lossAvoided);
      var won = game.isOver() && rs ? gained > 1e-9 : null;
      var val = !started ? 'no score yet'
        : (game.isOver() ? (won ? 'WIN ' : 'LOSE ') : '') + (rs.vsNone == null ? welfareShort(sum[s]) : pctText(rs.vsNone));
      var cls = 'score-val' + (started && gained > 1e-9 ? ' won' : started && gained < -1e-9 ? ' lost' : '');
      var v1 = el('span', { class: cls, 'data-tip': 'vsNone' }, val);
      row.appendChild(v1);
      sc.appendChild(row);
      if (started && optimalOn()) {
        var row2 = el('div', { class: 'score-row score-sub', 'data-slot': s });
        row2.appendChild(el('span', { class: 'score-name' }, 'Of the achievable gain'));
        row2.appendChild(el('span', { class: 'score-val', 'data-tip': 'achievable' },
          benchPending || (!bench && game.shockMode !== 'custom') ? 'computing\u2026' : !bench ? 'at the end' : shareText(rs.achievable)));
        sc.appendChild(row2);
      }
      if (started) sc.appendChild(welfareBars(s, n[s]));
    });
    renderLimitNote(n);

    els.play.textContent = game.isOver() ? 'Game over'
      : (game.round === 0 && game.shockMode === 'event' ? 'Play: the event hits' : 'Play round ' + (game.round + 1));
    els.play.disabled = game.isOver();
    var levers = game.round > 0 && !game.isOver();
    [els.spending, els.taxes, els.rate, els.supply].forEach(function (l) { l.setDisabled(!levers && game.shockMode === 'event'); });
    if (game.autopilot.fiscal) { els.spending.setDisabled(true); els.taxes.setDisabled(true); }
    if (game.autopilot.monetary) els.rate.setDisabled(true);
    els.rate.redraw();
    $('open-settings').textContent = game.round > 0 && !game.isOver() ? 'Settings (locked)' : 'Settings';
    els.replay.hidden = game.round === 0;
    renderAutopilot(n);
    renderHints(n);
    var ps = $('predict-score');
    ps.hidden = !(config.predictions !== false && predictTally.total > 0);
    ps.textContent = 'Predictions right: ' + predictTally.right + ' of ' + predictTally.total;
    renderPredict(n);
    updateTiming();
  }

  // One short line on when this round's choices take effect; the details,
  // including anything already on the way, go in its tooltip.
  function updateTiming() {
    if (!game || game.isOver() || (game.round === 0 && game.shockMode === 'event')) { els.timing.textContent = ''; return; }
    var n = names(), now = game.round + 1, last = game.rounds;
    function when(lag) { var at = now + lag; return at > last ? 'after the game ends' : (at === now ? 'this round' : 'round ' + at); }
    var a = game.universes.a.settings, b = (game.universes.b || game.universes.a).settings;
    var same = a.fiscalLag === b.fiscalLag && a.monetaryLag === b.monetaryLag;
    els.timing.textContent = same
      ? 'Takes effect: fiscal ' + when(a.fiscalLag) + ', monetary ' + when(a.monetaryLag) + '.'
      : 'Takes effect at different times in each universe.';
    var lines = [];
    SLOTS.forEach(function (s) {
      var u = game.universes[s];
      lines.push(n[s] + ': fiscal policy chosen now takes effect ' + when(u.settings.fiscalLag) +
        ', monetary policy ' + when(u.settings.monetaryLag) + '.');
      u.pendingDemand.forEach(function (d) {
        lines.push(n[s] + ': already on the way, ' + (d.kind === 'monetary' ? 'monetary' : 'fiscal') + ' policy shifts AD ' +
          (d.shift > 0 ? 'right' : 'left') + ' in round ' + d.arrives + '.');
      });
    });
    lines.push(PU.tips.text('lagNote'));
    els.timing.removeAttribute('data-tip');
    els.timing.setAttribute('data-tip-text', lines.join(' '));
  }

  // ---- Welfare score wording ----------------------------------------------------
  // The share of the no-policy loss avoided, as a signed percent; when policy
  // more than doubled the loss, as a multiple; when doing nothing lost almost
  // nothing, as the change in loss points.
  function welfareShort(sum) {
    if (sum.lossNoPolicy == null) return '';
    if (sum.welfare == null) {
      var d = Math.round(sum.lossAvoided * 10) / 10;
      return (d > 0 ? '+' : d < 0 ? '\u2212' : '') + Math.abs(d).toFixed(1) + ' pts';
    }
    if (sum.welfare < -100) return 'losses \u00d7' + (sum.loss / sum.lossNoPolicy).toFixed(1);
    var w = Math.round(sum.welfare);
    return (w > 0 ? '+' : w < 0 ? '\u2212' : '') + Math.abs(w) + '%';
  }
  function welfareSentence(sum) {
    if (sum.welfare == null) {
      var d = Math.round(sum.lossAvoided * 10) / 10;
      return d > 0 ? 'Policy lowered the total loss by ' + d.toFixed(1) + ' points (doing nothing lost very little here).'
        : d < 0 ? 'Policy raised the total loss by ' + Math.abs(d).toFixed(1) + ' points (doing nothing lost very little here).'
          : 'Policy changed nothing compared with doing nothing.';
    }
    if (sum.welfare >= 0.5) return 'Policy cut the economy\'s losses by ' + Math.round(sum.welfare) + '% compared with doing nothing.';
    if (sum.welfare > -0.5) return 'Policy did no better than doing nothing.';
    if (sum.welfare < -100) return 'Policy made the economy\'s losses ' + (sum.loss / sum.lossNoPolicy).toFixed(1) + ' times as large as doing nothing.';
    return 'Policy made the economy\'s losses ' + Math.round(-sum.welfare) + '% larger than doing nothing.';
  }

  // ---- Optimal benchmark -----------------------------------------------------------
  // Right after round 1 the game is copied, and the optimal path for each
  // universe is computed from that copy a moment later (so the page never
  // freezes). In "I choose each round" mode the future shocks are not known, so
  // it is computed at the end, in hindsight. At the end, both scores are
  // computed with the tail rounds counted.
  var bench = null, benchPending = false, finals = null, snap1 = null;
  function optimalOpts(cfg) {
    var o = (cfg && cfg.optimal) || {};
    var out = {};
    ['discount', 'tuneCosts', 'costFiscal', 'costRate', 'tail'].forEach(function (k) { if (o[k] != null) out[k] = o[k]; });
    return out;
  }
  function optimalOn() { return !!PU.optimal && !(config.optimal && config.optimal.show === false); }
  function afterRoundOne() {
    if (!PU.optimal || game.round !== 1) return;
    snap1 = game.clone();
    if (game.shockMode !== 'custom') computeBench();
  }
  function computeBench(shocks) {
    if (!snap1 || !optimalOn()) return;
    var g = game, from = snap1;
    benchPending = true;
    renderSidebar();
    setTimeout(function () {
      if (g !== game) return;   // a new game started meanwhile
      var o = optimalOpts(config);
      if (shocks) o.shocks = shocks;
      var b = {};
      SLOTS.forEach(function (k) { b[k] = PU.optimal.benchmark(from, k, o); });
      bench = b; benchPending = false;
      if (game.isOver()) computeFinals();
      renderSidebar();
      renderActive();
    }, 30);
  }
  function computeFinals() {
    if (!bench) return;
    finals = {};
    var o = optimalOpts(config);
    SLOTS.forEach(function (k) { finals[k] = PU.optimal.finalScores(game, k, bench[k], o); });
  }
  function onGameOver() {
    if (!PU.optimal || !optimalOn()) return;
    if (game.shockMode === 'custom') {
      var shocks = {};
      game.universes[SLOTS[0]].history.forEach(function (r) { if (r.round > 1 && r.shock && r.shock !== 'none') shocks[r.round] = r.shock; });
      computeBench(shocks);
    } else if (bench) {
      computeFinals();
    }
  }
  // Scores so far (during a game), over the rounds played: vs doing nothing and,
  // once the optimal path is known, the share of the achievable gain.
  function runningScores(k) {
    var h = game.universes[k].history, np = game.noPolicy(k), Ly = 0, Ln = 0, Lo = 0;
    for (var i = 1; i < h.length; i++) {
      Ly += h[i].loss; if (np) Ln += np[i].loss;
      if (bench) Lo += bench[k].optimal.history[i].loss;
    }
    var MIN = E.WELFARE_MIN_LOSS;
    return {
      vsNone: np && Ln > MIN ? 100 * (Ln - Ly) / Ln : null,
      achievable: bench && Ln - Lo > MIN ? 100 * (Ln - Ly) / (Ln - Lo) : null,
      lossAvoided: Ln - Ly
    };
  }
  function pctText(v) { if (v == null) return 'n/a'; var w = Math.round(v); return (w > 0 ? '+' : w < 0 ? '\u2212' : '') + Math.abs(w) + '%'; }
  function shareText(v) { if (v == null) return 'n/a'; var w = Math.round(v); return (w < 0 ? '\u2212' : '') + Math.abs(w) + '%'; }

  // ---- Mission text (follows the scoring settings) ------------------------------
  var scoring = E.scoringOf();
  function zoneWords() {
    var z = scoring.zone;
    return 'unemployment ' + z.unemployment[0] + '% to ' + z.unemployment[1] + '%, inflation ' +
      z.inflation[0] + '% to ' + z.inflation[1] + '%';
  }
  function renderMissionText() {
    var line = document.querySelector('.mission-line');
    var card = document.querySelector('#event-dialog .event-mission');
    var teams = ' Team Fiscal advises on spending and taxes. Team Monetary advises on the interest rate.';
    if (!scoring.on) {
      line.textContent = 'Scoring is off: explore how the economy responds to the event and to your policy.';
      card.textContent = 'Scoring is off: explore how the economy responds.' + teams;
      return;
    }
    line.textContent = '';
    line.appendChild(document.createTextNode('Goal: beat doing nothing on the Fed\'s dual mandate. Keep unemployment near 5% and inflation near 2% (the '));
    line.appendChild(el('span', { class: 'zone-word', 'data-tip': 'greenZone' }, 'green zone'));
    line.appendChild(document.createTextNode(' is a guide).'));
    card.textContent = 'Your goal is the Federal Reserve\'s dual mandate: keep unemployment near 5% and inflation near 2%. ' +
      'The game scores your policy against doing nothing: each round\'s loss grows with the square of the misses, and you win if your policy loses less than no policy would have.' + teams;
  }

  // ---- Autopilot ----------------------------------------------------------------
  // One bar per round: up and green when policy beat doing nothing that round,
  // down and red when it did worse. The bars are a picture of the round log's
  // Welfare column; the text is in the aria-label.
  function welfareBars(s, name) {
    var track = game.welfareTrack(s);
    var max = 0;
    track.forEach(function (t) { max = Math.max(max, Math.abs(t.gain || 0)); });
    var box = el('div', { class: 'welfare-bars', role: 'img', 'data-tip': 'welfareBars' });
    var words = [];
    track.forEach(function (t) {
      var g = t.gain || 0, h = max > 0 ? Math.max(2, Math.round(18 * Math.abs(g) / max)) : 2;
      var bar = el('span', { class: 'wbar ' + (g > 1e-9 ? 'up' : g < -1e-9 ? 'down' : 'flat') });
      bar.style.height = h + 'px';
      box.appendChild(bar);
      words.push('round ' + t.round + ' ' + (g > 1e-9 ? 'better' : g < -1e-9 ? 'worse' : 'same'));
    });
    box.setAttribute('aria-label', name + ', welfare by round compared with no policy: ' + words.join(', ') + '.');
    return box;
  }

  function renderAutopilot(n) {
    var ap = { monetary: modeOf('monetary'), fiscal: modeOf('fiscal') };
    [['fiscal', els.fiscalAuto], ['monetary', els.monetaryAuto]].forEach(function (pair) {
      var btns = pair[1].querySelectorAll('button');
      for (var i = 0; i < btns.length; i++) {
        btns[i].setAttribute('aria-checked', btns[i].getAttribute('data-mode') === String(ap[pair[0]]) ? 'true' : 'false');
        btns[i].disabled = game.isOver();
      }
    });
    els.fiscalNote.hidden = !ap.fiscal;
    els.monetaryNote.hidden = !ap.monetary;
    if (ap.fiscal) {
      [els.spending, els.taxes].forEach(function (l) { l.setDisabled(true); });
      var bits = SLOTS.map(function (s) {
        var h = game.universes[s].history, r = h[h.length - 1];
        if (ap.fiscal === 'optimal') {
          var st = r.round > 0 ? (r.spending || 0) : 0;
          return n[s] + ': ' + (st === 0 ? 'no change' : 'spending ' + (st > 0 ? '+' : '\u2212') + Math.abs(st));
        }
        var v = Math.round(r.autoSpending || 0);
        return n[s] + ': ' + (v === 0 ? 'no change' : 'spending ' + (v > 0 ? '+' : '\u2212') + Math.abs(v));
      });
      els.fiscalNote.setAttribute('data-tip', ap.fiscal === 'optimal' ? 'autopilotOptimalFiscal' : 'autopilotFiscal');
      els.fiscalNote.textContent = 'Autopilot: ' + (ap.fiscal === 'optimal' ? 'optimal rule' : 'balanced budget') + '. Last round ' + bits.join('; ') + '.';
    }
    var showReal = !!config.showRealRate && game.round > 0;
    if (!ap.monetary && showReal) {
      els.monetaryNote.hidden = false;
      els.monetaryNote.setAttribute('data-tip', 'realRate');
      els.monetaryNote.textContent = 'Real interest rate now: ' + SLOTS.map(function (s) {
        var h = game.universes[s].history; return (SLOTS.length > 1 ? n[s] + ' ' : '') + h[h.length - 1].realRate.toFixed(2) + '%';
      }).join(', ') + ' (neutral is 1%).';
    }
    if (ap.monetary) {
      els.monetaryNote.setAttribute('data-tip', ap.monetary === 'optimal' ? 'autopilotOptimalMonetary' : 'autopilotMonetary');
      els.rate.setDisabled(true);
      els.monetaryNote.textContent = 'Autopilot: ' + (ap.monetary === 'optimal' ? 'optimal rule' : 'Taylor rule') + '. Rate now ' + SLOTS.map(function (s) {
        var h = game.universes[s].history;
        return (SLOTS.length > 1 ? n[s] + ' ' : '') + game.universes[s].rate.toFixed(2) + '%' +
          (showReal ? ' (real ' + h[h.length - 1].realRate.toFixed(2) + '%)' : '');
      }).join(', ') + '.';
    }
  }

  // ---- Limit warning -----------------------------------------------------------
  // AD and SRAS are held within limits so the curves stay meaningful. If a path
  // is pushed past one, the curve stops there and the economy freezes off
  // target; say so rather than let the numbers pass as economics.
  function renderLimitNote(n) {
    var lines = [];
    function cap(t) { return t.charAt(0).toUpperCase() + t.slice(1); }
    function first(h) { for (var i = 1; i < (h ? h.length : 0); i++) if (h[i].atLimit) return i; return 0; }
    SLOTS.forEach(function (s) {
      var who = SLOTS.length > 1 ? n[s] + ': ' : '';
      var r = first(game.universes[s].history), rn = first(game.noPolicy(s));
      if (r) lines.push(cap(who + 'from round ' + r + ' the economy is beyond what this model can show, so its numbers from then on are not reliable.'));
      if (rn) lines.push(cap(who + 'with no policy the economy goes beyond what this model can show from round ' + rn + ', so the comparison with doing nothing is not reliable.'));
    });
    var p = $('limit-note');
    p.textContent = lines.join(' ');
    p.hidden = !lines.length;
  }

  // ---- Optimal move hint ----------------------------------------------------------
  // With the option on, before each round each team panel shows what the
  // optimal rule would do from where the economy is now. A team on autopilot
  // shows its own rule instead, so its hint is hidden.
  function renderHints(n) {
    var on = !!(PU.optimal && config.optimal && config.optimal.hint) && game.round > 0 && !game.isOver();
    var ap = { monetary: modeOf('monetary'), fiscal: modeOf('fiscal') };
    els.fiscalHint.hidden = !on || !!ap.fiscal;
    els.monetaryHint.hidden = !on || !!ap.monetary;
    if (!on) return;
    var t = game.round + 1, f = [], m = [];
    SLOTS.forEach(function (k) {
      var u = game.universes[k];
      var rule = PU.optimal.cachedRule(u.settings, t, game.scoring, optimalOpts(config));
      var c = PU.optimal.ruleChoice(rule, u, t);
      var who = SLOTS.length > 1 ? n[k] + ': ' : '';
      f.push(who + (c.spending === 0 ? 'no change' : 'spending ' + (c.spending > 0 ? '+' : '\u2212') + Math.abs(c.spending)));
      var to = Math.max(0, Math.min(E.RATE_MAX, u.rate + c.rate));
      m.push(who + (c.rate === 0 ? 'hold at ' + u.rate.toFixed(2) + '%'
        : (c.rate < 0 ? 'cut ' : 'raise ') + Math.abs(c.rate).toFixed(2) + ' to ' + to.toFixed(2) + '%'));
    });
    els.fiscalHint.textContent = 'Optimal rule this round: ' + f.join('; ') + '.';
    els.monetaryHint.textContent = 'Optimal rule this round: ' + m.join('; ') + '.';
  }

  // ---- Predictions --------------------------------------------------------------
  // Before each round the class predicts, for each universe, whether
  // unemployment and inflation will rise, stay about the same, or fall.
  var predictTally = { right: 0, total: 0 };
  var predictions = {};   // 'a-unemployment' -> 'up' | 'same' | 'down'
  var MEASURES = [['unemployment', 'Unemployment'], ['inflation', 'Inflation']];
  var CHOICES = [['up', '\u25B2 Rise', 'predictUp'], ['same', '\u25CF Same', 'predictSame'], ['down', '\u25BC Fall', 'predictDown']];

  function clearPredictions() { predictions = {}; }

  function renderPredict(n) {
    var box = $('predict');
    var on = config.predictions !== false && game.round > 0 && !game.isOver();
    box.hidden = !on;
    if (!on) return;
    var grid = $('predict-grid');
    grid.textContent = '';
    SLOTS.forEach(function (s) {
      var col = el('div', { class: 'predict-col', 'data-slot': s });
      col.appendChild(el('h3', { class: 'predict-name' }, n[s]));
      MEASURES.forEach(function (m) {
        var row = el('div', { class: 'predict-row', role: 'group', 'aria-label': n[s] + ', ' + m[1] });
        row.appendChild(el('span', { class: 'predict-label', 'data-tip': m[0] }, m[1]));
        var btns = el('div', { class: 'predict-btns' });
        CHOICES.forEach(function (c) {
          var key = s + '-' + m[0];
          var b = el('button', { type: 'button', class: 'predict-btn', 'aria-pressed': predictions[key] === c[0] ? 'true' : 'false', 'data-tip': c[2] }, c[1]);
          b.setAttribute('data-choice', c[0]);
          // Update this row in place, so keyboard focus stays on the button.
          b.addEventListener('click', function () {
            predictions[key] = predictions[key] === c[0] ? undefined : c[0];
            var sib = btns.querySelectorAll('.predict-btn');
            for (var j = 0; j < sib.length; j++) {
              sib[j].setAttribute('aria-pressed', sib[j].getAttribute('data-choice') === predictions[key] ? 'true' : 'false');
            }
          });
          btns.appendChild(b);
        });
        row.appendChild(btns);
        col.appendChild(row);
      });
      grid.appendChild(col);
    });
  }

  function gradePredictions(before, out) {
    if (config.predictions === false) return;
    var right = 0, total = 0, notes = [];
    var n = names();
    SLOTS.forEach(function (s) {
      MEASURES.forEach(function (m) {
        var guess = predictions[s + '-' + m[0]];
        if (!guess) return;
        var actual = E.direction(before[s][m[0]], out[s][m[0]]);
        total += 1;
        if (guess === actual) right += 1;
        notes.push((guess === actual ? '\u2713 ' : '\u2717 ') + n[s] + ' ' + m[1].toLowerCase() + ' ' +
          (actual === 'up' ? 'rose' : actual === 'down' ? 'fell' : 'stayed about the same'));
      });
    });
    predictTally.right += right;
    predictTally.total += total;
    $('predict-result').textContent = total
      ? 'Round ' + out.a.round + ': ' + right + ' of ' + total + ' predictions right. ' + notes.join('. ') + '.'
      : '';
    clearPredictions();
  }

  // ---- Views ------------------------------------------------------------------
  function viewOpts(extra) {
    var optv = null;
    if (bench && optimalOn()) { optv = {}; SLOTS.forEach(function (k) { optv[k] = { history: bench[k].optimal.history, plan: bench[k].optimal.plan }; }); }
    var o = { names: names(), colors: colors(), zone: scoring.zone, scoringOff: !scoring.on, showRealRate: !!config.showRealRate, optimal: optv };
    for (var k in extra) o[k] = extra[k];
    return o;
  }

  function renderActive() {
    if (!game) return;
    var n = names(), c = colors();
    var o = { names: n, colors: c };
    if (active === 'dashboard') {
      SLOTS.forEach(function (s) {
        var u = game.universes[s];
        var h = u.history;
        var rec = h[h.length - 1];
        var heading = $('name-' + s);
        heading.textContent = '';
        heading.appendChild(document.createTextNode(n[s]));
        if (scoring.on && game.round > 0) heading.appendChild(el('span', { class: 'score', 'data-tip': 'stars' }, 'Welfare: ' + welfareShort(game.summary()[s])));
        var np = game.round > 0 ? game.noPolicy(s)[h.length - 1] : null;
        var opt = bench && optimalOn() && game.round > 0 ? bench[s].optimal.history[h.length - 1] : null;
        PU.gauges.render($('gauges-' + s), rec, { name: n[s], color: c[s], slot: s, prev: h.length > 1 ? h[h.length - 2] : null, noPolicy: np,
          zone: scoring.zone, scoringOff: !scoring.on, optimal: opt });
        PU.adas.render($('adas-' + s), u, { name: n[s], color: c[s], slot: s, noPolicy: np, optimal: opt });
        PU.charts.renderMini($('mini-' + s), game, s, { names: n });
      });
    } else if (active === 'time') {
      PU.charts.render($('charts'), game, viewOpts({ only: 'series' }));
    } else if (active === 'phillips') {
      PU.charts.render($('phillips'), game, viewOpts({ only: 'phillips' }));
    } else if (active === 'log') {
      PU.log.render($('log'), game, viewOpts({}));
    } else if (active === 'results') {
      renderResults();
    }
  }

  function renderResults() {
    var host = $('end');
    host.textContent = '';
    var s = game.summary(), n = names();
    host.appendChild(el('h2', null, 'Final results'));
    var cards = el('div', { class: 'result-cards' });
    SLOTS.forEach(function (k) {
      var last = game.universes[k].history[game.universes[k].history.length - 1];
      var card = el('div', { class: 'result-card ' + (s[k].won === null ? '' : s[k].won ? 'won' : 'lost'), 'data-slot': k });
      card.appendChild(el('h3', null, n[k]));
      if (s[k].won === null) {
        card.appendChild(el('p', { class: 'verdict' }, 'Final round'));
        card.appendChild(el('p', { class: 'why' }, 'Unemployment ' + pct(last.unemployment) + ', inflation ' + pct(last.inflation) + '.'));
      } else {
        // Final scores count the tail rounds when the optimal benchmark is on.
        var f = finals && finals[k];
        var fs = f ? { welfare: f.vsNone, loss: f.loss, lossNoPolicy: f.lossNone, lossAvoided: f.lossNone - f.loss } : s[k];
        var won = f ? f.loss < f.lossNone - 1e-9 : s[k].won;
        card.className = 'result-card ' + (won ? 'won' : 'lost');
        card.appendChild(el('p', { class: 'verdict' }, won ? 'Policy beat doing nothing' : 'Doing nothing would have been as good or better'));
        card.appendChild(el('p', { class: 'why' }, welfareSentence(fs)));
        card.appendChild(el('p', { class: 'stars-line', 'data-tip': 'vsNone' }, 'Compared with doing nothing: ' + welfareShort(fs)));
        if (f && f.achievable != null) {
          card.appendChild(el('p', { class: 'stars-line', 'data-tip': 'achievable' }, 'Share of the achievable gain: ' + shareText(f.achievable)));
        } else if (optimalOn() && !f) {
          card.appendChild(el('p', { class: 'stars-line' }, 'Share of the achievable gain: computing\u2026'));
        }
      }
      var dl = el('dl');
      var rows = [];
      var ff = finals && finals[k];
      if (ff) {
        rows.push(['Total loss, your policy', ff.loss.toFixed(1)]);
        rows.push(['Total loss, no policy', ff.lossNone.toFixed(1)]);
        rows.push(['Total loss, optimal path', ff.lossOptimal.toFixed(1)]);
      } else if (s[k].lossNoPolicy != null) {
        rows.push(['Total loss with your policy', s[k].loss.toFixed(1)]);
        rows.push(['Total loss with no policy', s[k].lossNoPolicy.toFixed(1)]);
      }
      rows.push(['Peak unemployment', pct(s[k].peakUnemployment)], ['Peak inflation', pct(s[k].peakInflation)]);
      rows.push(['Ended in the green zone', s[k].inZoneAtEnd ? 'Yes' : 'No']);
      rows.forEach(function (r) {
        dl.appendChild(el('dt', null, r[0]));
        dl.appendChild(el('dd', null, r[1]));
      });
      card.appendChild(dl);
      cards.appendChild(card);
    });
    host.appendChild(cards);
    if (finals) host.appendChild(el('p', { class: 'help', 'data-tip': 'tailRounds' }, 'Scores count the game plus ' +
      (optimalOpts(config).tail != null ? optimalOpts(config).tail : PU.optimal.DEFAULTS.tail) +
      ' rounds after it with no new policy. The optimal path assumes perfect foresight.'));
    host.appendChild(el('p', { class: 'discuss' }, SLOTS.length < 2
      ? 'Compare your path with the no-policy path on the Over time tab. Did your policy help, or would the economy have recovered on its own? Would another school of thought (Settings, presets) have responded the same way?'
      : s.a.won === s.b.won && Math.abs((s.a.welfare || 0) - (s.b.welfare || 0)) < 5
        ? 'The same choices scored about the same in both universes. Was that luck, or did the rules not matter for this event?'
        : 'The same event and the same choices gave different results. Which rule made the difference: how fast wages and prices adjust, the multiplier, whether people saw the policy coming, or how credible the central bank is?'));
    var endActions = el('div', { class: 'event-actions' });
    var replay = el('button', { type: 'button', class: 'primary-btn', 'data-tip': 'replay' }, 'Replay this event');
    replay.addEventListener('click', replayGame);
    var again = el('button', { type: 'button', class: 'secondary-btn', 'data-tip': 'newGame' }, 'New game');
    again.addEventListener('click', function () { newGame(PU.settings.get(), true); });
    endActions.appendChild(replay);
    endActions.appendChild(again);
    host.appendChild(endActions);
  }

  function missed(h) {
    var r = h[h.length - 1], out = [];
    if (!r.inZone.unemployment) out.push('unemployment was ' + pct(r.unemployment));
    if (!r.inZone.inflation) out.push('inflation was ' + pct(r.inflation));
    return out.join(' and ') + ', outside the green zone';
  }

  // Play the same event again with the same settings; the event card opens.
  function replayGame() {
    if (!game) return;
    var ev = game.shockMode === 'event' ? game.event : null;
    newGame(PU.settings.get(), true, ev);
  }

  function startTour() { if (PU.tour) { showTab('dashboard'); PU.tour.start(); } }

  function init() {
    buildTheme();
    buildControls();
    buildTabs();
    buildDialogs();
    PU.settings.mount($('settings'), {
      onChange: function (cfg) {
        // Before the event hits, a settings change starts the game over with the new settings.
        if (!game || game.round === 0) newGame(cfg, false);
      }
    });
    newGame(PU.settings.get(), true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
