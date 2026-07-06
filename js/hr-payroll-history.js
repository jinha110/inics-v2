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

  /* ---- 지급 증빙 (기존 Storage 재사용) ---- */
  window.hrPayUploadProof = async function(ym, file) {
    if (typeof hrStorageUpload !== "function") throw new Error("hrStorageUpload 미로드 (hr.js 확인)");
    var safe = (file.name || "proof").replace(/[^\w.\-가-힣]/g, "_");
    var path = "hr/payroll-proof/" + ym + "/" + Date.now() + "_" + safe;
    var meta = await hrStorageUpload(path, file, file.type || "application/octet-stream");
    var rec = { name: file.name, path: meta.path, url: meta.downloadUrl, token: meta.downloadToken,
      size: meta.size || file.size, uploadedAt: new Date().toISOString(),
      uploadedBy: (typeof hrActorName === "function" ? hrActorName() : "system") };
    var cur = await fetch(payUrl("/" + encodeURIComponent(ym) + "/proofFiles"));
    var arr = cur.ok ? (await cur.json()) : null; arr = Array.isArray(arr) ? arr : [];
    arr.push(rec);
    await fetch(payUrl("/" + encodeURIComponent(ym)), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ proofFiles: arr }) });
    return arr;
  };
  window.hrPayRemoveProof = async function(ym, idx) {
    var cur = await fetch(payUrl("/" + encodeURIComponent(ym) + "/proofFiles"));
    var arr = cur.ok ? (await cur.json()) : null; arr = Array.isArray(arr) ? arr : [];
    var rm = arr.splice(idx, 1)[0];
    if (rm && rm.path && typeof hrStorageDelete === "function") { try { await hrStorageDelete(rm.path); } catch (_) {} }
    await fetch(payUrl("/" + encodeURIComponent(ym)), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ proofFiles: arr }) });
    return arr;
  };
  window.hrPaySavePaid = async function(ym, paid, paidDate, note) {
    var r = await fetch(payUrl("/" + encodeURIComponent(ym)), { method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paid: !!paid, paidDate: paidDate || "", proofNote: note || "" }) });
    if (!r.ok) throw new Error("지급상태 저장 HTTP " + r.status);
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
    var proofFiles = (saved && saved.proofFiles) || [];
    var paid = !!(saved && saved.paid), paidDate = (saved && saved.paidDate) || "", note = (saved && saved.proofNote) || "";

    // 자동계산 합계 vs 확정대장 합계 차이 힌트
    var live = hrPayCompute(ym).totals;
    var diffNet = finalized ? (hrLedgerTotals(_rows).net - live.net) : 0;

    var histRows = months.length ? months.map(function(m) {
      var cur = m === ym;
      return '<div class="hrph-hist" data-ym="' + m + '" style="display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid var(--border);border-radius:8px;cursor:pointer;' + (cur ? "background:var(--surface-2);border-color:var(--text)" : "") + '">'
        + '<b style="font-size:12px">' + E(m) + '</b><span class="hrph-mark" data-ym="' + m + '" style="font-size:10px;color:var(--text-3)"></span>'
        + '<span style="flex:1"></span>' + (cur ? '<span style="font-size:10px;color:var(--text-3)">보는 중</span>' : "") + '</div>';
    }).join("") : '<div style="font-size:11px;color:var(--text-3)">확정된 월이 없습니다 / Chưa có tháng chốt</div>';

    var filesHtml = proofFiles.length ? proofFiles.map(function(f, i) {
      return '<div style="display:flex;align-items:center;gap:8px;border:1px solid var(--border);border-radius:8px;padding:8px 10px">'
        + '<span>📄</span><a href="' + E(f.url) + '" target="_blank" rel="noopener" style="color:var(--text);font-weight:600;font-size:12px;text-decoration:none;overflow:hidden;text-overflow:ellipsis">' + E(f.name) + '</a>'
        + '<span style="flex:1"></span><span style="font-size:10px;color:var(--text-3)">' + Math.round((f.size || 0) / 1024) + 'KB</span>'
        + '<button class="hrph-rmproof" data-i="' + i + '" style="border:1px solid var(--border);background:none;color:var(--danger);border-radius:6px;padding:3px 7px;cursor:pointer;font-size:11px">✕</button></div>';
    }).join("") : '<div style="font-size:11px;color:var(--text-3)">첨부된 증빙 없음 / Chưa có chứng từ</div>';

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
      // ── 히스토리 + 증빙 ──
      + '<div class="form-card" style="padding:0;overflow:hidden">'
      + '<div style="padding:12px 16px;border-bottom:1px solid var(--border);font-size:13px;font-weight:600">히스토리 · 지급증빙 / Lịch sử · Chứng từ lương</div>'
      + '<div style="display:grid;grid-template-columns:0.85fr 1.15fr;gap:16px;padding:16px">'
      + '<div><div style="font-size:11px;color:var(--text-3);font-weight:600;margin-bottom:8px">월별 / Theo tháng</div>'
      + '<div style="display:flex;flex-direction:column;gap:6px;max-height:220px;overflow:auto">' + histRows + '</div></div>'
      + '<div><div style="font-size:11px;color:var(--text-3);font-weight:600;margin-bottom:8px">지급 증빙 (' + E(ym) + ') / Chứng từ chuyển lương</div>'
      + '<label id="hrphDrop" style="display:block;border:2px dashed var(--border);border-radius:10px;padding:14px;text-align:center;color:var(--text-3);cursor:pointer;font-size:12px">📎 이체증빙 업로드 (이미지·PDF) / Tải chứng từ<input id="hrphFile" type="file" accept="image/*,application/pdf" multiple style="display:none"></label>'
      + '<div id="hrphFiles" style="display:flex;flex-direction:column;gap:6px;margin-top:10px">' + filesHtml + '</div>'
      + '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:12px">'
      + '<label style="display:flex;align-items:center;gap:7px;font-size:12px;font-weight:600"><input id="hrphPaid" type="checkbox"' + (paid ? " checked" : "") + ' style="width:16px;height:16px">지급 완료 / Đã chuyển</label>'
      + '<input id="hrphPaidDate" type="date" value="' + E(paidDate) + '" style="border:1px solid var(--border);border-radius:6px;padding:5px 7px;font-size:12px"></div>'
      + '<input id="hrphNote" type="text" value="' + E(note) + '" placeholder="메모 / Ghi chú (예: SHB 이체 3건)" style="width:100%;margin-top:8px;border:1px solid var(--border);border-radius:6px;padding:7px 9px;font-size:12px">'
      + '<button id="hrphSaveProof" style="margin-top:10px;border:1px solid var(--text);background:none;color:var(--text);font-size:11px;cursor:pointer;padding:6px 12px;border-radius:7px">증빙·지급상태 저장 / Lưu</button>'
      + '</div></div></div>';
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

    // 증빙
    var drop = el.querySelector("#hrphDrop"), fileIn = el.querySelector("#hrphFile");
    fileIn.onchange = async function() { drop.textContent = "업로드 중… / Đang tải…";
      try { for (var i = 0; i < fileIn.files.length; i++) { await hrPayUploadProof(ym, fileIn.files[i]); } hrRenderPayPanel(); }
      catch (e) { if (typeof showToast === "function") showToast("업로드 실패: " + e.message); console.error(e); hrRenderPayPanel(); } };
    el.querySelectorAll(".hrph-rmproof").forEach(function(b) { b.onclick = async function() { await hrPayRemoveProof(ym, +b.getAttribute("data-i")); hrRenderPayPanel(); }; });
    el.querySelector("#hrphSaveProof").onclick = async function() {
      try { await hrPaySavePaid(ym, el.querySelector("#hrphPaid").checked, el.querySelector("#hrphPaidDate").value, el.querySelector("#hrphNote").value);
        if (typeof showToast === "function") showToast("지급상태 저장 ✓"); hrRenderPayPanel(); }
      catch (e) { if (typeof showToast === "function") showToast("저장 실패: " + e.message); console.error(e); } };
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
