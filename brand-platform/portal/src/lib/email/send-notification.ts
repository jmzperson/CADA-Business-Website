export type NotificationEmail = {
  to: string;
  subject: string;
  text: string;
};

export type SendNotificationResult =
  | { ok: true; provider: "resend" | "google_apps_script" }
  | { ok: false; error: string };

/** Best-effort outbound email. Does not throw — callers decide whether to fail the request. */
export async function sendNotificationEmail(
  email: NotificationEmail
): Promise<SendNotificationResult> {
  const resendKey = process.env.RESEND_API_KEY?.trim();
  if (resendKey) {
    return sendViaResend(email, resendKey);
  }

  const scriptUrl = process.env.GOOGLE_APPS_SCRIPT_URL?.trim();
  if (scriptUrl) {
    return sendViaAppsScript(email, scriptUrl);
  }

  return {
    ok: false,
    error: "No email provider configured (set RESEND_API_KEY in portal env)",
  };
}

async function sendViaResend(
  email: NotificationEmail,
  apiKey: string
): Promise<SendNotificationResult> {
  const from =
    process.env.RESEND_FROM?.trim() || "CADA Partners <notifications@resend.dev>";

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [email.to],
        subject: email.subject,
        text: email.text,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      return { ok: false, error: `Resend error (${res.status}): ${body}` };
    }

    return { ok: true, provider: "resend" };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Resend request failed",
    };
  }
}

async function sendViaAppsScript(
  email: NotificationEmail,
  scriptUrl: string
): Promise<SendNotificationResult> {
  try {
    const res = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        form_type: "portal_notification",
        notify_to: email.to,
        subject: email.subject,
        message: email.text,
      }),
      redirect: "follow",
    });

    const text = await res.text();
    let data: { ok?: boolean; error?: string };
    try {
      data = JSON.parse(text) as { ok?: boolean; error?: string };
    } catch {
      data = { ok: res.ok };
    }

    if (!res.ok || data.ok === false) {
      return { ok: false, error: data.error || `Apps Script error (${res.status})` };
    }

    return { ok: true, provider: "google_apps_script" };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Apps Script request failed",
    };
  }
}
