import SiteNav from "@/components/SiteNav";

export default function NotFound() {
  return (
    <div className="page">
      <SiteNav />
      <div style={{ textAlign: "center", marginTop: 60 }}>
        <p className="eyebrow">HH GOA 2026</p>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 32 }}>Card not found</h1>
        <p className="subhead">It may have been deleted, or the link is off.</p>
      </div>
    </div>
  );
}
