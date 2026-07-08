from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0004_ensure_seating_tables'),
    ]

    operations = [
        migrations.CreateModel(
            name='FeePayment',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('amount', models.FloatField()),
                ('method', models.CharField(choices=[('online', 'Online'), ('bank_transfer', 'Bank Transfer'), ('college', 'College Office')], max_length=20)),
                ('transaction_id', models.CharField(max_length=100, unique=True)),
                ('reference', models.CharField(blank=True, default='', max_length=255)),
                ('status', models.CharField(default='completed', max_length=20)),
                ('paid_at', models.DateTimeField(auto_now_add=True)),
                ('student', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='fee_payments', to='api.student')),
            ],
            options={
                'db_table': 'fee_payments',
                'indexes': [
                    models.Index(fields=['student'], name='fee_payment_student_idx'),
                    models.Index(fields=['transaction_id'], name='fee_payment_txn_idx'),
                ],
            },
        ),
    ]
