import { useState } from "react";
import { queryString } from "./api";
import type { Dashboard, TransactionPage, User } from "./api";
import { DateFilters, Heading, State, day, money, useLoad } from "./shared";
import type { Page } from "./shared";
export function DashboardView({
  token,
  user,
  navigate,
  logout,
}: {
  token: string;
  user: User;
  navigate: (p: Page) => void;
  logout: () => void;
}) {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const suffix = queryString({ startDate: start, endDate: end });
  const result = useLoad<Dashboard>(`/dashboard${suffix}`, token, logout);
  const recent = useLoad<TransactionPage>(
    `/transactions${queryString({ startDate: start, endDate: end, limit: 5 })}`,
    token,
    logout,
  );
  const colors = ["#1254c8", "#21a7e8", "#16b879"];
  const top = result.data?.topCategories ?? [];
  const total = top.reduce((sum, c) => sum + Number(c.amount), 0);
  let acc = 0;
  const gradient = top
    .map((c, i) => {
      const from = acc;
      acc += total ? (Number(c.amount) / total) * 100 : 0;
      return `${colors[i]} ${from}% ${acc}%`;
    })
    .join(", ");
  return (
    <>
      <Heading
        eyebrow="PAINEL FINANCEIRO"
        title={`Olá, ${user.name.split(" ")[0]}!`}
        description="Acompanhe os principais números das suas finanças."
        action={
          <DateFilters
            start={start}
            end={end}
            setStart={setStart}
            setEnd={setEnd}
          />
        }
      />
      <State loading={result.loading} error={result.error} />
      {result.data && !result.loading && (
        <>
          <div className="metrics">
            {[
              [
                "Saldo atual",
                result.data.balance,
                "Todo o histórico",
                "balance",
                "◫",
              ],
              [
                "Entradas",
                result.data.income,
                "No período selecionado",
                "income",
                "↗",
              ],
              [
                "Despesas",
                result.data.expense,
                "No período selecionado",
                "expense",
                "↘",
              ],
            ].map(([label, value, caption, style, icon]) => (
              <article className={`metric ${style}`} key={label}>
                <div className="metric-label">
                  <span aria-hidden="true">{icon}</span>
                  {label}
                </div>
                <strong>{money(value)}</strong>
                <small>{caption}</small>
              </article>
            ))}
          </div>
          <div className="dashboard-grid">
            <section className="panel">
              <div className="section-head">
                <div>
                  <h2>Despesas por categoria</h2>
                  <p>Três categorias com maiores despesas no período</p>
                </div>
              </div>
              {top.length ? (
                <div className="chart-wrap">
                  <div
                    className="donut"
                    style={{ background: `conic-gradient(${gradient})` }}
                  >
                    <div>
                      <strong>{money(String(total))}</strong>
                      <small>Top 3</small>
                    </div>
                  </div>
                  <ul className="legend">
                    {top.map((c, i) => (
                      <li key={c.categoryId}>
                        <span
                          className="dot"
                          style={{ background: colors[i] }}
                        />
                        <span>{c.name}</span>
                        <strong>{money(c.amount)}</strong>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="empty">Ainda não há despesas neste período.</p>
              )}
            </section>
            <section className="panel">
              <div className="section-head">
                <div>
                  <h2>Movimentações recentes</h2>
                  <p>Últimos lançamentos no período</p>
                </div>
                <button
                  className="link"
                  onClick={() => navigate("transactions")}
                >
                  Ver todas →
                </button>
              </div>
              <State loading={recent.loading} error={recent.error} />
              {recent.data && (
                <div>
                  {recent.data.data.length ? (
                    recent.data.data.map((t) => (
                      <div className="recent" key={t.id}>
                        <span
                          className={`direction ${t.type === "INCOME" ? "up" : "down"}`}
                        >
                          {t.type === "INCOME" ? "↗" : "↘"}
                        </span>
                        <div>
                          <strong>{t.description}</strong>
                          <small>{day(t.date)}</small>
                        </div>
                        <strong
                          className={
                            t.type === "INCOME" ? "positive" : "negative"
                          }
                        >
                          {t.type === "INCOME" ? "+" : "−"} {money(t.amount)}
                        </strong>
                      </div>
                    ))
                  ) : (
                    <p className="empty">Nenhuma movimentação encontrada.</p>
                  )}
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </>
  );
}
