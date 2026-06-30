/* ════════════════════════════════════════════════════════════
   INICS · hr.js — 인사·급여 모듈 (Firebase /hr/* + Storage)
   ════════════════════════════════════════════════════════════ */
(function() {
  var BASE       = "https://inics-approval-default-rtdb.asia-southeast1.firebasedatabase.app";
  var HR_ROOT    = "/hr";
  var HR_BUCKET  = "inics-approval.firebasestorage.app";
  var HR_MAX_CONTRACT_UPLOAD = 32 * 1024 * 1024;   /* 32MB */
  var HR_RESUMABLE_THRESHOLD = 5 * 1024 * 1024;  /* 5MB+ → resumable upload */
  var HR_IMAGE_MAX_BYTES = 2 * 1024 * 1024;      /* 이미지 압축 목표 2MB */
  function hrUrl(p) { return BASE + HR_ROOT + (p || ""); }

  var HR_SETTINGS_SEED = {
    payroll: {
      personalDed: 15500000, dependentDed: 6200000,
      empRate: { si: 0.08, hi: 0.015, ui: 0.01 },
      comRate: { si: 0.17, hi: 0.03, ai: 0.005, ui: 0.01 },
      capSIHI: 46800000, capUI: 106200000
    },
    annualLeave: 12
  };

  /** 부록 B — 3명 시드 (memberId: HANA=3, THANH BINH=7, KMON=4) */
  var HR_EMPLOYEE_SEED = [
    { id: "E01", memberId: 3,
      nameVi: "Nguyễn Xuân Hải Quỳnh", nameEn: "NGUYEN XUAN HAI QUYNH", gender: "F",
      dob: "1995-12-03", cccd: "079195011802", issued: "2023-04-15",
      issuerVi: "Bộ Công An", issuerEn: "Ministry of Public Security",
      addrVi: "121/32 Kp4, phường Trung Mỹ Tây, Thành phố Hồ Chí Minh",
      addrEn: "121/32 Kp4, Trung My Tay Ward, Ho Chi Minh City", phone: "", email: "",
      dept: "FURNITURE", positionVi: "Nhân viên", positionEn: "Staff", positionKo: "프로젝트 매니저",
      jobDescVi: "Quản lý dự án và hỗ trợ kinh doanh mảng nội thất (Furniture)",
      jobDescEn: "Furniture project management and sales support",
      joinDate: "2026-04-01", probStart: null, probEnd: null, status: "active",
      hrManaged: true, empType: "local_employee", salaryType: "NET", salary: 22000000,
      dependents: 0, si: true, pitMethod: "Prog", probPct: 1 },
    { id: "E02", memberId: 7,
      nameVi: "Nguyễn Thị Thanh Bình", nameEn: "NGUYEN THI THANH BINH", gender: "F",
      dob: "1998-02-22", cccd: "077198005576", issued: "2021-07-10",
      issuerVi: "Bộ Công An", issuerEn: "Ministry of Public Security",
      addrVi: "76 Đường số 6, Phường Linh Xuân, Thành phố Hồ Chí Minh",
      addrEn: "76 6th Street, Linh Xuan Ward, Ho Chi Minh City", phone: "", email: "",
      dept: "FINANCE", positionVi: "Nhân viên Hỗ trợ Vận hành (Hành chính – Tài chính – Mua hàng)",
      positionEn: "Business Support Officer (Administration – Finance – Purchasing)", positionKo: "경영지원·구매",
      jobDescVi: "Hỗ trợ vận hành & hành chính; phối hợp kế toán bên ngoài, kiểm soát chi phí; tìm nguồn & mua hàng (báo giá, điều khoản thương mại).",
      jobDescEn: "Operations & admin support; coordinating external accounting, cost control; sourcing & purchasing.",
      joinDate: "2026-06-15", probStart: "2026-06-15", probEnd: "2026-08-14", status: "probation",
      hrManaged: true, empType: "local_employee", salaryType: "Gross", salary: 24000000,
      dependents: 0, si: false, pitMethod: "10%", probPct: 1 },
    { id: "E03", memberId: 4,
      nameVi: "Tạ Vĩnh Quốc Khánh", nameEn: "TA VINH QUOC KHANH", gender: "M",
      dob: "2002-09-02", cccd: "082202000290", issued: "2021-03-12",
      issuerVi: "Cục Cảnh sát QLHC về TTXH (Bộ Công An)", issuerEn: "Police Dept. for Administrative Management of Social Order",
      addrVi: "220, tổ 11, Hiệp An, Hiệp Tân, Hòa Thành, Tây Ninh",
      addrEn: "220, To 11, Hiep An, Hiep Tan, Hoa Thanh, Tay Ninh", phone: "", email: "",
      dept: "FURNITURE", positionVi: "Nhân viên thiết kế", positionEn: "Designer", positionKo: "디자이너",
      jobDescVi: "Thực hiện công việc thiết kế và bản vẽ trong Công ty; thiết kế sản phẩm, đồ họa, tài liệu; hỗ trợ bản vẽ kỹ thuật theo yêu cầu.",
      jobDescEn: "Design and drafting work; product, graphic and document design; technical drawing support.",
      joinDate: "2026-05-18", probStart: "2026-05-18", probEnd: "2026-07-17", status: "probation",
      hrManaged: true, empType: "local_employee", salaryType: "Gross", salary: 16000000,
      dependents: 0, si: false, pitMethod: "10%", probPct: 0.85 }
  ];

  window.hrState = {
    employees: {}, attendance: {}, leaveBalance: {}, contracts: {}, idDocs: {}, settings: null
  };
  window.hrAppOpen = false;
  window._hrReady = false;
  window._hrTab = "emp";
  window.hrSelEmp = null;
  window.hrEditMode = false;

  window.hrModuleAllowed = function(u) {
    u = u || (typeof cardCurrentUser === "function" ? cardCurrentUser() : null);
    if (!u) return false;
    if (u.isAdmin || (typeof sessionIsAdmin !== "undefined" && sessionIsAdmin)) return true;
    if (typeof state === "undefined" || !state || !state.modulePerms) return false;
    var pk = typeof _mpk === "function" ? _mpk(u.id) : ("u" + u.id);
    return !!(state.modulePerms[pk] && state.modulePerms[pk].hr === true);
  };

  window.hrActorName = function() {
    var u = typeof cardCurrentUser === "function" ? cardCurrentUser() : null;
    return u ? u.name : "system";
  };

  window.hrEmployeesList = function() {
    var m = window.hrState.employees || {};
    return Object.keys(m).map(function(k) { return m[k]; }).filter(Boolean)
      .sort(function(a, b) { return String(a.id).localeCompare(String(b.id)); });
  };

  window.hrDepts = function() {
    var s = ((typeof state !== "undefined" && state && state.departments) || ["FURNITURE", "SOURCING"]).slice();
    hrEmployeesList().forEach(function(e) {
      if (e.dept && s.indexOf(e.dept) < 0) s.push(e.dept);
    });
    if (typeof MEMBERS !== "undefined") {
      MEMBERS.forEach(function(m) { if (m.dept && s.indexOf(m.dept) < 0) s.push(m.dept); });
    }
    return s;
  };

  window.hrFmt = function(n) { return Math.round(n || 0).toLocaleString("en-US"); };
  window.hrVnDate = function(s) { return s ? s.split("-").reverse().join("/") : ""; };
  window.hrEsc = function(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  };
  window.hrReqFields = ["nameVi", "dob", "cccd", "issued", "addrVi", "positionVi", "jobDescVi"];
  window.hrMissingOf = function(e) {
    if (!e) return [];
    return hrReqFields.filter(function(f) { return !e[f]; });
  };

  /** JPEG 압축 — 계약서 이미지는 maxBytes(기본 2MB) 이하까지 quality·크기 조절 */
  window.hrCompressImage = function(file, opts) {
    opts = opts || {};
    var maxBytes = opts.maxBytes != null ? opts.maxBytes : null;
    var maxDim = opts.maxDim || 1100;
    return new Promise(function(resolve, reject) {
      if (!file || !/^image\//.test(file.type || "")) { reject(new Error("Image only")); return; }
      if (file.size > 40 * 1024 * 1024) { reject(new Error("Too large")); return; }
      function render(dim, quality) {
        var url = URL.createObjectURL(file);
        var img = new Image();
        img.onload = function() {
          URL.revokeObjectURL(url);
          var w = img.width, h = img.height;
          var scale = Math.min(1, dim / w, dim / h);
          var cw = Math.max(1, Math.round(w * scale)), ch = Math.max(1, Math.round(h * scale));
          var cv = document.createElement("canvas"); cv.width = cw; cv.height = ch;
          cv.getContext("2d").drawImage(img, 0, 0, cw, ch);
          try {
            var dataUrl = cv.toDataURL("image/jpeg", quality);
            var est = Math.round(dataUrl.length * 0.75);
            if (maxBytes && est > maxBytes) {
              if (quality > 0.22) {
                render(dim, Math.max(0.22, quality - 0.08));
                return;
              }
              if (dim > 640) {
                render(Math.round(dim * 0.75), 0.55);
                return;
              }
            }
            resolve({ dataUrl: dataUrl, mime: "image/jpeg", w: cw, h: ch, size: est });
          } catch (err) { reject(err); }
        };
        img.onerror = function() { URL.revokeObjectURL(url); reject(new Error("Read failed")); };
        img.src = url;
      }
      render(maxDim, opts.quality != null ? opts.quality : 0.55);
    });
  };

  window.hrDataUrlToBlob = function(dataUrl) {
    var parts = dataUrl.split(",");
    var mime = (parts[0].match(/:(.*?);/) || [])[1] || "application/octet-stream";
    var bin = atob(parts[1]);
    var arr = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  };

  /** getDownloadURL() 동등 — Storage 공개 미디어 URL */
  window.hrStorageDownloadUrl = function(path, token) {
    if (!path) return "";
    var u = "https://firebasestorage.googleapis.com/v0/b/" + HR_BUCKET + "/o/"
      + encodeURIComponent(path) + "?alt=media";
    if (token) u += "&token=" + encodeURIComponent(token);
    return u;
  };

  window.hrStorageGetDownloadUrl = function(path, token) {
    return hrStorageDownloadUrl(path, token);
  };

  function _hrStorageParseUploadMeta(meta, path, ct, bodySize) {
    var token = meta.downloadTokens || meta.downloadToken || null;
    if (Array.isArray(token)) token = token[0] || null;
    var size = meta.size ? parseInt(meta.size, 10) : (bodySize || 0);
    return {
      path: path,
      downloadToken: token,
      downloadUrl: hrStorageDownloadUrl(path, token),
      contentType: meta.contentType || ct,
      size: size
    };
  }

  /** 대용량(5MB+) resumable upload — PDF 22MB 등 */
  async function _hrStorageUploadResumable(path, body, contentType) {
    var ct = contentType || "application/octet-stream";
    var size = body.size != null ? body.size : 0;
    var startUrl = "https://firebasestorage.googleapis.com/v0/b/" + HR_BUCKET + "/o?name="
      + encodeURIComponent(path) + "&uploadType=resumable";
    var startResp = await fetch(startUrl, {
      method: "POST",
      headers: {
        "Content-Type": ct,
        "X-Goog-Upload-Protocol": "resumable",
        "X-Goog-Upload-Command": "start",
        "X-Goog-Upload-Header-Content-Length": String(size),
        "X-Goog-Upload-Header-Content-Type": ct
      }
    });
    if (!startResp.ok) {
      var errText = "";
      try { errText = await startResp.text(); } catch (_) {}
      throw new Error("Resumable start HTTP " + startResp.status + (errText ? ": " + errText.slice(0, 120) : ""));
    }
    var uploadUrl = startResp.headers.get("X-Goog-Upload-URL") || startResp.headers.get("Location");
    if (!uploadUrl) throw new Error("Resumable upload URL missing");
    var uploadResp = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Length": String(size),
        "X-Goog-Upload-Command": "upload, finalize",
        "X-Goog-Upload-Offset": "0"
      },
      body: body
    });
    if (!uploadResp.ok) {
      var errText2 = "";
      try { errText2 = await uploadResp.text(); } catch (_) {}
      throw new Error("Resumable upload HTTP " + uploadResp.status + (errText2 ? ": " + errText2.slice(0, 120) : ""));
    }
    var meta = {};
    try { meta = await uploadResp.json(); } catch (_) {}
    return _hrStorageParseUploadMeta(meta, path, ct, size);
  }

  /** Storage 바이너리 업로드 (simple ≤5MB / resumable >5MB) — RTDB에 base64 저장 금지 */
  window.hrStorageUpload = async function(path, body, contentType) {
    var ct = contentType || "application/octet-stream";
    var size = body && body.size != null ? body.size : 0;
    if (size > HR_MAX_CONTRACT_UPLOAD) {
      throw new Error("File too large (max " + Math.round(HR_MAX_CONTRACT_UPLOAD / 1048576) + "MB)");
    }
    if (size > HR_RESUMABLE_THRESHOLD) {
      return _hrStorageUploadResumable(path, body, ct);
    }
    var url = "https://firebasestorage.googleapis.com/v0/b/" + HR_BUCKET + "/o?name="
      + encodeURIComponent(path) + "&uploadType=media";
    var r = await fetch(url, { method: "POST", headers: { "Content-Type": ct }, body: body });
    if (!r.ok) {
      var errText = "";
      try { errText = await r.text(); } catch (_) {}
      throw new Error("Storage HTTP " + r.status + (errText ? ": " + errText.slice(0, 120) : ""));
    }
    var meta = {};
    try { meta = await r.json(); } catch (_) {}
    return _hrStorageParseUploadMeta(meta, path, ct, size);
  };

  /** Storage downloadURL → 새 탭 (CORS 없음, embed/img 미리보기와 동일 URL) */
  window.hrStorageOpenDownload = function(storageUrl, fileName) {
    if (!storageUrl) throw new Error("No download URL");
    var a = document.createElement("a");
    a.href = storageUrl;
    a.download = fileName || "download";
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  window.hrStorageDownloadFile = function(path, fileName, token, directUrl) {
    var url = directUrl || hrStorageDownloadUrl(path, token);
    hrStorageOpenDownload(url, fileName);
  };

  window.hrStorageDelete = async function(path) {
    try {
      await fetch("https://firebasestorage.googleapis.com/v0/b/" + HR_BUCKET + "/o/"
        + encodeURIComponent(path), { method: "DELETE" });
    } catch (_) {}
  };

  /** 항목별 PATCH — 통째 덮어쓰기 금지 */
  window._hrSaveEmployee = async function(empId, data) {
    var payload = Object.assign({}, data, {
      id: empId,
      updatedAt: new Date().toISOString(),
      updatedBy: hrActorName()
    });
    var r = await fetch(hrUrl("/employees/" + encodeURIComponent(empId) + ".json"), {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!r.ok) throw new Error("Employee save HTTP " + r.status);
    if (!window.hrState.employees) window.hrState.employees = {};
    window.hrState.employees[empId] = Object.assign({}, window.hrState.employees[empId] || {}, payload);
    return payload;
  };

  window._hrDeleteEmployee = async function(empId) {
    await fetch(hrUrl("/employees/" + encodeURIComponent(empId) + ".json"), { method: "DELETE" });
    if (window.hrState.employees) delete window.hrState.employees[empId];
  };

  window._hrSaveIdDocMeta = async function(empId, fileId, meta) {
    var r = await fetch(hrUrl("/idDocs/" + encodeURIComponent(empId) + "/" + encodeURIComponent(fileId) + ".json"), {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(meta)
    });
    if (!r.ok) throw new Error("IdDoc meta HTTP " + r.status);
    if (!window.hrState.idDocs) window.hrState.idDocs = {};
    if (!window.hrState.idDocs[empId]) window.hrState.idDocs[empId] = {};
    window.hrState.idDocs[empId][fileId] = meta;
    return meta;
  };

  window._hrDeleteIdDocMeta = async function(empId, fileId) {
    await fetch(hrUrl("/idDocs/" + encodeURIComponent(empId) + "/" + encodeURIComponent(fileId) + ".json"), { method: "DELETE" });
    if (window.hrState.idDocs && window.hrState.idDocs[empId]) delete window.hrState.idDocs[empId][fileId];
  };

  window.hrIdDocsList = function(empId) {
    var node = (window.hrState.idDocs || {})[empId];
    if (!node || typeof node !== "object") return [];
    return Object.keys(node).map(function(k) { return node[k]; }).filter(Boolean)
      .sort(function(a, b) { return (b.addedAt || "").localeCompare(a.addedAt || ""); });
  };

  window.hrNextEmpId = function() {
    var max = 0;
    hrEmployeesList().forEach(function(e) {
      var n = parseInt(String(e.id || "").replace(/\D/g, ""), 10);
      if (n > max) max = n;
    });
    return "E" + String(max + 1).padStart(2, "0");
  };

  window.hrContractsList = function() {
    var m = window.hrState.contracts || {};
    return Object.keys(m).map(function(k) { return m[k]; }).filter(Boolean)
      .sort(function(a, b) { return (b.createdAt || "").localeCompare(a.createdAt || ""); });
  };

  var HR_CONTRACT_INLINE_KEYS = ["fileData", "dataUrl", "cfile", "fileContent", "scanData", "scanDataUrl", "base64"];

  function _hrSanitizeContractPayload(payload) {
    HR_CONTRACT_INLINE_KEYS.forEach(function(k) {
      if (payload[k] === null) return;
      if (typeof payload[k] === "string" && payload[k].length > 200) {
        console.warn("[HR] Removing inline " + k + " from contract payload — files must use Storage only");
        delete payload[k];
      }
    });
    return payload;
  }

  window._hrSaveContract = async function(contractId, data) {
    var now = new Date().toISOString();
    var payload = Object.assign({}, data, {
      id: contractId,
      updatedAt: now,
      updatedBy: hrActorName()
    });
    if (!payload.createdAt) payload.createdAt = now;
    if (!payload.createdBy) payload.createdBy = hrActorName();
    _hrSanitizeContractPayload(payload);
    var r = await fetch(hrUrl("/contracts/" + encodeURIComponent(contractId) + ".json"), {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!r.ok) throw new Error("Contract save HTTP " + r.status);
    if (!window.hrState.contracts) window.hrState.contracts = {};
    var merged = Object.assign({}, window.hrState.contracts[contractId] || {}, payload);
    HR_CONTRACT_INLINE_KEYS.forEach(function(k) {
      if (payload[k] === null) delete merged[k];
    });
    window.hrState.contracts[contractId] = merged;
    return merged;
  };

  window._hrDeleteContract = async function(contractId) {
    var rec = (window.hrState.contracts || {})[contractId];
    if (rec) {
      if (rec.filePath) await hrStorageDelete(rec.filePath);
      if (rec.scanPath) await hrStorageDelete(rec.scanPath);
    }
    await fetch(hrUrl("/contracts/" + encodeURIComponent(contractId) + ".json"), { method: "DELETE" });
    if (window.hrState.contracts) delete window.hrState.contracts[contractId];
  };

  window.hrContractStatus = function(rec) {
    if (!rec) return "draft";
    if (rec.status) return rec.status;
    return rec.source === "uploaded" ? "concluded" : "draft";
  };

  async function _hrSeedSettings() {
    try {
      var r = await fetch(hrUrl("/settings.json"), { cache: "no-cache" });
      var existing = r.ok ? await r.json() : null;
      if (existing && existing.payroll) return existing;
      await fetch(hrUrl("/settings.json"), {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(HR_SETTINGS_SEED)
      });
      console.log("✅ INICS HR: /hr/settings seeded");
      return HR_SETTINGS_SEED;
    } catch (e) {
      console.warn("HR settings seed:", e && e.message);
      return HR_SETTINGS_SEED;
    }
  }

  window._hrSeedEmployeesIfEmpty = async function() {
    var keys = Object.keys(window.hrState.employees || {});
    if (keys.length) return;
    console.log("⏳ INICS HR: seeding 3 employees (Appendix B)…");
    for (var i = 0; i < HR_EMPLOYEE_SEED.length; i++) {
      var e = HR_EMPLOYEE_SEED[i];
      await window._hrSaveEmployee(e.id, Object.assign({}, e, {
        createdAt: new Date().toISOString(), createdBy: "seed"
      }));
    }
    console.log("✅ INICS HR: employee seed complete");
  };

  /** legacy: RTDB inline base64 → Storage 이전 + downloadUrl 백필 */
  async function _hrMigrateLegacyContracts() {
    var contracts = window.hrState.contracts || {};
    var ids = Object.keys(contracts);
    for (var i = 0; i < ids.length; i++) {
      var id = ids[i];
      var rec = contracts[id];
      if (!rec) continue;
      try {
        if (rec.filePath && (rec.fileData || rec.dataUrl)) {
          await window._hrSaveContract(id, {
            fileData: null, dataUrl: null, cfile: null, fileContent: null
          });
        }
        if (!rec.filePath && rec.source === "uploaded" && (rec.fileData || rec.dataUrl)) {
          var inline = rec.fileData || rec.dataUrl;
          if (typeof inline === "string" && inline.indexOf("data:") === 0) {
            var blob = hrDataUrlToBlob(inline);
            var extMatch = (rec.fileName || "").match(/\.([^.]+)$/);
            var ext = extMatch ? extMatch[1].toLowerCase() : "bin";
            var path = "hr/contracts/" + id + "/original." + ext;
            var up = await hrStorageUpload(path, blob, rec.fileMime || rec.mime || blob.type);
            await window._hrSaveContract(id, {
              filePath: path,
              fileDownloadUrl: up.downloadUrl,
              fileDownloadToken: up.downloadToken,
              fileMime: up.contentType,
              fileSize: up.size,
              fileData: null, dataUrl: null, cfile: null
            });
            console.log("[HR] Migrated legacy inline contract to Storage:", id);
          }
        }
        if (rec.filePath && !rec.fileDownloadUrl) {
          await window._hrSaveContract(id, {
            fileDownloadUrl: hrStorageDownloadUrl(rec.filePath, rec.fileDownloadToken)
          });
        }
        if (rec.scanPath && !rec.scanDownloadUrl) {
          await window._hrSaveContract(id, {
            scanDownloadUrl: hrStorageDownloadUrl(rec.scanPath, rec.scanDownloadToken)
          });
        }
      } catch (e) {
        console.warn("[HR] Contract migrate skip:", id, e && e.message);
      }
    }
  }

  window._hrLoad = async function() {
    try {
      window.hrState.settings = await _hrSeedSettings();
      var nodes = ["employees", "attendance", "leaveBalance", "contracts", "idDocs"];
      for (var i = 0; i < nodes.length; i++) {
        var nr = await fetch(hrUrl("/" + nodes[i] + ".json"), { cache: "no-cache" });
        var data = nr.ok ? await nr.json() : null;
        window.hrState[nodes[i]] = (data && typeof data === "object") ? data : {};
      }
      await _hrSeedEmployeesIfEmpty();
      window._hrReady = true;
      setTimeout(function() { _hrMigrateLegacyContracts(); }, 1500);
      return window.hrState;
    } catch (e) {
      console.warn("HR load error:", e && e.message);
      window.hrState.settings = HR_SETTINGS_SEED;
      window._hrReady = true;
      return window.hrState;
    }
  };

  window.hrSwitchTab = function(tab) {
    window._hrTab = tab;
    var tabs = [
      { key: "emp", title: "직원 인적사항 / Employees" },
      { key: "pay", title: "급여대장 / Payroll" },
      { key: "att", title: "출결·휴가 / Attendance & Leave" },
      { key: "con", title: "계약서 / Contracts" }
    ];
    tabs.forEach(function(t) {
      var v = document.getElementById("hrView-" + t.key);
      if (v) v.style.display = t.key === tab ? "block" : "none";
      var btn = document.getElementById("hrTab-" + t.key);
      if (btn) {
        btn.style.fontWeight = t.key === tab ? "600" : "400";
        btn.style.borderBottom = t.key === tab ? "2px solid var(--text)" : "2px solid transparent";
        btn.style.color = t.key === tab ? "var(--text)" : "var(--text-2)";
      }
      if (t.key === tab) {
        var titleEl = document.getElementById("hrPageTitle");
        if (titleEl) titleEl.textContent = t.title;
      }
    });
    if (tab === "emp" && typeof renderHrEmp === "function") renderHrEmp();
    if (tab === "pay" && typeof renderHrPay === "function") renderHrPay();
    if (tab === "att" && typeof renderHrAtt === "function") renderHrAtt();
    if (tab === "con") {
      if (typeof renderHrCon === "function") {
        renderHrCon();
      } else {
        var conRoot = document.getElementById("hrView-con");
        if (conRoot) {
          var msg = window._hrConScriptFailed
            ? "js/hr-con.js 를 서버에서 찾을 수 없습니다 (404). GitHub Pages에 js/hr-con.js 파일을 배포했는지 확인하세요."
            : "js/hr-con.js 가 로드되지 않았거나 실행 중 오류가 났습니다. F12 Console의 빨간 에러를 확인하세요.";
          conRoot.innerHTML = '<div class="form-card" style="padding:24px;color:var(--danger)">'
            + '<b>계약서 모듈 로드 실패</b><br><span style="font-size:12px;color:var(--text-2)">'
            + msg + '<br><br>Ctrl+F5 강력 새로고침 · 로컬이면 index.html과 같은 폴더에 js/hr-con.js(약 45KB)가 있어야 합니다.</span></div>';
        }
        console.error("renderHrCon is not defined — check Network: js/hr-con.js status (404?)");
      }
    }
  };

  window.showHrApp = async function() {
    if (!hrModuleAllowed()) {
      if (typeof showToast === "function") showToast("접근 권한이 없습니다 · No access");
      if (typeof showHub === "function") showHub();
      return;
    }
    hrAppOpen = true;
    var hub = document.getElementById("hubPage"); if (hub) hub.style.display = "none";
    var app = document.getElementById("hrApp"); if (app) app.style.display = "block";
    var u = typeof cardCurrentUser === "function" ? cardCurrentUser() : null;
    var nameEl = document.getElementById("hrUserName"); if (nameEl && u) nameEl.textContent = u.name;
    var avEl = document.getElementById("hrAvatarChip");
    if (avEl && u && typeof getAvatar === "function") avEl.innerHTML = getAvatar(u.id, "sm");
    if (!window._hrReady) await _hrLoad();
    var asofIn = document.getElementById("hrAsofInput");
    if (asofIn) window.hrAsof = asofIn.value || "2026-06-30";
    hrSwitchTab(window._hrTab || "emp");
    window.scrollTo(0, 0);
  };

  window.closeHrApp = function() {
    hrAppOpen = false;
    hrSelEmp = null; hrEditMode = false;
    var app = document.getElementById("hrApp"); if (app) app.style.display = "none";
    if (typeof showHub === "function") showHub();
  };

  window.HR_MAX_CONTRACT_UPLOAD = HR_MAX_CONTRACT_UPLOAD;
  window.HR_IMAGE_MAX_BYTES = HR_IMAGE_MAX_BYTES;

  window._hrInitDone = true;
})();
