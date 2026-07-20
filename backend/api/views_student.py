from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.db.models import Q
from .models import User, Student, Exam, Notification, ChatbotLog, HallTicket, SeatingArrangement
from .seating_service import room_display_name
from .exam_service import get_exam_subjects, resolve_hall_ticket_exam
from .marks_constants import INTERNAL_MARKS_MAX
from .hall_ticket_service import merge_hall_ticket_subjects, sync_hall_ticket_subjects, refresh_hall_ticket_qr, build_hall_ticket_qr
from .serializers import FaceVerifyRequestSerializer, ChatbotRequestSerializer, StudentProfileUpdateSerializer, PayFeeSerializer
from .permissions import IsStudent
from .auth_utils import verify_password, get_password_hash
from .photo_utils import save_profile_photo
from .face_service import try_enroll_student_face, is_face_enrolled, enroll_face_from_base64, verify_student_face
from .fee_service import get_fee_summary, process_fee_payment
from .settings_service import get_system_settings
from .marks_service import get_student_subject_performance
import sys
import os
import io
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

# Add ai_modules to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from ai_modules.chatbot import ai_chatbot
from ai_modules.eligibility_model import eligibility_ai


def _hall_ticket_payload(student, user):
    """Build hall ticket response from DB record, seating, or defaults."""
    ht = getattr(student, 'hall_ticket', None)
    if ht and ht.is_active:
        # Drop tickets whose linked exam was deleted
        if not ht.exam_id or ht.exam.is_deleted:
            ht.is_active = False
            ht.save(update_fields=['is_active', 'updated_at'])
        else:
            exam = ht.exam
            seating = SeatingArrangement.objects.filter(
                student=student, exam=exam,
            ).select_related('room').first()
            room = ht.room
            seat_number = ht.seat_number
            if seating and not ht.subject_assignments.exists():
                seat_number = seating.seat_number
                room = room_display_name(seating.room)
            if not ht.subject_assignments.exists():
                subjects = sync_hall_ticket_subjects(ht, exam, seat_number, room)
            else:
                subjects = merge_hall_ticket_subjects(ht, exam)
            if not ht.qr_code_content or not ht.qr_code_content.startswith('{'):
                refresh_hall_ticket_qr(ht, exam, student)
            qr = ht.qr_code_content
            room = subjects[0]['room'] if subjects else ht.room
            seat_number = subjects[0]['seat_number'] if subjects else ht.seat_number
            return {
                'is_eligible': True,
                'hall_ticket_no': ht.hall_ticket_no,
                'student': {
                    'name': user.name,
                    'roll_no': student.roll_no,
                    'department': student.department,
                    'photo': student.photo,
                },
                'exam': {
                    'title': exam.title or exam.subject_name,
                    'subject_code': exam.subject_code,
                    'subject_name': exam.subject_name,
                    'date': exam.exam_date,
                    'time': exam.exam_time,
                    'duration': exam.duration,
                    'room': room,
                },
                'subjects': subjects,
                'seat_number': subjects[0]['seat_number'] if subjects else seat_number,
                'qr_code_content': qr,
            }

    exam = resolve_hall_ticket_exam(student)
    if not exam:
        return None

    seating = SeatingArrangement.objects.filter(
        student=student, exam=exam,
    ).select_related('room').first()

    hall_ticket_no = f"HT2026{student.roll_no}"
    if seating:
        seat_number = seating.seat_number
        room = room_display_name(seating.room)
    else:
        seat_number = f"S{100 + student.id}"
        room = exam.room

    subjects = [
        {**subj, 'seat_number': seat_number, 'room': room}
        for subj in get_exam_subjects(exam)
    ]
    from types import SimpleNamespace
    ht_stub = SimpleNamespace(hall_ticket_no=hall_ticket_no)
    qr = build_hall_ticket_qr(ht_stub, exam, student, subjects)

    return {
        'is_eligible': True,
        'hall_ticket_no': hall_ticket_no,
        'student': {
            'name': user.name,
            'roll_no': student.roll_no,
            'department': student.department,
            'photo': student.photo,
        },
        'exam': {
            'title': exam.title or exam.subject_name,
            'subject_code': exam.subject_code,
            'subject_name': exam.subject_name,
            'date': exam.exam_date,
            'time': exam.exam_time,
            'duration': exam.duration,
            'room': room,
        },
        'subjects': subjects,
        'seat_number': seat_number,
        'qr_code_content': qr,
    }


@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])  # Will be protected by middleware
def dashboard(request):
    """Student dashboard"""
    user = getattr(request, '_jwt_user', request.user)
    if not user or not hasattr(user, 'role') or user.role != 'student':
        return Response({'detail': 'Student access required'}, status=status.HTTP_403_FORBIDDEN)
    
    try:
        s = Student.objects.get(user_id=user.id)
    except Student.DoesNotExist:
        return Response({'detail': 'Student profile not found'}, status=status.HTTP_404_NOT_FOUND)
    
    upcoming = Exam.objects.filter(department=s.department, is_deleted=False)
    next_exam = upcoming.first() if upcoming.exists() else None
    
    next_exam_data = None
    if next_exam:
        next_exam_data = {
            'id': next_exam.id,
            'subject_code': next_exam.subject_code,
            'subject_name': next_exam.subject_name,
            'department': next_exam.department,
            'semester': next_exam.semester,
            'exam_date': next_exam.exam_date,
            'exam_time': next_exam.exam_time,
            'duration': next_exam.duration,
            'room': next_exam.room,
            'total_marks': next_exam.total_marks
        }
    
    return Response({
        'name': user.name,
        'roll_no': s.roll_no,
        'department': s.department,
        'attendance': s.attendance_percentage,
        'internal_marks': s.internal_marks,
        'assignment_marks': s.assignment_marks,
        'is_eligible': s.is_eligible,
        'ai_risk_score': s.ai_risk_score,
        'eligibility_percentage': s.eligibility_percentage,
        'next_exam': next_exam_data,
        'subject_performance': get_student_subject_performance(s),
    })


@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])  # Will be protected by middleware
def profile(request):
    """Student profile"""
    user = getattr(request, '_jwt_user', request.user)
    if not user or not hasattr(user, 'role') or user.role != 'student':
        return Response({'detail': 'Student access required'}, status=status.HTTP_403_FORBIDDEN)
    
    try:
        s = Student.objects.get(user_id=user.id)
    except Student.DoesNotExist:
        return Response({'detail': 'Student profile not found'}, status=status.HTTP_404_NOT_FOUND)
    
    return Response({
        'id': s.id,
        'name': user.name,
        'email': user.email,
        'roll_no': s.roll_no,
        'mobile': s.mobile,
        'department': s.department,
        'semester': s.semester,
        'section': s.section,
        'photo': s.photo,
        'attendance': s.attendance_percentage,
        'internal_marks': s.internal_marks,
        'assignment_marks': s.assignment_marks,
        'previous_result': s.previous_result,
        'backlogs': s.backlogs,
        'fee_paid': s.fee_paid,
        'fee_amount': s.fee_amount,
        'fee_due_date': s.fee_due_date,
        'face_enrolled': is_face_enrolled(s),
        'is_eligible': s.is_eligible,
        'eligibility_percentage': s.eligibility_percentage,
        'ai_risk_score': s.ai_risk_score,
        'subject_performance': get_student_subject_performance(s),
    })


@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])
def subject_performance(request):
    """Per-subject internal/assignment/attendance for the logged-in student."""
    user = getattr(request, '_jwt_user', request.user)
    if not user or not hasattr(user, 'role') or user.role != 'student':
        return Response({'detail': 'Student access required'}, status=status.HTTP_403_FORBIDDEN)
    try:
        s = Student.objects.get(user_id=user.id, is_deleted=False)
    except Student.DoesNotExist:
        return Response({'detail': 'Student profile not found'}, status=status.HTTP_404_NOT_FOUND)
    return Response(get_student_subject_performance(s))


@api_view(['PUT'])
@authentication_classes([])
@permission_classes([AllowAny])  # Will be protected by middleware
def update_profile(request):
    """Update student profile fields and optionally change password."""
    user = getattr(request, '_jwt_user', request.user)
    if not user or not hasattr(user, 'role') or user.role != 'student':
        return Response({'detail': 'Student access required'}, status=status.HTTP_403_FORBIDDEN)

    try:
        s = Student.objects.get(user_id=user.id)
    except Student.DoesNotExist:
        return Response({'detail': 'Student profile not found'}, status=status.HTTP_404_NOT_FOUND)

    serializer = StudentProfileUpdateSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    data = serializer.validated_data

    if 'new_password' in data:
        if not verify_password(data['current_password'], user.hashed_password):
            return Response({'detail': 'Current password is incorrect'}, status=status.HTTP_400_BAD_REQUEST)
        user.hashed_password = get_password_hash(data['new_password'])

    if 'name' in data:
        user.name = data['name']
    if 'mobile' in data:
        s.mobile = data['mobile']
    if 'section' in data:
        s.section = data['section']

    user.save()
    s.save()

    return Response({
        'message': 'Profile updated',
        'photo': s.photo,
        'name': user.name,
        'mobile': s.mobile,
        'section': s.section,
    })


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])  # Will be protected by middleware
def upload_profile_photo(request):
    """Upload or replace the student's profile photo."""
    user = getattr(request, '_jwt_user', request.user)
    if not user or not hasattr(user, 'role') or user.role != 'student':
        return Response({'detail': 'Student access required'}, status=status.HTTP_403_FORBIDDEN)

    try:
        s = Student.objects.get(user_id=user.id)
    except Student.DoesNotExist:
        return Response({'detail': 'Student profile not found'}, status=status.HTTP_404_NOT_FOUND)

    if 'photo' not in request.FILES:
        return Response({'detail': 'No photo file provided'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        photo_url = save_profile_photo(request.FILES['photo'], 'student')
    except ValueError as e:
        return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    s.photo = photo_url
    user.avatar = photo_url
    s.save()
    user.save()

    enrolled, enroll_message = try_enroll_student_face(s, photo_url)

    return Response({
        'message': 'Photo updated',
        'photo': photo_url,
        'face_enrolled': enrolled,
        'face_enroll_message': enroll_message,
    })


@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])  # Will be protected by middleware
def eligibility(request):
    """Student eligibility check"""
    user = getattr(request, '_jwt_user', request.user)
    if not user or not hasattr(user, 'role') or user.role != 'student':
        return Response({'detail': 'Student access required'}, status=status.HTTP_403_FORBIDDEN)
    
    try:
        s = Student.objects.get(user_id=user.id)
    except Student.DoesNotExist:
        return Response({'detail': 'Student profile not found'}, status=status.HTTP_404_NOT_FOUND)
    
    ai = eligibility_ai.predict_eligibility(
        s.attendance_percentage,
        s.internal_marks,
        s.previous_result,
        s.backlogs
    )
    
    return Response({
        'is_eligible': s.is_eligible,
        'eligibility_percentage': s.eligibility_percentage,
        'ai_risk_score': s.ai_risk_score,
        'ai_probability': ai['probability'],
        'checks': {
            'attendance': s.attendance_percentage >= 75.0,
            'internals': (s.internal_marks / INTERNAL_MARKS_MAX) * 100 >= 40,
            'fee': s.fee_paid,
        }
    })


@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])  # Will be protected by middleware
def get_hallticket(request):
    """Get student hall ticket"""
    user = getattr(request, '_jwt_user', request.user)
    if not user or not hasattr(user, 'role') or user.role != 'student':
        return Response({'detail': 'Student access required'}, status=status.HTTP_403_FORBIDDEN)
    
    try:
        s = Student.objects.select_related(
            'user', 'hall_ticket', 'hall_ticket__exam',
        ).prefetch_related('hall_ticket__subject_assignments').get(user_id=user.id)
    except Student.DoesNotExist:
        return Response({'detail': 'Student profile not found'}, status=status.HTTP_404_NOT_FOUND)
    
    if not s.is_eligible:
        return Response({'is_eligible': False})

    payload = _hall_ticket_payload(s, user)
    if not payload:
        return Response({'detail': 'No exam found'}, status=status.HTTP_404_NOT_FOUND)
    return Response(payload)


@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])  # Will be protected by middleware
def download_hallticket(request):
    """Download hall ticket as PDF"""
    user = getattr(request, '_jwt_user', request.user)
    if not user or not hasattr(user, 'role') or user.role != 'student':
        return Response({'detail': 'Student access required'}, status=status.HTTP_403_FORBIDDEN)
    
    try:
        s = Student.objects.get(user_id=user.id)
    except Student.DoesNotExist:
        return Response({'detail': 'Student profile not found'}, status=status.HTTP_404_NOT_FOUND)
    
    if not s.is_eligible:
        return Response({'detail': 'Not eligible to download hall ticket'}, status=status.HTTP_403_FORBIDDEN)

    payload = _hall_ticket_payload(s, user)
    if not payload:
        return Response({'detail': 'No exam found'}, status=status.HTTP_404_NOT_FOUND)

    exam_data = payload['exam']
    subjects = payload.get('subjects') or [exam_data]
    cfg = get_system_settings()
    out = io.BytesIO()
    p = canvas.Canvas(out, pagesize=letter)
    p.setFont("Helvetica-Bold", 20)
    p.drawString(100, 740, cfg.university_name)
    p.setFont("Helvetica", 14)
    p.drawString(100, 715, f"{exam_data.get('title') or exam_data.get('subject_name') or 'Examination'} - Academic Year {cfg.academic_year}")
    p.setFont("Helvetica", 12)
    p.drawString(100, 670, f"Hall Ticket No: {payload['hall_ticket_no']}")
    p.drawString(100, 645, f"Student: {user.name}")
    p.drawString(100, 620, f"Roll Number: {s.roll_no}")
    p.drawString(100, 595, f"Department: {s.department} | Semester {s.semester}")
    y = 570
    p.drawString(100, y, f"Examination: {exam_data.get('title') or exam_data.get('subject_name')}")
    y -= 22
    p.drawString(100, y, "Subjects:")
    y -= 18
    for subj in subjects:
        p.drawString(110, y, f"- {subj['subject_name']} ({subj['subject_code']}) — {subj.get('exam_date', exam_data['date'])} at {subj.get('exam_time', exam_data['time'])}")
        y -= 16
    p.drawString(100, y - 4, f"Exam Hall: {exam_data['room']} | Seat: {payload['seat_number']}")
    p.drawString(100, y - 28, f"QR: {payload['qr_code_content']}")
    p.drawString(100, y - 68, "Controller of Examinations (Digitally Signed)")
    p.showPage()
    p.save()
    out.seek(0)
    
    from django.http import HttpResponse
    response = HttpResponse(out.read(), content_type='application/pdf')
    response['Content-Disposition'] = f'attachment; filename=HallTicket_{s.roll_no}.pdf'
    return response


@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])  # Will be protected by middleware
def exams(request):
    """List student exams"""
    user = getattr(request, '_jwt_user', request.user)
    if not user or not hasattr(user, 'role') or user.role != 'student':
        return Response({'detail': 'Student access required'}, status=status.HTTP_403_FORBIDDEN)
    
    try:
        s = Student.objects.get(user_id=user.id)
    except Student.DoesNotExist:
        return Response({'detail': 'Student profile not found'}, status=status.HTTP_404_NOT_FOUND)
    
    from .exam_service import get_exam_subjects

    exams = Exam.objects.filter(department=s.department, is_deleted=False).prefetch_related(
        'subjects__invigilator__user',
    )
    data = []
    for e in exams:
        subjects = get_exam_subjects(e)
        primary = subjects[0] if subjects else {}
        data.append({
            'id': e.id,
            'title': e.title or e.subject_name,
            'subject_code': primary.get('subject_code') or e.subject_code,
            'subject_name': primary.get('subject_name') or e.subject_name,
            'department': e.department,
            'semester': e.semester,
            'exam_date': e.exam_date,
            'exam_time': e.exam_time,
            'duration': e.duration,
            'room': e.room,
            'total_marks': e.total_marks,
            'subjects': [
                {
                    'subject_code': sub.get('subject_code'),
                    'subject_name': sub.get('subject_name'),
                    'exam_date': sub.get('exam_date'),
                    'exam_time': sub.get('exam_time'),
                    'duration': sub.get('duration'),
                }
                for sub in subjects
            ],
        })
    return Response(data)


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])  # Will be protected by middleware
def face_enroll(request):
    """Enroll the student's face from a live webcam capture."""
    user = getattr(request, '_jwt_user', request.user)
    if not user or not hasattr(user, 'role') or user.role != 'student':
        return Response({'detail': 'Student access required'}, status=status.HTTP_403_FORBIDDEN)

    try:
        s = Student.objects.get(user_id=user.id)
    except Student.DoesNotExist:
        return Response({'detail': 'Student profile not found'}, status=status.HTTP_404_NOT_FOUND)

    serializer = FaceVerifyRequestSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    ok, message = enroll_face_from_base64(s, serializer.validated_data['image_base64'])
    if not ok:
        return Response({'detail': message, 'face_enrolled': False}, status=status.HTTP_400_BAD_REQUEST)

    return Response({
        'message': 'Face enrolled successfully',
        'face_enrolled': True,
        'student_name': user.name,
    })


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])  # Will be protected by middleware
def face_verify(request):
    """Face verification for student"""
    user = getattr(request, '_jwt_user', request.user)
    if not user or not hasattr(user, 'role') or user.role != 'student':
        return Response({'detail': 'Student access required'}, status=status.HTTP_403_FORBIDDEN)

    try:
        s = Student.objects.get(user_id=user.id)
    except Student.DoesNotExist:
        return Response({'detail': 'Student profile not found'}, status=status.HTTP_404_NOT_FOUND)

    serializer = FaceVerifyRequestSerializer(data=request.data)
    if serializer.is_valid():
        res = verify_student_face(s, serializer.validated_data['image_base64'])
        return Response({
            'verified': res['verified'],
            'confidence': res['confidence'],
            'message': res['message'],
            'student_name': res.get('student_name', user.name),
            'roll_no': res.get('roll_no', s.roll_no),
            'department': s.department,
            'face_enrolled': is_face_enrolled(s),
        })

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])  # Will be protected by middleware
def notifications(request):
    """Student notifications — college-wide plus own department HOD notices."""
    user = getattr(request, '_jwt_user', request.user)
    if not user or not hasattr(user, 'role') or user.role != 'student':
        return Response({'detail': 'Student access required'}, status=status.HTTP_403_FORBIDDEN)

    try:
        student = Student.objects.get(user_id=user.id, is_deleted=False)
        dept = student.department
    except Student.DoesNotExist:
        dept = None

    qs = Notification.objects.filter(audience__in=['all', 'students'])
    if dept:
        prefix = f'[{dept}]'
        qs = qs.filter(Q(title__startswith=prefix) | ~Q(title__startswith='['))
    notifications = qs.order_by('-created_at')
    
    data = []
    for n in notifications:
        data.append({
            'id': n.id,
            'title': n.title,
            'message': n.message,
            'audience': n.audience,
            'is_read': n.is_read,
            'created_at': n.created_at.isoformat() if n.created_at else None
        })
    return Response(data)


@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])
def get_fees(request):
    """Student fee status and payment history."""
    user = getattr(request, '_jwt_user', request.user)
    if not user or not hasattr(user, 'role') or user.role != 'student':
        return Response({'detail': 'Student access required'}, status=status.HTTP_403_FORBIDDEN)

    try:
        s = Student.objects.get(user_id=user.id)
    except Student.DoesNotExist:
        return Response({'detail': 'Student profile not found'}, status=status.HTTP_404_NOT_FOUND)

    return Response(get_fee_summary(s))


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def pay_fee(request):
    """Process a simulated fee payment (online, bank transfer, or college office)."""
    user = getattr(request, '_jwt_user', request.user)
    if not user or not hasattr(user, 'role') or user.role != 'student':
        return Response({'detail': 'Student access required'}, status=status.HTTP_403_FORBIDDEN)

    try:
        s = Student.objects.get(user_id=user.id)
    except Student.DoesNotExist:
        return Response({'detail': 'Student profile not found'}, status=status.HTTP_404_NOT_FOUND)

    serializer = PayFeeSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    data = serializer.validated_data
    payment, error = process_fee_payment(s, data['method'], data.get('reference', ''))
    if error:
        return Response({'detail': error}, status=status.HTTP_400_BAD_REQUEST)

    s.refresh_from_db()
    summary = get_fee_summary(s)
    return Response({
        'message': 'Payment submitted for admin verification',
        'transaction_id': payment.transaction_id,
        'fee_paid': s.fee_paid,
        'payment_pending': True,
        'is_eligible': s.is_eligible,
        'eligibility_percentage': s.eligibility_percentage,
        'payment': summary['pending_payment'],
    }, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])  # Will be protected by middleware
def chatbot(request):
    """AI chatbot for student"""
    user = getattr(request, '_jwt_user', request.user)
    if not user or not hasattr(user, 'role') or user.role != 'student':
        return Response({'detail': 'Student access required'}, status=status.HTTP_403_FORBIDDEN)
    
    serializer = ChatbotRequestSerializer(data=request.data)
    if serializer.is_valid():
        try:
            s = Student.objects.get(user_id=user.id)
        except Student.DoesNotExist:
            return Response({'detail': 'Student profile not found'}, status=status.HTTP_404_NOT_FOUND)
        
        ctx = {
            'name': user.name,
            'roll_no': s.roll_no,
            'department': s.department,
            'attendance_percentage': s.attendance_percentage,
            'internal_marks': s.internal_marks,
            'assignment_marks': s.assignment_marks,
            'previous_result': s.previous_result,
            'backlogs': s.backlogs,
            'fee_paid': s.fee_paid,
            'fee_amount': s.fee_amount,
            'fee_due_date': s.fee_due_date,
            'is_eligible': s.is_eligible,
            'eligibility_percentage': s.eligibility_percentage,
            'ai_risk_score': s.ai_risk_score
        }
        
        reply = ai_chatbot.get_response(serializer.validated_data['user_query'], ctx)
        
        ChatbotLog.objects.create(
            student=s,
            user_query=serializer.validated_data['user_query'],
            bot_response=reply
        )
        
        return Response({'response': reply})
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
