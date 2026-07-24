/* ════════════════════════════════════════════════════════════
   INICS · contract.js 계약서 모듈 — index.html에서 분리 (전역 함수 유지)
   47개 함수 자동 추출 · 공용 헬퍼(qNum·fmtN·_money·state·saveState·
   showToast·getAvatar·getBuyerFromDB 등)는 index.html에 남아 전역 참조
   ════════════════════════════════════════════════════════════ */
function triggerContractFile(){document.getElementById('contractAttInput').click();}

function handleContractAtt(e){
  var files=Array.from(e.target.files); var loaded=0;
  files.forEach(function(f){ var reader=new FileReader(); reader.onload=function(ev){
    contractAtts.push({name:f.name, size:fmtSize(f.size), addedAt:nowStr(), data:ev.target.result, type:f.type});
    loaded++; if(loaded===files.length){ renderContractAttList(); showToast(files.length+' 계약서 첨부 · contract file(s)'); }
  }; reader.readAsDataURL(f); });
  e.target.value='';
}

function removeContractAtt(idx){ contractAtts.splice(idx,1); renderContractAttList(); }

function renderContractAttList(){
  var cnt=document.getElementById('contractAttCnt'); if(cnt) cnt.textContent=contractAtts.length;
  var el=document.getElementById('contractAttList'); if(!el) return;
  if(!contractAtts.length){ el.innerHTML='<div class="upload-zone" onclick="triggerContractFile()"><i class="ti ti-file-certificate" style="font-size:22px;display:block;margin-bottom:6px;color:#4338ca"></i><strong style="display:block;margin-bottom:2px;color:var(--text-2)">계약서 · Signed Contract (PDF · Image · Word)</strong><span style="font-size:11px">계약서 모듈 연동 대상 · Linked to Contracts module</span></div>'; return; }
  el.innerHTML=contractAtts.map(function(a,i){
    var isImg=/^data:image\//.test(a.data||'');
    var thumb=isImg?'<img src="'+a.data+'" onclick="viewImageLightbox(this.src)" style="width:30px;height:30px;object-fit:cover;border-radius:4px;border:1px solid var(--border);cursor:zoom-in">':'<i class="ti ti-file-certificate" style="font-size:20px;color:#4338ca"></i>';
    return '<div style="display:flex;align-items:center;gap:8px;border:1px solid var(--border);border-radius:var(--radius);padding:7px 10px;margin-bottom:6px">'+thumb+'<span style="flex:1;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+(a.name||'contract')+'</span><span style="font-size:10px;color:var(--text-3)">'+(a.size||'')+'</span><button class="btn btn-outline" style="font-size:10px;padding:3px 7px;color:var(--danger)" onclick="removeContractAtt('+i+')"><i class="ti ti-x"></i></button></div>';
  }).join('');
}

function getContractTpl(){ var t=state.contractTemplate||{}; var out={}; for(var k in CONTRACT_TPL_DEFAULTS){ out[k]=(t[k]!=null&&t[k]!=='')?t[k]:CONTRACT_TPL_DEFAULTS[k]; } return out; }

function _assignContractSeq(p){
  if(p && p.contractSeq) return p.contractSeq;
  state.contractSeq=(state.contractSeq||0)+1;
  if(p) p.contractSeq=state.contractSeq;
  saveState();
  return state.contractSeq;
}

function _ctNoFor(p){
  var seq=_assignContractSeq(p);
  var yr=(p&&p.contractOpts&&p.contractOpts.date)?String(p.contractOpts.date).slice(0,4):String(new Date().getFullYear());
  return 'HD-'+_pad(seq,3)+'-'+yr+'/INICS-'+_clientCode(p?(p.clientFull||p.client):'');
}

function _normalizeContractNo(p,saved){
  if(!saved || /^HD-\d+-\d{4}$/.test(saved) || saved===('HD-'+(p&&p.id||'')+'-'+(new Date().getFullYear()))) return _ctNoFor(p);
  return saved;
}

function _ctDefaults(p){ var qs=_projQuotesC(p); var _sv=(p&&p.sales&&p.sales.vat!=null&&p.sales.vat!=='')?qNum(p.sales.vat):8; return { contractNo:_ctNoFor(p), date:projTodayISO(), vatRate:_sv, paymentDays:3, deliveryDate:p.targetDate||'', buyerGender:'female', showWarranty:true, quoteId:(qs[0]?qs[0].id:null) }; }
// 계약서 모달 상단 결제 회차 요약 (매출 정산 terms 단일 소스)
function _ctTerms(p){ return (p&&p.sales&&p.sales.terms&&p.sales.terms.rows&&p.sales.terms.rows.length)?p.sales.terms:((typeof _migrateSalesTerms==='function')?_migrateSalesTerms((p&&p.sales)||{}):{count:1,rows:[{pct:100,at:'po',net:0}]}); }
function _ctRenderTermsSummary(p){ var el=document.getElementById('ctTermsSummary'); if(!el) return; var t=_ctTerms(p); var n=Math.max(1,Math.min(3,parseInt(t.count,10)||(t.rows?t.rows.length:1)||1)); var lbl=(typeof termAtLabel==='function')?termAtLabel:function(a){return a;}; var ord=(typeof termOrdinal==='function')?termOrdinal:function(i){return (i+1)+'차';}; el.innerHTML=t.rows.slice(0,n).map(function(r,i){ return '<span style="display:inline-block;margin-right:10px"><b>'+ord(i,'en')+' · '+ord(i,'ko')+'</b> '+(parseFloat(r.pct)||0)+'% · '+lbl(r.at,r.net,'ko')+'</span>'; }).join('')+'<div style="font-size:10px;color:var(--text-3);margin-top:3px">차수·% 수정은 프로젝트 → 매출 정산에서. 계약서·대금지급요청서에 자동 반영됩니다.</div>'; }

// ── 계약서 인라인 회차 편집기 (단일 소스: p.sales.terms) ──
function _ctCurProj(){ return (state.projects||[]).find(function(x){return String(x.id)===String(_contractProjId);}); }
function _ctTermsEnsure(p){
  if(!p) return {count:1,rows:[{pct:100,amt:0,at:'po',net:0,paid:false,paidDate:''}]};
  if(!p.sales) p.sales={};
  var t=p.sales.terms;
  if(!(t&&t.rows&&t.rows.length)){ t=(typeof _migrateSalesTerms==='function')?_migrateSalesTerms(p.sales):{count:1,rows:[{pct:100,amt:0,at:'po',net:0,paid:false,paidDate:''}]}; p.sales.terms=t; }
  t.count=Math.max(1,Math.min(3,parseInt(t.count,10)||t.rows.length||1));
  while(t.rows.length<t.count) t.rows.push({pct:0,amt:0,at:'delivery',net:0,paid:false,paidDate:''});
  if(t.rows.length>t.count) t.rows=t.rows.slice(0,t.count);
  return t;
}
function _ctLinkedTotal(p){
  var o=(typeof _readContractOpts==='function' && document.getElementById('ctVat'))?_readContractOpts():(p.contractOpts||{});
  var qs=_projQuotesC(p); var q=o.quoteId?qs.find(function(x){return x.id===o.quoteId;}):qs[0];
  var sub=(q?(q.lines||[]):[]).reduce(function(s,l){return s+qNum(l.amount);},0);
  return sub*(1+(qNum(o.vatRate)||0)/100);
}
function _ctTermAmts(t,total){
  var n=t.count, acc=0, out=[];
  for(var i=0;i<n;i++){ var r=t.rows[i]||{}; var pct=parseFloat(r.pct)||0; var amt;
    if(i<n-1){ amt=Math.round(total*pct/100); acc+=amt; }
    else { amt=Math.max(0,Math.round(total)-acc); if(total>0) pct=Math.round((amt/total*100)*100)/100; }
    r.amt=amt; if(i===n-1) r.pct=pct;
    out.push({pct:pct,amt:amt,at:r.at||'po',net:parseInt(r.net,10)||0}); }
  return out;
}
function ctRenderTermsEditor(){
  var box=document.getElementById('ctTermsEditor'); if(!box) return;
  var p=_ctCurProj(); if(!p){ box.innerHTML=''; return; }
  var t=_ctTermsEnsure(p); var total=_ctLinkedTotal(p); var amts=_ctTermAmts(t,total);
  var pctSum=0; for(var s=0;s<t.count;s++) pctSum+=amts[s].pct; pctSum=Math.round(pctSum*100)/100;
  var inp='font-size:12px;padding:4px 6px;border:1px solid var(--border);border-radius:var(--radius);font-family:var(--sans)';
  var atOpts=function(sel){ return [['po','PO 발행 시'],['ship','출고 시'],['delivery','납품 후']].map(function(o){return '<option value="'+o[0]+'"'+(sel===o[0]?' selected':'')+'>'+o[1]+'</option>';}).join(''); };
  var netOpts=function(sel){ return [0,7,14].map(function(nn){return '<option value="'+nn+'"'+(((parseInt(sel,10)||0)===nn)?' selected':'')+'>'+(nn===0?'즉시':('+'+nn+'일'))+'</option>';}).join(''); };
  var html='<div style="display:flex;gap:8px;align-items:center;margin-bottom:6px">'
    +'<select onchange="ctTermCount(this.value)" style="'+inp+'">'+[1,2,3].map(function(n){return '<option value="'+n+'"'+(t.count===n?' selected':'')+'>'+n+'차'+(n===1?' (일시불)':'')+'</option>';}).join('')+'</select>'
    +'<span style="font-size:10px;color:var(--text-3)">연결 견적 총액 기준 · 마지막 차수 자동보정</span></div>';
  html+='<div style="display:flex;gap:8px;align-items:stretch">';
  for(var i=0;i<t.count;i++){ var r=t.rows[i]; var a=amts[i]; var last=(i===t.count-1);
    html+='<div style="flex:1;min-width:0;border:1px solid var(--border);border-radius:var(--radius);padding:7px 8px;background:var(--surface-2)">'
      +'<div style="font-weight:700;font-size:12px;margin-bottom:5px">'+(i+1)+'차</div>'
      +'<div style="display:flex;align-items:center;gap:3px;margin-bottom:5px">'
        +(last?'<input type="text" value="'+a.pct+'" readonly title="자동 보정" style="'+inp+';width:100%;text-align:right;background:var(--surface);color:var(--text-2)">':'<input type="text" inputmode="decimal" value="'+a.pct+'" onchange="ctTermField('+i+',&#39;pct&#39;,this.value)" style="'+inp+';width:100%;text-align:right">')
        +'<span style="font-size:11px;color:var(--text-3)">%</span></div>'
      +'<div style="font-size:11px;color:var(--text-2);text-align:right;margin-bottom:5px">'+fmtN(a.amt)+'</div>'
      +'<select onchange="ctTermField('+i+',&#39;at&#39;,this.value)" style="'+inp+';width:100%'+(r.at==='delivery'?';margin-bottom:4px':'')+'">'+atOpts(r.at)+'</select>'
      +(r.at==='delivery'?('<select onchange="ctTermField('+i+',&#39;net&#39;,this.value)" style="'+inp+';width:100%">'+netOpts(r.net)+'</select>'):'')
      +'</div>';
  }
  html+='</div>';
  html+='<div style="font-size:10px;margin-top:6px;color:'+(pctSum===100?'#15803d':'var(--danger)')+'">합계 '+pctSum+'%'+(pctSum!==100?' · <b>100% 아님</b>':'')+' · 입금추적은 프로젝트 → 매출 정산</div>';
  box.innerHTML=html;
}
function _ctTermsSave(){ if(typeof saveState==='function') saveState(); ctRenderTermsEditor(); if(typeof renderContractPreview==='function') renderContractPreview(); }
function ctTermCount(v){ var p=_ctCurProj(); if(!p) return; var t=_ctTermsEnsure(p); var n=Math.max(1,Math.min(3,parseInt(v,10)||1)); if(n>t.count){ while(t.rows.length<n) t.rows.push({pct:0,amt:0,at:'delivery',net:0,paid:false,paidDate:''}); } else { t.rows=t.rows.slice(0,n); } t.count=n; _ctTermsSave(); }
function ctTermField(i,f,v){ var p=_ctCurProj(); if(!p) return; var t=_ctTermsEnsure(p); var r=t.rows[i]; if(!r) return; if(f==='pct'){ r.pct=Math.max(0,Math.min(100,parseFloat(String(v).replace(/,/g,''))||0)); } else if(f==='at'){ r.at=v; if(v!=='delivery') r.net=0; } else if(f==='net'){ r.net=parseInt(v,10)||0; } _ctTermsSave(); }

function openContractModal(projId){
  var p=(state.projects||[]).find(function(x){return String(x.id)===String(projId);});
  if(!p){ showToast('프로젝트를 먼저 저장한 뒤 생성하세요 · Save the project first, then create'); return; }
  _contractProjId=projId;
  _assignContractSeq(p);
  var o=p.contractOpts||_ctDefaults(p);
  o.contractNo=_normalizeContractNo(p,o.contractNo);
  document.getElementById('ctNo').value=o.contractNo||'';
  document.getElementById('ctDate').value=o.date||projTodayISO();
  document.getElementById('ctVat').value=(o.vatRate==null?8:o.vatRate);
  { var _sw=document.getElementById('ctShowWarranty'); if(_sw) _sw.checked=(o.showWarranty!==false); }
  ctRenderTermsEditor();
  { var _wy=document.getElementById('ctWarranty'); if(_wy) _wy.value=(o.warrantyYears!=null?o.warrantyYears:''); }
  document.getElementById('ctDeliveryDate').value=o.deliveryDate||p.targetDate||'';
  var qs=_projQuotesC(p);
  document.getElementById('ctQuote').innerHTML = qs.length
    ? qs.map(function(q){ var tot=(q.lines||[]).reduce(function(s,l){return s+qNum(l.amount);},0); return '<option value="'+q.id+'"'+(String(o.quoteId)===String(q.id)?' selected':'')+'>'+(q.quoteNo||'견적')+' · '+fmtN(tot)+' · '+(q.lines||[]).length+'품목</option>'; }).join('')
    : '<option value="">연결된 견적 없음 — 견적서에서 먼저 작성</option>';
  { var _cc=document.getElementById('ctCurrency'); if(_cc){ var _q0=o.quoteId?qs.find(function(x){return x.id===o.quoteId;}):qs[0]; _cc.value=o.currency||(_q0&&_q0.currency)||'VND'; } }
  var _b=getBuyerFromDB(p.client);
  document.getElementById('ctBuyerRep').value=o.buyerRep||_b.rep||'';
  document.getElementById('ctBuyerGender').value=o.buyerGender||_b.gender||'female';
  document.getElementById('ctBuyerTitle').value=o.buyerTitle||_b.title||'';
  document.getElementById('ctBuyerAddr').value=o.buyerAddr||_b.addr||p.buyerAddr||p.location||'';
  document.getElementById('ctBuyerTax').value=o.buyerTax||_b.tax||p.buyerTax||'';
  document.getElementById('ctDeliveryPlace').innerHTML = p.deliveryPlace ? '<b>'+p.deliveryPlace+'</b>' : '<span style="color:#b91c1c">미입력 — 프로젝트 PO 단계의 "납품 장소"에 입력</span>';
  document.getElementById('contractModal').style.display='block';
  _ctEditMode=false;
  var _cbox=document.getElementById('contractPreview'); if(_cbox){ _cbox.removeAttribute('contenteditable'); _cbox.style.outline='none'; _cbox.style.background='#e5e7eb'; }
  renderContractScans();
  updateContractConfirmBtn();
  renderContractPreview();
}

function updateContractConfirmBtn(){
  var btn=document.getElementById('ctConfirmBtn'); if(!btn) return;
  var p=(state.projects||[]).find(function(x){return String(x.id)===String(_contractProjId);});
  if(p&&p.contractConfirmed){ btn.className='btn btn-outline'; btn.innerHTML='<i class="ti ti-circle-check-filled"></i> 확정됨 · Confirmed (취소)'; btn.style.color='#15803d'; }
  else { btn.className='btn btn-dark'; btn.innerHTML='<i class="ti ti-circle-check"></i> 계약 확정 · Confirm'; btn.style.color=''; }
}

function toggleContractConfirm(){
  var p=(state.projects||[]).find(function(x){return String(x.id)===String(_contractProjId);}); if(!p){ return; }
  if(p.contractConfirmed){
    if(!confirm('계약 확정을 취소할까요? 계약서 모듈에서 제외됩니다.\nUn-confirm this contract?')) return;
    p.contractConfirmed=false; p.contractConfirmedAt=''; p.contractConfirmedBy='';
    saveState(); updateContractConfirmBtn(); showToast('확정 취소 · Un-confirmed');
  } else {
    // 확정 전 현재 설정 저장
    var o=_readContractOpts();
    if(!o.contractNo){ showToast('계약번호가 필요합니다 · Contract no. required'); return; }
    p.contractOpts=o; saveBuyerToDB(p.client,_buyerOf(o));
    var u=(typeof cardCurrentUser==='function'?cardCurrentUser():null);
    p.contractConfirmed=true; p.contractConfirmedAt=nowStr(); p.contractConfirmedBy=(u?u.name:'');
    saveState(); updateContractConfirmBtn();
    showToast('계약 확정 · 계약서 모듈에 등록됨 · Confirmed');
    if(typeof contractAppOpen!=='undefined' && contractAppOpen && typeof renderContractApp==='function') renderContractApp();
  }
}

function renderContractScans(){
  var box=document.getElementById('contractScansBar'); if(!box) return;
  var p=(state.projects||[]).find(function(x){return String(x.id)===String(_contractProjId);});
  var scans=(p&&p.contractScans)||[];
  var head='<div style="font-size:10px;color:var(--text-3);font-weight:700;margin-bottom:4px">스캔본 · Signed scans ('+scans.length+')</div>';
  if(!scans.length){ box.innerHTML=head+'<div style="font-size:11px;color:var(--text-3)">업로드된 스캔본 없음 — 「스캔본 업로드」로 서명·날인본을 첨부하세요 · No scan uploaded.</div>'; return; }
  box.innerHTML=head+'<div style="display:flex;gap:6px;flex-wrap:wrap">'+scans.map(function(s,i){
    var isImg=/^data:image\//.test(s.data||'');
    var thumb=isImg?'<img src="'+s.data+'" style="width:34px;height:34px;object-fit:cover;border-radius:4px;border:1px solid var(--border)">':'<i class="ti ti-file-type-pdf" style="font-size:22px;color:#b91c1c"></i>';
    return '<div style="display:flex;align-items:center;gap:6px;border:1px solid var(--border);border-radius:6px;padding:4px 8px;background:var(--surface)">'
      +'<a href="javascript:void(0)" onclick="viewContractScan('+i+')" title="열기 · Open" style="display:flex;align-items:center;gap:6px;text-decoration:none;color:var(--text)">'+thumb+'<span style="font-size:11px;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+(s.name||('scan-'+(i+1)))+'</span></a>'
      +'<a href="javascript:void(0)" onclick="deleteContractScan('+i+')" title="삭제 · Delete" style="color:var(--danger);text-decoration:none"><i class="ti ti-x"></i></a></div>';
  }).join('')+'</div>';
}

function handleContractScan(files){
  var p=(state.projects||[]).find(function(x){return String(x.id)===String(_contractProjId);}); if(!p){ showToast('계약을 먼저 여세요 · Open a contract first'); return; }
  if(!files||!files.length) return;
  if(!p.contractScans) p.contractScans=[];
  var u=(typeof cardCurrentUser==='function'?cardCurrentUser():null);
  var arr=Array.prototype.slice.call(files), done=0;
  arr.forEach(function(f){
    var r=new FileReader();
    r.onload=function(){ p.contractScans.push({name:f.name, type:f.type, data:r.result, uploadedAt:nowStr(), uploadedBy:(u?u.name:'')}); done++; if(done===arr.length){ saveState(); renderContractScans(); showToast('스캔본 '+arr.length+'개 업로드 · '+arr.length+' uploaded'); } };
    r.readAsDataURL(f);
  });
}

function viewContractScan(idx){
  var p=(state.projects||[]).find(function(x){return String(x.id)===String(_contractProjId);}); if(!p||!p.contractScans) return;
  var s=p.contractScans[idx]; if(!s) return; viewImageLightbox(s.data);
}

function deleteContractScan(idx){
  var p=(state.projects||[]).find(function(x){return String(x.id)===String(_contractProjId);}); if(!p||!p.contractScans) return;
  if(!confirm('이 스캔본을 삭제할까요? · Delete this scan?')) return;
  p.contractScans.splice(idx,1); saveState(); renderContractScans();
}

function showContractApp(){
  var hub=document.getElementById('hubPage'); if(hub) hub.style.display='none';
  var app=document.getElementById('contractApp'); if(app) app.style.display='block';
  contractAppOpen=true;
  var u=(typeof cardCurrentUser==='function'?cardCurrentUser():null);
  var nm=document.getElementById('contractUserName'); if(nm) nm.textContent=u?u.name:'';
  renderContractApp();
}

function closeContractApp(){ var app=document.getElementById('contractApp'); if(app) app.style.display='none'; contractAppOpen=false; if(typeof showHub==='function') showHub(); }

function _contractTotal(p){
  var o=p.contractOpts||{}; var qs=_projQuotesC(p); var q=o.quoteId?qs.find(function(x){return x.id===o.quoteId;}):qs[0];
  var sub=(q?(q.lines||[]):[]).reduce(function(s,l){return s+qNum(l.amount);},0);
  return {total:sub*(1+(qNum(o.vatRate)||0)/100), cur:(q?(q.currency||'VND'):'VND')};
}

function openContractFromApp(projId){ openContractModal(projId); }

function renderContractApp(){
  var box=document.getElementById('contractList'); if(!box) return;
  var q=((document.getElementById('contractSearch')||{}).value||'').trim().toLowerCase();
  var projs=(state.projects||[]).filter(function(p){return p&&p.contractOpts;});
  var cfilter=((document.getElementById('contractFilter')||{}).value)||'all';
  if(cfilter==='confirmed') projs=projs.filter(function(p){return p.contractConfirmed;});
  else if(cfilter==='draft') projs=projs.filter(function(p){return !p.contractConfirmed;});
  var sdocs=(state.docs||[]).filter(function(d){return /계약체결/.test(d.type||'');});
  function pHay(p){ var o=p.contractOpts||{}; return [o.contractNo,p.clientFull,p.client,p.projName,p.title,o.date].join(' ').toLowerCase(); }
  function dHay(d){ return [d.docNo,d.title,d.type,d.dept].join(' ').toLowerCase(); }
  if(q){ var ts=q.split(/\s+/);
    projs=projs.filter(function(p){ return ts.every(function(t){return pHay(p).indexOf(t)>=0;}); });
    sdocs=sdocs.filter(function(d){ return ts.every(function(t){return dHay(d).indexOf(t)>=0;}); });
  }
  projs.sort(function(a,b){ return String((b.contractOpts||{}).date||'').localeCompare(String((a.contractOpts||{}).date||'')); });
  var sEl=document.getElementById('contractSummary');
  if(sEl){ var scanCount=projs.reduce(function(s,p){return s+((p.contractScans||[]).length);},0);
    sEl.innerHTML='<div style="display:flex;gap:8px;flex-wrap:wrap">'
      +_reconKpi('계약 · Contracts',projs.length,'#4338ca')+_reconKpi('스캔본 · Scans',scanCount,'#15803d')+_reconKpi('계약체결 결재 · Approvals',sdocs.length,'#92400e')+'</div>';
  }
  var html='';
  var th='padding:8px 9px;text-align:left;font-size:11px;font-weight:700;color:var(--text-3);border-bottom:2px solid var(--border);white-space:nowrap;background:var(--surface-2)';
  var td='padding:7px 9px;border-bottom:1px solid var(--border);font-size:12px;vertical-align:middle';
  // 1) 프로젝트 기반 계약 — 테이블
  html+='<div style="font-size:11px;font-weight:700;color:var(--text-2);text-transform:uppercase;letter-spacing:.08em;margin:6px 0 8px">계약 · Contracts <span style="font-weight:400;color:var(--text-3);text-transform:none">(확정·미확정 모두 · use filter)</span></div>';
  if(!projs.length){ html+='<div style="font-size:12px;color:var(--text-3);margin-bottom:16px">표시할 계약 없음 — 계약서에서 「설정 저장」 또는 「계약 확정」 시 등록됩니다 · No contracts.</div>'; }
  else {
    var prows=projs.map(function(p){
      var o=p.contractOpts||{}; var tt=_contractTotal(p);
      var prs=(state.paymentRequests||[]).filter(function(r){return String(r.projId)===String(p.id);});
      var prPaid=prs.filter(function(r){return r.paid;}).length;
      var prCell=prs.length?('<span title="입금 '+prPaid+' / 발행 '+prs.length+'" style="color:'+(prPaid===prs.length?'#15803d':(prPaid>0?'#b45309':'var(--text-2)'))+'">'+prPaid+' / '+prs.length+'</span>'):'<span style="color:var(--text-3)">0</span>';
      var statusBadge=p.contractConfirmed?'<span class="badge b-done" style="font-size:10px"><i class="ti ti-circle-check"></i> 확정 · Confirmed</span>':'<span class="badge b-draft" style="font-size:10px">미확정·Draft</span>';
      var scans=(p.contractScans||[]);
      var scanCell=scans.length?scans.map(function(s,i){
        var isImg=/^data:image\//.test(s.data||'');
        var thumb=isImg?'<img src="'+s.data+'" style="width:24px;height:24px;object-fit:cover;border-radius:3px;border:1px solid var(--border);vertical-align:middle">':'<i class="ti ti-file-type-pdf" style="font-size:16px;color:#b91c1c;vertical-align:middle"></i>';
        return '<a href="javascript:void(0)" onclick="viewProjScan('+p.id+','+i+')" title="'+(s.name||'').replace(/"/g,'&quot;')+'" style="display:inline-block;margin-right:3px">'+thumb+'</a>';
      }).join(''):'<span style="font-size:11px;color:#b91c1c">없음·none</span>';
      return '<tr>'
        +'<td style="'+td+'">'+statusBadge+'</td>'
        +'<td style="'+td+';font-family:var(--mono);font-weight:700;color:#4338ca;white-space:nowrap">'+(o.contractNo||'—')+'</td>'
        +'<td style="'+td+';font-weight:600">'+(p.clientFull||p.client||'—')+(p.projName?'<div style="font-size:10px;color:#b45309;font-weight:600">'+String(p.projName).replace(/</g,'&lt;')+'</div>':'')+(p.title?'<div style="font-size:10px;color:var(--text-3);font-weight:400">'+p.title+'</div>':'')+'</td>'
        +'<td style="'+td+';color:var(--text-3);white-space:nowrap">'+(o.date||'')+'</td>'
        +'<td style="'+td+';text-align:right;font-weight:700;white-space:nowrap">'+tt.cur+' '+fmtN(Math.round(tt.total))+'</td>'
        +'<td style="'+td+';white-space:nowrap;color:var(--text-2);font-size:11px">'+(function(){var _t=_ctTerms(p);var _n=Math.max(1,Math.min(3,parseInt(_t.count,10)||(_t.rows?_t.rows.length:1)||1));return _t.rows.slice(0,_n).map(function(r,i){return 'P'+(i+1)+'·'+(i+1)+'차 '+(parseFloat(r.pct)||0)+'%';}).join(' / ');})()+'</td>'
        +'<td style="'+td+';white-space:nowrap">'+scanCell+'</td>'
        +'<td style="'+td+';text-align:center;white-space:nowrap" title="대금 입금 / 발행 · Payment / Issue">'+prCell+'</td>'
        +'<td style="'+td+';text-align:right;white-space:nowrap"><button class="btn btn-outline" style="font-size:10px;padding:3px 8px" onclick="openContractFromApp('+p.id+')"><i class="ti ti-edit"></i> 열기 · Open</button> <button class="btn btn-outline" style="font-size:10px;padding:3px 8px" onclick="_contractProjId='+p.id+';document.getElementById(\'contractScanInput\').click()"><i class="ti ti-paperclip"></i> 스캔 · Scan</button></td>'
      +'</tr>';
    }).join('');
    html+='<div style="overflow-x:auto;border:1px solid var(--border);border-radius:var(--radius);margin-bottom:6px"><table style="width:100%;border-collapse:collapse;min-width:980px">'
      +'<thead><tr><th style="'+th+'">상태 · Status</th><th style="'+th+'">계약번호 · No.</th><th style="'+th+'">고객 · Client</th><th style="'+th+'">계약일 · Date</th><th style="'+th+';text-align:right">금액 · Amount</th><th style="'+th+'">결제 회차 · Installments</th><th style="'+th+'">스캔본 · Scan</th><th style="'+th+';text-align:center">입금·PR</th><th style="'+th+';text-align:right">작업 · Action</th></tr></thead>'
      +'<tbody>'+prows+'</tbody></table></div>';
  }
  // 2) 전자결재 계약체결 문서 — 테이블
  html+='<div style="font-size:11px;font-weight:700;color:var(--text-2);text-transform:uppercase;letter-spacing:.08em;margin:18px 0 8px">계약체결 결재 · Contract-signing approvals</div>';
  if(!sdocs.length){ html+='<div style="font-size:12px;color:var(--text-3)">전자결재에서 「계약」 또는 「계약체결」 유형으로 기안하면 여기로 모입니다 · File a 계약 approval to collect here.</div>'; }
  else {
    var drows=sdocs.slice().reverse().map(function(d){
      var _attTypes=[['contract',d.contractAtts||[]],['draft',d.draftAtts||[]],['pay',d.payAtts||[]]];
      var _attParts=[];
      _attTypes.forEach(function(pair){ var typ=pair[0], arr=pair[1]; arr.forEach(function(a,i){
        var nm=(a.name||'file').replace(/"/g,'&quot;');
        var isImg=/\.(png|jpe?g|gif|webp|bmp)$/i.test(a.name||'');
        var icon=isImg?'ti-photo':(/\.pdf$/i.test(a.name||'')?'ti-file-type-pdf':'ti-file');
        _attParts.push('<a href="javascript:void(0)" onclick="previewAtt('+d.id+',\''+typ+'\','+i+')" title="'+nm+' — 미리보기·다운로드 · Preview/Download" style="margin-right:5px;text-decoration:none"><i class="ti '+icon+'" style="font-size:17px;color:#4338ca;vertical-align:middle"></i></a>');
      }); });
      var attCell=_attParts.length?_attParts.join(''):'<span style="font-size:11px;color:#b91c1c">없음·none</span>';
      return '<tr>'
        +'<td style="'+td+';font-family:var(--mono);font-size:11px;color:var(--text-3);white-space:nowrap">'+(d.docNo||'—')+'</td>'
        +'<td style="'+td+';font-weight:600"><a href="javascript:void(0)" onclick="openDocViewer('+d.id+')" style="color:#4338ca;text-decoration:none;cursor:pointer" title="기안 문서 열기 · View approval draft">'+(d.title||'—')+'</a></td>'
        +'<td style="'+td+'"><span class="badge b-'+(d.dept==='FURNITURE'?'furniture':'sourcing')+'" style="font-size:10px">'+(d.dept||'')+'</span></td>'
        +'<td style="'+td+';color:var(--text-3);white-space:nowrap">'+(d.createdAt||'')+'</td>'
        +'<td style="'+td+';white-space:nowrap">'+attCell+'</td>'
        +'<td style="'+td+';color:var(--text-2);font-size:11px;white-space:nowrap">'+(typeof sLabel==='function'?sLabel(d.status):d.status)+'</td>'
      +'</tr>';
    }).join('');
    html+='<div style="overflow-x:auto;border:1px solid var(--border);border-radius:var(--radius)"><table style="width:100%;border-collapse:collapse;min-width:720px">'
      +'<thead><tr><th style="'+th+'">문서번호 · No.</th><th style="'+th+'">제목 · Title</th><th style="'+th+'">부서 · Dept</th><th style="'+th+'">기안일 · Draft Date</th><th style="'+th+'">첨부 · Files</th><th style="'+th+'">상태 · Status</th></tr></thead>'
      +'<tbody>'+drows+'</tbody></table></div>';
  }
  box.innerHTML=html;
}

function closeContractModal(){ if(_ctEditMode){ if(!confirm('편집 모드입니다. 저장하지 않은 편집 내용이 사라집니다.\n닫으시겠습니까?'))return; _ctEditMode=false; var b=document.getElementById('contractPreview'); if(b){ b.removeAttribute('contenteditable'); b.style.outline='none'; } } document.getElementById('contractModal').style.display='none'; }

function _readContractOpts(){
  return {
    contractNo:(document.getElementById('ctNo').value||'').trim(),
    date:document.getElementById('ctDate').value||projTodayISO(),
    vatRate:qNum(document.getElementById('ctVat').value)||0,
    showWarranty:!!((document.getElementById('ctShowWarranty')||{}).checked),
    paymentDays:((document.getElementById('ctPayDays')||{}).value||'').trim(),
    warrantyYears:((document.getElementById('ctWarranty')||{}).value||'').trim(),
    currency:((document.getElementById('ctCurrency')||{}).value||'').trim(),
    deliveryDate:document.getElementById('ctDeliveryDate').value||'',
    quoteId:qNum(document.getElementById('ctQuote').value)||null,
    buyerRep:(document.getElementById('ctBuyerRep').value||'').trim(),
    buyerGender:(document.getElementById('ctBuyerGender')||{}).value||'female',
    buyerTitle:(document.getElementById('ctBuyerTitle').value||'').trim(),
    buyerAddr:(document.getElementById('ctBuyerAddr').value||'').trim(),
    buyerTax:(document.getElementById('ctBuyerTax').value||'').trim()
  };
}

function _buyerOf(o){ return {rep:o.buyerRep,gender:o.buyerGender,addr:o.buyerAddr,tax:o.buyerTax,title:o.buyerTitle,auth:o.buyerAuth}; }

function _ctHasCustom(p){ return !!(p && p.contractCustomHtml && String(p.contractCustomHtml).trim()); }

function renderContractPreview(){
  if(_ctEditMode) return; // 편집 중에는 자동 재생성으로 편집 내용을 덮어쓰지 않음
  var p=(state.projects||[]).find(function(x){return String(x.id)===String(_contractProjId);}); if(!p)return;
  var box=document.getElementById('contractPreview'); if(!box)return;
  if(_ctHasCustom(p)){
    box.innerHTML='<div style="max-width:754px;margin:0 auto 10px;padding:8px 11px;background:#eef2ff;border:1px solid #c7d2fe;border-radius:6px;font-size:11px;color:#3730a3;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">'
      +'<span><i class="ti ti-edit"></i> <b>사용자 편집본</b> · Custom-edited — 자동 필드/템플릿·언어 전환이 적용되지 않습니다. 인쇄·PDF에는 이 편집본이 출력됩니다.</span>'
      +'<span style="display:flex;gap:6px"><button onclick="toggleContractEdit()" style="font-size:10px;padding:3px 9px;border:1px solid #4338ca;background:#4338ca;color:#fff;border-radius:4px;cursor:pointer;font-family:var(--sans)"><i class="ti ti-edit"></i> 계속 편집</button>'
      +'<button onclick="resetContractCustom()" style="font-size:10px;padding:3px 9px;border:1px solid #b45309;background:#fff;color:#b45309;border-radius:4px;cursor:pointer;font-family:var(--sans)"><i class="ti ti-refresh"></i> 자동 생성 복원</button></span>'
      +'</div><div style="max-width:754px;margin:0 auto;box-shadow:0 0 0 1px #e5e7eb">'+p.contractCustomHtml+'</div>';
    box.style.zoom=_ctPrevZoom/100;
    updateContractEditUI();
    return;
  }
  box.innerHTML=buildContractHtml(p,_readContractOpts(),true,null,null,_ctPrevLang);
  box.style.zoom=_ctPrevZoom/100;
  updateContractEditUI();
}

function updateContractEditUI(){
  var p=(state.projects||[]).find(function(x){return String(x.id)===String(_contractProjId);});
  var editBtn=document.getElementById('ctEditBtn'), cancelBtn=document.getElementById('ctEditCancelBtn'), resetBtn=document.getElementById('ctEditResetBtn');
  if(editBtn){
    if(_ctEditMode){ editBtn.className='btn btn-dark'; editBtn.style.borderColor=''; editBtn.style.color=''; editBtn.innerHTML='<i class="ti ti-device-floppy"></i> 편집 저장 · Save Edits'; }
    else { editBtn.className='btn btn-outline'; editBtn.style.borderColor='#4338ca'; editBtn.style.color='#4338ca'; editBtn.innerHTML='<i class="ti ti-edit"></i> 전체 편집 · Edit All'; }
  }
  if(cancelBtn) cancelBtn.style.display=_ctEditMode?'':'none';
  if(resetBtn) resetBtn.style.display=(!_ctEditMode && _ctHasCustom(p))?'':'none';
}

function toggleContractEdit(){
  var p=(state.projects||[]).find(function(x){return String(x.id)===String(_contractProjId);});
  if(!p){ showToast('계약을 먼저 여세요 · Open a contract first'); return; }
  var box=document.getElementById('contractPreview'); if(!box)return;
  if(!_ctEditMode){
    // 편집 모드 진입 → 실제 출력본(형광펜·한국어 참고 없이)을 그대로 편집
    var o=_readContractOpts();
    box.innerHTML='<div style="max-width:754px;margin:0 auto">'+(_ctHasCustom(p)?p.contractCustomHtml:buildContractHtml(p,o,false))+'</div>';
    box.setAttribute('contenteditable','true');
    box.style.outline='2px solid #4338ca'; box.style.outlineOffset='3px'; box.style.background='#eef2ff';
    box.style.zoom=_ctPrevZoom/100;
    _ctEditMode=true;
    updateContractEditUI();
    setTimeout(function(){ box.focus(); },30);
    showToast('전체 편집 모드 — 계약서 어느 부분이든 클릭해서 수정하세요. 끝나면 "편집 저장"');
  } else {
    // 편집 저장
    box.removeAttribute('contenteditable');
    box.style.outline='none'; box.style.background='#e5e7eb';
    var inner=box.querySelector('div'); // 편집 래퍼
    p.contractCustomHtml=inner?inner.innerHTML:box.innerHTML;
    p.contractCustomAt=Date.now();
    _ctEditMode=false;
    saveState();
    if(typeof contractAppOpen!=='undefined'&&contractAppOpen&&typeof renderContractApp==='function')renderContractApp();
    renderContractPreview();
    showToast('편집 저장됨 · 인쇄·PDF에 편집본이 반영됩니다');
  }
}

function cancelContractEdit(){
  if(!_ctEditMode)return;
  _ctEditMode=false;
  var box=document.getElementById('contractPreview');
  if(box){ box.removeAttribute('contenteditable'); box.style.outline='none'; box.style.background='#e5e7eb'; }
  renderContractPreview();
  showToast('편집 취소 · 변경 사항은 저장되지 않았습니다');
}

function resetContractCustom(){
  var p=(state.projects||[]).find(function(x){return String(x.id)===String(_contractProjId);}); if(!p)return;
  if(!confirm('사용자 편집본을 삭제하고 자동 생성 계약서로 되돌립니다.\n계속하시겠습니까?'))return;
  delete p.contractCustomHtml; delete p.contractCustomAt;
  _ctEditMode=false;
  var box=document.getElementById('contractPreview'); if(box){ box.removeAttribute('contenteditable'); box.style.outline='none'; box.style.background='#e5e7eb'; }
  saveState();
  if(typeof contractAppOpen!=='undefined'&&contractAppOpen&&typeof renderContractApp==='function')renderContractApp();
  renderContractPreview();
  showToast('자동 생성 계약서로 복원됨');
}

function setContractPrevLang(l){ _ctPrevLang=l;
  var a=document.getElementById('ctLangVnen'), b=document.getElementById('ctLangKo');
  if(a){ a.style.background=(l==='vnen')?'var(--text)':'var(--surface)'; a.style.color=(l==='vnen')?'#fff':'var(--text-2)'; }
  if(b){ b.style.background=(l==='ko')?'var(--text)':'var(--surface)'; b.style.color=(l==='ko')?'#fff':'var(--text-2)'; }
  renderContractPreview();
}

function ctPrevZoom(d){ _ctPrevZoom=Math.max(50,Math.min(220,_ctPrevZoom+d)); var lbl=document.getElementById('ctPrevZoomLabel'); if(lbl)lbl.textContent=_ctPrevZoom+'%'; var box=document.getElementById('contractPreview'); if(box)box.style.zoom=_ctPrevZoom/100; }

function ctSyncDeposit(){ var dEl=document.getElementById('ctDeposit'), bEl=document.getElementById('ctBalance'); if(!dEl||!bEl) return; if(dEl.value.trim()===''){ bEl.value=''; renderContractPreview(); return; } var d=qNum(dEl.value); if(d>100){ d=100; dEl.value=100; } else if(d<0){ d=0; dEl.value=0; } bEl.value=100-d; renderContractPreview(); }

function ctSyncBalance(){ var dEl=document.getElementById('ctDeposit'), bEl=document.getElementById('ctBalance'); if(!dEl||!bEl) return; if(bEl.value.trim()===''){ dEl.value=''; renderContractPreview(); return; } var b=qNum(bEl.value); if(b>100){ b=100; bEl.value=100; } else if(b<0){ b=0; bEl.value=0; } dEl.value=100-b; renderContractPreview(); }

function saveContractOpts(){ var p=(state.projects||[]).find(function(x){return String(x.id)===String(_contractProjId);}); if(!p)return; var o=_readContractOpts(); p.contractOpts=o; saveBuyerToDB(p.client,_buyerOf(o)); saveState(); if(typeof updateContractConfirmBtn==='function')updateContractConfirmBtn(); if(typeof contractAppOpen!=='undefined'&&contractAppOpen&&typeof renderContractApp==='function')renderContractApp(); showToast('계약 설정 저장 · 미확정 상태로 계약서 모듈에 표시'); }

async function downloadContractPDF(){
  if(typeof html2canvas==='undefined' || !window.jspdf){ showToast('PDF 모듈 로드 실패(네트워크 확인)'); return; }
  var p=(state.projects||[]).find(function(x){return String(x.id)===String(_contractProjId);}); if(!p)return;
  var o=_readContractOpts(); saveBuyerToDB(p.client,_buyerOf(o)); saveState();
  try{ var _qs=_projQuotesC(p); var _q=o.quoteId?_qs.find(function(x){return x.id===o.quoteId;}):_qs[0]; if(typeof _quoteResolveImgs==='function') await _quoteResolveImgs(_q); }catch(_){}
  var wrap=document.createElement('div'); wrap.style.cssText='position:fixed;left:-9999px;top:0;width:794px;background:#fff';
  wrap.innerHTML=_ctHasCustom(p)?p.contractCustomHtml:buildContractHtml(p,o,false); document.body.appendChild(wrap);
  showToast('PDF 생성 중...');
  try{ if(document.fonts&&document.fonts.load){ await Promise.all([document.fonts.load('400 12px "Be Vietnam Pro"'),document.fonts.load('700 16px "Be Vietnam Pro"')]); await document.fonts.ready; } }catch(_){}
  html2canvas(wrap,{scale:2,backgroundColor:'#ffffff',useCORS:true}).then(function(canvas){
    var pdf=new window.jspdf.jsPDF('p','mm','a4');
    var W=wrap.offsetWidth||794;
    var scale=canvas.width/W;                  // css px -> canvas px
    var mmPerCss=210/W;                         // 이미지 폭 = 210mm
    var topMm=12, botMm=10, usableMm=297-topMm-botMm;    // 페이지당 본문 영역(mm) — 헤더 상단 여백 확대
    var usableCss=usableMm/mmPerCss;
    var Hcss=canvas.height/scale;               // 전체 높이(css px)
    // 안전 절단 지점: 각 블록(.ct-blk)의 상단 = 블록 사이 여백 → 글자가 안 끊김
    var wrapTop=wrap.getBoundingClientRect().top;
    var bnds=[], forced=[], softs=[];
    Array.prototype.forEach.call(wrap.querySelectorAll('.ct-blk'),function(el){
      var t=el.getBoundingClientRect().top-wrapTop;
      if(t>0.5){ bnds.push(t); if(el.classList&&el.classList.contains('ct-page')) forced.push(t); }
    });
    Array.prototype.forEach.call(wrap.querySelectorAll('.ct-soft'),function(el){
      var t=el.getBoundingClientRect().top-wrapTop; if(t>0.5) softs.push(t);
    });
    // 조항 박스(.ct-arts) 위치 측정 — 페이지마다 박스를 닫고 새로 그리기 위함
    var _wrc=wrap.getBoundingClientRect();
    var _artEl=wrap.querySelector('.ct-arts'), _artT=null,_artB=null,_artL=0,_artW=0;
    if(_artEl){ var _ar=_artEl.getBoundingClientRect(); _artT=_ar.top-_wrc.top; _artB=_artT+_ar.height; _artL=_ar.left-_wrc.left; _artW=_ar.width; }
    // 조항: 각 행의 실제 텍스트 줄 경계에 soft 컷 지점 생성 → 연속 흐름 + 줄 잘림 없이 페이지 채움
    if(_artEl){ var _rows=_artEl.querySelectorAll('tr'); for(var _ri=0;_ri<_rows.length;_ri++){ var _tr=_rows[_ri]; var _txt=_tr.querySelector('td>div:last-child')||_tr.querySelector('td'); if(!_txt) continue; var _tt=_txt.getBoundingClientRect().top-_wrc.top; var _rr=_tr.getBoundingClientRect(); var _rbot=(_rr.top-_wrc.top)+_rr.height; var _lh=parseFloat(getComputedStyle(_txt).lineHeight)||19.2; for(var _ly=_tt+_lh; _ly<_rbot-2; _ly+=_lh){ softs.push(_ly); } softs.push(_rbot); } }
    bnds.push(Hcss);
    bnds=bnds.filter(function(v,i,a){return a.indexOf(v)===i;}).sort(function(a,b){return a-b;});
    softs=softs.filter(function(v,i,a){return a.indexOf(v)===i;}).sort(function(a,b){return a-b;});
    var start=0, first=true, guard=0;
    while(start<Hcss-1 && guard++<400){
      var limit=start+usableCss;
      var cut=null;                                   // 1순위: 조항/섹션 경계(.ct-blk)
      for(var i=0;i<bnds.length;i++){ if(bnds[i]>start+1 && bnds[i]<=limit+0.5) cut=bnds[i]; }
      var fc=null;                                    // 강제 개행(부록): 범위 안이면 거기서 끊어 다음 페이지로
      for(var j=0;j<forced.length;j++){ if(forced[j]>start+1 && forced[j]<=(cut!=null?cut:limit)+0.5){ if(fc===null||forced[j]<fc) fc=forced[j]; } }
      if(fc!==null) cut=fc;
      if(cut===null){                                 // 한 섹션이 페이지보다 큰 경우만 2순위: 표 행/문단(.ct-soft)
        for(var k=0;k<softs.length;k++){ if(softs[k]>start+1 && softs[k]<=limit+0.5) cut=softs[k]; }
      }
      if(cut===null || cut<=start) cut=Math.min(limit,Hcss);  // 그래도 없으면 부득이 절단
      var sliceCss=cut-start;
      var sc=document.createElement('canvas');
      sc.width=canvas.width; sc.height=Math.max(1,Math.round(sliceCss*scale));
      sc.getContext('2d').drawImage(canvas,0,Math.round(start*scale),canvas.width,sc.height,0,0,canvas.width,sc.height);
      if(!first) pdf.addPage();
      pdf.addImage(sc.toDataURL('image/jpeg',0.92),'JPEG',0,topMm,210,sliceCss*mmPerCss);
      if(_artEl){ var _oT=Math.max(start,_artT), _oB=Math.min(cut,_artB);
        if(_oB>_oT+1){ var _yT=topMm+(_oT-start)*mmPerCss, _yB=topMm+(_oB-start)*mmPerCss;
          var _xL=_artL*mmPerCss, _wM=_artW*mmPerCss, _xC=(_artL+_artW/2)*mmPerCss;
          pdf.setDrawColor(51,51,51); pdf.setLineWidth(0.3);
          pdf.rect(_xL,_yT,_wM,_yB-_yT); pdf.line(_xC,_yT,_xC,_yB); } }
      first=false; start=cut;
    }
    try{ var _tp=pdf.getNumberOfPages(); for(var _pg=1;_pg<=_tp;_pg++){ pdf.setPage(_pg); pdf.setFontSize(9); pdf.setTextColor(120,120,120); pdf.text(String(_pg)+' / '+_tp,105,297-4,{align:'center'}); } pdf.setTextColor(0,0,0); }catch(_){}
    var _cf='Contract_'+((o.contractNo||p.client||'contract').replace(/[^a-zA-Z0-9_-]/g,'_'));
    if(window._archivePdf){ try{ window._archivePdf(pdf.output('blob'), '계약서', _cf); }catch(_){ } }
    pdf.save(_cf+'.pdf'); document.body.removeChild(wrap);
  }).catch(function(){ if(wrap.parentNode)document.body.removeChild(wrap); showToast('PDF 실패'); });
}

async function printContract(){ var p=(state.projects||[]).find(function(x){return String(x.id)===String(_contractProjId);}); if(!p)return; var o=_readContractOpts(); saveBuyerToDB(p.client,_buyerOf(o)); saveState(); try{ var _qs=_projQuotesC(p); var _q=o.quoteId?_qs.find(function(x){return x.id===o.quoteId;}):_qs[0]; if(typeof _quoteResolveImgs==='function') await _quoteResolveImgs(_q); }catch(_){} var _html=_ctHasCustom(p)?p.contractCustomHtml:buildContractHtml(p,o,false); var w=window.open('','_blank'); var _head=(typeof _printHead==='function')?_printHead('Contract','@page{margin:16mm 8mm 12mm}'):'<meta charset="utf-8"><title>Contract</title>'; w.document.write('<html><head>'+_head+'</head><body style="margin:0">'+_html+'</body></html>'); w.document.close(); if(typeof _printWhenReady==='function'){ _printWhenReady(w); } else { setTimeout(function(){ w.print(); },700); } }

function openContractTpl(){
  var t=getContractTpl();
  var box=document.getElementById('ctTplBody');
  box.innerHTML=_CT_FIELDS.map(function(f){
    return '<div style="margin-bottom:14px;border:1px solid var(--border);border-radius:var(--radius);padding:10px">'
      +'<div style="font-size:12px;font-weight:700;margin-bottom:6px">'+f[1]+'</div>'
      +'<div style="font-size:10px;color:var(--text-3);margin-bottom:4px">🇻🇳 Tiếng Việt</div><textarea id="tpl_'+f[0]+'Vi" rows="4" style="width:100%;font-size:11px;padding:6px;border:1px solid var(--border);border-radius:var(--radius);font-family:var(--sans);box-sizing:border-box;resize:vertical">'+(t[f[0]+'Vi']||'')+'</textarea>'
      +'<div style="font-size:10px;color:var(--text-3);margin:6px 0 4px">🇬🇧 English</div><textarea id="tpl_'+f[0]+'En" rows="4" style="width:100%;font-size:11px;padding:6px;border:1px solid var(--border);border-radius:var(--radius);font-family:var(--sans);box-sizing:border-box;resize:vertical">'+(t[f[0]+'En']||'')+'</textarea>'
      +'<div style="font-size:10px;color:#1d4ed8;margin:6px 0 4px">🇰🇷 한국어 <span style="color:var(--text-3)">(미리보기 한국어본 — 출력에는 안 나옴)</span></div><textarea id="tpl_'+f[0]+'Ko" rows="4" style="width:100%;font-size:11px;padding:6px;border:1px solid #bfdbfe;border-radius:var(--radius);font-family:var(--sans);box-sizing:border-box;resize:vertical;background:#f8fbff">'+(t[f[0]+'Ko']||'')+'</textarea>'
      +'</div>';
  }).join('');
  document.getElementById('contractTplModal').style.display='block';
}

function closeContractTpl(){ document.getElementById('contractTplModal').style.display='none'; }

function saveContractTpl(){
  state.contractTemplate=state.contractTemplate||{};
  _CT_FIELDS.forEach(function(f){ state.contractTemplate[f[0]+'Vi']=document.getElementById('tpl_'+f[0]+'Vi').value; state.contractTemplate[f[0]+'En']=document.getElementById('tpl_'+f[0]+'En').value; var _ko=document.getElementById('tpl_'+f[0]+'Ko'); if(_ko) state.contractTemplate[f[0]+'Ko']=_ko.value; });
  saveState(); closeContractTpl(); showToast('계약서 템플릿 저장됨 · Template saved');
}

function resetContractTpl(){ if(!confirm('템플릿을 기본값으로 되돌릴까요?'))return; state.contractTemplate={}; saveState(); openContractTpl(); showToast('기본 템플릿으로 복원 · Restore Default Template'); }

function previewContractTpl(){
  // 편집 중(미저장)인 textarea 값으로 임시 템플릿 구성 — 미저장 수정사항도 그대로 미리보기
  var tplLive={};
  _CT_FIELDS.forEach(function(f){
    var vi=document.getElementById('tpl_'+f[0]+'Vi'), en=document.getElementById('tpl_'+f[0]+'En'), ko=document.getElementById('tpl_'+f[0]+'Ko');
    tplLive[f[0]+'Vi']=vi?vi.value:''; tplLive[f[0]+'En']=en?en.value:''; tplLive[f[0]+'Ko']=ko?ko.value:'';
  });
  for(var k in CONTRACT_TPL_DEFAULTS){ if(tplLive[k]==null||tplLive[k]==='') tplLive[k]=CONTRACT_TPL_DEFAULTS[k]; }
  // 샘플 거래처·옵션 — 노란색으로 표시될 가변 항목들에 한글 안내 placeholder
  var sampleP={ id:'SAMPLE', client:'거래처명', clientFull:'거래처 정식명칭', deliveryPlace:'납품 장소', location:'구매자 주소', targetDate:'' };
  var sampleO={ contractNo:'계약번호', date:'계약일자', vatRate:8, depositPct:50, balancePct:50,
    warrantyYears:'보증연수', paymentDays:'결제기한', deliveryDate:'납기일',
    quoteId:null, buyerRep:'구매자 대표', buyerTitle:'직위', buyerAddr:'구매자 주소', buyerTax:'세금코드(MST)' };
  // 샘플 견적 — 품목표 형태가 보이도록 (실제 견적 데이터는 건드리지 않음)
  var sampleQuote={ currency:'VND', lines:[
    { category:'CHAIR', name:'샘플 제품 A', code:'SMP-001', size:'600×600×1100', colorCode:'BK', qty:10, unitPrice:2000000, amount:20000000, remark:'' },
    { category:'DESK',  name:'샘플 제품 B', code:'SMP-002', size:'1400×700×750', colorCode:'WH', qty:5, unitPrice:3000000, amount:15000000, remark:'' }
  ]};
  _ctTplSample={p:sampleP,o:sampleO,q:sampleQuote,tpl:tplLive};
  _ctTplLang='vnen'; _ctTplZoom=100;
  renderCtTplPreview();
  document.getElementById('ctTplPreviewModal').style.display='block';
}

function renderCtTplPreview(){
  if(!_ctTplSample)return;
  var box=document.getElementById('ctTplPreviewBody'); if(!box)return;
  box.innerHTML=buildContractHtml(_ctTplSample.p,_ctTplSample.o,true,_ctTplSample.tpl,_ctTplSample.q,_ctTplLang);
  box.style.zoom=_ctTplZoom/100;
  var a=document.getElementById('ctTplLangVnen'), b=document.getElementById('ctTplLangKo');
  if(a){ a.style.background=(_ctTplLang==='vnen')?'var(--text)':'var(--surface)'; a.style.color=(_ctTplLang==='vnen')?'#fff':'var(--text-2)'; }
  if(b){ b.style.background=(_ctTplLang==='ko')?'var(--text)':'var(--surface)'; b.style.color=(_ctTplLang==='ko')?'#fff':'var(--text-2)'; }
  var z=document.getElementById('ctTplZoomLabel'); if(z)z.textContent=_ctTplZoom+'%';
}

function setCtTplLang(l){ _ctTplLang=l; renderCtTplPreview(); }

function ctTplZoom(d){ _ctTplZoom=Math.max(50,Math.min(220,_ctTplZoom+d)); renderCtTplPreview(); }

function closeCtTplPreview(){ document.getElementById('ctTplPreviewModal').style.display='none'; }

var INICS_LOGO_CT='data:image/png;base64,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';
function buildContractHtml(p,o,review,tplOverride,sampleQuote,lang){
  var isKo=(lang==='ko');
  var qs=_projQuotesC(p);
  var q=sampleQuote||(o.quoteId?qs.find(function(x){return x.id===o.quoteId;}):qs[0]);
  var lines=q?(q.lines||[]):[];
  var sub=lines.reduce(function(s,l){return s+qNum(l.amount);},0);
  var vatAmt=sub*o.vatRate/100, total=sub+vatAmt;
  var cur=(o.currency||(q&&q.currency)||'VND');
  var M=function(n){return _money(n,cur);};
  var H=review?function(v){return '<mark style="background:#fff59d;padding:0 2px;border-radius:1px">'+v+'</mark>';}:function(v){return v;};
  var KO=review?function(t){return '<div style="font-size:10.8px;color:#1d4ed8;margin-top:3px">🇰🇷 '+t+'</div>';}:function(){return '';};
  var tpl=tplOverride||getContractTpl();
  var payDays=o.paymentDays||'';
  // ── 결제 회차(1~3차): 매출 정산 terms 를 단일 소스로. 금액은 계약 총액 기준 재계산(마지막 차수 자동보정) ──
  var _tsrc=(p.sales&&p.sales.terms&&p.sales.terms.rows&&p.sales.terms.rows.length)?p.sales.terms
           :((typeof _migrateSalesTerms==='function')?_migrateSalesTerms(p.sales||{}):{count:1,rows:[{pct:100,at:'po',net:0}]});
  var _tcnt=Math.max(1,Math.min(3,parseInt(_tsrc.count,10)||(_tsrc.rows?_tsrc.rows.length:1)||1));
  var trows=[]; for(var _ti=0;_ti<_tcnt;_ti++){ var _tr=(_tsrc.rows&&_tsrc.rows[_ti])||{}; trows.push({pct:(parseFloat(_tr.pct)||0),at:(_tr.at||'po'),net:(parseInt(_tr.net,10)||0),amt:0}); }
  var _accT=0; for(var _tj=0;_tj<_tcnt;_tj++){ if(_tj<_tcnt-1){ trows[_tj].amt=Math.round(total*trows[_tj].pct/100); _accT+=trows[_tj].amt; } else { trows[_tj].amt=Math.max(0,Math.round(total)-_accT); if(total>0) trows[_tj].pct=Math.round((trows[_tj].amt/total*100)*100)/100; } }
  var _atL=function(at,net,lang){ return (typeof termAtLabel==='function')?termAtLabel(at,net,lang):at; };
  var _ordL=function(i,lang){ return (typeof termOrdinal==='function')?termOrdinal(i,lang):((i+1)+'차'); };
  function _whenTxt(r,lang){ return H(_atL(r.at,r.net,lang)); }
  function _payLine(lang){ return trows.map(function(r,i){ var seg=_ordL(i,lang)+' — '+H(r.pct+'%')+' ('+H(M(r.amt))+'), '+_whenTxt(r,lang); if(i===0&&_tcnt>1){ if(lang==='vi')seg+='. Thời gian sản xuất và giao hàng (Lead Time) được tính từ ngày khoản này được ghi có đầy đủ vào tài khoản của Nhà Cung Cấp'; else if(lang==='en')seg+='. The production and delivery lead time shall be counted from the date this payment is fully credited to the Supplier\u2019s account'; else seg+='. 생산·인도 리드타임은 본 회차가 공급자 계좌에 완전히 입금된 날로부터 기산한다'; } return seg+'.'; }).join(' '); }
  var payVi=_payLine('vi'), payEn=_payLine('en'), payKo=_payLine('ko');
  var _D=function(v){ return (typeof _dmy==='function')?_dmy(v||''):(v||''); };
  var baseVars={ no:o.contractNo||'', date:_D(o.date), deliveryDate:_D(o.deliveryDate)||(review?'(미정)':'………'), deliveryPlace:p.deliveryPlace||(review?'(미입력)':'………'), total:M(total), paymentDays:payDays, warrantyYears:o.warrantyYears||'', cureDays:'' };
  var varsVi=Object.assign({},baseVars,{paymentClause:payVi});
  var varsEn=Object.assign({},baseVars,{paymentClause:payEn});
  var varsKo=Object.assign({},baseVars,{paymentClause:payKo});
  function esc(t){ return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function fill(t,vars){ return esc(t||'').replace(/\{(\w+)\}/g,function(_,k){ var v=vars[k]; if(v==null)return '{'+k+'}'; return k==='paymentClause'?v:H(v); }).replace(/\n/g,'<br>'); }
  var KO_TITLES=['목적 · Purpose','제품 및 수량 · Product & Quantity','납품 · Delivery','결제 조건 · Payment','계약의 해지 · Termination','구매자의 권리·의무 · Buyer','공급자의 권리·의무 · Supplier','일반 조항 · General'];
  function art(no,titleVi,titleEn,viKey,enKey,ko){
    var num=parseInt(String(no).replace(/\D/g,''))||0;
    if(isKo){
      var koKey=String(viKey).replace('Vi','Ko');
      return '<tr style="vertical-align:top"><td style="padding:8px 11px">'
        +'<div style="font-weight:700;font-size:13px;margin-bottom:4px">제'+num+'조 '+(KO_TITLES[num-1]||'')+'</div>'
        +'<div style="font-size:12px;line-height:1.7">'+fill(tpl[koKey]||tpl[viKey],varsKo)+'</div></td></tr>';
    }
    return '<tr style="vertical-align:top">'
      +'<td style="width:50%;border-right:1px solid #555;padding:8px 11px"><div style="font-weight:700;font-size:12.5px;margin-bottom:4px">'+no+'. '+titleVi+'</div><div style="font-size:12px;line-height:1.6">'+fill(tpl[viKey],varsVi)+'</div></td>'
      +'<td style="width:50%;padding:8px 11px"><div style="font-weight:700;font-size:12.5px;margin-bottom:4px">Article '+num+'. '+String(titleEn).toUpperCase()+'</div><div style="font-size:12px;line-height:1.6">'+fill(tpl[enKey],varsEn)+'</div>'+(ko?KO(ko):'')+'</td>'
    +'</tr>';
  }
  var rows=lines.length?lines.map(function(l,i){
    var img=l.image?(window._img?window._img(l.image,'style="max-width:54px;max-height:44px;object-fit:contain"'):'<img src="'+l.image+'" style="max-width:54px;max-height:44px;object-fit:contain">'):'';
    return '<tr class="ct-soft">'
      +'<td style="border:1px solid #999;padding:3px 4px;text-align:center">'+(i+1)+'</td>'
      +'<td style="border:1px solid #999;padding:3px 4px;font-size:9.6px">'+(l.category||'')+'</td>'
      +'<td style="border:1px solid #999;padding:3px 4px">'+H(l.name||l.code||'')+'</td>'
      +'<td style="border:1px solid #999;padding:3px 4px;text-align:center">'+img+'</td>'
      +'<td style="border:1px solid #999;padding:3px 4px;text-align:center;font-size:9.6px">'+(l.size||'')+'</td>'
      +'<td style="border:1px solid #999;padding:3px 4px;text-align:center;font-size:9.6px">'+(l.code||'')+'</td>'
      +'<td style="border:1px solid #999;padding:3px 4px;text-align:center">'+(l.colorCode||'')+'</td>'
      +'<td style="border:1px solid #999;padding:3px 4px;text-align:center">'+fmtN(l.qty)+'</td>'
      +'<td style="border:1px solid #999;padding:3px 4px;text-align:right">'+fmtN(l.unitPrice)+'</td>'
      +'<td style="border:1px solid #999;padding:3px 4px;text-align:right">'+fmtN(l.amount)+'</td>'
      +'<td style="border:1px solid #999;padding:3px 4px;font-size:9.6px">'+(l.remark||'')+'</td>'
      +'</tr>';
  }).join(''):'<tr><td colspan="11" style="border:1px solid #999;padding:10px;text-align:center;color:#b91c1c">'+(review?'연결된 견적이 없습니다 — 견적서를 먼저 작성/연결하세요':'')+'</td></tr>';

  return ''
  +'<div style="width:754px;margin:0 auto;padding:24px 24px 34px;background:#fff;color:#111;font-family:\'Be Vietnam Pro\',\'Segoe UI\',\'Noto Sans\',Tahoma,Arial,sans-serif;box-sizing:border-box;font-synthesis:none">'
  +'<div style="padding:4px 0 12px"><img src="'+INICS_LOGO_CT+'" alt="INICS" style="height:52px;width:auto;object-fit:contain;display:block"></div>'
  +'<hr style="border:none;border-top:2px solid #111;margin:0 0 18px">'
  +(isKo
    ? '<div style="text-align:center"><div style="font-size:16px;font-weight:800">가구 공급 계약서 · Furniture Supply Contract</div><div style="font-size:13px;font-weight:700;color:#333;margin-top:2px">SUPPLY CONTRACT · 한국어 참고본</div><div style="font-size:11px;margin-top:4px">계약번호 / No.: '+H(o.contractNo||'')+'</div></div>'
    : '<div style="text-align:center"><div class="vn-h" style="font-size:16px;font-weight:700;line-height:1.5;padding:2px 0">HỢP ĐỒNG CUNG CẤP HÀNG HÓA</div><div style="font-size:13px;font-weight:700;color:#333;margin-top:2px">SUPPLY CONTRACT</div>'+(review?'<div style="font-size:11px;color:#1d4ed8;margin-top:1px">가구 공급 계약서 · Furniture Supply Contract</div>':'')+'<div style="font-size:11px;margin-top:4px">Số / No.: '+H(o.contractNo||'')+'</div></div>')
  +(isKo
    ? '<div style="font-size:12px;margin-top:22px">본 계약은 '+H(_D(o.date))+'에 다음 양 당사자 간에 작성·체결되었다:</div>'
    : '<div style="font-size:12px;margin-top:22px">Hợp đồng này được lập và ký vào ngày '+H(_D(o.date))+', bởi và giữa: / This Contract is made on '+H(_D(o.date))+', by and between:</div>')

  // Bên A 공급자 / Bên B 구매자
  +'<div style="display:flex;gap:12px;margin-top:8px;font-size:12px;line-height:1.5">'
    +'<div style="flex:1;padding:2px 6px">'
      +'<div style="font-weight:700">'+(isKo?'갑 — 공급자 / Supplier':'Bên A – Nhà cung cấp / Supplier'+(review?'<span style="color:#1d4ed8"> · 공급자</span>':''))+'</div>'
      +'<div><b>'+INICS_INFO.nameVi+' / '+INICS_INFO.nameEn+'</b></div>'
      +'<div>'+(isKo?'주소':'Địa chỉ')+': '+INICS_INFO.addr+'</div>'
      +'<div>'+(isKo?'대표':'Đại diện')+': '+INICS_INFO.rep+' – '+INICS_INFO.repTitleVi+' / '+INICS_INFO.repTitleEn+'</div>'
      +'<div>'+(isKo?'세금코드':'MST')+': '+INICS_INFO.mst+'</div>'
    +'</div>'
    +'<div style="flex:1;padding:2px 6px">'
      +'<div style="font-weight:700">'+(isKo?'을 — 구매자 / Buyer':'Bên B – Bên mua / Buyer'+(review?'<span style="color:#1d4ed8"> · 구매자</span>':''))+'</div>'
      +'<div><b>'+H(p.clientFull||p.client||'')+'</b></div>'
      +'<div>'+(isKo?'주소':'Địa chỉ')+': '+H(o.buyerAddr||p.location||(review?'(미입력)':'………'))+'</div>'
      +'<div>'+(isKo?'대표':'Đại diện')+': '+H(o.buyerRep?((o.buyerGender==='male'?'Ông ':'Bà ')+o.buyerRep):(review?'(미입력)':'………'))+' – '+H(o.buyerTitle||(review?'(직위)':'………'))+'</div>'
      +'<div>'+(isKo?'세금코드':'MST')+': '+H(o.buyerTax||(review?'(미입력)':'………'))+'</div>'
    +'</div>'
  +'</div>'
  +(review?KO('공급자(Bên A)=INICS 고정, 구매자(Bên B) 정보는 옵션에서 입력 → 저장 시 거래처 DB 반영'):'')

  +'<table class="ct-arts" style="width:100%;border-collapse:collapse;border:1px solid #111;font-size:12px;line-height:1.55;margin-top:16px">'
  +art('Điều 1','MỤC ĐÍCH','Purpose','art1Vi','art1En','계약 목적')
  +art('Điều 2','SẢN PHẨM VÀ SỐ LƯỢNG','Product & Quantity','art2Vi','art2En','제품·수량 (부록1 견적 명세)')
  +art('Điều 3','GIAO HÀNG','Delivery','art3Vi','art3En','납품: 납기 '+(_D(o.deliveryDate)||'미정')+', 장소 '+(p.deliveryPlace||'미입력'))
  +art('Điều 4','ĐIỀU KHOẢN THANH TOÁN','Payment','art4Vi','art4En','결제: '+trows.map(function(r,i){return _ordL(i,'ko')+' '+r.pct+'% ('+_atL(r.at,r.net,'ko')+')';}).join(' / ')+', 총액 '+M(total))
  +art('Điều 5','CHẤM DỨT HỢP ĐỒNG','Termination','art5Vi','art5En','해지 조건')
  +art('Điều 6','QUYỀN & NGHĨA VỤ BÊN MUA','Buyer','art6Vi','art6En','구매자 권리·의무')
  +art('Điều 7','QUYỀN & NGHĨA VỤ NHÀ CUNG CẤP','Supplier','art7Vi','art7En','공급자 권리·의무')
  +art('Điều 8','ĐIỀU KHOẢN CHUNG','General','art8Vi','art8En','일반 · VIAC 중재 · 2부')
  +'</table>'

  // 서명란 (상단: 도장 공간 → 가운데: 줄+이름 → 하단: SUPPLIER/BUYER)
  +'<div class="ct-blk" style="display:flex;gap:16px;margin-top:24px;font-size:11.4px;text-align:center">'
    +'<div style="flex:1">'
      +'<div style="font-size:9.6px;color:#777;margin-bottom:2px">'+(isKo?'(서명 및 회사 직인)':'(Ký tên &amp; đóng dấu / Signature &amp; Company Seal)')+'</div>'
      +'<div style="position:relative;height:220px">'+(review?'<div style="position:absolute;left:50%;top:10px;transform:translateX(-50%);width:200px;height:200px;border:1px dashed #d4d4d4;border-radius:50%"></div>':'')+'</div>'
      +'<div style="font-size:10.8px;color:#222;border-top:1px solid #111;padding-top:4px">'+INICS_INFO.rep+' – '+INICS_INFO.repTitleEn+'</div>'
      +'<div style="font-weight:700;margin-top:5px">'+(isKo?'공급자 대표 / Supplier':'ĐẠI DIỆN NHÀ CUNG CẤP / Supplier')+'</div>'
    +'</div>'
    +'<div style="flex:1">'
      +'<div style="font-size:9.6px;color:#777;margin-bottom:2px">'+(isKo?'(서명 및 회사 직인)':'(Ký tên &amp; đóng dấu / Signature &amp; Company Seal)')+'</div>'
      +'<div style="position:relative;height:220px">'+(review?'<div style="position:absolute;left:50%;top:10px;transform:translateX(-50%);width:200px;height:200px;border:1px dashed #d4d4d4;border-radius:50%"></div>':'')+'</div>'
      +'<div style="font-size:10.8px;color:#222;border-top:1px solid #111;padding-top:4px">'+H(o.buyerRep||'')+(o.buyerTitle?' – '+H(o.buyerTitle):'')+'</div>'
      +'<div style="font-weight:700;margin-top:5px">'+(isKo?'구매자 대표 / Buyer':'ĐẠI DIỆN BÊN MUA / Buyer')+'</div>'
    +'</div>'
  +'</div>'

  // APPENDIX 1 견적 품목표
  +'<div class="ct-blk ct-page" style="margin-top:26px;page-break-before:always"><div class="vn-h" style="text-align:center;font-size:16px;font-weight:700;line-height:1.5;padding:2px 0">PHỤ LỤC 1 – MÔ TẢ THÔNG TIN ĐƠN HÀNG</div><div style="height:8px"></div><div class="vn-h" style="text-align:center;font-size:16px;font-weight:700;line-height:1.5;padding:2px 0;margin-bottom:10px">APPENDIX 1 – DESCRIPTION OF ORDER INFORMATION</div>'
    +'<table style="width:100%;border-collapse:collapse;font-size:10.2px">'
      +'<thead><tr style="background:#f1f5f9">'
        +['No','Category','Product Name','Image','Size (WxDxH)','Code','Color','Qty','Unit Price<br>(Excl.VAT)','Amount<br>(Excl.VAT)','Remark'].map(function(h){return '<th style="border:1px solid #999;padding:4px">'+h+'</th>';}).join('')
      +'</tr></thead><tbody>'+rows+'</tbody>'
      +'<tfoot style="break-inside:avoid;page-break-inside:avoid">'
        +'<tr><td colspan="9" style="border:1px solid #999;padding:5px;text-align:right;font-weight:700">TOTAL (Excl. VAT)</td><td style="border:1px solid #999;padding:5px;text-align:right;font-weight:700">'+H(fmtN(sub))+'</td><td style="border:1px solid #999"></td></tr>'
        +'<tr style="background:'+(review?'#fff59d':'#f8fafc')+'"><td colspan="9" style="border:1px solid #999;padding:5px;text-align:right">VAT '+H(o.vatRate+'%')+'</td><td style="border:1px solid #999;padding:5px;text-align:right">'+fmtN(vatAmt)+'</td><td style="border:1px solid #999"></td></tr>'
        +'<tr style="background:#eef2ff"><td colspan="9" style="border:1px solid #999;padding:5px;text-align:right;font-weight:800">TOTAL (Incl. VAT)</td><td style="border:1px solid #999;padding:5px;text-align:right;font-weight:800">'+H(fmtN(total))+'</td><td style="border:1px solid #999"></td></tr>'
        +'<tr class="ct-soft"><td colspan="11" style="border:1px solid #999;border-top:none;padding:6px 8px;font-size:9.6px;color:#555;background:#fbfbfb;line-height:1.5">Currency: '+cur+' &middot; All prices exclusive of taxes unless stated &middot; Prices include delivery and installation fee.</td></tr>'
      +'</tfoot></table>'
  +'</div>'

  +((true)?('<div class="ct-blk ct-page" style="margin-top:26px;page-break-before:always"><div class="vn-h" style="text-align:center;font-size:16px;font-weight:700;line-height:1.5;padding:2px 0">PHỤ LỤC 2 \u2013 THƯ BẢO HÀNH</div><div style="height:8px"></div><div class="vn-h" style="text-align:center;font-size:16px;font-weight:700;line-height:1.5;padding:2px 0;margin-bottom:3px">APPENDIX 2 \u2013 WARRANTY LETTER</div>'
    +'<div style="text-align:center;font-size:10.8px;color:#666;margin-bottom:10px">INICS VINA CO., LTD' + (o.date?' \u00b7 '+H(_D(o.date)):'') + '</div>'
    +'<table style="width:100%;border-collapse:collapse;font-size:10.8px;line-height:1.55">'
      +'<tr style="background:#f1f5f9;vertical-align:top"><th style="width:50%;border:1px solid #ccc;padding:4px 8px;text-align:left;font-size:10.2px">TIẾNG VIỆT</th><th style="width:50%;border:1px solid #ccc;padding:4px 8px;text-align:left;font-size:10.2px">ENGLISH</th></tr>'
      +'<tr class="ct-soft" style="vertical-align:top">'
        +'<td style="border:1px solid #ccc;padding:5px 8px">INICS VINA bảo hành sản phẩm của mình không có lỗi về vật liệu hoặc tay nghề gia công trong suốt vòng đời sản phẩm. INICS VINA sẽ sửa chữa hoặc thay thế bất kỳ sản phẩm nào bị hư hỏng trong điều kiện sử dụng bình thường do lỗi nêu trên.</td>'
        +'<td style="border:1px solid #ccc;padding:5px 8px">INICS VINA warrants its products to be free from defects in materials or workmanship for lifetime. INICS VINA will repair or replace any items which fail under normal use as a result of such defect.</td>'
      +'</tr>'
      +'<tr class="ct-soft" style="vertical-align:top">'
        +'<td style="border:1px solid #ccc;padding:5px 8px">Bảo hành này có hiệu lực kể từ ngày sản xuất và chỉ áp dụng cho người mua đầu tiên từ đại lý được ủy quyền và người sử dụng theo chế độ một ca làm việc.</td>'
        +'<td style="border:1px solid #ccc;padding:5px 8px">This warranty applies from the date of manufacture and is valid only for the initial purchaser from an authorized dealer and the single-shift user.</td>'
      +'</tr>'
      +'<tr class="ct-soft" style="vertical-align:top">'
        +'<td style="border:1px solid #ccc;padding:5px 8px"><div style="font-weight:700;margin-bottom:3px">Ngoại lệ về thời hạn</div>'
          +'<div style="margin:3px 0"><b>5 năm:</b> Phụ kiện cửa; Ray trượt ngăn kéo; Cơ cấu ghế ngồi; Bản lề cho tấm ốp; Các bộ phận chuyển động và hao mòn cao bao gồm chân trượt và bánh xe; Hệ thống khóa; Linh kiện điện.</div>'
          +'<div style="margin:3px 0"><b>3 năm:</b> Vải bọc tiêu chuẩn, da, veneer gỗ và các vật liệu bọc phủ khác; Tất cả các cơ cấu khác.</div>'
          +'<div style="margin:3px 0"><b>1 năm:</b> Các bộ phận thay thế như bảng viết; Tất cả các sản phẩm phi tiêu chuẩn khác.</div></td>'
        +'<td style="border:1px solid #ccc;padding:5px 8px"><div style="font-weight:700;margin-bottom:3px">Exceptions</div>'
          +'<div style="margin:3px 0"><b>5 years:</b> Hardware for doors; Drawer runners; Seating mechanisms; Hinges for panel belt tiles; Moving wear and high wear parts including glides and casters; Locking system; Electrical components.</div>'
          +'<div style="margin:3px 0"><b>3 years:</b> Standard textiles, leather, wood veneer and other covering materials; All other mechanisms.</div>'
          +'<div style="margin:3px 0"><b>1 year:</b> Replacement parts such as marker boards; All other nonstandard products.</div></td>'
      +'</tr>'
      +'<tr class="ct-soft" style="vertical-align:top">'
        +'<td style="border:1px solid #ccc;padding:5px 8px"><div style="font-weight:700;margin-bottom:3px">Các trường hợp loại trừ</div>Bảo hành này không áp dụng đối với: việc thay đổi hoặc chỉnh sửa sản phẩm; việc không sử dụng, lắp đặt hoặc bảo trì sản phẩm theo hướng dẫn sử dụng/lắp đặt hoặc cảnh báo đã công bố; sự khác biệt tự nhiên về vân gỗ hoặc hình dạng vân, hoặc sự xuất hiện của các dấu vết đặc trưng; thay đổi bề mặt hoàn thiện do lão hóa hoặc tiếp xúc với ánh sáng; các vết, sẹo hoặc nếp nhăn xuất hiện tự nhiên trên da; lỗi hoặc hư hỏng do hao mòn thông thường; độ bền màu hoặc sự tương đồng màu sắc của vải; sản phẩm sử dụng vật liệu do khách hàng cung cấp (COM) hoặc vật liệu phi tiêu chuẩn; lạm dụng, sử dụng sai mục đích hoặc tai nạn; hư hỏng xảy ra sau khi vận chuyển (mất thời gian, bất tiện, thiệt hại thương mại, hoặc thiệt hại ngẫu nhiên hay do hậu quả); sản phẩm được coi là vật tư tiêu hao (ví dụ: đèn); sản phẩm mang thương hiệu của nhà sản xuất khác; sản phẩm sử dụng cho mục đích cho thuê; sản phẩm không được lắp đặt và bảo trì bởi chuyên gia có chứng nhận.</td>'
        +'<td style="border:1px solid #ccc;padding:5px 8px"><div style="font-weight:700;margin-bottom:3px">Exclusions</div>This warranty does not extend to: alteration or modification of the product; failure to apply, install, or maintain products according to published application/installation guidelines or warnings; natural variations in wood grain or figure or the presence of character marks; changes in surface finishes due to aging or exposure to light; marks, scars, or wrinkles occurring naturally in leather; defects or failure resulting from normal wear and tear; the colorfastness or matching of colors of textiles; products applied to Customer\u2019s Own (COM) or non-standard material; abuse, misuse, or accident; damage occurring after shipping (loss of time, inconvenience, commercial loss, or incidental or consequential damages); products considered consumables (e.g. lamps); other manufacturers\u2019 branded products; products used for rental purposes; products not installed and serviced by certified professionals.</td>'
      +'</tr>'
      +'<tr class="ct-soft" style="vertical-align:top">'
        +'<td style="border:1px solid #ccc;padding:5px 8px">Trong mọi trường hợp, INICS VINA sẽ không chịu trách nhiệm dù theo trách nhiệm ngoài hợp đồng hay theo hợp đồng đối với bất kỳ tổn thất nào, hoặc các thiệt hại trực tiếp, đặc biệt, ngẫu nhiên, do hậu quả hoặc mang tính trừng phạt. Bảo hành này là biện pháp khắc phục duy nhất của khách hàng đối với lỗi sản phẩm. Ngoài các bảo đảm rõ ràng được nêu trong tài liệu này, INICS VINA không đưa ra bất kỳ bảo đảm nào khác, bao gồm các bảo đảm ngụ ý về khả năng thương mại và tính phù hợp cho một mục đích cụ thể.</td>'
        +'<td style="border:1px solid #ccc;padding:5px 8px">In no event shall INICS VINA be liable in either tort or contract for any loss or direct, special, incidental, consequential or exemplary damages. This warranty is the customer\u2019s sole remedy for product defect. INICS VINA makes no warranties, including the implied warranties of merchantability and fitness for a particular purpose, other than the express warranties contained herein.</td>'
      +'</tr>'
    +'</table>'
  +'</div>'):'')
  +(review?'<div style="margin-top:14px;padding:8px 10px;background:#fffbeb;border:1px solid #fde68a;font-size:10.8px;color:#92400e;line-height:1.5">🟡 노란색은 프로젝트·견적에서 자동으로 채워진 값입니다. 출력(PDF/인쇄)에는 형광펜·한국어가 빠지고 베트남어·영문만 인쇄됩니다. 조항 문구는 관리자 패널 → 계약서 템플릿에서 수정할 수 있습니다. 실제 사용 전 현지 법무 검토를 권장합니다.</div>':'')
  +'</div>';
}
