/* =====================================================================
   i18n.js — 整站中英文切換 / Site-wide language toggle
   ---------------------------------------------------------------------
   用法 / Usage:
     <p data-zh="中文內容" data-en="English text">中文內容</p>
     若要切換的是屬性（例如 alt、aria-label、content），加上
     data-i18n-attr="alt"：
     <img data-zh="個人照片" data-en="Portrait" data-i18n-attr="alt" alt="個人照片">

   - 預設語言：localStorage 內的選擇優先；沒有的話依瀏覽器語言判斷
     （zh 開頭顯示中文，否則英文）。
   - 按下 .lang-toggle 按鈕會切換並記住選擇，換頁後維持。
   - 純 JavaScript，無任何相依套件。
   ===================================================================== */
(function () {
  'use strict';

  var STORAGE_KEY = 'tmk-site-lang';
  var HTML_LANG = { zh: 'zh-Hant', en: 'en' };
  var TOGGLE_LABEL = {
    zh: '切換為英文 (Switch to English)',
    en: 'Switch to Traditional Chinese (切換為中文)'
  };

  function storedLang() {
    try {
      var v = window.localStorage.getItem(STORAGE_KEY);
      return (v === 'zh' || v === 'en') ? v : null;
    } catch (e) {
      return null;
    }
  }

  function browserLang() {
    var l = (navigator.languages && navigator.languages[0]) || navigator.language || navigator.userLanguage || '';
    return /^zh/i.test(l) ? 'zh' : 'en';
  }

  function detect() {
    return storedLang() || browserLang();
  }

  function current() {
    return document.documentElement.getAttribute('data-lang') === 'en' ? 'en' : 'zh';
  }

  function apply(lang) {
    if (lang !== 'zh' && lang !== 'en') { lang = 'zh'; }
    var root = document.documentElement;
    root.setAttribute('lang', HTML_LANG[lang]);
    root.setAttribute('data-lang', lang);

    var nodes = document.querySelectorAll('[data-zh], [data-en]');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var value = el.getAttribute('data-' + lang);
      if (value === null) { continue; }
      var attr = el.getAttribute('data-i18n-attr');
      if (attr) {
        el.setAttribute(attr, value);
      } else {
        el.textContent = value;
      }
    }

    var toggles = document.querySelectorAll('.lang-toggle');
    for (var j = 0; j < toggles.length; j++) {
      toggles[j].setAttribute('aria-label', TOGGLE_LABEL[lang]);
      toggles[j].setAttribute('title', TOGGLE_LABEL[lang]);
    }

    try {
      document.dispatchEvent(new CustomEvent('site:langchange', { detail: { lang: lang } }));
    } catch (e) { /* 舊版瀏覽器不支援 CustomEvent，略過 */ }
  }

  function set(lang, persist) {
    apply(lang);
    if (persist) {
      try { window.localStorage.setItem(STORAGE_KEY, lang); } catch (e) { /* 無法寫入時略過 */ }
    }
  }

  function toggle() {
    set(current() === 'zh' ? 'en' : 'zh', true);
  }

  function bindToggles() {
    var toggles = document.querySelectorAll('.lang-toggle');
    for (var i = 0; i < toggles.length; i++) {
      toggles[i].addEventListener('click', toggle);
    }
  }

  window.siteI18n = { apply: apply, set: set, toggle: toggle, current: current, detect: detect };

  function init() {
    apply(detect());
    bindToggles();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
