from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.db.models import Avg, Q
from .models import User, Student, Teacher, Attendance, InternalMark
from .serializers import FaceVerifyRequestSerializer, FaceVerifyResponseSerializer
from .permissions import IsTeacher
import sys
import os

# Add ai_modules to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from ai_modules.face_recognition_module import face_ai
from ai_modules.eligibility_model import eligibility_ai


def _parse_student_id(raw):
    """Accept ids sent as 1, "1" or the frontend's "s1" form."""
    digits = ''.join(ch for ch in str(raw) if ch.isdigit())
    return int(digits) if digits else None


def _recompute_eligibility(s):
    """Recompute a student's cached eligibility after marks/attendance change."""
    ai = eligibility_ai.predict_eligibility(
        s.attendance_percentage,
        s.internal_marks,
        s.previous_result,
        s.backlogs,
    )
    s.is_eligible = (s.attendance_percentage >= 75.0) and \
        ((s.internal_marks / 40.0) >= 0.4) and \
        (s.backlogs == 0) and s.fee_paid and (s.previous_result >= 5.0)
    s.eligibility_percentage = round(ai['probability'] * 100.0, 1)
    s.ai_risk_score = ai['risk_score']


@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])  # Will be protected by middleware
def dashboard(request):
    """Teacher dashboard"""
    user = getattr(request, '_jwt_user', request.user)
    if not user or not hasattr(user, 'role') or user.role != 'teacher':
        return Response({'detail': 'Teacher access required'}, status=status.HTTP_403_FORBIDDEN)
    
    try:
        t = Teacher.objects.get(user_id=user.id)
    except Teacher.DoesNotExist:
        dept = "Computer Science"
    else:
        dept = t.department
    
    students = Student.objects.filter(department=dept, is_deleted=False)
    avg_att = students.aggregate(avg_att=Avg('attendance_percentage'))['avg_att'] or 0
    avg_att = round(avg_att, 1)
    avg_int = students.aggregate(avg_int=Avg('internal_marks'))['avg_int'] or 0
    avg_int = round(avg_int, 1)
    
    requiring_attention = students.filter(
        Q(attendance_percentage__lt=75) | Q(backlogs__gt=0)
    )
    
    attention_data = []
    for s in requiring_attention:
        attention_data.append({
            'id': s.id,
            'name': s.user.name,
            'roll_no': s.roll_no,
            'attendance': s.attendance_percentage,
            'backlogs': s.backlogs,
            'photo': s.photo
        })
    
    subjects = t.assigned_subjects.split(',') if t and t.assigned_subjects else ["CS301", "CS302"]
    
    return Response({
        'total_students': students.count(),
        'subjects_assigned': subjects,
        'avg_attendance': avg_att,
        'avg_internals': avg_int,
        'students_requiring_attention': attention_data
    })


@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])  # Will be protected by middleware
def get_roll(request):
    """Get student roll for attendance marking"""
    user = getattr(request, '_jwt_user', request.user)
    if not user or not hasattr(user, 'role') or user.role != 'teacher':
        return Response({'detail': 'Teacher access required'}, status=status.HTTP_403_FORBIDDEN)
    
    subject_code = request.query_params.get('subject_code', 'CS301')
    
    try:
        t = Teacher.objects.get(user_id=user.id)
    except Teacher.DoesNotExist:
        dept = "Computer Science"
    else:
        dept = t.department
    
    students = Student.objects.filter(department=dept, is_deleted=False)
    data = []
    for s in students:
        data.append({
            'id': s.id,
            'name': s.user.name,
            'roll_no': s.roll_no,
            'photo': s.photo,
            'attendance_percentage': s.attendance_percentage
        })
    return Response(data)


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])  # Will be protected by middleware
def mark_attendance(request):
    """Mark attendance for students"""
    user = getattr(request, '_jwt_user', request.user)
    if not user or not hasattr(user, 'role') or user.role != 'teacher':
        return Response({'detail': 'Teacher access required'}, status=status.HTTP_403_FORBIDDEN)
    
    records = request.data.get('records', {})
    subject_code = request.data.get('subject_code', 'CS301')
    date = request.data.get('date', '2026-11-01')
    
    saved = 0
    for sid, present in records.items():
        student_id = _parse_student_id(sid)
        if student_id is None:
            continue
        try:
            s = Student.objects.get(id=student_id)
        except Student.DoesNotExist:
            continue
        
        new_status = 'Present' if present else 'Absent'
        
        # One record per student/subject/day: re-saving updates it instead of
        # piling up duplicate rows (which used to inflate attendance on every save).
        existing = Attendance.objects.filter(
            student=s, subject_code=subject_code, record_date=date
        ).first()
        old_status = existing.status if existing else None
        
        if existing:
            existing.status = new_status
            existing.save()
        else:
            Attendance.objects.create(
                student=s,
                subject_code=subject_code,
                record_date=date,
                status=new_status,
            )
        
        # Adjust the cached percentage only by the change in this record's
        # contribution (+0.5 present / -0.5 absent) so repeated saves are idempotent.
        def contribution(status):
            return 0.5 if status == 'Present' else -0.5
        delta = contribution(new_status) - (contribution(old_status) if old_status else 0.0)
        if delta:
            s.attendance_percentage = max(0.0, min(100.0, s.attendance_percentage + delta))
            _recompute_eligibility(s)
            s.save()
        saved += 1
    
    return Response({'message': 'Attendance saved', 'records_saved': saved})


@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])  # Will be protected by middleware
def get_marks(request):
    """Get student marks"""
    user = getattr(request, '_jwt_user', request.user)
    if not user or not hasattr(user, 'role') or user.role != 'teacher':
        return Response({'detail': 'Teacher access required'}, status=status.HTTP_403_FORBIDDEN)
    
    subject_code = request.query_params.get('subject_code', 'CS301')
    
    try:
        t = Teacher.objects.get(user_id=user.id)
    except Teacher.DoesNotExist:
        dept = "Computer Science"
    else:
        dept = t.department
    
    students = Student.objects.filter(department=dept, is_deleted=False)
    data = []
    for s in students:
        data.append({
            'id': s.id,
            'name': s.user.name,
            'roll_no': s.roll_no,
            'photo': s.photo,
            'internal_marks': s.internal_marks,
            'assignment_marks': s.assignment_marks
        })
    return Response(data)


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])  # Will be protected by middleware
def update_marks(request):
    """Update student marks"""
    user = getattr(request, '_jwt_user', request.user)
    if not user or not hasattr(user, 'role') or user.role != 'teacher':
        return Response({'detail': 'Teacher access required'}, status=status.HTTP_403_FORBIDDEN)
    
    student_id = _parse_student_id(request.data.get('student_id'))
    subject_code = request.data.get('subject_code', 'CS301')
    internal_marks = request.data.get('internal_marks')
    assignment_marks = request.data.get('assignment_marks')
    
    if student_id is None:
        return Response({'detail': 'A valid student_id is required'}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        s = Student.objects.get(id=student_id)
    except Student.DoesNotExist:
        return Response({'detail': 'Student not found'}, status=status.HTTP_404_NOT_FOUND)
    
    if internal_marks is not None:
        s.internal_marks = float(internal_marks)
    if assignment_marks is not None:
        s.assignment_marks = float(assignment_marks)
    _recompute_eligibility(s)
    s.save()
    
    # Keep a single per-subject row instead of appending a new one every save.
    InternalMark.objects.update_or_create(
        student=s,
        subject_code=subject_code,
        defaults={
            'internal_score': s.internal_marks,
            'assignment_score': s.assignment_marks,
        },
    )
    
    return Response({'message': 'Marks updated'})


@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])  # Will be protected by middleware
def monitor_students(request):
    """Monitor students"""
    user = getattr(request, '_jwt_user', request.user)
    if not user or not hasattr(user, 'role') or user.role != 'teacher':
        return Response({'detail': 'Teacher access required'}, status=status.HTTP_403_FORBIDDEN)
    
    try:
        t = Teacher.objects.get(user_id=user.id)
    except Teacher.DoesNotExist:
        dept = "Computer Science"
    else:
        dept = t.department
    
    students = Student.objects.filter(department=dept, is_deleted=False)
    data = []
    for s in students:
        data.append({
            'id': s.id,
            'name': s.user.name,
            'roll_no': s.roll_no,
            'photo': s.photo,
            'attendance': s.attendance_percentage,
            'internal_marks': s.internal_marks,
            'assignment_marks': s.assignment_marks,
            'previous_result': s.previous_result,
            'backlogs': s.backlogs,
            'is_eligible': s.is_eligible,
            'department': s.department
        })
    return Response(data)


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])  # Will be protected by middleware
def face_verify(request):
    """Face verification for teacher"""
    user = getattr(request, '_jwt_user', request.user)
    if not user or not hasattr(user, 'role') or user.role != 'teacher':
        return Response({'detail': 'Teacher access required'}, status=status.HTTP_403_FORBIDDEN)
    
    serializer = FaceVerifyRequestSerializer(data=request.data)
    if serializer.is_valid():
        try:
            t = Teacher.objects.get(user_id=user.id)
        except Teacher.DoesNotExist:
            dept = "Computer Science"
        else:
            dept = t.department
        
        students = Student.objects.filter(department=dept, is_deleted=False)
        best_conf = 0.0
        best_match = None
        
        for s in students:
            res = face_ai.verify_face(serializer.validated_data['image_base64'], [0.1] * 128)
            if res['verified'] and res['confidence'] > best_conf:
                best_conf = res['confidence']
                best_match = s
        
        if best_match:
            return Response({
                'verified': True,
                'confidence': best_conf,
                'message': 'Verification successful',
                'student_name': best_match.user.name
            })
        
        return Response({
            'verified': False,
            'confidence': 0.0,
            'message': 'No biometric match',
            'student_name': None
        })
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
