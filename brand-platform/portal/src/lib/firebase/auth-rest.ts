import { assertFirebasePublicConfig, firebasePublicConfig } from "@/lib/firebase/config";

type SignInResponse = {
  idToken: string;
  refreshToken: string;
  localId: string;
  email?: string;
};

export async function signInWithEmailPassword(
  email: string,
  password: string
): Promise<SignInResponse> {
  assertFirebasePublicConfig();
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${firebasePublicConfig.apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  );

  const data = (await res.json()) as SignInResponse & { error?: { message?: string } };
  if (!res.ok) {
    throw new Error(data.error?.message || "Sign in failed");
  }
  return data;
}

export async function sendPasswordResetEmail(email: string, continueUrl: string) {
  assertFirebasePublicConfig();
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${firebasePublicConfig.apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestType: "PASSWORD_RESET", email, continueUrl }),
    }
  );
  const data = (await res.json()) as { error?: { message?: string } };
  if (!res.ok) {
    throw new Error(data.error?.message || "Failed to send reset email");
  }
}
