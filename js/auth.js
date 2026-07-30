/* ════════════════════════════════════════════════════════════
   INICS · auth.js — Firebase 인증 토큰 주입 셸 (RTDB 잠금용)
   · 반드시 sync.js 보다 먼저 <script src> 로 로드할 것.
   · window.fetch / window.EventSource 를 감싸서 RTDB 요청에만
     ?auth=<idToken> 을 자동으로 붙인다. 다른 모듈 코드 수정 불필요.
   · 대상: sync.js, chasan.js, hr.js, hr-pay-att.js,
           hr-payroll-history.js, sourcing.html
   ════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  // ── 설정 ──────────────────────────────────────────────────
  // Firebase Console → 프로젝트 설정(⚙) → 일반 → 웹 API 키
  var API_KEY = "AIzaSyDU8DTaqZuG1CZTO6TJprqq7NV9WrAjzio";

  var RTDB_HOST = "inics-approval-default-rtdb.asia-southeast1.firebasedatabase.app";
  var LS_KEY = "inics_auth_v1";
  var SKEW_MS = 5 * 60 * 1000; // 만료 5분 전이면 미리 갱신

  var IDP = "https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=" + API_KEY;
  var REFRESH = "https://securetoken.googleapis.com/v1/token?key=" + API_KEY;

  var _fetch = window.fetch.bind(window);
  var _ES = window.EventSource;

  // ── 토큰 저장소 ───────────────────────────────────────────
  function load() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || "null"); } catch (_) { return null; }
  }
  function save(t) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(t)); } catch (_) {}
  }
  function fresh(t) {
    return !!(t && t.idToken && t.exp && (t.exp - Date.now() > SKEW_MS));
  }

  var _tok = load();
  var _inflight = null;

  function signUpAnon() {
    return _fetch(IDP, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ returnSecureToken: true })
    }).then(function (r) {
      if (!r.ok) return r.text().then(function (t) { throw new Error("signUp " + r.status + " " + t); });
      return r.json();
    }).then(function (d) {
      return {
        idToken: d.idToken,
        refreshToken: d.refreshToken,
        uid: d.localId,
        exp: Date.now() + (parseInt(d.expiresIn, 10) || 3600) * 1000
      };
    });
  }

  function refreshTok(rt) {
    return _fetch(REFRESH, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "grant_type=refresh_token&refresh_token=" + encodeURIComponent(rt)
    }).then(function (r) {
      if (!r.ok) throw new Error("refresh " + r.status);
      return r.json();
    }).then(function (d) {
      return {
        idToken: d.id_token,
        refreshToken: d.refresh_token,
        uid: d.user_id,
        exp: Date.now() + (parseInt(d.expires_in, 10) || 3600) * 1000
      };
    });
  }

  // 항상 유효한 토큰을 돌려주는 단일 진입점 (동시 호출은 1건으로 합침)
  function token(force) {
    if (!force && fresh(_tok)) return Promise.resolve(_tok.idToken);
    if (_inflight) return _inflight;

    var p;
    if (_tok && _tok.refreshToken) {
      p = refreshTok(_tok.refreshToken).catch(function () { return signUpAnon(); });
    } else {
      p = signUpAnon();
    }

    _inflight = p.then(function (t) {
      _tok = t; save(t); _inflight = null;
      return t.idToken;
    }).catch(function (e) {
      _inflight = null;
      console.error("[auth] 토큰 획득 실패:", e && e.message);
      throw e;
    });
    return _inflight;
  }

  function withAuth(url, tk) {
    return url + (url.indexOf("?") >= 0 ? "&" : "?") + "auth=" + encodeURIComponent(tk);
  }
  function isRTDB(url) {
    return typeof url === "string" && url.indexOf(RTDB_HOST) >= 0 && url.indexOf("auth=") < 0;
  }

  // ── fetch 래핑 ────────────────────────────────────────────
  window.fetch = function (input, init) {
    var url = (typeof input === "string") ? input : (input && input.url) || "";
    if (!isRTDB(url)) return _fetch(input, init);

    return token(false).then(function (tk) {
      var u = withAuth(url, tk);
      var req = (typeof input === "string") ? u : new Request(u, input);
      return _fetch(req, init).then(function (res) {
        // 토큰 만료/무효면 1회만 강제 갱신 후 재시도
        if (res.status !== 401 && res.status !== 403) return res;
        return token(true).then(function (tk2) {
          var u2 = withAuth(url, tk2);
          return _fetch((typeof input === "string") ? u2 : new Request(u2, input), init);
        });
      });
    }).catch(function (e) {
      console.error("[auth] RTDB 요청 차단됨:", e && e.message);
      return new Response(null, { status: 401, statusText: "auth failed" });
    });
  };

  // ── EventSource 래핑 (SSE 는 헤더를 못 실으므로 쿼리로) ──
  // 토큰이 아직 없을 수 있으므로 프록시 객체를 먼저 돌려주고,
  // 토큰 확보 후 실제 EventSource 를 만들어 핸들러를 이관한다.
  function ESProxy(url, cfg) {
    var self = this, real = null, queued = [], closed = false;
    self.url = url;
    self.readyState = 0;
    self.onopen = null; self.onmessage = null; self.onerror = null;

    self.addEventListener = function (t, h, o) {
      if (real) real.addEventListener(t, h, o); else queued.push([t, h, o]);
    };
    self.removeEventListener = function (t, h, o) {
      if (real) real.removeEventListener(t, h, o);
      else queued = queued.filter(function (q) { return !(q[0] === t && q[1] === h); });
    };
    self.close = function () {
      closed = true; self.readyState = 2;
      if (real) { try { real.close(); } catch (_) {} }
    };

    token(false).then(function (tk) {
      if (closed) return;
      real = new _ES(withAuth(url, tk), cfg);
      queued.forEach(function (q) { real.addEventListener(q[0], q[1], q[2]); });
      queued = [];
      ["onopen", "onmessage", "onerror"].forEach(function (k) {
        real[k] = function (ev) {
          self.readyState = real.readyState;
          if (typeof self[k] === "function") self[k].call(self, ev);
        };
      });
      self.readyState = real.readyState;
    }).catch(function () {
      self.readyState = 2;
      if (typeof self.onerror === "function") self.onerror({ type: "error", authFailed: true });
    });
  }
  ESProxy.CONNECTING = 0; ESProxy.OPEN = 1; ESProxy.CLOSED = 2;

  window.EventSource = function (url, cfg) {
    if (!isRTDB(url)) return new _ES(url, cfg);
    return new ESProxy(url, cfg);
  };
  window.EventSource.CONNECTING = 0;
  window.EventSource.OPEN = 1;
  window.EventSource.CLOSED = 2;

  // ── 선제 갱신 + 디버그 ────────────────────────────────────
  token(false).catch(function () {});
  setInterval(function () { if (!fresh(_tok)) token(false).catch(function () {}); }, 10 * 60 * 1000);

  window._auth = {
    token: token,
    whoami: function () { return _tok ? { uid: _tok.uid, expiresIn: Math.round((_tok.exp - Date.now()) / 1000) + "s" } : null; },
    reset: function () { try { localStorage.removeItem(LS_KEY); } catch (_) {} _tok = null; return token(true); }
  };
})();
