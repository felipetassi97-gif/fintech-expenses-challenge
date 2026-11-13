import { useEffect, useRef, useState } from "react";
import {
  HashRouter,
  Navigate,
  NavLink,
  Route,
  Routes,
  useNavigate,
} from "react-router-dom";
import type { Category, User } from "./api";
import { Auth } from "./Auth";
import { Categories } from "./Categories";
import { DashboardView } from "./Dashboard";
import { SessionProvider, useSession } from "./Session";
import { TransactionEditor } from "./TransactionEditor";
import { Transactions } from "./Transactions";
import { Brand, useLoad } from "./shared";
import type { Page } from "./shared";
import type { WriteOperation } from "./write-operation";
import "./shell.css";

function NavIcon({ page }: { page: Page }) {
  return (
    <svg
      className="nav-icon"
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {page === "dashboard" ? (
        <>
          <path d="M3.5 10.5 12 3l8.5 7.5" />
          <path d="M5.5 9.5V20h13V9.5M9.5 20v-6h5v6" />
        </>
      ) : page === "transactions" ? (
        <>
          <path d="M4 7h15m-4-4 4 4-4 4M20 17H5m4-4-4 4 4 4" />
        </>
      ) : (
        <>
          <path d="M4 4h7l9 9-7 7-9-9V4Z" />
          <circle cx="8" cy="8" r="1" />
        </>
      )}
    </svg>
  );
}

function PublicAuth() {
  const { user, token, login, notice } = useSession();
  if (user && token) return <Navigate to="/dashboard" replace />;
  return (
    <>
      <Auth onLogin={login} />
      {notice && (
        <div role="alert" className="toast">
          {notice}
        </div>
      )}
    </>
  );
}

function Workspace() {
  const { user, token, logout } = useSession();
  const navigate = useNavigate();
  if (!user || !token) return <Navigate to="/login" replace />;

  const setPage = (page: Page, search = "") => navigate(`/${page}${search}`);
  return (
    <AuthenticatedWorkspace
      user={user}
      token={token}
      logout={logout}
      setPage={setPage}
    />
  );
}

function AuthenticatedWorkspace({
  user,
  token,
  logout,
  setPage,
}: {
  user: User;
  token: string;
  logout: () => void;
  setPage: (page: Page, search?: string) => void;
}) {
  const [categoryRevision, setCategoryRevision] = useState(0);
  const categories = useLoad<Category[]>(
    "/categories",
    token,
    logout,
    categoryRevision,
  );
  const [transactionRevision, setTransactionRevision] = useState(0);
  const operationPending = useRef(false);
  const workspaceActive = useRef(true);
  const [operationBusy, setOperationBusy] = useState(false);
  useEffect(() => {
    workspaceActive.current = true;
    return () => { workspaceActive.current = false; };
  }, []);
  const write: WriteOperation = {
    busy: operationBusy,
    start: () => {
      if (operationPending.current || !workspaceActive.current) return false;
      operationPending.current = true;
      setOperationBusy(true);
      return true;
    },
    finish: (changed) => {
      operationPending.current = false;
      if (!workspaceActive.current) return;
      if (changed === "categories") setCategoryRevision((value) => value + 1);
      if (changed === "transactions") setTransactionRevision((value) => value + 1);
      setOperationBusy(false);
    },
    isActive: () => workspaceActive.current,
  };
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [saveNotice, setSaveNotice] = useState("");

  useEffect(() => {
    if (!saveNotice) return;
    const timeout = window.setTimeout(() => setSaveNotice(""), 4500);
    return () => window.clearTimeout(timeout);
  }, [saveNotice]);

  function transactionSaved() {
    setSaveNotice("Transação salva com sucesso.");
  }

  const initials = user.name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part, index, parts) =>
      index === 0 || index === parts.length - 1 ? part[0] : "",
    )
    .join("")
    .toUpperCase();

  return (
    <div className="shell">
      <aside className="sidebar">
        <Brand />
        <div className="sidebar-label">MENU PRINCIPAL</div>
        <nav aria-label="Navegação principal">
          {(
            [
              ["dashboard", "Visão geral"],
              ["transactions", "Transações"],
              ["categories", "Categorias"],
            ] as const
          ).map(([key, label]) => (
            <NavLink
              key={key}
              to={`/${key}`}
              className={({ isActive }) =>
                `nav-item ${isActive ? "active" : ""}`
              }
            >
              <NavIcon page={key} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <span className="sidebar-foot-title">GESTÃO FINANCEIRA</span>
          <span>Seu controle começa aqui.</span>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="top-context">
            <span className="top-context-icon" aria-hidden="true">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
              >
                <rect x="3" y="6" width="18" height="13" rx="3" />
                <path d="M3 10h18M16 15h2" />
              </svg>
            </span>
            <span className="top-title">Seu espaço financeiro</span>
          </div>
          <div className="user">
            <span className="avatar">{initials}</span>
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
          {saveNotice && (
            <p className="transaction-toast" role="status" aria-live="polite">
              {saveNotice}
            </p>
          )}
          <Routes>
            <Route
              path="/dashboard"
              element={
                <DashboardView
                  token={token}
                  user={user}
                  navigate={setPage}
                  logout={logout}
                  revision={transactionRevision}
                />
              }
            />
            <Route
              path="/transactions"
              element={
                <Transactions
                  token={token}
                  logout={logout}
                  categories={categories.data}
                  categoriesLoading={categories.loading}
                  categoriesError={categories.error}
                  revision={transactionRevision}
                  write={write}
                />
              }
            />
            <Route
              path="/categories"
              element={
                <Categories
                  token={token}
                  logout={logout}
                  data={categories.data}
                  loading={categories.loading}
                  error={categories.error}
                  write={write}
                />
              }
            />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
        {quickAddOpen && (
          <TransactionEditor
            item="new"
            token={token}
            logout={logout}
            categories={categories.data}
            categoriesLoading={categories.loading}
            categoriesError={categories.error}
            onClose={() => setQuickAddOpen(false)}
            onSaved={transactionSaved}
            write={write}
          />
        )}
        <button
          className="quick-add-fab"
          type="button"
          aria-label="Adicionar transação"
          aria-haspopup="dialog"
          title="Adicionar transação"
          onClick={() => setQuickAddOpen(true)}
          disabled={operationBusy}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function AppRoutes() {
  const { checking } = useSession();
  if (checking) return <div className="center">Carregando sua sessão...</div>;
  return (
    <Routes>
      <Route path="/login" element={<PublicAuth />} />
      <Route path="/register" element={<PublicAuth />} />
      <Route path="*" element={<Workspace />} />
    </Routes>
  );
}

export function App() {
  return (
    <HashRouter>
      <SessionProvider>
        <AppRoutes />
      </SessionProvider>
    </HashRouter>
  );
}
