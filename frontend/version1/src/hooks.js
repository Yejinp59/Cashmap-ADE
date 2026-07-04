import { useState, useEffect, useCallback } from "react";
import {
  fetchDScores,
  fetchDScore,
  fetchSignals,
  fetchCompanies,
  fetchHealth,
  postReverseQuery,
  fetchNetwork,
  fetchCompanyDisclosures,
  fetchSimilarDisclosures,
  fetchFeatures,
  fetchSignalSummary,
  fetchSignalTrend,
  fetchPatents,
} from "./api";

// ── 공통 fetch 훅 ──────────────────────────────────
function useFetch(fetchFn, deps = []) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchFn()
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error };
}

// ── D-Score 목록 ───────────────────────────────────
export function useDScores(grade) {
  const params = grade && grade !== "ALL" ? { grade } : {};
  return useFetch(() => fetchDScores(params), [grade]);
}

// ── 기업별 D-Score 상세 ────────────────────────────
export function useDScore(companyId) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  useEffect(() => {
    if (!companyId) return;
    setLoading(true);
    setError(null);

    fetchDScore(companyId)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [companyId]);

  return { data, loading, error };
}

// ── 신호 강도 (대기업) ────────────────────────────
export function useSignals() {
  return useFetch(() => fetchSignals({ sector: "반도체" }), []);
}

// ── 기업 목록 ─────────────────────────────────────
export function useCompanies(params = {}) {
  return useFetch(() => fetchCompanies(params), [JSON.stringify(params)]);
}

// ── 헬스체크 ──────────────────────────────────────
export function useHealth() {
  return useFetch(() => fetchHealth(), []);
}

// ── 역방향 조회 ───────────────────────────────────
export function useReverseQuery() {
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const query = useCallback((queryText) => {
    if (!queryText.trim()) return;
    setLoading(true);
    setError(null);
    setResults(null);

    postReverseQuery(queryText)
      .then(setResults)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return { results, loading, error, query };
}

// ── 공급망 네트워크 ────────────────────────────────
export function useNetwork(companyId) {
  return useFetch(() => fetchNetwork(companyId), [companyId]);
}

// ── 기업별 공시 목록 ───────────────────────────────
export function useCompanyDisclosures(companyId) {
  return useFetch(() => fetchCompanyDisclosures(companyId), [companyId]);
}

// ── 비슷한 공시 추천 (임베딩 유사도) ───────────────
export function useSimilarDisclosures(rceptNo) {
  return useFetch(() => fetchSimilarDisclosures(rceptNo, { limit: 5 }), [rceptNo]);
}

// ── ADE: 피처 요약 ────────────────────────────────────
export function useFeatures(companyId) {
  return useFetch(() => fetchFeatures(companyId), [companyId]);
}

// ── CashMap: 신호 강도 요약 (대시보드 카드) ───────────
export function useSignalSummary() {
  return useFetch(() => fetchSignalSummary(), []);
}

// ── CashMap: 신호 강도 시계열 추이 (차트) ─────────────
export function useSignalTrend() {
  return useFetch(() => fetchSignalTrend(), []);
}

// ── Patents: 기업 특허 목록 ───────────────────────────
export function usePatents(companyId, params = {}) {
  return useFetch(
    () => fetchPatents(companyId, params),
    [companyId, JSON.stringify(params)]
  );
}