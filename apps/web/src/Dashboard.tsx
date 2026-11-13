import { useEffect, useState } from "react";
import "./dashboard.css";
import { queryString } from "./api";
import { comparisonRange, dateValue, localToday } from "./dashboard-period";
import type { PeriodPreset } from "./dashboard-period";
import type { Dashboard, TransactionPage, User } from "./api";
import { DashboardTopMetrics, PeriodIndicators } from "./DashboardMetrics";
import { Heading, State, day, money, useLoad } from "./shared";
import type { Page } from "./shared";

function monthName(date: Date, width: "short" | "long" = "short"): string {
  return new Intl.DateTimeFormat("pt-BR", {
    month: width,
    year: "numeric",
  }).format(date);
}

function fullDate(value: string): string {
  if (!value) return "";
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR").format(
    new Date(year, month - 1, day),
  );
}

function cents(value: string): number {
  const [whole, fraction = ""] = value.split(".");
  return Number(whole) * 100 + Number((fraction + "00").slice(0, 2));
}

function comparisonLabel(start: string, end: string): string {
  const [startYear, startMonth, startDay] = start.split("-").map(Number);
  const [endYear, endMonth, endDay] = end.split("-").map(Number);
  if (startYear === endYear && startMonth === endMonth) {
    const first = new Date(startYear, startMonth - 1, startDay);
    if (startDay === 1 && endDay === new Date(endYear, endMonth, 0).getDate()) {
      return monthName(first);
    }
    const month = new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(first);
    return `${startDay}–${endDay} ${month} ${startYear}`;
  }
  return `${fullDate(start)} – ${fullDate(end)}`;
}

function PeriodFilter({
  preset,
  start,
  end,
  onPresetChange,
  onStartChange,
  onEndChange,
}: {
  preset: PeriodPreset;
  start: string;
  end: string;
  onPresetChange: (preset: PeriodPreset) => void;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
}) {
  const today = localToday();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const firstDayOfLastMonth = new Date(
    today.getFullYear(),
    today.getMonth() - 1,
    1,
  );
  const currentYear = today.getFullYear();
  const customLabel =
    start && end ? `${fullDate(start)} – ${fullDate(end)}` : "Personalizado";
  const selectedLabel =
    preset === "this-month"
      ? monthName(firstDayOfMonth)
      : preset === "last-month"
        ? monthName(firstDayOfLastMonth)
        : preset === "last-30-days"
          ? "Últimos 30 dias"
          : preset === "last-90-days"
            ? "Últimos 90 dias"
            : preset === "this-year"
              ? `Ano de ${currentYear}`
              : preset === "all-time"
                ? "Todo o histórico"
                : customLabel;

  function choosePreset(value: string) {
    const next = value as PeriodPreset;
    const todayValue = dateValue(today);
    if (next === "this-month") {
      onStartChange(dateValue(firstDayOfMonth));
      onEndChange(todayValue);
    } else if (next === "last-month") {
      onStartChange(dateValue(firstDayOfLastMonth));
      onEndChange(dateValue(new Date(today.getFullYear(), today.getMonth(), 0)));
    } else if (next === "last-30-days" || next === "last-90-days") {
      const startDate = new Date(today);
      startDate.setDate(today.getDate() - (next === "last-30-days" ? 29 : 89));
      onStartChange(dateValue(startDate));
      onEndChange(todayValue);
    } else if (next === "this-year") {
      onStartChange(`${currentYear}-01-01`);
      onEndChange(todayValue);
    } else if (next === "all-time") {
      onStartChange("");
      onEndChange("");
    } else if (next === "custom" && (!start || !end)) {
      onStartChange(dateValue(firstDayOfMonth));
      onEndChange(todayValue);
    }
    onPresetChange(next);
  }

  return (
    <div className="period-filter">
      <div className="period-filter-heading">
        <span id="dashboard-period-label" className="period-label">Período</span>
        <strong>{selectedLabel}</strong>
      </div>
      <div className="period-quick-filters" role="group" aria-labelledby="dashboard-period-label">
        {([
          ["this-month", "Este mês"],
          ["last-month", "Mês passado"],
          ["last-30-days", "30 dias"],
          ["last-90-days", "90 dias"],
          ["custom", "Personalizado"],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={`period-chip${preset === value ? " active" : ""}`}
            aria-pressed={preset === value}
            onClick={() => choosePreset(value)}
          >
            {label}
          </button>
        ))}
        <select
          id="dashboard-period-more"
          className="period-more"
          aria-label="Mais períodos"
          value={preset === "this-year" || preset === "all-time" ? preset : ""}
          onChange={(event) => {
            if (event.target.value) choosePreset(event.target.value);
          }}
        >
          <option value="">Mais</option>
          <option value="this-year">Este ano</option>
          <option value="all-time">Todo o histórico</option>
        </select>
      </div>
      {preset === "custom" && (
        <div className="period-custom-range">
          <label>
            De
            <input
              type="date"
              value={start}
              max={end || undefined}
              onChange={(event) => onStartChange(event.target.value)}
            />
          </label>
          <label>
            Até
            <input
              type="date"
              value={end}
              min={start || undefined}
              onChange={(event) => onEndChange(event.target.value)}
            />
          </label>
        </div>
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="dashboard-skeleton" role="status" aria-label="Carregando o painel financeiro">
      <div className="metrics" aria-hidden="true">
        {["balance", "income", "expense"].map((kind) => (
          <article className={`metric ${kind} skeleton-metric`} key={kind}>
            <span className="skeleton-line skeleton-label" />
            <span className="skeleton-line skeleton-amount" />
            <span className="skeleton-line skeleton-trend" />
          </article>
        ))}
      </div>
      <div className="dashboard-grid" aria-hidden="true">
        <section className="panel dashboard-panel skeleton-panel">
          <span className="skeleton-line skeleton-title" />
          <span className="skeleton-line skeleton-subtitle" />
          <div className="skeleton-chart-area">
            <span className="skeleton-donut" />
            <div className="skeleton-legend">
              <span className="skeleton-line" />
              <span className="skeleton-line" />
              <span className="skeleton-line" />
            </div>
          </div>
        </section>
        <section className="panel dashboard-panel skeleton-panel">
          <span className="skeleton-line skeleton-title" />
          <span className="skeleton-line skeleton-subtitle" />
          <div className="skeleton-recent-list">
            {[0, 1, 2, 3, 4].map((index) => <span className="skeleton-recent" key={index} />)}
          </div>
        </section>
      </div>
      <section className="period-indicators" aria-hidden="true">
        <span className="skeleton-line skeleton-title" />
        <div className="period-indicator-grid">
          {[0, 1, 2, 3].map((index) => (
            <article className="period-indicator-card skeleton-indicator" key={index}>
              <span className="skeleton-indicator-icon" />
              <span className="skeleton-indicator-text">
                <span className="skeleton-line" />
                <span className="skeleton-line" />
              </span>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function RecentSkeleton() {
  return (
    <div className="recent-skeleton" role="status" aria-label="Carregando movimentações">
      {[0, 1, 2, 3, 4].map((index) => <span className="skeleton-recent" key={index} />)}
    </div>
  );
}

type ExpenseSegment = {
  id: string;
  categoryId?: string;
  name: string;
  amount: number;
  color: string;
};

export function DashboardView({
  token,
  user,
  navigate,
  logout,
  revision = 0,
}: {
  token: string;
  user: User;
  navigate: (p: Page, search?: string) => void;
  logout: () => void;
  revision?: number;
}) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [preset, setPreset] = useState<PeriodPreset>("this-month");
  const [start, setStart] = useState(() => {
    const today = localToday();
    return dateValue(new Date(today.getFullYear(), today.getMonth(), 1));
  });
  const [end, setEnd] = useState(() => dateValue(localToday()));
  const previousPeriod = comparisonRange(preset, start, end);
  const suffix = queryString({
    startDate: start,
    endDate: end,
    comparisonStartDate: previousPeriod?.startDate,
    comparisonEndDate: previousPeriod?.endDate,
  });
  useEffect(() => setActiveCategory(null), [suffix]);
  const periodCaption =
    preset === "all-time"
      ? "Todo o histórico"
      : preset === "this-month"
        ? monthName(localToday(), "long")
        : preset === "last-month"
          ? monthName(
              new Date(localToday().getFullYear(), localToday().getMonth() - 1, 1),
              "long",
            )
          : preset === "this-year"
            ? String(localToday().getFullYear())
            : preset === "last-30-days"
              ? "Últimos 30 dias"
              : preset === "last-90-days"
                ? "Últimos 90 dias"
                : start && end
                  ? `${fullDate(start)} – ${fullDate(end)}`
                  : "Período personalizado";
  const result = useLoad<Dashboard>(`/dashboard${suffix}`, token, logout, revision);
  const recent = useLoad<TransactionPage>(
    `/transactions${queryString({ startDate: start, endDate: end, limit: 5 })}`,
    token,
    logout,
    revision,
  );
  const comparisonCaption = result.data?.comparison
    ? `vs. ${comparisonLabel(result.data.comparison.startDate, result.data.comparison.endDate)}`
    : "Sem comparação";
  const comparisonTitle = result.data?.comparison
    ? `${periodCaption}: comparação com ${fullDate(result.data.comparison.startDate)} a ${fullDate(result.data.comparison.endDate)}`
    : `${periodCaption}: não há um período anterior comparável para este filtro.`;
  const showCurrentBalance = !end || end === dateValue(localToday());
  const balanceLabel = showCurrentBalance
      ? "Saldo atual"
      : "Saldo do período";
  const colors = ["#1254c8", "#21a7e8", "#16b879"];
  const top = result.data?.topCategories ?? [];
  const topTotal = top.reduce((sum, c) => sum + cents(c.amount), 0);
  const total = cents(result.data?.expense ?? "0");
  const remainder = Math.max(0, total - topTotal);
  const segments: ExpenseSegment[] = [
    ...top.map((category, index) => ({
      id: category.categoryId,
      categoryId: category.categoryId,
      name: category.name,
      amount: cents(category.amount),
      color: colors[index],
    })),
    ...(remainder > 0
      ? [{ id: "other", name: "Outras categorias", amount: remainder, color: "#d8e3f2" }]
      : []),
  ];
  let chartOffset = 0;
  const circumference = 2 * Math.PI * 83;
  const chartSegments = segments.map((segment) => {
    const share = total ? segment.amount / total : 0;
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
    <>
      <Heading
        eyebrow="PAINEL FINANCEIRO"
        title={`Olá, ${user.name.split(" ")[0]}!`}
        description="Acompanhe os principais números das suas finanças."
        action={
          <PeriodFilter
            preset={preset}
            start={start}
            end={end}
            onPresetChange={setPreset}
            onStartChange={setStart}
            onEndChange={setEnd}
          />
        }
      />
      {result.loading && <DashboardSkeleton />}
      {!result.loading && result.error && <State loading={false} error={result.error} />}
      {result.data && !result.loading && (
        <>
          <DashboardTopMetrics
            data={result.data}
            balanceLabel={balanceLabel}
            balanceValue={showCurrentBalance ? result.data.balance : result.data.balanceAtEnd}
            comparisonCaption={comparisonCaption}
            comparisonTitle={comparisonTitle}
          />
          <div className="dashboard-grid">
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
                              aria-label={`${segment.name}: ${money((segment.amount / 100).toFixed(2))}, ${shareLabel}% das despesas${segment.categoryId ? ". Ative para abrir os lançamentos desta categoria" : ""}`}
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
                      <strong>{activeSegment ? activeSegment.name : money((total / 100).toFixed(2))}</strong>
                      <small>{activeSegment ? `${money((activeSegment.amount / 100).toFixed(2))} · ${(activeSegment.share * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% das despesas` : "Total no período"}</small>
                    </div>
                  </div>
                  <ul className="legend">
                    {chartSegments.map((segment) => {
                      const selected = activeCategory === segment.id;
                      const contents = (
                        <>
                          <span className="dot" style={{ background: segment.color }} />
                          <span className="legend-name">{segment.name}</span>
                          <strong>{total > 0 ? `${(segment.amount / total * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` : "0%"}<small>{money((segment.amount / 100).toFixed(2))}</small></strong>
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
                              aria-label={`${segment.name}: ${money((segment.amount / 100).toFixed(2))}, ${(segment.share * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% das despesas. Abrir lançamentos da categoria`}
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
            <section className="panel dashboard-panel">
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
              {recent.loading ? <RecentSkeleton /> : recent.error ? <State loading={false} error={recent.error} /> : recent.data && (
                <div>
                  {recent.data.data.length ? (
                    recent.data.data.map((t) => (
                      <div className="recent" key={t.id}>
                        <span
                          className={`direction ${t.type === "INCOME" ? "up" : "down"}`}
                        >
                          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{t.type === "INCOME" ? <><path d="m5 16 11-11M9 5h7v7"/></> : <><path d="m5 8 11 11M9 19h7v-7"/></>}</svg>
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
          <PeriodIndicators data={result.data} comparisonCaption={comparisonCaption} />
        </>
      )}
    </>
  );
}
