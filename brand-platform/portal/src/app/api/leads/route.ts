import { NextResponse } from "next/server";
import { createLead } from "@/lib/db";
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

    const data = await createLead({
      company_name,
      email,
      message,
      status: "new",
    });

    return NextResponse.json(
      {
        lead: {
          id: data.id,
          company_name: data.company_name,
          email: data.email,
          status: data.status,
          created_at: data.created_at,
        },
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
