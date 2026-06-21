import MarkdownRenderer from "./MarkdownRenderer";
import { MenuIcon, SparkleIcon, UserIcon } from "./Icons";

function Spinner() {
  return (
    <div className="flex items-center gap-3 py-4" role="status" aria-label="Загрузка">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-600 border-t-blue-400" />
      <span className="text-sm text-slate-400">Решаю задачу…</span>
    </div>
  );
}

export default function ChatArea({
  userName,
  displayTask,
  displayAnswer,
  task,
  onTaskChange,
  onSubmit,
  loading,
  error,
  isNewChat,
  onOpenSidebar,
}) {
  const userLetter = (userName || "U").charAt(0).toUpperCase();
  const hasConversation = Boolean(displayTask);

  return (
    <main className="flex min-w-0 flex-1 flex-col bg-[#131314]">
      <header className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-3 backdrop-blur-md lg:px-6">
        <button
          type="button"
          onClick={onOpenSidebar}
          className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white lg:hidden"
          aria-label="Открыть историю"
        >
          <MenuIcon />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-medium text-slate-100">AI Student PRO</h1>
          <p className="truncate text-xs text-slate-500">Решение учебных задач с Gemini</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="mx-auto w-full max-w-3xl px-4 py-6 lg:px-8 lg:py-10">
          {!hasConversation && !loading && isNewChat && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20">
                <SparkleIcon className="h-8 w-8" />
              </div>
              <h2 className="mb-2 text-xl font-semibold text-white">Привет! Чем могу помочь?</h2>
              <p className="max-w-sm text-sm text-slate-500">
                Введите условие задачи ниже — я решу её пошагово с формулами и пояснениями.
              </p>
            </div>
          )}

          {hasConversation && (
            <div className="space-y-8">
              <div className="flex gap-4">
                <UserIcon className="h-9 w-9" letter={userLetter} />
                <div className="min-w-0 flex-1 pt-1">
                  <p className="mb-1 text-xs font-medium text-slate-500">Вы</p>
                  <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-slate-200">
                    {displayTask}
                  </p>
                </div>
              </div>

              {(displayAnswer || loading || error) && (
                <div className="flex gap-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500/20 via-purple-500/20 to-pink-500/20">
                    <SparkleIcon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <p className="mb-2 text-xs font-medium text-slate-500">Gemini</p>
                    {loading && <Spinner />}
                    {error && !loading && (
                      <div
                        className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300"
                        role="alert"
                      >
                        {error}
                      </div>
                    )}
                    {displayAnswer && !loading && !error && (
                      <MarkdownRenderer>{displayAnswer}</MarkdownRenderer>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-white/[0.06] bg-[#131314]/80 p-4 backdrop-blur-xl lg:px-8">
        <form onSubmit={onSubmit} className="mx-auto w-full max-w-3xl">
          <div className="relative rounded-2xl border border-white/[0.08] bg-[#1e1e24] shadow-lg transition-all focus-within:border-blue-500/40 focus-within:shadow-blue-500/5">
            <textarea
              value={task}
              onChange={(e) => onTaskChange(e.target.value)}
              placeholder="Введите условие задачи…"
              rows={3}
              disabled={loading}
              className="w-full resize-none bg-transparent px-4 py-3.5 pr-24 text-[15px] text-slate-200 placeholder:text-slate-500 focus:outline-none disabled:opacity-50"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  onSubmit(e);
                }
              }}
            />
            <button
              type="submit"
              disabled={loading || !task.trim()}
              className="absolute bottom-3 right-3 rounded-xl bg-blue-500 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-40 active:scale-95"
            >
              Решить
            </button>
          </div>
          <p className="mt-2 text-center text-[11px] text-slate-600">
            Enter — отправить · Shift+Enter — новая строка
          </p>
        </form>
      </div>
    </main>
  );
}
