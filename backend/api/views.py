import json
import logging
import re

import google.generativeai as genai
from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "Ты — опытный репетитор. Решай учебные задачи пошагово, понятно и на русском языке. "
    "Используй Markdown для структуры ответа. Для математических формул используй LaTeX: "
    "инлайн — $...$, блочные — $$...$$."
)


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


def models_to_try() -> list[str]:
    preferred = settings.GEMINI_MODEL
    ordered: list[str] = []
    for model in [preferred, *settings.GEMINI_FALLBACK_MODELS]:
        if model and model not in ordered:
            ordered.append(model)
    return ordered


def get_gemini_client() -> None:
    api_key = settings.GEMINI_API_KEY
    if not api_key:
        raise ValueError("GEMINI_API_KEY is not configured")
    genai.configure(api_key=api_key)


def generate_answer(task: str) -> str:
    get_gemini_client()
    tried_models = models_to_try()
    last_error: Exception | None = None

    for model_name in tried_models:
        try:
            logger.info("Trying Gemini model: %s", model_name)
            model = genai.GenerativeModel(
                model_name=model_name,
                system_instruction=SYSTEM_PROMPT,
            )
            response = model.generate_content(task)
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


@csrf_exempt
@require_http_methods(["POST"])
def solve_task(request):
    try:
        body = json.loads(request.body.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError):
        return JsonResponse({"error": "Некорректный JSON."}, status=400)

    task = body.get("task", "").strip()
    if not task:
        return JsonResponse({"error": "Поле 'task' обязательно и не может быть пустым."}, status=400)

    if not settings.GEMINI_API_KEY:
        return JsonResponse(
            {"error": "GEMINI_API_KEY не настроен на сервере (Render → Environment)."},
            status=500,
        )

    try:
        answer = generate_answer(task)
        return JsonResponse({"answer": answer})
    except Exception as exc:
        logger.exception("Gemini API error")
        return JsonResponse(
            {"error": format_gemini_error(exc, tried_models=models_to_try())},
            status=500,
        )
