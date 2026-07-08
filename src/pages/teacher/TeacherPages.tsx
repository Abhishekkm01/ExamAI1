import { useState, useMemo, useEffect } from "react";
import { Card, PageHeader, StatCard, Button, Badge, TextInput, Select } from "../../components/Layout";
import { fetchTeacherStudents, getStudentEligibility } from "../../data/apiData";
import type { Student, Exam } from "../../data/types";
import { Users, BookOpen, CheckCircle2, BarChart3, ClipboardList, Camera, AlertTriangle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { cn } from "../../utils/cn";
import { FaceCapture } from "../../components/FaceCapture";

import { API_BASE } from "../../data/api";
const token = () => localStorage.getItem("examshield_token") || "";

export function TeacherDashboard() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetchTeacherStudents().then((s) => { setStudents(s); setLoading(false); }); }, []);
  if (loading) return <div className="p-10 text-center text-slate-500">Loading from MySQL…</div>;

  const csStudents = students.filter(s => s.department === "Computer Science");
  const totalStudents = csStudents.length;
  const avgAttendance = totalStudents ? Math.round(csStudents.reduce((a, s) => a + s.attendance, 0) / totalStudents) : 0;
  const avgInternals = totalStudents ? Math.round(csStudents.reduce((a, s) => a + s.internalMarks, 0) / totalStudents) : 0;

  const attendanceData = csStudents.map((s) => ({ name: s.name.split(" ")[0], attendance: s.attendance }));
  const eligible = csStudents.filter((s) => getStudentEligibility(s).eligible).length;
  const pieData = [
    { name: "Eligible", value: eligible, fill: "#10b981" },
    { name: "Not Eligible", value: totalStudents - eligible, fill: "#ef4444" },
  ];

  return (
    <div>
      <PageHeader title="Teacher Dashboard" subtitle="Prof. Sneha Rao • CS Department (live MySQL data)" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Students" value={totalStudents} icon={Users} color="indigo" delta="CS Department" />
        <StatCard label="Subjects Assigned" value={2} icon={BookOpen} color="violet" delta="CS301, CS302" />
        <StatCard label="Avg Attendance" value={`${avgAttendance}%`} icon={ClipboardList} color="emerald" delta="Last 7 days" />
        <StatCard label="Avg Internals" value={`${avgInternals}/40`} icon={BarChart3} color="amber" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card className="p-5 lg:col-span-2">
          <h3 className="font-semibold mb-1">Attendance Distribution</h3>
          <p className="text-xs text-slate-500 mb-4">Per-student attendance</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={attendanceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,.3)" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip contentStyle={{ background: "rgba(15,23,42,.9)", border: "none", borderRadius: 8, color: "#fff" }} />
                <Bar dataKey="attendance" fill="#2563eb" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-5">
          <h3 className="font-semibold mb-1">Eligibility</h3>
          <p className="text-xs text-slate-500 mb-4">Current status</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value">
                  {pieData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "rgba(15,23,42,.9)", border: "none", borderRadius: 8, color: "#fff" }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <h3 className="font-semibold mb-4">Students Requiring Attention</h3>
        <div className="space-y-3">
          {csStudents.filter(s => s.attendance < 75 || s.backlogs > 0).map((s) => (
            <div key={s.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
              <div className="flex items-center gap-3">
                <img src={s.photo} alt="" className="w-10 h-10 rounded-full bg-slate-200" />
                <div>
                  <p className="font-medium">{s.name}</p>
                  <p className="text-xs text-slate-500">{s.rollNo} • {s.department}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {s.attendance < 75 && <Badge variant="amber">Low Attendance</Badge>}
                {s.backlogs > 0 && <Badge variant="red">{s.backlogs} Backlogs</Badge>}
              </div>
            </div>
          ))}
          {csStudents.filter(s => s.attendance < 75 || s.backlogs > 0).length === 0 && (
            <p className="text-center text-slate-500 py-6">All students are in good standing 🎉</p>
          )}
        </div>
      </Card>
    </div>
  );
}

export function TeacherAttendance() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [subject, setSubject] = useState("CS301");
  const [subjects, setSubjects] = useState<string[]>(["CS301", "CS302"]);
  const [department, setDepartment] = useState("");
  const [students, setStudents] = useState<Array<Student & { todayStatus?: string | null }>>([]);
  const [records, setRecords] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadRoll = async (sub = subject, d = date) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${API_BASE}/api/teacher/attendance?subject_code=${encodeURIComponent(sub)}&date=${encodeURIComponent(d)}`,
        { headers: { Authorization: `Bearer ${token()}` } }
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.detail || `Failed to load roll (${res.status})`);
      }
      const data = await res.json();
      const list = (data.students || []).map((s: any) => ({
        id: `s${s.id}`,
        rollNo: s.roll_no,
        name: s.name,
        email: "",
        mobile: "",
        department: s.department,
        semester: 0,
        section: "",
        photo: s.photo,
        attendance: s.attendance_percentage,
        internalMarks: 0,
        assignmentMarks: 0,
        previousResult: 0,
        backlogs: 0,
        feePaid: true,
        feeAmount: 0,
        feeDueDate: "",
        createdAt: "",
        todayStatus: s.today_status,
      }));
      setStudents(list);
      setDepartment(data.department || "");
      if (Array.isArray(data.subjects) && data.subjects.length) setSubjects(data.subjects);
      setRecords(Object.fromEntries(list.map((s) => [
        s.id,
        s.todayStatus ? s.todayStatus === "Present" : true,
      ])));
    } catch (e: any) {
      setError(e.message || "Failed to load attendance roll");
      setStudents([]);
      setRecords({});
    }
    setLoading(false);
  };

  useEffect(() => { loadRoll(subject, date); }, [subject, date]);

  if (loading && students.length === 0) return <div className="p-10 text-center text-slate-500">Loading attendance roll…</div>;

  const present = Object.values(records).filter(Boolean).length;

  const save = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const numericRecords: Record<string, boolean> = {};
      for (const [id, val] of Object.entries(records)) {
        numericRecords[id.replace(/^s/, "")] = val;
      }
      const res = await fetch(`${API_BASE}/api/teacher/attendance/mark`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ subject_code: subject, date, records: numericRecords }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.detail || "Failed to save attendance");
      setMessage(j.message || "Attendance saved to MySQL");
      await loadRoll(subject, date);
    } catch (e: any) {
      setError(e.message || "Backend not reachable");
    }
    setSaving(false);
  };

  return (
    <div>
      <PageHeader
        title="Attendance Management"
        subtitle={department ? `Mark attendance for ${department} students` : "Mark attendance for your classes"}
      />

      {(message || error) && (
        <div className={cn("mb-4 p-3 rounded-lg text-sm", error ? "bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300")}>
          {error || message}
        </div>
      )}

      <Card className="p-5 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1 text-slate-600 dark:text-slate-400">Date</label>
            <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1 text-slate-600 dark:text-slate-400">Subject</label>
            <Select value={subject} onChange={(e) => setSubject(e.target.value)}>
              {subjects.map((code) => (
                <option key={code} value={code}>{code}</option>
              ))}
            </Select>
          </div>
          <div className="flex items-end gap-2">
            <Button variant="primary" className="flex-1" onClick={save} disabled={saving || students.length === 0}>
              <CheckCircle2 className="w-4 h-4" /> {saving ? "Saving..." : "Save Attendance"}
            </Button>
            <Button variant="secondary" onClick={() => setRecords(Object.fromEntries(students.map((x) => [x.id, true])))}>All Present</Button>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 grid grid-cols-3 gap-4 text-center">
          <div><p className="text-xs text-slate-500">Present today</p><p className="text-2xl font-bold text-emerald-600">{present}</p></div>
          <div><p className="text-xs text-slate-500">Absent today</p><p className="text-2xl font-bold text-rose-600">{students.length - present}</p></div>
          <div><p className="text-xs text-slate-500">Session %</p><p className="text-2xl font-bold text-indigo-600">{students.length ? Math.round((present / students.length) * 100) : 0}%</p></div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h3 className="font-semibold">Class Roll: {subject}</h3>
          <p className="text-xs text-slate-500">{students.length} students</p>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {students.map((s) => {
            const isPresent = records[s.id];
            return (
              <div key={s.id} className="flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <div className="flex items-center gap-3">
                  <img src={s.photo} alt="" className="w-10 h-10 rounded-full bg-slate-200" />
                  <div>
                    <p className="font-medium">{s.name}</p>
                    <p className="text-xs text-slate-500">{s.rollNo} • Overall: {s.attendance}%</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {s.todayStatus && (
                    <span className="text-[10px] text-slate-400 mr-2">Saved: {s.todayStatus}</span>
                  )}
                  <button onClick={() => setRecords({ ...records, [s.id]: true })}
                    className={cn("px-4 py-1.5 rounded-lg text-sm font-medium",
                      isPresent ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-slate-100 text-slate-500 dark:bg-slate-800")}>Present</button>
                  <button onClick={() => setRecords({ ...records, [s.id]: false })}
                    className={cn("px-4 py-1.5 rounded-lg text-sm font-medium",
                      !isPresent ? "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300" : "bg-slate-100 text-slate-500 dark:bg-slate-800")}>Absent</button>
                </div>
              </div>
            );
          })}
          {students.length === 0 && (
            <div className="p-10 text-center text-slate-500">No students found for your department</div>
          )}
        </div>
      </Card>
    </div>
  );
}

export function TeacherMarks() {
  const [subject, setSubject] = useState("CS301");
  const [subjects, setSubjects] = useState<string[]>(["CS301", "CS302"]);
  const [department, setDepartment] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [marks, setMarks] = useState<Record<string, { internal: number; assignment: number }>>({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadMarks = async (sub = subject) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${API_BASE}/api/teacher/marks?subject_code=${encodeURIComponent(sub)}`,
        { headers: { Authorization: `Bearer ${token()}` } }
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.detail || `Failed to load marks (${res.status})`);
      }
      const data = await res.json();
      const list = (data.students || []).map((s: any) => ({
        id: `s${s.id}`,
        rollNo: s.roll_no,
        name: s.name,
        email: "",
        mobile: "",
        department: s.department,
        semester: 0,
        section: "",
        photo: s.photo,
        attendance: 0,
        internalMarks: s.internal_marks,
        assignmentMarks: s.assignment_marks,
        previousResult: 0,
        backlogs: 0,
        feePaid: true,
        feeAmount: 0,
        feeDueDate: "",
        createdAt: "",
      }));
      setStudents(list);
      setDepartment(data.department || "");
      if (Array.isArray(data.subjects) && data.subjects.length) setSubjects(data.subjects);
      setMarks(Object.fromEntries(list.map((s) => [
        s.id,
        { internal: s.internalMarks, assignment: s.assignmentMarks },
      ])));
    } catch (e: any) {
      setError(e.message || "Failed to load marks");
      setStudents([]);
      setMarks({});
    }
    setLoading(false);
  };

  useEffect(() => { loadMarks(subject); }, [subject]);

  const filtered = students.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.rollNo.toLowerCase().includes(search.toLowerCase())
  );

  const saveMarks = async (studentId: string) => {
    const m = marks[studentId];
    if (!m) return;
    setSavingId(studentId);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`${API_BASE}/api/teacher/marks/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({
          student_id: parseInt(studentId.replace(/^s/, ""), 10),
          subject_code: subject,
          internal_marks: m.internal,
          assignment_marks: m.assignment,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.detail || Object.values(j).flat().join(" ") || "Failed to save marks");
      setMessage(`Marks saved for ${students.find((s) => s.id === studentId)?.name || "student"}`);
      await loadMarks(subject);
    } catch (e: any) {
      setError(e.message || "Failed to save marks");
    }
    setSavingId(null);
  };

  if (loading && students.length === 0) return <div className="p-10 text-center text-slate-500">Loading marks…</div>;

  return (
    <div>
      <PageHeader
        title="Internal Marks"
        subtitle={department ? `Enter marks for ${department} students` : "Enter and manage internal marks"}
      />

      {(message || error) && (
        <div className={cn("mb-4 p-3 rounded-lg text-sm", error ? "bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300")}>
          {error || message}
        </div>
      )}

      <Card className="p-5 mb-6">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <TextInput placeholder="Search student..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={subject} onChange={(e) => setSubject(e.target.value)} className="md:w-56">
            {subjects.map((code) => (
              <option key={code} value={code}>{code}</option>
            ))}
          </Select>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr className="text-left text-slate-600 dark:text-slate-300">
                <th className="p-4 font-medium">Student</th>
                <th className="p-4 font-medium">Internal /40</th>
                <th className="p-4 font-medium">Assignment /10</th>
                <th className="p-4 font-medium">Total /50</th>
                <th className="p-4 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map((s) => {
                const m = marks[s.id] || { internal: 0, assignment: 0 };
                return (
                  <tr key={s.id}>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <img src={s.photo} alt="" className="w-8 h-8 rounded-full" />
                        <div><p className="font-medium">{s.name}</p><p className="text-xs text-slate-500">{s.rollNo}</p></div>
                      </div>
                    </td>
                    <td className="p-4">
                      <input
                        type="number"
                        min={0}
                        max={40}
                        step={0.5}
                        value={m.internal}
                        onChange={(e) => setMarks({ ...marks, [s.id]: { ...m, internal: +e.target.value } })}
                        className="w-20 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                      />
                    </td>
                    <td className="p-4">
                      <input
                        type="number"
                        min={0}
                        max={10}
                        step={0.5}
                        value={m.assignment}
                        onChange={(e) => setMarks({ ...marks, [s.id]: { ...m, assignment: +e.target.value } })}
                        className="w-20 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                      />
                    </td>
                    <td className="p-4 font-semibold">{m.internal + m.assignment}/50</td>
                    <td className="p-4 text-right">
                      <Button variant="primary" disabled={savingId === s.id} onClick={() => saveMarks(s.id)}>
                        <CheckCircle2 className="w-3.5 h-3.5" /> {savingId === s.id ? "Saving…" : "Save"}
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="p-10 text-center text-slate-500">No students found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export function TeacherStudents() {
  const [students, setStudents] = useState<Student[]>([]);
  const [filter, setFilter] = useState<"all" | "at-risk">("all");
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetchTeacherStudents().then((s) => { setStudents(s.filter(x => x.department === "Computer Science")); setLoading(false); }); }, []);
  if (loading) return <div className="p-10 text-center text-slate-500">Loading…</div>;

  const list = students.map((s) => ({ s, e: getStudentEligibility(s) }));
  const filtered = list.filter(({ e }) => filter === "all" || !e.eligible);

  return (
    <div>
      <PageHeader title="Student Monitoring" subtitle="Track attendance, marks and eligibility (live from MySQL)"
        actions={
          <div className="flex gap-2">
            {(["all", "at-risk"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className={cn("px-4 py-2 rounded-lg text-sm font-medium capitalize",
                  filter === f ? "bg-indigo-600 text-white" : "bg-slate-100 dark:bg-slate-800")}>{f}</button>
            ))}
          </div>
        }
      />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(({ s, e }) => (
          <Card key={s.id} className="p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-4">
              <img src={s.photo} alt="" className="w-14 h-14 rounded-full bg-slate-200" />
              <div>
                <p className="font-bold">{s.name}</p>
                <p className="text-xs text-slate-500">{s.rollNo}</p>
                {e.eligible ? <Badge variant="green">Eligible</Badge> : <Badge variant="red">At Risk</Badge>}
              </div>
            </div>
            <div className="space-y-3">
              <ProgressRow label="Attendance" value={s.attendance} threshold={75} />
              <ProgressRow label="Internals" value={(s.internalMarks / 40) * 100} threshold={40} unit="/40" raw={s.internalMarks} />
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded bg-slate-50 dark:bg-slate-800"><p className="text-slate-500">SGPA</p><p className="font-bold">{s.previousResult}</p></div>
                <div className="p-2 rounded bg-slate-50 dark:bg-slate-800"><p className="text-slate-500">Backlogs</p><p className={cn("font-bold", s.backlogs > 0 ? "text-rose-600" : "text-emerald-600")}>{s.backlogs}</p></div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function ProgressRow({ label, value, threshold, unit = "%", raw }: { label: string; value: number; threshold: number; unit?: string; raw?: number }) {
  const ok = value >= threshold;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-slate-500">{label}</span>
        <span className={cn("font-semibold", ok ? "text-emerald-600" : "text-rose-600")}>
          {raw !== undefined ? `${raw}${unit}` : `${Math.round(value)}${unit}`}
        </span>
      </div>
      <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full", ok ? "bg-emerald-500" : "bg-rose-500")} style={{ width: `${Math.min(100, value)}%` }} />
      </div>
    </div>
  );
}

export function TeacherFaceVerify() {
  const [capturing, setCapturing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    matched: boolean;
    confidence: number;
    name: string;
    rollNo?: string;
    photo?: string;
    message?: string;
  } | null>(null);

  const verifyCapture = async (imageBase64: string) => {
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/teacher/face-verify`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ image_base64: imageBase64 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok && !data.verified) throw new Error(data.detail || data.message || "Verification failed");
      setResult({
        matched: !!data.verified,
        confidence: data.confidence || 0,
        name: data.student_name || "Unknown",
        rollNo: data.roll_no,
        photo: data.photo,
        message: data.message,
      });
      setCapturing(false);
    } catch (err: any) {
      setError(err.message || "Verification failed");
      setCapturing(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader title="Face Verification" subtitle="Verify students at exam entry using live face matching" />

      <Card className="p-5 mb-6 bg-slate-50 dark:bg-slate-900/40">
        <h3 className="font-semibold mb-2">How it works</h3>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Students must enroll their face from profile photo or the student Face Verification page.
          Capture the student&apos;s live face here and the system will match them against enrolled students in your department.
        </p>
      </Card>

      {error && (
        <Card className="p-4 mb-4 border-rose-300 bg-rose-50 dark:bg-rose-950/30">
          <p className="text-sm font-medium text-rose-700 dark:text-rose-300">{error}</p>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="font-bold mb-4">Live Capture</h3>
          {!capturing ? (
            <div className="space-y-4">
              <div className="aspect-video rounded-xl bg-slate-900 flex items-center justify-center">
                <div className="text-center">
                  <Camera className="w-16 h-16 text-slate-500 mx-auto" />
                  <p className="text-slate-400 mt-4">Open camera to verify a student</p>
                </div>
              </div>
              <Button variant="primary" className="w-full" onClick={() => { setCapturing(true); setResult(null); setError(""); }}>
                <Camera className="w-4 h-4" /> Open Camera
              </Button>
            </div>
          ) : (
            <>
              <FaceCapture
                disabled={busy}
                captureLabel={busy ? "Matching…" : "Capture & Verify Student"}
                onCapture={verifyCapture}
              />
              <Button variant="secondary" className="w-full mt-3" disabled={busy} onClick={() => setCapturing(false)}>
                Close Camera
              </Button>
            </>
          )}
        </Card>

        <Card className="p-6">
          <h3 className="font-bold mb-4">Verification Result</h3>
          {!result ? (
            <div className="h-full min-h-[240px] flex items-center justify-center text-slate-400 text-sm">
              Capture a student face to see the match result
            </div>
          ) : (
            <div className={cn("p-6 rounded-xl border-2",
              result.matched ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800" : "bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800")}>
              <div className="flex items-center gap-4 mb-4">
                {result.photo ? (
                  <img src={result.photo} alt="" className="w-16 h-16 rounded-full object-cover border-2 border-white" />
                ) : result.matched ? (
                  <CheckCircle2 className="w-16 h-16 text-emerald-600" />
                ) : (
                  <AlertTriangle className="w-16 h-16 text-rose-600" />
                )}
                <div>
                  <p className={cn("text-2xl font-bold", result.matched ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300")}>
                    {result.matched ? "VERIFIED" : "NOT VERIFIED"}
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                    {result.matched ? `${result.name}${result.rollNo ? ` • ${result.rollNo}` : ""}` : result.message || "No match found in your department"}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-white dark:bg-slate-900">
                  <p className="text-xs text-slate-500">Confidence</p>
                  <p className="text-2xl font-bold text-indigo-600">{result.confidence}%</p>
                </div>
                <div className="p-3 rounded-lg bg-white dark:bg-slate-900">
                  <p className="text-xs text-slate-500">Status</p>
                  <p className="text-2xl font-bold">{result.matched ? "✓" : "✗"}</p>
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
