import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv

load_dotenv()

# Default to MySQL when DATABASE_URL is set, else fall back to a local SQLite file for instant zero-setup.
DEFAULT_DB = "mysql+pymysql://root:AbhiKm%401998@localhost:3306/examshield_db"
DATABASE_URL = os.getenv("DATABASE_URL", DEFAULT_DB)

if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_recycle=3600)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
