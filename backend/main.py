from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base, SessionLocal
from routers import auth_router, admin_router, teacher_router, student_router, public_router
import models

app = FastAPI(title="ExamShield AI API", version="1.0.0")

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

app.include_router(auth_router.router)
app.include_router(admin_router.router)
app.include_router(teacher_router.router)
app.include_router(student_router.router)
app.include_router(public_router.router)


@app.on_event("startup")
def startup():
    """Verify database tables exist (created via SQL schema file). No mock data is seeded."""
    try:
        Base.metadata.create_all(bind=engine)
        print("[OK] Database tables verified")
    except Exception as e:
        print(f"[FAIL] Database connection failed: {e}")
        print("  Make sure MySQL is running and examshield_db exists.")
        print("  Run backend/examshield_schema.sql first to create the schema.")


@app.get("/")
def root():
    return {
        "message": "ExamShield AI API is running",
        "docs": "/docs",
        "redoc": "/redoc",
        "schema_file": "examshield_schema.sql",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
