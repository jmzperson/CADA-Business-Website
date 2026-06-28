import { NextResponse } from "next/server";
import { getBrandById, getChallengeById } from "@/lib/db";
import { handleApiError, jsonError } from "@/lib/api";
import { expireQrRewards } from "@/lib/mobile/expire-rewards";
import { checkRateLimit } from "@/lib/mobile/rate-limit";
import { getRewardForUser, serializeRewardResponse } from "@/lib/mobile/rewards";
import { requireAppUser } from "@/lib/mobile/auth";
import { ensureCadaUser } from "@/lib/mobile/users";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const authUser = await requireAppUser(request);
    const cadaUser = await ensureCadaUser(authUser.uid);
    const { id } = await params;

    const rate = checkRateLimit(`reward-get:${cadaUser.id}`, 60, 60_000);
    if (!rate.allowed) {
      return jsonError("Rate limit exceeded", 429);
    }

    await expireQrRewards();

    const reward = await getRewardForUser(id, cadaUser.id);
    if (!reward) return jsonError("Reward not found", 404);

    const challenge = await getChallengeById(reward.challenge_id);
    const brand = challenge ? await getBrandById(challenge.brand_id) : null;

    return NextResponse.json(
      serializeRewardResponse(reward, {
        brand_name: brand?.name ?? "",
        challenge_title: challenge?.title ?? "",
        offer_headline: challenge?.offer_headline ?? "",
        offer_code: challenge?.offer_code ?? null,
      })
    );
  } catch (err) {
    return handleApiError(err);
  }
}
