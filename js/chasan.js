/* ════════════════════════════════════════════════════════════
   INICS · chasan.js — 부서 채산 (현금주의) · 4부서 + 인원별 인건비 + EXTRA
   부서: FUR VN / FUR MX / SOURCING / COMMON
   · 매출/COGS/OpEx = state.bankTxns (현금)  · 부서 = t.chasanDept → map(t.dept)
   · 인건비 = HR 대장 tc, **인원별 가중치**(chasan_labor_weights) → 4부서 분배
   · EXTRA = 타법인 부담 비용 수기입력(chasan_extra/{ym}), 부서별 별도 라인
   · COMMON 자체 컬럼(+배분 토글) · VND기준·USD토글 · 마감가드 · 스냅샷
   · hr.js가 자가 로드. renderChasanPage() 또는 renderChasan(ym, host).
   ════════════════════════════════════════════════════════════ */
(function () {
  var RTDB = "https://inics-approval-default-rtdb.asia-southeast1.firebasedatabase.app";
  function csUrl(p) { return RTDB + p + ".json"; }
  function F(n) { return typeof hrFmt === "function" ? hrFmt(n) : Math.round(n || 0).toLocaleString("en-US"); }
  function E(s) { return typeof hrEsc === "function" ? hrEsc(s) : String(s == null ? "" : s); }

  var DEPTS = ["FUR VN", "FUR MX", "SOURCING", "COMMON"];
  var REVENUE_DEPTS = ["FUR VN", "FUR MX", "SOURCING"];
  var CURRENCIES = ["VND", "USD", "MXN", "KRW"];

  window.CHASAN_CFG = {
    depts: DEPTS,
    furnitureDefault: "FUR VN",
    laborSplit: { "FUR VN": 1, "FUR MX": 0 },   // 인원별 가중치 없을 때 FURNITURE 기본 분할
    allocateCommon: true,                                // COMMON 자동분배 기본 ON
    commonAllocNormalize: true,                          // 가중치 합≠100%면 비율 유지하며 100% 완전분배(정규화)
    commonWeights: { "FUR VN": 0.30, "FUR MX": 0.30, "SOURCING": 0.10 },  // 3:3:1 (입력 합 70% → 정규화 시 42.9/42.9/14.3)
    deptMap: {},
    cats: {
      revenue: ["Sales Revenue"], refund: ["Refund"], cogs: ["Purchase / COGS"],
      opex: ["Internet & Telecom", "Utilities", "Office Rent", "Bank Charges",
             "Tax / VAT", "Office Supplies", "Travel & Transport", "Meals & Entertainment", "Service fee"],
      excluded: ["Salary & Wages", "Social Insurance", "BHXH", "BHYT", "BHTN",
                 "Owner / Capital Transfer", "Inter-account Transfer"]
    }
  };

  function classify(cat) {
    var c = CHASAN_CFG.cats;
    if (c.excluded.indexOf(cat) >= 0) return "excluded";
    if (c.revenue.indexOf(cat) >= 0) return "revenue";
    if (c.refund.indexOf(cat) >= 0) return "refund";
    if (c.cogs.indexOf(cat) >= 0) return "cogs";
    if (c.opex.indexOf(cat) >= 0) return "opex";
    return "uncat";
  }
  // 날짜 → YYYY-MM 정규화 (YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY 등 모두 지원)
  function _ym(d) {
    d = String(d || "").trim(); if (!d) return "";
    var m;
    if ((m = d.match(/^(\d{4})[-\/.](\d{1,2})/))) return m[1] + "-" + ("0" + m[2]).slice(-2);
    if ((m = d.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})/))) return m[3] + "-" + ("0" + m[2]).slice(-2);
    return d.slice(0, 7);
  }
  function csDept(t) {
    var ex = t.chasanDept;
    if (ex && DEPTS.indexOf(ex) >= 0) return ex;
    var d = CHASAN_CFG.deptMap[t.dept] || t.dept || "COMMON";
    if (DEPTS.indexOf(d) >= 0) return d;
    if (d === "FURNITURE") return "_FUR_UNSPLIT";
    return "COMMON";
  }

  /* ── 캐시 ─────────────────────────────────────────────────── */
  var _lw = null;        // 인원별 가중치 { empId: {dept:%} }
  var _extra = {};       // EXTRA { ym: [ {id,dept,label,amount,currency,rate,payer,note} ] }

  window.chasanLwLoad = async function () {
    try { var r = await fetch(csUrl("/chasan_labor_weights"), { cache: "no-cache" }); _lw = (r.ok && await r.json()) || {}; }
    catch (e) { _lw = {}; }
    return _lw;
  };
  window.chasanLwSave = async function () {
    var r = await fetch(csUrl("/chasan_labor_weights"), { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(_lw || {}) });
    if (!r.ok) throw new Error("가중치 저장 HTTP " + r.status);
  };
  window.chasanExtraLoad = async function (ym) {
    try { var r = await fetch(csUrl("/chasan_extra/" + encodeURIComponent(ym)), { cache: "no-cache" }); var v = (r.ok && await r.json()) || []; _extra[ym] = Array.isArray(v) ? v : Object.keys(v).map(function (k) { return v[k]; }); }
    catch (e) { _extra[ym] = []; }
    return _extra[ym];
  };
  window.chasanExtraSave = async function (ym) {
    var r = await fetch(csUrl("/chasan_extra/" + encodeURIComponent(ym)), { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(_extra[ym] || []) });
    if (!r.ok) throw new Error("EXTRA 저장 HTTP " + r.status);
  };
  function extraVnd(e) { var a = +e.amount || 0; return (e.currency && e.currency !== "VND") ? a * (+e.rate || 0) : a; }
  function extraByDept(ym) {
    var out = {}; DEPTS.forEach(function (d) { out[d] = 0; });
    (_extra[ym] || []).forEach(function (e) { var d = DEPTS.indexOf(e.dept) >= 0 ? e.dept : "COMMON"; out[d] += extraVnd(e); });
    return out;
  }

  /* ── 뱅크 집계 ─────────────────────────────────────────────── */
  window.chasanBankAgg = function (ym) {
    var buckets = {}; DEPTS.forEach(function (t) { buckets[t] = { revenue: 0, cogs: 0, opex: 0 }; });
    var uncat = { count: 0, debit: 0, credit: 0 }, untagged = 0, excludedSum = 0, unsplit = [];
    var txns = (typeof state !== "undefined" && state && state.bankTxns) || [];
    txns.forEach(function (t) {
      if (!t || _ym(t.date) !== ym) return;
      var credit = +t.credit || 0, debit = +t.debit || 0;
      var kind = classify(t.category || "Uncategorized");
      if (kind === "excluded") { excludedSum += debit; return; }
      var d = csDept(t);
      if (d === "_FUR_UNSPLIT") { unsplit.push(t); d = CHASAN_CFG.furnitureDefault; }
      if (!t.dept && !t.chasanDept) untagged++;
      var into = buckets[d] || buckets.COMMON;
      if (kind === "revenue") into.revenue += credit - debit;
      else if (kind === "refund") into.revenue -= (debit - credit);
      else if (kind === "cogs") into.cogs += debit - credit;
      else if (kind === "opex") into.opex += debit - credit;
      else { uncat.count++; uncat.debit += debit; uncat.credit += credit; }
    });
    return { ym: ym, byDept: buckets, uncat: uncat, untagged: untagged, excludedOpexSkipped: excludedSum, unsplit: unsplit };
  };

  /* ── 인건비: 인원별 tc → 인원별 가중치 → 4부서 ─────────────── */
  function laborFallback(dept) {  // 가중치 없는 직원의 기본 분배 벡터
    var v = { "FUR VN": 0, "FUR MX": 0, "SOURCING": 0, "COMMON": 0 };
    if (dept === "FURNITURE") { v["FUR VN"] = CHASAN_CFG.laborSplit["FUR VN"] || 0; v["FUR MX"] = CHASAN_CFG.laborSplit["FUR MX"] || 0; }
    else if (DEPTS.indexOf(dept) >= 0) v[dept] = 1;
    else if (dept === "SOURCING") v["SOURCING"] = 1;
    else v["COMMON"] = 1;
    return v;
  }
  window.chasanLaborRows = async function (ym, opts) {
    opts = opts || {};
    var rows = [], source = "none", finalized = false;
    try {
      var saved = (typeof hrPayLoad === "function") ? await hrPayLoad(ym) : null;
      if (saved && saved.finalizedAt && Array.isArray(saved.rows)) { rows = saved.rows; source = "ledger"; finalized = true; }
      else if (opts.fallbackLive !== false && typeof hrPayCompute === "function") { rows = (hrPayCompute(ym).rows) || []; source = "live"; }
    } catch (e) { }
    return { rows: rows.map(function (r) { return { id: r.id, name: r.nameVi || r.name || r.id, dept: r.dept || "", tc: +r.tc || 0 }; }), source: source, finalized: finalized };
  };
  window.chasanLabor = async function (ym, opts) {
    var lr = await chasanLaborRows(ym, opts);
    var out = {}; DEPTS.forEach(function (t) { out[t] = 0; });
    lr.rows.forEach(function (row) {
      var w = _lw && _lw[row.id], vec;
      if (w) { var s = DEPTS.reduce(function (a, d) { return a + (+w[d] || 0); }, 0); vec = s > 0 ? {} : laborFallback(row.dept); if (s > 0) DEPTS.forEach(function (d) { vec[d] = (+w[d] || 0) / s; }); }
      else vec = laborFallback(row.dept);
      DEPTS.forEach(function (d) { out[d] += row.tc * (vec[d] || 0); });
    });
    return { byDept: out, source: lr.source, finalized: lr.finalized, rows: lr.rows };
  };

  /* ── 채산 계산 ─────────────────────────────────────────────── */
  window.chasanCompute = async function (ym, opts) {
    opts = opts || {};
    var bank = chasanBankAgg(ym);
    var lab = await chasanLabor(ym, opts);
    var ex = extraByDept(ym);
    var byDept = {};
    DEPTS.forEach(function (t) {
      var b = bank.byDept[t];
      var revenue = Math.round(b.revenue), cogs = Math.round(b.cogs), labor = Math.round(lab.byDept[t] || 0), opex = Math.round(b.opex), extra = Math.round(ex[t] || 0);
      var op = revenue - cogs - labor - opex - extra;
      byDept[t] = { revenue: revenue, cogs: cogs, labor: labor, opex: opex, extra: extra, op: op, margin: revenue ? op / revenue : 0 };
    });
    if (CHASAN_CFG.allocateCommon) {
      var com = byDept.COMMON;
      var _keys = ["revenue", "cogs", "labor", "opex", "extra"];   // 매출 포함 전항목 재분배 → 총계 불변
      var _wsum = REVENUE_DEPTS.reduce(function (a, t) { return a + (CHASAN_CFG.commonWeights[t] || 0); }, 0);
      var _norm = CHASAN_CFG.commonAllocNormalize !== false;
      var _factor = (_norm && _wsum > 0) ? 1 / _wsum : 1;          // 정규화: 비율 유지·완전분배
      REVENUE_DEPTS.forEach(function (t) {
        var w = (CHASAN_CFG.commonWeights[t] || 0) * _factor;
        _keys.forEach(function (k) { byDept[t][k] += Math.round(com[k] * w); });
        byDept[t].op = byDept[t].revenue - byDept[t].cogs - byDept[t].labor - byDept[t].opex - byDept[t].extra;
        byDept[t].margin = byDept[t].revenue ? byDept[t].op / byDept[t].revenue : 0;
      });
      var _res = _norm ? 0 : Math.max(0, 1 - _wsum);               // 미정규화 시 COMMON 잔여
      var C = {}; _keys.forEach(function (k) { C[k] = Math.round(com[k] * _res); });
      byDept.COMMON = { revenue: C.revenue, cogs: C.cogs, labor: C.labor, opex: C.opex, extra: C.extra,
        op: C.revenue - C.cogs - C.labor - C.opex - C.extra, margin: C.revenue ? (C.revenue - C.cogs - C.labor - C.opex - C.extra) / C.revenue : 0 };
    }
    var tot = { revenue: 0, cogs: 0, labor: 0, opex: 0, extra: 0, op: 0 };
    DEPTS.forEach(function (t) { ["revenue", "cogs", "labor", "opex", "extra", "op"].forEach(function (k) { tot[k] += byDept[t][k]; }); });
    tot.margin = tot.revenue ? tot.op / tot.revenue : 0;
    return { ym: ym, byDept: byDept, totals: tot, laborSource: lab.source, laborFinalized: lab.finalized, laborRows: lab.rows,
      dq: { uncat: bank.uncat, untagged: bank.untagged, unsplit: bank.unsplit }, allocated: CHASAN_CFG.allocateCommon };
  };

  window.chasanSaveSnapshot = async function (ym, data, finalize) {
    var meta = { ym: ym, savedAt: new Date().toISOString(), savedBy: (typeof hrActorName === "function" ? hrActorName() : "system") };
    if (finalize) { meta.finalizedAt = new Date().toISOString(); meta.finalizedBy = (typeof hrActorName === "function" ? hrActorName() : "system"); }
    var r = await fetch(csUrl("/chasan/" + encodeURIComponent(ym)), {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.assign({}, data, meta))
    });
    if (!r.ok) throw new Error("채산 저장 HTTP " + r.status);
  };
  window.chasanLoadSnapshot = async function (ym) {
    try { var r = await fetch(csUrl("/chasan/" + encodeURIComponent(ym)), { cache: "no-cache" }); return (r.ok && await r.json()) || null; } catch (e) { return null; }
  };
  window.chasanLoadAll = async function () {
    try { var r = await fetch(csUrl("/chasan"), { cache: "no-cache" }); return (r.ok && await r.json()) || {}; } catch (e) { return {}; }
  };
  window.chasanUnfinalize = async function (ym) {
    var r = await fetch(csUrl("/chasan/" + encodeURIComponent(ym)), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ finalizedAt: null, finalizedBy: null }) });
    if (!r.ok) throw new Error("해제 HTTP " + r.status);
  };
  function _csIsAdmin() {
    try { var u = window._gateUser; if (!u) { var uid = parseInt(sessionStorage.getItem("inics_uid") || "0"); if (uid && typeof MEMBERS !== "undefined") u = MEMBERS.find(function (m) { return m.id == uid; }); } return !!(u && u.isAdmin); } catch (e) { return false; }
  }

  /* ── 태깅/편집 핸들러 ─────────────────────────────────────── */
  window.chasanRetag = function (txnId, dept) {
    var t = (typeof state !== "undefined" && state.bankTxns || []).find(function (x) { return String(x.id) === String(txnId); });
    if (!t) return;
    t.chasanDept = dept;
    if (typeof _stampEdit === "function") _stampEdit(t);
    if (typeof saveState === "function") saveState();
    if (_lastYm && _lastHost) renderChasan(_lastYm, _lastHost, _lastOpts);
  };
  window.chasanLwEdit = function (id, dept, val) {
    _lw = _lw || {}; _lw[id] = _lw[id] || {};
    var n = parseFloat(val);
    if (val === "" || isNaN(n)) { delete _lw[id][dept]; if (!Object.keys(_lw[id]).length) delete _lw[id]; }
    else _lw[id][dept] = n;
  };
  window.chasanLwSaveBtn = async function () {
    try { await chasanLwSave(); if (typeof showToast === "function") showToast("인원별 가중치 저장 ✓"); if (_lastYm && _lastHost) renderChasan(_lastYm, _lastHost, _lastOpts); }
    catch (e) { if (typeof showToast === "function") showToast("저장 실패: " + e.message); }
  };
  window.chasanExtraAdd = async function (ym) {
    var g = function (id) { var el = document.getElementById(id); return el ? el.value : ""; };
    var amount = parseFloat(g("csxAmt")); if (isNaN(amount)) { alert("금액을 입력하세요."); return; }
    var e = { id: "X" + Date.now(), dept: g("csxDept") || "COMMON", label: g("csxLabel") || "", amount: amount,
      currency: g("csxCur") || "VND", rate: parseFloat(g("csxRate")) || 0, payer: g("csxPayer") || "", note: "" };
    _extra[ym] = _extra[ym] || []; _extra[ym].push(e);
    try { await chasanExtraSave(ym); if (typeof showToast === "function") showToast("EXTRA 추가 ✓"); } catch (er) { if (typeof showToast === "function") showToast("저장 실패: " + er.message); }
    if (_lastHost) renderChasan(ym, _lastHost, _lastOpts);
  };
  window.chasanExtraDel = async function (ym, id) {
    _extra[ym] = (_extra[ym] || []).filter(function (e) { return e.id !== id; });
    try { await chasanExtraSave(ym); } catch (er) { }
    if (_lastHost) renderChasan(ym, _lastHost, _lastOpts);
  };

  /* ── 렌더 ─────────────────────────────────────────────────── */
  var _usd = false, _rate = 0, _lastYm = null, _lastHost = null, _lastOpts = null;

  window.renderChasan = async function (ym, host, opts) {
    opts = opts || {}; _lastYm = ym; _lastOpts = opts;
    host = typeof host === "string" ? document.getElementById(host) : host;
    if (!host) return; _lastHost = host;
    host.innerHTML = '<div id="csGuard" style="margin-bottom:12px"></div><div id="csBody" style="font-size:13px;color:var(--text-3)">계산 중… / Đang tính…</div>';

    if (typeof hrChasanPayGuard === "function") {
      var g = await hrChasanPayGuard(ym, host.querySelector("#csGuard"), { mode: opts.guardMode || "warn", onProceed: function () { renderChasan(ym, host, opts); } });
      if (g.blocked) { host.querySelector("#csBody").innerHTML = '<div style="padding:20px;color:var(--text-3)">급여 확정 후 채산이 표시됩니다.</div>'; return; }
    }
    if (_lw === null) await chasanLwLoad();
    await chasanExtraLoad(ym);

    var _live = await chasanCompute(ym, { fallbackLive: opts.fallbackLive !== false });
    var _snap = await chasanLoadSnapshot(ym);
    var _final = !!(_snap && _snap.finalizedAt && _snap.byDept && _snap.totals);
    var _drift = _final ? Math.round(Math.abs((_live.totals.op || 0) - (_snap.totals.op || 0))) : 0;
    var r = _final
      ? { byDept: _snap.byDept, totals: _snap.totals, allocated: !!_snap.allocated, laborFinalized: true, laborSource: "확정", laborRows: [], dq: { uncat: { count: 0, debit: 0, credit: 0 }, untagged: 0, unsplit: [] } }
      : _live;
    var money = function (v) { return _usd && _rate ? (v / _rate).toLocaleString("en-US", { maximumFractionDigits: 0 }) : F(v); };
    var unit = _usd && _rate ? "USD" : "VND";
    var pct = function (x) { return (x * 100).toFixed(1) + "%"; };
    var T = DEPTS;

    var _drillable = { revenue: 1, cogs: 1, opex: 1 };
    var line = function (label, key, opt) {
      opt = opt || {};
      var dz = _drillable[key] && !_final;   // 확정(동결) 시엔 드릴다운 비활성(원천 스냅샷 아님)
      var main = '<tr' + (opt.top ? ' style="border-top:2px solid var(--text);font-weight:700"' : "") + '>'
        + '<td style="padding:8px 12px;text-align:left">' + label + (dz ? ' <span style="font-size:9px;color:var(--text-3)">▸ 클릭</span>' : '') + '</td>'
        + T.map(function (t) { var v = r.byDept[t][key];
          var cell = '<td style="padding:8px 12px;text-align:right;font-family:var(--mono);' + (v < 0 ? "color:var(--danger)" : "") + (dz && v !== 0 ? ';cursor:pointer;text-decoration:underline dotted' : '') + '"' + (dz && v !== 0 ? ' onclick="chasanToggleDetail(\'' + ym + '\',\'' + t + '\',\'' + key + '\')"' : '') + '>' + money(v) + '</td>';
          return cell; }).join("")
        + '<td style="padding:8px 12px;text-align:right;font-family:var(--mono);font-weight:700;' + (r.totals[key] < 0 ? "color:var(--danger)" : "") + '">' + money(r.totals[key]) + '</td></tr>';
      if (dz) {
        main += '<tr><td colspan="' + (T.length + 2) + '" style="padding:0 12px">'
          + T.map(function (t) { return '<div id="csd_' + t.replace(/\s/g, "") + '_' + key + '" data-open="0"></div>'; }).join("")
          + '</td></tr>';
      }
      return main;
    };
    var mline = function () {
      return '<tr><td style="padding:6px 12px;text-align:left;color:var(--text-3)">영업이익률 / Margin</td>'
        + T.map(function (t) { return '<td style="padding:6px 12px;text-align:right;color:var(--text-3)">' + pct(r.byDept[t].margin) + '</td>'; }).join("")
        + '<td style="padding:6px 12px;text-align:right;color:var(--text-3);font-weight:600">' + pct(r.totals.margin) + '</td></tr>';
    };

    // FURNITURE 미분류 재태깅
    var retag = "";
    if (r.dq.unsplit && r.dq.unsplit.length) {
      retag = '<div style="border:1px solid var(--warning);background:#fffbeb;border-radius:10px;padding:12px 14px;margin:12px 16px">'
        + '<div style="font-size:12px;font-weight:700;color:var(--warning);margin-bottom:8px">⚠ FURNITURE 미분류 · Unclassified ' + r.dq.unsplit.length + '건 — VN/MX 지정 필요 (잠정 ' + E(CHASAN_CFG.furnitureDefault) + ')</div>'
        + r.dq.unsplit.map(function (t) {
          var amt = (+t.credit || 0) || (+t.debit || 0);
          return '<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-top:1px solid var(--border);font-size:12px">'
            + '<span style="color:var(--text-3);width:82px;flex-shrink:0">' + E(t.date || "") + '</span>'
            + '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + E(t.desc || t.memo || t.merchant || t.category || "—") + '</span>'
            + '<span style="font-family:var(--mono);flex-shrink:0">' + F(amt) + '</span>'
            + '<button onclick="chasanRetag(\'' + E(t.id) + '\',\'FUR VN\')" style="border:1px solid var(--border);background:none;cursor:pointer;font-size:11px;padding:3px 9px;border-radius:6px;flex-shrink:0">VN</button>'
            + '<button onclick="chasanRetag(\'' + E(t.id) + '\',\'FUR MX\')" style="border:1px solid var(--border);background:none;cursor:pointer;font-size:11px;padding:3px 9px;border-radius:6px;flex-shrink:0">MX</button>'
            + '</div>';
        }).join("") + '</div>';
    }

    // 인원별 인건비 가중치 에디터
    var lwEditor = '<details style="margin:0 16px 10px"><summary style="cursor:pointer;font-size:12px;font-weight:600;color:var(--text-2);padding:6px 0">⚙ 인원별 인건비 가중치 · Per-employee labor split (' + r.laborRows.length + '명)</summary>'
      + '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:11px"><thead><tr style="background:var(--surface-2)">'
      + '<th style="padding:6px 8px;text-align:left">이름 · 부서</th>'
      + DEPTS.map(function (d) { return '<th style="padding:6px 6px;text-align:right">' + E(d) + '%</th>'; }).join("")
      + '<th style="padding:6px 8px;text-align:right">tc(회사비용)</th><th style="padding:6px 8px;text-align:right">합%</th></tr></thead><tbody>'
      + r.laborRows.map(function (row) {
        var w = _lw && _lw[row.id]; var sum = w ? DEPTS.reduce(function (a, d) { return a + (+w[d] || 0); }, 0) : null;
        var fb = laborFallback(row.dept);
        return '<tr><td style="padding:4px 8px">' + E(row.name) + ' <span style="color:var(--text-3)">' + E(row.dept) + '</span></td>'
          + DEPTS.map(function (d) {
            var val = (w && w[d] != null) ? w[d] : "";
            return '<td style="padding:2px 4px;text-align:right"><input type="number" value="' + val + '" placeholder="' + Math.round((fb[d] || 0) * 100) + '" onchange="chasanLwEdit(\'' + E(row.id) + '\',\'' + d + '\',this.value)" style="width:50px;text-align:right;border:1px solid var(--border);border-radius:5px;padding:3px 4px;font-size:11px"></td>';
          }).join("")
          + '<td style="padding:4px 8px;text-align:right;font-family:var(--mono)">' + F(row.tc) + '</td>'
          + '<td style="padding:4px 8px;text-align:right;' + (sum != null && sum !== 100 ? "color:var(--warning)" : "color:var(--text-3)") + '">' + (sum != null ? sum : "기본") + '</td></tr>';
      }).join("")
      + '</tbody></table></div>'
      + '<div style="padding:8px 0;display:flex;gap:10px;align-items:center"><button onclick="chasanLwSaveBtn()" style="border:1px solid var(--text);background:none;cursor:pointer;font-size:11px;padding:6px 12px;border-radius:7px">가중치 저장 · Save & Recalc</button><span style="font-size:10px;color:var(--text-3)">빈칸 = 부서 기본값(placeholder). 합이 100이 아니면 비율대로 정규화.</span></div></details>';

    // EXTRA 비용 에디터
    var extra = _extra[ym] || [];
    var extraRows = extra.length ? ('<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:11px"><thead><tr style="background:var(--surface-2)">'
      + '<th style="padding:5px 8px;text-align:left">부서</th><th style="padding:5px 8px;text-align:left">항목 · Item</th><th style="padding:5px 8px;text-align:right">금액</th><th style="padding:5px 8px;text-align:right">VND환산</th><th style="padding:5px 8px;text-align:left">부담법인</th><th></th></tr></thead><tbody>'
      + extra.map(function (e) {
        return '<tr><td style="padding:4px 8px">' + E(e.dept) + '</td><td style="padding:4px 8px">' + E(e.label) + '</td>'
          + '<td style="padding:4px 8px;text-align:right;font-family:var(--mono)">' + F(e.amount) + ' ' + E(e.currency || "VND") + (e.currency && e.currency !== "VND" ? ' @' + F(e.rate) : "") + '</td>'
          + '<td style="padding:4px 8px;text-align:right;font-family:var(--mono)">' + F(extraVnd(e)) + '</td>'
          + '<td style="padding:4px 8px">' + E(e.payer || "") + '</td>'
          + '<td style="padding:4px 8px;text-align:right"><button onclick="chasanExtraDel(\'' + E(ym) + '\',\'' + E(e.id) + '\')" style="border:1px solid var(--border);background:none;cursor:pointer;font-size:11px;padding:2px 8px;border-radius:6px;color:var(--danger)">삭제 · Del</button></td></tr>';
      }).join("") + '</tbody></table></div>') : '<div style="font-size:11px;color:var(--text-3);padding:6px 0">등록된 EXTRA 없음</div>';
    var inp = 'border:1px solid var(--border);border-radius:6px;padding:5px 7px;font-size:11px';
    var extraEditor = '<details open style="margin:0 16px 12px"><summary style="cursor:pointer;font-size:12px;font-weight:600;color:var(--text-2);padding:6px 0">＋ EXTRA 비용 (타법인 부담) · Other-entity costs (' + extra.length + '건)</summary>'
      + extraRows
      + '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;padding:10px 0 4px">'
      + '<select id="csxDept" style="' + inp + '">' + DEPTS.map(function (d) { return '<option>' + d + '</option>'; }).join("") + '</select>'
      + '<input id="csxLabel" placeholder="항목 (예: 미국법인 지급 창고임차)" style="' + inp + ';flex:1;min-width:180px">'
      + '<input id="csxAmt" type="number" placeholder="금액" style="' + inp + ';width:110px;text-align:right">'
      + '<select id="csxCur" style="' + inp + '">' + CURRENCIES.map(function (c) { return '<option>' + c + '</option>'; }).join("") + '</select>'
      + '<input id="csxRate" type="number" placeholder="→VND 환율" title="VND 아닐 때만" style="' + inp + ';width:100px;text-align:right">'
      + '<input id="csxPayer" placeholder="부담법인 (예: INICS America)" style="' + inp + ';width:150px">'
      + '<button onclick="chasanExtraAdd(\'' + E(ym) + '\')" style="border:1px solid var(--text);background:var(--text);color:var(--bg);cursor:pointer;font-size:11px;padding:6px 12px;border-radius:7px">추가 · Add</button>'
      + '</div><div style="font-size:10px;color:var(--text-3);padding-bottom:4px">ERP(뱅크)에 없는 타법인 부담분 · Costs paid by other entities. 외화는 환율 입력 → VND 환산 후 부서 영업이익 차감.</div></details>';

    if (_final) { retag = ""; lwEditor = ""; extraEditor = ""; }
    var _finBadge = _final ? '<span style="font-size:11px;color:var(--success);font-weight:700"> · ✓ 확정됨 · Finalized ' + E((_snap.finalizedAt || "").slice(0, 10)) + (_snap.finalizedBy ? " (" + E(_snap.finalizedBy) + ")" : "") + '</span>' : "";
    var _driftWarn = (_final && _drift > 0) ? '<div style="border:1px solid var(--warning);background:#fffbeb;border-radius:8px;padding:8px 12px;margin:0 0 12px;font-size:11px;color:var(--warning)">⚠ 확정 후 원천 변동 · Source changed after finalize — 라이브 영업이익이 확정본과 ' + F(_drift) + ' VND 차이. 재확정하면 현재값으로 갱신됩니다.</div>' : "";
    var dq = r.dq, dqWarn = (dq.uncat.count || dq.untagged) ? '<span style="font-size:11px;color:var(--warning)"> · ⚠ 미분류 ' + dq.uncat.count + '건 · 부서미태깅 ' + dq.untagged + '건</span>' : "";

    host.querySelector("#csBody").innerHTML =
      _csTabs("month") + _driftWarn
      + '<div class="form-card" style="padding:0;overflow:hidden">'
      + '<div style="padding:12px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">'
      + '<div><div style="font-size:14px;font-weight:700">부서 채산 · Departmental P&L — ' + E(ym) + '</div>'
      + '<div style="font-size:11px;color:var(--text-3)">현금주의 · Cash-basis · 인건비/Labor=' + (r.laborFinalized ? "확정대장" : "라이브(" + r.laborSource + ")") + (r.allocated ? " · COMMON 배분" : "") + dqWarn + _finBadge + '</div></div>'
      + '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">'
      + '<label style="font-size:11px;color:var(--text-3);display:flex;align-items:center;gap:5px"><input type="checkbox" id="csAlloc"' + (CHASAN_CFG.allocateCommon ? " checked" : "") + '> COMMON 배분 · Allocate</label>'
      + '<label style="font-size:11px;color:var(--text-3);display:flex;align-items:center;gap:5px"><input type="checkbox" id="csUsd"' + (_usd ? " checked" : "") + '> USD</label>'
      + '<input id="csRate" type="number" placeholder="VND/USD" value="' + (_rate || "") + '" style="width:100px;border:1px solid var(--border);border-radius:6px;padding:5px 7px;font-size:12px">'
      + '<button id="csXlsx" style="border:1px solid var(--border);background:none;color:var(--text-2);font-size:11px;cursor:pointer;padding:6px 11px;border-radius:7px">⬇ Excel</button>'
      + (_final
          ? '<button id="csRefinal" style="border:1px solid var(--warning);background:none;color:var(--warning);font-size:11px;cursor:pointer;padding:6px 11px;border-radius:7px">재확정 · Re-finalize</button><button id="csUnfinal" style="border:1px solid var(--border);background:none;color:var(--text-3);font-size:11px;cursor:pointer;padding:6px 11px;border-radius:7px">확정 해제 · Unlock</button>'
          : '<button id="csSaveDraft" style="border:1px solid var(--border);background:none;color:var(--text-2);font-size:11px;cursor:pointer;padding:6px 11px;border-radius:7px">임시 저장 · Save Draft</button><button id="csFinal" style="border:1px solid var(--text);background:var(--text);color:var(--bg);font-size:11px;cursor:pointer;padding:6px 11px;border-radius:7px">채산 확정 · Finalize</button>')
      + '</div></div>'
      + '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px">'
      + '<thead><tr style="background:var(--surface-2)"><th style="padding:8px 12px;text-align:left;font-size:10px;color:var(--text-3)">항목 / Item</th>'
      + T.map(function (t) { return '<th style="padding:8px 12px;text-align:right;font-size:10px;color:var(--text-3)">' + E(t) + '</th>'; }).join("")
      + '<th style="padding:8px 12px;text-align:right;font-size:10px;color:var(--text-3)">합계 (' + unit + ')</th></tr></thead><tbody>'
      + line("매출 / Revenue", "revenue")
      + line("(−) 매입원가 / COGS", "cogs")
      + line("(−) 인건비 / Labor", "labor")
      + line("(−) 판관비 / OpEx", "opex")
      + line("(−) EXTRA (타법인부담)", "extra")
      + line("영업이익 / Operating Profit", "op", { top: true })
      + mline()
      + '</tbody></table></div>'
      + retag + lwEditor + extraEditor
      + '<p style="font-size:11px;color:var(--text-3);padding:8px 16px;line-height:1.6">현금주의(뱅크) · 인건비=확정대장 tc를 인원별 가중치로 4부서 분배(급여·이체 카테고리는 OpEx 제외). EXTRA는 타법인 부담분 수기입력. FUR VN/MX는 거래 채산부서 태그 기준. COMMON은 배분 ON 시 FUR VN/FUR MX/SOURCING에 3:3:1 비율로 완전분배(정규화).</p></div>';

    var usdEl = host.querySelector("#csUsd"), rateEl = host.querySelector("#csRate"), allocEl = host.querySelector("#csAlloc");
    if (usdEl) usdEl.onchange = function () { _usd = usdEl.checked; if (_usd && !(+rateEl.value)) { alert("월 환율(VND/USD)을 입력하세요."); _usd = false; usdEl.checked = false; return; } renderChasan(ym, host, opts); };
    if (rateEl) rateEl.onchange = function () { _rate = +rateEl.value || 0; if (_usd) renderChasan(ym, host, opts); };
    if (allocEl) allocEl.onchange = function () { CHASAN_CFG.allocateCommon = allocEl.checked; renderChasan(ym, host, opts); };
    var _payload = function () { return { byDept: _live.byDept, totals: _live.totals, fx: { usd: _usd, vndPerUsd: _rate }, laborFinalized: _live.laborFinalized, allocated: _live.allocated }; };
    var _bind = function (id, fn) { var el = host.querySelector(id); if (el) el.onclick = fn; };
    var _csArchive = async function () { try { if (typeof XLSX === "undefined") return false; var all = await chasanLoadAll(); var bytes = chasanBuildWorkbook(ym, _live, _lw, _extra[ym], _live.laborRows, all); return await chasanArchiveXlsx(ym, chasanXlsxBlob(bytes)); } catch (e) { return false; } };
    _bind("#csXlsx", function () { chasanDownloadXlsx(ym); });
    _bind("#csSaveDraft", async function () { try { await chasanSaveSnapshot(ym, _payload(), false); if (typeof showToast === "function") showToast(ym + " 임시 저장 · Saved ✓"); } catch (e) { if (typeof showToast === "function") showToast("저장 실패: " + e.message); } });
    _bind("#csFinal", async function () { if (!confirm(ym + " 채산을 확정합니다. 확정 후 이 달 값이 동결되고 Storage에 Excel이 저장됩니다. 진행할까요?")) return; try { await chasanSaveSnapshot(ym, _payload(), true); var _ok = await _csArchive(); if (typeof showToast === "function") showToast(ym + " 채산 확정 · Finalized ✓" + (_ok ? " · Storage Excel saved" : " · (엑셀 저장 실패)")); renderChasan(ym, host, opts); } catch (e) { if (typeof showToast === "function") showToast("확정 실패: " + e.message); } });
    _bind("#csRefinal", async function () { if (!_csIsAdmin()) { alert("재확정은 관리자만 가능합니다."); return; } if (!confirm(ym + " 채산을 현재 라이브값으로 재확정합니다. 진행할까요?")) return; try { await chasanSaveSnapshot(ym, _payload(), true); var _ok = await _csArchive(); if (typeof showToast === "function") showToast(ym + " 재확정 · Re-finalized ✓" + (_ok ? " · Storage Excel saved" : "")); renderChasan(ym, host, opts); } catch (e) { if (typeof showToast === "function") showToast("재확정 실패: " + e.message); } });
    _bind("#csUnfinal", async function () { if (!_csIsAdmin()) { alert("확정 해제는 관리자만 가능합니다."); return; } if (!confirm(ym + " 채산 확정을 해제합니다. 다시 편집 가능해집니다. 진행할까요?")) return; try { await chasanUnfinalize(ym); if (typeof showToast === "function") showToast(ym + " 확정 해제 · Unlocked ✓"); renderChasan(ym, host, opts); } catch (e) { if (typeof showToast === "function") showToast("해제 실패: " + e.message); } });
  };

  // ── 라인 드릴다운: 특정 부서/항목(revenue|cogs|opex)을 구성한 거래 목록 ──
  //   revenue/cogs → 거래처(vendor) 합계, opex → 카테고리 합계. 하위에 개별 거래.
  window.chasanLineDetail = function (ym, dept, key) {
    var txns = (typeof state !== "undefined" && state && state.bankTxns) || [];
    var rows = [];
    txns.forEach(function (t) {
      if (!t || _ym(t.date) !== ym) return;
      if (classify(t.category || "Uncategorized") !== key) return;
      var d = csDept(t);
      if (d === "_FUR_UNSPLIT") d = CHASAN_CFG.furnitureDefault;
      if (d !== dept) return;
      var credit = +t.credit || 0, debit = +t.debit || 0;
      var amt = (key === "revenue" || key === "refund") ? (credit - debit) : (debit - credit);
      rows.push({ date: t.date || "", vendor: (t.vendor || "").trim() || "(미지정)", category: t.category || "",
        note: (t.note || t.ref || "").trim(), amt: amt });
    });
    // 그룹 기준: opex=카테고리 / 그 외=거래처
    var groupKey = (key === "opex") ? "category" : "vendor";
    var groups = {};
    rows.forEach(function (r) { var g = r[groupKey] || "(미지정)"; (groups[g] = groups[g] || { sum: 0, items: [] }); groups[g].sum += r.amt; groups[g].items.push(r); });
    var list = Object.keys(groups).map(function (g) { return { name: g, sum: groups[g].sum, items: groups[g].items.sort(function (a, b) { return b.amt - a.amt; }) }; }).sort(function (a, b) { return b.sum - a.sum; });
    return { groupKey: groupKey, groups: list, total: rows.reduce(function (a, r) { return a + r.amt; }, 0), count: rows.length };
  };
  window.chasanToggleDetail = function (ym, dept, key) {
    var id = "csd_" + dept.replace(/\s/g, "") + "_" + key;
    var el = document.getElementById(id); if (!el) return;
    if (el.getAttribute("data-open") === "1") { el.innerHTML = ""; el.setAttribute("data-open", "0"); return; }
    var d = chasanLineDetail(ym, dept, key);
    var glabel = d.groupKey === "category" ? "카테고리 · Category" : "거래처 · Vendor";
    var html = '<div style="background:var(--surface-2);border-radius:8px;padding:10px 12px;margin:2px 0 6px">'
      + '<div style="font-size:11px;color:var(--text-3);margin-bottom:6px">' + E(dept) + ' · ' + glabel + '별 (' + d.count + '건)</div>';
    if (!d.groups.length) html += '<div style="font-size:11px;color:var(--text-3)">거래 없음</div>';
    d.groups.forEach(function (g) {
      html += '<details style="margin-bottom:3px"><summary style="cursor:pointer;font-size:12px;display:flex;justify-content:space-between;gap:10px;padding:3px 0">'
        + '<span style="font-weight:600">' + E(g.name) + '</span><span style="font-family:var(--mono);' + (g.sum < 0 ? "color:var(--danger)" : "") + '">' + F(g.sum) + '</span></summary>'
        + '<div style="padding:4px 0 6px 10px">'
        + g.items.map(function (it) {
          return '<div style="display:flex;gap:8px;font-size:11px;padding:2px 0;border-top:1px solid var(--border)">'
            + '<span style="color:var(--text-3);width:78px;flex-shrink:0">' + E(it.date) + '</span>'
            + '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + E(it.note).replace(/"/g, "&quot;") + '">' + E(it.note || "—") + '</span>'
            + '<span style="font-family:var(--mono);flex-shrink:0;' + (it.amt < 0 ? "color:var(--danger)" : "") + '">' + F(it.amt) + '</span></div>';
        }).join("")
        + '</div></details>';
    });
    html += '</div>';
    el.innerHTML = html; el.setAttribute("data-open", "1");
  };
  var _csView = "month", _csHistYear = null;
  window.chasanSwitchView = function (v) { _csView = v; renderChasanPage(); };
  window.chasanHistYear = function (y) { _csHistYear = String(y); renderChasanPage(); };
  function _csTabs(active) {
    var tab = function (v, label) { return '<button onclick="chasanSwitchView(\'' + v + '\')" style="border:none;background:none;cursor:pointer;font-size:13px;font-weight:' + (active === v ? "700" : "400") + ';color:' + (active === v ? "var(--text)" : "var(--text-3)") + ';padding:8px 2px;margin-right:18px;border-bottom:2px solid ' + (active === v ? "var(--text)" : "transparent") + '">' + label + "</button>"; };
    return '<div style="border-bottom:1px solid var(--border);margin-bottom:14px">' + tab("month", "월별 채산 · Monthly") + tab("history", "History · 이력") + "</div>";
  }
  function _csLineChart(series, monthsLbl) {
    var W = 680, H = 220, pl = 8, pr = 8, pt = 12, pb = 22, n = monthsLbl.length; if (!n) return "";
    var all = [0]; series.forEach(function (s) { s.values.forEach(function (v) { all.push(v); }); });
    var mn = Math.min.apply(null, all), mx = Math.max.apply(null, all); if (mn === mx) mx = mn + 1;
    var iw = W - pl - pr, ih = H - pt - pb;
    var x = function (i) { return pl + (n <= 1 ? iw / 2 : iw * i / (n - 1)); };
    var y = function (v) { return pt + ih * (1 - (v - mn) / (mx - mn)); };
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:auto;font-family:var(--sans)">';
    svg += '<line x1="' + pl + '" y1="' + y(0).toFixed(1) + '" x2="' + (W - pr) + '" y2="' + y(0).toFixed(1) + '" stroke="var(--border)"/>';
    monthsLbl.forEach(function (m, i) { svg += '<text x="' + x(i).toFixed(1) + '" y="' + (H - 6) + '" font-size="9" fill="var(--text-3)" text-anchor="middle">' + E(m.slice(5)) + '</text>'; });
    series.forEach(function (s) {
      var d = s.values.map(function (v, i) { return (i === 0 ? "M" : "L") + x(i).toFixed(1) + " " + y(v).toFixed(1); }).join(" ");
      svg += '<path d="' + d + '" fill="none" stroke="' + s.color + '" stroke-width="2"/>';
      s.values.forEach(function (v, i) { svg += '<circle cx="' + x(i).toFixed(1) + '" cy="' + y(v).toFixed(1) + '" r="2.5" fill="' + s.color + '"/>'; });
    });
    svg += "</svg>";
    return svg + '<div style="display:flex;gap:14px;flex-wrap:wrap;font-size:11px;margin-top:6px">' + series.map(function (s) { return '<span style="display:flex;align-items:center;gap:5px"><span style="width:10px;height:10px;border-radius:2px;background:' + s.color + '"></span>' + E(s.name) + "</span>"; }).join("") + "</div>";
  }
  window.renderChasanHistory = async function (host, ym) {
    host = typeof host === "string" ? document.getElementById(host) : host; if (!host) return;
    host.innerHTML = _csTabs("history") + '<div style="font-size:13px;color:var(--text-3)">이력 로딩…</div>';
    var all = await chasanLoadAll();
    var year = _csHistYear || (ym || "").slice(0, 4) || String(new Date().getFullYear());
    var years = {}; Object.keys(all).forEach(function (k) { if (/^\d{4}-\d{2}$/.test(k)) years[k.slice(0, 4)] = 1; }); years[year] = 1;
    var yList = Object.keys(years).sort();
    var months = []; for (var mo = 1; mo <= 12; mo++) months.push(year + "-" + String(mo).padStart(2, "0"));
    var COLORS = { "FUR VN": "#2563eb", "FUR MX": "#16a34a", "SOURCING": "#d97706", "COMMON": "#6b7280" };
    var snaps = months.map(function (mm) { return { ym: mm, snap: all[mm] || null }; });
    var money = function (v) { return F(v); };
    var rowsHtml = snaps.map(function (o) {
      var s = o.snap, fin = !!(s && s.finalizedAt);
      var opCell = function (d) { var v = s && s.byDept && s.byDept[d] ? s.byDept[d].op : null; return '<td style="padding:6px 10px;text-align:right;font-family:var(--mono);' + (v < 0 ? "color:var(--danger)" : "") + '">' + (v == null ? "—" : money(v)) + "</td>"; };
      var tot = s && s.totals ? s.totals.op : null;
      return '<tr style="' + (s ? "" : "opacity:.45") + '"><td style="padding:6px 10px">' + E(o.ym.slice(5)) + "월</td>" + DEPTS.map(opCell).join("") + '<td style="padding:6px 10px;text-align:right;font-family:var(--mono);font-weight:700;' + (tot < 0 ? "color:var(--danger)" : "") + '">' + (tot == null ? "—" : money(tot)) + "</td><td style=\"padding:6px 10px;text-align:center\">" + (fin ? '<span style="color:var(--success);font-weight:700">✓ ' + E((s.finalizedAt || "").slice(0, 10)) + "</span>" : (s ? '<span style="color:var(--text-3)">임시 · Draft</span>' : '<span style="color:var(--text-3)">—</span>')) + "</td></tr>";
    }).join("");
    var ytd = {}; DEPTS.forEach(function (d) { ytd[d] = { revenue: 0, cogs: 0, labor: 0, opex: 0, extra: 0, op: 0 }; });
    var ytdTot = { revenue: 0, cogs: 0, labor: 0, opex: 0, extra: 0, op: 0 }, finCount = 0;
    snaps.forEach(function (o) { var s = o.snap; if (!(s && s.finalizedAt && s.byDept)) return; finCount++; DEPTS.forEach(function (d) { var b = s.byDept[d] || {}; ["revenue", "cogs", "labor", "opex", "extra", "op"].forEach(function (k) { ytd[d][k] += (+b[k] || 0); ytdTot[k] += (+b[k] || 0); }); }); });
    var ytdLine = function (label, key) { return '<tr><td style="padding:6px 10px">' + label + "</td>" + DEPTS.map(function (d) { var v = ytd[d][key]; return '<td style="padding:6px 10px;text-align:right;font-family:var(--mono);' + (v < 0 ? "color:var(--danger)" : "") + '">' + money(v) + "</td>"; }).join("") + '<td style="padding:6px 10px;text-align:right;font-family:var(--mono);font-weight:700;' + (ytdTot[key] < 0 ? "color:var(--danger)" : "") + '">' + money(ytdTot[key]) + "</td></tr>"; };
    var series = DEPTS.map(function (d) { return { name: d, color: COLORS[d], values: snaps.map(function (o) { return o.snap && o.snap.byDept && o.snap.byDept[d] ? (+o.snap.byDept[d].op || 0) : 0; }) }; });
    series.push({ name: "합계", color: "#111827", values: snaps.map(function (o) { return o.snap && o.snap.totals ? (+o.snap.totals.op || 0) : 0; }) });
    var yearSel = '<select onchange="chasanHistYear(this.value)" style="border:1px solid var(--border);border-radius:8px;padding:5px 9px;font-size:13px">' + yList.map(function (yy) { return '<option value="' + yy + '"' + (yy === year ? " selected" : "") + ">" + yy + "년</option>"; }).join("") + "</select>";
    host.innerHTML = _csTabs("history")
      + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px"><span style="font-size:12px;color:var(--text-3)">연도 · Year</span>' + yearSel + '<button onclick="chasanDownloadHistoryXlsx(&#39;' + year + '&#39;)" style="border:1px solid var(--border);background:none;color:var(--text-2);font-size:11px;cursor:pointer;padding:6px 11px;border-radius:7px;margin-left:8px">⬇ Excel</button><span style="flex:1"></span><span style="font-size:11px;color:var(--text-3)">Finalized ' + finCount + '개월/months · 임시·미저장 월 제외 · Draft/none excluded</span></div>'
      + '<div class="form-card" style="padding:14px 16px;margin-bottom:14px"><div style="font-size:13px;font-weight:700;margin-bottom:8px">부서별 영업이익 추이 · Operating Profit Trend (' + year + ')</div>' + _csLineChart(series, months) + "</div>"
      + '<div class="form-card" style="padding:0;overflow:hidden;margin-bottom:14px"><div style="padding:10px 16px;font-size:13px;font-weight:700;border-bottom:1px solid var(--border)">월별 영업이익 · Monthly OP</div><div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:var(--surface-2)"><th style="padding:6px 10px;text-align:left;font-size:10px;color:var(--text-3)">월 · Month</th>' + DEPTS.map(function (d) { return '<th style="padding:6px 10px;text-align:right;font-size:10px;color:var(--text-3)">' + E(d) + "</th>"; }).join("") + '<th style="padding:6px 10px;text-align:right;font-size:10px;color:var(--text-3)">합계 · Total</th><th style="padding:6px 10px;text-align:center;font-size:10px;color:var(--text-3)">확정 · Fin.</th></tr></thead><tbody>' + rowsHtml + "</tbody></table></div></div>"
      + '<div class="form-card" style="padding:0;overflow:hidden"><div style="padding:10px 16px;font-size:13px;font-weight:700;border-bottom:1px solid var(--border)">YTD 누적 · Year-to-Date (' + year + ', 확정 ' + finCount + '개월)</div><div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:var(--surface-2)"><th style="padding:6px 10px;text-align:left;font-size:10px;color:var(--text-3)">항목 · Item</th>' + DEPTS.map(function (d) { return '<th style="padding:6px 10px;text-align:right;font-size:10px;color:var(--text-3)">' + E(d) + "</th>"; }).join("") + '<th style="padding:6px 10px;text-align:right;font-size:10px;color:var(--text-3)">합계 · Total</th></tr></thead><tbody>' + ytdLine("매출 / Revenue", "revenue") + ytdLine("(−) COGS", "cogs") + ytdLine("(−) 인건비", "labor") + ytdLine("(−) 판관비", "opex") + ytdLine("(−) EXTRA", "extra") + '<tr style="border-top:2px solid var(--text);font-weight:700"><td style="padding:6px 10px">영업이익 / OP</td>' + DEPTS.map(function (d) { var v = ytd[d].op; return '<td style="padding:6px 10px;text-align:right;font-family:var(--mono);' + (v < 0 ? "color:var(--danger)" : "") + '">' + money(v) + "</td>"; }).join("") + '<td style="padding:6px 10px;text-align:right;font-family:var(--mono);' + (ytdTot.op < 0 ? "color:var(--danger)" : "") + '">' + money(ytdTot.op) + "</td></tr></tbody></table></div></div>";
  };
  function _fmtPct(m) { return Math.round((m || 0) * 1000) / 10; }
  window.chasanBuildWorkbook = function (ym, r, lw, extra, laborRows, allSnaps) {
    var wb = XLSX.utils.book_new(), D = DEPTS;
    var rowF = function (label, key) { return [label].concat(D.map(function (d) { return r.byDept[d][key]; })).concat([r.totals[key]]); };
    var m1 = [
      ["부서 채산 · " + ym, "", "", "", "", ""],
      ["항목"].concat(D).concat(["합계"]),
      rowF("매출 Revenue", "revenue"), rowF("(-) 매입원가 COGS", "cogs"), rowF("(-) 인건비 Labor", "labor"),
      rowF("(-) 판관비 OpEx", "opex"), rowF("(-) EXTRA(타법인)", "extra"), rowF("영업이익 OP", "op"),
      ["영업이익률(%)"].concat(D.map(function (d) { return _fmtPct(r.byDept[d].margin); })).concat([_fmtPct(r.totals.margin)])
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(m1), "채산_" + ym);
    var w2 = [["이름", "부서", "tc(회사비용)", "FUR VN %", "FUR MX %", "SOURCING %", "COMMON %"]];
    (laborRows || []).forEach(function (rw) {
      var w = lw && lw[rw.id];
      var cell = function (d) { if (w && w[d] != null) return w[d]; var fb = laborFallback(rw.dept); return Math.round((fb[d] || 0) * 100); };
      w2.push([rw.name, rw.dept, rw.tc, cell("FUR VN"), cell("FUR MX"), cell("SOURCING"), cell("COMMON")]);
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(w2), "인원별가중치");
    var e3 = [["부서", "항목", "금액", "통화", "환율", "VND환산", "부담법인", "비고"]];
    (extra || []).forEach(function (e) { e3.push([e.dept, e.label, +e.amount || 0, e.currency || "VND", +e.rate || 0, extraVnd(e), e.payer || "", e.note || ""]); });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(e3), "EXTRA");
    if (allSnaps) {
      var year = ym.slice(0, 4), months = [];
      for (var i = 1; i <= 12; i++) months.push(year + "-" + String(i).padStart(2, "0"));
      var h4 = [["월"].concat(D).concat(["합계", "확정", "확정일"])];
      months.forEach(function (mm) { var sp = allSnaps[mm]; h4.push([mm].concat(D.map(function (d) { return sp && sp.byDept && sp.byDept[d] ? sp.byDept[d].op : ""; })).concat([sp && sp.totals ? sp.totals.op : "", sp && sp.finalizedAt ? "Y" : "", sp && sp.finalizedAt ? sp.finalizedAt.slice(0, 10) : ""])); });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(h4), "History_월별_" + year);
      var ytd = {}; D.forEach(function (d) { ytd[d] = { revenue: 0, cogs: 0, labor: 0, opex: 0, extra: 0, op: 0 }; });
      var tt = { revenue: 0, cogs: 0, labor: 0, opex: 0, extra: 0, op: 0 };
      months.forEach(function (mm) { var sp = allSnaps[mm]; if (!(sp && sp.finalizedAt && sp.byDept)) return; D.forEach(function (d) { var b = sp.byDept[d] || {}; ["revenue", "cogs", "labor", "opex", "extra", "op"].forEach(function (k) { ytd[d][k] += (+b[k] || 0); tt[k] += (+b[k] || 0); }); }); });
      var yr = function (label, key) { return [label].concat(D.map(function (d) { return ytd[d][key]; })).concat([tt[key]]); };
      var h5 = [["YTD 누적 · " + year, "", "", "", "", ""], ["항목"].concat(D).concat(["합계"]), yr("매출", "revenue"), yr("(-)COGS", "cogs"), yr("(-)인건비", "labor"), yr("(-)판관비", "opex"), yr("(-)EXTRA", "extra"), yr("영업이익", "op")];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(h5), "History_YTD_" + year);
    }
    return XLSX.write(wb, { type: "array", bookType: "xlsx" });
  };
  window.chasanXlsxBlob = function (bytes) { return new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }); };
  window.chasanDownloadXlsx = async function (ym) {
    if (typeof XLSX === "undefined") { if (typeof showToast === "function") showToast("XLSX 로더 없음"); return; }
    var r = await chasanCompute(ym, { fallbackLive: true });
    if (_lw === null) await chasanLwLoad(); await chasanExtraLoad(ym);
    var all = await chasanLoadAll();
    var blob = chasanXlsxBlob(chasanBuildWorkbook(ym, r, _lw, _extra[ym], r.laborRows, all));
    var url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = "채산_" + ym + ".xlsx"; a.click(); setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  };
  window.chasanDownloadHistoryXlsx = function (year) { var el = document.getElementById("csMonth"); var ym = (el && el.value && el.value.slice(0, 4) === String(year)) ? el.value : (year + "-01"); chasanDownloadXlsx(ym); };
  window.chasanArchiveXlsx = async function (ym, blob) {
    try {
      var BUCKET = "inics-approval.firebasestorage.app";
      var path = "채산/" + ym + ".xlsx";
      var url = "https://firebasestorage.googleapis.com/v0/b/" + BUCKET + "/o?name=" + encodeURIComponent(path);
      var r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }, body: blob });
      return r.ok;
    } catch (e) { console.warn("채산 xlsx 아카이브 실패:", e && e.message); return false; }
  };
  window.renderChasanPage = function () {
    var el = document.getElementById("csMonth");
    var ym = (el && el.value) || (typeof hrYmOf === "function" && window.hrAsof ? hrYmOf(window.hrAsof) : new Date().toISOString().slice(0, 7));
    if (el && !el.value) el.value = ym;
    if (_csView === "history") renderChasanHistory("csHost", ym);
    else renderChasan(ym, "csHost");
  };
})();
