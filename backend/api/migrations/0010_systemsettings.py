from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0009_drop_authtoken_table'),
    ]

    operations = [
        migrations.CreateModel(
            name='SystemSettings',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('university_name', models.CharField(default='National Institute of Technology', max_length=255)),
                ('academic_year', models.CharField(default='2026-27', max_length=20)),
                ('current_semester', models.PositiveSmallIntegerField(default=5)),
                ('contact_email', models.EmailField(default='admin@nit.edu', max_length=254)),
                ('attendance_threshold', models.PositiveSmallIntegerField(default=75)),
                ('internal_marks_threshold', models.PositiveSmallIntegerField(default=40)),
                ('min_sgpa', models.FloatField(default=5.0)),
                ('ml_model', models.CharField(choices=[('rf', 'Random Forest Classifier'), ('dt', 'Decision Tree')], default='rf', max_length=10)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'db_table': 'system_settings',
            },
        ),
    ]
