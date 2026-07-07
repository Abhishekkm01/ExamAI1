from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils import timezone


class RoleEnum(models.TextChoices):
    ADMIN = 'admin'
    TEACHER = 'teacher'
    STUDENT = 'student'


class AudienceEnum(models.TextChoices):
    ALL = 'all'
    STUDENTS = 'students'
    TEACHERS = 'teachers'
    ADMIN = 'admin'


class User(AbstractUser):
    email = models.EmailField(unique=True)
    name = models.CharField(max_length=255)
    role = models.CharField(max_length=20, choices=RoleEnum.choices)
    avatar = models.URLField(max_length=512, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_deleted = models.BooleanField(default=False, db_index=True)
    
    # Make username nullable and not unique since we use email as USERNAME_FIELD
    username = models.CharField(max_length=150, blank=True, null=True, unique=False)
    
    # Add a property to access hashed_password for compatibility with existing code
    @property
    def hashed_password(self):
        return self.password
    
    @hashed_password.setter
    def hashed_password(self, value):
        self.password = value

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['name', 'role']

    class Meta:
        db_table = 'users'
        indexes = [
            models.Index(fields=['email']),
            models.Index(fields=['is_deleted']),
        ]


class Student(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='student_profile')
    roll_no = models.CharField(max_length=50, unique=True, db_index=True)
    mobile = models.CharField(max_length=20, blank=True, null=True)
    department = models.CharField(max_length=100, db_index=True)
    semester = models.IntegerField(default=1)
    section = models.CharField(max_length=10, default='A')
    photo = models.URLField(max_length=512, blank=True, null=True)
    face_encoding = models.TextField(blank=True, null=True)
    attendance_percentage = models.FloatField(default=0.0)
    internal_marks = models.FloatField(default=0.0)
    assignment_marks = models.FloatField(default=0.0)
    previous_result = models.FloatField(default=0.0)
    backlogs = models.IntegerField(default=0)
    fee_paid = models.BooleanField(default=False, db_index=True)
    fee_amount = models.FloatField(default=45000.0)
    fee_due_date = models.CharField(max_length=50, blank=True, null=True)
    is_eligible = models.BooleanField(default=False, db_index=True)
    eligibility_percentage = models.FloatField(default=0.0)
    ai_risk_score = models.FloatField(default=0.0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_deleted = models.BooleanField(default=False, db_index=True)

    class Meta:
        db_table = 'students'
        indexes = [
            models.Index(fields=['roll_no']),
            models.Index(fields=['department']),
            models.Index(fields=['is_deleted']),
            models.Index(fields=['fee_paid']),
            models.Index(fields=['is_eligible']),
            models.Index(fields=['department', 'semester'], name='idx_student_dept_sem'),
        ]


class Teacher(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='teacher_profile')
    emp_id = models.CharField(max_length=50, unique=True, db_index=True)
    department = models.CharField(max_length=100, db_index=True)
    photo = models.URLField(max_length=512, blank=True, null=True)
    assigned_subjects = models.CharField(max_length=512, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_deleted = models.BooleanField(default=False, db_index=True)

    class Meta:
        db_table = 'teachers'
        indexes = [
            models.Index(fields=['emp_id']),
            models.Index(fields=['department']),
            models.Index(fields=['is_deleted']),
        ]


class Exam(models.Model):
    subject_code = models.CharField(max_length=50, unique=True, db_index=True)
    subject_name = models.CharField(max_length=255)
    department = models.CharField(max_length=100, db_index=True)
    semester = models.IntegerField()
    exam_date = models.CharField(max_length=50)
    exam_time = models.CharField(max_length=50)
    duration = models.CharField(max_length=50, default='3 hours')
    room = models.CharField(max_length=100)
    total_marks = models.IntegerField(default=100)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_deleted = models.BooleanField(default=False, db_index=True)

    class Meta:
        db_table = 'exams'
        indexes = [
            models.Index(fields=['subject_code']),
            models.Index(fields=['department']),
            models.Index(fields=['is_deleted']),
            models.Index(fields=['department', 'semester'], name='idx_exam_dept_sem'),
        ]


class Attendance(models.Model):
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='attendance_records')
    subject_code = models.CharField(max_length=50, db_index=True)
    record_date = models.CharField(max_length=50, db_index=True)
    status = models.CharField(max_length=20)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'attendance'
        indexes = [
            models.Index(fields=['student']),
            models.Index(fields=['subject_code']),
            models.Index(fields=['record_date']),
        ]


class InternalMark(models.Model):
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='internal_records')
    subject_code = models.CharField(max_length=50, db_index=True)
    internal_score = models.FloatField(default=0.0)
    assignment_score = models.FloatField(default=0.0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'internal_marks'
        indexes = [
            models.Index(fields=['student']),
            models.Index(fields=['subject_code']),
        ]


class HallTicket(models.Model):
    hall_ticket_no = models.CharField(max_length=100, unique=True, db_index=True)
    student = models.OneToOneField(Student, on_delete=models.CASCADE, related_name='hall_ticket')
    exam = models.ForeignKey(Exam, on_delete=models.CASCADE, related_name='hall_tickets')
    seat_number = models.CharField(max_length=50)
    room = models.CharField(max_length=100)
    qr_code_content = models.TextField()
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'hall_tickets'
        indexes = [
            models.Index(fields=['hall_ticket_no']),
        ]


class Notification(models.Model):
    title = models.CharField(max_length=255)
    message = models.TextField()
    audience = models.CharField(max_length=20, choices=AudienceEnum.choices, db_index=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'notifications'
        indexes = [
            models.Index(fields=['audience']),
        ]


class ChatbotLog(models.Model):
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='chatbot_logs')
    user_query = models.TextField()
    bot_response = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'chatbot_logs'
        indexes = [
            models.Index(fields=['student']),
        ]


class EligibilityPrediction(models.Model):
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='predictions')
    predicted_probability = models.FloatField()
    risk_score = models.FloatField()
    factors_summary = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'eligibility_predictions'
        indexes = [
            models.Index(fields=['student']),
        ]
