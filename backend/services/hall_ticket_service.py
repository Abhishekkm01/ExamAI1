"""Shared hall ticket and seating assignment logic."""
from typing import Optional
from sqlalchemy.orm import Session
import models


def build_qr_content(hall_ticket_no: str, roll_no: str, subject_code: str, seat: str, room: str) -> str:
    return f"HT:{hall_ticket_no}|Roll:{roll_no}|Exam:{subject_code}|Seat:{seat}|Room:{room}"


def hall_ticket_no_for(roll_no: str) -> str:
    return f"HT2026{roll_no}"


def get_exam_for_student(db: Session, student: models.Student) -> Optional[models.Exam]:
    exam = db.query(models.Exam).filter(
        models.Exam.department == student.department,
        models.Exam.semester == student.semester,
        models.Exam.is_deleted == False,
    ).first()
    if not exam:
        exam = db.query(models.Exam).filter(
            models.Exam.department == student.department,
            models.Exam.is_deleted == False,
        ).first()
    if not exam:
        exam = db.query(models.Exam).filter(models.Exam.is_deleted == False).first()
    return exam


def hall_ticket_dict(ht: models.HallTicket) -> dict:
    return {
        "is_eligible": True,
        "hall_ticket_no": ht.hall_ticket_no,
        "student": {
            "name": ht.student.user.name,
            "roll_no": ht.student.roll_no,
            "department": ht.student.department,
            "photo": ht.student.photo,
        },
        "exam": {
            "subject_code": ht.exam.subject_code,
            "subject_name": ht.exam.subject_name,
            "date": ht.exam.exam_date,
            "time": ht.exam.exam_time,
            "duration": ht.exam.duration,
            "room": ht.room,
        },
        "seat_number": ht.seat_number,
        "qr_code_content": ht.qr_code_content,
    }


def assign_seating(
    db: Session,
    exam_id: int,
    strategy: str = "by_roll",
    room_ids: Optional[list[int]] = None,
) -> dict:
    """Assign eligible students to rooms/seats for an exam and create hall tickets."""
    exam = db.query(models.Exam).filter(
        models.Exam.id == exam_id, models.Exam.is_deleted == False
    ).first()
    if not exam:
        raise ValueError("Exam not found")

    students = db.query(models.Student).filter(
        models.Student.is_deleted == False,
        models.Student.is_eligible == True,
        models.Student.department == exam.department,
        models.Student.semester == exam.semester,
    ).all()

    if strategy == "by_section":
        students.sort(key=lambda s: (s.section, s.roll_no))
    else:
        students.sort(key=lambda s: s.roll_no)

    room_query = db.query(models.ExamRoom).filter(models.ExamRoom.is_active == True)
    if room_ids:
        room_query = room_query.filter(models.ExamRoom.id.in_(room_ids))
    rooms = room_query.order_by(models.ExamRoom.id).all()

    if not rooms:
        raise ValueError("No active exam rooms available. Add rooms first.")

    assigned = 0
    overflow = 0
    rooms_used: dict[int, int] = {}

    room_idx = 0
    seat_in_room = 0
    current_room = rooms[0]

    for student in students:
        if seat_in_room >= current_room.capacity:
            room_idx += 1
            seat_in_room = 0
            if room_idx >= len(rooms):
                overflow += 1
                continue
            current_room = rooms[room_idx]

        row = (seat_in_room // current_room.cols) + 1
        col = (seat_in_room % current_room.cols) + 1
        seat_label = f"R{row}C{col}"
        seat_in_room += 1
        rooms_used[current_room.id] = rooms_used.get(current_room.id, 0) + 1

        existing_sa = db.query(models.SeatingAssignment).filter(
            models.SeatingAssignment.exam_id == exam_id,
            models.SeatingAssignment.student_id == student.id,
        ).first()
        if existing_sa:
            existing_sa.room_id = current_room.id
            existing_sa.seat_label = seat_label
            existing_sa.row_num = row
            existing_sa.col_num = col
        else:
            db.add(models.SeatingAssignment(
                exam_id=exam_id,
                student_id=student.id,
                room_id=current_room.id,
                seat_label=seat_label,
                row_num=row,
                col_num=col,
            ))

        ht_no = hall_ticket_no_for(student.roll_no)
        qr = build_qr_content(ht_no, student.roll_no, exam.subject_code, seat_label, current_room.name)

        ht = db.query(models.HallTicket).filter(models.HallTicket.student_id == student.id).first()
        if ht:
            ht.exam_id = exam.id
            ht.seat_number = seat_label
            ht.room = current_room.name
            ht.room_id = current_room.id
            ht.qr_code_content = qr
            ht.is_active = True
        else:
            db.add(models.HallTicket(
                hall_ticket_no=ht_no,
                student_id=student.id,
                exam_id=exam.id,
                seat_number=seat_label,
                room=current_room.name,
                room_id=current_room.id,
                qr_code_content=qr,
            ))
        assigned += 1

    db.commit()
    return {
        "exam_id": exam_id,
        "exam_name": exam.subject_name,
        "strategy": strategy,
        "total_eligible": len(students),
        "assigned": assigned,
        "overflow": overflow,
        "rooms_used": [
            {"room_id": rid, "room_name": next(r.name for r in rooms if r.id == rid), "count": cnt}
            for rid, cnt in rooms_used.items()
        ],
    }


def generate_all_hall_tickets(db: Session, exam_id: Optional[int] = None, strategy: str = "by_roll") -> dict:
    """Generate seating + hall tickets for one exam or all exams with rooms."""
    if exam_id:
        return assign_seating(db, exam_id, strategy)

    exams = db.query(models.Exam).filter(models.Exam.is_deleted == False).all()
    total_assigned = 0
    results = []
    for exam in exams:
        try:
            res = assign_seating(db, exam.id, strategy)
            total_assigned += res["assigned"]
            results.append(res)
        except ValueError as e:
            results.append({"exam_id": exam.id, "error": str(e)})
    return {"total_assigned": total_assigned, "exams": results}
