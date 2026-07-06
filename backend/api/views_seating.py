from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from .models import SeatingRoom, SeatingArrangement, Exam
from .serializers import (SeatingRoomSerializer, SeatingArrangementSerializer,
                          SeatingRoomCreateSerializer, SeatingRoomUpdateSerializer,
                          AutoSeatingSerializer, ManualSeatingSerializer,
                          SeatingArrangementUpdateSerializer)
from .seating_service import SeatingArrangementService
from .permissions import IsAdmin


@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])  # Will be protected by middleware
def list_rooms(request):
    """List all seating rooms"""
    try:
        user = getattr(request, '_jwt_user', request.user)
        if not user or not hasattr(user, 'role') or user.role != 'admin':
            return Response({'detail': 'Admin access required'}, status=status.HTTP_403_FORBIDDEN)
        
        rooms = SeatingRoom.objects.filter(is_active=True)
        serializer = SeatingRoomSerializer(rooms, many=True)
        return Response(serializer.data)
    except Exception as e:
        return Response({'detail': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])  # Will be protected by middleware
def create_room(request):
    """Create a new seating room"""
    try:
        user = getattr(request, '_jwt_user', request.user)
        if not user or not hasattr(user, 'role') or user.role != 'admin':
            return Response({'detail': 'Admin access required'}, status=status.HTTP_403_FORBIDDEN)
        
        serializer = SeatingRoomCreateSerializer(data=request.data)
        if serializer.is_valid():
            room = SeatingRoom.objects.create(**serializer.validated_data)
            response_serializer = SeatingRoomSerializer(room)
            return Response(response_serializer.data, status=status.HTTP_201_CREATED)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        return Response({'detail': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])  # Will be protected by middleware
def get_room(request, room_id):
    """Get details of a specific room"""
    user = getattr(request, '_jwt_user', request.user)
    if not user or not hasattr(user, 'role') or user.role != 'admin':
        return Response({'detail': 'Admin access required'}, status=status.HTTP_403_FORBIDDEN)
    
    try:
        room = SeatingRoom.objects.get(id=room_id)
    except SeatingRoom.DoesNotExist:
        return Response({'detail': 'Room not found'}, status=status.HTTP_404_NOT_FOUND)
    
    serializer = SeatingRoomSerializer(room)
    return Response(serializer.data)


@api_view(['PUT'])
@authentication_classes([])
@permission_classes([AllowAny])  # Will be protected by middleware
def update_room(request, room_id):
    """Update a seating room"""
    user = getattr(request, '_jwt_user', request.user)
    if not user or not hasattr(user, 'role') or user.role != 'admin':
        return Response({'detail': 'Admin access required'}, status=status.HTTP_403_FORBIDDEN)
    
    try:
        room = SeatingRoom.objects.get(id=room_id)
    except SeatingRoom.DoesNotExist:
        return Response({'detail': 'Room not found'}, status=status.HTTP_404_NOT_FOUND)
    
    serializer = SeatingRoomUpdateSerializer(data=request.data, partial=True)
    if serializer.is_valid():
        for field, value in serializer.validated_data.items():
            setattr(room, field, value)
        room.save()
        response_serializer = SeatingRoomSerializer(room)
        return Response(response_serializer.data)
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['DELETE'])
@authentication_classes([])
@permission_classes([AllowAny])  # Will be protected by middleware
def delete_room(request, room_id):
    """Delete a seating room (soft delete)"""
    user = getattr(request, '_jwt_user', request.user)
    if not user or not hasattr(user, 'role') or user.role != 'admin':
        return Response({'detail': 'Admin access required'}, status=status.HTTP_403_FORBIDDEN)
    
    try:
        room = SeatingRoom.objects.get(id=room_id)
    except SeatingRoom.DoesNotExist:
        return Response({'detail': 'Room not found'}, status=status.HTTP_404_NOT_FOUND)
    
    room.is_active = False
    room.save()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])  # Will be protected by middleware
def list_arrangements(request):
    """List seating arrangements, optionally filtered by exam or room"""
    user = getattr(request, '_jwt_user', request.user)
    if not user or not hasattr(user, 'role') or user.role != 'admin':
        return Response({'detail': 'Admin access required'}, status=status.HTTP_403_FORBIDDEN)
    
    exam_id = request.query_params.get('exam_id')
    room_id = request.query_params.get('room_id')
    
    arrangements = SeatingArrangement.objects.all()
    
    if exam_id:
        arrangements = arrangements.filter(exam_id=exam_id)
    if room_id:
        arrangements = arrangements.filter(room_id=room_id)
    
    arrangements = arrangements.select_related('student__user', 'room', 'exam')
    serializer = SeatingArrangementSerializer(arrangements, many=True)
    return Response(serializer.data)


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])  # Will be protected by middleware
def auto_arrange(request):
    """Create automatic seating arrangement for an exam"""
    user = getattr(request, '_jwt_user', request.user)
    if not user or not hasattr(user, 'role') or user.role != 'admin':
        return Response({'detail': 'Admin access required'}, status=status.HTTP_403_FORBIDDEN)
    
    serializer = AutoSeatingSerializer(data=request.data)
    if serializer.is_valid():
        try:
            result = SeatingArrangementService.create_auto_arrangement(
                exam_id=serializer.validated_data['exam_id'],
                room_ids=serializer.validated_data['room_ids'],
                strategy=serializer.validated_data['arrangement_strategy'],
                leave_empty_seats=serializer.validated_data['leave_empty_seats'],
                seats_between_students=serializer.validated_data['seats_between_students']
            )
            return Response(result, status=status.HTTP_201_CREATED)
        except ValueError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])  # Will be protected by middleware
def manual_arrange(request):
    """Create manual seating arrangement"""
    user = getattr(request, '_jwt_user', request.user)
    if not user or not hasattr(user, 'role') or user.role != 'admin':
        return Response({'detail': 'Admin access required'}, status=status.HTTP_403_FORBIDDEN)
    
    serializer = ManualSeatingSerializer(data=request.data)
    if serializer.is_valid():
        try:
            result = SeatingArrangementService.create_manual_arrangement(
                exam_id=serializer.validated_data['exam_id'],
                arrangements_data=serializer.validated_data['arrangements']
            )
            return Response(result, status=status.HTTP_201_CREATED)
        except ValueError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['PUT'])
@authentication_classes([])
@permission_classes([AllowAny])  # Will be protected by middleware
def update_arrangement(request, arrangement_id):
    """Update a specific seating arrangement"""
    user = getattr(request, '_jwt_user', request.user)
    if not user or not hasattr(user, 'role') or user.role != 'admin':
        return Response({'detail': 'Admin access required'}, status=status.HTTP_403_FORBIDDEN)
    
    try:
        arrangement = SeatingArrangement.objects.get(id=arrangement_id)
    except SeatingArrangement.DoesNotExist:
        return Response({'detail': 'Arrangement not found'}, status=status.HTTP_404_NOT_FOUND)
    
    serializer = SeatingArrangementUpdateSerializer(data=request.data, partial=True)
    if serializer.is_valid():
        for field, value in serializer.validated_data.items():
            if field == 'room_id':
                arrangement.room_id = value
            else:
                setattr(arrangement, field, value)
        arrangement.save()
        response_serializer = SeatingArrangementSerializer(arrangement)
        return Response(response_serializer.data)
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['DELETE'])
@authentication_classes([])
@permission_classes([AllowAny])  # Will be protected by middleware
def delete_arrangement(request, arrangement_id):
    """Delete a seating arrangement"""
    user = getattr(request, '_jwt_user', request.user)
    if not user or not hasattr(user, 'role') or user.role != 'admin':
        return Response({'detail': 'Admin access required'}, status=status.HTTP_403_FORBIDDEN)
    
    try:
        arrangement = SeatingArrangement.objects.get(id=arrangement_id)
    except SeatingArrangement.DoesNotExist:
        return Response({'detail': 'Arrangement not found'}, status=status.HTTP_404_NOT_FOUND)
    
    arrangement.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])  # Will be protected by middleware
def get_room_layout(request, room_id):
    """Get seating layout for a room"""
    user = getattr(request, '_jwt_user', request.user)
    if not user or not hasattr(user, 'role') or user.role != 'admin':
        return Response({'detail': 'Admin access required'}, status=status.HTTP_403_FORBIDDEN)
    
    exam_id = request.query_params.get('exam_id')
    
    try:
        if exam_id:
            layout = SeatingArrangementService.get_seating_layout_with_students(room_id, exam_id)
        else:
            layout = SeatingArrangementService.get_seating_layout(room_id)
        return Response(layout)
    except ValueError as e:
        return Response({'detail': str(e)}, status=status.HTTP_404_NOT_FOUND)


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])  # Will be protected by middleware
def confirm_arrangements(request):
    """Confirm seating arrangements for an exam"""
    user = getattr(request, '_jwt_user', request.user)
    if not user or not hasattr(user, 'role') or user.role != 'admin':
        return Response({'detail': 'Admin access required'}, status=status.HTTP_403_FORBIDDEN)
    
    exam_id = request.data.get('exam_id')
    if not exam_id:
        return Response({'detail': 'exam_id is required'}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        exam = Exam.objects.get(id=exam_id)
    except Exam.DoesNotExist:
        return Response({'detail': 'Exam not found'}, status=status.HTTP_404_NOT_FOUND)
    
    # Confirm all arrangements for this exam
    count = SeatingArrangement.objects.filter(exam=exam).update(is_confirmed=True)
    
    return Response({
        'message': f'Confirmed {count} seating arrangements',
        'exam': exam.subject_name
    })


@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])  # Will be protected by middleware
def get_student_seating(request):
    """Get seating arrangement for current student"""
    user = getattr(request, '_jwt_user', request.user)
    if not user or not hasattr(user, 'role') or user.role != 'student':
        return Response({'detail': 'Student access required'}, status=status.HTTP_403_FORBIDDEN)
    
    try:
        from .models import Student
        student = Student.objects.get(user_id=user.id)
    except Student.DoesNotExist:
        return Response({'detail': 'Student profile not found'}, status=status.HTTP_404_NOT_FOUND)
    
    exam_id = request.query_params.get('exam_id')
    
    arrangements = SeatingArrangement.objects.filter(student=student)
    if exam_id:
        arrangements = arrangements.filter(exam_id=exam_id)
    
    arrangements = arrangements.select_related('room', 'exam')
    serializer = SeatingArrangementSerializer(arrangements, many=True)
    return Response(serializer.data)
