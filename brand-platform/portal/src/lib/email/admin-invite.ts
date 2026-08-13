export function adminInviteEmail(params: {
  loginUrl: string;
  reviewUrl: string;
  createdUser: boolean;
  resetSent: boolean;
}): { subject: string; text: string } {
  const setPasswordLines = params.resetSent
    ? [
        params.createdUser
          ? "A CADA Partners account was created for you. Check your inbox for a link to set your password, then sign in:"
          : "If you need to set or reset your password, use the reset email we just sent, then sign in:",
        params.loginUrl,
      ]
    : [
        params.createdUser
          ? "A CADA Partners account was created for you. Use Forgot password on the sign-in page to set a password:"
          : "Sign in with your existing password:",
        params.loginUrl,
      ];

  return {
    subject: "You've been added as a CADA admin",
    text: [
      "You've been granted CADA platform admin access.",
      "",
      "You can approve or reject partner brand challenges before they go live in the CADA app.",
      "",
      ...setPasswordLines,
      "",
      "Review queue:",
      params.reviewUrl,
      "",
      "If you didn't expect this email, you can ignore it.",
      "",
      "— CADA",
    ].join("\n"),
  };
}
