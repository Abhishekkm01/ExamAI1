from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.db.models import Avg, Q
from .models import User, Student, Teacher, Attendance, InternalMark, Exam, ExamSubject, SeatingArrangement, HallTicket, Notification, ClassTimetable
from .serializers import (FaceVerifyRequestSerializer, FaceVerifyResponseSerializer,
                          TeacherProfileUpdateSerializer, MarksUpdateSerializer)
from .permissions import IsTeacher, IsOwner
from .auth_utils import verify_password, get_password_hash
from .photo_utils import save_profile_photo
from .attendance_service import parse_student_id, refresh_student_attendance_stats
from .marks_service import update_student_marks
import sys
import os

# Add ai_modules to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from .face_service import match_student_face
from .exam_service import exam_to_dict


@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])
def notifications(request):
    """Teacher notifications — college-wide plus own department HOD notices."""
    user = getattr(request, '_jwt_user', request.user)
    if not user or not hasattr(user, 'role') or user.role != 'teacher':
        return Response({'detail': 'Teacher access required'}, status=status.HTTP_403_FORBIDDEN)

    try:
        teacher = Teacher.objects.get(user_id=user.id, is_deleted=False)
        dept = teacher.department
    except Teacher.DoesNotExist:
        dept = None

    qs = Notification.objects.filter(audience__in=['all', 'teachers'])
    if dept:
        prefix = f'[{dept}]'
        qs = qs.filter(Q(title__startswith=prefix) | ~Q(title__startswith='['))

    return Response([
        {
            'id': n.id,
            'title': n.title,
            'message': n.message,
            'audience': n.audience,
            'is_read': n.is_read,
            'created_at': n.created_at.isoformat() if n.created_at else None,
        }
        for n in qs.order_by('-created_at')[:50]
    ])


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
        t = None
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

    today_classes = []
    if t:
        from datetime import date as dt_date
        weekday = dt_date.today().weekday()
        if weekday <= 5:
            today_classes = [
                _slot_to_dict(s)
                for s in ClassTimetable.objects.filter(teacher=t, day_of_week=weekday).order_by('start_time')
            ]

    return Response({
        'students': data,
        'department': dept,
        'subjects': subjects,
        'subject_code': subject_code,
        'date': date,
        'today_classes': today_classes,
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
    """Get student marks for teacher's department"""
    user = getattr(request, '_jwt_user', request.user)
    if not user or not hasattr(user, 'role') or user.role != 'teacher':
        return Response({'detail': 'Teacher access required'}, status=status.HTTP_403_FORBIDDEN)

    from .marks_service import normalize_subject_code

    subject_code = normalize_subject_code(request.query_params.get('subject_code', 'CS301')) or 'CS301'

    try:
        t = Teacher.objects.get(user_id=user.id)
    except Teacher.DoesNotExist:
        dept = "Computer Science"
        subjects = ["CS301", "CS302"]
    else:
        dept = t.department
        subjects = [
            normalize_subject_code(s) for s in t.assigned_subjects.split(',') if s.strip()
        ] or ["CS301", "CS302"]

    students = Student.objects.filter(department=dept, is_deleted=False).select_related('user')
    data = []
    for s in students:
        subject_mark = InternalMark.objects.filter(
            student=s, subject_code__iexact=subject_code
        ).order_by('-updated_at').first()
        data.append({
            'id': s.id,
            'name': s.user.name,
            'roll_no': s.roll_no,
            'photo': s.photo,
            'department': s.department,
            # Never fall back to aggregate marks — that shows the wrong subject.
            'internal_marks': subject_mark.internal_score if subject_mark else 0.0,
            'assignment_marks': subject_mark.assignment_score if subject_mark else 0.0,
        })

    return Response({
        'students': data,
        'department': dept,
        'subjects': subjects,
        'subject_code': subject_code,
    })


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])  # Will be protected by middleware
def update_marks(request):
    """Update student internal/assignment marks"""
    user = getattr(request, '_jwt_user', request.user)
    if not user or not hasattr(user, 'role') or user.role != 'teacher':
        return Response({'detail': 'Teacher access required'}, status=status.HTTP_403_FORBIDDEN)

    serializer = MarksUpdateSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    data = serializer.validated_data

    try:
        t = Teacher.objects.get(user_id=user.id)
        dept = t.department
    except Teacher.DoesNotExist:
        dept = "Computer Science"

    try:
        s = Student.objects.get(id=data['student_id'], is_deleted=False, department=dept)
    except Student.DoesNotExist:
        return Response({'detail': 'Student not found in your department'}, status=status.HTTP_404_NOT_FOUND)

    try:
        update_student_marks(
            s,
            data['subject_code'],
            internal_marks=data['internal_marks'],
            assignment_marks=data['assignment_marks'],
        )
    except ValueError as e:
        return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    return Response({
        'message': 'Marks updated',
        'student_id': s.id,
        'internal_marks': s.internal_marks,
        'assignment_marks': s.assignment_marks,
        'is_eligible': s.is_eligible,
    })


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


@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])
def invigilator_exams(request):
    """List exam subjects where the teacher is assigned as invigilator."""
    user = getattr(request, '_jwt_user', request.user)
    if not user or not hasattr(user, 'role') or user.role != 'teacher':
        return Response({'detail': 'Teacher access required'}, status=status.HTTP_403_FORBIDDEN)

    try:
        teacher = Teacher.objects.get(user_id=user.id, is_deleted=False)
    except Teacher.DoesNotExist:
        return Response({'detail': 'Teacher profile not found'}, status=status.HTTP_404_NOT_FOUND)

    subjects = ExamSubject.objects.filter(
        invigilator=teacher,
        exam__requires_face_verification=True,
        exam__is_deleted=False,
    ).select_related('exam').order_by('exam_date', 'exam_time', 'sort_order')
    return Response([
        {
            'id': s.id,
            'exam_id': s.exam_id,
            'subject_code': s.subject_code,
            'subject_name': s.subject_name,
            'exam_date': s.exam_date or s.exam.exam_date,
            'exam_time': s.exam_time or s.exam.exam_time,
            'duration': s.duration or s.exam.duration,
            'room': s.exam.room,
            'department': s.exam.department,
            'semester': s.exam.semester,
        }
        for s in subjects
    ])


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])  # Will be protected by middleware
def face_verify(request):
    """Face verification for assigned invigilator at exam entry."""
    user = getattr(request, '_jwt_user', request.user)
    if not user or not hasattr(user, 'role') or user.role != 'teacher':
        return Response({'detail': 'Teacher access required'}, status=status.HTTP_403_FORBIDDEN)
    
    serializer = FaceVerifyRequestSerializer(data=request.data)
    if serializer.is_valid():
        try:
            t = Teacher.objects.get(user_id=user.id, is_deleted=False)
        except Teacher.DoesNotExist:
            return Response({'detail': 'Teacher profile not found'}, status=status.HTTP_404_NOT_FOUND)

        exam_subject_id = serializer.validated_data.get('exam_subject_id')
        exam_id = serializer.validated_data.get('exam_id')
        exam = None
        exam_subject = None

        if exam_subject_id:
            try:
                exam_subject = ExamSubject.objects.select_related('exam').get(
                    id=exam_subject_id,
                    exam__is_deleted=False,
                )
            except ExamSubject.DoesNotExist:
                return Response({'detail': 'Exam subject not found'}, status=status.HTTP_404_NOT_FOUND)
            exam = exam_subject.exam
        elif exam_id:
            assigned = ExamSubject.objects.filter(
                exam_id=exam_id,
                invigilator=t,
                exam__is_deleted=False,
            )
            if assigned.count() == 1:
                exam_subject = assigned.first()
                exam = exam_subject.exam
            elif assigned.count() > 1:
                return Response(
                    {'detail': 'exam_subject_id is required when you invigilate multiple subjects on this exam'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            else:
                try:
                    exam = Exam.objects.get(id=exam_id, is_deleted=False)
                except Exam.DoesNotExist:
                    return Response({'detail': 'Exam not found'}, status=status.HTTP_404_NOT_FOUND)
                if exam.invigilator_id != t.id:
                    return Response({'detail': 'You are not the assigned invigilator for this exam'},
                                    status=status.HTTP_403_FORBIDDEN)
        else:
            return Response({'detail': 'exam_id or exam_subject_id is required for invigilator verification'},
                            status=status.HTTP_400_BAD_REQUEST)

        if not exam.requires_face_verification:
            return Response({'detail': 'Face verification is not required for this exam'},
                            status=status.HTTP_400_BAD_REQUEST)
        if exam_subject and exam_subject.invigilator_id != t.id:
            return Response({'detail': 'You are not the assigned invigilator for this subject'},
                            status=status.HTTP_403_FORBIDDEN)

        seated_student_ids = list(
            SeatingArrangement.objects.filter(exam=exam).values_list('student_id', flat=True)
        )
        hall_ticket_ids = list(
            HallTicket.objects.filter(exam=exam, is_active=True).values_list('student_id', flat=True)
        )
        # Match against seated + hall-ticket students, and any enrolled faces in the same dept/sem.
        # (Previously only seated students were checked, so enrolled students without seating failed.)
        students = Student.objects.filter(
            is_deleted=False,
        ).filter(
            Q(id__in=seated_student_ids)
            | Q(id__in=hall_ticket_ids)
            | Q(department=exam.department, semester=exam.semester)
        ).exclude(
            Q(face_encoding__isnull=True) | Q(face_encoding=''),
        ).select_related('user').distinct()

        if not students.exists():
            return Response({
                'verified': False,
                'confidence': 0.0,
                'message': (
                    'No students with an enrolled face found for this exam. '
                    'Ask the student to enroll their face first, or assign seating/hall tickets.'
                ),
                'student_name': None,
            })

        best_match, best_conf, best_result = match_student_face(
            serializer.validated_data['image_base64'],
            students,
            match_slack=0.0,
        )

        if best_match:
            return Response({
                'verified': True,
                'confidence': best_conf,
                'message': best_result['message'] if best_result else 'Verification successful',
                'student_name': best_match.user.name,
                'roll_no': best_match.roll_no,
                'student_id': best_match.id,
                'photo': best_match.photo,
                'department': best_match.department,
                'exam_id': exam.id,
                'exam_name': exam.title or exam.subject_name,
            })

        msg = (best_result or {}).get('message') or 'No matching student found for this exam'
        if best_conf <= 0:
            msg = (
                'Could not match this face to any enrolled student for this exam. '
                'Confirm the student enrolled their face and is in this department/semester.'
            )
        elif best_conf < 40:
            msg = (
                f'No confident match (best {best_conf:.0f}%). '
                'Ask the student to re-enroll their face, then try again with better lighting.'
            )

        return Response({
            'verified': False,
            'confidence': best_conf or 0.0,
            'message': msg,
            'student_name': None,
            'candidates_checked': students.count(),
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


DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']


def _slot_to_dict(slot):
    return {
        'id': slot.id,
        'teacher_id': slot.teacher_id,
        'teacher_name': slot.teacher.user.name if slot.teacher_id and getattr(slot.teacher, 'user', None) else '',
        'subject_code': slot.subject_code,
        'subject_name': slot.subject_name or slot.subject_code,
        'day_of_week': slot.day_of_week,
        'day_name': DAY_NAMES[slot.day_of_week] if 0 <= slot.day_of_week < len(DAY_NAMES) else str(slot.day_of_week),
        'start_time': slot.start_time,
        'end_time': slot.end_time,
        'room': slot.room or '',
        'semester': slot.semester,
        'section': slot.section or 'A',
        'department': slot.department or '',
    }


def _get_teacher_or_403(request):
    user = getattr(request, '_jwt_user', request.user)
    if not user or not hasattr(user, 'role') or user.role != 'teacher':
        return None, Response({'detail': 'Teacher access required'}, status=status.HTTP_403_FORBIDDEN)
    try:
        teacher = Teacher.objects.get(user_id=user.id, is_deleted=False)
    except Teacher.DoesNotExist:
        return None, Response({'detail': 'Teacher profile not found'}, status=status.HTTP_404_NOT_FOUND)
    return teacher, None


@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])
def class_timetable(request):
    """View-only weekly class timetable assigned by HOD for the logged-in teacher."""
    teacher, err = _get_teacher_or_403(request)
    if err:
        return err

    slots = ClassTimetable.objects.filter(teacher=teacher).select_related('teacher__user').order_by(
        'day_of_week', 'start_time', 'id'
    )
    today = __import__('datetime').date.today().weekday()  # Mon=0 … Sun=6
    today_slots = [_slot_to_dict(s) for s in slots if s.day_of_week == today]
    subjects = [s.strip() for s in (teacher.assigned_subjects or '').split(',') if s.strip()] or []
    return Response({
        'slots': [_slot_to_dict(s) for s in slots],
        'today_slots': today_slots,
        'today_day': today if today <= 5 else None,
        'day_names': DAY_NAMES,
        'subjects_assigned': subjects,
        'department': teacher.department,
        'read_only': True,
        'message': 'Class timetable is assigned by HOD and cannot be edited by teachers.',
    })


@api_view(['PUT', 'DELETE', 'POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def class_timetable_detail(request, slot_id):
    """Teachers cannot edit timetable — HOD assigns class schedules."""
    return Response(
        {'detail': 'Class timetable can only be assigned or edited by the HOD.'},
        status=status.HTTP_403_FORBIDDEN,
    )