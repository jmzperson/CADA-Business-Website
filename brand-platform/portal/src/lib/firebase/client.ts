"use client";

import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { firebasePublicConfig } from "@/lib/firebase/config";

export function getFirebaseAuth() {
  const app = getApps().length ? getApps()[0] : initializeApp(firebasePublicConfig);
  return getAuth(app);
}
