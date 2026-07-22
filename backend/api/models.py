from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils import timezone


class RoleEnum(models.TextChoices):
    ADMIN = 'admin'
    HOD = 'hod'
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
    GENDER_CHOICES = [
        ('male', 'Male'),
        ('female', 'Female'),
        ('other', 'Other'),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='student_profile')
    roll_no = models.CharField(max_length=50, unique=True, db_index=True)
    mobile = models.CharField(max_length=20, blank=True, null=True)
    gender = models.CharField(max_length=10, choices=GENDER_CHOICES, blank=True, default='')
    date_of_birth = models.CharField(max_length=20, blank=True, null=True)
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
    fee_paid = models.BooleanField(default=False, db_index=True)  # True when BOTH college + exam fees paid
    fee_amount = models.FloatField(default=45000.0)  # exam fee amount
    exam_fee_paid = models.BooleanField(default=False, db_index=True)
    college_fee_amount = models.FloatField(default=25000.0)
    college_fee_paid = models.BooleanField(default=False, db_index=True)
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


class StudentBacklog(models.Model):
    """Previous-semester failed subject. Appears on hall ticket only after apply + fee approve."""

    STATUS_OPEN = 'open'           # recorded by admin; student has not applied
    STATUS_APPLIED = 'applied'     # student applied; awaiting / during fee payment
    STATUS_APPROVED = 'approved'   # fee approved — included on current-cycle hall ticket
    STATUS_CLEARED = 'cleared'     # passed / cleared
    STATUS_CHOICES = [
        (STATUS_OPEN, 'Open'),
        (STATUS_APPLIED, 'Applied'),
        (STATUS_APPROVED, 'Approved to write'),
        (STATUS_CLEARED, 'Cleared'),
    ]

    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='backlog_subjects')
    subject_code = models.CharField(max_length=50, db_index=True)
    subject_name = models.CharField(max_length=255)
    from_semester = models.IntegerField(default=1)
    exam_date = models.CharField(max_length=50, blank=True, default='')
    exam_time = models.CharField(max_length=50, blank=True, default='')
    duration = models.CharField(max_length=50, blank=True, default='3 hours')
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default=STATUS_OPEN, db_index=True,
    )
    is_cleared = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'student_backlogs'
        unique_together = [('student', 'subject_code')]
        indexes = [
            models.Index(fields=['student']),
            models.Index(fields=['subject_code']),
            models.Index(fields=['is_cleared']),
            models.Index(fields=['status']),
        ]

    def __str__(self):
        return f'{self.student_id}:{self.subject_code}'


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


class HOD(models.Model):
    """Head of Department — one active HOD per department (Indian college pattern)."""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='hod_profile')
    emp_id = models.CharField(max_length=50, unique=True, db_index=True)
    department = models.CharField(max_length=100, db_index=True)
    photo = models.URLField(max_length=512, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_deleted = models.BooleanField(default=False, db_index=True)

    class Meta:
        db_table = 'hods'
        indexes = [
            models.Index(fields=['emp_id']),
            models.Index(fields=['department']),
            models.Index(fields=['is_deleted']),
        ]


class Exam(models.Model):
    title = models.CharField(max_length=255, blank=True, default='')
    subject_code = models.CharField(max_length=50, unique=True, db_index=True)
    subject_name = models.CharField(max_length=255)
    department = models.CharField(max_length=100, db_index=True)
    semester = models.IntegerField()
    exam_date = models.CharField(max_length=50)
    exam_time = models.CharField(max_length=50)
    duration = models.CharField(max_length=50, default='3 hours')
    room = models.CharField(max_length=100)
    total_marks = models.IntegerField(default=100)
    fee_amount = models.FloatField(default=45000.0)
    requires_face_verification = models.BooleanField(default=True)
    invigilator = models.ForeignKey(
        'Teacher', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='invigilated_exams',
    )
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


class ExamSubject(models.Model):
    """Additional subjects on a single hall ticket / exam session."""
    exam = models.ForeignKey(Exam, on_delete=models.CASCADE, related_name='subjects')
    subject_code = models.CharField(max_length=50)
    subject_name = models.CharField(max_length=255)
    exam_date = models.CharField(max_length=50, blank=True, default='')
    exam_time = models.CharField(max_length=50, blank=True, default='')
    duration = models.CharField(max_length=50, blank=True, default='')
    sort_order = models.PositiveSmallIntegerField(default=0)
    invigilator = models.ForeignKey(
        'Teacher', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='invigilated_exam_subjects',
    )

    class Meta:
        db_table = 'exam_subjects'
        ordering = ['sort_order', 'id']
        unique_together = [('exam', 'subject_code')]
        indexes = [
            models.Index(fields=['exam']),
            models.Index(fields=['subject_code']),
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


class HallTicketSubject(models.Model):
    """Per-subject seat and hall assignment on a student's hall ticket."""
    hall_ticket = models.ForeignKey(
        HallTicket, on_delete=models.CASCADE, related_name='subject_assignments',
    )
    exam = models.ForeignKey(
        Exam, on_delete=models.CASCADE, related_name='hall_ticket_subject_assignments',
    )
    subject_code = models.CharField(max_length=50)
    subject_name = models.CharField(max_length=255)
    exam_date = models.CharField(max_length=50, blank=True, default='')
    exam_time = models.CharField(max_length=50, blank=True, default='')
    duration = models.CharField(max_length=50, blank=True, default='')
    seat_number = models.CharField(max_length=50)
    room = models.CharField(max_length=100)
    sort_order = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'hall_ticket_subjects'
        ordering = ['sort_order', 'id']
        unique_together = [('hall_ticket', 'subject_code')]
        indexes = [
            models.Index(fields=['hall_ticket']),
            models.Index(fields=['subject_code']),
            models.Index(fields=['exam', 'subject_code']),
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
        unique_together = [
            ('exam', 'student'),
            ('exam', 'room', 'seat_row', 'seat_column'),
        ]
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
    FEE_TYPE_CHOICES = [
        ('college', 'College Fee'),
        ('exam', 'Exam Fee'),
        ('backlog', 'Backlog Fee'),
    ]

    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='fee_payments')
    exam = models.ForeignKey(
        'Exam', on_delete=models.SET_NULL, blank=True, null=True, related_name='fee_payments'
    )
    backlog = models.ForeignKey(
        'StudentBacklog', on_delete=models.SET_NULL, blank=True, null=True, related_name='fee_payments'
    )
    fee_type = models.CharField(max_length=20, choices=FEE_TYPE_CHOICES, default='exam', db_index=True)
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
            models.Index(fields=['fee_type']),
            models.Index(fields=['exam']),
        ]


class ClassTimetable(models.Model):
    """Weekly class schedule slots for a teacher."""

    DAY_CHOICES = [
        (0, 'Monday'),
        (1, 'Tuesday'),
        (2, 'Wednesday'),
        (3, 'Thursday'),
        (4, 'Friday'),
        (5, 'Saturday'),
    ]

    teacher = models.ForeignKey(Teacher, on_delete=models.CASCADE, related_name='class_slots')
    subject_code = models.CharField(max_length=50, db_index=True)
    subject_name = models.CharField(max_length=255, blank=True, default='')
    day_of_week = models.PositiveSmallIntegerField(choices=DAY_CHOICES)  # 0=Mon … 5=Sat
    start_time = models.CharField(max_length=20)  # e.g. "09:00"
    end_time = models.CharField(max_length=20)    # e.g. "10:00"
    room = models.CharField(max_length=100, blank=True, default='')
    semester = models.PositiveSmallIntegerField(default=1)
    section = models.CharField(max_length=10, blank=True, default='A')
    department = models.CharField(max_length=100, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'class_timetable'
        ordering = ['day_of_week', 'start_time', 'id']
        indexes = [
            models.Index(fields=['teacher']),
            models.Index(fields=['day_of_week']),
            models.Index(fields=['subject_code']),
        ]

    def __str__(self):
        return f"{self.subject_code} D{self.day_of_week} {self.start_time}-{self.end_time}"


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
    college_logo_url = models.URLField(max_length=512, blank=True, default='')
    default_exam_fee = models.FloatField(default=45000.0)
    default_college_fee = models.FloatField(default=25000.0)
    default_backlog_fee = models.FloatField(default=1500.0)
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
