import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { expireQrRewards } from "@/lib/mobile/expire-rewards";

export async function POST(request: Request) {
  const secret = request.headers.get("x-cron-secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return jsonError("Unauthorized", 401);
  }

  const count = await expireQrRewards();
  return NextResponse.json({ expired_count: count });
}
