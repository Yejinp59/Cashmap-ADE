# CashMap × ADE — ADE 파트 개발 Handoff 문서 v3

담당: 김성희 (AI-B) | 작성일: 2026-07-01

---

## 1. 프로젝트 개요

CashMap × ADE는 하나금융그룹 해커톤 프로젝트로, DART 공시 텍스트와 KIPRIS 특허 데이터를 교차 분석해 우량 협력사를 선제 발굴하는 AI 플랫폼이다.

| 파트 | 역할 | 담당 |
|---|---|---|
| CashMap | DART 공시 NLP 파이프라인, S-Score 산출 | 이윤지 (AI-A) |
| ADE | KIPRIS 특허 + DART 재무 → D-Score 산출 | 김성희 (AI-B) |
| Backend/DB | FastAPI, PostgreSQL, React 연동 | 신승민 (BE) |

데모 마감까지 약 3주 (2026-07-01 기준)

---

## 2. 핵심 결론 — ADE 담당 6개 피처 100% 완성

기획서 D-Score 피처 8개 중, ADE가 직접 책임지는 6개는 전부 정상 작동한다.

| # | 피처 | 출처 | 상태 |
|---|---|---|---|
| 1 | active_patents | KIPRIS | ✅ 완성 |
| 2 | ipc_entropy | KIPRIS | ✅ 완성 |
| 3 | inventor_count_yoy | KIPRIS | ✅ 완성 |
| 4 | rd_ratio | DART | ✅ 완성 |
| 5 | rd_growth | DART | ✅ 완성 |
| 6 | op_margin_slope | DART | ✅ 완성 |
| 7 | 공시 텍스트 의지 점수(S) | CashMap | ⬜ 이윤지님 작업 대기 |
| 8 | 텍스트 대비 행동 괴리 비율 | 7번 기반 산출 | ⬜ 7번 의존 |

---

## 3. 최종 D-Score 결과 (2026-07-01 기준)

| 순위 | 회사 | D-Score | 등급 | active_patents | inventor_yoy | rd_ratio | rd_growth | op_margin_slope |
|---|---|---|---|---|---|---|---|---|
| 1 | 솔브레인 | 0.6874 | POSITIVE | 309 | -13.7% | 4.44% | 29.4% | -0.0067 |
| 2 | 피에스케이 | 0.5745 | POSITIVE | 101 | +68.6% | 7.8% | -10.3% | 0.0199 |
| 3 | 한미반도체 | 0.4818 | MONITOR | 48 | +20.0% | 3.36% | 8.6% | 0.1093 |
| 4 | 원익QnC | 0.4694 | MONITOR | 37 | +25.0% | 2.57% | 17.4% | -0.0199 |
| 5 | 파크시스템스 | 0.4259 | MONITOR | 12 | 0.0% | 11.2% | -7.4% | 0.0074 |

전부 `is_partial=False` (재무 데이터 정상 수집), `signal_score=None` (S-Score 연동 전)

---

## 4. DART corp_code 확정 목록 (검증 완료)

| company_id | 회사명 | corp_code | 비고 |
|---|---|---|---|
| 1 | 삼성전자 | 00126380 | |
| 2 | SK하이닉스 | 00164779 | |
| 3 | 피에스케이 | 01365825 | 지주사 분할 후 사업회사 |
| 4 | 원익QnC | 00468374 | |
| 5 | 한미반도체 | 00161383 | |
| 6 | 솔브레인 | 01489648 | 지주사 분할 후 사업회사 |
| 7 | 파크시스템스 | 00244747 | |

5개사 전부 DART `company.json` status=000 확인 완료. 종목코드(6자리)가 아닌 DART 고유번호(8자리) 사용해야 함.

---

## 5. 오늘(07-01) 해결한 주요 이슈 — 시간순

### 5-1. corp_code 검증
- CashMap 측 PARTNER_CORPS 전수 재검증 결과와 교차 확인, 일치 확인

### 5-2. d_scores 등급 체계 불일치
- 코드에서 A+/A/B+/B/C/D로 설계했으나, 실제 DB 제약조건은 `POSITIVE/MONITOR/NEGATIVE`
- 기획서 양방향 분류 체계(숨은진주/거품경보/모니터링)와 일치하는 등급이었음
- `GRADE_THRESHOLDS`를 POSITIVE(≥0.50)/MONITOR(≥0.25)/NEGATIVE로 수정

### 5-3. active_patents 계산 방식 오류
- Phase 2 v1에서 특허를 회사당 요약 레코드 1건(`SUMMARY_xxx`)으로 저장 → active_patents가 항상 1로 나옴
- KIPRIS API 호출 시 `numOfRows` 파라미터 누락 → 페이지당 기본값 20건만 수집되던 문제도 발견
- **kipris_collector.py v2로 전면 개편**: 특허 개별 레코드 저장 + numOfRows=100 명시
- active_patents 기준을 "등록 여부"에서 "등록일 기준 최근 N년"으로 변경
  - 3년 시도 → 표본 너무 작음(2~22건)
  - **5년으로 확정** (반도체 특허 심사 기간 2~3년 감안, Handoff에 근거 명시)

### 5-4. DART 재무 데이터 수집 버그 3종
- `fnlttSinglAcnt` → `fnlttSinglAcntAll`로 API 변경 (R&D비 포함 전체 계정 필요)
- `account_id`가 전부 None 반환 → `account_nm`(한글 계정명) 매칭으로 전환
- 매출액 계정명이 회사마다 다름 (`매출액` / `수익(매출액)`) → ACCOUNT_MAP에 둘 다 등록
- 조회 연도 `[2021,2022,2023]`(과거 고정값) → `[2023,2024,2025]`로 갱신 (2024,2025 데이터 존재 확인 후)

### 5-5. R&D비 계정명 연도별 변경 발견
- 한미반도체 2025년 계정명이 `연구개발비` → `연구와 개발 비용`으로 변경된 것 발견
- ACCOUNT_MAP에 추가하여 해결

### 5-6. R&D비 미수집 4개사 — 사업보고서 원문 파싱으로 해결 (핵심 작업)
- 피에스케이, 원익QnC, 솔브레인, 파크시스템스는 R&D비를 판관비에 통합 공시 (정형 API로 추출 불가)
- DART `document.xml` API로 사업보고서 원문(zip) 다운로드 → UTF-8 디코딩 → 정규식으로 "연구개발비 / 매출액 비율" 표 직접 파싱
- 회사마다 키워드 표현이 다름 확인:
  - 피에스케이/원익QnC/솔브레인: "연구개발비 / 매출액 비율"
  - 파크시스템스: "매출액 대비 비율" (% 기호 없이 숫자만 셀에 들어있는 형식 차이도 있었음)
- `RD_RATIO_KEYWORDS` 리스트로 여러 표현 순차 시도하는 방식으로 해결
- **`get_dart_features`에 1차(API)/2차(원문 파싱) fallback 구조 구현**, `rd_source` 필드로 출처 표시

### 5-7. inventor_count_yoy 설계 논의 및 구현
- 데이터 소스를 KIPRIS(특허 발명자 기반) vs DART(실제 R&D 임직원 현황) 중 어느 쪽으로 할지 논의
  - 결론: 기획서 데이터 소스 명시(KIPRIS Plus API)와 업계 표준 용어 관행에 따라 **KIPRIS 발명자 기반으로 확정**
  - 측정 방식도 3가지(Unique Inventor YoY / 신규 비율 / Active Inventor 누적) 검토 후 **Unique Inventor YoY**로 확정 (표본 안정성, 기획 의도와의 합치도 고려)
  - 한계는 인지: "R&D 인력 자체"가 아니라 "특허 활동 참여 연구자 풀의 변화"를 보는 대리지표. 발표 시 이 표현으로 명시 필요
- KIPRIS 서지정보 상세 API(`getBibliographyDetailInfoSearch`)로 발명자명 직접 조회 가능 확인
- **active patent(최근 5년 등록)만 대상으로 호출** — 전체가 아닌 활성 특허만 호출해 API 사용량 절약 (5개사 합계 약 505건)
- 버그: DB의 patent_no를 출원번호로 임의 변환(`_format_application_number`)했으나 실제로는 변환이 오히려 문제였음 — **하이픈 없는 원본 형식 그대로 전달해야 정상 작동**
- 버그: DB에 등록번호/출원번호가 혼재 저장되어 있던 문제 → `kipris_collector.py`에서 `patent_no`를 출원번호로 통일하도록 수정 후 재수집
- 연도 비교 버그: 2026년(진행 중, 미완성 데이터)을 비교 대상에 포함해 마이너스로 왜곡됨 → "현재 연도보다 이전인 완전한 연도"만 비교하도록 수정

### 5-8. KIPRIS API 월 호출 한도(1,000회) 소진 대응
- 디버깅 과정에서 호출량 소진, `resultCode=00`(정상)인데 데이터가 비어 응답되는 패턴으로 한도 초과를 인지 (별도 에러코드 없음)
- 동생 명의로 KIPRIS Plus 계정 추가 가입 + 동일 API 신청하여 보조 키 확보
- **KiprisKeyPool 클래스 구현**: 여러 키를 순서대로 관리하다 현재 키 호출이 실패(서지정보 자체가 비어있음)하면 자동으로 다음 키로 전환
- `.env`에 `KIPRIS_API_KEY`, `KIPRIS_API_KEY_2`(, `_3`...) 형식으로 등록하면 자동 인식
- 실제 솔브레인(309건) 처리 중 150건 지점에서 키 전환 정상 작동 확인

### 5-9. feature_calculator.py / d_scorer.py 연동 버그
- `feature_calculator.py`의 `compute_features` 시그니처가 `key_pool` 인자를 받도록 바뀌었으나 `d_scorer.py`의 `run_pipeline`이 구버전 방식(`compute_features(cid)`)으로 직접 호출하고 있어 오류 발생
- `run_pipeline`에서 `compute_all_features(company_ids)`를 호출하도록 수정하여 해결

---

## 6. 현재 파일 구조

```
ade/
├── src/
│   ├── __init__.py
│   ├── normalizer/          ← Phase 1 완료
│   ├── kipris/               ← Phase 2 완료 (v2, 출원번호 통일 저장)
│   │   └── kipris_collector.py
│   ├── features/             ← Phase 3 완료
│   │   └── feature_calculator.py   (※ 약 600줄, 향후 리팩토링 필요 — 9절 참고)
│   └── scoring/               ← Phase 4 완료
│       └── d_scorer.py
├── scripts/                   ← 디버깅/검증용 일회성 스크립트 모음 (정식 코드 아님)
├── data/
└── .env                       (KIPRIS_API_KEY, KIPRIS_API_KEY_2, DART_API_KEY, DATABASE_URL)
```

---

## 7. DB 스키마 핵심 변경사항

### patents 테이블
- v2부터 특허를 **개별 레코드**로 저장 (기존 회사당 요약 1건 방식 폐기)
- `patent_no` = 출원번호로 통일 (등록번호 아님 — KIPRIS 상세API가 출원번호 기준이라서)
- `is_active` = 등록 상태 + 등록일 최근 5년 이내
- `filed_at` = 등록일 우선, 없으면 출원일

### d_scores 테이블
- `grade` CHECK 제약: `POSITIVE / MONITOR / NEGATIVE` (A+/A/B/C 아님, 주의)
- UNIQUE(company_id) 제약 추가됨 (ON CONFLICT DO UPDATE 가능)
- `rd_source` 필드는 d_scores 테이블에는 없음 (feature dict에서만 사용, 로그 확인용)

---

## 8. 알려진 한계 (발표 시 명시 필요)

| 항목 | 한계 내용 |
|---|---|
| active_patents | "최근 3년"이 아닌 "최근 5년" 기준 사용. 특허 심사 기간 2~3년을 감안한 조정 |
| inventor_count_yoy | 회사 실제 R&D 인력 수가 아니라 "특허 활동에 참여한 연구자 풀(unique inventor)의 YoY". 공동발명자 등재 관행에 따라 일부 왜곡 가능 |
| rd_ratio (4개사) | DART 정형 API가 아닌 사업보고서 원문 파싱으로 확보. 표 형식이 회사마다 달라 키워드 매칭 방식이라 완전히 새로운 표현이 나오면 실패 가능 |
| 가중치 / 등급 임계값 | 전부 임시값 (WEIGHTS, GRADE_THRESHOLDS 0.50/0.25). Phase 6 백테스팅 후 로지스틱 회귀로 확정 예정 |
| signal_score | CashMap S-Score v1.0 미동결로 전부 None. 피처 7,8번 미반영 |
| DB | 로컬 Docker 사용 중. 최종 통합 DB(승민님) 미확정 |

---

## 9. 다음 작업 — Phase 6 백테스팅

### 9-1. 설계 방향 (변경됨)
기존 기획(기술특례상장 150개 vs 비상장 300개)은 다음 이유로 폐기, 수정안 적용:
- 비상장사는 DART 재무 데이터 자체가 없어 수집 불가능
- 학습 라벨(상장 성공)과 검증 지표(매출 성장률)가 불일치하는 순환논리 문제 (PM 검토에서 지적됨)

**수정안**: 반도체 장비·소재 상장사 약 21개 기업을 대상으로
```
D-Score 계산 → 3년 후 매출 YoY 성장률 계산
→ 성장률 상위/하위로 양성/음성 라벨링
→ 로지스틱 회귀로 가중치 산출
→ Precision ≥ 0.60 목표
```
매출 성장률은 **YoY(전년동기대비) 기준** — QoQ는 반도체 계절성으로 왜곡 위험 있음 (CashMap 측 동일 이슈 발견 사례 참고)

### 9-2. 백테스팅 대상 21개 기업 후보 (KRX 데이터 기반 선정)

| 종목코드 | 회사명 | 분류 |
|---|---|---|
| 319660 | 피에스케이 | 장비 |
| 074600 | 원익QnC | 소재 |
| 042700 | 한미반도체 | 장비 |
| 357780 | 솔브레인 | 소재 |
| 140860 | 파크시스템스 | 장비 |
| 084370 | 유진테크 | 장비 |
| 240810 | 원익IPS | 장비 |
| 095610 | 테스 | 장비 |
| 039030 | 이오테크닉스 | 장비 |
| 036930 | 주성엔지니어링 | 장비 |
| 183300 | 코미코 | 서비스 |
| 058470 | 리노공업 | 부품 |
| 064760 | 티씨케이 | 소재 |
| 166090 | 하나머티리얼즈 | 소재 |
| 005290 | 동진쎄미켐 | 소재 |
| 092070 | 디엔에프 | 소재 |
| 101490 | 에스앤에스텍 | 소재 |
| 104830 | 원익머트리얼즈 | 소재 |
| 083310 | 엘오티베큠 | 장비 |
| 160980 | 싸이맥스 | 장비 |
| 281740 | 레이크머티리얼즈 | 소재 |

### 9-3. 백테스팅 시 주의사항 (오늘 경험 기반)
- **inventor_count_yoy는 백테스팅 대상에서 제외 권장**: 21개 기업까지 KIPRIS 발명자 API를 돌리면 호출량이 1,000~1,500건 이상 예상되어 키 2개로도 부족할 가능성 높음
- 각 기업 corp_code(DART)를 반드시 사전 검증(status=000 확인) 후 진행 — 한 번 전수로 틀렸던 전례(CashMap 측) 있음
- R&D비가 정형 API로 안 나오는 기업이 다수 있을 것으로 예상 — 사업보고서 파싱 fallback 로직이 이미 있으므로 그대로 활용 가능하나 처리 시간 증가 고려

### 9-4. 예상 소요시간
- inventor_count_yoy 제외 시: 약 4~5시간
- 포함 시: 8~10시간 + API 한도 부족 위험

---

## 10. 향후 리팩토링 필요 사항 (시간 남으면)

`feature_calculator.py`가 약 600줄로 비대해짐. 다음 구조로 분리 권장:
```
src/features/
├── feature_calculator.py     ← 오케스트레이션만
├── patent_metrics.py         ← active_patents, ipc_entropy
├── kipris_key_pool.py        ← KiprisKeyPool
├── inventor_metrics.py       ← inventor_count_yoy
└── dart_metrics.py           ← rd_ratio, rd_growth, op_margin_slope
```
지금은 기능 검증이 우선이라 보류. 발표 준비 끝나고 팀 인수인계 전에 진행 권장.

---

## 11. 팀 인터페이스 현황

### 이윤지(CashMap) → 김성희(ADE)
- corp_code 재검증 완료 사실 공유 필요 (양쪽 다 같은 결론 도달)
- S-Score v1.0 동결 후 signal_score 피처 연동 예정
- skh_network_v1.json 최종본 아직 미수령 (중간본 상태로 알고 있음)

### 김성희(ADE) → 신승민(BE)
- d_scores 테이블 결과 저장 중 (현재 5개사)
- 최종 통합 DB URL 확인 필요 (로컬 Docker vs Supabase 등)
- 백테스팅 완료 후 가중치 확정되면 5개사 D-Score 재계산 → 재전달 예정

---

## 12. 다음 대화 시작 시 첫 행동

1. `python -m src.scoring.d_scorer` 재실행해서 현재 DB 상태 확인 (오늘 결과가 유지되는지)
2. companies 테이블에 백테스팅용 21개 기업 추가 등록
3. 21개 기업 corp_code(DART) 검증 (status=000 확인)
4. KIPRIS 특허 수집 (`kipris_collector.py`, inventor 제외)
5. DART 재무 수집 (기존 `feature_calculator.py` 로직 그대로 재사용 가능, 단 inventor_count_yoy는 호출 건너뛰는 옵션 필요 — 현재 코드엔 없으므로 별도 처리 필요)
