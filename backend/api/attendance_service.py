import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from ai_modules.eligibility_model import eligibility_ai

from .models import Attendance, Student
from .settings_service import get_system_settings


def parse_student_id(raw_id):
    sid = str(raw_id).strip()
    if sid.lower().startswith('s'):
        sid = sid[1:]
    return int(sid)


def refresh_student_eligibility(student):
    """Recalculate eligibility fields from current student stats."""
    cfg = get_system_settings()
    ai = eligibility_ai.predict_eligibility(
        student.attendance_percentage,
        student.internal_marks,
        student.previous_result,
        student.backlogs,
        attendance_threshold=cfg.attendance_threshold,
        min_sgpa=cfg.min_sgpa,
    )

    internal_pct = (student.internal_marks / 40) * 100
    passed = (
        student.attendance_percentage >= cfg.attendance_threshold
        and internal_pct >= cfg.internal_marks_threshold
        and student.backlogs == 0
        and student.fee_paid
        and student.previous_result >= cfg.min_sgpa
    )

    student.is_eligible = passed
    student.ai_risk_score = ai['risk_score']
    student.eligibility_percentage = round((sum([
        student.attendance_percentage >= cfg.attendance_threshold,
        internal_pct >= cfg.internal_marks_threshold,
        student.backlogs == 0,
        student.fee_paid,
        student.previous_result >= cfg.min_sgpa,
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


def get_attendance_trends(days=7):
    """Daily present/absent percentages for the last N days from attendance records."""
    from datetime import date, timedelta

    trends = []
    today = date.today()
    for offset in range(days - 1, -1, -1):
        day = today - timedelta(days=offset)
        day_str = day.isoformat()
        records = Attendance.objects.filter(record_date=day_str)
        total = records.count()
        present = records.filter(status='Present').count()
        absent = records.filter(status='Absent').count()
        attendance_pct = round((present / total) * 100) if total else 0
        absent_pct = round((absent / total) * 100) if total else 0
        trends.append({
            'day': day.strftime('%a'),
            'date': day_str,
            'attendance': attendance_pct,
            'absent': absent_pct,
            'present_count': present,
            'absent_count': absent,
            'total': total,
        })
    return trends
