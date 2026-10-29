/*
 * Macro Control Room: the guided tour of the game (not the settings).
 *
 * PU.tour.start() walks through the screen one part at a time: it lights up
 * the part, dims the rest, and explains it in a card with Back, Next and End.
 * Steps whose part is hidden (predictions off, for example) are skipped.
 * Keyboard: Right or Enter for next, Left for back, Escape to end.
 */
(function (root) {
  'use strict';
  var PU = root.PU = root.PU || {};

  var STEPS = [
    { sel: null, title: 'Welcome to Macro Control Room',
      text: 'An economy gets hit by an event, and your class sets policy to steer it back. The economy follows the rules of one school of thought (Keynesian, neoclassical, New Keynesian, Monetarist), chosen in Settings, where you can also run two side by side. This tour shows you every part of the screen. It takes about two minutes.' },
    { sel: '#event-line', title: 'The event',
      text: 'This is what hit both economies in round 1. Everything you do afterward is a response to it.' },
    { sel: '.mission-line', title: 'Your goal',
      text: 'Get unemployment (4.5% to 5.5%) and inflation (1% to 3%) into the green zone, and keep them there until the last round.' },
    { sel: '#scores', title: 'Stars and winning',
      text: 'Each round earns up to 2 stars per universe: one for unemployment in the green zone, one for inflation. You win a universe if both are in the green zone in the final round.' },
    { sel: '#universe-a', title: 'Your economy',
      text: 'By default this is a Keynesian economy: wages and prices are sticky, spending has a multiplier, people do not see policy coming, and they expect last round\'s inflation to continue. Here the economy is slow to fix itself.' },
    { sel: '#gauges-a', title: 'The gauges',
      text: 'Unemployment and inflation right now. The green band on each dial is the green zone. The dashed needle and the "No policy" line show where the economy would be if nobody had done anything.' },
    { sel: '#adas-a', title: 'The AD/AS model',
      text: 'The price level is up the side and real GDP across. The big dot is where AD and SRAS cross now. Dashed curves show last round, so you can see what shifted. LRAS marks potential GDP, and the ring shows where the economy would be with no policy.' },
    { sel: '#universe-b', title: 'The second universe',
      text: 'By default this is the neoclassical universe: wages and prices are flexible, and people expect policy, so policy mostly changes prices. Same event, same choices: watch how differently it responds.' },
    { sel: '#predict', title: 'Predict first',
      text: 'Before you play a round, predict for each universe whether unemployment and inflation will rise, stay about the same, or fall. After the round you see how many you got right.' },
    { sel: '.team-fiscal', title: 'Team Fiscal',
      text: 'Government spending and taxes. Press + or - to set the change; the box in the middle shows what it will do, for example "AD shifts right". More spending or a tax cut pushes AD right.' },
    { sel: '.team-monetary', title: 'Team Monetary',
      text: 'The interest rate, in steps of 25 basis points. A cut makes borrowing cheaper and pushes AD right; a rise pulls it left. The rate cannot go below 0%.' },
    { sel: '#controls .timing', title: 'Policy takes time',
      text: 'Policy does not work at once. It starts after a lag and builds over two rounds. Hover here to see when this round\'s choices take effect and what is already on the way.' },
    { sel: '#controls .actions', title: 'Play the round',
      text: 'When both teams have set their levers, press Play. The levers reset to no change for the next round.' },
    { sel: '.tabs', title: 'More views',
      text: 'Over time shows each measure round by round, with the no-policy path dashed. Phillips curve plots inflation against unemployment. Round log lists every choice and result. Results opens at the end.' },
    { sel: '#tips-toggle', title: 'Explanations',
      text: 'Hover over almost anything (or tap it on a phone) for an explanation. Turn the explanations off here. Press Tutorial to see this tour again.' }
  ];

  var i = 0, layer = null, ring = null, card = null, lastFocus = null;

  function visible(el) {
    if (!el) return false;
    for (var a = el; a && a.nodeType === 1; a = a.parentElement) if (a.hidden) return false;
    var r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }
  function stepOk(k) { return !STEPS[k].sel || visible(document.querySelector(STEPS[k].sel)); }

  function build() {
    layer = document.createElement('div');
    layer.className = 'tour-layer';
    ring = document.createElement('div');
    ring.className = 'tour-ring';
    card = document.createElement('div');
    card.className = 'tour-card';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    card.setAttribute('aria-labelledby', 'tour-title');
    card.innerHTML = '<p class="tour-count" id="tour-count"></p><h2 id="tour-title"></h2><p id="tour-text"></p>' +
      '<div class="tour-actions"><button type="button" class="secondary-btn" data-act="back">Back</button>' +
      '<button type="button" class="primary-btn" data-act="next">Next</button>' +
      '<button type="button" class="tour-end" data-act="end">End tour</button></div>';
    layer.appendChild(ring);
    layer.appendChild(card);
    document.body.appendChild(layer);
    card.addEventListener('click', function (ev) {
      var act = ev.target.getAttribute && ev.target.getAttribute('data-act');
      if (act === 'next') go(1);
      else if (act === 'back') go(-1);
      else if (act === 'end') end();
    });
    document.addEventListener('keydown', onKey);
    root.addEventListener('resize', place);
  }

  function onKey(ev) {
    if (!layer || layer.hidden) return;
    if (ev.key === 'Escape') { ev.preventDefault(); end(); }
    else if (ev.key === 'ArrowRight') { ev.preventDefault(); go(1); }
    else if (ev.key === 'ArrowLeft') { ev.preventDefault(); go(-1); }
  }

  function go(d) {
    var k = i + d;
    while (k >= 0 && k < STEPS.length && !stepOk(k)) k += d;
    if (k >= STEPS.length) { end(); return; }
    if (k < 0) return;
    i = k;
    show();
  }

  function show() {
    var s = STEPS[i];
    var shown = STEPS.filter(function (x, k) { return stepOk(k); });
    var pos = STEPS.slice(0, i + 1).filter(function (x, k) { return stepOk(k); }).length;
    card.querySelector('#tour-count').textContent = 'Step ' + pos + ' of ' + shown.length;
    card.querySelector('#tour-title').textContent = s.title;
    card.querySelector('#tour-text').textContent = s.text;
    card.querySelector('[data-act="back"]').disabled = pos === 1;
    card.querySelector('[data-act="next"]').textContent = pos === shown.length ? 'Finish' : 'Next';
    var target = s.sel ? document.querySelector(s.sel) : null;
    if (target && target.scrollIntoView) target.scrollIntoView({ block: 'center', inline: 'nearest' });
    place();
    card.querySelector('[data-act="next"]').focus();
  }

  function place() {
    if (!layer || layer.hidden) return;
    var s = STEPS[i];
    var target = s.sel ? document.querySelector(s.sel) : null;
    var vw = document.documentElement.clientWidth, vh = document.documentElement.clientHeight;
    if (!target) {
      ring.style.display = 'none';
      layer.classList.add('tour-dim');
      card.style.left = Math.max(16, (vw - card.offsetWidth) / 2) + 'px';
      card.style.top = Math.max(16, Math.min(120, (vh - card.offsetHeight) / 2)) + 'px';
      return;
    }
    layer.classList.remove('tour-dim');
    var r = target.getBoundingClientRect();
    var pad = 6;
    ring.style.display = 'block';
    ring.style.left = (r.left - pad) + 'px';
    ring.style.top = (r.top - pad) + 'px';
    ring.style.width = (r.width + 2 * pad) + 'px';
    ring.style.height = (r.height + 2 * pad) + 'px';
    var cw = card.offsetWidth, ch = card.offsetHeight;
    // Beside the part if there is room, otherwise below or above it.
    var x, y;
    if (r.right + 16 + cw < vw) { x = r.right + 16; y = r.top; }
    else if (r.left - 16 - cw > 0) { x = r.left - 16 - cw; y = r.top; }
    else { x = r.left; y = r.bottom + 16 + ch < vh ? r.bottom + 16 : r.top - 16 - ch; }
    card.style.left = Math.max(8, Math.min(x, vw - cw - 8)) + 'px';
    card.style.top = Math.max(8, Math.min(y, vh - ch - 8)) + 'px';
  }

  function start() {
    if (!layer) build();
    lastFocus = document.activeElement;
    if (PU.tips && PU.tips.hide) PU.tips.hide();
    layer.hidden = false;
    i = 0;
    show();
    try { root.localStorage.setItem('pu-toured', '1'); } catch (e) { /* fine */ }
  }

  function end() {
    if (!layer) return;
    layer.hidden = true;
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  PU.tour = { start: start, end: end, steps: STEPS };
})(window);
