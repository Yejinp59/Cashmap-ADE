const BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:8000";

// localStorage 'cashmap_user'를 단일 source로 사용 (useAuth와 공유)
const STORAGE_KEY = "cashmap_user";

function readUser() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"); }
  catch { return null; }
}

function writeUser(user) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
}

function clearAuthAndNotify() {
  localStorage.removeItem(STORAGE_KEY);
  // useAuth가 listen해서 React state까지 비움 → ProtectedRoute가 /login으로 보냄
  window.dispatchEvent(new Event("auth:logout"));
}

// /api/auth/login, /api/auth/refresh는 토큰 부착 안 함 (재귀 방지)
const PUBLIC_ENDPOINTS = ["/api/auth/login", "/api/auth/refresh", "/health"];

function isPublic(endpoint) {
  return PUBLIC_ENDPOINTS.some(p => endpoint.startsWith(p));
}

// 동시 refresh 호출 race condition 방지 — 진행 중인 refresh promise 공유
let refreshPromise = null;

async function tryRefresh() {
  if (refreshPromise) return refreshPromise;

  const user = readUser();
  if (!user?.refreshToken) {
    clearAuthAndNotify();
    throw new Error("Refresh Token이 없습니다.");
  }

  refreshPromise = (async () => {
    const res = await fetch(`${BASE_URL}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: user.refreshToken }),
    });
    if (!res.ok) {
      clearAuthAndNotify();
      throw new Error("세션이 만료되었습니다. 다시 로그인하세요.");
    }
    const data = await res.json();
    const updated = { ...user, accessToken: data.access_token };
    writeUser(updated);
    return data.access_token;
  })()
    .finally(() => { refreshPromise = null; });

  return refreshPromise;
}

// 친절한 에러 메시지 변환
function humanizeError(status, detail) {
  if (status === 403) return detail || "접근 권한이 없습니다.";
  if (status === 503) return "외부 서비스 일시 장애입니다. 잠시 후 다시 시도하세요.";
  if (status === 502 || status === 504) return "서버 응답 지연. 잠시 후 다시 시도하세요.";
  if (status >= 500)  return detail || "서버 내부 오류가 발생했습니다.";
  return detail || `HTTP ${status}`;
}

async function rawRequest(endpoint, options = {}, accessToken) {
  const headers = {
    "Content-Type": "application/json",
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    ...options.headers,
  };
  return fetch(`${BASE_URL}${endpoint}`, { ...options, headers });
}

async function request(endpoint, options = {}) {
  const publicCall = isPublic(endpoint);
  const user = publicCall ? null : readUser();
  let token  = user?.accessToken;

  let res = await rawRequest(endpoint, options, token);

  // 401 → refresh 1회 시도 → 원 요청 재시도
  if (res.status === 401 && !publicCall) {
    try {
      token = await tryRefresh();
      res   = await rawRequest(endpoint, options, token);
    } catch (e) {
      throw new Error(e.message || "인증이 필요합니다.");
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = humanizeError(res.status, err.detail);
    const error = new Error(msg);
    error.status = res.status;
    throw error;
  }

  // 204 No Content 대응
  if (res.status === 204) return null;
  return res.json();
}

// ── Companies ──────────────────────────────────────
export const fetchCompanies = (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return request(`/api/companies${qs ? "?" + qs : ""}`);
};

export const fetchCompany = (id) => request(`/api/companies/${id}`);

// ── D-Score ────────────────────────────────────────
export const fetchDScores = (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return request(`/api/ade/dscore${qs ? "?" + qs : ""}`);
};

export const fetchDScore = (companyId) =>
  request(`/api/ade/dscore/${companyId}`);

// ── Signal Scores ──────────────────────────────────
export const fetchSignals = (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return request(`/api/cashmap/signal${qs ? "?" + qs : ""}`);
};

// ── Disclosures ────────────────────────────────────
export const fetchDisclosures = (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return request(`/api/disclosures${qs ? "?" + qs : ""}`);
};

// ── Reverse Query ──────────────────────────────────
export const postReverseQuery = (query) =>
  request("/api/reverse-query", {
    method: "POST",
    body: JSON.stringify({ query }),
  });

// ── Health ─────────────────────────────────────────
export const fetchHealth = () => request("/health");


// ── Supply Chain Network ───────────────────────────
export const fetchNetwork = (companyId) =>
  request(`/api/cashmap/network/${companyId}`);

export const fetchSupplyChain = (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return request(`/api/supply-chain${qs ? "?" + qs : ""}`);
};

export const createSupplyChainEdge = (body) =>
  request("/api/supply-chain", { method: "POST", body: JSON.stringify(body) });

// ── 기업별 공시 목록 ───────────────────────────────
export const fetchCompanyDisclosures = (companyId, params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return request(`/api/cashmap/disclosures/${companyId}${qs ? "?" + qs : ""}`);
};

// ── 공시 단건 상세 (본문 + 하이라이트) ─────────────
export const fetchDisclosure = (disclosureId) =>
  request(`/api/disclosures/${encodeURIComponent(disclosureId)}`);

// ── 비슷한 공시 추천 (임베딩 유사도) ───────────────
export const fetchSimilarDisclosures = (rceptNo, params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return request(`/api/disclosures/${encodeURIComponent(rceptNo)}/similar${qs ? "?" + qs : ""}`);
};

// ── 공시 하이라이트 투입 (AI-A 슬롯) ───────────────
export const updateDisclosureHighlights = (disclosureId, highlights) =>
  request(`/api/disclosures/${disclosureId}/highlights`, {
    method: "PATCH",
    body: JSON.stringify({ highlights }),
  });

export const updateDisclosureHighlightsBatch = (items) =>
  request("/api/disclosures/highlights/batch", {
    method: "POST",
    body: JSON.stringify(items),
  });


// ── ADE: D-Score 등록 (AI-B 투입용) ──────────────────
export const createDScore = (body) =>
  request("/api/ade/dscore", { method: "POST", body: JSON.stringify(body) });

export const createDScoreBatch = (body) =>
  request("/api/ade/dscore/batch", { method: "POST", body: JSON.stringify(body) });

// ── ADE: 피처 요약 조회 ───────────────────────────────
export const fetchFeatures = (companyId) =>
  request(`/api/ade/features/${companyId}`);

// ── CashMap: 신호 강도 등록 (AI-A 투입용) ─────────────
export const createSignal = (body) =>
  request("/api/cashmap/signal", { method: "POST", body: JSON.stringify(body) });

export const createSignalBatch = (body) =>
  request("/api/cashmap/signal/batch", { method: "POST", body: JSON.stringify(body) });

// ── CashMap: 신호 강도 요약 (대시보드용) ──────────────
export const fetchSignalSummary = () =>
  request("/api/cashmap/signal/summary");

// ── CashMap: 신호 강도 시계열 추이 (차트용) ───────────
export const fetchSignalTrend = () =>
  request("/api/cashmap/signal/trend");

// ── Patents ────────────────────────────────────────────
export const fetchPatents = (companyId, params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return request(`/api/patents/${companyId}${qs ? "?" + qs : ""}`);
};

export const createPatentBatch = (body) =>
  request("/api/patents/batch", { method: "POST", body: JSON.stringify(body) });

// ── 공시 신호 강도 업데이트 (AI-A 슬롯) ───────────────
export const updateDisclosureSignal = (disclosureId, signalScore) =>
  request(
    `/api/disclosures/${disclosureId}/signal?signal_score=${signalScore}`,
    { method: "PATCH" }
  );

// ── Admin: 배치 수동 실행 ─────────────────────────────
export const runBatch = () =>
  request("/api/admin/batch/run", { method: "POST" });

// ── Report ─────────────────────────────────────────
export const fetchReport = (companyId) =>
  request(`/api/report/${companyId}`);

// PDF는 blob으로 받아 다운로드. Authorization 자동 부착.
export async function downloadReportPdf(companyId) {
  const user  = JSON.parse(localStorage.getItem("cashmap_user") || "null");
  const token = user?.accessToken;
  const res = await fetch(`${BASE_URL}/api/report/${companyId}/pdf`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `PDF 다운로드 실패 (HTTP ${res.status})`);
  }
  // 파일명 추출 (Content-Disposition: attachment; filename*=UTF-8''...)
  const cd = res.headers.get("Content-Disposition") || "";
  let filename = `report_${companyId}.pdf`;
  const m = cd.match(/filename\*=UTF-8''([^;]+)/);
  if (m) filename = decodeURIComponent(m[1]);

  const blob = await res.blob();
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}


// ── Auth ───────────────────────────────────────────
export const login = (emp_id, password) =>
  request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ emp_id, password }),
  });

// useAuth의 자동 refresh 타이머에서 사용 (수동 호출)
export const refreshToken = (refresh_token) =>
  request("/api/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refresh_token }),
  });

export const logout = () =>
  request("/api/auth/logout", { method: "POST" });

export const getMe = () => request("/api/auth/me");
