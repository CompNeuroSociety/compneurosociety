// Color theme: light by default, dark by the clock.
//
// Loaded as a plain blocking <script> in every page's <head>, right after the
// stylesheet, so the theme is set before the first paint (no flash).
//
// Rules, in order:
//   1. An explicit choice saved by the toggle button (localStorage "cns-theme" =
//      "light" | "dark") always wins.
//   2. Otherwise "auto": dark between 7pm and 7am by the visitor's own clock
//      (new Date().getHours() — the device's local time zone, no geolocation,
//      no permission prompt, nothing sent anywhere).
//   3. If storage or the clock can't be read, the site stays white.
//
// The toggle cycles auto -> light -> dark -> auto. Auto re-checks every minute
// and when the tab becomes visible again, so a page left open flips at 7pm.
(function () {
  'use strict';
  var KEY = 'cns-theme', DARK_FROM = 19, DARK_UNTIL = 7;   // 7pm .. 7am local
  var root = document.documentElement;

  function stored() {
    try { var v = localStorage.getItem(KEY); return v === 'light' || v === 'dark' ? v : 'auto'; }
    catch (e) { return 'auto'; }
  }
  function byClock() {
    try { var h = new Date().getHours(); if (h !== h) return 'light'; return (h >= DARK_FROM || h < DARK_UNTIL) ? 'dark' : 'light'; }
    catch (e) { return 'light'; }
  }
  function resolve(mode) { return mode === 'auto' ? byClock() : mode; }

  var LABEL = { auto: 'auto', light: 'light', dark: 'dark' };
  var ICON = { auto: '◐', light: '☀', dark: '☾' };   // ◐ ☀ ☾
  function describe(mode, theme) {
    if (mode === 'auto') return 'Theme: auto (' + theme + ' now; dark from 7pm to 7am by your clock). Click for light.';
    if (mode === 'light') return 'Theme: light. Click for dark.';
    return 'Theme: dark. Click for auto (by time of day).';
  }

  function paintButtons(mode, theme) {
    var btns = document.querySelectorAll('[data-theme-toggle]');
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i];
      b.innerHTML = '<span class="theme-ico" aria-hidden="true">' + ICON[mode] + '</span><span class="theme-txt">' + LABEL[mode] + '</span>';
      b.setAttribute('title', describe(mode, theme));
      b.setAttribute('aria-label', describe(mode, theme));
    }
  }
  function tellFrames(theme) {
    var frames = document.querySelectorAll('iframe[data-theme-sync]');
    for (var i = 0; i < frames.length; i++) {
      try { frames[i].contentWindow.postMessage({ type: 'cns-theme', theme: theme }, '*'); } catch (e) {}
    }
  }
  function apply() {
    var mode = stored(), theme = resolve(mode);
    if (root.getAttribute('data-theme') !== theme) root.setAttribute('data-theme', theme);
    root.setAttribute('data-theme-mode', mode);
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', theme === 'dark' ? '#0d1117' : '#ffffff');
    paintButtons(mode, theme);
    tellFrames(theme);
    return theme;
  }
  function set(mode) {
    try { if (mode === 'auto') localStorage.removeItem(KEY); else localStorage.setItem(KEY, mode); } catch (e) {}
    return apply();
  }
  function cycle() {
    var m = stored();
    return set(m === 'auto' ? 'light' : m === 'light' ? 'dark' : 'auto');
  }

  apply();   // before first paint

  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest ? e.target.closest('[data-theme-toggle]') : null;
    if (!b) return;
    e.preventDefault();
    cycle();
  });
  document.addEventListener('DOMContentLoaded', function () {
    apply();
    var frames = document.querySelectorAll('iframe[data-theme-sync]');
    for (var i = 0; i < frames.length; i++) frames[i].addEventListener('load', function () { tellFrames(resolve(stored())); });
  });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) apply(); });
  setInterval(function () { if (stored() === 'auto') apply(); }, 60000);
  window.addEventListener('storage', function (e) { if (e.key === KEY) apply(); });

  window.CNSTheme = { get: function () { return { mode: stored(), theme: resolve(stored()) }; }, set: set, cycle: cycle };
})();
