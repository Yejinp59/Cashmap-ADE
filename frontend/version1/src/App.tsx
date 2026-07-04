import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./useAuth";
import { ThemeProvider } from "./useTheme";
import { usePreventPageZoom } from "./hooks/usePreventPageZoom";

import LoginPage         from "./LoginPage";
import Layout            from "./Layout";
import ProtectedRoute    from "./ProtectedRoute";
import DashboardPage     from "./pages/DashboardPage";
import ReversePage       from "./pages/ReversePage";
import NetworkPage       from "./pages/NetworkPage";
import CompanyDetailPage from "./pages/CompanyDetailPage";
import DisclosurePage    from "./pages/DisclosurePage";
import ReportPage        from "./pages/ReportPage";
import ValidationPage    from "./pages/ValidationPage";

export function Root() {
  usePreventPageZoom();
  return (
    <ThemeProvider>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }>
            <Route path="/dashboard"          element={<DashboardPage />} />
            <Route path="/reverse"            element={<ReversePage />} />
            <Route path="/network"            element={<NetworkPage />} />
            <Route path="/network/:companyId" element={<NetworkPage />} />
            <Route path="/company/:id"        element={<CompanyDetailPage />} />
            <Route path="/disclosure/:id"     element={<DisclosurePage />} />
            <Route path="/report/:id"         element={<ReportPage />} />
            <Route path="/validation"         element={<ValidationPage />} />
          </Route>

          <Route path="/"  element={<Navigate to="/dashboard" replace />} />
          <Route path="*"  element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </ThemeProvider>
  );
}
