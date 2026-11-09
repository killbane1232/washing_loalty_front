import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api, ApiError, errorText, type Session } from "./api";

interface Auth {
  session: Session | null;
  loading: boolean;
  error: string;
  expired: boolean;
  refresh: () => Promise<Session | null>;
  accept: (session: Session) => void;
  logout: () => Promise<void>;
}
const Context = createContext<Auth | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expired, setExpired] = useState(false);
  const refresh = useCallback(async () => {
    try {
      const value = await api<Session>("/me");
      setSession(value);
      setError("");
      return value;
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) setSession(null);
      else setError(errorText(err));
      return null;
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    const expire = () => {
      setSession(null);
      setExpired(true);
    };
    window.addEventListener("session-expired", expire);
    return () => window.removeEventListener("session-expired", expire);
  }, []);
  useEffect(() => {
    if (!session) return;
    const delay = new Date(session.expires_at).getTime() - Date.now();
    const timer = setTimeout(
      () => {
        setSession(null);
        setExpired(true);
      },
      Math.max(0, Math.min(delay, 2_147_483_647)),
    );
    const focus = () => {
      void refresh();
    };
    window.addEventListener("focus", focus);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", focus);
    };
  }, [session?.expires_at, refresh]);
  const accept = (value: Session) => {
    setSession(value);
    setExpired(false);
    setError("");
  };
  const logout = async () => {
    await api("/logout", { method: "POST" });
    setSession(null);
    setExpired(false);
  };
  return (
    <Context.Provider
      value={{ session, loading, error, expired, refresh, accept, logout }}
    >
      {children}
    </Context.Provider>
  );
}
export function useAuth() {
  const value = useContext(Context);
  if (!value) throw new Error("AuthProvider required");
  return value;
}
