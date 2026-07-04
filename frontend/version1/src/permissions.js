// ── 역할별 위젯/메뉴 노출 매트릭스 ────────────────────
//   한 곳에서 권한을 관리. 위젯 추가 시 여기만 수정.
//   - RM    : 신규 영업 (POSITIVE 협력사 발굴 중심)
//   - IB    : 투자 결정 (POSITIVE + 백테스팅 신뢰도)
//   - AUDIT : 여신 리스크 추적 (NEGATIVE/MONITOR 중심)
//   - ADMIN : 전체 + 시스템 관리

export const ROLES = {
  RM:    "ROLE_RM",
  IB:    "ROLE_IB",
  AUDIT: "ROLE_AUDIT",
  ADMIN: "ROLE_ADMIN",
};

const ALL = [ROLES.RM, ROLES.IB, ROLES.AUDIT, ROLES.ADMIN];

export const WIDGET_VISIBILITY = {
  // ── 메뉴
  navDashboard:    ALL,
  navReverse:      [ROLES.RM, ROLES.IB,             ROLES.ADMIN],
  navNetwork:      [ROLES.RM, ROLES.IB, ROLES.AUDIT, ROLES.ADMIN],
  navValidation:   [          ROLES.IB, ROLES.AUDIT, ROLES.ADMIN],
  navAdmin:        [                                  ROLES.ADMIN],

  // ── 대시보드 요약 카드 (정보 노출 — 모두에게)
  positiveCard:    [ROLES.RM, ROLES.IB,             ROLES.ADMIN],
  negativeCard:    ALL,                              // 카드는 모두 본다 (위험 정보 공유)
  monitorCard:     ALL,
  signalTopCard:   ALL,

  // ── 대시보드 본문
  signalPanel:     ALL,        // CashMap 신호 강도 섹션 (실데이터)
  dscoreTable:     ALL,
  signalChart:     ALL,
  alertListPanel:  [                    ROLES.AUDIT, ROLES.ADMIN],  // 거품 경보 상세 처리는 감리/관리자

  // ── 기업 상세
  reportButton:    [ROLES.RM, ROLES.IB,             ROLES.ADMIN],
  networkButton:   [ROLES.RM, ROLES.IB, ROLES.AUDIT, ROLES.ADMIN],
};

// ── 권한 체크 ──
export function canSee(widget, role) {
  return WIDGET_VISIBILITY[widget]?.includes(role) ?? false;
}

// ── 라우트별 접근 권한 (Protected 라우트가 사용) ──
//   /report/:id는 RM/IB/ADMIN만, /validation은 IB/AUDIT/ADMIN만 등
export const ROUTE_PERMISSIONS = {
  "/dashboard":  ALL,
  "/reverse":    [ROLES.RM, ROLES.IB,             ROLES.ADMIN],
  "/network":    [ROLES.RM, ROLES.IB, ROLES.AUDIT, ROLES.ADMIN],
  "/company":    ALL,    // 상세 페이지는 모두 접근 가능
  "/disclosure": ALL,    // 공시 원문 열람은 모두 접근 가능
  "/report":     [ROLES.RM, ROLES.IB,             ROLES.ADMIN],
  "/validation": [          ROLES.IB, ROLES.AUDIT, ROLES.ADMIN],
};

export function canAccessRoute(pathname, role) {
  // /company/85 → "/company"로 매칭
  const base = "/" + (pathname.split("/")[1] || "");
  const allowed = ROUTE_PERMISSIONS[base];
  return allowed ? allowed.includes(role) : true;
}

// ── 역할별 기본 동작 ──
// 감리는 NEGATIVE 탭부터, 나머지는 ALL
export function getDefaultDscoreTab(role) {
  if (role === ROLES.AUDIT) return "NEGATIVE";
  return "ALL";
}

// 역할 한글 표시
export function roleKor(role) {
  return {
    [ROLES.RM]:    "RM",
    [ROLES.IB]:    "IB 심사역",
    [ROLES.AUDIT]: "감리",
    [ROLES.ADMIN]: "관리자",
  }[role] ?? role;
}
