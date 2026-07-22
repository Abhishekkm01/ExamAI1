from rest_framework import serializers
from .department_service import is_valid_department, get_department_names, canonical_department


def validate_department_name(value):
    canonical = canonical_department(value)
    if not canonical:
        allowed = ', '.join(get_department_names())
        raise serializers.ValidationError(f'Invalid department. Choose from: {allowed}')
    return canonical
from .models import User, Student, Teacher, HOD, Exam, Attendance, InternalMark, HallTicket, Notification, ChatbotLog, EligibilityPrediction


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'email', 'name', 'role', 'avatar', 'created_at', 'updated_at', 'is_deleted']


class StudentSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    
    class Meta:
        model = Student
        fields = ['id', 'user', 'roll_no', 'mobile', 'department', 'semester', 'section', 
                  'photo', 'attendance_percentage', 'internal_marks', 'assignment_marks',
                  'previous_result', 'backlogs', 'fee_paid', 'fee_amount', 'exam_fee_paid',
                  'college_fee_amount', 'college_fee_paid', 'fee_due_date',
                  'is_eligible', 'eligibility_percentage', 'ai_risk_score', 'created_at', 'updated_at', 'is_deleted']


class TeacherSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    
    class Meta:
        model = Teacher
        fields = ['id', 'user', 'emp_id', 'department', 'photo', 'assigned_subjects', 
                  'created_at', 'updated_at', 'is_deleted']


class HODSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = HOD
        fields = ['id', 'user', 'emp_id', 'department', 'photo',
                  'created_at', 'updated_at', 'is_deleted']


class ExamSerializer(serializers.ModelSerializer):
    class Meta:
        model = Exam
        fields = ['id', 'subject_code', 'subject_name', 'department', 'semester', 
                  'exam_date', 'exam_time', 'duration', 'room', 'total_marks', 
                  'created_at', 'updated_at', 'is_deleted']


class AttendanceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Attendance
        fields = ['id', 'student', 'subject_code', 'record_date', 'status', 'created_at', 'updated_at']


class InternalMarkSerializer(serializers.ModelSerializer):
    class Meta:
        model = InternalMark
        fields = ['id', 'student', 'subject_code', 'internal_score', 'assignment_score', 'created_at', 'updated_at']


class HallTicketSerializer(serializers.ModelSerializer):
    student = StudentSerializer(read_only=True)
    exam = ExamSerializer(read_only=True)
    
    class Meta:
        model = HallTicket
        fields = ['id', 'hall_ticket_no', 'student', 'exam', 'seat_number', 'room', 
                  'qr_code_content', 'is_active', 'created_at', 'updated_at']


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ['id', 'title', 'message', 'audience', 'is_read', 'created_at']


class ChatbotLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatbotLog
        fields = ['id', 'student', 'user_query', 'bot_response', 'created_at']


class EligibilityPredictionSerializer(serializers.ModelSerializer):
    class Meta:
        model = EligibilityPrediction
        fields = ['id', 'student', 'predicted_probability', 'risk_score', 'factors_summary', 'created_at']


# Request/Response serializers
class TokenSerializer(serializers.Serializer):
    access_token = serializers.CharField()
    token_type = serializers.CharField()
    user = UserSerializer()


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField()


class BootstrapAdminSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField()
    name = serializers.CharField()


class SetupTeacherSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(required=False)
    name = serializers.CharField()
    emp_id = serializers.CharField()
    department = serializers.CharField()
    assigned_subjects = serializers.CharField(required=False, allow_blank=True)

    def validate_department(self, value):
        return validate_department_name(value)


class SetupHodSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(required=False)
    name = serializers.CharField()
    emp_id = serializers.CharField()
    department = serializers.CharField()

    def validate_department(self, value):
        return validate_department_name(value)


class RegisterStudentSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(min_length=6)
    name = serializers.CharField()
    roll_no = serializers.CharField()
    department = serializers.CharField()
    semester = serializers.IntegerField(min_value=1, max_value=8)
    section = serializers.CharField(required=False, allow_blank=True, default="A")
    mobile = serializers.CharField(min_length=10, max_length=20)
    gender = serializers.ChoiceField(choices=['male', 'female', 'other'], required=False, allow_blank=True)
    date_of_birth = serializers.CharField(required=False, allow_blank=True)

    def validate_department(self, value):
        return validate_department_name(value)

    def validate_mobile(self, value):
        digits = ''.join(ch for ch in (value or '') if ch.isdigit())
        if len(digits) < 10:
            raise serializers.ValidationError('Phone number must have at least 10 digits.')
        return value.strip()


class StudentProfileUpdateSerializer(serializers.Serializer):
    name = serializers.CharField(required=False)
    mobile = serializers.CharField(required=False, allow_blank=True)
    section = serializers.CharField(required=False, allow_blank=True)
    current_password = serializers.CharField(required=False)
    new_password = serializers.CharField(required=False, min_length=6)

    def validate(self, data):
        new_pw = data.get('new_password')
        if new_pw and not data.get('current_password'):
            raise serializers.ValidationError({'current_password': 'Current password is required to set a new password.'})
        return data


class SetupStudentSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(required=False)
    name = serializers.CharField()
    roll_no = serializers.CharField()
    department = serializers.CharField()
    semester = serializers.IntegerField()
    section = serializers.CharField(required=False, allow_blank=True)
    mobile = serializers.CharField(min_length=10, max_length=20)
    gender = serializers.ChoiceField(choices=['male', 'female', 'other'], required=False, allow_blank=True)
    date_of_birth = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    photo = serializers.CharField(required=False, allow_blank=True)
    attendance_percentage = serializers.FloatField(default=0)
    internal_marks = serializers.FloatField(default=0)
    assignment_marks = serializers.FloatField(default=0)
    previous_result = serializers.FloatField(default=0)
    backlogs = serializers.IntegerField(default=0)
    fee_paid = serializers.BooleanField(default=False)
    fee_amount = serializers.FloatField(required=False)
    fee_due_date = serializers.CharField(required=False, allow_blank=True)

    def validate_department(self, value):
        return validate_department_name(value)

    def validate_mobile(self, value):
        digits = ''.join(ch for ch in (value or '') if ch.isdigit())
        if len(digits) < 10:
            raise serializers.ValidationError('Phone number must have at least 10 digits.')
        return value.strip()


class LoginSerializer(serializers.Serializer):
    username = serializers.EmailField(required=False)  # Accept username as alias for email
    email = serializers.EmailField(required=False)
    password = serializers.CharField()

    def validate(self, data):
        # Use username if email not provided (for form-data compatibility)
        if 'username' in data and not data.get('email'):
            data['email'] = data['username']
        if not data.get('email'):
            raise serializers.ValidationError("Email is required")
        return data


class ExamSubjectInputSerializer(serializers.Serializer):
    subject_code = serializers.CharField()
    subject_name = serializers.CharField()
    exam_date = serializers.CharField(required=False, allow_blank=True)
    exam_time = serializers.CharField(required=False, allow_blank=True)
    duration = serializers.CharField(required=False, allow_blank=True)
    invigilator_id = serializers.IntegerField(required=False, allow_null=True)


def _validate_subject_invigilators(data):
    if not data.get('requires_face_verification', True):
        return
    subjects = data.get('subjects') or []
    if not subjects:
        return
    missing = [s['subject_code'] for s in subjects if not s.get('invigilator_id')]
    if missing:
        raise serializers.ValidationError({
            'subjects': (
                'An invigilator must be assigned for each subject when face verification is required. '
                f'Missing for: {", ".join(missing)}'
            ),
        })


class SetupExamSerializer(serializers.Serializer):
    title = serializers.CharField(required=False, allow_blank=True)
    subject_code = serializers.CharField()
    subject_name = serializers.CharField()
    department = serializers.CharField()
    semester = serializers.IntegerField()
    exam_date = serializers.CharField()
    exam_time = serializers.CharField()
    duration = serializers.CharField(required=False)
    room = serializers.CharField()
    total_marks = serializers.IntegerField(default=100)
    requires_face_verification = serializers.BooleanField(default=True)
    invigilator_id = serializers.IntegerField(required=False, allow_null=True)
    subjects = ExamSubjectInputSerializer(many=True, required=False)

    def validate_department(self, value):
        return validate_department_name(value)

    def validate(self, data):
        subjects = data.get('subjects') or []
        if subjects:
            codes = [s['subject_code'] for s in subjects]
            if len(codes) != len(set(codes)):
                raise serializers.ValidationError({'subjects': 'Duplicate subject codes are not allowed.'})
            primary = subjects[0]
            data['subject_code'] = primary['subject_code']
            data['subject_name'] = primary['subject_name']
            if primary.get('exam_date'):
                data['exam_date'] = primary['exam_date']
            if primary.get('exam_time'):
                data['exam_time'] = primary['exam_time']
            if primary.get('duration'):
                data['duration'] = primary['duration']
        if not (data.get('title') or '').strip():
            data['title'] = data.get('subject_name') or ''
        if data.get('requires_face_verification'):
            _validate_subject_invigilators(data)
        return data


class SendNotificationSerializer(serializers.Serializer):
    title = serializers.CharField()
    message = serializers.CharField()
    audience = serializers.CharField()


class StudentCreateSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField()
    name = serializers.CharField()
    roll_no = serializers.CharField()
    mobile = serializers.CharField(min_length=10, max_length=20)
    gender = serializers.ChoiceField(choices=['male', 'female', 'other'], required=False, allow_blank=True)
    date_of_birth = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    department = serializers.CharField()
    semester = serializers.IntegerField()
    section = serializers.CharField(required=False)
    photo = serializers.URLField(required=False)
    fee_paid = serializers.BooleanField(default=False)
    fee_amount = serializers.FloatField(required=False)
    fee_due_date = serializers.CharField(required=False)

    def validate_department(self, value):
        return validate_department_name(value)

    def validate_mobile(self, value):
        digits = ''.join(ch for ch in (value or '') if ch.isdigit())
        if len(digits) < 10:
            raise serializers.ValidationError('Phone number must have at least 10 digits.')
        return value.strip()


class MarksUpdateSerializer(serializers.Serializer):
    student_id = serializers.IntegerField()
    subject_code = serializers.CharField(default='CS301')
    internal_marks = serializers.FloatField(min_value=0)
    assignment_marks = serializers.FloatField(min_value=0)

    def validate(self, data):
        from .models import Exam
        from .marks_constants import INTERNAL_MARKS_MAX, ASSIGNMENT_MARKS_MAX, INTERNAL_ASSIGNMENT_TOTAL
        internal = data['internal_marks']
        assignment = data['assignment_marks']
        total = internal + assignment
        if internal > INTERNAL_MARKS_MAX:
            raise serializers.ValidationError(
                f'Internal marks ({internal}) cannot exceed {INTERNAL_MARKS_MAX}.'
            )
        if assignment > ASSIGNMENT_MARKS_MAX:
            raise serializers.ValidationError(
                f'Assignment marks ({assignment}) cannot exceed {ASSIGNMENT_MARKS_MAX}.'
            )
        if total > INTERNAL_ASSIGNMENT_TOTAL:
            raise serializers.ValidationError(
                f'Total marks ({total}) cannot exceed {INTERNAL_ASSIGNMENT_TOTAL} '
                f'(internal {INTERNAL_MARKS_MAX} + assignment {ASSIGNMENT_MARKS_MAX}).'
            )
        return data


class StudentUpdateSerializer(serializers.Serializer):
    name = serializers.CharField(required=False)
    email = serializers.EmailField(required=False)
    password = serializers.CharField(required=False, min_length=6)
    roll_no = serializers.CharField(required=False)
    mobile = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    gender = serializers.ChoiceField(choices=['male', 'female', 'other'], required=False, allow_blank=True)
    date_of_birth = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    department = serializers.CharField(required=False)
    semester = serializers.IntegerField(required=False)
    section = serializers.CharField(required=False)
    photo = serializers.URLField(required=False, allow_blank=True, allow_null=True)
    fee_paid = serializers.BooleanField(required=False)
    fee_amount = serializers.FloatField(required=False)
    fee_due_date = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    def validate_department(self, value):
        if not value:
            return value
        return validate_department_name(value)


class ExamCreateSerializer(serializers.Serializer):
    title = serializers.CharField(required=False, allow_blank=True)
    subject_code = serializers.CharField()
    subject_name = serializers.CharField()
    department = serializers.CharField()
    semester = serializers.IntegerField()
    exam_date = serializers.CharField()
    exam_time = serializers.CharField()
    duration = serializers.CharField(required=False)
    room = serializers.CharField()
    total_marks = serializers.IntegerField(default=100)
    fee_amount = serializers.FloatField(required=False, min_value=0)
    requires_face_verification = serializers.BooleanField(default=True)
    invigilator_id = serializers.IntegerField(required=False, allow_null=True)
    subjects = ExamSubjectInputSerializer(many=True, required=False)

    def validate_department(self, value):
        return validate_department_name(value)

    def validate(self, data):
        subjects = data.get('subjects') or []
        if subjects:
            codes = [s['subject_code'] for s in subjects]
            if len(codes) != len(set(codes)):
                raise serializers.ValidationError({'subjects': 'Duplicate subject codes are not allowed.'})
            primary = subjects[0]
            data['subject_code'] = primary['subject_code']
            data['subject_name'] = primary['subject_name']
        if not (data.get('title') or '').strip():
            data['title'] = data.get('subject_name') or ''
        if data.get('requires_face_verification'):
            _validate_subject_invigilators(data)
        return data


class ExamUpdateSerializer(serializers.Serializer):
    title = serializers.CharField(required=False, allow_blank=True)
    subject_code = serializers.CharField(required=False)
    subject_name = serializers.CharField(required=False)
    department = serializers.CharField(required=False)
    semester = serializers.IntegerField(required=False)
    exam_date = serializers.CharField(required=False)
    exam_time = serializers.CharField(required=False)
    duration = serializers.CharField(required=False)
    room = serializers.CharField(required=False)
    total_marks = serializers.IntegerField(required=False)
    fee_amount = serializers.FloatField(required=False, min_value=0)
    requires_face_verification = serializers.BooleanField(required=False)
    invigilator_id = serializers.IntegerField(required=False, allow_null=True)
    subjects = ExamSubjectInputSerializer(many=True, required=False)

    def validate_department(self, value):
        if not value:
            return value
        return validate_department_name(value)

    def validate(self, data):
        subjects = data.get('subjects') or []
        if subjects:
            codes = [s['subject_code'] for s in subjects]
            if len(codes) != len(set(codes)):
                raise serializers.ValidationError({'subjects': 'Duplicate subject codes are not allowed.'})
        return data


class TeacherUpdateSerializer(serializers.Serializer):
    name = serializers.CharField(required=False)
    email = serializers.EmailField(required=False)
    emp_id = serializers.CharField(required=False)
    department = serializers.CharField(required=False)
    assigned_subjects = serializers.CharField(required=False)
    password = serializers.CharField(required=False, min_length=6)

    def validate_department(self, value):
        if not value:
            return value
        return validate_department_name(value)


class HodUpdateSerializer(serializers.Serializer):
    name = serializers.CharField(required=False)
    email = serializers.EmailField(required=False)
    emp_id = serializers.CharField(required=False)
    department = serializers.CharField(required=False)
    password = serializers.CharField(required=False, min_length=6)

    def validate_department(self, value):
        if not value:
            return value
        return validate_department_name(value)


class HodTeacherSubjectsSerializer(serializers.Serializer):
    assigned_subjects = serializers.CharField(allow_blank=True)


class HodStudentAcademicUpdateSerializer(serializers.Serializer):
    attendance_percentage = serializers.FloatField(required=False, min_value=0, max_value=100)
    internal_marks = serializers.FloatField(required=False, min_value=0)
    assignment_marks = serializers.FloatField(required=False, min_value=0)
    previous_result = serializers.FloatField(required=False, min_value=0)
    backlogs = serializers.IntegerField(required=False, min_value=0)


class NotificationCreateSerializer(serializers.Serializer):
    title = serializers.CharField()
    message = serializers.CharField()
    audience = serializers.CharField()


class FaceVerifyRequestSerializer(serializers.Serializer):
    image_base64 = serializers.CharField()
    exam_id = serializers.IntegerField(required=False, allow_null=True)
    exam_subject_id = serializers.IntegerField(required=False, allow_null=True)


class FaceVerifyResponseSerializer(serializers.Serializer):
    verified = serializers.BooleanField()
    confidence = serializers.FloatField()
    message = serializers.CharField()
    student_name = serializers.CharField(allow_null=True)


class ChatbotRequestSerializer(serializers.Serializer):
    user_query = serializers.CharField()


class ChatbotResponseSerializer(serializers.Serializer):
    response = serializers.CharField()


class TeacherProfileUpdateSerializer(serializers.Serializer):
    name = serializers.CharField(required=False)
    current_password = serializers.CharField(required=False)
    new_password = serializers.CharField(required=False, min_length=6)

    def validate(self, data):
        new_pw = data.get('new_password')
        if new_pw and not data.get('current_password'):
            raise serializers.ValidationError({'current_password': 'Current password is required to set a new password.'})
        return data


class HodProfileUpdateSerializer(serializers.Serializer):
    name = serializers.CharField(required=False)
    current_password = serializers.CharField(required=False)
    new_password = serializers.CharField(required=False, min_length=6)

    def validate(self, data):
        new_pw = data.get('new_password')
        if new_pw and not data.get('current_password'):
            raise serializers.ValidationError({'current_password': 'Current password is required to set a new password.'})
        return data


class AdminProfileUpdateSerializer(serializers.Serializer):
    name = serializers.CharField(required=False)
    current_password = serializers.CharField(required=False)
    new_password = serializers.CharField(required=False, min_length=6)

    def validate(self, data):
        new_pw = data.get('new_password')
        if new_pw and not data.get('current_password'):
            raise serializers.ValidationError({'current_password': 'Current password is required to set a new password.'})
        return data


class HallTicketSubjectUpdateSerializer(serializers.Serializer):
    subject_code = serializers.CharField()
    seat_number = serializers.CharField(required=False, allow_blank=True)
    room = serializers.CharField(required=False, allow_blank=True)


class HallTicketUpdateSerializer(serializers.Serializer):
    seat_number = serializers.CharField(required=False)
    room = serializers.CharField(required=False)
    subjects = HallTicketSubjectUpdateSerializer(many=True, required=False)
    auto_resolve_seats = serializers.BooleanField(default=False, required=False)


class SeatingRoomSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    room_code = serializers.CharField()
    room_name = serializers.CharField()
    building = serializers.CharField(allow_null=True, required=False)
    floor = serializers.IntegerField()
    capacity = serializers.IntegerField()
    rows = serializers.IntegerField()
    columns = serializers.IntegerField()
    has_projector = serializers.BooleanField()
    has_ac = serializers.BooleanField()
    is_active = serializers.BooleanField()


class SeatingRoomCreateSerializer(serializers.Serializer):
    room_code = serializers.CharField(max_length=50)
    room_name = serializers.CharField(max_length=255)
    building = serializers.CharField(required=False, allow_blank=True)
    floor = serializers.IntegerField(default=1)
    capacity = serializers.IntegerField(default=60)
    rows = serializers.IntegerField(default=10)
    columns = serializers.IntegerField(default=6)
    has_projector = serializers.BooleanField(default=False)
    has_ac = serializers.BooleanField(default=False)


class SeatingRoomUpdateSerializer(serializers.Serializer):
    room_name = serializers.CharField(required=False)
    building = serializers.CharField(required=False, allow_blank=True)
    floor = serializers.IntegerField(required=False)
    capacity = serializers.IntegerField(required=False)
    rows = serializers.IntegerField(required=False)
    columns = serializers.IntegerField(required=False)
    has_projector = serializers.BooleanField(required=False)
    has_ac = serializers.BooleanField(required=False)
    is_active = serializers.BooleanField(required=False)


class SeatingArrangementSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    exam_id = serializers.IntegerField(source='exam.id')
    exam_name = serializers.CharField(source='exam.subject_name')
    room_id = serializers.IntegerField(source='room.id')
    room_code = serializers.CharField(source='room.room_code')
    room_name = serializers.CharField(source='room.room_name')
    student_id = serializers.IntegerField(source='student.id')
    student_name = serializers.CharField(source='student.user.name')
    roll_no = serializers.CharField(source='student.roll_no')
    seat_row = serializers.IntegerField()
    seat_column = serializers.IntegerField()
    seat_number = serializers.CharField()
    arrangement_type = serializers.CharField()
    is_confirmed = serializers.BooleanField()


class AutoSeatingSerializer(serializers.Serializer):
    exam_id = serializers.IntegerField()
    room_ids = serializers.ListField(child=serializers.IntegerField(), min_length=1)
    arrangement_strategy = serializers.ChoiceField(
        choices=['even_odd', 'ai', 'sequential', 'department', 'alphabetical', 'random'],
        default='even_odd'
    )
    leave_empty_seats = serializers.BooleanField(default=False)
    seats_between_students = serializers.IntegerField(default=0, min_value=0)


class ManualSeatingItemSerializer(serializers.Serializer):
    student_id = serializers.IntegerField()
    room_id = serializers.IntegerField()
    seat_row = serializers.IntegerField()
    seat_column = serializers.IntegerField()
    seat_number = serializers.CharField()


class ManualSeatingSerializer(serializers.Serializer):
    exam_id = serializers.IntegerField()
    arrangements = ManualSeatingItemSerializer(many=True)


class SeatingArrangementUpdateSerializer(serializers.Serializer):
    room_id = serializers.IntegerField(required=False)
    seat_row = serializers.IntegerField(required=False)
    seat_column = serializers.IntegerField(required=False)
    seat_number = serializers.CharField(required=False)
    is_confirmed = serializers.BooleanField(required=False)


class PayFeeSerializer(serializers.Serializer):
    method = serializers.ChoiceField(choices=['online', 'bank_transfer', 'college'])
    reference = serializers.CharField(required=False, allow_blank=True, max_length=255)
    fee_type = serializers.ChoiceField(choices=['college', 'exam', 'backlog'], default='exam')
    exam_id = serializers.IntegerField(required=False, allow_null=True)
    backlog_id = serializers.IntegerField(required=False, allow_null=True)


class FeePaymentReviewSerializer(serializers.Serializer):
    admin_note = serializers.CharField(required=False, allow_blank=True, max_length=255)


class SystemSettingsUpdateSerializer(serializers.Serializer):
    university_name = serializers.CharField(max_length=255, required=False)
    academic_year = serializers.CharField(max_length=20, required=False)
    current_semester = serializers.IntegerField(min_value=1, max_value=8, required=False)
    contact_email = serializers.EmailField(required=False)
    college_logo_url = serializers.URLField(required=False, allow_blank=True)
    default_exam_fee = serializers.FloatField(min_value=0, required=False)
    default_college_fee = serializers.FloatField(min_value=0, required=False)
    default_backlog_fee = serializers.FloatField(min_value=0, required=False)
    attendance_threshold = serializers.IntegerField(min_value=0, max_value=100, required=False)
    internal_marks_threshold = serializers.IntegerField(min_value=0, max_value=100, required=False)
    min_sgpa = serializers.FloatField(min_value=0, max_value=10, required=False)
    ml_model = serializers.ChoiceField(choices=['rf', 'dt'], required=False)
    apply_fee_to_unpaid = serializers.BooleanField(required=False, default=False)


class ClassTimetableSerializer(serializers.Serializer):
    subject_code = serializers.CharField(max_length=50)
    subject_name = serializers.CharField(max_length=255, required=False, allow_blank=True, default='')
    day_of_week = serializers.IntegerField(min_value=0, max_value=5)
    start_time = serializers.CharField(max_length=20)
    end_time = serializers.CharField(max_length=20)
    room = serializers.CharField(max_length=100, required=False, allow_blank=True, default='')
    semester = serializers.IntegerField(min_value=1, max_value=8, required=False, default=1)
    section = serializers.CharField(max_length=10, required=False, allow_blank=True, default='A')
    department = serializers.CharField(max_length=100, required=False, allow_blank=True, default='')
    teacher_id = serializers.IntegerField(required=False)

    def validate(self, data):
        start = (data.get('start_time') or '').strip()
        end = (data.get('end_time') or '').strip()
        if start and end and start >= end:
            raise serializers.ValidationError({'end_time': 'End time must be after start time.'})
        data['subject_code'] = data['subject_code'].strip().upper()
        data['start_time'] = start
        data['end_time'] = end
        return data


class HodClassTimetableSerializer(ClassTimetableSerializer):
    teacher_id = serializers.IntegerField(required=True)
