/* =====================================================================
   site.js — 導覽列漢堡選單與小工具 / Nav menu & small helpers
   純 JavaScript，無任何相依套件。
   ===================================================================== */
(function () {
  'use strict';

  var DESKTOP = window.matchMedia('(min-width: 1100px)');

  function initNav() {
    var toggle = document.querySelector('.nav-toggle');
    var nav = document.getElementById('site-nav');
    if (!toggle || !nav) { return; }

    function setOpen(open) {
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) { nav.classList.add('is-open'); } else { nav.classList.remove('is-open'); }
    }

    toggle.addEventListener('click', function () {
      setOpen(toggle.getAttribute('aria-expanded') !== 'true');
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) {
        setOpen(false);
        toggle.focus();
      }
    });

    document.addEventListener('click', function (e) {
      if (!nav.classList.contains('is-open')) { return; }
      if (nav.contains(e.target) || toggle.contains(e.target)) { return; }
      setOpen(false);
    });

    function onBreakpoint(mq) {
      if (mq.matches) { setOpen(false); }
    }
    if (DESKTOP.addEventListener) {
      DESKTOP.addEventListener('change', onBreakpoint);
    } else if (DESKTOP.addListener) {
      DESKTOP.addListener(onBreakpoint);
    }
  }

  function initYear() {
    var nodes = document.querySelectorAll('[data-year]');
    var year = String(new Date().getFullYear());
    for (var i = 0; i < nodes.length; i++) { nodes[i].textContent = year; }
  }

  function initShare() {
    var bars = document.querySelectorAll('.share');
    for (var i = 0; i < bars.length; i++) {
      (function (bar) {
        var url = window.location.href.split('#')[0];
        var enc = encodeURIComponent(url);
        var fb = bar.querySelector('.share-fb');
        var line = bar.querySelector('.share-line');
        if (fb) { fb.href = 'https://www.facebook.com/sharer/sharer.php?u=' + enc; }
        if (line) { line.href = 'https://social-plugins.line.me/lineit/share?url=' + enc; }
        var copy = bar.querySelector('.share-copy');
        if (!copy) { return; }
        copy.addEventListener('click', function () {
          var lang = document.documentElement.getAttribute('data-lang') === 'en' ? 'en' : 'zh';
          var label = copy.querySelector('.share-copy-text');
          function done() {
            if (label) { label.textContent = copy.getAttribute('data-done-' + lang); }
            copy.classList.add('is-done');
            setTimeout(function () {
              if (label) { label.textContent = copy.getAttribute('data-label-' + lang); }
              copy.classList.remove('is-done');
            }, 1800);
          }
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(url).then(done, function () { window.prompt('URL', url); });
          } else {
            window.prompt('URL', url);
          }
        });
      })(bars[i]);
    }
  }

  function init() {
    initNav();
    initYear();
    initShare();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
