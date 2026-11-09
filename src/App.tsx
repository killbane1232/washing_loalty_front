import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./lib/auth";
import { Layout } from "./components/Layout";
import { Loading, Notice } from "./components/ui";
import { AuthPage } from "./pages/Auth";
import { HistoryPage, HomePage } from "./pages/Wallet";
import { ScanPage, StationPage } from "./pages/Scan";
import { AdminHome, StationsPage, UsersPage } from "./pages/Admin";

function Protected({ admin = false }: { admin?: boolean }) {
  const { session } = useAuth();
  if (!session) return <Navigate to="/login" replace />;
  if (admin && session.role !== "admin") return <Navigate to="/" replace />;
  return <Outlet />;
}
function UserOnly() {
  return useAuth().session?.role === "admin" ? (
    <Navigate to="/" replace />
  ) : (
    <Outlet />
  );
}
function GuestOnly() {
  const location = useLocation();
  return useAuth().session ? (
    <Navigate to="/" replace />
  ) : (
    <AuthPage key={location.pathname} />
  );
}
function Home() {
  return useAuth().session?.role === "admin" ? <AdminHome /> : <HomePage />;
}
export function App() {
  const { loading, error, session, refresh } = useAuth();
  if (loading)
    return (
      <div className="app-loading">
        <Loading label="Открываем Washing…" />
      </div>
    );
  if (error && !session)
    return (
      <div className="app-loading">
        <Notice>{error}</Notice>
        <button className="button primary" onClick={() => void refresh()}>
          Повторить подключение
        </button>
      </div>
    );
  return (
    <Routes>
      <Route path="/login" element={<GuestOnly />} />
      <Route path="/register" element={<GuestOnly />} />
      <Route path="/admin/login" element={<GuestOnly />} />
      <Route element={<Protected />}>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route element={<UserOnly />}>
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/scan" element={<ScanPage />} />
            <Route path="/station" element={<StationPage />} />
          </Route>
          <Route element={<Protected admin />}>
            <Route path="/admin/stations" element={<StationsPage />} />
            <Route path="/admin/users" element={<UsersPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
