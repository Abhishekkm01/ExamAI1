import { useState, useMemo, useEffect } from "react";
import { Card, PageHeader, StatCard, Button, Badge, TextInput, Select } from "../../components/Layout";
import { Pagination } from "../../components/Pagination";
import { useClientPagination } from "../../hooks/useClientPagination";
import { fetchHodStudents, fetchHodTeachers, fetchHodExams, getStudentEligibility } from "../../data/apiData";
import { api, downloadHodReport, API_BASE } from "../../data/api";
import { notifyNotificationsUpdated } from "../../contexts/AppContext";
import type { Student, Teacher, Exam } from "../../data/types";
import {
  Users, BookOpen, CheckCircle2, BarChart3, ClipboardList, AlertTriangle,
  GraduationCap, Wallet, Mail, Edit2, X, Save, FileText, TicketCheck,
  Calendar, Clock, MapPin, Plus, Trash2,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { INTERNAL_MARKS_MAX, ASSIGNMENT_MARKS_MAX } from "../../data/marksConstants";
import { cleanNotificationMessage, formatNotificationAudience, parseNotificationTitle } from "../../utils/notifications";
import { cn } from "../../utils/cn";

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const token = () => localStorage.getItem("examshield_token") || "";

type HodClassSlot = {
  id: number;
  teacher_id: number;
  teacher_name: string;
  subject_code: string;
  subject_name: string;
  day_of_week: number;
  day_name: string;
  start_time: string;
  end_time: string;
  room: string;
  semester: number;
  section: string;
  department: string;
};

type HodTeacherOption = {
  id: number;
  name: string;
  emp_id: string;
  assigned_subjects: string[];
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{label}</label>
      {children}
    </div>
  );
}

export function HodDashboard() {
  const [dash, setDash] = useState<any>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.hodDashboard(), fetchHodStudents()])
      .then(([d, s]) => {
        setDash(d);
        setStudents(s);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message || "Failed to load HOD dashboard");
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="p-10 text-center text-slate-500">Loading department dashboard…</div>;

  const dept = dash?.department || students[0]?.department || "Department";
  const total = dash?.total_students ?? students.length;
  const eligible = dash?.eligible_count ?? students.filter((s) => getStudentEligibility(s).eligible).length;
  const pieData = [
    { name: "Eligible", value: eligible, fill: "#10b981" },
    { name: "Not Eligible", value: Math.max(0, (dash?.ineligible_count ?? total - eligible)), fill: "#ef4444" },
  ];
  const attendanceData = students.slice(0, 20).map((s) => ({
    name: s.name.split(" ")[0],
    attendance: s.attendance,
  }));

  return (
    <div>
      <PageHeader
        title="HOD Dashboard"
        subtitle={`${dept} • Department academic overview`}
      />
      {error && (
        <div className="mb-4 p-3 rounded-lg text-sm bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300">{error}</div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Students" value={total} icon={GraduationCap} color="indigo" delta={dept} />
        <StatCard label="Teachers" value={dash?.total_teachers ?? "—"} icon={Users} color="violet" />
        <StatCard label="Avg Attendance" value={`${dash?.avg_attendance ?? 0}%`} icon={ClipboardList} color="emerald" />
        <StatCard label="Avg Internals" value={`${dash?.avg_internals ?? 0}/${INTERNAL_MARKS_MAX}`} icon={BarChart3} color="amber" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Eligible" value={eligible} icon={CheckCircle2} color="emerald" />
        <StatCard label="Backlogs" value={dash?.backlog_students ?? 0} icon={AlertTriangle} color="rose" />
        <StatCard label="Fee Pending" value={dash?.fee_pending ?? 0} icon={Wallet} color="amber" delta="Read-only" />
        <StatCard label="Dept Exams" value={dash?.total_exams ?? 0} icon={BookOpen} color="sky" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card className="p-5 lg:col-span-2">
          <h3 className="font-semibold mb-1">Attendance Distribution</h3>
          <p className="text-xs text-slate-500 mb-4">Department students</p>
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
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {pieData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500" /> Students Requiring Attention
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200 dark:border-slate-800">
                <th className="pb-2 font-medium">Roll No</th>
                <th className="pb-2 font-medium">Name</th>
                <th className="pb-2 font-medium">Attendance</th>
                <th className="pb-2 font-medium">Backlogs</th>
                <th className="pb-2 font-medium">Risk</th>
                <th className="pb-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {(dash?.students_requiring_attention || []).map((s: any) => (
                <tr key={s.id} className="border-b border-slate-100 dark:border-slate-800/50">
                  <td className="py-2.5">{s.roll_no}</td>
                  <td className="py-2.5">{s.name}</td>
                  <td className="py-2.5">{s.attendance}%</td>
                  <td className="py-2.5">{s.backlogs}</td>
                  <td className="py-2.5">{Number(s.ai_risk_score || 0).toFixed(2)}</td>
                  <td className="py-2.5">
                    <Badge variant={s.is_eligible ? "green" : "red"}>
                      {s.is_eligible ? "Eligible" : "At Risk"}
                    </Badge>
                  </td>
                </tr>
              ))}
              {!(dash?.students_requiring_attention || []).length && (
                <tr><td colSpan={6} className="py-8 text-center text-slate-500">No at-risk students</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export function HodStudents() {
  const [list, setList] = useState<Student[]>([]);
  const [search, setSearch] = useState("");
  const [semester, setSemester] = useState("all");
  const [editing, setEditing] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = () => fetchHodStudents().then((s) => { setList(s); setLoading(false); });
  useEffect(() => { reload(); }, []);

  const filtered = useMemo(() => list.filter((s) =>
    (semester === "all" || String(s.semester) === semester) &&
    (s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.rollNo.toLowerCase().includes(search.toLowerCase()))
  ), [list, search, semester]);
  const { page, setPage, pageSize, setPageSize, totalPages, total, paged } = useClientPagination(filtered, 10);

  if (loading) return <div className="p-10 text-center text-slate-500">Loading students…</div>;

  return (
    <div>
      <PageHeader
        title="Department Students"
        subtitle="Monitor academics — create/delete remains with Admin"
      />
      <div className="flex flex-wrap gap-3 mb-4">
        <TextInput value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search name or roll…" className="max-w-xs" />
        <Select value={semester} onChange={(e) => { setSemester(e.target.value); setPage(1); }} className="w-40">
          <option value="all">All Semesters</option>
          {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => <option key={n} value={String(n)}>Sem {n}</option>)}
        </Select>
      </div>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr className="text-left text-slate-500">
                <th className="p-4 font-medium">Roll No</th>
                <th className="p-4 font-medium">Name</th>
                <th className="p-4 font-medium">Sem</th>
                <th className="p-4 font-medium">Attendance</th>
                <th className="p-4 font-medium">Internals</th>
                <th className="p-4 font-medium">Backlogs</th>
                <th className="p-4 font-medium">Fee</th>
                <th className="p-4 font-medium">Eligible</th>
                <th className="p-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((s) => {
                const el = getStudentEligibility(s);
                return (
                  <tr key={s.id} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="p-4">{s.rollNo}</td>
                    <td className="p-4 font-medium">{s.name}</td>
                    <td className="p-4">{s.semester}</td>
                    <td className="p-4">{s.attendance}%</td>
                    <td className="p-4">{s.internalMarks}/{INTERNAL_MARKS_MAX}</td>
                    <td className="p-4">{s.backlogs}</td>
                    <td className="p-4">
                      <Badge variant={s.feePaid ? "green" : "amber"}>{s.feePaid ? "Paid" : "Pending"}</Badge>
                    </td>
                    <td className="p-4">
                      <Badge variant={el.eligible ? "green" : "red"}>{el.eligible ? "Yes" : "No"}</Badge>
                    </td>
                    <td className="p-4">
                      <button onClick={() => setEditing(s)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800" title="Update academics">
                        <Edit2 className="w-4 h-4 text-slate-500" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!filtered.length && (
                <tr><td colSpan={9} className="p-10 text-center text-slate-500">No students found</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
      </Card>
      {editing && (
        <HodStudentAcademicModal
          student={editing}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            setList((l) => l.map((x) => x.id === updated.id ? updated : x));
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function HodStudentAcademicModal({
  student, onClose, onSaved,
}: {
  student: Student;
  onClose: () => void;
  onSaved: (s: Student) => void;
}) {
  const [form, setForm] = useState({
    attendance_percentage: student.attendance,
    internal_marks: student.internalMarks,
    assignment_marks: student.assignmentMarks,
    previous_result: student.previousResult,
    backlogs: student.backlogs,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const sid = Number(student.id.replace(/^s/, ""));

  const save = async () => {
    setSaving(true);
    setErr(null);
    try {
      const data = await api.hodUpdateStudent(sid, form);
      onSaved({
        ...student,
        attendance: data.attendance,
        internalMarks: data.internal_marks,
        assignmentMarks: data.assignment_marks,
        previousResult: data.previous_result,
        backlogs: data.backlogs,
        feePaid: data.fee_paid,
      });
    } catch (e: any) {
      setErr(e.message || "Failed to update");
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <Card className="w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg">Update Academics — {student.name}</h3>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <p className="text-xs text-slate-500 mb-4">HOD may update academic fields only. Fees and account creation are Admin-only.</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Attendance %">
            <TextInput type="number" value={form.attendance_percentage} onChange={(e) => setForm({ ...form, attendance_percentage: Number(e.target.value) })} />
          </Field>
          <Field label={`Internal /${INTERNAL_MARKS_MAX}`}>
            <TextInput type="number" value={form.internal_marks} onChange={(e) => setForm({ ...form, internal_marks: Number(e.target.value) })} />
          </Field>
          <Field label={`Assignment /${ASSIGNMENT_MARKS_MAX}`}>
            <TextInput type="number" value={form.assignment_marks} onChange={(e) => setForm({ ...form, assignment_marks: Number(e.target.value) })} />
          </Field>
          <Field label="Previous Result (SGPA)">
            <TextInput type="number" value={form.previous_result} onChange={(e) => setForm({ ...form, previous_result: Number(e.target.value) })} />
          </Field>
          <Field label="Backlogs">
            <TextInput type="number" value={form.backlogs} onChange={(e) => setForm({ ...form, backlogs: Number(e.target.value) })} />
          </Field>
        </div>
        {err && <p className="mt-3 text-sm text-rose-600">{err}</p>}
        <div className="flex justify-end gap-2 mt-5">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={saving}><Save className="w-4 h-4" /> {saving ? "Saving…" : "Save"}</Button>
        </div>
      </Card>
    </div>
  );
}

export function HodTeachers() {
  const [list, setList] = useState<Teacher[]>([]);
  const [editing, setEditing] = useState<Teacher | null>(null);
  const [loading, setLoading] = useState(true);
  const { page, setPage, pageSize, setPageSize, totalPages, total, paged } = useClientPagination(list, 9);

  useEffect(() => {
    fetchHodTeachers().then((t) => { setList(t); setLoading(false); });
  }, []);

  if (loading) return <div className="p-10 text-center text-slate-500">Loading faculty…</div>;

  return (
    <div>
      <PageHeader
        title="Department Faculty"
        subtitle="View teachers and assign subjects — create/delete is Admin-only"
      />
      <Card className="overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-5">
          {paged.map((t) => (
            <div key={t.id} className="p-5 rounded-xl border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3 mb-3">
                <img src={t.photo || `https://api.dicebear.com/7.x/avataaars/svg?seed=${t.empId}`} alt="" className="w-12 h-12 rounded-full bg-slate-200" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold">{t.name}</p>
                  <p className="text-xs text-slate-500">{t.empId}</p>
                </div>
                <button onClick={() => setEditing(t)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800" title="Assign subjects">
                  <Edit2 className="w-4 h-4 text-slate-500" />
                </button>
              </div>
              <p className="text-xs text-slate-500 mb-2">{t.email}</p>
              <div className="flex flex-wrap gap-1">
                {t.subjects.map((s) => <Badge key={s} variant="indigo">{s}</Badge>)}
                {!t.subjects.length && <span className="text-xs text-slate-400">No subjects assigned</span>}
              </div>
            </div>
          ))}
          {!list.length && <div className="col-span-3 p-10 text-center text-slate-500">No teachers in this department</div>}
        </div>
        <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
      </Card>
      {editing && (
        <HodSubjectsModal
          teacher={editing}
          onClose={() => setEditing(null)}
          onSaved={(t) => {
            setList((l) => l.map((x) => x.id === t.id ? t : x));
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function HodSubjectsModal({
  teacher, onClose, onSaved,
}: {
  teacher: Teacher;
  onClose: () => void;
  onSaved: (t: Teacher) => void;
}) {
  const [subjects, setSubjects] = useState(teacher.subjects.join(","));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const tid = Number(teacher.id.replace(/^t/, ""));

  const save = async () => {
    setSaving(true);
    setErr(null);
    try {
      const data = await api.hodUpdateTeacherSubjects(tid, subjects);
      onSaved({
        ...teacher,
        subjects: data.assigned_subjects || [],
      });
    } catch (e: any) {
      setErr(e.message || "Failed to update subjects");
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <Card className="w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold">Assign Subjects — {teacher.name}</h3>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <Field label="Subjects (comma-separated)">
          <TextInput value={subjects} onChange={(e) => setSubjects(e.target.value)} placeholder="CS301,CS302" />
        </Field>
        {err && <p className="mt-3 text-sm text-rose-600">{err}</p>}
        <div className="flex justify-end gap-2 mt-5">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={saving}>Save</Button>
        </div>
      </Card>
    </div>
  );
}

export function HodTimetable() {
  const [slots, setSlots] = useState<HodClassSlot[]>([]);
  const [teachers, setTeachers] = useState<HodTeacherOption[]>([]);
  const [department, setDepartment] = useState("");
  const [teacherFilter, setTeacherFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    teacher_id: "",
    subject_code: "",
    subject_name: "",
    day_of_week: 0,
    start_time: "09:00",
    end_time: "10:00",
    room: "",
    semester: 5,
    section: "A",
  });

  const selectedTeacher = teachers.find((t) => String(t.id) === form.teacher_id);
  const subjectOptions = selectedTeacher?.assigned_subjects?.length
    ? selectedTeacher.assigned_subjects
    : [];

  const load = async (tid = teacherFilter) => {
    setLoading(true);
    setError(null);
    try {
      const q = tid !== "all" ? `?teacher_id=${tid}` : "";
      const res = await fetch(`${API_BASE}/api/hod/timetable${q}`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.detail || "Failed to load timetable");
      }
      const data = await res.json();
      setSlots(data.slots || []);
      setTeachers(data.teachers || []);
      setDepartment(data.department || "");
      if (!form.teacher_id && (data.teachers || [])[0]) {
        setForm((f) => ({
          ...f,
          teacher_id: String(data.teachers[0].id),
          subject_code: (data.teachers[0].assigned_subjects || [])[0] || "",
        }));
      }
    } catch (e: any) {
      setError(e.message || "Failed to load timetable");
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filteredSlots = useMemo(
    () => teacherFilter === "all" ? slots : slots.filter((s) => String(s.teacher_id) === teacherFilter),
    [slots, teacherFilter],
  );

  const byDay = useMemo(() => {
    return DAY_NAMES.map((name, day) => ({
      day,
      name,
      slots: filteredSlots.filter((s) => s.day_of_week === day),
    }));
  }, [filteredSlots]);

  const addSlot = async () => {
    if (!form.teacher_id) {
      setError("Select a teacher");
      return;
    }
    if (!form.subject_code.trim()) {
      setError("Subject code is required");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`${API_BASE}/api/hod/timetable`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({
          teacher_id: Number(form.teacher_id),
          subject_code: form.subject_code.trim().toUpperCase(),
          subject_name: form.subject_name,
          day_of_week: form.day_of_week,
          start_time: form.start_time,
          end_time: form.end_time,
          room: form.room,
          semester: form.semester,
          section: form.section,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = j.detail || (j.end_time && j.end_time[0]) || "Failed to assign class";
        throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
      }
      setMessage(`Class assigned to ${j.teacher_name || "teacher"}`);
      setForm((f) => ({ ...f, subject_name: "", room: "" }));
      await load(teacherFilter);
    } catch (e: any) {
      setError(e.message || "Failed to assign class");
    }
    setBusy(false);
  };

  const removeSlot = async (id: number) => {
    if (!confirm("Remove this class slot from the teacher timetable?")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/hod/timetable/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (!res.ok && res.status !== 204) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.detail || "Failed to delete");
      }
      setMessage("Class slot removed");
      await load(teacherFilter);
    } catch (e: any) {
      setError(e.message || "Failed to delete");
    }
    setBusy(false);
  };

  if (loading) return <div className="p-10 text-center text-slate-500">Loading class timetable…</div>;

  return (
    <div>
      <PageHeader
        title="Class Timetable"
        subtitle={department ? `Assign weekly classes to faculty • ${department}` : "Assign weekly classes to faculty"}
      />

      {(message || error) && (
        <div className={cn("mb-4 p-3 rounded-lg text-sm", error ? "bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300")}>
          {error || message}
        </div>
      )}

      <Card className="p-5 mb-6">
        <h3 className="font-semibold mb-3 flex items-center gap-2"><Plus className="w-4 h-4" /> Assign Class Slot</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Teacher</label>
            <Select
              value={form.teacher_id}
              onChange={(e) => {
                const tid = e.target.value;
                const t = teachers.find((x) => String(x.id) === tid);
                setForm({
                  ...form,
                  teacher_id: tid,
                  subject_code: (t?.assigned_subjects || [])[0] || form.subject_code,
                });
              }}
            >
              <option value="">Select teacher</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>{t.name} ({t.emp_id})</option>
              ))}
            </Select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Subject</label>
            {subjectOptions.length ? (
              <Select value={form.subject_code} onChange={(e) => setForm({ ...form, subject_code: e.target.value })}>
                {subjectOptions.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            ) : (
              <TextInput value={form.subject_code} onChange={(e) => setForm({ ...form, subject_code: e.target.value })} placeholder="e.g. CS301" />
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Subject Name</label>
            <TextInput value={form.subject_name} onChange={(e) => setForm({ ...form, subject_name: e.target.value })} placeholder="Optional" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Day</label>
            <Select value={String(form.day_of_week)} onChange={(e) => setForm({ ...form, day_of_week: +e.target.value })}>
              {DAY_NAMES.map((d, i) => <option key={d} value={i}>{d}</option>)}
            </Select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Start</label>
            <TextInput type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">End</label>
            <TextInput type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Room</label>
            <TextInput value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} placeholder="e.g. Lab-2" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Semester / Section</label>
            <div className="flex gap-2">
              <TextInput type="number" min={1} max={8} value={form.semester} onChange={(e) => setForm({ ...form, semester: +e.target.value })} />
              <TextInput value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} placeholder="A" />
            </div>
          </div>
        </div>
        <Button variant="primary" className="mt-4" onClick={addSlot} disabled={busy || !teachers.length}>
          <Save className="w-4 h-4" /> {busy ? "Saving…" : "Assign Class"}
        </Button>
      </Card>

      <Card className="p-4 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm font-medium text-slate-600 dark:text-slate-300">Filter by teacher</label>
          <Select
            value={teacherFilter}
            onChange={(e) => { setTeacherFilter(e.target.value); load(e.target.value); }}
            className="min-w-[220px]"
          >
            <option value="all">All teachers</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </Select>
          <p className="text-xs text-slate-500">{`${filteredSlots.length} class slot${filteredSlots.length === 1 ? "" : "s"}`}</p>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {byDay.map(({ day, name, slots: daySlots }) => (
          <Card key={day} className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">{name}</h3>
              <Badge variant="indigo">{`${daySlots.length}`}</Badge>
            </div>
            <div className="space-y-2">
              {daySlots.map((s) => (
                <div key={s.id} className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-indigo-600 dark:text-indigo-400">{s.subject_code}</p>
                      <p className="text-xs text-slate-500">{s.subject_name}</p>
                      <p className="text-sm font-medium mt-1">{s.teacher_name}</p>
                      <p className="text-sm mt-0.5">{s.start_time} – {s.end_time}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {s.room || "Room TBA"} · Sem {s.semester} · Sec {s.section}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeSlot(s.id)}
                      className="p-1.5 rounded-md text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                      title="Remove"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
              {daySlots.length === 0 && <p className="text-sm text-slate-500 py-6 text-center">No classes</p>}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function HodExams() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { page, setPage, pageSize, setPageSize, totalPages, total, paged } = useClientPagination(exams, 10);

  useEffect(() => {
    fetchHodExams()
      .then((e) => { setExams(e); setError(null); })
      .catch((e: any) => setError(e.message || "Failed to load examinations"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-10 text-center text-slate-500">Loading examinations…</div>;

  const paperCount = exams.reduce((n, e) => n + (e.subjects?.length || 1), 0);

  return (
    <div>
      <PageHeader
        title="Department Examinations"
        subtitle={`${exams.length} exam session${exams.length === 1 ? "" : "s"} · ${paperCount} paper${paperCount === 1 ? "" : "s"} · view only (Exam Cell owns seating & hall tickets)`}
      />
      {error && (
        <div className="mb-4 p-3 rounded-lg text-sm bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300">{error}</div>
      )}

      {!exams.length && !error && (
        <Card className="p-10 text-center text-slate-500">
          No examinations scheduled for your department yet.
        </Card>
      )}

      {exams.length > 0 && (
        <Card className="overflow-hidden">
          <div className="space-y-4 p-5">
            {paged.map((exam) => {
              const papers = exam.subjects?.length
                ? exam.subjects
                : [{
                    subjectCode: exam.subjectCode,
                    subjectName: exam.subjectName,
                    date: exam.date,
                    time: exam.time,
                    duration: exam.duration,
                    invigilatorId: exam.invigilatorId,
                    invigilatorName: exam.invigilatorName,
                  }];

              return (
                <div key={exam.id} className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                  <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap gap-1 mb-2">
                          {papers.map((p) => (
                            <Badge key={p.subjectCode} variant="indigo">{p.subjectCode}</Badge>
                          ))}
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                          {exam.title || exam.subjectName}
                        </h3>
                        <p className="text-sm text-slate-500 mt-0.5">
                          {exam.department} · Semester {exam.semester} · {papers.length} paper{papers.length === 1 ? "" : "s"}
                        </p>
                      </div>
                      <div className="text-sm text-slate-600 dark:text-slate-300 space-y-1">
                        <p className="flex items-center gap-2"><MapPin className="w-4 h-4 text-slate-400" /> {exam.room || "Room TBA"}</p>
                        <p className="flex items-center gap-2"><BookOpen className="w-4 h-4 text-slate-400" /> {exam.totalMarks} marks</p>
                      </div>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-slate-500 border-b border-slate-100 dark:border-slate-800">
                          <th className="px-5 py-3 font-medium">Code</th>
                          <th className="px-5 py-3 font-medium">Subject</th>
                          <th className="px-5 py-3 font-medium">Date</th>
                          <th className="px-5 py-3 font-medium">Time</th>
                          <th className="px-5 py-3 font-medium">Duration</th>
                          <th className="px-5 py-3 font-medium">Invigilator</th>
                        </tr>
                      </thead>
                      <tbody>
                        {papers.map((p) => (
                          <tr key={`${exam.id}-${p.subjectCode}`} className="border-b border-slate-50 dark:border-slate-800/60 last:border-0">
                            <td className="px-5 py-3 font-mono text-xs text-indigo-600 dark:text-indigo-400">{p.subjectCode}</td>
                            <td className="px-5 py-3 font-medium text-slate-800 dark:text-slate-100">{p.subjectName}</td>
                            <td className="px-5 py-3">
                              <span className="inline-flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                {p.date || exam.date || "—"}
                              </span>
                            </td>
                            <td className="px-5 py-3">
                              <span className="inline-flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-slate-400" />
                                {p.time || exam.time || "—"}
                              </span>
                            </td>
                            <td className="px-5 py-3">{p.duration || exam.duration || "—"}</td>
                            <td className="px-5 py-3">{p.invigilatorName || "Not assigned"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
          <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
        </Card>
      )}
    </div>
  );
}

export function HodMarks() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { page, setPage, pageSize, setPageSize, totalPages, total, paged } = useClientPagination(rows, 10);

  useEffect(() => {
    api.hodMarks().then((d) => { setRows(d || []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-10 text-center text-slate-500">Loading marks…</div>;

  return (
    <div>
      <PageHeader title="Internal Marks Overview" subtitle="Department-wide internals & assignments" />
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr className="text-left text-slate-500">
                <th className="p-4 font-medium">Roll No</th>
                <th className="p-4 font-medium">Name</th>
                <th className="p-4 font-medium">Sem</th>
                <th className="p-4 font-medium">Internal</th>
                <th className="p-4 font-medium">Assignment</th>
                <th className="p-4 font-medium">Attendance</th>
                <th className="p-4 font-medium">SGPA</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((r) => (
                <tr key={r.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="p-4">{r.roll_no}</td>
                  <td className="p-4">{r.name}</td>
                  <td className="p-4">{r.semester}</td>
                  <td className="p-4">{r.internal_marks}/{INTERNAL_MARKS_MAX}</td>
                  <td className="p-4">{r.assignment_marks}/{ASSIGNMENT_MARKS_MAX}</td>
                  <td className="p-4">{r.attendance}%</td>
                  <td className="p-4">{r.previous_result}</td>
                </tr>
              ))}
              {!rows.length && (
                <tr><td colSpan={7} className="p-10 text-center text-slate-500">No mark records</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
      </Card>
    </div>
  );
}

export function HodEligibility() {
  const [list, setList] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { page, setPage, pageSize, setPageSize, totalPages, total, paged } = useClientPagination(list, 10);

  const reload = () => fetchHodStudents().then((s) => { setList(s); setLoading(false); });
  useEffect(() => { reload(); }, []);

  const verify = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await api.hodVerifyEligibility();
      setMsg(res.message || "Eligibility verified");
      await reload();
    } catch (e: any) {
      setMsg(e.message || "Verification failed");
    }
    setBusy(false);
  };

  if (loading) return <div className="p-10 text-center text-slate-500">Loading eligibility…</div>;

  return (
    <div>
      <PageHeader
        title="Department Eligibility"
        subtitle="Review and recompute eligibility for your department"
        actions={
          <Button variant="primary" onClick={verify} disabled={busy}>
            <TicketCheck className="w-4 h-4" /> {busy ? "Verifying…" : "Verify Department"}
          </Button>
        }
      />
      {msg && <div className="mb-4 p-3 rounded-lg text-sm bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">{msg}</div>}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr className="text-left text-slate-500">
                <th className="p-4 font-medium">Roll No</th>
                <th className="p-4 font-medium">Name</th>
                <th className="p-4 font-medium">Attendance</th>
                <th className="p-4 font-medium">Internals</th>
                <th className="p-4 font-medium">Fee</th>
                <th className="p-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((s) => {
                const el = getStudentEligibility(s);
                return (
                  <tr key={s.id} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="p-4">{s.rollNo}</td>
                    <td className="p-4">{s.name}</td>
                    <td className="p-4">{s.attendance}%</td>
                    <td className="p-4">{s.internalMarks}/{INTERNAL_MARKS_MAX}</td>
                    <td className="p-4">{s.feePaid ? "Paid" : "Pending"}</td>
                    <td className="p-4">
                      <Badge variant={el.eligible ? "green" : "red"}>{el.eligible ? "Eligible" : "Not Eligible"}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
      </Card>
    </div>
  );
}

export function HodBacklogs() {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { page, setPage, pageSize, setPageSize, totalPages, total, paged } = useClientPagination(list, 10);

  useEffect(() => {
    api.hodBacklogs().then((d) => { setList(d || []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-10 text-center text-slate-500">Loading backlogs…</div>;

  return (
    <div>
      <PageHeader title="Backlogs" subtitle="Students with outstanding papers in your department" />
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr className="text-left text-slate-500">
                <th className="p-4 font-medium">Roll No</th>
                <th className="p-4 font-medium">Name</th>
                <th className="p-4 font-medium">Sem</th>
                <th className="p-4 font-medium">Backlogs</th>
                <th className="p-4 font-medium">Attendance</th>
                <th className="p-4 font-medium">Eligible</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((s) => (
                <tr key={s.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="p-4">{s.roll_no}</td>
                  <td className="p-4">{s.name}</td>
                  <td className="p-4">{s.semester}</td>
                  <td className="p-4 font-semibold text-rose-600">{s.backlogs}</td>
                  <td className="p-4">{s.attendance}%</td>
                  <td className="p-4">
                    <Badge variant={s.is_eligible ? "green" : "red"}>{s.is_eligible ? "Yes" : "No"}</Badge>
                  </td>
                </tr>
              ))}
              {!list.length && (
                <tr><td colSpan={6} className="p-10 text-center text-slate-500">No backlog students</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
      </Card>
    </div>
  );
}

export function HodFees() {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { page, setPage, pageSize, setPageSize, totalPages, total, paged } = useClientPagination(list, 10);

  useEffect(() => {
    api.hodFees().then((d) => { setList(d || []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-10 text-center text-slate-500">Loading fee status…</div>;

  const pending = list.filter((s) => !s.fee_paid).length;

  return (
    <div>
      <PageHeader
        title="Fee Status"
        subtitle={`Read-only view • ${pending} pending — approval is Admin/Accounts only`}
      />
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr className="text-left text-slate-500">
                <th className="p-4 font-medium">Roll No</th>
                <th className="p-4 font-medium">Name</th>
                <th className="p-4 font-medium">Amount</th>
                <th className="p-4 font-medium">Due Date</th>
                <th className="p-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((s) => (
                <tr key={s.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="p-4">{s.roll_no}</td>
                  <td className="p-4">{s.name}</td>
                  <td className="p-4">₹{s.fee_amount}</td>
                  <td className="p-4">{s.fee_due_date || "—"}</td>
                  <td className="p-4">
                    <Badge variant={s.fee_paid ? "green" : "amber"}>{s.fee_paid ? "Paid" : "Pending"}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
      </Card>
    </div>
  );
}

export function HodNotifications() {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [audience, setAudience] = useState<"all" | "students" | "teachers">("students");
  const [list, setList] = useState<any[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const { page, setPage, pageSize, setPageSize, totalPages, total, paged } = useClientPagination(list, 10);

  const reload = async () => {
    try {
      const data = await api.hodNotifications();
      setList(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setErr(e.message || "Failed to load notifications");
      setList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); }, []);

  const send = async () => {
    setMsg(null);
    setErr(null);
    if (!title.trim() || !message.trim()) {
      setErr("Title and message are required");
      return;
    }
    setSending(true);
    try {
      await api.hodSendNotification({ title: title.trim(), message: message.trim(), audience });
      setMsg("Notification sent to your department audience");
      setTitle("");
      setMessage("");
      notifyNotificationsUpdated();
      await reload();
    } catch (e: any) {
      setErr(e.message || "Failed to send notification");
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <PageHeader title="Department Notifications" subtitle="Broadcast to students/teachers in your department only" />
      {msg && <div className="mb-4 p-3 rounded-lg text-sm bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">{msg}</div>}
      {err && <div className="mb-4 p-3 rounded-lg text-sm bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300">{err}</div>}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="font-bold mb-4">Compose</h3>
          <div className="space-y-3">
            <Field label="Title"><TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Internal marks deadline" /></Field>
            <Field label="Message">
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4}
                placeholder="Write the announcement…"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm" />
            </Field>
            <Field label="Audience">
              <Select value={audience} onChange={(e) => setAudience(e.target.value as any)}>
                <option value="all">Students & teachers (dept)</option>
                <option value="students">Students only</option>
                <option value="teachers">Teachers only</option>
              </Select>
            </Field>
            <Button variant="primary" onClick={send} disabled={sending}>
              <Mail className="w-4 h-4" /> {sending ? "Sending…" : "Send"}
            </Button>
          </div>
        </Card>
        <Card className="overflow-hidden">
          <div className="p-6 pb-0">
            <h3 className="font-bold mb-4">Recent (your department)</h3>
            <div className="space-y-3">
              {loading && <p className="text-sm text-slate-500">Loading…</p>}
              {!loading && paged.map((n) => {
                const parsed = parseNotificationTitle(n.title || "");
                const body = cleanNotificationMessage(n.message || "");
                return (
                <div key={n.id} className="p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="font-semibold text-sm text-slate-900 dark:text-white">{parsed.title}</p>
                    <div className="flex flex-wrap gap-1">
                      {parsed.department && <Badge variant="amber">{parsed.department}</Badge>}
                      <Badge variant="sky">{formatNotificationAudience(n.audience)}</Badge>
                    </div>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 whitespace-pre-wrap">{body}</p>
                  {n.created_at && (
                    <p className="text-xs text-slate-400 mt-1">{String(n.created_at).replace("T", " ").slice(0, 16)}</p>
                  )}
                </div>
                );
              })}
              {!loading && !list.length && <p className="text-sm text-slate-500">No notifications yet</p>}
            </div>
          </div>
          <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
        </Card>
      </div>
    </div>
  );
}

export function HodAnalytics() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.hodAnalytics().then((d) => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-10 text-center text-slate-500">Loading analytics…</div>;
  if (!data) return <div className="p-10 text-center text-slate-500">No analytics data</div>;

  const pie = [
    { name: "Eligible", value: data.eligibility?.eligible || 0, fill: "#10b981" },
    { name: "Ineligible", value: data.eligibility?.ineligible || 0, fill: "#ef4444" },
  ];

  return (
    <div>
      <PageHeader title="Department Analytics" subtitle={data.department || ""} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Avg Attendance" value={`${data.avg_attendance}%`} icon={ClipboardList} color="emerald" />
        <StatCard label="Avg Internals" value={`${data.avg_internals}/${INTERNAL_MARKS_MAX}`} icon={BarChart3} color="amber" />
        <StatCard label="Backlogs" value={data.backlog_count} icon={AlertTriangle} color="rose" />
        <StatCard label="Faculty" value={(data.teacher_coverage || []).length} icon={Users} color="indigo" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card className="p-5">
          <h3 className="font-semibold mb-4">Semester Distribution</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.semester_distribution || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,.3)" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip />
                <Bar dataKey="value" fill="#6366f1" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-5">
          <h3 className="font-semibold mb-4">Eligibility Split</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {pie.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Pie>
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
      <Card className="p-5">
        <h3 className="font-semibold mb-3">Faculty Subject Coverage</h3>
        <div className="space-y-2">
          {(data.teacher_coverage || []).map((t: any) => (
            <div key={t.emp_id} className="flex flex-wrap items-center gap-2 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
              <span className="font-medium text-sm">{t.name}</span>
              <span className="text-xs text-slate-500">({t.emp_id})</span>
              {(t.subjects || []).map((s: string) => <Badge key={s} variant="indigo">{s}</Badge>)}
              {!t.subjects_count && <span className="text-xs text-slate-400">No subjects</span>}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

export function HodReports() {
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const types = [
    { id: "attendance", label: "Attendance" },
    { id: "marks", label: "Internal Marks" },
    { id: "eligibility", label: "Eligibility" },
    { id: "examination", label: "Examinations" },
    { id: "backlog", label: "Backlogs" },
    { id: "fee", label: "Fee Status" },
  ];

  const download = async (type: string, format: "pdf" | "excel") => {
    setBusy(`${type}-${format}`);
    setErr(null);
    try {
      await downloadHodReport(type, format);
    } catch (e: any) {
      setErr(e.message || "Download failed");
    }
    setBusy(null);
  };

  return (
    <div>
      <PageHeader title="Department Reports" subtitle="Export department-scoped reports" />
      {err && <div className="mb-4 p-3 rounded-lg text-sm bg-rose-50 text-rose-700">{err}</div>}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {types.map((t) => (
          <Card key={t.id} className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <FileText className="w-5 h-5 text-indigo-500" />
              <h3 className="font-semibold">{t.label}</h3>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => download(t.id, "pdf")} disabled={!!busy}>
                {busy === `${t.id}-pdf` ? "…" : "PDF"}
              </Button>
              <Button variant="primary" onClick={() => download(t.id, "excel")} disabled={!!busy}>
                {busy === `${t.id}-excel` ? "…" : "Excel"}
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
