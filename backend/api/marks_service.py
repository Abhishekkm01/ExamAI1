from .models import InternalMark
from .attendance_service import parse_student_id, refresh_student_eligibility


def update_student_marks(student, subject_code, internal_marks=None, assignment_marks=None):
    """Save internal/assignment marks and refresh eligibility."""
    if internal_marks is not None:
        student.internal_marks = max(0.0, min(40.0, float(internal_marks)))
    if assignment_marks is not None:
        student.assignment_marks = max(0.0, min(10.0, float(assignment_marks)))

    InternalMark.objects.update_or_create(
        student=student,
        subject_code=subject_code,
        defaults={
            'internal_score': student.internal_marks,
            'assignment_score': student.assignment_marks,
        },
    )
    refresh_student_eligibility(student)
    return student
