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
  var _csViewRaw = false;   // 확정 뷰 "배분 풀기(보기)" — 확정본 불변, 표시만 배분 전 원본
  var REVENUE_DEPTS = ["FUR VN", "FUR MX", "SOURCING"];
  var CURRENCIES = ["VND", "USD", "MXN", "KRW"];

  window.CHASAN_CFG = {
    depts: DEPTS,
    furnitureDefault: "FUR VN",
    laborSplit: { "FUR VN": 1, "FUR MX": 0 },   // 인원별 가중치 없을 때 FURNITURE 기본 분할
    allocateCommon: true,                                // COMMON 자동분배 기본 ON
    commonAllocNormalize: true,                          // 가중치 합≠100%면 비율 유지하며 100% 완전분배(정규화)
    commonWeights: { "FUR VN": 0.30, "FUR MX": 0.30, "SOURCING": 0.10 },  // 3:3:1 (입력 합 70% → 정규화 시 42.9/42.9/14.3)
    forecast: { cogsRate: 0.85, fixedOpexCats: ["Office Rent", "Utilities", "Internet & Telecom", "Service fee"] },  // 예상채산: COGS 85% 가정 + 고정판관비 항목
    deptMap: {},
    cats: {
      revenue: ["Sales Revenue"], refund: ["Refund"], cogs: ["Purchase / COGS"],
      opex: ["Internet & Telecom", "Utilities", "Office Rent", "Bank Charges",
             "Tax / VAT", "Office Supplies", "Travel & Transport", "Meals & Entertainment", "Service fee", "Software"],
      excluded: ["Salary & Wages", "Social Insurance", "BHXH", "BHYT", "BHTN",
                 "Owner / Capital Transfer", "Inter-account Transfer", "Others income"]
    }
  };

  var _catMap = null;
  window.chasanCatMapLoad = async function () {
    try { var r = await fetch(csUrl("/chasan_cat_map"), { cache: "no-cache" }); _catMap = (r.ok && await r.json()) || {}; } catch (e) { _catMap = {}; }
    return _catMap;
  };
  window.chasanCatMapSave = async function () {
    var r = await fetch(csUrl("/chasan_cat_map"), { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(_catMap || {}) });
    if (!r.ok) throw new Error("HTTP " + r.status);
  };
  window.chasanGetCatMap = function () { return _catMap || {}; };
  window.chasanCatMapReady = function () { return _catMap !== null; };
  window.chasanSetCatMap = async function (cat, area) {
    _catMap = _catMap || {};
    if (!area) { delete _catMap[cat]; } else { _catMap[cat] = area; }
    await chasanCatMapSave();
    return true;
  };
  window.CHASAN_AREAS = [["revenue","매출 · Revenue"],["cogs","매입원가 · COGS"],["opex","판관비 · OpEx"],["refund","환입 · Refund"],["excluded","제외(영업외/이체/급여) · Excluded"]];
  function classify(cat) {
    if (_catMap && _catMap[cat]) return _catMap[cat];
    var c = CHASAN_CFG.cats;
    if (c.excluded.indexOf(cat) >= 0) return "excluded";
    if (c.revenue.indexOf(cat) >= 0) return "revenue";
    if (c.refund.indexOf(cat) >= 0) return "refund";
    if (c.cogs.indexOf(cat) >= 0) return "cogs";
    if (c.opex.indexOf(cat) >= 0) return "opex";
    return "uncat";
  }
  window.chasanClassify = function (cat) { return classify(cat); };
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

  /* ── 인보이스(발생주의) 매출·매입원가 ───────────────────────────
     · 매출     = 발행 인보이스(dir=issued) 공급가액(VAT 제외)
     · 매입원가 = 수취 인보이스(dir=received) 중 'COGS 인정 업체'만 (기본: FURSYS VN)
     · 부서 = inv.chasanDept (미태깅 시 COMMON) · 통화≠VND면 fx→VND 환산
     ─────────────────────────────────────────────────────────────── */
  var _cogsVendors = null;   // COGS 인정 업체 key 목록 (mst: 우선, 없으면 nm:)
  function _invNorm(s) { return String(s == null ? "" : s).trim().toUpperCase().replace(/\s+/g, " "); }
  function _invNum2(v) { v = String(v == null ? "" : v).replace(/[,\s]/g, ""); var n = parseFloat(v); return isNaN(n) ? 0 : n; }
  function invVendorKey(inv) { var m = String(inv && inv.vendorMst || "").trim(); return m ? ("mst:" + m) : ("nm:" + _invNorm(inv && inv.vendor)); }   // 대표키: MST 우선
  function invNameKey(inv) { var nm = _invNorm(inv && inv.vendor); return nm ? ("nm:" + nm) : ""; }
  function invNet(inv) { var sub = _invNum2(inv.subtotal); if (sub > 0) return sub; var tot = _invNum2(inv.total); if (tot <= 0) return 0; var vat = _invNum2(inv.vatPct); return vat > 0 ? tot / (1 + vat / 100) : tot; }   // 공급가액(VAT 제외)
  function invVnd(inv, amt) { var c = String(inv.currency || "VND").toUpperCase(); if (!c || c === "VND") return { v: amt, ok: true }; var fx = _invNum2(inv.fxRate || inv.rate); if (fx > 0) return { v: amt * fx, ok: true }; if (c === "USD" && _rate > 0) return { v: amt * _rate, ok: true }; return { v: amt, ok: false }; }
  function invDept(inv) { var d = inv.chasanDept; return (d && DEPTS.indexOf(d) >= 0) ? d : CHASAN_CFG.furnitureDefault; }   // 기본값: FUR VN (미지정 시)
  function isCogsVendor(inv) { var wl = _cogsVendors || [], nk = invNameKey(inv); return wl.indexOf(invVendorKey(inv)) >= 0 || (nk && wl.indexOf(nk) >= 0); }

  window.chasanCogsVendorsLoad = async function () {
    try { var r = await fetch(csUrl("/chasan_cogs_vendors"), { cache: "no-cache" }); var v = (r.ok && await r.json()); _cogsVendors = Array.isArray(v) ? v : (v ? Object.keys(v).filter(function (k) { return v[k]; }) : null); }
    catch (e) { _cogsVendors = null; }
    if (_cogsVendors === null) _cogsVendors = ["nm:" + _invNorm("CÔNG TY TNHH FURSYS VN")];   // 기본값: FURSYS VN
    return _cogsVendors;
  };
  window.chasanCogsVendorsSave = async function () {
    var r = await fetch(csUrl("/chasan_cogs_vendors"), { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(_cogsVendors || []) });
    if (!r.ok) throw new Error("COGS업체 저장 HTTP " + r.status);
  };
  window.chasanCogsVendorsReady = function () { return _cogsVendors !== null; };
  window.chasanGetCogsVendors = function () { return _cogsVendors || []; };
  window.chasanToggleCogsVendor = async function (primaryKey, nameKey) {
    _cogsVendors = _cogsVendors || [];
    var on = _cogsVendors.indexOf(primaryKey) >= 0 || (nameKey && _cogsVendors.indexOf(nameKey) >= 0);
    if (on) { _cogsVendors = _cogsVendors.filter(function (k) { return k !== primaryKey && k !== nameKey; }); }   // 해제: 대표·이름키 모두 제거
    else if (_cogsVendors.indexOf(primaryKey) < 0) _cogsVendors.push(primaryKey);
    try { await chasanCogsVendorsSave(); if (typeof showToast === "function") showToast("매입원가 업체 갱신 ✓"); }
    catch (e) { if (typeof showToast === "function") showToast("저장 실패: " + e.message); }
    if (_lastYm && _lastHost) renderChasan(_lastYm, _lastHost, _lastOpts);
  };

  /* ── 귀속기준 엔진 · Recognition basis ──────────────────────────────
     'invoice' = 인보이스 발행일 기준 (세무·VAT 신고 대사용 · 기존 동작)
     'project' = 프로젝트 귀속 기준 (수익비용대응 · 경영판단용)
       프로젝트의 인식월을 정하고, 그 프로젝트에 달린 매출·매입을 전부 그 달로 귀속.
       인식월 폴백 체인: 최초 매출인보이스 발행일 → sales.invoiceDate
                        → 납품완료 전환일 → PO완료 → 수주확정 → 납기 → 등록일   */
  var _csBasis = "invoice", _recogCache = null;
  window.chasanGetBasis = function () { return _csBasis; };
  window.chasanSetBasis = function (b) {
    _csBasis = (b === "project") ? "project" : "invoice"; _recogCache = null;
    if (_lastYm && _lastHost) renderChasan(_lastYm, _lastHost, _lastOpts);
  };
  // 렌더 없이 기준만 전환 (본사 주보 등 외부 모듈이 임시로 계산할 때 사용)
  window.chasanSetBasisSilent = function (b) {
    _csBasis = (b === "project") ? "project" : "invoice"; _recogCache = null;
  };
  // 확정 스냅샷을 선택 기준으로 해석 · byBasis 없으면 원본 그대로 (구버전 호환)
  window.chasanResolveBasis = function (all, basis) {
    var out = {}, missing = [];
    Object.keys(all || {}).forEach(function (k) {
      var s = all[k];
      var b = s && s.byBasis && s.byBasis[basis];
      if (b && b.byDept && b.totals) {
        out[k] = Object.assign({}, s, {
          byDept: b.byDept, totals: b.totals, headByDept: b.headByDept,
          totHead: b.totHead, byDeptRaw: b.byDeptRaw, headByDeptRaw: b.headByDeptRaw, allocated: b.allocated
        });
      } else {
        out[k] = s;
        if (s && s.finalizedAt && basis === "project" && /^\d{4}-\d{2}$/.test(k)) missing.push(k);
      }
    });
    out.__basis = basis; out.__missing = missing;
    return out;
  };
  function _csStageYm(p, key) {
    var h = (p && p.stageHistory) || [];
    for (var i = 0; i < h.length; i++) { if (h[i] && h[i].stage === key && h[i].at) return _ym(h[i].at); }
    return "";
  }
  // 날짜 정규화: '2026/6/5', '2026.06.05' 등 혼재 포맷을 'YYYY-MM-DD'로 → 문자열 비교 안전
  function _csDateKey(d) {
    var m = String(d || "").trim().match(/(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/);
    if (m) return m[1] + "-" + ("0" + m[2]).slice(-2) + "-" + ("0" + m[3]).slice(-2);
    var m2 = String(d || "").trim().match(/(\d{4})[-\/.](\d{1,2})/);
    return m2 ? (m2[1] + "-" + ("0" + m2[2]).slice(-2) + "-01") : "";
  }
  function _csRecogYm(projId) {
    if (projId == null || projId === "") return "";
    var k = String(projId);
    _recogCache = _recogCache || {};
    if (Object.prototype.hasOwnProperty.call(_recogCache, k)) return _recogCache[k];
    var out = "";
    var ps = (typeof state !== "undefined" && state && state.projects) || [];
    var p = null; for (var i = 0; i < ps.length; i++) { if (String(ps[i].id) === k) { p = ps[i]; break; } }
    if (p) {
      // ── 1순위: 이 프로젝트의 매출 인보이스 중 '최초 발행일' ──
      var invs = (typeof state !== "undefined" && state && state.invoices) || [], best = "";
      var linkIds = {};
      var _sl = (p.sales && (p.sales.invoiceLinkIds || (p.sales.invoiceLinkId ? [p.sales.invoiceLinkId] : []))) || [];
      _sl.forEach(function (id) { if (id !== "" && id != null) linkIds[String(id)] = 1; });
      invs.forEach(function (v) {
        if (!v || v.dir !== "issued") return;
        if (String(v.projectId || "") !== k && !linkIds[String(v.id)]) return;   // projectId 또는 명시 링크
        var d = _csDateKey(v.date); if (!d) return;
        if (!best || d < best) best = d;                                          // 복수면 최초(가장 이른) 발행일
      });
      if (best) out = _ym(best);
      if (!out && p.sales && p.sales.invoiceDate) out = _ym(p.sales.invoiceDate);
      if (!out) out = _csStageYm(p, "delivered");
      if (!out && p.targetDate) out = _ym(p.targetDate);   // 매출 미발생 → 예상 납기월로 이연 (수익비용대응)
      if (!out) out = _csStageYm(p, "po");
      if (!out) out = _csStageYm(p, "won");
      if (!out && p.regDate) out = _ym(p.regDate);
    }
    _recogCache[k] = out || "";
    return _recogCache[k];
  }
  // 인보이스의 귀속월
  //  · 매출(issued)  = 항상 자기 발행월 (후속 인보이스는 별건 매출로 각각 인식)
  //  · 매입(received)= 해당 프로젝트의 '최초 매출 인보이스 월'로 귀속 (수익비용대응)
  //  · 프로젝트 미연결이면 인보이스 발행일로 폴백
  function _csEffYm(inv) {
    if (_csBasis !== "project") return _ym(inv.date);
    if (inv.dir === "issued") return _ym(inv.date);
    return _csRecogYm(inv.projectId) || _ym(inv.date);
  }
  window.chasanEffYm = _csEffYm;

  window.chasanInvoiceAgg = function (ym) {
    _recogCache = null;   // 렌더 단위 캐시 초기화
    var buckets = {}; DEPTS.forEach(function (t) { buckets[t] = { revenue: 0, cogs: 0 }; });
    var invs = (typeof state !== "undefined" && state && state.invoices) || [];
    var fxMiss = [], assetList = [], assetSum = 0, revCount = 0, cogsCount = 0;
    invs.forEach(function (inv) {
      if (!inv || _csEffYm(inv) !== ym) return;
      var net = invNet(inv); if (!net) return;
      if (inv.chasanClass === "asset") { assetList.push(inv); assetSum += net; return; }   // 자산 처리 → P&L(매출·원가) 제외
      var conv = invVnd(inv, net); if (!conv.ok) fxMiss.push(inv);
      var d = invDept(inv); var into = buckets[d] || buckets.COMMON;
      if (inv.dir === "issued") { into.revenue += conv.v; revCount++; }
      else if (inv.dir === "received") { if (isCogsVendor(inv)) { into.cogs += conv.v; cogsCount++; } }
    });
    return { byDept: buckets, fxMissInv: fxMiss, assetInv: assetList, assetSum: assetSum, revCount: revCount, cogsCount: cogsCount };
  };

  /* ── 뱅크 집계 (판관비 전용 · 매출/매입원가는 인보이스 기준) ────── */
  window.chasanBankAgg = function (ym) {
    var buckets = {}; DEPTS.forEach(function (t) { buckets[t] = { revenue: 0, cogs: 0, opex: 0 }; });
    var uncat = { count: 0, debit: 0, credit: 0 }, untagged = 0, excludedSum = 0, unsplit = [], uncatList = [], untaggedList = [];
    var txns = (typeof state !== "undefined" && state && state.bankTxns) || [];
    txns.forEach(function (t) {
      if (!t || _ym(t.date) !== ym) return;
      var credit = +t.credit || 0, debit = +t.debit || 0;
      var kind = classify(t.category || "Uncategorized");
      if (kind === "excluded") { excludedSum += debit; return; }
      if (kind === "revenue" || kind === "refund" || kind === "cogs") return;   // 매출·매입원가는 인보이스 발생기준 → 뱅크 제외
      var d = csDept(t);
      if (d === "_FUR_UNSPLIT") { unsplit.push(t); d = CHASAN_CFG.furnitureDefault; }
      if (!t.dept && !t.chasanDept) { untagged++; untaggedList.push(t); }
      var into = buckets[d] || buckets.COMMON;
      if (kind === "opex") into.opex += debit - credit;
      else { uncat.count++; uncat.debit += debit; uncat.credit += credit; uncatList.push(t); }
    });
    return { ym: ym, byDept: buckets, uncat: uncat, untagged: untagged, excludedOpexSkipped: excludedSum, unsplit: unsplit, uncatList: uncatList, untaggedList: untaggedList };
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
    var out = {}, head = {}; DEPTS.forEach(function (t) { out[t] = 0; head[t] = 0; });
    lr.rows.forEach(function (row) {
      var w = _lw && _lw[row.id], vec;
      if (w) { var s = DEPTS.reduce(function (a, d) { return a + (+w[d] || 0); }, 0); vec = s > 0 ? {} : laborFallback(row.dept); if (s > 0) DEPTS.forEach(function (d) { vec[d] = (+w[d] || 0) / s; }); }
      else vec = laborFallback(row.dept);
      DEPTS.forEach(function (d) { out[d] += row.tc * (vec[d] || 0); head[d] += (vec[d] || 0); });
    });
    return { byDept: out, head: head, source: lr.source, finalized: lr.finalized, rows: lr.rows };
  };

  /* ── 채산 고정비(수기): 직원별 인건비 + 항목별 판관비 · 전월 공통 고정값 ── */
  var _fixed = null;
  window.chasanFixedReady = function () { return _fixed !== null; };
  window.chasanGetFixed = function () { return _fixed || { labor: [], opex: [] }; };
  async function chasanFixedLoad() {
    try { var r = await fetch(csUrl("/chasan_fixed_costs"), { cache: "no-cache" }); var v = (r.ok && await r.json()) || {}; _fixed = { labor: Array.isArray(v.labor) ? v.labor : [], opex: Array.isArray(v.opex) ? v.opex : [] }; }
    catch (e) { _fixed = { labor: [], opex: [] }; }
    return _fixed;
  }
  window.chasanFixedLoad = chasanFixedLoad;
  async function chasanFixedSave() {
    var r = await fetch(csUrl("/chasan_fixed_costs"), { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(_fixed || { labor: [], opex: [] }) });
    if (!r.ok) throw new Error("고정비 저장 HTTP " + r.status);
  }
  window.chasanFixedSave = chasanFixedSave;
  window.chasanFixAddLabor = function () { if (!_fixed) _fixed = { labor: [], opex: [] }; _fixed.labor.push({ id: "L" + Date.now(), name: "", amount: 0, dept: "COMMON", category: "" }); renderChasanPage(); };
  window.chasanFixDelLabor = function (i) { if (_fixed && _fixed.labor) { _fixed.labor.splice(i, 1); renderChasanPage(); } };
  window.chasanFixSetLabor = function (i, field, val) { if (_fixed && _fixed.labor && _fixed.labor[i]) { _fixed.labor[i][field] = (field === "amount") ? (parseFloat(String(val).replace(/,/g, "")) || 0) : val; } };
  window.chasanFixAddOpex = function () { if (!_fixed) _fixed = { labor: [], opex: [] }; _fixed.opex.push({ id: "O" + Date.now(), label: "", amount: 0, dept: "COMMON", category: "" }); renderChasanPage(); };
  window.chasanFixDelOpex = function (i) { if (_fixed && _fixed.opex) { _fixed.opex.splice(i, 1); renderChasanPage(); } };
  window.chasanFixSetOpex = function (i, field, val) { if (_fixed && _fixed.opex && _fixed.opex[i]) { _fixed.opex[i][field] = (field === "amount") ? (parseFloat(String(val).replace(/,/g, "")) || 0) : val; } };
  window.chasanFixSaveBtn = async function () { try { await chasanFixedSave(); if (typeof showToast === "function") showToast("고정비 저장 · Saved"); renderChasanPage(); } catch (e) { alert("저장 실패: " + (e && e.message)); } };
  window._chasanFixedPanelHTML = function () {
    var _fx = _fixed || { labor: [], opex: [] };
    var _fxDept = function (cur, cb) { return '<select onchange="' + cb + '" style="font-size:10px;padding:2px 4px;border:1px solid var(--border);border-radius:5px">' + DEPTS.map(function (d) { return '<option' + (d === cur ? ' selected' : '') + '>' + E(d) + '</option>'; }).join('') + '</select>'; };
    var _fxCat = function (cur, cb) { var o = (typeof bankCategoryOptions === 'function') ? bankCategoryOptions(cur || '') : ('<option>' + E(cur || '') + '</option>'); return '<select onchange="' + cb + '" style="font-size:10px;padding:2px 4px;border:1px solid var(--border);border-radius:5px;max-width:160px">' + o + '</select>'; };
    var _fxRow = function (e, i, kind) {
      var nf = kind === 'labor' ? 'name' : 'label';
      var setfn = kind === 'labor' ? 'chasanFixSetLabor' : 'chasanFixSetOpex';
      var delfn = kind === 'labor' ? 'chasanFixDelLabor' : 'chasanFixDelOpex';
      return '<tr>'
        + '<td style="padding:3px 6px"><input value="' + E(e[nf] || '') + '" onchange="' + setfn + '(' + i + ',\'' + nf + '\',this.value)" style="width:100%;min-width:90px;font-size:11px;padding:3px 5px;border:1px solid var(--border);border-radius:5px"></td>'
        + '<td style="padding:3px 6px;text-align:right"><input value="' + F(e.amount || 0) + '" onchange="' + setfn + '(' + i + ',\'amount\',this.value)" style="width:104px;font-size:11px;padding:3px 5px;border:1px solid var(--border);border-radius:5px;text-align:right;font-family:var(--mono)"></td>'
        + '<td style="padding:3px 6px">' + _fxDept(e.dept, setfn + '(' + i + ',\'dept\',this.value)') + '</td>'
        + '<td style="padding:3px 6px">' + _fxCat(e.category, setfn + '(' + i + ',\'category\',this.value)') + '</td>'
        + '<td style="padding:3px 6px;text-align:right"><button onclick="' + delfn + '(' + i + ')" style="border:1px solid var(--border);background:none;cursor:pointer;font-size:10px;padding:2px 7px;border-radius:5px;color:var(--danger)">삭제</button></td></tr>';
    };
    var _fxHead = '<thead><tr style="background:var(--surface-2)"><th style="padding:4px 6px;text-align:left;font-size:10px">이름/항목</th><th style="padding:4px 6px;text-align:right;font-size:10px">월 금액</th><th style="padding:4px 6px;text-align:left;font-size:10px">부서</th><th style="padding:4px 6px;text-align:left;font-size:10px">은행 카테고리(변동비 제외용)</th><th></th></tr></thead>';
    return '<details open style="margin:0 16px 12px;border:1px solid var(--border);border-radius:10px;padding:0 12px">'
      + '<summary style="cursor:pointer;font-size:12px;font-weight:700;color:var(--text-2);padding:10px 0">💼 채산 고정비 패널 · Fixed Costs (인건비 ' + _fx.labor.length + '명 · 판관비 ' + _fx.opex.length + '건) — 매달 고정 · 카테고리는 은행 변동비에서 자동 제외</summary>'
      + '<div style="font-size:11px;font-weight:700;color:#1d4ed8;margin:4px 0">인건비 · Labor (직원별)</div>'
      + '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:11px">' + _fxHead + '<tbody>' + _fx.labor.map(function (e, i) { return _fxRow(e, i, 'labor'); }).join('') + '</tbody></table></div>'
      + '<div style="padding:5px 0"><button onclick="chasanFixAddLabor()" style="border:1px solid var(--border);background:none;cursor:pointer;font-size:11px;padding:4px 11px;border-radius:6px">＋ 직원 추가</button></div>'
      + '<div style="font-size:11px;font-weight:700;color:#b45309;margin:8px 0 4px">고정판관비 · Fixed OpEx (항목별)</div>'
      + '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:11px">' + _fxHead + '<tbody>' + _fx.opex.map(function (e, i) { return _fxRow(e, i, 'opex'); }).join('') + '</tbody></table></div>'
      + '<div style="padding:5px 0 10px;display:flex;gap:10px;align-items:center;flex-wrap:wrap"><button onclick="chasanFixAddOpex()" style="border:1px solid var(--border);background:none;cursor:pointer;font-size:11px;padding:4px 11px;border-radius:6px">＋ 항목 추가</button><button onclick="chasanFixSaveBtn()" style="border:1px solid var(--text);background:var(--text);color:var(--bg);cursor:pointer;font-size:11px;padding:5px 14px;border-radius:7px">저장 · Save & Recalc</button><span style="font-size:10px;color:var(--text-3)">한 번 입력 → 모든 달 고정. 카테고리 지정 시 그 은행 거래는 변동비에서 빠져 이중계상 방지.</span></div>'
      + '</details>';
  };
  function _fixDept(e) { return (e && e.dept && DEPTS.indexOf(e.dept) >= 0) ? e.dept : "COMMON"; }
  function _fixedLaborByDept() { var o = {}; DEPTS.forEach(function (d) { o[d] = 0; }); ((_fixed && _fixed.labor) || []).forEach(function (e) { o[_fixDept(e)] += (+e.amount || 0); }); return o; }
  function _fixedOpexByDept() { var o = {}; DEPTS.forEach(function (d) { o[d] = 0; }); ((_fixed && _fixed.opex) || []).forEach(function (e) { o[_fixDept(e)] += (+e.amount || 0); }); return o; }
  function _fixedHeadByDept() { var o = {}; DEPTS.forEach(function (d) { o[d] = 0; }); ((_fixed && _fixed.labor) || []).forEach(function (e) { o[_fixDept(e)] += 1; }); return o; }
  function _fixedCatSet() { var st = {}; if (_fixed) { (((_fixed.labor) || []).concat((_fixed.opex) || [])).forEach(function (e) { var c = String((e && e.category) || "").trim(); if (c) st[c] = 1; }); } return st; }
  function _isFixedCat(cat) { return !!_fixedCatSet()[String(cat == null ? "" : cat).trim()]; }
  window.chasanFixedCats = function () { return Object.keys(_fixedCatSet()); };

  /* ── 채산 계산 ─────────────────────────────────────────────── */
  window.chasanCompute = async function (ym, opts) {
    opts = opts || {};
    if (_catMap === null) await chasanCatMapLoad();
    if (_cogsVendors === null) await chasanCogsVendorsLoad();
    if (_fixed === null) await chasanFixedLoad();
    var bank = chasanBankAgg(ym);
    var inv = chasanInvoiceAgg(ym);
    var lab = await chasanLabor(ym, opts);
    var ex = extraByDept(ym);
    var byDept = {};
    DEPTS.forEach(function (t) {
      var b = bank.byDept[t], iv = inv.byDept[t];
      var revenue = Math.round(iv.revenue), cogs = Math.round(iv.cogs), labor = Math.round(lab.byDept[t] || 0), opex = Math.round(b.opex), extra = Math.round(ex[t] || 0);
      var op = revenue - cogs - labor - opex - extra;
      byDept[t] = { revenue: revenue, cogs: cogs, labor: labor, opex: opex, extra: extra, op: op, margin: revenue ? op / revenue : 0 };
    });
    var headByDept = {}; DEPTS.forEach(function (t) { headByDept[t] = lab.head ? (lab.head[t] || 0) : 0; });
    var byDeptRaw = JSON.parse(JSON.stringify(byDept)), headByDeptRaw = JSON.parse(JSON.stringify(headByDept));   // 배분 전 원본(확정 뷰 "배분 풀기"용)
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
      var _comHead = headByDept.COMMON;
      REVENUE_DEPTS.forEach(function (t) { headByDept[t] += _comHead * ((CHASAN_CFG.commonWeights[t] || 0) * _factor); });
      var _res = _norm ? 0 : Math.max(0, 1 - _wsum);               // 미정규화 시 COMMON 잔여
      headByDept.COMMON = _comHead * _res;
      var C = {}; _keys.forEach(function (k) { C[k] = Math.round(com[k] * _res); });
      byDept.COMMON = { revenue: C.revenue, cogs: C.cogs, labor: C.labor, opex: C.opex, extra: C.extra,
        op: C.revenue - C.cogs - C.labor - C.opex - C.extra, margin: C.revenue ? (C.revenue - C.cogs - C.labor - C.opex - C.extra) / C.revenue : 0 };
    }
    var tot = { revenue: 0, cogs: 0, labor: 0, opex: 0, extra: 0, op: 0 };
    DEPTS.forEach(function (t) { ["revenue", "cogs", "labor", "opex", "extra", "op"].forEach(function (k) { tot[k] += byDept[t][k]; }); });
    tot.margin = tot.revenue ? tot.op / tot.revenue : 0;
    var totHead = DEPTS.reduce(function (a, t) { return a + (headByDept[t] || 0); }, 0);
    return { ym: ym, byDept: byDept, totals: tot, headByDept: headByDept, totHead: totHead, byDeptRaw: byDeptRaw, headByDeptRaw: headByDeptRaw, laborSource: lab.source, laborFinalized: lab.finalized, laborRows: lab.rows,
      dq: { uncat: bank.uncat, untagged: bank.untagged, unsplit: bank.unsplit, uncatList: bank.uncatList, untaggedList: bank.untaggedList, invFxMiss: inv.fxMissInv, invAsset: inv.assetInv, invAssetSum: inv.assetSum, revCount: inv.revCount, cogsCount: inv.cogsCount }, allocated: CHASAN_CFG.allocateCommon };
  };

  /* 두 기준을 연속 계산 · 확정 스냅샷에 함께 보관 (렌더 없이 basis만 스위칭) */
  window.chasanComputeBoth = async function (ym, opts) {
    var keep = _csBasis, out = {};
    try {
      for (var i = 0; i < 2; i++) {
        var b = i === 0 ? "invoice" : "project";
        _csBasis = b; _recogCache = null;
        var c = await chasanCompute(ym, opts || {});
        out[b] = {
          byDept: c.byDept, totals: c.totals, headByDept: c.headByDept, totHead: c.totHead,
          byDeptRaw: c.byDeptRaw, headByDeptRaw: c.headByDeptRaw, allocated: c.allocated
        };
      }
    } finally { _csBasis = keep; _recogCache = null; }
    return out;
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
  /* ── 과거 확정월 재기준화 · Rebaseline ────────────────────────────────
     확정된 월을 두 기준(인보이스/프로젝트 귀속)으로 다시 확정한다.
     · 원본 확정본은 _prior[] 에 append 보존 — 본사 보고분 추적 가능
     · dryRun:true 면 저장하지 않고 차이만 반환 (반드시 먼저 실행할 것)   */
  window.chasanRebaselineMonth = async function (ym, opts) {
    opts = opts || {};
    var snap = await chasanLoadSnapshot(ym);
    if (!snap || !snap.finalizedAt) return { ym: ym, skipped: "확정본 없음" };

    if (typeof chasanFcCfgLoad === "function") await chasanFcCfgLoad();
    if (typeof chasanFixedLoad === "function") await chasanFixedLoad();
    if (typeof chasanLwLoad === "function") await chasanLwLoad();
    if (typeof chasanCogsVendorsLoad === "function") await chasanCogsVendorsLoad();
    if (typeof chasanExtraLoad === "function") await chasanExtraLoad(ym);

    var both = await chasanComputeBoth(ym, { fallbackLive: true });
    var oldOp = (snap.totals && +snap.totals.op) || 0;
    var newInvOp = (both.invoice && both.invoice.totals && +both.invoice.totals.op) || 0;
    var newPrjOp = (both.project && both.project.totals && +both.project.totals.op) || 0;
    var diff = {
      ym: ym, hadBoth: !!snap.byBasis,
      before: Math.round(oldOp),
      afterInvoice: Math.round(newInvOp),
      afterProject: Math.round(newPrjOp),
      driftInvoice: Math.round(newInvOp - oldOp),
      finalizedAt: snap.finalizedAt, finalizedBy: snap.finalizedBy || ""
    };
    if (opts.dryRun) return diff;

    // 원본 보존 (최대 5세대)
    var prior = Array.isArray(snap._prior) ? snap._prior.slice(-4) : [];
    prior.push({
      finalizedAt: snap.finalizedAt, finalizedBy: snap.finalizedBy || "",
      basis: snap.basis || "invoice", byDept: snap.byDept, totals: snap.totals,
      headByDept: snap.headByDept, totHead: snap.totHead,
      rebaselinedAt: new Date().toISOString()
    });

    var base = both.invoice || {};
    await chasanSaveSnapshot(ym, {
      byDept: base.byDept, totals: base.totals, headByDept: base.headByDept, totHead: base.totHead,
      byDeptRaw: base.byDeptRaw, headByDeptRaw: base.headByDeptRaw, allocated: base.allocated,
      fx: snap.fx || null, basis: "both", viewBasis: snap.viewBasis || "invoice",
      byBasis: both, laborFinalized: true, _prior: prior
    }, true);
    diff.saved = true;
    return diff;
  };

  window.chasanRebaselineAll = async function (opts) {
    opts = opts || {};
    if (!opts.dryRun && !_csIsAdmin()) { alert("재확정은 관리자만 가능합니다."); return null; }
    var all = await chasanLoadAll();
    var months = Object.keys(all).filter(function (k) {
      if (!/^\d{4}-\d{2}$/.test(k)) return false;
      if (!(all[k] && all[k].finalizedAt)) return false;
      if (opts.year && k.slice(0, 4) !== String(opts.year)) return false;
      if (opts.onlyMissing && all[k].byBasis) return false;   // 이미 두 기준 보유 월은 건너뜀
      return true;
    }).sort();
    var out = [];
    for (var i = 0; i < months.length; i++) {
      try { out.push(await chasanRebaselineMonth(months[i], opts)); }
      catch (e) { out.push({ ym: months[i], error: e.message }); }
    }
    var F2 = function (n) { return (n == null ? "—" : Math.round(n).toLocaleString()); };
    console.table(out.map(function (d) {
      return { 월: d.ym, 기존영업이익: F2(d.before), "인보이스기준(신)": F2(d.afterInvoice),
               "프로젝트기준(신)": F2(d.afterProject), 변동: F2(d.driftInvoice),
               상태: d.error ? "오류:" + d.error : (d.saved ? "저장됨" : (opts.dryRun ? "미리보기" : (d.skipped || "—"))) };
    }));
    return out;
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
  window.chasanSetTxnCat = function (id, val) {
    if (typeof setBankTxnCategory === "function") { setBankTxnCategory(id, val); }
    else { var t = (typeof state !== "undefined" && state.bankTxns || []).find(function (x) { return String(x.id) === String(id); }); if (t) { t.category = val; if (typeof _stampEdit === "function") _stampEdit(t); if (typeof saveState === "function") saveState(); } }
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

  // ── 예상채산 (BEP): 다음달 손익분기 목표매출 역산 ──
  //   COGS=매출×cogsRate → 공헌이익률=(1-cogsRate). 인건비=전월 확정, 고정판관비=fixedOpexCats만.
  //   BEP 목표매출 = (인건비 + 고정판관비) / 공헌이익률.  변동판관비·EXTRA는 0 가정.
  var _fcCfg = null;
  window.chasanFcCfgLoad = async function () {
    try { var r = await fetch(csUrl("/chasan_forecast_cfg"), { cache: "no-cache" }); _fcCfg = (r.ok && await r.json()) || {}; } catch (e) { _fcCfg = {}; }
    _fcCfg.excludeTxns = _fcCfg.excludeTxns || {};
    _fcCfg.manualItems = _fcCfg.manualItems || [];
    if (!_fcCfg.fixedOpexCats) _fcCfg.fixedOpexCats = ((CHASAN_CFG.forecast && CHASAN_CFG.forecast.fixedOpexCats) || ["Office Rent", "Utilities", "Internet & Telecom", "Service fee"]).slice();
    if (_fcCfg.cogsRate == null) _fcCfg.cogsRate = (CHASAN_CFG.forecast && CHASAN_CFG.forecast.cogsRate) || 0.85;
    return _fcCfg;
  };
  window.chasanFcCfgSave = async function () {
    var r = await fetch(csUrl("/chasan_forecast_cfg"), { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(_fcCfg || {}) });
    if (!r.ok) throw new Error("HTTP " + r.status);
  };
  var _fcPanelOpen = false, _fcCatOpen = {}, _fcDetailOpen = {}, _fcTxnDetailOpen = {};
  window.chasanFcPanelOpen = function (o) { _fcPanelOpen = o; };
  window.chasanFcCatOpen = function (c, o) { _fcCatOpen[c] = o; };
  function _fcRerender() { var el = document.getElementById("csForecast"); if (el && window._csLastR) el.innerHTML = window._fcBuildHTML(window._csLastYm, window._csLastR); }
  window.chasanFcToggleDept = function (dept) { _fcDetailOpen[dept] = !_fcDetailOpen[dept]; _fcRerender(); };   // 부서 상세 펼치기/접기
  window.chasanFcToggleAlloc = function (on) {   // COMMON 배분 토글 → 인건비 재배분 위해 전체 재계산
    CHASAN_CFG.allocateCommon = !!on;
    if (window._fcHost && window._fcYm) renderChasanForecastView(window._fcHost, window._fcYm);
    else _fcRerender();
  };
  window.chasanFcToggleCat = function (cat) { if (!_fcCfg) return; var i = _fcCfg.fixedOpexCats.indexOf(cat); if (i >= 0) _fcCfg.fixedOpexCats.splice(i, 1); else _fcCfg.fixedOpexCats.push(cat); _fcRerender(); };
  window.chasanFcToggleTxn = function (id) { if (!_fcCfg) return; if (_fcCfg.excludeTxns[id]) delete _fcCfg.excludeTxns[id]; else _fcCfg.excludeTxns[id] = true; _fcRerender(); };
  window.chasanFcTxnDetail = function (cat) { _fcTxnDetailOpen[cat] = !_fcTxnDetailOpen[cat]; _fcRerender(); };   // 변동 판관비 카테고리 거래 상세 펼치기/접기
  window.chasanFcRetagTxn = function (id, dept) { var t = (typeof state !== "undefined" && state.bankTxns || []).find(function (x) { return String(x.id) === String(id); }); if (!t) return; t.chasanDept = dept; if (typeof _stampEdit === "function") _stampEdit(t); if (typeof saveState === "function") saveState(); _fcRerender(); };
  window.chasanFcSetTxnCat = function (id, val) { if (typeof setBankTxnCategory === "function") { setBankTxnCategory(id, val); } else { var t = (typeof state !== "undefined" && state.bankTxns || []).find(function (x) { return String(x.id) === String(id); }); if (t) { t.category = val; if (typeof _stampEdit === "function") _stampEdit(t); if (typeof saveState === "function") saveState(); } } _fcRerender(); };
  window.chasanFcAddManual = function () {
    if (!_fcCfg) return;
    var lb = (document.getElementById("fcmLabel").value || "").trim();
    var am = +(document.getElementById("fcmAmt").value || 0);
    var dp = document.getElementById("fcmDept").value || "COMMON";
    if (!lb || !am) { if (typeof showToast === "function") showToast("항목명·금액 입력 · Enter name & amount"); return; }
    _fcCfg.manualItems.push({ label: lb, amount: am, dept: dp }); _fcRerender();
  };
  window.chasanFcDelManual = function (i) { if (!_fcCfg) return; _fcCfg.manualItems.splice(i, 1); _fcRerender(); };
  window.chasanFcSetCogs = function (v) { if (!_fcCfg) return; var n = +v; if (!isNaN(n) && n > 0 && n < 100) { _fcCfg.cogsRate = n / 100; _fcRerender(); } };
  window.chasanFcSave = async function () { try { await chasanFcCfgSave(); if (typeof showToast === "function") showToast("예상채산 설정 저장 ✓ · Saved"); } catch (e) { if (typeof showToast === "function") showToast("저장 실패: " + e.message); } };

  window.chasanForecast = function (ym, r) {
    var cfg = _fcCfg || {};
    var cogsRate = cfg.cogsRate != null ? cfg.cogsRate : 0.85;
    var cm = 1 - cogsRate;
    var fixedCats = cfg.fixedOpexCats || [];
    var excl = cfg.excludeTxns || {};
    var manual = cfg.manualItems || [];
    var txns = (typeof state !== "undefined" && state && state.bankTxns) || [];
    var cats = {};
    var fxRaw = {}, fxItems = {}, varRaw = {}; DEPTS.forEach(function (t) { fxRaw[t] = 0; fxItems[t] = []; varRaw[t] = 0; });
    // 고정비 패널 baseline (카테고리·부서별)
    var _pbase = {}; ((_fixed && _fixed.opex) || []).forEach(function (e) { var c = String((e.category) || "").trim(); if (!c) return; var d = DEPTS.indexOf(e.dept) >= 0 ? e.dept : "COMMON"; (_pbase[c] = _pbase[c] || {}); _pbase[c][d] = (_pbase[c][d] || 0) + (+e.amount || 0); });
    // 은행 opex 카테고리·부서별 집계 (전체 표시용)
    var _bank = {};
    txns.forEach(function (t) {
      if (!t || _ym(t.date) !== ym) return;
      if (classify(t.category || "Uncategorized") !== "opex") return;
      var cat = t.category || "(미분류)";
      var d = csDept(t); if (d === "_FUR_UNSPLIT") d = CHASAN_CFG.furnitureDefault;
      var amt = (+t.debit || 0) - (+t.credit || 0);
      (_bank[cat] = _bank[cat] || {}); _bank[cat][d] = (_bank[cat][d] || 0) + amt;
      (cats[cat] = cats[cat] || { txns: [], sumAll: 0, sumVar: 0, base: 0 });
      cats[cat].txns.push({ id: t.id, date: t.date || "", note: (t.note || t.ref || "").trim(), dept: d, amt: amt });
      cats[cat].sumAll += amt;
    });
    // 변동판관비 = 은행 − 고정 baseline (카테고리·부서별, 초과분만; A방식)
    Object.keys(_bank).forEach(function (cat) {
      Object.keys(_bank[cat]).forEach(function (d) {
        var base = (_pbase[cat] && _pbase[cat][d]) || 0;
        var v = Math.max(0, _bank[cat][d] - base);
        varRaw[d] += v;
        if (cats[cat]) { cats[cat].sumVar += v; cats[cat].base += Math.min(base, _bank[cat][d]); }
      });
    });
    // 고정판관비 = 고정비 패널 (baseline)
    ((_fixed && _fixed.opex) || []).forEach(function (e) { var d = DEPTS.indexOf(e.dept) >= 0 ? e.dept : "COMMON"; var a = +e.amount || 0; fxRaw[d] += a; (fxItems[d] || (fxItems[d] = [])).push({ kind: "fixed", label: (e.label || e.category || "고정비") + (e.category ? " · " + e.category : ""), amt: a }); });
    var fxDirect = {}; DEPTS.forEach(function (t) { fxDirect[t] = fxRaw[t]; });
    var fx = {}; DEPTS.forEach(function (t) { fx[t] = fxRaw[t]; });
    var _plab = _fixedLaborByDept(); var laborD = {}; DEPTS.forEach(function (t) { laborD[t] = _plab[t] || 0; });
    var varD = {}; DEPTS.forEach(function (t) { varD[t] = varRaw[t] || 0; });
    var allocInfo = { on: !!CHASAN_CFG.allocateCommon, factor: 1, weights: CHASAN_CFG.commonWeights || {}, commonDirect: fxDirect.COMMON || 0 };
    if (CHASAN_CFG.allocateCommon) {
      var wsum = REVENUE_DEPTS.reduce(function (a, t) { return a + (CHASAN_CFG.commonWeights[t] || 0); }, 0);
      var norm = CHASAN_CFG.commonAllocNormalize !== false; var factor = (norm && wsum > 0) ? 1 / wsum : 1;
      allocInfo.factor = factor;
      var comfx = fx.COMMON;
      REVENUE_DEPTS.forEach(function (t) { fx[t] += comfx * ((CHASAN_CFG.commonWeights[t] || 0) * factor); });
      fx.COMMON = norm ? 0 : comfx * Math.max(0, 1 - wsum);
      var comlab = laborD.COMMON;
      REVENUE_DEPTS.forEach(function (t) { laborD[t] += comlab * ((CHASAN_CFG.commonWeights[t] || 0) * factor); });
      laborD.COMMON = norm ? 0 : comlab * Math.max(0, 1 - wsum);
      var comvar = varD.COMMON;
      REVENUE_DEPTS.forEach(function (t) { varD[t] += comvar * ((CHASAN_CFG.commonWeights[t] || 0) * factor); });
      varD.COMMON = norm ? 0 : comvar * Math.max(0, 1 - wsum);
    }
    var out = {}, tot = { labor: 0, fixedOpex: 0, varOpex: 0, bepRev: 0, cogs: 0 };
    DEPTS.forEach(function (t) {
      var labor = Math.round(laborD[t] || 0);
      var fo = Math.round(fx[t] || 0);
      var vo = Math.round(varD[t] || 0);
      var bep = cm > 0 ? Math.round((labor + fo + vo) / cm) : 0;
      out[t] = { labor: labor, fixedOpex: fo, varOpex: vo, bepRev: bep, cogs: Math.round(bep * cogsRate) };
      tot.labor += labor; tot.fixedOpex += fo; tot.varOpex += vo; tot.bepRev += bep;
    });
    tot.cogs = Math.round(tot.bepRev * cogsRate);
    var opexCats = Object.keys(cats).map(function (c) { return { cat: c, sumAll: cats[c].sumAll, sumVar: cats[c].sumVar, base: cats[c].base, txns: cats[c].txns.sort(function (a, b) { return b.amt - a.amt; }) }; }).sort(function (a, b) { return b.sumAll - a.sumAll; });
    return { cogsRate: cogsRate, cm: cm, byDept: out, totals: tot, opexCats: opexCats, manualItems: manual, fxItems: fxItems, fxDirect: fxDirect, allocInfo: allocInfo };
  };

  window._fcBuildHTML = function (ym, r) {
    var _fu = _usd && _rate;
    var F2 = function (v) { return _fu ? Math.round((v || 0) / _rate).toLocaleString("en-US") : ((typeof F === "function") ? F(v) : Math.round(v || 0).toLocaleString("en-US")); };
    var _unit = _fu ? "USD" : "VND";
    var fc = chasanForecast(ym, r);
    var T = DEPTS;
    var _liveRevRow = '<tr style="background:var(--surface-2)"><td style="padding:6px 10px;text-align:left;font-weight:700">\uD83D\uDCB0 \uC2E4\uC2DC\uAC04 \uB9E4\uCD9C \u00B7 Live Revenue <span style="font-size:9px;color:var(--text-3)">\uBC1C\uD589 \uC778\uBCF4\uC774\uC2A4</span></td>' + T.map(function (t) { return '<td style="padding:6px 10px;text-align:right;font-family:var(--mono);font-weight:700">' + F2(((r.byDept[t] || {}).revenue) || 0) + '</td>'; }).join("") + '<td style="padding:6px 10px;text-align:right;font-family:var(--mono);font-weight:700">' + F2(((r.totals || {}).revenue) || 0) + '</td></tr>';
    var _bepPct = function (rv, bp) { var p = bp > 0 ? Math.round(rv / bp * 100) : 0; return { col: p >= 100 ? "#15803d" : (p >= 70 ? "#d97706" : "#dc2626"), s: bp > 0 ? p + "%" : "\u2014" }; };
    var _bepPctRow = '<tr style="color:var(--text-3)"><td style="padding:4px 10px;text-align:left;font-size:11px">\u21B3 BEP \uB2EC\uC131\uB960 \u00B7 vs Target</td>' + T.map(function (t) { var q = _bepPct(((r.byDept[t] || {}).revenue) || 0, (fc.byDept[t] || {}).bepRev || 0); return '<td style="padding:4px 10px;text-align:right;font-family:var(--mono);font-size:11px;color:' + q.col + '">' + q.s + '</td>'; }).join("") + (function () { var q = _bepPct(((r.totals || {}).revenue) || 0, fc.totals.bepRev || 0); return '<td style="padding:4px 10px;text-align:right;font-family:var(--mono);font-size:11px;font-weight:700;color:' + q.col + '">' + q.s + '</td>'; })() + '</tr>';
    var _fcRowLine = function (label, val, bold, color) {
      return '<div style="display:flex;gap:8px;font-size:11px;padding:3px 0' + (bold ? ";font-weight:700" : "") + '"><span style="flex:1;min-width:0' + (color ? ";color:" + color : "") + '">' + label + '</span><span style="font-family:var(--mono);flex-shrink:0' + (color ? ";color:" + color : "") + '">' + F2(val) + '</span></div>';
    };
    var _fcDeptDetail = function (dept) {
      var b = fc.byDept[dept], items = fc.fxItems[dept] || [], direct = fc.fxDirect[dept] || 0, ai = fc.allocInfo;
      var isRev = REVENUE_DEPTS.indexOf(dept) >= 0;
      var allocShare = (ai.on && isRev) ? Math.round(ai.commonDirect * ((ai.weights[dept] || 0) * ai.factor)) : 0;
      var allocPct = (ai.on && isRev) ? Math.round((ai.weights[dept] || 0) * ai.factor * 100) : 0;
      var h = '<div style="background:var(--surface-2);border-radius:10px;padding:12px 14px;margin:8px 16px">';
      h += '<div style="font-size:12px;font-weight:700;margin-bottom:8px;display:flex;justify-content:space-between"><span>' + E(dept) + ' · 예상채산 구성 · Forecast breakdown</span><a href="javascript:void(0)" onclick="chasanFcToggleDept(\'' + dept + '\')" style="color:var(--text-3);text-decoration:none;font-size:11px">닫기 ✕</a></div>';
      h += _fcRowLine("인건비 · Labor (고정비 패널)", b.labor);
      h += '<div style="font-size:11px;color:var(--text-3);margin:6px 0 2px">고정판관비 · Fixed OpEx (직접귀속)</div>';
      if (items.length) items.forEach(function (it) {
        var lbl = it.kind === "manual" ? (E(it.label) + ' <span style="color:var(--text-3)">(수동)</span>') : ((it.date ? E(it.date) + " · " : "") + E(it.cat) + (it.note ? " · " + E(it.note) : ""));
        h += '<div style="display:flex;gap:8px;font-size:11px;padding:2px 0;border-top:1px solid var(--border)"><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + lbl + '</span><span style="font-family:var(--mono);flex-shrink:0">' + F2(it.amt) + '</span></div>';
      }); else h += '<div style="font-size:11px;color:var(--text-3)">직접귀속 고정비 없음</div>';
      h += _fcRowLine("직접귀속 소계 · Direct subtotal", direct, true);
      if (ai.on && isRev && allocShare) h += _fcRowLine("＋ COMMON 배분 · Allocated (" + allocPct + "%)", allocShare, false, "#7c3aed");
      if (dept === "COMMON" && ai.on) h += '<div style="font-size:11px;color:#7c3aed;padding:3px 0">→ COMMON 직접 고정비는 FUR VN/FUR MX/SOURCING로 3:3:1 배분되어 각 부서에 반영됨</div>';
      h += _fcRowLine("고정판관비 계 · Fixed OpEx total", b.fixedOpex, true);
      h += _fcRowLine("변동판관비 · Variable OpEx (은행 실적 − 고정 baseline)", b.varOpex);
      h += '<div style="border-top:2px solid var(--text);margin-top:6px;padding-top:6px">';
      h += _fcRowLine("🎯 BEP 목표매출 = (인건비＋고정판관비＋변동판관비) ÷ 공헌이익률(" + Math.round(fc.cm * 100) + "%)", b.bepRev, true, "#7c3aed");
      h += _fcRowLine("매입원가 · COGS (" + Math.round(fc.cogsRate * 100) + "%)", b.cogs);
      h += '</div></div>';
      return h;
    };
    var _cellClick = function (t) { return ';cursor:pointer;text-decoration:underline dotted' + (_fcDetailOpen[t] ? ';background:var(--surface-2)' : '') + '" onclick="chasanFcToggleDept(\'' + t + '\')"'; };
    var row = function (label, key, cls) {
      return '<tr' + (cls || "") + '><td style="padding:6px 10px;text-align:left">' + label + '</td>'
        + T.map(function (t) { return '<td style="padding:6px 10px;text-align:right;font-family:var(--mono)' + _cellClick(t) + '>' + F2(fc.byDept[t][key]) + '</td>'; }).join("")
        + '<td style="padding:6px 10px;text-align:right;font-family:var(--mono);font-weight:700">' + F2(fc.totals[key]) + '</td></tr>';
    };
    var h = ((typeof _chasanFixedPanelHTML === "function") ? _chasanFixedPanelHTML() : "") + '<div style="margin:0 16px 12px"><div style="font-size:13px;font-weight:700;color:var(--text-2);padding:8px 0">📊 다음달 예상채산 (BEP) · Next-month Break-even Forecast</div>';
    h += '<div style="font-size:11px;color:var(--text-3);margin:2px 0 8px;line-height:1.9">가정 · Assumptions: 매입원가 <input type="number" value="' + Math.round(fc.cogsRate * 100) + '" onchange="chasanFcSetCogs(this.value)" style="width:46px;text-align:right;border:1px solid var(--border);border-radius:5px;padding:2px 4px;font-size:11px">% (공헌이익률 ' + Math.round(fc.cm * 100) + '%) · 인건비·고정판관비=고정비 패널 · 변동판관비=은행 실적(패널 baseline 차감) · BEP=영업이익 0 최소매출</div>';
    h += '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:var(--surface-2)"><th style="padding:6px 10px;text-align:left;font-size:10px;color:var(--text-3)">항목 · Item</th>'
      + T.map(function (t) { return '<th style="padding:6px 10px;text-align:right;font-size:10px;color:var(--text-3)">' + E(t) + '</th>'; }).join("")
      + '<th style="padding:6px 10px;text-align:right;font-size:10px;color:var(--text-3)">합계 (' + _unit + ')</th></tr></thead><tbody>'
      + _liveRevRow + _bepPctRow
      + row("(−) 인건비 · Labor (전월)", "labor")
      + row("(−) 고정판관비 · Fixed OpEx", "fixedOpex")
      + row("(−) 변동판관비 · Variable OpEx", "varOpex")
      + '<tr style="border-top:2px solid var(--text)"><td style="padding:8px 10px;font-weight:700;color:#7c3aed">🎯 BEP 목표매출 · Target Revenue</td>'
      + T.map(function (t) { return '<td style="padding:8px 10px;text-align:right;font-family:var(--mono);font-weight:700;color:#7c3aed' + _cellClick(t) + '>' + F2(fc.byDept[t].bepRev) + '</td>'; }).join("")
      + '<td style="padding:8px 10px;text-align:right;font-family:var(--mono);font-weight:700;color:#7c3aed">' + F2(fc.totals.bepRev) + '</td></tr>'
      + row('(−) 매입원가 · COGS (' + Math.round(fc.cogsRate * 100) + '%)', "cogs", ' style="color:var(--text-3)"')
      + '<tr style="font-weight:600;color:var(--text-3)"><td style="padding:6px 10px">= 영업이익 · OP (BEP)</td>' + T.map(function () { return '<td style="padding:6px 10px;text-align:right;font-family:var(--mono)">0</td>'; }).join("") + '<td style="padding:6px 10px;text-align:right;font-family:var(--mono)">0</td></tr>'
      + '</tbody></table></div>';
    h += '<div style="font-size:10px;color:var(--text-3);margin:2px 16px 0">💡 부서 금액을 클릭하면 구성 내역이 아래에 펼쳐집니다 · Click a dept amount to expand.</div>';
    DEPTS.filter(function (t) { return _fcDetailOpen[t]; }).forEach(function (t) { h += _fcDeptDetail(t); });
    h += '<div style="margin-top:12px;border-top:1px solid var(--border);padding-top:10px"><div style="font-size:12px;font-weight:700;color:var(--text-2);margin-bottom:6px">은행 판관비 · 고정/변동 분해 <span style="font-size:10px;color:var(--text-3)">(고정=패널 baseline 차감분 · 초과분=변동)</span></div>';
    h += '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:11px"><thead><tr style="background:var(--surface-2)"><th style="padding:4px 8px;text-align:left;font-size:10px;color:var(--text-3)">카테고리 · Category</th><th style="padding:4px 8px;text-align:right;font-size:10px;color:var(--text-3)">은행 전체 · Bank</th><th style="padding:4px 8px;text-align:right;font-size:10px;color:var(--text-3)">고정 차감 · Fixed</th><th style="padding:4px 8px;text-align:right;font-size:10px;color:var(--text-3)">변동 · Variable</th></tr></thead><tbody>';
    if (!fc.opexCats.length) h += '<tr><td colspan="4" style="padding:6px 8px;color:var(--text-3)">이 달 은행 판관비 거래 없음</td></tr>';
    fc.opexCats.forEach(function (c) {
      var _tx = c.txns || [], _open = !!_fcTxnDetailOpen[c.cat], _catE = E(c.cat).replace(/\x27/g, "\\\x27");
      h += '<tr style="cursor:pointer" onclick="chasanFcTxnDetail(\'' + _catE + '\')"><td style="padding:3px 8px">' + (_tx.length ? '<span style="color:var(--text-3);font-size:9px">' + (_open ? '▾' : '▸') + '</span> ' : '') + E(c.cat) + (c.base > 0 ? ' <span style="font-size:9px;color:#1d4ed8">[패널]</span>' : '') + (_tx.length ? ' <span style="font-size:9px;color:var(--text-3)">(' + _tx.length + '건)</span>' : '') + '</td>'
        + '<td style="padding:3px 8px;text-align:right;font-family:var(--mono)">' + F2(c.sumAll) + '</td>'
        + '<td style="padding:3px 8px;text-align:right;font-family:var(--mono);color:#1d4ed8">' + (c.base > 0 ? '\u2212' + F2(c.base) : '—') + '</td>'
        + '<td style="padding:3px 8px;text-align:right;font-family:var(--mono);font-weight:600">' + F2(c.sumVar) + '</td></tr>';
      if (_open) {
        h += '<tr><td colspan="4" style="padding:0 8px 8px"><div style="background:var(--surface-2);border-radius:8px;padding:8px 10px">'
          + '<div style="font-size:10px;color:var(--text-3);margin-bottom:4px">' + E(c.cat) + ' · 거래 상세 · Transactions (' + _tx.length + '건) · 부서·카테고리 변경 시 즉시 반영</div>';
        if (!_tx.length) h += '<div style="font-size:11px;color:var(--text-3)">거래 없음</div>';
        _tx.forEach(function (it) {
          var _idE = String(it.id).replace(/\x27/g, "\\\x27");
          var _depSel = '<select onclick="event.stopPropagation()" onchange="chasanFcRetagTxn(\'' + _idE + '\',this.value)" style="font-size:10px;padding:2px 4px;border:1px solid var(--border);border-radius:5px">' + DEPTS.map(function (d) { return '<option' + (d === it.dept ? " selected" : "") + '>' + E(d) + '</option>'; }).join("") + '</select>';
          var _catSel = (typeof bankCategoryOptions === "function") ? '<select onclick="event.stopPropagation()" onchange="chasanFcSetTxnCat(\'' + _idE + '\',this.value)" style="font-size:10px;padding:2px 4px;border:1px solid var(--border);border-radius:5px;max-width:150px">' + bankCategoryOptions(c.cat) + '</select>' : '';
          h += '<div style="padding:4px 0;border-top:1px solid var(--border)">'
            + '<div style="display:flex;gap:8px;font-size:11px;align-items:center">'
            + '<span style="color:var(--text-3);flex-shrink:0">' + E(it.date) + '</span>'
            + '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + E(it.note).replace(/"/g, "&quot;") + '">' + E(it.note || "—") + '</span>'
            + '<span style="font-family:var(--mono);flex-shrink:0;' + (it.amt < 0 ? "color:var(--danger)" : "") + '">' + F2(it.amt) + '</span></div>'
            + '<div style="display:flex;gap:6px;align-items:center;margin-top:3px;flex-wrap:wrap">' + _depSel + _catSel + '</div></div>';
        });
        h += '</div></td></tr>';
      }
    });
    h += '</tbody></table></div><div style="font-size:10px;color:var(--text-3);margin-top:6px">💡 인건비·고정판관비는 위 <b>💼 고정비 패널</b>에서 관리. 은행 거래 중 패널 카테고리는 고정 baseline만큼만 차감되고 <b>초과분만 변동비</b>로 잡힙니다(SERVICE FEE처럼 혼합 카테고리 안전).</div>';
    h += '</div>';
    return h;
  };

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
    if (_fcCfg === null) await chasanFcCfgLoad();
    if (_cogsVendors === null) await chasanCogsVendorsLoad();
    await chasanExtraLoad(ym);

    var _live = await chasanCompute(ym, { fallbackLive: opts.fallbackLive !== false });
    var _snap = await chasanLoadSnapshot(ym);
    // 두 기준 확정본이 있으면 현재 토글에 맞는 쪽을 꺼내 쓴다 (구버전 스냅샷은 최상위 그대로)
    var _snapBasisMissing = false;
    if (_snap && _snap.byBasis) {
      var _sb = _snap.byBasis[_csBasis];
      if (_sb && _sb.byDept && _sb.totals) {
        _snap = Object.assign({}, _snap, {
          byDept: _sb.byDept, totals: _sb.totals, headByDept: _sb.headByDept, totHead: _sb.totHead,
          byDeptRaw: _sb.byDeptRaw, headByDeptRaw: _sb.headByDeptRaw, allocated: _sb.allocated
        });
      } else if (_csBasis === "project") { _snapBasisMissing = true; }
    } else if (_snap && _snap.finalizedAt && _csBasis === "project") { _snapBasisMissing = true; }
    var _final = !!(_snap && _snap.finalizedAt && _snap.byDept && _snap.totals);
    var _drift = _final ? Math.round(Math.abs((_live.totals.op || 0) - (_snap.totals.op || 0))) : 0;
    if (!_final) _csViewRaw = false;                                              // 배분 풀기는 확정 뷰 전용
    var _rawAvail = !!(_final && _snap.byDeptRaw && typeof _snap.byDeptRaw === "object");
    var _showRaw  = !!(_final && _csViewRaw);                                     // 확정본 불변, 표시만 배분 전
    var _rawFromLive = _showRaw && !_rawAvail;                                    // 과거 확정본에 원본 미저장 → 라이브 배분전 fallback
    var _rawByDept = _showRaw ? (_rawAvail ? _snap.byDeptRaw : _live.byDeptRaw) : null;
    var _rawHead   = _showRaw ? (_rawAvail ? (_snap.headByDeptRaw || _snap.headByDept) : _live.headByDeptRaw) : null;
    var _rawTotals = null, _rawTotHead = 0;
    if (_showRaw && _rawByDept) {                                                 // 합계 행 = 원본 컬럼합(반올림 잔차 방지)
      _rawTotals = { revenue: 0, cogs: 0, labor: 0, opex: 0, extra: 0, op: 0 };
      DEPTS.forEach(function (t) { ["revenue","cogs","labor","opex","extra","op"].forEach(function (k) { _rawTotals[k] += ((_rawByDept[t] && _rawByDept[t][k]) || 0); }); _rawTotHead += ((_rawHead && _rawHead[t]) || 0); });
      _rawTotals.margin = _rawTotals.revenue ? _rawTotals.op / _rawTotals.revenue : 0;
    }
    var r = _final
      ? { byDept: (_showRaw ? _rawByDept : _snap.byDept), totals: (_showRaw ? _rawTotals : _snap.totals), allocated: _showRaw ? false : !!_snap.allocated, laborFinalized: true, laborSource: "확정", laborRows: [], headByDept: (_showRaw ? _rawHead : (_snap.headByDept || _live.headByDept || {})), totHead: (_showRaw ? _rawTotHead : (_snap.totHead != null ? _snap.totHead : _live.totHead)), dq: { uncat: { count: 0, debit: 0, credit: 0 }, untagged: 0, unsplit: [], uncatList: [], untaggedList: [] } }
      : _live;
    var _basisWarn = _snapBasisMissing ? '<div style="border:1px solid var(--warning);background:#fffbeb;border-radius:8px;padding:8px 12px;margin:0 0 12px;font-size:11px;color:var(--warning)">⚠ 이 달 확정본은 <b>인보이스 기준</b>만 저장돼 있습니다 · 프로젝트 귀속 기준은 라이브 계산값입니다. 재확정하면 두 기준이 함께 저장됩니다.</div>' : "";
    var _rawWarn = _showRaw ? '<div style="border:1px solid var(--border);background:var(--surface-2);border-radius:8px;padding:8px 12px;margin:0 0 12px;font-size:11px;color:var(--text-3)">🔓 배분 풀기(보기) — 확정본(배분 적용)은 이력 그대로 보존됩니다. 지금 표는 <b>배분 전 원본</b>(COMMON 원천 포함, 매출부서는 직접귀속만)입니다.' + (_rawFromLive ? ' <span style="color:var(--warning)">⚠ 이 월은 원본 미저장 → 라이브 배분전 기준(확정 시점과 다를 수 있음).</span>' : '') + '</div>' : "";
    var money = function (v) { return _usd && _rate ? (v / _rate).toLocaleString("en-US", { maximumFractionDigits: 0 }) : F(v); };
    var unit = _usd && _rate ? "USD" : "VND";
    var pct = function (x) { return (x * 100).toFixed(1) + "%"; };
    var T = DEPTS;

    // 매출총이익 = 매출 − 매입원가 (부서별·합계 주입; 스냅샷 payload 미변경)
    DEPTS.forEach(function (t) { if (r.byDept[t]) r.byDept[t].gross = (r.byDept[t].revenue || 0) - (r.byDept[t].cogs || 0); });
    r.totals.gross = (r.totals.revenue || 0) - (r.totals.cogs || 0);

    var _drillable = { revenue: 1, cogs: 1, opex: 1 };
    var line = function (label, key, opt) {
      opt = opt || {};
      var dz = _drillable[key];   // 확정 후에도 원천 디테일 조회 허용(스냅샷과 차이는 상단 drift 경고)
      var main = '<tr' + (opt.top ? ' style="border-top:2px solid var(--text);font-weight:700"' : (opt.sub ? ' style="border-top:1px solid var(--border);background:var(--surface-2);font-weight:600"' : "")) + '>'
        + '<td style="padding:8px 12px;text-align:left">' + label + (dz ? ' <span style="font-size:9px;color:var(--text-3)">▸ 클릭</span>' : '') + '</td>'
        + T.map(function (t) { var v = r.byDept[t][key];
          var cell = '<td style="padding:8px 12px;text-align:right;font-family:var(--mono);' + (v < 0 ? "color:var(--danger)" : (opt.sub ? "color:#1d4ed8" : "")) + (dz ? ';cursor:pointer;text-decoration:underline dotted' : '') + '"' + (dz ? ' onclick="chasanToggleDetail(\'' + ym + '\',\'' + t + '\',\'' + key + '\')"' : '') + '>' + money(v) + '</td>';
          return cell; }).join("")
        + '<td style="padding:8px 12px;text-align:right;font-family:var(--mono);font-weight:700;' + (r.totals[key] < 0 ? "color:var(--danger)" : (opt.sub ? "color:#1d4ed8" : "")) + '">' + money(r.totals[key]) + '</td></tr>';
      if (dz) {
        main += '<tr class="csd-detailrow"><td style="padding:0"></td>'
          + T.map(function (t) { return '<td style="padding:0 4px;vertical-align:top"><div id="csd_' + t.replace(/\s/g, "") + '_' + key + '" data-open="0"></div></td>'; }).join("")
          + '<td style="padding:0"></td></tr>';
      }
      return main;
    };
    var rpct = function (num, den) { return den ? ((num / den) * 100).toFixed(1) + "%" : "\u2014"; };
    var _ratioRow = function (label, key, neg) {
      var cells = T.map(function (t) {
        var b = r.byDept[t] || {}, rv = +b.revenue || 0, v = +b[key] || 0;
        var col = (neg && rv && v < 0) ? "var(--danger)" : "var(--text-3)";
        return '<td style="padding:4px 12px;text-align:right;font-size:11px;color:' + col + '">' + rpct(v, rv) + '</td>';
      }).join("");
      var trv = +r.totals.revenue || 0, tv = +r.totals[key] || 0;
      var tcol = (neg && trv && tv < 0) ? "var(--danger)" : "var(--text-3)";
      return '<tr style="background:var(--surface-2)"><td style="padding:4px 12px;text-align:left;font-size:11px;color:var(--text-3)">' + label + '</td>' + cells
        + '<td style="padding:4px 12px;text-align:right;font-size:11px;font-weight:600;color:' + tcol + '">' + rpct(tv, trv) + '</td></tr>';
    };
    var mline = function () {
      return '<tr style="background:var(--surface-2);border-top:1px solid var(--border)"><td colspan="' + (T.length + 2) + '" style="padding:4px 12px;font-size:10px;color:var(--text-3)">\uAD6C\uC131\uBE44 \u00B7 Ratios (\u00F7 \uB9E4\uCD9C)</td></tr>'
        + _ratioRow("\uB9E4\uCD9C\uC6D0\uAC00\uC728 \u00B7 COGS%", "cogs", false)
        + _ratioRow("\uB9E4\uCD9C\uCD1D\uC774\uC775\uB960 \u00B7 GP%", "gross", false)
        + _ratioRow("\uC601\uC5C5\uC774\uC775\uB960 \u00B7 OP%", "op", true);
    };
    var HRS = Math.round(40 * 4.345);   // 월 근무시간: 주5일×8h(40h/주) × 4.345주 ≈ 174h
    var hc = function (h) { return h > 0 ? (Math.round(h * 10) / 10) : 0; };
    var pcCell = function (op, h, bold) { var st = 'padding:6px 12px;text-align:right;font-family:var(--mono);color:var(--text-2)' + (bold ? ';font-weight:700' : ''); return '<td style="' + st + (h > 0 && op < 0 ? ';color:var(--danger)' : '') + '">' + (h > 0 ? money(Math.round(op / h)) : '—') + '</td>'; };
    var phCell = function (op, h, bold) { var st = 'padding:6px 12px;text-align:right;font-family:var(--mono);color:var(--text-2)' + (bold ? ';font-weight:700' : ''); return '<td style="' + st + (h > 0 && op < 0 ? ';color:var(--danger)' : '') + '">' + (h > 0 ? money(Math.round(op / h / HRS)) : '—') + '</td>'; };
    var pcline = function () {
      return '<tr style="border-top:1px solid var(--border)"><td style="padding:6px 12px;text-align:left;color:var(--text-3)">인당 채산(월) · OP/person <span style="font-size:9px">영업이익÷인원</span></td>'
        + T.map(function (t) { return pcCell(r.byDept[t].op, r.headByDept[t] || 0); }).join("")
        + pcCell(r.totals.op, r.totHead || 0, true) + '</tr>';
    };
    var phline = function () {
      return '<tr><td style="padding:6px 12px;text-align:left;color:var(--text-3)">시간당 채산 · OP/hour <span style="font-size:9px">÷174h(주5일·8h)</span></td>'
        + T.map(function (t) { return phCell(r.byDept[t].op, r.headByDept[t] || 0); }).join("")
        + phCell(r.totals.op, r.totHead || 0, true) + '</tr>';
    };
    var hdline = function () {
      return '<tr><td style="padding:4px 12px;text-align:left;color:var(--text-3);font-size:10px">인원 · Headcount</td>'
        + T.map(function (t) { return '<td style="padding:4px 12px;text-align:right;color:var(--text-3);font-size:10px">' + hc(r.headByDept[t] || 0) + '</td>'; }).join("")
        + '<td style="padding:4px 12px;text-align:right;color:var(--text-3);font-size:10px;font-weight:600">' + hc(r.totHead || 0) + '</td></tr>';
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

    // 미분류(Uncategorized) 처리 패널 — 분류 지정
    var uncatPanel = "";
    if (r.dq.uncatList && r.dq.uncatList.length) {
      uncatPanel = '<div style="border:1px solid var(--warning);background:#fffbeb;border-radius:10px;padding:12px 14px;margin:12px 16px">'
        + '<div style="font-size:12px;font-weight:700;color:var(--warning);margin-bottom:8px">⚠ 미분류 · Uncategorized ' + r.dq.uncatList.length + '건 — 분류 지정 필요</div>'
        + r.dq.uncatList.map(function (t) {
          var amt = (+t.debit || 0) || (+t.credit || 0);
          var catSel = (typeof bankCategoryOptions === "function") ? '<select onchange="chasanSetTxnCat(' + t.id + ',this.value)" style="font-size:11px;padding:3px 6px;border:1px solid var(--border);border-radius:6px;flex-shrink:0;max-width:150px;background:#fffbeb">' + bankCategoryOptions(t.category || "Uncategorized") + '</select>' : '';
          return '<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-top:1px solid var(--border);font-size:12px">'
            + '<span style="color:var(--text-3);width:82px;flex-shrink:0">' + E(t.date || "") + '</span>'
            + '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + E(t.note || "").replace(/"/g, "&quot;") + '">' + E(t.note || t.ref || "—") + '</span>'
            + '<span style="font-family:var(--mono);flex-shrink:0">' + F(amt) + '</span>'
            + catSel + '</div>';
        }).join("") + '</div>';
    }
    // 부서 미태깅 처리 패널 — 부서 지정
    var untagPanel = "";
    if (r.dq.untaggedList && r.dq.untaggedList.length) {
      untagPanel = '<div style="border:1px solid var(--warning);background:#fffbeb;border-radius:10px;padding:12px 14px;margin:12px 16px">'
        + '<div style="font-size:12px;font-weight:700;color:var(--warning);margin-bottom:8px">⚠ 부서 미태깅 · No dept ' + r.dq.untaggedList.length + '건 — 부서 지정 (미지정 시 COMMON 귀속)</div>'
        + r.dq.untaggedList.map(function (t) {
          var amt = (+t.debit || 0) || (+t.credit || 0);
          var btns = DEPTS.map(function (d) { return '<button onclick="chasanRetag(\'' + E(t.id) + '\',\'' + d + '\')" style="border:1px solid var(--border);background:none;cursor:pointer;font-size:10px;padding:3px 7px;border-radius:6px;flex-shrink:0">' + E(d) + '</button>'; }).join("");
          return '<div style="display:flex;align-items:center;gap:6px;padding:5px 0;border-top:1px solid var(--border);font-size:12px;flex-wrap:wrap">'
            + '<span style="color:var(--text-3);width:82px;flex-shrink:0">' + E(t.date || "") + '</span>'
            + '<span style="flex:1;min-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + E(t.note || "").replace(/"/g, "&quot;") + '">' + E(t.note || t.ref || "—") + ' <span style="color:var(--text-3)">[' + E(t.category || "") + ']</span></span>'
            + '<span style="font-family:var(--mono);flex-shrink:0">' + F(amt) + '</span>'
            + btns + '</div>';
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

    // 매입원가 인정 업체 관리 (수취 인보이스 거래처 whitelist)
    var _rcvMap = {};
    ((typeof state !== "undefined" && state.invoices) || []).forEach(function (iv) {
      if (iv && iv.dir === "received") {
        var k = invVendorKey(iv);
        if (!_rcvMap[k]) _rcvMap[k] = { key: k, nameKey: invNameKey(iv), name: (iv.vendor || "").trim() || "(무명)", mst: (iv.vendorMst || "").trim(), n: 0, sum: 0 };
        _rcvMap[k].n++; _rcvMap[k].sum += invNet(iv);
      }
    });
    var _rcvList = Object.keys(_rcvMap).map(function (k) { return _rcvMap[k]; }).sort(function (a, b) { return b.sum - a.sum; });
    var cogsVendorEditor = '<details style="margin:0 16px 12px"><summary style="cursor:pointer;font-size:12px;font-weight:600;color:var(--text-2);padding:6px 0">🏭 매입원가 인정 업체 · COGS vendors (' + (_cogsVendors || []).length + ' 지정)</summary>'
      + '<div style="font-size:10px;color:var(--text-3);padding:2px 0 8px;line-height:1.6">체크된 업체의 <b>수취 인보이스만</b> 매입원가(COGS)로 집계됩니다. 기본값: CÔNG TY TNHH FURSYS VN · Only checked vendors\u2019 received invoices count as COGS.</div>';
    if (!_rcvList.length) cogsVendorEditor += '<div style="font-size:11px;color:var(--text-3)">수취 인보이스 없음 · No received invoices yet</div>';
    else cogsVendorEditor += _rcvList.map(function (v) {
      var wl = (_cogsVendors || []);
      var on = wl.indexOf(v.key) >= 0 || (v.nameKey && wl.indexOf(v.nameKey) >= 0);
      var ke = v.key.replace(/'/g, "\\'"), nke = (v.nameKey || "").replace(/'/g, "\\'");
      return '<label style="display:flex;align-items:center;gap:8px;font-size:12px;padding:5px 0;border-top:1px solid var(--border);cursor:pointer">'
        + '<input type="checkbox" ' + (on ? "checked" : "") + ' onchange="chasanToggleCogsVendor(\'' + ke + '\',\'' + nke + '\')">'
        + '<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;' + (on ? "font-weight:600" : "color:var(--text-3)") + '">' + E(v.name) + (v.mst ? ' <span style="color:var(--text-3);font-size:10px;font-family:var(--mono)">MST ' + E(v.mst) + '</span>' : '') + '</span>'
        + '<span style="color:var(--text-3);font-size:10px;flex-shrink:0">' + v.n + '건</span>'
        + '<span style="font-family:var(--mono);font-size:11px;flex-shrink:0">' + F(v.sum) + '</span></label>';
    }).join("");
    cogsVendorEditor += '</details>';

    // 인보이스 데이터품질: 환율 미입력 · 자산 처리 요약
    var invDqPanel = "";
    if (!_final && ((r.dq.invFxMiss && r.dq.invFxMiss.length) || (r.dq.invAsset && r.dq.invAsset.length))) {
      invDqPanel = '<div style="border:1px solid var(--border);background:var(--surface-2);border-radius:10px;padding:10px 14px;margin:12px 16px;font-size:11px;line-height:1.7">';
      if (r.dq.invAsset && r.dq.invAsset.length) {
        invDqPanel += '<div style="color:#7c3aed"><b>🏦 자산 처리(원가 제외)</b> · ' + r.dq.invAsset.length + '건 · ' + F(r.dq.invAssetSum || 0) + ' VND — 매출원가에서 제외됨. 되돌리려면 매입원가 셀 클릭 → 해당 인보이스 드롭다운에서 원가로 변경.</div>';
      }
      if (r.dq.invFxMiss && r.dq.invFxMiss.length) {
        invDqPanel += '<div style="color:var(--warning)">⚠ 환율 미입력 외화 인보이스 ' + r.dq.invFxMiss.length + '건 — 원금액 그대로 반영됨. 인보이스 fxRate 입력 또는 상단 USD 환율 설정 필요.</div>';
      }
      invDqPanel += '</div>';
    }

    if (_final) { retag = ""; uncatPanel = ""; untagPanel = ""; lwEditor = ""; extraEditor = ""; cogsVendorEditor = ""; invDqPanel = ""; }
    var _finBadge = _final ? '<span style="font-size:11px;color:var(--success);font-weight:700"> · ✓ 확정됨 · Finalized ' + E((_snap.finalizedAt || "").slice(0, 10)) + (_snap.finalizedBy ? " (" + E(_snap.finalizedBy) + ")" : "") + (_snap.byBasis ? ' <span style="color:var(--text-3);font-weight:600">· 두 기준 저장</span>' : "") + '</span>' : "";
    var _driftWarn = _basisWarn + ((_final && _drift > 0) ? '<div style="border:1px solid var(--warning);background:#fffbeb;border-radius:8px;padding:8px 12px;margin:0 0 12px;font-size:11px;color:var(--warning)">⚠ 확정 후 원천 변동 · Source changed after finalize — 라이브 영업이익이 확정본과 ' + F(_drift) + ' VND 차이. 재확정하면 현재값으로 갱신됩니다.</div>' : "");
    var dq = r.dq, dqWarn = (dq.uncat.count || dq.untagged) ? '<span style="font-size:11px;color:var(--warning)"> · ⚠ 미분류 ' + dq.uncat.count + '건 · 부서미태깅 ' + dq.untagged + '건</span>' : "";

    window._csLastR = r; window._csLastYm = ym;
    host.querySelector("#csBody").innerHTML =
      _csTabs("month") + _driftWarn + _rawWarn
      + '<div class="form-card" style="padding:0;overflow:hidden">'
      + '<div style="padding:12px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">'
      + '<div><div style="font-size:14px;font-weight:700">부서 채산 · Departmental P&L — ' + E(ym) + '</div>'
      + '<div style="font-size:11px;color:var(--text-3)">' + (_csBasis === "project" ? '<b style="color:#1d4ed8">매출·매입원가=프로젝트 귀속(수익비용대응)</b>(매출 ' : '매출·매입원가=인보이스 발생주의(매출 ') + (r.dq.revCount || 0) + ' · 매입원가 ' + (r.dq.cogsCount || 0) + '건' + (r.dq.invAsset && r.dq.invAsset.length ? ' · 자산제외 ' + r.dq.invAsset.length : '') + ') · 기본부서 FUR VN · 판관비=현금주의 · 인건비=' + (r.laborFinalized ? "확정대장" : "라이브(" + r.laborSource + ")") + (r.allocated ? " · COMMON 배분" : "") + dqWarn + _finBadge + '</div></div>'
      + '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">'
      + (_final
          ? '<label style="font-size:11px;color:' + (_showRaw ? "var(--text)" : "var(--text-3)") + ';display:flex;align-items:center;gap:5px;font-weight:' + (_showRaw ? "600" : "400") + '" title="확정본은 그대로 두고 보기만 배분 해제"><input type="checkbox" id="csViewRaw"' + (_csViewRaw ? " checked" : "") + '> 배분 풀기(보기) · Unallocate view</label>'
          : '<label style="font-size:11px;color:var(--text-3);display:flex;align-items:center;gap:5px"><input type="checkbox" id="csAlloc"' + (CHASAN_CFG.allocateCommon ? " checked" : "") + '> COMMON 배분 · Allocate</label>')
      + '<select id="csBasis" title="매출·매입원가 귀속기준" style="border:1px solid var(--border);border-radius:7px;padding:5px 8px;font-size:11px;background:var(--surface);color:var(--text)' + (_csBasis === "project" ? ';font-weight:700;border-color:#1d4ed8;color:#1d4ed8' : '') + '"><option value="invoice"' + (_csBasis === "invoice" ? " selected" : "") + '>인보이스 기준 · Invoice date</option><option value="project"' + (_csBasis === "project" ? " selected" : "") + '>프로젝트 귀속 · Project</option></select>'
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
      + line("= 매출총이익 / Gross Profit", "gross", { sub: true })
      + line("(−) 인건비 / Labor", "labor")
      + line("(−) 판관비 / OpEx", "opex")
      + line("(−) EXTRA (타법인부담)", "extra")
      + line("영업이익 / Operating Profit", "op", { top: true })
      + mline()
      + hdline()
      + pcline()
      + phline()
      + '</tbody></table></div>'
      + retag + uncatPanel + untagPanel + invDqPanel + cogsVendorEditor + lwEditor + extraEditor
      + '<p style="font-size:11px;color:var(--text-3);padding:8px 16px;line-height:1.6">매출·매입원가=인보이스 발생주의(매출=발행 인보이스 / 매입원가=지정 업체 수취 인보이스, 모두 공급가액·VAT 제외) · 판관비=현금주의(뱅크) · 인건비=확정대장 tc 인원별 가중치 4부서 분배. <b>부서 기본값=FUR VN</b> — 매출/매입원가 셀을 클릭하면 인보이스별 드롭다운으로 FUR MX·SOURCING 등으로 변경, 또는 <b>「자산·Asset(제외)」</b>로 지정하면 매출원가에서 빠집니다(자본적 지출·자산 취득분). COMMON은 배분 ON 시 FUR VN/FUR MX/SOURCING에 3:3:1 완전분배.</p></div>';

    var usdEl = host.querySelector("#csUsd"), rateEl = host.querySelector("#csRate"), allocEl = host.querySelector("#csAlloc");
    var basisEl = document.getElementById("csBasis");
    if (basisEl) basisEl.onchange = function () { chasanSetBasis(basisEl.value); };
    if (usdEl) usdEl.onchange = function () { _usd = usdEl.checked; if (_usd && !(+rateEl.value)) { alert("월 환율(VND/USD)을 입력하세요."); _usd = false; usdEl.checked = false; return; } renderChasan(ym, host, opts); };
    if (rateEl) rateEl.onchange = function () { _rate = +rateEl.value || 0; if (_usd) renderChasan(ym, host, opts); };
    if (allocEl) allocEl.onchange = function () { CHASAN_CFG.allocateCommon = allocEl.checked; renderChasan(ym, host, opts); };
    var viewRawEl = host.querySelector("#csViewRaw"); if (viewRawEl) viewRawEl.onchange = function () { _csViewRaw = viewRawEl.checked; renderChasan(ym, host, opts); };
    var _payload = function () { return { byDept: _live.byDept, totals: _live.totals, fx: { usd: _usd, vndPerUsd: _rate }, basis: _csBasis, laborFinalized: _live.laborFinalized, allocated: _live.allocated, headByDept: _live.headByDept, totHead: _live.totHead, byDeptRaw: _live.byDeptRaw, headByDeptRaw: _live.headByDeptRaw }; };
    /* 확정용 페이로드 — 인보이스/프로젝트 두 기준을 함께 계산해 byBasis에 보관.
       최상위 byDept/totals 는 하위호환을 위해 '인보이스 기준'으로 고정한다. */
    var _payloadBoth = async function () {
      var both = await chasanComputeBoth(ym, { fallbackLive: opts.fallbackLive !== false });
      var base = both.invoice || {};
      return {
        byDept: base.byDept, totals: base.totals, headByDept: base.headByDept, totHead: base.totHead,
        byDeptRaw: base.byDeptRaw, headByDeptRaw: base.headByDeptRaw, allocated: base.allocated,
        fx: { usd: _usd, vndPerUsd: _rate }, basis: "both", viewBasis: _csBasis,
        byBasis: both, laborFinalized: _live.laborFinalized
      };
    };
    var _bind = function (id, fn) { var el = host.querySelector(id); if (el) el.onclick = fn; };
    var _csArchive = async function () { try { if (typeof XLSX === "undefined") return false; var all = await chasanLoadAll(); var bytes = chasanBuildWorkbook(ym, _live, _lw, _extra[ym], _live.laborRows, all); return await chasanArchiveXlsx(ym, chasanXlsxBlob(bytes)); } catch (e) { return false; } };
    _bind("#csXlsx", function () { chasanDownloadXlsx(ym); });
    _bind("#csSaveDraft", async function () { try { await chasanSaveSnapshot(ym, _payload(), false); if (typeof showToast === "function") showToast(ym + " 임시 저장 · Saved ✓"); } catch (e) { if (typeof showToast === "function") showToast("저장 실패: " + e.message); } });
    _bind("#csFinal", async function () { if (!confirm(ym + " 채산을 확정합니다.\n\n인보이스 기준 + 프로젝트 귀속 기준 두 가지가 함께 확정됩니다.\n확정 후 이 달 값이 동결되고 Storage에 Excel이 저장됩니다. 진행할까요?")) return; try { await chasanSaveSnapshot(ym, await _payloadBoth(), true); var _ok = await _csArchive(); if (typeof showToast === "function") showToast(ym + " 채산 확정 · Finalized ✓" + (_ok ? " · Storage Excel saved" : " · (엑셀 저장 실패)")); renderChasan(ym, host, opts); } catch (e) { if (typeof showToast === "function") showToast("확정 실패: " + e.message); } });
    _bind("#csRefinal", async function () { if (!_csIsAdmin()) { alert("재확정은 관리자만 가능합니다."); return; } if (!confirm(ym + " 채산을 현재 라이브값으로 재확정합니다.\n두 기준 모두 갱신됩니다. 진행할까요?")) return; try { await chasanSaveSnapshot(ym, await _payloadBoth(), true); var _ok = await _csArchive(); if (typeof showToast === "function") showToast(ym + " 재확정 · Re-finalized ✓" + (_ok ? " · Storage Excel saved" : "")); renderChasan(ym, host, opts); } catch (e) { if (typeof showToast === "function") showToast("재확정 실패: " + e.message); } });
    _bind("#csUnfinal", async function () { if (!_csIsAdmin()) { alert("확정 해제는 관리자만 가능합니다."); return; } if (!confirm(ym + " 채산 확정을 해제합니다. 다시 편집 가능해집니다. 진행할까요?")) return; try { await chasanUnfinalize(ym); if (typeof showToast === "function") showToast(ym + " 확정 해제 · Unlocked ✓"); renderChasan(ym, host, opts); } catch (e) { if (typeof showToast === "function") showToast("해제 실패: " + e.message); } });
  };

  // ── 라인 드릴다운: 특정 부서/항목(revenue|cogs|opex)을 구성한 거래 목록 ──
  //   revenue/cogs → 거래처(vendor) 합계, opex → 카테고리 합계. 하위에 개별 거래.
  window.chasanRetagInv = function (id, dept) {
    var inv = (typeof state !== "undefined" && state.invoices || []).find(function (x) { return String(x.id) === String(id); });
    if (!inv) return;
    inv.chasanDept = dept;
    if (typeof _stampEdit === "function") _stampEdit(inv);
    if (typeof saveState === "function") saveState();
    if (_lastYm && _lastHost) renderChasan(_lastYm, _lastHost, _lastOpts);
  };
  window.chasanSetInvClass = function (id, cls) {   // 'asset' = 자산(원가/매출 제외) · 그 외 = 일반
    var inv = (typeof state !== "undefined" && state.invoices || []).find(function (x) { return String(x.id) === String(id); });
    if (!inv) return;
    if (cls === "asset") inv.chasanClass = "asset"; else delete inv.chasanClass;
    if (typeof _stampEdit === "function") _stampEdit(inv);
    if (typeof saveState === "function") saveState();
    if (_lastYm && _lastHost) renderChasan(_lastYm, _lastHost, _lastOpts);
  };
  function _csProjName(pid){ if(pid==null||pid==="") return ""; var ps=(typeof state!=="undefined"&&state&&state.projects)||[]; var p=ps.find(function(x){return String(x.id)===String(pid);}); if(!p) return ""; var _b=(p.clientFull||p.client||p.name||("#"+pid)); return _b+(p.projName?(" · "+p.projName):""); }
  window.chasanLineDetail = function (ym, dept, key) {
    // 매출·매입원가 → 인보이스 발생기준 (자산 분류는 합계 제외, 행은 표시)
    if (key === "revenue" || key === "cogs") {
      var invs = (typeof state !== "undefined" && state && state.invoices) || [];
      var irows = [];
      invs.forEach(function (inv) {
        if (!inv || _csEffYm(inv) !== ym) return;
        if (key === "revenue" && inv.dir !== "issued") return;
        if (key === "cogs" && !(inv.dir === "received" && isCogsVendor(inv))) return;
        if (invDept(inv) !== dept) return;
        var isAsset = inv.chasanClass === "asset";
        var conv = invVnd(inv, invNet(inv));
        irows.push({ id: inv.id, date: inv.date || "", vendor: (inv.vendor || "").trim() || "(미지정)", invoiceNo: inv.invoiceNo || "",
          currency: inv.currency || "VND", fxOk: conv.ok, dir: inv.dir, asset: isAsset, note: (inv.note || inv.category || "").trim(), amt: conv.v,
          projectName: _csProjName(inv.projectId) });
      });
      var igroups = {};
      irows.forEach(function (r) { var g = r.vendor || "(미지정)"; (igroups[g] = igroups[g] || { sum: 0, items: [] }); igroups[g].sum += r.asset ? 0 : r.amt; igroups[g].items.push(r); });
      var ilist = Object.keys(igroups).map(function (g) { return { name: g, sum: igroups[g].sum, items: igroups[g].items.sort(function (a, b) { return b.amt - a.amt; }) }; }).sort(function (a, b) { return b.sum - a.sum; });
      return { groupKey: "vendor", isInv: true, groups: ilist, total: irows.reduce(function (a, r) { return a + (r.asset ? 0 : r.amt); }, 0), count: irows.length, assetCount: irows.filter(function (r) { return r.asset; }).length };
    }
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
      rows.push({ id: t.id, date: t.date || "", vendor: (t.vendor || "").trim() || "(미지정)", category: t.category || "",
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
    var money = function (v) { return (_usd && _rate) ? Math.round((v || 0) / _rate).toLocaleString("en-US") : F(v); };
    var _unit = (_usd && _rate) ? " USD" : "";
    var id = "csd_" + dept.replace(/\s/g, "") + "_" + key;
    var el = document.getElementById(id); if (!el) return;
    if (el.getAttribute("data-open") === "1") { el.innerHTML = ""; el.setAttribute("data-open", "0"); return; }
    var d = chasanLineDetail(ym, dept, key);
    var glabel = d.groupKey === "category" ? "카테고리 · Category" : "거래처 · Vendor";
    var _an = "";
    if (_csViewRaw) { _an = ' · 배분 풀림(원본) · unallocated view'; } else if (CHASAN_CFG.allocateCommon) { _an = (dept === "COMMON") ? ' · 배분 전 원천 · pre-alloc pool' : ' · 직접귀속만(배분분 제외) · direct only'; }
    var html = '<div style="background:var(--surface-2);border-radius:8px;padding:10px 12px;margin:2px 0 6px;min-width:260px">'
      + '<div style="font-size:11px;color:var(--text-3);margin-bottom:6px">' + E(dept) + ' · ' + glabel + '별 (' + d.count + '건' + (d.assetCount ? ' · 자산 제외 ' + d.assetCount + '건' : '') + ')' + _an + '</div>';
    if (!d.groups.length) { var _m = "직접 귀속 거래 없음 · No direct txns"; if (CHASAN_CFG.allocateCommon && dept !== "COMMON") _m += " — 표시값은 COMMON 배분분입니다. COMMON 열을 클릭해 원천 확인"; html += '<div style="font-size:11px;color:var(--text-3)">' + _m + '</div>'; }
    d.groups.forEach(function (g) {
      html += '<details style="margin-bottom:3px"><summary style="cursor:pointer;font-size:12px;display:flex;justify-content:space-between;gap:10px;padding:3px 0">'
        + '<span style="font-weight:600">' + E(g.name) + '</span><span style="font-family:var(--mono);' + (g.sum < 0 ? "color:var(--danger)" : "") + '">' + money(g.sum) + '</span></summary>'
        + '<div style="padding:4px 0 6px 10px">'
        + g.items.map(function (it) {
          if (d.isInv) {   // 인보이스 행: 부서 태깅 + 원가/자산 분류
            var _idE = String(it.id).replace(/\x27/g, "\\\x27");
            var _depSelI = '<select onchange="chasanRetagInv(\'' + _idE + '\',this.value)" title="부서 · Dept" style="font-size:10px;padding:2px 4px;border:1px solid var(--border);border-radius:5px">' + DEPTS.map(function (dd) { return '<option' + (dd === dept ? " selected" : "") + '>' + E(dd) + '</option>'; }).join("") + '</select>';
            var _clsSelI = '<select onchange="chasanSetInvClass(\'' + _idE + '\',this.value)" title="원가/자산 · Class" style="font-size:10px;padding:2px 4px;border:1px solid var(--border);border-radius:5px' + (it.asset ? ';color:#7c3aed;font-weight:600' : '') + '"><option value="cogs"' + (it.asset ? "" : " selected") + '>' + (it.dir === "issued" ? "매출·Rev" : "원가·COGS") + '</option><option value="asset"' + (it.asset ? " selected" : "") + '>자산·Asset(제외)</option></select>';
            var _cur = (it.currency && it.currency !== "VND") ? (' <span style="color:var(--text-3);font-size:9px">' + E(it.currency) + (it.fxOk ? "" : " ⚠환율") + '</span>') : "";
            return '<div style="padding:4px 0;border-top:1px solid var(--border)' + (it.asset ? ";opacity:.55" : "") + '">'
              + '<div style="display:flex;gap:8px;font-size:11px;align-items:center">'
              + '<span style="color:var(--text-3);flex-shrink:0">' + E(it.date) + '</span>'
              + '<span style="font-family:var(--mono);color:var(--text-3);flex-shrink:0;font-size:10px">' + E(it.invoiceNo || "—") + '</span>'
              + '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + E((it.projectName?("["+it.projectName+"] "):"")+(it.note||"")).replace(/"/g, "&quot;") + '">' + (it.asset ? '<span style="color:#7c3aed;font-weight:600">[자산] </span>' : '') + (it.projectName ? '<span style="font-weight:600">'+E(it.projectName)+'</span>' : E(it.note || "—")) + '</span>'
              + '<span style="font-family:var(--mono);flex-shrink:0;' + (it.asset ? "text-decoration:line-through;color:var(--text-3)" : (it.amt < 0 ? "color:var(--danger)" : "")) + '">' + money(it.amt) + _cur + '</span></div>'
              + '<div style="display:flex;gap:6px;align-items:center;margin-top:3px;flex-wrap:wrap">' + _depSelI + _clsSelI + '</div></div>';
          }
          var _catSel = (typeof bankCategoryOptions === "function") ? '<select onchange="chasanSetTxnCat(' + it.id + ',this.value)" style="font-size:10px;padding:2px 4px;border:1px solid var(--border);border-radius:5px;flex:1;min-width:90px;max-width:140px">' + bankCategoryOptions(it.category || "Uncategorized") + '</select>' : '';
          var _depSel = '<select onchange="chasanRetag(\'' + String(it.id).replace(/\x27/g, "\\\x27") + '\',this.value)" style="font-size:10px;padding:2px 4px;border:1px solid var(--border);border-radius:5px">' + DEPTS.map(function (d) { return '<option' + (d === dept ? " selected" : "") + '>' + E(d) + '</option>'; }).join("") + '</select>';
          return '<div style="padding:4px 0;border-top:1px solid var(--border)">'
            + '<div style="display:flex;gap:8px;font-size:11px;align-items:center">'
            + '<span style="color:var(--text-3);flex-shrink:0">' + E(it.date) + '</span>'
            + '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + E(it.note).replace(/"/g, "&quot;") + '">' + E(it.note || "—") + '</span>'
            + '<span style="font-family:var(--mono);flex-shrink:0;' + (it.amt < 0 ? "color:var(--danger)" : "") + '">' + money(it.amt) + '</span></div>'
            + '<div style="display:flex;gap:6px;align-items:center;margin-top:3px;flex-wrap:wrap">' + _catSel + _depSel + '</div></div>';
        }).join("")
        + '</div></details>';
    });
    html += '</div>';
    el.innerHTML = html; el.setAttribute("data-open", "1");
  };
  var _csView = "month", _csHistYear = null;
  window.chasanSwitchView = function (v) { _csView = v; renderChasanPage(); };
  window.chasanHistYear = function (y) { _csHistYear = String(y); renderChasanPage(); };
  window.chasanHistUsd = function (on) { _usd = !!on; if (_usd && !_rate) { alert("월 환율(VND/USD)을 입력하세요."); _usd = false; } renderChasanPage(); };
  window.chasanHistRate = function (v) { _rate = +v || 0; renderChasanPage(); };
  function _csTabs(active) {
    var tab = function (v, label) { return '<button onclick="chasanSwitchView(\'' + v + '\')" style="border:none;background:none;cursor:pointer;font-size:13px;font-weight:' + (active === v ? "700" : "400") + ';color:' + (active === v ? "var(--text)" : "var(--text-3)") + ';padding:8px 2px;margin-right:18px;border-bottom:2px solid ' + (active === v ? "var(--text)" : "transparent") + '">' + label + "</button>"; };
    return '<div style="border-bottom:1px solid var(--border);margin-bottom:14px">' + tab("month", "월별 채산 · Monthly") + tab("forecast", "예상채산 · Forecast") + tab("history", "History · 이력") + "</div>";
  }
  function _csLineChart(series, monthsLbl) {
    var W = 680, H = 220, pl = 8, pr = 8, pt = 12, pb = 22, n = monthsLbl.length; if (!n) return "";
    var all = [0]; series.forEach(function (s) { s.values.forEach(function (v) { all.push(v); }); });
    var mn = Math.min.apply(null, all), mx = Math.max.apply(null, all); if (mn === mx) mx = mn + 1;
    var iw = W - pl - pr, ih = H - pt - pb;
    var x = function (i) { return pl + (n <= 1 ? iw / 2 : iw * i / (n - 1)); };
    var y = function (v) { return pt + ih * (1 - (v - mn) / (mx - mn)); };
    var _lbl = function (v) { var a = Math.abs(v); if (a >= 1e9) return (v / 1e9).toFixed(1) + 'B'; if (a >= 1e6) return Math.round(v / 1e6) + 'M'; if (a >= 1e3) return Math.round(v / 1e3) + 'K'; return String(Math.round(v)); };
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:auto;font-family:var(--sans)">';
    svg += '<line x1="' + pl + '" y1="' + y(0).toFixed(1) + '" x2="' + (W - pr) + '" y2="' + y(0).toFixed(1) + '" stroke="var(--border)"/>';
    monthsLbl.forEach(function (m, i) { svg += '<text x="' + x(i).toFixed(1) + '" y="' + (H - 6) + '" font-size="9" fill="var(--text-3)" text-anchor="middle">' + E(m.slice(5)) + '</text>'; });
    series.forEach(function (s) {
      var d = s.values.map(function (v, i) { return (i === 0 ? "M" : "L") + x(i).toFixed(1) + " " + y(v).toFixed(1); }).join(" ");
      svg += '<path d="' + d + '" fill="none" stroke="' + s.color + '" stroke-width="2"/>';
      s.values.forEach(function (v, i) { svg += '<circle cx="' + x(i).toFixed(1) + '" cy="' + y(v).toFixed(1) + '" r="2.5" fill="' + s.color + '"/>'; if (v !== 0) { svg += '<text x="' + x(i).toFixed(1) + '" y="' + (y(v) - 6).toFixed(1) + '" font-size="8.5" fill="' + s.color + '" text-anchor="middle">' + _lbl(v) + '</text>'; } });
    });
    svg += "</svg>";
    return svg + '<div style="display:flex;gap:14px;flex-wrap:wrap;font-size:11px;margin-top:6px">' + series.map(function (s) { return '<span style="display:flex;align-items:center;gap:5px"><span style="width:10px;height:10px;border-radius:2px;background:' + s.color + '"></span>' + E(s.name) + "</span>"; }).join("") + "</div>";
  }
  // -- reusable: departmental P&L Monthly & YTD FS table (shared by History tab + HQ weekly report) --
  window.chasanBuildYtdFsTable = function (year, opt) {
    opt = opt || {}; var all = opt.all || {};
    var usd = ("usd" in opt) ? opt.usd : _usd, rate = ("rate" in opt) ? opt.rate : _rate;
    var money = function (v) { return (usd && rate) ? (v / rate).toLocaleString("en-US", { maximumFractionDigits: 0 }) : F(v); };
    var months = []; for (var mo = 1; mo <= 12; mo++) months.push(year + "-" + String(mo).padStart(2, "0"));
    var snaps = months.map(function (mm) { return { ym: mm, snap: all[mm] || null }; });
    var _cw = (CHASAN_CFG.commonWeights || {}), _cwsum = REVENUE_DEPTS.reduce(function (a, t) { return a + (+_cw[t] || 0); }, 0), _cwf = ((CHASAN_CFG.commonAllocNormalize !== false) && _cwsum > 0) ? 1 / _cwsum : 1;
    var _fsMonths = snaps.filter(function (o) { return o.snap && o.snap.finalizedAt && o.snap.byDept; });
    var _entVals = function (ent, sp) {
      if (ent === "__TOTAL__") { var t = sp.totals || {}; var _tr = +t.revenue || 0, _tc = +t.cogs || 0; return { revenue: _tr, cogs: _tc, gross: _tr - _tc, labor: +t.labor || 0, opex: +t.opex || 0, extra: +t.extra || 0, op: +t.op || 0 }; }
      var b = sp.byDept[ent] || {}, cc = sp.byDept.COMMON || {}, w = (+_cw[ent] || 0) * _cwf, o = {};
      ["revenue", "cogs", "labor", "opex", "extra"].forEach(function (k) { o[k] = (+b[k] || 0) + (+cc[k] || 0) * w; });
      o.gross = o.revenue - o.cogs; o.op = o.revenue - o.cogs - o.labor - o.opex - o.extra; return o;
    };
    var _fsLines = [["\uB9E4\uCD9C \u00B7 Revenue", "revenue", false], ["(\u2212) \uB9E4\uC785\uC6D0\uAC00 \u00B7 COGS", "cogs", false], ["= \uB9E4\uCD9C\uCD1D\uC774\uC775 \u00B7 Gross Profit", "gross", "sub"], ["(\u2212) \uC778\uAC74\uBE44 \u00B7 Labor", "labor", false], ["(\u2212) \uD310\uAD00\uBE44 \u00B7 OpEx", "opex", false], ["(\u2212) EXTRA", "extra", false], ["= \uC601\uC5C5\uC774\uC775 \u00B7 OP", "op", true]];
    var _fsEnts = [["\uC804\uCCB4 \u00B7 Total", "__TOTAL__", "#111827"], ["FUR VN", "FUR VN", "#2563eb"], ["FUR MX", "FUR MX", "#16a34a"], ["SOURCING", "SOURCING", "#d97706"]];
    if (!_fsMonths.length) return '<div class="form-card" style="padding:14px 16px;font-size:12px;color:var(--text-3)">\uD655\uC815\uB41C \uC6D4\uC774 \uC5C6\uC2B5\uB2C8\uB2E4. \uC6D4\uBCC4 \uCC44\uC0B0\uC5D0\uC11C \uD655\uC815\uD558\uBA74 \uC5EC\uAE30\uC5D0 \uC6D4\uBCC4+\uB204\uC801 \uC7AC\uBB34\uC81C\uD45C\uAC00 \uC313\uC785\uB2C8\uB2E4.</div>';
    var fsHtml = "";
    _fsEnts.forEach(function (en) {
      var title = en[0], ent = en[1], color = en[2];
      var mvals = _fsMonths.map(function (o) { return _entVals(ent, o.snap); });
      var cum = { revenue: 0, cogs: 0, labor: 0, opex: 0, extra: 0, op: 0 }; cum.gross = 0;
      mvals.forEach(function (v) { ["revenue", "cogs", "gross", "labor", "opex", "extra", "op"].forEach(function (k) { cum[k] += v[k]; }); });
      var th = '<th style="padding:5px 9px;text-align:left;font-size:10px;color:var(--text-3)">\uD56D\uBAA9 \u00B7 Item</th>' + _fsMonths.map(function (o) { return '<th style="padding:5px 9px;text-align:right;font-size:10px;color:var(--text-3)">' + E(o.ym.slice(5)) + '\uC6D4</th>'; }).join("") + '<th style="padding:5px 9px;text-align:right;font-size:10px;color:var(--text-2);font-weight:700;border-left:2px solid var(--text-3)">\uB204\uC801 \u00B7 YTD</th>';
      var rows = _fsLines.map(function (ln) {
        var lbl = ln[0], key = ln[1], typ = ln[2]; var isTot = (typ === true), isSub = (typ === "sub");
        var fw = isTot ? ";font-weight:700" : (isSub ? ";font-weight:600" : "");
        var subColor = isSub ? ";color:#1d4ed8" : "";
        var cells = mvals.map(function (v) { var x = v[key]; return '<td style="padding:5px 9px;text-align:right;font-family:var(--mono);' + (x < 0 ? "color:var(--danger)" : "") + fw + subColor + '">' + money(x) + '</td>'; }).join("");
        var cx = cum[key]; var cumCell = '<td style="padding:5px 9px;text-align:right;font-family:var(--mono);border-left:2px solid var(--text-3);font-weight:700;' + (cx < 0 ? "color:var(--danger)" : subColor) + '">' + money(cx) + '</td>';
        var rowStyle = isTot ? ' style="border-top:2px solid var(--text)"' : (isSub ? ' style="border-top:1px solid var(--border);background:var(--surface-2)"' : "");
        return '<tr' + rowStyle + '><td style="padding:5px 9px' + fw + subColor + '">' + lbl + '</td>' + cells + cumCell + '</tr>';
      }).join("");
      var _rrow = function (label, key, neg) {
        var cells = mvals.map(function (v) {
          var col = (neg && v.revenue && v[key] < 0) ? ";color:var(--danger)" : "";
          return '<td style="padding:4px 9px;text-align:right;font-size:10px' + col + '">' + (v.revenue ? ((v[key] / v.revenue) * 100).toFixed(1) + "%" : "\u2014") + '</td>';
        }).join("");
        var ccol = (neg && cum.revenue && cum[key] < 0) ? ";color:var(--danger)" : "";
        return '<tr style="color:var(--text-3);background:var(--surface-2)"><td style="padding:4px 9px;font-size:10px">' + label + '</td>' + cells
          + '<td style="padding:4px 9px;text-align:right;font-size:10px;font-weight:700;border-left:2px solid var(--text-3)' + ccol + '">' + (cum.revenue ? ((cum[key] / cum.revenue) * 100).toFixed(1) + "%" : "\u2014") + '</td></tr>';
      };
      var mgRow = '<tr style="background:var(--surface-2);border-top:1px solid var(--border)"><td colspan="' + (_fsMonths.length + 2) + '" style="padding:4px 9px;font-size:10px;color:var(--text-3)">\uAD6C\uC131\uBE44 \u00B7 Ratios (\u00F7 \uB9E4\uCD9C)</td></tr>'
        + _rrow("\uB9E4\uCD9C\uC6D0\uAC00\uC728 \u00B7 COGS%", "cogs", false)
        + _rrow("\uB9E4\uCD9C\uCD1D\uC774\uC775\uB960 \u00B7 GP%", "gross", false)
        + _rrow("\uC601\uC5C5\uC774\uC775\uB960 \u00B7 OP%", "op", true);
      fsHtml += '<div class="form-card" style="padding:0;overflow:hidden;margin-bottom:12px"><div style="padding:8px 14px;font-size:12px;font-weight:700;border-bottom:1px solid var(--border);border-left:4px solid ' + color + '">' + title + '</div><div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:11.5px"><thead><tr style="background:var(--surface-2)">' + th + '</tr></thead><tbody>' + rows + mgRow + '</tbody></table></div></div>';
    });
    return fsHtml;
  };
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
    var money = function (v) { return (_usd && _rate) ? (v / _rate).toLocaleString("en-US", { maximumFractionDigits: 0 }) : F(v); };
    var _unit = (_usd && _rate) ? "USD" : "VND";
    var rowsHtml = snaps.map(function (o) {
      var s = o.snap, fin = !!(s && s.finalizedAt);
      var opCell = function (d) { var b = s && s.byDept && s.byDept[d]; var v = b ? b.op : null; var pc = (b && b.revenue) ? ' <span style="color:var(--text-3);font-size:9px">(' + (((b.margin != null ? b.margin : (b.op / b.revenue)) || 0) * 100).toFixed(1) + '%)</span>' : ""; return '<td style="padding:6px 10px;text-align:right;font-family:var(--mono);' + (v < 0 ? "color:var(--danger)" : "") + '">' + (v == null ? "—" : money(v) + pc) + "</td>"; };
      var tot = s && s.totals ? s.totals.op : null;
      var totPct = (s && s.totals && s.totals.revenue) ? ' <span style="color:var(--text-3);font-weight:400;font-size:10px">(' + (((s.totals.margin!=null?s.totals.margin:(s.totals.op/s.totals.revenue))||0)*100).toFixed(1) + '%)</span>' : "";
      return '<tr style="' + (s ? "" : "opacity:.45") + '"><td style="padding:6px 10px">' + E(o.ym.slice(5)) + "월</td>" + DEPTS.map(opCell).join("") + '<td style="padding:6px 10px;text-align:right;font-family:var(--mono);font-weight:700;' + (tot < 0 ? "color:var(--danger)" : "") + '">' + (tot == null ? "—" : money(tot) + totPct) + "</td><td style=\"padding:6px 10px;text-align:center\">" + (fin ? '<span style="color:var(--success);font-weight:700">✓ ' + E((s.finalizedAt || "").slice(0, 10)) + "</span>" : (s ? '<span style="color:var(--text-3)">임시 · Draft</span>' : '<span style="color:var(--text-3)">—</span>')) + "</td></tr>";
    }).join("");
    var ytd = {}; DEPTS.forEach(function (d) { ytd[d] = { revenue: 0, cogs: 0, labor: 0, opex: 0, extra: 0, op: 0 }; });
    var ytdTot = { revenue: 0, cogs: 0, labor: 0, opex: 0, extra: 0, op: 0 }, finCount = 0;
    snaps.forEach(function (o) { var s = o.snap; if (!(s && s.finalizedAt && s.byDept)) return; finCount++; DEPTS.forEach(function (d) { var b = s.byDept[d] || {}; ["revenue", "cogs", "labor", "opex", "extra", "op"].forEach(function (k) { ytd[d][k] += (+b[k] || 0); ytdTot[k] += (+b[k] || 0); }); }); });
    var ytdLine = function (label, key) { return '<tr><td style="padding:6px 10px">' + label + "</td>" + DEPTS.map(function (d) { var v = ytd[d][key]; return '<td style="padding:6px 10px;text-align:right;font-family:var(--mono);' + (v < 0 ? "color:var(--danger)" : "") + '">' + money(v) + "</td>"; }).join("") + '<td style="padding:6px 10px;text-align:right;font-family:var(--mono);font-weight:700;' + (ytdTot[key] < 0 ? "color:var(--danger)" : "") + '">' + money(ytdTot[key]) + "</td></tr>"; };
    var _cw = (CHASAN_CFG.commonWeights || {}), _cwsum = REVENUE_DEPTS.reduce(function (a, t) { return a + (+_cw[t] || 0); }, 0), _cwf = ((CHASAN_CFG.commonAllocNormalize !== false) && _cwsum > 0) ? 1 / _cwsum : 1;
    var ytdAlloc = {}; REVENUE_DEPTS.forEach(function (d) { ytdAlloc[d] = {}; ["revenue", "cogs", "labor", "opex", "extra", "op"].forEach(function (k) { ytdAlloc[d][k] = (+ytd[d][k] || 0) + (+(((ytd.COMMON || {})[k]) || 0)) * ((+_cw[d] || 0) * _cwf); }); });
    var _ytdCell = function (obj, key, bold) { var v = +obj[key] || 0; return '<td style="padding:6px 10px;text-align:right;font-family:var(--mono);' + (bold ? "font-weight:700;" : "") + (v < 0 ? "color:var(--danger)" : "") + '">' + money(v) + "</td>"; };
    var _ytdLine = function (label, key) { return '<tr><td style="padding:6px 10px">' + label + "</td>" + _ytdCell(ytdTot, key, true) + REVENUE_DEPTS.map(function (d) { return _ytdCell(ytdAlloc[d], key); }).join("") + "</tr>"; };
    var fsHtml = window.chasanBuildYtdFsTable(year, { usd: _usd, rate: _rate, all: all });
        var series = [{ name: "전체 영업이익 · Total OP", color: "#111827", values: snaps.map(function (o) { return o.snap && o.snap.totals ? (+o.snap.totals.op || 0) : 0; }) }];
    var seriesRev = [{ name: "전체 매출액 · Total Revenue", color: "#1d4ed8", values: snaps.map(function (o) { var t = o.snap && o.snap.totals; return t ? (+t.revenue || 0) : 0; }) }];
    var yearSel = '<select onchange="chasanHistYear(this.value)" style="border:1px solid var(--border);border-radius:8px;padding:5px 9px;font-size:13px">' + yList.map(function (yy) { return '<option value="' + yy + '"' + (yy === year ? " selected" : "") + ">" + yy + "년</option>"; }).join("") + "</select>";
    host.innerHTML = _csTabs("history")
      + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px"><span style="font-size:12px;color:var(--text-3)">연도 · Year</span>' + yearSel + '<button onclick="chasanDownloadHistoryXlsx(&#39;' + year + '&#39;)" style="border:1px solid var(--border);background:none;color:var(--text-2);font-size:11px;cursor:pointer;padding:6px 11px;border-radius:7px;margin-left:8px">⬇ Excel</button><label style="font-size:11px;color:var(--text-3);display:flex;align-items:center;gap:5px;margin-left:6px"><input type="checkbox" id="csHistUsd"' + (_usd ? " checked" : "") + ' onchange="chasanHistUsd(this.checked)"> USD</label><input id="csHistRate" type="number" placeholder="VND/USD" value="' + (_rate || "") + '" onchange="chasanHistRate(this.value)" style="width:92px;border:1px solid var(--border);border-radius:6px;padding:5px 7px;font-size:12px"><span style="flex:1"></span><span style="font-size:11px;color:var(--text-3)">Finalized ' + finCount + '개월/months · 임시·미저장 월 제외 · Draft/none excluded</span></div>'
      + '<div style="display:flex;gap:14px;flex-wrap:wrap;margin-bottom:14px">'
      +   '<div class="form-card" style="flex:1 1 300px;min-width:280px;padding:12px 14px"><div style="font-size:12px;font-weight:700;margin-bottom:6px">영업이익 추이 · Operating Profit (' + year + ')</div>' + _csLineChart(series, months) + "</div>"
      +   '<div class="form-card" style="flex:1 1 300px;min-width:280px;padding:12px 14px"><div style="font-size:12px;font-weight:700;margin-bottom:6px">매출액 추이 · Revenue (' + year + ')</div>' + _csLineChart(seriesRev, months) + "</div>"
      + '</div>'
      + '<div class="form-card" style="padding:0;overflow:hidden;margin-bottom:14px"><div style="padding:10px 16px;font-size:13px;font-weight:700;border-bottom:1px solid var(--border)">월별 영업이익 · Monthly OP</div><div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:var(--surface-2)"><th style="padding:6px 10px;text-align:left;font-size:10px;color:var(--text-3)">월 · Month</th>' + DEPTS.map(function (d) { return '<th style="padding:6px 10px;text-align:right;font-size:10px;color:var(--text-3)">' + E(d) + "</th>"; }).join("") + '<th style="padding:6px 10px;text-align:right;font-size:10px;color:var(--text-3)">합계 · Total</th><th style="padding:6px 10px;text-align:center;font-size:10px;color:var(--text-3)">확정 · Fin.</th></tr></thead><tbody>' + rowsHtml + "</tbody></table></div></div>"
      + '<div style="font-size:13px;font-weight:700;margin:2px 0 8px">📑 부서별 손익 · 월별 & 누적 · Monthly & YTD (' + _unit + ' · COMMON 배분)</div>' + fsHtml;
  };
  function _fmtPct(m) { return Math.round((m || 0) * 1000) / 10; }
  window.chasanBuildWorkbook = function (ym, r, lw, extra, laborRows, allSnaps) {
    var wb = XLSX.utils.book_new(), D = DEPTS;
    var rowF = function (label, key) { return [label].concat(D.map(function (d) { return r.byDept[d][key]; })).concat([r.totals[key]]); };
    var _gr = function (o) { return (+(o || {}).revenue || 0) - (+(o || {}).cogs || 0); };
    var _rt = function (o, key) { var rv = +(o || {}).revenue || 0; if (!rv) return ""; var v = (key === "gross") ? _gr(o) : (+(o || {})[key] || 0); return Math.round((v / rv) * 1000) / 10; };
    var rowP = function (label, key) { return [label].concat(D.map(function (d) { return _rt(r.byDept[d], key); })).concat([_rt(r.totals, key)]); };
    var m1 = [
      ["부서 채산 · " + ym, "", "", "", "", ""],
      ["항목"].concat(D).concat(["합계"]),
      rowF("매출 Revenue", "revenue"), rowF("(-) 매입원가 COGS", "cogs"), rowF("(-) 인건비 Labor", "labor"),
      rowF("(-) 판관비 OpEx", "opex"), rowF("(-) EXTRA(타법인)", "extra"), rowF("영업이익 OP", "op"),
      rowP("매출원가율(%)", "cogs"), rowP("매출총이익률(%)", "gross"), rowP("영업이익률(%)", "op")
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
      var h5 = [["YTD 누적 · " + year, "", "", "", "", ""], ["항목"].concat(D).concat(["합계"]), yr("매출", "revenue"), yr("(-)COGS", "cogs"), yr("(-)인건비", "labor"), yr("(-)판관비", "opex"), yr("(-)EXTRA", "extra"), yr("영업이익", "op"),
        ["매출원가율(%)"].concat(D.map(function (d) { return _rt(ytd[d], "cogs"); })).concat([_rt(tt, "cogs")]),
        ["매출총이익률(%)"].concat(D.map(function (d) { return _rt(ytd[d], "gross"); })).concat([_rt(tt, "gross")]),
        ["영업이익률(%)"].concat(D.map(function (d) { return _rt(ytd[d], "op"); })).concat([_rt(tt, "op")])];
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
  window.renderChasanForecastView = async function (host, ym) {
    host = typeof host === "string" ? document.getElementById(host) : host; if (!host) return;
    host.innerHTML = _csTabs("forecast") + '<div id="csBody" style="font-size:13px;color:var(--text-3)">계산 중… / Đang tính…</div>';
    var body = host.querySelector("#csBody");
    try {
      if (_lw === null) await chasanLwLoad();
      if (_fcCfg === null) await chasanFcCfgLoad();
      if (_cogsVendors === null) await chasanCogsVendorsLoad();
      var r = await chasanCompute(ym);
      window._csLastR = r; window._csLastYm = ym; window._fcHost = host; window._fcYm = ym;
      body.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin:0 16px 10px">'
        + '<div style="font-size:12px;color:var(--text-3)">기준월 · Based on ' + E(ym) + ' 확정/라이브 채산 → 다음달 손익분기 목표매출</div>'
        + '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">'
        + '<label style="font-size:11px;color:var(--text-3);display:flex;align-items:center;gap:5px"><input type="checkbox" id="fcAlloc"' + (CHASAN_CFG.allocateCommon ? " checked" : "") + '> COMMON 배분 · Allocate</label>'
        + '<label style="font-size:11px;color:var(--text-3);display:flex;align-items:center;gap:5px"><input type="checkbox" id="fcUsd"' + (_usd ? " checked" : "") + '> USD</label>'
        + '<input id="fcRate" type="number" placeholder="VND/USD" value="' + (_rate || "") + '" style="width:100px;border:1px solid var(--border);border-radius:6px;padding:5px 7px;font-size:12px">'
        + '</div></div>'
        + '<div id="csForecast">' + _fcBuildHTML(ym, r) + '</div>';
      var uEl = body.querySelector("#fcUsd"), rEl = body.querySelector("#fcRate"), aEl = body.querySelector("#fcAlloc");
      if (aEl) aEl.onchange = function () { chasanFcToggleAlloc(aEl.checked); };
      if (uEl) uEl.onchange = function () { _usd = uEl.checked; if (_usd && !(+rEl.value)) { alert("월 환율(VND/USD)을 입력하세요."); _usd = false; uEl.checked = false; return; } _fcRerender(); };
      if (rEl) rEl.onchange = function () { _rate = +rEl.value || 0; if (_usd) _fcRerender(); };
    } catch (e) { body.innerHTML = '<div style="padding:20px;color:var(--danger)">예상채산 로드 실패 · Forecast load failed: ' + (e && e.message) + '</div>'; }
  };
  window.renderChasanPage = function () {
    var el = document.getElementById("csMonth");
    var ym = (el && el.value) || (typeof hrYmOf === "function" && window.hrAsof ? hrYmOf(window.hrAsof) : new Date().toISOString().slice(0, 7));
    if (el && !el.value) el.value = ym;
    if (_csView === "history") renderChasanHistory("csHost", ym);
    else if (_csView === "forecast") renderChasanForecastView("csHost", ym);
    else renderChasan(ym, "csHost");
  };
})();
