import os
import uuid
from django.conf import settings


ALLOWED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp', '.gif'}
MAX_PHOTO_BYTES = 5 * 1024 * 1024  # 5 MB


def photo_public_url(filename: str) -> str:
    base = getattr(settings, 'MEDIA_BASE_URL', 'http://localhost:8000/media')
    return f"{base.rstrip('/')}/photos/{filename}"


def save_profile_photo(uploaded_file, prefix: str = 'student') -> str:
    ext = os.path.splitext(uploaded_file.name)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        ext = '.jpg'

    if uploaded_file.size > MAX_PHOTO_BYTES:
        raise ValueError('Photo must be 5 MB or smaller')

    filename = f"{prefix}_{uuid.uuid4().hex}{ext}"
    photos_dir = os.path.join(settings.MEDIA_ROOT, 'photos')
    os.makedirs(photos_dir, exist_ok=True)

    dest = os.path.join(photos_dir, filename)
    with open(dest, 'wb') as out:
        for chunk in uploaded_file.chunks():
            out.write(chunk)

    return photo_public_url(filename)
