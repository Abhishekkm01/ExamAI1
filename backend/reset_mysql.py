import pymysql
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv('DATABASE_URL', 'mysql+pymysql://root:AbhiKm%401998@localhost:3306/examshield_db')

# Parse the connection string
from urllib.parse import urlparse, unquote
parsed = urlparse(DATABASE_URL)

user = parsed.username
password = unquote(parsed.password) if parsed.password else ''
host = parsed.hostname
port = parsed.port or 3306
db_name = parsed.path.lstrip('/')

print(f"Connecting to MySQL as {user}@{host}:{port}...")

try:
    # Connect to MySQL server (without specifying database)
    connection = pymysql.connect(
        host=host,
        user=user,
        password=password,
        port=port
    )
    cursor = connection.cursor()
    
    # Drop database if exists
    print(f"Dropping database {db_name}...")
    cursor.execute(f"DROP DATABASE IF EXISTS `{db_name}`")
    
    # Create database
    print(f"Creating database {db_name}...")
    cursor.execute(f"CREATE DATABASE `{db_name}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
    
    cursor.close()
    connection.close()
    
    print(f"Database {db_name} has been reset successfully!")
    print("Now run: python manage.py migrate")
    
except Exception as e:
    print(f"Error: {e}")
    print("Make sure MySQL is running and your credentials are correct.")
