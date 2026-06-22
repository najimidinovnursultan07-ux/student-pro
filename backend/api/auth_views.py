import logging

from django.contrib.auth.models import User
from django.db import IntegrityError, transaction
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from .models import TelegramProfile

logger = logging.getLogger(__name__)


def _issue_tokens(user: User) -> dict:
    refresh = RefreshToken.for_user(user)
    profile = getattr(user, "telegram_profile", None)
    display_name = (profile.first_name if profile else "") or user.first_name or ""

    return {
        "access": str(refresh.access_token),
        "refresh": str(refresh),
        "user": {
            "id": user.id,
            "username": user.username,
            "first_name": display_name,
            "telegram_id": profile.telegram_id if profile else None,
        },
    }


def _upsert_telegram_user(
    telegram_id: int,
    telegram_username: str,
    first_name: str,
    last_name: str,
) -> tuple[User, bool]:
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
            logger.info("Created Telegram user: %s", django_username)
        elif first_name:
            user.first_name = first_name[:150]
            user.save(update_fields=["first_name"])

        profile, _ = TelegramProfile.objects.update_or_create(
            telegram_id=telegram_id,
            defaults={
                "user": user,
                "telegram_username": telegram_username,
                "first_name": first_name,
                "last_name": last_name,
            },
        )

        if profile.user_id != user.id:
            profile.user = user
            profile.save(update_fields=["user"])

    return user, created


@api_view(["POST"])
@permission_classes([AllowAny])
def telegram_auth(request):
    try:
        raw_id = request.data.get("id") or request.data.get("telegram_id")
        telegram_id = int(raw_id)
    except (TypeError, ValueError):
        return Response(
            {"error": "Некорректный Telegram ID."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    telegram_username = (request.data.get("username") or "").strip()
    first_name = (request.data.get("first_name") or "").strip()
    last_name = (request.data.get("last_name") or "").strip()

    try:
        user, created = _upsert_telegram_user(
            telegram_id=telegram_id,
            telegram_username=telegram_username,
            first_name=first_name,
            last_name=last_name,
        )
    except IntegrityError:
        profile = (
            TelegramProfile.objects.select_related("user")
            .filter(telegram_id=telegram_id)
            .first()
        )
        if profile:
            user = profile.user
        else:
            user, _ = User.objects.get_or_create(
                username=f"tg_{telegram_id}",
                defaults={"first_name": first_name[:150], "is_active": True},
            )
        created = False

    return Response(
        _issue_tokens(user),
        status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
    )
