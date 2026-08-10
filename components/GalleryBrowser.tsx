"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ROLE_CATEGORIES, type RoleCategory, type CardRow } from "@/lib/cardLogic";

export default function GalleryBrowser() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<RoleCategory | null>(null);
  const [cards, setCards] = useState<CardRow[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (opts: { q: string; category: RoleCategory | null; page: number; append: boolean }) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      const trimmed = opts.q.trim();
      if (trimmed) {
        if (/^\d+$/.test(trimmed)) params.set("id", trimmed);
        else params.set("q", trimmed);
      }
      if (opts.category) params.set("category", opts.category);
      params.set("page", String(opts.page));

      const res = await fetch(`/api/gallery?${params.toString()}`);
      if (!res.ok) throw new Error("Search failed.");
      const data = await res.json();
      setCards((prev) => (opts.append ? [...prev, ...data.cards] : data.cards));
      setHasMore(Boolean(data.hasMore));
      setPage(opts.page);
    } catch (err: any) {
      setError(err?.message || "Couldn't load the gallery.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      load({ q: query, category, page: 0, append: false });
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, category]);

  return (
    <div className="gallery-wrap">
      <div className="search-bar">
        <input
          type="text"
          placeholder="Search by name, or enter a card ID…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="category-chips">
        <button
          type="button"
          className="category-chip"
          data-active={category === null}
          onClick={() => setCategory(null)}
        >
          All
        </button>
        {ROLE_CATEGORIES.map((c) => (
          <button
            key={c.key}
            type="button"
            className="category-chip"
            data-active={category === c.key}
            onClick={() => setCategory((prev) => (prev === c.key ? null : c.key))}
          >
            {c.label}
          </button>
        ))}
      </div>

      {error && <p style={{ color: "#ff9d9d", fontSize: 13 }}>{error}</p>}

      {!loading && cards.length === 0 && !error && (
        <p className="gallery-empty">No cards found. Be the first to show up here.</p>
      )}

      <div className="gallery-grid">
        {cards.map((card) => (
          <a key={card.id} className="gallery-card" href={`/c/${card.id}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={card.image_url ?? ""} alt={`${card.name ?? "Builder"}'s card`} loading="lazy" />
            <div className="gallery-card-meta">
              <span>{card.name}</span>
              <span>No. {String(card.id).padStart(6, "0")}</span>
            </div>
          </a>
        ))}
      </div>

      {hasMore && (
        <div className="gallery-loadmore">
          <button
            type="button"
            className="btn btn--ghost"
            disabled={loading}
            onClick={() => load({ q: query, category, page: page + 1, append: true })}
          >
            {loading ? "Loading…" : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}
