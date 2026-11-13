import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import Markdown from "@/components/Markdown";
import { roadmap, isSection, slugify, Tile } from "@/lib/roadmap";

const CONTENT = path.join(process.cwd(), "content");

type Topic = Extract<(typeof roadmap)[number], { node: string }>;

function tileText(t: Tile) {
  return typeof t === "string" ? t : t.t;
}

export function generateStaticParams() {
  const params: { node: string; topic: string }[] = [];
  for (const e of roadmap) {
    if (isSection(e)) continue;
    const nodeSlug = slugify(e.node);
    for (const g of e.groups) for (const t of g.tiles) {
      params.push({ node: nodeSlug, topic: slugify(tileText(t)) });
    }
  }
  return params;
}

function findNode(nodeSlug: string): Topic | undefined {
  return roadmap.find((e) => !isSection(e) && slugify((e as Topic).node) === nodeSlug) as Topic | undefined;
}

function siblingTiles(node: Topic, topicSlug: string) {
  const all = node.groups.flatMap((g) => g.tiles.map(tileText));
  const idx = all.findIndex((t) => slugify(t) === topicSlug);
  return {
    label: all.find((t) => slugify(t) === topicSlug) || topicSlug.replace(/-/g, " "),
    prev: idx > 0 ? all[idx - 1] : null,
    next: idx >= 0 && idx < all.length - 1 ? all[idx + 1] : null,
  };
}

export default function LearnPage({ params }: { params: { node: string; topic: string } }) {
  const { node: nodeSlug, topic: topicSlug } = params;
  const node = findNode(nodeSlug);
  const info = node ? siblingTiles(node, topicSlug) : { label: topicSlug.replace(/-/g, " "), prev: null, next: null };

  const file = path.join(CONTENT, nodeSlug, topicSlug + ".md");
  const md = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;

  return (
    <>
      <div className="abar">
        <Link href="/roadmap">← Roadmap</Link>
        {node && (
          <>
            <span className="crumb">·</span>
            <Link href={`/topic/${nodeSlug}`}>{node.node}</Link>
          </>
        )}
        <span className="crumb">/ {info.label}</span>
      </div>
      <article className="prose">
        {md ? (
          <Markdown>{md}</Markdown>
        ) : (
          <>
            <h1>{info.label}</h1>
            <div className="notyet">
              <b>This deep-dive is being written.</b>
              <br />
              Part of <b>{node?.node ?? nodeSlug}</b>. Tell Claude: <code>write the article for {info.label}</code>.
            </div>
          </>
        )}

        {node && (
          <p style={{ marginTop: 40, display: "flex", justifyContent: "space-between", gap: 12 }}>
            {info.prev ? (
              <Link href={`/learn/${nodeSlug}/${slugify(info.prev)}`}>← {info.prev}</Link>
            ) : (
              <span />
            )}
            {info.next && <Link href={`/learn/${nodeSlug}/${slugify(info.next)}`}>{info.next} →</Link>}
          </p>
        )}
      </article>
    </>
  );
}
