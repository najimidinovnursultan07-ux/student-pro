import json
import logging
import re
import uuid
from pathlib import Path

import google.generativeai as genai
from django.conf import settings
from django.core.files.uploadedfile import UploadedFile
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from PIL import Image, UnidentifiedImageError

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "Ты — опытный репетитор. Решай учебные задачи пошагово, понятно и на русском языке. "
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


def format_gemini_error(exc: Exception, tried_models: list[str] | None = None) -> str:
    message = str(exc)
    lowered = message.lower()

    if _is_quota_error(exc):
        retry_match = re.search(r"retry in ([\d.]+)s", lowered)
        if retry_match:
            seconds = max(1, round(float(retry_match.group(1))))
            return (
                f"Превышен лимит запросов к Gemini. Подождите ~{seconds} сек. и попробуйте снова. "
                f"Текущая модель: {settings.GEMINI_MODEL}."
            )
        return (
            "Превышен лимит запросов к Gemini API. Подождите минуту и попробуйте снова "
            f"или смените GEMINI_MODEL на Render (сейчас: {settings.GEMINI_MODEL})."
        )

    if "api key" in lowered or "api_key_invalid" in lowered or "permission denied" in lowered:
        return "Неверный или отсутствующий API-ключ Gemini. Проверьте GEMINI_API_KEY на Render."

    if _is_model_unavailable(exc):
        models_info = ", ".join(tried_models) if tried_models else settings.GEMINI_MODEL
        return (
            f"Модель «{settings.GEMINI_MODEL}» недоступна. "
            f"Попробованы: {models_info}. "
            "Укажите на Render GEMINI_MODEL=gemini-2.5-flash (или gemini-2.0-flash)."
        )

    if len(message) > 280:
        return message[:280].rstrip() + "…"

    return message


def models_to_try(has_image: bool) -> list[str]:
    preferred = settings.GEMINI_MODEL
    fallbacks = settings.GEMINI_FALLBACK_MODELS
    if has_image:
        vision_first = [preferred, *fallbacks]
        ordered: list[str] = []
        for model in vision_first:
            if model and model not in ordered:
                ordered.append(model)
        return ordered

    ordered = []
    for model in [preferred, *fallbacks]:
        if model and model not in ordered:
            ordered.append(model)
    return ordered


def get_gemini_client() -> None:
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
    get_gemini_client()
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
            logger.info("Trying Gemini model: %s (image=%s)", model_name, image is not None)
            model = genai.GenerativeModel(
                model_name=model_name,
                system_instruction=SYSTEM_PROMPT,
            )
            response = model.generate_content(content_parts)
            logger.info("Gemini model succeeded: %s", model_name)
            return response.text or ""
        except Exception as exc:
            last_error = exc
            if _is_quota_error(exc) or _is_model_unavailable(exc):
                logger.warning("Gemini model %s failed: %s", model_name, exc)
                continue
            raise

    if last_error:
        raise last_error
    raise RuntimeError("Не удалось получить ответ от Gemini.")


def parse_request_payload(request) -> tuple[str, UploadedFile | None, str]:
    content_type = request.content_type or ""

    if content_type.startswith("multipart/form-data"):
        text = (request.POST.get("text") or "").strip()
        chat_id = (request.POST.get("chat_id") or "").strip()
        image = request.FILES.get("image")
        return text, image, chat_id

    try:
        body = json.loads(request.body.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise ValueError("Некорректный JSON.") from exc

    text = (body.get("text") or body.get("task") or "").strip()
    chat_id = (body.get("chat_id") or "").strip()
    return text, None, chat_id


@csrf_exempt
@require_http_methods(["POST"])
def solve_task(request):
    try:
        text, uploaded_image, chat_id = parse_request_payload(request)
    except ValueError as exc:
        return JsonResponse({"error": str(exc)}, status=400)

    if not text and not uploaded_image:
        return JsonResponse(
            {"error": "Укажите текст задачи или прикрепите изображение."},
            status=400,
        )

    if not settings.GEMINI_API_KEY:
        return JsonResponse(
            {"error": "GEMINI_API_KEY не настроен на сервере (Render → Environment)."},
            status=500,
        )

    image_url = None
    pil_image = None

    try:
        if uploaded_image:
            pil_image = load_image_from_upload(uploaded_image)
            image_url = save_uploaded_image(uploaded_image)
            if image_url and not image_url.startswith("http"):
                image_url = request.build_absolute_uri(image_url)

        answer = generate_answer(text, pil_image)
        response_chat_id = chat_id or str(uuid.uuid4())

        return JsonResponse(
            {
                "chat_id": response_chat_id,
                "answer": answer,
                "image_url": image_url,
            }
        )
    except ValueError as exc:
        return JsonResponse({"error": str(exc)}, status=400)
    except Exception as exc:
        logger.exception("Gemini API error")
        return JsonResponse(
            {"error": format_gemini_error(exc, tried_models=models_to_try(pil_image is not None))},
            status=500,
        )
