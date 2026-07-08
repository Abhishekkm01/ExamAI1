import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, ThemeProvider, NotifProvider, useAuth } from "./contexts/AppContext";
import LoginPage from "./pages/LoginPage";
import Layout from "./components/Layout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import { AdminStudents, AdminTeachers, AdminExams, AdminMarks, AdminEligibility, AdminHallTickets, AdminBacklogs, AdminFees, AdminNotifications, AdminAnalytics, AdminReports, AdminSettings } from "./pages/admin/AdminModules";
import { AdminProfileSettings } from "./pages/admin/AdminProfile";
import { TeacherDashboard, TeacherAttendance, TeacherMarks, TeacherStudents, TeacherFaceVerify } from "./pages/teacher/TeacherPages";
import { TeacherProfile } from "./pages/teacher/TeacherProfile";
import { StudentDashboard, StudentProfile, StudentEligibility, StudentHallTicket, StudentExams, StudentFaceVerify, StudentNotifications, StudentChatbot, StudentPayments } from "./pages/student/StudentPages";
import { QRVerify } from "./pages/shared/QRVerify";
import AdminSeating from "./pages/admin/AdminSeating";
import { FirstTimeSetup } from "./pages/Setup";
import StudentRegister from "./pages/StudentRegister";
import type { Role } from "./data/mockData";

function ProtectedRoute({ role, children }: { role: Role; children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== role) return <Navigate to={`/${user.role}`} replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  if (user) return <Navigate to={`/${user.role}`} replace />;
  return <>{children}</>;
}

// Used for /login. Renders the login page but auto-redirects to /setup
// if the user explicitly visited /setup or /first-time from anywhere.
function LoginOrRedirect() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  if (params.get("next") === "setup" || location.state?.setup) {
    return <Navigate to="/setup" replace />;
  }
  return <LoginPage />;
}

function Router() {
  return (
    <Routes>
      {/* /setup is the first-time admin creation page. Accessible even when logged in (lets a fresh setup happen if needed) */}
      <Route path="/setup" element={<FirstTimeSetup />} />
      <Route path="/first-time" element={<Navigate to="/setup" replace />} />
      <Route path="/register" element={<PublicRoute><StudentRegister /></PublicRoute>} />

      {/* Login page - redirects to dashboard if already logged in */}
      <Route path="/login" element={<PublicRoute><LoginOrRedirect /></PublicRoute>} />
      <Route path="/" element={<Navigate to="/login" replace />} />

      {/* Public QR verification - no auth */}
      <Route path="/verify" element={<QRVerify />} />

      {/* Admin routes */}
      <Route element={<ProtectedRoute role="admin"><Layout /></ProtectedRoute>}>
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/students" element={<AdminStudents />} />
        <Route path="/admin/teachers" element={<AdminTeachers />} />
        <Route path="/admin/exams" element={<AdminExams />} />
        <Route path="/admin/marks" element={<AdminMarks />} />
        <Route path="/admin/eligibility" element={<AdminEligibility />} />
        <Route path="/admin/seating" element={<AdminSeating />} />
        <Route path="/admin/halltickets" element={<AdminHallTickets />} />
        <Route path="/admin/backlogs" element={<AdminBacklogs />} />
        <Route path="/admin/fees" element={<AdminFees />} />
        <Route path="/admin/notifications" element={<AdminNotifications />} />
        <Route path="/admin/analytics" element={<AdminAnalytics />} />
        <Route path="/admin/reports" element={<AdminReports />} />
        <Route path="/admin/settings" element={<AdminSettings />} />
        <Route path="/admin/profile" element={<AdminProfileSettings />} />
      </Route>

      {/* Teacher routes */}
      <Route element={<ProtectedRoute role="teacher"><Layout /></ProtectedRoute>}>
        <Route path="/teacher" element={<TeacherDashboard />} />
        <Route path="/teacher/attendance" element={<TeacherAttendance />} />
        <Route path="/teacher/marks" element={<TeacherMarks />} />
        <Route path="/teacher/students" element={<TeacherStudents />} />
        <Route path="/teacher/face-verify" element={<TeacherFaceVerify />} />
        <Route path="/teacher/profile" element={<TeacherProfile />} />
      </Route>

      {/* Student routes */}
      <Route element={<ProtectedRoute role="student"><Layout /></ProtectedRoute>}>
        <Route path="/student" element={<StudentDashboard />} />
        <Route path="/student/payments" element={<StudentPayments />} />
        <Route path="/student/profile" element={<StudentProfile />} />
        <Route path="/student/eligibility" element={<StudentEligibility />} />
        <Route path="/student/hallticket" element={<StudentHallTicket />} />
        <Route path="/student/exams" element={<StudentExams />} />
        <Route path="/student/face-verify" element={<StudentFaceVerify />} />
        <Route path="/student/notifications" element={<StudentNotifications />} />
        <Route path="/student/chatbot" element={<StudentChatbot />} />
      </Route>

      {/* Catch-all: any unknown route goes to login */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <NotifProvider>
          <BrowserRouter>
            <Router />
          </BrowserRouter>
        </NotifProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
