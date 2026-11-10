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
  var stayDefault = { tab: "resort", cust: { name: "", contact: "" }, resort: { hotel: "", name: "", checkin: "", nights: 1, adults: 2, kids: 0, cur: "PHP", margin: "", picks: [], rows: [] }, villa: { idx: 0, checkin: "", nights: 1, profit: ST.villaProfit }, sol: { tier: "double", key: "in", checkin: "", rooms: 1, nights: 1, rate: "", addAdult: 0, addKid: 0, addBaby: 0, flight: "", pax: "", ename: "", t1: "", t2: "", note: "" } };
  var state = {
    view: "home", shopId: null, q: "", cat: "전체", tab: "ask", libOpen: {}, libQ: "",
    cart: store.get("cart", []), cust: store.get("cust", { name: "", contact: "" }),
    rate: store.get("rate2", S.pesoRate), bookings: store.get("bookings", []), tomb: store.get("tomb", []), edited: {},
    stay: (function () { var d = clone(stayDefault), v = store.get("stay3", {}); Object.keys(d).forEach(function (k) { if (v[k] != null) d[k] = typeof d[k] === "object" ? Object.assign(d[k], v[k]) : v[k]; }); return d; })(),
    led: { q: "", sort: "new", status: "전체", shop: "전체" }
  };
  function save() { store.set("cart", state.cart); store.set("cust", state.cust); store.set("rate2", state.rate); store.set("bookings", state.bookings); store.set("tomb", state.tomb); store.set("stay3", state.stay); }
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
    if (p.on) a.push("현장결제 " + peso(p.on));
    if (p.usd) a.push("현장결제 " + usd(p.usd));
    return a.length ? a.join(" + ") : "무료";
  }
  function onsiteStr(p) { var a = []; if (p.on) a.push(peso(p.on)); if (p.usd) a.push(usd(p.usd)); return a.join(" + "); }
  function nowStr(p) { var a = []; if (p.dep) a.push(won(p.dep)); if (p.pre) a.push(usd(p.pre)); return a.join(" + ") || "0원"; }
  function dateKo(v) { if (!v) return ""; var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v); if (!m) return v; var d = new Date(+m[1], +m[2] - 1, +m[3]); return m[1] + "년 " + (+m[2]) + "월 " + (+m[3]) + "일(" + "일월화수목금토"[d.getDay()] + ")"; }
  function unitOf(it) { return it.unit || "명"; }
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
      t += "대표자 성함: " + state.cust.name + "\n카카오톡 ID 또는 연락처: " + state.cust.contact + "\n";
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
        t += "픽업 장소: " + e.pickup + "\n" + (mas ? "픽업 희망 시간: " + e.time + "\n" : "") + "드랍 장소: " + e.drop + "\n요청 사항: " + e.note + "\n";
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
        if (r.shop.prepayOnsite) t += "→ 예약 시 결제: " + won(r.payNow) + " (예약금 " + won(r.sp.dep) + " + 현장결제분 " + peso(r.sp.on) + " 원화 환산 " + won(r.prepayKrw) + ", 1페소 = " + state.rate + "원 기준)\n  ※ 환율에 따라 달라질 수 있어, 입금하실 때 정확한 금액을 다시 확인해 드립니다.\n";
        else t += "→ " + (r.sp.dep || r.sp.pre ? "예약 시 결제 " + nowStr(r.sp) : "예약금 없음") + (onsiteStr(r.sp) ? " / 현장결제 " + onsiteStr(r.sp) : "") + "\n";
        if (r.offKnown && r.lines.length) t += "  (참고: 업체 공식 요금은 " + priceStr(r.off) + "입니다.)\n";
      });
      t += "\n━━━━━━━━━━\n지금 입금하실 금액: " + won(c.payNow) + (c.pre ? " + " + usd(c.pre) : "") + "\n";
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
      return f.title.replace("{shop}", shop.name) + "\n" + f.lines.map(function (l) { return l[0] + ": " + Text.vendorValue(l[1], e, r); }).join("\n");
    }
  };

  /* ---------- 숙소 계산·문안 ---------- */
  function addDays(iso, n) { var p = iso.split("-"), d = new Date(+p[0], +p[1] - 1, +p[2] + n); return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
  function mdKo(iso) { var p = iso.split("-"); return (+p[1]) + "월 " + (+p[2]) + "일"; }
  var Stay = {
    hotel: function () { var i = state.stay.resort.hotel; return i === "" || i == null ? null : H.hotels[+i] || null; },
    money: function (n, cur) { return cur === "USD" ? usd(n) : peso(n); },
    resort: function () {
      var r = state.stay.resort, h = Stay.hotel(), nights = Math.max(1, +r.nights || 1), cur = h ? h.rooms[0].cur : r.cur;
      var margin = r.margin === "" || r.margin == null ? ST.resortMargin[cur] : +r.margin, adults = Math.max(0, +r.adults || 0), kids = Math.max(0, +r.kids || 0);
      var dates = []; if (r.checkin) for (var i = 0; i < nights; i++) dates.push(addDays(r.checkin, i));
      var td = today(), src, all = false;
      if (h) { src = r.picks.length ? r.picks.map(function (p) { var d = h.rooms.filter(function (x) { return x.type === p.type; })[0]; return d ? { def: d, rooms: Math.max(1, +p.rooms || 1) } : null; }).filter(Boolean) : h.rooms.filter(function (x) { return x.cur === cur; }).map(function (d) { return { def: d, rooms: 1 }; }); all = !r.picks.length; }
      else src = r.rows.filter(function (x) { return +x.tmj > 0; }).map(function (x) { return { def: { type: x.type, rate: +x.tmj }, rooms: Math.max(1, +x.rooms || 1) }; });
      var promoSell = h && h.sell && td >= h.sell[0] && td <= h.sell[1];
      var lines = src.map(function (s) {
        var d = s.def, base = 0, sur = 0, surN = 0, promoN = 0, surNames = [];
        for (var i = 0; i < nights; i++) {
          var dt = dates[i], promo = d.promo && promoSell && dt && h.stay && dt >= h.stay[0] && dt <= h.stay[1];
          base += (promo ? d.promo : d.rate) + margin; if (promo) promoN++;
          if (h && dt) h.sur.forEach(function (x) { if (dt >= x.from && dt <= x.to && x.amt[d.type]) { sur += x.amt[d.type]; surN++; if (surNames.indexOf(x.name) < 0) surNames.push(x.name); } });
        }
        return { type: d.type, rooms: s.rooms, night1: d.rate + margin, base: base * s.rooms, sur: sur * s.rooms, surN: surN, surNames: surNames, promoN: promoN, total: (base + sur) * s.rooms, profit: margin * nights * s.rooms };
      });
      var extras = [];
      if (h && dates.length) {
        h.gala.forEach(function (g) { var hit = dates.filter(function (dt) { return dt.slice(5) === g.date.slice(5); })[0]; if (hit) extras.push({ name: "갈라 디너(" + mdKo(hit) + ", 의무)", adult: g.adult, child: g.child, total: adults * g.adult + kids * g.child }); });
      }
      if (h) (ST.mandatory || []).forEach(function (m) { if (h.name.indexOf(m.match) >= 0 && nights >= m.minNights) m.items.forEach(function (it) { extras.push({ name: it.name, adult: it.adult, child: it.child, total: adults * it.adult + kids * it.child, note: m.note }); }); });
      var exTotal = extras.reduce(function (a, x) { return a + x.total; }, 0), minWarn = [], MIN = /MIN\.?\s*(?:OF\s*)?(\d+)\s*N/i, mm;
      if (h) {
        if ((mm = MIN.exec(h.name)) && nights < +mm[1]) minWarn.push("이 숙소는 최소 " + mm[1] + "박부터 예약됩니다(지금 " + nights + "박).");
        h.sur.forEach(function (x) { var m2 = MIN.exec(x.name); if (m2 && nights < +m2[1] && dates.some(function (dt) { return dt >= x.from && dt <= x.to; })) minWarn.push(x.name.replace(/\s*\(.*$/, "") + " 기간(" + x.from + " ~ " + x.to + ")은 최소 " + m2[1] + "박입니다(지금 " + nights + "박)."); });
      }
      return { h: h, lines: lines, all: all, nights: nights, margin: margin, cur: cur, adults: adults, kids: kids, extras: extras, exTotal: exTotal, minWarn: minWarn, dated: !!dates.length,
        total: lines.reduce(function (a, x) { return a + x.total; }, 0) + exTotal, profit: lines.reduce(function (a, x) { return a + x.profit; }, 0) };
    },
    resortText: function () {
      var r = state.stay.resort, c = Stay.resort(), m = function (n) { return Stay.money(n, c.cur); };
      var t = "안녕하세요, " + B + "입니다. 문의하신 숙소 요금을 안내해 드립니다.\n\n■ " + (r.name || "(숙소명)") + "\n" + (r.checkin ? "체크인 " + dateKo(r.checkin) + " · " : "") + c.nights + "박" + (c.adults || c.kids ? " · 성인 " + c.adults + "명" + (c.kids ? " + 아동 " + c.kids + "명" : "") : "") + "\n";
      c.lines.forEach(function (x) {
        t += "· " + (x.type || "객실") + (x.rooms > 1 ? " " + x.rooms + "객실" : "") + ": " + c.nights + "박 " + m(x.total);
        var d = [];
        if (x.sur) d.push("객실 요금 " + m(x.base) + " + 성수기 추가 요금 " + m(x.sur) + "(" + x.surN + "박 해당)");
        else if (c.nights > 1 || x.rooms > 1) d.push("1박 " + m(Math.round(x.base / c.nights / x.rooms)) + " 기준");
        if (x.promoN) d.push("프로모션 요금 적용");
        t += (d.length ? " (" + d.join(", ") + ")" : "") + "\n";
      });
      c.extras.forEach(function (x) { t += "· " + x.name + ": 성인 1인 " + m(x.adult) + (x.child ? " / 아동 1인 " + m(x.child) : "") + (x.total ? " → " + m(x.total) : "") + (x.note ? " ※ " + x.note : "") + "\n"; });
      if (!c.all && c.lines.length) t += "\n→ 합계 " + m(c.total) + "\n";
      t += "\n※ 객실당 요금이며 조식이 포함되어 있습니다.\n" + (c.dated ? "" : "※ 성수기·연휴에는 추가 요금이 붙을 수 있어, 날짜가 정해지면 정확한 금액을 다시 안내해 드립니다.\n") + "※ " + D.priceDate + " 기준 요금이며, 예약을 진행할 때 정확한 금액을 한 번 더 확인해 드립니다.\n\n" + ST.resortSteps;
      return t;
    },
    resortAsk: function () {
      var r = state.stay.resort, c = Stay.resort(), picked = r.picks.length || !c.h;
      return "안녕하세요, " + B + "입니다. 문의해 주셔서 감사합니다.\n정확한 요금과 예약 가능 여부를 확인해 드릴 수 있도록, 아래 빈칸을 채워서 보내 주시기 바랍니다.\n\n" +
        ["숙소: " + (r.name || ""), "체크인 날짜: " + dateKo(r.checkin), "체크아웃 날짜(또는 박수): " + (r.checkin ? dateKo(addDays(r.checkin, c.nights)) + " (" + c.nights + "박)" : ""),
          "객실 타입: " + (picked ? c.lines.map(function (x) { return x.type; }).join(", ") : ""), "객실 수: " + (picked ? c.lines.map(function (x) { return x.rooms + "객실"; }).join(", ") : ""),
          "인원(성인 / 아동은 만 나이): " + (r.checkin || picked ? "성인 " + c.adults + "명" + (c.kids ? " / 아동 " + c.kids + "명(만 나이: )" : "") : ""),
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
        "· 공식 요금(업체에 직접 예약하실 때): 1박 " + usd(c.direct) + "\n· " + B + " 스페셜: 1박 " + usd(c.sell) + (c.nights > 1 ? " × " + c.nights + "박 = " + usd(c.total) : "") + "\n\n" +
        "※ 빌라 한 채 전체 요금입니다(조식 불포함).\n※ " + D.priceDate + " 기준 요금이며, 날짜와 인원에 따라 달라질 수 있어 예약을 진행할 때 한 번 더 확인해 드립니다.\n\n예약을 원하시면 날짜와 인원(성인·아동 만 나이)을 알려 주세요. 예약 가능 여부를 확인한 뒤 바로 안내해 드리겠습니다.";
    },
    sol: function () {
      var s = state.stay.sol, p = ST.soltana.filter(function (x) { return x.key === s.key; })[0] || ST.soltana[0], tier = ST.soltanaTiers.filter(function (x) { return x.key === s.tier; })[0] || ST.soltanaTiers[0], off = ST.soltanaTiers[0];
      var rooms = Math.max(1, +s.rooms || 1), nights = p.room ? Math.min(ST.soltanaMaxNights, Math.max(1, +s.nights || 1)) : 0, aA = +s.addAdult || 0, aK = +s.addKid || 0, aB = +s.addBaby || 0;
      var one = function (t) { return (p.pack ? t.price[p.pack] : 0) + nights * t.price.room; };
      var units = (p.pack ? 1 : 0) + nights, extra = (aA * ST.soltanaAddAdult + aK * ST.soltanaAddKid) * units, rate = s.rate === "" || s.rate == null ? ST.soltanaRate : +s.rate;
      var parts = []; if (p.pack) parts.push(ST.soltana.filter(function (x) { return x.key === p.pack; })[0].name + " " + usd(tier.price[p.pack])); if (nights) parts.push("룸온리 " + nights + "박 × " + usd(tier.price.room));
      var c = { p: p, tier: tier, price: one(tier), official: one(off), parts: parts.join(" + "), rooms: rooms, nights: nights, units: units, aA: aA, aK: aK, aB: aB, extra: extra, beds: Math.min(rooms, aA + aK), bf: aA + aK, room: one(tier) * rooms, rate: rate };
      c.total = c.room + extra; c.krw = rate ? Math.ceil(c.total * rate / 1000) * 1000 : 0;
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
      var s = state.stay.sol, c = Stay.sol(), per = c.rooms + "객실", un = c.units > 1 ? " × " + c.units + "(" + (c.p.pack ? "팩 1회 + " : "") + c.nights + "박)" : "";
      var t = "안녕하세요, 솔타나콘도텔입니다. 요청하신 내용으로 안내해 드립니다.\n\n■ " + c.p.name + (s.checkin ? " — " + dateKo(s.checkin) : "") + "\n";
      t += "· 구성(객실당): " + c.parts + (c.parts.indexOf("+") > 0 ? " = " + usd(c.price) : "") + "\n";
      if (c.price !== c.official) t += "· 공식 요금: 객실당 " + usd(c.official) + " → " + c.tier.name + " 적용 " + usd(c.price) + "\n";
      t += "· " + per + " × " + usd(c.price) + " = " + usd(c.room) + "\n";
      if (c.aA) t += "· 성인 추가 " + c.aA + "명 × " + usd(ST.soltanaAddAdult) + un + " = " + usd(c.aA * ST.soltanaAddAdult * c.units) + " (조식 포함)\n";
      if (c.aK) t += "· 만 7세 이상 아동 추가 " + c.aK + "명 × " + usd(ST.soltanaAddKid) + un + " = " + usd(c.aK * ST.soltanaAddKid * c.units) + " (조식 포함)\n";
      if (c.aB) t += "· 만 7세 미만 아동 " + c.aB + "명: 무료 (엑스트라베드·조식 미포함)\n";
      if (c.beds) t += "· 퀸사이즈 엑스트라베드 " + c.beds + "개 포함\n";
      t += "→ 합계 " + usd(c.total) + (c.krw ? "\n→ 원화로 입금하실 경우: " + won(c.krw) + " (1달러 = " + num(c.rate) + "원 기준)" : "") + "\n";
      if (s.pax) t += "· 인원: " + s.pax + "\n";
      if (s.flight) t += "· 항공편: " + s.flight + "\n";
      t += "\n※ " + ST.soltanaNote + "\n※ " + D.priceDate + " 기준 요금입니다. 원화 금액은 환율에 따라 달라질 수 있어, 입금하실 때 정확한 금액을 다시 확인해 드립니다.\n[한화 입금] " + S.accounts.krw + "\n\n예약이 확정되면 바우처를 보내 드리겠습니다. 감사합니다.";
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
    return "";
  }
  function parsePaste(text) {
    var cur = null, hits = 0;
    text.split(/\r?\n/).forEach(function (line) {
      var head = /^\s*■\s*(.+)$/.exec(line);
      if (head) { cur = state.cart.filter(function (e) { return head[1].indexOf(shopById(e.shopId).name) >= 0; })[0] || null; return; }
      var m = /^([^:：]+)[:：]\s*(.*)$/.exec(line); if (!m) return;
      var k = m[1], v = m[2].trim(); if (!v) return;
      var targets = cur ? [cur] : state.cart;
      if (/성함|대표자|예약자(?! 전원)/.test(k) && !/영문/.test(k)) { state.cust.name = v; hits++; return; }
      if (/카카오|카톡|연락처/.test(k)) { state.cust.contact = v; hits++; return; }
      targets.forEach(function (e) {
        var shop = shopById(e.shopId);
        if (/날짜|일정/.test(k)) { var d = parseDate(v); if (d) { e.date = d; hits++; } }
        else if (/나이/.test(k)) { e.ages = v; hits++; }
        else if (/영문/.test(k)) { e.roster = v; hits++; }
        else if (/인원/.test(k) && shop.cat !== "마사지") {
          shop.items.forEach(function (it) {
            var word = it.key === "adult" ? "성인|입장권|어른" : it.key === "child" ? "아동|소인|아이|어린이" : it.key === "infant" ? "영아|유아" : it.label.replace(/\(.*\)/, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            var mm = new RegExp("(?:" + word + ")[^\\d/+,]*?(\\d+)").exec(v.replace(/\([^)]*\)/g, "")); if (mm) { e.q[it.key] = +mm[1]; hits++; }
          });
        }
        else if (/시작/.test(k)) { e.start = v; hits++; }
        else if (/시간|선택/.test(k)) { e.time = v; hits++; }
        else if (/픽업/.test(k)) { e.pickup = v; hits++; }
        else if (/드랍|드롭/.test(k)) { e.drop = v; hits++; }
        else if (/요청|특이/.test(k)) { e.note = v; hits++; }
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
    var h = '<h1>견적·예약 작성</h1><div class="card"><h2>손님 정보</h2><div class="grid2"><div><label>대표자 성함</label><input data-c="name" value="' + esc(state.cust.name) + '"></div><div><label>카카오톡 ID 또는 연락처</label><input data-c="contact" value="' + esc(state.cust.contact) + '"></div></div>' +
      '<details style="margin-top:10px"><summary class="note">손님이 채워 보낸 내용 붙여넣기</summary><textarea id="paste" placeholder="손님이 보낸 글을 그대로 붙여넣고 [내용 읽기]를 누르세요"></textarea><button class="btn sm" id="doParse" style="margin-top:6px">내용 읽기</button></details></div>';
    state.cart.forEach(function (e, i) {
      var s = shopById(e.shopId), r = c.rows[i], mas = s.cat === "마사지";
      h += '<div class="card" style="margin-top:10px"><div class="row"><div class="grow"><div class="cat">' + s.cat + "</div><h2>" + esc(s.name) + '</h2></div><button class="btn sm danger" data-cart="' + s.id + '">빼기</button></div>' +
        '<p class="note">★ 견적 필수: 날짜·인원' + (mas ? "·코스" : "") + ". 나머지는 예약 확정 때 채워도 됩니다.</p>" +
        '<div class="grid2">' + field(e, i, "date", "이용 날짜 ★", "date") + (mas ? (s.needStart ? field(e, i, "start", "마사지 시작 시간") : "") : (s.timeOptions ? field(e, i, "time", "선택", "", s.timeOptions) : field(e, i, "time", "시간(필요 시)"))) + "</div>" +
        '<div style="margin:10px 0">' + menuPick(s, e, i) + (s.items.length > 5 ? s.items.filter(function (it) { return e.q[it.key] > 0; }) : s.items).map(function (it) {
          return '<div class="qty"><span>' + esc(it.label) + "<small>" + priceStr(it.sp) + '</small></span><select data-e="' + i + '" data-q="' + it.key + '">' + nums.map(function (x) { return "<option" + (x === Number(e.q[it.key] || 0) ? " selected" : "") + ">" + x + "</option>"; }).join("") + "</select></div>";
        }).join("") + "</div>" +
        '<div class="grid2">' + (mas ? "" : field(e, i, "ages", "아동 만 나이")) + field(e, i, "pickup", "픽업 장소") + (mas ? field(e, i, "time", "픽업 시간") : "") + field(e, i, "drop", "드랍 장소") + field(e, i, "luggage", "짐 보관", "", ["유", "무"]) + (s.optionLabel ? field(e, i, "option", s.optionLabel) : "") + "</div>" +
        (s.form === "clubcebu" || s.form === "lokal" ? '<div style="margin-top:10px"><label>예약자 전원 영문이름·생년월일' + (s.form === "clubcebu" ? "·성별" : "") + '</label><textarea data-e="' + i + '" data-k="roster" style="min-height:70px">' + esc(e.roster) + "</textarea></div>" : "") +
        '<div style="margin-top:10px"><label>특이사항(직접 입력)</label><textarea data-e="' + i + '" data-k="note" style="min-height:60px">' + esc(e.note) + "</textarea></div>" +
        (s.needContact && !state.cust.contact ? '<p class="warn">이 업체는 손님 카카오톡 ID 또는 한국 연락처가 꼭 필요합니다.</p>' : "") +
        '<p class="note" style="margin:8px 0 0">' + (r.noPrice ? "요금은 업체가 직접 안내합니다." : "예약 시 " + nowStr(r.sp) + (onsiteStr(r.sp) ? " · 현장결제 " + onsiteStr(r.sp) : "") + (s.prepayOnsite ? " (원화 사전결제 " + won(r.prepayKrw) + ")" : "")) + "</p></div>";
    });
    if (c.rows.some(function (r) { return r.shop.prepayOnsite; })) h += '<div class="card" style="margin-top:10px"><label>페소 → 원 환산(클럽세부 사전결제용, 1페소당 원)</label><input id="rate" type="number" step="0.1" value="' + state.rate + '"></div>';
    h += '<div class="total" style="margin-top:12px"><small>손님이 지금 입금할 금액</small><div class="big">' + won(c.payNow) + (c.pre ? " + " + usd(c.pre) : "") + "</div><small>현장결제 합계 " + (onsiteStr({ on: c.on, usd: c.usd }) || "없음") + '</small></div>' +
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
      '<div class="card"><div class="grid2">' + sInput(["cust", "name"], "손님 성함(장부 저장용)") + sInput(["cust", "contact"], "카카오톡 ID 또는 연락처") + "</div></div>";
    if (st.tab === "resort") {
      var r = st.resort, c = Stay.resort(), hh = c.h, regions = {}, m = function (n) { return Stay.money(n, c.cur); };
      H.hotels.forEach(function (x, i) { (regions[x.region] = regions[x.region] || []).push([i, x.name]); });
      h += '<div class="card" style="margin-top:10px"><h2>리조트·호텔</h2>' +
        '<div><label>숙소 — TMJ 요금 ' + esc(H.date || "없음") + " 기준 " + H.hotels.length + '곳</label><select id="hotelSel"><option value="">직접 입력</option>' + Object.keys(regions).map(function (g) { return '<optgroup label="' + esc(g) + '">' + regions[g].map(function (x) { return '<option value="' + x[0] + '"' + (String(x[0]) === String(r.hotel) ? " selected" : "") + ">" + esc(x[1]) + "</option>"; }).join("") + "</optgroup>"; }).join("") + "</select></div>" +
        '<div class="grid2" style="margin-top:10px">' + sInput(["resort", "name"], "손님 글에 쓸 숙소 이름") + sInput(["resort", "checkin"], "체크인 ★(성수기 요금 계산)", "date") + sInput(["resort", "nights"], "박수", "number", ' min="1"') +
        sSelect(["resort", "adults"], "성인(갈라·의무 요금 계산)", range(0, 12)) + sSelect(["resort", "kids"], "아동", range(0, 10)) +
        (hh ? "" : sSelect(["resort", "cur"], "통화", [["PHP", "페소"], ["USD", "달러"]])) +
        sInput(["resort", "margin"], "1박당 붙이는 금액(비우면 " + ST.resortMargin[c.cur] + (c.cur === "USD" ? "달러" : "페소") + ")", "number") + "</div>";
      if (hh) {
        h += '<div style="margin-top:12px"><label>객실 타입 고르기 → 객실 수 → [추가]</label><div class="pick"><select id="roomSel">' + hh.rooms.map(function (x) { return '<option value="' + esc(x.type) + '">' + esc(x.type + " · 1박 " + Stay.money(x.rate + c.margin, x.cur) + (x.promo ? " (프로모 " + num(x.promo + c.margin) + ")" : "")) + "</option>"; }).join("") + '</select><select id="roomQty">' + [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(function (n) { return "<option value=\"" + n + '">' + n + "객실</option>"; }).join("") + '</select><button class="btn sm gold" id="addPick">추가</button></div>' +
          (r.picks.length ? r.picks.map(function (p, i) { return '<div class="picked"><span class="grow">' + esc(p.type) + " · <b>" + p.rooms + '객실</b></span><button class="btn sm danger" data-pdel="' + i + '">빼기</button></div>'; }).join("") : '<p class="note">고른 객실이 없으면 전체 객실 타입의 요금이 한꺼번에 나갑니다.</p>') + "</div>";
        var info = [];
        if (!r.checkin) info.push("체크인 날짜를 넣어야 성수기 추가 요금·갈라 디너가 계산됩니다.");
        c.lines.forEach(function (x) { if (x.sur) info.push(x.type + ": 성수기 추가 요금 " + m(x.sur) + " (" + x.surNames.join(", ") + ", " + x.surN + "박)"); if (x.promoN) info.push(x.type + ": 프로모 요금 " + x.promoN + "박 적용"); });
        c.extras.forEach(function (x) { info.push(x.name + ": 성인 " + m(x.adult) + " / 아동 " + m(x.child) + (x.total ? " → " + m(x.total) : " (인원을 넣으면 계산)")); });
        if (c.minWarn.length) h += '<p class="warn big" style="margin-top:10px">⚠ ' + c.minWarn.map(esc).join("<br>⚠ ") + "</p>";
        if (info.length) h += '<p class="warn" style="margin-top:10px">' + info.map(esc).join("<br>") + "</p>";
        h += '<details style="margin-top:8px"><summary class="note">TMJ 비고 원문(내부 참고 — 최소 숙박·픽업·조식 인원 등)</summary><div class="note pre">' + esc(hh.remark || "없음") + (hh.sur.length ? "\n\n[써차지]\n" + hh.sur.map(function (x) { return x.name + " " + x.from + " ~ " + x.to; }).join("\n") : "") + "</div></details>";
      } else {
        h += '<div style="margin-top:10px">' + r.rows.map(function (x, i) {
          return '<div class="rrow"><input data-rr="' + i + '.type" placeholder="객실 타입" value="' + esc(x.type) + '"><input data-rr="' + i + '.tmj" type="number" placeholder="TMJ 1박" value="' + esc(x.tmj) + '"><input data-rr="' + i + '.rooms" type="number" min="1" placeholder="객실 수" value="' + esc(x.rooms || 1) + '"><button class="btn sm danger" data-rdel="' + i + '">빼기</button></div>';
        }).join("") + '<button class="btn sm ghost" id="addRow" style="margin-top:6px">+ 객실 줄 추가</button></div>';
      }
      h += "</div>" + '<div class="total" style="margin-top:12px"><small>' + (c.all ? "전체 객실 타입 안내(객실을 고르면 합계가 나옵니다)" : "손님 견적 합계(" + c.nights + "박)") + '</small><div class="big">' + (c.all ? "객실 " + c.lines.length + "종" : m(c.total)) + "</div>" + (c.exTotal ? "<small>이 중 갈라·의무 요금 " + m(c.exTotal) + "</small>" : "") + "</div>" +
        '<div class="profit" style="margin-top:8px">' + (c.all ? "객실 1개·1박당 수익 " + m(c.margin) : "예상 수익 " + m(c.profit)) + " (손님 글에는 나가지 않습니다)</div>" +
        '<div class="card" style="margin-top:12px">' + outBox("stay_resort_ask", "① 손님께 보낼 예약폼(빈칸 채워 달라는 안내)", Stay.resortAsk()) + outBox("stay_resort", "② 숙소 견적", Stay.resortText()) + "</div>";
    }
    if (st.tab === "villa") {
      var v = st.villa, vc = Stay.villa();
      h += '<div class="card" style="margin-top:10px"><h2>풀빌라 (공식 = 넷가+' + ST.villaDirectAdd + "달러, 손님가 = 넷가+수익)</h2>" +
        sSelect(["villa", "idx"], "풀빌라", ST.villas.map(function (x, i) { return [i, x.name + " · " + x.rooms]; })) +
        '<div class="grid2" style="margin-top:10px">' + sInput(["villa", "checkin"], "체크인", "date") + sInput(["villa", "nights"], "박수", "number", ' min="1"') + sInput(["villa", "profit"], "1박 수익(달러, 기본 50·때로 40)", "number") + "</div>" +
        '<div class="scroll" style="margin-top:10px"><table><tr><th>구분</th><th>1박</th></tr><tr><td>넷가(내부)</td><td>' + usd(vc.d.net) + "</td></tr><tr><td>공식 요금(직세일)</td><td class=\"off\">" + usd(vc.direct) + '</td></tr><tr><td>손님가(' + B + ' 스페셜)</td><td class="sp">' + usd(vc.sell) + "</td></tr></table></div>" +
        (vc.d.note ? '<p class="note">' + esc(vc.d.note) + "</p>" : "") + "</div>" +
        '<div class="total" style="margin-top:12px"><small>손님 견적 합계(' + vc.nights + '박)</small><div class="big">' + usd(vc.total) + "</div></div>" +
        '<div class="profit" style="margin-top:8px">예상 수익 ' + usd(vc.profit) + " (손님 글에는 나가지 않습니다)</div>" +
        '<div class="card" style="margin-top:12px">' + outBox("stay_villa_ask", "① 손님께 보낼 예약폼(빈칸 채워 달라는 안내)", Stay.villaAsk()) + outBox("stay_villa", "② 풀빌라 견적", Stay.villaText()) + "</div>";
    }
    if (st.tab === "sol") {
      var s = st.sol, sc = Stay.sol();
      h += '<div class="card" style="margin-top:10px"><h2>솔타나콘도텔</h2>' +
        '<div class="scroll"><table><tr><th>요금</th>' + [["in", "입국팩"], ["out", "출국팩"], ["inout", "입국팩+출국팩"], ["room", "룸온리 1박"]].map(function (x) { return "<th>" + x[1] + "</th>"; }).join("") + "</tr>" + ST.soltanaTiers.map(function (t) { return "<tr><td>" + (t.key === sc.tier.key ? "<b>" + t.name + " ✓</b>" : t.name) + "</td>" + [["in", "입국팩"], ["out", "출국팩"], ["inout", "입국팩+출국팩"], ["room", "룸온리 1박"]].map(function (x) { return '<td class="' + (t.key === sc.tier.key && (x[0] === sc.p.pack || (x[0] === "room" && sc.p.room)) ? "sp" : "off") + '">' + t.price[x[0]] + "</td>"; }).join("") + "</tr>"; }).join("") + '</table></div><p class="note">단위: 달러, 객실당(룸온리는 1박당). 기준 인원 성인 2 + 아동 2.</p>' +
        '<div class="grid2">' + sSelect(["sol", "tier"], "적용 요금", ST.soltanaTiers.map(function (t) { return [t.key, t.name]; })) + sSelect(["sol", "key"], "투숙 타입", ST.soltana.map(function (x) { return [x.key, x.name]; })) +
        sInput(["sol", "checkin"], "체크인 날짜", "date") + sSelect(["sol", "rooms"], "객실 수", [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(function (n) { return [n, n + "객실"]; })) + (sc.p.room ? sSelect(["sol", "nights"], "룸온리 박수", [1, 2, 3, 4, 5, 6].map(function (n) { return [n, n + "박"]; })) : "") + sInput(["sol", "rate"], "원화 환산(1달러당 원, 비우면 " + num(ST.soltanaRate) + ")", "number") +
        sSelect(["sol", "addAdult"], "성인 추가(1인 " + ST.soltanaAddAdult + "달러, 엑베·조식 포함)", range(0, 10)) + sSelect(["sol", "addKid"], "만 7세 이상 아동 추가(1인 " + ST.soltanaAddKid + "달러, 엑베·조식 포함)", range(0, 10)) + sSelect(["sol", "addBaby"], "만 7세 미만 아동(무료, 엑베·조식 미포함)", range(0, 10)) +
        sInput(["sol", "flight"], "이용 항공편명") + sInput(["sol", "pax"], "각 방 인원 구성(아동 만 나이)") + sInput(["sol", "ename"], "대표자 영문 성함") + sc.p.times.map(function (label, i) { return sInput(["sol", i ? "t2" : "t1"], label); }).join("") + "</div>" +
        '<div style="margin-top:10px"><label>특이사항(추가로 적을 내용)</label><input data-s="sol.note" value="' + esc(s.note) + '"></div>' +
        '<p class="note">특이사항에 자동으로 들어가는 글: ' + esc(Stay.solNote()) + "</p>" +
        '<p class="note">엑스트라베드 ' + sc.beds + "개 포함(추가 인원 " + sc.bf + "명, 객실 " + sc.rooms + "개 — 엑스트라베드는 객실당 1개까지) · 조식 추가 " + sc.bf + "명</p></div>" +
        '<div class="total" style="margin-top:12px"><small>합계 (' + sc.tier.name + ')</small><div class="big">' + usd(sc.total) + "</div><small>객실 " + usd(sc.room) + (sc.extra ? " + 추가 인원 " + usd(sc.extra) : "") + (sc.krw ? " · 원화 약 " + won(sc.krw) : "") + "</small></div>" +
        '<div class="card" style="margin-top:12px">' + outBox("sol_ask", "① 손님께 보낼 예약폼(빈칸 채워 달라는 안내)", Stay.solAsk()) + outBox("sol_quote", "② 금액 안내", Stay.solText()) + "</div>";
    }
    return h + '<div class="row" style="margin-top:12px"><button class="btn gold grow" id="saveStay">이 숙소 견적을 장부에 저장</button></div>';
  }

  /* ---------- 자료실 ---------- */
  function libCard(x) {
    var body = x.text || (x.title + "\n" + x.url);
    return '<div class="lib"><div class="grow" style="min-width:0"><div class="nm">' + esc(x.title) + "</div>" + (x.url ? '<a class="note" href="' + esc(x.url) + '" target="_blank" rel="noopener">' + esc(x.url) + "</a>" : '<div class="note pre">' + esc(x.text) + "</div>") + '</div><button class="btn sm gold" data-copytext="' + esc(body) + '">복사</button></div>';
  }
  function viewLib() {
    var cats = [], q = state.libQ.trim().toLowerCase();
    var all = D.library.concat(D.shops.filter(function (s) { return s.post; }).map(function (s) { return { cat: "업체 상세글", title: s.name, url: s.post }; }));
    all.forEach(function (x) { if (cats.indexOf(x.cat) < 0) cats.push(x.cat); });
    var h = "<h1>상담 자료실</h1>" + '<input class="search" id="libQ" placeholder="자료 검색 (예: 풀빌라, 골프, 환불)" value="' + esc(state.libQ) + '">';
    if (q) {
      var items = all.filter(function (x) { return (x.title + x.cat + (x.text || "")).toLowerCase().indexOf(q) >= 0; });
      return h + '<p class="note" style="margin:8px 2px">검색 결과 ' + items.length + "건</p>" + '<div class="card">' + (items.length ? items.map(libCard).join("") : '<div class="empty">자료가 없습니다.</div>') + "</div>";
    }
    h += '<p class="note" style="margin:8px 2px">분류를 누르면 펼쳐집니다. 다시 누르면 접힙니다.</p>';
    cats.forEach(function (c) {
      var items = all.filter(function (x) { return x.cat === c; }), open = state.libOpen[c];
      h += '<div class="card fold"><button class="foldhd" data-libfold="' + esc(c) + '"><b>' + esc(c) + '</b><span class="badge">' + items.length + "</span><span class=\"arrow\">" + (open ? "▲" : "▼") + "</span></button>" + (open ? items.map(libCard).join("") : "") + "</div>";
    });
    return h + '<p class="note" style="margin-top:14px">넣을 글 주소나 문장을 알려 주시면 바로 추가하겠습니다.</p>';
  }

  /* ---------- 장부 동기화(Supabase 로그인) ---------- */
  var CFG = window.PB_CONFIG, sb = null, sync = { user: null, msg: "", busy: false, timer: 0 };
  try { if (CFG && window.supabase) sb = window.supabase.createClient(CFG.url, CFG.key); } catch (e) { sb = null; }
  function touch(x) { x.u = Date.now(); return x; }
  function syncSoon() { if (!sb || !sync.user) return; clearTimeout(sync.timer); sync.timer = setTimeout(doSync, 800); }
  function syncMsg(m) { sync.msg = m; if (state.view === "ledger") { var el = $("#syncMsg"); if (el) el.textContent = m; } }
  function doSync() {
    if (!sb || !sync.user || sync.busy) return Promise.resolve();
    sync.busy = true; syncMsg("동기화 중…");
    return sb.from("pb_bookings").select("id,data").then(function (res) {
      if (res.error) throw res.error;
      var remote = {}, local = {}, ups = [], changed = 0;
      res.data.forEach(function (r) { remote[r.id] = r.data; });
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
      return sb.from("pb_bookings").upsert(ups).then(function (r2) { if (r2.error) throw r2.error; done(); });
    }).catch(function (e) { sync.busy = false; syncMsg("동기화 실패: " + (e.message || e)); });
  }
  function syncBox() {
    if (!sb) return '<div class="card" style="margin-top:10px"><p class="note">기기 간 동기화를 쓸 수 없는 상태입니다(인터넷 연결 또는 설정 파일 확인). 장부는 이 기기에만 저장됩니다.</p></div>';
    if (!sync.user) return '<div class="card" style="margin-top:10px"><h2>폰·PC 장부 동기화</h2><p class="note">로그인하면 이 기기의 장부가 다른 기기와 합쳐집니다. 로그인하지 않으면 이 기기에만 저장됩니다.</p><div class="grid2"><div><label>이메일</label><input id="sbEmail" type="email" autocomplete="username"></div><div><label>비밀번호</label><input id="sbPw" type="password" autocomplete="current-password"></div></div><div class="row" style="margin-top:8px;flex-wrap:wrap"><button class="btn sm gold" id="sbLogin">로그인</button><button class="btn sm ghost" id="sbSignup">처음이면 계정 만들기</button></div><p class="note" id="syncMsg">' + esc(sync.msg) + "</p></div>";
    return '<div class="card" style="margin-top:10px"><div class="row" style="flex-wrap:wrap"><div class="grow"><b>동기화 켜짐</b> <span class="note">' + esc(sync.user.email || "") + '</span></div><button class="btn sm" id="sbSync">지금 동기화</button><button class="btn sm ghost" id="sbLogout">로그아웃</button></div><p class="note" id="syncMsg" style="margin:6px 0 0">' + esc(sync.msg) + "</p></div>";
  }
  if (sb) {
    sb.auth.onAuthStateChange(function (ev, session) { var was = sync.user; sync.user = session ? session.user : null; if (sync.user && !was) setTimeout(doSync, 0); if (state.view === "ledger" && !!was !== !!sync.user) render(); });
  }

  /* ---------- 장부 ---------- */
  var STATUS = { "견적": "견적만 보낸 상태(아직 입금 전)", "확정": "입금을 받고 업체에 예약을 넣은 상태", "완료": "손님이 이용을 마쳐 끝난 건" };
  function viewLedger() {
    var L = state.led, months = {}, shopsAll = {};
    state.bookings.forEach(function (x) { x.shops.forEach(function (s) { shopsAll[s] = 1; }); if (x.status === "견적") return; var m = (x.firstDate || x.created).slice(0, 7), o = months[m] = months[m] || { n: 0, krw: 0, php: 0, shops: {} }; o.n++; o.krw += x.profitKrw || 0; o.php += x.profitPhp || 0; o.usd = (o.usd || 0) + (x.profitUsd || 0); x.shops.forEach(function (s) { o.shops[s] = (o.shops[s] || 0) + 1; }); });
    var q = L.q.trim().toLowerCase();
    var b = state.bookings.filter(function (x) {
      return (L.status === "전체" || x.status === L.status) && (L.shop === "전체" || x.shops.indexOf(L.shop) >= 0) &&
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
      chips(["전체", "견적", "확정", "완료"], L.status, "ledst") +
      '<p class="note" style="margin:6px 0 0">견적 = ' + STATUS["견적"] + " · 확정 = " + STATUS["확정"] + " · 완료 = " + STATUS["완료"] + ". 견적→확정은 입금을 확인하고 직접 눌러 주세요. 확정 건은 이용일이 지나면 자동으로 완료로 바뀝니다. 월별 실적에는 확정·완료만 들어갑니다.</p></div>";
    h += '<p class="note" style="margin:10px 2px 0">' + b.length + "건 / 전체 " + state.bookings.length + '건</p><div class="list">' + (b.length ? b.map(function (x) {
      return '<div class="card"><div class="row"><div class="grow"><b>' + esc(x.name || "(이름 없음)") + '</b> <span class="badge' + (x.status !== "견적" ? " ok" : "") + '">' + x.status + '</span><div class="note">' + esc(x.shops.join(" · ")) + " · 이용일 " + (x.firstDate || "미정") + " · 저장 " + x.created + '</div><div class="note">' + (x.kind === "stay" ? "견적 " + esc(x.payText) : "입금 " + won(x.payNow)) + " · 수익 " + (x.own ? "직영(따로 계산)" : profitStr(x.profitKrw, x.profitPhp, x.profitUsd)) + (x.auto ? " · 이용일이 지나 자동 완료" : "") + "</div></div></div>" +
        '<div class="row" style="margin-top:8px;flex-wrap:wrap"><button class="btn sm ghost" data-open="' + x.id + '">불러오기</button>' + ["견적", "확정", "완료"].map(function (st) { return '<button class="btn sm ' + (x.status === st ? "" : "ghost") + '" data-st="' + x.id + "|" + st + '">' + st + "</button>"; }).join("") + '<button class="btn sm danger" data-del="' + x.id + '">삭제</button></div></div>';
    }).join("") : '<div class="empty">' + (state.bookings.length ? "조건에 맞는 예약이 없습니다." : "저장된 예약이 없습니다.") + "</div>") + "</div>" +
      '<p class="note" style="margin-top:14px">장부는 이 기기의 브라우저에 저장되고, 로그인하면 다른 기기와 합쳐집니다. <button class="btn sm ghost" id="exportBk">백업 파일 내려받기</button></p>';
    return h;
  }
  var VIEWS = { shop: viewShop, quote: viewQuote, ledger: viewLedger, stay: viewStay, lib: viewLib, home: viewHome };
  function render() {
    $("#app").innerHTML = (VIEWS[state.view] || viewHome)();
    $("#cartCount").textContent = state.cart.length;
    document.querySelectorAll(".top nav button").forEach(function (b) { b.classList.toggle("on", b.dataset.view === state.view || (state.view === "shop" && b.dataset.view === "home")); });
  }
  function rerenderKeep(id) { var el = $("#" + id), pos = el ? el.selectionStart : 0; render(); el = $("#" + id); if (el) { el.focus(); try { el.setSelectionRange(pos, pos); } catch (e) { } } }
  function refreshQuote(keepFocus) { state.edited = {}; save(); if (!keepFocus) render(); }
  function loadHotel(idx) {
    var r = state.stay.resort, h = idx === "" ? null : H.hotels[+idx]; r.hotel = idx; r.picks = []; r.margin = "";
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
    if (d.madd != null) { state.cart[+d.madd].q[$("#msel" + d.madd).value] = +$("#mqty" + d.madd).value; return refreshQuote(); }
    if (d.pdel != null) { state.stay.resort.picks.splice(+d.pdel, 1); state.edited = {}; save(); return render(); }
    if (t.id === "saveStay") {
      var sb = Stay.booking(), tab = state.stay.tab;
      state.bookings.push({ u: Date.now(), id: "b" + Date.now(), created: today(), status: "견적", kind: "stay", stayTab: tab, staySnap: clone(state.stay[tab]), name: state.stay.cust.name, cust: clone(state.stay.cust), cart: [], shops: [sb.label], firstDate: sb.date || "", lastDate: sb.date ? addDays(sb.date, sb.nights) : "", payNow: 0, payText: sb.payText, profitKrw: 0, profitPhp: sb.profitPhp, profitUsd: sb.profitUsd, own: !!sb.own });
      save(); syncSoon(); return toast("장부에 저장했습니다");
    }
    if (d.ledst) { state.led.status = d.ledst; return render(); }
    if (d.stab) { state.stay.tab = d.stab; state.edited = {}; save(); return render(); }
    if (d.shop) return go("shop", d.shop);
    if (d.cart) return toggleCart(d.cart);
    if (d.tab) { state.tab = d.tab; return render(); }
    if (d.copy) return copy($('[data-out="' + d.copy + '"]').value);
    if (d.copytext != null) return copy(d.copytext);
    if (d.reset) { delete state.edited[d.reset]; return render(); }
    if (t.id === "addRow") { state.stay.resort.rows.push({ type: "", tmj: "", rooms: 1 }); save(); return render(); }
    if (d.rdel != null) { state.stay.resort.rows.splice(+d.rdel, 1); state.edited = {}; save(); return render(); }
    if (t.id === "doParse") { var n = parsePaste($("#paste").value); refreshQuote(); return toast(n ? n + "개 항목을 읽었습니다" : "읽을 수 있는 항목이 없습니다"); }
    if (t.id === "clearCart") { if (confirm("작성 중인 견적을 비울까요?")) { state.cart = []; state.cust = { name: "", contact: "" }; state.edited = {}; save(); go("home"); } return; }
    if (t.id === "saveBooking") {
      var c = Calc.cart(), dates = state.cart.map(function (e) { return e.date; }).filter(Boolean).sort();
      state.bookings.push({ u: Date.now(), id: "b" + Date.now(), created: today(), status: "견적", name: state.cust.name, cust: clone(state.cust), cart: clone(state.cart), shops: c.rows.map(function (r) { return r.shop.name; }), firstDate: dates[0] || "", lastDate: dates[dates.length - 1] || "", payNow: c.payNow, profitKrw: c.profitKrw, profitPhp: c.profitPhp, profitUsd: c.profitUsd });
      save(); syncSoon(); return toast("장부에 저장했습니다");
    }
    if (d.st) { var p = d.st.split("|"); state.bookings.forEach(function (x) { if (x.id === p[0]) { x.status = p[1]; x.auto = false; touch(x); } }); save(); syncSoon(); return render(); }
    if (d.del) { if (confirm("이 예약 기록을 삭제할까요? 되돌릴 수 없습니다.")) { state.bookings = state.bookings.filter(function (x) { return x.id !== d.del; }); state.tomb.push({ id: d.del, u: Date.now() }); save(); syncSoon(); render(); } return; }
    if (d.open) { var bk = state.bookings.filter(function (x) { return x.id === d.open; })[0]; if (bk && bk.kind === "stay") { state.stay.tab = bk.stayTab; state.stay[bk.stayTab] = Object.assign(clone(stayDefault[bk.stayTab]), clone(bk.staySnap)); state.stay.cust = clone(bk.cust || { name: "", contact: "" }); state.edited = {}; save(); go("stay"); }
      else if (bk) { state.cart = clone(bk.cart).filter(function (e) { return shopById(e.shopId); }); state.cust = clone(bk.cust); state.edited = {}; save(); go("quote"); } return; }
    if (t.id === "sbLogin" || t.id === "sbSignup") {
      var em = $("#sbEmail").value.trim(), pw = $("#sbPw").value; if (!em || !pw) return syncMsg("이메일과 비밀번호를 넣어 주세요.");
      syncMsg(t.id === "sbLogin" ? "로그인 중…" : "계정 만드는 중…");
      (t.id === "sbLogin" ? sb.auth.signInWithPassword({ email: em, password: pw }) : sb.auth.signUp({ email: em, password: pw })).then(function (r) {
        if (r.error) return syncMsg((t.id === "sbLogin" ? "로그인 실패: " : "계정 만들기 실패: ") + r.error.message);
        if (!r.data.session) return syncMsg("확인 메일을 보냈습니다. 메일의 링크를 누른 뒤 여기서 로그인해 주세요.");
      });
      return;
    }
    if (t.id === "sbLogout") { sb.auth.signOut().then(function () { sync.msg = ""; render(); }); return; }
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
    if (d.q) { state.cart[+d.e].q[d.q] = +t.value; return refreshQuote(); }
    if (d.k || d.c) return refreshQuote();
    if (t.id === "rate") { state.rate = +t.value || S.pesoRate; return refreshQuote(); }
    if (t.id === "hotelSel") { loadHotel(t.value); state.edited = {}; save(); return render(); }
    if (t.id === "ledSort") { state.led.sort = t.value; return render(); }
    if (t.id === "ledShop") { state.led.shop = t.value; return render(); }
    if (d.s) { var p = d.s.split("."); state.stay[p[0]][p[1]] = t.value; if (d.s === "resort.cur") state.stay.resort.margin = ""; state.edited = {}; save(); return render(); }
    if (d.rr) { save(); return render(); }
  });
  state.cart = state.cart.filter(function (e) { return shopById(e.shopId); });
  (function () { var td = today(), ch = 0; state.bookings.forEach(function (x) { var d = x.lastDate || x.firstDate; if (x.status === "확정" && d && d < td) { x.status = "완료"; x.auto = true; touch(x); ch++; } }); if (ch) save(); })();
  var dl = document.createElement("datalist"); dl.id = "places"; dl.innerHTML = (S.places || []).map(function (p) { return '<option value="' + esc(p) + '">'; }).join(""); document.body.appendChild(dl);
  window.PB = { Calc: Calc, Text: Text, Stay: Stay, state: state, parsePaste: parsePaste };
  render();
})();
