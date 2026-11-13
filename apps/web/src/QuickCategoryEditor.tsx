import { useEffect, useRef, useState } from "react";
import { ApiError, request } from "./api";
import type { Category } from "./api";
import { errorText } from "./shared";
import type { WriteOperation } from "./write-operation";

export function QuickCategoryEditor({
  token,
  logout,
  write,
  isTransactionPending,
  onCreated,
  onCancel,
}: {
  token: string;
  logout: () => void;
  write: WriteOperation;
  isTransactionPending: () => boolean;
  onCreated: (category: Category) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const operation = useRef(false);
  const mounted = useRef(true);
  const nameInput = useRef<HTMLInputElement>(null);
  const busy = write.busy;

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  async function createCategory() {
    if (operation.current || isTransactionPending()) return;
    if (!name.trim()) {
      setMessage("Informe o nome da categoria.");
      nameInput.current?.focus();
      return;
    }
    if (!write.start()) return;
    operation.current = true;
    setSaving(true);
    setMessage("");
    let changed: "categories" | null = null;

    try {
      const category = await request<Category>("/categories", {
        method: "POST",
        token,
        body: { name: name.trim(), description: description.trim() || null },
      });
      changed = "categories";
      if (mounted.current) onCreated(category);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401 && write.isActive()) logout();
      else if (mounted.current) setMessage(errorText(error));
    } finally {
      operation.current = false;
      if (mounted.current) setSaving(false);
      write.finish(changed);
    }
  }

  return (
    <section className="quick-category-panel" aria-label="Criar categoria">
      <div className="quick-category-fields">
        <label>
          Nome
          <input
            ref={nameInput}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setMessage("");
            }}
            maxLength={120}
            aria-required="true"
            autoFocus
            disabled={busy}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void createCategory();
              }
            }}
          />
        </label>
        <label>
          Descrição <span className="muted">(opcional)</span>
          <textarea
            value={description}
            onChange={(event) => {
              setDescription(event.target.value);
              setMessage("");
            }}
            maxLength={500}
            rows={2}
            disabled={busy}
          />
        </label>
      </div>
      {message && (
        <p className="field-error" role="alert">
          {message}
        </p>
      )}
      <div className="quick-category-actions">
        <button
          type="button"
          className="button secondary"
          onClick={onCancel}
          disabled={busy}
        >
          Cancelar criação
        </button>
        <button
          type="button"
          className="button primary"
          onClick={() => void createCategory()}
          disabled={busy || saving}
        >
          {saving ? "Salvando categoria..." : "Salvar categoria"}
        </button>
      </div>
    </section>
  );
}
