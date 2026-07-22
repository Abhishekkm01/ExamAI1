from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.db.models import Q, Sum, Avg
from django.db import transaction
from .models import User, Student, Teacher, HOD, Exam, ExamSubject, HallTicket, Notification, EligibilityPrediction, RoleEnum, SeatingArrangement, SeatingRoom, FeePayment
from .seating_service import SeatingArrangementService, room_display_name
from .serializers import (StudentSerializer, TeacherSerializer, ExamSerializer,
                          StudentCreateSerializer, StudentUpdateSerializer, ExamCreateSerializer,
                          NotificationCreateSerializer, NotificationSerializer, AdminProfileUpdateSerializer,
                          HallTicketUpdateSerializer, FeePaymentReviewSerializer,
                          TeacherUpdateSerializer, HodUpdateSerializer, ExamUpdateSerializer, SystemSettingsUpdateSerializer)
from .permissions import IsAdmin
from .auth_utils import get_password_hash, verify_password
from .photo_utils import save_profile_photo
from .fee_service import (
    approve_fee_payment, list_pending_payments, reject_fee_payment,
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


@api_view(['GET'])
@authentication_classes([])
@rf_permission_classes([IsAdmin])
def dashboard(request):
    """Admin dashboard metrics"""
    students = Student.objects.filter(is_deleted=False)
    eligible_count = students.filter(is_eligible=True).count()
    hall_tickets_count = HallTicket.objects.filter(is_active=True, exam__is_deleted=False).count()
    
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
            'gender': s.gender or '',
            'date_of_birth': s.date_of_birth,
            'photo': s.photo,
            'attendance': s.attendance_percentage,
            'internal_marks': s.internal_marks,
            'assignment_marks': s.assignment_marks,
            'previous_result': s.previous_result,
            'backlogs': s.backlogs,
            'fee_paid': s.fee_paid,
            'fee_amount': s.fee_amount,
            'exam_fee_paid': s.exam_fee_paid,
            'college_fee_amount': s.college_fee_amount,
            'college_fee_paid': s.college_fee_paid,
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
        'gender': s.gender or '',
        'date_of_birth': s.date_of_birth,
        'photo': s.photo,
        'attendance': s.attendance_percentage,
        'internal_marks': s.internal_marks,
        'assignment_marks': s.assignment_marks,
        'previous_result': s.previous_result,
        'backlogs': s.backlogs,
        'fee_paid': s.fee_paid,
        'fee_amount': s.fee_amount,
        'exam_fee_paid': s.exam_fee_paid,
        'college_fee_amount': s.college_fee_amount,
        'college_fee_paid': s.college_fee_paid,
        'fee_due_date': s.fee_due_date,
        'is_eligible': s.is_eligible,
        'eligibility_percentage': s.eligibility_percentage,
        'ai_risk_score': s.ai_risk_score
    })


@api_view(['POST'])
@authentication_classes([])
@rf_permission_classes([IsAdmin])
def create_student(request):
    """Create a new student (identity fields only; marks/attendance come from teachers)."""
    serializer = StudentCreateSerializer(data=request.data)
    if serializer.is_valid():
        data = serializer.validated_data
        from .settings_service import get_default_exam_fee

        with transaction.atomic():
            user = User.objects.create(
                email=data['email'],
                hashed_password=get_password_hash(data['password']),
                name=data['name'],
                role=RoleEnum.STUDENT,
                avatar=data.get('photo') or f"https://api.dicebear.com/7.x/avataaars/svg?seed={data['roll_no']}",
            )

            ai = eligibility_ai.predict_eligibility(0, 0, 0, 0)
            from .settings_service import get_default_exam_fee, get_default_college_fee
            fee_amount = data.get('fee_amount')
            if fee_amount is None:
                fee_amount = get_default_exam_fee()
            college_fee = data.get('college_fee_amount')
            if college_fee is None:
                college_fee = get_default_college_fee()

            student = Student.objects.create(
                user=user,
                roll_no=data['roll_no'],
                mobile=data.get('mobile'),
                gender=data.get('gender') or '',
                date_of_birth=data.get('date_of_birth') or None,
                department=data['department'],
                semester=data['semester'],
                section=data.get('section', 'A'),
                photo=user.avatar,
                attendance_percentage=0,
                internal_marks=0,
                assignment_marks=0,
                previous_result=0,
                backlogs=0,
                fee_paid=False,
                fee_amount=fee_amount,
                exam_fee_paid=False,
                college_fee_amount=college_fee,
                college_fee_paid=False,
                fee_due_date=data.get('fee_due_date'),
                is_eligible=False,
                eligibility_percentage=0,
                ai_risk_score=ai['risk_score'],
            )
            refresh_student_eligibility(student)

        return Response({'message': 'Student created', 'student_id': student.id},
                       status=status.HTTP_201_CREATED)

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['PUT'])
@authentication_classes([])
@rf_permission_classes([IsAdmin])
def update_student(request, sid):
    """Update student identity fields only (marks/attendance are teacher-managed)."""
    try:
        s = Student.objects.get(id=sid, is_deleted=False)
    except Student.DoesNotExist:
        return Response({'detail': 'Not found'}, status=status.HTTP_404_NOT_FOUND)

    blocked = {'attendance_percentage', 'internal_marks', 'assignment_marks', 'previous_result', 'backlogs', 'subject_code'}
    if any(k in request.data for k in blocked):
        return Response(
            {'detail': 'Internal marks and attendance can only be uploaded by teachers.'},
            status=status.HTTP_403_FORBIDDEN,
        )

    serializer = StudentUpdateSerializer(data=request.data, partial=True)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    data = serializer.validated_data
    user = s.user

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
        if field in ('mobile', 'photo', 'fee_due_date', 'date_of_birth', 'gender') and value in (None, ''):
            value = None if field != 'gender' else ''
        setattr(s, field, value)
    s.save()
    refresh_student_eligibility(s)

    return Response({
        'message': 'Updated',
        'id': s.id,
        'name': user.name,
        'email': user.email,
        'roll_no': s.roll_no,
        'department': s.department,
        'semester': s.semester,
        'gender': s.gender or '',
        'date_of_birth': s.date_of_birth,
        'mobile': s.mobile,
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


@api_view(['GET'])
@authentication_classes([])
@rf_permission_classes([IsAdmin])
def get_teacher(request, tid):
    """Get single teacher details with assigned invigilation exams."""
    try:
        t = Teacher.objects.select_related('user').get(id=tid, is_deleted=False)
    except Teacher.DoesNotExist:
        return Response({'detail': 'Not found'}, status=status.HTTP_404_NOT_FOUND)

    duties = ExamSubject.objects.filter(
        invigilator=t,
        exam__is_deleted=False,
    ).select_related('exam').order_by('exam_date', 'exam_time', 'sort_order')

    return Response({
        'id': t.id,
        'name': t.user.name,
        'email': t.user.email,
        'emp_id': t.emp_id,
        'department': t.department,
        'photo': t.photo,
        'assigned_subjects': t.assigned_subjects.split(',') if t.assigned_subjects else [],
        'invigilator_exams': [
            {
                'id': s.exam.id,
                'exam_subject_id': s.id,
                'subject_code': s.subject_code,
                'subject_name': s.subject_name,
                'department': s.exam.department,
                'semester': s.exam.semester,
                'exam_date': s.exam_date or s.exam.exam_date,
                'exam_time': s.exam_time or s.exam.exam_time,
                'duration': s.duration or s.exam.duration,
                'room': s.exam.room,
                'requires_face_verification': s.exam.requires_face_verification,
            }
            for s in duties
        ],
    })


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
def list_hods(request):
    """List all Heads of Department."""
    hods = HOD.objects.filter(is_deleted=False).select_related('user')
    data = []
    for h in hods:
        data.append({
            'id': h.id,
            'name': h.user.name,
            'email': h.user.email,
            'emp_id': h.emp_id,
            'department': h.department,
            'photo': h.photo,
        })
    return Response(data)


@api_view(['GET'])
@authentication_classes([])
@rf_permission_classes([IsAdmin])
def get_hod(request, hid):
    try:
        h = HOD.objects.select_related('user').get(id=hid, is_deleted=False)
    except HOD.DoesNotExist:
        return Response({'detail': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
    return Response({
        'id': h.id,
        'name': h.user.name,
        'email': h.user.email,
        'emp_id': h.emp_id,
        'department': h.department,
        'photo': h.photo,
    })


@api_view(['PUT'])
@authentication_classes([])
@rf_permission_classes([IsAdmin])
def update_hod(request, hid):
    try:
        h = HOD.objects.select_related('user').get(id=hid, is_deleted=False)
    except HOD.DoesNotExist:
        return Response({'detail': 'Not found'}, status=status.HTTP_404_NOT_FOUND)

    serializer = HodUpdateSerializer(data=request.data, partial=True)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    data = serializer.validated_data
    user = h.user

    if 'email' in data and User.objects.filter(email=data['email'], is_deleted=False).exclude(id=user.id).exists():
        return Response({'detail': 'Email already in use'}, status=status.HTTP_400_BAD_REQUEST)
    if 'emp_id' in data and HOD.objects.filter(emp_id=data['emp_id'], is_deleted=False).exclude(id=h.id).exists():
        return Response({'detail': 'Employee ID already in use'}, status=status.HTTP_400_BAD_REQUEST)
    if 'department' in data:
        clash = HOD.objects.filter(department=data['department'], is_deleted=False).exclude(id=h.id).first()
        if clash:
            return Response(
                {'detail': f'An active HOD already exists for {data["department"]}.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

    if 'name' in data:
        user.name = data['name']
    if 'email' in data:
        user.email = data['email']
    if 'password' in data:
        user.hashed_password = get_password_hash(data['password'])
    if 'department' in data:
        h.department = data['department']
    if 'emp_id' in data:
        h.emp_id = data['emp_id']

    user.save()
    h.save()

    return Response({
        'message': 'HOD updated',
        'id': h.id,
        'name': user.name,
        'email': user.email,
        'emp_id': h.emp_id,
        'department': h.department,
    })


@api_view(['DELETE'])
@authentication_classes([])
@rf_permission_classes([IsAdmin])
def delete_hod(request, hid):
    try:
        h = HOD.objects.select_related('user').get(id=hid, is_deleted=False)
    except HOD.DoesNotExist:
        return Response({'detail': 'Not found'}, status=status.HTTP_404_NOT_FOUND)

    h.is_deleted = True
    h.user.is_deleted = True
    h.save()
    h.user.save()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['GET'])
@authentication_classes([])
@rf_permission_classes([IsAdmin])
def list_exams(request):
    """List all exams"""
    exams = Exam.objects.filter(is_deleted=False).prefetch_related('subjects__invigilator__user')
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
    """Soft delete an exam and deactivate its hall tickets."""
    try:
        exam = Exam.objects.get(id=eid, is_deleted=False)
    except Exam.DoesNotExist:
        return Response({'detail': 'Not found'}, status=status.HTTP_404_NOT_FOUND)

    exam.is_deleted = True
    exam.save(update_fields=['is_deleted', 'updated_at'])
    HallTicket.objects.filter(exam=exam, is_active=True).update(is_active=False)
    SeatingArrangement.objects.filter(exam=exam).delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['POST'])
@authentication_classes([])
@rf_permission_classes([IsAdmin])
def verify_all(request):
    """Verify eligibility for all students"""
    students = Student.objects.filter(is_deleted=False)

    for s in students:
        refresh_student_eligibility(s)
        EligibilityPrediction.objects.create(
            student=s,
            predicted_probability=s.eligibility_percentage / 100.0,
            risk_score=s.ai_risk_score,
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

        hall_ticket_no = f"HT2026{s.roll_no}"
        existing = getattr(s, 'hall_ticket', None)
        if existing and existing.exam_id == exam.id and existing.is_active:
            seat_number = existing.seat_number or f"S{100 + s.id}"
            room = existing.room or exam.room
        else:
            seat_number = f"S{100 + s.id}"
            room = exam.room

        ht, _ = HallTicket.objects.update_or_create(
            student=s,
            defaults={
                'exam': exam,
                'hall_ticket_no': hall_ticket_no,
                'seat_number': seat_number,
                'room': room,
                'qr_code_content': '',
                'is_active': True,
            },
        )
        sync_hall_ticket_subjects(ht, exam, seat_number, room)
        refresh_hall_ticket_qr(ht, exam, s)
        count += 1

    return Response({'message': f'Generated {count} hall tickets.'})


@api_view(['PUT'])
@authentication_classes([])
@rf_permission_classes([IsAdmin])
def update_hallticket(request, ht_id):
    """Seat/hall edits disabled — seating is AI-assigned only."""
    return Response(
        {'detail': 'Seat allotment is system-assigned only. Use Seating Arrangement → AI Auto Arrange, then sync hall tickets.'},
        status=status.HTTP_403_FORBIDDEN,
    )


@api_view(['GET'])
@authentication_classes([])
@rf_permission_classes([IsAdmin])
def list_halltickets(request):
    """List active hall tickets for eligible students only."""
    # Deactivate any leftover tickets for students who are no longer eligible
    HallTicket.objects.filter(
        is_active=True,
        student__is_eligible=False,
    ).update(is_active=False)

    hts = HallTicket.objects.filter(
        is_active=True,
        exam__is_deleted=False,
        student__is_deleted=False,
        student__is_eligible=True,
    ).select_related(
        'student', 'student__user', 'exam',
    ).prefetch_related('subject_assignments')
    data = []
    for h in hts:
        exam = h.exam
        exam_subject_count = len(get_exam_subjects(exam))
        assigned_count = h.subject_assignments.count()
        # Always backfill when exam gained subjects after the ticket was created
        if assigned_count == 0 or assigned_count != exam_subject_count:
            sync_hall_ticket_subjects(h, exam, h.seat_number, h.room)
        subjects = merge_hall_ticket_subjects(h, exam)
        if not h.qr_code_content or not h.qr_code_content.startswith('{'):
            refresh_hall_ticket_qr(h, exam, h.student)
        seat_conflicts = detect_ticket_seat_conflicts(h, exam)
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
            'exam': exam.subject_name,
            'exam_title': exam.title or exam.subject_name,
            'exam_id': exam.id,
            'subject_code': exam.subject_code,
            'exam_date': exam.exam_date,
            'exam_time': exam.exam_time,
            'duration': exam.duration,
            'subjects': subjects,
            'seat_conflicts': seat_conflicts,
            'has_seat_conflict': len(seat_conflicts) > 0,
            'qr_code_content': h.qr_code_content,
            'is_eligible': True,
        })
    return Response(data)


@api_view(['GET'])
@authentication_classes([])
@rf_permission_classes([IsAdmin])
def backlogs(request):
    """List students with backlog subjects (for hall ticket inclusion)."""
    from .backlog_service import list_student_backlogs, active_backlogs_for_student

    students = Student.objects.filter(is_deleted=False).select_related('user').prefetch_related('backlog_subjects')
    data = []
    for s in students:
        active = active_backlogs_for_student(s)
        if not active and s.backlogs <= 0:
            continue
        data.append({
            'id': s.id,
            'name': s.user.name,
            'roll_no': s.roll_no,
            'department': s.department,
            'semester': s.semester,
            'backlogs': len(active) or s.backlogs,
            'attendance': s.attendance_percentage,
            'is_eligible': s.is_eligible,
            'photo': s.photo,
            'backlog_subjects': list_student_backlogs(s),
        })
    return Response(data)


@api_view(['GET', 'POST'])
@authentication_classes([])
@rf_permission_classes([IsAdmin])
def student_backlogs(request, sid):
    """List or add backlog subjects for a student (appear on hall ticket)."""
    from .backlog_service import list_student_backlogs, upsert_backlog, sync_student_backlog_count

    try:
        s = Student.objects.get(id=sid, is_deleted=False)
    except Student.DoesNotExist:
        return Response({'detail': 'Student not found'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        sync_student_backlog_count(s)
        return Response({
            'student_id': s.id,
            'backlogs': s.backlogs,
            'subjects': list_student_backlogs(s),
        })

    row, error = upsert_backlog(s, request.data or {})
    if error:
        return Response({'detail': error}, status=status.HTTP_400_BAD_REQUEST)
    return Response({
        'message': 'Backlog subject recorded. Student must apply and pay before it appears on the hall ticket.',
        'backlogs': s.backlogs,
        'subject': {
            'id': row.id,
            'subject_code': row.subject_code,
            'subject_name': row.subject_name,
            'from_semester': row.from_semester,
            'exam_date': row.exam_date,
            'exam_time': row.exam_time,
            'duration': row.duration,
            'status': row.status,
            'is_cleared': row.is_cleared,
        },
    }, status=status.HTTP_201_CREATED)


@api_view(['PUT', 'DELETE'])
@authentication_classes([])
@rf_permission_classes([IsAdmin])
def student_backlog_detail(request, sid, backlog_id):
    """Clear or delete a backlog subject."""
    from .backlog_service import clear_backlog, delete_backlog, list_student_backlogs

    try:
        s = Student.objects.get(id=sid, is_deleted=False)
    except Student.DoesNotExist:
        return Response({'detail': 'Student not found'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'DELETE':
        error = delete_backlog(s, backlog_id)
        if error:
            return Response({'detail': error}, status=status.HTTP_404_NOT_FOUND)
        return Response({'message': 'Backlog subject removed', 'backlogs': s.backlogs, 'subjects': list_student_backlogs(s)})

    cleared = request.data.get('is_cleared', True)
    row, error = clear_backlog(s, backlog_id, cleared=bool(cleared))
    if error:
        return Response({'detail': error}, status=status.HTTP_404_NOT_FOUND)
    return Response({
        'message': 'Backlog updated',
        'backlogs': s.backlogs,
        'subjects': list_student_backlogs(s),
    })


@api_view(['GET'])
@authentication_classes([])
@rf_permission_classes([IsAdmin])
def fees(request):
    """Fee status report for college + per-exam fees."""
    from .settings_service import get_default_exam_fee, get_default_college_fee, get_default_backlog_fee
    from .fee_service import exam_fee_rows, sync_overall_fee_paid

    students = list(Student.objects.filter(is_deleted=False).select_related('user'))
    unpaid_data = []
    total_collected = 0.0
    total_due = 0.0
    paid_count = 0

    for s in students:
        sync_overall_fee_paid(s)
        s.refresh_from_db()
        rows = exam_fee_rows(s)
        unpaid_exams = [r for r in rows if not r['paid']]
        college_due = 0.0 if s.college_fee_paid else float(s.college_fee_amount or 0)
        exam_due = sum(float(r['fee_amount'] or 0) for r in unpaid_exams)
        college_collected = float(s.college_fee_amount or 0) if s.college_fee_paid else 0.0
        exam_collected = sum(float(r['fee_amount'] or 0) for r in rows if r['paid'])
        total_collected += college_collected + exam_collected
        total_due += college_due + exam_due

        if s.fee_paid:
            paid_count += 1
            continue
        if college_due <= 0 and exam_due <= 0:
            continue

        unpaid_data.append({
            'id': s.id,
            'name': s.user.name,
            'roll_no': s.roll_no,
            'department': s.department,
            'semester': s.semester,
            'amount': college_due + exam_due,
            'exam_fee_amount': exam_due,
            'exam_fee_paid': len(unpaid_exams) == 0,
            'college_fee_amount': s.college_fee_amount,
            'college_fee_paid': s.college_fee_paid,
            'unpaid_exams': unpaid_exams,
            'due_date': s.fee_due_date,
            'photo': s.photo,
        })

    pending = list_pending_payments()

    return Response({
        'total_collected': total_collected,
        'total_due': total_due,
        'paid_count': paid_count,
        'unpaid_count': len(unpaid_data),
        'exam_unpaid_count': sum(1 for s in unpaid_data if not s['exam_fee_paid']),
        'college_unpaid_count': sum(1 for s in unpaid_data if not s['college_fee_paid']),
        'unpaid_students': unpaid_data,
        'pending_verifications': pending,
        'pending_count': len(pending),
        'default_exam_fee': get_default_exam_fee(),
        'default_college_fee': get_default_college_fee(),
        'default_backlog_fee': get_default_backlog_fee(),
    })


@api_view(['PUT'])
@authentication_classes([])
@rf_permission_classes([IsAdmin])
def set_exam_fee(request):
    """Admin sets college and/or exam fee amounts."""
    from .settings_service import get_system_settings, settings_to_dict

    exam_amount = request.data.get('default_exam_fee', request.data.get('exam_fee'))
    college_amount = request.data.get('default_college_fee', request.data.get('college_fee'))
    apply_to_unpaid = bool(request.data.get('apply_to_unpaid', True))
    fee_due_date = request.data.get('fee_due_date')

    obj = get_system_settings()
    updated_exam = 0
    updated_college = 0
    messages = []

    if exam_amount is not None:
        try:
            exam_amount = float(exam_amount)
        except (TypeError, ValueError):
            return Response({'detail': 'Valid exam fee amount is required'}, status=status.HTTP_400_BAD_REQUEST)
        if exam_amount < 0:
            return Response({'detail': 'Exam fee cannot be negative'}, status=status.HTTP_400_BAD_REQUEST)
        obj.default_exam_fee = exam_amount
        messages.append(f'Exam fee ₹{exam_amount:,.0f}')
        if apply_to_unpaid:
            updated_exam = Student.objects.filter(is_deleted=False, exam_fee_paid=False).update(fee_amount=exam_amount)

    if college_amount is not None:
        try:
            college_amount = float(college_amount)
        except (TypeError, ValueError):
            return Response({'detail': 'Valid college fee amount is required'}, status=status.HTTP_400_BAD_REQUEST)
        if college_amount < 0:
            return Response({'detail': 'College fee cannot be negative'}, status=status.HTTP_400_BAD_REQUEST)
        obj.default_college_fee = college_amount
        messages.append(f'College fee ₹{college_amount:,.0f}')
        if apply_to_unpaid:
            updated_college = Student.objects.filter(is_deleted=False, college_fee_paid=False).update(
                college_fee_amount=college_amount
            )

    if not messages:
        return Response(
            {'detail': 'Provide default_exam_fee and/or default_college_fee'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if fee_due_date is not None:
        Student.objects.filter(is_deleted=False, fee_paid=False).update(fee_due_date=fee_due_date or None)

    obj.save()
    payload = settings_to_dict(obj)
    payload['fee_updated_students'] = updated_exam + updated_college
    payload['exam_updated'] = updated_exam
    payload['college_updated'] = updated_college
    applied = []
    if updated_exam:
        applied.append(f'{updated_exam} exam unpaid')
    if updated_college:
        applied.append(f'{updated_college} college unpaid')
    payload['message'] = (
        'Set ' + ' + '.join(messages)
        + (f' (applied to {", ".join(applied)})' if applied else '')
    )
    return Response(payload)

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
    """Admin cannot mark fees paid directly — students must initiate payment first."""
    return Response(
        {
            'detail': (
                'Admin cannot mark fees as paid. The student must submit a payment '
                'from their Payments page; then approve it under Pending Verifications.'
            ),
        },
        status=status.HTTP_403_FORBIDDEN,
    )


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
    apply_fee = data.pop('apply_fee_to_unpaid', False)
    if not data and not apply_fee:
        return Response({'detail': 'No settings provided'}, status=status.HTTP_400_BAD_REQUEST)

    obj = get_system_settings()
    ai_fields = {'attendance_threshold', 'internal_marks_threshold', 'min_sgpa', 'ml_model'}
    ai_changed = any(field in data for field in ai_fields)

    for field, value in data.items():
        setattr(obj, field, value)
    obj.save()

    fee_updated = 0
    if apply_fee:
        exam_val = float(obj.default_exam_fee or 45000)
        college_val = float(getattr(obj, 'default_college_fee', None) or 25000)
        fee_updated += Student.objects.filter(is_deleted=False, exam_fee_paid=False).update(fee_amount=exam_val)
        fee_updated += Student.objects.filter(is_deleted=False, college_fee_paid=False).update(
            college_fee_amount=college_val
        )

    recalculated = 0
    if ai_changed:
        recalculated = refresh_all_eligibility()

    payload = settings_to_dict(obj)
    if recalculated:
        payload['recalculated_students'] = recalculated
    if fee_updated:
        payload['fee_updated_students'] = fee_updated
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
