import { useEffect, useRef } from "react";
import MarkdownRenderer from "./MarkdownRenderer";
import Composer from "./Composer";
import { MenuIcon, SparkleIcon, UserIcon } from "./Icons";

function Spinner() {
  return (
    <div className="flex items-center gap-3 py-4" role="status" aria-label="Загрузка">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-600 border-t-blue-400" />
      <span className="text-sm text-slate-400">Решаю задачу…</span>
    </div>
  );
}

function UserMessage({ message, userLetter }) {
  return (
    <div className="flex gap-4">
      <UserIcon className="h-9 w-9" letter={userLetter} />
      <div className="min-w-0 flex-1 pt-1">
        <p className="mb-1 text-xs font-medium text-slate-500">Вы</p>
        {message.imageUrl && (
          <img
            src={message.imageUrl}
            alt="Прикреплённое изображение"
            className="mb-3 max-h-64 max-w-full rounded-xl border border-white/10 object-contain"
          />
        )}
        {message.text && (
          <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-slate-200">{message.text}</p>
        )}
        {!message.text && message.imageUrl && (
          <p className="text-sm italic text-slate-500">Задача на изображении</p>
        )}
      </div>
    </div>
  );
}

function AssistantMessage({ message, loading, error, isActive }) {
  if (message.status === "pending" && loading && isActive) {
    return (
      <div className="flex gap-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500/20 via-purple-500/20 to-pink-500/20">
          <SparkleIcon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="mb-2 text-xs font-medium text-slate-500">AI Student PRO</p>
          <Spinner />
        </div>
      </div>
    );
  }

  if (message.status === "error" && isActive && error) {
    return (
      <div className="flex gap-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500/20 via-purple-500/20 to-pink-500/20">
          <SparkleIcon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="mb-2 text-xs font-medium text-slate-500">AI Student PRO</p>
          <div
            className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300"
            role="alert"
          >
            {error}
          </div>
        </div>
      </div>
    );
  }

  if (message.status === "error" && !message.text) {
    return (
      <div className="flex gap-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500/20 via-purple-500/20 to-pink-500/20">
          <SparkleIcon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="mb-2 text-xs font-medium text-slate-500">AI Student PRO</p>
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            Не удалось получить ответ.
          </div>
        </div>
      </div>
    );
  }

  if (!message.text) return null;

  return (
    <div className="flex gap-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500/20 via-purple-500/20 to-pink-500/20">
        <SparkleIcon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="mb-2 text-xs font-medium text-slate-500">AI Student PRO</p>
        <MarkdownRenderer>{message.text}</MarkdownRenderer>
      </div>
    </div>
  );
}

export default function ChatArea({
  userName,
  messages,
  task,
  onTaskChange,
  attachedImage,
  imagePreview,
  onImageSelect,
  onImageRemove,
  onSubmit,
  loading,
  error,
  isNewChat,
  messageLimitReached,
  onOpenSidebar,
}) {
  const messagesEndRef = useRef(null);
  const userLetter = (userName || "U").charAt(0).toUpperCase();
  const hasConversation = messages.length > 0 || loading;
  const showCenterComposer = isNewChat && !hasConversation && !loading;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

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
          <p className="truncate text-xs text-slate-500">Интеллектуальное решение учебных задач</p>
        </div>
      </header>

      <div className="flex flex-1 flex-col overflow-hidden">
        {showCenterComposer ? (
          <div className="flex flex-1 flex-col items-center justify-center px-4 py-8">
            <div className="mb-8 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20">
                <SparkleIcon className="h-8 w-8" />
              </div>
              <h2 className="mb-2 text-2xl font-semibold text-white">Привет! Чем могу помочь?</h2>
              <p className="max-w-md text-sm text-slate-500">
                Введите задачу или прикрепите фото — чат создастся автоматически.
              </p>
            </div>
            <Composer
              task={task}
              onTaskChange={onTaskChange}
              attachedImage={attachedImage}
              imagePreview={imagePreview}
              onImageSelect={onImageSelect}
              onImageRemove={onImageRemove}
              onSubmit={onSubmit}
              loading={loading}
              inputDisabled={messageLimitReached}
              variant="center"
            />
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <div className="mx-auto w-full max-w-3xl space-y-8 px-4 py-6 lg:px-8 lg:py-10">
                {messages.map((message, index) =>
                  message.role === "user" ? (
                    <UserMessage key={message.id} message={message} userLetter={userLetter} />
                  ) : (
                    <AssistantMessage
                      key={message.id}
                      message={message}
                      loading={loading}
                      error={error}
                      isActive={index === messages.length - 1}
                    />
                  )
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            <div className="border-t border-white/[0.06] bg-[#131314]/80 p-4 backdrop-blur-xl lg:px-8">
              {messageLimitReached && (
                <p className="mx-auto mb-3 max-w-3xl rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-2.5 text-center text-sm text-amber-200">
                  Достигнут лимит в 100 сообщений. Пожалуйста, откройте «+ Новый чат».
                </p>
              )}
              <Composer
                task={task}
                onTaskChange={onTaskChange}
                attachedImage={attachedImage}
                imagePreview={imagePreview}
                onImageSelect={onImageSelect}
                onImageRemove={onImageRemove}
                onSubmit={onSubmit}
                loading={loading}
                inputDisabled={messageLimitReached}
                variant="bottom"
              />
            </div>
          </>
        )}
      </div>
    </main>
  );
}
