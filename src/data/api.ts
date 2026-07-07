// Lightweight API client for the FastAPI backend.

const API_BASE = (import.meta as any).env?.VITE_API_URL || "http://localhost:8000";

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
    if (res.status === 401) {
      let detail = "Unauthorized";
      try {
        const j = await res.json();
        detail = j.detail || detail;
      } catch {}
      throw new Error(`401: ${detail}`);
    }
    throw new Error(`HTTP ${res.status}`);
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
  verifyHallTicket(htNo: string) {
    return tryFetch(`/api/public/verify-hallticket/${encodeURIComponent(htNo)}`);
  },

  // -------- Admin --------
  adminDashboard: () => tryFetch("/api/admin/dashboard"),
  adminStudents: (params: Record<string, any> = {}) => {
    const q = new URLSearchParams(params).toString();
    return tryFetch(`/api/admin/students?${q}`);
  },
  adminTeachers: () => tryFetch("/api/admin/teachers"),
  adminExams: () => tryFetch("/api/admin/exams"),
  adminBacklogs: () => tryFetch("/api/admin/backlogs"),
  adminFees: () => tryFetch("/api/admin/fees"),
  adminAnalytics: () => tryFetch("/api/admin/analytics"),
  verifyAllEligibility: () => tryFetch("/api/admin/eligibility/verify-all", { method: "POST" }),
  generateAllHallTickets: () => tryFetch("/api/admin/halltickets/generate-all", { method: "POST" }),
  sendNotification: (data: { title: string; message: string; audience: string }) =>
    tryFetch("/api/admin/notifications", { method: "POST", body: JSON.stringify(data) }),

  // -------- Teacher --------
  teacherDashboard: () => tryFetch("/api/teacher/dashboard"),
  teacherStudents: () => tryFetch("/api/teacher/students"),
  teacherMarks: (subject = "CS301") =>
    tryFetch(`/api/teacher/marks?subject_code=${subject}`),
  teacherAttendance: (subject = "CS301") =>
    tryFetch(`/api/teacher/attendance?subject_code=${subject}`),
  markAttendance: (data: any) =>
    tryFetch("/api/teacher/attendance/mark", { method: "POST", body: JSON.stringify(data) }),
  updateMarks: (data: any) =>
    tryFetch("/api/teacher/marks/update", { method: "POST", body: JSON.stringify(data) }),

  // -------- Student --------
  studentDashboard: () => tryFetch("/api/student/dashboard"),
  studentProfile: () => tryFetch("/api/student/profile"),
  studentEligibility: () => tryFetch("/api/student/eligibility"),
  studentExams: () => tryFetch("/api/student/exams"),
  studentNotifications: () => tryFetch("/api/student/notifications"),
  askChatbot: (query: string) =>
    tryFetch("/api/student/chatbot", { method: "POST", body: JSON.stringify({ user_query: query }) }),
};
