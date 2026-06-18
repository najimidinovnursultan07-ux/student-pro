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

FALLBACK_MODELS = ("gemini-2.5-flash", "gemini-1.5-flash", "gemini-1.5-flash-8b")


def format_gemini_error(exc: Exception) -> str:
    message = str(exc)
    lowered = message.lower()

    if "429" in message or "quota" in lowered or "resourceexhausted" in type(exc).__name__.lower():
        retry_match = re.search(r"retry in ([\d.]+)s", lowered)
        if retry_match:
            seconds = max(1, round(float(retry_match.group(1))))
            return (
                f"Превышен лимит запросов к Gemini. Подождите ~{seconds} сек. и попробуйте снова. "
                "Если ошибка повторяется, смените GEMINI_MODEL в backend/.env "
                "(например: gemini-1.5-flash)."
            )
        return (
            "Превышен лимит запросов к Gemini API. Подождите минуту и попробуйте снова, "
            "либо укажите другую модель в GEMINI_MODEL (например: gemini-1.5-flash)."
        )

    if "api key" in lowered or "api_key_invalid" in lowered:
        return "Неверный или отсутствующий API-ключ Gemini. Проверьте GEMINI_API_KEY в backend/.env."

    if "404" in message and "model" in lowered:
        return (
            f"Модель «{settings.GEMINI_MODEL}» недоступна. "
            "Укажите другую в GEMINI_MODEL (например: gemini-2.5-flash или gemini-1.5-flash)."
        )

    if len(message) > 280:
        return message[:280].rstrip() + "…"

    return message


def models_to_try() -> list[str]:
    preferred = settings.GEMINI_MODEL.strip()
    ordered: list[str] = []
    for model in [preferred, *FALLBACK_MODELS]:
        if model and model not in ordered:
            ordered.append(model)
    return ordered


def generate_answer(task: str) -> str:
    genai.configure(api_key=settings.GEMINI_API_KEY)
    last_error: Exception | None = None

    for model_name in models_to_try():
        try:
            model = genai.GenerativeModel(
                model_name=model_name,
                system_instruction=SYSTEM_PROMPT,
            )
            response = model.generate_content(task)
            return response.text or ""
        except Exception as exc:
            last_error = exc
            message = str(exc).lower()
            is_quota = "429" in str(exc) or "quota" in message
            is_model_missing = "404" in str(exc) and "model" in message
            if is_quota or is_model_missing:
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
            {"error": "GEMINI_API_KEY не настроен на сервере."},
            status=500,
        )

    try:
        answer = generate_answer(task)
        return JsonResponse({"answer": answer})
    except Exception as exc:
        logger.exception("Gemini API error")
        return JsonResponse({"error": format_gemini_error(exc)}, status=500)
