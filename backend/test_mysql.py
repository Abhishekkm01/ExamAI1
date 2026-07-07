"""
Django-compatible MySQL connection test for ExamShield AI
Tests database connectivity using Django settings
"""
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'examshield.settings')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

from django.db import connection
from django.core.exceptions import ImproperlyConfigured

def test_mysql_connection():
    """Test MySQL database connection"""
    try:
        # Try to connect to the database
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            result = cursor.fetchone()
            if result and result[0] == 1:
                print("MySQL connection successful")
                return True
    except ImproperlyConfigured as e:
        print(f"Configuration error: {e}")
        return False
    except Exception as e:
        print(f"MySQL connection failed: {e}")
        return False
    return False

if __name__ == "__main__":
    success = test_mysql_connection()
    sys.exit(0 if success else 1)
