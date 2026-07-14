from .models import Exam, ExamSubject, Teacher, SeatingArrangement, SeatingRoom


def get_exam_subjects(exam):
    """Return all subjects for an exam (primary + related ExamSubject rows)."""
    rows = list(exam.subjects.all())
    if rows:
        return [
            {
                'subject_code': s.subject_code,
                'subject_name': s.subject_name,
                'exam_date': s.exam_date or exam.exam_date,
                'exam_time': s.exam_time or exam.exam_time,
                'duration': s.duration or exam.duration,
            }
            for s in rows
        ]
    return [{
        'subject_code': exam.subject_code,
        'subject_name': exam.subject_name,
        'exam_date': exam.exam_date,
        'exam_time': exam.exam_time,
        'duration': exam.duration,
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
            sort_order=idx,
        )


def resolve_invigilator(invigilator_id):
    if not invigilator_id:
        return None
    try:
        return Teacher.objects.get(id=invigilator_id, is_deleted=False)
    except Teacher.DoesNotExist:
        raise ValueError('Invigilator not found')


def exam_to_dict(exam):
    inv = exam.invigilator
    return {
        'id': exam.id,
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
        'invigilator_id': inv.id if inv else None,
        'invigilator_name': inv.user.name if inv else None,
        'subjects': get_exam_subjects(exam),
    }


def create_exam_record(validated_data, subjects=None):
    """Create exam with optional subjects and invigilator assignment."""
    data = dict(validated_data)
    invigilator_id = data.pop('invigilator_id', None)
    subjects_data = subjects if subjects is not None else data.pop('subjects', None)
    if 'room' in data:
        data['room'] = resolve_exam_room_label(data['room'])

    invigilator = resolve_invigilator(invigilator_id)
    exam = Exam.objects.create(**data, invigilator=invigilator)
    sync_exam_subjects(exam, subjects_data)
    return exam


def update_exam_record(exam, validated_data, subjects=None):
    """Update exam fields, subjects, and invigilator."""
    data = dict(validated_data)
    if 'invigilator_id' in data:
        inv_id = data.pop('invigilator_id')
        exam.invigilator = resolve_invigilator(inv_id) if inv_id else None
    if subjects is not None:
        sync_exam_subjects(exam, subjects)
    elif 'subjects' in data:
        sync_exam_subjects(exam, data.pop('subjects'))

    if 'room' in data:
        data['room'] = resolve_exam_room_label(data['room'])

    for field, value in data.items():
        setattr(exam, field, value)

    requires = exam.requires_face_verification
    if requires and not exam.invigilator_id:
        raise ValueError('An invigilator must be assigned when face verification is required.')
    exam.save()
    return exam
