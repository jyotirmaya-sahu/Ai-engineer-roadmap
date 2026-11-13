import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import Markdown from "@/components/Markdown";
import { roadmap, isSection, slugify, Tile } from "@/lib/roadmap";

const CONTENT = path.join(process.cwd(), "content");
type Topic = Extract<(typeof roadmap)[number], { node: string }>;
const tileText = (t: Tile) => (typeof t === "string" ? t : t.t);

export function generateStaticParams() {
  return roadmap.filter((e) => !isSection(e)).map((e) => ({ slug: slugify((e as Topic).node) }));
}

function findNode(slug: string): Topic | undefined {
  return roadmap.find((e) => !isSection(e) && slugify((e as Topic).node) === slug) as Topic | undefined;
}

export default function TopicPage({ params }: { params: { slug: string } }) {
  const { slug } = params;
  const node = findNode(slug);
  const title = node ? node.node : slug.replace(/-/g, " ");
  const file = path.join(CONTENT, slug + ".md");
  const md = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;

  return (
    <>
      <div className="abar">
        <Link href="/roadmap">← Back to roadmap</Link>
        <span className="crumb">{title}</span>
      </div>
      <article className="prose">
        {md ? (
          <Markdown>{md}</Markdown>
        ) : (
          <h1>{title}</h1>
        )}

        {node && (
          <>
            <hr />
            <h2>📚 Deep dives — every topic in this node</h2>
            <p>Click any topic for its own full article.</p>
            {node.groups.map((g, gi) => (
              <div key={gi}>
                <div className="grp">{g.h}</div>
                <div className="tiles">
                  {g.tiles.map((t, i) => (
                    <Link className="tile" href={`/learn/${slug}/${slugify(tileText(t))}`} key={i}>
                      {tileText(t)}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
      </article>
    </>
  );
}
