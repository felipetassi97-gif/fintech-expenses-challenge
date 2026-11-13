import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ApiError, queryString, request } from "./api";
import { clearTransactionDateFilters } from "./transactions-query.js";
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
  hasInvertedDateRange,
  errorText,
  money,
  useLoad,
} from "./shared";
import { TransactionEditor } from "./TransactionEditor";
import type { WriteOperation } from "./write-operation";
export function Transactions({
  token,
  logout,
  categories,
  categoriesLoading,
  categoriesError,
  revision,
  write,
}: {
  token: string;
  logout: () => void;
  categories: Category[] | null;
  categoriesLoading: boolean;
  categoriesError: string;
  revision: number;
  write: WriteOperation;
}) {
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const [searchParams, setSearchParams] = useSearchParams();
  const type = searchParams.get("type") || "";
  const category = searchParams.get("categoryId") || "";
  const start = searchParams.get("startDate") || "";
  const end = searchParams.get("endDate") || "";
  const rawPage = searchParams.get("page");
  const pageParam = Number(rawPage);
  const validPage = rawPage === null || (/^[1-9]\d*$/.test(rawPage) && Number.isSafeInteger(pageParam));
  const page = validPage && rawPage !== null ? pageParam : 1;
  const latestParams = useRef(new URLSearchParams(searchParams));
  useLayoutEffect(() => {
    latestParams.current = new URLSearchParams(searchParams);
  }, [searchParams]);
  useEffect(() => {
    if (validPage) return;
    const next = new URLSearchParams(latestParams.current);
    next.delete("page");
    latestParams.current = next;
    setSearchParams(next, { replace: true });
  }, [validPage, rawPage, setSearchParams]);
  function changeQuery(change: (previous: URLSearchParams) => URLSearchParams) {
    const next = change(latestParams.current);
    latestParams.current = next;
    setSearchParams(next);
  }
  function updateQuery(key: string, value: string | number) {
    changeQuery((previous) => {
      const next = new URLSearchParams(previous);
      if (value === "" || (key === "page" && value === 1)) next.delete(key);
      else next.set(key, String(value));
      if (key !== "page") next.delete("page");
      return next;
    });
  }
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [message, setMessage] = useState("");
  const invalidDateRange = hasInvertedDateRange(start, end);
  const listPath = `/transactions${queryString({ type, categoryId: category, startDate: start, endDate: end, page, limit: 10 })}`;
  const list = useLoad<TransactionPage>(
    listPath,
    token,
    logout,
    revision,
    !invalidDateRange,
  );
  const pagination = list.data?.pagination;
  const lastPage = Math.max(1, pagination?.totalPages ?? 0);
  useEffect(() => {
    if (list.loading || list.loadedQuery?.path !== listPath || list.loadedQuery.revision !== revision || !pagination || pagination.page !== page || page <= lastPage) return;
    const next = new URLSearchParams(latestParams.current);
    if (lastPage === 1) next.delete("page");
    else next.set("page", String(lastPage));
    latestParams.current = next;
    setSearchParams(next, { replace: true });
  }, [list.loading, list.loadedQuery, listPath, revision, pagination, page, lastPage, setSearchParams]);
  const paginationControls = pagination && pagination.total > 0 ? (
    <div className="pagination">
      <span>
        {pagination.total} registro(s) · Página {page} de {pagination.totalPages}
      </span>
      <div>
        <button
          className="button secondary"
          disabled={page <= 1}
          onClick={() => updateQuery("page", page - 1)}
        >
          Anterior
        </button>{" "}
        {page > lastPage && (
          <button
            className="button secondary"
            onClick={() => updateQuery("page", lastPage)}
          >
            Última página
          </button>
        )}{" "}
        <button
          className="button secondary"
          disabled={page >= lastPage}
          onClick={() => updateQuery("page", page + 1)}
        >
          Próxima
        </button>
      </div>
    </div>
  ) : null;
  function edit(item: Transaction) {
    if (write.busy) return;
    setEditing(item);
    setMessage("");
  }
  async function remove(item: Transaction) {
    if (write.busy) return;
    if (!window.confirm(`Excluir a transação “${item.description}”?`)) return;
    if (!write.start()) return;
    let changed: "transactions" | null = null;
    try {
      await request(`/transactions/${item.id}`, { method: "DELETE", token });
      changed = "transactions";
      if (mounted.current) {
        updateQuery("page", 1);
        setMessage("Transação excluída.");
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401 && write.isActive()) logout();
      else if (mounted.current) setMessage(errorText(err));
    } finally {
      write.finish(changed);
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
                updateQuery("type", e.target.value);
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
                updateQuery("categoryId", e.target.value);
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
              updateQuery("startDate", s);
            }}
            setEnd={(s) => {
              updateQuery("endDate", s);
            }}
            onClear={() => {
              changeQuery(clearTransactionDateFilters);
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
                          <button onClick={() => edit(t)} disabled={write.busy}>Editar</button>
                          <button onClick={() => remove(t)} disabled={write.busy}>Excluir</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {paginationControls}
            </>
          ) : (
            <>
              <p className="empty">
                {pagination?.total
                  ? "Esta página não contém transações. Volte para uma página válida."
                  : "Nenhuma transação encontrada para os filtros selecionados."}
              </p>
              {paginationControls}
            </>
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
            setMessage("Transação salva com sucesso.");
          }}
          write={write}
        />
      )}
    </>
  );
}
