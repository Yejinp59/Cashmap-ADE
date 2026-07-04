FROM python:3.11-slim

WORKDIR /app

# 한글 로그 깨짐/크래시 방지 (Windows 로컬 실행 시 PYTHONIOENCODING과 동일 목적)
ENV PYTHONIOENCODING=utf-8 \
    PYTHONUNBUFFERED=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
