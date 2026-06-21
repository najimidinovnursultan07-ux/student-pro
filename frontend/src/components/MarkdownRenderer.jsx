import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

export default function MarkdownRenderer({ children }) {
  return (
    <div className="markdown-content text-[15px] leading-relaxed text-slate-200">
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          code({ inline, className, children: codeChildren, ...props }) {
            if (inline) {
              return (
                <code
                  className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[13px] text-blue-200"
                  {...props}
                >
                  {codeChildren}
                </code>
              );
            }
            return (
              <pre className="my-3 overflow-x-auto rounded-xl border border-white/10 bg-[#0d0d12] p-4 custom-scrollbar">
                <code className={`font-mono text-[13px] text-slate-300 ${className || ""}`} {...props}>
                  {codeChildren}
                </code>
              </pre>
            );
          },
          p({ children }) {
            return <p className="mb-3 last:mb-0">{children}</p>;
          },
          ul({ children }) {
            return <ul className="mb-3 list-disc space-y-1 pl-5">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="mb-3 list-decimal space-y-1 pl-5">{children}</ol>;
          },
          li({ children }) {
            return <li className="text-slate-300">{children}</li>;
          },
          h1({ children }) {
            return <h1 className="mb-3 text-xl font-semibold text-white">{children}</h1>;
          },
          h2({ children }) {
            return <h2 className="mb-2 text-lg font-semibold text-white">{children}</h2>;
          },
          h3({ children }) {
            return <h3 className="mb-2 text-base font-semibold text-slate-100">{children}</h3>;
          },
          blockquote({ children }) {
            return (
              <blockquote className="my-3 border-l-2 border-blue-400/50 pl-4 text-slate-400 italic">
                {children}
              </blockquote>
            );
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
