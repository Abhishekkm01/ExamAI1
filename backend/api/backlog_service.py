from .models import Student, StudentBacklog
from .settings_service import get_default_backlog_fee


def backlog_to_dict(row, fee_amount=None):
    if fee_amount is None:
        fee_amount = get_default_backlog_fee()
    return {
        'id': row.id,
        'subject_code': row.subject_code,
        'subject_name': row.subject_name,
        'from_semester': row.from_semester,
        'exam_date': row.exam_date or '',
        'exam_time': row.exam_time or '',
        'duration': row.duration or '3 hours',
        'status': getattr(row, 'status', None) or (
            StudentBacklog.STATUS_CLEARED if row.is_cleared else StudentBacklog.STATUS_OPEN
        ),
        'is_cleared': row.is_cleared,
        'fee_amount': float(fee_amount),
        'on_hall_ticket': (getattr(row, 'status', None) == StudentBacklog.STATUS_APPROVED),
    }


def active_backlogs_for_student(student):
    """Uncleared backlog papers (any registration status)."""
    return list(
        StudentBacklog.objects.filter(student=student, is_cleared=False)
        .exclude(status=StudentBacklog.STATUS_CLEARED)
        .order_by('from_semester', 'subject_code')
    )


def approved_backlogs_for_student(student):
    """Papers approved to write in the current exam cycle (hall ticket)."""
    return list(
        StudentBacklog.objects.filter(
            student=student,
            is_cleared=False,
            status=StudentBacklog.STATUS_APPROVED,
        ).order_by('from_semester', 'subject_code')
    )


def sync_student_backlog_count(student):
    count = StudentBacklog.objects.filter(student=student, is_cleared=False).exclude(
        status=StudentBacklog.STATUS_CLEARED
    ).count()
    if student.backlogs != count:
        student.backlogs = count
        student.save(update_fields=['backlogs', 'updated_at'])
    return count


def backlog_subjects_for_hall_ticket(student, exam):
    """Only fee-approved backlog papers appear on the hall ticket."""
    rows = []
    for b in approved_backlogs_for_student(student):
        rows.append({
            'subject_code': b.subject_code,
            'subject_name': f"{b.subject_name} (Backlog · Sem {b.from_semester})",
            'exam_date': b.exam_date or exam.exam_date,
            'exam_time': b.exam_time or exam.exam_time,
            'duration': b.duration or exam.duration,
            'invigilator_id': None,
            'invigilator_name': None,
            'is_backlog': True,
            'from_semester': b.from_semester,
        })
    return rows


def list_student_backlogs(student):
    fee = get_default_backlog_fee()
    return [
        backlog_to_dict(b, fee)
        for b in StudentBacklog.objects.filter(student=student).order_by(
            'is_cleared', 'from_semester', 'subject_code'
        )
    ]


def upsert_backlog(student, data):
    code = (data.get('subject_code') or '').strip().upper()
    name = (data.get('subject_name') or '').strip()
    if not code or not name:
        return None, 'Subject code and name are required'
    from_sem = int(data.get('from_semester') or max(1, (student.semester or 1) - 1))
    is_cleared = bool(data.get('is_cleared', False))
    defaults = {
        'subject_name': name,
        'from_semester': from_sem,
        'exam_date': (data.get('exam_date') or '').strip(),
        'exam_time': (data.get('exam_time') or '').strip(),
        'duration': (data.get('duration') or '3 hours').strip() or '3 hours',
        'is_cleared': is_cleared,
    }
    if is_cleared:
        defaults['status'] = StudentBacklog.STATUS_CLEARED
    existing = StudentBacklog.objects.filter(student=student, subject_code=code).first()
    if existing:
        # Do not reset apply/approve progress when admin edits schedule fields
        for k, v in defaults.items():
            setattr(existing, k, v)
        if is_cleared:
            existing.status = StudentBacklog.STATUS_CLEARED
        elif existing.status == StudentBacklog.STATUS_CLEARED and not is_cleared:
            existing.status = StudentBacklog.STATUS_OPEN
        existing.save()
        sync_student_backlog_count(student)
        return existing, None

    defaults['status'] = StudentBacklog.STATUS_CLEARED if is_cleared else StudentBacklog.STATUS_OPEN
    row = StudentBacklog.objects.create(student=student, subject_code=code, **defaults)
    sync_student_backlog_count(student)
    return row, None


def apply_backlog(student, backlog_id):
    """Student applies to write this backlog in the current exam cycle."""
    try:
        row = StudentBacklog.objects.get(id=backlog_id, student=student)
    except StudentBacklog.DoesNotExist:
        return None, 'Backlog subject not found'
    if row.is_cleared or row.status == StudentBacklog.STATUS_CLEARED:
        return None, 'This backlog is already cleared'
    if row.status == StudentBacklog.STATUS_APPROVED:
        return None, 'Already approved to write — check your hall ticket'
    if row.status == StudentBacklog.STATUS_APPLIED:
        return row, None  # idempotent
    row.status = StudentBacklog.STATUS_APPLIED
    row.save(update_fields=['status', 'updated_at'])
    return row, None


def delete_backlog(student, backlog_id):
    try:
        row = StudentBacklog.objects.get(id=backlog_id, student=student)
    except StudentBacklog.DoesNotExist:
        return 'Backlog subject not found'
    row.delete()
    sync_student_backlog_count(student)
    return None


def clear_backlog(student, backlog_id, cleared=True):
    try:
        row = StudentBacklog.objects.get(id=backlog_id, student=student)
    except StudentBacklog.DoesNotExist:
        return None, 'Backlog subject not found'
    row.is_cleared = cleared
    row.status = StudentBacklog.STATUS_CLEARED if cleared else StudentBacklog.STATUS_OPEN
    row.save(update_fields=['is_cleared', 'status', 'updated_at'])
    sync_student_backlog_count(student)
    return row, None
