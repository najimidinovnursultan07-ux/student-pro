import { Trash2 } from "lucide-react";
import { groupHistoryByDate } from "../utils/groupHistory";
import { ChatIcon, PlusIcon } from "./Icons";

export default function Sidebar({
  history,
  activeId,
  onSelect,
  onNewChat,
  onDeleteChat,
  isOpen,
  onClose,
}) {
  const groups = groupHistoryByDate(history);

  return (
    <>
      {isOpen && (
        <button
          type="button"
          aria-label="Закрыть меню"
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed inset-y-0 left-0 z-50 flex w-[min(300px,85vw)] min-w-[250px] flex-col
          border-r border-white/[0.06] bg-[#1e1e24]/95 backdrop-blur-xl
          transition-transform duration-300 ease-out
          lg:static lg:z-auto lg:translate-x-0
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <div className="border-b border-white/[0.06] p-3">
          <p className="mb-2.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            История
          </p>
          <button
            type="button"
            onClick={onNewChat}
            className="flex w-full items-center gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-slate-200 transition-all hover:bg-white/[0.08] hover:text-white active:scale-[0.98]"
          >
            <PlusIcon className="h-4 w-4 text-blue-400" />
            Новый чат
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar px-2 py-3">
          {groups.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-slate-500">
              История пуста. Решите первую задачу!
            </p>
          ) : (
            groups.map((group) => (
              <div key={group.label} className="mb-4">
                <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  {group.label}
                </p>
                <ul className="space-y-0.5">
                  {group.items.map((item) => {
                    const isActive = item.id === activeId;
                    return (
                      <li key={item.id}>
                        <div
                          className={`
                            group relative flex w-full items-center rounded-xl transition-all duration-200
                            ${
                              isActive
                                ? "bg-blue-500/15 shadow-[inset_0_0_0_1px_rgba(96,165,250,0.2)]"
                                : "hover:bg-white/[0.06]"
                            }
                          `}
                        >
                          <button
                            type="button"
                            onClick={() => onSelect(item.id)}
                            className={`flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2.5 text-left text-sm ${
                              isActive ? "text-white" : "text-slate-400 group-hover:text-slate-200"
                            }`}
                          >
                            <ChatIcon
                              className={`h-4 w-4 shrink-0 transition-colors ${
                                isActive ? "text-blue-400" : "text-slate-500 group-hover:text-slate-400"
                              }`}
                            />
                            <span className="min-w-0 flex-1 truncate pr-6">{item.title}</span>
                            {item.status === "pending" && (
                              <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-blue-400" />
                            )}
                          </button>

                          <button
                            type="button"
                            aria-label="Удалить чат"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteChat(item.id);
                            }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-500 opacity-0 transition-all hover:bg-red-500/15 hover:text-red-400 group-hover:opacity-100"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </div>

        <div className="border-t border-white/[0.06] px-4 py-3">
          <p className="text-xs font-medium text-slate-500">AI Student PRO</p>
        </div>
      </aside>
    </>
  );
}
