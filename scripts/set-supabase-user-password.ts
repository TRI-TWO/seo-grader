/**
 * One-off: set a Supabase Auth user's password (service role).
 *
 * Usage (do not commit passwords):
 *   npx tsx scripts/set-supabase-user-password.ts <email> <new-password>
 *
 * Requires SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY
 * in the environment or in a local .env file (simple KEY=value lines).
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

async function main() {
  loadDotEnv();

  const email = process.argv[2]?.trim().toLowerCase();
  const password = process.argv[3];

  if (!email || !password) {
    console.error(
      "Usage: npx tsx scripts/set-supabase-user-password.ts <email> <new-password>"
    );
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

  const { data: listData, error: listError } =
    await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });

  if (listError) {
    console.error("listUsers failed:", listError.message);
    process.exit(1);
  }

  let user = listData.users.find(
    (u) => (u.email || "").toLowerCase() === email
  );

  if (!user) {
    const { data: created, error: createError } =
      await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
    if (createError) {
      console.error("createUser failed:", createError.message);
      process.exit(1);
    }
    if (!created.user) {
      console.error("createUser returned no user.");
      process.exit(1);
    }
    console.log(`Created Auth user ${email} (user id ${created.user.id}).`);
    return;
  }

  const { error: updateError } = await supabase.auth.admin.updateUserById(
    user.id,
    { password }
  );

  if (updateError) {
    console.error("updateUserById failed:", updateError.message);
    process.exit(1);
  }

  console.log(`Password updated for ${email} (user id ${user.id}).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
