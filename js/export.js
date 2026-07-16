/* ════════════════════════════════════════════════════════════
   INICS · export.js  수출 프로젝트 모듈 (Export Projects)
   무역상사 수출 SOP → ETD 역산 자동 스케줄링 · 영문/한글 병기
   • 전역 헬퍼(state·saveState·showToast·_stampEdit·qNum·
     cardCurrentUser 등)는 index.html에 남아 전역 참조.
   • 데이터: state.exportProjects[] / state.exportSeq / state.exportEcosyDone
     └ _MERGE_COLLS 에 'exportProjects' 등록(동시편집 병합·OCC).
   • 공급사 다중 지원(p.suppliers[]) · 공급사별 체크박스.
   • 담당자 고정(수정 불가) · 제출서류 빨강 강조 · FC를 P3에 통합.
   • 첨부는 Firebase Storage(REST) 업로드 후 URL만 저장.
   ════════════════════════════════════════════════════════════ */
(function(){
'use strict';

function _esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function _toast(m){ if(typeof showToast==='function') showToast(m); }
function _save(){ if(typeof saveState==='function') saveState(); }
function _stamp(o){ if(typeof _stampEdit==='function') return _stampEdit(o); if(o){o._editedAt=Date.now();o._rev=(o._rev||0)+1;} return o; }

function _projects(){ if(!Array.isArray(state.exportProjects)) state.exportProjects=[]; return state.exportProjects; }
function _nextSeq(){ state.exportSeq=(state.exportSeq||0)+1; return state.exportSeq; }
function _genNo(seq){ return 'EX'+new Date().getFullYear()+'-'+String(seq).padStart(3,'0'); }

/* ── 담당자(고정, 병기) ── */
var OWNER={
  FWD:{ko:'포워더', en:'Forwarder'},
  EXP:{ko:'수출자', en:'Exporter'},
  IMP:{ko:'수입자', en:'Importer'},
  PRD:{ko:'생산자', en:'Producer'},
  MXF:{ko:'MX 포워더', en:'MX Forwarder'}
};
function _own(k){ var o=OWNER[k]||{ko:k,en:''}; return o.ko+' · '+o.en; }

/* ── Phase (병기) ── */
var PHASES=[
  {key:'P1', ko:'프로젝트 시작',            en:'Project Open',          c:'#1d4ed8'},
  {key:'P2', ko:'공급·원산지',              en:'Supplier & Origin',     c:'#15803d'},
  {key:'P3', ko:'물류·부킹·포워더 조율',    en:'Logistics & Forwarder', c:'#0f766e'},
  {key:'P4', ko:'수출서류·통관',            en:'Export Docs & Customs', c:'#b45309'},
  {key:'P5', ko:'선적',                    en:'Shipment',              c:'#0891b2'},
  {key:'P6', ko:'선적 후',                  en:'Post Shipment',         c:'#be123c'}
];

/* ── Task 템플릿 ──
   owner: OWNER 키(고정) · d: ETD 역산 오프셋 · perSup: 공급사별 · once: 최초1회 · doc: 제출서류(빨강) · fc: 포워더 조율 */
var TASKS=[
  /* P1 */
  {id:'so_approve', ph:'P1', ko:'Sales Order 승인',            en:'Sales Order approved',      owner:'EXP', d:-20},
  {id:'po_confirm', ph:'P1', ko:'Customer PO 확인',             en:'Customer PO confirmed',     owner:'EXP', d:-20},
  {id:'incoterms',  ph:'P1', ko:'Incoterms·Shipping Term 확인', en:'Incoterms & Shipping Term', owner:'EXP', d:-20},
  {id:'prj_open',   ph:'P1', ko:'프로젝트 생성 (ERP)',          en:'Project opened',            owner:'EXP', d:-20},

  /* P2 */
  {id:'po_issue',   ph:'P2', ko:'Purchase Order 발행',          en:'PO issued',            owner:'EXP', d:-20, perSup:true},
  {id:'ecosy',      ph:'P2', ko:'ECOSY 등록 (최초 1회)',        en:'ECOSY registration',   sub:'Seal · Signatory · 회사 최초 1회 · one-time', owner:'EXP', d:-20, once:true},
  {id:'fwd_rfq',    ph:'P2', ko:'포워더 견적 요청',             en:'Forwarder RFQ',        owner:'EXP', d:-20},
  {id:'sup_docs',   ph:'P2', ko:'상업서류 수령',                en:'Supplier documents',   sub:'VAT Invoice · Delivery Note · Spec · Photos · HS Code · Net/Gross Weight · CBM', owner:'PRD', d:-15, perSup:true, doc:true},
  {id:'org_docs',   ph:'P2', ko:'원산지 서류 수령',             en:'Origin documents',     sub:'Manufacturer/Origin Declaration · BOM · Production Procedure · CTH/RVC · CPTPP', owner:'PRD', d:-15, perSup:true, doc:true},

  /* P3 — 물류·부킹 + 포워더 조율 */
  {id:'booking',     ph:'P3', ko:'Booking 완료',            en:'Booking confirmed',    sub:'ETD · ETA · CY / SI / VGM Closing', owner:'FWD', d:-10},
  {id:'mx_customs',  ph:'P3', ko:'멕시코 통관 확인',         en:'Mexico customs check', sub:'HS Code · CPTPP Eligibility · Preferential Tariff', owner:'MXF', d:-10},
  {id:'goods_ready', ph:'P3', ko:'Goods Ready 생산 완료',    en:'Goods ready',          owner:'PRD', d:-10, perSup:true},
  {id:'fc_bkg_recv', ph:'P3', ko:'Booking Confirmation 수령', en:'Booking Confirmation received', sub:'MX 포워더 → 수출자 · MX FWD → Exporter', owner:'EXP', d:-10, fc:true},
  {id:'fc_bkg_send', ph:'P3', ko:'Booking Confirmation 전달', en:'Booking Confirmation forwarded', sub:'수출자 → 포워더 · Exporter → Forwarder',  owner:'EXP', d:-10, fc:true},
  {id:'fc_si_recv',  ph:'P3', ko:'SI (Shipping Instruction) 접수', en:'SI (Shipping Instruction) received', owner:'FWD', d:-5, fc:true, doc:true},
  {id:'fc_vgm',      ph:'P3', ko:'VGM (Verified Gross Mass) 제출', en:'VGM (Verified Gross Mass) submitted', owner:'FWD', d:-3, fc:true, doc:true},
  {id:'fc_draft_bl', ph:'P3', ko:'Draft B/L 검토·승인',      en:'Draft B/L reviewed & approved', owner:'EXP', d:-1, fc:true, doc:true},
  {id:'fc_final_bl', ph:'P3', ko:'Final B/L 수령',           en:'Final B/L received',   owner:'FWD', d:2, fc:true, doc:true},

  /* P4 — 수출서류·통관 */
  {id:'exp_inv',   ph:'P4', ko:'Export Commercial Invoice 작성', en:'Export Commercial Invoice', owner:'EXP', d:-7, doc:true},
  {id:'exp_pl',    ph:'P4', ko:'Export Packing List 작성',       en:'Export Packing List',       owner:'EXP', d:-7, doc:true},
  {id:'exp_decl',  ph:'P4', ko:'수출신고 Export Declaration',    en:'Export Declaration',        owner:'FWD', d:-3, doc:true},
  {id:'co_apply',  ph:'P4', ko:'CPTPP CO 신청 (MOIT)',           en:'CPTPP CO application',      sub:'Export Invoice · PL · Draft B/L · Declaration · Origin Docs', owner:'EXP', d:-2, doc:true},

  /* P5 — 선적 */
  {id:'co_issued', ph:'P5', ko:'CO 발급 수령',        en:'CO issued',            owner:'EXP', d:0, doc:true},
  {id:'etd_day',   ph:'P5', ko:'ETD · Vessel Loading', en:'ETD / Vessel loading', owner:'FWD', d:0},

  /* P6 — 선적 후 */
  {id:'frt_inv',   ph:'P6', ko:'Freight Invoice 수령', en:'Freight Invoice',       owner:'FWD', d:2, doc:true},
  {id:'arr_notice',ph:'P6', ko:'Arrival Notice 수령',  en:'Arrival Notice',        owner:'FWD', d:2},
  {id:'send_mx',   ph:'P6', ko:'멕시코 송부',          en:'Send documents to Mexico', sub:'Commercial Invoice · Packing List · CO · B/L · Freight Invoice', owner:'EXP', d:3, doc:true}
];

/* ── Booking Information 필드 (멕시코 포워더 → 수출자 수령) · ETD는 역산 앵커라 별도 ── */
var BOOKING_FIELDS=[
  {k:'bookingNo', ko:'Booking No.',           w:150},
  {k:'carrier',   ko:'Carrier · 선사',        w:130, ph:'MSK · MSC · CMA · ONE'},
  {k:'vessel',    ko:'Vessel · 선박',         w:160},
  {k:'voyage',    ko:'Voyage No.',            w:110},
  {k:'pol',       ko:'POL · 선적항',          w:150, ph:'Ho Chi Minh (VNSGN)'},
  {k:'pod',       ko:'POD · 도착항',          w:150, ph:'Manzanillo (MXZLO)'},
  {k:'eta',       ko:'ETA · 도착예정',        w:150, type:'date'},
  {k:'ctype',     ko:'Container Type · 컨테이너', w:120, ph:"20'GP · 40'HC"},
  {k:'cqty',      ko:'Qty · 수량',            w:70},
  {k:'freight',   ko:'Freight Term · 운임조건', w:120, sel:['Prepaid','Collect']}
];

var INCOTERMS=['EXW','FCA','FOB','CFR','CIF','DAP','DDP'];

/* ── 공급사(다중) ── */
function _suppliers(p){ if(!Array.isArray(p.suppliers)||!p.suppliers.length){ p.suppliers = p.supplier ? [p.supplier] : ['FURSYS']; } return p.suppliers; }

/* ── ETD 역산 ── */
function _addDays(dateStr, off){ var d=new Date((dateStr||'')+'T00:00:00'); if(isNaN(d)) return null; d.setDate(d.getDate()+off); return d; }
function _fmtDate(d){ if(!d) return '—'; return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function _today0(){ var d=new Date(); d.setHours(0,0,0,0); return d; }
function _dueOf(p, t){ var td=(p.tasks&&p.tasks[t.id]&&p.tasks[t.id].due)||null; if(td) return _addDays(td,0); return _addDays(p.etd, t.d); }

/* ── task 상태 ── */
function _ts(p, id){ if(!p.tasks) p.tasks={}; if(!p.tasks[id]) p.tasks[id]={}; return p.tasks[id]; }
function _isDone(p, t){
  if(t.once) return !!(state.exportEcosyDone || _ts(p,t.id).done);
  if(t.perSup){ var s=_suppliers(p); if(s.length<=1) return !!_ts(p,t.id).done; var bs=_ts(p,t.id).bySup||{}; return s.every(function(x){return !!bs[x];}); }
  return !!_ts(p,t.id).done;
}

/* ── 진행률 ── */
function _phaseTasks(ph){ return TASKS.filter(function(t){return t.ph===ph;}); }
function _phaseProg(p, ph){ var ts=_phaseTasks(ph); var done=ts.filter(function(t){return _isDone(p,t);}).length; return {done:done, total:ts.length, pct:ts.length?Math.round(done/ts.length*100):0}; }
function _overall(p){ var done=TASKS.filter(function(t){return _isDone(p,t);}).length; return {done:done, total:TASKS.length, pct:TASKS.length?Math.round(done/TASKS.length*100):0}; }
function _nextDue(p){
  if(!p.etd) return null;
  var open=TASKS.filter(function(t){return !_isDone(p,t);}).map(function(t){return {t:t, due:_dueOf(p,t)};}).filter(function(x){return x.due;});
  open.sort(function(a,b){return a.due-b.due;});
  return open[0]||null;
}

/* ── due 상태(실제 날짜 · 상태어 병기) ── */
function _dueClass(p, t){
  if(_isDone(p,t)) return {c:'#15803d', bg:'#f0fdf4', label:'완료 · done'};
  var due=_dueOf(p,t); if(!due) return {c:'var(--text-3)', bg:'transparent', label:''};
  var diff=Math.round((due-_today0())/86400000);
  if(diff<0)  return {c:'#dc2626', bg:'#fef2f2', label:'지연 · overdue '+Math.abs(diff)+'d'};
  if(diff===0)return {c:'#b45309', bg:'#fffbeb', label:'오늘 · today'};
  if(diff<=3) return {c:'#b45309', bg:'#fffbeb', label:'임박 · soon'};
  return {c:'var(--text-2)', bg:'transparent', label:''};
}

/* ════════════════════════════════════════════ 앱 컨테이너 ════ */
function _ensureDom(){
  if(document.getElementById('exportApp')) return;
  var wrap=document.createElement('div');
  wrap.innerHTML=
  '<div id="exportApp" style="display:none;position:fixed;inset:0;background:var(--bg);z-index:500;overflow-y:auto">'+
    '<div style="max-width:1180px;margin:0 auto;padding:28px 24px 60px">'+
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;gap:10px;flex-wrap:wrap">'+
        '<div style="display:flex;align-items:center;gap:12px">'+
          '<button class="btn btn-outline" onclick="exportBack()" style="padding:5px 11px;font-size:11px"><i class="ti ti-arrow-left"></i> <span id="exBackLbl">Hub · 허브</span></button>'+
          '<div style="font-size:18px;font-weight:700;letter-spacing:-.02em">수출 프로젝트 · Export Projects</div>'+
        '</div>'+
        '<div style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text-2)">'+
          '<span id="exUserName"></span>'+
          '<button class="btn btn-outline" onclick="hubLogout()" style="padding:4px 9px;font-size:11px"><i class="ti ti-logout"></i> Sign out · 로그아웃</button>'+
        '</div>'+
      '</div>'+
      '<div style="font-size:12px;color:var(--text-3);margin-bottom:18px">ETD 역산 자동 스케줄링 · 6단계 체크리스트 · 증빙 첨부 · CPTPP 수출 SOP · ETD back-scheduling</div>'+
      '<div id="exportBody"></div>'+
    '</div>'+
  '</div>'+
  '<input type="file" id="exFileInput" style="display:none">';
  while(wrap.firstChild) document.body.appendChild(wrap.firstChild);
}

/* ════════════════════════════════════════════ 진입/종료 ════ */
window.exportAppOpen=false;
var _curId=null;
var _bomSel={};   /* BOM 파일 다중선택(UI 상태 · 재시작 시 초기화) */
var _bomNewCode={}; /* 모델 행별 '새 코드 입력' 표시 여부(UI 상태) */
var _view='projects';  /* 목록 탭: projects | bomlib */
var _bomQ='';          /* BOM 라이브러리 검색어 */

/* ── BOM 라이브러리 집계(모든 프로젝트의 BOM을 모델별로) ── */
function _normKey(s){ return String(s||'').trim().toLowerCase().replace(/\s+/g,' '); }
function _allBomByModel(){
  var map={};
  _projects().forEach(function(p){
    (p.bom||[]).forEach(function(m){
      var key=_normKey(m.model); if(!key) return;
      if(!map[key]) map[key]={key:key, model:m.model||'', files:[], usedIn:[]};
      if(!map[key].model && m.model) map[key].model=m.model;
      (m.files||[]).forEach(function(f){ if(!map[key].files.some(function(x){return x.url===f.url;})) map[key].files.push(f); });
      if(!map[key].usedIn.some(function(u){return u.id===p.id;})) map[key].usedIn.push({id:p.id, no:p.no, name:p.name});
    });
  });
  return Object.keys(map).sort().map(function(k){return map[k];});
}
/* 다른(또는 모든) 프로젝트에서 같은 모델의 BOM 파일 찾기 */
function _bomFilesForModel(model, exceptProjId){
  var key=_normKey(model); if(!key) return [];
  var out=[];
  _projects().forEach(function(p){ if(exceptProjId && p.id===exceptProjId) return; (p.bom||[]).forEach(function(m){ if(_normKey(m.model)===key){ (m.files||[]).forEach(function(f){ if(!out.some(function(x){return x.url===f.url;})) out.push(f); }); } }); });
  return out;
}

window.showExportApp=function(){
  _ensureDom();
  var hub=document.getElementById('hubPage'); if(hub) hub.style.display='none';
  var app=document.getElementById('exportApp'); if(app) app.style.display='block';
  window.exportAppOpen=true;
  var u=(typeof cardCurrentUser==='function'?cardCurrentUser():null);
  var nm=document.getElementById('exUserName'); if(nm) nm.textContent=u?u.name:'';
  _curId=null; renderExportApp();
};
window.closeExportApp=function(){ var app=document.getElementById('exportApp'); if(app) app.style.display='none'; window.exportAppOpen=false; _curId=null; if(typeof showHub==='function') showHub(); };
window.exportBack=function(){ if(_curId){ _curId=null; renderExportApp(); } else { window.closeExportApp(); } };

window.renderExportApp=function(){
  _ensureDom();
  var bl=document.getElementById('exBackLbl'); if(bl) bl.textContent=_curId?'목록 · List':'Hub · 허브';
  if(_curId){ var p=_projects().find(function(x){return x.id===_curId;}); if(p){ _renderDetail(p); return; } _curId=null; }
  _renderList();
};

/* ════════════════════════════════════════════ 목록 ════ */
function _renderList(){
  var el=document.getElementById('exportBody'); if(!el) return;
  function tabBtn(v,label,icon){ var on=(_view===v); return '<button onclick="exSetView(\''+v+'\')" style="background:none;border:none;cursor:pointer;font-family:var(--sans);font-size:13px;font-weight:600;padding:9px 4px;margin-right:20px;margin-bottom:-1px;border-bottom:2px solid '+(on?'var(--furniture)':'transparent')+';color:'+(on?'var(--text)':'var(--text-3)')+'"><i class="ti '+icon+'"></i> '+label+'</button>'; }
  var tabs='<div style="display:flex;align-items:center;margin-bottom:16px;border-bottom:1px solid var(--border)">'+tabBtn('projects','프로젝트 · Projects','ti-clipboard-list')+tabBtn('bomlib','BOM 라이브러리 · Library','ti-list-details')+'</div>';
  if(_view==='bomlib'){ el.innerHTML=tabs+_renderBomLibrary(); return; }
  var list=_projects().slice().sort(function(a,b){ return (b.exSeq||0)-(a.exSeq||0); });
  var active=list.filter(function(p){return p.status!=='closed';});
  var closed=list.filter(function(p){return p.status==='closed';});
  var h=tabs;
  h+='<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:14px">';
  h+= '<div style="font-size:12px;color:var(--text-2)">진행 · Active <b>'+active.length+'</b> · 완료 · Closed <b>'+closed.length+'</b></div>';
  h+= '<button class="btn btn-primary" onclick="exNewProject()" style="font-size:12px;padding:7px 13px"><i class="ti ti-plus"></i> 새 수출 프로젝트 · New</button>';
  h+='</div>';
  if(!list.length){
    h+='<div style="border:1px dashed var(--border-strong);border-radius:var(--radius);padding:40px;text-align:center;color:var(--text-3)"><i class="ti ti-ship" style="font-size:32px;display:block;margin-bottom:10px;opacity:.5"></i>등록된 수출 프로젝트가 없습니다 · No export projects yet<br>ETD만 입력하면 모든 마감일이 자동 계산됩니다 · Enter ETD to auto-schedule.</div>';
    el.innerHTML=h; return;
  }
  function card(p){
    var ov=_overall(p); var nd=_nextDue(p);
    var etd=p.etd?_fmtDate(_addDays(p.etd,0)):'ETD 미정 · TBA';
    var dots=PHASES.map(function(ph){ var pr=_phaseProg(p,ph.key); var full=pr.pct===100; return '<span title="'+ph.ko+' · '+ph.en+' '+pr.done+'/'+pr.total+'" style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;font-size:9px;font-weight:700;margin-right:3px;'+(full?('background:'+ph.c+';color:#fff'):('background:var(--surface-2);color:var(--text-3);border:1px solid var(--border)'))+'">'+ph.key+'</span>'; }).join('');
    var ndHtml='';
    if(nd){ var dc=_dueClass(p,nd.t); ndHtml='<div style="font-size:11px;color:var(--text-2);margin-top:8px">다음 · Next · <b>'+_esc(nd.t.ko)+'</b> <span style="color:'+dc.c+';font-weight:700">'+_fmtDate(nd.due)+(dc.label?(' · '+dc.label):'')+'</span></div>'; }
    else if(ov.pct===100){ ndHtml='<div style="font-size:11px;color:#15803d;margin-top:8px;font-weight:600"><i class="ti ti-circle-check"></i> 전 단계 완료 · All done</div>'; }
    var sup=_suppliers(p).join(', ');
    return '<div onclick="exOpen(\''+p.id+'\')" style="cursor:pointer;border:1px solid var(--border);border-radius:var(--radius);background:var(--surface);padding:16px 18px;margin-bottom:10px" onmouseover="this.style.borderColor=\'var(--border-strong)\'" onmouseout="this.style.borderColor=\'var(--border)\'">'+
      '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap">'+
        '<div style="min-width:0;flex:1">'+
          '<div style="font-size:11px;color:var(--text-3);font-family:var(--mono,monospace)">'+_esc(p.no||'')+' · '+_esc(p.incoterms||'')+(p.customer?(' · '+_esc(p.customer)):'')+' · '+_esc(sup)+'</div>'+
          '<div style="font-size:15px;font-weight:700;margin:2px 0 6px;letter-spacing:-.01em">'+_esc(p.name||'(제목 없음 · Untitled)')+'</div>'+
          '<div>'+dots+'</div>'+ ndHtml+
        '</div>'+
        '<div style="text-align:right;min-width:120px">'+
          '<div style="font-size:10px;color:var(--text-3)">ETD</div>'+
          '<div style="font-size:14px;font-weight:700;margin-bottom:6px">'+etd+'</div>'+
          '<div style="width:110px;height:6px;background:var(--surface-2);border-radius:3px;overflow:hidden;margin-left:auto"><div style="width:'+ov.pct+'%;height:100%;background:'+(ov.pct===100?'#15803d':'#1d4ed8')+'"></div></div>'+
          '<div style="font-size:10px;color:var(--text-2);margin-top:3px">'+ov.done+'/'+ov.total+' · '+ov.pct+'%</div>'+
        '</div>'+
      '</div></div>';
  }
  h+=active.map(card).join('');
  if(closed.length){ h+='<div style="font-size:11px;color:var(--text-3);margin:18px 0 8px;font-weight:600">완료·종료 · Closed</div>'+closed.map(card).join(''); }
  el.innerHTML=h;
}

/* ── 전체 BOM 라이브러리(모든 프로젝트 집계) ── */
function _renderBomLibrary(){
  var all=_allBomByModel();
  var q=_normKey(_bomQ);
  var lib=q?all.filter(function(m){return _normKey(m.model).indexOf(q)>=0;}):all;
  var sel=0, tot=0; all.forEach(function(m){ m.files.forEach(function(f){ tot++; if(_bomSel[f.id]) sel++; }); });
  var h='';
  h+='<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:14px">';
  h+= '<div style="font-size:12px;color:var(--text-2)">등록 모델 · Models <b>'+all.length+'</b> · 파일 · Files <b>'+tot+'</b></div>';
  h+= '<div style="display:flex;gap:8px;flex-wrap:wrap">';
  h+=  '<input value="'+_esc(_bomQ)+'" oninput="exBomQ(this.value)" placeholder="모델 검색 · Search model" style="font-size:12px;border:1px solid var(--border);border-radius:6px;padding:6px 10px;font-family:var(--sans);min-width:180px">';
  h+=  '<button onclick="exBomLibZip()" style="font-size:12px;border:1px solid #4338ca;background:'+(sel?'#4338ca':'#fff')+';color:'+(sel?'#fff':'#4338ca')+';border-radius:6px;padding:6px 12px;cursor:pointer;font-weight:600"><i class="ti ti-file-zip"></i> 선택 ZIP · ZIP'+(sel?(' ('+sel+')'):'')+'</button>';
  h+= '</div>';
  h+='</div>';
  if(!all.length){
    return h+'<div style="border:1px dashed var(--border-strong);border-radius:var(--radius);padding:40px;text-align:center;color:var(--text-3)"><i class="ti ti-list-details" style="font-size:32px;display:block;margin-bottom:10px;opacity:.5"></i>등록된 BOM이 없습니다 · No BOM registered yet<br>어느 프로젝트에서든 모델을 만들고 BOM을 업로드하면 여기에 모입니다 · Upload in any project and it appears here.</div>';
  }
  if(!lib.length){ h+='<div style="padding:24px;text-align:center;color:var(--text-3);font-size:12px">검색 결과 없음 · No match</div>'; return h; }
  lib.forEach(function(m){
    h+='<div style="border:1px solid var(--border);border-radius:var(--radius);background:var(--surface);padding:14px 16px;margin-bottom:10px">';
    h+= '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px">';
    h+=  '<i class="ti ti-box" style="color:#4338ca"></i>';
    h+=  '<div style="font-size:14px;font-weight:700">'+_esc(m.model)+'</div>';
    h+=  '<span style="font-size:10px;color:var(--text-3)">'+m.files.length+' file(s)</span>';
    h+= '</div>';
    h+= '<div style="font-size:10px;color:var(--text-3);margin-bottom:8px">사용 프로젝트 · Used in: '+m.usedIn.map(function(u){ return '<span style="background:var(--surface-2);border-radius:4px;padding:1px 6px;margin-right:4px">'+_esc(u.no||u.name||'')+'</span>'; }).join('')+'</div>';
    if(!m.files.length){ h+='<div style="font-size:11px;color:#dc2626;font-weight:600"><i class="ti ti-alert-circle"></i> 등록된 BOM 없음 · 업로드 필요 · No BOM on file</div>'; }
    else { h+=m.files.map(function(f){ var on=!!_bomSel[f.id];
      return '<div style="display:flex;align-items:center;gap:8px;font-size:11px;padding:3px 0">'+
        '<span onclick="exBomSel(\''+f.id+'\')" style="cursor:pointer;width:15px;height:15px;border-radius:4px;border:1.5px solid '+(on?'#4338ca':'var(--border-strong)')+';background:'+(on?'#4338ca':'transparent')+';display:flex;align-items:center;justify-content:center;flex-shrink:0">'+(on?'<i class="ti ti-check" style="color:#fff;font-size:10px"></i>':'')+'</span>'+
        '<i class="ti ti-file-3d" style="color:#4338ca"></i>'+
        '<a href="'+_esc(f.url)+'" download="'+_esc(f.name)+'" target="_blank" rel="noopener" style="flex:1;color:#1d4ed8;text-decoration:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+_esc(f.name)+'</a>'+
        '<span style="color:var(--text-3)">'+_fmtSize(f.size)+'</span>'+
        '<a href="'+_esc(f.url)+'" download="'+_esc(f.name)+'" style="color:var(--text-2);text-decoration:none" title="다운로드 · download"><i class="ti ti-download"></i></a>'+
      '</div>'; }).join(''); }
    h+='</div>';
  });
  return h;
}

/* ════════════════════════════════════════════ 상세 ════ */
function _renderDetail(p){
  var el=document.getElementById('exportBody'); if(!el) return;
  var ov=_overall(p); var sups=_suppliers(p);
  var h='';
  h+='<div style="border:1px solid var(--border);border-radius:var(--radius);background:var(--surface);padding:18px 20px;margin-bottom:14px">';
  h+= '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:14px;flex-wrap:wrap">';
  h+=  '<div style="flex:1;min-width:240px">';
  h+=   '<div style="font-size:11px;color:var(--text-3);font-family:var(--mono,monospace)">'+_esc(p.no||'')+'</div>';
  h+=   '<input value="'+_esc(p.name||'')+'" onchange="exField(\''+p.id+'\',\'name\',this.value)" style="font-size:17px;font-weight:700;border:none;background:transparent;width:100%;padding:2px 0;letter-spacing:-.01em;font-family:var(--sans)" placeholder="프로젝트명 · Project name">';
  h+=   '<div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:8px;font-size:12px;color:var(--text-2)">';
  h+=    _kv('고객사 · Customer','<input value="'+_esc(p.customer||'')+'" onchange="exField(\''+p.id+'\',\'customer\',this.value)" '+_ins(150)+' placeholder="INICS AMERICA (MX)">');
  h+=    _kv('Customer PO','<input value="'+_esc(p.customerPO||'')+'" onchange="exField(\''+p.id+'\',\'customerPO\',this.value)" '+_ins(120)+'>');
  h+=    _kv('Incoterms','<select onchange="exField(\''+p.id+'\',\'incoterms\',this.value)" '+_ins(90)+'>'+INCOTERMS.map(function(x){return '<option '+(p.incoterms===x?'selected':'')+'>'+x+'</option>';}).join('')+'</select>');
  h+=   '</div>';
  h+=   '<div style="margin-top:8px;font-size:12px;color:var(--text-2)">'+_kv('공급사 · Suppliers','<input value="'+_esc(sups.join(', '))+'" onchange="exSuppliers(\''+p.id+'\',this.value)" '+_ins(320)+' placeholder="FURSYS, ... (쉼표 구분 · comma)">')+'<span style="font-size:10px;color:var(--text-3);margin-left:6px">여러 공급사 입력 시 관련 항목은 공급사별 체크 · per-supplier checks</span></div>';
  h+=  '</div>';
  h+=  '<div style="text-align:right;background:var(--surface-2);border-radius:var(--radius);padding:12px 14px;min-width:190px">';
  h+=   '<div style="font-size:10px;color:var(--text-3);letter-spacing:.04em;font-weight:600">ETD · 역산 기준일 · anchor</div>';
  h+=   '<input type="date" value="'+_esc(p.etd||'')+'" onchange="exField(\''+p.id+'\',\'etd\',this.value)" style="font-size:15px;font-weight:700;border:1px solid var(--border);border-radius:6px;padding:4px 8px;margin-top:5px;font-family:var(--sans)">';
  h+=   '<div style="font-size:10px;color:var(--text-3);margin-top:6px;max-width:180px">입력 시 모든 마감일 자동 재계산 · auto re-schedule</div>';
  h+=  '</div>';
  h+= '</div>';
  h+= '<div style="margin-top:16px">';
  h+=  '<div style="display:flex;align-items:center;justify-content:space-between;font-size:11px;color:var(--text-2);margin-bottom:5px"><span>전체 진행 · Overall</span><b style="color:var(--text)">'+ov.done+' / '+ov.total+' · '+ov.pct+'%</b></div>';
  h+=  '<div style="display:flex;gap:3px;height:9px">'+PHASES.map(function(ph){ var pr=_phaseProg(p,ph.key); return '<div title="'+ph.ko+' '+pr.pct+'%" style="flex:'+pr.total+';background:var(--surface-2);border-radius:3px;overflow:hidden"><div style="width:'+pr.pct+'%;height:100%;background:'+ph.c+'"></div></div>'; }).join('')+'</div>';
  h+= '</div>';
  h+='</div>';

  /* 일정(실제 날짜 · 텍스트 · 완료 취소선) */
  h+=_renderSchedule(p);

  /* BOM (모델별 자재명세서 · Firebase Storage) */
  h+=_renderBom(p);

  /* Phase 아코디언 */
  PHASES.forEach(function(ph){
    var pr=_phaseProg(p,ph.key); var full=pr.pct===100;
    h+='<div style="border:1px solid var(--border);border-radius:var(--radius);background:var(--surface);margin-bottom:10px;overflow:hidden">';
    h+= '<div style="display:flex;align-items:center;gap:10px;padding:12px 16px;border-left:3px solid '+ph.c+'">';
    h+=  '<span style="font-size:10px;font-weight:800;color:'+ph.c+';font-family:var(--mono,monospace)">'+ph.key+'</span>';
    h+=  '<div style="flex:1"><div style="font-size:13px;font-weight:700">'+ph.ko+' · '+ph.en+'</div></div>';
    h+=  '<div style="font-size:11px;color:'+(full?'#15803d':'var(--text-3)')+';font-weight:600">'+(full?'<i class="ti ti-circle-check"></i> ':'')+pr.done+'/'+pr.total+'</div>';
    h+= '</div>';
    var body='';
    if(ph.key==='P3') body+=_renderBookingBlock(p);
    var fcStarted=false;
    _phaseTasks(ph.key).forEach(function(t){
      if(ph.key==='P3' && t.fc && !fcStarted){ fcStarted=true; body+='<div style="padding:8px 16px;border-top:1px solid var(--border);background:#f0fdfa;font-size:11px;font-weight:700;color:#0f766e"><i class="ti ti-arrows-transfer-up"></i> 포워더 조율 · Forwarder Coordination</div>'; }
      body+=_taskRow(p,t);
    });
    h+= '<div>'+body+'</div>';
    h+='</div>';
  });

  h+='<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px">';
  h+= '<button class="btn btn-primary" onclick="exSaveList(\''+p.id+'\')" style="font-size:12px;padding:7px 13px"><i class="ti ti-device-floppy"></i> 저장하고 목록으로 · Save & list</button>';
  h+= '<button class="btn btn-outline" onclick="exToggleClose(\''+p.id+'\')" style="font-size:12px;padding:7px 13px">'+(p.status==='closed'?'<i class="ti ti-rotate"></i> 재개 · Reopen':'<i class="ti ti-archive"></i> 종료 · Close')+'</button>';
  h+= '<button class="btn btn-outline" onclick="exCopySummary(\''+p.id+'\')" style="font-size:12px;padding:7px 13px"><i class="ti ti-copy"></i> 진행현황 복사 · Copy status</button>';
  h+= '<button class="btn btn-outline" onclick="exDelete(\''+p.id+'\')" style="font-size:12px;padding:7px 13px;color:var(--danger)"><i class="ti ti-trash"></i> 삭제 · Delete</button>';
  h+='</div>';
  el.innerHTML=h;
}

function _kv(k,v){ return '<span style="display:inline-flex;align-items:center;gap:5px"><span style="color:var(--text-3);font-size:11px">'+k+'</span>'+v+'</span>'; }
function _ins(w){ return 'style="font-size:12px;border:1px solid var(--border);border-radius:5px;padding:3px 7px;width:'+w+'px;font-family:var(--sans)"'; }

/* ── 일정(실제 날짜 · 완료 취소선) ── */
function _renderSchedule(p){
  if(!p.etd) return '<div style="font-size:11px;color:var(--text-3);margin-bottom:12px;padding:10px 14px;background:var(--surface);border:1px dashed var(--border);border-radius:var(--radius)">ETD를 입력하면 일정이 표시됩니다 · Enter ETD to generate the schedule.</div>';
  var rows=TASKS.map(function(t){return {t:t, due:_dueOf(p,t), done:_isDone(p,t)};});
  rows.sort(function(a,b){ return (a.due-b.due) || (a.t.d-b.t.d); });
  var today=_today0(), todayShown=false;
  var h='<div style="border:1px solid var(--border);border-radius:var(--radius);background:var(--surface);padding:14px 16px;margin-bottom:12px">';
  h+='<div style="font-size:11px;font-weight:700;color:var(--text-2);margin-bottom:10px"><i class="ti ti-calendar-event"></i> 일정 · Schedule <span style="font-weight:400;color:var(--text-3)">— ETD 역산 실제 날짜 · actual dates</span></div>';
  rows.forEach(function(r){
    if(!todayShown && r.due>=today){ todayShown=true; h+='<div style="display:flex;align-items:center;gap:8px;margin:5px 0"><span style="font-size:10px;font-weight:700;color:#dc2626;white-space:nowrap">오늘 · TODAY '+_fmtDate(today)+'</span><span style="flex:1;height:1px;background:#dc2626;opacity:.35"></span></div>'; }
    var dc=_dueClass(p,r.t);
    var ph=PHASES.find(function(x){return x.key===r.t.ph;});
    var strike=r.done?'text-decoration:line-through;color:var(--text-3)':'';
    h+='<div style="display:flex;align-items:center;gap:10px;padding:4px 0;font-size:12px">';
    h+= '<span style="font-family:var(--mono,monospace);font-size:11px;min-width:84px;color:'+(r.done?'var(--text-3)':dc.c)+';'+strike+'">'+_fmtDate(r.due)+'</span>';
    h+= '<span style="width:7px;height:7px;border-radius:2px;background:'+ph.c+';flex-shrink:0;opacity:'+(r.done?'.4':'1')+'"></span>';
    h+= '<span style="flex:1;'+strike+'">'+(r.t.doc?'<i class="ti ti-file-text" style="font-size:12px;color:'+(r.done?'var(--text-3)':'#dc2626')+'"></i> ':'')+_esc(r.t.ko)+' <span style="color:var(--text-3);font-size:11px">'+_esc(r.t.en)+'</span></span>';
    h+= (r.done?'<i class="ti ti-check" style="color:#15803d;font-size:14px"></i>':(dc.label?('<span style="font-size:10px;color:'+dc.c+';font-weight:600;white-space:nowrap">'+dc.label+'</span>'):''));
    h+='</div>';
  });
  h+='</div>';
  return h;
}

/* ── Booking Information (P3 내부) ── */
function _bk(p){ if(!p.booking) p.booking={}; return p.booking; }
function _renderBookingBlock(p){
  var b=_bk(p);
  var h='<div style="padding:14px 16px;border-top:1px solid var(--border);background:#f0fdfa">';
  h+= '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:10px">';
  h+=  '<div style="font-size:11px;font-weight:700;color:#0f766e"><i class="ti ti-clipboard-list"></i> Booking Confirmation · 부킹 정보 (멕시코 포워더 수령 · from MX forwarder)</div>';
  h+=  '<button onclick="exFwdMail(\''+p.id+'\')" style="font-size:11px;border:1px solid #0f766e;background:#fff;color:#0f766e;border-radius:6px;padding:5px 11px;cursor:pointer;font-weight:600"><i class="ti ti-mail-forward"></i> 포워더 조율 메일 · Forwarder email</button>';
  h+= '</div>';
  h+= '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px;padding:9px 11px;background:#fff;border-radius:6px">';
  h+=  '<span style="font-size:11px;color:var(--text-3);font-weight:700">ETD · Carrier</span>';
  h+=  '<input type="date" value="'+_esc(b.etd||p.etd||'')+'" onchange="exBooking(\''+p.id+'\',\'etd\',this.value)" style="font-size:12px;border:1px solid var(--border);border-radius:5px;padding:3px 7px;font-family:var(--sans)">';
  h+=  '<button onclick="exApplyBookingEtd(\''+p.id+'\')" style="font-size:10px;border:1px solid var(--border-strong);background:var(--surface);border-radius:5px;padding:4px 9px;cursor:pointer;font-weight:600"><i class="ti ti-arrow-bar-to-right"></i> 역산 기준 적용 · Apply as anchor</button>';
  h+=  (p.etd?('<span style="font-size:10px;color:var(--text-3)">현재 기준일 · anchor '+_esc(p.etd)+'</span>'):'<span style="font-size:10px;color:#dc2626;font-weight:600">기준일 미설정 · no anchor</span>');
  h+= '</div>';
  h+= '<div style="display:flex;flex-wrap:wrap;gap:9px">';
  BOOKING_FIELDS.forEach(function(f){
    var input;
    if(f.sel){ input='<select onchange="exBooking(\''+p.id+'\',\''+f.k+'\',this.value)" style="font-size:12px;border:1px solid var(--border);border-radius:5px;padding:3px 6px;font-family:var(--sans);width:'+f.w+'px"><option value=""></option>'+f.sel.map(function(o){return '<option '+(b[f.k]===o?'selected':'')+'>'+o+'</option>';}).join('')+'</select>'; }
    else { input='<input '+(f.type==='date'?'type="date" ':'')+'value="'+_esc(b[f.k]||'')+'" onchange="exBooking(\''+p.id+'\',\''+f.k+'\',this.value)" placeholder="'+_esc(f.ph||'')+'" style="font-size:12px;border:1px solid var(--border);border-radius:5px;padding:3px 7px;font-family:var(--sans);width:'+f.w+'px">'; }
    h+='<div style="display:flex;flex-direction:column;gap:2px"><span style="font-size:10px;color:var(--text-3)">'+f.ko+'</span>'+input+'</div>';
  });
  h+= '</div>';
  h+='</div>';
  return h;
}

/* ── BOM (모델별 자재명세서 · Firebase Storage) ── */
function _bomModels(p){ if(!Array.isArray(p.bom)) p.bom=[]; return p.bom; }
function _loadJSZip(){ return new Promise(function(res,rej){ if(window.JSZip) return res(window.JSZip); var s=document.createElement('script'); s.src='https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'; s.onload=function(){ window.JSZip?res(window.JSZip):rej(new Error('JSZip missing')); }; s.onerror=function(){ rej(new Error('JSZip load failed')); }; document.head.appendChild(s); }); }
function _renderBom(p){
  var models=_bomModels(p);
  var codes=_allBomByModel().map(function(x){return x.model;});   /* 등록된 모델 코드 목록 */
  var sel=0, tot=0; models.forEach(function(m){ (m.files||[]).forEach(function(f){ tot++; if(_bomSel[f.id]) sel++; }); });
  var h='<div style="border:1px solid var(--border);border-radius:var(--radius);background:var(--surface);margin-bottom:12px;overflow:hidden">';
  h+='<div style="display:flex;align-items:center;gap:10px;padding:12px 16px;border-left:3px solid #4338ca;background:#eef2ff;flex-wrap:wrap">';
  h+= '<i class="ti ti-list-details" style="color:#4338ca;font-size:16px"></i>';
  h+= '<div style="flex:1;min-width:150px"><div style="font-size:13px;font-weight:700">BOM · Bill of Materials</div><div style="font-size:10px;color:var(--text-3)">모델별 자재명세서 · by model · Firebase 저장 · '+tot+' files</div></div>';
  h+= '<button onclick="exBomZip(\''+p.id+'\')" style="font-size:11px;border:1px solid #4338ca;background:'+(sel?'#4338ca':'#fff')+';color:'+(sel?'#fff':'#4338ca')+';border-radius:6px;padding:5px 11px;cursor:pointer;font-weight:600"><i class="ti ti-file-zip"></i> 선택 ZIP 다운로드 · ZIP'+(sel?(' ('+sel+')'):'')+'</button>';
  h+= '<button onclick="exBomAddModel(\''+p.id+'\')" style="font-size:11px;border:1px solid var(--border-strong);background:var(--surface);border-radius:6px;padding:5px 11px;cursor:pointer;font-weight:600"><i class="ti ti-plus"></i> 모델 추가 · Add model</button>';
  h+='</div>';
  if(!models.length){
    h+='<div style="padding:20px 16px;text-align:center;color:var(--text-3);font-size:12px">등록된 모델이 없습니다 · No models yet — <b>모델 추가 · Add model</b>로 시작하세요.</div>';
  } else {
    models.forEach(function(m){
      h+='<div style="padding:12px 16px;border-top:1px solid var(--border)">';
      h+= '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px">';
      /* 모델 코드 드롭다운 (등록된 코드 선택) */
      var cur=m.model||'';
      var showNew=!!_bomNewCode[m.id];
      var opts='<option value="">— 모델 선택 · Select model —</option>';
      codes.forEach(function(c){ opts+='<option value="'+_esc(c)+'" '+(cur===c?'selected':'')+'>'+_esc(c)+'</option>'; });
      opts+='<option value="__new__" '+(showNew?'selected':'')+'>＋ 새 모델 코드 · New code</option>';
      h+=  '<select onchange="exBomPickModel(\''+p.id+'\',\''+m.id+'\',this.value)" style="font-size:12px;font-weight:600;border:1px solid var(--border);border-radius:5px;padding:4px 8px;width:230px;font-family:var(--sans)">'+opts+'</select>';
      if(showNew){ h+='<input value="'+_esc(cur)+'" onchange="exBomNewCode(\''+p.id+'\',\''+m.id+'\',this.value)" placeholder="새 모델 코드 입력 · New model code" autofocus style="font-size:12px;font-weight:600;border:1px solid #4338ca;border-radius:5px;padding:4px 8px;width:200px;font-family:var(--sans)">'; }
      h+=  '<input value="'+_esc(m.note||'')+'" onchange="exBomModelField(\''+p.id+'\',\''+m.id+'\',\'note\',this.value)" placeholder="비고 · note" style="flex:1;min-width:120px;font-size:11px;border:none;border-bottom:1px solid var(--border);padding:3px;background:transparent;font-family:var(--sans)">';
      h+=  '<button onclick="exBomUpload(\''+p.id+'\',\''+m.id+'\')" style="font-size:10px;border:1px solid #4338ca;background:#eef2ff;color:#4338ca;border-radius:5px;padding:4px 9px;cursor:pointer;font-weight:600"><i class="ti ti-upload"></i> BOM 업로드 · Upload</button>';
      h+=  '<button onclick="exBomDelModel(\''+p.id+'\',\''+m.id+'\')" style="font-size:10px;border:none;background:none;color:var(--danger);cursor:pointer"><i class="ti ti-trash"></i></button>';
      h+= '</div>';
      var files=m.files||[];
      if(!files.length){
        var lib=_bomFilesForModel(m.model, p.id);
        if(lib.length) h+='<div style="font-size:11px;color:#4338ca;font-weight:600;padding-left:2px"><i class="ti ti-link"></i> 기존 BOM '+lib.length+'개 있음 · 모델명 확정 시 자동 연결 · existing BOM found</div>';
        else h+='<div style="font-size:11px;color:#dc2626;font-weight:600;padding-left:2px"><i class="ti ti-alert-circle"></i> 등록된 BOM 없음 · 업로드 필요 · No BOM on file — upload required</div>';
      }
      else { h+=files.map(function(f){ var on=!!_bomSel[f.id];
        return '<div style="display:flex;align-items:center;gap:8px;font-size:11px;padding:3px 0">'+
          '<span onclick="exBomSel(\''+f.id+'\')" style="cursor:pointer;width:15px;height:15px;border-radius:4px;border:1.5px solid '+(on?'#4338ca':'var(--border-strong)')+';background:'+(on?'#4338ca':'transparent')+';display:flex;align-items:center;justify-content:center;flex-shrink:0">'+(on?'<i class="ti ti-check" style="color:#fff;font-size:10px"></i>':'')+'</span>'+
          '<i class="ti ti-file-3d" style="color:#4338ca"></i>'+
          '<a href="'+_esc(f.url)+'" download="'+_esc(f.name)+'" target="_blank" rel="noopener" style="flex:1;color:#1d4ed8;text-decoration:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+_esc(f.name)+'</a>'+
          '<span style="color:var(--text-3)">'+_fmtSize(f.size)+'</span>'+
          '<a href="'+_esc(f.url)+'" download="'+_esc(f.name)+'" style="color:var(--text-2);text-decoration:none" title="다운로드 · download"><i class="ti ti-download"></i></a>'+
          '<button onclick="exBomDelFile(\''+p.id+'\',\''+m.id+'\',\''+f.id+'\')" style="border:none;background:none;color:var(--danger);cursor:pointer;font-size:11px;padding:0"><i class="ti ti-x"></i></button>'+
        '</div>'; }).join(''); }
      h+='</div>';
    });
  }
  h+='</div>';
  return h;
}

/* ── task 행 (담당 고정 · 제출서류 빨강 · 공급사별 체크) ── */
function _taskRow(p, t){
  var ts=_ts(p,t.id);
  var done=_isDone(p,t);
  var dc=_dueClass(p,t);
  var due=_dueOf(p,t);
  var atts=ts.atts||[];
  var sups=_suppliers(p);
  var multiSup = t.perSup && sups.length>1;
  var isDoc=!!t.doc;
  var rowBg = done ? '#f0fdf4' : (isDoc ? '#fef2f2' : '');
  var h='<div style="display:flex;align-items:flex-start;gap:10px;padding:10px 16px;border-top:1px solid var(--border);'+(isDoc&&!done?'border-left:3px solid #dc2626;':'')+(rowBg?('background:'+rowBg+';'):'')+'">';
  if(multiSup){
    h+='<div style="flex-shrink:0;margin-top:1px;width:18px;height:18px;border-radius:5px;border:1.5px solid '+(done?'#15803d':'var(--border-strong)')+';background:'+(done?'#15803d':'transparent')+';display:flex;align-items:center;justify-content:center">'+(done?'<i class="ti ti-check" style="color:#fff;font-size:12px"></i>':'')+'</div>';
  } else {
    h+='<div onclick="exToggleTask(\''+p.id+'\',\''+t.id+'\')" style="cursor:pointer;flex-shrink:0;margin-top:1px;width:18px;height:18px;border-radius:5px;border:1.5px solid '+(done?'#15803d':(isDoc?'#dc2626':'var(--border-strong)'))+';background:'+(done?'#15803d':'transparent')+';display:flex;align-items:center;justify-content:center">'+(done?'<i class="ti ti-check" style="color:#fff;font-size:12px"></i>':'')+'</div>';
  }
  h+='<div style="flex:1;min-width:0">';
  h+= '<div style="font-size:13px;font-weight:600;'+(done?'color:var(--text-3);text-decoration:line-through':(isDoc?'color:#b91c1c':''))+'">'+(isDoc?'<i class="ti ti-file-text" style="font-size:13px"></i> ':'')+_esc(t.ko)+' <span style="font-weight:400;color:var(--text-3);font-size:11px">'+_esc(t.en)+'</span>'
     +(t.once?' <span style="font-size:9px;background:#eef2ff;color:#4338ca;padding:1px 5px;border-radius:4px">1회 · once</span>':'')
     +(isDoc?' <span style="font-size:9px;background:#fee2e2;color:#b91c1c;padding:1px 5px;border-radius:4px">제출서류 · Doc</span>':'')
     +'</div>';
  if(t.sub){ if(isDoc){ h+='<div style="margin-top:4px;color:#dc2626;font-weight:600;font-size:12px;line-height:1.45"><i class="ti ti-alert-circle" style="font-size:12px"></i> 수령 서류 · Docs to receive: '+_esc(t.sub)+'</div>'; } else { h+='<div style="font-size:10px;color:var(--text-3);margin-top:2px">'+_esc(t.sub)+'</div>'; } }
  h+= '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:6px">';
  h+=  '<span style="font-size:10px;background:var(--surface-2);color:var(--text-2);border-radius:5px;padding:2px 7px;font-weight:600"><i class="ti ti-user" style="font-size:10px"></i> '+_own(t.owner)+'</span>';
  h+=  '<span style="font-size:11px;font-weight:700;color:'+dc.c+'"><i class="ti ti-calendar" style="font-size:11px"></i> '+_fmtDate(due)+(dc.label?(' · '+dc.label):'')+'</span>';
  h+=  '<input value="'+_esc(ts.note||'')+'" onchange="exTaskNote(\''+p.id+'\',\''+t.id+'\',this.value)" placeholder="메모 · note" style="flex:1;min-width:90px;font-size:11px;border:none;border-bottom:1px solid var(--border);padding:2px;background:transparent;font-family:var(--sans)">';
  h+=  '<button onclick="exAttach(\''+p.id+'\',\''+t.id+'\')" style="font-size:10px;border:1px solid var(--border);background:var(--surface-2);border-radius:5px;padding:3px 8px;cursor:pointer;color:var(--text-2)"><i class="ti ti-paperclip"></i> '+(atts.length?atts.length:'첨부·file')+'</button>';
  h+= '</div>';
  if(multiSup){
    h+='<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">';
    sups.forEach(function(s,si){
      var on=!!(ts.bySup&&ts.bySup[s]);
      h+='<div onclick="exToggleSup(\''+p.id+'\',\''+t.id+'\','+si+')" style="cursor:pointer;display:flex;align-items:center;gap:5px;font-size:11px;border:1px solid '+(on?'#15803d':'var(--border)')+';background:'+(on?'#f0fdf4':'var(--surface)')+';border-radius:6px;padding:3px 9px"><span style="width:14px;height:14px;border-radius:4px;border:1.5px solid '+(on?'#15803d':'var(--border-strong)')+';background:'+(on?'#15803d':'transparent')+';display:flex;align-items:center;justify-content:center">'+(on?'<i class="ti ti-check" style="color:#fff;font-size:10px"></i>':'')+'</span>'+_esc(s)+'</div>';
    });
    h+='</div>';
  }
  if(atts.length){ h+='<div style="margin-top:6px;display:flex;flex-direction:column;gap:3px">'+atts.map(function(a,i){ return '<div style="display:flex;align-items:center;gap:6px;font-size:10px;color:var(--text-2)"><i class="ti ti-file"></i><a href="'+_esc(a.url)+'" target="_blank" rel="noopener" style="color:#1d4ed8;text-decoration:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:220px">'+_esc(a.name)+'</a><span style="color:var(--text-3)">'+_fmtSize(a.size)+'</span><button onclick="exRmAtt(\''+p.id+'\',\''+t.id+'\','+i+')" style="border:none;background:none;color:var(--danger);cursor:pointer;font-size:11px;padding:0"><i class="ti ti-x"></i></button></div>'; }).join('')+'</div>'; }
  h+='</div></div>';
  return h;
}
function _fmtSize(b){ b=+b||0; if(b<1024) return b+'B'; if(b<1048576) return (b/1024).toFixed(0)+'KB'; return (b/1048576).toFixed(1)+'MB'; }

/* ════════════════════════════════════════════ 핸들러 ════ */
window.exOpen=function(id){ _curId=id; renderExportApp(); };

window.exNewProject=function(){
  var p={ id:'ex_'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),
    exSeq:0, no:'', name:'', customer:'', customerPO:'', suppliers:['FURSYS'], incoterms:'FOB',
    etd:'', status:'active', tasks:{}, booking:{}, createdAt:Date.now() };
  p.exSeq=_nextSeq(); p.no=_genNo(p.exSeq);
  _stamp(p); _projects().push(p); _save();
  _curId=p.id; renderExportApp(); _toast('새 수출 프로젝트 · New · '+p.no);
};

window.exField=function(id,k,v){ var p=_projects().find(function(x){return x.id===id;}); if(!p) return; p[k]=v; _stamp(p); _save(); renderExportApp(); };

window.exSuppliers=function(id,v){
  var p=_projects().find(function(x){return x.id===id;}); if(!p) return;
  var arr=String(v||'').split(',').map(function(s){return s.trim();}).filter(Boolean);
  var seen={}, out=[]; arr.forEach(function(s){ var kk=s.toLowerCase(); if(!seen[kk]){ seen[kk]=1; out.push(s); } });
  if(!out.length) out=['FURSYS'];
  p.suppliers=out; p.supplier=out[0]; _stamp(p); _save(); renderExportApp();
};

window.exToggleTask=function(id,tid){
  var p=_projects().find(function(x){return x.id===id;}); if(!p) return;
  var ts=_ts(p,tid); ts.done=!ts.done; ts.doneAt=ts.done?Date.now():null;
  var t=TASKS.find(function(x){return x.id===tid;});
  if(t&&t.once){ state.exportEcosyDone=!!ts.done; }
  _stamp(p); _save(); renderExportApp();
};
window.exToggleSup=function(id,tid,si){
  var p=_projects().find(function(x){return x.id===id;}); if(!p) return;
  var s=_suppliers(p)[si]; if(s==null) return;
  var ts=_ts(p,tid); if(!ts.bySup) ts.bySup={}; ts.bySup[s]=!ts.bySup[s];
  _stamp(p); _save(); renderExportApp();
};
window.exTaskNote=function(id,tid,v){ var p=_projects().find(function(x){return x.id===id;}); if(!p) return; _ts(p,tid).note=v; _stamp(p); _save(); };

window.exToggleClose=function(id){ var p=_projects().find(function(x){return x.id===id;}); if(!p) return; p.status=(p.status==='closed')?'active':'closed'; _stamp(p); _save(); renderExportApp(); _toast(p.status==='closed'?'종료 · Closed':'재개 · Reopened'); };
window.exDelete=function(id){ var p=_projects().find(function(x){return x.id===id;}); if(!p) return; if(!confirm('삭제할까요? · Delete this project?\n'+(p.no||'')+' '+(p.name||''))) return; state.exportProjects=_projects().filter(function(x){return x.id!==id;}); _save(); _curId=null; renderExportApp(); _toast('삭제 완료 · Deleted'); };

/* Booking */
window.exBooking=function(id,k,v){ var p=_projects().find(function(x){return x.id===id;}); if(!p) return; _bk(p)[k]=v; _stamp(p); _save(); };
window.exApplyBookingEtd=function(id){ var p=_projects().find(function(x){return x.id===id;}); if(!p) return; var b=_bk(p); if(!b.etd){ _toast('Booking ETD를 먼저 입력 · Enter Booking ETD first'); return; } p.etd=b.etd; _stamp(p); _save(); renderExportApp(); _toast('역산 기준일 적용 · anchor set ('+b.etd+')'); };
window.exFwdMail=function(id){
  var p=_projects().find(function(x){return x.id===id;}); if(!p) return;
  var b=_bk(p); var etd=p.etd||b.etd||'TBA';
  var L=[
    'To: Forwarder',
    'Cc: INICS VINA (Exporter)',
    'Subject: Export Booking Coordination — '+(b.bookingNo||'(Booking No.)')+' / ETD '+etd,
    '',
    'Dear Forwarder,',
    '',
    'Please find the booking confirmation from our Mexico forwarder.',
    'Kindly coordinate directly with the destination forwarder / carrier agent',
    'for the export arrangements (SI, VGM, Export Declaration, Draft B/L).',
    'Please keep INICS VINA copied (CC) on all communications.',
    '',
    '■ Booking Information',
    '- Booking No.   : '+(b.bookingNo||''),
    '- Carrier       : '+(b.carrier||''),
    '- Vessel/Voyage : '+(b.vessel||'')+(b.voyage?(' / '+b.voyage):''),
    '- POL / POD     : '+(b.pol||'')+' -> '+(b.pod||''),
    '- ETD / ETA     : '+etd+' / '+(b.eta||''),
    '- Container     : '+(b.ctype||'')+(b.cqty?(' x '+b.cqty):''),
    '- Freight Term  : '+(b.freight||''),
    '',
    'Project Ref.: '+(p.no||'')+' '+(p.name||''),
    '',
    'Best regards,',
    'INICS VINA'
  ];
  _clip(L.join('\n'),'포워더 조율 메일 초안 복사 · Forwarder email copied');
};

/* 첨부: Firebase Storage 업로드 → URL 저장 */
window.exAttach=function(id,tid){
  var inp=document.getElementById('exFileInput'); if(!inp) return;
  inp.value=''; inp.onchange=function(){
    var f=inp.files&&inp.files[0]; if(!f) return;
    if(f.size>15*1024*1024){ _toast('파일이 너무 큽니다(최대 15MB) · Max 15MB'); return; }
    _toast('업로드 중 · Uploading… '+f.name);
    _uploadStorage(f,id,tid).then(function(meta){
      var p=_projects().find(function(x){return x.id===id;}); if(!p) return;
      var ts=_ts(p,tid); if(!ts.atts) ts.atts=[]; ts.atts.push(meta);
      _stamp(p); _save(); renderExportApp(); _toast('첨부 완료 · Attached '+f.name);
    }).catch(function(e){ _toast('업로드 실패 · Upload failed '+(e&&e.message||'')); });
  };
  inp.click();
};
window.exRmAtt=function(id,tid,i){ var p=_projects().find(function(x){return x.id===id;}); if(!p) return; var ts=_ts(p,tid); if(ts.atts) ts.atts.splice(i,1); _stamp(p); _save(); renderExportApp(); };

/* 저장하고 목록으로 */
window.exSaveList=function(id){ var p=_projects().find(function(x){return x.id===id;}); if(p) _stamp(p); _save(); _curId=null; renderExportApp(); _toast('저장 · Saved — 목록에서 관리 · in list'); };

/* ── BOM 핸들러 (Firebase Storage) ── */
window.exBomAddModel=function(id){ var p=_projects().find(function(x){return x.id===id;}); if(!p) return; _bomModels(p).push({id:'bm_'+Date.now().toString(36)+Math.random().toString(36).slice(2,5), model:'', note:'', files:[]}); _stamp(p); _save(); renderExportApp(); };
window.exBomModelField=function(id,mid,k,v){
  var p=_projects().find(function(x){return x.id===id;}); if(!p) return;
  var m=_bomModels(p).find(function(x){return x.id===mid;}); if(!m) return;
  m[k]=v;
  if(k==='model'){
    var existing=_bomFilesForModel(v, id);
    if(existing.length && (!m.files||!m.files.length)){
      m.files=existing.map(function(f){ return Object.assign({}, f, {id:'bf_'+Date.now().toString(36)+Math.random().toString(36).slice(2,5)}); });
      _toast('기존 BOM 자동 연결 · Linked '+existing.length+' file(s)');
    }
    _stamp(p); _save(); renderExportApp();
  } else { _stamp(p); _save(); }
};
/* 드롭다운에서 등록된 모델 코드 선택 (또는 '＋ 새 코드') */
window.exBomPickModel=function(id,mid,val){
  if(val==='__new__'){ _bomNewCode[mid]=true; renderExportApp(); return; }
  _bomNewCode[mid]=false;
  window.exBomModelField(id,mid,'model',val);   /* 선택 시 기존 BOM 자동 연결 */
};
/* 새 모델 코드 직접 입력 → 등록 */
window.exBomNewCode=function(id,mid,val){
  val=String(val||'').trim();
  if(!val){ _bomNewCode[mid]=false; renderExportApp(); return; }
  _bomNewCode[mid]=false;
  window.exBomModelField(id,mid,'model',val);
};
window.exBomDelModel=function(id,mid){ var p=_projects().find(function(x){return x.id===id;}); if(!p) return; if(!confirm('모델 삭제? · Delete model?')) return; var m=_bomModels(p).find(function(x){return x.id===mid;}); if(m&&m.files) m.files.forEach(function(f){ delete _bomSel[f.id]; }); p.bom=_bomModels(p).filter(function(x){return x.id!==mid;}); _stamp(p); _save(); renderExportApp(); };
window.exBomDelFile=function(id,mid,fid){ var p=_projects().find(function(x){return x.id===id;}); if(!p) return; var m=_bomModels(p).find(function(x){return x.id===mid;}); if(!m) return; m.files=(m.files||[]).filter(function(f){return f.id!==fid;}); delete _bomSel[fid]; _stamp(p); _save(); renderExportApp(); };
window.exBomSel=function(fid){ _bomSel[fid]=!_bomSel[fid]; renderExportApp(); };
window.exBomUpload=function(id,mid){
  var inp=document.getElementById('exFileInput'); if(!inp) return;
  inp.value=''; inp.onchange=function(){
    var f=inp.files&&inp.files[0]; if(!f) return;
    if(f.size>25*1024*1024){ _toast('파일이 너무 큽니다(최대 25MB) · Max 25MB'); return; }
    _toast('BOM 업로드 중 · Uploading… '+f.name);
    _uploadStorage(f,id,'bom/'+mid).then(function(meta){
      var p=_projects().find(function(x){return x.id===id;}); if(!p) return;
      var m=_bomModels(p).find(function(x){return x.id===mid;}); if(!m) return;
      meta.id='bf_'+Date.now().toString(36)+Math.random().toString(36).slice(2,5);
      if(!m.files) m.files=[]; m.files.push(meta);
      _stamp(p); _save(); renderExportApp(); _toast('BOM 업로드 완료 · Uploaded '+f.name);
    }).catch(function(e){ _toast('업로드 실패 · Upload failed '+(e&&e.message||'')); });
  };
  inp.click();
};
window.exSetView=function(v){ _view=v; _curId=null; renderExportApp(); };
window.exBomQ=function(v){ _bomQ=v; if(_view==='bomlib' && !_curId){ renderExportApp(); var inp=document.querySelector('#exportBody input[placeholder^="모델 검색"]'); if(inp){ inp.focus(); try{inp.setSelectionRange(v.length,v.length);}catch(e){} } } };

window.exBomZip=function(id){
  var p=_projects().find(function(x){return x.id===id;}); if(!p) return;
  var picked=[]; _bomModels(p).forEach(function(m){ (m.files||[]).forEach(function(f){ if(_bomSel[f.id]) picked.push({url:f.url,name:f.name,folder:m.model}); }); });
  _zipPicked(picked, (p.no||'export')+'_BOM.zip');
};
window.exBomLibZip=function(){
  var picked=[]; _allBomByModel().forEach(function(m){ m.files.forEach(function(f){ if(_bomSel[f.id]) picked.push({url:f.url,name:f.name,folder:m.model}); }); });
  _zipPicked(picked, 'BOM_library.zip');
};
function _zipPicked(picked, name){
  if(!picked.length){ _toast('파일을 선택하세요 · Select files first'); return; }
  _toast('ZIP 준비 중 · Preparing ZIP… '+picked.length);
  _loadJSZip().then(function(JSZip){
    var zip=new JSZip();
    return Promise.all(picked.map(function(pk){
      return fetch(pk.url).then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status); return r.blob(); }).then(function(bl){
        var folder=String(pk.folder||'model').replace(/[\/\\:*?"<>|]/g,'_').trim()||'model';
        zip.file(folder+'/'+pk.name, bl);
      });
    })).then(function(){ return zip.generateAsync({type:'blob'}); }).then(function(blob){
      var a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name;
      document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); },1000);
      _toast('ZIP 다운로드 · '+picked.length+' files');
    });
  }).catch(function(e){
    _toast('ZIP 실패 → 개별 다운로드로 전환 · fallback ('+(e&&e.message||'')+')');
    picked.forEach(function(pk,i){ setTimeout(function(){ var a=document.createElement('a'); a.href=pk.url; a.download=pk.name; a.target='_blank'; document.body.appendChild(a); a.click(); a.remove(); }, i*500); });
  });
}
function _uploadStorage(file, projId, taskId){
  var BUCKET='inics-approval.firebasestorage.app';
  var safe=(file.name||'file').replace(/[\/\\:*?"<>|#\[\]]/g,'_').replace(/\s+/g,'_').slice(0,90);
  var path='export/'+projId+'/'+taskId+'/'+Date.now()+'_'+safe;
  var url='https://firebasestorage.googleapis.com/v0/b/'+BUCKET+'/o?name='+encodeURIComponent(path);
  return fetch(url,{method:'POST',headers:{'Content-Type':file.type||'application/octet-stream'},body:file})
    .then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); })
    .then(function(j){ var token=(j&&j.downloadTokens?String(j.downloadTokens).split(',')[0]:'');
      var view='https://firebasestorage.googleapis.com/v0/b/'+BUCKET+'/o/'+encodeURIComponent(path)+'?alt=media'+(token?('&token='+token):'');
      return {name:file.name, size:file.size, path:path, url:view, type:file.type||'', at:Date.now()}; });
}

/* 진행현황 텍스트(병기) */
window.exCopySummary=function(id){
  var p=_projects().find(function(x){return x.id===id;}); if(!p) return;
  var ov=_overall(p);
  var lines=['[수출 진행현황 · Export Status] '+(p.no||'')+' '+(p.name||''),
    'ETD '+(p.etd?_fmtDate(_addDays(p.etd,0)):'미정 · TBA')+' · 공급사 · Suppliers '+_suppliers(p).join(', '),
    '진행 · Progress '+ov.done+'/'+ov.total+' ('+ov.pct+'%)',''];
  PHASES.forEach(function(ph){ var pr=_phaseProg(p,ph.key);
    lines.push('■ '+ph.ko+' · '+ph.en+' '+pr.done+'/'+pr.total);
    _phaseTasks(ph.key).forEach(function(t){ var done=_isDone(p,t);
      lines.push('  '+(done?'[v]':'[ ]')+' '+t.ko+' · '+t.en+' — '+_fmtDate(_dueOf(p,t))+' ('+_own(t.owner)+')'); });
  });
  _clip(lines.join('\n'),'진행현황 복사 · Status copied');
};

function _clip(txt,msg){
  if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(txt).then(function(){_toast(msg);},function(){_fallbackClip(txt,msg);}); }
  else _fallbackClip(txt,msg);
}
function _fallbackClip(txt,msg){ try{ var ta=document.createElement('textarea'); ta.value=txt; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); _toast(msg); }catch(e){ _toast('복사 실패 · Copy failed'); } }

})();
