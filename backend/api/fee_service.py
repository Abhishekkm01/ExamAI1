from django.utils import timezone

from .attendance_service import refresh_student_eligibility
from .models import FeePayment, Student

PAYMENT_METHODS = ('online', 'bank_transfer', 'college')
PAYMENT_STATUS_PENDING = 'pending'
PAYMENT_STATUS_APPROVED = 'approved'
PAYMENT_STATUS_REJECTED = 'rejected'

BANK_DETAILS = {
    'bank_name': 'State Bank of India',
    'account_name': 'ExamShield College Trust',
    'account_number': '1234567890',
    'ifsc': 'SBIN0001234',
    'swift': 'SBININBBXXX',
}

COLLEGE_OFFICE = {
    'location': 'Cash Counter - Admin Block, 2nd Floor',
    'hours': 'Mon-Fri: 9 AM - 5 PM',
    'accepts': 'Cash, Cheque, DD',
}


def payment_to_dict(payment):
    return {
        'id': payment.id,
        'amount': payment.amount,
        'method': payment.method,
        'transaction_id': payment.transaction_id,
        'reference': payment.reference,
        'status': payment.status,
        'paid_at': payment.paid_at.isoformat() if payment.paid_at else None,
        'verified_at': payment.verified_at.isoformat() if payment.verified_at else None,
        'admin_note': payment.admin_note or '',
    }


def admin_payment_to_dict(payment):
    student = payment.student
    data = payment_to_dict(payment)
    data.update({
        'student_id': student.id,
        'student_name': student.user.name,
        'roll_no': student.roll_no,
        'department': student.department,
        'photo': student.photo,
    })
    return data


def get_pending_payment(student):
    return student.fee_payments.filter(status=PAYMENT_STATUS_PENDING).order_by('-paid_at').first()


def get_fee_summary(student):
    history = [
        payment_to_dict(p)
        for p in student.fee_payments.order_by('-paid_at')
    ]
    pending = get_pending_payment(student)
    last_approved = student.fee_payments.filter(status=PAYMENT_STATUS_APPROVED).order_by('-verified_at').first()
    last_payment = payment_to_dict(last_approved) if last_approved else (history[0] if history else None)
    return {
        'fee_paid': student.fee_paid,
        'fee_amount': student.fee_amount,
        'fee_due_date': student.fee_due_date,
        'is_eligible': student.is_eligible,
        'eligibility_percentage': student.eligibility_percentage,
        'payment_pending': pending is not None,
        'pending_payment': payment_to_dict(pending) if pending else None,
        'bank_details': BANK_DETAILS,
        'college_office': COLLEGE_OFFICE,
        'payment_history': history,
        'last_payment': last_payment,
    }


def list_pending_payments():
    payments = FeePayment.objects.filter(
        status=PAYMENT_STATUS_PENDING,
        student__is_deleted=False,
    ).select_related('student', 'student__user').order_by('-paid_at')
    return [admin_payment_to_dict(p) for p in payments]


def process_fee_payment(student, method, reference=''):
    if student.fee_paid:
        return None, 'Fee already paid'

    if get_pending_payment(student):
        return None, 'A payment is already pending admin verification'

    if method not in PAYMENT_METHODS:
        return None, 'Invalid payment method'

    txn_id = f"TXN{student.id}{timezone.now().strftime('%Y%m%d%H%M%S')}"
    payment = FeePayment.objects.create(
        student=student,
        amount=student.fee_amount,
        method=method,
        transaction_id=txn_id,
        reference=reference or '',
        status=PAYMENT_STATUS_PENDING,
    )
    return payment, None


def approve_fee_payment(payment, admin_user=None, note=''):
    if payment.status != PAYMENT_STATUS_PENDING:
        return None, 'Only pending payments can be approved'

    student = payment.student
    now = timezone.now()
    payment.status = PAYMENT_STATUS_APPROVED
    payment.verified_at = now
    payment.verified_by = admin_user
    payment.admin_note = note or payment.admin_note
    payment.save()

    student.fee_paid = True
    student.save(update_fields=['fee_paid', 'updated_at'])
    refresh_student_eligibility(student)
    return payment, None


def reject_fee_payment(payment, admin_user=None, note=''):
    if payment.status != PAYMENT_STATUS_PENDING:
        return None, 'Only pending payments can be rejected'

    payment.status = PAYMENT_STATUS_REJECTED
    payment.verified_at = timezone.now()
    payment.verified_by = admin_user
    payment.admin_note = note or payment.admin_note or 'Rejected by admin'
    payment.save()
    return payment, None


def admin_mark_fee_paid(student, admin_user=None):
    """Direct admin verification without a student-submitted payment."""
    pending = get_pending_payment(student)
    if pending:
        return approve_fee_payment(pending, admin_user, 'Approved by admin')

    if student.fee_paid:
        refresh_student_eligibility(student)
        return None, None

    txn_id = f"ADM{student.id}{timezone.now().strftime('%Y%m%d%H%M%S')}"
    payment = FeePayment.objects.create(
        student=student,
        amount=student.fee_amount,
        method='college',
        transaction_id=txn_id,
        reference='Marked paid by admin',
        status=PAYMENT_STATUS_APPROVED,
        verified_at=timezone.now(),
        verified_by=admin_user,
        admin_note='Marked paid by admin',
    )
    student.fee_paid = True
    student.save(update_fields=['fee_paid', 'updated_at'])
    refresh_student_eligibility(student)
    return payment, None
