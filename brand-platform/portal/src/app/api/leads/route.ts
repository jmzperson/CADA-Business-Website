import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { handleApiError, jsonError } from "@/lib/api";
import { corsHeaders } from "@/lib/leads/cors";

type LeadBody = {
  company_name?: string;
  email?: string;
  message?: string;
};

export async function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as LeadBody;
    const company_name = body.company_name?.trim();
    const email = body.email?.trim().toLowerCase();
    const message = body.message?.trim() || null;

    if (!company_name || !email) {
      return NextResponse.json(
        { error: "company_name and email are required" },
        { status: 400, headers: corsHeaders(request) }
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: "Invalid email address" },
        { status: 400, headers: corsHeaders(request) }
      );
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("partnership_leads")
      .insert({
        company_name,
        email,
        message,
        status: "new",
      })
      .select("id, company_name, email, status, created_at")
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500, headers: corsHeaders(request) }
      );
    }

    return NextResponse.json(
      {
        lead: data,
        message: "Thanks! We'll be in touch. You can also create your account now.",
        signup_url: signupUrl(email, company_name),
      },
      { status: 201, headers: corsHeaders(request) }
    );
  } catch (err) {
    return handleApiError(err);
  }
}

function signupUrl(email: string, companyName: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const params = new URLSearchParams({
    email,
    business_name: companyName,
  });
  return `${base}/signup?${params.toString()}`;
}
