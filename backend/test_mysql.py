"""Quick connectivity test for the MySQL database.
Run this if you want to verify your MySQL server is reachable and the credentials are correct.
Usage: python test_mysql.py
"""
import os
import sys
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL", "mysql+pymysql://root:AbhiKm%401998@localhost:3306/examshield_db")
print(f"Using DATABASE_URL: {DATABASE_URL}")

try:
    from sqlalchemy import create_engine, text
    engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_recycle=3600)
    with engine.connect() as conn:
        result = conn.execute(text("SELECT VERSION() AS version"))
        version = result.fetchone()[0]
        print(f"[OK] Connected to MySQL. Server version: {version}")

        # Make sure database exists
        db_name = DATABASE_URL.rsplit("/", 1)[-1].split("?")[0]
        print(f"[OK] Database in use: {db_name}")
    print("\n[OK] MySQL connection is good! You can now run start.bat / start.sh")
except Exception as e:
    print(f"\n[ERROR] Connection failed: {e}")
    print("\nTroubleshooting tips:")
    print("  1. Make sure MySQL server is running (net start mysql in admin cmd)")
    print("  2. Open MySQL and run: CREATE DATABASE examshield;")
    print("  3. Edit backend/.env and set the correct password in DATABASE_URL")
    print("  4. Try: mysql -u root -p   then enter your password")
    sys.exit(1)
