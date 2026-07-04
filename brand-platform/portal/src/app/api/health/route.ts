import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";

export async function GET() {
  const hasServiceAccount = Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim());
  const hasPublicConfig = Boolean(
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
      process.env.NEXT_PUBLIC_FIREBASE_API_KEY
  );

  if (!hasServiceAccount) {
    return NextResponse.json(
      {
        ok: false,
        error: "FIREBASE_SERVICE_ACCOUNT_JSON is not set",
        checks: { publicConfig: hasPublicConfig, adminSdk: false, firestore: false },
      },
      { status: 503 }
    );
  }

  try {
    await adminDb().collection("_health").doc("ping").get();

    return NextResponse.json({
      ok: true,
      project: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? null,
      appUrl: process.env.NEXT_PUBLIC_APP_URL ?? null,
      checks: { publicConfig: hasPublicConfig, adminSdk: true, firestore: true },
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Firebase connection failed",
        checks: { publicConfig: hasPublicConfig, adminSdk: true, firestore: false },
      },
      { status: 503 }
    );
  }
}
