import type { Student } from "../data/types";

export function universityInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

export function examHeaderSubtitle(academicYear: string, examTitle?: string): string {
  const title = (examTitle || "").trim() || "End Semester Examination";
  return `${title} • Academic Year ${academicYear}`;
}

type HallTicketExam = {
  title?: string;
  subjectCode: string;
  subjectName: string;
  date: string;
  time: string;
  duration: string;
  room: string;
};

type HallTicketSubject = {
  subject_code?: string;
  subjectCode?: string;
  subject_name?: string;
  subjectName?: string;
  exam_date?: string;
  date?: string;
  exam_time?: string;
  time?: string;
  duration?: string;
  seat_number?: string;
  seatNumber?: string;
  room?: string;
};

function esc(value: string) {
  return String(value || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function resolveSubjects(
  subjects: HallTicketSubject[] | undefined,
  exam: HallTicketExam,
  fallbackRoom: string,
  fallbackSeat: string,
): HallTicketSubject[] {
  const list = subjects?.length
    ? subjects
    : [{
        subject_code: exam.subjectCode,
        subject_name: exam.subjectName,
        exam_date: exam.date,
        exam_time: exam.time,
        duration: exam.duration,
        room: fallbackRoom,
        seat_number: fallbackSeat,
      }];
  return list.map((s) => ({
    ...s,
    room: s.room || fallbackRoom,
    seat_number: s.seat_number || s.seatNumber || fallbackSeat,
  }));
}

function subjectsBlockHtml(
  subjects: HallTicketSubject[],
  fallbackRoom: string,
  fallbackSeat: string,
): string {
  const cards = subjects.map((s, idx) => {
    const code = s.subject_code || s.subjectCode || "";
    const name = s.subject_name || s.subjectName || "";
    const date = s.exam_date || s.date || "";
    const time = s.exam_time || s.time || "";
    const duration = s.duration || "";
    const room = s.room || fallbackRoom || "—";
    const seat = s.seat_number || s.seatNumber || fallbackSeat || "—";
    const label = subjects.length > 1 ? `Subject ${idx + 1}` : "Subject";
    return `
      <div class="subj">
        <div class="subj-top">
          <span class="subj-label">${esc(label)}</span>
          <span class="subj-code">${esc(code)}</span>
        </div>
        <p class="subj-name">${esc(name)}</p>
        <div class="subj-meta">
          <span>${esc(date)}${date && time ? " · " : ""}${esc(time)}</span>
          ${duration ? `<span>${esc(duration)}</span>` : ""}
        </div>
        <div class="subj-seat">
          <span><strong>Hall</strong> ${esc(room)}</span>
          <span><strong>Seat</strong> ${esc(seat)}</span>
        </div>
      </div>`;
  }).join("");
  return `<div class="subj-list">${cards}</div>`;
}

const SHARED_STYLES = `
body{font-family:system-ui,-apple-system,Segoe UI,sans-serif;padding:32px;background:#f8fafc;color:#0f172a;margin:0}
.card{border:2px solid #2563eb;border-radius:14px;overflow:hidden;max-width:820px;margin:0 auto;background:#fff;box-shadow:0 10px 30px rgba(15,23,42,.08)}
.header{background:linear-gradient(135deg,#2563eb,#7c3aed,#db2777);color:#fff;padding:22px 24px;display:flex;justify-content:space-between;align-items:center;gap:16px}
.header h1{font-size:22px;margin:0;line-height:1.2}
.header p{margin:6px 0 0;opacity:.92;font-size:13px;line-height:1.4}
.logo{width:56px;height:56px;border-radius:50%;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;flex-shrink:0}
.body{padding:28px}
.title{text-align:center;border-bottom:1px solid #e2e8f0;padding-bottom:16px;margin-bottom:20px}
.title small{display:block;text-transform:uppercase;letter-spacing:2px;color:#64748b;font-size:11px;font-weight:600}
.title h2{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:24px;color:#2563eb;margin:8px 0 0}
.exam-title{margin:10px 0 0;font-size:15px;font-weight:700;color:#1e293b}
.grid{display:grid;grid-template-columns:minmax(0,1.7fr) 180px;gap:28px;align-items:start}
.info{display:grid;grid-template-columns:140px 1fr;gap:8px 16px;margin-bottom:18px}
.info .l{color:#64748b;font-size:13px;padding:6px 0}
.info .v{font-weight:600;font-size:14px;padding:6px 0;word-break:break-word}
.info .v.em{color:#1d4ed8;font-weight:700}
.section-label{font-size:11px;text-transform:uppercase;letter-spacing:1.2px;color:#64748b;font-weight:700;margin:4px 0 10px}
.subj-list{display:flex;flex-direction:column;gap:10px}
.subj{border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px;background:#f8fafc}
.subj-top{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:4px}
.subj-label{font-size:11px;text-transform:uppercase;letter-spacing:.8px;color:#64748b;font-weight:700}
.subj-code{font-size:12px;font-weight:700;color:#4f46e5;background:#eef2ff;padding:2px 8px;border-radius:999px}
.subj-name{margin:0;font-size:14px;font-weight:700;color:#0f172a}
.subj-meta{display:flex;flex-wrap:wrap;gap:8px 14px;margin-top:6px;font-size:12px;color:#64748b}
.subj-seat{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px;padding-top:10px;border-top:1px dashed #cbd5e1;font-size:13px;color:#1e293b}
.subj-seat strong{color:#64748b;font-weight:600;margin-right:6px}
.side{text-align:center}
.photo{width:140px;height:140px;object-fit:cover;border-radius:10px;border:2px solid #c7d2fe;background:#f1f5f9}
.qr-box{margin-top:14px;padding:12px;border:1px solid #c7d2fe;border-radius:10px;background:#eff6ff}
.qr-box img{width:120px;height:120px}
.qr-box p{margin:8px 0 0;font-size:10px;color:#475569;font-weight:600}
.footer{margin-top:22px;padding-top:14px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;gap:12px;font-size:12px;color:#475569}
@media print{@page{margin:12mm}body{padding:0;background:#fff}.card{box-shadow:none}}
@media (max-width:700px){.grid{grid-template-columns:1fr}.info{grid-template-columns:1fr}.subj-seat{grid-template-columns:1fr}}
`;

export const DEFAULT_HALL_TICKET_EXAM = {
  title: "End Semester Examination",
  subjectCode: "CS301",
  subjectName: "Data Structures & Algorithms",
  date: "2026-11-10",
  time: "10:00 AM",
  duration: "3 hours",
  room: "Hall A-101",
};

export function downloadHallTicket(
  student: Student,
  hallTicketNo: string,
  universityName: string,
  academicYear: string,
  room = DEFAULT_HALL_TICKET_EXAM.room,
  seatNumber?: string,
  qrContent?: string,
  subjects?: HallTicketSubject[],
  examOverride?: Partial<HallTicketExam>,
) {
  const exam = { ...DEFAULT_HALL_TICKET_EXAM, room, ...examOverride };
  const seat = seatNumber || `S${100 + parseInt(student.id.replace(/\D/g, ""), 10)}`;
  openHallTicketPrintWindow(student, hallTicketNo, universityName, academicYear, exam, seat, qrContent, subjects);
}

export function openHallTicketPrintWindow(
  student: Student,
  hallTicketNo: string,
  universityName: string,
  academicYear: string,
  exam: HallTicketExam,
  seat: string,
  qrContent?: string,
  subjects?: HallTicketSubject[],
) {
  const qrValue = qrContent?.trim();
  const qrDataUrl = qrValue
    ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrValue)}`
    : "";
  const examTitle = (exam.title || exam.subjectName || "Examination").trim();
  const subtitle = examHeaderSubtitle(academicYear, examTitle);
  const logo = universityInitials(universityName);
  const resolved = resolveSubjects(subjects, exam, exam.room, seat);

  const html = `<!DOCTYPE html><html><head><title>Hall Ticket ${esc(hallTicketNo)}</title>
<style>${SHARED_STYLES}</style></head><body>
<div class="card">
  <div class="header">
    <div>
      <h1>${esc(universityName)}</h1>
      <p>${esc(subtitle)}</p>
    </div>
    <div class="logo">${esc(logo)}</div>
  </div>
  <div class="body">
    <div class="title">
      <small>Official Hall Ticket</small>
      <h2>${esc(hallTicketNo)}</h2>
      <p class="exam-title">${esc(examTitle)}</p>
    </div>
    <div class="grid">
      <div>
        <div class="info">
          <span class="l">Examination</span><span class="v em">${esc(examTitle)}</span>
          <span class="l">Candidate Name</span><span class="v">${esc(student.name)}</span>
          <span class="l">Roll Number</span><span class="v">${esc(student.rollNo)}</span>
          <span class="l">Department</span><span class="v">${esc(student.department)}</span>
          <span class="l">Semester</span><span class="v">Semester ${esc(String(student.semester))}</span>
        </div>
        <p class="section-label">Examination Subjects</p>
        ${subjectsBlockHtml(resolved, exam.room, seat)}
      </div>
      <div class="side">
        <img class="photo" src="${esc(student.photo)}" alt="photo"/>
        <div class="qr-box">${qrDataUrl
          ? `<img src="${qrDataUrl}" alt="QR"/><p>Scan to verify</p>`
          : `<p style="font-size:11px;color:#64748b;margin:0">Generate hall ticket to get official QR</p>`}</div>
      </div>
    </div>
    <div class="footer">
      <span>Issued: ${new Date().toLocaleDateString()}</span>
      <span>Controller of Examinations (Digitally Signed)</span>
    </div>
  </div>
</div>
<script>window.onload=()=>setTimeout(()=>window.print(),400)</script>
</body></html>`;

  const w = window.open("", "_blank");
  if (w) {
    w.document.write(html);
    w.document.close();
  }
}

export function buildSimpleHallTicketHtml(
  universityName: string,
  academicYear: string,
  hallTicketNo: string,
  studentName: string,
  rollNo: string,
  department: string,
  examName: string,
  examCode: string,
  date: string,
  time: string,
  duration: string,
  room: string,
  seat: string,
  qrContent: string,
  subjects?: HallTicketSubject[],
  examTitle?: string,
  semester?: number | string,
  photo?: string,
) {
  const title = (examTitle || examName || "").trim() || "Examination";
  const exam: HallTicketExam = {
    title,
    subjectCode: examCode,
    subjectName: examName,
    date,
    time,
    duration,
    room,
  };
  const qrValue = qrContent?.trim();
  const qrDataUrl = qrValue
    ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrValue)}`
    : "";
  const subtitle = examHeaderSubtitle(academicYear, title);
  const logo = universityInitials(universityName);
  const resolved = resolveSubjects(subjects, exam, room, seat);

  return `<!DOCTYPE html><html><head><title>Hall Ticket ${esc(hallTicketNo)}</title>
<style>${SHARED_STYLES}</style></head><body>
<div class="card">
  <div class="header">
    <div>
      <h1>${esc(universityName)}</h1>
      <p>${esc(subtitle)}</p>
    </div>
    <div class="logo">${esc(logo)}</div>
  </div>
  <div class="body">
    <div class="title">
      <small>Official Hall Ticket</small>
      <h2>${esc(hallTicketNo)}</h2>
      <p class="exam-title">${esc(title)}</p>
    </div>
    <div class="grid">
      <div>
        <div class="info">
          <span class="l">Examination</span><span class="v em">${esc(title)}</span>
          <span class="l">Candidate Name</span><span class="v">${esc(studentName)}</span>
          <span class="l">Roll Number</span><span class="v">${esc(rollNo)}</span>
          <span class="l">Department</span><span class="v">${esc(department)}</span>
          ${semester ? `<span class="l">Semester</span><span class="v">Semester ${esc(String(semester))}</span>` : ""}
        </div>
        <p class="section-label">Examination Subjects</p>
        ${subjectsBlockHtml(resolved, room, seat)}
      </div>
      <div class="side">
        ${photo ? `<img class="photo" src="${esc(photo)}" alt="photo"/>` : ""}
        <div class="qr-box">${qrDataUrl
          ? `<img src="${qrDataUrl}" alt="QR"/><p>Scan to verify</p>`
          : `<p style="font-size:11px;color:#64748b;margin:0">${esc(qrContent || "QR pending")}</p>`}</div>
      </div>
    </div>
    <div class="footer">
      <span>Issued: ${new Date().toLocaleDateString()}</span>
      <span>Controller of Examinations (Digitally Signed)</span>
    </div>
  </div>
</div>
<script>window.onload=()=>setTimeout(()=>window.print(),400)</script>
</body></html>`;
}
