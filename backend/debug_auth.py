"""
Quick diagnostic to debug 401 errors.

Usage:
    python debug_auth.py
"""

import os
import sys
import json
import requests
from dotenv import load_dotenv

load_dotenv()
BASE = os.getenv("BACKEND_URL", "http://localhost:8000")


def section(title):
    print()
    print("=" * 60)
    print(f"  {title}")
    print("=" * 60)


def main():
    section("Step 1: Is the backend reachable?")
    try:
        r = requests.get(BASE + "/", timeout=5)
        print(f"✓ Backend responded: {r.status_code}")
        print(f"  Body: {r.json()}")
    except Exception as e:
        print(f"✗ Backend NOT reachable: {e}")
        print("  Fix: start the backend with:  uvicorn main:app --reload --port 8000")
        return

    section("Step 2: Try to log in")
    creds = [
        ("admin@examshield.ai",   "admin123"),
        ("teacher@examshield.ai", "teacher123"),
        ("student@examshield.ai", "student123"),
    ]
    for email, password in creds:
        try:
            r = requests.post(
                f"{BASE}/api/auth/login",
                data={"username": email, "password": password},
                timeout=5,
            )
            if r.status_code == 200:
                data = r.json()
                print(f"✓ Login OK: {email}")
                print(f"  Token (first 40 chars): {data['access_token'][:40]}...")
                print(f"  User: {data['user']['email']} ({data['user']['role']})")
                token = data["access_token"]

                section(f"Step 3: Use the token to fetch data as {data['user']['role']}")
                if data["user"]["role"] == "admin":
                    endpoints = [
                        "/api/admin/dashboard",
                        "/api/admin/students?page=1&page_size=5",
                        "/api/admin/teachers",
                        "/api/admin/exams",
                    ]
                elif data["user"]["role"] == "teacher":
                    endpoints = [
                        "/api/teacher/dashboard",
                        "/api/teacher/students",
                    ]
                else:
                    endpoints = [
                        "/api/student/dashboard",
                        "/api/student/profile",
                        "/api/student/eligibility",
                    ]
                for ep in endpoints:
                    try:
                        r2 = requests.get(BASE + ep, headers={"Authorization": f"Bearer {token}"}, timeout=5)
                        if r2.status_code == 200:
                            data2 = r2.json()
                            preview = json.dumps(data2)[:200] + "..." if len(json.dumps(data2)) > 200 else json.dumps(data2)
                            print(f"✓ {ep}  ->  200 OK")
                            print(f"  {preview}")
                        else:
                            print(f"✗ {ep}  ->  {r2.status_code}")
                            print(f"  {r2.text[:200]}")
                    except Exception as e:
                        print(f"✗ {ep}  ->  error: {e}")
                return
            else:
                print(f"✗ Login failed: {email}  ->  {r.status_code}")
                try:
                    print(f"  {r.json()}")
                except Exception:
                    print(f"  {r.text[:200]}")
        except Exception as e:
            print(f"✗ Login error for {email}: {e}")
            return

    section("Result: All logins failed")
    print("Possible causes:")
    print("  1. The database is empty — run:  python seed_dummy_data.py")
    print("  2. The bcrypt hash is wrong — re-seed")
    print("  3. Wrong DATABASE_URL in backend/.env")


if __name__ == "__main__":
    main()
