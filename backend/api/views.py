import json
import logging
import os
import re
import time
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

MAX_GEMINI_RETRIES = 3
_genai_configured = False


def _gemini_api_key() -> str:
    return (os.getenv("GEMINI_API_KEY") or getattr(settings, "GEMINI_API_KEY", "") or "").strip()


def get_ai_client() -> None:
    """Безопасная однократная инициализация Gemini SDK."""
    global _genai_configured

    api_key = _gemini_api_key()
    if not api_key:
        raise ValueError("GEMINI_API_KEY is not configured")

    if not _genai_configured:
        genai.configure(api_key=api_key)
        _genai_configured = True


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


def _is_retryable_error(exc: Exception) -> bool:
    message = str(exc).lower()
    if _is_quota_error(exc):
        return True
    if isinstance(exc, ValueError) and "пустой" in message:
        return True
    retry_markers = (
        "503",
        "500",
        "overloaded",
        "overload",
        "deadline",
        "timeout",
        "temporarily",
        "unavailable",
        "internal error",
        "try again",
    )
    return any(marker in message for marker in retry_markers)


def format_api_error(exc: Exception) -> str:
    message = str(exc)
    lowered = message.lower()

    if _is_quota_error(exc):
        retry_match = re.search(r"retry in ([\d.]+)s", lowered)
        if retry_match:
            seconds = max(1, round(float(retry_match.group(1))))
            return f"Превышен лимит запросов. Подождите ~{seconds} сек. и попробуйте снова."
        return "Превышен лимит запросов. Подождите минуту и попробуйте снова."

    if "api key" in lowered or "api_key_invalid" in lowered or "permission denied" in lowered:
        return "Сервис временно недоступен. Проверьте GEMINI_API_KEY на сервере."

    if _is_model_unavailable(exc):
        return "Модель ИИ временно недоступна. Попробуйте позже."

    if "пустой ответ" in lowered:
        return "ИИ не вернул ответ. Попробуйте отправить сообщение ещё раз."

    if len(message) > 280:
        return message[:280].rstrip() + "…"

    return message or "Не удалось получить ответ."


def models_to_try(has_image: bool) -> list[str]:
    preferred = settings.GEMINI_MODEL
    fallbacks = settings.GEMINI_FALLBACK_MODELS
    ordered: list[str] = []
    for model in [preferred, *fallbacks]:
        if model and model not in ordered:
            ordered.append(model)
    return ordered


def extract_response_text(response) -> str:
    """Извлекает текст из ответа Gemini, включая fallback по candidates."""
    if response is None:
        return ""

    try:
        text = response.text
        if text and text.strip():
            return text.strip()
    except (ValueError, AttributeError):
        pass

    chunks: list[str] = []
    for candidate in getattr(response, "candidates", None) or []:
        content = getattr(candidate, "content", None)
        if not content:
            continue
        for part in getattr(content, "parts", None) or []:
            part_text = getattr(part, "text", None)
            if part_text and str(part_text).strip():
                chunks.append(str(part_text).strip())

    return "\n".join(chunks).strip()


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


def _call_gemini_model(model_name: str, content_parts: list) -> str:
    model = genai.GenerativeModel(
        model_name=model_name,
        system_instruction=SYSTEM_PROMPT,
    )
    response = model.generate_content(content_parts)
    answer = extract_response_text(response)
    if not answer:
        raise ValueError("Gemini вернул пустой ответ (возможна перегрузка сервиса).")
    return answer


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
        for attempt in range(1, MAX_GEMINI_RETRIES + 1):
            try:
                logger.info(
                    "Gemini request: model=%s attempt=%s/%s image=%s",
                    model_name,
                    attempt,
                    MAX_GEMINI_RETRIES,
                    image is not None,
                )
                answer = _call_gemini_model(model_name, content_parts)
                logger.info("Gemini success: model=%s chars=%s", model_name, len(answer))
                return answer
            except Exception as exc:
                last_error = exc
                print(f"Gemini Error: {exc}")
                logger.warning(
                    "Gemini failed: model=%s attempt=%s/%s error=%s",
                    model_name,
                    attempt,
                    MAX_GEMINI_RETRIES,
                    exc,
                )

                if _is_model_unavailable(exc):
                    break

                if attempt < MAX_GEMINI_RETRIES and _is_retryable_error(exc):
                    delay = min(2**attempt, 12)
                    time.sleep(delay)
                    continue

                if _is_quota_error(exc) or _is_retryable_error(exc):
                    break

                raise

    if last_error:
        raise last_error
    raise RuntimeError("Не удалось получить ответ от Gemini после всех попыток.")


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

    if not _gemini_api_key():
        return Response(
            {"error": "Сервис временно недоступен. Не задан GEMINI_API_KEY."},
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
        print(f"Gemini Error: {exc}")
        logger.exception("AI API error")
        return Response(
            {"error": format_api_error(exc)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
