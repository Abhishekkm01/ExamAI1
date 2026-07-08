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
  echo          Visual C++ Build Tools.
  echo.
)

echo [3/4] Testing MySQL connection...
python test_mysql.py >nul 2>&1
if errorlevel 1 (
  echo.
  echo ERROR: MySQL is not reachable. Please ensure MySQL is running.
  echo        See backend\.env.example for connection details.
  echo.
  pause
  exit /b 1
) else (
  echo       MySQL OK
  if not exist ".env" (
    copy .env.example .env >nul
    echo       Created .env from .env.example - please edit it with your MySQL password
  )
)

echo [4/4] Starting Django backend on http://localhost:8000 ...
REM Stop any stale backend still bound to port 8000 (prevents 404 on new routes)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000" ^| findstr "LISTENING"') do (
  taskkill /PID %%a /F >nul 2>&1
)
start "ExamShield-Backend" /B cmd /c "python manage.py runserver 0.0.0.0:8000 > ..\backend.log 2>&1"

REM --- Frontend ---
cd ..
if not exist node_modules (
  call npm install --silent
)

echo.
echo ==========================================
echo   Backend running on http://localhost:8000
echo   Admin panel:     http://localhost:8000/admin
echo   Frontend:        http://localhost:5173
echo.
echo   Default logins:
echo     admin@examshield.ai   / admin123
echo     teacher@examshield.ai / teacher123
echo     student@examshield.ai / student123
echo.
echo   Check backend.log for any startup errors.
echo   Open http://localhost:8000/admin to verify Django is running.
echo ==========================================

call npm run dev

endlocal
