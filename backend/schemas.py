from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime
import enum

class RoleEnum(str, enum.Enum):
    admin = "admin"
    teacher = "teacher"
    student = "student"

class AudienceEnum(str, enum.Enum):
    all = "all"
    students = "students"
    teachers = "teachers"
    admin = "admin"

class UserBase(BaseModel):
    email: EmailStr
    name: str
    role: RoleEnum
    avatar: Optional[str] = None

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: int
    created_at: datetime
    is_deleted: bool
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

class StudentBase(BaseModel):
    roll_no: str
    mobile: Optional[str] = None
    department: str
    semester: int
    section: str
    photo: Optional[str] = None
    attendance_percentage: float = 0.0
    internal_marks: float = 0.0
    assignment_marks: float = 0.0
    previous_result: float = 0.0
    backlogs: int = 0
    fee_paid: bool = False
    fee_amount: float = 45000.0
    fee_due_date: Optional[str] = None

class StudentCreate(StudentBase):
    email: EmailStr
    name: str
    password: str

class StudentUpdate(BaseModel):
    mobile: Optional[str] = None
    department: Optional[str] = None
    semester: Optional[int] = None
    section: Optional[str] = None
    photo: Optional[str] = None
    attendance_percentage: Optional[float] = None
    internal_marks: Optional[float] = None
    assignment_marks: Optional[float] = None
    previous_result: Optional[float] = None
    backlogs: Optional[int] = None
    fee_paid: Optional[bool] = None

class StudentResponse(StudentBase):
    id: int
    user_id: int
    is_eligible: bool
    eligibility_percentage: float
    ai_risk_score: float
    class Config:
        from_attributes = True

class TeacherBase(BaseModel):
    emp_id: str
    department: str
    photo: Optional[str] = None
    assigned_subjects: Optional[str] = None

class TeacherCreate(TeacherBase):
    email: EmailStr
    name: str
    password: str

class TeacherResponse(TeacherBase):
    id: int
    user_id: int
    class Config:
        from_attributes = True

class ExamBase(BaseModel):
    subject_code: str
    subject_name: str
    department: str
    semester: int
    exam_date: str
    exam_time: str
    duration: str = "3 hours"
    room: str
    total_marks: int = 100

class ExamCreate(ExamBase):
    pass

class ExamResponse(ExamBase):
    id: int
    class Config:
        from_attributes = True

class HallTicketResponse(BaseModel):
    id: int
    hall_ticket_no: str
    student_id: int
    exam_id: int
    seat_number: str
    room: str
    qr_code_content: str
    is_active: bool
    class Config:
        from_attributes = True

class NotificationBase(BaseModel):
    title: str
    message: str
    audience: AudienceEnum

class NotificationCreate(NotificationBase):
    pass

class NotificationResponse(NotificationBase):
    id: int
    is_read: bool
    created_at: datetime
    class Config:
        from_attributes = True

class ChatbotRequest(BaseModel):
    user_query: str

class ChatbotResponse(BaseModel):
    response: str

class FaceVerifyRequest(BaseModel):
    image_base64: str

class FaceVerifyResponse(BaseModel):
    verified: bool
    confidence: float
    message: str
    student_name: Optional[str] = None
