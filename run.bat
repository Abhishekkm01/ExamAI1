@echo off
REM Start backend + frontend (no reinstall). Use start.bat once for first-time setup.
setlocal
cd /d "%~dp0"

if not exist "backend\venv" (
  echo [ERROR] backend\venv not found.
  echo Run start.bat once for first-time setup.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Installing frontend packages - first time only...
  call npm install
  if errorlevel 1 (
    echo [ERROR] npm install failed.
    pause
    exit /b 1
  )
)

echo ==========================================
echo   ExamShield AI
echo   Backend:  http://localhost:8000
echo   Frontend: http://localhost:5173
echo ==========================================
echo.

start "ExamShield Backend" cmd /k cd /d "%~dp0backend" ^&^& call venv\Scripts\activate.bat ^&^& python manage.py runserver 0.0.0.0:8000

echo Frontend starting in this window.
echo Backend runs in the other window.
echo.

call npm run dev

endlocal
