/* encrypt-tool.js — 站長用：在瀏覽器內以密碼加密內容（PBKDF2-SHA256 300k + AES-256-GCM） */
(function () {
  'use strict';
  var form = document.getElementById('enc-form');
  if (!form) { return; }
  var err = form.querySelector('.lock-error');
  function b64(buf) { var bytes = new Uint8Array(buf), s = ''; for (var i = 0; i < bytes.length; i++) { s += String.fromCharCode(bytes[i]); } return btoa(s); }
  form.addEventListener('submit', function (e) {
    e.preventDefault(); err.hidden = true;
    var kind = form.kind.value, content = form.content.value, pw = form.pw.value;
    var enc = new TextEncoder(); var salt = crypto.getRandomValues(new Uint8Array(16)); var iv = crypto.getRandomValues(new Uint8Array(12));
    if (kind === 'json') { try { content = JSON.stringify(JSON.parse(content)); } catch (ex) { err.textContent = 'JSON 格式錯誤 / Invalid JSON'; err.hidden = false; return; } }
    crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveKey']).then(function (base) {
      return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: salt, iterations: 300000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
    }).then(function (key) {
      return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, enc.encode(content));
    }).then(function (ct) {
      var payload = { v: 1, kdf: 'PBKDF2-SHA256', iter: 300000, cipher: 'AES-256-GCM', type: kind, salt: b64(salt), iv: b64(iv), ct: b64(ct) };
      var blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = kind === 'json' ? 'staging-data.enc.json' : 'staging-atlas.enc.json';
      document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    }).catch(function () { err.textContent = '加密失敗 / Encryption failed'; err.hidden = false; });
  });
})();
