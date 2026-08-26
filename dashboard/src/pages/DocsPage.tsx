import { Link } from "react-router-dom";
import { DocsShell } from "../components/DocsShell";
import { DOC_GROUPS } from "../lib/docs-manifest";
import type { DocsLang } from "../lib/docsLang";

function DocsIndex({ lang }: { lang: DocsLang }) {
  return (
    <>
      <h1 className="mb-6 text-xl font-semibold text-slate-900">
        {lang === "vi" ? "Tài liệu" : "Documentation"}
      </h1>

      <Link
        to="/docs/changelog"
        className="mb-6 block rounded-lg border border-slate-200 bg-white px-5 py-4 font-medium text-slate-900 hover:border-slate-300"
      >
        {lang === "vi" ? "Nhật ký thay đổi" : "Changelog"}
      </Link>

      <div className="flex flex-col gap-6">
        {DOC_GROUPS.map((g) => (
          <section key={g.group} className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">{g.groupLabel[lang]}</h2>
            <ul className="flex flex-col gap-1.5">
              {g.docs.map((d) => (
                <li key={d.slug}>
                  <Link
                    to={`/docs/${g.group}/${d.slug}`}
                    className="text-sm text-slate-700 hover:text-slate-900 hover:underline"
                  >
                    {d.title[lang]}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}

export function DocsPage() {
  return <DocsShell>{(lang) => <DocsIndex lang={lang} />}</DocsShell>;
}
