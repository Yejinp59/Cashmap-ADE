import { useState, useEffect, useCallback, createContext, useContext } from "react";
import { login as apiLogin, logout as apiLogout } from "./api";

const AuthContext = createContext(null);
const STORAGE_KEY = "cashmap_user";

export function AuthProvider({ children }) {
  const [user, setUser]   = useState(null);
  const [ready, setReady] = useState(false);

  // 앱 시작 시 localStorage에서 복원
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try { setUser(JSON.parse(stored)); }
      catch { localStorage.removeItem(STORAGE_KEY); }
    }
    setReady(true);
  }, []);

  const login = useCallback(async (empId, password) => {
    const data = await apiLogin(empId, password);
    const userInfo = {
      empId:        empId,
      name:         data.name,
      role:         data.role,
      accessToken:  data.access_token,
      refreshToken: data.refresh_token,
    };
    setUser(userInfo);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userInfo));
    return userInfo;
  }, []);

  const logout = useCallback(async () => {
    await apiLogout().catch(() => {});
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  // api.js의 refresh 실패 시 발송되는 이벤트 listen
  // → React state까지 비워 ProtectedRoute가 /login으로 보냄
  useEffect(() => {
    const handler = () => setUser(null);
    window.addEventListener("auth:logout", handler);
    return () => window.removeEventListener("auth:logout", handler);
  }, []);

  // localStorage 변경 (다른 탭 등) → state 동기화
  useEffect(() => {
    const handler = (e) => {
      if (e.key !== STORAGE_KEY) return;
      if (!e.newValue) setUser(null);
      else {
        try { setUser(JSON.parse(e.newValue)); } catch { /* ignore */ }
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, ready }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
