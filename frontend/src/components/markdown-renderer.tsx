// components/markdown-renderer.tsx

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownRendererProps {
  content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div
      className="
        prose prose-base 
        dark:prose-invert
        max-w-none

        prose-p:my-0
        prose-headings:my-3
        prose-ul:my-2
        prose-ol:my-2
        prose-li:my-1

        prose-pre:my-3
        prose-pre:rounded-xl
        prose-pre:border-2
        prose-pre:border-zinc-350
        prose-pre:bg-zinc-100
        prose-pre:text-zinc-900
        dark:prose-pre:border-zinc-800
        dark:prose-pre:bg-zinc-900
        dark:prose-pre:text-zinc-100

        prose-code:before:content-none
        prose-code:after:content-none
      "
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
