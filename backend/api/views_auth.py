from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.db import transaction
from .models import User, Student, Teacher, Exam, Notification, RoleEnum
from .serializers import (UserSerializer, TokenSerializer, BootstrapAdminSerializer, 
                          SetupTeacherSerializer, SetupStudentSerializer, SetupExamSerializer,
                          SendNotificationSerializer, LoginSerializer)
from .auth_utils import get_password_hash, verify_password, create_access_token
import sys
import os

# Add ai_modules to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from ai_modules.eligibility_model import eligibility_ai


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


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])  # Will be protected by middleware
def setup_teacher(request):
    """Admin-only: create a new teacher account."""
    print(f"[DEBUG] setup_teacher called, data: {request.data}")
    serializer = SetupTeacherSerializer(data=request.data)
    if not serializer.is_valid():
        print(f"[DEBUG] Teacher creation validation errors: {serializer.errors}")
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    if serializer.is_valid():
        # Check if user is admin (this will be handled by authentication middleware)
        user = getattr(request, '_jwt_user', request.user)
        print(f"[DEBUG] user: {user}, type: {type(user)}")
        if hasattr(user, 'role'):
            print(f"[DEBUG] user.role: {user.role}")
        if not user or not hasattr(user, 'role') or user.role != RoleEnum.ADMIN:
            return Response({'detail': 'Admin access required'}, status=status.HTTP_403_FORBIDDEN)
        
        with transaction.atomic():
            user = User.objects.create(
                username=serializer.validated_data['email'],  # Use email as username for compatibility
                email=serializer.validated_data['email'],
                hashed_password=get_password_hash(serializer.validated_data.get('password', 'teacher123')),
                name=serializer.validated_data['name'],
                role=RoleEnum.TEACHER,
                avatar=f"https://api.dicebear.com/7.x/avataaars/svg?seed={serializer.validated_data.get('emp_id', serializer.validated_data['email'])}",
            )
            
            teacher = Teacher.objects.create(
                user=user,
                emp_id=serializer.validated_data['emp_id'],
                department=serializer.validated_data['department'],
                photo=user.avatar,
                assigned_subjects=serializer.validated_data.get('assigned_subjects', ''),
            )
        
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
        user = getattr(request, '_jwt_user', request.user)
        if not user or not hasattr(user, 'role') or user.role != RoleEnum.ADMIN:
            return Response({'detail': 'Admin access required'}, status=status.HTTP_403_FORBIDDEN)
        
        data = serializer.validated_data
        
        # Run AI eligibility check
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
        
        with transaction.atomic():
            user = User.objects.create(
                username=data['email'],  # Use email as username for compatibility
                email=data['email'],
                hashed_password=get_password_hash(data.get('password', 'student123')),
                name=data['name'],
                role=RoleEnum.STUDENT,
                avatar=f"https://api.dicebear.com/7.x/avataaars/svg?seed={data.get('roll_no', data['email'])}",
            )
            
            student = Student.objects.create(
                user=user,
                roll_no=data['roll_no'],
                mobile=data.get('mobile'),
                department=data['department'],
                semester=data.get('semester', 5),
                section=data.get('section', 'A'),
                photo=user.avatar,
                attendance_percentage=data.get('attendance_percentage', 0),
                internal_marks=data.get('internal_marks', 0),
                assignment_marks=data.get('assignment_marks', 0),
                previous_result=data.get('previous_result', 0),
                backlogs=data.get('backlogs', 0),
                fee_paid=data.get('fee_paid', False),
                fee_amount=data.get('fee_amount', 45000),
                fee_due_date=data.get('fee_due_date'),
                is_eligible=passed,
                eligibility_percentage=pct,
                ai_risk_score=ai['risk_score'],
            )
        
        return Response({'message': f"Student {user.name} created", 'student_id': student.id, 'is_eligible': passed}, 
                       status=status.HTTP_201_CREATED)
    
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
        
        exam = Exam.objects.create(**serializer.validated_data)
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
