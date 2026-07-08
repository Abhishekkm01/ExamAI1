from rest_framework import serializers
from .department_service import is_valid_department, get_department_names, canonical_department


def validate_department_name(value):
    canonical = canonical_department(value)
    if not canonical:
        allowed = ', '.join(get_department_names())
        raise serializers.ValidationError(f'Invalid department. Choose from: {allowed}')
    return canonical
from .models import User, Student, Teacher, Exam, Attendance, InternalMark, HallTicket, Notification, ChatbotLog, EligibilityPrediction


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
                  'previous_result', 'backlogs', 'fee_paid', 'fee_amount', 'fee_due_date',
                  'is_eligible', 'eligibility_percentage', 'ai_risk_score', 'created_at', 'updated_at', 'is_deleted']


class TeacherSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    
    class Meta:
        model = Teacher
        fields = ['id', 'user', 'emp_id', 'department', 'photo', 'assigned_subjects', 
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


class RegisterStudentSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(min_length=6)
    name = serializers.CharField()
    roll_no = serializers.CharField()
    department = serializers.CharField()
    semester = serializers.IntegerField(min_value=1, max_value=8)
    section = serializers.CharField(required=False, allow_blank=True, default="A")
    mobile = serializers.CharField(required=False, allow_blank=True)

    def validate_department(self, value):
        return validate_department_name(value)


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
    mobile = serializers.CharField(required=False, allow_blank=True)
    photo = serializers.CharField(required=False, allow_blank=True)
    attendance_percentage = serializers.FloatField(default=0)
    internal_marks = serializers.FloatField(default=0)
    assignment_marks = serializers.FloatField(default=0)
    previous_result = serializers.FloatField(default=0)
    backlogs = serializers.IntegerField(default=0)
    fee_paid = serializers.BooleanField(default=False)
    fee_amount = serializers.FloatField(default=45000)
    fee_due_date = serializers.CharField(required=False, allow_blank=True)

    def validate_department(self, value):
        return validate_department_name(value)


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


class SetupExamSerializer(serializers.Serializer):
    subject_code = serializers.CharField()
    subject_name = serializers.CharField()
    department = serializers.CharField()
    semester = serializers.IntegerField()
    exam_date = serializers.CharField()
    exam_time = serializers.CharField()
    duration = serializers.CharField(required=False)
    room = serializers.CharField()
    total_marks = serializers.IntegerField(default=100)

    def validate_department(self, value):
        return validate_department_name(value)


class SendNotificationSerializer(serializers.Serializer):
    title = serializers.CharField()
    message = serializers.CharField()
    audience = serializers.CharField()


class StudentCreateSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField()
    name = serializers.CharField()
    roll_no = serializers.CharField()
    mobile = serializers.CharField(required=False)
    department = serializers.CharField()
    semester = serializers.IntegerField()
    section = serializers.CharField(required=False)
    photo = serializers.URLField(required=False)
    attendance_percentage = serializers.FloatField(default=0)
    internal_marks = serializers.FloatField(default=0)
    assignment_marks = serializers.FloatField(default=0)
    previous_result = serializers.FloatField(default=0)
    backlogs = serializers.IntegerField(default=0)
    fee_paid = serializers.BooleanField(default=False)
    fee_amount = serializers.FloatField(default=45000)
    fee_due_date = serializers.CharField(required=False)

    def validate_department(self, value):
        return validate_department_name(value)


class MarksUpdateSerializer(serializers.Serializer):
    student_id = serializers.IntegerField()
    subject_code = serializers.CharField(default='CS301')
    internal_marks = serializers.FloatField(min_value=0, max_value=40)
    assignment_marks = serializers.FloatField(min_value=0, max_value=10)


class StudentUpdateSerializer(serializers.Serializer):
    name = serializers.CharField(required=False)
    email = serializers.EmailField(required=False)
    roll_no = serializers.CharField(required=False)
    mobile = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    department = serializers.CharField(required=False)
    semester = serializers.IntegerField(required=False)
    section = serializers.CharField(required=False)
    photo = serializers.URLField(required=False, allow_blank=True, allow_null=True)
    attendance_percentage = serializers.FloatField(required=False)
    internal_marks = serializers.FloatField(required=False)
    assignment_marks = serializers.FloatField(required=False)
    previous_result = serializers.FloatField(required=False)
    backlogs = serializers.IntegerField(required=False)
    fee_paid = serializers.BooleanField(required=False)
    fee_amount = serializers.FloatField(required=False)
    fee_due_date = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    password = serializers.CharField(required=False, min_length=6)

    def validate_department(self, value):
        if not value:
            return value
        return validate_department_name(value)


class ExamCreateSerializer(serializers.Serializer):
    subject_code = serializers.CharField()
    subject_name = serializers.CharField()
    department = serializers.CharField()
    semester = serializers.IntegerField()
    exam_date = serializers.CharField()
    exam_time = serializers.CharField()
    duration = serializers.CharField(required=False)
    room = serializers.CharField()
    total_marks = serializers.IntegerField(default=100)

    def validate_department(self, value):
        return validate_department_name(value)


class ExamUpdateSerializer(serializers.Serializer):
    subject_code = serializers.CharField(required=False)
    subject_name = serializers.CharField(required=False)
    department = serializers.CharField(required=False)
    semester = serializers.IntegerField(required=False)
    exam_date = serializers.CharField(required=False)
    exam_time = serializers.CharField(required=False)
    duration = serializers.CharField(required=False)
    room = serializers.CharField(required=False)
    total_marks = serializers.IntegerField(required=False)

    def validate_department(self, value):
        if not value:
            return value
        return validate_department_name(value)


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


class NotificationCreateSerializer(serializers.Serializer):
    title = serializers.CharField()
    message = serializers.CharField()
    audience = serializers.CharField()


class FaceVerifyRequestSerializer(serializers.Serializer):
    image_base64 = serializers.CharField()


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


class AdminProfileUpdateSerializer(serializers.Serializer):
    name = serializers.CharField(required=False)
    current_password = serializers.CharField(required=False)
    new_password = serializers.CharField(required=False, min_length=6)

    def validate(self, data):
        new_pw = data.get('new_password')
        if new_pw and not data.get('current_password'):
            raise serializers.ValidationError({'current_password': 'Current password is required to set a new password.'})
        return data


class HallTicketUpdateSerializer(serializers.Serializer):
    seat_number = serializers.CharField(required=False)
    room = serializers.CharField(required=False)


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
        choices=['sequential', 'department', 'alphabetical', 'random'],
        default='sequential'
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


class FeePaymentReviewSerializer(serializers.Serializer):
    admin_note = serializers.CharField(required=False, allow_blank=True, max_length=255)


class SystemSettingsUpdateSerializer(serializers.Serializer):
    university_name = serializers.CharField(max_length=255, required=False)
    academic_year = serializers.CharField(max_length=20, required=False)
    current_semester = serializers.IntegerField(min_value=1, max_value=8, required=False)
    contact_email = serializers.EmailField(required=False)
    attendance_threshold = serializers.IntegerField(min_value=0, max_value=100, required=False)
    internal_marks_threshold = serializers.IntegerField(min_value=0, max_value=100, required=False)
    min_sgpa = serializers.FloatField(min_value=0, max_value=10, required=False)
    ml_model = serializers.ChoiceField(choices=['rf', 'dt'], required=False)
