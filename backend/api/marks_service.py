from .models import InternalMark
from .marks_constants import (
    INTERNAL_MARKS_MAX, ASSIGNMENT_MARKS_MAX, INTERNAL_ASSIGNMENT_TOTAL,
)


def update_student_marks(student, subject_code, internal_marks=None, assignment_marks=None):
    """Save internal/assignment marks and refresh eligibility."""
    internal = float(internal_marks if internal_marks is not None else student.internal_marks)
    assignment = float(assignment_marks if assignment_marks is not None else student.assignment_marks)
    internal = max(0.0, internal)
    assignment = max(0.0, assignment)

    if internal > INTERNAL_MARKS_MAX:
        raise ValueError(f'Internal marks cannot exceed {INTERNAL_MARKS_MAX}.')
    if assignment > ASSIGNMENT_MARKS_MAX:
        raise ValueError(f'Assignment marks cannot exceed {ASSIGNMENT_MARKS_MAX}.')
    if internal + assignment > INTERNAL_ASSIGNMENT_TOTAL:
        raise ValueError(
            f'Total marks ({internal + assignment}) cannot exceed {INTERNAL_ASSIGNMENT_TOTAL} '
            f'(internal {INTERNAL_MARKS_MAX} + assignment {ASSIGNMENT_MARKS_MAX}).'
        )

    if internal_marks is not None:
        student.internal_marks = internal
    if assignment_marks is not None:
        student.assignment_marks = assignment

    InternalMark.objects.update_or_create(
        student=student,
        subject_code=subject_code,
        defaults={
            'internal_score': student.internal_marks,
            'assignment_score': student.assignment_marks,
        },
    )
    from .attendance_service import refresh_student_eligibility
    refresh_student_eligibility(student)
    return student
