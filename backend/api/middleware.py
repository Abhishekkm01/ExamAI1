from django.contrib.auth.models import AnonymousUser
from .models import User
from .auth_utils import decode_access_token


class JWTAuthenticationMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')

        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header[7:]
        else:
            token = request.GET.get('token') or request.POST.get('token')

        if token:
            payload = decode_access_token(token)

            if payload:
                try:
                    user = User.objects.get(email=payload.get('sub'), is_deleted=False)
                    request._jwt_user = user
                except User.DoesNotExist:
                    request._jwt_user = AnonymousUser()
            else:
                request._jwt_user = AnonymousUser()
        else:
            request._jwt_user = AnonymousUser()

        response = self.get_response(request)

        if hasattr(request, '_jwt_user') and request._jwt_user != AnonymousUser():
            request.user = request._jwt_user

        return response
