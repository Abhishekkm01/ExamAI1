export type Role = "admin" | "hod" | "teacher" | "student";

export interface Hod {
  id: string;
  empId: string;
  name: string;
  email: string;
  department: string;
  photo: string;
}

export interface User {
  id: string;
  email: string;
  password?: string;
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
  gender?: string;
  dateOfBirth?: string;
  department: string;
  semester: number;
  section: string;
  photo: string;
  attendance: number;
  internalMarks: number;
  assignmentMarks: number;
  previousResult: number;
  backlogs: number;
  feePaid: boolean;
  feeAmount: number;
  examFeePaid?: boolean;
  collegeFeeAmount?: number;
  collegeFeePaid?: boolean;
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

export interface ExamSubject {
  subjectCode: string;
  subjectName: string;
  date?: string;
  time?: string;
  duration?: string;
  invigilatorId?: number | null;
  invigilatorName?: string | null;
}

export interface Exam {
  id: string;
  title?: string;
  subjectCode: string;
  subjectName: string;
  department: string;
  semester: number;
  date: string;
  time: string;
  duration: string;
  room: string;
  totalMarks: number;
  feeAmount?: number;
  requiresFaceVerification?: boolean;
  invigilatorId?: number | null;
  invigilatorName?: string | null;
  subjects?: ExamSubject[];
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  audience: "all" | "students" | "teachers" | "admin";
  createdAt: string;
  read: boolean;
  /** Present when notice was sent by an HOD (parsed from [DEPT] title prefix). */
  department?: string;
}
