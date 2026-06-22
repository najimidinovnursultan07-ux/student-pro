import { Component } from "react";

export class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      message: error?.message || "Неизвестная ошибка",
    };
  }

  componentDidCatch(error, info) {
    console.error("[AI Student PRO] Render error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[#131314] px-4 text-slate-200">
          <div className="max-w-md rounded-2xl border border-red-400/40 bg-[#1e1e24] p-6 text-center">
            <h1 className="text-lg font-semibold text-white">Ошибка загрузки</h1>
            <p className="mt-3 text-sm text-slate-400">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 rounded-xl bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-400"
            >
              Перезагрузить
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
