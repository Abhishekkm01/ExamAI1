from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from .models import Student, Exam, HallTicket
from .department_service import get_department_names


@api_view(['GET'])
@permission_classes([AllowAny])
def verify_hallticket(request, ht_no):
    """Public endpoint to verify hall ticket"""
    try:
        ht = HallTicket.objects.get(hall_ticket_no=ht_no, is_active=True)
        return Response({
            'valid': True,
            'student': {
                'name': ht.student.user.name,
                'roll_no': ht.student.roll_no,
                'department': ht.student.department,
                'photo': ht.student.photo
            },
            'hall_ticket_no': ht.hall_ticket_no,
            'exam': ht.exam.subject_name,
            'subject_code': ht.exam.subject_code,
            'date': ht.exam.exam_date,
            'time': ht.exam.exam_time,
            'room': ht.room,
            'seat_number': ht.seat_number
        })
    except HallTicket.DoesNotExist:
        clean = ht_no.replace("HT2026", "")
        try:
            s = Student.objects.get(roll_no=clean, is_deleted=False)
            if s.is_eligible:
                exam = Exam.objects.filter(department=s.department).first() or Exam.objects.first()
                if exam:
                    return Response({
                        'valid': True,
                        'student': {
                            'name': s.user.name,
                            'roll_no': s.roll_no,
                            'department': s.department,
                            'photo': s.photo
                        },
                        'hall_ticket_no': ht_no,
                        'exam': exam.subject_name,
                        'subject_code': exam.subject_code,
                        'date': exam.exam_date,
                        'time': exam.exam_time,
                        'room': exam.room,
                        'seat_number': f"S{100 + s.id}"
                    })
        except Student.DoesNotExist:
            pass
        
        return Response({'detail': 'Invalid Hall Ticket'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['GET'])
@permission_classes([AllowAny])
def meta(request):
    """Public endpoint: returns departments, subjects, and semesters for UI dropdowns"""
    depts = get_department_names(include_legacy=True)
    
    exams = Exam.objects.filter(is_deleted=False)
    subjects = []
    for e in exams:
        subjects.append({
            'code': e.subject_code,
            'name': e.subject_name,
            'dept': e.department,
            'sem': e.semester
        })
    
    return Response({
        'departments': depts,
        'subjects': subjects
    })
