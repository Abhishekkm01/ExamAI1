# ExamShield AI – Django REST Backend & MySQL Schema

This directory contains the production-ready Django REST Framework backend for **ExamShield AI – Intelligent Hall Ticket Generation and Student Authentication System**.

## 🚀 Key Highlights & Architecture

- **Framework**: Django REST Framework with Django 5.0
- **ORM & Database**: Django ORM connected to MySQL via `pymysql`. Includes complete schema with Foreign Keys, Indexes, Audit fields (`created_at`, `updated_at`), and Soft Delete (`is_deleted`).
- **Security & Authentication**: JWT-based role authentication (`Admin`, `Teacher`, `Student`) with password hashing via `bcrypt`.
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
├── manage.py              # Django management script
├── .env.example           # Environment variables template
├── examshield/            # Django project settings
│   ├── __init__.py
│   ├── settings.py        # Django settings with environment variables
│   ├── urls.py            # Root URL configuration
│   └── wsgi.py            # WSGI configuration
├── api/                   # Main Django app
│   ├── models.py          # Django models (User, Student, Teacher, Exam, HallTicket, etc.)
│   ├── serializers.py     # DRF serializers
│   ├── views_auth.py      # Authentication views (login, bootstrap, setup endpoints)
│   ├── views_admin.py     # Admin-specific views
│   ├── views_teacher.py   # Teacher-specific views
│   ├── views_student.py   # Student-specific views
│   ├── views_public.py    # Public access views
│   ├── views_seating.py   # Seating arrangement views
│   ├── urls.py            # API URL routing
│   ├── middleware.py      # JWT authentication middleware
│   ├── seating_service.py # Seating arrangement logic
│   └── migrations/        # Database migrations
└── ai_modules/
    ├── eligibility_model.py # Scikit-Learn Random Forest prediction engine
    ├── chatbot.py           # OpenAI / Gemini API chatbot engine
    └── face_recognition_module.py # OpenCV face matching engine
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
# Database
DB_NAME=examshield_db
DB_USER=root
DB_PASSWORD=yourpassword
DB_HOST=localhost
DB_PORT=3306

# Django Security
SECRET_KEY=replace-with-a-long-random-secret-key-for-django
DEBUG=True

# AI Chatbot (optional)
OPENAI_API_KEY=
GEMINI_API_KEY=
```

### 5. Run Django Migrations
Apply database migrations to create all tables:
```bash
python manage.py migrate
```

### 6. Create Superuser (Admin Account)
Create the initial admin account:
```bash
python manage.py createsuperuser
```
Or use the bootstrap endpoint via API:
```bash
POST /api/auth/bootstrap-admin
{
  "email": "admin@examshield.ai",
  "password": "admin123"
}
```

### 7. Run the Django Development Server
Start the development server:
```bash
python manage.py runserver
```

The API will be available at `http://localhost:8000/api/`
The Django admin panel will be available at `http://localhost:8000/admin`

---

## 📖 Complete API Documentation

### Authentication Endpoints
- `POST /api/auth/login`: Authenticate user with `email` and `password`. Returns JWT `access_token` and user object.
- `POST /api/auth/bootstrap-admin`: Create the first admin account (only works if no admin exists).
- `POST /api/auth/setup-teacher`: Admin-only endpoint to create a new teacher account.
- `POST /api/auth/setup-student`: Admin-only endpoint to create a new student account.
- `POST /api/auth/setup-exam`: Admin-only endpoint to create a new exam.
- `POST /api/auth/send-notification`: Admin-only endpoint to send notifications.

### Admin Module (`/api/admin`) - Requires `admin` JWT Role
- `GET /api/admin/dashboard`: Fetch core university metrics, attendance trends, and recent activity.
- `GET /api/admin/students`: Get paginated list of students with search and department filtering.
- `GET /api/admin/students/{sid}`: Get specific student details.
- `POST /api/admin/students/create`: Create a new student profile.
- `PUT /api/admin/students/{sid}/update`: Update student details, fee payment status, and backlogs.
- `DELETE /api/admin/students/{sid}/delete`: Soft delete student record.
- `GET /api/admin/teachers`: List all registered faculty members.
- `GET /api/admin/exams`: List examination schedules.
- `POST /api/admin/exams/create`: Schedule a new examination.
- `POST /api/admin/eligibility/verify-all`: Execute batch verification and calculate AI risk scores for all students.
- `POST /api/admin/halltickets/generate-all`: Generate hall ticket numbers and assign seat numbers for all eligible students.
- `GET /api/admin/halltickets`: List all hall tickets.
- `GET /api/admin/backlogs`: Retrieve students with active backlogs.
- `GET /api/admin/fees`: Retrieve fee payment statistics and pending dues.
- `PUT /api/admin/fees/{sid}/mark-paid`: Mark student fee as paid.
- `POST /api/admin/notifications/create`: Broadcast announcements to specific user roles.
- `GET /api/admin/notifications`: List all notifications.
- `GET /api/admin/analytics`: Fetch data for Recharts analytics dashboard.
- `GET /api/admin/reports/export`: Download examination, marks, or attendance report in PDF or Excel format.

### Teacher Module (`/api/teacher`) - Requires `teacher` JWT Role
- `GET /api/teacher/dashboard`: Retrieve assigned subjects, student stats, and attendance overview.
- `GET /api/teacher/attendance`: Retrieve class roll for marking attendance.
- `POST /api/teacher/attendance/mark`: Submit or update student attendance records.
- `GET /api/teacher/marks`: Retrieve student list for internal marks entry.
- `POST /api/teacher/marks/update`: Submit internal and assignment marks.
- `GET /api/teacher/students`: Monitor student progress, attendance percentages, and eligibility status.
- `POST /api/teacher/face-verify`: Biometric live face capture verification for exam entry.

### Student Module (`/api/student`) - Requires `student` JWT Role
- `GET /api/student/dashboard`: Retrieve student academic overview, next exam, and notifications.
- `GET /api/student/profile`: Retrieve personal student details.
- `PUT /api/student/profile/update`: Update contact number, email, or section.
- `GET /api/student/eligibility`: View eligibility breakdown, AI pass probability, and risk score.
- `GET /api/student/hallticket`: Generate and retrieve hall ticket (restricted to eligible students).
- `GET /api/student/hallticket/download`: Download hall ticket as PDF.
- `GET /api/student/exams`: Retrieve personalized upcoming exam timetable.
- `POST /api/student/face-verify`: Self-verify identity via biometric face match.
- `GET /api/student/notifications`: Retrieve student-targeted notifications.
- `POST /api/student/chatbot`: Interact with ExamShield AI Assistant for intelligent Q&A.

### Public Module (`/api/public`) - Open Access
- `GET /api/public/verify-hallticket/{ht_no}`: Verify hall ticket authenticity via QR code scan or manual entry.
- `GET /api/public/meta`: Get system metadata.

---

## 🔐 Authentication

All API endpoints (except public endpoints) require JWT authentication. Include the JWT token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

The token is obtained by logging in via `/api/auth/login` and is valid for 24 hours by default.

---

## 🤖 AI Features

### Eligibility Prediction
The system uses a Random Forest classifier to predict student exam eligibility based on:
- Attendance percentage
- Internal marks
- Previous SGPA
- Backlog count
- Fee payment status

### AI Chatbot
The integrated chatbot can answer questions about:
- Eligibility criteria
- Attendance requirements
- Exam schedules
- Fee payment status
- Hall ticket generation

### Face Recognition
Biometric verification for exam entry using OpenCV and face_recognition library.

---

## 📝 Database Schema

The database includes the following main models:
- **User**: Base user model with role (admin, teacher, student)
- **Student**: Extended student profile with academic details
- **Teacher**: Extended teacher profile with subject assignments
- **Exam**: Examination schedule and details
- **HallTicket**: Generated hall tickets with seat assignments
- **SeatingRoom**: Physical exam room configuration
- **SeatingArrangement**: Student seat assignments per exam
- **Attendance**: Student attendance records
- **InternalMarks**: Student internal and assignment marks
- **Notification**: System announcements

---

## 🚀 Deployment

For production deployment:
1. Set `DEBUG=False` in `.env`
2. Use a strong `SECRET_KEY`
3. Configure MySQL with proper credentials
4. Use a production WSGI server like Gunicorn or uWSGI
5. Set up proper CORS origins
6. Use HTTPS for all API calls
7. Configure static files serving

---

## 📄 License

This project is part of ExamShield AI - Intelligent Hall Ticket Generation and Student Authentication System.
