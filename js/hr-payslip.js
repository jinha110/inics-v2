/* ════════════════════════════════════════════════════════════
   INICS · hr-payslip.js — 급여명세서(PHIẾU LƯƠNG) PDF 출력
   · 레이아웃: 급여대장 엑셀 "Salary slip" 시트와 동일 구성
   · 수습→정식 전환월은 구간별 2행으로 분리 표기
   · PDF: html2canvas + jsPDF (index.html에 전역 로드됨)
   ════════════════════════════════════════════════════════════ */
(function() {
  "use strict";

  /* ── 로고: contract.js → index.html 순으로 폴백 ── */
  function _psLogo() {
    if (typeof INICS_LOGO_CT !== "undefined" && INICS_LOGO_CT) return INICS_LOGO_CT;
    if (typeof QUOTE_LOGO_DEFAULT !== "undefined" && QUOTE_LOGO_DEFAULT) return QUOTE_LOGO_DEFAULT;
    return "";
  }

  var CO = {
    nameVi: "CÔNG TY TNHH INICS VINA",
    nameEn: "INICS VINA CO., LTD.",
    addr: "Ho Chi Minh City, Vietnam"
  };

  function _f(n) {
    n = Math.round(Number(n) || 0);
    return n.toLocaleString("en-US");
  }
  function _esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function(c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function _monthLabel(ym) {
    var p = ym.split("-");
    var MN = ["January", "February", "March", "April", "May", "June",
              "July", "August", "September", "October", "November", "December"];
    return "Tháng " + p[1] + " năm " + p[0] + " (" + MN[Number(p[1]) - 1] + " " + p[0] + ")";
  }
  function _emp(id) {
    var list = (typeof hrEmployeesList === "function") ? hrEmployeesList() : [];
    for (var i = 0; i < list.length; i++) if (String(list[i].id) === String(id)) return list[i];
    return null;
  }

  /* ── 명세서 HTML 생성 ── */
  window.hrPayslipHtml = function(e, asof) {
    var c = hrCalcRow(e, asof);
    var ym = asof.slice(0, 7);
    var at = c.at;
    var days = at.std - at.unpaid;

    var LB = 'style="padding:5px 8px;border:1px solid #333;font-size:11px"';
    var NB = 'style="padding:5px 8px;border:1px solid #333;font-size:11px;text-align:right;font-family:Consolas,Menlo,monospace"';

    /* A. 계약급여 — 전환월이면 수습/정식 분리 */
    var basic = "";
    if (c.split) {
      basic =
        '<tr><td ' + LB + '>1. Lương căn bản (Basic salary)</td><td ' + NB + '></td></tr>'
        + '<tr><td ' + LB + ' >&nbsp;&nbsp;· Thử việc ' + Math.round((e.probPct == null ? 1 : e.probPct) * 100)
        + '% × ' + at.probPaid + '/' + at.std + ' ngày <span style="color:#666">(수습)</span></td><td ' + NB + '>' + _f(c.probPay) + '</td></tr>'
        + '<tr><td ' + LB + '>&nbsp;&nbsp;· Chính thức × ' + at.offPaid + '/' + at.std + ' ngày <span style="color:#666">(정식)</span></td><td ' + NB + '>' + _f(c.offPay) + '</td></tr>';
    } else {
      var lbl = at.probStd > 0
        ? '1. Lương căn bản (Basic salary) — Thử việc ' + Math.round((e.probPct == null ? 1 : e.probPct) * 100) + '%'
        : '1. Lương căn bản (Basic salary)';
      basic = '<tr><td ' + LB + '>' + lbl + '</td><td ' + NB + '>' + _f(c.applied) + '</td></tr>';
    }

    var zeros = ["2. Nhà ở (Housing)", "3. Xăng dầu (Petrol)", "4. Điện thoại (Phone)",
                 "5. Đồng phục (Uniform)", "6. Tiền ăn giữa ca (Lunch)"];
    var zrows = zeros.map(function(t) {
      return '<tr><td ' + LB + '>' + t + '</td><td ' + NB + '>0</td></tr>';
    }).join("");

    var pitLabel = { split: "10% + Lũy tiến (분리)", aggregate: "Lũy tiến (전액누진)",
                     "10%": "10%", prog: "Lũy tiến", "net-gross-up": "Lũy tiến (NET)" }[c.pitMode] || "";

    var logo = _psLogo();

    return ''
    + '<div style="width:794px;box-sizing:border-box;padding:34px 40px;background:#fff;color:#111;'
    +      'font-family:\'Be Vietnam Pro\',Arial,sans-serif">'

    /* 헤더 */
    + '<table style="width:100%;border-collapse:collapse;margin-bottom:16px"><tr>'
    + '<td style="width:44%;vertical-align:top">'
    +   (logo ? '<img src="' + logo + '" style="height:34px;display:block;margin-bottom:6px">' : '')
    +   '<div style="font-size:11px;font-weight:700">' + _esc(CO.nameVi) + '</div>'
    +   '<div style="font-size:10px;color:#555">' + _esc(CO.nameEn) + ' · ' + _esc(CO.addr) + '</div>'
    + '</td>'
    + '<td style="vertical-align:top;text-align:right">'
    +   '<div style="font-size:17px;font-weight:700;letter-spacing:.5px">SALARY SLIP</div>'
    +   '<div style="font-size:12px;font-weight:600">PHIẾU LƯƠNG NHÂN VIÊN</div>'
    +   '<div style="font-size:11px;margin-top:4px">' + _esc(_monthLabel(ym)) + '</div>'
    + '</td></tr></table>'

    + '<div style="display:flex;justify-content:space-between;font-size:11px;border-top:2px solid #111;'
    +      'border-bottom:1px solid #333;padding:6px 0;margin-bottom:12px">'
    +   '<span>Ngày công chuẩn (Standard working days): <b>' + at.std + '</b></span>'
    +   '<span>Đơn vị tính (Unit): <b>VND</b></span></div>'

    /* 직원 정보 */
    + '<table style="width:100%;border-collapse:collapse;margin-bottom:12px">'
    + '<tr><td ' + LB + ' width="45%">Mã nhân viên (Employee code)</td><td ' + LB + '>' + _esc(e.id) + '</td></tr>'
    + '<tr><td ' + LB + '>Họ và tên (Full name)</td><td ' + LB + '><b>' + _esc(e.nameVi || e.nameEn || "") + '</b></td></tr>'
    + '<tr><td ' + LB + '>Phòng ban (Team)</td><td ' + LB + '>' + _esc(e.dept || "") + '</td></tr>'
    + '<tr><td ' + LB + '>Chức vụ (Position)</td><td ' + LB + '>' + _esc(e.positionVi || e.positionEn || "") + '</td></tr>'
    + '</table>'

    /* A / B */
    + '<table style="width:100%;border-collapse:collapse;margin-bottom:12px">'
    + '<tr><td ' + LB + ' width="70%" style="padding:5px 8px;border:1px solid #333;font-size:11px;background:#f0f0f0;font-weight:700">'
    +   'A. Lương hợp đồng (Contract salary)</td>'
    +   '<td ' + NB + ' style="padding:5px 8px;border:1px solid #333;font-size:11px;text-align:right;background:#f0f0f0;font-weight:700">' + at.std + ' ngày</td></tr>'
    + basic + zrows
    + '<tr><td ' + LB + '>7. Lương tăng ca (Overtime salary)</td><td ' + NB + '>' + _f(c.otPay) + '</td></tr>'
    + '<tr><td ' + LB + '>8. Phụ cấp khác (Other allowance)</td><td ' + NB + '>0</td></tr>'
    + '<tr><td ' + LB + '>Số ngày công làm thực tế (Actual working days)</td><td ' + NB + '>' + days
    +   (at.unpaid ? ' <span style="color:#b00">(nghỉ ' + at.unpaid + ')</span>' : '') + '</td></tr>'
    + '<tr><td ' + LB + '>Tổng giờ làm việc (Total working hours)</td><td ' + NB + '>' + (days * 8) + '</td></tr>'
    + '<tr><td ' + LB + '>Tổng giờ làm thêm (Total overtime hours)</td><td ' + NB + '>' + (at.ot || 0) + '</td></tr>'
    + '<tr style="background:#f0f0f0;font-weight:700"><td ' + LB + ' style="padding:6px 8px;border:1px solid #333;font-size:11px;font-weight:700">'
    +   'B. Tổng thu nhập (Total income) = 1+2+3+4+5+6+7+8</td>'
    +   '<td ' + NB + ' style="padding:6px 8px;border:1px solid #333;font-size:11px;text-align:right;font-weight:700;font-family:Consolas,Menlo,monospace">' + _f(c.applied + c.otPay) + '</td></tr>'
    + '</table>'

    /* C / D */
    + '<table style="width:100%;border-collapse:collapse;margin-bottom:16px">'
    + '<tr><td ' + LB + ' width="70%" style="padding:5px 8px;border:1px solid #333;font-size:11px;background:#f0f0f0;font-weight:700">'
    +   'C. Các khoản trừ vào lương (Deductions)</td><td ' + NB + ' style="padding:5px 8px;border:1px solid #333;background:#f0f0f0"></td></tr>'
    + '<tr><td ' + LB + '>9. Tạm ứng (Advance payment)</td><td ' + NB + '>0</td></tr>'
    + '<tr><td ' + LB + '>10. Bảo hiểm bắt buộc (Compulsory insurance)' + (c.ib ? ' — 10.5%' : '') + '</td><td ' + NB + '>' + _f(c.ei) + '</td></tr>'
    + '<tr><td ' + LB + '>11. Thuế TNCN (Personal income tax)'
    +   (pitLabel ? ' <span style="color:#666">— ' + _esc(pitLabel) + '</span>' : '')
    +   (c.pitMode === "split" ? '<div style="font-size:10px;color:#666;margin-top:2px">10% ' + _f(c.pitProb) + ' + Lũy tiến ' + _f(c.pitOff) + '</div>' : '')
    +   '</td><td ' + NB + '>' + _f(c.pit) + '</td></tr>'
    + '<tr style="background:#111;color:#fff;font-weight:700">'
    +   '<td style="padding:8px;border:1px solid #111;font-size:11px;font-weight:700">D. Thực lĩnh (Net pay) = B − 9 − 10 − 11</td>'
    +   '<td style="padding:8px;border:1px solid #111;font-size:13px;text-align:right;font-weight:700;font-family:Consolas,Menlo,monospace">' + _f(c.net) + '</td></tr>'
    + '</table>'

    /* 서명 */
    + '<table style="width:100%;border-collapse:collapse;margin-top:26px;font-size:11px;text-align:center">'
    + '<tr><td style="width:50%"><b>NGƯỜI LAO ĐỘNG</b><div style="color:#555">(Employee)</div>'
    +   '<div style="height:64px"></div><div style="border-top:1px solid #999;width:70%;margin:0 auto"></div></td>'
    + '<td style="width:50%"><b>NGƯỜI SỬ DỤNG LAO ĐỘNG</b><div style="color:#555">(Employer)</div>'
    +   '<div style="height:64px"></div><div style="border-top:1px solid #999;width:70%;margin:0 auto"></div></td></tr></table>'

    + '<div style="margin-top:18px;font-size:9px;color:#777;border-top:1px solid #ddd;padding-top:6px">'
    +   'Phiếu lương này được lập tự động từ hệ thống INICS · ' + _esc(ym)
    +   ' · Mọi thắc mắc xin liên hệ bộ phận Kế toán trong vòng 07 ngày kể từ ngày nhận.</div>'
    + '</div>';
  };

  /* ── 오프스크린 렌더 → canvas ── */
  function _toCanvas(html) {
    var wrap = document.createElement("div");
    wrap.style.cssText = "position:fixed;left:-9999px;top:0;width:794px;background:#fff";
    wrap.innerHTML = html;
    document.body.appendChild(wrap);
    return Promise.resolve()
      .then(function() {
        if (document.fonts && document.fonts.load) {
          return Promise.all([
            document.fonts.load('400 11px "Be Vietnam Pro"'),
            document.fonts.load('700 17px "Be Vietnam Pro"')
          ]).then(function() { return document.fonts.ready; }).catch(function() {});
        }
      })
      .then(function() { return html2canvas(wrap, { scale: 2, backgroundColor: "#ffffff", useCORS: true }); })
      .then(function(cv) { try { document.body.removeChild(wrap); } catch (_) {} return cv; })
      .catch(function(err) { try { document.body.removeChild(wrap); } catch (_) {} throw err; });
  }

  function _addPage(pdf, canvas, first) {
    var mmW = 190, mmH = canvas.height / canvas.width * mmW;
    if (mmH > 277) { mmH = 277; mmW = canvas.width / canvas.height * mmH; }
    if (!first) pdf.addPage();
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.94), "JPEG", (210 - mmW) / 2, 10, mmW, mmH);
  }

  function _ready() {
    if (typeof html2canvas === "undefined" || !window.jspdf) {
      if (typeof showToast === "function") showToast("PDF 모듈 로드 실패(네트워크 확인)");
      return false;
    }
    return true;
  }

  /* ── 개별 PDF ── */
  window.hrPayslipPDF = function(empId, asof) {
    if (!_ready()) return;
    asof = asof || window.hrAsof || "2026-06-30";
    var e = _emp(empId);
    if (!e) { if (typeof showToast === "function") showToast("직원을 찾을 수 없습니다"); return; }
    if (typeof showToast === "function") showToast("급여명세서 생성 중...");
    _toCanvas(hrPayslipHtml(e, asof)).then(function(cv) {
      var pdf = new window.jspdf.jsPDF("p", "mm", "a4");
      _addPage(pdf, cv, true);
      pdf.save("Payslip_" + asof.slice(0, 7) + "_" + (e.nameEn || e.nameVi || e.id).replace(/\s+/g, "_") + ".pdf");
      if (typeof showToast === "function") showToast("급여명세서 다운로드 완료");
    }).catch(function(err) {
      console.error(err);
      if (typeof showToast === "function") showToast("PDF 생성 실패: " + (err && err.message ? err.message : err));
    });
  };

  /* ── 전체 직원 일괄 PDF (1인 1페이지) ── */
  window.hrPayslipPDFAll = function(asof) {
    if (!_ready()) return;
    asof = asof || window.hrAsof || "2026-06-30";
    var list = (typeof hrEmployeesList === "function" ? hrEmployeesList() : []).filter(function(e) { return e.hrManaged; });
    if (!list.length) { if (typeof showToast === "function") showToast("대상 직원이 없습니다"); return; }
    if (typeof showToast === "function") showToast("급여명세서 " + list.length + "건 생성 중...");
    var pdf = new window.jspdf.jsPDF("p", "mm", "a4");
    var chain = Promise.resolve(), first = true;
    list.forEach(function(e) {
      chain = chain.then(function() { return _toCanvas(hrPayslipHtml(e, asof)); })
                   .then(function(cv) { _addPage(pdf, cv, first); first = false; });
    });
    chain.then(function() {
      pdf.save("Payslips_" + asof.slice(0, 7) + "_INICS_VINA.pdf");
      if (typeof showToast === "function") showToast("전체 급여명세서 " + list.length + "건 다운로드 완료");
    }).catch(function(err) {
      console.error(err);
      if (typeof showToast === "function") showToast("PDF 생성 실패: " + (err && err.message ? err.message : err));
    });
  };

  /* ── 화면 미리보기 ── */
  window.hrPayslipPreview = function(empId, asof) {
    asof = asof || window.hrAsof || "2026-06-30";
    var e = _emp(empId);
    if (!e) return;
    var old = document.getElementById("hrPayslipModal");
    if (old) old.remove();
    var m = document.createElement("div");
    m.id = "hrPayslipModal";
    m.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;overflow:auto;padding:24px 12px";
    m.innerHTML =
      '<div style="max-width:834px;margin:0 auto">'
      + '<div style="display:flex;gap:8px;justify-content:flex-end;margin-bottom:10px">'
      + '<button id="hrPsDl" style="padding:8px 16px;border:0;border-radius:6px;background:#111;color:#fff;font-size:12px;cursor:pointer">PDF 다운로드</button>'
      + '<button id="hrPsClose" style="padding:8px 16px;border:0;border-radius:6px;background:#fff;font-size:12px;cursor:pointer">닫기</button>'
      + '</div><div style="background:#fff;border-radius:4px;overflow:hidden">' + hrPayslipHtml(e, asof) + '</div></div>';
    document.body.appendChild(m);
    m.addEventListener("click", function(ev) { if (ev.target === m) m.remove(); });
    document.getElementById("hrPsClose").onclick = function() { m.remove(); };
    document.getElementById("hrPsDl").onclick = function() { hrPayslipPDF(empId, asof); };
  };
})();
