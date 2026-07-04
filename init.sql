-- pgvector 확장 활성화
CREATE EXTENSION IF NOT EXISTS vector;

-- 사용자 테이블
CREATE TABLE IF NOT EXISTS users (
    id          SERIAL PRIMARY KEY,
    emp_id      VARCHAR(20) UNIQUE NOT NULL,
    password    VARCHAR(255) NOT NULL,
    role        VARCHAR(20) NOT NULL CHECK (role IN ('ROLE_RM', 'ROLE_IB', 'ROLE_AUDIT', 'ROLE_ADMIN')),
    name        VARCHAR(50) NOT NULL,
    created_at  TIMESTAMP DEFAULT NOW()
);

-- 기업 테이블
CREATE TABLE IF NOT EXISTS companies (
    id              SERIAL PRIMARY KEY,
    corp_code       VARCHAR(20) UNIQUE,
    corp_name       VARCHAR(100) NOT NULL,
    biz_no          VARCHAR(20),
    is_listed       BOOLEAN DEFAULT FALSE,
    is_anchor       BOOLEAN DEFAULT FALSE,
    sector          VARCHAR(50),
    created_at      TIMESTAMP DEFAULT NOW()
);

-- 자주 필터되는 컬럼 인덱스
CREATE INDEX IF NOT EXISTS companies_is_anchor_idx ON companies (is_anchor);
CREATE INDEX IF NOT EXISTS companies_sector_idx    ON companies (sector);
CREATE INDEX IF NOT EXISTS companies_corp_name_idx ON companies (corp_name);

-- 공시 테이블 (pgvector 임베딩 포함)
CREATE TABLE IF NOT EXISTS disclosures (
    id              SERIAL PRIMARY KEY,
    company_id      INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    rcept_no        VARCHAR(14) UNIQUE,                   -- DART 접수번호
    title           VARCHAR(500),
    content         TEXT,
    embedding       vector(768),
    signal_score    FLOAT,
    highlights      JSONB,                                -- 문장 단위 하이라이트 [{sentence,score,category}] (AI-A 투입)
    disclosed_at    DATE NOT NULL,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- 기존 DB에 highlights 컬럼 누락 시 보강
ALTER TABLE disclosures
    ADD COLUMN IF NOT EXISTS highlights JSONB;

-- 기존 DB에 컬럼 누락 시 보강 (init.sql 재실행 안 해도 됨)
ALTER TABLE disclosures
    ADD COLUMN IF NOT EXISTS rcept_no VARCHAR(14);
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'disclosures_rcept_no_key'
    ) THEN
        ALTER TABLE disclosures
            ADD CONSTRAINT disclosures_rcept_no_key UNIQUE (rcept_no);
    END IF;
END $$;

-- 벡터 유사도 검색 인덱스
CREATE INDEX IF NOT EXISTS disclosures_embedding_idx
ON disclosures USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- 기업별 공시 시계열 조회용
CREATE INDEX IF NOT EXISTS disclosures_company_disclosed_idx
ON disclosures (company_id, disclosed_at DESC);

-- 공급망 관계 테이블
CREATE TABLE IF NOT EXISTS supply_chain_edges (
    id              SERIAL PRIMARY KEY,
    anchor_id       INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    supplier_id     INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    tier            INTEGER NOT NULL CHECK (tier IN (1, 2, 3)),
    source          VARCHAR(50) CHECK (source IN ('DART', 'KIPRIS', 'NEWS')),
    weight          FLOAT DEFAULT 1.0,
    created_at      TIMESTAMP DEFAULT NOW(),
    UNIQUE(anchor_id, supplier_id)
);

-- 역방향 조회용 (특정 협력사가 누구와 연결됐는지)
CREATE INDEX IF NOT EXISTS supply_chain_supplier_idx
ON supply_chain_edges (supplier_id);

-- 특허 테이블
CREATE TABLE IF NOT EXISTS patents (
    id              SERIAL PRIMARY KEY,
    company_id      INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    patent_no       VARCHAR(50) UNIQUE NOT NULL,
    ipc_code        VARCHAR(20),
    inventor_count  INTEGER,
    is_active       BOOLEAN DEFAULT TRUE,
    filed_at        DATE,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- 기업별 특허 시계열 조회용
CREATE INDEX IF NOT EXISTS patents_company_filed_idx
ON patents (company_id, filed_at DESC NULLS LAST);

-- 활성 특허 필터링용 (D-Score 산출 시 자주 사용)
CREATE INDEX IF NOT EXISTS patents_company_active_idx
ON patents (company_id) WHERE is_active = TRUE;

-- D-Score 테이블
CREATE TABLE IF NOT EXISTS d_scores (
    id                  SERIAL PRIMARY KEY,
    company_id          INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    score               FLOAT NOT NULL,
    grade               VARCHAR(20) NOT NULL CHECK (grade IN ('POSITIVE', 'NEGATIVE', 'MONITOR')),
    is_partial          BOOLEAN DEFAULT FALSE,
    patent_count        INTEGER,
    ipc_entropy         FLOAT,
    inventor_growth     FLOAT,
    rd_ratio            FLOAT,
    rd_growth           FLOAT,
    op_margin_slope     FLOAT,
    signal_score        FLOAT,
    calculated_at       TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS d_scores_company_idx
ON d_scores (company_id, calculated_at DESC);

-- 신호 강도 이력 테이블
CREATE TABLE IF NOT EXISTS signal_scores (
    id              SERIAL PRIMARY KEY,
    company_id      INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    score           FLOAT NOT NULL,
    disclosure_id   INTEGER REFERENCES disclosures(id) ON DELETE SET NULL,
    scored_at       DATE NOT NULL,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- 기존 DB에 created_at 누락 시 보강
ALTER TABLE signal_scores
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

CREATE INDEX IF NOT EXISTS signal_scores_company_idx
ON signal_scores (company_id, scored_at DESC, created_at DESC);

-- 더미 데이터 삽입
INSERT INTO companies (corp_name, is_listed, is_anchor, sector) VALUES
  ('삼성전자', true, true, '반도체'),
  ('SK하이닉스', true, true, '반도체'),
  ('피에스케이', true, false, '반도체'),
  ('원익QnC', true, false, '반도체'),
  ('한미반도체', true, false, '반도체')
ON CONFLICT DO NOTHING;

INSERT INTO users (emp_id, password, role, name) VALUES
  ('RM001', '$2b$12$xpuBYy8G2AIjte0loodFyePeSdNgwNQ8E6R.PFuISTyAjnRCksUYK', 'ROLE_RM', '테스트RM'),
  ('IB001', '$2b$12$xpuBYy8G2AIjte0loodFyePeSdNgwNQ8E6R.PFuISTyAjnRCksUYK', 'ROLE_IB', '테스트IB'),
  ('ADMIN001', '$2b$12$POAebVjOTU9RQOtNmcyg/.m6Y4V6eIMSIZysNLIh.coUja7eoB77S', 'ROLE_ADMIN', '관리자')
ON CONFLICT DO NOTHING;
