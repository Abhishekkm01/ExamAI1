-- ============================================================
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
(1,  'admin@examshield.ai', '$2b$12$FcWEVSgLnsKwqTC8Ne1pVuUuvNCafF9NHOaRG0ma/BJbs6fLlIIj6', 'Dr. Arjun Mehta', 'admin', 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin-arjun&backgroundColor=b6e3f4'),
(2,  'teacher@examshield.ai', '$2b$12$pFwpZGjuZhxZL74dmYo6d.vzba/ekl38TIv1CRbIVm0Jer5rKe4XW', 'Prof. Sneha Rao', 'teacher', 'https://api.dicebear.com/7.x/avataaars/svg?seed=sneha&backgroundColor=c0aede'),
(3,  'student@examshield.ai', '$2b$12$NIc/TbkbUoaLvWSq.XtZQuxRFqMtbKE0Asp9qKIbzivLgun9DS/JK', 'Rahul Verma', 'student', 'https://api.dicebear.com/7.x/avataaars/svg?seed=rahul&backgroundColor=d1d4f9'),
(4,  'ramesh.k@univ.edu', '$2b$12$pFwpZGjuZhxZL74dmYo6d.vzba/ekl38TIv1CRbIVm0Jer5rKe4XW', 'Dr. Ramesh Kumar', 'teacher', 'https://api.dicebear.com/7.x/avataaars/svg?seed=ramesh&backgroundColor=ffd5dc'),
(5,  'lakshmi.n@univ.edu', '$2b$12$pFwpZGjuZhxZL74dmYo6d.vzba/ekl38TIv1CRbIVm0Jer5rKe4XW', 'Prof. Lakshmi Natarajan', 'teacher', 'https://api.dicebear.com/7.x/avataaars/svg?seed=lakshmi&backgroundColor=ffdfbf'),
(6,  'suresh.p@univ.edu', '$2b$12$pFwpZGjuZhxZL74dmYo6d.vzba/ekl38TIv1CRbIVm0Jer5rKe4XW', 'Dr. Suresh Patil', 'teacher', 'https://api.dicebear.com/7.x/avataaars/svg?seed=suresh&backgroundColor=b6e3f4'),
(7,  'ananya.i@univ.edu', '$2b$12$NIc/TbkbUoaLvWSq.XtZQuxRFqMtbKE0Asp9qKIbzivLgun9DS/JK', 'Ananya Iyer', 'student', 'https://api.dicebear.com/7.x/avataaars/svg?seed=ananya&backgroundColor=c0aede'),
(8,  'karthik.n@univ.edu', '$2b$12$NIc/TbkbUoaLvWSq.XtZQuxRFqMtbKE0Asp9qKIbzivLgun9DS/JK', 'Karthik Nair', 'student', 'https://api.dicebear.com/7.x/avataaars/svg?seed=karthik&backgroundColor=d1d4f9'),
(9,  'priya.s@univ.edu', '$2b$12$NIc/TbkbUoaLvWSq.XtZQuxRFqMtbKE0Asp9qKIbzivLgun9DS/JK', 'Priya Sharma', 'student', 'https://api.dicebear.com/7.x/avataaars/svg?seed=priya&backgroundColor=ffd5dc'),
(10,  'vikram.d@univ.edu', '$2b$12$NIc/TbkbUoaLvWSq.XtZQuxRFqMtbKE0Asp9qKIbzivLgun9DS/JK', 'Vikram Desai', 'student', 'https://api.dicebear.com/7.x/avataaars/svg?seed=vikram&backgroundColor=ffdfbf'),
(11,  'meera.p@univ.edu', '$2b$12$NIc/TbkbUoaLvWSq.XtZQuxRFqMtbKE0Asp9qKIbzivLgun9DS/JK', 'Meera Pillai', 'student', 'https://api.dicebear.com/7.x/avataaars/svg?seed=meera&backgroundColor=b6e3f4'),
(12,  'arjun.k@univ.edu', '$2b$12$NIc/TbkbUoaLvWSq.XtZQuxRFqMtbKE0Asp9qKIbzivLgun9DS/JK', 'Arjun Kapoor', 'student', 'https://api.dicebear.com/7.x/avataaars/svg?seed=arjun&backgroundColor=c0aede'),
(13,  'divya.r@univ.edu', '$2b$12$NIc/TbkbUoaLvWSq.XtZQuxRFqMtbKE0Asp9qKIbzivLgun9DS/JK', 'Divya Reddy', 'student', 'https://api.dicebear.com/7.x/avataaars/svg?seed=divya&backgroundColor=d1d4f9'),
(14,  'rohan.s@univ.edu', '$2b$12$NIc/TbkbUoaLvWSq.XtZQuxRFqMtbKE0Asp9qKIbzivLgun9DS/JK', 'Rohan Singh', 'student', 'https://api.dicebear.com/7.x/avataaars/svg?seed=rohan&backgroundColor=ffd5dc'),
(15,  'ishita.b@univ.edu', '$2b$12$NIc/TbkbUoaLvWSq.XtZQuxRFqMtbKE0Asp9qKIbzivLgun9DS/JK', 'Ishita Banerjee', 'student', 'https://api.dicebear.com/7.x/avataaars/svg?seed=ishita&backgroundColor=ffdfbf');

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
(3, 'CS21B001', '+91 98765 43210', 'Computer Science', 5, 'A', 'https://api.dicebear.com/7.x/avataaars/svg?seed=001', 82, 34, 8, 8.4, 0, 1, 45000, '2026-09-30', 1, 100, 15),
(7, 'CS21B002', '+91 98765 43211', 'Computer Science', 5, 'A', 'https://api.dicebear.com/7.x/avataaars/svg?seed=002', 91, 37, 9, 9.1, 0, 1, 45000, '2026-09-30', 1, 100, 8),
(8, 'CS21B003', '+91 98765 43212', 'Computer Science', 5, 'B', 'https://api.dicebear.com/7.x/avataaars/svg?seed=003', 68, 28, 6, 6.2, 2, 0, 45000, '2026-09-15', 0, 20, 75),
(9, 'CS21B004', '+91 98765 43213', 'Computer Science', 5, 'B', 'https://api.dicebear.com/7.x/avataaars/svg?seed=004', 76, 31, 7, 7.0, 0, 1, 45000, '2026-09-30', 1, 100, 22),
(10, 'EC21B001', '+91 98765 43214', 'Electronics', 5, 'A', 'https://api.dicebear.com/7.x/avataaars/svg?seed=ec21b001', 88, 35, 8, 8.0, 0, 1, 47000, '2026-09-30', 1, 100, 12),
(11, 'EC21B002', '+91 98765 43215', 'Electronics', 5, 'A', 'https://api.dicebear.com/7.x/avataaars/svg?seed=ec21b002', 74, 29, 6, 6.8, 1, 0, 47000, '2026-09-20', 0, 40, 65),
(12, 'ME21B001', '+91 98765 43216', 'Mechanical', 5, 'A', 'https://api.dicebear.com/7.x/avataaars/svg?seed=me21b001', 80, 32, 7, 7.6, 0, 1, 44000, '2026-09-30', 1, 100, 18),
(13, 'ME21B002', '+91 98765 43217', 'Mechanical', 5, 'B', 'https://api.dicebear.com/7.x/avataaars/svg?seed=me21b002', 95, 38, 9, 9.4, 0, 1, 44000, '2026-09-30', 1, 100, 5),
(14, 'CE21B001', '+91 98765 43218', 'Civil', 5, 'A', 'https://api.dicebear.com/7.x/avataaars/svg?seed=ce21b001', 62, 22, 5, 5.4, 3, 0, 43000, '2026-09-10', 0, 0, 88),
(15, 'CE21B002', '+91 98765 43219', 'Civil', 5, 'A', 'https://api.dicebear.com/7.x/avataaars/svg?seed=ce21b002', 86, 33, 8, 7.9, 0, 1, 43000, '2026-09-30', 1, 100, 14);

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
