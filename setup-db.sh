#!/usr/bin/env bash
# ExamShield AI — one command to create DB + all tables on a new device
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT/backend"

echo "=========================================="
echo "  ExamShield — Database Setup"
echo "=========================================="
echo

if [ ! -d venv ]; then
  python3 -m venv venv
fi
# shellcheck disable=SC1091
source venv/bin/activate

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created backend/.env from .env.example"
  echo "IMPORTANT: Edit backend/.env and set your MySQL DB_PASSWORD, then run this again."
  exit 1
fi

pip install --quiet --upgrade pip
pip install --quiet --no-cache-dir -r requirements.txt

python manage.py setup_database
