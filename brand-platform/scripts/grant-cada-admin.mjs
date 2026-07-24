#!/usr/bin/env node
/**
 * Create or update a CADA platform admin (challenge approval queue).
 *
 * Usage (from brand-platform/portal, with FIREBASE_SERVICE_ACCOUNT_JSON set):
 *   node ../scripts/grant-cada-admin.mjs james@cadaapp.com
 *   node ../scripts/grant-cada-admin.mjs james@cadaapp.com --password 'TempPass123!'
 *
 * Also set in portal env (Vercel / .env.local):
 *   CADA_ADMIN_EMAILS=james@cadaapp.com,tannermesaric@gmail.com
 */
const { readFileSync, existsSync } = require("fs");
const { resolve } = require("path");
const { cert, getApps, initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");

function loadEnvLocal() {
  const envPath = resolve(__dirname, "../portal/.env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

function parseServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_JSON is required (set in env or portal/.env.local)"
    );
  }
  try {
    return JSON.parse(raw);
  } catch {
    return JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
  }
}

function parseArgs(argv) {
  const args = { email: null, password: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--password") {
      args.password = argv[++i];
    } else if (!argv[i].startsWith("-") && !args.email) {
      args.email = argv[i].trim().toLowerCase();
    }
  }
  return args;
}

async function main() {
  loadEnvLocal();
  const { email, password } = parseArgs(process.argv.slice(2));
  if (!email || !email.includes("@")) {
    console.error(
      "Usage: node grant-cada-admin.mjs <email> [--password 'TempPass123!']"
    );
    process.exit(1);
  }

  if (!getApps().length) {
    initializeApp({ credential: cert(parseServiceAccount()) });
  }
  const auth = getAuth();

  let user;
  let created = false;
  try {
    user = await auth.getUserByEmail(email);
    console.log(`Found existing Firebase user: ${user.uid}`);
  } catch (err) {
    if (err?.code !== "auth/user-not-found") throw err;
    const tempPassword =
      password ||
      `CadaAdmin-${Math.random().toString(36).slice(2, 10)}A1!`;
    user = await auth.createUser({
      email,
      password: tempPassword,
      emailVerified: true,
    });
    created = true;
    console.log(`Created Firebase user: ${user.uid}`);
    if (!password) {
      console.log(`Temporary password: ${tempPassword}`);
      console.log("Change this after first login (Forgot password on /login).");
    }
  }

  if (password && !created) {
    await auth.updateUser(user.uid, { password, emailVerified: true });
    console.log("Password updated.");
  }

  const existing = { ...(user.customClaims || {}) };
  existing.cadaAdmin = true;
  await auth.setCustomUserClaims(user.uid, existing);
  console.log("Set custom claim: cadaAdmin=true");

  console.log("");
  console.log("Next steps:");
  console.log(`  1. Set CADA_ADMIN_EMAILS=${email} in portal env (Vercel + .env.local)`);
  console.log("  2. Redeploy the portal if needed");
  console.log("  3. Sign in at /login → you will land on /admin/challenges");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
