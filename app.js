/* 필보드 — 계산·문안 로직(Calc, Text, Stay)은 화면(View)과 분리해 두었다. 나중에 투윙스 사이트에 그대로 옮길 수 있다. */
(function () {
  "use strict";
  var D = window.PB_DATA, S = D.settings, ST = D.stay, H = window.PB_HOTELS || { date: "", hotels: [] }, B = S.brand;
  /* 내부 자료(넷가·숙소 원가·계좌)가 이미 들어 있으면(이 PC 개발용) 잠금 없음. 공개 주소에서는 로그인 뒤 data/private.enc 를 연다(아래 '내부 자료') */
  var PRIV = { ok: !!(S.accounts && window.PB_HOTELS), loading: false, msg: "" }; PRIV.remote = !PRIV.ok;
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
  var stayDefault = { tab: "resort", cust: { name: "", contact: "" }, resort: { hotel: "", name: "", checkin: "", nights: 1, adults: 2, kids: 0, kidAges: "", ebn: 0, cur: "PHP", margin: "", picks: [], rows: [] }, villa: { idx: 0, checkin: "", nights: 1, profit: ST.villaProfit }, sol: { tier: "double", key: "in", checkin: "", rooms: 1, nights: 1, addAdult: 0, addKid: 0, addBaby: 0, kidBed: 0, bfPax: 0, totalPax: "", flight: "", pax: "", ename: "", t1: "", t2: "", note: "" } };
  var state = {
    view: "home", shopId: null, q: "", cat: "전체", tab: "ask", libOpen: {}, libQ: "",
    cart: store.get("cart", []), cust: store.get("cust", { name: "", contact: "" }),
    rate: store.get("rate2", S.pesoRate), fx: store.get("fx2", S.usdRate), fxInfo: store.get("fxInfo", { manual: false, mid: 0, date: "" }), bookings: store.get("bookings", []), tomb: store.get("tomb", []), edited: store.get("edited", {}), editedBase: store.get("editedBase", {}), openId: store.get("openId", ""), stayOpenId: store.get("stayOpenId", ""),
    stay: (function () { var d = clone(stayDefault), v = store.get("stay3", {}); Object.keys(d).forEach(function (k) { if (v[k] != null) d[k] = typeof d[k] === "object" ? Object.assign(d[k], v[k]) : v[k]; }); return d; })(),
    led: { q: "", sort: "new", status: "전체", shop: "전체" }
  };
  function save() { store.set("cart", state.cart); store.set("cust", state.cust); store.set("rate2", state.rate); store.set("fx2", state.fx); store.set("fxInfo", state.fxInfo); store.set("bookings", state.bookings); store.set("tomb", state.tomb); store.set("stay3", state.stay); store.set("edited", state.edited); store.set("editedBase", state.editedBase); store.set("openId", state.openId); store.set("stayOpenId", state.stayOpenId); }
  /* 손으로 고친 글: 칸을 바꿔도 지우지 않고 남긴다. 그 뒤 계산이 바뀌면 '계산이 바뀌었습니다' 표시만 하고, [원래대로]를 눌러야 새 계산 글로 바뀐다(감사 PB-A-10·D-14). 새 견적·불러오기 때만 비운다 */
  function clearEdited(test) { Object.keys(state.edited).forEach(function (k) { if (!test || test(k)) { delete state.edited[k]; delete state.editedBase[k]; } }); }
  var isStayOut = function (k) { return /^(stay_|sol_)/.test(k); };
  function newEntry(id) { return { shopId: id, date: "", time: "", start: "", q: {}, ages: "", pickup: "", drop: "", luggage: "", option: "", roster: "", note: "", sitter: "", sitterN: "", paxText: "" }; }
  function kidIn(s, e) { return s.items.some(function (it) { return (e.q[it.key] || 0) > 0 && /아동|키즈|어린이|kid/i.test(it.label + " " + it.key); }); } // 아동 코스·아동권을 담았나(감사 PB-B-20)

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
  function dateKoPlain(v) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || ""); return m ? m[1] + "년 " + (+m[2]) + "월 " + (+m[3]) + "일" : v; }
  function dateKo(v) { if (!v) return ""; var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v); if (!m) return v; var d = new Date(+m[1], +m[2] - 1, +m[3]); return m[1] + "년 " + (+m[2]) + "월 " + (+m[3]) + "일(" + "일월화수목금토"[d.getDay()] + ")"; }
  function unitOf(it) { return it.unit || "명"; }
  /* 조사: 받침 있으면 '을', 없으면 '를'(괄호로 끝나는 이름은 괄호 앞 글자 기준) — 손님 글의 '한바다 호핑을(를)' 꼬리 없애기(감사 PB-A-23) */
  function eul(w) { var t = String(w || "").replace(/\([^)]*\)\s*$/, "").trim(), c = t.charCodeAt(t.length - 1); return w + (c >= 0xAC00 && c <= 0xD7A3 ? ((c - 0xAC00) % 28 ? "을" : "를") : "을(를)"); }
  /* 요금 한 칸을 원화로 어림(참고 공식 요금이 스페셜보다 쌀 때 '참고' 줄을 빼려고 — 감사 PB-B-18) */
  function krwOf(p) { return (p.dep || 0) + (p.on || 0) * (+state.rate || S.pesoRate) + ((p.usd || 0) + (p.pre || 0)) * (+state.fx || S.usdRate); }
  /* 숙소 손님 글 이름: TMJ 내부 꼬리 '(MIN. 2N)'·'(ROOM ONLY)'를 떼고, 아는 숙소는 한글 이름(영문) — 감사 PB-D-15. 한글 표기는 카페 글에서 가장 많이 쓴 것 */
  var HOTEL_KO = { "SHANGRILA MACTAN": "샹그릴라 막탄", "JPARK ISLAND RESORT": "제이파크 아일랜드 리조트", "DUSIT THANI": "두짓타니 막탄", "SHERATON MACTAN": "쉐라톤 막탄", "MOVENPICK HOTEL": "뫼벤픽 호텔", "MARIBAGO BLUEWATER": "마리바고 블루워터", "THE REEF": "더리프", "SOLEA MACTAN": "솔레아 막탄", "CEBU WHITE SANDS": "화이트샌즈", "PLANTATION BAY": "플랜테이션 베이", "CRIMSON RESORT & SPA": "크림슨 리조트", "COSTABELLA": "코스타벨라", "TAMBULI RESORT": "탐불리 리조트", "SOTO GRANDE": "소토그란데", "WATERFRONT CEBU": "워터프론트 세부", "WATERFRONT MACTAN": "워터프론트 막탄", "BAI HOTEL": "바이 호텔", "NUSTAR HOTEL": "누스타 호텔", "RADISSON BLU": "래디슨 블루", "ARTERRA": "아테라", "MERCURE": "머큐어", "CUBE 9": "큐브9", "SAVOY HOTEL": "사보이 호텔" };
  function ebKo(l) { var m = [[/^extra person with extra bed$/i, "추가 인원(엑스트라베드 포함)"], [/^extra person$/i, "추가 인원"], [/^extra bed$/i, "엑스트라베드"], [/^extra mattress only$/i, "추가 매트리스"], [/^extra mattress$/i, "추가 매트리스"], [/^extra futon$/i, "추가 요(이불 매트)"], [/^roll ?away bed$/i, "롤어웨이 베드"], [/^sofa bed$/i, "소파 베드"]].filter(function (x) { return x[0].test(String(l).trim()); })[0]; return m ? m[1] : l; }
  function hotelShow(n) {
    var raw = String(n || ""), mm = /\(?\s*MIN\.?\s*(\d+)\s*N\s*\)?/i.exec(raw), en = raw.replace(/\s*\(?\s*MIN\.?\s*\d+\s*N\s*\)?/i, "").replace(/\s*\(ROOM ONLY\)/i, "").trim();
    if (!/^[A-Z0-9 &'().,\-]+$/.test(en)) return { name: raw, min: 0 }; // 사장님이 직접 쓴 이름(한글 등)은 그대로
    var ko = HOTEL_KO[en.toUpperCase()];
    return { name: ko ? ko + " (" + en + ")" : en, min: mm ? +mm[1] : 0 };
  }
  /* 달러 금액을 원화로 안내할 때 붙이는 글 — 환율 칸 값(견적마다 사장님 환율)으로 천 원 단위 올림 */
  function fxKrw(n) { return Math.ceil(n * (+state.fx || S.usdRate) / 1000) * 1000; }
  /* 원장 261120-47(261119-92): 사장님이 견적마다 준 환율로 한화 입금액을 계산해 적는다 — '약'·'입금 당일 현찰 살 때 환율로 다시 안내' 문구는 쓰지 않는다(감사 PB-D-17·A-14·C-16) */
  function fxLine(n) { return "→ 원화로 입금하실 경우: " + won(fxKrw(n)) + " (1달러 = " + num(+state.fx || S.usdRate) + "원 기준)"; }
  function fxNote() { return " (1달러 = " + num(+state.fx || S.usdRate) + "원)"; }
  function fxInput() {
    var f = state.fxInfo, why = f.manual ? "직접 넣은 값(이 환율로 손님 글의 원화 금액을 계산합니다)" : f.mid ? "임시 자동값: " + f.date + " 기준환율 " + num(Math.round(f.mid)) + "원 + " + (Math.round(S.usdSpread * 10000) / 100) + "% — 견적마다 사장님 환율로 바꿔 넣으세요" : "자동 환율을 아직 못 받아 기본값 사용 — 견적마다 사장님 환율로 바꿔 넣으세요";
    return '<div><label>달러 → 원 환산(1달러당 원, 견적마다 사장님 환율)</label><input id="fx" type="number" value="' + esc(state.fx) + '"><small class="note" style="display:block;margin-top:4px">' + esc(why) + (f.manual ? ' <button class="btn sm ghost" id="fxAuto">자동 환율로</button>' : "") + "</small></div>";
  }
  /* 하루 한 번 기준환율을 받아 임시 기본값(기준환율 × 1.0175)을 채운다. 견적 때는 사장님 환율을 직접 넣는다(원장 261120-47). 직접 넣은 값이 있으면 건드리지 않는다 */
  function fxFetch(force) {
    var f = state.fxInfo; if (!force && f.date === today() && f.mid) return;
    fetch("https://open.er-api.com/v6/latest/USD").then(function (r) { return r.json(); }).then(function (j) {
      var mid = j && j.rates && j.rates.KRW; if (!mid) return;
      f.mid = mid; f.date = today(); if (!f.manual) state.fx = Math.ceil(mid * (1 + S.usdSpread)); save();
      if (state.view === "stay" || state.view === "quote") render();
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
      var st = sitterOf(shop, e); // 보모(시터) 추가 — 현장결제에 더하고 업체 몫(수익 0)으로 계산
      if (st) { r.sitter = st; var sp = { on: st.amt }; add(r.sp, sp, st.n); add(r.net, sp, st.n); add(r.off, sp, st.n); }
      var cmBase = clone(r.sp); // 커미션 업체는 조건 추가금(업체 몫)을 빼고 수익을 잡는다
      applyRules(shop, e, r);
      r.profitKnown = !shop.noNet;
      var cm = shop.commission || 0;
      r.profitKrw = !r.profitKnown ? 0 : cm ? Math.round(cmBase.dep * cm) : r.sp.dep - r.net.dep;
      r.profitPhp = !r.profitKnown ? 0 : cm ? Math.round(cmBase.on * cm) : r.sp.on - r.net.on;
      r.profitUsd = !r.profitKnown ? 0 : cm ? Math.round(cmBase.usd * cm) : (r.sp.pre + r.sp.usd) - (r.net.pre + r.net.usd);
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
  /* 보모 추가(라움스파 등 shop.sitter = [[분, 페소], ...]): e.sitter = "60분 · 100페소", e.sitterN = "1명" */
  function sitterOpts(shop) { return (shop.sitter || []).map(function (x) { return x[0] + "분 · " + num(x[1]) + "페소"; }); }
  function sitterOf(shop, e) {
    if (!shop.sitter || !e.sitter) return null;
    var mn = parseInt(e.sitter, 10), row = shop.sitter.filter(function (x) { return x[0] === mn; })[0]; if (!row) return null;
    return { min: mn, amt: row[1], n: Math.max(1, parseInt(e.sitterN, 10) || 1) };
  }
  function sitterStr(st) { return st ? "보모 " + st.min + "분 " + st.n + "명" : ""; }
  function pickupTimeShop(shop) { return shop.cat === "마사지" || !!shop.pickupTime; } // 시간 칸 = 픽업 시간인 업체(마사지·에이스크랩)
  function paxLine(e, r) { return r.lines.map(function (l) { return lab(l.it, e).replace(/\(.*\)/, "") + " " + l.n + unitOf(l.it); }).join(" + ") + (e.ages ? " (아동 만 나이: " + e.ages + ")" : ""); }

  /* ---------- 업체별 조건 규칙(감사 P4, 11-24) ----------
     혼자 예약 추가금·불가, 패키지 2인 기준, 나이, 휴무 요일, 골프 주말·공휴일 요금, 할인 시간대, 픽드랍 추가금·무료 조건·불가 지역.
     값은 모두 data/shops.js 의 업체 칸(solo·pair·ageRule·closedDays·weekendRate·discountWindow·timeItems·pickupFee·zones·pick)에만 둔다.
     r.extra = 금액에 더하는 줄(업체 몫 — 수익 0), r.warns = 화면 경고(hard 면 복사 전에 한 번 더 묻는다), r.notes = 손님 견적에 넣는 안내 */
  function lab(it, e) { var l = it.label; if (it.labelFrom && e && e.date) Object.keys(it.labelFrom).sort().forEach(function (d) { if (e.date >= d) l = it.labelFrom[d]; }); return l; }
  function reHit(src, txt) { return !!(src && txt && new RegExp(src, "i").test(txt)); }
  function isAirport(t) { t = t || ""; return /공항|airport/i.test(t) && !/공항 ?(인근|근처)/.test(t); }
  function dayOf(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ""); if (!m) return null;
    var w = new Date(+m[1], +m[2] - 1, +m[3]).getDay(), hol = (S.holidays || {})[iso] || "";
    return { dow: w, hol: hol, weekend: w === 0 || w === 6 || !!hol, unknownHol: !hol && iso > (S.holidaysUntil || "9999") && w > 0 && w < 6 };
  }
  function agesList(e) { return String(e.ages || "").split(/[,，\/·]|\s+(?=\d)|및|와|과/).map(function (x) { var m = /(\d+)\s*(개월|년생|년)?/.exec(x); return m && !m[2] && m[1].length <= 2 ? +m[1] : null; }).filter(function (x) { return x != null; }); }
  function hm(t) { t = String(t || ""); var m = /(\d{1,2})\s*(?::|시)\s*(\d{1,2})?/.exec(t) || /^\s*(\d{1,2})\s*$/.exec(t); if (!m) return null; var h = +m[1], mi = +(m[2] || 0); if (/오후|저녁|밤|pm/i.test(t) && h < 12) h += 12; return h > 24 || mi > 59 ? null : h * 60 + mi; }
  function applyRules(shop, e, r) {
    r.extra = []; r.warns = []; r.notes = [];
    if (!r.pax) return;
    var W = function (t, hard) { if (!r.warns.some(function (w) { return w.t === t; })) r.warns.push({ t: t, hard: !!hard }); };
    var N = function (t) { if (t && r.notes.indexOf(t) < 0) r.notes.push(t); };
    var X = function (label, p, n, unit) { r.extra.push({ label: label, p: p, n: n, unit: unit }); add(r.sp, p, n); add(r.net, p, n); add(r.off, p, n); };
    var main = r.lines.reduce(function (a, l) { return a + (l.it.key === "infant" ? 0 : l.n); }, 0);
    /* 날짜·시간 확인(감사 PB-B-14·B-21) — 복사 전 확인창 */
    if (!e.date) W("이용 날짜가 비었습니다 — 날짜를 넣어야 요금·휴무일·예약 가능 여부가 맞습니다.", true);
    else if (e.date < today()) W("이용 날짜(" + e.date + ")가 오늘보다 앞입니다 — 날짜를 확인하세요.", true);
    [e.time, e.start].forEach(function (v) { (String(v || "").match(/\d{1,2}:\d{2}/g) || []).forEach(function (hm) { var p = hm.split(":"); if (+p[0] > 23 || +p[1] > 59) W("시간 '" + hm + "'이(가) 맞지 않습니다 — 24시간 표기(예: 19:30)로 고치세요.", true); }); });
    /* 공항: 인원에 맞는 차량(1~3인 이노바, 4~8인 밴, 9인+ 2대 — 원장 261118-48·261120-59, 감사 PB-C-13) */
    if (shop.paxText) {
      var pxs = String(e.paxText || "").replace(/\([^)]*\)/g, ""), pxm = pxs.match(/\d+(?=\s*명)/g) || (/명/.test(pxs) ? [] : pxs.match(/\d+/g) || []), pn = pxm.reduce(function (a, x) { return a + (+x); }, 0), inn = e.q.innova || 0, van = e.q.van || 0;
      if (!pn) W("공항 인원 칸이 비었습니다 — 인원을 넣어야 업체에 전달되고 차량이 맞는지 확인됩니다.");
      else if (pn > 8 * van + 3 * inn) W("인원 " + pn + "명인데 차량이 " + (inn ? "이노바 " + inn + "대" : "") + (inn && van ? "·" : "") + (van ? "밴 " + van + "대" : "") + "입니다 — 이노바는 1~3인, 밴은 4~8인, 9명 이상은 2대입니다.", true);
    }
    /* 혼자 예약 */
    if (shop.solo && main === 1) { if (shop.solo === "block") W(shop.name + "은(는) 1인 단독 예약이 안 됩니다 — 2명 이상이거나 다른 호핑을 권해 주세요.", true); else X(shop.solo.label, { dep: shop.solo.dep, on: shop.solo.on, usd: shop.solo.usd }, 1, "명"); }
    /* 패키지 2인 기준(엘스파) — 한 패키지를 1명만 쓰면 싱글차지 */
    if (shop.pair) {
      var singles = shop.pair.keys.filter(function (k) { return Number(e.q[k] || 0) === 1; }).length;
      if (singles) X(shop.pair.label, shop.pair.fee, singles, "명");
      if (shop.pair.keys.some(function (k) { var n = Number(e.q[k] || 0); return n > 1 && n % 2; })) W("패키지 인원이 홀수입니다 — 혼자 쓰는 분이 있으면 싱글차지(" + won(shop.pair.fee.dep) + ")를 더해야 합니다(성인 2인 기준).", false);
    }
    /* 나이(빅보스: 만 10세 미만 불가, 만 10~15세 주니어 추가) */
    if (shop.ageRule) {
      var ar = shop.ageRule, ag = agesList(e);
      if (ag.some(function (a) { return a < ar.min; })) W(ar.minMsg, true);
      var jn = ag.filter(function (a) { return a >= ar.junior[0] && a <= ar.junior[1]; }).length;
      if (jn > Number(e.q[ar.juniorKey] || 0)) W("만 " + ar.junior[0] + "~" + ar.junior[1] + "세가 " + jn + "명 있습니다 — '주니어 추가'를 넣어 주세요.", true);
    }
    /* 날짜: 휴무 요일, 골프 주말·공휴일 요금 */
    var di = dayOf(e.date);
    if (di && shop.closedDays && shop.closedDays.indexOf(di.dow) >= 0) W(shop.closedMsg || "휴무일입니다.", true);
    if (di && shop.weekendRate) {
      var has = function (k) { return shop.items.some(function (it) { return it.key === k; }); };
      var wd = r.lines.filter(function (l) { return /wd$/.test(l.it.key) && has(l.it.key.replace(/wd$/, "we")); });
      var we = r.lines.filter(function (l) { return /we$/.test(l.it.key); });
      if (di.weekend && wd.length) { W(mdKo(e.date) + "(" + (di.hol || "주말") + ")은 주말 요금입니다 — 주중 상품을 주말 상품으로 바꿔 주세요.", true); r.weekFix = "we"; }
      if (!di.weekend && we.length) { W(mdKo(e.date) + "은 주중(평일)입니다 — 주말 상품을 주중 상품으로 바꿔 주세요.", true); r.weekFix = "wd"; }
      if (di.unknownHol && r.lines.length) W(mdKo(e.date) + "이 필리핀 공휴일인지 확인해 주세요(" + (S.holidaysUntil || "") + " 이후 공휴일 목록은 아직 안 넣었습니다). 공휴일이면 주말 요금입니다.", false);
    }
    /* 상품별 인원 범위(골프 2~3인·4~7인) */
    r.lines.forEach(function (l) { if (l.it.pax && (l.n < l.it.pax[0] || l.n > l.it.pax[1])) W("'" + l.it.label + "'은(는) " + l.it.pax[0] + "~" + l.it.pax[1] + "명 요금입니다(지금 " + l.n + "명) — 인원에 맞는 상품인지 확인해 주세요.", false); });
    /* 시간: 할인 시간대(씨엘로), 고른 시간과 상품 칸(블루웨이브), 조인/단독(로컬페이지), 예약일 기준 이벤트(위오션) */
    if (shop.discountWindow) {
      var tm = hm(e.start || e.time);
      if (tm == null) W("씨엘로 할인가는 " + shop.discountWindow.join("~") + " 예약만 됩니다 — 픽업 시간을 넣어 확인하세요.", false);
      else if (tm < hm(shop.discountWindow[0]) || tm > hm(shop.discountWindow[1])) W(shop.discountMsg, true);
    }
    if (shop.timeItems && e.time) shop.timeItems.forEach(function (ti) { if (e.time.indexOf(ti[0]) >= 0 && r.lines.some(function (l) { return !new RegExp(ti[1]).test(l.it.key); })) W("'" + ti[0] + "'을(를) 골랐는데 다른 시간대 요금 칸에 인원이 있습니다 — 상품 칸을 확인해 주세요.", true); });
    if (shop.timeNotes && e.time) Object.keys(shop.timeNotes).forEach(function (k) { if (e.time.indexOf(k) >= 0) N(shop.timeNotes[k]); });
    if (shop.timeWarn && e.time && shop.timeWarn[e.time]) W(shop.timeWarn[e.time], true);
    if (shop.bookUntil && today() <= shop.bookUntil[0]) W(shop.bookUntil[1], false);
    /* 픽업·드랍 */
    var legs = [["픽업", e.pickup], ["드랍", e.drop]].filter(function (x) { return String(x[1] || "").trim(); });
    if (shop.pickupFee) { // 암스테르담: 팀당 편도 추가금을 계산해 현장결제에 넣는다(견적마다 반드시 — 원장 261114-13)
      var pf = shop.pickupFee, sum = 0, parts = [], unk = !legs.length;
      legs.forEach(function (lg) { var row = pf.legs.filter(function (z) { return reHit(z[1], lg[1]); })[0]; if (!row) { unk = true; return; } if (row[0]) { sum += row[0]; parts.push(lg[0] + " " + String(lg[1]).trim() + " " + num(row[0])); } });
      if (sum) X("픽업·드랍 추가금(팀당 · " + parts.join(" + ") + "페소)", { on: sum }, 1, "팀");
      if (unk) N(pf.unknown);
    }
    if (shop.zones) shop.zones.forEach(function (z) { if (legs.some(function (lg) { return reHit(z[0], lg[1]); })) N(z[1]); });
    if (shop.meet) N(shop.meet);
    /* 픽드랍 요금 안내(감사 PB-C-21): 에이스크랩은 한 번만 무료, 비원은 라움과 함께면 무료·4인 이상 1회 무료 */
    if (shop.legNote && legs.length) N(shop.legNote);
    if (shop.legRule && legs.length) { var lr = shop.legRule; N(state.cart.some(function (x) { return x.shopId === lr.freeWith; }) ? lr.freeWithMsg : r.pax >= lr.groupMin ? lr.groupMsg : lr.smallMsg); }
    /* 단체 혜택(어메이징쇼 성인 6인 이상 2시간 렌트카 무료 — 원장 261121-19, 감사 PB-C-18) */
    if (shop.groupPerk && (e.q[shop.groupPerk.key] || 0) >= shop.groupPerk.min) N(shop.groupPerk.text);
    var pk = shop.pick;
    if (pk) { // 마사지: 무료 픽업 조건·차량비·불가 지역·공항 드랍(감사 PB-B-02·08)
      var mins = r.lines.map(function (l) { var m = /(\d+)분/.exec(l.it.label); return m ? +m[1] : null; }).filter(function (x) { return x != null; });
      var mm = mins.length ? Math.min.apply(null, mins) : null, bk = mm == null ? null : mm < 90 ? 60 : 90;
      var dropAir = isAirport(e.drop) && !!(pk.airport || pk.airportFree || pk.airportNote);
      var plain = legs.filter(function (lg) { return !(lg[0] === "드랍" && dropAir); }), told = false;
      if (pk.no && legs.some(function (lg) { return reHit(pk.no, lg[1]); })) W(pk.noMsg, true);
      if (pk.noAirportPickup && isAirport(e.pickup)) W(shop.name + "은(는) 공항 픽업이 안 됩니다.", true);
      if (pk.zones) pk.zones.forEach(function (z) { if (plain.some(function (lg) { return reHit(z[0], lg[1]); })) { N(z[1]); told = true; } });
      if (pk.freeAt) pk.freeAt.forEach(function (z) { if (r.pax < z[1] && plain.some(function (lg) { return reHit(z[0], lg[1]); })) { N(z[2]); told = true; } });
      if (plain.length && bk) {
        if (pk.free) { if (r.pax < pk.free[bk]) N("픽업·드랍 차량비가 따로 있습니다(무료 픽업은 " + pk.freeText + "): " + (pk.fee || "금액은 예약 때 안내해 드립니다") + "."); }
        else if (r.pax === 1 && !told) N("1인 픽업·드랍은 차량비가 따로 있습니다 — 금액은 예약 때 안내해 드립니다.");
      }
      if (dropAir && bk) {
        if (pk.airport && r.pax < pk.airport[bk]) W("출국일 공항 드랍은 " + pk.airportText + "부터 됩니다(지금 " + r.pax + "명 · " + mm + "분) — 드랍 장소나 코스를 확인해 주세요.", true);
        if (pk.airportFree && r.pax < pk.airportFree[bk]) N(pk.airportFeeText);
      }
      if (dropAir && pk.airportNote) N(pk.airportNote);
    }
  }
  function hardWarns(onlyShop) { return Calc.cart().rows.filter(function (r) { return !onlyShop || r.shop === onlyShop; }).reduce(function (a, r) { return a.concat((r.warns || []).filter(function (w) { return w.hard; }).map(function (w) { return r.shop.name + ": " + w.t; })); }, []); }

  /* ---------- 손님용·업체용 문안 ---------- */
  var Text = {
    intro: function (shop) { return "[" + shop.name + "]\n" + shop.tagline + (shop.special ? "\n★ " + B + " 스페셜 혜택: " + shop.special : "") + (shop.post ? "\n▶ " + (shop.postLabel || "상세 안내") + ": " + shop.post : ""); },
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
      t += "대표자 성함: " + state.cust.name + "\n" + (state.cart.some(function (e) { return showContact(shopById(e.shopId)); }) ? "카카오톡 ID 또는 연락처: " + state.cust.contact + "\n" : "") + "어디서 보고 오셨나요?(투윙스 카페·블로그·세부백배즐기기·에어비앤비 등): \n";
      state.cart.forEach(function (e) {
        var shop = shopById(e.shopId), mas = shop.cat === "마사지", pt = pickupTimeShop(shop);
        t += "\n■ " + shop.name + "\n이용 날짜: " + dateKo(e.date) + "\n";
        if (mas) {
          if (shop.needStart) t += "마사지 시작 희망 시간: " + e.start + "\n";
          t += "인원과 코스(예: 아로마 90분 2명): " + Text.courses(e) + "\n";
          if (kidIn(shop, e)) t += "아동 만 나이: " + e.ages + "\n";
          if (shop.optionLabel) t += shop.optionLabel + ": " + e.option + "\n";
          if (shop.sitter) t += "보모 추가(필요하실 때만 — " + shop.sitter.map(function (x) { return x[0] + "분 " + num(x[1]) + "페소"; }).join(" / ") + "): " + (sitterOf(shop, e) ? sitterStr(sitterOf(shop, e)).replace("보모 ", "") : "") + "\n";
        } else {
          if (shop.timeOptions) t += "선택(" + shop.timeOptions.join(" / ") + "): " + e.time + "\n";
          if (shop.optionLabel) t += shop.optionLabel + ": " + e.option + "\n";
          // 상품이 많은 업체(골프 18·모뉴멘트 8)는 고른 상품만, 아직 안 골랐으면 빈칸 한 줄(감사 PB-C-14)
          var many = shop.items.length > 6, picked = shop.items.filter(function (it) { return e.q[it.key] > 0; });
          t += (many ? "상품·인원: " + picked.map(function (it) { return lab(it, e) + " " + e.q[it.key] + unitOf(it); }).join(" / ") : "인원: " + shop.items.map(function (it) { return lab(it, e) + " " + (e.q[it.key] || "") + unitOf(it); }).join(" / ")) + "\n";
          if (shop.paxText) t += shop.paxText + ": " + (e.paxText || "") + "\n";
          if (!shop.noAges) t += "아동 만 나이: " + e.ages + "\n";
        }
        t += (shop.noPickup ? "" : "픽업 장소: " + e.pickup + "\n" + (pt ? "픽업 희망 시간: " + e.time + "\n" : "") + "드랍 장소: " + e.drop + "\n") + "요청 사항: " + e.note + "\n";
        if (shop.form === "clubcebu" || shop.form === "lokal") t += "예약자 전원 영문 이름·생년월일" + (shop.form === "clubcebu" ? "·성별" : "") + ": " + e.roster + "\n";
        if (shop.askNote) t += "\n" + shop.askNote + "\n";
      });
      return t.trim();
    },
    courses: function (e) { var shop = shopById(e.shopId); return shop.items.filter(function (it) { return e.q[it.key] > 0; }).map(function (it) { return lab(it, e) + " " + e.q[it.key] + unitOf(it); }).join(", "); },
    quote: function () {
      var c = Calc.cart(), t = "안녕하세요, " + B + "입니다. 요청하신 내용으로 견적을 안내해 드립니다.\n";
      c.rows.forEach(function (r, i) {
        var e = state.cart[i], pt = pickupTimeShop(r.shop);
        var hd = [pt && e.time ? "픽업 " + e.time : "", e.start ? "마사지 시작 " + e.start : ""].filter(Boolean); // 오션스파 시작 시간도 머리줄에(감사 PB-B-15)
        t += "\n■ " + r.shop.name + (e.date ? " — " + dateKo(e.date) : "") + (!pt && e.time ? " " + e.time : "") + (hd.length ? " (" + hd.join(" · ") + ")" : "") + "\n";
        r.lines.forEach(function (l) { t += "· " + lab(l.it, e) + " " + l.n + unitOf(l.it) + (l.it.sp ? " × (" + priceStr(l.it.sp) + ")" : "") + "\n" + (l.it.note ? "  └ " + l.it.note + "\n" : ""); });
        if (r.sitter) t += "· " + sitterStr(r.sitter) + " × (" + priceStr({ on: r.sitter.amt }) + ")\n";
        (r.extra || []).forEach(function (x) { t += "· " + x.label + (x.unit === "팀" ? ": " + priceStr(x.p) : " " + x.n + x.unit + " × (" + priceStr(x.p) + ")") + "\n"; });
        var nt = (r.notes || []).map(function (x) { return "  ※ " + x + "\n"; }).join("");
        if (r.shop.payback) nt += "  ※ " + r.shop.payback + "\n"; // 세친구 페이백(원장 261116-59, 감사 PB-C-12)
        if (r.noPrice) { t += "→ " + (r.shop.quoteNote || "요금은 업체에서 상품·인원에 맞춰 직접 안내해 드립니다.") + "\n" + nt; return; }
        if (r.shop.allPrepay) t += "→ 예약 시 전액 결제: " + won(r.payNow) + " (" + peso(r.sp.on) + " 원화 환산, 1페소 = " + state.rate + "원 기준)\n  ※ 환율에 따라 달라질 수 있어, 입금하실 때 정확한 금액을 다시 확인해 드립니다.\n";
        else if (r.shop.prepayOnsite) t += "→ 예약 시 결제: " + won(r.payNow) + " (예약금 " + won(r.sp.dep) + " + 현장결제분 " + peso(r.sp.on) + " 원화 환산 " + won(r.prepayKrw) + ", 1페소 = " + state.rate + "원 기준)\n  ※ 환율에 따라 달라질 수 있어, 입금하실 때 정확한 금액을 다시 확인해 드립니다.\n";
        else t += "→ " + (r.sp.dep || r.sp.pre ? "예약 시 결제 " + nowStr(r.sp) : "예약금 없음") + (onsiteStr(r.sp) ? " / 현장결제 " + onsiteStr(r.sp) : "") + "\n";
        if (r.offKnown && r.lines.length && krwOf(r.off) > krwOf(r.sp)) t += "  (참고: 업체 공식 요금은 " + priceStr(r.off) + "입니다.)\n"; // 공식이 더 싸 보이면 빼기(감사 PB-B-18)
        t += nt;
      });
      var noPay = !c.payNow && !c.pre; // 입금할 금액이 없는 견적(에이스크랩만 등) — 계좌 안내 대신 진행 의사만 받는다(원장 261124-34)
      t += "\n━━━━━━━━━━\n지금 입금하실 금액: " + (noPay ? "없음" : [c.payNow ? won(c.payNow) : "", c.pre ? usd(c.pre) : ""].filter(Boolean).join(" + ")) + "\n"; // 달러만이면 '0원 + 720달러' 대신 '720달러'
      if (c.pre) t += fxLine(c.pre).replace("→ 원화로 입금하실 경우", "→ 달러분(" + usd(c.pre) + ")을 원화로 입금하실 경우") + "\n" + (c.payNow ? "→ 원화 합계: " + won(c.payNow + fxKrw(c.pre)) + "\n" : "");
      if (c.on || c.usd) t += "현장에서 결제하실 금액: " + onsiteStr({ on: c.on, usd: c.usd }) + " (이용 당일 업체에 직접 결제)\n";
      t += "━━━━━━━━━━\n\n현재 기준 예약 가능합니다.\n";
      var vp = c.rows.filter(function (r) { return r.shop.vendorPays; }).map(function (r) { return r.shop.name; }); // 결제를 업체가 직접 받는 곳(세친구 — 감사 PB-C-12)
      if (noPay) t += vp.length ? "진행을 원하시면 말씀해 주세요. 업체에 예약을 전달해 드리고, " + vp.join("·") + " 결제는 업체에서 직접 안내해 드립니다.\n" : "진행을 원하시면 말씀해 주세요. 바로 예약을 확정해 드립니다.\n";
      else t += "예약을 진행하시려면 아래 계좌로 입금하신 뒤 입금자 성함을 알려 주세요. 입금이 확인되면 예약을 확정해 드립니다.\n\n[한화 입금] " + S.accounts.krw + "\n[페소 입금] " + S.accounts.php.join(" / ") + "\n";
      var refunds = c.rows.filter(function (r) { return r.shop.refund; }).map(function (r) { return "· " + r.shop.name + ": " + r.shop.refund; });
      if (refunds.length) t += "\n[취소·환불 규정]\n" + refunds.join("\n") + "\n";
      if (c.rows.some(function (r) { return !r.noPrice && r.lines.length; })) t += "\n※ " + D.priceDate + " 기준 요금입니다."; // 요금을 안 낸 견적(세친구·에이스크랩만)에는 기준일을 붙이지 않는다(감사 PB-C-19)
      return t.replace(/\n+$/, "");
    },
    after: function (shop, name, e) {
      var who = name || "고객";
      if (shop.afterBy) return reHit(shop.afterBy.match, e && e.option) ? shop.afterBy.yes : shop.afterBy.no; // 어메이징쇼: 솔타나 투숙이면 객실 테이블, 아니면 따로 안내(감사 PB-C-18)
      if (shop.afterText) return shop.afterText;
      if (shop.after === "customer_channel") return "★ " + shop.name + " 예약이 완료되었습니다.\n아래 " + (shop.channelName || shop.name) + " 카카오톡 채널로 연락하셔서 \"" + B + "를 통해 " + eul(shop.name) + " 예약한 " + who + "\"이라고 말씀해 주세요. " + (shop.noPickup ? "이용 시간과 준비물" : "픽업 시간과 준비물") + " 등 상세 내용을 업체에서 바로 안내해 드립니다.\n" + (shop.channel || "(업체 채널 주소 확인 필요)") + (shop.meet ? "\n" + shop.meet : "");
      if (shop.after === "vendor_contacts") return "★ " + shop.name + " 예약이 완료되었습니다.\n알려 주신 카카오톡 ID(연락처)로 " + shop.name + "에서 직접 연락드려 " + (shop.vendorPays ? "일정·결제와 " : "") + "픽업 시간과 상세 내용을 안내해 드립니다. 카카오톡 ID 검색 허용과 친구 추가 차단 해제를 꼭 확인해 주세요." + (shop.payback ? "\n" + shop.payback : "");
      if (shop.after === "owner_relays") return "★ " + shop.name + " 예약이 완료되었습니다.\n이용 하루 전에 업체의 상세 안내(" + (shop.relayWhat || "픽업 시간·준비물") + ")를 이 대화창으로 전달해 드리겠습니다.";
      return "★ " + shop.name + " 예약이 완료되었습니다.\n이용 하루 전 또는 당일 오전까지 픽업 차량 정보를 이 대화창으로 보내 드리겠습니다.";
    },
    done: function () {
      var c = Calc.cart(), paid = c.payNow > 0 || c.pre > 0; // 입금받지 않는 견적(세친구·에이스크랩만)은 '입금 확인' 대신 '접수'(감사 PB-C-12)
      var t = paid ? "입금 확인되었습니다. 감사합니다.\n\n" : "예약 요청이 잘 접수되었습니다. 감사합니다.\n\n";
      t += state.cart.map(function (e) { return Text.after(shopById(e.shopId), state.cust.name ? state.cust.name + "님" : "", e); }).join("\n\n");
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
        case "ages": return e.ages ? "만 " + e.ages : ""; // 아동 나이(헬멧·파라세일링·빅보스 주니어·마사지 아동 코스 — 감사 PB-A-12·B-20)
        case "flight": return shop.flightOpt ? e.option : ""; // 엘스파 웰컴·굿바이팩 항공편(PB-B-13)
        case "paxText": return e.paxText; // 공항 인원(PB-C-13)
        case "courses": return (shop.cat === "마사지" ? "총 " + r.pax + "명 → " : "") + Text.courses(e) + (r.sitter ? " / " + sitterStr(r.sitter) : "");
        case "onsite": return onsiteStr(r.net);
        case "pay": return pay;
        case "note": return [e.luggage ? "짐 보관: " + e.luggage : "", e.note].filter(Boolean).join(". ");
        case "pay+note": return pay + (pay ? extra : extra.replace(/^\. /, ""));
        case "showpay+note": return r.lines.map(function (l) { return lab(l.it, e) + " " + won(l.it.sp.dep) + "×" + l.n + "명"; }).join(" + ") + " = " + won(r.sp.dep) + extra;
      }
      if (key.indexOf("q:") === 0) { var k = key.slice(2).replace("+ages", ""), n = e.q[k] || 0; return n ? n + "명" + (key.indexOf("+ages") > 0 && e.ages ? " (만 " + e.ages + ")" : "") : "0명"; }
      return "";
    },
    vendor: function (e) {
      var shop = shopById(e.shopId), f = D.forms[shop.form], r = Calc.entry(e);
      var sc = showContact(shop);
      return f.title.replace("{shop}", shop.name) + "\n" + f.lines.filter(function (l) { return (sc || (l[1] !== "contact" && l[1] !== "phone")) && !(shop.noPickup && /^(pickup|drop)/.test(l[1])) && !((l[1] === "ages" || l[1] === "flight") && !Text.vendorValue(l[1], e, r)); }).map(function (l) { return l[0].replace(sc ? "" : " & 연락처", "") + ": " + Text.vendorValue(l[1], e, r); }).join("\n");
    }
  };

  /* ---------- 숙소 계산·문안 ---------- */
  function addDays(iso, n) { var p = iso.split("-"), d = new Date(+p[0], +p[1] - 1, +p[2] + n); return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
  function mdKo(iso) { var p = iso.split("-"); return (+p[1]) + "월 " + (+p[2]) + "일"; }
  // 침실 수(마크업 배수): 2·3·4베드룸·커넥팅·어드조이닝은 침실 수만큼, 이름으로 모르면 1(원장 261009-25·261010-31·261029-140)
  // 이름에 안 드러나는 예외: 제이파크 세부 스위트(침실 2개, 261111-41·261124-23), 큐브9 투베드 스위트·풀빌라 3종(+20달러 고정, 261010-16)
  function bedsOf(h, type) {
    var u = String(type || "").toUpperCase(), n = String(h && h.name || "").toUpperCase();
    if (h && h.bedsFix && h.bedsFix[type] != null) return h.bedsFix[type];
    if (/ADJOINING|CONNECTING/.test(u)) return 2;
    if (/\b(FOUR|4)[ -]?(BEDROOM|BR)\b/.test(u)) return 4;
    if (/\b(THREE|3)[ -]?(BEDROOM|BR)\b/.test(u)) return 3;
    if (/\b(TWO|2)[ -]?(BEDROOM|BR)\b/.test(u)) return 2;
    if (/^JPARK ISLAND/.test(n) && /CEBU SUITE/.test(u)) return 2;
    if (/^CUBE ?9/.test(n) && /TWO BED SUITE|POOL VILLA/.test(u)) return 2;
    return 1;
  }
  // 특별요금(ST.specialRates — 제이파크 3박 특별요금 등, 감사 PB-D-20): 견적 날짜(td)가 판매기간 안, 투숙일(dt)이 투숙기간 안, minN 박 이상일 때 그 객실의 마크업 전 1박 요금
  function spRule(h) { var o = null; if (h) (ST.specialRates || []).forEach(function (x) { if (h.name.indexOf(x.match) === 0) o = x; }); return o; }
  function spRate(h, type, dt, nights, td) {
    var x = spRule(h); if (!x || x.rates[type] == null || nights < (x.minN || 1) || !(td >= x.sell[0] && td <= x.sell[1])) return null;
    if (dt && !(dt >= x.stay[0] && dt <= x.stay[1])) return null;
    return x.rates[type];
  }
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
        var d = s.def, base = 0, sur = 0, surN = 0, promoN = 0, nextN = 0, dynN = 0, spN = 0, surNames = [], pkN = d.pkgN || 1, minOk = !d.promoMinN || nights >= d.promoMinN, bd = h ? bedsOf(h, d.type) : 1, mg = margin * bd;
        for (var i = 0; i < nights; i++) {
          var dt = dates[i], promo = d.promo && minOk && promoSell && dt && h.stay && dt >= h.stay[0] && dt <= h.stay[1];
          var nx = !promo && h && h.next && dt && dt >= h.next[0] && dt <= h.next[1] && (d.next != null || d.nextDyn);
          var rv = promo ? d.promo : nx ? (d.next || 0) : (d.rate || 0), dy = !promo && (nx ? d.nextDyn : d.dyn), sp = h && dt && !d.pkgN ? spRate(h, d.type, dt, nights, td) : null;
          if (sp != null && (dy || sp < rv)) { rv = sp; spN++; promo = false; nx = false; dy = false; } // 특별요금이 그 날 요금보다 쌀 때만(써차지는 아래에서 그대로 붙음)
          if (dy) dynN++;
          base += rv / pkN + mg; if (promo) promoN++; if (nx) nextN++;
          if (h && dt) h.sur.forEach(function (x) { if (dt >= x.from && dt <= x.to && x.amt[d.type] && (!x.dow || x.dow.indexOf(new Date(dt + "T00:00:00Z").getUTCDay()) >= 0)) { sur += x.amt[d.type] / pkN; surN++; if (surNames.indexOf(x.name) < 0) surNames.push(x.name); } });
        }
        base = Math.round(base); sur = Math.round(sur);
        return { type: d.type, rooms: s.rooms, beds: bd, night1: Math.round((d.rate || 0) / pkN) + mg, base: base * s.rooms, sur: sur * s.rooms, surN: surN, surNames: surNames, promoN: promoN, nextN: nextN, dynN: dynN, spN: spN, pkgN: d.pkgN || 0, total: (base + sur) * s.rooms, profit: mg * nights * s.rooms };
      });
      var philco = { rows: [], hot: "", early: "" }, PC = window.PB_PHILCO && h ? window.PB_PHILCO.hotels[h.name] : null;
      if (PC && dates.length) {
        philco.hot = PC.hot || "";
        src.forEach(function (sx) {
          var d = sx.def, pr = PC.rooms[d.type]; if (pr == null) return;
          var tm = 0, pp = 0, tsur = 0, anySur = false;
          dates.forEach(function (dt) {
            var promo = d.promo && promoSell && h.stay && dt >= h.stay[0] && dt <= h.stay[1], tv = promo ? d.promo : d.rate, sp = spRate(h, d.type, dt, nights, td);
            tm += sp != null && sp < tv ? sp : tv; pp += pr;
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
      // 숙소 아동 연령 상한을 넘는 아이는 성인 요금(마리바고 만 12세 = 성인 261115-60, 솔레아 CHD 5-12Y) — 감사 PB-D-05
      function over(hi) { return agesKnown && hi != null ? ages.filter(function (a) { return a > hi; }).length : 0; }
      function overNote(hi) { var o = agesKnown && hi != null ? ages.filter(function (a) { return a > hi; }) : []; return o.length ? " ※ 만 " + o.join("·") + "세 아동은 성인 요금으로 계산했습니다" : ""; }
      if (h && dates.length) {
        h.gala.forEach(function (g) {
          var hit = g.to ? dates.filter(function (dt) { return dt >= g.date && dt <= g.to; })[0] : dates.filter(function (dt) { return dt.slice(5) === g.date.slice(5); })[0];
          if (!hit) return;
          var ga = [0, 17], gn = [];
          (ST.galaAge || []).forEach(function (x) { if (h.name.indexOf(x.match) >= 0) ga = [x.lo, x.hi]; });
          (ST.galaNotes || []).forEach(function (x) { if (h.name.indexOf(x.match) >= 0) gn.push(x.note); });
          var kc = cnt(ga[0], ga[1]), ov = over(ga[1]);
          extras.push({ name: "갈라 디너(" + (g.to ? mdKo(g.date) + "~" + mdKo(g.to) + " 지나는 숙박" : mdKo(hit)) + ", 의무)", adult: g.adult, child: g.child, total: (adults + ov) * g.adult + kc * g.child, note: gn.join(" / ") + (kids && ga[0] > 0 ? " ※ 아동 요금 대상: 만 " + ga[0] + "~" + ga[1] + "세" : "") + overNote(ga[1]) });
        });
      }
      if (h) (ST.mandatory || []).forEach(function (m) { if (h.name.indexOf(m.match) >= 0 && nights >= m.minNights) m.items.forEach(function (it) { var kc = it.ageLo != null ? cnt(it.ageLo, it.ageHi) : kids, ov = it.ageHi != null ? over(it.ageHi) : 0; extras.push({ name: it.name, adult: it.adult, child: it.child, total: ((adults + ov) * it.adult + kc * it.child) * (m.perNight ? nights : 1), note: m.note + (it.adult ? overNote(it.ageHi) : "") }); }); });
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
      var kidCap = h && h.cbfAge ? h.cbfAge[1] : null; if (h) (ST.galaAge || []).forEach(function (x) { if (h.name.indexOf(x.match) >= 0) kidCap = x.hi; });
      var ovK = over(kidCap);
      if (ovK) checks.push("만 " + ages.filter(function (a) { return a > kidCap; }).join("·") + "세 아동은 이 숙소에서 성인으로 봅니다(아동은 만 " + kidCap + "세까지) — 갈라·의무 식사는 성인 요금으로 넣었습니다. 객실 인원·엑스트라 베드(성인 추가)도 성인 기준으로 확인하세요.");
      if (h && !h.notRoom) {
        var roomCap = (r.picks || []).reduce(function (a, q) { return a + Math.max(1, +q.rooms || 1); }, 0) || 1, adE = adults + ovK;
        if (adE > 2 * roomCap && ebn < adE - 2 * roomCap) checks.push("성인 " + adults + "명" + (ovK ? "(+ 성인으로 보는 아동 " + ovK + "명)" : "") + " · " + roomCap + "객실인데 엑스트라 베드(추가 인원)를 " + ebn + "명으로 넣었습니다 — 객실당 성인 3번째부터 추가 인원 요금(엑스트라 베드 요금과 같음)이 붙습니다. '엑스트라 베드 사용 인원'을 확인하세요.");
      }
      var lock = []; // 복사를 막는 것(손님 글이 틀린 금액으로 나가는 경우) — 감사 PB-D-03·D-07
      if (!h && !src.length) lock.push((r.name ? "'" + r.name + "'은(는) " : "") + "요금표에서 고른 숙소도, 직접 넣은 객실 요금도 없습니다 — 위 목록에서 숙소를 고르거나(요금표에 없으면 '직접 입력') 객실 요금을 넣으세요.");
      if (margin < 0) lock.push("1박당 붙이는 금액이 " + margin + "입니다 — 0보다 작으면 넷가보다 싸게 나갑니다. 칸을 비우면 기본값(" + (ST.resortMargin[cur] || 0) + ")이 들어갑니다.");
      if (h && pk && !h.notRoom) {
        var pkcbf = pk.cbf; if (pkcbf == null) (ST.cbfDefault || []).forEach(function (x) { if (h.name.indexOf(x.match) >= 0) pkcbf = x.cbf; });
        if (h.cbfAge && kids && !extras.some(function (x) { return x.name.indexOf("아동 조식") >= 0; })) {
          if (pkcbf != null) {
            // 숙소별 아동 조식 예외(샹그릴라: 만 6세 이하는 1명만 포함·둘째부터 아동 조식, 2027-01-01~03-31 890페소 — TMJ 비고, 감사 PB-D-06)
            var cr = null; (ST.cbfRules || []).forEach(function (x) { if (h.name.indexOf(x.match) >= 0) cr = x; });
            var undN = cr && cr.under != null && agesKnown ? ages.filter(function (a) { return a <= cr.under; }).length : 0, extraU = cr ? Math.max(0, undN - (cr.freeN || 0)) : 0;
            var cc = cnt(h.cbfAge[0], h.cbfAge[1]) + extraU;
            var perN = (dates.length ? dates : Array.apply(null, Array(nights))).map(function (dt) { var v = pkcbf; if (dates.length) ((cr && cr.byDate) || []).forEach(function (b) { if (dt >= b[0] && dt <= b[1]) v = b[2]; }); return v; });
            var cbfSum = perN.reduce(function (a, v) { return a + v; }, 0), mixed = perN.some(function (v) { return v !== perN[0]; });
            if (pkcbf > 0 && cc) extras.push({ name: "아동 조식(만 " + h.cbfAge[0] + "~" + h.cbfAge[1] + "세" + (extraU ? " + 만 " + cr.under + "세 이하 둘째부터" : "") + ", 사전결제) " + cc + "명 × " + nights + "박", adult: 0, child: perN[0], total: cc * cbfSum, note: "아동 조식은 엑스트라 베드와 별도 요금" + (extraU ? ". 만 " + cr.under + "세 이하 아동은 " + cr.freeN + "명만 조식이 포함됩니다" : "") + (mixed ? ". 1박 아동 조식 요금이 날짜에 따라 다릅니다(" + perN.map(function (v) { return Stay.money(v, cur); }).join(" / ") + ")" : "") });
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
          else if (pk.eb > 0) extras.push({ name: (epOnly ? "추가 인원(침대 없음)" : ebKo((h.ebLabel || "엑스트라 베드").replace(/\s*\(.*$/, ""))) + " " + ebn + "명 × " + nights + "박", adult: Math.round(ebPN), child: 0, total: Math.round(ebn * ebPN * nights), note: ebNotes.join(". ") });
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
      var spr = spRule(h);
      if (spr && td >= spr.sell[0] && td <= spr.sell[1]) {
        if (lines.some(function (x) { return x.spN; })) infos.push(spr.name + "(" + spr.sell[1].slice(5).replace("-", "/") + "까지 예약, " + spr.stay[1] + " 투숙분까지, " + spr.minN + "박 이상)을 적용했습니다 — 써차지는 그대로 붙습니다. " + (spr.note || ""));
        else if (nights < spr.minN && src.some(function (s) { return spr.rates[s.def.type] != null; })) infos.push(spr.minN + "박 이상이면 " + spr.name + "이 적용됩니다(" + spr.sell[1].slice(5).replace("-", "/") + "까지 예약) — 지금 " + nights + "박이라 정상 요금으로 계산했습니다.");
      }
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
        // 대안 요금표는 같은 지역만(보홀 솔레아 코스트를 막탄 솔레아 대안으로 내지 않게, 감사 PB-D-21)
        if (hardWarn.length) H.hotels.forEach(function (o, oi) { if (o === h || o.region !== h.region || o.name.toUpperCase().indexOf(fam) !== 0) return; var ok = true, ms = (o.valid || "").match(/(\d{4}-\d{2}-\d{2})\s*~\s*(\d{4}-\d{2}-\d{2})/); if (o.stay) ok = !(first < o.stay[0] || last > o.stay[1]); else if (ms) ok = !(first < ms[1] || last > ms[2]); if (ok && (o.sur.length || o.gala.length)) alts.push(o.name); });
        if (alts.length) hardWarn.push("같은 숙소의 다른 요금표 중 이 날짜를 포함하고 서차지·갈라 자료가 있는 것: " + alts.join(" / "));
      }
      if (h) (h.remark || "").split(/\n/).forEach(function (ln) { if (/EXTRA|ADDITIONAL|CHILD|BREAKFAST|BFAST|B\/F|ADULT|SURCHARGE|CHARGE|MANDATORY|GALA/i.test(ln) && ln.trim().length > 6) remarkLines.push(ln.trim()); });
      var rr = state.stay.resort, sig = [rr.hotel, rr.checkin, rr.nights, rr.adults, rr.kids, rr.kidAges, rr.ebn, (rr.picks || []).map(function (q) { return q.type + "x" + q.rooms; }).join(",")].join("|"), needOk = !!(h && (checks.length || hardWarn.length || remarkLines.length || h.sur.length || h.gala.length || (dates.length && dates.some(function (dt) { var md = dt.slice(5); return md >= "12-20" || md <= "01-05"; })))); var peakAsk = dates.some(function (dt) { var mo = dt.slice(5, 7); return mo === "12" || mo === "01"; }) || (r.checkin && /-(12|01)-/.test(addDays(r.checkin, nights))) || lines.some(function (x) { return x.sur > 0; }); // 원장 261118-68: 12~1월 견적 전부 + 써차지 붙는 다른 달
      return { philco: philco, lock: lock, peakAsk: !!peakAsk, overKids: ovK, checks: checks, galaHit: extras.some(function (x) { return x.name.indexOf("갈라 디너") === 0; }), infos: infos, hardWarn: hardWarn, remarkLines: remarkLines, needOk: needOk, sig: sig, okDone: needOk && rr.okSig === sig, h: h, lines: lines, all: all, nights: nights, margin: margin, cur: cur, adults: adults, kids: kids, extras: extras, exTotal: exTotal, minWarn: minWarn, dated: !!dates.length,
        total: lines.reduce(function (a, x) { return a + x.total; }, 0) + exTotal, profit: lines.reduce(function (a, x) { return a + x.profit; }, 0) };
    },
    resortText: function () {
      var r = state.stay.resort, c = Stay.resort(), m = function (n) { return Stay.money(n, c.cur); };
      var hs = hotelShow(r.name); // TMJ 내부 이름 대신 한글 이름(영문)·'최소 N박'(감사 PB-D-15)
      var t = "안녕하세요, " + B + "입니다. 문의하신 숙소 요금을 안내해 드립니다.\n\n■ " + (hs.name || "(숙소명)") + "\n" + (r.checkin ? "체크인 " + dateKo(r.checkin) + " · " : "") + c.nights + "박" + (c.adults || c.kids ? " · 성인 " + c.adults + "명" + (c.kids ? " + 아동 " + c.kids + "명" : "") : "") + (hs.min > 1 ? " (최소 " + hs.min + "박부터 예약되는 숙소입니다)" : "") + "\n";
      var dynAny = c.lines.some(function (x) { return x.dynN; });
      c.lines.forEach(function (x) {
        if (x.dynN) { t += "· " + (x.type || "객실") + (x.rooms > 1 ? " " + x.rooms + "객실" : "") + ": " + c.nights + "박 요금은 확인 후 다시 안내해 드립니다\n"; return; }
        t += "· " + (x.type || "객실") + (x.rooms > 1 ? " " + x.rooms + "객실" : "") + ": " + c.nights + "박 " + m(x.total);
        var d = [];
        var wkN = x.surNames.filter(function (n) { return /WEEKEND/i.test(n); }).length;
        if (x.sur) d.push("객실 요금 " + m(x.base) + " + " + (wkN && wkN === x.surNames.length ? "주말(금·토 숙박) 추가 요금 " : wkN ? "성수기·주말 추가 요금 " : "성수기 추가 요금 ") + m(x.sur) + "(" + x.surN + "박 해당)");
        else if (c.nights > 1 || x.rooms > 1) d.push("1박 " + m(Math.round(x.base / c.nights / x.rooms)) + " 기준");
        if (x.promoN) d.push("프로모션 요금 적용");
        if (x.spN) d.push((spRule(c.h) || {}).name + " 적용" + (x.spN < c.nights ? "(" + x.spN + "박)" : ""));
        t += (d.length ? " (" + d.join(", ") + ")" : "") + "\n";
      });
      c.extras.forEach(function (x) { var ch = c.kids ? x.child : 0; if (!x.adult && !ch) return; t += "· " + x.name + ": " + (x.adult ? "성인 1인 " + m(x.adult) : "") + (ch ? (x.adult ? " / " : "") + "아동 1인 " + m(ch) : "") + (x.total ? " → " + m(x.total) : "") + (x.note ? " ※ " + x.note : "") + "\n"; });
      if (!c.all && c.lines.length && !dynAny) t += "\n→ 합계 " + m(c.total) + "\n" + (c.cur === "USD" ? fxLine(c.total) + "\n" : "");
      t += "\n※ 객실당 요금이며 " + (c.h && /ROOM ONLY/i.test(c.h.name) ? "조식은 포함되어 있지 않습니다(룸온리)" : "조식이 포함되어 있습니다") + ".\n" + (c.peakAsk ? "※ 성수기 기간이라 예약 확정 전에 리조트 금액(성수기 추가요금 포함)을 한 번 더 확인해 드립니다.\n" : "") + (c.dated ? "" : "※ 성수기·연휴에는 추가 요금이 붙을 수 있어, 날짜가 정해지면 정확한 금액을 다시 안내해 드립니다.\n") + "※ " + (c.h && H.date ? dateKoPlain(H.date) : D.priceDate) + " 기준 요금이며, 예약을 진행할 때 정확한 금액을 한 번 더 확인해 드립니다.\n\n" + ST.resortSteps; // 기준일 = TMJ 요금표 날짜(감사 PB-D-18)
      return t;
    },
    resortAsk: function () {
      var r = state.stay.resort, c = Stay.resort(), picked = r.picks.length || !c.h;
      return "안녕하세요, " + B + "입니다. 문의해 주셔서 감사합니다.\n정확한 요금과 예약 가능 여부를 확인해 드릴 수 있도록, 아래 빈칸을 채워서 보내 주시기 바랍니다.\n\n" +
        ["숙소: " + (r.name || ""), "체크인 날짜: " + dateKo(r.checkin), "체크아웃 날짜(또는 박수): " + (r.checkin ? dateKo(addDays(r.checkin, c.nights)) + " (" + c.nights + "박)" : ""),
          "객실 타입: " + (picked ? c.lines.map(function (x) { return x.type; }).join(", ") : ""), "객실 수: " + (picked ? c.lines.map(function (x) { return x.rooms + "객실"; }).join(", ") : ""),
          "인원(성인 / 아동): " + (r.checkin || picked ? "성인 " + c.adults + "명" + (c.kids ? " / 아동 " + c.kids + "명" : "") : ""),
          "아동 나이(만 나이, 아동별로 · 없으면 '없음'): " + (r.kidAges ? r.kidAges.split(/[^0-9]+/).filter(Boolean).map(function (n) { return n + "세"; }).join(", ") : ""),
          "대표자 영문 성함(여권과 동일): ", "카카오톡 ID 또는 연락처: " + (state.stay.cust.contact || ""), "요청 사항(침대 타입·공항 픽업 등): ", "어디서 보고 오셨나요?(투윙스 카페·블로그·세부백배즐기기·에어비앤비 등): "].join("\n");
    },
    villaAsk: function () {
      var v = state.stay.villa, c = Stay.villa();
      return "안녕하세요, " + B + "입니다. 문의해 주셔서 감사합니다.\n예약 가능 여부를 확인해 드릴 수 있도록, 아래 빈칸을 채워서 보내 주시기 바랍니다.\n\n" +
        ["풀빌라: " + c.d.name + " (" + c.d.rooms + ")", "체크인 날짜: " + dateKo(v.checkin), "박수: " + c.nights + "박", "인원(성인 / 아동은 만 나이): ", "대표자 성함: " + (state.stay.cust.name || ""),
          "카카오톡 ID 또는 연락처: " + (state.stay.cust.contact || ""), "도착 항공편·도착 시간: ", "요청 사항(조식·바비큐·공항 픽업 등): ", "어디서 보고 오셨나요?(투윙스 카페·블로그·세부백배즐기기·에어비앤비 등): "].join("\n");
    },
    villa: function () {
      var v = state.stay.villa, d = ST.villas[+v.idx] || ST.villas[0], nights = Math.max(1, +v.nights || 1), blank = v.profit === "" || v.profit == null || isNaN(+v.profit), profit = blank ? (+ST.villaProfit || 0) : +v.profit;
      // 수익 칸을 비우면 기본값(넷가 그대로 나가지 않게), 0보다 작으면 복사 잠금, 20달러 미만이면 경고(감사 PB-D-07)
      var lock = profit < 0 ? ["1박 수익이 " + profit + "달러입니다 — 넷가보다 싸게 나갑니다. 수익을 0 이상으로 고치세요(기본 " + ST.villaProfit + "달러)."] : [], warn = !lock.length && profit < 20 ? ["1박 수익이 " + profit + "달러입니다(기본 " + ST.villaProfit + "달러·때로 40달러). 맞는지 확인하세요."] : [];
      return { d: d, nights: nights, blank: blank, lock: lock, warn: warn, direct: d.net + ST.villaDirectAdd, sell: d.net + profit, profit: profit * nights, total: (d.net + profit) * nights };
    },
    villaText: function () {
      var v = state.stay.villa, c = Stay.villa();
      return "안녕하세요, " + B + "입니다. 문의하신 풀빌라 요금을 안내해 드립니다.\n\n■ " + c.d.name + " (" + c.d.rooms + ")\n" + (v.checkin ? "체크인 " + dateKo(v.checkin) + " · " : "") + c.nights + "박\n" +
        "· 공식 요금(업체에 직접 예약하실 때): 1박 " + usd(c.direct) + "\n· " + B + " 스페셜: 1박 " + usd(c.sell) + (c.nights > 1 ? " × " + c.nights + "박 = " + usd(c.total) : "") + "\n" + fxLine(c.total) + "\n\n" +
        "※ 빌라 한 채 전체 요금입니다(조식 불포함).\n※ 예약금 규정은 풀빌라마다 달라 상담 때 안내해 드립니다. 예약금을 입금하시면 바로 예약이 확정되며, 확정 후에는 환불이 되지 않습니다.\n※ " + D.priceDate + " 기준 요금이며, 날짜와 인원에 따라 달라질 수 있어 예약을 진행할 때 한 번 더 확인해 드립니다.\n\n예약을 원하시면 날짜와 인원(성인·아동 만 나이)을 알려 주세요. 예약 가능 여부를 확인한 뒤 바로 안내해 드리겠습니다.";
    },
    sol: function () {
      var s = state.stay.sol, p = ST.soltana.filter(function (x) { return x.key === s.key; })[0] || ST.soltana[0], tier = ST.soltanaTiers.filter(function (x) { return x.key === s.tier; })[0] || ST.soltanaTiers[0], off = ST.soltanaTiers[0], A = ST.soltanaAdd;
      var rooms = Math.max(1, +s.rooms || 1), nights = p.room ? Math.min(ST.soltanaMaxNights, Math.max(1, +s.nights || 1)) : 0, aA = +s.addAdult || 0, aK = +s.addKid || 0, aB = +s.addBaby || 0, kB = +s.kidBed || 0, bfPax = nights ? (+s.bfPax || 0) : 0;
      var hasIn = p.pack === "in" || p.pack === "inout", hasOut = p.pack === "out" || p.pack === "inout";
      var one = function (t) { return (p.pack ? t.price[p.pack] : 0) + nights * t.price.room; };
      var ex = []; // 추가 요금 줄: [설명, 금액]
      if (aA && hasIn) ex.push(["입국팩 성인 추가 " + aA + "명 × " + usd(A.in.adult) + " (조식·엑스트라베드 포함)", aA * A.in.adult]);
      if (aK && hasIn) ex.push(["입국팩 아동 추가(만 7~11세) " + aK + "명 × " + usd(A.in.kid) + " (조식·엑스트라베드 포함)", aK * A.in.kid]);
      if (aA && nights) ex.push(["룸온리 성인 추가 " + aA + "명 × " + usd(A.room.adult) + " × " + nights + "박 (엑스트라베드 포함, 조식 불포함)", aA * A.room.adult * nights]);
      if (bfPax) ex.push(["룸온리 조식 추가 " + bfPax + "명 × " + usd(A.room.breakfast) + " × " + nights + "박", bfPax * A.room.breakfast * nights]);
      if (aA && hasOut) ex.push(["출국팩 성인 추가 " + aA + "명 × " + usd(A.out.adult) + " (엑스트라베드 포함)", aA * A.out.adult]);
      if (kB && hasIn) ex.push(["입국팩 아이 엑스트라베드 요청(만 6세 이하) " + kB + "개 × " + usd(A.in.kidBed), kB * A.in.kidBed]);
      if (kB && hasOut) ex.push(["출국팩 아이 엑스트라베드 요청 " + kB + "개 × " + usd(A.out.kidBed), kB * A.out.kidBed]);
      var extra = ex.reduce(function (a, x) { return a + x[1]; }, 0), total = +s.totalPax || 0, warn = [];
      if (total > rooms * ST.soltanaMaxPax) warn.push("객실당 최대 " + ST.soltanaMaxPax + "명까지입니다. 총 " + total + "명이면 객실이 " + Math.ceil(total / ST.soltanaMaxPax) + "개 이상 필요합니다.");
      else if (total > rooms * ST.soltanaStdPax) warn.push("객실 기준 인원은 최대 " + ST.soltanaStdPax + "명입니다. " + ST.soltanaMaxPax + "명은 손님이 좁아도 괜찮다고 할 때만 받습니다.");
      var lock = []; // 엑베 수는 절대 객실 수보다 많을 수 없다(원장 261110-36) — 성인 추가가 있을 때도 검사(감사 PB-D-12)
      if ((kB || aA) && aA + (hasIn ? aK : 0) + kB > rooms) lock.push("엑스트라베드는 객실당 1개까지입니다. 지금 성인 추가 " + aA + (hasIn && aK ? " + 아동 추가 " + aK : "") + (kB ? " + 아이 엑스트라베드 " + kB : "") + " = " + (aA + (hasIn ? aK : 0) + kB) + "개라 객실 수(" + rooms + "개)를 넘습니다 — 객실을 늘리거나 인원 구성을 바꿔 주세요.");
      if (kB && !hasIn && !hasOut) warn.push("아이 엑스트라베드 10달러는 입국팩·출국팩에만 있습니다(룸온리만이면 고르지 않습니다).");
      var parts = []; if (p.pack) parts.push(ST.soltana.filter(function (x) { return x.key === p.pack; })[0].name + " " + usd(tier.price[p.pack])); if (nights) parts.push("룸온리 " + nights + "박 × " + usd(tier.price.room));
      var c = { p: p, tier: tier, price: one(tier), official: one(off), parts: parts.join(" + "), rooms: rooms, nights: nights, hasIn: hasIn, hasOut: hasOut, aA: aA, aK: aK, aB: aB, kB: kB, bfPax: bfPax, ex: ex, extra: extra,
        beds: Math.min(rooms, aA + (hasIn ? aK : 0) + ((hasIn || hasOut) ? kB : 0)), freeKid: (aK && (nights || hasOut)) || aB, room: one(tier) * rooms, warn: warn, lock: lock, rate: +state.fx || S.usdRate };
      c.total = c.room + extra; c.krw = fxKrw(c.total);
      return c;
    },
    solNote: function () { var s = state.stay.sol, c = Stay.sol(); return [ST.soltanaNote, c.beds ? "퀸사이즈 엑스트라베드 " + c.beds + "개 포함" : "", s.note].filter(Boolean).join(". "); },
    solAsk: function () {
      var s = state.stay.sol, c = Stay.sol(), L = [[c.hasIn ? "☝투숙타입&한국 출발 날짜(입국팩은 세부 도착일이 아니라 한국에서 출발하는 날)" : "☝투숙타입&체크인날짜", c.p.name + (s.checkin ? " / " + dateKo(s.checkin) : "")], ["☝이용항공편명", s.flight], ["☝각방당 인원구성(아동은 만 나이)", s.pax], ["☝대표자 영문성함", s.ename]];
      c.p.times.forEach(function (label, i) { L.push(["☝" + label, i ? s.t2 : s.t1]); });
      L.push(["☝어디서 보고 오셨나요?(투윙스 카페·블로그·세부백배즐기기·에어비앤비 등)", ""]);
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
      if (tab === "resort") { var c = Stay.resort(), r = st.resort, dyn = c.lines.some(function (x) { return x.dynN; }), noP = c.all || dyn; o = { label: (r.name || "숙소") + " " + c.nights + "박", date: r.checkin, nights: c.nights, payText: c.all ? "객실 미정" : dyn ? "요금 확인 중" : Stay.money(c.total, c.cur), profitPhp: noP || c.cur !== "PHP" ? 0 : c.profit, profitUsd: noP || c.cur !== "USD" ? 0 : c.profit }; } // 다이나믹 요금은 장부에 '요금 확인 중'·수익 0(감사 PB-D-11)
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
  var HOTEL_ALIAS = [["샹그릴라", "SHANGRILA MACTAN"], ["제이파크", "JPARK ISLAND RESORT (MIN. 2N)"], ["jpark", "JPARK ISLAND RESORT (MIN. 2N)"], ["솔레아", "SOLEA MACTAN"], ["뫼벤픽", "MOVENPICK HOTEL"], ["모벤픽", "MOVENPICK HOTEL"], ["마리바고", "MARIBAGO BLUEWATER"], ["더리프", "THE REEF"], ["크림슨", "CRIMSON RESORT & SPA"], ["바이호텔", "BAI HOTEL"],
    ["두짓", "DUSIT THANI (MIN.2N)"], ["쉐라톤", "SHERATON MACTAN"], ["누스타", "NUSTAR HOTEL"], ["래디슨레드", "RADISSON RED"], ["래디슨", "RADISSON BLU"], ["플랜테이션", "PLANTATION BAY(MIN. 2N)"], ["코스타벨라", "COSTABELLA"], ["화이트샌드", "CEBU WHITE SANDS"], ["머큐어", "MERCURE"], ["큐브9", "CUBE 9"], ["큐브나인", "CUBE 9"], ["아테라", "ARTERRA"], ["비마막탄", "BE MACTAN"], ["워터프론트막탄", "WATERFRONT MACTAN"], ["애플톤", "APPLETON"], ["소토그란데", "SOTO GRANDE"], ["비스타마", "VISTAMAR"], ["탐불리", "TAMBULI RESORT"], ["골드베리막탄", "GOLDBERRY MACTAN"]]; // 별명 추가(감사 PB-D-03)
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
    if (o.ename && !st.sol.ename) st.sol.ename = o.ename;
    if (!o.name && o.ename) o.name = o.ename; // 예약폼엔 '대표자 영문 성함'만 있으니 손님 이름 칸에도(감사 PB-D-25)
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
      else { r.hotel = ""; r.hotelName = ""; r.picks = []; r.rows = []; r.name = o.hotel; st.tab = "resort"; notes.push("숙소 '" + o.hotel + "'를 요금표에서 못 찾아 숙소 선택을 비웠습니다 — 숙소를 직접 골라 주세요(고르기 전에는 견적 복사가 막힙니다)"); } // 전에 고른 숙소 요금이 남아 다른 숙소 이름으로 나가지 않게(감사 PB-D-03)
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
    syncCust();
    return { stay: sr.n, shops: shopHits, added: added, notes: sr.notes.concat(notes) };
  }
  /* AI 결과를 견적 칸에 넣는다(통합·견적 화면이 같이 쓴다). 서버 AI 함수(pb-parse)에는 공항 '인원' 칸이 없어서(P5 에서 새로 생김),
     AI 가 메모에 적은 '성인 2명 아이 1명'이나 같은 글의 숙소 인원으로 채운다 — 비면 P5 경고가 그대로 뜬다(감사 P7) */
  function paxFrom(t) { return (String(t || "").match(/(성인|어른|대인|아동|아이|소아|유아)\s*\d+\s*명?/g) || []).map(function (s) { return /명$/.test(s) ? s : s + "명"; }).join(" "); }
  function applyShopsParsed(r, stayRes) {
    var n = 0;
    (r.entries || []).forEach(function (x) {
      var e = state.cart.filter(function (c) { return c.shopId === x.shopId; })[0]; if (!e) return; var shop = shopById(e.shopId);
      ["date", "time", "start", "ages", "pickup", "drop", "luggage", "option", "roster", "note", "sitter", "sitterN", "paxText"].forEach(function (k) { if (x[k] && (k !== "date" || /^\d{4}-\d{2}-\d{2}$/.test(x[k]))) { e[k] = x[k]; n++; } });
      (x.items || []).forEach(function (it) { if (it.qty > 0 && shop.items.some(function (s2) { return s2.key === it.key; })) { e.q[it.key] = it.qty; n++; } });
      if (shop.paxText && !e.paxText) {
        var px = paxFrom(x.note) || (stayRes && +stayRes.adults ? "성인 " + stayRes.adults + "명" + (+stayRes.kids ? " 아동 " + stayRes.kids + "명" + (stayRes.kidAges ? "(만 " + stayRes.kidAges + "세)" : "") : "") : "");
        if (px) { e.paxText = px; n++; }
      }
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
      var m = /^((?:[^:：(]|\([^)]*\))+)[:：]\s*(.*)$/.exec(line) || /^([^:：]+)[:：]\s*(.*)$/.exec(line); // 칸 이름 괄호 안의 콜론('메뉴(예: 세트A …)')은 건너뛴다
      if (!m) { if (line.trim()) (cur ? [cur] : state.cart).forEach(function (e) { var sh = shopById(e.shopId); if (sh.items.length > 5 || sh.cat === "마사지") hits += parseMenu(sh, e, line); }); return; }
      var k = m[1], v = m[2].trim(); if (!v) return;
      var targets = cur ? [cur] : state.cart;
      if (/성함|대표자|예약자(?! 전원)/.test(k) && !/영문/.test(k)) { state.cust.name = v; hits++; return; }
      if (/카카오|카톡|연락처|전화|휴대폰/.test(k)) { state.cust.contact = v; hits++; return; }
      targets.forEach(function (e) {
        var shop = shopById(e.shopId);
        if (/보모|시터/.test(k)) { if (!shop.sitter) return; var sm = /(\d{2,3})\s*분/.exec(v), sn = /(\d+)\s*명/.exec(v), so = sm ? sitterOpts(shop).filter(function (o) { return parseInt(o, 10) === +sm[1]; })[0] : null; if (so) { e.sitter = so; e.sitterN = (sn ? Math.min(3, Math.max(1, +sn[1])) : 1) + "명"; hits++; } }
        else if (/날짜|일정/.test(k)) { var d = parseDate(v); if (d) { e.date = d; hits++; } }
        else if (/나이/.test(k)) { e.ages = v; hits++; }
        else if (/영문/.test(k)) { e.roster = v; hits++; }
        else if (/인원|코스|메뉴|마사지|상품|골프장|차량/.test(k) && (shop.items.length > 5 || shop.cat === "마사지")) { hits += parseMenu(shop, e, v); }
        else if (/인원/.test(k)) {
          shop.items.forEach(function (it) {
            var word = it.key === "adult" ? "성인|입장권|어른" : it.key === "child" ? "아동|소인|아이|어린이" : it.key === "infant" ? "영아|유아" : it.label.replace(/\(.*\)/, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            var mm = new RegExp("(?:" + word + ")[^\\d/+,]*?(\\d+)").exec(v.replace(/\([^)]*\)/g, "")); if (mm) { e.q[it.key] = +mm[1]; hits++; }
          });
          var ag = /만\s*([\d,\s·세]+)/.exec(v); if (ag && !e.ages) e.ages = ag[1].replace(/세/g, "").trim();
          if (shop.paxText && /\d/.test(v) && !/대/.test(v)) { e.paxText = v; hits++; } // 공항: "인원: 성인 3명" — 차량 대수가 아니라 사람 수(감사 PB-C-13)
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
    save(); render();
  }
  function minPrice(shop) { var it = shop.items.filter(function (x) { return x.sp; })[0]; return it ? priceStr(it.sp).replace("예약금 ", "").replace(/현장결제 /g, "") + "~" : "상담 안내"; }
  function chips(list, cur, attr) { return '<div class="chips">' + list.map(function (c) { return '<button class="chip' + (c === cur ? " on" : "") + '" data-' + attr + '="' + esc(c) + '">' + esc(c) + "</button>"; }).join("") + "</div>"; }

  function viewHome() {
    var q = state.q.trim().toLowerCase();
    // 상품 이름으로도 찾는다(임산부·키즈·포핸즈·핫스톤 — 감사 PB-B-17, P9). 띄어쓰기는 무시
    var qn = q.replace(/\s+/g, "");
    var shops = D.shops.filter(function (s) { return (state.cat === "전체" || s.cat === state.cat) && (!q || (s.name + s.cat + s.tagline + " " + s.items.map(function (it) { return it.label; }).join(" ")).toLowerCase().replace(/\s+/g, "").indexOf(qn) >= 0); })
      .sort(function (a, b) { return a.name.localeCompare(b.name, "ko"); });
    return '<input class="search" id="q" placeholder="업체명·상품 검색 (예: 호핑, 라움)" value="' + esc(state.q) + '">' + chips(["전체"].concat(D.categories), state.cat, "cat") +
      '<p class="note" style="margin:6px 2px 0">업체 ' + shops.length + "곳 · [담기]를 누르면 견적에 들어갑니다(한 번에 3곳까지).</p>" +
      '<div class="list">' + (shops.length ? shops.map(function (s) {
        return '<div class="row"><button class="shop grow" data-shop="' + s.id + '"><div class="grow" style="min-width:0"><div class="cat">' + s.cat + '</div><div class="nm">' + esc(s.name) + '</div><div class="tg">' + esc(s.tagline) + '</div></div><div class="pr">' + esc(minPrice(s)) + "</div></button>" +
          '<button class="btn sm ' + (inCart(s.id) ? "gold" : "ghost") + '" data-cart="' + s.id + '">' + (inCart(s.id) ? "담김 ✓" : "담기") + "</button></div>";
      }).join("") : '<div class="empty">검색 결과가 없습니다.</div>') + "</div>";
  }
  var LASTGEN = {}; // 마지막으로 화면에 그린 자동 글(손으로 고치기 시작한 때의 글을 기억하는 데 쓴다)
  function outStale(id) { return state.edited[id] != null && state.editedBase[id] != null && LASTGEN[id] != null && state.editedBase[id] !== LASTGEN[id]; }
  function outBox(id, title, text) {
    LASTGEN[id] = text;
    var ed = state.edited[id] != null, v = ed ? state.edited[id] : text;
    return '<div class="out" data-key="out_' + id + '"><div class="hd"><b>' + title + (ed ? ' <span class="badge">손으로 고침</span>' : "") + '</b><span><button class="btn sm ghost" data-reset="' + id + '">원래대로</button> <button class="btn sm gold" data-copy="' + id + '">복사</button></span></div>' +
      (outStale(id) ? '<p class="warn" data-key="stale_' + id + '">⚠ 손으로 고친 뒤에 금액·인원·날짜 등 계산이 바뀌었습니다. 고친 글은 그대로 두었습니다 — 새 계산으로 다시 만들려면 [원래대로]를 누르세요.</p>' : "") +
      '<textarea data-key="ta_' + id + '" data-out="' + id + '" rows="' + Math.min(18, Math.max(4, v.split("\n").length + 1)) + '">' + esc(v) + "</textarea></div>";
  }
  function viewShop() {
    var s = shopById(state.shopId); if (!s) return viewHome();
    var nv = state.showNet && PRIV.ok, rows = s.items.map(function (it) {
      var cm = s.commission || 0, net = it.sp ? (cm ? it.sp : (it.net || { on: it.sp.on, usd: it.sp.usd })) : null, g = function (o, k) { return (o && o[k]) || 0; };
      var pk = !it.sp ? 0 : cm ? Math.round(g(it.sp, "dep") * cm) : g(it.sp, "dep") - g(net, "dep"), pp = !it.sp ? 0 : cm ? Math.round(g(it.sp, "on") * cm) : g(it.sp, "on") - g(net, "on"), pu = !it.sp ? 0 : cm ? Math.round(g(it.sp, "usd") * cm) : g(it.sp, "pre") + g(it.sp, "usd") - g(net, "pre") - g(net, "usd");
      return "<tr><td>" + esc(it.label) + '</td><td class="off">' + (it.off ? priceStr(it.off) : "-") + '</td><td class="sp">' + priceStr(it.sp) + "</td>" + (nv ? "<td>" + (s.noNet || !net ? "미입력" : cm ? "커미션 " + (cm * 100) + "%" : priceStr(net)) + "</td><td><b>" + (s.noNet || !net ? "-" : profitStr(pk, pp, pu)) + "</b></td>" : "") + "</tr>";
    }).join("");
    return '<button class="btn sm ghost" data-view="home">← 목록</button>' +
      '<div class="card" style="margin-top:10px"><div class="cat">' + s.cat + "</div><h1>" + esc(s.name) + "</h1><p>" + esc(s.tagline) + '</p><div class="row"><button class="btn ' + (inCart(s.id) ? "ghost" : "gold") + ' grow" data-cart="' + s.id + '">' + (inCart(s.id) ? "견적에서 빼기" : "견적에 담기") + '</button>' + (state.cart.length ? '<button class="btn grow" data-view="quote">견적 작성으로 →</button>' : "") + "</div></div>" +
      '<div class="card" style="margin-top:10px"><div class="row"><h2 class="grow">요금</h2>' + (PRIV.ok ? '<button class="btn sm ' + (nv ? "" : "ghost") + '" id="toggleNet">' + (nv ? "넷가 숨기기" : "넷가 보기") + "</button>" : '<span class="note">🔒 넷가는 로그인 후</span>') + '</div><div class="scroll"><table><tr><th>구분</th><th>공식 요금</th><th>' + B + " 스페셜</th>" + (nv ? "<th>넷가(내부)</th><th>1인 수익</th>" : "") + "</tr>" + rows + "</table></div>" +
      (nv ? '<p class="warn">넷가·수익은 이 화면에서만 보이고, 복사되는 글에는 들어가지 않습니다.</p>' : "") +
      (s.refund ? '<p class="note">환불: ' + esc(s.refund) + "</p>" : "") + (s.memo ? '<p class="note">메모(내부용): ' + esc(s.memo) + "</p>" : "") + "</div>" +
      '<div class="card" style="margin-top:10px"><h2>손님께 바로 보내기</h2>' + (s.oneBox ? outBox("intro_" + s.id, s.oneBox, Text.intro(s)) : outBox("intro_" + s.id, "업체 소개 + 상세 글 링크", Text.intro(s)) + outBox("price_" + s.id, "요금 안내(공식 요금 / " + B + " 스페셜)", Text.price(s))) + outBox("after_" + s.id, "예약 완료 후 안내", Text.after(s, "")) + "</div>";
  }
  function field(e, i, key, label, type, opts) {
    var v = esc(e[key] || ""), at = 'data-e="' + i + '" data-k="' + key + '"', dk = ' data-key="f_' + e.shopId + "_" + key + '"';
    if (opts) return "<div" + dk + "><label>" + label + "</label><select " + at + '><option value="">선택</option>' + opts.map(function (o) { return "<option" + (o === e[key] ? " selected" : "") + ">" + o + "</option>"; }).join("") + "</select></div>";
    return "<div" + dk + "><label>" + label + "</label><input " + at + (key === "pickup" || key === "drop" ? ' list="places"' : "") + ' type="' + (type || "text") + '" value="' + v + '"></div>';
  }
  /* 메뉴가 많은 업체(6개 이상): 메뉴를 고르고 수량을 정해 [추가] — 고른 메뉴만 아래에 나온다 */
  function menuPick(s, e, i) {
    if (s.items.length <= 5) return "";
    var any = s.items.some(function (it) { return e.q[it.key] > 0; }), qn = []; for (var n = 1; n <= 20; n++) qn.push(n);
    return '<label>메뉴 고르기 → 수량 → [추가]</label><div class="pick"><select id="msel' + i + '">' + s.items.map(function (it) { return '<option value="' + it.key + '">' + esc(it.label + " · " + priceStr(it.sp).replace("예약금 ", "").replace(/현장결제 /g, "")) + "</option>"; }).join("") + '</select><select id="mqty' + i + '">' + qn.map(function (n) { return '<option value="' + n + '">' + n + "</option>"; }).join("") + '</select><button class="btn sm gold" data-madd="' + i + '">추가</button></div>' +
      (any ? '<p class="note" style="margin:8px 0 2px">고른 메뉴 (수량을 0으로 바꾸면 빠집니다)</p>' : '<p class="note" style="margin:8px 0 0">아직 고른 메뉴가 없습니다.</p>');
  }
  function viewQuote() {
    if (!PRIV.ok) return "<h1>견적·예약 작성</h1>" + lockCard();
    if (!state.cart.length) return '<div class="empty"><p>견적에 담긴 업체가 없습니다.</p><p class="note">업체 목록에서 [담기]를 누르면 여기에 들어옵니다. 한 번에 3곳까지 함께 견적을 낼 수 있습니다.</p><button class="btn gold" data-view="home">업체 고르기</button></div>';
    var c = Calc.cart(), nums = []; for (var n = 0; n <= 20; n++) nums.push(n);
    var h = '<h1>견적·예약 작성</h1><div class="card"><h2>손님 정보</h2><div class="grid2"><div><label>대표자 성함</label><input data-c="name" value="' + esc(state.cust.name) + '"></div>' + (state.cust.useContact || state.cust.contact || state.cart.some(function (e) { return shopById(e.shopId).needContact; }) ? '<div><label>카카오톡 ID 또는 연락처</label><input data-c="contact" value="' + esc(state.cust.contact) + '"></div>' : "") + '</div>' +
      '<label class="chk"><input type="checkbox" id="useContact"' + (state.cust.useContact ? " checked" : "") + '> 카카오톡 ID·연락처 칸 쓰기(업체가 손님께 직접 연락하는 곳 등 필요할 때만)</label>' +
      '<details style="margin-top:10px"><summary class="note">손님이 채워 보낸 내용 붙여넣기</summary><textarea id="paste" placeholder="손님이 보낸 글을 그대로 붙여넣고 [내용 읽기]를 누르세요"></textarea><div class="row" style="margin-top:6px;flex-wrap:wrap"><button class="btn sm" id="doParse">내용 읽기</button><button class="btn sm gold" id="doAi">AI로 읽기(자유롭게 쓴 글)</button></div><p class="note" id="aiMsg" style="margin:6px 0 0">[내용 읽기]는 양식대로 채운 글을 바로 읽습니다(무료). [AI로 읽기]는 양식 없이 쓴 글도 읽지만 로그인이 필요하고 건당 소액의 AI 사용료가 듭니다.</p></details></div>';
    state.cart.forEach(function (e, i) {
      var s = shopById(e.shopId), r = c.rows[i], mas = s.cat === "마사지", pt = pickupTimeShop(s), noAge = (mas && !kidIn(s, e)) || s.noAges; // 마사지도 아동 코스를 담으면 나이 칸(감사 PB-B-20)
      h += '<div class="card" data-key="cart_' + s.id + '" style="margin-top:10px"><div class="row"><div class="grow"><div class="cat">' + s.cat + "</div><h2>" + esc(s.name) + '</h2></div><button class="btn sm danger" data-cart="' + s.id + '">빼기</button></div>' +
        '<p class="note">★ 견적 필수: 날짜·인원' + (mas ? "·코스" : "") + ". 나머지는 예약 확정 때 채워도 됩니다.</p>" +
        '<div class="grid2">' + field(e, i, "date", "이용 날짜 ★", "date") + (mas ? (s.needStart ? field(e, i, "start", "마사지 시작 시간") : "") : pt ? "" : (s.timeOptions ? field(e, i, "time", "선택", "", s.timeOptions) : field(e, i, "time", "시간(필요 시)"))) + "</div>" +
        '<div style="margin:10px 0">' + menuPick(s, e, i) + (s.items.length > 5 ? s.items.filter(function (it) { return e.q[it.key] > 0; }) : s.items).map(function (it) {
          return '<div class="qty" data-key="q_' + s.id + "_" + it.key + '"><span>' + esc(lab(it, e)) + "<small>" + priceStr(it.sp) + '</small></span><select data-e="' + i + '" data-q="' + it.key + '">' + nums.map(function (x) { return "<option" + (x === Number(e.q[it.key] || 0) ? " selected" : "") + ">" + x + "</option>"; }).join("") + "</select></div>";
        }).join("") + "</div>" +
        (s.sitter ? '<div class="grid2" style="margin-bottom:10px">' + field(e, i, "sitter", "보모 추가(아이 돌봄, 현장결제)", "", sitterOpts(s)) + field(e, i, "sitterN", "보모 인원", "", ["1명", "2명", "3명"]) + "</div>" : "") +
        '<div class="grid2">' + (noAge ? "" : field(e, i, "ages", "아동 만 나이")) + (s.noPickup ? "" : field(e, i, "pickup", "픽업 장소") + (pt ? field(e, i, "time", "픽업 시간") : "") + field(e, i, "drop", "드랍 장소") + field(e, i, "luggage", "짐 보관", "", ["유", "무"])) + (s.optionLabel ? field(e, i, "option", s.optionLabel) : "") + (s.paxText ? field(e, i, "paxText", s.paxText) : "") + "</div>" +
        (s.form === "clubcebu" || s.form === "lokal" ? '<div style="margin-top:10px"><label>예약자 전원 영문이름·생년월일' + (s.form === "clubcebu" ? "·성별" : "") + '</label><textarea data-e="' + i + '" data-k="roster" style="min-height:70px">' + esc(e.roster) + "</textarea></div>" : "") +
        '<div style="margin-top:10px"><label>특이사항(직접 입력)</label><textarea data-e="' + i + '" data-k="note" style="min-height:60px">' + esc(e.note) + "</textarea></div>" +
        (s.needContact && !state.cust.contact ? '<p class="warn">이 업체는 손님 카카오톡 ID 또는 한국 연락처가 꼭 필요합니다.</p>' : "") +
        '<div data-key="rules_' + s.id + '">' + (r.warns || []).map(function (w) { return '<p class="warn' + (w.hard ? " big" : "") + '">' + (w.hard ? "🚨 " : "⚠ ") + esc(w.t) + "</p>"; }).join("") +
        (r.weekFix ? '<button class="btn sm gold" data-weekfix="' + i + '">' + (r.weekFix === "we" ? "주말 요금 상품으로 바꾸기" : "주중 요금 상품으로 바꾸기") + "</button>" : "") +
        ((r.extra || []).length || (r.notes || []).length ? '<p class="note" style="margin:8px 0 0">손님 견적에 자동으로 들어가는 줄: ' + (r.extra || []).map(function (x) { return esc(x.label + " " + priceStr(x.p)); }).concat((r.notes || []).map(esc)).join(" / ") + "</p>" : "") + "</div>" +
        '<p class="note" style="margin:8px 0 0">' + (r.noPrice ? (s.quoteNote || "요금은 업체가 직접 안내합니다.") : "예약 시 " + nowStr(r.sp) + (onsiteStr(r.sp) ? (s.allPrepay ? " · 예약 시 결제 " : " · 현장결제 ") + onsiteStr(r.sp) : "") + (s.prepayOnsite ? " (원화 사전결제 " + won(r.prepayKrw) + ")" : "")) + "</p></div>";
    });
    if (c.pre) h += '<div class="card" data-key="fxcard" style="margin-top:10px">' + fxInput() + "</div>";
    if (c.rows.some(function (r) { return r.shop.prepayOnsite; })) h += '<div class="card" data-key="ratecard" style="margin-top:10px"><label>페소 → 원 환산(클럽세부 사전결제용, 1페소당 원)</label><input id="rate" type="number" step="0.1" value="' + state.rate + '"></div>';
    h += '<div class="total" style="margin-top:12px"><small>손님이 지금 입금할 금액</small><div class="big">' + ([c.payNow ? won(c.payNow) : "", c.pre ? usd(c.pre) : ""].filter(Boolean).join(" + ") || "0원") + "</div>" + (c.pre ? "<small>달러분 원화 " + won(fxKrw(c.pre)) + fxNote() + "</small>" : "") + "<small>현장결제 합계 " + (onsiteStr({ on: c.on, usd: c.usd }) || "없음") + '</small></div>' +
      '<div class="profit" style="margin-top:8px">예상 수익: ' + profitStr(c.profitKrw, c.profitPhp, c.profitUsd) + (c.unknown.length ? " · 수익 미계산: " + esc(c.unknown.join(", ")) : "") + " (손님·업체용 글에는 나가지 않습니다)</div>";
    var tabs = [["ask", "① 문의 답변"], ["quote", "② 견적·입금 안내"], ["done", "③ 입금 확인·완료"], ["vendor", "④ 업체 전달폼"]];
    h += '<div class="card" data-key="outcard" style="margin-top:12px"><div class="tabs">' + tabs.map(function (t) { return '<button data-tab="' + t[0] + '" class="' + (state.tab === t[0] ? "on" : "") + '">' + t[1] + "</button>"; }).join("") + "</div>";
    if (state.tab === "ask") h += outBox("ask", "손님께 보낼 문의 답변(빈칸 채워 달라는 안내)", Text.ask());
    if (state.tab === "quote") h += outBox("quote", "견적과 입금 안내", Text.quote());
    if (state.tab === "done") h += outBox("done", "입금 확인 + 마무리 인사", Text.done());
    if (state.tab === "vendor") h += state.cart.map(function (e) { return outBox("vendor_" + e.shopId, shopById(e.shopId).name + "에 보낼 예약폼 (" + B + " 수익은 빠져 있습니다)", Text.vendor(e)); }).join("");
    var ob = openBk(state.openId);
    h += '</div>' + (ob ? '<p class="note" data-key="openNote" style="margin:12px 0 0">📂 장부에서 불러온 기록: <b>' + esc(ob.name || "(이름 없음)") + "</b> · " + esc(ob.created) + " · " + esc(ob.status) + " — [이 기록 고쳐 저장]은 그 기록을 바꾸고(실적이 두 번 잡히지 않음), 다른 손님이면 [새 기록으로 저장]을 누르세요.</p>" : "") +
      '<div class="row" data-key="saverow" style="margin-top:12px;flex-wrap:wrap">' + (ob ? '<button class="btn gold grow" id="saveBooking">이 기록 고쳐 저장</button><button class="btn" id="saveBookingNew">새 기록으로 저장</button>' : '<button class="btn gold grow" id="saveBooking">장부에 저장</button>') + '<button class="btn ghost" id="clearCart">새 견적</button></div>';
    return h;
  }

  /* ---------- 숙소 화면 ---------- */
  function sInput(path, label, type, extra) { var o = state.stay[path[0]]; return '<div data-key="s_' + path.join("_") + '"><label>' + label + '</label><input data-s="' + path.join(".") + '" type="' + (type || "text") + '" value="' + esc(o[path[1]]) + '"' + (extra || "") + "></div>"; }
  function sSelect(path, label, opts) { var cur = String(state.stay[path[0]][path[1]]); return '<div data-key="s_' + path.join("_") + '"><label>' + label + '</label><select data-s="' + path.join(".") + '">' + opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(o[0]) === cur ? " selected" : "") + ">" + esc(o[1]) + "</option>"; }).join("") + "</select></div>"; }
  function range(a, b) { var o = []; for (var i = a; i <= b; i++) o.push([i, i ? i + "명" : "없음"]); return o; }
  function viewStay() {
    if (!PRIV.ok) return "<h1>숙소 견적</h1>" + lockCard();
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
        h += '<div style="margin-top:12px"><label>객실 타입 고르기 → 객실 수 → [추가]</label><div class="pick"><select id="roomSel">' + hh.rooms.map(function (x) { var mb = c.margin * bedsOf(hh, x.type); return '<option value="' + esc(x.type) + '">' + esc(x.type + (x.dyn ? " · 다이나믹 요금(TMJ 확인)" : x.pkgN ? " · " + x.pkgN + "박 패키지 " + Stay.money(x.rate + mb * x.pkgN, x.cur) : " · 1박 " + Stay.money(x.rate + mb, x.cur)) + (x.promo ? " (프로모 " + num(x.promo + mb) + ")" : "") + (spRate(hh, x.type, "", 99, today()) != null ? " (" + spRule(hh).minN + "박+ 특별 " + num(spRate(hh, x.type, "", 99, today()) + mb) + ")" : "") + (x.next != null && hh.next ? " (" + hh.next[0].slice(5).replace("-", "/") + "~ " + num(x.next + mb) + ")" : "") + (mb !== c.margin ? " · 침실 " + bedsOf(hh, x.type) + "개" : "")) + "</option>"; }).join("") + '</select><select id="roomQty">' + [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(function (n) { return "<option value=\"" + n + '">' + n + "객실</option>"; }).join("") + '</select><button class="btn sm gold" id="addPick">추가</button></div>' +
          (r.picks.length ? r.picks.map(function (p, i) { return '<div class="picked"><span class="grow">' + esc(p.type) + " · <b>" + p.rooms + '객실</b></span><button class="btn sm danger" data-pdel="' + i + '">빼기</button></div>'; }).join("") : '<p class="note">고른 객실이 없으면 전체 객실 타입의 요금이 한꺼번에 나갑니다.</p>') + "</div>";
        var info = [];
        if (!r.checkin) info.push("체크인 날짜를 넣어야 성수기 추가 요금·갈라 디너가 계산됩니다.");
        c.lines.forEach(function (x) { if (x.sur) info.push(x.type + ": 성수기 추가 요금 " + m(x.sur) + " (" + x.surNames.join(", ") + ", " + x.surN + "박)"); if (x.promoN) info.push(x.type + ": 프로모 요금 " + x.promoN + "박 적용"); if (x.spN) info.push(x.type + ": " + (spRule(c.h) || {}).name + " " + x.spN + "박 적용"); });
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
      h += "</div>" + (c.lock.length ? '<div class="warn big" data-key="lockbox" style="margin-top:12px;border:2px solid #d00;color:#d00">⛔ 견적 복사를 막았습니다 — 먼저 고치세요<br>• ' + c.lock.map(esc).join("<br>• ") + "</div>" : "") + '<div class="total" style="margin-top:12px"><small>' + (c.all ? "전체 객실 타입 안내(객실을 고르면 합계가 나옵니다)" : "손님 견적 합계(" + c.nights + "박)") + '</small><div class="big">' + (c.all ? "객실 " + c.lines.length + "종" : m(c.total)) + "</div>" + (c.exTotal ? "<small>이 중 갈라·의무 요금 " + m(c.exTotal) + "</small>" : "") + "</div>" +
        '<div class="profit" style="margin-top:8px">' + (c.all ? "객실 1개(침실 1개)·1박당 수익 " + m(c.margin) : "예상 수익 " + m(c.profit)) + " (손님 글에는 나가지 않습니다)</div>" +
        (c.needOk ? '<label class="warn big" style="display:flex;gap:10px;align-items:center;margin-top:12px;cursor:pointer"><input type="checkbox" id="okChk" style="width:24px;height:24px"' + (c.okDone ? " checked" : "") + '><span>서차지·갈라 디너·성인/아동 추가금·조식 추가금·연말 날짜를 모두 확인했습니다 (체크해야 견적 복사가 됩니다)</span></label>' : "") +
        '<div class="card" data-key="outcard" style="margin-top:12px">' + outBox("stay_resort_ask", "① 손님께 보낼 예약폼(빈칸 채워 달라는 안내)", Stay.resortAsk()) + outBox("stay_resort", "② 숙소 견적", Stay.resortText()) + "</div>" + (c.checks.length ? '<div class="card" data-key="chkcard" style="margin-top:12px;border:2px solid #d00"><b style="color:#d00">🔴 체크요망 — 확실하지 않거나 애매한 내용(손님 글에는 나가지 않습니다)</b><br><span style="color:#d00">• ' + c.checks.map(esc).join("<br>• ") + "</span></div>" : "");
    }
    if (st.tab === "villa") {
      var v = st.villa, vc = Stay.villa();
      h += '<div class="card" style="margin-top:10px"><h2>풀빌라 (공식 = 넷가+' + ST.villaDirectAdd + "달러, 손님가 = 넷가+수익)</h2>" +
        sSelect(["villa", "idx"], "풀빌라", ST.villas.map(function (x, i) { return [i, x.name + " · " + x.rooms]; })) +
        '<div class="grid2" style="margin-top:10px">' + sInput(["villa", "checkin"], "체크인", "date") + sInput(["villa", "nights"], "박수", "number", ' min="1"') + sInput(["villa", "profit"], "1박 수익(달러, 기본 50·때로 40)", "number") + "</div>" +
        '<div class="scroll" style="margin-top:10px"><table><tr><th>구분</th><th>1박</th></tr><tr><td>넷가(내부)</td><td>' + usd(vc.d.net) + "</td></tr><tr><td>공식 요금(직세일)</td><td class=\"off\">" + usd(vc.direct) + '</td></tr><tr><td>손님가(' + B + ' 스페셜)</td><td class="sp">' + usd(vc.sell) + "</td></tr></table></div>" +
        (vc.d.note ? '<p class="note">' + esc(vc.d.note) + "</p>" : "") + "</div>" +
        (vc.lock.length ? '<div class="warn big" data-key="lockbox" style="margin-top:12px;border:2px solid #d00;color:#d00">⛔ 견적 복사를 막았습니다 — 먼저 고치세요<br>• ' + vc.lock.map(esc).join("<br>• ") + "</div>" : "") + (vc.warn.length ? '<p class="warn big" style="margin-top:12px">⚠ ' + vc.warn.map(esc).join("<br>⚠ ") + "</p>" : "") + (vc.blank ? '<p class="note">1박 수익 칸이 비어 기본값 ' + ST.villaProfit + '달러로 계산했습니다.</p>' : "") +
        '<div class="total" style="margin-top:12px"><small>손님 견적 합계(' + vc.nights + '박)</small><div class="big">' + usd(vc.total) + "</div><small>원화 " + won(fxKrw(vc.total)) + fxNote() + "</small></div>" +
        '<div class="profit" style="margin-top:8px">예상 수익 ' + usd(vc.profit) + " (손님 글에는 나가지 않습니다)</div>" +
        '<div class="card" data-key="outcard" style="margin-top:12px">' + outBox("stay_villa_ask", "① 손님께 보낼 예약폼(빈칸 채워 달라는 안내)", Stay.villaAsk()) + outBox("stay_villa", "② 풀빌라 견적", Stay.villaText()) + "</div>";
    }
    if (st.tab === "sol") {
      var s = st.sol, sc = Stay.sol();
      h += '<div class="card" style="margin-top:10px"><h2>솔타나콘도텔</h2>' +
        '<div class="scroll"><table><tr><th>요금</th>' + [["in", "입국팩"], ["out", "출국팩"], ["inout", "입국팩+출국팩"], ["room", "룸온리 1박"]].map(function (x) { return "<th>" + x[1] + "</th>"; }).join("") + "</tr>" + ST.soltanaTiers.map(function (t) { return "<tr><td>" + (t.key === sc.tier.key ? "<b>" + t.name + " ✓</b>" : t.name) + "</td>" + [["in", "입국팩"], ["out", "출국팩"], ["inout", "입국팩+출국팩"], ["room", "룸온리 1박"]].map(function (x) { return '<td class="' + (t.key === sc.tier.key && (x[0] === sc.p.pack || (x[0] === "room" && sc.p.room)) ? "sp" : "off") + '">' + t.price[x[0]] + "</td>"; }).join("") + "</tr>"; }).join("") + '</table></div><p class="note">단위: 달러, 객실당(룸온리는 1박당). 기준 인원 성인 2 + 아동 2.</p>' +
        '<div class="grid2">' + sSelect(["sol", "tier"], "적용 요금", ST.soltanaTiers.map(function (t) { return [t.key, t.name]; })) + sSelect(["sol", "key"], "투숙 타입", ST.soltana.map(function (x) { return [x.key, x.name]; })) +
        sInput(["sol", "checkin"], sc.hasIn ? "한국 출발 날짜(입국팩 날짜 — 세부 도착일 아님)" : "체크인 날짜", "date") + sSelect(["sol", "rooms"], "객실 수", [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(function (n) { return [n, n + "객실"]; })) + (sc.p.room ? sSelect(["sol", "nights"], "룸온리 박수", [1, 2, 3, 4, 5, 6].map(function (n) { return [n, n + "박"]; })) : "") + 
        sSelect(["sol", "addAdult"], "성인 추가(입국팩 20·룸온리 1박 15·출국팩 20달러)", range(0, 10)) + sSelect(["sol", "addKid"], "아동 추가 만 7~11세(입국팩만 15달러, 그 외 무료)", range(0, 10)) + sSelect(["sol", "addBaby"], "만 7세 미만 아동(무료, 엑베·조식 미포함)", range(0, 10)) + sSelect(["sol", "kidBed"], "아이 엑스트라베드 따로 요청(입국팩 만 6세 이하·출국팩 아동, 팩마다 10달러)", range(0, 10)) +
        (sc.p.room ? sSelect(["sol", "bfPax"], "룸온리 조식 추가(1인 1박 " + ST.soltanaAdd.room.breakfast + "달러)", range(0, 10)) : "") + sInput(["sol", "totalPax"], "총 인원(객실당 최대 " + ST.soltanaMaxPax + "명 확인용)", "number", ' min="1"') +
        sInput(["sol", "flight"], "이용 항공편명") + sInput(["sol", "pax"], "각 방 인원 구성(아동 만 나이)") + sInput(["sol", "ename"], "대표자 영문 성함") + sc.p.times.map(function (label, i) { return sInput(["sol", i ? "t2" : "t1"], label); }).join("") + "</div>" +
        '<div style="margin-top:10px"><label>특이사항(추가로 적을 내용)</label><input data-s="sol.note" value="' + esc(s.note) + '"></div>' +
        '<p class="note">특이사항에 자동으로 들어가는 글: ' + esc(Stay.solNote()) + "</p>" +
        (sc.lock.length ? '<div class="warn big" data-key="lockbox" style="margin-top:12px;border:2px solid #d00;color:#d00">⛔ 견적 복사를 막았습니다 — 먼저 고치세요<br>• ' + sc.lock.map(esc).join("<br>• ") + "</div>" : "") + (sc.warn.length ? '<p class="warn big">⚠ ' + sc.warn.map(esc).join("<br>⚠ ") + "</p>" : "") +
        '<p class="note">엑스트라베드 ' + sc.beds + "개 포함(객실 " + sc.rooms + "개 — 엑스트라베드는 객실당 1개까지). 조식은 입국팩 추가 인원에만 포함되고, 룸온리는 조식 추가를 고른 인원만, 출국팩은 조식이 없습니다.</p></div>" +
        '<div class="total" style="margin-top:12px"><small>합계 (' + sc.tier.name + ')</small><div class="big">' + usd(sc.total) + "</div><small>객실 " + usd(sc.room) + (sc.extra ? " + 추가 인원 " + usd(sc.extra) : "") + " · 원화 " + won(sc.krw) + fxNote() + "</small></div>" +
        '<div class="card" data-key="outcard" style="margin-top:12px">' + outBox("sol_ask", "① 손님께 보낼 예약폼(빈칸 채워 달라는 안내)", Stay.solAsk()) + outBox("sol_quote", "② 금액 안내", Stay.solText()) + "</div>";
    }
    var so = openBk(state.stayOpenId); if (so && so.stayTab !== st.tab) so = null;
    return h + (so ? '<p class="note" data-key="openNote" style="margin:12px 0 0">📂 장부에서 불러온 기록: <b>' + esc(so.name || "(이름 없음)") + "</b> · " + esc(so.created) + " · " + esc(so.status) + " — [이 기록 고쳐 저장]은 그 기록을 바꾸고, 다른 손님이면 [새 기록으로 저장]을 누르세요.</p>" : "") +
      '<div class="row" data-key="saverow" style="margin-top:12px;flex-wrap:wrap">' + (so ? '<button class="btn gold grow" id="saveStay">이 기록 고쳐 저장</button><button class="btn" id="saveStayNew">새 기록으로 저장</button>' : '<button class="btn gold grow" id="saveStay">이 숙소 견적을 장부에 저장</button>') + '<button class="btn ghost" id="newStay">새 숙소 견적</button></div>' + '<div class="row" style="margin-top:10px"><button class="btn grow" data-view="philco">💰 필코가 더 싼 숙소 목록 (연말 문의용)</button></div>';
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
  /* 장부 칸별 합치기(2026-11-25 감사 P3 — PB-D-01·02·13): 기록마다 u(마지막 저장), fu{칸: 고친 시각}, ub(fu 에 없는 칸의 시각).
     두 기기가 같은 기록의 다른 칸을 고치면 둘 다 남고, 같은 칸이면 나중에 고친 쪽이 남는다. 지운 기록은 30일 동안 내용을 품은 '지움 표시'로 남아 되살릴 수 있다. */
  var META = { u: 1, fu: 1, ub: 1 }, KEEP_DEL = 30 * 864e5;
  function stab(o) { return JSON.stringify(o, function (k, v) { return v && typeof v === "object" && !Array.isArray(v) ? Object.keys(v).sort().reduce(function (a, kk) { a[kk] = v[kk]; return a; }, {}) : v; }); }
  function fuMax(x) { var m = x.ub != null ? x.ub : 0; Object.keys(x.fu || {}).forEach(function (k) { if (x.fu[k] > m) m = x.fu[k]; }); return m; }
  function legacyEdit(x) { return x.ub != null && (x.u || 0) > fuMax(x); } // 칸 시각을 모르는 옛 앱이 고친 기록 — 모든 칸을 u 시각으로 본다
  function fTime(x, k) { if (legacyEdit(x)) return x.u || 0; return x.fu && x.fu[k] != null ? x.fu[k] : x.ub != null ? x.ub : (x.u || 0); }
  function fixLegacy(x) { if (legacyEdit(x)) { x.ub = x.u; delete x.fu; } if (x.ub == null) x.ub = x.u || 0; x.fu = x.fu || {}; }
  function setF(x, obj) { // 값이 바뀐 칸만 시각을 남긴다
    var t = Date.now(), ch = Object.keys(obj).filter(function (k) { return !META[k] && stab(x[k]) !== stab(obj[k]); });
    if (!ch.length) return x;
    fixLegacy(x); if (t <= x.u) t = x.u + 1;
    ch.forEach(function (k) { x[k] = obj[k]; x.fu[k] = t; }); x.u = t; return x;
  }
  function normRec(m, T) { var ks = Object.keys(T), lo = Infinity, hi = 0, fu = {}; ks.forEach(function (k) { if (T[k] < lo) lo = T[k]; if (T[k] > hi) hi = T[k]; }); if (!ks.length) lo = hi = 0; ks.forEach(function (k) { if (T[k] > lo) fu[k] = T[k]; }); m.u = hi; if (Object.keys(fu).length) { m.ub = lo; m.fu = fu; } return m; }
  function mergeRec(l, r) {
    var keys = {}, m = {}, T = {};
    [l, r].forEach(function (o) { Object.keys(o).forEach(function (k) { if (!META[k] && o[k] !== undefined) keys[k] = 1; }); });
    Object.keys(keys).forEach(function (k) {
      var hl = l[k] !== undefined, hr = r[k] !== undefined, tl = fTime(l, k), tr = fTime(r, k), useR;
      if (!hr) useR = false; else if (!hl) useR = true;
      else useR = tr !== tl ? tr > tl : (r.u || 0) !== (l.u || 0) ? (r.u || 0) > (l.u || 0) : stab(r[k]) > stab(l[k]); // 같은 시각이면 어느 기기에서든 같은 쪽을 고르게
      m[k] = useR ? r[k] : l[k]; T[k] = !hr ? tl : !hl ? tr : Math.max(tl, tr);
    });
    return normRec(m, T);
  }
  function tombOf(t) { var o = { id: t.id, u: t.u || 0, deleted: true }; if (t.data) o.data = t.data; return o; }
  function cleanTomb(t) { t = tombOf(t); if (t.data && Date.now() - t.u > KEEP_DEL) delete t.data; return t; } // 30일 지나면 내용만 비운다(지움 표시는 남아 다른 기기에서 되살아나지 않게)
  function pickDel(l, r) {
    if (l.deleted && r.deleted) return (r.u || 0) > (l.u || 0) || ((r.u || 0) === (l.u || 0) && r.data && !l.data) ? r : l;
    var del = l.deleted ? l : r, rec = l.deleted ? r : l;
    if ((rec.u || 0) > (del.u || 0)) return rec; // 지운 뒤에 다른 기기에서 고친 기록 → 고친 쪽
    return del.data ? del : { id: del.id, u: del.u, deleted: true, data: rec }; // 같으면 지움(내용은 30일 동안 품는다)
  }
  function autoDone() { // 확정 건은 이용일이 지나면 완료 — 저장 시각(u)은 건드리지 않는다(다른 기기에서 지운 기록이 되살아나지 않게, PB-D-02)
    var td = today(), ch = 0;
    state.bookings.forEach(function (x) { var d = x.lastDate || x.firstDate; if (x.status === "확정" && d && d < td) { var t = Math.max(fTime(x, "status"), fTime(x, "auto")) + 1; fixLegacy(x); x.status = "완료"; x.auto = true; x.fu.status = t; x.fu.auto = t; ch++; } });
    var n0 = stab(state.tomb); state.tomb = state.tomb.map(cleanTomb); if (ch || stab(state.tomb) !== n0) save(); return ch;
  }
  // 백업 파일로 되살리기: 장부에 없는 기록만 더한다(있는 기록은 지금 장부가 최신이라 그대로). 지운 기록이면 물어보고 되살린다(PB-D-13)
  function importBk(list) {
    if (!Array.isArray(list)) return toast("필보드 백업 파일이 아닙니다(philboard-backup-날짜.json 을 고르세요)");
    var add = 0, back = 0, keep = 0, now = Date.now();
    list.forEach(function (r) {
      if (!r || typeof r !== "object" || !r.id || r.deleted || !Array.isArray(r.shops)) return;
      if (openBk(r.id)) { keep++; return; }
      var tb = state.tomb.filter(function (x) { return x.id === r.id; })[0], x = clone(r);
      if (tb) { if (!confirm("'" + (r.name || "이름 없음") + "' 기록은 장부에서 지운 기록입니다. 백업 파일에서 되살릴까요?")) return; delete x.fu; delete x.ub; x.u = Math.max(now, (tb.u || 0) + 1); state.tomb = state.tomb.filter(function (y) { return y !== tb; }); back++; }
      else add++; // 처음 보는 기록은 원래 저장 시각 그대로(서버에 더 새 내용이 있으면 그쪽이 남는다)
      state.bookings.push(x);
    });
    state.bookings.sort(function (a, b) { return a.id.localeCompare(b.id); });
    save(); syncSoon(); render();
    toast("백업에서 " + (add + back) + "건을 더했습니다" + (back ? "(지운 기록 " + back + "건 되살림)" : "") + (keep ? " · 이미 있는 " + keep + "건은 지금 장부 그대로" : ""));
  }
  function openBk(id) { return id ? state.bookings.filter(function (x) { return x.id === id; })[0] || null : null; }
  function emptyEntries() { return state.cart.filter(function (e) { return !Calc.entry(e).pax; }).map(function (e) { return shopById(e.shopId).name; }); }
  function pickEdited(test) { var o = {}, b = {}; Object.keys(state.edited).forEach(function (k) { if (test(k)) { o[k] = state.edited[k]; if (state.editedBase[k] != null) b[k] = state.editedBase[k]; } }); return Object.keys(o).length ? { t: o, b: b } : null; }
  function putEdited(x) { if (!x || !x.t) return; Object.keys(x.t).forEach(function (k) { state.edited[k] = x.t[k]; if (x.b && x.b[k] != null) state.editedBase[k] = x.b[k]; }); }
  var isQuoteOut = function (k) { return !isStayOut(k); };
  function syncSoon() { if (!sb || !sync.user) return; clearTimeout(sync.timer); sync.timer = setTimeout(doSync, 800); }
  function syncMsg(m) { sync.msg = m; var el = $("#syncMsg"); if (el) el.textContent = m; }
  function doSync() {
    if (!sb || !sync.user) return Promise.resolve();
    if (sync.busy) { sync.again = true; return Promise.resolve(); } // 도는 중에 또 고치면 끝난 뒤 한 번 더
    sync.busy = true; syncMsg("동기화 중…");
    var next = function () { sync.busy = false; if (sync.again) { sync.again = false; doSync(); return true; } return false; };
    return fresh().then(function () { return api("/rest/v1/pb_bookings?select=id,data", { auth: true }); }).then(function (rows) {
      autoDone();
      var R = {}, L = {}, ups = [], changed = 0, nb = [], nt = [];
      (rows || []).forEach(function (r) { if (r && r.id && r.data) R[r.id] = r.data; });
      state.tomb.forEach(function (t) { L[t.id] = tombOf(t); });
      state.bookings.forEach(function (x) { L[x.id] = x; });
      Object.keys(Object.assign({}, R, L)).forEach(function (id) {
        var l = L[id], r = R[id], m = !r ? l : !l ? r : (l.deleted || r.deleted) ? pickDel(l, r) : mergeRec(l, r);
        if (m.deleted) m = cleanTomb(m);
        var ms = stab(m);
        if (l && ms !== stab(l)) changed++; else if (!l) changed++;
        if (!r || ms !== stab(r)) ups.push({ id: id, data: m, updated_at: new Date().toISOString() });
        (m.deleted ? nt : nb).push(m);
      });
      state.bookings = nb.sort(function (a, b) { return a.id.localeCompare(b.id); }); state.tomb = nt;
      save();
      var done = function () { if (next()) return; syncMsg("동기화 완료 " + new Date().toLocaleTimeString("ko-KR") + " · 받은 것 " + changed + "건, 올린 것 " + ups.length + "건"); if (changed && state.view === "ledger") render(); };
      if (!ups.length) return done();
      return api("/rest/v1/pb_bookings?on_conflict=user_id,id", { method: "POST", auth: true, prefer: "resolution=merge-duplicates,return=minimal", body: ups }).then(done);
    }).catch(function (e) { sync.again = false; sync.busy = false; syncMsg("동기화 실패: " + koErr(e.message || String(e))); });
  }
  document.addEventListener("visibilitychange", function () { if (!document.hidden) syncSoon(); }); // 폰에서 앱으로 돌아오면 바로 합친다
  function syncBox() {
    if (!sb) return '<div class="card" style="margin-top:10px"><p class="note">기기 간 동기화를 쓸 수 없는 상태입니다(인터넷 연결 또는 설정 파일 확인). 장부는 이 기기에만 저장됩니다.</p></div>';
    if (!sync.user) return '<div class="card" style="margin-top:10px"><h2>폰·PC 장부 동기화</h2><p class="note">로그인하면 이 기기의 장부가 다른 기기와 합쳐지고, 넷가·숙소 원가·계좌가 열립니다. 로그인하지 않으면 장부는 이 기기에만 저장됩니다.</p>' + loginForm() + "</div>";
    return '<div class="card" style="margin-top:10px"><div class="row" style="flex-wrap:wrap"><div class="grow"><b>동기화 켜짐</b> <span class="note">' + esc(sync.user.email || "") + '</span></div><button class="btn sm" id="sbSync">지금 동기화</button><button class="btn sm ghost" id="sbLogout">로그아웃</button></div><p class="note" id="syncMsg" style="margin:6px 0 0">' + esc(sync.msg) + "</p></div>";
  }
  if (sb && sync.user) setTimeout(doSync, 300);

  /* ---------- 내부 자료(넷가·숙소 원가·수익 메모·계좌) — 로그인한 뒤에만 연다 (2026-11-24 P1, 원장 261124-42 추천안 ②) ----------
     공개 주소에는 손님가만 든 data/shops.js 와 잠긴 data/private.enc 만 올라간다(tools/split_private.js 가 배포 때 만든다).
     열쇠는 Supabase pb_private(사장님 계정만 읽기, RLS)에서 받아 이 기기에 간직한다 — 한 번 열면 인터넷이 끊겨도 열린다. */
  function b64Bytes(t) { var bin = atob(String(t).trim()), a = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return a; }
  function openPriv(keyB64, encB64) {
    if (!window.crypto || !crypto.subtle) return Promise.reject(new Error("이 브라우저에서는 잠긴 자료를 열 수 없습니다(https 주소로 열어 주세요)."));
    var raw = b64Bytes(encB64);
    return crypto.subtle.importKey("raw", b64Bytes(keyB64), "AES-GCM", false, ["decrypt"]).then(function (k) { return crypto.subtle.decrypt({ name: "AES-GCM", iv: raw.slice(0, 12) }, k, raw.slice(12)); })
      .then(function (buf) { return JSON.parse(new TextDecoder().decode(buf)); }, function () { throw new Error("내부 자료를 열지 못했습니다(열쇠가 맞지 않음)."); });
  }
  function mergePriv(P) {
    Object.keys(P.shops || {}).forEach(function (id) { var s = shopById(id), x = P.shops[id]; if (!s) return; ["commission", "memo", "vendorPay"].forEach(function (k) { if (x[k] != null) s[k] = x[k]; }); if (x.nets) s.items.forEach(function (it) { if (x.nets[it.key]) it.net = x.nets[it.key]; }); });
    Object.keys(P.settings || {}).forEach(function (k) { S[k] = P.settings[k]; });
    Object.keys(P.stay || {}).forEach(function (k) { ST[k] = P.stay[k]; });
    (P.library || []).slice().sort(function (a, b) { return a.i - b.i; }).forEach(function (x) { D.library.splice(x.i, 0, x.item); });
    window.PB_HOTELS = H = P.hotels || { date: "", hotels: [] }; window.PB_PHILCO = P.philco || { date: "", hotels: {} };
    stayDefault.villa.profit = ST.villaProfit; if (state.stay.villa.profit == null || state.stay.villa.profit === "") state.stay.villa.profit = ST.villaProfit;
    PRIV.ok = true; PRIV.version = P.version; PRIV.stale = P.version !== D.version;
  }
  function getKey(fromServer) {
    var k = store.get("pkey", null); if (k && !fromServer) return Promise.resolve(k);
    if (!sb || !sess) return Promise.reject(new Error("로그인이 필요합니다."));
    return fresh().then(function () { return api("/rest/v1/pb_private?select=v&k=eq.key", { auth: true }); }).then(function (rows) { var v = rows && rows[0] && rows[0].v; if (!v) throw new Error("이 계정에는 내부 자료(넷가·원가) 권한이 없습니다. 클실장에게 알려 주세요."); return v; });
  }
  function loadPrivate(fromServer) {
    if (PRIV.ok) return Promise.resolve(true);
    var key; PRIV.loading = true;
    return getKey(fromServer).then(function (k) { key = k; return fetch("data/private.enc?v=" + (window.PB_V || Date.now())).then(function (r) { if (!r.ok) throw new Error("내부 자료 파일을 받지 못했습니다(" + r.status + ")."); return r.text(); }); })
      .then(function (enc) { return openPriv(key, enc); })
      .then(function (P) { mergePriv(P); store.set("pkey", key); PRIV.loading = false; PRIV.msg = ""; render(); return true; })
      .catch(function (e) { if (!fromServer && sess && store.get("pkey", null)) { store.set("pkey", null); return loadPrivate(true); } PRIV.loading = false; PRIV.msg = (e && e.message) || String(e); render(); return false; });
  }
  function loginForm() { return '<div class="grid2"><div><label>이메일</label><input id="sbEmail" type="email" autocomplete="username"></div><div><label>비밀번호</label><input id="sbPw" type="password" autocomplete="current-password"></div></div><div class="row" style="margin-top:8px;flex-wrap:wrap"><button class="btn sm gold" id="sbLogin">로그인</button></div><p class="note" id="syncMsg">' + esc(sync.msg) + "</p>"; }
  function lockCard() {
    if (PRIV.ok) return PRIV.stale ? '<p class="warn">⚠ 내부 자료(' + esc(PRIV.version) + ")와 공개 자료(" + esc(D.version) + ")의 버전이 다릅니다. 새로고침해도 그대로면 클실장에게 '필보드 다시 배포'라고 알려 주세요.</p>" : "";
    if (PRIV.loading) return '<div class="card"><p class="note">🔒 내부 자료(넷가·숙소 원가·계좌)를 여는 중…</p></div>';
    return '<div class="card" style="border:2px solid #b8860b"><h2>🔒 로그인하면 지금처럼 견적을 낼 수 있습니다</h2><p class="note">넷가·숙소 원가(TMJ·필코)·수익·입금 계좌는 공개 주소에 두지 않고, 사장님 계정으로 로그인한 기기에서만 엽니다. 한 번 로그인하면 이 기기에서는 인터넷이 끊겨도 그대로 열립니다.' + (PRIV.msg ? '<br><b style="color:#d00">' + esc(PRIV.msg) + "</b>" : "") + "</p>" + (sync.user ? '<button class="btn gold" id="privRetry">내부 자료 다시 받기</button>' : loginForm()) + "</div>";
  }

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
      '<p class="note" style="margin-top:14px">장부는 이 기기의 브라우저에 저장되고, 로그인하면 다른 기기와 합쳐집니다(두 기기에서 서로 다른 칸을 고치면 둘 다 남고, 같은 칸은 나중에 고친 쪽이 남습니다). <button class="btn sm ghost" id="exportBk">백업 파일 내려받기</button> <label class="btn sm ghost" style="display:inline-block;cursor:pointer">백업 파일로 되살리기<input type="file" id="importBk" accept=".json,application/json" hidden></label></p>';
    var tbs = state.tomb.filter(function (x) { return x.data; }).sort(function (a, c) { return (c.u || 0) - (a.u || 0); });
    if (tbs.length) h += '<details class="card" data-key="tombs" style="margin-top:10px"><summary>최근 지운 기록 ' + tbs.length + '건 — 30일 동안 되살릴 수 있습니다</summary>' + tbs.map(function (t) {
      var x = t.data, dd = new Date(t.u), dk = dd.getFullYear() + "-" + ("0" + (dd.getMonth() + 1)).slice(-2) + "-" + ("0" + dd.getDate()).slice(-2);
      return '<div class="row" style="margin-top:8px;border-top:1px solid #eee;padding-top:8px"><div class="grow"><b>' + esc(x.name || "(이름 없음)") + '</b> <span class="badge">' + esc(x.status || "") + '</span><div class="note">' + esc((x.shops || []).join(" · ")) + " · 이용일 " + esc(x.firstDate || "미정") + " · 지운 날 " + dk + '</div></div><button class="btn sm" data-restore="' + esc(t.id) + '">되살리기</button></div>';
    }).join("") + "</details>";
    return h;
  }
  /* ---------- 필코가 더 싼 숙소 목록 (연말 문의용 한 페이지) ---------- */
  function viewPhilco() {
    if (!PRIV.ok) return "<h1>필코가 더 싼 숙소 목록</h1>" + lockCard();
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
  /* 화면 다시 그리기 — 통째로 갈아 끼우지 않고 바뀐 부분만 고친다(감사 PB-A-09·B-01·C-05).
     통째로 갈면 칸을 치고 바로 [복사]·[장부에 저장]·다음 칸을 누를 때 누른 버튼·칸이 사라져 입력이 없어지고 폰 키보드가 닫혔다.
     data-key(또는 id)가 같은 것끼리 맞춰 고치고, 지금 입력 중인 칸의 글자는 건드리지 않는다. */
  function keyOf(n) { return n.nodeType === 1 ? (n.getAttribute("data-key") || n.id || "") : ""; }
  function sig(n) { return n.nodeType === 1 ? n.nodeName + "." + (n.getAttribute("class") || "").split(" ")[0] : "#" + n.nodeType; }
  function morphNode(f, t) {
    if (f.nodeType !== 1) { if (f.nodeValue !== t.nodeValue) f.nodeValue = t.nodeValue; return; }
    var i, at;
    for (i = f.attributes.length - 1; i >= 0; i--) { at = f.attributes[i].name; if (!t.hasAttribute(at) && !(at === "open" && f.nodeName === "DETAILS")) f.removeAttribute(at); }
    for (i = 0; i < t.attributes.length; i++) { at = t.attributes[i]; if (f.getAttribute(at.name) !== at.value) f.setAttribute(at.name, at.value); }
    var tag = f.nodeName, act = f === document.activeElement;
    if (tag === "TEXTAREA") { if (!act && f.value !== t.value) f.value = t.value; return; }
    morphChildren(f, t);
    if (tag === "INPUT") { if (f.type === "checkbox" || f.type === "radio") f.checked = t.checked; else if (!act && f.value !== t.value) f.value = t.value; }
    if (tag === "SELECT" && f.value !== t.value) f.value = t.value;
  }
  function morphChildren(from, to) {
    var keys = {}, c, f, t, tn, k, m, fn;
    for (c = to.firstChild; c; c = c.nextSibling) if (keyOf(c)) keys[keyOf(c)] = 1;
    f = from.firstChild; t = to.firstChild;
    while (t) {
      tn = t.nextSibling; k = keyOf(t);
      while (f && keyOf(f) && !keys[keyOf(f)]) { fn = f.nextSibling; from.removeChild(f); f = fn; } // 없어진 칸
      if (k) { m = f; while (m && keyOf(m) !== k) m = m.nextSibling; if (m && m.nodeName === t.nodeName) { if (m !== f) from.insertBefore(m, f); else f = f.nextSibling; morphNode(m, t); } else from.insertBefore(t, f); }
      else if (f && !keyOf(f) && sig(f) === sig(t)) { fn = f.nextSibling; morphNode(f, t); f = fn; }
      else if (f && !keyOf(f) && f.nextSibling && !keyOf(f.nextSibling) && sig(f.nextSibling) === sig(t) && !(tn && sig(tn) === sig(f))) { fn = f.nextSibling; from.removeChild(f); f = fn; continue; } // 하나 빠짐
      else if (f && !keyOf(f) && tn && sig(tn) === sig(f)) from.insertBefore(t, f); // 하나 끼어듦
      else if (f && !keyOf(f) && f.nodeName === t.nodeName) { fn = f.nextSibling; morphNode(f, t); f = fn; }
      else if (f && !keyOf(f)) { fn = f.nextSibling; from.replaceChild(t, f); f = fn; }
      else from.insertBefore(t, f);
      t = tn;
    }
    while (f) { fn = f.nextSibling; from.removeChild(f); f = fn; }
  }
  function render() {
    var app = $("#app"), html = (VIEWS[state.view] || viewHome)(), vk = state.view + "|" + (state.view === "shop" ? state.shopId : state.view === "stay" ? state.stay.tab : "");
    if (render.vk !== vk || !app.firstChild) app.innerHTML = html; else { var tmp = document.createElement("div"); tmp.innerHTML = html; morphChildren(app, tmp); }
    render.vk = vk;
    DRAFT_IDS.forEach(function (id) { var el = $("#" + id), v = draftGet(id); if (el && v) { if (el !== document.activeElement) el.value = v; var dt = el.closest("details"); if (dt) dt.open = true; } });
    $("#cartCount").textContent = state.cart.length;
    document.querySelectorAll(".top nav button").forEach(function (b) { b.classList.toggle("on", b.dataset.view === state.view || (state.view === "shop" && b.dataset.view === "home")); });
  }
  function rerenderKeep(id) { var el = $("#" + id), pos = el ? el.selectionStart : 0; render(); el = $("#" + id); if (el) { el.focus(); try { el.setSelectionRange(pos, pos); } catch (e) { } } }
  function refreshQuote(keepFocus) { save(); if (!keepFocus) render(); }
  function draftClear(ids) { ids.forEach(function (id) { DRAFT[id] = ""; try { sessionStorage.removeItem("pb_draft_" + id); } catch (e) { } var el = $("#" + id); if (el) el.value = ""; }); }
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
    if (t.id === "addPick") { var rs = $("#roomSel"), pk = state.stay.resort.picks, ex = pk.filter(function (x) { return x.type === rs.value; })[0]; if (ex) ex.rooms = +$("#roomQty").value; else pk.push({ type: rs.value, rooms: +$("#roomQty").value }); save(); return render(); }
    if (t.id === "fxAuto") { state.fxInfo.manual = false; if (state.fxInfo.mid) state.fx = Math.ceil(state.fxInfo.mid * (1 + S.usdSpread)); save(); render(); return fxFetch(true); }
    if (d.madd != null) { state.cart[+d.madd].q[$("#msel" + d.madd).value] = +$("#mqty" + d.madd).value; return refreshQuote(); }
    if (d.pdel != null) { state.stay.resort.picks.splice(+d.pdel, 1); save(); return render(); }
    if (t.id === "saveStay" || t.id === "saveStayNew") {
      /* 'sb'(동기화 서버) 이름을 가리지 않게 sbk 로 쓴다 — 예전엔 이 줄 때문에 [AI로 읽기]가 로그인해도 '로그인한 뒤에'만 떴다(감사 PB-D-09) */
      var sbk = Stay.booking(), tab = state.stay.tab, sres0 = tab === "resort" ? Stay.resort() : null, sob = t.id === "saveStay" ? openBk(state.stayOpenId) : null; if (sob && sob.stayTab !== tab) sob = null;
      if (sob && (sob.name || "") !== (state.stay.cust.name || "") && !confirm("불러온 기록은 '" + (sob.name || "이름 없음") + "' 손님인데 지금 성함은 '" + (state.stay.cust.name || "없음") + "'입니다. 그 기록을 이 내용으로 바꿀까요?\n(다른 손님이면 [취소] 후 [새 기록으로 저장]을 누르세요)")) return;
      var srec = { kind: "stay", stayTab: tab, staySnap: clone(state.stay[tab]), name: state.stay.cust.name, cust: clone(state.stay.cust), cart: [], checks: sres0 ? sres0.checks.concat(sres0.hardWarn) : [], shops: [sbk.label], firstDate: sbk.date || "", lastDate: sbk.date ? addDays(sbk.date, sbk.nights) : "", payNow: 0, payText: sbk.payText, profitKrw: 0, profitPhp: sbk.profitPhp, profitUsd: sbk.profitUsd, own: !!sbk.own, edited: pickEdited(function (k) { return isStayOut(k) && k.indexOf(tab === "sol" ? "sol_" : "stay_" + tab) === 0; }) };
      if (sob) { if (JSON.stringify(sob.checks || []) !== JSON.stringify(srec.checks)) srec.checkDone = false; setF(sob, srec); }
      else { var sid = "b" + Date.now(); state.bookings.push(Object.assign({ u: Date.now(), id: sid, created: today(), status: "견적", checkDone: false }, srec)); state.stayOpenId = sid; }
      save(); syncSoon(); render(); return toast(sob ? "불러온 기록을 고쳐 저장했습니다" : "장부에 저장했습니다");
    }
    if (t.id === "newStay") {
      if (!confirm("숙소 견적 칸(세 탭 모두)과 붙여넣은 글을 비우고 새 손님 견적을 시작할까요? 장부에 저장한 기록은 그대로 남습니다.")) return;
      var keepTab = state.stay.tab; state.stay = clone(stayDefault); state.stay.tab = keepTab; state.stayOpenId = ""; clearEdited(isStayOut); draftClear(["spaste"]);
      var smsg = $("#saiMsg"); if (smsg) smsg.textContent = ""; save(); render(); window.scrollTo(0, 0); return;
    }
    if (d.ledst) { state.led.status = d.ledst; return render(); }
    if (d.stab) { state.stay.tab = d.stab; save(); return render(); }
    if (d.shop) return go("shop", d.shop);
    if (d.cart) return toggleCart(d.cart);
    if (d.tab) { state.tab = d.tab; return render(); }
    if (d.copy === "stay_villa" && state.stay.tab === "villa") { var gv = Stay.villa(); if (gv.lock.length) return toast("복사를 막았습니다 — 빨간 칸(풀빌라 수익)을 먼저 고치세요"); if (gv.warn.length && !confirm(gv.warn.join("\n") + "\n\n그대로 복사할까요?")) return; }
    if (d.copy === "sol_quote" && state.stay.tab === "sol") { var gs = Stay.sol(); if (gs.lock.length) return toast("복사를 막았습니다 — 빨간 칸(엑스트라베드 수)을 먼저 고치세요"); }
    if (d.copy === "stay_resort" && state.stay.tab === "resort") { var gc = Stay.resort(); if (gc.lock.length) return toast("복사를 막았습니다 — 빨간 칸을 먼저 고치세요"); if (gc.needOk && !gc.okDone) return toast("먼저 아래 ‘확인했습니다’ 칸을 체크하세요 (서차지·갈라·추가금)"); }
    if (d.copy) {
      render(); // 방금 친 칸까지 반영된 글로 맞춘 뒤 복사한다
      var cid = d.copy;
      if (cid === "quote" || cid === "done" || cid.indexOf("vendor_") === 0) {
        var emp = emptyEntries(), vsh = cid.indexOf("vendor_") === 0 ? shopById(cid.slice(7)) : null;
        if (vsh ? emp.indexOf(vsh.name) >= 0 : emp.length === state.cart.length) return toast("인원·수량이 0인 견적입니다 — 메뉴·인원을 먼저 고르세요");
        if (!vsh && emp.length && !confirm("인원·수량이 0인 업체가 있습니다: " + emp.join(", ") + "\n그대로 복사할까요?")) return;
        var hw = hardWarns(vsh); // 업체 규칙 경고(1인 불가·휴무일·주말 요금·할인 시간 밖·픽업 불가 등) — 감사 P4
        if (hw.length && !confirm("이 견적에 확인할 것이 있습니다:\n- " + hw.join("\n- ") + "\n\n그대로 복사할까요?")) return;
      }
      if (outStale(cid) && !confirm("이 글은 손으로 고친 뒤에 금액·인원·날짜 등 계산이 바뀌었습니다.\n고친 글(예전 계산) 그대로 복사할까요?\n\n새 계산으로 다시 만들려면 [취소] 후 [원래대로]를 누르세요.")) return;
      var ta = $('[data-out="' + cid + '"]'); return copy(ta ? ta.value : "");
    }
    if (d.copytext != null) return copy(d.copytext);
    if (d.weekfix != null) { // 골프: 날짜에 맞게 주중↔주말 상품 칸의 인원을 옮긴다
      var we0 = state.cart[+d.weekfix], ws = we0 && shopById(we0.shopId), wr = we0 && Calc.entry(we0), from = wr && wr.weekFix === "we" ? "wd" : "we", to = from === "wd" ? "we" : "wd";
      if (!wr || !wr.weekFix) return;
      Object.keys(we0.q).forEach(function (k) { var tk = k.replace(new RegExp(from + "$"), to); if (tk === k || !we0.q[k] || !ws.items.some(function (it) { return it.key === tk; })) return; we0.q[tk] = Number(we0.q[tk] || 0) + Number(we0.q[k]); we0.q[k] = 0; });
      save(); toast(to === "we" ? "주말 요금 상품으로 바꿨습니다" : "주중 요금 상품으로 바꿨습니다"); return render();
    }
    if (d.reset) { delete state.edited[d.reset]; delete state.editedBase[d.reset]; save(); return render(); }
    if (t.id === "addRow") { state.stay.resort.rows.push({ type: "", tmj: "", rooms: 1 }); save(); return render(); }
    if (d.rdel != null) { state.stay.resort.rows.splice(+d.rdel, 1); save(); return render(); }
    if (t.id === "doUniParse") {
      if (!PRIV.ok) { var um0 = $("#uMsg"); if (um0) um0.textContent = "먼저 [장부] 화면에서 로그인해 주세요(숙소 요금·넷가가 열려야 읽을 수 있습니다)."; return; }
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
        var hn = 0; if (hj && hj.result) { if (hj.result.name) state.cust.name = hj.result.name; if (hj.result.contact) state.cust.contact = hj.result.contact; hn = applyShopsParsed(hj.result, sres); }
        syncCust(); save();
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
        n += applyShopsParsed(r); // 통합 화면과 같은 함수(공항 인원 칸 포함 — 감사 P7)
        refreshQuote(); toast("AI가 " + n + "개 항목을 채웠습니다");
        am("AI가 " + n + "개 항목을 채웠습니다. 빈 칸과 금액을 한 번 확인해 주세요." + (j.usage ? " (사용량: 입력 " + num(j.usage.input) + " · 출력 " + num(j.usage.output) + " 토큰)" : ""));
      }).catch(function (e) { am("AI 읽기 실패: " + koErr(e.message || String(e))); });
      return;
    }
    if (t.id === "clearCart") {
      if (confirm("작성 중인 견적(담은 업체·손님 정보·손으로 고친 글·붙여넣은 글)을 비우고 새 견적을 시작할까요? 장부에 저장한 기록은 그대로 남습니다.")) {
        state.cart = []; state.cust = { name: "", contact: "" }; state.openId = ""; clearEdited(isQuoteOut); draftClear(["paste", "upaste"]); save(); go("home");
      } return;
    }
    if (t.id === "saveBooking" || t.id === "saveBookingNew") {
      if (!state.cart.length) return toast("담은 업체가 없습니다");
      var emp2 = emptyEntries();
      if (emp2.length === state.cart.length) return toast("인원·수량이 0인 견적은 저장하지 않습니다 — 메뉴·인원을 먼저 고르세요");
      if (emp2.length && !confirm("인원·수량이 0인 업체가 있습니다: " + emp2.join(", ") + "\n그대로 저장할까요?")) return;
      var ob2 = t.id === "saveBooking" ? openBk(state.openId) : null;
      if (ob2 && (ob2.name || "") !== (state.cust.name || "") && !confirm("불러온 기록은 '" + (ob2.name || "이름 없음") + "' 손님인데 지금 성함은 '" + (state.cust.name || "없음") + "'입니다. 그 기록을 이 내용으로 바꿀까요?\n(다른 손님이면 [취소] 후 [새 기록으로 저장]을 누르세요)")) return;
      var c = Calc.cart(), dates = state.cart.map(function (e) { return e.date; }).filter(Boolean).sort();
      var rec = { name: state.cust.name, cust: clone(state.cust), cart: clone(state.cart), shops: c.rows.map(function (r) { return r.shop.name; }), firstDate: dates[0] || "", lastDate: dates[dates.length - 1] || "", payNow: c.payNow, profitKrw: c.profitKrw, profitPhp: c.profitPhp, profitUsd: c.profitUsd, edited: pickEdited(isQuoteOut) };
      if (ob2) setF(ob2, rec);
      else { var nid = "b" + Date.now(); state.bookings.push(Object.assign({ u: Date.now(), id: nid, created: today(), status: "견적" }, rec)); state.openId = nid; }
      save(); syncSoon(); render(); return toast(ob2 ? "불러온 기록을 고쳐 저장했습니다(새 기록이 생기지 않음)" : "장부에 저장했습니다");
    }
    if (d.chk) { state.bookings.forEach(function (x) { if (x.id === d.chk) setF(x, { checkDone: true }); }); save(); syncSoon(); return render(); }
    if (d.st) { var p = d.st.split("|"); state.bookings.forEach(function (x) { if (x.id === p[0]) setF(x, { status: p[1], auto: false }); }); save(); syncSoon(); return render(); }
    if (d.del) {
      var dx = openBk(d.del); if (!dx) return;
      if (confirm("'" + (dx.name || "이름 없음") + "' 예약 기록을 삭제할까요?\n30일 동안은 장부 아래 '최근 지운 기록'에서 되살릴 수 있습니다.")) { state.bookings = state.bookings.filter(function (x) { return x.id !== d.del; }); state.tomb = state.tomb.filter(function (x) { return x.id !== d.del; }); state.tomb.push({ id: d.del, u: Math.max(Date.now(), (dx.u || 0) + 1), deleted: true, data: clone(dx) }); save(); syncSoon(); render(); toast("지웠습니다 — 30일 동안 '최근 지운 기록'에서 되살릴 수 있습니다"); }
      return;
    }
    if (d.restore) { // 최근 지운 기록 되살리기 — 지금 시각으로 저장해 다른 기기의 '지움'보다 나중이 되게 한다
      var tb = state.tomb.filter(function (x) { return x.id === d.restore; })[0]; if (!tb || !tb.data) return;
      var rx = clone(tb.data); delete rx.fu; delete rx.ub; delete rx.deleted; rx.id = tb.id; rx.u = Math.max(Date.now(), (tb.u || 0) + 1);
      state.tomb = state.tomb.filter(function (x) { return x !== tb; }); state.bookings.push(rx); save(); syncSoon(); render();
      return toast("되살렸습니다 — '" + (rx.name || "이름 없음") + "' 기록이 장부에 돌아왔습니다");
    }
    if (d.open) {
      var bk = openBk(d.open); if (!bk) return;
      if (bk.kind === "stay") {
        var sdirty = state.stayOpenId !== bk.id && (state.stay.cust.name || JSON.stringify(state.stay[bk.stayTab]) !== JSON.stringify(stayDefault[bk.stayTab]));
        if (sdirty && !confirm("지금 숙소 화면에 작성 중인 견적" + (state.stay.cust.name ? "('" + state.stay.cust.name + "' 손님)" : "") + "이 이 기록으로 바뀝니다. 장부에 저장하지 않은 내용은 사라집니다. 불러올까요?")) return;
        state.stay.tab = bk.stayTab; state.stay[bk.stayTab] = Object.assign(clone(stayDefault[bk.stayTab]), clone(bk.staySnap)); state.stay.cust = clone(bk.cust || { name: "", contact: "" });
        clearEdited(isStayOut); putEdited(bk.edited); state.stayOpenId = bk.id; draftClear(["spaste"]); save(); go("stay");
      } else {
        if (state.cart.length && state.openId !== bk.id && !confirm("지금 견적 화면에 작성 중인 견적(" + state.cart.map(function (e) { return shopById(e.shopId).name; }).join(", ") + (state.cust.name ? " · '" + state.cust.name + "' 손님" : "") + ")이 이 기록으로 바뀝니다. 장부에 저장하지 않은 내용은 사라집니다. 불러올까요?")) return;
        state.cart = clone(bk.cart).filter(function (e) { return shopById(e.shopId); }); state.cust = clone(bk.cust);
        clearEdited(isQuoteOut); putEdited(bk.edited); state.openId = bk.id; draftClear(["paste", "upaste"]); save(); go("quote");
      }
      return;
    }
    if (t.id === "sbLogin") {
      var em = $("#sbEmail").value.trim(), pw = $("#sbPw").value, login = t.id === "sbLogin"; if (!em || !pw) return syncMsg("이메일과 비밀번호를 넣어 주세요.");
      syncMsg(login ? "로그인 중…" : "계정 만드는 중…");
      api(login ? "/auth/v1/token?grant_type=password" : "/auth/v1/signup", { method: "POST", body: { email: em, password: pw } }).then(function (j) {
        if (j && j.access_token) { setSess(j); sync.msg = ""; render(); loadPrivate(true); return doSync(); }
        syncMsg("계정이 접수됐습니다. 확인 메일(스팸함 포함)의 링크를 누르거나, 메일이 안 오면 클실장에게 '계정 만들었어'라고 알려 주세요. 승인 뒤 [로그인]을 누르시면 됩니다.");
      }).catch(function (e) { syncMsg((login ? "로그인 실패: " : "계정 만들기 실패: ") + koErr(e.message || String(e))); });
      return;
    }
    if (t.id === "sbLogout") {
      if (!confirm("로그아웃하면 이 기기에서 넷가·숙소 원가·계좌가 잠기고, 다시 로그인해야 견적을 낼 수 있습니다." + (state.bookings.length ? " (이 기기의 장부는 그대로 남습니다)" : "") + " 로그아웃할까요?")) return;
      var tk = sess && sess.access_token; setSess(null); sync.msg = ""; store.set("pkey", null);
      var bye = function () { if (PRIV.remote) location.reload(); else render(); };
      if (tk) fetch(CFG.url + "/auth/v1/logout", { method: "POST", headers: { apikey: CFG.key, Authorization: "Bearer " + tk } }).then(bye, bye); else bye(); return;
    }
    if (t.id === "privRetry") { loadPrivate(true); return render(); }
    if (t.id === "sbSync") { doSync(); return; }
    if (t.id === "exportBk") { var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(state.bookings, null, 1)], { type: "application/json" })); a.download = "philboard-backup-" + today() + ".json"; a.click(); }
  });
  /* 한글 입력(조합) 중에는 화면을 다시 그리지 않는다 — 다시 그리면 입력칸이 새로 바뀌어 'ㅎㅗㅍ'처럼 자모가 낱자로 떨어진다. 조합이 끝나면(compositionend) 한 번 반영한다 */
  var SEARCH_IDS = { q: function (v) { state.q = v; }, libQ: function (v) { state.libQ = v; }, ledQ: function (v) { state.led.q = v; } };
  document.addEventListener("compositionend", function (ev) {
    var t = ev.target; if (!t || !SEARCH_IDS[t.id]) return;
    SEARCH_IDS[t.id](t.value); rerenderKeep(t.id);
  });
  document.addEventListener("input", function (ev) {
    var t = ev.target, d = t.dataset;
    if (SEARCH_IDS[t.id] && (ev.isComposing || ev.inputType === "insertCompositionText")) { SEARCH_IDS[t.id](t.value); return; }
    if (t.id === "q") { state.q = t.value; return rerenderKeep("q"); }
    if (t.id === "libQ") { state.libQ = t.value; return rerenderKeep("libQ"); }
    if (t.id === "ledQ") { state.led.q = t.value; return rerenderKeep("ledQ"); }
    if (d.out) { if (state.editedBase[d.out] == null) state.editedBase[d.out] = LASTGEN[d.out] != null ? LASTGEN[d.out] : ""; state.edited[d.out] = t.value; store.set("edited", state.edited); store.set("editedBase", state.editedBase); return; }
    if (d.c) { state.cust[d.c] = t.value; return refreshQuote(true); }
    if (d.k && t.tagName !== "SELECT") { state.cart[+d.e][d.k] = t.value; return refreshQuote(true); }
    if (d.s && t.tagName !== "SELECT") { var p = d.s.split("."); state.stay[p[0]][p[1]] = t.value; return save(); }
    if (d.rr) { var r = d.rr.split("."); state.stay.resort.rows[+r[0]][r[1]] = t.value; return save(); }
  });
  document.addEventListener("change", function (ev) {
    var t = ev.target, d = t.dataset;
    if (t.id === "importBk") { var bf = t.files && t.files[0]; t.value = ""; if (bf) { var fr = new FileReader(); fr.onload = function () { var j = null; try { j = JSON.parse(fr.result); } catch (e) { } importBk(j); }; fr.readAsText(bf); } return; }
    if (t.id === "okChk") { var oc = Stay.resort(); state.stay.resort.okSig = t.checked ? oc.sig : ""; save(); return render(); }
    if (d.q) { state.cart[+d.e].q[d.q] = +t.value; return refreshQuote(); }
    if (d.k && t.tagName === "SELECT") state.cart[+d.e][d.k] = t.value; /* 선택 칸(오전·오후, 짐 유무 등)은 여기서 저장한다 — input 쪽은 글자 칸만 처리 */
    if (d.k || d.c) return refreshQuote();
    if (t.id === "rate") { state.rate = +t.value || S.pesoRate; return refreshQuote(); }
    if (t.id === "fx") { state.fx = +t.value || S.usdRate; state.fxInfo.manual = true; save(); return render(); }
    if (t.id === "useContact") { state.cust.useContact = t.checked; if (!t.checked) state.cust.contact = ""; return refreshQuote(); }
    if (t.id === "hotelSel") { loadHotel(t.value); save(); return render(); }
    if (t.id === "ledSort") { state.led.sort = t.value; return render(); }
    if (t.id === "ledShop") { state.led.shop = t.value; return render(); }
    if (d.s) { var p = d.s.split("."); state.stay[p[0]][p[1]] = t.value; if (d.s === "resort.cur") state.stay.resort.margin = ""; save(); return render(); }
    if (d.rr) { save(); return render(); }
  });
  state.cart = state.cart.filter(function (e) { return shopById(e.shopId); });
  autoDone();
  var dl = document.createElement("datalist"); dl.id = "places"; dl.innerHTML = (S.places || []).map(function (p) { return '<option value="' + esc(p) + '">'; }).join(""); document.body.appendChild(dl);
  var verEl = $("#ver"); if (verEl) verEl.textContent = "필보드 버전 " + (window.PB_BUILD === "dev" ? "개발용(이 PC)" : window.PB_BUILD) + " · 요금 자료 " + D.version;
  fxFetch();
  window.PB = { Calc: Calc, Text: Text, Stay: Stay, state: state, parsePaste: parsePaste, parseStayPaste: parseStayPaste, PRIV: PRIV, loadPrivate: loadPrivate, sync: sync, doSync: doSync, mergeRec: mergeRec };
  if (!PRIV.ok && (store.get("pkey", null) || (sb && sess))) { PRIV.loading = true; render(); loadPrivate(); } else render();
})();
