// INICS 복구 + 사고 후 작업 병합 스크립트 (2026-11-03)
// 사용: 1) DRY=true 로 실행 → 결과 확인   2) DRY=false 로 바꿔 다시 실행 → state2 덮어쓰기
(async (DRY = true) => {
  const B = "https://inics-approval-default-rtdb.asia-southeast1.firebasedatabase.app/inics_approval";
  const BASE_SNAP = "snap_1793687888864";   // 사고 직전 (11/3 오후 1:38:08)
  const POST_SNAP = "snap_1793687942690";   // 사고 직후 (11/3 오후 1:39:02, 롤백된 상태)
  const ALT_SNAP  = "snap_1793699448887";   // 오후 4:50 (옛 탭 메모리에서 생성) — 비교용
  const COLLS = ["docs","vendors","vendorRequests","cardExpenses","cardMerchants","products","quotes",
                 "projects","bankTxns","invoices","paymentRequests","tasks","assets","otherProjects"];
  const get = async p => (await (await fetch(B + p, { cache: "no-cache" })).json());
  const J = o => JSON.stringify(o);
  const vals = m => Object.entries(m || {}).filter(([, v]) => v != null);
  const fp = t => [t.acctNo, t.date, +t.debit || 0, +t.credit || 0, +t.balance || 0].join("|");

  const base = (await get("/backups/" + BASE_SNAP + ".json")).data;
  const post = (await get("/backups/" + POST_SNAP + ".json")).data;
  const alt  = (await get("/backups/" + ALT_SNAP + ".json")).data;
  const cur  = await get("/state2.json");
  if (!base || !base.__v || !cur) { console.log("❌ 스냅샷/현재 데이터 읽기 실패 — 중단"); return; }

  // ① 1:38 vs 4:50 차이 (어느 쪽을 기준으로 할지 판단용)
  const altDiff = [];
  for (const c of COLLS) {
    const a = base[c] || {}, b = alt[c] || {};
    let onlyA = 0, onlyB = 0, chg = 0;
    for (const k in a) if (a[k] != null && !(k in b)) onlyA++;
    for (const k in b) if (b[k] != null) { if (!(k in a)) onlyB++; else if (J(a[k]) !== J(b[k])) chg++; }
    if (onlyA || onlyB || chg) altDiff.push({ 컬렉션: c, "1:38에만": onlyA, "4:50에만": onlyB, 내용다름: chg });
  }
  console.log("① 1:38(사고 직전) vs 4:50 스냅샷 차이:"); console.table(altDiff.length ? altDiff : [{ 결과: "동일" }]);

  // ② 사고 후(1:39 → 현재) 새로 입력된 작업을 기준본에 병합
  const out = JSON.parse(J(base));
  const report = [], conflicts = [];
  for (const c of COLLS) {
    const p = post[c] || {}, now = cur[c] || {};
    const changed = vals(now).filter(([k, v]) => !(k in p) || J(p[k]) !== J(v));
    if (!changed.length) continue;
    out[c] = out[c] || {};
    let added = 0, dup = 0, conf = 0;
    if (c === "bankTxns") {
      const seen = new Set(vals(out.bankTxns).map(([, t]) => fp(t)));
      let maxId = Math.max(0, +((out.meta || {}).bankSeq) || 0, ...vals(out.bankTxns).map(([, t]) => +t.id || 0));
      for (const [, t] of changed) {
        if (seen.has(fp(t))) { dup++; continue; }        // 이미 기준본에 있는 거래 (재업로드분)
        const nt = { ...t, id: ++maxId, seq: maxId };   // 사고 후 bankSeq가 0부터 다시 시작 → id 재부여
        out.bankTxns[String(nt.id)] = nt; seen.add(fp(nt)); added++;
      }
      out.meta = out.meta || {}; out.meta.bankSeq = maxId;
    } else {
      for (const [k, v] of changed) {
        if (!(k in out[c]) || out[c][k] == null) { out[c][k] = v; added++; }
        else if (J(out[c][k]) !== J(v)) { conf++; conflicts.push({ 컬렉션: c, key: k, 현재값: v }); }
      }
    }
    report.push({ 컬렉션: c, 사고후변경: changed.length, 병합추가: added, 중복제외: dup, 충돌_수동확인: conf });
  }
  const metaChg = Object.keys(cur.meta || {}).filter(k => J((cur.meta || {})[k]) !== J((post.meta || {})[k]));
  console.log("② 사고 후 입력분 병합 계획:"); console.table(report.length ? report : [{ 결과: "사고 후 변경 없음" }]);
  if (conflicts.length) { console.log("⚠ 충돌(같은 번호, 다른 내용 — 기준본 유지, 아래 항목은 수동 재입력 필요):"); console.table(conflicts.map(x => ({ 컬렉션: x.컬렉션, key: x.key, 요약: J(x.현재값).slice(0, 120) }))); }
  if (metaChg.length) console.log("ℹ 사고 후 바뀐 설정(meta) 키 — 기준본 값으로 돌아감:", metaChg);

  const cnt = t => Object.fromEntries(["docs","projects","invoices","bankTxns"].map(c => [c, vals(t[c]).length]));
  console.log("결과 미리보기:", cnt(out));
  window._inicsRestorePlan = out;
  if (DRY) { console.log("🔎 DRY-RUN — 아직 아무것도 쓰지 않았습니다. 확인 후 마지막 줄 (true) 를 (false) 로 바꿔 다시 실행"); return; }

  // 안전장치: 덮어쓰기 직전 현재 state2를 PC에 내려받아 둔다
  const blob = new Blob([J(cur)], { type: "application/json" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
  a.download = "inics_state2_before_restore_" + Date.now() + ".json"; a.click();
  const r = await fetch(B + "/state2.json", { method: "PUT", headers: { "Content-Type": "application/json" }, body: J(out) });
  console.log(r.ok ? "✅ 복구 완료 — 모든 탭 새로고침" : "❌ 실패 HTTP " + r.status);
})(true);
