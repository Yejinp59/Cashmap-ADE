# NOVA (CashMap × ADE) — CLAUDE.md

> **서비스명: NOVA — Network of Vendor Analytics** (2026-07-04 확정)
> 신성(NOVA)처럼, 공급망 속 아직 주목받지 않은 협력사·미래 성장 기업을 가장 먼저 발견한다는 의미.
> CashMap(공시 분석)·ADE(행동 점수)는 NOVA를 구성하는 **엔진(모듈) 이름**으로 유지한다.

> 이 파일은 Claude Code에서 프로젝트 컨텍스트를 이어받기 위한 문서입니다.
> 새 세션 시작 시 반드시 이 파일을 먼저 읽으세요.
>
> **최종 갱신: 2026-07-04** — 전체 진단(수정·미흡·추가) 섹션 신설 + 디렉토리/실행법/API/프론트 현황 현행화,
> 리포트 사전 생성(워밍업) 구현 반영. (직전 갱신 2026-06-06 / 2026-07-03 발표용 스택 섹션)

---

## 프로젝트 한 줄 요약

대기업 DART 공시 텍스트(CashMap)와 협력사 특허·R&D 데이터(ADE)를 교차 분석해,
하나은행 기업금융팀 RM이 타행보다 1~2분기 먼저 우량 협력사에 접근할 수 있도록 지원하는
AI 기반 선제 여신 인텔리전스 플랫폼.

---

## 🎤 발표용 기술 스택 상세 설명 (2026-07-03 기준)

> **이 섹션은 발표자가 "이 기술이 무엇이고, 왜 이걸 골랐는지"를 직접 설명할 수 있도록 정리한 것.**
> 아래 본문의 일부 옛 설명(로컬 Docker Postgres, TS 프론트 등)보다 **이 섹션이 현재 실제 구현에 더 가깝다.**
> 각 항목: **무엇인지 → 왜 썼는지 → 우리 프로젝트 어디에 쓰이는지** 순.

### 0) 한 문장 아키텍처
> "대기업 **DART 전자공시(텍스트)**와 협력사 **KIPRIS 특허·R&D(행동)**를 교차 분석해서,
> **공시(말)와 실제 행동(특허·투자)의 괴리**로 '숨은 진주 / 거품'을 가려내고,
> **로컬 AI(EXAONE)**가 RM용 리포트·요약·검색을 자동 생성하는 시스템."

핵심 흐름: **데이터 수집(DART·KIPRIS) → AI 분석(임베딩·D-Score·LLM) → FastAPI 저장/제공 → 화면·PDF 리포트**

---

### 1) 백엔드 (데이터·API·자동화)

| 기술 | 무엇인지 | 왜 썼는지 |
|---|---|---|
| **Python** | 백엔드 주 언어 | AI/데이터 생태계(요청·파싱·LLM 연동)가 전부 파이썬 중심 → AI팀과 코드·라이브러리 공유가 쉬움 |
| **FastAPI** | 파이썬 웹 API 프레임워크 | ① **자동 API 문서**(`/docs` Swagger) → 팀 간 인터페이스 협의가 즉시 가능 ② **Pydantic 검증** 내장 → 잘못된 데이터 자동 차단 ③ 비동기·빠름 |
| **Uvicorn** | FastAPI를 실제로 구동하는 ASGI 서버 | FastAPI 공식 권장 실행기. `uvicorn main:app`으로 서버 기동 |
| **SQLAlchemy** | 파이썬 ORM(객체↔DB 테이블 매핑) | SQL을 파이썬 객체로 다뤄 안전하게 CRUD. DB 종류가 바뀌어도 코드 최소 변경 |
| **Pydantic** | 요청/응답 데이터 스키마·검증 | "이 API는 이런 필드를 받고 이런 걸 돌려준다"를 코드로 강제 → 런타임 오류·오적재 방지 |
| **PostgreSQL (Supabase 호스팅)** | 관계형 DB | 팀원이 만든 **Supabase(클라우드 Postgres)**를 공용 DB로 사용. 여러 명이 같은 데이터에 접근, `pgvector`로 임베딩 벡터 검색까지 지원 |
| **APScheduler** | 파이썬 작업 스케줄러 | **매일 새벽 02:00 야간 배치** — DART·KIPRIS 신규 수집 + 리포트 사전 생성. "RM이 아침에 열면 이미 분석돼 있다"를 만드는 엔진 |
| **JWT + bcrypt(passlib) + RBAC** | 토큰 기반 인증 + 비밀번호 암호화 + 역할별 권한 | 금융 내부 시스템 → 로그인·권한 필수. RM/IB/심사/관리자 **역할별로 보이는 메뉴·기능을 분리** |
| **ReportLab** | 파이썬 PDF 생성 라이브러리 | RM 영업 리포트를 **PDF로 다운로드**. 한글 폰트(NanumGothic) 임베딩으로 깨짐 방지, 화면과 동일한 내용 |
| **requests** | HTTP 호출 라이브러리 | 외부 API(DART/KIPRIS) 수집 + **로컬 LLM(Ollama) 호출**에 사용 |

---

### 2) AI · LLM (⭐ 우리 프로젝트의 핵심 차별점)

| 기술 | 무엇인지 | 왜 썼는지 |
|---|---|---|
| **Ollama** | 로컬에서 LLM을 돌리는 실행 런타임 (localhost:11434) | ① **데이터가 외부로 안 나감** — 금융 공시·여신 판단은 민감 정보라 ChatGPT 같은 외부 API에 못 보냄. 로컬 구동이 **데이터 주권** 확보 ② **무료·무제한** 호출 ③ 인터넷 없어도 동작 |
| **EXAONE 3.5 2.4B** | LG AI Research가 만든 **한국어 특화** 경량 LLM | ① **한국어 성능**이 강함(공시·여신 용어가 전부 한국어) ② **2.4B 경량(1.6GB)** → 노트북/로컬에서도 구동 가능 ③ 오픈모델이라 Ollama로 바로 사용 |
| **`format: json` 구조화 출력** | LLM이 반드시 정해진 JSON 형태로만 답하게 강제 | 리포트 5개 섹션(결론·진단·액션·근거·리스크)처럼 **화면에 그대로 꽂을 구조**가 필요 → 자유 문장이 아니라 파싱 가능한 JSON으로 |
| **룰베이스 Fallback** | LLM이 실패/미설치면 규칙 기반 문장으로 대체 | **AI가 없어도 항상 뭔가는 나온다**는 안정성 설계. 발표 중 LLM이 죽어도 화면이 비지 않음 |
| **인메모리 해시 캐시** | 같은 입력이면 재생성 없이 즉시 반환 | LLM 생성은 ~10초 → 같은 기업 다시 열면 캐시로 즉시. 비용·시간 절약 |

**EXAONE를 실제로 쓰는 3곳 (전부 이번에 직접 연결):**
1. **RM 영업 리포트 서사** — 기업의 D-Score·괴리·특허·R&D 신호를 넣으면 "결론/진단/추천 액션/근거/리스크"를 자동 작성
2. **공시 AI 요약** — 개별 공시를 RM 관점("이게 무슨 의미, 왜 이 신호, RM이 볼 점")으로 2~3문장 요약
3. **역방향 조회 키워드 추출** — 사용자가 평문으로 쓴 질의("AI 서버 수요 폭발로 고대역폭 메모리 증설")에서 **핵심 키워드를 뽑고** 관련 산업 생태계로 분류

> **(팀 AI 파이프라인 — 발표 시 언급용)**
> - **BGE-M3 임베딩 (AI-A)**: 공시 문장을 벡터로 바꿔 의미 기반 유사도 검색(pgvector). "역방향 조회"의 진짜 엔진.
> - **D-Score 가중합 (AI-B)**: 특허 수·IPC 엔트로피·R&D 성장률·발명자 증감 등 **행동 지표**를 가중합해 0~100 점수화. '공시 대비 행동' 괴리를 수치화.

---

### 3) 데이터 소스 (원천 데이터)

| 소스 | 무엇인지 | 왜 썼는지 |
|---|---|---|
| **DART OpenAPI** | 금융감독원 전자공시 공식 API | 대기업이 "무엇을 하겠다"고 **말한 내용(공시 텍스트)** 원천. CashMap의 입력 |
| **KIPRIS** | 특허청 특허정보 API | 협력사가 **실제로 한 행동(특허·R&D)** 원천. ADE D-Score의 입력 |

> 핵심 논리: **"말(DART) vs 행동(KIPRIS)"의 괴리** = 우리 서비스가 남과 다른 지점.

---

### 4) 프론트엔드 (화면·시각화)

| 기술 | 무엇인지 | 왜 썼는지 |
|---|---|---|
| **React 18 (CDN UMD) + Babel 브라우저 트랜스파일** | 빌드 과정 없이 JSX를 브라우저가 실시간 변환 | **`npm build` 없이 즉시 시연** — 데모/발표용 프로토타입을 빠르게 반복. 파일 열면 바로 화면 |
| **three.js / 3d-force-graph** | 3D 그래프 시각화 라이브러리 | **공급망 네트워크를 3D**로 — 대기업↔협력사 연결을 입체적으로 보여줘 "수혜 전파"를 직관적으로 |
| **순수 SVG 차트 (직접 구현)** | 라이브러리 없이 그린 레이더·도넛·다이버징·피어 바 차트 | FnGuide식 **"차트가 먼저, 텍스트는 보조"** 리포트. 라이브러리 의존 없이 가볍고, **PDF 인쇄에도 그대로** 나옴 |
| **window.ADE / window.G 전역 데이터 계약** | 화면과 데이터 소스 사이의 추상화 레이어 | 지금은 목업 데이터, 나중엔 실서버 — **화면 코드를 안 바꾸고 데이터 소스만 교체** 가능하게 설계 |
| **serve** | 정적 파일 서버 | 프론트(HTML/JS)를 `localhost:3000`으로 띄우는 간단한 도구 |

---

### 5) 발표에서 강조하면 좋은 설계 포인트

1. **하이브리드 데모 전략** — 풍부한 목업 UI(57개사·5섹션)는 유지하되, **리포트·요약·검색은 진짜 EXAONE가 생성**. "데모인데 AI는 진짜"라는 균형.
2. **로컬 AI = 데이터 주권** — 금융 민감 정보라 외부 LLM(ChatGPT 등)을 못 쓰는 상황에서, **로컬 EXAONE**로 규제·보안 문제를 회피한 게 실무적 강점.
3. **Graceful Fallback 설계** — LLM이 없어도, 서버가 없어도 화면이 비지 않음(룰베이스·목업 폴백). 발표 중 사고 대비.
4. **역할 분리 아키텍처** — BE는 **산출 로직을 만들지 않고 저장/제공 API 슬롯만** 담당, AI-A/AI-B가 결과를 적재. 협업 경계가 명확.
5. **야간 배치 사전 생성** — "버튼 눌러 만든다"가 아니라 **"열면 이미 리포트가 있다"** (현직자 멘토 피드백 반영).

### 6) 예상 Q&A (발표 대비)
- **Q. 왜 ChatGPT 안 쓰고 로컬 LLM?** → 여신·공시는 민감 금융정보. 외부 전송 시 규제·보안 리스크. 로컬 EXAONE는 데이터가 서버 밖으로 안 나감 + 비용 0.
- **Q. 왜 하필 EXAONE?** → 공시·여신 용어가 전부 한국어라 **한국어 특화 모델**이 유리, 2.4B라 로컬 구동 가능.
- **Q. 왜 빌드 없는 프론트?** → 발표용 프로토타입은 **빠른 반복·즉시 시연**이 중요. 실서비스 전환 시 Vite/Next 등으로 빌드 체계 이관 예정.
- **Q. 목업이 많은데 진짜 AI 맞나?** → UI 데이터는 목업이지만, **리포트 서사·공시 요약·역방향 키워드 추출은 실제 EXAONE 생성**(모델명 배지로 표시).

---

## 🩺 프로젝트 전체 진단 — 수정·미흡·추가 (2026-07-04 기준)

> 전체 구조를 훑고 정리한 **현재 상태 진단 + 우선순위 로드맵**.
> 아래 "다음 작업 목록(6/6)" 섹션보다 이 섹션이 최신이다.

### A. 수정해야 하는 부분 (잘못됐거나 위험한 것)

| # | 항목 | 내용 | 상태 |
|---|---|---|---|
| A1 | **리포트 사전 생성 미연결** | "열면 이미 있다" 라벨은 있는데 데모(목업) 기업은 실제로는 클릭 시 생성이었음 | ✅ **해결(7/4)** — 앱 부팅 후 우선순위(POSITIVE·고득점) 순으로 서사를 순차 사전 생성하는 워밍업 구현(`data.js warmupNarratives` + 상단바 진행 표시). 야간 배치와 동일 발상 |
| A2 | **Git 미사용** | 프로젝트 루트가 git 저장소가 아님 → 실수 한 번에 복구 불가, 팀 공유·이력 없음 | ✅ **해결(7/4)** — Git 재설치(winget) + `git init` + `.gitignore` + 초기 커밋(aa77bd5, 110파일). frontend/ 안의 CRA 잔재 .git 제거 |
| A3 | **.env 평문 노출 위험** | `backend/.env`에 **팀원 공유 Supabase 접속 문자열**·SECRET_KEY·DART 키가 평문 | ✅ **커밋 차단 확인(7/4)** — `.gitignore`로 제외 검증. 파일 자체는 로컬에만 존재 (배포 머신엔 직접 복사) |
| A4 | **CLAUDE.md 하단 스테일** | 디렉토리 구조·실행법·API 표가 6/6(로컬 Docker + TS 프론트) 기준으로 현실과 불일치 | ✅ **해결(7/4)** — 아래 섹션들 현행화 완료 |
| A5 | **LLM 캐시 휘발** | 서사/요약/역방향 캐시가 전부 인메모리 dict → **서버 재시작 시 전부 소실**, 재생성 비용 발생. `report_narratives` 테이블은 실DB 기업용으로만 사용 중 | 🔶 개선 여지 — 데모 서사도 input_hash 키로 테이블에 upsert하면 영속화 가능 (발표 전 서버 재시작 대비) |
| A6 | **잔재 파일 정리** | `init.sql`·`migrations/`(로컬 Docker 시절), `backend/batch.log`, `frontend/new_front/*.zip` | 🔶 부분 해결(7/4) — 구 compose는 `docker-compose.legacy.yml`로 개명, `docker-compose.yml`은 새 배포 구성으로 교체. 나머지는 `_archive/` 이동 권장 |
| A7 | **배포 환경 부재** | "어디서든 띄우는" 방법이 없었음 (venv+수동 명령 의존) | ✅ **해결(7/4)** — 도커 배포 구성: nginx(프론트+프록시)/backend/ollama(EXAONE) 3컨테이너, `docker compose up -d --build` 원커맨드. E2E 검증 완료(진짜 EXAONE 생성 확인) |

### B. 미흡한 부분 (동작하지만 약한 것)

| # | 항목 | 내용 |
|---|---|---|
| B1 | **테스트 0개** | pytest smoke 최소셋 필요 — /health, 로그인, narrative 폴백(Ollama 끈 상태), 데모 요약. 발표 직전 회귀 확인용으로 특히 가치 있음 |
| B2 | **역방향 조회의 실제 엔진 부재** | 현재 EXAONE는 **프리셋 시나리오 6개 중 분류**만 한다. 진짜 자유 검색(BGE-M3 + pgvector)은 AI-A 슬롯 대기 — `/api/reverse-query`는 임시 구현 그대로 |
| B3 | **EXAONE 2.4B 품질 한계** | 긴 지시를 가끔 무시(번호목록 폭주 이력 → 프롬프트 강제+파서 방어로 억제). `ollama pull exaone3.5:7.8b`(~4.8GB)로 올리면 품질 상승, 코드 수정은 모델명 1곳 |
| B4 | **live 모드 어댑터 불완전** | ✅ **반도체 섹션 실데이터 교체로 재구현(7/4)** — 구 `_adaptLive`는 limit=1000(422)·`ds.score` 필드명 오류로 동작한 적 없었음. 신규 `_overlayLive`: 목업 반도체(한성전자·에이펙스소재 등 5개사) **제거**, 그 자리에 실 앵커(삼성전자·SK하이닉스) + 실 공급망 엣지 15건 기반 **협력사 14개사** 배치. D-Score 산출 5개사는 실값, 미산출 9개사는 'D-Score 대기' 표기(잠정치=연결강도 기반). 칸반 풀·경보·역방향 랭킹·집계까지 신규 구성으로 재계산. 나머지 4개 섹션(조선·전기차·태양광·바이오)은 발표 데모 목업 유지 |
| B5 | **공급망 엣지 0행** | `supply_chain_edges` 비어 있음 → 3D 네트워크는 목업 전용. 실데이터화하려면 30~50개 관계 투입 필요 |
| B6 | **KIPRIS 키 미발급** | 특허 수집기 동작 불가 (AI-B가 자체 DB로 처리 중이라 데모에는 지장 없음) |
| B7 | **데모 계정 보안** | 전 계정 비번 `1234` — 데모 한정임을 발표 시 명시. 실서비스 전환 체크리스트에 포함 |
| B8 | **동시 LLM 요청 직렬화 없음** | 워밍업 중 RM이 리포트를 열면 Ollama에 요청 2개 동시 진입(Ollama가 큐잉하므로 동작은 하나 응답 지연). 인터랙티브 우선 큐는 미구현 |

### C. 추가하면 좋은 부분 (있으면 강해지는 것)

| # | 항목 | 내용 | 난이도 |
|---|---|---|---|
| C1 | **데모 서사 DB 영속화** | A5와 동일 — `report_narratives`에 input_hash 키로 upsert → 서버 재시작에도 "열면 이미 있다" 유지 | 하 |
| C2 | **워치리스트 알림** | 즐겨찾기 기업의 grade/괴리 변동 시 대시보드 상단 알림 — "선제 접근" 스토리 강화 | 중 |
| C3 | **발표 리허설 스크립트** | 시연 동선 고정: 로그인 → 허브 → 기업 → 리포트(사전 생성 즉시 표시) → 공시 AI 요약 → 역방향 AI 키워드. 각 화면에서 말할 한 줄까지 | 하 |
| C4 | **리포트 PDF 서버 생성 통일** | 데모 리포트는 `window.print()`, 실DB 리포트는 ReportLab — 두 경로 존재. 데모도 서버 PDF로 통일하면 일관성↑ (발표엔 print로 충분) | 중 |
| C5 | **pytest smoke** (B1과 동일) | CI 없이도 `pytest -q` 한 줄로 발표 전 안심 확인 | 하 |

### D. 우선순위 로드맵

```
P0 (이번 주 — 발표 안정성)
  ✅ A1 리포트 워밍업          (7/4 완료 — E2E 검증: 사전 생성분 즉시 표시)
  ✅ A4 문서 현행화            (7/4 완료)
  ✅ A2+A3 git init + .gitignore + 첫 커밋   (7/4 완료 — aa77bd5)
  ✅ A7 도커 배포 구성          (7/4 완료 — EXAONE 포함 원커맨드, E2E 검증)
  □ C3 발표 리허설 스크립트
P1 (다음 — 품질·안정)
  □ C1/A5 데모 서사 DB 영속화 (재시작 대비)
  □ B1/C5 pytest smoke 최소셋
  □ B3 exaone3.5:7.8b 업그레이드 검토 (디스크·속도 확인 후)
P2 (여유 시 — 완성도)
  □ A6 잔재 파일 _archive/ 정리
  □ C2 워치리스트 알림
  □ B4·B5 실데이터 전환 준비 (AI팀 산출물 일정에 맞춰)
```

---

## 팀 역할 분담

| 역할 | 담당 범위 |
|---|---|
| AI-A | CashMap NLP 파이프라인, BGE-M3 임베딩, 역방향 조회 로직 |
| AI-B | ADE D-Score 산출, KIPRIS 피처, 백테스팅 |
| BE (현재 파일 작성자) | FastAPI, PostgreSQL, 배치 스케줄러, 인증, 리포트, 프론트 연결 |
| FE | React 컴포넌트, UI 구현 보조 |
| PM | 기획, 발표, 일정 관리 |

> **BE 담당자가 건드리지 않는 영역**
> - `disclosures.embedding` 컬럼 채우기 → AI-A 담당
> - `disclosures.signal_score` 채우기 → AI-A 담당
> - `d_scores` 테이블 전체 산출 로직 → AI-B 담당
> - `patents.is_active` (연차료 납부 여부) 검증 → AI-B 담당
>
> BE는 위 결과를 **저장/제공하는 API 슬롯만** 담당한다 (산출 로직 X).

---

## 현재 디렉토리 구조 (2026-07-04 실제 기준)

```
cashmap/
├── CLAUDE.md                    # 이 문서
├── ADE_Handoff_v3.md            # 팀 핸드오프 문서
├── docker-compose.yml / init.sql / migrations/   # (구) 로컬 Docker 시절 잔재 — 현재는 Supabase 사용
├── dist/cashmap_dump.sql.gz     # DB 덤프 백업
│
├── backend/                     # FastAPI — 팀원 공유 Supabase(Postgres)에 연결
│   ├── venv/                    # 로컬 가상환경 (이 안의 python.exe 로 실행)
│   ├── .env                     # DATABASE_URL(공유 Supabase)·SECRET_KEY·DART 키 — 절대 커밋 금지
│   ├── main.py                  # 전체 엔드포인트 (아래 API 현황 참조)
│   ├── database.py / models.py / schemas.py / auth.py
│   ├── report_builder.py        # 실DB 기업용 PDF 리포트 (ReportLab + NanumGothic)
│   ├── report_narrative.py      # ⭐ EXAONE(Ollama) 서사·공시요약·역방향 해석 + 룰베이스 폴백
│   ├── scheduler.py             # APScheduler 야간 배치 02:00 (DART/KIPRIS 수집 + 서사 선생성)
│   ├── dart_collector.py / dart_body_collector.py / kipris_collector.py
│   ├── seed_dscores.py          # d_scores 초안 시드 (비파괴 — 공유 DB 주의)
│   └── assets/                  # NanumGothic 폰트 (PDF 한글)
│
└── frontend/                    # ⭐ 활성: 빌드리스 React (CDN UMD + Babel 브라우저 트랜스파일)
    ├── index.html               # 라이브러리 로드 + jsx 스크립트 등록
    ├── data.js                  # 목업 57개사 + window.ADE 데이터 계약 + 백엔드 연동/워밍업
    ├── app.jsx                  # 앱 셸 (로그인·라우팅·상단바)
    ├── hub.jsx / dashboard*.jsx / company-dash.jsx / detail.jsx   # 대시보드·기업 화면
    ├── network.jsx / network3d.jsx   # 공급망 지도 (three.js / 3d-force-graph)
    ├── reverse.jsx              # 역방향 조회 (EXAONE 키워드 추출 연동)
    ├── report.jsx               # RM 리포트 (SVG 차트 + EXAONE 서사 + print PDF)
    ├── disclosures.jsx / pipeline.jsx / login.jsx / components.jsx
    ├── styles.css / network.css
    ├── version1/                # (아카이브) 구 TypeScript + react-router 앱 — 유지만
    └── new_front/               # 새 디자인 원본 zip (참고용)
```

---

## 실행 방법 (2026-07-04 현행)

### 방법 A — 도커 (배포/시연용 · ⭐ 권장, EXAONE 포함 원커맨드)

```powershell
cd cashmap
docker compose up -d --build
# → http://localhost:3000  (nginx가 프론트 서빙 + /api를 백엔드로 프록시 → CORS 없음)
# 구성: frontend(nginx:3000) → backend(FastAPI:8000) → ollama(EXAONE) + 외부 Supabase
# 최초 1회 ollama-init이 EXAONE 1.6GB를 도커 볼륨에 받음(수 분). 그동안은 룰베이스 폴백.
# 종료: docker compose down   /   로그: docker compose logs -f backend
```

> 도커가 깔린 **어떤 머신이든**(발표장 PC·팀원 노트북·유료 VPS) 이 한 줄로 전체가 뜬다.
> 필요한 것: 이 저장소 + `backend/.env`(비밀이라 git에 없음 — 직접 복사) + Docker.
> 호스트에 Ollama가 이미 있으면 모델 재다운로드 없이:
> `$env:OLLAMA_URL='http://host.docker.internal:11434'; docker compose up -d backend frontend`

### 방법 B — 로컬 개발 (코드 수정하며 작업할 때)

```powershell
# 0) Ollama — 설치돼 있으면 자동 사용, 없어도 룰베이스 폴백으로 동작
#    (localhost:11434, 설치 모델: exaone3.5:2.4b)

# 1) 백엔드  ⚠️ PYTHONIOENCODING=utf-8 필수 (없으면 한글 로그에서 cp949 크래시)
cd cashmap/backend
$env:PYTHONIOENCODING='utf-8'; .\venv\Scripts\python.exe -m uvicorn main:app --port 8000
# → http://localhost:8000/docs

# 2) 프론트 (정적 서버 — 빌드 없음)
cd cashmap/frontend
npx serve -l 3000 .
# → http://localhost:3000  (데모 계정: admin / rm01 / ib01 / audit01, 비번 1234)

# 배치 수동 실행 (테스트용)
cd cashmap/backend
$env:PYTHONIOENCODING='utf-8'; .\venv\Scripts\python.exe scheduler.py
```

> ❌ docker-compose 실행법은 폐기됨 (로컬 Docker DB → 팀원 공유 Supabase로 전환).

---

## 환경변수 설정 (backend/.env)

```
DATABASE_URL=      # ⚠️ 팀원 공유 Supabase(Postgres) 접속 문자열 — 파괴적 작업 절대 금지
SECRET_KEY=        # 필수: 32바이트 이상 랜덤값. 기본값/미설정 시 서버 부팅 거부
DART_API_KEY=      # ✅ 발급 완료 (40자 실키)
KIPRIS_API_KEY=    # ⚠️ 미발급/placeholder — KIPRIS 수집기 동작 불가
CORS_ORIGINS=http://localhost:3000   # 쉼표 구분 다중 가능 (선택)
```

> ⚠️ **auth.py가 SECRET_KEY를 강제 검증한다.** 미설정이거나 `cashmap-secret-key`(기본값)면
> 서버가 `RuntimeError`로 부팅을 거부하므로 반드시 랜덤값으로 교체할 것.
> ⚠️ **DB는 팀원들과 공유하는 Supabase다.** DROP/TRUNCATE/DELETE 금지, 시드는 비파괴(upsert/skip)로만.

---

## 공유 Supabase 실데이터 현황 (2026-07-04 직접 조회)

| 테이블 | 행 수 | 내용 |
|---|---|---|
| `companies` | **7** | 앵커 2(삼성전자·SK하이닉스) + 협력사 5(솔브레인·피에스케이·한미반도체·원익QnC·파크시스템스) |
| `d_scores` | **5** | AI-B 투입(7/2) — 솔브레인 0.69 POSITIVE ~ 파크시스템스 0.43 MONITOR. 피처(특허·R&D 등) 포함 |
| `signal_scores` | **22** | ⚠️ **기업 22개가 아니라 신호 이력 22건** (삼성전자 8 + SK하이닉스 14, 공시 시점별) — "22개" 혼동 주의 |
| `disclosures` | 456 | 삼성전자 328 + SK하이닉스 128 (청크) |
| `embeddings` | 226 | AI-A 임베딩 |
| `supply_chain_edges` | **15** | 삼성전자→8개사, SK하이닉스→7개사 (원익IPS·동진쎄미켐·테스·리노공업·케이씨텍·유진테크·네패스·하나마이크론·에스앤에스텍 등, source=DEMO) |
| `company_financials` | 0 | 비어 있음 |

> 프론트 반도체 섹션은 위 실데이터(d_scores ∪ edges = **협력사 14개사**)로 구성된다.
> D-Score 없는 9개사가 실점수를 받으려면 **AI-B가 `POST /api/ade/dscore/batch`로 추가 투입**하면 자동 반영.

---

## DB 스키마 요약

| 테이블 | 역할 | 비고 |
|---|---|---|
| `users` | 로그인/권한 | emp_id(사번)/password(bcrypt)/role/name. ROLE_RM / ROLE_IB / ROLE_AUDIT / ROLE_ADMIN |
| `companies` | 기업 기본 정보 | is_anchor=true → 대기업(삼성전자 등) |
| `disclosures` | DART 공시 원문 + 임베딩 + 하이라이트 | embedding(vector 768), highlights(JSONB) — AI-A 담당 |
| `supply_chain_edges` | 공급망 관계 | tier 1/2/3차, source DART/KIPRIS/NEWS, (anchor_id,supplier_id) UNIQUE |
| `patents` | KIPRIS 특허 | patent_no UNIQUE, is_active — AI-B 담당 |
| `d_scores` | ADE D-Score 결과 | grade POSITIVE/NEGATIVE/MONITOR. AI-B 산출, BE는 API 제공만 |
| `signal_scores` | CashMap 신호 강도 이력 | disclosure_id 연결 가능. AI-A 담당 산출 |

---

## API 엔드포인트 현황 (2026-07-04 — main.py 실제 라우트 기준)

> Supabase 전환(6월 말) 때 백엔드가 팀원 DB 스키마에 맞춰 재정렬되면서
> 구버전 문서에 있던 patents/highlights/admin-batch 계열 슬롯은 **현재 코드에 없음**.

### 조회 (READ)
| Method | Endpoint | 설명 |
|---|---|---|
| GET | `/health` | DB 연결 확인 (프론트 bootstrap 프로브) |
| GET | `/api/companies` (+`/:id`) | 기업 목록/상세 |
| GET | `/api/cashmap/signal` | 신호 강도 목록 |
| GET | `/api/cashmap/signal/summary` | 대기업별 최신 신호 + 트렌드 |
| GET | `/api/cashmap/signal/trend` | 신호 시계열 (차트용) |
| GET | `/api/disclosures` | 공시 목록 |
| GET | `/api/cashmap/disclosures/:company_id` | 기업별 공시 문서 요약 |
| GET | `/api/disclosures/:rcept_no` | 공시 단건 상세 (청크 본문) |
| GET | `/api/disclosures/:rcept_no/similar` | 유사 공시 (pgvector) |
| GET | `/api/supply-chain` | 공급망 관계 (현재 0행) |
| GET | `/api/cashmap/network/:id` | 공급망 nodes/edges |
| GET | `/api/ade/dscore` (+`/:company_id`) | D-Score 목록/상세 |
| GET | `/api/report/:id` (+`/pdf`) | 실DB 기업 RM 리포트 JSON / PDF(ReportLab) |
| POST | `/api/reverse-query` | 🔶 임시 — D-Score 순위 기반 (BGE-M3 대기) |

### AI 생성 (⭐ EXAONE — 인증 불요, 데모 목업 기업 포함)
| Method | Endpoint | 설명 |
|---|---|---|
| POST | `/api/report/narrative` | RM 리포트 서사 생성 (결론·진단·액션·근거·리스크). 입력 해시 캐시 |
| POST | `/api/disclosures/:rcept_no/summary` | 실데이터 공시 원문 요약 |
| POST | `/api/disclosures/summary` | 데모 공시 메타(제목·발췌·키워드) 기반 RM 관점 요약 |
| POST | `/api/reverse/interpret` | 자유 질의 → 키워드 추출 + 산업 시나리오 분류 |

### 투입 슬롯 / 인증
| Method | Endpoint | 설명 |
|---|---|---|
| POST | `/api/companies` | 기업 등록 (ADMIN) |
| POST | `/api/ade/dscore` (+`/batch`) | D-Score 투입 — AI-B 슬롯 (ADMIN) |
| POST | `/api/auth/login·refresh·logout·register`, GET `/api/auth/me` | JWT 인증 세트 |

### 권한(RBAC) 규칙
- `READ_ROLES` = RM / IB / AUDIT / ADMIN → 조회·리포트
- `AI_INGEST_ROLES` = ADMIN → AI 결과 투입 슬롯
- 인증은 `require_role(*roles)` 디펜던시로 부여 (auth.py)
- AI 생성 4종은 데모 편의상 미인증 (실서비스 전환 시 READ_ROLES 부여 필요)

---

## 프론트엔드 현황 (2026-07-04 — 활성 빌드리스 앱 기준)

| 화면 | 파일 | 상태 |
|---|---|---|
| 로그인 | `login.jsx` | ✅ JWT 연동 + 데모 계정 폴백 |
| 허브(진입) + 섹터 리스트 | `hub.jsx` | ✅ 목업 57개사 · 즐겨찾기 |
| 기업 대시보드 | `company-dash.jsx`, `dashboard*.jsx` | ✅ 신호·피처·공시 |
| 기업 상세 패널 | `detail.jsx` | ✅ |
| 공급망 지도 (3D) | `network.jsx`, `network3d.jsx` | ✅ three.js/3d-force-graph (목업 전용) |
| 역방향 조회 | `reverse.jsx` | ✅ ⭐ EXAONE 키워드 추출 + 룰베이스 폴백 |
| 공시 확인 + AI 요약 | `disclosures.jsx` | ✅ ⭐ 실데이터·데모 공시 모두 EXAONE 요약 |
| RM 리포트 (2면 + 사이드) | `report.jsx` | ✅ ⭐ SVG 차트 6종 + EXAONE 서사 + 사전 생성(워밍업) + print PDF |
| 접촉 파이프라인 (칸반) | `pipeline.jsx` | ✅ 목업 |

- 데이터 계약: `data.js`의 `window.ADE` 한 곳 (mock / mock-demo / live 3모드, bootstrap 프로브)
- 리포트 사전 생성: 부팅 4초 후 `warmupNarratives()` 순차 실행 — 상단바에 진행 표시
- (아카이브) `version1/` 구 TS 앱의 `/validation`·공시 하이라이트 뷰어 등은 현재 미사용

---

## 🔆 공시 하이라이트 기능 (2026-06-06 추가) — ⚠️ 구버전(version1 TS 앱) 기준 기록

> "공시 본문에서 AI가 신호 문장을 짚어준다" — CashMap 핵심 가치를 눈으로 보여주는 히어로 기능.
> 설계 결정: **화면 인터랙티브 주력 + PDF엔 핵심 발췌만** / **룰베이스 생성기는 만들지 않고 AI-A 결과를 받는 배관만 구축**.

### 완료 (BE/FE 배관)
- DB: `disclosures.highlights` JSONB 컬럼 (`models.py`, `init.sql`)
- 조회: `GET /api/disclosures/:id` (본문+하이라이트), 목록(`/api/cashmap/disclosures/:id`)에도 highlights 포함
- 투입 슬롯(AI-A, ROLE_ADMIN): `PATCH /api/disclosures/:id/highlights`, `POST /api/disclosures/highlights/batch`
- 화면: `/disclosure/:id` 뷰어 — 본문 `<mark>` 렌더(`lib/highlight.ts`, sentence substring 매칭) + 호버 툴팁(점수·유형) + 상단 신호 요약. 데이터 없으면 graceful empty
- 진입 동선: 기업상세(`/company/:id`) "최근 공시" 목록 → 클릭 → 뷰어, 신호 개수 뱃지
- PDF: RM 리포트에 회사 최근 공시 하이라이트 상위 5문장 발췌 자동 첨부(`report_builder.py`)

### 데이터 계약 (AI-A가 채울 형태)
```jsonc
// PATCH /api/disclosures/:id/highlights
{ "highlights": [ { "sentence": "본문에서 그대로 잘라낸 문장", "score": 0.0~1.0, "category": "CAPEX_증설" } ] }
// POST /api/disclosures/highlights/batch
[ { "disclosure_id": 12, "highlights": [ /* 위와 동일 */ ] } ]
```

### ⚠️ 남은 작업 / 추가 필요 (이 기능을 "실제로 보이게" 하려면)
1. ~~**[BE·전제조건] 공시 원문 적재 경로 부재**~~ → ✅ **해소**: `POST /api/disclosures`(+batch) 추가 완료.
   AI-A가 전처리한 공시 본문(+선택적 signal_score/highlights)을 이 슬롯으로 투입하면 됨. embedding만 AI-A가 직접 SQL 업데이트.
2. **[BE] 데모/시드 데이터** — `init.sql`에 본문 + 샘플 하이라이트 몇 건 추가해야 화면·발표에서 즉시 보임 (실데이터 하이라이트는 AI-A 몫이나 시연용 더미는 BE가 넣어도 무방).
3. **[BE↔AI-A 합의] sentence 매칭 견고성** — 프론트는 본문 substring 매칭. AI-A가 본문을 정규화(공백/줄바꿈 정리)해서 sentence를 주면 원문과 안 맞아 **하이라이트가 조용히 누락**됨.
   → "본문 원문 그대로의 substring을 줄 것" 합의 필수. 향후 offset 기반/정규화 매칭으로 보강 고려.
4. **[BE↔AI-A 합의] category 표준값 확정** — 색상/필터가 category에 의존하게 될 수 있으니 enum 합의 (예: `CAPEX_증설 / 수주 / R&D / M&A / 지분투자`).
5. **[검증] 실동작 확인 미완** — 현재 정적 분석(py_compile, tsc)만 통과. DB 기동 + 더미로 E2E 확인 + ingest/조회 smoke 테스트 필요.
6. **[운영] AI-A 투입 인증** — 슬롯이 ROLE_ADMIN 전용. AI-A가 직접 호출하려면 ADMIN 토큰/전용 계정 정책 필요.
7. **[FE·선택] UX 보강** — 카테고리별 색상/필터, 본문 내 하이라이트로 점프, 긴 본문 접기, 신호 강도 범례.
8. **[BE·선택] PDF 발췌 범위** — 현재 "최근 1건" 공시만 첨부. 여러 공시 종합 발췌가 필요할 수 있음.

---

## 다음 작업 목록 (우선순위 순) — ⚠️ 6/6 기준 기록. **최신 우선순위는 위 "🩺 프로젝트 전체 진단" 섹션의 로드맵 참조**

### BE 담당
- [x] 공급망 네트워크 API 추가
- [x] JWT 인증 구현 (AUTH-001) — login/refresh/logout/me/register + RBAC
- [x] RM 액션 리포트 PDF (`/api/report/:id`, `/api/report/:id/pdf`)
- [x] 공시 하이라이트 기능 배관 (DB/API/뷰어/PDF) — 상세는 위 "🔆 공시 하이라이트 기능" 섹션
- [x] **공시 원문 적재 경로 추가** `POST /api/disclosures`(+batch) ⭐ — 하이라이트 기능의 전제조건
  - API 수집 패스 → AI-A 전처리 공시 본문을 받을 입구. 본문 없으면 하이라이트가 동작 안 함
  - rcept_no(DART 접수번호) 중복 방지: 단건 409 / 배치 skip. embedding은 AI-A가 직접 SQL 업데이트
- [ ] **데모/시드 데이터 보강** (`init.sql`) — 공시 본문 + 샘플 하이라이트 + d_scores/signal 등
  - 현재 회사 5·유저 3만 있어 화면/발표가 빈 상태
- [ ] **ingest/조회 smoke 테스트** (pytest) — 하이라이트·인증·적재 슬롯 실동작 검증 (현재 테스트 0개)
- [ ] **(데이터 수집은 패스)** ~~KIPRIS 키 발급 / DART 수집 테스트~~ → AI 담당자가 전처리·학습 후 적재 슬롯으로 투입
- [ ] **supply_chain_edges 데이터 투입** — AI/수작업으로 1차 협력사 관계 INSERT
  - 삼성전자·SK하이닉스 → 피에스케이, 원익QnC, 한미반도체 등 30~50개 → `/network` 실데이터화

### AI-A 담당 슬롯 (BE 건드리지 말 것)
- [ ] BGE-M3 임베딩 파이프라인 → `disclosures.embedding` 채우기
- [ ] 신호 강도 S 산출 → `signal_scores` 테이블 채우기
  - 투입 경로: `PATCH /api/disclosures/:id/signal`, `POST /api/cashmap/signal/batch`
- [ ] **공시 하이라이트(신호 문장) 추출 → 투입** (BE/FE 배관 완료, AI-A 결과만 대기)
  - 투입 경로: `PATCH /api/disclosures/:id/highlights`, `POST /api/disclosures/highlights/batch`
  - 포맷: `[{sentence, score, category}]` — 위 "AI 담당자 투입 흐름" 참고
  - 화면(`/disclosure/:id`)·PDF 발췌는 데이터만 들어오면 즉시 표시됨
- [ ] `/api/reverse-query` pgvector 유사도 검색으로 교체

### AI-B 담당 슬롯 (BE 건드리지 말 것)
- [ ] D-Score 가중합 산출 → `d_scores` 테이블 채우기 (`POST /api/ade/dscore/batch`)
- [ ] KIPRIS 특허 수집 → `POST /api/patents/batch`
- [ ] KOSDAQ 백테스팅 실행 → `/validation` 페이지 실데이터화

---

## 주요 의존성

```
# backend (requirements.txt)
fastapi, uvicorn[standard], sqlalchemy, psycopg2-binary
python-dotenv, alembic, pgvector, pydantic-settings, apscheduler
python-jose[cryptography], passlib[bcrypt]   # JWT 인증
requests                                       # DART/KIPRIS API 호출용
reportlab                                      # PDF 리포트

# frontend (package.json) — TypeScript 기반
react 19, react-dom 19, react-router-dom 6
recharts          # 차트
lucide-react      # 아이콘
tailwindcss, clsx, tailwind-merge   # 스타일
```

---

## AI 담당자 투입 흐름 (BE ↔ AI 인터페이스)
```
AI-A 흐름:
  BGE-M3 임베딩 산출
    → PATCH /api/disclosures/:id/signal       (문서 단위 signal_score 업데이트)
    → POST  /api/cashmap/signal/batch         (신호 강도 이력 저장)
    → (embedding 컬럼은 AI-A가 pgvector로 직접 SQL 업데이트)
  공시 본문 신호 문장 추출(하이라이트)
    → PATCH /api/disclosures/:id/highlights   (단건 교체)
    → POST  /api/disclosures/highlights/batch (일괄 투입)

    ※ 하이라이트 포맷 (문장 단위 — 본문에서 그대로 잘라낸 sentence):
      [{ "sentence": "...본문 그대로...", "score": 0.0~1.0, "category": "CAPEX_증설|수주|R&D|M&A|..." }]
      배치 항목: { "disclosure_id": 12, "highlights": [ ...위 형태... ] }
      → 프론트 /disclosure/:id 가 sentence를 본문에서 매칭해 <mark> 렌더,
        RM 리포트 PDF에도 상위 5문장 발췌가 자동 첨부됨.

AI-B 흐름:
  D-Score 가중합 산출
    → POST /api/ade/dscore/batch         (D-Score 일괄 저장)
  KIPRIS 특허 수집
    → POST /api/patents/batch            (특허 일괄 저장)

※ 위 투입 슬롯은 모두 ROLE_ADMIN 토큰 필요 (AI_INGEST_ROLES)
```

---

## 크리티컬 리스크 (WBS 기준)

| 리스크 | 시점 | 대응 |
|---|---|---|
| 공시 본문 적재 경로 부재 | ~~현재~~ 해소 | ✅ `POST /api/disclosures`(+batch) 추가 완료 — AI-A 전처리 본문 투입 가능 |
| 화면/발표용 시드 데이터 부족 | 현재 | `init.sql`에 본문+하이라이트+점수 더미 투입 |
| AI 산출 결과 핸드오프 지연 | 상시 | 적재 슬롯·데이터 계약 선확정(완료), 더미로 BE/FE 선검증 |
| KIPRIS 법인명 매핑 정확도 낮음 | 1주차 | 수작업 보완 예비 이틀 확보 (AI-B) |
| 선행 상관계수 r < 0.65 | 2주차 | SK하이닉스 추가 또는 섹터 확대 |
| D-Score Precision < 0.60 | 5주차 | 가중치 재조정 (룰베이스라 빠름) |
| 통합 E2E 버그 | 6주차 | 8주차 버퍼 주차로 처리 |

---

## 참고 문서

- `기능명세서_CashMap_ADE.md` — 전체 기능 명세 (API, UI, 에러 처리)
- `init.sql` — DB 스키마 전체 + 더미 데이터
- DART OpenAPI 문서: https://opendart.fss.or.kr/guide/main.do
- KIPRIS Plus API 문서: https://plus.kipris.or.kr/portal/html/menu/menu04010100.html
