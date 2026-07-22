from django.db import migrations, models


def seed_fee_fields(apps, schema_editor):
    Student = apps.get_model('api', 'Student')
    SystemSettings = apps.get_model('api', 'SystemSettings')
    settings, _ = SystemSettings.objects.get_or_create(pk=1)
    college_default = float(getattr(settings, 'default_college_fee', None) or 25000)

    for s in Student.objects.all():
        s.exam_fee_paid = bool(s.fee_paid)
        # Existing paid students are treated as having cleared both fees
        s.college_fee_paid = bool(s.fee_paid)
        if not s.college_fee_amount:
            s.college_fee_amount = college_default
        s.save(update_fields=['exam_fee_paid', 'college_fee_paid', 'college_fee_amount'])


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0018_class_timetable'),
    ]

    operations = [
        migrations.AddField(
            model_name='student',
            name='college_fee_amount',
            field=models.FloatField(default=25000.0),
        ),
        migrations.AddField(
            model_name='student',
            name='college_fee_paid',
            field=models.BooleanField(db_index=True, default=False),
        ),
        migrations.AddField(
            model_name='student',
            name='exam_fee_paid',
            field=models.BooleanField(db_index=True, default=False),
        ),
        migrations.AddField(
            model_name='systemsettings',
            name='default_college_fee',
            field=models.FloatField(default=25000.0),
        ),
        migrations.AddField(
            model_name='feepayment',
            name='fee_type',
            field=models.CharField(
                choices=[('college', 'College Fee'), ('exam', 'Exam Fee')],
                db_index=True,
                default='exam',
                max_length=20,
            ),
        ),
        migrations.AddIndex(
            model_name='feepayment',
            index=models.Index(fields=['fee_type'], name='fee_paymen_fee_typ_idx'),
        ),
        migrations.RunPython(seed_fee_fields, migrations.RunPython.noop),
    ]
