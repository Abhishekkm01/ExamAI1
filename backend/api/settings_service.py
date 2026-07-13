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
        'attendance_threshold': obj.attendance_threshold,
        'internal_marks_threshold': obj.internal_marks_threshold,
        'min_sgpa': obj.min_sgpa,
        'ml_model': obj.ml_model,
        'updated_at': obj.updated_at.isoformat() if obj.updated_at else None,
    }


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
        and student.backlogs == 0
        and student.fee_paid
        and student.previous_result >= cfg.min_sgpa
    )
