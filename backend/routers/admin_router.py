import io
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from database import get_db
import models, schemas, auth
from ai_modules.eligibility_model import eligibility_ai
import openpyxl
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

router = APIRouter(prefix="/api/admin", tags=["Admin Module"])


@router.get("/dashboard")
def dashboard(db: Session = Depends(get_db), _: models.User = Depends(auth.get_current_admin)):
    students = db.query(models.Student).filter(models.Student.is_deleted == False).all()
    eligible = sum(1 for s in students if s.is_eligible)
    ht = db.query(models.HallTicket).filter(models.HallTicket.is_active == True).count()
    avg_att = round(sum(s.attendance_percentage for s in students) / max(1, len(students)), 1)
    upcoming = db.query(models.Exam).filter(models.Exam.is_deleted == False).count()
    return {
        "total_students": len(students), "eligible_students": eligible, "hall_tickets_generated": ht,
        "avg_attendance": avg_att, "upcoming_exams": upcoming,
        "recent_students": [{"id": s.id, "name": s.user.name, "roll_no": s.roll_no, "department": s.department,
                              "attendance": s.attendance_percentage, "internals": s.internal_marks,
                              "is_eligible": s.is_eligible, "photo": s.photo} for s in students[:5]]
    }


@router.get("/students")
def list_students(search: Optional[str] = None, department: Optional[str] = "all",
                   page: int = Query(1, ge=1), page_size: int = Query(100, ge=1, le=200),
                   db: Session = Depends(get_db), _: models.User = Depends(auth.get_current_admin)):
    q = db.query(models.Student).join(models.User).filter(models.Student.is_deleted == False)
    if department and department != "all":
        q = q.filter(models.Student.department == department)
    if search:
        like = f"%{search}%"
        q = q.filter((models.User.name.ilike(like)) | (models.Student.roll_no.ilike(like)) | (models.User.email.ilike(like)))
    total = q.count()
    students = q.offset((page - 1) * page_size).limit(page_size).all()
    return {
        "total": total, "page": page, "page_size": page_size,
        "students": [{
            "id": s.id, "user_id": s.user_id, "name": s.user.name, "email": s.user.email,
            "roll_no": s.roll_no, "department": s.department, "semester": s.semester, "section": s.section,
            "mobile": s.mobile, "photo": s.photo, "attendance": s.attendance_percentage,
            "internal_marks": s.internal_marks, "assignment_marks": s.assignment_marks,
            "previous_result": s.previous_result, "backlogs": s.backlogs, "fee_paid": s.fee_paid,
            "fee_amount": s.fee_amount, "fee_due_date": s.fee_due_date, "is_eligible": s.is_eligible,
            "eligibility_percentage": s.eligibility_percentage, "ai_risk_score": s.ai_risk_score
        } for s in students]
    }


@router.get("/students/{sid}")
def get_student(sid: int, db: Session = Depends(get_db), _: models.User = Depends(auth.get_current_admin)):
    s = db.query(models.Student).filter(models.Student.id == sid, models.Student.is_deleted == False).first()
    if not s: raise HTTPException(404, "Not found")
    return {
        "id": s.id, "user_id": s.user_id, "name": s.user.name, "email": s.user.email,
        "roll_no": s.roll_no, "department": s.department, "semester": s.semester, "section": s.section,
        "mobile": s.mobile, "photo": s.photo, "attendance": s.attendance_percentage,
        "internal_marks": s.internal_marks, "assignment_marks": s.assignment_marks,
        "previous_result": s.previous_result, "backlogs": s.backlogs, "fee_paid": s.fee_paid,
        "fee_amount": s.fee_amount, "fee_due_date": s.fee_due_date, "is_eligible": s.is_eligible,
        "eligibility_percentage": s.eligibility_percentage, "ai_risk_score": s.ai_risk_score
    }


@router.post("/students", status_code=201)
def create_student(data: schemas.StudentCreate, db: Session = Depends(get_db), _: models.User = Depends(auth.get_current_admin)):
    user = models.User(email=data.email, hashed_password=auth.get_password_hash(data.password),
                        name=data.name, role=models.RoleEnum.student,
                        avatar=data.photo or f"https://api.dicebear.com/7.x/avataaars/svg?seed={data.roll_no}")
    db.add(user); db.commit(); db.refresh(user)
    ai = eligibility_ai.predict_eligibility(data.attendance_percentage, data.internal_marks, data.previous_result, data.backlogs)
    student = models.Student(user_id=user.id, roll_no=data.roll_no, mobile=data.mobile, department=data.department,
                              semester=data.semester, section=data.section, photo=user.avatar,
                              attendance_percentage=data.attendance_percentage, internal_marks=data.internal_marks,
                              assignment_marks=data.assignment_marks, previous_result=data.previous_result,
                              backlogs=data.backlogs, fee_paid=data.fee_paid, fee_amount=data.fee_amount,
                              fee_due_date=data.fee_due_date, is_eligible=ai["is_eligible"],
                              eligibility_percentage=ai["probability"] * 100.0, ai_risk_score=ai["risk_score"])
    db.add(student); db.commit()
    return {"message": "Student created", "student_id": student.id}


@router.put("/students/{sid}")
def update_student(sid: int, data: schemas.StudentUpdate, db: Session = Depends(get_db), _: models.User = Depends(auth.get_current_admin)):
    s = db.query(models.Student).filter(models.Student.id == sid, models.Student.is_deleted == False).first()
    if not s: raise HTTPException(404, "Not found")
    for k, v in data.model_dump(exclude_unset=True).items(): setattr(s, k, v)
    ai = eligibility_ai.predict_eligibility(s.attendance_percentage, s.internal_marks, s.previous_result, s.backlogs)
    s.is_eligible, s.eligibility_percentage, s.ai_risk_score = ai["is_eligible"], ai["probability"] * 100.0, ai["risk_score"]
    db.commit()
    return {"message": "Updated"}


@router.delete("/students/{sid}", status_code=204)
def delete_student(sid: int, db: Session = Depends(get_db), _: models.User = Depends(auth.get_current_admin)):
    s = db.query(models.Student).filter(models.Student.id == sid).first()
    if not s: raise HTTPException(404, "Not found")
    s.is_deleted = True; s.user.is_deleted = True; db.commit()


@router.get("/teachers")
def list_teachers(db: Session = Depends(get_db), _: models.User = Depends(auth.get_current_admin)):
    t = db.query(models.Teacher).filter(models.Teacher.is_deleted == False).all()
    return [{"id": x.id, "name": x.user.name, "email": x.user.email, "emp_id": x.emp_id,
             "department": x.department, "photo": x.photo,
             "assigned_subjects": x.assigned_subjects.split(",") if x.assigned_subjects else []} for x in t]


@router.get("/exams")
def list_exams(db: Session = Depends(get_db), _: models.User = Depends(auth.get_current_admin)):
    return [{"id": e.id, "subject_code": e.subject_code, "subject_name": e.subject_name,
             "department": e.department, "semester": e.semester, "exam_date": e.exam_date,
             "exam_time": e.exam_time, "duration": e.duration, "room": e.room, "total_marks": e.total_marks}
            for e in db.query(models.Exam).filter(models.Exam.is_deleted == False).all()]


@router.post("/exams", status_code=201)
def create_exam(data: schemas.ExamCreate, db: Session = Depends(get_db), _: models.User = Depends(auth.get_current_admin)):
    e = models.Exam(**data.model_dump()); db.add(e); db.commit()
    return {"message": "Exam scheduled", "exam_id": e.id}


@router.post("/eligibility/verify-all")
def verify_all(db: Session = Depends(get_db), _: models.User = Depends(auth.get_current_admin)):
    students = db.query(models.Student).filter(models.Student.is_deleted == False).all()
    for s in students:
        ai = eligibility_ai.predict_eligibility(s.attendance_percentage, s.internal_marks, s.previous_result, s.backlogs)
        passed = (s.attendance_percentage >= 75.0) and ((s.internal_marks / 40.0) >= 0.4) and (s.backlogs == 0) and s.fee_paid and (s.previous_result >= 5.0)
        s.is_eligible = passed
        s.eligibility_percentage = round(ai["probability"] * 100.0, 1)
        s.ai_risk_score = ai["risk_score"]
        db.add(models.EligibilityPrediction(student_id=s.id, predicted_probability=ai["probability"],
                                              risk_score=ai["risk_score"]))
    db.commit()
    return {"message": f"Verified eligibility for {len(students)} students."}


@router.post("/halltickets/generate-all")
def generate_halltickets(db: Session = Depends(get_db), _: models.User = Depends(auth.get_current_admin)):
    eligible = db.query(models.Student).filter(models.Student.is_deleted == False, models.Student.is_eligible == True).all()
    count = 0
    for s in eligible:
        if s.hall_ticket: continue
        exam = db.query(models.Exam).filter(models.Exam.department == s.department, models.Exam.is_deleted == False).first()
        if not exam: exam = db.query(models.Exam).first()
        if not exam: continue
        ht = models.HallTicket(hall_ticket_no=f"HT2026{s.roll_no}", student_id=s.id, exam_id=exam.id,
                                seat_number=f"S{100 + s.id}", room=exam.room,
                                qr_code_content=f"HT:HT2026{s.roll_no}|Roll:{s.roll_no}|Exam:{exam.subject_code}|Seat:S{100+s.id}")
        db.add(ht); count += 1
    db.commit()
    return {"message": f"Generated {count} hall tickets."}


@router.get("/halltickets")
def list_halltickets(db: Session = Depends(get_db), _: models.User = Depends(auth.get_current_admin)):
    hts = db.query(models.HallTicket).filter(models.HallTicket.is_active == True).all()
    return [{
        "id": h.id, "hall_ticket_no": h.hall_ticket_no, "student_id": h.student_id,
        "student_name": h.student.user.name, "roll_no": h.student.roll_no, "department": h.student.department,
        "photo": h.student.photo, "seat_number": h.seat_number, "room": h.room, "exam": h.exam.subject_name
    } for h in hts]


@router.get("/backlogs")
def backlogs(db: Session = Depends(get_db), _: models.User = Depends(auth.get_current_admin)):
    s = db.query(models.Student).filter(models.Student.backlogs > 0, models.Student.is_deleted == False).all()
    return [{"id": x.id, "name": x.user.name, "roll_no": x.roll_no, "department": x.department,
             "backlogs": x.backlogs, "attendance": x.attendance_percentage, "is_eligible": x.is_eligible} for x in s]


@router.get("/fees")
def fees(db: Session = Depends(get_db), _: models.User = Depends(auth.get_current_admin)):
    s = db.query(models.Student).filter(models.Student.is_deleted == False).all()
    paid = [x for x in s if x.fee_paid]; unpaid = [x for x in s if not x.fee_paid]
    return {
        "total_collected": sum(x.fee_amount for x in paid), "total_due": sum(x.fee_amount for x in unpaid),
        "paid_count": len(paid), "unpaid_count": len(unpaid),
        "unpaid_students": [{"id": x.id, "name": x.user.name, "roll_no": x.roll_no, "amount": x.fee_amount,
                              "due_date": x.fee_due_date, "photo": x.photo} for x in unpaid]
    }


@router.put("/fees/{sid}/mark-paid")
def mark_fee_paid(sid: int, db: Session = Depends(get_db), _: models.User = Depends(auth.get_current_admin)):
    s = db.query(models.Student).filter(models.Student.id == sid).first()
    if not s: raise HTTPException(404, "Not found")
    s.fee_paid = True
    ai = eligibility_ai.predict_eligibility(s.attendance_percentage, s.internal_marks, s.previous_result, s.backlogs)
    s.is_eligible, s.eligibility_percentage, s.ai_risk_score = ai["is_eligible"], ai["probability"] * 100.0, ai["risk_score"]
    db.commit()
    return {"message": "Fee marked as paid"}


@router.post("/notifications", status_code=201)
def send_notification(data: schemas.NotificationCreate, db: Session = Depends(get_db), _: models.User = Depends(auth.get_current_admin)):
    n = models.Notification(**data.model_dump()); db.add(n); db.commit()
    return {"message": "Notification sent"}


@router.get("/notifications")
def list_notifications(db: Session = Depends(get_db), _: models.User = Depends(auth.get_current_admin)):
    return [{"id": n.id, "title": n.title, "message": n.message, "audience": n.audience.value,
             "is_read": n.is_read, "created_at": n.created_at.isoformat() if n.created_at else None}
            for n in db.query(models.Notification).order_by(models.Notification.created_at.desc()).all()]


@router.get("/analytics")
def analytics(db: Session = Depends(get_db), _: models.User = Depends(auth.get_current_admin)):
    s = db.query(models.Student).filter(models.Student.is_deleted == False).all()
    dept = {}
    for x in s: dept[x.department] = dept.get(x.department, 0) + 1
    return {"department_distribution": [{"name": k, "value": v} for k, v in dept.items()],
            "attendance_data": [{"name": x.user.name.split()[0], "attendance": x.attendance_percentage} for x in s]}


@router.get("/reports/export")
def export_report(report_type: str = "attendance", format: str = "excel",
                   db: Session = Depends(get_db), _: models.User = Depends(auth.get_current_admin)):
    s = db.query(models.Student).filter(models.Student.is_deleted == False).all()
    if format == "excel":
        wb = openpyxl.Workbook(); ws = wb.active; ws.title = report_type.title()
        if report_type == "attendance":
            ws.append(["Roll No", "Name", "Department", "Attendance %"])
            [ws.append([x.roll_no, x.user.name, x.department, x.attendance_percentage]) for x in s]
        elif report_type == "marks":
            ws.append(["Roll No", "Name", "Department", "Internal", "Assignment"])
            [ws.append([x.roll_no, x.user.name, x.department, x.internal_marks, x.assignment_marks]) for x in s]
        elif report_type == "eligibility":
            ws.append(["Roll No", "Name", "Department", "Eligibility %", "Status", "Risk Score"])
            [ws.append([x.roll_no, x.user.name, x.department, x.eligibility_percentage, "Eligible" if x.is_eligible else "Not Eligible", x.ai_risk_score]) for x in s]
        out = io.BytesIO(); wb.save(out); out.seek(0)
        return StreamingResponse(out, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                                  headers={"Content-Disposition": f"attachment; filename={report_type}.xlsx"})
    out = io.BytesIO(); p = canvas.Canvas(out, pagesize=letter)
    p.drawString(100, 750, f"ExamShield AI - {report_type.title()} Report")
    p.drawString(100, 730, "National Institute of Technology")
    y = 700
    for x in s[:25]:
        p.drawString(100, y, f"{x.roll_no} | {x.user.name} | {x.department} | Att: {x.attendance_percentage}% | Eligible: {x.is_eligible}"); y -= 18
    p.showPage(); p.save(); out.seek(0)
    return StreamingResponse(out, media_type="application/pdf", headers={"Content-Disposition": f"attachment; filename={report_type}.pdf"})
