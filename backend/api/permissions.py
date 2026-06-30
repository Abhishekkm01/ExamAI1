from rest_framework import permissions
from .models import User


class IsAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        # Check for JWT user from custom attribute first
        user = getattr(request, '_jwt_user', request.user)
        print(f"[IsAdmin] Checking permission for {user}")
        print(f"[IsAdmin] Has role: {hasattr(user, 'role')}")
        if hasattr(user, 'role'):
            print(f"[IsAdmin] Role value: {user.role} (type: {type(user.role)})")
        if not user or not hasattr(user, 'role'):
            return False
        result = user.role == 'admin'
        print(f"[IsAdmin] Permission check result: {result}")
        return result


class IsTeacher(permissions.BasePermission):
    def has_permission(self, request, view):
        # Check if user is authenticated via JWT middleware
        if not request.user or not hasattr(request.user, 'role'):
            return False
        return request.user.role == 'teacher'


class IsStudent(permissions.BasePermission):
    def has_permission(self, request, view):
        # Check if user is authenticated via JWT middleware
        if not request.user or not hasattr(request.user, 'role'):
            return False
        return request.user.role == 'student'


class IsAdminOrTeacher(permissions.BasePermission):
    def has_permission(self, request, view):
        # Check if user is authenticated via JWT middleware
        if not request.user or not hasattr(request.user, 'role'):
            return False
        return request.user.role in ['admin', 'teacher']
