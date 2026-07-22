from django.db import migrations, models
import django.db.models.deletion


def seed_legacy_exam_payments(apps, schema_editor):
    """
    Students who already had exam_fee_paid=True keep credit for older exams.
    The newest exam per department+semester is left unpaid so newly scheduled
    examinations still show a payment option.
    """
    Student = apps.get_model('api', 'Student')
    Exam = apps.get_model('api', 'Exam')
    FeePayment = apps.get_model('api', 'FeePayment')
    SystemSettings = apps.get_model('api', 'SystemSettings')

    settings = SystemSettings.objects.filter(pk=1).first()
    default_fee = float(getattr(settings, 'default_exam_fee', None) or 45000)

    for exam in Exam.objects.filter(is_deleted=False):
        if not getattr(exam, 'fee_amount', None):
            exam.fee_amount = default_fee
            exam.save(update_fields=['fee_amount'])

    for student in Student.objects.filter(is_deleted=False, exam_fee_paid=True):
        exams = list(
            Exam.objects.filter(
                is_deleted=False,
                department=student.department,
                semester=student.semester,
            ).order_by('id')
        )
        # Always leave the newest exam unpaid so newly scheduled exams need payment
        to_credit = exams[:-1] if exams else []
        for exam in to_credit:
            exists = FeePayment.objects.filter(
                student_id=student.id,
                exam_id=exam.id,
                fee_type='exam',
                status='approved',
            ).exists()
            if exists:
                continue
            FeePayment.objects.create(
                student_id=student.id,
                exam_id=exam.id,
                fee_type='exam',
                amount=float(exam.fee_amount or default_fee),
                method='college',
                transaction_id=f'LEGACY{student.id}E{exam.id}',
                reference='Migrated: previously marked exam fee paid',
                status='approved',
                admin_note='Legacy exam fee migration',
            )
        # Recalc flag: newest exam unpaid => exam_fee_paid False
        student.exam_fee_paid = len(to_credit) == len(exams)
        student.fee_paid = bool(student.college_fee_paid and student.exam_fee_paid)
        student.save(update_fields=['exam_fee_paid', 'fee_paid'])


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0019_college_and_exam_fees'),
    ]

    operations = [
        migrations.AddField(
            model_name='exam',
            name='fee_amount',
            field=models.FloatField(default=45000.0),
        ),
        migrations.AddField(
            model_name='feepayment',
            name='exam',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='fee_payments',
                to='api.exam',
            ),
        ),
        migrations.AddIndex(
            model_name='feepayment',
            index=models.Index(fields=['exam'], name='fee_paymen_exam_id_idx'),
        ),
        migrations.RunPython(seed_legacy_exam_payments, migrations.RunPython.noop),
    ]
