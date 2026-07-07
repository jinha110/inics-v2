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

function _ctDefaults(p){ var qs=_projQuotesC(p); return { contractNo:_ctNoFor(p), date:projTodayISO(), vatRate:8, warrantyYears:10, depositPct:50, balancePct:50, paymentDays:3, deliveryDate:p.targetDate||'', buyerGender:'female', quoteId:(qs[0]?qs[0].id:null) }; }

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
  document.getElementById('ctWarranty').value=o.warrantyYears||10;
  document.getElementById('ctDeposit').value=(o.depositPct==null?50:o.depositPct);
  document.getElementById('ctBalance').value=(o.balancePct==null?(o.depositPct==null?50:Math.max(0,100-qNum(o.depositPct))):o.balancePct);
  document.getElementById('ctPayDays').value=o.paymentDays||3;
  document.getElementById('ctDeliveryDate').value=o.deliveryDate||p.targetDate||'';
  var qs=_projQuotesC(p);
  document.getElementById('ctQuote').innerHTML = qs.length
    ? qs.map(function(q){ var tot=(q.lines||[]).reduce(function(s,l){return s+qNum(l.amount);},0); return '<option value="'+q.id+'"'+(String(o.quoteId)===String(q.id)?' selected':'')+'>'+(q.quoteNo||'견적')+' · '+fmtN(tot)+' · '+(q.lines||[]).length+'품목</option>'; }).join('')
    : '<option value="">연결된 견적 없음 — 견적서에서 먼저 작성</option>';
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
  function pHay(p){ var o=p.contractOpts||{}; return [o.contractNo,p.clientFull,p.client,p.title,o.date].join(' ').toLowerCase(); }
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
        +'<td style="'+td+';font-weight:600">'+(p.clientFull||p.client||'—')+(p.title?'<div style="font-size:10px;color:var(--text-3);font-weight:400">'+p.title+'</div>':'')+'</td>'
        +'<td style="'+td+';color:var(--text-3);white-space:nowrap">'+(o.date||'')+'</td>'
        +'<td style="'+td+';text-align:right;font-weight:700;white-space:nowrap">'+tt.cur+' '+fmtN(Math.round(tt.total))+'</td>'
        +'<td style="'+td+';white-space:nowrap;color:var(--text-2);font-size:11px">선금 '+(o.depositPct==null?'-':o.depositPct)+'% / 잔금 '+(o.balancePct==null?'-':o.balancePct)+'%</td>'
        +'<td style="'+td+';white-space:nowrap">'+scanCell+'</td>'
        +'<td style="'+td+';text-align:center;white-space:nowrap" title="대금 입금 / 발행 · Payment / Issue">'+prCell+'</td>'
        +'<td style="'+td+';text-align:right;white-space:nowrap"><button class="btn btn-outline" style="font-size:10px;padding:3px 8px" onclick="openContractFromApp('+p.id+')"><i class="ti ti-edit"></i> 열기 · Open</button> <button class="btn btn-outline" style="font-size:10px;padding:3px 8px" onclick="_contractProjId='+p.id+';document.getElementById(\'contractScanInput\').click()"><i class="ti ti-paperclip"></i> 스캔 · Scan</button></td>'
      +'</tr>';
    }).join('');
    html+='<div style="overflow-x:auto;border:1px solid var(--border);border-radius:var(--radius);margin-bottom:6px"><table style="width:100%;border-collapse:collapse;min-width:980px">'
      +'<thead><tr><th style="'+th+'">상태 · Status</th><th style="'+th+'">계약번호 · No.</th><th style="'+th+'">고객 · Client</th><th style="'+th+'">계약일 · Date</th><th style="'+th+';text-align:right">금액 · Amount</th><th style="'+th+'">선금/잔금 · Deposit/Balance</th><th style="'+th+'">스캔본 · Scan</th><th style="'+th+';text-align:center">입금·PR</th><th style="'+th+';text-align:right">작업 · Action</th></tr></thead>'
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
    depositPct:qNum(document.getElementById('ctDeposit').value),
    balancePct:qNum(document.getElementById('ctBalance').value),
    warrantyYears:(document.getElementById('ctWarranty').value||'').trim(),
    paymentDays:(document.getElementById('ctPayDays').value||'').trim(),
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

function downloadContractPDF(){
  if(typeof html2canvas==='undefined' || !window.jspdf){ showToast('PDF 모듈 로드 실패(네트워크 확인)'); return; }
  var p=(state.projects||[]).find(function(x){return String(x.id)===String(_contractProjId);}); if(!p)return;
  var o=_readContractOpts(); saveBuyerToDB(p.client,_buyerOf(o)); saveState();
  var wrap=document.createElement('div'); wrap.style.cssText='position:fixed;left:-9999px;top:0;width:794px;background:#fff';
  wrap.innerHTML=_ctHasCustom(p)?p.contractCustomHtml:buildContractHtml(p,o,false); document.body.appendChild(wrap);
  showToast('PDF 생성 중...');
  html2canvas(wrap,{scale:2,backgroundColor:'#ffffff',useCORS:true}).then(function(canvas){
    var pdf=new window.jspdf.jsPDF('p','mm','a4');
    var W=wrap.offsetWidth||794;
    var scale=canvas.width/W;                  // css px -> canvas px
    var mmPerCss=210/W;                         // 이미지 폭 = 210mm
    var marginMm=6, usableMm=297-marginMm*2;    // 페이지당 본문 영역(mm)
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
      pdf.addImage(sc.toDataURL('image/jpeg',0.92),'JPEG',0,marginMm,210,sliceCss*mmPerCss);
      first=false; start=cut;
    }
    var _cf='Contract_'+((o.contractNo||p.client||'contract').replace(/[^a-zA-Z0-9_-]/g,'_'));
    if(window._archivePdf){ try{ window._archivePdf(pdf.output('blob'), '계약서', _cf); }catch(_){ } }
    pdf.save(_cf+'.pdf'); document.body.removeChild(wrap);
  }).catch(function(){ if(wrap.parentNode)document.body.removeChild(wrap); showToast('PDF 실패'); });
}

function printContract(){ var p=(state.projects||[]).find(function(x){return String(x.id)===String(_contractProjId);}); if(!p)return; var o=_readContractOpts(); saveBuyerToDB(p.client,_buyerOf(o)); saveState(); var _html=_ctHasCustom(p)?p.contractCustomHtml:buildContractHtml(p,o,false); var w=window.open('','_blank'); w.document.write('<html><head><meta charset="utf-8"><title>Contract</title><style>@page{margin:8mm}.ct-blk,.ct-soft{break-inside:avoid;page-break-inside:avoid}.ct-page{break-before:page;page-break-before:always}</style></head><body style="margin:0">'+_html+'</body></html>'); w.document.close(); setTimeout(function(){ w.print(); },400); }

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

function buildContractHtml(p,o,review,tplOverride,sampleQuote,lang){
  var isKo=(lang==='ko');
  var qs=_projQuotesC(p);
  var q=sampleQuote||(o.quoteId?qs.find(function(x){return x.id===o.quoteId;}):qs[0]);
  var lines=q?(q.lines||[]):[];
  var sub=lines.reduce(function(s,l){return s+qNum(l.amount);},0);
  var vatAmt=sub*o.vatRate/100, total=sub+vatAmt;
  var cur=q?(q.currency||'VND'):'VND';
  var M=function(n){return _money(n,cur);};
  var H=review?function(v){return '<mark style="background:#fff59d;padding:0 2px;border-radius:1px">'+v+'</mark>';}:function(v){return v;};
  var KO=review?function(t){return '<div style="font-size:9px;color:#1d4ed8;margin-top:3px">🇰🇷 '+t+'</div>';}:function(){return '';};
  var tpl=tplOverride||getContractTpl();
  var dep=(o.depositPct==null?100:qNum(o.depositPct));
  var bal=(o.balancePct==null||o.balancePct===''?(100-dep):qNum(o.balancePct));
  var payDays=o.paymentDays||'';
  var payVi, payEn, payKo;
  if(dep>=100 && bal<=0){
    payVi='Bên Mua thanh toán 100% giá trị hợp đồng ('+H(M(total))+') trong vòng '+H(payDays)+' ngày làm việc kể từ ngày ký Hợp đồng (thanh toán trước khi giao hàng).';
    payEn='The Buyer shall pay 100% of the contract value ('+H(M(total))+') within '+H(payDays)+' working days after signing the Contract (advance payment).';
    payKo='구매자는 계약서 서명 후 '+H(payDays)+' 영업일 이내에 계약 총액('+H(M(total))+')의 100%를 선금으로 지급한다 (인도 전 선납).';
  } else {
    var _d=total*dep/100, _b=total*bal/100;
    payVi='Đợt 1 – Tạm ứng '+H(dep+'%')+' ('+H(M(_d))+') trong vòng '+H(payDays)+' ngày làm việc kể từ ngày ký Hợp đồng. Thời gian sản xuất và giao hàng (Lead Time) của sản phẩm được tính kể từ ngày khoản tạm ứng này được ghi có đầy đủ vào tài khoản chỉ định của Nhà Cung Cấp. Đợt 2 – '+H(bal+'%')+' ('+H(M(_b))+') trong vòng '+H(payDays)+' ngày làm việc sau khi nghiệm thu / bàn giao.';
    payEn='Phase 1 – Advance '+H(dep+'%')+' ('+H(M(_d))+') within '+H(payDays)+' working days of signing. The production and delivery lead time of the products shall be counted from the date on which this advance payment is fully credited to the Supplier\u2019s designated account. Phase 2 – '+H(bal+'%')+' ('+H(M(_b))+') within '+H(payDays)+' working days after acceptance / handover.';
    payKo='1차 — 계약서 서명 후 '+H(payDays)+' 영업일 이내에 계약 총액의 '+H(dep+'%')+' 선금('+H(M(_d))+')을 지급한다. 제품의 생산 및 인도 리드타임(Lead Time)은 공급자의 지정 계좌로 본 선금이 완전히 입금된 날로부터 기산한다. 2차 — 검수 / 인도 후 '+H(payDays)+' 영업일 이내에 '+H(bal+'%')+' 잔금('+H(M(_b))+')을 지급한다.';
  }
  var baseVars={ no:o.contractNo||'', date:o.date||'', deliveryDate:o.deliveryDate||(review?'(미정)':'………'), deliveryPlace:p.deliveryPlace||(review?'(미입력)':'………'), total:M(total), paymentDays:payDays, warrantyYears:o.warrantyYears||'', cureDays:'' };
  var varsVi=Object.assign({},baseVars,{paymentClause:payVi});
  var varsEn=Object.assign({},baseVars,{paymentClause:payEn});
  var varsKo=Object.assign({},baseVars,{paymentClause:payKo});
  function esc(t){ return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function fill(t,vars){ return esc(t||'').replace(/\{(\w+)\}/g,function(_,k){ var v=vars[k]; if(v==null)return '{'+k+'}'; return k==='paymentClause'?v:H(v); }).replace(/\n/g,'<br>'); }
  var KO_TITLES=['목적 · Purpose','제품 및 수량 · Product & Quantity','납품 · Delivery','결제 조건 · Payment','계약의 해지 · Termination','구매자의 권리·의무 · Buyer','공급자의 권리·의무 · Supplier','일반 조항 · General'];
  function art(no,titleVi,titleEn,viKey,enKey,ko){
    if(isKo){
      var idx=parseInt(String(viKey).replace(/\D/g,''))||0;
      var koKey=String(viKey).replace('Vi','Ko');
      return '<div class="ct-blk" style="margin-top:14px"><div style="font-weight:700;font-size:12.5px;margin-bottom:5px">제'+idx+'조 '+(KO_TITLES[idx-1]||'')+'</div>'
        +'<div style="padding:7px 10px;border:1px solid #ccc;font-size:11.5px;line-height:1.75">'+fill(tpl[koKey]||tpl[viKey],varsKo)+'</div></div>';
    }
    return '<div class="ct-blk" style="margin-top:12px"><div style="font-weight:700;font-size:11px;margin-bottom:4px">'+no+'. '+titleVi+' · '+titleEn+'</div>'
      +'<table style="width:100%;border-collapse:collapse;font-size:9.5px;line-height:1.5"><tr style="vertical-align:top">'
      +'<td style="width:50%;padding:5px 8px;border:1px solid #ccc">'+fill(tpl[viKey],varsVi)+'</td>'
      +'<td style="width:50%;padding:5px 8px;border:1px solid #ccc">'+fill(tpl[enKey],varsEn)+'</td>'
      +'</tr></table>'+(ko?KO(ko):'')+'</div>';
  }
  var rows=lines.length?lines.map(function(l,i){
    var img=l.image?'<img src="'+l.image+'" style="max-width:54px;max-height:44px;object-fit:contain">':'';
    return '<tr class="ct-soft">'
      +'<td style="border:1px solid #999;padding:3px 4px;text-align:center">'+(i+1)+'</td>'
      +'<td style="border:1px solid #999;padding:3px 4px;font-size:8px">'+(l.category||'')+'</td>'
      +'<td style="border:1px solid #999;padding:3px 4px">'+H(l.name||l.code||'')+'</td>'
      +'<td style="border:1px solid #999;padding:3px 4px;text-align:center">'+img+'</td>'
      +'<td style="border:1px solid #999;padding:3px 4px;text-align:center;font-size:8px">'+(l.size||'')+'</td>'
      +'<td style="border:1px solid #999;padding:3px 4px;text-align:center;font-size:8px">'+(l.code||'')+'</td>'
      +'<td style="border:1px solid #999;padding:3px 4px;text-align:center">'+(l.colorCode||'')+'</td>'
      +'<td style="border:1px solid #999;padding:3px 4px;text-align:center">'+fmtN(l.qty)+'</td>'
      +'<td style="border:1px solid #999;padding:3px 4px;text-align:right">'+fmtN(l.unitPrice)+'</td>'
      +'<td style="border:1px solid #999;padding:3px 4px;text-align:right">'+fmtN(l.amount)+'</td>'
      +'<td style="border:1px solid #999;padding:3px 4px;font-size:8px">'+(l.remark||'')+'</td>'
      +'</tr>';
  }).join(''):'<tr><td colspan="11" style="border:1px solid #999;padding:10px;text-align:center;color:#b91c1c">'+(review?'연결된 견적이 없습니다 — 견적서를 먼저 작성/연결하세요':'')+'</td></tr>';

  return ''
  +'<div style="width:754px;margin:0 auto;padding:22px 20px 30px;background:#fff;color:#111;font-family:Arial,sans-serif;box-sizing:border-box">'
  +(isKo
    ? '<div style="text-align:center"><div style="font-size:17px;font-weight:800">가구 공급 계약서 · Furniture Supply Contract</div><div style="font-size:12px;font-weight:700;color:#333">SUPPLY CONTRACT · 한국어 참고본</div><div style="font-size:10px;margin-top:3px">계약번호 / No.: '+H(o.contractNo||'')+'</div></div>'
    : '<div style="text-align:center"><div style="font-size:16px;font-weight:800">HỢP ĐỒNG CUNG CẤP HÀNG HÓA</div><div style="font-size:13px;font-weight:700;color:#333">SUPPLY CONTRACT</div>'+(review?'<div style="font-size:10px;color:#1d4ed8">가구 공급 계약서 · Furniture Supply Contract</div>':'')+'<div style="font-size:10px;margin-top:3px">Số / No.: '+H(o.contractNo||'')+'</div></div>')
  +(isKo
    ? '<div style="font-size:11px;margin-top:20px">본 계약은 '+H(o.date||'')+'에 다음 양 당사자 간에 작성·체결되었다:</div>'
    : '<div style="font-size:9.5px;margin-top:20px">Hợp đồng này được lập và ký vào ngày '+H(o.date||'')+', bởi và giữa: / This Contract is made on '+H(o.date||'')+', by and between:</div>')

  // Bên A 공급자 / Bên B 구매자
  +'<div class="ct-blk" style="display:flex;gap:12px;margin-top:8px;font-size:'+(isKo?'10px':'9px')+';line-height:1.5">'
    +'<div style="flex:1;border:1px solid #888;padding:7px 9px">'
      +'<div style="font-weight:700">'+(isKo?'갑 — 공급자 / Supplier':'Bên A – Nhà cung cấp / Supplier'+(review?'<span style="color:#1d4ed8"> · 공급자</span>':''))+'</div>'
      +'<div><b>'+INICS_INFO.nameVi+' / '+INICS_INFO.nameEn+'</b></div>'
      +'<div>'+(isKo?'주소':'Địa chỉ')+': '+INICS_INFO.addr+'</div>'
      +'<div>'+(isKo?'대표':'Đại diện')+': '+INICS_INFO.rep+' – '+INICS_INFO.repTitleVi+' / '+INICS_INFO.repTitleEn+'</div>'
      +'<div>'+(isKo?'세금코드':'MST')+': '+INICS_INFO.mst+'</div>'
    +'</div>'
    +'<div style="flex:1;border:1px solid #888;padding:7px 9px">'
      +'<div style="font-weight:700">'+(isKo?'을 — 구매자 / Buyer':'Bên B – Bên mua / Buyer'+(review?'<span style="color:#1d4ed8"> · 구매자</span>':''))+'</div>'
      +'<div><b>'+H(p.clientFull||p.client||'')+'</b></div>'
      +'<div>'+(isKo?'주소':'Địa chỉ')+': '+H(o.buyerAddr||p.location||(review?'(미입력)':'………'))+'</div>'
      +'<div>'+(isKo?'대표':'Đại diện')+': '+H(o.buyerRep?((o.buyerGender==='male'?'Ông ':'Bà ')+o.buyerRep):(review?'(미입력)':'………'))+' – '+H(o.buyerTitle||(review?'(직위)':'………'))+'</div>'
      +'<div>'+(isKo?'세금코드':'MST')+': '+H(o.buyerTax||(review?'(미입력)':'………'))+'</div>'
    +'</div>'
  +'</div>'
  +(review?KO('공급자(Bên A)=INICS 고정, 구매자(Bên B) 정보는 옵션에서 입력 → 저장 시 거래처 DB 반영'):'')

  +art('Điều 1','MỤC ĐÍCH','Purpose','art1Vi','art1En','계약 목적')
  +art('Điều 2','SẢN PHẨM VÀ SỐ LƯỢNG','Product & Quantity','art2Vi','art2En','제품·수량 (부록1 견적 명세)')
  +art('Điều 3','GIAO HÀNG','Delivery','art3Vi','art3En','납품: 납기 '+(o.deliveryDate||'미정')+', 장소 '+(p.deliveryPlace||'미입력'))
  +art('Điều 4','ĐIỀU KHOẢN THANH TOÁN','Payment','art4Vi','art4En','결제: 선금 '+dep+'%'+(dep>=100?' (계약 후 '+(o.paymentDays||'')+'일 내 전액 선금)':' / 잔금 '+(100-dep)+'% 검수 후')+', 총액 '+M(total))
  +art('Điều 5','CHẤM DỨT HỢP ĐỒNG','Termination','art5Vi','art5En','해지 조건')
  +art('Điều 6','QUYỀN & NGHĨA VỤ BÊN MUA','Buyer','art6Vi','art6En','구매자 권리·의무')
  +art('Điều 7','QUYỀN & NGHĨA VỤ NHÀ CUNG CẤP','Supplier','art7Vi','art7En','공급자 의무 · 보증 '+(o.warrantyYears||'')+'년')
  +art('Điều 8','ĐIỀU KHOẢN CHUNG','General','art8Vi','art8En','일반 · VIAC 중재 · 2부')

  // 서명란 (상단: 도장 공간 → 가운데: 줄+이름 → 하단: SUPPLIER/BUYER)
  +'<div class="ct-blk" style="display:flex;gap:16px;margin-top:24px;font-size:9.5px;text-align:center">'
    +'<div style="flex:1">'
      +'<div style="font-size:8px;color:#777;margin-bottom:2px">'+(isKo?'(서명 및 회사 직인)':'(Ký tên &amp; đóng dấu / Signature &amp; Company Seal)')+'</div>'
      +'<div style="position:relative;height:110px">'+(review?'<div style="position:absolute;left:50%;top:6px;transform:translateX(-50%);width:104px;height:104px;border:1px dashed #d4d4d4;border-radius:50%"></div>':'')+'</div>'
      +'<div style="font-size:9px;color:#222;border-top:1px solid #111;padding-top:4px">'+INICS_INFO.rep+' – '+INICS_INFO.repTitleEn+'</div>'
      +'<div style="font-weight:700;margin-top:5px">'+(isKo?'공급자 대표 / Supplier':'ĐẠI DIỆN NHÀ CUNG CẤP / Supplier')+'</div>'
    +'</div>'
    +'<div style="flex:1">'
      +'<div style="font-size:8px;color:#777;margin-bottom:2px">'+(isKo?'(서명 및 회사 직인)':'(Ký tên &amp; đóng dấu / Signature &amp; Company Seal)')+'</div>'
      +'<div style="position:relative;height:110px">'+(review?'<div style="position:absolute;left:50%;top:6px;transform:translateX(-50%);width:104px;height:104px;border:1px dashed #d4d4d4;border-radius:50%"></div>':'')+'</div>'
      +'<div style="font-size:9px;color:#222;border-top:1px solid #111;padding-top:4px">'+H(o.buyerRep?((o.buyerGender==='male'?'Ông ':'Bà ')+o.buyerRep):'')+(o.buyerTitle?' – '+H(o.buyerTitle):'')+'</div>'
      +'<div style="font-weight:700;margin-top:5px">'+(isKo?'구매자 대표 / Buyer':'ĐẠI DIỆN BÊN MUA / Buyer')+'</div>'
    +'</div>'
  +'</div>'

  // APPENDIX 1 견적 품목표
  +'<div class="ct-blk ct-page" style="margin-top:26px;page-break-before:always"><div style="text-align:center;font-size:13px;font-weight:800;margin-bottom:10px">APPENDIX 1 – DESCRIPTION OF ORDER INFORMATION</div>'
    +'<table style="width:100%;border-collapse:collapse;font-size:8.5px">'
      +'<thead><tr style="background:#f1f5f9">'
        +['No','Category','Product Name','Image','Size (WxDxH)','Code','Color','Qty','Unit Price<br>(Excl.VAT)','Amount<br>(Excl.VAT)','Remark'].map(function(h){return '<th style="border:1px solid #999;padding:4px">'+h+'</th>';}).join('')
      +'</tr></thead><tbody>'+rows+'</tbody>'
      +'<tfoot style="break-inside:avoid;page-break-inside:avoid">'
        +'<tr><td colspan="9" style="border:1px solid #999;padding:5px;text-align:right;font-weight:700">TOTAL (Excl. VAT)</td><td style="border:1px solid #999;padding:5px;text-align:right;font-weight:700">'+H(fmtN(sub))+'</td><td style="border:1px solid #999"></td></tr>'
        +'<tr style="background:'+(review?'#fff59d':'#f8fafc')+'"><td colspan="9" style="border:1px solid #999;padding:5px;text-align:right">VAT '+H(o.vatRate+'%')+'</td><td style="border:1px solid #999;padding:5px;text-align:right">'+fmtN(vatAmt)+'</td><td style="border:1px solid #999"></td></tr>'
        +'<tr style="background:#eef2ff"><td colspan="9" style="border:1px solid #999;padding:5px;text-align:right;font-weight:800">TOTAL (Incl. VAT)</td><td style="border:1px solid #999;padding:5px;text-align:right;font-weight:800">'+H(fmtN(total))+'</td><td style="border:1px solid #999"></td></tr>'
        +'<tr class="ct-soft"><td colspan="11" style="border:1px solid #999;border-top:none;padding:6px 8px;font-size:8px;color:#555;background:#fbfbfb;line-height:1.5">Currency: '+cur+' &middot; All prices exclusive of taxes unless stated &middot; Prices include delivery and installation fee.</td></tr>'
      +'</tfoot></table>'
  +'</div>'

  +'<div class="ct-blk ct-page" style="margin-top:26px;page-break-before:always"><div style="text-align:center;font-size:13px;font-weight:800;margin-bottom:3px">PHỤ LỤC 2 \u2013 THƯ BẢO HÀNH \u00b7 APPENDIX 2 \u2013 WARRANTY LETTER</div>'
    +'<div style="text-align:center;font-size:9px;color:#666;margin-bottom:10px">INICS VINA CO., LTD' + (o.date?' \u00b7 '+H(o.date):'') + '</div>'
    +'<table style="width:100%;border-collapse:collapse;font-size:9px;line-height:1.55">'
      +'<tr style="background:#f1f5f9;vertical-align:top"><th style="width:50%;border:1px solid #ccc;padding:4px 8px;text-align:left;font-size:8.5px">TIẾNG VIỆT</th><th style="width:50%;border:1px solid #ccc;padding:4px 8px;text-align:left;font-size:8.5px">ENGLISH</th></tr>'
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
  +'</div>'
  +(review?'<div style="margin-top:14px;padding:8px 10px;background:#fffbeb;border:1px solid #fde68a;font-size:9px;color:#92400e;line-height:1.5">🟡 노란색은 프로젝트·견적에서 자동으로 채워진 값입니다. 출력(PDF/인쇄)에는 형광펜·한국어가 빠지고 베트남어·영문만 인쇄됩니다. 조항 문구는 관리자 패널 → 계약서 템플릿에서 수정할 수 있습니다. 실제 사용 전 현지 법무 검토를 권장합니다.</div>':'')
  +'</div>';
}
