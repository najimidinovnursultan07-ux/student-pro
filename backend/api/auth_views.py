import logging

from django.contrib.auth.models import User
from django.db import transaction
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from .models import TelegramProfile

logger = logging.getLogger(__name__)


def _issue_tokens(user: User, telegram_id: int | None = None) -> dict:
    refresh = RefreshToken.for_user(user)
    profile = TelegramProfile.objects.filter(user=user).first()
    display_name = (profile.first_name if profile else "") or user.first_name or ""

    return {
        "access": str(refresh.access_token),
        "refresh": str(refresh),
        "user": {
            "id": user.id,
            "username": user.username,
            "first_name": display_name,
            "telegram_id": profile.telegram_id if profile else telegram_id,
        },
    }


def _upsert_telegram_user(
    telegram_id: int,
    telegram_username: str,
    first_name: str,
    last_name: str,
) -> User:
    django_username = f"tg_{telegram_id}"

    with transaction.atomic():
        user, created = User.objects.get_or_create(
            username=django_username,
            defaults={
                "first_name": first_name[:150],
                "is_active": True,
            },
        )

        if created:
            user.set_unusable_password()
            user.save(update_fields=["password"])
            logger.info("Auto-created Telegram user: %s", django_username)
        elif first_name:
            user.first_name = first_name[:150]
            user.save(update_fields=["first_name"])

        TelegramProfile.objects.update_or_create(
            telegram_id=telegram_id,
            defaults={
                "user": user,
                "telegram_username": telegram_username,
                "first_name": first_name,
                "last_name": last_name,
            },
        )

    return user


@api_view(["POST"])
@permission_classes([AllowAny])
def telegram_auth(request):
    raw_id = request.data.get("id") or request.data.get("telegram_id")
    try:
        telegram_id = int(raw_id)
    except (TypeError, ValueError):
        telegram_id = 0

    if telegram_id <= 0:
        return Response(
            {"access": "", "refresh": "", "user": {}},
            status=status.HTTP_200_OK,
        )

    telegram_username = (request.data.get("username") or "").strip()
    first_name = (request.data.get("first_name") or "").strip()
    last_name = (request.data.get("last_name") or "").strip()

    user = _upsert_telegram_user(
        telegram_id=telegram_id,
        telegram_username=telegram_username,
        first_name=first_name,
        last_name=last_name,
    )

    return Response(_issue_tokens(user, telegram_id=telegram_id), status=status.HTTP_200_OK)
