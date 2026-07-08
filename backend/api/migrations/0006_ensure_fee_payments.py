from django.db import migrations, connection


def ensure_fee_payments_table(apps, schema_editor):
    existing = set(connection.introspection.table_names())
    if 'fee_payments' not in existing:
        FeePayment = apps.get_model('api', 'FeePayment')
        schema_editor.create_model(FeePayment)


class Migration(migrations.Migration):

    atomic = False

    dependencies = [
        ('api', '0005_feepayment'),
    ]

    operations = [
        migrations.RunPython(ensure_fee_payments_table, migrations.RunPython.noop),
    ]
