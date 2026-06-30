/* ════════════════════════════════════════════════════════════
   INICS · sync.js — Firebase 동기화 + 파일 외부화 모듈 (모듈화 1단계)
   · 이 파일만 고치면 동기화 로직 수정 가능. 다른 모듈에 영향 없음.
   · index.html 보다 먼저 <script src> 로 로드되어야 함.
   · 외부 의존성: setSyncStatus (런타임), 브라우저 기본 API
   ════════════════════════════════════════════════════════════ */
(function() {
  // ════════════════════════════════════════════════════════════════
  //  PER-DOCUMENT SYNC LAYER (v2) + FILE EXTERNALIZATION (v3)
  //  · 메모리 state는 배열형 그대로 — 화면 코드 변경 최소
  //  · 저장 시 변경된 항목만 PATCH (동시편집 충돌·삭제 차단)
  //  · 무거운 첨부(docs 이미지/첨부, products 이미지)를 /files/{hash}로
  //    분리 저장하고 본문엔 포인터만 → 초기 로드·동기화에서 바이너리 제외
  //  · 첨부는 화면에서 실제로 볼 때만 그 파일 1개를 지연 로딩
  // ════════════════════════════════════════════════════════════════
  var BASE   = "https://inics-approval-default-rtdb.asia-southeast1.firebasedatabase.app";
  var ROOT   = "/inics_approval";
  var V2     = ROOT + "/state2";
  var FILES  = ROOT + "/files";
  var LEGACY = ROOT + "/state.json";
  function V2URL(p){ return BASE + V2 + (p||""); }
  function FILEURL(h){ return BASE + FILES + "/" + encodeURIComponent(h) + ".json"; }

  var COLLECTIONS = ["docs","vendors","vendorRequests","cardExpenses","cardMerchants",
                     "products","quotes","projects","bankTxns","invoices","paymentRequests","tasks"];
  var _isColl = {}; COLLECTIONS.forEach(function(c){ _isColl[c]=1; });
  // 외부화 대상: 무거운 첨부를 가진 컬렉션만 (나머지 작은 것은 인라인 유지)
  var EXT = { docs:1, products:1 };
  var REF = "\u00A7f\u00A7";        // 포인터 접두사 (§f§)
  var PLACEHOLDER = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=="; // 1px 투명

  // ── 헬퍼 ──
  function _clone(o){ try{ return JSON.parse(JSON.stringify(o)); }catch(_){ return o; } }
  function _eq(a,b){ return JSON.stringify(a)===JSON.stringify(b); }
  function _hash(s){ var h=5381,i=s.length; while(i) h=(h*33)^s.charCodeAt(--i); return (h>>>0).toString(36); }
  function _sanitize(k){ return String(k).replace(/[.#$\[\]\/\s]/g,"_").slice(0,200) || "_"; }
  function _isDataUrl(v){ return typeof v==="string" && v.slice(0,5)==="data:"; }
  function _isRef(v){ return typeof v==="string" && v.slice(0,3)===REF; }
  function _refKey(s){ return _hash(s)+"_"+s.length; }                 // 내용 기반 키(중복 제거)
  function _keyOf(item){
    if(item===null||item===undefined) return null;
    if(typeof item!=="object") return "p_"+_hash(String(item));
    var k=(item.id!=null)?item.id:(item.code!=null)?item.code:(item.no!=null)?item.no:(item.name!=null)?item.name:null;
    if(k===null||k==="") k="h_"+_hash(JSON.stringify(item));
    return _sanitize(k);
  }

  // 한 항목에서 base64를 빼내 포인터로 치환 (files에 {hash:dataURL} 수집). 원본 불변.
  function _canonItem(coll, item, files){
    if(!EXT[coll] || !item || typeof item!=="object") return item;
    var it=_clone(item);
    function ext(v){ if(_isDataUrl(v)){ var h=_refKey(v); if(files) files[h]=v; return REF+h; } return v; }
    if(coll==="docs"){
      if(_isDataUrl(it.descImage)) it.descImage=ext(it.descImage);
      ["draftAtts","payAtts","contractAtts"].forEach(function(f){
        if(Array.isArray(it[f])) it[f].forEach(function(a){ if(a && _isDataUrl(a.data)) a.data=ext(a.data); });
      });
    } else if(coll==="products"){
      if(_isDataUrl(it.image)) it.image=ext(it.image);
    }
    return it;
  }
  // 배열 → {key: 포인터화된 항목} 맵 + 변경항목 식별용. files엔 수집된 파일.
  function _canonMap(coll, arr, files){
    var m={}; if(!Array.isArray(arr)) return m;
    for(var i=0;i<arr.length;i++){ var it=arr[i]; var k=_keyOf(it); if(k===null) continue;
      if(m[k]!==undefined) k=k+"~"+i; m[k]=_canonItem(coll, it, files); }
    return m;
  }
  function _toArr(map){ if(!map||typeof map!=="object") return []; return Object.keys(map).map(function(k){ return map[k]; }).filter(function(x){ return x!=null; }); }

  function _reassemble(tree){
    var st={};
    if(tree && tree.meta) for(var k in tree.meta) st[k]=tree.meta[k];
    for(var i=0;i<COLLECTIONS.length;i++){ var c=COLLECTIONS[i]; st[c]=_toArr(tree && tree[c]); }
    if(st.docs===undefined) st.docs=[];
    return st;
  }
  function _assembleFull(st, files){
    var tree={ __v:2, meta:{} };
    for(var k in st){ if(!_isColl[k]) tree.meta[k]=st[k]; }
    for(var j=0;j<COLLECTIONS.length;j++){ var c=COLLECTIONS[j]; tree[c]=_canonMap(c, st[c], files); }
    return tree;
  }

  window._fbSnapshotFromState = function(st){
    var snap={ meta:{}, colls:{} };
    for(var k in st){ if(!_isColl[k]) snap.meta[k]=_clone(st[k]); }
    for(var j=0;j<COLLECTIONS.length;j++){ var c=COLLECTIONS[j]; snap.colls[c]=_canonMap(c, st[c], null); }
    window._lastSynced = snap;
  };

  // ── 지연 로딩 리졸버 (포인터 → base64) ──
  window._fileCache = {}; window._fileFetching = {};
  window._resolveRef = async function(v){
    if(!_isRef(v)) return v;
    var h=v.slice(3);
    if(window._fileCache[h]!=null) return window._fileCache[h];
    if(!window._fileFetching[h]){
      window._fileFetching[h]=fetch(FILEURL(h),{cache:'force-cache'})
        .then(function(r){ return r.ok?r.json():null; })
        .then(function(d){ if(d!=null) window._fileCache[h]=d; return d; })
        .catch(function(){ return null; });
    }
    return window._fileFetching[h];
  };
  // 동기 렌더용: 즉시 img 태그 반환, 포인터면 placeholder 후 백그라운드 채움
  window._img = function(v, attrs){
    attrs = attrs||"";
    if(v==null || v==="") return "";
    if(_isRef(v)){
      var h=v.slice(3);
      if(window._fileCache[h]!=null) return '<img src="'+window._fileCache[h]+'" '+attrs+'>';
      window._resolveRef(v).then(function(d){ if(d){ var nodes=document.querySelectorAll('img[data-fref="'+h+'"]'); for(var i=0;i<nodes.length;i++) nodes[i].src=d; } });
      return '<img data-fref="'+h+'" src="'+PLACEHOLDER+'" '+attrs+'>';
    }
    return '<img src="'+v+'" '+attrs+'>';
  };

  // ── 저장: 변경 항목만 PATCH + 변경 항목의 새 파일만 업로드 ──
  window._filesWritten = {};
  window._fbSave = async function(state){
    try{ localStorage.setItem("inics_local", JSON.stringify(state)); }catch(_){}
    if(!window._lastSynced){
      try{
        var rr=await fetch(V2URL(".json"),{cache:'no-cache'});
        var dd=rr.ok?await rr.json():null;
        if(dd && dd.__v){ window._fbSnapshotFromState(_reassemble(dd)); }
        else { await _migrate(state); setSyncStatus('ok','Synced · 동기화 완료'); return; }
      }catch(e){ window._fbSnapshotFromState(state); setSyncStatus('error','Sync failed · 오프라인 (local 보관)'); return; }
    }
    var prev=window._lastSynced, writes=[], fileUploads={};
    for(var i=0;i<COLLECTIONS.length;i++){
      var c=COLLECTIONS[i];
      var perKeyFiles={};                                   // key별로 수집(변경분만 업로드하려고)
      var cur={};
      if(Array.isArray(state[c])){
        for(var ii=0;ii<state[c].length;ii++){ var it=state[c][ii]; var kk=_keyOf(it); if(kk===null) continue; if(cur[kk]!==undefined) kk=kk+"~"+ii;
          var fhere={}; cur[kk]=_canonItem(c, it, fhere); perKeyFiles[kk]=fhere; }
      }
      var old=prev.colls[c]||{}, patch={}, ch=false;
      for(var k in cur){ if(!_eq(cur[k],old[k])){ patch[k]=cur[k]; ch=true; if(perKeyFiles[k]) for(var fh in perKeyFiles[k]) fileUploads[fh]=perKeyFiles[k][fh]; } }
      for(var k2 in old){ if(!(k2 in cur)){ patch[k2]=null; ch=true; } }
      if(ch) writes.push({ url:V2URL("/"+c+".json"), body:patch });
    }
    var curMeta={}; for(var mk in state){ if(!_isColl[mk]) curMeta[mk]=state[mk]; }
    var mp={}, mc=false;
    for(var a in curMeta){ if(!_eq(curMeta[a],prev.meta[a])){ mp[a]=curMeta[a]; mc=true; } }
    for(var b in prev.meta){ if(!(b in curMeta)){ mp[b]=null; mc=true; } }
    if(mc) writes.push({ url:V2URL("/meta.json"), body:mp });

    if(!writes.length && !Object.keys(fileUploads).length){ setSyncStatus('ok','Synced · 동기화 완료'); return; }
    try{
      // 1) 새 파일 먼저 업로드 (이미 올린 건 건너뜀)
      for(var fh2 in fileUploads){
        if(window._filesWritten[fh2]) continue;
        var fr=await fetch(FILEURL(fh2),{ method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify(fileUploads[fh2]) });
        if(fr.ok){ window._filesWritten[fh2]=1; window._fileCache[fh2]=fileUploads[fh2]; } else throw new Error("file HTTP "+fr.status);
      }
      // 2) 본문(포인터) 저장
      for(var w=0;w<writes.length;w++){
        var r=await fetch(writes[w].url,{ method:"PATCH", mode:"cors", headers:{"Content-Type":"application/json"}, body:JSON.stringify(writes[w].body) });
        if(!r.ok) throw new Error("HTTP "+r.status);
      }
      window._fbSnapshotFromState(state);
      setSyncStatus('ok','Synced · 동기화 완료');
      _maybeBackup(state);
    }catch(e){
      console.error("Firebase save error:",e);
      setSyncStatus('error','Sync failed · 동기화 실패 (local 보관)');
    }
  };

  // ── 마이그레이션 v1 blob → v2 (최초 1회) ──
  async function _migrate(stateObj){
    var files={};
    var tree=_assembleFull(stateObj, files);
    // 파일 먼저 업로드
    for(var h in files){ try{ var fr=await fetch(FILEURL(h),{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(files[h])}); if(fr.ok){ window._filesWritten[h]=1; window._fileCache[h]=files[h]; } }catch(_){} }
    tree.meta = tree.meta||{}; tree.meta.__files=1;
    var r=await fetch(V2URL(".json"),{ method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify(tree) });
    if(!r.ok) throw new Error("migrate HTTP "+r.status);
    window._fbSnapshotFromState(stateObj);
    console.log("✅ INICS: per-document + 파일 외부화 구조로 전환 완료.");
  }

  // ── 파일 외부화 마이그레이션 (이미 v2지만 base64 인라인인 경우, 백그라운드 1회) ──
  async function _migrateFilesBg(){
    try{
      var flag=await (await fetch(V2URL("/meta/__files.json"),{cache:'no-cache'})).json();
      if(flag) return;                                       // 이미 외부화됨
      console.log("⏳ 파일 외부화 마이그레이션 시작…");
      for(var ci=0; ci<COLLECTIONS.length; ci++){
        var c=COLLECTIONS[ci]; if(!EXT[c]) continue;
        var node=await (await fetch(V2URL("/"+c+".json"),{cache:'no-cache'})).json();
        if(!node) continue;
        var keys=Object.keys(node), patch={}, files={}, changed=false;
        for(var ki=0; ki<keys.length; ki++){ var key=keys[ki]; var item=node[key]; if(item==null) continue;
          var f={}; var clean=_canonItem(c, item, f);
          if(Object.keys(f).length){ patch[key]=clean; for(var h in f) files[h]=f[h]; changed=true; }
        }
        // 파일 업로드
        for(var hh in files){ if(window._filesWritten[hh]) continue; try{ var fr=await fetch(FILEURL(hh),{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(files[hh])}); if(fr.ok){ window._filesWritten[hh]=1; window._fileCache[hh]=files[hh]; } }catch(_){} }
        if(changed){ await fetch(V2URL("/"+c+".json"),{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(patch)}); }
      }
      await fetch(V2URL("/meta/__files.json"),{method:"PUT",headers:{"Content-Type":"application/json"},body:"1"});
      console.log("✅ 파일 외부화 완료 — 다음 로드부터 가벼워집니다.");
    }catch(e){ console.warn("파일 외부화 마이그레이션 보류:",e&&e.message); }
  }

  // ── 로드 ──
  window._fbLoad = async function(){
    try{
      var r=await fetch(V2URL(".json"),{mode:'cors',cache:'no-cache'});
      var data=r.ok?await r.json():null;
      if(data && data.__v){
        var st=_reassemble(data); window._fbSnapshotFromState(st);
        setSyncStatus('ok','Live sync · 실시간 동기화');
        if(!(data.meta && data.meta.__files)) setTimeout(_migrateFilesBg, 2000);   // 외부화 안 됐으면 백그라운드 전환
        return st;
      }
      var lr=await fetch(BASE+LEGACY,{mode:'cors',cache:'no-cache'});
      var legacy=lr.ok?await lr.json():null;
      var base=(legacy && legacy.docs!==undefined)?legacy:{docs:[]};
      try{ await _migrate(base); }catch(e){ console.error("migrate fail",e); window._fbSnapshotFromState(base); }
      setSyncStatus('ok', legacy?'Migrated · 구조 전환 완료':'Connected · Firebase 연결됨');
      return base;
    }catch(e){
      console.error("Firebase load error:",e);
      try{ var s=localStorage.getItem('inics_local'); if(s){ var lo=JSON.parse(s); window._fbSnapshotFromState(lo); setSyncStatus('ok','Local mode · 로컬 모드'); return lo; } }catch(_){}
      return null;
    }
  };

  // ── 실시간 리스너 ──
  window._fbListen = function(cb){
    function deliver(){
      fetch(V2URL(".json"),{cache:'no-cache'})
        .then(function(r){ return r.ok?r.json():null; })
        .then(function(d){ if(d && d.__v) cb(_reassemble(d)); })
        .catch(function(){});
    }
    function startSSE(){
      var es;
      try{ es=new EventSource(V2URL(".json")); }
      catch(e){ console.warn("SSE 미지원 → 30초 폴링",e); return startPoll(); }
      es.addEventListener("put",       function(){ deliver(); setSyncStatus('ok','Live sync · 실시간 동기화'); });
      es.addEventListener("patch",     function(){ deliver(); setSyncStatus('ok','Live sync · 실시간 동기화'); });
      es.addEventListener("keep-alive",function(){ setSyncStatus('ok','Live sync · 실시간 동기화'); });
      es.onerror=function(){ setSyncStatus('error','Reconnecting · 재연결 중'); if(es.readyState===2){ try{es.close();}catch(_){ } setTimeout(startSSE,4000); } };
      window._fbES=es;
    }
    function startPoll(){ window._fbPollId=setInterval(deliver,30000); }
    startSSE();
  };

  // ── 백업 (2시간마다 전체 스냅샷, 30개 순환) — 본문(포인터)만, 파일 제외 ──
  async function _backupTree(tree){
    var ts=Date.now();
    await fetch(BASE+ROOT+"/backups/snap_"+ts+".json",{ method:"PUT", headers:{"Content-Type":"application/json"},
      body:JSON.stringify({_ts:ts,_at:new Date(ts).toISOString(),data:tree}) });
    try{
      var bl=await (await fetch(BASE+ROOT+"/backups.json?shallow=true",{cache:"no-cache"})).json();
      if(bl){ var ks=Object.keys(bl).sort(); while(ks.length>30){ var old=ks.shift(); try{ await fetch(BASE+ROOT+"/backups/"+old+".json",{method:"DELETE"}); }catch(_){ } } }
    }catch(_){}
  }
  async function _maybeBackup(state){
    try{
      var last=parseInt(localStorage.getItem("inics_bk")||"0",10);
      if(Date.now()-last < 2*3600*1000) return;
      localStorage.setItem("inics_bk", String(Date.now()));
      await _backupTree(_assembleFull(state, null));         // 포인터형(가벼움)으로 백업
    }catch(_){}
  }

  // ── 콘솔 복구 도구 ──
  window.inicsListBackups = async function(){
    try{
      var bl=await (await fetch(BASE+ROOT+"/backups.json?shallow=true",{cache:"no-cache"})).json();
      if(!bl){ console.log("백업 없음"); return []; }
      var keys=Object.keys(bl).sort().reverse();
      console.log("📦 백업 "+keys.length+"개 (최신순):");
      keys.forEach(function(k){ var ts=parseInt(k.replace("snap_",""),10); console.log("   "+k+"  ·  "+new Date(ts).toLocaleString()); });
      return keys;
    }catch(e){ console.log("실패:",e.message); return []; }
  };
  window.inicsRestore = async function(snapKey){
    if(!snapKey){ console.log("사용법: inicsRestore('snap_숫자') — 먼저 inicsListBackups()"); return; }
    try{
      var snap=await (await fetch(BASE+ROOT+"/backups/"+snapKey+".json",{cache:"no-cache"})).json();
      if(!snap||!snap.data){ console.log("백업 없음:",snapKey); return; }
      var tree=snap.data; if(tree.__v===undefined) tree=_assembleFull(tree, null);
      var r=await fetch(V2URL(".json"),{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(tree)});
      console.log(r.ok?"✅ 복원 완료 ("+snapKey+") — 새로고침하세요":"❌ 실패 "+r.status);
    }catch(e){ console.log("실패:",e.message); }
  };

  // ── PDF 보관: 생성된 PDF를 Storage(+선택적 Make→Drive)로 업로드 ──
  //   견적·계약 PDF를 만들 때 자동 호출됨. 다운로드는 그대로 진행.
  window.MAKE_PDF_WEBHOOK = "";   // Make.com 웹훅 주소 (Drive 미러링용) — 세팅 후 여기에 입력
  window._archivePdf = async function(blob, folder, filename){
    try{
      var BUCKET="inics-approval.firebasestorage.app";
      var safe=String(filename||"file").replace(/[\/\\:*?"<>|#\[\]]/g,"_").replace(/\s+/g,"_").slice(0,90);
      var ts=new Date().toISOString().slice(0,10);
      var path="PDF/"+folder+"/"+safe+"_"+ts+".pdf";
      var url="https://firebasestorage.googleapis.com/v0/b/"+BUCKET+"/o?name="+encodeURIComponent(path);
      var r=await fetch(url,{method:"POST",headers:{"Content-Type":"application/pdf"},body:blob});
      if(!r.ok) throw new Error("HTTP "+r.status);
      if(window.MAKE_PDF_WEBHOOK){                       // Drive 미러링 (Make 세팅 후 활성)
        try{ var fd=new FormData(); fd.append("file",blob,safe+".pdf"); fd.append("folder",folder); fd.append("filename",safe+"_"+ts+".pdf");
          await fetch(window.MAKE_PDF_WEBHOOK,{method:"POST",body:fd}); }catch(_){}
      }
      if(typeof showToast==='function') showToast("PDF 보관됨 · Storage 저장 ("+folder+")");
      return true;
    }catch(e){ console.warn("PDF 보관 실패:",e&&e.message); if(typeof showToast==='function') showToast("PDF Storage 저장 실패(다운로드는 정상)"); return false; }
  };

  window._firebaseReady = true;
  window._fbInitDone = true;
  if (typeof window._onFirebaseReady === 'function') { window._onFirebaseReady(); }
  else { document.dispatchEvent(new Event("firebaseReady")); }
})();
