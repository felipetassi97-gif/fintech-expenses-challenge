import { useEffect, useRef, useState } from "react";
import { ApiError, request } from "./api";
export { money } from "./money.js";
export type Page = "dashboard" | "transactions" | "categories";
export const day = (value: string) =>
  new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR");
export const DATE_RANGE_ERROR =
  "A data inicial deve ser igual ou anterior à data final.";
export const hasInvertedDateRange = (start: string, end: string) =>
  Boolean(start && end && start > end);
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
  enabled = true,
) {
  const [data, setData] = useState<T | null>(null);
  const [loadedQuery, setLoadedQuery] = useState<{ path: string; revision: number } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!enabled) {
      setData(null);
      setLoadedQuery(null);
      setError("");
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError("");
    request<T>(path, { token, signal: controller.signal })
      .then((value) => {
        if (controller.signal.aborted) return;
        setData(value);
        setLoadedQuery({ path, revision });
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setData(null);
        setLoadedQuery(null);
        if (err instanceof ApiError && err.status === 401) logout();
        else setError(errorText(err));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [path, token, logout, revision, enabled]);
  return { data, error, loading, loadedQuery };
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
  onClear,
}: {
  start: string;
  end: string;
  setStart: (s: string) => void;
  setEnd: (s: string) => void;
  onClear: () => void;
}) {
  const invalidRange = hasInvertedDateRange(start, end);
  return (
    <div className="date-filters">
      <label>
        De
        <input
          type="date"
          value={start}
          max={end || undefined}
          aria-invalid={invalidRange || undefined}
          aria-describedby={invalidRange ? "transaction-date-range-error" : undefined}
          onChange={(e) => setStart(e.target.value)}
        />
      </label>
      <label>
        Até
        <input
          type="date"
          value={end}
          min={start || undefined}
          aria-invalid={invalidRange || undefined}
          aria-describedby={invalidRange ? "transaction-date-range-error" : undefined}
          onChange={(e) => setEnd(e.target.value)}
        />
      </label>
      {(start || end) && (
        <button
          className="link"
          onClick={onClear}
        >
          Limpar
        </button>
      )}
      {invalidRange && (
        <p id="transaction-date-range-error" className="field-error date-range-error" role="alert">
          {DATE_RANGE_ERROR}
        </p>
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

export function ConfirmDialog({
  titleId,
  title,
  description,
  confirmLabel = "Confirmar",
  busyLabel = "Aguarde...",
  busy = false,
  error = "",
  onConfirm,
  onClose,
}: {
  titleId: string;
  title: string;
  description: string;
  confirmLabel?: string;
  busyLabel?: string;
  busy?: boolean;
  error?: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal titleId={titleId} onClose={onClose}>
      <h2 id={titleId}>{title}</h2>
      <p>{description}</p>
      {error && (
        <p className="alert error" role="alert">
          {error}
        </p>
      )}
      <div className="dialog-actions">
        <button
          type="button"
          className="button secondary"
          onClick={onClose}
          disabled={busy}
        >
          Cancelar
        </button>
        <button
          type="button"
          className="button danger"
          onClick={onConfirm}
          disabled={busy}
        >
          {busy ? busyLabel : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
