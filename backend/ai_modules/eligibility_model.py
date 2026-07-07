import os
import pickle
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier

MODEL_PATH = os.path.join(os.path.dirname(__file__), "trained_rf_model.pkl")


class EligibilityModel:
    def __init__(self):
        self.model = None
        self.load_or_train_model()

    def load_or_train_model(self):
        if os.path.exists(MODEL_PATH):
            try:
                with open(MODEL_PATH, "rb") as f:
                    self.model = pickle.load(f)
                return
            except Exception:
                pass
        self.train_initial_model()

    def train_initial_model(self):
        np.random.seed(42)
        n_samples = 1000
        attendance = np.random.normal(78, 12, n_samples).clip(30, 100)
        internals = np.random.normal(28, 7, n_samples).clip(5, 40)
        previous_sgpa = np.random.normal(7.2, 1.5, n_samples).clip(2.0, 10.0)
        backlogs = np.random.choice([0, 1, 2, 3, 4], n_samples, p=[0.7, 0.15, 0.08, 0.05, 0.02])
        y = ((attendance >= 75) & (internals >= 16) & (backlogs == 0) & (previous_sgpa >= 5.0)).astype(int)
        X = pd.DataFrame({"attendance": attendance, "internals": internals, "previous_sgpa": previous_sgpa, "backlogs": backlogs})
        rf = RandomForestClassifier(n_estimators=100, max_depth=8, random_state=42)
        rf.fit(X, y)
        self.model = rf
        try:
            with open(MODEL_PATH, "wb") as f:
                pickle.dump(rf, f)
        except Exception:
            pass

    def predict_eligibility(self, attendance: float, internal_marks: float, previous_sgpa: float, backlogs: int):
        if not self.model:
            self.train_initial_model()
        X_input = pd.DataFrame({"attendance": [attendance], "internals": [internal_marks], "previous_sgpa": [previous_sgpa], "backlogs": [backlogs]})
        prob = self.model.predict_proba(X_input)[0]
        success_probability = float(prob[1])
        risk_score = float(prob[0] * 100.0)
        if attendance < 75.0:
            risk_score = min(100.0, risk_score + ((75.0 - attendance) * 2.0))
        is_eligible = success_probability >= 0.5 and attendance >= 75.0
        return {"is_eligible": bool(is_eligible), "probability": round(success_probability, 4), "risk_score": round(risk_score, 1)}


eligibility_ai = EligibilityModel()
