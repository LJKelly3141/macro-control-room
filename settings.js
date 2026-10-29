/*
 * Macro Control Room: settings panel (lives inside the settings dialog).
 * PU.settings.mount(el, {onChange}), PU.settings.get(), PU.settings.lock(bool).
 * The config is mirrored into the page's query string so a link reopens it.
 *
 * get() returns
 *   { rounds, shockMode: 'event'|'scripted'|'custom', event: 'random' | EVENTS key,
 *     supplyLever, universeCount: 1 | 2,
 *     autopilot: {monetary: false | 'taylor' | 'optimal', fiscal: false | 'balanced' | 'optimal'},
 *     predictions, showRealRate, scoring: {on, uBand, piBand, wU, wPi},
 *     optimal: {show, hint, discount, costFiscal, costRate, tail},
 *     universes: { a: {name, preset, lambda, multiplier, expected, credibility,
 *     rateSensitivity, fiscalLag, monetaryLag, lambdaLate, switchRound}, b: {...} } }
 * event 'random' is left for the caller to resolve to an EVENTS key when a game starts.
 * universes.b is always present; with universeCount 1 its block is hidden and the
 * caller shows only universe A.
 *
 * URL keys: r (rounds), m (e/s/c), ev (random or event key), sl (1/0), u (1/2 universes),
 * apm / apf (monetary / fiscal autopilot: 0 off, 1 Taylor rule / balanced budget, 2 optimal rule),
 * pr (predictions, 1/0), rr (real rate, 1/0),
 * sc (scoring 1/0), zu / zi (zone half-widths), wu / wp (star weights),
 * os (show the optimal path, 1/0), od (discount), ocf (cost of a fiscal step),
 * ocr (cost of a rate move), ot (tail rounds), and per slot
 * a_p (preset k/n/nk/mo/w), a_n (name), a_l, a_m, a_e, a_c (credibility),
 * a_rs (rate sensitivity), a_fl, a_ml, a_ll, a_sr.
 * Old links: a_g (the single lag) sets both lags; a_i (inertia) sets credibility = 1 - a_i.
 */
(function (root) {
  'use strict';
  root.PU = root.PU || {};
  var engine = root.PU.engine;
  var PRESETS = engine.PRESETS;
  var RANGES = engine.RANGES;
  var SHOCKS = engine.SHOCKS;
  var EVENTS = engine.EVENTS;

  function tip(node, key) {
    if (root.PU.tips && root.PU.tips.attach) root.PU.tips.attach(node, key);
    else node.setAttribute('data-tip', key);
    return node;
  }
  // Explanations not yet in tips.js (listed in the report so they can move there).
  function tipText(node, text) {
    node.setAttribute('data-tip-text', text);
    return node;
  }

  var SLOTS = ['a', 'b'];
  var DEFAULT_PRESET = { a: 'keynesian', b: 'neoclassical' };
  var PRESET_KEYS = ['keynesian', 'neoclassical', 'newkeynesian', 'monetarist', 'realworld'];
  // Compact URL codes.
  var PRESET_CODE = { keynesian: 'k', neoclassical: 'n', newkeynesian: 'nk', monetarist: 'mo', realworld: 'w' };
  var CODE_PRESET = { k: 'keynesian', n: 'neoclassical', nk: 'newkeynesian', mo: 'monetarist', w: 'realworld' };
  var MODE_CODE = { event: 'e', scripted: 's', custom: 'c' };
  var CODE_MODE = { e: 'event', s: 'scripted', c: 'custom' };
  var URL_FIELDS = {
    lambda: 'l', multiplier: 'm', expected: 'e', credibility: 'c', rateSensitivity: 'rs',
    fiscalLag: 'fl', monetaryLag: 'ml', lambdaLate: 'll', switchRound: 'sr'
  };
  var MAIN_KEYS = ['lambda', 'multiplier', 'expected', 'credibility', 'rateSensitivity', 'fiscalLag', 'monetaryLag'];
  // Scoring: state key -> [URL key, RANGES key].
  var SCORE_FIELDS = {
    uBand: ['zu', 'zoneUnemployment'], piBand: ['zi', 'zoneInflation'],
    wU: ['wu', 'weight'], wPi: ['wp', 'weight']
  };
  // Optimal rule options (optimal.js DEFAULTS when loaded). State key -> URL key.
  var OPT_RANGES = {
    discount: { min: 0.8, max: 0.99, step: 0.01 },
    costFiscal: { min: 0, max: 0.5, step: 0.01 },
    costRate: { min: 0, max: 2, step: 0.05 },
    tail: { min: 0, max: 8, step: 1 }
  };
  var OPT_URL = { discount: 'od', costFiscal: 'ocf', costRate: 'ocr', tail: 'ot' };
  var OPT_KEYS = ['discount', 'costFiscal', 'costRate', 'tail'];
  var OPT_FIELDS = [
    { key: 'discount', label: 'Discount factor', tip: 'discount' },
    { key: 'costFiscal', label: 'Cost of a fiscal step', tip: 'costFiscal' },
    { key: 'costRate', label: 'Cost of a rate move', tip: 'costRate' },
    { key: 'tail', label: 'Tail rounds after the game', tip: 'tailRounds' }
  ];
  function optDefaults() {
    var d = (root.PU.optimal && root.PU.optimal.DEFAULTS) || {};
    var out = { discount: 0.95, costFiscal: 0.05, costRate: 0.8, tail: 4 };
    OPT_KEYS.forEach(function (k) {
      var v = clean(k, d[k]);
      if (v !== null) out[k] = v;
    });
    return out;
  }
  // Autopilot choices per team: [value, label, tip key]. URL code is the index.
  var AP_MODES = {
    monetary: [[false, 'Off', 'autopilotMode'], ['taylor', 'Taylor rule', 'autopilotMonetary'],
      ['optimal', 'Optimal rule', 'autopilotOptimalMonetary']],
    fiscal: [[false, 'Off', 'autopilotMode'], ['balanced', 'Balanced budget', 'autopilotFiscal'],
      ['optimal', 'Optimal rule', 'autopilotOptimalFiscal']]
  };
  var AP_PLAIN = { monetary: 'taylor', fiscal: 'balanced' };
  // true (old code) means the plain rule; anything unknown means off.
  function apNorm(kind, v) {
    if (v === true || v === 1 || v === AP_PLAIN[kind]) return AP_PLAIN[kind];
    if (v === 'optimal' || v === 2) return 'optimal';
    return false;
  }
  // URL code: 0/false off, 1/true plain rule, 2 optimal. Anything else: null (ignored).
  function apFromUrl(kind, v) {
    if (v === '0' || v === 'false') return false;
    if (v === '1' || v === 'true') return AP_PLAIN[kind];
    if (v === '2') return 'optimal';
    return null;
  }
  function apCode(v) { return v === 'optimal' ? '2' : (v ? '1' : '0'); }
  var NAME_MAX = 40;
  var DEFAULT_ROUNDS = 12;

  // The main view stays short; the rest sits under "Advanced".
  var FIELDS = [
    { key: 'lambda', label: 'How fast wages and prices adjust' },
    { key: 'multiplier', label: 'Spending multiplier' },
    { key: 'expected', label: 'Share of policy people expect' },
    { key: 'credibility', label: 'Central bank credibility' }
  ];
  var ADV_FIELDS = [
    { key: 'rateSensitivity', label: 'Spending response to the real rate' },
    { key: 'fiscalLag', label: 'Fiscal policy lag (rounds)' },
    { key: 'monetaryLag', label: 'Monetary policy lag (rounds)' }
  ];
  var LATE_FIELDS = [
    { key: 'lambdaLate', label: 'Adjustment speed later' },
    { key: 'switchRound', label: 'Switches in round' }
  ];
  var MODES = [
    ['event', 'One event at the start'],
    ['scripted', 'Several shocks during the game'],
    ['custom', 'I choose each round']
  ];
  var COUNTS = [[1, 'One'], [2, 'Two, side by side']];

  // ---------- helpers ----------

  function decimals(step) {
    var s = String(step);
    var i = s.indexOf('.');
    return i < 0 ? 0 : s.length - i - 1;
  }

  // Clamp to the range and snap to its step. Returns null for junk.
  function rangeOf(key) { return RANGES[key] || OPT_RANGES[key]; }

  function clean(key, raw) {
    var r = rangeOf(key);
    if (raw === null || raw === undefined || raw === '') return null;
    var v = typeof raw === 'number' ? raw : Number(String(raw).trim());
    if (!isFinite(v)) return null;
    v = Math.min(r.max, Math.max(r.min, v));
    v = r.min + Math.round((v - r.min) / r.step) * r.step;
    v = Math.min(r.max, Math.max(r.min, v));
    return Number(v.toFixed(decimals(r.step)));
  }

  // URL on/off flags: 1/true or 0/false. Anything else is ignored (null).
  function flag(v) {
    if (v === '1' || v === 'true') return true;
    if (v === '0' || v === 'false') return false;
    return null;
  }

  function validEvent(v) {
    if (v === 'random') return v;
    return EVENTS.indexOf(v) >= 0 ? v : null;
  }

  function lambdaWord(v) {
    if (v <= 0.001) return 'stuck';
    if (v < 0.35) return 'sticky';
    if (v < 0.75) return 'in between';
    return 'flexible';
  }

  function rsWord(v) {
    if (v < 100) return 'weak';
    if (v < 200) return 'medium';
    return 'strong';
  }

  function pts(v) { return v + (v === 1 ? ' point' : ' points'); }
  function pct(v) { return Number(v.toFixed(2)) + '%'; }

  // dispKey names what the value means (uBand, wU, ...); for universe fields it is the field key.
  function display(dispKey, v) {
    if (v === null || v === undefined) return '';
    var nat = engine.NATURAL_RATE, tgt = engine.INFLATION_TARGET;
    switch (dispKey) {
      case 'lambda': case 'lambdaLate': return v.toFixed(2) + ' (' + lambdaWord(v) + ')';
      case 'multiplier': return v.toFixed(1);
      case 'expected': return Math.round(v * 100) + '%';
      case 'credibility': return Math.round(v * 100) + '%';
      case 'rateSensitivity': return v + ' (' + rsWord(v) + ')';
      case 'fiscalLag': case 'monetaryLag': return v + (v === 1 ? ' round' : ' rounds');
      case 'switchRound': return 'Round ' + v;
      case 'uBand': return pts(v) + ' (' + pct(nat - v) + ' to ' + pct(nat + v) + ')';
      case 'piBand': return pts(v) + ' (' + pct(tgt - v) + ' to ' + pct(tgt + v) + ')';
      case 'wU': case 'wPi': return v === 0 ? '0 (ignored)' : (v === 1 ? '1 (equal)' : v + ' (double)');
      case 'discount': case 'costFiscal': case 'costRate': return v.toFixed(2);
      case 'tail': return v + (v === 1 ? ' round' : ' rounds');
      default: return String(v);
    }
  }

  function defaultName(preset) { return PRESETS[preset].label + ' universe'; }

  function presetValues(preset) {
    var p = PRESETS[preset];
    return {
      lambda: p.lambda, multiplier: p.multiplier, expected: p.expected,
      credibility: engine.credibilityOf(p),
      rateSensitivity: p.rateSensitivity != null ? p.rateSensitivity : engine.BETA,
      fiscalLag: p.fiscalLag, monetaryLag: p.monetaryLag,
      late: p.lambdaLate != null && p.switchRound != null,
      lambdaLate: p.lambdaLate != null ? p.lambdaLate : PRESETS.realworld.lambdaLate,
      switchRound: p.switchRound != null ? p.switchRound : PRESETS.realworld.switchRound
    };
  }

  function freshUniverse(slot) {
    var preset = DEFAULT_PRESET[slot];
    var u = presetValues(preset);
    u.preset = preset;
    u.name = '';
    return u;
  }

  function freshScoring() {
    var d = engine.scoringOf();
    return { on: d.on, uBand: d.uBand, piBand: d.piBand, wU: d.wU, wPi: d.wPi };
  }

  function freshOptimal() {
    var d = optDefaults();
    return { show: true, hint: false, discount: d.discount, costFiscal: d.costFiscal, costRate: d.costRate, tail: d.tail };
  }

  function optimalChanged() {
    var d = optDefaults();
    for (var i = 0; i < OPT_KEYS.length; i++) if (state.optimal[OPT_KEYS[i]] !== d[OPT_KEYS[i]]) return true;
    return false;
  }

  function freshState() {
    return {
      rounds: DEFAULT_ROUNDS,
      shockMode: 'event',
      event: 'random',
      supplyLever: false,
      universeCount: 1,
      autopilot: { monetary: false, fiscal: false },
      predictions: true,
      showRealRate: false,
      scoring: freshScoring(),
      optimal: freshOptimal(),
      universes: { a: freshUniverse('a'), b: freshUniverse('b') }
    };
  }

  function lateOn(u) { return u.preset === 'realworld' || u.late; }

  function differsFromPreset(u) {
    var p = presetValues(u.preset);
    for (var i = 0; i < MAIN_KEYS.length; i++) if (u[MAIN_KEYS[i]] !== p[MAIN_KEYS[i]]) return true;
    if (lateOn(u) !== p.late) return true;
    if (lateOn(u) && (u.lambdaLate !== p.lambdaLate || u.switchRound !== p.switchRound)) return true;
    return false;
  }

  // Any value under "Advanced" that is not the preset's.
  function advancedChanged(u) {
    var p = presetValues(u.preset);
    for (var i = 0; i < ADV_FIELDS.length; i++) if (u[ADV_FIELDS[i].key] !== p[ADV_FIELDS[i].key]) return true;
    if (lateOn(u) !== p.late) return true;
    if (lateOn(u) && (u.lambdaLate !== p.lambdaLate || u.switchRound !== p.switchRound)) return true;
    return false;
  }

  function el(tag, attrs, text) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) {
      if (k === 'class') e.className = attrs[k];
      else e.setAttribute(k, attrs[k]);
    }
    if (text != null) e.textContent = text;
    return e;
  }

  // ---------- state ----------

  var state = freshState();
  var refs = null;       // DOM references after mount
  var onChange = null;
  var locked = false;
  var taylorNote = '';   // short status line after a preset turns the Taylor rule on

  function slotsInUse() { return state.universeCount === 2 ? SLOTS : ['a']; }

  function get() {
    var sc = state.scoring;
    var op = state.optimal;
    var out = {
      rounds: state.rounds, shockMode: state.shockMode, event: state.event,
      supplyLever: state.supplyLever,
      universeCount: state.universeCount,
      autopilot: {
        monetary: apNorm('monetary', state.autopilot.monetary),
        fiscal: apNorm('fiscal', state.autopilot.fiscal)
      },
      predictions: state.predictions,
      showRealRate: state.showRealRate,
      scoring: { on: sc.on, uBand: sc.uBand, piBand: sc.piBand, wU: sc.wU, wPi: sc.wPi },
      optimal: { show: op.show, hint: !!op.hint, discount: op.discount, costFiscal: op.costFiscal, costRate: op.costRate, tail: op.tail },
      universes: {}
    };
    SLOTS.forEach(function (s) {
      var u = state.universes[s];
      var late = lateOn(u);
      out.universes[s] = {
        name: (u.name && u.name.trim()) || defaultName(u.preset),
        preset: u.preset,
        lambda: u.lambda, multiplier: u.multiplier, expected: u.expected,
        credibility: u.credibility, rateSensitivity: u.rateSensitivity,
        fiscalLag: u.fiscalLag, monetaryLag: u.monetaryLag,
        lambdaLate: late ? u.lambdaLate : null,
        switchRound: late ? u.switchRound : null
      };
    });
    return out;
  }

  function applyPreset(u, key) {
    var pv = presetValues(key);
    for (var k in pv) u[k] = pv[k];
    u.preset = key;
  }

  // ---------- URL sync ----------

  function readUrl() {
    var params;
    try { params = new URLSearchParams(root.location.search); } catch (e) { return; }
    var r = clean('rounds', params.get('r'));
    if (r !== null) state.rounds = r;
    var m = params.get('m');
    if (CODE_MODE[m]) state.shockMode = CODE_MODE[m];
    else if (MODE_CODE[m]) state.shockMode = m;
    var ev = validEvent(params.get('ev'));
    if (ev) state.event = ev;
    var sl = flag(params.get('sl'));
    if (sl !== null) state.supplyLever = sl;
    var uc = params.get('u');
    if (uc === '1' || uc === '2') state.universeCount = Number(uc);
    var apm = apFromUrl('monetary', params.get('apm'));
    if (apm !== null) state.autopilot.monetary = apm;
    var apf = apFromUrl('fiscal', params.get('apf'));
    if (apf !== null) state.autopilot.fiscal = apf;
    var pr = flag(params.get('pr'));
    if (pr !== null) state.predictions = pr;
    var rr = flag(params.get('rr'));
    if (rr !== null) state.showRealRate = rr;
    var sc = flag(params.get('sc'));
    if (sc !== null) state.scoring.on = sc;
    Object.keys(SCORE_FIELDS).forEach(function (k) {
      var v = clean(SCORE_FIELDS[k][1], params.get(SCORE_FIELDS[k][0]));
      if (v !== null) state.scoring[k] = v;
    });
    var os = flag(params.get('os'));
    if (os !== null) state.optimal.show = os;
    var oh = flag(params.get('oh'));
    if (oh !== null) state.optimal.hint = oh;
    OPT_KEYS.forEach(function (k) {
      var v = clean(k, params.get(OPT_URL[k]));
      if (v !== null) state.optimal[k] = v;
    });

    SLOTS.forEach(function (s) {
      var u = state.universes[s];
      var code = params.get(s + '_p');
      var preset = CODE_PRESET[code] || (PRESETS[code] ? code : null);
      if (preset) applyPreset(u, preset);
      // A link with a Taylor-rule school and no autopilot setting gets the rule, as a click would.
      if (preset && PRESETS[preset].taylor && apm === null && !state.autopilot.monetary &&
          slotsInUse().indexOf(s) >= 0) {
        state.autopilot.monetary = 'taylor';
      }
      var name = params.get(s + '_n');
      if (name !== null) {
        name = name.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, NAME_MAX);
        if (name && name !== defaultName(u.preset)) u.name = name;
      }
      // Old links: one lag for all policy. Set both; the new keys override it.
      var oldLag = params.get(s + '_g');
      if (oldLag !== null) {
        var fl = clean('fiscalLag', oldLag), ml = clean('monetaryLag', oldLag);
        if (fl !== null) u.fiscalLag = fl;
        if (ml !== null) u.monetaryLag = ml;
      }
      // Old links: inflation inertia is the opposite of credibility. a_c overrides it.
      var inertia = clean('inertia', params.get(s + '_i'));
      if (inertia !== null) u.credibility = clean('credibility', 1 - inertia);
      MAIN_KEYS.forEach(function (key) {
        var v = clean(key, params.get(s + '_' + URL_FIELDS[key]));
        if (v !== null) u[key] = v;
      });
      var ll = clean('lambdaLate', params.get(s + '_ll'));
      var sr = clean('switchRound', params.get(s + '_sr'));
      if (ll !== null || sr !== null) {
        u.late = true;
        if (ll !== null) u.lambdaLate = ll;
        if (sr !== null) u.switchRound = sr;
      }
    });
  }

  function buildQuery() {
    var params;
    try { params = new URLSearchParams(root.location.search); } catch (e) { params = new URLSearchParams(); }
    // Drop our own keys (and the old ones), keep anything else on the page address.
    var ours = ['r', 'm', 'ev', 'sl', 'u', 'apm', 'apf', 'pr', 'rr', 'sc', 'os', 'oh'];
    OPT_KEYS.forEach(function (k) { ours.push(OPT_URL[k]); });
    Object.keys(SCORE_FIELDS).forEach(function (k) { ours.push(SCORE_FIELDS[k][0]); });
    SLOTS.forEach(function (s) {
      ours.push(s + '_p', s + '_n', s + '_g', s + '_i');
      for (var k in URL_FIELDS) ours.push(s + '_' + URL_FIELDS[k]);
    });
    ours.forEach(function (k) { params.delete(k); });

    var cfg = get();
    params.set('r', String(cfg.rounds));
    params.set('m', MODE_CODE[cfg.shockMode]);
    params.set('ev', cfg.event);
    params.set('sl', cfg.supplyLever ? '1' : '0');
    params.set('u', String(cfg.universeCount));
    params.set('apm', apCode(cfg.autopilot.monetary));
    params.set('apf', apCode(cfg.autopilot.fiscal));
    params.set('pr', cfg.predictions ? '1' : '0');
    params.set('rr', cfg.showRealRate ? '1' : '0');
    params.set('sc', cfg.scoring.on ? '1' : '0');
    Object.keys(SCORE_FIELDS).forEach(function (k) {
      params.set(SCORE_FIELDS[k][0], String(cfg.scoring[k]));
    });
    params.set('os', cfg.optimal.show ? '1' : '0');
    params.set('oh', cfg.optimal.hint ? '1' : '0');
    OPT_KEYS.forEach(function (k) { params.set(OPT_URL[k], String(cfg.optimal[k])); });
    SLOTS.forEach(function (s) {
      var u = cfg.universes[s];
      params.set(s + '_p', PRESET_CODE[u.preset]);
      if (u.name !== defaultName(u.preset)) params.set(s + '_n', u.name);
      MAIN_KEYS.forEach(function (key) {
        params.set(s + '_' + URL_FIELDS[key], String(u[key]));
      });
      if (u.lambdaLate !== null) {
        params.set(s + '_ll', String(u.lambdaLate));
        params.set(s + '_sr', String(u.switchRound));
      }
    });
    return params.toString();
  }

  function shareUrl() {
    var loc = root.location;
    var base = loc.href.split('#')[0].split('?')[0];
    return base + '?' + buildQuery() + (loc.hash || '');
  }

  function writeUrl() {
    try {
      var loc = root.location;
      root.history.replaceState(root.history.state, '', loc.pathname + '?' + buildQuery() + loc.hash);
    } catch (e) {
      // file:// or a sandboxed frame may refuse; the link button still works.
    }
  }

  // ---------- rendering ----------

  var uid = 0;
  function nextId(base) { uid += 1; return 'pu-set-' + base + '-' + uid; }

  // A labelled range slider with a short value readout. key names the RANGES entry.
  // onValue(v) stores it.
  function slider(key, labelText, tipKey, parent, onValue) {
    var id = nextId(key);
    var r = rangeOf(key);
    var wrap = el('div', { class: 'pu-set-field' });
    var top = el('div', { class: 'pu-set-field-top' });
    var label = tip(el('label', { for: id }, labelText), tipKey);
    var out = el('output', { for: id, class: 'pu-set-value', 'aria-hidden': 'true' });
    top.appendChild(label);
    top.appendChild(out);
    var input = tip(el('input', {
      type: 'range', id: id, min: String(r.min), max: String(r.max), step: String(r.step)
    }), tipKey);
    wrap.appendChild(top);
    wrap.appendChild(input);
    parent.appendChild(wrap);
    input.addEventListener('input', function () {
      var v = clean(key, input.value);
      if (v === null) return;
      onValue(v);
      changed();
    });
    return { input: input, out: out, wrap: wrap };
  }

  function setSlider(sl, dispKey, v) {
    sl.input.value = String(v);
    var text = display(dispKey, v);
    sl.out.textContent = text;
    sl.input.setAttribute('aria-valuetext', text);
  }

  function checkbox(labelText, tipKey, parent, extraClass) {
    var id = nextId('check');
    var wrap = el('div', { class: 'pu-set-check' + (extraClass ? ' ' + extraClass : '') });
    var input = tip(el('input', { type: 'checkbox', id: id }), tipKey);
    wrap.appendChild(input);
    wrap.appendChild(tip(el('label', { for: id }, labelText), tipKey));
    parent.appendChild(wrap);
    return { input: input, wrap: wrap };
  }

  function buildUniverse(slot) {
    var u = state.universes[slot];
    var box = el('fieldset', { class: 'pu-set-universe', 'data-slot': slot });
    var legend = tip(el('legend', { class: 'pu-set-legend' }, 'Universe ' + slot.toUpperCase()),
      slot === 'a' ? 'universeA' : 'universeB');
    box.appendChild(legend);
    var r = { sliders: {}, presetButtons: {} };

    // Name
    var nameId = nextId(slot + '-name');
    var nameWrap = el('div', { class: 'pu-set-field pu-set-name' });
    nameWrap.appendChild(tip(el('label', { for: nameId }, 'Name'), 'name'));
    var name = tip(el('input', { type: 'text', id: nameId, maxlength: String(NAME_MAX), autocomplete: 'off', spellcheck: 'false' }), 'name');
    nameWrap.appendChild(name);
    box.appendChild(nameWrap);
    name.addEventListener('input', function () {
      var v = name.value.slice(0, NAME_MAX);
      u.name = v.trim() === defaultName(u.preset) ? '' : v;
      changed();
    });
    name.addEventListener('blur', function () {
      if (!name.value.trim()) { u.name = ''; syncDom(); }
    });
    r.name = name;

    // Presets (schools of thought), then the status line and Reset.
    var presetRow = tip(el('div', { class: 'pu-set-presets', role: 'group', 'aria-label': 'Universe ' + slot.toUpperCase() + ' school of thought' }), 'preset');
    PRESET_KEYS.forEach(function (key) {
      var b = tip(el('button', { type: 'button', class: 'pu-set-btn pu-set-preset', 'data-preset': key }, PRESETS[key].label), key);
      b.addEventListener('click', function () {
        applyPreset(u, key);
        if (PRESETS[key].taylor && !state.autopilot.monetary) {
          state.autopilot.monetary = 'taylor';
          taylorNote = 'Team Monetary autopilot is now on: ' + PRESETS[key].label + ' uses the Taylor rule.';
        } else if (PRESETS[key].taylor && state.autopilot.monetary === 'optimal') {
          taylorNote = PRESETS[key].label + ' uses the Taylor rule. Team Monetary stays on the optimal rule.';
        } else if (PRESETS[key].taylor) {
          taylorNote = PRESETS[key].label + ' uses the Taylor rule. Team Monetary autopilot is on.';
        }
        changed();
      });
      presetRow.appendChild(b);
      r.presetButtons[key] = b;
    });
    box.appendChild(presetRow);

    var statusRow = el('div', { class: 'pu-set-status-row' });
    var status = el('p', { class: 'pu-set-status', 'aria-live': 'polite' });
    var reset = tip(el('button', { type: 'button', class: 'pu-set-btn pu-set-reset' }, 'Reset'), 'reset');
    reset.addEventListener('click', function () {
      applyPreset(u, u.preset);
      changed();
    });
    statusRow.appendChild(status);
    statusRow.appendChild(reset);
    box.appendChild(statusRow);
    r.status = status;
    r.reset = reset;

    FIELDS.forEach(function (f) {
      r.sliders[f.key] = slider(f.key, f.label, f.key, box, function (v) { u[f.key] = v; });
    });

    // Advanced: the real-rate response, the lags, and the later speed-up.
    var adv = el('details', { class: 'pu-set-adv' });
    var sum = tipText(el('summary', null),
      'Settings most games can leave alone: how strongly spending responds to the real interest rate, how long policy takes to work, and a later change in how fast wages and prices adjust.');
    sum.appendChild(el('span', { class: 'pu-set-adv-title' }, 'Advanced'));
    var advMark = el('span', { class: 'pu-set-adv-mark' }, 'changed');
    sum.appendChild(advMark);
    adv.appendChild(sum);
    var advBody = el('div', { class: 'pu-set-adv-body' });
    ADV_FIELDS.forEach(function (f) {
      r.sliders[f.key] = slider(f.key, f.label, f.key, advBody, function (v) { u[f.key] = v; });
    });

    var late = checkbox('Speeds up later', 'speedsUp', advBody);
    late.input.addEventListener('change', function () {
      u.late = late.input.checked;
      changed();
    });
    r.late = late.input;
    r.lateWrap = late.wrap;

    var lateBox = el('div', { class: 'pu-set-late' });
    LATE_FIELDS.forEach(function (f) {
      r.sliders[f.key] = slider(f.key, f.label, f.key, lateBox, function (v) { u[f.key] = v; });
    });
    advBody.appendChild(lateBox);
    adv.appendChild(advBody);
    box.appendChild(adv);
    r.lateBox = lateBox;
    r.adv = adv;
    r.advMark = advMark;

    r.box = box;
    return r;
  }

  // One team's autopilot: Off / plain rule / optimal rule, as a radio group.
  function autopilotGroup(kind, legendText, parent) {
    var fs = el('fieldset', { class: 'pu-set-ap', 'data-team': kind });
    fs.appendChild(tip(el('legend', null, legendText), 'autopilotMode'));
    var row = el('div', { class: 'pu-set-ap-row' });
    var group = 'pu-set-ap-' + kind + '-' + (++uid);
    var inputs = [];
    AP_MODES[kind].forEach(function (m, i) {
      var id = nextId('ap-' + kind + '-' + i);
      var w = el('div', { class: 'pu-set-radio pu-set-check-lg' });
      var input = tip(el('input', { type: 'radio', id: id, name: group, value: String(i) }), m[2]);
      w.appendChild(input);
      w.appendChild(tip(el('label', { for: id }, m[1]), m[2]));
      row.appendChild(w);
      input.addEventListener('change', function () {
        if (!input.checked) return;
        state.autopilot[kind] = m[0];
        if (kind === 'monetary') taylorNote = '';
        changed();
      });
      inputs.push({ value: m[0], input: input });
    });
    fs.appendChild(row);
    parent.appendChild(fs);
    return inputs;
  }

  function buildGame() {
    var box = el('div', { class: 'pu-set-game' });
    var r = {};

    // Left column: universes, rounds, event, supply lever, real rate. Right column: shocks, teams.
    var col = el('div', { class: 'pu-set-game-col' });

    var count = tipText(el('fieldset', { class: 'pu-set-count' }),
      'Play one universe, or two side by side. Two universes get the same event and the same policy choices, so you can compare how their rules play out.');
    count.appendChild(el('legend', null, 'Universes'));
    var countRow = el('div', { class: 'pu-set-count-row' });
    var countGroup = 'pu-set-count-' + (++uid);
    r.count = {};
    COUNTS.forEach(function (pair) {
      var id = nextId('count-' + pair[0]);
      var w = el('div', { class: 'pu-set-radio' });
      var input = el('input', { type: 'radio', id: id, name: countGroup, value: String(pair[0]) });
      w.appendChild(input);
      w.appendChild(el('label', { for: id }, pair[1]));
      countRow.appendChild(w);
      input.addEventListener('change', function () {
        if (input.checked) { state.universeCount = pair[0]; changed(); }
      });
      r.count[pair[0]] = input;
    });
    count.appendChild(countRow);
    col.appendChild(count);

    var rounds = slider('rounds', 'Rounds', 'rounds', col, function (v) { state.rounds = v; });
    rounds.wrap.classList.add('pu-set-rounds');
    r.rounds = rounds.input;
    r.roundsOut = rounds.out;

    var evId = nextId('event');
    var evWrap = el('div', { class: 'pu-set-field pu-set-event' });
    evWrap.appendChild(tip(el('label', { for: evId }, 'Event'), 'eventSetting'));
    var sel = tip(el('select', { id: evId }), 'eventSetting');
    sel.appendChild(el('option', { value: 'random' }, 'Random'));
    EVENTS.forEach(function (k) {
      sel.appendChild(el('option', { value: k }, SHOCKS[k].headline || SHOCKS[k].label));
    });
    sel.addEventListener('change', function () {
      var v = validEvent(sel.value);
      if (!v) return;
      state.event = v;
      changed();
    });
    evWrap.appendChild(sel);
    col.appendChild(evWrap);
    r.event = sel;
    r.eventWrap = evWrap;

    var supply = checkbox('Add a supply-side investment lever', 'supplyLever', col);
    supply.input.addEventListener('change', function () {
      state.supplyLever = supply.input.checked;
      changed();
    });
    r.supply = supply.input;

    var rr = checkbox('Show the real interest rate', 'showRealRate', col);
    rr.input.addEventListener('change', function () {
      state.showRealRate = rr.input.checked;
      changed();
    });
    r.realRate = rr.input;
    box.appendChild(col);

    var shocks = el('fieldset', { class: 'pu-set-shocks' });
    shocks.appendChild(tip(el('legend', null, 'Shocks'), 'shockMode'));
    var group = 'pu-set-shock-' + (++uid);
    r.shock = {};
    MODES.forEach(function (pair) {
      var id = nextId('shock-' + pair[0]);
      var w = el('div', { class: 'pu-set-radio' });
      var input = tip(el('input', { type: 'radio', id: id, name: group, value: pair[0] }), 'shockMode');
      w.appendChild(input);
      w.appendChild(tip(el('label', { for: id }, pair[1]), 'shockMode'));
      shocks.appendChild(w);
      input.addEventListener('change', function () {
        if (input.checked) { state.shockMode = pair[0]; changed(); }
      });
      r.shock[pair[0]] = input;
    });
    var side = el('div', { class: 'pu-set-game-side' });
    side.appendChild(shocks);

    // Autopilots and predictions.
    var play = el('fieldset', { class: 'pu-set-play' });
    play.appendChild(el('legend', null, 'Teams and predictions'));
    var apm = autopilotGroup('monetary', 'Team Monetary autopilot', play);
    var note = el('p', { class: 'pu-set-note', 'aria-live': 'polite' });
    play.appendChild(note);
    var apf = autopilotGroup('fiscal', 'Team Fiscal autopilot', play);
    var pr = checkbox('Ask for predictions each round', 'predict', play, 'pu-set-check-lg');
    pr.input.addEventListener('change', function () {
      state.predictions = pr.input.checked;
      changed();
    });
    r.ap = { monetary: apm, fiscal: apf };
    r.predictions = pr.input;
    r.note = note;
    side.appendChild(play);
    box.appendChild(side);

    // Scoring: the Fed's dual mandate.
    var scoring = el('fieldset', { class: 'pu-set-scoring' });
    scoring.appendChild(tip(el('legend', null, 'Scoring'), 'scoring'));
    var son = checkbox('Score the game (welfare compared with no policy)', 'scoring', scoring, 'pu-set-check-lg');
    son.input.addEventListener('change', function () {
      state.scoring.on = son.input.checked;
      changed();
    });
    var sbody = el('div', { class: 'pu-set-scoring-body' });
    r.scoreSliders = {
      uBand: slider('zoneUnemployment', 'Unemployment within +/- points of the natural rate', 'zoneUnemployment', sbody,
        function (v) { state.scoring.uBand = v; }),
      piBand: slider('zoneInflation', 'Inflation within +/- points of 2%', 'zoneInflation', sbody,
        function (v) { state.scoring.piBand = v; }),
      wU: slider('weight', 'Welfare weight on employment', 'weightU', sbody, function (v) { state.scoring.wU = v; }),
      wPi: slider('weight', 'Welfare weight on stable prices', 'weightPi', sbody, function (v) { state.scoring.wPi = v; })
    };
    scoring.appendChild(sbody);
    r.scoreOn = son.input;
    r.scoreBody = sbody;
    box.appendChild(scoring);

    // Optimal policy: the benchmark on screen, and the optimal rule's options.
    var opt = el('fieldset', { class: 'pu-set-optimal' });
    opt.appendChild(tip(el('legend', null, 'Optimal policy'), 'showOptimal'));
    var oshow = checkbox('Show the optimal path and the share of the achievable gain', 'showOptimal', opt, 'pu-set-check-lg');
    oshow.input.addEventListener('change', function () {
      state.optimal.show = oshow.input.checked;
      changed();
    });
    var ohint = checkbox('Show the optimal move before each round', 'showHint', opt, 'pu-set-check-lg');
    ohint.input.addEventListener('change', function () {
      state.optimal.hint = ohint.input.checked;
      changed();
    });
    var oadv = el('details', { class: 'pu-set-adv' });
    var osum = tipText(el('summary', null),
      'Options for the optimal rule and the optimal path: how much later rounds count, the cost of moving each lever, and how many rounds after the game are counted. Most games can leave them alone.');
    osum.appendChild(el('span', { class: 'pu-set-adv-title' }, 'Advanced'));
    var oMark = el('span', { class: 'pu-set-adv-mark' }, 'changed');
    osum.appendChild(oMark);
    oadv.appendChild(osum);
    var obody = el('div', { class: 'pu-set-adv-body pu-set-optimal-body' });
    r.optSliders = {};
    OPT_FIELDS.forEach(function (f) {
      r.optSliders[f.key] = slider(f.key, f.label, f.tip, obody, function (v) { state.optimal[f.key] = v; });
    });
    oadv.appendChild(obody);
    opt.appendChild(oadv);
    r.optShow = oshow.input;
    r.optHint = ohint.input;
    r.optMark = oMark;
    box.appendChild(opt);
    return { box: box, r: r };
  }

  function buildShare() {
    var box = el('div', { class: 'pu-set-share' });
    var btn = tip(el('button', { type: 'button', class: 'pu-set-btn' }, 'Copy link to these settings'), 'copyLink');
    var msg = el('p', { class: 'pu-set-share-msg', 'aria-live': 'polite' });
    var linkId = nextId('link');
    var linkWrap = el('div', { class: 'pu-set-link', hidden: '' });
    linkWrap.appendChild(tip(el('label', { for: linkId }, 'Link to these settings'), 'copyLink'));
    var link = tip(el('input', { type: 'text', id: linkId, readonly: '' }), 'copyLink');
    linkWrap.appendChild(link);
    box.appendChild(btn);
    box.appendChild(msg);
    box.appendChild(linkWrap);

    function fallback(url) {
      linkWrap.hidden = false;
      link.value = url;
      link.focus();
      link.select();
      var ok = false;
      try { ok = document.execCommand && document.execCommand('copy'); } catch (e) { ok = false; }
      msg.textContent = ok ? 'Link copied.' : 'Copy the link below.';
    }

    btn.addEventListener('click', function () {
      var url = shareUrl();
      link.value = url;
      if (root.navigator && root.navigator.clipboard && root.navigator.clipboard.writeText) {
        root.navigator.clipboard.writeText(url).then(function () {
          msg.textContent = 'Link copied.';
          linkWrap.hidden = false;
        }, function () { fallback(url); });
      } else {
        fallback(url);
      }
    });
    return { box: box, btn: btn, link: link, linkWrap: linkWrap, msg: msg };
  }

  function syncDom() {
    if (!refs) return;
    var g = refs.game;
    COUNTS.forEach(function (pair) { g.count[pair[0]].checked = state.universeCount === pair[0]; });
    g.rounds.value = String(state.rounds);
    g.roundsOut.textContent = String(state.rounds);
    g.rounds.setAttribute('aria-valuetext', state.rounds + ' rounds');
    MODES.forEach(function (pair) { g.shock[pair[0]].checked = state.shockMode === pair[0]; });
    g.event.value = state.event;
    g.eventWrap.hidden = state.shockMode !== 'event';
    g.supply.checked = state.supplyLever;
    g.realRate.checked = state.showRealRate;
    ['monetary', 'fiscal'].forEach(function (kind) {
      var cur = apNorm(kind, state.autopilot[kind]);
      g.ap[kind].forEach(function (o) { o.input.checked = o.value === cur; });
    });
    g.predictions.checked = state.predictions;
    g.note.textContent = taylorNote;
    g.note.hidden = !taylorNote;

    var sc = state.scoring;
    g.scoreOn.checked = sc.on;
    g.scoreBody.hidden = !sc.on;
    Object.keys(g.scoreSliders).forEach(function (k) { setSlider(g.scoreSliders[k], k, sc[k]); });

    var op = state.optimal, od = optDefaults();
    g.optShow.checked = op.show;
    g.optHint.checked = !!op.hint;
    OPT_KEYS.forEach(function (k) {
      setSlider(g.optSliders[k], k, op[k]);
      g.optSliders[k].wrap.classList.toggle('is-changed', op[k] !== od[k]);
    });
    g.optMark.hidden = !optimalChanged();

    refs.grid.classList.toggle('is-one', state.universeCount === 1);
    refs.u.b.box.hidden = state.universeCount === 1;

    SLOTS.forEach(function (s) {
      var u = state.universes[s];
      var r = refs.u[s];
      if (document.activeElement !== r.name) r.name.value = u.name || defaultName(u.preset);
      PRESET_KEYS.forEach(function (key) {
        r.presetButtons[key].setAttribute('aria-pressed', u.preset === key ? 'true' : 'false');
      });
      var custom = differsFromPreset(u);
      r.status.textContent = PRESETS[u.preset].label + (custom ? ' preset, Custom values' : ' preset');
      r.status.classList.toggle('is-custom', custom);
      r.reset.disabled = locked || !custom;

      var pv = presetValues(u.preset);
      MAIN_KEYS.concat(['lambdaLate', 'switchRound']).forEach(function (key) {
        var sl = r.sliders[key];
        setSlider(sl, key, u[key]);
        var lateKey = key === 'lambdaLate' || key === 'switchRound';
        var diff = lateKey ? (pv.late && u[key] !== pv[key]) : u[key] !== pv[key];
        sl.wrap.classList.toggle('is-changed', diff);
      });

      var showLate = lateOn(u);
      r.lateWrap.hidden = u.preset === 'realworld';
      r.late.checked = showLate;
      r.lateBox.hidden = !showLate;
      r.advMark.hidden = !advancedChanged(u);
    });
  }

  function changed() {
    syncDom(); // leaves the name field alone while it has focus
    writeUrl();
    if (typeof onChange === 'function') {
      try { onChange(get()); } catch (e) { if (root.console) root.console.error(e); }
    }
  }

  function setLocked(on) {
    locked = !!on;
    if (!refs) return;
    var share = refs.share.box;
    var nodes = refs.root.querySelectorAll('input, button, select, textarea');
    for (var i = 0; i < nodes.length; i++) {
      // The share link stays usable during a game.
      if (share.contains(nodes[i])) continue;
      nodes[i].disabled = locked;
    }
    refs.lockMsg.hidden = !locked;
    refs.root.classList.toggle('is-locked', locked);
    if (!locked) syncDom(); // restores Reset's own disabled state
    else SLOTS.forEach(function (s) { refs.u[s].reset.disabled = true; });
  }

  function mount(container, opts) {
    opts = opts || {};
    onChange = opts.onChange || null;
    var old = container.querySelector('.pu-settings');
    if (old) old.parentNode.removeChild(old);

    state = freshState();
    taylorNote = '';
    readUrl();

    var rootEl = el('div', { class: 'pu-settings' });
    var lockMsg = el('p', { class: 'pu-set-lock', role: 'status', hidden: '' },
      'Settings are locked during a game. Start a new game to change them.');
    rootEl.appendChild(lockMsg);

    var game = buildGame();
    rootEl.appendChild(game.box);

    var grid = el('div', { class: 'pu-set-universes' });
    var ua = buildUniverse('a');
    var ub = buildUniverse('b');
    grid.appendChild(ua.box);
    grid.appendChild(ub.box);
    rootEl.appendChild(grid);

    var share = buildShare();
    rootEl.appendChild(share.box);

    container.appendChild(rootEl);
    refs = { root: rootEl, lockMsg: lockMsg, game: game.r, grid: grid, u: { a: ua, b: ub }, share: share };
    syncDom();
    setLocked(locked);
    writeUrl();
    return get();
  }

  // The sidebar's autopilot switches can change autopilot during a game, even
  // while the panel is locked. This keeps the panel and the link in step,
  // without starting a new game (no onChange).
  function setAutopilot(o) {
    if (!state) return;
    // Accepts false | true | 'taylor' / 'balanced' | 'optimal' (true means the plain rule).
    if (o && o.monetary != null) state.autopilot.monetary = apNorm('monetary', o.monetary);
    if (o && o.fiscal != null) state.autopilot.fiscal = apNorm('fiscal', o.fiscal);
    if (refs) { syncDom(); if (locked) setLocked(true); }
    writeUrl();
  }

  root.PU.settings = { mount: mount, get: get, lock: setLocked, setAutopilot: setAutopilot };
})(typeof window !== 'undefined' ? window : globalThis);
