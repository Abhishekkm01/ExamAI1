"""
ExamShield AI - Dummy Data Seeder
=================================
Inserts a complete set of sample data into your MySQL database:
- 1 admin
- 4 teachers
- 10 students (across 4 departments)
- 6 exams
- 4 notifications

Usage:
    python seed_dummy_data.py

Requirements:
    pip install -r requirements.txt   (so SQLAlchemy, passlib, etc. are available)

The script is safe to run multiple times - it skips if admin already exists.
"""

import os
from dotenv import load_dotenv
from sqlalchemy.orm import Session

load_dotenv()
from database import SessionLocal, engine
import models
from auth import get_password_hash


def avatar(seed: str) -> str:
    return f"https://api.dicebear.com/7.x/avataaars/svg?seed={seed}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf"


def compute_eligibility(att, im, bl, paid, sgpa):
    """Same 5-criteria check the API uses."""
    checks = {
        "attendance": att >= 75,
        "internals":  (im / 40) * 100 >= 40,
        "backlogs":   bl == 0,
        "fee":        paid,
        "previous":   sgpa >= 5.0,
    }
    passed = sum(checks.values())
    total = len(checks)
    eligible = passed == total
    pct = round((passed / total) * 100)
    score = min(100, round(
        att * 0.35 +
        ((im / 40) * 100) * 0.25 +
        (sgpa / 10) * 100 * 0.2 +
        (100 if bl == 0 else max(0, 100 - bl * 30)) * 0.2
    ))
    return eligible, pct, 100 - score  # risk = 100 - positive_score


def seed():
    db: Session = SessionLocal()
    try:
        # ---- 1. Check if data already exists ----
        existing = db.query(models.User).filter(models.User.role == models.RoleEnum.admin).first()
        if existing:
            print(f"✗ Admin '{existing.email}' already exists. Skipping seed.")
            print("  To re-seed, run this first:")
            print("    DELETE FROM users WHERE role='admin';")
            print("  (Or drop the whole database and re-run examshield_schema.sql)")
            return

        print("Seeding dummy data into MySQL...\n")

        # ---- 2. Create the admin ----
        admin = models.User(
            email="admin@examshield.ai",
            hashed_password=get_password_hash("admin123"),
            name="Dr. Arjun Mehta",
            role=models.RoleEnum.admin,
            avatar=avatar("admin-arjun"),
        )
        db.add(admin)
        db.commit()
        db.refresh(admin)
        print(f"  ✓ Admin: {admin.email} / admin123")

        # ---- 3. Create teacher users + profiles ----
        teachers_data = [
            # (email, name, seed, emp_id, department, subjects)
            ("teacher@examshield.ai", "Prof. Sneha Rao",          "sneha",   "TCH001", "Computer Science", "CS301,CS302"),
            ("ramesh.k@univ.edu",     "Dr. Ramesh Kumar",         "ramesh",  "TCH002", "Electronics",      "EC301,EC302"),
            ("lakshmi.n@univ.edu",    "Prof. Lakshmi Natarajan",  "lakshmi", "TCH003", "Mechanical",       "ME301,ME302"),
            ("suresh.p@univ.edu",     "Dr. Suresh Patil",         "suresh",  "TCH004", "Civil",            "CE301,CE302"),
        ]
        teacher_users = []
        for email, name, seed, emp_id, dept, subs in teachers_data:
            u = models.User(
                email=email,
                hashed_password=get_password_hash("teacher123"),
                name=name,
                role=models.RoleEnum.teacher,
                avatar=avatar(seed),
            )
            db.add(u); db.commit(); db.refresh(u)
            t = models.Teacher(
                user_id=u.id, emp_id=emp_id, department=dept,
                photo=u.avatar, assigned_subjects=subs,
            )
            db.add(t); db.commit()
            teacher_users.append(u)
            print(f"  ✓ Teacher: {email} / teacher123 ({dept})")

        # ---- 4. Create student users + profiles ----
        # (roll, name, email, seed, dept, section, mobile, attendance, internal, assignment, sgpa, backlogs, fee_paid, fee_amount, fee_due)
        students_data = [
            ("CS21B001", "Rahul Verma",     "student@examshield.ai", "rahul",    "Computer Science", "A", "+91 98765 43210", 82, 34, 8, 8.4, 0, True,  45000, "2026-09-30"),
            ("CS21B002", "Ananya Iyer",     "ananya.i@univ.edu",     "ananya",   "Computer Science", "A", "+91 98765 43211", 91, 37, 9, 9.1, 0, True,  45000, "2026-09-30"),
            ("CS21B003", "Karthik Nair",    "karthik.n@univ.edu",    "karthik",  "Computer Science", "B", "+91 98765 43212", 68, 28, 6, 6.2, 2, False, 45000, "2026-09-15"),
            ("CS21B004", "Priya Sharma",    "priya.s@univ.edu",      "priya",    "Computer Science", "B", "+91 98765 43213", 76, 31, 7, 7.0, 0, True,  45000, "2026-09-30"),
            ("EC21B001", "Vikram Desai",    "vikram.d@univ.edu",     "vikram",   "Electronics",      "A", "+91 98765 43214", 88, 35, 8, 8.0, 0, True,  47000, "2026-09-30"),
            ("EC21B002", "Meera Pillai",    "meera.p@univ.edu",      "meera",    "Electronics",      "A", "+91 98765 43215", 74, 29, 6, 6.8, 1, False, 47000, "2026-09-20"),
            ("ME21B001", "Arjun Kapoor",    "arjun.k@univ.edu",      "arjun",    "Mechanical",       "A", "+91 98765 43216", 80, 32, 7, 7.6, 0, True,  44000, "2026-09-30"),
            ("ME21B002", "Divya Reddy",     "divya.r@univ.edu",      "divya",    "Mechanical",       "B", "+91 98765 43217", 95, 38, 9, 9.4, 0, True,  44000, "2026-09-30"),
            ("CE21B001", "Rohan Singh",     "rohan.s@univ.edu",      "rohan",    "Civil",            "A", "+91 98765 43218", 62, 22, 5, 5.4, 3, False, 43000, "2026-09-10"),
            ("CE21B002", "Ishita Banerjee", "ishita.b@univ.edu",     "ishita",   "Civil",            "A", "+91 98765 43219", 86, 33, 8, 7.9, 0, True,  43000, "2026-09-30"),
        ]
        student_count = 0
        for (roll, name, email, seed, dept, sec, mobile, att, im, am, sgpa, bl, paid, famt, fdue) in students_data:
            u = models.User(
                email=email,
                hashed_password=get_password_hash("student123"),
                name=name,
                role=models.RoleEnum.student,
                avatar=avatar(seed),
            )
            db.add(u); db.commit(); db.refresh(u)

            eligible, pct, risk = compute_eligibility(att, im, bl, paid, sgpa)
            s = models.Student(
                user_id=u.id, roll_no=roll, mobile=mobile, department=dept,
                semester=5, section=sec, photo=u.avatar,
                attendance_percentage=att, internal_marks=im, assignment_marks=am,
                previous_result=sgpa, backlogs=bl, fee_paid=paid,
                fee_amount=famt, fee_due_date=fdue,
                is_eligible=eligible, eligibility_percentage=pct, ai_risk_score=risk,
            )
            db.add(s); db.commit()
            student_count += 1
            status = "ELIGIBLE" if eligible else "NOT ELIGIBLE"
            print(f"  ✓ Student: {email} / student123  ({roll} • {dept} • {status})")

        # ---- 5. Create exams ----
        exams_data = [
            ("CS301", "Data Structures & Algorithms",   "Computer Science", "2026-11-10", "10:00 AM", "Hall A-101"),
            ("CS302", "Database Management Systems",    "Computer Science", "2026-11-13", "02:00 PM", "Hall A-102"),
            ("CS303", "Operating Systems",              "Computer Science", "2026-11-16", "10:00 AM", "Hall A-103"),
            ("EC301", "Digital Signal Processing",      "Electronics",      "2026-11-11", "10:00 AM", "Hall B-201"),
            ("ME301", "Thermodynamics II",              "Mechanical",       "2026-11-12", "10:00 AM", "Hall C-301"),
            ("CE301", "Structural Analysis",            "Civil",            "2026-11-14", "10:00 AM", "Hall D-101"),
        ]
        for code, name, dept, date, time, room in exams_data:
            db.add(models.Exam(
                subject_code=code, subject_name=name, department=dept,
                semester=5, exam_date=date, exam_time=time,
                duration="3 hours", room=room, total_marks=100,
            ))
        db.commit()
        print(f"  ✓ {len(exams_data)} exams scheduled")

        # ---- 6. Create notifications ----
        notifs = [
            ("Hall Tickets Released",          "Semester V end-semester hall tickets are now available for download.", models.AudienceEnum.students),
            ("Exam Schedule Published",        "Final exam timetable for Nov 2026 has been published.",           models.AudienceEnum.all),
            ("Fee Payment Reminder",           "Students with pending fees must clear dues before Nov 5.",          models.AudienceEnum.students),
            ("Marks Upload Deadline",          "Teachers must upload internal and assignment marks by Oct 30.",  models.AudienceEnum.teachers),
        ]
        for title, msg, aud in notifs:
            db.add(models.Notification(title=title, message=msg, audience=aud, is_read=False))
        db.commit()
        print(f"  ✓ {len(notifs)} notifications created")

        print("\n" + "=" * 56)
        print("  ✓ Dummy data inserted successfully!")
        print("=" * 56)
        print("\n  Login credentials:")
        print("    Admin   : admin@examshield.ai   / admin123")
        print("    Teacher : teacher@examshield.ai / teacher123")
        print("    Student : student@examshield.ai / student123")
        print("    (all other accounts use the same role password)")
        print()

    except Exception as e:
        db.rollback()
        print(f"\n✗ Seed failed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
