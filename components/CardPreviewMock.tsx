import { PHOTO_RECT, TEXT_X0, TEXT_X1, TEXT_Y0, QR_RECT } from "@/lib/cardLogic";

const pct = (v: number) => `${v * 100}%`;

// Purely decorative — static placeholder content, not wired to any real data.
// Positioned using the exact same fractions the real canvas card uses, so the
// hero preview is honest to what the actual output looks like.
export default function CardPreviewMock() {
  return (
    <div className="card-preview-mock" aria-hidden="true">
      <div className="card-preview-frame">
        <div
          className="card-preview-photo"
          style={{
            left: pct(PHOTO_RECT.x0), top: pct(PHOTO_RECT.y0),
            width: pct(PHOTO_RECT.x1 - PHOTO_RECT.x0), height: pct(PHOTO_RECT.y1 - PHOTO_RECT.y0),
          }}
        />
        <div className="card-preview-text" style={{ left: pct(TEXT_X0), width: pct(TEXT_X1 - TEXT_X0), top: pct(TEXT_Y0) }}>
          <p className="cp-eyebrow">HH GOA 2026 · BUILDER ID</p>
          <p className="cp-name">Arjun Mehta</p>
          <p className="cp-class">The Overclocked Ship Captain</p>
          <span className="cp-chip">FULL-STACK DEV</span>
          <div className="cp-footer">
            <span className="rarity-pill" data-rarity="legendary">LEGENDARY</span>
            <span className="card-number">No. 000247</span>
          </div>
        </div>
        <div
          className="card-preview-qr"
          style={{
            left: pct(QR_RECT.x0), top: pct(QR_RECT.y0),
            width: pct(QR_RECT.x1 - QR_RECT.x0), height: pct(QR_RECT.x1 - QR_RECT.x0),
          }}
        />
        <div className="card-preview-shimmer" />
      </div>
    </div>
  );
}
