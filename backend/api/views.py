import json
import logging
import re
import uuid
from pathlib import Path

import google.generativeai as genai
from django.conf import settings
from django.core.files.uploadedfile import UploadedFile
from PIL import Image, UnidentifiedImageError
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "Ты — опытный репетитор AI Student PRO. Решай учебные задачи пошагово, понятно и на русском языке. "
    "Используй Markdown для структуры ответа. Для математических формул используй LaTeX: "
    "инлайн — $...$, блочные — $$...$$. "
    "Если пользователь прикрепил изображение, внимательно проанализируй его и реши задачу с картинки."
)

ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
IMAGE_ONLY_PROMPT = "Реши учебную задачу с прикреплённого изображения пошагово и понятно на русском языке."


def _is_model_unavailable(exc: Exception) -> bool:
    message = str(exc).lower()
    return (
        ("404" in str(exc) and "model" in message)
        or "not found" in message
        or "not supported" in message
        or "is not found for api version" in message
    )


def _is_quota_error(exc: Exception) -> bool:
    message = str(exc).lower()
    return "429" in str(exc) or "quota" in message or "resourceexhausted" in type(exc).__name__.lower()


def format_api_error(exc: Exception, tried_models: list[str] | None = None) -> str:
    message = str(exc)
    lowered = message.lower()

    if _is_quota_error(exc):
        retry_match = re.search(r"retry in ([\d.]+)s", lowered)
        if retry_match:
            seconds = max(1, round(float(retry_match.group(1))))
            return f"Превышен лимит запросов. Подождите ~{seconds} сек. и попробуйте снова."
        return "Превышен лимит запросов. Подождите минуту и попробуйте снова."

    if "api key" in lowered or "api_key_invalid" in lowered or "permission denied" in lowered:
        return "Сервис временно недоступен. Обратитесь к администратору."

    if _is_model_unavailable(exc):
        return "Модель ИИ временно недоступна. Попробуйте позже."

    if len(message) > 280:
        return message[:280].rstrip() + "…"

    return message


def models_to_try(has_image: bool) -> list[str]:
    preferred = settings.GEMINI_MODEL
    fallbacks = settings.GEMINI_FALLBACK_MODELS
    ordered: list[str] = []
    for model in [preferred, *fallbacks]:
        if model and model not in ordered:
            ordered.append(model)
    return ordered


def get_ai_client() -> None:
    api_key = settings.GEMINI_API_KEY
    if not api_key:
        raise ValueError("GEMINI_API_KEY is not configured")
    genai.configure(api_key=api_key)


def save_uploaded_image(uploaded_file: UploadedFile) -> str:
    ext = Path(uploaded_file.name).suffix.lower()
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        ext = ".jpg"

    upload_dir = Path(settings.MEDIA_ROOT) / "uploads"
    upload_dir.mkdir(parents=True, exist_ok=True)

    filename = f"{uuid.uuid4()}{ext}"
    destination = upload_dir / filename

    with destination.open("wb+") as dest:
        for chunk in uploaded_file.chunks():
            dest.write(chunk)

    return f"{settings.MEDIA_URL}uploads/{filename}"


def load_image_from_upload(uploaded_file: UploadedFile) -> Image.Image:
    uploaded_file.seek(0)
    try:
        image = Image.open(uploaded_file)
        image.load()
        return image.convert("RGB")
    except UnidentifiedImageError as exc:
        raise ValueError("Не удалось распознать изображение. Загрузите JPG, PNG, GIF или WebP.") from exc
    finally:
        uploaded_file.seek(0)


def generate_answer(task: str, image: Image.Image | None = None) -> str:
    get_ai_client()
    tried_models = models_to_try(has_image=image is not None)
    last_error: Exception | None = None

    content_parts: list = []
    if task:
        content_parts.append(task)
    elif image is not None:
        content_parts.append(IMAGE_ONLY_PROMPT)
    if image is not None:
        content_parts.append(image)

    for model_name in tried_models:
        try:
            logger.info("Trying model: %s (image=%s)", model_name, image is not None)
            model = genai.GenerativeModel(
                model_name=model_name,
                system_instruction=SYSTEM_PROMPT,
            )
            response = model.generate_content(content_parts)
            logger.info("Model succeeded: %s", model_name)
            return response.text or ""
        except Exception as exc:
            last_error = exc
            if _is_quota_error(exc) or _is_model_unavailable(exc):
                logger.warning("Model %s failed: %s", model_name, exc)
                continue
            raise

    if last_error:
        raise last_error
    raise RuntimeError("Не удалось получить ответ.")


def parse_request_payload(request) -> tuple[str, UploadedFile | None, str]:
    content_type = request.content_type or ""

    if content_type.startswith("multipart/form-data"):
        text = (request.data.get("text") or "").strip()
        chat_id = (request.data.get("chat_id") or "").strip()
        image = request.FILES.get("image")
        return text, image, chat_id

    if hasattr(request, "data"):
        text = (request.data.get("text") or request.data.get("task") or "").strip()
        chat_id = (request.data.get("chat_id") or "").strip()
        return text, None, chat_id

    try:
        body = json.loads(request.body.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise ValueError("Некорректный JSON.") from exc

    text = (body.get("text") or body.get("task") or "").strip()
    chat_id = (body.get("chat_id") or "").strip()
    return text, None, chat_id


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def solve_task(request):
    try:
        text, uploaded_image, chat_id = parse_request_payload(request)
    except ValueError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    if not text and not uploaded_image:
        return Response(
            {"error": "Укажите текст задачи или прикрепите изображение."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if not settings.GEMINI_API_KEY:
        return Response(
            {"error": "Сервис временно недоступен."},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    pil_image = None
    image_url = None

    try:
        if uploaded_image:
            pil_image = load_image_from_upload(uploaded_image)
            image_url = save_uploaded_image(uploaded_image)
            if image_url and not image_url.startswith("http"):
                image_url = request.build_absolute_uri(image_url)

        answer = generate_answer(text, pil_image)
        response_chat_id = chat_id or str(uuid.uuid4())

        return Response(
            {
                "chat_id": response_chat_id,
                "answer": answer,
                "image_url": image_url,
            }
        )
    except ValueError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as exc:
        logger.exception("AI API error")
        return Response(
            {"error": format_api_error(exc, tried_models=models_to_try(pil_image is not None))},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
