/* =====================================================================
   lock.js — 密碼解鎖（瀏覽器端解密）/ Password unlock with client-side decryption
   檔案以 PBKDF2-SHA256 + AES-256-GCM 加密；沒有密碼的人只拿得到亂碼。
   ===================================================================== */
(function () {
  'use strict';
  var KEY = 'tmk-clinical-pw';
  var I18N = {
    zh: { title: '此頁需要密碼', hint: '此內容已加密，輸入密碼後才會在您的瀏覽器中解開。', label: '密碼', btn: '解鎖', remember: '這次瀏覽期間記住密碼', bad: '密碼不對，或檔案無法解開。', loading: '解密中…', nocrypto: '您的瀏覽器不支援所需的加密功能，請改用新版 Chrome、Edge、Safari 或 Firefox。' },
    en: { title: 'This page needs a password', hint: 'This content is encrypted. It is decrypted in your browser after you enter the password.', label: 'Password', btn: 'Unlock', remember: 'Remember for this browser session', bad: 'Wrong password, or the file could not be decrypted.', loading: 'Decrypting…', nocrypto: 'Your browser lacks the required cryptography support; please use a recent Chrome, Edge, Safari or Firefox.' }
  };
  function lang() { return document.documentElement.getAttribute('data-lang') === 'en' ? 'en' : 'zh'; }
  function t(k) { return I18N[lang()][k]; }
  function b64(s) { var bin = atob(s), arr = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) { arr[i] = bin.charCodeAt(i); } return arr; }

  function decrypt(payload, password) {
    var enc = new TextEncoder();
    return crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']).then(function (base) {
      return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: b64(payload.salt), iterations: payload.iter || 300000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    }).then(function (key) {
      return crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64(payload.iv) }, key, b64(payload.ct));
    }).then(function (buf) { return new TextDecoder().decode(buf); });
  }

  function fetchJSON(url) {
    return fetch(url, { cache: 'force-cache' }).then(function (r) { if (!r.ok) { throw new Error('HTTP ' + r.status); } return r.json(); });
  }

  /* 建立解鎖表單；成功後呼叫 onText(plaintext) */
  function mount(container, url, onText) {
    if (!(window.crypto && crypto.subtle && window.TextEncoder && window.fetch)) {
      container.innerHTML = '<p class="lock-error">' + t('nocrypto') + '</p>';
      return;
    }
    var remembered = null;
    try { remembered = window.sessionStorage.getItem(KEY); } catch (e) { remembered = null; }
    container.innerHTML =
      '<form class="lock-card" autocomplete="off">' +
      '<div class="lock-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="10" width="16" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/><circle cx="12" cy="15.5" r="1.5"/></svg></div>' +
      '<h2 class="lock-title">' + t('title') + '</h2>' +
      '<p class="lock-hint">' + t('hint') + '</p>' +
      '<label class="lock-field"><span>' + t('label') + '</span><input type="password" name="pw" required autocomplete="current-password"></label>' +
      '<label class="lock-remember"><input type="checkbox" name="remember" checked> ' + t('remember') + '</label>' +
      '<div class="lock-actions"><button type="submit" class="btn btn-primary">' + t('btn') + '</button></div>' +
      '<p class="lock-error" role="alert" hidden></p>' +
      '</form>';
    var form = container.querySelector('form'); var input = form.querySelector('input[name=pw]'); var err = form.querySelector('.lock-error'); var btn = form.querySelector('button');
    function attempt(pw, remember) {
      err.hidden = true; btn.disabled = true; btn.textContent = t('loading');
      return fetchJSON(url).then(function (payload) { return decrypt(payload, pw); }).then(function (text) {
        if (remember) { try { window.sessionStorage.setItem(KEY, pw); } catch (e) { /* ignore */ } }
        onText(text);
      }).catch(function () {
        try { window.sessionStorage.removeItem(KEY); } catch (e) { /* ignore */ }
        err.textContent = t('bad'); err.hidden = false; btn.disabled = false; btn.textContent = t('btn'); input.focus(); input.select();
      });
    }
    form.addEventListener('submit', function (e) { e.preventDefault(); attempt(input.value, form.querySelector('input[name=remember]').checked); });
    if (remembered) { input.value = remembered; attempt(remembered, true); } else { input.focus(); }
  }
  window.TMKLock = { mount: mount, decrypt: decrypt, forget: function () { try { window.sessionStorage.removeItem(KEY); } catch (e) { /* ignore */ } } };
})();
