// Talks directly to the FastAPI backend. NO mock data.
// If the backend is offline, the UI shows an empty state with a clear message.

import { api, isBackendOnline } from "./api";
import type { Student, Teacher, Exam, Notification } from "./mockData";

export function getStudentEligibilityLocal(s: Student) {
  const checks = {
    attendance: s.attendance >= 75,
    internals:  (s.internalMarks / 40) * 100 >= 40,
    backlogs:   s.backlogs === 0,
    fee:        s.feePaid,
    previous:   s.previousResult >= 5.0,
  };
  const passed = Object.values(checks).filter(Boolean).length;
  const total  = Object.keys(checks).length;
  const eligible = passed === total;
  const eligibilityPct = Math.round((passed / total) * 100);
  const score = Math.min(100, Math.round(
    s.attendance * 0.35 +
    ((s.internalMarks / 40) * 100) * 0.25 +
    (s.previousResult / 10) * 100 * 0.2 +
    (s.backlogs === 0 ? 100 : Math.max(0, 100 - s.backlogs * 30)) * 0.2
  ));
  return { checks, passed, total, eligible, eligibilityPct, score };
}

function mapApiStudent(s: any): Student {
  return {
    id: `s${s.id}`, rollNo: s.roll_no, name: s.name, email: s.email, mobile: s.mobile || "",
    department: s.department, semester: s.semester, section: s.section, photo: s.photo,
    attendance: s.attendance, internalMarks: s.internal_marks, assignmentMarks: s.assignment_marks,
    previousResult: s.previous_result, backlogs: s.backlogs, feePaid: s.fee_paid,
    feeAmount: s.fee_amount, feeDueDate: s.fee_due_date, createdAt: "2023-08-12",
  };
}

// --- API fetchers (no mock fallback) ---

export async function fetchStudents(): Promise<Student[]> {
  const data = await api.adminStudents({ page: 1, page_size: 200 });
  return (data.students || []).map(mapApiStudent);
}

export async function fetchTeachers(): Promise<Teacher[]> {
  const data = await api.adminTeachers();
  return (data || []).map((t: any) => ({
    id: `t${t.id}`, empId: t.emp_id, name: t.name, email: t.email,
    department: t.department, subjects: t.assigned_subjects || [], photo: t.photo,
  }));
}

export async function fetchExams(): Promise<Exam[]> {
  const data = await api.adminExams();
  return (data || []).map((e: any) => ({
    id: `e${e.id}`, subjectCode: e.subject_code, subjectName: e.subject_name,
    department: e.department, semester: e.semester, date: e.exam_date, time: e.exam_time,
    duration: e.duration, room: e.room, totalMarks: e.total_marks,
  }));
}

export async function fetchNotifications(): Promise<Notification[]> {
  const data = await api.studentNotifications();
  return (data || []).map((n: any) => ({
    id: `n${n.id}`, title: n.title, message: n.message,
    audience: n.audience, createdAt: n.created_at || "", read: n.is_read || false,
  }));
}

export { getStudentEligibilityLocal as getStudentEligibility, isBackendOnline };
