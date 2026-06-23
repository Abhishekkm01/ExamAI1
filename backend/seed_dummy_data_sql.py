"""
Generates a real seed_dummy_data.sql file with valid bcrypt password hashes.

Run this once to create seed_dummy_data.sql that you can then execute with:
    mysql -u root -p examshield_db < seed_dummy_data.sql

It writes the file in the same directory as this script.
"""

import os
from dotenv import load_dotenv
from passlib.hash import bcrypt

load_dotenv()


def hash_pw(p: str) -> str:
    return bcrypt.hash(p)


def build_sql() -> str:
    h_admin = hash_pw("admin123")
    h_teacher = hash_pw("teacher123")
    h_student = hash_pw("student123")

    # Helper to make all 15 users with the right hashed password.
    users = [
        (1,  'admin@examshield.ai',   h_admin,   'Dr. Arjun Mehta',         'admin',   'admin-arjun', 'b6e3f4'),
        (2,  'teacher@examshield.ai', h_teacher, 'Prof. Sneha Rao',         'teacher', 'sneha',      'c0aede'),
        (3,  'student@examshield.ai', h_student, 'Rahul Verma',            'student', 'rahul',      'd1d4f9'),
        (4,  'ramesh.k@univ.edu',     h_teacher, 'Dr. Ramesh Kumar',        'teacher', 'ramesh',     'ffd5dc'),
        (5,  'lakshmi.n@univ.edu',    h_teacher, 'Prof. Lakshmi Natarajan', 'teacher', 'lakshmi',    'ffdfbf'),
        (6,  'suresh.p@univ.edu',     h_teacher, 'Dr. Suresh Patil',        'teacher', 'suresh',     'b6e3f4'),
        (7,  'ananya.i@univ.edu',     h_student, 'Ananya Iyer',            'student', 'ananya',     'c0aede'),
        (8,  'karthik.n@univ.edu',    h_student, 'Karthik Nair',           'student', 'karthik',    'd1d4f9'),
        (9,  'priya.s@univ.edu',      h_student, 'Priya Sharma',           'student', 'priya',      'ffd5dc'),
        (10, 'vikram.d@univ.edu',     h_student, 'Vikram Desai',           'student', 'vikram',     'ffdfbf'),
        (11, 'meera.p@univ.edu',      h_student, 'Meera Pillai',           'student', 'meera',      'b6e3f4'),
        (12, 'arjun.k@univ.edu',      h_student, 'Arjun Kapoor',           'student', 'arjun',      'c0aede'),
        (13, 'divya.r@univ.edu',      h_student, 'Divya Reddy',            'student', 'divya',      'd1d4f9'),
        (14, 'rohan.s@univ.edu',      h_student, 'Rohan Singh',            'student', 'rohan',      'ffd5dc'),
        (15, 'ishita.b@univ.edu',     h_student, 'Ishita Banerjee',        'student', 'ishita',     'ffdfbf'),
    ]

    user_inserts = []
    for uid, email, hpw, name, role, seed, bg in users:
        avatar = f"https://api.dicebear.com/7.x/avataaars/svg?seed={seed}&backgroundColor={bg}"
        user_inserts.append(
            f"({uid},  '{email}', '{hpw}', '{name}', '{role}', '{avatar}')"
        )

    students_data = [
        # (roll, user_id, dept, sec, mobile, att, im, am, sgpa, bl, paid, famt, fdue, eligible, pct, risk)
        ("CS21B001", 3,  'Computer Science', 'A', '+91 98765 43210', 82, 34, 8, 8.4, 0, 1, 45000, '2026-09-30', 1, 100, 15),
        ("CS21B002", 7,  'Computer Science', 'A', '+91 98765 43211', 91, 37, 9, 9.1, 0, 1, 45000, '2026-09-30', 1, 100,  8),
        ("CS21B003", 8,  'Computer Science', 'B', '+91 98765 43212', 68, 28, 6, 6.2, 2, 0, 45000, '2026-09-15', 0,  20, 75),
        ("CS21B004", 9,  'Computer Science', 'B', '+91 98765 43213', 76, 31, 7, 7.0, 0, 1, 45000, '2026-09-30', 1, 100, 22),
        ("EC21B001", 10, 'Electronics',      'A', '+91 98765 43214', 88, 35, 8, 8.0, 0, 1, 47000, '2026-09-30', 1, 100, 12),
        ("EC21B002", 11, 'Electronics',      'A', '+91 98765 43215', 74, 29, 6, 6.8, 1, 0, 47000, '2026-09-20', 0,  40, 65),
        ("ME21B001", 12, 'Mechanical',       'A', '+91 98765 43216', 80, 32, 7, 7.6, 0, 1, 44000, '2026-09-30', 1, 100, 18),
        ("ME21B002", 13, 'Mechanical',       'B', '+91 98765 43217', 95, 38, 9, 9.4, 0, 1, 44000, '2026-09-30', 1, 100,  5),
        ("CE21B001", 14, 'Civil',            'A', '+91 98765 43218', 62, 22, 5, 5.4, 3, 0, 43000, '2026-09-10', 0,   0, 88),
        ("CE21B002", 15, 'Civil',            'A', '+91 98765 43219', 86, 33, 8, 7.9, 0, 1, 43000, '2026-09-30', 1, 100, 14),
    ]
    student_rows = []
    for (roll, uid, dept, sec, mobile, att, im, am, sgpa, bl, paid, famt, fdue, eligible, pct, risk) in students_data:
        photo = f"https://api.dicebear.com/7.x/avataaars/svg?seed={roll.lower().replace('cs21b', '')}"
        student_rows.append(
            f"({uid}, '{roll}', '{mobile}', '{dept}', 5, '{sec}', '{photo}', {att}, {im}, {am}, {sgpa}, {bl}, {paid}, {famt}, '{fdue}', {eligible}, {pct}, {risk})"
        )

    sql = f"""-- ============================================================
-- ExamShield AI - Dummy Data Seeder (Pure SQL, auto-generated)
-- ============================================================
-- Inserts sample data into MySQL with VALID bcrypt password hashes.
-- Run AFTER examshield_schema.sql.
--
-- Usage:
--   mysql -u root -p examshield_db < seed_dummy_data.sql
--
-- Default credentials:
--   admin   : admin@examshield.ai   / admin123
--   teacher : teacher@examshield.ai / teacher123
--   student : student@examshield.ai / student123
-- ============================================================

USE examshield_db;

SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE eligibility_predictions;
TRUNCATE TABLE chatbot_logs;
TRUNCATE TABLE hall_tickets;
TRUNCATE TABLE notifications;
TRUNCATE TABLE internal_marks;
TRUNCATE TABLE attendance;
TRUNCATE TABLE exams;
TRUNCATE TABLE students;
TRUNCATE TABLE teachers;
TRUNCATE TABLE users;
SET FOREIGN_KEY_CHECKS = 1;

-- USERS (15 total)
INSERT INTO users (id, email, hashed_password, name, role, avatar) VALUES
{',\n'.join(user_inserts)};

-- TEACHERS (4)
INSERT INTO teachers (user_id, emp_id, department, photo, assigned_subjects) VALUES
(2, 'TCH001', 'Computer Science', 'https://api.dicebear.com/7.x/avataaars/svg?seed=sneha',   'CS301,CS302'),
(4, 'TCH002', 'Electronics',      'https://api.dicebear.com/7.x/avataaars/svg?seed=ramesh',  'EC301,EC302'),
(5, 'TCH003', 'Mechanical',       'https://api.dicebear.com/7.x/avataaars/svg?seed=lakshmi', 'ME301,ME302'),
(6, 'TCH004', 'Civil',            'https://api.dicebear.com/7.x/avataaars/svg?seed=suresh',  'CE301,CE302');

-- STUDENTS (10)
INSERT INTO students
  (user_id, roll_no, mobile, department, semester, section, photo, attendance_percentage, internal_marks, assignment_marks, previous_result, backlogs, fee_paid, fee_amount, fee_due_date, is_eligible, eligibility_percentage, ai_risk_score)
VALUES
{',\n'.join(student_rows)};

-- EXAMS (6)
INSERT INTO exams (subject_code, subject_name, department, semester, exam_date, exam_time, duration, room, total_marks) VALUES
('CS301', 'Data Structures & Algorithms',   'Computer Science', 5, '2026-11-10', '10:00 AM', '3 hours', 'Hall A-101', 100),
('CS302', 'Database Management Systems',    'Computer Science', 5, '2026-11-13', '02:00 PM', '3 hours', 'Hall A-102', 100),
('CS303', 'Operating Systems',              'Computer Science', 5, '2026-11-16', '10:00 AM', '3 hours', 'Hall A-103', 100),
('EC301', 'Digital Signal Processing',      'Electronics',      5, '2026-11-11', '10:00 AM', '3 hours', 'Hall B-201', 100),
('ME301', 'Thermodynamics II',              'Mechanical',       5, '2026-11-12', '10:00 AM', '3 hours', 'Hall C-301', 100),
('CE301', 'Structural Analysis',            'Civil',            5, '2026-11-14', '10:00 AM', '3 hours', 'Hall D-101', 100);

-- NOTIFICATIONS (4)
INSERT INTO notifications (title, message, audience) VALUES
('Hall Tickets Released',   'Semester V end-semester hall tickets are now available for download.', 'students'),
('Exam Schedule Published', 'Final exam timetable for Nov 2026 has been published.',               'all'),
('Fee Payment Reminder',    'Students with pending fees must clear dues before Nov 5.',          'students'),
('Marks Upload Deadline',   'Teachers must upload internal and assignment marks by Oct 30.',    'teachers');

-- VERIFICATION
SELECT 'Users:'           AS info, COUNT(*) AS count FROM users
UNION ALL SELECT 'Students:',    COUNT(*) FROM students
UNION ALL SELECT 'Teachers:',    COUNT(*) FROM teachers
UNION ALL SELECT 'Exams:',       COUNT(*) FROM exams
UNION ALL SELECT 'Notifications:', COUNT(*) FROM notifications;
"""
    return sql


if __name__ == "__main__":
    out = os.path.join(os.path.dirname(__file__), "seed_dummy_data.sql")
    with open(out, "w", encoding="utf-8") as f:
        f.write(build_sql())
    print(f"✓ Wrote {out}")
    print("  You can now run:  mysql -u root -p examshield_db < seed_dummy_data.sql")
