/* 필보드 업체 데이터 — 업체 추가·삭제·요금 변경은 이 파일만 고친다.
   요금 한 칸: { dep: 예약금(원), on: 현장결제(페소), usd: 현장결제(달러), pre: 예약 시 완납(달러) }  없는 값은 생략
   null = 요금을 여기서 계산하지 않음(업체 안내·상담 때 확인)
   off = 공식 요금(손님이 업체에 직접 예약할 때) / sp = 투윙스 스페셜 / net = 업체 넷가(화면·업체 전달폼에만 쓰임, 손님 글에 안 나감)
   net 이 없으면 '예약금 = 투윙스 수익, 현장결제 = 업체 몫'으로 계산한다.  noNet:true = 수익 구조를 아직 안 넣은 업체(수익 계산 제외)
   after: customer_channel(손님이 업체 채널로 연락) | vendor_contacts(업체가 손님께 직접 연락)
          | owner_relays(업체→사장님→손님 전달) | pickup_info(전날 픽업 차량 정보 안내) | afterText(직접 쓴 문장)  */
(function () {
  var P = function (dep, on) { return { dep: dep, on: on }; };
  /* 60·90·120분 코스를 한 줄로 적기: m3("aroma","아로마", [공식60,90,120], [[예약금,현장]×3]) — 없는 시간은 null */
  function m3(key, label, off, sp, mins) {
    mins = mins || [60, 90, 120];
    var out = [];
    mins.forEach(function (mn, i) {
      if (sp[i] == null) return;
      out.push({ key: key + mn, label: label + " " + mn + "분", off: off && off[i] != null ? (typeof off[i] === "number" ? { on: off[i] } : off[i]) : null, sp: typeof sp[i] === "number" ? { on: sp[i] } : { dep: sp[i][0], on: sp[i][1] } });
    });
    return out;
  }
  function krw3(key, label, sp, net) { return [60, 90, 120].map(function (mn, i) { return sp[i] == null ? null : { key: key + mn, label: label + " " + mn + "분", off: null, sp: { dep: sp[i] }, net: net && net[i] != null ? { on: net[i] } : undefined }; }).filter(Boolean); }
  var cat = function (n) { return "https://cafe.naver.com/freetourincebu/" + n; };

  window.PB_DATA = {
    version: "2026-11-11e",
    priceDate: "2026년 11월 10일",
    settings: {
      brand: "투윙스/솔타나",
      usdRate: 1370, usdSpread: 0.0175, // 달러→원 환산: 자동으로 못 받을 때 쓰는 기본값 / 현찰 살 때 가산율(기준환율 대비 1.75%)
      pesoRate: 23, // 페소→원 환산(클럽세부처럼 현장결제분을 원화로 미리 받는 곳에만 사용). 화면에서 수정 가능
      accounts: {
        krw: "케이뱅크 100126970158 (예금주 정봉규)",
        php: ["지캐시(GCash) 09951140366 (bongkyu jung)", "BDO 001180138013 (bongkyu jung)"]
      },
      channel: "http://pf.kakao.com/_xfhWdG/chat",
      /* 픽업·드랍 칸을 누르면 뜨는 자주 가는 장소. 추가·삭제는 여기서 */
      places: ["솔타나콘도텔", "제이파크", "샹그릴라 막탄", "쉐라톤 막탄", "뫼벤픽", "두짓타니", "크림슨", "플랜테이션베이", "마리바고 블루워터", "솔레아", "코스타벨라", "화이트샌즈", "비 리조트 막탄", "막탄 뉴타운", "막탄공항", "라움스파"]
    },
    categories: ["호핑", "마사지", "해양스포츠", "투어", "골프", "차량", "식당·공연·촬영"],
    forms: {
      /* 업체 전달폼 양식: [표시 이름, 값 키].  값 키는 app.js 의 vendorValue() 가 채운다 */
      hopping: { title: "{shop}", lines: [["호핑날짜", "date"], ["대표자", "name"], ["총인원", "total"], ["성인인원", "q:adult"], ["아동인원", "q:child+ages"], ["영아인원", "q:infant"], ["픽업장소", "pickup"], ["드랍장소", "drop"], ["연락처/카카오톡ID", "contact"], ["기타", "pay+note"]] },
      bluewave: { title: "{shop}", lines: [["호핑날짜", "date"], ["오전/선셋", "time"], ["대표자", "name"], ["인원", "paxline"], ["픽업장소", "pickup"], ["드랍장소", "drop"], ["연락처/카카오톡ID", "contact"], ["기타", "pay+note"]] },
      hanbada: { title: "[⚓세부 한바다 호핑 예약서⚓]", lines: [["✔ 투어 날짜", "date"], ["✔ 선샤인(오전) or 선셋(오후)", "time"], ["✔ 대표자 성함", "name"], ["✔ 연락처/카카오톡ID", "contact"], ["✔ - 중고생~성인 인원", "q:adult"], ["     - 24개월~초등생 인원", "q:child+ages"], ["     - 24개월 미만 인원", "q:infant"], ["✔ 픽업/드랍 위치", "pickup/drop"], ["✔ 특이사항", "pay+note"]] },
      gold: { title: "<골드호핑 호핑투어 예약서>", lines: [["✓호핑투어 신청날짜", "date"], ["✓예약자분 성함", "name"], ["✓연락처 or 카카오톡ID", "contact"], ["✓총 인원 및 남/여 성별", "total+pax"], ["✓픽업 장소", "pickup"], ["✓드랍 장소", "drop"], ["✓기타 문의사항", "pay+note"]] },
      nolja: { title: "놀자호핑투어", lines: [["날짜", "date"], ["골핑/놀핑선택", "time"], ["대표자이름", "name"], ["인원", "paxline"], ["연락처", "phone"], ["카톡아이디", "contact"], ["픽업호텔", "pickup"], ["드랍호텔", "drop"], ["캐리어 보관 유/무", "luggage"], ["결제", "pay+note"]] },
      sunma: { title: "★ sunma hopping ★", lines: [["성함", "name"], ["인원수", "paxline"], ["투어날짜", "date"], ["픽업장소", "pickup"], ["드랍장소", "drop"], ["특이사항", "note"], ["현지결제", "onsite"], ["연락처", "contact"]] },
      clubcebu: { title: "클럽세부호핑", lines: [["투어날짜", "date"], ["대표자분 성함 & 연락처", "name+contact"], ["픽드랍지", "pickup/drop"], ["예약자 모두 영문이름·생년월일·성별", "roster"], ["결제금액", "pay+note"]] },
      weocean: { title: "★위오션 빠지 예약★", lines: [["예약일정", "date"], ["예약자명", "name"], ["예약인원", "paxline"], ["픽업장소", "pickup"], ["추가상품", "option"], ["드랍장소", "drop"], ["★결제금액★", "pay"], ["★특이사항★", "note"]] },
      activity: { title: "{shop}", lines: [["이용날짜", "date"], ["희망시간", "time"], ["대표자", "name"], ["연락처/카카오톡ID", "contact"], ["이용 상품·인원", "courses"], ["픽업장소", "pickup"], ["드랍장소", "drop"], ["기타", "pay+note"]] },
      massage: { title: "{shop}", lines: [["마사지날짜", "date"], ["대표자성함", "name"], ["인원(마사지종류&시간)", "courses"], ["픽업장소(픽업시간)", "pickup+time"], ["드랍장소", "drop"], ["특이사항", "pay+note"]] },
      oceanspa: { title: "오션스파", lines: [["A.예약자명 & 인원", "name+total"], ["B.예약날짜 & 마사지시작시간", "date+start"], ["C.픽업장소 & 시간", "pickup+time/"], ["D.드랍장소 & 시간", "drop+after"], ["E.마사지종류 및 시간&네일서비스종류", "courses"], ["F.기타요청사항", "pay+note"]] },
      acecrab: { title: "에이스크랩 예약안내(본점)", lines: [["예약자분 성함", "name"], ["인원(성인+아이)", "paxline"], ["예약 날짜", "date"], ["픽업시간", "time"], ["픽업장소", "pickup"], ["드랍장소", "drop"], ["메뉴", "option"], ["요청사항", "note"]] },
      biwon: { title: "비원레스토랑 예약안내", lines: [["예약자분 성함", "name"], ["이용 날짜", "date"], ["이용 시간", "time"], ["인원(성인+아동)", "paxline"], ["요청사항", "note"]] },
      show: { title: "어메이징쇼", lines: [["공연날짜", "date+time"], ["대표자성함", "name"], ["인원", "paxline"], ["특이사항&결제금액", "showpay+note"]] },
      lokal: { title: "로컬페이지 양식입니다!", lines: [["대표자분성함", "name"], ["휴대폰번호", "phone"], ["총인원", "total+pax"], ["영문이름·생년월일(전원)", "roster"], ["투어종류", "option"], ["투어날짜", "date"], ["픽업장소", "pickup"], ["드랍장소", "drop"], ["조인/단독", "time"], ["비고", "note"]] },
      airport: { title: "공항픽업 예약(놀러와)", lines: [["픽업날짜", "date"], ["항공편명", "option"], ["도착시간", "time"], ["대표자", "name"], ["연락처/카카오톡ID", "contact"], ["차량", "courses"], ["드랍장소", "drop"], ["인원·캐리어·기타", "note"]] },
      golf: { title: "골프 예약", lines: [["라운딩 날짜", "date"], ["희망 티업 시간", "time"], ["대표자", "name"], ["연락처/카카오톡ID", "contact"], ["골프장·인원", "courses"], ["픽업장소", "pickup"], ["드랍장소", "drop"], ["기타", "note"]] },
      friends: { title: "세친구투어 — 사이트 신청서에 넣을 내용", lines: [["투어날짜", "date"], ["투어종류", "option"], ["대표자", "name"], ["연락처/카카오톡ID", "contact"], ["인원", "paxline"], ["픽업장소", "pickup"], ["드랍장소", "drop"], ["캐리어 개수 등", "note"]] }
    },
    shops: [
      { id: "hanbada", name: "한바다 호핑", cat: "호핑", form: "hanbada", after: "customer_channel", channel: "http://pf.kakao.com/_NpVlxj", channelName: "위오션(한바다 통합)",
        tagline: "새 방카(화장실·스모킹룸)로 진행하는 막탄 선샤인·선셋 조인 호핑. 제트스키·바비큐 포함.",
        post: cat(1421), timeOptions: ["선샤인(오전)", "선셋(오후)"],
        refund: "15일 전 예약금 100% · 7일 전 50% · 6일 전부터 당일·노쇼 환불 불가",
        memo: "라온스퀘어가 위오션·한바다를 인수해 상담 채널이 위오션 채널 하나로 통합됨. 키즈용 시스쿠터 아동 2인 1대 무료 대여. 베이비시터·호핑스텝 추가 1인 600페소, 싱글예약 차지 1인 700페소.",
        items: [
          { key: "adult", label: "성인(중학생~)", off: P(15000, 2700), sp: P(10000, 2700) },
          { key: "child", label: "아동(24개월~초등)", off: null, sp: P(0, 2700) },
          { key: "infant", label: "영아(24개월 미만)", off: P(0, 0), sp: P(0, 0) }
        ] },
      { id: "hoppingtayo", name: "호핑따요", cat: "호핑", form: "hopping", after: "vendor_contacts",
        tagline: "힐룽뚱안·날루수안 스노클링에 선상 바비큐 점심이 포함된 막탄 출발 조인 호핑.",
        post: cat(1422),
        memo: "해양스포츠(체험다이빙·패러세일링) 추가는 권하지 않는다.",
        items: [
          { key: "adult", label: "성인", off: P(0, 3500), sp: P(10000, 3000) },
          { key: "child", label: "아동(24개월~초4)", off: P(0, 2900), sp: P(0, 2700) },
          { key: "infant", label: "영아(24개월 미만)", off: P(0, 0), sp: P(0, 0) }
        ] },
      { id: "clubcebu", name: "클럽세부 호핑(옥택연호핑)", cat: "호핑", form: "clubcebu", after: "vendor_contacts", prepayOnsite: true,
        tagline: "마리바고 출발 럭셔리 요트 호핑. 선상 클럽파티와 칵테일쇼가 있는 프리미엄 조인 투어.",
        post: cat(1423),
        refund: "7일 전 100% · 4~6일 전 50% · 3일 전~당일 환불 불가(예약금+사전결제분 전체 기준). 악천후·최소 인원 미달 취소는 전액 환불",
        memo: "현장결제분도 원화로 환산해 예약금과 함께 미리 받는 유일한 업체(1페소 = 23원 기준, 입금 때 정확한 금액 재확인). 예약자 전원 영문이름·생년월일·성별 필요.",
        items: [
          { key: "adult", label: "성인", off: P(20000, 4300), sp: P(10000, 4200) },
          { key: "child", label: "아동", off: P(10000, 3900), sp: P(5000, 3800) }
        ] },
      { id: "haejeok", name: "해적호핑", cat: "호핑", form: "hopping", after: "vendor_contacts",
        tagline: "Club Kontiki에서 출발하는 블랙펄 해적선 투어. 선상 런치와 폼파티가 포함됩니다.",
        post: cat(1428),
        refund: "8일 전 100% · 7~5일 전 50% · 4일 전~당일 환불 불가(예약금 기준)",
        memo: "성인·아동 요금 동일, 24개월 미만 무료. 1인 단독 예약 불가. 직세일 4,800페소는 내부 참고용(손님 글에는 사이트 공식가를 쓴다).",
        items: [
          { key: "adult", label: "성인", off: P(35000, 3400), sp: P(10000, 4000), net: P(0, 4000) },
          { key: "child", label: "아동", off: P(35000, 3400), sp: P(10000, 4000), net: P(0, 4000) },
          { key: "infant", label: "영아(24개월 미만)", off: P(0, 0), sp: P(0, 0) }
        ] },
      { id: "gold", name: "골드호핑", cat: "호핑", form: "gold", after: "vendor_contacts",
        tagline: "선상 바비큐와 색소폰 공연, 제트스키 무료 체험이 포함된 막탄 조인 호핑.",
        post: cat(1429),
        refund: "업체 규정에 따릅니다(예약금 기준).",
        memo: "넷가에 예약금이 있다(성인 2만·아동 5천) — 손님 예약금 중 넷가 예약금은 사장님이 골드호핑에 입금하고 차액이 수익. 업체가 손님 카톡으로 바우처·차량 정보를 직접 보낸다(카톡 ID 검색 허용 필수). 성별 구성이 필요하면 특이사항에 적는다.",
        items: [
          { key: "adult", label: "성인", off: P(35000, 3000), sp: P(30000, 3000), net: P(20000, 3000) },
          { key: "child", label: "아동", off: P(10000, 3000), sp: P(5000, 3000), net: P(5000, 3000) }
        ] },
      { id: "sunma", name: "썬마호핑", cat: "호핑", form: "sunma", after: "customer_channel", channel: "http://pf.kakao.com/_yxlYLb",
        tagline: "판다논 섬과 힐룽뚱안 스노클링, 카바나 레스토랑 점심이 포함된 막탄 조인 호핑.",
        post: cat(1430),
        refund: "7일 전까지 취소 시 예약금 전액 환불",
        memo: "영아 전담 시터 요청 시 700페소.",
        items: [
          { key: "adult", label: "성인", off: P(25000, 3000), sp: P(10000, 3500) },
          { key: "child", label: "아동(24개월~)", off: P(0, 3000), sp: P(0, 2700) },
          { key: "infant", label: "영아(24개월 미만)", off: P(0, 0), sp: P(0, 0) }
        ] },
      { id: "nolja", name: "놀자호핑 골핑투어", cat: "호핑", form: "nolja", after: "vendor_contacts",
        tagline: "막탄 점심 맛집 식사가 포함된 호핑. 힐룽뚱안·산비센테 스노클링과 줄낚시를 즐깁니다.",
        post: cat(1431), timeOptions: ["골핑"],
        memo: "성인 = 11세 이상, 아동 = 24개월~10세. 놀핑(점심 미포함)은 요금 미지정. 성별 구성이 필요하면 특이사항에 적는다.",
        items: [
          { key: "adult", label: "성인(11세~)", off: P(20000, 2900), sp: P(10000, 3000) },
          { key: "child", label: "아동(24개월~10세)", off: P(0, 2500), sp: P(0, 2200) }
        ] },
      { id: "dfree", name: "디프리호핑", cat: "호핑", form: "hopping", after: "vendor_contacts",
        tagline: "선상 무제한 맥주와 바비큐, 힐룽뚱안·산비센테 스노클링이 포함된 올데이 호핑.",
        post: cat(1437),
        refund: "7일 전까지 100% · 6~4일 전 50% · 3일 전~당일 환불 불가(예약금 기준)",
        items: [
          { key: "adult", label: "성인", off: P(15000, 3000), sp: P(10000, 3000) },
          { key: "child", label: "아동(25개월~만 12세)", off: P(5000, 2800), sp: P(0, 2800) }
        ] },
      { id: "amsterdam", name: "암스테르담 호핑", cat: "호핑", form: "hopping", after: "vendor_contacts", needContact: true,
        tagline: "세부 막탄에서 오래 사랑받아 온 조인 호핑. 일정과 안내가 꼼꼼한 업체입니다.",
        post: cat(1355),
        memo: "업체가 손님께 직접 연락하므로 카톡 ID 또는 한국 연락처가 반드시 필요하다. 2017년생 이상은 성인 요금. 영아 전담 시터 요청 시 700페소.",
        items: [
          { key: "adult", label: "성인(2017년생 이상)", off: { dep: 72500 }, sp: P(10000, 2600) },
          { key: "child", label: "아동(25개월~2018년생)", off: { dep: 57000 }, sp: P(10000, 1900) },
          { key: "infant", label: "영아(24개월 미만)", off: P(0, 0), sp: P(0, 0) }
        ] },
      { id: "bluewave", name: "블루웨이브 호핑", cat: "호핑", form: "bluewave", after: "owner_relays",
        tagline: "힐튼 선착장에서 출발하는 막탄 호핑. 오전(5~6시간, 점심·섬 입장료 포함)과 선셋(3시간) 두 가지입니다.",
        post: cat(1345), timeOptions: ["오전 호핑(오전 9시 출발)", "선셋 호핑(오후 3시 출발)"],
        memo: "업체가 사장님께 상세 안내를 주면 사장님이 손님께 전달한다. 아동은 만 3~12세. 선셋만 픽드랍을 안 쓰면 성인 200·아동 100페소 할인(오전은 할인 없음). 직접 오면 오전 8:50·오후 2:50까지 힐튼 선착장.",
        items: [
          { key: "amAdult", label: "오전 성인", off: P(0, 3500), sp: P(10000, 2300) },
          { key: "amChild", label: "오전 아동(만 3~12세)", off: P(0, 2450), sp: P(10000, 1700) },
          { key: "ssAdult", label: "선셋 성인", off: P(0, 3000), sp: P(10000, 1700) },
          { key: "ssChild", label: "선셋 아동(만 3~12세)", off: P(0, 2100), sp: P(10000, 1200) }
        ] },
      { id: "weocean", name: "위오션 정어리떼 숏호핑", cat: "해양스포츠", form: "weocean", after: "customer_channel", channel: "http://pf.kakao.com/_NpVlxj", optionLabel: "추가 상품",
        tagline: "정어리 떼 포인트에서 즐기는 간편한 빠지 스노클링. 짧은 일정에도 넣기 좋습니다.",
        post: cat(1593),
        refund: "7일 전 100% · 2~6일 전 50% · 당일·노쇼 환불 불가, 천재지변 전액 환불(예약금 기준)",
        memo: "12월 1일 이후 예약 기준 요금. 11월 30일까지 예약분은 이벤트(보증금 2만원 + 현장 500페소) — 필요 시 금액을 직접 고쳐 쓴다.",
        items: [
          { key: "adult", label: "입장권(1인)", off: P(5000, 790), sp: P(3000, 750) }
        ] },
      { id: "seaair", name: "씨에어다이브", cat: "해양스포츠", form: "activity", after: "owner_relays",
        tagline: "체험 스쿠버다이빙·헬멧다이빙·파라세일링·제트보트·제트스키를 한곳에서. 체험다이빙은 픽업·드랍 포함.",
        post: cat(1540),
        memo: "현장결제는 달러. 예약금은 제트스키만 1대당, 나머지는 1인당. 2026-10-28 기준. 예약금이 수익이고 현장결제 금액이 넷가. 사장님이 손님께 연락한다. 스쿠버 외 종목의 픽드랍은 종류·인원에 따라 달라 문의. 환불 규정은 쓰지 않는다.",
        items: [
          { key: "scuba", label: "체험 스쿠버다이빙(1인)", off: null, sp: { dep: 10000, usd: 40 } },
          { key: "helmet", label: "헬멧다이빙(1인)", off: null, sp: { dep: 10000, usd: 35 } },
          { key: "para", label: "파라세일링(1인)", off: null, sp: { dep: 10000, usd: 33 } },
          { key: "jetboat", label: "제트보트(1인)", off: null, sp: { dep: 10000, usd: 33 } },
          { key: "jetski", label: "제트스키(1대 15분)", unit: "대", off: null, sp: { dep: 10000, usd: 17 } }
        ] },
      { id: "bigboss", name: "빅보스다이브(SSI 교육)", cat: "해양스포츠", form: "activity", after: "owner_relays",
        tagline: "SSI 오픈워터·어드밴스 자격증 교육(각 2일). 빅보스 리조트 숙박을 추가하면 공항 픽업과 식사가 포함됩니다.",
        post: cat(1541),
        memo: "업체 세일가와 넷가의 차액은 과정당 30달러(오픈워터+어드밴스 60달러) — 그중 20달러(40달러)가 수익, 10달러(20달러)는 손님 할인. 숙박 추가는 수익 없음. 사장님이 손님께 연락한다. 예약 시 달러 완납. 만 10~15세 주니어 +50달러, 만 10세 미만 불가. 싱글차지 1박 30달러. 2026-10-28 기준.",
        items: [
          { key: "ow", label: "오픈워터(2일)", off: { pre: 290 }, sp: { pre: 280 }, net: { pre: 260 } },
          { key: "adv", label: "어드밴스(2일)", off: { pre: 290 }, sp: { pre: 280 }, net: { pre: 260 } },
          { key: "owadv", label: "오픈워터+어드밴스", off: { pre: 570 }, sp: { pre: 550 }, net: { pre: 510 } },
          { key: "stay2", label: "숙박 추가 2박(1과정)", off: null, sp: { pre: 80 }, net: { pre: 80 } },
          { key: "stay4", label: "숙박 추가 4박(오픈+어드)", off: null, sp: { pre: 160 }, net: { pre: 160 } }
        ] },
      { id: "raum", name: "라움스파", cat: "마사지", form: "massage", after: "pickup_info",
        tagline: "전 객실 개별 화장실·샤워실을 갖춘 신축 프리미엄 스파. 마리바고에서 차로 3분 거리입니다.",
        post: cat(1312),
        refund: "업체 환불 규정에 따릅니다.",
        memo: "무료 픽업(막탄섬 내): 60분 4인 이상, 90분·120분 2인 이상. 시터 60분 100·90분 150·120분 200페소.",
        items: [].concat(
          m3("shiatsu", "시아추 건식", [1400, 1800, 2300], [[10000, 700], [12000, 850], [15000, 1100]]),
          m3("aroma", "아로마 오일", [1400, 1800, 2300], [[10000, 700], [12000, 850], [15000, 1100]]),
          m3("preg", "임산부(4~9개월)", [1600, 2000, 2500], [[10000, 800], [12000, 900], [15000, 1200]]),
          m3("sun", "썬번 진정", [1800, 2000, 2500], [[10000, 800], [12000, 1000], [15000, 1300]]),
          m3("kids", "키즈", [900, 1400, 1800], [[10000, 700], [10000, 850], [10000, 1100]]),
          m3("foot", "발 마사지", [1100, 1600, null], [[10000, 700], [10000, 850], null]),
          m3("stone", "핫스톤", [null, 2300, 2700], [null, [15000, 1200], [15000, 1600]]),
          m3("four", "포 핸즈", [null, 2500, 3000], [null, [10000, 2000], [10000, 2400]]),
          [{ key: "season150", label: "포 시즌 150분", off: { on: 3800 }, sp: P(20000, 2000) }]) },
      { id: "eco", name: "에코스파", cat: "마사지", form: "massage", after: "pickup_info",
        tagline: "막탄 공항 로드의 스파. 아로마부터 라바스톤·태반 코스까지 합리적인 요금으로 즐길 수 있습니다.",
        post: cat(1484),
        refund: "업체 환불 규정에 따릅니다.",
        memo: "출국일 공항 드랍 무료는 4명 90분부터.",
        items: [
          { key: "aroma90", label: "아로마 90분", off: { on: 1500 }, sp: P(10000, 800) },
          { key: "grow90", label: "아동 성장 90분", off: { on: 1500 }, sp: P(10000, 800) },
          { key: "aroma120", label: "아로마 120분", off: { on: 1800 }, sp: P(10000, 1100) },
          { key: "grow120", label: "아동 성장 120분", off: { on: 1800 }, sp: P(10000, 1100) },
          { key: "lava90", label: "라바스톤 90분", off: { on: 1600 }, sp: P(13000, 900) },
          { key: "lava120", label: "라바스톤 120분", off: { on: 2000 }, sp: P(13000, 1200) },
          { key: "thai120", label: "타이 허벌 120분", off: { on: 2200 }, sp: P(13000, 1500) },
          { key: "placenta120", label: "태반 120분", off: { on: 2000 }, sp: P(13000, 1200) },
          { key: "season140", label: "포시즌 140분", off: { on: 2500 }, sp: P(13000, 1800) },
          { key: "lux150", label: "럭셔리 스파 150분", off: { on: 3500 }, sp: P(15000, 2500) }
        ] },
      { id: "hwaspa", name: "화스파", cat: "마사지", form: "massage", after: "pickup_info",
        tagline: "막탄 20년 전통의 스파. 핫스톤·밤부·아로마 코스를 예약금+현장결제 방식으로 저렴하게.",
        post: cat(1441),
        refund: "예약이 확정된 뒤에는 예약금 환불이 되지 않습니다.",
        memo: "픽업·드랍: 90분 이상 2인부터, 60분은 4인부터. 솔레아는 별도 비용, 샹그릴라는 로비 아래 주차장.",
        items: [].concat(
          m3("aroma", "아로마(오일)", [1000, 1400, 1800], [[10000, 500], [10000, 700], [10000, 1100]]),
          m3("shiatsu", "시아추(드라이)", [1000, 1400, 1800], [[10000, 500], [10000, 700], [10000, 1100]]),
          m3("stone", "핫스톤", [1500, 2000, 2500], [[15000, 600], [15000, 900], [15000, 1300]]),
          m3("bamboo", "밤부", [1500, 2000, 2500], [[15000, 800], [15000, 1100], [15000, 1400]]),
          [{ key: "season150", label: "포시즌 150분", off: { on: 3500 }, sp: P(20000, 1800) }]) },
      { id: "oceanspa", name: "오션스파", cat: "마사지", form: "oceanspa", after: "pickup_info", needStart: true, commission: 0.2,
        tagline: "24시간 운영하는 막탄 스파·네일. 투윙스 예약 시 수제 프리미어급 오일 업그레이드와 아이 머리땋기 무료.",
        post: cat(1538),
        memo: "예약금 없음 — 마사지 후 현장에서 페소 결제. 수익은 전체 금액의 20% 커미션. 이 업체만 마사지 시작 시간을 받는다. 픽드랍: 쉐라톤·뫼벤픽·파를라·공항 인근 한 팀 300페소, 세부시티 1~4명 900·5명 이상 1,200페소. 공항 드랍 셔틀(밤 9:30·10:30·11:30) 1인 100페소, 단독 차량 500페소. 발 30분 추가 350페소.",
        items: [].concat(
          m3("dry", "드라이", null, [850, 1100, 1300]), m3("aroma", "아로마 오일", null, [850, 1100, 1300]), m3("lotion", "아로마 로션", null, [850, 1100, 1300]),
          m3("foot", "발 마사지", null, [800, 1000, 1200]), m3("stone", "오션 스톤 테라피", null, [null, 1300, 1600]), m3("menso", "맨소레담 테라피", null, [1100, 1500, 1900]),
          m3("four", "포핸즈", null, [1500, 1800, 2200]), m3("aloe", "알로에베라 선번", null, [950, 1200, 1500]), m3("coco", "버진코코넛 오일", null, [950, 1200, 1500]),
          m3("preg", "임산부 버진코코넛", null, [1000, 1250, 1550]), m3("kids", "미취학 성장마사지", null, [600, 800, 1000])) },
      { id: "oasis", name: "오아시스스파", cat: "마사지", form: "massage", after: "pickup_info", commission: 0.2,
        tagline: "투윙스로 예약하면 전 메뉴 10% 할인. 예약금 없이 현장에서 페소·달러 현금으로 결제합니다.",
        post: cat(1442),
        memo: "수익은 전체 금액의 20% 커미션. 카드 결제 불가. 픽드랍: 제이파크 부근~푼타엥가뇨 가능, 세부시티·공항 픽업·코르도바·마리곤돈 불가, 솔레아·큐브나인·티샤인·플랜테이션베이·퍼시픽세부 불가. 공항 드랍은 밤 9시 이후 2~8명 500페소.",
        items: [].concat(
          m3("basic", "베이직(건식)", [1200, 1600, 2000], [1080, 1440, 1800]), m3("aroma", "트로피컬 아로마", [1200, 1600, 2000], [1080, 1440, 1800]),
          m3("combi", "콤비네이션", [1300, 1700, 2100], [1170, 1530, 1890]), m3("sig", "시그니처(코코넛오일)", [1300, 1700, 2100], [1170, 1530, 1890]),
          m3("cool", "쿨링케어(알로에)", [1300, 1700, 2100], [1170, 1530, 1890]), m3("preg", "임산부", [1300, 1700, 2100], [1170, 1530, 1890]),
          m3("stone", "스페셜 핫스톤", [null, 1800, 2200], [null, 1620, 1980]), m3("kids", "키즈 성장(만 10세 미만)", [700, 1000, null], [630, 900, null])) },
      { id: "elspa", name: "엘스파(엘프라자)", cat: "마사지", form: "massage", after: "pickup_info", vendorPay: "투윙스 선결제(월 정산) — 손님 현장결제 없음",
        tagline: "공항 근처 0.5박 패키지(웰컴팩·굿바이팩·항구팩·남부팩·공마팩)와 스톤·아로마 마사지. 전액 원화 사전결제.",
        post: cat(1515),
        memo: "투윙스가 전액 선결제 받고 업체와 월 정산. 넷가: 패키지 원화(웰컴 5만·그 외 4만), 마사지 페소(요금새로 엘프라자 네트가 문서). 패키지는 성인 2인 기준, 1인 이용 시 20,000원 추가. 120분 변경은 인당 700페소부터 추가. 아동 패키지·그 밖의 코스는 금액을 직접 고쳐 쓴다. 2026-10-25 기준.",
        items: [
          { key: "welcome", label: "웰컴팩(성인)", off: { dep: 70000 }, sp: { dep: 60000 }, net: { dep: 50000 } },
          { key: "goodbye", label: "굿바이팩(성인)", off: { dep: 60000 }, sp: { dep: 50000 }, net: { dep: 40000 } },
          { key: "port", label: "항구팩(성인)", off: { dep: 60000 }, sp: { dep: 50000 }, net: { dep: 40000 } },
          { key: "south", label: "남부팩(성인)", off: { dep: 60000 }, sp: { dep: 50000 }, net: { dep: 40000 } },
          { key: "gongma", label: "공마팩(성인)", off: { dep: 50000 }, sp: { dep: 50000 }, net: { dep: 40000 } }
        ].concat(krw3("aroma", "아로마", [17500, 23800, 31300], [700, 950, 1250]), krw3("dry", "드라이", [17500, 23800, 31300], [700, 950, 1250]), krw3("coco", "코코넛", [20000, 25000, 32500], [800, 1000, 1300]),
          krw3("grow", "성장 마사지", [15000, 17500, 25000], [600, 700, 1000]), krw3("black", "볼카닉 블랙 스톤", [null, 30000, 45000], [null, 1200, 1800]), krw3("pink", "히말라야 핑크 스톤", [null, 47500, 62500], [null, 1900, 2500]), krw3("preg", "임산부 전용", [20000, 30000, 40000], [800, 1200, 1600])) },
      { id: "friends", name: "세친구투어(남부투어)", cat: "투어", form: "friends", after: "vendor_contacts", needContact: true, noNet: true, optionLabel: "투어 종류(오캐모·오캐·오모 등)",
        askNote: "세친구투어는 아래 신청서를 작성해 제출해 주시면 업체에서 직접 연락드려 안내와 결제를 진행합니다.\nhttps://3friendstour.com/cebu_application.php?utm_source=CHANEL\n(오슬롭 패스트트랙·캐녀닝 사전예약 정보는 투어 3일 전까지 꼭 입력해 주세요.)",
        tagline: "오슬롭 고래상어·가와산 캐녀닝·모알보알을 조합한 남부투어 전문. 투윙스로 예약하면 투어 후 인당 5,000원 페이백.",
        post: cat(1408),
        memo: "요금은 업체 사이트 기준(여기서 계산하지 않음). 손님 연락처·픽드랍 장소·캐리어 개수를 확인해 폼을 넣으면 세친구가 손님께 직접 연락·안내·입금받는다. 보험 안내는 무시. 페이백은 체험다이빙 제외.",
        items: [
          { key: "adult", label: "성인", off: null, sp: null },
          { key: "child", label: "아동", off: null, sp: null }
        ] },
      { id: "lokal", name: "로컬페이지(남부·호핑·시티투어)", cat: "투어", form: "lokal", after: "vendor_contacts", needContact: true, noNet: true, optionLabel: "투어 종류(오캐투어 등)", timeOptions: ["조인", "단독"],
        tagline: "남부투어와 막탄 호핑·마사지를 한곳에서. 조인투어는 투윙스 예약 시 투어 후 인당 5,000원 페이백.",
        post: "https://lokalpagetour.com/cebu",
        memo: "요금은 업체 상품 페이지 기준. 업체가 손님께 직접 연락해 예약금(인당 16,000원 예시)·현장결제를 받는다. 단독투어 페이백은 1박2일 패키지·오슬롭+수밀론 데이유즈만. 전원 영문이름·생년월일 필요.",
        items: [
          { key: "adult", label: "성인", off: null, sp: null },
          { key: "child", label: "아동", off: null, sp: null }
        ] },
      { id: "acecrab", name: "에이스크랩", cat: "식당·공연·촬영", form: "acecrab", after: "pickup_info", noNet: true, optionLabel: "메뉴(예: 세트A 칠리소스)",
        tagline: "막탄 크랩 맛집. 세트 A·B와 한식 단품, 픽업·드랍 예약을 도와드립니다.",
        post: cat(1384),
        memo: "요금은 메뉴판 기준(여기서 계산하지 않음). 한식 단품 글 1473. 픽업 시간을 '시간' 칸에 적는다.",
        items: [
          { key: "adult", label: "성인", off: null, sp: null },
          { key: "child", label: "아이", off: null, sp: null }
        ] },
      { id: "cielo", name: "씨엘로 스파", cat: "마사지", form: "massage", after: "pickup_info",
        tagline: "모벤픽 근처의 스파. 업체 요금표보다 저렴하게, 예약금+현장결제 방식으로 예약해 드립니다. 오전 10시~밤 12시.",
        post: cat(1616),
        memo: "예약금이 수익, 현장결제 금액이 넷가(오후 2:30~밤 10:30 예약 기준). 손님가 = 업체 요금표 − 200페소. 성장 마사지·발 마사지는 커미션이 없어 예약 대행만. 솔타나는 거리가 멀어 픽드랍 불가. 오픈런 이벤트(10~14시)는 안내하지 않는다.",
        items: [].concat(
          m3("shiatsu", "시앗추", null, [[3000, 900], [7000, 1100], [12000, 1300]]),
          m3("swedish", "스웨디시", null, [[3000, 900], [7000, 1100], [12000, 1300]]),
          m3("aloe", "알로에베라", null, [null, [7000, 1200], [12000, 1400]]),
          m3("stone", "블랙스톤", null, [null, [7000, 1300], [12000, 1500]]),
          m3("herb", "허브볼", null, [null, [7000, 1300], [12000, 1500]]),
          m3("unique", "유니크 케어", null, [null, [7000, 1100], [12000, 1300]]),
          m3("four", "ALL 4 U 네손 마사지", null, [[3000, 1500], [7000, 1900], [12000, 2300]]),
          m3("sig", "씨엘로 시그니처", null, [[12000, 1900], [14000, 2400]], [120, 150])) },
      { id: "golf", name: "골프(5곳, 왕복 차량 포함)", cat: "골프", form: "golf", after: "owner_relays",
        tagline: "알타비스타·세부CC·클럽 필리피노·막탄 에어베이스·릴로안. 그린피와 왕복 차량이 포함된 18홀 1인 요금입니다.",
        post: cat(1332),
        memo: "수익은 인당 2만원(넷가 = 손님가 − 2만원). 2~3인은 승용차, 4~7인은 밴. 에어베이스는 전동카트 불포함, 세부CC는 캐디피 불포함(현장결제). 2026년 10월 기준 — 골프장 요금이 바뀌면 여기 금액도 고친다. 글: 알타비스타 1314·세부CC 1320·필리피노 1321·릴로안 1322·에어베이스 1323·선택형 1409.",
        items: (function () {
          var G = [["alta", "알타비스타", 185000, 230000, 177000, 222000], ["ccc", "세부CC", 138000, 185000, 133000, 180000], ["fil", "클럽 필리피노", 155000, 168000, 138000, 150000], ["air", "에어베이스", 118000, 133000, 113000, 128000], ["lilo", "릴로안", 130000, 130000, 122000, 122000]], out = [];
          G.forEach(function (g) {
            [["23wd", "2~3인 주중", 2], ["23we", "2~3인 주말", 3], ["47wd", "4~7인 주중", 4], ["47we", "4~7인 주말", 5]].forEach(function (v) {
              if (g[0] === "lilo" && /we$/.test(v[0])) return;
              out.push({ key: g[0] + v[0], label: g[1] + " " + (g[0] === "lilo" ? v[1].replace(" 주중", "(주중·주말 동일)") : v[1]), off: null, sp: { dep: g[v[2]] }, net: { dep: g[v[2]] - 20000 } });
            });
          });
          return out;
        })() },
      { id: "airport", name: "공항픽업(막탄공항 → 숙소)", cat: "차량", form: "airport", after: "pickup_info", optionLabel: "항공편명",
        tagline: "막탄공항에서 숙소까지 전용 차량 픽업. 1~3인은 이노바(SUV), 4~8인은 밴으로 진행합니다.",
        post: cat(1261),
        memo: "놀러와에 예약을 넣는다. 넷가 이노바 1,000페소·밴 1,300페소(투윙스가 정산). 도착 시간을 '시간' 칸에, 인원·캐리어 수는 특이사항에 적는다.",
        items: [
          { key: "innova", label: "이노바 SUV(1~3인)", unit: "대", off: null, sp: { pre: 40 }, net: { on: 1000 } },
          { key: "van", label: "밴(4~8인)", unit: "대", off: null, sp: { pre: 50 }, net: { on: 1300 } }
        ] },
      { id: "monument", name: "모뉴멘트세부(제이파크 스냅사진)", cat: "식당·공연·촬영", form: "activity", after: "owner_relays",
        tagline: "제이파크 안 사진 스튜디오의 웨딩·가족·허니문 스냅 촬영. 투윙스로 예약하시면 특별 혜택이 있습니다.",
        post: cat(1552),
        refund: "한 달 전 전액 · 한 달~7일 전 50% · 7일 이내 환불 불가. 7일 전까지 날짜 변경 무료. 우천으로 촬영이 불가하면 업체 안내에 따라 날짜 변경 또는 전액 환불",
        memo: "손님가는 업체 판매가와 동일(할인 표기 금지). 예약금(달러)이 수익, 현장결제가 넷가. 최소 예약일 없음. 가족 티셔츠는 손님 지참.",
        items: [
          { key: "wedA", label: "웨딩스냅 일반형(2시간)", unit: "건", off: null, sp: { pre: 100, usd: 200 } },
          { key: "wedB", label: "웨딩스냅 고급형(2시간)", unit: "건", off: null, sp: { pre: 200, usd: 500 } },
          { key: "wedC", label: "웨딩스냅 패키지형(5시간)", unit: "건", off: null, sp: { pre: 400, usd: 800 } },
          { key: "famA", label: "가족스냅 일반형(1시간)", unit: "건", off: null, sp: { pre: 50, usd: 100 } },
          { key: "famB", label: "가족스냅 고급형(2시간)", unit: "건", off: null, sp: { pre: 70, usd: 150 } },
          { key: "big", label: "대가족스냅(2시간)", unit: "건", off: null, sp: { pre: 100, usd: 250 } },
          { key: "remind", label: "부모님 리마인드웨딩(2시간)", unit: "건", off: null, sp: { pre: 100, usd: 350 } },
          { key: "honey", label: "허니문스냅(1시간)", unit: "건", off: null, sp: { pre: 100, usd: 100 } }
        ] },
      { id: "biwon", name: "비원레스토랑", cat: "식당·공연·촬영", form: "biwon", noNet: true, prepayOnsite: true, allPrepay: true,
        afterText: "★ 비원레스토랑 예약이 완료되었습니다.\n세트메뉴 금액은 전액 사전결제로 확인되었으며, 이용 당일 식당에서는 따로 결제하지 않으셔도 됩니다.",
        tagline: "메뉴 고민 없이 인기 메뉴로 구성한 추천 세트메뉴입니다. 1인 800페소, 만 2~11세 소아는 50% 할인된 400페소이며, 세트메뉴 금액 전액을 예약 시 미리 결제하셔야 합니다.\n① 갈릭 라이스(마늘 향 볶음밥)\n② 씨푸드 에그 드랍 스프(해산물과 달걀을 풀어 넣은 따뜻한 국물)\n③ 칠리 갈릭 버터 쉬림프(새우 요리)\n④ 판싯 귀사도(필리핀식 볶음국수)\n⑤ 모닝글로리 볶음(공심채 나물 볶음)\n⑥ 그릴 포크 벨리(구운 삼겹살)",
        post: cat(1301),
        memo: "세트메뉴만 받는다. 1인 800페소, 만 2~11세 소아 50% 할인(400페소). 전액 사전결제(페소 금액을 원화로 환산해 예약 시 받는다, 1페소=23원·입금 때 재확인). 세트 구성 6가지: ①갈릭 라이스(마늘 향 볶음밥) ②씨푸드 에그 드랍 스프(해산물과 달걀을 풀어 넣은 따뜻한 국물) ③칠리 갈릭 버터 쉬림프(새우 요리) ④판싯 귀사도(필리핀식 볶음국수) ⑤모닝글로리 볶음(공심채 나물 볶음) ⑥그릴 포크 벨리(구운 삼겹살). 세트 사진은 업체 제공(첨부). 넷가·수익은 아직 받은 값이 없다.",
        items: [
          { key: "adult", label: "성인(세트메뉴 1인)", off: null, sp: { dep: 0, on: 800, allPre: true } },
          { key: "child", label: "소아(만 2~11세, 50% 할인)", off: null, sp: { dep: 0, on: 400, allPre: true } }
        ] },
      { id: "show", name: "어메이징쇼", cat: "식당·공연·촬영", form: "show", timeOptions: ["1부쇼", "2부쇼"],
        afterText: "★ 어메이징쇼 예약이 완료되었습니다.\n티켓은 이용하실 솔타나 객실 안 테이블 위에 올려 두고, 미리 사진을 찍어 보내 드리겠습니다.",
        tagline: "세부에서 가장 핫한 관객 참여형 뮤지컬 쇼.",
        post: cat(981),
        memo: "전액 원화 결제(성인권 43,000원·아동권 20,000원). 넷가 성인 1,200페소·아동 600페소. 2부(저녁 8시 공연) 동선 글은 1603. 티켓 전달 방식은 솔타나 투숙 손님 기준이라 다른 숙소 손님은 문장을 고쳐 쓴다.",
        items: [
          { key: "adult", label: "성인권", off: null, sp: { dep: 43000 }, net: { on: 1200 } },
          { key: "child", label: "아동권", off: null, sp: { dep: 20000 }, net: { on: 600 } }
        ] }
    ],

    /* ---------- 숙소 계산 ---------- */
    stay: {
      resortMargin: { PHP: 400, USD: 10 }, // TMJ 요금에 붙이는 금액(룸당 1박)
      resortSteps: "👉 리조트·호텔 예약은 이 순서로 진행됩니다.\n① 저희가 리조트에 예약을 넣습니다.\n② 리조트가 컨펌을 주면서 옵션데이(결제 요청일)를 알려 줍니다.\n③ 그 날짜를 저희가 안내해 드립니다.\n④ 옵션데이 전까지는 원하시면 수수료 없이 취소하실 수 있습니다.\n⑤ 예약을 확정하시려면 옵션데이 전까지 전액 입금해 주세요.\n👉 결제 후에는 환불이 되지 않으니, 확실하실 때 결제 부탁드립니다.",
      /* 풀빌라: net = 넷가(달러, 1박). 공식 요금(직세일) = net+100, 투윙스 스페셜 = 공식 요금−50 (수익 50, 필요하면 40)
         출처: 바탕화면 요금새로\풀빌라 폴더 이름(2026-11-10). 이름·룸수·넷가가 다르면 여기만 고친다 */
      villaDirectAdd: 100, villaProfit: 50,
      villas: [
        { name: "VIP 풀빌라", rooms: "5+1룸", net: 400 },
        { name: "샤이닝 풀빌라", rooms: "5룸", net: 350 },
        { name: "소울풀(마리아루이사)", rooms: "4룸", net: 350 },
        { name: "아테네 풀빌라(구 이브닝)", rooms: "5룸", net: 400 },
        { name: "에델로 풀빌라", rooms: "6룸", net: 450, note: "조식 불포함" },
        { name: "포트 풀빌라", rooms: "6룸", net: 600 },
        { name: "까사델루나", rooms: "3룸", net: 200 },
        { name: "놀러와 풀빌라", rooms: "8룸", net: 400 },
        { name: "럭키 풀빌라(세인트마이클)", rooms: "5룸", net: 350 },
        { name: "망고그린 풀빌라", rooms: "10룸", net: 400 },
        { name: "산토니뇨 풀빌라", rooms: "5룸", net: 380 },
        { name: "쏘옹풀", rooms: "4룸", net: 400 },
        { name: "퍼플 풀빌라(마리아루이사)", rooms: "6룸", net: 550 },
        { name: "다이아몬드 풀빌라", rooms: "6룸", net: 450, note: "지하 수영장" },
        { name: "루비 풀빌라", rooms: "6룸", net: 400 },
        { name: "크리스탈 풀빌라", rooms: "4룸", net: 300 },
        { name: "럭시 풀빌라", rooms: "6룸", net: 550 }
      ],
      /* 솔타나: 달러, 객실당. 요금 3종(공식 / 프로모 / 더블프로모) */
      soltanaTiers: [
        { key: "official", name: "공식 요금", price: { in: 60, out: 50, inout: 110, room: 50 } },
        { key: "promo", name: "프로모", price: { in: 50, out: 40, inout: 80, room: 50 } },
        { key: "double", name: "더블프로모", price: { in: 50, out: 40, inout: 70, room: 50 } }
      ],
      /* pack = 요금표의 어느 팩 값을 쓰는지(in/out/inout), room = 룸온리 박수를 더하는지, times = 예약폼에 넣을 시간 칸 */
      soltana: [
        { key: "in", name: "입국팩", pack: "in", times: ["예상 체크아웃 시간"] },
        { key: "out", name: "출국팩", pack: "out", times: ["예상 체크인 시간"] },
        { key: "inout", name: "입국팩+출국팩", pack: "inout", times: ["입국팩 예상 체크아웃 시간", "출국팩 예상 체크인 시간"] },
        { key: "room", name: "룸온리", room: true, times: ["예상 체크인 시간", "예상 체크아웃 시간"] },
        { key: "in_room", name: "입국팩+룸온리", pack: "in", room: true, times: ["예상 체크아웃 시간"] },
        { key: "room_out", name: "룸온리+출국팩", pack: "out", room: true, times: ["예상 체크인 시간"] },
        { key: "in_room_out", name: "입국팩+룸온리+출국팩", pack: "inout", room: true, times: ["예상 체크아웃 시간(공항 출발)"] }
      ],
      soltanaMaxNights: 6, // 룸온리 최대 박수
      /* 추가 인원 요금(달러, 1인). 입국팩: 성인 20·아동 15(조식+엑스트라베드 포함) / 룸온리: 성인 1박 15(엑스트라베드만, 조식은 박당 인당 6 추가), 아동 추가금 없음 / 출국팩: 성인 20(엑스트라베드만), 아동 추가금 없음 */
      soltanaAdd: { in: { adult: 20, kid: 15 }, room: { adult: 15, kid: 0, breakfast: 6 }, out: { adult: 20, kid: 0 } },
      soltanaMaxPax: 5, soltanaStdPax: 4, // 객실당 최대 인원(좁아도 괜찮다는 손님만 5명) / 기준 최대 인원
      soltanaNote: "커뮤니티 시설 확충으로 수영장 이용 불가",
      /* 솔레아처럼 숙박 조건에 따라 인당 붙는 의무 요금: match = TMJ 호텔 이름에 들어 있는 글자 */
      mandatory: [
        { match: "SOLEA", minNights: 3, cur: "PHP", items: [{ name: "의무 석식 뷔페(1회)", adult: 800, child: 400 }, { name: "라군파크(워터파크) 1회", adult: 400, child: 200 }], note: "3박 이상 예약 시 적용(아동은 만 5~12세)" }
      ]
    },

    /* ---------- 상담 자료실: 손님께 바로 보낼 링크·문장. 추가는 여기에 한 줄 ---------- */
    library: [
      { cat: "통합버전", title: "풀빌라 통합버전", desc: "세부 단독 풀빌라를 지역·룸 수별로 한눈에 볼 수 있는 목록입니다. 풀빌라마다 상세 글로 이어집니다.", url: cat(1063) },
      { cat: "통합버전", title: "막탄 리조트 통합버전", desc: "막탄 지역 리조트를 한곳에 모은 목록입니다. 리조트마다 객실·시설 상세 글로 이어집니다.", url: cat(1114) },
      { cat: "통합버전", title: "세부호텔 통합버전", desc: "세부시티와 인근 호텔을 한곳에 모은 목록입니다. 호텔마다 상세 글로 이어집니다.", url: cat(1175) },
      { cat: "통합버전", title: "보홀 통합버전", desc: "보홀 지역 리조트·호텔을 한곳에 모은 목록입니다.", url: cat(1253) },
      { cat: "통합버전", title: "그외 지역 통합버전", desc: "보라카이·모알보알·팔라완 등 그 밖의 지역 숙소를 모은 목록입니다.", url: cat(1289) },
      { cat: "통합버전", title: "골프 통합버전", desc: "세부 골프장 5곳(알타비스타·세부CC·클럽 필리피노·에어베이스·릴로안)을 한눈에 비교하는 글입니다.", url: cat(1332) },
      { cat: "통합버전", title: "호핑 통합버전(10곳)", desc: "세부 막탄 호핑투어 10곳을 한곳에 모은 목록입니다. 업체마다 상세 글로 이어집니다.", url: cat(1439) },
      { cat: "통합버전", title: "호핑 상세 비교", desc: "호핑투어 업체별 코스·포함 사항을 나란히 비교한 글입니다.", url: cat(1440) },
      { cat: "통합버전", title: "협력업체 통합버전", desc: "마사지·호핑·해양스포츠·식당 등 투윙스 협력업체를 한곳에 모은 목록입니다.", url: cat(1596) },
      { cat: "상품·안내", title: "완벽자유팩 기본 상품", desc: "숙소와 즐길 거리를 한 번에 예약하는 완벽자유팩 기본 구성 안내입니다.", url: cat(1452) },
      { cat: "상품·안내", title: "예약·환불 안내", desc: "투윙스 예약 진행 순서와 환불 기준을 정리한 안내 글입니다.", url: cat(1270) },
      { cat: "상품·안내", title: "카페 활동 이벤트(입국팩+출국팩 $70)", desc: "카페 게시글 2개와 댓글 2개를 인증하시면 솔타나 입국팩+출국팩을 객실당 70달러에 이용하실 수 있습니다.", url: cat(1327) },
      { cat: "상품·안내", title: "공항픽업 요금 안내", desc: "막탄공항 픽업 요금과 포함 사항(야간·대기·톨비·팁)을 정리한 글입니다.", url: cat(1261) },
      { cat: "상품·안내", title: "렌트카 자유패키지(내맘대로 시티투어) 요금표", desc: "기사 포함 렌트카를 시간제로 이용하는 자유 패키지 요금표입니다.", url: cat(1534) },
      { cat: "상품·안내", title: "솔타나 입국팩·출국팩·룸온리 상세(카카오 채널)", desc: "솔타나콘도텔 입국팩·출국팩·룸온리의 포함 사항과 이용 방법 안내입니다.", url: "https://pf.kakao.com/_xfhWdG/102946397" },
      { cat: "맛집·식당", title: "맛집 48선 1부", desc: "세부·막탄 맛집 48곳 가운데 1부 24곳을 정리한 글입니다.", url: cat(1475) },
      { cat: "맛집·식당", title: "비원레스토랑 세트메뉴", desc: "비원레스토랑 세트메뉴 구성 안내입니다.", url: cat(1301) },
      { cat: "맛집·식당", title: "에이스크랩 세트 A·B", desc: "에이스크랩 세트 A·B 구성과 주방 마감 시간 안내입니다.", url: cat(1384) },
      { cat: "맛집·식당", title: "에이스크랩 한식 단품", desc: "에이스크랩의 한식 단품 메뉴 안내입니다.", url: cat(1473) },
      { cat: "골프장", title: "알타비스타", desc: "알타비스타 골프장 소개와 18홀 1인 요금(왕복 차량 포함) 안내입니다.", url: cat(1314) },
      { cat: "골프장", title: "세부CC", desc: "세부 컨트리 클럽 소개와 18홀 1인 요금(왕복 차량 포함) 안내입니다. 캐디피는 현장결제입니다.", url: cat(1320) },
      { cat: "골프장", title: "필리피노", desc: "클럽 필리피노 골프장 소개와 18홀 1인 요금(왕복 차량 포함) 안내입니다.", url: cat(1321) },
      { cat: "골프장", title: "릴로안", desc: "릴로안 골프장 소개와 18홀 1인 요금(왕복 차량 포함) 안내입니다.", url: cat(1322) },
      { cat: "골프장", title: "에어베이스", desc: "막탄 에어베이스 골프장 소개와 18홀 1인 요금(왕복 차량 포함) 안내입니다. 전동카트는 현장결제입니다.", url: cat(1323) },
      { cat: "골프장", title: "골프 선택형", desc: "골프장을 골라 일정에 넣는 선택형 골프 안내입니다.", url: cat(1409) },
      { cat: "그 밖의 업체", title: "어메이징쇼 — 예약 전에 다들 묻는 것", desc: "어메이징쇼 관람 연령, 1부·2부 선택, 일정에 넣는 방법을 정리한 글입니다.", url: cat(981) },
      { cat: "그 밖의 업체", title: "어메이징쇼 2부, 저녁 식사와 이동", desc: "저녁 8시 공연(2부)에 맞춰 식사와 이동 시간을 잡는 방법입니다.", url: cat(1603) },
      { cat: "그 밖의 업체", title: "씨엘로 스파", desc: "씨엘로 스파 코스와 예약금+현장결제 요금 안내입니다.", url: cat(1616) },
      { cat: "그 밖의 업체", title: "모뉴멘트세부 스냅사진(제이파크)", desc: "제이파크 안 스튜디오의 웨딩·가족·허니문 스냅 촬영 상품과 요금 안내입니다.", url: cat(1552) },
      { cat: "그 밖의 업체", title: "마리바고 블루워터 데이유즈", desc: "마리바고 블루워터 리조트 데이유즈 이용 안내입니다.", url: cat(1389) },
      { cat: "그 밖의 업체", title: "사파리 정보", desc: "세부 사파리 이용 정보 글입니다.", url: cat(1445) },
      { cat: "그 밖의 업체", title: "클럽세부 결제·환불 비교", desc: "클럽세부 호핑의 결제 방식과 환불 규정을 정리한 글입니다.", url: cat(1637) },
      { cat: "자주 쓰는 문장", title: "리조트·호텔 예약 순서", text: "👉 리조트·호텔 예약은 이 순서로 진행됩니다.\n① 저희가 리조트에 예약을 넣습니다.\n② 리조트가 컨펌을 주면서 옵션데이(결제 요청일)를 알려 줍니다.\n③ 그 날짜를 저희가 안내해 드립니다.\n④ 옵션데이 전까지는 원하시면 수수료 없이 취소하실 수 있습니다.\n⑤ 예약을 확정하시려면 옵션데이 전까지 전액 입금해 주세요.\n👉 결제 후에는 환불이 되지 않으니, 확실하실 때 결제 부탁드립니다." },
      { cat: "자주 쓰는 문장", title: "예약 확정 바우처 확인 요청(링크는 바꿔서)", text: "💌 아래 링크에서 [예약 확정 바우처]를 꼭 확인해 주시고, 댓글로 컨펌 부탁드립니다.\n(바우처 링크)\n✅ 바우처 확인 포인트\n√ 고객님의 정확한 예약 상세 내역\n√ 세부에서 즐기실 수 있는 다양하고 저렴한 추천 정보\n💡 안내 사항\n안전하고 원활한 일정을 위해, 함께 여행하시는 모든 일행분들과 이 링크를 꼭 공유해 주시기 바랍니다.\n여행을 준비하시면서 궁금하신 점이 생기면 언제든지 편하게 문의해 주세요." },
      { cat: "자주 쓰는 문장", title: "입금 계좌", text: "[한화 입금] 케이뱅크 100126970158 (예금주 정봉규)\n[페소 입금] 지캐시(GCash) 09951140366 (bongkyu jung) / BDO 001180138013 (bongkyu jung)" },
      { cat: "자주 쓰는 문장", title: "카카오톡 채널", text: "투윙스/솔타나 카카오톡 채널: http://pf.kakao.com/_xfhWdG/chat\n(카카오톡에서 '솔타나콘도텔'을 검색하셔도 됩니다.)" }
    ]
  };
})();
