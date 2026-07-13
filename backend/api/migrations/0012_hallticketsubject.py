from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0011_exam_invigilator_subjects_seat_unique'),
    ]

    operations = [
        migrations.CreateModel(
            name='HallTicketSubject',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('subject_code', models.CharField(max_length=50)),
                ('subject_name', models.CharField(max_length=255)),
                ('exam_date', models.CharField(blank=True, default='', max_length=50)),
                ('exam_time', models.CharField(blank=True, default='', max_length=50)),
                ('duration', models.CharField(blank=True, default='', max_length=50)),
                ('seat_number', models.CharField(max_length=50)),
                ('room', models.CharField(max_length=100)),
                ('sort_order', models.PositiveSmallIntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('hall_ticket', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='subject_assignments', to='api.hallticket')),
            ],
            options={
                'db_table': 'hall_ticket_subjects',
                'ordering': ['sort_order', 'id'],
                'unique_together': {('hall_ticket', 'subject_code')},
            },
        ),
        migrations.AddIndex(
            model_name='hallticketsubject',
            index=models.Index(fields=['hall_ticket'], name='idx_ht_subject_ticket'),
        ),
        migrations.AddIndex(
            model_name='hallticketsubject',
            index=models.Index(fields=['subject_code'], name='idx_ht_subject_code'),
        ),
    ]
