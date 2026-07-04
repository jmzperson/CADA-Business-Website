export function partnerInviteEmail(params: {
  brandName: string;
  inviteUrl: string;
  expiresAt: string;
}): { subject: string; text: string } {
  const expires = new Date(params.expiresAt).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return {
    subject: `You're invited to CADA Partners — ${params.brandName}`,
    text: [
      `You've been invited to set up ${params.brandName} on the CADA partner portal.`,
      "",
      "Create your password and access your dashboard:",
      params.inviteUrl,
      "",
      `This link expires on ${expires}.`,
      "",
      "If you didn't expect this email, you can ignore it.",
      "",
      "— CADA Partners",
    ].join("\n"),
  };
}
