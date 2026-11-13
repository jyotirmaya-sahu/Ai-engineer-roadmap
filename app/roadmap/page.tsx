import Link from "next/link";
import SiteTabs from "@/components/SiteTabs";
import { roadmap, isSection, slugify, Tile } from "@/lib/roadmap";

function tileEl(nodeSlug: string) {
  return function (t: Tile, i: number) {
    const o = typeof t === "string" ? { t } : t;
    const cls = "tile" + ((o as any).cls ? " " + (o as any).cls : "");
    return (
      <Link className={cls} href={`/learn/${nodeSlug}/${slugify(o.t)}`} key={i}>
        {o.t}
        {(o as any).sub && <small>{(o as any).sub}</small>}
      </Link>
    );
  };
}

export default function RoadmapPage() {
  let flip = 0;
  return (
    <>
      <header className="top">
        <SiteTabs active="roadmap" />
        <h1>AI Engineer — Detailed Roadmap</h1>
        <p>
          Every topic broken down concept-by-concept. <b>📖 Click any roadmap node to read the full article.</b>
        </p>
      </header>

      <main className="road">
        {roadmap.map((e, idx) => {
          if (isSection(e)) {
            return (
              <div className="section" key={idx}>
                <span>{e.sec}</span>
              </div>
            );
          }
          const side = flip++ % 2 ? "left" : "right";
          const node = (
            <Link className="node" href={`/topic/${slugify(e.node)}`} key="n">
              {e.node}
              {e.tag && <small>{e.tag}</small>}
            </Link>
          );
          const panel = (
            <div className="panel" key="p">
              {e.lead && <div className="panel-lead">{e.lead}</div>}
              {e.groups.map((g, gi) => (
                <div key={gi}>
                  <div className="grp">{g.h}</div>
                  <div className="tiles">{g.tiles.map(tileEl(slugify(e.node)))}</div>
                </div>
              ))}
            </div>
          );
          return (
            <div className={"row " + side} key={idx}>
              {side === "right" ? (
                <>
                  <div />
                  {node}
                  {panel}
                </>
              ) : (
                <>
                  {panel}
                  {node}
                  <div />
                </>
              )}
            </div>
          );
        })}
      </main>

      <footer className="foot">The complete curriculum behind the daily execution plan</footer>
    </>
  );
}
