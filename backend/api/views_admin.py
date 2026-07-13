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
                          HallTicketUpdateSerializer, FeePaymentReviewSerializer,
                          TeacherUpdateSerializer, ExamUpdateSerializer, SystemSettingsUpdateSerializer)
from .permissions import IsAdmin
from .auth_utils import get_password_hash, verify_password
from .photo_utils import save_profile_photo
from .fee_service import (
    admin_mark_fee_paid, approve_fee_payment, list_pending_payments, reject_fee_payment,
)
from .attendance_service import refresh_student_eligibility, get_attendance_trends
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
from .settings_service import get_system_settings, settings_to_dict, refresh_all_eligibility, passes_eligibility
from .exam_service import (
    create_exam_record, update_exam_record, exam_to_dict,
    get_exam_subjects, subjects_subject_codes, resolve_hall_ticket_exam,
)
from .hall_ticket_service import (
    merge_hall_ticket_subjects, sync_hall_ticket_subjects,
    update_hall_ticket_subjects, refresh_hall_ticket_qr,
    detect_ticket_seat_conflicts, SeatConflictError,
)
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
        'recent_students': recent_data,
        'attendance_trends': get_attendance_trends(7),
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
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    data = serializer.validated_data
    user = s.user
    subject_code = request.data.get('subject_code', 'CS301')

    if 'email' in data and User.objects.filter(
        email=data['email'], is_deleted=False
    ).exclude(id=user.id).exists():
        return Response({'detail': 'Email already in use'}, status=status.HTTP_400_BAD_REQUEST)
    if 'roll_no' in data and Student.objects.filter(
        roll_no=data['roll_no'], is_deleted=False
    ).exclude(id=s.id).exists():
        return Response({'detail': 'Roll number already in use'}, status=status.HTTP_400_BAD_REQUEST)

    user_fields = {}
    if 'name' in data:
        user_fields['name'] = data.pop('name')
    if 'email' in data:
        user_fields['email'] = data.pop('email')
    if 'password' in data:
        user_fields['hashed_password'] = get_password_hash(data.pop('password'))
    if user_fields:
        for field, value in user_fields.items():
            setattr(user, field, value)
        user.save()

    for field, value in data.items():
        if field in ('mobile', 'photo', 'fee_due_date') and value in (None, ''):
            value = None
        setattr(s, field, value)

    if 'internal_marks' in data or 'assignment_marks' in data:
        try:
            update_student_marks(
                s,
                subject_code,
                internal_marks=data.get('internal_marks', s.internal_marks),
                assignment_marks=data.get('assignment_marks', s.assignment_marks),
            )
        except ValueError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    else:
        refresh_student_eligibility(s)

    return Response({
        'message': 'Updated',
        'id': s.id,
        'name': user.name,
        'email': user.email,
        'roll_no': s.roll_no,
        'department': s.department,
        'semester': s.semester,
        'internal_marks': s.internal_marks,
        'assignment_marks': s.assignment_marks,
        'is_eligible': s.is_eligible,
    })


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


@api_view(['PUT'])
@authentication_classes([])
@rf_permission_classes([IsAdmin])
def update_teacher(request, tid):
    """Update a teacher"""
    try:
        t = Teacher.objects.select_related('user').get(id=tid, is_deleted=False)
    except Teacher.DoesNotExist:
        return Response({'detail': 'Not found'}, status=status.HTTP_404_NOT_FOUND)

    serializer = TeacherUpdateSerializer(data=request.data, partial=True)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    data = serializer.validated_data
    user = t.user

    if 'email' in data and User.objects.filter(email=data['email'], is_deleted=False).exclude(id=user.id).exists():
        return Response({'detail': 'Email already in use'}, status=status.HTTP_400_BAD_REQUEST)
    if 'emp_id' in data and Teacher.objects.filter(emp_id=data['emp_id'], is_deleted=False).exclude(id=t.id).exists():
        return Response({'detail': 'Employee ID already in use'}, status=status.HTTP_400_BAD_REQUEST)

    if 'name' in data:
        user.name = data['name']
    if 'email' in data:
        user.email = data['email']
    if 'password' in data:
        user.hashed_password = get_password_hash(data['password'])
    if 'department' in data:
        t.department = data['department']
    if 'emp_id' in data:
        t.emp_id = data['emp_id']
    if 'assigned_subjects' in data:
        t.assigned_subjects = data['assigned_subjects']

    user.save()
    t.save()

    return Response({
        'message': 'Teacher updated',
        'id': t.id,
        'name': user.name,
        'email': user.email,
        'emp_id': t.emp_id,
        'department': t.department,
        'assigned_subjects': t.assigned_subjects.split(',') if t.assigned_subjects else [],
    })


@api_view(['DELETE'])
@authentication_classes([])
@rf_permission_classes([IsAdmin])
def delete_teacher(request, tid):
    """Soft delete a teacher"""
    try:
        t = Teacher.objects.select_related('user').get(id=tid, is_deleted=False)
    except Teacher.DoesNotExist:
        return Response({'detail': 'Not found'}, status=status.HTTP_404_NOT_FOUND)

    t.is_deleted = True
    t.user.is_deleted = True
    t.save()
    t.user.save()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['GET'])
@authentication_classes([])
@rf_permission_classes([IsAdmin])
def list_exams(request):
    """List all exams"""
    exams = Exam.objects.filter(is_deleted=False).select_related('invigilator__user').prefetch_related('subjects')
    return Response([exam_to_dict(e) for e in exams])


@api_view(['POST'])
@authentication_classes([])
@rf_permission_classes([IsAdmin])
def create_exam(request):
    """Create a new exam"""
    serializer = ExamCreateSerializer(data=request.data)
    if serializer.is_valid():
        try:
            exam = create_exam_record(serializer.validated_data)
        except ValueError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({'message': 'Exam scheduled', 'exam_id': exam.id}, 
                       status=status.HTTP_201_CREATED)
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['PUT'])
@authentication_classes([])
@rf_permission_classes([IsAdmin])
def update_exam(request, eid):
    """Update an exam"""
    try:
        exam = Exam.objects.get(id=eid, is_deleted=False)
    except Exam.DoesNotExist:
        return Response({'detail': 'Not found'}, status=status.HTTP_404_NOT_FOUND)

    serializer = ExamUpdateSerializer(data=request.data, partial=True)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    data = serializer.validated_data
    if 'subject_code' in data and Exam.objects.filter(
        subject_code=data['subject_code'], is_deleted=False
    ).exclude(id=exam.id).exists():
        return Response({'detail': 'Subject code already in use'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        update_exam_record(exam, data)
    except ValueError as e:
        return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    return Response({
        'message': 'Exam updated',
        **exam_to_dict(exam),
    })


@api_view(['DELETE'])
@authentication_classes([])
@rf_permission_classes([IsAdmin])
def delete_exam(request, eid):
    """Soft delete an exam"""
    try:
        exam = Exam.objects.get(id=eid, is_deleted=False)
    except Exam.DoesNotExist:
        return Response({'detail': 'Not found'}, status=status.HTTP_404_NOT_FOUND)

    exam.is_deleted = True
    exam.save()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['POST'])
@authentication_classes([])
@rf_permission_classes([IsAdmin])
def verify_all(request):
    """Verify eligibility for all students"""
    cfg = get_system_settings()
    students = Student.objects.filter(is_deleted=False)

    for s in students:
        ai = eligibility_ai.predict_eligibility(
            s.attendance_percentage,
            s.internal_marks,
            s.previous_result,
            s.backlogs,
            attendance_threshold=cfg.attendance_threshold,
            min_sgpa=cfg.min_sgpa,
        )

        s.is_eligible = passes_eligibility(s, cfg)
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
        exam = resolve_hall_ticket_exam(s, getattr(s, 'hall_ticket', None))
        if not exam:
            continue

        seating = SeatingArrangement.objects.filter(student=s, exam=exam).select_related('room').first()
        if seating:
            SeatingArrangementService.sync_arrangement_to_hall_ticket(seating)
            count += 1
            continue

        subjects = get_exam_subjects(exam)
        subject_codes = subjects_subject_codes(subjects)
        hall_ticket_no = f"HT2026{s.roll_no}"
        seat_number = f"S{100 + s.id}"
        room = exam.room

        if hasattr(s, 'hall_ticket') and s.hall_ticket.is_active:
            ht = s.hall_ticket
            ht.exam = exam
            ht.seat_number = ht.seat_number or seat_number
            ht.room = ht.room or room
            sync_hall_ticket_subjects(ht, exam, ht.seat_number, ht.room)
            refresh_hall_ticket_qr(ht, exam, s)
            count += 1
            continue

        ht = HallTicket.objects.create(
            hall_ticket_no=hall_ticket_no,
            student=s,
            exam=exam,
            seat_number=seat_number,
            room=room,
            qr_code_content=build_qr_content(
                hall_ticket_no, s.roll_no, exam.subject_code,
                seat_number, room, subject_codes=subject_codes,
            ),
        )
        sync_hall_ticket_subjects(ht, exam, seat_number, room)
        refresh_hall_ticket_qr(ht, exam, s)
        count += 1

    return Response({'message': f'Generated {count} hall tickets.'})


@api_view(['PUT'])
@authentication_classes([])
@rf_permission_classes([IsAdmin])
def update_hallticket(request, ht_id):
    """Admin: update seat/hall per subject on a hall ticket."""
    try:
        ht = HallTicket.objects.select_related('student', 'exam').get(id=ht_id, is_active=True)
    except HallTicket.DoesNotExist:
        return Response({'detail': 'Hall ticket not found'}, status=status.HTTP_404_NOT_FOUND)

    serializer = HallTicketUpdateSerializer(data=request.data, partial=True)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    data = serializer.validated_data
    exam = resolve_hall_ticket_exam(ht.student, ht)
    if not exam:
        return Response({'detail': 'No active exam found for this hall ticket'}, status=status.HTTP_400_BAD_REQUEST)

    auto_resolve = data.get('auto_resolve_seats', False)
    resolved = []
    try:
        if 'subjects' in data and data['subjects']:
            subjects, resolved = update_hall_ticket_subjects(
                ht, exam, data['subjects'], auto_resolve=auto_resolve,
            )
        else:
            if 'seat_number' in data:
                ht.seat_number = data['seat_number']
            if 'room' in data:
                ht.room = data['room']
            ht.save()
            subjects = sync_hall_ticket_subjects(ht, exam, ht.seat_number, ht.room)
    except SeatConflictError as e:
        return Response({
            'detail': str(e),
            'conflicts': e.conflicts,
        }, status=status.HTTP_400_BAD_REQUEST)

    refresh_hall_ticket_qr(ht, exam, ht.student)

    seating = SeatingArrangement.objects.filter(
        student=ht.student, exam=exam,
    ).select_related('room').first()
    if seating and subjects:
        seating.seat_number = subjects[0]['seat_number']
        seating.save()

    msg = 'Hall ticket updated'
    if resolved:
        msg = f"Hall ticket updated — {len(resolved)} seat conflict(s) auto-assigned to available seats"

    return Response({
        'id': ht.id,
        'hall_ticket_no': ht.hall_ticket_no,
        'seat_number': ht.seat_number,
        'room': ht.room,
        'subjects': subjects,
        'qr_code_content': ht.qr_code_content,
        'resolved_conflicts': resolved,
        'message': msg,
    })


@api_view(['GET'])
@authentication_classes([])
@rf_permission_classes([IsAdmin])
def list_halltickets(request):
    """List all hall tickets"""
    hts = HallTicket.objects.filter(is_active=True).select_related(
        'student', 'student__user', 'exam',
    ).prefetch_related('subject_assignments')
    data = []
    for h in hts:
        exam = resolve_hall_ticket_exam(h.student, h)
        if exam:
            subjects = merge_hall_ticket_subjects(h, exam)
            if not h.subject_assignments.exists():
                sync_hall_ticket_subjects(h, exam, h.seat_number, h.room)
                subjects = merge_hall_ticket_subjects(h, exam)
            seat_conflicts = detect_ticket_seat_conflicts(h, exam)
        else:
            subjects = []
            seat_conflicts = []
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
            'exam': exam.subject_name if exam else h.exam.subject_name,
            'exam_id': exam.id if exam else h.exam_id,
            'subject_code': exam.subject_code if exam else h.exam.subject_code,
            'exam_date': exam.exam_date if exam else h.exam.exam_date,
            'exam_time': exam.exam_time if exam else h.exam.exam_time,
            'duration': exam.duration if exam else h.exam.duration,
            'subjects': subjects,
            'seat_conflicts': seat_conflicts,
            'has_seat_conflict': len(seat_conflicts) > 0,
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
        'attendance_data': attendance_data,
        'attendance_trends': get_attendance_trends(7),
    })


def _build_report_data(report_type):
    """Return (title, headers, rows) for a report type."""
    students = Student.objects.filter(is_deleted=False).select_related('user').order_by('roll_no')
    report_type = (report_type or 'attendance').lower()

    if report_type == 'attendance':
        rows = [
            [s.roll_no, s.user.name, s.department, s.semester, s.section, s.attendance_percentage]
            for s in students
        ]
        return 'Attendance Report', ['Roll No', 'Name', 'Department', 'Semester', 'Section', 'Attendance %'], rows

    if report_type == 'marks':
        rows = [
            [s.roll_no, s.user.name, s.department, s.internal_marks, s.assignment_marks,
             s.internal_marks + s.assignment_marks]
            for s in students
        ]
        return 'Internal Marks Report', ['Roll No', 'Name', 'Department', 'Internal /40', 'Assignment /10', 'Total /50'], rows

    if report_type == 'eligibility':
        rows = [
            [s.roll_no, s.user.name, s.department, round(s.eligibility_percentage, 1),
             'Eligible' if s.is_eligible else 'Not Eligible', round(s.ai_risk_score, 2),
             s.attendance_percentage, s.internal_marks, 'Yes' if s.fee_paid else 'No', s.backlogs]
            for s in students
        ]
        return 'Eligibility Report', [
            'Roll No', 'Name', 'Department', 'Eligibility %', 'Status', 'Risk Score',
            'Attendance %', 'Internal /40', 'Fee Paid', 'Backlogs',
        ], rows

    if report_type == 'examination':
        exams = Exam.objects.filter(is_deleted=False).order_by('exam_date', 'subject_code')
        rows = [
            [e.subject_code, e.subject_name, e.department, e.semester, e.exam_date,
             e.exam_time, e.duration, e.room, e.total_marks]
            for e in exams
        ]
        return 'Examination Report', [
            'Subject Code', 'Subject Name', 'Department', 'Semester', 'Date', 'Time', 'Duration', 'Room', 'Total Marks',
        ], rows

    if report_type == 'backlog':
        backlog_students = students.filter(backlogs__gt=0)
        rows = [
            [s.roll_no, s.user.name, s.department, s.semester, s.backlogs,
             s.attendance_percentage, s.internal_marks, 'Eligible' if s.is_eligible else 'Not Eligible']
            for s in backlog_students
        ]
        return 'Backlog Report', [
            'Roll No', 'Name', 'Department', 'Semester', 'Backlogs', 'Attendance %', 'Internal /40', 'Eligibility',
        ], rows

    if report_type == 'fee':
        rows = [
            [s.roll_no, s.user.name, s.department, s.fee_amount,
             'Paid' if s.fee_paid else 'Pending', s.fee_due_date or '-']
            for s in students
        ]
        paid_count = sum(1 for s in students if s.fee_paid)
        unpaid_count = students.count() - paid_count
        total_collected = sum(s.fee_amount for s in students if s.fee_paid)
        total_due = sum(s.fee_amount for s in students if not s.fee_paid)
        rows.extend([
            [],
            ['Summary', 'Paid Students', paid_count, '', '', ''],
            ['Summary', 'Pending Students', unpaid_count, '', '', ''],
            ['Summary', 'Total Collected (Rs.)', total_collected, '', '', ''],
            ['Summary', 'Total Due (Rs.)', total_due, '', '', ''],
        ])
        return 'Fee Report', ['Roll No', 'Name', 'Department', 'Amount (Rs.)', 'Status', 'Due Date'], rows

    return None, None, None


def _excel_response(report_type, title, headers, rows):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = title[:31]
    ws.append(headers)
    for row in rows:
        ws.append(row)
    out = io.BytesIO()
    wb.save(out)
    out.seek(0)
    from django.http import HttpResponse
    response = HttpResponse(
        out.read(),
        content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    )
    response['Content-Disposition'] = f'attachment; filename="{report_type}.xlsx"'
    return response


def _pdf_text(value):
    """ReportLab Helvetica only supports latin-1."""
    return str(value).encode('latin-1', 'replace').decode('latin-1')


def _pdf_response(report_type, title, headers, rows):
    out = io.BytesIO()
    p = canvas.Canvas(out, pagesize=letter)
    width, height = letter
    y = height - 50

    def new_page():
        nonlocal y
        p.showPage()
        y = height - 50

    p.setFont('Helvetica-Bold', 14)
    p.drawString(50, y, _pdf_text(f'ExamShield AI - {title}'))
    y -= 18
    cfg = get_system_settings()
    p.setFont('Helvetica', 10)
    p.drawString(50, y, _pdf_text(cfg.university_name))
    y -= 14
    p.drawString(50, y, _pdf_text(f'Generated: {__import__("datetime").datetime.now().strftime("%Y-%m-%d %H:%M")}'))
    y -= 22
    p.setFont('Helvetica-Bold', 9)
    p.drawString(50, y, _pdf_text(' | '.join(str(h) for h in headers)))
    y -= 16
    p.setFont('Helvetica', 9)

    for row in rows:
        line = _pdf_text(' | '.join(str(cell) for cell in row))
        if y < 50:
            new_page()
            p.setFont('Helvetica-Bold', 9)
            p.drawString(50, y, _pdf_text(' | '.join(str(h) for h in headers)))
            y -= 16
            p.setFont('Helvetica', 9)
        p.drawString(50, y, line[:110])
        y -= 14

    p.save()
    out.seek(0)
    from django.http import HttpResponse
    response = HttpResponse(out.read(), content_type='application/pdf')
    response['Content-Disposition'] = f'attachment; filename="{report_type}.pdf"'
    return response


@api_view(['GET'])
@authentication_classes([])
@rf_permission_classes([IsAdmin])
def export_report(request):
    """Export report in Excel or PDF format"""
    report_type = request.query_params.get('report_type', 'attendance')
    # DRF reserves ?format= for content negotiation — never use that query name here.
    format_type = request.query_params.get('export_format', 'excel')

    title, headers, rows = _build_report_data(report_type)
    if title is None:
        return Response({'detail': f'Unknown report type: {report_type}'}, status=status.HTTP_400_BAD_REQUEST)

    if format_type == 'excel':
        return _excel_response(report_type, title, headers, rows)
    if format_type == 'pdf':
        return _pdf_response(report_type, title, headers, rows)
    return Response({'detail': 'Format must be excel or pdf'}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@authentication_classes([])
@rf_permission_classes([IsAdmin])
def get_settings(request):
    """Get system-wide university and AI configuration."""
    return Response(settings_to_dict())


@api_view(['PUT'])
@authentication_classes([])
@rf_permission_classes([IsAdmin])
def update_settings(request):
    """Update system settings. Recalculates eligibility when AI thresholds change."""
    serializer = SystemSettingsUpdateSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    data = serializer.validated_data
    if not data:
        return Response({'detail': 'No settings provided'}, status=status.HTTP_400_BAD_REQUEST)

    obj = get_system_settings()
    ai_fields = {'attendance_threshold', 'internal_marks_threshold', 'min_sgpa', 'ml_model'}
    ai_changed = any(field in data for field in ai_fields)

    for field, value in data.items():
        setattr(obj, field, value)
    obj.save()

    recalculated = 0
    if ai_changed:
        recalculated = refresh_all_eligibility()

    payload = settings_to_dict(obj)
    if recalculated:
        payload['recalculated_students'] = recalculated
    return Response(payload)


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
