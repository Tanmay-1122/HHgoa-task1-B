import { NextRequest, NextResponse } from "next/server";
import { insertPendingCard } from "@/lib/db";
import { generateDeleteToken, hashToken } from "@/lib/hash";
import { isRateLimited, clientIp } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many cards created from this connection — try again in a minute." },
      { status: 429 }
    );
  }

  try {
    const deleteToken = generateDeleteToken();
    const deleteTokenHash = hashToken(deleteToken);
    const id = await insertPendingCard(deleteTokenHash);
    return NextResponse.json({ id, deleteToken });
  } catch (err) {
    console.error("reserve failed:", err);
    return NextResponse.json({ error: "Could not reserve a card ID." }, { status: 500 });
  }
}
