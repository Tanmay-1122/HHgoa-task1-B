export default function SiteNav({ active }: { active?: "home" | "gallery" }) {
  return (
    <nav className="site-nav">
      <a href="/" className="site-nav-mark">
        <span className="site-nav-badge">HH</span>
        <span>GOA 2026</span>
      </a>
      <a href="/gallery" className={active === "gallery" ? "is-current" : ""}>
        {active === "gallery" ? "Gallery" : "Gallery →"}
      </a>
    </nav>
  );
}
