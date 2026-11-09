import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError, errorText, number, post, type Station, type StationView } from "../lib/api";
import { Loading, Modal, Notice } from "./ui";

type Command = {
  request_id: string;
  action: "set_state" | "finish" | "accrue";
  online?: boolean;
  balance?: number;
  diff?: number;
};
type MockEvent = {
  event_id: string;
  user_id: number;
  diff: number;
  status: "pending" | "delivered" | "failed";
  last_error?: string;
};

export function MockControl({ station, onClose, onChange }: {
  station: Station;
  onClose: () => void;
  onChange: () => void;
}) {
  const path = `/admin/stations/${station.id}`;
  const storageKey = `washing-mock-command:${station.id}`;
  const [state, setState] = useState<StationView["state"]>(null);
  const [events, setEvents] = useState<MockEvent[]>([]);
  const [balance, setBalance] = useState("");
  const [diff, setDiff] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState<Command | null>(() => {
    try { return JSON.parse(localStorage.getItem(storageKey) || "null"); }
    catch { return null; }
  });

  async function refresh(signal?: AbortSignal) {
    const [view, history] = await Promise.all([
      api<StationView>(`${path}/state`, { signal }),
      api<{ items: MockEvent[] }>(`${path}/mock/events`, { signal }),
    ]);
    if (signal?.aborted) return;
    setState(view.state);
    setBalance(view.state ? String(view.state.balance) : "");
    setEvents(history.items);
  }

  useEffect(() => {
    const controller = new AbortController();
    refresh(controller.signal).catch((err) => {
      if (!controller.signal.aborted) setError(errorText(err));
    });
    return () => controller.abort();
  }, [station.id]);

  async function run(command: Command) {
    if (busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      // Save before sending. An uncertain response can be retried after reload
      // without awarding another bonus or finishing somebody's next session.
      localStorage.setItem(storageKey, JSON.stringify(command));
      setPending(command);
      const result = await post<{ event_id?: string }>(`${path}/mock`, command);
      localStorage.removeItem(storageKey);
      setPending(null);
      setNotice(result.event_id
        ? "Начисление сохранено в очереди. Обновите список, чтобы проверить доставку."
        : "Команда выполнена.");
      onChange();
      await refresh();
    } catch (err) {
      if (err instanceof ApiError && [400, 404, 409].includes(err.status)) {
        localStorage.removeItem(storageKey); setPending(null);
      }
      setError(errorText(err));
    } finally { setBusy(false); }
  }

  function send(command: Omit<Command, "request_id">) {
    if (pending) return;
    void run({ ...command, request_id: crypto.randomUUID() });
  }
  function submitAmount(event: FormEvent, action: "set_state" | "accrue") {
    event.preventDefault();
    const text = action === "set_state" ? balance : diff;
    const amount = Number(text);
    if (!/^\d+$/.test(text) || !Number.isSafeInteger(amount) || amount < (action === "accrue" ? 1 : 0)) {
      setError("Введите целое число в допустимом диапазоне."); return;
    }
    send(action === "accrue" ? { action, diff: amount } : { action, balance: amount });
  }
  async function retryEvent(eventID: string) {
    setBusy(true); setError("");
    try {
      await post(`${path}/mock/events/${encodeURIComponent(eventID)}/retry`, {});
      await refresh();
    } catch (err) { setError(errorText(err)); }
    finally { setBusy(false); }
  }
  const disabled = busy || !!pending || !state;

  return <Modal title={`Mock · ${station.name}`} onClose={onClose} busy={busy}>
    <p className="modal-description">Состояние меняется вручную. Одна единица баланса поста равна одному бонусу при списании.</p>
    {error && <Notice>{error}</Notice>}
    {notice && <Notice success>{notice}</Notice>}
    {pending && <div className="mock-pending">
      <Notice>Результат команды не подтверждён. Повторите её с прежним ID, прежде чем отправлять новую.</Notice>
      <button className="button primary" disabled={busy} onClick={() => void run(pending)}>Проверить команду</button>
    </div>}
    {!state && !error && <Loading />}
    {state && <p className="mock-summary">
      {state.online ? "Онлайн" : "Офлайн"} · Баланс: {number(state.balance)} · {state.user_id ? `Клиент №${state.user_id}` : "Без клиента"}
    </p>}
    <div className="mock-actions">
      <button className="button secondary" disabled={disabled || !!state?.online} onClick={() => send({ action: "set_state", online: true })}>Включить пост</button>
      <button className="button secondary" disabled={disabled || !state?.online} onClick={() => send({ action: "set_state", online: false })}>Отключить пост</button>
    </div>
    <form className="mock-form" onSubmit={(e) => submitAmount(e, "set_state")}>
      <label>Баланс поста<input inputMode="numeric" value={balance} disabled={disabled} onChange={(e) => setBalance(e.target.value)} required pattern="[0-9]+" /></label>
      <button className="button secondary" disabled={disabled}>Установить баланс</button>
      <p className="field-hint">Меняет только баланс поста. Бонусы клиента не начисляются.</p>
    </form>
    <form className="mock-form" onSubmit={(e) => submitAmount(e, "accrue")}>
      <label>Начислить бонусы клиенту<input inputMode="numeric" value={diff} disabled={disabled || !state?.user_id || !state?.online} onChange={(e) => setDiff(e.target.value)} required pattern="[0-9]+" /></label>
      <button className="button secondary" disabled={disabled || !state?.user_id || !state?.online}>Начислить бонусы</button>
      <p className="field-hint">Начисление получит клиент, привязанный к посту в момент команды.</p>
    </form>
    <button className="button secondary" disabled={disabled || (!state?.user_id && !state?.balance)} onClick={() => send({ action: "finish" })}>Завершить сессию и обнулить пост</button>
    <section className="mock-events">
      <div className="panel-heading"><h3>Начисления</h3><button className="text-link" disabled={busy} onClick={async () => {
        setBusy(true); setError("");
        try { await refresh(); } catch (err) { setError(errorText(err)); } finally { setBusy(false); }
      }}>Обновить состояние</button></div>
      {!events.length && <p className="muted">Начислений пока нет.</p>}
      {events.map((event) => <div className="mock-event" key={event.event_id}>
        <strong>+{number(event.diff)} · Клиент №{event.user_id}</strong>
        <span>{({ pending: "В очереди", delivered: "Доставлено", failed: "Ошибка доставки" })[event.status]}</span>
        {event.last_error && <small>{event.last_error}</small>}
        {event.status === "failed" && <button className="text-link" disabled={busy} onClick={() => void retryEvent(event.event_id)}>Повторить доставку</button>}
      </div>)}
    </section>
  </Modal>;
}
