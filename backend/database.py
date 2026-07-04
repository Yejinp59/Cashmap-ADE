from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
import os

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL 환경변수가 설정되지 않았습니다. "
        "backend/.env 또는 docker-compose의 environment에서 지정하세요."
    )

# 커넥션 풀 — 배치 + 동시 사용자 부하 대비
DB_POOL_SIZE     = int(os.getenv("DB_POOL_SIZE",     "10"))
DB_MAX_OVERFLOW  = int(os.getenv("DB_MAX_OVERFLOW",  "20"))
DB_POOL_RECYCLE  = int(os.getenv("DB_POOL_RECYCLE",  "1800"))   # 30분

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_size=DB_POOL_SIZE,
    max_overflow=DB_MAX_OVERFLOW,
    pool_recycle=DB_POOL_RECYCLE,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# DB 세션 의존성 주입용
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
