from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
import models

router = APIRouter(prefix="/api/public", tags=["Public"])


@router.get("/verify-hallticket/{ht_no}")
def verify(ht_no: str, db: Session = Depends(get_db)):
    ht = db.query(models.HallTicket).filter(models.HallTicket.hall_ticket_no == ht_no, models.HallTicket.is_active == True).first()
    if ht:
        return {
            "valid": True,
            "student": {"name": ht.student.user.name, "roll_no": ht.student.roll_no,
                          "department": ht.student.department, "photo": ht.student.photo},
            "hall_ticket_no": ht.hall_ticket_no, "exam": ht.exam.subject_name, "subject_code": ht.exam.subject_code,
            "date": ht.exam.exam_date, "time": ht.exam.exam_time, "room": ht.room, "seat_number": ht.seat_number
        }
    clean = ht_no.replace("HT2026", "")
    s = db.query(models.Student).filter(models.Student.roll_no == clean, models.Student.is_deleted == False).first()
    if s and s.is_eligible:
        exam = db.query(models.Exam).filter(models.Exam.department == s.department).first() or db.query(models.Exam).first()
        return {
            "valid": True,
            "student": {"name": s.user.name, "roll_no": s.roll_no, "department": s.department, "photo": s.photo},
            "hall_ticket_no": ht_no, "exam": exam.subject_name, "subject_code": exam.subject_code,
            "date": exam.exam_date, "time": exam.exam_time, "room": exam.room, "seat_number": f"S{100 + s.id}"
        }
    raise HTTPException(404, "Invalid Hall Ticket")


@router.get("/meta")
def meta(db: Session = Depends(get_db)):
    """Public endpoint: returns departments, subjects, and semesters for UI dropdowns."""
    students = db.query(models.Student).filter(models.Student.is_deleted == False).all()
    depts = sorted({s.department for s in students})
    exams = db.query(models.Exam).filter(models.Exam.is_deleted == False).all()
    subjects = [{"code": e.subject_code, "name": e.subject_name, "dept": e.department, "sem": e.semester} for e in exams]
    return {"departments": depts, "subjects": subjects}
