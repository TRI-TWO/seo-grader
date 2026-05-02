/**
 * One-off: delete a Supabase Auth user by email (service role).
 *
 * Usage:
 *   npx tsx scripts/delete-auth-user-by-email.ts mjhanratty18@gmail.com
 *
 * Requires SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY
 * in the environment or in a local .env file (simple KEY=value lines).
 *
 * This only removes the Auth user. If Admin CRM already created org/client/registration
 * rows for that email, remove them via Admin CRM remove-client or clean the DB separately.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadDotEnv() {
  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (process.env[k] === undefined) process.env[k] = v;
  }
}

async function findUserIdByEmail(
  supabase: ReturnType<typeof createClient>,
  email: string
): Promise<{ id: string; email: string | undefined } | null> {
  const perPage = 1000;
  let page = 1;
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw new Error(error.message);
    }
    const hit = data.users.find((u) => (u.email || "").toLowerCase() === email);
    if (hit) {
      return { id: hit.id, email: hit.email };
    }
    if (data.users.length < perPage) {
      return null;
    }
    page += 1;
  }
}

async function main() {
  loadDotEnv();

  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    console.error("Usage: npx tsx scripts/delete-auth-user-by-email.ts <email>");
    process.exit(1);
  }

  const url =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!url || !serviceKey) {
    console.error(
      "Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) or SUPABASE_SERVICE_ROLE_KEY."
    );
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const user = await findUserIdByEmail(supabase, email);
  if (!user) {
    console.log(`No Auth user found for ${email}. Nothing to delete.`);
    return;
  }

  const { error: delError } = await supabase.auth.admin.deleteUser(user.id);
  if (delError) {
    console.error("deleteUser failed:", delError.message);
    process.exit(1);
  }

  console.log(`Deleted Auth user ${user.email ?? email} (id ${user.id}).`);
  console.log(
    "If this email was used in Admin CRM before, also remove the portal client row (Admin remove-client) to avoid duplicate DB constraints."
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
