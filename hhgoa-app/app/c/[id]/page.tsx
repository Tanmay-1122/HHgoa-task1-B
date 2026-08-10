import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCompleteCardById } from "@/lib/db";
import { getSiteUrl } from "@/lib/site";
import DeleteCardButton from "@/components/DeleteCardButton";
import SiteNav from "@/components/SiteNav";

export const dynamic = "force-dynamic";

type Props = { params: { id: string } };

function parseId(raw: string): number | null {
  const id = parseInt(raw, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const id = parseId(params.id);
  if (!id) return { title: "Card not found — HH Goa 2026" };

  const card = await getCompleteCardById(id);
  if (!card || !card.image_url) return { title: "Card not found — HH Goa 2026" };

  const siteUrl = getSiteUrl();
  const title = `${card.name ?? "A builder"}'s HH Goa 2026 Builder ID`;
  const description = card.builder_class
    ? `${card.builder_class} — HH Goa 2026 Builder ID No. ${String(id).padStart(6, "0")}`
    : "HH Goa 2026 Builder ID";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${siteUrl}/c/${id}`,
      images: [{ url: card.image_url, width: 1600, height: 764 }],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [card.image_url],
    },
  };
}

export default async function PublicCardPage({ params }: Props) {
  const id = parseId(params.id);
  if (!id) notFound();

  const card = await getCompleteCardById(id);
  if (!card || !card.image_url) notFound();

  return (
    <div className="page">
      <SiteNav />

      <div className="public-card-wrap">
        <div className="card-stage is-visible">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={card.image_url} alt={`${card.name ?? "Builder"}'s HH Goa 2026 Builder ID card`} />
        </div>

        <div className="result-tags">
          {card.rarity_key && (
            <span className="rarity-pill" data-rarity={card.rarity_key}>
              {card.rarity_key.toUpperCase()}
            </span>
          )}
          <span className="card-number">No. {String(id).padStart(6, "0")}</span>
        </div>

        <div className="public-card-meta">
          <h2>{card.name}</h2>
          <p>{card.builder_class}</p>
        </div>

        <div className="action-bar">
          <a className="btn btn--secondary btn--full" href={card.image_url} download={`hh-goa-2026-builder-id-${id}.png`}>
            Download
          </a>
        </div>

        <DeleteCardButton id={id} />
      </div>

      <footer className="site-footer">
        <p>
          Not an official HH Goa page — a builder ID tool made for the shortlisting task. Tag{" "}
          <strong>#FrameInGoa</strong> when you post.
        </p>
      </footer>
    </div>
  );
}
