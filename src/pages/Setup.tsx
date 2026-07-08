import { useState } from "react";
import { Card, PageHeader, Button, TextInput, Select } from "../components/Layout";
import { useAuth } from "../contexts/AppContext";
import { useNavigate } from "react-router-dom";
import { Shield, UserPlus, BookOpen, GraduationCap, CheckCircle2, ArrowRight, ServerCrash } from "lucide-react";

import { API_BASE } from "../data/api";

export function FirstTimeSetup() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [step, setStep] = useState<"intro" | "admin" | "done">("intro");
  const [adminEmail, setAdminEmail] = useState("admin@examshield.ai");
  const [adminPassword, setAdminPassword] = useState("admin123");
  const [adminName, setAdminName] = useState("Dr. Arjun Mehta");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createAdmin = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/auth/bootstrap-admin`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: adminEmail, password: adminPassword, name: adminName }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to create admin");
      }
      // Auto-login
      await login(adminEmail, adminPassword);
      setStep("done");
      setTimeout(() => navigate("/admin"), 1500);
    } catch (e: any) {
      setError(e.message || "Backend not reachable");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-brand-soft dark:bg-slate-950 flex items-center justify-center p-6">
      <div className="max-w-3xl w-full">
        <div className="text-center mb-8">
          <div className="inline-flex w-16 h-16 rounded-2xl bg-brand-gradient items-center justify-center text-white shadow-xl shadow-indigo-500/30 mb-4">
            <Shield className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Welcome to ExamShield AI</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">Your database is empty. Let's set it up.</p>
        </div>

        {step === "intro" && (
          <Card className="p-8">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">First-time setup</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              We just need to create your first administrator account. After that you can add teachers,
              students, exams, and notifications from the admin dashboard.
            </p>
            <div className="space-y-3">
              <Step
                n={1} icon={<UserPlus className="w-5 h-5" />}
                title="Create admin account"
                desc="Set up the root account that can manage everything" />
              <Step
                n={2} icon={<GraduationCap className="w-5 h-5" />}
                title="Add teachers & students"
                desc="Use the admin dashboard to add your faculty and students" />
              <Step
                n={3} icon={<BookOpen className="w-5 h-5" />}
                title="Schedule exams"
                desc="Create exam slots and subjects to enable hall ticket generation" />
            </div>
            <Button variant="primary" className="w-full mt-6" onClick={() => setStep("admin")}>
              Get started <ArrowRight className="w-4 h-4" />
            </Button>
          </Card>
        )}

        {step === "admin" && (
          <Card className="p-8">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Create your admin account</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              This will be the primary login for the system. You can add more admins later.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Full Name</label>
                <TextInput value={adminName} onChange={(e) => setAdminName(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Email</label>
                <TextInput type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Password</label>
                <TextInput type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} />
              </div>
            </div>
            {error && (
              <div className="mt-4 p-3 rounded-lg bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 text-sm text-rose-700 dark:text-rose-300">
                {error}
              </div>
            )}
            <div className="mt-6 flex gap-2">
              <Button variant="secondary" onClick={() => setStep("intro")}>Back</Button>
              <Button variant="primary" className="flex-1" onClick={createAdmin} disabled={loading}>
                {loading ? "Creating…" : "Create admin & sign in"} <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </Card>
        )}

        {step === "done" && (
          <Card className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-10 h-10 text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Admin account created!</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Redirecting you to the admin dashboard…</p>
          </Card>
        )}

        <p className="text-center text-xs text-slate-500 dark:text-slate-400 mt-6">
          Make sure you've run <code className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800">setup-db.bat</code> (or <code className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800">python manage.py setup_database</code>) on your MySQL server first.
        </p>
      </div>
    </div>
  );
}

function Step({ n, icon, title, desc }: { n: number; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50">
      <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 flex items-center justify-center flex-shrink-0 font-bold">
        {n}
      </div>
      <div>
        <p className="font-semibold text-slate-800 dark:text-white">{title}</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">{desc}</p>
      </div>
    </div>
  );
}

export function AdminNotSetup() {
  const { user } = useAuth();
  return (
    <div>
      <PageHeader title="Welcome" subtitle="Your database is empty" />
      <Card className="p-10 text-center">
        <ServerCrash className="w-16 h-16 text-slate-400 mx-auto mb-4" />
        <h3 className="text-xl font-bold mb-2 text-slate-900 dark:text-white">No data yet</h3>
        <p className="text-slate-500 max-w-md mx-auto mb-6">
          {user?.role === "admin"
            ? "Start by adding teachers, students, and exam schedules. Use the navigation on the left to manage each section."
            : "An administrator needs to add your account before you can use the system."}
        </p>
        {user?.role === "admin" && (
          <div className="flex justify-center gap-2">
            <Button variant="primary" onClick={() => location.href = "/admin/students"}>Add students</Button>
            <Button variant="secondary" onClick={() => location.href = "/admin/teachers"}>Add teachers</Button>
            <Button variant="secondary" onClick={() => location.href = "/admin/exams"}>Schedule exams</Button>
          </div>
        )}
      </Card>
    </div>
  );
}
