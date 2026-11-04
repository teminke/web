/* =====================================================================
   site.js — 導覽列漢堡選單與小工具 / Nav menu & small helpers
   純 JavaScript，無任何相依套件。
   ===================================================================== */
(function () {
  'use strict';

  var DESKTOP = window.matchMedia('(min-width: 1280px)');

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

  function initChecklists() {
    var lists = document.querySelectorAll('.checklist[data-key]');
    var today = new Date().toISOString().slice(0, 10);
    for (var i = 0; i < lists.length; i++) {
      (function (list) {
        var key = 'tmk-check-' + list.getAttribute('data-key') + '-' + today;
        var boxes = list.querySelectorAll('input[type="checkbox"]');
        var bar = list.querySelector('.bar');
        var done = list.querySelector('.done');
        var reset = list.querySelector('.reset');
        function load() {
          var saved = [];
          try { saved = JSON.parse(window.localStorage.getItem(key) || '[]'); } catch (e) { saved = []; }
          for (var j = 0; j < boxes.length; j++) { boxes[j].checked = saved.indexOf(j) !== -1; }
        }
        function save() {
          var arr = [];
          for (var j = 0; j < boxes.length; j++) { if (boxes[j].checked) { arr.push(j); } }
          try { window.localStorage.setItem(key, JSON.stringify(arr)); } catch (e) { /* ignore */ }
          return arr.length;
        }
        function render() {
          var n = 0;
          for (var j = 0; j < boxes.length; j++) { if (boxes[j].checked) { n++; } }
          if (bar) { bar.style.width = (boxes.length ? Math.round(n * 100 / boxes.length) : 0) + '%'; }
          if (done) { done.textContent = String(n); }
        }
        for (var j = 0; j < boxes.length; j++) {
          boxes[j].addEventListener('change', function () { save(); render(); });
        }
        if (reset) {
          reset.addEventListener('click', function () {
            for (var k = 0; k < boxes.length; k++) { boxes[k].checked = false; }
            save(); render();
          });
        }
        load(); render();
      })(lists[i]);
    }
  }

  /* 部位風險地圖：點選部位或標籤，只顯示該部位的面板 / Site risk map */
  function initSitemaps() {
    var maps = document.querySelectorAll('.sitemap');
    for (var i = 0; i < maps.length; i++) {
      (function (map) {
        var buttons = map.querySelectorAll('.sitemap-tabs button[data-site]');
        var hots = map.querySelectorAll('.hot[data-site]');
        var panels = map.querySelectorAll('.site-panel[data-site]');
        if (!panels.length) { return; }
        function show(site, focusPanel) {
          var found = false;
          for (var p = 0; p < panels.length; p++) {
            var on = panels[p].getAttribute('data-site') === site;
            panels[p].hidden = !on;
            if (on) { found = true; }
          }
          if (!found) { return; }
          for (var b = 0; b < buttons.length; b++) { buttons[b].setAttribute('aria-pressed', buttons[b].getAttribute('data-site') === site ? 'true' : 'false'); }
          for (var h = 0; h < hots.length; h++) {
            if (hots[h].getAttribute('data-site') === site) { hots[h].classList.add('is-active'); } else { hots[h].classList.remove('is-active'); }
          }
          if (focusPanel) {
            var panel = map.querySelector('.site-panel[data-site="' + site + '"]');
            if (panel && panel.scrollIntoView) { panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
          }
        }
        for (var b = 0; b < buttons.length; b++) {
          buttons[b].addEventListener('click', function (e) { show(e.currentTarget.getAttribute('data-site'), true); });
        }
        for (var h = 0; h < hots.length; h++) {
          hots[h].addEventListener('click', function (e) { e.preventDefault(); show(e.currentTarget.getAttribute('data-site'), true); });
        }
        var initial = panels[0].getAttribute('data-site');
        var hash = (window.location.hash || '').replace('#site-', '');
        if (hash && map.querySelector('.site-panel[data-site="' + hash + '"]')) { initial = hash; }
        show(initial, false);
        window.addEventListener('hashchange', function () {
          var h2 = (window.location.hash || '').replace('#site-', '');
          if (h2 && map.querySelector('.site-panel[data-site="' + h2 + '"]')) { show(h2, true); }
        });
      })(maps[i]);
    }
  }

  function init() {
    initNav();
    initYear();
    initShare();
    initChecklists();
    initSitemaps();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
