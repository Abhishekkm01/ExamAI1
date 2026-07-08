from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.db.models import Q, Sum, Avg
from django.db import transaction
from .models import User, Student, Teacher, Exam, HallTicket, Notification, EligibilityPrediction, RoleEnum, SeatingArrangement, SeatingRoom, FeePayment
from .seating_service import SeatingArrangementService, build_qr_content, room_display_name
from .serializers import (StudentSerializer, TeacherSerializer, ExamSerializer,
                          StudentCreateSerializer, StudentUpdateSerializer, ExamCreateSerializer,
                          NotificationCreateSerializer, NotificationSerializer, AdminProfileUpdateSerializer,
                          HallTicketUpdateSerializer, FeePaymentReviewSerializer)
from .permissions import IsAdmin
from .auth_utils import get_password_hash, verify_password
from .photo_utils import save_profile_photo
from .fee_service import (
    admin_mark_fee_paid, approve_fee_payment, list_pending_payments, reject_fee_payment,
)
from .attendance_service import refresh_student_eligibility
import sys
import os
import io
import openpyxl
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from rest_framework.decorators import permission_classes as rf_permission_classes

# Add ai_modules to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from ai_modules.eligibility_model import eligibility_ai
from .attendance_service import refresh_student_eligibility
from .marks_service import update_student_marks


@api_view(['GET'])
@authentication_classes([])
@rf_permission_classes([IsAdmin])
def dashboard(request):
    """Admin dashboard metrics"""
    students = Student.objects.filter(is_deleted=False)
    eligible_count = students.filter(is_eligible=True).count()
    hall_tickets_count = HallTicket.objects.filter(is_active=True).count()
    
    avg_att = students.aggregate(avg_att=Avg('attendance_percentage'))['avg_att'] or 0
    avg_att = round(avg_att, 1)
    
    upcoming_count = Exam.objects.filter(is_deleted=False).count()
    
    recent_students = students[:5]
    recent_data = []
    for s in recent_students:
        recent_data.append({
            'id': s.id,
            'name': s.user.name,
            'roll_no': s.roll_no,
            'department': s.department,
            'attendance': s.attendance_percentage,
            'internals': s.internal_marks,
            'is_eligible': s.is_eligible,
            'photo': s.photo
        })
    
    return Response({
        'total_students': students.count(),
        'eligible_students': eligible_count,
        'hall_tickets_generated': hall_tickets_count,
        'avg_attendance': avg_att,
        'upcoming_exams': upcoming_count,
        'recent_students': recent_data
    })


@api_view(['GET'])
@authentication_classes([])
@rf_permission_classes([IsAdmin])
def list_students(request):
    """List students with pagination and filtering"""
    search = request.query_params.get('search')
    department = request.query_params.get('department', 'all')
    page = int(request.query_params.get('page', 1))
    page_size = int(request.query_params.get('page_size', 100))
    
    queryset = Student.objects.filter(is_deleted=False).select_related('user')
    
    if department and department != 'all':
        queryset = queryset.filter(department=department)
    
    if search:
        queryset = queryset.filter(
            Q(user__name__icontains=search) |
            Q(roll_no__icontains=search) |
            Q(user__email__icontains=search)
        )
    
    total = queryset.count()
    start = (page - 1) * page_size
    end = start + page_size
    students = queryset[start:end]
    
    data = []
    for s in students:
        data.append({
            'id': s.id,
            'user_id': s.user_id,
            'name': s.user.name,
            'email': s.user.email,
            'roll_no': s.roll_no,
            'department': s.department,
            'semester': s.semester,
            'section': s.section,
            'mobile': s.mobile,
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
    
    return Response({
        'total': total,
        'page': page,
        'page_size': page_size,
        'students': data
    })


@api_view(['GET'])
@authentication_classes([])
@rf_permission_classes([IsAdmin])
def get_student(request, sid):
    """Get single student details"""
    try:
        s = Student.objects.get(id=sid, is_deleted=False)
    except Student.DoesNotExist:
        return Response({'detail': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
    
    return Response({
        'id': s.id,
        'user_id': s.user_id,
        'name': s.user.name,
        'email': s.user.email,
        'roll_no': s.roll_no,
        'department': s.department,
        'semester': s.semester,
        'section': s.section,
        'mobile': s.mobile,
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


@api_view(['POST'])
@authentication_classes([])
@rf_permission_classes([IsAdmin])
def create_student(request):
    """Create a new student"""
    serializer = StudentCreateSerializer(data=request.data)
    if serializer.is_valid():
        data = serializer.validated_data
        
        with transaction.atomic():
            user = User.objects.create(
                email=data['email'],
                hashed_password=get_password_hash(data['password']),
                name=data['name'],
                role=RoleEnum.STUDENT,
                avatar=data.get('photo') or f"https://api.dicebear.com/7.x/avataaars/svg?seed={data['roll_no']}",
            )
            
            ai = eligibility_ai.predict_eligibility(
                data['attendance_percentage'],
                data['internal_marks'],
                data['previous_result'],
                data['backlogs'],
            )
            
            student = Student.objects.create(
                user=user,
                roll_no=data['roll_no'],
                mobile=data.get('mobile'),
                department=data['department'],
                semester=data['semester'],
                section=data.get('section', 'A'),
                photo=user.avatar,
                attendance_percentage=data['attendance_percentage'],
                internal_marks=data['internal_marks'],
                assignment_marks=data['assignment_marks'],
                previous_result=data['previous_result'],
                backlogs=data['backlogs'],
                fee_paid=data['fee_paid'],
                fee_amount=data['fee_amount'],
                fee_due_date=data.get('fee_due_date'),
                is_eligible=ai['is_eligible'],
                eligibility_percentage=ai['probability'] * 100.0,
                ai_risk_score=ai['risk_score'],
            )
        
        return Response({'message': 'Student created', 'student_id': student.id}, 
                       status=status.HTTP_201_CREATED)
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['PUT'])
@authentication_classes([])
@rf_permission_classes([IsAdmin])
def update_student(request, sid):
    """Update student"""
    try:
        s = Student.objects.get(id=sid, is_deleted=False)
    except Student.DoesNotExist:
        return Response({'detail': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
    
    serializer = StudentUpdateSerializer(data=request.data, partial=True)
    if serializer.is_valid():
        data = serializer.validated_data
        subject_code = request.data.get('subject_code', 'CS301')

        for field, value in data.items():
            setattr(s, field, value)

        if 'internal_marks' in data or 'assignment_marks' in data:
            update_student_marks(
                s,
                subject_code,
                internal_marks=data.get('internal_marks', s.internal_marks),
                assignment_marks=data.get('assignment_marks', s.assignment_marks),
            )
        else:
            refresh_student_eligibility(s)

        return Response({
            'message': 'Updated',
            'internal_marks': s.internal_marks,
            'assignment_marks': s.assignment_marks,
            'is_eligible': s.is_eligible,
        })
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['DELETE'])
@authentication_classes([])
@rf_permission_classes([IsAdmin])
def delete_student(request, sid):
    """Soft delete student"""
    try:
        s = Student.objects.get(id=sid)
    except Student.DoesNotExist:
        return Response({'detail': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
    
    s.is_deleted = True
    s.user.is_deleted = True
    s.save()
    s.user.save()
    
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['GET'])
@authentication_classes([])
@rf_permission_classes([IsAdmin])
def list_teachers(request):
    """List all teachers"""
    teachers = Teacher.objects.filter(is_deleted=False).select_related('user')
    data = []
    for t in teachers:
        data.append({
            'id': t.id,
            'name': t.user.name,
            'email': t.user.email,
            'emp_id': t.emp_id,
            'department': t.department,
            'photo': t.photo,
            'assigned_subjects': t.assigned_subjects.split(',') if t.assigned_subjects else []
        })
    return Response(data)


@api_view(['GET'])
@authentication_classes([])
@rf_permission_classes([IsAdmin])
def list_exams(request):
    """List all exams"""
    exams = Exam.objects.filter(is_deleted=False)
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
@rf_permission_classes([IsAdmin])
def create_exam(request):
    """Create a new exam"""
    serializer = ExamCreateSerializer(data=request.data)
    if serializer.is_valid():
        exam = Exam.objects.create(**serializer.validated_data)
        return Response({'message': 'Exam scheduled', 'exam_id': exam.id}, 
                       status=status.HTTP_201_CREATED)
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@authentication_classes([])
@rf_permission_classes([IsAdmin])
def verify_all(request):
    """Verify eligibility for all students"""
    students = Student.objects.filter(is_deleted=False)
    
    for s in students:
        ai = eligibility_ai.predict_eligibility(
            s.attendance_percentage,
            s.internal_marks,
            s.previous_result,
            s.backlogs,
        )
        
        passed = (s.attendance_percentage >= 75.0) and \
                 ((s.internal_marks / 40.0) >= 0.4) and \
                 (s.backlogs == 0) and \
                 s.fee_paid and \
                 (s.previous_result >= 5.0)
        
        s.is_eligible = passed
        s.eligibility_percentage = round(ai['probability'] * 100.0, 1)
        s.ai_risk_score = ai['risk_score']
        s.save()
        
        EligibilityPrediction.objects.create(
            student=s,
            predicted_probability=ai['probability'],
            risk_score=ai['risk_score']
        )
    
    return Response({'message': f'Verified eligibility for {students.count()} students.'})


@api_view(['POST'])
@authentication_classes([])
@rf_permission_classes([IsAdmin])
def generate_halltickets(request):
    """Generate hall tickets for all eligible students (uses seating if available)."""
    exam_id = request.data.get('exam_id')
    if exam_id:
        try:
            count = SeatingArrangementService.sync_hall_tickets(exam_id)
            return Response({'message': f'Synced {count} hall tickets from seating arrangements.'})
        except ValueError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    eligible = Student.objects.filter(is_deleted=False, is_eligible=True)
    count = 0

    for s in eligible:
        exam = Exam.objects.filter(department=s.department, is_deleted=False).first()
        if not exam:
            exam = Exam.objects.filter(is_deleted=False).first()
        if not exam:
            continue

        seating = SeatingArrangement.objects.filter(student=s, exam=exam).select_related('room').first()
        if seating:
            SeatingArrangementService.sync_arrangement_to_hall_ticket(seating)
            count += 1
            continue

        if hasattr(s, 'hall_ticket') and s.hall_ticket.is_active:
            continue

        hall_ticket_no = f"HT2026{s.roll_no}"
        seat_number = f"S{100 + s.id}"
        room = exam.room
        HallTicket.objects.create(
            hall_ticket_no=hall_ticket_no,
            student=s,
            exam=exam,
            seat_number=seat_number,
            room=room,
            qr_code_content=build_qr_content(hall_ticket_no, s.roll_no, exam.subject_code, seat_number, room),
        )
        count += 1

    return Response({'message': f'Generated {count} hall tickets.'})


@api_view(['PUT'])
@authentication_classes([])
@rf_permission_classes([IsAdmin])
def update_hallticket(request, ht_id):
    """Admin: update seat number and hall/room on a hall ticket."""
    try:
        ht = HallTicket.objects.select_related('student', 'exam').get(id=ht_id, is_active=True)
    except HallTicket.DoesNotExist:
        return Response({'detail': 'Hall ticket not found'}, status=status.HTTP_404_NOT_FOUND)

    serializer = HallTicketUpdateSerializer(data=request.data, partial=True)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    data = serializer.validated_data
    if 'seat_number' in data:
        ht.seat_number = data['seat_number']
    if 'room' in data:
        ht.room = data['room']

    ht.qr_code_content = build_qr_content(
        ht.hall_ticket_no, ht.student.roll_no, ht.exam.subject_code,
        ht.seat_number, ht.room
    )
    ht.save()

    seating = SeatingArrangement.objects.filter(
        student=ht.student, exam=ht.exam
    ).select_related('room').first()
    if seating and 'seat_number' in data:
        seating.seat_number = data['seat_number']
        seating.save()
    if seating and 'room' in data:
        room = SeatingRoom.objects.filter(
            Q(room_name__icontains=data['room']) | Q(room_code__icontains=data['room']),
            is_active=True,
        ).first()
        if room:
            seating.room = room
            seating.save()

    return Response({
        'id': ht.id,
        'hall_ticket_no': ht.hall_ticket_no,
        'seat_number': ht.seat_number,
        'room': ht.room,
        'qr_code_content': ht.qr_code_content,
        'message': 'Hall ticket updated',
    })


@api_view(['GET'])
@authentication_classes([])
@rf_permission_classes([IsAdmin])
def list_halltickets(request):
    """List all hall tickets"""
    hts = HallTicket.objects.filter(is_active=True).select_related('student', 'student__user', 'exam')
    data = []
    for h in hts:
        data.append({
            'id': h.id,
            'hall_ticket_no': h.hall_ticket_no,
            'student_id': h.student_id,
            'student_name': h.student.user.name,
            'roll_no': h.student.roll_no,
            'department': h.student.department,
            'photo': h.student.photo,
            'seat_number': h.seat_number,
            'room': h.room,
            'exam': h.exam.subject_name,
            'exam_id': h.exam_id,
            'subject_code': h.exam.subject_code,
            'qr_code_content': h.qr_code_content,
        })
    return Response(data)


@api_view(['GET'])
@authentication_classes([])
@rf_permission_classes([IsAdmin])
def backlogs(request):
    """List students with backlogs"""
    students = Student.objects.filter(backlogs__gt=0, is_deleted=False).select_related('user')
    data = []
    for s in students:
        data.append({
            'id': s.id,
            'name': s.user.name,
            'roll_no': s.roll_no,
            'department': s.department,
            'backlogs': s.backlogs,
            'attendance': s.attendance_percentage,
            'is_eligible': s.is_eligible
        })
    return Response(data)


@api_view(['GET'])
@authentication_classes([])
@rf_permission_classes([IsAdmin])
def fees(request):
    """Fee status report"""
    students = Student.objects.filter(is_deleted=False)
    paid = [s for s in students if s.fee_paid]
    unpaid = [s for s in students if not s.fee_paid]
    
    unpaid_data = []
    for s in unpaid:
        unpaid_data.append({
            'id': s.id,
            'name': s.user.name,
            'roll_no': s.roll_no,
            'amount': s.fee_amount,
            'due_date': s.fee_due_date,
            'photo': s.photo
        })
    
    pending = list_pending_payments()

    return Response({
        'total_collected': sum(s.fee_amount for s in paid),
        'total_due': sum(s.fee_amount for s in unpaid),
        'paid_count': len(paid),
        'unpaid_count': len(unpaid),
        'unpaid_students': unpaid_data,
        'pending_verifications': pending,
        'pending_count': len(pending),
    })


@api_view(['PUT'])
@authentication_classes([])
@rf_permission_classes([IsAdmin])
def approve_fee_payment_view(request, payment_id):
    """Approve a student-submitted fee payment."""
    user = getattr(request, '_jwt_user', request.user)
    try:
        payment = FeePayment.objects.select_related('student').get(id=payment_id)
    except FeePayment.DoesNotExist:
        return Response({'detail': 'Payment not found'}, status=status.HTTP_404_NOT_FOUND)

    serializer = FeePaymentReviewSerializer(data=request.data or {})
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    note = serializer.validated_data.get('admin_note', '')
    payment, error = approve_fee_payment(payment, user, note)
    if error:
        return Response({'detail': error}, status=status.HTTP_400_BAD_REQUEST)

    return Response({'message': 'Payment approved', 'payment_id': payment.id})


@api_view(['PUT'])
@authentication_classes([])
@rf_permission_classes([IsAdmin])
def reject_fee_payment_view(request, payment_id):
    """Reject a student-submitted fee payment."""
    user = getattr(request, '_jwt_user', request.user)
    try:
        payment = FeePayment.objects.select_related('student').get(id=payment_id)
    except FeePayment.DoesNotExist:
        return Response({'detail': 'Payment not found'}, status=status.HTTP_404_NOT_FOUND)

    serializer = FeePaymentReviewSerializer(data=request.data or {})
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    note = serializer.validated_data.get('admin_note', 'Rejected by admin')
    payment, error = reject_fee_payment(payment, user, note)
    if error:
        return Response({'detail': error}, status=status.HTTP_400_BAD_REQUEST)

    return Response({'message': 'Payment rejected', 'payment_id': payment.id})


@api_view(['PUT'])
@authentication_classes([])
@rf_permission_classes([IsAdmin])
def mark_fee_paid(request, sid):
    """Mark fee as paid for a student"""
    user = getattr(request, '_jwt_user', request.user)
    try:
        s = Student.objects.get(id=sid)
    except Student.DoesNotExist:
        return Response({'detail': 'Not found'}, status=status.HTTP_404_NOT_FOUND)

    payment, error = admin_mark_fee_paid(s, user)
    if error:
        return Response({'detail': error}, status=status.HTTP_400_BAD_REQUEST)

    return Response({'message': 'Fee marked as paid'})


@api_view(['POST'])
@authentication_classes([])
@rf_permission_classes([IsAdmin])
def send_notification(request):
    """Send a notification"""
    serializer = NotificationCreateSerializer(data=request.data)
    if serializer.is_valid():
        notification = Notification.objects.create(**serializer.validated_data)
        return Response({'message': 'Notification sent'}, status=status.HTTP_201_CREATED)
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@authentication_classes([])
@rf_permission_classes([IsAdmin])
def list_notifications(request):
    """List all notifications"""
    notifications = Notification.objects.all().order_by('-created_at')
    serializer = NotificationSerializer(notifications, many=True)
    return Response(serializer.data)


@api_view(['GET'])
@authentication_classes([])
@rf_permission_classes([IsAdmin])
def analytics(request):
    """Analytics data"""
    students = Student.objects.filter(is_deleted=False)
    dept = {}
    for s in students:
        dept[s.department] = dept.get(s.department, 0) + 1
    
    dept_data = [{'name': k, 'value': v} for k, v in dept.items()]
    attendance_data = [{'name': s.user.name.split()[0], 'attendance': s.attendance_percentage} for s in students]
    
    return Response({
        'department_distribution': dept_data,
        'attendance_data': attendance_data
    })


@api_view(['GET'])
@authentication_classes([])
@rf_permission_classes([IsAdmin])
def export_report(request):
    """Export report in Excel or PDF format"""
    report_type = request.query_params.get('report_type', 'attendance')
    format_type = request.query_params.get('format', 'excel')
    
    students = Student.objects.filter(is_deleted=False).select_related('user')
    
    if format_type == 'excel':
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = report_type.title()
        
        if report_type == 'attendance':
            ws.append(['Roll No', 'Name', 'Department', 'Attendance %'])
            for s in students:
                ws.append([s.roll_no, s.user.name, s.department, s.attendance_percentage])
        elif report_type == 'marks':
            ws.append(['Roll No', 'Name', 'Department', 'Internal', 'Assignment'])
            for s in students:
                ws.append([s.roll_no, s.user.name, s.department, s.internal_marks, s.assignment_marks])
        elif report_type == 'eligibility':
            ws.append(['Roll No', 'Name', 'Department', 'Eligibility %', 'Status', 'Risk Score'])
            for s in students:
                ws.append([s.roll_no, s.user.name, s.department, s.eligibility_percentage, 
                          'Eligible' if s.is_eligible else 'Not Eligible', s.ai_risk_score])
        
        out = io.BytesIO()
        wb.save(out)
        out.seek(0)
        
        from django.http import HttpResponse
        response = HttpResponse(
            out.read(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        response['Content-Disposition'] = f'attachment; filename={report_type}.xlsx'
        return response
    
    # PDF export
    out = io.BytesIO()
    p = canvas.Canvas(out, pagesize=letter)
    p.drawString(100, 750, f"ExamShield AI - {report_type.title()} Report")
    p.drawString(100, 730, "National Institute of Technology")
    y = 700
    for s in students[:25]:
        p.drawString(100, y, f"{s.roll_no} | {s.user.name} | {s.department} | Att: {s.attendance_percentage}% | Eligible: {s.is_eligible}")
        y -= 18
    p.showPage()
    p.save()
    out.seek(0)
    
    from django.http import HttpResponse
    response = HttpResponse(out.read(), content_type='application/pdf')
    response['Content-Disposition'] = f'attachment; filename={report_type}.pdf'
    return response


@api_view(['GET'])
@authentication_classes([])
@rf_permission_classes([IsAdmin])
def profile(request):
    """Get admin's own profile"""
    user = getattr(request, '_jwt_user', request.user)
    if not user or not hasattr(user, 'role') or user.role != 'admin':
        return Response({'detail': 'Admin access required'}, status=status.HTTP_403_FORBIDDEN)
    
    return Response({
        'id': user.id,
        'name': user.name,
        'email': user.email,
        'avatar': user.avatar,
        'role': user.role,
        'created_at': user.created_at,
        'updated_at': user.updated_at
    })


@api_view(['PUT'])
@authentication_classes([])
@rf_permission_classes([IsAdmin])
def update_profile(request):
    """Update admin's profile fields and optionally change password."""
    user = getattr(request, '_jwt_user', request.user)
    if not user or not hasattr(user, 'role') or user.role != 'admin':
        return Response({'detail': 'Admin access required'}, status=status.HTTP_403_FORBIDDEN)

    serializer = AdminProfileUpdateSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    data = serializer.validated_data

    if 'new_password' in data:
        if not verify_password(data['current_password'], user.hashed_password):
            return Response({'detail': 'Current password is incorrect'}, status=status.HTTP_400_BAD_REQUEST)
        user.hashed_password = get_password_hash(data['new_password'])

    if 'name' in data:
        user.name = data['name']

    user.save()

    return Response({
        'message': 'Profile updated',
        'name': user.name,
        'email': user.email,
        'avatar': user.avatar
    })


@api_view(['POST'])
@authentication_classes([])
@rf_permission_classes([IsAdmin])
def upload_profile_photo(request):
    """Upload or replace the admin's profile photo."""
    user = getattr(request, '_jwt_user', request.user)
    if not user or not hasattr(user, 'role') or user.role != 'admin':
        return Response({'detail': 'Admin access required'}, status=status.HTTP_403_FORBIDDEN)

    if 'photo' not in request.FILES:
        return Response({'detail': 'No photo file provided'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        photo_url = save_profile_photo(request.FILES['photo'], 'admin')
    except ValueError as e:
        return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    user.avatar = photo_url
    user.save()

    return Response({'message': 'Photo updated', 'photo': photo_url})
