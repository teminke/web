/* encrypt-tool.js — 站長用：在瀏覽器內以密碼加密內容、或更換兩個加密檔的密碼
   （PBKDF2-SHA256 300k + AES-256-GCM；需要 lock.js 提供 TMKLock.decrypt） */
(function () {
  'use strict';
  var FILES = [
    { url: '../assets/staging-data.enc.json', name: 'staging-data.enc.json' },
    { url: '../clinical/staging-atlas.enc.json', name: 'staging-atlas.enc.json' }
  ];
  function b64(buf) { var bytes = new Uint8Array(buf), s = ''; for (var i = 0; i < bytes.length; i++) { s += String.fromCharCode(bytes[i]); } return btoa(s); }
  function encrypt(text, pw, type) {
    var enc = new TextEncoder(); var salt = crypto.getRandomValues(new Uint8Array(16)); var iv = crypto.getRandomValues(new Uint8Array(12));
    return crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveKey']).then(function (base) {
      return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: salt, iterations: 300000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
    }).then(function (key) {
      return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, enc.encode(text));
    }).then(function (ct) {
      return { v: 1, kdf: 'PBKDF2-SHA256', iter: 300000, cipher: 'AES-256-GCM', type: type, salt: b64(salt), iv: b64(iv), ct: b64(ct) };
    });
  }
  function download(payload, filename) {
    var blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  function lang() { return document.documentElement.getAttribute('data-lang') === 'en' ? 'en' : 'zh'; }
  function msg(zh, en) { return lang() === 'en' ? en : zh; }

  /* 二、加密新的內容 */
  var form = document.getElementById('enc-form');
  if (form) {
    var err = form.querySelector('.lock-error');
    form.addEventListener('submit', function (e) {
      e.preventDefault(); err.hidden = true;
      var kind = form.kind.value, content = form.content.value, pw = form.pw.value;
      var type = kind === 'html' ? 'html' : 'json';
      if (type === 'json') { try { content = JSON.stringify(JSON.parse(content)); } catch (ex) { err.textContent = msg('JSON 格式錯誤', 'Invalid JSON'); err.hidden = false; return; } }
      var fname = kind === 'json' ? 'staging-data.enc.json' : 'staging-atlas.enc.json';
      encrypt(content, pw, type).then(function (payload) { download(payload, fname); })
        .catch(function () { err.textContent = msg('加密失敗', 'Encryption failed'); err.hidden = false; });
    });
  }

  /* 一、更換密碼：解開現有兩個檔案，再以新密碼加密 */
  var rekey = document.getElementById('rekey-form');
  if (rekey && window.TMKLock) {
    var rerr = rekey.querySelector('.lock-error'); var status = rekey.querySelector('[data-rekey-status]'); var btn = rekey.querySelector('button');
    rekey.addEventListener('submit', function (e) {
      e.preventDefault(); rerr.hidden = true; status.textContent = '';
      var oldpw = rekey.oldpw.value, newpw = rekey.newpw.value, newpw2 = rekey.newpw2.value;
      if (newpw !== newpw2) { rerr.textContent = msg('兩次輸入的新密碼不一樣', 'The new passwords do not match'); rerr.hidden = false; return; }
      btn.disabled = true; var done = 0;
      var chain = Promise.resolve();
      FILES.forEach(function (f) {
        chain = chain.then(function () {
          status.textContent = msg('處理中：', 'Working on: ') + f.name;
          return fetch(f.url, { cache: 'no-store' }).then(function (r) { if (!r.ok) { throw new Error('HTTP ' + r.status); } return r.json(); })
            .then(function (payload) { return window.TMKLock.decrypt(payload, oldpw).then(function (text) { return encrypt(text, newpw, payload.type || 'json'); }); })
            .then(function (np) { download(np, f.name); done++; });
        });
      });
      chain.then(function () {
        status.textContent = msg('完成，已下載 ' + done + ' 個檔案。請覆蓋 repo 裡的同名檔案。', 'Done: ' + done + ' files downloaded. Replace the files of the same name in the repo.');
        btn.disabled = false;
      }).catch(function () {
        rerr.textContent = msg('失敗：目前的密碼不對，或檔案無法讀取。', 'Failed: the current password is wrong or a file could not be read.'); rerr.hidden = false;
        status.textContent = ''; btn.disabled = false;
      });
    });
  }
})();
