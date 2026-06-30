"""
URL configuration for examshield project.
"""
from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse

def health_check(request):
    return JsonResponse({'status': 'ok'})

urlpatterns = [
    path('', health_check, name='health_check'),
    path('admin/', admin.site.urls),
    path('api/', include('api.urls')),
]
