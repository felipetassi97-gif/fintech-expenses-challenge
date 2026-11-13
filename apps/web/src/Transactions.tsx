import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ApiError, queryString, request } from "./api";
import type {
  Category,
  Transaction,
  TransactionPage,
} from "./api";
import {
  DateFilters,
  Heading,
  State,
  day,
  errorText,
  money,
  useLoad,
} from "./shared";
import { TransactionEditor } from "./TransactionEditor";
export function Transactions({
  token,
  logout,
  categories,
  categoriesLoading,
  categoriesError,
  revision,
  onTransactionChanged,
}: {
  token: string;
  logout: () => void;
  categories: Category[] | null;
  categoriesLoading: boolean;
  categoriesError: string;
  revision: number;
  onTransactionChanged: () => void;
}) {
  const [searchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [type, setType] = useState(() => searchParams.get("type") || "");
  const [category, setCategory] = useState(() => searchParams.get("categoryId") || "");
  const [start, setStart] = useState(() => searchParams.get("startDate") || "");
  const [end, setEnd] = useState(() => searchParams.get("endDate") || "");
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [message, setMessage] = useState("");
  const list = useLoad<TransactionPage>(
    `/transactions${queryString({ type, categoryId: category, startDate: start, endDate: end, page, limit: 10 })}`,
    token,
    logout,
    revision,
  );
  function edit(item: Transaction) {
    setEditing(item);
    setMessage("");
  }
  async function remove(item: Transaction) {
    if (!window.confirm(`Excluir a transação “${item.description}”?`)) return;
    try {
      await request(`/transactions/${item.id}`, { method: "DELETE", token });
      setPage(1);
      onTransactionChanged();
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
      />
      {message && !editing && (
        <p className="alert" role="status">
          {message}
        </p>
      )}
      <section className="panel workspace-panel">
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
              {categories?.map((c) => (
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
        <State loading={list.loading || categoriesLoading} error={list.error || categoriesError} />
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
                          {categories?.find((c) => c.id === t.categoryId)
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
        <TransactionEditor
          item={editing}
          token={token}
          logout={logout}
          categories={categories}
          categoriesLoading={categoriesLoading}
          categoriesError={categoriesError}
          onClose={() => setEditing(null)}
          onSaved={() => {
            onTransactionChanged();
            setMessage("Transação salva com sucesso.");
          }}
        />
      )}
    </>
  );
}
