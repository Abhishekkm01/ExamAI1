@echo off
REM ExamShield AI — seed 15 dummy rows into each major table
setlocal
cd /d "%~dp0\backend"

echo ==========================================
echo   ExamShield — Seed Dummy Data
echo ==========================================
echo.

if not exist venv (
  echo Run setup-db.bat first to create the database and venv.
  pause
  exit /b 1
)

call venv\Scripts\activate.bat

if "%~1"=="--clear" (
  python manage.py dummy_data --clear
) else (
  python manage.py dummy_data
)

echo.
pause
endlocal
