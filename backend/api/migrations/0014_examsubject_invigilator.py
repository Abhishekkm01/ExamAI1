from django.db import migrations, models
import django.db.models.deletion


def backfill_subject_invigilators(apps, schema_editor):
    Exam = apps.get_model('api', 'Exam')
    ExamSubject = apps.get_model('api', 'ExamSubject')

    for exam in Exam.objects.filter(invigilator_id__isnull=False).iterator():
        subjects = list(
            ExamSubject.objects.filter(exam=exam).order_by('sort_order', 'id')
        )
        if subjects:
            primary = subjects[0]
            if not primary.invigilator_id:
                primary.invigilator_id = exam.invigilator_id
                primary.save(update_fields=['invigilator_id'])
        else:
            ExamSubject.objects.create(
                exam=exam,
                subject_code=exam.subject_code,
                subject_name=exam.subject_name,
                exam_date=exam.exam_date,
                exam_time=exam.exam_time,
                duration=exam.duration,
                sort_order=0,
                invigilator_id=exam.invigilator_id,
            )


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0013_hallticketsubject_exam'),
    ]

    operations = [
        migrations.AddField(
            model_name='examsubject',
            name='invigilator',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='invigilated_exam_subjects',
                to='api.teacher',
            ),
        ),
        migrations.RunPython(backfill_subject_invigilators, migrations.RunPython.noop),
    ]
