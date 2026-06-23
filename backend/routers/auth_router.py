from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from database import get_db
import models, schemas, auth

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post("/login", response_model=schemas.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == form_data.username, models.User.is_deleted == False).first()
    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")
    access_token = auth.create_access_token(data={"sub": user.email, "role": user.role.value})
    return {"access_token": access_token, "token_type": "bearer", "user": user}


@router.post("/bootstrap-admin", status_code=status.HTTP_201_CREATED)
def bootstrap_admin(data: dict, db: Session = Depends(get_db)):
    """
    Create the first admin account. Only works if no admin exists yet.
    Use this once after running the SQL schema to set up the system.
    Body: { "email": "...", "password": "...", "name": "..." }
    """
    existing = db.query(models.User).filter(models.User.role == models.RoleEnum.admin).first()
    if existing:
        raise HTTPException(status_code=400, detail="An admin account already exists. Use the login page.")
    user = models.User(
        email=data.get("email"),
        hashed_password=auth.get_password_hash(data.get("password")),
        name=data.get("name", "Administrator"),
        role=models.RoleEnum.admin,
        avatar=f"https://api.dicebear.com/7.x/avataaars/svg?seed={data.get('email', 'admin')}",
    )
    db.add(user); db.commit()
    return {"message": f"Admin account created for {user.email}"}


@router.post("/setup-teacher", status_code=status.HTTP_201_CREATED)
def setup_teacher(data: dict, db: Session = Depends(get_db), _: models.User = Depends(auth.get_current_admin)):
    """
    Admin-only: create a new teacher account.
    Body: { "email": "...", "password": "...", "name": "...", "emp_id": "...", "department": "...", "assigned_subjects": "CS301,CS302" }
    """
    user = models.User(
        email=data.get("email"),
        hashed_password=auth.get_password_hash(data.get("password", "teacher123")),
        name=data.get("name"),
        role=models.RoleEnum.teacher,
        avatar=f"https://api.dicebear.com/7.x/avataaars/svg?seed={data.get('emp_id', data.get('email'))}",
    )
    db.add(user); db.commit(); db.refresh(user)
    teacher = models.Teacher(
        user_id=user.id,
        emp_id=data.get("emp_id"),
        department=data.get("department"),
        photo=user.avatar,
        assigned_subjects=data.get("assigned_subjects", ""),
    )
    db.add(teacher); db.commit()
    return {"message": f"Teacher {user.name} created", "teacher_id": teacher.id}


@router.post("/setup-student", status_code=status.HTTP_201_CREATED)
def setup_student(data: dict, db: Session = Depends(get_db), _: models.User = Depends(auth.get_current_admin)):
    """
    Admin-only: create a new student account.
    Body: {
      "email": "...", "password": "...", "name": "...",
      "roll_no": "...", "department": "...", "semester": 5, "section": "A", "mobile": "...",
      "attendance_percentage": 75, "internal_marks": 30, "assignment_marks": 7,
      "previous_result": 7.0, "backlogs": 0, "fee_paid": true, "fee_amount": 45000, "fee_due_date": "2026-09-30"
    }
    """
    user = models.User(
        email=data.get("email"),
        hashed_password=auth.get_password_hash(data.get("password", "student123")),
        name=data.get("name"),
        role=models.RoleEnum.student,
        avatar=f"https://api.dicebear.com/7.x/avataaars/svg?seed={data.get('roll_no', data.get('email'))}",
    )
    db.add(user); db.commit(); db.refresh(user)

    # Run AI eligibility check
    from ai_modules.eligibility_model import eligibility_ai
    ai = eligibility_ai.predict_eligibility(
        data.get("attendance_percentage", 0),
        data.get("internal_marks", 0),
        data.get("previous_result", 0),
        data.get("backlogs", 0),
    )
    passed = (data.get("attendance_percentage", 0) >= 75) and \
              ((data.get("internal_marks", 0) / 40) * 100 >= 40) and \
              (data.get("backlogs", 0) == 0) and \
              data.get("fee_paid", False) and \
              (data.get("previous_result", 0) >= 5.0)
    pct = round((sum([
        data.get("attendance_percentage", 0) >= 75,
        (data.get("internal_marks", 0) / 40) * 100 >= 40,
        data.get("backlogs", 0) == 0,
        data.get("fee_paid", False),
        data.get("previous_result", 0) >= 5.0,
    ]) / 5) * 100)

    student = models.Student(
        user_id=user.id,
        roll_no=data.get("roll_no"),
        mobile=data.get("mobile"),
        department=data.get("department"),
        semester=data.get("semester", 5),
        section=data.get("section", "A"),
        photo=user.avatar,
        attendance_percentage=data.get("attendance_percentage", 0),
        internal_marks=data.get("internal_marks", 0),
        assignment_marks=data.get("assignment_marks", 0),
        previous_result=data.get("previous_result", 0),
        backlogs=data.get("backlogs", 0),
        fee_paid=data.get("fee_paid", False),
        fee_amount=data.get("fee_amount", 45000),
        fee_due_date=data.get("fee_due_date"),
        is_eligible=passed,
        eligibility_percentage=pct,
        ai_risk_score=ai["risk_score"],
    )
    db.add(student); db.commit()
    return {"message": f"Student {user.name} created", "student_id": student.id, "is_eligible": passed}


@router.post("/setup-exam", status_code=status.HTTP_201_CREATED)
def setup_exam(data: dict, db: Session = Depends(get_db), _: models.User = Depends(auth.get_current_admin)):
    """
    Admin-only: create a new exam entry.
    Body: { "subject_code": "...", "subject_name": "...", "department": "...",
            "semester": 5, "exam_date": "2026-11-10", "exam_time": "10:00 AM",
            "duration": "3 hours", "room": "...", "total_marks": 100 }
    """
    exam = models.Exam(**data)
    db.add(exam); db.commit()
    return {"message": f"Exam {exam.subject_code} created", "exam_id": exam.id}


@router.post("/send-notification", status_code=status.HTTP_201_CREATED)
def send_notification(data: dict, db: Session = Depends(get_db), _: models.User = Depends(auth.get_current_admin)):
    """Admin-only: create a notification."""
    n = models.Notification(
        title=data.get("title"),
        message=data.get("message"),
        audience=models.AudienceEnum(data.get("audience", "all")),
        is_read=False,
    )
    db.add(n); db.commit()
    return {"message": "Notification sent"}
