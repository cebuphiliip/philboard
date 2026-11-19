/* 필보드 — 계산·문안 로직(Calc, Text, Stay)은 화면(View)과 분리해 두었다. 나중에 투윙스 사이트에 그대로 옮길 수 있다. */
(function () {
  "use strict";
  var D = window.PB_DATA, S = D.settings, ST = D.stay, H = window.PB_HOTELS || { date: "", hotels: [] }, B = S.brand;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var esc = function (t) { return String(t == null ? "" : t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var num = function (n) { return Number(n || 0).toLocaleString("ko-KR"); };
  var won = function (n) { return num(n) + "원"; }, peso = function (n) { return num(n) + "페소"; }, usd = function (n) { return num(n) + "달러"; };
  var shopById = function (id) { return D.shops.filter(function (s) { return s.id === id; })[0]; };
  var clone = function (o) { return JSON.parse(JSON.stringify(o)); };
  var today = function () { var d = new Date(); return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); };

  /* ---------- 저장소 ---------- */
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem("pb_" + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem("pb_" + k, JSON.stringify(v)); } catch (e) { } }
  };
  var stayDefault = { tab: "resort", cust: { name: "", contact: "" }, resort: { hotel: "", name: "", checkin: "", nights: 1, adults: 2, kids: 0, kidAges: "", ebn: 0, cur: "PHP", margin: "", picks: [], rows: [] }, villa: { idx: 0, checkin: "", nights: 1, profit: ST.villaProfit }, sol: { tier: "double", key: "in", checkin: "", rooms: 1, nights: 1, addAdult: 0, addKid: 0, addBaby: 0, bfPax: 0, totalPax: "", flight: "", pax: "", ename: "", t1: "", t2: "", note: "" } };
  var state = {
    view: "home", shopId: null, q: "", cat: "전체", tab: "ask", libOpen: {}, libQ: "",
    cart: store.get("cart", []), cust: store.get("cust", { name: "", contact: "" }),
    rate: store.get("rate2", S.pesoRate), fx: store.get("fx2", S.usdRate), fxInfo: store.get("fxInfo", { manual: false, mid: 0, date: "" }), bookings: store.get("bookings", []), tomb: store.get("tomb", []), edited: {},
    stay: (function () { var d = clone(stayDefault), v = store.get("stay3", {}); Object.keys(d).forEach(function (k) { if (v[k] != null) d[k] = typeof d[k] === "object" ? Object.assign(d[k], v[k]) : v[k]; }); return d; })(),
    led: { q: "", sort: "new", status: "전체", shop: "전체" }
  };
  function save() { store.set("cart", state.cart); store.set("cust", state.cust); store.set("rate2", state.rate); store.set("fx2", state.fx); store.set("fxInfo", state.fxInfo); store.set("bookings", state.bookings); store.set("tomb", state.tomb); store.set("stay3", state.stay); }
  function newEntry(id) { return { shopId: id, date: "", time: "", start: "", q: {}, ages: "", pickup: "", drop: "", luggage: "", option: "", roster: "", note: "" }; }

  /* ---------- 요금 표기 ---------- */
  var ZERO = function () { return { dep: 0, on: 0, usd: 0, pre: 0 }; };
  function add(t, p, n) { if (!p) return; ["dep", "on", "usd", "pre"].forEach(function (k) { t[k] += (p[k] || 0) * n; }); }
  /* 요금 한 칸을 글로: 예약금 10,000원 + 현장결제 2,700페소 */
  function priceStr(p) {
    if (!p) return "상담 시 안내";
    var a = [], onsite = p.on || p.usd;
    if (p.pre) a.push("예약 시 " + usd(p.pre));
    if (p.dep) a.push((onsite ? "예약금 " : "") + won(p.dep));
    if (p.on) a.push((p.allPre ? "예약 시 결제 " : "현장결제 ") + peso(p.on));
    if (p.usd) a.push("현장결제 " + usd(p.usd));
    return a.length ? a.join(" + ") : "무료";
  }
  function onsiteStr(p) { var a = []; if (p.on) a.push(peso(p.on)); if (p.usd) a.push(usd(p.usd)); return a.join(" + "); }
  function nowStr(p) { var a = []; if (p.dep) a.push(won(p.dep)); if (p.pre) a.push(usd(p.pre)); return a.join(" + ") || "0원"; }
  function dateKo(v) { if (!v) return ""; var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v); if (!m) return v; var d = new Date(+m[1], +m[2] - 1, +m[3]); return m[1] + "년 " + (+m[2]) + "월 " + (+m[3]) + "일(" + "일월화수목금토"[d.getDay()] + ")"; }
  function unitOf(it) { return it.unit || "명"; }
  /* 달러 금액을 원화로 안내할 때 붙이는 글(현찰 살 때 환율) */
  function fxKrw(n) { return Math.ceil(n * (+state.fx || S.usdRate) / 1000) * 1000; }
  function fxLine(n) { return "→ 원화로 입금하실 경우: 약 " + won(fxKrw(n)) + " (1달러 = " + num(+state.fx || S.usdRate) + "원 기준)\n※ 원화 입금에는 입금하시는 날의 '현찰 살 때' 환율이 적용됩니다. 입금하실 때 정확한 금액을 다시 확인해 드립니다."; }
  function fxInput() {
    var f = state.fxInfo, why = f.manual ? "직접 넣은 값" : f.mid ? "자동: " + f.date + " 기준환율 " + num(Math.round(f.mid)) + "원 + 현찰 살 때 가산 " + (Math.round(S.usdSpread * 10000) / 100) + "% (은행 고시와 몇 원 다를 수 있음)" : "자동 환율을 아직 못 받아 기본값 사용";
    return '<div><label>달러 → 원 환산(1달러당 원, 현찰 살 때 환율)</label><input id="fx" type="number" value="' + esc(state.fx) + '"><small class="note" style="display:block;margin-top:4px">' + esc(why) + (f.manual ? ' <button class="btn sm ghost" id="fxAuto">자동 환율로</button>' : "") + "</small></div>";
  }
  /* 하루 한 번 기준환율을 받아 '현찰 살 때' 환율(기준환율 × 1.0175)을 기본값으로 채운다. 직접 넣은 값이 있으면 건드리지 않는다 */
  function fxFetch(force) {
    var f = state.fxInfo; if (!force && f.date === today() && f.mid) return;
    fetch("https://open.er-api.com/v6/latest/USD").then(function (r) { return r.json(); }).then(function (j) {
      var mid = j && j.rates && j.rates.KRW; if (!mid) return;
      f.mid = mid; f.date = today(); if (!f.manual) state.fx = Math.ceil(mid * (1 + S.usdSpread)); state.edited = {}; save();
      if (state.view === "stay" || state.view === "quote") { var a = document.activeElement; if (!a || a === document.body || a.tagName === "BUTTON") render(); }
    }).catch(function () { });
  }
  function showContact(shop) { return !!(state.cust.useContact || state.cust.contact || (shop && shop.needContact)); }
  /* 수익 표기: 원 + 페소 + 달러 (넷가가 다른 통화면 '− 1,200페소'처럼 뺄 금액으로 나온다) */
  function profitStr(k, p, u) {
    var a = []; [[k, won], [p, peso], [u, usd]].forEach(function (x) { if (x[0]) a.push((x[0] < 0 ? "− " : a.length ? "+ " : "") + x[1](Math.abs(x[0]))); });
    return a.join(" ") || "0원";
  }

  /* ---------- 계산 ---------- */
  var Calc = {
    entry: function (e) {
      var shop = shopById(e.shopId), r = { lines: [], sp: ZERO(), off: ZERO(), net: ZERO(), offKnown: true, noPrice: false, pax: 0, shop: shop };
      shop.items.forEach(function (it) {
        var n = Number(e.q[it.key] || 0); if (!n) return;
        r.pax += n; r.lines.push({ it: it, n: n });
        if (!it.sp) { r.noPrice = true; r.offKnown = false; return; }
        add(r.sp, it.sp, n);
        add(r.net, shop.commission ? it.sp : (it.net || { on: it.sp.on, usd: it.sp.usd }), n);
        if (it.off) add(r.off, it.off, n); else r.offKnown = false;
      });
      r.profitKnown = !shop.noNet;
      var cm = shop.commission || 0;
      r.profitKrw = !r.profitKnown ? 0 : cm ? Math.round(r.sp.dep * cm) : r.sp.dep - r.net.dep;
      r.profitPhp = !r.profitKnown ? 0 : cm ? Math.round(r.sp.on * cm) : r.sp.on - r.net.on;
      r.profitUsd = !r.profitKnown ? 0 : cm ? Math.round(r.sp.usd * cm) : (r.sp.pre + r.sp.usd) - (r.net.pre + r.net.usd);
      r.prepayKrw = shop.prepayOnsite ? Math.ceil(r.sp.on * state.rate / 1000) * 1000 : 0; // 현장결제분 원화 사전결제(천 원 단위 올림)
      r.payNow = r.sp.dep + r.prepayKrw;
      return r;
    },
    cart: function () {
      var t = { rows: state.cart.map(Calc.entry), payNow: 0, pre: 0, on: 0, usd: 0, profitKrw: 0, profitPhp: 0, profitUsd: 0, unknown: [] };
      t.rows.forEach(function (r) { t.payNow += r.payNow; t.pre += r.sp.pre; t.usd += r.sp.usd; t.profitKrw += r.profitKrw; t.profitPhp += r.profitPhp; t.profitUsd += r.profitUsd; if (!r.shop.prepayOnsite) t.on += r.sp.on; if (!r.profitKnown) t.unknown.push(r.shop.name); });
      return t;
    }
  };
  function paxLine(e, r) { return r.lines.map(function (l) { return l.it.label.replace(/\(.*\)/, "") + " " + l.n + unitOf(l.it); }).join(" + ") + (e.ages ? " (아동 만 나이: " + e.ages + ")" : ""); }

  /* ---------- 손님용·업체용 문안 ---------- */
  var Text = {
    intro: function (shop) { return "[" + shop.name + "]\n" + shop.tagline + (shop.post ? "\n▶ 상세 안내: " + shop.post : ""); },
    price: function (shop) {
      var t = "[" + shop.name + " 요금 안내]\n", hasOff = shop.items.some(function (it) { return it.off; }), hasSp = shop.items.some(function (it) { return it.sp; });
      if (!hasSp) return t + "\n요금은 상품과 인원에 따라 달라 상담 때 정확히 안내해 드립니다." + (shop.post ? "\n▶ 상세 안내: " + shop.post : "");
      if (hasOff) { t += "\n■ 공식 요금 (업체에 직접 예약하실 때)\n"; shop.items.forEach(function (it) { if (it.off) t += "· " + it.label + ": " + priceStr(it.off) + "\n"; }); }
      t += "\n■ " + B + " 스페셜\n";
      shop.items.forEach(function (it) { if (it.sp) t += "· " + it.label + ": " + priceStr(it.sp) + "\n"; });
      t += "\n※ " + D.priceDate + " 기준 요금이며, 금액은 상담을 진행할 때 한 번 더 확인해 드립니다.";
      if (shop.prepayOnsite) t += "\n※ 이 상품은 현장결제 금액도 예약 시 원화로 함께 결제합니다(1페소 = " + state.rate + "원 기준). 입금하실 때 정확한 금액을 다시 확인해 드립니다.";
      return t;
    },
    ask: function () {
      var t = "안녕하세요, " + B + "입니다. 문의해 주셔서 감사합니다.\n\n";
      t += state.cart.map(function (e) { return Text.intro(shopById(e.shopId)); }).join("\n\n");
      t += "\n\n정확한 견적과 예약 가능 여부를 확인해 드릴 수 있도록, 아래 빈칸을 채워서 보내 주시기 바랍니다.\n\n";
      t += "대표자 성함: " + state.cust.name + "\n" + (state.cart.some(function (e) { return showContact(shopById(e.shopId)); }) ? "카카오톡 ID 또는 연락처: " + state.cust.contact + "\n" : "");
      state.cart.forEach(function (e) {
        var shop = shopById(e.shopId), mas = shop.cat === "마사지";
        t += "\n■ " + shop.name + "\n이용 날짜: " + dateKo(e.date) + "\n";
        if (mas) {
          if (shop.needStart) t += "마사지 시작 희망 시간: " + e.start + "\n";
          t += "인원과 코스(예: 아로마 90분 2명): " + Text.courses(e) + "\n";
        } else {
          if (shop.timeOptions) t += "선택(" + shop.timeOptions.join(" / ") + "): " + e.time + "\n";
          if (shop.optionLabel) t += shop.optionLabel + ": " + e.option + "\n";
          t += "인원: " + shop.items.map(function (it) { return it.label + " " + (e.q[it.key] || "") + unitOf(it); }).join(" / ") + "\n";
          t += "아동 만 나이: " + e.ages + "\n";
        }
        t += (shop.noPickup ? "" : "픽업 장소: " + e.pickup + "\n" + (mas ? "픽업 희망 시간: " + e.time + "\n" : "") + "드랍 장소: " + e.drop + "\n") + "요청 사항: " + e.note + "\n";
        if (shop.form === "clubcebu" || shop.form === "lokal") t += "예약자 전원 영문 이름·생년월일" + (shop.form === "clubcebu" ? "·성별" : "") + ": " + e.roster + "\n";
        if (shop.askNote) t += "\n" + shop.askNote + "\n";
      });
      return t.trim();
    },
    courses: function (e) { var shop = shopById(e.shopId); return shop.items.filter(function (it) { return e.q[it.key] > 0; }).map(function (it) { return it.label + " " + e.q[it.key] + unitOf(it); }).join(", "); },
    quote: function () {
      var c = Calc.cart(), t = "안녕하세요, " + B + "입니다. 요청하신 내용으로 견적을 안내해 드립니다.\n";
      c.rows.forEach(function (r, i) {
        var e = state.cart[i], mas = r.shop.cat === "마사지";
        t += "\n■ " + r.shop.name + (e.date ? " — " + dateKo(e.date) : "") + (e.time ? (mas ? " (픽업 " + e.time + ")" : " " + e.time) : "") + "\n";
        r.lines.forEach(function (l) { t += "· " + l.it.label + " " + l.n + unitOf(l.it) + (l.it.sp ? " × (" + priceStr(l.it.sp) + ")" : "") + "\n"; });
        if (r.noPrice) { t += "→ 요금은 업체에서 상품·인원에 맞춰 직접 안내해 드립니다.\n"; return; }
        if (r.shop.allPrepay) t += "→ 예약 시 전액 결제: " + won(r.payNow) + " (" + peso(r.sp.on) + " 원화 환산, 1페소 = " + state.rate + "원 기준)\n  ※ 환율에 따라 달라질 수 있어, 입금하실 때 정확한 금액을 다시 확인해 드립니다.\n";
        else if (r.shop.prepayOnsite) t += "→ 예약 시 결제: " + won(r.payNow) + " (예약금 " + won(r.sp.dep) + " + 현장결제분 " + peso(r.sp.on) + " 원화 환산 " + won(r.prepayKrw) + ", 1페소 = " + state.rate + "원 기준)\n  ※ 환율에 따라 달라질 수 있어, 입금하실 때 정확한 금액을 다시 확인해 드립니다.\n";
        else t += "→ " + (r.sp.dep || r.sp.pre ? "예약 시 결제 " + nowStr(r.sp) : "예약금 없음") + (onsiteStr(r.sp) ? " / 현장결제 " + onsiteStr(r.sp) : "") + "\n";
        if (r.offKnown && r.lines.length) t += "  (참고: 업체 공식 요금은 " + priceStr(r.off) + "입니다.)\n";
      });
      t += "\n━━━━━━━━━━\n지금 입금하실 금액: " + won(c.payNow) + (c.pre ? " + " + usd(c.pre) : "") + "\n";
      if (c.pre) t += fxLine(c.pre).replace("→ 원화로 입금하실 경우", "→ 달러분(" + usd(c.pre) + ")을 원화로 입금하실 경우") + "\n" + (c.payNow ? "→ 원화 합계: 약 " + won(c.payNow + fxKrw(c.pre)) + "\n" : "");
      if (c.on || c.usd) t += "현장에서 결제하실 금액: " + onsiteStr({ on: c.on, usd: c.usd }) + " (이용 당일 업체에 직접 결제)\n";
      t += "━━━━━━━━━━\n\n예약 가능 여부는 업체에 확인한 뒤 바로 알려 드리겠습니다.\n예약을 진행하시려면 아래 계좌로 입금하신 뒤 입금자 성함을 알려 주세요. 입금이 확인되면 예약을 확정해 드립니다.\n\n";
      t += "[한화 입금] " + S.accounts.krw + "\n[페소 입금] " + S.accounts.php.join(" / ") + "\n";
      var refunds = c.rows.filter(function (r) { return r.shop.refund; }).map(function (r) { return "· " + r.shop.name + ": " + r.shop.refund; });
      if (refunds.length) t += "\n[취소·환불 규정]\n" + refunds.join("\n") + "\n";
      t += "\n※ " + D.priceDate + " 기준 요금입니다.";
      return t;
    },
    after: function (shop, name) {
      var who = name || "고객";
      if (shop.afterText) return shop.afterText;
      if (shop.after === "customer_channel") return "★ " + shop.name + " 예약이 완료되었습니다.\n아래 " + (shop.channelName || shop.name) + " 카카오톡 채널로 연락하셔서 \"" + B + "를 통해 " + shop.name + "을(를) 예약한 " + who + "\"이라고 말씀해 주세요. 픽업 시간과 준비물 등 상세 내용을 업체에서 바로 안내해 드립니다.\n" + (shop.channel || "(업체 채널 주소 확인 필요)");
      if (shop.after === "vendor_contacts") return "★ " + shop.name + " 예약이 완료되었습니다.\n알려 주신 카카오톡 ID(연락처)로 " + shop.name + "에서 직접 연락드려 픽업 시간과 상세 내용을 안내해 드립니다. 카카오톡 ID 검색 허용과 친구 추가 차단 해제를 꼭 확인해 주세요.";
      if (shop.after === "owner_relays") return "★ " + shop.name + " 예약이 완료되었습니다.\n이용 하루 전에 업체의 상세 안내(픽업 시간·준비물)를 이 대화창으로 전달해 드리겠습니다.";
      return "★ " + shop.name + " 예약이 완료되었습니다.\n이용 하루 전에 픽업 차량 정보를 이 대화창으로 보내 드리겠습니다.";
    },
    done: function () {
      var t = "입금 확인되었습니다. 감사합니다, " + (state.cust.name || "고객") + "님.\n\n";
      t += state.cart.map(function (e) { return Text.after(shopById(e.shopId), state.cust.name ? state.cust.name + "님" : ""); }).join("\n\n");
      t += "\n\n여행 준비 중에 궁금하신 점이 있으면 언제든지 편하게 문의해 주세요.\n항상 최선을 다하는 " + B + "가 되겠습니다. 감사합니다.";
      return t;
    },
    vendorValue: function (key, e, r) {
      var c = state.cust, shop = r.shop;
      var pay = shop.vendorPay || [onsiteStr(r.net) ? "현장결제 " + onsiteStr(r.net) : "", r.net.dep ? "예약금 " + won(r.net.dep) : ""].filter(Boolean).join(", ");
      var extra = (e.luggage ? ". 짐 보관: " + e.luggage : "") + (e.note ? ". " + e.note : "");
      if (key.charAt(0) === "=") return key.slice(1);
      switch (key) {
        case "date": return dateKo(e.date);
        case "date+time": return dateKo(e.date) + (e.time ? " (" + e.time + ")" : "");
        case "date+start": return dateKo(e.date) + " / " + e.start;
        case "name": return c.name;
        case "contact": return c.contact;
        case "phone": return /^[\d\s+-]+$/.test(c.contact) ? c.contact : "";
        case "name+contact": return c.name + (c.contact ? " / " + c.contact : "");
        case "name+total": return c.name + " / " + r.pax + "명";
        case "total": return r.pax + "명";
        case "total+pax": return "총 " + r.pax + "명 (" + paxLine(e, r) + ")";
        case "paxline": return paxLine(e, r);
        case "pickup": return e.pickup;
        case "drop": return e.drop;
        case "drop+after": return e.drop + " / 끝나고 바로";
        case "pickup/drop": return e.pickup + " / " + e.drop;
        case "pickup+time": return e.pickup + (e.time ? " " + e.time : "");
        case "pickup+time/": return e.pickup + " / " + e.time;
        case "time": return e.time;
        case "luggage": return e.luggage;
        case "option": return e.option || (shop.form === "weocean" ? "현장에서 선택" : "");
        case "roster": return e.roster;
        case "courses": return (shop.cat === "마사지" ? "총 " + r.pax + "명 → " : "") + Text.courses(e);
        case "onsite": return onsiteStr(r.net);
        case "pay": return pay;
        case "note": return [e.luggage ? "짐 보관: " + e.luggage : "", e.note].filter(Boolean).join(". ");
        case "pay+note": return pay + (pay ? extra : extra.replace(/^\. /, ""));
        case "showpay+note": return r.lines.map(function (l) { return l.it.label + " " + won(l.it.sp.dep) + "×" + l.n + "명"; }).join(" + ") + " = " + won(r.sp.dep) + extra;
      }
      if (key.indexOf("q:") === 0) { var k = key.slice(2).replace("+ages", ""), n = e.q[k] || 0; return n ? n + "명" + (key.indexOf("+ages") > 0 && e.ages ? " (만 " + e.ages + ")" : "") : "0명"; }
      return "";
    },
    vendor: function (e) {
      var shop = shopById(e.shopId), f = D.forms[shop.form], r = Calc.entry(e);
      var sc = showContact(shop);
      return f.title.replace("{shop}", shop.name) + "\n" + f.lines.filter(function (l) { return sc || (l[1] !== "contact" && l[1] !== "phone"); }).map(function (l) { return l[0].replace(sc ? "" : " & 연락처", "") + ": " + Text.vendorValue(l[1], e, r); }).join("\n");
    }
  };

  /* ---------- 숙소 계산·문안 ---------- */
  function addDays(iso, n) { var p = iso.split("-"), d = new Date(+p[0], +p[1] - 1, +p[2] + n); return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
  function mdKo(iso) { var p = iso.split("-"); return (+p[1]) + "월 " + (+p[2]) + "일"; }
  var Stay = {
    hotel: function () {
      var r = state.stay.resort, i = r.hotel; if (i === "" || i == null) return null;
      var h = H.hotels[+i] || null, want = r.hotelName || "";
      if (!want && h && r.name && h.name !== r.name && (r.picks || []).length && !h.rooms.some(function (x) { return x.type === r.picks[0].type; })) want = r.name; // 옛 저장본: 목록 순서가 바뀌어 번호가 다른 숙소를 가리키면 이름으로 다시 찾는다
      if (want && (!h || h.name !== want)) { for (var j = 0; j < H.hotels.length; j++) if (H.hotels[j].name === want) { r.hotel = String(j); return H.hotels[j]; } }
      return h;
    },
    money: function (n, cur) { return cur === "USD" ? usd(n) : cur === "KRW" ? won(n) : peso(n); },
    resort: function () {
      var r = state.stay.resort, h = Stay.hotel(), nights = Math.max(1, +r.nights || 1), cur = h ? h.rooms[0].cur : r.cur;
      var margin = r.margin === "" || r.margin == null ? (ST.resortMargin[cur] || 0) : +r.margin, adults = Math.max(0, +r.adults || 0), kids = Math.max(0, +r.kids || 0);
      var dates = []; if (r.checkin) for (var i = 0; i < nights; i++) dates.push(addDays(r.checkin, i));
      var td = today(), src, all = false;
      if (h) { src = r.picks.length ? r.picks.map(function (p) { var d = h.rooms.filter(function (x) { return x.type === p.type; })[0]; return d ? { def: d, rooms: Math.max(1, +p.rooms || 1) } : null; }).filter(Boolean) : h.rooms.filter(function (x) { return x.cur === cur; }).map(function (d) { return { def: d, rooms: 1 }; }); all = !r.picks.length; }
      else src = r.rows.filter(function (x) { return +x.tmj > 0; }).map(function (x) { return { def: { type: x.type, rate: +x.tmj }, rooms: Math.max(1, +x.rooms || 1) }; });
      var promoSell = h && h.sell && td >= h.sell[0] && td <= h.sell[1];
      var lines = src.map(function (s) {
        var d = s.def, base = 0, sur = 0, surN = 0, promoN = 0, nextN = 0, dynN = 0, surNames = [], pkN = d.pkgN || 1, minOk = !d.promoMinN || nights >= d.promoMinN;
        for (var i = 0; i < nights; i++) {
          var dt = dates[i], promo = d.promo && minOk && promoSell && dt && h.stay && dt >= h.stay[0] && dt <= h.stay[1];
          var nx = !promo && h && h.next && dt && dt >= h.next[0] && dt <= h.next[1] && (d.next != null || d.nextDyn);
          if (!promo && (nx ? d.nextDyn : d.dyn)) dynN++;
          base += (promo ? d.promo : nx ? (d.next || 0) : (d.rate || 0)) / pkN + margin; if (promo) promoN++; if (nx) nextN++;
          if (h && dt) h.sur.forEach(function (x) { if (dt >= x.from && dt <= x.to && x.amt[d.type] && (!x.dow || x.dow.indexOf(new Date(dt + "T00:00:00Z").getUTCDay()) >= 0)) { sur += x.amt[d.type] / pkN; surN++; if (surNames.indexOf(x.name) < 0) surNames.push(x.name); } });
        }
        base = Math.round(base); sur = Math.round(sur);
        return { type: d.type, rooms: s.rooms, night1: Math.round((d.rate || 0) / pkN) + margin, base: base * s.rooms, sur: sur * s.rooms, surN: surN, surNames: surNames, promoN: promoN, nextN: nextN, dynN: dynN, pkgN: d.pkgN || 0, total: (base + sur) * s.rooms, profit: margin * nights * s.rooms };
      });
      var philco = { rows: [], hot: "", early: "" }, PC = window.PB_PHILCO && h ? window.PB_PHILCO.hotels[h.name] : null;
      if (PC && dates.length) {
        philco.hot = PC.hot || "";
        src.forEach(function (sx) {
          var d = sx.def, pr = PC.rooms[d.type]; if (pr == null) return;
          var tm = 0, pp = 0, tsur = 0, anySur = false;
          dates.forEach(function (dt) {
            var promo = d.promo && promoSell && h.stay && dt >= h.stay[0] && dt <= h.stay[1];
            tm += promo ? d.promo : d.rate; pp += pr;
            var ts = 0; h.sur.forEach(function (x) { if (dt >= x.from && dt <= x.to && x.amt[d.type] && (!x.dow || x.dow.indexOf(new Date(dt + "T00:00:00Z").getUTCDay()) >= 0)) ts += x.amt[d.type]; });
            var ps = ts; if (PC.sur) { ps = 0; PC.sur.forEach(function (x) { if (dt >= x.from && dt <= x.to) ps += x.amt; }); }
            tm += ts; pp += ps; if (ts || ps) anySur = true;
          });
          var row = { type: d.type, rooms: sx.rooms, tmj: tm * sx.rooms, philco: pp * sx.rooms, diff: (tm - pp) * sx.rooms };
          var dd = r.checkin ? Math.round((new Date(r.checkin) - new Date(td)) / 86400000) : -1;
          if (PC.early && PC.early[d.type] != null && dd >= (PC.earlyDays || 45) && !anySur) { var pe = PC.early[d.type] * dates.length * sx.rooms; row.early = pe; row.earlyDiff = row.tmj - pe; }
          if (row.diff > 0 || row.earlyDiff > 0) philco.rows.push(row);
        });
        if (philco.rows.some(function (x) { return x.early; })) philco.early = PC.earlyNote;
      }
      var extras = [], infos = [];
      var ages = String(r.kidAges || "").split(/[^0-9]+/).filter(Boolean).map(Number), agesKnown = kids > 0 && ages.length === kids, ageUnknown = kids > 0 && !agesKnown;
      function cnt(lo, hi) { if (!kids) return 0; if (!agesKnown) return kids; return ages.filter(function (a) { return a >= lo && a <= hi; }).length; }
      if (h && dates.length) {
        h.gala.forEach(function (g) {
          var hit = g.to ? dates.filter(function (dt) { return dt >= g.date && dt <= g.to; })[0] : dates.filter(function (dt) { return dt.slice(5) === g.date.slice(5); })[0];
          if (!hit) return;
          var ga = [0, 17], gn = [];
          (ST.galaAge || []).forEach(function (x) { if (h.name.indexOf(x.match) >= 0) ga = [x.lo, x.hi]; });
          (ST.galaNotes || []).forEach(function (x) { if (h.name.indexOf(x.match) >= 0) gn.push(x.note); });
          var kc = cnt(ga[0], ga[1]);
          extras.push({ name: "갈라 디너(" + (g.to ? mdKo(g.date) + "~" + mdKo(g.to) + " 지나는 숙박" : mdKo(hit)) + ", 의무)", adult: g.adult, child: g.child, total: adults * g.adult + kc * g.child, note: gn.join(" / ") + (kids && ga[0] > 0 ? " ※ 아동 요금 대상: 만 " + ga[0] + "~" + ga[1] + "세" : "") });
        });
      }
      if (h) (ST.mandatory || []).forEach(function (m) { if (h.name.indexOf(m.match) >= 0 && nights >= m.minNights) m.items.forEach(function (it) { var kc = it.ageLo != null ? cnt(it.ageLo, it.ageHi) : kids; extras.push({ name: it.name, adult: it.adult, child: it.child, total: (adults * it.adult + kc * it.child) * (m.perNight ? nights : 1), note: m.note }); }); });
      var pk = h && r.picks && r.picks[0] ? h.rooms.filter(function (x) { return x.type === r.picks[0].type; })[0] : null, ebn = Math.max(0, +r.ebn || 0);
      var checks = []; if (r.reqNote) infos.push("손님 요청사항: " + r.reqNote);
      if (ageUnknown) checks.push("아동 나이가 입력되지 않았습니다 — 갈라·의무식·아동 조식은 아동 나이로 대상이 갈립니다. 지금은 아동 전원 대상으로 계산했으니 나이를 넣어 확인하세요.");
      if (h) (ST.internalNotes || []).forEach(function (x) { if (h.name.indexOf(x.match) >= 0 && (!x.rooms || ((r.picks || []).length ? r.picks : h.rooms).some(function (q) { return x.rooms.indexOf(q.type) >= 0; }))) checks.push(x.note); }); // rooms: 그 객실을 고른 견적에만(객실을 안 고르면 전체 객실이 나가므로 그 숙소에 해당 객실이 있으면)
      if (h && dates.length) (ST.dateChecks || []).forEach(function (x) { if (h.name.indexOf(x.match) >= 0 && x.ranges.some(function (rg) { return dates.some(function (dt) { return dt >= rg[0] && dt <= rg[1]; }); })) checks.push(x.note); });
      if (h && extras.some(function (x) { return x.name.indexOf("갈라 디너") === 0; })) {
        if (/TBA|TO BE ADVIS/i.test(h.remark || "")) checks.push("갈라 디너 체크요망: TMJ 비고에 금액·내용이 미정(TBA)으로 표기돼 있습니다. 갈라디너 내용을 숙소에 확인하세요.");
        if (kids && h.gala.some(function (g) { return !g.child; })) checks.push("갈라 디너 체크요망: 아동 갈라 금액이 표에 없습니다(0으로 계산됨). 아동 갈라 요금을 숙소에 확인하세요.");
        if (h.gala.some(function (g) { return g.child > 0 && g.child > g.adult; })) checks.push("갈라 디너 체크요망: 아동 금액이 성인보다 큽니다. 자료 오류일 수 있어 확인하세요.");
      }
      var roomOnly = !!(h && /ROOM ONLY/i.test(h.name));
      if (h && !h.notRoom) {
        var roomCap = (r.picks || []).reduce(function (a, q) { return a + Math.max(1, +q.rooms || 1); }, 0) || 1;
        if (adults > 2 * roomCap && ebn < adults - 2 * roomCap) checks.push("성인 " + adults + "명 · " + roomCap + "객실인데 엑스트라 베드(추가 인원)를 " + ebn + "명으로 넣었습니다 — 객실당 성인 3번째부터 추가 인원 요금(엑스트라 베드 요금과 같음)이 붙습니다. '엑스트라 베드 사용 인원'을 확인하세요.");
      }
      if (h && pk && !h.notRoom) {
        var pkcbf = pk.cbf; if (pkcbf == null) (ST.cbfDefault || []).forEach(function (x) { if (h.name.indexOf(x.match) >= 0) pkcbf = x.cbf; });
        if (h.cbfAge && kids && !extras.some(function (x) { return x.name.indexOf("아동 조식") >= 0; })) {
          if (pkcbf != null) {
            var cc = cnt(h.cbfAge[0], h.cbfAge[1]);
            if (pkcbf > 0 && cc) extras.push({ name: "아동 조식(만 " + h.cbfAge[0] + "~" + h.cbfAge[1] + "세, 사전결제) " + cc + "명 × " + nights + "박", adult: 0, child: pkcbf, total: cc * pkcbf * nights, note: "아동 조식은 엑스트라 베드와 별도 요금" });
            else if (pkcbf === 0) { if (roomOnly || /ALA ?CART|A LA CARTE/i.test(h.remark || "")) checks.push("아동 조식: TMJ 표에 0으로 되어 있지만 " + (roomOnly ? "룸온리 요금이라" : "비고에 '알라카르트(현장 주문)'로 적혀 있어") + " 무료가 아닙니다 — 아동 조식이 필요하면 숙소에 금액을 확인하세요."); else infos.push("아동 조식(만 " + h.cbfAge[0] + "~" + h.cbfAge[1] + "세)은 무료입니다(TMJ 표 0)."); }
          } else checks.push("이 객실은 TMJ에 아동 조식 요금 표기가 없어 합계에 넣지 못했습니다 — 숙소에 확인하세요.");
        }
        if (ebn) {
          var ebPN = pk.ebStay && pk.pkgN ? pk.eb / pk.pkgN : pk.eb, ebTxt = (pk.ebNote || "") + " " + (h.ebLabel || ""), ebNotes = [];
          var epOnly = /extra (person|pax) only/i.test(ebTxt);
          if (epOnly) ebNotes.push("침대 없이 인원만 추가되는 요금입니다(엑스트라 베드 없음)");
          else if (/sofa/i.test(ebTxt)) ebNotes.push("소파베드로 제공됩니다");
          else if (/W\/ ?EB|W\/ ?EXTRA ?BED|WITH EXTRA BED/i.test(ebTxt)) ebNotes.push("엑스트라 베드가 포함된 요금입니다");
          if (/subject (to|upon) avail/i.test(ebTxt)) ebNotes.push("엑스트라 베드는 객실 사정에 따라 가능 여부를 확인해 드립니다");
          ebNotes.push(roomOnly ? "룸온리 요금이라 조식은 포함되지 않습니다" : epOnly ? "추가 인원 요금에는 조식이 포함됩니다" : "성인 엑스트라 베드 요금에는 조식이 포함됩니다");
          if (!epOnly && !/subject (to|upon) avail/i.test(ebTxt)) ebNotes.push("침대 가능 여부는 예약 시 확인해 드립니다");
          if (pk.ebNA) checks.push("이 객실은 TMJ 표에 엑스트라 베드·추가 인원이 '불가(N/A)'로 되어 있어 합계에 넣지 않았습니다 — 다른 객실을 고르거나 숙소에 확인하세요.");
          else if (pk.eb > 0) extras.push({ name: (epOnly ? "추가 인원(침대 없음)" : (h.ebLabel || "엑스트라 베드").replace(/\s*\(.*$/, "")) + " " + ebn + "명 × " + nights + "박", adult: Math.round(ebPN), child: 0, total: Math.round(ebn * ebPN * nights), note: ebNotes.join(". ") });
          else checks.push("이 객실은 TMJ 표에 엑스트라 베드 요금이 " + (pk.eb === 0 ? "0으로" : "없게") + " 표기돼 합계에 넣지 못했습니다 — 숙소에 확인하세요.");
        }
      }
      var exTotal = extras.reduce(function (a, x) { return a + x.total; }, 0), minWarn = [], MIN = /MIN\.?\s*(?:OF\s*)?(\d+)\s*N/i, mm;
      if (h) {
        if ((mm = MIN.exec(h.name)) && nights < +mm[1]) minWarn.push("이 숙소는 최소 " + mm[1] + "박부터 예약됩니다(지금 " + nights + "박).");
        h.sur.forEach(function (x) { var m2 = MIN.exec(x.name); if (m2 && nights < +m2[1] && dates.some(function (dt) { return dt >= x.from && dt <= x.to; })) minWarn.push(x.name.replace(/\s*\(.*$/, "") + " 기간(" + x.from + " ~ " + x.to + ")은 최소 " + m2[1] + "박입니다(지금 " + nights + "박)."); });
      }
      var hardWarn = [], remarkLines = [];
      lines.forEach(function (x) {
        if (x.dynN) checks.push("다이나믹 요금 체크요망: '" + x.type + "'은(는) TMJ에 정해진 요금이 없습니다 — " + x.dynN + "박분 객실 요금이 합계에 빠져 있습니다. TMJ에 로그인해 그 날짜 요금을 확인하고 견적에 넣으세요(손님 글에는 '요금 확인 후 안내'로 나갑니다).");
        if (x.pkgN && x.pkgN !== nights) hardWarn.push("'" + x.type + "'은(는) " + x.pkgN + "박 패키지 요금입니다(지금 " + nights + "박) — 합계는 1박 환산값이라 맞지 않습니다. 박수를 " + x.pkgN + "박으로 맞추거나 다른 객실을 고르세요.");
        if (x.nextN) infos.push(x.type + ": " + x.nextN + "박은 다음 요금 기간(" + h.next[0] + " ~ " + h.next[1] + ") 요금을 적용했습니다.");
      });
      if (h && dates.length) {
        var first = dates[0], last = dates[dates.length - 1], rng = function (a) { return a && a.length === 2 && (first < a[0] || last > a[1]); };
        var vm = (h.valid || "").match(/(\d{4}-\d{2}-\d{2})\s*~\s*(\d{4}-\d{2}-\d{2})/), vrng = vm ? [vm[1], h.next ? h.next[1] : vm[2]] : null;
        // 정상가 유효기간(vrng)이 있으면 Sell·Stay 는 프로모 기간일 뿐 — 그 밖의 날짜는 정상가로 맞게 계산되므로 경고하지 않고 안내만(사장님 2026-11-19, 원장 261119-33)
        if (rng(h.stay) && !vrng) hardWarn.push("이 요금표는 " + h.stay[0] + " ~ " + h.stay[1] + " 투숙분만 해당합니다. 선택한 날짜(" + first + " ~ " + last + ")가 범위를 벗어나 요금과 서차지·갈라가 맞지 않을 수 있습니다.");
        else if (rng(h.stay) && !rng(vrng) && src.some(function (s) { return s.def.promo; })) infos.push("프로모 요금은 " + h.stay[0] + " ~ " + h.stay[1] + " 투숙분만 적용됩니다 — 그 밖의 날짜는 정상가로 계산했습니다.");
        if (rng(vrng)) hardWarn.push("이 요금표의 유효기간은 " + vrng[0] + " ~ " + vrng[1] + "입니다. 선택한 날짜(" + first + " ~ " + last + ")가 범위를 벗어나 새 요금표가 필요합니다.");
        var peak = dates.some(function (dt) { var md = dt.slice(5); return md >= "12-20" || md <= "01-05"; });
        if (peak && !h.sur.length && !h.gala.length) hardWarn.push("연말연시(12/20~1/5) 날짜인데 이 요금표에는 서차지·갈라 디너 자료가 없습니다. 아래 TMJ 비고를 확인하고, 필요하면 TMJ에서 연말 요금을 다시 확인하세요.");
        if (/TBA|TO BE ADVISE|BEST AVAILABLE RATE|BAR\b/i.test(h.remark || "") && peak) hardWarn.push("TMJ 비고에 '정해지지 않음(TBA)·성수기 별도(BAR)' 표시가 있습니다. 연말 날짜는 TMJ에서 정확한 금액을 확인하세요.");
        var fam = (h.name || "").replace(/\s*\(.*$/, "").replace(/\s+(PKG|PACKAGE|BUFFET|\(.*)$/i, "").trim().toUpperCase().split(/\s+/), alts = [];
        fam = (/^(THE|BE|LA|BEST|CASA|CROWN|COPENHAGEN|HENANN|COSTABELLA)$/.test(fam[0]) && fam.length > 1 ? fam[0] + " " + fam[1] : fam[0]);
        if (hardWarn.length) H.hotels.forEach(function (o, oi) { if (o === h || o.name.toUpperCase().indexOf(fam) !== 0) return; var ok = true, ms = (o.valid || "").match(/(\d{4}-\d{2}-\d{2})\s*~\s*(\d{4}-\d{2}-\d{2})/); if (o.stay) ok = !(first < o.stay[0] || last > o.stay[1]); else if (ms) ok = !(first < ms[1] || last > ms[2]); if (ok && (o.sur.length || o.gala.length)) alts.push(o.name); });
        if (alts.length) hardWarn.push("같은 숙소의 다른 요금표 중 이 날짜를 포함하고 서차지·갈라 자료가 있는 것: " + alts.join(" / "));
      }
      if (h) (h.remark || "").split(/\n/).forEach(function (ln) { if (/EXTRA|ADDITIONAL|CHILD|BREAKFAST|BFAST|B\/F|ADULT|SURCHARGE|CHARGE|MANDATORY|GALA/i.test(ln) && ln.trim().length > 6) remarkLines.push(ln.trim()); });
      var rr = state.stay.resort, sig = [rr.hotel, rr.checkin, rr.nights, rr.adults, rr.kids, rr.kidAges, rr.ebn, (rr.picks || []).map(function (q) { return q.type + "x" + q.rooms; }).join(",")].join("|"), needOk = !!(h && (checks.length || hardWarn.length || remarkLines.length || h.sur.length || h.gala.length || (dates.length && dates.some(function (dt) { var md = dt.slice(5); return md >= "12-20" || md <= "01-05"; })))); return { philco: philco, checks: checks, galaHit: extras.some(function (x) { return x.name.indexOf("갈라 디너") === 0; }), infos: infos, hardWarn: hardWarn, remarkLines: remarkLines, needOk: needOk, sig: sig, okDone: needOk && rr.okSig === sig, h: h, lines: lines, all: all, nights: nights, margin: margin, cur: cur, adults: adults, kids: kids, extras: extras, exTotal: exTotal, minWarn: minWarn, dated: !!dates.length,
        total: lines.reduce(function (a, x) { return a + x.total; }, 0) + exTotal, profit: lines.reduce(function (a, x) { return a + x.profit; }, 0) };
    },
    resortText: function () {
      var r = state.stay.resort, c = Stay.resort(), m = function (n) { return Stay.money(n, c.cur); };
      var t = "안녕하세요, " + B + "입니다. 문의하신 숙소 요금을 안내해 드립니다.\n\n■ " + (r.name || "(숙소명)") + "\n" + (r.checkin ? "체크인 " + dateKo(r.checkin) + " · " : "") + c.nights + "박" + (c.adults || c.kids ? " · 성인 " + c.adults + "명" + (c.kids ? " + 아동 " + c.kids + "명" : "") : "") + "\n";
      var dynAny = c.lines.some(function (x) { return x.dynN; });
      c.lines.forEach(function (x) {
        if (x.dynN) { t += "· " + (x.type || "객실") + (x.rooms > 1 ? " " + x.rooms + "객실" : "") + ": " + c.nights + "박 요금은 확인 후 다시 안내해 드립니다\n"; return; }
        t += "· " + (x.type || "객실") + (x.rooms > 1 ? " " + x.rooms + "객실" : "") + ": " + c.nights + "박 " + m(x.total);
        var d = [];
        var wkN = x.surNames.filter(function (n) { return /WEEKEND/i.test(n); }).length;
        if (x.sur) d.push("객실 요금 " + m(x.base) + " + " + (wkN && wkN === x.surNames.length ? "주말(금·토 숙박) 추가 요금 " : wkN ? "성수기·주말 추가 요금 " : "성수기 추가 요금 ") + m(x.sur) + "(" + x.surN + "박 해당)");
        else if (c.nights > 1 || x.rooms > 1) d.push("1박 " + m(Math.round(x.base / c.nights / x.rooms)) + " 기준");
        if (x.promoN) d.push("프로모션 요금 적용");
        t += (d.length ? " (" + d.join(", ") + ")" : "") + "\n";
      });
      c.extras.forEach(function (x) { t += "· " + x.name + ": " + (x.adult ? "성인 1인 " + m(x.adult) : "") + (x.child ? (x.adult ? " / " : "") + "아동 1인 " + m(x.child) : "") + (x.total ? " → " + m(x.total) : "") + (x.note ? " ※ " + x.note : "") + "\n"; });
      if (!c.all && c.lines.length && !dynAny) t += "\n→ 합계 " + m(c.total) + "\n" + (c.cur === "USD" ? fxLine(c.total) + "\n" : "");
      t += "\n※ 객실당 요금이며 " + (c.h && /ROOM ONLY/i.test(c.h.name) ? "조식은 포함되어 있지 않습니다(룸온리)" : "조식이 포함되어 있습니다") + ".\n" + (c.dated ? "" : "※ 성수기·연휴에는 추가 요금이 붙을 수 있어, 날짜가 정해지면 정확한 금액을 다시 안내해 드립니다.\n") + "※ " + D.priceDate + " 기준 요금이며, 예약을 진행할 때 정확한 금액을 한 번 더 확인해 드립니다.\n\n" + ST.resortSteps;
      return t;
    },
    resortAsk: function () {
      var r = state.stay.resort, c = Stay.resort(), picked = r.picks.length || !c.h;
      return "안녕하세요, " + B + "입니다. 문의해 주셔서 감사합니다.\n정확한 요금과 예약 가능 여부를 확인해 드릴 수 있도록, 아래 빈칸을 채워서 보내 주시기 바랍니다.\n\n" +
        ["숙소: " + (r.name || ""), "체크인 날짜: " + dateKo(r.checkin), "체크아웃 날짜(또는 박수): " + (r.checkin ? dateKo(addDays(r.checkin, c.nights)) + " (" + c.nights + "박)" : ""),
          "객실 타입: " + (picked ? c.lines.map(function (x) { return x.type; }).join(", ") : ""), "객실 수: " + (picked ? c.lines.map(function (x) { return x.rooms + "객실"; }).join(", ") : ""),
          "인원(성인 / 아동): " + (r.checkin || picked ? "성인 " + c.adults + "명" + (c.kids ? " / 아동 " + c.kids + "명" : "") : ""),
          "아동 나이(만 나이, 아동별로 · 없으면 '없음'): " + (r.kidAges ? r.kidAges.split(/[^0-9]+/).filter(Boolean).map(function (n) { return n + "세"; }).join(", ") : ""),
          "대표자 영문 성함(여권과 동일): ", "카카오톡 ID 또는 연락처: " + (state.stay.cust.contact || ""), "요청 사항(침대 타입·공항 픽업 등): "].join("\n");
    },
    villaAsk: function () {
      var v = state.stay.villa, c = Stay.villa();
      return "안녕하세요, " + B + "입니다. 문의해 주셔서 감사합니다.\n예약 가능 여부를 확인해 드릴 수 있도록, 아래 빈칸을 채워서 보내 주시기 바랍니다.\n\n" +
        ["풀빌라: " + c.d.name + " (" + c.d.rooms + ")", "체크인 날짜: " + dateKo(v.checkin), "박수: " + c.nights + "박", "인원(성인 / 아동은 만 나이): ", "대표자 성함: " + (state.stay.cust.name || ""),
          "카카오톡 ID 또는 연락처: " + (state.stay.cust.contact || ""), "도착 항공편·도착 시간: ", "요청 사항(조식·바비큐·공항 픽업 등): "].join("\n");
    },
    villa: function () {
      var v = state.stay.villa, d = ST.villas[+v.idx] || ST.villas[0], nights = Math.max(1, +v.nights || 1), profit = +v.profit || 0;
      return { d: d, nights: nights, direct: d.net + ST.villaDirectAdd, sell: d.net + profit, profit: profit * nights, total: (d.net + profit) * nights };
    },
    villaText: function () {
      var v = state.stay.villa, c = Stay.villa();
      return "안녕하세요, " + B + "입니다. 문의하신 풀빌라 요금을 안내해 드립니다.\n\n■ " + c.d.name + " (" + c.d.rooms + ")\n" + (v.checkin ? "체크인 " + dateKo(v.checkin) + " · " : "") + c.nights + "박\n" +
        "· 공식 요금(업체에 직접 예약하실 때): 1박 " + usd(c.direct) + "\n· " + B + " 스페셜: 1박 " + usd(c.sell) + (c.nights > 1 ? " × " + c.nights + "박 = " + usd(c.total) : "") + "\n" + fxLine(c.total) + "\n\n" +
        "※ 빌라 한 채 전체 요금입니다(조식 불포함).\n※ " + D.priceDate + " 기준 요금이며, 날짜와 인원에 따라 달라질 수 있어 예약을 진행할 때 한 번 더 확인해 드립니다.\n\n예약을 원하시면 날짜와 인원(성인·아동 만 나이)을 알려 주세요. 예약 가능 여부를 확인한 뒤 바로 안내해 드리겠습니다.";
    },
    sol: function () {
      var s = state.stay.sol, p = ST.soltana.filter(function (x) { return x.key === s.key; })[0] || ST.soltana[0], tier = ST.soltanaTiers.filter(function (x) { return x.key === s.tier; })[0] || ST.soltanaTiers[0], off = ST.soltanaTiers[0], A = ST.soltanaAdd;
      var rooms = Math.max(1, +s.rooms || 1), nights = p.room ? Math.min(ST.soltanaMaxNights, Math.max(1, +s.nights || 1)) : 0, aA = +s.addAdult || 0, aK = +s.addKid || 0, aB = +s.addBaby || 0, bfPax = nights ? (+s.bfPax || 0) : 0;
      var hasIn = p.pack === "in" || p.pack === "inout", hasOut = p.pack === "out" || p.pack === "inout";
      var one = function (t) { return (p.pack ? t.price[p.pack] : 0) + nights * t.price.room; };
      var ex = []; // 추가 요금 줄: [설명, 금액]
      if (aA && hasIn) ex.push(["입국팩 성인 추가 " + aA + "명 × " + usd(A.in.adult) + " (조식·엑스트라베드 포함)", aA * A.in.adult]);
      if (aK && hasIn) ex.push(["입국팩 아동 추가(만 7~11세) " + aK + "명 × " + usd(A.in.kid) + " (조식·엑스트라베드 포함)", aK * A.in.kid]);
      if (aA && nights) ex.push(["룸온리 성인 추가 " + aA + "명 × " + usd(A.room.adult) + " × " + nights + "박 (엑스트라베드 포함, 조식 불포함)", aA * A.room.adult * nights]);
      if (bfPax) ex.push(["룸온리 조식 추가 " + bfPax + "명 × " + usd(A.room.breakfast) + " × " + nights + "박", bfPax * A.room.breakfast * nights]);
      if (aA && hasOut) ex.push(["출국팩 성인 추가 " + aA + "명 × " + usd(A.out.adult) + " (엑스트라베드 포함)", aA * A.out.adult]);
      var extra = ex.reduce(function (a, x) { return a + x[1]; }, 0), total = +s.totalPax || 0, warn = [];
      if (total > rooms * ST.soltanaMaxPax) warn.push("객실당 최대 " + ST.soltanaMaxPax + "명까지입니다. 총 " + total + "명이면 객실이 " + Math.ceil(total / ST.soltanaMaxPax) + "개 이상 필요합니다.");
      else if (total > rooms * ST.soltanaStdPax) warn.push("객실 기준 인원은 최대 " + ST.soltanaStdPax + "명입니다. " + ST.soltanaMaxPax + "명은 손님이 좁아도 괜찮다고 할 때만 받습니다.");
      var parts = []; if (p.pack) parts.push(ST.soltana.filter(function (x) { return x.key === p.pack; })[0].name + " " + usd(tier.price[p.pack])); if (nights) parts.push("룸온리 " + nights + "박 × " + usd(tier.price.room));
      var c = { p: p, tier: tier, price: one(tier), official: one(off), parts: parts.join(" + "), rooms: rooms, nights: nights, hasIn: hasIn, hasOut: hasOut, aA: aA, aK: aK, aB: aB, bfPax: bfPax, ex: ex, extra: extra,
        beds: Math.min(rooms, aA + (hasIn ? aK : 0)), freeKid: (aK && (nights || hasOut)) || aB, room: one(tier) * rooms, warn: warn, rate: +state.fx || S.usdRate };
      c.total = c.room + extra; c.krw = fxKrw(c.total);
      return c;
    },
    solNote: function () { var s = state.stay.sol, c = Stay.sol(); return [ST.soltanaNote, c.beds ? "퀸사이즈 엑스트라베드 " + c.beds + "개 포함" : "", s.note].filter(Boolean).join(". "); },
    solAsk: function () {
      var s = state.stay.sol, c = Stay.sol(), L = [["☝투숙타입&체크인날짜", c.p.name + (s.checkin ? " / " + dateKo(s.checkin) : "")], ["☝이용항공편명", s.flight], ["☝각방당 인원구성(아동은 만 나이)", s.pax], ["☝대표자 영문성함", s.ename]];
      c.p.times.forEach(function (label, i) { L.push(["☝" + label, i ? s.t2 : s.t1]); });
      L.push(["☝특이사항", Stay.solNote()]);
      return "안녕하세요, 솔타나콘도텔입니다. 문의해 주셔서 감사합니다.\n예약을 도와드릴 수 있도록 아래 내용을 채워서 보내 주시기 바랍니다.\n\n" + L.map(function (l) { return l[0] + ": " + (l[1] || ""); }).join("\n");
    },
    solText: function () {
      var s = state.stay.sol, c = Stay.sol(), per = c.rooms + "객실";
      var t = "안녕하세요, 솔타나콘도텔입니다. 요청하신 내용으로 안내해 드립니다.\n\n■ " + c.p.name + (s.checkin ? " — " + dateKo(s.checkin) : "") + "\n";
      t += "· 구성(객실당): " + c.parts + (c.parts.indexOf("+") > 0 ? " = " + usd(c.price) : "") + "\n";
      if (c.price !== c.official) t += "· 공식 요금: 객실당 " + usd(c.official) + " → " + c.tier.name + " 적용 " + usd(c.price) + "\n";
      t += "· " + per + " × " + usd(c.price) + " = " + usd(c.room) + "\n";
      c.ex.forEach(function (x) { t += "· " + x[0] + " = " + usd(x[1]) + "\n"; });
      if (c.aK && (c.nights || c.hasOut)) t += "· 룸온리·출국팩은 만 11세 이하 아동 추가 요금이 없습니다.\n";
      if (c.aB) t += "· 만 7세 미만 아동 " + c.aB + "명: 무료 (엑스트라베드·조식 미포함)\n";
      if (c.beds) t += "· 퀸사이즈 엑스트라베드 " + c.beds + "개 포함\n";
      t += "→ 합계 " + usd(c.total) + "\n" + fxLine(c.total) + "\n";
      if (s.pax) t += "· 인원: " + s.pax + "\n";
      if (s.flight) t += "· 항공편: " + s.flight + "\n";
      t += "\n※ " + ST.soltanaNote + "\n※ " + D.priceDate + " 기준 요금입니다.\n[한화 입금] " + S.accounts.krw + "\n\n예약이 확정되면 바우처를 보내 드리겠습니다. 감사합니다.";
      return t;
    },
    /* 장부에 넣을 요약 */
    booking: function () {
      var st = state.stay, tab = st.tab, o;
      if (tab === "resort") { var c = Stay.resort(), r = st.resort; o = { label: (r.name || "숙소") + " " + c.nights + "박", date: r.checkin, nights: c.nights, payText: c.all ? "객실 미정" : Stay.money(c.total, c.cur), profitPhp: c.all || c.cur !== "PHP" ? 0 : c.profit, profitUsd: c.all || c.cur !== "USD" ? 0 : c.profit }; }
      else if (tab === "villa") { var v = Stay.villa(); o = { label: v.d.name + " " + v.nights + "박", date: st.villa.checkin, nights: v.nights, payText: usd(v.total), profitPhp: 0, profitUsd: v.profit }; }
      else { var s = Stay.sol(); o = { label: "솔타나 " + s.p.name + " " + s.rooms + "객실", date: st.sol.checkin, nights: s.nights || 1, payText: usd(s.total), profitPhp: 0, profitUsd: 0, own: true }; }
      return o;
    }
  };

  /* ---------- 손님이 채워 보낸 폼 읽기 ---------- */
  function parseDate(s) {
    var m, now = new Date(), pad = function (n) { return ("0" + n).slice(-2); };
    if ((m = /(\d{4})\s*[-./년]\s*(\d{1,2})\s*[-./월]\s*(\d{1,2})/.exec(s))) return m[1] + "-" + pad(m[2]) + "-" + pad(m[3]);
    if ((m = /(\d{1,2})\s*월\s*(\d{1,2})\s*일?/.exec(s)) || (m = /(?:^|\D)(\d{1,2})[./](\d{1,2})(?:\D|$)/.exec(s))) {
      var y = now.getFullYear(); if (new Date(y, +m[1] - 1, +m[2]) < new Date(now.getFullYear(), now.getMonth(), now.getDate())) y++;
      return y + "-" + pad(m[1]) + "-" + pad(m[2]);
    }
    if ((m = /(?:^|\D)(\d{2})(\d{2})(\d{2})(?:\D|$)/.exec(s))) return "20" + m[1] + "-" + m[2] + "-" + m[3];
    /* 월일 붙여쓰기: "1120", "1120일", "120일"(=1월 20일) — 월 1~12·일 1~31 이 맞을 때만 */
    if ((m = /(?:^|\D)(\d{2})(\d{2})\s*일?(?:\D|$)/.exec(s)) || (m = /(?:^|\D)(\d)(\d{2})\s*일(?:\D|$)/.exec(s))) {
      var mo = +m[1], dd = +m[2];
      if (mo >= 1 && mo <= 12 && dd >= 1 && dd <= 31) {
        var y2 = now.getFullYear(); if (new Date(y2, mo - 1, dd) < new Date(now.getFullYear(), now.getMonth(), now.getDate())) y2++;
        return y2 + "-" + pad(mo) + "-" + pad(dd);
      }
    }
    return "";
  }
  /* 손님 글에서 메뉴·수량 읽기: "아로마 90분 2명, 키즈 60분 1명" → 메뉴 이름의 낱말과 분(시간)이 맞는 품목에 수량을 넣는다 */
  function parseMenu(shop, e, v) {
    var hits = 0, sq = function (t) { return t.replace(/\s+/g, "").toLowerCase(); };
    v.split(/[,，+\/]|그리고|\s및\s/).forEach(function (chunk) {
      var c = sq(chunk); if (!c) return;
      var mins = /(\d+)분/.exec(c), cnt = /(\d+)(?:명|인(?!\d)|대|건|매|장)/.exec(c.replace(/\d+~\d+인/g, "")), best = null, bs = 0;
      shop.items.forEach(function (it) {
        var im = /(\d+)분/.exec(it.label), base = it.label.replace(/\d+분/, "").replace(/\([^)]*\)/g, " ");
        if (im && mins && im[1] !== mins[1]) return;
        var toks = base.split(/[\s·\/~+]+/).filter(function (t) { return t.length >= 2; }), sc = 0;
        toks.forEach(function (t) { if (c.indexOf(sq(t)) >= 0) sc += t.length; });
        var paren = /\(([^)]*)\)/.exec(it.label); if (sc && paren && c.indexOf(sq(paren[1])) >= 0) sc += 3;
        if (im && mins) sc += 1; if (im && !mins) sc -= 0.5;
        if (sc > bs) { bs = sc; best = it; }
      });
      if (best && bs >= 2) { e.q[best.key] = cnt ? +cnt[1] : (e.q[best.key] || 1); hits++; }
    });
    return hits;
  }
  /* ---- 숙소 견적: 손님이 채워 보낸 글 읽기 (양식 읽기 + AI 읽기가 같은 적용 함수를 쓴다) ---- */
  var HOTEL_ALIAS = [["샹그릴라", "SHANGRILA MACTAN"], ["제이파크", "JPARK ISLAND RESORT (MIN. 2N)"], ["jpark", "JPARK ISLAND RESORT (MIN. 2N)"], ["솔레아", "SOLEA MACTAN"], ["뫼벤픽", "MOVENPICK HOTEL"], ["모벤픽", "MOVENPICK HOTEL"], ["마리바고", "MARIBAGO BLUEWATER"], ["더리프", "THE REEF"], ["크림슨", "CRIMSON RESORT & SPA"], ["바이호텔", "BAI HOTEL"]];
  var ROOM_KO = [["디럭스", "DELUXE"], ["프리미어", "PREMIER"], ["스위트", "SUITE"], ["스윗", "SUITE"], ["오션", "OCEAN"], ["씨뷰", "SEAVIEW"], ["시뷰", "SEAVIEW"], ["가든", "GARDEN"], ["패밀리", "FAMILY"], ["풀빌라", "POOL VILLA"], ["주니어", "JUNIOR"], ["스튜디오", "STUDIO"], ["스탠다드", "STANDARD"], ["슈페리어", "SUPERIOR"], ["클럽", "CLUB"], ["파노라마", "PANORAMA"], ["엑제큐티브", "EXECUTIVE"], ["이그제큐티브", "EXECUTIVE"], ["막탄", "MACTAN"], ["세부", "CEBU"], ["뽀로로", "PORORO"]];
  function normTxt(t) { return String(t || "").toUpperCase().replace(/[^A-Z0-9가-힣]/g, ""); }
  function roomTokens(t) {
    var u = String(t || "").toUpperCase();
    ROOM_KO.forEach(function (x) { u = u.split(x[0]).join(" " + x[1] + " "); });
    u = u.replace(/OCEAN\s*VIEW/g, "OCEAN").replace(/SEA\s*VIEW/g, "SEAVIEW").replace(/GARDEN\s*VIEW|G\/V/g, "GARDEN");
    return u.split(/[^A-Z0-9]+/).filter(function (w) { return w.length >= 2 && w !== "ROOM" && w !== "VIEW" && w !== "THE"; });
  }
  function applyStayParsed(o) {
    var st = state.stay, r = st.resort, n = 0, notes = [], H = window.PB_HOTELS || { hotels: [] };
    if (o.name) { st.cust.name = o.name; n++; }
    if (o.contact) { st.cust.contact = o.contact; n++; }
    var nights = +o.nights || 0;
    if (!nights && o.checkin && o.checkout) { var a = new Date(o.checkin + "T00:00:00"), b = new Date(o.checkout + "T00:00:00"), dd = Math.round((b - a) / 86400000); if (dd > 0 && dd < 90) nights = dd; }
    if (o.checkin) { r.checkin = o.checkin; st.villa.checkin = o.checkin; st.sol.checkin = o.checkin; n++; }
    if (nights) { r.nights = nights; st.villa.nights = nights; st.sol.nights = nights; n++; }
    if (o.hotel) {
      var nh = normTxt(o.hotel), idx = -1;
      HOTEL_ALIAS.forEach(function (al) { if (idx < 0 && nh.indexOf(normTxt(al[0])) >= 0) idx = H.hotels.findIndex(function (h) { return h.name === al[1]; }); });
      if (idx < 0 && nh.length >= 4) { var cand = H.hotels.map(function (h, i) { return [i, normTxt(h.name)]; }).filter(function (x) { return x[1] && (nh.indexOf(x[1]) >= 0 || x[1].indexOf(nh) >= 0); }); if (cand.length === 1) idx = cand[0][0]; }
      if (idx >= 0) { if (String(r.hotel) !== String(idx)) r.picks = []; r.hotel = String(idx); r.hotelName = H.hotels[idx].name; r.name = o.hotel; st.tab = "resort"; n++; }
      else { r.name = o.hotel; notes.push("숙소 '" + o.hotel + "'를 요금표에서 못 찾았습니다 — 숙소를 직접 골라 주세요"); }
    }
    if (o.adults) { r.adults = +o.adults; n++; }
    if (o.kids != null && String(o.kids) !== "") { r.kids = +o.kids || 0; n++; }
    if (o.kidAges) { r.kidAges = String(o.kidAges).split(/[^0-9]+/).filter(Boolean).join(","); n++; if (!+r.kids) r.kids = r.kidAges.split(",").length; }
    if (o.note) { r.reqNote = o.note; n++; }
    var hh = r.hotel !== "" && r.hotel != null ? H.hotels[+r.hotel] : null;
    if (hh && (o.rooms || []).length) {
      var picks = [];
      o.rooms.forEach(function (rm) {
        var cnt = Math.max(1, +rm.count || 1), tk = roomTokens(rm.type), best = null, bs = 0, tie = false;
        hh.rooms.forEach(function (x) {
          var rt = roomTokens(x.type), sc = tk.filter(function (w) { return rt.indexOf(w) >= 0; }).length - 0.1 * Math.abs(rt.length - tk.length);
          if (!tk.length) return;
          if (sc > bs) { bs = sc; best = x; tie = false; } else if (sc === bs && sc > 0) tie = true;
        });
        if (best && bs >= 1 && !tie) { picks.push({ type: best.type, rooms: cnt }); var bt = roomTokens(best.type); if (tk.some(function (w) { return bt.indexOf(w) < 0; })) notes.push("객실 '" + rm.type + "' → '" + best.type + "'로 가장 가깝게 맞췄습니다 — 맞는지 확인해 주세요"); } else notes.push("객실 '" + (rm.type || "(타입 없음)") + "'를 정확히 못 맞췄습니다 — 객실을 직접 골라 주세요");
      });
      if (picks.length) { r.picks = picks; n++; }
    }
    state.edited = {};
    return { n: n, notes: notes };
  }
  function parseStayPaste(text) {
    var o = { rooms: [] }, types = [], counts = [];
    text.split(/\r?\n/).forEach(function (line) {
      var m = /^([^:：]+)[:：]\s*(.*)$/.exec(line); if (!m) return; var k = m[1], v = m[2].trim(); if (!v) return;
      if (/영문/.test(k)) { o.ename = v; return; }
      if (/성함|대표자|예약자/.test(k)) { o.name = v; return; }
      if (/카카오|카톡|연락처|전화|휴대폰/.test(k)) { o.contact = v; return; }
      if (/체크인/.test(k)) { o.checkin = parseDate(v); return; }
      if (/체크아웃|박수/.test(k)) { var d = parseDate(v), nn = /(\d+)\s*박/.exec(v); if (d) o.checkout = d; if (nn) o.nights = +nn[1]; else if (!d && /^\d+$/.test(v)) o.nights = +v; return; }
      if (/객실\s*타입|룸\s*타입|객실\s*종류/.test(k)) { types = v.split(/[,，/、]|\s및\s/).map(function (t) { return t.trim(); }).filter(Boolean); return; }
      if (/객실\s*수|룸\s*수/.test(k)) { counts = (v.match(/\d+/g) || []).map(Number); return; }
      if (/아동\s*나이|나이/.test(k)) { if (!/없음|해당\s*없/.test(v)) o.kidAges = (v.match(/\d+/g) || []).join(","); return; }
      if (/인원/.test(k)) { var ad = /성인\s*(\d+)/.exec(v), kd = /아동\s*(\d+)/.exec(v); if (ad) o.adults = +ad[1]; if (kd) o.kids = +kd[1]; else if (ad) o.kids = 0; return; }
      if (/숙소|호텔|리조트/.test(k)) { o.hotel = v; return; }
      if (/요청|특이|기타|비고/.test(k)) { o.note = v; return; }
    });
    types.forEach(function (t, i) { o.rooms.push({ type: t, count: counts[i] != null ? counts[i] : (counts.length === 1 ? counts[0] : 1) }); });
    return applyStayParsed(o);
  }
  /* ---- 통합 붙여넣기: 손님 글 하나로 숙소 + 업체를 한 번에 채운다 ---- */
  var STAY_KEY = /체크인|객실\s*타입|객실\s*수|숙소|호텔|리조트/;
  function shopByHead(txt) {
    var hd = String(txt).replace(/[(（].*$/, "").replace(/[—–-].*$/, "").replace(/ /g, ""), best = null;
    D.shops.forEach(function (sh) { var nb = sh.name.replace(/[(（].*$/, "").replace(/ /g, ""); if (!best && (txt.indexOf(sh.name) >= 0 || (hd.length >= 2 && (nb.indexOf(hd) >= 0 || hd.indexOf(nb) >= 0)))) best = sh; });
    return best;
  }
  function ensureInCart(id) { if (inCart(id)) return true; if (state.cart.length >= 3) return false; state.cart.push(newEntry(id)); return true; }
  function syncCust() {
    var n = state.stay.cust.name || state.cust.name, c = state.stay.cust.contact || state.cust.contact;
    state.stay.cust.name = state.cust.name = n || ""; state.stay.cust.contact = state.cust.contact = c || "";
  }
  function parseUnified(text) {
    var stayL = [], shopL = [], mode = "pre", notes = [], added = [];
    text.split(/\r?\n/).forEach(function (line) {
      var hm = /^\s*■\s*(.+)$/.exec(line);
      if (hm) {
        var sh = shopByHead(hm[1]);
        if (sh) { mode = "shop"; if (ensureInCart(sh.id)) { if (added.indexOf(sh.name) < 0) added.push(sh.name); shopL.push(line); } else notes.push("업체 '" + sh.name + "'는 3곳이 넘어 담지 못했습니다"); return; }
        mode = STAY_KEY.test(hm[1]) ? "stay" : "other"; if (mode === "other") notes.push("'" + hm[1].trim() + "' 구역은 어느 업체인지 못 찾았습니다"); return;
      }
      if (mode === "stay") stayL.push(line); else if (mode === "shop") shopL.push(line); else if (mode === "pre") { var kv = /^([^:：]+)[:：]/.exec(line), kk = kv ? kv[1] : ""; if (/성함|대표자|예약자|카카오|카톡|연락처|전화|휴대폰/.test(kk) && !/영문/.test(kk)) { stayL.push(line); shopL.push(line); } else if (STAY_KEY.test(kk) || /인원|아동|나이|객실|요청|박수|체크아웃/.test(kk)) stayL.push(line); else shopL.push(line); }
    });
    var sr = { n: 0, notes: [] };
    if (stayL.some(function (l) { return STAY_KEY.test(l.split(/[:：]/)[0]); })) sr = parseStayPaste(stayL.join("\n"));
    var shopHits = state.cart.length ? parsePaste(shopL.join("\n")) : 0;
    syncCust(); state.edited = {};
    return { stay: sr.n, shops: shopHits, added: added, notes: sr.notes.concat(notes) };
  }
  function applyShopsParsed(r) {
    var n = 0;
    (r.entries || []).forEach(function (x) {
      var e = state.cart.filter(function (c) { return c.shopId === x.shopId; })[0]; if (!e) return; var shop = shopById(e.shopId);
      ["date", "time", "start", "ages", "pickup", "drop", "luggage", "option", "roster", "note"].forEach(function (k) { if (x[k] && (k !== "date" || /^\d{4}-\d{2}-\d{2}$/.test(x[k]))) { e[k] = x[k]; n++; } });
      (x.items || []).forEach(function (it) { if (it.qty > 0 && shop.items.some(function (s2) { return s2.key === it.key; })) { e.q[it.key] = it.qty; n++; } });
    });
    return n;
  }
  function viewPaste() {
    return '<div class="card"><h2 style="margin:0 0 6px">통합 붙여넣기</h2><p class="note" style="margin:0 0 8px">손님이 보낸 카톡 글을 한 번에 붙여넣으면 숙소 견적과 업체 견적 칸을 같이 채웁니다. 숙소 줄(숙소·체크인·객실…)은 숙소 견적으로, <b>■ 업체이름</b> 아래 줄은 그 업체 견적으로 들어갑니다.</p>' +
      '<textarea id="upaste" style="min-height:200px" placeholder="손님이 채워 보낸 예약폼 전체를 그대로 붙여넣으세요"></textarea>' +
      '<div class="row" style="margin-top:6px;flex-wrap:wrap"><button class="btn sm" id="doUniParse">내용 읽기</button><button class="btn sm gold" id="doUniAi">AI로 읽기(자유롭게 쓴 글)</button></div>' +
      '<p class="note" id="uMsg" style="margin:6px 0 0">[내용 읽기]는 양식대로 채운 글을 바로 읽습니다(무료). [AI로 읽기]는 양식 없이 쓴 글도 읽지만 로그인이 필요하고 건당 소액의 AI 사용료가 듭니다. 읽은 뒤 [숙소]·[견적] 화면에서 날짜·인원·금액을 꼭 확인하세요.</p></div>';
  }
  function parsePaste(text) {
    var cur = null, hits = 0;
    text.split(/\r?\n/).forEach(function (line) {
      var head = /^\s*■\s*(.+)$/.exec(line);
      if (head) { var hd = head[1].replace(/[(（].*$/, '').replace(/[—–-].*$/, '').replace(/ /g, ''); cur = state.cart.filter(function (e) { var nm = shopById(e.shopId).name, nb = nm.replace(/[(（].*$/, '').replace(/ /g, ''); return head[1].indexOf(nm) >= 0 || (hd.length >= 2 && (nb.indexOf(hd) >= 0 || hd.indexOf(nb) >= 0)); })[0] || null; return; }
      var m = /^([^:：]+)[:：]\s*(.*)$/.exec(line);
      if (!m) { if (line.trim()) (cur ? [cur] : state.cart).forEach(function (e) { var sh = shopById(e.shopId); if (sh.items.length > 5 || sh.cat === "마사지") hits += parseMenu(sh, e, line); }); return; }
      var k = m[1], v = m[2].trim(); if (!v) return;
      var targets = cur ? [cur] : state.cart;
      if (/성함|대표자|예약자(?! 전원)/.test(k) && !/영문/.test(k)) { state.cust.name = v; hits++; return; }
      if (/카카오|카톡|연락처|전화|휴대폰/.test(k)) { state.cust.contact = v; hits++; return; }
      targets.forEach(function (e) {
        var shop = shopById(e.shopId);
        if (/날짜|일정/.test(k)) { var d = parseDate(v); if (d) { e.date = d; hits++; } }
        else if (/나이/.test(k)) { e.ages = v; hits++; }
        else if (/영문/.test(k)) { e.roster = v; hits++; }
        else if (/인원|코스|메뉴|마사지|상품|골프장|차량/.test(k) && (shop.items.length > 5 || shop.cat === "마사지")) { hits += parseMenu(shop, e, v); }
        else if (/인원/.test(k)) {
          shop.items.forEach(function (it) {
            var word = it.key === "adult" ? "성인|입장권|어른" : it.key === "child" ? "아동|소인|아이|어린이" : it.key === "infant" ? "영아|유아" : it.label.replace(/\(.*\)/, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            var mm = new RegExp("(?:" + word + ")[^\\d/+,]*?(\\d+)").exec(v.replace(/\([^)]*\)/g, "")); if (mm) { e.q[it.key] = +mm[1]; hits++; }
          });
          var ag = /만\s*([\d,\s·세]+)/.exec(v); if (ag && !e.ages) e.ages = ag[1].replace(/세/g, "").trim();
        }
        else if (/시작/.test(k)) { e.start = v; hits++; }
        else if (/시간|선택/.test(k)) { e.time = v; hits++; }
        else if (/픽업/.test(k)) { e.pickup = v; hits++; }
        else if (/드랍|드롭/.test(k)) { e.drop = v; hits++; }
        else if (/요청|특이|기타|비고/.test(k)) { e.note = v; hits++; }
        else if (/짐|캐리어/.test(k)) { e.luggage = /무|없|x|no/i.test(v) ? "무" : "유"; if (!/^(유|무|있음|없음)$/.test(v)) e.note = (e.note ? e.note + ". " : "") + "짐: " + v; hits++; }
        else if (/항공|편명/.test(k)) { e.option = v; hits++; }
        else if (shop.optionLabel && k.indexOf(shop.optionLabel.replace(/\(.*\)/, "").trim()) >= 0) { e.option = v; hits++; }
      });
    });
    return hits;
  }

  /* ---------- 화면 ---------- */
  function toast(m) { var t = $("#toast"); t.textContent = m; t.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(function () { t.classList.remove("on"); }, 1600); }
  function copy(text) {
    var done = function () { toast("복사했습니다"); };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
    function fallback() { var ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); done(); } catch (e) { toast("복사 실패 — 직접 선택해 복사해 주세요"); } ta.remove(); }
  }
  function go(view, shopId) { state.view = view; if (shopId !== undefined) state.shopId = shopId; render(); window.scrollTo(0, 0); }
  function inCart(id) { return state.cart.some(function (e) { return e.shopId === id; }); }
  function toggleCart(id) {
    if (inCart(id)) state.cart = state.cart.filter(function (e) { return e.shopId !== id; });
    else if (state.cart.length >= 3) return toast("한 번에 3곳까지 담을 수 있습니다");
    else state.cart.push(newEntry(id));
    state.edited = {}; save(); render();
  }
  function minPrice(shop) { var it = shop.items.filter(function (x) { return x.sp; })[0]; return it ? priceStr(it.sp).replace("예약금 ", "").replace(/현장결제 /g, "") + "~" : "상담 안내"; }
  function chips(list, cur, attr) { return '<div class="chips">' + list.map(function (c) { return '<button class="chip' + (c === cur ? " on" : "") + '" data-' + attr + '="' + esc(c) + '">' + esc(c) + "</button>"; }).join("") + "</div>"; }

  function viewHome() {
    var q = state.q.trim().toLowerCase();
    var shops = D.shops.filter(function (s) { return (state.cat === "전체" || s.cat === state.cat) && (!q || (s.name + s.cat + s.tagline).toLowerCase().indexOf(q) >= 0); })
      .sort(function (a, b) { return a.name.localeCompare(b.name, "ko"); });
    return '<input class="search" id="q" placeholder="업체명·상품 검색 (예: 호핑, 라움)" value="' + esc(state.q) + '">' + chips(["전체"].concat(D.categories), state.cat, "cat") +
      '<p class="note" style="margin:6px 2px 0">업체 ' + shops.length + "곳 · [담기]를 누르면 견적에 들어갑니다(한 번에 3곳까지).</p>" +
      '<div class="list">' + (shops.length ? shops.map(function (s) {
        return '<div class="row"><button class="shop grow" data-shop="' + s.id + '"><div class="grow" style="min-width:0"><div class="cat">' + s.cat + '</div><div class="nm">' + esc(s.name) + '</div><div class="tg">' + esc(s.tagline) + '</div></div><div class="pr">' + esc(minPrice(s)) + "</div></button>" +
          '<button class="btn sm ' + (inCart(s.id) ? "gold" : "ghost") + '" data-cart="' + s.id + '">' + (inCart(s.id) ? "담김 ✓" : "담기") + "</button></div>";
      }).join("") : '<div class="empty">검색 결과가 없습니다.</div>') + "</div>";
  }
  function outBox(id, title, text) {
    var v = state.edited[id] != null ? state.edited[id] : text;
    return '<div class="out"><div class="hd"><b>' + title + '</b><span><button class="btn sm ghost" data-reset="' + id + '">원래대로</button> <button class="btn sm gold" data-copy="' + id + '">복사</button></span></div><textarea data-out="' + id + '" rows="' + Math.min(18, Math.max(4, v.split("\n").length + 1)) + '">' + esc(v) + "</textarea></div>";
  }
  function viewShop() {
    var s = shopById(state.shopId); if (!s) return viewHome();
    var nv = state.showNet, rows = s.items.map(function (it) {
      var cm = s.commission || 0, net = it.sp ? (cm ? it.sp : (it.net || { on: it.sp.on, usd: it.sp.usd })) : null, g = function (o, k) { return (o && o[k]) || 0; };
      var pk = !it.sp ? 0 : cm ? Math.round(g(it.sp, "dep") * cm) : g(it.sp, "dep") - g(net, "dep"), pp = !it.sp ? 0 : cm ? Math.round(g(it.sp, "on") * cm) : g(it.sp, "on") - g(net, "on"), pu = !it.sp ? 0 : cm ? Math.round(g(it.sp, "usd") * cm) : g(it.sp, "pre") + g(it.sp, "usd") - g(net, "pre") - g(net, "usd");
      return "<tr><td>" + esc(it.label) + '</td><td class="off">' + (it.off ? priceStr(it.off) : "-") + '</td><td class="sp">' + priceStr(it.sp) + "</td>" + (nv ? "<td>" + (s.noNet || !net ? "미입력" : cm ? "커미션 " + (cm * 100) + "%" : priceStr(net)) + "</td><td><b>" + (s.noNet || !net ? "-" : profitStr(pk, pp, pu)) + "</b></td>" : "") + "</tr>";
    }).join("");
    return '<button class="btn sm ghost" data-view="home">← 목록</button>' +
      '<div class="card" style="margin-top:10px"><div class="cat">' + s.cat + "</div><h1>" + esc(s.name) + "</h1><p>" + esc(s.tagline) + '</p><div class="row"><button class="btn ' + (inCart(s.id) ? "ghost" : "gold") + ' grow" data-cart="' + s.id + '">' + (inCart(s.id) ? "견적에서 빼기" : "견적에 담기") + '</button>' + (state.cart.length ? '<button class="btn grow" data-view="quote">견적 작성으로 →</button>' : "") + "</div></div>" +
      '<div class="card" style="margin-top:10px"><div class="row"><h2 class="grow">요금</h2><button class="btn sm ' + (nv ? "" : "ghost") + '" id="toggleNet">' + (nv ? "넷가 숨기기" : "넷가 보기") + '</button></div><div class="scroll"><table><tr><th>구분</th><th>공식 요금</th><th>' + B + " 스페셜</th>" + (nv ? "<th>넷가(내부)</th><th>1인 수익</th>" : "") + "</tr>" + rows + "</table></div>" +
      (nv ? '<p class="warn">넷가·수익은 이 화면에서만 보이고, 복사되는 글에는 들어가지 않습니다.</p>' : "") +
      (s.refund ? '<p class="note">환불: ' + esc(s.refund) + "</p>" : "") + (s.memo ? '<p class="note">메모(내부용): ' + esc(s.memo) + "</p>" : "") + "</div>" +
      '<div class="card" style="margin-top:10px"><h2>손님께 바로 보내기</h2>' + outBox("intro_" + s.id, "업체 소개 + 상세 글 링크", Text.intro(s)) + outBox("price_" + s.id, "요금 안내(공식 요금 / " + B + " 스페셜)", Text.price(s)) + outBox("after_" + s.id, "예약 완료 후 안내", Text.after(s, "")) + "</div>";
  }
  function field(e, i, key, label, type, opts) {
    var v = esc(e[key] || ""), at = 'data-e="' + i + '" data-k="' + key + '"';
    if (opts) return "<div><label>" + label + "</label><select " + at + '><option value="">선택</option>' + opts.map(function (o) { return "<option" + (o === e[key] ? " selected" : "") + ">" + o + "</option>"; }).join("") + "</select></div>";
    return "<div><label>" + label + "</label><input " + at + (key === "pickup" || key === "drop" ? ' list="places"' : "") + ' type="' + (type || "text") + '" value="' + v + '"></div>';
  }
  /* 메뉴가 많은 업체(6개 이상): 메뉴를 고르고 수량을 정해 [추가] — 고른 메뉴만 아래에 나온다 */
  function menuPick(s, e, i) {
    if (s.items.length <= 5) return "";
    var any = s.items.some(function (it) { return e.q[it.key] > 0; }), qn = []; for (var n = 1; n <= 20; n++) qn.push(n);
    return '<label>메뉴 고르기 → 수량 → [추가]</label><div class="pick"><select id="msel' + i + '">' + s.items.map(function (it) { return '<option value="' + it.key + '">' + esc(it.label + " · " + priceStr(it.sp).replace("예약금 ", "").replace(/현장결제 /g, "")) + "</option>"; }).join("") + '</select><select id="mqty' + i + '">' + qn.map(function (n) { return '<option value="' + n + '">' + n + "</option>"; }).join("") + '</select><button class="btn sm gold" data-madd="' + i + '">추가</button></div>' +
      (any ? '<p class="note" style="margin:8px 0 2px">고른 메뉴 (수량을 0으로 바꾸면 빠집니다)</p>' : '<p class="note" style="margin:8px 0 0">아직 고른 메뉴가 없습니다.</p>');
  }
  function viewQuote() {
    if (!state.cart.length) return '<div class="empty"><p>견적에 담긴 업체가 없습니다.</p><p class="note">업체 목록에서 [담기]를 누르면 여기에 들어옵니다. 한 번에 3곳까지 함께 견적을 낼 수 있습니다.</p><button class="btn gold" data-view="home">업체 고르기</button></div>';
    var c = Calc.cart(), nums = []; for (var n = 0; n <= 20; n++) nums.push(n);
    var h = '<h1>견적·예약 작성</h1><div class="card"><h2>손님 정보</h2><div class="grid2"><div><label>대표자 성함</label><input data-c="name" value="' + esc(state.cust.name) + '"></div>' + (state.cust.useContact || state.cust.contact || state.cart.some(function (e) { return shopById(e.shopId).needContact; }) ? '<div><label>카카오톡 ID 또는 연락처</label><input data-c="contact" value="' + esc(state.cust.contact) + '"></div>' : "") + '</div>' +
      '<label class="chk"><input type="checkbox" id="useContact"' + (state.cust.useContact ? " checked" : "") + '> 카카오톡 ID·연락처 칸 쓰기(업체가 손님께 직접 연락하는 곳 등 필요할 때만)</label>' +
      '<details style="margin-top:10px"><summary class="note">손님이 채워 보낸 내용 붙여넣기</summary><textarea id="paste" placeholder="손님이 보낸 글을 그대로 붙여넣고 [내용 읽기]를 누르세요"></textarea><div class="row" style="margin-top:6px;flex-wrap:wrap"><button class="btn sm" id="doParse">내용 읽기</button><button class="btn sm gold" id="doAi">AI로 읽기(자유롭게 쓴 글)</button></div><p class="note" id="aiMsg" style="margin:6px 0 0">[내용 읽기]는 양식대로 채운 글을 바로 읽습니다(무료). [AI로 읽기]는 양식 없이 쓴 글도 읽지만 로그인이 필요하고 건당 소액의 AI 사용료가 듭니다.</p></details></div>';
    state.cart.forEach(function (e, i) {
      var s = shopById(e.shopId), r = c.rows[i], mas = s.cat === "마사지";
      h += '<div class="card" style="margin-top:10px"><div class="row"><div class="grow"><div class="cat">' + s.cat + "</div><h2>" + esc(s.name) + '</h2></div><button class="btn sm danger" data-cart="' + s.id + '">빼기</button></div>' +
        '<p class="note">★ 견적 필수: 날짜·인원' + (mas ? "·코스" : "") + ". 나머지는 예약 확정 때 채워도 됩니다.</p>" +
        '<div class="grid2">' + field(e, i, "date", "이용 날짜 ★", "date") + (mas ? (s.needStart ? field(e, i, "start", "마사지 시작 시간") : "") : (s.timeOptions ? field(e, i, "time", "선택", "", s.timeOptions) : field(e, i, "time", "시간(필요 시)"))) + "</div>" +
        '<div style="margin:10px 0">' + menuPick(s, e, i) + (s.items.length > 5 ? s.items.filter(function (it) { return e.q[it.key] > 0; }) : s.items).map(function (it) {
          return '<div class="qty"><span>' + esc(it.label) + "<small>" + priceStr(it.sp) + '</small></span><select data-e="' + i + '" data-q="' + it.key + '">' + nums.map(function (x) { return "<option" + (x === Number(e.q[it.key] || 0) ? " selected" : "") + ">" + x + "</option>"; }).join("") + "</select></div>";
        }).join("") + "</div>" +
        '<div class="grid2">' + (mas ? "" : field(e, i, "ages", "아동 만 나이")) + (s.noPickup ? "" : field(e, i, "pickup", "픽업 장소") + (mas ? field(e, i, "time", "픽업 시간") : "") + field(e, i, "drop", "드랍 장소") + field(e, i, "luggage", "짐 보관", "", ["유", "무"])) + (s.optionLabel ? field(e, i, "option", s.optionLabel) : "") + "</div>" +
        (s.form === "clubcebu" || s.form === "lokal" ? '<div style="margin-top:10px"><label>예약자 전원 영문이름·생년월일' + (s.form === "clubcebu" ? "·성별" : "") + '</label><textarea data-e="' + i + '" data-k="roster" style="min-height:70px">' + esc(e.roster) + "</textarea></div>" : "") +
        '<div style="margin-top:10px"><label>특이사항(직접 입력)</label><textarea data-e="' + i + '" data-k="note" style="min-height:60px">' + esc(e.note) + "</textarea></div>" +
        (s.needContact && !state.cust.contact ? '<p class="warn">이 업체는 손님 카카오톡 ID 또는 한국 연락처가 꼭 필요합니다.</p>' : "") +
        '<p class="note" style="margin:8px 0 0">' + (r.noPrice ? "요금은 업체가 직접 안내합니다." : "예약 시 " + nowStr(r.sp) + (onsiteStr(r.sp) ? (s.allPrepay ? " · 예약 시 결제 " : " · 현장결제 ") + onsiteStr(r.sp) : "") + (s.prepayOnsite ? " (원화 사전결제 " + won(r.prepayKrw) + ")" : "")) + "</p></div>";
    });
    if (c.pre) h += '<div class="card" style="margin-top:10px">' + fxInput() + "</div>";
    if (c.rows.some(function (r) { return r.shop.prepayOnsite; })) h += '<div class="card" style="margin-top:10px"><label>페소 → 원 환산(클럽세부 사전결제용, 1페소당 원)</label><input id="rate" type="number" step="0.1" value="' + state.rate + '"></div>';
    h += '<div class="total" style="margin-top:12px"><small>손님이 지금 입금할 금액</small><div class="big">' + won(c.payNow) + (c.pre ? " + " + usd(c.pre) : "") + "</div>" + (c.pre ? "<small>달러분 원화 약 " + won(fxKrw(c.pre)) + " (현찰 살 때 환율 적용)</small>" : "") + "<small>현장결제 합계 " + (onsiteStr({ on: c.on, usd: c.usd }) || "없음") + '</small></div>' +
      '<div class="profit" style="margin-top:8px">예상 수익: ' + profitStr(c.profitKrw, c.profitPhp, c.profitUsd) + (c.unknown.length ? " · 수익 미계산: " + esc(c.unknown.join(", ")) : "") + " (손님·업체용 글에는 나가지 않습니다)</div>";
    var tabs = [["ask", "① 문의 답변"], ["quote", "② 견적·입금 안내"], ["done", "③ 입금 확인·완료"], ["vendor", "④ 업체 전달폼"]];
    h += '<div class="card" style="margin-top:12px"><div class="tabs">' + tabs.map(function (t) { return '<button data-tab="' + t[0] + '" class="' + (state.tab === t[0] ? "on" : "") + '">' + t[1] + "</button>"; }).join("") + "</div>";
    if (state.tab === "ask") h += outBox("ask", "손님께 보낼 문의 답변(빈칸 채워 달라는 안내)", Text.ask());
    if (state.tab === "quote") h += outBox("quote", "견적과 입금 안내", Text.quote());
    if (state.tab === "done") h += outBox("done", "입금 확인 + 마무리 인사", Text.done());
    if (state.tab === "vendor") h += state.cart.map(function (e) { return outBox("vendor_" + e.shopId, shopById(e.shopId).name + "에 보낼 예약폼 (" + B + " 수익은 빠져 있습니다)", Text.vendor(e)); }).join("");
    h += '</div><div class="row" style="margin-top:12px"><button class="btn gold grow" id="saveBooking">장부에 저장</button><button class="btn ghost" id="clearCart">새 견적</button></div>';
    return h;
  }

  /* ---------- 숙소 화면 ---------- */
  function sInput(path, label, type, extra) { var o = state.stay[path[0]]; return "<div><label>" + label + '</label><input data-s="' + path.join(".") + '" type="' + (type || "text") + '" value="' + esc(o[path[1]]) + '"' + (extra || "") + "></div>"; }
  function sSelect(path, label, opts) { var cur = String(state.stay[path[0]][path[1]]); return "<div><label>" + label + '</label><select data-s="' + path.join(".") + '">' + opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(o[0]) === cur ? " selected" : "") + ">" + esc(o[1]) + "</option>"; }).join("") + "</select></div>"; }
  function range(a, b) { var o = []; for (var i = a; i <= b; i++) o.push([i, i ? i + "명" : "없음"]); return o; }
  function viewStay() {
    var st = state.stay, tabs = [["resort", "리조트·호텔"], ["villa", "풀빌라"], ["sol", "솔타나"]];
    var h = "<h1>숙소 견적</h1>" + '<div class="tabs">' + tabs.map(function (t) { return '<button data-stab="' + t[0] + '" class="' + (st.tab === t[0] ? "on" : "") + '">' + t[1] + "</button>"; }).join("") + "</div>" +
      '<div class="card"><div class="grid2">' + sInput(["cust", "name"], "손님 성함(장부 저장용)") + sInput(["cust", "contact"], "카카오톡 ID 또는 연락처") + fxInput() + "</div>" +
        '<details style="margin-top:10px"><summary class="note">손님이 채워 보낸 내용 붙여넣기</summary><textarea id="spaste" placeholder="손님이 채워 보낸 예약폼(또는 자유롭게 쓴 글)을 그대로 붙여넣으세요"></textarea><div class="row" style="margin-top:6px;flex-wrap:wrap"><button class="btn sm" id="doStayParse">내용 읽기</button><button class="btn sm gold" id="doStayAi">AI로 읽기(자유롭게 쓴 글)</button></div><p class="note" id="saiMsg" style="margin:6px 0 0">[내용 읽기]는 우리가 보낸 예약폼 양식대로 채운 글을 바로 읽습니다(무료). [AI로 읽기]는 양식 없이 쓴 글도 읽지만 로그인이 필요하고 건당 소액의 AI 사용료가 듭니다. 읽은 뒤 날짜·인원·객실·금액을 꼭 한 번 확인하세요.</p></details></div>';
    if (st.tab === "resort") {
      var r = st.resort, c = Stay.resort(), hh = c.h, regions = {}, m = function (n) { return Stay.money(n, c.cur); };
      if (c.galaHit) h += '<div style="margin:8px 0;padding:10px 14px;border-radius:10px;background:#7a1f1f;color:#fff;font-weight:700">🎉 갈라 디너 포함 견적 — 아래 갈라 금액이 합계에 들어 있습니다</div>';
      H.hotels.forEach(function (x, i) { (regions[x.region] = regions[x.region] || []).push([i, x.name]); });
      h += '<div class="card" style="margin-top:10px"><h2>리조트·호텔</h2>' +
        '<div><label>숙소 — TMJ 요금 ' + esc(H.date || "없음") + " 기준 " + H.hotels.length + '곳</label><select id="hotelSel"><option value="">직접 입력</option>' + Object.keys(regions).map(function (g) { return '<optgroup label="' + esc(g) + '">' + regions[g].map(function (x) { return '<option value="' + x[0] + '"' + (String(x[0]) === String(r.hotel) ? " selected" : "") + ">" + esc(x[1]) + "</option>"; }).join("") + "</optgroup>"; }).join("") + "</select></div>" +
        '<div class="grid2" style="margin-top:10px">' + sInput(["resort", "name"], "손님 글에 쓸 숙소 이름") + sInput(["resort", "checkin"], "체크인 ★(성수기 요금 계산)", "date") + sInput(["resort", "nights"], "박수", "number", ' min="1"') +
        sSelect(["resort", "adults"], "성인(갈라·의무 요금 계산)", range(0, 12)) + sSelect(["resort", "kids"], "아동", range(0, 10)) + (r.kids > 0 ? sInput(["resort", "kidAges"], "아동 나이(쉼표로, 예: 5,8) — 연령별 요금 계산", "text", ' placeholder="예: 5,8"') : "") + sSelect(["resort", "ebn"], "엑스트라 베드 사용 인원(성인·아동 합계)", range(0, 6)) +
        (hh ? "" : sSelect(["resort", "cur"], "통화", [["PHP", "페소"], ["USD", "달러"], ["KRW", "원화(트리셰이드 등)"]])) +
        sInput(["resort", "margin"], "1박당 붙이는 금액(비우면 " + (ST.resortMargin[c.cur] || 0) + (c.cur === "USD" ? "달러" : c.cur === "KRW" ? "원" : "페소") + ")", "number") + "</div>";
      if (hh) {
        h += '<div style="margin-top:12px"><label>객실 타입 고르기 → 객실 수 → [추가]</label><div class="pick"><select id="roomSel">' + hh.rooms.map(function (x) { return '<option value="' + esc(x.type) + '">' + esc(x.type + (x.dyn ? " · 다이나믹 요금(TMJ 확인)" : x.pkgN ? " · " + x.pkgN + "박 패키지 " + Stay.money(x.rate + c.margin * x.pkgN, x.cur) : " · 1박 " + Stay.money(x.rate + c.margin, x.cur)) + (x.promo ? " (프로모 " + num(x.promo + c.margin) + ")" : "") + (x.next != null && hh.next ? " (" + hh.next[0].slice(5).replace("-", "/") + "~ " + num(x.next + c.margin) + ")" : "")) + "</option>"; }).join("") + '</select><select id="roomQty">' + [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(function (n) { return "<option value=\"" + n + '">' + n + "객실</option>"; }).join("") + '</select><button class="btn sm gold" id="addPick">추가</button></div>' +
          (r.picks.length ? r.picks.map(function (p, i) { return '<div class="picked"><span class="grow">' + esc(p.type) + " · <b>" + p.rooms + '객실</b></span><button class="btn sm danger" data-pdel="' + i + '">빼기</button></div>'; }).join("") : '<p class="note">고른 객실이 없으면 전체 객실 타입의 요금이 한꺼번에 나갑니다.</p>') + "</div>";
        var info = [];
        if (!r.checkin) info.push("체크인 날짜를 넣어야 성수기 추가 요금·갈라 디너가 계산됩니다.");
        c.lines.forEach(function (x) { if (x.sur) info.push(x.type + ": 성수기 추가 요금 " + m(x.sur) + " (" + x.surNames.join(", ") + ", " + x.surN + "박)"); if (x.promoN) info.push(x.type + ": 프로모 요금 " + x.promoN + "박 적용"); });
        c.extras.forEach(function (x) { info.push(x.name + ": " + (x.adult ? "성인 " + m(x.adult) : "") + (x.child ? (x.adult ? " / " : "") + "아동 " + m(x.child) : "") + (x.total ? " → " + m(x.total) : " (인원을 넣으면 계산)")); });
        if (c.philco && (c.philco.rows.length || c.philco.hot)) h += '<div class="card" style="margin-top:12px;border:2px solid #0a8a5a;background:#eafbf3"><b style="color:#0a8a5a">💰 ' + (c.philco.rows.length ? "필코가 TMJ보다 더 쌉니다 — 예약은 필코로 (차액이 투윙스 수익)" : "필코 안내") + '</b><span style="color:#066"> (마크업 전 원가 · ' + c.nights + '박 기준 · 손님 글에는 나가지 않음)</span>' +
          c.philco.rows.map(function (x) { return "<br>• " + esc(x.type) + (x.rooms > 1 ? " ×" + x.rooms + "객실" : "") + ": TMJ " + m(x.tmj) + " / 필코 " + m(x.philco) + (x.diff > 0 ? " → <b>" + m(x.diff) + " 절감</b>" : " → 같거나 TMJ가 쌈") + (x.early ? "<br>&nbsp;&nbsp;&nbsp;필코 얼리버드 적용 시 " + m(x.early) + " → <b>" + m(x.earlyDiff) + " 절감</b>" : ""); }).join("") +
          (c.philco.early ? "<br><span style='font-size:12px'>※ " + esc(c.philco.early) + "</span>" : "") + (c.philco.hot ? "<br><b>" + esc(c.philco.hot) + "</b>" : "") + "<br><span style='font-size:12px'>※ 비교값은 TMJ 자료(" + esc(window.PB_HOTELS.date) + ")와 필코 표(" + esc(window.PB_PHILCO.date) + ") 기준 — 예약 전에 두 곳 현행가를 한 번 더 확인하세요.</span></div>";
        if (c.hardWarn.length) h += '<p class="warn big" style="margin-top:10px">🚨 ' + c.hardWarn.map(esc).join("<br>🚨 ") + "</p>";
        if (c.infos.length) h += '<p class="warn" style="margin-top:10px">ℹ ' + c.infos.map(esc).join("<br>ℹ ") + "</p>";
        if (c.minWarn.length) h += '<p class="warn big" style="margin-top:10px">⚠ ' + c.minWarn.map(esc).join("<br>⚠ ") + "</p>";
        if (c.remarkLines.length) h += '<div class="warn" style="margin-top:10px"><b>추가 인원·조식·아동 요금 등 TMJ 비고(자동 계산되지 않으니 직접 확인해 합산)</b><br>' + c.remarkLines.map(esc).join("<br>") + "</div>";
        if (info.length) h += '<p class="warn" style="margin-top:10px">' + info.map(esc).join("<br>") + "</p>";
        h += '<details style="margin-top:8px"><summary class="note">TMJ 비고 원문(내부 참고 — 최소 숙박·픽업·조식 인원 등)</summary><div class="note pre">' + esc(hh.remark || "없음") + (hh.sur.length ? "\n\n[써차지]\n" + hh.sur.map(function (x) { return x.name + " " + x.from + " ~ " + x.to; }).join("\n") : "") + "</div></details>";
      } else {
        h += '<div style="margin-top:10px">' + r.rows.map(function (x, i) {
          return '<div class="rrow"><input data-rr="' + i + '.type" placeholder="객실 타입" value="' + esc(x.type) + '"><input data-rr="' + i + '.tmj" type="number" placeholder="TMJ 1박" value="' + esc(x.tmj) + '"><input data-rr="' + i + '.rooms" type="number" min="1" placeholder="객실 수" value="' + esc(x.rooms || 1) + '"><button class="btn sm danger" data-rdel="' + i + '">빼기</button></div>';
        }).join("") + '<button class="btn sm ghost" id="addRow" style="margin-top:6px">+ 객실 줄 추가</button></div>';
      }
      h += "</div>" + '<div class="total" style="margin-top:12px"><small>' + (c.all ? "전체 객실 타입 안내(객실을 고르면 합계가 나옵니다)" : "손님 견적 합계(" + c.nights + "박)") + '</small><div class="big">' + (c.all ? "객실 " + c.lines.length + "종" : m(c.total)) + "</div>" + (c.exTotal ? "<small>이 중 갈라·의무 요금 " + m(c.exTotal) + "</small>" : "") + "</div>" +
        '<div class="profit" style="margin-top:8px">' + (c.all ? "객실 1개·1박당 수익 " + m(c.margin) : "예상 수익 " + m(c.profit)) + " (손님 글에는 나가지 않습니다)</div>" +
        (c.needOk ? '<label class="warn big" style="display:flex;gap:10px;align-items:center;margin-top:12px;cursor:pointer"><input type="checkbox" id="okChk" style="width:24px;height:24px"' + (c.okDone ? " checked" : "") + '><span>서차지·갈라 디너·성인/아동 추가금·조식 추가금·연말 날짜를 모두 확인했습니다 (체크해야 견적 복사가 됩니다)</span></label>' : "") +
        '<div class="card" style="margin-top:12px">' + outBox("stay_resort_ask", "① 손님께 보낼 예약폼(빈칸 채워 달라는 안내)", Stay.resortAsk()) + outBox("stay_resort", "② 숙소 견적", Stay.resortText()) + "</div>" + (c.checks.length ? '<div class="card" style="margin-top:12px;border:2px solid #d00"><b style="color:#d00">🔴 체크요망 — 확실하지 않거나 애매한 내용(손님 글에는 나가지 않습니다)</b><br><span style="color:#d00">• ' + c.checks.map(esc).join("<br>• ") + "</span></div>" : "");
    }
    if (st.tab === "villa") {
      var v = st.villa, vc = Stay.villa();
      h += '<div class="card" style="margin-top:10px"><h2>풀빌라 (공식 = 넷가+' + ST.villaDirectAdd + "달러, 손님가 = 넷가+수익)</h2>" +
        sSelect(["villa", "idx"], "풀빌라", ST.villas.map(function (x, i) { return [i, x.name + " · " + x.rooms]; })) +
        '<div class="grid2" style="margin-top:10px">' + sInput(["villa", "checkin"], "체크인", "date") + sInput(["villa", "nights"], "박수", "number", ' min="1"') + sInput(["villa", "profit"], "1박 수익(달러, 기본 50·때로 40)", "number") + "</div>" +
        '<div class="scroll" style="margin-top:10px"><table><tr><th>구분</th><th>1박</th></tr><tr><td>넷가(내부)</td><td>' + usd(vc.d.net) + "</td></tr><tr><td>공식 요금(직세일)</td><td class=\"off\">" + usd(vc.direct) + '</td></tr><tr><td>손님가(' + B + ' 스페셜)</td><td class="sp">' + usd(vc.sell) + "</td></tr></table></div>" +
        (vc.d.note ? '<p class="note">' + esc(vc.d.note) + "</p>" : "") + "</div>" +
        '<div class="total" style="margin-top:12px"><small>손님 견적 합계(' + vc.nights + '박)</small><div class="big">' + usd(vc.total) + "</div><small>원화 약 " + won(fxKrw(vc.total)) + " (현찰 살 때 환율 적용)</small></div>" +
        '<div class="profit" style="margin-top:8px">예상 수익 ' + usd(vc.profit) + " (손님 글에는 나가지 않습니다)</div>" +
        '<div class="card" style="margin-top:12px">' + outBox("stay_villa_ask", "① 손님께 보낼 예약폼(빈칸 채워 달라는 안내)", Stay.villaAsk()) + outBox("stay_villa", "② 풀빌라 견적", Stay.villaText()) + "</div>";
    }
    if (st.tab === "sol") {
      var s = st.sol, sc = Stay.sol();
      h += '<div class="card" style="margin-top:10px"><h2>솔타나콘도텔</h2>' +
        '<div class="scroll"><table><tr><th>요금</th>' + [["in", "입국팩"], ["out", "출국팩"], ["inout", "입국팩+출국팩"], ["room", "룸온리 1박"]].map(function (x) { return "<th>" + x[1] + "</th>"; }).join("") + "</tr>" + ST.soltanaTiers.map(function (t) { return "<tr><td>" + (t.key === sc.tier.key ? "<b>" + t.name + " ✓</b>" : t.name) + "</td>" + [["in", "입국팩"], ["out", "출국팩"], ["inout", "입국팩+출국팩"], ["room", "룸온리 1박"]].map(function (x) { return '<td class="' + (t.key === sc.tier.key && (x[0] === sc.p.pack || (x[0] === "room" && sc.p.room)) ? "sp" : "off") + '">' + t.price[x[0]] + "</td>"; }).join("") + "</tr>"; }).join("") + '</table></div><p class="note">단위: 달러, 객실당(룸온리는 1박당). 기준 인원 성인 2 + 아동 2.</p>' +
        '<div class="grid2">' + sSelect(["sol", "tier"], "적용 요금", ST.soltanaTiers.map(function (t) { return [t.key, t.name]; })) + sSelect(["sol", "key"], "투숙 타입", ST.soltana.map(function (x) { return [x.key, x.name]; })) +
        sInput(["sol", "checkin"], "체크인 날짜", "date") + sSelect(["sol", "rooms"], "객실 수", [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(function (n) { return [n, n + "객실"]; })) + (sc.p.room ? sSelect(["sol", "nights"], "룸온리 박수", [1, 2, 3, 4, 5, 6].map(function (n) { return [n, n + "박"]; })) : "") + 
        sSelect(["sol", "addAdult"], "성인 추가(입국팩 20·룸온리 1박 15·출국팩 20달러)", range(0, 10)) + sSelect(["sol", "addKid"], "아동 추가 만 7~11세(입국팩만 15달러, 그 외 무료)", range(0, 10)) + sSelect(["sol", "addBaby"], "만 7세 미만 아동(무료, 엑베·조식 미포함)", range(0, 10)) +
        (sc.p.room ? sSelect(["sol", "bfPax"], "룸온리 조식 추가(1인 1박 " + ST.soltanaAdd.room.breakfast + "달러)", range(0, 10)) : "") + sInput(["sol", "totalPax"], "총 인원(객실당 최대 " + ST.soltanaMaxPax + "명 확인용)", "number", ' min="1"') +
        sInput(["sol", "flight"], "이용 항공편명") + sInput(["sol", "pax"], "각 방 인원 구성(아동 만 나이)") + sInput(["sol", "ename"], "대표자 영문 성함") + sc.p.times.map(function (label, i) { return sInput(["sol", i ? "t2" : "t1"], label); }).join("") + "</div>" +
        '<div style="margin-top:10px"><label>특이사항(추가로 적을 내용)</label><input data-s="sol.note" value="' + esc(s.note) + '"></div>' +
        '<p class="note">특이사항에 자동으로 들어가는 글: ' + esc(Stay.solNote()) + "</p>" +
        (sc.warn.length ? '<p class="warn big">⚠ ' + sc.warn.map(esc).join("<br>⚠ ") + "</p>" : "") +
        '<p class="note">엑스트라베드 ' + sc.beds + "개 포함(객실 " + sc.rooms + "개 — 엑스트라베드는 객실당 1개까지). 조식은 입국팩 추가 인원에만 포함되고, 룸온리는 조식 추가를 고른 인원만, 출국팩은 조식이 없습니다.</p></div>" +
        '<div class="total" style="margin-top:12px"><small>합계 (' + sc.tier.name + ')</small><div class="big">' + usd(sc.total) + "</div><small>객실 " + usd(sc.room) + (sc.extra ? " + 추가 인원 " + usd(sc.extra) : "") + " · 원화 약 " + won(sc.krw) + " (현찰 살 때 환율 적용)</small></div>" +
        '<div class="card" style="margin-top:12px">' + outBox("sol_ask", "① 손님께 보낼 예약폼(빈칸 채워 달라는 안내)", Stay.solAsk()) + outBox("sol_quote", "② 금액 안내", Stay.solText()) + "</div>";
    }
    return h + '<div class="row" style="margin-top:12px"><button class="btn gold grow" id="saveStay">이 숙소 견적을 장부에 저장</button></div>' + '<div class="row" style="margin-top:10px"><button class="btn grow" data-view="philco">💰 필코가 더 싼 숙소 목록 (연말 문의용)</button></div>';
  }

  /* ---------- 자료실 ---------- */
  function libCard(x) {
    var body = x.text || ("[" + x.title + "]\n" + (x.desc ? x.desc + "\n" : "") + "▶ " + x.url);
    return '<div class="lib"><div class="grow" style="min-width:0"><div class="nm">' + esc(x.title) + "</div>" + (x.desc ? '<div class="note">' + esc(x.desc) + "</div>" : "") + (x.url ? '<a class="note" href="' + esc(x.url) + '" target="_blank" rel="noopener">' + esc(x.url) + "</a>" : '<div class="note pre">' + esc(x.text) + "</div>") + '</div><button class="btn sm gold" data-copytext="' + esc(body) + '">복사</button></div>';
  }
  function viewLib() {
    var cats = [], q = state.libQ.trim().toLowerCase();
    var all = D.library.concat(D.shops.filter(function (s) { return s.post; }).map(function (s) { return { cat: "업체 상세글", title: s.name, desc: s.tagline, url: s.post }; }));
    all.forEach(function (x) { if (cats.indexOf(x.cat) < 0) cats.push(x.cat); });
    var h = "<h1>상담 자료실</h1>" + '<input class="search" id="libQ" placeholder="자료 검색 (예: 풀빌라, 골프, 환불)" value="' + esc(state.libQ) + '">';
    if (q) {
      var items = all.filter(function (x) { return (x.title + x.cat + (x.desc || "") + (x.text || "")).toLowerCase().indexOf(q) >= 0; });
      return h + '<p class="note" style="margin:8px 2px">검색 결과 ' + items.length + "건</p>" + '<div class="card">' + (items.length ? items.map(libCard).join("") : '<div class="empty">자료가 없습니다.</div>') + "</div>";
    }
    h += '<p class="note" style="margin:8px 2px">분류를 누르면 펼쳐집니다. 다시 누르면 접힙니다.</p>';
    cats.forEach(function (c) {
      var items = all.filter(function (x) { return x.cat === c; }), open = state.libOpen[c];
      h += '<div class="card fold"><button class="foldhd" data-libfold="' + esc(c) + '"><b>' + esc(c) + '</b><span class="badge">' + items.length + "</span><span class=\"arrow\">" + (open ? "▲" : "▼") + "</span></button>" + (open ? items.map(libCard).join("") : "") + "</div>";
    });
    return h + '<p class="note" style="margin-top:14px">넣을 글 주소나 문장을 알려 주시면 바로 추가하겠습니다.</p>';
  }

  /* ---------- 장부 동기화(Supabase 로그인) — 외부 라이브러리 없이 직접 통신 ---------- */
  var CFG = window.PB_CONFIG, sb = !!(CFG && CFG.url && CFG.key && window.fetch), sess = store.get("sess", null), sync = { user: sess ? sess.user : null, msg: "", busy: false, timer: 0 };
  function api(path, opt) {
    opt = opt || {};
    var h = { apikey: CFG.key, "Content-Type": "application/json" }; if (opt.auth && sess) h.Authorization = "Bearer " + sess.access_token; if (opt.prefer) h.Prefer = opt.prefer;
    var lim = opt.timeout || 15000, ctl = window.AbortController ? new AbortController() : null, tm = setTimeout(function () { if (ctl) ctl.abort(); }, lim);
    return fetch(CFG.url + path, { method: opt.method || "GET", headers: h, body: opt.body ? JSON.stringify(opt.body) : undefined, signal: ctl ? ctl.signal : undefined }).then(function (r) {
      clearTimeout(tm);
      return r.text().then(function (t) { var j = null; try { j = t ? JSON.parse(t) : null; } catch (e) { } if (!r.ok) { var er = new Error((j && (j.msg || j.error_description || j.message || j.error)) || ("오류 " + r.status)); er.status = r.status; throw er; } return j; });
    }, function (e) { clearTimeout(tm); throw new Error(e && e.name === "AbortError" ? "응답이 없습니다(" + Math.round(lim / 1000) + "초). 인터넷 연결을 확인하고 다시 눌러 주세요." : "연결 실패: " + (e.message || e)); });
  }
  function setSess(j) { if (j && j.access_token) { j.expires_at = j.expires_at || Math.floor(Date.now() / 1000) + (j.expires_in || 3600); sess = { access_token: j.access_token, refresh_token: j.refresh_token, expires_at: j.expires_at, user: { id: j.user.id, email: j.user.email } }; } else sess = null; store.set("sess", sess); sync.user = sess ? sess.user : null; }
  function fresh() { // 로그인 유지: 만료가 가까우면 새로 받는다
    if (!sess) return Promise.reject(new Error("로그인이 필요합니다."));
    if (sess.expires_at * 1000 - Date.now() > 60000) return Promise.resolve();
    return api("/auth/v1/token?grant_type=refresh_token", { method: "POST", body: { refresh_token: sess.refresh_token } }).then(setSess, function (e) { if (e.status === 400 || e.status === 401) { setSess(null); if (state.view === "ledger") render(); } throw e; });
  }
  function koErr(m) { return /Invalid login/i.test(m) ? "이메일 또는 비밀번호가 맞지 않습니다." : /not confirmed/i.test(m) ? "아직 메일 확인이 안 됐습니다. 받은 메일의 링크를 누른 뒤 다시 로그인해 주세요." : /already registered/i.test(m) ? "이미 만든 계정입니다. [로그인]을 눌러 주세요." : /rate limit/i.test(m) ? "확인 메일을 너무 자주 요청했습니다. 한 시간쯤 뒤에 다시 해 주세요." : /at least/i.test(m) ? "비밀번호는 6자 이상이어야 합니다." : /not authorized|sending.*email|confirmation email/i.test(m) ? "계정은 접수됐지만 확인 메일을 보내지 못했습니다. 클실장에게 '계정 만들었어'라고 알려 주시면 바로 승인해 드립니다. (" + m + ")" : m; }
  function touch(x) { x.u = Date.now(); return x; }
  function syncSoon() { if (!sb || !sync.user) return; clearTimeout(sync.timer); sync.timer = setTimeout(doSync, 800); }
  function syncMsg(m) { sync.msg = m; var el = $("#syncMsg"); if (el) el.textContent = m; }
  function doSync() {
    if (!sb || !sync.user || sync.busy) return Promise.resolve();
    sync.busy = true; syncMsg("동기화 중…");
    return fresh().then(function () { return api("/rest/v1/pb_bookings?select=id,data", { auth: true }); }).then(function (rows) {
      var remote = {}, local = {}, ups = [], changed = 0;
      (rows || []).forEach(function (r) { remote[r.id] = r.data; });
      state.bookings.forEach(function (x) { local[x.id] = x; });
      state.tomb.forEach(function (x) { local[x.id] = { id: x.id, u: x.u, deleted: true }; });
      Object.keys(remote).forEach(function (id) {
        var r = remote[id], l = local[id];
        if (l && (l.u || 0) >= (r.u || 0)) return;
        changed++;
        state.bookings = state.bookings.filter(function (x) { return x.id !== id; }); state.tomb = state.tomb.filter(function (x) { return x.id !== id; });
        if (r.deleted) state.tomb.push({ id: id, u: r.u }); else state.bookings.push(r);
        local[id] = r;
      });
      Object.keys(local).forEach(function (id) { var l = local[id], r = remote[id]; if (!r || (l.u || 0) > (r.u || 0)) ups.push({ id: id, data: l, updated_at: new Date().toISOString() }); });
      state.bookings.sort(function (a, b) { return a.id.localeCompare(b.id); });
      save();
      var done = function () { sync.busy = false; syncMsg("동기화 완료 " + new Date().toLocaleTimeString("ko-KR") + " · 받은 것 " + changed + "건, 올린 것 " + ups.length + "건"); if (changed && state.view === "ledger") render(); };
      if (!ups.length) return done();
      return api("/rest/v1/pb_bookings?on_conflict=user_id,id", { method: "POST", auth: true, prefer: "resolution=merge-duplicates,return=minimal", body: ups }).then(done);
    }).catch(function (e) { sync.busy = false; syncMsg("동기화 실패: " + koErr(e.message || String(e))); });
  }
  function syncBox() {
    if (!sb) return '<div class="card" style="margin-top:10px"><p class="note">기기 간 동기화를 쓸 수 없는 상태입니다(인터넷 연결 또는 설정 파일 확인). 장부는 이 기기에만 저장됩니다.</p></div>';
    if (!sync.user) return '<div class="card" style="margin-top:10px"><h2>폰·PC 장부 동기화</h2><p class="note">로그인하면 이 기기의 장부가 다른 기기와 합쳐집니다. 로그인하지 않으면 이 기기에만 저장됩니다.</p><div class="grid2"><div><label>이메일</label><input id="sbEmail" type="email" autocomplete="username"></div><div><label>비밀번호</label><input id="sbPw" type="password" autocomplete="current-password"></div></div><div class="row" style="margin-top:8px;flex-wrap:wrap"><button class="btn sm gold" id="sbLogin">로그인</button><button class="btn sm ghost" id="sbSignup">처음이면 계정 만들기</button></div><p class="note" id="syncMsg">' + esc(sync.msg) + "</p></div>";
    return '<div class="card" style="margin-top:10px"><div class="row" style="flex-wrap:wrap"><div class="grow"><b>동기화 켜짐</b> <span class="note">' + esc(sync.user.email || "") + '</span></div><button class="btn sm" id="sbSync">지금 동기화</button><button class="btn sm ghost" id="sbLogout">로그아웃</button></div><p class="note" id="syncMsg" style="margin:6px 0 0">' + esc(sync.msg) + "</p></div>";
  }
  if (sb && sync.user) setTimeout(doSync, 300);

  /* ---------- 장부 ---------- */
  var STATUS = { "견적": "견적만 보낸 상태(아직 입금 전)", "확정": "입금을 받고 업체에 예약을 넣은 상태", "완료": "손님이 이용을 마쳐 끝난 건" };
  function viewLedger() {
    var L = state.led, months = {}, shopsAll = {};
    state.bookings.forEach(function (x) { x.shops.forEach(function (s) { shopsAll[s] = 1; }); if (x.status === "견적") return; var m = (x.firstDate || x.created).slice(0, 7), o = months[m] = months[m] || { n: 0, krw: 0, php: 0, shops: {} }; o.n++; o.krw += x.profitKrw || 0; o.php += x.profitPhp || 0; o.usd = (o.usd || 0) + (x.profitUsd || 0); x.shops.forEach(function (s) { o.shops[s] = (o.shops[s] || 0) + 1; }); });
    var q = L.q.trim().toLowerCase();
    var b = state.bookings.filter(function (x) {
      return (L.status === "전체" || (L.status === "확인 필요" ? !!(x.checks && x.checks.length && !x.checkDone) : x.status === L.status)) && (L.shop === "전체" || x.shops.indexOf(L.shop) >= 0) &&
        (!q || ((x.name || "") + " " + ((x.cust && x.cust.contact) || "") + " " + x.shops.join(" ") + " " + (x.firstDate || "") + " " + x.created).toLowerCase().indexOf(q) >= 0);
    });
    var far = "9999-99-99";
    b.sort(L.sort === "date" ? function (a, c) { return (a.firstDate || far).localeCompare(c.firstDate || far); } :
      L.sort === "dateDesc" ? function (a, c) { return (c.firstDate || "").localeCompare(a.firstDate || ""); } :
        L.sort === "shop" ? function (a, c) { return a.shops.join().localeCompare(c.shops.join(), "ko") || (a.firstDate || far).localeCompare(c.firstDate || far); } :
          L.sort === "name" ? function (a, c) { return (a.name || "").localeCompare(c.name || "", "ko"); } :
            function (a, c) { return c.id.localeCompare(a.id); });
    var h = "<h1>예약 장부</h1>" + syncBox(), keys = Object.keys(months).sort().reverse();
    if (keys.length) h += '<div class="card"><h2>월별 실적(확정·완료 건, 이용일 기준)</h2><div class="scroll"><table><tr><th>월</th><th>건수</th><th>수익</th><th>많이 판 업체</th></tr>' + keys.map(function (k) { var o = months[k], top = Object.keys(o.shops).sort(function (a, c) { return o.shops[c] - o.shops[a]; }).slice(0, 3).map(function (s) { return s + " " + o.shops[s]; }).join(", "); return "<tr><td>" + k + "</td><td>" + o.n + "</td><td>" + profitStr(o.krw, o.php, o.usd) + '</td><td style="text-align:left">' + esc(top) + "</td></tr>"; }).join("") + "</table></div></div>";
    var sorts = [["new", "최근 저장순"], ["date", "이용일 빠른 순"], ["dateDesc", "이용일 늦은 순"], ["shop", "옵션샵 이름순"], ["name", "손님 이름순"]];
    h += '<div class="card" style="margin-top:10px"><input class="search" id="ledQ" placeholder="검색: 손님 이름·연락처·업체·날짜(예: 2026-12)" value="' + esc(L.q) + '">' +
      '<div class="grid2" style="margin-top:8px"><div><label>정렬</label><select id="ledSort">' + sorts.map(function (s) { return '<option value="' + s[0] + '"' + (L.sort === s[0] ? " selected" : "") + ">" + s[1] + "</option>"; }).join("") + "</select></div>" +
      '<div><label>옵션샵</label><select id="ledShop"><option>전체</option>' + Object.keys(shopsAll).sort(function (a, c) { return a.localeCompare(c, "ko"); }).map(function (s) { return "<option" + (L.shop === s ? " selected" : "") + ">" + esc(s) + "</option>"; }).join("") + "</select></div></div>" +
      chips(["전체", "확인 필요", "견적", "확정", "완료"], L.status, "ledst") +
      '<p class="note" style="margin:6px 0 0">견적 = ' + STATUS["견적"] + " · 확정 = " + STATUS["확정"] + " · 완료 = " + STATUS["완료"] + ". 견적→확정은 입금을 확인하고 직접 눌러 주세요. 확정 건은 이용일이 지나면 자동으로 완료로 바뀝니다. 월별 실적에는 확정·완료만 들어갑니다.</p></div>";
    h += '<p class="note" style="margin:10px 2px 0">' + b.length + "건 / 전체 " + state.bookings.length + '건</p><div class="list">' + (b.length ? b.map(function (x) {
      return '<div class="card"><div class="row"><div class="grow"><b>' + esc(x.name || "(이름 없음)") + '</b> <span class="badge' + (x.status !== "견적" ? " ok" : "") + '">' + x.status + '</span>' + (x.checks && x.checks.length && !x.checkDone ? ' <span class="badge" style="background:#d00;color:#fff">🔴 확인 필요</span>' : "") + '<div class="note">' + esc(x.shops.join(" · ")) + " · 이용일 " + (x.firstDate || "미정") + " · 저장 " + x.created + '</div><div class="note">' + (x.kind === "stay" ? "견적 " + esc(x.payText) : "입금 " + won(x.payNow)) + " · 수익 " + (x.own ? "직영(따로 계산)" : profitStr(x.profitKrw, x.profitPhp, x.profitUsd)) + (x.auto ? " · 이용일이 지나 자동 완료" : "") + "</div>" + (x.checks && x.checks.length && !x.checkDone ? '<div class="note" style="color:#d00">• ' + x.checks.map(esc).join("<br>• ") + "</div>" : "") + "</div></div>" +
        '<div class="row" style="margin-top:8px;flex-wrap:wrap"><button class="btn sm ghost" data-open="' + x.id + '">불러오기</button>' + ["견적", "확정", "완료"].map(function (st) { return '<button class="btn sm ' + (x.status === st ? "" : "ghost") + '" data-st="' + x.id + "|" + st + '">' + st + "</button>"; }).join("") + (x.checks && x.checks.length && !x.checkDone ? '<button class="btn sm gold" data-chk="' + x.id + '">확인 완료</button>' : "") + '<button class="btn sm danger" data-del="' + x.id + '">삭제</button></div></div>';
    }).join("") : '<div class="empty">' + (state.bookings.length ? "조건에 맞는 예약이 없습니다." : "저장된 예약이 없습니다.") + "</div>") + "</div>" +
      '<p class="note" style="margin-top:14px">장부는 이 기기의 브라우저에 저장되고, 로그인하면 다른 기기와 합쳐집니다. <button class="btn sm ghost" id="exportBk">백업 파일 내려받기</button></p>';
    return h;
  }
  /* ---------- 필코가 더 싼 숙소 목록 (연말 문의용 한 페이지) ---------- */
  function viewPhilco() {
    var P = window.PB_PHILCO, td = today(), cheap = [], same = [];
    Object.keys(P.hotels).forEach(function (name) {
      var pc = P.hotels[name], h = H.hotels.filter(function (x) { return x.name === name; })[0]; if (!h) return;
      var promoNow = h.sell && td >= h.sell[0] && td <= h.sell[1], rows = [];
      Object.keys(pc.rooms).forEach(function (t) {
        var d = h.rooms.filter(function (x) { return x.type === t; })[0]; if (!d) return;
        var tm = promoNow && d.promo ? d.promo : d.rate, diff = tm - pc.rooms[t];
        rows.push({ type: t, tmj: tm, philco: pc.rooms[t], diff: diff, promo: promoNow && d.promo, early: pc.early && pc.early[t] != null ? pc.early[t] : null, cur: d.cur });
      });
      var win = rows.filter(function (x) { return x.diff > 0; }), rest = rows.filter(function (x) { return x.diff <= 0; });
      if (win.length) cheap.push({ name: name, ko: pc.ko || name, rows: win, rest: rest, hot: pc.hot, early: pc.earlyNote, surNote: pc.sur ? "필코 서차지가 TMJ와 달라(바이: 12/23~25 추가) 날짜별 비교는 견적 화면에서 확인" : "", max: Math.max.apply(null, win.map(function (x) { return x.diff; })), cur: rows[0].cur });
      else same.push({ ko: pc.ko || name, rows: rest });
    });
    cheap.sort(function (a, b) { return (b.cur === "USD" ? 0 : 1) - (a.cur === "USD" ? 0 : 1) || b.max - a.max; });
    var m = function (n, c) { return c === "USD" ? usd(n) : peso(n); };
    var h = '<h1 style="margin:6px 0">필코가 더 싼 숙소 목록</h1><p class="note">1박 룸+조식 · 성인 2인 · 마크업 전 원가 · TMJ ' + esc(H.date) + ' / 필코 ' + esc(P.date) + ' 기준. 연말 서차지·갈라는 대부분 TMJ와 같아 객실 요금 차이가 그대로 총액 차이입니다(날짜별 정확한 차액은 숙소 견적 화면의 초록 박스). 손님에게는 보이지 않는 내부용입니다.</p>';
    h += '<div class="card" style="margin-top:10px"><b>한눈에 — 필코로 넣으면 이득인 숙소</b><br>' + cheap.map(function (c) { return esc(c.ko) + " <b>최대 " + m(c.max, c.cur) + "↓</b>"; }).join(" · ") + "</div>";
    cheap.forEach(function (c) {
      h += '<div class="card" style="margin-top:12px;border:2px solid #0a8a5a"><b style="font-size:17px">' + esc(c.ko) + "</b>" +
        '<table style="width:100%;margin-top:8px;border-collapse:collapse;font-size:14px"><tr style="text-align:left;color:#666"><th>객실</th><th>TMJ</th><th>필코</th><th>차액/박</th></tr>' +
        c.rows.map(function (x) { return '<tr style="border-top:1px solid #ddd"><td>' + esc(x.type) + "</td><td>" + m(x.tmj, x.cur) + "</td><td>" + m(x.philco, x.cur) + '</td><td style="color:#0a8a5a"><b>' + m(x.diff, x.cur) + "↓</b></td></tr>" + (x.early != null ? '<tr><td colspan="4" style="font-size:12px;color:#066">└ 얼리버드(체크인 45일 전·비수기 날짜) ' + m(x.early, x.cur) + " → " + m(x.tmj - x.early, x.cur) + "↓</td></tr>" : ""); }).join("") + "</table>" +
        (c.rest.length ? '<details style="margin-top:6px"><summary class="note">같거나 TMJ가 싼 객실 ' + c.rest.length + "개</summary><div class='note'>" + c.rest.map(function (x) { return esc(x.type) + ": TMJ " + m(x.tmj, x.cur) + " / 필코 " + m(x.philco, x.cur); }).join("<br>") + "</div></details>" : "") +
        (c.hot ? '<p class="warn" style="margin-top:8px"><b>' + esc(c.hot) + "</b></p>" : "") + (c.early ? '<p class="note">※ ' + esc(c.early) + "</p>" : "") + (c.surNote ? '<p class="note">※ ' + esc(c.surNote) + "</p>" : "") + "</div>";
    });
    h += '<div class="card" style="margin-top:12px"><b>TMJ가 같거나 더 싼 숙소(필코로 넣지 않음)</b><br>' + same.map(function (c) { return esc(c.ko); }).join(", ") + '<p class="note">크림슨·필리·누스타·솔레아 프리미어(프로모)·제이파크 디럭스도 TMJ 쪽이 같거나 싸서 목록에서 뺐습니다(상세는 비교 문서 B절).</p></div>';
    h += '<div class="card" style="margin-top:12px"><b>필코에만 있는 상품</b><p class="note">• 비비안(VIVIEN\'S): TMJ에 없음, 룸온리 2,100 / 룸+조식 2,450페소 · • 샹그릴라 코리안 패키지(3~5박, 다이닝 크레딧 5,000/7,500/10,000) · • 바이 밤 12시 체크인 요금(첫날만) · • 제이파크 갈라 밤 도착 웨이버(항공편명 필수)</p></div>';
    h += '<p class="note" style="margin-top:10px">조건 차이(서차지·갈라·아동 연령)는 references/필코_TMJ_요금비교_2026-11-16.md D절. 예약 전에는 필코·TMJ 현행가를 한 번 더 확인하세요.</p>';
    return '<button class="btn sm ghost" data-view="stay">← 숙소 견적</button>' + h;
  }
  var VIEWS = { philco: viewPhilco, paste: viewPaste, shop: viewShop, quote: viewQuote, ledger: viewLedger, stay: viewStay, lib: viewLib, home: viewHome };
  /* 붙여넣은 손님 글은 화면을 다시 그려도 지워지지 않게 따로 간직한다(이 탭을 닫을 때까지) */
  var DRAFT_IDS = ["paste", "spaste", "upaste"], DRAFT = {};
  function draftGet(id) { try { var v = sessionStorage.getItem("pb_draft_" + id); if (v != null) return v; } catch (e) { } return DRAFT[id] || ""; }
  document.addEventListener("input", function (ev) { var id = ev.target && ev.target.id; if (DRAFT_IDS.indexOf(id) < 0) return; DRAFT[id] = ev.target.value; try { sessionStorage.setItem("pb_draft_" + id, ev.target.value); } catch (e) { } });
  function render() {
    $("#app").innerHTML = (VIEWS[state.view] || viewHome)();
    DRAFT_IDS.forEach(function (id) { var el = $("#" + id), v = draftGet(id); if (el && v) { el.value = v; var dt = el.closest("details"); if (dt) dt.open = true; } });
    $("#cartCount").textContent = state.cart.length;
    document.querySelectorAll(".top nav button").forEach(function (b) { b.classList.toggle("on", b.dataset.view === state.view || (state.view === "shop" && b.dataset.view === "home")); });
  }
  function rerenderKeep(id) { var el = $("#" + id), pos = el ? el.selectionStart : 0; render(); el = $("#" + id); if (el) { el.focus(); try { el.setSelectionRange(pos, pos); } catch (e) { } } }
  function refreshQuote(keepFocus) { state.edited = {}; save(); if (!keepFocus) render(); }
  function loadHotel(idx) {
    var r = state.stay.resort, h = idx === "" ? null : H.hotels[+idx]; r.hotel = idx; r.hotelName = h ? h.name : ""; r.picks = []; r.margin = "";
    if (h) { r.name = h.name; r.cur = h.rooms[0].cur; }
  }

  /* ---------- 이벤트 ---------- */
  document.addEventListener("click", function (ev) {
    var t = ev.target.closest("button"); if (!t) return; var d = t.dataset;
    if (t.id === "goHome") return go("home");
    if (t.id === "toggleNet") { state.showNet = !state.showNet; return render(); }
    if (d.view) return go(d.view);
    if (d.cat) { state.cat = d.cat; return render(); }
    if (d.libfold != null) { state.libOpen[d.libfold] = !state.libOpen[d.libfold]; return render(); }
    if (t.id === "addPick") { var rs = $("#roomSel"), pk = state.stay.resort.picks, ex = pk.filter(function (x) { return x.type === rs.value; })[0]; if (ex) ex.rooms = +$("#roomQty").value; else pk.push({ type: rs.value, rooms: +$("#roomQty").value }); state.edited = {}; save(); return render(); }
    if (t.id === "fxAuto") { state.fxInfo.manual = false; if (state.fxInfo.mid) state.fx = Math.ceil(state.fxInfo.mid * (1 + S.usdSpread)); save(); render(); return fxFetch(true); }
    if (d.madd != null) { state.cart[+d.madd].q[$("#msel" + d.madd).value] = +$("#mqty" + d.madd).value; return refreshQuote(); }
    if (d.pdel != null) { state.stay.resort.picks.splice(+d.pdel, 1); state.edited = {}; save(); return render(); }
    if (t.id === "saveStay") {
      var sb = Stay.booking(), tab = state.stay.tab;
      state.bookings.push({ u: Date.now(), id: "b" + Date.now(), created: today(), status: "견적", kind: "stay", stayTab: tab, staySnap: clone(state.stay[tab]), name: state.stay.cust.name, cust: clone(state.stay.cust), cart: [], checks: tab === "resort" ? Stay.resort().checks.concat(Stay.resort().hardWarn) : [], checkDone: false, shops: [sb.label], firstDate: sb.date || "", lastDate: sb.date ? addDays(sb.date, sb.nights) : "", payNow: 0, payText: sb.payText, profitKrw: 0, profitPhp: sb.profitPhp, profitUsd: sb.profitUsd, own: !!sb.own });
      save(); syncSoon(); return toast("장부에 저장했습니다");
    }
    if (d.ledst) { state.led.status = d.ledst; return render(); }
    if (d.stab) { state.stay.tab = d.stab; state.edited = {}; save(); return render(); }
    if (d.shop) return go("shop", d.shop);
    if (d.cart) return toggleCart(d.cart);
    if (d.tab) { state.tab = d.tab; return render(); }
    if (d.copy === "stay_resort" && state.stay.tab === "resort") { var gc = Stay.resort(); if (gc.needOk && !gc.okDone) return toast("먼저 아래 ‘확인했습니다’ 칸을 체크하세요 (서차지·갈라·추가금)"); }
    if (d.copy) return copy($('[data-out="' + d.copy + '"]').value);
    if (d.copytext != null) return copy(d.copytext);
    if (d.reset) { delete state.edited[d.reset]; return render(); }
    if (t.id === "addRow") { state.stay.resort.rows.push({ type: "", tmj: "", rooms: 1 }); save(); return render(); }
    if (d.rdel != null) { state.stay.resort.rows.splice(+d.rdel, 1); state.edited = {}; save(); return render(); }
    if (t.id === "doUniParse") {
      var ur = parseUnified($("#upaste").value), um = $("#uMsg");
      var line = "숙소 " + ur.stay + "개 · 업체 " + ur.shops + "개 항목을 읽었습니다" + (ur.added.length ? " (견적에 담은 업체: " + ur.added.join(", ") + ")" : "");
      save(); toast(ur.stay + ur.shops ? line : "읽을 수 있는 항목이 없습니다");
      if (um) um.textContent = (ur.stay + ur.shops ? line + ". [숙소]·[견적] 화면에서 확인하세요." : "읽을 수 있는 항목이 없습니다. 양식(숙소/체크인…, ■ 업체이름)을 확인하거나 [AI로 읽기]를 써 보세요.") + (ur.notes.length ? " 확인 필요: " + ur.notes.join(" / ") : "");
      return;
    }
    if (t.id === "doUniAi") {
      var utx = $("#upaste").value, uam = function (m) { var el = $("#uMsg"); if (el) el.textContent = m; };
      if (!utx.trim()) return uam("손님 글을 먼저 붙여넣어 주세요.");
      if (!sb || !sess) return uam("AI로 읽기는 로그인한 뒤에 쓸 수 있습니다. [장부] 화면에서 로그인해 주세요.");
      uam("AI가 읽는 중… (10~40초)");
      var mentioned = D.shops.filter(function (sh) { return utx.indexOf(sh.name.replace(/[(（].*$/, "").trim()) >= 0; });
      var addedN = [];
      mentioned.forEach(function (sh) { if (ensureInCart(sh.id)) addedN.push(sh.name); });
      var shopsIn2 = state.cart.map(function (e) { var s = shopById(e.shopId); return { id: s.id, name: s.name, cat: s.cat, needStart: !!s.needStart, timeOptions: s.timeOptions || [], optionLabel: s.optionLabel || "", items: s.items.map(function (it) { return { key: it.key, label: it.label }; }) }; });
      var call = function (body) { return api("/functions/v1/pb-parse", { method: "POST", auth: true, timeout: 90000, body: body }); };
      fresh().then(function () { return Promise.all([call({ text: utx, mode: "stay", today: today() }), shopsIn2.length ? call({ text: utx, shops: shopsIn2, today: today() }) : Promise.resolve(null)]); }).then(function (js) {
        var sj = js[0], hj = js[1], sres = sj && sj.result; if (!sres) throw new Error((sj && sj.error) || "결과가 비어 있습니다.");
        var sr3 = { n: 0, notes: [] }, hasStay = !!(sres.hotel || sres.checkin || (sres.rooms || []).length);
        if (hasStay) sr3 = applyStayParsed(sres); else { if (sres.name) { state.stay.cust.name = sres.name; } if (sres.contact) { state.stay.cust.contact = sres.contact; } }
        var hn = 0; if (hj && hj.result) { if (hj.result.name) state.cust.name = hj.result.name; if (hj.result.contact) state.cust.contact = hj.result.contact; hn = applyShopsParsed(hj.result); }
        syncCust(); state.edited = {}; save();
        var msg = "AI가 숙소 " + sr3.n + "개 · 업체 " + hn + "개 항목을 채웠습니다" + (addedN.length ? " (견적에 담은 업체: " + addedN.join(", ") + ")" : "") + (hasStay ? "" : " (숙소 내용은 글에서 찾지 못했습니다)") + (!shopsIn2.length ? " (업체 이름이 글에 없어 업체는 읽지 않았습니다 — 업체를 먼저 담으면 같이 읽습니다)" : "") + ". [숙소]·[견적] 화면에서 날짜·인원·금액을 꼭 확인하세요." + (sr3.notes.length ? " 확인 필요: " + sr3.notes.join(" / ") : "");
        toast("AI가 읽었습니다"); uam(msg);
      }).catch(function (e) { uam("AI 읽기 실패: " + koErr(e.message || String(e))); });
      return;
    }
    if (t.id === "doStayParse") {
      var sr = parseStayPaste($("#spaste").value); save(); render(); toast(sr.n ? sr.n + "개 항목을 읽었습니다" : "읽을 수 있는 항목이 없습니다");
      if (sr.notes.length) { var el2 = $("#saiMsg"); if (el2) el2.textContent = "확인 필요: " + sr.notes.join(" / "); }
      return;
    }
    if (t.id === "doStayAi") {
      var stx = $("#spaste").value, sam = function (m) { var el = $("#saiMsg"); if (el) el.textContent = m; };
      if (!stx.trim()) return sam("손님 글을 먼저 붙여넣어 주세요.");
      if (!sb || !sess) return sam("AI로 읽기는 로그인한 뒤에 쓸 수 있습니다. [장부] 화면에서 로그인해 주세요.");
      sam("AI가 읽는 중… (10~40초)");
      fresh().then(function () { return api("/functions/v1/pb-parse", { method: "POST", auth: true, timeout: 90000, body: { text: stx, mode: "stay", today: today() } }); }).then(function (j) {
        var rr = j && j.result; if (!rr) throw new Error((j && j.error) || "결과가 비어 있습니다.");
        var sr2 = applyStayParsed(rr); save(); render(); toast("AI가 " + sr2.n + "개 항목을 채웠습니다");
        var el3 = $("#saiMsg"); if (el3) el3.textContent = "AI가 " + sr2.n + "개 항목을 채웠습니다. 날짜·인원·객실·금액을 꼭 한 번 확인하세요." + (sr2.notes.length ? " 확인 필요: " + sr2.notes.join(" / ") : "") + (j.usage ? " (사용량: 입력 " + num(j.usage.input) + " · 출력 " + num(j.usage.output) + " 토큰)" : "");
      }).catch(function (e) { sam("AI 읽기 실패: " + koErr(e.message || String(e))); });
      return;
    }
    if (t.id === "doParse") { var n = parsePaste($("#paste").value); refreshQuote(); return toast(n ? n + "개 항목을 읽었습니다" : "읽을 수 있는 항목이 없습니다"); }
    if (t.id === "doAi") {
      var txt = $("#paste").value, am = function (m) { var el = $("#aiMsg"); if (el) el.textContent = m; };
      if (!txt.trim()) return am("손님 글을 먼저 붙여넣어 주세요.");
      if (!sb || !sess) return am("AI로 읽기는 로그인한 뒤에 쓸 수 있습니다. [장부] 화면에서 로그인해 주세요.");
      am("AI가 읽는 중… (10~40초)");
      var shopsIn = state.cart.map(function (e) { var s = shopById(e.shopId); return { id: s.id, name: s.name, cat: s.cat, needStart: !!s.needStart, timeOptions: s.timeOptions || [], optionLabel: s.optionLabel || "", items: s.items.map(function (it) { return { key: it.key, label: it.label }; }) }; });
      fresh().then(function () { return api("/functions/v1/pb-parse", { method: "POST", auth: true, timeout: 90000, body: { text: txt, shops: shopsIn, today: today() } }); }).then(function (j) {
        var r = j && j.result, n = 0; if (!r) throw new Error((j && j.error) || "결과가 비어 있습니다.");
        if (r.name) { state.cust.name = r.name; n++; } if (r.contact) { state.cust.contact = r.contact; n++; }
        (r.entries || []).forEach(function (x) {
          var e = state.cart.filter(function (c) { return c.shopId === x.shopId; })[0]; if (!e) return; var shop = shopById(e.shopId);
          ["date", "time", "start", "ages", "pickup", "drop", "luggage", "option", "roster", "note"].forEach(function (k) { if (x[k] && (k !== "date" || /^\d{4}-\d{2}-\d{2}$/.test(x[k]))) { e[k] = x[k]; n++; } });
          (x.items || []).forEach(function (it) { if (it.qty > 0 && shop.items.some(function (s2) { return s2.key === it.key; })) { e.q[it.key] = it.qty; n++; } });
        });
        refreshQuote(); toast("AI가 " + n + "개 항목을 채웠습니다");
        am("AI가 " + n + "개 항목을 채웠습니다. 빈 칸과 금액을 한 번 확인해 주세요." + (j.usage ? " (사용량: 입력 " + num(j.usage.input) + " · 출력 " + num(j.usage.output) + " 토큰)" : ""));
      }).catch(function (e) { am("AI 읽기 실패: " + koErr(e.message || String(e))); });
      return;
    }
    if (t.id === "clearCart") { if (confirm("작성 중인 견적을 비울까요?")) { state.cart = []; state.cust = { name: "", contact: "" }; state.edited = {}; save(); go("home"); } return; }
    if (t.id === "saveBooking") {
      var c = Calc.cart(), dates = state.cart.map(function (e) { return e.date; }).filter(Boolean).sort();
      state.bookings.push({ u: Date.now(), id: "b" + Date.now(), created: today(), status: "견적", name: state.cust.name, cust: clone(state.cust), cart: clone(state.cart), shops: c.rows.map(function (r) { return r.shop.name; }), firstDate: dates[0] || "", lastDate: dates[dates.length - 1] || "", payNow: c.payNow, profitKrw: c.profitKrw, profitPhp: c.profitPhp, profitUsd: c.profitUsd });
      save(); syncSoon(); return toast("장부에 저장했습니다");
    }
    if (d.chk) { state.bookings.forEach(function (x) { if (x.id === d.chk) { x.checkDone = true; touch(x); } }); save(); syncSoon(); return render(); }
    if (d.st) { var p = d.st.split("|"); state.bookings.forEach(function (x) { if (x.id === p[0]) { x.status = p[1]; x.auto = false; touch(x); } }); save(); syncSoon(); return render(); }
    if (d.del) { if (confirm("이 예약 기록을 삭제할까요? 되돌릴 수 없습니다.")) { state.bookings = state.bookings.filter(function (x) { return x.id !== d.del; }); state.tomb.push({ id: d.del, u: Date.now() }); save(); syncSoon(); render(); } return; }
    if (d.open) { var bk = state.bookings.filter(function (x) { return x.id === d.open; })[0]; if (bk && bk.kind === "stay") { state.stay.tab = bk.stayTab; state.stay[bk.stayTab] = Object.assign(clone(stayDefault[bk.stayTab]), clone(bk.staySnap)); state.stay.cust = clone(bk.cust || { name: "", contact: "" }); state.edited = {}; save(); go("stay"); }
      else if (bk) { state.cart = clone(bk.cart).filter(function (e) { return shopById(e.shopId); }); state.cust = clone(bk.cust); state.edited = {}; save(); go("quote"); } return; }
    if (t.id === "sbLogin" || t.id === "sbSignup") {
      var em = $("#sbEmail").value.trim(), pw = $("#sbPw").value, login = t.id === "sbLogin"; if (!em || !pw) return syncMsg("이메일과 비밀번호를 넣어 주세요.");
      syncMsg(login ? "로그인 중…" : "계정 만드는 중…");
      api(login ? "/auth/v1/token?grant_type=password" : "/auth/v1/signup", { method: "POST", body: { email: em, password: pw } }).then(function (j) {
        if (j && j.access_token) { setSess(j); sync.msg = ""; render(); return doSync(); }
        syncMsg("계정이 접수됐습니다. 확인 메일(스팸함 포함)의 링크를 누르거나, 메일이 안 오면 클실장에게 '계정 만들었어'라고 알려 주세요. 승인 뒤 [로그인]을 누르시면 됩니다.");
      }).catch(function (e) { syncMsg((login ? "로그인 실패: " : "계정 만들기 실패: ") + koErr(e.message || String(e))); });
      return;
    }
    if (t.id === "sbLogout") { var tk = sess && sess.access_token; setSess(null); sync.msg = ""; render(); if (tk) fetch(CFG.url + "/auth/v1/logout", { method: "POST", headers: { apikey: CFG.key, Authorization: "Bearer " + tk } }).catch(function () { }); return; }
    if (t.id === "sbSync") { doSync(); return; }
    if (t.id === "exportBk") { var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(state.bookings, null, 1)], { type: "application/json" })); a.download = "philboard-backup-" + today() + ".json"; a.click(); }
  });
  document.addEventListener("input", function (ev) {
    var t = ev.target, d = t.dataset;
    if (t.id === "q") { state.q = t.value; return rerenderKeep("q"); }
    if (t.id === "libQ") { state.libQ = t.value; return rerenderKeep("libQ"); }
    if (t.id === "ledQ") { state.led.q = t.value; return rerenderKeep("ledQ"); }
    if (d.out) { state.edited[d.out] = t.value; return; }
    if (d.c) { state.cust[d.c] = t.value; return refreshQuote(true); }
    if (d.k && t.tagName !== "SELECT") { state.cart[+d.e][d.k] = t.value; return refreshQuote(true); }
    if (d.s && t.tagName !== "SELECT") { var p = d.s.split("."); state.stay[p[0]][p[1]] = t.value; state.edited = {}; return save(); }
    if (d.rr) { var r = d.rr.split("."); state.stay.resort.rows[+r[0]][r[1]] = t.value; state.edited = {}; return save(); }
  });
  document.addEventListener("change", function (ev) {
    var t = ev.target, d = t.dataset;
    if (t.id === "okChk") { var oc = Stay.resort(); state.stay.resort.okSig = t.checked ? oc.sig : ""; save(); return render(); }
    if (d.q) { state.cart[+d.e].q[d.q] = +t.value; return refreshQuote(); }
    if (d.k && t.tagName === "SELECT") state.cart[+d.e][d.k] = t.value; /* 선택 칸(오전·오후, 짐 유무 등)은 여기서 저장한다 — input 쪽은 글자 칸만 처리 */
    if (d.k || d.c) return refreshQuote();
    if (t.id === "rate") { state.rate = +t.value || S.pesoRate; return refreshQuote(); }
    if (t.id === "fx") { state.fx = +t.value || S.usdRate; state.fxInfo.manual = true; state.edited = {}; save(); return render(); }
    if (t.id === "useContact") { state.cust.useContact = t.checked; if (!t.checked) state.cust.contact = ""; return refreshQuote(); }
    if (t.id === "hotelSel") { loadHotel(t.value); state.edited = {}; save(); return render(); }
    if (t.id === "ledSort") { state.led.sort = t.value; return render(); }
    if (t.id === "ledShop") { state.led.shop = t.value; return render(); }
    if (d.s) { var p = d.s.split("."); state.stay[p[0]][p[1]] = t.value; if (d.s === "resort.cur") state.stay.resort.margin = ""; state.edited = {}; save(); return render(); }
    if (d.rr) { save(); return render(); }
  });
  state.cart = state.cart.filter(function (e) { return shopById(e.shopId); });
  (function () { var td = today(), ch = 0; state.bookings.forEach(function (x) { var d = x.lastDate || x.firstDate; if (x.status === "확정" && d && d < td) { x.status = "완료"; x.auto = true; touch(x); ch++; } }); if (ch) save(); })();
  var dl = document.createElement("datalist"); dl.id = "places"; dl.innerHTML = (S.places || []).map(function (p) { return '<option value="' + esc(p) + '">'; }).join(""); document.body.appendChild(dl);
  var verEl = $("#ver"); if (verEl) verEl.textContent = "필보드 버전 " + (window.PB_BUILD === "dev" ? "개발용(이 PC)" : window.PB_BUILD) + " · 요금 자료 " + D.version;
  fxFetch();
  window.PB = { Calc: Calc, Text: Text, Stay: Stay, state: state, parsePaste: parsePaste };
  render();
})();
