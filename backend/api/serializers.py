from rest_framework import serializers
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
    assigned_subjects = serializers.CharField(required=False)


class SetupStudentSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(required=False)
    name = serializers.CharField()
    roll_no = serializers.CharField()
    department = serializers.CharField()
    semester = serializers.IntegerField()
    section = serializers.CharField(required=False)
    mobile = serializers.CharField(required=False)
    attendance_percentage = serializers.FloatField(default=0)
    internal_marks = serializers.FloatField(default=0)
    assignment_marks = serializers.FloatField(default=0)
    previous_result = serializers.FloatField(default=0)
    backlogs = serializers.IntegerField(default=0)


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
    photo = serializers.URLField(required=False, allow_blank=True)
    attendance_percentage = serializers.FloatField(default=0)
    internal_marks = serializers.FloatField(default=0)
    assignment_marks = serializers.FloatField(default=0)
    previous_result = serializers.FloatField(default=0)
    backlogs = serializers.IntegerField(default=0)
    fee_paid = serializers.BooleanField(default=False)
    fee_amount = serializers.FloatField(default=45000)
    fee_due_date = serializers.CharField(required=False)


class StudentUpdateSerializer(serializers.Serializer):
    mobile = serializers.CharField(required=False)
    section = serializers.CharField(required=False)
    attendance_percentage = serializers.FloatField(required=False)
    internal_marks = serializers.FloatField(required=False)
    assignment_marks = serializers.FloatField(required=False)
    previous_result = serializers.FloatField(required=False)
    backlogs = serializers.IntegerField(required=False)
    fee_paid = serializers.BooleanField(required=False)
    fee_amount = serializers.FloatField(required=False)
    fee_due_date = serializers.CharField(required=False)


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
