from django.contrib.auth.models import User
from rest_framework.test import APIClient, APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from .models import TelegramProfile


class TelegramAuthTests(APITestCase):
    def test_creates_user_and_returns_jwt(self):
        response = self.client.post(
            "/api/telegram-auth/",
            {
                "id": 123456789,
                "username": "student",
                "first_name": "Иван",
                "last_name": "Петров",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertIn("access", response.data)
        self.assertTrue(TelegramProfile.objects.filter(telegram_id=123456789).exists())

    def test_existing_user_returns_jwt(self):
        user = User.objects.create_user(username="tg_123")
        user.set_unusable_password()
        user.save()
        TelegramProfile.objects.create(
            user=user,
            telegram_id=123,
            first_name="Old",
        )

        response = self.client.post(
            "/api/telegram-auth/",
            {"id": 123, "first_name": "New"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn("access", response.data)
        profile = TelegramProfile.objects.get(telegram_id=123)
        self.assertEqual(profile.first_name, "New")


class SolveEndpointTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="testuser", password="testpass123")
        self.client = APIClient()
        refresh = RefreshToken.for_user(self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")

    def test_rejects_unauthenticated(self):
        client = APIClient()
        response = client.post("/api/solve/", data={"text": "hello"})
        self.assertEqual(response.status_code, 401)

    def test_rejects_empty_multipart(self):
        response = self.client.post("/api/solve/", data={"text": ""})
        self.assertEqual(response.status_code, 400)

    def test_rejects_empty_json_task(self):
        response = self.client.post(
            "/api/solve/",
            data={"task": ""},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
