import { useQuery } from "@tanstack/react-query";
import { DocsShell } from "../components/DocsShell";
import { DocMarkdown } from "../components/DocMarkdown";
import { CHANGELOG_DATES } from "../lib/changelogManifest";
import type { DocsLang } from "../lib/docsLang";

async function fetchEntry(date: string, lang: DocsLang): Promise<string | null> {
  const res = await fetch(`/docs-content/changelogs/${date}.${lang}.md`);
  if (!res.ok) return null;
  return res.text();
}

function ChangelogEntries({ lang }: { lang: DocsLang }) {
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
    <>
      <h1 className="mb-6 text-xl font-semibold text-slate-900">Changelog</h1>

      {entriesQuery.isLoading && <p className="text-sm text-slate-500">Loading…</p>}

      <div className="flex flex-col gap-8">
        {entriesQuery.data?.map(({ date, body }) => (
          <article key={date} className="rounded-lg border border-slate-200 bg-white p-6">
            {body ? (
              <DocMarkdown>{body}</DocMarkdown>
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
    </>
  );
}

export function ChangelogPage() {
  return <DocsShell>{(lang) => <ChangelogEntries lang={lang} />}</DocsShell>;
}
