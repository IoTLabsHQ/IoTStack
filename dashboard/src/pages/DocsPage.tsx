import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useDocsLang } from "../lib/docsLang";
import { CHANGELOG_DATES } from "../lib/changelogManifest";

async function fetchEntry(date: string, lang: string): Promise<string | null> {
  const res = await fetch(`/docs-content/changelogs/${date}.${lang}.md`);
  if (!res.ok) return null;
  return res.text();
}

const markdownComponents = {
  h1: (props: React.ComponentPropsWithoutRef<"h1">) => (
    <h2 className="mb-4 text-lg font-semibold text-slate-900" {...props} />
  ),
  h2: (props: React.ComponentPropsWithoutRef<"h2">) => (
    <h3 className="mb-2 text-sm font-semibold text-slate-700" {...props} />
  ),
  ul: (props: React.ComponentPropsWithoutRef<"ul">) => (
    <ul className="list-disc space-y-2 pl-5 text-sm text-slate-700" {...props} />
  ),
  p: (props: React.ComponentPropsWithoutRef<"p">) => (
    <p className="text-sm text-slate-700" {...props} />
  ),
  strong: (props: React.ComponentPropsWithoutRef<"strong">) => (
    <strong className="font-semibold text-slate-900" {...props} />
  ),
};

export function DocsPage() {
  const [lang, setLang] = useDocsLang();

  const entriesQuery = useQuery({
    queryKey: ["changelog-entries", lang],
    queryFn: async () => {
      const entries = await Promise.all(
        CHANGELOG_DATES.map(async (date) => ({ date, body: await fetchEntry(date, lang) })),
      );
      return entries;
    },
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link to="/" className="text-lg font-semibold tracking-tight">
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

      <main className="mx-auto max-w-3xl px-6 py-8">
        <h1 className="mb-6 text-xl font-semibold text-slate-900">Changelog</h1>

        {entriesQuery.isLoading && <p className="text-sm text-slate-500">Loading…</p>}

        <div className="flex flex-col gap-8">
          {entriesQuery.data?.map(({ date, body }) => (
            <article
              key={date}
              className="rounded-lg border border-slate-200 bg-white p-6"
            >
              {body ? (
                <Markdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                  {body}
                </Markdown>
              ) : (
                <p className="text-sm text-slate-500">
                  {lang === "vi"
                    ? `Chưa có bản dịch tiếng Việt cho ${date}.`
                    : `Not translated yet for ${date}.`}
                </p>
              )}
            </article>
          ))}
        </div>
      </main>
    </div>
  );
}
