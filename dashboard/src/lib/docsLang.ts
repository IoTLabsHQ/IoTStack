import { useEffect, useState } from "react";

export type DocsLang = "en" | "vi";

const STORAGE_KEY = "iotstack-docs-lang";

function detectDefault(): DocsLang {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "en" || stored === "vi") return stored;
  return navigator.language.toLowerCase().startsWith("vi") ? "vi" : "en";
}

export function useDocsLang() {
  const [lang, setLangState] = useState<DocsLang>(detectDefault);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, lang);
  }, [lang]);

  return [lang, setLangState] as const;
}
