"""
Seed ~15 rows of realistic sample data into every major ExamShield table.

Usage (from backend/):
  python manage.py dummy_data
  python manage.py dummy_data --clear   # remove previous seed rows first

All seeded accounts use password: dummy123
"""
from datetime import date, timedelta

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from api.auth_utils import get_password_hash
from api.department_service import DEFAULT_DEPARTMENTS, ensure_default_departments
from api.hall_ticket_service import sync_hall_ticket_subjects, refresh_hall_ticket_qr
from api.marks_service import refresh_student_aggregate_marks
from api.settings_service import ensure_default_settings
from api.marks_constants import INTERNAL_MARKS_MAX
from api.models import (
    Attendance,
    AudienceEnum,
    ChatbotLog,
    EligibilityPrediction,
    Exam,
    ExamSubject,
    FeePayment,
    HallTicket,
    HallTicketSubject,
    HOD,
    InternalMark,
    Notification,
    RoleEnum,
    SeatingArrangement,
    SeatingRoom,
    Student,
    Teacher,
    User,
)

COUNT = 15  # rows for exams, rooms, teachers, etc.
STUDENTS_PER_DEPT = 15
DUMMY_PASSWORD = 'dummy123'

FIRST_NAMES = [
    'Aarav', 'Diya', 'Rohan', 'Ananya', 'Vikram', 'Ishita', 'Karan', 'Meera',
    'Aditya', 'Sneha', 'Rahul', 'Priya', 'Arjun', 'Neha', 'Siddharth',
    'Kabir', 'Aisha', 'Dev', 'Kavya', 'Nikhil', 'Riya', 'Yash', 'Pooja',
    'Harsh', 'Tanvi', 'Aryan', 'Nisha', 'Manav', 'Shruti', 'Varun',
]
LAST_NAMES = [
    'Sharma', 'Patel', 'Reddy', 'Nair', 'Singh', 'Gupta', 'Iyer', 'Khan',
    'Joshi', 'Das', 'Mehta', 'Rao', 'Verma', 'Pillai', 'Chopra',
    'Malhotra', 'Banerjee', 'Desai', 'Kulkarni', 'Saxena', 'Agarwal', 'Bose',
    'Menon', 'Kapoor', 'Trivedi', 'Chatterjee', 'Shetty', 'Bhat', 'Pandey', 'Ghosh',
]


def _student_name(index):
    """Unique full name for each seeded student (no cross-department repeats)."""
    first = FIRST_NAMES[index % len(FIRST_NAMES)]
    last = LAST_NAMES[(index // len(FIRST_NAMES)) % len(LAST_NAMES)]
    return f'{first} {last}'


def _teacher_name(index):
    first = FIRST_NAMES[(index * 3 + 5) % len(FIRST_NAMES)]
    last = LAST_NAMES[(index * 5 + 2) % len(LAST_NAMES)]
    return f'Prof. {first} {last}'


def _hod_name(index):
    first = FIRST_NAMES[(index * 4 + 11) % len(FIRST_NAMES)]
    last = LAST_NAMES[(index * 6 + 8) % len(LAST_NAMES)]
    return f'Dr. {first} {last}'


def _dept(i):
    return DEFAULT_DEPARTMENTS[i % len(DEFAULT_DEPARTMENTS)]


# 6 subjects per department → one End-Semester Examination each
DEPT_SUBJECTS = {
    'COMPUTER SCIENCE': [
        ('CS301', 'Data Structures'),
        ('CS302', 'Database Management Systems'),
        ('CS303', 'Operating Systems'),
        ('CS304', 'Design and Analysis of Algorithms'),
        ('CS305', 'Computer Networks'),
        ('CS306', 'Software Engineering'),
    ],
    'ELECTRONICS': [
        ('EC301', 'Digital Electronics'),
        ('EC302', 'Signals and Systems'),
        ('EC303', 'Microprocessors'),
        ('EC304', 'Analog Communication'),
        ('EC305', 'Control Systems'),
        ('EC306', 'VLSI Design'),
    ],
    'CIVIL': [
        ('CV301', 'Structural Analysis'),
        ('CV302', 'Surveying and Geomatics'),
        ('CV303', 'Geotechnical Engineering'),
        ('CV304', 'Transportation Engineering'),
        ('CV305', 'Environmental Engineering'),
        ('CV306', 'Concrete Technology'),
    ],
    'MCA': [
        ('MCA301', 'Object Oriented Programming with Java'),
        ('MCA302', 'Web Technologies'),
        ('MCA303', 'Database Systems'),
        ('MCA304', 'Software Engineering'),
        ('MCA305', 'Computer Networks'),
        ('MCA306', 'Cloud Computing'),
    ],
    'MBA': [
        ('MBA301', 'Marketing Management'),
        ('MBA302', 'Financial Management'),
        ('MBA303', 'Human Resource Management'),
        ('MBA304', 'Operations Management'),
        ('MBA305', 'Business Analytics'),
        ('MBA306', 'Strategic Management'),
    ],
}

# Flat list for marks / attendance / clear helpers: (code, name, department)
SUBJECTS = [
    (code, name, dept)
    for dept, papers in DEPT_SUBJECTS.items()
    for code, name in papers
]

# Realistic examination halls
HALLS = [
    ('A-101', 'Lecture Hall A-101', 'Academic Block A', 1),
    ('A-102', 'Lecture Hall A-102', 'Academic Block A', 1),
    ('A-201', 'Lecture Hall A-201', 'Academic Block A', 2),
    ('A-205', 'Smart Classroom A-205', 'Academic Block A', 2),
    ('B-101', 'Seminar Hall B-101', 'Academic Block B', 1),
    ('B-110', 'Drawing Hall B-110', 'Academic Block B', 1),
    ('B-202', 'Lecture Hall B-202', 'Academic Block B', 2),
    ('C-101', 'Auditorium Annex C-101', 'Academic Block C', 1),
    ('C-210', 'Computer Lab Hall C-210', 'Academic Block C', 2),
    ('D-105', 'Lecture Hall D-105', 'Engineering Block', 1),
    ('D-301', 'Seminar Hall D-301', 'Engineering Block', 3),
    ('LH-01', 'Main Lecture Theatre', 'Central Academic Complex', 1),
    ('LH-02', 'South Lecture Theatre', 'Central Academic Complex', 1),
    ('SH-North', 'North Seminar Hall', 'Library Complex', 1),
    ('EH-01', 'Examination Hall 1', 'Examination Block', 1),
]

SEED_SUBJECT_CODES = [c for c, _, _ in SUBJECTS]
SEED_ROOM_CODES = [c for c, _, _, _ in HALLS]

DEPT_ROLL_PREFIX = {
    'COMPUTER SCIENCE': 'CS',
    'ELECTRONICS': 'EC',
    'CIVIL': 'CV',
    'MCA': 'MCA',
    'MBA': 'MBA',
}

# One exam record per department (unique Exam.subject_code)
SEED_EXAM_CODES = [f'ESE-{DEPT_ROLL_PREFIX[d]}' for d in DEFAULT_DEPARTMENTS]

NOTIFICATION_TITLES = [
    'End Semester Examination Timetable Released',
    'Fee Payment Deadline Reminder',
    'Internal Assessment Schedule',
    'Hall Ticket Download Now Open',
    'Attendance Shortfall Warning',
    'Department Meeting for Faculty',
    'Library Hours Extended During Exams',
    'Revaluation Application Window',
    'Practical Examination Guidelines',
    'Campus Wi-Fi Maintenance Notice',
    'Scholarship Form Submission',
    'Industrial Visit Registration',
    'Mentor Meeting Schedule',
    'Convocation Registration',
    'Supplementary Exam Notification',
]


def _avatar(seed):
    return f'https://api.dicebear.com/7.x/avataaars/svg?seed={seed}'


_CACHED_HASH = None


def _hash():
    """Reuse one bcrypt hash for all seed accounts (same password)."""
    global _CACHED_HASH
    if _CACHED_HASH is None:
        _CACHED_HASH = get_password_hash(DUMMY_PASSWORD)
    return _CACHED_HASH


class Command(BaseCommand):
    help = f'Seed {COUNT} realistic sample rows into each major table (password: {DUMMY_PASSWORD}).'

    def add_arguments(self, parser):
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Delete previously seeded sample records before inserting.',
        )

    def handle(self, *args, **options):
        self.stdout.write(self.style.MIGRATE_HEADING('ExamShield — sample data seed'))
        ensure_default_departments()
        ensure_default_settings()

        if options['clear']:
            self._clear_dummy()
            self.stdout.write(self.style.WARNING('Cleared previous sample data.'))

        with transaction.atomic():
            counts = self._seed_all()

        self.stdout.write(self.style.SUCCESS('Sample data ready.'))
        for table, n in counts.items():
            self.stdout.write(f'  {table}: {n}')
        self.stdout.write('')
        self.stdout.write('Login examples (password for seeded users: dummy123)')
        self.stdout.write('  student001@examshield.ai / dummy123  (15 students × 5 departments)')
        self.stdout.write('  teacher01@examshield.ai / dummy123')
        self.stdout.write('  hod01@examshield.ai / dummy123  (one HOD per department)')

    def _clear_dummy(self):
        SeatingArrangement.objects.filter(student__roll_no__startswith='DUM').delete()
        HallTicketSubject.objects.filter(hall_ticket__student__roll_no__startswith='DUM').delete()
        HallTicket.objects.filter(student__roll_no__startswith='DUM').delete()
        HallTicket.objects.filter(hall_ticket_no__startswith='DUM-HT-').delete()
        FeePayment.objects.filter(transaction_id__startswith='DUM-TXN-').delete()
        FeePayment.objects.filter(transaction_id__startswith='TXN-2026-').delete()
        ChatbotLog.objects.filter(student__roll_no__startswith='DUM').delete()
        EligibilityPrediction.objects.filter(student__roll_no__startswith='DUM').delete()
        Attendance.objects.filter(student__roll_no__startswith='DUM').delete()
        InternalMark.objects.filter(student__roll_no__startswith='DUM').delete()

        ExamSubject.objects.filter(exam__subject_code__in=SEED_SUBJECT_CODES).delete()
        ExamSubject.objects.filter(exam__subject_code__in=SEED_EXAM_CODES).delete()
        ExamSubject.objects.filter(subject_code__in=SEED_SUBJECT_CODES).delete()
        ExamSubject.objects.filter(subject_code__startswith='DUM').delete()
        SeatingArrangement.objects.filter(exam__subject_code__in=SEED_SUBJECT_CODES).delete()
        SeatingArrangement.objects.filter(exam__subject_code__in=SEED_EXAM_CODES).delete()
        SeatingArrangement.objects.filter(exam__subject_code__startswith='DUM').delete()
        Exam.objects.filter(subject_code__in=SEED_SUBJECT_CODES).delete()
        Exam.objects.filter(subject_code__in=SEED_EXAM_CODES).delete()
        Exam.objects.filter(subject_code__startswith='DUM').delete()
        Exam.objects.filter(subject_code__startswith='ESE-').delete()
        SeatingRoom.objects.filter(room_code__in=SEED_ROOM_CODES).delete()
        SeatingRoom.objects.filter(room_code__startswith='DUM-R').delete()
        Notification.objects.filter(title__in=NOTIFICATION_TITLES).delete()
        Notification.objects.filter(title__startswith='[DUMMY]').delete()

        Student.objects.filter(roll_no__startswith='DUM').delete()
        Teacher.objects.filter(emp_id__startswith='DUM-T').delete()
        HOD.objects.filter(emp_id__startswith='DUM-H').delete()
        total_students = len(DEFAULT_DEPARTMENTS) * STUDENTS_PER_DEPT
        emails = (
            [f'student{i:03d}@examshield.ai' for i in range(1, total_students + 1)]
            + [f'student{i:02d}@examshield.ai' for i in range(1, COUNT + 1)]  # legacy 01-15
            + [f'teacher{i:02d}@examshield.ai' for i in range(1, COUNT + 1)]
            + [f'hod{i:02d}@examshield.ai' for i in range(1, COUNT + 1)]
        )
        User.objects.filter(email__in=emails).delete()

    def _seed_all(self):
        counts = {}
        teachers = self._seed_teachers()
        counts['teachers (+ users)'] = len(teachers)
        students = self._seed_students()
        counts['students (+ users)'] = len(students)
        hods = self._seed_hods()
        counts['hods (+ users)'] = len(hods)
        rooms = self._seed_rooms()
        counts['seating_rooms'] = len(rooms)
        exams = self._seed_exams(teachers, rooms)
        counts['exams'] = len(exams)
        counts['exam_subjects'] = self._seed_exam_subjects(exams, teachers)
        counts['attendance'] = self._seed_attendance(students)
        counts['internal_marks'] = self._seed_internal_marks(students)
        counts['fee_payments'] = self._seed_fee_payments(students)
        # Fee updates can change eligibility — recompute from the 3 checks
        for student in students:
            student.refresh_from_db()
            att = student.attendance_percentage
            internal_pct = (student.internal_marks / INTERNAL_MARKS_MAX) * 100
            checks = [att >= 75, internal_pct >= 40, student.fee_paid]
            passed = sum(1 for c in checks if c)
            student.is_eligible = passed == 3
            student.eligibility_percentage = round((passed / 3) * 100)
            student.save(update_fields=['is_eligible', 'eligibility_percentage', 'updated_at'])
        tickets = self._seed_hall_tickets(students, exams)
        counts['hall_tickets'] = len(tickets)
        counts['hall_ticket_subjects'] = self._seed_hall_ticket_subjects(tickets, exams)
        counts['seating_arrangements'] = self._seed_seating(exams, rooms, students)
        counts['notifications'] = self._seed_notifications()
        counts['chatbot_logs'] = self._seed_chatbot(students)
        counts['eligibility_predictions'] = self._seed_predictions(students)
        counts['departments'] = len(DEFAULT_DEPARTMENTS)
        counts['system_settings'] = 1
        return counts

    def _seed_teachers(self):
        out = []
        for i in range(1, COUNT + 1):
            email = f'teacher{i:02d}@examshield.ai'
            full_name = _teacher_name(i - 1)
            user, created = User.objects.get_or_create(
                email=email,
                defaults={
                    'username': None,
                    'name': full_name,
                    'role': RoleEnum.TEACHER,
                    'avatar': _avatar(email),
                    'hashed_password': _hash(),
                },
            )
            if created:
                user.hashed_password = _hash()
                user.save(update_fields=['password'])
            elif user.name != full_name:
                user.name = full_name
                user.save(update_fields=['name', 'updated_at'])
            code, _, dept = SUBJECTS[(i - 1) % len(SUBJECTS)]
            # Prefer two papers from the same department when possible
            dept_papers = DEPT_SUBJECTS.get(dept) or [(code, '')]
            code = dept_papers[(i - 1) % len(dept_papers)][0]
            code2 = dept_papers[i % len(dept_papers)][0]
            teacher, _ = Teacher.objects.update_or_create(
                emp_id=f'DUM-T{i:03d}',
                defaults={
                    'user': user,
                    'department': dept,
                    'assigned_subjects': f'{code},{code2}',
                    'photo': user.avatar,
                    'is_deleted': False,
                },
            )
            out.append(teacher)
        return out

    def _seed_students(self):
        """15 students in each of the 5 departments (75 total)."""
        out = []
        today = timezone.now().date()
        global_i = 0
        for dept in DEFAULT_DEPARTMENTS:
            prefix = DEPT_ROLL_PREFIX.get(dept, 'XX')
            for i in range(1, STUDENTS_PER_DEPT + 1):
                global_i += 1
                email = f'student{global_i:03d}@examshield.ai'
                full_name = _student_name(global_i - 1)
                user, created = User.objects.get_or_create(
                    email=email,
                    defaults={
                        'username': None,
                        'name': full_name,
                        'role': RoleEnum.STUDENT,
                        'avatar': _avatar(email),
                        'hashed_password': _hash(),
                    },
                )
                if created:
                    user.hashed_password = _hash()
                    user.save(update_fields=['password'])
                elif user.name != full_name:
                    user.name = full_name
                    user.save(update_fields=['name', 'updated_at'])
                student, _ = Student.objects.update_or_create(
                    roll_no=f'DUM{prefix}{2024}{i:03d}',
                    defaults={
                        'user': user,
                        'mobile': f'98{10000000 + global_i}',
                        'department': dept,
                        'semester': 4,
                        'section': chr(65 + ((i - 1) % 3)),
                        'photo': user.avatar,
                        'attendance_percentage': round(70 + (i % 25), 1),
                        'internal_marks': round(22 + (i % 15), 1),
                        'assignment_marks': round(5 + (i % 5), 1),
                        'previous_result': round(5.5 + (i % 40) / 10, 1),
                        'backlogs': i % 3,
                        'fee_paid': i % 4 != 0,
                        'fee_amount': 45000.0,
                        'fee_due_date': (today + timedelta(days=30)).isoformat(),
                        'ai_risk_score': round((i % 10) / 10, 2),
                        'is_deleted': False,
                    },
                )
                # Align is_eligible / eligibility_percentage with the real 3-check rules
                att = student.attendance_percentage
                internal_pct = (student.internal_marks / INTERNAL_MARKS_MAX) * 100
                checks = [
                    att >= 75,
                    internal_pct >= 40,
                    student.fee_paid,
                ]
                passed = sum(1 for c in checks if c)
                student.is_eligible = passed == 3
                student.eligibility_percentage = round((passed / 3) * 100)
                student.save(update_fields=['is_eligible', 'eligibility_percentage', 'updated_at'])
                out.append(student)
        return out

    def _seed_hods(self):
        """Exactly one active HOD per department."""
        out = []
        for i, dept in enumerate(DEFAULT_DEPARTMENTS, start=1):
            existing = HOD.objects.filter(department=dept, is_deleted=False).select_related('user').first()
            if existing:
                out.append(existing)
                continue

            email = f'hod{i:02d}@examshield.ai'
            full_name = _hod_name(i - 1)
            user, created = User.objects.get_or_create(
                email=email,
                defaults={
                    'username': None,
                    'name': full_name,
                    'role': RoleEnum.HOD,
                    'avatar': _avatar(email),
                    'hashed_password': _hash(),
                },
            )
            if created:
                user.hashed_password = _hash()
                user.save(update_fields=['password'])
            else:
                user.role = RoleEnum.HOD
                user.is_deleted = False
                if user.name != full_name:
                    user.name = full_name
                user.save(update_fields=['role', 'is_deleted', 'name', 'updated_at'])

            hod, _ = HOD.objects.update_or_create(
                emp_id=f'DUM-H{i:03d}',
                defaults={
                    'user': user,
                    'department': dept,
                    'photo': user.avatar,
                    'is_deleted': False,
                },
            )
            out.append(hod)
        return out

    def _seed_rooms(self):
        out = []
        for i, (code, name, building, floor) in enumerate(HALLS, start=1):
            room, _ = SeatingRoom.objects.update_or_create(
                room_code=code,
                defaults={
                    'room_name': name,
                    'building': building,
                    'floor': floor,
                    'capacity': 48 + i * 2,
                    'rows': 8 + (i % 4),
                    'columns': 6,
                    'has_projector': i % 2 == 0,
                    'has_ac': i % 3 != 0,
                    'is_active': True,
                },
            )
            out.append(room)
        return out

    def _seed_exams(self, teachers, rooms):
        """One End-Semester Examination per department."""
        out = []
        base = timezone.now().date() + timedelta(days=14)
        for i, dept in enumerate(DEFAULT_DEPARTMENTS):
            papers = DEPT_SUBJECTS[dept]
            first_code, first_name = papers[0]
            exam_code = SEED_EXAM_CODES[i]
            room = rooms[i % len(rooms)]
            invigilator = next((t for t in teachers if t.department == dept), teachers[i % len(teachers)])
            # Align semester with most seeded students in that dept (1..6 cycling → use 4 as common demo)
            exam, _ = Exam.objects.update_or_create(
                subject_code=exam_code,
                defaults={
                    'title': f'End Semester Examination — {dept}',
                    'subject_name': first_name,
                    'department': dept,
                    'semester': 4,
                    'exam_date': (base + timedelta(days=i)).isoformat(),
                    'exam_time': '10:00 AM',
                    'duration': '3 hours',
                    'room': room.room_code,
                    'total_marks': 100,
                    'requires_face_verification': True,
                    'invigilator': invigilator,
                    'is_deleted': False,
                },
            )
            # Keep legacy fields in sync with first paper
            if exam.subject_name != first_name:
                exam.subject_name = first_name
                exam.save(update_fields=['subject_name', 'updated_at'])
            out.append(exam)
        return out

    def _seed_exam_subjects(self, exams, teachers):
        """Attach exactly 6 subject papers (staggered dates) to each department exam."""
        n = 0
        times = ['9:00 AM', '10:00 AM', '2:00 PM']
        for exam in exams:
            papers = DEPT_SUBJECTS.get(exam.department) or []
            invigilator = next(
                (t for t in teachers if t.department == exam.department),
                teachers[0] if teachers else None,
            )
            # Replace subjects so re-seed stays exactly 6
            exam.subjects.all().delete()
            base = date.fromisoformat(exam.exam_date) if exam.exam_date else (
                timezone.now().date() + timedelta(days=14)
            )
            for idx, (code, name) in enumerate(papers):
                ExamSubject.objects.create(
                    exam=exam,
                    subject_code=code,
                    subject_name=name,
                    exam_date=(base + timedelta(days=idx * 2)).isoformat(),
                    exam_time=times[idx % len(times)],
                    duration='3 hours',
                    sort_order=idx,
                    invigilator=invigilator,
                )
                n += 1
            # Mirror first paper onto parent Exam for list/detail fallbacks
            if papers:
                first_code, first_name = papers[0]
                exam.subject_name = first_name
                exam.exam_date = (base).isoformat()
                exam.exam_time = times[0]
                exam.save(update_fields=['subject_name', 'exam_date', 'exam_time', 'updated_at'])
        return n

    def _seed_attendance(self, students):
        n = 0
        base = timezone.now().date() - timedelta(days=30)
        for i, student in enumerate(students, start=1):
            dept_subjects = [s for s in SUBJECTS if s[2] == student.department] or SUBJECTS
            code, _, _ = dept_subjects[(i - 1) % len(dept_subjects)]
            Attendance.objects.update_or_create(
                student=student,
                subject_code=code,
                record_date=(base + timedelta(days=i)).isoformat(),
                defaults={'status': 'Present' if i % 5 else 'Absent'},
            )
            n += 1
        return n

    def _seed_internal_marks(self, students):
        """One internal mark row per subject paper for each student."""
        n = 0
        for i, student in enumerate(students, start=1):
            dept_subjects = DEPT_SUBJECTS.get(student.department) or []
            for j, (code, _) in enumerate(dept_subjects):
                InternalMark.objects.update_or_create(
                    student=student,
                    subject_code=code,
                    defaults={
                        'internal_score': float(20 + ((i + j) % 20)),
                        'assignment_score': float(4 + ((i + j) % 6)),
                    },
                )
                n += 1
            refresh_student_aggregate_marks(student)
        return n

    def _seed_fee_payments(self, students):
        n = 0
        admin = User.objects.filter(role=RoleEnum.ADMIN, is_deleted=False).first()
        statuses = ['approved', 'pending', 'rejected', 'approved', 'approved']
        methods = ['online', 'bank_transfer', 'college']
        for i, student in enumerate(students, start=1):
            status = statuses[(i - 1) % len(statuses)]
            FeePayment.objects.update_or_create(
                transaction_id=f'TXN-2026-{i:04d}',
                defaults={
                    'student': student,
                    'amount': student.fee_amount,
                    'method': methods[(i - 1) % len(methods)],
                    'reference': f'UPI/{2026000 + i}',
                    'status': status,
                    'verified_at': timezone.now() if status == 'approved' else None,
                    'verified_by': admin if status == 'approved' else None,
                    'admin_note': 'Verified by accounts office' if status == 'approved' else (
                        'Insufficient proof' if status == 'rejected' else ''
                    ),
                },
            )
            if status == 'approved':
                student.fee_paid = True
                student.save(update_fields=['fee_paid', 'updated_at'])
            n += 1
        return n

    def _seed_hall_tickets(self, students, exams):
        """Only fully eligible students receive hall tickets."""
        out = []
        eligible = [s for s in students if s.is_eligible]
        for i, student in enumerate(eligible, start=1):
            dept_exams = [e for e in exams if e.department == student.department] or exams
            exam = dept_exams[(i - 1) % len(dept_exams)]
            ht, _ = HallTicket.objects.update_or_create(
                student=student,
                defaults={
                    'hall_ticket_no': f'DUM-HT-{student.roll_no}',
                    'exam': exam,
                    'seat_number': f'{chr(65 + ((i - 1) % 8))}{(i % 12) + 1}',
                    'room': exam.room,
                    'qr_code_content': f'HT|{student.roll_no}|{exam.subject_code}|{exam.exam_date}',
                    'is_active': True,
                },
            )
            out.append(ht)
        # Ensure any leftover tickets for ineligible seeded students are off
        HallTicket.objects.filter(
            student__roll_no__startswith='DUM',
            student__is_eligible=False,
        ).update(is_active=False)
        return out

    def _seed_hall_ticket_subjects(self, tickets, exams):
        n = 0
        for ht in tickets:
            exam = ht.exam
            if not exam:
                continue
            subjects = sync_hall_ticket_subjects(
                ht, exam, default_seat=ht.seat_number, default_room=ht.room or exam.room,
            )
            refresh_hall_ticket_qr(ht, exam, ht.student)
            n += len(subjects or [])
        return n

    def _seed_seating(self, exams, rooms, students):
        """One seating arrangement per eligible student on their department exam."""
        n = 0
        room_count = max(len(rooms), 1)
        exams_by_dept = {e.department: e for e in exams}
        eligible = [s for s in students if s.is_eligible]
        for i, student in enumerate(eligible):
            exam = exams_by_dept.get(student.department) or exams[0]
            room = rooms[i % room_count]
            slot = i // room_count
            row = (slot // 6) + 1
            col = (slot % 6) + 1
            SeatingArrangement.objects.update_or_create(
                exam=exam,
                student=student,
                defaults={
                    'room': room,
                    'seat_row': row,
                    'seat_column': col,
                    'seat_number': f'{chr(64 + row)}{col}',
                    'arrangement_type': 'auto' if i % 2 else 'manual',
                    'is_confirmed': i % 3 != 0,
                },
            )
            n += 1
        return n

    def _seed_notifications(self):
        audiences = [
            AudienceEnum.ALL,
            AudienceEnum.STUDENTS,
            AudienceEnum.TEACHERS,
            AudienceEnum.ADMIN,
        ]
        n = 0
        for i, title in enumerate(NOTIFICATION_TITLES, start=1):
            Notification.objects.update_or_create(
                title=title,
                defaults={
                    'message': (
                        f'{title}. Please check the academic calendar and your department notice board '
                        f'for further details. Contact the exam cell for clarifications.'
                    ),
                    'audience': audiences[(i - 1) % len(audiences)],
                    'is_read': i % 4 == 0,
                },
            )
            n += 1
        return n

    def _seed_chatbot(self, students):
        ChatbotLog.objects.filter(student__roll_no__startswith='DUM').delete()
        n = 0
        queries = [
            ('When is my next exam?', 'Your next exam is listed on the Exams page and dashboard.'),
            ('Am I eligible for the semester exam?', 'Open Eligibility to see the AI assessment and criteria.'),
            ('How do I pay my examination fees?', 'Go to Payments and choose online, bank transfer, or college office.'),
            ('Where can I download my hall ticket?', 'Hall Ticket is available after you meet eligibility criteria.'),
            ('What is my current attendance percentage?', 'Your attendance percentage is shown on the dashboard.'),
        ]
        for i, student in enumerate(students, start=1):
            q, a = queries[(i - 1) % len(queries)]
            ChatbotLog.objects.create(student=student, user_query=q, bot_response=a)
            n += 1
        return n

    def _seed_predictions(self, students):
        EligibilityPrediction.objects.filter(student__roll_no__startswith='DUM').delete()
        n = 0
        for i, student in enumerate(students, start=1):
            EligibilityPrediction.objects.create(
                student=student,
                predicted_probability=round(0.4 + (i % 50) / 100, 2),
                risk_score=round((i % 10) / 10, 2),
                factors_summary=(
                    f'attendance={student.attendance_percentage}, '
                    f'internals={student.internal_marks}, backlogs={student.backlogs}'
                ),
            )
            n += 1
        return n
