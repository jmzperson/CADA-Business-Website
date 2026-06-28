import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { expireEndedChallenges } from "@/lib/challenges";

export async function POST(request: Request) {
  const secret = request.headers.get("x-cron-secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return jsonError("Unauthorized", 401);
  }

  const count = await expireEndedChallenges();
  return NextResponse.json({ ended_count: count });
}
