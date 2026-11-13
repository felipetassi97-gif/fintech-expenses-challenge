import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { ApiError, request } from "./api";
import type { User } from "./api";

const tokenKey = "finance_session";
type Session = { token: string; user: User | null; checking: boolean; notice: string; login: (token: string) => void; logout: () => void };
const SessionContext = createContext<Session | null>(null);
export function SessionProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState(() => sessionStorage.getItem(tokenKey) || "");
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(!!token);
  const [notice, setNotice] = useState("");
  const logout = useCallback(() => {
    sessionStorage.removeItem(tokenKey); setToken(""); setUser(null); setChecking(false);
  }, []);
  const login = useCallback((value: string) => {
    sessionStorage.setItem(tokenKey, value); setNotice(""); setChecking(true); setToken(value);
  }, []);
  useEffect(() => {
    if (!token) return;
    let active = true;
    request<User>("/auth/me", { token }).then((value) => {
      if (active) { setUser(value); setChecking(false); }
    }).catch((error: unknown) => {
      if (!active) return;
      if (!(error instanceof ApiError && error.status === 401)) setNotice("Não foi possível recuperar sua sessão. Tente entrar novamente.");
      logout();
    });
    return () => { active = false; };
  }, [token, logout]);
  return <SessionContext.Provider value={{ token, user, checking, notice, login, logout }}>{children}</SessionContext.Provider>;
}
export function useSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error("SessionProvider ausente");
  return session;
}
