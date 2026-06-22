from django.contrib import admin

from .models import TelegramProfile


@admin.register(TelegramProfile)
class TelegramProfileAdmin(admin.ModelAdmin):
    list_display = ("telegram_id", "telegram_username", "first_name", "user")
    search_fields = ("telegram_id", "telegram_username", "first_name", "user__username")
