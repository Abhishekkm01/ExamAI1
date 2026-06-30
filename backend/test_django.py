import requests

# Test login
print("Testing login...")
token_response = requests.post('http://localhost:8000/api/auth/login', json={'email':'admin@examshield.ai','password':'admin123'})
print(f"Login: {token_response.status_code}")
if token_response.status_code == 200:
    token = token_response.json()['access_token']
    print(f"Token: {token[:50]}...")
    print(f"User from login: {token_response.json()['user']}")
    
    # Test admin dashboard first
    print("\nTesting admin dashboard...")
    dashboard_response = requests.get(
        'http://localhost:8000/api/admin/dashboard',
        headers={'Authorization':f'Bearer {token}'}
    )
    print(f"Dashboard: {dashboard_response.status_code}")
    print(f"Response: {dashboard_response.text[:500]}")
    
    # Test teacher setup
    print("\nTesting teacher setup...")
    teacher_response = requests.post(
        'http://localhost:8000/api/auth/setup-teacher',
        json={'email':'teacher@examshield.ai','password':'teacher123','name':'Prof. Sneha Rao','emp_id':'T001','department':'Computer Science','assigned_subjects':'CS301,CS302'},
        headers={'Authorization':f'Bearer {token}'}
    )
    print(f"Teacher setup: {teacher_response.status_code}")
    print(f"Response: {teacher_response.text[:500]}")
    
    # Test student setup
    print("\nTesting student setup...")
    student_response = requests.post(
        'http://localhost:8000/api/auth/setup-student',
        json={'email':'student@examshield.ai','password':'student123','name':'John Doe','roll_no':'CS2023001','department':'Computer Science','semester':5,'section':'A','attendance_percentage':80,'internal_marks':35,'assignment_marks':8,'previous_result':7.5,'backlogs':0,'fee_paid':True},
        headers={'Authorization':f'Bearer {token}'}
    )
    print(f"Student setup: {student_response.status_code}")
    print(f"Response: {student_response.text[:500]}")
