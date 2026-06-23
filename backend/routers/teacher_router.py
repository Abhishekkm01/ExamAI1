from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
import models, schemas, auth
from ai_modules.face_recognition_module import face_ai

router = APIRouter(prefix="/api/teacher", tags=["Teacher Module"])


@router.get("/dashboard")
def dashboard(db: Session = Depends(get_db), current: models.User = Depends(auth.get_current_teacher)):
    t = db.query(models.Teacher).filter(models.Teacher.user_id == current.id).first()
    dept = t.department if t else "Computer Science"
    s = db.query(models.Student).filter(models.Student.department == dept, models.Student.is_deleted == False).all()
    avg_att = round(sum(x.attendance_percentage for x in s) / max(1, len(s)), 1)
    avg_int = round(sum(x.internal_marks for x in s) / max(1, len(s)), 1)
    return {
        "total_students": len(s),
        "subjects_assigned": t.assigned_subjects.split(",") if t and t.assigned_subjects else ["CS301", "CS302"],
        "avg_attendance": avg_att, "avg_internals": avg_int,
        "students_requiring_attention": [{"id": x.id, "name": x.user.name, "roll_no": x.roll_no,
                                            "attendance": x.attendance_percentage, "backlogs": x.backlogs, "photo": x.photo}
                                           for x in s if x.attendance_percentage < 75 or x.backlogs > 0]
    }


@router.get("/attendance")
def get_roll(subject_code: str = "CS301", db: Session = Depends(get_db), current: models.User = Depends(auth.get_current_teacher)):
    t = db.query(models.Teacher).filter(models.Teacher.user_id == current.id).first()
    dept = t.department if t else "Computer Science"
    s = db.query(models.Student).filter(models.Student.department == dept, models.Student.is_deleted == False).all()
    return [{"id": x.id, "name": x.user.name, "roll_no": x.roll_no, "photo": x.photo,
             "attendance_percentage": x.attendance_percentage} for x in s]


@router.post("/attendance")
def mark_attendance(data: dict, db: Session = Depends(get_db), _: models.User = Depends(auth.get_current_teacher)):
    for sid, present in (data.get("records") or {}).items():
        sid_int = int(sid)
        s = db.query(models.Student).filter(models.Student.id == sid_int).first()
        if not s: continue
        db.add(models.Attendance(student_id=s.id, subject_code=data.get("subject_code", "CS301"),
                                  record_date=data.get("date", "2026-11-01"), status="Present" if present else "Absent"))
        if present and s.attendance_percentage < 100: s.attendance_percentage = min(100.0, s.attendance_percentage + 0.5)
        elif not present and s.attendance_percentage > 0: s.attendance_percentage = max(0.0, s.attendance_percentage - 0.5)
    db.commit()
    return {"message": "Attendance saved"}


@router.get("/marks")
def get_marks(subject_code: str = "CS301", db: Session = Depends(get_db), current: models.User = Depends(auth.get_current_teacher)):
    t = db.query(models.Teacher).filter(models.Teacher.user_id == current.id).first()
    dept = t.department if t else "Computer Science"
    s = db.query(models.Student).filter(models.Student.department == dept, models.Student.is_deleted == False).all()
    return [{"id": x.id, "name": x.user.name, "roll_no": x.roll_no, "photo": x.photo,
             "internal_marks": x.internal_marks, "assignment_marks": x.assignment_marks} for x in s]


@router.post("/marks")
def update_marks(data: dict, db: Session = Depends(get_db), _: models.User = Depends(auth.get_current_teacher)):
    s = db.query(models.Student).filter(models.Student.id == data.get("student_id")).first()
    if not s: raise HTTPException(404, "Student not found")
    s.internal_marks = float(data.get("internal_marks", s.internal_marks))
    s.assignment_marks = float(data.get("assignment_marks", s.assignment_marks))
    db.add(models.InternalMark(student_id=s.id, subject_code=data.get("subject_code", "CS301"),
                                 internal_score=s.internal_marks, assignment_score=s.assignment_marks))
    db.commit()
    return {"message": "Marks updated"}


@router.get("/students")
def monitor_students(db: Session = Depends(get_db), current: models.User = Depends(auth.get_current_teacher)):
    t = db.query(models.Teacher).filter(models.Teacher.user_id == current.id).first()
    dept = t.department if t else "Computer Science"
    s = db.query(models.Student).filter(models.Student.department == dept, models.Student.is_deleted == False).all()
    return [{"id": x.id, "name": x.user.name, "roll_no": x.roll_no, "photo": x.photo,
             "attendance": x.attendance_percentage, "internal_marks": x.internal_marks,
             "previous_result": x.previous_result, "backlogs": x.backlogs, "is_eligible": x.is_eligible} for x in s]


@router.post("/face-verify", response_model=schemas.FaceVerifyResponse)
def teacher_face_verify(req: schemas.FaceVerifyRequest, db: Session = Depends(get_db), current: models.User = Depends(auth.get_current_teacher)):
    t = db.query(models.Teacher).filter(models.Teacher.user_id == current.id).first()
    dept = t.department if t else "Computer Science"
    s = db.query(models.Student).filter(models.Student.department == dept, models.Student.is_deleted == False).all()
    best_conf = 0.0; best_match = None
    for x in s:
        res = face_ai.verify_face(req.image_base64, [0.1] * 128)
        if res["verified"] and res["confidence"] > best_conf:
            best_conf = res["confidence"]; best_match = x
    if best_match:
        return {"verified": True, "confidence": best_conf, "message": "Verification successful", "student_name": best_match.user.name}
    return {"verified": False, "confidence": 0.0, "message": "No biometric match", "student_name": None}
