import { NextResponse } from "next/server";
import { getStaffContext } from "@/lib/auth/session";
import { adminStorage } from "@/lib/firebase/admin";
import { firebasePublicConfig } from "@/lib/firebase/config";
import { handleApiError, jsonError } from "@/lib/api";

export async function POST(request: Request) {
  try {
    const staff = await getStaffContext();
    if (!staff) return jsonError("Unauthorized", 401);
    if (staff.role !== "admin") {
      return jsonError("Only admins can upload logos", 403);
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return jsonError("file is required");
    }

    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowed.includes(file.type)) {
      return jsonError("File must be JPEG, PNG, WebP, or GIF");
    }

    if (file.size > 5 * 1024 * 1024) {
      return jsonError("File must be under 5MB");
    }

    const ext = file.name.split(".").pop() || "png";
    const path = `brand-logos/${staff.brandId}/logo.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const bucket = adminStorage().bucket();
    await bucket.file(path).save(buffer, {
      contentType: file.type,
      metadata: { cacheControl: "public, max-age=3600" },
      resumable: false,
    });

    const bucketName = firebasePublicConfig.storageBucket || bucket.name;
    const publicUrl = `https://storage.googleapis.com/${bucketName}/${path}`;

    return NextResponse.json({ logo_url: publicUrl });
  } catch (err) {
    return handleApiError(err);
  }
}
