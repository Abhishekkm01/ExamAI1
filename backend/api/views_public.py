from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from .models import HallTicket
from .department_service import get_department_names
from .settings_service import get_system_settings
from .exam_service import resolve_hall_ticket_exam
from .hall_ticket_service import extract_ht_no, verify_hall_ticket_record


def _lookup_and_verify(ht_no, scanned_content=None):
    ht_no = (ht_no or '').strip().upper()
    if not ht_no:
        return None, Response({'valid': False, 'detail': 'Hall ticket number is required'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        ht = HallTicket.objects.select_related('student__user', 'exam').get(
            hall_ticket_no=ht_no, is_active=True, exam__is_deleted=False,
        )
    except HallTicket.DoesNotExist:
        return None, Response({'valid': False, 'detail': 'Invalid Hall Ticket'}, status=status.HTTP_404_NOT_FOUND)

    exam = resolve_hall_ticket_exam(ht.student, ht) or ht.exam
    result = verify_hall_ticket_record(ht, exam, scanned_content=scanned_content)
    if not result.get('valid'):
        return None, Response(result, status=status.HTTP_400_BAD_REQUEST)
    return result, None


@api_view(['GET'])
@permission_classes([AllowAny])
def verify_hallticket(request, ht_no):
    """Public endpoint to verify hall ticket by number (manual lookup)."""
    result, error = _lookup_and_verify(ht_no)
    if error:
        return error
    return Response(result)


@api_view(['POST'])
@permission_classes([AllowAny])
def verify_hallticket_scan(request):
    """Verify hall ticket from scanned QR content (full JSON or legacy pipe format)."""
    scanned = (request.data.get('code') or '').strip()
    if not scanned:
        return Response({'valid': False, 'detail': 'QR code content is required'}, status=status.HTTP_400_BAD_REQUEST)

    ht_no = extract_ht_no(scanned)
    if not ht_no:
        return Response({'valid': False, 'detail': 'Invalid QR code format'}, status=status.HTTP_400_BAD_REQUEST)

    result, error = _lookup_and_verify(ht_no, scanned_content=scanned)
    if error:
        return error
    return Response(result)


@api_view(['GET'])
@permission_classes([AllowAny])
def meta(request):
    """Public endpoint: returns departments, subjects, and semesters for UI dropdowns"""
    depts = get_department_names()

    from .models import Exam
    exams = Exam.objects.filter(is_deleted=False)
    subjects = []
    for e in exams:
        subjects.append({
            'code': e.subject_code,
            'name': e.subject_name,
            'dept': e.department,
            'sem': e.semester
        })

    cfg = get_system_settings()
    return Response({
        'departments': depts,
        'subjects': subjects,
        'university_name': cfg.university_name,
        'academic_year': cfg.academic_year,
        'current_semester': cfg.current_semester,
        'college_logo_url': cfg.college_logo_url or '',
        'default_exam_fee': float(cfg.default_exam_fee or 45000),
        'default_college_fee': float(getattr(cfg, 'default_college_fee', None) or 25000),
        'default_backlog_fee': float(getattr(cfg, 'default_backlog_fee', None) or 1500),
        'eligibility_thresholds': {
            'attendance': cfg.attendance_threshold,
            'internal_marks': cfg.internal_marks_threshold,
        },
    })
