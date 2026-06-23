# ExamAI1
ExamAI smart hall ticket and exam system

# 🎓 ExamShield AI – Full Stack with MySQL (No Mock Data)

A complete, production-ready **Intelligent Hall Ticket Generation and Student Authentication System** with:
- ⚛️ **React + Vite + Tailwind** frontend
- 🐍 **Python FastAPI** backend
- 🗄️ **MySQL** database (uses local SQLite only as a development fallback if MySQL isn't running)

> Everything you see in the UI comes from your MySQL server. No hard-coded mock data is shipped in the React app.

---

## 🛠️ One-Time MySQL Setup

### 1. Create the database & tables
Open MySQL (Workbench, phpMyAdmin, or command line) and run the schema file:

```bash
mysql -u root -p < backend/examshield_schema.sql
```

This creates a new `examshield_db` database with all 10 tables (users, students, teachers, exams, attendance, internal_marks, hall_tickets, notifications, chatbot_logs, eligibility_predictions) and 2 helper views.

### 2. Configure the backend
```bash
cd backend
cp .env.example .env       # macOS / Linux
# or
copy .env.example .env     # Windows
```

Edit `backend/.env` and set your MySQL password:
```env
DATABASE_URL=mysql+pymysql://root:YOUR_PASSWORD@localhost:3306/examshield_db
SECRET_KEY=any-long-random-string-for-jwt
```

### 3. Test the connection
```bash
cd backend
python -m venv venv
source venv/bin/activate     # macOS/Linux
# or
venv\Scripts\activate        # Windows
pip install -r requirements.txt
python test_mysql.py
```

You should see: `✓ Connected to MySQL. Server version: 8.0.x`

---

## 🚀 Run the App

### macOS / Linux
```bash
./start.sh
```

### Windows
```cmd
start.bat
```

This will:
1. Create a Python venv (if not present)
2. Install dependencies
3. Test your MySQL connection (falls back to SQLite if MySQL is unreachable)
4. Start the FastAPI backend on http://localhost:8000
5. Start the React frontend on http://localhost:5173

---

## 🌐 First-Time App Setup

1. **Open http://localhost:5173** — you'll see the login page.
2. **Click "First time? Set up your admin account →"** (or visit http://localhost:5173/setup)
3. Enter your name, email, and password.
4. You're now logged in as the administrator.
5. From the admin dashboard, use the navigation to add:
   - **Teachers** (name, email, employee ID, department, subjects)
   - **Students** (full academic profile, fee status, etc.)
   - **Exams** (subject, date, time, room)
   - **Notifications** (announcements)

All data is saved to MySQL and reflected immediately in the UI.

---

## 📁 Project Structure

```
.
├── src/                  # React frontend
│   ├── pages/            # Admin / Teacher / Student pages
│   ├── components/       # Layout, common UI
│   ├── contexts/         # Auth, Theme, Notifications
│   ├── data/             # api.ts (FastAPI client), apiData.ts (data layer)
│   └── App.tsx           # Router with /setup route
│
├── backend/              # Python FastAPI backend
│   ├── main.py           # FastAPI entry point
│   ├── database.py       # SQLAlchemy engine
│   ├── models.py         # ORM models (must match the SQL schema)
│   ├── auth.py           # JWT + bcrypt
│   ├── examshield_schema.sql  # ★ The full MySQL schema (10 tables + 2 views)
│   ├── setup_mysql.sql   # Helper: just creates the database
│   ├── test_mysql.py     # Connectivity test
│   ├── routers/          # API endpoints
│   └── ai_modules/       # ML, chatbot, face recognition
│
├── start.sh              # macOS / Linux one-click start
├── start.bat             # Windows one-click start
├── HOW_TO_START.md       # Step-by-step guide
└── package.json          # Frontend dependencies
```

---

## 📖 Key API Endpoints

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `POST /api/auth/login` | public | Login (returns JWT) |
| `POST /api/auth/bootstrap-admin` | public | Create the very first admin (only works when no admin exists) |
| `POST /api/auth/setup-teacher` | admin | Add a teacher |
| `POST /api/auth/setup-student` | admin | Add a student |
| `POST /api/auth/setup-exam` | admin | Schedule an exam |
| `GET  /api/admin/students` | admin | List students |
| `GET  /api/admin/dashboard` | admin | Dashboard metrics |
| `GET  /api/student/dashboard` | student | Student dashboard |
| `GET  /api/student/hallticket` | student | Get hall ticket (if eligible) |
| `POST /api/student/chatbot` | student | AI assistant |
| `GET  /api/public/verify-hallticket/{ht_no}` | public | QR verification |

Full interactive docs: http://localhost:8000/docs

---

## 🆘 Reset / Troubleshooting

**Reset all data** (drops everything):
```sql
DROP DATABASE examshield_db;
```
Then re-run `backend/examshield_schema.sql`.

**If the backend can't reach MySQL** — the app falls back to SQLite automatically, and the login page shows "Offline mode". Edit `backend/.env` to fix the MySQL credentials and restart the backend.

**If you forgot your admin password** — connect to MySQL and:
```sql
DELETE FROM users WHERE role='admin' AND email='your@email.com';
```
Then visit `/setup` again to create a new admin.
