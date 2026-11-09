import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowRight,
  MapPin,
  Users,
  Wallet,
  TrendingUp,
  Plus,
  Pencil,
  Search,
  KeyRound,
  Check,
  RefreshCw,
} from "lucide-react";
import { Link } from "react-router-dom";
import { MockControl } from "../components/MockControl";
import {
  api,
  errorText,
  number,
  post,
  type Page,
  type Station,
  type StationView,
  type Statistics,
  type UserStats,
} from "../lib/api";
import {
  Empty,
  Loading,
  Modal,
  Notice,
  PageTitle,
  Pagination,
} from "../components/ui";

function useData<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError("");
    api<T>(path, { signal: controller.signal })
      .then(setData)
      .catch((err) => {
        if (!controller.signal.aborted) setError(errorText(err));
      });
    return () => controller.abort();
  }, [path, version]);
  return { data, error, reload: () => setVersion((v) => v + 1) };
}

export function AdminHome() {
  const { data, error, reload } = useData<Statistics>("/admin/statistics");
  return (
    <>
      <PageTitle
        eyebrow="Панель управления"
        title="Всё под контролем"
        description="Обзор вашей программы лояльности."
        action={
          <button
            className="icon-button outlined"
            aria-label="Обновить статистику"
            onClick={reload}
          >
            <RefreshCw size={18} />
          </button>
        }
      />
      {error && <Notice>{error}</Notice>}
      {data ? (
        <div className="stats-grid">
          {[
            { icon: Users, label: "Пользователей", value: data.users },
            { icon: MapPin, label: "Станций", value: data.stations },
            { icon: Wallet, label: "Баллы на счетах", value: data.balance },
            {
              icon: TrendingUp,
              label: "Начислено за всё время",
              value: data.earned,
            },
          ].map(({ icon: Icon, label, value }) => (
            <section className="panel stat-card" key={label}>
              <span className="stat-icon">
                <Icon size={21} />
              </span>
              <p>{label}</p>
              <strong>{number(value)}</strong>
            </section>
          ))}
        </div>
      ) : (
        !error && <Loading />
      )}
      <div className="admin-links">
        <Link to="/admin/stations" className="panel admin-link-card">
          <span className="help-icon">
            <MapPin size={26} />
          </span>
          <h2>Станции</h2>
          <p>
            Создавайте посты, меняйте параметры подключения и проверяйте
            доступность.
          </p>
          <span className="text-link">
            Управлять станциями <ArrowRight size={18} />
          </span>
        </Link>
        <Link to="/admin/users" className="panel admin-link-card">
          <span className="help-icon">
            <Users size={26} />
          </span>
          <h2>Пользователи</h2>
          <p>
            Находите участников, просматривайте статистику и восстанавливайте
            доступ.
          </p>
          <span className="text-link">
            Открыть пользователей <ArrowRight size={18} />
          </span>
        </Link>
      </div>
      {data && (
        <p className="muted">
          Всего использовано: <strong>{number(data.spent)} баллов</strong>.
          Статистика рассчитана по всем операциям программы.
        </p>
      )}
    </>
  );
}

const blankStation = {
  name: "",
  point: "",
  qr: "",
  address: "mock://local",
  connection_type: "mock",
};
function StationForm({
  station,
  onClose,
  onSave,
}: {
  station: Station | null;
  onClose: () => void;
  onSave: () => void;
}) {
  const [value, setValue] = useState(station || blankStation);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    const fields = {
      name: value.name.trim(),
      point: value.point.trim(),
      qr: value.qr.trim(),
      address: value.address.trim(),
      connection_type: value.connection_type.trim().toLowerCase(),
    };
    for (const [key, text] of Object.entries(fields)) {
      const limit = ["name", "point"].includes(key)
        ? 200
        : key === "connection_type"
          ? 64
          : 512;
      if (
        !text ||
        new TextEncoder().encode(text).length > limit ||
        /[\x00-\x1f\x7f]/.test(text)
      ) {
        setError(
          `Поле «${{ name: "Название", point: "Пост", qr: "QR-код", address: "Адрес", connection_type: "Протокол" }[key]}» не заполнено или превышает лимит ${limit} байт.`,
        );
        return;
      }
    }
    setBusy(true);
    try {
      await api(station ? `/admin/stations/${station.id}` : "/admin/stations", {
        method: station ? "PUT" : "POST",
        body: JSON.stringify(fields),
      });
      onSave();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={station ? "Редактировать станцию" : "Новая станция"}
      onClose={onClose}
      busy={busy}
    >
      {error && <Notice>{error}</Notice>}
      <form onSubmit={submit}>
        <label>
          Название
          <input
            value={value.name}
            onChange={(e) => setValue({ ...value, name: e.target.value })}
            required
            placeholder="Мойка на Центральной"
            maxLength={200}
          />
        </label>
        <label>
          Идентификатор поста
          <input
            value={value.point}
            onChange={(e) => setValue({ ...value, point: e.target.value })}
            required
            placeholder="post-1"
            maxLength={200}
          />
        </label>
        <label>
          QR-код станции
          <input
            value={value.qr}
            onChange={(e) => setValue({ ...value, qr: e.target.value })}
            required
            placeholder="station-01"
            maxLength={512}
          />
          <span className="field-hint">
            Уникальный текст, закодированный в QR на станции.
          </span>
        </label>
        <label>
          Адрес оборудования
          <input
            value={value.address}
            onChange={(e) => setValue({ ...value, address: e.target.value })}
            required
            placeholder="10.0.0.5:9000"
            maxLength={512}
          />
          {value.connection_type === "mock" && <span className="field-hint">Для mock можно оставить mock://local. Подключение к оборудованию не требуется.</span>}
        </label>
        <label>
          Протокол подключения
          <input
            value={value.connection_type}
            onChange={(e) =>
              setValue({ ...value, connection_type: e.target.value })
            }
            required
            list="protocols"
            pattern="[a-z0-9_\-]{1,64}"
          />
          <datalist id="protocols">
            <option value="mock" />
            <option value="tcp" />
            <option value="http" />
            <option value="modbus_tcp" />
          </datalist>
        </label>
        <div className="modal-actions">
          <button
            className="button secondary"
            type="button"
            onClick={onClose}
            disabled={busy}
          >
            Отмена
          </button>
          <button className="button primary" disabled={busy}>
            {busy ? "Сохраняем…" : "Сохранить станцию"}
            <Check size={17} />
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function StationsPage() {
  const [page, setPage] = useState(1);
  const { data, error, reload } = useData<Page<StationView>>(
    `/admin/stations?page=${page}`,
  );
  const [editing, setEditing] = useState<Station | null | undefined>(undefined);
  const [controlling, setControlling] = useState<Station | null>(null);
  const [success, setSuccess] = useState("");
  return (
    <>
      <PageTitle
        eyebrow="Управление оборудованием"
        title="Станции"
        description="Посты мойки, их состояние и параметры подключения."
        action={
          <button className="button primary" onClick={() => setEditing(null)}>
            <Plus size={18} />
            Добавить станцию
          </button>
        }
      />
      {success && <Notice success>{success}</Notice>}
      {error && <Notice>{error}</Notice>}
      <section className="panel table-panel">
        <div className="panel-heading">
          <h2>Список станций</h2>
          <button className="text-link" onClick={reload}>
            <RefreshCw size={16} />
            Обновить
          </button>
        </div>
        {data ? (
          data.items.length ? (
            <>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Станция / пост</th>
                      <th>Состояние</th>
                      <th>Баланс поста</th>
                      <th>Подключение</th>
                      <th>
                        <span className="sr-only">Действия</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map(({ station, state }) => (
                      <tr key={station.id}>
                        <td>
                          <strong>{station.name}</strong>
                          <span className="table-sub">
                            {station.point} · №{station.id}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`pill ${state?.online ? (state.user_id ? "amber" : "green") : "neutral"}`}
                          >
                            <span className="status-dot" />
                            {!state
                              ? "Нет связи"
                              : !state.online
                                ? "Офлайн"
                                : state.user_id
                                  ? "Занята"
                                  : "Свободна"}
                          </span>
                        </td>
                        <td>{state ? number(state.balance) : "—"}</td>
                        <td>
                          <strong className="protocol">
                            {station.connection_type}
                          </strong>
                          <span className="table-sub">{station.address}</span>
                        </td>
                        <td>
                          {station.connection_type === "mock" && <button
                            className="button secondary small mock-open"
                            aria-label={`Управлять mock ${station.name}`}
                            onClick={() => setControlling(station)}
                          >Управлять mock</button>}
                          <button
                            className="icon-button outlined"
                            aria-label={`Редактировать ${station.name}`}
                            onClick={() => setEditing(station)}
                          >
                            <Pencil size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={page} more={data.has_more} onChange={setPage} />
            </>
          ) : (
            <Empty title="Добавьте первую станцию">
              Укажите параметры поста и уникальный QR-код для подключения
              пользователей.
            </Empty>
          )
        ) : (
          !error && <Loading />
        )}
      </section>
      {controlling && <MockControl station={controlling} onClose={() => setControlling(null)} onChange={reload} />}
      {editing !== undefined && (
        <StationForm
          station={editing}
          onClose={() => setEditing(undefined)}
          onSave={() => {
            setEditing(undefined);
            setSuccess("Параметры станции сохранены.");
            reload();
          }}
        />
      )}
    </>
  );
}

function PasswordForm({
  user,
  onClose,
  onSave,
}: {
  user: UserStats;
  onClose: () => void;
  onSave: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password"));
    if (password !== form.get("confirm")) {
      setError("Пароли не совпадают.");
      return;
    }
    if (new TextEncoder().encode(password).length > 1024) {
      setError("Пароль превышает лимит 1024 байта.");
      return;
    }
    setBusy(true);
    try {
      await post(`/admin/users/${user.id}/reset-password`, { hash: password });
      onSave();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Сбросить пароль" onClose={onClose} busy={busy}>
      <p className="modal-description">
        Новый пароль для <strong>{user.login}</strong> ({user.email}). Текущие
        сессии пользователя будут завершены.
      </p>
      {error && <Notice>{error}</Notice>}
      <form onSubmit={submit}>
        <label>
          Новый пароль
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={1024}
            placeholder="Не менее 8 символов"
          />
        </label>
        <label>
          Повторите пароль
          <input
            name="confirm"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={1024}
          />
        </label>
        <div className="modal-actions">
          <button
            className="button secondary"
            type="button"
            onClick={onClose}
            disabled={busy}
          >
            Отмена
          </button>
          <button className="button primary" disabled={busy}>
            {busy ? "Сохраняем…" : "Изменить пароль"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function UsersPage() {
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const { data, error, reload } = useData<Page<UserStats>>(
    `/admin/users?page=${page}&q=${encodeURIComponent(search)}`,
  );
  const [resetUser, setResetUser] = useState<UserStats | null>(null);
  const [success, setSuccess] = useState("");
  return (
    <>
      <PageTitle
        eyebrow="Участники программы"
        title="Пользователи"
        description="Балансы, статистика операций и управление доступом."
      />
      {success && <Notice success>{success}</Notice>}
      {error && <Notice>{error}</Notice>}
      <section className="panel table-panel">
        <div className="panel-heading">
          <h2>Участники</h2>
          <form
            className="search-form"
            onSubmit={(e) => {
              e.preventDefault();
              setPage(1);
              setSearch(query.trim());
            }}
          >
            <Search size={17} />
            <input
              aria-label="Поиск пользователей"
              placeholder="Логин, email или ID"
              value={query}
              maxLength={254}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button className="button secondary small">Найти</button>
          </form>
        </div>
        {data ? (
          data.items.length ? (
            <>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Пользователь</th>
                      <th>Баланс</th>
                      <th>Начислено</th>
                      <th>Списано</th>
                      <th>Операции</th>
                      <th>
                        <span className="sr-only">Пароль</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((user) => (
                      <tr key={user.id}>
                        <td>
                          <strong>
                            {user.login}{" "}
                            <span className="user-id">#{user.id}</span>
                          </strong>
                          <span className="table-sub">{user.email}</span>
                        </td>
                        <td className="table-balance">
                          {number(user.balance)}
                        </td>
                        <td>{number(user.earned)}</td>
                        <td>{number(user.spent)}</td>
                        <td>{number(user.operations)}</td>
                        <td>
                          <button
                            className="button secondary small"
                            onClick={() => setResetUser(user)}
                            aria-label={`Сбросить пароль ${user.login}`}
                          >
                            <KeyRound size={16} />
                            <span>Пароль</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={page} more={data.has_more} onChange={setPage} />
            </>
          ) : (
            <Empty
              title={search ? "Никого не нашли" : "Пользователей пока нет"}
            >
              {search
                ? "Попробуйте другой логин, email или ID."
                : "После регистрации участники появятся здесь."}
            </Empty>
          )
        ) : (
          !error && <Loading />
        )}
      </section>
      {resetUser && (
        <PasswordForm
          user={resetUser}
          onClose={() => setResetUser(null)}
          onSave={() => {
            setResetUser(null);
            setSuccess(
              "Пароль изменён. Передайте новый пароль пользователю безопасным способом.",
            );
            reload();
          }}
        />
      )}
    </>
  );
}
