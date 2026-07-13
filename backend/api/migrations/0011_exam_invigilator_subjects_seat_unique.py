from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0010_systemsettings'),
    ]

    operations = [
        migrations.AddField(
            model_name='exam',
            name='requires_face_verification',
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name='exam',
            name='invigilator',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='invigilated_exams',
                to='api.teacher',
            ),
        ),
        migrations.CreateModel(
            name='ExamSubject',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('subject_code', models.CharField(max_length=50)),
                ('subject_name', models.CharField(max_length=255)),
                ('exam_date', models.CharField(blank=True, default='', max_length=50)),
                ('exam_time', models.CharField(blank=True, default='', max_length=50)),
                ('duration', models.CharField(blank=True, default='', max_length=50)),
                ('sort_order', models.PositiveSmallIntegerField(default=0)),
                ('exam', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='subjects', to='api.exam')),
            ],
            options={
                'db_table': 'exam_subjects',
                'ordering': ['sort_order', 'id'],
                'unique_together': {('exam', 'subject_code')},
            },
        ),
        migrations.AddIndex(
            model_name='examsubject',
            index=models.Index(fields=['exam'], name='idx_exam_subject_exam'),
        ),
        migrations.AddIndex(
            model_name='examsubject',
            index=models.Index(fields=['subject_code'], name='idx_exam_subject_code'),
        ),
        migrations.AlterUniqueTogether(
            name='seatingarrangement',
            unique_together={('exam', 'student'), ('exam', 'room', 'seat_row', 'seat_column')},
        ),
    ]
