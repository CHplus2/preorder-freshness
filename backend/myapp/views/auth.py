from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.middleware.csrf import get_token

@api_view(["POST"])
def signup_view(request):
    username = request.data.get("username")
    password = request.data.get("password")
    confirm_password = request.data.get("confirmPassword")

    if not username or not password or not confirm_password:
        return Response({"detail": "Missing fields"}, status=status.HTTP_400_BAD_REQUEST)

    if password != confirm_password:
        return Response({"detail": "Password mismatch"}, status=status.HTTP_400_BAD_REQUEST)

    if User.objects.filter(username=username).exists():
        return Response({"detail": "Username taken"}, status=status.HTTP_409_CONFLICT)

    user = User.objects.create_user(username=username, password=password)
    login(request, user)

    return Response({"detail": "User created and logged in"}, status=status.HTTP_201_CREATED
)


@api_view(["POST"])
def login_view(request):
    username = request.data.get("username")
    password = request.data.get("password")

    user = authenticate(request, username=username, password=password)
    if user:
        login(request, user)
        return Response({"detail": "Logged in"}, status=status.HTTP_200_OK)
    return Response({"detail": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED)

@api_view(["POST"])
def logout_view(request):
    logout(request)
    return Response({"detail": "Logged out"}, status=status.HTTP_200_OK)

@api_view(["GET"])
def check_auth(request):
    get_token(request)
    if request.user.is_authenticated:
        return Response({
            "authenticated": True,
            "username": request.user.username,
            "is_admin": request.user.is_staff  
        }, status=status.HTTP_200_OK)
    return Response({"authenticated": False}, status=status.HTTP_200_OK)