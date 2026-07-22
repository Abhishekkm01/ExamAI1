from django.db.models import Avg, Q
from .models import InternalMark, Attendance, ExamSubject, Exam
from .marks_constants import (
    INTERNAL_MARKS_MAX, ASSIGNMENT_MARKS_MAX, INTERNAL_ASSIGNMENT_TOTAL,
)


def normalize_subject_code(subject_code):
    return (subject_code or '').strip().upper()


def _subject_name_map(subject_codes):
    """Resolve subject codes to display names (case-insensitive)."""
    names = {}
    if not subject_codes:
        return names

    code_set = {normalize_subject_code(c) for c in subject_codes if c}
    q = Q()
    for code in code_set:
        q |= Q(subject_code__iexact=code)

    for row in ExamSubject.objects.filter(q).values('subject_code', 'subject_name'):
        names.setdefault(normalize_subject_code(row['subject_code']), row['subject_name'])

    missing = [c for c in code_set if c not in names]
    if missing:
        q2 = Q()
        for code in missing:
            q2 |= Q(subject_code__iexact=code)
        for row in Exam.objects.filter(q2, is_deleted=False).values('subject_code', 'subject_name'):
            names.setdefault(normalize_subject_code(row['subject_code']), row['subject_name'])
    return names


def refresh_student_aggregate_marks(student):
    """Set student.internal_marks / assignment_marks from per-subject InternalMark averages."""
    agg = InternalMark.objects.filter(student=student).aggregate(
        avg_internal=Avg('internal_score'),
        avg_assignment=Avg('assignment_score'),
    )
    student.internal_marks = round(float(agg['avg_internal'] or 0.0), 2)
    student.assignment_marks = round(float(agg['avg_assignment'] or 0.0), 2)
    student.save(update_fields=['internal_marks', 'assignment_marks', 'updated_at'])
    return student


def get_student_subject_performance(student):
    """Return real per-subject internal/assignment/attendance for charts."""
    marks = list(InternalMark.objects.filter(student=student).order_by('subject_code'))

    # Collapse case variants of the same subject into one row (prefer latest updated).
    marks_by_code = {}
    for m in marks:
        code = normalize_subject_code(m.subject_code)
        if not code:
            continue
        prev = marks_by_code.get(code)
        if prev is None or (m.updated_at and prev.updated_at and m.updated_at >= prev.updated_at):
            marks_by_code[code] = m

    codes = list(marks_by_code.keys())

    # Include subjects that only have attendance rows
    attendance_codes = (
        Attendance.objects.filter(student=student)
        .values_list('subject_code', flat=True)
        .distinct()
    )
    for raw in attendance_codes:
        code = normalize_subject_code(raw)
        if code and code not in codes:
            codes.append(code)

    # Include all exam subjects for this student's department + semester
    exam_qs = Exam.objects.filter(
        department=student.department,
        semester=student.semester,
        is_deleted=False,
    )
    for exam in exam_qs:
        code = normalize_subject_code(exam.subject_code)
        if code and code not in codes:
            codes.append(code)
        for sub in ExamSubject.objects.filter(exam=exam).values_list('subject_code', flat=True):
            sc = normalize_subject_code(sub)
            if sc and sc not in codes:
                codes.append(sc)

    names = _subject_name_map(codes)
    codes.sort()

    rows = []
    for code in codes:
        mark = marks_by_code.get(code)
        total = Attendance.objects.filter(student=student, subject_code__iexact=code).count()
        present = Attendance.objects.filter(
            student=student, subject_code__iexact=code, status__iexact='present'
        ).count()
        attendance_pct = round((present / total) * 100, 1) if total else None
        rows.append({
            'subject_code': code,
            'subject_name': names.get(code) or code,
            'internal_marks': float(mark.internal_score) if mark else 0.0,
            'assignment_marks': float(mark.assignment_score) if mark else 0.0,
            'attendance': attendance_pct,
            'has_marks': mark is not None,
            'has_attendance': total > 0,
        })
    return rows


def update_student_marks(student, subject_code, internal_marks=None, assignment_marks=None):
    """Save internal/assignment marks for one subject and refresh aggregates + eligibility."""
    subject_code = normalize_subject_code(subject_code)
    if not subject_code:
        raise ValueError('Subject code is required.')

    existing = InternalMark.objects.filter(
        student=student, subject_code__iexact=subject_code
    ).order_by('-updated_at').first()

    internal = float(
        internal_marks if internal_marks is not None
        else (existing.internal_score if existing else 0.0)
    )
    assignment = float(
        assignment_marks if assignment_marks is not None
        else (existing.assignment_score if existing else 0.0)
    )
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

    if existing:
        # Normalize stored code and drop any duplicate case variants.
        InternalMark.objects.filter(
            student=student, subject_code__iexact=subject_code
        ).exclude(pk=existing.pk).delete()
        existing.subject_code = subject_code
        existing.internal_score = internal
        existing.assignment_score = assignment
        existing.save(update_fields=['subject_code', 'internal_score', 'assignment_score', 'updated_at'])
    else:
        InternalMark.objects.create(
            student=student,
            subject_code=subject_code,
            internal_score=internal,
            assignment_score=assignment,
        )

    refresh_student_aggregate_marks(student)
    from .attendance_service import refresh_student_eligibility
    refresh_student_eligibility(student)
    return student
