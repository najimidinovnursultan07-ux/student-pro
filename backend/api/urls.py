from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from . import auth_views, views

urlpatterns = [
    path("auth/login/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("auth/register/", auth_views.register, name="register"),
    path("auth/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("solve/", views.solve_task, name="solve"),
]
