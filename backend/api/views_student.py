from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.db.models import Q
from .models import User, Student, Exam, Notification, ChatbotLog, HallTicket, SeatingArrangement
from .seating_service import build_qr_content, room_display_name
from .serializers import FaceVerifyRequestSerializer, ChatbotRequestSerializer, StudentProfileUpdateSerializer, PayFeeSerializer
from .permissions import IsStudent
from .auth_utils import verify_password, get_password_hash
from .photo_utils import save_profile_photo
from .fee_service import get_fee_summary, process_fee_payment
import sys
import os
import io
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

# Add ai_modules to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from ai_modules.chatbot import ai_chatbot
from ai_modules.eligibility_model import eligibility_ai
from ai_modules.face_recognition_module import face_ai


def _hall_ticket_payload(student, user):
    """Build hall ticket response from DB record, seating, or defaults."""
    if hasattr(student, 'hall_ticket') and student.hall_ticket.is_active:
        ht = student.hall_ticket
        exam = ht.exam
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
                'subject_code': exam.subject_code,
                'subject_name': exam.subject_name,
                'date': exam.exam_date,
                'time': exam.exam_time,
                'duration': exam.duration,
                'room': ht.room,
            },
            'seat_number': ht.seat_number,
            'qr_code_content': ht.qr_code_content,
        }

    exam = Exam.objects.filter(department=student.department, is_deleted=False).first()
    if not exam:
        exam = Exam.objects.filter(is_deleted=False).first()
    if not exam:
        return None

    seating = SeatingArrangement.objects.filter(
        student=student, exam=exam
    ).select_related('room').first()

    hall_ticket_no = f"HT2026{student.roll_no}"
    if seating:
        seat_number = seating.seat_number
        room = room_display_name(seating.room)
        qr = build_qr_content(
            hall_ticket_no, student.roll_no, exam.subject_code,
            seat_number, seating.room.room_code
        )
    else:
        seat_number = f"S{100 + student.id}"
        room = exam.room
        qr = build_qr_content(hall_ticket_no, student.roll_no, exam.subject_code, seat_number, room)

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
            'subject_code': exam.subject_code,
            'subject_name': exam.subject_name,
            'date': exam.exam_date,
            'time': exam.exam_time,
            'duration': exam.duration,
            'room': room,
        },
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
        'name': request.user.name,
        'roll_no': s.roll_no,
        'department': s.department,
        'attendance': s.attendance_percentage,
        'internal_marks': s.internal_marks,
        'is_eligible': s.is_eligible,
        'ai_risk_score': s.ai_risk_score,
        'eligibility_percentage': s.eligibility_percentage,
        'next_exam': next_exam_data
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
        'is_eligible': s.is_eligible,
        'eligibility_percentage': s.eligibility_percentage,
        'ai_risk_score': s.ai_risk_score
    })


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

    return Response({'message': 'Photo updated', 'photo': photo_url})


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
            'internals': (s.internal_marks / 40.0) >= 0.4,
            'backlogs': s.backlogs == 0,
            'fee': s.fee_paid,
            'previous_sgpa': s.previous_result >= 5.0
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
        s = Student.objects.get(user_id=user.id)
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
    out = io.BytesIO()
    p = canvas.Canvas(out, pagesize=letter)
    p.setFont("Helvetica-Bold", 20)
    p.drawString(100, 740, "National Institute of Technology")
    p.setFont("Helvetica", 14)
    p.drawString(100, 715, "Official Hall Ticket - End Semester Nov 2026")
    p.setFont("Helvetica", 12)
    p.drawString(100, 670, f"Hall Ticket No: {payload['hall_ticket_no']}")
    p.drawString(100, 645, f"Student: {user.name}")
    p.drawString(100, 620, f"Roll Number: {s.roll_no}")
    p.drawString(100, 595, f"Department: {s.department} | Semester {s.semester}")
    p.drawString(100, 560, f"Subject: {exam_data['subject_name']} ({exam_data['subject_code']})")
    p.drawString(100, 535, f"Schedule: {exam_data['date']} at {exam_data['time']} | Duration: {exam_data['duration']}")
    p.drawString(100, 510, f"Exam Hall: {exam_data['room']} | Seat: {payload['seat_number']}")
    p.drawString(100, 460, f"QR: {payload['qr_code_content']}")
    p.drawString(100, 420, "Controller of Examinations (Digitally Signed)")
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
    
    exams = Exam.objects.filter(department=s.department, is_deleted=False)
    data = []
    for e in exams:
        data.append({
            'id': e.id,
            'subject_code': e.subject_code,
            'subject_name': e.subject_name,
            'department': e.department,
            'semester': e.semester,
            'exam_date': e.exam_date,
            'exam_time': e.exam_time,
            'duration': e.duration,
            'room': e.room,
            'total_marks': e.total_marks
        })
    return Response(data)


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])  # Will be protected by middleware
def face_verify(request):
    """Face verification for student"""
    user = getattr(request, '_jwt_user', request.user)
    if not user or not hasattr(user, 'role') or user.role != 'student':
        return Response({'detail': 'Student access required'}, status=status.HTTP_403_FORBIDDEN)
    
    serializer = FaceVerifyRequestSerializer(data=request.data)
    if serializer.is_valid():
        res = face_ai.verify_face(serializer.validated_data['image_base64'], [0.1] * 128)
        return Response({
            'verified': res['verified'],
            'confidence': res['confidence'],
            'message': res['message'],
            'student_name': request.user.name
        })
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])  # Will be protected by middleware
def notifications(request):
    """Student notifications"""
    user = getattr(request, '_jwt_user', request.user)
    if not user or not hasattr(user, 'role') or user.role != 'student':
        return Response({'detail': 'Student access required'}, status=status.HTTP_403_FORBIDDEN)
    
    notifications = Notification.objects.filter(
        audience__in=['all', 'students']
    ).order_by('-created_at')
    
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
