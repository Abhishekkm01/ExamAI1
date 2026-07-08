#!/usr/bin/env bash
# ExamShield AI – One-click local starter (macOS / Linux)
set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

echo "=========================================="
echo "  ExamShield AI – Local Starter"
echo "=========================================="

# --- Backend ---
echo ""
echo "[1/4] Setting up Python virtual environment..."
cd "$ROOT_DIR/backend"
if [ ! -d "venv" ]; then
  python3 -m venv venv
fi
# shellcheck disable=SC1091
source venv/bin/activate

echo "[2/4] Installing backend dependencies..."
pip install --quiet --upgrade pip
# dlib/face_recognition is optional and may fail to build on some systems.
# The app works fine without it (face verification falls back to a simulator).
pip install --quiet --no-cache-dir -r requirements.txt || {
  echo ""
  echo "WARNING: Some packages failed to install. The app will still run with"
  echo "         reduced features. The SQLite fallback is used if MySQL is unavailable."
}

echo "[3/4] Testing MySQL connection..."
if python test_mysql.py >/dev/null 2>&1; then
  echo "      MySQL OK"
  if [ ! -f ".env" ]; then
    cp .env.example .env
    echo "      Created .env from .env.example - please edit it with your MySQL password"
  fi

  echo "      Creating / updating database tables..."
  python manage.py setup_database --skip-demo
else
  echo "      WARNING: MySQL is not reachable. Falling back to SQLite."
  if [ ! -f ".env" ]; then
    echo "DATABASE_URL=sqlite:///./examshield.db" > .env
    echo "SECRET_KEY=local-dev-secret-key-change-me" >> .env
  fi
  echo "      Creating / updating database tables..."
  python manage.py setup_database --skip-demo
fi

echo "[4/4] Starting Django backend on http://localhost:8000 ..."
( python manage.py runserver 0.0.0.0:8000 > "$ROOT_DIR/backend.log" 2>&1 & echo $! > "$ROOT_DIR/backend.pid" )

# --- Frontend ---
cd "$ROOT_DIR"
if [ ! -d "node_modules" ]; then
  npm install --silent
fi

echo ""
echo "=========================================="
echo "  Backend running on http://localhost:8000"
echo "  Admin panel:     http://localhost:8000/admin"
echo "  Frontend:        http://localhost:5173"
echo ""
echo "  Default logins:"
echo "    admin@examshield.ai   / admin123"
echo "    teacher@examshield.ai / teacher123"
echo "    student@examshield.ai / student123"
echo ""
echo "  Check backend.log for any startup errors."
echo "  Open http://localhost:8000/admin to verify Django is running."
echo "  Press CTRL+C to stop everything."
echo "=========================================="

trap 'echo "Stopping..."; kill $(cat "$ROOT_DIR/backend.pid" 2>/dev/null) 2>/dev/null || true; exit 0' INT TERM
npm run dev
