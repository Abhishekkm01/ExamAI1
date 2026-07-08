import { Card, StatCard, PageHeader, Badge, Button } from "../../components/Layout";
import { useEffect, useState } from "react";
import { fetchStudents, fetchAdminExams, fetchTeachers, getStudentEligibility, fetchAttendanceTrends } from "../../data/apiData";
import type { Student, Exam, Teacher } from "../../data/types";
import { GraduationCap, TicketCheck, Users, Calendar, BrainCircuit, Database } from "lucide-react";
import { useSystemSettings } from "../../hooks/useSystemSettings";
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend, RadialBarChart, RadialBar
} from "recharts";
import { useNavigate } from "react-router-dom";
import { AdminNotSetup } from "../Setup";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [students, setStudents] = useState<Student[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [trendData, setTrendData] = useState<{ day: string; attendance: number; absent: number; total: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { settings: systemSettings } = useSystemSettings();

  const loadData = () => {
    setLoading(true); setError(null);
    Promise.all([fetchStudents(), fetchAdminExams(), fetchTeachers(), fetchAttendanceTrends()])
      .then(([s, e, t, trends]) => { setStudents(s); setExams(e); setTeachers(t); setTrendData(trends); setLoading(false); })
      .catch((err) => { setError(err?.message || "Failed to load data"); setLoading(false); });
  };
  useEffect(() => { loadData(); }, []);

  if (loading) return <div className="p-10 text-center text-slate-500">Loading dashboard…</div>;
  if (error) {
    const token = localStorage.getItem("examshield_token");
    const userRaw = localStorage.getItem("examshield_user");
    return (
      <Card className="p-8 max-w-2xl mx-auto">
        <Database className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h3 className="text-xl font-bold text-rose-600 mb-2 text-center">Could not load dashboard data</h3>
        <p className="text-slate-500 mb-4 text-center">{error}</p>

        <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-4 text-xs font-mono space-y-1">
          <p><b>Token in localStorage:</b> {token ? `✓ present (${token.length} chars)` : "✗ MISSING"}</p>
          <p><b>User in localStorage:</b> {userRaw ? "✓ present" : "✗ MISSING"}</p>
          <p className="text-slate-500 mt-2">If token is missing, log out and log in again.</p>
        </div>

        <div className="mt-4 flex gap-2 justify-center">
          <Button onClick={loadData}>Retry</Button>
          <Button variant="secondary" onClick={() => { localStorage.clear(); window.location.href = "/login"; }}>Log out & re-login</Button>
        </div>
      </Card>
    );
  }

  if (students.length === 0 && teachers.length === 0) return <AdminNotSetup />;

  const totalStudents = students.length;
  const eligible = students.filter((s) => getStudentEligibility(s).eligible).length;
  const avgAttendance = totalStudents ? Math.round(students.reduce((a, s) => a + s.attendance, 0) / totalStudents) : 0;
  const upcomingExams = exams.length;
  const hallTicketsGenerated = eligible;

  const deptData = Object.entries(
    students.reduce<Record<string, number>>((acc, s) => { acc[s.department] = (acc[s.department] || 0) + 1; return acc; }, {})
  ).map(([name, value]) => ({ name, value }));
  const COLORS = ["#2563eb", "#7c3aed", "#db2777", "#059669", "#f59e0b"];
  const hasTrendData = trendData.some((d) => d.total > 0);
  const elgData = [
    { name: "Eligible", value: eligible, fill: "#10b981" },
    { name: "Not Eligible", value: Math.max(0, totalStudents - eligible), fill: "#ef4444" },
  ];
  const recentStudents = students.slice(0, 5);

  return (
    <div>
      <PageHeader
        title="Admin Dashboard"
        subtitle={`Overview of your university's examination ecosystem (Live MySQL data)`}
        actions={<div className="flex items-center gap-2"><Badge variant="indigo">Academic Year {systemSettings.academic_year}</Badge><Badge variant="green">Semester {systemSettings.current_semester}</Badge></div>}
      />

      <div className="relative mb-6 rounded-2xl overflow-hidden bg-brand-gradient p-6 lg:p-8 text-white shadow-xl shadow-indigo-500/20">
        <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex flex-col lg:flex-row lg:items-center gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-2 text-white/80 text-sm font-medium mb-2">
              <BrainCircuit className="w-4 h-4" /> AI Insights
            </div>
            <h3 className="text-2xl lg:text-3xl font-bold">
              {eligible} of {totalStudents} students are exam-eligible
            </h3>
            <p className="mt-2 text-white/80 max-w-2xl">
              ExamShield AI predicts eligibility based on attendance, internals, backlogs, fee status, and previous results.
            </p>
            <button onClick={() => navigate("/admin/eligibility")}
              className="mt-4 px-4 py-2 rounded-lg bg-white/20 backdrop-blur hover:bg-white/30 text-white font-medium text-sm transition">
              Review Eligibility →
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:w-96">
            <MetricBox label="Avg Attendance" value={`${avgAttendance}%`} />
            <MetricBox label="Hall Tickets" value={hallTicketsGenerated} />
            <MetricBox label="Total Teachers" value={teachers.length} />
            <MetricBox label="Upcoming Exams" value={upcomingExams} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Students" value={totalStudents} delta="From MySQL" trend="up" icon={GraduationCap} color="indigo" />
        <StatCard label="Eligible Students" value={eligible} delta={`${totalStudents ? Math.round((eligible/totalStudents)*100) : 0}% pass rate`} trend="up" icon={TicketCheck} color="emerald" />
        <StatCard label="Active Teachers" value={teachers.length} delta="Live from MySQL" trend="up" icon={Users} color="violet" />
        <StatCard label="Upcoming Exams" value={upcomingExams} delta="Next: see schedule" trend="up" icon={Calendar} color="amber" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white">Attendance Trends</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Last 7 days • Present vs Absent % {hasTrendData ? "from MySQL attendance records" : "— no marks yet"}
              </p>
            </div>
            <Badge variant="sky">Live</Badge>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,.3)" />
                <XAxis dataKey="day" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} domain={[0, 100]} />
                <Tooltip contentStyle={{ background: "rgba(15,23,42,.9)", border: "none", borderRadius: 8, color: "#fff" }} />
                <Legend />
                <Line type="monotone" dataKey="attendance" name="Present %" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="absent" name="Absent %" stroke="#ef4444" strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold text-slate-900 dark:text-white">Eligibility</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Current status distribution</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={elgData} innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value">
                  {elgData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "rgba(15,23,42,.9)", border: "none", borderRadius: 8, color: "#fff" }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card className="p-5">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-1">Department Distribution</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Students across departments</p>
          {deptData.length > 0 ? (
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
          ) : <p className="text-sm text-slate-500 text-center py-12">No students yet</p>}
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-1">Overall Performance</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Key health metrics</p>
          {totalStudents > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart innerRadius="30%" outerRadius="100%" data={[
                  { name: "Attendance", value: avgAttendance, fill: "#2563eb" },
                  { name: "Eligibility", value: totalStudents ? Math.round((eligible/totalStudents)*100) : 0, fill: "#10b981" },
                  { name: "Fee Paid", value: totalStudents ? Math.round((students.filter(s=>s.feePaid).length/totalStudents)*100) : 0, fill: "#7c3aed" },
                ]} startAngle={90} endAngle={-270}>
                  <RadialBar background dataKey="value" cornerRadius={10} />
                  <Legend iconSize={10} verticalAlign="bottom" />
                  <Tooltip contentStyle={{ background: "rgba(15,23,42,.9)", border: "none", borderRadius: 8, color: "#fff" }} />
                </RadialBarChart>
              </ResponsiveContainer>
            </div>
          ) : <p className="text-sm text-slate-500 text-center py-12">No data yet</p>}
        </Card>
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-900 dark:text-white">Recent Students (from MySQL)</h3>
          <button onClick={() => navigate("/admin/students")} className="text-sm text-indigo-600 hover:underline">View all</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <th className="pb-3 font-medium">Student</th>
                <th className="pb-3 font-medium">Department</th>
                <th className="pb-3 font-medium">Attendance</th>
                <th className="pb-3 font-medium">Internals</th>
                <th className="pb-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {recentStudents.map((s) => {
                const elg = getStudentEligibility(s);
                return (
                  <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-3">
                      <div className="flex items-center gap-3">
                        <img src={s.photo} alt="" className="w-8 h-8 rounded-full bg-slate-200" />
                        <div>
                          <p className="font-medium text-slate-800 dark:text-white">{s.name}</p>
                          <p className="text-xs text-slate-500">{s.rollNo}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 text-slate-600 dark:text-slate-300">{s.department}</td>
                    <td className="py-3">{s.attendance}%</td>
                    <td className="py-3">{s.internalMarks}/40</td>
                    <td className="py-3">
                      {elg.eligible ? <Badge variant="green">Eligible</Badge> : <Badge variant="red">Not Eligible</Badge>}
                    </td>
                  </tr>
                );
              })}
              {recentStudents.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-slate-500">No students in the database</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function MetricBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-white/15 backdrop-blur px-4 py-3">
      <p className="text-xs text-white/70">{label}</p>
      <p className="text-xl font-bold mt-0.5">{value}</p>
    </div>
  );
}
