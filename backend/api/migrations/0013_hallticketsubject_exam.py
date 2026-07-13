from django.db import migrations, models
import django.db.models.deletion


def backfill_exam_on_hall_ticket_subjects(apps, schema_editor):
    HallTicketSubject = apps.get_model('api', 'HallTicketSubject')
    for row in HallTicketSubject.objects.select_related('hall_ticket').iterator():
        if row.hall_ticket_id and row.hall_ticket.exam_id:
            row.exam_id = row.hall_ticket.exam_id
            row.save(update_fields=['exam_id'])


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0012_hallticketsubject'),
    ]

    operations = [
        migrations.AddField(
            model_name='hallticketsubject',
            name='exam',
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='hall_ticket_subject_assignments',
                to='api.exam',
            ),
        ),
        migrations.RunPython(backfill_exam_on_hall_ticket_subjects, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='hallticketsubject',
            name='exam',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='hall_ticket_subject_assignments',
                to='api.exam',
            ),
        ),
        migrations.AddIndex(
            model_name='hallticketsubject',
            index=models.Index(fields=['exam', 'subject_code'], name='idx_ht_subject_exam_code'),
        ),
    ]
