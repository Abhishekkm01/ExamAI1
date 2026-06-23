-- ExamShield AI - MySQL Setup Script
-- Run this once in your MySQL command-line client to create the database.
--   mysql -u root -p < setup_mysql.sql
-- Or paste the line below into MySQL Workbench / phpMyAdmin.

CREATE DATABASE IF NOT EXISTS examshield_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- After running this, edit backend\.env and set:
--   DATABASE_URL=mysql+pymysql://root:YOUR_PASSWORD@localhost:3306/examshield_db

SHOW DATABASES LIKE 'examshield_db';
