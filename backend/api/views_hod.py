"""HOD (Head of Department) APIs — Indian college pattern: department-scoped only."""
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.db.models import Avg, Q
from .models import User, Student, Teacher, HOD, Exam, Notification, EligibilityPrediction
from .serializers import (
    HodProfileUpdateSerializer, HodTeacherSubjectsSerializer,
    HodStudentAcademicUpdateSerializer, NotificationCreateSerializer, NotificationSerializer,
)
from .auth_utils import verify_password, get_password_hash
from .photo_utils import save_profile_photo
from .attendance_service import refresh_student_eligibility, get_attendance_trends
from .exam_service import exam_to_dict
import io
import openpyxl
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas


def _require_hod(request):
    user = getattr(request, '_jwt_user', request.user)
    if not user or not hasattr(user, 'role') or user.role != 'hod':
        return None, None, Response({'detail': 'HOD access required'}, status=status.HTTP_403_FORBIDDEN)
    try:
        hod = HOD.objects.select_related('user').get(user_id=user.id, is_deleted=False)
    except HOD.DoesNotExist:
        return None, None, Response({'detail': 'HOD profile not found'}, status=status.HTTP_404_NOT_FOUND)
    return user, hod, None


def _student_dict(s):
    return {
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
        'ai_risk_score': s.ai_risk_score,
    }


def _teacher_dict(t):
    return {
        'id': t.id,
        'name': t.user.name,
        'email': t.user.email,
        'emp_id': t.emp_id,
        'department': t.department,
        'photo': t.photo,
        'assigned_subjects': t.assigned_subjects.split(',') if t.assigned_subjects else [],
    }


@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])
def dashboard(request):
    user, hod, err = _require_hod(request)
    if err:
        return err

    dept = hod.department
    students = Student.objects.filter(department=dept, is_deleted=False).select_related('user')
    teachers = Teacher.objects.filter(department=dept, is_deleted=False)
    exams = Exam.objects.filter(department=dept, is_deleted=False)

    total = students.count()
    avg_att = round(students.aggregate(v=Avg('attendance_percentage'))['v'] or 0, 1)
    avg_int = round(students.aggregate(v=Avg('internal_marks'))['v'] or 0, 1)
    eligible = students.filter(is_eligible=True).count()
    backlog_count = students.filter(backlogs__gt=0).count()
    at_risk = students.filter(Q(attendance_percentage__lt=75) | Q(backlogs__gt=0) | Q(ai_risk_score__gte=0.5))

    attention = [
        {
            'id': s.id,
            'name': s.user.name,
            'roll_no': s.roll_no,
            'attendance': s.attendance_percentage,
            'backlogs': s.backlogs,
            'ai_risk_score': s.ai_risk_score,
            'is_eligible': s.is_eligible,
            'photo': s.photo,
        }
        for s in at_risk[:20]
    ]

    upcoming = [
        exam_to_dict(e)
        for e in exams.order_by('exam_date', 'exam_time')[:8]
    ]

    return Response({
        'department': dept,
        'total_students': total,
        'total_teachers': teachers.count(),
        'total_exams': exams.count(),
        'avg_attendance': avg_att,
        'avg_internals': avg_int,
        'eligible_count': eligible,
        'ineligible_count': max(0, total - eligible),
        'backlog_students': backlog_count,
        'fee_pending': students.filter(fee_paid=False).count(),
        'students_requiring_attention': attention,
        'upcoming_exams': upcoming,
    })


@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])
def list_students(request):
    user, hod, err = _require_hod(request)
    if err:
        return err

    search = request.query_params.get('search')
    semester = request.query_params.get('semester')
    section = request.query_params.get('section')

    qs = Student.objects.filter(department=hod.department, is_deleted=False).select_related('user')
    if semester:
        qs = qs.filter(semester=int(semester))
    if section:
        qs = qs.filter(section=section)
    if search:
        qs = qs.filter(
            Q(user__name__icontains=search) |
            Q(roll_no__icontains=search) |
            Q(user__email__icontains=search)
        )

    return Response([_student_dict(s) for s in qs.order_by('roll_no')])


@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])
def get_student(request, sid):
    user, hod, err = _require_hod(request)
    if err:
        return err
    try:
        s = Student.objects.select_related('user').get(
            id=sid, department=hod.department, is_deleted=False
        )
    except Student.DoesNotExist:
        return Response({'detail': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
    return Response(_student_dict(s))


@api_view(['PUT'])
@authentication_classes([])
@permission_classes([AllowAny])
def update_student_academic(request, sid):
    """Limited academic updates (Indian HOD practice) — no fees/department/CRUD."""
    user, hod, err = _require_hod(request)
    if err:
        return err
    try:
        s = Student.objects.select_related('user').get(
            id=sid, department=hod.department, is_deleted=False
        )
    except Student.DoesNotExist:
        return Response({'detail': 'Not found'}, status=status.HTTP_404_NOT_FOUND)

    serializer = HodStudentAcademicUpdateSerializer(data=request.data, partial=True)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    data = serializer.validated_data
    for field in ('attendance_percentage', 'internal_marks', 'assignment_marks', 'previous_result', 'backlogs'):
        if field in data:
            setattr(s, field, data[field])
    s.save()
    refresh_student_eligibility(s)
    return Response({'message': 'Student academic record updated', **_student_dict(s)})


@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])
def list_teachers(request):
    user, hod, err = _require_hod(request)
    if err:
        return err
    teachers = Teacher.objects.filter(
        department=hod.department, is_deleted=False
    ).select_related('user')
    return Response([_teacher_dict(t) for t in teachers])


@api_view(['PUT'])
@authentication_classes([])
@permission_classes([AllowAny])
def update_teacher_subjects(request, tid):
    """HOD may assign/update faculty workload subjects only."""
    user, hod, err = _require_hod(request)
    if err:
        return err
    try:
        t = Teacher.objects.select_related('user').get(
            id=tid, department=hod.department, is_deleted=False
        )
    except Teacher.DoesNotExist:
        return Response({'detail': 'Not found'}, status=status.HTTP_404_NOT_FOUND)

    serializer = HodTeacherSubjectsSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    t.assigned_subjects = serializer.validated_data['assigned_subjects']
    t.save()
    return Response({'message': 'Subjects updated', **_teacher_dict(t)})


@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])
def list_exams(request):
    """View-only exam schedule for the department (Exam Cell owns create/seating/tickets)."""
    user, hod, err = _require_hod(request)
    if err:
        return err
    exams = Exam.objects.filter(department=hod.department, is_deleted=False).prefetch_related(
        'subjects__invigilator__user'
    ).order_by('exam_date', 'subject_code')
    return Response([exam_to_dict(e) for e in exams])


@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])
def list_marks(request):
    user, hod, err = _require_hod(request)
    if err:
        return err
    students = Student.objects.filter(
        department=hod.department, is_deleted=False
    ).select_related('user').order_by('roll_no')
    return Response([
        {
            'id': s.id,
            'name': s.user.name,
            'roll_no': s.roll_no,
            'semester': s.semester,
            'section': s.section,
            'internal_marks': s.internal_marks,
            'assignment_marks': s.assignment_marks,
            'previous_result': s.previous_result,
            'attendance': s.attendance_percentage,
        }
        for s in students
    ])


@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])
def list_eligibility(request):
    user, hod, err = _require_hod(request)
    if err:
        return err
    students = Student.objects.filter(
        department=hod.department, is_deleted=False
    ).select_related('user').order_by('roll_no')
    return Response([_student_dict(s) for s in students])


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def verify_department(request):
    """Recompute eligibility for department students only."""
    user, hod, err = _require_hod(request)
    if err:
        return err
    students = Student.objects.filter(department=hod.department, is_deleted=False)
    for s in students:
        refresh_student_eligibility(s)
        EligibilityPrediction.objects.create(
            student=s,
            predicted_probability=s.eligibility_percentage / 100.0,
            risk_score=s.ai_risk_score,
        )
    return Response({'message': f'Verified eligibility for {students.count()} students in {hod.department}.'})


@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])
def list_backlogs(request):
    user, hod, err = _require_hod(request)
    if err:
        return err
    students = Student.objects.filter(
        department=hod.department, is_deleted=False, backlogs__gt=0
    ).select_related('user').order_by('-backlogs', 'roll_no')
    return Response([_student_dict(s) for s in students])


@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])
def list_fees(request):
    """Read-only fee status for the department."""
    user, hod, err = _require_hod(request)
    if err:
        return err
    students = Student.objects.filter(
        department=hod.department, is_deleted=False
    ).select_related('user').order_by('roll_no')
    return Response([
        {
            'id': s.id,
            'name': s.user.name,
            'roll_no': s.roll_no,
            'fee_paid': s.fee_paid,
            'fee_amount': s.fee_amount,
            'fee_due_date': s.fee_due_date,
            'semester': s.semester,
            'section': s.section,
        }
        for s in students
    ])


@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])
def analytics(request):
    user, hod, err = _require_hod(request)
    if err:
        return err
    students = Student.objects.filter(
        department=hod.department, is_deleted=False
    ).select_related('user')

    by_sem = {}
    for s in students:
        key = f'Sem {s.semester}'
        by_sem[key] = by_sem.get(key, 0) + 1
    semester_distribution = [{'name': k, 'value': v} for k, v in sorted(by_sem.items())]

    attendance_data = [
        {'name': s.user.name.split()[0], 'attendance': s.attendance_percentage}
        for s in students
    ]
    eligible = students.filter(is_eligible=True).count()
    total = students.count()

    teachers = Teacher.objects.filter(department=hod.department, is_deleted=False)
    teacher_coverage = []
    for t in teachers:
        subjects = [x.strip() for x in (t.assigned_subjects or '').split(',') if x.strip()]
        teacher_coverage.append({
            'name': t.user.name,
            'emp_id': t.emp_id,
            'subjects_count': len(subjects),
            'subjects': subjects,
        })

    return Response({
        'department': hod.department,
        'semester_distribution': semester_distribution,
        'attendance_data': attendance_data,
        'eligibility': {
            'eligible': eligible,
            'ineligible': max(0, total - eligible),
        },
        'teacher_coverage': teacher_coverage,
        'attendance_trends': get_attendance_trends(7),
        'avg_attendance': round(students.aggregate(v=Avg('attendance_percentage'))['v'] or 0, 1),
        'avg_internals': round(students.aggregate(v=Avg('internal_marks'))['v'] or 0, 1),
        'backlog_count': students.filter(backlogs__gt=0).count(),
    })


def _dept_notification_prefix(department: str) -> str:
    return f'[{department}]'


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def send_notification(request):
    user, hod, err = _require_hod(request)
    if err:
        return err
    serializer = NotificationCreateSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    data = serializer.validated_data
    audience = data['audience']
    if audience not in ('all', 'students', 'teachers'):
        return Response(
            {'detail': 'HOD may notify all, students, or teachers only.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    title = f"{_dept_notification_prefix(hod.department)} {data['title'].strip()}"
    # Keep body clean; department is encoded in the title prefix for filtering.
    message = data['message'].strip()
    notification = Notification.objects.create(title=title, message=message, audience=audience)
    return Response(
        {
            'message': 'Notification sent',
            'id': notification.id,
            'title': notification.title,
            'audience': notification.audience,
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])
def list_notifications(request):
    user, hod, err = _require_hod(request)
    if err:
        return err
    prefix = _dept_notification_prefix(hod.department)
    notifications = Notification.objects.filter(
        Q(title__startswith=prefix) | Q(title__icontains=hod.department) | Q(message__icontains=hod.department)
    ).order_by('-created_at')[:50]
    return Response(NotificationSerializer(notifications, many=True).data)


def _build_dept_report(report_type, department):
    students = Student.objects.filter(
        department=department, is_deleted=False
    ).select_related('user').order_by('roll_no')
    report_type = (report_type or 'attendance').lower()

    if report_type == 'attendance':
        rows = [
            [s.roll_no, s.user.name, s.semester, s.section, s.attendance_percentage]
            for s in students
        ]
        return f'{department} Attendance Report', ['Roll No', 'Name', 'Semester', 'Section', 'Attendance %'], rows

    if report_type == 'marks':
        rows = [
            [s.roll_no, s.user.name, s.internal_marks, s.assignment_marks,
             s.internal_marks + s.assignment_marks]
            for s in students
        ]
        return f'{department} Internal Marks Report', ['Roll No', 'Name', 'Internal /40', 'Assignment /10', 'Total /50'], rows

    if report_type == 'eligibility':
        rows = [
            [s.roll_no, s.user.name, round(s.eligibility_percentage, 1),
             'Eligible' if s.is_eligible else 'Not Eligible', round(s.ai_risk_score, 2),
             s.attendance_percentage, s.internal_marks, 'Yes' if s.fee_paid else 'No', s.backlogs]
            for s in students
        ]
        return f'{department} Eligibility Report', [
            'Roll No', 'Name', 'Eligibility %', 'Status', 'Risk Score',
            'Attendance %', 'Internal /40', 'Fee Paid', 'Backlogs',
        ], rows

    if report_type == 'examination':
        exams = Exam.objects.filter(department=department, is_deleted=False).order_by('exam_date', 'subject_code')
        rows = [
            [e.subject_code, e.subject_name, e.semester, e.exam_date,
             e.exam_time, e.duration, e.room, e.total_marks]
            for e in exams
        ]
        return f'{department} Examination Report', [
            'Subject Code', 'Subject Name', 'Semester', 'Date', 'Time', 'Duration', 'Room', 'Total Marks',
        ], rows

    if report_type == 'backlog':
        backlog_students = students.filter(backlogs__gt=0)
        rows = [
            [s.roll_no, s.user.name, s.semester, s.backlogs,
             s.attendance_percentage, s.internal_marks, 'Eligible' if s.is_eligible else 'Not Eligible']
            for s in backlog_students
        ]
        return f'{department} Backlog Report', [
            'Roll No', 'Name', 'Semester', 'Backlogs', 'Attendance %', 'Internal /40', 'Eligibility',
        ], rows

    if report_type == 'fee':
        rows = [
            [s.roll_no, s.user.name, s.fee_amount,
             'Paid' if s.fee_paid else 'Pending', s.fee_due_date or '-']
            for s in students
        ]
        return f'{department} Fee Status Report', ['Roll No', 'Name', 'Amount (Rs.)', 'Status', 'Due Date'], rows

    return None, None, None


def _pdf_text(value):
    """ReportLab Helvetica only supports latin-1."""
    return str(value).encode('latin-1', 'replace').decode('latin-1')


def _hod_excel_response(report_type, title, headers, rows):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = (title or report_type)[:31]
    ws.append(headers)
    for row in rows:
        ws.append(list(row))
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


def _hod_pdf_response(report_type, title, headers, rows):
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
@permission_classes([AllowAny])
def export_report(request):
    """Export department report. Never use ?format= — DRF reserves it for content negotiation."""
    user, hod, err = _require_hod(request)
    if err:
        return err

    report_type = request.query_params.get('report_type') or request.query_params.get('type') or 'attendance'
    format_type = (
        request.query_params.get('export_format')
        or request.query_params.get('fmt')
        or 'excel'
    ).lower()
    if format_type in ('xlsx', 'xls'):
        format_type = 'excel'

    title, headers, rows = _build_dept_report(report_type, hod.department)
    if title is None:
        return Response({'detail': f'Unknown report type: {report_type}'}, status=status.HTTP_400_BAD_REQUEST)

    if format_type == 'excel':
        return _hod_excel_response(report_type, title, headers, rows)
    if format_type == 'pdf':
        return _hod_pdf_response(report_type, title, headers, rows)
    return Response({'detail': 'Format must be excel or pdf'}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])
def profile(request):
    user, hod, err = _require_hod(request)
    if err:
        return err
    return Response({
        'id': hod.id,
        'name': user.name,
        'email': user.email,
        'emp_id': hod.emp_id,
        'department': hod.department,
        'photo': hod.photo,
        'avatar': user.avatar,
        'role': 'hod',
        'created_at': user.created_at,
        'updated_at': user.updated_at,
    })


@api_view(['PUT'])
@authentication_classes([])
@permission_classes([AllowAny])
def update_profile(request):
    user, hod, err = _require_hod(request)
    if err:
        return err

    serializer = HodProfileUpdateSerializer(data=request.data)
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
        'photo': hod.photo,
    })


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def upload_profile_photo(request):
    user, hod, err = _require_hod(request)
    if err:
        return err
    if 'photo' not in request.FILES:
        return Response({'detail': 'No photo file provided'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        photo_url = save_profile_photo(request.FILES['photo'], 'hod')
    except ValueError as e:
        return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    hod.photo = photo_url
    user.avatar = photo_url
    hod.save()
    user.save()
    return Response({'message': 'Photo updated', 'photo': photo_url})
