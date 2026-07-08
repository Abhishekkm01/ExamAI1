import base64
import cv2
import numpy as np

try:
    import face_recognition  # type: ignore
    FACE_REC_AVAILABLE = True
except ImportError:
    FACE_REC_AVAILABLE = False


class FaceRecognitionModule:
    def __init__(self):
        self._face_cascade = None

    def decode_base64_image(self, base64_string: str) -> np.ndarray:
        if "," in base64_string:
            base64_string = base64_string.split(",")[1]
        img_data = base64.b64decode(base64_string)
        np_arr = np.frombuffer(img_data, np.uint8)
        img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        return img

    def _get_cascade(self):
        if self._face_cascade is None:
            path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
            self._face_cascade = cv2.CascadeClassifier(path)
        return self._face_cascade

    def _extract_face_roi(self, img: np.ndarray):
        """Return a grayscale face region, using detection or a centered crop."""
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        gray = cv2.equalizeHist(gray)
        cascade = self._get_cascade()
        faces = cascade.detectMultiScale(
            gray,
            scaleFactor=1.08,
            minNeighbors=4,
            minSize=(72, 72),
        )

        if len(faces) > 0:
            x, y, w, h = max(faces, key=lambda f: f[2] * f[3])
            pad = int(max(w, h) * 0.12)
            y0 = max(0, y - pad)
            x0 = max(0, x - pad)
            y1 = min(gray.shape[0], y + h + pad)
            x1 = min(gray.shape[1], x + w + pad)
            return gray[y0:y1, x0:x1]

        h, w = gray.shape
        side = int(min(h, w) * 0.72)
        y0 = max(0, (h - side) // 2)
        x0 = max(0, (w - side) // 2)
        return gray[y0:y0 + side, x0:x0 + side]

    def _opencv_encoding(self, img: np.ndarray):
        roi = self._extract_face_roi(img)
        if roi is None or roi.size == 0:
            return []

        roi = cv2.resize(roi, (16, 8), interpolation=cv2.INTER_AREA)
        vec = roi.flatten().astype(np.float32)
        std = float(vec.std())
        if std < 1e-6:
            return []
        vec = (vec - float(vec.mean())) / std
        return vec.tolist()

    def get_face_encoding(self, base64_string: str):
        img = self.decode_base64_image(base64_string)
        if img is None:
            return []
        if FACE_REC_AVAILABLE:
            rgb_img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            encodings = face_recognition.face_encodings(rgb_img)
            return encodings[0].tolist() if encodings else []
        return self._opencv_encoding(img)

    def verify_face(self, live_base64: str, stored_encoding: list) -> dict:
        if not stored_encoding or len(stored_encoding) != 128:
            return {
                "verified": False,
                "confidence": 0.0,
                "message": "No enrolled face profile found for comparison",
            }

        live_encoding = self.get_face_encoding(live_base64)
        if not live_encoding:
            return {
                "verified": False,
                "confidence": 0.0,
                "message": "No face detected. Look straight at the camera with good lighting.",
            }

        if FACE_REC_AVAILABLE:
            dist = face_recognition.face_distance(
                [np.array(stored_encoding)], np.array(live_encoding)
            )[0]
            confidence = max(0.0, min(100.0, (1.0 - dist) * 100.0))
            verified = bool(dist <= 0.55)
            return {
                "verified": verified,
                "confidence": round(confidence, 1),
                "message": "Verification complete",
                "engine": "face_recognition",
            }

        stored = np.array(stored_encoding, dtype=np.float32)
        live = np.array(live_encoding, dtype=np.float32)
        dist = float(np.linalg.norm(stored - live))
        confidence = max(0.0, min(100.0, 100.0 - dist * 18.0))
        verified = dist <= 4.0

        return {
            "verified": verified,
            "confidence": round(confidence, 1),
            "message": "Verification complete" if verified else "Face does not match the enrolled profile",
            "engine": "opencv",
        }


face_ai = FaceRecognitionModule()
