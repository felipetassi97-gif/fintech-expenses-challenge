import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { ApiError, request } from "./api";
import type { Category, Transaction, TransactionInput } from "./api";
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
}: {
  item: TransactionEditorItem;
  token: string;
  logout: () => void;
  categories: Category[] | null;
  categoriesLoading: boolean;
  categoriesError: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<TransactionInput>(() =>
    initialForm(item, categories),
  );
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (item === "new" && categories?.length) {
      setForm((current) =>
        current.categoryId
          ? current
          : { ...current, categoryId: categories[0].id },
      );
    }
  }, [categories, item]);

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const isNew = item === "new";

    try {
      await request(isNew ? "/transactions" : `/transactions/${item.id}`, {
        method: isNew ? "POST" : "PATCH",
        token,
        body: { ...form, amount: form.amount.replace(",", ".") },
      });
      onSaved();
      onClose();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) logout();
      else setMessage(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal titleId="transaction-title" onClose={onClose}>
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
          />
        </label>
        <div className="form-grid">
          <label>
            Tipo
            <select
              value={form.type}
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
              inputMode="decimal"
              value={form.amount}
              onChange={(event) =>
                setForm({ ...form, amount: event.target.value })
              }
              placeholder="0,00"
              required
              pattern="[0-9]+([.,][0-9]{1,2})?"
            />
          </label>
          <label>
            Categoria
            <select
              required
              value={form.categoryId}
              onChange={(event) =>
                setForm({ ...form, categoryId: event.target.value })
              }
            >
              <option value="">Selecione</option>
              {categories?.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Data
            <input
              type="date"
              required
              value={form.date}
              onChange={(event) =>
                setForm({ ...form, date: event.target.value })
              }
            />
          </label>
        </div>
        {categoriesLoading && (
          <p className="state" role="status">
            Carregando categorias...
          </p>
        )}
        {!categoriesLoading && categoriesError && (
          <p className="alert error" role="alert">
            {categoriesError}
          </p>
        )}
        {!categoriesLoading && !categoriesError && !categories?.length && (
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
          >
            Cancelar
          </button>
          <button
            className="button primary"
            disabled={
              busy || categoriesLoading || !!categoriesError || !categories?.length
            }
          >
            {busy ? "Salvando..." : "Salvar transação"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
