const BOT_URL = "https://t.me/ai_student_kg_bot";

export default function TelegramOpenPrompt() {
  return (
    <div className="mt-6 flex w-full flex-col items-center gap-3 text-center">
      <p className="text-sm font-medium text-white">
        Для полноценной работы откройте приложение через Telegram
      </p>
      <a
        href={BOT_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-1 inline-flex w-full items-center justify-center rounded-xl bg-[#24A1DE] px-4 py-2 font-bold text-white transition-colors duration-200 hover:bg-[#208ebd]"
      >
        Открыть в Telegram
      </a>
    </div>
  );
}
