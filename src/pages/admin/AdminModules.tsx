import { useState, useMemo, useEffect } from "react";
import { Card, PageHeader, Button, Badge, TextInput, Select } from "../../components/Layout";
import { fetchStudents, fetchTeachers, fetchAdminExams, getStudentEligibility } from "../../data/apiData";
import { downloadAdminReport } from "../../data/api";
import type { Student, Teacher, Exam } from "../../data/mockData";
import { useNotifications } from "../../contexts/AppContext";
import { Search, Plus, Edit2, Trash2, Eye, Download, Upload, Printer, QrCode, Mail, CheckCircle2, FileText, Wallet, AlertTriangle, Settings as SettingsIcon, Save, Calendar, Clock, MapPin, ClipboardList, TicketCheck, BrainCircuit, X, Database } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from "recharts";
import { QRCodeSVG } from "qrcode.react";
import { cn } from "../../utils/cn";
import { useDepartments } from "../../hooks/useDepartments";
import { DepartmentSelect } from "../../components/DepartmentSelect";

const API = "http://localhost:8000";
const token = () => localStorage.getItem("examshield_token") || "";

async function errorMessage(res: Response, fallback: string): Promise<string> {
  // The backend returns JSON errors, but an unexpected 500 renders an HTML page.
  // Parse defensively so the admin always sees a readable message.
  try {
    const j = await res.clone().json();
    if (j && typeof j === "object") {
      if (j.detail) return j.detail;
      // DRF field validation errors: { field: ["message", ...], ... }
      const parts = Object.entries(j).map(([k, v]) =>
        `${k}: ${Array.isArray(v) ? v.join(", ") : v}`
      );
      if (parts.length) return parts.join(" | ");
    }
  } catch {}
  return `${fallback} (HTTP ${res.status})`;
}

async function apiPost(path: string, form: any, fallback: string) {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
    body: JSON.stringify(form),
  });
  if (!res.ok) throw new Error(await errorMessage(res, fallback));
  return res.json();
}

async function apiPut(path: string, form: any, fallback: string) {
  const res = await fetch(`${API}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
    body: JSON.stringify(form),
  });
  if (!res.ok) throw new Error(await errorMessage(res, fallback));
  return res.json();
}

async function apiDelete(path: string, fallback: string) {
  const res = await fetch(`${API}${path}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token()}` },
  });
  if (!res.ok) throw new Error(await errorMessage(res, fallback));
}

async function apiAddStudent(form: any) {
  return apiPost("/api/auth/setup-student", form, "Failed to add student");
}
async function apiAddTeacher(form: any) {
  return apiPost("/api/auth/setup-teacher", form, "Failed to add teacher");
}
async function apiAddExam(form: any) {
  return apiPost("/api/auth/setup-exam", form, "Failed to add exam");
}

// ==================== STUDENTS ====================
export function AdminStudents() {
  const [list, setList] = useState<Student[]>([]);
  const [search, setSearch] = useState("");
  const [dept, setDept] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Student | null>(null);
  const [viewing, setViewing] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const { departments: dbDepartments } = useDepartments();
  const pageSize = 5;

  useEffect(() => { fetchStudents().then((s) => { setList(s); setLoading(false); }); }, []);
  const depts = Array.from(new Set([...dbDepartments, ...list.map((s) => s.department)])).filter(Boolean);

  const filtered = useMemo(() => {
    return list.filter((s) =>
      (dept === "all" || s.department === dept) &&
      (s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.rollNo.toLowerCase().includes(search.toLowerCase()) ||
        s.email.toLowerCase().includes(search.toLowerCase()))
    );
  }, [list, search, dept]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const onDelete = async (id: string) => {
    if (!confirm("Delete this student?")) return;
    try {
      const sid = id.replace("s", "");
      const res = await fetch(`http://localhost:8000/api/admin/students/${sid}/delete`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${localStorage.getItem("examshield_token") || ""}` }
      });
      if (!res.ok) { alert(await errorMessage(res, "Failed to delete student")); return; }
    } catch { alert("Failed to delete student: backend not reachable"); return; }
    setList((l) => l.filter((s) => s.id !== id));
  };

  if (loading) return <div className="p-10 text-center text-slate-500">Loading students from MySQL…</div>;

  return (
    <div>
      <PageHeader
        title="Student Management"
        subtitle={`${list.length} students registered (live MySQL data)`}
        actions={
          <Button onClick={() => setEditing({} as Student)} variant="primary">
            <Plus className="w-4 h-4" /> Add Student
          </Button>
        }
      />

      <Card className="p-5 mb-6">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <TextInput placeholder="Search by name, roll number, or email..." value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="pl-10" />
          </div>
          <Select value={dept} onChange={(e) => { setDept(e.target.value); setPage(1); }} className="md:w-56">
            <option value="all">All Departments</option>
            {depts.map((d) => <option key={d} value={d}>{d}</option>)}
          </Select>
          <Button variant="secondary"><Upload className="w-4 h-4" /> Bulk Upload</Button>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr className="text-left text-slate-600 dark:text-slate-300">
                <th className="p-4 font-medium">Student</th>
                <th className="p-4 font-medium">Department</th>
                <th className="p-4 font-medium">Sem</th>
                <th className="p-4 font-medium">Attendance</th>
                <th className="p-4 font-medium">Internals</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {paged.map((s) => {
                const e = getStudentEligibility(s);
                return (
                  <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <img src={s.photo} alt="" className="w-10 h-10 rounded-full bg-slate-200" />
                        <div>
                          <p className="font-medium text-slate-800 dark:text-white">{s.name}</p>
                          <p className="text-xs text-slate-500">{s.rollNo} • {s.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-slate-600 dark:text-slate-300">{s.department}</td>
                    <td className="p-4">Sem {s.semester}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div className={cn("h-full rounded-full", s.attendance >= 75 ? "bg-emerald-500" : "bg-rose-500")} style={{ width: `${s.attendance}%` }} />
                        </div>
                        <span className="text-xs text-slate-500">{s.attendance}%</span>
                      </div>
                    </td>
                    <td className="p-4">{s.internalMarks}/40</td>
                    <td className="p-4">{e.eligible ? <Badge variant="green">Eligible</Badge> : <Badge variant="red">Not Eligible</Badge>}</td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setViewing(s)} className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"><Eye className="w-4 h-4" /></button>
                        <button onClick={() => setEditing(s)} className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => onDelete(s.id)} className="p-1.5 rounded-md hover:bg-rose-50 dark:hover:bg-rose-500/10 text-rose-500"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {paged.length === 0 && (
                <tr><td colSpan={7} className="p-10 text-center text-slate-500">No students found in MySQL</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between p-4 border-t border-slate-200 dark:border-slate-800">
          <p className="text-sm text-slate-500">Showing {(page-1)*pageSize+1}–{Math.min(page*pageSize, filtered.length)} of {filtered.length}</p>
          <div className="flex items-center gap-1">
            <Button variant="secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>Prev</Button>
            {Array.from({ length: totalPages }).map((_, i) => (
              <button key={i} onClick={() => setPage(i + 1)}
                className={cn("w-8 h-8 rounded-md text-sm font-medium",
                  page === i + 1 ? "bg-indigo-600 text-white" : "hover:bg-slate-100 dark:hover:bg-slate-800")}>
                {i + 1}
              </button>
            ))}
            <Button variant="secondary" disabled={page === totalPages} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        </div>
      </Card>

      {editing && (
        <StudentModal
          student={editing.id ? editing : null}
          onClose={() => setEditing(null)}
          onSave={async (s, opts) => {
            if (s.id) {
              // Edit — call PUT
              try {
                const sid = parseInt(s.id.replace("s", ""));
                const payload: Record<string, unknown> = {
                  name: s.name,
                  email: s.email,
                  roll_no: s.rollNo,
                  mobile: s.mobile || "",
                  department: s.department,
                  semester: s.semester,
                  section: s.section,
                  photo: s.photo || "",
                  attendance_percentage: s.attendance,
                  internal_marks: s.internalMarks,
                  assignment_marks: s.assignmentMarks,
                  previous_result: s.previousResult,
                  backlogs: s.backlogs,
                  fee_paid: s.feePaid,
                  fee_amount: s.feeAmount,
                  fee_due_date: s.feeDueDate || "",
                };
                if (opts?.password) payload.password = opts.password;
                const res = await fetch(`${API}/api/admin/students/${sid}/update`, {
                  method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
                  body: JSON.stringify(payload),
                });
                if (!res.ok) { alert(await errorMessage(res, "Failed to update student")); return; }
              } catch { alert("Failed to update student: backend not reachable"); return; }
              setList((l) => l.map((x) => x.id === s.id ? s : x));
            } else {
              // Create — call setup-student API
              try {
                const result = await apiAddStudent({
                  email: s.email, name: s.name, password: opts?.password || "student123",
                  roll_no: s.rollNo, mobile: s.mobile, department: s.department,
                  semester: s.semester, section: s.section, photo: s.photo,
                  attendance_percentage: s.attendance, internal_marks: s.internalMarks,
                  assignment_marks: s.assignmentMarks, previous_result: s.previousResult,
                  backlogs: s.backlogs, fee_paid: s.feePaid, fee_amount: s.feeAmount, fee_due_date: s.feeDueDate,
                });
                const newS: Student = { ...s, id: `s${result.student_id}` };
                setList((l) => [newS, ...l]);
                alert(`✓ Student added to MySQL (ID ${result.student_id})`);
              } catch (e: any) {
                alert(`Failed to add: ${e.message}`); return;
              }
            }
            setEditing(null);
          }}
        />
      )}
      {viewing && <StudentDetailModal student={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

function StudentModal({ student, onClose, onSave }: { student: Student | null; onClose: () => void; onSave: (s: Student, opts?: { password?: string }) => void }) {
  const { departments, loading: deptsLoading } = useDepartments();
  const [form, setForm] = useState<Student>(student || {
    id: "", rollNo: "", name: "", email: "", mobile: "", department: "",
    semester: 5, section: "A", photo: "", attendance: 75, internalMarks: 30, assignmentMarks: 7,
    previousResult: 7.0, backlogs: 0, feePaid: false, feeAmount: 45000, feeDueDate: "2026-09-30", createdAt: new Date().toISOString().slice(0, 10),
  });
  const [password, setPassword] = useState("");
  const update = (k: keyof Student, v: any) => setForm({ ...form, [k]: v } as Student);

  useEffect(() => {
    if (!student?.id && departments.length && !form.department) {
      setForm((f) => ({ ...f, department: departments[0] }));
    }
  }, [departments, student?.id, form.department]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">{student?.id ? "Edit Student" : "Add Student"}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>
        <div className="p-6 grid grid-cols-2 gap-4">
          <Field label="Roll No"><TextInput value={form.rollNo} onChange={(e) => update("rollNo", e.target.value)} /></Field>
          <Field label="Name"><TextInput value={form.name} onChange={(e) => update("name", e.target.value)} /></Field>
          <Field label="Email"><TextInput type="email" value={form.email} onChange={(e) => update("email", e.target.value)} /></Field>
          <Field label={student?.id ? "New Password (optional)" : "Password"}>
            <TextInput type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={student?.id ? "Leave blank to keep current" : "Student login password (min 6 chars)"} />
          </Field>
          <Field label="Mobile"><TextInput value={form.mobile} onChange={(e) => update("mobile", e.target.value)} /></Field>
          <Field label="Department">
            <DepartmentSelect
              value={form.department}
              onChange={(v) => update("department", v)}
              departments={departments}
              loading={deptsLoading}
            />
          </Field>
          <Field label="Semester"><TextInput type="number" value={form.semester} onChange={(e) => update("semester", +e.target.value)} /></Field>
          <Field label="Section"><TextInput value={form.section} onChange={(e) => update("section", e.target.value)} /></Field>
          <Field label="Attendance %"><TextInput type="number" value={form.attendance} onChange={(e) => update("attendance", +e.target.value)} /></Field>
          <Field label="Internal Marks /40"><TextInput type="number" value={form.internalMarks} onChange={(e) => update("internalMarks", +e.target.value)} /></Field>
          <Field label="Assignment Marks /10"><TextInput type="number" value={form.assignmentMarks} onChange={(e) => update("assignmentMarks", +e.target.value)} /></Field>
          <Field label="Previous SGPA"><TextInput type="number" step="0.1" value={form.previousResult} onChange={(e) => update("previousResult", +e.target.value)} /></Field>
          <Field label="Backlogs"><TextInput type="number" value={form.backlogs} onChange={(e) => update("backlogs", +e.target.value)} /></Field>
          <Field label="Fee Paid">
            <Select value={form.feePaid ? "yes" : "no"} onChange={(e) => update("feePaid", e.target.value === "yes")}>
              <option value="yes">Yes</option><option value="no">No</option>
            </Select>
          </Field>
          <Field label="Fee Amount"><TextInput type="number" value={form.feeAmount} onChange={(e) => update("feeAmount", +e.target.value)} /></Field>
          <Field label="Photo URL"><TextInput value={form.photo} onChange={(e) => update("photo", e.target.value)} placeholder="https://..." /></Field>
        </div>
        <div className="p-6 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => {
            if (!student?.id && password && password.length < 6) {
              alert("Password must be at least 6 characters");
              return;
            }
            onSave(form, password ? { password } : undefined);
          }}><Save className="w-4 h-4" /> Save Student</Button>
        </div>
      </div>
    </div>
  );
}

function StudentDetailModal({ student, onClose }: { student: Student; onClose: () => void }) {
  const e = getStudentEligibility(student);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(ev) => ev.stopPropagation()}>
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Student Profile</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>
        <div className="p-6">
          <div className="flex items-center gap-4 mb-6">
            <img src={student.photo} alt="" className="w-20 h-20 rounded-full bg-slate-200" />
            <div>
              <h4 className="text-xl font-bold text-slate-900 dark:text-white">{student.name}</h4>
              <p className="text-sm text-slate-500">{student.rollNo} • {student.department}</p>
              {e.eligible ? <Badge variant="green">Eligible</Badge> : <Badge variant="red">Not Eligible</Badge>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <Info label="Email" value={student.email} />
            <Info label="Mobile" value={student.mobile} />
            <Info label="Attendance" value={`${student.attendance}%`} ok={student.attendance >= 75} />
            <Info label="Internal Marks" value={`${student.internalMarks}/40`} ok={(student.internalMarks / 40) * 100 >= 40} />
            <Info label="Previous SGPA" value={student.previousResult.toString()} ok={student.previousResult >= 5.0} />
            <Info label="Backlogs" value={student.backlogs.toString()} ok={student.backlogs === 0} />
            <Info label="Fee Status" value={student.feePaid ? "Paid" : "Pending"} ok={student.feePaid} />
            <Info label="Fee Due" value={student.feeDueDate} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{label}</span>
      {children}
    </label>
  );
}

function Info({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={cn("font-medium mt-0.5",
        ok === true ? "text-emerald-700 dark:text-emerald-400" :
        ok === false ? "text-rose-700 dark:text-rose-400" : "text-slate-800 dark:text-white")}>{value}</p>
    </div>
  );
}

// ==================== TEACHERS ====================
export function AdminTeachers() {
  const [list, setList] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Teacher | null>(null);

  const reload = () => fetchTeachers().then((t) => { setList(t); setLoading(false); });
  useEffect(() => { reload(); }, []);

  const onDelete = async (teacher: Teacher) => {
    if (!confirm(`Delete teacher ${teacher.name}?`)) return;
    try {
      const tid = teacher.id.replace(/^t/, "");
      await apiDelete(`/api/admin/teachers/${tid}/delete`, "Failed to delete teacher");
      setList((l) => l.filter((t) => t.id !== teacher.id));
    } catch (e: any) {
      alert(e.message || "Failed to delete teacher");
    }
  };

  if (loading) return <div className="p-10 text-center text-slate-500">Loading teachers from MySQL…</div>;
  return (
    <div>
      <PageHeader title="Teacher Management" subtitle={`${list.length} teachers registered (live MySQL data)`}
        actions={<Button variant="primary" onClick={() => setAdding(true)}><Plus className="w-4 h-4" /> Add Teacher</Button>} />
      <Card className="overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-5">
          {list.map((t) => (
            <div key={t.id} className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-3">
                <img src={t.photo || `https://api.dicebear.com/7.x/avataaars/svg?seed=${t.empId}`} alt="" className="w-12 h-12 rounded-full bg-slate-200" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 dark:text-white">{t.name}</p>
                  <p className="text-xs text-slate-500">{t.empId} • {t.department}</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => setEditing(t)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800" title="Edit">
                    <Edit2 className="w-4 h-4 text-slate-500" />
                  </button>
                  <button onClick={() => onDelete(t)} className="p-2 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30" title="Delete">
                    <Trash2 className="w-4 h-4 text-rose-500" />
                  </button>
                </div>
              </div>
              <p className="text-xs text-slate-500 mb-3">{t.email}</p>
              <div className="flex flex-wrap gap-1 mb-3">
                {t.subjects.map((s) => <Badge key={s} variant="indigo">{s}</Badge>)}
              </div>
            </div>
          ))}
          {list.length === 0 && <div className="col-span-3 p-10 text-center text-slate-500">No teachers in MySQL — click "Add Teacher" to create one</div>}
        </div>
      </Card>
      {adding && <TeacherModal onClose={() => setAdding(false)} onSaved={(t) => { setList((l) => [t, ...l]); setAdding(false); }} />}
      {editing && <TeacherModal teacher={editing} onClose={() => setEditing(null)} onSaved={(t) => { setList((l) => l.map((x) => x.id === t.id ? t : x)); setEditing(null); }} />}
    </div>
  );
}

function TeacherModal({ teacher, onClose, onSaved }: { teacher?: Teacher; onClose: () => void; onSaved: (t: Teacher) => void }) {
  const isEdit = !!teacher;
  const { departments, loading: deptsLoading } = useDepartments();
  const [form, setForm] = useState({
    email: teacher?.email || "",
    password: "",
    name: teacher?.name || "",
    emp_id: teacher?.empId || "",
    department: teacher?.department || "",
    assigned_subjects: teacher?.subjects?.join(",") || "CS301,CS302",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!isEdit && departments.length && !form.department) {
      setForm((f) => ({ ...f, department: departments[0] }));
    }
  }, [departments, isEdit, form.department]);

  const save = async () => {
    setSaving(true); setErr(null);
    try {
      const payload: Record<string, string> = {
        name: form.name,
        email: form.email,
        emp_id: form.emp_id,
        department: form.department,
        assigned_subjects: form.assigned_subjects,
      };
      if (form.password) payload.password = form.password;

      if (isEdit && teacher) {
        const tid = teacher.id.replace(/^t/, "");
        await apiPut(`/api/admin/teachers/${tid}/update`, payload, "Failed to update teacher");
        onSaved({
          ...teacher,
          name: form.name,
          email: form.email,
          empId: form.emp_id,
          department: form.department,
          subjects: form.assigned_subjects.split(",").map((s) => s.trim()).filter(Boolean),
        });
      } else {
        const res = await apiAddTeacher({ ...payload, password: form.password || "teacher123" });
        onSaved({
          id: `t${res.teacher_id}`,
          empId: form.emp_id,
          name: form.name,
          email: form.email,
          department: form.department,
          subjects: form.assigned_subjects.split(",").map((s) => s.trim()).filter(Boolean),
          photo: "",
        });
      }
    } catch (e: any) { setErr(e.message); }
    setSaving(false);
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-lg font-bold">{isEdit ? "Edit Teacher" : "Add Teacher"}</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="p-6 space-y-3">
          <Field label="Name"><TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Email"><TextInput type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Employee ID"><TextInput value={form.emp_id} onChange={(e) => setForm({ ...form, emp_id: e.target.value })} placeholder="TCH005" /></Field>
          <Field label="Department">
            <DepartmentSelect
              value={form.department}
              onChange={(v) => setForm({ ...form, department: v })}
              departments={departments}
              loading={deptsLoading}
            />
          </Field>
          <Field label="Assigned Subjects (comma-separated)"><TextInput value={form.assigned_subjects} onChange={(e) => setForm({ ...form, assigned_subjects: e.target.value })} /></Field>
          <Field label={isEdit ? "New Password (optional)" : "Password"}>
            <TextInput type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder={isEdit ? "Leave blank to keep current" : "teacher123"} />
          </Field>
          {err && <div className="p-2 rounded bg-rose-50 text-rose-700 text-sm">{err}</div>}
        </div>
        <div className="p-6 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={saving}>{saving ? "Saving…" : isEdit ? "Save Changes" : "Add to MySQL"}</Button>
        </div>
      </div>
    </div>
  );
}

// ==================== EXAMS ====================
export function AdminExams() {
  const [list, setList] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Exam | null>(null);

  useEffect(() => { fetchAdminExams().then((e) => { setList(e); setLoading(false); }); }, []);

  const onDelete = async (exam: Exam) => {
    if (!confirm(`Delete exam ${exam.subjectCode} — ${exam.subjectName}?`)) return;
    try {
      const eid = exam.id.replace(/^e/, "");
      await apiDelete(`/api/admin/exams/${eid}/delete`, "Failed to delete exam");
      setList((l) => l.filter((e) => e.id !== exam.id));
    } catch (e: any) {
      alert(e.message || "Failed to delete exam");
    }
  };

  if (loading) return <div className="p-10 text-center text-slate-500">Loading exams from MySQL…</div>;
  return (
    <div>
      <PageHeader title="Examination Management" subtitle={`${list.length} scheduled exams (live MySQL data)`}
        actions={<Button variant="primary" onClick={() => setAdding(true)}><Plus className="w-4 h-4" /> Schedule Exam</Button>} />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {list.map((e) => (
          <Card key={e.id} className="p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div>
                <Badge variant="indigo">{e.subjectCode}</Badge>
                <h3 className="font-bold text-slate-900 dark:text-white mt-2">{e.subjectName}</h3>
                <p className="text-xs text-slate-500 mt-0.5">{e.department} • Sem {e.semester}</p>
              </div>
              <div className="flex items-start gap-2">
                <div className="text-right">
                  <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{e.date.split("-")[2]}</p>
                  <p className="text-xs text-slate-500 uppercase">{new Date(e.date).toLocaleString("en", { month: "short" })}</p>
                </div>
                <div className="flex flex-col gap-1">
                  <button onClick={() => setEditing(e)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800" title="Edit">
                    <Edit2 className="w-4 h-4 text-slate-500" />
                  </button>
                  <button onClick={() => onDelete(e)} className="p-2 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30" title="Delete">
                    <Trash2 className="w-4 h-4 text-rose-500" />
                  </button>
                </div>
              </div>
            </div>
            <div className="space-y-1.5 text-sm text-slate-600 dark:text-slate-300 mb-4">
              <p className="flex items-center gap-2"><Calendar className="w-4 h-4" /> {e.date} at {e.time}</p>
              <p className="flex items-center gap-2"><Clock className="w-4 h-4" /> Duration: {e.duration}</p>
              <p className="flex items-center gap-2"><MapPin className="w-4 h-4" /> {e.room}</p>
            </div>
          </Card>
        ))}
        {list.length === 0 && <div className="col-span-3 p-10 text-center text-slate-500">No exams scheduled — click "Schedule Exam"</div>}
      </div>
      {adding && <ExamModal onClose={() => setAdding(false)} onSaved={(e) => { setList((l) => [e, ...l]); setAdding(false); }} />}
      {editing && <ExamModal exam={editing} onClose={() => setEditing(null)} onSaved={(e) => { setList((l) => l.map((x) => x.id === e.id ? e : x)); setEditing(null); }} />}
    </div>
  );
}

function ExamModal({ exam, onClose, onSaved }: { exam?: Exam; onClose: () => void; onSaved: (e: Exam) => void }) {
  const isEdit = !!exam;
  const { departments, loading: deptsLoading } = useDepartments();
  const [form, setForm] = useState({
    subject_code: exam?.subjectCode || "",
    subject_name: exam?.subjectName || "",
    department: exam?.department || "",
    semester: exam?.semester || 5,
    exam_date: exam?.date || "2026-11-10",
    exam_time: exam?.time || "10:00 AM",
    duration: exam?.duration || "3 hours",
    room: exam?.room || "",
    total_marks: exam?.totalMarks || 100,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!isEdit && departments.length && !form.department) {
      setForm((f) => ({ ...f, department: departments[0] }));
    }
  }, [departments, isEdit, form.department]);

  const save = async () => {
    setSaving(true); setErr(null);
    try {
      if (isEdit && exam) {
        const eid = exam.id.replace(/^e/, "");
        await apiPut(`/api/admin/exams/${eid}/update`, form, "Failed to update exam");
        onSaved({
          ...exam,
          subjectCode: form.subject_code,
          subjectName: form.subject_name,
          department: form.department,
          semester: form.semester,
          date: form.exam_date,
          time: form.exam_time,
          duration: form.duration,
          room: form.room,
          totalMarks: form.total_marks,
        });
      } else {
        const res = await apiAddExam(form);
        onSaved({
          id: `e${res.exam_id}`,
          subjectCode: form.subject_code,
          subjectName: form.subject_name,
          department: form.department,
          semester: form.semester,
          date: form.exam_date,
          time: form.exam_time,
          duration: form.duration,
          room: form.room,
          totalMarks: form.total_marks,
        });
      }
    } catch (e: any) { setErr(e.message); }
    setSaving(false);
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-lg font-bold">{isEdit ? "Edit Exam" : "Schedule Exam"}</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="p-6 space-y-3">
          <Field label="Subject Code"><TextInput value={form.subject_code} onChange={(e) => setForm({ ...form, subject_code: e.target.value })} placeholder="CS301" /></Field>
          <Field label="Subject Name"><TextInput value={form.subject_name} onChange={(e) => setForm({ ...form, subject_name: e.target.value })} placeholder="Data Structures" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Department">
              <DepartmentSelect
                value={form.department}
                onChange={(v) => setForm({ ...form, department: v })}
                departments={departments}
                loading={deptsLoading}
              />
            </Field>
            <Field label="Semester"><TextInput type="number" value={form.semester} onChange={(e) => setForm({ ...form, semester: +e.target.value })} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date"><TextInput type="date" value={form.exam_date} onChange={(e) => setForm({ ...form, exam_date: e.target.value })} /></Field>
            <Field label="Time"><TextInput value={form.exam_time} onChange={(e) => setForm({ ...form, exam_time: e.target.value })} placeholder="10:00 AM" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Duration"><TextInput value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} /></Field>
            <Field label="Room"><TextInput value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} placeholder="Hall A-101" /></Field>
          </div>
          <Field label="Total Marks"><TextInput type="number" value={form.total_marks} onChange={(e) => setForm({ ...form, total_marks: +e.target.value })} /></Field>
          {err && <div className="p-2 rounded bg-rose-50 text-rose-700 text-sm">{err}</div>}
        </div>
        <div className="p-6 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={saving}>{saving ? "Saving…" : isEdit ? "Save Changes" : "Schedule Exam"}</Button>
        </div>
      </div>
    </div>
  );
}

// ==================== INTERNAL MARKS ====================
export function AdminMarks() {
  const [students, setStudents] = useState<Student[]>([]);
  const [marks, setMarks] = useState<Record<string, { internal: number; assignment: number }>>({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStudents().then((s) => {
      setStudents(s);
      setMarks(Object.fromEntries(s.map((x) => [
        x.id,
        { internal: x.internalMarks, assignment: x.assignmentMarks },
      ])));
      setLoading(false);
    });
  }, []);

  const filtered = students.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()));

  const saveMarks = async (student: Student) => {
    const m = marks[student.id];
    if (!m) return;
    setSavingId(student.id);
    setError(null);
    setMessage(null);
    try {
      const sid = parseInt(student.id.replace(/^s/, ""), 10);
      const res = await fetch(`${API}/api/admin/students/${sid}/update`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({
          internal_marks: m.internal,
          assignment_marks: m.assignment,
          subject_code: "CS301",
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.detail || "Failed to save marks");
      setMessage(`Marks updated for ${student.name}`);
      setStudents((list) => list.map((s) => s.id === student.id ? {
        ...s,
        internalMarks: j.internal_marks ?? m.internal,
        assignmentMarks: j.assignment_marks ?? m.assignment,
      } : s));
    } catch (e: any) {
      setError(e.message || "Failed to save marks");
    }
    setSavingId(null);
  };

  if (loading) return <div className="p-10 text-center text-slate-500">Loading marks from MySQL…</div>;
  return (
    <div>
      <PageHeader title="Internal Marks Management" subtitle="View and update internal marks for all students" />

      {(message || error) && (
        <div className={cn("mb-4 p-3 rounded-lg text-sm", error ? "bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300")}>
          {error || message}
        </div>
      )}

      <Card className="p-5 mb-6">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <TextInput placeholder="Search students..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
          </div>
          <Button variant="primary"><Upload className="w-4 h-4" /> Upload Marks CSV</Button>
        </div>
      </Card>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr className="text-left text-slate-600 dark:text-slate-300">
                <th className="p-4 font-medium">Student</th>
                <th className="p-4 font-medium">Department</th>
                <th className="p-4 font-medium">Internal /40</th>
                <th className="p-4 font-medium">Assignment /10</th>
                <th className="p-4 font-medium">Total /50</th>
                <th className="p-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map((s) => {
                const m = marks[s.id] || { internal: s.internalMarks, assignment: s.assignmentMarks };
                return (
                  <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <img src={s.photo} alt="" className="w-8 h-8 rounded-full bg-slate-200" />
                        <div>
                          <p className="font-medium text-slate-800 dark:text-white">{s.name}</p>
                          <p className="text-xs text-slate-500">{s.rollNo}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-slate-600 dark:text-slate-300">{s.department}</td>
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
                      <Button variant="secondary" disabled={savingId === s.id} onClick={() => saveMarks(s)}>
                        <Save className="w-3.5 h-3.5" /> {savingId === s.id ? "Saving…" : "Save"}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ==================== ELIGIBILITY ====================
export function AdminEligibility() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "eligible" | "not">("all");
  useEffect(() => { fetchStudents().then((s) => { setStudents(s); setLoading(false); }); }, []);
  if (loading) return <div className="p-10 text-center text-slate-500">Loading from MySQL…</div>;

  const list = students.map((s) => ({ s, e: getStudentEligibility(s) }));
  const filtered = list.filter(({ e }) => filter === "all" ? true : filter === "eligible" ? e.eligible : !e.eligible);

  return (
    <div>
      <PageHeader title="Eligibility Verification" subtitle={`${list.length} students • 5-criteria check (live from MySQL)`} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-5"><p className="text-xs text-slate-500 font-medium">Total Students</p><p className="text-3xl font-bold text-slate-900 dark:text-white mt-2">{list.length}</p></Card>
        <Card className="p-5 border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/10">
          <p className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">Eligible</p>
          <p className="text-3xl font-bold text-emerald-700 dark:text-emerald-300 mt-2">{list.filter(x => x.e.eligible).length}</p>
        </Card>
        <Card className="p-5 border-rose-200 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-900/10">
          <p className="text-xs text-rose-700 dark:text-rose-300 font-medium">Not Eligible</p>
          <p className="text-3xl font-bold text-rose-700 dark:text-rose-300 mt-2">{list.filter(x => !x.e.eligible).length}</p>
        </Card>
        <Card className="p-5"><p className="text-xs text-slate-500 font-medium">Avg Eligibility</p><p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400 mt-2">{list.length ? Math.round(list.reduce((a, x) => a + x.e.eligibilityPct, 0) / list.length) : 0}%</p></Card>
      </div>

      <Card className="p-5 mb-6">
        <h4 className="font-semibold text-slate-900 dark:text-white mb-3">Eligibility Criteria</h4>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
          <Criterion label="≥ 75% Attendance" icon="📊" />
          <Criterion label="≥ 40% Internals" icon="📝" />
          <Criterion label="Zero Backlogs" icon="✅" />
          <Criterion label="Fee Paid" icon="💳" />
          <Criterion label="Previous SGPA ≥ 5" icon="🎓" />
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex gap-2 mb-4">
          {(["all", "eligible", "not"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={cn("px-4 py-2 rounded-lg text-sm font-medium capitalize",
                filter === f ? "bg-indigo-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300")}>
              {f === "not" ? "Not Eligible" : f}
            </button>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200 dark:border-slate-800">
                <th className="pb-3 font-medium">Student</th>
                <th className="pb-3 font-medium">Attendance</th>
                <th className="pb-3 font-medium">Internals</th>
                <th className="pb-3 font-medium">Backlogs</th>
                <th className="pb-3 font-medium">Fee</th>
                <th className="pb-3 font-medium">SGPA</th>
                <th className="pb-3 font-medium">Score</th>
                <th className="pb-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map(({ s, e }) => (
                <tr key={s.id}>
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      <img src={s.photo} alt="" className="w-8 h-8 rounded-full bg-slate-200" />
                      <div>
                        <p className="font-medium">{s.name}</p>
                        <p className="text-xs text-slate-500">{s.rollNo}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3">{s.attendance >= 75 ? <Check /> : <XIcon />}{s.attendance}%</td>
                  <td className="py-3">{(s.internalMarks / 40) * 100 >= 40 ? <Check /> : <XIcon />}{s.internalMarks}/40</td>
                  <td className="py-3">{s.backlogs === 0 ? <Check /> : <XIcon />}{s.backlogs}</td>
                  <td className="py-3">{s.feePaid ? <Check /> : <XIcon />}{s.feePaid ? "Paid" : "Due"}</td>
                  <td className="py-3">{s.previousResult >= 5 ? <Check /> : <XIcon />}{s.previousResult}</td>
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500" style={{ width: `${e.eligibilityPct}%` }} />
                      </div>
                      <span className="text-xs">{e.eligibilityPct}%</span>
                    </div>
                  </td>
                  <td className="py-3">{e.eligible ? <Badge variant="green">Eligible</Badge> : <Badge variant="red">Not Eligible</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Criterion({ label, icon }: { label: string; icon: string }) {
  return (
    <div className="p-3 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-900">
      <div className="text-2xl mb-1">{icon}</div>
      <p className="text-sm font-medium text-indigo-900 dark:text-indigo-200">{label}</p>
    </div>
  );
}
function Check() { return <span className="inline-block mr-1 text-emerald-500">✓</span>; }
function XIcon() { return <span className="inline-block mr-1 text-rose-500">✗</span>; }

// ==================== HALL TICKETS ====================
export function AdminHallTickets() {
  type HallTicketRow = {
    id: number;
    hall_ticket_no: string;
    student_id: number;
    student_name: string;
    roll_no: string;
    department: string;
    photo: string;
    seat_number: string;
    room: string;
    exam: string;
    qr_code_content: string;
  };

  const [tickets, setTickets] = useState<HallTicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<number | null>(null);
  const [editing, setEditing] = useState<{ seat_number: string; room: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/admin/halltickets`, { headers: { Authorization: `Bearer ${token()}` } });
      if (res.ok) setTickets(await res.json());
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const generateAll = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`${API}/api/admin/halltickets/generate-all`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
        body: "{}",
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.detail || "Failed to generate");
      setMessage(j.message);
      await load();
    } catch (e: any) {
      alert(e.message);
    }
    setBusy(false);
  };

  const saveTicket = async (id: number) => {
    if (!editing) return;
    setBusy(true);
    try {
      const res = await fetch(`${API}/api/admin/halltickets/${id}/update`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
        body: JSON.stringify(editing),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.detail || "Failed to update");
      setMessage("Hall ticket updated");
      setSelected(null);
      setEditing(null);
      await load();
    } catch (e: any) {
      alert(e.message);
    }
    setBusy(false);
  };

  if (loading) return <div className="p-10 text-center text-slate-500">Loading hall tickets from MySQL…</div>;

  return (
    <div>
      <PageHeader title="Hall Ticket Management" subtitle="View, edit seat & hall numbers, and generate tickets"
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => window.location.href = "/admin/seating"}>
              <MapPin className="w-4 h-4" /> Seating Arrangement
            </Button>
            <Button variant="primary" onClick={generateAll} disabled={busy}>
              <QrCode className="w-4 h-4" /> {busy ? "Working…" : "Generate / Sync All"}
            </Button>
          </div>
        } />

      {message && (
        <div className="mb-4 p-3 rounded-lg bg-emerald-50 text-emerald-700 text-sm dark:bg-emerald-900/20 dark:text-emerald-300">{message}</div>
      )}

      <Card className="overflow-hidden mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr className="text-left text-slate-600 dark:text-slate-300">
                <th className="p-4 font-medium">Student</th>
                <th className="p-4 font-medium">Hall Ticket</th>
                <th className="p-4 font-medium">Exam Hall</th>
                <th className="p-4 font-medium">Seat</th>
                <th className="p-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {tickets.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <img src={t.photo} alt="" className="w-10 h-10 rounded-full bg-slate-200" />
                      <div>
                        <p className="font-medium">{t.student_name}</p>
                        <p className="text-xs text-slate-500">{t.roll_no} • {t.department}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 font-mono text-xs">{t.hall_ticket_no}</td>
                  <td className="p-4">
                    {selected === t.id ? (
                      <TextInput value={editing?.room ?? t.room} onChange={(e) => setEditing({ ...(editing || { seat_number: t.seat_number, room: t.room }), room: e.target.value })} />
                    ) : t.room}
                  </td>
                  <td className="p-4">
                    {selected === t.id ? (
                      <TextInput value={editing?.seat_number ?? t.seat_number} onChange={(e) => setEditing({ ...(editing || { seat_number: t.seat_number, room: t.room }), seat_number: e.target.value })} className="w-24" />
                    ) : <span className="font-semibold text-indigo-600">{t.seat_number}</span>}
                  </td>
                  <td className="p-4 text-right">
                    {selected === t.id ? (
                      <div className="flex justify-end gap-1">
                        <Button variant="primary" onClick={() => saveTicket(t.id)} disabled={busy}><Save className="w-3.5 h-3.5" /> Save</Button>
                        <Button variant="secondary" onClick={() => { setSelected(null); setEditing(null); }}>Cancel</Button>
                      </div>
                    ) : (
                      <div className="flex justify-end gap-1">
                        <Button variant="secondary" onClick={() => { setSelected(t.id); setEditing({ seat_number: t.seat_number, room: t.room }); }}>
                          <Edit2 className="w-3.5 h-3.5" /> Edit
                        </Button>
                        <Button variant="secondary" onClick={() => {
                          const student: Student = { id: `s${t.student_id}`, rollNo: t.roll_no, name: t.student_name, email: "", mobile: "", department: t.department, semester: 5, section: "A", photo: t.photo, attendance: 75, internalMarks: 30, assignmentMarks: 7, previousResult: 7, backlogs: 0, feePaid: true, feeAmount: 45000, feeDueDate: "", createdAt: "" };
                          downloadHT(student, t.hall_ticket_no, t.room, t.seat_number, t.qr_code_content);
                        }}>
                          <Download className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {tickets.length === 0 && (
                <tr><td colSpan={5} className="p-10 text-center text-slate-500">No hall tickets yet. Use Seating Arrangement then Sync, or Generate All.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function HallTicketPreview({ student, hallTicketNo, onClose }: { student: Student; hallTicketNo: string; onClose: () => void }) {
  const exam = {
    subjectCode: "CS301", subjectName: "Data Structures & Algorithms",
    date: "2026-11-10", time: "10:00 AM", duration: "3 hours", room: "Hall A-101"
  };
  const seatNumber = `S${100 + parseInt(student.id.replace(/\D/g, ""))}`;
  const qrValue = JSON.stringify({ htNo: hallTicketNo, name: student.name, roll: student.rollNo, seat: seatNumber, room: exam.room, verified: true });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-slate-200 p-4 flex justify-between items-center">
          <h3 className="font-bold">Hall Ticket Preview</h3>
          <div className="flex gap-2">
            <Button variant="primary" onClick={() => downloadHT(student, hallTicketNo)}><Download className="w-4 h-4" /> Download PDF</Button>
            <Button variant="secondary" onClick={() => window.print()}><Printer className="w-4 h-4" /> Print</Button>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 px-2">✕</button>
          </div>
        </div>
        <div className="p-8 bg-gradient-to-br from-slate-50 to-indigo-50">
          <div className="bg-white border-2 border-indigo-600 rounded-xl overflow-hidden">
            <div className="bg-brand-gradient text-white p-4 flex items-center justify-between">
              <div>
                <p className="font-bold text-lg">National Institute of Technology</p>
                <p className="text-xs opacity-90">End Semester Examination • Nov 2026</p>
              </div>
              <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur flex items-center justify-center text-2xl font-bold">NIT</div>
            </div>
            <div className="p-6">
              <div className="text-center mb-4 pb-4 border-b border-slate-200">
                <p className="text-xs uppercase tracking-wider text-slate-500">Official Hall Ticket</p>
                <p className="font-mono font-bold text-xl text-indigo-600 mt-1">{hallTicketNo}</p>
              </div>
              <div className="grid grid-cols-3 gap-6">
                <div className="col-span-2 space-y-2 text-sm">
                  <Row label="Candidate Name" value={student.name} />
                  <Row label="Roll Number" value={student.rollNo} />
                  <Row label="Department" value={student.department} />
                  <Row label="Semester" value={`Semester ${student.semester}`} />
                  <Row label="Subject" value={exam.subjectName} />
                  <Row label="Subject Code" value={exam.subjectCode} />
                  <Row label="Date & Time" value={`${exam.date} at ${exam.time}`} />
                  <Row label="Duration" value={exam.duration} />
                  <Row label="Exam Hall" value={exam.room} bold />
                  <Row label="Seat Number" value={seatNumber} bold />
                </div>
                <div className="flex flex-col items-center">
                  <img src={student.photo} alt="" className="w-28 h-28 rounded-lg bg-slate-100 border-2 border-indigo-200" />
                  <div className="mt-4 p-3 rounded-lg border-2 border-indigo-200 bg-indigo-50">
                    <QRCodeSVG value={qrValue} size={120} level="H" />
                    <p className="text-[10px] text-center text-slate-600 mt-1 font-medium">Scan to verify</p>
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
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-slate-500">{label}</span>
      <span className={cn(bold ? "font-bold text-indigo-700" : "font-medium text-slate-900")}>{value}</span>
    </div>
  );
}

function downloadHT(student: Student, hallTicketNo: string, room = "Hall A-101", seatNumber?: string, qrContent?: string) {
  const exam = { subjectCode: "CS301", subjectName: "Data Structures & Algorithms", date: "2026-11-10", time: "10:00 AM", duration: "3 hours", room };
  const seat = seatNumber || `S${100 + parseInt(student.id.replace(/\D/g, ""))}`;
  const qrValue = qrContent || JSON.stringify({ htNo: hallTicketNo, name: student.name, roll: student.rollNo, seat, room: exam.room, verified: true });
  const qrDataUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrValue)}`;

  const html = `<!DOCTYPE html><html><head><title>Hall Ticket ${hallTicketNo}</title>
<style>
body{font-family:system-ui,-apple-system,sans-serif;padding:40px;background:#fff;color:#0f172a}
.card{border:3px solid #2563eb;border-radius:12px;overflow:hidden;max-width:800px;margin:0 auto}
.header{background:linear-gradient(135deg,#2563eb,#7c3aed,#db2777);color:#fff;padding:20px;display:flex;justify-content:space-between;align-items:center}
.header h1{font-size:22px;margin:0}
.header p{margin:4px 0 0;opacity:.9;font-size:13px}
.logo{width:60px;height:60px;border-radius:50%;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:bold}
.body{padding:30px}
.title{text-align:center;border-bottom:2px solid #e2e8f0;padding-bottom:12px;margin-bottom:20px}
.title small{text-transform:uppercase;letter-spacing:2px;color:#64748b}
.title h2{font-family:monospace;font-size:24px;color:#2563eb;margin:6px 0 0}
.grid{display:grid;grid-template-columns:2fr 1fr;gap:30px}
.info-row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:14px}
.info-row .l{color:#64748b}
.info-row .v{font-weight:600}
.info-row.bold .v{color:#2563eb;font-weight:700}
.photo{width:140px;height:140px;border-radius:8px;border:2px solid #c7d2fe;background:#f1f5f9}
.qr-box{margin-top:16px;padding:12px;border:2px solid #c7d2fe;border-radius:8px;background:#eff6ff;text-align:center}
.qr-box img{width:140px;height:140px}
.qr-box p{margin:6px 0 0;font-size:10px;color:#475569;font-weight:600}
.footer{margin-top:20px;padding-top:16px;border-top:2px solid #e2e8f0;display:flex;justify-content:space-between;font-size:12px;color:#475569}
@media print{@page{margin:15mm}body{padding:0}}
</style></head><body>
<div class="card">
  <div class="header">
    <div><h1>National Institute of Technology</h1><p>End Semester Examination • Nov 2026</p></div>
    <div class="logo">NIT</div>
  </div>
  <div class="body">
    <div class="title"><small>Official Hall Ticket</small><h2>${hallTicketNo}</h2></div>
    <div class="grid">
      <div>
        <div class="info-row"><span class="l">Candidate Name</span><span class="v">${student.name}</span></div>
        <div class="info-row"><span class="l">Roll Number</span><span class="v">${student.rollNo}</span></div>
        <div class="info-row"><span class="l">Department</span><span class="v">${student.department}</span></div>
        <div class="info-row"><span class="l">Semester</span><span class="v">Semester ${student.semester}</span></div>
        <div class="info-row"><span class="l">Subject</span><span class="v">${exam.subjectName}</span></div>
        <div class="info-row"><span class="l">Subject Code</span><span class="v">${exam.subjectCode}</span></div>
        <div class="info-row"><span class="l">Date & Time</span><span class="v">${exam.date} at ${exam.time}</span></div>
        <div class="info-row"><span class="l">Duration</span><span class="v">${exam.duration}</span></div>
        <div class="info-row bold"><span class="l">Exam Hall</span><span class="v">${exam.room}</span></div>
        <div class="info-row bold"><span class="l">Seat Number</span><span class="v">${seatNumber}</span></div>
      </div>
      <div style="text-align:center">
        <img class="photo" src="${student.photo}" alt="photo"/>
        <div class="qr-box"><img src="${qrDataUrl}" alt="QR"/><p>Scan to verify</p></div>
      </div>
    </div>
    <div class="footer"><span>Issued: ${new Date().toLocaleDateString()}</span><span style="font-weight:700">Controller of Examinations</span></div>
  </div>
</div>
<script>window.onload=()=>{setTimeout(()=>window.print(),400)}</script>
</body></html>`;
  const w = window.open("", "_blank");
  if (w) { w.document.write(html); w.document.close(); }
}

// ==================== BACKLOGS ====================
export function AdminBacklogs() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetchStudents().then((s) => { setStudents(s); setLoading(false); }); }, []);
  if (loading) return <div className="p-10 text-center text-slate-500">Loading from MySQL…</div>;
  const withBacklogs = students.filter((s) => s.backlogs > 0);
  return (
    <div>
      <PageHeader title="Backlog Management" subtitle={`${withBacklogs.length} students with active backlogs`} />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="p-5"><p className="text-xs text-slate-500">Total Backlogs</p><p className="text-3xl font-bold text-rose-600 mt-2">{withBacklogs.reduce((a,s)=>a+s.backlogs,0)}</p></Card>
        <Card className="p-5"><p className="text-xs text-slate-500">Affected Students</p><p className="text-3xl font-bold text-amber-600 mt-2">{withBacklogs.length}</p></Card>
        <Card className="p-5"><p className="text-xs text-slate-500">Avg per Student</p><p className="text-3xl font-bold text-slate-700 dark:text-slate-200 mt-2">{(withBacklogs.reduce((a,s)=>a+s.backlogs,0)/Math.max(1,withBacklogs.length)).toFixed(1)}</p></Card>
      </div>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr className="text-left text-slate-600 dark:text-slate-300">
                <th className="p-4 font-medium">Student</th>
                <th className="p-4 font-medium">Department</th>
                <th className="p-4 font-medium">Backlogs</th>
                <th className="p-4 font-medium">Attendance</th>
                <th className="p-4 font-medium">Eligibility</th>
                <th className="p-4 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {withBacklogs.map((s) => {
                const e = getStudentEligibility(s);
                return (
                  <tr key={s.id}>
                    <td className="p-4"><div className="flex items-center gap-3"><img src={s.photo} className="w-8 h-8 rounded-full" alt="" /><div><p className="font-medium">{s.name}</p><p className="text-xs text-slate-500">{s.rollNo}</p></div></div></td>
                    <td className="p-4">{s.department}</td>
                    <td className="p-4"><Badge variant="red">{s.backlogs} pending</Badge></td>
                    <td className="p-4">{s.attendance}%</td>
                    <td className="p-4">{e.eligibilityPct}%</td>
                    <td className="p-4 text-right"><Button variant="secondary"><Mail className="w-3.5 h-3.5" /> Notify</Button></td>
                  </tr>
                );
              })}
              {withBacklogs.length === 0 && <tr><td colSpan={6} className="p-10 text-center text-slate-500">No students with backlogs 🎉</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ==================== FEES ====================
type PendingFeePayment = {
  id: number;
  student_id: number;
  student_name: string;
  roll_no: string;
  department: string;
  photo?: string;
  amount: number;
  method: string;
  transaction_id: string;
  reference: string;
  status: string;
  paid_at: string | null;
};

export function AdminFees() {
  const [students, setStudents] = useState<Student[]>([]);
  const [pending, setPending] = useState<PendingFeePayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<number | null>(null);

  const reload = async () => {
    const [studentRows, feeData] = await Promise.all([
      fetchStudents(),
      fetch(`${API}/api/admin/fees`, { headers: { Authorization: `Bearer ${token()}` } })
        .then((r) => (r.ok ? r.json() : { pending_verifications: [] }))
        .catch(() => ({ pending_verifications: [] })),
    ]);
    setStudents(studentRows);
    setPending(feeData.pending_verifications || []);
    setLoading(false);
  };

  useEffect(() => { reload(); }, []);

  const approvePayment = async (paymentId: number) => {
    setActionId(paymentId);
    try {
      const res = await fetch(`${API}/api/admin/fees/payments/${paymentId}/approve`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ admin_note: "Verified and approved" }),
      });
      if (!res.ok) throw new Error(await errorMessage(res, "Approval failed"));
      await reload();
    } catch (err: any) {
      alert(err.message || "Approval failed");
    } finally {
      setActionId(null);
    }
  };

  const rejectPayment = async (paymentId: number) => {
    const note = window.prompt("Reason for rejection (optional):") ?? "Rejected by admin";
    setActionId(paymentId);
    try {
      const res = await fetch(`${API}/api/admin/fees/payments/${paymentId}/reject`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ admin_note: note }),
      });
      if (!res.ok) throw new Error(await errorMessage(res, "Rejection failed"));
      await reload();
    } catch (err: any) {
      alert(err.message || "Rejection failed");
    } finally {
      setActionId(null);
    }
  };

  if (loading) return <div className="p-10 text-center text-slate-500">Loading from MySQL…</div>;
  const paid = students.filter(s => s.feePaid);
  const unpaid = students.filter(s => !s.feePaid);
  const totalDue = unpaid.reduce((a, s) => a + s.feeAmount, 0);
  const totalCollected = paid.reduce((a, s) => a + s.feeAmount, 0);

  const methodLabel = (method: string) => {
    if (method === "online") return "Online";
    if (method === "bank_transfer") return "Bank Transfer";
    if (method === "college") return "College Office";
    return method;
  };

  return (
    <div>
      <PageHeader title="Fee Payment Management" subtitle="Verify student payments and track fee collection" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-5"><p className="text-xs text-slate-500">Total Collected</p><p className="text-2xl font-bold text-emerald-600 mt-2">₹{totalCollected.toLocaleString()}</p></Card>
        <Card className="p-5"><p className="text-xs text-slate-500">Total Due</p><p className="text-2xl font-bold text-rose-600 mt-2">₹{totalDue.toLocaleString()}</p></Card>
        <Card className="p-5"><p className="text-xs text-slate-500">Awaiting Verification</p><p className="text-2xl font-bold text-indigo-600 mt-2">{pending.length}</p></Card>
        <Card className="p-5"><p className="text-xs text-slate-500">Pending Students</p><p className="text-2xl font-bold text-amber-600 mt-2">{unpaid.length}</p></Card>
      </div>

      <Card className="overflow-hidden mb-6">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 font-semibold text-slate-900 dark:text-white">
          Pending Verifications
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr className="text-left text-slate-600 dark:text-slate-300">
                <th className="p-4 font-medium">Student</th>
                <th className="p-4 font-medium">Method</th>
                <th className="p-4 font-medium">Amount</th>
                <th className="p-4 font-medium">Transaction</th>
                <th className="p-4 font-medium">Submitted</th>
                <th className="p-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {pending.map((p) => (
                <tr key={p.id}>
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <img src={p.photo || "https://api.dicebear.com/7.x/avataaars/svg?seed=student"} className="w-8 h-8 rounded-full" alt="" />
                      <div>
                        <span className="font-medium block">{p.student_name}</span>
                        <span className="text-xs text-slate-500">{p.roll_no} • {p.department}</span>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">{methodLabel(p.method)}</td>
                  <td className="p-4 font-semibold">₹{p.amount.toLocaleString()}</td>
                  <td className="p-4">
                    <div>{p.transaction_id}</div>
                    {p.reference && <div className="text-xs text-slate-500">{p.reference}</div>}
                  </td>
                  <td className="p-4">{p.paid_at ? new Date(p.paid_at).toLocaleString() : "—"}</td>
                  <td className="p-4 text-right">
                    <div className="flex gap-2 justify-end">
                      <Button variant="secondary" disabled={actionId === p.id} onClick={() => rejectPayment(p.id)}>
                        <X className="w-3.5 h-3.5" /> Reject
                      </Button>
                      <Button variant="primary" disabled={actionId === p.id} onClick={() => approvePayment(p.id)}>
                        <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {pending.length === 0 && (
                <tr><td colSpan={6} className="p-10 text-center text-slate-500">No payments awaiting verification</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 font-semibold text-slate-900 dark:text-white">Unpaid Students</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr className="text-left text-slate-600 dark:text-slate-300">
                <th className="p-4 font-medium">Student</th>
                <th className="p-4 font-medium">Roll No</th>
                <th className="p-4 font-medium">Amount</th>
                <th className="p-4 font-medium">Due Date</th>
                <th className="p-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {unpaid.map((s) => {
                const overdue = new Date(s.feeDueDate) < new Date();
                return (
                  <tr key={s.id}>
                    <td className="p-4"><div className="flex items-center gap-3"><img src={s.photo} className="w-8 h-8 rounded-full" alt="" /><span className="font-medium">{s.name}</span></div></td>
                    <td className="p-4 text-slate-600 dark:text-slate-300">{s.rollNo}</td>
                    <td className="p-4 font-semibold">₹{s.feeAmount.toLocaleString()}</td>
                    <td className="p-4">{s.feeDueDate} {overdue && <Badge variant="red">Overdue</Badge>}</td>
                    <td className="p-4 text-right"><div className="flex gap-2 justify-end">
                      <Button variant="secondary"><Mail className="w-3.5 h-3.5" /> Remind</Button>
                      <Button variant="primary" onClick={async () => {
                        const sid = s.id.replace("s", "");
                        try {
                          const res = await fetch(`${API}/api/admin/fees/${sid}/mark-paid`, { method: "PUT", headers: { Authorization: `Bearer ${token()}` } });
                          if (!res.ok) throw new Error(await errorMessage(res, "Mark paid failed"));
                          await reload();
                        } catch (err: any) {
                          alert(err.message || "Mark paid failed");
                        }
                      }}><CheckCircle2 className="w-3.5 h-3.5" /> Mark Paid</Button>
                    </div></td>
                  </tr>
                );
              })}
              {unpaid.length === 0 && <tr><td colSpan={5} className="p-10 text-center text-slate-500">All fees collected 🎉</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
// ==================== NOTIFICATIONS ====================
export function AdminNotifications() {
  const { notifications, add, markAllRead } = useNotifications();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [audience, setAudience] = useState<"all" | "students" | "teachers" | "admin">("all");

  const send = async () => {
    if (!title || !message) return;
    try {
      await fetch("http://localhost:8000/api/admin/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("examshield_token") || ""}` },
        body: JSON.stringify({ title, message, audience }),
      });
    } catch {}
    add({ title, message, audience });
    setTitle(""); setMessage("");
  };

  return (
    <div>
      <PageHeader title="Notifications" subtitle="Send announcements to students, teachers, or everyone" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="font-bold text-slate-900 dark:text-white mb-4">Compose Notification</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Title</label>
              <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Exam Schedule Updated" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Message</label>
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Audience</label>
              <Select value={audience} onChange={(e) => setAudience(e.target.value as any)}>
                <option value="all">Everyone</option>
                <option value="students">Students only</option>
                <option value="teachers">Teachers only</option>
                <option value="admin">Admins only</option>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button variant="primary" onClick={send}><Mail className="w-4 h-4" /> Send Notification</Button>
              <Button variant="secondary" onClick={markAllRead}>Mark all read</Button>
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <h3 className="font-bold text-slate-900 dark:text-white mb-4">Recent Notifications</h3>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {notifications.map((n) => (
              <div key={n.id} className="p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                <div className="flex items-start justify-between">
                  <p className="font-semibold text-sm">{n.title}</p>
                  <Badge variant="sky">{n.audience}</Badge>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{n.message}</p>
                <p className="text-xs text-slate-400 mt-1">{n.createdAt}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ==================== ANALYTICS ====================
export function AdminAnalytics() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetchStudents().then((s) => { setStudents(s); setLoading(false); }); }, []);
  if (loading) return <div className="p-10 text-center text-slate-500">Loading from MySQL…</div>;

  const deptData = Object.entries(
    students.reduce<Record<string, number>>((acc, s) => { acc[s.department] = (acc[s.department] || 0) + 1; return acc; }, {})
  ).map(([name, value]) => ({ name, value }));
  const attendanceData = students.map(s => ({ name: s.name.split(" ")[0], attendance: s.attendance }));
  const COLORS = ["#2563eb", "#7c3aed", "#db2777", "#059669", "#f59e0b"];

  return (
    <div>
      <PageHeader title="Analytics Dashboard" subtitle={`In-depth insights from ${students.length} students`} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card className="p-5">
          <h3 className="font-semibold mb-4">Student Distribution by Department</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={deptData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,.3)" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip contentStyle={{ background: "rgba(15,23,42,.9)", border: "none", borderRadius: 8, color: "#fff" }} />
                <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                  {deptData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-5">
          <h3 className="font-semibold mb-4">Attendance per Student</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={attendanceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,.3)" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip contentStyle={{ background: "rgba(15,23,42,.9)", border: "none", borderRadius: 8, color: "#fff" }} />
                <Bar dataKey="attendance" fill="#10b981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
      <Card className="p-5">
        <h3 className="font-semibold mb-4">Attendance Trends (7 days)</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={[
              { day: "Mon", attendance: 84 }, { day: "Tue", attendance: 78 },
              { day: "Wed", attendance: 86 }, { day: "Thu", attendance: 81 },
              { day: "Fri", attendance: 73 }, { day: "Sat", attendance: 88 }, { day: "Sun", attendance: 0 },
            ]}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,.3)" />
              <XAxis dataKey="day" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} />
              <Tooltip contentStyle={{ background: "rgba(15,23,42,.9)", border: "none", borderRadius: 8, color: "#fff" }} />
              <Line type="monotone" dataKey="attendance" stroke="#2563eb" strokeWidth={3} dot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}

// ==================== REPORTS ====================
export function AdminReports() {
  const [downloading, setDownloading] = useState<string | null>(null);
  const reports = [
    { name: "Attendance Report", type: "attendance", desc: "Daily attendance records for all students", icon: ClipboardList },
    { name: "Internal Marks Report", type: "marks", desc: "Detailed internal marks analysis", icon: FileText },
    { name: "Eligibility Report", type: "eligibility", desc: "Comprehensive eligibility status", icon: TicketCheck },
    { name: "Examination Report", type: "examination", desc: "Exam schedule and results summary", icon: Calendar },
    { name: "Backlog Report", type: "backlog", desc: "Students with pending backlogs", icon: AlertTriangle },
    { name: "Fee Report", type: "fee", desc: "Fee collection and pending dues", icon: Wallet },
  ];

  const downloadReport = async (reportType: string, format: "pdf" | "excel") => {
    const key = `${reportType}-${format}`;
    setDownloading(key);
    try {
      await downloadAdminReport(reportType, format);
    } catch (e: any) {
      alert(e?.message || "Failed to generate report");
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div>
      <PageHeader title="Reports" subtitle="Generate and export comprehensive reports (PDF / Excel from MySQL data)" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {reports.map((r) => (
          <Card key={r.name} className="p-5 hover:shadow-lg transition-shadow">
            <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-3">
              <r.icon className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-900 dark:text-white">{r.name}</h3>
            <p className="text-sm text-slate-500 mt-1 mb-4">{r.desc}</p>
            <div className="flex gap-2">
              <Button variant="primary" className="flex-1" disabled={!!downloading} onClick={() => downloadReport(r.type, "pdf")}>
                <Download className="w-3.5 h-3.5" /> {downloading === `${r.type}-pdf` ? "Generating…" : "PDF"}
              </Button>
              <Button variant="secondary" className="flex-1" disabled={!!downloading} onClick={() => downloadReport(r.type, "excel")}>
                <FileText className="w-3.5 h-3.5" /> {downloading === `${r.type}-excel` ? "Generating…" : "Excel"}
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ==================== SETTINGS ====================
export function AdminSettings() {
  return (
    <div>
      <PageHeader title="System Settings" subtitle="Configure ExamShield AI" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <SettingsIcon className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold">University Information</h3>
          </div>
          <div className="space-y-3">
            <Field label="University Name"><TextInput defaultValue="National Institute of Technology" /></Field>
            <Field label="Academic Year"><TextInput defaultValue="2026-27" /></Field>
            <Field label="Current Semester"><Select defaultValue="5"><option>5</option><option>6</option></Select></Field>
            <Field label="Contact Email"><TextInput defaultValue="admin@nit.edu" /></Field>
          </div>
          <Button variant="primary" className="mt-4"><Save className="w-4 h-4" /> Save Settings</Button>
        </Card>
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <BrainCircuit className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold">AI Configuration</h3>
          </div>
          <div className="space-y-3">
            <Field label="Eligibility Threshold (Attendance %)"><TextInput type="number" defaultValue="75" /></Field>
            <Field label="Internal Marks Threshold (%)"><TextInput type="number" defaultValue="40" /></Field>
            <Field label="Min SGPA"><TextInput type="number" step="0.1" defaultValue="5.0" /></Field>
            <Field label="ML Model">
              <Select defaultValue="rf"><option value="rf">Random Forest Classifier</option><option value="dt">Decision Tree</option></Select>
            </Field>
          </div>
          <Button variant="primary" className="mt-4"><Save className="w-4 h-4" /> Apply</Button>
        </Card>
      </div>
    </div>
  );
}
