import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStaffContext } from "@/lib/auth/session";
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
    const path = `${staff.brandId}/logo.${ext}`;

    const supabase = await createClient();
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from("brand-logos")
      .upload(path, buffer, { upsert: true, contentType: file.type });

    if (uploadError) {
      return jsonError(uploadError.message, 500);
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("brand-logos").getPublicUrl(path);

    return NextResponse.json({ logo_url: publicUrl });
  } catch (err) {
    return handleApiError(err);
  }
}
