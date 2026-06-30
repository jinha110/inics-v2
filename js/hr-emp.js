/* ════════════════════════════════════════════════════════════
   INICS · hr-emp.js — Phase 2 직원 인적사항 + 신분증 첨부
   ════════════════════════════════════════════════════════════ */
(function() {

  function hrGetEmp(id) {
    return (window.hrState.employees || {})[id] || null;
  }

  function hrMemberOptions(selectedId) {
    if (typeof MEMBERS === "undefined") return '<option value="">—</option>';
    var opts = '<option value="">— 연결 안 함 —</option>';
    MEMBERS.forEach(function(m) {
      opts += '<option value="' + m.id + '"' + (selectedId == m.id ? ' selected' : '') + '>'
        + hrEsc(m.name) + ' · ' + hrEsc(m.role) + '</option>';
    });
    return opts;
  }

  function hrMemberName(memberId) {
    if (!memberId || typeof gm !== "function") return "";
    var m = gm(memberId);
    return m ? m.name : "";
  }

  function hrDeptOptions(cur) {
    return hrDepts().map(function(d) {
      return '<option value="' + hrEsc(d) + '"' + (d === cur ? ' selected' : '') + '>' + hrEsc(d) + '</option>';
    }).join("");
  }

  /* ── 목록 ── */
  window.renderHrEmp = function() {
    var root = document.getElementById("hrView-emp");
    if (!root) return;
    if (hrSelEmp) {
      root.innerHTML = hrEditMode ? hrEmpEditHtml(hrSelEmp) : hrEmpCardHtml(hrSelEmp);
      hrBindEmp();
      return;
    }
    var emps = hrEmployeesList();
    var managed = emps.filter(function(e) { return e.hrManaged; }).length;
    var need = emps.filter(function(e) { return e.hrManaged && hrMissingOf(e).length; }).length;
    root.innerHTML =
      '<div class="stats-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:20px">'
      + '<div class="stat-card"><div class="stat-top"><div class="stat-label">전체 직원</div></div><div class="stat-num">' + emps.length + '</div><div class="stat-sub">명</div></div>'
      + '<div class="stat-card"><div class="stat-top"><div class="stat-label">관리 대상</div></div><div class="stat-num">' + managed + '</div><div class="stat-sub">hrManaged</div></div>'
      + '<div class="stat-card"><div class="stat-top"><div class="stat-label">정보 미비</div></div><div class="stat-num" style="color:' + (need ? 'var(--warning)' : 'var(--success)') + '">' + need + '</div><div class="stat-sub">계약 전 보완</div></div>'
      + '<div class="stat-card"><div class="stat-top"><div class="stat-label">취업규칙</div></div><div class="stat-num">' + managed + '/10</div><div class="stat-sub">' + (managed >= 10 ? '등록 의무' : '10명 미만') + '</div></div>'
      + '</div>'
      + '<div class="form-card" style="padding:0;overflow:hidden">'
      + '<div style="padding:12px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">'
      + '<div style="font-size:13px;font-weight:600">직원 목록 · Employee List</div>'
      + '<div style="display:flex;gap:8px;align-items:center"><span style="font-size:11px;color:var(--text-3)">행 클릭 → 인적사항 카드</span>'
      + '<button class="btn btn-dark" id="hrAddBtn" style="font-size:11px;padding:5px 12px"><i class="ti ti-plus"></i> 직원 추가</button></div></div>'
      + '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:var(--surface-2);border-bottom:1px solid var(--border)">'
      + '<th style="text-align:left;padding:10px 14px;font-size:10px;color:var(--text-3);text-transform:uppercase">이름 / Name</th><th style="text-align:left;padding:10px 14px;font-size:10px;color:var(--text-3);text-transform:uppercase">부서·직책</th><th style="text-align:left;padding:10px 14px;font-size:10px;color:var(--text-3);text-transform:uppercase">유형</th><th style="text-align:left;padding:10px 14px;font-size:10px;color:var(--text-3);text-transform:uppercase">상태</th><th style="text-align:right;padding:10px 14px;font-size:10px;color:var(--text-3);text-transform:uppercase">계약급여</th><th style="text-align:left;padding:10px 14px;font-size:10px;color:var(--text-3);text-transform:uppercase">정보</th>'
      + '</tr></thead><tbody>'
      + emps.map(function(e) {
        var m = hrMissingOf(e).length;
        var mem = e.memberId ? (' <span style="font-size:10px;color:var(--text-3)">↔ ' + hrEsc(hrMemberName(e.memberId)) + '</span>') : '';
        return '<tr class="hr-emp-row" data-id="' + hrEsc(e.id) + '" style="cursor:pointer;border-bottom:1px solid var(--border)">'
          + '<td style="padding:12px 14px"><div style="font-weight:600;font-size:13px">' + hrEsc(e.nameVi || "(미입력)") + mem + '</div>'
          + '<div style="font-size:11px;color:var(--text-3)">' + hrEsc(e.nameEn) + '</div></td>'
          + '<td style="padding:12px 14px;font-size:12px">' + hrEsc(e.dept) + '<br><span style="color:var(--text-3);font-size:11px">' + hrEsc(e.positionKo) + '</span></td>'
          + '<td style="padding:12px 14px"><span class="badge ' + (e.salaryType === "NET" ? "b-done" : "b-p1") + '" style="font-size:10px">' + hrEsc(e.salaryType) + '</span></td>'
          + '<td style="padding:12px 14px"><span class="badge ' + (e.status === "probation" ? "b-payment" : "b-done") + '" style="font-size:10px">' + (e.status === "probation" ? "수습" : e.status === "resigned" ? "퇴사" : "정식") + '</span></td>'
          + '<td style="padding:12px 14px;text-align:right;font-family:var(--mono);font-size:12px">' + hrFmt(e.salary) + '</td>'
          + '<td style="padding:12px 14px">' + (m ? '<span class="badge b-payment" style="font-size:10px">미비 ' + m + '</span>' : '<span class="badge b-done" style="font-size:10px">완비</span>') + '</td>'
          + '</tr>';
      }).join("")
      + '</tbody></table></div></div>'
      + '<p style="font-size:11px;color:var(--text-3);margin-top:10px;line-height:1.6"><b>인적사항 카드</b>에서 CCCD·고용·급여를 확인하고 신분증을 첨부합니다.</p>';
    root.querySelectorAll(".hr-emp-row").forEach(function(r) {
      r.onclick = function() { hrSelEmp = r.getAttribute("data-id"); hrEditMode = false; renderHrEmp(); };
    });
    var addBtn = root.querySelector("#hrAddBtn");
    if (addBtn) addBtn.onclick = function() {
      var id = hrNextEmpId();
      var blank = {
        id: id, nameVi: "", nameEn: "", gender: "M", dob: "", cccd: "", issued: "",
        issuerVi: "Bộ Công An", issuerEn: "Ministry of Public Security",
        addrVi: "", addrEn: "", phone: "", email: "",
        dept: hrDepts()[0] || "FURNITURE", positionVi: "", positionEn: "", positionKo: "",
        jobDescVi: "", jobDescEn: "", joinDate: "", probStart: "", probEnd: null,
        hrManaged: true, empType: "local_employee", salaryType: "Gross", salary: 0,
        dependents: 0, si: false, pitMethod: "10%", status: "probation", probPct: 0.85,
        memberId: null
      };
      hrState.employees[id] = blank;
      hrSelEmp = id; hrEditMode = true; renderHrEmp();
    };
  };

  /* ── 인사카드 (읽기) ── */
  function hrEmpCardHtml(id) {
    var e = hrGetEmp(id);
    if (!e) return '<div class="empty-state">직원을 찾을 수 없습니다</div>';
    var miss = hrMissingOf(e);
    var ini = (e.nameEn || e.nameVi || "?").trim().charAt(0).toUpperCase();
    function D(dt, dd, mono) {
      return '<div style="padding:8px 0;border-bottom:1px solid var(--border)">'
        + '<div style="font-size:10px;color:var(--text-3);text-transform:uppercase;margin-bottom:3px">' + dt + '</div>'
        + '<div style="font-size:13px' + (mono ? ';font-family:var(--mono)' : '') + '">'
        + (dd ? hrEsc(dd) : '<span style="color:var(--warning);font-weight:600;font-size:12px">미입력</span>') + '</div></div>';
    }
    function F(dt, dd, mono) {
      return '<div style="padding:8px 0;border-bottom:1px solid var(--border);grid-column:1/-1">'
        + '<div style="font-size:10px;color:var(--text-3);text-transform:uppercase;margin-bottom:3px">' + dt + '</div>'
        + '<div style="font-size:13px' + (mono ? ';font-family:var(--mono)' : '') + '">'
        + (dd ? hrEsc(dd) : '<span style="color:var(--warning);font-weight:600;font-size:12px">미입력</span>') + '</div></div>';
    }
    var memLine = e.memberId ? (' · ↔ ' + hrEsc(hrMemberName(e.memberId))) : "";
    return ''
      + '<div style="display:flex;gap:8px;align-items:center;margin-bottom:14px">'
      + '<button class="btn btn-outline" id="hrBack" style="font-size:11px;padding:5px 11px"><i class="ti ti-arrow-left"></i> 목록</button>'
      + '<span style="font-size:12px;color:var(--text-3)">인사기록 ' + hrEsc(e.id) + memLine + '</span></div>'
      + '<div style="padding:11px 14px;border-radius:var(--radius);margin-bottom:14px;font-size:12px;'
      + (miss.length ? 'background:var(--warning-bg);color:var(--warning)' : 'background:var(--success-bg);color:var(--success)') + '">'
      + (miss.length ? "⚠ 계약 전 보완 필요: " + miss.join(", ") : "✓ 인적사항 완비 — 계약서 생성 준비 완료") + '</div>'
      + '<div class="form-card" style="padding:0;overflow:hidden">'
      + '<div style="padding:12px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">'
      + '<div style="font-size:13px;font-weight:600">인적사항 카드</div>'
      + '<button class="btn btn-dark" id="hrEdit" style="font-size:11px;padding:5px 12px"><i class="ti ti-pencil"></i> 편집</button></div>'
      + '<div style="display:grid;grid-template-columns:200px 1fr;min-height:280px">'
      + '<div style="background:var(--text);color:#fff;padding:24px 20px;display:flex;flex-direction:column;gap:12px">'
      + '<div style="width:56px;height:56px;border-radius:12px;background:rgba(255,255,255,.12);display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:600">' + ini + '</div>'
      + '<div><div style="font-size:16px;font-weight:600;line-height:1.3">' + hrEsc(e.nameVi || "(미입력)") + '</div>'
      + '<div style="font-size:11px;color:#9aa6b4;margin-top:2px">' + hrEsc(e.nameEn) + '</div></div>'
      + '<div style="margin-top:auto;font-size:11px;color:#9aa6b4;line-height:1.7">'
      + '<b style="color:#cfd6df">' + hrEsc(e.positionKo) + '</b> · ' + hrEsc(e.dept) + '<br>'
      + '입사 ' + hrVnDate(e.joinDate) + '<br>'
      + '<b>' + (e.status === "probation" ? "수습" : e.status === "resigned" ? "퇴사" : "정식") + '</b> · '
      + hrEsc(e.salaryType) + " " + hrFmt(e.salary) + '</div></div>'
      + '<div style="padding:20px 22px">'
      + '<div style="font-size:11px;font-weight:700;color:var(--text-2);text-transform:uppercase;letter-spacing:.06em;margin:4px 0 10px;padding-bottom:6px;border-bottom:1px solid var(--border)">신원 / Identity</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0 20px">'
      + D("성명 (VI)", e.nameVi) + D("성명 (EN)", e.nameEn)
      + D("생년월일", hrVnDate(e.dob), true) + D("성별", e.gender === "F" ? "Nữ / Female" : "Nam / Male")
      + D("CCCD 번호", e.cccd, true) + D("발급일", hrVnDate(e.issued), true)
      + F("발급기관", e.issuerVi) + F("영주주소", e.addrVi)
      + '</div>'
      + '<div style="font-size:11px;font-weight:700;color:var(--text-2);text-transform:uppercase;letter-spacing:.06em;margin:18px 0 10px;padding-bottom:6px;border-bottom:1px solid var(--border)">신분증 첨부 / ID Documents</div>'
      + '<div id="hrIdDocs"><div style="font-size:12px;color:var(--text-3);padding:6px 0">불러오는 중…</div></div>'
      + '<div style="font-size:11px;font-weight:700;color:var(--text-2);text-transform:uppercase;letter-spacing:.06em;margin:18px 0 10px;padding-bottom:6px;border-bottom:1px solid var(--border)">고용 / Employment</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0 20px">'
      + D("부서", e.dept) + D("직위 (VI/EN)", e.positionVi ? e.positionVi + " / " + e.positionEn : "")
      + D("구성원 연결", hrMemberName(e.memberId) || "—")
      + D("입사일", hrVnDate(e.joinDate), true) + D("관리 대상", e.hrManaged ? "예 (hrManaged)" : "아니오")
      + F("직무 내용 (VI)", e.jobDescVi)
      + '</div>'
      + '<div style="font-size:11px;font-weight:700;color:var(--text-2);text-transform:uppercase;letter-spacing:.06em;margin:18px 0 10px;padding-bottom:6px;border-bottom:1px solid var(--border)">급여 / Compensation</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0 20px">'
      + D("급여 유형", e.salaryType) + D("계약 급여", hrFmt(e.salary) + " VND", true)
      + D("사회보험", e.si ? "가입" : "미가입(수습)") + D("PIT 방식", e.pitMethod === "10%" ? "10% 원천" : "누진")
      + D("수습 기간", e.probEnd ? hrVnDate(e.probStart) + " ~ " + hrVnDate(e.probEnd) : "—", true)
      + D("수습 급여율", e.status === "probation" ? Math.round((e.probPct || 1) * 100) + "%" : "—")
      + '</div></div></div></div>';
  }

  /* ── 편집 ── */
  function hrEmpEditHtml(id) {
    var e = hrGetEmp(id);
    if (!e) return "";
    return ''
      + '<div style="display:flex;gap:8px;align-items:center;margin-bottom:14px">'
      + '<button class="btn btn-outline" id="hrBack" style="font-size:11px;padding:5px 11px"><i class="ti ti-arrow-left"></i> 목록</button>'
      + '<span style="font-size:12px;color:var(--text-3)">편집 · ' + hrEsc(e.id) + '</span></div>'
      + '<div class="form-card" style="padding:0;overflow:hidden">'
      + '<div style="padding:12px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">'
      + '<div style="font-size:13px;font-weight:600">' + hrEsc(e.nameVi || "신규 직원") + ' — 편집</div>'
      + '<div style="display:flex;gap:8px">'
      + '<button class="btn btn-outline" id="hrView" style="font-size:11px;padding:5px 12px">카드 보기</button>'
      + '<button class="btn btn-dark" id="hrSave" style="font-size:11px;padding:5px 12px"><i class="ti ti-device-floppy"></i> 저장</button></div></div>'
      + '<div style="padding:20px 22px">'
      + '<div style="font-size:11px;font-weight:700;color:var(--text-2);text-transform:uppercase;margin:4px 0 10px">분류 · Classification</div>'
      + '<div class="fgrid">'
      + '<div class="fg"><label>관리 대상</label><select data-f="hrManaged"><option value="true"' + (e.hrManaged ? " selected" : "") + '>관리 대상</option><option value="false"' + (!e.hrManaged ? " selected" : "") + '>제외</option></select></div>'
      + '<div class="fg"><label>상태</label><select data-f="status"><option value="probation"' + (e.status === "probation" ? " selected" : "") + '>수습</option><option value="active"' + (e.status === "active" ? " selected" : "") + '>정식</option><option value="resigned"' + (e.status === "resigned" ? " selected" : "") + '>퇴사</option></select></div>'
      + '<div class="fg"><label>부서 · Department</label><select data-f="dept">' + hrDeptOptions(e.dept) + '</select></div>'
      + '<div class="fg"><label>구성원 연결 · memberId</label><select data-f="memberId">' + hrMemberOptions(e.memberId) + '</select></div>'
      + '<div class="fg"><label>직책 (KO)</label><input data-f="positionKo" value="' + hrEsc(e.positionKo) + '"></div>'
      + '</div>'
      + '<div style="font-size:11px;font-weight:700;color:var(--text-2);text-transform:uppercase;margin:18px 0 10px">신원 / Identity</div>'
      + '<div class="fgrid">'
      + '<div class="fg"><label>성명 (VI)</label><input data-f="nameVi" value="' + hrEsc(e.nameVi) + '"></div>'
      + '<div class="fg"><label>성명 (EN)</label><input data-f="nameEn" value="' + hrEsc(e.nameEn) + '"></div>'
      + '<div class="fg"><label>생년월일</label><input type="date" data-f="dob" value="' + hrEsc(e.dob) + '" style="font-family:var(--mono)"></div>'
      + '<div class="fg"><label>성별</label><select data-f="gender"><option value="M"' + (e.gender === "M" ? " selected" : "") + '>남</option><option value="F"' + (e.gender === "F" ? " selected" : "") + '>여</option></select></div>'
      + '<div class="fg"><label>CCCD 번호</label><input data-f="cccd" value="' + hrEsc(e.cccd) + '" style="font-family:var(--mono)"></div>'
      + '<div class="fg"><label>발급일</label><input type="date" data-f="issued" value="' + hrEsc(e.issued) + '" style="font-family:var(--mono)"></div>'
      + '<div class="fg"><label>발급기관 (VI)</label><input data-f="issuerVi" value="' + hrEsc(e.issuerVi) + '"></div>'
      + '<div class="fg"><label>발급기관 (EN)</label><input data-f="issuerEn" value="' + hrEsc(e.issuerEn) + '"></div>'
      + '<div class="fg" style="grid-column:1/-1"><label>영주주소 (VI)</label><input data-f="addrVi" value="' + hrEsc(e.addrVi) + '"></div>'
      + '<div class="fg" style="grid-column:1/-1"><label>영주주소 (EN)</label><input data-f="addrEn" value="' + hrEsc(e.addrEn) + '"></div>'
      + '</div>'
      + '<div style="font-size:11px;font-weight:700;color:var(--text-2);text-transform:uppercase;margin:18px 0 10px">고용 / Employment</div>'
      + '<div class="fgrid">'
      + '<div class="fg"><label>직위 (VI)</label><input data-f="positionVi" value="' + hrEsc(e.positionVi) + '"></div>'
      + '<div class="fg"><label>직위 (EN)</label><input data-f="positionEn" value="' + hrEsc(e.positionEn) + '"></div>'
      + '<div class="fg" style="grid-column:1/-1"><label>직무 내용 (VI)</label><textarea data-f="jobDescVi" rows="2">' + hrEsc(e.jobDescVi) + '</textarea></div>'
      + '<div class="fg" style="grid-column:1/-1"><label>직무 내용 (EN)</label><textarea data-f="jobDescEn" rows="2">' + hrEsc(e.jobDescEn) + '</textarea></div>'
      + '<div class="fg"><label>입사일</label><input type="date" data-f="joinDate" value="' + hrEsc(e.joinDate) + '" style="font-family:var(--mono)"></div>'
      + '<div class="fg"><label>수습 시작</label><input type="date" data-f="probStart" value="' + hrEsc(e.probStart || "") + '" style="font-family:var(--mono)"></div>'
      + '<div class="fg"><label>수습 종료</label><input type="date" data-f="probEnd" value="' + hrEsc(e.probEnd || "") + '" style="font-family:var(--mono)"></div>'
      + '<div class="fg"><label>수습 급여율</label><select data-f="probPct"><option value="1"' + (e.probPct === 1 ? " selected" : "") + '>100%</option><option value="0.85"' + (e.probPct === 0.85 ? " selected" : "") + '>85%</option></select></div>'
      + '</div>'
      + '<div style="font-size:11px;font-weight:700;color:var(--text-2);text-transform:uppercase;margin:18px 0 10px">급여 / Compensation</div>'
      + '<div class="fgrid">'
      + '<div class="fg"><label>급여 유형</label><select data-f="salaryType"><option' + (e.salaryType === "NET" ? " selected" : "") + '>NET</option><option' + (e.salaryType === "Gross" ? " selected" : "") + '>Gross</option></select></div>'
      + '<div class="fg"><label>급여 (VND)</label><input type="number" data-f="salary" value="' + (e.salary || 0) + '" style="font-family:var(--mono)"></div>'
      + '<div class="fg"><label>사회보험</label><select data-f="si"><option value="true"' + (e.si ? " selected" : "") + '>가입</option><option value="false"' + (!e.si ? " selected" : "") + '>미가입</option></select></div>'
      + '<div class="fg"><label>PIT 방식</label><select data-f="pitMethod"><option value="Prog"' + (e.pitMethod === "Prog" ? " selected" : "") + '>Prog</option><option value="10%"' + (e.pitMethod === "10%" ? " selected" : "") + '>10%</option></select></div>'
      + '<div class="fg"><label>부양가족</label><input type="number" data-f="dependents" value="' + (e.dependents || 0) + '" style="font-family:var(--mono)"></div>'
      + '</div></div></div>';
  }

  function hrCollectEditForm(root, e) {
    root.querySelectorAll("[data-f]").forEach(function(inp) {
      var f = inp.getAttribute("data-f");
      var v = inp.value;
      if (f === "hrManaged" || f === "si") v = (v === "true");
      else if (f === "salary" || f === "dependents" || f === "probPct") v = +v;
      else if (f === "memberId") v = v ? parseInt(v, 10) : null;
      else if (f === "probEnd" || f === "probStart") v = v || null;
      e[f] = v;
    });
    return e;
  }

  function hrBindEmp() {
    var root = document.getElementById("hrView-emp");
    if (!root || !hrSelEmp) return;
    var back = root.querySelector("#hrBack");
    if (back) back.onclick = function() { hrSelEmp = null; hrEditMode = false; renderHrEmp(); };
    var ed = root.querySelector("#hrEdit");
    if (ed) ed.onclick = function() { hrEditMode = true; renderHrEmp(); };
    var vw = root.querySelector("#hrView");
    if (vw) vw.onclick = function() { hrEditMode = false; renderHrEmp(); };
    var sv = root.querySelector("#hrSave");
    if (sv) sv.onclick = async function() {
      var e = hrGetEmp(hrSelEmp);
      if (!e) return;
      hrCollectEditForm(root, e);
      try {
        await _hrSaveEmployee(hrSelEmp, e);
        if (typeof showToast === "function") showToast("저장 완료 · Saved");
        hrEditMode = false;
        renderHrEmp();
      } catch (err) {
        if (typeof showToast === "function") showToast("저장 실패 · Save failed");
        console.error(err);
      }
    };
    if (!hrEditMode && root.querySelector("#hrIdDocs")) renderHrIdDocs(hrSelEmp);
  }

  /* ── 신분증 첨부 ── */
  window.renderHrIdDocs = async function(empId) {
    var host = document.getElementById("hrIdDocs");
    if (!host) return;
    var list = hrIdDocsList(empId);
    var cards = list.map(function(d) {
      var isImg = (d.mime || "").startsWith("image/") || (d.fileRef && /\.(jpg|jpeg|png|gif)/i.test(d.fileRef));
      var src = d.fileRef ? hrStorageDownloadUrl(d.fileRef) : "";
      var thumb = isImg && src
        ? '<img src="' + src + '" class="hr-id-thumb" data-src="' + hrEsc(src) + '" style="width:100%;height:104px;object-fit:cover;border-radius:8px 8px 0 0;cursor:zoom-in">'
        : '<div style="height:104px;display:flex;align-items:center;justify-content:center;background:var(--surface-2);border-radius:8px 8px 0 0;font-size:13px;color:var(--text-3)">' + ((d.mime || "").includes("pdf") ? "PDF" : "FILE") + '</div>';
      return '<div style="border:1px solid var(--border);border-radius:9px;overflow:hidden;background:var(--surface)">'
        + thumb
        + '<div style="padding:8px 10px">'
        + '<div style="font-size:11.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + hrEsc(d.name) + '</div>'
        + '<div style="font-size:10.5px;color:var(--text-3);margin-bottom:6px">' + hrEsc(d.label || "신분증") + ' · ' + Math.round((d.size || 0) / 1024) + ' KB</div>'
        + '<div style="display:flex;gap:6px">'
        + '<button class="btn btn-outline hr-id-dl" data-ref="' + hrEsc(d.fileRef) + '" data-name="' + hrEsc(d.name) + '" style="font-size:10px;padding:3px 8px">다운로드</button>'
        + '<button class="btn btn-outline hr-id-del" data-fid="' + hrEsc(d.fileId) + '" data-ref="' + hrEsc(d.fileRef) + '" style="font-size:10px;padding:3px 8px;color:var(--danger)">삭제</button>'
        + '</div></div></div>';
    }).join("");
    host.innerHTML =
      '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-bottom:10px">'
      + (cards || '<div style="font-size:12px;color:var(--text-3);grid-column:1/-1">첨부된 신분증이 없습니다.</div>')
      + '</div>'
      + '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">'
      + '<select id="hrIdLabel" style="font-size:12px;border:1px solid var(--border);border-radius:var(--radius);padding:7px 9px;font-family:var(--sans)">'
      + '<option>CCCD 앞면</option><option>CCCD 뒷면</option><option>여권</option><option>기타</option></select>'
      + '<input type="file" id="hrIdFile" accept="image/*,.pdf" style="font-size:12px">'
      + '<button class="btn btn-dark" id="hrIdAdd" disabled style="font-size:11px;padding:5px 12px">첨부</button>'
      + '</div>'
      + '<p style="font-size:11px;color:var(--text-3);margin-top:8px;line-height:1.5">이미지는 자동 JPEG 압축 후 Firebase Storage에 저장됩니다. RTDB에는 메타+경로만 보관합니다.</p>';
    var pick = null;
    var fEl = host.querySelector("#hrIdFile");
    var addEl = host.querySelector("#hrIdAdd");
    if (fEl) fEl.onchange = function() { pick = fEl.files[0] || null; if (addEl) addEl.disabled = !pick; };
    if (addEl) addEl.onclick = async function() {
      if (!pick) return;
      addEl.disabled = true;
      try {
        var fileId = "ID" + Date.now();
        var storagePath = "hr/idDocs/" + empId + "/" + fileId;
        var mime = pick.type || "application/octet-stream";
        var size = pick.size;
        if (/^image\//.test(mime)) {
          var compressed = await hrCompressImage(pick);
          var blob = hrDataUrlToBlob(compressed.dataUrl);
          mime = "image/jpeg";
          size = blob.size;
          storagePath += ".jpg";
          await hrStorageUpload(storagePath, blob, mime);
        } else {
          storagePath += (pick.name.match(/\.pdf$/i) ? ".pdf" : "");
          await hrStorageUpload(storagePath, pick, mime);
        }
        var meta = {
          fileId: fileId, name: pick.name, mime: mime, size: size,
          label: host.querySelector("#hrIdLabel").value,
          fileRef: storagePath,
          addedAt: new Date().toISOString(),
          addedBy: hrActorName()
        };
        await _hrSaveIdDocMeta(empId, fileId, meta);
        if (typeof showToast === "function") showToast("신분증 첨부 완료 · ID doc saved");
        pick = null; if (fEl) fEl.value = "";
        renderHrIdDocs(empId);
      } catch (err) {
        if (typeof showToast === "function") showToast("첨부 실패 · Upload failed");
        console.error(err);
        addEl.disabled = false;
      }
    };
    host.querySelectorAll(".hr-id-thumb").forEach(function(img) {
      img.onclick = function() {
        var w = window.open("", "_blank");
        if (w) { w.document.write('<img src="' + img.getAttribute("data-src") + '" style="max-width:100%">'); w.document.close(); }
      };
    });
    host.querySelectorAll(".hr-id-dl").forEach(function(b) {
      b.onclick = function() {
        var ref = b.getAttribute("data-ref");
        var name = b.getAttribute("data-name") || "id";
        try {
          if (typeof hrStorageDownloadFile === "function") {
            hrStorageDownloadFile(ref, name);
          }
        } catch (err) {
          console.error(err);
          if (typeof showToast === "function") showToast("다운로드 실패 · Download failed");
        }
      };
    });
    host.querySelectorAll(".hr-id-del").forEach(function(b) {
      b.onclick = async function() {
        if (!confirm("이 신분증 파일을 삭제할까요?")) return;
        var fid = b.getAttribute("data-fid");
        var ref = b.getAttribute("data-ref");
        try {
          if (ref) await hrStorageDelete(ref);
          await _hrDeleteIdDocMeta(empId, fid);
          if (typeof showToast === "function") showToast("삭제 완료 · Deleted");
          renderHrIdDocs(empId);
        } catch (err) {
          if (typeof showToast === "function") showToast("삭제 실패 · Delete failed");
          console.error(err);
        }
      };
    });
  };

})();
