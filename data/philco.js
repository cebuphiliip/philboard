/* 필코 2026-27 호텔요금표(261116판) — 1박 룸+조식 성인 2인, 마크업 전. 필보드 견적에서 TMJ 와 비교해 '필코가 더 쌈' 배지를 띄우는 데만 쓴다(손님 글에는 안 나감).
   원본 references/필코/ , 비교표 references/필코_TMJ_요금비교_2026-11-16.md. 키 = TMJ 숙소 이름(hotels.js)과 객실 타입 글자 그대로.
   sur 를 쓰지 않으면 서차지는 TMJ 와 같다고 보고(필코 표와 대조 완료) TMJ 서차지를 그대로 쓴다. 갱신: 필코 새 표를 받을 때 이 파일만 고친다. */
window.PB_PHILCO = {
  date: "2026-11-16",
  hotels: {
    "SHANGRILA MACTAN": { ko: "샹그릴라 막탄", rooms: { "MACTAN SUITE": 21500, "VERANDA SUITE": 31500, "PANORAMA SUITE": 34000 },
      early: { "MACTAN SUITE": 19400, "VERANDA SUITE": 28400, "PANORAMA SUITE": 30700 }, earlyDays: 45,
      earlyNote: "샹그릴라 얼리버드(체크인 45일 전까지 예약·비수기 날짜만, 예약 시 'EARLY BIRD PKG' 기재)" },
    "DUSIT THANI (MIN.2N)": { ko: "두짓타니", rooms: { "DELUXE ROOM": 7500, "PREMIER ROOM": 10000, "DELUXE SEA VIEW": 11000, "PREMIER SEA VIEW": 13000, "DUSIT CLUB SEA VIEW": 14000 },
      hot: "★ 사장님 지시(11-16): 두짓타니 견적은 필코가 전 객실 800페소 싸다는 점을 꼭 말한다. 갈라(12/31 성인 8,000/아동 4,000)·12/31 체크인·체크아웃 불가 조건은 TMJ와 같음." },
    "CEBU WHITE SANDS": { ko: "화이트샌드", rooms: { "DELUXE": 5200, "GRAND LUXE": 5800, "GRAND LUXE PLUS": 6400, "PREMIER": 7500, "OCEAN VIEW SUITE": 9000, "FAMILY ROOM": 9800, "FAMILY SUITE": 14500 } },
    "WATERFRONT CEBU": { ko: "워터프론트 세부", rooms: { "STANDARD": 4100, "SUPERIOR": 4300, "DELUXE": 4500, "DELUXE PREMIUM": 4700, "PREMIER": 6800, "AMBASSADOR ROOM": 7100, "JUNIOR SUITE": 8200, "AMBASSADOR SUITE": 9700, "EXECUTIVE SUITE": 11200 } },
    "SOTO GRANDE": { ko: "소토그란데", rooms: { "DELUXE": 3300, "SUITE ROOM": 4300 } },
    "SHERATON MACTAN": { ko: "쉐라톤 막탄", rooms: { "COURTYARD VIEW": 12400, "OCEAN VIEW": 14400 } },
    "MOVENPICK HOTEL": { ko: "뫼벤픽", rooms: { "DELUXE ATRIUM": 6500, "DELUXE SEAVIEW": 7500, "SUITE KING ATRIUM": 11000 } },
    "MARIBAGO BLUEWATER": { ko: "마리바고 블루워터", rooms: { "DELUXE": 6900, "EXECUTIVE DELUXE": 7200, "AMUMA SPA SUITE": 8200, "PREMIER DELUXE": 8700, "JUNIOR SUITE": 14200, "ROYAL BUNGALOW": 15200 } },
    "THE REEF": { ko: "더리프", rooms: { "DELUXE": 8400, "DELUXE PREMIUM": 10300, "PREMIER": 11200, "PREMIER SEAVIEW": 13300, "PREMIERE SEAVIEW W/ BALCONY": 16100, "JUNIOR SUITE": 23800, "THE REEF SUITE": 26000, "TWO BEDROOM SUITE": 29100 } },
    "JPARK ISLAND RESORT (MIN. 2N)": { ko: "제이파크", rooms: { "DELUXE GARDENVIEW": 190, "DELUXE OCEANVIEW": 210, "MACTAN SUITE GARDENVIEW": 240, "MACTAN SUITE OCEANVIEW": 260, "PORORO": 335, "PORORO OCEANVIEW": 345, "CEBU SUITE GARDENVIEW": 360, "CEBU SUITE OCEANVIEW": 380, "POOL VILLA": 345 } },
    "BAI HOTEL": { ko: "바이 호텔", rooms: { "DELUXE": 4800, "PREMIER": 5800, "EXECUTIVE CLUB ROOM": 10500, "EXECUTIVE CLUB ONE BEDROOM SUITE": 12500 },
      sur: [{ from: "2026-12-23", to: "2026-12-25", amt: 1000 }, { from: "2026-12-30", to: "2027-01-01", amt: 1000 }, { from: "2027-01-15", to: "2027-01-17", amt: 1000 }, { from: "2027-02-05", to: "2027-02-06", amt: 1000 }] },
    "TAMBULI RESORT": { ko: "탐블리", rooms: { "DELUXE STUDIO": 7400, "ONE BEDROOM SUITE": 9400, "ONE BEDROOM PREMIER SUITE": 11400 } },
    "SOLEA MACTAN": { ko: "솔레아 막탄", rooms: { "PREMIER CITY": 4500, "PREMIER POOLVIEW": 4700, "PREMIER SEAVIEW": 5000, "CLASSIC SUITE": 8800, "SOLEA SUITE": 10500 } }
  }
};
