from .models import Exam, Student, SeatingRoom, SeatingArrangement, HallTicket
from .exam_service import get_exam_subjects, subjects_subject_codes
from django.db import transaction
import random
import re


def build_qr_content(hall_ticket_no, roll_no, subject_code, seat_number, room_label, subject_codes=None):
    """Legacy pipe-format QR (prefer build_hall_ticket_qr via refresh_hall_ticket_qr)."""
    codes = subject_codes or subject_code
    return f"HT:{hall_ticket_no}|Roll:{roll_no}|Exam:{codes}|Seat:{seat_number}|Room:{room_label}"


def room_display_name(room):
    return f"{room.room_name} ({room.room_code})"


class SeatingArrangementService:
    """Service class for handling seating arrangements with various strategies"""

    @staticmethod
    def _seat_key(room_id, row, column):
        return (room_id, row, column)

    @staticmethod
    def parse_seat_number(seat_number):
        """
        Parse labels like A1, B12 into 0-based (row, column).
        Matches generate_seat_number (A=row0, column = number-1).
        """
        s = (seat_number or "").strip().upper()
        m = re.fullmatch(r"([A-Z]+)(\d+)", s)
        if not m:
            return None
        letters, num = m.group(1), int(m.group(2))
        if num < 1:
            return None
        row = 0
        for ch in letters:
            row = row * 26 + (ord(ch) - 64)
        row -= 1
        return row, num - 1

    @staticmethod
    def find_room_by_label(room_label):
        """Resolve a hall label / code / name to a SeatingRoom, or None."""
        value = (room_label or "").strip()
        if not value:
            return None
        for room in SeatingRoom.objects.filter(is_active=True):
            label = room_display_name(room)
            if value in (label, room.room_code, room.room_name):
                return room
        return None

    @staticmethod
    def apply_seat_label(arrangement, seat_number, room_id=None):
        """
        Move an arrangement to the grid cell implied by seat_number (and optional room).
        Updates seat_row, seat_column, seat_number, and room_id.
        """
        label = (seat_number or "").strip().upper()
        parsed = SeatingArrangementService.parse_seat_number(label)
        if not parsed:
            raise ValueError(
                f"Invalid seat number '{seat_number}'. Use labels like A1, B2, C3."
            )
        row, col = parsed
        target_room_id = room_id if room_id is not None else arrangement.room_id
        try:
            room = SeatingRoom.objects.get(id=target_room_id, is_active=True)
        except SeatingRoom.DoesNotExist:
            raise ValueError("Hall/room not found")

        if row < 0 or row >= room.rows or col < 0 or col >= room.columns:
            raise ValueError(
                f"Seat {label} is outside hall {room.room_name} "
                f"({room.rows} rows × {room.columns} columns)."
            )

        conflict = SeatingArrangement.objects.filter(
            exam_id=arrangement.exam_id,
            room_id=room.id,
            seat_row=row,
            seat_column=col,
        ).exclude(id=arrangement.id).select_related("student__user").first()
        if conflict:
            raise ValueError(
                f"Seat {label} in {room.room_name} is already assigned to "
                f"{conflict.student.user.name}."
            )

        arrangement.room = room
        arrangement.seat_row = row
        arrangement.seat_column = col
        arrangement.seat_number = SeatingArrangementService.generate_seat_number(
            row, col, room.room_code,
        )
        arrangement.save()
        return arrangement

    @staticmethod
    def sync_from_hall_ticket_seat(student, exam, seat_number, room_label):
        """
        Keep SeatingArrangement (and therefore the seat map) aligned with a
        hall-ticket seat/hall change for the exam's primary seating slot.
        """
        seat = (seat_number or "").strip()
        if not seat:
            return None

        room = SeatingArrangementService.find_room_by_label(room_label)
        arrangement = SeatingArrangement.objects.filter(
            student=student, exam=exam,
        ).select_related("room", "student__user").first()

        if room is None and arrangement is not None:
            room = arrangement.room
        if room is None:
            return None

        parsed = SeatingArrangementService.parse_seat_number(seat)
        if not parsed:
            # Still store text on existing arrangement for display, but map can't move
            if arrangement:
                arrangement.seat_number = seat
                arrangement.save(update_fields=["seat_number", "updated_at"])
            return arrangement

        row, col = parsed
        if row < 0 or row >= room.rows or col < 0 or col >= room.columns:
            raise ValueError(
                f"Seat {seat} is outside hall {room.room_name} "
                f"({room.rows}×{room.columns})."
            )

        conflict = SeatingArrangement.objects.filter(
            exam=exam, room=room, seat_row=row, seat_column=col,
        ).exclude(student=student).select_related("student__user").first()
        if conflict:
            raise ValueError(
                f"Seat {seat} in {room.room_name} is already assigned to "
                f"{conflict.student.user.name} on the seating map."
            )

        canonical = SeatingArrangementService.generate_seat_number(row, col, room.room_code)
        if arrangement:
            arrangement.room = room
            arrangement.seat_row = row
            arrangement.seat_column = col
            arrangement.seat_number = canonical
            arrangement.save()
            return arrangement

        return SeatingArrangement.objects.create(
            exam=exam,
            room=room,
            student=student,
            seat_row=row,
            seat_column=col,
            seat_number=canonical,
            arrangement_type="manual",
        )

    @staticmethod
    def validate_unique_seats(exam_id, arrangements_data, exclude_student_ids=None):
        """Ensure no two students share the same seat for an exam."""
        exclude_student_ids = exclude_student_ids or set()
        seen = {}
        for arr in arrangements_data:
            room_id = arr.get('room_id') or (arr['room'].id if arr.get('room') else None)
            row = arr['seat_row']
            col = arr['seat_column']
            student_id = arr.get('student_id') or (arr['student'].id if arr.get('student') else None)
            if student_id in exclude_student_ids:
                continue
            key = SeatingArrangementService._seat_key(room_id, row, col)
            if key in seen:
                raise ValueError(
                    f"Seat {arr.get('seat_number', f'row {row + 1} col {col + 1}')} is already assigned to another student"
                )
            seen[key] = student_id

        existing = SeatingArrangement.objects.filter(exam_id=exam_id)
        if exclude_student_ids:
            existing = existing.exclude(student_id__in=exclude_student_ids)
        for arr in existing:
            key = SeatingArrangementService._seat_key(arr.room_id, arr.seat_row, arr.seat_column)
            if key in seen:
                raise ValueError(
                    f"Seat {arr.seat_number} is already assigned to another student"
                )
    
    @staticmethod
    def generate_seat_number(row, column, room_code):
        """Generate a seat number based on row and column (e.g., A1, B2, C3)"""
        row_letter = chr(65 + row)  # A, B, C, etc.
        return f"{row_letter}{column + 1}"
    
    @staticmethod
    def get_room_capacity(room):
        """Calculate actual capacity based on rows and columns"""
        return room.rows * room.columns

    @staticmethod
    def _roll_sort_key(roll_no):
        """Natural sort for roll numbers like CS2024002 before CS2024010."""
        parts = re.split(r"(\d+)", (roll_no or "").strip().upper())
        key = []
        for part in parts:
            if not part:
                continue
            if part.isdigit():
                key.append((0, int(part)))
            else:
                key.append((1, part))
        return key

    @staticmethod
    def _eligible_students(students):
        return [s for s in students if getattr(s, "is_eligible", True)]

    @staticmethod
    def _ordered_rooms(rooms, room_ids=None):
        """Preserve admin selection order when room_ids provided."""
        rooms = list(rooms)
        if not room_ids:
            return rooms
        by_id = {r.id: r for r in rooms}
        ordered = [by_id[rid] for rid in room_ids if rid in by_id]
        return ordered or rooms

    @staticmethod
    def sequential_strategy(students, rooms, leave_empty_seats=False, seats_between_students=0):
        """
        Sequential seating by roll number (natural order).
        """
        ordered = sorted(
            SeatingArrangementService._eligible_students(students),
            key=lambda s: SeatingArrangementService._roll_sort_key(s.roll_no),
        )
        return SeatingArrangementService._assign_in_order(
            ordered, rooms, leave_empty_seats, seats_between_students,
        )

    @staticmethod
    def department_strategy(students, rooms, leave_empty_seats=False, seats_between_students=0):
        """
        Group by department, then section, then roll number.
        (Exam auto-arrange usually has one department, so this seats by section blocks.)
        """
        ordered = sorted(
            SeatingArrangementService._eligible_students(students),
            key=lambda s: (
                (s.department or "").lower(),
                (s.section or "").upper(),
                SeatingArrangementService._roll_sort_key(s.roll_no),
            ),
        )
        return SeatingArrangementService._assign_in_order(
            ordered, rooms, leave_empty_seats, seats_between_students,
        )

    @staticmethod
    def alphabetical_strategy(students, rooms, leave_empty_seats=False, seats_between_students=0):
        """Alphabetical seating by student name, then roll number."""
        ordered = sorted(
            SeatingArrangementService._eligible_students(students),
            key=lambda s: (
                ((s.user.name if s.user else "") or "").strip().lower(),
                SeatingArrangementService._roll_sort_key(s.roll_no),
            ),
        )
        return SeatingArrangementService._assign_in_order(
            ordered, rooms, leave_empty_seats, seats_between_students,
        )

    @staticmethod
    def random_strategy(students, rooms, leave_empty_seats=False, seats_between_students=0):
        """Random seating: shuffle eligible students, then assign seats in order."""
        ordered = list(SeatingArrangementService._eligible_students(students))
        random.shuffle(ordered)
        return SeatingArrangementService._assign_in_order(
            ordered, rooms, leave_empty_seats, seats_between_students,
        )

    @staticmethod
    def _assign_in_order(students, rooms, leave_empty_seats=False, seats_between_students=0):
        """
        Fill seats left-to-right, top-to-bottom across rooms in the given student order.
        """
        arrangements = []
        room_index = 0
        row = 0
        column = 0
        occupied = set()
        step = max(0, int(seats_between_students or 0)) + 1

        for student in students:
            while room_index < len(rooms):
                room = rooms[room_index]

                if row < room.rows and column < room.columns:
                    seat_key = SeatingArrangementService._seat_key(room.id, row, column)
                    if seat_key in occupied:
                        column += 1
                        if column >= room.columns:
                            column = 0
                            row += 1
                        continue

                    seat_number = SeatingArrangementService.generate_seat_number(
                        row, column, room.room_code,
                    )
                    occupied.add(seat_key)
                    arrangements.append({
                        "student": student,
                        "room": room,
                        "seat_row": row,
                        "seat_column": column,
                        "seat_number": seat_number,
                    })

                    column += step
                    if column >= room.columns:
                        column = 0
                        row += 1
                    if row >= room.rows:
                        room_index += 1
                        row = 0
                        column = 0
                    break

                room_index += 1
                row = 0
                column = 0
            else:
                break

        return arrangements

    @staticmethod
    @transaction.atomic
    def create_auto_arrangement(exam_id, room_ids, strategy='sequential', 
                               leave_empty_seats=False, seats_between_students=0):
        """
        Create automatic seating arrangement for an exam
        """
        try:
            exam = Exam.objects.get(id=exam_id, is_deleted=False)
        except Exam.DoesNotExist:
            raise ValueError("Exam not found")
        
        # Get rooms in the order the admin selected them
        rooms_qs = SeatingRoom.objects.filter(id__in=room_ids, is_active=True)
        if not rooms_qs.exists():
            raise ValueError("No valid rooms found")
        rooms = SeatingArrangementService._ordered_rooms(rooms_qs, room_ids)
        
        # Get eligible students for the exam
        students = list(Student.objects.filter(
            department=exam.department,
            semester=exam.semester,
            is_eligible=True,
            is_deleted=False
        ).select_related('user'))
        
        if not students:
            raise ValueError("No eligible students found for this exam")
        
        # Delete existing arrangements for this exam
        SeatingArrangement.objects.filter(exam=exam).delete()
        
        # Apply strategy
        strategy_key = (strategy or "sequential").strip().lower()
        strategy_map = {
            "sequential": SeatingArrangementService.sequential_strategy,
            "department": SeatingArrangementService.department_strategy,
            "alphabetical": SeatingArrangementService.alphabetical_strategy,
            "random": SeatingArrangementService.random_strategy,
        }
        
        strategy_func = strategy_map.get(strategy_key, SeatingArrangementService.sequential_strategy)
        arrangements_data = strategy_func(
            students,
            rooms,
            leave_empty_seats,
            seats_between_students,
        )
        if not arrangements_data:
            raise ValueError("Could not assign any seats — check hall capacity and eligible students")

        normalized = [{
            'student_id': arr_data['student'].id,
            'room_id': arr_data['room'].id,
            'seat_row': arr_data['seat_row'],
            'seat_column': arr_data['seat_column'],
            'seat_number': arr_data['seat_number'],
            'student': arr_data['student'],
            'room': arr_data['room'],
        } for arr_data in arrangements_data]
        SeatingArrangementService.validate_unique_seats(exam_id, normalized)
        
        # Create SeatingArrangement objects (preserve strategy order)
        created_arrangements = []
        for arr_data in normalized:
            arrangement = SeatingArrangement.objects.create(
                exam=exam,
                room=arr_data['room'],
                student=arr_data['student'],
                seat_row=arr_data['seat_row'],
                seat_column=arr_data['seat_column'],
                seat_number=arr_data['seat_number'],
                arrangement_type='auto'
            )
            created_arrangements.append(arrangement)

        subjects = get_exam_subjects(exam)
        return {
            'total_arrangements': len(created_arrangements),
            'exam': exam.title or exam.subject_name,
            'exam_title': exam.title or exam.subject_name,
            'subjects': subjects,
            'subject_count': len(subjects),
            'rooms_used': len({a.room_id for a in created_arrangements}),
            'students_seated': len(created_arrangements),
            'strategy_used': strategy_key if strategy_key in strategy_map else 'sequential',
            'seating_preview': [
                {
                    'seat_number': a.seat_number,
                    'roll_no': a.student.roll_no,
                    'name': a.student.user.name,
                    'section': a.student.section,
                    'department': a.student.department,
                }
                for a in created_arrangements[:8]
            ],
        }
    
    @staticmethod
    @transaction.atomic
    def create_manual_arrangement(exam_id, arrangements_data):
        """
        Create manual seating arrangement
        arrangements_data: list of dicts with student_id, room_id, seat_row, seat_column, seat_number
        """
        try:
            exam = Exam.objects.get(id=exam_id, is_deleted=False)
        except Exam.DoesNotExist:
            raise ValueError("Exam not found")
        
        # Delete existing arrangements for this exam
        SeatingArrangement.objects.filter(exam=exam).delete()

        if not arrangements_data:
            return {'total_arrangements': 0, 'exam': exam.subject_name}

        SeatingArrangementService.validate_unique_seats(exam_id, arrangements_data)
        
        created_arrangements = []
        for arr_data in arrangements_data:
            try:
                student = Student.objects.get(id=arr_data['student_id'], is_deleted=False)
                room = SeatingRoom.objects.get(id=arr_data['room_id'], is_active=True)
            except (Student.DoesNotExist, SeatingRoom.DoesNotExist):
                continue
            
            arrangement = SeatingArrangement.objects.create(
                exam=exam,
                room=room,
                student=student,
                seat_row=arr_data['seat_row'],
                seat_column=arr_data['seat_column'],
                seat_number=arr_data['seat_number'],
                arrangement_type='manual'
            )
            created_arrangements.append(arrangement)
        
        return {
            'total_arrangements': len(created_arrangements),
            'exam': exam.subject_name
        }
    
    @staticmethod
    def get_seating_layout(room_id):
        """
        Get seating layout for a room as a 2D grid
        """
        try:
            room = SeatingRoom.objects.get(id=room_id)
        except SeatingRoom.DoesNotExist:
            raise ValueError("Room not found")
        
        layout = []
        for row in range(room.rows):
            row_data = []
            for col in range(room.columns):
                seat_number = SeatingArrangementService.generate_seat_number(row, col, room.room_code)
                row_data.append({
                    'row': row,
                    'column': col,
                    'seat_number': seat_number,
                    'occupied': False,
                    'student': None
                })
            layout.append(row_data)
        
        return {
            'room': room.room_code,
            'room_name': room.room_name,
            'rows': room.rows,
            'columns': room.columns,
            'layout': layout
        }
    
    @staticmethod
    def get_seating_layout_with_students(room_id, exam_id=None):
        """
        Get seating layout with student assignments
        """
        try:
            room = SeatingRoom.objects.get(id=room_id)
        except SeatingRoom.DoesNotExist:
            raise ValueError("Room not found")
        
        # Get arrangements for this room
        if exam_id:
            arrangements = SeatingArrangement.objects.filter(
                room=room, exam_id=exam_id
            ).select_related('student__user')
        else:
            arrangements = SeatingArrangement.objects.filter(
                room=room
            ).select_related('student__user')
        
        # Create layout — prefer row/col match; also honor seat_number if row/col drifted
        by_rc = {(a.seat_row, a.seat_column): a for a in arrangements}
        by_sn = {(a.seat_number or "").strip().upper(): a for a in arrangements if a.seat_number}

        layout = []
        for row in range(room.rows):
            row_data = []
            for col in range(room.columns):
                seat_number = SeatingArrangementService.generate_seat_number(row, col, room.room_code)
                arrangement = by_rc.get((row, col)) or by_sn.get(seat_number.upper())

                row_data.append({
                    'row': row,
                    'column': col,
                    'seat_number': seat_number,
                    'occupied': arrangement is not None,
                    'student': {
                        'id': arrangement.student.id,
                        'name': arrangement.student.user.name,
                        'roll_no': arrangement.student.roll_no
                    } if arrangement else None
                })
            layout.append(row_data)
        
        return {
            'room': room.room_code,
            'room_name': room.room_name,
            'rows': room.rows,
            'columns': room.columns,
            'layout': layout
        }

    @staticmethod
    @transaction.atomic
    def sync_hall_tickets(exam_id):
        """Push seating arrangements into hall ticket records (eligible students only)."""
        try:
            exam = Exam.objects.get(id=exam_id, is_deleted=False)
        except Exam.DoesNotExist:
            raise ValueError("Exam not found")

        arrangements = SeatingArrangement.objects.filter(
            exam=exam
        ).select_related('student__user', 'room')

        if not arrangements.exists():
            raise ValueError("No seating arrangements found for this exam")

        synced = 0
        for arr in arrangements:
            student = arr.student
            if student.is_deleted or not student.is_eligible:
                # Never issue / keep active tickets for ineligible students
                HallTicket.objects.filter(student=student).update(is_active=False)
                continue

            hall_ticket_no = f"HT2026{student.roll_no}"
            room_label = room_display_name(arr.room)
            ht, _ = HallTicket.objects.update_or_create(
                student=student,
                defaults={
                    'exam': exam,
                    'hall_ticket_no': hall_ticket_no,
                    'seat_number': arr.seat_number,
                    'room': room_label,
                    'qr_code_content': '',
                    'is_active': True,
                },
            )
            from .hall_ticket_service import sync_hall_ticket_subjects, refresh_hall_ticket_qr
            sync_hall_ticket_subjects(
                ht, exam,
                default_seat=arr.seat_number,
                default_room=room_label,
                force_defaults=True,
            )
            refresh_hall_ticket_qr(ht, exam, student)
            synced += 1

        SeatingArrangement.objects.filter(exam=exam).update(is_confirmed=True)
        return synced

    @staticmethod
    def sync_arrangement_to_hall_ticket(arrangement):
        """Update a single hall ticket from one seating arrangement (eligible only)."""
        student = arrangement.student
        exam = arrangement.exam
        if student.is_deleted or not student.is_eligible:
            HallTicket.objects.filter(student=student).update(is_active=False)
            return None

        hall_ticket_no = f"HT2026{student.roll_no}"
        room_label = room_display_name(arrangement.room)
        ht, _ = HallTicket.objects.update_or_create(
            student=student,
            defaults={
                'exam': exam,
                'hall_ticket_no': hall_ticket_no,
                'seat_number': arrangement.seat_number,
                'room': room_label,
                'qr_code_content': '',
                'is_active': True,
            },
        )
        from .hall_ticket_service import sync_hall_ticket_subjects, refresh_hall_ticket_qr
        sync_hall_ticket_subjects(
            ht, exam,
            default_seat=arrangement.seat_number,
            default_room=room_label,
            force_defaults=True,
        )
        refresh_hall_ticket_qr(ht, exam, student)
        return ht
