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
    capSIHI: 46800000, capUI: 106200000
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

  /** attStats — prototype 동일 (ATT → hrAttForCalc) */
  window.hrAttStats = function(e, ym) {
    var y = ym.split("-").map(Number)[0], m = ym.split("-").map(Number)[1];
    var dim = new Date(y, m, 0).getDate();
    var rec = hrAttForCalc(e.id, ym);
    var std = 0, unpaid = 0, leave = 0, hol = 0;
    for (var d = 1; d <= dim; d++) {
      var wd = new Date(y, m - 1, d).getDay();
      if (wd === 0 || wd === 6) continue;
      var s = rec.st[d] || rec.st[String(d)] || "P";
      if (s === "H") { hol++; continue; }
      std++;
      if (s === "A") unpaid++;
      if (s === "L") leave++;
    }
    var factor = std ? (std - unpaid) / std : 1;
    return { dim: dim, std: std, unpaid: unpaid, leave: leave, hol: hol, ot: rec.ot || 0, factor: factor };
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
    var baseApplied = pa ? Math.round(e.salary * e.probPct) : e.salary;
    var at = hrAttStats(e, hrYmOf(asof));
    var applied = Math.round(baseApplied * at.factor);
    var hourly = at.std ? baseApplied / (at.std * 8) : 0;
    var otPay = Math.round(at.ot * hourly * 1.5);
    var ded = SETTINGS.personalDed + e.dependents * SETTINGS.dependentDed;
    var ib = e.si ? applied : 0;
    var ei = cS(ib) * (SETTINGS.empRate.si + SETTINGS.empRate.hi) + cU(ib) * SETTINGS.empRate.ui;
    var ci = cS(ib) * (SETTINGS.comRate.si + SETTINGS.comRate.hi + SETTINGS.comRate.ai) + cU(ib) * SETTINGS.comRate.ui;
    var tax = 0, pit = 0, net = 0, tc = 0;
    if (e.salaryType === "NET") {
      var q = Math.max(0, applied - ded); tax = n2g(q); pit = prog(tax); net = applied + otPay; tc = applied + ei + pit + ci + otPay;
    } else {
      if (e.pitMethod === "10%") { pit = applied >= 2e6 ? applied * .1 : 0; }
      else { tax = Math.max(0, applied - ei - ded); pit = prog(tax); }
      net = applied - ei - pit + otPay; tc = applied + ci + otPay;
    }
    return { pa: pa, applied: applied, baseApplied: baseApplied, otPay: otPay, ib: ib, ei: ei, ci: ci, tax: tax, pit: pit, net: net, tc: tc, at: at };
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
