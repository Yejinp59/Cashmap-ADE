# Backend — CashMap × ADE FastAPI 서버

Python 3.12 + FastAPI + PostgreSQL(pgvector) + APScheduler.
DART/KIPRIS 외부 데이터 수집과 RM 대시보드 API를 제공.

---

## 파일 한눈에 보기

### 진입점 / 핵심
| 파일 | 한 줄 |
|---|---|
| `main.py` | FastAPI 앱 진입점. 36개 라우트(인증·D-Score·신호·공급망·특허·공시·리포트·배치) 정의 |
| `database.py` | SQLAlchemy 엔진 + 세션 팩토리 + `get_db()` 의존성 주입 |
| `models.py` | DB 테이블 모델 7개 (User, Company, Disclosure, SupplyChainEdge, Patent, DScore, SignalScore) |
| `schemas.py` | Pydantic 요청/응답 스키마 (CompanyResponse, DScoreCreate, LoginRequest 등) |

### 인증
| 파일 | 한 줄 |
|---|---|
| `auth.py` | JWT 발급·검증 (HS256, access 1h + refresh 7d), bcrypt 해싱, `require_role()` 역할 가드 |

### 배치 / 데이터 수집
| 파일 | 한 줄 |
|---|---|
| `scheduler.py` | APScheduler — 매일 02:00 KST에 DART + KIPRIS 야간 배치 실행. Lock으로 동시 실행 방지 |
| `dart_collector.py` | DART OpenAPI 공시 수집기. `requests.Session` + Retry + 페이지 IN dedup |
| `kipris_collector.py` | KIPRIS Plus 특허 수집기. 월 1,000회 호출 카운터 가드 |

### 리포트
| 파일 | 한 줄 |
|---|---|
| `report_builder.py` | ReportLab + NanumGothic으로 RM 액션 리포트 PDF 생성. `build_pdf()` + `build_recommendation()` 룰베이스 |
| `assets/NanumGothic*.ttf` | PDF 한글 폰트 (SIL OFL, 무료) |

### 설정 / 환경
| 파일 | 한 줄 |
|---|---|
| `requirements.txt` | Python 의존성 (fastapi, sqlalchemy, psycopg2, apscheduler, reportlab 등) |
| `Dockerfile` | 백엔드 컨테이너 이미지 정의 |
| `.env` | 환경변수 (DATABASE_URL, SECRET_KEY, DART_API_KEY, KIPRIS_API_KEY) — **git 금지** |
| `venv/` | Python 가상환경 (로컬 실행용) |

---

## 의존 관계

```
main.py
  ├─ database.py  (engine, get_db)
  ├─ models.py    (테이블)
  ├─ schemas.py   (요청/응답)
  ├─ auth.py      (require_role, get_current_user)
  ├─ scheduler.py (lifespan에서 시작)
  │    ├─ dart_collector.py
  │    └─ kipris_collector.py
  └─ report_builder.py  (PDF 엔드포인트)
```

---

## 실행

```bash
# 로컬 (DB는 docker)
docker-compose up -d db
cd backend
.\venv\Scripts\Activate.ps1   # Windows
pip install -r requirements.txt
uvicorn main:app --reload
# → http://localhost:8000
# → http://localhost:8000/docs  (Swagger)
```

상세 흐름은 루트의 `CLAUDE.md` 참고.
