/* ════════════════════════════════════════════════════════════
   INICS · bankpay.js — 전자결재 ↔ 은행 명세서 결제완료 자동화 (v1)
   · 은행 명세서에서 문서가 매칭되면(doc.matchTxnId ↔ txn.matchDocId 양방향)
     '결제 중(payment)' 문서를 자동으로 '완료(done)' 처리하고
     실제 은행 결제일·금액·계좌를 문서에 기록
   · 매칭 해제 시 은행대사로 완료된 건(paidVia='bank')만 '결제 중'으로 복귀
     (수동 결제완료 건은 상태를 건드리지 않음)
   · 호출 지점: saveState() 시작부의 BankPay.syncAll(state) 한 곳
     → 은행 매칭/해제, 최종 승인, 거래 삭제 등 모든 경로가 저장 시 자동 반영
   · 중복 방지: 기존 _txnTaken / runDocAutoMatch(양쪽 유일 후보일 때만 확정) 그대로 사용
   ════════════════════════════════════════════════════════════ */
(function(){
  'use strict';

  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function now(){ return (typeof nowStr==='function') ? nowStr() : new Date().toISOString(); }

  // 은행 날짜 "30/09/2026" · "2026-09-30" · "2026.09.30" → 전자결재 표기 "2026.09.30"
  function fmtDate(s){
    s=String(s||'').trim(); var m;
    if((m=/^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s))) return m[3]+'.'+('0'+m[2]).slice(-2)+'.'+('0'+m[1]).slice(-2);
    if((m=/^(\d{4})[-.\/](\d{1,2})[-.\/](\d{1,2})/.exec(s))) return m[1]+'.'+('0'+m[2]).slice(-2)+'.'+('0'+m[3]).slice(-2);
    return s;
  }
  function acct6(a){ return String(a||'').replace(/\D/g,'').slice(-6); }

  // 문서 금액 → cents. 통화별 파싱
  //  · VND/KRW(소수 없음): 모든 구분자 제거 — "750,000" "750.000" "1.020.962.374" "29052000"
  //  · USD/MXN: 마지막 구분자가 소수점(소수 2자리 이하)일 때만 소수로 인정 — "138.89" "1,234.56" "1.234,56"
  function docCents(d){
    var s=String(d&&d.amount||'').trim(); if(!s) return 0;
    var cur=String(d.currency||'').toUpperCase();
    if(cur==='VND'||cur==='KRW') return (Number(s.replace(/[^\d]/g,''))||0)*100;
    var ld=s.lastIndexOf('.'), lc=s.lastIndexOf(','), t;
    if(lc>ld && s.length-lc-1<=2) t=s.replace(/\./g,'').replace(',','.');   // 1.234,56
    else t=s.replace(/,/g,'');                                               // 1,234.56 / 1,234
    return Math.round((parseFloat(t.replace(/[^\d.]/g,''))||0)*100);
  }

  function txnIndex(st){ var m={}; ((st&&st.bankTxns)||[]).forEach(function(t){ m[String(t.id)]=t; }); return m; }
  function linkedTxn(doc, idx){
    if(!doc || doc.matchTxnId==null) return null;
    var t=idx[String(doc.matchTxnId)];
    return (t && String(t.matchDocId)===String(doc.id)) ? t : null;
  }
  function put(o,k,v){ if(o[k]!==v){ o[k]=v; return true; } return false; }
  function drop(o,k){ if(k in o){ delete o[k]; return true; } return false; }

  // ── 핵심: 저장 직전 전체 문서 동기화 (멱등) ──
  function syncAll(st){
    if(!st || !Array.isArray(st.docs)) return {done:0, reverted:0};
    var txns=st.bankTxns||[];
    if(!txns.length) return {done:0, reverted:0};          // 은행 데이터 로딩 전에는 아무것도 하지 않음
    var idx=txnIndex(st), flipped=[], reverted=0;

    st.docs.forEach(function(d){
      if(!d) return;
      if(d.matchTxnId!=null && !idx[String(d.matchTxnId)]) return;   // 참조 거래 미확인 → 보류
      var t=linkedTxn(d, idx);
      if(t){
        put(d,'paidTxnId',t.id);
        put(d,'paidDate',fmtDate(t.date));
        put(d,'paidAmount',+t.debit||0);
        put(d,'paidAcct',acct6(t.acctNo));
        if(d.status==='payment'){
          d.status='done'; d.doneAt=fmtDate(t.date);
          d.paidAt=now(); d.paidBy='BANK · 은행대사'; d.paidVia='bank';
          flipped.push(d);
        }
      } else {
        ['paidTxnId','paidDate','paidAmount','paidAcct'].forEach(function(k){ drop(d,k); });
        if(d.paidVia==='bank' && d.status==='done'){
          d.status='payment'; d.paidAt=null; d.paidBy=null; d.doneAt=null; drop(d,'paidVia');
          reverted++;
        }
      }
    });

    if(flipped.length){
      // 완료 상태로 PDF 재보관 (저장 흐름 밖에서 비동기)
      setTimeout(function(){ flipped.forEach(function(d){ if(typeof _autoArchiveApproval==='function') _autoArchiveApproval(d); }); },0);
    }
    if((flipped.length||reverted) && typeof showToast==='function'){
      setTimeout(function(){
        showToast((flipped.length?('은행대사 결제완료 '+flipped.length+'건'):'')+(flipped.length&&reverted?' · ':'')+(reverted?('결제 중 복귀 '+reverted+'건'):''));
      },300);
    }
    return {done:flipped.length, reverted:reverted};
  }

  function money(cur, n){
    var v=Number(n)||0;
    return esc(cur||'')+' '+v.toLocaleString('en-US',{maximumFractionDigits:2});
  }

  // ── 목록 행 태그 ──
  function rowTag(doc, st){
    if(!doc) return '';
    var t=linkedTxn(doc, txnIndex(st));
    if(t) return '<span style="color:#15803d;font-weight:500"><i class="ti ti-building-bank" style="font-size:10px"></i> '+esc(fmtDate(t.date))+'</span>';
    if(doc.status==='payment') return '<span style="color:var(--text-3)"><i class="ti ti-building-bank" style="font-size:10px"></i> 은행 미대사</span>';
    return '';
  }

  // ── 상세 화면 블록 ──
  function detailHTML(doc, st){
    if(!doc) return '';
    var t=linkedTxn(doc, txnIndex(st));
    var box='margin:10px 0;padding:10px 12px;border-radius:8px;font-size:12px;line-height:1.7;';
    if(t){
      var diff=Math.round((+t.debit||0)*100)-docCents(doc);
      var how=(doc.matchStatus==='auto')?'자동 매칭 · Auto':'수동 매칭 · Manual';
      var via=(doc.paidVia==='bank')?'은행대사로 자동 완료':(doc.paidBy?('수동 완료 · '+esc(doc.paidBy)):'');
      return '<div style="'+box+'background:#f0fdf4;border:1px solid #bbf7d0">'
        +'<div style="font-weight:600;color:#15803d;margin-bottom:4px"><i class="ti ti-building-bank"></i> 은행 결제 확인 · Bank payment</div>'
        +'<div><span style="color:var(--text-3)">결제일 · Date</span> <b>'+esc(fmtDate(t.date))+'</b></div>'
        +'<div><span style="color:var(--text-3)">출금액 · Amount</span> <b>'+money(t.currency||doc.currency,t.debit)+'</b>'
          +(diff?(' <span style="color:var(--danger);font-weight:600">· 기안 금액과 차이 '+money(doc.currency,diff/100)+'</span>'):'')+'</div>'
        +'<div><span style="color:var(--text-3)">계좌 · Account</span> …'+esc(acct6(t.acctNo))+(t.type?(' · '+esc(t.type)):'')+'</div>'
        +(t.note?('<div style="color:var(--text-3);word-break:break-all">'+esc(String(t.note).slice(0,140))+'</div>'):'')
        +'<div style="color:var(--text-3);font-size:11px;margin-top:2px">'+how+(doc.matchedAt?(' · '+esc(doc.matchedAt)):'')+(via?(' · '+via):'')+'</div>'
        +'</div>';
    }
    if(!doc.needPayment || ['pending1','pending2','payment'].indexOf(doc.status)<0) return '';
    var hint='은행 명세서에서 이 문서와 매칭되면 결제일·금액이 표시되고 자동으로 완료 처리됩니다.';
    try{
      if(typeof _docMatchInfo==='function'){
        var info=_docMatchInfo(doc);
        if(info.status==='confident' && info.txn) hint+='<br><b>추천 후보</b>: '+esc(fmtDate(info.txn.date))+' · '+money(info.txn.currency,info.txn.debit)+' · …'+esc(acct6(info.txn.acctNo))+' — 은행 명세서에서 확정하세요.';
        else if(info.status==='review') hint+='<br><b style="color:var(--warning)">동일 금액 후보 '+info.candidates.length+'건</b> — 은행 명세서에서 직접 선택하세요.';
      }
    }catch(e){}
    return '<div style="'+box+'background:var(--surface-2,#f8f8f6);border:1px dashed var(--border)"><i class="ti ti-building-bank"></i> '+hint+'</div>';
  }

  window.BankPay={ syncAll:syncAll, docCents:docCents, fmtDate:fmtDate, rowTag:rowTag, detailHTML:detailHTML, version:1 };
})();
