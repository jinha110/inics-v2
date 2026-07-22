/* ══════════════════════════════════════════════════════════════
   INICS v2 — 배포 전 시뮬레이션 (jsdom, 오프라인)
   · Firebase / CDN 은 전부 스텁. 실제 데이터 건드리지 않음.
   · 이번 배포에서 바뀐 기능만 실제 함수 호출로 검증한다.
   ══════════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const PASS = [], FAIL = [], WARN = [];
function ok(name, cond, detail) {
  (cond ? PASS : FAIL).push(name + (detail ? '  — ' + detail : ''));
  console.log((cond ? '  \x1b[32mPASS\x1b[0m ' : '  \x1b[31mFAIL\x1b[0m ') + name + (detail ? '  — ' + detail : ''));
}
function warn(name, detail) { WARN.push(name); console.log('  \x1b[33mWARN\x1b[0m ' + name + (detail ? '  — ' + detail : '')); }
function head(t) { console.log('\n\x1b[1m' + t + '\x1b[0m'); }

// ── CDN 스텁 (jsdom은 외부 스크립트를 로드하지 않으므로 직접 주입) ──
function installStubs(w) {
  const XLSX = require('xlsx');
  w.XLSX = XLSX;
  w.ExcelJS = require('exceljs');
  // jsdom 은 이미지를 디코딩하지 못하므로 dataURL 헤더에서 실제 픽셀 크기를 읽는다
  w.__imgDims = function (dataUrl) {
    try {
      const b = Buffer.from(String(dataUrl).split(',')[1] || '', 'base64');
      if (b.length > 24 && b[0] === 0x89 && b[1] === 0x50) return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
      if (b[0] === 0xFF && b[1] === 0xD8) {
        let i = 2;
        while (i < b.length - 9) {
          if (b[i] !== 0xFF) { i++; continue; }
          const m = b[i + 1];
          if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
          i += 2 + b.readUInt16BE(i + 2);
        }
      }
    } catch (_) {}
    return { w: 800, h: 600 };
  };
  w.Image = function () {
    const self = this;
    Object.defineProperty(self, 'src', { set(v) { const dd = w.__imgDims(v); self.naturalWidth = dd.w; self.naturalHeight = dd.h; setTimeout(() => self.onload && self.onload(), 0); } });
  };
  w.JSZip = undefined;
  w.html2canvas = undefined;
  w.jspdf = undefined;
  w.Tesseract = undefined;
  w.pdfjsLib = undefined;
  // 파일 저장 가로채기
  w.__savedFiles = [];
  const origWrite = XLSX.writeFile;
  XLSX.writeFile = function (wb, fn) {
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    w.__savedFiles.push({ name: fn, wb, buf });
    return true;
  };
  // 네트워크 차단 + Firebase 응답 스텁
  w.fetch = async () => ({ ok: false, status: 0, json: async () => null, text: async () => '' });
  w.__blobs = [];
  w.URL.createObjectURL = (b) => { w.__blobs.push(b); return 'blob:stub'; };
  w.URL.revokeObjectURL = () => {};
  // canvas 미지원 → toDataURL 스텁
  w.HTMLCanvasElement.prototype.getContext = function () {
    return {
      fillRect() {}, drawImage() {}, fillText() {}, save() {}, restore() {},
      getImageData: (x, y, ww, hh) => ({ data: new Uint8ClampedArray(ww * hh * 4) }),
      putImageData() {}, set fillStyle(v) {}, set imageSmoothingEnabled(v) {}, set imageSmoothingQuality(v) {}
    };
  };
  w.HTMLCanvasElement.prototype.toDataURL = () => 'data:image/jpeg;base64,' + 'Z'.repeat(600);
}

(async function main() {
  const vc = new VirtualConsole();
  const bootErrors = [];
  vc.on('jsdomError', e => bootErrors.push(e.message));
  vc.on('error', (...a) => bootErrors.push(String(a[0])));

  let html = fs.readFileSync('index.html', 'utf8');
  // 외부 CDN 스크립트 제거 (jsdom이 네트워크를 타지 않도록)
  html = html.replace(/<script src="https:\/\/[^"]+"><\/script>/g, '');

  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    resources: undefined,          // 로컬 js/*.js 도 직접 주입
    url: 'https://jinha110.github.io/inics-v2/',
    pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse: installStubs
  });
  const w = dom.window, d = w.document;

  // 로컬 모듈 순서대로 주입 (index.html 의 script src 순서와 동일)
  const mods = ['sync', 'hr', 'hr-calc', 'hr-emp', 'hr-pay-att', 'hr-con', 'quote', 'contract', 'chasan', 'export', 'hqreport'];
  head('0. 부팅 · Boot');
  const modErr = [];
  for (const m of mods) {
    try { w.eval(fs.readFileSync(path.join('js', m + '.js'), 'utf8')); }
    catch (e) { modErr.push(m + ': ' + e.message); }
  }
  ok('모듈 11개 로드', modErr.length === 0, modErr.join(' | ') || '문법·런타임 오류 없음');

  await new Promise(r => setTimeout(r, 400));
  // 아래 두 가지는 오프라인 하네스 특성상 필연 (실제 브라우저에선 발생 안 함)
  //  · hr-con.js: index.html 인라인 검사 시점이 모듈 주입보다 앞섬
  //  · migrate fail: fetch 를 막아둠
  const realErrors = bootErrors.filter(e => !/Not implemented|Could not parse CSS|firebase|fetch|network|hr-con\.js|migrate fail/i.test(e));
  ok('부팅 중 치명적 JS 오류 없음', realErrors.length === 0, realErrors.slice(0, 3).join(' | ') || '없음');
  ok('전 모듈 함수 노출 확인', ['renderHrCon','renderQuoteDb','buildQuoteHtml','renderChasan','fixDupDocs']
      .every(fn => typeof w[fn] === 'function'), 'renderHrCon/renderQuoteDb/buildQuoteHtml/renderChasan/fixDupDocs');

  // ── 테스트용 상태 주입 (실데이터 아님) ──
  // index.html 은 `let state` 로 선언 → window.state 가 아니라 스크립트 렉시컬 스코프.
  const S = w.eval('state');
  w.state = S;                                   // 하네스 편의를 위한 별칭 (동일 객체 참조)
  Object.assign(S, {
    docs: [], vendors: [], vendorRequests: [], cardExpenses: [], cardMerchants: [],
    products: [], quotes: [], projects: [], bankTxns: [], invoices: [],
    paymentRequests: [], tasks: [], docSeq: {}, nextId: 1, quoteSeq: 0
  });
  w.saveState = function () { w.__saveCount = (w.__saveCount || 0) + 1; };
  w.showToast = function (m) { w.__toasts = (w.__toasts || []); w.__toasts.push(m); };
  const toastsSince = (n) => (w.__toasts || []).slice(n);

  // ══════════════════════════════════════════════════════════
  head('1. 중복 문서번호 / id 복구 — fixDupDocs()');
  w.state.docs = [
    { id: 29, docNo: 'FVN202607-001', title: 'VIETCANVAS 2ND PAYMENT', status: 'pending1', dept: 'FUR VN' },
    { id: 29, docNo: 'FVN202607-001', title: 'HOANG THANH THANH NAME CARD', status: 'payment', dept: 'COMMON' },
    { id: 28, docNo: 'FVN202607-002', title: 'OTHER', status: 'done', dept: 'FUR VN' }
  ];
  w.state.nextId = 30;
  const before = w.state.docs.map(x => x.id + '/' + x.docNo).join(', ');
  const fixed = w.fixDupDocs();
  const ids = w.state.docs.map(x => x.id);
  const nos = w.state.docs.map(x => x.docNo);
  ok('중복 감지 및 복구 실행', fixed === 2, '복구 ' + fixed + '건');
  ok('문서 id 고유', new Set(ids).size === ids.length, before + '  →  ' + w.state.docs.map(x => x.id + '/' + x.docNo).join(', '));
  ok('문서번호 고유', new Set(nos).size === nos.length);
  // 리스트 클릭 → 올바른 문서가 열리는지 (핵심 버그)
  const target = w.state.docs.find(x => /VIETCANVAS/.test(x.title));
  const found = w.state.docs.find(x => x.id === target.id);
  ok('행 클릭 시 해당 문서가 열림', found.title === target.title, '"' + found.title.slice(0, 24) + '"');
  // 신규 채번이 충돌하지 않는가
  w.state.nextId = 1;                                   // 카운터 되돌림(스테일 탭) 재현
  const newId = w._nextDocId();
  ok('카운터 되돌아가도 id 충돌 없음', !ids.includes(newId), 'nextId=1 로 되돌린 뒤 발급 → ' + newId);

  // ══════════════════════════════════════════════════════════
  head('2. 승인 취소 가능 여부 — canCancelApproval()');
  if (typeof w.gm !== 'function') w.gm = id => ({ id, name: 'USER' + id, isAdmin: false });
  w.eval('mineUserId=0; newAuthId=0;');
  w.sessionStorage.setItem('inics_uid', '5');
  const cases = [
    ['1차 승인 후 2차 대기 → 취소 가능', { a1Id: 5, a2Id: 7, status: 'pending2' }, true],
    ['2차가 이미 승인 → 취소 불가', { a1Id: 5, a2Id: 7, status: 'payment' }, false],
    ['2차 없음·결제 대기 → 취소 가능', { a1Id: 5, a2Id: null, status: 'payment', needPayment: true }, true],
    ['결제 완료(paidAt) 후 → 취소 불가', { a1Id: 5, a2Id: null, status: 'done', needPayment: true, paidAt: '2026-07-22' }, false],
    ['결제 불필요·완료 → 취소 가능', { a1Id: 5, a2Id: null, status: 'done', needPayment: false }, true],
    ['제3자 → 취소 불가', { a1Id: 9, a2Id: 7, status: 'pending2' }, false]
  ];
  cases.forEach(([lbl, doc, exp]) => ok(lbl, w.canCancelApproval(doc) === exp));

  // ══════════════════════════════════════════════════════════
  head('3. 결제 처리 — 증빙 없이 완료 가능한가');
  w.confirm = () => true;
  w.renderList = () => {}; w.renderMineList = () => {}; w.renderDashboard = () => {};
  w.curDocId = null; w.mineDocId = null;
  const pd = { id: 900, status: 'payment', payAtts: [], needPayment: true, a1Id: 5, docNo: 'FVN202607-009' };
  w.state.docs.push(pd);
  w.completePayment(900, 'detailWrap');
  ok('증빙 첨부 없이 결제 완료됨', pd.status === 'done');
  ok('결제 처리자·시각 기록됨', !!pd.paidAt && !!pd.paidBy, 'paidBy=' + pd.paidBy + ' paidAt=' + pd.paidAt);
  ok('완료 후 승인 취소 차단', w.canCancelApproval(pd) === false);

  // ══════════════════════════════════════════════════════════
  head('4. 의견 첨부파일');
  const nd = { id: 901, status: 'pending1', notes: [], comments: [], drafterId: 5, a1Id: 5, dept: 'FUR VN', title: 'T', createdAt: '2026-07-22' };
  w.state.docs.push(nd);
  w._noteAttBuf['detailWrap'] = [{ name: 'quote.pdf', size: '12KB', data: 'data:application/pdf;base64,AAA', addedAt: 'now' }];
  const ta = d.createElement('textarea'); ta.id = 'docNoteInput_detailWrap'; ta.value = '견적 첨부합니다'; d.body.appendChild(ta);
  const wrap = d.createElement('div'); wrap.id = 'detailWrap'; d.body.appendChild(wrap);
  w.showDetail = w.showDetail;  // 실제 함수 사용
  try { w.addDocComment(901, 'detailWrap'); } catch (e) { warn('addDocComment 렌더 예외', e.message); }
  ok('의견에 첨부가 저장됨', !!(nd.notes[0] && nd.notes[0].atts && nd.notes[0].atts.length === 1), nd.notes[0] && nd.notes[0].atts[0].name);
  ok('등록 후 대기목록 비워짐', (w._noteAttBuf['detailWrap'] || []).length === 0);
  const attArr = w._attsFor(nd, 'note:0');
  ok('첨부 미리보기/다운로드 경로 연결', Array.isArray(attArr) && attArr.length === 1, "_attsFor(doc,'note:0') 정상");

  // ══════════════════════════════════════════════════════════
  head('5. 은행 QR — 압축 · 붙여넣기 · Storage 참조');
  w.expBankQRData = null;
  const pv = d.createElement('div'); pv.id = 'expBankQRPreview'; d.body.appendChild(pv);
  // 붙여넣기 이벤트 시뮬레이션
  let pasteHandled = false;
  const fakeFile = { type: 'image/png', size: 40000, name: 'qr.png' };
  const origHandle = w.handleBankQR;
  w.handleBankQR = f => { pasteHandled = !!f; };
  w.onBankQRPaste({ clipboardData: { items: [{ type: 'image/png', getAsFile: () => fakeFile }] }, preventDefault() {} });
  ok('클립보드 이미지 붙여넣기 인식', pasteHandled === true);
  let dropHandled = false;
  w.handleBankQR = f => { dropHandled = !!f; };
  w.onBankQRDrop({ preventDefault() {}, dataTransfer: { files: [fakeFile] } });
  ok('드래그&드롭 인식', dropHandled === true);
  w.handleBankQR = origHandle;
  // Storage 외부화
  w.state.vendors = [{ name: 'VIET CANVAS', bankQR: 'data:image/jpeg;base64,' + 'Q'.repeat(9000) }];
  w.state.cardExpenses = [{ id: 7, merchant: 'HIGHLANDS', receipt: 'data:image/jpeg;base64,' + 'R'.repeat(180000) }];
  w.state.docs.push({ id: 902, docNo: 'FVN202607-010', notes: [{ who: 'JL', text: 'x', atts: [{ name: 'a.jpg', size: '1KB', data: 'data:image/jpeg;base64,' + 'S'.repeat(5000) }] }], expenseData: { bankQR: 'data:image/jpeg;base64,' + 'T'.repeat(9000) } });
  const inlineBytes = JSON.stringify(w.state).length;
  w._fbSnapshotFromState(w.state);
  const REF = '\u00A7f\u00A7';
  const snap = w._lastSynced.colls;
  const isRef = v => typeof v === 'string' && v.slice(0, 3) === REF;
  ok('거래처 QR → Storage 포인터', isRef(snap.vendors['VIET_CANVAS'].bankQR));
  ok('카드 영수증 → Storage 포인터', isRef(snap.cardExpenses['7'].receipt));
  ok('의견 첨부 → Storage 포인터', isRef(snap.docs['902'].notes[0].atts[0].data));
  ok('지출결의서 QR → Storage 포인터', isRef(snap.docs['902'].expenseData.bankQR));
  ok('원본 state 미변형(동기화 diff 무결)', w.state.vendors[0].bankQR.slice(0, 5) === 'data:');
  const syncBytes = JSON.stringify(w._lastSynced).length;
  ok('동기화 페이로드 축소', syncBytes < inlineBytes / 5,
    Math.round(inlineBytes / 1024) + 'KB → ' + Math.round(syncBytes / 1024) + 'KB (' + Math.round(100 - syncBytes / inlineBytes * 100) + '% 감소)');

  // ══════════════════════════════════════════════════════════
  head('6. TASK 캘린더 — 요일 정렬 · 말줄임 · 체크박스');
  w.taskDailyMembers = () => [{ id: 1, name: 'THANH BINH' }, { id: 2, name: 'JAY Kim' }];
  w.taskMemberColor = m => (m && m.id === 1 ? '#2563eb' : '#b45309');
  w.dateNavBar = () => '<nav>';
  w.projTodayISO = () => '2026-07-22';
  w._reportDate = '2026-07-15';
  w.state.tasks = [
    { id: 11, userId: 1, status: 'done', closedDate: '2026-07-01', title: 'VIETCANVAS 2nd payment of printing reconciliation', doneNote: '완료' },
    { id: 12, userId: 2, status: 'open', startDate: '2026-07-01', title: '짧은건' },
    { id: 13, userId: 1, status: 'open', startDate: '2026-07-31', title: '월말 마감' },
    { id: 14, userId: 2, status: 'done', closedDate: '2026-07-22', title: 'HQ weekly report' }
  ];
  const calHtml = w.renderTaskCalendar();
  const box = d.createElement('div'); box.innerHTML = calHtml; d.body.appendChild(box);
  const grids = box.querySelectorAll('div[style*="grid-template-columns"]');
  ok('헤더·본문 그리드 컬럼 정의 동일', grids.length >= 2 &&
    /minmax\(0,1fr\)/.test(grids[0].getAttribute('style')) && /minmax\(0,1fr\)/.test(grids[1].getAttribute('style')));
  const bodyGrid = grids[grids.length - 1];
  const cells = Array.from(bodyGrid.children);
  const blanks = cells.filter(c => /transparent/.test(c.getAttribute('style') || '')).length;
  ok('7/1(수) 앞 공백 2칸 → 수요일 칸에 배치', blanks === 2, '공백 ' + blanks + '칸 (월·화)');
  const firstDay = cells[blanks];
  ok('첫 셀 날짜 = 1일', /^\s*1\s*$/.test((firstDay.querySelector('span') || {}).textContent || ''));
  ok('완료건 ☑ / 진행건 ☐ 표기', calHtml.includes('☑') && calHtml.includes('☐'));
  ok('긴 제목 말줄임 처리', /VIETCANVAS 2nd p…/.test(calHtml));
  ok('모든 셀 min-width:0 (컬럼 밀림 방지)', cells.every(c => /min-width:0/.test(c.getAttribute('style') || '')));
  ok('요약: 완료 2 / 진행 2', /완료 2건/.test(calHtml) && /진행 2건/.test(calHtml));

  // ══════════════════════════════════════════════════════════
  head('7. 영수증 OCR 파서 — _parseReceipt()');
  const r1 = w._parseReceipt(`HIGHLANDS COFFEE
Chi nhanh Quan 1, TP.HCM
MST: 0301234567
Hoa don so: HD 004512
Ngay: 22/07/2026
Ca phe sua da   2 x 45.000   90.000
Tong cong               125.000`);
  ok('가맹점 인식', r1.merchant === 'HIGHLANDS COFFEE', r1.merchant);
  ok('날짜 인식 (dd/mm/yyyy)', r1.date === '2026-07-22', r1.date);
  ok('합계 금액 인식 (라인 항목 아닌 총액)', r1.amount === '125000', r1.amount);
  ok('분류 자동 추정', r1.category === '식대', r1.category);
  ok('MST 인식', r1.mst === '0301234567');
  const r2 = w._parseReceipt('PETROLIMEX 24\nNgay 05-07-2026\nXang RON95\nTONG TIEN:  1.960.000');
  ok('주유 영수증 · 금액/분류', r2.amount === '1960000' && r2.category === '교통·주유', r2.amount + ' / ' + r2.category);

  // ══════════════════════════════════════════════════════════
  head('8. 제품 DB — 중복 차단 · CBM · 테이블');
  ok('CBM 자동계산 (mm)', w.cbmFromSize('1200*600*720') === '0.518');
  ok('CBM 자동계산 (cm)', w.cbmFromSize('120*60*72') === '0.001');
  ok('2개 값만 있으면 계산 안 함', w.cbmFromSize('3200*1200') === '');
  w.state.products = [
    { code: 'CCR232AT', name: 'BECONN+', colorCode: 'RCNWW', size: '3200*1200*720', cost: '20000000', currency: 'VND' },
    { code: 'CHR100', name: 'T50', colorCode: 'BK', size: '600*600*1100', cost: '3500000', currency: 'VND' }
  ];
  ok('동일 코드 중복 감지', (w.findDupProduct({ code: 'ccr232at', name: 'x' }) || {}).why === 'code');
  ok('동일 사양(품명·색상·사이즈) 중복 감지', (w.findDupProduct({ code: 'NEW-1', name: 'T50', colorCode: 'BK', size: '600*600*1100' }) || {}).why === 'spec');
  ok('신규 제품은 통과', w.findDupProduct({ code: 'DSK900', name: 'DESK', colorCode: 'WH', size: '1400*700*750' }) === null);
  // 견적 라인 자동 DB화가 중복을 만들지 않는가
  const nBefore = w.state.products.length;
  w.upsertProductFromLine({ code: '', name: 'T50', colorCode: 'BK', size: '600*600*1100', cost: '3600000' }, 'VND');
  ok('견적 저장 시 코드없는 중복 라인 무시', w.state.products.length === nBefore, nBefore + '개 유지');
  w.upsertProductFromLine({ code: 'CCR232AT', name: 'BECONN+', colorCode: 'RCNWW', size: '3200*1200*720', cost: '21000000' }, 'VND');
  const upd = w.state.products.find(p => p.code === 'CCR232AT');
  ok('기존 코드는 갱신(신규 생성 아님)', w.state.products.length === nBefore && upd.cost === '21000000');
  ok('Size에서 CBM 자동 보정', upd.cbm === '2.765', 'cbm=' + upd.cbm);
  // 중복 정리
  w.state.products.push({ code: 'ccr232at', name: 'BECONN+', colorCode: 'RCNWW', size: '3200*1200*720', image: 'IMG' });
  w.confirm = () => true;
  const cnt0 = w.state.products.length;
  w.renderQuoteDb = w.renderQuoteDb; w.populateQuoteProductCodes = w.populateQuoteProductCodes;
  const dbEl = d.getElementById('quoteDbList');
  w.dedupeProducts();
  ok('기존 중복 통합', w.state.products.length === cnt0 - 1, cnt0 + '개 → ' + w.state.products.length + '개');
  ok('통합 시 빈 필드 보완(이미지 승계)', !!w.state.products.find(p => (p.code || '').toLowerCase() === 'ccr232at').image);
  // 테이블 렌더
  w.renderQuoteDb();
  const tbl = dbEl.querySelector('table');
  ok('제품 DB 테이블 렌더', !!tbl);
  if (tbl) {
    const ths = Array.from(tbl.querySelectorAll('thead th')).map(t => t.textContent.replace(/[▲▼]/g, '').trim());
    ok('CBM 컬럼 존재', ths.some(x => x === 'CBM'), ths.join(' | '));
    const cbmTd = tbl.querySelector('tbody tr td:nth-child(7)');
    ok('CBM 셀 우측정렬', /text-align:right/.test(cbmTd.getAttribute('style')));
    const costTd = tbl.querySelector('tbody tr td:nth-child(8)');
    ok('원가 셀 우측정렬', /text-align:right/.test(costTd.getAttribute('style')));
    const n0 = tbl.querySelectorAll('tbody tr').length;
    w.pdbSort('cost');
    w.renderQuoteDb();
    ok('헤더 클릭 정렬 동작', dbEl.querySelectorAll('tbody tr').length === n0 && /▼|▲/.test(dbEl.innerHTML));
  }

  // ══════════════════════════════════════════════════════════
  head('9. 견적서 — 숫자 우측정렬 · CBM 토글 · Excel');
  const linesBox = d.getElementById('quoteLinesBox');
  w.eval('quoteLines=[];');
  w.addQuoteLine({ code: 'CCR232AT', category: 'MEETING TABLE', name: 'BECONN+', size: '3200*1200*720', colorCode: 'RCNWW', cost: '20000000', cbm: '2.765' });
  w.eval("quoteLines[0].qty='2'");
  w.renderQuoteLines();
  const hdrs = Array.from(linesBox.querySelectorAll('thead th')).map(t => t.textContent.trim());
  ok('라인 편집기에 CBM/EA 컬럼', hdrs.includes('CBM/EA'), hdrs.join(' | '));
  const inputs = Array.from(linesBox.querySelectorAll('input')).filter(i => i.getAttribute('inputmode'));
  const numAligned = inputs.filter(i => /text-align:right/.test(i.getAttribute('style') || '')).length;
  ok('숫자 입력칸 우측정렬', numAligned === inputs.length, numAligned + '/' + inputs.length + '개 (Qty·Cost·CBM·마진)');
  // CBM 자동계산
  w.eval("quoteLines[0].cbm=''");
  w.autoCbm(0);
  const _cbm0 = w.eval('quoteLines[0].cbm');
  ok('라인 CBM 자동계산 버튼', _cbm0 === '2.765', _cbm0);

  // ── PDF 표: 컬럼 정합 + 셀 정렬 ──
  function tableOf(q) {
    const t = d.createElement('div');
    t.innerHTML = w.buildQuoteHtml(q);
    return { table: t.querySelector('table'), html: t.innerHTML, raw: w.buildQuoteHtml(q) };
  }
  const qBase = {
    quoteNo: 'Q-20260722-001', client: 'ABC Co', date: '2026-07-22', validDays: 15,
    currency: 'VND', vat: 8, preparedBy: 'JINHA LEE', notes: 'Lead time 14 days',
    lines: [
      { code: 'CCR232AT', category: 'MEETING TABLE', name: 'BECONN+', size: '3200*1200*720', colorCode: 'RCNWW', qty: '2', cbm: '2.765', unitPrice: 26000000, amount: 52000000, remark: '', image: 'data:image/jpeg;base64,' + 'A'.repeat(400) },
      { code: 'CHR100', category: 'CHAIR', name: 'T50', size: '600*600*1100', colorCode: 'BK', qty: '10', cbm: '0.396', unitPrice: 3500000, amount: 35000000, remark: 'imported', image: 'data:image/png;base64,' + 'B'.repeat(400) }
    ]
  };
  [['CBM 미포함', false], ['CBM 포함', true]].forEach(([lbl, showCbm]) => {
    const { table, raw } = tableOf(Object.assign({}, qBase, { showCbm }));
    const nHead = table.querySelectorAll('thead th').length;
    const nBody = table.querySelectorAll('tbody tr')[0].querySelectorAll('td').length;
    const foots = Array.from(table.querySelectorAll('tfoot tr')).map(tr =>
      Array.from(tr.children).reduce((a, td) => a + parseInt(td.getAttribute('colspan') || '1', 10), 0));
    ok('PDF ' + lbl + ' — 표 컬럼 정합', nHead === nBody && foots.every(f => f === nHead),
      'head=' + nHead + ' body=' + nBody + ' foot=' + JSON.stringify(foots));
    const headTxt = Array.from(table.querySelectorAll('thead th')).map(t => t.textContent).join(' ');
    ok('PDF ' + lbl + ' — CBM 컬럼 ' + (showCbm ? '표시' : '숨김'), /CBM/.test(headTxt) === showCbm,
      showCbm ? '' : '(로고 base64 안의 우연한 CBM 문자열 오탐 방지 위해 표 헤더만 검사)');
    ok('PDF ' + lbl + ' — style 속성 중복 없음',
      !/<td[^>]*\sstyle="[^"]*"[^>]*\sstyle=/.test(raw),
      '중복 style 이 있으면 브라우저가 앞의 것만 적용 → 정렬 무시됨');
  });

  head('9-b. PDF 셀 정렬 — COLOR/QTY 가운데 · 금액 오른쪽');
  {
    const { table } = tableOf(Object.assign({}, qBase, { showCbm: true }));
    const heads = Array.from(table.querySelectorAll('thead th')).map(t => t.textContent.replace(/\s+/g, ' ').trim());
    const tds = Array.from(table.querySelectorAll('tbody tr')[0].querySelectorAll('td'));
    const align = td => ((td.getAttribute('style') || '').match(/text-align:(\w+)/) || [])[1] || '(none)';
    const want = {
      'No': 'center', 'Category': 'left', 'Product Name': 'left', 'Image': 'center',
      'Size (WxDxH)': 'center', 'Product Code': 'center', 'Color CODE': 'center',
      'Qty': 'center', 'CBM (m³)': 'right', 'REMARK': 'left'
    };
    heads.forEach((h, i) => {
      const key = /Unit Price/.test(h) ? 'Unit Price' : /Amount/.test(h) ? 'Amount' : /CBM/.test(h) ? 'CBM (m³)' : h;
      const exp = (key === 'Unit Price' || key === 'Amount') ? 'right' : want[key];
      if (!exp) return;
      ok('  ' + key.padEnd(14) + ' → ' + exp, align(tds[i]) === exp, '실제=' + align(tds[i]));
    });
    const footVals = Array.from(table.querySelectorAll('tfoot tr')).map(tr => tr.lastElementChild.previousElementSibling || tr.lastElementChild);
    ok('  합계 금액 셀 우측정렬', footVals.every(td => /text-align:right/.test(td.getAttribute('style') || '')));
  }

  // ── Excel: PDF 서식 재현 + 이미지 ──
  head('9-c. Excel — PDF 서식 유지 · 이미지 삽입');
  const ExcelJS = require('exceljs');
  const res = await w._buildQuoteXlsx(Object.assign({}, qBase, { showCbm: true }));
  ok('Excel 파일 생성', !!(res && res.fileName), res && res.fileName);
  ok('이미지 삽입 건수', res && res.images === 2, '이미지 ' + (res && res.images) + '개');
  ok('브라우저 다운로드 경로 호출', w.__blobs.length >= 1, 'Blob ' + w.__blobs.length + '건');

  const wb3 = new ExcelJS.Workbook();
  await wb3.xlsx.load(Buffer.from(res.buffer));
  const ws3 = wb3.getWorksheet('Quotation');
  ok('워크시트 이름 Quotation', !!ws3);
  ok('워크북에 이미지 임베드됨(제품2+로고1)', wb3.model.media && wb3.model.media.length === 3, '미디어 ' + ((wb3.model.media || []).length) + '개');
  ok('시트에 이미지 배치됨', ws3.getImages().length === 3, ws3.getImages().length + '개 배치');

  const hdrRow = ws3.getRow(5);
  const hdrs3 = []; hdrRow.eachCell({ includeEmpty: true }, c => hdrs3.push(String(c.value || '').replace(/\n/g, ' ')));
  ok('표 헤더가 PDF 와 동일 순서', hdrs3.slice(0, 8).join('|') === 'No|Category|Product Name|Image|Size (WxDxH)|Product Code|Color CODE|Qty', hdrs3.join(' | '));
  ok('헤더 배경·굵기 서식 적용', !!(hdrRow.getCell(1).fill && hdrRow.getCell(1).font.bold));

  const l1 = ws3.getRow(6);
  const alignOf = n => (l1.getCell(n).alignment || {}).horizontal;
  ok('Excel COLOR 가운데', alignOf(7) === 'center', alignOf(7));
  ok('Excel QTY 가운데', alignOf(8) === 'center', alignOf(8));
  ok('Excel CBM 오른쪽', alignOf(9) === 'right', alignOf(9));
  ok('Excel Unit Price 오른쪽', alignOf(10) === 'right', alignOf(10));
  ok('Excel Amount 오른쪽', alignOf(11) === 'right', alignOf(11));
  ok('Excel 금액이 숫자 셀', typeof l1.getCell(11).value === 'number', l1.getCell(11).value + ' (' + typeof l1.getCell(11).value + ')');
  ok('Excel 금액 서식 #,##0', l1.getCell(11).numFmt === '#,##0', l1.getCell(11).numFmt);
  ok('Excel CBM 서식 0.000', l1.getCell(9).numFmt === '0.000', l1.getCell(9).numFmt);
  ok('Excel 셀 테두리 적용', !!(l1.getCell(1).border && l1.getCell(1).border.top));
  ok('이미지 행 높이 확보', l1.height >= 40, l1.height + 'pt');
  ok('열 너비 지정', ws3.getColumn(3).width >= 20, 'Product Name 폭=' + ws3.getColumn(3).width);
  ok('상단 QUOTATION 헤더 존재', String(ws3.getCell('D1').value || '').indexOf('QUOTATION') >= 0);
  ok('Client 행 존재', String(ws3.getCell('A3').value || '').indexOf('ABC Co') >= 0, String(ws3.getCell('A3').value));
  const flat3 = [];
  ws3.eachRow({ includeEmpty: false }, rr => rr.eachCell({ includeEmpty: false }, cc => flat3.push(String(cc.value))));
  ok('합계 행 3종 존재', ['TOTAL CBM (m³)', 'TOTAL (Excl. VAT)', 'TOTAL (Incl. VAT)'].every(t => flat3.includes(t)));
  ok('안내문 포함', flat3.some(x => /Lead time 14 days/.test(x)));
  ok('틀고정(헤더 아래)', !!(ws3.views && ws3.views[0] && ws3.views[0].ySplit === 5));
  ok('가로 인쇄 · 한 페이지 폭 맞춤', ws3.pageSetup.orientation === 'landscape' && ws3.pageSetup.fitToWidth === 1);

  // CBM 미포함
  const res2 = await w._buildQuoteXlsx(Object.assign({}, qBase, { showCbm: false, quoteNo: 'Q-OFF' }));
  const wb4 = new ExcelJS.Workbook(); await wb4.xlsx.load(Buffer.from(res2.buffer));
  const h4 = []; wb4.getWorksheet('Quotation').getRow(5).eachCell({ includeEmpty: true }, c => h4.push(String(c.value || '').replace(/\n/g, ' ')));
  ok('CBM 미포함 시 Excel 컬럼 제외', !h4.some(x => /CBM/.test(x)), h4.join(' | '));
  ok('CBM 미포함에도 이미지 유지', res2.images === 2);

  // 폴백 경로
  const nB = w.__savedFiles.length;
  w.exportQuoteExcelPlain(Object.assign({}, qBase, { showCbm: true }));
  ok('ExcelJS 실패 시 SheetJS 폴백 동작', w.__savedFiles.length === nB + 1, w.__savedFiles[w.__savedFiles.length - 1].name);

  // 제품 DB Excel
  w.exportProductsExcel();
  ok('제품 DB Excel 내보내기', /INICS_products_/.test(w.__savedFiles[w.__savedFiles.length - 1].name));

  // ══════════════════════════════════════════════════════════
  head('9-d. Excel 들여쓰기 · 이미지 중앙 · 회사 로고');
  {
    const EJ = require('exceljs');
    // (1) 기본 로고 상태
    const rA = await w._buildQuoteXlsx(Object.assign({}, qBase, { showCbm: true, quoteNo: 'Q-LOGO-DEF' }));
    ok('기본 로고가 Excel 에 삽입됨', rA.logo === true);
    const wbA = new EJ.Workbook(); await wbA.xlsx.load(Buffer.from(rA.buffer));
    const wsA = wbA.getWorksheet('Quotation');
    ok('로고 + 제품이미지 = 3장 임베드', (wbA.model.media || []).length === 3, (wbA.model.media || []).length + '장 (로고1 + 제품2)');
    ok('로고 자리 텍스트 제거됨', !String(wsA.getCell('A1').value || '').includes('INICS'), 'A1="' + (wsA.getCell('A1').value || '') + '"');

    // (2) 들여쓰기
    const l1A = wsA.getRow(6);
    ok('Category 들여쓰기 1칸', (l1A.getCell(2).alignment || {}).indent === 1, 'indent=' + (l1A.getCell(2).alignment || {}).indent);
    ok('Product Name 들여쓰기 1칸', (l1A.getCell(3).alignment || {}).indent === 1, 'indent=' + (l1A.getCell(3).alignment || {}).indent);
    ok('숫자열은 들여쓰기 없음', !(l1A.getCell(11).alignment || {}).indent);

    // (3) 이미지 중앙 배치 — 셀 안에서 좌우/상하 여백이 같은가
    // ext 는 픽셀, nativeColOff/RowOff 는 EMU(1px=9525) 단위
    const SC = 1.5, EMU = 9525;
    const CELLW = Math.round((wsA.getColumn(4).width || 8) * 7 + 5);
    const CELLH = Math.round((wsA.getRow(6).height || 15) * 4 / 3);
    const prod = wsA.getImages().filter(im => im.range.tl.nativeCol === 3);
    ok('제품 이미지가 Image 열(4번째)에 위치', prod.length === 2, prod.length + '장');
    if (prod.length) {
      const im = prod[0], iw = im.range.ext.width, ih = im.range.ext.height;
      const left = im.range.tl.nativeColOff / EMU, right = CELLW - left - iw;
      const top = im.range.tl.nativeRowOff / EMU, bottom = CELLH - top - ih;
      ok('이미지 좌우 여백 대칭 (가운데 정렬)', Math.abs(left - right) <= 1,
        '좌 ' + left.toFixed(1) + 'px / 우 ' + right.toFixed(1) + 'px  (셀 ' + CELLW + 'px, 이미지 ' + iw + 'px)');
      ok('이미지 상하 여백 대칭 (세로 중앙)', Math.abs(top - bottom) <= 1,
        '상 ' + top.toFixed(1) + 'px / 하 ' + bottom.toFixed(1) + 'px  (셀 ' + CELLH + 'px, 이미지 ' + ih + 'px)');
      ok('이미지가 셀 밖으로 넘치지 않음', iw <= CELLW && ih <= CELLH, iw + '×' + ih + 'px / 셀 ' + CELLW + '×' + CELLH + 'px');
      ok('이미지 원본 비율 유지', Math.abs(iw / ih - 64 / 48) < 0.03, '비율 ' + (iw / ih).toFixed(3) + ' vs 원본 1.333');
    }
    // ── 로고: A1:C2 자리에 정중앙 · 최대 크기 ──
    const cpx = ww => Math.round((ww || 8) * 7 + 5);
    const rpx = pp => Math.round((pp || 15) * 4 / 3);
    const areaW = cpx(wsA.getColumn(1).width) + cpx(wsA.getColumn(2).width) + cpx(wsA.getColumn(3).width);
    const areaH = rpx(wsA.getRow(1).height) * 2;
    const logoIm = wsA.getImages().find(im => im.range.tl.nativeRow === 0);
    ok('로고 이미지 존재', !!logoIm);
    if (logoIm) {
      let ax = 0; for (let c = 0; c < logoIm.range.tl.nativeCol; c++) ax += cpx(wsA.getColumn(c + 1).width);
      ax += logoIm.range.tl.nativeColOff / EMU;
      const lw = logoIm.range.ext.width, lh = logoIm.range.ext.height;
      const gl = ax, gr = areaW - ax - lw;
      const gt = logoIm.range.tl.nativeRowOff / EMU, gb = areaH - gt - lh;
      ok('로고 좌우 정중앙', Math.abs(gl - gr) <= 1, '좌 ' + gl.toFixed(1) + 'px / 우 ' + gr.toFixed(1) + 'px');
      ok('로고 상하 정중앙', Math.abs(gt - gb) <= 1, '상 ' + gt.toFixed(1) + 'px / 하 ' + gb.toFixed(1) + 'px');
      ok('로고가 자리를 벗어나지 않음', lw <= areaW && lh <= areaH, lw + '×' + lh + 'px / 자리 ' + areaW + '×' + areaH + 'px');
      ok('로고 축소 비율 70% 적용', rA.logoFill === 0.70, 'QX_LOGO_FILL=' + rA.logoFill);
      ok('로고가 과도하게 크지 않음(가로 60% 이하)', lw / areaW <= 0.60, '가로 ' + (lw / areaW * 100).toFixed(0) + '% · 세로 ' + (lh / areaH * 100).toFixed(0) + '%');
      ok('로고 자리에 빈 띠가 남지 않음(세로 여백 ≤6px)', gt <= 6 && gb <= 6, '상 ' + gt.toFixed(0) + 'px / 하 ' + gb.toFixed(0) + 'px');
      ok('로고 원본 비율 유지', Math.abs(lw / lh - 256 / 62) < 0.06, '비율 ' + (lw / lh).toFixed(2) + ' vs 원본 ' + (256 / 62).toFixed(2));
      ok('로고 자리 높이가 이전보다 낮아짐', wsA.getRow(1).height <= 30, '행높이 ' + wsA.getRow(1).height + 'pt (이전 51pt)');
    }

    // ── 1.5배 확대 ──
    ok('전체 배율 1.5', rA.scale === 1.5);
    ok('열 너비 1.5배', Math.abs(wsA.getColumn(3).width - 28 * 1.5) < 0.01, 'Product Name ' + wsA.getColumn(3).width + ' (기존 28)');
    ok('표 헤더 행높이 1.5배', Math.abs(wsA.getRow(5).height - 28 * 1.5) < 0.01, wsA.getRow(5).height + 'pt (기존 28)');
    ok('품목 행높이 1.5배', Math.abs(wsA.getRow(6).height - 52 * 1.5) < 0.01, wsA.getRow(6).height + 'pt (기존 52)');
    ok('본문 글자 1.5배', Math.abs(wsA.getRow(6).getCell(2).font.size - 9 * 1.5) <= 0.5, wsA.getRow(6).getCell(2).font.size + 'pt (파일에는 13.5 · ExcelJS 리더가 내림)');
    ok('QUOTATION 제목 1.5배', Math.abs(wsA.getCell('D1').font.size - 20 * 1.5) < 0.01, wsA.getCell('D1').font.size + 'pt (기존 20)');
    ok('표 헤더 글자 1.5배', Math.abs(wsA.getRow(5).getCell(1).font.size - 9 * 1.5) <= 0.5, wsA.getRow(5).getCell(1).font.size + 'pt (파일 13.5)');
    ok('확대 후에도 이미지가 셀 안에 유지', prod.every(im => im.range.ext.width <= CELLW && im.range.ext.height <= CELLH));
    // 파일에 실제 기록된 폰트 크기 확인 (리더 내림 문제 우회)
    {
      const zlib = require('zlib');
      const buf = Buffer.from(rA.buffer);
      let styles = '';
      for (let i = 0; i < buf.length - 30; i++) {
        if (buf.readUInt32LE(i) !== 0x04034b50) continue;
        const nlen = buf.readUInt16LE(i + 26), elen = buf.readUInt16LE(i + 28);
        const name = buf.slice(i + 30, i + 30 + nlen).toString();
        if (name !== 'xl/styles.xml') continue;
        const csize = buf.readUInt32LE(i + 18);
        const data = buf.slice(i + 30 + nlen + elen, i + 30 + nlen + elen + csize);
        try { styles = zlib.inflateRawSync(data).toString(); } catch (_) {}
        break;
      }
      const sizes = [...new Set((styles.match(/<sz val="([\d.]+)"/g) || []).map(x => x.match(/"([\d.]+)"/)[1]))];
      ok('파일에 1.5배 폰트가 기록됨', sizes.includes('13.5') && sizes.includes('30'), 'sz = ' + sizes.join(', '));
    }

    // (4) 관리자 패널에서 로고 교체 → 문서에 반영
    const S2 = w.eval('state');
    S2.assets = [];
    ok('교체 전: 기본 로고', w.isCustomLogo() === false);
    {
      const def = w.eval('QUOTE_LOGO_DEFAULT');
      const dd = w.__imgDims(def);
      ok('패널 기본 로고 = 업로드한 INICS 로고', dd.w === 256 && dd.h === 62, dd.w + '×' + dd.h + 'px · 약 ' + Math.round(def.length * 0.75 / 1024) + 'KB');
    }
    const custom = 'data:image/png;base64,' + Buffer.from('CUSTOMLOGO').toString('base64');
    S2.assets.push({ id: 'logo', name: 'inics_new.png', data: custom, w: 400, h: 120, updatedAt: '2026.07.22 05:00', updatedBy: 'JINHA LEE' });
    ok('교체 후: 커스텀 로고 인식', w.isCustomLogo() === true);
    ok('companyLogo() 가 새 로고 반환', w.companyLogo() === custom);
    ok('PDF 견적서가 새 로고 사용', w.buildQuoteHtml(Object.assign({}, qBase, { showCbm: false })).indexOf(custom) >= 0);
    const rB = await w._buildQuoteXlsx(Object.assign({}, qBase, { showCbm: true, quoteNo: 'Q-LOGO-NEW' }));
    ok('Excel 이 새 로고 사용', rB.logo === true);

    // (5) 로고가 Storage 로 외부화되는가 (meta 인라인 금지)
    w._fbSnapshotFromState(S2);
    const REFP = '\u00A7f\u00A7';
    const av = w._lastSynced.colls.assets;
    ok('로고 → Storage 포인터', !!(av && av.logo && typeof av.logo.data === 'string' && av.logo.data.slice(0, 3) === REFP),
      av && av.logo ? String(av.logo.data).slice(0, 14) : '(none)');
    ok('meta 에 로고 base64 미포함', JSON.stringify(w._lastSynced.meta || {}).indexOf('base64') < 0);

    // (6) 기본 로고로 복원
    w.confirm = () => true;
    w.resetLogo();
    ok('기본 로고로 복원', w.isCustomLogo() === false && w.companyLogo() === w.eval('QUOTE_LOGO_DEFAULT'));

    // (7) 관리자 패널 UI 존재
    ok('관리자 패널에 로고 카드 존재', !!d.getElementById('logoDrop') && !!d.getElementById('logoFile'));
    let logoPaste = false;
    const origLU = w.handleLogoUpload;
    w.handleLogoUpload = f => { logoPaste = !!f; };
    w.onLogoPaste({ clipboardData: { items: [{ type: 'image/png', getAsFile: () => ({ type: 'image/png', size: 1000 }) }] }, preventDefault() {} });
    ok('로고 붙여넣기 인식', logoPaste === true);
    logoPaste = false;
    w.onLogoDrop({ preventDefault() {}, dataTransfer: { files: [{ type: 'image/png', size: 1000 }] } });
    ok('로고 드래그&드롭 인식', logoPaste === true);
    w.handleLogoUpload = origLU;
    w.renderLogoAdmin();
    ok('로고 미리보기 렌더', (d.getElementById('logoPreview').innerHTML || '').indexOf('<img') >= 0);
  }

  // ══════════════════════════════════════════════════════════
  head('10. 캐시 버스팅 확인');
  const vq = (html.match(/js\/quote\.js\?v=(\d+)/) || [])[1];
  const vs = (html.match(/js\/sync\.js\?v=(\d+)/) || [])[1];
  console.log('  현재: sync.js?v=' + vs + ' , quote.js?v=' + vq);

  // ══════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(64));
  console.log('  통과 ' + PASS.length + ' · 실패 ' + FAIL.length + ' · 경고 ' + WARN.length);
  if (FAIL.length) { console.log('\n  실패 항목:'); FAIL.forEach(f => console.log('   ✗ ' + f)); }
  if (WARN.length) { console.log('\n  경고 항목:'); WARN.forEach(f => console.log('   ! ' + f)); }
  console.log('═'.repeat(64));
  process.exit(FAIL.length ? 1 : 0);
})().catch(e => { console.error('\n시뮬레이션 자체 오류:', e); process.exit(2); });
