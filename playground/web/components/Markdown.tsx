import rehypeShikiFromHighlighter from "@shikijs/rehype/core";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { createHighlighterCoreSync } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import javascript from "shiki/langs/javascript.mjs";
import json from "shiki/langs/json.mjs";
import markdown from "shiki/langs/markdown.mjs";
import python from "shiki/langs/python.mjs";
import typescript from "shiki/langs/typescript.mjs";
import githubDark from "shiki/themes/github-dark.mjs";
import githubLight from "shiki/themes/github-light.mjs";
import { cn } from "../lib/cn.ts";
import { routeForLink } from "../links.ts";

// Created once, synchronously: react-markdown runs its plugins synchronously.
const highlighter = createHighlighterCoreSync({
  themes: [githubLight, githubDark],
  langs: [python, typescript, javascript, json, markdown],
  engine: createJavaScriptRegexEngine(),
});
const SHIKI = { themes: { light: "github-light", dark: "github-dark" }, defaultColor: false, fallbackLanguage: "text" } as const;

interface MarkdownProps {
  source: string;
  /** Repo-relative path of the README the text comes from; relative links resolve from its folder. */
  readmePath: string;
  /** When set, concept links call it instead of navigating (the work view opens them in its side pane). */
  onConcept?: (slug: string) => void;
  className?: string;
}

function MarkdownLink({
  href,
  readmePath,
  onConcept,
  children,
}: {
  href: string;
  readmePath: string;
  onConcept?: (slug: string) => void;
  children: ReactNode;
}) {
  const target = routeForLink(readmePath, href);
  if (target.kind === "external") {
    return (
      <a href={target.href} target="_blank" rel="noreferrer">
        {children}
      </a>
    );
  }
  if (target.kind === "none") return <span>{children}</span>;
  const { link } = target;
  if (onConcept && link.to === "/c/$slug") {
    return (
      <button type="button" className="concept-link" onClick={() => onConcept(link.params.slug)}>
        {children}
      </button>
    );
  }
  return <Link {...link}>{children}</Link>;
}

export function Markdown({ source, readmePath, onConcept, className }: MarkdownProps) {
  return (
    <div className={cn("markdown", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeShikiFromHighlighter, highlighter, SHIKI]]}
        skipHtml
        components={{
          a: ({ href, children }) => (
            <MarkdownLink href={href ?? ""} readmePath={readmePath} onConcept={onConcept}>
              {children}
            </MarkdownLink>
          ),
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
