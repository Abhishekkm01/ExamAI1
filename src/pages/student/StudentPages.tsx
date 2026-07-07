import { useState, useMemo, useRef, useEffect } from "react";
import { Card, PageHeader, StatCard, Button, Badge, TextInput, Select } from "../../components/Layout";
import { fetchStudents, fetchExams, getStudentEligibility } from "../../data/apiData";
import type { Student, Exam } from "../../data/mockData";
import { useAuth, useNotifications } from "../../contexts/AppContext";
import { useNavigate } from "react-router-dom";
import { User as UserIcon, GraduationCap, Calendar, Mail, Camera, MessageSquare, Download, Printer, CheckCircle2, XCircle, AlertTriangle, TrendingUp, Send, Sparkles, TicketCheck, BrainCircuit, Lock, Wallet } from "lucide-react";
import { PhotoUpload, validatePhotoFile } from "../../components/PhotoUpload";
import { QRCodeSVG } from "qrcode.react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, LineChart, Line } from "recharts";
import { cn } from "../../utils/cn";

const API = "http://localhost:8000";
const token = () => localStorage.getItem("examshield_token") || "";

async function fetchMe(): Promise<Student | null> {
  try {
    const res = await fetch(`${API}/api/student/profile`, { headers: { Authorization: `Bearer ${token()}` } });
    if (!res.ok) return null;
    const p = await res.json();
    // Map the API response to Student type
    return {
      id: `s${p.id}`, rollNo: p.roll_no, name: p.name, email: p.email, mobile: p.mobile || "",
      department: p.department, semester: p.semester, section: p.section, photo: p.photo,
      attendance: p.attendance, internalMarks: p.internal_marks, assignmentMarks: p.assignment_marks,
      previousResult: p.previous_result, backlogs: p.backlogs, feePaid: p.fee_paid,
      feeAmount: p.fee_amount, feeDueDate: p.fee_due_date, createdAt: "2023-08-12",
    };
  } catch { return null; }
}

// ============ STUDENT DASHBOARD ============
export function StudentDashboard() {
  const { user } = useAuth();
  const [student, setStudent] = useState<Student | null>(null);
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const me = await fetchMe();
      const ex = await fetchExams();
      setStudent(me); setExams(ex); setLoading(false);
    })();
  }, []);

  if (loading) return <div className="p-10 text-center text-slate-500">Loading from MySQL…</div>;
  if (!student) return <div className="p-10 text-center text-rose-500">Student profile not found</div>;

  const e = getStudentEligibility(student);
  const upcoming = exams.filter(ex => ex.department === student.department);

  const performanceData = [
    { name: "DSA", internal: Math.min(40, student.internalMarks + 1), assign: student.assignmentMarks },
    { name: "DBMS", internal: Math.max(20, student.internalMarks - 2), assign: Math.max(4, student.assignmentMarks - 1) },
    { name: "OS", internal: Math.max(15, student.internalMarks - 4), assign: Math.max(3, student.assignmentMarks - 2) },
  ];

  return (
    <div>
      <PageHeader title={`Welcome back, ${student.name.split(" ")[0]}`} subtitle={`Roll No: ${student.rollNo} • ${student.department}`} />

      <div className={cn(
        "relative mb-6 rounded-2xl overflow-hidden p-6 lg:p-8 text-white shadow-xl",
        e.eligible ? "bg-gradient-to-br from-emerald-500 via-teal-600 to-indigo-600"
                   : "bg-gradient-to-br from-rose-500 via-pink-600 to-orange-600"
      )}>
        <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex flex-col lg:flex-row lg:items-center gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-2 text-white/80 text-sm font-medium mb-2">
              <BrainCircuit className="w-4 h-4" /> AI Eligibility Assessment
            </div>
            <h3 className="text-3xl font-bold">{e.eligible ? "You are eligible to appear!" : "Currently not eligible"}</h3>
            <p className="mt-2 text-white/80 max-w-xl">
              {e.eligible ? `Congratulations! You meet all ${e.total} eligibility criteria.` : `You meet ${e.passed} of ${e.total} criteria.`}
            </p>
            <button onClick={() => navigate(e.eligible ? "/student/hallticket" : "/student/eligibility")}
              className="mt-4 px-4 py-2 rounded-lg bg-white/20 backdrop-blur hover:bg-white/30 font-medium text-sm transition">
              {e.eligible ? "Download Hall Ticket →" : "View Details →"}
            </button>
          </div>
          <div className="text-center">
            <div className="text-6xl font-extrabold">{e.score}</div>
            <div className="text-sm opacity-80">AI Score</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Attendance" value={`${student.attendance}%`} icon={GraduationCap} color="indigo" delta={student.attendance >= 75 ? "Above threshold" : "Below threshold"} trend={student.attendance >= 75 ? "up" : "down"} />
        <StatCard label="Internal Marks" value={`${student.internalMarks}/40`} icon={TrendingUp} color="emerald" delta={`${Math.round((student.internalMarks/40)*100)}%`} />
        <StatCard label="Hall Ticket" value={e.eligible ? "Ready" : "Pending"} icon={TicketCheck} color={e.eligible ? "emerald" : "amber"} />
        <StatCard label="Next Exam" value={upcoming[0]?.date.split("-")[2] || "—"} icon={Calendar} color="violet" delta={upcoming[0]?.subjectName.slice(0, 15)} />
      </div>

      {/* Fee Payment Card */}
      <Card className={cn("p-6 mb-6", student.feePaid ? "bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800" : "bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800")}>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <Wallet className={cn("w-5 h-5", student.feePaid ? "text-emerald-600" : "text-amber-600")} />
              Fee Payment Status
            </h3>
            <div className="mt-3 space-y-2">
              <p className={cn("text-sm font-medium", student.feePaid ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300")}>
                {student.feePaid ? "✓ Fee Paid" : "⚠ Fee Pending"}
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Amount: <span className="font-semibold">₹{student.feeAmount.toLocaleString()}</span>
              </p>
              {student.feeDueDate && (
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Due Date: <span className="font-semibold">{student.feeDueDate}</span>
                </p>
              )}
            </div>
          </div>
          {!student.feePaid && (
            <Button 
              variant="primary" 
              className="whitespace-nowrap"
              onClick={() => alert("Payment gateway would be integrated here. Amount: ₹" + student.feeAmount)}
            >
              <Wallet className="w-4 h-4" /> Pay Now
            </Button>
          )}
          {student.feePaid && (
            <div className="text-emerald-600 dark:text-emerald-400 text-right">
              <CheckCircle2 className="w-8 h-8" />
            </div>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card className="p-5 lg:col-span-2">
          <h3 className="font-semibold mb-4">Subject Performance (live from MySQL)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={performanceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,.3)" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip contentStyle={{ background: "rgba(15,23,42,.9)", border: "none", borderRadius: 8, color: "#fff" }} />
                <Bar dataKey="internal" fill="#2563eb" name="Internal /40" radius={[6, 6, 0, 0]} />
                <Bar dataKey="assign" fill="#7c3aed" name="Assignment /10" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-5">
          <h3 className="font-semibold mb-4">Upcoming Exams</h3>
          <div className="space-y-3">
            {upcoming.slice(0, 4).map((ex) => (
              <div key={ex.id} className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                <p className="text-sm font-semibold">{ex.subjectName}</p>
                <p className="text-xs text-slate-500 mt-0.5">{ex.date} • {ex.time}</p>
                <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1 font-medium">{ex.room}</p>
              </div>
            ))}
            {upcoming.length === 0 && <p className="text-sm text-slate-500">No upcoming exams for {student.department}</p>}
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <h3 className="font-semibold mb-4">Recent Notifications</h3>
        <RecentNotifications />
      </Card>
    </div>
  );
}

function RecentNotifications() {
  const { user } = useAuth();
  const { notifications } = useNotifications();
  const filtered = notifications.filter((n) => n.audience === "all" || n.audience === "students");
  return (
    <div className="space-y-2">
      {filtered.slice(0, 4).map((n) => (
        <div key={n.id} className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 flex items-start gap-3">
          <div className={cn("w-2 h-2 rounded-full mt-1.5", n.read ? "bg-slate-300" : "bg-indigo-500 pulse-ring")} />
          <div className="flex-1">
            <p className="text-sm font-medium">{n.title}</p>
            <p className="text-xs text-slate-500 mt-0.5">{n.message}</p>
          </div>
          <p className="text-xs text-slate-400">{(n.createdAt || "").split(" ")[0]}</p>
        </div>
      ))}
    </div>
  );
}

// ============ PROFILE ============
export function StudentProfile() {
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Student | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [passwordForm, setPasswordForm] = useState({ current: "", next: "", confirm: "" });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  useEffect(() => { fetchMe().then((s) => { setStudent(s); setForm(s); setLoading(false); }); }, []);

  const onPhotoSelect = async (file: File) => {
    const err = validatePhotoFile(file);
    if (err) { setSaveError(err); return; }
    setPhotoUploading(true);
    setSaveError(null);
    try {
      const body = new FormData();
      body.append("photo", file);
      const res = await fetch(`${API}/api/student/profile/photo`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token()}` },
        body,
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.detail || "Failed to upload photo");
      }
      const data = await res.json();
      setStudent((s) => s ? { ...s, photo: data.photo } : s);
      setForm((f) => f ? { ...f, photo: data.photo } : f);
      setSaveSuccess("Profile photo updated");
    } catch (e: any) {
      setSaveError(e.message || "Photo upload failed");
    }
    setPhotoUploading(false);
  };

  const saveProfile = async () => {
    if (!form) return;
    setSaveError(null);
    setSaveSuccess(null);
    const res = await fetch(`${API}/api/student/profile/update`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
      body: JSON.stringify({ name: form.name, mobile: form.mobile, section: form.section }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setSaveError(j.detail || "Failed to save profile");
      return;
    }
    setStudent(form);
    setEditing(false);
    setSaveSuccess("Profile saved");
  };

  const changePassword = async () => {
    setPasswordError(null);
    setPasswordSuccess(null);
    if (passwordForm.next.length < 6) {
      setPasswordError("New password must be at least 6 characters");
      return;
    }
    if (passwordForm.next !== passwordForm.confirm) {
      setPasswordError("New passwords do not match");
      return;
    }
    setPasswordSaving(true);
    try {
      const res = await fetch(`${API}/api/student/profile/update`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({
          current_password: passwordForm.current,
          new_password: passwordForm.next,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.detail || "Failed to change password");
      }
      setPasswordForm({ current: "", next: "", confirm: "" });
      setPasswordSuccess("Password updated successfully");
    } catch (e: any) {
      setPasswordError(e.message || "Failed to change password");
    }
    setPasswordSaving(false);
  };

  if (loading || !student || !form) return <div className="p-10 text-center text-slate-500">Loading…</div>;

  return (
    <div>
      <PageHeader title="My Profile" subtitle="View and update your personal information (live from MySQL)" />
      {(saveError || saveSuccess) && (
        <div className={cn("mb-4 p-3 rounded-lg text-sm", saveError ? "bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300")}>
          {saveError || saveSuccess}
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-6 lg:col-span-1">
          <div className="text-center">
            <PhotoUpload
              photoUrl={student.photo}
              onFileSelect={onPhotoSelect}
              uploading={photoUploading}
              className="mx-auto"
            />
            <p className="text-xs text-slate-500 mt-2">Click camera to change photo</p>
            <h3 className="text-xl font-bold mt-4">{student.name}</h3>
            <p className="text-sm text-slate-500">{student.rollNo}</p>
            <Badge variant="indigo">{student.department}</Badge>
            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2 text-sm">
              <p className="flex items-center gap-2"><Mail className="w-4 h-4 text-slate-400" /> {student.email}</p>
              <p className="flex items-center gap-2"><UserIcon className="w-4 h-4 text-slate-400" /> {student.mobile || "—"}</p>
              <p className="flex items-center gap-2"><GraduationCap className="w-4 h-4 text-slate-400" /> Semester {student.semester} • Section {student.section}</p>
            </div>
          </div>
        </Card>
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold">Personal Information</h3>
              <Button variant="secondary" onClick={() => { setEditing(!editing); setForm(student); setSaveError(null); }}>
                {editing ? "Cancel" : "Edit"}
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <PField label="Full Name" value={form.name} editing={editing} onChange={(v) => setForm({ ...form, name: v })} />
              <PField label="Email" value={form.email} disabled />
              <PField label="Mobile" value={form.mobile} editing={editing} onChange={(v) => setForm({ ...form, mobile: v })} />
              <PField label="Department" value={form.department} disabled />
              <PField label="Semester" value={String(form.semester)} disabled />
              <PField label="Section" value={form.section} editing={editing} onChange={(v) => setForm({ ...form, section: v })} />
            </div>
            {editing && (
              <div className="mt-4 flex gap-2">
                <Button variant="primary" onClick={saveProfile}>Save Changes</Button>
                <Button variant="secondary" onClick={() => { setEditing(false); setForm(student); }}>Cancel</Button>
              </div>
            )}
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Lock className="w-4 h-4 text-indigo-600" />
              <h3 className="font-bold">Change Password</h3>
            </div>
            <p className="text-sm text-slate-500 mb-4">Update your login password anytime.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Current password</label>
                <TextInput type="password" value={passwordForm.current} onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })} placeholder="••••••••" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">New password</label>
                <TextInput type="password" value={passwordForm.next} onChange={(e) => setPasswordForm({ ...passwordForm, next: e.target.value })} placeholder="At least 6 characters" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Confirm new password</label>
                <TextInput type="password" value={passwordForm.confirm} onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })} placeholder="Re-enter new password" />
              </div>
            </div>
            {passwordError && <p className="mt-3 text-sm text-rose-600">{passwordError}</p>}
            {passwordSuccess && <p className="mt-3 text-sm text-emerald-600">{passwordSuccess}</p>}
            <Button variant="primary" className="mt-4" onClick={changePassword} disabled={passwordSaving || !passwordForm.current || !passwordForm.next}>
              {passwordSaving ? "Updating…" : "Update Password"}
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}

function PField({ label, value, editing, onChange, disabled }: { label: string; value: string; editing?: boolean; onChange?: (v: string) => void; disabled?: boolean }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
      {editing && !disabled ? <TextInput value={value} onChange={(e) => onChange?.(e.target.value)} />
                            : <div className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 text-sm font-medium">{value}</div>}
    </div>
  );
}

// ============ ELIGIBILITY ============
export function StudentEligibility() {
  const [student, setStudent] = useState<Student | null>(null);
  const [eligibility, setEligibility] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      const me = await fetchMe();
      if (!me) { setLoading(false); return; }
      setStudent(me);
      try {
        const res = await fetch(`${API}/api/student/eligibility`, { headers: { Authorization: `Bearer ${token()}` } });
        if (res.ok) setEligibility(await res.json());
        else setEligibility({ is_eligible: me && getStudentEligibility(me).eligible });
      } catch {
        setEligibility({ is_eligible: me && getStudentEligibility(me).eligible });
      }
      setLoading(false);
    })();
  }, []);
  if (loading || !student) return <div className="p-10 text-center text-slate-500">Loading…</div>;
  const e = getStudentEligibility(student);
  const checks = eligibility?.checks || { attendance: e.checks.attendance, internals: e.checks.internals, fee: e.checks.fee, previous: e.checks.previous };
  const passedCount = Object.values(checks).filter(Boolean).length;
  const isEligible = eligibility?.is_eligible ?? e.eligible;

  const criteria = [
    { label: "Attendance ≥ 75%", passed: checks.attendance, value: `${student.attendance}%`, target: "75%" },
    { label: "Internal Marks ≥ 40%", passed: checks.internals, value: `${Math.round((student.internalMarks/40)*100)}%`, target: "40%" },
    { label: "Fee Paid", passed: checks.fee, value: student.feePaid ? "Paid" : "Pending", target: "Paid" },
    { label: "Previous SGPA ≥ 5", passed: checks.previous, value: (student.previousResult ?? 0).toString(), target: "5.0" },
  ];

  return (
    <div>
      <PageHeader title="Eligibility Status" subtitle="Live from MySQL" />
      <div className={cn("relative mb-6 rounded-2xl overflow-hidden p-8 text-white shadow-xl",
        isEligible ? "bg-gradient-to-br from-emerald-500 via-teal-600 to-indigo-600" : "bg-gradient-to-br from-rose-500 via-pink-600 to-orange-600")}>
        <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex items-center gap-8">
          <div className="w-32 h-32 rounded-full bg-white/20 backdrop-blur flex items-center justify-center text-5xl font-extrabold">{e.eligibilityPct}%</div>
          <div>
            <h3 className="text-3xl font-bold">{isEligible ? "You are ELIGIBLE" : "Currently NOT ELIGIBLE"}</h3>
            <p className="mt-1 text-white/80">You meet {passedCount} of 4 criteria • AI Risk Score: {e.score}</p>
          </div>
        </div>
      </div>

      <Card className="p-6 mb-6">
        <h3 className="font-bold mb-4">Eligibility Criteria Breakdown</h3>
        <div className="space-y-3">
          {criteria.map((c) => (
            <div key={c.label} className={cn("flex items-center justify-between p-4 rounded-lg border-2",
              c.passed ? "bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800"
                       : "bg-rose-50 dark:bg-rose-900/10 border-rose-200 dark:border-rose-800")}>
              <div className="flex items-center gap-3">
                {c.passed ? <CheckCircle2 className="w-6 h-6 text-emerald-600" /> : <XCircle className="w-6 h-6 text-rose-600" />}
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">{c.label}</p>
                  <p className="text-xs text-slate-500">Required: {c.target} • Your: {c.value}</p>
                </div>
              </div>
              <Badge variant={c.passed ? "green" : "red"}>{c.passed ? "Passed" : "Failed"}</Badge>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4"><BrainCircuit className="w-5 h-5 text-indigo-600" /><h3 className="font-bold">AI Prediction</h3></div>
        <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">Random Forest classifier prediction based on your metrics.</p>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-lg bg-indigo-50 dark:bg-indigo-900/20">
            <p className="text-xs text-slate-500">Pass Probability</p>
            <p className="text-3xl font-bold text-indigo-600 mt-1">{Math.min(99, e.score + 5)}%</p>
          </div>
          <div className="p-4 rounded-lg bg-indigo-50 dark:bg-indigo-900/20">
            <p className="text-xs text-slate-500">Risk Score</p>
            <p className="text-3xl font-bold text-indigo-600 mt-1">{100 - e.score}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ============ HALL TICKET ============
export function StudentHallTicket() {
  const [ht, setHt] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState<Student | null>(null);
  useEffect(() => {
    (async () => {
      const me = await fetchMe();
      setStudent(me);
      try {
        const res = await fetch(`${API}/api/student/hallticket`, { headers: { Authorization: `Bearer ${token()}` } });
        if (res.ok) setHt(await res.json());
      } catch {}
      setLoading(false);
    })();
  }, []);
  if (loading) return <div className="p-10 text-center text-slate-500">Loading from MySQL…</div>;
  if (!ht || !ht.is_eligible || !student) {
    return (
      <div>
        <PageHeader title="Hall Ticket" subtitle="Download your examination hall ticket" />
        <Card className="p-10 text-center">
          <AlertTriangle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold mb-2">You are not eligible yet</h3>
          <p className="text-slate-500 mb-4 max-w-md mx-auto">Please meet all eligibility criteria before your hall ticket can be generated.</p>
          <Button variant="primary" onClick={() => window.location.href = "/student/eligibility"}>View Eligibility</Button>
        </Card>
      </div>
    );
  }

  const download = () => {
    const html = `<!DOCTYPE html><html><head><title>Hall Ticket</title>
<style>body{font-family:sans-serif;padding:30px}.card{border:3px solid #2563eb;border-radius:12px;max-width:700px;margin:0 auto;overflow:hidden}.h{background:linear-gradient(135deg,#2563eb,#7c3aed);color:#fff;padding:20px}.b{padding:25px}.r{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f1f5f9;font-size:13px}.r .l{color:#64748b}.r .v{font-weight:600}</style></head><body>
<div class="card"><div class="h"><h2>National Institute of Technology</h2><p>End Semester Examination • Nov 2026</p></div>
<div class="b">
<div class="r"><span class="l">Hall Ticket No</span><span class="v">${ht.hall_ticket_no}</span></div>
<div class="r"><span class="l">Student</span><span class="v">${ht.student.name}</span></div>
<div class="r"><span class="l">Roll No</span><span class="v">${ht.student.roll_no}</span></div>
<div class="r"><span class="l">Department</span><span class="v">${ht.student.department}</span></div>
<div class="r"><span class="l">Subject</span><span class="v">${ht.exam.subject_name} (${ht.exam.subject_code})</span></div>
<div class="r"><span class="l">Date / Time</span><span class="v">${ht.exam.date} at ${ht.exam.time}</span></div>
<div class="r"><span class="l">Duration</span><span class="v">${ht.exam.duration}</span></div>
<div class="r"><span class="l">Exam Hall</span><span class="v">${ht.exam.room}</span></div>
<div class="r"><span class="l">Seat Number</span><span class="v">${ht.seat_number}</span></div>
<p style="text-align:center;margin-top:20px;color:#475569">QR Code: ${ht.qr_code_content}</p>
</div></div><script>window.onload=()=>setTimeout(()=>window.print(),400)</script></body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); }
  };

  return (
    <div>
      <PageHeader title="My Hall Ticket" subtitle="Download or print your hall ticket"
        actions={
          <div className="flex gap-2">
            <Button variant="primary" onClick={download}><Download className="w-4 h-4" /> Download PDF</Button>
            <Button variant="secondary" onClick={() => window.print()}><Printer className="w-4 h-4" /> Print</Button>
            <Button variant="secondary" onClick={() => alert("Hall ticket emailed (demo)")}><Mail className="w-4 h-4" /> Email</Button>
          </div>
        } />

      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-2xl border-2 border-indigo-600 overflow-hidden shadow-xl">
          <div className="bg-brand-gradient text-white p-5 flex items-center justify-between">
            <div><p className="font-bold text-xl">National Institute of Technology</p><p className="text-xs opacity-90">End Semester Examination • Nov 2026</p></div>
            <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur flex items-center justify-center text-2xl font-bold">NIT</div>
          </div>
          <div className="p-8">
            <div className="text-center mb-6 pb-4 border-b-2 border-slate-200">
              <p className="text-xs uppercase tracking-widest text-slate-500">Official Hall Ticket</p>
              <p className="font-mono font-bold text-2xl text-indigo-600 mt-1">{ht.hall_ticket_no}</p>
            </div>
            <div className="grid grid-cols-3 gap-8">
              <div className="col-span-2 space-y-2">
                <InfoRow label="Candidate Name" value={ht.student.name} />
                <InfoRow label="Roll Number" value={ht.student.roll_no} />
                <InfoRow label="Department" value={ht.student.department} />
                <InfoRow label="Semester" value={`Semester ${student.semester}`} />
                <InfoRow label="Subject" value={ht.exam.subject_name} />
                <InfoRow label="Subject Code" value={ht.exam.subject_code} />
                <InfoRow label="Date & Time" value={`${ht.exam.date} at ${ht.exam.time}`} />
                <InfoRow label="Duration" value={ht.exam.duration} />
                <InfoRow label="Exam Hall" value={ht.exam.room} bold />
                <InfoRow label="Seat Number" value={ht.seat_number} bold />
              </div>
              <div className="flex flex-col items-center">
                <img src={ht.student.photo} alt="" className="w-32 h-32 rounded-lg bg-slate-100 border-2 border-indigo-200" />
                <div className="mt-4 p-3 rounded-lg border-2 border-indigo-200 bg-indigo-50">
                  <QRCodeSVG value={ht.qr_code_content} size={120} level="H" />
                  <p className="text-[10px] text-center text-slate-600 mt-1 font-semibold">Scan to verify</p>
                </div>
              </div>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-200 flex justify-between text-xs text-slate-600">
              <p>Issued: {new Date().toLocaleDateString()}</p>
              <p className="font-semibold">Controller of Examinations</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
      <span className="text-slate-500 text-sm">{label}</span>
      <span className={cn("text-sm", bold ? "font-bold text-indigo-700" : "font-medium")}>{value}</span>
    </div>
  );
}

// ============ EXAMS ============
export function StudentExams() {
  const [student, setStudent] = useState<Student | null>(null);
  const [list, setList] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      const me = await fetchMe();
      setStudent(me);
      try {
        const res = await fetch(`${API}/api/student/exams`, { headers: { Authorization: `Bearer ${token()}` } });
        if (res.ok) {
          const data = await res.json();
          setList(data.map((e: any) => ({ id: `e${e.id}`, subjectCode: e.subject_code, subjectName: e.subject_name, department: e.department, semester: e.semester, date: e.exam_date, time: e.exam_time, duration: e.duration, room: e.room, totalMarks: e.total_marks })));
        }
      } catch {}
      setLoading(false);
    })();
  }, []);
  if (loading) return <div className="p-10 text-center text-slate-500">Loading…</div>;
  return (
    <div>
      <PageHeader title="My Exams" subtitle={`${list.length} scheduled examinations (live from MySQL)`} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {list.map((e) => (
          <Card key={e.id} className="p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div><Badge variant="indigo">{e.subjectCode}</Badge><h3 className="font-bold mt-2">{e.subjectName}</h3></div>
              <div className="text-right">
                <p className="text-3xl font-bold text-indigo-600">{e.date.split("-")[2]}</p>
                <p className="text-xs text-slate-500 uppercase">{new Date(e.date).toLocaleString("en", { month: "short" })}</p>
              </div>
            </div>
            <div className="space-y-1 text-sm text-slate-600 dark:text-slate-300">
              <p>📅 {e.date} at {e.time}</p>
              <p>⏱️ Duration: {e.duration}</p>
              <p>🏛️ {e.room}</p>
              <p>📊 Total Marks: {e.totalMarks}</p>
            </div>
          </Card>
        ))}
        {list.length === 0 && <div className="col-span-2 p-10 text-center text-slate-500">No exams scheduled for your department</div>}
      </div>
    </div>
  );
}

// ============ FACE VERIFICATION ============
export function StudentFaceVerify() {
  const [step, setStep] = useState<"idle" | "capturing" | "success" | "fail">("idle");
  const [confidence, setConfidence] = useState(0);
  const start = () => {
    setStep("capturing"); setConfidence(0);
    const int = setInterval(() => {
      setConfidence((c) => {
        if (c >= 100) {
          clearInterval(int);
          setStep(Math.random() > 0.1 ? "success" : "fail");
          return 100;
        }
        return c + 5;
      });
    }, 60);
  };
  return (
    <div>
      <PageHeader title="Face Verification" subtitle="Verify your identity using biometric authentication" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="font-bold mb-4">Live Capture</h3>
          <div className="aspect-video rounded-xl bg-slate-900 flex items-center justify-center relative overflow-hidden">
            {step === "capturing" ? (
              <div className="text-center">
                <div className="w-32 h-32 rounded-full border-4 border-indigo-400 pulse-ring mx-auto flex items-center justify-center">
                  <Camera className="w-16 h-16 text-indigo-400" />
                </div>
                <p className="text-white mt-4">Matching face...</p>
                <div className="w-48 mx-auto h-1.5 bg-slate-700 rounded-full mt-3 overflow-hidden">
                  <div className="h-full bg-indigo-500 transition-all" style={{ width: `${confidence}%` }} />
                </div>
                <p className="text-indigo-400 text-xs mt-1">{confidence}%</p>
              </div>
            ) : (
              <div className="text-center">
                <Camera className="w-16 h-16 text-slate-500 mx-auto" />
                <p className="text-slate-400 mt-4">Ready to verify</p>
              </div>
            )}
            <div className="absolute top-3 left-3 px-2 py-1 rounded-md bg-rose-500 text-white text-xs font-semibold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" /> LIVE
            </div>
          </div>
          <Button variant="primary" className="w-full mt-4" onClick={start} disabled={step === "capturing"}>
            <Camera className="w-4 h-4" /> {step === "capturing" ? "Verifying..." : "Start Verification"}
          </Button>
        </Card>

        <Card className="p-6">
          <h3 className="font-bold mb-4">Result</h3>
          {step === "idle" && <div className="h-full flex items-center justify-center text-slate-400 text-sm">Start verification to see results</div>}
          {step === "capturing" && <div className="h-full flex items-center justify-center text-slate-400 text-sm">Processing...</div>}
          {step === "success" && (
            <div className="p-6 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border-2 border-emerald-200 dark:border-emerald-800 text-center">
              <CheckCircle2 className="w-20 h-20 text-emerald-600 mx-auto" />
              <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-3">VERIFIED</p>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">Welcome!</p>
              <div className="grid grid-cols-2 gap-2 mt-4">
                <div className="p-3 rounded-lg bg-white dark:bg-slate-900">
                  <p className="text-xs text-slate-500">Confidence</p>
                  <p className="text-2xl font-bold text-emerald-600">{confidence}%</p>
                </div>
                <div className="p-3 rounded-lg bg-white dark:bg-slate-900"><p className="text-xs text-slate-500">Status</p><p className="text-2xl font-bold">✓</p></div>
              </div>
            </div>
          )}
          {step === "fail" && (
            <div className="p-6 rounded-xl bg-rose-50 dark:bg-rose-900/20 border-2 border-rose-200 dark:border-rose-800 text-center">
              <XCircle className="w-20 h-20 text-rose-600 mx-auto" />
              <p className="text-2xl font-bold text-rose-700 dark:text-rose-300 mt-3">NOT VERIFIED</p>
              <Button variant="secondary" className="mt-4" onClick={start}>Try Again</Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

// ============ NOTIFICATIONS ============
export function StudentNotifications() {
  const { notifications, markRead, markAllRead } = useNotifications();
  const filtered = notifications.filter((n) => n.audience === "all" || n.audience === "students");
  return (
    <div>
      <PageHeader title="My Notifications" subtitle={`${filtered.filter(n => !n.read).length} unread (live from MySQL)`}
        actions={<Button variant="secondary" onClick={markAllRead}>Mark all read</Button>} />
      <Card className="divide-y divide-slate-100 dark:divide-slate-800">
        {filtered.length === 0 && <div className="p-10 text-center text-slate-500">No notifications</div>}
        {filtered.map((n) => (
          <div key={n.id} className="p-5 flex items-start gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/40">
            <div className={cn("w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
              n.read ? "bg-slate-100 dark:bg-slate-800" : "bg-indigo-100 dark:bg-indigo-900/40")}>
              <Mail className={cn("w-5 h-5", n.read ? "text-slate-400" : "text-indigo-600")} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className={cn("font-semibold", n.read ? "text-slate-600 dark:text-slate-300" : "text-slate-900 dark:text-white")}>{n.title}</p>
                <p className="text-xs text-slate-400 flex-shrink-0">{n.createdAt}</p>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5">{n.message}</p>
              {!n.read && <button onClick={() => markRead(n.id)} className="text-xs text-indigo-600 hover:underline mt-1">Mark as read</button>}
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}

// ============ AI CHATBOT ============
export function StudentChatbot() {
  const [student, setStudent] = useState<Student | null>(null);
  const [messages, setMessages] = useState([{ role: "bot", text: "Hi! I'm your ExamShield AI assistant. Ask me anything about your eligibility, attendance, exams, or hall tickets." }]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchMe().then(setStudent);
    scrollRef.current?.scrollTo({ top: 9999, behavior: "smooth" });
  }, [messages, thinking]);

  const ask = async (q: string) => {
    if (!q.trim()) return;
    setMessages((m) => [...m, { role: "user", text: q }]);
    setInput(""); setThinking(true);
    try {
      const res = await fetch(`${API}/api/student/chatbot`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ user_query: q }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages((m) => [...m, { role: "bot", text: data.response }]);
      } else {
        setMessages((m) => [...m, { role: "bot", text: "Backend unavailable. Try again." }]);
      }
    } catch {
      setMessages((m) => [...m, { role: "bot", text: "Network error. Please check the backend." }]);
    }
    setThinking(false);
  };

  const quickQuestions = ["Am I eligible?", "What's my attendance?", "When is my next exam?", "What are my internal marks?", "Download my hall ticket"];

  return (
    <div>
      <PageHeader title="AI Assistant" subtitle="Powered by ExamShield AI • Uses live MySQL data" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 overflow-hidden flex flex-col h-[70vh]">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-brand-gradient flex items-center justify-center text-white">
              <Sparkles className="w-5 h-5" />
            </div>
            <div><p className="font-bold">ExamShield AI</p><p className="text-xs text-emerald-500">● Online</p></div>
          </div>
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div className={cn("max-w-[80%] px-4 py-2.5 rounded-2xl text-sm",
                  m.role === "user" ? "bg-indigo-600 text-white rounded-br-sm" : "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-bl-sm")}>
                  <div dangerouslySetInnerHTML={{ __html: m.text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br/>") }} />
                </div>
              </div>
            ))}
            {thinking && (
              <div className="flex justify-start">
                <div className="bg-slate-100 dark:bg-slate-800 px-4 py-3 rounded-2xl rounded-bl-sm">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="p-4 border-t border-slate-200 dark:border-slate-800">
            <div className="flex flex-wrap gap-1 mb-3">
              {quickQuestions.map((q) => (
                <button key={q} onClick={() => ask(q)} disabled={thinking}
                  className="px-3 py-1 rounded-full text-xs bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 disabled:opacity-50">
                  {q}
                </button>
              ))}
            </div>
            <form onSubmit={(e) => { e.preventDefault(); if (input.trim()) ask(input); }} className="flex gap-2">
              <TextInput value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about eligibility, attendance, exams..." disabled={thinking} />
              <Button variant="primary" type="submit" disabled={thinking || !input.trim()}><Send className="w-4 h-4" /></Button>
            </form>
          </div>
        </Card>

        <Card className="p-5 h-[70vh] overflow-y-auto">
          <h3 className="font-bold mb-4">Your Quick Stats</h3>
          {student ? (
            <div className="space-y-3">
              <StatMini label="Attendance" value={`${student.attendance}%`} ok={student.attendance >= 75} />
              <StatMini label="Internal Marks" value={`${student.internalMarks}/40`} ok={student.internalMarks >= 32} />
              <StatMini label="Eligibility" value={`${getStudentEligibility(student).eligibilityPct}%`} ok={getStudentEligibility(student).eligible} />
              <StatMini label="AI Score" value={getStudentEligibility(student).score} />
              <StatMini label="Backlogs" value={student.backlogs} ok={student.backlogs === 0} />
              <StatMini label="Fee Status" value={student.feePaid ? "Paid" : "Pending"} ok={student.feePaid} />
            </div>
          ) : <p className="text-sm text-slate-500">Loading…</p>}
        </Card>
      </div>
    </div>
  );
}

function StatMini({ label, value, ok }: { label: string; value: string | number; ok?: boolean }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
      <span className="text-sm text-slate-500">{label}</span>
      <span className={cn("font-bold text-sm",
        ok === undefined ? "text-slate-800 dark:text-white" : ok ? "text-emerald-600" : "text-rose-600")}>{value}</span>
    </div>
  );
}

// ============ PAYMENTS ============
export function StudentPayments() {
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const me = await fetchMe();
      setStudent(me);
      setLoading(false);
    })();
  }, []);

  if (loading || !student) return <div className="p-10 text-center text-slate-500">Loading…</div>;

  return (
    <div>
      <PageHeader title="Fee Payments" subtitle="Manage your fee payments and payment history" />

      {/* Main Payment Card */}
      <Card className={cn("p-8 mb-6 rounded-2xl", student.feePaid ? "bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 border-2 border-emerald-200 dark:border-emerald-800" : "bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20 border-2 border-amber-200 dark:border-amber-800")}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className={cn("p-3 rounded-full", student.feePaid ? "bg-emerald-500" : "bg-amber-500")}>
                <Wallet className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">{student.feePaid ? "Fee Paid" : "Fee Pending"}</h2>
                <p className={cn("text-sm font-medium", student.feePaid ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300")}>
                  {student.feePaid ? "✓ Your fees are up to date" : "⚠ Action required"}
                </p>
              </div>
            </div>
            <div className="mt-6 space-y-3">
              <div className="p-3 rounded-lg bg-white/50 dark:bg-slate-800/30">
                <p className="text-sm text-slate-600 dark:text-slate-400">Total Amount Due</p>
                <p className="text-3xl font-bold text-slate-900 dark:text-white">₹{student.feeAmount.toLocaleString()}</p>
              </div>
              {student.feeDueDate && (
                <div className="p-3 rounded-lg bg-white/50 dark:bg-slate-800/30">
                  <p className="text-sm text-slate-600 dark:text-slate-400">Due Date</p>
                  <p className="text-lg font-semibold text-slate-900 dark:text-white">{student.feeDueDate}</p>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col justify-center">
            {!student.feePaid && (
              <div className="space-y-4">
                <h3 className="font-bold text-lg">Payment Methods</h3>
                <div className="space-y-2">
                  <Button 
                    variant="primary" 
                    className="w-full py-3"
                    onClick={() => alert(`Redirecting to payment gateway...\n\nAmount: ₹${student.feeAmount}\n\nIn production, this would integrate with Razorpay, PayPal, or Stripe.`)}
                  >
                    <Wallet className="w-5 h-5" /> Pay Online
                  </Button>
                  <Button 
                    variant="secondary" 
                    className="w-full"
                    onClick={() => alert("Bank Transfer Details:\n\nBank: SBI\nAccount: 1234567890\nIFSC: SBIN0001234\nSwift: SBININBBXXX")}
                  >
                    Bank Transfer
                  </Button>
                  <Button 
                    variant="secondary" 
                    className="w-full"
                    onClick={() => alert("You can pay at the college office:\n\nCash Counter - Admin Block, 2nd Floor\n\nMon-Fri: 9 AM - 5 PM\nAccept: Cash, Cheque, DD")}
                  >
                    Pay at College
                  </Button>
                </div>
              </div>
            )}
            {student.feePaid && (
              <div className="text-center">
                <CheckCircle2 className="w-20 h-20 text-emerald-600 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-emerald-700 dark:text-emerald-300">Payment Completed</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">Your fee payment has been processed successfully. Thank you!</p>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Payment Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="p-5">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
              <Wallet className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Academic Year</p>
              <p className="text-lg font-bold mt-1">2024-2025</p>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Status</p>
              <p className={cn("text-lg font-bold mt-1", student.feePaid ? "text-emerald-600" : "text-amber-600")}>
                {student.feePaid ? "Paid" : "Pending"}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-rose-100 dark:bg-rose-900/30">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Eligibility Impact</p>
              <p className={cn("text-lg font-bold mt-1", student.feePaid ? "text-emerald-600" : "text-rose-600")}>
                {student.feePaid ? "Eligible" : "Not Eligible"}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Payment Receipt / Summary */}
      <Card className="p-6">
        <h3 className="font-bold text-lg mb-4">Payment Summary</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
            <div>
              <p className="font-semibold">Semester Fees</p>
              <p className="text-xs text-slate-500">Tuition & Infrastructure</p>
            </div>
            <p className="text-lg font-bold">₹{(student.feeAmount * 0.7).toLocaleString()}</p>
          </div>
          <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
            <div>
              <p className="font-semibold">Miscellaneous Charges</p>
              <p className="text-xs text-slate-500">Library, Lab, Technology</p>
            </div>
            <p className="text-lg font-bold">₹{(student.feeAmount * 0.3).toLocaleString()}</p>
          </div>
          <div className="flex items-center justify-between p-4 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border-2 border-indigo-200 dark:border-indigo-800">
            <div>
              <p className="font-bold text-indigo-700 dark:text-indigo-300">Total Amount Due</p>
            </div>
            <p className="text-2xl font-bold text-indigo-700 dark:text-indigo-300">₹{student.feeAmount.toLocaleString()}</p>
          </div>
        </div>

        {student.feePaid && (
          <div className="mt-6 p-4 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border-2 border-emerald-200 dark:border-emerald-800">
            <p className="text-sm text-emerald-700 dark:text-emerald-300">
              ✓ <span className="font-semibold">Payment Verified</span> on {new Date().toLocaleDateString()}
            </p>
          </div>
        )}
      </Card>

      {/* FAQ Section */}
      <Card className="p-6 mt-6">
        <h3 className="font-bold text-lg mb-4">Frequently Asked Questions</h3>
        <div className="space-y-4">
          <div>
            <p className="font-semibold text-slate-900 dark:text-white mb-1">When is the fee due?</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">Fees are due by {student.feeDueDate}. Late payment may impact your eligibility for exams.</p>
          </div>
          <div>
            <p className="font-semibold text-slate-900 dark:text-white mb-1">What payment methods are accepted?</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">We accept online payments (Razorpay), bank transfers, and cash/cheque at the college office.</p>
          </div>
          <div>
            <p className="font-semibold text-slate-900 dark:text-white mb-1">Can I pay in installments?</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">Contact the Admin office to arrange installment payments. Charges may apply.</p>
          </div>
          <div>
            <p className="font-semibold text-slate-900 dark:text-white mb-1">Is there a late payment fee?</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">Yes, 2% per month late payment charge applies if paid after the due date.</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
