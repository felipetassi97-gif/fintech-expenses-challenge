import { useCallback, useEffect, useState } from "react";
import { ApiError, request } from "./api";
import type { User } from "./api";
import { Auth } from "./Auth";
import { Brand } from "./shared";
import type { Page } from "./shared";
import { DashboardView } from "./Dashboard";
import { Categories } from "./Categories";
import { Transactions } from "./Transactions";
const tokenKey = "finance_session";
function currentPage(): Page {
  const page = window.location.hash.slice(1);
  return page === "transactions" || page === "categories" ? page : "dashboard";
}
export function App() {
  const [token, setToken] = useState(
    () => sessionStorage.getItem(tokenKey) || "",
  );
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(!!token);
  const [page, updatePage] = useState<Page>(currentPage);
  const [notice, setNotice] = useState("");
  const setPage = useCallback((next: Page) => {
    window.location.hash = next;
    updatePage(next);
  }, []);
  useEffect(() => {
    const syncPage = () => updatePage(currentPage());
    window.addEventListener("hashchange", syncPage);
    return () => window.removeEventListener("hashchange", syncPage);
  }, []);
  const logout = useCallback(() => {
    sessionStorage.removeItem(tokenKey);
    setToken("");
    setUser(null);
    setChecking(false);
  }, []);
  useEffect(() => {
    if (!token) return;
    let active = true;
    request<User>("/auth/me", { token })
      .then((u) => {
        if (active) {
          setUser(u);
          setChecking(false);
        }
      })
      .catch((err) => {
        if (!active) return;
        if (err instanceof ApiError && err.status === 401) logout();
        else {
          setNotice(
            "Não foi possível recuperar sua sessão. Tente entrar novamente.",
          );
          logout();
        }
      });
    return () => {
      active = false;
    };
  }, [token, logout]);
  if (checking) return <div className="center">Carregando sua sessão...</div>;
  if (!user || !token)
    return (
      <>
        <Auth
          onLogin={(t) => {
            sessionStorage.setItem(tokenKey, t);
            setChecking(true);
            setToken(t);
          }}
        />
        {notice && (
          <div role="alert" className="toast">
            {notice}
          </div>
        )}
      </>
    );
  return (
    <div className="shell">
      <aside className="sidebar">
        <Brand />
        <div className="sidebar-label">MENU PRINCIPAL</div>
        <nav aria-label="Navegação principal">
          {(
            [
              ["dashboard", "◫", "Visão geral"],
              ["transactions", "⇄", "Transações"],
              ["categories", "◇", "Categorias"],
            ] as const
          ).map(([key, icon, label]) => (
            <button
              key={key}
              className={`nav-item ${page === key ? "active" : ""}`}
              aria-current={page === key ? "page" : undefined}
              onClick={() => setPage(key)}
            >
              <span aria-hidden="true">{icon}</span>
              {label}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          GESTÃO FINANCEIRA <span>Seu controle começa aqui.</span>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span className="top-title">Seu espaço financeiro</span>
          <div className="user">
            <span className="avatar">
              {user.name.slice(0, 1).toUpperCase()}
            </span>
            <div>
              <strong>{user.name}</strong>
              <small>{user.email}</small>
            </div>
            <button className="logout" onClick={logout}>
              Sair
            </button>
          </div>
        </header>
        <main className="content">
          {page === "dashboard" && (
            <DashboardView
              token={token}
              user={user}
              navigate={setPage}
              logout={logout}
            />
          )}
          {page === "transactions" && (
            <Transactions token={token} logout={logout} />
          )}
          {page === "categories" && (
            <Categories token={token} logout={logout} />
          )}
        </main>
      </div>
    </div>
  );
}
