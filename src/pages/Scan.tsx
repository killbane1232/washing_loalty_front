import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Coins,
  Leaf,
  MapPin,
  RefreshCw,
  ScanLine,
  ShieldCheck,
} from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../lib/auth";
import {
  ApiError,
  errorText,
  number,
  parseQR,
  validAmount,
  type Redemption,
  type StationView,
} from "../lib/api";
import { connectStation, watchStation } from "../lib/stationSocket";
import { Scanner } from "../components/Scanner";
import { Empty, Loading, Notice, PageTitle } from "../components/ui";

export function ScanPage() {
  const { session, refresh } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [qr, setQR] = useState("");
  const [amount, setAmount] = useState("");
  const [choice, setChoice] = useState<"save" | "spend">("save");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const request = useRef<{
    qr: string;
    amount: number;
    request_id: string;
  } | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const pending = session?.pending_redemption;
  const user = session!.user!;
  const scanned = useCallback((raw: string) => {
    try {
      setQR(parseQR(raw));
      setError("");
    } catch (e) {
      setError(errorText(e));
    }
  }, []);
  useEffect(() => {
    const code = params.get("qr");
    if (code) scanned(code);
  }, [params, scanned]);
  const destination = (code: string) =>
    navigate(`/station?qr=${encodeURIComponent(code)}`);
  async function resume(value: Redemption) {
    request.current = {
      qr: value.station.qr,
      amount: value.amount,
      request_id: value.request_id,
    };
    setUncertain(true);
    await complete(true);
  }
  async function complete(retry = false) {
    if (busy) return;
    setError("");
    if (!retry && choice === "spend") {
      const value = validAmount(amount, user.balance);
      if (value === null) {
        setError("Введите целое количество баллов от 1 до доступного баланса.");
        return;
      }
      request.current = { qr, amount: value, request_id: crypto.randomUUID() };
    }
    setBusy(true);
    try {
      if (retry || choice === "spend") {
        await connectStation({ ...request.current!, action: "spend" });
        const code = request.current!.qr;
        setUncertain(false);
        request.current = null;
        await refresh();
        destination(code);
      } else {
        await connectStation({ qr, action: "save" });
        await refresh();
        destination(qr);
      }
    } catch (err) {
      setError(errorText(err));
      if (request.current) {
        // Unknown network outcomes retain the ID, including after a page reload via /me.
        setUncertain(
          !(err instanceof ApiError) ||
            err.status === 0 ||
            err.status >= 500 ||
            err.code === "redemption_pending",
        );
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  }
  const manual = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    scanned(String(new FormData(e.currentTarget).get("qr")));
  };
  return (
    <>
      <PageTitle
        eyebrow="Подключение к станции"
        title="Один QR — и вы на месте"
        description="Сканируйте код на посту и выберите, как использовать баллы."
      />
      <div className="scan-layout">
        <section className="panel scan-panel">
          {error && <Notice>{error}</Notice>}
          {pending || uncertain ? (
            <div className="pending-state">
              <RefreshCw size={36} />
              <h2>Проверим списание</h2>
              <p>
                Станция ещё не подтвердила операцию. Сохранили её номер, чтобы
                повторная проверка не списала баллы дважды.
              </p>
              <div className="amount-preview">
                {number(pending?.amount ?? request.current?.amount ?? 0)}{" "}
                <span>баллов</span>
              </div>
              <button
                className="button primary full"
                disabled={busy}
                onClick={() =>
                  pending ? void resume(pending) : void complete(true)
                }
              >
                {busy ? "Проверяем…" : "Проверить операцию"}
                <RefreshCw size={18} />
              </button>
            </div>
          ) : !qr ? (
            <>
              <Scanner onScan={scanned} />
              <div className="form-divider">
                <span>или введите код станции</span>
              </div>
              <form className="manual-form" onSubmit={manual}>
                <label className="sr-only" htmlFor="qr-manual">
                  Код станции
                </label>
                <input
                  id="qr-manual"
                  name="qr"
                  required
                  placeholder="Например, station-01"
                  maxLength={512}
                  autoComplete="off"
                />
                <button
                  className="button primary"
                  aria-label="Продолжить с кодом станции"
                >
                  <ArrowRight size={19} />
                </button>
              </form>
            </>
          ) : (
            <>
              <button
                className="text-link back-link"
                disabled={busy}
                onClick={() => {
                  setQR("");
                  setError("");
                }}
              >
                <ArrowLeft size={16} /> Сканировать другой код
              </button>
              <div className="scan-success">
                <span>
                  <Check size={24} />
                </span>
                <div>
                  <strong>QR-код распознан</strong>
                  <p>{qr}</p>
                </div>
              </div>
              <h2 className="choice-heading">Списать баллы или сохранить?</h2>
              <p className="muted">
                На вашем счёте <strong>{number(user.balance)} баллов</strong>.
              </p>
              <div className="choice-list">
                <label
                  className={`choice-card ${choice === "save" ? "selected" : ""}`}
                >
                  <input
                    type="radio"
                    name="choice"
                    checked={choice === "save"}
                    onChange={() => setChoice("save")}
                    disabled={busy}
                  />
                  <Leaf size={23} />
                  <span>
                    <strong>Сохранить баллы</strong>
                    <small>Оставить бонусы для следующей мойки</small>
                  </span>
                </label>
                <label
                  className={`choice-card ${choice === "spend" ? "selected" : ""}`}
                >
                  <input
                    type="radio"
                    name="choice"
                    checked={choice === "spend"}
                    onChange={() => setChoice("spend")}
                    disabled={busy || user.balance < 1}
                  />
                  <Coins size={23} />
                  <span>
                    <strong>Списать баллы</strong>
                    <small>
                      {user.balance < 1
                        ? "Пока нет доступных баллов"
                        : "Использовать часть баланса на станции"}
                    </small>
                  </span>
                </label>
              </div>
              {choice === "spend" && (
                <label className="amount-field">
                  Сколько баллов списать?
                  <input
                    type="text"
                    inputMode="numeric"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0"
                    disabled={busy}
                  />
                  <span className="field-hint">
                    От 1 до {number(user.balance)} баллов
                  </span>
                </label>
              )}
              <button
                className="button primary full"
                disabled={
                  busy ||
                  (choice === "spend" &&
                    validAmount(amount, user.balance) === null)
                }
                onClick={() => void complete()}
              >
                {busy
                  ? "Подключаемся…"
                  : choice === "spend"
                    ? "Списать и подключиться"
                    : "Сохранить и подключиться"}
                <ArrowRight size={18} />
              </button>
              <p className="secure-note">
                <ShieldCheck size={15} /> Подключение доступно только к
                свободной станции
              </p>
            </>
          )}
        </section>
        <aside className="scan-help">
          <div className="help-icon">
            <ScanLine size={26} />
          </div>
          <h2>
            Ваш пост.
            <br />
            Ваш баланс.
          </h2>
          <p>
            QR-код размещён на панели станции. Разрешите доступ к камере и
            поместите код в рамку.
          </p>
          <div className="help-divider" />
          <h3>Станция занята?</h3>
          <p>
            Если на посту уже другой пользователь, приложение не подключит вас.
            Дождитесь освобождения или выберите другой пост.
          </p>
          <Link to="/history" className="text-link">
            Посмотреть историю <ArrowRight size={16} />
          </Link>
        </aside>
      </div>
    </>
  );
}

export function StationPage() {
  const [params] = useSearchParams();
  const qr = params.get("qr") || "";
  const { session, refresh } = useAuth();
  const [data, setData] = useState<StationView | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [updated, setUpdated] = useState<Date | null>(null);
  const [retry, setRetry] = useState(0);
  const [connection, setConnection] = useState<
    "connecting" | "live" | "reconnecting"
  >("connecting");
  useEffect(() => {
    if (!qr) {
      setLoading(false);
      return;
    }
    setLoading(true);
    return watchStation(
      qr,
      (value) => {
        setData(value);
        setError("");
        setUpdated(new Date());
        setLoading(false);
      },
      (status, message) => {
        setConnection(status);
        if (status !== "live") setData(null);
        if (message) {
          setError(message);
          setLoading(false);
        }
      },
      () => {
        void refresh();
      },
    );
  }, [qr, session?.user?.id, retry, refresh]);
  return (
    <>
      <PageTitle
        eyebrow="Текущая мойка"
        title={data?.station.name || "Баланс станции"}
        description="Состояние и баланс поста обновляются в реальном времени."
      />
      {!qr ? (
        <Empty title="Сначала выберите станцию">
          <Link to="/scan">Отсканировать QR-код</Link>
        </Empty>
      ) : error ? (
        <Notice>
          {error}{" "}
          <button className="text-link" onClick={() => setRetry((v) => v + 1)}>
            Повторить
          </button>
        </Notice>
      ) : loading && !data ? (
        <Loading />
      ) : data?.state?.linked_to_user ? (
        <div className="station-layout">
          <section className="station-balance">
            <span className={`pill ${data.state.online ? "green" : ""}`}>
              <span className="status-dot" />
              {data.state.online ? "Станция онлайн" : "Станция не в сети"}
            </span>
            <div className="station-name">
              <MapPin size={18} />
              {data.station.name} · {data.station.point}
            </div>
            <p>Текущий баланс на станции</p>
            <div className="station-value">
              {number(data.state.balance)}
              <span>ед.</span>
            </div>
            <div className="station-balance-footer">
              <RefreshCw size={15} />
              {connection === "live" ? "В реальном времени" : "Подключаемся…"}
              {updated && <span>{updated.toLocaleTimeString("ru-RU")}</span>}
            </div>
          </section>
          <section className="panel station-details">
            <span className="eyebrow">Ваш аккаунт</span>
            <h2>Бонусы под контролем</h2>
            <div className="detail-balance">
              {number(data.balance ?? 0)} <span>баллов</span>
            </div>
            <p>
              Это бонусный баланс вашего аккаунта. Баланс станции отображается
              отдельно.
            </p>
            <Link className="button secondary full" to="/history">
              История операций <ArrowRight size={17} />
            </Link>
          </section>
        </div>
      ) : (
        data && (
          <section className="panel">
            <Empty title="Вы не подключены к этой станции">
              Пост свободен, занят другим пользователем или ваша мойка уже
              завершена. Для подключения отсканируйте QR-код.
            </Empty>
            <Link className="button primary" to="/scan">
              Сканировать QR <ScanLine size={18} />
            </Link>
          </section>
        )
      )}
      <Link className="text-link station-back" to="/">
        <ArrowLeft size={16} /> На главную
      </Link>
    </>
  );
}
