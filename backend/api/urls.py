from django.urls import path
from . import views_auth, views_admin, views_teacher, views_student, views_public

urlpatterns = [
    # Auth endpoints
    path('auth/login', views_auth.login, name='login'),
    path('auth/bootstrap-admin', views_auth.bootstrap_admin, name='bootstrap_admin'),
    path('auth/setup-teacher', views_auth.setup_teacher, name='setup_teacher'),
    path('auth/setup-student', views_auth.setup_student, name='setup_student'),
    path('auth/setup-exam', views_auth.setup_exam, name='setup_exam'),
    path('auth/send-notification', views_auth.send_notification, name='send_notification'),
    
    # Admin endpoints
    path('admin/dashboard', views_admin.dashboard, name='admin_dashboard'),
    path('admin/students', views_admin.list_students, name='admin_list_students'),
    path('admin/students/<int:sid>', views_admin.get_student, name='admin_get_student'),
    path('admin/students/create', views_admin.create_student, name='admin_create_student'),
    path('admin/students/<int:sid>/update', views_admin.update_student, name='admin_update_student'),
    path('admin/students/<int:sid>/delete', views_admin.delete_student, name='admin_delete_student'),
    path('admin/teachers', views_admin.list_teachers, name='admin_list_teachers'),
    path('admin/exams', views_admin.list_exams, name='admin_list_exams'),
    path('admin/exams/create', views_admin.create_exam, name='admin_create_exam'),
    path('admin/eligibility/verify-all', views_admin.verify_all, name='admin_verify_all'),
    path('admin/halltickets/generate-all', views_admin.generate_halltickets, name='admin_generate_halltickets'),
    path('admin/halltickets', views_admin.list_halltickets, name='admin_list_halltickets'),
    path('admin/backlogs', views_admin.backlogs, name='admin_backlogs'),
    path('admin/fees', views_admin.fees, name='admin_fees'),
    path('admin/fees/<int:sid>/mark-paid', views_admin.mark_fee_paid, name='admin_mark_fee_paid'),
    path('admin/notifications/create', views_admin.send_notification, name='admin_send_notification'),
    path('admin/notifications', views_admin.list_notifications, name='admin_list_notifications'),
    path('admin/analytics', views_admin.analytics, name='admin_analytics'),
    path('admin/reports/export', views_admin.export_report, name='admin_export_report'),
    
    # Teacher endpoints
    path('teacher/dashboard', views_teacher.dashboard, name='teacher_dashboard'),
    path('teacher/attendance', views_teacher.get_roll, name='teacher_get_roll'),
    path('teacher/attendance/mark', views_teacher.mark_attendance, name='teacher_mark_attendance'),
    path('teacher/marks', views_teacher.get_marks, name='teacher_get_marks'),
    path('teacher/marks/update', views_teacher.update_marks, name='teacher_update_marks'),
    path('teacher/students', views_teacher.monitor_students, name='teacher_monitor_students'),
    path('teacher/face-verify', views_teacher.face_verify, name='teacher_face_verify'),
    
    # Student endpoints
    path('student/dashboard', views_student.dashboard, name='student_dashboard'),
    path('student/profile', views_student.profile, name='student_profile'),
    path('student/profile/update', views_student.update_profile, name='student_update_profile'),
    path('student/eligibility', views_student.eligibility, name='student_eligibility'),
    path('student/hallticket', views_student.get_hallticket, name='student_hallticket'),
    path('student/hallticket/download', views_student.download_hallticket, name='student_download_hallticket'),
    path('student/exams', views_student.exams, name='student_exams'),
    path('student/face-verify', views_student.face_verify, name='student_face_verify'),
    path('student/notifications', views_student.notifications, name='student_notifications'),
    path('student/chatbot', views_student.chatbot, name='student_chatbot'),
    
    # Public endpoints
    path('public/verify-hallticket/<str:ht_no>', views_public.verify_hallticket, name='public_verify_hallticket'),
    path('public/meta', views_public.meta, name='public_meta'),
]
