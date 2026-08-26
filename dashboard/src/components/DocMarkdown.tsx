import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ComponentPropsWithoutRef } from "react";

const components = {
  h1: (props: ComponentPropsWithoutRef<"h1">) => (
    <h2 className="mb-4 text-lg font-semibold text-slate-900" {...props} />
  ),
  h2: (props: ComponentPropsWithoutRef<"h2">) => (
    <h3 className="mt-6 mb-2 text-sm font-semibold text-slate-700 first:mt-0" {...props} />
  ),
  h3: (props: ComponentPropsWithoutRef<"h3">) => (
    <h4 className="mt-4 mb-2 text-sm font-semibold text-slate-700" {...props} />
  ),
  ul: (props: ComponentPropsWithoutRef<"ul">) => (
    <ul className="mb-3 list-disc space-y-1.5 pl-5 text-sm text-slate-700" {...props} />
  ),
  ol: (props: ComponentPropsWithoutRef<"ol">) => (
    <ol className="mb-3 list-decimal space-y-1.5 pl-5 text-sm text-slate-700" {...props} />
  ),
  p: (props: ComponentPropsWithoutRef<"p">) => (
    <p className="mb-3 text-sm text-slate-700 last:mb-0" {...props} />
  ),
  strong: (props: ComponentPropsWithoutRef<"strong">) => (
    <strong className="font-semibold text-slate-900" {...props} />
  ),
  blockquote: (props: ComponentPropsWithoutRef<"blockquote">) => (
    <blockquote
      className="mb-3 border-l-2 border-slate-300 pl-3 text-sm text-slate-600"
      {...props}
    />
  ),
  code: (props: ComponentPropsWithoutRef<"code">) => (
    <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs" {...props} />
  ),
  pre: (props: ComponentPropsWithoutRef<"pre">) => (
    <pre
      className="mb-3 overflow-x-auto rounded-md bg-slate-900 p-3 font-mono text-xs text-slate-100"
      {...props}
    />
  ),
  a: (props: ComponentPropsWithoutRef<"a">) => (
    <a className="text-slate-900 underline underline-offset-2 hover:text-slate-600" {...props} />
  ),
  table: (props: ComponentPropsWithoutRef<"table">) => (
    <div className="mb-3 overflow-x-auto">
      <table className="w-full border-collapse text-sm" {...props} />
    </div>
  ),
  th: (props: ComponentPropsWithoutRef<"th">) => (
    <th
      className="border-b border-slate-300 px-2 py-1.5 text-left font-semibold text-slate-900"
      {...props}
    />
  ),
  td: (props: ComponentPropsWithoutRef<"td">) => (
    <td className="border-b border-slate-100 px-2 py-1.5 align-top text-slate-700" {...props} />
  ),
};

export function DocMarkdown({ children }: { children: string }) {
  return (
    <Markdown remarkPlugins={[remarkGfm]} components={components}>
      {children}
    </Markdown>
  );
}
