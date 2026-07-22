/* ═══════════════════════════════════════════════════════════════
   INICS 본사 주간 보고 모듈 · HQ Weekly Report  (Stage 1-4 통합)
   섹션: 채산 / 프로젝트 / 업무  ·  USD 환산 · PDF · Outlook 이메일
   재사용: window.chasanLoadAll / chasanCompute / chasanForecast · state.projects · state.tasks
   ═══════════════════════════════════════════════════════════════ */
(function () {
  var LOGO = "data:image/png;base64,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";
  var DEPTS = ["FUR VN", "FUR MX", "SOURCING", "COMMON"];
  var REV_DEPTS = ["FUR VN", "FUR MX", "SOURCING"];
  var DCOLOR = { "FUR VN": "#2563eb", "FUR MX": "#16a34a", "SOURCING": "#d97706", "COMMON": "#6b7280" };

  function F(n) { return (typeof hrFmt === "function") ? hrFmt(n) : Math.round(n || 0).toLocaleString("en-US"); }
  function E(s) { return (typeof hrEsc === "function") ? hrEsc(s) : String(s == null ? "" : s); }

  var _weekMon = null, _usd = false, _rate = 0, _mxText = "";
  var _types = { chasan: true, project: true, task: true, mx: true };

  function _mondayOf(d) { d = new Date(d); var k = (d.getDay() + 6) % 7; d.setDate(d.getDate() - k); d.setHours(0, 0, 0, 0); return d; }
  function _iso(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function _fmtD(d) { return (d.getMonth() + 1) + "월 " + d.getDate() + "일"; }
  function _dOnly(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function _weekRange() { var mon = _weekMon || _mondayOf(new Date()); var sun = new Date(mon); sun.setDate(mon.getDate() + 6); return { mon: mon, sun: sun }; }
  function _nextYm(ym) { var y = +ym.slice(0, 4), m = +ym.slice(5, 7) + 1; if (m > 12) { m = 1; y++; } return y + "-" + String(m).padStart(2, "0"); }

  // ── 통화 ──
  function _fmtUSD(v) { return "$" + Math.round(v || 0).toLocaleString("en-US"); }
  function MV(vnd) { return (_usd && _rate) ? _fmtUSD((vnd || 0) / _rate) : F(vnd); }
  function _unitLabel() { return (_usd && _rate) ? ("USD @" + F(_rate)) : "VND"; }

  window.hqrWeekNav = function (delta) { var m = _weekMon || _mondayOf(new Date()); m = new Date(m); m.setDate(m.getDate() + delta * 7); _weekMon = m; _renderShell(); };
  window.hqrToday = function () { _weekMon = _mondayOf(new Date()); _renderShell(); };
  window.hqrToggleType = function (k, on) { _types[k] = !!on; };
  function _mxKey() { return "hqr_mx_" + _iso(_weekRange().mon); }
  function _loadMx() { try { return localStorage.getItem(_mxKey()) || ""; } catch (e) { return _mxText || ""; } }
  window.hqrMxInput = function (v) { _mxText = v || ""; try { localStorage.setItem(_mxKey(), _mxText); } catch (e) {} };
  window.hqrSetUsd = function (on) { _usd = !!on; if (_usd && !_rate) { alert("VND/USD 환율을 입력하세요."); _usd = false; var e = document.getElementById("hqrUsd"); if (e) e.checked = false; return; } _regen(); };
  window.hqrSetRate = function (v) { _rate = +v || 0; if (_usd) _regen(); };
  function _regen() { var out = document.getElementById("hqrOutput"); if (out && /hqrPaper/.test(out.innerHTML || "")) hqrGenerate(); }

  function _ensure() {
    var app = document.getElementById("hqReportApp");
    if (app) return app;
    app = document.createElement("div");
    app.id = "hqReportApp";
    app.style.cssText = "display:none;position:fixed;inset:0;background:var(--bg);z-index:500;overflow-y:auto";
    document.body.appendChild(app);
    return app;
  }
  window.showHqReportApp = function () {
    var hub = document.getElementById("hubPage"); if (hub) hub.style.display = "none";
    var app = _ensure(); app.style.display = "block";
    if (!_weekMon) _weekMon = _mondayOf(new Date());
    _renderShell(); window.scrollTo(0, 0);
  };
  window.closeHqReportApp = function () { var app = document.getElementById("hqReportApp"); if (app) app.style.display = "none"; if (typeof showHub === "function") showHub(); };

  function _chip(k, label, color) {
    var on = _types[k];
    return '<label style="display:inline-flex;align-items:center;gap:7px;border:1.5px solid ' + (on ? color : "var(--border)") + ';background:' + (on ? color + "12" : "transparent") + ';color:' + (on ? color : "var(--text-2)") + ';padding:8px 14px;border-radius:10px;cursor:pointer;font-size:13px;font-weight:600;user-select:none">'
      + '<input type="checkbox" ' + (on ? "checked" : "") + ' onchange="hqrToggleType(\'' + k + '\',this.checked)" style="accent-color:' + color + '"> ' + label + '</label>';
  }

  function _renderShell() {
    var app = _ensure(); var wr = _weekRange(); _mxText = _loadMx();
    var u = (typeof cardCurrentUser === "function") ? cardCurrentUser() : null;
    app.innerHTML =
      '<div style="max-width:920px;margin:0 auto;padding:18px 20px 60px">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px">'
      +   '<button onclick="closeHqReportApp()" style="border:1px solid var(--border);background:none;color:var(--text-2);font-size:13px;cursor:pointer;padding:7px 13px;border-radius:8px"><i class="ti ti-arrow-left"></i> 허브 · Hub</button>'
      +   '<div style="font-size:12px;color:var(--text-3)">' + (u ? E(u.name) : "") + '</div>'
      + '</div>'
      + '<div style="font-size:20px;font-weight:700;letter-spacing:-.02em;margin-bottom:4px">본사 주간 보고 · HQ Weekly Report</div>'
      + '<div style="font-size:12px;color:var(--text-3);margin-bottom:18px">주와 항목을 선택하고 [보고서 생성] → 로고 포함 통합 보고서. USD 환산·PDF·Outlook 이메일 지원.</div>'
      + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;flex-wrap:wrap">'
      +   '<button onclick="hqrWeekNav(-1)" style="border:1px solid var(--border);background:none;cursor:pointer;padding:7px 11px;border-radius:8px"><i class="ti ti-chevron-left"></i></button>'
      +   '<div style="font-size:14px;font-weight:700;min-width:200px;text-align:center">' + _fmtD(wr.mon) + ' ~ ' + _fmtD(wr.sun) + '<div style="font-size:10px;color:var(--text-3);font-weight:400">' + _iso(wr.mon) + ' ~ ' + _iso(wr.sun) + ' (월~일)</div></div>'
      +   '<button onclick="hqrWeekNav(1)" style="border:1px solid var(--border);background:none;cursor:pointer;padding:7px 11px;border-radius:8px"><i class="ti ti-chevron-right"></i></button>'
      +   '<button onclick="hqrToday()" style="border:1px solid var(--border);background:none;color:var(--text-3);cursor:pointer;padding:7px 11px;border-radius:8px;font-size:12px">이번 주</button>'
      + '</div>'
      + '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px">'
      +   _chip("chasan", "채산 · P&L", "#7c3aed") + _chip("project", "프로젝트 · Projects", "#0891b2") + _chip("task", "업무 · Tasks", "#15803d") + _chip("mx", "멕시코 지원 · MX Support", "#ea580c")
      + '</div>'
      + '<div style="margin-bottom:14px"><label style="font-size:12px;color:var(--text-3);display:block;margin-bottom:5px">멕시코 법인 도움 요청 · Requests to MX <span style="color:var(--text-3)">(한 줄에 하나씩 · one per line)</span></label>'
      +   '<textarea id="hqrMx" oninput="hqrMxInput(this.value)" placeholder="예: MX 재고 현황 공유 요청&#10;제품 X 리드타임 확인 요청" style="width:100%;box-sizing:border-box;min-height:70px;border:1px solid var(--border);border-radius:8px;padding:8px 10px;font-size:13px;font-family:var(--sans);resize:vertical">' + E(_mxText) + '</textarea></div>'
      + '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:14px">'
      +   '<label style="font-size:12px;color:var(--text-3);display:flex;align-items:center;gap:6px"><input type="checkbox" id="hqrUsd" ' + (_usd ? "checked" : "") + ' onchange="hqrSetUsd(this.checked)"> USD 환산 · Convert</label>'
      +   '<input id="hqrRate" type="number" placeholder="VND/USD 환율" value="' + (_rate || "") + '" onchange="hqrSetRate(this.value)" style="width:140px;border:1px solid var(--border);border-radius:6px;padding:6px 8px;font-size:12px">'
      + '</div>'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap">'
      +   '<button onclick="hqrGenerate()" style="border:none;background:var(--text);color:var(--bg);font-size:14px;font-weight:700;cursor:pointer;padding:11px 22px;border-radius:10px"><i class="ti ti-file-text"></i> 보고서 생성 · Generate</button>'
      +   '<button onclick="hqrPDF()" style="border:1px solid var(--border);background:none;color:var(--text-2);font-size:13px;cursor:pointer;padding:11px 16px;border-radius:10px"><i class="ti ti-file-type-pdf"></i> PDF 저장</button>'
      +   '<button onclick="hqrEmail()" style="border:1px solid var(--border);background:none;color:var(--text-2);font-size:13px;cursor:pointer;padding:11px 16px;border-radius:10px"><i class="ti ti-mail"></i> Outlook 이메일</button>'
      + '</div>'
      + '<div id="hqrOutput" style="margin-top:20px"></div>'
      + '</div>';
  }

  async function _hqrForeignConfirmed() {
    try {
      var all = await window.chasanLoadAll();
      var fin = Object.keys(all).filter(function (k) { return /^\d{4}-\d{2}$/.test(k) && all[k] && all[k].finalizedAt; }).sort();
      if (!fin.length) return { list: [], nym: null };
      var nym = _nextYm(fin[fin.length - 1]);
      var invs = (typeof state !== "undefined" && state && state.invoices) || [];
      var list = invs.filter(function (v) { if (!(v && v.dir === "issued" && String(v.date || "").slice(0, 7) === nym && String(v.currency || "VND").toUpperCase() !== "VND")) return false; var fx = parseFloat(String(v.fxRate == null ? (v.rate == null ? "" : v.rate) : v.fxRate).replace(/[^0-9.]/g, "")) || 0; return !(fx > 0); });
      return { list: list, nym: nym };
    } catch (e) { return { list: [], nym: null }; }
  }
  window.hqrGenerate = async function () {
    var out = document.getElementById("hqrOutput"); if (!out) return;
    if (!_types.chasan && !_types.project && !_types.task && !_types.mx) { out.innerHTML = '<div style="color:var(--text-3);font-size:13px;padding:20px;text-align:center">항목을 하나 이상 선택하세요.</div>'; return; }
    var _mxEl = document.getElementById("hqrMx"); if (_mxEl) _mxText = _mxEl.value;
    if (_types.chasan) {
      var _fcf = await _hqrForeignConfirmed();
      if (_fcf.list.length && !(_rate > 0)) {
        var _ans = window.prompt("\uB2E4\uC74C\uB2EC(" + _fcf.nym + ") \uD655\uC815\uB9E4\uCD9C\uC5D0 \uC678\uD654(USD) \uC778\uBCF4\uC774\uC2A4 " + _fcf.list.length + "\uAC74\uC774 \uC788\uC2B5\uB2C8\uB2E4.\nVND\uB85C \uD658\uC0B0\uD560 \uD658\uC728(VND/USD)\uC744 \uC785\uB825\uD558\uC138\uC694:", "26000");
        var _rr = parseFloat(String(_ans == null ? "" : _ans).replace(/[^0-9.]/g, "")) || 0;
        if (!(_rr > 0)) { out.innerHTML = '<div style="color:var(--danger);font-size:13px;padding:20px;text-align:center">\uD658\uC728\uC774 \uC785\uB825\uB418\uC9C0 \uC54A\uC544 \uBCF4\uACE0\uC11C \uC0DD\uC131\uC744 \uCDE8\uC18C\uD588\uC2B5\uB2C8\uB2E4. VND/USD \uD658\uC728 \uC785\uB825 \uD6C4 \uB2E4\uC2DC \uC0DD\uC131\uD558\uC138\uC694.</div>'; return; }
        _rate = _rr; var _re = document.getElementById("hqrRate"); if (_re) _re.value = _rate;
      }
    }
    out.innerHTML = '<div style="color:var(--text-3);font-size:13px;padding:20px;text-align:center">보고서 작성 중… · Building…</div>';
    var wr = _weekRange();
    var body = _reportHeader(wr);
    try {
      if (_types.chasan) body += await _sectionChasan();
      if (_types.project) body += _sectionProject();
      if (_types.task) body += _sectionTask();
      if (_types.mx) body += _sectionMx();
    } catch (e) { body += '<div style="color:var(--danger);padding:16px">섹션 로드 실패: ' + E(e && e.message) + '</div>'; }
    out.innerHTML = '<div id="hqrPaper" style="background:#fff;border:1px solid var(--border);border-radius:14px;padding:26px 28px;box-shadow:0 1px 3px rgba(0,0,0,.05)">' + body + '</div>';
  };

  function _reportHeader(wr) {
    return '<div style="display:flex;align-items:flex-start;justify-content:space-between;border-bottom:2px solid var(--text);padding-bottom:14px;margin-bottom:6px">'
      + '<div><img src="' + LOGO + '" alt="INICS VINA" style="height:30px;width:auto;display:block;margin-bottom:8px">'
      +   '<div style="font-size:17px;font-weight:700">본사 주간 보고서 · Weekly HQ Report</div>'
      +   '<div style="font-size:12px;color:var(--text-3);margin-top:2px">보고 주간 · Week: ' + _fmtD(wr.mon) + ' ~ ' + _fmtD(wr.sun) + ' (' + _iso(wr.mon) + ' ~ ' + _iso(wr.sun) + ')' + ((_usd && _rate) ? ' · 통화 USD @' + F(_rate) : '') + '</div>'
      + '</div>'
      + '<div style="text-align:right;font-size:11px;color:var(--text-3)">작성일 · Issued<br><b style="color:var(--text-2);font-size:12px">' + _iso(new Date()) + '</b><br>INICS VINA CO., LTD.</div>'
      + '</div>';
  }
  function _sectionTitle(txt, color) { return '<div style="display:flex;align-items:center;gap:8px;margin:24px 0 12px"><span style="width:4px;height:18px;background:' + color + ';border-radius:2px;display:inline-block"></span><span style="font-size:15px;font-weight:700">' + txt + '</span></div>'; }
  function _kpi(label, val, color, override) { return '<div style="border:1px solid var(--border);border-radius:10px;padding:10px 12px"><div style="font-size:10px;color:var(--text-3);margin-bottom:3px">' + label + '</div><div style="font-family:var(--mono);font-size:15px;font-weight:700;color:' + color + '">' + (override != null ? override : F(val)) + '</div></div>'; }

  // ── 채산 ──
  async function _sectionChasan() {
    var all = await window.chasanLoadAll();
    var fin = Object.keys(all).filter(function (k) { return /^\d{4}-\d{2}$/.test(k) && all[k] && all[k].finalizedAt && all[k].byDept && all[k].totals; }).sort();
    if (!fin.length) return _sectionTitle("채산 · Departmental P&L", "#7c3aed") + '<div style="font-size:12px;color:var(--text-3);padding:12px">확정된 월별 채산이 없습니다. 채산 모듈에서 월 확정 후 반영됩니다.</div>';
    var ym = fin[fin.length - 1], snap = all[ym], year = ym.slice(0, 4);
    DEPTS.forEach(function (d) { var b = snap.byDept[d]; if (b) b.gross = (+b.revenue || 0) - (+b.cogs || 0); });
    snap.totals.gross = (+snap.totals.revenue || 0) - (+snap.totals.cogs || 0);
    var ytd = { revenue: 0, cogs: 0, labor: 0, opex: 0, extra: 0, op: 0 };
    fin.filter(function (k) { return k.slice(0, 4) === year; }).forEach(function (k) { var t = all[k].totals || {}; ["revenue", "cogs", "labor", "opex", "extra", "op"].forEach(function (x) { ytd[x] += +t[x] || 0; }); });
    ytd.gross = ytd.revenue - ytd.cogs;
    var fc = null;
    try {
      if (typeof chasanFcCfgLoad === "function") await chasanFcCfgLoad();
      if (typeof chasanFixedLoad === "function") await chasanFixedLoad();
      if (typeof chasanLwLoad === "function") await chasanLwLoad();
      if (typeof chasanCogsVendorsLoad === "function") await chasanCogsVendorsLoad();
      if (typeof chasanExtraLoad === "function") await chasanExtraLoad(ym);
      var r = await window.chasanCompute(ym); fc = window.chasanForecast(ym, r);
    } catch (e) { fc = null; }

    var LINES = [["매출 · Revenue", "revenue", 0], ["(−) 매입원가 · COGS", "cogs", 0], ["= 매출총이익 · Gross Profit", "gross", 1], ["(−) 인건비 · Labor", "labor", 0], ["(−) 판관비 · OpEx", "opex", 0], ["(−) EXTRA", "extra", 0], ["= 영업이익 · OP", "op", 2]];
    var th = '<th style="text-align:left;padding:7px 10px;font-size:10px;color:var(--text-3)">항목 · Item</th>' + DEPTS.map(function (d) { return '<th style="text-align:right;padding:7px 10px;font-size:10px;color:' + DCOLOR[d] + '">' + E(d) + '</th>'; }).join("") + '<th style="text-align:right;padding:7px 10px;font-size:10px;color:var(--text-2);border-left:2px solid var(--text-3)">합계 · Total</th>';
    var rows = LINES.map(function (ln) {
      var lbl = ln[0], key = ln[1], em = ln[2];
      var rst = em === 2 ? 'border-top:2px solid var(--text);font-weight:700' : (em === 1 ? 'border-top:1px solid var(--border);background:var(--surface-2);font-weight:600' : '');
      var lc = em === 1 ? ';color:#1d4ed8' : '';
      var cells = DEPTS.map(function (d) { var v = (snap.byDept[d] || {})[key] || 0; return '<td style="text-align:right;padding:7px 10px;font-family:var(--mono)' + (v < 0 ? ';color:var(--danger)' : lc) + '">' + MV(v) + '</td>'; }).join("");
      var tv = snap.totals[key] || 0;
      var tc = '<td style="text-align:right;padding:7px 10px;font-family:var(--mono);font-weight:700;border-left:2px solid var(--text-3)' + (tv < 0 ? ';color:var(--danger)' : lc) + '">' + MV(tv) + '</td>';
      return '<tr style="' + rst + '"><td style="padding:7px 10px' + lc + '">' + lbl + '</td>' + cells + tc + '</tr>';
    }).join("");
    var opMargin = snap.totals.revenue ? (snap.totals.op / snap.totals.revenue * 100).toFixed(1) + "%" : "—";

    var h = _sectionTitle("채산 · Departmental P&L", "#7c3aed");
    h += '<div style="font-size:12px;color:var(--text-3);margin-bottom:8px">최근 확정월 · Latest finalized: <b style="color:var(--text-2)">' + E(ym) + '</b> · 영업이익률 ' + opMargin + ' · 단위 ' + _unitLabel() + '</div>';
    h += '<div style="overflow-x:auto;margin-bottom:16px"><table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:var(--surface-2)">' + th + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
    h += '<div style="font-size:13px;font-weight:700;margin:12px 0 8px">연 누적 · YTD ' + year + ' <span style="font-size:11px;color:var(--text-3);font-weight:400">(확정월 합계, 전체)</span></div>';
    h += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;margin-bottom:16px">'
      + _kpi("매출 · Revenue", null, "#111827", MV(ytd.revenue))
      + _kpi("매출총이익 · Gross", null, "#1d4ed8", MV(ytd.gross))
      + _kpi("영업이익 · OP", null, ytd.op < 0 ? "#dc2626" : "#15803d", MV(ytd.op))
      + _kpi("영업이익률 · OP%", null, "#6b7280", ytd.revenue ? (ytd.op / ytd.revenue * 100).toFixed(1) + "%" : "—")
      + '</div>';
    h += '<div style="font-size:13px;font-weight:700;margin:14px 0 8px">\uD83D\uDCD1 \uBD80\uC11C\uBCC4 \uC190\uC775 \u00B7 \uC6D4\uBCC4 & \uB204\uC801 \u00B7 Monthly & YTD (' + ((_usd && _rate) ? 'USD' : 'VND') + ' \u00B7 COMMON \uBC30\uBD84)</div>';
    h += (typeof window.chasanBuildYtdFsTable === 'function' ? window.chasanBuildYtdFsTable(year, { usd: _usd, rate: _rate, all: all }) : '') + '<div style="height:6px"></div>';
    if (fc) {
      var nym = _nextYm(ym);
      var fLines = [["(−) 인건비 · Labor", "labor"], ["(−) 고정판관비 · Fixed OpEx", "fixedOpex"], ["(−) 변동판관비 · Variable OpEx", "varOpex"]];
      var fth = '<th style="text-align:left;padding:7px 10px;font-size:10px;color:var(--text-3)">항목 · Item</th>' + REV_DEPTS.map(function (d) { return '<th style="text-align:right;padding:7px 10px;font-size:10px;color:' + DCOLOR[d] + '">' + E(d) + '</th>'; }).join("") + '<th style="text-align:right;padding:7px 10px;font-size:10px;color:var(--text-2);border-left:2px solid var(--text-3)">합계</th>';
      var frows = fLines.map(function (ln) {
        var cells = REV_DEPTS.map(function (d) { return '<td style="text-align:right;padding:7px 10px;font-family:var(--mono)">' + MV((fc.byDept[d] || {})[ln[1]] || 0) + '</td>'; }).join("");
        return '<tr><td style="padding:7px 10px">' + ln[0] + '</td>' + cells + '<td style="text-align:right;padding:7px 10px;font-family:var(--mono);font-weight:700;border-left:2px solid var(--text-3)">' + MV(fc.totals[ln[1]] || 0) + '</td></tr>';
      }).join("");
      var bepCells = REV_DEPTS.map(function (d) { return '<td style="text-align:right;padding:8px 10px;font-family:var(--mono);font-weight:700;color:#7c3aed">' + MV((fc.byDept[d] || {}).bepRev || 0) + '</td>'; }).join("");
      var bepRow = '<tr style="border-top:2px solid var(--text)"><td style="padding:8px 10px;font-weight:700;color:#7c3aed">🎯 BEP 목표매출 · Target Rev</td>' + bepCells + '<td style="text-align:right;padding:8px 10px;font-family:var(--mono);font-weight:700;color:#7c3aed;border-left:2px solid var(--text-3)">' + MV(fc.totals.bepRev || 0) + '</td></tr>';
      // (1) 확정매출 = 다음달(nym) 발행 인보이스 기준 · 실시간
      var _cfIssued = ((typeof state !== "undefined" && state && state.invoices) || []).filter(function (v) { return v && v.dir === "issued" && String(v.date || "").slice(0, 7) === nym; });
      function _cfRev(v) { var s = parseFloat(String(v.subtotal == null ? "" : v.subtotal).replace(/[^0-9.\-]/g, "")); if (!(s > 0)) s = parseFloat(String(v.total == null ? "" : v.total).replace(/[^0-9.\-]/g, "")) || 0; var c = String(v.currency || "VND").toUpperCase(); if (c !== "VND") { var fx = parseFloat(String(v.fxRate == null ? (v.rate == null ? "" : v.rate) : v.fxRate).replace(/[^0-9.\-]/g, "")) || 0; if (!(fx > 0)) fx = _rate; if (fx > 0) s = s * fx; } return Math.round(s); }
      var _cfByDept = {}; REV_DEPTS.forEach(function (d) { _cfByDept[d] = 0; }); var _cfTot = 0;
      _cfIssued.forEach(function (v) { var r = _cfRev(v); _cfTot += r; var _d = (v.chasanDept && REV_DEPTS.indexOf(v.chasanDept) >= 0) ? v.chasanDept : "FUR VN"; _cfByDept[_d] += r; });
      var _cfCells = REV_DEPTS.map(function (d) { return '<td style="text-align:right;padding:8px 10px;font-family:var(--mono);color:#15803d">' + MV(_cfByDept[d]) + '</td>'; }).join("");
      var _bepTot = fc.totals.bepRev || 0, _cfPct = _bepTot > 0 ? Math.round(_cfTot / _bepTot * 100) : 0;
      var _cfRow = '<tr style="border-top:1px solid var(--border)"><td style="padding:8px 10px;font-weight:700;color:#15803d">\u2705 확정매출 · Confirmed <span style="font-size:9px;font-weight:400;color:var(--text-3)">발행 인보이스·실시간</span></td>' + _cfCells + '<td style="text-align:right;padding:8px 10px;font-family:var(--mono);font-weight:700;color:#15803d;border-left:2px solid var(--text-3)">' + MV(_cfTot) + (_bepTot > 0 ? (' <span style="font-size:9px;color:var(--text-3)">달성 ' + _cfPct + '%</span>') : '') + '</td></tr>';
      h += '<div style="font-size:13px;font-weight:700;margin:12px 0 8px">다음달 예상채산 · Next-month Forecast (' + E(nym) + ') <span style="font-size:11px;color:var(--text-3);font-weight:400">공헌이익률 ' + Math.round((fc.cm || 0) * 100) + '% · 손익분기 목표매출</span></div>';
      h += '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:var(--surface-2)">' + fth + '</tr></thead><tbody>' + frows + bepRow + _cfRow + '</tbody></table></div>';
    } else { h += '<div style="font-size:11px;color:var(--text-3);padding:6px 0">※ 다음달 예상채산은 채산 모듈을 한 번 연 뒤 다시 생성하면 표시됩니다.</div>'; }
    return h;
  }

  // ── 프로젝트 ──
  function _amt(p) { return Math.round(parseFloat(String(p.amount == null ? "" : p.amount).replace(/[^0-9.\-]/g, "")) || 0); }
  function _cur(p) { return p.currency || "VND"; }
  function _parseAt(x) { if (!x) return null; var m = String(x).match(/(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})/); if (!m) return null; var d = new Date(+m[1], +m[2] - 1, +m[3]); return isNaN(d.getTime()) ? null : d; }
  function _deliveredDate(p) {
    var hist = p.stageHistory || [];
    var dts = hist.filter(function (h) { return h && h.stage === "delivered"; }).map(function (h) { return _parseAt(h.at); }).filter(Boolean);
    if (dts.length) return new Date(Math.max.apply(null, dts.map(function (d) { return d.getTime(); })));
    if (p.stage === "delivered") return _parseAt(p.targetDate) || _parseAt(p.regDate) || null;
    return null;
  }
  function _inRange(d, a, b) { if (!d) return false; var t = _dOnly(d).getTime(); return t >= a.getTime() && t <= b.getTime(); }
  function _sumCur(arr) { var m = {}; arr.forEach(function (p) { var c = _cur(p); m[c] = (m[c] || 0) + _amt(p); }); return m; }
  function _fmtCur(m) { var ks = Object.keys(m).filter(function (k) { return m[k]; }); if (!ks.length) return "0"; return ks.map(function (k) { return F(m[k]) + " " + k; }).join(" · "); }
  function _amtUSD(p) { var a = _amt(p); return _cur(p) === "USD" ? a : (_rate ? a / _rate : 0); }
  function _dispAmt(p) { return (_usd && _rate) ? _fmtUSD(_amtUSD(p)) : (F(_amt(p)) + " " + _cur(p)); }
  function _dispSum(arr) { if (_usd && _rate) return _fmtUSD(arr.reduce(function (s, p) { return s + _amtUSD(p); }, 0)); return _fmtCur(_sumCur(arr)); }
  var PSTAGES = [["lead", "리드 · Lead", "#64748b"], ["contact", "컨택 · Contact", "#0891b2"], ["quote", "견적 · Quote", "#4338ca"], ["nego", "수주협의 · Nego", "#7c3aed"], ["won", "수주확정 · Won", "#1d4ed8"], ["po", "PO완료 · PO", "#b45309"]];

  function _sectionProject() {
    var projects = (typeof state !== "undefined" && state && state.projects) || [];
    var wr = _weekRange(); var mon = _dOnly(wr.mon), sun = _dOnly(wr.sun);
    var now = new Date(); var yStart = new Date(now.getFullYear(), 0, 1), yEnd = new Date(now.getFullYear(), 11, 31);
    var mStart = new Date(now.getFullYear(), now.getMonth(), 1), mEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    var delivered = projects.map(function (p) { return { p: p, d: _deliveredDate(p) }; }).filter(function (o) { return o.d; });
    var wkDeliv = delivered.filter(function (o) { return _inRange(o.d, mon, sun); }).sort(function (a, b) { return b.d - a.d; });
    var ytdDeliv = delivered.filter(function (o) { return _inRange(o.d, yStart, yEnd); });
    var moDeliv = delivered.filter(function (o) { return _inRange(o.d, mStart, mEnd); });

    var h = _sectionTitle("프로젝트 · Projects", "#0891b2");
    h += '<div style="font-size:13px;font-weight:700;margin:6px 0 8px">진행 파이프라인 · Active Pipeline <span style="font-size:11px;color:var(--text-3);font-weight:400">(올해 ' + now.getFullYear() + ' · 단계별 건수·금액)</span></div>';
    var prows = PSTAGES.map(function (st) { var arr = projects.filter(function (p) { return p.stage === st[0]; });
      return '<tr><td style="padding:6px 10px"><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:' + st[2] + ';margin-right:7px"></span>' + st[1] + '</td><td style="text-align:right;padding:6px 10px;font-family:var(--mono)">' + arr.length + '</td><td style="text-align:right;padding:6px 10px;font-family:var(--mono)">' + _dispSum(arr) + '</td></tr>';
    }).join("");
    var activeAll = projects.filter(function (p) { return PSTAGES.some(function (s2) { return s2[0] === p.stage; }); });
    prows += '<tr style="border-top:2px solid var(--text);font-weight:700"><td style="padding:6px 10px">진행중 합계 · Total in progress</td><td style="text-align:right;padding:6px 10px;font-family:var(--mono)">' + activeAll.length + '</td><td style="text-align:right;padding:6px 10px;font-family:var(--mono)">' + _dispSum(activeAll) + '</td></tr>';
    h += '<div style="overflow-x:auto;margin-bottom:6px"><table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:var(--surface-2)"><th style="text-align:left;padding:6px 10px;font-size:10px;color:var(--text-3)">단계 · Stage</th><th style="text-align:right;padding:6px 10px;font-size:10px;color:var(--text-3)">건수 · Count</th><th style="text-align:right;padding:6px 10px;font-size:10px;color:var(--text-3)">금액 · Amount</th></tr></thead><tbody>' + prows + '</tbody></table></div>';
    var holdN = projects.filter(function (p) { return p.stage === "hold"; }).length, lostN = projects.filter(function (p) { return p.stage === "lost"; }).length;
    h += '<div style="font-size:11px;color:var(--text-3);margin-bottom:16px">보류 · On-hold ' + holdN + '건 · 드롭 · Lost ' + lostN + '건 (합계 제외)</div>';

    // (3) 단계 변경 상세 — 보고월 내 stageHistory 이벤트 전체 (전 단계 · 신규등록 포함)
    var _rMon = _dOnly(wr.mon), _rmStart = new Date(_rMon.getFullYear(), _rMon.getMonth(), 1), _rmEnd = new Date(_rMon.getFullYear(), _rMon.getMonth() + 1, 0), _rmLbl = (_rMon.getMonth() + 1) + "월";
    var _EXTRA = [["delivered", "납품완료 · Delivered", "#15803d"], ["hold", "보류 · Hold", "#6b7280"], ["lost", "드롭 · Lost", "#b91c1c"]];
    var _detStages = PSTAGES.concat(_EXTRA);
    // 프로젝트당 1건 — 보고기간 내 마지막 이동만 표기 (중간 경유 단계는 표시 안 함)
    var _evtByStage = {};
    _detStages.forEach(function (st) { _evtByStage[st[0]] = []; });
    projects.forEach(function (p) {
      var hist = (p.stageHistory || []).filter(function (x) { return x && x.stage; });
      var last = null, nMoves = 0;
      hist.forEach(function (x) {
        var d = _parseAt(x.at); if (!d || !_inRange(d, _rmStart, _rmEnd)) return;
        if (!_evtByStage[x.stage]) return;
        nMoves++;
        if (last && last.d > d) return;
        last = { p: p, d: d, stage: x.stage, first: !!x.first };
      });
      // stageHistory 자체가 없는 레거시·임포트 건은 등록일 기준으로 현 단계 1건 보정
      if (!hist.length && _evtByStage[p.stage]) {
        var rd = _parseAt(p.regDate) || _parseAt(p.createdAt);
        if (rd && _inRange(rd, _rmStart, _rmEnd)) { last = { p: p, d: rd, stage: p.stage, first: true, legacy: true }; nMoves = 1; }
      }
      if (last) { last.moves = nMoves; _evtByStage[last.stage].push(last); }
    });
    var _evtTot = _detStages.reduce(function (n, st) { return n + _evtByStage[st[0]].length; }, 0);
    h += '<div style="font-size:13px;font-weight:700;margin:14px 0 6px">단계 변경 상세 · Stage Changes <span style="font-size:11px;color:var(--text-3);font-weight:400">(' + _rmLbl + ' 변경 ' + _evtTot + '건 · 프로젝트당 최종 이동 1건 · 신규등록 포함)</span></div>';
    _detStages.forEach(function (st) {
      var evs = _evtByStage[st[0]].slice().sort(function (a, b) { return b.d - a.d; });
      var inStage = projects.filter(function (p) { return p.stage === st[0]; });
      var chIds = {}; evs.forEach(function (x) { chIds[x.p.id] = 1; });
      var etcN = inStage.filter(function (p) { return !chIds[p.id]; }).length;
      if (!evs.length && !inStage.length) return;
      h += '<div style="font-size:12px;font-weight:700;margin:8px 0 4px;color:' + st[2] + '">' + st[1] + ' <span style="font-weight:400;color:var(--text-3)">(' + _rmLbl + ' 변경 ' + evs.length + '건' + (etcN > 0 ? (' · 기타 ' + etcN + '건') : '') + ')</span></div>';
      if (evs.length) {
        var _rws = evs.map(function (x) {
          var p = x.p, cur = (p.stage === st[0]);
          var kind = x.first ? '<span style="color:#0891b2">신규등록</span>' : '<span style="color:var(--text-2)">단계이동</span>';
          if (x.moves > 1) kind += ' <span style="font-size:9px;color:var(--text-3)">(' + x.moves + '회 중 최종)</span>';
          if (!cur) kind += ' <span style="font-size:9px;color:var(--text-3)">→ ' + E((PSTAGES.concat(_EXTRA).filter(function (s3) { return s3[0] === p.stage; })[0] || ["", p.stage])[1]) + '</span>';
          return '<tr><td style="padding:5px 10px">' + E(p.client || "—") + '</td><td style="padding:5px 10px;color:var(--text-2)">' + E(p.type || p.note || "—") + '</td><td style="padding:5px 10px;color:var(--text-3)">' + E(p.region || "") + '</td><td style="text-align:right;padding:5px 10px;font-family:var(--mono)">' + _dispAmt(p) + '</td><td style="padding:5px 10px;font-size:10px">' + kind + '</td><td style="text-align:right;padding:5px 10px;color:var(--text-2)">' + _iso(x.d) + '</td></tr>';
        }).join("");
        h += '<div style="overflow-x:auto;margin-bottom:4px"><table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:var(--surface-2)"><th style="text-align:left;padding:5px 10px;font-size:10px;color:var(--text-3)">고객사 · Client</th><th style="text-align:left;padding:5px 10px;font-size:10px;color:var(--text-3)">프로젝트 · Type</th><th style="text-align:left;padding:5px 10px;font-size:10px;color:var(--text-3)">지역</th><th style="text-align:right;padding:5px 10px;font-size:10px;color:var(--text-3)">금액 · Amount</th><th style="text-align:left;padding:5px 10px;font-size:10px;color:var(--text-3)">구분</th><th style="text-align:right;padding:5px 10px;font-size:10px;color:var(--text-3)">변경일 · Date</th></tr></thead><tbody>' + _rws + '</tbody></table></div>';
      } else { h += '<div style="font-size:11px;color:var(--text-3);padding:2px 0 4px">' + _rmLbl + ' 변경 건 없음' + (etcN > 0 ? (' · 기타 ' + etcN + '건(이전 변경)') : '') + '</div>'; }
    });

    // (5) 누적 납품 = 발행 인보이스(issued) 기준
    var _issued = ((typeof state !== "undefined" && state && state.invoices) || []).filter(function (v) { return v && v.dir === "issued"; });
    function _invN(v) { var s = parseFloat(String(v.subtotal == null ? "" : v.subtotal).replace(/[^0-9.\-]/g, "")); if (!(s > 0)) s = parseFloat(String(v.total == null ? "" : v.total).replace(/[^0-9.\-]/g, "")) || 0; return Math.round(s); }
    function _invC(v) { return v.currency || "VND"; }
    function _invU(v) { return _invC(v) === "USD" ? _invN(v) : (_rate ? _invN(v) / _rate : 0); }
    function _invSumD(arr) { if (_usd && _rate) return _fmtUSD(arr.reduce(function (s, v) { return s + _invU(v); }, 0)); var m = {}; arr.forEach(function (v) { var c = _invC(v); m[c] = (m[c] || 0) + _invN(v); }); return _fmtCur(m); }
    function _invDate(v) { return _parseAt(v.date) || _parseAt(v.issueDate) || null; }
    var _moInv = _issued.filter(function (v) { return _inRange(_invDate(v), mStart, mEnd); });
    var _ytdInv = _issued.filter(function (v) { return _inRange(_invDate(v), yStart, yEnd); });
    h += '<div style="font-size:13px;font-weight:700;margin:14px 0 8px">누적 납품 · Cumulative Delivered <span style="font-size:11px;color:var(--text-3);font-weight:400">(발행 인보이스 기준 · Issued invoices)</span></div>';
    h += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px">'
      + _kpi("이번 달 건수 · Month (" + (now.getMonth() + 1) + "월)", _moInv.length, "#0891b2")
      + _kpi("이번 달 금액 · Amount", null, "#0891b2", _invSumD(_moInv))
      + _kpi("올해 건수 · YTD " + now.getFullYear(), _ytdInv.length, "#111827")
      + _kpi("올해 금액 · Amount", null, "#111827", _invSumD(_ytdInv))
      + '</div>';
    return h;
  }

  // ── 업무 ──
  var TSIG = { green: ["#15803d", "정상 · On track"], yellow: ["#b45309", "확인 필요 · Needs check"], red: ["#b91c1c", "문제 · Issue"] };
  function _sigDot(sig) { var x = TSIG[sig] || TSIG.green; return '<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:' + x[0] + '" title="' + x[1] + '"></span>'; }
  function _tType(t) { return (typeof taskTypeLabel === "function") ? taskTypeLabel(t.taskType) : (t.taskType || ""); }

  function _sectionTask() {
    var tasks = ((typeof state !== "undefined" && state && state.tasks) || []).filter(function (t) { return t && !t._deleted; });
    var wr = _weekRange(); var mon = _dOnly(wr.mon), sun = _dOnly(wr.sun);
    var doneWk = tasks.filter(function (t) { return t.status === "done" && _inRange(_parseAt(t.closedDate), mon, sun); }).sort(function (a, b) { return String(a.userName || "").localeCompare(String(b.userName || "")); });
    var sigOrder = { red: 0, yellow: 1, green: 2 };
    var open = tasks.filter(function (t) { return t.status !== "done"; }).sort(function (a, b) { var d = (sigOrder[a.signal] == null ? 3 : sigOrder[a.signal]) - (sigOrder[b.signal] == null ? 3 : sigOrder[b.signal]); if (d) return d; return String(a.userName || "").localeCompare(String(b.userName || "")); });
    var sc = { green: 0, yellow: 0, red: 0 }; open.forEach(function (t) { if (sc[t.signal] != null) sc[t.signal]++; });

    var h = _sectionTitle("업무 · Tasks", "#15803d");
    h += '<div style="font-size:13px;font-weight:700;margin:6px 0 8px">이번 주 완료 업무 · Completed this week <span style="font-size:11px;color:var(--text-3);font-weight:400">(' + doneWk.length + '건)</span></div>';
    if (doneWk.length) {
      var drows = doneWk.map(function (t) {
        return '<tr><td style="padding:6px 10px">' + E(t.userName || "—") + '</td><td style="padding:6px 10px">' + E(t.doneNote || t.title || "—") + '</td><td style="padding:6px 10px;color:var(--text-3)">' + E(_tType(t)) + '</td><td style="text-align:center;padding:6px 10px">' + _sigDot(t.signal) + '</td><td style="text-align:right;padding:6px 10px;color:var(--text-2)">' + E(t.closedDate || "") + (t.estHours ? ' <span style="color:var(--text-3)">' + E(t.estHours) + 'h</span>' : '') + '</td></tr>';
      }).join("");
      h += '<div style="overflow-x:auto;margin-bottom:16px"><table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:var(--surface-2)"><th style="text-align:left;padding:6px 10px;font-size:10px;color:var(--text-3)">담당 · Member</th><th style="text-align:left;padding:6px 10px;font-size:10px;color:var(--text-3)">완료 내용 · Done</th><th style="text-align:left;padding:6px 10px;font-size:10px;color:var(--text-3)">유형</th><th style="text-align:center;padding:6px 10px;font-size:10px;color:var(--text-3)">신호</th><th style="text-align:right;padding:6px 10px;font-size:10px;color:var(--text-3)">완료일 · Date</th></tr></thead><tbody>' + drows + '</tbody></table></div>';
    } else { h += '<div style="font-size:12px;color:var(--text-3);padding:8px 0 16px">이번 주 완료 업무 없음.</div>'; }

    h += '<div style="font-size:13px;font-weight:700;margin:6px 0 8px">진행중 업무 · In progress <span style="font-size:11px;color:var(--text-3);font-weight:400">(' + open.length + '건 · <span style="color:#15803d">\u25cf' + sc.green + '</span> <span style="color:#b45309">\u25cf' + sc.yellow + '</span> <span style="color:#b91c1c">\u25cf' + sc.red + '</span>)</span></div>';
    if (open.length) {
      var orows = open.map(function (t) {
        return '<tr><td style="padding:6px 10px">' + E(t.userName || "—") + '</td><td style="padding:6px 10px">' + E(t.title || "—") + '</td><td style="padding:6px 10px;color:var(--text-3)">' + E(_tType(t)) + '</td><td style="text-align:center;padding:6px 10px">' + _sigDot(t.signal) + '</td><td style="text-align:right;padding:6px 10px;color:var(--text-2)">' + E(t.startDate || "") + '</td></tr>';
      }).join("");
      h += '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:var(--surface-2)"><th style="text-align:left;padding:6px 10px;font-size:10px;color:var(--text-3)">담당 · Member</th><th style="text-align:left;padding:6px 10px;font-size:10px;color:var(--text-3)">업무 · Task</th><th style="text-align:left;padding:6px 10px;font-size:10px;color:var(--text-3)">유형</th><th style="text-align:center;padding:6px 10px;font-size:10px;color:var(--text-3)">신호</th><th style="text-align:right;padding:6px 10px;font-size:10px;color:var(--text-3)">시작일 · Start</th></tr></thead><tbody>' + orows + '</tbody></table></div>';
    } else { h += '<div style="font-size:12px;color:var(--text-3);padding:8px 0">진행중 업무 없음.</div>'; }
    return h;
  }

  // ── PDF (html2canvas + jsPDF, 멀티페이지 A4) ──
  window.hqrPDF = function () {
    var paper = document.getElementById("hqrPaper");
    if (!paper) { alert("먼저 [보고서 생성]을 눌러 보고서를 만든 뒤 PDF로 저장하세요."); return; }
    if (typeof html2canvas === "undefined" || !window.jspdf) { alert("PDF 모듈 로드 실패 (네트워크 확인)"); return; }
    var wrap = document.createElement("div");
    wrap.style.cssText = "position:fixed;left:-9999px;top:0;width:794px;background:#fff;padding:24px";
    wrap.innerHTML = paper.innerHTML;
    document.body.appendChild(wrap);
    html2canvas(wrap, { scale: 2, backgroundColor: "#ffffff", useCORS: true }).then(function (canvas) {
      var pdf = new window.jspdf.jsPDF("p", "mm", "a4");
      var W = wrap.offsetWidth || 794, mmPerCss = 210 / W, marginMm = 8, usableMm = 297 - marginMm * 2;
      var scale = canvas.width / W, usablePx = Math.round((usableMm / mmPerCss) * scale);
      var Hpx = canvas.height, ctx2 = canvas.getContext("2d"), imgData = null;
      try { imgData = ctx2.getImageData(0, 0, canvas.width, Hpx); } catch (e) { imgData = null; }   // taint 시 고정분할로 폴백
      function _blankRow(y) { if (!imgData) return false; var d = imgData.data, w = canvas.width, b = y * w * 4; for (var x = 0; x < w; x += 4) { var i = b + x * 4; if (d[i] < 245 || d[i + 1] < 245 || d[i + 2] < 245) return false; } return true; }
      function _safeCut(target, minY) { var back = Math.round((target - minY) * 0.22); for (var y = target; y > target - back && y > minY + 2; y--) { if (_blankRow(y)) return y; } return target; }   // 글자 줄 사이 빈 띄에서 절단(줄 안 끕김)
      var startPx = 0, first = true, guard = 0;
      while (startPx < Hpx - 1 && guard++ < 200) {
        var targetPx = Math.min(startPx + usablePx, Hpx);
        var cutPx = (targetPx >= Hpx) ? Hpx : _safeCut(targetPx, startPx);
        var slicePx = Math.max(1, cutPx - startPx);
        var sc = document.createElement("canvas"); sc.width = canvas.width; sc.height = slicePx;
        sc.getContext("2d").drawImage(canvas, 0, startPx, canvas.width, slicePx, 0, 0, canvas.width, slicePx);
        if (!first) pdf.addPage();
        pdf.addImage(sc.toDataURL("image/jpeg", 0.92), "JPEG", 0, marginMm, 210, (slicePx / scale) * mmPerCss);
        first = false; startPx = cutPx;
      }
      pdf.save("INICS_HQ_Report_" + _iso(_weekRange().mon) + ".pdf");
      document.body.removeChild(wrap);
    }).catch(function (e) { if (wrap.parentNode) document.body.removeChild(wrap); alert("PDF 생성 실패: " + (e && e.message)); });
  };

  // ── Outlook 이메일 (서식본 클립보드 복사 + 작성창 오픈, 본문 평문 자동 기입) ──
  function _plain(node) {
    var t = "";
    (node.childNodes ? Array.prototype.slice.call(node.childNodes) : []).forEach(function (c) {
      if (c.nodeType === 3) { t += c.textContent; }
      else if (c.nodeType === 1) {
        var tag = c.tagName.toLowerCase();
        if (tag === "tr") { var cs = []; c.querySelectorAll("td,th").forEach(function (d) { cs.push((d.textContent || "").trim()); }); t += cs.join("  |  ") + "\n"; }
        else if (tag === "br") { t += "\n"; }
        else if (tag === "table") { t += _plain(c) + "\n"; }
        else { var inner = _plain(c); t += inner; if (/^(div|h1|h2|h3|p)$/.test(tag) && inner && !/\n$/.test(inner)) t += "\n"; }
      }
    });
    return t;
  }
  window.hqrEmail = async function () {
    var paper = document.getElementById("hqrPaper");
    if (!paper) { alert("먼저 [보고서 생성]을 눌러 보고서를 만든 뒤 이메일로 보내세요."); return; }
    var wr = _weekRange();
    var subj = "[INICS VINA] 본사 주간 보고 · Weekly HQ Report (" + _iso(wr.mon) + " ~ " + _iso(wr.sun) + ")";
    var plain = _plain(paper).replace(/\n{3,}/g, "\n\n").trim();
    var html = '<div style="font-family:Arial,Helvetica,sans-serif">' + paper.innerHTML + '</div>';
    var copied = false;
    try {
      if (navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([new ClipboardItem({ "text/html": new Blob([html], { type: "text/html" }), "text/plain": new Blob([plain], { type: "text/plain" }) })]);
        copied = true;
      }
    } catch (e) { copied = false; }
    var note = copied ? "※ 서식 있는 보고서 전체가 클립보드에 복사되었습니다. 본문을 클릭한 뒤 Ctrl+V(⌘V)로 붙여넣으면 표까지 그대로 들어갑니다.\n\n── 평문 요약 ──\n" : "";
    var body = note + plain;
    var mailto = "mailto:?subject=" + encodeURIComponent(subj) + "&body=" + encodeURIComponent(body.slice(0, 1800));
    window.location.href = mailto;   // OS 기본 메일앱(= Outlook classic) 작성창 오픈
    if (typeof showToast === "function") showToast(copied ? "Outlook classic 작성창 오픈 · 본문에 Ctrl+V로 서식본 붙여넣기" : "Outlook classic 작성창 오픈 (평문 요약 자동 기입)");
  };

  function _sectionMx() {
    var lines = String(_mxText || "").split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean);
    var h = _sectionTitle("멕시코 지원 요청 · MX Support Requests", "#ea580c");
    if (!lines.length) { h += '<div style="font-size:12px;color:var(--text-3);padding:8px 0">이번 주 요청 사항 없음.</div>'; return h; }
    h += '<div style="border:1px solid var(--border);border-left:4px solid #ea580c;border-radius:0 10px 10px 0;padding:12px 16px;background:#fff7ed"><ol style="margin:0;padding-left:20px;font-size:13px;line-height:1.9;color:var(--text-2)">' + lines.map(function (l) { return '<li style="margin-bottom:3px">' + E(l) + '</li>'; }).join("") + '</ol></div>';
    return h;
  }
})();
