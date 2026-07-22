from django.db import migrations, models
import django.db.models.deletion


def seed_backlog_status(apps, schema_editor):
    StudentBacklog = apps.get_model('api', 'StudentBacklog')
    StudentBacklog.objects.filter(is_cleared=True).update(status='cleared')
    StudentBacklog.objects.filter(is_cleared=False).update(status='open')


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0021_student_backlogs'),
    ]

    operations = [
        migrations.AddField(
            model_name='systemsettings',
            name='default_backlog_fee',
            field=models.FloatField(default=1500.0),
        ),
        migrations.AddField(
            model_name='studentbacklog',
            name='status',
            field=models.CharField(
                choices=[
                    ('open', 'Open'),
                    ('applied', 'Applied'),
                    ('approved', 'Approved to write'),
                    ('cleared', 'Cleared'),
                ],
                db_index=True,
                default='open',
                max_length=20,
            ),
        ),
        migrations.AddIndex(
            model_name='studentbacklog',
            index=models.Index(fields=['status'], name='student_bac_status_idx'),
        ),
        migrations.AddField(
            model_name='feepayment',
            name='backlog',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='fee_payments',
                to='api.studentbacklog',
            ),
        ),
        migrations.AlterField(
            model_name='feepayment',
            name='fee_type',
            field=models.CharField(
                choices=[
                    ('college', 'College Fee'),
                    ('exam', 'Exam Fee'),
                    ('backlog', 'Backlog Fee'),
                ],
                db_index=True,
                default='exam',
                max_length=20,
            ),
        ),
        migrations.RunPython(seed_backlog_status, migrations.RunPython.noop),
    ]
