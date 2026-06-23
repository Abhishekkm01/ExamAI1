# ExamShield AI – Python FastAPI Backend & MySQL Schema

This directory contains the production-ready Python FastAPI backend for **ExamShield AI – Intelligent Hall Ticket Generation and Student Authentication System**.

## 🚀 Key Highlights & Architecture

- **Framework**: Python FastAPI with automatic interactive API docs (`/docs` & `/redoc`).
- **ORM & Database**: SQLAlchemy 2.0 connected to MySQL via `pymysql`. Includes complete schema with Foreign Keys, Indexes, Audit fields (`created_at`, `updated_at`), and Soft Delete (`is_deleted`).
- **Security & Authentication**: JWT-based role authentication (`Admin`, `Teacher`, `Student`) with password hashing via `passlib[bcrypt]`.
- **AI/ML Integration**:
  - **AI Eligibility Prediction**: Scikit-Learn `RandomForestClassifier` trained on student data (attendance, internals, previous SGPA, backlogs) to predict success probability and risk score.
  - **AI Chatbot**: Modular OpenAI / Google Gemini API integration with dynamic prompt context injection (answering questions regarding eligibility, attendance, exams, fees, and hall tickets).
  - **Face Recognition**: Biometric student verification powered by OpenCV and `face_recognition`, computing face encodings and exact match confidence scores.
- **Reporting**: Automated generation of PDF hall tickets (`reportlab`) and Excel reports (`openpyxl`).

---

## 🛠️ Folder Structure

```
backend/
├── requirements.txt
├── README.md
├── database.py              # MySQL Database connection & session management
├── models.py                # Comprehensive SQLAlchemy MySQL schema
├── schemas.py               # Pydantic models for request/response validation
├── auth.py                  # JWT encoding/decoding & role dependencies
├── main.py                  # FastAPI app entry point, CORS, startup seed data
├── ai_modules/
│   ├── eligibility_model.py # Scikit-Learn Random Forest prediction engine
│   ├── chatbot.py           # OpenAI / Gemini API chatbot engine
│   └── face_recognition_module.py # OpenCV face matching engine
└── routers/
    ├── auth_router.py       # Login & token generation
    ├── admin_router.py      # Admin management endpoints
    ├── teacher_router.py    # Teacher grading & attendance endpoints
    ├── student_router.py    # Student profile, hall ticket, AI assistant endpoints
    └── public_router.py     # QR Hall Ticket verification endpoints
```

---

## 💻 Setup & Deployment Instructions

### 1. Prerequisites
- **Python 3.10+**
- **MySQL Server 8.0+**

### 2. Configure MySQL Database
Log into your MySQL instance and create the database:
```sql
CREATE DATABASE examshield_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 3. Install Python Dependencies
Open your terminal in the `backend/` directory and run:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 4. Configure Environment Variables
Create a `.env` file in the `backend/` directory (or set them in your environment):
```env
DATABASE_URL=mysql+pymysql://root:yourpassword@localhost:3306/examshield_db
SECRET_KEY=your_super_secret_jwt_key_here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
OPENAI_API_KEY=your_openai_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here
```
*(If no `.env` is provided, `database.py` defaults to `mysql+pymysql://root:root@localhost:3306/examshield_db` or a fallback SQLite database if MySQL is unreachable for easy local testing).*

### 5. Run the FastAPI Server
Start the development server with Uvicorn:
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 6. Explore Interactive API Documentation
Once the server is running, navigate to:
- **Swagger UI**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **ReDoc**: [http://localhost:8000/redoc](http://localhost:8000/redoc)

*(On initial startup, `main.py` will automatically execute migrations, create all MySQL tables, and populate sample initial data for Admin, Teacher, and Student roles).*

---

## 📖 Complete API Documentation

### Authentication Endpoints
- `POST /api/auth/login`: Authenticate user with `username` (email) and `password`. Returns JWT `access_token` and user object.
- `POST /api/auth/seed`: Manually trigger database seeding with sample users and student records.

### Admin Module (`/api/admin`) - Requires `admin` JWT Role
- `GET /api/admin/dashboard`: Fetch core university metrics, attendance trends, and recent activity.
- `GET /api/admin/students`: Get paginated list of students with search and department filtering.
- `POST /api/admin/students`: Create a new student profile.
- `PUT /api/admin/students/{id}`: Update student details, fee payment status, and backlogs.
- `DELETE /api/admin/students/{id}`: Soft delete student record.
- `GET /api/admin/teachers`: List all registered faculty members.
- `POST /api/admin/teachers`: Create a new teacher profile.
- `GET /api/admin/exams`: List examination schedules.
- `POST /api/admin/exams`: Schedule a new examination.
- `POST /api/admin/marks/upload`: Batch upload internal and assignment marks.
- `POST /api/admin/eligibility/verify-all`: Execute batch verification and calculate AI risk scores for all students.
- `POST /api/admin/halltickets/generate-all`: Generate hall ticket numbers and assign seat numbers for all eligible students.
- `GET /api/admin/backlogs`: Retrieve students with active backlogs.
- `GET /api/admin/fees`: Retrieve fee payment statistics and pending dues.
- `POST /api/admin/notifications`: Broadcast announcements to specific user roles.
- `GET /api/admin/analytics`: Fetch data for Recharts analytics dashboard.
- `GET /api/admin/reports/export`: Download examination, marks, or attendance report in PDF or Excel format.

### Teacher Module (`/api/teacher`) - Requires `teacher` JWT Role
- `GET /api/teacher/dashboard`: Retrieve assigned subjects, student stats, and attendance overview.
- `GET /api/teacher/attendance`: Retrieve class roll for marking attendance.
- `POST /api/teacher/attendance`: Submit or update student attendance records.
- `GET /api/teacher/marks`: Retrieve student list for internal marks entry.
- `POST /api/teacher/marks`: Submit internal and assignment marks.
- `GET /api/teacher/students`: Monitor student progress, attendance percentages, and eligibility status.
- `POST /api/teacher/face-verify`: Biometric live face capture verification for exam entry.

### Student Module (`/api/student`) - Requires `student` JWT Role
- `GET /api/student/dashboard`: Retrieve student academic overview, next exam, and notifications.
- `GET /api/student/profile`: Retrieve personal student details.
- `PUT /api/student/profile`: Update contact number, email, or section.
- `GET /api/student/eligibility`: View 5-criteria eligibility breakdown, AI pass probability, and risk score.
- `GET /api/student/hallticket/download`: Generate and download official PDF hall ticket (restricted to eligible students).
- `GET /api/student/exams`: Retrieve personalized upcoming exam timetable.
- `POST /api/student/face-verify`: Self-verify identity via biometric face match.
- `GET /api/student/notifications`: Retrieve student-targeted notifications.
- `POST /api/student/chatbot`: Interact with ExamShield AI Assistant for intelligent Q&A.

### Public Module (`/api/public`) - Open Access
- `GET /api/public/verify-hallticket/{hall_ticket_no}`: Verify hall ticket authenticity via QR code scan or manual entry.
