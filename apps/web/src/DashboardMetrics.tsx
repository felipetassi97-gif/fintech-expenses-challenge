import { useState } from "react";
import type { Dashboard, MetricChange } from "./api";
import { money } from "./shared";

type ComparisonKind = "balance" | "income" | "expense";

function changeText(change: MetricChange): string {
  if (change.status === "new") return "Novo";
  if (change.status === "no_baseline") return "Sem base";
  if (change.status === "unavailable" || change.value === null)
    return "Sem comparação";

  const value = Number(change.value);
  const formatted = Math.abs(value).toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${formatted}%`;
}

function changeTone(change: MetricChange, kind: ComparisonKind) {
  if (change.status !== "available" && change.status !== "new") return "neutral";
  if (change.direction === "flat") return "neutral";
  const favorable = kind === "expense"
    ? change.direction === "down"
    : change.direction === "up";
  return favorable ? "positive" : "negative";
}

function signedCurrency(value: string | null): string | null {
  if (value === null) return null;
  const numeric = Number(value);
  const sign = numeric > 0 ? "+" : numeric < 0 ? "−" : "";
  return `${sign}${money(Math.abs(numeric).toFixed(2))}`;
}

function TrendIcon({ direction }: { direction: MetricChange["direction"] }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {direction === "up" ? <path d="M10 16V4m-5 5 5-5 5 5" /> : direction === "down" ? <path d="M10 4v12m-5-5 5 5 5-5" /> : <path d="M4 10h12m-5-4 5 4-5 4" />}
    </svg>
  );
}

function MetricTrend({
  change,
  kind,
  comparisonCaption,
  comparisonTitle,
}: {
  change: MetricChange;
  kind: ComparisonKind;
  comparisonCaption: string;
  comparisonTitle: string;
}) {
  return (
    <div className="metric-trend" title={comparisonTitle}>
      <span className={`trend-badge ${changeTone(change, kind)}`}>
        <TrendIcon direction={change.direction} />
        {changeText(change)}
      </span>
      <small>{comparisonCaption}</small>
      {signedCurrency(change.amountDifference) && (
        <small className="metric-difference" aria-label={`Diferença em reais: ${signedCurrency(change.amountDifference)}`}>
          {signedCurrency(change.amountDifference)}
        </small>
      )}
    </div>
  );
}

function MetricIcon({ kind }: { kind: ComparisonKind }) {
  return (
    <span className="metric-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {kind === "balance" ? <><rect x="3" y="6" width="18" height="14" rx="2" /><path d="M3 9V6a2 2 0 0 1 2-2h13M16 14h5" /></> : kind === "income" ? <><path d="m4 16 6-6 4 4 6-7" /><path d="M15 7h5v5" /></> : <><path d="M12 3v16M6 13l6 6 6-6" /></>}
      </svg>
    </span>
  );
}

function IndicatorIcon({ kind }: { kind: "income" | "expense" | "share" | "result" }) {
  return (
    <span className={`period-indicator-icon ${kind}`} aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {kind === "income" ? <><path d="M5 19V12m5 7V8m5 11V5m5 14V9" /></> : kind === "expense" ? <><path d="m20 13-7 7L3 10V3h7l10 10Z" /><circle cx="7.5" cy="7.5" r=".8" /></> : kind === "share" ? <><path d="M12 3a9 9 0 1 0 9 9h-9V3Z" /><path d="M15 3.5A9 9 0 0 1 20.5 9H15V3.5Z" /></> : <><path d="m4 16 6-6 4 4 6-7" /><path d="M15 7h5v5" /></>}
      </svg>
    </span>
  );
}

function IndicatorCard({
  kind,
  value,
  label,
  detail,
  help,
  tone = "neutral",
}: {
  kind: "income" | "expense" | "share" | "result";
  value: string;
  label: string;
  detail: string;
  help: string;
  tone?: "positive" | "negative" | "neutral";
}) {
  return (
    <article className="period-indicator-card">
      <IndicatorIcon kind={kind} />
      <div className="period-indicator-copy">
        <strong className={`period-indicator-value ${tone}${value.length > 10 ? " compact" : ""}`}>{value}</strong>
        <span className="period-indicator-label">
          {label}
          <IndicatorHelp label={label} text={help} />
        </span>
        <small>{detail}</small>
      </div>
    </article>
  );
}

function IndicatorHelp({ label, text }: { label: string; text: string }) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pinned, setPinned] = useState(false);
  const open = hovered || focused || pinned;

  return (
    <span
      className={`indicator-help-wrap${open ? " open" : ""}`}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") setHovered(true);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") setHovered(false);
      }}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setFocused(false);
          setPinned(false);
        }
      }}
    >
      <button
        type="button"
        className="indicator-help-button"
        aria-label={`Sobre ${label}`}
        aria-describedby={`help-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
        aria-expanded={open}
        onClick={() => setPinned((value) => !value)}
      >
        <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="10" cy="10" r="7.5" />
          <path d="M10 9v4m0-6h.01" />
        </svg>
      </button>
      <span
        className="indicator-tooltip"
        id={`help-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
        role="tooltip"
        hidden={!open}
      >
        {text}
      </span>
    </span>
  );
}

export function DashboardTopMetrics({
  data,
  balanceLabel,
  balanceValue,
  comparisonCaption,
  comparisonTitle,
}: {
  data: Dashboard;
  balanceLabel: string;
  balanceValue: string;
  comparisonCaption: string;
  comparisonTitle: string;
}) {
  return (
    <div className="metrics">
      {([
        { kind: "balance", label: balanceLabel, value: balanceValue },
        { kind: "income", label: "Entradas", value: data.income },
        { kind: "expense", label: "Despesas", value: data.expense },
      ] as const).map(({ kind, label, value }) => (
        <article className={`metric ${kind}`} key={kind}>
          <div className="metric-label"><MetricIcon kind={kind} />{label}</div>
          <strong className={money(value).length > 18 ? "metric-amount-compact" : undefined}>{money(value)}</strong>
          <MetricTrend
            change={data.changes[kind]}
            kind={kind}
            comparisonCaption={comparisonCaption}
            comparisonTitle={comparisonTitle}
          />
        </article>
      ))}
    </div>
  );
}

export function PeriodIndicators({
  data,
  comparisonCaption,
}: {
  data: Dashboard;
  comparisonCaption: string;
}) {
  const incomeTone = changeTone(data.periodIndicators.incomeGrowth, "income");
  const expenseTone = changeTone(data.periodIndicators.expenseVariation, "expense");
  const operationalValue = data.periodIndicators.operationalParticipation === null
    ? "—"
    : `${Number(data.periodIndicators.operationalParticipation).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
  const resultValue = Number(data.periodIndicators.periodResult);
  const resultTone = resultValue > 0 ? "positive" : resultValue < 0 ? "negative" : "neutral";

  return (
    <section className="period-indicators" aria-labelledby="period-indicators-title">
      <h2 id="period-indicators-title">Indicadores do período</h2>
      <div className="period-indicator-grid">
        <IndicatorCard
          kind="income"
          value={changeText(data.periodIndicators.incomeGrowth)}
          label="Crescimento das entradas"
          detail={comparisonCaption}
          help="Compara as entradas deste período com o período de referência. A variação é calculada sobre o valor anterior; sem base anterior, não há percentual."
          tone={incomeTone}
        />
        <IndicatorCard
          kind="expense"
          value={changeText(data.periodIndicators.expenseVariation)}
          label="Variação das despesas"
          detail={comparisonCaption}
          help="Compara as despesas deste período com o período de referência. A redução aparece em verde; o aumento, em vermelho."
          tone={expenseTone}
        />
        <IndicatorCard
          kind="share"
          value={operationalValue}
          label="Participação operacional"
          detail={data.periodIndicators.operationalParticipation === null ? "Sem entradas no período" : "Despesas sobre entradas"}
          help="Percentual das entradas consumido pelas despesas: despesas do período divididas pelas entradas do período."
          tone="neutral"
        />
        <IndicatorCard
          kind="result"
          value={money(data.periodIndicators.periodResult)}
          label="Resultado do período"
          detail="Entradas menos despesas"
          help="Resultado líquido do intervalo: total de entradas menos total de despesas."
          tone={resultTone}
        />
      </div>
    </section>
  );
}
