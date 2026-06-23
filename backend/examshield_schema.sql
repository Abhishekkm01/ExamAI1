-- ============================================================
-- ExamShield AI - Complete MySQL Database Schema
-- ============================================================
-- This file contains ALL tables, indexes, foreign keys, audit
-- fields, and triggers needed by the ExamShield AI backend.
--
-- HOW TO USE:
--   1. Make sure MySQL 8.0+ is running
--   2. From the command line:
--        mysql -u root -p < examshield_schema.sql
--   3. Or open this file in MySQL Workbench and execute
--
-- After running, set DATABASE_URL in backend/.env:
--   DATABASE_URL=mysql+pymysql://root:YOUR_PASSWORD@localhost:3306/examshield_db
-- ============================================================

-- Drop database if it already exists (CAUTION: this deletes all data)
DROP DATABASE IF EXISTS examshield_db;

-- Create the database with full UTF-8 support
CREATE DATABASE examshield_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE examshield_db;

-- ============================================================
-- 1. USERS - Login accounts for admin / teacher / student
-- ============================================================
CREATE TABLE users (
    id              INT             AUTO_INCREMENT PRIMARY KEY,
    email           VARCHAR(255)    NOT NULL UNIQUE,
    hashed_password VARCHAR(255)    NOT NULL,
    name            VARCHAR(255)    NOT NULL,
    role            ENUM('admin','teacher','student') NOT NULL,
    avatar          VARCHAR(512)    NULL,

    -- Audit fields
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    is_deleted      BOOLEAN         NOT NULL DEFAULT FALSE,

    INDEX idx_users_email (email),
    INDEX idx_users_role (role),
    INDEX idx_users_deleted (is_deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 2. STUDENTS - Academic profile
-- ============================================================
CREATE TABLE students (
    id                      INT             AUTO_INCREMENT PRIMARY KEY,
    user_id                 INT             NOT NULL UNIQUE,

    -- Personal & academic info
    roll_no                 VARCHAR(50)     NOT NULL UNIQUE,
    mobile                  VARCHAR(20)     NULL,
    department              VARCHAR(100)    NOT NULL,
    semester                INT             NOT NULL DEFAULT 1,
    section                 VARCHAR(10)     NOT NULL DEFAULT 'A',
    photo                   VARCHAR(512)    NULL,
    face_encoding           TEXT            NULL,   -- JSON or 128-d array

    -- Academic metrics
    attendance_percentage   FLOAT           NOT NULL DEFAULT 0.0,
    internal_marks          FLOAT           NOT NULL DEFAULT 0.0,   -- out of 40
    assignment_marks        FLOAT           NOT NULL DEFAULT 0.0,   -- out of 10
    previous_result         FLOAT           NOT NULL DEFAULT 0.0,   -- SGPA 0..10
    backlogs                INT             NOT NULL DEFAULT 0,

    -- Fee info
    fee_paid                BOOLEAN         NOT NULL DEFAULT FALSE,
    fee_amount              FLOAT           NOT NULL DEFAULT 45000.0,
    fee_due_date            VARCHAR(50)     NULL,

    -- Eligibility (computed by backend)
    is_eligible             BOOLEAN         NOT NULL DEFAULT FALSE,
    eligibility_percentage  FLOAT           NOT NULL DEFAULT 0.0,
    ai_risk_score           FLOAT           NOT NULL DEFAULT 0.0,

    -- Audit fields
    created_at              DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    is_deleted              BOOLEAN         NOT NULL DEFAULT FALSE,

    CONSTRAINT fk_student_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,

    INDEX idx_student_roll (roll_no),
    INDEX idx_student_dept (department),
    INDEX idx_student_sem (semester),
    INDEX idx_student_eligible (is_eligible),
    INDEX idx_student_fee (fee_paid),
    INDEX idx_student_deleted (is_deleted),
    INDEX idx_student_dept_sem (department, semester)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 3. TEACHERS - Faculty profile
-- ============================================================
CREATE TABLE teachers (
    id                  INT             AUTO_INCREMENT PRIMARY KEY,
    user_id             INT             NOT NULL UNIQUE,

    emp_id              VARCHAR(50)     NOT NULL UNIQUE,
    department          VARCHAR(100)    NOT NULL,
    photo               VARCHAR(512)    NULL,
    assigned_subjects   VARCHAR(512)    NULL,   -- comma separated codes, e.g. "CS301,CS302"

    -- Audit fields
    created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    is_deleted          BOOLEAN         NOT NULL DEFAULT FALSE,

    CONSTRAINT fk_teacher_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,

    INDEX idx_teacher_emp (emp_id),
    INDEX idx_teacher_dept (department),
    INDEX idx_teacher_deleted (is_deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 4. EXAMS - Exam schedule
-- ============================================================
CREATE TABLE exams (
    id              INT             AUTO_INCREMENT PRIMARY KEY,
    subject_code    VARCHAR(50)     NOT NULL UNIQUE,
    subject_name    VARCHAR(255)    NOT NULL,
    department      VARCHAR(100)    NOT NULL,
    semester        INT             NOT NULL,
    exam_date       VARCHAR(50)     NOT NULL,    -- ISO date string e.g. "2026-11-10"
    exam_time       VARCHAR(50)     NOT NULL,    -- e.g. "10:00 AM"
    duration        VARCHAR(50)     NOT NULL DEFAULT '3 hours',
    room            VARCHAR(100)    NOT NULL,
    total_marks     INT             NOT NULL DEFAULT 100,

    -- Audit fields
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    is_deleted      BOOLEAN         NOT NULL DEFAULT FALSE,

    INDEX idx_exam_subject (subject_code),
    INDEX idx_exam_dept (department),
    INDEX idx_exam_sem (semester),
    INDEX idx_exam_deleted (is_deleted),
    INDEX idx_exam_dept_sem (department, semester)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 5. ATTENDANCE - Per-class attendance records
-- ============================================================
CREATE TABLE attendance (
    id              INT             AUTO_INCREMENT PRIMARY KEY,
    student_id      INT             NOT NULL,
    subject_code    VARCHAR(50)     NOT NULL,
    record_date     VARCHAR(50)     NOT NULL,
    status          VARCHAR(20)     NOT NULL,    -- "Present" / "Absent"

    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_attendance_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,

    INDEX idx_attendance_student (student_id),
    INDEX idx_attendance_subject (subject_code),
    INDEX idx_attendance_date (record_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 6. INTERNAL_MARKS - Per-subject marks
-- ============================================================
CREATE TABLE internal_marks (
    id                  INT             AUTO_INCREMENT PRIMARY KEY,
    student_id          INT             NOT NULL,
    subject_code        VARCHAR(50)     NOT NULL,
    internal_score      FLOAT           NOT NULL DEFAULT 0.0,   -- out of 40
    assignment_score    FLOAT           NOT NULL DEFAULT 0.0,   -- out of 10

    created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_marks_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,

    INDEX idx_marks_student (student_id),
    INDEX idx_marks_subject (subject_code),
    UNIQUE KEY uq_student_subject (student_id, subject_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 7. HALL_TICKETS - Generated hall tickets
-- ============================================================
CREATE TABLE hall_tickets (
    id                  INT             AUTO_INCREMENT PRIMARY KEY,
    hall_ticket_no      VARCHAR(100)    NOT NULL UNIQUE,
    student_id          INT             NOT NULL UNIQUE,
    exam_id             INT             NOT NULL,
    seat_number         VARCHAR(50)     NOT NULL,
    room                VARCHAR(100)    NOT NULL,
    qr_code_content     TEXT            NOT NULL,
    is_active           BOOLEAN         NOT NULL DEFAULT TRUE,

    created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_ht_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    CONSTRAINT fk_ht_exam    FOREIGN KEY (exam_id)    REFERENCES exams(id)    ON DELETE CASCADE,

    INDEX idx_ht_number (hall_ticket_no),
    INDEX idx_ht_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 8. NOTIFICATIONS - Broadcast announcements
-- ============================================================
CREATE TABLE notifications (
    id          INT             AUTO_INCREMENT PRIMARY KEY,
    title       VARCHAR(255)    NOT NULL,
    message     TEXT            NOT NULL,
    audience    ENUM('all','students','teachers','admin') NOT NULL,
    is_read     BOOLEAN         NOT NULL DEFAULT FALSE,

    created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_notif_audience (audience),
    INDEX idx_notif_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 9. CHATBOT_LOGS - Saved chatbot conversation history
-- ============================================================
CREATE TABLE chatbot_logs (
    id              INT             AUTO_INCREMENT PRIMARY KEY,
    student_id      INT             NOT NULL,
    user_query      TEXT            NOT NULL,
    bot_response    TEXT            NOT NULL,

    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_chatlog_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,

    INDEX idx_chatlog_student (student_id),
    INDEX idx_chatlog_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 10. ELIGIBILITY_PREDICTIONS - AI risk score history
-- ============================================================
CREATE TABLE eligibility_predictions (
    id                      INT             AUTO_INCREMENT PRIMARY KEY,
    student_id              INT             NOT NULL,
    predicted_probability   FLOAT           NOT NULL,    -- 0.0 to 1.0
    risk_score              FLOAT           NOT NULL,    -- 0 to 100
    factors_summary         TEXT            NULL,        -- JSON of input features

    created_at              DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_pred_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,

    INDEX idx_pred_student (student_id),
    INDEX idx_pred_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- VIEWS - Convenience read-only views
-- ============================================================

-- v_student_full: joins users + students for a complete student record
CREATE OR REPLACE VIEW v_student_full AS
SELECT
    s.id              AS student_id,
    u.id              AS user_id,
    u.email,
    u.name,
    s.roll_no,
    s.mobile,
    s.department,
    s.semester,
    s.section,
    s.photo,
    s.attendance_percentage,
    s.internal_marks,
    s.assignment_marks,
    s.previous_result,
    s.backlogs,
    s.fee_paid,
    s.fee_amount,
    s.fee_due_date,
    s.is_eligible,
    s.eligibility_percentage,
    s.ai_risk_score,
    s.created_at,
    s.updated_at
FROM students s
INNER JOIN users u ON u.id = s.user_id AND u.is_deleted = FALSE
WHERE s.is_deleted = FALSE;

-- v_teacher_full: joins users + teachers
CREATE OR REPLACE VIEW v_teacher_full AS
SELECT
    t.id              AS teacher_id,
    u.id              AS user_id,
    u.email,
    u.name,
    t.emp_id,
    t.department,
    t.photo,
    t.assigned_subjects,
    t.created_at
FROM teachers t
INNER JOIN users u ON u.id = t.user_id AND u.is_deleted = FALSE
WHERE t.is_deleted = FALSE;

-- ============================================================
-- VERIFICATION: confirm all tables were created
-- ============================================================
SELECT 'Schema created successfully. Tables:' AS status;
SHOW TABLES;

SELECT 'Total users:' AS info, COUNT(*) AS count FROM users
UNION ALL SELECT 'Total students:', COUNT(*) FROM students
UNION ALL SELECT 'Total teachers:', COUNT(*) FROM teachers
UNION ALL SELECT 'Total exams:', COUNT(*) FROM exams
UNION ALL SELECT 'Total notifications:', COUNT(*) FROM notifications;
