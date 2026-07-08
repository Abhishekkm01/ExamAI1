from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.db.models import Avg, Q
from .models import User, Student, Teacher, Attendance, InternalMark
from .serializers import (FaceVerifyRequestSerializer, FaceVerifyResponseSerializer,
                          TeacherProfileUpdateSerializer)
from .permissions import IsTeacher, IsOwner
from .auth_utils import verify_password, get_password_hash
from .photo_utils import save_profile_photo
from .attendance_service import parse_student_id, refresh_student_attendance_stats
import sys
import os

# Add ai_modules to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from ai_modules.face_recognition_module import face_ai


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
    date = request.query_params.get('date')

    try:
        t = Teacher.objects.get(user_id=user.id)
    except Teacher.DoesNotExist:
        dept = "Computer Science"
        subjects = ["CS301", "CS302"]
    else:
        dept = t.department
        subjects = [s.strip() for s in t.assigned_subjects.split(',') if s.strip()] or ["CS301", "CS302"]

    students = Student.objects.filter(department=dept, is_deleted=False).select_related('user')
    data = []
    for s in students:
        today_record = None
        if date:
            today_record = Attendance.objects.filter(
                student=s, subject_code=subject_code, record_date=date
            ).first()

        data.append({
            'id': s.id,
            'name': s.user.name,
            'roll_no': s.roll_no,
            'photo': s.photo,
            'department': s.department,
            'attendance_percentage': s.attendance_percentage,
            'today_status': today_record.status if today_record else None,
        })

    return Response({
        'students': data,
        'department': dept,
        'subjects': subjects,
        'subject_code': subject_code,
        'date': date,
    })


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])  # Will be protected by middleware
def mark_attendance(request):
    """Mark attendance for students"""
    user = getattr(request, '_jwt_user', request.user)
    if not user or not hasattr(user, 'role') or user.role != 'teacher':
        return Response({'detail': 'Teacher access required'}, status=status.HTTP_403_FORBIDDEN)

    records = request.data.get('records', {})
    if not records:
        return Response({'detail': 'No attendance records provided'}, status=status.HTTP_400_BAD_REQUEST)

    subject_code = request.data.get('subject_code', 'CS301')
    date = request.data.get('date')
    if not date:
        from datetime import date as dt_date
        date = dt_date.today().isoformat()

    updated = 0
    for sid, present in records.items():
        try:
            s = Student.objects.get(id=parse_student_id(sid), is_deleted=False)
        except (Student.DoesNotExist, ValueError, TypeError):
            continue

        Attendance.objects.update_or_create(
            student=s,
            subject_code=subject_code,
            record_date=date,
            defaults={'status': 'Present' if present else 'Absent'},
        )
        refresh_student_attendance_stats(s)
        updated += 1

    return Response({
        'message': f'Attendance saved for {updated} student(s)',
        'date': date,
        'subject_code': subject_code,
    })


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
    
    student_id = request.data.get('student_id')
    subject_code = request.data.get('subject_code', 'CS301')
    internal_marks = request.data.get('internal_marks')
    assignment_marks = request.data.get('assignment_marks')
    
    try:
        s = Student.objects.get(id=student_id)
    except Student.DoesNotExist:
        return Response({'detail': 'Student not found'}, status=status.HTTP_404_NOT_FOUND)
    
    if internal_marks is not None:
        s.internal_marks = float(internal_marks)
    if assignment_marks is not None:
        s.assignment_marks = float(assignment_marks)
    s.save()
    
    InternalMark.objects.create(
        student=s,
        subject_code=subject_code,
        internal_score=s.internal_marks,
        assignment_score=s.assignment_marks
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


@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])  # Will be protected by middleware
def profile(request):
    """Get teacher's own profile"""
    user = getattr(request, '_jwt_user', request.user)
    if not user or not hasattr(user, 'role') or user.role != 'teacher':
        return Response({'detail': 'Teacher access required'}, status=status.HTTP_403_FORBIDDEN)
    
    try:
        t = Teacher.objects.get(user_id=user.id)
    except Teacher.DoesNotExist:
        return Response({'detail': 'Teacher profile not found'}, status=status.HTTP_404_NOT_FOUND)
    
    return Response({
        'id': t.id,
        'name': user.name,
        'email': user.email,
        'emp_id': t.emp_id,
        'department': t.department,
        'photo': t.photo,
        'assigned_subjects': t.assigned_subjects,
        'avatar': user.avatar,
        'created_at': user.created_at,
        'updated_at': user.updated_at
    })


@api_view(['PUT'])
@authentication_classes([])
@permission_classes([AllowAny])  # Will be protected by middleware
def update_profile(request):
    """Update teacher's profile fields and optionally change password."""
    user = getattr(request, '_jwt_user', request.user)
    if not user or not hasattr(user, 'role') or user.role != 'teacher':
        return Response({'detail': 'Teacher access required'}, status=status.HTTP_403_FORBIDDEN)

    try:
        t = Teacher.objects.get(user_id=user.id)
    except Teacher.DoesNotExist:
        return Response({'detail': 'Teacher profile not found'}, status=status.HTTP_404_NOT_FOUND)

    serializer = TeacherProfileUpdateSerializer(data=request.data)
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
        'photo': t.photo
    })


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])  # Will be protected by middleware
def upload_profile_photo(request):
    """Upload or replace the teacher's profile photo."""
    user = getattr(request, '_jwt_user', request.user)
    if not user or not hasattr(user, 'role') or user.role != 'teacher':
        return Response({'detail': 'Teacher access required'}, status=status.HTTP_403_FORBIDDEN)

    try:
        t = Teacher.objects.get(user_id=user.id)
    except Teacher.DoesNotExist:
        return Response({'detail': 'Teacher profile not found'}, status=status.HTTP_404_NOT_FOUND)

    if 'photo' not in request.FILES:
        return Response({'detail': 'No photo file provided'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        photo_url = save_profile_photo(request.FILES['photo'], 'teacher')
    except ValueError as e:
        return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    t.photo = photo_url
    user.avatar = photo_url
    t.save()
    user.save()

    return Response({'message': 'Photo updated', 'photo': photo_url})
