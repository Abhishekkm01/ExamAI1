import { useState, useMemo, useEffect } from "react";
import { Card, PageHeader, Button, Badge, TextInput, Select } from "../../components/Layout";
import { fetchStudents, fetchTeachers, fetchAdminExams, getStudentEligibility, fetchAttendanceTrends } from "../../data/apiData";
import { downloadAdminReport, api } from "../../data/api";
import { apiDelete, apiPost, apiPut } from "../../data/http";
import type { Student, Teacher, Exam } from "../../data/types";
import { useNotifications } from "../../contexts/AppContext";
import { Search, Plus, Edit2, Trash2, Eye, Download, Upload, Printer, QrCode, Mail, CheckCircle2, FileText, Wallet, AlertTriangle, Settings as SettingsIcon, Save, Calendar, Clock, MapPin, ClipboardList, TicketCheck, BrainCircuit, X, Database } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Cell, Legend } from "recharts";
import { QRCodeSVG } from "qrcode.react";
import { cn } from "../../utils/cn";
import { useDepartments } from "../../hooks/useDepartments";
import { notifySystemSettingsUpdated, useSystemSettings } from "../../hooks/useSystemSettings";
import { DepartmentSelect } from "../../components/DepartmentSelect";
import { examHeaderSubtitle, downloadHallTicket, universityInitials, DEFAULT_HALL_TICKET_EXAM } from "../../utils/hallTicket";
import { INTERNAL_MARKS_MAX, ASSIGNMENT_MARKS_MAX, INTERNAL_ASSIGNMENT_TOTAL } from "../../data/marksConstants";

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
  const { departments: depts, loading: deptsLoading } = useDepartments();
  const pageSize = 5;

  useEffect(() => { fetchStudents().then((s) => { setList(s); setLoading(false); }); }, []);

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
      await api.adminDeleteStudent(Number(sid));
    } catch (e: any) {
      alert(e?.message || "Failed to delete student");
      return;
    }
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
          {/* <Button variant="secondary"><Upload className="w-4 h-4" /> Bulk Upload</Button> */}
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
                    <td className="p-4">{s.internalMarks}/{INTERNAL_MARKS_MAX}</td>
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
                await api.adminUpdateStudent(Number(sid), payload);
                setList((l) => l.map((x) => x.id === s.id ? s : x));
              } catch (e: any) {
                alert(e?.message || "Failed to update student");
                return;
              }
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
                }) as { student_id: number };
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
          <Field label={`Internal Marks /${INTERNAL_MARKS_MAX}`}><TextInput type="number" min={0} max={INTERNAL_MARKS_MAX} value={form.internalMarks} onChange={(e) => update("internalMarks", +e.target.value)} /></Field>
          <Field label={`Assignment Marks /${ASSIGNMENT_MARKS_MAX}`}><TextInput type="number" min={0} max={ASSIGNMENT_MARKS_MAX} value={form.assignmentMarks} onChange={(e) => update("assignmentMarks", +e.target.value)} /></Field>
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
            <Info label="Internal Marks" value={`${student.internalMarks}/${INTERNAL_MARKS_MAX}`} ok={(student.internalMarks / INTERNAL_MARKS_MAX) * 100 >= 40} />
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
        const res = await apiAddTeacher({ ...payload, password: form.password || "teacher123" }) as { teacher_id: number };
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
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const initialSubjects = exam?.subjects?.length
    ? exam.subjects.map((s) => ({
        subject_code: s.subjectCode,
        subject_name: s.subjectName,
        exam_date: s.date || exam?.date || "2026-11-10",
        exam_time: s.time || exam?.time || "10:00 AM",
        duration: s.duration || exam?.duration || "3 hours",
      }))
    : [{
        subject_code: exam?.subjectCode || "",
        subject_name: exam?.subjectName || "",
        exam_date: exam?.date || "2026-11-10",
        exam_time: exam?.time || "10:00 AM",
        duration: exam?.duration || "3 hours",
      }];
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
    requires_face_verification: exam?.requiresFaceVerification ?? true,
    invigilator_id: exam?.invigilatorId ?? "",
  });
  const [subjects, setSubjects] = useState(initialSubjects);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetchTeachers().then(setTeachers).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isEdit && departments.length && !form.department) {
      setForm((f) => ({ ...f, department: departments[0] }));
    }
  }, [departments, isEdit, form.department]);

  const addSubject = () => {
    setSubjects((list) => [...list, {
      subject_code: "",
      subject_name: "",
      exam_date: form.exam_date,
      exam_time: form.exam_time,
      duration: form.duration,
    }]);
  };

  const updateSubject = (idx: number, field: string, value: string) => {
    setSubjects((list) => list.map((s, i) => i === idx ? { ...s, [field]: value } : s));
    if (idx === 0) {
      if (field === "subject_code") setForm((f) => ({ ...f, subject_code: value }));
      if (field === "subject_name") setForm((f) => ({ ...f, subject_name: value }));
      if (field === "exam_date") setForm((f) => ({ ...f, exam_date: value }));
      if (field === "exam_time") setForm((f) => ({ ...f, exam_time: value }));
      if (field === "duration") setForm((f) => ({ ...f, duration: value }));
    }
  };

  const removeSubject = (idx: number) => {
    if (subjects.length <= 1) return;
    setSubjects((list) => list.filter((_, i) => i !== idx));
  };

  const save = async () => {
    setSaving(true); setErr(null);
    const payload = {
      ...form,
      invigilator_id: form.invigilator_id ? Number(form.invigilator_id) : null,
      subjects: subjects.filter((s) => s.subject_code && s.subject_name),
    };
    if (payload.requires_face_verification && !payload.invigilator_id) {
      setErr("Please assign an invigilator for face verification.");
      setSaving(false);
      return;
    }
    if (!payload.subjects.length) {
      setErr("Add at least one subject for the hall ticket.");
      setSaving(false);
      return;
    }
    try {
      if (isEdit && exam) {
        const eid = exam.id.replace(/^e/, "");
        await apiPut(`/api/admin/exams/${eid}/update`, payload, "Failed to update exam");
        onSaved({
          ...exam,
          subjectCode: payload.subjects[0].subject_code,
          subjectName: payload.subjects[0].subject_name,
          department: form.department,
          semester: form.semester,
          date: form.exam_date,
          time: form.exam_time,
          duration: form.duration,
          room: form.room,
          totalMarks: form.total_marks,
          requiresFaceVerification: form.requires_face_verification,
          invigilatorId: payload.invigilator_id,
          invigilatorName: teachers.find((t) => Number(t.id.replace(/^t/, "")) === payload.invigilator_id)?.name || null,
          subjects: payload.subjects.map((s) => ({
            subjectCode: s.subject_code,
            subjectName: s.subject_name,
            date: s.exam_date,
            time: s.exam_time,
            duration: s.duration,
          })),
        });
      } else {
        const res = await apiAddExam(payload) as { exam_id: number };
        onSaved({
          id: `e${res.exam_id}`,
          subjectCode: payload.subjects[0].subject_code,
          subjectName: payload.subjects[0].subject_name,
          department: form.department,
          semester: form.semester,
          date: form.exam_date,
          time: form.exam_time,
          duration: form.duration,
          room: form.room,
          totalMarks: form.total_marks,
          requiresFaceVerification: form.requires_face_verification,
          invigilatorId: payload.invigilator_id,
          invigilatorName: teachers.find((t) => Number(t.id.replace(/^t/, "")) === payload.invigilator_id)?.name || null,
          subjects: payload.subjects.map((s) => ({
            subjectCode: s.subject_code,
            subjectName: s.subject_name,
            date: s.exam_date,
            time: s.exam_time,
            duration: s.duration,
          })),
        });
      }
    } catch (e: any) { setErr(e.message); }
    setSaving(false);
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-2xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-lg font-bold">{isEdit ? "Edit Exam" : "Schedule Exam"}</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="p-6 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Subjects (shown on hall ticket)</p>
            <Button variant="secondary" onClick={addSubject}><Plus className="w-3.5 h-3.5" /> Add Subject</Button>
          </div>
          {subjects.map((subj, idx) => (
            <div key={idx} className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-slate-500">Subject {idx + 1}</p>
                {subjects.length > 1 && (
                  <button onClick={() => removeSubject(idx)} className="text-rose-500 text-xs">Remove</button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <TextInput value={subj.subject_code} onChange={(e) => updateSubject(idx, "subject_code", e.target.value)} placeholder="CS301" />
                <TextInput value={subj.subject_name} onChange={(e) => updateSubject(idx, "subject_name", e.target.value)} placeholder="Data Structures" />
                <TextInput type="date" value={subj.exam_date} onChange={(e) => updateSubject(idx, "exam_date", e.target.value)} />
                <TextInput value={subj.exam_time} onChange={(e) => updateSubject(idx, "exam_time", e.target.value)} placeholder="10:00 AM" />
                <TextInput value={subj.duration} onChange={(e) => updateSubject(idx, "duration", e.target.value)} placeholder="3 hours" className="col-span-2" />
              </div>
            </div>
          ))}
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
            <Field label="Exam Hall / Room"><TextInput value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} placeholder="Hall A-101" /></Field>
            <Field label="Total Marks"><TextInput type="number" value={form.total_marks} onChange={(e) => setForm({ ...form, total_marks: +e.target.value })} /></Field>
          </div>
          <Field label="Invigilator (Face Verification)">
            <Select
              value={form.invigilator_id}
              onChange={(e) => setForm({ ...form, invigilator_id: e.target.value })}
            >
              <option value="">Select invigilator…</option>
              {teachers
                .filter((t) => !form.department || t.department === form.department)
                .map((t) => (
                  <option key={t.id} value={t.id.replace(/^t/, "")}>{t.name} ({t.empId})</option>
                ))}
            </Select>
          </Field>
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              checked={form.requires_face_verification}
              onChange={(e) => setForm({ ...form, requires_face_verification: e.target.checked })}
            />
            Require face verification by assigned invigilator at exam entry
          </label>
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
  const [exams, setExams] = useState<Exam[]>([]);
  const [subjectCode, setSubjectCode] = useState("CS301");
  const [marks, setMarks] = useState<Record<string, { internal: number; assignment: number }>>({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const maxTotal = INTERNAL_ASSIGNMENT_TOTAL;

  useEffect(() => {
    Promise.all([fetchStudents(), fetchAdminExams()]).then(([s, e]) => {
      setStudents(s);
      setExams(e);
      const codes = e.flatMap((x) => (x.subjects?.length ? x.subjects.map((sub) => sub.subjectCode) : [x.subjectCode]));
      if (codes.length && !codes.includes(subjectCode)) setSubjectCode(codes[0]);
      setMarks(Object.fromEntries(s.map((x) => [
        x.id,
        { internal: x.internalMarks, assignment: x.assignmentMarks },
      ])));
      setLoading(false);
    });
  }, []);

  const subjectOptions = Array.from(new Set(
    exams.flatMap((e) => (e.subjects?.length ? e.subjects.map((s) => s.subjectCode) : [e.subjectCode]))
  ));

  const filtered = students.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()));

  const saveMarks = async (student: Student) => {
    const m = marks[student.id];
    if (!m) return;
    if (m.internal > INTERNAL_MARKS_MAX) {
      setError(`Internal marks cannot exceed ${INTERNAL_MARKS_MAX}.`);
      return;
    }
    if (m.assignment > ASSIGNMENT_MARKS_MAX) {
      setError(`Assignment marks cannot exceed ${ASSIGNMENT_MARKS_MAX}.`);
      return;
    }
    if (m.internal + m.assignment > maxTotal) {
      setError(`Total marks (${m.internal + m.assignment}) cannot exceed ${INTERNAL_ASSIGNMENT_TOTAL} (internal ${INTERNAL_MARKS_MAX} + assignment ${ASSIGNMENT_MARKS_MAX}).`);
      return;
    }
    setSavingId(student.id);
    setError(null);
    setMessage(null);
    try {
      const sid = parseInt(student.id.replace(/^s/, ""), 10);
      await api.adminUpdateStudent(sid, {
        internal_marks: m.internal,
        assignment_marks: m.assignment,
        subject_code: subjectCode,
      });
      setMessage(`Marks updated for ${student.name}`);
      setStudents((list) => list.map((s) => s.id === student.id ? {
        ...s,
        internalMarks: m.internal,
        assignmentMarks: m.assignment,
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
          <Select value={subjectCode} onChange={(e) => setSubjectCode(e.target.value)} className="w-40">
            {(subjectOptions.length ? subjectOptions : [subjectCode]).map((code) => (
              <option key={code} value={code}>{code}</option>
            ))}
          </Select>
        </div>
        <p className="text-xs text-slate-500 mt-2">Internal max: {INTERNAL_MARKS_MAX} • Assignment max: {ASSIGNMENT_MARKS_MAX} • Combined total: {INTERNAL_ASSIGNMENT_TOTAL}</p>
      </Card>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr className="text-left text-slate-600 dark:text-slate-300">
                <th className="p-4 font-medium">Student</th>
                <th className="p-4 font-medium">Department</th>
                <th className="p-4 font-medium">Internal /{INTERNAL_MARKS_MAX}</th>
                <th className="p-4 font-medium">Assignment /{ASSIGNMENT_MARKS_MAX}</th>
                <th className="p-4 font-medium">Total /{maxTotal}</th>
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
                        max={INTERNAL_MARKS_MAX}
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
                        max={ASSIGNMENT_MARKS_MAX}
                        step={0.5}
                        value={m.assignment}
                        onChange={(e) => setMarks({ ...marks, [s.id]: { ...m, assignment: +e.target.value } })}
                        className="w-20 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                      />
                    </td>
                    <td className={cn("p-4 font-semibold", m.internal + m.assignment > maxTotal && "text-rose-600")}>{m.internal + m.assignment}/{maxTotal}</td>
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
          <Criterion label={`≥ 40% Internals (/${INTERNAL_MARKS_MAX})`} icon="📝" />
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
                  <td className="py-3">{(s.internalMarks / INTERNAL_MARKS_MAX) * 100 >= 40 ? <Check /> : <XIcon />}{s.internalMarks}/{INTERNAL_MARKS_MAX}</td>
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
type HallTicketSubjectRow = {
  subject_code: string;
  subject_name: string;
  exam_date?: string;
  exam_time?: string;
  duration?: string;
  seat_number: string;
  room: string;
};

type SeatConflict = {
  subject_code: string;
  subject_name: string;
  seat_number: string;
  room: string;
  assigned_to: string;
  assigned_roll_no?: string;
  suggested_seat: string;
  exam_date?: string;
  exam_time?: string;
};

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
    subject_code?: string;
    exam_date?: string;
    exam_time?: string;
    duration?: string;
    subjects?: HallTicketSubjectRow[];
    has_seat_conflict?: boolean;
    seat_conflicts?: SeatConflict[];
    qr_code_content: string;
  };

  const [tickets, setTickets] = useState<HallTicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editSubjects, setEditSubjects] = useState<HallTicketSubjectRow[]>([]);
  const [seatConflicts, setSeatConflicts] = useState<SeatConflict[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { settings: systemSettings } = useSystemSettings();

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.adminHallTickets();
      setTickets(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e.message || "Failed to load hall tickets");
      setTickets([]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openEdit = (t: HallTicketRow) => {
    const base = t.subjects?.length
      ? t.subjects.map((s) => ({
          subject_code: s.subject_code,
          subject_name: s.subject_name,
          exam_date: s.exam_date,
          exam_time: s.exam_time,
          duration: s.duration,
          seat_number: s.seat_number || t.seat_number,
          room: s.room || t.room,
        }))
      : [{
          subject_code: t.subject_code || "",
          subject_name: t.exam,
          exam_date: t.exam_date,
          exam_time: t.exam_time,
          duration: t.duration,
          seat_number: t.seat_number,
          room: t.room,
        }];
    setEditSubjects(base);
    setEditingId(t.id);
    setSeatConflicts(t.seat_conflicts || []);
    setMessage(null);
    setError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditSubjects([]);
    setSeatConflicts([]);
  };

  const generateAll = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const j = await api.generateAllHallTickets();
      setMessage(j.message);
      await load();
    } catch (e: any) {
      alert(e.message);
    }
    setBusy(false);
  };

  const applySuggestedSeats = (conflicts: SeatConflict[]) => {
    setEditSubjects((list) => list.map((s) => {
      const hit = conflicts.find((c) => c.subject_code === s.subject_code);
      return hit ? { ...s, seat_number: hit.suggested_seat } : s;
    }));
    setSeatConflicts([]);
    setError(null);
    setMessage("Suggested available seats applied — click Save Subject Seats to confirm.");
  };

  const saveTicket = async (ticketId: number, autoResolve = false) => {
    setBusy(true);
    setError(null);
    if (!autoResolve) setSeatConflicts([]);
    try {
      const result = await api.adminUpdateHallTicket(ticketId, {
        subjects: editSubjects.map((s) => ({
          subject_code: s.subject_code,
          seat_number: s.seat_number,
          room: s.room,
        })),
        auto_resolve_seats: autoResolve,
      });
      setMessage(result.message || "Hall ticket updated — seat & hall saved for all subjects");
      cancelEdit();
      await load();
    } catch (e: any) {
      const conflicts = Array.isArray(e.conflicts) ? e.conflicts as SeatConflict[] : [];
      if (conflicts.length) {
        setSeatConflicts(conflicts);
        setError(e.message || "Seat conflict — another student already has this seat for the same subject and time.");
      } else {
        setError(e.message || "Failed to save hall ticket");
      }
    }
    setBusy(false);
  };

  const updateEditSubject = (idx: number, field: "seat_number" | "room", value: string) => {
    setEditSubjects((list) => list.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  };

  if (loading) return <div className="p-10 text-center text-slate-500">Loading hall tickets from MySQL…</div>;

  return (
    <div>
      <PageHeader title="Hall Ticket Management" subtitle="Set exam hall and seat number separately for each subject on every hall ticket"
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

      <Card className="p-4 mb-6 bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800">
        <p className="text-sm text-indigo-900 dark:text-indigo-200">
          <strong>Per-subject seating:</strong> Each hall ticket lists all exam subjects. Click <strong>Edit Subject Seats</strong> on a student card to set a different hall and seat for each subject, then save.
        </p>
      </Card>

      {(message || error || seatConflicts.length > 0) && (
        <div className="space-y-3 mb-4">
          {(message || error) && (
            <div className={cn("p-3 rounded-lg text-sm", error ? "bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300")}>
              {error || message}
            </div>
          )}
          {seatConflicts.length > 0 && (
            <div className="p-4 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-amber-900 dark:text-amber-200">Seat conflict detected</p>
                    <p className="text-sm text-amber-800 dark:text-amber-300">The same hall and seat cannot be assigned twice for the same exam, subject, date and time.</p>
                  </div>
                </div>
                <Button variant="primary" disabled={busy} onClick={() => applySuggestedSeats(seatConflicts)}>
                  Use suggested seats
                </Button>
              </div>
              <div className="space-y-2">
                {seatConflicts.map((c) => (
                  <div key={c.subject_code} className="text-sm text-amber-900 dark:text-amber-100 bg-white/70 dark:bg-slate-900/40 rounded-lg px-3 py-2">
                    <strong>{c.subject_name}</strong> — seat <strong>{c.seat_number}</strong> in <strong>{c.room}</strong> is taken by <strong>{c.assigned_to}</strong>
                    {c.assigned_roll_no ? ` (${c.assigned_roll_no})` : ""}. Suggested: <strong>{c.suggested_seat}</strong>
                  </div>
                ))}
              </div>
              <div className="mt-3">
                <Button variant="secondary" disabled={busy} onClick={() => editingId && saveTicket(editingId, true)}>
                  Auto-fix and save now
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {tickets.length === 0 ? (
        <Card className="p-10 text-center text-slate-500">
          No hall tickets yet. Run seating arrangement, sync hall tickets, or click Generate / Sync All.
        </Card>
      ) : (
        <div className="space-y-4">
          {tickets.map((t) => {
            const isEditing = editingId === t.id;
            const subjectRows = isEditing
              ? editSubjects
              : (t.subjects?.length
                ? t.subjects
                : [{ subject_code: t.subject_code || "", subject_name: t.exam, seat_number: t.seat_number, room: t.room, exam_date: t.exam_date, exam_time: t.exam_time }]);

            return (
              <Card key={t.id} className={cn("overflow-hidden", isEditing && "ring-2 ring-indigo-500", t.has_seat_conflict && !isEditing && "ring-2 ring-amber-400")}>
                <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <img src={t.photo} alt="" className="w-12 h-12 rounded-full bg-slate-200" />
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-bold text-slate-900 dark:text-white">{t.student_name}</p>
                        {t.has_seat_conflict && (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                            <AlertTriangle className="w-3 h-3" /> Seat conflict
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500">{t.roll_no} • {t.department} • {t.hall_ticket_no}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {isEditing ? (
                      <>
                        <Button variant="primary" disabled={busy} onClick={() => saveTicket(t.id)}>
                          <Save className="w-4 h-4" /> {busy ? "Saving…" : "Save Subject Seats"}
                        </Button>
                        <Button variant="secondary" onClick={cancelEdit}>Cancel</Button>
                      </>
                    ) : (
                      <>
                        <Button variant="primary" onClick={() => openEdit(t)}>
                          <Edit2 className="w-4 h-4" /> Edit Subject Seats
                        </Button>
                        <Button variant="secondary" onClick={() => {
                          const student: Student = { id: `s${t.student_id}`, rollNo: t.roll_no, name: t.student_name, email: "", mobile: "", department: t.department, semester: 5, section: "A", photo: t.photo, attendance: 75, internalMarks: 30, assignmentMarks: 7, previousResult: 7, backlogs: 0, feePaid: true, feeAmount: 45000, feeDueDate: "", createdAt: "" };
                          downloadHallTicket(student, t.hall_ticket_no, systemSettings.university_name, systemSettings.academic_year, t.room, t.seat_number, t.qr_code_content, t.subjects, {
                            subjectCode: t.subject_code || t.exam, subjectName: t.exam,
                            date: t.exam_date || DEFAULT_HALL_TICKET_EXAM.date, time: t.exam_time || DEFAULT_HALL_TICKET_EXAM.time,
                            duration: t.duration || DEFAULT_HALL_TICKET_EXAM.duration, room: t.room,
                          });
                        }}>
                          <Download className="w-4 h-4" /> PDF
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                <div className="p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Subjects — Hall & Seat</p>
                  <div className="space-y-3">
                    {subjectRows.map((s, idx) => {
                      const rowConflict = (isEditing ? seatConflicts : t.seat_conflicts)?.find((c) => c.subject_code === s.subject_code);
                      return (
                      <div key={`${s.subject_code}-${idx}`} className={cn(
                        "grid grid-cols-1 md:grid-cols-12 gap-3 items-end p-3 rounded-xl border",
                        rowConflict
                          ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800"
                          : "bg-slate-50 dark:bg-slate-800/40 border-slate-100 dark:border-slate-700",
                      )}>
                        <div className="md:col-span-4">
                          <p className="font-semibold text-slate-900 dark:text-white">{s.subject_name}</p>
                          <p className="text-xs text-slate-500">{s.subject_code}{s.exam_date ? ` • ${s.exam_date} ${s.exam_time || ""}` : ""}</p>
                          {rowConflict && (
                            <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                              Conflict with {rowConflict.assigned_to} — try seat {rowConflict.suggested_seat}
                            </p>
                          )}
                        </div>
                        {isEditing ? (
                          <>
                            <div className="md:col-span-4">
                              <Field label="Exam Hall">
                                <TextInput value={s.room} onChange={(e) => updateEditSubject(idx, "room", e.target.value)} placeholder="Hall A-101" />
                              </Field>
                            </div>
                            <div className="md:col-span-4">
                              <Field label="Seat Number">
                                <TextInput value={s.seat_number} onChange={(e) => updateEditSubject(idx, "seat_number", e.target.value)} placeholder="A1" />
                              </Field>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="md:col-span-4">
                              <p className="text-xs text-slate-500 mb-0.5">Exam Hall</p>
                              <p className="font-semibold text-indigo-700 dark:text-indigo-300">{s.room || "—"}</p>
                            </div>
                            <div className="md:col-span-4">
                              <p className="text-xs text-slate-500 mb-0.5">Seat Number</p>
                              <p className="font-semibold text-indigo-700 dark:text-indigo-300">{s.seat_number || "—"}</p>
                            </div>
                          </>
                        )}
                      </div>
                    );})}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function HallTicketPreview({ student, hallTicketNo, onClose }: { student: Student; hallTicketNo: string; onClose: () => void }) {
  const { settings: systemSettings } = useSystemSettings();
  const exam = { ...DEFAULT_HALL_TICKET_EXAM };
  const seatNumber = `S${100 + parseInt(student.id.replace(/\D/g, ""), 10)}`;
  const qrValue = JSON.stringify({ htNo: hallTicketNo, name: student.name, roll: student.rollNo, seat: seatNumber, room: exam.room, verified: true });
  const logo = universityInitials(systemSettings.university_name);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-slate-200 p-4 flex justify-between items-center">
          <h3 className="font-bold">Hall Ticket Preview</h3>
          <div className="flex gap-2">
            <Button variant="primary" onClick={() => downloadHallTicket(student, hallTicketNo, systemSettings.university_name, systemSettings.academic_year)}><Download className="w-4 h-4" /> Download PDF</Button>
            <Button variant="secondary" onClick={() => window.print()}><Printer className="w-4 h-4" /> Print</Button>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 px-2">✕</button>
          </div>
        </div>
        <div className="p-8 bg-gradient-to-br from-slate-50 to-indigo-50">
          <div className="bg-white border-2 border-indigo-600 rounded-xl overflow-hidden">
            <div className="bg-brand-gradient text-white p-4 flex items-center justify-between">
              <div>
                <p className="font-bold text-lg">{systemSettings.university_name}</p>
                <p className="text-xs opacity-90">{examHeaderSubtitle(systemSettings.academic_year)}</p>
              </div>
              <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur flex items-center justify-center text-2xl font-bold">{logo}</div>
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
      api.adminFees().catch(() => ({ pending_verifications: [] })),
    ]);
    setStudents(studentRows);
    setPending(feeData.pending_verifications || []);
    setLoading(false);
  };

  useEffect(() => { reload(); }, []);

  const approvePayment = async (paymentId: number) => {
    setActionId(paymentId);
    try {
      await api.approveFeePayment(paymentId, "Verified and approved");
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
      await api.rejectFeePayment(paymentId, note);
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
                          await api.adminMarkFeePaid(Number(sid));
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
      await api.sendNotification({ title, message, audience });
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
  const [trendData, setTrendData] = useState<{ day: string; attendance: number; absent: number; total: number }[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    Promise.all([fetchStudents(), fetchAttendanceTrends()])
      .then(([s, trends]) => { setStudents(s); setTrendData(trends); setLoading(false); });
  }, []);
  if (loading) return <div className="p-10 text-center text-slate-500">Loading from MySQL…</div>;

  const hasTrendData = trendData.some((d) => d.total > 0);

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
        <h3 className="font-semibold mb-1">Attendance Trends (7 days)</h3>
        <p className="text-xs text-slate-500 mb-4">
          {hasTrendData ? "Daily present vs absent % from teacher attendance marks" : "No attendance marked in the last 7 days — use Teacher → Attendance"}
        </p>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,.3)" />
              <XAxis dataKey="day" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} domain={[0, 100]} />
              <Tooltip contentStyle={{ background: "rgba(15,23,42,.9)", border: "none", borderRadius: 8, color: "#fff" }} />
              <Legend />
              <Line type="monotone" dataKey="attendance" name="Present %" stroke="#10b981" strokeWidth={3} dot={{ r: 5 }} />
              <Line type="monotone" dataKey="absent" name="Absent %" stroke="#ef4444" strokeWidth={3} dot={{ r: 5 }} />
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
type SystemSettings = {
  university_name: string;
  academic_year: string;
  current_semester: number;
  contact_email: string;
  attendance_threshold: number;
  internal_marks_threshold: number;
  min_sgpa: number;
  ml_model: "rf" | "dt";
  updated_at?: string | null;
};

export function AdminSettings() {
  const { add } = useNotifications();
  const [loading, setLoading] = useState(true);
  const [savingUni, setSavingUni] = useState(false);
  const [savingAi, setSavingAi] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uniForm, setUniForm] = useState({
    university_name: "",
    academic_year: "",
    current_semester: 5,
    contact_email: "",
  });
  const [aiForm, setAiForm] = useState({
    attendance_threshold: 75,
    internal_marks_threshold: 40,
    min_sgpa: 5.0,
    ml_model: "rf" as "rf" | "dt",
  });

  const loadSettings = () => {
    setLoading(true);
    setError(null);
    api.adminGetSettings()
      .then((data: SystemSettings) => {
        setUniForm({
          university_name: data.university_name,
          academic_year: data.academic_year,
          current_semester: data.current_semester,
          contact_email: data.contact_email,
        });
        setAiForm({
          attendance_threshold: data.attendance_threshold,
          internal_marks_threshold: data.internal_marks_threshold,
          min_sgpa: data.min_sgpa,
          ml_model: data.ml_model,
        });
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message || "Failed to load settings");
        setLoading(false);
      });
  };

  useEffect(() => { loadSettings(); }, []);

  const saveUniversity = async () => {
    setSavingUni(true);
    try {
      await api.adminUpdateSettings(uniForm);
      notifySystemSettingsUpdated();
      add({ title: "University settings saved", message: "Settings updated successfully.", audience: "admin" });
    } catch (e: any) {
      add({ title: "Save failed", message: e?.message || "Could not save university settings", audience: "admin" });
    } finally {
      setSavingUni(false);
    }
  };

  const saveAi = async () => {
    setSavingAi(true);
    try {
      const result = await api.adminUpdateSettings(aiForm);
      notifySystemSettingsUpdated();
      const msg = result?.recalculated_students
        ? `AI thresholds applied. Recalculated eligibility for ${result.recalculated_students} students.`
        : "AI configuration saved.";
      add({ title: "AI settings applied", message: msg, audience: "admin" });
    } catch (e: any) {
      add({ title: "Apply failed", message: e?.message || "Could not save AI settings", audience: "admin" });
    } finally {
      setSavingAi(false);
    }
  };

  if (loading) return <div className="p-10 text-center text-slate-500">Loading settings…</div>;
  if (error) {
    return (
      <div>
        <PageHeader title="System Settings" subtitle="Configure ExamShield AI" />
        <Card className="p-8 max-w-lg mx-auto text-center">
          <Database className="w-12 h-12 text-rose-500 mx-auto mb-3" />
          <p className="text-rose-600 mb-4">{error}</p>
          <Button onClick={loadSettings}>Retry</Button>
        </Card>
      </div>
    );
  }

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
            <Field label="University Name">
              <TextInput value={uniForm.university_name} onChange={(e) => setUniForm({ ...uniForm, university_name: e.target.value })} />
            </Field>
            <Field label="Academic Year">
              <TextInput value={uniForm.academic_year} onChange={(e) => setUniForm({ ...uniForm, academic_year: e.target.value })} />
            </Field>
            <Field label="Current Semester">
              <Select value={String(uniForm.current_semester)} onChange={(e) => setUniForm({ ...uniForm, current_semester: Number(e.target.value) })}>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => <option key={n} value={n}>{n}</option>)}
              </Select>
            </Field>
            <Field label="Contact Email">
              <TextInput type="email" value={uniForm.contact_email} onChange={(e) => setUniForm({ ...uniForm, contact_email: e.target.value })} />
            </Field>
          </div>
          <Button variant="primary" className="mt-4" onClick={saveUniversity} disabled={savingUni}>
            <Save className="w-4 h-4" /> {savingUni ? "Saving…" : "Save Settings"}
          </Button>
        </Card>
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <BrainCircuit className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold">AI Configuration</h3>
          </div>
          <div className="space-y-3">
            <Field label="Eligibility Threshold (Attendance %)">
              <TextInput type="number" min={0} max={100} value={aiForm.attendance_threshold}
                onChange={(e) => setAiForm({ ...aiForm, attendance_threshold: Number(e.target.value) })} />
            </Field>
            <Field label="Internal Marks Threshold (%)">
              <TextInput type="number" min={0} max={100} value={aiForm.internal_marks_threshold}
                onChange={(e) => setAiForm({ ...aiForm, internal_marks_threshold: Number(e.target.value) })} />
            </Field>
            <Field label="Min SGPA">
              <TextInput type="number" step="0.1" min={0} max={10} value={aiForm.min_sgpa}
                onChange={(e) => setAiForm({ ...aiForm, min_sgpa: Number(e.target.value) })} />
            </Field>
            <Field label="ML Model">
              <Select value={aiForm.ml_model} onChange={(e) => setAiForm({ ...aiForm, ml_model: e.target.value as "rf" | "dt" })}>
                <option value="rf">Random Forest Classifier</option>
                <option value="dt">Decision Tree</option>
              </Select>
            </Field>
          </div>
          <p className="text-xs text-slate-500 mt-3">Changing AI thresholds recalculates eligibility for all students.</p>
          <Button variant="primary" className="mt-4" onClick={saveAi} disabled={savingAi}>
            <Save className="w-4 h-4" /> {savingAi ? "Applying…" : "Apply"}
          </Button>
        </Card>
      </div>
    </div>
  );
}
