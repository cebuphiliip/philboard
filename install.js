/* 필 앱 패밀리 공용 '앱으로 설치' 안내 (2026-11-20, 원장 261120-01)
   원본은 이 파일(philtodo/install.js). 같은 파일을 philboard/install.js · reports/citytour/route/install.js 에 복사해 쓴다 — 고치면 세 곳 다.
   웹은 브라우저 보안상 저절로 설치되거나 바탕화면 파일을 만들 수 없다. 그래서 가장 가까운 길을 띄운다:
   - 크롬·엣지(안드로이드·PC): '설치' 띠 → 누르면 바로 브라우저 설치 창(PC는 바탕화면 바로가기, 폰은 홈 화면 아이콘)
   - 아이폰·아이패드: 첫 방문 때 '공유 → 홈 화면에 추가' 짧은 그림 안내(닫으면 다시 안 뜸)
   - 카카오톡 등 앱 안 브라우저: 안드로이드는 [크롬으로 열기](intent://), 아이폰은 '오른쪽 아래 ⋯ → 다른 브라우저로 열기' 안내
   - 이미 앱으로 열었으면(standalone·창 제어 오버레이) 아무것도 안 띄운다. 닫으면 며칠 쉰다(localStorage — 막혀 있어도 화면은 정상).
   설정: window.PHIL_INSTALL = {key, name, icon, color, who:"owner"|"guest", delay} 또는 <script src="install.js" data-key=… data-name=…>
   다른 버튼에서 부르기: PhilInstall.open() → 처리했으면 true(크롬 설치 창·아이폰/카톡 안내). open(true) 는 못 하면 기기별 방법 안내를 띄운다.
   시험: PhilInstall.show("prompt"|"ios"|"kakao"|"inapp"|"guide", {ios:true|false, android:true|false}) */
(function () {
  "use strict";
  try { if (window.self !== window.top) return; } catch (e) { return; }
  var me = document.currentScript, ds = (me && me.dataset) || {}, cfg = window.PHIL_INSTALL || {};
  function opt(k, d) { return cfg[k] != null ? cfg[k] : (ds[k] != null ? ds[k] : d); }
  var KEY = "philInstall_" + opt("key", location.pathname),
      NAME = String(opt("name", document.title)),
      ICON = String(opt("icon", "icon-192.png")),
      COLOR = String(opt("color", "#14213D")),
      DELAY = +opt("delay", opt("who", "owner") === "guest" ? 2500 : 800);

  var ua = navigator.userAgent || "";
  var IPAD = /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  var IOS = IPAD || /iPhone|iPod/.test(ua);
  var ANDROID = /Android/i.test(ua);
  var KAKAO = /KAKAOTALK/i.test(ua);
  var INAPP = KAKAO || /NAVER\(inapp|Instagram|FBAN|FBAV|FB_IAB|Line\/|DaumApps|BAND\/|everytimeApp|; wv\)/i.test(ua);
  var MOBILE = IOS || ANDROID || /Mobi/i.test(ua);

  function installed() {
    try {
      var m = window.matchMedia;
      if (m && (m("(display-mode: standalone)").matches || m("(display-mode: window-controls-overlay)").matches ||
          m("(display-mode: fullscreen)").matches || m("(display-mode: minimal-ui)").matches)) return true;
    } catch (e) {}
    return navigator.standalone === true;
  }
  function get(k) { try { return window.localStorage.getItem(KEY + k); } catch (e) { return null; } }
  function put(k, v) { try { window.localStorage.setItem(KEY + k, v); } catch (e) {} }
  function resting() { return (+get("_until") || 0) > Date.now(); }
  function rest(days) { put("_until", String(Date.now() + days * 864e5)); }

  var SVG = {
    share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12"/><path d="M8 7l4-4 4 4"/><path d="M7 10H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-1"/></svg>',
    add: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 8v8M8 12h8"/></svg>',
    dots: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>',
    menu: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>',
    pc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M12 8v5M9.5 10.5 12 13l2.5-2.5M8 20h8"/></svg>'
  };

  var styled = false;
  function css() {
    if (styled) return; styled = true;
    var s = document.createElement("style");
    s.textContent =
      ".pi-bar{position:fixed;left:50%;bottom:calc(12px + env(safe-area-inset-bottom,0px));transform:translate(-50%,160%);z-index:2147483000;" +
      "width:min(440px,calc(100% - 24px));box-sizing:border-box;display:flex;align-items:center;gap:12px;padding:12px 40px 12px 12px;" +
      "background:#fff;color:#1d232b;border-radius:16px;box-shadow:0 12px 36px rgba(0,0,0,.24),0 0 0 1px rgba(0,0,0,.06);" +
      "font:14px/1.45 system-ui,-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;letter-spacing:0;text-align:left;" +
      "word-break:keep-all;overflow-wrap:anywhere;transition:transform .35s ease}" +
      ".pi-bar.pi-on{transform:translate(-50%,0)}" +
      ".pi-bar *{box-sizing:border-box}" +
      ".pi-bar>img{width:44px;height:44px;border-radius:11px;flex:none;align-self:flex-start}" +
      ".pi-tx{flex:1;min-width:0}" +
      ".pi-t{font-weight:700;font-size:15px;margin:0;line-height:1.35}" +
      ".pi-s{margin:2px 0 0;color:#4a5260;font-size:13px}" +
      ".pi-steps{margin:6px 0 0;padding:0;list-style:none;font-size:13px;color:#2b323c}" +
      ".pi-steps li{display:flex;align-items:center;gap:6px;margin-top:5px}" +
      ".pi-n{display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:50%;background:" + COLOR + ";color:#fff;font-size:11px;font-weight:700;flex:none}" +
      ".pi-ico{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:7px;background:#eef1f5;color:#0a84ff;flex:none}" +
      ".pi-ico svg{width:16px;height:16px}" +
      ".pi-go{flex:none;border:0;border-radius:999px;padding:10px 16px;min-height:42px;background:" + COLOR + ";color:#fff;font:700 14px/1 system-ui,-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;cursor:pointer}" +
      ".pi-go:focus-visible,.pi-x:focus-visible{outline:2px solid " + COLOR + ";outline-offset:2px}" +
      ".pi-x{position:absolute;top:4px;right:4px;width:34px;height:34px;border:0;border-radius:50%;background:transparent;color:#8a919c;font-size:22px;line-height:1;cursor:pointer}" +
      "@media (prefers-color-scheme:dark){.pi-bar{background:#1f242c;color:#eef1f5;box-shadow:0 12px 36px rgba(0,0,0,.5),0 0 0 1px rgba(255,255,255,.08)}" +
      ".pi-s{color:#b5bcc6}.pi-steps{color:#dfe3e8}.pi-ico{background:#2c333d;color:#5ab0ff}.pi-x{color:#9aa3ae}}" +
      "@media print{.pi-bar{display:none}}";
    (document.head || document.documentElement).appendChild(s);
  }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  var bar = null;
  function hide(now) {
    if (!bar) return; var b = bar; bar = null;
    if (now) { if (b.parentNode) b.parentNode.removeChild(b); return; }
    b.classList.remove("pi-on");
    setTimeout(function () { if (b.parentNode) b.parentNode.removeChild(b); }, 400);
  }
  /* o = {title, sub, steps:[[아이콘, 글]], btn, onBtn, closeDays} */
  function card(o) {
    hide(true); css();
    bar = el("div", "pi-bar"); bar.setAttribute("role", "dialog"); bar.setAttribute("aria-label", o.title);
    var img = el("img"); img.src = ICON; img.alt = ""; img.width = 44; img.height = 44; bar.appendChild(img);
    var tx = el("div", "pi-tx"); tx.appendChild(el("p", "pi-t", o.title));
    if (o.sub) tx.appendChild(el("p", "pi-s", o.sub));
    if (o.steps) {
      var ol = el("ol", "pi-steps");
      o.steps.forEach(function (s, i) {
        var li = el("li"); li.appendChild(el("span", "pi-n", String(i + 1)));
        if (s[0]) { var ic = el("span", "pi-ico"); ic.innerHTML = SVG[s[0]]; li.appendChild(ic); }
        li.appendChild(el("span", null, s[1])); ol.appendChild(li);
      });
      tx.appendChild(ol);
    }
    bar.appendChild(tx);
    if (o.btn) { var b = el("button", "pi-go", o.btn); b.type = "button"; b.onclick = o.onBtn; bar.appendChild(b); }
    var x = el("button", "pi-x", "×"); x.type = "button"; x.setAttribute("aria-label", "닫기");
    x.onclick = function () { hide(); if (o.closeDays) rest(o.closeDays); };
    bar.appendChild(x);
    document.body.appendChild(bar);
    void bar.offsetWidth; /* 화면 밖 자리를 먼저 그린 뒤 올라오게(requestAnimationFrame 은 가려진 창에서 멈출 수 있어 쓰지 않는다) */
    bar.classList.add("pi-on");
  }

  /* 크롬·엣지 설치 창 */
  var bip = null;
  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault(); bip = e;
    if (!bar && !resting() && !installed()) later(function () { if (bip) show("prompt"); });
  });
  window.addEventListener("appinstalled", function () { bip = null; hide(); });
  function doPrompt() {
    if (!bip) return false;
    var e = bip; bip = null; hide();
    try {
      e.prompt();
      if (e.userChoice && e.userChoice.then) e.userChoice.then(function (c) { if (!c || c.outcome !== "accepted") rest(7); }, function () {});
    } catch (err) { return false; }
    return true;
  }
  function chromeIntent() {
    return "intent://" + location.href.replace(/^https?:\/\//, "") + "#Intent;scheme=" + location.protocol.replace(":", "") + ";package=com.android.chrome;end";
  }

  function show(kind, p) {
    p = p || {};
    var ios = p.ios != null ? p.ios : IOS, android = p.android != null ? p.android : ANDROID,
        kakao = p.kakao != null ? p.kakao : KAKAO, mobile = ios || android || MOBILE;
    if (kind === "prompt") {
      card({ title: NAME + " 앱 설치", sub: mobile ? "홈 화면에서 바로 열려요" : "바탕화면에서 바로 열려요",
             btn: "설치", onBtn: function () { if (!doPrompt()) show("guide", p); }, closeDays: 7 });
    } else if (kind === "ios") {
      var ipad = p.ipad != null ? p.ipad : IPAD, other = /CriOS|EdgiOS|FxiOS/.test(p.ua || ua),
          where = other ? "주소창 오른쪽 공유 버튼 누르기" : ipad ? "화면 위쪽 공유 버튼 누르기" : "화면 아래 공유 버튼 누르기 (안 보이면 ⋯ 먼저)";
      card({ title: "홈 화면에 추가하면 앱처럼 열려요", steps: [["share", where], ["add", "'홈 화면에 추가' 누르기"]], closeDays: 365 });
    } else if (kind === "kakao" || kind === "inapp") {
      var who = kind === "kakao" || kakao ? "카카오톡" : "이 앱";
      if (android) {
        card({ title: "크롬에서 열면 설치돼요", sub: who + " 안에서는 앱 설치가 안 돼요",
               btn: "크롬 열기", onBtn: function () { location.href = chromeIntent(); }, closeDays: 3 });
      } else {
        card({ title: "사파리에서 열면 설치돼요", sub: who + " 안에서는 앱 설치가 안 돼요",
               steps: (kind === "kakao" || kakao) ? [["dots", "오른쪽 아래 ⋯ 누르기"], [null, "'다른 브라우저로 열기' → 사파리"]]
                                                  : [["dots", "메뉴(⋯) 누르기"], [null, "'Safari로 열기' 또는 '다른 브라우저로 열기'"]],
               closeDays: 3 });
      }
    } else if (kind === "guide") {
      if (ios) return show("ios", p);
      card(android ? { title: NAME + " 설치하는 법", steps: [["menu", "크롬 오른쪽 위 ⋮ 누르기"], ["add", "'홈 화면에 추가' 또는 '앱 설치'"]] }
                   : { title: NAME + " 설치하는 법", steps: [["pc", "주소창 오른쪽 설치 아이콘 누르기"], ["menu", "안 보이면 ⋮ → '앱 설치' 또는 '바로가기 만들기'"]] });
    }
    return true;
  }

  function open(withGuide) {
    if (installed()) return false;
    if (doPrompt()) return true;
    if (INAPP) return show(KAKAO ? "kakao" : "inapp");
    if (IOS) return show("ios");
    return withGuide ? show("guide") : false;
  }

  function later(f) { setTimeout(function () { if (!bar && !resting() && !installed()) f(); }, DELAY); }
  function start() {
    if (installed() || resting()) return;
    if (INAPP) later(function () { show(KAKAO ? "kakao" : "inapp"); });
    else if (IOS) later(function () { show("ios"); });
    /* 크롬·엣지는 beforeinstallprompt 가 오면 띄운다 */
  }

  window.PhilInstall = { open: open, show: show, hide: function () { hide(); }, installed: installed, canPrompt: function () { return !!bip; } };
  if (document.body) start(); else document.addEventListener("DOMContentLoaded", start);
})();
