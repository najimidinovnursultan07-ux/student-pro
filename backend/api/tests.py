from django.contrib.auth.models import User
from rest_framework.test import APIClient, APITestCase
from rest_framework_simplejwt.tokens import RefreshToken


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
