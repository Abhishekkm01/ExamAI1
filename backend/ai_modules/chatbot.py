import os
import openai
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if GEMINI_API_KEY:
    try:
        genai.configure(api_key=GEMINI_API_KEY)
    except Exception:
        pass


class ExamShieldChatbot:
    def __init__(self):
        self.client = openai.OpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None

    def get_response(self, user_query: str, student_context: dict) -> str:
        system_prompt = f"""
You are ExamShield AI, the intelligent virtual assistant for university examination management.
You are assisting the student {student_context.get('name')} (Roll No: {student_context.get('roll_no')}, Department: {student_context.get('department')}).

Live academic database state:
- Attendance: {student_context.get('attendance_percentage')}% (min 75%)
- Internal Marks: {student_context.get('internal_marks')}/40 (min 16/40)
- Assignment Marks: {student_context.get('assignment_marks')}/10
- Previous SGPA: {student_context.get('previous_result')}
- Active Backlogs: {student_context.get('backlogs')}
- Fee Paid: {'Paid' if student_context.get('fee_paid') else 'Pending'}
- Fee Amount: ₹{student_context.get('fee_amount')} | Due: {student_context.get('fee_due_date')}
- Eligibility: {'Eligible' if student_context.get('is_eligible') else 'Not Eligible'} ({student_context.get('eligibility_percentage')}%)
- AI Risk Score: {student_context.get('ai_risk_score')}/100

Be professional, helpful, and clear. Use the facts above.
"""
        if self.client:
            try:
                response = self.client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[{"role": "system", "content": system_prompt}, {"role": "user", "content": user_query}],
                    max_tokens=250, temperature=0.3,
                )
                return response.choices[0].message.content
            except Exception:
                pass

        if GEMINI_API_KEY:
            try:
                model = genai.GenerativeModel("gemini-1.5-flash")
                chat = model.start_chat(history=[{"role": "user", "parts": [system_prompt]}, {"role": "model", "parts": ["Ready."]}])
                res = chat.send_message(user_query)
                return res.text
            except Exception:
                pass

        # Offline fallback heuristic
        q = user_query.lower()
        if "eligible" in q or "eligibility" in q:
            if student_context.get("is_eligible"):
                return f"Yes {student_context.get('name')}! You are ELIGIBLE. AI risk score: {student_context.get('ai_risk_score')}/100."
            return f"You are NOT ELIGIBLE. Attendance: {student_context.get('attendance_percentage')}%, Backlogs: {student_context.get('backlogs')}."
        if "attendance" in q:
            att = student_context.get("attendance_percentage")
            return f"Your attendance is {att}%. {'Meets threshold.' if att >= 75 else 'Below threshold.'}"
        if "marks" in q or "internal" in q:
            return f"Internal: {student_context.get('internal_marks')}/40, Assignment: {student_context.get('assignment_marks')}/10."
        if "hall ticket" in q or "download" in q:
            return "Hall ticket ready for download." if student_context.get("is_eligible") else "Hall ticket blocked: not eligible yet."
        if "fee" in q or "payment" in q:
            return "Fee paid." if student_context.get("fee_paid") else f"Fee of ₹{student_context.get('fee_amount')} is pending."
        if "backlog" in q:
            b = student_context.get("backlogs")
            return f"You have {b} active backlogs." if b > 0 else "No active backlogs."
        return f"Hello {student_context.get('name')}! I can help with eligibility, attendance, marks, hall tickets, and fees."


ai_chatbot = ExamShieldChatbot()
