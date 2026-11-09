import { useState } from "react";
import {
  ArrowUpRight,
  House,
  History,
  ScanLine,
  LogOut,
  MapPin,
  Users,
  ShieldCheck,
  CircleHelp,
  Droplets,
} from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { errorText } from "../lib/api";
import { Brand, Notice } from "./ui";

export function Layout() {
  const { session, logout } = useAuth();
  const [error, setError] = useState("");
  const admin = session?.role === "admin";
  const links = admin
    ? [
        { to: "/", icon: House, label: "Обзор" },
        { to: "/admin/stations", icon: MapPin, label: "Станции" },
        { to: "/admin/users", icon: Users, label: "Пользователи" },
      ]
    : [
        { to: "/", icon: House, label: "Главная" },
        { to: "/history", icon: History, label: "История" },
        { to: "/scan", icon: ScanLine, label: "Сканировать QR" },
      ];
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand />
        <div className="workspace-label">
          {admin ? "Управление мойкой" : "Личный кабинет"}
        </div>
        <nav aria-label="Главная навигация">
          {links.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `nav-item ${isActive ? "active" : ""}`
              }
            >
              <Icon size={20} strokeWidth={1.8} />
              <span>{label}</span>
              {to === "/scan" && (
                <ArrowUpRight size={16} className="nav-arrow" />
              )}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <CircleHelp size={20} />
            <p>
              {admin ? "Всё под контролем" : "Чистая машина. Больше выгоды."}
              <span>
                {admin
                  ? "Станции и программа лояльности в одном месте."
                  : "Сканируйте QR на посту перед каждой мойкой."}
              </span>
            </p>
          </div>
          <div className="profile">
            <div className="avatar">
              {admin ? (
                <ShieldCheck size={21} />
              ) : (
                session?.user?.login.slice(0, 2).toUpperCase()
              )}
            </div>
            <div>
              <strong>{admin ? "Администратор" : session?.user?.login}</strong>
              <span>{admin ? "Полный доступ" : "Участник программы"}</span>
            </div>
            <button
              className="icon-button"
              aria-label="Выйти из аккаунта"
              onClick={() => void logout().catch((e) => setError(errorText(e)))}
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <div className="topbar">
          <span>
            Программа лояльности <span className="topbar-slash">/</span>{" "}
            <strong>{admin ? "Администрирование" : "Мой аккаунт"}</strong>
          </span>
          <span className="topbar-tag">
            <span className="status-dot" />
            {admin ? "Панель управления" : "Washing club"}
          </span>
        </div>
        <main>
          {error && <Notice>{error}</Notice>}
          <Outlet />
        </main>
        <footer>
          <span>© {new Date().getFullYear()} Washing</span>
          <span>
            Забота о машине начинается здесь <Droplets size={15} />
          </span>
        </footer>
      </div>
    </div>
  );
}
