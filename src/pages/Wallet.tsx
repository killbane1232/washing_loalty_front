import { useCallback, useEffect, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRight,
  ScanLine,
  Sparkles,
  Wallet,
  Droplets,
  RefreshCw,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
import {
  api,
  date,
  errorText,
  number,
  type HistoryItem,
  type Page,
} from "../lib/api";
import {
  Empty,
  Loading,
  Notice,
  PageTitle,
  Pagination,
} from "../components/ui";

export function HistoryList({ items }: { items: HistoryItem[] }) {
  if (!items.length)
    return (
      <Empty title="Здесь начинается ваша история">
        Отсканируйте QR-код на станции. После первой операции здесь появятся
        начисления и списания.
      </Empty>
    );
  return (
    <div className="history-list">
      {items.map((item) => (
        <div className="history-row" key={item.id}>
          <div className={`transaction-icon ${item.diff < 0 ? "spent" : ""}`}>
            {item.diff > 0 ? (
              <ArrowDownLeft size={21} />
            ) : (
              <ArrowUpRight size={21} />
            )}
          </div>
          <div className="transaction-info">
            <strong>
              {item.diff > 0 ? "Начисление за мойку" : "Оплата баллами"}
            </strong>
            <span>
              Станция №{item.station_id} <span className="separator">·</span>{" "}
              {date(item.datetime)}
            </span>
          </div>
          <div className={`transaction-amount ${item.diff < 0 ? "spent" : ""}`}>
            <strong>
              {item.diff > 0 ? "+" : "−"}
              {number(Math.abs(item.diff))}
              <span> б.</span>
            </strong>
            <span>Баланс: {number(item.balance_after)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function HomePage() {
  const { session, refresh } = useAuth();
  const [history, setHistory] = useState<HistoryItem[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const user = session!.user!;
  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const [data, current] = await Promise.all([
        api<Page<HistoryItem>>(`/history?user_id=${user.id}&page=1`),
        refresh(),
      ]);
      setHistory(data.items.slice(0, 4));
      if (!current) setError("Не удалось обновить баланс. Повторите запрос.");
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }, [user.id, refresh]);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <>
      <PageTitle
        eyebrow="Ваша программа лояльности"
        title={`Привет, ${user.login}!`}
        description="Хороший день, чтобы позаботиться о машине."
        action={
          <button
            className="icon-button outlined"
            onClick={() => void load()}
            disabled={busy}
            aria-label="Обновить баланс и историю"
          >
            <RefreshCw size={18} className={busy ? "spin" : ""} />
          </button>
        }
      />
      {error && <Notice>{error}</Notice>}
      {session?.pending_redemption && (
        <Notice>
          Есть списание, ожидающее подтверждения станции.{" "}
          <Link to="/scan">Проверить операцию</Link>
        </Notice>
      )}
      <div className="wallet-grid">
        <section className="balance-card">
          <div className="balance-top">
            <span>
              <Wallet size={19} /> Бонусный баланс
            </span>
            <span className="club-label">WASHING CLUB</span>
          </div>
          <div className="balance-value">
            {number(user.balance)}
            <span>баллов</span>
          </div>
          <p>Ваша следующая мойка — ещё выгоднее.</p>
          <div className="balance-bottom">
            <span>
              <span className="status-dot" />
              Готовы к использованию
            </span>
            <span>№ {String(user.id).padStart(6, "0")}</span>
          </div>
          <div className="balance-rings" aria-hidden="true" />
        </section>
        <Link to="/scan" className="scan-card">
          <span className="scan-card-icon">
            <ScanLine size={30} strokeWidth={1.6} />
          </span>
          <div>
            <h2>Начнём мойку?</h2>
            <p>
              Отсканируйте QR-код на станции,
              <br className="desktop-only" /> чтобы использовать или копить
              баллы.
            </p>
          </div>
          <span className="scan-card-button">
            Сканировать QR <ArrowUpRight size={19} />
          </span>
        </Link>
      </div>
      <div className="content-grid">
        <section className="panel history-panel">
          <div className="panel-heading">
            <div>
              <h2>Последние операции</h2>
              <p>Всё, что происходит с вашими баллами</p>
            </div>
            <Link className="text-link" to="/history">
              Вся история <ArrowRight size={16} />
            </Link>
          </div>
          {history ? (
            <HistoryList items={history} />
          ) : error ? (
            <button className="button secondary" onClick={() => void load()}>
              Повторить загрузку
            </button>
          ) : (
            <Loading />
          )}
        </section>
        <section className="how-card">
          <span className="eyebrow">
            <Sparkles size={15} /> Просто и с выгодой
          </span>
          <h2>
            Больше чистоты.
            <br />
            Больше бонусов.
          </h2>
          <ol>
            <li>
              <span>01</span>
              <div>
                <strong>Сканируйте QR</strong>
                <p>Код находится на станции мойки.</p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <strong>Выбирайте, как платить</strong>
                <p>Списывайте баллы или сохраняйте на потом.</p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <strong>Наслаждайтесь результатом</strong>
                <p>Следите за балансом станции в приложении.</p>
              </div>
            </li>
          </ol>
          <div className="how-card-footer">
            <Droplets size={22} />
            <span>Чистая привычка. Приятная выгода.</span>
          </div>
        </section>
      </div>
    </>
  );
}

export function HistoryPage() {
  const { session } = useAuth();
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page<HistoryItem> | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError("");
    api<Page<HistoryItem>>(
      `/history?user_id=${session!.user!.id}&page=${page}`,
      { signal: controller.signal },
    )
      .then(setData)
      .catch((err) => {
        if (!controller.signal.aborted) setError(errorText(err));
      });
    return () => controller.abort();
  }, [page, session?.user?.id, retry]);
  return (
    <>
      <PageTitle
        eyebrow="Все операции"
        title="История баллов"
        description="Начисления и списания — всё в одном месте."
      />
      {error && (
        <Notice>
          {error}{" "}
          <button className="text-link" onClick={() => setRetry((v) => v + 1)}>
            Повторить
          </button>
        </Notice>
      )}
      <section className="panel">
        <div className="panel-heading">
          <h2>Движение баллов</h2>
          <span className="pill">Сначала новые</span>
        </div>
        {data ? (
          <>
            <HistoryList items={data.items} />
            <Pagination page={page} more={data.has_more} onChange={setPage} />
          </>
        ) : (
          !error && <Loading />
        )}
      </section>
    </>
  );
}
