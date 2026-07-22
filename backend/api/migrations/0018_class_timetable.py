from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0017_student_gender_dob_settings_fee_logo'),
    ]

    operations = [
        migrations.CreateModel(
            name='ClassTimetable',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('subject_code', models.CharField(db_index=True, max_length=50)),
                ('subject_name', models.CharField(blank=True, default='', max_length=255)),
                ('day_of_week', models.PositiveSmallIntegerField(choices=[(0, 'Monday'), (1, 'Tuesday'), (2, 'Wednesday'), (3, 'Thursday'), (4, 'Friday'), (5, 'Saturday')])),
                ('start_time', models.CharField(max_length=20)),
                ('end_time', models.CharField(max_length=20)),
                ('room', models.CharField(blank=True, default='', max_length=100)),
                ('semester', models.PositiveSmallIntegerField(default=1)),
                ('section', models.CharField(blank=True, default='A', max_length=10)),
                ('department', models.CharField(blank=True, default='', max_length=100)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('teacher', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='class_slots', to='api.teacher')),
            ],
            options={
                'db_table': 'class_timetable',
                'ordering': ['day_of_week', 'start_time', 'id'],
                'indexes': [
                    models.Index(fields=['teacher'], name='class_timet_teacher_idx'),
                    models.Index(fields=['day_of_week'], name='class_timet_day_of__idx'),
                    models.Index(fields=['subject_code'], name='class_timet_subject_idx'),
                ],
            },
        ),
    ]
