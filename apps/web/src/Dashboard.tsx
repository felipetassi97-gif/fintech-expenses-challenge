import { useState } from "react";
import { ExpenseChart } from "./ExpenseChart";
import "./dashboard.css";
import { queryString } from "./api";
import { comparisonRange, dateValue, localToday } from "./dashboard-period";
import type { PeriodPreset } from "./dashboard-period";
import type { Dashboard, TransactionPage, User } from "./api";
import { DashboardTopMetrics, PeriodIndicators } from "./DashboardMetrics";
import { DATE_RANGE_ERROR, Heading, State, day, hasInvertedDateRange, money, useLoad } from "./shared";
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
  invalidDateRange,
}: {
  preset: PeriodPreset;
  start: string;
  end: string;
  onPresetChange: (preset: PeriodPreset) => void;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
  invalidDateRange: boolean;
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
              aria-invalid={invalidDateRange || undefined}
              aria-describedby={invalidDateRange ? "dashboard-date-range-error" : undefined}
              onChange={(event) => onStartChange(event.target.value)}
            />
          </label>
          <label>
            Até
            <input
              type="date"
              value={end}
              min={start || undefined}
              aria-invalid={invalidDateRange || undefined}
              aria-describedby={invalidDateRange ? "dashboard-date-range-error" : undefined}
              onChange={(event) => onEndChange(event.target.value)}
            />
          </label>
          {invalidDateRange && (
            <p id="dashboard-date-range-error" className="field-error date-range-error" role="alert">
              {DATE_RANGE_ERROR}
            </p>
          )}
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
  const [preset, setPreset] = useState<PeriodPreset>("this-month");
  const [start, setStart] = useState(() => {
    const today = localToday();
    return dateValue(new Date(today.getFullYear(), today.getMonth(), 1));
  });
  const [end, setEnd] = useState(() => dateValue(localToday()));
  const invalidDateRange = hasInvertedDateRange(start, end);
  const previousPeriod = invalidDateRange ? null : comparisonRange(preset, start, end);
  const suffix = queryString({
    startDate: start,
    endDate: end,
    comparisonStartDate: previousPeriod?.startDate,
    comparisonEndDate: previousPeriod?.endDate,
  });
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
  const result = useLoad<Dashboard>(`/dashboard${suffix}`, token, logout, revision, !invalidDateRange);
  const recent = useLoad<TransactionPage>(
    `/transactions${queryString({ startDate: start, endDate: end, limit: 5 })}`,
    token,
    logout,
    revision,
    !invalidDateRange,
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
      : "Saldo acumulado";
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
            invalidDateRange={invalidDateRange}
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
            <ExpenseChart data={result.data} start={start} end={end} navigate={navigate} />
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
