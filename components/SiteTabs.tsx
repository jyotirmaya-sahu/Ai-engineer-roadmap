import Link from "next/link";

export default function SiteTabs({ active }: { active: "plan" | "roadmap" }) {
  return (
    <nav className="site-tabs" aria-label="Roadmap views">
      <Link className={active === "plan" ? "active" : ""} href="/" aria-current={active === "plan" ? "page" : undefined}>
        Daily plan
      </Link>
      <Link
        className={active === "roadmap" ? "active" : ""}
        href="/roadmap"
        aria-current={active === "roadmap" ? "page" : undefined}
      >
        Full roadmap
      </Link>
    </nav>
  );
}
