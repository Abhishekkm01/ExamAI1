// Talks directly to the FastAPI backend. NO mock data.
// If the backend is offline, the UI shows an empty state with a clear message.

import { api, isBackendOnline } from "./api";
import type { Student, Teacher, Exam } from "./types";
import { INTERNAL_MARKS_MAX } from "./marksConstants";

export function getStudentEligibilityLocal(s: Student) {
  const checks = {
    attendance: s.attendance >= 75,
    internals:  (s.internalMarks / INTERNAL_MARKS_MAX) * 100 >= 40,
    fee:        s.feePaid,
  };
  const passed = Object.values(checks).filter(Boolean).length;
  const total  = Object.keys(checks).length;
  const eligible = passed === total;
  const eligibilityPct = Math.round((passed / total) * 100);
  const score = Math.min(100, Math.round(
    s.attendance * 0.45 +
    ((s.internalMarks / INTERNAL_MARKS_MAX) * 100) * 0.35 +
    (s.feePaid ? 20 : 0)
  ));
  return { checks, passed, total, eligible, eligibilityPct, score };
}

function mapApiStudent(s: any): Student {
  return {
    id: `s${s.id}`, rollNo: s.roll_no, name: s.name, email: s.email, mobile: s.mobile || "",
    department: s.department, semester: s.semester, section: s.section, photo: s.photo,
    attendance: s.attendance, internalMarks: s.internal_marks, assignmentMarks: s.assignment_marks,
    previousResult: s.previous_result, backlogs: s.backlogs, feePaid: s.fee_paid,
    feeAmount: s.fee_amount, feeDueDate: s.fee_due_date || "", createdAt: "2023-08-12",
  };
}

// --- API fetchers (no mock fallback) ---

export async function fetchStudents(): Promise<Student[]> {
  const data = await api.adminStudents({ page: 1, page_size: 200 });
  return (data.students || []).map(mapApiStudent);
}

export async function fetchTeacherStudents(): Promise<Student[]> {
  const data = await api.teacherStudents();
  return (data || []).map((s: any) => ({
    id: `s${s.id}`, rollNo: s.roll_no, name: s.name, email: "",
    mobile: "", department: s.department || "Computer Science", semester: 0, section: "", photo: s.photo,
    attendance: s.attendance, internalMarks: s.internal_marks, assignmentMarks: 0,
    previousResult: s.previous_result, backlogs: s.backlogs, feePaid: true,
    feeAmount: 0, feeDueDate: "", createdAt: "2023-08-12",
  }));
}

export async function fetchTeachers(): Promise<Teacher[]> {
  const data = await api.adminTeachers();
  return (data || []).map((t: any) => ({
    id: `t${t.id}`, empId: t.emp_id, name: t.name, email: t.email,
    department: t.department, subjects: t.assigned_subjects || [], photo: t.photo,
  }));
}

function mapExam(e: any): Exam {
  return {
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
    requiresFaceVerification: e.requires_face_verification ?? true,
    invigilatorId: e.invigilator_id ?? null,
    invigilatorName: e.invigilator_name ?? null,
    subjects: (e.subjects || []).map((s: any) => ({
      subjectCode: s.subject_code,
      subjectName: s.subject_name,
      date: s.exam_date,
      time: s.exam_time,
      duration: s.duration,
      invigilatorId: s.invigilator_id ?? null,
      invigilatorName: s.invigilator_name ?? null,
    })),
  };
}

export async function fetchExams(): Promise<Exam[]> {
  const data = await api.studentExams();
  return (data || []).map(mapExam);
}

export async function fetchAdminExams(): Promise<Exam[]> {
  const data = await api.adminExams();
  return (data || []).map(mapExam);
}

export async function fetchDepartments(): Promise<string[]> {
  const data = await api.publicMeta();
  return data?.departments || [];
}

export async function fetchAttendanceTrends(): Promise<
  { day: string; date: string; attendance: number; absent: number; total: number }[]
> {
  const data = await api.adminAnalytics();
  return data?.attendance_trends || [];
}

export { getStudentEligibilityLocal as getStudentEligibility, isBackendOnline };
