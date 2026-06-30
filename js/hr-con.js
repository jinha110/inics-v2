/* ════════════════════════════════════════════════════════════
   INICS · hr-con.js — Phase 4 노동계약서 (생성·업로드·대장)
   · /hr/contracts RTDB 메타 + Storage hr/contracts/{id}/...
   ════════════════════════════════════════════════════════════ */
(function() {
  var HR_COMPANY = {
    name: "CÔNG TY TNHH INICS VINA",
    mst: "0319562684",
    addrVi: "Số 28 Đặng Hữu Phổ, phường An Khánh, Thành phố Hồ Chí Minh, Việt Nam",
    rep: "LEE JINHA"
  };

  var TYPE_LABEL = {
    probation: "수습계약 (HĐTV)",
    labor_indef: "무기한 노동계약 (HĐLĐ)",
    labor_fixed: "확정기간 노동계약 (HĐLĐ)",
    other: "기타"
  };

  window._hrConTab = window._hrConTab || "gen";
  window._hrConViewId = window._hrConViewId || null;
  window._hrConEmp = window._hrConEmp || null;
  window._hrConType = window._hrConType || "probation";

  var DOC_CSS =
    ".hr-doc{font-family:Arial,'Noto Sans',sans-serif;font-size:11pt;line-height:1.55;color:#000}"
    + ".hr-doc .ctr{text-align:center}.hr-doc .nat{font-weight:bold;font-size:12pt}"
    + ".hr-doc .moto{border-bottom:1px solid #000;display:inline-block}"
    + ".hr-doc h2.title{text-align:center;font-size:16pt;margin:14pt 0 2pt}"
    + ".hr-doc .titleen{text-align:center;font-style:italic;color:#444;margin-bottom:10pt;font-size:11pt}"
    + ".hr-doc .art{font-weight:bold;margin:11pt 0 3pt;font-size:11.5pt}"
    + ".hr-doc .en{color:#444;font-style:italic;display:block;font-size:9.5pt}"
    + ".hr-doc .f{font-weight:600}.hr-doc .blank{color:#9C6B0E}.hr-doc .muted{color:#444}"
    + ".hr-doc .sig{margin-top:28pt}.hr-doc .sig>div{display:inline-block;width:46%;text-align:center;vertical-align:top}"
    + ".hr-doc .sig b{display:block}.hr-doc .sig .nm{margin-top:44pt;font-weight:bold}"
    + ".hr-doc p{margin:3pt 0}"
    + ".hr-doc .legend{margin-top:14px;font-size:11px;display:flex;gap:14px;color:#666}"
    + ".hr-doc .sw{display:inline-block;width:12px;height:12px;border-radius:2px;vertical-align:middle;margin-right:4px}";

  function hrGetContract(id) {
    if (!window.hrState) return null;
    return (window.hrState.contracts || {})[id] || null;
  }

  function listContracts() {
    if (typeof hrContractsList === "function") {
      try { return hrContractsList(); } catch (_) {}
    }
    if (!window.hrState) window.hrState = { contracts: {}, employees: {} };
    var m = window.hrState.contracts || {};
    return Object.keys(m).map(function(k) { return m[k]; }).filter(Boolean)
      .sort(function(a, b) { return (b.createdAt || "").localeCompare(a.createdAt || ""); });
  }

  function contractStatus(rec) {
    if (typeof hrContractStatus === "function") {
      try { return hrContractStatus(rec); } catch (_) {}
    }
    if (!rec) return "draft";
    if (rec.status) return rec.status;
    return rec.source === "uploaded" ? "concluded" : "draft";
  }

  function saveContract(id, data) {
    if (typeof _hrSaveContract === "function") return _hrSaveContract(id, data);
    return Promise.reject(new Error("_hrSaveContract not loaded — refresh with Ctrl+F5"));
  }

  function deleteContract(id) {
    if (typeof _hrDeleteContract === "function") return _hrDeleteContract(id);
    return Promise.reject(new Error("_hrDeleteContract not loaded"));
  }

  function missingFields(e) {
    if (typeof hrMissingOf === "function") return hrMissingOf(e);
    return [];
  }

  function hrManagedEmps() {
    if (typeof hrEmployeesList !== "function") return [];
    try {
      return hrEmployeesList().filter(function(e) { return e.hrManaged; });
    } catch (_) { return []; }
  }

  function hrNextDocNo(type) {
    var ab = type === "probation" ? "HĐTV" : "HĐLĐ";
    var seq = listContracts().filter(function(r) { return r.type === type; }).length + 1;
    return String(seq).padStart(2, "0") + "-2026/" + ab;
  }

  function hrFileExt(name) {
    var m = (name || "").match(/\.([^.]+)$/);
    return m ? m[1].toLowerCase() : "bin";
  }

  function hrSafeFileName(name) {
    return (name || "file").replace(/[^\w.\-()+\s]/g, "_");
  }

  /** buildDoc — inics_hr_module.html 그대로 (calcRow→hrCalcRow, fmt→hrFmt, vnDate→hrVnDate) */
  window.hrBuildDoc = function(e, type, docNo) {
    if (!e) return '<div class="doc hr-doc"><p class="blank">직원을 선택하세요.</p></div>';
    var asof = window.hrAsof || "2026-06-30";
    var c = typeof hrCalcRow === "function" ? hrCalcRow(e, asof) : { net: e.salary || 0 };
    var fill = function(val) {
      return val ? '<span class="f">' + val + "</span>" : '<span class="blank">미입력</span>';
    };
    var DN = docNo || "0X-2026/HĐTV";
    var mr = e.gender === "F" ? ["Bà", "Ms."] : ["Ông", "Mr."];
    var gender = e.gender === "F" ? ["Nữ", "Female"] : ["Nam", "Male"];
    var probSal = Math.round(e.salary * (e.probPct || 1));
    var L = function(vi, en) { return "<p>" + vi + '<span class="en">' + en + "</span></p>"; };

    if (type !== "probation") {
      var indef = type === "labor_indef";
      var noticeVi = indef ? "ít nhất 45 ngày (Điều 35)" : "ít nhất 30 ngày (Điều 35)";
      var noticeEn = indef ? "at least 45 days (Article 35)" : "at least 30 days (Article 35)";
      var flag = e.status === "probation"
        ? '<div style="background:#fffbeb;border:1px solid #f59e0b;border-radius:8px;padding:10px 12px;margin-top:12px;font-size:12px">'
          + "<b>상태 불일치</b> — 현재 <b>수습</b> 상태입니다. 정식 계약은 통과(active) 후 체결하세요.</div>" : "";
      return '<div class="doc hr-doc">'
        + '<div class="ctr"><div class="nat">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div><div class="moto">Độc lập - Tự do - Hạnh phúc</div></div>'
        + '<h2 class="title">HỢP ĐỒNG LAO ĐỘNG</h2><div class="titleen">LABOR CONTRACT — '
        + (indef ? "không xác định thời hạn / indefinite term" : "xác định thời hạn / fixed-term") + "</div>"
        + '<p style="text-align:right;font-size:11px" class="muted">Số/No: ' + fill(DN) + " · TP. Hồ Chí Minh, " + fill("ngày " + hrVnDate(e.joinDate)) + "</p>"
        + L("<b>Bên A:</b> " + HR_COMPANY.name + " — MST " + HR_COMPANY.mst + " — Đại diện: " + fill(HR_COMPANY.rep) + " (Tổng giám đốc)",
          "Employer: INICS VINA COMPANY LIMITED — Tax code " + HR_COMPANY.mst + " — Represented by " + HR_COMPANY.rep + " (General Director)")
        + L("<b>Bên B (" + mr[0] + "):</b> " + fill(e.nameVi) + " — Sinh " + fill(hrVnDate(e.dob)) + " — Giới tính: " + fill(gender[0]) + " — CCCD: " + fill(e.cccd),
          "Employee (" + mr[1] + "): " + fill(e.nameEn) + " — Date of birth " + fill(hrVnDate(e.dob)) + " — Gender: " + fill(gender[1]) + " — ID No.: " + fill(e.cccd))
        + L("Địa chỉ thường trú: " + fill(e.addrVi), "Permanent address: " + fill(e.addrEn))
        + '<p class="art">Điều 1. Công việc <span class="en">Article 1. Work</span></p>'
        + L("Chức vụ: " + fill(e.positionVi) + ". Mô tả: " + fill(e.jobDescVi), "Position: " + fill(e.positionEn) + ". Description: " + fill(e.jobDescEn))
        + '<p class="art">Điều 2. Loại hợp đồng <span class="en">Article 2. Type of contract</span></p>'
        + L(fill(indef ? "Không xác định thời hạn" : "Xác định thời hạn 12 tháng") + ". Hiệu lực từ " + fill(hrVnDate(e.joinDate)) + ".",
          (indef ? "Indefinite term" : "Fixed term, 12 months") + ". Effective from " + fill(hrVnDate(e.joinDate)) + ".")
        + '<p class="art">Điều 3. Mức lương <span class="en">Article 3. Salary</span></p>'
        + (e.salaryType === "NET"
          ? L("Lương NET — thực nhận " + fill(hrFmt(c.net)) + " đồng/tháng (Gross " + hrFmt(e.salary) + ").",
              "NET salary — take-home " + fill(hrFmt(c.net)) + " VND/month (Gross " + hrFmt(e.salary) + ").")
          : L("Lương cơ bản (Gross): " + fill(hrFmt(e.salary)) + " đồng/tháng.", "Basic salary (Gross): " + fill(hrFmt(e.salary)) + " VND/month."))
        + '<p class="art">Điều 6. Bảo hiểm <span class="en">Article 6. Insurance</span></p>'
        + L("Tham gia BHXH, BHYT, BHTN bắt buộc " + fill("kể từ ngày hiệu lực") + " theo quy định.",
          "Compulsory social, health and unemployment insurance " + fill("from the effective date") + " as prescribed.")
        + '<p class="art">Điều 8. Nghĩa vụ của người lao động <span class="en">Article 8. Employee obligations</span></p>'
        + L("Đơn phương chấm dứt phải báo trước " + fill(noticeVi) + "; vi phạm bồi thường theo Điều 40. Vi phạm nghĩa vụ bàn giao bị xử lý kỷ luật theo Nội quy lao động.",
          "Unilateral termination requires " + fill(noticeEn) + " notice; violation entails compensation under Article 40. Breach of handover duty is subject to discipline under the Internal Labor Rules.")
        + '<div class="sig"><div><b>NGƯỜI LAO ĐỘNG</b><span class="en">Employee</span><div class="nm">' + (e.nameVi || "________") + '</div></div>'
        + '<div><b>NGƯỜI SỬ DỤNG LAO ĐỘNG</b><span class="en">Employer</span><div class="nm">' + HR_COMPANY.rep + "</div></div></div>"
        + flag + "</div>"
        + '<div class="legend hr-doc"><span><span class="sw" style="background:#E7F1EF;border:1px solid #9FC9C0"></span>자동 채움</span>'
        + '<span><span class="sw" style="background:#FBF4E6;border:1px solid #D9A93C"></span>미입력</span></div>';
    }

    return '<div class="doc hr-doc">'
      + '<div class="ctr"><div class="nat">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div><div class="moto">Độc lập - Tự do - Hạnh phúc</div></div>'
      + '<p style="text-align:right;font-size:11px" class="muted">Số/No: ' + fill(DN) + " · TP. Hồ Chí Minh, " + fill("ngày " + hrVnDate(e.probStart)) + "</p>"
      + '<h2 class="title">HỢP ĐỒNG THỬ VIỆC</h2><div class="titleen">PROBATION CONTRACT</div>'
      + L("<b>Chúng tôi, một bên là:</b> " + HR_COMPANY.name, "We are, from one side: INICS VINA COMPANY LIMITED")
      + L("Địa chỉ: " + HR_COMPANY.addrVi + " · MST: " + HR_COMPANY.mst,
          "Address: No. 28 Dang Huu Pho Street, An Khanh Ward, Ho Chi Minh City · Tax code: " + HR_COMPANY.mst)
      + L("Đại diện theo pháp luật: " + fill(HR_COMPANY.rep) + " — Tổng giám đốc", "Legal Representative: " + fill(HR_COMPANY.rep) + " — General Director")
      + L("<b>Và một bên là " + fill(mr[0]) + ":</b> " + fill(e.nameVi), "<b>And from the other side is " + fill(mr[1]) + ":</b> " + fill(e.nameEn))
      + L("Quốc tịch: Việt Nam · Giới tính: " + fill(gender[0]) + " · Sinh ngày: " + fill(hrVnDate(e.dob)),
          "Nationality: Vietnam · Gender: " + fill(gender[1]) + " · Date of birth: " + fill(hrVnDate(e.dob)))
      + L("CCCD: " + fill(e.cccd) + " — cấp ngày " + fill(hrVnDate(e.issued)) + " bởi " + fill(e.issuerVi),
          "ID/Passport No.: " + fill(e.cccd) + " — issued " + fill(hrVnDate(e.issued)) + " by " + fill(e.issuerEn))
      + L("Địa chỉ thường trú: " + fill(e.addrVi), "Permanent address: " + fill(e.addrEn))
      + '<p class="art">Điều 1. Công việc và địa điểm làm việc <span class="en">Article 1. Work description and work place</span></p>'
      + L("- Chức vụ: " + fill(e.positionVi), "- Position: " + fill(e.positionEn))
      + L("- Mô tả công việc: " + fill(e.jobDescVi), "- Work description: " + fill(e.jobDescEn))
      + L("- Địa điểm làm việc: " + HR_COMPANY.addrVi, "- Work place: No. 28 Dang Huu Pho Street, An Khanh Ward, Ho Chi Minh City")
      + '<p class="art">Điều 2. Thời gian thử việc <span class="en">Article 2. Probation period</span></p>'
      + L("Thời gian thử việc 02 tháng (60 ngày), từ " + fill(hrVnDate(e.probStart)) + " đến " + fill(hrVnDate(e.probEnd)) + ". Thông báo kết quả chậm nhất 03 ngày trước khi kết thúc.",
          "Probation period of 02 months (60 days), from " + fill(hrVnDate(e.probStart)) + " to " + fill(hrVnDate(e.probEnd)) + ". The result is notified at least 03 days before the end.")
      + '<p class="art">Điều 3. Mức lương <span class="en">Article 3. Salary</span></p>'
      + L("- Lương chính thức (Gross): " + fill(hrFmt(e.salary)) + " đồng/tháng.", "- Official salary (Gross): " + fill(hrFmt(e.salary)) + " VND/month.")
      + L("- Trong thời gian thử việc hưởng " + fill(Math.round((e.probPct || 1) * 100) + "%") + " = " + fill(hrFmt(probSal)) + " đồng/tháng. Thuế TNCN khấu trừ theo quy định.",
          "- During probation, " + fill(Math.round((e.probPct || 1) * 100) + "%") + " = " + fill(hrFmt(probSal)) + " VND/month. Personal income tax withheld as prescribed.")
      + L("- Trả lương ngày 10 hàng tháng, tiền mặt hoặc chuyển khoản.", "- Paid on the 10th of each month, by cash or bank transfer.")
      + '<p class="art">Điều 4. Thời giờ làm việc, nghỉ ngơi <span class="en">Article 4. Working time, rest time</span></p>'
      + L("Thứ Hai–Thứ Sáu, 08:30–12:00 và 13:00–17:30. Làm thêm không quá 40 giờ/tháng, 200 giờ/năm. Nghỉ Thứ Bảy, Chủ nhật.",
          "Monday–Friday, 08:30–12:00 and 13:00–17:30. Overtime not exceeding 40 hours/month, 200 hours/year. Days off: Saturday, Sunday.")
      + '<p class="art">Điều 5. Trang bị bảo hộ cho người lao động <span class="en">Article 5. Personal protective equipment</span></p>'
      + L("Trang bị đồng phục và đồ dùng bảo hộ lao động phù hợp với tính chất công việc.", "Uniform and work accessories appropriate to the nature of the work.")
      + '<p class="art">Điều 6. Bảo hiểm xã hội, y tế, thất nghiệp <span class="en">Article 6. Social, health, unemployment insurance</span></p>'
      + L("Trong thời gian thử việc theo hợp đồng này, hai bên không tham gia bảo hiểm bắt buộc. Bảo hiểm xã hội, bảo hiểm y tế và bảo hiểm thất nghiệp sẽ được đăng ký và đóng theo quy định kể từ khi hai bên giao kết hợp đồng lao động chính thức sau khi đạt yêu cầu thử việc.",
          "During the probation period under this contract, the parties do not participate in compulsory insurance. Social, health and unemployment insurance shall be registered and contributed as prescribed from the time the parties sign the official labor contract after passing probation.")
      + '<p class="art">Điều 7. Đào tạo, bồi dưỡng nâng cao kỹ năng nghề <span class="en">Article 7. Training and refresher courses</span></p>'
      + L("Theo thỏa thuận riêng giữa người lao động và Công ty.", "In accordance with a separate agreement between the employee and the Company.")
      + '<p class="art">Điều 8. Nghĩa vụ của người lao động <span class="en">Article 8. Obligations of the employee</span></p>'
      + L("- Hoàn thành công việc đã cam kết trong hợp đồng.", "- To fulfill the work undertaken in the contract.")
      + L("- Chấp hành lệnh điều hành sản xuất – kinh doanh, nội quy kỷ luật lao động và an toàn lao động.", "- To comply with production and business orders, internal labor discipline and occupational safety.")
      + L("- Bồi thường do vi phạm và trách nhiệm vật chất theo Nội quy lao động.", "- To compensate for violations and material liability per the Internal Labor Rules.")
      + L("- Có trách nhiệm bàn giao công việc, tài liệu và tài sản khi chấm dứt hợp đồng. Vi phạm nghĩa vụ bàn giao bị xử lý kỷ luật theo Nội quy lao động.",
          "- Responsible for handing over work, documents and assets upon termination. Breach of the handover obligation is subject to discipline under the Internal Labor Rules.")
      + L("- Trong thời gian thử việc, mỗi bên có quyền hủy bỏ hợp đồng thử việc mà không cần báo trước và không phải bồi thường (khoản 2 Điều 27 Bộ luật Lao động).",
          "- During probation, each party may cancel the probation contract without prior notice and without compensation (Clause 2, Article 27, Labor Code).")
      + '<p class="art">Điều 9. Nghĩa vụ và quyền hạn của người sử dụng lao động <span class="en">Article 9. Obligations and rights of the employer</span></p>'
      + L("1. Nghĩa vụ: Bảo đảm việc làm và thực hiện đầy đủ những điều đã cam kết; thanh toán đầy đủ, đúng hạn các chế độ và quyền lợi cho người lao động.",
          "1. Obligations: Ensure employment and fully implement all commitments; pay fully and on time all benefits and entitlements.")
      + L("2. Quyền hạn: Điều hành người lao động hoàn thành công việc (bố trí, điều chuyển, tạm ngừng việc…); tạm hoãn, chấm dứt hợp đồng, kỷ luật theo pháp luật và Nội quy lao động.",
          "2. Rights: Manage the employee to fulfill the work (assign, transfer, suspend…); postpone, terminate the contract and discipline per law and the Internal Labor Rules.")
      + '<p class="art">Điều 10. Các nội dung khác <span class="en">Article 10. Other contents</span></p>'
      + L("Chế độ phúc lợi khác — Tiền thưởng: theo quy chế thưởng của Công ty.", "Other benefits — Bonus: in accordance with the Company's bonus regulations.")
      + '<p class="art">Điều 11. Điều khoản thi hành <span class="en">Article 11. Implementation provisions</span></p>'
      + L("Những vấn đề lao động không ghi trong hợp đồng áp dụng thỏa ước lao động tập thể; nếu chưa có thì áp dụng pháp luật lao động. Hợp đồng lập thành 02 bản giá trị ngang nhau, mỗi bên giữ 01 bản, hiệu lực từ " + fill(hrVnDate(e.probStart)) + ".",
          "Labor matters not stated herein follow the collective labor agreement; absent one, labor law applies. Made in 02 copies of equal validity, each party keeps 01, effective from " + fill(hrVnDate(e.probStart)) + ".")
      + '<div class="sig"><div><b>NGƯỜI LAO ĐỘNG</b><span class="en">Employee</span><div class="nm">' + (e.nameVi || "________") + '</div></div>'
      + '<div><b>NGƯỜI SỬ DỤNG LAO ĐỘNG</b><span class="en">Employer</span><div class="nm">' + HR_COMPANY.rep + "</div></div></div>"
      + "</div>"
      + '<div class="legend hr-doc"><span><span class="sw" style="background:#E7F1EF;border:1px solid #9FC9C0"></span>인적사항에서 자동 채움</span>'
      + '<span><span class="sw" style="background:#FBF4E6;border:1px solid #D9A93C"></span>미입력 — 카드에서 보완</span></div>';
  };

  window.hrWrapDocHtml = function(r, forWord) {
    var inner = hrBuildDoc(r.snapshot, r.type, r.docNo).split('<div class="legend"')[0];
    var wordHead = forWord
      ? "<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom><w:DoNotOptimizeForBrowser/></w:WordDocument></xml><![endif]-->"
      : "";
    return '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>'
      + hrEsc(r.docNo) + "</title>" + wordHead
      + "<style>@page Section1{size:21cm 29.7cm;margin:2cm}div.Section1{page:Section1}"
      + "body{font-family:Arial,'Noto Sans',sans-serif;font-size:11pt;line-height:1.55;color:#000;"
      + (forWord ? "" : "max-width:760px;margin:24px auto;padding:0 16px") + "}"
      + ".ctr{text-align:center}.nat{font-weight:bold;font-size:12pt}.moto{border-bottom:1px solid #000;display:inline-block}"
      + "h2.title{text-align:center;font-size:16pt;margin:14pt 0 2pt}.titleen{text-align:center;font-style:italic;color:#444;margin-bottom:10pt;font-size:11pt}"
      + ".art{font-weight:bold;margin:11pt 0 3pt;font-size:11.5pt}.en{color:#444;font-style:italic;display:block;font-size:9.5pt}"
      + ".f{font-weight:600}.blank{color:#9C6B0E}.muted{color:#444}"
      + ".sig{margin-top:28pt}.sig>div{display:inline-block;width:46%;text-align:center;vertical-align:top}.sig b{display:block}.sig .nm{margin-top:44pt;font-weight:bold}"
      + "p{margin:3pt 0}</style></head><body><div class=\"Section1\">" + inner + "</div></body></html>";
  };

  function hrStatusBadge(rec) {
    var st = contractStatus(rec);
    if (st === "concluded") return '<span class="badge b-done" style="font-size:10px">체결완료</span>';
    return '<span class="badge b-payment" style="font-size:10px">서명대기</span>';
  }

  function hrSourceBadge(rec) {
    if (rec.source === "uploaded") return '<span class="badge b-p1" style="font-size:10px">업로드</span>';
    return '<span class="badge b-done" style="font-size:10px">생성</span>';
  }

  function hrDocPaper(html) {
    return '<div style="background:#fff;color:#000;border-radius:var(--radius);padding:20px 24px;overflow:auto;max-height:72vh;border:1px solid var(--border)">'
      + "<style>" + DOC_CSS + "</style>" + html + "</div>";
  }

  window.hrPrintContract = function(id) {
    var r = hrGetContract(id);
    if (!r || !r.snapshot) return;
    var w = window.open("", "_blank");
    if (!w) { alert("팝업이 차단되었습니다. 팝업을 허용해 주세요."); return; }
    w.document.write(hrWrapDocHtml(r, false));
    w.document.close();
    setTimeout(function() { w.print(); }, 350);
  };

  window.hrDownloadContractDoc = function(id) {
    var r = hrGetContract(id);
    if (!r || !r.snapshot) return;
    var blob = new Blob(["\ufeff" + hrWrapDocHtml(r, true)], { type: "application/msword" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "INICS_" + r.docNo.replace(/[\\/]/g, "-") + "_" + (r.empName || "contract").replace(/\s+/g, "_") + ".doc";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function() { URL.revokeObjectURL(url); }, 1500);
  };

  function hrContractStorageUrl(rec, kind) {
    if (!rec) return "";
    if (kind === "scan") {
      if (rec.scanDownloadUrl) return rec.scanDownloadUrl;
      if (rec.scanPath) return hrStorageDownloadUrl(rec.scanPath, rec.scanDownloadToken);
      return "";
    }
    if (rec.fileDownloadUrl) return rec.fileDownloadUrl;
    if (rec.filePath) return hrStorageDownloadUrl(rec.filePath, rec.fileDownloadToken);
    return "";
  }

  window.hrDownloadContractFile = function(id, kind) {
    var r = hrGetContract(id);
    if (!r) return;
    var fileName = kind === "scan" ? (r.scanFileName || "signed") : (r.fileName || "contract");
    var url = hrContractStorageUrl(r, kind);
    if (!url) {
      if (typeof showToast === "function") showToast("Storage URL 없음 — 다시 업로드하세요");
      return;
    }
    try {
      if (typeof hrStorageOpenDownload === "function") {
        hrStorageOpenDownload(url, fileName);
      } else {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      console.error("hrDownloadContractFile:", err);
      if (typeof showToast === "function") showToast("다운로드 실패 · Download failed");
    }
  };

  function hrUploadContractFile(contractId, file, subpath) {
    if (file.size > (window.HR_MAX_CONTRACT_UPLOAD || 32 * 1024 * 1024)) {
      return Promise.reject(new Error("File too large (max 32MB)"));
    }
    var ext = hrFileExt(file.name);
    var mime = file.type || "application/octet-stream";
    var prep = /^image\//.test(mime)
      ? hrCompressImage(file, { maxBytes: window.HR_IMAGE_MAX_BYTES || (2 * 1024 * 1024) }).then(function(comp) {
          return { body: hrDataUrlToBlob(comp.dataUrl), mime: comp.mime, ext: "jpg" };
        })
      : Promise.resolve({ body: file, mime: mime, ext: ext });
    return prep.then(function(o) {
      var path = "hr/contracts/" + contractId + "/" + subpath + "." + o.ext;
      return hrStorageUpload(path, o.body, o.mime).then(function(up) {
        return {
          path: path,
          mime: up.contentType || o.mime,
          size: up.size || o.body.size || file.size,
          fileName: hrSafeFileName(file.name),
          downloadToken: up.downloadToken || null,
          downloadUrl: up.downloadUrl || hrStorageDownloadUrl(path, up.downloadToken)
        };
      });
    });
  }

  window.hrGenContract = function() {
    var e = (window.hrState && window.hrState.employees || {})[window._hrConEmp];
    if (!e) return;
    var id = "C" + Date.now();
    var rec = {
      id: id,
      source: "generated",
      status: "draft",
      empId: e.id,
      empName: e.nameVi,
      empPos: e.positionKo,
      type: window._hrConType,
      docNo: hrNextDocNo(window._hrConType),
      missing: missingFields(e),
      snapshot: JSON.parse(JSON.stringify(e))
    };
    saveContract(id, rec).then(function() {
      window._hrConTab = "reg";
      window._hrConViewId = id;
      renderHrCon();
      if (typeof showToast === "function") showToast("계약서 저장됨 · Contract saved");
    }).catch(function(err) {
      if (typeof showToast === "function") showToast("저장 실패 · Save failed");
      console.error(err);
    });
  };

  window.hrDelContract = function(id) {
    if (!confirm("이 계약서를 삭제할까요? · Delete this contract?")) return;
    deleteContract(id).then(function() {
      if (window._hrConViewId === id) window._hrConViewId = null;
      renderHrCon();
      if (typeof showToast === "function") showToast("삭제됨 · Deleted");
    }).catch(function(err) {
      if (typeof showToast === "function") showToast("삭제 실패 · Delete failed");
      console.error(err);
    });
  };

  window.hrUploadSignedScan = function(contractId, file) {
    if (!file) return;
    hrUploadContractFile(contractId, file, "signed").then(function(up) {
      return saveContract(contractId, {
        status: "concluded",
        scanPath: up.path,
        scanFileName: up.fileName,
        scanMime: up.mime,
        scanSize: up.size,
        scanDownloadToken: up.downloadToken || null,
        scanDownloadUrl: up.downloadUrl || null,
        concludedAt: new Date().toISOString(),
        concludedBy: typeof hrActorName === "function" ? hrActorName() : "system"
      });
    }).then(function() {
      renderHrCon();
      if (typeof showToast === "function") showToast("체결완료 · Contract concluded");
    }).catch(function(err) {
      if (typeof showToast === "function") showToast("업로드 실패 · Upload failed");
      console.error(err);
    });
  };

  function hrRenderConPreview(rec, host) {
    if (!host || !rec) return;
    if (rec.source === "uploaded") {
      var url = hrContractStorageUrl(rec, "original");
      if (!url && (rec.fileData || rec.dataUrl)) {
        host.innerHTML = '<div class="form-card" style="padding:24px;text-align:center;color:var(--danger)">'
          + '<div style="font-weight:600;margin-bottom:8px">RTDB 인라인 파일 (용량 초과로 잘림)</div>'
          + '<div style="font-size:12px;color:var(--text-2)">Storage URL이 없습니다. 계약서를 다시 업로드하세요.</div></div>';
        return;
      }
      if (!url) {
        host.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text-3)">파일 경로 없음</div>';
        return;
      }
      var mime = rec.fileMime || rec.mime || "";
      if (mime.indexOf("pdf") >= 0) {
        host.innerHTML = '<embed src="' + hrEsc(url) + '" type="application/pdf" style="width:100%;height:560px;border:1px solid var(--border);border-radius:var(--radius)">';
      } else if (mime.indexOf("image/") === 0) {
        host.innerHTML = '<img src="' + hrEsc(url) + '" style="max-width:100%;border:1px solid var(--border);border-radius:var(--radius)">';
      } else {
        host.innerHTML = '<div class="form-card" style="padding:24px;text-align:center"><div style="font-weight:600;margin-bottom:6px">' + hrEsc(rec.fileName) + '</div>'
          + '<div style="font-size:12px;color:var(--text-3)">Word/PDF는 브라우저 미리보기 불가 — 원본 다운로드로 확인하세요.</div></div>';
      }
      return;
    }
    host.innerHTML = hrDocPaper(hrBuildDoc(rec.snapshot, rec.type, rec.docNo));
    if (contractStatus(rec) === "concluded" && rec.scanPath) {
      var scanUrl = hrContractStorageUrl(rec, "scan");
      var scanBlock = document.createElement("div");
      scanBlock.style.cssText = "margin-top:16px";
      scanBlock.innerHTML = '<div style="font-size:12px;font-weight:600;margin-bottom:8px">서명·날인 스캔본</div>';
      if ((rec.scanMime || "").indexOf("pdf") >= 0) {
        scanBlock.innerHTML += '<embed src="' + hrEsc(scanUrl) + '" type="application/pdf" style="width:100%;height:400px;border:1px solid var(--border);border-radius:var(--radius)">';
      } else {
        scanBlock.innerHTML += '<img src="' + hrEsc(scanUrl) + '" style="max-width:100%;border:1px solid var(--border);border-radius:var(--radius)">';
      }
      host.appendChild(scanBlock);
    }
  }

  function renderHrConGen() {
    var host = document.getElementById("hrConBody");
    if (!host) return;
    var managed = hrManagedEmps();
    if (!managed.length) {
      host.innerHTML = '<div class="form-card" style="padding:32px;text-align:center;color:var(--text-3)">관리 대상 직원이 없습니다. 직원 인적사항 탭에서 직원을 등록하세요.</div>';
      return;
    }
    var e = (window.hrState && window.hrState.employees || {})[window._hrConEmp] || managed[0];
    window._hrConEmp = e.id;
    var miss = missingFields(e);
    var docNo = hrNextDocNo(window._hrConType);
    host.innerHTML =
      '<div style="display:grid;grid-template-columns:minmax(280px,360px) 1fr;gap:16px;align-items:start">'
      + '<div class="form-card" style="padding:18px 20px">'
      + '<div class="form-group"><label class="form-label">직원 (인적사항에서 끌어옴)</label>'
      + '<select id="hrConEmpSel" class="form-input">' + managed.map(function(x) {
        return '<option value="' + hrEsc(x.id) + '"' + (x.id === window._hrConEmp ? " selected" : "") + ">"
          + hrEsc(x.nameVi) + " (" + hrEsc(x.positionKo) + ")</option>";
      }).join("") + "</select></div>"
      + '<div class="form-group"><label class="form-label">계약 종류</label><select id="hrConTypeSel" class="form-input">'
      + '<option value="probation"' + (window._hrConType === "probation" ? " selected" : "") + ">수습계약서 (Thử việc)</option>"
      + '<option value="labor_indef"' + (window._hrConType === "labor_indef" ? " selected" : "") + ">무기한 노동계약</option>"
      + '<option value="labor_fixed"' + (window._hrConType === "labor_fixed" ? " selected" : "") + ">확정기간 노동계약</option>"
      + "</select></div>"
      + '<div class="form-group"><label class="form-label">문서번호 (자동)</label><input class="form-input" style="font-family:var(--mono)" value="' + hrEsc(docNo) + '" disabled></div>'
      + '<button class="btn btn-dark" id="hrConGenBtn" style="width:100%;margin-top:8px">계약서 생성 및 저장 →</button>'
      + (miss.length ? '<div style="margin-top:12px;padding:10px 12px;background:rgba(245,158,11,.1);border:1px solid var(--warning);border-radius:var(--radius);font-size:12px">'
        + "<b>정보 미비</b> — " + hrEsc(miss.join(", ")) + ". 생성은 되지만 빈칸으로 저장됩니다.</div>" : "")
      + '<button class="btn btn-outline" id="hrConToCard" style="width:100%;margin-top:10px;font-size:12px">← 이 직원 인적사항 카드</button>'
      + "</div>"
      + '<div id="hrConDocPreview">' + hrDocPaper(hrBuildDoc(e, window._hrConType, docNo)) + "</div>"
      + "</div>";
    var body = host;
    body.querySelector("#hrConEmpSel").onchange = function(ev) {
      window._hrConEmp = ev.target.value;
      renderHrConGen();
    };
    body.querySelector("#hrConTypeSel").onchange = function(ev) {
      window._hrConType = ev.target.value;
      renderHrConGen();
    };
    body.querySelector("#hrConGenBtn").onclick = hrGenContract;
    body.querySelector("#hrConToCard").onclick = function() {
      window.hrSelEmp = window._hrConEmp;
      window.hrEditMode = false;
      hrSwitchTab("emp");
    };
  }

  function renderHrConUp() {
    var host = document.getElementById("hrConBody");
    if (!host) return;
    var managed = hrManagedEmps();
    host.innerHTML =
      '<div class="form-card" style="max-width:640px;padding:20px 22px">'
      + '<div style="font-size:14px;font-weight:600;margin-bottom:4px">기존 계약서 업로드</div>'
      + '<div style="font-size:11px;color:var(--text-3);margin-bottom:16px">.docx · .pdf · 이미지 · 외부 서명본</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'
      + '<div class="form-group"><label class="form-label">직원 연결 (선택)</label><select id="hrUpEmp" class="form-input">'
      + '<option value="">— 연결 안 함 —</option>' + managed.map(function(x) {
        return '<option value="' + hrEsc(x.id) + '">' + hrEsc(x.nameVi) + " (" + hrEsc(x.positionKo) + ")</option>";
      }).join("") + "</select></div>"
      + '<div class="form-group"><label class="form-label">계약 종류</label><select id="hrUpType" class="form-input">'
      + '<option value="probation">수습계약 (HĐTV)</option><option value="labor_indef">무기한 노동계약</option>'
      + '<option value="labor_fixed">확정기간 노동계약</option><option value="other">기타</option></select></div>'
      + '<div class="form-group"><label class="form-label">문서번호 (선택)</label><input class="form-input" id="hrUpNo" placeholder="예: 03-2026/HĐTV" style="font-family:var(--mono)"></div>'
      + '<div class="form-group"><label class="form-label">비고 (선택)</label><input class="form-input" id="hrUpMemo" placeholder="예: 서명본 스캔"></div>'
      + "</div>"
      + '<div class="form-group" style="margin-top:14px"><label class="form-label">계약서 파일</label>'
      + '<input type="file" id="hrUpFile" class="form-input" accept=".doc,.docx,.pdf,.png,.jpg,.jpeg,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"></div>'
      + '<div id="hrUpInfo" style="font-size:12px;color:var(--text-3);margin-top:8px"></div>'
      + '<button class="btn btn-dark" id="hrUpSave" style="margin-top:14px;width:100%" disabled>업로드 저장 →</button>'
      + '<p style="font-size:11px;color:var(--text-3);margin-top:12px;line-height:1.6">업로드본은 <b>체결완료</b> 상태로 대장에 보관됩니다. 파일은 Firebase Storage <code>hr/contracts/{id}/</code>에 저장됩니다.</p>'
      + "</div>";
    var body = host;
    var picked = null;
    var fileEl = body.querySelector("#hrUpFile");
    var saveEl = body.querySelector("#hrUpSave");
    var info = body.querySelector("#hrUpInfo");
    fileEl.onchange = function() {
      var f = fileEl.files[0];
      if (!f) { picked = null; saveEl.disabled = true; info.textContent = ""; return; }
      picked = f;
      saveEl.disabled = false;
      var mb = (f.size / 1048576).toFixed(2);
      info.innerHTML = "선택됨: <b>" + hrEsc(f.name) + "</b> · " + mb + " MB"
        + (f.size > 32 * 1048576 ? ' <span style="color:var(--danger)">⚠ 32MB 초과 — 업로드 불가</span>'
          : f.size > 10 * 1048576 ? ' <span style="color:var(--text-3)">대용량 PDF — Storage resumable 업로드</span>' : "");
    };
    saveEl.onclick = function() {
      if (!picked) return;
      saveEl.disabled = true;
      var id = "C" + Date.now();
      var empId = body.querySelector("#hrUpEmp").value;
      var emp = empId ? (window.hrState && window.hrState.employees || {})[empId] : null;
      hrUploadContractFile(id, picked, "original").then(function(up) {
        return saveContract(id, {
          id: id,
          source: "uploaded",
          status: "concluded",
          empId: empId || "",
          empName: emp ? emp.nameVi : "(미연결)",
          empPos: emp ? emp.positionKo : "",
          type: body.querySelector("#hrUpType").value,
          docNo: body.querySelector("#hrUpNo").value || "(업로드)",
          memo: body.querySelector("#hrUpMemo").value || "",
          fileName: picked.name,
          fileMime: up.mime,
          fileSize: up.size,
          filePath: up.path,
          fileDownloadToken: up.downloadToken || null,
          fileDownloadUrl: up.downloadUrl || null,
          concludedAt: new Date().toISOString(),
          concludedBy: typeof hrActorName === "function" ? hrActorName() : "system"
        });
      }).then(function() {
        window._hrConTab = "reg";
        window._hrConViewId = id;
        renderHrCon();
        if (typeof showToast === "function") showToast("업로드 저장됨 · Uploaded");
      }).catch(function(err) {
        saveEl.disabled = false;
        if (typeof showToast === "function") showToast("업로드 실패 · Upload failed");
        console.error(err);
      });
    };
  }

  function renderHrConReg() {
    var body = document.getElementById("hrConBody");
    if (!body) return;
    var list = listContracts();
    if (!list.length) {
      body.innerHTML = '<div class="form-card" style="padding:40px 24px;text-align:center;color:var(--text-3)">'
        + '<div style="font-size:14px;font-weight:600;color:var(--text);margin-bottom:6px">저장된 계약서가 없습니다</div>'
        + '<div style="font-size:13px">\u201c계약서 생성\u201d 또는 \u201c계약서 업로드\u201d 탭에서 추가하세요.</div></div>';
      return;
    }
    var rec = window._hrConViewId ? hrGetContract(window._hrConViewId) : null;
    var isUp = rec && rec.source === "uploaded";
    var isDraft = rec && contractStatus(rec) === "draft";
    var detailHtml;
    if (!rec) {
      detailHtml = '<div class="form-card" style="padding:32px;text-align:center;color:var(--text-3)">왼쪽에서 계약서를 선택하세요.</div>';
    } else if (isUp) {
      detailHtml =
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">'
        + '<div><b style="font-family:var(--mono)">' + hrEsc(rec.docNo) + "</b> · "
        + '<span style="font-size:12px;color:var(--text-3)">' + hrEsc(rec.empName) + " · " + hrEsc(TYPE_LABEL[rec.type] || rec.type) + "</span></div>"
        + '<button class="btn btn-dark" id="hrConDlOrig" style="font-size:11px">원본 다운로드</button></div>'
        + '<div class="form-card" style="padding:14px 18px;margin-bottom:14px;font-size:13px">'
        + hrSourceBadge(rec) + " " + hrStatusBadge(rec)
        + '<div style="margin-top:8px"><b>' + hrEsc(rec.fileName) + '</b></div>'
        + '<div style="font-size:12px;color:var(--text-3)">' + ((rec.fileSize || 0) / 1048576).toFixed(2) + " MB"
        + (rec.memo ? " · " + hrEsc(rec.memo) : "") + "</div></div>"
        + '<div id="hrConPreviewHost"></div>';
    } else {
      detailHtml =
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">'
        + '<div><b style="font-family:var(--mono)">' + hrEsc(rec.docNo) + "</b> · "
        + '<span style="font-size:12px;color:var(--text-3)">' + hrEsc(rec.empName) + " · " + hrEsc(TYPE_LABEL[rec.type] || rec.type) + "</span></div>"
        + '<div style="display:flex;gap:8px;flex-wrap:wrap">'
        + (isDraft ? '<label class="btn btn-dark" style="font-size:11px;cursor:pointer;margin:0">서명·날인 스캔 업로드<input type="file" id="hrConScanIn" accept=".pdf,.png,.jpg,.jpeg,application/pdf" style="display:none"></label>' : "")
        + (rec.scanPath ? '<button class="btn btn-outline" id="hrConDlScan" style="font-size:11px">스캔 다운로드</button>' : "")
        + '<button class="btn btn-outline" id="hrConPrint" style="font-size:11px">인쇄 / PDF</button>'
        + '<button class="btn btn-dark" id="hrConDlDoc" style="font-size:11px">Word(.doc) 다운로드</button>'
        + "</div></div>"
        + '<div style="margin-bottom:10px">' + hrSourceBadge(rec) + " " + hrStatusBadge(rec) + "</div>"
        + '<div id="hrConPreviewHost"></div>'
        + (isDraft ? '<p style="font-size:11px;color:var(--text-3);margin-top:10px">서명·날인 스캔본을 업로드하면 <b>체결완료</b>로 전환됩니다.</p>' : "");
    }

    body.innerHTML =
      '<div style="display:grid;grid-template-columns:minmax(300px,420px) 1fr;gap:16px;align-items:start">'
      + '<div class="form-card" style="padding:0;overflow:hidden">'
      + '<div style="padding:12px 16px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">'
      + '<div style="font-size:13px;font-weight:600">계약 대장</div><span style="font-size:11px;color:var(--text-3)">' + list.length + "건</span></div>"
      + '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px">'
      + '<thead><tr style="background:var(--surface-2);border-bottom:1px solid var(--border)">'
      + '<th style="text-align:left;padding:10px 12px;font-size:10px;color:var(--text-3)">문서번호</th>'
      + '<th style="text-align:left;padding:10px 12px;font-size:10px;color:var(--text-3)">직원</th>'
      + '<th style="text-align:left;padding:10px 12px;font-size:10px;color:var(--text-3)">구분</th>'
      + '<th style="text-align:left;padding:10px 12px;font-size:10px;color:var(--text-3)">상태</th>'
      + '<th style="padding:10px 8px"></th></tr></thead><tbody>'
      + list.map(function(r) {
        var sel = r.id === window._hrConViewId;
        return '<tr class="hr-con-row" data-id="' + hrEsc(r.id) + '" style="cursor:pointer;border-bottom:1px solid var(--border)' + (sel ? ";background:var(--surface-2)" : "") + '">'
          + '<td style="padding:10px 12px;font-family:var(--mono);font-size:11px">' + hrEsc(r.docNo)
          + (r.missing && r.missing.length ? ' <span class="badge b-payment" style="font-size:9px">미비</span>' : "") + "</td>"
          + '<td style="padding:10px 12px"><div style="font-weight:600;font-size:12px">' + hrEsc(r.empName) + '</div>'
          + '<div style="font-size:10px;color:var(--text-3)">' + hrEsc(r.empPos || "") + "</div></td>"
          + '<td style="padding:10px 12px">' + hrSourceBadge(r) + '<br><span style="font-size:10px;color:var(--text-3)">'
          + hrEsc((TYPE_LABEL[r.type] || r.type || "").split(" ")[0]) + "</span></td>"
          + '<td style="padding:10px 12px">' + hrStatusBadge(r) + '<br><span style="font-size:10px;color:var(--text-3);font-family:var(--mono)">'
          + hrEsc((r.createdAt || "").slice(0, 10)) + "</span></td>"
          + '<td style="padding:10px 8px"><button class="btn btn-outline hr-con-del" data-id="' + hrEsc(r.id) + '" style="font-size:10px;padding:4px 8px;color:var(--danger)">삭제</button></td></tr>';
      }).join("")
      + "</tbody></table></div></div>"
      + '<div id="hrConDetail">' + detailHtml
      + "</div></div>";

    body.querySelectorAll(".hr-con-row").forEach(function(r) {
      r.onclick = function(ev) {
        if (ev.target.closest(".hr-con-del")) return;
        window._hrConViewId = r.getAttribute("data-id");
        renderHrConReg();
      };
    });
    body.querySelectorAll(".hr-con-del").forEach(function(b) {
      b.onclick = function(ev) { ev.stopPropagation(); hrDelContract(b.getAttribute("data-id")); };
    });

    if (!rec) return;

    var host = body.querySelector("#hrConPreviewHost");
    hrRenderConPreview(rec, host);

    var prn = body.querySelector("#hrConPrint");
    if (prn) prn.onclick = function() { hrPrintContract(rec.id); };
    var dl = body.querySelector("#hrConDlDoc");
    if (dl) dl.onclick = function() { hrDownloadContractDoc(rec.id); };
    var dlo = body.querySelector("#hrConDlOrig");
    if (dlo) dlo.onclick = function() { hrDownloadContractFile(rec.id, "original"); };
    var dls = body.querySelector("#hrConDlScan");
    if (dls) dls.onclick = function() { hrDownloadContractFile(rec.id, "scan"); };
    var scanIn = body.querySelector("#hrConScanIn");
    if (scanIn) {
      scanIn.onchange = function() {
        var f = scanIn.files[0];
        if (f) hrUploadSignedScan(rec.id, f);
        scanIn.value = "";
      };
    }
  }

  function renderHrConBody() {
    var tab = window._hrConTab || "gen";
    if (tab === "gen") renderHrConGen();
    else if (tab === "up") renderHrConUp();
    else renderHrConReg();
  }

  window.renderHrCon = function() {
    var root = document.getElementById("hrView-con");
    if (!root) {
      console.error("hrView-con element not found");
      return;
    }
    if (!window.hrState) window.hrState = { contracts: {}, employees: {} };
    var tab = window._hrConTab || "gen";
    var n = 0;
    try { n = listContracts().length; } catch (_) {}

    root.innerHTML =
      '<div style="display:flex;gap:6px;margin-bottom:16px;flex-wrap:wrap">'
      + '<button type="button" class="btn ' + (tab === "gen" ? "btn-dark" : "btn-outline") + '" id="hrConTabGen" style="font-size:12px">계약서 생성</button>'
      + '<button type="button" class="btn ' + (tab === "up" ? "btn-dark" : "btn-outline") + '" id="hrConTabUp" style="font-size:12px">계약서 업로드</button>'
      + '<button type="button" class="btn ' + (tab === "reg" ? "btn-dark" : "btn-outline") + '" id="hrConTabReg" style="font-size:12px">저장된 계약 (' + n + ")</button>"
      + '</div><div id="hrConBody"></div>';

    var genBtn = root.querySelector("#hrConTabGen");
    var upBtn = root.querySelector("#hrConTabUp");
    var regBtn = root.querySelector("#hrConTabReg");
    if (genBtn) genBtn.onclick = function() { window._hrConTab = "gen"; renderHrCon(); };
    if (upBtn) upBtn.onclick = function() { window._hrConTab = "up"; renderHrCon(); };
    if (regBtn) regBtn.onclick = function() { window._hrConTab = "reg"; renderHrCon(); };

    try {
      renderHrConBody();
    } catch (err) {
      console.error("renderHrCon body error:", err);
      var bodyEl = document.getElementById("hrConBody");
      if (bodyEl) {
        bodyEl.innerHTML = '<div class="form-card" style="padding:24px;border-color:var(--danger)">'
          + '<div style="color:var(--danger);font-weight:600;margin-bottom:8px">계약서 UI 렌더 오류</div>'
          + '<div style="font-size:12px;color:var(--text-2)">' + (typeof hrEsc === "function" ? hrEsc(String(err.message || err)) : String(err)) + '</div>'
          + '<div style="font-size:11px;color:var(--text-3);margin-top:10px">Ctrl+F5로 새로고침 후 다시 시도하세요.</div></div>';
      }
    }
  };

  window._hrConLoaded = true;
  console.log("[HR] hr-con.js initialized, renderHrCon ready");

})();
