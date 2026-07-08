from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def migrate_completed_to_approved(apps, schema_editor):
    FeePayment = apps.get_model('api', 'FeePayment')
    FeePayment.objects.filter(status='completed').update(status='approved')


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0006_ensure_fee_payments'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='feepayment',
            name='admin_note',
            field=models.CharField(blank=True, default='', max_length=255),
        ),
        migrations.AddField(
            model_name='feepayment',
            name='verified_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='feepayment',
            name='verified_by',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='verified_fee_payments',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AlterField(
            model_name='feepayment',
            name='status',
            field=models.CharField(
                choices=[('pending', 'Pending Verification'), ('approved', 'Approved'), ('rejected', 'Rejected')],
                default='pending',
                max_length=20,
            ),
        ),
        migrations.RunPython(migrate_completed_to_approved, migrations.RunPython.noop),
        migrations.AddIndex(
            model_name='feepayment',
            index=models.Index(fields=['status'], name='fee_payment_status_idx'),
        ),
    ]
