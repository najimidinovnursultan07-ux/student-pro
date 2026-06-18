# AI Student PRO

Telegram Mini App для решения учебных задач через Gemini API.

## Структура проекта

```
AI Student PRO/
├── backend/          # Django API
└── frontend/         # React + Vite + PWA
```

## Быстрый старт

### 1. Backend (Django)

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
```

Откройте `.env` и укажите ваш ключ Gemini:

```
GEMINI_API_KEY=ваш_ключ_от_google_ai_studio
```

Запуск сервера:

```powershell
python manage.py migrate
python manage.py runserver
```

API будет доступен на `http://127.0.0.1:8000/api/solve/`.

**Пример запроса:**

```bash
curl -X POST http://127.0.0.1:8000/api/solve/ ^
  -H "Content-Type: application/json" ^
  -d "{\"task\": \"Решите уравнение x^2 - 5x + 6 = 0\"}"
```

### 2. Frontend (React + Vite)

В новом терминале:

```powershell
cd frontend
npm install
copy .env.example .env
npm run dev
```

Приложение откроется на `http://localhost:5173`.

### 3. PWA

После сборки (`npm run build`) приложение можно установить на смартфон как PWA:

```powershell
npm run build
npm run preview
```

## Telegram Mini App

1. Создайте бота через [@BotFather](https://t.me/BotFather).
2. Настройте Web App URL на ваш задеплоенный фронтенд (HTTPS обязателен).
3. Для локальной разработки используйте [ngrok](https://ngrok.com/) или аналог для HTTPS-туннеля.

## Переменные окружения

| Файл | Переменная | Описание |
|------|------------|----------|
| `backend/.env` | `GEMINI_API_KEY` | API-ключ Google Gemini |
| `backend/.env` | `GEMINI_MODEL` | Модель Gemini (по умолчанию `gemini-2.5-flash`) |
| `backend/.env` | `DJANGO_SECRET_KEY` | Секретный ключ Django |
| `backend/.env` | `CORS_ALLOWED_ORIGINS` | Разрешённые origins (через запятую) |
| `frontend/.env` | `VITE_API_URL` | URL эндпоинта `/api/solve/` |

## Технологии

- **Backend:** Django, google-generativeai, django-cors-headers
- **Frontend:** React, Vite, @twa-dev/sdk, axios, react-markdown, KaTeX
- **PWA:** vite-plugin-pwa
