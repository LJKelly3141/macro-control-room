/*
 * Macro Control Room: fixed display scales and colors, shared by every view so
 * both universes are always drawn on the same scales.
 */
(function (root) {
  'use strict';
  root.PU = root.PU || {};
  root.PU.SCALES = {
    gapPct: { min: -10, max: 10, unit: '%', label: 'Output gap' },
    unemployment: { min: 0, max: 12, unit: '%', label: 'Unemployment', mark: 5, markLabel: 'Natural rate' },
    inflation: { min: -10, max: 15, unit: '%', label: 'Inflation', mark: 2, markLabel: 'Target' },
    price: { min: 80, max: 130, unit: '', label: 'Price level' },
    // AD/AS panel axes: real GDP across, price level up. adasY is the default
    // real GDP range (adas.js widens it only when a point falls outside). The
    // price-level range is chosen per render from the history (adas.js);
    // adasP is a fallback. adasInflation is kept for older code.
    adasY: { min: 8400, max: 10400 },
    adasP: { min: 80, max: 130 },
    adasInflation: { min: -10, max: 15 }
  };
  var DEFAULT_ZONE = { unemployment: [4.5, 5.5], inflation: [1, 3] };
  // The green zone for a scoring setting ({on, uBand, piBand, wU, wPi}, as
  // passed to createGame): PU.engine.scoringOf(scoring).zone.
  root.PU.zoneFor = function (scoring) {
    var E = root.PU.engine;
    if (E && E.scoringOf) return E.scoringOf(scoring).zone;
    return E && E.ZONE ? E.ZONE : DEFAULT_ZONE;
  };
  // The default green zone, for bands on gauges and charts when no scoring is given.
  root.PU.ZONE = root.PU.engine ? root.PU.zoneFor() : DEFAULT_ZONE;
  // One color per universe slot, matching the ECON 202 slides' two_views.svg.
  root.PU.COLORS = { a: '#0077A3', b: '#009E73', accent: '#BE0F34', potential: '#555555' };
})(typeof window !== 'undefined' ? window : globalThis);
