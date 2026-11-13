import { useEffect, useRef, useState } from "react";
import { ApiError, request } from "./api";
export type Page = "dashboard" | "transactions" | "categories";
export const money = (value: string) =>
  Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const day = (value: string) =>
  new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR");
export const errorText = (error: unknown) =>
  error instanceof ApiError && error.status === 0
    ? error.message
    : error instanceof ApiError && error.status === 401
      ? "E-mail ou senha incorretos. Confira os dados e tente novamente."
      : error instanceof ApiError && error.status === 409
        ? "A operação entrou em conflito com um registro já existente ou vinculado."
        : error instanceof ApiError && error.status >= 500
          ? "Não conseguimos processar sua solicitação agora. Tente novamente em instantes."
          : "Não foi possível concluir a operação. Confira os campos informados.";
export function Brand() {
  return (
    <div className="brand">
      <svg className="brand-mark" aria-hidden="true" viewBox="0 0 48 48" fill="none">
        <path d="M5 13.5 14.5 4H43L33.5 13.5H18L9 22.5H5v-9Z" fill="#18A6EA" />
        <path d="M10 26.5 22 14.5H35L16.5 33H10v-6.5Z" fill="#5BC9F4" />
        <path d="M10 34.5h6.5L10 41v-6.5Z" fill="#2589D6" />
      </svg>
      <span>
        Gestão<span className="brand-sub">financeira</span>
      </span>
    </div>
  );
}
export function useLoad<T>(
  path: string,
  token: string,
  logout: () => void,
  revision = 0,
) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    request<T>(path, { token, signal: controller.signal })
      .then(setData)
      .catch((err) => {
        if (controller.signal.aborted) return;
        setData(null);
        if (err instanceof ApiError && err.status === 401) logout();
        else setError(errorText(err));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [path, token, logout, revision]);
  return { data, error, loading };
}
export function Heading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow blue">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
export function State({ loading, error }: { loading: boolean; error: string }) {
  return loading ? (
    <p className="state" role="status">
      Carregando informações...
    </p>
  ) : error ? (
    <p className="alert error" role="alert">
      {error}
    </p>
  ) : null;
}
export function DateFilters({
  start,
  end,
  setStart,
  setEnd,
}: {
  start: string;
  end: string;
  setStart: (s: string) => void;
  setEnd: (s: string) => void;
}) {
  return (
    <div className="date-filters">
      <label>
        De
        <input
          type="date"
          value={start}
          max={end || undefined}
          onChange={(e) => setStart(e.target.value)}
        />
      </label>
      <label>
        Até
        <input
          type="date"
          value={end}
          min={start || undefined}
          onChange={(e) => setEnd(e.target.value)}
        />
      </label>
      {(start || end) && (
        <button
          className="link"
          onClick={() => {
            setStart("");
            setEnd("");
          }}
        >
          Limpar
        </button>
      )}
    </div>
  );
}
export function Modal({
  titleId,
  onClose,
  children,
}: {
  titleId: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      {children}
    </dialog>
  );
}
