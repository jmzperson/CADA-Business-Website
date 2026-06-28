import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

let app: App | undefined;

function parseServiceAccount(): Record<string, string> {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is required for server-side Firebase");
  }
  try {
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return JSON.parse(Buffer.from(raw, "base64").toString("utf8")) as Record<string, string>;
  }
}

export function getFirebaseAdminApp(): App {
  if (app) return app;
  const existing = getApps()[0];
  if (existing) {
    app = existing;
    return app;
  }

  app = initializeApp({
    credential: cert(parseServiceAccount()),
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  });
  return app;
}

export function adminAuth() {
  return getAuth(getFirebaseAdminApp());
}

export function adminDb() {
  return getFirestore(getFirebaseAdminApp());
}

export function adminStorage() {
  return getStorage(getFirebaseAdminApp());
}
