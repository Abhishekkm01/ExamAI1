import json
import os

from ai_modules.face_recognition_module import face_ai

from .photo_utils import photo_path_from_url


def load_face_encoding(student):
    if not student.face_encoding:
        return None
    try:
        data = json.loads(student.face_encoding)
        if isinstance(data, list) and len(data) == 128:
            return data
    except (json.JSONDecodeError, TypeError, ValueError):
        pass
    return None


def is_face_enrolled(student):
    return load_face_encoding(student) is not None


def save_face_encoding(student, encoding):
    student.face_encoding = json.dumps(encoding)
    student.save(update_fields=['face_encoding', 'updated_at'])


def enroll_face_from_base64(student, image_base64):
    encoding = face_ai.get_face_encoding(image_base64)
    if not encoding:
        return False, 'No face detected. Use a clear, front-facing photo with good lighting.'
    save_face_encoding(student, encoding)
    return True, None


def enroll_face_from_photo_url(student, photo_url):
    if not photo_url or '/media/photos/' not in photo_url:
        return False, 'Use a real profile photo (not an avatar) to enroll face data.'
    path = photo_path_from_url(photo_url)
    if not path or not os.path.exists(path):
        return False, 'Photo file not found'
    import base64
    with open(path, 'rb') as f:
        image_base64 = base64.b64encode(f.read()).decode('utf-8')
    return enroll_face_from_base64(student, f'data:image/jpeg;base64,{image_base64}')


def try_enroll_student_face(student, photo_url=None):
    """Best-effort face enrollment from the student's profile photo."""
    url = photo_url or student.photo
    ok, message = enroll_face_from_photo_url(student, url)
    return ok, message


def verify_student_face(student, image_base64):
    encoding = load_face_encoding(student)
    if not encoding:
        return {
            'verified': False,
            'confidence': 0.0,
            'message': 'Face profile not enrolled. Upload a profile photo or enroll from the Face Verification page.',
        }
    result = face_ai.verify_face(image_base64, encoding)
    result['student_name'] = student.user.name
    result['roll_no'] = student.roll_no
    return result


def match_student_face(image_base64, students):
    """Find the best matching student from a queryset/list."""
    best_conf = 0.0
    best_match = None
    best_result = None

    for student in students:
        encoding = load_face_encoding(student)
        if not encoding:
            continue
        result = face_ai.verify_face(image_base64, encoding)
        if result['verified'] and result['confidence'] > best_conf:
            best_conf = result['confidence']
            best_match = student
            best_result = result

    return best_match, best_conf, best_result
