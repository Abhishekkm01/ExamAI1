import { NavLink, useLocation, useNavigate, Outlet } from "react-router-dom";
import { useAuth, useTheme, useNotifications } from "../contexts/AppContext";
import {
  Shield, LogOut, Moon, Sun, Menu, X, Bell, User as UserIcon, ChevronDown,
  LayoutDashboard, Users, GraduationCap, BookOpen, ClipboardList, TicketCheck,
  BarChart3, FileText, MessageSquare, Wallet, AlertTriangle, Settings, School, Camera, Mail, Armchair
} from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "../utils/cn";

type NavItem = { to: string; label: string; icon: any; end?: boolean };

const adminNav: NavItem[] = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/students", label: "Students", icon: GraduationCap },
  { to: "/admin/teachers", label: "Teachers", icon: Users },
  { to: "/admin/exams", label: "Examinations", icon: BookOpen },
  { to: "/admin/marks", label: "Internal Marks", icon: ClipboardList },
  { to: "/admin/eligibility", label: "Eligibility", icon: TicketCheck },
  { to: "/admin/seating", label: "Seating", icon: Armchair },
  { to: "/admin/halltickets", label: "Hall Tickets", icon: TicketCheck },
  { to: "/admin/backlogs", label: "Backlogs", icon: AlertTriangle },
  { to: "/admin/fees", label: "Fee Payments", icon: Wallet },
  { to: "/admin/notifications", label: "Notifications", icon: Bell },
  { to: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/admin/reports", label: "Reports", icon: FileText },
  { to: "/admin/settings", label: "Settings", icon: Settings },
  { to: "/admin/profile", label: "My Profile", icon: UserIcon },
];

const teacherNav: NavItem[] = [
  { to: "/teacher", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/teacher/attendance", label: "Attendance", icon: ClipboardList },
  { to: "/teacher/marks", label: "Internal Marks", icon: FileText },
  { to: "/teacher/students", label: "Student Monitoring", icon: GraduationCap },
  { to: "/teacher/face-verify", label: "Face Verification", icon: Camera },
  { to: "/teacher/profile", label: "My Profile", icon: UserIcon },
];

const studentNav: NavItem[] = [
  { to: "/student", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/student/payments", label: "Payments", icon: Wallet },
  { to: "/student/profile", label: "Profile", icon: UserIcon },
  { to: "/student/eligibility", label: "Eligibility", icon: TicketCheck },
  { to: "/student/hallticket", label: "Hall Ticket", icon: TicketCheck },
  { to: "/student/exams", label: "Exams", icon: BookOpen },
  { to: "/student/face-verify", label: "Face Verification", icon: Camera },
  { to: "/student/notifications", label: "Notifications", icon: Mail },
  { to: "/student/chatbot", label: "AI Assistant", icon: MessageSquare },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const { notifications } = useNotifications();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  if (!user) return null;

  const nav = user.role === "admin" ? adminNav : user.role === "teacher" ? teacherNav : studentNav;
  const unread = notifications.filter((n) => !n.read && (n.audience === "all" || n.audience === user.role + "s" || n.audience === user.role)).length;

  const roleBadge: Record<string, string> = {
    admin: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
    teacher: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
    student: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  };

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed lg:static inset-y-0 left-0 z-40 w-72 transform transition-transform duration-200",
          "bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800",
          "flex flex-col",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-200 dark:border-slate-800">
          <div className="w-10 h-10 rounded-xl bg-brand-gradient flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-slate-900 dark:text-white leading-none">ExamShield AI</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Intelligent Exam System</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                )
              }
            >
              <item.icon className="w-4.5 h-4.5" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
            <img src={user.avatar} alt="" className="w-9 h-9 rounded-full bg-slate-200" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate text-slate-800 dark:text-white">{user.name}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate capitalize">{user.role}</p>
            </div>
            <button
              onClick={logout}
              className="p-1.5 rounded-md text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 bg-slate-900/40 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="sticky top-0 z-20 h-16 glass border-b border-slate-200 dark:border-slate-800 flex items-center gap-4 px-4 lg:px-8">
          <button
            className="lg:hidden p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
            onClick={() => setSidebarOpen(true)}
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div className="flex items-center gap-2">
            <School className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <span className="text-sm font-medium hidden sm:inline text-slate-600 dark:text-slate-300">
              National Institute of Technology • Academic Year 2026-27
            </span>
          </div>

          <div className="flex-1" />

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => { setNotifOpen((o) => !o); setProfileOpen(false); }}
              className="relative p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Bell className="w-5 h-5 text-slate-600 dark:text-slate-300" />
              {unread > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500 pulse-ring" />
              )}
            </button>
            {notifOpen && (
              <NotifPopover onClose={() => setNotifOpen(false)} />
            )}
          </div>

          {/* Theme toggle */}
          <button
            onClick={toggle}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            title="Toggle theme"
          >
            {theme === "dark" ? <Sun className="w-5 h-5 text-slate-600 dark:text-slate-300" /> : <Moon className="w-5 h-5 text-slate-600" />}
          </button>

          {/* Profile */}
          <div className="relative">
            <button
              onClick={() => { setProfileOpen((o) => !o); setNotifOpen(false); }}
              className="flex items-center gap-2 p-1 pr-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <img src={user.avatar} alt="" className="w-8 h-8 rounded-full bg-slate-200" />
              <div className="hidden md:block text-left">
                <p className="text-sm font-medium leading-tight">{user.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">{user.role}</p>
              </div>
              <ChevronDown className="w-4 h-4 text-slate-400 hidden md:block" />
            </button>
            {profileOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl overflow-hidden animate-fade-in">
                <div className="p-4 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <img src={user.avatar} alt="" className="w-10 h-10 rounded-full bg-slate-200" />
                    <div>
                      <p className="font-medium">{user.name}</p>
                      <p className="text-xs text-slate-500">{user.email}</p>
                      <span className={cn("inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full font-medium capitalize", roleBadge[user.role])}>
                        {user.role}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="p-1">
                  <button onClick={() => { navigate(`/${user.role}/profile`); setProfileOpen(false); }}
                    className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-slate-100 dark:hover:bg-slate-800">
                    View Profile
                  </button>
                  <button onClick={logout}
                    className="w-full text-left px-3 py-2 text-sm rounded-md text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10">
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8 animate-fade-in">
          <Outlet />
        </main>

        <footer className="px-8 py-4 text-xs text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-800">
          © 2026 ExamShield AI • Built with React, FastAPI, MySQL, and ML/AI • All rights reserved
        </footer>
      </div>
    </div>
  );
}

function NotifPopover({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const { notifications, markRead, markAllRead } = useNotifications();
  const filtered = notifications.filter(
    (n) => n.audience === "all" || n.audience === user!.role + "s" || n.audience === user!.role
  );
  return (
    <div className="absolute right-0 mt-2 w-96 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl overflow-hidden animate-fade-in">
      <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
        <h3 className="font-semibold">Notifications</h3>
        <button onClick={markAllRead} className="text-xs text-indigo-600 hover:underline">Mark all read</button>
      </div>
      <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
        {filtered.length === 0 && <p className="p-6 text-sm text-slate-500 text-center">No notifications</p>}
        {filtered.map((n) => (
          <button
            key={n.id}
            onClick={() => markRead(n.id)}
            className="w-full text-left p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50"
          >
            <div className="flex items-start gap-3">
              <div className={cn("mt-1 w-2 h-2 rounded-full", n.read ? "bg-transparent" : "bg-indigo-500 pulse-ring")} />
              <div className="flex-1 min-w-0">
                <p className={cn("text-sm font-medium", !n.read && "text-slate-900 dark:text-white")}>{n.title}</p>
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5">{n.message}</p>
                <p className="text-xs text-slate-400 mt-1">{n.createdAt}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
      <button onClick={onClose} className="w-full p-2 text-xs text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800">
        Close
      </button>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
      <div>
        <h2 className="text-2xl lg:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">{title}</h2>
        {subtitle && <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm",
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function StatCard({ label, value, delta, icon: Icon, color = "indigo", trend }: {
  label: string; value: string | number; delta?: string; icon: any; color?: string; trend?: "up" | "down";
}) {
  const colors: Record<string, string> = {
    indigo:   "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400",
    emerald:  "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400",
    rose:     "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400",
    amber:    "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400",
    sky:      "bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400",
    violet:   "bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400",
  };
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{label}</p>
          <p className="text-3xl font-bold text-slate-900 dark:text-white mt-2">{value}</p>
          {delta && (
            <p className={cn(
              "text-xs mt-1 font-medium",
              trend === "down" ? "text-rose-600" : "text-emerald-600"
            )}>
              {delta}
            </p>
          )}
        </div>
        <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center", colors[color])}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </Card>
  );
}

export function Badge({ children, variant = "slate" }: { children: React.ReactNode; variant?: "slate" | "green" | "red" | "amber" | "indigo" | "sky" }) {
  const styles: Record<string, string> = {
    slate:  "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    green:  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    red:    "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
    amber:  "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    indigo: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
    sky:    "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  };
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium", styles[variant])}>
      {children}
    </span>
  );
}

export function Button({ children, variant = "primary", className, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" }) {
  const variants: Record<string, string> = {
    primary:   "bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-500/20",
    secondary: "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100",
    ghost:     "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300",
    danger:    "bg-rose-600 hover:bg-rose-700 text-white",
  };
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
        variants[variant],
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900",
        "text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500",
        props.className
      )}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        "w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900",
        "text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500",
        props.className
      )}
    />
  );
}
