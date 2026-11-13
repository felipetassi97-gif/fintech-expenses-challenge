import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { ApiError, request } from "./api";
import type { User } from "./api";

const tokenKey = "finance_session";
type Session = {
  token: string;
  user: User | null;
  checking: boolean;
  recoveryRequired: boolean;
  notice: string;
  login: (token: string) => void;
  logout: () => void;
  retrySession: () => void;
};
const SessionContext = createContext<Session | null>(null);
export function SessionProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState(() => sessionStorage.getItem(tokenKey) || "");
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(!!token);
  const [recoveryRequired, setRecoveryRequired] = useState(false);
  const [notice, setNotice] = useState("");
  const [retryCount, setRetryCount] = useState(0);
  const logout = useCallback(() => {
    sessionStorage.removeItem(tokenKey);
    setToken("");
    setUser(null);
    setChecking(false);
    setRecoveryRequired(false);
    setNotice("");
  }, []);
  const login = useCallback((value: string) => {
    sessionStorage.setItem(tokenKey, value);
    setNotice("");
    setRecoveryRequired(false);
    setChecking(true);
    setToken(value);
  }, []);
  const retrySession = useCallback(() => {
    if (!token || checking) return;
    setNotice("");
    setRecoveryRequired(false);
    setChecking(true);
    setRetryCount((count) => count + 1);
  }, [checking, token]);
  useEffect(() => {
    if (!token) return;
    let active = true;
    request<User>("/auth/me", { token }).then((value) => {
      if (active) {
        setUser(value);
        setChecking(false);
        setRecoveryRequired(false);
        setNotice("");
      }
    }).catch((error: unknown) => {
      if (!active) return;
      if (error instanceof ApiError && error.status === 401) {
        logout();
        return;
      }
      setUser(null);
      setNotice("Não foi possível confirmar sua sessão. Verifique sua conexão ou tente novamente.");
      setRecoveryRequired(true);
      setChecking(false);
    });
    return () => { active = false; };
  }, [token, retryCount, logout]);
  return <SessionContext.Provider value={{ token, user, checking, recoveryRequired, notice, login, logout, retrySession }}>{children}</SessionContext.Provider>;
}
export function useSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error("SessionProvider ausente");
  return session;
}
