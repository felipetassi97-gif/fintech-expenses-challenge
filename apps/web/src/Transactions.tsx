import { useState } from "react";
import type { FormEvent } from "react";
import { ApiError, queryString, request } from "./api";
import type {
  Category,
  Transaction,
  TransactionInput,
  TransactionPage,
} from "./api";
import {
  DateFilters,
  Heading,
  Modal,
  State,
  day,
  errorText,
  money,
  useLoad,
} from "./shared";
const emptyTransaction: TransactionInput = {
  description: "",
  amount: "",
  type: "EXPENSE",
  categoryId: "",
  date: new Date().toLocaleDateString("en-CA"),
};
export function Transactions({
  token,
  logout,
}: {
  token: string;
  logout: () => void;
}) {
  const [revision, setRevision] = useState(0);
  const [page, setPage] = useState(1);
  const [type, setType] = useState("");
  const [category, setCategory] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [editing, setEditing] = useState<Transaction | "new" | null>(null);
  const [form, setForm] = useState<TransactionInput>(emptyTransaction);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const categories = useLoad<Category[]>("/categories", token, logout);
  const list = useLoad<TransactionPage>(
    `/transactions${queryString({ type, categoryId: category, startDate: start, endDate: end, page, limit: 10 })}`,
    token,
    logout,
    revision,
  );
  function edit(item: Transaction | "new") {
    setEditing(item);
    setForm(
      item === "new"
        ? {
            ...emptyTransaction,
            date: new Date().toLocaleDateString("en-CA"),
            categoryId: categories.data?.[0]?.id || "",
          }
        : {
            description: item.description,
            amount: item.amount,
            type: item.type,
            categoryId: item.categoryId,
            date: item.date,
          },
    );
    setMessage("");
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setBusy(true);
    setMessage("");
    try {
      await request(
        editing === "new" ? "/transactions" : `/transactions/${editing.id}`,
        {
          method: editing === "new" ? "POST" : "PATCH",
          token,
          body: { ...form, amount: form.amount.replace(",", ".") },
        },
      );
      setEditing(null);
      setRevision((n) => n + 1);
      setMessage("Transação salva com sucesso.");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout();
      else setMessage(errorText(err));
    } finally {
      setBusy(false);
    }
  }
  async function remove(item: Transaction) {
    if (!window.confirm(`Excluir a transação “${item.description}”?`)) return;
    try {
      await request(`/transactions/${item.id}`, { method: "DELETE", token });
      setPage(1);
      setRevision((n) => n + 1);
      setMessage("Transação excluída.");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout();
      else setMessage(errorText(err));
    }
  }
  return (
    <>
      <Heading
        eyebrow="MOVIMENTAÇÕES"
        title="Transações"
        description="Acompanhe suas entradas e despesas em um só lugar."
        action={
          <button className="button primary" onClick={() => edit("new")}>
            + Nova transação
          </button>
        }
      />
      {message && !editing && (
        <p className="alert" role="status">
          {message}
        </p>
      )}
      <section className="panel">
        <div className="section-head">
          <div>
            <h2>Histórico de transações</h2>
            <p>Filtre seus lançamentos por tipo, categoria ou período.</p>
          </div>
        </div>
        <div className="filters">
          <label>
            Tipo
            <select
              value={type}
              onChange={(e) => {
                setType(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Todos</option>
              <option value="INCOME">Entrada</option>
              <option value="EXPENSE">Despesa</option>
            </select>
          </label>
          <label>
            Categoria
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Todas</option>
              {categories.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <DateFilters
            start={start}
            end={end}
            setStart={(s) => {
              setStart(s);
              setPage(1);
            }}
            setEnd={(s) => {
              setEnd(s);
              setPage(1);
            }}
          />
        </div>
        <State
          loading={list.loading || categories.loading}
          error={list.error || categories.error}
        />
        {!list.loading &&
          list.data &&
          (list.data.data.length ? (
            <>
              <p className="table-hint">Deslize a tabela para ver todas as colunas.</p>
              <div className="table-wrap" role="region" aria-label="Tabela de transações" tabIndex={0}>
                <table>
                  <thead>
                    <tr>
                      <th>Descrição</th>
                      <th>Categoria</th>
                      <th>Data</th>
                      <th>Tipo</th>
                      <th>Valor</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.data.data.map((t) => (
                      <tr key={t.id}>
                        <td>
                          <strong>{t.description}</strong>
                        </td>
                        <td>
                          {categories.data?.find((c) => c.id === t.categoryId)
                            ?.name || "—"}
                        </td>
                        <td>{day(t.date)}</td>
                        <td>
                          <span
                            className={`badge ${t.type === "INCOME" ? "up" : "down"}`}
                          >
                            {t.type === "INCOME" ? "Entrada" : "Despesa"}
                          </span>
                        </td>
                        <td
                          className={
                            t.type === "INCOME" ? "positive" : "negative"
                          }
                        >
                          {t.type === "INCOME" ? "+" : "−"} {money(t.amount)}
                        </td>
                        <td className="actions">
                          <button onClick={() => edit(t)}>Editar</button>
                          <button onClick={() => remove(t)}>Excluir</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="pagination">
                <span>
                  {list.data.pagination.total} registro(s) · Página {page} de{" "}
                  {list.data.pagination.totalPages}
                </span>
                <div>
                  <button
                    className="button secondary"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Anterior
                  </button>{" "}
                  <button
                    className="button secondary"
                    disabled={page >= list.data!.pagination.totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Próxima
                  </button>
                </div>
              </div>
            </>
          ) : (
            <p className="empty">
              Nenhuma transação encontrada para os filtros selecionados.
            </p>
          ))}
      </section>
      {editing && (
        <Modal titleId="transaction-title" onClose={() => setEditing(null)}>
          <h2 id="transaction-title">
            {editing === "new" ? "Nova transação" : "Editar transação"}
          </h2>
          <p>Preencha os dados da movimentação.</p>
          <form onSubmit={save}>
            <label>
              Descrição
              <input
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
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
                  onChange={(e) =>
                    setForm({
                      ...form,
                      type: e.target.value as TransactionInput["type"],
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
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
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
                  onChange={(e) =>
                    setForm({ ...form, categoryId: e.target.value })
                  }
                >
                  <option value="">Selecione</option>
                  {categories.data?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
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
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </label>
            </div>
            {!categories.data?.length && (
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
                onClick={() => setEditing(null)}
              >
                Cancelar
              </button>
              <button
                className="button primary"
                disabled={busy || !categories.data?.length}
              >
                {busy ? "Salvando..." : "Salvar transação"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
