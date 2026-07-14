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

export function examHeaderSubtitle(academicYear: string): string {
  return `End Semester Examination • Academic Year ${academicYear}`;
}

type HallTicketExam = {
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

function subjectLabel(s: HallTicketSubject) {
  const code = s.subject_code || s.subjectCode || "";
  const name = s.subject_name || s.subjectName || "";
  const date = s.exam_date || s.date || "";
  const time = s.exam_time || s.time || "";
  const duration = s.duration || "";
  return `${name} (${code}) — ${date} at ${time}${duration ? ` • ${duration}` : ""}`;
}

function subjectsHtml(subjects: HallTicketSubject[] | undefined, exam: HallTicketExam): string {
  const list = subjects?.length ? subjects : [{ subject_code: exam.subjectCode, subject_name: exam.subjectName, exam_date: exam.date, exam_time: exam.time, duration: exam.duration }];
  if (!list.length) return "";
  const header = list.length > 1
    ? `<div class="info-row"><span class="l">Subjects</span><span class="v">${list.length} papers</span></div>`
    : "";
  const rows = list.map((s, idx) => {
    const label = list.length > 1 ? `Subject ${idx + 1}` : "Subject";
    const seat = s.seat_number || s.seatNumber || "";
    const room = s.room || "";
    const detail = subjectLabel(s).replace(/</g, "&lt;");
    const seating = (seat || room)
      ? `<div class="info-row sub"><span class="l">Hall / Seat</span><span class="v">${room || "—"} • ${seat || "—"}</span></div>`
      : "";
    return `<div class="info-row"><span class="l">${label}</span><span class="v">${detail}</span></div>${seating}`;
  }).join("");
  return header + rows;
}

export const DEFAULT_HALL_TICKET_EXAM = {
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
  const subtitle = examHeaderSubtitle(academicYear);
  const logo = universityInitials(universityName);

  const html = `<!DOCTYPE html><html><head><title>Hall Ticket ${hallTicketNo}</title>
<style>
body{font-family:system-ui,-apple-system,sans-serif;padding:40px;background:#fff;color:#0f172a}
.card{border:3px solid #2563eb;border-radius:12px;overflow:hidden;max-width:800px;margin:0 auto}
.header{background:linear-gradient(135deg,#2563eb,#7c3aed,#db2777);color:#fff;padding:20px;display:flex;justify-content:space-between;align-items:center}
.header h1{font-size:22px;margin:0}
.header p{margin:4px 0 0;opacity:.9;font-size:13px}
.logo{width:60px;height:60px;border-radius:50%;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:bold}
.body{padding:30px}
.title{text-align:center;border-bottom:2px solid #e2e8f0;padding-bottom:12px;margin-bottom:20px}
.title small{text-transform:uppercase;letter-spacing:2px;color:#64748b}
.title h2{font-family:monospace;font-size:24px;color:#2563eb;margin:6px 0 0}
.grid{display:grid;grid-template-columns:2fr 1fr;gap:30px}
.info-row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:14px}
.info-row .l{color:#64748b}
.info-row .v{font-weight:600}
.info-row.bold .v{color:#2563eb;font-weight:700}
.photo{width:140px;height:140px;border-radius:8px;border:2px solid #c7d2fe;background:#f1f5f9}
.qr-box{margin-top:16px;padding:12px;border:2px solid #c7d2fe;border-radius:8px;background:#eff6ff;text-align:center}
.qr-box img{width:140px;height:140px}
.qr-box p{margin:6px 0 0;font-size:10px;color:#475569;font-weight:600}
.footer{margin-top:20px;padding-top:16px;border-top:2px solid #e2e8f0;display:flex;justify-content:space-between;font-size:12px;color:#475569}
@media print{@page{margin:15mm}body{padding:0}}
</style></head><body>
<div class="card">
  <div class="header">
    <div><h1>${universityName}</h1><p>${subtitle}</p></div>
    <div class="logo">${logo}</div>
  </div>
  <div class="body">
    <div class="title"><small>Official Hall Ticket</small><h2>${hallTicketNo}</h2></div>
    <div class="grid">
      <div>
        <div class="info-row"><span class="l">Candidate Name</span><span class="v">${student.name}</span></div>
        <div class="info-row"><span class="l">Roll Number</span><span class="v">${student.rollNo}</span></div>
        <div class="info-row"><span class="l">Department</span><span class="v">${student.department}</span></div>
        <div class="info-row"><span class="l">Semester</span><span class="v">Semester ${student.semester}</span></div>
        ${subjectsHtml(subjects, exam)}
        <div class="info-row bold"><span class="l">Exam Hall</span><span class="v">${exam.room}</span></div>
        <div class="info-row bold"><span class="l">Seat Number</span><span class="v">${seat}</span></div>
      </div>
      <div style="text-align:center">
        <img class="photo" src="${student.photo}" alt="photo"/>
        <div class="qr-box">${qrDataUrl ? `<img src="${qrDataUrl}" alt="QR"/>` : `<p style="font-size:11px;color:#64748b">Generate hall ticket to get official QR</p>`}<p>Scan to verify</p></div>
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
) {
  const subtitle = examHeaderSubtitle(academicYear);
  const subjectRows = (subjects?.length ? subjects : [{ subject_name: examName, subject_code: examCode, exam_date: date, exam_time: time, duration, room, seat_number: seat }])
    .map((s, idx) => {
      const subjSeat = s.seat_number || s.seatNumber || seat;
      const subjRoom = s.room || room;
      const label = (subjects?.length || 0) > 1 ? `Subject ${idx + 1}` : "Subject";
      return `<div class="r"><span class="l">${label}</span><span class="v">${subjectLabel({ ...s, seat_number: subjSeat, room: subjRoom }).replace(/</g, "&lt;")}</span></div>`
        + `<div class="r"><span class="l">Hall / Seat</span><span class="v">${subjRoom} • ${subjSeat}</span></div>`;
    })
    .join("");
  return `<!DOCTYPE html><html><head><title>Hall Ticket</title>
<style>body{font-family:sans-serif;padding:30px}.card{border:3px solid #2563eb;border-radius:12px;max-width:700px;margin:0 auto;overflow:hidden}.h{background:linear-gradient(135deg,#2563eb,#7c3aed);color:#fff;padding:20px}.b{padding:25px}.r{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f1f5f9;font-size:13px}.r .l{color:#64748b}.r .v{font-weight:600}</style></head><body>
<div class="card"><div class="h"><h2>${universityName}</h2><p>${subtitle}</p></div>
<div class="b">
<div class="r"><span class="l">Hall Ticket No</span><span class="v">${hallTicketNo}</span></div>
<div class="r"><span class="l">Student</span><span class="v">${studentName}</span></div>
<div class="r"><span class="l">Roll No</span><span class="v">${rollNo}</span></div>
<div class="r"><span class="l">Department</span><span class="v">${department}</span></div>
${subjectRows}
<div class="r"><span class="l">Exam Hall</span><span class="v">${room}</span></div>
<div class="r"><span class="l">Seat Number</span><span class="v">${seat}</span></div>
<p style="text-align:center;margin-top:20px;color:#475569">QR Code: ${qrContent}</p>
</div></div><script>window.onload=()=>setTimeout(()=>window.print(),400)</script></body></html>`;
}
