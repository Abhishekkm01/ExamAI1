from .models import Department

DEFAULT_DEPARTMENTS = [
    'MCA',
    'MBA',
    'CIVIL',
    'ELECTRONICS',
    'COMPUTER SCIENCE',
]


def get_department_names(include_legacy=True):
    """Return active department names from the database."""
    names = list(
        Department.objects.filter(is_active=True).order_by('name').values_list('name', flat=True)
    )
    if include_legacy:
        from .models import Student
        legacy = set(
            Student.objects.filter(is_deleted=False).values_list('department', flat=True)
        )
        for dept in sorted(legacy):
            if dept and dept not in names:
                names.append(dept)
    return names


def is_valid_department(name):
    if not name:
        return False
    return Department.objects.filter(name=name, is_active=True).exists()


def ensure_default_departments():
    for name in DEFAULT_DEPARTMENTS:
        Department.objects.get_or_create(name=name, defaults={'is_active': True})
