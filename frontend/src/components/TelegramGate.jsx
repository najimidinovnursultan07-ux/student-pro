const BOT_URL = "https://t.me/ai_student_kg_bot";

const DEFAULT_MESSAGE =
  "Это приложение работает исключительно как Telegram Mini App. Пожалуйста, перейдите в нашего официального бота, чтобы начать пользоваться ИИ-помощником.";

export default function TelegramGate({ message = "" }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0e0e11] px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/5 bg-[#17171c] p-6 text-center shadow-xl">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#24A1DE]/10 text-2xl font-bold text-[#24A1DE]">
          AI
        </div>

        <h2 className="mb-2 text-xl font-bold text-white">AI Student PRO</h2>

        <p className="mb-6 text-sm leading-relaxed text-gray-400">{message || DEFAULT_MESSAGE}</p>

        <a
          href={BOT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-full items-center justify-center rounded-xl bg-[#24A1DE] px-6 py-3 font-semibold text-white shadow-lg shadow-[#24A1DE]/20 transition-colors duration-200 hover:bg-[#208ebd]"
        >
          Открыть в Telegram
        </a>
      </div>
    </div>
  );
}
