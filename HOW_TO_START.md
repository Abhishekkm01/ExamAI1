# 🚀 How to Start ExamShield AI with MySQL (No Mock Data)

This is a clean, mock-data-free setup. Everything you see in the UI comes from your MySQL server.

## Step 1: Create the MySQL database & tables

Open MySQL (Workbench, phpMyAdmin, or command line) and run the schema file:

```bash
mysql -u root -p < backend/examshield_schema.sql
```

This creates 10 tables and 2 helper views, all in a new database called `examshield_db`.

Verify:
```sql
USE examshield_db;
SHOW TABLES;
-- Should list 10 tables (users, students, teachers, exams, attendance, internal_marks, hall_tickets, notifications, chatbot_logs, eligibility_predictions)
```

## Step 2: Configure backend connection

```bash
cd backend
copy .env.example .env       # Windows
# or
cp .env.example .env         # macOS / Linux
```

Edit `backend/.env` and set your MySQL password:
```env
DATABASE_URL=mysql+pymysql://root:YOUR_PASSWORD@localhost:3306/examshield_db
SECRET_KEY=any-long-random-string-for-jwt
```

## Step 3: Install backend dependencies

```bash
cd backend
python -m venv venv
# Activate:
venv\Scripts\activate        # Windows
source venv/bin/activate     # macOS/Linux
pip install -r requirements.txt
```

## Step 4: Test MySQL connection

```bash
python test_mysql.py
```

You should see: `✓ Connected to MySQL. Server version: 8.0.x`

## Step 5: Start the backend

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

You should see in the console:
```
✓ Database tables verified
INFO:     Uvicorn running on http://0.0.0.0:8000
```

## Step 6: Start the frontend

In a new terminal, from the project root:
```bash
npm install
npm run dev
```

Open http://localhost:5173

## Step 7: Bootstrap your first admin account

The database is empty. Visit http://localhost:5173/setup to create your first admin.

OR go to the login page and click "First time? Set up your admin account →"

You'll be asked to enter:
- Name
- Email
- Password

After that, you'll be logged in as the admin.

## Step 8: Add your data

From the admin dashboard, you can add:
- **Teachers** — name, email, employee ID, department, subjects
- **Students** — full academic profile (roll no, attendance, marks, fees, backlogs)
- **Exams** — schedule with subject, date, time, room

Everything is saved to MySQL.

## Step 9: Add more admins / teachers / students

You can also call these API endpoints directly:

```bash
# Add a teacher
curl -X POST http://localhost:8000/api/auth/setup-teacher \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email":"prof@univ.edu","name":"Prof X","emp_id":"TCH005","department":"Computer Science","assigned_subjects":"CS301"}'

# Add a student
curl -X POST http://localhost:8000/api/auth/setup-student \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@univ.edu","name":"Alice","roll_no":"CS21B099","department":"Computer Science","semester":5,"attendance_percentage":85,"internal_marks":32,"fee_paid":true}'
```

## 📊 Verify data in MySQL

```sql
USE examshield_db;
SELECT COUNT(*) AS total_students FROM students;
SELECT roll_no, email, attendance_percentage, is_eligible FROM v_student_full;
SELECT * FROM teachers;
SELECT * FROM exams;
```

## ❌ Reset everything (start fresh)

```sql
DROP DATABASE examshield_db;
```
Then re-run the schema file.

## 🆘 Troubleshooting

| Issue | Fix |
|-------|-----|
| "Access denied for user" | Wrong MySQL password in `backend/.env` |
| "Unknown database 'examshield_db'" | Run the schema file first |
| Login page shows "Offline mode" | Backend not running on port 8000 — check `backend.log` |
| Setup page says "Admin already exists" | Use the login page instead |
| Forgot admin password | Run: `DELETE FROM users WHERE email='your@email.com';` and create again |
