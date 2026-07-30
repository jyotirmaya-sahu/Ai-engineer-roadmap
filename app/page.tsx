import Link from "next/link";
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

export default function Home() {
  let flip = 0;
  return (
    <>
      <div className="top">
        <h1>AI Engineer — Detailed Roadmap</h1>
        <p>
          Every topic broken down concept-by-concept. <b>📖 Click any yellow node to read the full article.</b> · Dubai,
          interview-ready by Aug 31
        </p>
      </div>

      <div className="road">
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
      </div>

      <div className="foot">Detailed syllabus built from your 47-day plan + 46-skill tracker</div>
    </>
  );
}
