from .models import SystemSettings, Student
from .marks_constants import INTERNAL_MARKS_MAX


def get_system_settings():
    return SystemSettings.load()


def settings_to_dict(obj=None):
    if obj is None:
        obj = get_system_settings()
    return {
        'university_name': obj.university_name,
        'academic_year': obj.academic_year,
        'current_semester': obj.current_semester,
        'contact_email': obj.contact_email,
        'college_logo_url': obj.college_logo_url or '',
        'default_exam_fee': float(obj.default_exam_fee or 45000),
        'default_college_fee': float(getattr(obj, 'default_college_fee', None) or 25000),
        'default_backlog_fee': float(getattr(obj, 'default_backlog_fee', None) or 1500),
        'attendance_threshold': obj.attendance_threshold,
        'internal_marks_threshold': obj.internal_marks_threshold,
        'min_sgpa': obj.min_sgpa,
        'ml_model': obj.ml_model,
        'updated_at': obj.updated_at.isoformat() if obj.updated_at else None,
    }


def get_default_exam_fee():
    return float(get_system_settings().default_exam_fee or 45000)


def get_default_college_fee():
    return float(getattr(get_system_settings(), 'default_college_fee', None) or 25000)


def get_default_backlog_fee():
    return float(getattr(get_system_settings(), 'default_backlog_fee', None) or 1500)


def ensure_default_settings():
    return SystemSettings.load()


def refresh_all_eligibility():
    from .attendance_service import refresh_student_eligibility

    count = 0
    for student in Student.objects.filter(is_deleted=False):
        refresh_student_eligibility(student)
        count += 1
    return count


def passes_eligibility(student, cfg=None):
    """Return True when a student meets configured eligibility criteria."""
    if cfg is None:
        cfg = get_system_settings()
    internal_pct = (student.internal_marks / INTERNAL_MARKS_MAX) * 100
    return (
        student.attendance_percentage >= cfg.attendance_threshold
        and internal_pct >= cfg.internal_marks_threshold
        and student.fee_paid
    )
