import type { Metadata } from "next";
import GalleryBrowser from "@/components/GalleryBrowser";
import SiteNav from "@/components/SiteNav";

export const metadata: Metadata = {
  title: "Gallery — HH Goa 2026 Builder IDs",
  description: "Browse Builder ID cards from HH Goa 2026 — search by name, ID, or interest.",
};

export default function GalleryPage() {
  return (
    <div className="page">
      <SiteNav active="gallery" />

      <header className="site-header">
        <p className="eyebrow">HH GOA 2026</p>
        <h1 style={{ fontSize: "clamp(24px, 5vw, 36px)" }}>Builder Gallery</h1>
        <p className="subhead">Find builders by name, card ID, or interest.</p>
      </header>

      <main id="app" style={{ maxWidth: 900 }}>
        <GalleryBrowser />
      </main>

      <footer className="site-footer">
        <p>
          Not an official HH Goa page — a builder ID tool made for the shortlisting task. Tag{" "}
          <strong>#FrameInGoa</strong> when you post.
        </p>
      </footer>
    </div>
  );
}
