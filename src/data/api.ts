// Lightweight API client for the FastAPI backend.

const API_BASE = (import.meta as any).env?.VITE_API_URL || "http://localhost:8000";
export { API_BASE };

let backendOnline = false;
export const isBackendOnline = () => backendOnline;

function getToken(): string | null {
  try {
    return localStorage.getItem("examshield_token");
  } catch {
    return null;
  }
}

async function tryFetch(path: string, options: RequestInit = {}): Promise<any> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch (err) {
    backendOnline = false;
    throw new Error(`Network error: cannot reach ${API_BASE}`);
  }
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    let conflicts: unknown = null;
    try {
      const j = await res.json();
      detail = j.detail || detail;
      conflicts = j.conflicts ?? null;
    } catch {}
    const err = new Error(typeof detail === "string" ? detail : JSON.stringify(detail)) as Error & {
      conflicts?: unknown;
      status?: number;
    };
    err.conflicts = conflicts;
    err.status = res.status;
    if (res.status === 401) {
      throw new Error(`401: ${detail}`);
    }
    throw err;
  }
  backendOnline = true;
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  return res.text();
}

export const api = {
  // -------- Auth --------
  async login(email: string, password: string) {
    const body = new URLSearchParams();
    body.append("username", email);
    body.append("password", password);

    let res: Response;
    try {
      res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
    } catch (err: any) {
      backendOnline = false;
      throw new Error(`Network error: backend at ${API_BASE} is not reachable. Make sure start.bat is running.`);
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Login failed: ${res.status}`);
    }
    const data = await res.json();
    backendOnline = true;
    // Store the JWT token and the raw backend user object
    localStorage.setItem("examshield_token", data.access_token);
    localStorage.setItem("examshield_user", JSON.stringify(data.user));
    return data;
  },

  async logout() {
    localStorage.removeItem("examshield_token");
    localStorage.removeItem("examshield_user");
  },

  async ping() {
    try {
      const r = await fetch(`${API_BASE}/`);
      backendOnline = r.ok;
    } catch {
      backendOnline = false;
    }
    return backendOnline;
  },

  // -------- Public --------
  verifyHallTicket(code: string) {
    const trimmed = code.trim();
    if (trimmed.includes("|") || trimmed.startsWith("{")) {
      return tryFetch("/api/public/verify-hallticket/scan", {
        method: "POST",
        body: JSON.stringify({ code: trimmed }),
      });
    }
    return tryFetch(`/api/public/verify-hallticket/${encodeURIComponent(trimmed.toUpperCase())}`);
  },
  adminSeatingRooms: () => tryFetch("/api/admin/seating/rooms"),
  publicMeta: () => tryFetch("/api/public/meta"),

  // -------- Admin --------
  adminDashboard: () => tryFetch("/api/admin/dashboard"),
  adminStudents: (params: Record<string, any> = {}) => {
    const q = new URLSearchParams(params).toString();
    return tryFetch(`/api/admin/students?${q}`);
  },
  adminGetStudent: (id: number) => tryFetch(`/api/admin/students/${id}`),
  adminUpdateStudent: (id: number, data: Record<string, unknown>) =>
    tryFetch(`/api/admin/students/${id}/update`, { method: "PUT", body: JSON.stringify(data) }),
  adminDeleteStudent: (id: number) =>
    tryFetch(`/api/admin/students/${id}/delete`, { method: "DELETE" }),
  setupStudent: (data: Record<string, unknown>) =>
    tryFetch("/api/auth/setup-student", { method: "POST", body: JSON.stringify(data) }),
  setupTeacher: (data: Record<string, unknown>) =>
    tryFetch("/api/auth/setup-teacher", { method: "POST", body: JSON.stringify(data) }),
  setupHod: (data: Record<string, unknown>) =>
    tryFetch("/api/auth/setup-hod", { method: "POST", body: JSON.stringify(data) }),
  setupExam: (data: Record<string, unknown>) =>
    tryFetch("/api/auth/setup-exam", { method: "POST", body: JSON.stringify(data) }),
  adminTeachers: () => tryFetch("/api/admin/teachers"),
  adminGetTeacher: (id: number) => tryFetch(`/api/admin/teachers/${id}`),
  updateTeacher: (id: number, data: Record<string, unknown>) =>
    tryFetch(`/api/admin/teachers/${id}/update`, { method: "PUT", body: JSON.stringify(data) }),
  deleteTeacher: (id: number) =>
    tryFetch(`/api/admin/teachers/${id}/delete`, { method: "DELETE" }),
  adminHods: () => tryFetch("/api/admin/hods"),
  adminGetHod: (id: number) => tryFetch(`/api/admin/hods/${id}`),
  updateHod: (id: number, data: Record<string, unknown>) =>
    tryFetch(`/api/admin/hods/${id}/update`, { method: "PUT", body: JSON.stringify(data) }),
  deleteHod: (id: number) =>
    tryFetch(`/api/admin/hods/${id}/delete`, { method: "DELETE" }),
  adminExams: () => tryFetch("/api/admin/exams"),
  updateExam: (id: number, data: Record<string, unknown>) =>
    tryFetch(`/api/admin/exams/${id}/update`, { method: "PUT", body: JSON.stringify(data) }),
  deleteExam: (id: number) =>
    tryFetch(`/api/admin/exams/${id}/delete`, { method: "DELETE" }),
  adminBacklogs: () => tryFetch("/api/admin/backlogs"),
  adminFees: () => tryFetch("/api/admin/fees"),
  approveFeePayment: (paymentId: number, adminNote = "") =>
    tryFetch(`/api/admin/fees/payments/${paymentId}/approve`, {
      method: "PUT",
      body: JSON.stringify({ admin_note: adminNote }),
    }),
  rejectFeePayment: (paymentId: number, adminNote = "") =>
    tryFetch(`/api/admin/fees/payments/${paymentId}/reject`, {
      method: "PUT",
      body: JSON.stringify({ admin_note: adminNote }),
    }),
  adminAnalytics: () => tryFetch("/api/admin/analytics"),
  adminGetSettings: () => tryFetch("/api/admin/settings"),
  adminUpdateSettings: (data: Record<string, unknown>) =>
    tryFetch("/api/admin/settings/update", { method: "PUT", body: JSON.stringify(data) }),
  verifyAllEligibility: () => tryFetch("/api/admin/eligibility/verify-all", { method: "POST" }),
  generateAllHallTickets: () => tryFetch("/api/admin/halltickets/generate-all", { method: "POST" }),
  adminHallTickets: () => tryFetch("/api/admin/halltickets"),
  adminUpdateHallTicket: (id: number, data: Record<string, unknown>) =>
    tryFetch(`/api/admin/halltickets/${id}/update`, { method: "PUT", body: JSON.stringify(data) }),
  adminMarkFeePaid: (studentId: number) =>
    tryFetch(`/api/admin/fees/${studentId}/mark-paid`, { method: "PUT" }),
  sendNotification: (data: { title: string; message: string; audience: string }) =>
    tryFetch("/api/admin/notifications/create", { method: "POST", body: JSON.stringify(data) }),
  adminNotifications: () => tryFetch("/api/admin/notifications"),

  // -------- Teacher --------
  teacherProfile: () => tryFetch("/api/teacher/profile"),
  teacherDashboard: () => tryFetch("/api/teacher/dashboard"),
  teacherStudents: () => tryFetch("/api/teacher/students"),
  teacherMarks: (subject = "CS301") =>
    tryFetch(`/api/teacher/marks?subject_code=${subject}`),
  teacherAttendance: (subject = "CS301", date?: string) => {
    const q = new URLSearchParams({ subject_code: subject });
    if (date) q.set("date", date);
    return tryFetch(`/api/teacher/attendance?${q.toString()}`);
  },
  markAttendance: (data: any) =>
    tryFetch("/api/teacher/attendance/mark", { method: "POST", body: JSON.stringify(data) }),
  updateMarks: (data: any) =>
    tryFetch("/api/teacher/marks/update", { method: "POST", body: JSON.stringify(data) }),

  // -------- HOD --------
  hodDashboard: () => tryFetch("/api/hod/dashboard"),
  hodProfile: () => tryFetch("/api/hod/profile"),
  hodUpdateProfile: (data: Record<string, unknown>) =>
    tryFetch("/api/hod/profile/update", { method: "PUT", body: JSON.stringify(data) }),
  hodStudents: (params: Record<string, any> = {}) => {
    const q = new URLSearchParams(params).toString();
    return tryFetch(`/api/hod/students${q ? `?${q}` : ""}`);
  },
  hodGetStudent: (id: number) => tryFetch(`/api/hod/students/${id}`),
  hodUpdateStudent: (id: number, data: Record<string, unknown>) =>
    tryFetch(`/api/hod/students/${id}/update`, { method: "PUT", body: JSON.stringify(data) }),
  hodTeachers: () => tryFetch("/api/hod/teachers"),
  hodUpdateTeacherSubjects: (id: number, assigned_subjects: string) =>
    tryFetch(`/api/hod/teachers/${id}/subjects`, {
      method: "PUT",
      body: JSON.stringify({ assigned_subjects }),
    }),
  hodExams: () => tryFetch("/api/hod/exams"),
  hodMarks: () => tryFetch("/api/hod/marks"),
  hodEligibility: () => tryFetch("/api/hod/eligibility"),
  hodVerifyEligibility: () => tryFetch("/api/hod/eligibility/verify", { method: "POST" }),
  hodBacklogs: () => tryFetch("/api/hod/backlogs"),
  hodFees: () => tryFetch("/api/hod/fees"),
  hodAnalytics: () => tryFetch("/api/hod/analytics"),
  hodNotifications: () => tryFetch("/api/hod/notifications"),
  hodSendNotification: (data: { title: string; message: string; audience: string }) =>
    tryFetch("/api/hod/notifications/create", { method: "POST", body: JSON.stringify(data) }),

  // -------- Student --------
  studentDashboard: () => tryFetch("/api/student/dashboard"),
  studentProfile: () => tryFetch("/api/student/profile"),
  studentSubjectPerformance: () => tryFetch("/api/student/subject-performance"),
  studentEligibility: () => tryFetch("/api/student/eligibility"),
  studentExams: () => tryFetch("/api/student/exams"),
  studentNotifications: () => tryFetch("/api/student/notifications"),
  studentFees: () => tryFetch("/api/student/fees"),
  payStudentFee: (method: "online" | "bank_transfer" | "college", reference = "") =>
    tryFetch("/api/student/fees/pay", {
      method: "POST",
      body: JSON.stringify({ method, reference }),
    }),
  studentFaceEnroll: (imageBase64: string) =>
    tryFetch("/api/student/face-enroll", {
      method: "POST",
      body: JSON.stringify({ image_base64: imageBase64 }),
    }),
  studentFaceVerify: (imageBase64: string) =>
    tryFetch("/api/student/face-verify", {
      method: "POST",
      body: JSON.stringify({ image_base64: imageBase64 }),
    }),
  teacherFaceVerify: (imageBase64: string, examSubjectId: number) =>
    tryFetch("/api/teacher/face-verify", {
      method: "POST",
      body: JSON.stringify({ image_base64: imageBase64, exam_subject_id: examSubjectId }),
    }),
  teacherInvigilatorExams: () => tryFetch("/api/teacher/invigilator-exams"),
  teacherNotifications: () => tryFetch("/api/teacher/notifications"),
  askChatbot: (query: string) =>
    tryFetch("/api/student/chatbot", { method: "POST", body: JSON.stringify({ user_query: query }) }),
};

export async function downloadAdminReport(reportType: string, format: "pdf" | "excel"): Promise<void> {
  const token = getToken();
  if (!token) {
    throw new Error("Not logged in. Please sign in again as admin.");
  }

  let res: Response;
  try {
    res = await fetch(
      `${API_BASE}/api/admin/reports/export?report_type=${encodeURIComponent(reportType)}&export_format=${format}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
  } catch {
    backendOnline = false;
    throw new Error(`Cannot reach backend at ${API_BASE}. Run start.bat or: python manage.py runserver 0.0.0.0:8000`);
  }

  if (!res.ok) {
    let detail = `Failed to generate report (HTTP ${res.status})`;
    try {
      const j = await res.json();
      if (j?.detail) detail = j.detail;
    } catch {}
    throw new Error(detail);
  }

  backendOnline = true;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${reportType}.${format === "excel" ? "xlsx" : "pdf"}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function downloadHodReport(reportType: string, format: "pdf" | "excel"): Promise<void> {
  const token = getToken();
  if (!token) {
    throw new Error("Not logged in. Please sign in again as HOD.");
  }

  // Never use ?format= — DRF reserves it for content negotiation and returns 404.
  const qs = new URLSearchParams({
    report_type: reportType,
    export_format: format,
  });

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/hod/reports/export?${qs.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    backendOnline = false;
    throw new Error(`Cannot reach backend at ${API_BASE}. Run start.bat or: python manage.py runserver 0.0.0.0:8000`);
  }

  if (!res.ok) {
    let detail = `Failed to generate report (HTTP ${res.status})`;
    try {
      const j = await res.json();
      if (j?.detail) detail = j.detail;
    } catch {}
    throw new Error(detail);
  }

  backendOnline = true;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${reportType}.${format === "excel" ? "xlsx" : "pdf"}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
