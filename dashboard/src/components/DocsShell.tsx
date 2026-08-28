import type { ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { useDocsLang, type DocsLang } from "../lib/docsLang";
import { DOC_GROUPS } from "../lib/docs-manifest";
import { navItems } from "./Shell";
import { useAuthStore } from "../store/authStore";

function DocsNav({ lang }: { lang: DocsLang }) {
  return (
    <nav className="flex flex-col gap-5">
      <NavLink
        to="/docs/changelog"
        className={({ isActive }) =>
          `text-sm font-medium ${isActive ? "text-slate-900" : "text-slate-600 hover:text-slate-900"}`
        }
      >
        {lang === "vi" ? "Nhật ký thay đổi" : "Changelog"}
      </NavLink>

      {DOC_GROUPS.map((g) => (
        <div key={g.group}>
          <p className="mb-2 text-xs font-semibold tracking-wide text-slate-400 uppercase">
            {g.groupLabel[lang]}
          </p>
          <ul className="flex flex-col gap-2">
            {g.docs.map((d) => (
              <li key={d.slug}>
                <NavLink
                  to={`/docs/${g.group}/${d.slug}`}
                  className={({ isActive }) =>
                    `text-sm ${isActive ? "font-medium text-slate-900" : "text-slate-600 hover:text-slate-900"}`
                  }
                >
                  {d.title[lang]}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function DocsShell({ children }: { children: (lang: DocsLang) => ReactNode }) {
  const [lang, setLang] = useDocsLang();
  const admin = useAuthStore((s) => s.admin);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-8">
            <Link to="/docs" className="leading-tight">
              <span className="text-lg font-semibold tracking-tight">IoTStack</span>
              <span className="block text-[11px] font-medium text-slate-400">v{__APP_VERSION__}</span>
            </Link>
            {admin && (
              <nav className="flex gap-1">
                {navItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === "/"}
                    className={({ isActive }) =>
                      `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-slate-900 text-white"
                          : "text-slate-600 hover:bg-slate-100"
                      }`
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
              </nav>
            )}
          </div>
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
      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-8 md:flex-row">
        <aside className="shrink-0 md:w-56">
          <DocsNav lang={lang} />
        </aside>
        <main className="min-w-0 max-w-3xl flex-1">{children(lang)}</main>
      </div>
    </div>
  );
}
