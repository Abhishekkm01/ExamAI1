// Mock data for ExamShield AI
// Replaces the Python/FastAPI + MySQL backend for the frontend demo.

export type Role = "admin" | "teacher" | "student";

export interface User {
  id: string;
  email: string;
  password: string;
  role: Role;
  name: string;
  avatar?: string;
}

export interface Student {
  id: string;
  rollNo: string;
  name: string;
  email: string;
  mobile: string;
  department: string;
  semester: number;
  section: string;
  photo: string;
  attendance: number;       // %
  internalMarks: number;    // out of 40
  assignmentMarks: number;  // out of 10
  previousResult: number;   // SGPA 0..10
  backlogs: number;
  feePaid: boolean;
  feeAmount: number;
  feeDueDate: string;
  createdAt: string;
}

export interface Teacher {
  id: string;
  empId: string;
  name: string;
  email: string;
  department: string;
  subjects: string[];
  photo: string;
}

export interface Exam {
  id: string;
  subjectCode: string;
  subjectName: string;
  department: string;
  semester: number;
  date: string;
  time: string;
  duration: string; // e.g. "3 hours"
  room: string;
  totalMarks: number;
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  subjectCode: string;
  date: string;
  status: "Present" | "Absent";
}

export interface InternalMark {
  id: string;
  studentId: string;
  subjectCode: string;
  subjectName: string;
  internal: number;   // /40
  assignment: number; // /10
}

export interface HallTicket {
  id: string;
  hallTicketNo: string;
  studentId: string;
  examId: string;
  seatNumber: string;
  room: string;
  issuedAt: string;
  eligible: boolean;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  audience: "all" | "students" | "teachers" | "admin";
  createdAt: string;
  read: boolean;
}

// ---- Seed data ----

const avatar = (seed: string) =>
  `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed)}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;

export const users: User[] = [
  { id: "u1", email: "admin@examshield.ai", password: "admin123", role: "admin", name: "Dr. Arjun Mehta", avatar: avatar("admin-arjun") },
  { id: "u2", email: "teacher@examshield.ai", password: "teacher123", role: "teacher", name: "Prof. Sneha Rao", avatar: avatar("sneha") },
  { id: "u3", email: "student@examshield.ai", password: "student123", role: "student", name: "Rahul Verma", avatar: avatar("rahul") },
];

export const students: Student[] = [
  {
    id: "s1", rollNo: "CS21B001", name: "Rahul Verma", email: "rahul.v@univ.edu", mobile: "+91 98765 43210",
    department: "Computer Science", semester: 5, section: "A", photo: avatar("rahul"),
    attendance: 82, internalMarks: 34, assignmentMarks: 8, previousResult: 8.4,
    backlogs: 0, feePaid: true, feeAmount: 45000, feeDueDate: "2026-09-30", createdAt: "2023-08-12",
  },
  {
    id: "s2", rollNo: "CS21B002", name: "Ananya Iyer", email: "ananya.i@univ.edu", mobile: "+91 98765 43211",
    department: "Computer Science", semester: 5, section: "A", photo: avatar("ananya"),
    attendance: 91, internalMarks: 37, assignmentMarks: 9, previousResult: 9.1,
    backlogs: 0, feePaid: true, feeAmount: 45000, feeDueDate: "2026-09-30", createdAt: "2023-08-12",
  },
  {
    id: "s3", rollNo: "CS21B003", name: "Karthik Nair", email: "karthik.n@univ.edu", mobile: "+91 98765 43212",
    department: "Computer Science", semester: 5, section: "B", photo: avatar("karthik"),
    attendance: 68, internalMarks: 28, assignmentMarks: 6, previousResult: 6.2,
    backlogs: 2, feePaid: false, feeAmount: 45000, feeDueDate: "2026-09-15", createdAt: "2023-08-12",
  },
  {
    id: "s4", rollNo: "CS21B004", name: "Priya Sharma", email: "priya.s@univ.edu", mobile: "+91 98765 43213",
    department: "Computer Science", semester: 5, section: "B", photo: avatar("priya"),
    attendance: 76, internalMarks: 31, assignmentMarks: 7, previousResult: 7.0,
    backlogs: 0, feePaid: true, feeAmount: 45000, feeDueDate: "2026-09-30", createdAt: "2023-08-12",
  },
  {
    id: "s5", rollNo: "EC21B001", name: "Vikram Desai", email: "vikram.d@univ.edu", mobile: "+91 98765 43214",
    department: "Electronics", semester: 5, section: "A", photo: avatar("vikram"),
    attendance: 88, internalMarks: 35, assignmentMarks: 8, previousResult: 8.0,
    backlogs: 0, feePaid: true, feeAmount: 47000, feeDueDate: "2026-09-30", createdAt: "2023-08-12",
  },
  {
    id: "s6", rollNo: "EC21B002", name: "Meera Pillai", email: "meera.p@univ.edu", mobile: "+91 98765 43215",
    department: "Electronics", semester: 5, section: "A", photo: avatar("meera"),
    attendance: 74, internalMarks: 29, assignmentMarks: 6, previousResult: 6.8,
    backlogs: 1, feePaid: false, feeAmount: 47000, feeDueDate: "2026-09-20", createdAt: "2023-08-12",
  },
  {
    id: "s7", rollNo: "ME21B001", name: "Arjun Kapoor", email: "arjun.k@univ.edu", mobile: "+91 98765 43216",
    department: "Mechanical", semester: 5, section: "A", photo: avatar("arjun"),
    attendance: 80, internalMarks: 32, assignmentMarks: 7, previousResult: 7.6,
    backlogs: 0, feePaid: true, feeAmount: 44000, feeDueDate: "2026-09-30", createdAt: "2023-08-12",
  },
  {
    id: "s8", rollNo: "ME21B002", name: "Divya Reddy", email: "divya.r@univ.edu", mobile: "+91 98765 43217",
    department: "Mechanical", semester: 5, section: "B", photo: avatar("divya"),
    attendance: 95, internalMarks: 38, assignmentMarks: 9, previousResult: 9.4,
    backlogs: 0, feePaid: true, feeAmount: 44000, feeDueDate: "2026-09-30", createdAt: "2023-08-12",
  },
  {
    id: "s9", rollNo: "CE21B001", name: "Rohan Singh", email: "rohan.s@univ.edu", mobile: "+91 98765 43218",
    department: "Civil", semester: 5, section: "A", photo: avatar("rohan"),
    attendance: 62, internalMarks: 22, assignmentMarks: 5, previousResult: 5.4,
    backlogs: 3, feePaid: false, feeAmount: 43000, feeDueDate: "2026-09-10", createdAt: "2023-08-12",
  },
  {
    id: "s10", rollNo: "CE21B002", name: "Ishita Banerjee", email: "ishita.b@univ.edu", mobile: "+91 98765 43219",
    department: "Civil", semester: 5, section: "A", photo: avatar("ishita"),
    attendance: 86, internalMarks: 33, assignmentMarks: 8, previousResult: 7.9,
    backlogs: 0, feePaid: true, feeAmount: 43000, feeDueDate: "2026-09-30", createdAt: "2023-08-12",
  },
];

export const teachers: Teacher[] = [
  { id: "t1", empId: "TCH001", name: "Prof. Sneha Rao", email: "sneha.r@univ.edu", department: "Computer Science", subjects: ["CS301", "CS302"], photo: avatar("sneha") },
  { id: "t2", empId: "TCH002", name: "Dr. Ramesh Kumar", email: "ramesh.k@univ.edu", department: "Electronics", subjects: ["EC301", "EC302"], photo: avatar("ramesh") },
  { id: "t3", empId: "TCH003", name: "Prof. Lakshmi Natarajan", email: "lakshmi.n@univ.edu", department: "Mechanical", subjects: ["ME301", "ME302"], photo: avatar("lakshmi") },
  { id: "t4", empId: "TCH004", name: "Dr. Suresh Patil", email: "suresh.p@univ.edu", department: "Civil", subjects: ["CE301", "CE302"], photo: avatar("suresh") },
];

export const subjects = [
  { code: "CS301", name: "Data Structures & Algorithms", dept: "Computer Science", sem: 5 },
  { code: "CS302", name: "Database Management Systems", dept: "Computer Science", sem: 5 },
  { code: "CS303", name: "Operating Systems", dept: "Computer Science", sem: 5 },
  { code: "EC301", name: "Digital Signal Processing", dept: "Electronics", sem: 5 },
  { code: "EC302", name: "Microprocessors", dept: "Electronics", sem: 5 },
  { code: "ME301", name: "Thermodynamics II", dept: "Mechanical", sem: 5 },
  { code: "ME302", name: "Machine Design", dept: "Mechanical", sem: 5 },
  { code: "CE301", name: "Structural Analysis", dept: "Civil", sem: 5 },
  { code: "CE302", name: "Fluid Mechanics", dept: "Civil", sem: 5 },
];

export const exams: Exam[] = [
  { id: "e1", subjectCode: "CS301", subjectName: "Data Structures & Algorithms", department: "Computer Science", semester: 5, date: "2026-11-10", time: "10:00 AM", duration: "3 hours", room: "Hall A-101", totalMarks: 100 },
  { id: "e2", subjectCode: "CS302", subjectName: "Database Management Systems", department: "Computer Science", semester: 5, date: "2026-11-13", time: "02:00 PM", duration: "3 hours", room: "Hall A-102", totalMarks: 100 },
  { id: "e3", subjectCode: "CS303", subjectName: "Operating Systems", department: "Computer Science", semester: 5, date: "2026-11-16", time: "10:00 AM", duration: "3 hours", room: "Hall A-103", totalMarks: 100 },
  { id: "e4", subjectCode: "EC301", subjectName: "Digital Signal Processing", department: "Electronics", semester: 5, date: "2026-11-11", time: "10:00 AM", duration: "3 hours", room: "Hall B-201", totalMarks: 100 },
  { id: "e5", subjectCode: "ME301", subjectName: "Thermodynamics II", department: "Mechanical", semester: 5, date: "2026-11-12", time: "10:00 AM", duration: "3 hours", room: "Hall C-301", totalMarks: 100 },
  { id: "e6", subjectCode: "CE301", subjectName: "Structural Analysis", department: "Civil", semester: 5, date: "2026-11-14", time: "10:00 AM", duration: "3 hours", room: "Hall D-101", totalMarks: 100 },
];

export const notifications: Notification[] = [
  { id: "n1", title: "Hall Tickets Released", message: "Semester V end-semester hall tickets are now available for download.", audience: "students", createdAt: "2026-10-28 09:00", read: false },
  { id: "n2", title: "Exam Schedule Published", message: "Final exam timetable for Nov 2026 has been published.", audience: "all", createdAt: "2026-10-25 11:00", read: true },
  { id: "n3", title: "Fee Payment Reminder", message: "Students with pending fees must clear dues before Nov 5 to be eligible.", audience: "students", createdAt: "2026-10-22 10:00", read: true },
  { id: "n4", title: "Marks Upload Deadline", message: "Please upload all internal and assignment marks by Oct 30.", audience: "teachers", createdAt: "2026-10-20 08:30", read: true },
];

// Derived helpers
export function getStudentEligibility(s: Student) {
  const checks = {
    attendance: s.attendance >= 75,
    internals:  (s.internalMarks / 40) * 100 >= 40,  // internal marks ≥ 40%
    backlogs:   s.backlogs === 0,
    fee:        s.feePaid,
    previous:   s.previousResult >= 5.0,
  };
  const passed = Object.values(checks).filter(Boolean).length;
  const total  = Object.keys(checks).length;
  const eligible = passed === total;
  const eligibilityPct = Math.round((passed / total) * 100);

  // Simple AI-like prediction score (0-100)
  const score = Math.min(100, Math.round(
    s.attendance * 0.35 +
    ((s.internalMarks / 40) * 100) * 0.25 +
    (s.previousResult / 10) * 100 * 0.2 +
    (s.backlogs === 0 ? 100 : Math.max(0, 100 - s.backlogs * 30)) * 0.2
  ));

  return { checks, passed, total, eligible, eligibilityPct, score };
}
