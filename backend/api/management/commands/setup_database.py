"""
Create the MySQL database (if needed), run migrations, seed departments,
and optional demo login accounts for a fresh device.
"""
import os

import pymysql
from django.conf import settings
from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.db import connection

from api.auth_utils import get_password_hash
from api.department_service import ensure_default_departments, normalize_legacy_department_data
from api.settings_service import ensure_default_settings
from api.models import RoleEnum, Student, Teacher, HOD, User


DEMO_ACCOUNTS = (
    {
        'role': RoleEnum.ADMIN,
        'email': 'admin@examshield.ai',
        'password': 'admin123',
        'name': 'Dr. Arjun Mehta',
    },
    {
        'role': RoleEnum.HOD,
        'email': 'hod@examshield.ai',
        'password': 'hod123',
        'name': 'Dr. Kavita Sharma',
        'emp_id': 'HOD001',
        'department': 'COMPUTER SCIENCE',
    },
    {
        'role': RoleEnum.TEACHER,
        'email': 'teacher@examshield.ai',
        'password': 'teacher123',
        'name': 'Prof. Sneha Rao',
        'emp_id': 'TCH001',
        'department': 'COMPUTER SCIENCE',
        'assigned_subjects': 'CS301,CS302',
    },
    {
        'role': RoleEnum.STUDENT,
        'email': 'student@examshield.ai',
        'password': 'student123',
        'name': 'Rahul Verma',
        'roll_no': 'CS2021001',
        'department': 'COMPUTER SCIENCE',
        'semester': 5,
        'section': 'A',
    },
)


def ensure_mysql_database():
    db = settings.DATABASES['default']
    if db['ENGINE'] != 'django.db.backends.mysql':
        return False, 'Using SQLite — database file is created automatically on migrate.'

    conn = pymysql.connect(
        host=db['HOST'],
        user=db['USER'],
        password=db['PASSWORD'],
        port=int(db['PORT']),
        charset='utf8mb4',
    )
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                f"CREATE DATABASE IF NOT EXISTS `{db['NAME']}` "
                "CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
            )
        conn.commit()
    finally:
        conn.close()
    return True, f"MySQL database `{db['NAME']}` is ready."


def seed_demo_accounts():
    created = []
    for item in DEMO_ACCOUNTS:
        if User.objects.filter(email=item['email'], is_deleted=False).exists():
            continue

        user = User.objects.create(
            username=None,
            email=item['email'],
            hashed_password=get_password_hash(item['password']),
            name=item['name'],
            role=item['role'],
            avatar=f"https://api.dicebear.com/7.x/avataaars/svg?seed={item['email']}",
        )

        if item['role'] == RoleEnum.HOD:
            HOD.objects.create(
                user=user,
                emp_id=item['emp_id'],
                department=item['department'],
                photo=user.avatar,
            )
        elif item['role'] == RoleEnum.TEACHER:
            Teacher.objects.create(
                user=user,
                emp_id=item['emp_id'],
                department=item['department'],
                assigned_subjects=item['assigned_subjects'],
                photo=user.avatar,
            )
        elif item['role'] == RoleEnum.STUDENT:
            Student.objects.create(
                user=user,
                roll_no=item['roll_no'],
                department=item['department'],
                semester=item['semester'],
                section=item['section'],
                photo=user.avatar,
                attendance_percentage=85.0,
                internal_marks=32.0,
                assignment_marks=8.0,
                previous_result=7.5,
                fee_paid=True,
                fee_amount=45000.0,
            )
        created.append(item['email'])
    return created


class Command(BaseCommand):
    help = 'Create database, all tables (migrate), departments, and demo logins for a new device.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--skip-demo',
            action='store_true',
            help='Only create database + tables; do not add demo admin/teacher/student.',
        )

    def handle(self, *args, **options):
        self.stdout.write(self.style.MIGRATE_HEADING('ExamShield — database setup'))

        if not os.path.exists(settings.BASE_DIR / '.env'):
            self.stdout.write(self.style.WARNING(
                'No backend/.env file found. Copy backend/.env.example to backend/.env and set DB_PASSWORD first.'
            ))

        ok, message = ensure_mysql_database()
        self.stdout.write(message)

        self.stdout.write('Running migrations (creates all tables)...')
        call_command('migrate', '--noinput', verbosity=1)

        ensure_default_departments()
        normalized = normalize_legacy_department_data()
        self.stdout.write(self.style.SUCCESS(
            'Departments seeded (MCA, MBA, CIVIL, ELECTRONICS, COMPUTER SCIENCE).'
            + (f' Normalized {normalized} old record(s).' if normalized else '')
        ))

        ensure_default_settings()
        self.stdout.write(self.style.SUCCESS('System settings initialized.'))

        tables = sorted(connection.introspection.table_names())
        self.stdout.write(f'Tables in database: {len(tables)}')

        if not options['skip_demo']:
            created = seed_demo_accounts()
            if created:
                self.stdout.write(self.style.SUCCESS('Demo accounts created:'))
                for email in created:
                    self.stdout.write(f'  • {email}')
            else:
                self.stdout.write('Demo accounts already exist — skipped.')

        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS('Setup complete. You can run start.bat or: python manage.py runserver'))
        self.stdout.write('  admin@examshield.ai / admin123')
        self.stdout.write('  hod@examshield.ai / hod123')
        self.stdout.write('  teacher@examshield.ai / teacher123')
        self.stdout.write('  student@examshield.ai / student123')
