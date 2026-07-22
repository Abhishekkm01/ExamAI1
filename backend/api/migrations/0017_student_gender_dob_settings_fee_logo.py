from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0016_hod_role_and_model'),
    ]

    operations = [
        migrations.AddField(
            model_name='student',
            name='gender',
            field=models.CharField(
                blank=True,
                choices=[('male', 'Male'), ('female', 'Female'), ('other', 'Other')],
                default='',
                max_length=10,
            ),
        ),
        migrations.AddField(
            model_name='student',
            name='date_of_birth',
            field=models.CharField(blank=True, max_length=20, null=True),
        ),
        migrations.AddField(
            model_name='systemsettings',
            name='college_logo_url',
            field=models.URLField(blank=True, default='', max_length=512),
        ),
        migrations.AddField(
            model_name='systemsettings',
            name='default_exam_fee',
            field=models.FloatField(default=45000.0),
        ),
    ]
