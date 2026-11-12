export type User = { id: string; name: string; email: string };
export type Category = { id: string; name: string; description: string | null };
export type TransactionType = "INCOME" | "EXPENSE";
export type Transaction = {
  id: string;
  categoryId: string;
  description: string;
  type: TransactionType;
  amount: string;
  date: string;
};
export type TransactionInput = Omit<Transaction, "id">;
export type Dashboard = {
  balance: string;
  income: string;
  expense: string;
  topCategories: { categoryId: string; name: string; amount: string }[];
};
export type TransactionPage = {
  data: Transaction[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const baseUrl = (
  import.meta.env.VITE_API_URL || "http://localhost:3000/api"
).replace(/\/$/, "");

export async function request<T>(
  path: string,
  options: {
    method?: string;
    token?: string;
    body?: unknown;
    signal?: AbortSignal;
  } = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method: options.method ?? "GET",
      headers: {
        ...(options.body !== undefined
          ? { "Content-Type": "application/json" }
          : {}),
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError")
      throw error;
    throw new ApiError(
      0,
      "Não foi possível concluir agora. Verifique sua conexão e tente novamente.",
    );
  }
  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null);
    const message =
      payload && typeof payload === "object" && "message" in payload
        ? payload.message
        : null;
    throw new ApiError(
      response.status,
      Array.isArray(message)
        ? message.join(", ")
        : typeof message === "string"
          ? message
          : "Não foi possível concluir a solicitação.",
    );
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function queryString(
  values: Record<string, string | number | undefined>,
): string {
  const query = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== "") query.set(key, String(value));
  });
  const result = query.toString();
  return result ? `?${result}` : "";
}
