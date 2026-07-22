from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0020_per_exam_fees'),
    ]

    operations = [
        migrations.CreateModel(
            name='StudentBacklog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('subject_code', models.CharField(db_index=True, max_length=50)),
                ('subject_name', models.CharField(max_length=255)),
                ('from_semester', models.IntegerField(default=1)),
                ('exam_date', models.CharField(blank=True, default='', max_length=50)),
                ('exam_time', models.CharField(blank=True, default='', max_length=50)),
                ('duration', models.CharField(blank=True, default='3 hours', max_length=50)),
                ('is_cleared', models.BooleanField(db_index=True, default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('student', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='backlog_subjects',
                    to='api.student',
                )),
            ],
            options={
                'db_table': 'student_backlogs',
                'unique_together': {('student', 'subject_code')},
            },
        ),
        migrations.AddIndex(
            model_name='studentbacklog',
            index=models.Index(fields=['student'], name='student_bac_student_idx'),
        ),
        migrations.AddIndex(
            model_name='studentbacklog',
            index=models.Index(fields=['subject_code'], name='student_bac_subject_idx'),
        ),
        migrations.AddIndex(
            model_name='studentbacklog',
            index=models.Index(fields=['is_cleared'], name='student_bac_is_clea_idx'),
        ),
    ]
