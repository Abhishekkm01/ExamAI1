import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AppContext";
import { Shield, GraduationCap, ArrowRight, CheckCircle2, Mail, Lock, User, Hash, Phone } from "lucide-react";
import { PhotoUpload, photoPreview, validatePhotoFile } from "../components/PhotoUpload";
import { useDepartments } from "../hooks/useDepartments";

const API = "http://localhost:8000";
const DEFAULT_AVATAR = "https://api.dicebear.com/7.x/avataaars/svg?seed=student";

export default function StudentRegister() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { departments, loading: deptsLoading, defaultDepartment } = useDepartments();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    rollNo: "",
    mobile: "",
    department: "",
    semester: 5,
    section: "A",
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState(DEFAULT_AVATAR);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (defaultDepartment && !form.department) {
      setForm((f) => ({ ...f, department: defaultDepartment }));
    }
  }, [defaultDepartment, form.department]);

  useEffect(() => {
    if (!photoFile) {
      setPhotoPreviewUrl(DEFAULT_AVATAR);
      return;
    }
    const url = photoPreview(photoFile, DEFAULT_AVATAR);
    setPhotoPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [photoFile]);

  const update = (k: keyof typeof form, v: string | number) =>
    setForm((f) => ({ ...f, [k]: v }));

  const onPhotoSelect = (file: File) => {
    const err = validatePhotoFile(file);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setPhotoFile(file);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (form.password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    try {
      const body = new FormData();
      body.append("name", form.name);
      body.append("email", form.email);
      body.append("password", form.password);
      body.append("roll_no", form.rollNo);
      body.append("department", form.department);
      body.append("semester", String(form.semester));
      body.append("section", form.section);
      if (form.mobile) body.append("mobile", form.mobile);
      if (photoFile) body.append("photo", photoFile);

      const res = await fetch(`${API}/api/auth/register-student`, {
        method: "POST",
        body,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const msg =
          err.detail ||
          Object.entries(err)
            .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
            .join(" | ") ||
          "Registration failed";
        throw new Error(msg);
      }

      await login(form.email, form.password);
      setDone(true);
      setTimeout(() => navigate("/student"), 1500);
    } catch (e: any) {
      setError(e.message || "Backend not reachable");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-brand-soft dark:bg-slate-950 flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-emerald-500/20 blur-3xl" />
      <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-indigo-500/20 blur-3xl" />

      <div className="max-w-lg w-full relative">
        <div className="text-center mb-8">
          <div className="inline-flex w-16 h-16 rounded-2xl bg-brand-gradient items-center justify-center text-white shadow-xl shadow-indigo-500/30 mb-4">
            <GraduationCap className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Student Registration</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">Create your ExamShield AI student account</p>
        </div>

        {done ? (
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-white/60 dark:border-slate-800 shadow-xl p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-10 h-10 text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Account created!</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Redirecting you to your dashboard…</p>
          </div>
        ) : (
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-white/60 dark:border-slate-800 shadow-xl p-8">
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="flex flex-col items-center mb-2">
                <PhotoUpload photoUrl={photoPreviewUrl} onFileSelect={onPhotoSelect} />
                <p className="text-xs text-slate-500 mt-2">Tap camera to upload profile photo (optional)</p>
              </div>

              <Field label="Full Name" icon={User}>
                <input
                  required
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  className={inputClass}
                  placeholder="Your full name"
                />
              </Field>

              <Field label="Roll Number" icon={Hash}>
                <input
                  required
                  value={form.rollNo}
                  onChange={(e) => update("rollNo", e.target.value)}
                  className={inputClass}
                  placeholder="e.g. CS21B001"
                />
              </Field>

              <Field label="Email" icon={Mail}>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                  className={inputClass}
                  placeholder="you@university.edu"
                />
              </Field>

              <Field label="Mobile (optional)" icon={Phone}>
                <input
                  type="tel"
                  value={form.mobile}
                  onChange={(e) => update("mobile", e.target.value)}
                  className={inputClass}
                  placeholder="+91 98765 43210"
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Department</label>
                  <select
                    value={form.department}
                    onChange={(e) => update("department", e.target.value)}
                    className={inputClass}
                    disabled={deptsLoading || departments.length === 0}
                  >
                    {!form.department && (
                      <option value="">{deptsLoading ? "Loading departments…" : "Select department"}</option>
                    )}
                    {departments.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Semester</label>
                  <input
                    type="number"
                    min={1}
                    max={8}
                    required
                    value={form.semester}
                    onChange={(e) => update("semester", +e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>

              <Field label="Section" icon={Hash}>
                <input
                  value={form.section}
                  onChange={(e) => update("section", e.target.value)}
                  className={inputClass}
                  placeholder="A"
                />
              </Field>

              <Field label="Choose your password" icon={Lock}>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={form.password}
                  onChange={(e) => update("password", e.target.value)}
                  className={inputClass}
                  placeholder="At least 6 characters"
                />
              </Field>

              <Field label="Confirm password" icon={Lock}>
                <input
                  type="password"
                  required
                  value={form.confirmPassword}
                  onChange={(e) => update("confirmPassword", e.target.value)}
                  className={inputClass}
                  placeholder="Re-enter your password"
                />
              </Field>

              {error && (
                <div className="text-sm text-rose-600 bg-rose-50 dark:bg-rose-900/20 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-brand-gradient text-white font-semibold py-2.5 rounded-lg shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40 transition-shadow disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? "Creating account…" : "Register & sign in"}
                {!loading && <ArrowRight className="w-4 h-4" />}
              </button>
            </form>

            <p className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400">
              Already have an account?{" "}
              <Link to="/login" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                Sign in →
              </Link>
            </p>
          </div>
        )}

        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <Shield className="w-3 h-3" />
          ExamShield AI • Secure student registration
        </div>
      </div>
    </div>
  );
}

const inputClass =
  "w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500";

function Field({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">{label}</label>
      <div className="relative">
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <div className="[&>input]:pl-10 [&>select]:pl-10">{children}</div>
      </div>
    </div>
  );
}
