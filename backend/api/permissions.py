from rest_framework import permissions
from .models import User


class IsAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        user = getattr(request, '_jwt_user', request.user)
        if not user or not hasattr(user, 'role'):
            return False
        return user.role == 'admin'


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


class IsOwner(permissions.BasePermission):
    """Allow users to edit their own profile."""
    def has_permission(self, request, view):
        user = getattr(request, '_jwt_user', request.user)
        if not user or not hasattr(user, 'role'):
            return False
        return user.role in ['admin', 'teacher', 'student']


class IsOwnerOrAdmin(permissions.BasePermission):
    """Allow users to edit their own profile or allow admin to edit anyone's."""
    def has_permission(self, request, view):
        user = getattr(request, '_jwt_user', request.user)
        if not user or not hasattr(user, 'role'):
            return False
        return user.role in ['admin', 'teacher', 'student']
    
    def has_object_permission(self, request, view, obj):
        user = getattr(request, '_jwt_user', request.user)
        # Admin can modify any profile
        if user.role == 'admin':
            return True
        # Users can modify their own profile
        return user.id == obj.id
