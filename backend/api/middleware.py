from django.contrib.auth.models import AnonymousUser
from .models import User
from .auth_utils import decode_access_token


class JWTAuthenticationMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Get token from Authorization header
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        print(f"[JWT] Path: {request.path}, Auth header: {auth_header[:50] if auth_header else 'None'}")
        
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header[7:]
            payload = decode_access_token(token)
            print(f"[JWT] Token payload: {payload}")
            
            if payload:
                try:
                    user = User.objects.get(email=payload.get('sub'), is_deleted=False)
                    # Store the JWT user in a custom attribute
                    request._jwt_user = user
                    print(f"[JWT] Set _jwt_user: {user.email}, role: {user.role}")
                except User.DoesNotExist:
                    request._jwt_user = AnonymousUser()
                    print(f"[JWT] User not found: {payload.get('sub')}")
            else:
                request._jwt_user = AnonymousUser()
                print(f"[JWT] Invalid token")
        else:
            request._jwt_user = AnonymousUser()
            print(f"[JWT] No Bearer token")
        
        response = self.get_response(request)
        
        # After all middleware, override request.user with JWT user if available
        if hasattr(request, '_jwt_user') and request._jwt_user != AnonymousUser():
            request.user = request._jwt_user
            print(f"[JWT] Override request.user after response: {request.user}")
        
        return response
