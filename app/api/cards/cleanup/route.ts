import { NextRequest, NextResponse } from "next/server";
import { cleanupStalePending } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Wired up via vercel.json as a scheduled Cron Job. Vercel signs cron
// requests with this header — reject anything else so this can't be used to
// hammer the DB from outside.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const deleted = await cleanupStalePending(60);
  return NextResponse.json({ deletedPendingRows: deleted });
}
