import base64
import os

import cv2
import numpy as np

try:
    import face_recognition  # type: ignore
    FACE_REC_AVAILABLE = True
except ImportError:
    FACE_REC_AVAILABLE = False


# Strict thresholds — prefer rejecting unknowns over false accepts
FACE_MATCH_THRESHOLD = 0.55          # dlib/face_recognition (library default ~0.6)
# SFace (OpenCV FaceRecognizerSF): cosine similarity must be HIGH to accept
# Official demo uses >= 0.363; we keep stricter to cut false accepts.
OPENCV_COSINE_SIM_THRESHOLD = 0.45   # accept only if cosine similarity >= this
OPENCV_L2_THRESHOLD = 1.05           # SFace L2 distance (official ~1.128)
# Legacy aliases used by face_service (cosine *distance* = 1 - similarity)
OPENCV_COSINE_THRESHOLD = 1.0 - OPENCV_COSINE_SIM_THRESHOLD
MIN_CONFIDENCE_DLIB = 50.0
MIN_CONFIDENCE_OPENCV = 75.0
DLIB_SECOND_BEST_MARGIN = 0.08
OPENCV_SECOND_BEST_MARGIN = 0.05     # cosine-distance margin over 2nd best
# v3 = SFace neural embeddings (invalidates LBP / pixel templates)
OPENCV_ENCODING_VERSION = 3

_MODELS_DIR = os.path.join(os.path.dirname(__file__), "models")
_YUNET_PATH = os.path.join(_MODELS_DIR, "face_detection_yunet_2023mar.onnx")
_SFACE_PATH = os.path.join(_MODELS_DIR, "face_recognition_sface_2021dec.onnx")
_YUNET_URL = (
    "https://github.com/opencv/opencv_zoo/raw/main/models/"
    "face_detection_yunet/face_detection_yunet_2023mar.onnx"
)
_SFACE_URL = (
    "https://github.com/opencv/opencv_zoo/raw/main/models/"
    "face_recognition_sface/face_recognition_sface_2021dec.onnx"
)


def _download_file(url: str, dest: str) -> bool:
    try:
        import urllib.request
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        tmp = dest + ".part"
        urllib.request.urlretrieve(url, tmp)
        os.replace(tmp, dest)
        return os.path.isfile(dest) and os.path.getsize(dest) > 1000
    except Exception:
        try:
            if os.path.isfile(dest + ".part"):
                os.remove(dest + ".part")
        except Exception:
            pass
        return False


def _ensure_model_files() -> bool:
    if not os.path.isfile(_YUNET_PATH) or os.path.getsize(_YUNET_PATH) < 1000:
        if not _download_file(_YUNET_URL, _YUNET_PATH):
            return False
    if not os.path.isfile(_SFACE_PATH) or os.path.getsize(_SFACE_PATH) < 1000:
        if not _download_file(_SFACE_URL, _SFACE_PATH):
            return False
    return True


class FaceRecognitionModule:
    def __init__(self):
        self._face_cascade = None
        self._detector = None
        self._recognizer = None
        self._sface_ready = None  # None=unchecked, True/False after init attempt
        self._detector_input_size = (320, 320)

    def decode_base64_image(self, base64_string: str):
        if not base64_string:
            return None
        if "," in base64_string:
            base64_string = base64_string.split(",", 1)[1]
        try:
            img_data = base64.b64decode(base64_string)
            np_arr = np.frombuffer(img_data, np.uint8)
            return cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        except Exception:
            return None

    def _prepare_image(self, img: np.ndarray, enhance: bool = True) -> np.ndarray:
        if img is None or img.size == 0:
            return img
        h, w = img.shape[:2]
        max_side = 720
        scale = min(1.0, max_side / float(max(h, w)))
        if scale < 0.999:
            img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
        if not enhance:
            return img
        lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        l = clahe.apply(l)
        return cv2.cvtColor(cv2.merge([l, a, b]), cv2.COLOR_LAB2BGR)

    def _ensure_sface(self) -> bool:
        if self._sface_ready is not None:
            return self._sface_ready
        try:
            if not _ensure_model_files():
                self._sface_ready = False
                return False
            if not hasattr(cv2, "FaceDetectorYN_create") or not hasattr(cv2, "FaceRecognizerSF_create"):
                self._sface_ready = False
                return False
            self._detector = cv2.FaceDetectorYN_create(
                _YUNET_PATH, "", self._detector_input_size, 0.7, 0.3, 5000,
            )
            self._recognizer = cv2.FaceRecognizerSF_create(_SFACE_PATH, "")
            self._sface_ready = True
        except Exception:
            self._detector = None
            self._recognizer = None
            self._sface_ready = False
        return self._sface_ready

    def _get_cascade(self):
        if self._face_cascade is None:
            path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
            self._face_cascade = cv2.CascadeClassifier(path)
        return self._face_cascade

    def _detect_yunet_face(self, img: np.ndarray):
        """Return best YuNet face row (bbox + landmarks + score), or None."""
        if not self._ensure_sface():
            return None
        h, w = img.shape[:2]
        self._detector.setInputSize((w, h))
        _, faces = self._detector.detect(img)
        if faces is None or len(faces) == 0:
            return None
        best = max(faces, key=lambda f: float(f[2]) * float(f[3]))
        if float(best[-1]) < 0.75 or float(best[2]) < 70 or float(best[3]) < 70:
            return None
        return best

    def _opencv_encoding(self, img: np.ndarray):
        """
        SFace 128-d embedding via YuNet detect + alignCrop.
        No LBP/Haar identity path — those caused false accepts on unknown faces.
        """
        if not self._ensure_sface():
            return []

        face = self._detect_yunet_face(img)
        if face is None:
            return []

        try:
            aligned = self._recognizer.alignCrop(img, face)
            feat = self._recognizer.feature(aligned)
            vec = np.asarray(feat, dtype=np.float32).reshape(-1)
            if vec.size != 128:
                return []
            return vec.tolist()
        except Exception:
            return []

    def _dlib_encoding(self, img: np.ndarray):
        rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        for upsample in (1, 2, 0):
            locations = face_recognition.face_locations(
                rgb, number_of_times_to_upsample=upsample, model="hog",
            )
            if not locations:
                continue
            locations = sorted(
                locations,
                key=lambda box: (box[2] - box[0]) * (box[1] - box[3]),
                reverse=True,
            )
            encodings = face_recognition.face_encodings(rgb, known_face_locations=locations[:1])
            if encodings:
                return encodings[0].tolist()

        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        faces = self._get_cascade().detectMultiScale(
            gray, scaleFactor=1.1, minNeighbors=4, minSize=(80, 80),
        )
        if len(faces):
            x, y, w, h = max(faces, key=lambda f: f[2] * f[3])
            pad = int(max(w, h) * 0.2)
            y0, x0 = max(0, y - pad), max(0, x - pad)
            y1 = min(img.shape[0], y + h + pad)
            x1 = min(img.shape[1], x + w + pad)
            crop = rgb[y0:y1, x0:x1]
            if crop.size:
                ch, cw = crop.shape[:2]
                encodings = face_recognition.face_encodings(
                    crop, known_face_locations=[(0, cw, ch, 0)],
                )
                if encodings:
                    return encodings[0].tolist()
        return []

    @staticmethod
    def guess_engine(encoding) -> str:
        arr = np.asarray(encoding, dtype=np.float64)
        if arr.size != 128:
            return "unknown"
        # SFace features are typically small floats around 0 with std << 1
        # dlib encodings also ~128-d with similar stats — prefer stored engine tag
        std = float(arr.std())
        if 0.80 <= std <= 1.20 and abs(float(arr.mean())) < 0.05:
            return "opencv"  # legacy z-score templates only
        return "face_recognition" if FACE_REC_AVAILABLE else "opencv"

    def _live_variants(self, img: np.ndarray):
        # Keep variants minimal for SFace — over-augmenting increases false accepts
        variants = [self._prepare_image(img, enhance=False)]
        variants.append(self._prepare_image(img, enhance=True))
        return variants

    def _compare_dlib(self, stored, live_candidates):
        stored_arr = np.array(stored, dtype=np.float64)
        best_dist = 999.0
        for live in live_candidates:
            if not live:
                continue
            dist = float(face_recognition.face_distance(
                [stored_arr], np.array(live, dtype=np.float64),
            )[0])
            if dist < best_dist:
                best_dist = dist
        return best_dist

    def _compare_opencv(self, stored, live_candidates):
        """
        Return (best_l2, best_cosine_distance).
        Uses FaceRecognizerSF.match when available; else numpy cosine/L2.
        """
        stored_arr = np.array(stored, dtype=np.float32).reshape(1, -1)
        best_l2 = 999.0
        best_cos_dist = 999.0

        for live in live_candidates:
            if not live:
                continue
            live_arr = np.array(live, dtype=np.float32).reshape(1, -1)
            if self._ensure_sface():
                try:
                    cos_sim = float(self._recognizer.match(
                        stored_arr, live_arr, cv2.FaceRecognizerSF_FR_COSINE,
                    ))
                    l2 = float(self._recognizer.match(
                        stored_arr, live_arr, cv2.FaceRecognizerSF_FR_NORM_L2,
                    ))
                    cos_dist = 1.0 - cos_sim
                except Exception:
                    sn = stored_arr.ravel()
                    ln = live_arr.ravel()
                    sn = sn / (np.linalg.norm(sn) + 1e-6)
                    ln = ln / (np.linalg.norm(ln) + 1e-6)
                    cos_dist = float(1.0 - np.dot(sn, ln))
                    l2 = float(np.linalg.norm(sn - ln))
            else:
                sn = stored_arr.ravel()
                ln = live_arr.ravel()
                sn = sn / (np.linalg.norm(sn) + 1e-6)
                ln = ln / (np.linalg.norm(ln) + 1e-6)
                cos_dist = float(1.0 - np.dot(sn, ln))
                l2 = float(np.linalg.norm(sn - ln))

            if l2 < best_l2:
                best_l2 = l2
            if cos_dist < best_cos_dist:
                best_cos_dist = cos_dist
        return best_l2, best_cos_dist

    def _opencv_passes(self, l2, cos_dist):
        cos_sim = 1.0 - cos_dist
        return cos_sim >= OPENCV_COSINE_SIM_THRESHOLD and l2 <= OPENCV_L2_THRESHOLD

    def _opencv_confidence(self, l2, cos_dist):
        cos_sim = 1.0 - cos_dist
        # Map similarity above threshold into 75–100 confidence band
        if cos_sim < OPENCV_COSINE_SIM_THRESHOLD:
            return round(max(0.0, cos_sim / OPENCV_COSINE_SIM_THRESHOLD * 70.0), 1)
        span = max(1e-6, 1.0 - OPENCV_COSINE_SIM_THRESHOLD)
        cos_score = 75.0 + ((cos_sim - OPENCV_COSINE_SIM_THRESHOLD) / span) * 25.0
        l2_score = max(0.0, 100.0 - (l2 / OPENCV_L2_THRESHOLD) * 40.0)
        return round(min(100.0, 0.7 * cos_score + 0.3 * l2_score), 1)

    def get_face_encoding(self, base64_string: str, engine=None):
        img = self.decode_base64_image(base64_string)
        if img is None:
            return [], None

        prefer = engine or ("face_recognition" if FACE_REC_AVAILABLE else "opencv")

        if prefer == "face_recognition" and FACE_REC_AVAILABLE:
            for variant in self._live_variants(img):
                enc = self._dlib_encoding(variant)
                if enc:
                    return enc, "face_recognition"
            if engine == "face_recognition":
                return [], None

        if not self._ensure_sface():
            return [], None

        for variant in self._live_variants(img):
            enc = self._opencv_encoding(variant)
            if enc:
                return enc, "opencv"
        return [], None

    def verify_face(self, live_base64: str, stored_encoding: list, stored_engine=None) -> dict:
        if not stored_encoding or len(stored_encoding) != 128:
            return {
                "verified": False,
                "confidence": 0.0,
                "message": "No enrolled face profile found. Please re-enroll your face.",
            }

        engine = stored_engine or self.guess_engine(stored_encoding)
        img = self.decode_base64_image(live_base64)
        if img is None:
            return {
                "verified": False,
                "confidence": 0.0,
                "message": "Could not read the captured photo. Try again.",
            }

        variants = self._live_variants(img)

        if engine == "face_recognition" and FACE_REC_AVAILABLE:
            live_list = [enc for v in variants if (enc := self._dlib_encoding(v))]
            if not live_list:
                return {
                    "verified": False,
                    "confidence": 0.0,
                    "message": "No face detected. Face the camera with good lighting and try again.",
                }
            dist = self._compare_dlib(stored_encoding, live_list)
            confidence = max(0.0, min(100.0, (1.0 - dist) * 100.0))
            verified = bool(dist <= FACE_MATCH_THRESHOLD and confidence >= MIN_CONFIDENCE_DLIB)
            if verified:
                message = "Verification complete"
            elif dist <= FACE_MATCH_THRESHOLD + 0.06:
                message = "Almost matched — hold still, face the camera, and try again"
            else:
                message = "Face does not match the enrolled profile."
            return {
                "verified": verified,
                "confidence": round(confidence, 1),
                "message": message,
                "engine": "face_recognition",
                "distance": round(dist, 4),
            }

        if not self._ensure_sface():
            return {
                "verified": False,
                "confidence": 0.0,
                "message": "Face recognition model is not available on the server. Contact admin.",
            }

        live_list = [enc for v in variants if (enc := self._opencv_encoding(v))]
        if not live_list:
            return {
                "verified": False,
                "confidence": 0.0,
                "message": "No face detected. Face the camera with good lighting and try again.",
            }
        l2, cos_dist = self._compare_opencv(stored_encoding, live_list)
        confidence = self._opencv_confidence(l2, cos_dist)
        verified = bool(self._opencv_passes(l2, cos_dist) and confidence >= MIN_CONFIDENCE_OPENCV)
        return {
            "verified": verified,
            "confidence": confidence,
            "message": (
                "Verification complete"
                if verified
                else "Face does not match the enrolled profile."
            ),
            "engine": "opencv",
            "distance": round(l2, 4),
            "cosine_distance": round(cos_dist, 4),
            "cosine_similarity": round(1.0 - cos_dist, 4),
        }


face_ai = FaceRecognitionModule()
