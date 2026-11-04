/* =====================================================================
   staging.js — 癌症分期計算機 / Cancer staging calculator
   資料來源：assets/staging-data.js（由個人筆記整理）。純前端，無相依套件。
   ===================================================================== */
(function () {
  'use strict';
  var D = window.STAGING_DATA;
  if (!D) { return; }
  var app = document.getElementById('staging-app');
  if (!app) { return; }

  var I18N = {
    zh: { site: '癌別', search: '搜尋癌別…', variant: '分期表', result: '分期結果', pick: '請在矩陣中點選 T 列與 N 欄（或直接點格子）', pickList: '請選擇各軸條件', stage: '分期',
          copy: '複製結果', copied: '已複製', reset: '重設', refs: '定義與參考表', tips: '筆記提示', any: '任何', none: '此癌別目前只有參考表，沒有可點選的分期矩陣。',
          matched: '符合的列', nomatch: '沒有符合的組合，請調整條件。', multi: '有多列符合，請再補充條件。', source: '資料來源：個人筆記「癌症分期速記大圖冊」整理；請以 AJCC／NCCN 原文為準。',
          row: 'T（列）', col: 'N（欄）', groupRef: '參考表' },
    en: { site: 'Cancer site', search: 'Search site…', variant: 'Staging table', result: 'Result', pick: 'Click a T row and an N column in the matrix (or click a cell)', pickList: 'Choose the criteria for each axis', stage: 'Stage',
          copy: 'Copy result', copied: 'Copied', reset: 'Reset', refs: 'Definitions and reference tables', tips: 'Notes', any: 'Any', none: 'This site has reference tables only; no clickable matrix.',
          matched: 'Matching rows', nomatch: 'No matching combination; adjust the criteria.', multi: 'Several rows match; add more criteria.', source: 'Source: compiled from personal notes (staging atlas). Refer to AJCC/NCCN originals.',
          row: 'T (row)', col: 'N (column)', groupRef: 'Reference' }
  };
  function lang() { return document.documentElement.getAttribute('data-lang') === 'en' ? 'en' : 'zh'; }
  function t(k) { return I18N[lang()][k]; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function el(html) { var tpl = document.createElement('template'); tpl.innerHTML = html.trim(); return tpl.content.firstElementChild; }

  var state = { site: null, variant: 0, row: null, col: null, sel: {} };
  var GROUP_ORDER = ['hn', 'thorax', 'breast', 'gi', 'gu', 'gyn', 'skin', 'other', 'heme', 'peds'];

  // ---------- 條件比對 / condition matching ----------
  function norm(s) { return String(s || '').replace(/\s+/g, '').replace(/／/g, '/').replace(/[、,，]/g, '/').replace(/[—–－]/g, '-').replace(/（[^）]*）|\([^)]*\)/g, ''); }
  function isAny(s) { s = norm(s); return s === '' || /^(any|anyt|anyn|anym|任何|任一|全部|all|n\/a|-)$/i.test(s) || /^(any|任何|任一)/i.test(s); }
  function codeKey(code) {
    var m = norm(code).replace(/^(c|p|yp)/, '').match(/^([TNMSG]|GG)?(\d+)?([a-z]*)?/i);
    if (!m) { return null; }
    return { letter: (m[1] || '').toUpperCase(), num: m[2] === undefined ? -1 : parseInt(m[2], 10), suf: (m[3] || '').toLowerCase() };
  }
  function cmpKey(a, b) { if (a.num !== b.num) { return a.num - b.num; } if (a.suf === b.suf) { return 0; } return a.suf < b.suf ? -1 : 1; }
  function tokenMatches(tok, sel) {
    tok = norm(tok); sel = norm(sel);
    if (!tok || isAny(tok)) { return true; }
    if (/^(tis|pTis|ta|tx|nx|n0\(i\+\)|m0|m1|m1a|m1b|m1c|m1d|is)$/i.test(tok)) { return tok.toLowerCase() === sel.toLowerCase() || (tok.toLowerCase() === 'm1' && /^m1/i.test(sel)); }
    var range = tok.match(/^([a-zA-Z]*)(\d+)([a-z]*)-([a-zA-Z]*)?(\d+)?([a-z]*)$/i);
    var sk = codeKey(sel);
    if (range && sk) {
      var lo = { num: parseInt(range[2], 10), suf: range[3] || '' };
      var hiNum = range[5] !== undefined ? parseInt(range[5], 10) : lo.num;
      var hi = { num: hiNum, suf: range[6] ? range[6] : 'zzz' };
      if (range[6] && range[5] === undefined) { hi.num = lo.num; }
      return cmpKey(sk, lo) >= 0 && cmpKey(sk, hi) <= 0;
    }
    var tk = codeKey(tok);
    if (tk && sk && tk.num >= 0) {
      if (tk.num !== sk.num) { return false; }
      if (!tk.suf) { return true; }
      return tk.suf === sk.suf;
    }
    return tok.toLowerCase() === sel.toLowerCase();
  }
  function condMatches(cond, sel, axis) {
    if (isAny(sel)) { return true; }
    var c = norm(cond);
    if (isAny(c)) { return true; }
    if (/psa/i.test(axis) || /^[<>≥≤]?\d/.test(c) && /psa/i.test(axis)) { return numericMatch(c, sel); }
    if (/^(gg|grade group|g)$/i.test(norm(axis)) || /^g[1-4x]/i.test(c) && /^g/i.test(axis)) {
      return gradeMatch(c, sel);
    }
    var alts = c.split('/'); var base = null;
    for (var i = 0; i < alts.length; i++) {
      var a = alts[i].replace(/^(c|p|yp)/, '');
      var bm = a.match(/^([TNMS]\d+)[a-z]*$/i); if (bm) { base = bm[1]; }
      if (/^[a-z]$/i.test(a) && base) { a = base + a; }
      // "T1a-c" style suffix ranges, "cT1a-c" ; "1-4" numeric for GG
      if (/^\d+(-\d+)?$/.test(a)) { return gradeMatch(c, sel); }
      if (tokenMatches(a, sel)) { return true; }
    }
    return false;
  }
  function numericMatch(c, sel) {
    var ss = norm(sel); var x;
    var mm = ss.match(/(\d+(?:\.\d+)?)/g);
    if (!mm) { return true; }
    if (/^</.test(ss)) { x = parseFloat(mm[0]) - 0.5; }
    else if (mm.length >= 2) { x = (parseFloat(mm[0]) + parseFloat(mm[1])) / 2; }
    else if (/^[≥>]/.test(ss)) { x = parseFloat(mm[0]) + 0.5; }
    else { x = parseFloat(mm[0]); }
    if (isNaN(x)) { return true; }
    var ok = true, parts = c.match(/([<>≥≤]?)(\d+(?:\.\d+)?)/g) || [];
    for (var i = 0; i < parts.length; i++) {
      var m = parts[i].match(/([<>≥≤]?)(\d+(?:\.\d+)?)/); var op = m[1], n = parseFloat(m[2]);
      if (op === '<') { ok = ok && x < n; }
      else if (op === '≤') { ok = ok && x <= n; }
      else if (op === '>') { ok = ok && x > n; }
      else if (op === '≥') { ok = ok && x >= n; }
      else { ok = ok && (i === 0 ? x >= n : x < n); }
    }
    return ok;
  }
  function gradeMatch(c, sel) {
    var s = parseInt(String(sel).replace(/[^\d]/g, ''), 10);
    if (isNaN(s)) { return norm(sel).toLowerCase() === c.toLowerCase(); }
    var alts = c.split('/'); var ok = false;
    for (var i = 0; i < alts.length; i++) {
      var m = alts[i].match(/(\d+)(?:-(\d+))?/);
      if (!m) { if (/x/i.test(alts[i]) && /x/i.test(sel)) { ok = true; } continue; }
      var lo = parseInt(m[1], 10), hi = m[2] ? parseInt(m[2], 10) : lo;
      if (s >= lo && s <= hi) { ok = true; }
    }
    return ok;
  }

  // ---------- 選項收集 / option collection ----------
  function splitCombo(code) {
    var out = [], c = norm(code);
    if (!c || isAny(c)) { return out; }
    var parts = c.split('/');
    var base = null;
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      var m = p.match(/^([cp]?[TNMS])(\d+)([a-z]*)$/i);
      if (m) { base = m[1] + m[2]; out.push(p); }
      else if (/^[a-z]$/i.test(p) && base) { out.push(base + p); }
      else if (/^[TNMS]\d/i.test(p)) { out.push(p); }
    }
    return out;
  }
  function expandRange(tok) {
    var out = [], c = norm(tok);
    var r = c.match(/^([TNMS])(\d+)-(\d+)$/i);
    if (r) { for (var n = parseInt(r[2], 10); n <= parseInt(r[3], 10); n++) { out.push(r[1].toUpperCase() + n); } return out; }
    var r2 = c.match(/^([TNMS]\d+)([a-z])-([a-z])$/i);
    if (r2) { for (var ch = r2[2].charCodeAt(0); ch <= r2[3].charCodeAt(0); ch++) { out.push(r2[1] + String.fromCharCode(ch)); } return out; }
    return splitCombo(c);
  }
  function axisLetter(h) { var n = norm(h).toUpperCase(); var m = n.match(/^(C|P|YP)?([TNMS])$/); return m ? m[2] : (/PSA/i.test(n) ? 'PSA' : (/^GG|GRADE|^G$/i.test(n) ? 'G' : null)); }
  function optionsFor(site, list, colIdx) {
    var header = list.rows[0][colIdx]; var letter = axisLetter(header);
    var set = {}; var order = [];
    function add(v) { v = norm(v); if (!v || isAny(v) || set[v]) { return; } set[v] = 1; order.push(v); }
    if (letter && letter.length === 1) {
      site.tables.forEach(function (tb) {
        var h0 = norm(tb.rows[0] && tb.rows[0][0] || '').toUpperCase();
        if (h0 === letter || h0 === '分期' || h0 === 'C' + letter || h0 === 'P' + letter || h0 === letter + '分期') {
          tb.rows.slice(1).forEach(function (r) {
            var c = r[0]; if (!c) { return; }
            if (new RegExp('^[cp]?' + letter + '\\d', 'i').test(norm(c)) || /^(tis|ta|tx|nx)$/i.test(norm(c))) {
              var ex = expandRange(c); if (ex.length) { ex.forEach(add); } else { add(c.split('（')[0]); }
            }
          });
        }
      });
    }
    list.rows.slice(1).forEach(function (r) {
      var v = r[colIdx]; if (!v) { return; }
      var alts = norm(v).split('/');
      alts.forEach(function (a) {
        a = a.replace(/^(c|p|yp)/, '');
        if (letter === 'PSA' || letter === 'G') { if (!isAny(a)) { add(a); } return; }
        var ex = expandRange(a); if (ex.length) { ex.forEach(add); } else if (!isAny(a)) { add(a); }
      });
    });
    if (letter === 'PSA') { order = ['<10', '10-<20', '≥20']; }
    if (letter === 'G' && order.every(function (o) { return /^\d/.test(o) || /x/i.test(o); })) {
      var mx = 0; order.forEach(function (o) { var m = o.match(/\d+/g); if (m) { m.forEach(function (n) { mx = Math.max(mx, parseInt(n, 10)); }); } });
      order = []; for (var g = 1; g <= Math.max(mx, 3); g++) { order.push(String(g)); } if (set['gx'] || set['GX']) { order.push('GX'); }
    }
    if (letter && letter.length === 1) {
      order.sort(function (a, b) { var ka = codeKey(a), kb = codeKey(b); if (!ka || !kb) { return a < b ? -1 : 1; } if (ka.num === -1 || kb.num === -1) { return ka.num - kb.num; } return cmpKey(ka, kb); });
    }
    return order;
  }

  // ---------- 渲染 / rendering ----------
  function siteById(id) { for (var i = 0; i < D.sites.length; i++) { if (D.sites[i].id === id) { return D.sites[i]; } } return null; }
  function name(site) { return lang() === 'en' ? site.en + '（' + site.zh + '）' : site.zh + '（' + site.en + '）'; }
  function variants(site) { return site.matrices.map(function (m) { return { kind: 'matrix', data: m }; }).concat(site.lists.map(function (l) { return { kind: 'list', data: l }; })); }
  function vlabel(v, i) { var d = v.data; return (d.caption || d.panel || '').replace(/^[一二三四五六七八九十]+、/, '') || (t('variant') + ' ' + (i + 1)); }

  function render() {
    var L = lang();
    app.innerHTML = '';
    var bar = el('<div class="st-toolbar"></div>');
    var sel = el('<label class="st-field"><span>' + esc(t('site')) + '</span><select id="st-site"></select></label>');
    var select = sel.querySelector('select');
    GROUP_ORDER.forEach(function (g) {
      var og = document.createElement('optgroup'); og.label = L === 'en' ? D.groups[g][1] : D.groups[g][0];
      D.sites.filter(function (s) { return s.group === g; }).forEach(function (s) {
        var o = document.createElement('option'); o.value = s.id; o.textContent = name(s); if (state.site && state.site.id === s.id) { o.selected = true; } og.appendChild(o);
      });
      select.appendChild(og);
    });
    if (!state.site) { var o0 = document.createElement('option'); o0.value = ''; o0.textContent = '—'; o0.selected = true; select.insertBefore(o0, select.firstChild); }
    select.addEventListener('change', function () { setSite(select.value); });
    bar.appendChild(sel);
    var search = el('<label class="st-field"><span>' + esc(t('search')) + '</span><input type="search" id="st-search" autocomplete="off"></label>');
    var input = search.querySelector('input'); var list = el('<ul class="st-hits"></ul>');
    input.addEventListener('input', function () {
      var q = input.value.trim().toLowerCase(); list.innerHTML = '';
      if (!q) { return; }
      D.sites.filter(function (s) { return (s.zh + s.en + s.source).toLowerCase().indexOf(q) !== -1; }).slice(0, 8).forEach(function (s) {
        var li = el('<li><button type="button">' + esc(name(s)) + '</button></li>');
        li.querySelector('button').addEventListener('click', function () { setSite(s.id); });
        list.appendChild(li);
      });
    });
    search.appendChild(list); bar.appendChild(search);
    app.appendChild(bar);
    if (!state.site) { app.appendChild(el('<p class="st-hint">' + esc(t('pick')) + '</p>')); return; }

    var site = state.site; var vs = variants(site);
    var head = el('<div class="st-head"><h2>' + esc(name(site)) + '</h2>' + (site.sub ? '<p class="st-sub">' + esc(site.sub) + '</p>' : '') + '</div>');
    app.appendChild(head);
    if (vs.length > 1) {
      var tabs = el('<div class="st-tabs" role="tablist"></div>');
      vs.forEach(function (v, i) {
        var b = el('<button type="button" role="tab" class="st-tab' + (i === state.variant ? ' is-on' : '') + '" aria-selected="' + (i === state.variant) + '">' + esc(vlabel(v, i)) + '</button>');
        b.addEventListener('click', function () { state.variant = i; state.row = null; state.col = null; state.sel = {}; render(); });
        tabs.appendChild(b);
      });
      app.appendChild(tabs);
    }
    var main = el('<div class="st-main"></div>');
    var calc = el('<div class="st-calc"></div>'); var result = el('<div class="st-result"></div>');
    main.appendChild(calc); main.appendChild(result); app.appendChild(main);
    if (!vs.length) { calc.appendChild(el('<p class="st-hint">' + esc(t('none')) + '</p>')); }
    else if (vs[state.variant].kind === 'matrix') { renderMatrix(vs[state.variant].data, calc, result, vs.length > 1 ? vlabel(vs[state.variant], state.variant) : ''); }
    else { renderList(site, vs[state.variant].data, calc, result, vs.length > 1 ? vlabel(vs[state.variant], state.variant) : ''); }
    app.appendChild(renderTables(site));
    if (site.tips.length) { app.appendChild(renderTips(site)); }
    app.appendChild(el('<p class="st-source">' + esc(t('source')) + '</p>'));
  }

  function stageText(s) { return String(s || '').replace(/\s*期$/, ''); }
  function renderMatrix(m, calc, result, label) {
    var rows = m.rows; var hdr = rows[0];
    var tbl = el('<table class="st-matrix"><thead><tr></tr></thead><tbody></tbody></table>');
    var trh = tbl.querySelector('thead tr');
    trh.appendChild(el('<th scope="col" class="st-corner">' + esc(hdr[0] || '') + '</th>'));
    for (var c = 1; c < hdr.length; c++) {
      var th = el('<th scope="col"><button type="button" class="st-col' + (state.col === c ? ' is-on' : '') + '">' + esc(hdr[c]) + '</button></th>');
      (function (ci) { th.querySelector('button').addEventListener('click', function () { state.col = ci; render(); }); })(c);
      trh.appendChild(th);
    }
    var tb = tbl.querySelector('tbody');
    for (var r = 1; r < rows.length; r++) {
      var tr = document.createElement('tr');
      var rh = el('<th scope="row"><button type="button" class="st-row' + (state.row === r ? ' is-on' : '') + '">' + esc(rows[r][0]) + '</button></th>');
      (function (ri) { rh.querySelector('button').addEventListener('click', function () { state.row = ri; if (state.col === null && rows[ri].length === 2) { state.col = 1; } render(); }); })(r);
      tr.appendChild(rh);
      for (var c2 = 1; c2 < hdr.length; c2++) {
        var v = rows[r][c2] || '—'; var dead = /^[—\-–]$/.test(v.trim());
        var on = state.row === r && state.col === c2;
        var td = el('<td><button type="button" class="st-cell' + (on ? ' is-on' : '') + (state.row === r || state.col === c2 ? ' is-line' : '') + '"' + (dead ? ' disabled' : '') + '>' + esc(v) + '</button></td>');
        (function (ri, ci) { td.querySelector('button').addEventListener('click', function () { state.row = ri; state.col = ci; render(); }); })(r, c2);
        tr.appendChild(td);
      }
      tb.appendChild(tr);
    }
    calc.appendChild(el('<div class="st-scroll"></div>')).appendChild(tbl);
    var out;
    if (state.row !== null && state.col !== null && rows[state.row]) {
      var v2 = rows[state.row][state.col];
      out = '<p class="st-label">' + esc(t('result')) + (label ? ' · ' + esc(label) : '') + '</p>' +
            '<p class="st-stage"><span>' + esc(t('stage')) + '</span> <strong>' + esc(stageText(v2)) + '</strong></p>' +
            '<p class="st-picked">' + esc(rows[state.row][0]) + ' × ' + esc(hdr[state.col]) + '</p>' +
            '<div class="st-actions"><button type="button" class="btn btn-primary st-copy">' + esc(t('copy')) + '</button><button type="button" class="btn btn-ghost st-reset">' + esc(t('reset')) + '</button></div>';
      result.innerHTML = out;
      var txt = name(state.site) + (label ? ' [' + label + '] ' : ' ') + rows[state.row][0] + ' × ' + hdr[state.col] + ' → Stage ' + stageText(v2);
      bindActions(result, txt);
    } else {
      result.innerHTML = '<p class="st-label">' + esc(t('result')) + '</p><p class="st-hint">' + esc(t('pick')) + '</p>';
    }
  }

  function renderList(site, l, calc, result, label) {
    var rows = l.rows; var hdr = rows[0];
    var form = el('<div class="st-form"></div>');
    for (var c = 1; c < hdr.length; c++) {
      var opts = optionsFor(site, l, c);
      var f = el('<label class="st-field"><span>' + esc(hdr[c]) + '</span><select></select></label>');
      var s = f.querySelector('select');
      s.appendChild(el('<option value="">' + esc(t('any')) + '</option>'));
      opts.forEach(function (o) { var op = document.createElement('option'); op.value = o; op.textContent = o; if (state.sel[c] === o) { op.selected = true; } s.appendChild(op); });
      (function (ci, selEl) { selEl.addEventListener('change', function () { state.sel[ci] = selEl.value; render(); }); })(c, s);
      form.appendChild(f);
    }
    calc.appendChild(form);
    var matches = [];
    for (var r = 1; r < rows.length; r++) {
      var ok = true;
      for (var c2 = 1; c2 < hdr.length; c2++) {
        var want = state.sel[c2]; if (!want) { continue; }
        if (!condMatches(rows[r][c2], want, hdr[c2])) { ok = false; break; }
      }
      if (ok) { matches.push(r); }
    }
    var anySel = Object.keys(state.sel).some(function (k) { return state.sel[k]; });
    var tbl = el('<table class="st-list"><thead><tr>' + hdr.map(function (h) { return '<th scope="col">' + esc(h) + '</th>'; }).join('') + '</tr></thead><tbody></tbody></table>');
    var tb = tbl.querySelector('tbody');
    for (var r2 = 1; r2 < rows.length; r2++) {
      var hit = anySel && matches.indexOf(r2) !== -1;
      tb.appendChild(el('<tr class="' + (hit ? 'is-hit' : (anySel ? 'is-dim' : '')) + '">' + rows[r2].map(function (c3, i) { return i === 0 ? '<th scope="row">' + esc(c3) + '</th>' : '<td>' + esc(c3) + '</td>'; }).join('') + '</tr>'));
    }
    calc.appendChild(el('<div class="st-scroll"></div>')).appendChild(tbl);
    var out = '<p class="st-label">' + esc(t('result')) + (label ? ' · ' + esc(label) : '') + '</p>';
    if (!anySel) { out += '<p class="st-hint">' + esc(t('pickList')) + '</p>'; result.innerHTML = out; return; }
    var stages = []; matches.forEach(function (r3) { var sv = stageText(rows[r3][0]); if (stages.indexOf(sv) === -1) { stages.push(sv); } });
    if (!stages.length) { out += '<p class="st-hint">' + esc(t('nomatch')) + '</p>'; }
    else {
      out += '<p class="st-stage"><span>' + esc(t('stage')) + '</span> <strong>' + esc(stages.join(' / ')) + '</strong></p>';
      if (stages.length > 1) { out += '<p class="st-hint">' + esc(t('multi')) + '</p>'; }
      var picked = []; for (var c4 = 1; c4 < hdr.length; c4++) { if (state.sel[c4]) { picked.push(hdr[c4] + ' ' + state.sel[c4]); } }
      out += '<p class="st-picked">' + esc(picked.join(' · ')) + '</p>';
    }
    out += '<div class="st-actions"><button type="button" class="btn btn-primary st-copy">' + esc(t('copy')) + '</button><button type="button" class="btn btn-ghost st-reset">' + esc(t('reset')) + '</button></div>';
    result.innerHTML = out;
    var picked2 = []; for (var c5 = 1; c5 < hdr.length; c5++) { if (state.sel[c5]) { picked2.push(hdr[c5] + ' ' + state.sel[c5]); } }
    bindActions(result, name(site) + (label ? ' [' + label + '] ' : ' ') + picked2.join(', ') + ' → Stage ' + stages.join('/'));
  }

  function bindActions(result, text) {
    var copy = result.querySelector('.st-copy'); var reset = result.querySelector('.st-reset');
    if (copy) { copy.addEventListener('click', function () {
      function done() { copy.textContent = t('copied'); setTimeout(function () { copy.textContent = t('copy'); }, 1500); }
      if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(done, function () { window.prompt('', text); }); } else { window.prompt('', text); }
    }); }
    if (reset) { reset.addEventListener('click', function () { state.row = null; state.col = null; state.sel = {}; render(); }); }
  }

  function selectedCodes() {
    var codes = [];
    var vs = state.site ? variants(state.site) : [];
    var v = vs[state.variant];
    if (v && v.kind === 'matrix' && state.row !== null) { codes.push(v.data.rows[state.row][0]); if (state.col !== null) { codes.push(v.data.rows[0][state.col]); } }
    if (v && v.kind === 'list') { Object.keys(state.sel).forEach(function (k) { if (state.sel[k]) { codes.push(state.sel[k]); } }); }
    return codes.map(function (c) { return norm(c).replace(/^(c|p|yp)/, '').split('/')[0].toLowerCase(); }).filter(Boolean);
  }
  function renderTables(site) {
    var wrap = el('<details class="acc st-refs" open><summary>' + esc(t('refs')) + '</summary><div class="acc-body"></div></details>');
    var body = wrap.querySelector('.acc-body'); var codes = selectedCodes();
    site.tables.forEach(function (tb) {
      var cap = (tb.panel || '') + (tb.caption ? ' — ' + tb.caption : '');
      var tbl = el('<figure class="st-fig"><figcaption>' + esc(cap) + '</figcaption><div class="st-scroll"><table class="st-ref"><tbody></tbody></table></div></figure>');
      var tbody = tbl.querySelector('tbody');
      tb.rows.forEach(function (r, i) {
        var first = norm(r[0] || '').replace(/^(c|p|yp)/, '').toLowerCase();
        var hit = i > 0 && codes.some(function (cd) { return cd && (first === cd || first.split('/').indexOf(cd) !== -1 || (cd.length > 1 && first.indexOf(cd) === 0 && /^[tnms]\d/.test(cd))); });
        var tr = document.createElement('tr'); if (hit) { tr.className = 'is-hit'; }
        r.forEach(function (c, j) { tr.appendChild(el('<' + (i === 0 || j === 0 ? 'th' : 'td') + '>' + esc(c) + '</' + (i === 0 || j === 0 ? 'th' : 'td') + '>')); });
        tbody.appendChild(tr);
      });
      body.appendChild(tbl);
    });
    return wrap;
  }
  function renderTips(site) {
    var wrap = el('<details class="acc st-tips"><summary>' + esc(t('tips')) + '</summary><div class="acc-body"></div></details>');
    var body = wrap.querySelector('.acc-body');
    site.tips.forEach(function (tp) { body.appendChild(el('<div class="st-tip"><strong>' + esc(tp.panel) + '</strong><p>' + esc(tp.text) + '</p></div>')); });
    return wrap;
  }
  function setSite(id) {
    state.site = siteById(id); state.variant = 0; state.row = null; state.col = null; state.sel = {};
    try { history.replaceState(null, '', '#' + (id || '')); } catch (e) { /* ignore */ }
    render();
    var h = app.querySelector('.st-head'); if (h && h.scrollIntoView) { h.scrollIntoView({ block: 'start', behavior: 'smooth' }); }
  }
  window.STAGING_DEBUG = { condMatches: condMatches, tokenMatches: tokenMatches, codeKey: codeKey, isAny: isAny, norm: norm, state: state };
  document.addEventListener('site:langchange', render);
  var initial = (location.hash || '').replace('#', '');
  if (initial && siteById(initial)) { state.site = siteById(initial); }
  render();
})();
