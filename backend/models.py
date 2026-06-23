from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey, DateTime, Text, Enum, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from database import Base

class RoleEnum(str, enum.Enum):
    admin = "admin"
    teacher = "teacher"
    student = "student"

class AudienceEnum(str, enum.Enum):
    all = "all"
    students = "students"
    teachers = "teachers"
    admin = "admin"

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    name = Column(String(255), nullable=False)
    role = Column(Enum(RoleEnum), nullable=False)
    avatar = Column(String(512), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())
    is_deleted = Column(Boolean, default=False, index=True)
    student_profile = relationship("Student", back_populates="user", uselist=False)
    teacher_profile = relationship("Teacher", back_populates="user", uselist=False)


class Student(Base):
    __tablename__ = "students"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    roll_no = Column(String(50), unique=True, index=True, nullable=False)
    mobile = Column(String(20), nullable=True)
    department = Column(String(100), index=True, nullable=False)
    semester = Column(Integer, nullable=False, default=1)
    section = Column(String(10), nullable=False, default="A")
    photo = Column(String(512), nullable=True)
    face_encoding = Column(Text, nullable=True)
    attendance_percentage = Column(Float, default=0.0)
    internal_marks = Column(Float, default=0.0)
    assignment_marks = Column(Float, default=0.0)
    previous_result = Column(Float, default=0.0)
    backlogs = Column(Integer, default=0)
    fee_paid = Column(Boolean, default=False, index=True)
    fee_amount = Column(Float, default=45000.0)
    fee_due_date = Column(String(50), nullable=True)
    is_eligible = Column(Boolean, default=False, index=True)
    eligibility_percentage = Column(Float, default=0.0)
    ai_risk_score = Column(Float, default=0.0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())
    is_deleted = Column(Boolean, default=False, index=True)
    user = relationship("User", back_populates="student_profile")
    hall_ticket = relationship("HallTicket", back_populates="student", uselist=False)
    attendance_records = relationship("Attendance", back_populates="student")
    internal_records = relationship("InternalMark", back_populates="student")
    predictions = relationship("EligibilityPrediction", back_populates="student")
    chatbot_logs = relationship("ChatbotLog", back_populates="student")


class Teacher(Base):
    __tablename__ = "teachers"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    emp_id = Column(String(50), unique=True, index=True, nullable=False)
    department = Column(String(100), index=True, nullable=False)
    photo = Column(String(512), nullable=True)
    assigned_subjects = Column(String(512), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())
    is_deleted = Column(Boolean, default=False, index=True)
    user = relationship("User", back_populates="teacher_profile")


class Exam(Base):
    __tablename__ = "exams"
    id = Column(Integer, primary_key=True, index=True)
    subject_code = Column(String(50), unique=True, index=True, nullable=False)
    subject_name = Column(String(255), nullable=False)
    department = Column(String(100), index=True, nullable=False)
    semester = Column(Integer, nullable=False)
    exam_date = Column(String(50), nullable=False)
    exam_time = Column(String(50), nullable=False)
    duration = Column(String(50), nullable=False, default="3 hours")
    room = Column(String(100), nullable=False)
    total_marks = Column(Integer, default=100)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())
    is_deleted = Column(Boolean, default=False, index=True)
    hall_tickets = relationship("HallTicket", back_populates="exam")


class Attendance(Base):
    __tablename__ = "attendance"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False, index=True)
    subject_code = Column(String(50), nullable=False, index=True)
    record_date = Column(String(50), nullable=False, index=True)
    status = Column(String(20), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())
    student = relationship("Student", back_populates="attendance_records")


class InternalMark(Base):
    __tablename__ = "internal_marks"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False, index=True)
    subject_code = Column(String(50), nullable=False, index=True)
    internal_score = Column(Float, default=0.0)
    assignment_score = Column(Float, default=0.0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())
    student = relationship("Student", back_populates="internal_records")


class HallTicket(Base):
    __tablename__ = "hall_tickets"
    id = Column(Integer, primary_key=True, index=True)
    hall_ticket_no = Column(String(100), unique=True, index=True, nullable=False)
    student_id = Column(Integer, ForeignKey("students.id"), unique=True, nullable=False)
    exam_id = Column(Integer, ForeignKey("exams.id"), nullable=False)
    seat_number = Column(String(50), nullable=False)
    room = Column(String(100), nullable=False)
    qr_code_content = Column(Text, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())
    student = relationship("Student", back_populates="hall_ticket")
    exam = relationship("Exam", back_populates="hall_tickets")


class Notification(Base):
    __tablename__ = "notifications"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    audience = Column(Enum(AudienceEnum), nullable=False, index=True)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ChatbotLog(Base):
    __tablename__ = "chatbot_logs"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False, index=True)
    user_query = Column(Text, nullable=False)
    bot_response = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    student = relationship("Student", back_populates="chatbot_logs")


class EligibilityPrediction(Base):
    __tablename__ = "eligibility_predictions"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False, index=True)
    predicted_probability = Column(Float, nullable=False)
    risk_score = Column(Float, nullable=False)
    factors_summary = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    student = relationship("Student", back_populates="predictions")


Index("idx_student_dept_sem", Student.department, Student.semester)
Index("idx_exam_dept_sem", Exam.department, Exam.semester)
