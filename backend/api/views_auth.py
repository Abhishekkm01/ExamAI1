from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.db import transaction, IntegrityError
from .models import User, Student, Teacher, Exam, Notification, RoleEnum
from .serializers import (UserSerializer, TokenSerializer, BootstrapAdminSerializer, 
                          SetupTeacherSerializer, SetupStudentSerializer, RegisterStudentSerializer,
                          SetupExamSerializer, SendNotificationSerializer, LoginSerializer)
from .auth_utils import get_password_hash, verify_password, create_access_token
import sys
import os

# Add ai_modules to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from .photo_utils import save_profile_photo


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def login(request):
    """Login endpoint - returns JWT token"""
    serializer = LoginSerializer(data=request.data)
    if serializer.is_valid():
        email = serializer.validated_data['email']
        password = serializer.validated_data['password']
        
        try:
            user = User.objects.get(email=email, is_deleted=False)
        except User.DoesNotExist:
            return Response({'detail': 'Incorrect email or password'}, status=status.HTTP_401_UNAUTHORIZED)
        
        if verify_password(password, user.hashed_password):
            access_token = create_access_token({"sub": user.email, "role": user.role})
            user_serializer = UserSerializer(user)
            return Response({
                'access_token': access_token,
                'token_type': 'bearer',
                'user': user_serializer.data
            })
        else:
            return Response({'detail': 'Incorrect email or password'}, status=status.HTTP_401_UNAUTHORIZED)
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def bootstrap_admin(request):
    """Create the first admin account. Only works if no admin exists yet."""
    serializer = BootstrapAdminSerializer(data=request.data)
    if serializer.is_valid():
        # Check if admin already exists (only non-deleted admins)
        if User.objects.filter(role=RoleEnum.ADMIN, is_deleted=False).exists():
            return Response({'detail': 'An admin account already exists. Use the login page.'}, 
                          status=status.HTTP_400_BAD_REQUEST)
        
        if User.objects.filter(email=serializer.validated_data['email']).exists():
            return Response({'detail': f"A user with email {serializer.validated_data['email']} already exists."},
                          status=status.HTTP_400_BAD_REQUEST)
        
        user = User.objects.create(
            username=None,  # Set username to None since we use email as USERNAME_FIELD
            email=serializer.validated_data['email'],
            hashed_password=get_password_hash(serializer.validated_data['password']),
            name=serializer.validated_data['name'],
            role=RoleEnum.ADMIN,
            avatar=f"https://api.dicebear.com/7.x/avataaars/svg?seed={serializer.validated_data['email']}",
        )
        return Response({'message': f"Admin account created for {user.email}"}, 
                       status=status.HTTP_201_CREATED)
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


def _create_student_account(data, password):
    """Shared logic for admin setup and public student registration."""
    existing_user = User.objects.filter(email=data['email']).first()
    existing_student = Student.objects.filter(roll_no=data['roll_no']).first()

    if existing_user and not existing_user.is_deleted:
        return None, Response({'detail': f"A user with email {data['email']} already exists."},
                              status=status.HTTP_400_BAD_REQUEST)
    if existing_student and not existing_student.is_deleted:
        return None, Response({'detail': f"A student with roll number {data['roll_no']} already exists."},
                              status=status.HTTP_400_BAD_REQUEST)
    if existing_user and existing_student and existing_user.id != existing_student.user_id:
        return None, Response({'detail': "This email and roll number belong to different records. Use unique values."},
                              status=status.HTTP_400_BAD_REQUEST)

    ai = eligibility_ai.predict_eligibility(
        data.get('attendance_percentage', 0),
        data.get('internal_marks', 0),
        data.get('previous_result', 0),
        data.get('backlogs', 0),
    )

    passed = (data.get('attendance_percentage', 0) >= 75) and \
              ((data.get('internal_marks', 0) / 40) * 100 >= 40) and \
              (data.get('backlogs', 0) == 0) and \
              data.get('fee_paid', False) and \
              (data.get('previous_result', 0) >= 5.0)

    pct = round((sum([
        data.get('attendance_percentage', 0) >= 75,
        (data.get('internal_marks', 0) / 40) * 100 >= 40,
        data.get('backlogs', 0) == 0,
        data.get('fee_paid', False),
        data.get('previous_result', 0) >= 5.0,
    ]) / 5) * 100)

    avatar = data.get('photo') or f"https://api.dicebear.com/7.x/avataaars/svg?seed={data.get('roll_no') or data['email']}"
    try:
        with transaction.atomic():
            user = existing_user or User(username=None, email=data['email'])
            user.username = None
            user.email = data['email']
            user.hashed_password = get_password_hash(password)
            user.name = data['name']
            user.role = RoleEnum.STUDENT
            user.avatar = avatar
            user.is_deleted = False
            user.save()

            student = Student.objects.filter(user=user).first() or Student(user=user)
            student.roll_no = data['roll_no']
            student.mobile = data.get('mobile')
            student.department = data['department']
            student.semester = data.get('semester', 5)
            student.section = data.get('section', 'A') or 'A'
            student.photo = avatar
            student.attendance_percentage = data.get('attendance_percentage', 0)
            student.internal_marks = data.get('internal_marks', 0)
            student.assignment_marks = data.get('assignment_marks', 0)
            student.previous_result = data.get('previous_result', 0)
            student.backlogs = data.get('backlogs', 0)
            student.fee_paid = data.get('fee_paid', False)
            student.fee_amount = data.get('fee_amount', 45000)
            student.fee_due_date = data.get('fee_due_date')
            student.is_eligible = passed
            student.eligibility_percentage = pct
            student.ai_risk_score = ai['risk_score']
            student.is_deleted = False
            student.save()
    except IntegrityError:
        return None, Response({'detail': "Could not create student: the email or roll number is already in use."},
                              status=status.HTTP_400_BAD_REQUEST)

    return student, Response({'message': f"Student {user.name} created", 'student_id': student.id, 'is_eligible': passed},
                             status=status.HTTP_201_CREATED)


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def register_student(request):
    """Public: student self-registration from the login page."""
    serializer = RegisterStudentSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    data = dict(serializer.validated_data)
    if 'photo' in request.FILES:
        try:
            data['photo'] = save_profile_photo(request.FILES['photo'], 'student')
        except ValueError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    _, response = _create_student_account(data, data['password'])
    return response


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])  # Will be protected by middleware
def setup_teacher(request):
    """Admin-only: create a new teacher account."""
    serializer = SetupTeacherSerializer(data=request.data)
    if serializer.is_valid():
        # Check if user is admin (this will be handled by authentication middleware)
        current_user = getattr(request, '_jwt_user', request.user)
        if not current_user or not hasattr(current_user, 'role') or current_user.role != RoleEnum.ADMIN:
            return Response({'detail': 'Admin access required'}, status=status.HTTP_403_FORBIDDEN)
        
        data = serializer.validated_data
        email = data['email']
        emp_id = data['emp_id']
        avatar = f"https://api.dicebear.com/7.x/avataaars/svg?seed={emp_id or email}"
        
        # Reject clashes with active records, otherwise reuse soft-deleted rows so the
        # DB unique constraints on email/emp_id are not violated (delete + re-add flow).
        existing_user = User.objects.filter(email=email).first()
        existing_teacher = Teacher.objects.filter(emp_id=emp_id).first()
        
        if existing_user and not existing_user.is_deleted:
            return Response({'detail': f"A user with email {email} already exists."},
                          status=status.HTTP_400_BAD_REQUEST)
        if existing_teacher and not existing_teacher.is_deleted:
            return Response({'detail': f"A teacher with employee ID {emp_id} already exists."},
                          status=status.HTTP_400_BAD_REQUEST)
        if existing_user and existing_teacher and existing_user.id != existing_teacher.user_id:
            return Response({'detail': "This email and employee ID belong to different deleted records. Use unique values."},
                          status=status.HTTP_400_BAD_REQUEST)
        
        try:
            with transaction.atomic():
                user = existing_user or User(username=None, email=email)
                user.username = None
                user.email = email
                user.hashed_password = get_password_hash(data.get('password', 'teacher123'))
                user.name = data['name']
                user.role = RoleEnum.TEACHER
                user.avatar = avatar
                user.is_deleted = False
                user.save()
                
                teacher = Teacher.objects.filter(user=user).first() or Teacher(user=user)
                teacher.emp_id = emp_id
                teacher.department = data['department']
                teacher.photo = avatar
                teacher.assigned_subjects = data.get('assigned_subjects', '')
                teacher.is_deleted = False
                teacher.save()
        except IntegrityError:
            return Response({'detail': "Could not create teacher: the email or employee ID is already in use."},
                          status=status.HTTP_400_BAD_REQUEST)
        
        return Response({'message': f"Teacher {user.name} created", 'teacher_id': teacher.id}, 
                       status=status.HTTP_201_CREATED)
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])  # Will be protected by middleware
def setup_student(request):
    """Admin-only: create a new student account."""
    serializer = SetupStudentSerializer(data=request.data)
    if serializer.is_valid():
        # Check if user is admin
        current_user = getattr(request, '_jwt_user', request.user)
        if not current_user or not hasattr(current_user, 'role') or current_user.role != RoleEnum.ADMIN:
            return Response({'detail': 'Admin access required'}, status=status.HTTP_403_FORBIDDEN)

        data = serializer.validated_data
        _, response = _create_student_account(data, data.get('password', 'student123'))
        return response
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])  # Will be protected by middleware
def setup_exam(request):
    """Admin-only: create a new exam entry."""
    serializer = SetupExamSerializer(data=request.data)
    if serializer.is_valid():
        # Check if user is admin
        user = getattr(request, '_jwt_user', request.user)
        if not user or not hasattr(user, 'role') or user.role != RoleEnum.ADMIN:
            return Response({'detail': 'Admin access required'}, status=status.HTTP_403_FORBIDDEN)
        
        subject_code = serializer.validated_data['subject_code']
        if Exam.objects.filter(subject_code=subject_code, is_deleted=False).exists():
            return Response({'detail': f"An exam with subject code {subject_code} already exists."},
                          status=status.HTTP_400_BAD_REQUEST)
        try:
            exam = Exam.objects.create(**serializer.validated_data)
        except IntegrityError:
            return Response({'detail': f"Could not create exam: subject code {subject_code} is already in use."},
                          status=status.HTTP_400_BAD_REQUEST)
        return Response({'message': f"Exam {exam.subject_code} created", 'exam_id': exam.id}, 
                       status=status.HTTP_201_CREATED)
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])  # Will be protected by middleware
def send_notification(request):
    """Admin-only: create a notification."""
    serializer = SendNotificationSerializer(data=request.data)
    if serializer.is_valid():
        # Check if user is admin
        user = getattr(request, '_jwt_user', request.user)
        if not user or not hasattr(user, 'role') or user.role != RoleEnum.ADMIN:
            return Response({'detail': 'Admin access required'}, status=status.HTTP_403_FORBIDDEN)
        
        notification = Notification.objects.create(
            title=serializer.validated_data['title'],
            message=serializer.validated_data['message'],
            audience=serializer.validated_data['audience'],
            is_read=False,
        )
        return Response({'message': 'Notification sent'}, status=status.HTTP_201_CREATED)
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
