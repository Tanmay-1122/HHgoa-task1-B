"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getMyDeleteToken, forgetCard } from "@/lib/myCards";

export default function DeleteCardButton({ id }: { id: number }) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setToken(getMyDeleteToken(id));
  }, [id]);

  if (!token) return null;

  async function handleDelete() {
    if (!token || isDeleting) return;
    if (!window.confirm("Delete this card permanently? This can't be undone.")) return;
    setIsDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/cards/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deleteToken: token }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Couldn't delete the card.");
      }
      forgetCard(id);
      router.push("/");
    } catch (err: any) {
      setError(err?.message || "Couldn't delete the card.");
      setIsDeleting(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <button className="btn btn--danger" type="button" onClick={handleDelete} disabled={isDeleting}>
        {isDeleting ? "Deleting…" : "Delete my card"}
      </button>
      {error && <p style={{ fontSize: 12, color: "#ff9d9d" }}>{error}</p>}
    </div>
  );
}
