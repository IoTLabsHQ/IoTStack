import { Link } from "react-router-dom";
import { Shell } from "../components/Shell";
import { TEMPLATES } from "../lib/templates-manifest";
import { useDocsLang } from "../lib/docsLang";

export function TemplateGalleryPage() {
  const [lang] = useDocsLang();

  return (
    <Shell>
      <h1 className="mb-1 text-lg font-semibold text-slate-900">
        {lang === "vi" ? "Dự án mẫu" : "Sample projects"}
      </h1>
      <p className="mb-6 text-sm text-slate-500">
        {lang === "vi"
          ? "Chọn một dự án mẫu để tạo thiết bị, control, và code nạp sẵn — chỉ vài bước."
          : "Pick a sample project to get a device, controls, and ready-to-flash code — in a few clicks."}
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {TEMPLATES.map((t) => (
          <Link
            key={t.id}
            to={`/templates/${t.id}`}
            className="rounded-lg border border-slate-200 bg-white p-5 hover:border-slate-300"
          >
            <p className="font-medium text-slate-900">{t.title[lang]}</p>
          </Link>
        ))}
      </div>
    </Shell>
  );
}
