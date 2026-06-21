import { useRef } from "react";
import { AttachIcon, CloseIcon } from "./Icons";

export default function Composer({
  task,
  onTaskChange,
  attachedImage,
  imagePreview,
  onImageSelect,
  onImageRemove,
  onSubmit,
  loading,
  variant = "bottom",
}) {
  const fileInputRef = useRef(null);
  const canSubmit = Boolean(task.trim() || attachedImage);
  const isCenter = variant === "center";

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (file) onImageSelect(file);
    event.target.value = "";
  };

  return (
    <form
      onSubmit={onSubmit}
      className={`mx-auto w-full ${isCenter ? "max-w-2xl" : "max-w-3xl"}`}
    >
      {imagePreview && (
        <div className="mb-3 flex items-start">
          <div className="animate-fade-in group relative">
            <img
              src={imagePreview}
              alt="Превью"
              className="h-20 w-20 rounded-xl border border-white/10 object-cover shadow-lg"
            />
            <button
              type="button"
              onClick={onImageRemove}
              className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-[#2a2a32] text-slate-300 shadow-md transition-all hover:bg-red-500/90 hover:text-white"
              aria-label="Удалить изображение"
            >
              <CloseIcon className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}

      <div
        className={`relative rounded-2xl border border-white/[0.08] bg-[#1e1e24] shadow-lg transition-all focus-within:border-blue-500/40 focus-within:shadow-blue-500/5 ${
          isCenter ? "shadow-2xl shadow-black/20" : ""
        }`}
      >
        <textarea
          value={task}
          onChange={(e) => onTaskChange(e.target.value)}
          placeholder="Введите условие задачи или прикрепите фото…"
          rows={isCenter ? 4 : 3}
          disabled={loading}
          className="w-full resize-none bg-transparent px-4 py-3.5 pl-12 pr-24 text-[15px] text-slate-200 placeholder:text-slate-500 focus:outline-none disabled:opacity-50"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (canSubmit && !loading) onSubmit(e);
            }
          }}
        />

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={loading}
          className="absolute bottom-3 left-3 rounded-lg p-2 text-slate-500 transition-all hover:bg-white/[0.06] hover:text-slate-200 disabled:opacity-40"
          aria-label="Прикрепить изображение"
        >
          <AttachIcon className="h-5 w-5" />
        </button>

        <button
          type="submit"
          disabled={loading || !canSubmit}
          className="absolute bottom-3 right-3 rounded-xl bg-blue-500 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-40 active:scale-95"
        >
          Решить
        </button>
      </div>

      <p className="mt-2 text-center text-[11px] text-slate-600">
        Enter — отправить · Shift+Enter — новая строка · 📎 — фото задачи
      </p>
    </form>
  );
}
