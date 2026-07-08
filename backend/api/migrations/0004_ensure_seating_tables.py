from django.db import migrations, connection


def ensure_seating_tables(apps, schema_editor):
    """Create seating tables if missing (DB was set up before migration 0003 ran)."""
    existing = set(connection.introspection.table_names())
    SeatingRoom = apps.get_model('api', 'SeatingRoom')
    SeatingArrangement = apps.get_model('api', 'SeatingArrangement')

    if 'seating_rooms' not in existing:
        schema_editor.create_model(SeatingRoom)
    if 'seating_arrangements' not in existing:
        schema_editor.create_model(SeatingArrangement)


class Migration(migrations.Migration):

    atomic = False

    dependencies = [
        ('api', '0003_seatingroom_seatingarrangement'),
    ]

    operations = [
        migrations.RunPython(ensure_seating_tables, migrations.RunPython.noop),
    ]
