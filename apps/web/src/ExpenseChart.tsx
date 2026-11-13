import { useEffect, useState } from "react";
import { queryString } from "./api";
import type { Dashboard } from "./api";
import { money } from "./shared";
import { decimalFromCents } from "./money.js";
import { toCents, visualShare } from "./chart-money.js";
import type { Page } from "./shared";

type ExpenseSegment = {
  id: string;
  categoryId?: string;
  name: string;
  amount: bigint;
  color: string;
};

export function ExpenseChart({ data, start, end, navigate }: {
  data: Dashboard;
  start: string;
  end: string;
  navigate: (page: Page, search?: string) => void;
}) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  useEffect(() => setActiveCategory(null), [start, end]);
  const colors = ["#1254c8", "#21a7e8", "#16b879"];
  const top = data.topCategories;
  const topTotal = top.reduce((sum, c) => sum + toCents(c.amount), 0n);
  const total = toCents(data.expense);
  const remainder = total > topTotal ? total - topTotal : 0n;
  const segments: ExpenseSegment[] = [
    ...top.map((category, index) => ({
      id: category.categoryId,
      categoryId: category.categoryId,
      name: category.name,
      amount: toCents(category.amount),
      color: colors[index],
    })),
    ...(remainder > 0n
      ? [{ id: "other", name: "Outras categorias", amount: remainder, color: "#d8e3f2" }]
      : []),
  ];
  let chartOffset = 0;
  const circumference = 2 * Math.PI * 83;
  const chartSegments = segments.map((segment) => {
    const share = visualShare(segment.amount, total);
    const midAngle = -90 + (chartOffset + share / 2) * 360;
    const offset = chartOffset;
    chartOffset += share;
    return { ...segment, share, offset, midAngle };
  });
  const activeSegment = chartSegments.find((segment) => segment.id === activeCategory);

  function openCategoryTransactions(categoryId: string) {
    navigate("transactions", queryString({
      type: "EXPENSE",
      categoryId,
      startDate: start,
      endDate: end,
    }));
  }
  return (
            <section className="panel dashboard-panel">
              <div className="section-head">
                <div>
                  <h2>Despesas por categoria</h2>
                  <p>Três categorias com maiores despesas no período</p>
                </div>
              </div>
              {top.length ? (
                <div className="chart-wrap">
                  <div className={`donut${activeSegment ? " has-active" : ""}`} aria-label="Despesas por categoria">
                    <svg className="donut-chart" viewBox="0 0 240 240" role="group" aria-label="Categorias de despesa. Passe o ponteiro ou use Tab para destacar uma fatia; ative uma categoria para filtrar os lançamentos.">
                      <circle className="donut-track" cx="120" cy="120" r="83" />
                      {chartSegments.map((segment) => {
                        const selected = activeCategory === segment.id;
                        const translate = selected ? 5 : 0;
                        const x = Math.cos((segment.midAngle * Math.PI) / 180) * translate;
                        const y = Math.sin((segment.midAngle * Math.PI) / 180) * translate;
                        const shareLabel = (segment.share * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
                        return (
                          <g key={segment.id} transform={`translate(${x} ${y})`}>
                            <circle
                              className={`donut-segment${selected ? " active" : ""}`}
                              cx="120"
                              cy="120"
                              r="83"
                              data-category-id={segment.categoryId}
                              fill="none"
                              stroke={segment.color}
                              strokeWidth={selected ? 42 : 34}
                              strokeDasharray={`${circumference * segment.share} ${circumference}`}
                              strokeDashoffset={-circumference * segment.offset}
                              transform="rotate(-90 120 120)"
                              role={segment.categoryId ? "button" : "img"}
                              tabIndex={segment.categoryId ? 0 : -1}
                              aria-label={`${segment.name}: ${money(decimalFromCents(segment.amount))}, ${shareLabel}% das despesas${segment.categoryId ? ". Ative para abrir os lançamentos desta categoria" : ""}`}
                              onPointerEnter={(event) => {
                                if (event.pointerType === "mouse") setActiveCategory(segment.id);
                              }}
                              onPointerLeave={(event) => {
                                if (event.pointerType === "mouse") setActiveCategory(null);
                              }}
                              onFocus={() => setActiveCategory(segment.id)}
                              onBlur={() => setActiveCategory(null)}
                              onClick={() => {
                                if (segment.categoryId) openCategoryTransactions(segment.categoryId);
                              }}
                              onKeyDown={(event) => {
                                if (segment.categoryId && (event.key === "Enter" || event.key === " ")) {
                                  event.preventDefault();
                                  openCategoryTransactions(segment.categoryId);
                                }
                              }}
                            />
                          </g>
                        );
                      })}
                    </svg>
                    <div className="donut-center">
                      <strong>{activeSegment ? activeSegment.name : money(decimalFromCents(total))}</strong>
                      <small>{activeSegment ? `${money(decimalFromCents(activeSegment.amount))} · ${(activeSegment.share * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% das despesas` : "Total no período"}</small>
                    </div>
                  </div>
                  <ul className="legend">
                    {chartSegments.map((segment) => {
                      const selected = activeCategory === segment.id;
                      const contents = (
                        <>
                          <span className="dot" style={{ background: segment.color }} />
                          <span className="legend-name">{segment.name}</span>
                          <strong>{total > 0n ? `${(segment.share * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` : "0%"}<small>{money(decimalFromCents(segment.amount))}</small></strong>
                          {segment.categoryId && <svg className="legend-open-icon" aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 10h11m-4-4 4 4-4 4" /></svg>}
                        </>
                      );
                      return (
                        <li key={segment.id}>
                          {segment.categoryId ? (
                            <button
                              type="button"
                              className={`legend-entry${selected ? " active" : ""}`}
                              data-category-id={segment.categoryId}
                              aria-label={`${segment.name}: ${money(decimalFromCents(segment.amount))}, ${(segment.share * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% das despesas. Abrir lançamentos da categoria`}
                              title={`Ver lançamentos de ${segment.name}`}
                              onPointerEnter={(event) => {
                                if (event.pointerType === "mouse") setActiveCategory(segment.id);
                              }}
                              onPointerLeave={(event) => {
                                if (event.pointerType === "mouse") setActiveCategory(null);
                              }}
                              onFocus={() => setActiveCategory(segment.id)}
                              onBlur={() => setActiveCategory(null)}
                              onClick={() => openCategoryTransactions(segment.categoryId!)}
                            >
                              {contents}
                            </button>
                          ) : (
                            <div className={`legend-entry${selected ? " active" : ""}`} onPointerEnter={(event) => { if (event.pointerType === "mouse") setActiveCategory(segment.id); }} onPointerLeave={(event) => { if (event.pointerType === "mouse") setActiveCategory(null); }}>
                              {contents}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : (
                <p className="empty">Ainda não há despesas neste período.</p>
              )}
            </section>
  );
}
