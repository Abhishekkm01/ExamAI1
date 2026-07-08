from django.core.management.base import BaseCommand
from django.db import connection, transaction

from api.models import User, Student, Teacher, Exam


UNUSED_TABLES = (
    'authtoken_token',
)


class Command(BaseCommand):
    help = 'Remove unused DB tables and permanently delete soft-deleted records.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be removed without making changes.',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        if dry_run:
            self.stdout.write(self.style.WARNING('Dry run — no changes will be saved.'))

        removed_teachers = Teacher.objects.filter(is_deleted=True).count()
        removed_students = Student.objects.filter(is_deleted=True).count()
        removed_exams = Exam.objects.filter(is_deleted=True).count()
        removed_users = User.objects.filter(is_deleted=True).count()

        existing = set(connection.introspection.table_names())
        drop_tables = [t for t in UNUSED_TABLES if t in existing]

        self.stdout.write(f'Soft-deleted teachers to remove: {removed_teachers}')
        self.stdout.write(f'Soft-deleted students to remove: {removed_students}')
        self.stdout.write(f'Soft-deleted exams to remove: {removed_exams}')
        self.stdout.write(f'Soft-deleted users to remove: {removed_users}')
        self.stdout.write(f'Unused tables to drop: {", ".join(drop_tables) or "none"}')

        if dry_run:
            return

        with transaction.atomic():
            for teacher in Teacher.objects.filter(is_deleted=True).select_related('user'):
                user_id = teacher.user_id
                teacher.delete()
                User.objects.filter(id=user_id).delete()

            for student in Student.objects.filter(is_deleted=True).select_related('user'):
                user_id = student.user_id
                student.delete()
                User.objects.filter(id=user_id).delete()

            Exam.objects.filter(is_deleted=True).delete()
            User.objects.filter(is_deleted=True).delete()

        with connection.cursor() as cursor:
            for table in drop_tables:
                cursor.execute(f'DROP TABLE IF EXISTS `{table}`')
                self.stdout.write(self.style.SUCCESS(f'Dropped table: {table}'))

            for table in ('django_session', 'django_admin_log'):
                if table in existing:
                    cursor.execute(f'DELETE FROM `{table}`')
                    self.stdout.write(self.style.SUCCESS(f'Cleared rows from: {table}'))

        self.stdout.write(self.style.SUCCESS('Database cleanup complete.'))
