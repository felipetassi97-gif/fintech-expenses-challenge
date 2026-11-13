import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { ApiError, request } from "./api";
import type { Category, Transaction, TransactionInput } from "./api";
import type { WriteOperation } from "./write-operation";
import { errorText, Modal } from "./shared";

type TransactionEditorItem = Transaction | "new";

const emptyTransaction: TransactionInput = {
  description: "",
  amount: "",
  type: "EXPENSE",
  categoryId: "",
  date: "",
};

function localToday(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function initialForm(
  item: TransactionEditorItem,
  categories: Category[] | null,
): TransactionInput {
  if (item === "new") {
    return {
      ...emptyTransaction,
      date: localToday(),
      categoryId: categories?.[0]?.id || "",
    };
  }

  return {
    description: item.description,
    amount: item.amount,
    type: item.type,
    categoryId: item.categoryId,
    date: item.date,
  };
}

export function TransactionEditor({
  item,
  token,
  logout,
  categories,
  categoriesLoading,
  categoriesError,
  onClose,
  onSaved,
  write,
}: {
  item: TransactionEditorItem;
  token: string;
  logout: () => void;
  categories: Category[] | null;
  categoriesLoading: boolean;
  categoriesError: string;
  onClose: () => void;
  onSaved: () => void;
  write: WriteOperation;
}) {
  const [form, setForm] = useState<TransactionInput>(() =>
    initialForm(item, categories),
  );
  const [message, setMessage] = useState("");
  const [amountError, setAmountError] = useState("");
  const [saving, setSaving] = useState(false);
  const [categoryEditorOpen, setCategoryEditorOpen] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [categoryDescription, setCategoryDescription] = useState("");
  const [categoryMessage, setCategoryMessage] = useState("");
  const [categorySaving, setCategorySaving] = useState(false);
  const [createdCategory, setCreatedCategory] = useState<Category | null>(null);
  const busy = write.busy;
  const operation = useRef(false);
  const categoryOperation = useRef(false);
  const mounted = useRef(true);
  const amountInput = useRef<HTMLInputElement>(null);
  const categoryNameInput = useRef<HTMLInputElement>(null);
  const categoryOptions = createdCategory && !categories?.some((category) => category.id === createdCategory.id)
    ? [createdCategory, ...(categories ?? [])]
    : categories ?? [];

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (item === "new" && categories?.length) {
      setForm((current) =>
        current.categoryId
          ? current
          : { ...current, categoryId: categories[0].id },
      );
    }
  }, [categories, item]);

  useEffect(() => {
    if (createdCategory && categories?.some((category) => category.id === createdCategory.id)) {
      setCreatedCategory(null);
    }
  }, [categories, createdCategory]);

  function closeCategoryEditor() {
    setCategoryEditorOpen(false);
    setCategoryName("");
    setCategoryDescription("");
    setCategoryMessage("");
  }

  async function createCategory() {
    if (categoryOperation.current || operation.current) return;
    if (!categoryName.trim()) {
      setCategoryMessage("Informe o nome da categoria.");
      categoryNameInput.current?.focus();
      return;
    }
    if (!write.start()) return;
    categoryOperation.current = true;
    setCategorySaving(true);
    setCategoryMessage("");
    let changed: "categories" | null = null;

    try {
      const category = await request<Category>("/categories", {
        method: "POST",
        token,
        body: {
          name: categoryName.trim(),
          description: categoryDescription.trim() || null,
        },
      });
      changed = "categories";
      if (mounted.current) {
        setCreatedCategory(category);
        setForm((current) => ({ ...current, categoryId: category.id }));
        closeCategoryEditor();
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 401 && write.isActive()) logout();
      else if (mounted.current) setCategoryMessage(errorText(error));
    } finally {
      categoryOperation.current = false;
      if (mounted.current) setCategorySaving(false);
      write.finish(changed);
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (operation.current) return;
    const normalizedAmount = form.amount.trim().replace(",", ".");
    if (/^0+(?:\.0+)?$/.test(normalizedAmount)) {
      setAmountError("O valor deve ser maior que zero.");
      amountInput.current?.focus();
      return;
    }
    if (!write.start()) return;
    operation.current = true;
    setSaving(true);
    setMessage("");
    setAmountError("");
    const isNew = item === "new";
    let changed: "transactions" | null = null;

    try {
      await request(isNew ? "/transactions" : `/transactions/${item.id}`, {
        method: isNew ? "POST" : "PATCH",
        token,
        body: { ...form, amount: form.amount.replace(",", ".") },
      });
      changed = "transactions";
      if (mounted.current) {
        onSaved();
        onClose();
      }
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
    <Modal
      titleId="transaction-title"
      onClose={() => {
        if (!busy && !operation.current) onClose();
      }}
    >
      <h2 id="transaction-title">
        {item === "new" ? "Nova transação" : "Editar transação"}
      </h2>
      <p>Preencha os dados da movimentação.</p>
      <form onSubmit={save}>
        <label>
          Descrição
          <input
            value={form.description}
            onChange={(event) =>
              setForm({ ...form, description: event.target.value })
            }
            required
            maxLength={500}
            autoFocus
            disabled={busy}
          />
        </label>
        <div className="form-grid">
          <label>
            Tipo
            <select
              value={form.type}
              disabled={busy}
              onChange={(event) =>
                setForm({
                  ...form,
                  type: event.target.value as TransactionInput["type"],
                })
              }
            >
              <option value="EXPENSE">Despesa</option>
              <option value="INCOME">Entrada</option>
            </select>
          </label>
          <label>
            Valor (R$)
            <input
              ref={amountInput}
              id="transaction-amount"
              inputMode="decimal"
              value={form.amount}
              aria-invalid={amountError ? true : undefined}
              aria-describedby={amountError ? "transaction-amount-error" : undefined}
              onChange={(event) => {
                setForm({ ...form, amount: event.target.value });
                setAmountError("");
              }}
              placeholder="0,00"
              required
              pattern="[0-9]+([.,][0-9]{1,2})?"
              disabled={busy}
            />
            {amountError && (
              <small id="transaction-amount-error" className="field-error" role="alert">
                {amountError}
              </small>
            )}
          </label>
          <div className="transaction-category-field">
            <label htmlFor="transaction-category">Categoria</label>
            <select
              id="transaction-category"
              required
              value={form.categoryId}
              disabled={busy}
              onChange={(event) =>
                setForm({ ...form, categoryId: event.target.value })
              }
            >
              <option value="">Selecione</option>
              {categoryOptions.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            {item === "new" && (
              <button
                type="button"
                className="link quick-category-toggle"
                aria-expanded={categoryEditorOpen}
                onClick={() => {
                  if (categoryEditorOpen) closeCategoryEditor();
                  else {
                    setCategoryMessage("");
                    setCategoryEditorOpen(true);
                  }
                }}
                disabled={busy}
              >
                {categoryEditorOpen ? "Fechar criação" : "+ Criar categoria"}
              </button>
            )}
          </div>
          <label>
            Data
            <input
              type="date"
              required
              value={form.date}
              disabled={busy}
              onChange={(event) =>
                setForm({ ...form, date: event.target.value })
              }
            />
          </label>
        </div>
        {item === "new" && categoryEditorOpen && (
          <section className="quick-category-panel" aria-label="Criar categoria">
            <div className="quick-category-fields">
              <label>
                Nome
                <input
                  ref={categoryNameInput}
                  value={categoryName}
                  onChange={(event) => {
                    setCategoryName(event.target.value);
                    setCategoryMessage("");
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
                  value={categoryDescription}
                  onChange={(event) => {
                    setCategoryDescription(event.target.value);
                    setCategoryMessage("");
                  }}
                  maxLength={500}
                  rows={2}
                  disabled={busy}
                />
              </label>
            </div>
            {categoryMessage && (
              <p className="field-error" role="alert">
                {categoryMessage}
              </p>
            )}
            <div className="quick-category-actions">
              <button
                type="button"
                className="button secondary"
                onClick={closeCategoryEditor}
                disabled={busy}
              >
                Cancelar criação
              </button>
              <button
                type="button"
                className="button primary"
                onClick={() => void createCategory()}
                disabled={busy || categorySaving}
              >
                {categorySaving ? "Salvando categoria..." : "Salvar categoria"}
              </button>
            </div>
          </section>
        )}
        {categoriesLoading && (
          <p className="state" role="status">
            Carregando categorias...
          </p>
        )}
        {!categoriesLoading && categoriesError && !createdCategory && (
          <p className="alert error" role="alert">
            {categoriesError}
          </p>
        )}
        {!categoriesLoading && !categoriesError && !categoryOptions.length && (
          <p className="alert">
            Cadastre uma categoria antes de criar uma transação.
          </p>
        )}
        {message && (
          <p role="alert" className="alert error">
            {message}
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
            className="button primary"
            disabled={
              busy || categoriesLoading || (!!categoriesError && !createdCategory) ||
              categoryEditorOpen || !categoryOptions.some((category) => category.id === form.categoryId)
            }
          >
            {saving ? "Salvando..." : "Salvar transação"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
