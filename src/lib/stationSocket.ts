import { ApiError, type StationView } from "./api";

export function socketURL() {
  return `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/api/ws/station`;
}
function socketError(code: string, status: number) {
  if (status === 401) window.dispatchEvent(new Event("session-expired"));
  const messages: Record<string, string> = {
    station_busy:
      "Станция занята другим пользователем или недоступна. Выберите другой пост.",
    insufficient_balance: "Недостаточно баллов. Укажите меньшую сумму.",
    redemption_pending:
      "Ожидаем подтверждение станции. Повторите проверку операции.",
    not_found: "Станция не найдена. Проверьте QR-код.",
    conflict:
      "Параметры операции изменились. Проверьте незавершённое списание.",
    unauthorized: "Сессия истекла. Войдите снова.",
    invalid_request: "Проверьте код станции и сумму списания.",
  };
  return new ApiError(
    status,
    code,
    messages[code] || "Нет связи со станцией. Восстанавливаем подключение…",
  );
}

export interface ConnectionCommand {
  qr: string;
  action: "save" | "spend";
  amount?: number;
  request_id?: string;
}
export function connectStation(command: ConnectionCommand): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(socketURL());
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      socket.close();
      if (error) reject(error);
      else resolve();
    };
    const timeout = setTimeout(
      () =>
        finish(
          new ApiError(
            0,
            "network",
            "Подключение не подтверждено. Повторите проверку операции.",
          ),
        ),
      40_000,
    );
    socket.onopen = () =>
      socket.send(JSON.stringify({ type: "connect", ...command }));
    socket.onmessage = (message) => {
      try {
        const value = JSON.parse(message.data);
        if (value.type === "connected") finish();
        else if (value.type === "error")
          finish(socketError(value.error.code, value.error.status));
      } catch {
        finish(new Error("Станция вернула некорректный ответ."));
      }
    };
    socket.onclose = () =>
      finish(
        new ApiError(
          0,
          "network",
          "Соединение прервано. Повторите подключение.",
        ),
      );
    socket.onerror = () =>
      finish(
        new ApiError(
          0,
          "network",
          "Не удалось подключиться к серверу. Проверьте сеть.",
        ),
      );
  });
}

export function watchStation(
  qr: string,
  onState: (state: StationView) => void,
  onStatus: (
    status: "connecting" | "live" | "reconnecting",
    error?: string,
  ) => void,
  onDisconnect?: () => void,
) {
  let stopped = false;
  let socket: WebSocket | undefined;
  let reconnect: ReturnType<typeof setTimeout>;
  let handshake: ReturnType<typeof setTimeout>;
  let attempt = 0;
  const open = () => {
    if (stopped) return;
    onStatus(attempt ? "reconnecting" : "connecting");
    socket = new WebSocket(socketURL());
    const current = socket;
    handshake = setTimeout(() => current.close(), 15_000);
    current.onopen = () =>
      current.send(JSON.stringify({ type: "subscribe", qr }));
    current.onmessage = (event) => {
      if (stopped) return;
      try {
        const value = JSON.parse(event.data);
        if (value.type === "state") {
          clearTimeout(handshake);
          attempt = 0;
          onStatus("live");
          onState(value as StationView);
        }
        if (value.type === "error") {
          clearTimeout(handshake);
          const error = socketError(value.error.code, value.error.status);
          if ([400, 401, 403, 404].includes(error.status)) stopped = true;
          onStatus("reconnecting", error.message);
          current.close();
        }
      } catch {
        current.close();
      }
    };
    current.onerror = () => current.close();
    current.onclose = () => {
      clearTimeout(handshake);
      if (stopped) return;
      onDisconnect?.();
      onStatus("reconnecting", "Связь прервана. Восстанавливаем подключение…");
      reconnect = setTimeout(open, Math.min(1000 * 2 ** attempt++, 15_000));
    };
  };
  open();
  return () => {
    stopped = true;
    clearTimeout(reconnect);
    clearTimeout(handshake);
    socket?.close();
  };
}
