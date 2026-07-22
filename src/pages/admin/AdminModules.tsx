import { useState, useMemo, useEffect } from "react";
import { Card, PageHeader, Button, Badge, TextInput, Select } from "../../components/Layout";
import { Pagination } from "../../components/Pagination";
import { Modal } from "../../components/Modal";
import { useClientPagination } from "../../hooks/useClientPagination";
import { fetchStudents, fetchTeachers, fetchHods, fetchAdminExams, getStudentEligibility, fetchAttendanceTrends } from "../../data/apiData";
import { downloadAdminReport, api } from "../../data/api";
import { apiDelete, apiPost, apiPut } from "../../data/http";
import type { Student, Teacher, Exam, Hod } from "../../data/types";
import { useNotifications } from "../../contexts/AppContext";
import { Search, Plus, Edit2, Trash2, Eye, Download, Upload, Printer, QrCode, Mail, CheckCircle2, XCircle, FileText, Wallet, AlertTriangle, Settings as SettingsIcon, Save, Calendar, MapPin, ClipboardList, TicketCheck, BrainCircuit, X, Database, User, GraduationCap, BookOpen } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Cell, Legend } from "recharts";
import { QRCodeSVG } from "qrcode.react";
import { cn } from "../../utils/cn";
import { useDepartments } from "../../hooks/useDepartments";
import { notifySystemSettingsUpdated, useSystemSettings } from "../../hooks/useSystemSettings";
import { DepartmentSelect } from "../../components/DepartmentSelect";
import { examHeaderSubtitle, downloadHallTicket, universityInitials, DEFAULT_HALL_TICKET_EXAM } from "../../utils/hallTicket";
import { INTERNAL_MARKS_MAX, ASSIGNMENT_MARKS_MAX, INTERNAL_ASSIGNMENT_TOTAL } from "../../data/marksConstants";
import { formatNotificationAudience } from "../../utils/notifications";

async function apiAddStudent(form: any) {
  return apiPost("/api/auth/setup-student", form, "Failed to add student");
}
async function apiAddTeacher(form: any) {
  return apiPost("/api/auth/setup-teacher", form, "Failed to add teacher");
}
async function apiAddHod(form: any) {
  return apiPost("/api/auth/setup-hod", form, "Failed to add HOD");
}
async function apiAddExam(form: any) {
  return apiPost("/api/auth/setup-exam", form, "Failed to add exam");
}

// ==================== STUDENTS ====================
export function AdminStudents() {
  const [list, setList] = useState<Student[]>([]);
  const [search, setSearch] = useState("");
  const [dept, setDept] = useState<string>("all");
  const [editing, setEditing] = useState<Student | null>(null);
  const [viewing, setViewing] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const { departments: depts, loading: deptsLoading } = useDepartments();

  useEffect(() => { fetchStudents().then((s) => { setList(s); setLoading(false); }); }, []);

  const filtered = useMemo(() => {
    return list.filter((s) =>
      (dept === "all" || s.department === dept) &&
      (s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.rollNo.toLowerCase().includes(search.toLowerCase()) ||
        s.email.toLowerCase().includes(search.toLowerCase()))
    );
  }, [list, search, dept]);

  const { page, setPage, pageSize, setPageSize, totalPages, total, paged } = useClientPagination(filtered, 10);

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
        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </Card>

      {editing && (
        <StudentModal
          student={editing.id ? editing : null}
          onClose={() => setEditing(null)}
          onSave={async (s, opts) => {
            if (s.id) {
              // Edit — call PUT (identity fields only)
              try {
                const sid = parseInt(s.id.replace("s", ""));
                const payload: Record<string, unknown> = {
                  name: s.name,
                  email: s.email,
                  roll_no: s.rollNo,
                  mobile: s.mobile || "",
                  gender: s.gender || "",
                  date_of_birth: s.dateOfBirth || "",
                  department: s.department,
                  semester: s.semester,
                };
                if (opts?.password) payload.password = opts.password;
                await api.adminUpdateStudent(Number(sid), payload);
                setList((l) => l.map((x) => x.id === s.id ? s : x));
              } catch (e: any) {
                alert(e?.message || "Failed to update student");
                return;
              }
            } else {
              // Create — call setup-student API (identity fields; fee uses backend default)
              try {
                const result = await apiAddStudent({
                  email: s.email,
                  name: s.name,
                  password: opts?.password || "student123",
                  roll_no: s.rollNo,
                  mobile: s.mobile || "",
                  gender: s.gender || "",
                  date_of_birth: s.dateOfBirth || "",
                  department: s.department,
                  semester: s.semester,
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
    id: "", rollNo: "", name: "", email: "", mobile: "", gender: "", dateOfBirth: "", department: "",
    semester: 5, section: "A", photo: "", attendance: 0, internalMarks: 0, assignmentMarks: 0,
    previousResult: 0, backlogs: 0, feePaid: false, feeAmount: 45000, feeDueDate: "", createdAt: new Date().toISOString().slice(0, 10),
  });
  const [password, setPassword] = useState("");
  const update = (k: keyof Student, v: any) => setForm({ ...form, [k]: v } as Student);

  useEffect(() => {
    if (!student?.id && departments.length && !form.department) {
      setForm((f) => ({ ...f, department: departments[0] }));
    }
  }, [departments, student?.id, form.department]);

  return (
    <Modal onClose={onClose} panelClassName="max-w-2xl">
      <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">{student?.id ? "Edit Student" : "Add Student"}</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
      </div>
      <div className="p-6 grid grid-cols-2 gap-4">
        <Field label="Roll No (USN)"><TextInput value={form.rollNo} onChange={(e) => update("rollNo", e.target.value)} /></Field>
        <Field label="Name"><TextInput value={form.name} onChange={(e) => update("name", e.target.value)} /></Field>
        <Field label="Email"><TextInput type="email" value={form.email} onChange={(e) => update("email", e.target.value)} /></Field>
        <Field label={student?.id ? "New Password (optional)" : "Password"}>
          <TextInput type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={student?.id ? "Leave blank to keep current" : "Student login password (min 6 chars)"} />
        </Field>
        <Field label="Mobile *"><TextInput value={form.mobile} onChange={(e) => update("mobile", e.target.value)} required /></Field>
        <Field label="Gender">
          <Select value={form.gender || ""} onChange={(e) => update("gender", e.target.value)}>
            <option value="">Select gender</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </Select>
        </Field>
        <Field label="Date of Birth">
          <TextInput type="date" value={form.dateOfBirth || ""} onChange={(e) => update("dateOfBirth", e.target.value)} />
        </Field>
        <Field label="Department">
          <DepartmentSelect
            value={form.department}
            onChange={(v) => update("department", v)}
            departments={departments}
            loading={deptsLoading}
          />
        </Field>
        <Field label="Semester"><TextInput type="number" value={form.semester} onChange={(e) => update("semester", +e.target.value)} /></Field>
      </div>
      <div className="p-6 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={() => {
          if (!form.mobile?.trim()) {
            alert("Mobile is required");
            return;
          }
          if (!student?.id && password && password.length < 6) {
            alert("Password must be at least 6 characters");
            return;
          }
          onSave(form, password ? { password } : undefined);
        }}><Save className="w-4 h-4" /> Save Student</Button>
      </div>
    </Modal>
  );
}

function StudentDetailModal({ student, onClose }: { student: Student; onClose: () => void }) {
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sid = parseInt(student.id.replace(/^s/, ""), 10);
    api.adminGetStudent(sid)
      .then(setDetail)
      .catch((e: Error) => setError(e.message || "Failed to load student"))
      .finally(() => setLoading(false));
  }, [student.id]);

  const s: Student = detail ? {
    id: student.id,
    rollNo: detail.roll_no,
    name: detail.name,
    email: detail.email,
    mobile: detail.mobile || "",
    department: detail.department,
    semester: detail.semester,
    section: detail.section || "A",
    photo: detail.photo,
    attendance: detail.attendance,
    internalMarks: detail.internal_marks,
    assignmentMarks: detail.assignment_marks ?? 0,
    previousResult: detail.previous_result,
    backlogs: detail.backlogs,
    feePaid: detail.fee_paid,
    feeAmount: detail.fee_amount,
    examFeePaid: !!detail.exam_fee_paid,
    collegeFeeAmount: detail.college_fee_amount ?? 0,
    collegeFeePaid: !!detail.college_fee_paid,
    feeDueDate: detail.fee_due_date || "",
    createdAt: student.createdAt,
  } : student;

  const e = getStudentEligibility(s);
  const internalPct = Math.round((s.internalMarks / INTERNAL_MARKS_MAX) * 100);
  const totalInternal = s.internalMarks + (s.assignmentMarks || 0);

  return (
    <Modal onClose={onClose} panelClassName="max-w-3xl">
      <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between sticky top-0 bg-white dark:bg-slate-900 z-10">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <GraduationCap className="w-5 h-5 text-indigo-600" /> Student Details
        </h3>
        <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"><X className="w-5 h-5" /></button>
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-500">Loading full profile from MySQL…</div>
      ) : error ? (
        <div className="p-8 text-center text-rose-600">{error}</div>
      ) : (
        <div className="p-6 space-y-6">
          <div className="flex flex-col sm:flex-row items-start gap-5 p-5 rounded-xl bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-950/40 dark:to-violet-950/40 border border-indigo-100 dark:border-indigo-900/50">
            <img src={s.photo} alt="" className="w-24 h-24 rounded-2xl bg-slate-200 border-4 border-white dark:border-slate-800 shadow-md object-cover" />
            <div className="flex-1">
              <h4 className="text-2xl font-bold text-slate-900 dark:text-white">{s.name}</h4>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{s.rollNo} • {s.department}</p>
              <p className="text-sm text-slate-500">Semester {s.semester} • Section {s.section}</p>
              <div className="flex flex-wrap gap-2 mt-3">
                {e.eligible || detail?.is_eligible ? (
                  <Badge variant="green">Eligible for Exam</Badge>
                ) : (
                  <Badge variant="red">Not Eligible</Badge>
                )}
                {detail?.eligibility_percentage != null && (
                  <Badge variant="indigo">AI Score: {Math.round(detail.eligibility_percentage)}%</Badge>
                )}
              </div>
            </div>
          </div>

          <section>
            <h5 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2"><User className="w-3.5 h-3.5" /> Contact</h5>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Info label="Email" value={s.email} />
              <Info label="Mobile" value={s.mobile || "—"} />
            </div>
          </section>

          <section>
            <h5 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2"><ClipboardList className="w-3.5 h-3.5" /> Academic Record</h5>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Info label="Attendance" value={`${s.attendance}%`} ok={s.attendance >= 75} />
              <Info label="Internal Marks" value={`${s.internalMarks}/${INTERNAL_MARKS_MAX} (${internalPct}%)`} ok={internalPct >= 40} />
              <Info label="Assignment Marks" value={`${s.assignmentMarks}/${ASSIGNMENT_MARKS_MAX}`} />
              <Info label="Total Internal" value={`${totalInternal}/${INTERNAL_ASSIGNMENT_TOTAL}`} />
              <Info label="Active Backlogs" value={String(s.backlogs)} />
              <Info label="Previous SGPA" value={s.previousResult.toFixed(2)} />
            </div>
            <div className="mt-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
              <div className="flex justify-between text-xs text-slate-500 mb-1"><span>Attendance</span><span>{s.attendance}%</span></div>
              <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div className={cn("h-full rounded-full", s.attendance >= 75 ? "bg-emerald-500" : "bg-rose-500")} style={{ width: `${Math.min(100, s.attendance)}%` }} />
              </div>
            </div>
          </section>

          <section>
            <h5 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2"><Wallet className="w-3.5 h-3.5" /> Fee Status</h5>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Info label="College Fee" value={`₹${(s.collegeFeeAmount ?? 0).toLocaleString()}${s.collegeFeePaid ? " (Paid)" : " (Due)"}`} ok={s.collegeFeePaid} />
              <Info label="Exam Fee" value={`₹${s.feeAmount?.toLocaleString?.() ?? s.feeAmount}${s.examFeePaid ? " (Paid)" : " (Due)"}`} ok={s.examFeePaid} />
              <Info label="Due Date" value={s.feeDueDate || "—"} ok={s.feePaid} />
            </div>
          </section>

          <section>
            <h5 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2"><BrainCircuit className="w-3.5 h-3.5" /> Eligibility Breakdown</h5>
            <div className="space-y-2">
              <EligibilityRow label="Attendance ≥ 75%" ok={e.checks.attendance} detail={`${s.attendance}%`} />
              <EligibilityRow label="Internal marks ≥ 40%" ok={e.checks.internals} detail={`${internalPct}%`} />
              <EligibilityRow label="College & exam fees paid" ok={e.checks.fee} detail={s.feePaid ? "Both paid" : "Pending"} />
            </div>
            {detail?.ai_risk_score != null && (
              <p className="text-xs text-slate-500 mt-3">AI risk score: <span className="font-semibold">{Math.round(detail.ai_risk_score)}</span> (lower is better)</p>
            )}
          </section>
        </div>
      )}
    </Modal>
  );
}

function EligibilityRow({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return (
    <div className={cn("flex items-center justify-between p-3 rounded-lg border text-sm",
      ok ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/50 dark:bg-emerald-950/20" : "border-rose-200 bg-rose-50/50 dark:border-rose-900/50 dark:bg-rose-950/20")}>
      <div className="flex items-center gap-2">
        {ok ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <XCircle className="w-4 h-4 text-rose-500" />}
        <span className="font-medium text-slate-700 dark:text-slate-200">{label}</span>
      </div>
      <span className={cn("text-xs font-semibold", ok ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400")}>{detail}</span>
    </div>
  );
}

function TeacherDetailModal({ teacher, onClose }: { teacher: Teacher; onClose: () => void }) {
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const tid = parseInt(teacher.id.replace(/^t/, ""), 10);
    api.adminGetTeacher(tid)
      .then(setDetail)
      .catch((e: Error) => setError(e.message || "Failed to load teacher"))
      .finally(() => setLoading(false));
  }, [teacher.id]);

  const t = detail || teacher;
  const subjects: string[] = detail?.assigned_subjects || teacher.subjects || [];
  const exams: any[] = detail?.invigilator_exams || [];

  return (
    <Modal onClose={onClose} panelClassName="max-w-2xl">
      <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between sticky top-0 bg-white dark:bg-slate-900 z-10">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <User className="w-5 h-5 text-indigo-600" /> Teacher Details
        </h3>
        <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"><X className="w-5 h-5" /></button>
      </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500">Loading teacher profile…</div>
        ) : error ? (
          <div className="p-8 text-center text-rose-600">{error}</div>
        ) : (
          <div className="p-6 space-y-6">
            <div className="flex items-start gap-5 p-5 rounded-xl bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-950/40 dark:to-indigo-950/40 border border-violet-100 dark:border-violet-900/50">
              <img
                src={t.photo || teacher.photo || `https://api.dicebear.com/7.x/avataaars/svg?seed=${teacher.empId}`}
                alt=""
                className="w-24 h-24 rounded-2xl bg-slate-200 border-4 border-white dark:border-slate-800 shadow-md object-cover"
              />
              <div>
                <h4 className="text-2xl font-bold text-slate-900 dark:text-white">{t.name || teacher.name}</h4>
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{t.emp_id || teacher.empId}</p>
                <p className="text-sm text-slate-500">{t.department || teacher.department}</p>
                <div className="mt-2"><Badge variant="indigo">Faculty</Badge></div>
              </div>
            </div>

            <section>
              <h5 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Contact</h5>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Info label="Email" value={t.email || teacher.email} />
                <Info label="Employee ID" value={t.emp_id || teacher.empId} />
                <Info label="Department" value={t.department || teacher.department} />
              </div>
            </section>

            <section>
              <h5 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2"><BookOpen className="w-3.5 h-3.5" /> Assigned Subjects</h5>
              {subjects.length ? (
                <div className="flex flex-wrap gap-2">
                  {subjects.map((sub) => <Badge key={sub} variant="indigo">{sub}</Badge>)}
                </div>
              ) : (
                <p className="text-sm text-slate-500">No subjects assigned</p>
              )}
            </section>

            <section>
              <h5 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2"><Calendar className="w-3.5 h-3.5" /> Invigilation Duties</h5>
              {exams.length ? (
                <div className="space-y-2">
                  {exams.map((ex) => (
                    <div key={ex.exam_subject_id ?? `${ex.id}-${ex.subject_code}`} className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 text-sm">
                      <p className="font-semibold text-slate-800 dark:text-white">{ex.subject_name} ({ex.subject_code})</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {ex.department} • Sem {ex.semester} • {ex.exam_date} at {ex.exam_time}
                        {ex.duration ? ` • ${ex.duration}` : ""}
                      </p>
                      <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1 flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {ex.room}
                        {ex.requires_face_verification && " • Face verification required"}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">Not assigned as invigilator for any exam yet</p>
              )}
            </section>
          </div>
        )}
    </Modal>
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
  const [viewing, setViewing] = useState<Teacher | null>(null);
  const { page, setPage, pageSize, setPageSize, totalPages, total, paged } = useClientPagination(list, 9);

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
          {paged.map((t) => (
            <div key={t.id} className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-3">
                <img src={t.photo || `https://api.dicebear.com/7.x/avataaars/svg?seed=${t.empId}`} alt="" className="w-12 h-12 rounded-full bg-slate-200" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 dark:text-white">{t.name}</p>
                  <p className="text-xs text-slate-500">{t.empId} • {t.department}</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => setViewing(t)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800" title="View details">
                    <Eye className="w-4 h-4 text-slate-500" />
                  </button>
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
        <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
      </Card>
      {adding && <TeacherModal onClose={() => setAdding(false)} onSaved={(t) => { setList((l) => [t, ...l]); setAdding(false); }} />}
      {editing && <TeacherModal teacher={editing} onClose={() => setEditing(null)} onSaved={(t) => { setList((l) => l.map((x) => x.id === t.id ? t : x)); setEditing(null); }} />}
      {viewing && <TeacherDetailModal teacher={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

// ==================== HODS ====================
export function AdminHods() {
  const [list, setList] = useState<Hod[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Hod | null>(null);
  const { page, setPage, pageSize, setPageSize, totalPages, total, paged } = useClientPagination(list, 9);

  const reload = () => fetchHods().then((h) => { setList(h); setLoading(false); });
  useEffect(() => { reload(); }, []);

  const onDelete = async (hod: Hod) => {
    if (!confirm(`Delete HOD ${hod.name}?`)) return;
    try {
      const hid = hod.id.replace(/^h/, "");
      await apiDelete(`/api/admin/hods/${hid}/delete`, "Failed to delete HOD");
      setList((l) => l.filter((h) => h.id !== hod.id));
    } catch (e: any) {
      alert(e.message || "Failed to delete HOD");
    }
  };

  if (loading) return <div className="p-10 text-center text-slate-500">Loading HODs from MySQL…</div>;
  return (
    <div>
      <PageHeader
        title="HOD Management"
        subtitle={`${list.length} Heads of Department (one per department)`}
        actions={<Button variant="primary" onClick={() => setAdding(true)}><Plus className="w-4 h-4" /> Add HOD</Button>}
      />
      <Card className="overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-5">
          {paged.map((h) => (
            <div key={h.id} className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-3">
                <img src={h.photo || `https://api.dicebear.com/7.x/avataaars/svg?seed=${h.empId}`} alt="" className="w-12 h-12 rounded-full bg-slate-200" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 dark:text-white">{h.name}</p>
                  <p className="text-xs text-slate-500">{h.empId} • {h.department}</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => setEditing(h)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800" title="Edit">
                    <Edit2 className="w-4 h-4 text-slate-500" />
                  </button>
                  <button onClick={() => onDelete(h)} className="p-2 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30" title="Delete">
                    <Trash2 className="w-4 h-4 text-rose-500" />
                  </button>
                </div>
              </div>
              <p className="text-xs text-slate-500 mb-2">{h.email}</p>
              <Badge variant="amber">HOD</Badge>
            </div>
          ))}
          {list.length === 0 && (
            <div className="col-span-3 p-10 text-center text-slate-500">No HODs yet — click "Add HOD" to appoint one per department</div>
          )}
        </div>
        <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
      </Card>
      {adding && <HodModal onClose={() => setAdding(false)} onSaved={(h) => { setList((l) => [h, ...l]); setAdding(false); }} />}
      {editing && <HodModal hod={editing} onClose={() => setEditing(null)} onSaved={(h) => { setList((l) => l.map((x) => x.id === h.id ? h : x)); setEditing(null); }} />}
    </div>
  );
}

function HodModal({ hod, onClose, onSaved }: { hod?: Hod; onClose: () => void; onSaved: (h: Hod) => void }) {
  const isEdit = !!hod;
  const { departments, loading: deptsLoading } = useDepartments();
  const [form, setForm] = useState({
    email: hod?.email || "",
    password: "",
    name: hod?.name || "",
    emp_id: hod?.empId || "",
    department: hod?.department || "",
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
      };
      if (form.password) payload.password = form.password;

      if (isEdit && hod) {
        const hid = hod.id.replace(/^h/, "");
        await apiPut(`/api/admin/hods/${hid}/update`, payload, "Failed to update HOD");
        onSaved({
          ...hod,
          name: form.name,
          email: form.email,
          empId: form.emp_id,
          department: form.department,
        });
      } else {
        const res = await apiAddHod({ ...payload, password: form.password || "hod123" }) as { hod_id: number };
        onSaved({
          id: `h${res.hod_id}`,
          empId: form.emp_id,
          name: form.name,
          email: form.email,
          department: form.department,
          photo: `https://api.dicebear.com/7.x/avataaars/svg?seed=${form.emp_id}`,
        });
      }
    } catch (e: any) {
      setErr(e.message || "Failed to save HOD");
    }
    setSaving(false);
  };

  return (
    <Modal onClose={onClose} panelClassName="max-w-lg">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg">{isEdit ? "Edit HOD" : "Add HOD"}</h3>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <p className="text-xs text-slate-500 mb-4">Only one active HOD is allowed per department (Indian college pattern).</p>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <TextInput value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Employee ID</label>
            <TextInput value={form.emp_id} onChange={(e) => setForm({ ...form, emp_id: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Department</label>
            <DepartmentSelect
              value={form.department}
              onChange={(v) => setForm({ ...form, department: v })}
              departments={departments}
              loading={deptsLoading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{isEdit ? "New Password (optional)" : "Password"}</label>
            <TextInput type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder={isEdit ? "Leave blank to keep" : "Default: hod123"} />
          </div>
        </div>
        {err && <p className="mt-3 text-sm text-rose-600">{err}</p>}
        <div className="flex justify-end gap-2 mt-5">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </div>
      </div>
    </Modal>
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
    <Modal onClose={onClose} panelClassName="max-w-lg">
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
    </Modal>
  );
}

// ==================== EXAMS ====================
export function AdminExams() {
  const [list, setList] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Exam | null>(null);
  const { page, setPage, pageSize, setPageSize, totalPages, total, paged } = useClientPagination(list, 9);

  useEffect(() => { fetchAdminExams().then((e) => { setList(e); setLoading(false); }); }, []);

  const onDelete = async (exam: Exam) => {
    if (!confirm(`Delete exam ${exam.title || exam.subjectName}?`)) return;
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
      <div className="space-y-4">
        {paged.map((e) => {
          const papers = e.subjects?.length
            ? e.subjects
            : [{ subjectCode: e.subjectCode, subjectName: e.subjectName, date: e.date, time: e.time, duration: e.duration }];
          return (
            <Card key={e.id} className="overflow-hidden">
              <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-lg text-slate-900 dark:text-white break-words">{e.title || e.subjectName}</h3>
                  {e.title && e.title !== e.subjectName && (
                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5 break-words">{e.subjectName}</p>
                  )}
                  <p className="text-xs text-slate-500 mt-1">
                    {e.department} • Sem {e.semester} • Room {e.room} • {papers.length} subject{papers.length === 1 ? "" : "s"}
                    {e.feeAmount != null ? ` • Fee ₹${Number(e.feeAmount).toLocaleString()}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{(papers[0]?.date || e.date).split("-")[2]}</p>
                    <p className="text-xs text-slate-500 uppercase">
                      {new Date(papers[0]?.date || e.date).toLocaleString("en", { month: "short" })}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => setEditing(e)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800" title="Edit">
                      <Edit2 className="w-4 h-4 text-slate-500" />
                    </button>
                    <button onClick={() => onDelete(e)} className="p-2 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30" title="Delete">
                      <Trash2 className="w-4 h-4 text-rose-500" />
                    </button>
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[640px]">
                  <thead className="bg-slate-50 dark:bg-slate-800/50">
                    <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-4 py-2.5 w-12">#</th>
                      <th className="px-4 py-2.5 w-28">Code</th>
                      <th className="px-4 py-2.5">Subject</th>
                      <th className="px-4 py-2.5 w-32">Date</th>
                      <th className="px-4 py-2.5 w-28">Time</th>
                      <th className="px-4 py-2.5 w-28">Duration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {papers.map((s, i) => (
                      <tr key={`${s.subjectCode}-${i}`} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30">
                        <td className="px-4 py-2.5 text-slate-500">{i + 1}</td>
                        <td className="px-4 py-2.5 font-mono font-semibold text-indigo-600 whitespace-nowrap">{s.subjectCode}</td>
                        <td className="px-4 py-2.5 font-medium text-slate-800 dark:text-slate-100 break-words">{s.subjectName || e.subjectName}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap">{s.date || e.date}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap">{s.time || e.time}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap">{s.duration || e.duration || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          );
        })}
        {list.length === 0 && (
          <Card className="p-10 text-center text-slate-500">No exams scheduled — click "Schedule Exam"</Card>
        )}
      </div>
      <Card className="mt-4 overflow-hidden">
        <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
      </Card>
      {adding && <ExamModal onClose={() => setAdding(false)} onSaved={(e) => { setList((l) => [e, ...l]); setAdding(false); }} />}
      {editing && <ExamModal exam={editing} onClose={() => setEditing(null)} onSaved={(e) => { setList((l) => l.map((x) => x.id === e.id ? e : x)); setEditing(null); }} />}
    </div>
  );
}

function ExamModal({ exam, onClose, onSaved }: { exam?: Exam; onClose: () => void; onSaved: (e: Exam) => void }) {
  const isEdit = !!exam;
  const { departments, loading: deptsLoading } = useDepartments();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [seatingRooms, setSeatingRooms] = useState<{ id: number; room_code: string; room_name: string; rows: number; columns: number }[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const initialSubjects = exam?.subjects?.length
    ? exam.subjects.map((s) => ({
        subject_code: s.subjectCode,
        subject_name: s.subjectName,
        exam_date: s.date || exam?.date || "2026-11-10",
        exam_time: s.time || exam?.time || "10:00 AM",
        duration: s.duration || exam?.duration || "3 hours",
        invigilator_id: s.invigilatorId != null ? String(s.invigilatorId) : "",
      }))
    : [{
        subject_code: exam?.subjectCode || "",
        subject_name: exam?.subjectName || "",
        exam_date: exam?.date || "2026-11-10",
        exam_time: exam?.time || "10:00 AM",
        duration: exam?.duration || "3 hours",
        invigilator_id: exam?.invigilatorId != null ? String(exam.invigilatorId) : "",
      }];
  const [form, setForm] = useState({
    title: exam?.title || exam?.subjectName || "",
    subject_code: exam?.subjectCode || "",
    subject_name: exam?.subjectName || "",
    department: exam?.department || "",
    semester: exam?.semester || 5,
    exam_date: exam?.date || "2026-11-10",
    exam_time: exam?.time || "10:00 AM",
    duration: exam?.duration || "3 hours",
    room: exam?.room || "",
    total_marks: exam?.totalMarks || 100,
    fee_amount: exam?.feeAmount ?? 45000,
    requires_face_verification: exam?.requiresFaceVerification ?? true,
  });
  const [subjects, setSubjects] = useState(initialSubjects);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetchTeachers().then(setTeachers).catch(() => {});
  }, []);

  useEffect(() => {
    api.adminSeatingRooms()
      .then((rooms) => setSeatingRooms(rooms || []))
      .catch(() => setSeatingRooms([]))
      .finally(() => setRoomsLoading(false));
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
      invigilator_id: "",
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
    const filteredSubjects = subjects.filter((s) => s.subject_code && s.subject_name);
    const payload = {
      ...form,
      subjects: filteredSubjects.map((s) => ({
        subject_code: s.subject_code,
        subject_name: s.subject_name,
        exam_date: s.exam_date,
        exam_time: s.exam_time,
        duration: s.duration,
        invigilator_id: s.invigilator_id ? Number(s.invigilator_id) : null,
      })),
    };
    if (payload.requires_face_verification) {
      const missing = filteredSubjects.filter((s) => !s.invigilator_id);
      if (missing.length) {
        setErr(`Please assign an invigilator for each subject (${missing.map((s) => s.subject_code || "new subject").join(", ")}).`);
        setSaving(false);
        return;
      }
    }
    if (!payload.subjects.length) {
      setErr("Add at least one subject for the hall ticket.");
      setSaving(false);
      return;
    }
    if (!form.title.trim()) {
      setErr("Enter an overall examination title.");
      setSaving(false);
      return;
    }
    if (!form.room) {
      setErr("Select an exam hall/room from halls created under Seating.");
      setSaving(false);
      return;
    }
    const mapSubject = (s: typeof filteredSubjects[0]) => ({
      subjectCode: s.subject_code,
      subjectName: s.subject_name,
      date: s.exam_date,
      time: s.exam_time,
      duration: s.duration,
      invigilatorId: s.invigilator_id ? Number(s.invigilator_id) : null,
      invigilatorName: teachers.find((t) => Number(t.id.replace(/^t/, "")) === Number(s.invigilator_id))?.name || null,
    });
    const primaryInvigilator = payload.subjects[0]?.invigilator_id ?? null;
    try {
      if (isEdit && exam) {
        const eid = exam.id.replace(/^e/, "");
        await apiPut(`/api/admin/exams/${eid}/update`, payload, "Failed to update exam");
        onSaved({
          ...exam,
          title: form.title.trim(),
          subjectCode: payload.subjects[0].subject_code,
          subjectName: payload.subjects[0].subject_name,
          department: form.department,
          semester: form.semester,
          date: form.exam_date,
          time: form.exam_time,
          duration: form.duration,
          room: form.room,
          totalMarks: form.total_marks,
          feeAmount: form.fee_amount,
          requiresFaceVerification: form.requires_face_verification,
          invigilatorId: primaryInvigilator,
          invigilatorName: teachers.find((t) => Number(t.id.replace(/^t/, "")) === primaryInvigilator)?.name || null,
          subjects: payload.subjects.map(mapSubject),
        });
      } else {
        const res = await apiAddExam(payload) as { exam_id: number };
        onSaved({
          id: `e${res.exam_id}`,
          title: form.title.trim(),
          subjectCode: payload.subjects[0].subject_code,
          subjectName: payload.subjects[0].subject_name,
          department: form.department,
          semester: form.semester,
          date: form.exam_date,
          time: form.exam_time,
          duration: form.duration,
          room: form.room,
          totalMarks: form.total_marks,
          feeAmount: form.fee_amount,
          requiresFaceVerification: form.requires_face_verification,
          invigilatorId: primaryInvigilator,
          invigilatorName: teachers.find((t) => Number(t.id.replace(/^t/, "")) === primaryInvigilator)?.name || null,
          subjects: payload.subjects.map(mapSubject),
        });
      }
    } catch (e: any) { setErr(e.message); }
    setSaving(false);
  };
  return (
    <Modal onClose={onClose} panelClassName="max-w-2xl">
      <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <h3 className="text-lg font-bold">{isEdit ? "Edit Exam" : "Schedule Exam"}</h3>
        <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
      </div>
        <div className="p-6 space-y-3">
          <Field label="Examination Title">
            <TextInput
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Mid-Semester Examination Nov 2026"
            />
          </Field>
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
                <TextInput value={subj.duration} onChange={(e) => updateSubject(idx, "duration", e.target.value)} placeholder="3 hours" />
                <Select
                  value={subj.invigilator_id}
                  onChange={(e) => updateSubject(idx, "invigilator_id", e.target.value)}
                >
                  <option value="">Select invigilator…</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id.replace(/^t/, "")}>
                      {t.name} ({t.empId}) — {t.department}
                    </option>
                  ))}
                </Select>
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
            <Field label="Exam Hall / Room">
              <Select
                value={form.room}
                onChange={(e) => setForm({ ...form, room: e.target.value })}
                disabled={roomsLoading}
              >
                <option value="">{roomsLoading ? "Loading halls…" : "Select hall / room…"}</option>
                {seatingRooms.map((r) => {
                  const label = `${r.room_name} (${r.room_code})`;
                  return (
                    <option key={r.id} value={label}>
                      {label} — {r.rows}×{r.columns}
                    </option>
                  );
                })}
                {form.room && !seatingRooms.some((r) => `${r.room_name} (${r.room_code})` === form.room) && (
                  <option value={form.room}>{form.room} (current)</option>
                )}
              </Select>
              {!roomsLoading && seatingRooms.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">No halls found. Add halls under Admin → Seating first.</p>
              )}
            </Field>
            <Field label="Total Marks"><TextInput type="number" value={form.total_marks} onChange={(e) => setForm({ ...form, total_marks: +e.target.value })} /></Field>
            <Field label="Exam Fee (₹)">
              <TextInput type="number" min={0} value={form.fee_amount} onChange={(e) => setForm({ ...form, fee_amount: +e.target.value })} />
            </Field>
          </div>
          <p className="text-xs text-slate-500 -mt-1">Students in this department &amp; semester must pay this fee for the examination.</p>
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
    </Modal>
  );
}

// ==================== INTERNAL MARKS ====================
export function AdminMarks() {
  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStudents().then((s) => {
      setStudents(s);
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(
    () => students.filter((s) => s.name.toLowerCase().includes(search.toLowerCase())),
    [students, search],
  );
  const { page, setPage, pageSize, setPageSize, totalPages, total, paged } = useClientPagination(filtered, 10);

  if (loading) return <div className="p-10 text-center text-slate-500">Loading marks from MySQL…</div>;
  return (
    <div>
      <PageHeader title="Internal Marks Management" subtitle="View student internal marks and attendance aggregates" />

      <Card className="p-4 mb-6 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
        <p className="text-sm text-amber-900 dark:text-amber-200">
          Internal marks and attendance are uploaded by teachers only. Admin can view student aggregates below.
        </p>
      </Card>

      <Card className="p-5 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <TextInput placeholder="Search students..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="pl-10" />
        </div>
      </Card>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr className="text-left text-slate-600 dark:text-slate-300">
                <th className="p-4 font-medium">Student</th>
                <th className="p-4 font-medium">Department</th>
                <th className="p-4 font-medium">Attendance %</th>
                <th className="p-4 font-medium">Internal /{INTERNAL_MARKS_MAX}</th>
                <th className="p-4 font-medium">Assignment /{ASSIGNMENT_MARKS_MAX}</th>
                <th className="p-4 font-medium">Total /{INTERNAL_ASSIGNMENT_TOTAL}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {paged.map((s) => (
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
                  <td className="p-4 text-slate-700 dark:text-slate-200">{s.attendance}%</td>
                  <td className="p-4 text-slate-700 dark:text-slate-200">{s.internalMarks}/{INTERNAL_MARKS_MAX}</td>
                  <td className="p-4 text-slate-700 dark:text-slate-200">{s.assignmentMarks}/{ASSIGNMENT_MARKS_MAX}</td>
                  <td className="p-4 font-semibold text-slate-800 dark:text-white">{s.internalMarks + s.assignmentMarks}/{INTERNAL_ASSIGNMENT_TOTAL}</td>
                </tr>
              ))}
              {paged.length === 0 && (
                <tr><td colSpan={6} className="p-10 text-center text-slate-500">No students found</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
      </Card>
    </div>
  );
}

// ==================== ELIGIBILITY ====================
export function AdminEligibility() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "eligible" | "not">("all");
  const [deptFilter, setDeptFilter] = useState<string>("all");
  useEffect(() => { fetchStudents().then((s) => { setStudents(s); setLoading(false); }); }, []);

  const list = useMemo(() => students.map((s) => ({ s, e: getStudentEligibility(s) })), [students]);

  const departments = useMemo(
    () => Array.from(new Set(students.map((s) => s.department).filter(Boolean))).sort(),
    [students],
  );

  const deptSummary = useMemo(() => {
    return departments.map((dept) => {
      const rows = list.filter(({ s }) => s.department === dept);
      const eligible = rows.filter(({ e }) => e.eligible).length;
      const notEligible = rows.length - eligible;
      const rate = rows.length ? Math.round((eligible / rows.length) * 100) : 0;
      return { dept, total: rows.length, eligible, notEligible, rate };
    });
  }, [departments, list]);

  const filtered = useMemo(
    () => list.filter(({ s, e }) => {
      if (deptFilter !== "all" && s.department !== deptFilter) return false;
      if (filter === "eligible") return e.eligible;
      if (filter === "not") return !e.eligible;
      return true;
    }),
    [list, filter, deptFilter],
  );
  const { page, setPage, pageSize, setPageSize, totalPages, total, paged } = useClientPagination(filtered, 10);

  const eligibleCount = useMemo(() => list.filter((x) => x.e.eligible).length, [list]);
  const ineligibleCount = list.length - eligibleCount;
  const eligibleRate = list.length ? Math.round((eligibleCount / list.length) * 100) : 0;
  const avgCriteriaMet = list.length
    ? Math.round(list.reduce((a, x) => a + x.e.eligibilityPct, 0) / list.length)
    : 0;

  if (loading) return <div className="p-10 text-center text-slate-500">Loading from MySQL…</div>;

  return (
    <div>
      <PageHeader title="Eligibility Verification" subtitle={`${list.length} students • must pass all 3 criteria to be Eligible`} />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <Card className="p-5"><p className="text-xs text-slate-500 font-medium">Total Students</p><p className="text-3xl font-bold text-slate-900 dark:text-white mt-2">{list.length}</p></Card>
        <Card className="p-5 border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/10">
          <p className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">Fully Eligible</p>
          <p className="text-3xl font-bold text-emerald-700 dark:text-emerald-300 mt-2">{eligibleCount}</p>
        </Card>
        <Card className="p-5 border-rose-200 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-900/10">
          <p className="text-xs text-rose-700 dark:text-rose-300 font-medium">Not Eligible</p>
          <p className="text-3xl font-bold text-rose-700 dark:text-rose-300 mt-2">{ineligibleCount}</p>
        </Card>
        <Card className="p-5 border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-900/10">
          <p className="text-xs text-indigo-700 dark:text-indigo-300 font-medium">Eligible Rate</p>
          <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400 mt-2">{eligibleRate}%</p>
          <p className="text-[11px] text-slate-500 mt-1">{eligibleCount}/{list.length} passed all 3</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-slate-500 font-medium">Avg Criteria Met</p>
          <p className="text-3xl font-bold text-slate-700 dark:text-slate-200 mt-2">{avgCriteriaMet}%</p>
          <p className="text-[11px] text-slate-500 mt-1">Mean of (checks passed ÷ 3)</p>
        </Card>
      </div>

      <Card className="p-5 mb-6">
        <h4 className="font-semibold text-slate-900 dark:text-white mb-3">Department-wise Eligibility</h4>
        {deptSummary.length === 0 ? (
          <p className="text-sm text-slate-500">No department data available.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {deptSummary.map((d) => (
              <div key={d.dept} className="rounded-lg border border-slate-200 dark:border-slate-700 p-4 bg-slate-50/50 dark:bg-slate-800/30">
                <p className="font-semibold text-slate-900 dark:text-white">{d.dept}</p>
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                  Eligible: <span className="font-medium text-emerald-600 dark:text-emerald-400">{d.eligible}</span>
                  {" · "}
                  Not Eligible: <span className="font-medium text-rose-600 dark:text-rose-400">{d.notEligible}</span>
                </p>
                <p className="text-xs text-slate-500 mt-1">Total: {d.total} · Rate: {d.rate}%</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-5 mb-6">
        <h4 className="font-semibold text-slate-900 dark:text-white mb-2">How eligibility is checked</h4>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
          A student is <strong>Eligible</strong> only if they pass <strong>all 3</strong> rules below.
          Score shows how many rules they passed (33% / 67% / 100%). That is why Avg Criteria Met can be high even when Eligible Rate is lower.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <Criterion label="≥ 75% Attendance" icon="📊" />
          <Criterion label={`≥ 40% Internals (/${INTERNAL_MARKS_MAX})`} icon="📝" />
          <Criterion label="Fee Paid" icon="💳" />
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="p-5 pb-0">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
            <div className="flex gap-2 flex-wrap">
              {(["all", "eligible", "not"] as const).map((f) => (
                <button key={f} onClick={() => { setFilter(f); setPage(1); }}
                  className={cn("px-4 py-2 rounded-lg text-sm font-medium capitalize",
                    filter === f ? "bg-indigo-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300")}>
                  {f === "not" ? "Not Eligible" : f === "eligible" ? "Fully Eligible" : "All Students"}
                </button>
              ))}
            </div>
            <Select
              value={deptFilter}
              onChange={(e) => { setDeptFilter(e.target.value); setPage(1); }}
              className="sm:w-56 sm:ml-auto"
            >
              <option value="all">All Departments</option>
              {departments.map((d) => <option key={d} value={d}>{d}</option>)}
            </Select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200 dark:border-slate-800">
                  <th className="pb-3 font-medium">Student</th>
                  <th className="pb-3 font-medium">Attendance</th>
                  <th className="pb-3 font-medium">Internals</th>
                  <th className="pb-3 font-medium">Fee</th>
                  <th className="pb-3 font-medium">Checks</th>
                  <th className="pb-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {paged.map(({ s, e }) => (
                  <tr key={s.id}>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <img src={s.photo} alt="" className="w-8 h-8 rounded-full bg-slate-200" />
                        <div>
                          <p className="font-medium">{s.name}</p>
                          <p className="text-xs text-slate-500">{s.rollNo} • {s.department}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3">{e.checks.attendance ? <Check /> : <XIcon />}{s.attendance}%</td>
                    <td className="py-3">{e.checks.internals ? <Check /> : <XIcon />}{s.internalMarks}/{INTERNAL_MARKS_MAX}</td>
                    <td className="py-3">{e.checks.fee ? <Check /> : <XIcon />}{s.feePaid ? "Paid" : "Due"}</td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-500" style={{ width: `${e.eligibilityPct}%` }} />
                        </div>
                        <span className="text-xs whitespace-nowrap">{e.passed}/{e.total} ({e.eligibilityPct}%)</span>
                      </div>
                    </td>
                    <td className="py-3">{e.eligible ? <Badge variant="green">Eligible</Badge> : <Badge variant="red">Not Eligible</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
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
    exam_title?: string;
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

  const { page, setPage, pageSize, setPageSize, totalPages, total, paged } = useClientPagination(tickets, 10);

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

  if (loading) return <div className="p-10 text-center text-slate-500">Loading hall tickets from MySQL…</div>;

  return (
    <div>
      <PageHeader title="Hall Ticket Management" subtitle="View hall tickets with AI-assigned seats and download PDFs"
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
          Seats are assigned by the AI seating system only and cannot be edited manually. Use Seating Arrangement to allocate seats, then Generate / Sync All to refresh hall tickets.
        </p>
      </Card>

      {(message || error) && (
        <div className={cn("mb-4 p-3 rounded-lg text-sm", error ? "bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300")}>
          {error || message}
        </div>
      )}

      {tickets.length === 0 ? (
        <Card className="p-10 text-center text-slate-500">
          No hall tickets yet. Run seating arrangement, sync hall tickets, or click Generate / Sync All.
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="space-y-4 p-5">
            {paged.map((t) => {
              const subjectRows = t.subjects?.length
                ? t.subjects
                : [{ subject_code: t.subject_code || "", subject_name: t.exam, seat_number: t.seat_number, room: t.room, exam_date: t.exam_date, exam_time: t.exam_time }];

              return (
                <div key={t.id} className={cn("rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden", t.has_seat_conflict && "ring-2 ring-amber-400")}>
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
                        {(t.exam_title || t.exam) && (
                          <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400 mt-0.5">{t.exam_title || t.exam}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="secondary" onClick={() => {
                        const student: Student = { id: `s${t.student_id}`, rollNo: t.roll_no, name: t.student_name, email: "", mobile: "", department: t.department, semester: 5, section: "A", photo: t.photo, attendance: 75, internalMarks: 30, assignmentMarks: 7, previousResult: 7, backlogs: 0, feePaid: true, feeAmount: 45000, feeDueDate: "", createdAt: "" };
                        downloadHallTicket(student, t.hall_ticket_no, systemSettings.university_name, systemSettings.academic_year, t.room, t.seat_number, t.qr_code_content, t.subjects, {
                          title: t.exam_title || t.exam,
                          subjectCode: t.subject_code || t.exam, subjectName: t.exam,
                          date: t.exam_date || DEFAULT_HALL_TICKET_EXAM.date, time: t.exam_time || DEFAULT_HALL_TICKET_EXAM.time,
                          duration: t.duration || DEFAULT_HALL_TICKET_EXAM.duration, room: t.room,
                        }, systemSettings.college_logo_url);
                      }}>
                        <Download className="w-4 h-4" /> PDF
                      </Button>
                    </div>
                  </div>

                  <div className="p-5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Subjects — Hall & Seat</p>
                    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                      <table className="w-full text-sm table-fixed">
                        <thead className="bg-slate-50 dark:bg-slate-800/80">
                          <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                            <th className="px-3 py-2.5 w-10">#</th>
                            <th className="px-3 py-2.5 w-20">Code</th>
                            <th className="px-3 py-2.5">Subject</th>
                            <th className="px-3 py-2.5 w-28">Date</th>
                            <th className="px-3 py-2.5 w-24">Time</th>
                            <th className="px-3 py-2.5 w-36">Exam Hall</th>
                            <th className="px-3 py-2.5 w-28">Seat</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {subjectRows.map((s, idx) => {
                            const rowConflict = t.seat_conflicts?.find((c) => c.subject_code === s.subject_code);
                            return (
                              <tr
                                key={`${s.subject_code}-${idx}`}
                                className={cn(rowConflict && "bg-amber-50 dark:bg-amber-950/20")}
                              >
                                <td className="px-3 py-2.5 text-slate-500 align-middle">{idx + 1}</td>
                                <td className="px-3 py-2.5 font-mono font-semibold text-indigo-600 align-middle">{s.subject_code || "—"}</td>
                                <td className="px-3 py-2.5 align-middle">
                                  <p className="font-medium text-slate-900 dark:text-white">{s.subject_name || "—"}</p>
                                  {rowConflict && (
                                    <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                                      Conflict with {rowConflict.assigned_to} — try {rowConflict.suggested_seat}
                                    </p>
                                  )}
                                </td>
                                <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300 align-middle">{s.exam_date || "—"}</td>
                                <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300 align-middle">{s.exam_time || "—"}</td>
                                <td className="px-3 py-2.5 align-middle">
                                  <span className="font-semibold text-indigo-700 dark:text-indigo-300">{s.room || "—"}</span>
                                </td>
                                <td className="px-3 py-2.5 align-middle">
                                  <span className="font-semibold text-indigo-700 dark:text-indigo-300">{s.seat_number || "—"}</span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
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

function HallTicketPreview({ student, hallTicketNo, onClose }: { student: Student; hallTicketNo: string; onClose: () => void }) {
  const { settings: systemSettings } = useSystemSettings();
  const exam = { ...DEFAULT_HALL_TICKET_EXAM };
  const seatNumber = `S${100 + parseInt(student.id.replace(/\D/g, ""), 10)}`;
  const qrValue = JSON.stringify({ htNo: hallTicketNo, name: student.name, roll: student.rollNo, seat: seatNumber, room: exam.room, verified: true });
  const logo = universityInitials(systemSettings.university_name);

  return (
    <Modal onClose={onClose} panelClassName="max-w-3xl">
      <div className="sticky top-0 bg-white border-b border-slate-200 p-4 flex justify-between items-center">
        <h3 className="font-bold">Hall Ticket Preview</h3>
        <div className="flex gap-2">
          <Button variant="primary" onClick={() => downloadHallTicket(student, hallTicketNo, systemSettings.university_name, systemSettings.academic_year, undefined, undefined, undefined, undefined, undefined, systemSettings.college_logo_url)}><Download className="w-4 h-4" /> Download PDF</Button>
          <Button variant="secondary" onClick={() => window.print()}><Printer className="w-4 h-4" /> Print</Button>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 px-2">✕</button>
        </div>
      </div>
      <div className="p-5 bg-gradient-to-br from-slate-50 to-indigo-50">
        <div className="bg-white border-2 border-indigo-600 rounded-xl overflow-hidden">
          <div className="bg-brand-gradient text-white px-4 py-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-bold text-base break-words leading-snug">{systemSettings.university_name}</p>
              <p className="text-xs opacity-90">{examHeaderSubtitle(systemSettings.academic_year)}</p>
            </div>
            {systemSettings.college_logo_url ? (
              <img src={systemSettings.college_logo_url} alt="College logo" className="w-12 h-12 shrink-0 rounded-lg bg-white object-contain p-1" />
            ) : (
              <div className="w-12 h-12 shrink-0 rounded-full bg-white/20 backdrop-blur flex items-center justify-center text-lg font-bold">{logo}</div>
            )}
          </div>
          <div className="p-4">
            <div className="text-center mb-3 pb-2 border-b border-slate-200">
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Official Hall Ticket</p>
              <p className="font-mono font-bold text-lg text-indigo-600 mt-0.5 break-all">{hallTicketNo}</p>
            </div>
            <div className="flex gap-4 items-start">
              <dl className="flex-1 min-w-0 grid grid-cols-[6.5rem_1fr] gap-x-3 gap-y-1.5 text-sm">
                <dt className="text-slate-500">Name</dt>
                <dd className="font-medium text-slate-900 break-words">{student.name}</dd>
                <dt className="text-slate-500">Roll No</dt>
                <dd className="font-medium text-slate-900 break-all">{student.rollNo}</dd>
                <dt className="text-slate-500">Department</dt>
                <dd className="font-medium text-slate-900 break-words">{student.department}</dd>
                <dt className="text-slate-500">Semester</dt>
                <dd className="font-medium text-slate-900">Semester {student.semester}</dd>
              </dl>
              <img src={student.photo} alt="" className="w-28 h-28 shrink-0 rounded-md bg-slate-100 border border-indigo-200 object-cover" />
            </div>
            <div className="mt-3 overflow-x-auto rounded-md border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-left text-[10px] uppercase tracking-wide text-slate-500">
                    <th className="px-2.5 py-2 whitespace-nowrap">Code</th>
                    <th className="px-2.5 py-2">Subject</th>
                    <th className="px-2.5 py-2 whitespace-nowrap">Date</th>
                    <th className="px-2.5 py-2 whitespace-nowrap">Time</th>
                    <th className="px-2.5 py-2 whitespace-nowrap">Duration</th>
                    <th className="px-2.5 py-2">Hall</th>
                    <th className="px-2.5 py-2 text-center whitespace-nowrap">Seat</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="px-2.5 py-2 font-mono font-semibold text-indigo-600 whitespace-nowrap align-top">{exam.subjectCode}</td>
                    <td className="px-2.5 py-2 font-medium break-words align-top">{exam.subjectName}</td>
                    <td className="px-2.5 py-2 whitespace-nowrap align-top">{exam.date}</td>
                    <td className="px-2.5 py-2 whitespace-nowrap align-top">{exam.time}</td>
                    <td className="px-2.5 py-2 whitespace-nowrap align-top">{exam.duration}</td>
                    <td className="px-2.5 py-2 font-semibold text-indigo-700 break-words align-top">{exam.room}</td>
                    <td className="px-2.5 py-2 text-center font-bold text-indigo-700 whitespace-nowrap align-top">{seatNumber}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-200 flex items-end justify-between gap-4">
              <div className="text-xs text-slate-600 space-y-1">
                <p>Issued: {new Date().toLocaleDateString()}</p>
                <p className="font-semibold text-slate-800">Controller of Examinations</p>
              </div>
              <div className="flex flex-col items-center shrink-0">
                <div className="p-1.5 rounded-md border border-indigo-200 bg-indigo-50">
                  <QRCodeSVG value={qrValue} size={88} level="H" />
                </div>
                <p className="text-[9px] text-slate-500 mt-1 font-semibold">Scan to verify</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
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
type BacklogSubject = {
  id: number;
  subject_code: string;
  subject_name: string;
  from_semester: number;
  exam_date?: string;
  exam_time?: string;
  duration?: string;
  status?: string;
  is_cleared: boolean;
  fee_amount?: number;
  on_hall_ticket?: boolean;
};

type BacklogStudentRow = {
  id: number;
  name: string;
  roll_no: string;
  department: string;
  semester?: number;
  backlogs: number;
  attendance: number;
  is_eligible: boolean;
  photo?: string;
  backlog_subjects?: BacklogSubject[];
};

export function AdminBacklogs() {
  const [rows, setRows] = useState<BacklogStudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<BacklogStudentRow | null>(null);
  const [form, setForm] = useState({
    subject_code: "",
    subject_name: "",
    from_semester: 1,
    exam_date: "",
    exam_time: "10:00 AM",
    duration: "3 hours",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const reload = async () => {
    const data = await api.adminBacklogs().catch(() => []);
    setRows(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  useEffect(() => { reload(); }, []);

  const withBacklogs = useMemo(
    () => rows.filter((s) => (s.backlog_subjects || []).some((b) => !b.is_cleared) || s.backlogs > 0),
    [rows],
  );
  const { page, setPage, pageSize, setPageSize, totalPages, total, paged } = useClientPagination(withBacklogs, 10);

  const openManage = async (row: BacklogStudentRow) => {
    setErr(null);
    try {
      const detail = await api.adminStudentBacklogs(row.id);
      setSelected({
        ...row,
        backlogs: detail.backlogs,
        backlog_subjects: detail.subjects || [],
      });
      setForm({
        subject_code: "",
        subject_name: "",
        from_semester: Math.max(1, (row.semester || 2) - 1),
        exam_date: "",
        exam_time: "10:00 AM",
        duration: "3 hours",
      });
    } catch (e: any) {
      alert(e.message || "Failed to load backlogs");
    }
  };

  const addBacklog = async () => {
    if (!selected) return;
    setSaving(true);
    setErr(null);
    try {
      await api.adminAddStudentBacklog(selected.id, form);
      await openManage(selected);
      await reload();
    } catch (e: any) {
      setErr(e.message || "Failed to add backlog");
    } finally {
      setSaving(false);
    }
  };

  const clearBacklog = async (backlogId: number) => {
    if (!selected) return;
    await api.adminUpdateStudentBacklog(selected.id, backlogId, { is_cleared: true });
    await openManage(selected);
    await reload();
  };

  const removeBacklog = async (backlogId: number) => {
    if (!selected) return;
    if (!confirm("Remove this backlog subject from hall ticket?")) return;
    await api.adminDeleteStudentBacklog(selected.id, backlogId);
    await openManage(selected);
    await reload();
  };

  if (loading) return <div className="p-10 text-center text-slate-500">Loading from MySQL…</div>;
  return (
    <div>
      <PageHeader
        title="Backlog Management"
        subtitle="Record failed subjects. Students apply + pay; after you approve the fee, papers appear on the hall ticket."
      />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="p-5"><p className="text-xs text-slate-500">Active Backlog Papers</p><p className="text-3xl font-bold text-rose-600 mt-2">{withBacklogs.reduce((a, s) => a + (s.backlog_subjects?.filter((b) => !b.is_cleared).length || s.backlogs), 0)}</p></Card>
        <Card className="p-5"><p className="text-xs text-slate-500">Affected Students</p><p className="text-3xl font-bold text-amber-600 mt-2">{withBacklogs.length}</p></Card>
        <Card className="p-5"><p className="text-xs text-slate-500">Flow</p><p className="text-sm text-slate-600 dark:text-slate-300 mt-2">Record → Student Apply → Pay → Approve fee → Hall ticket</p></Card>
      </div>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr className="text-left text-slate-600 dark:text-slate-300">
                <th className="p-4 font-medium">Student</th>
                <th className="p-4 font-medium">Department</th>
                <th className="p-4 font-medium">Backlog Subjects</th>
                <th className="p-4 font-medium">Attendance</th>
                <th className="p-4 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {paged.map((s) => {
                const active = (s.backlog_subjects || []).filter((b) => !b.is_cleared);
                return (
                  <tr key={s.id}>
                    <td className="p-4"><div className="flex items-center gap-3"><img src={s.photo || "https://api.dicebear.com/7.x/avataaars/svg?seed=student"} className="w-8 h-8 rounded-full" alt="" /><div><p className="font-medium">{s.name}</p><p className="text-xs text-slate-500">{s.roll_no}</p></div></div></td>
                    <td className="p-4">{s.department}{s.semester != null ? ` · Sem ${s.semester}` : ""}</td>
                    <td className="p-4">
                      {active.length === 0 ? <Badge variant="red">{s.backlogs} pending</Badge> : (
                        <div className="space-y-1">
                          {active.map((b) => (
                            <div key={b.id} className="text-xs">
                              <Badge variant="red">{b.subject_code}</Badge>
                              <span className="ml-1 text-slate-600 dark:text-slate-300">{b.subject_name} (Sem {b.from_semester})</span>
                              <span className="ml-1">
                                <Badge variant={b.status === "approved" ? "green" : b.status === "applied" ? "indigo" : "amber"}>
                                  {b.status || "open"}
                                </Badge>
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="p-4">{s.attendance}%</td>
                    <td className="p-4 text-right">
                      <Button variant="primary" onClick={() => openManage(s)}>Manage Subjects</Button>
                    </td>
                  </tr>
                );
              })}
              {withBacklogs.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-10 text-center text-slate-500">
                    No backlog subjects yet. Open a student via search below or use Manage after adding from student list.
                    <div className="mt-4">
                      <Button variant="secondary" onClick={async () => {
                        const all = await fetchStudents();
                        const pick = window.prompt("Enter student roll number to add backlog subjects:");
                        if (!pick) return;
                        const found = all.find((s) => s.rollNo.toLowerCase() === pick.trim().toLowerCase());
                        if (!found) { alert("Student not found"); return; }
                        openManage({
                          id: Number(found.id.replace(/^s/, "")),
                          name: found.name,
                          roll_no: found.rollNo,
                          department: found.department,
                          semester: found.semester,
                          backlogs: found.backlogs,
                          attendance: found.attendance,
                          is_eligible: false,
                          photo: found.photo,
                          backlog_subjects: [],
                        });
                      }}>
                        Add backlog for student (by roll no)
                      </Button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
      </Card>

      {selected && (
        <Modal onClose={() => setSelected(null)} panelClassName="max-w-2xl">
          <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold">Backlog Subjects — {selected.name}</h3>
              <p className="text-xs text-slate-500">{selected.roll_no} · On hall ticket only after student apply + fee approval</p>
            </div>
            <button onClick={() => setSelected(null)}><X className="w-5 h-5 text-slate-400" /></button>
          </div>
          <div className="p-6 space-y-4">
            {(selected.backlog_subjects || []).length === 0 ? (
              <p className="text-sm text-slate-500">No backlog subjects yet.</p>
            ) : (
              <div className="space-y-2">
                {(selected.backlog_subjects || []).map((b) => (
                  <div key={b.id} className={cn("p-3 rounded-lg border flex items-center justify-between gap-3", b.is_cleared ? "opacity-50 border-slate-200" : "border-rose-200 bg-rose-50/40 dark:bg-rose-950/20")}>
                    <div>
                      <p className="font-semibold">{b.subject_code} — {b.subject_name}</p>
                      <p className="text-xs text-slate-500">
                        From semester {b.from_semester}
                        {b.exam_date ? ` · ${b.exam_date} ${b.exam_time || ""}` : ""}
                        {b.is_cleared ? " · Cleared" : ` · ${b.status || "open"}`}
                        {b.on_hall_ticket ? " · On hall ticket" : ""}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {!b.is_cleared && (
                        <Button variant="secondary" onClick={() => clearBacklog(b.id)}>Mark Cleared</Button>
                      )}
                      <Button variant="secondary" onClick={() => removeBacklog(b.id)}>Remove</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-3">
              <p className="font-semibold text-sm">Record previous-semester fail</p>
              {err && <div className="p-2 rounded bg-rose-50 text-rose-700 text-sm">{err}</div>}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Subject Code"><TextInput value={form.subject_code} onChange={(e) => setForm({ ...form, subject_code: e.target.value })} placeholder="CS201" /></Field>
                <Field label="From Semester"><TextInput type="number" min={1} max={8} value={form.from_semester} onChange={(e) => setForm({ ...form, from_semester: +e.target.value })} /></Field>
              </div>
              <Field label="Subject Name"><TextInput value={form.subject_name} onChange={(e) => setForm({ ...form, subject_name: e.target.value })} placeholder="Data Structures" /></Field>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Exam Date"><TextInput type="date" value={form.exam_date} onChange={(e) => setForm({ ...form, exam_date: e.target.value })} /></Field>
                <Field label="Exam Time"><TextInput value={form.exam_time} onChange={(e) => setForm({ ...form, exam_time: e.target.value })} /></Field>
                <Field label="Duration"><TextInput value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} /></Field>
              </div>
              <Button variant="primary" disabled={saving} onClick={addBacklog}>
                {saving ? "Saving…" : "Record Fail Subject"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
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
  fee_type?: string;
  exam_title?: string;
  exam_id?: number | null;
  backlog_id?: number | null;
  backlog_subject?: string | null;
  transaction_id: string;
  reference: string;
  status: string;
  paid_at: string | null;
};

type UnpaidFeeStudent = {
  id: number;
  name: string;
  roll_no: string;
  department?: string;
  semester?: number;
  amount: number;
  exam_fee_amount: number;
  exam_fee_paid: boolean;
  college_fee_amount: number;
  college_fee_paid: boolean;
  unpaid_exams?: {
    exam_id: number;
    title: string;
    fee_amount: number;
    paid: boolean;
  }[];
  due_date?: string | null;
  photo?: string;
};

export function AdminFees() {
  const [unpaidStudents, setUnpaidStudents] = useState<UnpaidFeeStudent[]>([]);
  const [pending, setPending] = useState<PendingFeePayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<number | null>(null);
  const [examFee, setExamFee] = useState(45000);
  const [collegeFee, setCollegeFee] = useState(25000);
  const [feeDueDate, setFeeDueDate] = useState("");
  const [applyToUnpaid, setApplyToUnpaid] = useState(true);
  const [savingFee, setSavingFee] = useState(false);
  const [feeMessage, setFeeMessage] = useState<string | null>(null);
  const [feeError, setFeeError] = useState<string | null>(null);
  const [totals, setTotals] = useState({ collected: 0, due: 0, unpaidCount: 0 });

  const reload = async () => {
    const feeData = await api.adminFees().catch(() => ({
      pending_verifications: [],
      unpaid_students: [],
      default_exam_fee: 45000,
      default_college_fee: 25000,
      total_collected: 0,
      total_due: 0,
      unpaid_count: 0,
    }));
    setPending(feeData.pending_verifications || []);
    setUnpaidStudents(feeData.unpaid_students || []);
    if (feeData.default_exam_fee != null) setExamFee(Number(feeData.default_exam_fee));
    if (feeData.default_college_fee != null) setCollegeFee(Number(feeData.default_college_fee));
    setTotals({
      collected: Number(feeData.total_collected || 0),
      due: Number(feeData.total_due || 0),
      unpaidCount: Number(feeData.unpaid_count || 0),
    });
    setLoading(false);
  };

  useEffect(() => { reload(); }, []);

  const { page, setPage, pageSize, setPageSize, totalPages, total, paged } = useClientPagination(unpaidStudents, 10);

  const saveFees = async () => {
    setSavingFee(true);
    setFeeError(null);
    setFeeMessage(null);
    try {
      const result = await api.adminSetExamFee({
        default_exam_fee: Number(examFee),
        default_college_fee: Number(collegeFee),
        apply_to_unpaid: applyToUnpaid,
        fee_due_date: feeDueDate || undefined,
      });
      setFeeMessage(result.message || "Fee amounts saved");
      notifySystemSettingsUpdated();
      await reload();
    } catch (err: any) {
      setFeeError(err.message || "Failed to save fees");
    } finally {
      setSavingFee(false);
    }
  };

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

  const methodLabel = (method: string) => {
    if (method === "online") return "Online";
    if (method === "bank_transfer") return "Bank Transfer";
    if (method === "college") return "College Office";
    return method;
  };

  return (
    <div>
      <PageHeader
        title="Fee Management"
        subtitle="Set fee amounts and approve payments submitted by students. Admin cannot mark fees paid directly."
      />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-5"><p className="text-xs text-slate-500">College Fee</p><p className="text-2xl font-bold text-sky-600 mt-2">₹{Number(collegeFee).toLocaleString()}</p></Card>
        <Card className="p-5"><p className="text-xs text-slate-500">Exam Fee</p><p className="text-2xl font-bold text-indigo-600 mt-2">₹{Number(examFee).toLocaleString()}</p></Card>
        <Card className="p-5"><p className="text-xs text-slate-500">Total Collected</p><p className="text-2xl font-bold text-emerald-600 mt-2">₹{totals.collected.toLocaleString()}</p></Card>
        <Card className="p-5"><p className="text-xs text-slate-500">Awaiting Student Pay</p><p className="text-2xl font-bold text-rose-600 mt-2">{totals.unpaidCount}</p></Card>
      </div>

      <Card className="p-5 mb-6 border-indigo-200 dark:border-indigo-800 bg-indigo-50/40 dark:bg-indigo-950/20">
        <h3 className="font-semibold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
          <Wallet className="w-4 h-4 text-indigo-600" /> Set College & Exam Fee
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          Students must pay both fees. New students inherit these amounts. Optionally update unpaid students now.
        </p>
        {(feeMessage || feeError) && (
          <div className={cn("mb-3 p-3 rounded-lg text-sm", feeError ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700")}>
            {feeError || feeMessage}
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <Field label="College Fee (₹)">
            <TextInput type="number" min={0} value={collegeFee} onChange={(e) => setCollegeFee(+e.target.value)} />
          </Field>
          <Field label="Exam Fee (₹)">
            <TextInput type="number" min={0} value={examFee} onChange={(e) => setExamFee(+e.target.value)} />
          </Field>
          <Field label="Due Date (optional)">
            <TextInput type="date" value={feeDueDate} onChange={(e) => setFeeDueDate(e.target.value)} />
          </Field>
          <div className="flex flex-col justify-end gap-2">
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
              <input type="checkbox" checked={applyToUnpaid} onChange={(e) => setApplyToUnpaid(e.target.checked)} className="rounded border-slate-300" />
              Apply to unpaid students
            </label>
            <Button variant="primary" onClick={saveFees} disabled={savingFee}>
              <Save className="w-4 h-4" /> {savingFee ? "Saving…" : "Save Fees"}
            </Button>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden mb-6">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800">
          <p className="font-semibold text-slate-900 dark:text-white">Pending Verifications ({pending.length})</p>
          <p className="text-xs text-slate-500 mt-1">Only payments started by students appear here. Approve or reject them.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr className="text-left text-slate-600 dark:text-slate-300">
                <th className="p-4 font-medium">Student</th>
                <th className="p-4 font-medium">Fee Type</th>
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
                  <td className="p-4"><Badge variant="indigo">{
                    (p.fee_type || "exam") === "college"
                      ? "College"
                      : (p.fee_type || "") === "backlog"
                        ? (p.backlog_subject || "Backlog")
                        : (p.exam_title || "Exam")
                  }</Badge></td>
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
                <tr><td colSpan={7} className="p-10 text-center text-slate-500">No payments awaiting verification</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800">
          <p className="font-semibold text-slate-900 dark:text-white">Students with Pending Fees ({totals.unpaidCount})</p>
          <p className="text-xs text-slate-500 mt-1">Read-only. Students must pay from their Payments page; then approve above.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr className="text-left text-slate-600 dark:text-slate-300">
                <th className="p-4 font-medium">Student</th>
                <th className="p-4 font-medium">Roll No</th>
                <th className="p-4 font-medium">College Fee</th>
                <th className="p-4 font-medium">Exam Fee</th>
                <th className="p-4 font-medium">Due Date</th>
                <th className="p-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {paged.map((s) => {
                const overdue = s.due_date && new Date(s.due_date) < new Date();
                return (
                  <tr key={s.id}>
                    <td className="p-4"><div className="flex items-center gap-3"><img src={s.photo || "https://api.dicebear.com/7.x/avataaars/svg?seed=student"} className="w-8 h-8 rounded-full" alt="" /><span className="font-medium">{s.name}</span></div></td>
                    <td className="p-4 text-slate-600 dark:text-slate-300">{s.roll_no}</td>
                    <td className="p-4">
                      {s.college_fee_paid ? <Badge variant="green">Paid</Badge> : (
                        <span className="font-semibold">₹{Number(s.college_fee_amount || 0).toLocaleString()}</span>
                      )}
                    </td>
                    <td className="p-4">
                      {s.exam_fee_paid ? <Badge variant="green">Paid</Badge> : (
                        <div className="space-y-1">
                          {(s.unpaid_exams || []).length === 0 ? (
                            <span className="font-semibold">₹{Number(s.exam_fee_amount || 0).toLocaleString()}</span>
                          ) : (
                            (s.unpaid_exams || []).map((ex) => (
                              <div key={ex.exam_id} className="text-xs">
                                <span className="font-medium">{ex.title}</span>
                                <span className="ml-1 font-semibold">₹{Number(ex.fee_amount || 0).toLocaleString()}</span>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </td>
                    <td className="p-4">{s.due_date || "—"} {overdue && <Badge variant="red">Overdue</Badge>}</td>
                    <td className="p-4">
                      <Badge variant="amber">Awaiting student payment</Badge>
                    </td>
                  </tr>
                );
              })}
              {unpaidStudents.length === 0 && <tr><td colSpan={6} className="p-10 text-center text-slate-500">All college and exam fees collected</td></tr>}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
      </Card>
    </div>
  );
}
// ==================== NOTIFICATIONS ====================
export function AdminNotifications() {
  const { notifications, add, markAllRead, refresh } = useNotifications();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [audience, setAudience] = useState<"all" | "students" | "teachers" | "admin">("all");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const { page, setPage, pageSize, setPageSize, totalPages, total, paged } = useClientPagination(notifications, 10);

  const send = async () => {
    if (!title || !message) return;
    setSending(true);
    setErr(null);
    try {
      await api.sendNotification({ title, message, audience });
      add({ title, message, audience });
      setTitle(""); setMessage("");
      await refresh();
    } catch (e: any) {
      setErr(e.message || "Failed to send notification");
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <PageHeader title="Notifications" subtitle="Send announcements to students, teachers, or everyone" />
      {err && <div className="mb-4 p-3 rounded-lg text-sm bg-rose-50 text-rose-700">{err}</div>}
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
              <Button variant="primary" onClick={send} disabled={sending}><Mail className="w-4 h-4" /> {sending ? "Sending…" : "Send Notification"}</Button>
              <Button variant="secondary" onClick={markAllRead}>Mark all read</Button>
            </div>
          </div>
        </Card>
        <Card className="overflow-hidden">
          <div className="p-6 pb-0">
            <h3 className="font-bold text-slate-900 dark:text-white mb-4">Recent Notifications</h3>
            <div className="space-y-3">
              {paged.map((n) => (
                <div key={n.id} className="p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="font-semibold text-sm text-slate-900 dark:text-white">{n.title}</p>
                    <div className="flex flex-wrap gap-1">
                      {n.department && <Badge variant="amber">{n.department}</Badge>}
                      <Badge variant="sky">{formatNotificationAudience(n.audience)}</Badge>
                    </div>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 whitespace-pre-wrap">{n.message}</p>
                  <p className="text-xs text-slate-400 mt-1">{n.createdAt}</p>
                </div>
              ))}
              {!notifications.length && <p className="text-sm text-slate-500">No notifications yet</p>}
            </div>
          </div>
          <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
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
  college_logo_url: string;
  default_exam_fee: number;
  default_college_fee: number;
  default_backlog_fee: number;
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
    college_logo_url: "",
    default_exam_fee: 45000,
    default_college_fee: 25000,
    default_backlog_fee: 1500,
    apply_fee_to_unpaid: false,
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
          college_logo_url: data.college_logo_url || "",
          default_exam_fee: data.default_exam_fee ?? 45000,
          default_college_fee: data.default_college_fee ?? 25000,
          default_backlog_fee: data.default_backlog_fee ?? 1500,
          apply_fee_to_unpaid: false,
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
      setUniForm((f) => ({ ...f, apply_fee_to_unpaid: false }));
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
            <Field label="College Logo URL">
              <TextInput value={uniForm.college_logo_url} onChange={(e) => setUniForm({ ...uniForm, college_logo_url: e.target.value })} placeholder="https://..." />
            </Field>
            <Field label="Default College Fee">
              <TextInput type="number" min={0} value={uniForm.default_college_fee} onChange={(e) => setUniForm({ ...uniForm, default_college_fee: Number(e.target.value) })} />
            </Field>
            <Field label="Default Exam Fee">
              <TextInput type="number" min={0} value={uniForm.default_exam_fee} onChange={(e) => setUniForm({ ...uniForm, default_exam_fee: Number(e.target.value) })} />
            </Field>
            <Field label="Default Backlog Fee (per paper)">
              <TextInput type="number" min={0} value={uniForm.default_backlog_fee} onChange={(e) => setUniForm({ ...uniForm, default_backlog_fee: Number(e.target.value) })} />
            </Field>
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={uniForm.apply_fee_to_unpaid}
                onChange={(e) => setUniForm({ ...uniForm, apply_fee_to_unpaid: e.target.checked })}
                className="rounded border-slate-300"
              />
              Apply fee amounts to unpaid students
            </label>
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
