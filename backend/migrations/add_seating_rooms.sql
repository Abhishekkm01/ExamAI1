-- Migration: add exam_rooms, seating_assignments, and room_id on hall_tickets
-- Run this on existing examshield_db databases

CREATE TABLE IF NOT EXISTS exam_rooms (
    id          INT             AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(100)    NOT NULL UNIQUE,
    building    VARCHAR(100)    NOT NULL DEFAULT 'Main Block',
    capacity    INT             NOT NULL DEFAULT 60,
    rows        INT             NOT NULL DEFAULT 10,
    cols        INT             NOT NULL DEFAULT 6,
    is_active   BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_room_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS seating_assignments (
    id          INT             AUTO_INCREMENT PRIMARY KEY,
    exam_id     INT             NOT NULL,
    student_id  INT             NOT NULL,
    room_id     INT             NOT NULL,
    seat_label  VARCHAR(50)     NOT NULL,
    row_num     INT             NOT NULL,
    col_num     INT             NOT NULL,
    created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_sa_exam    FOREIGN KEY (exam_id)    REFERENCES exams(id)      ON DELETE CASCADE,
    CONSTRAINT fk_sa_student FOREIGN KEY (student_id)  REFERENCES students(id)   ON DELETE CASCADE,
    CONSTRAINT fk_sa_room    FOREIGN KEY (room_id)      REFERENCES exam_rooms(id) ON DELETE CASCADE,
    UNIQUE KEY uq_sa_exam_student (exam_id, student_id),
    INDEX idx_sa_exam (exam_id),
    INDEX idx_sa_room (room_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add room_id to hall_tickets if missing
SET @col_exists = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'hall_tickets' AND COLUMN_NAME = 'room_id'
);
SET @sql = IF(@col_exists = 0,
    'ALTER TABLE hall_tickets ADD COLUMN room_id INT NULL AFTER exam_id, ADD CONSTRAINT fk_ht_room FOREIGN KEY (room_id) REFERENCES exam_rooms(id) ON DELETE SET NULL',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Seed default exam rooms
INSERT IGNORE INTO exam_rooms (name, building, capacity, rows, cols) VALUES
    ('Hall A-101', 'Main Block', 60, 10, 6),
    ('Hall A-102', 'Main Block', 60, 10, 6),
    ('Hall B-201', 'Science Block', 48, 8, 6),
    ('Hall B-202', 'Science Block', 48, 8, 6),
    ('Hall C-301', 'Engineering Block', 72, 12, 6);
