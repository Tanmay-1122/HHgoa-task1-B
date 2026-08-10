import Generator from "@/components/Generator";
import CardPreviewMock from "@/components/CardPreviewMock";
import SiteNav from "@/components/SiteNav";

export default function HomePage() {
  return (
    <div className="page">
      <SiteNav active="home" />

      <section className="hero">
        <div>
          <p className="hero-kicker">Unofficial · builder-made for #FrameInGoa</p>
          <h1 className="hero-headline">Pull your
            <br />Builder Card.</h1>
          <p className="hero-sub">
            Upload a photo. Get an HH Goa 2026 Builder ID — with a rarity only the card decides.
            Every card gets its own link and a scannable QR, ready to post.
          </p>

          <div className="rarity-legend">
            <span className="rarity-pill" data-rarity="common">COMMON</span>
            <span className="rarity-pill" data-rarity="rare">RARE</span>
            <span className="rarity-pill" data-rarity="epic">EPIC</span>
            <span className="rarity-pill" data-rarity="legendary">LEGENDARY</span>
          </div>

          <a href="#pack" className="btn btn--primary hero-cta">Generate My Card</a>
          <p className="hero-steps">
            <span>Upload</span><span>→</span><span>Auto-frame</span><span>→</span><span>Share</span>
          </p>
        </div>

        <CardPreviewMock />
      </section>

      <section id="pack" className="pack-section">
        <p className="pack-kicker">Open your pack</p>
        <h2 className="pack-heading">Build yours</h2>
        <main id="app">
          <Generator />
        </main>
      </section>

      <footer className="site-footer">
        <p>
          Not an official HH Goa page — a builder ID tool made for the shortlisting task. Tag{" "}
          <strong>#FrameInGoa</strong> when you post.
        </p>
      </footer>
    </div>
  );
}
