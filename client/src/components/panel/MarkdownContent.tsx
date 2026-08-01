import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import type { ComponentPropsWithoutRef } from "react";

/**
 * Renders AI tutor output as polished documentation rather than raw text.
 * Supports GitHub-flavored markdown (tables, strikethrough, task lists),
 * LaTeX math via KaTeX (inline $..$ and display $$..$$), and syntax-
 * highlighted fenced code blocks.
 */
export function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="axium-markdown prose prose-invert prose-sm max-w-none break-words prose-p:leading-relaxed prose-headings:font-semibold prose-headings:text-ink prose-a:text-accent prose-a:break-all prose-a:no-underline hover:prose-a:underline prose-strong:text-ink prose-code:text-accent prose-code:before:content-none prose-code:after:content-none prose-blockquote:border-l-accent/40 prose-blockquote:text-ink-muted prose-hr:border-border prose-th:text-ink prose-td:text-ink-muted prose-pre:bg-surface prose-pre:border prose-pre:border-border">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex, rehypeHighlight]}
        components={{
          // Tables render at their natural width and don't shrink to fit a
          // narrow panel on their own — wrapping in a scroll container keeps
          // an overly wide table from forcing the whole page to scroll
          // sideways, especially inside the mobile bottom sheet.
          table: ({ ...props }: ComponentPropsWithoutRef<"table">) => (
            <div className="overflow-x-auto">
              <table {...props} />
            </div>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
