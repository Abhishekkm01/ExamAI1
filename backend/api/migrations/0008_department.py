from django.db import migrations, models


DEFAULT_DEPARTMENTS = [
    'MCA',
    'MBA',
    'CIVIL',
    'ELECTRONICS',
    'COMPUTER SCIENCE',
]


def seed_departments(apps, schema_editor):
    Department = apps.get_model('api', 'Department')
    for name in DEFAULT_DEPARTMENTS:
        Department.objects.get_or_create(name=name, defaults={'is_active': True})


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0007_feepayment_verification'),
    ]

    operations = [
        migrations.CreateModel(
            name='Department',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=100, unique=True)),
                ('is_active', models.BooleanField(db_index=True, default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'db_table': 'departments',
                'ordering': ['name'],
            },
        ),
        migrations.AddIndex(
            model_name='department',
            index=models.Index(fields=['is_active'], name='departments_is_active_idx'),
        ),
        migrations.RunPython(seed_departments, migrations.RunPython.noop),
    ]
