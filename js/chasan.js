/* ════════════════════════════════════════════════════════════
   INICS · chasan.js — 부서 채산 (현금주의) P0
   · 매출/OpEx = state.bankTxns (뱅크가 진실의 원천)
   · 인건비    = 확정 급여대장 tc  (hrPayLaborForChasan)
   · 급여·이체 카테고리는 OpEx에서 제외 → 이중계상 0
   · COMMON/기타 부서 = FURNITURE/SOURCING 가중분배(기본 50/50)
   · VND 기준 · USD 토글(월 환율 수기)
   · 마감 가드: 급여 미확정이면 경고 (hrChasanPayGuard)
   · index.html / hr-*.js 다음에 로드.  renderChasan(ym, hostEl) 호출.
   ════════════════════════════════════════════════════════════ */
(function() {
  var RTDB = "https://inics-approval-default-rtdb.asia-southeast1.firebasedatabase.app";
  function csUrl(p) { return RTDB + "/chasan" + (p || "") + ".json"; }
  function F(n) { return typeof hrFmt === "function" ? hrFmt(n) : Math.round(n || 0).toLocaleString("en-US"); }
  function E(s) { return typeof hrEsc === "function" ? hrEsc(s) : String(s == null ? "" : s); }

  /* ── 설정 (Cursor에서 조정) ───────────────────────────────── */
  window.CHASAN_CFG = {
    targets: ["FURNITURE", "SOURCING"],
    commonWeights: { FURNITURE: 0.5, SOURCING: 0.5 },   // COMMON/기타 부서 분배
    deptMap: {},                                        // 예: {ADMIN:"SOURCING"} 직결
    cats: {
      revenue: ["Sales Revenue"],
      refund:  ["Refund"],                              // 매출 차감
      cogs:    ["Purchase / COGS"],
      opex:    ["Internet & Telecom", "Utilities", "Office Rent", "Bank Charges",
                "Tax / VAT", "Office Supplies", "Travel & Transport", "Meals & Entertainment"],
      excluded: ["Salary & Wages", "Social Insurance", "BHXH", "BHYT", "BHTN",
                 "Owner / Capital Transfer", "Inter-account Transfer"]   // 인건비=HR, 이체=비영업
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

  function mapDept(d) {
    d = d || "COMMON";
    if (CHASAN_CFG.deptMap[d]) return CHASAN_CFG.deptMap[d];
    return d;
  }

  /* ── 뱅크 집계 (현금주의): 부서별 매출/COGS/OpEx ───────────── */
  window.chasanBankAgg = function(ym) {
    var targets = CHASAN_CFG.targets;
    var buckets = {}; targets.forEach(function(t) { buckets[t] = { revenue: 0, cogs: 0, opex: 0 }; });
    var common = { revenue: 0, cogs: 0, opex: 0 };
    var uncat = { count: 0, debit: 0, credit: 0 }, untaggedDept = 0, excludedSum = 0;
    var txns = (typeof state !== "undefined" && state && state.bankTxns) || [];

    txns.forEach(function(t) {
      if (!t || (t.date || "").slice(0, 7) !== ym) return;
      var credit = +t.credit || 0, debit = +t.debit || 0;
      var kind = classify(t.category || "Uncategorized");
      if (kind === "excluded") { excludedSum += debit; return; }
      var d = mapDept(t.dept); if (!t.dept) untaggedDept++;
      var into = (targets.indexOf(d) >= 0) ? buckets[d] : common;
      if (kind === "revenue") into.revenue += credit - debit;
      else if (kind === "refund") into.revenue -= (debit - credit);
      else if (kind === "cogs") into.cogs += debit - credit;
      else if (kind === "opex") into.opex += debit - credit;
      else { uncat.count++; uncat.debit += debit; uncat.credit += credit; }
    });

    // COMMON/기타 → 타깃 가중분배
    ["revenue", "cogs", "opex"].forEach(function(k) {
      targets.forEach(function(t) { buckets[t][k] += common[k] * (CHASAN_CFG.commonWeights[t] || 0); });
    });
    return { ym: ym, byDept: buckets, common: common, uncat: uncat, untaggedDept: untaggedDept, excludedOpexSkipped: excludedSum };
  };

  /* ── 채산 계산: 뱅크 + 확정대장 인건비 ────────────────────── */
  window.chasanCompute = async function(ym, opts) {
    opts = opts || {};
    var targets = CHASAN_CFG.targets;
    var bank = chasanBankAgg(ym);
    var labor = { byDept: {}, source: "none", finalized: false };
    if (typeof hrPayLaborForChasan === "function") {
      labor = await hrPayLaborForChasan(ym, {
        targets: targets, weights: CHASAN_CFG.commonWeights, map: CHASAN_CFG.deptMap,
        fallbackLive: opts.fallbackLive !== false
      });
    }
    var byDept = {}, tot = { revenue: 0, cogs: 0, labor: 0, opex: 0, op: 0 };
    targets.forEach(function(t) {
      var b = bank.byDept[t], lab = (labor.byDept && labor.byDept[t]) || 0;
      var revenue = Math.round(b.revenue), cogs = Math.round(b.cogs), lb = Math.round(lab), opex = Math.round(b.opex);
      var op = revenue - cogs - lb - opex;
      byDept[t] = { revenue: revenue, cogs: cogs, labor: lb, opex: opex, op: op, margin: revenue ? op / revenue : 0 };
      tot.revenue += revenue; tot.cogs += cogs; tot.labor += lb; tot.opex += opex; tot.op += op;
    });
    tot.margin = tot.revenue ? tot.op / tot.revenue : 0;
    return { ym: ym, byDept: byDept, totals: tot,
      laborSource: labor.source, laborFinalized: labor.finalized,
      dq: { uncat: bank.uncat, untaggedDept: bank.untaggedDept }, fx: opts.vndPerUsd || null };
  };

  window.chasanSaveSnapshot = async function(ym, data) {
    var r = await fetch(csUrl("/" + encodeURIComponent(ym)), {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.assign({}, data, { ym: ym, savedAt: new Date().toISOString(),
        savedBy: (typeof hrActorName === "function" ? hrActorName() : "system") }))
    });
    if (!r.ok) throw new Error("채산 저장 HTTP " + r.status);
  };

  /* ── 렌더: 가드 + FX + 부서 손익표 ────────────────────────── */
  var _usd = false, _rate = 0;
  window.renderChasan = async function(ym, host, opts) {
    opts = opts || {};
    host = typeof host === "string" ? document.getElementById(host) : host;
    if (!host) return;
    ym = ym || (typeof hrYmOf === "function" ? hrYmOf(window.hrAsof || "2026-06-30") : "2026-06");
    host.innerHTML = '<div id="csGuard" style="margin-bottom:12px"></div><div id="csBody" style="font-size:13px;color:var(--text-3)">계산 중… / Đang tính…</div>';

    // 마감 가드
    if (typeof hrChasanPayGuard === "function") {
      var g = await hrChasanPayGuard(ym, host.querySelector("#csGuard"), { mode: opts.guardMode || "warn", onProceed: function() { renderChasan(ym, host, opts); } });
      if (g.blocked) { host.querySelector("#csBody").innerHTML = '<div style="padding:20px;color:var(--text-3)">급여 확정 후 채산이 표시됩니다. / Chốt lương để xem lãi lỗ.</div>'; return; }
    }

    var r = await chasanCompute(ym, { vndPerUsd: _rate || null, fallbackLive: opts.fallbackLive !== false });
    var money = function(v) { return _usd && _rate ? (v / _rate).toLocaleString("en-US", { maximumFractionDigits: 0 }) : F(v); };
    var unit = _usd && _rate ? "USD" : "VND";
    var pct = function(x) { return (x * 100).toFixed(1) + "%"; };
    var T = CHASAN_CFG.targets;

    var line = function(label, key, opt) {
      opt = opt || {};
      return '<tr' + (opt.strong ? ' style="font-weight:700;background:var(--surface-2)"' : "") + (opt.top ? ' style="border-top:2px solid var(--text);font-weight:700"' : "") + '>'
        + '<td style="padding:8px 12px;text-align:left">' + label + '</td>'
        + T.map(function(t) { var v = r.byDept[t][key]; return '<td style="padding:8px 12px;text-align:right;font-family:var(--mono);' + (v < 0 ? "color:var(--danger)" : "") + '">' + money(v) + '</td>'; }).join("")
        + '<td style="padding:8px 12px;text-align:right;font-family:var(--mono);font-weight:700;' + (r.totals[key] < 0 ? "color:var(--danger)" : "") + '">' + money(r.totals[key]) + '</td></tr>';
    };
    var mline = function() {
      return '<tr><td style="padding:6px 12px;text-align:left;color:var(--text-3)">영업이익률 / Margin</td>'
        + T.map(function(t) { return '<td style="padding:6px 12px;text-align:right;color:var(--text-3)">' + pct(r.byDept[t].margin) + '</td>'; }).join("")
        + '<td style="padding:6px 12px;text-align:right;color:var(--text-3);font-weight:600">' + pct(r.totals.margin) + '</td></tr>';
    };

    var dq = r.dq, dqWarn = (dq.uncat.count || dq.untaggedDept)
      ? '<span style="font-size:11px;color:var(--warning)"> · ⚠ 미분류 ' + dq.uncat.count + '건 · 부서미태깅 ' + dq.untaggedDept + '건 (뱅크 탭에서 태깅)</span>' : "";

    host.querySelector("#csBody").innerHTML =
      '<div class="form-card" style="padding:0;overflow:hidden">'
      + '<div style="padding:12px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">'
      + '<div><div style="font-size:14px;font-weight:700">부서 채산 · Departmental P&L — ' + E(ym) + '</div>'
      + '<div style="font-size:11px;color:var(--text-3)">현금주의 · 인건비=' + (r.laborFinalized ? "확정대장" : "라이브(" + r.laborSource + ")") + dqWarn + '</div></div>'
      + '<div style="display:flex;align-items:center;gap:8px">'
      + '<label style="font-size:11px;color:var(--text-3);display:flex;align-items:center;gap:5px"><input type="checkbox" id="csUsd"' + (_usd ? " checked" : "") + '> USD</label>'
      + '<input id="csRate" type="number" placeholder="VND/USD" value="' + (_rate || "") + '" style="width:110px;border:1px solid var(--border);border-radius:6px;padding:5px 7px;font-size:12px" title="월 환율 수기">'
      + '<button id="csSave" style="border:1px solid var(--text);background:none;color:var(--text);font-size:11px;cursor:pointer;padding:6px 11px;border-radius:7px">채산 저장</button>'
      + '</div></div>'
      + '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px">'
      + '<thead><tr style="background:var(--surface-2)"><th style="padding:8px 12px;text-align:left;font-size:10px;color:var(--text-3)">항목 / Item</th>'
      + T.map(function(t) { return '<th style="padding:8px 12px;text-align:right;font-size:10px;color:var(--text-3)">' + E(t) + '</th>'; }).join("")
      + '<th style="padding:8px 12px;text-align:right;font-size:10px;color:var(--text-3)">합계 (' + unit + ')</th></tr></thead><tbody>'
      + line("매출 / Revenue", "revenue")
      + line("(−) 매입원가 / COGS", "cogs")
      + line("(−) 인건비 / Labor (확정대장)", "labor")
      + line("(−) 판관비 / OpEx", "opex")
      + line("영업이익 / Operating Profit", "op", { top: true })
      + mline()
      + '</tbody></table></div>'
      + '<p style="font-size:11px;color:var(--text-3);padding:10px 16px;line-height:1.6">인건비는 확정 급여대장 tc(회사부담 보험 포함)에서, 급여·사회보험·이체 카테고리는 OpEx에서 제외되어 이중계상이 없습니다. COMMON/기타 부서는 ' + (CHASAN_CFG.commonWeights[T[0]] * 100) + "/" + (CHASAN_CFG.commonWeights[T[1]] * 100) + ' 배분.</p></div>';

    var usdEl = host.querySelector("#csUsd"), rateEl = host.querySelector("#csRate");
    usdEl.onchange = function() { _usd = usdEl.checked; if (_usd && !(+rateEl.value)) { alert("월 환율(VND/USD)을 입력하세요."); _usd = false; usdEl.checked = false; return; } renderChasan(ym, host, opts); };
    rateEl.onchange = function() { _rate = +rateEl.value || 0; if (_usd) renderChasan(ym, host, opts); };
    host.querySelector("#csSave").onclick = async function() {
      try { await chasanSaveSnapshot(ym, { byDept: r.byDept, totals: r.totals, fx: { usd: _usd, vndPerUsd: _rate }, laborFinalized: r.laborFinalized });
        if (typeof showToast === "function") showToast(ym + " 채산 저장 ✓"); }
      catch (e) { if (typeof showToast === "function") showToast("저장 실패: " + e.message); console.error(e); }
    };
  };
})();
