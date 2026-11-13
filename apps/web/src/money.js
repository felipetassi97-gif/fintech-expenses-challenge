const currencyWithoutCents = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const decimalAmount = /^(-?)(\d+)(?:\.(\d{1,2}))?$/;

export function money(value) {
  const match = decimalAmount.exec(value);
  if (!match) {
    throw new Error("Invalid monetary amount");
  }

  const [, sign, whole, fractional = ""] = match;
  const formattedWhole = currencyWithoutCents.format(BigInt(whole));
  const cents = `${fractional}00`.slice(0, 2);
  return `${sign}${formattedWhole},${cents}`;
}

export function decimalFromCents(value) {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const whole = absolute / 100n;
  const cents = String(absolute % 100n).padStart(2, "0");
  return `${negative ? "-" : ""}${whole}.${cents}`;
}
