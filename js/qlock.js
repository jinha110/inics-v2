/*!
 * INICS v2 · qlock.js — 견적서 발행 잠금 (Quote Issue Lock)
 * ---------------------------------------------------------------------------
 * 원칙
 *   고객에게 나간 견적은 덮어쓰지 않는다. 수정이 필요하면 리비전을 만든다.
 *
 * 상태
 *   작성중 · Draft   → 자유 편집
 *   발행 · Issued    → 잠김. 「잠금 해제」로만 풀림 (이력 기록)
 *   계약연결 · Linked → 잠김. 계약 확정을 취소해야 풀림
 *
 * 수정 경로
 *   「사본 생성 · Revise」 → Q-20260728-026-R1 신규 생성, 원본 보존
 *
 * 설치
 *   <script src="js/qlock.js?v=1"></script>   ← quote.js / contract.js 보다 뒤
 *   quote.js 원본은 건드리지 않는다. 이 파일만 빼면 즉시 원복된다.
 * ---------------------------------------------------------------------------
 */
(function (W) {
  'use strict';

  var FIELDS = ['qClient', 'qProject', 'qDate', 'qValid', 'qCurrency', 'qVat', 'qNotes', 'qShowCbm'];

  function N(v) { return (typeof qNum === 'function') ? qNum(v) : (parseFloat(v) || 0); }
  function now() { return (typeof nowStr === 'function') ? nowStr() : new Date().toISOString(); }
  function me() { var u = (typeof cardCurrentUser === 'function') ? cardCurrentUser() : null; return u ? u.name : ''; }
  function toast(m) { if (typeof showToast === 'function') showToast(m); }
  function byId(i) { return document.getElementById(i); }

  /* ── 잠금 상태 판정 ──────────────────────────────────────────────────── */
  /** 이 견적이 확정된 계약에 연결되어 있는가 */
  function linkedConfirmed(q) {
    if (!q) return null;
    var ps = (W.state && state.projects) || [];
    for (var i = 0; i < ps.length; i++) {
      var p = ps[i];
      if (!p.contractConfirmed) continue;
      var o = p.contractOpts || {};
      var hit = String(o.quoteId || '') === String(q.id) ||
                (o.quoteSnap && String(o.quoteSnap.id) === String(q.id));
      if (hit) return p;
    }
    return null;
  }

  function lockInfo(q) {
    if (!q) return { locked: false, kind: 'draft', label: '작성중 · Draft', color: '#64748b' };
    var p = linkedConfirmed(q);
    if (p) {
      return { locked: true, kind: 'linked', proj: p,
               label: '계약연결 · Linked',
               color: '#1d4ed8',
               why: '확정 계약 ' + ((p.contractOpts && p.contractOpts.contractNo) || '') + ' 에 연결됨 — 계약 확정을 취소해야 편집할 수 있습니다' };
    }
    if (q.status === 'issued') {
      return { locked: true, kind: 'issued',
               label: '발행 · Issued',
               color: '#15803d',
               why: (q.issuedAt || '') + ' ' + (q.issuedBy || '') + ' 발행 — 고객 발송본입니다' };
    }
    return { locked: false, kind: 'draft', label: '작성중 · Draft', color: '#64748b' };
  }

  function curQuote() {
    if (!W.editingQuoteId) return null;
    return ((W.state && state.quotes) || []).find(function (x) { return x.id === editingQuoteId; }) || null;
  }
  function curLock() { return lockInfo(curQuote()); }

  /* ── 액션 ────────────────────────────────────────────────────────────── */
  function issueQuote() {
    var q = curQuote();
    if (!q) { toast('먼저 견적을 저장하세요 · Save the quote first'); return; }
    if (lockInfo(q).locked) { toast('이미 잠긴 견적입니다'); return; }
    if (!confirm('견적 ' + (q.quoteNo || '') + ' 을 발행하고 잠글까요?\n\n· 이후 편집이 차단됩니다\n· 수정이 필요하면 「사본 생성」으로 리비전을 만드세요\n\nIssue and lock this quote?')) return;
    q.status = 'issued'; q.issuedAt = now(); q.issuedBy = me();
    if (typeof INICSAmount !== 'undefined') INICSAmount.freeze(q, true);
    saveState(); refresh(); toast('발행 완료 · 편집 잠김 · Issued & locked');
  }

  function unlockQuote() {
    var q = curQuote(); if (!q) return;
    var L = lockInfo(q);
    if (L.kind === 'linked') {
      alert('확정 계약에 연결된 견적입니다.\n계약서에서 「확정 취소」를 먼저 하세요.\n\n' + L.why);
      return;
    }
    var why = prompt('잠금을 해제합니다. 사유를 입력하세요 (이력에 남습니다)\n\n※ 고객 발송본을 덮어쓰게 됩니다. 가능하면 「사본 생성」을 쓰세요.', '');
    if (why === null) return;
    if (!String(why).trim()) { toast('사유를 입력해야 해제됩니다'); return; }
    q.status = 'draft';
    q.unlockLog = q.unlockLog || [];
    q.unlockLog.push({ at: now(), by: me(), why: String(why).trim() });
    saveState(); refresh(); toast('잠금 해제 · 이력 기록됨 · Unlocked');
  }

  /** 다음 리비전 번호: Q-...-026 → Q-...-026-R1 → -R2 */
  function nextRevNo(baseNo) {
    var root = String(baseNo || '').replace(/-R\d+$/, '');
    var max = 0;
    ((W.state && state.quotes) || []).forEach(function (x) {
      var m = String(x.quoteNo || '').match(new RegExp('^' + root.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '-R(\\d+)$'));
      if (m) max = Math.max(max, parseInt(m[1], 10) || 0);
    });
    return root + '-R' + (max + 1);
  }

  function reviseQuote(id) {
    var src = ((W.state && state.quotes) || []).find(function (x) { return x.id === (id != null ? id : editingQuoteId); });
    if (!src) { toast('견적을 찾을 수 없습니다'); return; }
    var no = nextRevNo(src.quoteNo);
    if (!confirm('사본을 만듭니다.\n\n원본: ' + (src.quoteNo || '') + ' (보존)\n사본: ' + no + ' (편집 가능)\n\nCreate a revision?')) return;
    var cp = JSON.parse(JSON.stringify(src));
    cp.id = (state.quoteSeq = (state.quoteSeq || 0) + 1);
    cp.quoteNo = no;
    cp.status = 'draft';
    cp.issuedAt = ''; cp.issuedBy = ''; cp.unlockLog = [];
    cp.revisionOf = src.id; cp.revisionOfNo = src.quoteNo || '';
    cp.createdAt = now(); cp.updatedAt = '';
    cp.date = (typeof projTodayISO === 'function') ? projTodayISO() : cp.date;
    state.quotes.push(cp);
    saveState();
    if (typeof loadQuote === 'function') loadQuote(cp.id);
    refresh();
    toast('사본 생성 · ' + no);
  }

  /* ── 화면 반영 ───────────────────────────────────────────────────────── */
  function banner(L) {
    var host = byId('quoteLinesBox');
    if (!host || !host.parentNode) return;
    var b = byId('qLockBanner');
    if (!L.locked) { if (b) b.style.display = 'none'; return; }
    if (!b) {
      b = document.createElement('div');
      b.id = 'qLockBanner';
      b.style.cssText = 'margin:0 0 10px;padding:8px 12px;border-radius:6px;font-size:12px;line-height:1.6;display:flex;align-items:center;gap:10px;flex-wrap:wrap';
      host.parentNode.insertBefore(b, host);
    }
    var bg = L.kind === 'linked' ? '#eff6ff' : '#f0fdf4';
    var bd = L.kind === 'linked' ? '#bfdbfe' : '#bbf7d0';
    b.style.background = bg; b.style.border = '1px solid ' + bd; b.style.color = L.color;
    b.style.display = 'flex';
    b.innerHTML = '<b style="flex:0 0 auto"><i class="ti ti-lock"></i> ' + L.label + '</b>'
      + '<span style="flex:1 1 auto;color:var(--text-2);min-width:200px">' + (L.why || '') + '</span>'
      + '<button class="btn btn-dark" style="font-size:11px;padding:4px 10px;flex:0 0 auto" onclick="qlockRevise()"><i class="ti ti-copy"></i> 사본 생성 · Revise</button>'
      + (L.kind === 'issued'
          ? '<button class="btn btn-outline" style="font-size:11px;padding:4px 10px;flex:0 0 auto" onclick="qlockUnlock()"><i class="ti ti-lock-open"></i> 잠금 해제</button>'
          : '');
  }

  function toolbar(L) {
    var save = document.querySelector('button[onclick="saveQuote()"]');
    if (!save || !save.parentNode) return;
    var btn = byId('qIssueBtn');
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'qIssueBtn';
      btn.className = 'btn btn-outline';
      save.parentNode.insertBefore(btn, save.nextSibling);
    }
    if (L.locked) {
      btn.innerHTML = '<i class="ti ti-copy"></i> 사본 생성 · Revise';
      btn.onclick = function () { reviseQuote(); };
      btn.style.color = ''; btn.style.borderColor = '';
    } else {
      btn.innerHTML = '<i class="ti ti-lock"></i> 발행 · Issue';
      btn.onclick = issueQuote;
      btn.style.color = '#15803d'; btn.style.borderColor = '#86efac';
    }
    btn.style.display = W.editingQuoteId ? '' : 'none';
    save.disabled = !!L.locked;
    save.style.opacity = L.locked ? '.45' : '';
    save.style.cursor = L.locked ? 'not-allowed' : '';
    save.title = L.locked ? '잠긴 견적입니다 — 사본을 생성하세요' : '';
  }

  function fields(L) {
    FIELDS.forEach(function (id) {
      var e = byId(id); if (!e) return;
      e.disabled = !!L.locked;
      e.style.opacity = L.locked ? '.6' : '';
    });
    var box = byId('quoteLinesBox');
    if (box) {
      box.querySelectorAll('input,select,textarea,button').forEach(function (e) {
        if (L.locked) { e.setAttribute('data-qlock', '1'); e.disabled = true; }
        else if (e.getAttribute('data-qlock')) { e.removeAttribute('data-qlock'); e.disabled = false; }
      });
      box.style.opacity = L.locked ? '.72' : '';
    }
    var add = document.querySelector('button[onclick^="addQuoteLine"]');
    if (add) { add.disabled = !!L.locked; add.style.opacity = L.locked ? '.45' : ''; }
  }

  function refresh() {
    var L = curLock();
    try { banner(L); toolbar(L); fields(L); } catch (e) { console.warn('[qlock] UI', e); }
    if (typeof renderSavedQuotes === 'function' && !W._qlockInSaved) {
      W._qlockInSaved = true; try { renderSavedQuotes(); } finally { W._qlockInSaved = false; }
    }
  }

  /* ── 기존 함수 래핑 (quote.js 원본 무수정) ───────────────────────────── */
  function guard(name, msg) {
    var orig = W[name];
    if (typeof orig !== 'function') return;
    W[name] = function () {
      if (curLock().locked) { toast(msg); refresh(); return; }
      return orig.apply(this, arguments);
    };
  }

  function after(name, fn) {
    var orig = W[name];
    if (typeof orig !== 'function') return;
    W[name] = function () {
      var r = orig.apply(this, arguments);
      try { fn.apply(this, arguments); } catch (e) { console.warn('[qlock] ' + name, e); }
      return r;
    };
  }

  function install() {
    if (W._qlockReady) return;
    if (typeof W.saveQuote !== 'function' || typeof W.renderQuoteLines !== 'function') return;
    W._qlockReady = true;

    var LOCKED = '잠긴 견적입니다 — 「사본 생성」으로 수정하세요';
    guard('saveQuote', LOCKED);
    guard('addQuoteLine', LOCKED);
    guard('removeQuoteLine', LOCKED);
    guard('moveQuoteLine', LOCKED);
    guard('deleteQuote', '잠긴 견적은 삭제할 수 없습니다');

    after('renderQuoteLines', refresh);
    after('loadQuote', refresh);
    after('newQuote', refresh);

    /* 저장 목록에 상태 배지 + 사본 버튼 */
    after('renderSavedQuotes', function () {
      var el = byId('quoteSavedList'); if (!el) return;
      el.querySelectorAll('button[onclick^="loadQuote("]').forEach(function (b) {
        var m = String(b.getAttribute('onclick') || '').match(/loadQuote\((\d+)\)/);
        if (!m) return;
        var q = ((W.state && state.quotes) || []).find(function (x) { return String(x.id) === m[1]; });
        if (!q) return;
        var L = lockInfo(q);
        var tr = b.closest('tr'); if (!tr || tr.querySelector('.qlock-badge')) return;
        var noCell = tr.children[1];
        if (noCell) {
          noCell.insertAdjacentHTML('beforeend',
            '<div class="qlock-badge" style="font-size:9.5px;font-weight:700;margin-top:2px;color:' + L.color + '">'
            + (L.locked ? '<i class="ti ti-lock"></i> ' : '') + L.label
            + (q.revisionOfNo ? ('<span style="font-weight:400;color:var(--text-3)"> ← ' + q.revisionOfNo + '</span>') : '')
            + '</div>');
        }
        if (L.locked) {
          b.innerHTML = '<i class="ti ti-eye"></i> 보기 · View';
          b.insertAdjacentHTML('afterend',
            ' <button class="btn btn-outline" style="font-size:10px;padding:3px 8px" onclick="qlockRevise(' + q.id + ')"><i class="ti ti-copy"></i> 사본</button>');
          var del = tr.querySelector('button[onclick^="deleteQuote("]');
          if (del) { del.disabled = true; del.style.opacity = '.35'; del.title = '잠긴 견적'; }
        }
      });
    });

    W.qlockIssue = issueQuote;
    W.qlockUnlock = unlockQuote;
    W.qlockRevise = reviseQuote;
    W.qlockInfo = lockInfo;
    W.qlockRefresh = refresh;

    refresh();
    console.log('[qlock] 견적 발행 잠금 활성화');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
  setTimeout(install, 600);
  setTimeout(install, 2000);

})(window);
