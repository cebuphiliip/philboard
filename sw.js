/* 필보드 서비스 워커 — 항상 최신 파일을 먼저 받고(수정하면 바로 반영), 인터넷이 안 될 때만 저장해 둔 화면을 보여 준다 */
var CACHE = "philboard-v1";
self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request, { cache: "no-store" }).then(function (res) {
      if (!res.ok) return res; // 오류 응답(404 등)은 저장하지 않는다
      var copy = res.clone(), u = new URL(e.request.url), base = u.origin + u.pathname;
      caches.open(CACHE).then(function (c) {
        /* 같은 파일의 옛 배포본(?v=옛번호)은 지운다 — 배포할 때마다 캐시가 쌓이지 않게 (감사 PB-D-31) */
        c.keys().then(function (ks) { ks.forEach(function (k) { var ku = new URL(k.url); if (ku.origin + ku.pathname === base && k.url !== e.request.url) c.delete(k); }); });
        c.put(e.request, copy);
      });
      return res;
    }).catch(function () { return caches.match(e.request); })
  );
});
