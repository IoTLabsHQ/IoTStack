import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { DocsShell } from "../components/DocsShell";
import { DocMarkdown } from "../components/DocMarkdown";
import { DOC_GROUPS } from "../lib/docs-manifest";
import type { DocsLang } from "../lib/docsLang";

function DocBody({ group, slug, lang }: { group: string; slug: string; lang: DocsLang }) {
  const groupDef = DOC_GROUPS.find((g) => g.group === group);
  const docDef = groupDef?.docs.find((d) => d.slug === slug);

  const contentQuery = useQuery({
    queryKey: ["doc-content", group, slug, lang],
    queryFn: async () => {
      const res = await fetch(`/docs-content/${group}/${docDef!.num}_${slug}.${lang}.md`);
      if (!res.ok) return null;
      return res.text();
    },
    enabled: !!docDef,
  });

  if (!groupDef || !docDef) {
    return (
      <div>
        <p className="mb-4 text-sm text-slate-500">
          {lang === "vi" ? "Không tìm thấy tài liệu này." : "This doc doesn't exist."}
        </p>
        <Link to="/docs" className="text-sm text-slate-900 underline">
          {lang === "vi" ? "← Tất cả tài liệu" : "← All docs"}
        </Link>
      </div>
    );
  }

  return (
    <>
      <Link
        to="/docs"
        className="mb-4 inline-block text-sm text-slate-500 hover:text-slate-900 hover:underline"
      >
        {lang === "vi" ? "← Tất cả tài liệu" : "← All docs"}
      </Link>
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        {contentQuery.isLoading && <p className="text-sm text-slate-500">Loading…</p>}
        {contentQuery.data ? (
          <DocMarkdown>{contentQuery.data}</DocMarkdown>
        ) : (
          contentQuery.isFetched && (
            <p className="text-sm text-slate-500">
              {lang === "vi" ? "Chưa có bản dịch tiếng Việt." : "Not translated yet."}
            </p>
          )
        )}
      </div>
    </>
  );
}

export function DocDetailPage() {
  const { group, slug } = useParams();

  return (
    <DocsShell>
      {(lang) => <DocBody group={group ?? ""} slug={slug ?? ""} lang={lang} />}
    </DocsShell>
  );
}
