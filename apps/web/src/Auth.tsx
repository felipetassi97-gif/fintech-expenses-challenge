import { useState } from "react";
import type { FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ApiError, request } from "./api";
import { Brand, errorText } from "./shared";
export function Auth({ onLogin }: { onLogin: (token: string) => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const register = location.pathname === "/register";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    let accountCreated = false;
    try {
      if (register)
        await request("/auth/register", {
          method: "POST",
          body: { name, email, password },
        });
      accountCreated = register;
      const result = await request<{
        accessToken: string;
      }>("/auth/login", { method: "POST", body: { email, password } });
      onLogin(result.accessToken);
    } catch (err) {
      if (accountCreated) {
        navigate("/login");
        setError(
          "Conta criada, mas não foi possível iniciar a sessão. Entre com seu e-mail e senha.",
        );
      } else if (register && err instanceof ApiError && err.status === 409) {
        setError(
          "Este e-mail já possui uma conta. Entre com sua senha ou use outro e-mail.",
        );
      } else if (register && err instanceof ApiError && err.status === 400) {
        setError(
          "Confira o nome, o e-mail e a senha. Use uma senha de 8 a 72 caracteres.",
        );
      } else {
        setError(errorText(err));
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth">
      <section className="auth-aside">
        <Brand />
        <div className="auth-message">
          <span className="eyebrow">GESTÃO FINANCEIRA</span>
          <h1>Mais clareza para suas decisões.</h1>
          <p>
            Acompanhe entradas e despesas em um só lugar, com organização e
            tranquilidade.
          </p>
          <div className="auth-lines">
            <span>
              01 <b>Visão geral</b>
            </span>
            <span>
              02 <b>Movimentações</b>
            </span>
            <span>
              03 <b>Categorias</b>
            </span>
          </div>
        </div>
        <small>Seu espaço para acompanhar as finanças.</small>
      </section>
      <section className="auth-main">
        <form className="auth-card" onSubmit={submit}>
          <div className="mobile-brand">
            <Brand />
          </div>
          <span className="eyebrow blue">BEM-VINDO</span>
          <h2>{register ? "Crie sua conta" : "Acesse sua conta"}</h2>
          <p>
            {register
              ? "Comece a organizar suas movimentações."
              : "Entre para acompanhar sua gestão financeira."}
          </p>
          {error && (
            <p role="alert" className="alert error">
              {error}
            </p>
          )}
          {register && (
            <label>
              Nome completo
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={120}
                autoComplete="name"
              />
            </label>
          )}
          <label>
            E-mail
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </label>
          <label>
            Senha
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={register ? 8 : 1}
              maxLength={72}
              autoComplete={register ? "new-password" : "current-password"}
            />
          </label>
          {register && <small>Use uma senha de 8 a 72 caracteres.</small>}
          <button className="button primary full" disabled={busy}>
            {busy ? "Aguarde..." : register ? "Criar conta" : "Entrar"}
          </button>
          <p className="auth-switch">
            {register ? "Já tem uma conta?" : "Ainda não tem uma conta?"}{" "}
            <button
              type="button"
              className="link"
              onClick={() => {
                navigate(register ? "/login" : "/register");
                setError("");
              }}
            >
              {register ? "Entrar" : "Criar conta"}
            </button>
          </p>
        </form>
      </section>
    </main>
  );
}
