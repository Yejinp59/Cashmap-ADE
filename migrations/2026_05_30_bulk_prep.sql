-- 2026-05-30: bulk_collector 실행 전 스키마 보강
-- disclosures.rcept_no, signal_scores.created_at, 인덱스 일괄 추가
-- 모두 IF NOT EXISTS — 여러 번 실행해도 안전

BEGIN;

-- 1) disclosures.rcept_no (UNIQUE)
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

-- 2) signal_scores.created_at
ALTER TABLE signal_scores
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

-- 3) 조회 성능 인덱스
CREATE INDEX IF NOT EXISTS disclosures_company_disclosed_idx
    ON disclosures (company_id, disclosed_at DESC);

CREATE INDEX IF NOT EXISTS signal_scores_company_idx
    ON signal_scores (company_id, scored_at DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS patents_company_filed_idx
    ON patents (company_id, filed_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS patents_company_active_idx
    ON patents (company_id) WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS companies_is_anchor_idx ON companies (is_anchor);
CREATE INDEX IF NOT EXISTS companies_sector_idx    ON companies (sector);
CREATE INDEX IF NOT EXISTS companies_corp_name_idx ON companies (corp_name);

CREATE INDEX IF NOT EXISTS supply_chain_supplier_idx
    ON supply_chain_edges (supplier_id);

COMMIT;
