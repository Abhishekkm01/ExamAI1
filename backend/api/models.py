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


class SeatingRoom(models.Model):
    room_code = models.CharField(max_length=50, unique=True, db_index=True)
    room_name = models.CharField(max_length=255)
    building = models.CharField(max_length=100, blank=True, null=True)
    floor = models.IntegerField(default=1)
    capacity = models.IntegerField(default=60)
    rows = models.IntegerField(default=10)
    columns = models.IntegerField(default=6)
    has_projector = models.BooleanField(default=False)
    has_ac = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'seating_rooms'
        indexes = [
            models.Index(fields=['room_code']),
            models.Index(fields=['is_active']),
        ]


class SeatingArrangement(models.Model):
    ARRANGEMENT_TYPES = [('auto', 'Auto'), ('manual', 'Manual')]

    exam = models.ForeignKey(Exam, on_delete=models.CASCADE, related_name='seating_arrangements')
    room = models.ForeignKey(SeatingRoom, on_delete=models.CASCADE, related_name='seating_arrangements')
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='seating_assignments')
    seat_row = models.IntegerField()
    seat_column = models.IntegerField()
    seat_number = models.CharField(max_length=20)
    arrangement_type = models.CharField(max_length=20, choices=ARRANGEMENT_TYPES, default='auto')
    is_confirmed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'seating_arrangements'
        unique_together = [('exam', 'student')]
        indexes = [
            models.Index(fields=['exam']),
            models.Index(fields=['room']),
            models.Index(fields=['student']),
            models.Index(fields=['exam', 'room']),
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


class Department(models.Model):
    name = models.CharField(max_length=100, unique=True)
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'departments'
        ordering = ['name']
        indexes = [
            models.Index(fields=['is_active']),
        ]

    def __str__(self):
        return self.name


class FeePayment(models.Model):
    METHOD_CHOICES = [
        ('online', 'Online'),
        ('bank_transfer', 'Bank Transfer'),
        ('college', 'College Office'),
    ]
    STATUS_CHOICES = [
        ('pending', 'Pending Verification'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]

    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='fee_payments')
    amount = models.FloatField()
    method = models.CharField(max_length=20, choices=METHOD_CHOICES)
    transaction_id = models.CharField(max_length=100, unique=True)
    reference = models.CharField(max_length=255, blank=True, default='')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    paid_at = models.DateTimeField(auto_now_add=True)
    verified_at = models.DateTimeField(blank=True, null=True)
    verified_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, blank=True, null=True, related_name='verified_fee_payments'
    )
    admin_note = models.CharField(max_length=255, blank=True, default='')

    class Meta:
        db_table = 'fee_payments'
        indexes = [
            models.Index(fields=['student']),
            models.Index(fields=['transaction_id']),
            models.Index(fields=['status']),
        ]


class SystemSettings(models.Model):
    """Singleton row (pk=1) for university and AI eligibility configuration."""

    ML_MODEL_CHOICES = [
        ('rf', 'Random Forest Classifier'),
        ('dt', 'Decision Tree'),
    ]

    university_name = models.CharField(max_length=255, default='National Institute of Technology')
    academic_year = models.CharField(max_length=20, default='2026-27')
    current_semester = models.PositiveSmallIntegerField(default=5)
    contact_email = models.EmailField(default='admin@nit.edu')
    attendance_threshold = models.PositiveSmallIntegerField(default=75)
    internal_marks_threshold = models.PositiveSmallIntegerField(default=40)
    min_sgpa = models.FloatField(default=5.0)
    ml_model = models.CharField(max_length=10, choices=ML_MODEL_CHOICES, default='rf')
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'system_settings'

    @classmethod
    def load(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj
