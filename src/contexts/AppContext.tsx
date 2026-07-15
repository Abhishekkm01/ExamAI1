import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { User, Notification as Notif } from "../data/types";
import { api, isBackendOnline } from "../data/api";
import { cleanNotificationMessage, parseNotificationTitle } from "../utils/notifications";

const ROLE_MAP: Record<string, User["role"]> = { admin: "admin", hod: "hod", teacher: "teacher", student: "student" };

function mapApiNotif(n: any): Notif {
  const created = n.created_at || n.createdAt || "";
  const parsed = parseNotificationTitle(n.title || "");
  return {
    id: String(n.id),
    title: parsed.title,
    department: parsed.department,
    message: cleanNotificationMessage(n.message || ""),
    audience: (n.audience || "all") as Notif["audience"],
    createdAt: String(created).replace("T", " ").slice(0, 16),
    read: Boolean(n.is_read ?? n.read ?? false),
  };
}

async function fetchNotificationsForRole(role: User["role"]): Promise<Notif[]> {
  let data: any[] = [];
  if (role === "student") data = await api.studentNotifications();
  else if (role === "teacher") data = await api.teacherNotifications();
  else if (role === "hod") data = await api.hodNotifications();
  else if (role === "admin") data = await api.adminNotifications();
  return (Array.isArray(data) ? data : []).map(mapApiNotif);
}

// ---- Auth ----
interface AuthState {
  user: User | null;
  backendOnline: boolean;
  login: (email: string, password: string) => Promise<{ ok: boolean; message?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const raw = localStorage.getItem("examshield_user");
      return raw ? (JSON.parse(raw) as User) : null;
    } catch {
      return null;
    }
  });
  const [backendOnline, setBackendOnline] = useState(false);

  useEffect(() => {
    api.ping().then(setBackendOnline);
    const interval = setInterval(() => api.ping().then(setBackendOnline), 10_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (user) localStorage.setItem("examshield_user", JSON.stringify(user));
    else localStorage.removeItem("examshield_user");
  }, [user]);

  const login: AuthState["login"] = async (email, password) => {
    try {
      const data = await api.login(email, password);
      const role = ROLE_MAP[data.user.role] || "student";
      setUser({
        id: `u${data.user.id}`,
        email: data.user.email,
        name: data.user.name,
        role,
        avatar: data.user.avatar || undefined,
        password: "",
      });
      setBackendOnline(true);
      return { ok: true };
    } catch (err: any) {
      const msg = err?.message || "Login failed. Is the backend running?";
      setBackendOnline(false);
      return { ok: false, message: msg };
    }
  };

  const logout = () => {
    api.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, backendOnline, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export { isBackendOnline };

// ---- Theme ----
type Theme = "light" | "dark";
interface ThemeState {
  theme: Theme;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeState | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem("examshield_theme") as Theme | null;
    if (saved) return saved;
    return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    localStorage.setItem("examshield_theme", theme);
  }, [theme]);

  const toggle = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

// ---- Notifications (live from MySQL via role APIs) ----
interface NotifState {
  notifications: Notif[];
  loading: boolean;
  markRead: (id: string) => void;
  markAllRead: () => void;
  add: (n: Omit<Notif, "id" | "createdAt" | "read">) => void;
  refresh: () => Promise<void>;
}

const NotifContext = createContext<NotifState | null>(null);

export const NOTIFICATIONS_UPDATED = "examshield:notifications-updated";

export function notifyNotificationsUpdated() {
  window.dispatchEvent(new Event(NOTIFICATIONS_UPDATED));
}

export function NotifProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      return;
    }
    setLoading(true);
    try {
      const list = await fetchNotificationsForRole(user.role);
      setNotifications(list);
    } catch {
      // Keep previous list on transient errors
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const onUpdate = () => { refresh(); };
    window.addEventListener(NOTIFICATIONS_UPDATED, onUpdate);
    return () => window.removeEventListener(NOTIFICATIONS_UPDATED, onUpdate);
  }, [refresh]);

  const markRead = (id: string) =>
    setNotifications((ns) => ns.map((n) => (n.id === id ? { ...n, read: true } : n)));

  const markAllRead = () => setNotifications((ns) => ns.map((n) => ({ ...n, read: true })));

  const add: NotifState["add"] = (n) =>
    setNotifications((ns) => [
      { ...n, id: `n${Date.now()}`, createdAt: new Date().toISOString().slice(0, 16).replace("T", " "), read: false },
      ...ns,
    ]);

  const value = useMemo(
    () => ({ notifications, loading, markRead, markAllRead, add, refresh }),
    [notifications, loading, refresh],
  );
  return <NotifContext.Provider value={value}>{children}</NotifContext.Provider>;
}

export function useNotifications() {
  const ctx = useContext(NotifContext);
  if (!ctx) throw new Error("useNotifications must be used within NotifProvider");
  return ctx;
}
