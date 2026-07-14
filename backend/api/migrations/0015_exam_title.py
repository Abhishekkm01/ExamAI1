from django.db import migrations, models


def backfill_exam_titles(apps, schema_editor):
    Exam = apps.get_model('api', 'Exam')
    for exam in Exam.objects.filter(title='').iterator():
        exam.title = exam.subject_name or exam.subject_code or f'Exam {exam.id}'
        exam.save(update_fields=['title'])


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0014_examsubject_invigilator'),
    ]

    operations = [
        migrations.AddField(
            model_name='exam',
            name='title',
            field=models.CharField(blank=True, default='', max_length=255),
        ),
        migrations.RunPython(backfill_exam_titles, migrations.RunPython.noop),
    ]
