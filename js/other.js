/* ═══════════════════════════════════════════════════════════════
   INICS · 그 외 업무 모듈 · Other Projects  (other.js)
   · 분류(Sourcing · Event …)별 다중 프로젝트 · 업체별 단계/대화 로그/견적/파일
   · 데이터: state.otherCats (설정 · _cfgRev 보호) / state.otherProjects (레코드 단위 병합·저장)
   · 견적 비교: 통화·인코텀즈·단위당 가산비 → 프로젝트 통화 landed 단가 (환율 = state.projFxRates + CNY)
   · 단가: 현재 네고 단가(내부용) / 본사 보고용 단가(주간 보고 표시) 분리
   · 본사 주간 보고 연동: window.otherHqSummary(mon, sun) → hqreport.js 가 사용
   · UI 표기: 영어 먼저 · 한국어 보조 (B(ko,en) / T(ko,en))
   ═══════════════════════════════════════════════════════════════ */
(function () {
'use strict';

var CSS = [
  '#otherApp{position:fixed;inset:0;z-index:500;overflow-y:auto;background:var(--bg);color:var(--text);font-family:var(--sans);font-size:14px;-webkit-font-smoothing:antialiased;',
  '--accent:#15803d;--accent-bg:#f0fdf4;--blue:#1d4ed8;--blue-bg:#eff6ff;--warn:#b45309;--warn-bg:#fffbeb;--shadow:0 12px 40px rgba(20,20,18,.14)}',
  '#otherApp button,#otherApp input,#otherApp select,#otherApp textarea{font:inherit;color:inherit}',
  '#otherApp button{cursor:pointer}',
  '#otherApp h1{font-size:20px;letter-spacing:-.02em;margin:0 0 4px;font-weight:700}',
  '#otherApp h2{font-weight:700}#otherApp h3{font-weight:700}',
  '#otherApp :focus-visible{outline:2px solid var(--blue);outline-offset:2px}',
  '#otherApp a{color:inherit}',
  '#otherApp .app{display:flex;min-height:100vh}',
  '#otherApp .side{width:220px;flex-shrink:0;background:var(--surface);border-right:1px solid var(--border);padding:16px 0;position:sticky;top:0;height:100vh;overflow:auto}',
  '#otherApp .logo{padding:0 18px 14px;border-bottom:1px solid var(--border);margin-bottom:10px}',
  '#otherApp .logo b{font-size:15px;letter-spacing:-.02em}',
  '#otherApp .logo div{font-size:10px;color:var(--text-3);margin-top:2px}',
  '#otherApp .nav-sec{font-size:10px;font-weight:700;color:var(--text-3);padding:12px 18px 4px}',
  '#otherApp .nav .ko{white-space:normal}',
  '#otherApp .obtn{white-space:nowrap}',
  '#otherApp .nav{display:flex;align-items:center;gap:8px;width:100%;border:0;background:none;text-align:left;padding:8px 18px;font-size:12.5px;color:var(--text-2);position:relative}',
  '#otherApp .nav:hover{background:var(--surface-2);color:var(--text)}',
  '#otherApp .nav.on{background:var(--bg);color:var(--text);font-weight:600}',
  '#otherApp .nav.on::before{content:\'\';position:absolute;left:0;top:6px;bottom:6px;width:3px;border-radius:0 3px 3px 0;background:var(--cdot,var(--text))}',
  '#otherApp .dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}',
  '#otherApp .nav .cnt{margin-left:auto;font-size:10.5px;color:var(--text-3)}',
  '#otherApp .side-foot{padding:14px 18px;font-size:10.5px;color:var(--text-3);line-height:1.5;border-top:1px solid var(--border);margin-top:14px}',
  '#otherApp .side-foot button{border:1px solid var(--border);background:var(--surface);border-radius:6px;padding:4px 8px;font-size:10.5px;color:var(--text-2);margin-top:6px}',
  '#otherApp .main{flex:1;min-width:0;padding:22px 26px 60px}',
  '#otherApp .crumb{font-size:11.5px;color:var(--text-3);margin-bottom:6px}',
  '#otherApp .crumb a{color:var(--text-2);cursor:pointer;text-decoration:none}',
  '#otherApp .crumb a:hover{text-decoration:underline}',
  '',
  '#otherApp .sub{color:var(--text-2);font-size:12.5px;margin:0 0 18px}',
  '#otherApp .row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}',
  '#otherApp .spacer{flex:1}',
  '#otherApp .obtn{border:1px solid var(--border-strong);background:var(--surface);border-radius:var(--radius);padding:7px 12px;font-size:12px;font-weight:600;color:var(--text);display:inline-flex;align-items:center;gap:6px}',
  '#otherApp .obtn:hover{background:var(--surface-2)}',
  '#otherApp .obtn.pri{background:var(--text);color:var(--surface);border-color:var(--text)}',
  '#otherApp .obtn.pri:hover{opacity:.88}',
  '#otherApp .obtn.sm{padding:4px 9px;font-size:11px}',
  '#otherApp .obtn.ghost{border-color:transparent;background:none;color:var(--text-2)}',
  '#otherApp .obtn.danger{color:var(--danger)}',
  '#otherApp .card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg)}',
  '#otherApp .pad{padding:16px 18px}',
  '#otherApp .muted{color:var(--text-3)}',
  '#otherApp .small{font-size:11.5px}',
  '#otherApp .tag{display:inline-flex;align-items:center;gap:5px;font-size:10.5px;font-weight:600;padding:2px 8px;border-radius:20px;background:var(--surface-2);color:var(--text-2);white-space:nowrap}',
  '#otherApp .num{font-variant-numeric:tabular-nums}',
  '#otherApp .plist{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px}',
  '#otherApp .pcard{padding:16px 18px;cursor:pointer;border-left:4px solid var(--cc,var(--border-strong))}',
  '#otherApp .pcard:hover{border-color:var(--border-strong);border-left-color:var(--cc)}',
  '#otherApp .pcard h3{margin:6px 0 2px;font-size:14.5px}',
  '#otherApp .kv{display:grid;grid-template-columns:auto 1fr;gap:4px 12px;font-size:12px;margin-top:10px}',
  '#otherApp .kv dt{color:var(--text-3)}',
  '#otherApp .kv dd{margin:0;text-align:right}',
  '#otherApp .mini-funnel{display:flex;gap:2px;margin-top:12px;height:6px}',
  '#otherApp .mini-funnel span{flex:1;border-radius:2px;background:var(--surface-2)}',
  '#otherApp .empty{padding:40px 20px;text-align:center;color:var(--text-2);border:1px dashed var(--border-strong);border-radius:var(--radius-lg)}',
  '#otherApp .target{display:grid;grid-template-columns:1.3fr repeat(4,1fr);gap:0;overflow:hidden}',
  '#otherApp .target > div{padding:14px 16px;border-right:1px solid var(--border)}',
  '#otherApp .target > div:last-child{border-right:0}',
  '#otherApp .target .lb{font-size:10.5px;color:var(--text-3);margin-bottom:4px}',
  '#otherApp .target .big{font-size:22px;font-weight:700;letter-spacing:-.02em}',
  '#otherApp .target .mid{font-size:15px;font-weight:600}',
  '#otherApp .gap-good{color:var(--accent)}',
  '#otherApp .gap-near{color:var(--warn)}',
  '#otherApp .gap-bad{color:var(--danger)}',
  '#otherApp .ko{margin-left:.35em;font-size:.86em;font-weight:400;opacity:.62;white-space:nowrap}',
  '#otherApp .pstep .ko,#otherApp .stagebar .ko,#otherApp .lb .ko{display:block;margin-left:0;white-space:normal;line-height:1.25}',
  '#otherApp .stagebar .ko{font-size:.8em}',
  '#otherApp th .ko,#otherApp .lb .ko,#otherApp .ofg label .ko,#otherApp .nav-sec .ko{text-transform:none;letter-spacing:0}',
  '#otherApp .orig{font-size:10.5px;color:var(--text-3);margin-top:1px}',
  '#otherApp .incw{display:inline-block;font-size:10px;font-weight:600;color:var(--warn);background:var(--warn-bg);border-radius:4px;padding:0 5px;margin-left:4px}',
  '#otherApp .landed-prev{grid-column:1/-1;font-size:12px;border:1px dashed var(--border-strong);border-radius:6px;padding:8px 10px;background:var(--surface-2);line-height:1.6}',
  '#otherApp .fx-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px;margin-top:8px}',
  '#otherApp .fx-grid label{font-size:10.5px;font-weight:600;color:var(--text-2)}',
  '#otherApp .fx-grid input{width:100%;border:1px solid var(--border-strong);background:var(--surface);border-radius:6px;padding:6px 8px;font-size:12.5px;margin-top:3px}',
  '#otherApp .process{display:flex;gap:0;margin:16px 0;overflow-x:auto}',
  '#otherApp .pstep{flex:1;min-width:110px;padding:10px 12px;border:1px solid var(--border);border-left:0;background:var(--surface);position:relative}',
  '#otherApp .pstep:first-child{border-left:1px solid var(--border);border-radius:var(--radius-lg) 0 0 var(--radius-lg)}',
  '#otherApp .pstep:last-child{border-radius:0 var(--radius-lg) var(--radius-lg) 0}',
  '#otherApp .pstep .n{font-size:10px;color:var(--text-3)}',
  '#otherApp .pstep .t{font-size:12.5px;font-weight:600;margin:2px 0}',
  '#otherApp .pstep .c{font-size:18px;font-weight:700}',
  '#otherApp .pstep.has{background:var(--accent-bg)}',
  '#otherApp .pstep.has .c{color:var(--accent)}',
  '#otherApp .tbl-wrap{overflow-x:auto}',
  '#otherApp table{width:100%;border-collapse:collapse;min-width:880px}',
  '#otherApp th{font-size:10.5px;font-weight:700;color:var(--text-3);text-align:left;padding:9px 12px;border-bottom:1px solid var(--border);background:var(--surface-2);white-space:nowrap}',
  '#otherApp td{padding:11px 12px;border-bottom:1px solid var(--border);font-size:12.5px;vertical-align:middle}',
  '#otherApp tr.vrow{cursor:pointer}',
  '#otherApp tr.vrow:hover td{background:var(--surface-2)}',
  '#otherApp tr.vrow.sel td{background:var(--blue-bg)}',
  '#otherApp tr.dim td{opacity:.55}',
  '#otherApp .track{display:flex;gap:2px;width:150px}',
  '#otherApp .track i{flex:1;height:6px;border-radius:2px;background:var(--border)}',
  '#otherApp .track i.done{background:var(--accent)}',
  '#otherApp .track i.now{background:var(--accent);box-shadow:0 0 0 2px var(--accent-bg),0 0 0 3px var(--accent)}',
  '#otherApp .stg-name{font-size:11.5px;font-weight:600;margin-top:5px}',
  '#otherApp .next{max-width:260px}',
  '#otherApp .next .due{font-size:11px;margin-top:2px}',
  '#otherApp .overdue{color:var(--danger);font-weight:600}',
  '#otherApp .soon{color:var(--warn);font-weight:600}',
  '#otherApp .r{text-align:right}',
  '#otherApp .scrim{position:fixed;inset:0;background:rgba(0,0,0,.25);z-index:50}',
  '#otherApp .drawer{position:fixed;top:0;right:0;bottom:0;width:min(560px,100%);background:var(--surface);border-left:1px solid var(--border);box-shadow:var(--shadow);z-index:51;display:flex;flex-direction:column;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}',
  '#otherApp .dr-head{padding:16px 20px 12px;border-bottom:1px solid var(--border)}',
  '#otherApp .dr-body{flex:1;overflow:auto;padding:16px 20px 30px}',
  '#otherApp .dr-head h2{margin:0;font-size:17px}',
  '#otherApp .stagebar{display:flex;gap:4px;margin:12px 0 4px;flex-wrap:wrap}',
  '#otherApp .stagebar button{flex:1;min-width:64px;border:1px solid var(--border);background:var(--surface);border-radius:6px;padding:6px 4px;font-size:10.5px;color:var(--text-3);line-height:1.25}',
  '#otherApp .stagebar button.done{background:var(--accent-bg);color:var(--accent);border-color:transparent}',
  '#otherApp .stagebar button.now{background:var(--accent);color:#fff;border-color:var(--accent);font-weight:700}',
  '#otherApp .sec{margin-top:18px}',
  '#otherApp .sec-h{display:flex;align-items:center;gap:8px;margin-bottom:8px}',
  '#otherApp .sec-h b{font-size:12.5px}',
  '#otherApp .nextbox{border:1px solid var(--warn);background:var(--warn-bg);border-radius:var(--radius);padding:12px 14px}',
  '#otherApp .nextbox.ok{border-color:var(--border);background:var(--surface-2)}',
  '#otherApp .nextbox .what{font-weight:600;font-size:13px}',
  '#otherApp .tabs{display:flex;gap:2px;border-bottom:1px solid var(--border);margin-top:18px}',
  '#otherApp .tabs button{border:0;background:none;padding:8px 12px;font-size:12px;color:var(--text-3);border-bottom:2px solid transparent;margin-bottom:-1px}',
  '#otherApp .tabs button.on{color:var(--text);border-bottom-color:var(--text);font-weight:600}',
  '#otherApp .timeline{position:relative;margin-top:12px}',
  '#otherApp .tday{font-size:11px;font-weight:700;color:var(--text-2);margin:14px 0 6px}',
  '#otherApp .log{display:grid;grid-template-columns:62px 1fr;gap:10px;padding:9px 0;border-top:1px solid var(--border)}',
  '#otherApp .log:first-of-type{border-top:0}',
  '#otherApp .ch{font-size:10px;font-weight:700;padding:3px 6px;border-radius:5px;text-align:center;align-self:start}',
  '#otherApp .ch-in{background:var(--blue-bg);color:var(--blue)}',
  '#otherApp .ch-out{background:var(--surface-2);color:var(--text-2)}',
  '#otherApp .ch-memo{background:var(--admin-bg);color:var(--admin)}',
  '#otherApp .log p{margin:0;font-size:12.5px;line-height:1.55;white-space:pre-wrap}',
  '#otherApp .log .meta{font-size:10.5px;color:var(--text-3);margin-top:3px}',
  '#otherApp .file{display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid var(--border);border-radius:var(--radius);margin-top:6px;font-size:12px}',
  '#otherApp .file .ext{font-size:9.5px;font-weight:700;background:var(--surface-2);color:var(--text-2);border-radius:4px;padding:3px 5px;min-width:34px;text-align:center}',
  '#otherApp .file .path{font-size:10px;color:var(--text-3);word-break:break-all}',
  '#otherApp .chip-file{display:inline-flex;gap:4px;align-items:center;font-size:10.5px;background:var(--surface-2);padding:2px 7px;border-radius:5px;margin:4px 4px 0 0}',
  '#otherApp .qbar{position:relative;height:28px;margin:10px 0 4px}',
  '#otherApp .qbar .line{position:absolute;top:13px;left:0;right:0;height:2px;background:var(--border)}',
  '#otherApp .qbar .tgt{position:absolute;top:2px;bottom:2px;width:2px;background:var(--text)}',
  '#otherApp .qbar .pt{position:absolute;top:8px;width:12px;height:12px;border-radius:50%;margin-left:-6px;border:2px solid var(--surface)}',
  '#otherApp .form{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}',
  '#otherApp .form .full{grid-column:1/-1}',
  '#otherApp .ofg label{display:block;font-size:10.5px;font-weight:600;color:var(--text-2);margin-bottom:4px}',
  '#otherApp .ofg input,#otherApp .ofg select,#otherApp .ofg textarea{width:100%;border:1px solid var(--border-strong);background:var(--surface);border-radius:6px;padding:7px 9px;font-size:12.5px}',
  '#otherApp .ofg textarea{min-height:76px;resize:vertical}',
  '#otherApp .boxed{border:1px solid var(--border);border-radius:var(--radius);padding:14px;background:var(--surface-2)}',
  '#otherApp .omodal{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:60;padding:16px}',
  '#otherApp .omodal .card{width:min(560px,100%);max-height:90vh;overflow:auto;box-shadow:var(--shadow)}',
  '#otherApp .oadmin-grid{display:grid;grid-template-columns:280px 1fr;gap:14px}',
  '#otherApp .cat-item{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid var(--border);cursor:pointer;font-size:12.5px}',
  '#otherApp .cat-item:last-child{border-bottom:0}',
  '#otherApp .cat-item.on{background:var(--surface-2);font-weight:600}',
  '#otherApp .stage-ed{display:grid;grid-template-columns:28px 1fr 1.4fr auto;gap:8px;align-items:center;padding:8px 0;border-bottom:1px solid var(--border)}',
  '#otherApp .stage-ed input{border:1px solid var(--border);background:var(--surface);border-radius:6px;padding:6px 8px;font-size:12px;width:100%}',
  '#otherApp .note{font-size:11.5px;color:var(--text-2);background:var(--blue-bg);border-radius:var(--radius);padding:10px 12px;line-height:1.55}',
  '#otherApp .otoast{position:fixed;left:50%;bottom:calc(24px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);background:var(--text);color:var(--surface);font-size:12px;padding:9px 16px;border-radius:20px;z-index:80}',
  '@media (max-width:860px){#otherApp .app{flex-direction:column}',
  '#otherApp .side{width:auto;height:auto;position:static;display:flex;overflow-x:auto;padding:8px;border-right:0;border-bottom:1px solid var(--border)}',
  '#otherApp .logo,#otherApp .nav-sec,#otherApp .side-foot{display:none}',
  '#otherApp .nav{width:auto;white-space:nowrap;padding:7px 12px;border-radius:6px}',
  '#otherApp .nav.on::before{display:none}',
  '#otherApp .main{padding:16px 14px 60px}',
  '#otherApp .target{grid-template-columns:1fr 1fr}',
  '#otherApp .target > div{border-bottom:1px solid var(--border)}',
  '#otherApp .oadmin-grid{grid-template-columns:1fr}',
  '#otherApp .form{grid-template-columns:1fr}}',
  '#otherApp .drawer{animation:slide .18s ease-out}',
  'from{transform:translateX(24px);opacity:.6}',
  'to{transform:none;opacity:1}#otherApp .pricebox{display:grid;grid-template-columns:1fr 1fr auto;margin-top:12px;overflow:hidden}',
  '#otherApp .pricebox > div{padding:14px 16px;border-right:1px solid var(--border)}',
  '#otherApp .pricebox > div:last-child{border-right:0}',
  '#otherApp .pricebox .lb{font-size:10.5px;color:var(--text-3);margin-bottom:4px}',
  '#otherApp .pricebox .mid{font-size:17px;font-weight:700}',
  '#otherApp .pricebox .hqcol{background:#f6fdf8}',
  '#otherApp .ptag{display:inline-block;font-size:9.5px;font-weight:700;padding:1px 6px;border-radius:4px;margin-top:3px;white-space:nowrap}',
  '#otherApp .ptag.int{background:var(--warn-bg);color:var(--warn)}',
  '#otherApp .ptag.hq{background:var(--accent-bg);color:var(--accent);border:1px solid #bbf7d0}',
  '#otherApp a.chip-file{text-decoration:none;color:var(--text)}',
  '#otherApp a.chip-file:hover{background:var(--blue-bg)}',
  '#otherApp .file a{color:var(--blue);text-decoration:none}',
  '#otherApp .file a:hover{text-decoration:underline}',
  '#otherApp .otoast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:var(--text);color:var(--surface);font-size:12px;padding:9px 16px;border-radius:20px;z-index:80}',
  '@media (max-width:860px){#otherApp .pricebox{grid-template-columns:1fr}#otherApp .pricebox > div{border-right:0;border-bottom:1px solid var(--border)}}',
  ''
].join('\n');

var BUCKET = 'inics-approval.firebasestorage.app';
var CURS = ['USD','VND','CNY','KRW','MXN'], INCS = ['EXW','FCA','FOB','CFR','CIF','DAP','DDP'];
var FX_DEFAULT = {USD:1, VND:26000, MXN:18, KRW:1350, CNY:7.1};
var CH_EN = {'전화':'Call','미팅':'Meeting','메모':'Memo'};

// ── 기본 분류 (state.otherCats 가 없을 때) ──
function defaultCats(){
  return [
    {id:'sourcing', name:'Sourcing · 소싱', color:'#15803d', enabled:true, partyLabel:'업체', partyEn:'Vendor',
     stages:[
      {key:'s1', name:'후보 발굴', en:'Longlist', desc:'업체 리스트업 · 기본 정보 확인', next:'첫 연락 · RFQ 발송'},
      {key:'s2', name:'첫 연락', en:'First contact', desc:'회사 소개 · RFQ(사양/수량/타겟) 발송', next:'회신 확인 · 견적 독촉'},
      {key:'s3', name:'견적 수령', en:'Quote received', desc:'단가 · MOQ · 납기 · 조건 확보', next:'타겟 대비 검토 · 샘플 요청'},
      {key:'s4', name:'샘플', en:'Sample', desc:'샘플 요청 · 수령 · 품질 평가', next:'샘플 평가 결과 공유'},
      {key:'s5', name:'가격 협상', en:'Negotiation', desc:'타겟 단가 맞추기 · 조건 조율', next:'최종 단가 회신 받기'},
      {key:'s6', name:'검증', en:'Verification', desc:'공장 실사 · 인증서 · 사업자 서류', next:'실사 일정 확정'},
      {key:'s7', name:'선정', en:'Awarded', desc:'발주 업체 확정 (이 모듈 안에서 완결)', next:'고객에 최종 업체 · 단가 보고'}
     ]},
    {id:'event', name:'Event · 행사', color:'#7c3aed', enabled:true, partyLabel:'협력사', partyEn:'Partner',
     stages:[
      {key:'e1', name:'기획', en:'Planning', desc:'목적 · 예산 · 일정', next:'장소 후보 확보'},
      {key:'e2', name:'섭외', en:'Booking', desc:'장소 · 협력사 섭외', next:'견적 비교'},
      {key:'e3', name:'계약', en:'Contract', desc:'계약 · 선금', next:'세부 운영안 확정'},
      {key:'e4', name:'진행', en:'Execution', desc:'행사 당일 운영', next:'정산 자료 수집'},
      {key:'e5', name:'정산', en:'Settlement', desc:'정산 · 결과 보고', next:'결과 보고서 작성'}
     ]}
  ];
}

// ── state 접근 ──
// ※ 읽기용 기본값은 non-enumerable 로 붙인다 → JSON(동기화 diff)에 안 잡혀서
//   모듈을 열기만 해도 레코드가 재저장되는(_rev 경쟁) 일이 없다. 실제 편집 시 commit()에서 materialize.
var _defCats=null;
function ST(){ return (typeof state!=='undefined' && state) ? state : {}; }
function CATS(){ var s=ST(); if(Array.isArray(s.otherCats)&&s.otherCats.length) return s.otherCats; if(!_defCats) _defCats=defaultCats(); return _defCats; }
function arr(x){ return Array.isArray(x)?x:(x&&typeof x==='object'?Object.keys(x).map(function(k){ return x[k]; }).filter(Boolean):[]); }
function defv(o,k,val){ if(o[k]===undefined||o[k]===null){ Object.defineProperty(o,k,{value:val,writable:true,configurable:true,enumerable:false}); } }
function defa(o,k){ if(Array.isArray(o[k])) return; if(o[k]&&typeof o[k]==='object'){ o[k]=arr(o[k]); return; } defv(o,k,[]); }
function normP(p){
  defa(p,'vendors'); defa(p,'priceLog'); defv(p,'status','active'); defv(p,'hqInclude',true);
  p.vendors.forEach(function(v){ defa(v,'quotes'); defa(v,'logs'); defa(v,'files'); defv(v,'next',{text:'',due:'',owner:''}); defv(v,'stage',0); defv(v,'status','active');
    v.logs.forEach(function(l){ defa(l,'files'); });
    v.quotes.forEach(function(q){ defv(q,'cur',p.currency); defv(q,'inc',p.incoterm||''); defv(q,'add',0); }); });
  return p;
}
function mat(o){ if(!o||typeof o!=='object') return; Object.getOwnPropertyNames(o).forEach(function(k){ if(Array.isArray(o)&&k==='length') return; var d=Object.getOwnPropertyDescriptor(o,k); if(d&&!d.enumerable){ var val=o[k]; delete o[k]; o[k]=val; } }); }
function matP(p){ mat(p); p.vendors.forEach(function(v){ mat(v); mat(v.next); v.quotes.forEach(mat); v.logs.forEach(mat); v.files.forEach(mat); }); p.priceLog.forEach(mat); }
function PROJS(){ var s=ST(); if(!Array.isArray(s.otherProjects)) s.otherProjects=arr(s.otherProjects); s.otherProjects.forEach(normP); return s.otherProjects; }

// ── 저장 ──
var _saveT=null;
function saveSoon(){ clearTimeout(_saveT); _saveT=setTimeout(function(){ _saveT=null; if(typeof saveState==='function') saveState(); },250); }
function commit(p){ if(p){ normP(p); matP(p); if(typeof _stampEdit==='function') _stampEdit(p); else { p._editedAt=Date.now(); p._rev=(p._rev||0)+1; } p.updatedAt=new Date().toISOString(); p.updatedBy=me(); } saveSoon(); }
function commitCfg(){ var s=ST(); if(!Array.isArray(s.otherCats)||!s.otherCats.length){ s.otherCats=CATS(); _defCats=null; } s._cfgRev=Date.now(); saveSoon(); }

// ── 날짜 ──
function iso(d){ var z=new Date(d.getTime()-d.getTimezoneOffset()*60000); return z.toISOString().slice(0,10); }
function today0(){ var d=new Date(); d.setHours(0,0,0,0); return d; }
function TODAY_S(){ return iso(today0()); }
function addDays(n){ var d=today0(); d.setDate(d.getDate()+n); return iso(d); }

// ── 유틸 ──
function E(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
function uid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,6); }
function me(){ try{ var u=(typeof cardCurrentUser==='function')?cardCurrentUser():null; return u?(u.name||''):''; }catch(e){ return ''; } }
function members(){ try{ return (typeof MEMBERS!=='undefined'&&MEMBERS)?MEMBERS.map(function(m){ return m.name; }):[]; }catch(e){ return []; } }
function cat(id){ var cs=CATS(); return cs.find(function(c){ return c.id===id; })||cs[0]; }
function proj(id){ return PROJS().find(function(p){ return p.id===id; }); }
function vend(p,id){ return p&&p.vendors.find(function(v){ return v.id===id; }); }
function num(x){ var n=parseFloat(String(x==null?'':x).replace(/,/g,'')); return isFinite(n)?n:0; }
function money(n,cur){ if(n==null||n===''||!isFinite(n)) return '—'; var d=(cur==='VND'||cur==='KRW')?0:2; return cur+' '+Number(n).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d}); }
function B(ko,en){ return en+'<span class="ko">'+ko+'</span>'; }
function T(ko,en){ return en+' / '+ko; }
function chT(c){ return CH_EN[c]?CH_EN[c]+' · '+c:c; }
function SN(s){ return s.en?E(s.en)+'<span class="ko">'+E(s.name)+'</span>':E(s.name); }
function SNt(s){ return s?(s.en?s.en+' / '+s.name:s.name):''; }
function PL(c){ return c.partyEn?E(c.partyEn)+'<span class="ko">'+E(c.partyLabel)+'</span>':E(c.partyLabel); }
function lastQuote(v){ return v.quotes&&v.quotes.length?v.quotes[v.quotes.length-1]:null; }
// 환율: 1 USD당 단위 — 프로젝트 관리 환율(state.projFxRates)을 공유, CNY 등 없는 통화는 기본값
function fxRates(){ var s=ST(); var r=(typeof _projFxRates==='function')?_projFxRates():(s.projFxRates||(s.projFxRates={})); return r; }
function fxOf(cur){ if(cur==='USD') return 1; var r=num(fxRates()[cur]); return r>0?r:(FX_DEFAULT[cur]||1); }
function conv(a,from,to){ return a/fxOf(from)*fxOf(to); }
// landed 단가 = (견적 단가 + 타겟 인코텀즈까지 단위당 추가비용) → 프로젝트 통화 환산
function landed(q,p){ if(!q) return null; return conv(num(q.price)+num(q.add), q.cur||p.currency, p.currency); }
function incMismatch(q,p){ return !!(q&&p.incoterm&&q.inc&&q.inc!==p.incoterm&&!num(q.add)); }
function origTxt(q,p){ if(!q) return ''; var same=(q.cur||p.currency)===p.currency&&!num(q.add)&&(!q.inc||q.inc===p.incoterm); if(same) return '';
  return 'Orig. '+money(num(q.price),q.cur)+(q.inc?' '+E(q.inc):'')+(num(q.add)?' + adder '+money(num(q.add),q.cur):''); }
function gap(price,target){ if(!target||price==null||price==='') return null; return (price-target)/target*100; }
function gapCls(g){ return g==null?'muted':(g<=0?'gap-good':(g<=8?'gap-near':'gap-bad')); }
function gapTxt(g){ return g==null?'':(g>0?'+':'')+g.toFixed(1)+'%'; }
function dueInfo(d){ if(!d) return {cls:'muted',txt:'No due date · 기한 없음'}; var n=Math.round((new Date(d+'T00:00:00')-today0())/864e5);
  if(n<0) return {cls:'overdue',txt:Math.abs(n)+'d overdue ('+Math.abs(n)+'일 지남) · '+d}; if(n===0) return {cls:'soon',txt:'Today (오늘) · '+d}; if(n<=2) return {cls:'soon',txt:n+'d left ('+n+'일 남음) · '+d}; return {cls:'muted',txt:n+'d left ('+n+'일 남음) · '+d}; }
function fsize(b){ return b>1e6?(b/1e6).toFixed(1)+' MB':Math.max(1,Math.round(b/1e3))+' KB'; }
function overdueCount(p){ var t=TODAY_S(); return p.vendors.filter(function(v){ return v.status==='active'&&v.next&&v.next.due&&v.next.due<t; }).length; }
// 최저 견적: 인코텀즈가 달라 가산비가 없는 견적은 비교 불가 → 제외 (과소평가 방지)
function bestQuote(p){ var b=null; p.vendors.forEach(function(v){ if(v.status==='dropped') return; var q=lastQuote(v); if(!q||incMismatch(q,p)) return; var l=landed(q,p); if(b==null||l<b.price) b={price:l,v:v,q:q}; }); return b; }
function uncomparable(p){ return p.vendors.filter(function(v){ return v.status!=='dropped'&&incMismatch(lastQuote(v),p); }).length; }
function hasPrice(x){ return x!=null&&x!==''&&isFinite(+x)&&+x>0; }

var UI={view:'list', cat:'all', pid:null, vid:null, tab:'log', adminCat:'sourcing', modal:null, showClosed:false};
var ROOT=null;
function $(id){ return document.getElementById(id); }

// ── 컨테이너 ──
function ensure(){
  if(ROOT) return ROOT;
  if(!$('otherAppCss')){ var st=document.createElement('style'); st.id='otherAppCss'; st.textContent=CSS; document.head.appendChild(st); }
  ROOT=document.createElement('div'); ROOT.id='otherApp'; ROOT.style.display='none';
  ROOT.innerHTML='<div class="app"><aside class="side" id="otSide"></aside><main class="main" id="otMain"></main></div><div id="otLayer"></div>';
  document.body.appendChild(ROOT);
  ROOT.addEventListener('click',onClick);
  ROOT.addEventListener('change',onChange);
  ROOT.addEventListener('input',function(e){ if(e.target.getAttribute&&e.target.getAttribute('data-prev')) qPrev(); });
  document.addEventListener('keydown',function(e){
    if(!ROOT||ROOT.style.display==='none') return;
    if(e.key==='Escape'){ if(UI.modal) closeModal(); else if(UI.vid){ UI.vid=null; render(); } }
    if(e.key==='Enter'){ var t=e.target.closest&&e.target.closest('#otherApp [tabindex="0"][data-act]'); if(t){ t.click(); } }
  });
  return ROOT;
}
function isOpen(){ return !!(ROOT&&ROOT.style.display!=='none'); }
window.showOtherApp=function(){
  var hub=$('hubPage'); if(hub) hub.style.display='none';
  ensure(); ROOT.style.display='block';
  if(!CATS().some(function(c){ return c.id===UI.adminCat; })) UI.adminCat=CATS()[0].id;
  render(); ROOT.scrollTop=0;
};
window.closeOtherApp=function(){ if(ROOT) ROOT.style.display='none'; UI.modal=null; UI.vid=null; if(typeof showHub==='function') showHub(); };
// 원격 동기화 반영 (index.html _applyRemote 에서 호출) — 입력/모달 중엔 보류
window.otherOnRemote=function(){
  if(!isOpen()||UI.modal) return;
  var a=document.activeElement; if(a&&ROOT.contains(a)&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return;
  render();
};
function toast(t){ ensure(); Array.prototype.forEach.call(ROOT.querySelectorAll('.otoast'),function(x){ x.remove(); }); var el=document.createElement('div'); el.className='otoast'; el.textContent=t; ROOT.appendChild(el); setTimeout(function(){ el.remove(); },2400); }

// ── 사이드바 ──
function renderSide(){
  var ps=PROJS(), cs=CATS();
  var h='<button class="nav" data-act="hub" style="font-weight:600"><span class="dot" style="background:var(--text)"></span>← Hub<span class="ko">허브</span></button>';
  h+='<div class="logo"><b>INICS</b><div>Other Projects · 그 외 업무</div></div>';
  h+='<div class="nav-sec">Categories<span class="ko">분류</span></div>';
  h+='<button class="nav'+(UI.view!=='admin'&&UI.cat==='all'?' on':'')+'" data-act="cat" data-id="all"><span class="dot" style="background:var(--text-3)"></span>All projects<span class="ko">전체 프로젝트</span><span class="cnt">'+ps.filter(function(p){ return p.status!=='closed'; }).length+'</span></button>';
  cs.filter(function(c){ return c.enabled; }).forEach(function(c){
    var n=ps.filter(function(p){ return p.catId===c.id&&p.status!=='closed'; }).length;
    h+='<button class="nav'+(UI.view!=='admin'&&UI.cat===c.id?' on':'')+'" style="--cdot:'+E(c.color)+'" data-act="cat" data-id="'+E(c.id)+'"><span class="dot" style="background:'+E(c.color)+'"></span>'+E(c.name)+'<span class="cnt">'+n+'</span></button>';
  });
  h+='<div class="nav-sec">Admin<span class="ko">관리</span></div>';
  h+='<button class="nav'+(UI.view==='admin'?' on':'')+'" style="--cdot:var(--admin)" data-act="admin"><span class="dot" style="background:var(--admin)"></span>Admin<span class="ko">관리자</span></button>';
  h+='<div class="side-foot">Anyone with module access can view and edit all projects.<br><span style="opacity:.75">모듈 권한이 있으면 모든 프로젝트를 열람·수정할 수 있어요.</span></div>';
  $('otSide').innerHTML=h;
}

// ── 프로젝트 목록 ──
function renderList(){
  var c=UI.cat==='all'?null:cat(UI.cat);
  var all=PROJS().filter(function(p){ return !c||p.catId===c.id; });
  var closedN=all.filter(function(p){ return p.status==='closed'; }).length;
  var list=all.filter(function(p){ return UI.showClosed||p.status!=='closed'; });
  var h='<div class="crumb">Other Projects · 그 외 업무</div><div class="row"><div><h1>'+(c?E(c.name):'All projects<span class="ko">전체 프로젝트</span>')+'</h1><p class="sub">'+(c?'Stages follow the process defined in the admin panel<br><span class="muted">진행 단계는 관리자 패널에서 정의한 프로세스를 따릅니다</span>':'All non-furniture work, organized by category<br><span class="muted">가구 프로젝트 외의 모든 업무를 분류별로 관리합니다</span>')+'</p></div><span class="spacer"></span>'
    +(closedN?'<button class="obtn ghost sm" data-act="toggleClosed">'+(UI.showClosed?'Hide closed':'Show closed')+'<span class="ko">'+(UI.showClosed?'종료 숨기기':'종료 보기')+' '+closedN+'</span></button>':'')
    +'<button class="obtn pri" data-act="newProj">+ New project<span class="ko">새 프로젝트</span></button></div>';
  if(!list.length){ h+='<div class="empty">No projects yet — create one to get started.<br>아직 프로젝트가 없어요. 새 프로젝트를 만들어 시작하세요.</div>'; $('otMain').innerHTML=h; return; }
  h+='<div class="plist">';
  list.forEach(function(p){
    var cc=cat(p.catId), act=p.vendors.filter(function(v){ return v.status==='active'; }), b=bestQuote(p), od=overdueCount(p);
    var g=b?gap(b.price,p.target):null;
    var funnel=cc.stages.map(function(s,i){ var n=act.filter(function(v){ return v.stage>=i; }).length; return '<span style="'+(n?'background:'+E(cc.color)+';opacity:'+(0.25+0.75*n/Math.max(1,act.length)):'')+'"></span>'; }).join('');
    h+='<div class="card pcard" style="--cc:'+E(cc.color)+(p.status==='closed'?';opacity:.6':'')+'" data-act="open" data-id="'+E(p.id)+'" tabindex="0">'
      +'<div class="row"><span class="tag"><span class="dot" style="background:'+E(cc.color)+'"></span>'+E(cc.name)+'</span>'+(p.status==='closed'?'<span class="tag">Closed · 종료</span>':'')+(od?'<span class="tag" style="background:var(--danger-bg);color:var(--danger)">Overdue · 기한 지난 액션 '+od+'</span>':'')+'</div>'
      +'<h3>'+E(p.name)+'</h3><div class="small muted">'+E(p.client)+' · Owner 담당 '+E(p.owner)+'</div>'
      +'<dl class="kv">'
      +(p.target?'<dt>Target<span class="ko">타겟 단가</span></dt><dd class="num">'+money(p.target,p.currency)+(p.incoterm?' '+E(p.incoterm):'')+'</dd>':'')
      +(p.target?'<dt>Best landed<span class="ko">최저 견적 (환산)</span></dt><dd class="num '+gapCls(g)+'">'+(b?money(b.price,p.currency)+' <span class="small">('+gapTxt(g)+')</span>':'—')+'</dd>':'')
      +(p.target&&uncomparable(p)?'<dt></dt><dd class="small gap-near">Not comparable · 비교 불가 '+uncomparable(p)+'</dd>':'')
      +(hasPrice(p.hqPrice)?'<dt>HQ report<span class="ko">본사 보고 단가</span></dt><dd class="num"><b>'+money(num(p.hqPrice),p.currency)+'</b></dd>':'')
      +'<dt>Active<span class="ko">진행 '+E(cc.partyLabel)+'</span></dt><dd>'+act.length+' / '+p.vendors.length+'</dd>'
      +'<dt>Deadline<span class="ko">마감</span></dt><dd>'+E(p.deadline||'—')+'</dd></dl>'
      +'<div class="mini-funnel" title="Vendors reached per stage / 단계별 도달 업체 수">'+funnel+'</div></div>';
  });
  h+='</div>';
  $('otMain').innerHTML=h;
}

// ── 단가 패널 (네고 단가 · 본사 보고용 단가) ──
function priceCard(p){
  var b=bestQuote(p), ng=hasPrice(p.negoPrice)?num(p.negoPrice):null, hq=hasPrice(p.hqPrice)?num(p.hqPrice):null;
  var gN=gap(ng,p.target), gH=gap(hq,p.target), terms=E(p.currency)+(p.incoterm?' '+E(p.incoterm):'')+(p.unit?' · per '+E(p.unit):'');
  var h='<div class="card pricebox">';
  h+='<div><div class="lb">Negotiating price<span class="ko">현재 네고 단가</span> <span class="ptag int">Internal · 내부용</span></div>'
    +'<div class="mid num '+gapCls(gN)+'">'+(ng!=null?money(ng,p.currency):'—')+'</div>'
    +'<div class="small '+gapCls(gN)+'">'+(ng!=null&&p.target?'vs target '+gapTxt(gN):'<span class="muted">'+terms+'</span>')+'</div>'
    +(p.negoNote?'<div class="small" style="margin-top:4px">'+E(p.negoNote)+'</div>':'')
    +(b?'<div class="orig" style="margin-top:4px">Best landed now · 현재 최저 환산: '+money(b.price,p.currency)+' ('+E(b.v.name)+')</div>':'')
    +'</div>';
  h+='<div class="hqcol"><div class="lb">HQ report price<span class="ko">본사 보고용 단가</span> <span class="ptag hq">'+(p.hqInclude?'HQ weekly report · 본사 주간 보고':'Excluded · 보고 제외')+'</span></div>'
    +'<div class="mid num '+gapCls(gH)+'">'+(hq!=null?money(hq,p.currency):'—')+'</div>'
    +'<div class="small '+gapCls(gH)+'">'+(hq!=null&&p.target?'vs target '+gapTxt(gH):'<span class="muted">'+terms+'</span>')+'</div>'
    +(p.hqNote?'<div class="small" style="margin-top:4px">'+E(p.hqNote)+'</div>':'')
    +(p.hqAt?'<div class="orig" style="margin-top:4px">Updated · 갱신 '+E(p.hqAt)+(p.hqBy?' · '+E(p.hqBy):'')+'</div>':'')
    +'</div>';
  h+='<div style="display:flex;align-items:flex-start;justify-content:flex-end"><button class="obtn sm" data-act="editPrice">Edit prices<span class="ko">단가 수정</span></button></div>';
  h+='</div>';
  return h;
}

// ── 프로젝트 상세 ──
function renderProject(){
  var p=proj(UI.pid); if(!p){ UI.view='list'; UI.vid=null; return renderList(); }
  var cc=cat(p.catId), st=cc.stages, act=p.vendors.filter(function(v){ return v.status==='active'; });
  var b=bestQuote(p), g=b?gap(b.price,p.target):null;
  var h='<div class="crumb"><a data-act="cat" data-id="'+E(p.catId)+'">'+E(cc.name)+'</a> / '+E(p.name)+'</div>';
  h+='<div class="row"><div><h1>'+E(p.name)+(p.status==='closed'?' <span class="tag">Closed · 종료</span>':'')+'</h1><p class="sub">'+E(p.client)+' · '+E(p.item)+(p.spec?' · '+E(p.spec):'')+' · Owner 담당 '+E(p.owner||'—')+'</p></div><span class="spacer"></span><button class="obtn" data-act="editProj">Edit project<span class="ko">프로젝트 정보 수정</span></button><button class="obtn pri" data-act="newVendor">+ Add '+E(cc.partyEn||cc.partyLabel)+'<span class="ko">'+E(cc.partyLabel)+' 추가</span></button></div>';
  if(p.target||p.qty){
    h+='<div class="card target">'
      +'<div><div class="lb">Customer target<span class="ko">고객 타겟 단가</span></div><div class="big num">'+money(p.target,p.currency)+'</div><div class="small muted">'+E(p.incoterm||'')+' · per '+E(p.unit||'unit')+' ('+E(p.unit||'')+'당)</div></div>'
      +'<div><div class="lb">Best landed quote · '+E(p.incoterm||'')+'<span class="ko">현재 최저 견적 환산</span></div><div class="mid num '+gapCls(g)+'">'+(b?money(b.price,p.currency):'—')+'</div><div class="small '+gapCls(g)+'">'+(b?'vs target '+gapTxt(g)+' · '+E(b.v.name):'No quotes · 견적 없음')+'</div>'+(b&&origTxt(b.q,p)?'<div class="orig">'+origTxt(b.q,p)+'</div>':'')+(uncomparable(p)?'<div class="small gap-near" style="margin-top:2px">'+uncomparable(p)+' not comparable (Incoterm differs, no adder)<br><span class="muted">비교 불가 '+uncomparable(p)+'건 (인코텀즈 다름 · 가산비 미입력)</span></div>':'')+'</div>'
      +'<div><div class="lb">Quantity<span class="ko">수량</span></div><div class="mid num">'+(p.qty?Number(p.qty).toLocaleString('en-US')+' '+E(p.unit):'—')+'</div><div class="small muted">Target total · 타겟 총액 '+(p.target&&p.qty?money(p.target*p.qty,p.currency):'—')+'</div></div>'
      +'<div><div class="lb">Deadline<span class="ko">마감일</span></div><div class="mid">'+E(p.deadline||'—')+'</div><div class="small '+dueInfo(p.deadline).cls+'">'+dueInfo(p.deadline).txt.split(' · ')[0]+'</div></div>'
      +'<div><div class="lb">Overdue actions<span class="ko">기한 지난 다음 액션</span></div><div class="mid '+(overdueCount(p)?'overdue':'')+'">'+overdueCount(p)+'</div><div class="small muted">Active 진행 '+act.length+' · Dropped/Hold 탈락/보류 '+(p.vendors.length-act.length)+'</div></div>'
      +'</div>';
  }
  h+=priceCard(p);
  // 프로세스
  h+='<div class="process" aria-label="Vendors per stage / 프로세스 단계별 업체 수">';
  st.forEach(function(s,i){ var n=act.filter(function(v){ return v.stage===i; }).length;
    h+='<div class="pstep'+(n?' has':'')+'" title="'+E(s.desc)+'"><div class="n">Stage '+(i+1)+' · '+(i+1)+'단계</div><div class="t">'+SN(s)+'</div><div class="c">'+n+'</div></div>'; });
  h+='</div>';
  // 업체 표
  var vs=p.vendors.slice().sort(function(a,b){ if(a.status!==b.status) return a.status==='active'?-1:1; var da=(a.next&&a.next.due)||'9999', db=(b.next&&b.next.due)||'9999'; return da<db?-1:da>db?1:0; });
  h+='<div class="card tbl-wrap"><table><thead><tr><th>'+PL(cc)+'</th><th>Stage<span class="ko">진행 단계</span></th><th class="r">Latest quote ('+E(p.currency)+' '+E(p.incoterm||'')+' landed)<span class="ko">최근 견적 환산</span></th><th class="r">vs Target<span class="ko">타겟 대비</span></th><th>MOQ · Lead<span class="ko">납기</span></th><th>Next action<span class="ko">다음 액션</span></th><th>Last contact<span class="ko">최근 연락</span></th></tr></thead><tbody>';
  vs.forEach(function(v){
    var q=lastQuote(v), lq=landed(q,p), gg=q?gap(lq,p.target):null, lastLog=v.logs.length?v.logs.map(function(l){ return l.date; }).sort().pop():'—', di=dueInfo(v.next&&v.next.due);
    var track=st.map(function(s,i){ return '<i class="'+(i<v.stage?'done':(i===v.stage?'now':''))+'"></i>'; }).join('');
    var stTag=v.status==='dropped'?'<span class="tag" style="background:var(--danger-bg);color:var(--danger)">Dropped · 탈락</span>':(v.status==='hold'?'<span class="tag" style="background:var(--warn-bg);color:var(--warn)">On hold · 보류</span>':'');
    h+='<tr class="vrow'+(v.status!=='active'?' dim':'')+(UI.vid===v.id?' sel':'')+'" data-act="vendor" data-id="'+E(v.id)+'" tabindex="0">'
      +'<td><b>'+E(v.name)+'</b> <span class="tag">'+E(v.country)+'</span> '+stTag+'<div class="small muted">'+E(v.contact||'Contact unknown · 담당자 미확인')+'</div></td>'
      +'<td><div class="track">'+track+'</div><div class="stg-name">'+(v.stage+1)+'. '+(st[v.stage]?SN(st[v.stage]):'')+'</div></td>'
      +'<td class="r num">'+(q?money(lq,p.currency)+(incMismatch(q,p)?'<span class="incw" title="Incoterm differs from target and no adder entered / 견적 인코텀즈가 타겟과 다른데 추가비용이 0이에요">No adder · 가산 미입력</span>':''):'<span class="muted">—</span>')+(q&&origTxt(q,p)?'<div class="orig">'+origTxt(q,p)+'</div>':'')+'<div class="small muted">'+(q?E(q.date):'')+'</div></td>'
      +'<td class="r num '+(incMismatch(q,p)?'muted':gapCls(gg))+'"><b>'+gapTxt(gg)+(incMismatch(q,p)?' ?':'')+'</b></td>'
      +'<td class="small">'+(q?(q.moq&&q.moq!=='-'?'MOQ '+E(q.moq):'MOQ —')+'<br>'+(q.lead&&q.lead!=='-'?E(q.lead)+' days':'—'):'<span class="muted">—</span>')+'</td>'
      +'<td class="next">'+(v.status==='dropped'?'<span class="small muted">'+E(v.dropReason||'')+'</span>':(v.next&&v.next.text?E(v.next.text)+'<div class="due '+di.cls+'">'+di.txt+(v.next.owner?' · '+E(v.next.owner):'')+'</div>':'<span class="overdue small">Not set · 다음 액션 미정</span>'))+'</td>'
      +'<td class="small muted">'+E(lastLog)+'<br>'+v.logs.length+' logs</td></tr>';
  });
  if(!vs.length) h+='<tr><td colspan="7" class="muted" style="text-align:center;padding:30px">No '+E((cc.partyEn||'party').toLowerCase())+'s yet — add the ones you are talking to.<br>아직 '+E(cc.partyLabel)+'가 없어요. 컨택 중인 '+E(cc.partyLabel)+'를 추가하세요.</td></tr>';
  h+='</tbody></table></div>';
  $('otMain').innerHTML=h;
}

// ── 업체 드로어 ──
function renderDrawer(){
  var p=proj(UI.pid), v=vend(p,UI.vid);
  if(!p||!v){ UI.vid=null; return ''; }
  var cc=cat(p.catId), st=cc.stages, T0=TODAY_S();
  var h='<div class="scrim" data-act="closeDrawer"></div><aside class="drawer" role="dialog" aria-label="'+E(v.name)+'">';
  h+='<div class="dr-head"><div class="row"><h2>'+E(v.name)+'</h2><span class="tag">'+E(v.country)+'</span><span class="spacer"></span><button class="obtn ghost sm" data-act="editVendor">Edit<span class="ko">수정</span></button><button class="obtn ghost sm" data-act="closeDrawer" aria-label="Close / 닫기">Close<span class="ko">닫기</span></button></div>';
  h+='<div class="small muted" style="margin-top:3px">'+E(v.contact||'No contact info · 담당자 정보 없음')+'</div>';
  h+='<div class="stagebar">'+st.map(function(s,i){ return '<button class="'+(i<v.stage?'done':(i===v.stage?'now':''))+'" data-act="setStage" data-i="'+i+'" title="'+E(s.desc)+'">'+(i+1)+'<br>'+SN(s)+'</button>'; }).join('')+'</div>';
  h+='<div class="row small" style="margin-top:6px"><span class="muted">'+E(st[v.stage]?st[v.stage].desc:'')+'</span><span class="spacer"></span>'
    +'<select data-act="status" aria-label="Status / 상태" style="border:1px solid var(--border);border-radius:6px;padding:3px 6px;font-size:11px;background:var(--surface)">'
    +['active:Active · 진행 중','hold:On hold · 보류','dropped:Dropped · 탈락'].map(function(x){ var k=x.split(':'); return '<option value="'+k[0]+'"'+(v.status===k[0]?' selected':'')+'>'+k[1]+'</option>'; }).join('')+'</select></div>';
  h+='</div><div class="dr-body">';
  var di=dueInfo(v.next&&v.next.due), od=v.next&&v.next.due&&v.next.due<=T0;
  h+='<div class="sec" style="margin-top:0"><div class="sec-h"><b>Next action<span class="ko">다음 액션</span></b><span class="spacer"></span>'+(v.next&&v.next.text?'<button class="obtn sm" data-act="doneNext">Complete<span class="ko">완료 처리</span></button>':'')+'<button class="obtn sm" data-act="editNext">Edit<span class="ko">수정</span></button></div>';
  if(v.status==='dropped') h+='<div class="nextbox ok"><div class="what">Dropped<span class="ko">탈락 처리됨</span></div><div class="small muted">'+E(v.dropReason||'No reason given · 사유 미입력')+'</div></div>';
  else if(v.next&&v.next.text) h+='<div class="nextbox'+(od?'':' ok')+'"><div class="what">'+E(v.next.text)+'</div><div class="small '+di.cls+'" style="margin-top:3px">'+di.txt+' · Owner 담당 '+E(v.next.owner||'-')+'</div></div>';
  else h+='<div class="nextbox"><div class="what">No next action set<span class="ko">다음 액션이 정해지지 않았어요</span></div><div class="small" style="margin-top:3px">Suggested 추천: '+E(st[v.stage]?st[v.stage].next:'')+' <button class="obtn sm" data-act="useSuggest" style="margin-left:6px">Use this<span class="ko">이걸로 지정</span></button></div></div>';
  h+='</div>';
  if(p.target && v.quotes.length){
    var prices=v.quotes.map(function(q){ return landed(q,p); }).concat([p.target]);
    var mn=Math.min.apply(null,prices), mx=Math.max.apply(null,prices), span=(mx-mn)||1, pad=span*0.12; mn-=pad; mx+=pad; span=mx-mn;
    var pos=function(x){ return ((x-mn)/span*100).toFixed(1)+'%'; };
    h+='<div class="sec"><div class="sec-h"><b>Quote trend<span class="ko">견적 추이</span></b><span class="small muted">Dots: '+E(p.incoterm||'')+' landed quotes · Line: target '+money(p.target,p.currency)+'</span></div><div class="qbar"><div class="line"></div><div class="tgt" style="left:'+pos(p.target)+'"></div>'
      +v.quotes.map(function(q,i){ var lq2=landed(q,p), g2=gap(lq2,p.target); var col=g2<=0?'var(--accent)':(g2<=8?'var(--warn)':'var(--danger)'); return '<div class="pt" title="'+E(q.date)+' · '+money(lq2,p.currency)+'" style="left:'+pos(lq2)+';background:'+col+';opacity:'+(0.35+0.65*(i+1)/v.quotes.length)+'"></div>'; }).join('')
      +'</div></div>';
  }
  var tabs=[['log','Log<span class="ko">대화 로그</span> '+v.logs.length],['quote','Quotes<span class="ko">견적 이력</span> '+v.quotes.length],['file','Files<span class="ko">파일</span> '+v.files.length]];
  h+='<div class="tabs" role="tablist">'+tabs.map(function(t){ return '<button role="tab" class="'+(UI.tab===t[0]?'on':'')+'" data-act="tab" data-id="'+t[0]+'">'+t[1]+'</button>'; }).join('')+'</div>';
  if(UI.tab==='log'){
    h+='<div style="margin-top:12px"><button class="obtn pri sm" data-act="newLog">+ Add log<span class="ko">대화 기록 추가</span></button></div><div class="timeline">';
    var logs=v.logs.slice().sort(function(a,b){ return a.date<b.date?1:a.date>b.date?-1:((b.at||0)-(a.at||0)); }), lastDay=null;
    if(!logs.length) h+='<div class="empty" style="margin-top:12px;padding:24px">No logs yet — record each contact by date.<br>아직 기록이 없어요. 연락한 내용을 날짜별로 남겨두세요.</div>';
    logs.forEach(function(l){
      if(l.date!==lastDay){ h+='<div class="tday">'+E(l.date)+'</div>'; lastDay=l.date; }
      var cls=l.dir==='in'?'ch-in':(l.dir==='memo'?'ch-memo':'ch-out'), dirTxt=l.dir==='in'?'In<br>받음':(l.dir==='memo'?'Memo<br>메모':'Out<br>보냄');
      h+='<div class="log"><div class="ch '+cls+'">'+(l.ch==='메모'&&l.dir==='memo'?'':(CH_EN[l.ch]?CH_EN[l.ch]+' '+E(l.ch):E(l.ch))+'<br>')+dirTxt+'</div><div><p>'+E(l.text)+'</p>'
        +(l.files.length?'<div>'+l.files.map(function(fid){ var f=v.files.find(function(x){ return x.id===fid; }); return f?fileChip(f):''; }).join('')+'</div>':'')
        +(l.quote?'<div class="meta">Quote 견적: '+money(num(l.quote),l.qcur||p.currency)+'</div>':'')
        +(l.stageTo!=null?'<div class="meta">Stage 단계 → '+(st[l.stageTo]?SN(st[l.stageTo]):'')+'</div>':'')
        +(l.by?'<div class="meta">by '+E(l.by)+'</div>':'')
        +'</div></div>';
    });
    h+='</div>';
  } else if(UI.tab==='quote'){
    h+='<div style="margin-top:12px"><button class="obtn pri sm" data-act="newQuote">+ Record quote<span class="ko">견적 기록</span></button></div>';
    if(!v.quotes.length) h+='<div class="empty" style="margin-top:12px;padding:24px">No quotes yet. 받은 견적이 없어요.</div>';
    else{ h+='<div class="tbl-wrap" style="margin-top:10px"><table style="min-width:0"><thead><tr><th>Date<span class="ko">날짜</span></th><th class="r">Quoted<span class="ko">원견적</span></th><th class="r">Adder<span class="ko">가산</span></th><th class="r">Landed ('+E(p.currency)+' '+E(p.incoterm||'')+')<span class="ko">환산</span></th><th class="r">vs Target<span class="ko">타겟 대비</span></th><th>MOQ · Lead<span class="ko">납기</span></th><th>Note<span class="ko">메모</span></th></tr></thead><tbody>';
      v.quotes.slice().reverse().forEach(function(q){ var lq3=landed(q,p), g3=gap(lq3,p.target); h+='<tr><td class="small">'+E(q.date)+'</td><td class="r num">'+money(num(q.price),q.cur)+'<div class="orig">'+E(q.inc||'')+'</div></td><td class="r num small" title="'+E(q.addNote||'')+'">'+(num(q.add)?money(num(q.add),q.cur):(incMismatch(q,p)?'<span class="incw">Missing · 미입력</span>':'—'))+'</td><td class="r num"><b>'+money(lq3,p.currency)+'</b></td><td class="r num '+gapCls(g3)+'">'+gapTxt(g3)+'</td><td class="small">'+E(q.moq)+' · '+E(q.lead)+'d</td><td class="small muted">'+E(q.note)+(q.addNote?'<div>Adder 가산: '+E(q.addNote)+'</div>':'')+'</td></tr>'; });
      h+='</tbody></table></div>'; }
  } else {
    h+='<div style="margin-top:12px" class="row"><label class="obtn pri sm" style="cursor:pointer">+ Upload<span class="ko">파일 올리기</span><input type="file" multiple data-act="upload" style="display:none"></label><span class="small muted">Stored in Firebase Storage, path only in DB / 외부 저장소에 저장 · DB에는 경로만 기록</span></div>';
    if(!v.files.length) h+='<div class="empty" style="margin-top:12px;padding:24px">No files — upload quotes, specs, sample photos.<br>파일이 없어요. 견적서, 사양서, 샘플 사진을 올려두세요.</div>';
    v.files.slice().reverse().forEach(function(f){ var ext=(String(f.name||'').split('.').pop()||'').toUpperCase().slice(0,4);
      h+='<div class="file"><span class="ext">'+E(ext)+'</span><div style="flex:1;min-width:0"><div>'+(f.url?'<a href="'+E(f.url)+'" target="_blank" rel="noopener">'+E(f.name)+'</a>':E(f.name))+'</div><div class="path">'+E(f.path||'')+'</div></div><span class="small muted">'+fsize(f.size||0)+'<br>'+E(f.date)+(f.by?'<br>'+E(f.by):'')+'</span></div>'; });
  }
  h+='</div></aside>';
  return h;
}
function fileChip(f){ return f.url?'<a class="chip-file" href="'+E(f.url)+'" target="_blank" rel="noopener">📎 '+E(f.name)+'</a>':'<span class="chip-file">📎 '+E(f.name)+'</span>'; }

// ── 관리자 ──
function renderAdmin(){
  var c=cat(UI.adminCat), ps=PROJS(), fx=fxRates();
  var h='<div class="crumb">Other Projects / Admin · 관리자 패널</div><h1>Categories & Process<span class="ko">분류 · 프로세스 관리</span></h1><p class="sub">Add categories and define each one’s stages and suggested next actions.<br><span class="muted">분류를 추가하고, 분류마다 진행 단계(프로세스)와 단계별 추천 다음 액션을 정합니다.</span></p>';
  h+='<div class="oadmin-grid"><div><div class="card">';
  CATS().forEach(function(x){ var n=ps.filter(function(p){ return p.catId===x.id; }).length;
    h+='<div class="cat-item'+(x.id===c.id?' on':'')+'" data-act="adminCat" data-id="'+E(x.id)+'"><span class="dot" style="background:'+E(x.color)+'"></span><span style="flex:1">'+E(x.name)+'</span>'+(x.enabled?'':'<span class="tag">Hidden · 숨김</span>')+'<span class="small muted">'+n+' projects</span></div>'; });
  h+='</div><button class="obtn" style="margin-top:10px;width:100%;justify-content:center" data-act="newCat">+ Add category<span class="ko">분류 추가</span></button>';
  h+='<div class="note" style="margin-top:12px"><b>Access 권한:</b> Anyone with module access (Admin → module permissions) can view and edit all projects.<br><span class="muted">모듈 권한이 있으면 모든 프로젝트를 열람·수정할 수 있어요 (담당자 제한 없음).</span><br><b>Award 선정:</b> Self-contained — no link to furniture projects, PR or vendor DB.<br><span class="muted">다른 모듈과 연동하지 않고 이 모듈 안에서 완결돼요.</span></div>';
  h+='<div class="card pad" style="margin-top:12px"><b>FX for quote comparison<span class="ko">견적 비교 환율</span></b><div class="small muted" style="margin-top:2px">Units per 1 USD · shared with Projects module FX<br>1 USD 기준 · 프로젝트 관리 환율과 공유</div><div class="fx-grid">'+CURS.map(function(k){ return '<div><label>'+k+'</label><input data-fx="'+k+'" inputmode="decimal" value="'+E(k==='USD'?1:fxOf(k))+'"'+(k==='USD'?' disabled':'')+'></div>'; }).join('')+'</div></div></div>';
  h+='<div class="card pad"><div class="form">'
    +'<div class="ofg"><label>Category name<span class="ko">분류 이름</span></label><input data-cf="name" value="'+E(c.name)+'"></div>'
    +'<div class="ofg"><label>Counterparty label (KO)<span class="ko">상대방 호칭</span></label><input data-cf="partyLabel" value="'+E(c.partyLabel)+'"></div>'
    +'<div class="ofg"><label>Counterparty label (EN)<span class="ko">상대방 호칭 (영문)</span></label><input data-cf="partyEn" value="'+E(c.partyEn||'')+'" placeholder="Vendor / Partner"></div>'
    +'<div class="ofg"><label>Color<span class="ko">색상</span></label><input type="color" data-cf="color" value="'+E(c.color)+'" style="height:34px;padding:2px"></div>'
    +'<div class="ofg"><label>Visibility<span class="ko">표시</span></label><select data-cf="enabled"><option value="1"'+(c.enabled?' selected':'')+'>On · 사용</option><option value="0"'+(!c.enabled?' selected':'')+'>Hidden · 숨김</option></select></div>'
    +'</div>';
  h+='<div class="sec"><div class="sec-h"><b>Stages<span class="ko">프로세스 단계</span></b><span class="small muted">Free movement, logged · last stage = done / 앞뒤 자유 이동 · 마지막 단계 = 완료</span><span class="spacer"></span><button class="obtn sm" data-act="addStage">+ Add stage<span class="ko">단계 추가</span></button></div>';
  h+='<div class="stage-ed small muted" style="font-weight:600;border-bottom:1px solid var(--border-strong)"><span>#</span><span>Stage name (KO/EN)<span class="ko">단계 이름</span></span><span>Description / Suggested action<span class="ko">설명 / 추천 다음 액션</span></span><span></span></div>';
  c.stages.forEach(function(s,i){
    h+='<div class="stage-ed"><span class="muted num">'+(i+1)+'</span><div><input data-sf="name" data-i="'+i+'" value="'+E(s.name)+'"><input data-sf="en" data-i="'+i+'" value="'+E(s.en||'')+'" placeholder="English name" style="margin-top:4px"></div><div><input data-sf="desc" data-i="'+i+'" value="'+E(s.desc)+'" placeholder="What happens here / 이 단계에서 하는 일"><input data-sf="next" data-i="'+i+'" value="'+E(s.next)+'" placeholder="Suggested next action / 추천 다음 액션" style="margin-top:4px"></div>'
      +'<span class="row" style="gap:2px"><button class="obtn ghost sm" data-act="mvStage" data-i="'+i+'" data-d="-1" aria-label="Up / 위로"'+(i===0?' disabled':'')+'>▲</button><button class="obtn ghost sm" data-act="mvStage" data-i="'+i+'" data-d="1" aria-label="Down / 아래로"'+(i===c.stages.length-1?' disabled':'')+'>▼</button><button class="obtn ghost sm danger" data-act="rmStage" data-i="'+i+'" aria-label="Delete / 삭제">✕</button></span></div>';
  });
  h+='</div><div class="note" style="margin-top:14px">Deleting a stage moves its '+E((c.partyEn||'party').toLowerCase())+'s back one stage, effective immediately.<br><span class="muted">단계를 삭제하면 그 단계에 있던 '+E(c.partyLabel)+'는 바로 앞 단계로 옮겨집니다. 진행 중인 프로젝트에도 즉시 적용돼요.</span></div></div></div>';
  $('otMain').innerHTML=h;
}

// ── 모달 ──
function modal(title,body,okAct,okTxt,extra){
  UI.modal=true;
  $('otLayer').innerHTML=(UI.vid?renderDrawer():'')+'<div class="omodal"><div class="scrim" data-act="closeModal" style="z-index:-1"></div><div class="card pad"><div class="row"><b style="font-size:15px">'+E(title)+'</b><span class="spacer"></span><button class="obtn ghost sm" data-act="closeModal">Close<span class="ko">닫기</span></button></div><div style="margin-top:14px">'+body+'</div><div class="row" style="margin-top:16px;justify-content:flex-end">'+(extra||'')+'<span class="spacer"></span><button class="obtn" data-act="closeModal">Cancel<span class="ko">취소</span></button><button class="obtn pri" data-act="'+okAct+'">'+(okTxt||'Save<span class="ko">저장</span>')+'</button></div></div></div>';
  var f=ROOT.querySelector('.omodal input:not([type=file]),.omodal textarea'); if(f) f.focus();
}
function fv(id){ var el=$(id); return el?String(el.value).trim():''; }
function closeModal(){ UI.modal=null; renderLayer(); }
function ownerSelect(id,val){ var ms=members(); if(val&&ms.indexOf(val)<0) ms=[val].concat(ms);
  return '<select id="'+id+'"><option value="">—</option>'+ms.map(function(n){ return '<option'+(n===val?' selected':'')+'>'+E(n)+'</option>'; }).join('')+'</select>'; }

function quoteFields(p,v){
  var lq=lastQuote(v), cur=(lq&&lq.cur)||p.currency, inc=(lq&&lq.inc)||p.incoterm||'';
  return '<div class="ofg"><label>Quote currency<span class="ko">견적 통화</span></label><select id="m_qc" data-prev="1">'+CURS.map(function(c){ return '<option'+(c===cur?' selected':'')+'>'+c+'</option>'; }).join('')+'</select></div>'
    +'<div class="ofg"><label>Quote Incoterm<span class="ko">견적 인코텀즈</span></label><select id="m_qi" data-prev="1"><option value="">—</option>'+INCS.map(function(c){ return '<option'+(c===inc?' selected':'')+'>'+c+'</option>'; }).join('')+'</select></div>'
    +'<div class="ofg"><label>Adder per unit to '+E(p.incoterm||'target terms')+' (quote currency)<span class="ko">단위당 추가비용 → '+E(p.incoterm||'타겟 조건')+'까지</span></label><input id="m_qa" data-prev="1" inputmode="decimal" placeholder="Freight, customs, duty / 운송·통관·관세 등"></div>'
    +'<div class="ofg"><label>Adder note<span class="ko">추가비용 내역</span></label><input id="m_qan" placeholder="e.g. inland to port / 공장→항구 내륙운송"></div>'
    +'<div class="landed-prev" id="m_prev"></div>';
}
function qPrev(){
  var box=$('m_prev'); if(!box) return; var p=proj(UI.pid); if(!p) return;
  var pi=$('m_qp')||$('m_lq');
  var pr=num(pi&&pi.value), add=num(fv('m_qa')), cur=fv('m_qc'), inc=fv('m_qi');
  if(!(pr>0)){ box.innerHTML='<span class="muted">Enter a price to see the landed price vs target.<br>단가를 넣으면 '+E(p.currency)+' '+E(p.incoterm||'')+' 기준 환산 단가와 타겟 대비가 바로 계산돼요.</span>'; return; }
  var q={price:pr,add:add,cur:cur,inc:inc}, l=landed(q,p), g=gap(l,p.target);
  box.innerHTML='Landed 환산 단가 <b class="num">'+money(l,p.currency)+'</b>'+(p.target?' · vs target 타겟 대비 <b class="'+gapCls(g)+'">'+gapTxt(g)+'</b>':'')
    +(cur!==p.currency?'<br><span class="muted">FX 환율 1 USD = '+fxOf(cur)+' '+E(cur)+' / '+fxOf(p.currency)+' '+E(p.currency)+'</span>':'')
    +(incMismatch(q,p)?'<br><span class="gap-near">Quote '+E(inc)+' ≠ target '+E(p.incoterm)+' — enter the adder for an accurate comparison<br>추가비용을 넣어야 비교가 정확해요</span>':'');
}
function readQuoteExtra(q){ q.cur=fv('m_qc'); q.inc=fv('m_qi'); q.add=num(fv('m_qa')); var an=fv('m_qan'); if(an) q.addNote=an; return q; }
function projForm(p){
  var isNew=!p;
  p=p||{catId:(UI.cat!=='all'?UI.cat:CATS()[0].id),currency:'USD',unit:'EA',incoterm:'FOB',owner:me(),status:'active',hqInclude:true};
  return '<div class="form">'
    +'<div class="ofg"><label>Category<span class="ko">분류</span></label><select id="m_cat">'+CATS().filter(function(c){ return c.enabled||c.id===p.catId; }).map(function(c){ return '<option value="'+E(c.id)+'"'+(c.id===p.catId?' selected':'')+'>'+E(c.name)+'</option>'; }).join('')+'</select></div>'
    +'<div class="ofg"><label>Customer<span class="ko">고객사</span></label><input id="m_client" value="'+E(p.client||'')+'" placeholder="e.g. RSQUARE"></div>'
    +'<div class="ofg full"><label>Project name<span class="ko">프로젝트명</span></label><input id="m_name" value="'+E(p.name||'')+'" placeholder="e.g. Mesh office chair 500EA"></div>'
    +'<div class="ofg full"><label>Item<span class="ko">품목</span></label><input id="m_item" value="'+E(p.item||'')+'"></div>'
    +'<div class="ofg full"><label>Spec<span class="ko">요구 사양</span></label><input id="m_spec" value="'+E(p.spec||'')+'"></div>'
    +'<div class="ofg"><label>Customer target price<span class="ko">고객 타겟 단가</span></label><input id="m_target" inputmode="decimal" value="'+E(p.target||'')+'"></div>'
    +'<div class="ofg"><label>Currency<span class="ko">통화</span></label><select id="m_cur">'+CURS.map(function(c){ return '<option'+(c===p.currency?' selected':'')+'>'+c+'</option>'; }).join('')+'</select></div>'
    +'<div class="ofg"><label>Quantity<span class="ko">수량</span></label><input id="m_qty" inputmode="numeric" value="'+E(p.qty||'')+'"></div>'
    +'<div class="ofg"><label>Unit · Incoterm<span class="ko">단위 · 인코텀즈</span></label><div class="row" style="flex-wrap:nowrap"><input id="m_unit" value="'+E(p.unit||'')+'" style="width:50%"><select id="m_inc" style="width:50%"><option value="">—</option>'+INCS.map(function(c){ return '<option'+(c===p.incoterm?' selected':'')+'>'+c+'</option>'; }).join('')+'</select></div></div>'
    +'<div class="ofg"><label>Deadline<span class="ko">마감일</span></label><input type="date" id="m_dl" value="'+E(p.deadline||'')+'"></div>'
    +'<div class="ofg"><label>Owner<span class="ko">담당자</span></label>'+ownerSelect('m_owner',p.owner||'')+'</div>'
    +(isNew?'':'<div class="ofg"><label>Status<span class="ko">상태</span></label><select id="m_status"><option value="active"'+(p.status!=='closed'?' selected':'')+'>Active · 진행</option><option value="closed"'+(p.status==='closed'?' selected':'')+'>Closed · 종료</option></select></div>')
    +'</div>';
}
function readProj(p){
  p.catId=fv('m_cat'); p.client=fv('m_client'); p.name=fv('m_name')||'New project'; p.item=fv('m_item'); p.spec=fv('m_spec');
  p.target=num(fv('m_target')); p.currency=fv('m_cur')||'USD'; p.qty=num(fv('m_qty'));
  p.unit=fv('m_unit'); p.incoterm=fv('m_inc'); p.deadline=fv('m_dl'); p.owner=fv('m_owner');
  if($('m_status')){ var ns=fv('m_status'); if(ns!==p.status){ p.status=ns; p.closedAt=ns==='closed'?TODAY_S():''; } }
  return p;
}
function priceForm(p){
  var b=bestQuote(p), terms=E(p.currency)+(p.incoterm?' '+E(p.incoterm):'')+(p.unit?' / '+E(p.unit):'');
  return '<div class="form">'
    +'<div class="ofg full"><div class="note">Prices are per unit in '+terms+'. Only the <b>HQ report price</b> appears in the HQ weekly report.<br><span class="muted">단가는 '+terms+' 기준 단위 단가입니다. 본사 주간 보고에는 <b>본사 보고용 단가</b>만 표시돼요.</span></div></div>'
    +'<div class="ofg"><label>Negotiating price<span class="ko">현재 네고 단가 · 내부용</span></label><input id="m_ng" inputmode="decimal" value="'+E(hasPrice(p.negoPrice)?p.negoPrice:'')+'">'+(b?'<button class="obtn ghost sm" type="button" data-act="useBest" style="margin-top:4px">Use best landed '+money(b.price,p.currency)+'<span class="ko">최저 환산 적용</span></button>':'')+'</div>'
    +'<div class="ofg"><label>Negotiation note<span class="ko">네고 메모 · 내부용</span></label><input id="m_ngn" value="'+E(p.negoNote||'')+'" placeholder="e.g. Anji verbal 38.5, written pending"></div>'
    +'<div class="ofg"><label>HQ report price<span class="ko">본사 보고용 단가</span></label><input id="m_hq" inputmode="decimal" value="'+E(hasPrice(p.hqPrice)?p.hqPrice:'')+'"><button class="obtn ghost sm" type="button" data-act="copyNego" style="margin-top:4px">Copy negotiating price<span class="ko">네고 단가 복사</span></button></div>'
    +'<div class="ofg"><label>Show in HQ weekly report<span class="ko">본사 주간 보고 포함</span></label><select id="m_hqi"><option value="1"'+(p.hqInclude?' selected':'')+'>Include · 포함</option><option value="0"'+(!p.hqInclude?' selected':'')+'>Exclude · 제외</option></select></div>'
    +'<div class="ofg full"><label>HQ report comment<span class="ko">본사 보고 코멘트 (보고서에 그대로 표시)</span></label><textarea id="m_hqn" placeholder="e.g. Shortlisted 2 vendors, sample review next week / 2개 업체 압축, 다음 주 샘플 평가">'+E(p.hqNote||'')+'</textarea></div>'
    +'</div>';
}

// ── 렌더 ──
function renderLayer(){ $('otLayer').innerHTML=UI.vid&&UI.view==='project'?renderDrawer():''; }
function render(){
  if(!ROOT) return;
  renderSide();
  if(UI.view==='admin') renderAdmin(); else if(UI.view==='project') renderProject(); else renderList();
  if(!UI.modal) renderLayer();
}

// ── 파일 업로드 (Firebase Storage · 경로/URL만 DB 기록) ──
async function uploadFiles(p,v,files,date){
  var out=[];
  for(var i=0;i<files.length;i++){
    var f=files[i];
    if(f.size>25e6){ toast(T(f.name+' 25MB 초과 · 건너뜀',f.name+' over 25MB · skipped')); continue; }
    var safe=String(f.name||'file').replace(/[\/\\:*?"<>|#\[\]]/g,'_').replace(/\s+/g,'_').slice(0,90);
    var path='OTHER/'+p.catId+'/'+p.id+'/'+v.id+'/'+date+'_'+Date.now().toString(36)+'_'+safe;
    try{
      var r=await fetch('https://firebasestorage.googleapis.com/v0/b/'+BUCKET+'/o?name='+encodeURIComponent(path),{method:'POST',headers:{'Content-Type':f.type||'application/octet-stream'},body:f});
      if(!r.ok) throw new Error('HTTP '+r.status);
      var meta={}; try{ meta=await r.json(); }catch(_){}
      var tok=meta&&meta.downloadTokens?String(meta.downloadTokens).split(',')[0]:'';
      var url='https://firebasestorage.googleapis.com/v0/b/'+BUCKET+'/o/'+encodeURIComponent(path)+'?alt=media'+(tok?'&token='+tok:'');
      out.push({id:'F'+uid(),name:f.name,size:f.size,date:date,path:path,url:url,by:me()});
    }catch(e){ toast(T('업로드 실패: '+f.name,'Upload failed: '+f.name)); console.warn('[other] upload',e&&e.message); }
  }
  return out;
}

// ── 이벤트 ──
var PROJ_ACTS={setStage:1,useSuggest:1,saveNext:1,saveDone:1,saveQuote:1,saveVendor:1,saveVendorEdit:1,saveProjEdit:1,savePrice:1};
function onClick(e){
  var t=e.target.closest('[data-act]'); if(!t||!ROOT.contains(t)) return;
  var a=t.getAttribute('data-act'), id=t.getAttribute('data-id');
  if(t.tagName==='SELECT'||(t.tagName==='INPUT')) return;
  var p=proj(UI.pid), v=vend(p,UI.vid), cc=p?cat(p.catId):null;
  var T0=TODAY_S();
  switch(a){
    case 'hub': window.closeOtherApp(); return;
    case 'cat': UI.view='list'; UI.cat=id; UI.vid=null; render(); ROOT.scrollTop=0; break;
    case 'admin': UI.view='admin'; UI.vid=null; render(); break;
    case 'toggleClosed': UI.showClosed=!UI.showClosed; render(); break;
    case 'open': UI.view='project'; UI.pid=id; UI.vid=null; render(); ROOT.scrollTop=0; break;
    case 'vendor': UI.vid=id; UI.tab='log'; render(); break;
    case 'closeDrawer': UI.vid=null; render(); break;
    case 'tab': UI.tab=id; renderLayer(); break;
    case 'setStage':
      var i=+t.getAttribute('data-i'); if(i===v.stage) return;
      var from=v.stage; v.stage=i;
      v.logs.push({id:'L'+uid(),date:T0,at:Date.now(),by:me(),ch:'메모',dir:'memo',text:'Stage 단계: '+SNt(cc.stages[from])+' → '+SNt(cc.stages[i]),files:[],stageTo:i});
      if(!v.next||!v.next.text||confirm('Replace next action with this stage’s suggestion?\n다음 액션을 이 단계 추천으로 바꿀까요?\n\n"'+cc.stages[i].next+'"')) v.next={text:cc.stages[i].next,due:addDays(3),owner:p.owner||me()};
      render(); toast('Stage 단계 → '+SNt(cc.stages[i])); break;
    case 'useSuggest': v.next={text:cc.stages[v.stage].next,due:addDays(3),owner:p.owner||me()}; render(); break;
    case 'editNext':
      modal(T('다음 액션','Next action'),'<div class="form"><div class="ofg full"><label>Task<span class="ko">할 일</span></label><input id="m_nt" value="'+E(v.next&&v.next.text||'')+'" placeholder="'+E(cc.stages[v.stage]?cc.stages[v.stage].next:'')+'"></div><div class="ofg"><label>Due<span class="ko">기한</span></label><input type="date" id="m_nd" value="'+E(v.next&&v.next.due||addDays(3))+'"></div><div class="ofg"><label>Owner<span class="ko">담당</span></label>'+ownerSelect('m_no',v.next&&v.next.owner||p.owner||me())+'</div></div>','saveNext'); return;
    case 'saveNext': v.next={text:fv('m_nt'),due:fv('m_nd'),owner:fv('m_no')}; UI.modal=null; render(); toast(T('다음 액션을 저장했어요','Next action saved')); break;
    case 'doneNext':
      modal(T('액션 완료 처리','Complete action'),'<div class="boxed small" style="margin-bottom:12px">Done 완료: <b>'+E(v.next.text)+'</b></div><div class="form"><div class="ofg full"><label>Result (saved to log)<span class="ko">결과 (대화 로그에 기록돼요)</span></label><textarea id="m_res" placeholder="e.g. sample ships 10/20 / 샘플 10/20 발송 예정"></textarea></div><div class="ofg full"><label>Next action<span class="ko">이어서 할 다음 액션</span></label><input id="m_nt" placeholder="'+E(cc.stages[v.stage]?cc.stages[v.stage].next:'')+'"></div><div class="ofg"><label>Due<span class="ko">기한</span></label><input type="date" id="m_nd" value="'+addDays(3)+'"></div><div class="ofg"><label>Move stage<span class="ko">단계 이동</span></label><select id="m_st"><option value="">Keep 그대로 ('+E(SNt(cc.stages[v.stage]))+')</option>'+cc.stages.map(function(s,i){ return i!==v.stage?'<option value="'+i+'">'+(i+1)+'. '+E(SNt(s))+(i<v.stage?' (back · 되돌리기)':'')+'</option>':''; }).join('')+'</select></div></div>','saveDone','Complete<span class="ko">완료</span>'); return;
    case 'saveDone':
      var stv=fv('m_st'), res=fv('m_res'), lg={id:'L'+uid(),date:T0,at:Date.now(),by:me(),ch:'메모',dir:'memo',text:'✔ '+v.next.text+(res?'\n→ '+res:''),files:[]};
      if(stv!==''){ lg.stageTo=+stv; v.stage=+stv; }
      v.logs.push(lg);
      v.next={text:fv('m_nt')||'',due:fv('m_nt')?fv('m_nd'):'',owner:p.owner||me()};
      UI.modal=null; render(); toast(v.next.text?T('완료 · 다음 액션이 등록됐어요','Done · next action set'):T('완료 · 다음 액션을 정해주세요','Done · please set a next action')); break;
    case 'newLog':
      modal(T('대화 기록 추가','Add log'),'<div class="form"><div class="ofg"><label>Date<span class="ko">날짜</span></label><input type="date" id="m_ld" value="'+T0+'"></div>'
        +'<div class="ofg"><label>Channel<span class="ko">채널</span></label><select id="m_lc">'+['Email','WeChat','WhatsApp','Zalo','전화','미팅','메모'].map(function(c){ return '<option value="'+c+'">'+chT(c)+'</option>'; }).join('')+'</select></div>'
        +'<div class="ofg full"><label>Direction<span class="ko">방향</span></label><select id="m_lr"><option value="in">In · 받음 (them → us)</option><option value="out">Out · 보냄 (us → them)</option><option value="memo">Internal memo · 내부 메모</option></select></div>'
        +'<div class="ofg full"><label>Content<span class="ko">내용</span></label><textarea id="m_lt" placeholder="What was exchanged, agreed, still open / 주고받은 내용, 합의, 남은 쟁점"></textarea></div>'
        +'<div class="ofg"><label>Quoted price (optional)<span class="ko">견적 단가 (있으면)</span></label><input id="m_lq" data-prev="1" inputmode="decimal"></div>'
        +'<div class="ofg"><label>MOQ · Lead (days)<span class="ko">MOQ · 납기(일)</span></label><div class="row" style="flex-wrap:nowrap"><input id="m_lm" placeholder="MOQ" style="width:50%"><input id="m_ll" placeholder="days" style="width:50%"></div></div>'
        +quoteFields(p,v)
        +'<div class="ofg full"><label>Attachments<span class="ko">첨부 파일</span></label><input type="file" id="m_lf" multiple></div></div>','saveLog'); qPrev(); return;
    case 'saveLog': saveLog(p,v,cc,t); return;
    case 'newQuote':
      modal(T('견적 기록','Record quote'),'<div class="form"><div class="ofg"><label>Date<span class="ko">날짜</span></label><input type="date" id="m_qd" value="'+T0+'"></div><div class="ofg"><label>Unit price (quote currency)<span class="ko">단가 (견적 통화)</span></label><input id="m_qp" data-prev="1" inputmode="decimal"></div>'+quoteFields(p,v)+'<div class="ofg"><label>MOQ</label><input id="m_qm"></div><div class="ofg"><label>Lead time (days)<span class="ko">납기 (일)</span></label><input id="m_ql"></div><div class="ofg full"><label>Terms · Note<span class="ko">조건 · 메모</span></label><input id="m_qn" placeholder="e.g. ex Shenzhen, sample fee extra / 샘플비 별도"></div></div>','saveQuote'); qPrev(); return;
    case 'saveQuote':
      var pr=num(fv('m_qp')); if(!(pr>0)){ toast(T('단가를 입력하세요','Enter a price')); return; }
      var nq2=readQuoteExtra({date:fv('m_qd')||T0,price:pr,moq:fv('m_qm')||'-',lead:fv('m_ql')||'-',note:fv('m_qn'),by:me()}); v.quotes.push(nq2); v.quotes.sort(function(x,y){ return x.date<y.date?-1:x.date>y.date?1:0; });
      UI.modal=null; render(); toast('Quote saved 견적 저장 · vs target '+gapTxt(gap(landed(nq2,p),p.target))); break;
    case 'newVendor':
      modal('Add '+(cc.partyEn||cc.partyLabel)+' / '+cc.partyLabel+' 추가',vendorForm(cc,null),'saveVendor','Add<span class="ko">추가</span>'); return;
    case 'saveVendor':
      var vn=fv('m_vn'); if(!vn){ toast(T('이름을 입력하세요','Enter a name')); return; }
      var s0=+fv('m_vs')||0, nv={id:'V'+uid(),name:vn,country:fv('m_vc')||'-',contact:fv('m_vk'),stage:s0,status:'active',next:{text:cc.stages[s0]?cc.stages[s0].next:'',due:addDays(3),owner:p.owner||me()},quotes:[],logs:[{id:'L'+uid(),date:T0,at:Date.now(),by:me(),ch:'메모',dir:'memo',text:'Added · 추가 ('+SNt(cc.stages[s0])+')',files:[]}],files:[],createdAt:T0};
      p.vendors.push(nv); UI.modal=null; UI.vid=nv.id; UI.tab='log'; render(); toast('Added · suggested action set / '+cc.partyLabel+' 추가 · 추천 액션 지정'); break;
    case 'editVendor': modal(T(cc.partyLabel+' 정보','Edit '+(cc.partyEn||cc.partyLabel)),vendorForm(cc,v),'saveVendorEdit','Save<span class="ko">저장</span>','<button class="obtn ghost sm danger" data-act="delVendor">Delete<span class="ko">삭제</span></button>'); return;
    case 'saveVendorEdit': var vn2=fv('m_vn'); if(!vn2){ toast(T('이름을 입력하세요','Enter a name')); return; } v.name=vn2; v.country=fv('m_vc')||'-'; v.contact=fv('m_vk'); UI.modal=null; render(); toast(T('저장했어요','Saved')); break;
    case 'delVendor':
      if(!confirm('Delete "'+v.name+'" and all its logs/quotes?\n"'+v.name+'"와 대화 로그·견적을 모두 삭제할까요?')) return;
      p.vendors=p.vendors.filter(function(x){ return x.id!==v.id; }); UI.modal=null; UI.vid=null; commit(p); render(); toast(T('삭제했어요','Deleted')); return;
    case 'newProj': modal(T('새 프로젝트','New project'),projForm(null),'saveProj','Create<span class="ko">만들기</span>'); return;
    case 'editProj': modal(T('프로젝트 정보','Project info'),projForm(p),'saveProjEdit',null,'<button class="obtn ghost sm danger" data-act="delProj">Delete project<span class="ko">프로젝트 삭제</span></button>'); return;
    case 'saveProj':
      var np=normP(readProj({id:'OP'+uid(),createdAt:T0,createdBy:me(),status:'active',hqInclude:true,vendors:[]}));
      PROJS().push(np); commit(np); UI.modal=null; UI.view='project'; UI.pid=np.id; render(); toast(T('프로젝트를 만들었어요','Project created')); return;
    case 'saveProjEdit': readProj(p); UI.modal=null; render(); toast(T('저장했어요','Saved')); break;
    case 'delProj':
      if(!confirm('Delete project "'+p.name+'"? This cannot be undone.\n프로젝트 "'+p.name+'"를 삭제할까요? 되돌릴 수 없어요.')) return;
      var s=ST(); s.otherProjects=PROJS().filter(function(x){ return x.id!==p.id; });
      if(typeof _tombAdd==='function') _tombAdd('otherProjects',p.id);
      window._fbIntentDel=window._fbIntentDel||{}; (window._fbIntentDel.otherProjects=window._fbIntentDel.otherProjects||{})[String(p.id)]=1;
      UI.modal=null; UI.view='list'; UI.pid=null; UI.vid=null; saveSoon(); render(); toast(T('삭제했어요','Deleted')); return;
    case 'editPrice': modal(T('단가 · 본사 보고','Prices · HQ report'),priceForm(p),'savePrice'); return;
    case 'useBest': var bq=bestQuote(p); if(bq&&$('m_ng')) $('m_ng').value=+bq.price.toFixed(p.currency==='VND'||p.currency==='KRW'?0:2); return;
    case 'copyNego': if($('m_hq')&&$('m_ng')) $('m_hq').value=$('m_ng').value; return;
    case 'savePrice':
      var ng=fv('m_ng'), hq=fv('m_hq'), hqChanged=(String(num(hq)||'')!==String(num(p.hqPrice)||''))||(fv('m_hqn')!==(p.hqNote||''));
      p.negoPrice=hasPrice(num(ng))?num(ng):''; p.negoNote=fv('m_ngn'); p.hqPrice=hasPrice(num(hq))?num(hq):''; p.hqNote=fv('m_hqn'); p.hqInclude=fv('m_hqi')!=='0';
      if(hqChanged){ p.hqAt=T0; p.hqBy=me(); }
      p.priceLog.push({date:T0,at:Date.now(),by:me(),nego:p.negoPrice,hq:p.hqPrice});
      if(p.priceLog.length>60) p.priceLog=p.priceLog.slice(-60);
      UI.modal=null; render(); toast(T('단가를 저장했어요','Prices saved')); break;
    case 'closeModal': closeModal(); return;
    case 'adminCat': UI.adminCat=id; render(); return;
    case 'newCat': var nm=prompt('New category name / 새 분류 이름','e.g. Interior · 인테리어'); if(nm){ var nc={id:'c'+uid(),name:nm,color:'#1d4ed8',enabled:true,partyLabel:'업체',partyEn:'Vendor',stages:[{key:'a',name:'시작',en:'Start',desc:'',next:'담당자 지정'},{key:'b',name:'진행',en:'In progress',desc:'',next:'중간 점검'},{key:'c',name:'완료',en:'Done',desc:'',next:'결과 보고'}]}; CATS().push(nc); UI.adminCat=nc.id; commitCfg(); render(); toast(T('분류를 추가했어요','Category added')); } return;
    case 'addStage': var ac=cat(UI.adminCat); ac.stages.push({key:'k'+uid(),name:'새 단계',en:'New stage',desc:'',next:''}); commitCfg(); render(); return;
    case 'mvStage': var ac2=cat(UI.adminCat), si2=+t.getAttribute('data-i'), dd=+t.getAttribute('data-d'), tj=si2+dd; if(tj<0||tj>=ac2.stages.length) return;
      var tmp=ac2.stages[si2]; ac2.stages[si2]=ac2.stages[tj]; ac2.stages[tj]=tmp;
      PROJS().forEach(function(pp){ if(pp.catId!==ac2.id) return; var ch=false; pp.vendors.forEach(function(vv){ if(vv.stage===si2){ vv.stage=tj; ch=true; } else if(vv.stage===tj){ vv.stage=si2; ch=true; } }); if(ch) commit(pp); });
      commitCfg(); render(); return;
    case 'rmStage': var ac3=cat(UI.adminCat), ri=+t.getAttribute('data-i'); if(ac3.stages.length<=2){ toast(T('단계는 최소 2개가 필요해요','At least 2 stages required')); return; }
      if(!confirm('Delete stage "'+SNt(ac3.stages[ri])+'"?\n이 단계를 삭제할까요?')) return;
      ac3.stages.splice(ri,1);
      PROJS().forEach(function(pp){ if(pp.catId!==ac3.id) return; var ch=false; pp.vendors.forEach(function(vv){ if(vv.stage>=ri&&vv.stage>0){ vv.stage--; ch=true; } }); if(ch) commit(pp); });
      commitCfg(); render(); return;
    default: return;
  }
  if(PROJ_ACTS[a]&&p) commit(p);
}
function vendorForm(cc,v){
  return '<div class="form"><div class="ofg full"><label>Name<span class="ko">이름</span></label><input id="m_vn" value="'+E(v?v.name:'')+'"></div><div class="ofg"><label>Country<span class="ko">국가</span></label><input id="m_vc" placeholder="CN / VN / MX" value="'+E(v?v.country:'')+'"></div><div class="ofg"><label>Contact<span class="ko">담당자 · 연락처</span></label><input id="m_vk" value="'+E(v?v.contact:'')+'"></div>'
    +(v?'':'<div class="ofg full"><label>Starting stage<span class="ko">시작 단계</span></label><select id="m_vs">'+cc.stages.map(function(s,i){ return '<option value="'+i+'">'+(i+1)+'. '+E(SNt(s))+'</option>'; }).join('')+'</select></div>')+'</div>';
}
async function saveLog(p,v,cc,btn){
  var txt=fv('m_lt'); if(!txt){ toast(T('내용을 입력하세요','Enter content')); return; }
  var d=fv('m_ld')||TODAY_S(), fl=$('m_lf'), files=Array.prototype.slice.call((fl&&fl.files)||[]);
  var qp=num(fv('m_lq'));
  var log={id:'L'+uid(),date:d,at:Date.now(),by:me(),ch:fv('m_lc'),dir:fv('m_lr'),text:txt,files:[]};
  var nq=null; if(qp>0) nq=readQuoteExtra({date:d,price:qp,moq:fv('m_lm')||'-',lead:fv('m_ll')||'-',note:'from log · 대화 로그에서 기록',by:me()});
  if(files.length){ if(btn){ btn.disabled=true; btn.textContent='Uploading… 업로드 중'; } }
  var up=files.length?await uploadFiles(p,v,files,d):[];
  // 업로드 중 원격 반영으로 객체가 교체됐을 수 있으니 다시 찾기
  p=proj(p.id)||p; v=vend(p,v.id)||v;
  up.forEach(function(f){ v.files.push(f); log.files.push(f.id); });
  if(nq){ log.quote=qp; log.qcur=nq.cur; v.quotes.push(nq); v.quotes.sort(function(a,b){ return a.date<b.date?-1:a.date>b.date?1:0; });
    var si=cc.stages.findIndex(function(s){ return /견적|quote/i.test(s.name+' '+(s.en||'')); }); if(si>v.stage){ v.stage=si; log.stageTo=si; } }
  v.logs.push(log); commit(p); UI.modal=null; render();
  toast(up.length?T('기록과 파일 '+up.length+'개를 저장했어요','Log + '+up.length+' file(s) saved'):T('기록을 저장했어요','Log saved'));
}
function onChange(e){
  var t=e.target, p=proj(UI.pid), v=vend(p,UI.vid);
  var act=t.getAttribute('data-act');
  if(act==='status'&&v){ var prev=v.status; v.status=t.value; if(v.status==='dropped'&&prev!=='dropped'){ var r=prompt('Reason for dropping / 탈락 사유','')||''; v.dropReason=r; v.logs.push({id:'L'+uid(),date:TODAY_S(),at:Date.now(),by:me(),ch:'메모',dir:'memo',text:'Dropped 탈락 처리'+(r?' — '+r:''),files:[]}); }
    else if(prev!==v.status) v.logs.push({id:'L'+uid(),date:TODAY_S(),at:Date.now(),by:me(),ch:'메모',dir:'memo',text:'Status 상태: '+prev+' → '+v.status,files:[]});
    commit(p); render(); return; }
  if(act==='upload'&&v){
    var files=Array.prototype.slice.call(t.files||[]); if(!files.length) return;
    toast(T('업로드 중…','Uploading…'));
    uploadFiles(p,v,files,TODAY_S()).then(function(up){
      if(!up.length) return;
      var p2=proj(p.id)||p, v2=vend(p2,v.id)||v;
      up.forEach(function(f){ v2.files.push(f); });
      v2.logs.push({id:'L'+uid(),date:TODAY_S(),at:Date.now(),by:me(),ch:'메모',dir:'memo',text:up.length+' file(s) uploaded · 파일 '+up.length+'개 업로드',files:up.map(function(f){ return f.id; })});
      commit(p2); render(); toast(T('파일 '+up.length+'개를 올렸어요','Uploaded '+up.length+' file(s)'));
    });
    return;
  }
  var cf=t.getAttribute('data-cf'); if(cf){ var c=cat(UI.adminCat); c[cf]=cf==='enabled'?(t.value==='1'):t.value; commitCfg(); render(); return; }
  var sf=t.getAttribute('data-sf'); if(sf){ var st=cat(UI.adminCat).stages[+t.getAttribute('data-i')]; if(st){ st[sf]=t.value; commitCfg(); } return; }
  var fx=t.getAttribute('data-fx'); if(fx){ var r2=num(t.value); if(r2>0){ fxRates()[fx]=r2; commitCfg(); toast(fx+' FX updated, landed prices recalculated / 환율 변경 · 환산 단가에 반영'); } else t.value=fxOf(fx); return; }
  if(t.getAttribute('data-prev')) qPrev();
}

// ═══ 본사 주간 보고용 요약 (hqreport.js 에서 호출) ═══
//   본사 보고용 단가(hqPrice)만 노출 · 네고 단가/업체 견적은 포함하지 않음
window.otherHqSummary=function(mon,sun){
  var a=iso(mon), b=iso(sun), T0=TODAY_S();
  var cats=CATS(), out=[];
  PROJS().forEach(function(p){
    if(p.hqInclude===false) return;
    var closedInWeek=p.status==='closed'&&p.closedAt&&p.closedAt>=a&&p.closedAt<=b;
    if(p.status==='closed'&&!closedInWeek) return;
    var cc=cat(p.catId), st=cc.stages, act=p.vendors.filter(function(v){ return v.status==='active'; });
    var lead=-1; act.forEach(function(v){ if(v.stage>lead) lead=v.stage; });
    var weekLogs=0, moves=[], nextDue=null, overdue=0;
    p.vendors.forEach(function(v){
      v.logs.forEach(function(l){ if(l.date>=a&&l.date<=b){ weekLogs++; if(l.stageTo!=null&&st[l.stageTo]) moves.push({vendor:v.name,to:st[l.stageTo],date:l.date}); } });
      if(v.status==='active'&&v.next&&v.next.text){ if(v.next.due&&v.next.due<T0) overdue++; if(!nextDue||(v.next.due||'9999')<(nextDue.due||'9999')) nextDue={text:v.next.text,due:v.next.due||'',vendor:v.name,owner:v.next.owner||''}; }
    });
    // 같은 업체의 주간 단계 이동은 마지막 것만
    var lastMove={}; moves.sort(function(x,y){ return x.date<y.date?-1:1; }).forEach(function(m){ lastMove[m.vendor]=m; });
    moves=Object.keys(lastMove).map(function(k){ return lastMove[k]; });
    var stageCounts=st.map(function(s,i){ return act.filter(function(v){ return v.stage===i; }).length; });
    var hq=hasPrice(p.hqPrice)?num(p.hqPrice):null;
    out.push({id:p.id, cat:{id:cc.id,name:cc.name,color:cc.color,party:cc.partyLabel,partyEn:cc.partyEn},
      name:p.name, client:p.client, item:p.item, owner:p.owner, status:p.status, closedInWeek:!!closedInWeek,
      currency:p.currency, incoterm:p.incoterm, unit:p.unit, qty:num(p.qty), target:num(p.target)||null,
      hqPrice:hq, hqGap:gap(hq,num(p.target)||0), hqNote:p.hqNote||'', hqAt:p.hqAt||'',
      leadStage:lead>=0&&st[lead]?{idx:lead,total:st.length,name:st[lead].name,en:st[lead].en||''}:null,
      stageCounts:stageCounts, stages:st.map(function(s){ return {name:s.name,en:s.en||''}; }),
      active:act.length, total:p.vendors.length, weekLogs:weekLogs, moves:moves, overdue:overdue, nextDue:nextDue, deadline:p.deadline||''});
  });
  var order={}; cats.forEach(function(c,i){ order[c.id]=i; });
  out.sort(function(x,y){ return (order[x.cat.id]||0)-(order[y.cat.id]||0)||String(x.deadline||'9999').localeCompare(String(y.deadline||'9999')); });
  return {projects:out, kpi:{projects:out.filter(function(x){ return x.status!=='closed'; }).length, vendors:out.reduce(function(s,x){ return s+x.active; },0), weekLogs:out.reduce(function(s,x){ return s+x.weekLogs; },0), overdue:out.reduce(function(s,x){ return s+x.overdue; },0), closed:out.filter(function(x){ return x.closedInWeek; }).length}};
};
})();
