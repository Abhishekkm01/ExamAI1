import json
import os

from ai_modules.face_recognition_module import (
    face_ai,
    FACE_REC_AVAILABLE,
    OPENCV_ENCODING_VERSION,
)

from .photo_utils import photo_path_from_url


def _parse_face_payload(raw):
    """
    Returns (encoding_list, engine) or (None, None).
    Supports {"engine","encoding","version"} objects.
    Legacy bare lists / opencv v1 templates are rejected (force re-enroll).
    """
    if not raw:
        return None, None
    try:
        data = json.loads(raw)
    except (json.JSONDecodeError, TypeError, ValueError):
        return None, None

    # Legacy bare 128-d lists were the weak pixel templates — invalidate them
    if isinstance(data, list):
        return None, None

    if isinstance(data, dict):
        encoding = data.get('encoding') or data.get('vector')
        engine = data.get('engine')
        if not isinstance(encoding, list) or len(encoding) != 128:
            return None, None
        if engine not in ('face_recognition', 'opencv'):
            engine = face_ai.guess_engine(encoding)
        # OpenCV descriptor format changed — old templates must be re-enrolled
        if engine == 'opencv':
            version = int(data.get('version') or 1)
            if version < OPENCV_ENCODING_VERSION:
                return None, None
        return encoding, engine
    return None, None


def load_face_encoding(student):
    """Return encoding list only (backward compatible helper)."""
    encoding, _engine = _parse_face_payload(student.face_encoding)
    return encoding


def load_face_profile(student):
    """Return (encoding, engine) for verification."""
    return _parse_face_payload(student.face_encoding)


def is_face_enrolled(student):
    encoding, _engine = load_face_profile(student)
    return encoding is not None


def save_face_encoding(student, encoding, engine=None):
    engine = engine or face_ai.guess_engine(encoding)
    payload = {
        'engine': engine,
        'encoding': encoding,
    }
    if engine == 'opencv':
        payload['version'] = OPENCV_ENCODING_VERSION
    student.face_encoding = json.dumps(payload)
    student.save(update_fields=['face_encoding', 'updated_at'])


def enroll_face_from_base64(student, image_base64):
    prefer = 'face_recognition' if FACE_REC_AVAILABLE else 'opencv'
    encoding, engine = face_ai.get_face_encoding(image_base64, engine=prefer)
    if not encoding and prefer == 'face_recognition':
        # Last resort enroll with opencv so the student can still proceed
        encoding, engine = face_ai.get_face_encoding(image_base64, engine='opencv')
    if not encoding:
        if prefer == 'opencv' and not face_ai._ensure_sface():
            return False, 'Face recognition model files are missing on the server. Contact admin.'
        return False, 'No face detected. Use a clear, front-facing photo with good lighting.'
    save_face_encoding(student, encoding, engine=engine)
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
    encoding, engine = load_face_profile(student)
    if not encoding:
        return {
            'verified': False,
            'confidence': 0.0,
            'message': 'Face profile not enrolled. Use Enroll My Face first.',
        }
    result = face_ai.verify_face(image_base64, encoding, stored_engine=engine)
    result['student_name'] = student.user.name
    result['roll_no'] = student.roll_no
    return result


def match_student_face(image_base64, students, match_slack=0.0):
    """
    Find the best matching student from a queryset/list.
    Requires a clear winner: threshold + confidence floor + margin over 2nd-best.
    """
    from ai_modules.face_recognition_module import (
        FACE_MATCH_THRESHOLD,
        MIN_CONFIDENCE_DLIB,
        MIN_CONFIDENCE_OPENCV,
        DLIB_SECOND_BEST_MARGIN,
        OPENCV_SECOND_BEST_MARGIN,
        FACE_REC_AVAILABLE,
    )

    img = face_ai.decode_base64_image(image_base64)
    if img is None:
        return None, 0.0, {
            'verified': False,
            'confidence': 0.0,
            'message': 'Could not read the captured photo. Try again.',
        }

    variants = face_ai._live_variants(img)
    live_dlib = []
    live_opencv = []
    if FACE_REC_AVAILABLE:
        for variant in variants:
            enc = face_ai._dlib_encoding(variant)
            if enc:
                live_dlib.append(enc)
    for variant in variants:
        enc = face_ai._opencv_encoding(variant)
        if enc:
            live_opencv.append(enc)

    if not live_dlib and not live_opencv:
        return None, 0.0, {
            'verified': False,
            'confidence': 0.0,
            'message': 'No face detected. Ask the student to face the camera with good lighting.',
        }

    ranked = []  # list of dicts with student, score(dist), confidence, engine, verified_raw

    for student in students:
        encoding, engine = load_face_profile(student)
        if not encoding:
            continue

        if engine == 'face_recognition' and live_dlib:
            dist = face_ai._compare_dlib(encoding, live_dlib)
            threshold = FACE_MATCH_THRESHOLD + float(match_slack or 0)
            confidence = max(0.0, min(100.0, (1.0 - dist) * 100.0))
            passes = dist <= threshold and confidence >= MIN_CONFIDENCE_DLIB
            ranked.append({
                'student': student,
                'score': dist,
                'confidence': round(confidence, 1),
                'passes': passes,
                'engine': 'face_recognition',
                'margin_needed': DLIB_SECOND_BEST_MARGIN,
            })
        elif live_opencv:
            l2, cos_dist = face_ai._compare_opencv(encoding, live_opencv)
            from ai_modules.face_recognition_module import (
                OPENCV_L2_THRESHOLD,
                OPENCV_COSINE_THRESHOLD,
                OPENCV_COSINE_SIM_THRESHOLD,
            )
            # Optional tiny slack only for teacher captures (still requires strong similarity)
            sim_slack = 0.02 * float(match_slack or 0)
            cos_sim = 1.0 - cos_dist
            passes = (
                cos_sim >= (OPENCV_COSINE_SIM_THRESHOLD - sim_slack)
                and l2 <= (OPENCV_L2_THRESHOLD + 0.05 * float(match_slack or 0))
                and cos_dist <= OPENCV_COSINE_THRESHOLD
            )
            confidence = face_ai._opencv_confidence(l2, cos_dist)
            passes = passes and confidence >= MIN_CONFIDENCE_OPENCV
            ranked.append({
                'student': student,
                # Lower cosine-distance is better (sort key)
                'score': cos_dist,
                'confidence': confidence,
                'passes': passes,
                'engine': 'opencv',
                'margin_needed': OPENCV_SECOND_BEST_MARGIN,
                'cosine_distance': round(cos_dist, 4),
                'cosine_similarity': round(cos_sim, 4),
                'l2': round(l2, 4),
            })

    if not ranked:
        return None, 0.0, {
            'verified': False,
            'confidence': 0.0,
            'message': 'No enrolled face profiles found among exam students.',
        }

    ranked.sort(key=lambda r: r['score'])
    best = ranked[0]
    second = ranked[1] if len(ranked) > 1 else None

    clear_winner = True
    if second is not None:
        clear_winner = (second['score'] - best['score']) >= best['margin_needed']

    if best['passes'] and clear_winner:
        return best['student'], best['confidence'], {
            'verified': True,
            'confidence': best['confidence'],
            'message': 'Verification complete',
            'engine': best['engine'],
            'distance': round(best['score'], 4),
        }

    # Reject ambiguous or weak matches (prevents false accepts of different faces)
    reason = 'Face does not match any enrolled student confidently.'
    if best['passes'] and not clear_winner:
        reason = 'Match was ambiguous between multiple students. Capture again with a clearer face view.'
    elif best['confidence'] >= 45:
        reason = 'Closest face was not similar enough. Ask the student to face the camera and try again.'

    return None, best['confidence'], {
        'verified': False,
        'confidence': best['confidence'],
        'message': reason,
        'engine': best['engine'],
        'distance': round(best['score'], 4),
    }