/*!
 * INICS v2 · amount.js — 금액 단일 진실 소스 (Single Source of Truth)  schema v1
 * ---------------------------------------------------------------------------
 * 배경 (2026-08-05, MONQ VIETNAM 건에서 발견)
 *   quote.js / contract.js 가 각각 `sub * (1 + vat/100)` 을 반올림 없이 계산 →
 *   199,964,004.48 같은 소수점 VND 가 생기고, 호출부마다 반올림 시점이 달라
 *   견적서와 계약서 총액이 어긋났다.
 *
 * 원칙
 *   1) 견적서(quote)가 금액을 확정한다.            → INICSAmount.freeze(q)
 *   2) 계약서/PR/인보이스는 계산하지 않고 승계한다. → INICSAmount.of(q)
 *   3) 통화 최소단위로 반드시 양자화한다 (VND/KRW 정수). 소수점 VND 금지.
 *   4) 승계값과 재계산값이 어긋나면 조용히 덮지 않고 경고한다.
 *
 * 로드 순서
 *   <script src="js/amount.js"></script>   ← quote.js / contract.js 보다 먼저
 * ---------------------------------------------------------------------------
 */
(function (global) {
  'use strict';

  var DEC = { VND: 0, KRW: 0, JPY: 0, USD: 2, MXN: 2, EUR: 2 };
  var SCHEMA = 1;

  function N(v) {
    if (v === null || v === undefined || v === '') return 0;
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    var n = parseFloat(String(v).replace(/[,\s₫]/g, ''));
    return isFinite(n) ? n : 0;
  }

  function decOf(cur) {
    var d = DEC[String(cur || 'VND').toUpperCase()];
    return d === undefined ? 0 : d;
  }

  /** 통화 최소단위 양자화 (VND → 정수) */
  function q(n, cur) {
    var d = decOf(cur);
    if (d === 0) return Math.round(n);
    var f = Math.pow(10, d);
    return Math.round(n * f) / f;
  }

  /** 허용 편차 (승계 vs 재계산 경고 임계) */
  function tol(cur) { return decOf(cur) === 0 ? 0 : Math.pow(10, -decOf(cur)); }

  /** 견적의 VAT 사양 → {exempt, rate} */
  function rateOf(qt, override) {
    var v = (override !== undefined && override !== null && override !== '')
      ? override
      : (qt ? qt.vat : 8);
    if (v === 'exempt') return { exempt: true, rate: 0 };
    var r = N(v);
    if (r > 0 && r <= 1) r = r * 100;          // 0.08 → 8
    return { exempt: false, rate: r };
  }

  /** 라인 공급가 합계 (저장된 l.amount 기준, 통화 양자화) */
  function linesSub(lines, cur) {
    return (lines || []).reduce(function (s, l) { return s + q(N(l.amount), cur); }, 0);
  }

  /**
   * 정본 계산. 반올림 시점이 여기 한 곳뿐이다.
   *   vatAmt = quantize(sub * rate / 100)
   *   total  = sub + vatAmt          ← total 을 따로 반올림하지 않는다
   */
  function calc(lines, qt, cur, overrideRate) {
    cur = cur || (qt && qt.currency) || 'VND';
    var r = rateOf(qt, overrideRate);
    var sub = linesSub(lines, cur);
    var vatAmt = r.exempt ? 0 : q(sub * r.rate / 100, cur);
    return {
      sub: sub,
      exempt: r.exempt,
      vatRate: r.rate,
      vatAmt: vatAmt,
      total: sub + vatAmt,
      cur: cur,
      items: (lines || []).length
    };
  }

  /**
   * 견적 확정 스냅샷. saveQuote() 에서 호출.
   * force=false 이면 기존 확정값을 보존한다(발행 완료 견적 보호).
   */
  function freeze(qt, force) {
    if (!qt) return null;
    if (!force && qt.amounts && qt.amounts.schema === SCHEMA && qt.amounts.total != null) {
      return qt.amounts;
    }
    var c = calc(qt.lines, qt, qt.currency);
    qt.amounts = {
      schema: SCHEMA,
      sub: c.sub,
      exempt: c.exempt,
      vatRate: c.vatRate,
      vatAmt: c.vatAmt,        // ★ 역산 금지. 저장값이 원본.
      total: c.total,          // ★ 세금계산서·계약서 기준액
      cur: c.cur,
      items: c.items,
      frozenAt: (typeof nowStr === 'function') ? nowStr() : new Date().toISOString()
    };
    return qt.amounts;
  }

  /**
   * 승계 조회. 계약서·PR·인보이스가 호출.
   *   1순위: 견적 확정 스냅샷
   *   2순위: 정본 재계산 (구 견적 fallback)
   * overrideRate 가 견적 VAT와 다르면 재계산하고 overridden=true 로 표시한다.
   */
  function of(qt, overrideRate) {
    if (!qt) return { sub: 0, vatRate: 0, vatAmt: 0, total: 0, cur: 'VND',
                      items: 0, exempt: false, source: 'empty', mismatch: null, overridden: false };

    var a = qt.amounts;
    var wantRate = (overrideRate === undefined || overrideRate === null || overrideRate === '')
      ? null : rateOf(qt, overrideRate);

    if (a && a.schema === SCHEMA && a.total != null) {
      var sameRate = !wantRate || (wantRate.exempt === !!a.exempt &&
                                   Math.abs(wantRate.rate - N(a.vatRate)) < 1e-9);
      if (sameRate) {
        var out = {
          sub: N(a.sub), exempt: !!a.exempt, vatRate: N(a.vatRate),
          vatAmt: N(a.vatAmt), total: N(a.total), cur: a.cur || qt.currency || 'VND',
          items: a.items, frozenAt: a.frozenAt || null,
          source: 'quote', overridden: false, mismatch: null
        };
        // 확정 후 라인이 수정된 경우 감지 — 조용히 덮지 않는다
        var re = calc(qt.lines, qt, out.cur);
        if (re.items && Math.abs(re.total - out.total) > tol(out.cur)) {
          out.mismatch = { frozen: out.total, recalc: re.total,
                           diff: re.total - out.total, reason: 'lines changed after freeze' };
          if (global.console && console.warn) {
            console.warn('[INICS AMOUNT] 견적 확정 후 품목 변경 —',
              qt.quoteNo || qt.id, 'frozen=', out.total, 'recalc=', re.total);
          }
        }
        return out;
      }
      // 계약서에서 VAT율을 다르게 지정한 경우 → 재계산 + 표시
      var ov = calc(qt.lines, qt, a.cur || qt.currency, overrideRate);
      ov.source = 'override';
      ov.overridden = true;
      ov.quoteRate = N(a.vatRate);
      ov.mismatch = null;
      return ov;
    }

    // 구 견적 fallback
    var f = calc(qt.lines, qt, qt.currency, overrideRate);
    f.source = 'recalc';
    f.overridden = false;
    f.mismatch = null;
    return f;
  }

  /** 표기 헬퍼 */
  function fmt(n, cur) {
    var d = decOf(cur);
    return N(n).toLocaleString('en-US',
      { minimumFractionDigits: d, maximumFractionDigits: d });
  }

  /**
   * 계약서 견적 드롭다운 3단 라벨.
   *  기존: "Q-20260728-026 · 185,151,856 · 10품목"        ← 어느 기준인지 모호
   *  변경: "Q-20260728-026 · 공급가 185,151,856 + VAT 14,812,148 = 199,964,004 · 10품목"
   */
  function label(qt) {
    var a = of(qt);
    var no = qt.quoteNo || ('견적#' + (qt.id || ''));
    var cnt = (qt.lines || []).length;
    var vatPart = a.exempt ? '면세' : ('VAT ' + fmt(a.vatAmt, a.cur));
    return no + ' · 공급가 ' + fmt(a.sub, a.cur) + ' + ' + vatPart +
           ' = ' + fmt(a.total, a.cur) + ' · ' + cnt + '품목' + (a.mismatch ? ' ⚠' : '');
  }

  var API = { SCHEMA: SCHEMA, N: N, q: q, tol: tol, rateOf: rateOf,
              linesSub: linesSub, calc: calc, freeze: freeze, of: of,
              fmt: fmt, label: label };

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  global.INICSAmount = API;

})(typeof window !== 'undefined' ? window : globalThis);
