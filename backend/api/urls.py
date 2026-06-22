from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from . import auth_views, views

urlpatterns = [
    path("auth/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("telegram-auth/", auth_views.telegram_auth, name="telegram_auth"),
    path("solve/", views.solve_task, name="solve"),
]
