import { NextRequest, NextResponse } from "next/server";
import { searchCards } from "@/lib/db";
import { isValidRoleCategory } from "@/lib/cardLogic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 24;

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const q = params.get("q")?.trim().slice(0, 40) || undefined;
  const idParam = params.get("id");
  const categoryParam = params.get("category") || undefined;
  const page = Math.max(0, parseInt(params.get("page") ?? "0", 10) || 0);

  const id = idParam ? parseInt(idParam, 10) : undefined;
  if (idParam && (!Number.isInteger(id) || (id ?? 0) <= 0)) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }

  const category = categoryParam && isValidRoleCategory(categoryParam) ? categoryParam : undefined;

  try {
    const { rows, total } = await searchCards({
      q,
      id,
      category,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    });
    return NextResponse.json({
      cards: rows,
      total,
      page,
      pageSize: PAGE_SIZE,
      hasMore: (page + 1) * PAGE_SIZE < total,
    });
  } catch (err) {
    console.error("gallery query failed:", err);
    return NextResponse.json({ error: "Search failed." }, { status: 500 });
  }
}
