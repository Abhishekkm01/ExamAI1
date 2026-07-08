@echo off
REM ExamShield AI — one command to create DB + all tables on a new device
setlocal
cd /d "%~dp0\backend"

echo ==========================================
echo   ExamShield — Database Setup
echo ==========================================
echo.

if not exist venv (
  echo Creating Python virtual environment...
  python -m venv venv
)

call venv\Scripts\activate.bat

if not exist ".env" (
  copy .env.example .env >nul
  echo Created backend\.env from .env.example
  echo IMPORTANT: Edit backend\.env and set your MySQL DB_PASSWORD, then run this again.
  echo.
  pause
  exit /b 1
)

echo Installing backend dependencies...
python -m pip install --quiet --upgrade pip --disable-pip-version-check
pip install --quiet --no-cache-dir -r requirements.txt

echo.
python manage.py setup_database
echo.
pause
endlocal
