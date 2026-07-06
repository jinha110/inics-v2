/* ════════════════════════════════════════════════════════════
   INICS · hr-payroll-history.js
   급여 워크플로우:  자동계산(renderHrPay) → [확정] → 급여대장(전체 편집) → 저장/증빙
   · 급여대장 = /hr/payroll/{ym}.rows  (모든 항목 셀 편집·행 추가/삭제 가능)
   · 파일: hrStorageUpload (기존 버킷)  ·  RTDB REST
   · hr-calc.js / hr-pay-att.js / hr.js 다음에 로드
   ════════════════════════════════════════════════════════════ */
(function() {
  var BASE = "https://inics-approval-default-rtdb.asia-southeast1.firebasedatabase.app";
  function payUrl(p) { return BASE + "/hr/payroll" + (p || "") + ".json"; }
  function lastDay(ym) { var p = ym.split("-").map(Number); return ym + "-" + String(new Date(p[0], p[1], 0).getDate()).padStart(2, "0"); }
  function F(n) { return typeof hrFmt === "function" ? hrFmt(n) : Math.round(n || 0).toLocaleString("en-US"); }
  function E(s) { return typeof hrEsc === "function" ? hrEsc(s) : String(s == null ? "" : s); }
  function curYm() { return typeof hrYmOf === "function" ? hrYmOf(window.hrAsof || "2026-06-30") : (window.hrAsof || "2026-06").slice(0, 7); }

  var _rows = [];        // 편집 중인 급여대장 행 (working copy)
  var _dirty = false;    // 저장 안 된 편집 있음

  /* ---- 급여대장 행 스키마 (전부 편집 가능) ---- */
  var LCOLS = [
    { k: "nameVi", t: "text", vn: "Họ tên", kr: "이름", w: 150, l: 1 },
    { k: "nameKo", t: "text", vn: "Chức vụ", kr: "직급", w: 96, l: 1 },
    { k: "dept",   t: "text", vn: "Phòng", kr: "부서", w: 92, l: 1 },
    { k: "salaryType", t: "sel", vn: "Loại", kr: "유형", w: 76, opts: ["NET", "Gross"] },
    { k: "applied", t: "num", vn: "Lương áp dụng", kr: "적용급여", w: 108 },
    { k: "otPay",   t: "num", vn: "Tăng ca", kr: "OT", w: 84 },
    { k: "ib",      t: "num", vn: "Cơ sở BH", kr: "보험기준", w: 100 },
    { k: "ei",      t: "num", vn: "BH NLĐ", kr: "직원보험", w: 96 },
    { k: "tax",     t: "num", vn: "TN tính thuế", kr: "과세소득", w: 100 },
    { k: "pit",     t: "num", vn: "Thuế TNCN", kr: "PIT", w: 96 },
    { k: "net",     t: "num", vn: "Thực nhận", kr: "실수령", w: 110, strong: 1 },
    { k: "ci",      t: "num", vn: "BH công ty", kr: "회사보험", w: 100 },
    { k: "tc",      t: "num", vn: "Tổng chi phí", kr: "총비용", w: 110, strong: 1 },
    { k: "note",    t: "text", vn: "Ghi chú", kr: "비고", w: 130, l: 1 }
  ];
  var SUMKEYS = ["applied", "otPay", "ei", "pit", "net", "ci", "tc"];

  /* ---- 계산: 해당 월 자동 급여대장 (확정 시 대장으로 복사) ---- */
  window.hrPayCompute = function(ym) {
    var asof = lastDay(ym);
    var rows = hrEmployeesList().filter(function(e) { return e.hrManaged; }).map(function(e) {
      var c = hrCalcRow(e, asof);
      return {
        id: e.id, nameVi: e.nameVi, nameKo: e.positionKo || "", dept: e.dept,
        salaryType: e.salaryType, applied: Math.round(c.applied), otPay: Math.round(c.otPay),
        ib: Math.round(c.ib), ei: Math.round(c.ei), tax: Math.round(c.tax), pit: Math.round(c.pit),
        net: Math.round(c.net), ci: Math.round(c.ci), tc: Math.round(c.tc),
        note: (c.pa ? "수습 " + Math.round(e.probPct * 100) + "%" : "") + (c.at.preHire ? " · 입사월 일할" : ""),
        manual: false
      };
    });
    return { ym: ym, asof: asof, rows: rows, totals: hrLedgerTotals(rows) };
  };

  window.hrLedgerTotals = function(rows) {
    var t = {}; SUMKEYS.forEach(function(k) { t[k] = 0; });
    rows.forEach(function(r) { SUMKEYS.forEach(function(k) { t[k] += (+r[k] || 0); }); });
    return t;
  };

  /* ---- RTDB: 확정 / 로드 / 목록 / 대장저장 ---- */
  window.hrLedgerFinalize = async function(ym) {            // 자동계산 → 급여대장 복사(확정)
    var snap = hrPayCompute(ym);
    var r = await fetch(payUrl("/" + encodeURIComponent(ym)), {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ym: ym, rows: snap.rows, totals: snap.totals,
        finalizedAt: new Date().toISOString(), finalizedBy: (typeof hrActorName === "function" ? hrActorName() : "system") })
    });
    if (!r.ok) throw new Error("확정 저장 HTTP " + r.status);
    return snap;
  };
  window.hrPaySnapshotSave = window.hrLedgerFinalize;        // 호환 별칭

  window.hrLedgerSaveRows = async function(ym, rows) {       // 편집한 대장 저장
    var totals = hrLedgerTotals(rows);
    var r = await fetch(payUrl("/" + encodeURIComponent(ym)), {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows: rows, totals: totals,
        editedAt: new Date().toISOString(), editedBy: (typeof hrActorName === "function" ? hrActorName() : "system") })
    });
    if (!r.ok) throw new Error("대장 저장 HTTP " + r.status);
    return totals;
  };

  window.hrPayLoad = async function(ym) {
    var r = await fetch(payUrl("/" + encodeURIComponent(ym)));
    if (!r.ok) return null; return await r.json();
  };
  window.hrPayList = async function() {
    var r = await fetch(payUrl("") + "?shallow=true");
    if (!r.ok) return []; var o = await r.json();
    return o ? Object.keys(o).sort().reverse() : [];
  };

  /* ---- 지급 증빙 (직원별) — /hr/payroll/{ym}/proofByEmp/{empId} ---- */
  function _peBase(ym, empId) { return "/" + encodeURIComponent(ym) + "/proofByEmp/" + encodeURIComponent(empId); }

  window.hrPayUploadProofEmp = async function(ym, empId, file) {
    if (typeof hrStorageUpload !== "function") throw new Error("hrStorageUpload 미로드 (hr.js 확인)");
    var safe = (file.name || "proof").replace(/[^\w.\-가-힣]/g, "_");
    var path = "hr/payroll-proof/" + ym + "/" + empId + "/" + Date.now() + "_" + safe;
    var meta = await hrStorageUpload(path, file, file.type || "application/octet-stream");
    var rec = { name: file.name, path: meta.path, url: meta.downloadUrl, token: meta.downloadToken,
      size: meta.size || file.size, uploadedAt: new Date().toISOString(),
      uploadedBy: (typeof hrActorName === "function" ? hrActorName() : "system") };
    var cur = await fetch(payUrl(_peBase(ym, empId) + "/files"));
    var arr = cur.ok ? (await cur.json()) : null; arr = Array.isArray(arr) ? arr : [];
    arr.push(rec);
    await fetch(payUrl(_peBase(ym, empId)), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ files: arr }) });
    return arr;
  };
  window.hrPayRemoveProofEmp = async function(ym, empId, idx) {
    var cur = await fetch(payUrl(_peBase(ym, empId) + "/files"));
    var arr = cur.ok ? (await cur.json()) : null; arr = Array.isArray(arr) ? arr : [];
    var rm = arr.splice(idx, 1)[0];
    if (rm && rm.path && typeof hrStorageDelete === "function") { try { await hrStorageDelete(rm.path); } catch (_) {} }
    await fetch(payUrl(_peBase(ym, empId)), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ files: arr }) });
    return arr;
  };
  window.hrPaySavePaidEmp = async function(ym, empId, paid, paidDate) {
    var r = await fetch(payUrl(_peBase(ym, empId)), { method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paid: !!paid, paidDate: paidDate || "" }) });
    if (!r.ok) throw new Error("지급상태 저장 HTTP " + r.status);
  };
  // 월 롤업(paid=전원 지급 여부) — 히스토리 ✓지급 배지용
  window.hrPayRollupPaid = async function(ym, rows, proofByEmp) {
    var ids = (rows || []).map(function(r) { return r.id; });
    var allPaid = ids.length > 0 && ids.every(function(id) { return proofByEmp[id] && proofByEmp[id].paid; });
    var last = "";
    ids.forEach(function(id) { var d = proofByEmp[id] && proofByEmp[id].paidDate; if (d && d > last) last = d; });
    await fetch(payUrl("/" + encodeURIComponent(ym)), { method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paid: allPaid, paidDate: last }) });
    return allPaid;
  };

  /* ═══ 채산 인건비 원천 — 확정 대장 tc를 부서별 집계 ═══
     확정 대장(/hr/payroll/{ym}.rows)의 tc(회사총비용)를 row.dept 기준 합산.
     · finalized면 대장(수동조정 포함) = 진실의 원천
     · 미확정이면 fallbackLive(기본 true)로 라이브 계산값 사용 → source='live'로 표시 */
  window.hrPayLaborByDept = async function(ym, opts) {
    opts = opts || {};
    var fallbackLive = opts.fallbackLive !== false;
    var saved = await hrPayLoad(ym);
    var finalized = !!(saved && saved.finalizedAt);
    var rows, source;
    if (finalized && Array.isArray(saved.rows)) { rows = saved.rows; source = "ledger"; }
    else if (fallbackLive) { rows = hrPayCompute(ym).rows; source = "live"; }
    else { return { ym: ym, finalized: false, source: "none", total: 0, byDept: {} }; }
    var byDept = {};
    rows.forEach(function(r) { var d = r.dept || "UNASSIGNED"; byDept[d] = (byDept[d] || 0) + (+r.tc || 0); });
    var total = Object.keys(byDept).reduce(function(a, k) { return a + byDept[k]; }, 0);
    return { ym: ym, finalized: finalized, source: source, total: total, byDept: byDept,
      finalizedAt: (saved && saved.finalizedAt) || null, editedAt: (saved && saved.editedAt) || null,
      paid: !!(saved && saved.paid) };
  };

  /* 채산 2부서 매핑 — COMMON/기타(FINANCE 등)는 가중분배(기본 50/50) */
  window.hrPayLaborForChasan = async function(ym, opts) {
    opts = opts || {};
    var targets = opts.targets || ["FURNITURE", "SOURCING"];
    var weights = opts.weights || { FURNITURE: 0.5, SOURCING: 0.5 };
    var directMap = opts.map || {};   // 예: {ADMIN:"SOURCING"} — 특정 부서를 타깃에 직결
    var lab = await hrPayLaborByDept(ym, opts);
    var out = {}, commonPool = 0;
    targets.forEach(function(t) { out[t] = 0; });
    Object.keys(lab.byDept).forEach(function(d) {
      var amt = lab.byDept[d], mapped = directMap[d] || d;
      if (targets.indexOf(mapped) >= 0) out[mapped] += amt;
      else commonPool += amt;   // COMMON·FINANCE·기타 → 가중분배 풀
    });
    targets.forEach(function(t) { out[t] += commonPool * (weights[t] || 0); });
    return { ym: ym, finalized: lab.finalized, source: lab.source, total: lab.total,
      byDept: out, commonPool: commonPool, paid: lab.paid };
  };

  /* ═══ 채산 마감 가드 — "급여 확정 → 채산" 순서 강제 ═══
     채산 월 렌더 상단에서 호출. 미확정이면 경고 배너 + 확정 화면 링크.
     mode:'warn'(기본, 라이브로 진행 허용) | 'block'(미확정이면 채산 차단) */
  window.hrPayFinalizeStatus = async function(ym) {
    var s = await hrPayLoad(ym);
    return { ym: ym, finalized: !!(s && s.finalizedAt), finalizedAt: (s && s.finalizedAt) || null,
      editedAt: (s && s.editedAt) || null, paid: !!(s && s.paid), paidDate: (s && s.paidDate) || null,
      hasRows: !!(s && Array.isArray(s.rows) && s.rows.length) };
  };

  window.hrChasanPayGuard = async function(ym, host, opts) {
    opts = opts || {};
    var mode = opts.mode || "warn";
    var st = await hrPayFinalizeStatus(ym);
    var blocked = (mode === "block" && !st.finalized);

    if (host) {
      if (!st.finalized) {
        host.innerHTML =
          '<div style="border:1px solid var(--warning);background:#fffbeb;border-radius:10px;padding:12px 14px;display:flex;align-items:center;gap:12px;flex-wrap:wrap">'
          + '<div style="font-size:20px">⚠️</div>'
          + '<div style="flex:1;min-width:220px"><div style="font-size:13px;font-weight:700;color:var(--warning)">' + E(ym) + ' 급여 미확정 / Lương tháng chưa chốt</div>'
          + '<div style="font-size:11px;color:var(--text-2);margin-top:2px">'
          + (mode === "block"
              ? '급여를 먼저 확정해야 채산을 마감할 수 있습니다. / Phải chốt lương trước khi khóa lãi lỗ.'
              : '채산 인건비가 <b>라이브 추정치</b>입니다(확정 시 변동 가능). / Chi phí nhân sự đang là ước tính (live).')
          + '</div></div>'
          + '<div style="display:flex;gap:6px">'
          + '<button id="hrGuardGo" style="border:1px solid var(--warning);background:var(--warning);color:#fff;font-size:12px;font-weight:600;cursor:pointer;padding:7px 12px;border-radius:8px">급여 확정하러 / Chốt lương</button>'
          + (mode === "block" ? "" : '<button id="hrGuardGo2" style="border:1px solid var(--border);background:none;font-size:12px;cursor:pointer;padding:7px 12px;border-radius:8px">라이브로 진행 / Tiếp tục</button>')
          + '</div></div>';
      } else {
        var editedAfter = st.editedAt && st.finalizedAt && st.editedAt > st.finalizedAt;
        host.innerHTML =
          '<div style="border:1px solid var(--border);background:var(--surface-2);border-radius:10px;padding:9px 14px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">'
          + '<span style="color:var(--success);font-weight:700;font-size:12px">✓ ' + E(ym) + ' 급여 확정됨 / Đã chốt</span>'
          + '<span style="font-size:11px;color:var(--text-3)">' + E((st.finalizedAt || "").slice(0, 10))
          + (editedAfter ? ' · <span style="color:var(--warning)">확정 후 수정됨 ' + E((st.editedAt || "").slice(0, 10)) + '</span>' : "")
          + (st.paid ? ' · <span style="color:var(--success)">지급완료</span>' : ' · <span style="color:var(--text-3)">미지급</span>') + '</span>'
          + '<span style="flex:1"></span><span style="font-size:11px;color:var(--text-3)">채산 인건비 = 확정 대장 tc</span></div>';
      }
      function goFinalize() {
        window.hrAsof = lastDay(ym);
        if (typeof showHrApp === "function") { var p = showHrApp(); if (p && p.then) p.then(function() { if (typeof hrSwitchTab === "function") hrSwitchTab("pay"); }); else if (typeof hrSwitchTab === "function") hrSwitchTab("pay"); }
      }
      var g1 = host.querySelector("#hrGuardGo"); if (g1) g1.onclick = goFinalize;
      var g2 = host.querySelector("#hrGuardGo2"); if (g2) g2.onclick = function() { if (typeof opts.onProceed === "function") opts.onProceed(st); };
    }
    return Object.assign(st, { blocked: blocked });
  };

  /* ═══ 급여대장 편집 표 ═══ */
  function inCell(r, i, col) {
    var v = r[col.k];
    if (col.t === "sel") {
      return '<select class="hrl-in" data-i="' + i + '" data-k="' + col.k + '" style="width:100%;border:1px solid var(--border);border-radius:6px;padding:4px;font-size:11px">'
        + col.opts.map(function(o) { return '<option' + (o === v ? " selected" : "") + '>' + o + '</option>'; }).join("") + '</select>';
    }
    var isNum = col.t === "num";
    return '<input class="hrl-in" data-i="' + i + '" data-k="' + col.k + '" data-num="' + (isNum ? 1 : 0) + '" '
      + 'type="' + (isNum ? "number" : "text") + '" value="' + E(isNum ? (v == null ? 0 : v) : (v || "")) + '" '
      + 'style="width:100%;border:1px solid transparent;border-radius:6px;padding:4px 5px;font-size:11px;background:transparent;'
      + (isNum ? "text-align:right;font-family:var(--mono);" : "") + (col.strong ? "font-weight:600;" : "") + '">';
  }

  function buildLedgerHTML() {
    var t = hrLedgerTotals(_rows);
    var head = '<tr style="background:var(--surface-2);border-bottom:1px solid var(--border)">'
      + '<th style="padding:8px 6px;font-size:9px;color:var(--text-3);width:30px">#</th>'
      + LCOLS.map(function(c) { return '<th style="padding:8px 6px;font-size:9px;color:var(--text-3);min-width:' + c.w + 'px;text-align:' + (c.l ? "left" : "right") + '"><div>' + E(c.vn) + '</div><div style="font-weight:400;color:var(--text-3)">' + E(c.kr) + '</div></th>'; }).join("")
      + '<th style="padding:8px 6px;font-size:9px;color:var(--text-3);width:56px">동작</th></tr>';
    var body = _rows.map(function(r, i) {
      return '<tr style="border-bottom:1px solid var(--border)">'
        + '<td style="padding:3px 6px;text-align:center;color:var(--text-3);font-size:11px">' + (i + 1) + '</td>'
        + LCOLS.map(function(c) { return '<td style="padding:2px 4px">' + inCell(r, i, c) + '</td>'; }).join("")
        + '<td style="padding:2px 4px;text-align:center;white-space:nowrap">'
        + '<button class="hrl-recalc" data-i="' + i + '" title="자동계산값으로 이 행 초기화" style="border:1px solid var(--border);background:none;border-radius:6px;cursor:pointer;font-size:11px;padding:3px 5px">↻</button> '
        + '<button class="hrl-del" data-i="' + i + '" title="행 삭제" style="border:1px solid var(--border);background:none;color:var(--danger);border-radius:6px;cursor:pointer;font-size:11px;padding:3px 5px">✕</button></td></tr>';
    }).join("");
    var foot = '<tr style="background:var(--surface-2);font-weight:600;border-top:2px solid var(--text)">'
      + '<td></td><td style="padding:8px 6px">합계 (' + _rows.length + ')</td>'
      + LCOLS.slice(1).map(function(c) {
        if (SUMKEYS.indexOf(c.k) < 0) return "<td></td>";
        return '<td id="hrlT-' + c.k + '" style="padding:8px 6px;text-align:right;font-family:var(--mono)">' + F(t[c.k]) + '</td>';
      }).join("") + '<td></td></tr>';
    return '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:11px"><thead>' + head + '</thead><tbody>' + body + foot + '</tbody></table></div>';
  }

  function updateTotals() {
    var t = hrLedgerTotals(_rows);
    SUMKEYS.forEach(function(k) { var el = document.getElementById("hrlT-" + k); if (el) el.textContent = F(t[k]); });
  }

  function wireLedger(box, ym) {
    box.querySelectorAll(".hrl-in").forEach(function(inp) {
      inp.oninput = function() {
        var i = +inp.getAttribute("data-i"), k = inp.getAttribute("data-k");
        _rows[i][k] = inp.getAttribute("data-num") === "1" ? (+inp.value || 0) : inp.value;
        _rows[i].manual = true; _dirty = true;
        if (SUMKEYS.indexOf(k) >= 0) updateTotals();
        var sb = document.getElementById("hrlSave"); if (sb) sb.textContent = "💾 대장 저장 (변경됨*)";
      };
    });
    box.querySelectorAll(".hrl-recalc").forEach(function(b) {
      b.onclick = function() {
        var i = +b.getAttribute("data-i"); var id = _rows[i].id;
        var e = hrEmployeesList().filter(function(x) { return x.id === id; })[0];
        if (!e) { if (typeof showToast === "function") showToast("직원 마스터에 없어 재계산 불가 (수동 행)"); return; }
        var c = hrCalcRow(e, lastDay(ym));
        _rows[i] = Object.assign(_rows[i], { salaryType: e.salaryType, applied: Math.round(c.applied), otPay: Math.round(c.otPay),
          ib: Math.round(c.ib), ei: Math.round(c.ei), tax: Math.round(c.tax), pit: Math.round(c.pit),
          net: Math.round(c.net), ci: Math.round(c.ci), tc: Math.round(c.tc), manual: false });
        _dirty = true; refreshLedger(box, ym);
      };
    });
    box.querySelectorAll(".hrl-del").forEach(function(b) {
      b.onclick = function() { _rows.splice(+b.getAttribute("data-i"), 1); _dirty = true; refreshLedger(box, ym); };
    });
  }

  function refreshLedger(box, ym) { box.innerHTML = buildLedgerHTML(); wireLedger(box, ym); }

  /* ═══ 패널 (급여대장 탭 하단) ═══ */
  window.hrRenderPayPanel = async function() {
    var host = document.getElementById("hrView-pay");
    if (!host) return;
    var old = document.getElementById("hrPayPanel"); if (old) old.remove();

    var ym = curYm();
    var saved = await hrPayLoad(ym);
    var months = await hrPayList();
    var finalized = !!(saved && saved.finalizedAt);
    _rows = (saved && Array.isArray(saved.rows)) ? JSON.parse(JSON.stringify(saved.rows)) : [];
    _dirty = false;
    var proofByEmp = (saved && saved.proofByEmp) || {};

    // 자동계산 합계 vs 확정대장 합계 차이 힌트
    var live = hrPayCompute(ym).totals;
    var diffNet = finalized ? (hrLedgerTotals(_rows).net - live.net) : 0;

    var histRows = months.length ? months.map(function(m) {
      var cur = m === ym;
      return '<div class="hrph-hist" data-ym="' + m + '" style="display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid var(--border);border-radius:8px;cursor:pointer;' + (cur ? "background:var(--surface-2);border-color:var(--text)" : "") + '">'
        + '<b style="font-size:12px">' + E(m) + '</b><span class="hrph-mark" data-ym="' + m + '" style="font-size:10px;color:var(--text-3)"></span>'
        + '<span style="flex:1"></span>' + (cur ? '<span style="font-size:10px;color:var(--text-3)">보는 중</span>' : "") + '</div>';
    }).join("") : '<div style="font-size:11px;color:var(--text-3)">확정된 월이 없습니다 / Chưa có tháng chốt</div>';

    // 직원별 지급·증빙 행
    var paidCnt = _rows.filter(function(r) { return proofByEmp[r.id] && proofByEmp[r.id].paid; }).length;
    var netSum = _rows.reduce(function(a, r) { return a + (+r.net || 0); }, 0);
    var proofRows = _rows.map(function(r) {
      var pe = proofByEmp[r.id] || { files: [], paid: false, paidDate: "" };
      var chips = (pe.files || []).map(function(f, i) {
        var nm = f.name || "file"; nm = nm.length > 18 ? nm.slice(0, 16) + "…" : nm;
        return '<span style="display:inline-flex;align-items:center;gap:3px;border:1px solid var(--border);border-radius:6px;padding:2px 6px;font-size:11px;margin:0 4px 4px 0">'
          + '<a href="' + E(f.url) + '" target="_blank" rel="noopener" style="color:var(--text);text-decoration:none">📄 ' + E(nm) + '</a>'
          + '<span class="hrpe-rm" data-emp="' + E(r.id) + '" data-i="' + i + '" style="color:var(--danger);cursor:pointer">✕</span></span>';
      }).join("");
      return '<tr style="border-bottom:1px solid var(--border)"'+(pe.paid?' ':'')+'>'
        + '<td style="padding:8px 10px"><b style="font-size:12px">' + E(r.nameVi) + '</b> <span style="font-size:10px;color:var(--text-3)">' + E(r.dept || "") + '</span></td>'
        + '<td style="padding:8px 10px;text-align:right;font-family:var(--mono);font-weight:600">' + F(r.net) + '</td>'
        + '<td style="padding:8px 10px">' + chips
          + '<label style="display:inline-block;border:1px dashed var(--border);border-radius:6px;padding:3px 9px;font-size:11px;color:var(--text-3);cursor:pointer">📎 첨부 / Đính kèm<input type="file" class="hrpe-file" data-emp="' + E(r.id) + '" accept="image/*,application/pdf" multiple style="display:none"></label></td>'
        + '<td style="padding:8px 10px;text-align:center"><input type="checkbox" class="hrpe-paid" data-emp="' + E(r.id) + '"' + (pe.paid ? " checked" : "") + ' style="width:16px;height:16px"></td>'
        + '<td style="padding:8px 10px"><input type="date" class="hrpe-date" data-emp="' + E(r.id) + '" value="' + E(pe.paidDate || "") + '" style="border:1px solid var(--border);border-radius:6px;padding:4px 6px;font-size:11px"></td></tr>';
    }).join("");

    var el = document.createElement("div");
    el.id = "hrPayPanel"; el.style.marginTop = "16px";
    el.innerHTML =
      // ── 확정 바 ──
      '<div class="form-card" style="padding:14px 16px;margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">'
      + '<div><div style="font-size:13px;font-weight:600">① 자동계산 → ② 확정 → ③ 급여대장(전체 편집) / Tự động → Chốt → Bảng lương (sửa toàn bộ)</div>'
      + '<div style="font-size:11px;color:var(--text-3);margin-top:2px">' + (finalized ? '확정됨 · ' + E((saved.finalizedAt || "").slice(0, 10)) + (diffNet ? ' · <b style="color:var(--warning)">수동조정 ' + (diffNet > 0 ? "+" : "") + F(diffNet) + '</b>' : '') : '아직 확정 전 — 위 자동계산 표를 검토 후 확정하세요') + '</div></div>'
      + '<div style="display:flex;align-items:center;gap:8px">'
      + '<span class="badge ' + (finalized ? "b-done" : "b-p1") + '" style="font-size:10px">' + (finalized ? "확정됨 / Đã chốt" : "미확정 / Chưa chốt") + '</span>'
      + '<button id="hrphFinalize" style="border:1px solid var(--text);background:var(--text);color:#fff;font-size:12px;font-weight:600;cursor:pointer;padding:8px 14px;border-radius:8px">'
      + (finalized ? "↻ 계산값으로 재확정 / Chốt lại" : "확정 → 대장으로 / Chốt → Bảng lương") + '</button></div></div>'
      // ── 급여대장 편집표 ──
      + (finalized
        ? '<div class="form-card" style="padding:0;overflow:hidden;margin-bottom:12px">'
          + '<div style="padding:12px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">'
          + '<div style="font-size:13px;font-weight:600">급여 대장 (전체 편집 가능) / Bảng lương — ' + E(ym) + '</div>'
          + '<div style="display:flex;gap:6px"><button id="hrlAdd" style="border:1px solid var(--border);background:none;font-size:11px;cursor:pointer;padding:6px 10px;border-radius:7px">+ 행 추가 / Thêm dòng</button>'
          + '<button id="hrlSave" style="border:1px solid var(--text);background:none;color:var(--text);font-size:11px;font-weight:600;cursor:pointer;padding:6px 10px;border-radius:7px">💾 대장 저장 / Lưu</button></div></div>'
          + '<div id="hrLedgerBox" style="padding:6px"></div>'
          + '<p style="font-size:11px;color:var(--text-3);padding:6px 16px 12px;line-height:1.6">모든 셀 직접 수정 가능(상여·정정·일회성 조정). <b>↻</b>=그 행을 자동계산값으로 초기화 · <b>+행</b>=대장에 없는 급여 라인 추가(예: 상여 정산). 합계는 대장 값 기준 실시간.</p></div>'
        : '<div class="form-card" style="padding:20px 16px;margin-bottom:12px;text-align:center;color:var(--text-3);font-size:12px">확정하면 여기에 <b>편집 가능한 급여대장</b>이 생성됩니다. / Sau khi chốt, bảng lương có thể sửa sẽ hiện ở đây.</div>')
      // ── 직원별 지급·증빙 ──
      + (finalized
        ? '<div class="form-card" style="padding:0;overflow:hidden;margin-bottom:12px">'
          + '<div style="padding:12px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">'
          + '<div style="font-size:13px;font-weight:600">직원별 지급·증빙 / Chứng từ chuyển lương theo NV — ' + E(ym) + '</div>'
          + '<span class="badge ' + (paidCnt === _rows.length && _rows.length ? "b-done" : "b-p1") + '" style="font-size:10px">지급 ' + paidCnt + '/' + _rows.length + '명</span></div>'
          + '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:var(--surface-2)">'
          + '<th style="padding:8px 10px;text-align:left;font-size:10px;color:var(--text-3)">직원 / NV</th>'
          + '<th style="padding:8px 10px;text-align:right;font-size:10px;color:var(--text-3)">실지급액 / Thực nhận</th>'
          + '<th style="padding:8px 10px;text-align:left;font-size:10px;color:var(--text-3)">증빙 (이체증) / Chứng từ CK</th>'
          + '<th style="padding:8px 10px;text-align:center;font-size:10px;color:var(--text-3)">지급 / Đã trả</th>'
          + '<th style="padding:8px 10px;text-align:left;font-size:10px;color:var(--text-3)">지급일 / Ngày</th></tr></thead><tbody>'
          + proofRows
          + '<tr style="background:var(--surface-2);font-weight:700;border-top:2px solid var(--text)"><td style="padding:8px 10px">합계 / Tổng</td>'
          + '<td style="padding:8px 10px;text-align:right;font-family:var(--mono)">' + F(netSum) + '</td>'
          + '<td colspan="3" style="padding:8px 10px;color:var(--text-3);font-weight:400;font-size:11px">직원마다 이체증빙 첨부 + 지급 체크(SHB 건별). 전원 지급 시 히스토리에 ✓지급.</td></tr>'
          + '</tbody></table></div></div>'
        : '')
      // ── 히스토리 ──
      + '<div class="form-card" style="padding:0;overflow:hidden">'
      + '<div style="padding:12px 16px;border-bottom:1px solid var(--border);font-size:13px;font-weight:600">월별 히스토리 / Lịch sử theo tháng</div>'
      + '<div style="display:flex;flex-wrap:wrap;gap:6px;padding:16px">' + histRows + '</div></div>';
    host.appendChild(el);

    // 편집표 렌더
    if (finalized) { var box = el.querySelector("#hrLedgerBox"); refreshLedger(box, ym);
      el.querySelector("#hrlAdd").onclick = function() { _rows.push({ id: "M" + Date.now(), nameVi: "", nameKo: "", dept: "", salaryType: "Gross", applied: 0, otPay: 0, ib: 0, ei: 0, tax: 0, pit: 0, net: 0, ci: 0, tc: 0, note: "", manual: true }); _dirty = true; refreshLedger(box, ym); };
      el.querySelector("#hrlSave").onclick = async function() {
        try { await hrLedgerSaveRows(ym, _rows); _dirty = false; el.querySelector("#hrlSave").textContent = "✓ 저장됨 / Đã lưu"; if (typeof showToast === "function") showToast("급여대장 저장 ✓"); setTimeout(function(){ var b=document.getElementById("hrlSave"); if(b) b.textContent="💾 대장 저장 / Lưu"; },1500); hrRenderPayPanel(); }
        catch (e) { if (typeof showToast === "function") showToast("저장 실패: " + e.message); console.error(e); }
      };
    }

    // 확정
    el.querySelector("#hrphFinalize").onclick = async function() {
      if (finalized && _dirty && !confirm("저장 안 된 편집이 있습니다. 계산값으로 덮어쓸까요? (수동조정 사라짐)")) return;
      if (finalized && !confirm("자동계산값으로 급여대장을 덮어씁니다. 계속할까요?")) return;
      try { await hrLedgerFinalize(ym); if (typeof showToast === "function") showToast(ym + " 확정 → 급여대장 생성 ✓"); hrRenderPayPanel(); }
      catch (e) { if (typeof showToast === "function") showToast("확정 실패: " + e.message); console.error(e); }
    };

    // 히스토리
    months.forEach(function(m) { hrPayLoad(m).then(function(d) { var mk = el.querySelector('.hrph-mark[data-ym="' + m + '"]'); if (mk && d && d.paid) { mk.textContent = "✓지급"; mk.style.color = "var(--success)"; } }); });
    el.querySelectorAll(".hrph-hist").forEach(function(row) {
      row.onclick = function() {
        if (_dirty && !confirm("저장 안 된 대장 편집이 있습니다. 이동할까요?")) return;
        var m = row.getAttribute("data-ym"); window.hrAsof = lastDay(m);
        var inp = document.getElementById("hrAsofInput"); if (inp) inp.value = window.hrAsof;
        if (typeof renderHrPay === "function") renderHrPay();
      };
    });

    // 직원별 증빙·지급
    el.querySelectorAll(".hrpe-file").forEach(function(inp) {
      inp.onchange = async function() {
        var emp = inp.getAttribute("data-emp");
        if (typeof showToast === "function") showToast("업로드 중… / Đang tải…");
        try { for (var i = 0; i < inp.files.length; i++) { await hrPayUploadProofEmp(ym, emp, inp.files[i]); } hrRenderPayPanel(); }
        catch (e) { if (typeof showToast === "function") showToast("업로드 실패: " + e.message); console.error(e); hrRenderPayPanel(); }
      };
    });
    el.querySelectorAll(".hrpe-rm").forEach(function(x) {
      x.onclick = async function() { await hrPayRemoveProofEmp(ym, x.getAttribute("data-emp"), +x.getAttribute("data-i")); hrRenderPayPanel(); };
    });
    async function savePaidRow(emp) {
      var chk = el.querySelector('.hrpe-paid[data-emp="' + emp + '"]');
      var dt = el.querySelector('.hrpe-date[data-emp="' + emp + '"]');
      if (chk.checked && !dt.value) dt.value = new Date().toISOString().slice(0, 10);
      try {
        await hrPaySavePaidEmp(ym, emp, chk.checked, dt.value);
        var pbe = {}; el.querySelectorAll(".hrpe-paid").forEach(function(c) { var id = c.getAttribute("data-emp"); pbe[id] = { paid: c.checked, paidDate: (el.querySelector('.hrpe-date[data-emp="' + id + '"]') || {}).value || "" }; });
        await hrPayRollupPaid(ym, _rows, pbe);
        if (typeof showToast === "function") showToast("지급상태 저장 ✓");
        hrRenderPayPanel();
      } catch (e) { if (typeof showToast === "function") showToast("저장 실패: " + e.message); console.error(e); }
    }
    el.querySelectorAll(".hrpe-paid").forEach(function(c) { c.onchange = function() { savePaidRow(c.getAttribute("data-emp")); }; });
    el.querySelectorAll(".hrpe-date").forEach(function(d) { d.onchange = function() { savePaidRow(d.getAttribute("data-emp")); }; });
  };

  /* ---- renderHrPay 래핑 (원본 실행 후 패널 append) ---- */
  function wrap() {
    if (typeof window.renderHrPay !== "function") return false;
    if (window.renderHrPay.__hrphWrapped) return true;
    var orig = window.renderHrPay;
    var w = function() { orig.apply(this, arguments); try { hrRenderPayPanel(); } catch (e) { console.error(e); } };
    w.__hrphWrapped = true; window.renderHrPay = w; return true;
  }
  if (!wrap()) { var n = 0, t = setInterval(function() { if (wrap() || ++n > 25) clearInterval(t); }, 200); }
})();
