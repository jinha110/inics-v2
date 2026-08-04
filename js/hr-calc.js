/* ════════════════════════════════════════════════════════════
   INICS · hr-calc.js — 급여 계산 엔진 (inics_hr_module.html calcRow 그대로)
   · 상수만 /hr/settings/payroll 에서 읽음 (로직 변형 금지)
   ════════════════════════════════════════════════════════════ */
(function() {
  window.hrAsof = window.hrAsof || "2026-06-30";

  var _SEED = {
    personalDed: 15500000, dependentDed: 6200000,
    empRate: { si: 0.08, hi: 0.015, ui: 0.01 },
    comRate: { si: 0.17, hi: 0.03, ai: 0.005, ui: 0.01 },
    capSIHI: 46800000, capUI: 106200000,
    /* 수습→정식 전환월 PIT 처리:
       "split"     = 수습분 10% 정률 + 정식분 누진(공제 전액)  ← 회계법인 현행 방식 / 엑셀 대장 일치
       "aggregate" = 월 전액 누진(공제 전액)                  ← TT111 제25조1항b.1 + 국세청 공문 해석 */
    probPitMode: "split"
  };

  window.hrPayrollSettings = function() {
    var p = (window.hrState && window.hrState.settings && window.hrState.settings.payroll) || _SEED;
    return p;
  };

  window.hrAnnualLeave = function() {
    var s = window.hrState && window.hrState.settings;
    return (s && s.annualLeave != null) ? s.annualLeave : 12;
  };

  window.hrYmOf = function(asof) { return asof.slice(0, 7); };

  /** calc용 출결 — /hr/attendance/{empId}/{ym} → {days, ot} */
  window.hrAttForCalc = function(empId, ym) {
    var emp = (window.hrState && window.hrState.attendance || {})[empId];
    var rec = (emp && emp[ym]) ? emp[ym] : null;
    if (!rec) return { st: {}, ot: 0 };
    return { st: rec.days || rec.st || {}, ot: rec.ot || 0 };
  };

  /** attStats — prototype 동일 (ATT → hrAttForCalc)
   *  + 입사일(joinDate)/퇴사일(endDate) 자동 일할계산:
   *    입사 전·퇴사 후 평일은 소정근로일(std)에는 포함하되 무급(unpaid) 처리 →
   *    factor = (std - unpaid)/std 로 자동 일할 차감. (예: BINH 6/15 입사 → 12/22) */
  window.hrAttStats = function(e, ym) {
    var y = ym.split("-").map(Number)[0], m = ym.split("-").map(Number)[1];
    var dim = new Date(y, m, 0).getDate();
    var rec = hrAttForCalc(e.id, ym);
    var join = e.joinDate || null;
    var end = e.endDate || e.resignDate || e.leaveDate || null;
    var pad = function(n) { return (n < 10 ? "0" : "") + n; };
    var pEnd = e.probEnd || null;
    var std = 0, unpaid = 0, leave = 0, hol = 0, preHire = 0;
    var probStd = 0, offStd = 0, probPaid = 0, offPaid = 0;
    for (var d = 1; d <= dim; d++) {
      var wd = new Date(y, m - 1, d).getDay();
      if (wd === 0 || wd === 6) continue;
      var iso = y + "-" + pad(m) + "-" + pad(d);
      var employed = (!join || iso >= join) && (!end || iso <= end);
      if (!employed) { std++; unpaid++; preHire++; continue; }   // 입사 전/퇴사 후 = 무급 일할
      var s = rec.st[d] || rec.st[String(d)] || "P";
      if (s === "H") { hol++; continue; }
      std++;
      var isProb = !!(pEnd && iso <= pEnd);   // 해당 일자가 수습기간에 속하는지 (일 단위 판정)
      if (isProb) probStd++; else offStd++;
      if (s === "A") { unpaid++; }
      else { if (isProb) probPaid++; else offPaid++; }
      if (s === "L") leave++;
    }
    var factor = std ? (std - unpaid) / std : 1;
    return { dim: dim, std: std, unpaid: unpaid, leave: leave, hol: hol, preHire: preHire, ot: rec.ot || 0, factor: factor,
             probStd: probStd, offStd: offStd, probPaid: probPaid, offPaid: offPaid };
  };

  window.hrLeaveUsed = function(e, year) {
    var u = 0;
    var empAtt = (window.hrState && window.hrState.attendance || {})[e.id];
    if (!empAtt) return 0;
    Object.keys(empAtt).forEach(function(ym) {
      if (!ym.startsWith(year)) return;
      var rec = hrAttForCalc(e.id, ym);
      Object.keys(rec.st).forEach(function(k) { if (rec.st[k] === "L") u++; });
    });
    return u;
  };

  window.hrProbActiveOn = function(e, asof) { return e.probEnd && asof <= e.probEnd; };

  /** calcRow — inics_hr_module.html 와 동일 (SETTINGS만 hrPayrollSettings) */
  window.hrCalcRow = function(e, asof) {
    var SETTINGS = hrPayrollSettings();
    var cS = function(b) { return Math.min(b, SETTINGS.capSIHI); };
    var cU = function(b) { return Math.min(b, SETTINGS.capUI); };
    var prog = function(t) { return t <= 0 ? 0 : t <= 1e7 ? t * .05 : t <= 3e7 ? t * .1 - 5e5 : t <= 6e7 ? t * .2 - 35e5 : t <= 1e8 ? t * .3 - 95e5 : t * .35 - 145e5; };
    var n2g = function(q) { return q <= 0 ? 0 : q <= 9500000 ? q / .95 : q <= 27500000 ? (q - 5e5) / .9 : q <= 51500000 ? (q - 35e5) / .8 : q <= 79500000 ? (q - 95e5) / .7 : (q - 145e5) / .65; };
    var pa = hrProbActiveOn(e, asof);
    var at = hrAttStats(e, hrYmOf(asof));

    /* ── 수습/정식 구간 분리 일할계산 ──
       수습분 = 수습기준급 × 수습근무일/소정일,  정식분 = 정규급 × 정식근무일/소정일
       (구간별 반올림 — 급여대장 엑셀과 동일) */
    var probBase = Math.round(e.salary * (e.probPct == null ? 1 : e.probPct));
    var offBase = e.salary;
    var probPay = at.std ? Math.round(probBase * at.probPaid / at.std) : 0;
    var offPay = at.std ? Math.round(offBase * at.offPaid / at.std) : 0;
    var split = at.probStd > 0 && at.offStd > 0;          // 전환월 여부
    var applied = probPay + offPay;

    /* OT 단가 = 해당 월 구간가중 평균 기준급 (비전환월이면 종전과 동일) */
    var effDen = at.probStd + at.offStd;
    var baseApplied = effDen ? Math.round((probBase * at.probStd + offBase * at.offStd) / effDen)
                             : (pa ? probBase : offBase);
    var hourly = at.std ? baseApplied / (at.std * 8) : 0;
    var otPay = Math.round(at.ot * hourly * 1.5);
    var ded = SETTINGS.personalDed + e.dependents * SETTINGS.dependentDed;
    var ib = e.si ? applied : 0;
    var ei = cS(ib) * (SETTINGS.empRate.si + SETTINGS.empRate.hi) + cU(ib) * SETTINGS.empRate.ui;
    var ci = cS(ib) * (SETTINGS.comRate.si + SETTINGS.comRate.hi + SETTINGS.comRate.ai) + cU(ib) * SETTINGS.comRate.ui;
    var mode = SETTINGS.probPitMode || "split";
    var tax = 0, pit = 0, net = 0, tc = 0, pitProb = 0, pitOff = 0, pitMode = "";
    if (e.salaryType === "NET") {
      var q = Math.max(0, applied - ded); tax = n2g(q); pit = prog(tax); net = applied + otPay; tc = applied + ei + pit + ci + otPay;
      pitMode = "net-gross-up";
    } else {
      if (split && mode === "aggregate") {
        /* 전환월 · 전액 누진 — 수습분 포함 월 전체를 누진 적용 */
        tax = Math.max(0, applied - ei - ded); pit = prog(tax); pitOff = pit; pitMode = "aggregate";
      } else if (split && e.pitMethod === "10%") {
        /* 전환월 · 분리 — 수습분 10% 정률(공제 미적용) + 정식분 누진(공제 전액) */
        pitProb = probPay >= 2e6 ? probPay * .1 : 0;
        tax = Math.max(0, offPay - ei - ded); pitOff = prog(tax);
        pit = pitProb + pitOff; pitMode = "split";
      } else if (e.pitMethod === "10%") {
        pit = applied >= 2e6 ? applied * .1 : 0; pitProb = pit; pitMode = "10%";
      } else {
        tax = Math.max(0, applied - ei - ded); pit = prog(tax); pitOff = pit; pitMode = "prog";
      }
      net = applied - ei - pit + otPay; tc = applied + ci + otPay;
    }
    return { pa: pa, applied: applied, baseApplied: baseApplied, otPay: otPay, ib: ib, ei: ei, ci: ci, tax: tax, pit: pit, net: net, tc: tc, at: at,
             split: split, probBase: probBase, offBase: offBase, probPay: probPay, offPay: offPay,
             pitProb: pitProb, pitOff: pitOff, pitMode: pitMode };
  };

  /** 전환월(수습→정식) 검증 — 2026-07 급여대장 엑셀 대조 */
  window.hrSplitTest = function() {
    window.hrState = window.hrState || {};
    window.hrState.settings = window.hrState.settings || {};
    window.hrState.attendance = { E03: { "2026-07": { days: { 17: "A" } } } };   // 7/17 결근 1일
    var e = { id: "E03", nameVi: "Khanh", salaryType: "Gross", salary: 16000000, dependents: 0, si: false,
              pitMethod: "10%", probPct: 0.85, probStart: "2026-05-18", probEnd: "2026-07-17",
              joinDate: "2026-05-18", hrManaged: true };
    var c = hrCalcRow(e, "2026-07-31");
    var exp = { probPay: 7095652, offPay: 6956522, applied: 14052174, pit: 709565.2, net: 13342608.8 };
    var chk = [["probPay", c.probPay, exp.probPay], ["offPay", c.offPay, exp.offPay],
               ["applied", c.applied, exp.applied], ["pit", Math.round(c.pit * 100) / 100, exp.pit],
               ["net", Math.round(c.net * 100) / 100, exp.net]];
    var pass = chk.every(function(r) { return r[1] === r[2]; });
    console.log("=== INICS HR Split Test (2026-07, Khanh 수습→정식 전환월) ===");
    console.log(" 소정 " + c.at.std + "일 · 수습 " + c.at.probPaid + "/" + c.at.probStd + "일 · 정식 " + c.at.offPaid + "/" + c.at.offStd + "일 · PIT모드 " + c.pitMode);
    chk.forEach(function(r) { console.log(" " + r[0] + ": " + r[1] + " (기대 " + r[2] + ") " + (r[1] === r[2] ? "\u2713" : "\u2717 FAIL")); });
    console.log(pass ? "\u2705 SPLIT TEST PASS (급여대장 엑셀 일치)" : "\u274c SPLIT TEST FAIL");
    return { pass: pass, calc: c };
  };

  window.hrWorkdaysOf = function(ym) {
    var p = ym.split("-").map(Number);
    var y = p[0], m = p[1];
    var dim = new Date(y, m, 0).getDate();
    var n = 0;
    for (var d = 1; d <= dim; d++) {
      var wd = new Date(y, m - 1, d).getDay();
      if (wd !== 0 && wd !== 6) n++;
    }
    return n;
  };

  /** 회귀 테스트 — 부록 B 3명, 전원 출근, asof 2026-06-30 */
  window.hrRegressionTest = function(asof) {
    asof = asof || "2026-06-30";
    window.hrState = window.hrState || {};
    window.hrState.settings = window.hrState.settings || { payroll: hrPayrollSettings(), annualLeave: 12 };
    window.hrState.attendance = window.hrState.attendance || {};
    var employees = [
      { id: "E01", nameVi: "Quynh", salaryType: "NET", salary: 22000000, dependents: 0, si: true, pitMethod: "Prog", probPct: 1, probEnd: null, hrManaged: true },
      { id: "E02", nameVi: "Binh", salaryType: "Gross", salary: 24000000, dependents: 0, si: false, pitMethod: "10%", probPct: 1, probStart: "2026-06-15", probEnd: "2026-08-14", hrManaged: true },
      { id: "E03", nameVi: "Khanh", salaryType: "Gross", salary: 16000000, dependents: 0, si: false, pitMethod: "10%", probPct: 0.85, probStart: "2026-05-18", probEnd: "2026-07-17", hrManaged: true }
    ];
    var rows = employees.map(function(e) { return { e: e, c: hrCalcRow(e, asof) }; });
    var A = rows.reduce(function(a, rc) {
      return { net: a.net + rc.c.net, tc: a.tc + rc.c.tc, pit: a.pit + rc.c.pit, applied: a.applied + rc.c.applied };
    }, { net: 0, tc: 0, pit: 0, applied: 0 });
    var expNet = 55840000, expTc = 66982105;
    var netR = Math.round(A.net), tcR = Math.round(A.tc);
    var pass = netR === expNet && tcR === expTc;
    console.log("=== INICS HR Regression Test (" + asof + ", all present) ===");
    rows.forEach(function(rc) {
      console.log(" " + rc.e.id + " " + rc.e.nameVi + ": applied=" + rc.c.applied + " pit=" + Math.round(rc.c.pit) + " net=" + rc.c.net + " tc=" + Math.round(rc.c.tc) + (rc.c.pa ? " [prob]" : ""));
    });
    console.log("합계 실수령 net:", netR, " expected:", expNet, netR === expNet ? "✓" : "✗ FAIL");
    console.log("합계 회사총비용 tc:", tcR, " (raw:", A.tc + ")", " expected:", expTc, tcR === expTc ? "✓" : "✗ FAIL");
    console.log(pass ? "✅ REGRESSION PASS" : "❌ REGRESSION FAIL");
    return { pass: pass, net: netR, tc: tcR, rawTc: A.tc, expected: { net: expNet, tc: expTc }, rows: rows };
  };
})();
