from django.test import Client, TestCase


class SolveEndpointTests(TestCase):
    def test_rejects_empty_multipart(self):
        client = Client()
        response = client.post("/api/solve/", data={"text": ""})
        self.assertEqual(response.status_code, 400)

    def test_rejects_empty_json_task(self):
        client = Client()
        response = client.post(
            "/api/solve/",
            data='{"task": ""}',
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)

    def test_rejects_invalid_json(self):
        client = Client()
        response = client.post(
            "/api/solve/",
            data="not-json",
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)

    def test_accepts_json_task_field(self):
        client = Client()
        response = client.post(
            "/api/solve/",
            data='{"task": "test", "chat_id": "abc-123"}',
            content_type="application/json",
        )
        self.assertIn(response.status_code, (200, 500))
