/* ════════════════════════════════════════════════════════════
   INICS · hr-pay-att.js — Phase 3 급여대장 + 출결·휴가
   ════════════════════════════════════════════════════════════ */
(function() {
  var ST_CYCLE = { P: "A", A: "L", L: "H", H: "P" };
  var ST_LABEL = { P: "", A: "결", L: "연", H: "공" };
  var ST_BG = { P: "", A: "#fef2f2", L: "#f0fdf4", H: "#fffbeb" };
  var ST_FG = { P: "", A: "var(--danger)", L: "var(--success)", H: "var(--warning)" };

  window.hrAttRec = function(empId, ym) {
    if (!window.hrState.attendance) window.hrState.attendance = {};
    if (!window.hrState.attendance[empId]) window.hrState.attendance[empId] = {};
    if (!window.hrState.attendance[empId][ym]) window.hrState.attendance[empId][ym] = { days: {}, ot: 0 };
    var rec = window.hrState.attendance[empId][ym];
    if (!rec.days) rec.days = rec.st || {};
    return rec;
  };

  window._hrSaveAttendance = async function(empId, ym, rec) {
    var payload = {
      days: rec.days || {},
      ot: rec.ot || 0,
      updatedAt: new Date().toISOString(),
      updatedBy: typeof hrActorName === "function" ? hrActorName() : "system"
    };
    var r = await fetch(
      "https://inics-approval-default-rtdb.asia-southeast1.firebasedatabase.app/hr/attendance/"
      + encodeURIComponent(empId) + "/" + encodeURIComponent(ym) + ".json",
      { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }
    );
    if (!r.ok) throw new Error("Attendance save HTTP " + r.status);
    window.hrState.attendance[empId][ym] = Object.assign({}, rec, payload);
    return payload;
  };

  window.hrOnAsofChange = function(val) {
    window.hrAsof = val || "2026-06-30";
    if (window._hrTab === "pay" && typeof renderHrPay === "function") renderHrPay();
    if (window._hrTab === "att" && typeof renderHrAtt === "function") renderHrAtt();
  };

  window.renderHrPay = function() {
    var root = document.getElementById("hrView-pay");
    if (!root) return;
    var asof = window.hrAsof || "2026-06-30";
    var rows = hrEmployeesList().filter(function(e) { return e.hrManaged; }).map(function(e) {
      return { e: e, c: hrCalcRow(e, asof) };
    });
    var A = rows.reduce(function(a, rc) {
      var c = rc.c;
      return { ap: a.ap + c.applied, ei: a.ei + c.ei, pit: a.pit + c.pit, net: a.net + c.net, ci: a.ci + c.ci, tc: a.tc + c.tc, ot: a.ot + c.otPay };
    }, { ap: 0, ei: 0, pit: 0, net: 0, ci: 0, tc: 0, ot: 0 });
    var anyAtt = rows.some(function(rc) { return rc.c.at.unpaid || rc.c.otPay; });

    root.innerHTML =
      '<div class="stats-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:20px">'
      + '<div class="stat-card"><div class="stat-top"><div class="stat-label">총 실수령 / Total Net</div></div><div class="stat-num">' + hrFmt(A.net) + '</div><div class="stat-sub">VND' + (A.ot ? " · OT " + hrFmt(A.ot) : "") + '</div></div>'
      + '<div class="stat-card"><div class="stat-top"><div class="stat-label">회사보험 / Employer Ins.</div></div><div class="stat-num" style="color:var(--warning)">' + hrFmt(A.ci) + '</div><div class="stat-sub">VND · 21.5%</div></div>'
      + '<div class="stat-card"><div class="stat-top"><div class="stat-label">PIT</div></div><div class="stat-num">' + hrFmt(A.pit) + '</div><div class="stat-sub">VND</div></div>'
      + '<div class="stat-card" style="background:var(--text);color:#fff"><div class="stat-top"><div class="stat-label" style="color:#9aa6b4">회사 총부담 / Total Employer Cost</div></div><div class="stat-num" style="color:#fff">' + hrFmt(A.tc) + '</div><div class="stat-sub" style="color:#9aa6b4">VND</div></div>'
      + '</div>'
      + '<div class="form-card" style="padding:0;overflow:hidden">'
      + '<div style="padding:12px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">'
      + '<div style="font-size:13px;font-weight:600">급여대장 — ' + hrEsc(asof.slice(0, 7)) + '</div>'
      + '<div style="display:flex;align-items:center;gap:10px">'
      + '<span style="font-size:11px;color:var(--text-3)">기준일 ' + hrEsc(asof) + ' · 출결·OT 자동 반영 · 수습→정식 자동</span>'
      + '<button id="hrPayslipAllBtn" style="padding:6px 12px;border:1px solid var(--border);border-radius:6px;background:var(--text);color:#fff;font-size:11px;cursor:pointer">급여명세서 전체 PDF</button>'
      + '</div></div>'
      + '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px">'
      + '<thead><tr style="background:var(--surface-2);border-bottom:1px solid var(--border)">'
      + '<th style="text-align:left;padding:10px 12px;font-size:10px;color:var(--text-3)">직원</th>'
      + '<th style="text-align:left;padding:10px 12px;font-size:10px;color:var(--text-3)">유형</th>'
      + '<th style="text-align:right;padding:10px 12px;font-size:10px;color:var(--text-3)">적용급여 / Applied</th>'
      + '<th style="text-align:right;padding:10px 12px;font-size:10px;color:var(--text-3)">OT</th>'
      + '<th style="text-align:right;padding:10px 12px;font-size:10px;color:var(--text-3)">보험기준 / Insurance Base</th>'
      + '<th style="text-align:right;padding:10px 12px;font-size:10px;color:var(--text-3)">직원보험 / Employee Ins.</th>'
      + '<th style="text-align:right;padding:10px 12px;font-size:10px;color:var(--text-3)">과세소득 / Taxable</th>'
      + '<th style="text-align:right;padding:10px 12px;font-size:10px;color:var(--text-3)">PIT</th>'
      + '<th style="text-align:right;padding:10px 12px;font-size:10px;color:var(--text-3)">실수령 / Net</th>'
      + '<th style="text-align:right;padding:10px 12px;font-size:10px;color:var(--text-3)">회사보험 / Employer Ins.</th>'
      + '<th style="text-align:right;padding:10px 12px;font-size:10px;color:var(--text-3)">총비용 / Total Cost</th>'
      + '<th style="text-align:center;padding:10px 12px;font-size:10px;color:var(--text-3)">명세서</th>'
      + '</tr></thead><tbody>'
      + rows.map(function(rc) {
        var e = rc.e, c = rc.c;
        return '<tr class="hr-pay-row" data-id="' + hrEsc(e.id) + '" style="cursor:pointer;border-bottom:1px solid var(--border)">'
          + '<td style="padding:11px 12px"><div style="font-weight:600;font-size:13px">' + hrEsc(e.nameVi) + '</div>'
          + '<div style="font-size:11px;color:var(--text-3)">' + hrEsc(e.positionKo) + " · " + hrEsc(e.dept) + '</div></td>'
          + '<td style="padding:11px 12px"><span class="badge ' + (e.salaryType === "NET" ? "b-done" : "b-p1") + '" style="font-size:10px">' + hrEsc(e.salaryType) + '</span>'
          + (c.split
              ? ' <span class="badge b-payment" style="font-size:10px">전환월 수습' + c.at.probPaid + "일+정식" + c.at.offPaid + "일</span>"
              : (c.at.probStd > 0 ? ' <span class="badge b-payment" style="font-size:10px">수습 ' + Math.round((e.probPct == null ? 1 : e.probPct) * 100) + "%</span>" : "")) + '</td>'
          + '<td style="padding:11px 12px;text-align:right;font-family:var(--mono)">' + hrFmt(c.applied)
          + (c.split ? '<br><span style="color:var(--text-3);font-size:10px">수습 ' + hrFmt(c.probPay) + ' + 정식 ' + hrFmt(c.offPay) + '</span>' : "")
          + (c.at.unpaid ? '<br><span style="color:var(--danger);font-size:10px">결근 ' + c.at.unpaid + "일</span>" : "") + '</td>'
          + '<td style="padding:11px 12px;text-align:right;font-family:var(--mono)">' + (c.otPay ? hrFmt(c.otPay) + '<br><span style="color:var(--text-3);font-size:10px">' + c.at.ot + "h</span>" : '<span style="color:var(--text-3)">—</span>') + '</td>'
          + '<td style="padding:11px 12px;text-align:right;font-family:var(--mono)">' + (c.ib ? hrFmt(c.ib) : '<span style="color:var(--text-3)">—</span>') + '</td>'
          + '<td style="padding:11px 12px;text-align:right;font-family:var(--mono)">' + (c.ei ? hrFmt(c.ei) : '<span style="color:var(--text-3)">—</span>') + '</td>'
          + '<td style="padding:11px 12px;text-align:right;font-family:var(--mono)">' + (c.tax ? hrFmt(c.tax) : '<span style="color:var(--text-3)">—</span>') + '</td>'
          + '<td style="padding:11px 12px;text-align:right;font-family:var(--mono)">' + hrFmt(c.pit)
          + ' <span style="color:var(--text-3);font-size:10px">' + ({ "split": "분리", "aggregate": "전액누진", "10%": "10%", "prog": "누진", "net-gross-up": "누진" }[c.pitMode] || "누진") + '</span>'
          + (c.pitMode === "split" ? '<br><span style="color:var(--text-3);font-size:10px">10% ' + hrFmt(c.pitProb) + ' + 누진 ' + hrFmt(c.pitOff) + '</span>' : "") + '</td>'
          + '<td style="padding:11px 12px;text-align:right;font-family:var(--mono);font-weight:600">' + hrFmt(c.net) + '</td>'
          + '<td style="padding:11px 12px;text-align:right;font-family:var(--mono)">' + (c.ci ? hrFmt(c.ci) : '<span style="color:var(--text-3)">—</span>') + '</td>'
          + '<td style="padding:11px 12px;text-align:right;font-family:var(--mono);font-weight:600">' + hrFmt(c.tc) + '</td>'
          + '<td style="padding:11px 8px;text-align:center;white-space:nowrap">'
          + '<button class="hr-ps-btn" data-id="' + hrEsc(e.id) + '" data-act="view" title="미리보기" style="padding:4px 8px;margin-right:3px;border:1px solid var(--border);border-radius:5px;background:var(--surface);font-size:10px;cursor:pointer">보기</button>'
          + '<button class="hr-ps-btn" data-id="' + hrEsc(e.id) + '" data-act="pdf" title="PDF 다운로드" style="padding:4px 8px;border:1px solid var(--border);border-radius:5px;background:var(--surface);font-size:10px;cursor:pointer">PDF</button>'
          + '</td></tr>';
      }).join("")
      + '<tr style="background:var(--surface-2);font-weight:600;border-top:2px solid var(--text)">'
      + '<td style="padding:12px">합계 (' + rows.length + ")</td><td></td>"
      + '<td style="padding:12px;text-align:right;font-family:var(--mono)">' + hrFmt(A.ap) + '</td>'
      + '<td style="padding:12px;text-align:right;font-family:var(--mono)">' + (A.ot ? hrFmt(A.ot) : "—") + '</td>'
      + '<td></td><td style="padding:12px;text-align:right;font-family:var(--mono)">' + hrFmt(A.ei) + '</td><td></td>'
      + '<td style="padding:12px;text-align:right;font-family:var(--mono)">' + hrFmt(A.pit) + '</td>'
      + '<td style="padding:12px;text-align:right;font-family:var(--mono)">' + hrFmt(A.net) + '</td>'
      + '<td style="padding:12px;text-align:right;font-family:var(--mono)">' + hrFmt(A.ci) + '</td>'
      + '<td style="padding:12px;text-align:right;font-family:var(--mono)">' + hrFmt(A.tc) + '</td><td></td></tr>'
      + '</tbody></table></div></div>'
      + '<p style="font-size:11px;color:var(--text-3);margin-top:10px;line-height:1.6">'
      + (anyAtt ? "<b>출결 반영됨</b> — 무급결근은 적용급여에서 일할 차감, OT는 평일 150%로 가산. " : "")
      + "직원 행 클릭 → 인적사항. 출결·휴가는 출결·휴가 탭에서 입력. 명세서 열의 [보기]/[PDF]로 개별 급여명세서를 출력할 수 있습니다.</p>";

    /* 급여명세서 버튼 — 행 클릭(인적사항)과 충돌 방지 위해 stopPropagation */
    root.querySelectorAll(".hr-ps-btn").forEach(function(b) {
      b.onclick = function(ev) {
        ev.stopPropagation(); ev.preventDefault();
        var id = b.getAttribute("data-id");
        if (typeof hrPayslipPDF !== "function") { if (typeof showToast === "function") showToast("명세서 모듈 로딩 중입니다. 잠시 후 다시 시도하세요."); return; }
        if (b.getAttribute("data-act") === "pdf") hrPayslipPDF(id, asof); else hrPayslipPreview(id, asof);
      };
    });
    var allBtn = document.getElementById("hrPayslipAllBtn");
    if (allBtn) allBtn.onclick = function(ev) {
      ev.stopPropagation();
      if (typeof hrPayslipPDFAll !== "function") { if (typeof showToast === "function") showToast("명세서 모듈 로딩 중입니다. 잠시 후 다시 시도하세요."); return; }
      hrPayslipPDFAll(asof);
    };

    root.querySelectorAll(".hr-pay-row").forEach(function(r) {
      r.onclick = function() {
        window.hrSelEmp = r.getAttribute("data-id");
        window.hrEditMode = false;
        if (typeof hrSwitchTab === "function") hrSwitchTab("emp");
      };
    });
  };

  window.renderHrAtt = function() {
    var root = document.getElementById("hrView-att");
    if (!root) return;
    var asof = window.hrAsof || "2026-06-30";
    var ym = hrYmOf(asof);
    var year = ym.slice(0, 4);
    var y = parseInt(ym.split("-")[0], 10), m = parseInt(ym.split("-")[1], 10);
    var dim = new Date(y, m, 0).getDate();
    var list = hrEmployeesList().filter(function(e) { return e.hrManaged; });
    var ANNUAL_LEAVE = hrAnnualLeave();
    var dayHdr = [];
    for (var d = 1; d <= dim; d++) {
      var wd = new Date(y, m - 1, d).getDay();
      dayHdr.push({ d: d, we: wd === 0 || wd === 6 });
    }

    root.innerHTML =
      '<div class="stats-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:20px">'
      + '<div class="stat-card"><div class="stat-label">기준 월 / Month</div><div class="stat-num" style="font-size:18px">' + hrEsc(ym) + '</div><div class="stat-sub">상단 기준일로 변경</div></div>'
      + '<div class="stat-card"><div class="stat-label">소정근로일 / Working Days</div><div class="stat-num">' + hrWorkdaysOf(ym) + '</div><div class="stat-sub">평일</div></div>'
      + '<div class="stat-card"><div class="stat-label">연차 기준 / Annual Entitlement</div><div class="stat-num" style="color:var(--warning)">' + ANNUAL_LEAVE + '</div><div class="stat-sub">일/년</div></div>'
      + '<div class="stat-card"><div class="stat-label">이번 달 결근 / Unpaid Absence</div><div class="stat-num" style="color:var(--danger)">'
      + list.reduce(function(a, e) { return a + hrAttStats(e, ym).unpaid; }, 0) + '</div><div class="stat-sub">무급 일수</div></div>'
      + '</div>'
      + '<div class="form-card" style="padding:0;overflow:hidden;margin-bottom:16px">'
      + '<div style="padding:12px 16px;border-bottom:1px solid var(--border)"><div style="font-size:13px;font-weight:600">연차 잔액 / Annual Leave Balance — ' + year + '</div>'
      + '<div style="font-size:11px;color:var(--text-3)">연차(연) 사용분 자동 차감 · 기준 ' + ANNUAL_LEAVE + '일</div></div>'
      + '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px">'
      + '<thead><tr style="background:var(--surface-2)"><th style="text-align:left;padding:10px 12px">직원</th><th style="padding:10px">부여 / Granted</th><th style="padding:10px">사용 / Used</th><th style="padding:10px">잔여 / Remaining</th><th style="text-align:left;padding:10px 12px;width:42%">사용률</th></tr></thead><tbody>'
      + list.map(function(e) {
        var used = hrLeaveUsed(e, year);
        var rem = ANNUAL_LEAVE - used;
        var pct = Math.min(100, used / ANNUAL_LEAVE * 100);
        return '<tr style="border-bottom:1px solid var(--border)"><td style="padding:10px 12px"><div style="font-weight:600">' + hrEsc(e.nameVi) + '</div>'
          + '<div style="font-size:11px;color:var(--text-3)">' + hrEsc(e.positionKo) + '</div></td>'
          + '<td style="text-align:center;padding:10px;font-family:var(--mono)">' + ANNUAL_LEAVE + '</td>'
          + '<td style="text-align:center;padding:10px;font-family:var(--mono)">' + used + '</td>'
          + '<td style="text-align:center;padding:10px;font-family:var(--mono);font-weight:600;color:' + (rem <= 2 ? "var(--warning)" : "var(--text)") + '">' + rem + '</td>'
          + '<td style="padding:10px 12px"><div style="background:var(--surface-2);border-radius:6px;height:8px;overflow:hidden;max-width:340px">'
          + '<div style="width:' + pct + '%;height:100%;background:' + (rem <= 2 ? "var(--warning)" : "var(--success)") + '"></div></div></td></tr>';
      }).join("")
      + '</tbody></table></div></div>'
      + '<div class="form-card" style="padding:0;overflow:hidden">'
      + '<div style="padding:12px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">'
      + '<div style="font-size:13px;font-weight:600">월별 근태표 — ' + hrEsc(ym) + '</div>'
      + '<div style="display:flex;gap:12px;font-size:11px;color:var(--text-3);flex-wrap:wrap">'
      + '<span>■ 출근(기본)</span><span style="color:var(--danger)">■ 결근</span><span style="color:var(--success)">■ 연차</span><span style="color:var(--warning)">■ 공휴일</span></div></div>'
      + '<div style="overflow-x:auto;padding:6px">'
      + '<table style="font-size:11px;border-collapse:collapse;width:100%"><thead><tr>'
      + '<th style="position:sticky;left:0;background:var(--surface-2);z-index:1;min-width:120px;text-align:left;padding:8px 10px">직원</th>'
      + dayHdr.map(function(h) {
        return '<th style="padding:6px 0;width:24px;text-align:center' + (h.we ? ";color:var(--text-3)" : "") + '">' + h.d + '</th>';
      }).join("")
      + '<th style="min-width:78px;padding:8px">OT(시간)</th></tr></thead><tbody>'
      + list.map(function(e) {
        var rec = hrAttRec(e.id, ym);
        return '<tr><td style="position:sticky;left:0;background:var(--surface);z-index:1;padding:8px 10px;border-bottom:1px solid var(--border)">'
          + '<b style="font-size:12px">' + hrEsc((e.nameVi || "").split(" ").slice(-1)[0]) + '</b><br>'
          + '<span style="font-size:10px;color:var(--text-3)">' + hrEsc(e.positionKo) + '</span></td>'
          + dayHdr.map(function(h) {
            if (h.we) return '<td style="background:var(--surface-2);color:var(--text-3);text-align:center;border-bottom:1px solid var(--border)">·</td>';
            var s = rec.days[h.d] || rec.days[String(h.d)] || "P";
            return '<td class="hr-att-cell" data-emp="' + hrEsc(e.id) + '" data-day="' + h.d + '" style="text-align:center;cursor:pointer;font-weight:600;border-bottom:1px solid var(--border);background:'
              + ST_BG[s] + ";color:" + ST_FG[s] + '">' + (ST_LABEL[s] || "") + '</td>';
          }).join("")
          + '<td style="text-align:center;border-bottom:1px solid var(--border)">'
          + '<input class="hr-ot-in" data-emp="' + hrEsc(e.id) + '" type="number" min="0" max="40" value="' + (rec.ot || 0) + '" '
          + 'style="width:56px;text-align:center;border:1px solid var(--border);border-radius:6px;padding:4px;font-family:var(--mono);font-size:11px"></td></tr>';
      }).join("")
      + '</tbody></table></div>'
      + '<p style="font-size:11px;color:var(--text-3);padding:12px 16px;line-height:1.6">셀 클릭 → 출근→<b style="color:var(--danger)">결</b>→<b style="color:var(--success)">연</b>→<b style="color:var(--warning)">공</b>→출근. OT 최대 40h. 변경 즉시 급여대장 반영.</p></div>';

    root.querySelectorAll(".hr-att-cell").forEach(function(td) {
      td.onclick = async function() {
        var empId = td.getAttribute("data-emp");
        var day = parseInt(td.getAttribute("data-day"), 10);
        var rec = hrAttRec(empId, ym);
        var c = rec.days[day] || rec.days[String(day)] || "P";
        var nx = ST_CYCLE[c];
        if (nx === "P") { delete rec.days[day]; delete rec.days[String(day)]; }
        else { rec.days[day] = nx; }
        try {
          await _hrSaveAttendance(empId, ym, rec);
          renderHrAtt();
          if (typeof renderHrPay === "function") renderHrPay();
        } catch (err) {
          if (typeof showToast === "function") showToast("저장 실패 · Save failed");
          console.error(err);
        }
      };
    });

    root.querySelectorAll(".hr-ot-in").forEach(function(inp) {
      inp.onchange = async function() {
        var empId = inp.getAttribute("data-emp");
        var rec = hrAttRec(empId, ym);
        rec.ot = Math.max(0, Math.min(40, +inp.value || 0));
        try {
          await _hrSaveAttendance(empId, ym, rec);
          renderHrAtt();
          if (typeof renderHrPay === "function") renderHrPay();
        } catch (err) {
          if (typeof showToast === "function") showToast("저장 실패 · Save failed");
          console.error(err);
        }
      };
    });
  };

})();
