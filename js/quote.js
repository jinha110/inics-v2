/* ════════════════════════════════════════════════════════════
   INICS · quote.js 견적서 모듈 — index.html에서 분리 (전역 함수 유지)
   26개 함수 자동 추출 · 공용 헬퍼(qNum·fmtN·_money·state·saveState·
   showToast·getAvatar·getBuyerFromDB 등)는 index.html에 남아 전역 참조
   ════════════════════════════════════════════════════════════ */
function showQuoteApp(){
  var hub=document.getElementById('hubPage'); if(hub) hub.style.display='none';
  var app=document.getElementById('quoteApp'); if(app) app.style.display='block';
  var u=cardCurrentUser();
  var n=document.getElementById('quoteUserName'); if(n&&u) n.textContent=u.name;
  var a=document.getElementById('quoteAvatarChip'); if(a&&u&&typeof getAvatar==='function') a.innerHTML=getAvatar(u.id,'sm');
  populateQuoteProductCodes();
  initQuotePaste();
  if(!document.getElementById('qNo').value) newQuote();
  quoteSwitchTab('build');
  window.scrollTo(0,0);
}

function closeQuoteApp(){ var app=document.getElementById('quoteApp'); if(app) app.style.display='none'; if(typeof showHub==='function') showHub(); }

function styleQuoteTabs(){
  [['qTabBuild','build'],['qTabSaved','saved'],['qTabDb','db']].forEach(function(p){
    var b=document.getElementById(p[0]); if(!b) return; var on=quoteTab===p[1];
    b.style.cssText='background:none;border:none;cursor:pointer;font-family:var(--sans);font-size:13px;font-weight:600;padding:9px 2px;margin-right:18px;color:'+(on?'var(--text)':'var(--text-3)')+';border-bottom:2px solid '+(on?'var(--text)':'transparent')+';margin-bottom:-1px';
  });
}

function quoteSwitchTab(t){
  quoteTab=t;
  document.getElementById('quoteBuildView').style.display = t==='build'?'block':'none';
  document.getElementById('quoteSavedView').style.display = t==='saved'?'block':'none';
  document.getElementById('quoteDbView').style.display = t==='db'?'block':'none';
  styleQuoteTabs();
  if(t==='build'){ populateQuoteProductCodes(); renderQuoteLines(); }
  else if(t==='saved') renderSavedQuotes();
  else if(t==='db'){ renderQuoteDb(); populateQuoteProductCodes(); }
}

function populateQuoteProductCodes(){
  var dl=document.getElementById('quoteProductCodes'); if(dl) dl.innerHTML=(state.products||[]).map(function(p){ return '<option value="'+(p.code||'').replace(/"/g,'&quot;')+'">'+(p.name||'')+' — '+(p.category||'')+'</option>'; }).join('');
  var dc=document.getElementById('quoteCategories'); if(dc) dc.innerHTML=qDistinct(QUOTE_CATEGORIES.concat((state.products||[]).map(function(p){return p.category;}))).map(function(c){ return '<option value="'+qEsc(c)+'">'; }).join('');
  var dn=document.getElementById('quoteProductNames'); if(dn) dn.innerHTML=qDistinct(QUOTE_PRODUCT_NAMES.concat((state.products||[]).map(function(p){return p.name;}))).map(function(c){ return '<option value="'+qEsc(c)+'">'; }).join('');
  var dco=document.getElementById('quoteColors'); if(dco) dco.innerHTML=qDistinct((state.products||[]).map(function(p){return p.colorCode;})).map(function(c){ return '<option value="'+qEsc(c)+'">'; }).join('');
  var dcl=document.getElementById('quoteClients');
  if(dcl){ var names=[]; try{ var vm=(typeof buildVendorMap==='function')?buildVendorMap():{}; names=Object.keys(vm).map(function(k){ return vm[k]; }).filter(function(v){ return v && v.type==='매출처'; }).map(function(v){ return v.name||''; }); }catch(e){} dcl.innerHTML=qDistinct(names).map(function(c){ return '<option value="'+c.replace(/"/g,'&quot;')+'">'; }).join(''); }
}

function renderQuoteDb(){
  var el=document.getElementById('quoteDbList'); if(!el) return;
  var q=((document.getElementById('qDbSearch')||{}).value||'').toLowerCase().trim();
  var list=(state.products||[]).slice().sort(function(a,b){ return (a.code||'').localeCompare(b.code||''); });
  if(q){ var t=q.split(/\s+/); list=list.filter(function(p){ var hay=[p.code,p.name,p.category,p.size,p.colorCode].join(' ').toLowerCase(); return t.every(function(x){ return hay.indexOf(x)>=0; }); }); }
  if(!list.length){ el.innerHTML='<div class="empty-state"><i class="ti ti-database"></i><p>'+(q?'검색 결과 없음':'등록된 제품 없음 · CSV로 일괄 등록하세요')+'</p></div>'; return; }
  el.innerHTML='<div style="font-size:11px;color:var(--text-3);margin-bottom:6px">총 '+list.length+'개 제품</div>'+list.map(function(p){
    var img=p.image?window._img(p.image,'style="width:42px;height:42px;object-fit:cover;border-radius:var(--radius);border:1px solid var(--border)"'):'<div style="width:42px;height:42px;border-radius:var(--radius);background:var(--surface-2);display:flex;align-items:center;justify-content:center;color:var(--text-3)"><i class="ti ti-photo"></i></div>';
    return '<div class="detail-panel" style="margin-bottom:7px"><div style="display:flex;gap:10px;align-items:center;padding:9px 11px">'+img
      +'<div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:700">'+(p.code||'')+' <span style="font-size:11px;color:var(--text-3);font-weight:400">'+(p.name||'')+'</span></div>'
      +'<div style="font-size:11px;color:var(--text-3);margin-top:2px">'+(p.category||'—')+' · '+(p.size||'—')+' · '+(p.colorCode||'—')+'</div>'
      +'<div style="font-size:12px;color:var(--text-2);margin-top:2px">원가 '+(p.currency||'VND')+' '+fmtN(p.cost)+'</div></div>'
      +'<div style="display:flex;gap:5px"><button class="btn btn-outline" style="font-size:10px;padding:3px 8px" onclick="editProduct(\''+(p.code||'').replace(/'/g,"\\'")+'\')"><i class="ti ti-edit"></i></button>'
      +'<button class="btn btn-outline" style="font-size:10px;padding:3px 8px" onclick="deleteProduct(\''+(p.code||'').replace(/'/g,"\\'")+'\')"><i class="ti ti-trash"></i></button></div>'
      +'</div></div>';
  }).join('');
}

function genQuoteNo(){ var d=new Date(); var ymd=''+d.getFullYear()+String(d.getMonth()+1).padStart(2,'0')+String(d.getDate()).padStart(2,'0'); return 'Q-'+ymd+'-'+String((state.quoteSeq||0)+1).padStart(3,'0'); }

function newQuote(){
  editingQuoteId=null; quoteLines=[];
  document.getElementById('qNo').value=genQuoteNo();
  document.getElementById('qClient').value='';
  var d=new Date(); document.getElementById('qDate').value=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  document.getElementById('qValid').value='15';
  document.getElementById('qCurrency').value='VND';
  document.getElementById('qVat').value='8';
  document.getElementById('qNotes').value='Estimated lead time: 7-14 days for Vietnam manufactured products and approximately 30 days for imported items.\nAll prices are exclusive of taxes.\nPrices quoted include delivery and installation fee.';
  populateQuoteProductCodes();
  addQuoteLine();
}

function addQuoteLine(p){
  quoteLines.push({ code:(p&&p.code)||'', category:(p&&p.category)||'', name:(p&&p.name)||'', size:(p&&p.size)||'', colorCode:(p&&p.colorCode)||'', image:(p&&p.image)||'', cost:(p&&p.cost)||'', mode:'margin', margin:'30', price:'', qty:'1', remark:'', vnMade:false });
  renderQuoteLines();
}

function removeQuoteLine(i){ quoteLines.splice(i,1); renderQuoteLines(); }

function handleQuoteLineImage(i,file){
  if(!quoteLines[i]||!file) return;
  if(!/^image\//.test(file.type||'') && !/\.(jpe?g|png|gif|webp|bmp)$/i.test(file.name||'')){ showToast('이미지 파일만 가능 · Images only'); return; }
  var fr=new FileReader();
  fr.onload=function(e){
    var dataUrl=e.target.result, img=new Image();
    img.onload=function(){
      try{ quoteLines[i].image=imgToWhiteSquare(img,500); }catch(err){ quoteLines[i].image=dataUrl; }
      renderQuoteLines();
    };
    img.onerror=function(){ showToast('이 형식은 미리보기가 안 됩니다(HEIC 등). JPG/PNG로 변환하거나 URL을 사용하세요'); };
    img.src=dataUrl;
  };
  fr.onerror=function(){ showToast('파일을 읽을 수 없습니다 · JPG/PNG 또는 URL 사용'); };
  fr.readAsDataURL(file);
}

function initQuotePaste(){
  if(window._qtPasteInit) return; window._qtPasteInit=true;
  document.addEventListener('paste', function(e){
    var app=document.getElementById('quoteApp'); if(!app || app.style.display==='none') return;
    var t=window._imgPasteTarget; if(t===undefined || t===null) return;
    var items=((e.clipboardData||window.clipboardData||{}).items)||[];
    for(var k=0;k<items.length;k++){
      if(items[k].type && items[k].type.indexOf('image/')===0){
        e.preventDefault();
        var blob=items[k].getAsFile();
        var fr=new FileReader(); fr.onload=function(ev){ processImagePasteData(ev.target.result, t); window._imgPasteTarget=null; }; fr.readAsDataURL(blob);
        return;
      }
    }
  });
}

function renderQuoteLines(){
  var box=document.getElementById('quoteLinesBox'); if(!box) return;
  if(!quoteLines.length){ box.innerHTML='<div style="font-size:13px;color:var(--text-3);padding:10px">품목을 추가하세요. · Add an item.</div>'; recalcQuote(); return; }
  var inp='font-size:13px;padding:7px 9px';
  var th='padding:8px 6px;font-size:11px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.03em;text-align:left;white-space:nowrap;border-bottom:2px solid var(--border)';
  var td='padding:6px 6px;border-bottom:1px solid var(--border);vertical-align:top';
  var header='<thead><tr>'
    +'<th style="'+th+'">#</th><th style="'+th+'">Product Code</th><th style="'+th+'">Category</th><th style="'+th+'">Product Name</th><th style="'+th+'">Color</th><th style="'+th+'">Image</th>'
    +'<th style="'+th+'">Size (WxDxH)</th><th style="'+th+'">Qty</th>'
    +'<th style="'+th+'">Cost</th><th style="'+th+'">마진/판가 · Margin/Price</th><th style="'+th+'">Unit Price</th><th style="'+th+'">Amount</th><th style="'+th+'">VN생산</th><th style="'+th+'">Remark</th><th style="'+th+'"></th>'
    +'</tr></thead>';
  var rows=quoteLines.map(function(l,i){
    var thumb = l.image
      ? window._img(l.image,'style="width:64px;height:52px;object-fit:contain;background:#fff;border:1px solid var(--border);border-radius:4px;display:block"')
      : '<label style="display:flex;flex-direction:column;align-items:center;justify-content:center;width:64px;height:52px;border:1px dashed var(--border);border-radius:4px;cursor:pointer;color:var(--text-3)" title="이미지 업로드 · Upload Image"><i class="ti ti-camera" style="font-size:16px"></i><input type="file" accept="image/*" style="display:none" onchange="handleQuoteLineImage('+i+',this.files[0])"></label>';
    var imgCell='<div style="display:flex;flex-direction:column;align-items:center;gap:3px">'+thumb
      +'<div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:center">'
        +(l.image?'<label style="font-size:10px;color:#1d4ed8;cursor:pointer">교체 · Replace<input type="file" accept="image/*" style="display:none" onchange="handleQuoteLineImage('+i+',this.files[0])"></label>':'')
        +'<button onclick="pasteImage('+i+')" style="font-size:10px;border:none;background:none;color:#1d4ed8;cursor:pointer;padding:0">붙여넣기 · Paste</button>'
        +'<button onclick="setQLineImageUrl('+i+')" style="font-size:10px;border:none;background:none;color:#1d4ed8;cursor:pointer;padding:0">URL</button>'
        +(l.image?'<button onclick="clearQLineImage('+i+')" style="font-size:10px;border:none;background:none;color:var(--danger);cursor:pointer;padding:0">제거 · Remove</button>':'')
      +'</div></div>';
    var modeCell='<div style="display:flex;flex-direction:column;gap:4px">'
      +'<select onchange="setQMode('+i+',this.value)" style="width:104px;'+inp+'"><option value="margin"'+(l.mode==='margin'?' selected':'')+'>마진율%(원가)</option><option value="price"'+(l.mode==='price'?' selected':'')+'>확정판가 · Final Price</option></select>'
      +(l.mode==='margin'
        ? '<input type="text" inputmode="decimal" value="'+(l.margin||'')+'" oninput="setQLine('+i+',\'margin\',this.value)" placeholder="%" style="width:104px;'+inp+'">'
        : '<input type="text" inputmode="decimal" value="'+(l.price||'')+'" oninput="setQLine('+i+',\'price\',this.value)" placeholder="판가 · Price" style="width:104px;'+inp+'">')
      +'<div style="font-size:11px;color:var(--text-3);white-space:nowrap">→ 판가 <span id="qmodeunit-'+i+'" style="color:#1d4ed8;font-weight:700"></span></div>'
      +'</div>';
    return '<tr>'
      +'<td style="'+td+';font-weight:700;color:var(--text-2);padding-top:13px;font-size:13px">'+(i+1)+'</td>'
      +'<td style="'+td+'"><input list="quoteProductCodes" value="'+(l.code||'').replace(/"/g,'&quot;')+'" onchange="setQCode('+i+',this.value)" placeholder="Code" style="width:130px;'+inp+';font-weight:600"></td>'
      +'<td style="'+td+'"><input list="quoteCategories" value="'+(l.category||'').replace(/"/g,'&quot;')+'" oninput="setQLine('+i+',\'category\',this.value)" placeholder="Category" style="width:150px;'+inp+'"></td>'
      +'<td style="'+td+'"><input list="quoteProductNames" value="'+(l.name||'').replace(/"/g,'&quot;')+'" oninput="setQLine('+i+',\'name\',this.value)" onchange="setQName('+i+',this.value)" placeholder="Product Name" style="width:190px;'+inp+'"></td>'
      +'<td style="'+td+'"><input list="quoteColors" value="'+(l.colorCode||'').replace(/"/g,'&quot;')+'" oninput="setQLine('+i+',\'colorCode\',this.value)" onchange="setQColor('+i+',this.value)" placeholder="Color" style="width:95px;'+inp+'"></td>'
      +'<td style="'+td+';text-align:center">'+imgCell+'</td>'
      +'<td style="'+td+'"><input type="text" value="'+(l.size||'').replace(/"/g,'&quot;')+'" oninput="setQLine('+i+',\'size\',this.value)" placeholder="WxDxH" style="width:135px;'+inp+'"></td>'
      +'<td style="'+td+'"><input type="text" inputmode="numeric" value="'+(l.qty||'')+'" oninput="setQLine('+i+',\'qty\',this.value)" style="width:56px;'+inp+'"></td>'
      +'<td style="'+td+'"><input type="text" inputmode="decimal" value="'+(l.cost||'')+'" oninput="setQLine('+i+',\'cost\',this.value)" placeholder="원가 · Cost" style="width:118px;'+inp+'"></td>'
      +'<td style="'+td+'">'+modeCell+'</td>'
      +'<td style="'+td+';text-align:right;font-size:13px;padding-top:13px"><span id="qunit-'+i+'" style="font-weight:600"></span></td>'
      +'<td style="'+td+';text-align:right;font-size:13px;font-weight:700;padding-top:13px"><span id="qamt-'+i+'"></span></td>'
      +'<td style="'+td+';text-align:center;padding-top:13px"><input type="checkbox" '+(l.vnMade?'checked':'')+' onchange="setQVN('+i+',this.checked)" style="width:17px;height:17px;cursor:pointer" title="베트남 생산 · Made in Vietnam"></td>'
      +'<td style="'+td+'"><input type="text" value="'+(l.remark||'').replace(/"/g,'&quot;')+'" oninput="setQLine('+i+',\'remark\',this.value)" placeholder="Remark" style="width:140px;'+inp+'"></td>'
      +'<td style="'+td+';padding-top:11px"><button class="btn btn-outline" style="font-size:12px;padding:5px 8px" onclick="removeQuoteLine('+i+')"><i class="ti ti-x"></i></button></td>'
      +'</tr>';
  }).join('');
  box.innerHTML='<table style="border-collapse:collapse;min-width:1480px;width:100%">'+header+'<tbody>'+rows+'</tbody></table>';
  recalcQuote();
}

function recalcQuote(){
  var cur=(document.getElementById('qCurrency')||{}).value||'VND';
  var sub=0, costTot=0;
  quoteLines.forEach(function(l,i){
    var u=lineUnit(l), qty=qNum(l.qty||0), amt=u*qty;
    sub+=amt; costTot+=qNum(l.cost)*qty;
    var us=document.getElementById('qunit-'+i); if(us) us.textContent=fmtN(u);
    var mu=document.getElementById('qmodeunit-'+i); if(mu) mu.textContent=fmtN(u);
    var as=document.getElementById('qamt-'+i); if(as) as.textContent=fmtN(amt);
  });
  var vraw=(document.getElementById('qVat')||{}).value||'8';
  var exempt=(vraw==='exempt'), vat=exempt?0:qNum(vraw);
  var vatAmt=exempt?0:sub*vat/100, total=sub+vatAmt, margin=sub-costTot, mpct=sub>0?(margin/sub*100):0;
  var el=document.getElementById('quoteTotals'); if(!el) return;
  el.innerHTML='<div style="border:1px solid var(--border);border-radius:var(--radius-lg);padding:14px;background:var(--surface)">'
    +'<div style="display:flex;justify-content:space-between;font-size:13px;padding:3px 0"><span style="color:var(--text-2)">TOTAL (Excl. VAT)</span><span style="font-weight:700">'+cur+' '+fmtN(sub)+'</span></div>'
    +(exempt
        ? '<div style="display:flex;justify-content:space-between;font-size:12px;padding:3px 0;color:var(--text-2)"><span>VAT</span><span>Exempt · 면세</span></div>'
        : (vat>0?'<div style="display:flex;justify-content:space-between;font-size:12px;padding:3px 0;color:var(--text-2)"><span>VAT '+vat+'%</span><span>'+cur+' '+fmtN(vatAmt)+'</span></div><div style="display:flex;justify-content:space-between;font-size:14px;padding:3px 0;border-top:1px solid var(--border);margin-top:3px"><span style="font-weight:700">TOTAL (Incl. VAT)</span><span style="font-weight:800">'+cur+' '+fmtN(total)+'</span></div>':''))
    +'<div style="display:flex;justify-content:space-between;font-size:11px;padding:6px 0 0;color:var(--text-3);border-top:1px dashed var(--border);margin-top:6px"><span>원가 합계 '+cur+' '+fmtN(costTot)+'</span><span>마진 '+cur+' '+fmtN(margin)+' ('+mpct.toFixed(1)+'%)</span></div>'
    +'</div>';
}

function collectQuote(){
  var vraw=document.getElementById('qVat').value;
  return {
    id: editingQuoteId,
    quoteNo: document.getElementById('qNo').value,
    client: document.getElementById('qClient').value,
    date: document.getElementById('qDate').value,
    validDays: qNum(document.getElementById('qValid').value),
    currency: document.getElementById('qCurrency').value,
    vat: (vraw==='exempt')?'exempt':qNum(vraw),
    notes: document.getElementById('qNotes').value,
    lines: quoteLines.map(function(l){ var u=lineUnit(l), qty=qNum(l.qty); return Object.assign({}, l, {unitPrice:Math.round(u), amount:Math.round(u*qty)}); })
  };
}

function saveQuote(){
  var q=collectQuote();
  if(!q.lines.length || !q.lines.some(function(l){ return l.name||l.code; })){ showToast('품목을 입력하세요 · Enter item'); return; }
  if(!state.quotes) state.quotes=[];
  var u=cardCurrentUser(); q.preparedBy=u?u.name:'';
  // 자동 DB화: 제품 → 제품 DB, 고객사 → 거래처 DB
  q.lines.forEach(function(l){ upsertProductFromLine(l, q.currency); });
  ensureVendor(q.client);
  if(editingQuoteId){ var idx=state.quotes.findIndex(function(x){ return x.id===editingQuoteId; }); if(idx>=0){ q.createdAt=state.quotes[idx].createdAt; q.updatedAt=nowStr(); state.quotes[idx]=q; } }
  else { q.id=(state.quoteSeq=(state.quoteSeq||0)+1); q.quoteNo=document.getElementById('qNo').value; q.createdAt=nowStr(); editingQuoteId=q.id; state.quotes.push(q); }
  saveState(); populateQuoteProductCodes(); showToast('견적 저장 · 제품/고객 DB 반영 완료'); renderSavedQuotes();
}

function renderSavedQuotes(){
  var el=document.getElementById('quoteSavedList'); if(!el) return;
  var q=((document.getElementById('qSavedSearch')||{}).value||'').toLowerCase().trim();
  var list=(state.quotes||[]).slice().sort(function(a,b){ return (b.createdAt||'').localeCompare(a.createdAt||''); });
  if(q){ var t=q.split(/\s+/); list=list.filter(function(x){ var hay=[x.quoteNo,x.client,x.date].join(' ').toLowerCase(); return t.every(function(k){ return hay.indexOf(k)>=0; }); }); }
  if(!list.length){ el.innerHTML='<div class="empty-state"><i class="ti ti-folder"></i><p>저장된 견적 없음 · No saved quotes</p></div>'; return; }
  var th='font-size:11px;color:var(--text-3);font-weight:600;text-align:left;padding:8px 10px;border-bottom:1px solid var(--border);white-space:nowrap';
  var td='font-size:12px;padding:8px 10px;border-bottom:1px solid var(--border);vertical-align:middle';
  var rows=list.map(function(x){
    var tot=(x.lines||[]).reduce(function(s,l){ return s+qNum(l.amount); },0);
    var vatLbl=(x.vat==='exempt')?'면세':(x.vat!=null?('VAT '+x.vat+'%'):'');
    return '<tr>'
      +'<td style="'+td+';white-space:nowrap;color:var(--text-2)">'+(x.date||'—')+'</td>'
      +'<td style="'+td+';font-family:var(--mono);white-space:nowrap">'+(x.quoteNo||'—')+'</td>'
      +'<td style="'+td+';font-weight:600">'+(x.client||'—')+'</td>'
      +'<td style="'+td+';text-align:center;color:var(--text-2)">'+((x.lines||[]).length)+'</td>'
      +'<td style="'+td+';text-align:right;white-space:nowrap;font-weight:700">'+(x.currency||'')+' '+fmtN(tot)+(vatLbl?(' <span style="font-size:10px;color:var(--text-3);font-weight:400">'+vatLbl+'</span>'):'')+'</td>'
      +'<td style="'+td+';text-align:right;white-space:nowrap">'
        +'<button class="btn btn-outline" style="font-size:10px;padding:3px 8px" onclick="loadQuote('+x.id+')"><i class="ti ti-edit"></i> 열기 · Open</button> '
        +'<button class="btn btn-outline" style="font-size:10px;padding:3px 8px" onclick="loadQuote('+x.id+',true)"><i class="ti ti-file-type-pdf"></i> PDF</button> '
        +'<button class="btn btn-outline" style="font-size:10px;padding:3px 8px" onclick="deleteQuote('+x.id+')"><i class="ti ti-trash"></i></button>'
      +'</td>'
      +'</tr>';
  }).join('');
  el.innerHTML='<div style="overflow-x:auto;border:1px solid var(--border);border-radius:var(--radius)">'
    +'<table style="width:100%;border-collapse:collapse;min-width:640px">'
    +'<thead><tr>'
      +'<th style="'+th+'">날짜 · Date</th>'
      +'<th style="'+th+'">견적번호 · No.</th>'
      +'<th style="'+th+'">고객사 · Client</th>'
      +'<th style="'+th+';text-align:center">품목 · Items</th>'
      +'<th style="'+th+';text-align:right">합계 · Total</th>'
      +'<th style="'+th+';text-align:right">작업 · Actions</th>'
    +'</tr></thead><tbody>'+rows+'</tbody></table></div>'
    +'<div style="font-size:11px;color:var(--text-3);margin-top:8px">총 '+list.length+'건 · '+list.length+' quotes</div>';
}

function loadQuote(id, pdf){
  var x=(state.quotes||[]).find(function(e){ return e.id===id; }); if(!x) return;
  editingQuoteId=x.id;
  document.getElementById('qNo').value=x.quoteNo||''; document.getElementById('qClient').value=x.client||'';
  document.getElementById('qDate').value=x.date||''; document.getElementById('qValid').value=(x.validDays!=null?x.validDays:'');
  document.getElementById('qCurrency').value=x.currency||'VND'; document.getElementById('qVat').value=(x.vat==='exempt'?'exempt':String(x.vat!=null?x.vat:'8'));
  document.getElementById('qNotes').value=x.notes||'';
  quoteLines=(x.lines||[]).map(function(l){ return Object.assign({}, l); });
  quoteSwitchTab('build'); renderQuoteLines();
  if(pdf) setTimeout(exportQuotePdf,150);
}

function openRelatedQuote(id){ showQuoteApp(); loadQuote(id); }

function deleteQuote(id){ if(!confirm('견적을 삭제할까요? · Delete this quote?')) return; state.quotes=(state.quotes||[]).filter(function(x){ return x.id!==id; }); saveState(); renderSavedQuotes(); showToast('삭제 완료 · Deleted'); }

function buildQuoteHtml(q){
  var cur=q.currency||'VND';
  var sub=(q.lines||[]).reduce(function(s,l){ return s+qNum(l.amount); },0);
  var qExempt=(q.vat==='exempt'); var qVatPct=qExempt?0:qNum(q.vat);
  var vatAmt=qExempt?0:sub*qVatPct/100, total=sub+vatAmt;
  var rows=(q.lines||[]).map(function(l,i){
    var img=l.image?window._img(l.image,'style="max-width:74px;max-height:60px;object-fit:contain;background:#fff"'):'';
    return '<tr>'
      +'<td style="text-align:center">'+(i+1)+'</td>'
      +'<td>'+(l.category||'')+'</td>'
      +'<td>'+(l.name||'')+'</td>'
      +'<td style="text-align:center">'+img+'</td>'
      +'<td style="text-align:center">'+(l.size||'')+'</td>'
      +'<td style="text-align:center">'+(l.code||'')+'</td>'
      +'<td style="text-align:center">'+(l.colorCode||'')+'</td>'
      +'<td style="text-align:center">'+fmtN(l.qty)+'</td>'
      +'<td style="text-align:right">'+fmtN(l.unitPrice)+'</td>'
      +'<td style="text-align:right">'+fmtN(l.amount)+'</td>'
      +'<td>'+(l.remark||'')+'</td>'
      +'</tr>';
  }).join('');
  var th='padding:5px 4px;border:1px solid #bbb;background:#f3f4f6;font-size:8.5px;font-weight:700;color:#333';
  var notesHtml=(q.notes||'').split(/\n/).map(function(n){ return n.trim()?'<div>'+n+'</div>':''; }).join('');
  return '<div style="font-family:Arial,Helvetica,sans-serif;color:#1a1a18;padding:22px 20px">'
    +'<div style="display:flex;justify-content:space-between;align-items:center;border:1px solid #999;padding:10px 12px">'
      +(QUOTE_LOGO_IMG?'<img src="'+QUOTE_LOGO_IMG+'" style="height:34px;object-fit:contain;display:block">':'<div style="display:flex;align-items:center;gap:9px">'+'<div style="width:6px;height:34px;background:#1d4ed8;border-radius:2px"></div>'+'<div><div style="font-size:22px;font-weight:800;letter-spacing:1.5px;color:#1a1a18;line-height:1">INICS</div>'+'<div style="font-size:7.5px;color:#666;letter-spacing:.5px;margin-top:3px">VINA · Authorized FURSYS Dealer</div></div>'+'</div>')
      +'<div style="font-size:20px;font-weight:700;color:#6b7280;letter-spacing:2px;text-align:center;flex:1">QUOTATION</div>'
      +'<div style="font-size:9px;text-align:right;color:#444"><div><b>No</b> '+(q.quoteNo||'')+'</div><div><b>Date</b> '+(q.date||'')+'</div><div><b>'+(validText(q.validDays)||'')+'</b></div></div>'
    +'</div>'
    +'<div style="border:1px solid #999;border-top:none;padding:7px 12px;font-size:10px"><b>Client:</b> '+(q.client||'')+'</div>'
    +'<table style="width:100%;border-collapse:collapse;margin-top:8px;font-size:9px">'
      +'<thead><tr>'
        +'<th style="'+th+';width:22px">No</th><th style="'+th+'">Category</th><th style="'+th+'">Product Name</th><th style="'+th+';width:80px">Image</th>'
        +'<th style="'+th+'">Size (WxDxH)</th><th style="'+th+'">Product Code</th><th style="'+th+'">Color CODE</th><th style="'+th+';width:28px">Qty</th>'
        +'<th style="'+th+'">Unit Price<br>(before VAT)</th><th style="'+th+'">Amount<br>(before VAT)</th><th style="'+th+'">REMARK</th>'
      +'</tr></thead>'
      +'<tbody style="font-size:8.5px">'+rows.replace(/<td /g,'<td style="border:1px solid #ccc;padding:5px 4px;vertical-align:middle" ').replace(/<td>/g,'<td style="border:1px solid #ccc;padding:5px 4px;vertical-align:middle">')+'</tbody>'
      +'<tfoot><tr><td colspan="9" style="border:1px solid #bbb;padding:6px;text-align:right;font-weight:800;background:#f3f4f6">TOTAL (Excl. VAT)</td><td style="border:1px solid #bbb;padding:6px;text-align:right;font-weight:800;background:#f3f4f6">'+fmtN(sub)+'</td><td style="border:1px solid #bbb;background:#f3f4f6"></td></tr>'
      +(qExempt
         ? '<tr><td colspan="9" style="border:1px solid #ccc;padding:5px;text-align:right">VAT</td><td colspan="2" style="border:1px solid #ccc;padding:5px;text-align:right">Exempt</td></tr>'
         : (qVatPct>0?'<tr><td colspan="9" style="border:1px solid #ccc;padding:5px;text-align:right">VAT '+qVatPct+'%</td><td style="border:1px solid #ccc;padding:5px;text-align:right">'+fmtN(vatAmt)+'</td><td style="border:1px solid #ccc"></td></tr><tr><td colspan="9" style="border:1px solid #bbb;padding:6px;text-align:right;font-weight:800;background:#eef2ff">TOTAL (Incl. VAT)</td><td style="border:1px solid #bbb;padding:6px;text-align:right;font-weight:800;background:#eef2ff">'+fmtN(total)+'</td><td style="border:1px solid #bbb;background:#eef2ff"></td></tr>':''))
      +'</tfoot>'
    +'</table>'
    +'<div style="margin-top:10px;font-size:8px;color:#555;line-height:1.5">'+notesHtml+'</div>'
    +'<div style="margin-top:6px;font-size:8px;color:#999;text-align:right">Currency: '+cur+(q.preparedBy?(' · Prepared by '+q.preparedBy):'')+'</div>'
    +'</div>';
}

function previewQuote(){
  var q=collectQuote();
  if(!q.lines.length || !q.lines.some(function(l){ return l.name||l.code; })){ showToast('품목을 추가하세요 · Add an item'); return; }
  var ov=document.getElementById('quotePreviewModal');
  if(!ov){ ov=document.createElement('div'); ov.id='quotePreviewModal'; ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9998;display:flex;align-items:flex-start;justify-content:center;padding:18px;overflow:auto'; ov.onclick=function(e){ if(e.target===ov){ ov.style.display='none'; ov.innerHTML=''; } }; document.body.appendChild(ov); }
  ov.innerHTML='<div style="background:#fff;border-radius:8px;max-width:840px;width:100%;margin:auto" onclick="event.stopPropagation()">'
    +'<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-bottom:1px solid #eee;position:sticky;top:0;background:#fff;border-radius:8px 8px 0 0">'
      +'<div style="font-size:14px;font-weight:700">PDF 미리보기 · Preview <span style="font-size:11px;color:#888;font-weight:400">(원가·마진 미표시)</span></div>'
      +'<div style="display:flex;gap:6px"><button class="btn btn-dark" style="font-size:12px;padding:6px 12px" onclick="exportQuotePdf()"><i class="ti ti-file-type-pdf"></i> PDF 저장</button>'
      +'<button class="btn btn-outline" style="font-size:12px;padding:6px 12px" onclick="document.getElementById(\'quotePreviewModal\').style.display=\'none\'">닫기 · Close</button></div>'
    +'</div>'
    +'<div style="padding:12px;background:#f3f4f6">'+buildQuoteHtml(q)+'</div>'
    +'</div>';
  ov.style.display='flex';
}

async function _quoteResolveImgs(q){
  if(!window._resolveRef) return;
  var ls=(q&&q.lines)||[];
  try{ await Promise.all(ls.map(function(l){ return (l&&typeof l.image==='string'&&l.image.indexOf('\u00A7f\u00A7')===0)?window._resolveRef(l.image):null; })); }catch(_){}
}

function exportQuotePdf(){
  if(typeof html2canvas==='undefined' || !window.jspdf){ showToast('PDF 모듈 로드 실패(네트워크 확인)'); return; }
  var q=collectQuote();
  if(!q.lines.length){ showToast('품목을 추가하세요 · Add an item'); return; }
  var area=document.getElementById('quotePrintArea');
  showToast('PDF 생성 중…');
  _quoteResolveImgs(q).then(function(){
  area.innerHTML=buildQuoteHtml(q);
  setTimeout(function(){
    html2canvas(area,{scale:2,backgroundColor:'#ffffff',useCORS:true}).then(function(canvas){
      var img=canvas.toDataURL('image/jpeg',0.92);
      var pdf=new window.jspdf.jsPDF('p','mm','a4');
      var pw=210, ph=297, iw=pw, ih=canvas.height*pw/canvas.width, hLeft=ih, pos=0;
      pdf.addImage(img,'JPEG',0,pos,iw,ih); hLeft-=ph;
      while(hLeft>0){ pos=hLeft-ih; pdf.addPage(); pdf.addImage(img,'JPEG',0,pos,iw,ih); hLeft-=ph; }
      var _qf=(q.quoteNo||'quotation')+(q.client?('_'+q.client.replace(/[^a-zA-Z0-9]/g,'')):'');
      if(window._archivePdf){ try{ window._archivePdf(pdf.output('blob'), '견적서', _qf); }catch(_){ } }
      pdf.save(_qf+'.pdf');
      area.innerHTML=''; showToast('PDF 저장 완료 · Saved');
    }).catch(function(e){ area.innerHTML=''; showToast('PDF 생성 실패'); });
  },100);
  });
}

function _projQuotesC(p){ return (state.quotes||[]).filter(function(q){return (q.client||'').toLowerCase()===((p&&p.client)||'').toLowerCase();}).sort(function(a,b){return (b.createdAt||'').localeCompare(a.createdAt||'');}); }

function renderProjLinkedQuotes(client){
  var box=document.getElementById('projLinkedQuotes'); if(!box) return;
  client=(client||'').trim();
  var qs = client ? (state.quotes||[]).filter(function(q){ return (q.client||'').toLowerCase()===client.toLowerCase(); }) : [];
  if(!qs.length){ box.innerHTML=''; return; }
  qs.sort(function(a,b){ return (b.date||'').localeCompare(a.date||''); });
  box.innerHTML='<div class="form-card-title" style="margin-bottom:6px;color:var(--text-2)"><i class="ti ti-file-invoice"></i> 연결 견적서 · Linked Quotes ('+qs.length+')</div>'
    + qs.map(function(q){
        var tot=(q.lines||[]).reduce(function(s,l){ return s+qNum(l.amount); },0);
        return '<a href="javascript:void(0)" onclick="closeProjectForm();openRelatedQuote('+q.id+')" style="display:flex;align-items:center;gap:6px;text-decoration:none;color:var(--text);font-size:12px;padding:5px 0;border-bottom:1px solid var(--border)">'
          +'<i class="ti ti-file-invoice" style="color:#4338ca"></i><span class="docno">'+(q.quoteNo||('Q-'+q.id))+'</span> '
          +'<span style="flex:1">'+(q.date||'')+'</span><span style="font-weight:600">'+(q.currency||'')+' '+fmtN(tot)+'</span></a>';
      }).join('');
}
