import { NextRequest, NextResponse } from "next/server";
import { getDeleteTokenHash, getImageUrlById, deleteCardById } from "@/lib/db";
import { tokensMatch } from "@/lib/hash";
import { deleteCardImage } from "@/lib/blob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const id = parseInt(params.id, 10);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid card id." }, { status: 400 });
  }

  let deleteToken = "";
  try {
    const body = await req.json();
    deleteToken = String(body?.deleteToken ?? "");
  } catch {
    // no/invalid body — falls through to the mismatch response below
  }

  const storedHash = await getDeleteTokenHash(id);

  // Deliberately identical response whether the id doesn't exist or the
  // token is wrong — don't let this endpoint be used to probe which IDs exist.
  if (!storedHash || !deleteToken || !tokensMatch(deleteToken, storedHash)) {
    return NextResponse.json({ error: "Not authorized to delete this card." }, { status: 403 });
  }

  const imageUrl = await getImageUrlById(id);
  if (imageUrl) await deleteCardImage(imageUrl);
  await deleteCardById(id);

  return NextResponse.json({ deleted: true });
}
