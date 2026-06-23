@echo off
REM ExamShield AI - One-click local starter (Windows)
setlocal enabledelayedexpansion

cd /d "%~dp0"

echo ==========================================
echo   ExamShield AI - Local Starter
echo ==========================================

REM --- Backend ---
echo.
echo [1/4] Setting up Python virtual environment...
cd backend
if not exist venv (
  python -m venv venv
)
call venv\Scripts\activate.bat

echo [2/4] Installing backend dependencies...
python -m pip install --quiet --upgrade pip --disable-pip-version-check
REM Skip dlib/face_recognition (requires Visual Studio C++ on Windows).
REM The app works fine without them — face verification falls back to a simulator.
echo       (Skipping optional face_recognition/dlib - not required)
pip install --quiet --no-cache-dir -r requirements.txt
if errorlevel 1 (
  echo.
  echo WARNING: Some packages failed to install. The app will still run
  echo          with reduced features. Common cause: MySQL connector needs
  echo          Visual C++ Build Tools. The fallback SQLite still works.
  echo.
)

echo [3/4] Testing MySQL connection...
python test_mysql.py >nul 2>&1
if errorlevel 1 (
  echo.
  echo WARNING: MySQL is not reachable. Falling back to SQLite for now.
  echo          To use MySQL: see backend\.env.example
  echo.
  if not exist "backend\.env" (
    echo DATABASE_URL=sqlite:///./examshield.db^> backend\.env
    echo SECRET_KEY=local-dev-secret-key-change-me^>^> backend\.env
  )
) else (
  echo       MySQL OK
  if not exist "backend\.env" (
    copy .env.example .env >nul
    echo       Created backend\.env from .env.example - please edit it with your MySQL password
  )
)

echo [4/4] Starting FastAPI backend on http://localhost:8000 ...
start "ExamShield-Backend" /B cmd /c "uvicorn main:app --host 0.0.0.0 --port 8000 > ..\backend.log 2>&1"

REM --- Frontend ---
cd ..
if not exist node_modules (
  call npm install --silent
)

echo.
echo ==========================================
echo   Backend running on http://localhost:8000
echo   API docs:        http://localhost:8000/docs
echo   Frontend:        http://localhost:5173
echo.
echo   Default logins:
echo     admin@examshield.ai   / admin123
echo     teacher@examshield.ai / teacher123
echo     student@examshield.ai / student123
echo.
echo   Check backend.log for any startup errors.
echo   Open http://localhost:8000/docs to verify the API is live.
echo ==========================================

call npm run dev

endlocal
