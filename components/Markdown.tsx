"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeHighlight from "rehype-highlight";
import { usePathname } from "next/navigation";

function articleHref(href: string | undefined, pathname: string) {
  if (!href || href.startsWith("#") || /^[a-z][a-z0-9+.-]*:/i.test(href)) {
    return href;
  }

  // Some generated articles used content-style absolute paths such as
  // /evaluation/faithfulness. Map those to the real application routes too.
  if (href.startsWith("/") && !href.startsWith("/topic/") && !href.startsWith("/learn/")) {
    const [rawPath, hash] = href.split("#", 2);
    const absoluteParts = rawPath.split("/").filter(Boolean);
    const target =
      absoluteParts.length === 1
        ? `/topic/${absoluteParts[0]}`
        : `/learn/${absoluteParts[0]}/${absoluteParts.slice(1).join("/")}`;
    return hash ? `${target}#${hash}` : target;
  }

  if (!href.includes(".md")) return href;
  const [rawPath, hash] = href.split("#", 2);
  if (!rawPath.endsWith(".md")) return href;
  const route = pathname.split("/").filter(Boolean);
  const parts = route[0] === "learn" && route[1] ? [route[1]] : [];
  for (const part of rawPath.replace(/^\//, "").split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  parts[parts.length - 1] = parts.at(-1)!.replace(/\.md$/, "");
  const target =
    parts.length === 1
      ? `/topic/${parts[0]}`
      : `/learn/${parts[0]}/${parts.slice(1).join("/")}`;
  return hash ? `${target}#${hash}` : target;
}

// Diagrams are hand-authored as raw HTML (<div class="diagram">…) inside the
// markdown, rendered via rehype-raw. No mermaid — always visible, styled to match.
export default function Markdown({ children }: { children: string }) {
  const pathname = usePathname();
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw, [rehypeHighlight, { detect: true, ignoreMissing: true }]]}
      components={{
        a: ({ href, children: linkChildren, node: _node, ...props }) => (
          <a href={articleHref(href, pathname)} {...props}>
            {linkChildren}
          </a>
        ),
      }}
    >
      {children}
    </ReactMarkdown>
  );
}
