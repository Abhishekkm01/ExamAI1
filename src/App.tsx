import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, ThemeProvider, NotifProvider, useAuth } from "./contexts/AppContext";
import LoginPage from "./pages/LoginPage";
import Layout from "./components/Layout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import { AdminStudents, AdminTeachers, AdminHods, AdminExams, AdminMarks, AdminEligibility, AdminHallTickets, AdminBacklogs, AdminFees, AdminNotifications, AdminAnalytics, AdminReports, AdminSettings } from "./pages/admin/AdminModules";
import { AdminProfileSettings } from "./pages/admin/AdminProfile";
import { TeacherDashboard, TeacherAttendance, TeacherMarks, TeacherStudents, TeacherFaceVerify } from "./pages/teacher/TeacherPages";
import { TeacherProfile } from "./pages/teacher/TeacherProfile";
import {
  HodDashboard, HodStudents, HodTeachers, HodExams, HodMarks, HodEligibility,
  HodBacklogs, HodFees, HodNotifications, HodAnalytics, HodReports,
} from "./pages/hod/HodPages";
import { HodProfile } from "./pages/hod/HodProfile";
import { StudentDashboard, StudentProfile, StudentEligibility, StudentHallTicket, StudentExams, StudentFaceVerify, StudentNotifications, StudentChatbot, StudentPayments } from "./pages/student/StudentPages";
import { QRVerify } from "./pages/shared/QRVerify";
import AdminSeating from "./pages/admin/AdminSeating";
import { FirstTimeSetup } from "./pages/Setup";
import StudentRegister from "./pages/StudentRegister";
import type { Role } from "./data/types";

function ProtectedRoute({ role, children }: { role: Role; children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== role) return <Navigate to={`/${user.role}`} replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user) return <Navigate to={`/${user.role}`} replace />;
  return <>{children}</>;
}

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
      <Route path="/setup" element={<FirstTimeSetup />} />
      <Route path="/first-time" element={<Navigate to="/setup" replace />} />
      <Route path="/register" element={<PublicRoute><StudentRegister /></PublicRoute>} />

      <Route path="/login" element={<PublicRoute><LoginOrRedirect /></PublicRoute>} />
      <Route path="/" element={<Navigate to="/login" replace />} />

      <Route path="/verify" element={<QRVerify />} />

      <Route element={<ProtectedRoute role="admin"><Layout /></ProtectedRoute>}>
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/students" element={<AdminStudents />} />
        <Route path="/admin/teachers" element={<AdminTeachers />} />
        <Route path="/admin/hods" element={<AdminHods />} />
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

      <Route element={<ProtectedRoute role="hod"><Layout /></ProtectedRoute>}>
        <Route path="/hod" element={<HodDashboard />} />
        <Route path="/hod/students" element={<HodStudents />} />
        <Route path="/hod/teachers" element={<HodTeachers />} />
        <Route path="/hod/exams" element={<HodExams />} />
        <Route path="/hod/marks" element={<HodMarks />} />
        <Route path="/hod/eligibility" element={<HodEligibility />} />
        <Route path="/hod/backlogs" element={<HodBacklogs />} />
        <Route path="/hod/fees" element={<HodFees />} />
        <Route path="/hod/notifications" element={<HodNotifications />} />
        <Route path="/hod/analytics" element={<HodAnalytics />} />
        <Route path="/hod/reports" element={<HodReports />} />
        <Route path="/hod/profile" element={<HodProfile />} />
      </Route>

      <Route element={<ProtectedRoute role="teacher"><Layout /></ProtectedRoute>}>
        <Route path="/teacher" element={<TeacherDashboard />} />
        <Route path="/teacher/attendance" element={<TeacherAttendance />} />
        <Route path="/teacher/marks" element={<TeacherMarks />} />
        <Route path="/teacher/students" element={<TeacherStudents />} />
        <Route path="/teacher/face-verify" element={<TeacherFaceVerify />} />
        <Route path="/teacher/profile" element={<TeacherProfile />} />
      </Route>

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
