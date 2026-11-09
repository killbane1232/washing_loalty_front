import { useState, type FormEvent } from "react";
import {
  ArrowRight,
  ShieldCheck,
  Sparkles,
  ScanLine,
  Wallet,
  Eye,
  EyeOff,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { api, ApiError, errorText, post, type Session } from "../lib/api";
import { Brand, Notice } from "../components/ui";

export function AuthPage() {
  const { pathname } = useLocation();
  const register = pathname === "/register";
  const admin = pathname === "/admin/login";
  const { accept, expired } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") || "");
    if (
      !admin &&
      (new TextEncoder().encode(password).length < 8 ||
        new TextEncoder().encode(password).length > 1024)
    ) {
      setError("Пароль должен содержать от 8 до 1024 байт.");
      return;
    }
    if (register && password !== form.get("confirm")) {
      setError("Пароли не совпадают.");
      return;
    }
    setBusy(true);
    try {
      const session = admin
        ? await api<Session>("/admin/login", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${String(form.get("token")).trim()}`,
            },
          })
        : await post<Session>(register ? "/register" : "/login", {
            login: String(form.get("login")).trim(),
            hash: password,
            ...(register ? { email: String(form.get("email")).trim() } : {}),
          });
      accept(session);
      navigate("/", { replace: true });
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 401
          ? admin
            ? "Неверный ключ администратора."
            : "Неверный логин или пароль."
          : errorText(err),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-shell">
      <section className="auth-story">
        <Brand />
        <div className="auth-story-content">
          <span className="pill light">
            <Sparkles size={15} /> Программа лояльности
          </span>
          <h1>
            Чистота,
            <br />
            которая
            <br />
            <em>возвращается.</em>
          </h1>
          <p>
            Ухаживайте за машиной.
            <br />
            Копите баллы. Мойте с выгодой.
          </p>
          <div className="auth-benefits">
            <span>
              <Wallet size={20} /> Бонусы под рукой
            </span>
            <span>
              <ScanLine size={20} /> Подключение по QR
            </span>
          </div>
        </div>
        <div className="auth-story-bottom">
          WASHING CLUB <span>Каждая мойка — в плюс.</span>
        </div>
        <div className="auth-orbit orbit-one" />
        <div className="auth-orbit orbit-two" />
      </section>
      <section className="auth-form-side">
        <div className="mobile-brand">
          <Brand />
        </div>
        <div className="auth-form">
          <div className="eyebrow">
            {admin ? "Для команды Washing" : "Добро пожаловать"}
          </div>
          <h2>
            {admin
              ? "Вход администратора"
              : register
                ? "Начнём с знакомства"
                : "С возвращением"}
          </h2>
          <p>
            {admin
              ? "Введите ключ доступа к панели управления."
              : register
                ? "Создайте аккаунт и получайте больше от каждой мойки."
                : "Войдите, чтобы проверить баланс и начать мойку."}
          </p>
          {expired && <Notice>Сессия истекла. Войдите снова.</Notice>}
          {error && <Notice>{error}</Notice>}
          <form onSubmit={submit} key={pathname}>
            {admin ? (
              <label>
                Ключ администратора
                <input
                  name="token"
                  type="password"
                  required
                  autoComplete="off"
                  placeholder="Введите ключ доступа"
                />
              </label>
            ) : (
              <>
                <label>
                  Логин
                  <input
                    name="login"
                    required
                    minLength={3}
                    maxLength={64}
                    pattern="[A-Za-z0-9_.\-]{3,64}"
                    autoComplete="username"
                    placeholder="Например, alex"
                    autoCapitalize="none"
                    spellCheck={false}
                  />
                </label>
                {register && (
                  <label>
                    Email
                    <input
                      name="email"
                      type="email"
                      required
                      maxLength={254}
                      autoComplete="email"
                      placeholder="you@example.com"
                    />
                  </label>
                )}
                <label>
                  Пароль
                  <div className="password-input">
                    <input
                      name="password"
                      type={show ? "text" : "password"}
                      required
                      minLength={8}
                      maxLength={1024}
                      autoComplete={
                        register ? "new-password" : "current-password"
                      }
                      placeholder="Не менее 8 символов"
                    />
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => setShow(!show)}
                      aria-label={show ? "Скрыть пароль" : "Показать пароль"}
                    >
                      {show ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </label>
                {register && (
                  <label>
                    Повторите пароль
                    <input
                      name="confirm"
                      type="password"
                      required
                      minLength={8}
                      autoComplete="new-password"
                      placeholder="Введите пароль ещё раз"
                    />
                  </label>
                )}
              </>
            )}
            <button className="button primary full" disabled={busy}>
              {busy ? "Подождите…" : register ? "Создать аккаунт" : "Войти"}
              <ArrowRight size={18} />
            </button>
          </form>
          <p className="auth-switch">
            {admin ? (
              <Link to="/login">Вернуться ко входу пользователя</Link>
            ) : register ? (
              <>
                Уже есть аккаунт? <Link to="/login">Войти</Link>
              </>
            ) : (
              <>
                Ещё нет аккаунта? <Link to="/register">Зарегистрироваться</Link>
              </>
            )}
          </p>
          {!admin && (
            <Link className="admin-link" to="/admin/login">
              <ShieldCheck size={16} /> Вход для администратора
            </Link>
          )}
        </div>
        <span className="auth-bottom">Ваши бонусы всегда с вами.</span>
      </section>
    </div>
  );
}
