import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useDocsLang, type DocsLang } from "../lib/docsLang";

export function DocsShell({ children }: { children: (lang: DocsLang) => ReactNode }) {
  const [lang, setLang] = useDocsLang();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link to="/docs" className="text-lg font-semibold tracking-tight">
            IoTStack
          </Link>
          <div className="flex gap-1 rounded-md border border-slate-300 p-0.5 text-sm">
            {(["en", "vi"] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`rounded px-2 py-1 font-medium ${
                  lang === l ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-8">{children(lang)}</main>
    </div>
  );
}
