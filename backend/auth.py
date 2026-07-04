from datetime import datetime, timedelta, timezone
from typing import Optional
import bcrypt
import os
from dotenv import load_dotenv

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from database import get_db
from models import User

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY or SECRET_KEY == "cashmap-secret-key":
    raise RuntimeError(
        "SECRET_KEY 환경변수가 설정되지 않았거나 기본값입니다. "
        "운영/개발 모두 32바이트 이상의 랜덤 값으로 교체하세요."
    )

ALGORITHM            = "HS256"
ACCESS_TOKEN_EXPIRE  = timedelta(hours=1)
REFRESH_TOKEN_EXPIRE = timedelta(days=7)

http_bearer = HTTPBearer()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_token(data: dict, expires: timedelta) -> str:
    payload = data.copy()
    payload["exp"] = datetime.now(timezone.utc) + expires
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def create_access_token(emp_id: str, role: str) -> str:
    return create_token({"sub": emp_id, "role": role, "type": "access"}, ACCESS_TOKEN_EXPIRE)

def create_refresh_token(emp_id: str) -> str:
    return create_token({"sub": emp_id, "type": "refresh"}, REFRESH_TOKEN_EXPIRE)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="유효하지 않거나 만료된 토큰입니다.",
            headers={"WWW-Authenticate": "Bearer"},
        )


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(http_bearer),
    db: Session = Depends(get_db),
) -> User:
    payload = decode_token(credentials.credentials)
    if payload.get("type") != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Access Token이 아닙니다.")
    emp_id = payload.get("sub")
    user = db.query(User).filter(User.emp_id == emp_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="사용자를 찾을 수 없습니다.")
    return user


def require_role(*roles: str):
    def checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"접근 권한이 없습니다. 필요 역할: {', '.join(roles)}",
            )
        return current_user
    return checker