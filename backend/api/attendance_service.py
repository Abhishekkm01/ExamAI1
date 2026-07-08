import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from ai_modules.eligibility_model import eligibility_ai

from .models import Attendance, Student


def parse_student_id(raw_id):
    sid = str(raw_id).strip()
    if sid.lower().startswith('s'):
        sid = sid[1:]
    return int(sid)


def refresh_student_eligibility(student):
    """Recalculate eligibility fields from current student stats."""
    ai = eligibility_ai.predict_eligibility(
        student.attendance_percentage,
        student.internal_marks,
        student.previous_result,
        student.backlogs,
    )

    passed = (
        student.attendance_percentage >= 75
        and ((student.internal_marks / 40) * 100 >= 40)
        and student.backlogs == 0
        and student.fee_paid
        and student.previous_result >= 5.0
    )

    student.is_eligible = passed
    student.ai_risk_score = ai['risk_score']
    student.eligibility_percentage = round((sum([
        student.attendance_percentage >= 75,
        (student.internal_marks / 40) * 100 >= 40,
        student.backlogs == 0,
        student.fee_paid,
        student.previous_result >= 5.0,
    ]) / 5) * 100)
    student.save()
    return student


def refresh_student_attendance_stats(student):
    """Recalculate attendance % and eligibility from attendance records."""
    total = Attendance.objects.filter(student=student).count()
    if total:
        present = Attendance.objects.filter(student=student, status='Present').count()
        student.attendance_percentage = round((present / total) * 100, 1)

    return refresh_student_eligibility(student)
