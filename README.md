# Cashmap-ADE
# 💰 Cashmap-ADE

> 현금 흐름 지도 기반 ADE(Automated Decision Engine) 프로젝트

## 👥 팀원 및 역할

| 이름 | 역할 |
|------|------|
| 박예진 | PM / FE / UI |
| 이윤지 | AI |
| 김성희 | AI |
| 신승민 | BE |

---

## 🛠 기술 스택

### AI
- BGE-M3 임베딩 파이프라인
- NetworkX (역방향 조회 로직)
- DART OpenAPI / KIPRIS Plus API 연동

### Backend
- FastAPI
- PostgreSQL + pgvector
- Python

### Frontend
- React
- React Force Graph (전파 경로 시각화)

---

## 📁 프로젝트 구조

```
Cashmap-ADE/
├── ai/          # AI 모델 및 알고리즘
├── backend/     # FastAPI 서버
├── frontend/    # React 앱
└── README.md
```

---

## 🚀 실행 방법

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm start
```

---

## 🌿 브랜치 전략

```
main        ← 최종 배포용 (직접 push 금지)
develop     ← 개발 통합 브랜치
├── feature/AI-xxx
├── feature/BE-xxx
└── feature/FE-xxx
```

- 작업은 반드시 `feature/` 브랜치에서
- 완료 후 `develop`으로 PR 요청
- `main` 직접 push 금지

---

## 📅 개발 일정

| 주차 | 주요 내용 |
|------|-----------|
| 1주차 | 환경 세팅, 데이터 수집, 네트워크 구축 |
| 2주차 | CashMap 임베딩, API 기반 구성 |
| 3주차 | CashMap 알고리즘, ADE 피처 개발 |
| 4주차 | CashMap 완료, ADE 검증 |
| 5주차 | 성능 최적화, D-Score 파이프라인 |
| 6주차 | 통합 지원, 전체 API 완성 |
| 7주차 | 데모 검증, 3장 AI 시나리오 점검 |
| 8주차 | 백업 구축, 예외 처리, 버그 수정 |
| 9주차 | 최종 점검, 발표 준비 |

---

## ⚙️ 환경변수

`.env` 파일을 루트에 생성 후 아래 항목 입력 (`.env`는 git에 포함되지 않음):

```
DATABASE_URL=
DART_API_KEY=
KIPRIS_API_KEY=
```
