from django.db import migrations, connection


def drop_authtoken_table(apps, schema_editor):
    if 'authtoken_token' in connection.introspection.table_names():
        with connection.cursor() as cursor:
            cursor.execute('DROP TABLE IF EXISTS `authtoken_token`')


class Migration(migrations.Migration):

    atomic = False

    dependencies = [
        ('api', '0008_department'),
    ]

    operations = [
        migrations.RunPython(drop_authtoken_table, migrations.RunPython.noop),
    ]
