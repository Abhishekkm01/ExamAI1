from django.utils import timezone

from .attendance_service import refresh_student_eligibility
from .models import Exam, FeePayment, Student, StudentBacklog
from .settings_service import get_default_exam_fee, get_default_backlog_fee

PAYMENT_METHODS = ('online', 'bank_transfer', 'college')
PAYMENT_STATUS_PENDING = 'pending'
PAYMENT_STATUS_APPROVED = 'approved'
PAYMENT_STATUS_REJECTED = 'rejected'
FEE_TYPES = ('college', 'exam', 'backlog')

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


def student_exams_for_fees(student):
    """Exams the student is expected to pay for.

    Prefer same department + semester. If none exist, fall back to all
    active exams in the department (handles semester mismatches).
    """
    qs = Exam.objects.filter(is_deleted=False, department=student.department)
    matched = list(qs.filter(semester=student.semester).order_by('-id'))
    if matched:
        return matched
    return list(qs.order_by('-id'))


def is_exam_fee_paid(student, exam):
    amount = float(getattr(exam, 'fee_amount', None) or 0)
    if amount <= 0:
        return True
    return FeePayment.objects.filter(
        student=student,
        exam=exam,
        fee_type='exam',
        status=PAYMENT_STATUS_APPROVED,
    ).exists()


def get_pending_exam_payment(student, exam):
    return student.fee_payments.filter(
        status=PAYMENT_STATUS_PENDING,
        fee_type='exam',
        exam=exam,
    ).order_by('-paid_at').first()


def sync_overall_fee_paid(student):
    """fee_paid is True when college fee + all applicable exam fees are paid."""
    exams = student_exams_for_fees(student)
    exam_ok = all(is_exam_fee_paid(student, exam) for exam in exams) if exams else True
    updates = []
    if student.exam_fee_paid != exam_ok:
        student.exam_fee_paid = exam_ok
        updates.append('exam_fee_paid')
    both = bool(student.college_fee_paid and exam_ok)
    if student.fee_paid != both:
        student.fee_paid = both
        updates.append('fee_paid')
    if updates:
        student.save(update_fields=updates + ['updated_at'])
    return student


def refresh_students_fee_for_exam(exam):
    """Recalc fee flags for students in this exam's department."""
    students = Student.objects.filter(
        is_deleted=False,
        department=exam.department,
    )
    for student in students:
        sync_overall_fee_paid(student)
        refresh_student_eligibility(student)


def payment_to_dict(payment):
    exam = getattr(payment, 'exam', None)
    backlog = getattr(payment, 'backlog', None)
    return {
        'id': payment.id,
        'fee_type': getattr(payment, 'fee_type', None) or 'exam',
        'exam_id': exam.id if exam else None,
        'exam_title': (exam.title or exam.subject_name) if exam else None,
        'backlog_id': backlog.id if backlog else None,
        'backlog_subject': (
            f"{backlog.subject_code} — {backlog.subject_name}" if backlog else None
        ),
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


def get_pending_payment(student, fee_type=None, exam=None, backlog=None):
    qs = student.fee_payments.filter(status=PAYMENT_STATUS_PENDING)
    if fee_type:
        qs = qs.filter(fee_type=fee_type)
    if exam is not None:
        qs = qs.filter(exam=exam)
    elif fee_type == 'college':
        qs = qs.filter(exam__isnull=True, backlog__isnull=True)
    if backlog is not None:
        qs = qs.filter(backlog=backlog)
    return qs.order_by('-paid_at').first()


def is_backlog_fee_paid(student, backlog):
    return FeePayment.objects.filter(
        student=student,
        backlog=backlog,
        fee_type='backlog',
        status=PAYMENT_STATUS_APPROVED,
    ).exists()


def get_pending_backlog_payment(student, backlog):
    return student.fee_payments.filter(
        status=PAYMENT_STATUS_PENDING,
        fee_type='backlog',
        backlog=backlog,
    ).order_by('-paid_at').first()


def backlog_fee_rows(student):
    """Applied / approved / open backlog papers with fee status for student UI."""
    from .backlog_service import list_student_backlogs

    fee = get_default_backlog_fee()
    rows = []
    for item in list_student_backlogs(student):
        if item['is_cleared'] or item['status'] == StudentBacklog.STATUS_CLEARED:
            continue
        try:
            backlog = StudentBacklog.objects.get(id=item['id'], student=student)
        except StudentBacklog.DoesNotExist:
            continue
        pending = get_pending_backlog_payment(student, backlog)
        paid = is_backlog_fee_paid(student, backlog) or backlog.status == StudentBacklog.STATUS_APPROVED
        rows.append({
            **item,
            'fee_amount': fee,
            'paid': paid,
            'payment_pending': pending is not None,
            'pending_payment': payment_to_dict(pending) if pending else None,
            'can_apply': backlog.status == StudentBacklog.STATUS_OPEN,
            'can_pay': backlog.status == StudentBacklog.STATUS_APPLIED and not paid and pending is None,
        })
    return rows


def exam_fee_rows(student):
    rows = []
    for exam in student_exams_for_fees(student):
        amount = float(getattr(exam, 'fee_amount', None) or 0)
        paid = is_exam_fee_paid(student, exam)
        pending = get_pending_exam_payment(student, exam)
        rows.append({
            'exam_id': exam.id,
            'title': exam.title or exam.subject_name,
            'subject_code': exam.subject_code,
            'subject_name': exam.subject_name,
            'exam_date': exam.exam_date,
            'fee_amount': amount,
            'paid': paid,
            'payment_pending': pending is not None,
            'pending_payment': payment_to_dict(pending) if pending else None,
        })
    return rows


def get_fee_summary(student):
    sync_overall_fee_paid(student)
    student.refresh_from_db()
    history = [
        payment_to_dict(p)
        for p in student.fee_payments.select_related('exam', 'backlog').order_by('-paid_at')
    ]
    pending_college = get_pending_payment(student, 'college')
    exam_rows = exam_fee_rows(student)
    backlog_rows = backlog_fee_rows(student)
    unpaid_exams = [r for r in exam_rows if not r['paid']]
    unpaid_backlogs = [r for r in backlog_rows if not r['paid'] and r['status'] == StudentBacklog.STATUS_APPLIED]
    pending_exam_rows = [r for r in exam_rows if r['payment_pending']]
    pending_backlog_rows = [r for r in backlog_rows if r['payment_pending']]
    # pending_*_rows already store serialized payment dicts — do not re-wrap
    if pending_college:
        pending_dict = payment_to_dict(pending_college)
    elif pending_exam_rows:
        pending_dict = pending_exam_rows[0]['pending_payment']
    elif pending_backlog_rows:
        pending_dict = pending_backlog_rows[0]['pending_payment']
    else:
        pending_dict = None
    last_approved = student.fee_payments.filter(status=PAYMENT_STATUS_APPROVED).order_by('-verified_at').first()
    last_payment = payment_to_dict(last_approved) if last_approved else (history[0] if history else None)
    college_amount = float(student.college_fee_amount or 0)
    exam_due = sum(r['fee_amount'] for r in unpaid_exams)
    backlog_due = sum(r['fee_amount'] for r in unpaid_backlogs)
    return {
        'fee_paid': student.fee_paid,
        'fee_amount': college_amount + exam_due + sum(r['fee_amount'] for r in exam_rows if r['paid']),
        'fee_due_date': student.fee_due_date,
        'college_fee_amount': college_amount,
        'college_fee_paid': student.college_fee_paid,
        'exam_fee_amount': exam_due if unpaid_exams else float(student.fee_amount or get_default_exam_fee()),
        'exam_fee_paid': student.exam_fee_paid,
        'exam_fees': exam_rows,
        'unpaid_exam_count': len(unpaid_exams),
        'backlog_fee_amount': get_default_backlog_fee(),
        'backlog_fees': backlog_rows,
        'unpaid_backlog_count': len(unpaid_backlogs),
        'is_eligible': student.is_eligible,
        'eligibility_percentage': student.eligibility_percentage,
        'payment_pending': pending_dict is not None,
        'pending_payment': pending_dict,
        'pending_college': payment_to_dict(pending_college) if pending_college else None,
        'pending_exam': pending_exam_rows[0]['pending_payment'] if pending_exam_rows else None,
        'pending_backlog': pending_backlog_rows[0]['pending_payment'] if pending_backlog_rows else None,
        'bank_details': BANK_DETAILS,
        'college_office': COLLEGE_OFFICE,
        'payment_history': history,
        'last_payment': last_payment,
    }


def list_pending_payments():
    payments = FeePayment.objects.filter(
        status=PAYMENT_STATUS_PENDING,
        student__is_deleted=False,
    ).select_related('student', 'student__user', 'exam', 'backlog').order_by('-paid_at')
    return [admin_payment_to_dict(p) for p in payments]


def process_fee_payment(student, method, reference='', fee_type='exam', exam_id=None, backlog_id=None):
    fee_type = (fee_type or 'exam').strip().lower()
    if fee_type not in FEE_TYPES:
        return None, 'Invalid fee type. Use college, exam, or backlog.'

    exam = None
    backlog = None
    if fee_type == 'college':
        if student.college_fee_paid:
            return None, 'College fee already paid'
        amount = float(student.college_fee_amount or 0)
        if get_pending_payment(student, 'college'):
            return None, 'A college fee payment is already pending admin verification'
    elif fee_type == 'backlog':
        if not backlog_id:
            return None, 'Select a backlog subject to pay for.'
        try:
            backlog = StudentBacklog.objects.get(id=backlog_id, student=student)
        except StudentBacklog.DoesNotExist:
            return None, 'Backlog subject not found'
        if backlog.is_cleared or backlog.status == StudentBacklog.STATUS_CLEARED:
            return None, 'This backlog is already cleared'
        if backlog.status == StudentBacklog.STATUS_OPEN:
            return None, 'Apply for this backlog first before paying the fee'
        if backlog.status == StudentBacklog.STATUS_APPROVED or is_backlog_fee_paid(student, backlog):
            return None, 'Backlog fee already paid for this subject'
        if backlog.status != StudentBacklog.STATUS_APPLIED:
            return None, 'Backlog must be in applied status to pay'
        if get_pending_backlog_payment(student, backlog):
            return None, 'A payment for this backlog is already pending admin verification'
        amount = float(get_default_backlog_fee())
    else:
        if not exam_id:
            unpaid = next(
                (e for e in student_exams_for_fees(student) if not is_exam_fee_paid(student, e)),
                None,
            )
            if not unpaid:
                return None, 'Select an examination to pay the exam fee for.'
            exam = unpaid
        else:
            try:
                exam = Exam.objects.get(id=exam_id, is_deleted=False)
            except Exam.DoesNotExist:
                return None, 'Examination not found'
            if exam.department != student.department:
                return None, 'This examination is not assigned to your department'
            if is_exam_fee_paid(student, exam):
                return None, 'Exam fee already paid for this examination'
        amount = float(getattr(exam, 'fee_amount', None) or 0)
        if get_pending_exam_payment(student, exam):
            return None, 'A payment for this examination is already pending admin verification'

    if method not in PAYMENT_METHODS:
        return None, 'Invalid payment method'

    if amount <= 0:
        return None, f'{fee_type.title()} fee amount is not set. Contact admin.'

    if fee_type == 'backlog':
        suffix = f'B{backlog.id}'
    elif exam:
        suffix = f'E{exam.id}'
    else:
        suffix = 'C'
    txn_id = f"TXN{fee_type[:1].upper()}{student.id}{suffix}{timezone.now().strftime('%Y%m%d%H%M%S%f')}"
    try:
        payment = FeePayment.objects.create(
            student=student,
            exam=exam,
            backlog=backlog,
            fee_type=fee_type,
            amount=amount,
            method=method,
            transaction_id=txn_id,
            reference=reference or '',
            status=PAYMENT_STATUS_PENDING,
        )
    except Exception as exc:
        return None, f'Could not create payment: {exc}'
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

    fee_type = getattr(payment, 'fee_type', None) or 'exam'
    if fee_type == 'college':
        student.college_fee_paid = True
        student.save(update_fields=['college_fee_paid', 'updated_at'])
    elif fee_type == 'backlog' and payment.backlog_id:
        backlog = payment.backlog
        if backlog and not backlog.is_cleared:
            backlog.status = StudentBacklog.STATUS_APPROVED
            backlog.save(update_fields=['status', 'updated_at'])
            try:
                from .hall_ticket_service import sync_hall_ticket_subjects
                ht = getattr(student, 'hall_ticket', None)
                if ht and ht.is_active and ht.exam_id and not ht.exam.is_deleted:
                    sync_hall_ticket_subjects(ht, ht.exam)
            except Exception:
                pass

    sync_overall_fee_paid(student)
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


def admin_mark_fee_paid(student, admin_user=None, fee_type='exam', exam_id=None):
    """Direct admin verification without a student-submitted payment."""
    fee_type = (fee_type or 'exam').strip().lower()
    if fee_type not in FEE_TYPES:
        return None, 'Invalid fee type. Use college or exam.'

    if fee_type == 'college':
        pending = get_pending_payment(student, 'college')
        if pending:
            return approve_fee_payment(pending, admin_user, 'Approved by admin')
        if student.college_fee_paid:
            sync_overall_fee_paid(student)
            refresh_student_eligibility(student)
            return None, None
        amount = float(student.college_fee_amount or 0)
        exam = None
        paid_field = 'college_fee_paid'
        student.college_fee_paid = True
    else:
        if not exam_id:
            unpaid = next((e for e in student_exams_for_fees(student) if not is_exam_fee_paid(student, e)), None)
            if not unpaid:
                sync_overall_fee_paid(student)
                refresh_student_eligibility(student)
                return None, 'No unpaid exam fee found for this student. Schedule an exam for their department (or select a specific exam).'
            exam = unpaid
        else:
            try:
                exam = Exam.objects.get(id=exam_id, is_deleted=False)
            except Exam.DoesNotExist:
                return None, 'Examination not found'
            if exam.department != student.department:
                return None, 'Examination department does not match this student'

        pending = get_pending_exam_payment(student, exam)
        if pending:
            return approve_fee_payment(pending, admin_user, 'Approved by admin')
        if is_exam_fee_paid(student, exam):
            sync_overall_fee_paid(student)
            refresh_student_eligibility(student)
            return None, None
        amount = float(getattr(exam, 'fee_amount', None) or 0)
        paid_field = None

    txn_id = f"ADM{fee_type[:1].upper()}{student.id}{exam.id if exam else 'C'}{timezone.now().strftime('%Y%m%d%H%M%S')}"
    payment = FeePayment.objects.create(
        student=student,
        exam=exam,
        fee_type=fee_type,
        amount=amount,
        method='college',
        transaction_id=txn_id,
        reference=f'{fee_type.title()} fee marked paid by admin',
        status=PAYMENT_STATUS_APPROVED,
        verified_at=timezone.now(),
        verified_by=admin_user,
        admin_note='Marked paid by admin',
    )
    if paid_field:
        student.save(update_fields=[paid_field, 'updated_at'])
    sync_overall_fee_paid(student)
    refresh_student_eligibility(student)
    return payment, None
