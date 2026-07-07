from .models import Exam, Student, SeatingRoom, SeatingArrangement
from django.db import transaction
import random


class SeatingArrangementService:
    """Service class for handling seating arrangements with various strategies"""
    
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
    def sequential_strategy(students, rooms, leave_empty_seats=False, seats_between_students=0):
        """
        Sequential seating: Fill students in order across rooms and seats
        """
        arrangements = []
        room_index = 0
        row = 0
        column = 0
        
        for student in students:
            # Skip if student is not eligible
            if not student.is_eligible:
                continue
                
            # Find next available room
            while room_index < len(rooms):
                room = rooms[room_index]
                capacity = SeatingArrangementService.get_room_capacity(room)
                
                # Check if room has space
                if row < room.rows and column < room.columns:
                    seat_number = SeatingArrangementService.generate_seat_number(row, column, room.room_code)
                    
                    arrangements.append({
                        'student': student,
                        'room': room,
                        'seat_row': row,
                        'seat_column': column,
                        'seat_number': seat_number
                    })
                    
                    # Move to next seat
                    column += seats_between_students + 1
                    if column >= room.columns:
                        column = 0
                        row += 1
                    
                    if row >= room.rows:
                        room_index += 1
                        row = 0
                        column = 0
                    break
                else:
                    room_index += 1
                    row = 0
                    column = 0
            else:
                # No more rooms available
                break
        
        return arrangements
    
    @staticmethod
    def department_strategy(students, rooms, leave_empty_seats=False, seats_between_students=0):
        """
        Department-based seating: Group students by department
        """
        # Group students by department
        dept_groups = {}
        for student in students:
            if not student.is_eligible:
                continue
            if student.department not in dept_groups:
                dept_groups[student.department] = []
            dept_groups[student.department].append(student)
        
        arrangements = []
        room_index = 0
        row = 0
        column = 0
        
        # Assign each department to a room/section
        for department, dept_students in dept_groups.items():
            for student in dept_students:
                # Find next available room
                while room_index < len(rooms):
                    room = rooms[room_index]
                    capacity = SeatingArrangementService.get_room_capacity(room)
                    
                    if row < room.rows and column < room.columns:
                        seat_number = SeatingArrangementService.generate_seat_number(row, column, room.room_code)
                        
                        arrangements.append({
                            'student': student,
                            'room': room,
                            'seat_row': row,
                            'seat_column': column,
                            'seat_number': seat_number
                        })
                        
                        column += seats_between_students + 1
                        if column >= room.columns:
                            column = 0
                            row += 1
                        
                        if row >= room.rows:
                            room_index += 1
                            row = 0
                            column = 0
                        break
                    else:
                        room_index += 1
                        row = 0
                        column = 0
                else:
                    break
        
        return arrangements
    
    @staticmethod
    def alphabetical_strategy(students, rooms, leave_empty_seats=False, seats_between_students=0):
        """
        Alphabetical seating: Sort students by name and assign seats
        """
        # Sort students by name
        sorted_students = sorted(students, key=lambda s: s.user.name if s.user else '')
        return SeatingArrangementService.sequential_strategy(
            sorted_students, rooms, leave_empty_seats, seats_between_students
        )
    
    @staticmethod
    def random_strategy(students, rooms, leave_empty_seats=False, seats_between_students=0):
        """
        Random seating: Shuffle students and assign seats
        """
        # Shuffle students
        shuffled_students = students[:]
        random.shuffle(shuffled_students)
        return SeatingArrangementService.sequential_strategy(
            shuffled_students, rooms, leave_empty_seats, seats_between_students
        )
    
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
        
        # Get rooms
        rooms = SeatingRoom.objects.filter(id__in=room_ids, is_active=True)
        if not rooms.exists():
            raise ValueError("No valid rooms found")
        
        # Get eligible students for the exam
        students = Student.objects.filter(
            department=exam.department,
            semester=exam.semester,
            is_eligible=True,
            is_deleted=False
        ).select_related('user')
        
        if not students.exists():
            raise ValueError("No eligible students found for this exam")
        
        # Delete existing arrangements for this exam
        SeatingArrangement.objects.filter(exam=exam).delete()
        
        # Apply strategy
        strategy_map = {
            'sequential': SeatingArrangementService.sequential_strategy,
            'department': SeatingArrangementService.department_strategy,
            'alphabetical': SeatingArrangementService.alphabetical_strategy,
            'random': SeatingArrangementService.random_strategy,
        }
        
        strategy_func = strategy_map.get(strategy, SeatingArrangementService.sequential_strategy)
        arrangements_data = strategy_func(
            list(students), 
            list(rooms), 
            leave_empty_seats, 
            seats_between_students
        )
        
        # Create SeatingArrangement objects
        created_arrangements = []
        for arr_data in arrangements_data:
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
        
        return {
            'total_arrangements': len(created_arrangements),
            'exam': exam.subject_name,
            'rooms_used': rooms.count(),
            'students_seated': len(created_arrangements)
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
        
        # Create layout
        layout = []
        for row in range(room.rows):
            row_data = []
            for col in range(room.columns):
                seat_number = SeatingArrangementService.generate_seat_number(row, col, room.room_code)
                
                # Check if seat is occupied
                arrangement = arrangements.filter(
                    seat_row=row, seat_column=col
                ).first()
                
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
