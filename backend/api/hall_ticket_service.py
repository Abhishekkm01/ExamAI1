import json
import re

from .models import HallTicketSubject
from .exam_service import get_exam_subjects, subjects_subject_codes


class SeatConflictError(Exception):
    def __init__(self, message, conflicts=None):
        super().__init__(message)
        self.conflicts = conflicts or []


def build_hall_ticket_qr(hall_ticket, exam, student, subjects=None):
    """Build signed JSON QR payload with all subject hall/seat details."""
    subjects = subjects or merge_hall_ticket_subjects(hall_ticket, exam)
    payload = {
        'v': 1,
        'htNo': hall_ticket.hall_ticket_no,
        'rollNo': student.roll_no,
        'name': student.user.name,
        'department': student.department,
        'examId': exam.id,
        'examName': exam.subject_name,
        'subjects': [
            {
                'subjectCode': s['subject_code'],
                'subjectName': s.get('subject_name', s['subject_code']),
                'examDate': s.get('exam_date', exam.exam_date),
                'examTime': s.get('exam_time', exam.exam_time),
                'duration': s.get('duration', exam.duration),
                'room': s['room'],
                'seatNumber': s['seat_number'],
            }
            for s in subjects
        ],
    }
    if subjects:
        payload['room'] = subjects[0]['room']
        payload['seatNumber'] = subjects[0]['seat_number']
    return json.dumps(payload, separators=(',', ':'), sort_keys=True)


def parse_qr_content(content):
    """Parse JSON or legacy pipe-format QR content."""
    content = (content or '').strip()
    if not content:
        return None
    if content.startswith('{'):
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            return None
    parts = {}
    for segment in content.split('|'):
        if ':' in segment:
            key, value = segment.split(':', 1)
            parts[key.strip()] = value.strip()
    ht_no = parts.get('HT')
    if not ht_no:
        return None
    return {
        'v': 0,
        'htNo': ht_no,
        'rollNo': parts.get('Roll'),
        'legacy': True,
        'raw': content,
    }


def extract_ht_no(content):
    """Extract hall ticket number from QR content or plain entry."""
    parsed = parse_qr_content(content)
    if parsed and parsed.get('htNo'):
        return parsed['htNo'].strip().upper()
    trimmed = (content or '').strip().upper()
    if trimmed.startswith('HT'):
        return trimmed
    return None


def qr_content_matches(stored, scanned):
    """Return True when scanned QR matches the official stored content."""
    if not stored or not scanned:
        return False
    stored = stored.strip()
    scanned = scanned.strip()
    if stored == scanned:
        return True
    stored_data = parse_qr_content(stored)
    scanned_data = parse_qr_content(scanned)
    if not stored_data or not scanned_data:
        return False
    if stored_data.get('htNo', '').upper() != scanned_data.get('htNo', '').upper():
        return False
    if stored_data.get('rollNo', '').upper() != scanned_data.get('rollNo', '').upper():
        return False
    return stored_data.get('v') == 1 and scanned_data.get('v') == 1


def build_verify_response(hall_ticket, exam, *, qr_matched=False, method='manual'):
    """Standard verification payload for public QR / manual lookup."""
    subjects = merge_hall_ticket_subjects(hall_ticket, exam)
    primary = subjects[0] if subjects else {}
    return {
        'valid': True,
        'verified': qr_matched,
        'verification_method': method,
        'student': {
            'name': hall_ticket.student.user.name,
            'roll_no': hall_ticket.student.roll_no,
            'department': hall_ticket.student.department,
            'photo': hall_ticket.student.photo,
        },
        'hall_ticket_no': hall_ticket.hall_ticket_no,
        'exam': exam.subject_name,
        'subject_code': exam.subject_code,
        'date': primary.get('exam_date', exam.exam_date),
        'time': primary.get('exam_time', exam.exam_time),
        'duration': primary.get('duration', exam.duration),
        'room': primary.get('room', hall_ticket.room),
        'seat_number': primary.get('seat_number', hall_ticket.seat_number),
        'subjects': [
            {
                'subject_code': s['subject_code'],
                'subject_name': s.get('subject_name', s['subject_code']),
                'exam_date': s.get('exam_date', exam.exam_date),
                'exam_time': s.get('exam_time', exam.exam_time),
                'duration': s.get('duration', exam.duration),
                'room': s['room'],
                'seat_number': s['seat_number'],
            }
            for s in subjects
        ],
    }


def verify_hall_ticket_record(hall_ticket, exam, scanned_content=None):
    """
    Verify hall ticket against DB. When scanned_content is provided,
    ensure it matches the official qr_code_content (anti-tamper).
    """
    student = hall_ticket.student
    if student.is_deleted or not student.is_eligible:
        return {'valid': False, 'detail': 'Student is not eligible for examination'}

    if not hall_ticket.qr_code_content or not hall_ticket.qr_code_content.startswith('{'):
        refresh_hall_ticket_qr(hall_ticket, exam, student)

    if scanned_content:
        if not qr_content_matches(hall_ticket.qr_code_content, scanned_content):
            return {
                'valid': False,
                'detail': 'QR code does not match official hall ticket record',
            }
        return build_verify_response(hall_ticket, exam, qr_matched=True, method='qr_scan')

    return build_verify_response(hall_ticket, exam, qr_matched=True, method='manual')


def normalize_room(room):
    return re.sub(r'\s+', ' ', (room or '').strip().lower())


def normalize_seat(seat):
    return (seat or '').strip().upper()


def normalize_date(value):
    return re.sub(r'\s+', '', (value or '').strip())


def normalize_time(value):
    return re.sub(r'[\s.:]+', '', (value or '').strip().upper())


def slot_matches(row_date, row_time, target_date, target_time):
    return (
        normalize_date(row_date) == normalize_date(target_date)
        and normalize_time(row_time) == normalize_time(target_time)
    )


def get_occupied_seats(exam_id, subject_code, exam_date, exam_time, room, exclude_hall_ticket_id=None):
    """
    Seats already taken in a hall for the same exam, subject, date and time slot.
    """
    qs = HallTicketSubject.objects.filter(
        exam_id=exam_id,
        subject_code=subject_code,
        hall_ticket__is_active=True,
    ).select_related('hall_ticket__student__user')
    if exclude_hall_ticket_id:
        qs = qs.exclude(hall_ticket_id=exclude_hall_ticket_id)

    target_room = normalize_room(room)
    occupied = {}
    for row in qs:
        if normalize_room(row.room) != target_room:
            continue
        if not slot_matches(row.exam_date, row.exam_time, exam_date, exam_time):
            continue
        key = normalize_seat(row.seat_number)
        occupied[key] = {
            'student_name': row.hall_ticket.student.user.name,
            'roll_no': row.hall_ticket.student.roll_no,
            'hall_ticket_id': row.hall_ticket_id,
            'seat_number': row.seat_number,
            'room': row.room,
            'exam_date': row.exam_date,
            'exam_time': row.exam_time,
        }
    return occupied


def find_available_seat(room, occupied_keys):
    """Return the next free seat label in a hall."""
    occupied = {normalize_seat(k) for k in occupied_keys}
    for row_letter in 'ABCDEFGHIJKLMNOPQRSTUVWXYZ':
        for num in range(1, 100):
            seat = f"{row_letter}{num}"
            if seat not in occupied:
                return seat
    return f"S{len(occupied) + 1}"


def find_seat_conflict(exam_id, hall_ticket_id, subject_code, exam_date, exam_time, room, seat_number):
    """Return occupant info if this seat is already taken by another student."""
    if not seat_number or not room:
        return None
    occupied = get_occupied_seats(
        exam_id, subject_code, exam_date, exam_time, room,
        exclude_hall_ticket_id=hall_ticket_id,
    )
    return occupied.get(normalize_seat(seat_number))


def build_proposed_subjects(hall_ticket, exam, subjects_data):
    """Merge current subject rows with incoming edits."""
    current = merge_hall_ticket_subjects(hall_ticket, exam)
    by_code = {s['subject_code']: dict(s) for s in current}
    proposed = []
    for item in subjects_data:
        code = item.get('subject_code')
        if not code:
            continue
        base = by_code.get(code, {})
        proposed.append({
            'subject_code': code,
            'subject_name': base.get('subject_name', code),
            'exam_date': base.get('exam_date') or exam.exam_date,
            'exam_time': base.get('exam_time') or exam.exam_time,
            'duration': base.get('duration', ''),
            'seat_number': str(item.get('seat_number', base.get('seat_number', ''))).strip(),
            'room': str(item.get('room', base.get('room', ''))).strip(),
        })
    return proposed


def validate_subject_seats(hall_ticket, exam, subjects_data, auto_resolve=False):
    """
    Ensure no two students share the same hall + seat for the same exam, subject,
    date and time slot.
    """
    proposed = build_proposed_subjects(hall_ticket, exam, subjects_data)
    conflicts = []
    resolved = []

    for p in proposed:
        occupant = find_seat_conflict(
            exam.id,
            hall_ticket.id,
            p['subject_code'],
            p['exam_date'],
            p['exam_time'],
            p['room'],
            p['seat_number'],
        )
        if occupant:
            occupied = get_occupied_seats(
                exam.id,
                p['subject_code'],
                p['exam_date'],
                p['exam_time'],
                p['room'],
                exclude_hall_ticket_id=hall_ticket.id,
            )
            suggested = find_available_seat(p['room'], occupied.keys())
            entry = {
                'subject_code': p['subject_code'],
                'subject_name': p['subject_name'],
                'exam_date': p['exam_date'],
                'exam_time': p['exam_time'],
                'room': p['room'],
                'seat_number': p['seat_number'],
                'assigned_to': occupant['student_name'],
                'assigned_roll_no': occupant['roll_no'],
                'suggested_seat': suggested,
            }
            conflicts.append(entry)
            if auto_resolve:
                p['seat_number'] = suggested
                occupied[normalize_seat(suggested)] = {'placeholder': True}
                resolved.append({**entry, 'seat_number': suggested})

    if conflicts and not auto_resolve:
        first = conflicts[0]
        raise SeatConflictError(
            f"Seat {first['seat_number']} in {first['room']} is already assigned to "
            f"{first['assigned_to']} for exam subject {first['subject_code']} on "
            f"{first['exam_date']} at {first['exam_time']}. Try seat {first['suggested_seat']} instead.",
            conflicts=conflicts,
        )

    return proposed, resolved


def merge_hall_ticket_subjects(hall_ticket, exam):
    """Return exam subjects enriched with per-subject seat and hall."""
    exam_subjects = get_exam_subjects(exam)
    overrides = {
        row.subject_code: row
        for row in hall_ticket.subject_assignments.all()
    }
    merged = []
    for subj in exam_subjects:
        row = overrides.get(subj['subject_code'])
        merged.append({
            **subj,
            'seat_number': row.seat_number if row else hall_ticket.seat_number,
            'room': row.room if row else hall_ticket.room,
        })
    return merged


def sync_hall_ticket_subjects(hall_ticket, exam, default_seat=None, default_room=None):
    """Ensure HallTicketSubject rows exist for every exam subject."""
    seat = default_seat or hall_ticket.seat_number
    room = default_room or hall_ticket.room
    exam_subjects = get_exam_subjects(exam)
    existing = {row.subject_code: row for row in hall_ticket.subject_assignments.all()}
    codes = set()

    if hall_ticket.exam_id != exam.id:
        hall_ticket.exam = exam
        hall_ticket.save(update_fields=['exam', 'updated_at'])

    for idx, subj in enumerate(exam_subjects):
        code = subj['subject_code']
        codes.add(code)
        exam_date = subj.get('exam_date') or exam.exam_date
        exam_time = subj.get('exam_time') or exam.exam_time
        assigned_seat = assign_available_seat(
            exam.id, hall_ticket, code, exam_date, exam_time, room, seat,
        )
        if code in existing:
            row = existing[code]
            row.exam = exam
            row.subject_name = subj['subject_name']
            row.exam_date = exam_date
            row.exam_time = exam_time
            row.duration = subj.get('duration', '')
            row.sort_order = idx
            preferred = row.seat_number or assigned_seat
            row.seat_number = assign_available_seat(
                exam.id, hall_ticket, code, exam_date, exam_time, row.room or room, preferred,
            )
            if not row.room:
                row.room = room
            row.save()
        else:
            HallTicketSubject.objects.create(
                hall_ticket=hall_ticket,
                exam=exam,
                subject_code=code,
                subject_name=subj['subject_name'],
                exam_date=exam_date,
                exam_time=exam_time,
                duration=subj.get('duration', ''),
                seat_number=assigned_seat,
                room=room,
                sort_order=idx,
            )

    hall_ticket.subject_assignments.exclude(subject_code__in=codes).delete()
    return merge_hall_ticket_subjects(hall_ticket, exam)


def assign_available_seat(exam_id, hall_ticket, subject_code, exam_date, exam_time, room, preferred_seat):
    """Pick preferred seat when free, otherwise the next available seat in the hall."""
    occupied = get_occupied_seats(
        exam_id, subject_code, exam_date, exam_time, room,
        exclude_hall_ticket_id=hall_ticket.id,
    )
    preferred = normalize_seat(preferred_seat)
    if preferred and preferred not in occupied:
        return preferred_seat.strip()
    return find_available_seat(room, occupied.keys())


def update_hall_ticket_subjects(hall_ticket, exam, subjects_data, auto_resolve=False):
    """Apply admin edits to per-subject seat and hall with conflict checking."""
    sync_hall_ticket_subjects(hall_ticket, exam)
    proposed, resolved = validate_subject_seats(
        hall_ticket, exam, subjects_data, auto_resolve=auto_resolve,
    )
    by_code = {row.subject_code: row for row in hall_ticket.subject_assignments.all()}

    for item in proposed:
        code = item['subject_code']
        if code not in by_code:
            continue
        row = by_code[code]
        row.exam = exam
        row.exam_date = item.get('exam_date') or row.exam_date
        row.exam_time = item.get('exam_time') or row.exam_time
        row.seat_number = item['seat_number']
        row.room = item['room']
        row.save()

    if proposed:
        hall_ticket.seat_number = proposed[0]['seat_number']
        hall_ticket.room = proposed[0]['room']
        hall_ticket.exam = exam
        hall_ticket.save(update_fields=['seat_number', 'room', 'exam', 'updated_at'])

    return merge_hall_ticket_subjects(hall_ticket, exam), resolved


def refresh_hall_ticket_qr(hall_ticket, exam, student):
    """Rebuild QR content after subject seat/hall changes."""
    subjects = merge_hall_ticket_subjects(hall_ticket, exam)
    if subjects:
        hall_ticket.seat_number = subjects[0]['seat_number']
        hall_ticket.room = subjects[0]['room']
    hall_ticket.qr_code_content = build_hall_ticket_qr(hall_ticket, exam, student, subjects)
    hall_ticket.save(update_fields=['qr_code_content', 'seat_number', 'room', 'updated_at'])
    return subjects


def detect_ticket_seat_conflicts(hall_ticket, exam):
    """Return conflict entries for an existing hall ticket (read-only check)."""
    subjects = merge_hall_ticket_subjects(hall_ticket, exam)
    conflicts = []
    for subj in subjects:
        occupant = find_seat_conflict(
            exam.id,
            hall_ticket.id,
            subj['subject_code'],
            subj.get('exam_date', exam.exam_date),
            subj.get('exam_time', exam.exam_time),
            subj['room'],
            subj['seat_number'],
        )
        if occupant:
            occupied = get_occupied_seats(
                exam.id,
                subj['subject_code'],
                subj.get('exam_date', exam.exam_date),
                subj.get('exam_time', exam.exam_time),
                subj['room'],
                exclude_hall_ticket_id=hall_ticket.id,
            )
            conflicts.append({
                'subject_code': subj['subject_code'],
                'subject_name': subj.get('subject_name', subj['subject_code']),
                'exam_date': subj.get('exam_date', exam.exam_date),
                'exam_time': subj.get('exam_time', exam.exam_time),
                'seat_number': subj['seat_number'],
                'room': subj['room'],
                'assigned_to': occupant['student_name'],
                'assigned_roll_no': occupant['roll_no'],
                'suggested_seat': find_available_seat(subj['room'], occupied.keys()),
            })
    return conflicts
