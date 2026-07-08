from .models import Department

DEFAULT_DEPARTMENTS = [
    'MCA',
    'MBA',
    'CIVIL',
    'ELECTRONICS',
    'COMPUTER SCIENCE',
]

# Old UI / seed values → canonical department name in `departments` table
LEGACY_DEPARTMENT_ALIASES = {
    'computer science': 'COMPUTER SCIENCE',
    'electronics': 'ELECTRONICS',
    'mechanical': 'CIVIL',
    'civil': 'CIVIL',
    'mca': 'MCA',
    'mba': 'MBA',
}


def canonical_department(name):
    """Map any department string to the official name from the departments table."""
    if not name or not str(name).strip():
        return None
    raw = str(name).strip()
    match = Department.objects.filter(name__iexact=raw, is_active=True).first()
    if match:
        return match.name
    return LEGACY_DEPARTMENT_ALIASES.get(raw.lower())


def get_department_names(include_legacy=False):
    """Return active department names from the departments table only."""
    return list(
        Department.objects.filter(is_active=True).order_by('name').values_list('name', flat=True)
    )


def is_valid_department(name):
    return canonical_department(name) is not None


def ensure_default_departments():
    for name in DEFAULT_DEPARTMENTS:
        Department.objects.get_or_create(name=name, defaults={'is_active': True})


def normalize_legacy_department_data():
    """Update old student/teacher/exam rows to use canonical department names."""
    from .models import Exam, Student, Teacher

    updated = 0
    for model in (Student, Teacher, Exam):
        for obj in model.objects.all():
            canonical = canonical_department(obj.department)
            if canonical and obj.department != canonical:
                obj.department = canonical
                obj.save(update_fields=['department'])
                updated += 1
    return updated
