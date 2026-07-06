export function passwordResetEmail(params: { resetUrl: string }): { subject: string; text: string } {
  return {
    subject: "Reset your CADA Partners password",
    text: [
      "We received a request to reset your CADA Partners password.",
      "",
      "Choose a new password here:",
      params.resetUrl,
      "",
      "This link expires in one hour. If you didn't request a reset, you can ignore this email.",
      "",
      "— CADA Partners",
    ].join("\n"),
  };
}
