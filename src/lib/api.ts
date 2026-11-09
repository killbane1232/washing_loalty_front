export interface User {
  id: number;
  login: string;
  email: string;
  balance: number;
  updated_at: string;
}
export interface Station {
  id: number;
  name: string;
  point: string;
  qr: string;
  address: string;
  connection_type: string;
}
export interface Redemption {
  request_id: string;
  user_id: number;
  station: Station;
  amount: number;
  status: "pending" | "succeeded" | "rejected";
}
export interface Session {
  role: "admin" | "user";
  user?: User;
  expires_at: string;
  pending_redemption?: Redemption | null;
}
export interface HistoryItem {
  id: number;
  station_id: number;
  diff: number;
  balance_after: number;
  datetime: string;
}
export interface Page<T> {
  items: T[];
  page: number;
  page_size: number;
  has_more: boolean;
}
export interface StationView {
  station: Station;
  state: {
    online: boolean;
    balance: number;
    user_id?: number | null;
    linked_to_user?: boolean;
  } | null;
  error?: string;
  balance?: number;
}
export interface UserStats extends User {
  operations: number;
  earned: number;
  spent: number;
}
export interface Statistics {
  users: number;
  stations: number;
  balance: string;
  earned: string;
  spent: string;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

const messages: Record<string, string> = {
  unauthorized: "Сессия истекла. Войдите снова.",
  forbidden: "У вас нет доступа к этому действию.",
  not_found: "Пользователь или станция не найдены. Проверьте данные.",
  conflict: "Такие данные уже используются. Проверьте логин, email или QR-код.",
  station_busy:
    "Станция занята другим пользователем или недоступна. Выберите другой пост.",
  insufficient_balance: "Недостаточно баллов. Укажите меньшую сумму.",
  redemption_pending:
    "Ожидаем подтверждение станции. Повторная проверка не спишет баллы дважды.",
  connector_unavailable:
    "Не удалось связаться со станцией. Попробуйте ещё раз.",
  invalid_request: "Проверьте заполненные поля.",
  mock_conflict: "Команда отклонена: проверьте подключение клиента, доступность поста и уникальность ID команды.",
  busy: "Слишком много запросов. Попробуйте через несколько секунд.",
};

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      ...options,
      credentials: "same-origin",
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
      signal: options.signal ?? AbortSignal.timeout(40_000),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError")
      throw error;
    throw new ApiError(
      0,
      "network",
      "Нет связи с сервером. Проверьте подключение и попробуйте снова.",
    );
  }
  if (response.status === 204) return undefined as T;
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    if (
      response.status === 401 &&
      !["/login", "/register", "/admin/login", "/me"].includes(path)
    )
      window.dispatchEvent(new Event("session-expired"));
    const code = body?.error?.code || "server_error";
    throw new ApiError(
      response.status,
      code,
      messages[code] || "Не удалось выполнить запрос. Попробуйте позже.",
    );
  }
  if (!body)
    throw new ApiError(
      502,
      "invalid_response",
      "Сервер вернул некорректный ответ.",
    );
  return body as T;
}

export const post = <T>(path: string, body: unknown) =>
  api<T>(path, { method: "POST", body: JSON.stringify(body) });
export const errorText = (error: unknown) =>
  error instanceof Error ? error.message : "Не удалось выполнить действие.";
export const number = (value: number | string) =>
  new Intl.NumberFormat("ru-RU").format(
    typeof value === "string" ? BigInt(value) : value,
  );
export const date = (value: string) =>
  new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

export function parseQR(value: string): string {
  let qr = value.trim();
  if (/^https?:\/\//i.test(qr)) {
    try {
      qr = new URL(qr).searchParams.get("qr")?.trim() || qr;
    } catch {
      /* Validate raw QR below. */
    }
  }
  if (
    !qr ||
    new TextEncoder().encode(qr).length > 512 ||
    /[\x00-\x1f\x7f]/.test(qr)
  )
    throw new Error("Введите корректный код станции — до 512 байт.");
  return qr;
}

export function validAmount(value: string, balance: number): number | null {
  if (!/^\d+$/.test(value)) return null;
  const amount = Number(value);
  return Number.isSafeInteger(amount) && amount > 0 && amount <= balance
    ? amount
    : null;
}
