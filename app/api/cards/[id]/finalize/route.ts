import { NextRequest, NextResponse } from "next/server";
import { finalizeCard } from "@/lib/db";
import { uploadCardImage } from "@/lib/blob";
import { isValidRoleCategory, RARITIES, type RarityKey } from "@/lib/cardLogic";
import { getSiteUrl } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_NAME_LEN = 24;
const MAX_ROLE_LEN = 28;
const MAX_CLASS_LEN = 60;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB is generous for a 1600x764 PNG

function isRarityKey(v: string): v is RarityKey {
  return RARITIES.some((r) => r.key === v);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const id = parseInt(params.id, 10);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid card id." }, { status: 400 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data." }, { status: 400 });
  }

  const image = form.get("image");
  const name = String(form.get("name") ?? "").trim().slice(0, MAX_NAME_LEN);
  const role = String(form.get("role") ?? "").trim().slice(0, MAX_ROLE_LEN);
  const builderClass = String(form.get("builderClass") ?? "").trim().slice(0, MAX_CLASS_LEN);
  const rarityKeyRaw = String(form.get("rarityKey") ?? "common");
  const roleCategoryRaw = String(form.get("roleCategory") ?? "other");

  if (!(image instanceof File)) {
    return NextResponse.json({ error: "Missing image file." }, { status: 400 });
  }
  if (image.size === 0 || image.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "Image is empty or too large." }, { status: 400 });
  }
  if (image.type !== "image/png") {
    return NextResponse.json({ error: "Image must be image/png." }, { status: 400 });
  }
  if (!name || !role || !builderClass) {
    return NextResponse.json({ error: "Missing name, role, or builder class." }, { status: 400 });
  }

  const rarityKey: RarityKey = isRarityKey(rarityKeyRaw) ? rarityKeyRaw : "common";
  const roleCategory = isValidRoleCategory(roleCategoryRaw) ? roleCategoryRaw : "other";

  try {
    const imageUrl = await uploadCardImage(id, image);
    const row = await finalizeCard({ id, name, role, roleCategory, builderClass, rarityKey, imageUrl });

    if (!row) {
      // id doesn't exist (never reserved, or already deleted). Finalize is
      // safe to call again on the same id — e.g. a reroll after the card is
      // already public re-uploads and overwrites it — so this only fires for
      // a genuinely missing row.
      return NextResponse.json(
        { error: "This card doesn't exist — it may have been deleted." },
        { status: 409 }
      );
    }

    const publicUrl = `${getSiteUrl()}/c/${id}`;
    return NextResponse.json({ publicUrl, imageUrl });
  } catch (err) {
    console.error("finalize failed:", err);
    return NextResponse.json({ error: "Could not save the card." }, { status: 500 });
  }
}
