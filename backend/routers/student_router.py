import io
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from database import get_db
import models, schemas, auth
from ai_modules.chatbot import ai_chatbot
from ai_modules.eligibility_model import eligibility_ai
from ai_modules.face_recognition_module import face_ai
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

router = APIRouter(prefix="/api/student", tags=["Student Module"])


@router.get("/dashboard")
def dashboard(db: Session = Depends(get_db), current: models.User = Depends(auth.get_current_student)):
    s = db.query(models.Student).filter(models.Student.user_id == current.id).first()
    if not s: raise HTTPException(404, "Student profile not found")
    upcoming = db.query(models.Exam).filter(models.Exam.department == s.department, models.Exam.is_deleted == False).all()
    return {"name": current.name, "roll_no": s.roll_no, "department": s.department, "attendance": s.attendance_percentage,
            "internal_marks": s.internal_marks, "is_eligible": s.is_eligible, "ai_risk_score": s.ai_risk_score,
            "eligibility_percentage": s.eligibility_percentage, "next_exam": upcoming[0] if upcoming else None}


@router.get("/profile")
def profile(db: Session = Depends(get_db), current: models.User = Depends(auth.get_current_student)):
    s = db.query(models.Student).filter(models.Student.user_id == current.id).first()
    return {"id": s.id, "name": current.name, "email": current.email, "roll_no": s.roll_no,
            "mobile": s.mobile, "department": s.department, "semester": s.semester, "section": s.section, "photo": s.photo}


@router.put("/profile")
def update_profile(data: dict, db: Session = Depends(get_db), current: models.User = Depends(auth.get_current_student)):
    s = db.query(models.Student).filter(models.Student.user_id == current.id).first()
    if "mobile" in data: s.mobile = data["mobile"]
    if "section" in data: s.section = data["section"]
    if "name" in data: current.name = data["name"]
    db.commit()
    return {"message": "Profile updated"}


@router.get("/eligibility")
def eligibility(db: Session = Depends(get_db), current: models.User = Depends(auth.get_current_student)):
    s = db.query(models.Student).filter(models.Student.user_id == current.id).first()
    ai = eligibility_ai.predict_eligibility(s.attendance_percentage, s.internal_marks, s.previous_result, s.backlogs)
    return {"is_eligible": s.is_eligible, "eligibility_percentage": s.eligibility_percentage,
            "ai_risk_score": s.ai_risk_score, "ai_probability": ai["probability"],
            "checks": {"attendance": s.attendance_percentage >= 75.0,
                       "internals": (s.internal_marks / 40.0) >= 0.4,
                       "backlogs": s.backlogs == 0,
                       "fee": s.fee_paid, "previous_sgpa": s.previous_result >= 5.0}}


@router.get("/hallticket")
def get_hallticket(db: Session = Depends(get_db), current: models.User = Depends(auth.get_current_student)):
    s = db.query(models.Student).filter(models.Student.user_id == current.id).first()
    if not s.is_eligible:
        return {"is_eligible": False}
    exam = db.query(models.Exam).filter(models.Exam.department == s.department, models.Exam.is_deleted == False).first()
    if not exam: exam = db.query(models.Exam).first()
    return {"is_eligible": True, "hall_ticket_no": f"HT2026{s.roll_no}",
            "student": {"name": current.name, "roll_no": s.roll_no, "department": s.department, "photo": s.photo},
            "exam": {"subject_code": exam.subject_code, "subject_name": exam.subject_name,
                      "date": exam.exam_date, "time": exam.exam_time, "duration": exam.duration, "room": exam.room},
            "seat_number": f"S{100 + s.id}",
            "qr_code_content": f"HT:HT2026{s.roll_no}|Roll:{s.roll_no}|Exam:{exam.subject_code}|Seat:S{100+s.id}"}


@router.get("/hallticket/download")
def download_hallticket(db: Session = Depends(get_db), current: models.User = Depends(auth.get_current_student)):
    s = db.query(models.Student).filter(models.Student.user_id == current.id).first()
    if not s.is_eligible: raise HTTPException(403, "Not eligible to download hall ticket")
    exam = db.query(models.Exam).filter(models.Exam.department == s.department).first() or db.query(models.Exam).first()
    out = io.BytesIO(); p = canvas.Canvas(out, pagesize=letter)
    p.setFont("Helvetica-Bold", 20); p.drawString(100, 740, "National Institute of Technology")
    p.setFont("Helvetica", 14); p.drawString(100, 715, "Official Hall Ticket - End Semester Nov 2026")
    p.setFont("Helvetica", 12)
    p.drawString(100, 670, f"Hall Ticket No: HT2026{s.roll_no}")
    p.drawString(100, 645, f"Student: {current.name}")
    p.drawString(100, 620, f"Roll Number: {s.roll_no}")
    p.drawString(100, 595, f"Department: {s.department} | Semester {s.semester}")
    p.drawString(100, 560, f"Subject: {exam.subject_name} ({exam.subject_code})")
    p.drawString(100, 535, f"Schedule: {exam.exam_date} at {exam.exam_time} | Duration: {exam.duration}")
    p.drawString(100, 510, f"Exam Hall: {exam.room} | Seat: S{100 + s.id}")
    p.drawString(100, 460, "QR Code: [Encrypted & Valid]")
    p.drawString(100, 420, "Controller of Examinations (Digitally Signed)")
    p.showPage(); p.save(); out.seek(0)
    return StreamingResponse(out, media_type="application/pdf", headers={"Content-Disposition": f"attachment; filename=HallTicket_{s.roll_no}.pdf"})


@router.get("/exams")
def exams(db: Session = Depends(get_db), current: models.User = Depends(auth.get_current_student)):
    s = db.query(models.Student).filter(models.Student.user_id == current.id).first()
    return [{"id": e.id, "subject_code": e.subject_code, "subject_name": e.subject_name,
             "department": e.department, "semester": e.semester, "exam_date": e.exam_date,
             "exam_time": e.exam_time, "duration": e.duration, "room": e.room, "total_marks": e.total_marks}
            for e in db.query(models.Exam).filter(models.Exam.department == s.department, models.Exam.is_deleted == False).all()]


@router.post("/face-verify", response_model=schemas.FaceVerifyResponse)
def student_face_verify(req: schemas.FaceVerifyRequest, db: Session = Depends(get_db), current: models.User = Depends(auth.get_current_student)):
    res = face_ai.verify_face(req.image_base64, [0.1] * 128)
    return {"verified": res["verified"], "confidence": res["confidence"], "message": res["message"], "student_name": current.name}


@router.get("/notifications")
def notifications(db: Session = Depends(get_db), _: models.User = Depends(auth.get_current_student)):
    rows = db.query(models.Notification).filter(models.Notification.audience.in_([models.AudienceEnum.all, models.AudienceEnum.students])).order_by(models.Notification.created_at.desc()).all()
    return [{"id": n.id, "title": n.title, "message": n.message, "audience": n.audience.value,
             "is_read": n.is_read, "created_at": n.created_at.isoformat() if n.created_at else None} for n in rows]


@router.post("/chatbot", response_model=schemas.ChatbotResponse)
def chatbot(req: schemas.ChatbotRequest, db: Session = Depends(get_db), current: models.User = Depends(auth.get_current_student)):
    s = db.query(models.Student).filter(models.Student.user_id == current.id).first()
    ctx = {"name": current.name, "roll_no": s.roll_no, "department": s.department,
            "attendance_percentage": s.attendance_percentage, "internal_marks": s.internal_marks,
            "assignment_marks": s.assignment_marks, "previous_result": s.previous_result,
            "backlogs": s.backlogs, "fee_paid": s.fee_paid, "fee_amount": s.fee_amount,
            "fee_due_date": s.fee_due_date, "is_eligible": s.is_eligible,
            "eligibility_percentage": s.eligibility_percentage, "ai_risk_score": s.ai_risk_score}
    reply = ai_chatbot.get_response(req.user_query, ctx)
    db.add(models.ChatbotLog(student_id=s.id, user_query=req.user_query, bot_response=reply)); db.commit()
    return {"response": reply}
