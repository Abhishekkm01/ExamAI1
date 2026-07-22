import { useState, useMemo, useRef, useEffect } from "react";
import { Card, PageHeader, StatCard, Button, Badge, TextInput, Select } from "../../components/Layout";
import { fetchStudents, fetchExams, getStudentEligibility } from "../../data/apiData";
import type { Student, Exam } from "../../data/types";
import { useAuth, useNotifications } from "../../contexts/AppContext";
import { useNavigate } from "react-router-dom";
import { User as UserIcon, GraduationCap, Calendar, Mail, Camera, MessageSquare, Download, Printer, CheckCircle2, XCircle, AlertTriangle, TrendingUp, Send, Sparkles, TicketCheck, BrainCircuit, Lock, Wallet } from "lucide-react";
import { PhotoUpload, validatePhotoFile } from "../../components/PhotoUpload";
import { FaceCapture } from "../../components/FaceCapture";
import { QRCodeSVG } from "qrcode.react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, LineChart, Line } from "recharts";
import { cn } from "../../utils/cn";
import { API_BASE } from "../../data/api";
import { useSystemSettings } from "../../hooks/useSystemSettings";
import { buildSimpleHallTicketHtml, examHeaderSubtitle, universityInitials } from "../../utils/hallTicket";
import { INTERNAL_MARKS_MAX, ASSIGNMENT_MARKS_MAX } from "../../data/marksConstants";

const token = () => localStorage.getItem("examshield_token") || "";

async function fetchMe(): Promise<(Student & { subjectPerformance?: { name: string; code: string; internal: number; assign: number; attendance: number | null; hasMarks?: boolean; hasAttendance?: boolean }[] }) | null> {
  try {
    const res = await fetch(`${API_BASE}/api/student/profile`, { headers: { Authorization: `Bearer ${token()}` } });
    if (!res.ok) return null;
    const p = await res.json();
    const subjectPerformance = (p.subject_performance || []).map((row: any) => ({
      name: row.subject_name || row.subject_code,
      code: row.subject_code,
      internal: Number(row.internal_marks) || 0,
      assign: Number(row.assignment_marks) || 0,
      attendance: row.attendance == null ? null : Number(row.attendance),
      hasMarks: !!row.has_marks,
      hasAttendance: !!row.has_attendance,
    }));
    return {
      id: `s${p.id}`, rollNo: p.roll_no, name: p.name, email: p.email, mobile: p.mobile || "",
      gender: p.gender || "", dateOfBirth: p.date_of_birth || "",
      department: p.department, semester: p.semester, section: p.section, photo: p.photo,
      attendance: p.attendance, internalMarks: p.internal_marks, assignmentMarks: p.assignment_marks,
      previousResult: p.previous_result, backlogs: p.backlogs, feePaid: p.fee_paid,
      feeAmount: Number(p.fee_amount) || 0,
      examFeePaid: !!p.exam_fee_paid,
      collegeFeeAmount: Number(p.college_fee_amount) || 0,
      collegeFeePaid: !!p.college_fee_paid,
      feeDueDate: p.fee_due_date, createdAt: "2023-08-12",
      subjectPerformance,
    };
  } catch { return null; }
}

type FeePaymentRecord = {
  id: number;
  fee_type?: string;
  exam_id?: number | null;
  exam_title?: string | null;
  backlog_id?: number | null;
  backlog_subject?: string | null;
  amount: number;
  method: string;
  transaction_id: string;
  reference: string;
  status: string;
  paid_at: string | null;
  verified_at?: string | null;
  admin_note?: string;
};

type ExamFeeRow = {
  exam_id: number;
  title: string;
  subject_code: string;
  subject_name: string;
  exam_date: string;
  fee_amount: number;
  paid: boolean;
  payment_pending: boolean;
  pending_payment: FeePaymentRecord | null;
};

type FeeInfo = {
  fee_paid: boolean;
  fee_amount: number;
  fee_due_date: string | null;
  college_fee_amount: number;
  college_fee_paid: boolean;
  exam_fee_amount: number;
  exam_fee_paid: boolean;
  exam_fees?: ExamFeeRow[];
  unpaid_exam_count?: number;
  is_eligible: boolean;
  eligibility_percentage: number;
  payment_pending: boolean;
  pending_payment: FeePaymentRecord | null;
  pending_college?: FeePaymentRecord | null;
  pending_exam?: FeePaymentRecord | null;
  bank_details: { bank_name: string; account_name: string; account_number: string; ifsc: string; swift: string };
  college_office: { location: string; hours: string; accepts: string };
  payment_history: FeePaymentRecord[];
  last_payment: FeePaymentRecord | null;
};

async function fetchFees(): Promise<FeeInfo | null> {
  try {
    const res = await fetch(`${API_BASE}/api/student/fees`, { headers: { Authorization: `Bearer ${token()}` } });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

async function payStudentFee(
  method: "online" | "bank_transfer" | "college",
  reference = "",
  feeType: "college" | "exam" | "backlog" = "exam",
  examId?: number | null,
  backlogId?: number | null,
) {
  const res = await fetch(`${API_BASE}/api/student/fees/pay`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      method,
      reference,
      fee_type: feeType,
      ...(feeType === "exam" && examId != null ? { exam_id: Number(examId) } : {}),
      ...(feeType === "backlog" && backlogId != null ? { backlog_id: Number(backlogId) } : {}),
    }),
  });
  const text = await res.text();
  let data: any = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { detail: text || `HTTP ${res.status}` }; }
  if (!res.ok) {
    const detail = data.detail ?? data.message ?? data.error;
    let msg = "Payment failed";
    if (typeof detail === "string" && detail.trim()) msg = detail;
    else if (detail != null) msg = JSON.stringify(detail);
    throw new Error(msg);
  }
  return data;
}

// ============ STUDENT DASHBOARD ============
export function StudentDashboard() {
  const { user } = useAuth();
  const [student, setStudent] = useState<(Student & { subjectPerformance?: { name: string; code: string; internal: number; assign: number; attendance: number | null; hasMarks?: boolean; hasAttendance?: boolean }[] }) | null>(null);
  const [exams, setExams] = useState<Exam[]>([]);
  const [paymentPending, setPaymentPending] = useState(false);
  const [unpaidExamCount, setUnpaidExamCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const [me, ex, fees] = await Promise.all([fetchMe(), fetchExams(), fetchFees()]);
      setStudent(me); setExams(ex);
      setPaymentPending(!!fees?.payment_pending);
      setUnpaidExamCount(Number(fees?.unpaid_exam_count || 0));
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="p-10 text-center text-slate-500">Loading from MySQL…</div>;
  if (!student) return <div className="p-10 text-center text-rose-500">Student profile not found</div>;

  const e = getStudentEligibility(student);
  const upcoming = exams.filter(ex => ex.department === student.department);

  const performanceData = (student.subjectPerformance || []).map((row) => ({
    name: row.code || row.name,
    fullName: row.name,
    internal: row.internal,
    assign: row.assign,
    attendance: row.attendance ?? 0,
  }));

  const timetableRows = upcoming.flatMap((ex) => {
    const subjects = ex.subjects?.length
      ? ex.subjects
      : [{ subjectCode: ex.subjectCode, subjectName: ex.subjectName, date: ex.date, time: ex.time, duration: ex.duration }];
    return subjects.map((s) => ({
      examTitle: ex.title || ex.subjectName,
      code: s.subjectCode,
      name: s.subjectName,
      date: s.date || ex.date,
      time: s.time || ex.time,
      duration: s.duration || ex.duration,
      room: ex.room,
    }));
  });

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
        <StatCard label="Internal Marks" value={`${student.internalMarks}/${INTERNAL_MARKS_MAX}`} icon={TrendingUp} color="emerald" delta={`${Math.round((student.internalMarks / INTERNAL_MARKS_MAX) * 100)}%`} />
        <StatCard label="Hall Ticket" value={e.eligible ? "Ready" : "Pending"} icon={TicketCheck} color={e.eligible ? "emerald" : "amber"} />
        <StatCard label="Next Exam" value={upcoming[0]?.date.split("-")[2] || "—"} icon={Calendar} color="violet" delta={upcoming[0]?.subjectName.slice(0, 15)} />
      </div>

      {/* Fee Payment Card */}
      <Card className={cn("p-6 mb-6", student.feePaid ? "bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800" : paymentPending ? "bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800" : "bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800")}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <Wallet className={cn("w-5 h-5", student.feePaid ? "text-emerald-600" : paymentPending ? "text-indigo-600" : "text-amber-600")} />
              College & Exam Fees
            </h3>
            <div className="mt-3 space-y-2">
              <p className={cn("text-sm font-medium", student.feePaid ? "text-emerald-700 dark:text-emerald-300" : paymentPending ? "text-indigo-700 dark:text-indigo-300" : "text-amber-700 dark:text-amber-300")}>
                {student.feePaid ? "✓ Both fees paid" : paymentPending ? "⏳ Awaiting admin approval" : unpaidExamCount > 0 ? `⚠ ${unpaidExamCount} exam fee(s) due` : "⚠ Pay college fee and exam fee"}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                <p className="text-slate-600 dark:text-slate-400">
                  College: <span className="font-semibold">₹{(student.collegeFeeAmount || 0).toLocaleString()}</span>{" "}
                  {student.collegeFeePaid ? <Badge variant="green">Paid</Badge> : <Badge variant="amber">Due</Badge>}
                </p>
                <p className="text-slate-600 dark:text-slate-400">
                  Exam: <span className="font-semibold">₹{(student.feeAmount || 0).toLocaleString()}</span>{" "}
                  {student.examFeePaid ? <Badge variant="green">Paid</Badge> : <Badge variant="amber">Due</Badge>}
                </p>
              </div>
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
              onClick={() => navigate("/student/payments")}
            >
              <Wallet className="w-4 h-4" /> {paymentPending ? "View Status" : "Pay Now"}
            </Button>
          )}
          {student.feePaid && (
            <div className="text-emerald-600 dark:text-emerald-400 text-right">
              <CheckCircle2 className="w-8 h-8" />
            </div>
          )}
        </div>
      </Card>

      <Card className="p-5 mb-6">
        <h3 className="font-semibold mb-1">Marks & Attendance by Subject</h3>
        <p className="text-xs text-slate-500 mb-4">Internal marks and attendance for every subject (uploaded by teachers)</p>
        {performanceData.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2">Subject</th>
                  <th className="px-3 py-2">Internal /{INTERNAL_MARKS_MAX}</th>
                  <th className="px-3 py-2">Assignment /{ASSIGNMENT_MARKS_MAX}</th>
                  <th className="px-3 py-2">Attendance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {(student.subjectPerformance || []).map((row) => (
                  <tr key={row.code}>
                    <td className="px-3 py-2.5">
                      <p className="font-medium">{row.name}</p>
                      <p className="text-xs text-slate-500 font-mono">{row.code}</p>
                    </td>
                    <td className="px-3 py-2.5 font-semibold">{row.hasMarks || row.internal > 0 ? row.internal : "—"}</td>
                    <td className="px-3 py-2.5">{row.hasMarks || row.assign > 0 ? row.assign : "—"}</td>
                    <td className="px-3 py-2.5">
                      {row.attendance != null ? (
                        <span className={cn("font-semibold", row.attendance >= 75 ? "text-emerald-600" : "text-rose-600")}>{row.attendance}%</span>
                      ) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-slate-500">No subject data yet. Teachers will upload marks and attendance.</p>
        )}
        {performanceData.length > 0 && (
          <div className="h-56 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={performanceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,.3)" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{ background: "rgba(15,23,42,.9)", border: "none", borderRadius: 8, color: "#fff" }}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName || _}
                />
                <Bar dataKey="internal" fill="#2563eb" name={`Internal /${INTERNAL_MARKS_MAX}`} radius={[6, 6, 0, 0]} />
                <Bar dataKey="attendance" fill="#059669" name="Attendance %" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card className="p-5">
          <h3 className="font-semibold mb-1">Exam Timetable</h3>
          <p className="text-xs text-slate-500 mb-4">Date and time for each subject</p>
          {timetableRows.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-200 dark:border-slate-800">
                    <th className="pb-2 pr-2">Code</th>
                    <th className="pb-2 pr-2">Subject</th>
                    <th className="pb-2 pr-2">Date</th>
                    <th className="pb-2">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {timetableRows.map((row, idx) => (
                    <tr key={`${row.code}-${idx}`}>
                      <td className="py-2 pr-2 font-mono text-indigo-600 text-xs">{row.code}</td>
                      <td className="py-2 pr-2 font-medium">{row.name}</td>
                      <td className="py-2 pr-2 whitespace-nowrap">{row.date}</td>
                      <td className="py-2 whitespace-nowrap">{row.time}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-slate-500">No exams scheduled for {student.department}</p>
          )}
        </Card>
        <Card className="p-5">
          <h3 className="font-semibold mb-4">Upcoming Exams</h3>
          <div className="space-y-3">
            {upcoming.slice(0, 4).map((ex) => (
              <div key={ex.id} className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                <p className="text-sm font-semibold">{ex.title || ex.subjectName}</p>
                {ex.title && ex.title !== ex.subjectName && (
                  <p className="text-xs text-slate-500">{ex.subjectName}</p>
                )}
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
  const { notifications, loading } = useNotifications();
  const filtered = notifications.filter((n) => n.audience === "all" || n.audience === "students");
  if (loading && !filtered.length) {
    return <p className="text-sm text-slate-500">Loading notifications…</p>;
  }
  if (!filtered.length) {
    return <p className="text-sm text-slate-500">No notifications yet</p>;
  }
  return (
    <div className="space-y-2">
      {filtered.slice(0, 4).map((n) => (
        <div key={n.id} className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 flex items-start gap-3">
          <div className={cn("w-2 h-2 rounded-full mt-1.5", n.read ? "bg-slate-300" : "bg-indigo-500 pulse-ring")} />
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="text-sm font-medium">{n.title}</p>
              {n.department && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 font-medium">
                  {n.department}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5 whitespace-pre-wrap">{n.message}</p>
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
  const [photoUploading, setPhotoUploading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [passwordForm, setPasswordForm] = useState({ current: "", next: "", confirm: "" });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  useEffect(() => { fetchMe().then((s) => { setStudent(s); setLoading(false); }); }, []);

  const onPhotoSelect = async (file: File) => {
    const err = validatePhotoFile(file);
    if (err) { setSaveError(err); return; }
    setPhotoUploading(true);
    setSaveError(null);
    try {
      const body = new FormData();
      body.append("photo", file);
      const res = await fetch(`${API_BASE}/api/student/profile/photo`, {
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
      setSaveSuccess("Profile photo updated");
    } catch (e: any) {
      setSaveError(e.message || "Photo upload failed");
    }
    setPhotoUploading(false);
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
      const res = await fetch(`${API_BASE}/api/student/profile/update`, {
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

  if (loading || !student) return <div className="p-10 text-center text-slate-500">Loading…</div>;

  return (
    <div>
      <PageHeader title="My Profile" subtitle="View your personal information (managed by college admin)" />
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
            <h3 className="font-bold mb-4">Personal Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <PField label="Full Name" value={student.name} disabled />
              <PField label="USN / Roll No" value={student.rollNo} disabled />
              <PField label="Email" value={student.email} disabled />
              <PField label="Mobile" value={student.mobile || "—"} disabled />
              <PField label="Gender" value={student.gender ? student.gender.charAt(0).toUpperCase() + student.gender.slice(1) : "—"} disabled />
              <PField label="Date of Birth" value={student.dateOfBirth || "—"} disabled />
              <PField label="Department" value={student.department} disabled />
              <PField label="Semester" value={String(student.semester)} disabled />
            </div>
            <p className="text-xs text-slate-500 mt-4">Personal details can only be updated by the college admin.</p>
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
        const res = await fetch(`${API_BASE}/api/student/eligibility`, { headers: { Authorization: `Bearer ${token()}` } });
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
  const checks = eligibility?.checks || { attendance: e.checks.attendance, internals: e.checks.internals, fee: e.checks.fee };
  const passedCount = Object.values(checks).filter(Boolean).length;
  const isEligible = eligibility?.is_eligible ?? e.eligible;

  const criteria = [
    { label: "Attendance ≥ 75%", passed: checks.attendance, value: `${student.attendance}%`, target: "75%" },
    { label: "Internal Marks ≥ 40%", passed: checks.internals, value: `${Math.round((student.internalMarks / INTERNAL_MARKS_MAX) * 100)}%`, target: "40%" },
    { label: "Fees Paid", passed: checks.fee, value: student.feePaid ? "Both paid" : "Pending", target: "College + Exam" },
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
            <p className="mt-1 text-white/80">You meet {passedCount} of {criteria.length} criteria • AI Risk Score: {e.score}</p>
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
  const { settings: systemSettings } = useSystemSettings();
  useEffect(() => {
    (async () => {
      const me = await fetchMe();
      setStudent(me);
      try {
        const res = await fetch(`${API_BASE}/api/student/hallticket`, { headers: { Authorization: `Bearer ${token()}` } });
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
    const html = buildSimpleHallTicketHtml(
      systemSettings.university_name,
      systemSettings.academic_year,
      ht.hall_ticket_no,
      ht.student.name,
      ht.student.roll_no,
      ht.student.department,
      ht.exam.subject_name,
      ht.exam.subject_code,
      ht.exam.date,
      ht.exam.time,
      ht.exam.duration,
      ht.exam.room,
      ht.seat_number,
      ht.qr_code_content,
      ht.subjects,
      ht.exam.title,
      student.semester,
      ht.student.photo,
      systemSettings.college_logo_url,
    );
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
          <div className="bg-brand-gradient text-white px-5 py-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-bold text-lg break-words leading-snug">{systemSettings.university_name}</p>
              <p className="text-xs opacity-90 mt-0.5">{examHeaderSubtitle(systemSettings.academic_year, ht.exam.title || ht.exam.subject_name)}</p>
            </div>
            {systemSettings.college_logo_url ? (
              <img src={systemSettings.college_logo_url} alt="College logo" className="w-14 h-14 shrink-0 rounded-lg bg-white object-contain p-1" />
            ) : (
              <div className="w-12 h-12 shrink-0 rounded-full bg-white/20 backdrop-blur flex items-center justify-center text-lg font-bold">{universityInitials(systemSettings.university_name)}</div>
            )}
          </div>
          <div className="p-5">
            <div className="text-center mb-4 pb-3 border-b border-slate-200">
              <p className="text-[10px] uppercase tracking-widest text-slate-500">Official Hall Ticket</p>
              <p className="font-mono font-bold text-lg text-indigo-600 mt-0.5 break-all">{ht.hall_ticket_no}</p>
            </div>
            <div className="flex gap-4 items-start">
              <dl className="flex-1 min-w-0 grid grid-cols-[7rem_1fr] gap-x-3 gap-y-1.5 text-sm">
                <dt className="text-slate-500">Examination</dt>
                <dd className="font-bold text-indigo-700 dark:text-indigo-300 break-words">{ht.exam.title || ht.exam.subject_name}</dd>
                <dt className="text-slate-500">Name</dt>
                <dd className="font-medium break-words">{ht.student.name}</dd>
                <dt className="text-slate-500">Roll No</dt>
                <dd className="font-medium break-all">{ht.student.roll_no}</dd>
                <dt className="text-slate-500">Department</dt>
                <dd className="font-medium break-words">{ht.student.department}</dd>
                <dt className="text-slate-500">Semester</dt>
                <dd className="font-medium">Semester {student.semester}</dd>
              </dl>
              <img src={ht.student.photo} alt="" className="w-28 h-28 shrink-0 rounded-md bg-slate-100 border border-indigo-200 object-cover" />
            </div>
            <div className="mt-4">
              <p className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold mb-1.5">Examination Subjects</p>
              <div className="overflow-x-auto rounded-md border border-slate-200 dark:border-slate-700">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/80">
                    <tr className="text-left text-[10px] uppercase tracking-wide text-slate-500">
                      <th className="px-2.5 py-2 whitespace-nowrap">#</th>
                      <th className="px-2.5 py-2 whitespace-nowrap">Code</th>
                      <th className="px-2.5 py-2">Subject</th>
                      <th className="px-2.5 py-2 whitespace-nowrap">Date</th>
                      <th className="px-2.5 py-2 whitespace-nowrap">Time</th>
                      <th className="px-2.5 py-2 whitespace-nowrap">Duration</th>
                      <th className="px-2.5 py-2">Hall</th>
                      <th className="px-2.5 py-2 text-center whitespace-nowrap">Seat</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {(ht.subjects?.length ? ht.subjects : [ht.exam]).map((subj: any, idx: number) => (
                      <tr key={idx} className="bg-white dark:bg-slate-900/40">
                        <td className="px-2.5 py-2 text-slate-500 align-top">{idx + 1}</td>
                        <td className="px-2.5 py-2 font-mono font-semibold text-indigo-600 align-top whitespace-nowrap">{subj.subject_code || subj.subjectCode}</td>
                        <td className="px-2.5 py-2 font-medium text-slate-900 dark:text-white align-top break-words">{subj.subject_name || subj.subjectName}</td>
                        <td className="px-2.5 py-2 text-slate-600 dark:text-slate-300 align-top whitespace-nowrap">{subj.exam_date || subj.date || "—"}</td>
                        <td className="px-2.5 py-2 text-slate-600 dark:text-slate-300 align-top whitespace-nowrap">{subj.exam_time || subj.time || "—"}</td>
                        <td className="px-2.5 py-2 text-slate-600 dark:text-slate-300 align-top whitespace-nowrap">{subj.duration || ht.exam.duration || "—"}</td>
                        <td className="px-2.5 py-2 font-medium text-indigo-700 dark:text-indigo-300 align-top break-words">{subj.room || ht.exam.room || "—"}</td>
                        <td className="px-2.5 py-2 text-center font-bold text-indigo-700 dark:text-indigo-300 align-top whitespace-nowrap">{subj.seat_number || ht.seat_number || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-200 grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="h-10 border-b border-slate-400 mb-1" />
                <p className="text-[11px] font-semibold text-slate-600">Student Signature</p>
              </div>
              <div>
                <div className="h-10 border-b border-slate-400 mb-1" />
                <p className="text-[11px] font-semibold text-slate-600">Invigilator Signature</p>
              </div>
              <div>
                <div className="h-10 border-b border-slate-400 mb-1" />
                <p className="text-[11px] font-semibold text-slate-600">Principal Signature</p>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-200 flex items-end justify-between gap-4">
              <div className="text-xs text-slate-600 space-y-1">
                <p>Issued: {new Date().toLocaleDateString()}</p>
                <p className="font-semibold text-slate-800">Controller of Examinations</p>
              </div>
              <div className="flex flex-col items-center shrink-0">
                <div className="p-1.5 rounded-md border border-indigo-200 bg-indigo-50">
                  <QRCodeSVG value={ht.qr_code_content} size={88} level="H" />
                </div>
                <p className="text-[9px] text-slate-500 mt-1 font-semibold">Scan to verify</p>
              </div>
            </div>
          </div>
        </div>
      </div>
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
        const res = await fetch(`${API_BASE}/api/student/exams`, { headers: { Authorization: `Bearer ${token()}` } });
        if (res.ok) {
          const data = await res.json();
          setList(data.map((e: any) => ({
            id: `e${e.id}`,
            title: e.title || e.subject_name,
            subjectCode: e.subject_code,
            subjectName: e.subject_name,
            department: e.department,
            semester: e.semester,
            date: e.exam_date,
            time: e.exam_time,
            duration: e.duration,
            room: e.room,
            totalMarks: e.total_marks,
            subjects: (e.subjects || []).map((s: any) => ({
              subjectCode: s.subject_code,
              subjectName: s.subject_name,
              date: s.exam_date,
              time: s.exam_time,
              duration: s.duration,
            })),
          })));
        }
      } catch {}
      setLoading(false);
    })();
  }, []);
  if (loading) return <div className="p-10 text-center text-slate-500">Loading…</div>;
  return (
    <div>
      <PageHeader title="Exam Timetable" subtitle={`${list.length} scheduled examinations with per-subject timings`} />
      <div className="grid grid-cols-1 gap-4">
        {list.map((e) => {
          const subjects = e.subjects?.length
            ? e.subjects
            : [{ subjectCode: e.subjectCode, subjectName: e.subjectName, date: e.date, time: e.time, duration: e.duration }];
          return (
          <Card key={e.id} className="overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white">{e.title || e.subjectName}</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {subjects.length} subject{subjects.length === 1 ? "" : "s"} • Room {e.room} • Total marks {e.totalMarks}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-2xl font-bold text-indigo-600">{(subjects[0]?.date || e.date).split("-")[2]}</p>
                <p className="text-xs text-slate-500 uppercase">{new Date(subjects[0]?.date || e.date).toLocaleString("en", { month: "short" })}</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm table-fixed">
                <thead className="bg-slate-50 dark:bg-slate-800/50">
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-2.5 w-10">#</th>
                    <th className="px-4 py-2.5 w-24">Code</th>
                    <th className="px-4 py-2.5">Subject</th>
                    <th className="px-4 py-2.5 w-32">Date</th>
                    <th className="px-4 py-2.5 w-28">Time</th>
                    <th className="px-4 py-2.5 w-28">Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {subjects.map((s, idx) => (
                    <tr key={`${s.subjectCode}-${s.date}-${idx}`}>
                      <td className="px-4 py-2.5 text-slate-500">{idx + 1}</td>
                      <td className="px-4 py-2.5 font-mono font-semibold text-indigo-600">{s.subjectCode}</td>
                      <td className="px-4 py-2.5 font-medium text-slate-800 dark:text-slate-100">{s.subjectName}</td>
                      <td className="px-4 py-2.5">{s.date || e.date}</td>
                      <td className="px-4 py-2.5">{s.time || e.time}</td>
                      <td className="px-4 py-2.5">{s.duration || e.duration || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          );
        })}
        {list.length === 0 && <div className="p-10 text-center text-slate-500">No exams scheduled for your department</div>}
      </div>
    </div>
  );
}

// ============ FACE VERIFICATION ============
export function StudentFaceVerify() {
  const [faceEnrolled, setFaceEnrolled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"idle" | "enroll" | "verify">("idle");
  const [result, setResult] = useState<{
    verified: boolean;
    confidence: number;
    message: string;
    studentName?: string;
    rollNo?: string;
    department?: string;
  } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/student/profile`, { headers: { Authorization: `Bearer ${token()}` } });
        if (res.ok) {
          const p = await res.json();
          setFaceEnrolled(!!p.face_enrolled);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const runEnroll = async (imageBase64: string) => {
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/student/face-enroll`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ image_base64: imageBase64 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Face enrollment failed");
      setFaceEnrolled(true);
      setMode("idle");
      setResult({ verified: true, confidence: 100, message: "Face enrolled successfully. You can now verify your identity.", studentName: data.student_name });
    } catch (err: any) {
      setError(err.message || "Face enrollment failed");
    } finally {
      setBusy(false);
    }
  };

  const runVerify = async (imageBase64: string) => {
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/student/face-verify`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ image_base64: imageBase64 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok && !data.verified) throw new Error(data.detail || data.message || "Verification failed");
      setResult({
        verified: !!data.verified,
        confidence: data.confidence || 0,
        message: data.message || "",
        studentName: data.student_name,
        rollNo: data.roll_no,
        department: data.department,
      });
      // Keep camera open on verify so the next attempt doesn't remount/restart the stream
    } catch (err: any) {
      setError(err.message || "Verification failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="p-10 text-center text-slate-500">Loading…</div>;

  return (
    <div>
      <PageHeader
        title="Face Verification"
        subtitle="Enroll your face once, then verify identity before exams using your webcam"
      />

      <Card className="p-5 mb-6 bg-slate-50 dark:bg-slate-900/40">
        <h3 className="font-semibold mb-2">How it works</h3>
        <ol className="text-sm text-slate-600 dark:text-slate-300 space-y-1 list-decimal list-inside">
          <li>Upload a clear profile photo in Profile, or enroll directly from your webcam below.</li>
          <li>The system saves a numeric face template (not the raw photo) in your student record.</li>
          <li>At verification, your live webcam photo is compared to that saved template.</li>
          <li>Teachers can also verify students at exam entry using the same matching system.</li>
        </ol>
        <p className={cn("text-sm font-medium mt-3", faceEnrolled ? "text-emerald-600" : "text-amber-600")}>
          {faceEnrolled ? "✓ Face profile enrolled" : "⚠ Face profile not enrolled yet"}
        </p>
        {faceEnrolled && (
          <p className="text-xs text-slate-500 mt-2">
            If you keep seeing &quot;does not match&quot;, click <span className="font-medium">Re-enroll Face</span> once
            (webcam enroll works better than an old profile photo), then verify again.
          </p>
        )}
      </Card>

      {(error || result) && (
        <Card className={cn("p-4 mb-4", error ? "border-rose-300 bg-rose-50 dark:bg-rose-950/30" : result?.verified ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30" : "border-rose-300 bg-rose-50 dark:bg-rose-950/30")}>
          <p className={cn("text-sm font-medium", error ? "text-rose-700" : result?.verified ? "text-emerald-700" : "text-rose-700")}>
            {error || result?.message}
          </p>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="font-bold mb-4">{mode === "enroll" ? "Enroll Face" : mode === "verify" ? "Verify Face" : "Webcam"}</h3>
          {mode === "idle" ? (
            <div className="space-y-3">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Choose an action. Look straight at the camera with good lighting and a neutral background.
              </p>
              {!faceEnrolled && (
                <Button variant="primary" className="w-full" onClick={() => { setResult(null); setError(""); setMode("enroll"); }}>
                  <Camera className="w-4 h-4" /> Enroll My Face
                </Button>
              )}
              <Button variant={faceEnrolled ? "primary" : "secondary"} className="w-full" disabled={!faceEnrolled} onClick={() => { setResult(null); setError(""); setMode("verify"); }}>
                <Camera className="w-4 h-4" /> Verify My Identity
              </Button>
              {faceEnrolled && (
                <Button variant="secondary" className="w-full" onClick={() => { setResult(null); setError(""); setMode("enroll"); }}>
                  Re-enroll Face
                </Button>
              )}
            </div>
          ) : (
            <>
              <FaceCapture
                disabled={busy}
                captureLabel={busy ? "Processing…" : mode === "enroll" ? "Capture & Enroll" : "Capture & Verify"}
                onCapture={(image) => mode === "enroll" ? runEnroll(image) : runVerify(image)}
              />
              <Button variant="secondary" className="w-full mt-3" disabled={busy} onClick={() => setMode("idle")}>
                Cancel
              </Button>
            </>
          )}
        </Card>

        <Card className="p-6">
          <h3 className="font-bold mb-4">Result</h3>
          {!result ? (
            <div className="h-full min-h-[240px] flex items-center justify-center text-slate-400 text-sm">
              {mode === "idle" ? "Enroll or verify to see results" : "Capture your face to continue"}
            </div>
          ) : result.verified ? (
            <div className="p-6 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border-2 border-emerald-200 dark:border-emerald-800 text-center">
              <CheckCircle2 className="w-20 h-20 text-emerald-600 mx-auto" />
              <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-3">
                {faceEnrolled && mode === "idle" && result.confidence === 100 ? "ENROLLED" : "VERIFIED"}
              </p>
              <div className="mt-4 space-y-2 text-left">
                <div className="flex justify-between gap-3 p-3 rounded-lg bg-white dark:bg-slate-900">
                  <span className="text-sm text-slate-500">Name</span>
                  <span className="text-sm font-semibold">{result.studentName || "—"}</span>
                </div>
                <div className="flex justify-between gap-3 p-3 rounded-lg bg-white dark:bg-slate-900">
                  <span className="text-sm text-slate-500">Roll No</span>
                  <span className="text-sm font-semibold">{result.rollNo || "—"}</span>
                </div>
                <div className="flex justify-between gap-3 p-3 rounded-lg bg-white dark:bg-slate-900">
                  <span className="text-sm text-slate-500">Department</span>
                  <span className="text-sm font-semibold">{result.department || "—"}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-4">
                <div className="p-3 rounded-lg bg-white dark:bg-slate-900">
                  <p className="text-xs text-slate-500">Confidence</p>
                  <p className="text-2xl font-bold text-emerald-600">{result.confidence}%</p>
                </div>
                <div className="p-3 rounded-lg bg-white dark:bg-slate-900">
                  <p className="text-xs text-slate-500">Status</p>
                  <p className="text-2xl font-bold">✓</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6 rounded-xl bg-rose-50 dark:bg-rose-900/20 border-2 border-rose-200 dark:border-rose-800 text-center">
              <XCircle className="w-20 h-20 text-rose-600 mx-auto" />
              <p className="text-2xl font-bold text-rose-700 dark:text-rose-300 mt-3">NOT VERIFIED</p>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">{result.message}</p>
              <p className="text-xs text-slate-500 mt-3">Try better lighting, look at the camera, or re-enroll your face profile.</p>
              <div className="flex gap-2 justify-center mt-4">
                <Button variant="secondary" onClick={() => { setResult(null); setMode("verify"); }}>Try Again</Button>
                <Button variant="primary" onClick={() => { setResult(null); setMode("enroll"); }}>Re-enroll Face</Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

// ============ NOTIFICATIONS ============
export function StudentNotifications() {
  const { notifications, markRead, markAllRead, loading, refresh } = useNotifications();
  const filtered = notifications.filter((n) => n.audience === "all" || n.audience === "students");

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div>
      <PageHeader
        title="My Notifications"
        subtitle={`${filtered.filter((n) => !n.read).length} unread (live from MySQL)`}
        actions={<Button variant="secondary" onClick={markAllRead}>Mark all read</Button>}
      />
      <Card className="divide-y divide-slate-100 dark:divide-slate-800">
        {loading && !filtered.length && <div className="p-10 text-center text-slate-500">Loading…</div>}
        {!loading && filtered.length === 0 && <div className="p-10 text-center text-slate-500">No notifications</div>}
        {filtered.map((n) => (
          <div key={n.id} className="p-5 flex items-start gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/40">
            <div className={cn("w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
              n.read ? "bg-slate-100 dark:bg-slate-800" : "bg-indigo-100 dark:bg-indigo-900/40")}>
              <Mail className={cn("w-5 h-5", n.read ? "text-slate-400" : "text-indigo-600")} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                  <p className={cn("font-semibold", n.read ? "text-slate-600 dark:text-slate-300" : "text-slate-900 dark:text-white")}>{n.title}</p>
                  {n.department && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 font-medium">
                      {n.department}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 flex-shrink-0">{n.createdAt}</p>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5 whitespace-pre-wrap">{n.message}</p>
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
      const res = await fetch(`${API_BASE}/api/student/chatbot`, {
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
              <StatMini label="Internal Marks" value={`${student.internalMarks}/${INTERNAL_MARKS_MAX}`} ok={(student.internalMarks / INTERNAL_MARKS_MAX) * 100 >= 40} />
              <StatMini label="Eligibility" value={`${getStudentEligibility(student).eligibilityPct}%`} ok={getStudentEligibility(student).eligible} />
              <StatMini label="AI Score" value={getStudentEligibility(student).score} />
              <StatMini label="Backlogs" value={student.backlogs} ok={student.backlogs === 0} />
              <StatMini label="Fee Status" value={student.feePaid ? "Both paid" : "Pending"} ok={student.feePaid} />
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
  const [feeInfo, setFeeInfo] = useState<FeeInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState("");
  const [paySuccess, setPaySuccess] = useState("");
  const [activeFeeType, setActiveFeeType] = useState<"college" | "exam">("exam");
  const [selectedExamId, setSelectedExamId] = useState<number | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<"online" | "bank_transfer" | "college" | null>(null);
  const [bankReference, setBankReference] = useState("");

  const loadFees = async () => {
    const [me, fees] = await Promise.all([fetchMe(), fetchFees()]);
    setStudent(me);
    setFeeInfo(fees);
    const unpaid = (fees?.exam_fees || []).find((e) => !e.paid);
    if (unpaid) {
      setSelectedExamId(unpaid.exam_id);
      setActiveFeeType("exam");
    } else if (!(fees?.college_fee_paid)) {
      setActiveFeeType("college");
      setSelectedExamId(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadFees();
  }, []);

  const handlePay = async (method: "online" | "bank_transfer" | "college", reference = "") => {
    setPayError("");
    setPaySuccess("");
    setPaying(true);
    try {
      const unpaid = (feeInfo?.exam_fees || []).filter((e) => !e.paid && !e.payment_pending);
      const examId =
        activeFeeType === "exam"
          ? (selectedExamId || unpaid[0]?.exam_id || null)
          : null;
      if (activeFeeType === "exam" && !examId) {
        throw new Error("No unpaid exam fee found. If you already paid, refresh the page — admin may still need to approve.");
      }
      if (activeFeeType === "college" && feeInfo?.college_fee_paid) {
        throw new Error("College fee is already paid.");
      }
      if (activeFeeType === "exam" && examId && !selectedExamId) {
        setSelectedExamId(examId);
      }
      const result = await payStudentFee(method, reference, activeFeeType, examId);
      setPaySuccess(
        `${activeFeeType === "college" ? "College" : "Exam"} fee submitted. Txn: ${result.transaction_id}. Waiting for admin approval.`
      );
      setSelectedMethod(null);
      setBankReference("");
      await loadFees();
    } catch (err: any) {
      const msg = err?.message || "Payment failed";
      setPayError(msg);
      // Refresh so already-paid / pending state matches server
      if (/already paid|pending|No unpaid/i.test(msg)) {
        await loadFees();
      }
    } finally {
      setPaying(false);
    }
  };

  if (loading || !student) return <div className="p-10 text-center text-slate-500">Loading…</div>;

  const collegePaid = feeInfo?.college_fee_paid ?? student.collegeFeePaid ?? false;
  const collegeAmount = feeInfo?.college_fee_amount ?? student.collegeFeeAmount ?? 0;
  const examFees = feeInfo?.exam_fees || [];
  const unpaidExams = examFees.filter((e) => !e.paid);
  const examDue = unpaidExams.reduce((a, e) => a + Number(e.fee_amount || 0), 0);
  const totalDue = (collegePaid ? 0 : collegeAmount) + examDue;
  const paymentHistory = feeInfo?.payment_history || [];
  const bankDetails = feeInfo?.bank_details;
  const collegeOffice = feeInfo?.college_office;
  const selectedExam = examFees.find((e) => e.exam_id === selectedExamId) || unpaidExams[0] || null;
  const pendingForType =
    activeFeeType === "college"
      ? feeInfo?.pending_college
      : selectedExam?.pending_payment || null;
  const canPayActive =
    activeFeeType === "college"
      ? !collegePaid && !pendingForType
      : !!(selectedExam && !selectedExam.paid && !selectedExam.payment_pending);
  const activeAmount =
    activeFeeType === "college" ? collegeAmount : Number(selectedExam?.fee_amount || 0);

  const methodLabel = (method: string) => {
    if (method === "online") return "Online Payment";
    if (method === "bank_transfer") return "Bank Transfer";
    if (method === "college") return "College Office";
    return method;
  };

  const paymentStatusLabel = (status: string) => {
    if (status === "pending") return "Pending Verification";
    if (status === "approved") return "Approved";
    if (status === "rejected") return "Rejected";
    return status;
  };

  return (
    <div>
      <PageHeader
        title="Fee Payments"
        subtitle="Pay college fee and a separate exam fee for each scheduled examination."
      />

      {(payError || paySuccess) && (
        <Card className={cn("p-4 mb-4", payError ? "border-rose-300 bg-rose-50 dark:bg-rose-950/30" : "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30")}>
          <p className={cn("text-sm font-medium", payError ? "text-rose-700 dark:text-rose-300" : "text-emerald-700 dark:text-emerald-300")}>
            {payError || paySuccess}
          </p>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="p-5">
          <p className="text-xs text-slate-500">College Fee</p>
          <p className="text-2xl font-bold mt-1">₹{collegeAmount.toLocaleString()}</p>
          <div className="mt-2">{collegePaid ? <Badge variant="green">Paid</Badge> : feeInfo?.pending_college ? <Badge variant="indigo">Pending approval</Badge> : <Badge variant="amber">Due</Badge>}</div>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-slate-500">Unpaid Exam Fees</p>
          <p className="text-2xl font-bold mt-1">₹{examDue.toLocaleString()}</p>
          <div className="mt-2">
            {unpaidExams.length === 0
              ? <Badge variant="green">All exams paid</Badge>
              : <Badge variant="amber">{unpaidExams.length} exam(s) due</Badge>}
          </div>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-slate-500">Remaining Due</p>
          <p className="text-2xl font-bold mt-1">₹{totalDue.toLocaleString()}</p>
          <div className="mt-2">{student.feePaid ? <Badge variant="green">All clear</Badge> : <Badge variant="amber">Action needed</Badge>}</div>
        </Card>
      </div>

      {examFees.length > 0 && (
        <Card className="p-6 mb-6">
          <h3 className="font-bold text-lg mb-3">Examination Fees</h3>
          <div className="space-y-2">
            {examFees.map((row) => (
              <button
                key={row.exam_id}
                type="button"
                disabled={row.paid}
                onClick={() => {
                  setActiveFeeType("exam");
                  setSelectedExamId(row.exam_id);
                  setSelectedMethod(null);
                }}
                className={cn(
                  "w-full text-left p-4 rounded-lg border transition",
                  selectedExamId === row.exam_id && activeFeeType === "exam"
                    ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-950/30"
                    : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/40",
                  row.paid && "opacity-70 cursor-default"
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{row.title}</p>
                    <p className="text-xs text-slate-500">{row.subject_code} • {row.exam_date}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">₹{Number(row.fee_amount).toLocaleString()}</p>
                    {row.paid ? <Badge variant="green">Paid</Badge> : row.payment_pending ? <Badge variant="indigo">Pending</Badge> : <Badge variant="amber">Pay</Badge>}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </Card>
      )}

      {totalDue > 0 && (
        <Card className="p-6 mb-6">
          <div className="flex flex-wrap gap-2 mb-4">
            <Button
              variant={activeFeeType === "college" ? "primary" : "secondary"}
              disabled={collegePaid}
              onClick={() => { setActiveFeeType("college"); setSelectedMethod(null); }}
            >
              Pay College Fee
            </Button>
            <Button
              variant={activeFeeType === "exam" ? "primary" : "secondary"}
              disabled={unpaidExams.length === 0}
              onClick={() => {
                setActiveFeeType("exam");
                if (!selectedExamId && unpaidExams[0]) setSelectedExamId(unpaidExams[0].exam_id);
                setSelectedMethod(null);
              }}
            >
              Pay Exam Fee
            </Button>
          </div>

          <h3 className="font-bold text-lg mb-1">
            {activeFeeType === "college"
              ? `College Fee — ₹${activeAmount.toLocaleString()}`
              : `${selectedExam?.title || "Exam"} — ₹${activeAmount.toLocaleString()}`}
          </h3>
          <p className="text-sm text-slate-500 mb-4">
            Select a payment method. Admin must verify before the fee is marked paid.
          </p>

          {pendingForType && (
            <div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 mb-4">
              <h4 className="font-semibold text-indigo-800 dark:text-indigo-200">Verification in progress</h4>
              <p className="text-sm text-indigo-700 dark:text-indigo-300 mt-1">
                {methodLabel(pendingForType.method)} of ₹{pendingForType.amount.toLocaleString()} awaiting admin approval.
              </p>
              <p className="text-xs text-slate-500 mt-2">Txn: {pendingForType.transaction_id}</p>
            </div>
          )}

          {canPayActive && (
            <div className="space-y-2">
              <Button
                variant={selectedMethod === "online" ? "primary" : "secondary"}
                className="w-full"
                disabled={paying}
                onClick={() => setSelectedMethod(selectedMethod === "online" ? null : "online")}
              >
                <Wallet className="w-5 h-5" /> Pay Online
              </Button>
              {selectedMethod === "online" && (
                <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 space-y-3">
                  <p className="text-sm text-slate-600 dark:text-slate-400">Simulated gateway for ₹{activeAmount.toLocaleString()}.</p>
                  <Button variant="primary" className="w-full" disabled={paying} onClick={() => handlePay("online")}>
                    {paying ? "Processing…" : "Confirm Online Payment"}
                  </Button>
                </div>
              )}

              <Button
                variant={selectedMethod === "bank_transfer" ? "primary" : "secondary"}
                className="w-full"
                disabled={paying}
                onClick={() => setSelectedMethod(selectedMethod === "bank_transfer" ? null : "bank_transfer")}
              >
                Bank Transfer
              </Button>
              {selectedMethod === "bank_transfer" && bankDetails && (
                <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 space-y-3 text-sm">
                  <p><span className="font-semibold">Bank:</span> {bankDetails.bank_name}</p>
                  <p><span className="font-semibold">Account:</span> {bankDetails.account_number}</p>
                  <p><span className="font-semibold">IFSC:</span> {bankDetails.ifsc}</p>
                  <TextInput value={bankReference} onChange={(e) => setBankReference(e.target.value)} placeholder="UTR / transaction reference" />
                  <Button variant="primary" className="w-full" disabled={paying} onClick={() => handlePay("bank_transfer", bankReference)}>
                    {paying ? "Processing…" : "Confirm Bank Transfer"}
                  </Button>
                </div>
              )}

              <Button
                variant={selectedMethod === "college" ? "primary" : "secondary"}
                className="w-full"
                disabled={paying}
                onClick={() => setSelectedMethod(selectedMethod === "college" ? null : "college")}
              >
                Pay at College
              </Button>
              {selectedMethod === "college" && collegeOffice && (
                <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 space-y-3 text-sm">
                  <p><span className="font-semibold">Location:</span> {collegeOffice.location}</p>
                  <p><span className="font-semibold">Hours:</span> {collegeOffice.hours}</p>
                  <Button variant="primary" className="w-full" disabled={paying} onClick={() => handlePay("college")}>
                    {paying ? "Processing…" : "Confirm College Payment"}
                  </Button>
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {student.feePaid && (
        <Card className="p-8 mb-6 text-center border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20">
          <CheckCircle2 className="w-16 h-16 text-emerald-600 mx-auto mb-3" />
          <h3 className="text-xl font-bold text-emerald-700 dark:text-emerald-300">All Fees Paid</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">College fee and all examination fees are cleared.</p>
        </Card>
      )}

      {paymentHistory.length > 0 && (
        <Card className="p-6 mb-6">
          <h3 className="font-bold text-lg mb-4">Payment History</h3>
          <div className="space-y-3">
            {paymentHistory.map((p) => (
              <div key={p.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                <div>
                  <p className="font-semibold">
                    {(p.fee_type || "exam") === "college"
                      ? "College Fee"
                      : (p.fee_type || "") === "backlog"
                        ? (p.backlog_subject || "Backlog Fee")
                        : (p.exam_title || "Exam Fee")} · {methodLabel(p.method)}
                  </p>
                  <p className="text-xs text-slate-500">{p.transaction_id}{p.reference ? ` • ${p.reference}` : ""}</p>
                  <Badge variant={p.status === "approved" ? "green" : p.status === "rejected" ? "red" : "amber"}>
                    {paymentStatusLabel(p.status)}
                  </Badge>
                </div>
                <div className="text-right">
                  <p className="font-bold">₹{p.amount.toLocaleString()}</p>
                  <p className="text-xs text-slate-500">{p.paid_at ? new Date(p.paid_at).toLocaleString() : "—"}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="p-6">
        <h3 className="font-bold text-lg mb-4">Fee Summary</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
            <div>
              <p className="font-semibold">College Fee</p>
              <p className="text-xs text-slate-500">{collegePaid ? "Paid" : "Pending"}</p>
            </div>
            <p className="text-lg font-bold">₹{collegeAmount.toLocaleString()}</p>
          </div>
          {examFees.map((row) => (
            <div key={row.exam_id} className="flex items-center justify-between p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
              <div>
                <p className="font-semibold">{row.title}</p>
                <p className="text-xs text-slate-500">{row.paid ? "Paid" : "Pending"}</p>
              </div>
              <p className="text-lg font-bold">₹{Number(row.fee_amount).toLocaleString()}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ============ MY BACKLOGS ============
type BacklogFeeRow = {
  id: number;
  subject_code: string;
  subject_name: string;
  from_semester: number;
  exam_date?: string;
  exam_time?: string;
  status: string;
  is_cleared: boolean;
  fee_amount: number;
  paid: boolean;
  payment_pending: boolean;
  pending_payment: FeePaymentRecord | null;
  can_apply: boolean;
  can_pay: boolean;
  on_hall_ticket?: boolean;
};

export function StudentBacklogs() {
  const [rows, setRows] = useState<BacklogFeeRow[]>([]);
  const [feeAmount, setFeeAmount] = useState(1500);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [payingId, setPayingId] = useState<number | null>(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [selectedMethod, setSelectedMethod] = useState<"online" | "bank_transfer" | "college" | null>(null);
  const [payTarget, setPayTarget] = useState<number | null>(null);
  const [bankReference, setBankReference] = useState("");
  const [bankDetails, setBankDetails] = useState<FeeInfo["bank_details"] | null>(null);
  const [collegeOffice, setCollegeOffice] = useState<FeeInfo["college_office"] | null>(null);

  const reload = async () => {
    try {
      const [data, fees] = await Promise.all([
        fetch(`${API_BASE}/api/student/backlogs`, { headers: { Authorization: `Bearer ${token()}` } }).then(async (r) => {
          const j = await r.json();
          if (!r.ok) throw new Error(j.detail || "Failed to load backlogs");
          return j;
        }),
        fetchFees(),
      ]);
      setRows(data.fee_rows || []);
      setFeeAmount(Number(data.default_backlog_fee) || 1500);
      if (fees?.bank_details) setBankDetails(fees.bank_details);
      if (fees?.college_office) setCollegeOffice(fees.college_office);
    } catch (e: any) {
      setErr(e.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); }, []);

  const apply = async (id: number) => {
    setBusyId(id);
    setErr("");
    setMsg("");
    try {
      const res = await fetch(`${API_BASE}/api/student/backlogs/${id}/apply`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
        body: "{}",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Apply failed");
      setMsg(data.message || "Applied — pay the backlog fee next.");
      await reload();
    } catch (e: any) {
      setErr(e.message || "Apply failed");
    } finally {
      setBusyId(null);
    }
  };

  const pay = async (method: "online" | "bank_transfer" | "college", backlogId: number, reference = "") => {
    setPayingId(backlogId);
    setErr("");
    setMsg("");
    try {
      const result = await payStudentFee(method, reference, "backlog", null, backlogId);
      setMsg(`Backlog fee submitted. Txn: ${result.transaction_id}. Waiting for admin approval.`);
      setPayTarget(null);
      setSelectedMethod(null);
      setBankReference("");
      await reload();
    } catch (e: any) {
      setErr(e.message || "Payment failed");
    } finally {
      setPayingId(null);
    }
  };

  const statusBadge = (row: BacklogFeeRow) => {
    if (row.is_cleared || row.status === "cleared") return <Badge variant="green">Cleared</Badge>;
    if (row.status === "approved" || row.paid) return <Badge variant="green">On hall ticket</Badge>;
    if (row.payment_pending) return <Badge variant="indigo">Payment pending</Badge>;
    if (row.status === "applied") return <Badge variant="amber">Applied — pay fee</Badge>;
    return <Badge variant="slate">Open — apply to write</Badge>;
  };

  if (loading) return <div className="p-10 text-center text-slate-500">Loading…</div>;

  return (
    <div>
      <PageHeader
        title="My Backlogs"
        subtitle={`Apply for previous-year papers, pay ₹${Number(feeAmount).toLocaleString()} per paper, then admin approves for hall ticket.`}
      />
      {(err || msg) && (
        <Card className={cn("p-4 mb-4", err ? "border-rose-300 bg-rose-50" : "border-emerald-300 bg-emerald-50")}>
          <p className={cn("text-sm font-medium", err ? "text-rose-700" : "text-emerald-700")}>{err || msg}</p>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr className="text-left text-slate-600 dark:text-slate-300">
                <th className="p-4 font-medium">Subject</th>
                <th className="p-4 font-medium">From Sem</th>
                <th className="p-4 font-medium">Fee</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="p-4">
                    <p className="font-semibold">{row.subject_code}</p>
                    <p className="text-xs text-slate-500">{row.subject_name}</p>
                  </td>
                  <td className="p-4">{row.from_semester}</td>
                  <td className="p-4 font-semibold">₹{Number(row.fee_amount || feeAmount).toLocaleString()}</td>
                  <td className="p-4">{statusBadge(row)}</td>
                  <td className="p-4 text-right">
                    <div className="flex flex-col items-end gap-2">
                      {row.can_apply && (
                        <Button variant="primary" disabled={busyId === row.id} onClick={() => apply(row.id)}>
                          {busyId === row.id ? "…" : "Apply to write"}
                        </Button>
                      )}
                      {row.can_pay && (
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setPayTarget(payTarget === row.id ? null : row.id);
                            setSelectedMethod(null);
                          }}
                        >
                          Pay backlog fee
                        </Button>
                      )}
                      {payTarget === row.id && row.can_pay && (
                        <div className="w-full max-w-xs space-y-2 text-left p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                          <Button
                            variant={selectedMethod === "online" ? "primary" : "secondary"}
                            className="w-full"
                            disabled={payingId === row.id}
                            onClick={() => setSelectedMethod("online")}
                          >
                            Online
                          </Button>
                          {selectedMethod === "online" && (
                            <Button variant="primary" className="w-full" disabled={payingId === row.id} onClick={() => pay("online", row.id)}>
                              {payingId === row.id ? "Processing…" : "Confirm"}
                            </Button>
                          )}
                          <Button
                            variant={selectedMethod === "bank_transfer" ? "primary" : "secondary"}
                            className="w-full"
                            onClick={() => setSelectedMethod("bank_transfer")}
                          >
                            Bank Transfer
                          </Button>
                          {selectedMethod === "bank_transfer" && (
                            <div className="space-y-2">
                              {bankDetails && (
                                <p className="text-xs text-slate-500">{bankDetails.bank_name} · {bankDetails.account_number}</p>
                              )}
                              <TextInput value={bankReference} onChange={(e) => setBankReference(e.target.value)} placeholder="UTR reference" />
                              <Button variant="primary" className="w-full" disabled={payingId === row.id} onClick={() => pay("bank_transfer", row.id, bankReference)}>
                                Confirm
                              </Button>
                            </div>
                          )}
                          <Button
                            variant={selectedMethod === "college" ? "primary" : "secondary"}
                            className="w-full"
                            onClick={() => setSelectedMethod("college")}
                          >
                            College Office
                          </Button>
                          {selectedMethod === "college" && (
                            <div className="space-y-2">
                              {collegeOffice && <p className="text-xs text-slate-500">{collegeOffice.location}</p>}
                              <Button variant="primary" className="w-full" disabled={payingId === row.id} onClick={() => pay("college", row.id)}>
                                Confirm
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                      {!row.can_apply && !row.can_pay && !row.payment_pending && (row.status === "approved" || row.paid) && (
                        <span className="text-xs text-emerald-600">Ready for exam</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-10 text-center text-slate-500">
                    No backlog subjects on your record. If you have previous fails, ask admin to record them.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
