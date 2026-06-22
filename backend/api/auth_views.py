import logging
import re

from django.contrib.auth.models import User
from django.db import IntegrityError, transaction
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from .models import TelegramProfile

logger = logging.getLogger(__name__)

USERNAME_PATTERN = re.compile(r"^[\w.@+-]+$")


def _issue_tokens(user: User) -> dict:
    refresh = RefreshToken.for_user(user)
    profile = getattr(user, "telegram_profile", None)
    display_name = ""
    if profile and profile.first_name:
        display_name = profile.first_name
    elif user.first_name:
        display_name = user.first_name

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


def _sync_profile(
    profile: TelegramProfile,
    *,
    telegram_username: str,
    first_name: str,
    last_name: str,
) -> None:
    profile.telegram_username = telegram_username
    profile.first_name = first_name
    profile.last_name = last_name
    profile.save(update_fields=["telegram_username", "first_name", "last_name"])


def _get_or_create_telegram_user(
    telegram_id: int,
    telegram_username: str,
    first_name: str,
    last_name: str,
) -> tuple[User, bool]:
    django_username = f"tg_{telegram_id}"
    user_created = False

    with transaction.atomic():
        profile = (
            TelegramProfile.objects.select_related("user")
            .filter(telegram_id=telegram_id)
            .first()
        )

        if profile:
            user = profile.user
            _sync_profile(
                profile,
                telegram_username=telegram_username,
                first_name=first_name,
                last_name=last_name,
            )
            if first_name:
                user.first_name = first_name[:150]
                user.save(update_fields=["first_name"])
            return user, False

        user, user_created = User.objects.get_or_create(
            username=django_username,
            defaults={
                "first_name": first_name[:150],
                "is_active": True,
            },
        )

        if user_created:
            user.set_unusable_password()
            user.save(update_fields=["password"])
            print(f"Создан новый пользователь через Telegram: {django_username}")
            logger.info("Created new Telegram user: %s", django_username)
        else:
            if first_name:
                user.first_name = first_name[:150]
                user.save(update_fields=["first_name"])
            if user.has_usable_password():
                user.set_unusable_password()
                user.save(update_fields=["password"])

        profile, profile_created = TelegramProfile.objects.get_or_create(
            telegram_id=telegram_id,
            defaults={
                "user": user,
                "telegram_username": telegram_username,
                "first_name": first_name,
                "last_name": last_name,
            },
        )

        if not profile_created:
            _sync_profile(
                profile,
                telegram_username=telegram_username,
                first_name=first_name,
                last_name=last_name,
            )
            if profile.user_id != user.id:
                profile.user = user
                profile.save(update_fields=["user"])

    return user, user_created


@api_view(["POST"])
@permission_classes([AllowAny])
def telegram_auth(request):
    telegram_id: int | None = None

    try:
        raw_id = request.data.get("id") or request.data.get("telegram_id")
        if raw_id is None:
            return Response(
                {"error": "Не передан Telegram ID пользователя."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            telegram_id = int(raw_id)
        except (TypeError, ValueError):
            return Response(
                {"error": "Некорректный Telegram ID."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        telegram_username = (request.data.get("username") or "").strip()
        first_name = (request.data.get("first_name") or "").strip()
        last_name = (request.data.get("last_name") or "").strip()

        user, created = _get_or_create_telegram_user(
            telegram_id=telegram_id,
            telegram_username=telegram_username,
            first_name=first_name,
            last_name=last_name,
        )

        return Response(
            _issue_tokens(user),
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    except IntegrityError:
        if telegram_id is not None:
            profile = (
                TelegramProfile.objects.select_related("user")
                .filter(telegram_id=telegram_id)
                .first()
            )
            if profile:
                return Response(_issue_tokens(profile.user), status=status.HTTP_200_OK)

        return Response(
            {"error": "Не удалось создать пользователя Telegram."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    except Exception as exc:
        logger.exception("Telegram auth failed")
        message = str(exc).strip() or "Ошибка авторизации через Telegram."
        if "no such table" in message.lower():
            message = "База данных не инициализирована. Выполните migrate на сервере."
        return Response({"error": message}, status=status.HTTP_400_BAD_REQUEST)


@api_view(["POST"])
@permission_classes([AllowAny])
def register(request):
    try:
        username = (request.data.get("username") or "").strip()
        password = request.data.get("password") or ""
        email = (request.data.get("email") or "").strip()

        if not username:
            return Response(
                {"error": "Укажите имя пользователя."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if len(username) < 3:
            return Response(
                {"error": "Имя пользователя должно содержать минимум 3 символа."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not USERNAME_PATTERN.match(username):
            return Response(
                {"error": "Имя пользователя может содержать только буквы, цифры и @/./+/-/_. "},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if len(password) < 6:
            return Response(
                {"error": "Пароль должен содержать минимум 6 символов."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if email and User.objects.filter(email=email).exists():
            return Response(
                {"error": "Пользователь с таким email уже существует."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if User.objects.filter(username=username).exists():
            return Response(
                {"error": "Пользователь с таким именем уже существует."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            user = User.objects.create_user(
                username=username,
                password=password,
                email=email,
            )

        refresh = RefreshToken.for_user(user)

        return Response(
            {
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "user": {"id": user.id, "username": user.username},
            },
            status=status.HTTP_201_CREATED,
        )

    except IntegrityError:
        return Response(
            {"error": "Пользователь с таким именем или email уже существует."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    except Exception as exc:
        logger.exception("Registration failed")
        message = str(exc).strip() or "Не удалось зарегистрировать пользователя."

        if "no such table" in message.lower():
            message = "База данных не инициализирована. Выполните migrate на сервере."

        return Response(
            {"error": message},
            status=status.HTTP_400_BAD_REQUEST,
        )
