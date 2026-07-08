from .models import SystemSettings, Student


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
