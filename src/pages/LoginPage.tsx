import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AppContext";
import { Shield, Mail, Lock, Eye, EyeOff, Sparkles, ShieldCheck, BrainCircuit, QrCode, GraduationCap, CheckCircle2, ServerCrash } from "lucide-react";
import { cn } from "../utils/cn";

function BackendStatus() {
  const { backendOnline } = useAuth();
  return (
    <div className="mt-3 flex flex-col items-center gap-2 text-xs">
      {backendOnline ? (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 font-medium">
          <CheckCircle2 className="w-3 h-3" /> Backend connected • http://localhost:8000
        </span>
      ) : (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 font-medium">
          <ServerCrash className="w-3 h-3" /> Backend not reachable
        </span>
      )}
      <details className="text-[10px] text-slate-500 cursor-pointer">
        <summary>Debug info</summary>
        <div className="mt-1 p-2 rounded bg-slate-100 dark:bg-slate-800 font-mono text-left max-w-xs break-all">
          <div>Token: {localStorage.getItem("examshield_token") ? "✓ present" : "✗ missing"}</div>
          <div>User: {localStorage.getItem("examshield_user") ? "✓ stored" : "✗ none"}</div>
        </div>
      </details>
    </div>
  );
}

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const demo = [
    { label: "Admin", email: "admin@examshield.ai", password: "admin123", color: "from-rose-500 to-pink-600" },
    { label: "Teacher", email: "teacher@examshield.ai", password: "teacher123", color: "from-indigo-500 to-violet-600" },
    { label: "Student", email: "student@examshield.ai", password: "student123", color: "from-emerald-500 to-teal-600" },
  ];

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await login(email, password);
    setLoading(false);
    if (!res.ok) setError(res.message || "Invalid credentials");
  };

  const quickLogin = (d: typeof demo[number]) => {
    setEmail(d.email); setPassword(d.password);
    login(d.email, d.password).then((res) => {
      if (!res.ok) setError(res.message || null);
    });
  };

  return (
    <div className="min-h-screen flex bg-brand-soft dark:bg-slate-950 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-indigo-500/20 blur-3xl" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-rose-500/20 blur-3xl" />

      {/* Left side - branding */}
      <div className="hidden lg:flex lg:w-1/2 p-12 flex-col justify-between relative">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-brand-gradient flex items-center justify-center text-white shadow-xl shadow-indigo-500/30">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-2xl text-slate-900 dark:text-white">ExamShield AI</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">Intelligent Exam Management</p>
          </div>
        </div>

        <div className="space-y-8">
          <div>
            <h2 className="text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight">
              Secure. Smart. <br />
              <span className="bg-clip-text text-transparent bg-brand-gradient">Seamless.</span>
            </h2>
            <p className="text-slate-600 dark:text-slate-300 mt-4 max-w-md">
              AI-powered hall ticket generation, biometric authentication, eligibility prediction,
              and real-time analytics for universities worldwide.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 max-w-md">
            {[
              { icon: BrainCircuit, title: "AI Eligibility", desc: "ML-powered risk scoring" },
              { icon: QrCode, title: "QR Hall Tickets", desc: "Instant verification" },
              { icon: ShieldCheck, title: "Face Auth", desc: "Biometric matching" },
              { icon: GraduationCap, title: "Full Lifecycle", desc: "Student to results" },
            ].map((f) => (
              <div key={f.title} className="p-4 rounded-2xl bg-white/60 dark:bg-slate-900/50 backdrop-blur border border-white/40 dark:border-slate-800">
                <f.icon className="w-6 h-6 text-indigo-600 dark:text-indigo-400 mb-2" />
                <p className="font-semibold text-sm text-slate-900 dark:text-white">{f.title}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-500">
          © 2026 ExamShield AI • A next-generation examination management platform.
        </p>
      </div>

      {/* Right side - form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 relative">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-10 h-10 rounded-xl bg-brand-gradient flex items-center justify-center text-white">
              <Shield className="w-5 h-5" />
            </div>
            <span className="font-bold text-xl text-slate-900 dark:text-white">ExamShield AI</span>
          </div>

          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-white/60 dark:border-slate-800 shadow-xl p-8">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Welcome back</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Sign in to your account to continue</p>
            </div>

            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="email" required
                    value={email} onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500"
                    placeholder="you@university.edu"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type={showPassword ? "text" : "password"} required
                    value={password} onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500"
                    placeholder="••••••••"
                  />
                  <button type="button" onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="text-sm text-rose-600 bg-rose-50 dark:bg-rose-900/20 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading}
                className="w-full bg-brand-gradient text-white font-semibold py-2.5 rounded-lg shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40 transition-shadow disabled:opacity-50">
                {loading ? "Signing in..." : "Sign In"}
              </button>
            </form>

            <div className="my-6 flex items-center gap-3">
              <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
              <span className="text-xs text-slate-400">Quick demo access</span>
              <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
            </div>

            <div className="grid grid-cols-3 gap-2">
              {demo.map((d) => (
                <button key={d.label} onClick={() => quickLogin(d)}
                  className={cn(
                    "px-3 py-2.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-br shadow-sm hover:shadow-md transition-shadow",
                    d.color
                  )}>
                  {d.label}
                </button>
              ))}
            </div>

            <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <Sparkles className="w-3 h-3" />
              Protected by ExamShield AI with JWT + face verification
            </div>
            <BackendStatus />

            <div className="mt-4 text-center">
              <Link to="/setup" className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">
                First time? Set up your admin account →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
