/* ════════════════════════════════════════════════════════════
   INICS · cashflow.js — 현금흐름 예측 · Cash Flow Forecast (2026-10)
   · 회계 허브 카드 → enterModule('cashflow') → showCashflowApp()
   · 데이터: 메모리 state(invoices·bankTxns·projects·bankAccounts·finFxRate) + /hr/payroll (GET)
   · 원천 데이터(인보이스·은행·프로젝트·급여)는 읽기 전용. 저장하는 것은 수기 예상 매출·매입(/cashflow_manual)뿐.
   · 가정값은 화면에서만 조정 (저장 안 됨).
   ════════════════════════════════════════════════════════════ */
(function () {
  var CSS = [
    "#cashflowApp{--bg:#f7f7f5;--surface:#fff;--surface-2:#f1f1ee;--border:#e4e4df;--text:#1c1c1a;--text-2:#55554f;--text-3:#8a8a83;--in:#047857;--out:#b91c1c;--accent:#1d4ed8;--warn:#b45309;--mono:'JetBrains Mono',ui-monospace,monospace;",
    "position:fixed;inset:0;z-index:900;overflow:auto;background:var(--bg);color:var(--text);font-size:13px}",
    "#cashflowApp *{box-sizing:border-box}",
    "#cashflowApp header{padding:18px 24px 10px;display:flex;align-items:center;gap:12px;flex-wrap:wrap}",
    "#cashflowApp h1{font-size:18px;margin:0}#cashflowApp .sub{color:var(--text-3);font-size:12px}",
    "#cashflowApp .wrap{padding:0 24px 40px;max-width:1500px;margin:0 auto}",
    "#cashflowApp .card{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:14px 16px;margin-bottom:14px}",
    "#cashflowApp .row{display:flex;gap:10px;flex-wrap:wrap;align-items:center}",
    "#cashflowApp .btn{border:1px solid var(--text);background:var(--text);color:#fff;border-radius:7px;padding:7px 13px;font-size:12px;cursor:pointer;font-family:inherit}",
    "#cashflowApp .btn.o{background:none;color:var(--text);border-color:var(--border)}",
    "#cashflowApp .kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px}",
    "#cashflowApp .kpi{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:12px 14px}",
    "#cashflowApp .kpi .l{font-size:11px;color:var(--text-3)}#cashflowApp .kpi .v{font-family:var(--mono);font-size:18px;font-weight:600;margin-top:4px}#cashflowApp .kpi .s{font-size:11px;color:var(--text-2);margin-top:2px}",
    "#cashflowApp .neg{color:var(--out)}#cashflowApp .pos{color:var(--in)}",
    "#cashflowApp .assume{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:8px 14px}",
    "#cashflowApp .assume label{display:flex;flex-direction:column;gap:3px;font-size:11px;color:var(--text-2)}",
    "#cashflowApp .assume input,#cashflowApp .assume select{border:1px solid var(--border);border-radius:6px;padding:5px 7px;font-size:12px;font-family:var(--mono)}",
    "#cashflowApp .tabs{display:flex;gap:4px;margin-bottom:8px}#cashflowApp .tab{padding:6px 12px;border-radius:7px;cursor:pointer;border:1px solid var(--border);background:var(--surface);font-size:12px}#cashflowApp .tab.on{background:var(--text);color:#fff;border-color:var(--text)}",
    "#cashflowApp .tbl{overflow-x:auto}#cashflowApp table{border-collapse:collapse;width:100%;font-size:11.5px}",
    "#cashflowApp th,#cashflowApp td{padding:5px 8px;text-align:right;white-space:nowrap;border-bottom:1px solid var(--border)}",
    "#cashflowApp th{background:var(--surface-2);font-weight:600}",
    "#cashflowApp td:first-child,#cashflowApp th:first-child{text-align:left;position:sticky;left:0;background:var(--surface);z-index:1}#cashflowApp th:first-child{background:var(--surface-2)}",
    "#cashflowApp td.n{font-family:var(--mono)}#cashflowApp td.c{cursor:pointer}#cashflowApp td.c:hover{background:#eef2ff}",
    "#cashflowApp tr.sec td{font-weight:700;background:var(--surface-2)}#cashflowApp tr.tot td{font-weight:700;border-top:2px solid var(--text)}#cashflowApp tr.close td{font-weight:700;background:#eff6ff}",
    "#cashflowApp .drill{font-size:11.5px}#cashflowApp .drill .it{display:flex;gap:8px;padding:4px 0;border-top:1px solid var(--border)}#cashflowApp .drill .it span:last-child{margin-left:auto;font-family:var(--mono)}",
    "#cashflowApp .warn{font-size:11.5px;color:var(--warn)}#cashflowApp .warn div{padding:3px 0;border-top:1px dashed var(--border)}",
    "#cashflowApp .pill{display:inline-block;padding:1px 7px;border-radius:9px;font-size:10px;background:var(--surface-2);color:var(--text-2)}",
    "#cashflowApp .curT{display:inline-flex;border:1px solid var(--border);border-radius:7px;overflow:hidden}#cashflowApp .cur{border:none;background:var(--surface);padding:7px 12px;font-size:12px;cursor:pointer;font-family:var(--mono)}#cashflowApp .cur.on{background:var(--text);color:#fff}",
    "#cashflowApp #cf_status{font-size:12px;color:var(--text-2)}",
    "@media (max-width:700px){#cashflowApp header,#cashflowApp .wrap{padding-left:12px;padding-right:12px}}"
  ].join("\n");
  var HTML = '<header><button class="btn o" onclick="closeCashflowApp()">← 허브</button><h1>💧 현금흐름 예측 · Cash Flow Forecast</h1><span class="pill">예측 · 원천 데이터 읽기 전용</span>'
    + '<span id="cf_status" class="sub"></span><span style="flex:1"></span><span class="curT"><button class="cur on" data-c="VND" onclick="CF.setDisp(\'VND\')">VND</button><button class="cur" data-c="USD" onclick="CF.setDisp(\'USD\')">USD</button></span><button class="btn o" onclick="CF.exportXlsx()">엑셀 내보내기</button><button class="btn" onclick="CF.load()">다시 계산</button></header>'
    + '<div class="wrap"><div class="kpis" id="cf_kpis"></div>'
    + '<div class="card" style="margin-top:14px"><div class="row" style="justify-content:space-between;margin-bottom:8px"><b>가정 · Assumptions</b><span class="sub">값을 바꾸면 즉시 재계산 · 저장되지 않음</span></div><div class="assume" id="cf_assume"></div></div>'
    + '<div class="card"><div class="row" style="justify-content:space-between"><b>수기 예상 매출·매입 · Manual forecast</b><span class="sub">업체·예정일·금액(VAT 포함)·확률 · 공유 저장</span></div><div id="cf_manual"></div></div>'
    + '<div class="card"><canvas id="cf_chart" height="90"></canvas></div>'
    + '<div class="card"><div class="tabs"><div class="tab on" data-v="week" onclick="CF.view(\'week\')">13주 · Weekly</div><div class="tab" data-v="month" onclick="CF.view(\'month\')">6개월 · Monthly</div><span style="flex:1"></span><span class="sub" id="cf_scnLbl"></span></div><div class="tbl" id="cf_tbl"></div></div>'
    + '<div class="card drill" id="cf_drill"><span class="sub">표의 금액을 클릭하면 구성 항목(인보이스·프로젝트·반복비용)이 여기 표시됩니다.</span></div>'
    + '<div class="card"><b>확인 필요 · Data issues</b><div class="warn" id="cf_warns" style="margin-top:6px"></div></div>'
    + '<div class="card sub" id="cf_method"></div></div>';
  var ROOT = null;
  function ensure() {
    if (ROOT) return ROOT;
    if (!document.getElementById("cashflowAppCss")) { var st = document.createElement("style"); st.id = "cashflowAppCss"; st.textContent = CSS; document.head.appendChild(st); }
    ROOT = document.createElement("div"); ROOT.id = "cashflowApp"; ROOT.style.display = "none"; ROOT.innerHTML = HTML; document.body.appendChild(ROOT);
    return ROOT;
  }
  window.showCashflowApp = function () { var hub = document.getElementById("hubPage"); if (hub) hub.style.display = "none"; ensure().style.display = "block"; ROOT.scrollTop = 0; CF.load(); };
  window.closeCashflowApp = function () { if (ROOT) ROOT.style.display = "none"; if (typeof showHub === "function") showHub(); };
  var CF = (function () {
    var BASE = "https://inics-approval-default-rtdb.asia-southeast1.firebasedatabase.app";
    var V2 = BASE + "/inics_approval/state2";
    var D = null, R = null, VIEW = "week", CHART = null;
    var A = {   // 가정
      scenario: "base", fx: 26300, horizonW: 13, dsoDefault: 30, dpoDefault: 30,
      overdueDays: 90, includePipeline: true, pStageWon: 0.7, pStagePo: 0.9, pStageDelivered: 0.95,
      vatMode: "auto", opexMonths: 3, minCash: 100000000, disp: "VND", apVendors: "FURSYS"
    };
    var SCN = {
      base:         { lbl: "기준 · Base",         arDelay: 0,  pipe: 1.0, overdue: "w1",   opex: 1.00 },
      conservative: { lbl: "보수 · Conservative", arDelay: 15, pipe: 0.5, overdue: "drop", opex: 1.10 },
      optimistic:   { lbl: "낙관 · Optimistic",   arDelay: -5, pipe: 1.0, overdue: "w1",   opex: 0.95 }
    };

    // ── 유틸 ──
    function num(v) { var n = parseFloat(String(v == null ? "" : v).replace(/[,\s]/g, "")); return isNaN(n) ? 0 : n; }
    function F(n) { return Math.round(n || 0).toLocaleString("en-US"); }
    function dv(n) { return A.disp === "USD" && A.fx > 0 ? (n || 0) / A.fx : (n || 0); }   // 표시 통화 환산 (계산은 VND)
    function Fd(n) { var v = dv(n); return A.disp === "USD" ? "$" + Math.round(v).toLocaleString("en-US") : F(v); }
    function Fmd(n) { var v = dv(n), a = Math.abs(v), sg = v < 0 ? "−" : "", p = A.disp === "USD" ? "$" : "";
      if (A.disp === "USD") return sg + p + (a >= 1e6 ? (a / 1e6).toFixed(2) + "M" : a >= 1e3 ? (a / 1e3).toFixed(1) + "K" : Math.round(a).toLocaleString("en-US"));
      return Fm(v); }
    function Fm(n) { var a = Math.abs(n); return (n < 0 ? "−" : "") + (a >= 1e9 ? (a / 1e9).toFixed(2) + "B" : a >= 1e6 ? (a / 1e6).toFixed(1) + "M" : F(a)); }
    function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
    function iso(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
    function dk(s) {   // 다양한 날짜 → YYYY-MM-DD
      s = String(s || "").trim(); var m = s.match(/(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/);
      if (m) return m[1] + "-" + m[2].padStart(2, "0") + "-" + m[3].padStart(2, "0");
      m = s.match(/(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})/);
      if (m) { var y = m[3].length === 2 ? "20" + m[3] : m[3]; return y + "-" + m[2].padStart(2, "0") + "-" + m[1].padStart(2, "0"); }
      return "";
    }
    function addD(isoS, n) { var p = isoS.split("-").map(Number), d = new Date(p[0], p[1] - 1, p[2]); d.setDate(d.getDate() + Math.round(n)); return iso(d); }
    function diffD(a, b) { var pa = a.split("-").map(Number), pb = b.split("-").map(Number); return Math.round((new Date(pa[0], pa[1] - 1, pa[2]) - new Date(pb[0], pb[1] - 1, pb[2])) / 864e5); }
    function ymOf(s) { return s.slice(0, 7); }
    function addM(ym, k) { var p = ym.split("-").map(Number), d = new Date(p[0], p[1] - 1 + k, 1); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"); }
    function median(a) { if (!a.length) return null; var s = a.slice().sort(function (x, y) { return x - y; }), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
    function norm(s) { return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[đĐ]/g, "D").toUpperCase().replace(/\s+/g, " ").trim(); }
    function toArr(m) { return !m ? [] : Array.isArray(m) ? m.filter(Boolean) : Object.keys(m).map(function (k) { return m[k]; }).filter(Boolean); }
    function vnd(amount, cur, fxRate) { cur = String(cur || "VND").toUpperCase(); if (cur === "VND") return amount; var r = num(fxRate); if (r > 0) return amount * r; if (cur === "USD") return amount * A.fx; return amount * A.fx; }

    // ── 로드 (읽기 전용 GET) ──
    async function getJ(url) { var r = await fetch(url, { cache: "no-cache" }); if (!r.ok) throw new Error(r.status + " " + url.replace(BASE, "")); return r.json(); }
    async function load() {
      setStatus("계산 중…");
      try {
        var S0 = (typeof state !== "undefined" && state) || {};
        var pay = {}, months = [];
        try { var sh = await getJ(BASE + "/hr/payroll.json?shallow=true"); months = sh ? Object.keys(sh).filter(function (k) { return /^\d{4}-\d{2}$/.test(k); }).sort().slice(-4) : []; } catch (e) { }
        for (var i = 0; i < months.length; i++) { try { pay[months[i]] = await getJ(BASE + "/hr/payroll/" + months[i] + ".json"); } catch (e) { } }
        var man = []; try { man = toArr(await getJ(BASE + "/cashflow_manual.json")); } catch (e) { }
        D = { manual: man, invoices: (S0.invoices || []).slice(), bankTxns: (S0.bankTxns || []).slice(), projects: (S0.projects || []).slice(), bankAccounts: (S0.bankAccounts || []).slice(), payroll: pay, today: iso(new Date()) };
        if (num(S0.finFxRate) > 0 && !A._fxTouched) A.fx = num(S0.finFxRate);
        setStatus("인보이스 " + D.invoices.length + " · 은행거래 " + D.bankTxns.length + " · 프로젝트 " + D.projects.length + " · 급여대장 " + (months.join(", ") || "없음"));
        run();
      } catch (e) { setStatus("⚠ 계산 실패: " + e.message); }
    }
    function setStatus(s) { var el = document.getElementById("cf_status"); if (el) el.textContent = s; }

    // ── 엔진 ──
    function compute(data, a, scnKey) {
      var S = SCN[scnKey], W = [], issues = [], items = [];
      var txns = data.bankTxns.map(function (t) { return Object.assign({}, t, { _d: dk(t.date) }); }).filter(function (t) { return t._d; });
      // 대사 할당 (invAllocs 단일 원천 + 구버전 matchInvIds)
      var invById = {}; data.invoices.forEach(function (v) { invById[String(v.id)] = v; });
      var settled = {}, lastPay = {};
      txns.forEach(function (t) {
        var al = Array.isArray(t.invAllocs) ? t.invAllocs : (Array.isArray(t.matchInvIds) ? t.matchInvIds : (t.matchInvId != null ? [t.matchInvId] : [])).map(function (id) { var v = invById[String(id)]; return { invId: String(id), cents: v ? Math.round(num(v.total) * 100) : 0 }; });
        al.forEach(function (x) { var k = String(x.invId); settled[k] = (settled[k] || 0) + (+x.cents || 0) / 100; if (!lastPay[k] || t._d > lastPay[k]) lastPay[k] = t._d; });
      });
      // 앱의 정산 규칙(수수료 처리·감액 상계 포함)이 있으면 그대로 사용
      if (typeof _invSettledCents === "function") data.invoices.forEach(function (v) { try { settled[String(v.id)] = _invSettledCents(v) / 100; } catch (e) { } });
      // 기준일 = 은행 데이터 최종일
      var lastBank = txns.reduce(function (m, t) { return t._d > m ? t._d : m; }, "");
      var start = lastBank ? addD(lastBank, 1) : data.today;
      if (lastBank && diffD(data.today, lastBank) > 7) issues.push("은행 데이터가 " + diffD(data.today, lastBank) + "일 전(" + lastBank + ")까지만 있음 — 그 이후 실제 입출금은 반영되지 않았습니다. 최신 명세서를 올리면 정확도↑");
      // 기초현금: 계좌별 최종 잔액
      // 계좌별 잔액 = 은행 명세서 모듈과 동일 규칙(bankAcctBalance: 최신일 + 같은 날이면 seq 작은 행 = 명세서상 최신)
      var accts = {};
      txns.forEach(function (t) { var k = t.acctNo || "?", c = accts[k], sq = +t.seq || 0;
        if (!c || t._d > c.d || (t._d === c.d && sq < c.seq)) accts[k] = { d: t._d, seq: sq, bal: num(t.balance), cur: t.currency || "VND", src: "명세서" }; });
      (data.bankAccounts || []).forEach(function (b) {
        var c = accts[b.acctNo];
        if (!c) accts[b.acctNo] = { d: "", bal: num(b.balance), cur: b.currency || "VND", src: "계좌 기본값(거래내역 없음)" };
        else if (b.currency) c.cur = b.currency;
      });
      if (typeof bankAcctBalance === "function") Object.keys(accts).forEach(function (k) { try { var v = bankAcctBalance(k); if (typeof v === "number" && isFinite(v)) accts[k].bal = v; } catch (e) { } });
      Object.keys(accts).forEach(function (k) { if (accts[k].src !== "명세서") issues.push("계좌 " + k + " 거래내역 없음 → 계좌 설정의 기본 잔액 " + F(accts[k].bal) + " " + accts[k].cur + " 사용 (명세서 업로드 필요)"); });
      var opening = 0, openRows = [];
      Object.keys(accts).forEach(function (k) { var c = accts[k], v = vnd(c.bal, c.cur); opening += v; openRows.push({ acct: k, cur: c.cur, bal: c.bal, vnd: v, asof: c.d, src: c.src }); });
      // 버킷
      var nW = a.horizonW, weeks = []; for (var i = 0; i < nW; i++) weeks.push({ from: addD(start, i * 7), to: addD(start, i * 7 + 6) });
      var endW = weeks[nW - 1].to, nM = 6, months = []; for (var j = 0; j < nM; j++) months.push(addM(ymOf(start), j));
      var endM = months[nM - 1] + "-31";
      function push(it) { if (!it.amt || !isFinite(it.amt)) return; if (it.date < start) it.date = start; items.push(it); }

      // ① 실적 DSO / DPO (거래처별 중앙값)
      var lag = { issued: {}, received: {} }, allLag = { issued: [], received: [] };
      data.invoices.forEach(function (v) {
        var k = String(v.id), tot = num(v.total); if (tot <= 0 || !lastPay[k]) return;
        if ((settled[k] || 0) < tot - 1) return;
        var d0 = dk(v.date); if (!d0) return; var L = diffD(lastPay[k], d0); if (L < 0 || L > 365) return;
        var who = norm(v.dir === "issued" ? (v.buyer || v.vendor) : v.vendor); var bag = lag[v.dir]; if (!bag) return;
        (bag[who] = bag[who] || []).push(L); allLag[v.dir].push(L);
      });
      var gDSO = median(allLag.issued), gDPO = median(allLag.received);
      if (gDSO == null) gDSO = a.dsoDefault; if (gDPO == null) gDPO = a.dpoDefault;

      // ② 매출채권 / ③ 매입채무 (미결 잔액)
      var apKeys = String(a.apVendors || "").split(",").map(function (x) { return norm(x); }).filter(Boolean);
      var isApVendor = function (v) { if (!apKeys.length) return true; var n = norm(v.vendor) + " " + norm(v.vendorMst); return apKeys.some(function (k) { return n.indexOf(k) >= 0; }); };
      var apSkip = { n: 0, amt: 0, names: {} };
      data.invoices.forEach(function (v) {
        if (v.dir !== "issued" && v.dir !== "received") return;
        var k = String(v.id), tot = num(v.total), rem = tot - (settled[k] || 0);
        if (Math.abs(rem) < 1000) return;
        if (v.dir === "received" && !isApVendor(v)) { if (rem > 0) { apSkip.n++; apSkip.amt += vnd(rem, v.currency, v.fxRate); var nm = String(v.vendor || "").trim(); apSkip.names[nm] = (apSkip.names[nm] || 0) + 1; } return; }
        var d0 = dk(v.date) || start, who = v.dir === "issued" ? (v.buyer || v.vendor || "") : (v.vendor || "");
        var cur = String(v.currency || "VND").toUpperCase(), amtV = vnd(rem, cur, v.fxRate);
        if (cur !== "VND" && !(num(v.fxRate) > 0)) issues.push("환율 미입력 → 가정 환율 적용: " + (v.dir === "issued" ? "매출" : "매입") + " #" + (v.invoiceNo || v.id) + " " + who + " " + cur + " " + F(rem));
        if (rem < 0) { issues.push((v.dir === "issued" ? "감액/초과입금 매출 인보이스" : "음수 매입 인보이스") + " #" + (v.invoiceNo || v.id) + " " + who + " " + F(rem) + " — 예측에서 제외 (환불·상계 여부 확인)"); return; }
        var hist = lag[v.dir][norm(who)], lagD = hist && hist.length ? median(hist) : (v.dir === "issued" ? gDSO : gDPO);
        var due = v.dueDate ? dk(v.dueDate) : "", exp = due || addD(d0, lagD);
        if (v.dir === "issued") exp = addD(exp, S.arDelay);
        var age = diffD(start, exp), src = due ? "만기일" : (hist && hist.length ? "거래처 실적 " + Math.round(lagD) + "일" : "평균 " + Math.round(lagD) + "일");
        if (v.dir === "issued" && age > a.overdueDays) {
          issues.push("장기 미회수 " + age + "일 경과: 매출 #" + (v.invoiceNo || v.id) + " " + who + " " + F(amtV) + (S.overdue === "drop" ? " — 이 시나리오에서 제외" : " — 1주차 회수 가정"));
          if (S.overdue === "drop") return;
        }
        push({ kind: v.dir === "issued" ? "ar" : "ap", sign: v.dir === "issued" ? 1 : -1, amt: amtV, date: exp,
          label: (v.dir === "issued" ? "매출 " : "매입 ") + "#" + (v.invoiceNo || v.id) + " · " + who, note: src + (age > 0 ? " · 연체 " + age + "일" : "") + (rem < tot - 1 ? " · 부분입금 후 잔액" : "") });
      });

      if (apSkip.n) { var top = Object.keys(apSkip.names).sort(function (x, y) { return apSkip.names[y] - apSkip.names[x]; }).slice(0, 4).map(function (x) { return x.replace(/^CÔNG TY (TNHH|CỔ PHẦN)\s*/i, "") + " " + apSkip.names[x] + "건"; }).join(", ");
        issues.push("매입채무 제외 " + apSkip.n + "건 · " + F(apSkip.amt) + " — 대상 업체(" + a.apVendors + ") 외 매입 인보이스는 카드·현금 기지급 영수증으로 간주 (" + top + (Object.keys(apSkip.names).length > 4 ? " 외" : "") + ")"); }

      // ④ 파이프라인: 수주·PO·납품 단계의 미청구 매출 / 미수취 매입
      if (a.includePipeline) {
        var prob = { won: a.pStageWon, po: a.pStagePo, delivered: a.pStageDelivered };
        data.projects.forEach(function (p) {
          if (!p || !(p.stage in prob)) return;
          var s = p.sales || {}, pu = p.purchase || {}, pr = Math.min(1, prob[p.stage] * S.pipe), prOut = prob[p.stage];   // 보수: 유입만 할인, 매입은 기준 확률 유지
          var name = (p.clientFull || p.client || "") + (p.projName ? " · " + p.projName : "");
          var linked = data.invoices.filter(function (v) { return String(v.projectId || "") === String(p.id); });
          var sTot = vnd(num(s.total), s.currency), sInv = linked.filter(function (v) { return v.dir === "issued"; }).reduce(function (x, v) { return x + vnd(num(v.total), v.currency, v.fxRate); }, 0);
          var pTot = vnd(num(pu.total), pu.currency), pInv = linked.filter(function (v) { return v.dir === "received"; }).reduce(function (x, v) { return x + vnd(num(v.total), v.currency, v.fxRate); }, 0);
          var tgt = dk(p.targetDate);
          if (!tgt) { if (sTot - sInv > 1000 || pTot - pInv > 1000) issues.push("목표일 없음 → 기준일+30일 가정: 프로젝트 " + name); tgt = addD(start, 30); }
          if (tgt < start) tgt = start;
          var sRem = sTot - sInv; if (sRem > 1000) push({ kind: "pipeIn", sign: 1, amt: sRem * pr, date: addD(addD(tgt, gDSO), S.arDelay), label: "미청구 매출 · " + name, note: p.stage + " " + Math.round(pr * 100) + "% · 납기 " + tgt + " + 회수 " + Math.round(gDSO) + "일" });
          var pRem = pTot - pInv; if (pRem > 1000) push({ kind: "pipeOut", sign: -1, amt: pRem * prOut, date: addD(tgt, -14), label: "미수취 매입 · " + name, note: p.stage + " " + Math.round(prOut * 100) + "% · 납기 14일 전 지급" });
        });
      }

      // ⑤ 급여·보험·PIT: 최근 확정 대장 + 은행 실적 지급일
      var payMs = Object.keys(data.payroll || {}).filter(function (m) { var L = data.payroll[m]; return L && Array.isArray(L.rows) && L.rows.length; }).sort();
      var lastPayM = payMs[payMs.length - 1];
      function payDay(re, defDay) {
        var days = txns.filter(function (t) { return (+t.debit || 0) > 0 && re.test(norm([t.category, t.note, t.ref].join(" "))); }).map(function (t) { return +t._d.slice(8, 10); });
        var m = median(days); return m == null ? defDay : Math.round(m);
      }
      if (lastPayM) {
        var rows = data.payroll[lastPayM].rows, net = 0, ins = 0, pit = 0;
        rows.forEach(function (r) { net += num(r.net); ins += num(r.ei) + num(r.ci); pit += num(r.pit); });
        var dSal = payDay(/SALARY|WAGE|LUONG/, 5), dIns = payDay(/BHXH|BHYT|BHTN|BAO HIEM|SOCIAL/, 25), dPit = 20;
        // 급여월 M 의 실수령 → 다음달 dSal 일(1~15일) 또는 당월 말(16일 이후) / 보험·PIT → 다음달
        for (var k = 0; k < 7; k++) {
          var M = addM(lastPayM, k + 1), nx = addM(M, 1);
          var salDate = dSal <= 15 ? nx + "-" + String(dSal).padStart(2, "0") : M + "-" + String(Math.min(dSal, 28)).padStart(2, "0");
          push({ kind: "payroll", sign: -1, amt: net, date: salDate, label: "급여 실수령 · " + M, note: lastPayM + " 확정대장 " + rows.length + "명 기준 · 지급일 실적 " + dSal + "일" });
          push({ kind: "ins", sign: -1, amt: ins, date: nx + "-" + String(Math.min(dIns, 28)).padStart(2, "0"), label: "보험료(BHXH·BHYT·BHTN) · " + M, note: "직원+회사 부담" });
          if (pit > 0) push({ kind: "pit", sign: -1, amt: pit, date: nx + "-" + String(dPit).padStart(2, "0"), label: "PIT · " + M, note: "월 신고 가정 (분기 신고면 분기 다음달 일괄)" });
        }
        // 확정 대장이 있는 최근월 자체가 아직 미지급인지 은행으로 확인
        var paidSal = txns.some(function (t) { return t._d >= lastPayM + "-20" && t._d <= addM(lastPayM, 1) + "-31" && /SALARY|WAGE|LUONG/.test(norm([t.category, t.note].join(" "))); });
        var nx0 = addM(lastPayM, 1), inNx = function (re) { return txns.some(function (t) { return ymOf(t._d) === nx0 && (+t.debit || 0) > 0 && re.test(norm([t.category, t.note, t.ref].join(" "))); }); };
        if (!inNx(/BHXH|BHYT|BHTN|BAO HIEM|SOCIAL/)) push({ kind: "ins", sign: -1, amt: ins, date: nx0 + "-" + String(Math.min(dIns, 28)).padStart(2, "0"), label: "보험료(BHXH·BHYT·BHTN) · " + lastPayM, note: "직원+회사 부담 · 은행 납부 미확인" });
        if (pit > 0 && !inNx(/TNCN|THUE THU NHAP|PERSONAL INCOME/)) push({ kind: "pit", sign: -1, amt: pit, date: nx0 + "-20", label: "PIT · " + lastPayM, note: "은행 납부 미확인" });
        if (!paidSal) push({ kind: "payroll", sign: -1, amt: net, date: start, label: "급여 실수령 · " + lastPayM + " (은행 지급 미확인)", note: "통장에 지급 내역이 없어 기준일 지급 가정" });
      } else issues.push("급여 확정대장 없음 → 급여 예측 제외");

      // ⑥ 고정비: 최근 N개월 은행 출금 (매출·매입·급여·보험·세금·이체·대사분 제외) 카테고리별 월평균
      var EXC = /SALES REVENUE|PURCHASE|COGS|SALARY|WAGE|BHXH|BHYT|BHTN|SOCIAL|TAX|VAT|OWNER|CAPITAL|TRANSFER|REFUND|OTHERS INCOME/;
      var mEnd = addM(ymOf(start), -1), mFrom = addM(mEnd, -(a.opexMonths - 1)), cat = {};
      txns.forEach(function (t) {
        var ym = ymOf(t._d), out = (+t.debit || 0) - (+t.credit || 0); if (ym < mFrom || ym > mEnd || out <= 0) return;
        if ((t.invAllocs && t.invAllocs.length) || t.matchInvId != null || (t.matchInvIds && t.matchInvIds.length)) return;
        var c = t.category || "Uncategorized"; if (EXC.test(norm(c))) return;
        var o = cat[c] = cat[c] || { sum: 0, days: [], n: 0 }; o.sum += out; o.days.push(+t._d.slice(8, 10)); o.n++;
      });
      Object.keys(cat).forEach(function (c) {
        var o = cat[c], avg = o.sum / a.opexMonths * S.opex, day = Math.min(28, Math.round(median(o.days) || 15));
        if (c === "Uncategorized") issues.push("미분류 출금 월평균 " + F(o.sum / a.opexMonths) + " — 고정비로 포함 (분류하면 정확도↑)");
        for (var k = 0; k < 8; k++) { var M = addM(ymOf(start), k); push({ kind: "opex", sign: -1, amt: avg, date: M + "-" + String(day).padStart(2, "0"), label: c, note: mFrom + "~" + mEnd + " 월평균 · " + o.n + "건", cat: c }); }
      });

      // ⑦ 부가세: 월별 (매출 VAT − 매입 VAT), 다음달 20일 / 분기 모드면 분기 다음달 20일
      var vatTx = txns.filter(function (t) { return /TAX|VAT|THUE GTGT/.test(norm([t.category, t.note].join(" "))) && (+t.debit || 0) > 0; });
      var vatMonths = {}; vatTx.forEach(function (t) { vatMonths[ymOf(t._d)] = 1; });
      var recentVatM = Object.keys(vatMonths).filter(function (m) { return m >= addM(ymOf(start), -4); }).length;
      var vatMode = a.vatMode === "auto" ? (recentVatM >= 3 ? "monthly" : "quarterly") : a.vatMode;
      var vatBy = {};
      data.invoices.forEach(function (v) {
        var m = ymOf(dk(v.date) || ""); if (!m) return;
        var tot = num(v.total), sub = (v.subtotal != null && v.subtotal !== "") ? num(v.subtotal) : (num(v.vatPct) > 0 ? tot / (1 + num(v.vatPct) / 100) : tot);
        var vat = vnd(tot - sub, v.currency, v.fxRate); if (!vat) return;
        vatBy[m] = (vatBy[m] || 0) + (v.dir === "issued" ? vat : v.dir === "received" ? -vat : 0);
      });
      var lastVatPaid = vatTx.reduce(function (m, t) { return t._d > m ? t._d : m; }, "");
      var vatPeriods = [];
      if (vatMode === "monthly") { for (var q = -2; q < 6; q++) vatPeriods.push([addM(ymOf(start), q)]); }
      else { var qs = function (m) { var p = m.split("-").map(Number); return p[0] + "-" + String(Math.floor((p[1] - 1) / 3) * 3 + 1).padStart(2, "0"); }; var q0 = qs(addM(ymOf(start), -3)); for (var q2 = 0; q2 < 4; q2++) { var f = addM(q0, q2 * 3); vatPeriods.push([f, addM(f, 1), addM(f, 2)]); } }
      var carry = 0;
      vatPeriods.forEach(function (pm) {
        var payDate = addM(pm[pm.length - 1], 1) + "-20", amt = pm.reduce(function (s, m) { return s + (vatBy[m] || 0); }, 0) + carry;
        if (amt < 0) { carry = amt; return; } carry = 0;
        if (payDate < start || (lastVatPaid && lastVatPaid >= addM(pm[pm.length - 1], 1) + "-01")) return;   // 이미 납부한 기간
        var fut = pm.some(function (m) { return m >= ymOf(start); });
        push({ kind: "vat", sign: -1, amt: amt, date: payDate, label: "부가세 · " + pm[0] + (pm.length > 1 ? "~" + pm[pm.length - 1] : ""), note: (vatMode === "monthly" ? "월" : "분기") + " 신고 · 매출VAT−매입VAT" + (fut ? " (기간 미종료 — 등록된 인보이스까지만)" : "") });
      });

      // ⑧ 수기 예상 매출·매입 (업체·시기·확률·반복)
      (data.manual || []).forEach(function (m) {
        if (!m || m.off) return;
        var amt0 = num(m.amount); if (!amt0) return;
        var reps = Math.max(1, Math.min(24, parseInt(m.repeat, 10) || 1)), pr = Math.max(0, Math.min(100, m.prob == null || m.prob === "" ? 100 : num(m.prob))) / 100;
        var isIn = m.type === "in", d0 = dk(m.date) || start;
        for (var r = 0; r < reps; r++) {
          var dt = r ? addM(ymOf(d0), r) + "-" + d0.slice(8, 10) : d0;
          if (dt.slice(8, 10) > "28") dt = dt.slice(0, 8) + "28";
          if (isIn) dt = addD(dt, S.arDelay);
          if (dt < start) issues.push("수기 " + (isIn ? "예상 매출" : "예상 매입") + " 예정일 경과 → 기준일로 이동: " + (m.party || "") + " " + (dk(m.date) || "") + " " + F(vnd(amt0, m.currency, m.fx)) + " (완료됐으면 삭제하세요)");
          var amtV = vnd(amt0, m.currency, m.fx) * pr * (isIn ? Math.min(1, S.pipe + (1 - S.pipe) * (pr >= 1 ? 1 : 0)) : 1);
          push({ kind: isIn ? "manIn" : "manOut", sign: isIn ? 1 : -1, amt: amtV, date: dt,
            label: (isIn ? "예상 매출 · " : "예상 매입 · ") + (m.party || "(업체 미입력)") + (reps > 1 ? " (" + (r + 1) + "/" + reps + ")" : ""),
            note: "수기 입력" + (pr < 1 ? " · 확률 " + Math.round(pr * 100) + "%" : "") + (String(m.currency || "VND").toUpperCase() !== "VND" ? " · " + m.currency + " " + F(amt0) : "") + (m.note ? " · " + m.note : "") + (m.by ? " · " + m.by : "") });
        }
      });

      // ── 집계 ──
      var LINES = [["ar", "매출채권 회수", 1], ["pipeIn", "파이프라인 매출", 1], ["manIn", "예상 매출 (수기)", 1], ["ap", "매입채무 지급", -1], ["pipeOut", "파이프라인 매입", -1], ["manOut", "예상 매입 (수기)", -1],
        ["payroll", "급여 실수령", -1], ["ins", "보험료", -1], ["pit", "PIT", -1], ["vat", "부가세", -1], ["opex", "고정비", -1]];
      function agg(buckets, keyOf) {
        var rows = {}; LINES.forEach(function (L) { rows[L[0]] = buckets.map(function () { return { v: 0, it: [] }; }); });
        var opexCats = {};
        items.forEach(function (it) { var b = keyOf(it.date); if (b < 0) return; rows[it.kind][b].v += it.amt; rows[it.kind][b].it.push(it);
          if (it.kind === "opex") { var oc = opexCats[it.cat] = opexCats[it.cat] || buckets.map(function () { return { v: 0, it: [] }; }); oc[b].v += it.amt; oc[b].it.push(it); } });
        var bal = opening, close = [], netA = [];
        buckets.forEach(function (_, i) { var n = 0; LINES.forEach(function (L) { n += L[2] * rows[L[0]][i].v; }); netA.push(n); bal += n; close.push(bal); });
        return { rows: rows, opexCats: opexCats, net: netA, close: close };
      }
      var wk = agg(weeks, function (d) { for (var i = 0; i < weeks.length; i++) if (d >= weeks[i].from && d <= weeks[i].to) return i; return -1; });
      var mo = agg(months, function (d) { return months.indexOf(ymOf(d)); });
      var minI = 0; wk.close.forEach(function (v, i) { if (v < wk.close[minI]) minI = i; });
      var outM = items.filter(function (it) { return it.sign < 0 && it.date >= start && it.date <= addD(start, 89); }).reduce(function (s, it) { return s + it.amt; }, 0) / 3;
      return { start: start, lastBank: lastBank, opening: opening, openRows: openRows, weeks: weeks, months: months, wk: wk, mo: mo, LINES: LINES,
        min: { v: wk.close[minI], w: weeks[minI] }, burn: outM, gDSO: gDSO, gDPO: gDPO, vatMode: vatMode, lastPayM: lastPayM, issues: issues, items: items };
    }

    // ── 렌더 ──
    function run() {
      if (!D) return;
      R = compute(D, A, A.scenario);
      var alt = {}; Object.keys(SCN).forEach(function (k) { alt[k] = k === A.scenario ? R : compute(D, A, k); });
      renderKpi(alt); renderAssume(); renderManual(); renderChart(alt); renderTable(); renderWarn(); renderMethod();
    }
    function renderKpi(alt) {
      var e = R.wk.close[R.wk.close.length - 1], under = R.wk.close.findIndex(function (v) { return v < A.minCash; });
      var k = [
        ["기초 현금 · " + (R.lastBank || "—"), Fmd(R.opening), R.openRows.map(function (o) { return o.acct.slice(-6) + " " + (o.cur === "VND" ? Fm(o.bal) : "$" + Math.round(o.bal).toLocaleString("en-US")) + (o.asof ? " (" + o.asof.slice(5) + ")" : " (기본값)"); }).join(" · ")],
        ["13주 후 현금", Fmd(e), "변동 " + (e - R.opening >= 0 ? "+" : "") + Fmd(e - R.opening), e < 0],
        ["최저 현금", Fmd(R.min.v), R.min.w.from + " 주", R.min.v < 0],
        ["월평균 지출 (향후 90일)", Fmd(R.burn), "현금 보유 " + (R.burn > 0 ? (R.opening / R.burn).toFixed(1) : "—") + "개월분"],
        ["최소 현금선 " + Fmd(A.minCash), under < 0 ? "유지" : "이탈", under < 0 ? "13주 내 문제 없음" : R.weeks[under].from + " 주부터 미달", under >= 0],
        ["시나리오 비교 (13주 후)", "", Object.keys(SCN).map(function (s) { var c = alt[s].wk.close; return SCN[s].lbl.split(" ·")[0] + " " + Fmd(c[c.length - 1]); }).join(" · ")]
      ];
      document.getElementById("cf_kpis").innerHTML = k.map(function (x) { return '<div class="kpi"><div class="l">' + esc(x[0]) + '</div><div class="v ' + (x[3] ? "neg" : "") + '">' + esc(x[1]) + '</div><div class="s">' + esc(x[2]) + '</div></div>'; }).join("");
    }
    function renderAssume() {
      var f = [["scenario", "시나리오", "sel", Object.keys(SCN).map(function (k) { return [k, SCN[k].lbl]; })], ["fx", "USD→VND 환율", "n"], ["minCash", "최소 현금선 (VND)", "n"],
        ["dsoDefault", "기본 회수일 (실적 없을 때)", "n"], ["dpoDefault", "기본 지급일 (실적 없을 때)", "n"], ["overdueDays", "장기 미회수 기준 (일)", "n"],
        ["includePipeline", "파이프라인 포함", "sel", [["true", "포함"], ["false", "제외"]]], ["pStageWon", "확률 · 수주확정", "n"], ["pStagePo", "확률 · PO완료", "n"], ["pStageDelivered", "확률 · 납품완료", "n"],
        ["apVendors", "매입채무 대상 업체 (쉼표 구분)", "t"], ["vatMode", "부가세 신고", "sel", [["auto", "자동 판정"], ["monthly", "월"], ["quarterly", "분기"]]], ["opexMonths", "고정비 평균 개월수", "n"]];
      var el = document.getElementById("cf_assume"); if (el.dataset.ok) return; el.dataset.ok = 1;
      el.innerHTML = f.map(function (x) {
        var v = A[x[0]];
        if (x[2] === "sel") return '<label>' + x[1] + '<select data-k="' + x[0] + '">' + x[3].map(function (o) { return '<option value="' + o[0] + '"' + (String(v) === o[0] ? " selected" : "") + '>' + o[1] + '</option>'; }).join("") + '</select></label>';
        return '<label>' + x[1] + '<input data-k="' + x[0] + '" value="' + esc(v) + '"' + (x[2] === "t" ? ' style="font-family:inherit"' : "") + '></label>';
      }).join("");
      el.querySelectorAll("[data-k]").forEach(function (inp) { inp.onchange = function () { var k = inp.dataset.k, v = inp.value; if (k === "fx") A._fxTouched = 1; A[k] = (k === "scenario" || k === "vatMode" || k === "apVendors") ? v : (k === "includePipeline" ? v === "true" : num(v)); run(); }; });
    }
    function renderChart(alt) {
      if (typeof Chart === "undefined") {
        if (!window._cfChartLoading) { window._cfChartLoading = 1; var sc = document.createElement("script"); sc.src = "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"; sc.onload = function () { if (R) run(); }; document.head.appendChild(sc); }
        return;
      }
      var lbl = R.weeks.map(function (w) { return w.from.slice(5); }), col = { base: "#1d4ed8", conservative: "#b91c1c", optimistic: "#047857" };
      var ds = Object.keys(SCN).map(function (k) { return { label: SCN[k].lbl, data: alt[k].wk.close.map(dv), borderColor: col[k], backgroundColor: col[k], borderWidth: k === A.scenario ? 2.5 : 1.2, pointRadius: 2, tension: .25 }; });
      ds.push({ label: "최소 현금선", data: lbl.map(function () { return dv(A.minCash); }), borderColor: "#b45309", borderDash: [5, 4], borderWidth: 1, pointRadius: 0 });
      if (CHART) CHART.destroy();
      CHART = new Chart(document.getElementById("cf_chart"), { type: "line", data: { labels: lbl, datasets: ds },
        options: { responsive: true, plugins: { legend: { labels: { boxWidth: 10, font: { size: 11 } } }, tooltip: { callbacks: { label: function (c) { return c.dataset.label + ": " + (A.disp === "USD" ? "$" : "") + Math.round(c.raw).toLocaleString("en-US"); } } } },
          scales: { y: { ticks: { callback: function (v) { return A.disp === "USD" ? "$" + (Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(1) + "M" : (v / 1e3).toFixed(0) + "K") : Fm(v); }, font: { size: 10 } } }, x: { ticks: { font: { size: 10 } } } } } });
    }
    function renderTable() {
      var g = VIEW === "week" ? R.wk : R.mo, cols = VIEW === "week" ? R.weeks.map(function (w) { return w.from.slice(5) + "~" + w.to.slice(5); }) : R.months;
      document.getElementById("cf_scnLbl").textContent = SCN[A.scenario].lbl + " · 기준일 " + R.start;
      var h = '<table><thead><tr><th>항목</th>' + cols.map(function (c) { return "<th>" + c + "</th>"; }).join("") + '<th>합계</th></tr></thead><tbody>';
      h += '<tr class="sec"><td>기초 현금</td>' + cols.map(function (_, i) { return '<td class="n">' + Fmd(i ? g.close[i - 1] : R.opening) + '</td>'; }).join("") + '<td></td></tr>';
      var row = function (key, label, arr, sign, ind) {
        var tot = arr.reduce(function (s, c) { return s + c.v; }, 0); if (!tot) return "";
        return '<tr><td style="padding-left:' + (ind ? 22 : 8) + 'px">' + label + '</td>' + arr.map(function (c, i) { return '<td class="n c ' + (c.v ? (sign > 0 ? "pos" : "neg") : "") + '" onclick="CF.drill(\'' + key + '\',' + i + ')">' + (c.v ? (sign > 0 ? "" : "−") + Fmd(c.v) : "") + '</td>'; }).join("") + '<td class="n">' + (sign > 0 ? "" : "−") + Fmd(tot) + '</td></tr>';
      };
      h += '<tr class="sec"><td colspan="' + (cols.length + 2) + '">유입 · Inflows</td></tr>';
      R.LINES.filter(function (L) { return L[2] > 0; }).forEach(function (L) { h += row(L[0], L[1], g.rows[L[0]], 1); });
      h += '<tr class="sec"><td colspan="' + (cols.length + 2) + '">유출 · Outflows</td></tr>';
      R.LINES.filter(function (L) { return L[2] < 0; }).forEach(function (L) {
        h += row(L[0], L[1], g.rows[L[0]], -1);
        if (L[0] === "opex") Object.keys(g.opexCats).sort().forEach(function (c) { h += row("opex:" + c, "· " + esc(c), g.opexCats[c], -1, true); });
      });
      h += '<tr class="tot"><td>순현금흐름</td>' + g.net.map(function (v) { return '<td class="n ' + (v < 0 ? "neg" : "pos") + '">' + Fmd(v) + '</td>'; }).join("") + '<td class="n">' + Fmd(g.net.reduce(function (s, v) { return s + v; }, 0)) + '</td></tr>';
      h += '<tr class="close"><td>기말 현금</td>' + g.close.map(function (v) { return '<td class="n ' + (v < A.minCash ? "neg" : "") + '">' + Fmd(v) + '</td>'; }).join("") + '<td></td></tr></tbody></table>';
      document.getElementById("cf_tbl").innerHTML = h;
    }
    function drill(key, i) {
      var g = VIEW === "week" ? R.wk : R.mo, cell = key.indexOf("opex:") === 0 ? g.opexCats[key.slice(5)][i] : g.rows[key][i];
      var per = VIEW === "week" ? R.weeks[i].from + " ~ " + R.weeks[i].to : R.months[i];
      var its = cell.it.slice().sort(function (a, b) { return b.amt - a.amt; });
      document.getElementById("cf_drill").innerHTML = '<b>' + esc(per) + ' · ' + esc(key.replace("opex:", "고정비 · ")) + ' — ' + Fd(cell.v) + ' ' + A.disp + ' (' + its.length + '건)</b>'
        + its.map(function (it) { return '<div class="it"><span style="color:var(--text-3);font-family:var(--mono)">' + it.date + '</span><span>' + esc(it.label) + ' <span class="sub">· ' + esc(it.note) + '</span></span><span>' + Fd(it.amt) + '</span></div>'; }).join("");
    }
    function renderWarn() { var w = R.issues; document.getElementById("cf_warns").innerHTML = w.length ? w.slice(0, 80).map(function (s) { return "<div>" + esc(s) + "</div>"; }).join("") + (w.length > 80 ? "<div>… 외 " + (w.length - 80) + "건</div>" : "") : '<span class="sub">없음</span>'; }
    function renderMethod() {
      document.getElementById("cf_method").innerHTML = "<b>산출 방식</b> · 기준일 = 은행 데이터 최종일(" + (R.lastBank || "—") + ") 다음날 · 매출 회수 = 만기일 또는 고객별 실적 회수일(전체 중앙값 " + Math.round(R.gDSO) + "일) · 매입 지급 = 대상 업체(" + esc(A.apVendors || "전체") + ") 인보이스만 · 만기일 또는 업체별 실적(전체 " + Math.round(R.gDPO) + "일) · 급여 = " + (R.lastPayM || "—") + " 확정대장 · 고정비 = 최근 " + A.opexMonths + "개월 은행 실적(인보이스 대사분·급여·세금·이체 제외) · 부가세 = " + (R.vatMode === "monthly" ? "월" : "분기") + " 신고 · 외화 = 인보이스 환율, 없으면 " + F(A.fx) + " · CIT·대출·자본거래는 미포함";
    }
    function view(v) { VIEW = v; document.querySelectorAll("#cashflowApp .tab").forEach(function (t) { t.classList.toggle("on", t.dataset.v === v); }); renderTable(); }
    function exportXlsx() {
      if (!R || typeof XLSX === "undefined") return;
      var wb = XLSX.utils.book_new();
      [["13주", R.wk, R.weeks.map(function (w) { return w.from; })], ["6개월", R.mo, R.months]].forEach(function (s) {
        var g = s[1], aoa = [["항목"].concat(s[2])];
        aoa.push(["기초 현금 (" + A.disp + ")"].concat(s[2].map(function (_, i) { return Math.round(dv(i ? g.close[i - 1] : R.opening)); })));
        R.LINES.forEach(function (L) { aoa.push([L[1]].concat(g.rows[L[0]].map(function (c) { return Math.round(dv(L[2] * c.v)); }))); });
        aoa.push(["순현금흐름"].concat(g.net.map(function (v) { return Math.round(dv(v)); }))); aoa.push(["기말 현금"].concat(g.close.map(function (v) { return Math.round(dv(v)); })));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), s[0]);
      });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["일자", "구분", "항목", "근거", "금액(" + A.disp + ")"]].concat(R.items.slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; }).map(function (it) { return [it.date, it.kind, it.label, it.note, Math.round(dv(it.sign * it.amt))]; }))), "항목");
      XLSX.writeFile(wb, "INICS_CashFlow_" + R.start + "_" + A.scenario + "_" + A.disp + ".xlsx");
    }

    // ── 수기 예상 매출·매입 (저장: /cashflow_manual) ──
    var _manEdit = null;
    function mv(id) { var e = document.getElementById(id); return e ? e.value : ""; }
    function renderManual() {
      var box = document.getElementById("cf_manual"); if (!box || !D) return;
      var list = (D.manual || []).slice().sort(function (a, b) { return (a.date || "") < (b.date || "") ? -1 : 1; });
      var names = {}; D.invoices.forEach(function (v) { var n = (v.dir === "issued" ? (v.buyer || v.vendor) : v.vendor) || ""; if (n) names[n.trim()] = 1; }); D.projects.forEach(function (p) { if (p.client) names[String(p.client).trim()] = 1; });
      var dl = '<datalist id="cf_parties">' + Object.keys(names).sort().map(function (n) { return '<option value="' + esc(n) + '">'; }).join("") + '</datalist>';
      var e = _manEdit ? (D.manual || []).find(function (x) { return x.id === _manEdit; }) || {} : {};
      var inp = 'style="border:1px solid var(--border);border-radius:6px;padding:6px 8px;font-size:12px"';
      var form = '<div class="row" style="margin:8px 0">'
        + '<select id="cfm_type" ' + inp + '><option value="in"' + (e.type !== "out" ? " selected" : "") + '>예상 매출 (입금)</option><option value="out"' + (e.type === "out" ? " selected" : "") + '>예상 매입 (지급)</option></select>'
        + '<input id="cfm_party" list="cf_parties" placeholder="업체명 · Customer/Vendor" value="' + esc(e.party || "") + '" ' + inp.replace('style="', 'style="flex:1;min-width:180px;') + '>'
        + '<input id="cfm_date" type="date" value="' + esc(e.date || "") + '" title="입금·지급 예정일" ' + inp + '>'
        + '<input id="cfm_amt" inputmode="decimal" placeholder="금액 (VAT 포함)" value="' + (e.amount != null ? esc(F(e.amount)) : "") + '" oninput="var v=this.value.replace(/[^0-9.]/g,\'\');this.value=v?Number(v).toLocaleString(\'en-US\'):\'\'" ' + inp.replace('style="', 'style="width:140px;text-align:right;font-family:var(--mono);') + '>'
        + '<select id="cfm_cur" ' + inp + '>' + ["VND", "USD", "MXN", "KRW"].map(function (c) { return '<option' + ((e.currency || "VND") === c ? " selected" : "") + '>' + c + '</option>'; }).join("") + '</select>'
        + '<input id="cfm_fx" inputmode="decimal" placeholder="→VND 환율" title="외화일 때만 · 비우면 가정 환율" value="' + esc(e.fx || "") + '" ' + inp.replace('style="', 'style="width:95px;text-align:right;') + '>'
        + '<label class="sub" style="display:flex;align-items:center;gap:4px">확률<input id="cfm_prob" value="' + esc(e.prob != null && e.prob !== "" ? e.prob : 100) + '" ' + inp.replace('style="', 'style="width:52px;text-align:right;') + '>%</label>'
        + '<select id="cfm_rep" title="반복" ' + inp + '>' + [1, 2, 3, 4, 6, 12].map(function (n) { return '<option value="' + n + '"' + ((parseInt(e.repeat, 10) || 1) === n ? " selected" : "") + '>' + (n === 1 ? "1회" : "매월 " + n + "회") + '</option>'; }).join("") + '</select>'
        + '<input id="cfm_note" placeholder="메모 (프로젝트·근거)" value="' + esc(e.note || "") + '" ' + inp.replace('style="', 'style="flex:1;min-width:140px;') + '>'
        + '<button class="btn" onclick="CF.manSave()">' + (_manEdit ? "수정 저장" : "추가") + '</button>' + (_manEdit ? '<button class="btn o" onclick="CF.manEdit(null)">취소</button>' : '') + '</div>';
      var rows = list.length ? '<table><thead><tr><th>구분</th><th style="text-align:left">업체</th><th>예정일</th><th>금액</th><th>확률</th><th>반복</th><th style="text-align:left">메모</th><th></th></tr></thead><tbody>'
        + list.map(function (m) {
          var past = dk(m.date) && R && dk(m.date) < R.start;
          return '<tr' + (m.off ? ' style="opacity:.45"' : '') + '><td style="text-align:left;position:static" class="' + (m.type === "out" ? "neg" : "pos") + '">' + (m.type === "out" ? "예상 매입" : "예상 매출") + '</td><td style="text-align:left">' + esc(m.party || "—") + '</td><td class="n' + (past ? " neg" : "") + '">' + esc(m.date || "—") + (past ? " ⚠" : "") + '</td><td class="n">' + F(m.amount) + ' ' + esc(m.currency || "VND") + '</td><td class="n">' + esc(m.prob != null && m.prob !== "" ? m.prob : 100) + '%</td><td>' + ((parseInt(m.repeat, 10) || 1) > 1 ? "매월 " + m.repeat + "회" : "1회") + '</td><td style="text-align:left;max-width:260px;overflow:hidden;text-overflow:ellipsis">' + esc(m.note || "") + '<span class="sub"> · ' + esc(m.by || "") + '</span></td>'
            + '<td><button class="btn o" style="padding:3px 8px" onclick="CF.manToggle(\'' + esc(m.id) + '\')">' + (m.off ? "포함" : "제외") + '</button> <button class="btn o" style="padding:3px 8px" onclick="CF.manEdit(\'' + esc(m.id) + '\')">수정</button> <button class="btn o" style="padding:3px 8px;color:var(--out)" onclick="CF.manDel(\'' + esc(m.id) + '\')">삭제</button></td></tr>';
        }).join("") + '</tbody></table>' : '<div class="sub" style="padding:6px 0">등록된 수기 예상 항목 없음 — 아직 인보이스·프로젝트로 잡히지 않은 입금·지급 예정을 입력하세요.</div>';
      box.innerHTML = dl + form + '<div class="tbl">' + rows + '</div>';
    }
    async function manWrite(fn) {   // 최신본 기준으로 수정 후 저장 (동시 편집 보호)
      var cur = []; try { cur = toArr(await getJ(BASE + "/cashflow_manual.json")); } catch (e) { }
      cur = fn(cur) || cur;
      var r = await fetch(BASE + "/cashflow_manual.json", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cur) });
      if (!r.ok) throw new Error("저장 실패 HTTP " + r.status);
      D.manual = cur; _manEdit = null; run();
    }
    async function manSave() {
      var amt = num(mv("cfm_amt")), date = mv("cfm_date"), party = mv("cfm_party").trim();
      if (!amt) { alert("금액을 입력하세요."); return; } if (!date) { alert("예정일을 입력하세요."); return; } if (!party) { alert("업체명을 입력하세요."); return; }
      var by = (typeof hrActorName === "function" ? hrActorName() : "") || "";
      var rec = { type: mv("cfm_type") === "out" ? "out" : "in", party: party, date: date, amount: amt, currency: mv("cfm_cur") || "VND", fx: num(mv("cfm_fx")) || "", prob: Math.max(0, Math.min(100, num(mv("cfm_prob")) || 0)), repeat: parseInt(mv("cfm_rep"), 10) || 1, note: mv("cfm_note").trim(), by: by };
      var eid = _manEdit;
      try {
        await manWrite(function (cur) {
          if (eid) { var i = cur.findIndex(function (x) { return x.id === eid; }); if (i >= 0) { cur[i] = Object.assign({}, cur[i], rec, { editedAt: new Date().toISOString() }); return cur; } }
          cur.push(Object.assign({ id: "M" + Date.now(), createdAt: new Date().toISOString() }, rec)); return cur;
        });
      } catch (e) { alert(e.message); }
    }
    async function manDel(id) { if (!confirm("이 예상 항목을 삭제할까요?")) return; try { await manWrite(function (cur) { return cur.filter(function (x) { return x.id !== id; }); }); } catch (e) { alert(e.message); } }
    async function manToggle(id) { try { await manWrite(function (cur) { cur.forEach(function (x) { if (x.id === id) x.off = !x.off; }); return cur; }); } catch (e) { alert(e.message); } }
    function manEdit(id) { _manEdit = id; renderManual(); var el = document.getElementById("cfm_party"); if (el && id) el.focus(); }
    function setDisp(c) { A.disp = c; document.querySelectorAll("#cashflowApp .cur").forEach(function (b) { b.classList.toggle("on", b.dataset.c === c); }); if (R) { var alt = {}; Object.keys(SCN).forEach(function (k) { alt[k] = k === A.scenario ? R : compute(D, A, k); }); renderKpi(alt); renderChart(alt); renderTable(); var dr = document.getElementById("cf_drill"); if (dr) dr.innerHTML = '<span class="sub">표의 금액을 클릭하면 구성 항목이 표시됩니다.</span>'; } }
    return { load: load, demo: function(){}, setDisp: setDisp, manSave: manSave, manDel: manDel, manEdit: manEdit, manToggle: manToggle, run: run, view: view, drill: drill, exportXlsx: exportXlsx, compute: compute, _A: A, _setData: function (d) { D = d; } };
  })();
  window.CF = CF;
})();
