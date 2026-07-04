/* ============================================================================
 *  CashMap × ADE  —  MOCK DATA LAYER
 * ----------------------------------------------------------------------------
 *  ⚠️  서버 연동 교체 지점
 *  이 파일의 모든 데이터는 "가상(MOCK)" 입니다. 실제 배포 시 아래 함수를
 *  REST/GraphQL 호출로 교체하세요. 컴포넌트는 window.ADE.* 만 참조하므로
 *  이 파일만 바꾸면 됩니다.
 *
 *    // 예시) 서버 연동
 *    window.ADE.loadDashboard = async () =>
 *      (await fetch('/api/v1/dashboard')).json();
 *
 *  스키마 (서버 응답이 맞춰야 할 형태):
 *    Company {
 *      id, name, sector, listed(boolean), parent(대기업 id), tier(1|2|3),
 *      dScore(0-100), grade('POSITIVE'|'NEGATIVE'|'MONITOR'),
 *      signal(0-100),                     // 신호 강도
 *      discrepancy(number, +면 숨은진주 / -면 거품),
 *      features: { patentCount, rndRatio, rndGrowth, marginSlope,
 *                  ipcEntropy, inventorGrowth, disclosureWill }  // 각 {raw, norm0-100}
 *      updatedAt(ISO), summary(string)
 *    }
 *    Conglomerate { id, name, sector, signal(0-100), filings(int), color? }
 * ========================================================================== */

(function () {
  // ---- 등급 유도 헬퍼 (서버가 grade를 안 주면 discrepancy로 산출) ----------
  const f = (raw, norm) => ({ raw, norm });

  // ======================= 대기업 (공시 발신 주체) =========================
  // ⚠️ MOCK — 실제 상장 대기업 공시 분석 결과로 교체
  const conglomerates = [
    { id: 'cg-hanseong', name: '한성전자',   sector: '반도체·메모리',  signal: 94, filings: 38, theme: '온디바이스 AI / HBM 증설' },
    { id: 'cg-daejung',  name: '대정모빌리티', sector: '전기차·완성차',  signal: 81, filings: 27, theme: '북미 전기차 공장 / 4680 셀' },
    { id: 'cg-nuri',     name: '누리솔라',     sector: '태양광·에너지',  signal: 73, filings: 19, theme: '페로브스카이트 탠덤 양산' },
    { id: 'cg-sejin',    name: '세진중공업',   sector: '조선·방산',      signal: 68, filings: 22, theme: '친환경 선박 / 암모니아 추진' },
    { id: 'cg-corebio',  name: '코어바이오',   sector: '바이오·제약',    signal: 61, filings: 15, theme: 'ADC 항암 / CDMO 증설' },
  ];

  // ===== 산업 섹션 (선택형 네비게이션) — 각 섹션은 대기업 생태계에 매핑 =====
  // ⚠️ MOCK — 실제로는 산업분류(KSIC) 기반 섹터 그룹으로 교체
  const sections = [
    { key: 'semi',  label: '반도체',         sub: '메모리 · HBM 공급망',     cg: 'cg-hanseong', icon: 'chip' },
    { key: 'ship',  label: '조선업',         sub: '친환경 선박 · 기자재',     cg: 'cg-sejin',    icon: 'ship' },
    { key: 'ev',    label: '전기차·2차전지', sub: '배터리 소재 · 장비',       cg: 'cg-daejung',  icon: 'bolt' },
    { key: 'solar', label: '태양광',         sub: '페로브스카이트 탠덤',      cg: 'cg-nuri',     icon: 'solar' },
    { key: 'bio',   label: '바이오',         sub: 'ADC · CDMO',             cg: 'cg-corebio',  icon: 'pill' },
  ];
  // ⚠️ MOCK — 가상 기업. 실제 사업자번호 매칭 결과로 교체
  // discrepancy: 공시 기대 대비 실제 행동(특허·R&D) 괴리.  +숨은진주 / -거품
  const companies = [
    // ---- 한성전자 생태계 (반도체) ----
    mk('co-001', '에이펙스소재', '반도체 소재(전구체)', true,  'cg-hanseong', 1, 91, +18, 96,
       { patentCount: f(412, 92), rndRatio: f(11.4, 88), rndGrowth: f(34, 90), marginSlope: f(2.1, 84), ipcEntropy: f(0.78, 81), inventorGrowth: f(27, 89), disclosureWill: f(72, 70) },
       'HBM용 고순도 전구체 양산. 공시 언급 대비 특허·발명자 증가폭이 큰 전형적 숨은 진주.'),
    mk('co-002', '나노프로브', '반도체 검사장비',   true,  'cg-hanseong', 1, 86, +12, 88,
       { patentCount: f(287, 85), rndRatio: f(13.2, 91), rndGrowth: f(41, 93), marginSlope: f(1.6, 76), ipcEntropy: f(0.71, 74), inventorGrowth: f(33, 92), disclosureWill: f(64, 62) },
       'AI HBM 본딩 검사 수요 확대. R&D 성장률·발명자 증감률 동반 상승.'),
    mk('co-003', '한빛정밀', '반도체 부품(쿼츠)', false, 'cg-hanseong', 2, 78, +7, 74,
       { patentCount: f(124, 66), rndRatio: f(8.7, 71), rndGrowth: f(22, 73), marginSlope: f(1.1, 64), ipcEntropy: f(0.62, 63), inventorGrowth: f(15, 68), disclosureWill: f(58, 56) },
       '식각 공정용 쿼츠웨어. 꾸준한 행동 신호, 상장 전 후보군.'),
    mk('co-004', '세라트론', '세라믹 패키징', true, 'cg-hanseong', 2, 44, -16, 52,
       { patentCount: f(58, 38), rndRatio: f(4.1, 32), rndGrowth: f(6, 28), marginSlope: f(-0.4, 30), ipcEntropy: f(0.41, 36), inventorGrowth: f(-8, 24), disclosureWill: f(81, 86) },
       '공시 의지·기대는 높으나 특허·발명자 지표 정체. 거품 경보(Negative Discrepancy).'),
    mk('co-005', '도원케미칼', 'CMP 슬러리', true, 'cg-hanseong', 3, 67, +3, 61,
       { patentCount: f(96, 58), rndRatio: f(7.2, 61), rndGrowth: f(17, 64), marginSlope: f(0.7, 55), ipcEntropy: f(0.55, 54), inventorGrowth: f(9, 57), disclosureWill: f(60, 58) },
       '3차 협력사. 신호 보통, 추세 관찰 필요.'),

    // ---- 대정모빌리티 생태계 (전기차/2차전지) ----
    mk('co-006', '코어셀테크', '2차전지 소재(양극재)', true, 'cg-daejung', 1, 88, +15, 90,
       { patentCount: f(341, 89), rndRatio: f(12.1, 89), rndGrowth: f(38, 91), marginSlope: f(1.9, 81), ipcEntropy: f(0.74, 77), inventorGrowth: f(29, 90), disclosureWill: f(69, 67) },
       '4680 셀용 단결정 양극재. 특허 포트폴리오 급증, 강한 숨은 진주.'),
    mk('co-007', '한일이앤지', '배터리 장비',     true,  'cg-daejung', 1, 72, +5, 70,
       { patentCount: f(168, 72), rndRatio: f(9.4, 76), rndGrowth: f(25, 76), marginSlope: f(0.9, 58), ipcEntropy: f(0.6, 60), inventorGrowth: f(14, 66), disclosureWill: f(63, 61) },
       '조립 공정 장비. 북미 증설 수혜 가시화 단계.'),
    mk('co-008', '신성정공', '전기차 구동부품', false, 'cg-daejung', 2, 59, -3, 55,
       { patentCount: f(77, 49), rndRatio: f(5.8, 47), rndGrowth: f(11, 48), marginSlope: f(0.2, 44), ipcEntropy: f(0.48, 46), inventorGrowth: f(4, 47), disclosureWill: f(57, 54) },
       '관찰 대상. 행동·공시 균형 구간.'),
    mk('co-009', '엠텍첨단', '전해질 첨가제', true, 'cg-daejung', 2, 41, -19, 49,
       { patentCount: f(44, 30), rndRatio: f(3.6, 27), rndGrowth: f(4, 22), marginSlope: f(-0.6, 26), ipcEntropy: f(0.38, 33), inventorGrowth: f(-11, 19), disclosureWill: f(78, 82) },
       '증설 공시 적극적이나 R&D·발명자 역성장. 거품 경보.'),
    mk('co-010', '대성와이어', '전지용 박막소재', false, 'cg-daejung', 3, 63, +2, 58,
       { patentCount: f(88, 54), rndRatio: f(6.6, 56), rndGrowth: f(15, 60), marginSlope: f(0.5, 51), ipcEntropy: f(0.52, 51), inventorGrowth: f(7, 54), disclosureWill: f(59, 57) },
       '3차 협력사. 점진 개선 추세.'),

    // ---- 누리솔라 생태계 (태양광) ----
    mk('co-011', '솔라엣지코리아', '페로브스카이트 소재', true, 'cg-nuri', 1, 84, +14, 82,
       { patentCount: f(231, 81), rndRatio: f(14.8, 94), rndGrowth: f(46, 95), marginSlope: f(1.4, 72), ipcEntropy: f(0.69, 71), inventorGrowth: f(31, 91), disclosureWill: f(66, 64) },
       '탠덤 셀 핵심 소재. R&D 비중·성장률 업종 최상위. 숨은 진주.'),
    mk('co-012', '한결이엔씨', '태양광 EPC',      false, 'cg-nuri', 1, 56, -2, 54,
       { patentCount: f(39, 26), rndRatio: f(3.1, 22), rndGrowth: f(9, 40), marginSlope: f(0.3, 46), ipcEntropy: f(0.34, 28), inventorGrowth: f(3, 45), disclosureWill: f(61, 59) },
       'EPC 특성상 특허 적음. 관찰 등급.'),
    mk('co-013', '비전셀', '태양전지 셀',        true, 'cg-nuri', 2, 38, -22, 47,
       { patentCount: f(51, 34), rndRatio: f(3.9, 30), rndGrowth: f(2, 18), marginSlope: f(-0.8, 22), ipcEntropy: f(0.4, 35), inventorGrowth: f(-14, 14), disclosureWill: f(83, 88) },
       '대규모 투자 공시 대비 특허·발명자 급감. 강한 거품 경보.'),

    // ---- 세진중공업 생태계 (조선/방산) ----
    mk('co-014', '대양엔지니어링', '선박 추진시스템', true, 'cg-sejin', 1, 79, +9, 76,
       { patentCount: f(193, 76), rndRatio: f(9.1, 74), rndGrowth: f(28, 80), marginSlope: f(1.2, 67), ipcEntropy: f(0.66, 67), inventorGrowth: f(19, 74), disclosureWill: f(62, 60) },
       '암모니아 추진 엔진 특허 선점. 친환경 선박 수혜 숨은 진주.'),
    mk('co-015', '진성테크', '선박 기자재',      false, 'cg-sejin', 2, 64, +1, 59,
       { patentCount: f(102, 60), rndRatio: f(6.9, 59), rndGrowth: f(16, 62), marginSlope: f(0.6, 53), ipcEntropy: f(0.54, 53), inventorGrowth: f(8, 55), disclosureWill: f(58, 55) },
       '기자재 국산화. 관찰 등급, 개선 추세.'),
    mk('co-016', '해성정밀', '방산 정밀부품',    true, 'cg-sejin', 2, 47, -13, 51,
       { patentCount: f(63, 42), rndRatio: f(4.4, 35), rndGrowth: f(7, 33), marginSlope: f(-0.2, 36), ipcEntropy: f(0.44, 40), inventorGrowth: f(-5, 30), disclosureWill: f(74, 76) },
       '수주 공시 적극적이나 R&D 지표 둔화. 거품 경보 관찰.'),
    // ⬇ 조선업 섹션 보강 (MOCK)
    mk('co-021', '동현마린시스템', '선박 블록·의장', true, 'cg-sejin', 1, 83, +12, 80,
       { patentCount: f(176, 73), rndRatio: f(8.4, 72), rndGrowth: f(31, 84), marginSlope: f(1.3, 69), ipcEntropy: f(0.64, 65), inventorGrowth: f(22, 79), disclosureWill: f(63, 61) },
       '메가블록 일괄 제작·의장 수직계열화. 친환경 선박 수주 확대로 특허·발명자 동반 증가. 숨은 진주.'),
    mk('co-022', '한울이엔지', '암모니아 연료탱크', true, 'cg-sejin', 1, 71, +6, 68,
       { patentCount: f(118, 63), rndRatio: f(9.7, 77), rndGrowth: f(26, 78), marginSlope: f(0.8, 57), ipcEntropy: f(0.61, 61), inventorGrowth: f(16, 70), disclosureWill: f(62, 60) },
       '암모니아·LNG 이중연료 탱크 기술. 친환경 추진 전환 수혜 가시화 단계.'),
    mk('co-023', '대보스틸', '후판·선체 강재', false, 'cg-sejin', 2, 52, -11, 54,
       { patentCount: f(61, 41), rndRatio: f(3.8, 29), rndGrowth: f(6, 30), marginSlope: f(-0.3, 33), ipcEntropy: f(0.43, 39), inventorGrowth: f(-6, 28), disclosureWill: f(73, 75) },
       '수주 호조 공시 대비 R&D·발명자 지표 정체. 거품 경보 관찰.'),

    // ---- 코어바이오 생태계 (바이오) ----
    mk('co-017', '제닉스바이오', 'ADC 링커 기술', true, 'cg-corebio', 1, 82, +13, 79,
       { patentCount: f(147, 70), rndRatio: f(28.4, 97), rndGrowth: f(52, 96), marginSlope: f(0.9, 59), ipcEntropy: f(0.72, 75), inventorGrowth: f(36, 94), disclosureWill: f(67, 65) },
       'ADC 링커 원천특허 보유. R&D 비중 압도적. 숨은 진주.'),
    mk('co-018', '메디팜텍', 'CDMO 생산',       true, 'cg-corebio', 1, 69, +4, 66,
       { patentCount: f(58, 38), rndRatio: f(16.2, 95), rndGrowth: f(29, 82), marginSlope: f(1.0, 61), ipcEntropy: f(0.58, 57), inventorGrowth: f(12, 63), disclosureWill: f(64, 62) },
       'CDMO 증설 수혜. 관찰→긍정 전환 구간.'),
    mk('co-019', '바이오젠코어', '진단키트',     false, 'cg-corebio', 2, 43, -17, 48,
       { patentCount: f(34, 22), rndRatio: f(9.8, 78), rndGrowth: f(5, 25), marginSlope: f(-0.5, 28), ipcEntropy: f(0.39, 34), inventorGrowth: f(-9, 22), disclosureWill: f(76, 79) },
       '파이프라인 공시 활발하나 특허·발명자 정체. 거품 경보.'),
    mk('co-020', '셀바이오스', '세포배양 배지',   false, 'cg-corebio', 3, 61, +1, 57,
       { patentCount: f(71, 47), rndRatio: f(12.4, 90), rndGrowth: f(18, 66), marginSlope: f(0.4, 49), ipcEntropy: f(0.5, 49), inventorGrowth: f(6, 52), disclosureWill: f(60, 58) },
       '3차 협력사. 배지 국산화 진행. 관찰 등급.'),
  ];

  function mk(id, name, sector, listed, parent, tier, dScore, discrepancy, signal, features, summary) {
    const grade = discrepancy >= 8 ? 'POSITIVE' : discrepancy <= -10 ? 'NEGATIVE' : 'MONITOR';
    // 최근 갱신 시각 — MOCK (오늘 기준 임의 분산)
    const hrs = Math.abs((id.charCodeAt(3) * 7 + dScore) % 72);
    const updatedAt = new Date(Date.now() - hrs * 3600 * 1000).toISOString();
    return { id, name, sector, listed, parent, tier, dScore, grade, signal, discrepancy, features, summary, updatedAt };
  }

  // ===== 피처 메타(라벨/단위/설명) — 기업 상세 막대그래프에서 사용 =====
  const featureMeta = [
    { key: 'patentCount',    label: '특허 수',          unit: '건',  desc: '누적 출원·등록 특허 건수' },
    { key: 'rndRatio',       label: 'R&D 비중',         unit: '%',   desc: '매출 대비 연구개발비' },
    { key: 'rndGrowth',      label: 'R&D 성장률',       unit: '%',   desc: '전년 대비 R&D 증가율' },
    { key: 'marginSlope',    label: '영업이익률 기울기', unit: '',    desc: '최근 4분기 이익률 추세' },
    { key: 'ipcEntropy',     label: 'IPC Entropy',      unit: '',    desc: '기술 분야 다각화 지수' },
    { key: 'inventorGrowth', label: '발명자 증감률',     unit: '%',   desc: '활동 발명자 수 변화' },
    { key: 'disclosureWill', label: '공시 의지 점수',    unit: '',    desc: '공시 빈도·구체성·미래지향' },
  ];

  // ===== 역방향 조회 시나리오 프리셋 — MOCK =====
  // ⚠️ 실제로는 자연어 → 임베딩 → 수혜 전파 모델. 여기선 키워드 매칭으로 시뮬레이션.
  const reverseScenarios = [
    {
      keywords: ['반도체', 'hbm', '메모리', '장비', '발주', '전공정'],
      origin: 'cg-hanseong',
      title: '반도체 장비 발주 증가',
      ranked: ['co-002', 'co-001', 'co-003', 'co-005', 'co-004'],
    },
    {
      keywords: ['전기차', '배터리', '2차전지', '양극재', '셀', '4680'],
      origin: 'cg-daejung',
      title: '북미 전기차 증설 / 4680 셀 양산',
      ranked: ['co-006', 'co-007', 'co-010', 'co-008', 'co-009'],
    },
    {
      keywords: ['태양광', '페로브스카이트', '탠덤', '재생에너지'],
      origin: 'cg-nuri',
      title: '페로브스카이트 탠덤 셀 양산',
      ranked: ['co-011', 'co-012', 'co-013'],
    },
    {
      keywords: ['조선', '선박', '암모니아', '친환경', '방산'],
      origin: 'cg-sejin',
      title: '친환경 선박 / 암모니아 추진 수주',
      ranked: ['co-021', 'co-014', 'co-022', 'co-015', 'co-016', 'co-023'],
    },
    {
      keywords: ['바이오', 'adc', '항암', 'cdmo', '제약'],
      origin: 'cg-corebio',
      title: 'ADC 항암 파이프라인 / CDMO 확장',
      ranked: ['co-017', 'co-018', 'co-020', 'co-019'],
    },
  ];

  // ============================ 파생 집계 =================================
  const byId = Object.fromEntries(companies.map((c) => [c.id, c]));
  const cgById = Object.fromEntries(conglomerates.map((c) => [c.id, c]));

  /* ===== 접촉 파이프라인 풀 (MOCK) ===============================================
   * RM 1명이 맡는 관리 대상 50~60곳. 기존 23곳 + 합성 목업으로 확장.
   * 합성 기업도 features/dScore를 deterministically 생성 → 대시보드·공시 연동 가능.
   * 단계(stage)·메모는 사용자별 localStorage 저장 (loadPipeline/savePipeline).
   * ⚠️ 실제로는 RM 배정 테이블 + CRM 메모를 서버에서 로드. */
  const clamp = (n) => Math.max(5, Math.min(98, Math.round(n)));
  function pfeat(dScore, disc, seed) {
    let x = 0; for (let i = 0; i < seed.length; i++) x = (x * 31 + seed.charCodeAt(i)) % 9973;
    const j = (n) => (((x = (x * 9301 + 49297) % 9973) / 9973) * 2 - 1) * n;
    const pos = disc >= 0, b = dScore;
    return {
      patentCount:    f(Math.max(18, Math.round(40 + b * 3 + j(40))), clamp(b + (pos ? 8 : -10) + j(6))),
      rndRatio:       f(+(3 + b * 0.12 + j(1.5)).toFixed(1),          clamp(b + (pos ? 6 : -8) + j(6))),
      rndGrowth:      f(Math.round(b * 0.5 + (pos ? 12 : -6) + j(8)), clamp(b + (pos ? 10 : -12) + j(6))),
      marginSlope:    f(+((pos ? 1.1 : -0.4) + j(0.4)).toFixed(1),    clamp(b + (pos ? 4 : -8) + j(6))),
      ipcEntropy:     f(+(0.4 + b * 0.004 + j(0.05)).toFixed(2),      clamp(b + j(6))),
      inventorGrowth: f(Math.round((pos ? 16 : -8) + j(10)),          clamp(b + (pos ? 10 : -14) + j(6))),
      disclosureWill: f(Math.round(60 + (pos ? 2 : 22) + j(8)),       clamp(pos ? b - 6 : b + 30 + j(6))),
    };
  }
  // 합성 기업: [name, sector, listed, cg, tier, dScore, disc]
  const extraSeed = [
    ['도담반도체', '반도체 포토마스크', true, 'cg-hanseong', 2, 74, +9], ['엠코어소재', 'EUV 펠리클', true, 'cg-hanseong', 1, 81, +13],
    ['정우테크놀로지', '웨이퍼 캐리어', false, 'cg-hanseong', 3, 58, +1], ['하이젠전자', '전력반도체', true, 'cg-hanseong', 2, 69, +5],
    ['삼광정밀', '리드프레임', false, 'cg-hanseong', 3, 49, -4], ['뉴런세미콘', 'AI 가속기 IP', true, 'cg-hanseong', 1, 87, +16],
    ['청림케미칼', '식각액', true, 'cg-hanseong', 2, 41, -15], ['에스티마이크로', '패키지 기판', true, 'cg-hanseong', 2, 63, +2],
    ['대륙에너지셀', '각형 배터리', true, 'cg-daejung', 1, 77, +10], ['그린모빌', '구동모터', false, 'cg-daejung', 2, 54, -2],
    ['한라전동', '인버터 모듈', true, 'cg-daejung', 2, 66, +3], ['우진소재', '동박', true, 'cg-daejung', 1, 72, +7],
    ['이엔셀텍', '실리콘 음극재', true, 'cg-daejung', 1, 84, +14], ['삼우정공', '배터리 케이스', false, 'cg-daejung', 3, 47, -6],
    ['미래모빌리티', '충전 인프라', true, 'cg-daejung', 2, 39, -18], ['청정에너지솔라', '셀 메탈라이제이션', true, 'cg-nuri', 1, 76, +9],
    ['한빛파워', '인버터·ESS', true, 'cg-nuri', 2, 62, +2], ['선광이엔지', '태양광 트래커', false, 'cg-nuri', 2, 51, -3],
    ['그린셀', '백시트 필름', false, 'cg-nuri', 3, 44, -9], ['에코솔텍', '리사이클 모듈', true, 'cg-nuri', 2, 37, -20],
    ['동양메탈', '특수강', true, 'cg-sejin', 2, 67, +4], ['태성중공', '선박 엔진부품', false, 'cg-sejin', 2, 59, 0],
    ['해동마린', '평형수 처리장치', true, 'cg-sejin', 1, 73, +8], ['우성정밀', '추진 프로펠러', false, 'cg-sejin', 3, 48, -5],
    ['신라조선기자재', '갑판 기계', false, 'cg-sejin', 3, 42, -12], ['한진엔텍', 'LNG 화물창', true, 'cg-sejin', 1, 80, +12],
    ['바이오니아젠', 'mRNA 원료', true, 'cg-corebio', 1, 78, +11], ['셀트리젠', '바이오시밀러', true, 'cg-corebio', 1, 70, +6],
    ['메디코어', '진단 플랫폼', false, 'cg-corebio', 2, 53, -2], ['파마링크', '제제 기술', true, 'cg-corebio', 2, 45, -11],
    ['넥스트젠바이오', '유전자치료', true, 'cg-corebio', 1, 85, +15], ['하나로의약', '원료의약품', false, 'cg-corebio', 3, 56, +1],
    ['지엘파마', 'CMO 충전', true, 'cg-corebio', 2, 40, -16], ['청송바이오', '배양 장비', false, 'cg-corebio', 3, 50, -3],
    ['엔바이오텍', '항체 정제', true, 'cg-corebio', 2, 64, +3], ['대한정밀소재', '반도체 본딩와이어', true, 'cg-hanseong', 2, 60, +1],
  ];
  const extraCompanies = extraSeed.map((r, i) => {
    const id = 'pco-' + String(i + 1).padStart(3, '0');
    const sig = clamp(r[5] + (r[6] > 0 ? 6 : -4));
    return mk(id, r[0], r[1], r[2], r[3], r[4], r[5], r[6], sig, pfeat(r[5], r[6], id),
      `${cgById[r[3]].name} ${r[4]}차 협력사. ${r[6] >= 8 ? '행동 신호가 공시 기대를 앞서는 숨은 진주 후보.' : r[6] <= -10 ? '공시 대비 행동 지표가 뒤처지는 거품 경보 관찰 대상.' : '행동·공시 균형 구간으로 추세 관찰이 필요합니다.'}`);
  });
  extraCompanies.forEach((c) => { byId[c.id] = c; });

  // 파이프라인 대상 풀 (기존 + 합성) → RM 1명 관리 대상 ~59곳
  const pipelinePool = companies.concat(extraCompanies).map((c) => c.id);
  // 단계 정의
  const pipelineStages = [
    { key: 'lead',      label: '미접촉',    sub: '아직 연결 못한 기업', color: '#8aa0b2' },
    { key: 'contacted', label: '접촉 진행 중', sub: '미팅·제안 단계',     color: '#2a8fd8' },
    { key: 'review',    label: '심사 진행 중', sub: '여신·심사 검토',     color: '#e6920a' },
    { key: 'connected', label: '연결 완료',  sub: '여신 실행·거래',     color: '#1f9d6b' },
  ];
  // 기본 단계 시드 (deterministic) — 미접촉에 가장 많이 분포
  function seedStage(id) {
    let x = 0; for (let i = 0; i < id.length; i++) x = (x * 31 + id.charCodeAt(i)) % 100;
    return x < 46 ? 'lead' : x < 70 ? 'contacted' : x < 87 ? 'review' : 'connected';
  }

  const counts = {
    pearls:   companies.filter((c) => c.grade === 'POSITIVE').length,  // 숨은 진주
    bubbles:  companies.filter((c) => c.grade === 'NEGATIVE').length,  // 거품 경보
    monitors: companies.filter((c) => c.grade === 'MONITOR').length,   // 모니터링
    filingsToday: conglomerates.reduce((s, c) => s + c.filings, 0),    // 오늘 갱신 공시
  };

  // 최신 경보 리스트 (NEGATIVE + 최근 갱신순)
  const alerts = companies
    .filter((c) => c.grade !== 'POSITIVE')
    .sort((a, b) => (a.grade === 'NEGATIVE' ? -1 : 1) - (b.grade === 'NEGATIVE' ? -1 : 1) || b.signal - a.signal)
    .slice(0, 7)
    .map((c) => ({
      id: c.id, name: c.name, grade: c.grade, discrepancy: c.discrepancy,
      parent: cgById[c.parent].name, sector: c.sector, updatedAt: c.updatedAt,
      msg: c.grade === 'NEGATIVE'
        ? `공시 기대 대비 행동 신호 ${Math.abs(c.discrepancy)}p 미달`
        : `신호 추세 변동 — 관찰 권고`,
    }));

  // ============================== 공개 API ===============================
  window.ADE = {
    GRADES: {
      POSITIVE: { key: 'POSITIVE', label: '숨은 진주', short: '진주', color: '#00e5a0' },
      NEGATIVE: { key: 'NEGATIVE', label: '거품 경보', short: '경보', color: '#ff4d6d' },
      MONITOR:  { key: 'MONITOR',  label: '모니터링',  short: '관찰', color: '#f5a623' },
    },
    conglomerates, companies, featureMeta, reverseScenarios, counts, alerts,
    byId, cgById, sections,

    // ---- 서버 교체용 진입점 (현재는 동기 반환) -----------------------------
    loadDashboard: async () => ({ counts, companies, conglomerates, alerts }),
    loadCompany:   async (id) => byId[id],
    loadNetwork:   async () => ({ conglomerates, companies }),
    // 역방향 조회: 자연어 → (EXAONE 키워드 추출 + 시나리오 분류) → 수혜 기업 랭킹, 실패 시 룰베이스
    reverseQuery:  (text) => reverseQuery(text),

    // ---- 섹션(산업) ----
    // 한 섹션에 앵커(대기업)가 여럿일 수 있다 (예: 반도체 = 삼성전자 + SK하이닉스) → s.cgs 배열 지원
    sectionByKey: (key) => sections.find((s) => s.key === key),
    sectionByCg:  (cg) => sections.find((s) => s.cg === cg || (s.cgs || []).includes(cg)),
    companiesInSection: (key) => {
      const s = sections.find((x) => x.key === key);
      if (!s) return [];
      const cgset = [s.cg].concat(s.cgs || []);
      return companies.filter((c) => cgset.includes(c.parent)).sort((a, b) => b.dScore - a.dScore);
    },
    // ---- 즐겨찾기 (사용자별 · localStorage — 백엔드 연동 교체 지점) ----
    favKey: (empId) => 'cashmap.favs.' + (empId || 'guest'),
    loadFavs: (empId) => { try { return JSON.parse(localStorage.getItem('cashmap.favs.' + (empId || 'guest')) || '[]'); } catch (e) { return []; } },
    saveFavs: (empId, ids) => { try { localStorage.setItem('cashmap.favs.' + (empId || 'guest'), JSON.stringify(ids)); } catch (e) {} },

    // ---- 접촉 파이프라인 (사용자별 · localStorage — CRM 연동 교체 지점) ----
    pipelineStages,
    pipelinePool,            // 관리 대상 기업 id 배열
    // RM의 파이프라인 = 풀의 각 기업 + 저장된 {stage, memo, lastContact} 오버라이드 병합
    loadPipeline: (empId) => {
      let saved = {};
      try { saved = JSON.parse(localStorage.getItem('cashmap.pipeline.' + (empId || 'guest')) || '{}'); } catch (e) {}
      return pipelinePool.map((id) => {
        const c = byId[id], o = saved[id] || {};
        return {
          id, name: c.name, sector: c.sector, grade: c.grade, dScore: c.dScore,
          parent: c.parent, cgName: cgById[c.parent].name, tier: c.tier, listed: c.listed,
          stage: o.stage || seedStage(id),
          memo: o.memo || '',
          lastContact: o.lastContact || null,
        };
      });
    },
    savePipelineItem: (empId, id, patch) => {
      const k = 'cashmap.pipeline.' + (empId || 'guest');
      let saved = {};
      try { saved = JSON.parse(localStorage.getItem(k) || '{}'); } catch (e) {}
      saved[id] = { ...(saved[id] || {}), ...patch };
      try { localStorage.setItem(k, JSON.stringify(saved)); } catch (e) {}
    },
  };

  // 선택된 시나리오로 수혜 기업 랭킹 구성 (매칭 로직과 분리 — AI/룰베이스 공용)
  function buildReverseResult(scenario, extra) {
    const items = scenario.ranked.map((cid, i) => {
      const c = byId[cid];
      return {
        rank: i + 1, id: c.id, name: c.name, sector: c.sector, tier: c.tier,
        dScore: c.dScore, grade: c.grade, listed: c.listed,
        score: Math.max(20, Math.round(c.signal - i * 6 + (c.discrepancy > 0 ? 8 : 0))),
        reason: c.summary,
      };
    });
    return { scenario, origin: cgById[scenario.origin], items, ...extra };
  }

  // 룰베이스: 키워드 substring 매칭 (AI 실패/오프라인 시 폴백)
  function runReverse(text) {
    const q = (text || '').toLowerCase();
    let best = null, bestScore = 0;
    for (const sc of reverseScenarios) {
      const score = sc.keywords.reduce((s, k) => s + (q.includes(k.toLowerCase()) ? 1 : 0), 0);
      if (score > bestScore) { bestScore = score; best = sc; }
    }
    if (!best) best = reverseScenarios[0]; // 기본값
    return buildReverseResult(best, { matched: bestScore > 0, ai: false });
  }

  // AI 우선: EXAONE가 자유 질의에서 키워드 추출 + 시나리오 분류 → 실패 시 룰베이스
  async function reverseQuery(text) {
    const q = (text || '').trim();
    if (!q) return runReverse(q);
    if (!window.ADE.online) return runReverse(q);
    const sectors = reverseScenarios.map((sc) => ({
      key: sc.origin,
      label: `${cgById[sc.origin] ? cgById[sc.origin].name : sc.origin} · ${sc.title}`,
      hint: sc.keywords.join(', '),
    }));
    try {
      const r = await fetch(`${window.ADE.API_BASE}/api/reverse/interpret`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, sectors }),
      });
      if (r.ok) {
        const n = await r.json();
        const sc = reverseScenarios.find((s) => s.origin === n.sector_key);
        if (sc) {
          return buildReverseResult(sc, {
            matched: true, ai: n.model && n.model !== 'fallback',
            keywords: n.keywords || [], rationale: n.rationale || null,
            model: n.model,
          });
        }
      }
    } catch (e) { /* 네트워크 실패 → 룰베이스 */ }
    return runReverse(q);
  }

  /* ===== 공시(전자공시) 데이터 — MOCK =====
   * ⚠️ 실제로는 DART OpenAPI 등 전자공시 연동으로 교체:
   *   window.ADE.loadDisclosures = async (id) =>
   *     (await fetch(`/api/v1/companies/${id}/disclosures`)).json();
   * signal: 'action'(행동 신호: 특허·증설·계약) / 'plan'(계획·기대) / 'routine'(정기·안내)
   */
  function dzSeed(id) { let x = 0; for (let i = 0; i < id.length; i++) x = (x * 31 + id.charCodeAt(i)) % 233280; return () => { x = (x * 9301 + 49297) % 233280; return x / 233280; }; }
  function genDisclosures(c) {
    if (!c) return [];
    const rnd = dzSeed(c.id);
    const cg = cgById[c.parent];
    const product = c.sector.replace(/\(.*?\)/g, '').trim();
    const iso = (age) => new Date(Date.UTC(2026, 5, 1) - age * 86400000).toISOString();
    const items = [];
    // 정기공시
    if (c.listed) {
      [['분기보고서', '2026년 1분기', 18], ['사업보고서', '2025년 연간', 78], ['분기보고서', '2025년 3분기', 210], ['반기보고서', '2025년 반기', 300]].forEach(([t, p, age]) => {
        items.push({ category: '정기공시', type: t, signal: 'routine', title: `${t} (${p})`, submitter: c.name, age: age + Math.floor(rnd() * 10),
          excerpt: `${p} 경영성과와 재무상태, 연구개발 활동 및 주요 계약·설비투자 내역을 보고합니다. ADE는 본문 텍스트에서 기술·투자 관련 서술의 구체성과 빈도를 분석합니다.`, keywords: ['실적', '연구개발', '설비투자'] });
      });
    } else {
      items.push({ category: '정기공시', type: '감사보고서', signal: 'routine', title: '감사보고서 (2025년)', submitter: '외부감사인', age: 70 + Math.floor(rnd() * 30),
        excerpt: '비상장 법인에 대한 외부감사 결과입니다. 비상장사는 정기공시 의무가 제한적이라 공시 건수가 적습니다.', keywords: ['감사', '재무제표'] });
    }
    // 주요사항/수시
    const action = [
      { type: '투자판단 관련 주요경영사항', title: '투자판단 관련 주요경영사항 (특허권 취득)', excerpt: `${product} 관련 핵심 특허를 취득했습니다. ${cg.theme} 수요 대응을 위한 원천기술 확보로, ADE는 이를 강한 '행동 신호'로 분류합니다.`, keywords: ['특허취득', product, '기술확보'] },
      { type: '유형자산 취득 결정', title: '유형자산 취득 결정 (생산라인 증설)', excerpt: `${product} 생산능력 확대를 위해 신규 라인 증설을 결정했습니다. 실제 CAPEX 집행을 동반하는 행동 신호입니다.`, keywords: ['증설', 'CAPEX', '생산능력'] },
      { type: '단일판매·공급계약체결', title: `단일판매·공급계약체결 (${cg.name} 향)`, excerpt: `${cg.name}과(와) ${product} 공급계약을 체결했습니다. ${cg.theme} 프로젝트 연계 물량으로 수혜가 가시화됩니다.`, keywords: ['공급계약', cg.name, '수주'] },
    ].map((o) => ({ ...o, signal: 'action' }));
    const plan = [
      { type: '신규 시설투자 등', title: '신규 시설투자 등 (중장기 투자계획)', excerpt: `${cg.theme} 대응을 위한 중장기 투자계획을 공시합니다. 구체적 집행 시점·금액은 추후 결정 예정으로, ADE는 '계획·기대' 신호로 분류합니다.`, keywords: ['투자계획', cg.theme] },
      { type: '투자판단 관련 주요경영사항', title: '투자판단 관련 주요경영사항 (신사업 진출 검토)', excerpt: `${product} 인접 분야 신사업 진출을 검토 중임을 안내합니다. 행동을 동반하지 않은 기대성 공시입니다.`, keywords: ['신사업', '검토'] },
      { type: '타법인 주식 취득결정', title: '타법인 주식 및 출자증권 취득결정', excerpt: '사업 확장을 위한 지분 투자를 결정했습니다.', keywords: ['지분투자', 'M&A'] },
    ].map((o) => ({ ...o, signal: 'plan' }));
    const routine = [
      { type: '영업(잠정)실적', title: '영업(잠정)실적 (공정공시)', excerpt: '분기 잠정 영업실적을 공정공시합니다.', keywords: ['실적', '공정공시'], signal: 'routine' },
      { type: '기업설명회(IR) 개최', title: '기업설명회(IR) 개최 (안내공시)', excerpt: '기관투자자 대상 기업설명회 개최를 안내합니다.', keywords: ['IR'], signal: 'routine' },
    ];
    let mix;
    if (c.grade === 'POSITIVE') mix = [action[0], action[1], action[2], action[0], plan[0], routine[0]];
    else if (c.grade === 'NEGATIVE') mix = [plan[0], plan[1], plan[2], plan[0], action[2], routine[0]];
    else mix = [action[1], plan[1], action[0], routine[0]];
    const cap = c.listed ? (c.tier === 1 ? 6 : 4) : 2;
    mix.slice(0, cap).forEach((m, i) => items.push({ ...m, category: m.signal === 'routine' ? '수시공시' : '주요사항보고', submitter: c.name, age: 8 + i * 26 + Math.floor(rnd() * 16) }));
    items.forEach((it) => { it.date = iso(it.age); });
    items.sort((a, b) => a.age - b.age);
    return items.map((it, i) => ({ id: `${c.id}-dz${i}`, ...it }));
  }
  // 동기 반환(데모). 서버 연동 시 async 로 교체.
  window.ADE.loadDisclosures = (id) => genDisclosures(byId[id]);
  window.ADE.disclosureCount = (id) => genDisclosures(byId[id]).length;

  /* ===== 신호 강도 시계열 — 데모용 결정적 생성 =====
   * ⚠️ 서버 연동 시: window.ADE.signalTrend = (corpCode) =>
   *      (await fetch(`${API_BASE}/api/cashmap/signal/trend`)).json()
   *        .filter(p => p.corp_code === corpCode).map(p => ({date:p.date, score:Math.round(p.score*100)}))
   *    실 DB의 signal_scores 는 공시(시점)별로 쌓여 있어 진짜 시계열이 나온다. */
  function genSignalTrend(c, n = 8) {
    if (!c) return [];
    const rnd = dzSeed(c.id + '-sig');
    const now = new Date(Date.UTC(2026, 5, 1));
    let v = c.signal || 50;
    const out = [];
    for (let i = 0; i < n; i++) {
      out.push({ date: new Date(now.getTime() - i * 91 * 86400000).toISOString().slice(0, 10), score: Math.round(v) });
      v = Math.max(8, Math.min(99, v + (rnd() - 0.5) * 18));   // 과거로 갈수록 흔들기
    }
    return out.reverse();   // 오래된→최신, 마지막=현재 signal
  }
  window.ADE.signalTrend = (id) => genSignalTrend(byId[id]);

  /* ===== AI 영업 리포트 서사 생성 ============================================
   * 멘토 피드백 반영: "버튼으로 만든다" → "열면 이미 있다".
   * 백엔드 연동 시 교체 지점:
   *   window.ADE.buildNarrative = async (id) =>
   *     (await fetch(`/api/report/${id}/narrative`)).json();   // Ollama/EXAONE 생성
   * LLM 미가동(현재 데모) 시 아래 구조화 룰베이스가 graceful fallback.
   * 입력: 이미 모으는 구조화 신호(grade·discrepancy·features·signal·공시).
   * 출력: 결론 헤드라인 + 핵심 진단 + 추천 액션 + 근거 + 리스크 (+ 생성 시각). */
  function narrativeFor(id) {
    const c = byId[id]; if (!c) return null;
    const cg = cgById[c.parent];
    const sec = sections.find((s) => s.cg === c.parent);
    const dz = genDisclosures(c);
    const sigN = { action: 0, plan: 0, routine: 0 };
    dz.forEach((d) => { sigN[d.signal]++; });

    // 행동지표 정렬 (norm 기준 강/약)
    const feats = featureMeta.map((m) => ({ label: m.label, unit: m.unit, raw: c.features[m.key].raw, norm: c.features[m.key].norm }));
    const strong = [...feats].sort((a, b) => b.norm - a.norm).slice(0, 3);
    const weak = [...feats].sort((a, b) => a.norm - b.norm).slice(0, 2);
    const fv = (x) => `${x.label} ${x.raw}${x.unit}`;
    const theme = cg.theme;
    const pos = c.grade === 'POSITIVE', neg = c.grade === 'NEGATIVE';

    // 생성 시각: "야간 배치(02:00) 기준" 느낌 — 직전 02:00
    const g = new Date(); g.setHours(2, 0, 0, 0);
    if (Date.now() < g.getTime()) g.setDate(g.getDate() - 1);
    const generatedAt = `${g.getFullYear()}. ${String(g.getMonth() + 1).padStart(2, '0')}. ${String(g.getDate()).padStart(2, '0')} ${String(g.getHours()).padStart(2, '0')}:00`;

    const headline = pos
      ? `${cg.name} ‘${theme}’ 사이클의 ${c.tier}차 수혜 후보. 지금이 선제 접촉 적기입니다.`
      : neg
        ? `공시 기대가 실제 행동을 앞서는 구간. 신규 익스포저는 보수적으로 접근하세요.`
        : `방향 전환을 지켜볼 국면. 다음 분기 공시 확인 후 판단을 권고합니다.`;

    const diagnosis = pos
      ? `${c.name}은(는) ${cg.name}이 발신하는 ‘${theme}’ 흐름의 ${c.tier}차 협력사로, 공급망에서 직접 수혜 위치에 있습니다. 핵심 행동지표가 고르게 강하며(${strong.map(fv).slice(0, 2).join(', ')}), 공시-행동 괴리가 +${c.discrepancy}p로 '말보다 행동이 앞서는' 전형적인 숨은 진주 패턴입니다. 최근 공시 ${dz.length}건 중 실제 행동 신호가 ${sigN.action}건으로 계획·기대성 공시(${sigN.plan}건)를 웃돕니다.`
      : neg
        ? `${c.name}은(는) ${theme} 테마의 ${c.tier}차 협력사이나, 공시 기대 대비 실제 행동이 ${Math.abs(c.discrepancy)}p 뒤처집니다. 최근 공시 ${dz.length}건 중 계획·기대성 공시가 ${sigN.plan}건으로 행동 신호(${sigN.action}건)보다 많아, 발표한 만큼 움직이는지 확인이 필요합니다. 특히 ${weak.map((x) => x.label).join('·')} 지표가 동종 대비 약합니다.`
        : `${c.name}은(는) ${theme} 흐름의 ${c.tier}차 협력사로, 행동 신호와 계획성 신호가 혼재합니다(행동 ${sigN.action}건 · 계획 ${sigN.plan}건). 공시-행동 괴리는 ${c.discrepancy >= 0 ? '+' : ''}${c.discrepancy}p로 중립 구간이며, ${strong[0].label}은(는) 강하나 ${weak[0].label}은(는) 아직 추세 확인이 필요합니다.`;

    const action = pos
      ? `RM 접촉 우선순위를 상향하세요. 1~2주 내 선제 미팅을 잡고, ‘${theme}’ 증설 사이클에 맞춘 시설자금·운전자금 한도 확대를 제안하기 좋은 타이밍입니다. 상장 여부(${c.listed ? '상장사' : '비상장'})를 감안해 IR·재무 담당과의 채널을 우선 확보하세요.`
      : neg
        ? `신규 여신은 보수적으로 접근하고, 기존 익스포저가 있다면 여신감리팀과 공유해 한도를 재점검하세요. 다음 분기 공시에서 계획이 실제 행동(특허·증설·계약)으로 이어지는지 확인한 뒤 재평가할 것을 권합니다.`
        : `지금은 신규 의사결정보다 모니터링 유지가 적절합니다. 분기 공시 후 ${weak[0].label} 추세를 재확인하고, 개선이 확인되면 접촉 우선순위를 조정하세요.`;

    const basis = `판단 근거 — (1) 공급망 위치: ${cg.name} ${c.tier}차 협력사로 ‘${theme}’ 직접 연관. (2) 행동지표: ${strong.map(fv).join(', ')} 등이 상위. (3) 공시 신호: 최근 ${dz.length}건 중 행동 ${sigN.action} / 계획 ${sigN.plan} / 정기 ${sigN.routine}건. (4) 섹션 신호 강도 ${cg.signal}. 이 네 가지를 교차하면 D-Score ${c.dScore}, 공시-행동 괴리 ${c.discrepancy >= 0 ? '+' : ''}${c.discrepancy}p가 도출됩니다.`;

    const risk = pos
      ? `주의 — 단기 수주·증설 공시에 따라 지표가 과열로 보일 수 있습니다. ${weak[0].label}(${weak[0].raw}${weak[0].unit})은 상대적으로 낮으니, 수익성 추세를 함께 모니터링하세요.`
      : neg
        ? `주의 — ${weak.map(fv).join(', ')} 지표가 약합니다. 기대성 공시가 추가될 경우 괴리가 더 벌어질 수 있어, 행동 전환 시그널을 별도 알림으로 관리하길 권합니다.`
        : `주의 — 방향이 확정되지 않은 구간입니다. ${weak[0].label}이(가) 추가 악화되면 거품 경보로, ${strong[0].label} 강세가 이어지면 숨은 진주로 전환될 수 있어 양방향 모두 관찰이 필요합니다.`;

    return {
      generatedAt, headline, diagnosis, action, basis, risk,
      model: 'fallback',
      source: 'ADE 자동 분석 (룰베이스)',
      signals: sigN, strong, weak,
    };
  }
  // 룰베이스 즉시 fallback도 외부에 노출 (report.jsx 가 로딩 중 placeholder 로 사용)
  window.ADE.narrativeFor = (id) => narrativeFor(id);

  /* buildNarrative: 백엔드 Ollama/EXAONE 로 '진짜' 서사 생성 (비동기).
   * 서버 미연결/실패 시 룰베이스(narrativeFor)로 graceful fallback → 항상 뭔가는 보인다.
   * 표시 중인 기업의 구조화 신호(등급·점수·괴리·행동지표·공시)를 그대로 백엔드에 전달. */
  const _narrBuilt = {};   // id → 백엔드 생성 결과 (워밍업·재방문 시 네트워크 없이 즉시)
  window.ADE.buildNarrative = async function (id, opts) {
    const c = byId[id];
    if (!c) return null;
    const regen = !!(opts && opts.regenerate);
    if (!regen && _narrBuilt[id]) return _narrBuilt[id];   // 사전 생성분 즉시 반환
    const local = narrativeFor(id);              // 즉시/폴백용 (룰베이스)
    if (!window.ADE.online) return local;        // 오프라인(목업 단독) → 룰베이스
    const cg = cgById[c.parent] || {};
    const dz = genDisclosures(c);
    const sigN = { action: 0, plan: 0, routine: 0 };
    dz.forEach((d) => { sigN[d.signal]++; });
    const facts = featureMeta
      .map((m) => { const fx = c.features[m.key]; return fx ? `${m.label} ${fx.raw}${m.unit}` : null; })
      .filter(Boolean);
    facts.push(`최근 공시 ${dz.length}건 (행동 ${sigN.action} · 계획 ${sigN.plan} · 정기 ${sigN.routine})`);
    // 동일 공급망 내 D-Score 순위 (비교 재료)
    const peers = companies.filter((x) => x.parent === c.parent).sort((a, b) => b.dScore - a.dScore);
    const rank = peers.findIndex((x) => x.id === c.id) + 1;
    if (rank > 0) facts.push(`동일 공급망(${cg.name}) ${peers.length}개사 중 D-Score ${rank}위`);
    // 주요 공시 제목 (구체 인용거리)
    const titles = dz.slice(0, 3).map((d) => d.title).filter(Boolean);
    if (titles.length) facts.push(`주요 공시 제목: ${titles.join(' / ')}`);
    const body = {
      corp_name: c.name, sector: c.sector, is_listed: !!c.listed,
      grade: c.grade, d_score: c.dScore, signal: c.signal,
      discrepancy: c.discrepancy, theme: cg.theme, anchor: cg.name, tier: c.tier,
      facts, regenerate: !!(opts && opts.regenerate),
    };
    try {
      const r = await fetch(`${window.ADE.API_BASE}/api/report/narrative`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (r.ok) {
        const n = await r.json();
        if (n && n.headline) {
          const out = {
            generatedAt: n.generatedAt || local.generatedAt,
            headline: n.headline, diagnosis: n.diagnosis, action: n.action,
            basis: n.basis, risk: n.risk,
            model: n.model, source: n.source || (n.model && n.model !== 'fallback' ? `AI 생성 · ${n.model}` : 'ADE 자동 분석(룰베이스)'),
          };
          _narrBuilt[id] = out;
          return out;
        }
      }
    } catch (e) { /* 네트워크 실패 → 룰베이스 */ }
    return local;
  };

  /* ===== 리포트 사전 생성 (워밍업) ==========================================
   * 멘토 피드백 "열면 이미 있다"의 실제 구현.
   * 앱 부팅 직후 백엔드가 살아있으면, 접촉 우선순위가 높은 기업(POSITIVE·고득점)부터
   * 순차로 서사를 미리 생성해 둔다 — 야간 배치(scheduler.pregenerate_narratives)와 같은 발상.
   * 백엔드는 입력 해시 캐시라 두 번째 부팅부터는 대부분 즉시 반환(no-op),
   * 프론트도 _narrBuilt 에 담아 리포트를 열면 네트워크 없이 즉시 표시된다. */
  window.ADE.warmup = { running: false, done: 0, total: 0, current: null };
  window.ADE.warmupNarratives = async function () {
    const st = window.ADE.warmup;
    if (!window.ADE.online || st.running) return;
    const w = (x) => (x.grade === 'POSITIVE' ? 2 : x.grade === 'NEGATIVE' ? 1 : 0);
    const order = (window.ADE.companies || []).slice()
      .sort((a, b) => (w(b) - w(a)) || (b.dScore - a.dScore));
    st.running = true; st.done = 0; st.total = order.length;
    for (const co of order) {
      if (!window.ADE.online) break;             // 서버가 죽으면 중단
      st.current = co.name;
      try { await window.ADE.buildNarrative(co.id); } catch (e) { /* 개별 실패 무시 */ }
      st.done++;
      await new Promise((r) => setTimeout(r, 250));   // 화면 상호작용에 양보
    }
    st.running = false; st.current = null;
  };

  /* ==========================================================================
   *  온라인/오프라인 데이터 소스 전환  (요청 #1)
   *  - 백엔드(/health)가 닿고 화면을 채울 실데이터(D-Score 등)가 있으면 'live'.
   *  - 닿지 않으면(인터넷/DB 미연결) 기존 목업 그대로 'mock'.
   *  - 닿지만 실데이터가 아직 없으면 'mock-demo' (데모가 비지 않도록 목업 유지).
   *  app.jsx 가 첫 렌더 전에 window.ADE.bootstrap() 을 await 한다.
   * ======================================================================== */
  window.ADE.API_BASE = window.CASHMAP_API_BASE || 'http://localhost:8000';
  window.ADE.online = false;
  window.ADE.source = 'mock';

  async function _probe(url, ms) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), ms || 1500);
      const r = await fetch(url, { signal: ctrl.signal });
      clearTimeout(t);
      return r.ok;
    } catch (e) { return false; }
  }
  async function _jget(path) {
    try { const r = await fetch(window.ADE.API_BASE + path); return r.ok ? await r.json() : null; }
    catch (e) { return null; }
  }

  /* 백엔드 실데이터(팀 Supabase)로 '반도체 섹션'을 통째로 교체.
   * - 목업 반도체(한성전자·에이펙스소재 등 5개사)는 제거하고,
   *   실 앵커(삼성전자·SK하이닉스) + 실 공급망(supply_chain_edges 15건) +
   *   실 D-Score(AI-B 투입 5건)로 같은 자리를 채운다.
   * - 나머지 섹션(조선·전기차·태양광·바이오)은 발표 데모용 목업 유지.
   * - sections/companies/byId/pipelinePool/alerts 가 전부 같은 참조라
   *   in-place 수정만으로 모든 화면(허브·상세·리포트·3D·칸반·역방향)에 반영.
   * (구 전면교체 _adaptLive 는 limit=1000→422·ds.score 필드명 오류로 동작한 적 없어 폐기) */
  async function _overlayLive() {
    const cosRaw = await _jget('/api/companies');
    if (!Array.isArray(cosRaw) || !cosRaw.length) return 0;
    const dscores = (await _jget('/api/ade/dscore?limit=500')) || [];   // 백엔드 상한 500
    if (!dscores.length) return 0;
    const edges = (await _jget('/api/supply-chain')) || [];
    const signals = (await _jget('/api/cashmap/signal/summary')) || [];

    const pct = (v) => Math.max(0, Math.min(100, Math.round((v || 0) * 100)));
    const clamp = (v) => Math.max(4, Math.min(96, Math.round(v)));
    const CG = 'cg-hanseong';                     // 반도체 섹션의 cg 슬롯을 그대로 재사용
    const cg = cgById[CG];
    if (!cg) return 0;
    if (cg.realized) return 0;                    // 재부트스트랩 중복 방지
    cg.realized = true;

    // ── 1) 목업 반도체 기업 제거 + 얽힌 참조(칸반 풀·경보·역방향 랭킹) 정리 ──
    const removedIds = {};
    for (let i = companies.length - 1; i >= 0; i--) {
      if (companies[i].parent === CG) { removedIds[companies[i].id] = 1; delete byId[companies[i].id]; companies.splice(i, 1); }
    }
    for (let i = pipelinePool.length - 1; i >= 0; i--) if (removedIds[pipelinePool[i]]) pipelinePool.splice(i, 1);
    for (let i = alerts.length - 1; i >= 0; i--)       if (removedIds[alerts[i].id])   alerts.splice(i, 1);

    // ── 2) 앵커를 실데이터로: 첫 앵커(삼성전자)는 기존 슬롯 재사용,
    //       나머지 앵커(SK하이닉스 등)는 별도 허브로 추가 — 같은 '반도체' 섹션에 묶는다 ──
    const anchors = cosRaw.filter((c) => c.is_anchor);
    const sigBy = {}; signals.forEach((s) => { sigBy[s.corp_code] = pct(s.latest_score); });
    const anchorSig = Math.max(0, ...anchors.map((a) => sigBy[a.corp_code] || 0)) || 55;
    cg.name = anchors[0] ? anchors[0].corp_name : '삼성전자';
    cg.sector = '반도체·메모리';
    cg.signal = (anchors[0] && sigBy[anchors[0].corp_code]) || anchorSig;
    cg.theme = 'HBM · AI 반도체 증설';
    const cgIdByAnchorName = {};                  // 앵커 기업명 → cg id (엣지 parent_corp 매칭용)
    if (anchors[0]) cgIdByAnchorName[anchors[0].corp_name] = CG;
    const extraCgIds = [];
    anchors.slice(1).forEach((a) => {
      const id = 'cg-real-' + a.corp_code;
      cgIdByAnchorName[a.corp_name] = id;
      extraCgIds.push(id);
      if (!cgById[id]) {
        const xcg = { id, name: a.corp_name, sector: '반도체·메모리', signal: sigBy[a.corp_code] || anchorSig, filings: 0, theme: 'HBM · AI 메모리' };
        conglomerates.push(xcg); cgById[id] = xcg;
      }
    });
    const sec = sections.find((s) => s.key === 'semi');
    if (sec) {
      sec.sub = anchors.map((a) => a.corp_name).join('·') + ' 실공급망 · Supabase';
      sec.cgs = [CG].concat(extraCgIds);          // 반도체 섹션 = 두 앵커 모두
    }

    // ── 3) 협력사 = 실 D-Score(5개사) ∪ 실 공급망 엣지(12개사) ──
    const byName = {};   // corp_name → { ds, edge } 병합
    dscores.forEach((d) => { byName[d.corp_name] = { ds: d }; });
    edges.forEach((e) => {
      const n = e.child_corp; if (!n) return;
      byName[n] = byName[n] || {};
      // 같은 협력사가 두 앵커(삼성·하이닉스)에 걸리면 강한 쪽 엣지 유지
      if (!byName[n].edge || (e.edge_weight || 0) > (byName[n].edge.edge_weight || 0)) byName[n].edge = e;
      byName[n].customers = (byName[n].customers || []).concat(e.parent_corp).filter((v, i, a) => a.indexOf(v) === i);
    });

    let added = 0;
    // 차수 오름차순으로 생성 — 2·3차는 상위 협력사(1·2차)가 먼저 만들어져 있어야 체인 연결 가능
    const realByName = {};   // corp_name → 생성된 회사 객체 (상위 체인 해석용)
    const entries = Object.keys(byName).map((n) => ({ _name: n, ...byName[n] }));
    entries.sort((a, b) => ((a.edge && a.edge.tier) || 1) - ((b.edge && b.edge.tier) || 1));
    entries.forEach(({ _name: name, ds, edge, customers }) => {
      const id = 'real-' + (ds ? ds.corp_code : name);
      if (byId[id]) return;
      const scored = !!(ds && ds.d_score != null);
      const dScore = scored ? pct(ds.d_score) : Math.round((edge ? edge.edge_weight : 0.5) * 75);  // 미산출 → 연결강도 기반 잠정치
      const rr = ds ? (ds.rd_ratio || 0) * 100 : 0, rg = ds ? (ds.rd_growth || 0) * 100 : 0;
      const ms = ds ? (ds.op_margin_slope || 0) * 100 : 0, ig = ds ? (ds.inventor_count_yoy || 0) * 100 : 0;
      const dash = f('–', 8);                     // 미산출 지표 표시
      // 주 소속: 1차 = 연결강도 최강 앵커 / 2·3차 = 상위 협력사의 앵커를 물려받고 upstreamId 로 실제 체인 연결
      let primaryCg = CG, upstreamId = null;
      if (edge && cgIdByAnchorName[edge.parent_corp]) {
        primaryCg = cgIdByAnchorName[edge.parent_corp];
      } else if (edge && realByName[edge.parent_corp]) {
        const up = realByName[edge.parent_corp];
        upstreamId = up.id;
        primaryCg = up.parent;
      }
      const crossCgs = (customers || [])
        .map((n) => cgIdByAnchorName[n])
        .filter((cgid) => cgid && cgid !== primaryCg);
      const c = {
        id, name,
        sector: '반도체 협력사' + (scored ? '' : ' · D-Score 대기'),
        listed: true, parent: primaryCg, crossCgs, upstreamId, tier: edge ? (edge.tier || 1) : 1,
        dScore, grade: scored ? (ds.grade || 'MONITOR') : 'MONITOR',
        signal: anchorSig,
        // 실 괴리 지표는 AI-A 산출 대기 — 그때까지 등급 기반 근사(데모 보강)
        discrepancy: !scored ? 0 : ds.grade === 'POSITIVE' ? 10 : ds.grade === 'NEGATIVE' ? -10 : 2,
        features: scored ? {
          patentCount:    f(ds.active_patents ?? 0, clamp((ds.active_patents || 0) / 4)),
          rndRatio:       f(+rr.toFixed(1), clamp(rr * 6.5)),
          rndGrowth:      f(+rg.toFixed(0), clamp((rg + 20) * 1.6)),
          marginSlope:    f(+ms.toFixed(1), clamp((ms + 2) * 20)),
          ipcEntropy:     f(ds.ipc_entropy != null ? +(+ds.ipc_entropy).toFixed(2) : 0,
                            ds.ipc_entropy != null ? clamp(ds.ipc_entropy * 100) : 8),
          inventorGrowth: f(+ig.toFixed(0), clamp(ig + 30)),
          disclosureWill: f(anchorSig, anchorSig),
        } : {
          patentCount: dash, rndRatio: dash, rndGrowth: dash, marginSlope: dash,
          ipcEntropy: dash, inventorGrowth: dash, disclosureWill: f(anchorSig, anchorSig),
        },
        summary: scored
          ? `팀 Supabase 실데이터 — AI-B D-Score ${dScore}점 (${ds.updated_at ? ds.updated_at.slice(0, 10) : '초안'} 산출)`
            + (customers ? ` · 주요 고객 ${customers.join('·')}` : '') + '. 괴리·공시 항목은 데모 보강값.'
          : `실 공급망 등록 기업 (연결강도 ${edge ? edge.edge_weight : '-'} · 고객 ${(customers || []).join('·')}) — D-Score는 AI-B 산출 대기, 표시 점수는 연결강도 기반 잠정치.`,
        updatedAt: (ds && ds.updated_at) || (edge && edge.created_at) || new Date().toISOString(),
      };
      companies.push(c); byId[id] = c; realByName[name] = c; pipelinePool.push(id); added++;
    });

    // ── 4) 집계·경보·역방향 랭킹을 새 구성으로 재계산 ──
    counts.pearls   = companies.filter((c) => c.grade === 'POSITIVE').length;
    counts.bubbles  = companies.filter((c) => c.grade === 'NEGATIVE').length;
    counts.monitors = companies.filter((c) => c.grade === 'MONITOR').length;
    const realCos = companies.filter((c) => String(c.id).indexOf('real-') === 0);
    realCos.filter((c) => c.grade !== 'POSITIVE').slice(0, 2).forEach((c) => {
      alerts.push({ id: c.id, name: c.name, grade: c.grade, discrepancy: c.discrepancy,
        parent: (cgById[c.parent] || cg).name, sector: c.sector, updatedAt: c.updatedAt, msg: '신호 추세 변동 — 관찰 권고' });
    });
    const sc = reverseScenarios.find((s) => s.origin === CG);
    if (sc) sc.ranked = realCos.sort((a, b) => b.dScore - a.dScore).slice(0, 5).map((c) => c.id);

    return added;
  }

  window.ADE.bootstrap = async function () {
    // 도커(nginx)로 서빙되면 /health·/api 가 같은 오리진으로 프록시된다 → 그쪽 우선.
    // 개발 모드(npx serve)는 /health 가 404라 자동으로 localhost:8000 직접 호출로 폴백.
    if (!window.CASHMAP_API_BASE && await _probe('/health', 1200)) {
      window.ADE.API_BASE = '';
    }
    let ok = await _probe(window.ADE.API_BASE + '/health', 1500);
    if (!ok) ok = await _probe(window.ADE.API_BASE + '/health', 3500);   // 서버가 LLM 생성 등으로 순간 바쁠 때 오프라인 오판 방지
    if (!ok) { window.ADE.online = false; window.ADE.source = 'mock'; return 'mock'; }
    window.ADE.online = true;
    let added = 0;
    try { added = await _overlayLive(); } catch (e) { added = 0; }
    // live-mix: 목업 데모 + Supabase 실 D-Score 기업('실데이터' 섹션) 동시 표시
    window.ADE.source = added > 0 ? 'live-mix' : 'mock-demo';
    return window.ADE.source;
  };

  // 공시 AI 요약 — 서버 로컬 LLM(EXAONE). 실데이터(rcept_no)는 원문 기반,
  // 데모 공시는 제목·발췌·유형·키워드 + 기업 맥락으로 요약(리포트 서사와 동일 방식).
  window.ADE.summarizeDisclosure = async function (item) {
    if (!window.ADE.online) throw new Error('AI 요약은 서버(로컬 LLM) 연결 시 제공됩니다.');
    if (!item) throw new Error('요약할 공시를 찾을 수 없습니다.');
    // 실데이터 공시 → 원문 본문 기반 요약
    if (item.rcept_no) {
      const r = await fetch(`${window.ADE.API_BASE}/api/disclosures/${item.rcept_no}/summary`, { method: 'POST' });
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.detail || `요약 실패 (HTTP ${r.status})`); }
      return (await r.json()).summary;
    }
    // 데모 공시 → 화면이 가진 메타 + 기업 맥락으로 EXAONE 요약
    const cid = String(item.id || '').split('-dz')[0];
    const c = byId[cid] || {};
    const cg = cgById[c.parent] || {};
    const body = {
      corp_name: c.name || item.submitter, sector: c.sector, grade: c.grade,
      theme: cg.theme, title: item.title, doc_type: item.type,
      signal: item.signal, excerpt: item.excerpt, keywords: item.keywords || [],
    };
    const r = await fetch(`${window.ADE.API_BASE}/api/disclosures/summary`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.detail || `요약 실패 (HTTP ${r.status})`); }
    return (await r.json()).summary;
  };
})();
