export type PeriodPreset =
  | "this-month"
  | "last-month"
  | "last-30-days"
  | "last-90-days"
  | "this-year"
  | "all-time"
  | "custom";

export function dateValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function localToday(now = new Date()): Date {
  const value = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function clampedMonthDate(year: number, month: number, dayOfMonth: number): Date {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(dayOfMonth, lastDay));
}

export function comparisonRange(
  preset: PeriodPreset,
  start: string,
  end: string,
): { startDate: string; endDate: string } | null {
  if (preset === "all-time" || !start || !end) return null;
  const [startYear, startMonth, startDay] = start.split("-").map(Number);
  const [endYear, endMonth, endDay] = end.split("-").map(Number);
  const selectedStart = new Date(startYear, startMonth - 1, startDay);

  if (preset === "this-month") {
    return {
      startDate: dateValue(new Date(startYear, startMonth - 2, 1)),
      endDate: dateValue(clampedMonthDate(startYear, startMonth - 2, endDay)),
    };
  }
  if (preset === "last-month") {
    const previousMonthStart = new Date(startYear, startMonth - 2, 1);
    return {
      startDate: dateValue(previousMonthStart),
      endDate: dateValue(new Date(startYear, startMonth - 1, 0)),
    };
  }
  if (preset === "this-year") {
    return {
      startDate: `${startYear - 1}-01-01`,
      endDate: dateValue(clampedMonthDate(endYear - 1, endMonth - 1, endDay)),
    };
  }

  const duration = Math.round(
    (Date.UTC(endYear, endMonth - 1, endDay) - Date.UTC(startYear, startMonth - 1, startDay)) / 86_400_000,
  ) + 1;
  const previousEnd = new Date(selectedStart);
  previousEnd.setDate(previousEnd.getDate() - 1);
  const previousStart = new Date(previousEnd);
  previousStart.setDate(previousStart.getDate() - duration + 1);
  return { startDate: dateValue(previousStart), endDate: dateValue(previousEnd) };
}
