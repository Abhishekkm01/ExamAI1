from .models import Exam, ExamSubject, Teacher, SeatingArrangement, SeatingRoom


def _subject_to_dict(subject, exam):
    inv = subject.invigilator
    return {
        'subject_code': subject.subject_code,
        'subject_name': subject.subject_name,
        'exam_date': subject.exam_date or exam.exam_date,
        'exam_time': subject.exam_time or exam.exam_time,
        'duration': subject.duration or exam.duration,
        'invigilator_id': inv.id if inv else None,
        'invigilator_name': inv.user.name if inv else None,
    }


def get_exam_subjects(exam):
    """Return all subjects for an exam (primary + related ExamSubject rows)."""
    rows = list(exam.subjects.select_related('invigilator__user').all())
    if rows:
        return [_subject_to_dict(s, exam) for s in rows]
    inv = exam.invigilator
    return [{
        'subject_code': exam.subject_code,
        'subject_name': exam.subject_name,
        'exam_date': exam.exam_date,
        'exam_time': exam.exam_time,
        'duration': exam.duration,
        'invigilator_id': inv.id if inv else None,
        'invigilator_name': inv.user.name if inv else None,
    }]


def subjects_subject_codes(subjects):
    return ','.join(s['subject_code'] for s in subjects)


def resolve_exam_room_label(value):
    """Map exam room input to a label from an active SeatingRoom."""
    value = (value or '').strip()
    if not value:
        raise ValueError('Exam hall/room is required. Create halls under Seating first.')
    for room in SeatingRoom.objects.filter(is_active=True):
        label = f"{room.room_name} ({room.room_code})"
        if value in (label, room.room_code, room.room_name):
            return label
    raise ValueError('Select a valid exam hall from halls created under Seating.')


def resolve_hall_ticket_exam(student, hall_ticket=None):
    """Pick the active exam whose subjects should appear on a hall ticket."""
    arrangements = SeatingArrangement.objects.filter(
        student=student,
    ).select_related('exam').order_by('-is_confirmed', '-exam_id')
    for arr in arrangements:
        if not arr.exam.is_deleted:
            return arr.exam

    if hall_ticket and hall_ticket.exam_id and not hall_ticket.exam.is_deleted:
        return hall_ticket.exam

    exam = Exam.objects.filter(
        department=student.department,
        semester=student.semester,
        is_deleted=False,
    ).order_by('-id').first()
    if exam:
        return exam

    return Exam.objects.filter(
        department=student.department,
        is_deleted=False,
    ).order_by('-id').first()


def resolve_invigilator(invigilator_id):
    if not invigilator_id:
        return None
    try:
        return Teacher.objects.get(id=invigilator_id, is_deleted=False)
    except Teacher.DoesNotExist:
        raise ValueError('Invigilator not found')


def _apply_legacy_invigilator(subjects_data, invigilator_id):
    """Copy exam-level invigilator_id onto subjects that lack one (backward compat)."""
    if not invigilator_id or not subjects_data:
        return subjects_data
    return [
        {**s, 'invigilator_id': s.get('invigilator_id') or invigilator_id}
        for s in subjects_data
    ]


def sync_exam_subjects(exam, subjects_data):
    """Replace exam subjects with the provided list."""
    exam.subjects.all().delete()
    if not subjects_data:
        ExamSubject.objects.create(
            exam=exam,
            subject_code=exam.subject_code,
            subject_name=exam.subject_name,
            exam_date=exam.exam_date,
            exam_time=exam.exam_time,
            duration=exam.duration,
            sort_order=0,
        )
        return

    for idx, subj in enumerate(subjects_data):
        ExamSubject.objects.create(
            exam=exam,
            subject_code=subj['subject_code'],
            subject_name=subj['subject_name'],
            exam_date=subj.get('exam_date') or exam.exam_date,
            exam_time=subj.get('exam_time') or exam.exam_time,
            duration=subj.get('duration') or exam.duration,
            invigilator=resolve_invigilator(subj.get('invigilator_id')),
            sort_order=idx,
        )


def validate_subject_invigilators(exam, requires_face_verification=None):
    """Ensure each subject has an invigilator when face verification is required."""
    requires = exam.requires_face_verification if requires_face_verification is None else requires_face_verification
    if not requires:
        return
    subjects = list(exam.subjects.all())
    if not subjects:
        raise ValueError('An invigilator must be assigned when face verification is required.')
    missing = [s.subject_code for s in subjects if not s.invigilator_id]
    if missing:
        raise ValueError(
            'An invigilator must be assigned for each subject when face verification is required. '
            f'Missing for: {", ".join(missing)}'
        )


def exam_to_dict(exam):
    subjects = get_exam_subjects(exam)
    primary = subjects[0] if subjects else {}
    return {
        'id': exam.id,
        'title': exam.title or exam.subject_name,
        'subject_code': exam.subject_code,
        'subject_name': exam.subject_name,
        'department': exam.department,
        'semester': exam.semester,
        'exam_date': exam.exam_date,
        'exam_time': exam.exam_time,
        'duration': exam.duration,
        'room': exam.room,
        'total_marks': exam.total_marks,
        'requires_face_verification': exam.requires_face_verification,
        'invigilator_id': primary.get('invigilator_id'),
        'invigilator_name': primary.get('invigilator_name'),
        'subjects': subjects,
    }


def create_exam_record(validated_data, subjects=None):
    """Create exam with optional subjects and per-subject invigilator assignment."""
    data = dict(validated_data)
    invigilator_id = data.pop('invigilator_id', None)
    subjects_data = subjects if subjects is not None else data.pop('subjects', None)
    subjects_data = _apply_legacy_invigilator(subjects_data, invigilator_id)
    if 'room' in data:
        data['room'] = resolve_exam_room_label(data['room'])

    exam = Exam.objects.create(**data)
    sync_exam_subjects(exam, subjects_data)
    validate_subject_invigilators(exam)
    return exam


def update_exam_record(exam, validated_data, subjects=None):
    """Update exam fields, subjects, and per-subject invigilators."""
    data = dict(validated_data)
    invigilator_id = data.pop('invigilator_id', None)
    if subjects is not None:
        subjects = _apply_legacy_invigilator(subjects, invigilator_id)
        sync_exam_subjects(exam, subjects)
    elif 'subjects' in data:
        subjects_data = _apply_legacy_invigilator(data.pop('subjects'), invigilator_id)
        sync_exam_subjects(exam, subjects_data)

    if 'room' in data:
        data['room'] = resolve_exam_room_label(data['room'])

    for field, value in data.items():
        setattr(exam, field, value)

    validate_subject_invigilators(exam)
    exam.save()
    return exam
