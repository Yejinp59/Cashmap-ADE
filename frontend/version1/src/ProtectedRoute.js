import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./useAuth";
import { canAccessRoute } from "./permissions";
import ForbiddenPage from "./pages/ForbiddenPage";

// 비로그인 사용자를 /login으로 리다이렉트하고, location.state.from에 원래 URL 보존
// 로그인된 사용자가 권한 없는 라우트에 접근하면 ForbiddenPage 표시
export default function ProtectedRoute({ children }) {
  const { user, ready } = useAuth();
  const location = useLocation();

  if (!ready) return null;
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  if (!canAccessRoute(location.pathname, user.role)) {
    return <ForbiddenPage />;
  }
  return children;
}
