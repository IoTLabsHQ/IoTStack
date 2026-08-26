import { useState } from "react";
import { copyToClipboard } from "../lib/clipboard";
import { triggerDownload } from "../lib/download";
import { slugify } from "../lib/slugify";
import { buildCredentialText, buildCredentialCsv, type CredentialInfo } from "../lib/credentialExport";

export function CredentialActions({ credential }: { credential: CredentialInfo }) {
  const [copyLabel, setCopyLabel] = useState("Copy");
  const host = window.location.hostname;

  async function handleCopy() {
    const ok = await copyToClipboard(buildCredentialText(credential, host));
    setCopyLabel(ok ? "Copied!" : "Copy failed");
    setTimeout(() => setCopyLabel("Copy"), 1500);
  }

  function handleCsv() {
    triggerDownload(
      `${slugify(credential.displayName)}.csv`,
      buildCredentialCsv(credential, host),
      "text/csv",
    );
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={handleCopy}
        className="rounded-md border border-amber-400 px-3 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100"
      >
        {copyLabel}
      </button>
      <button
        onClick={handleCsv}
        className="rounded-md border border-amber-400 px-3 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100"
      >
        Download CSV
      </button>
    </div>
  );
}
