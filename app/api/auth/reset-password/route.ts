import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase";
import { sendPasswordResetActionLink } from "@/lib/email";

const ALLOWED_RESET_EMAILS = new Set([
  "mgr@tri-two.com",
  "mjhanratty18@gmail.com",
]);

/**
 * Prefer the hostname the user actually used (Vercel: x-forwarded-host) so
 * reset links are not stuck on localhost when NEXT_PUBLIC_BASE_URL is wrong or unset.
 */
function resolvePublicOrigin(req: NextRequest): string {
  const hostHeader =
    req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
  const host = hostHeader.split(",")[0].trim();
  let proto = (req.headers.get("x-forwarded-proto") || "")
    .split(",")[0]
    .trim();

  if (host) {
    if (host.includes("localhost") || host.startsWith("127.")) {
      return `http://${host}`;
    }
    if (proto !== "http" && proto !== "https") {
      proto = "https";
    }
    return `${proto}://${host}`;
  }

  const vercel = process.env.VERCEL_URL?.replace(/\/$/, "");
  if (vercel) {
    return `https://${vercel}`;
  }

  const env = process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "");
  if (env) {
    if (env.startsWith("http://") || env.startsWith("https://")) {
      return env;
    }
    return `https://${env}`;
  }

  return "http://localhost:3000";
}

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    const normalizedEmail =
      typeof email === "string" ? email.trim().toLowerCase() : "";

    if (!normalizedEmail) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    if (!ALLOWED_RESET_EMAILS.has(normalizedEmail)) {
      return NextResponse.json(
        { error: "Password reset is only available for authorized accounts." },
        { status: 403 }
      );
    }

    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const origin = resolvePublicOrigin(req);
    const redirectTo = `${origin}/reset-password/complete`;

    // Primary path: Supabase sends the recovery email (project Auth email / SMTP settings).
    if (supabaseUrl && anonKey) {
      const anon = createClient(supabaseUrl, anonKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });
      const { error: resetErr } = await anon.auth.resetPasswordForEmail(
        normalizedEmail,
        { redirectTo }
      );
      if (!resetErr) {
        return NextResponse.json({
          success: true,
          message:
            "If an account exists for this email, a password reset link has been sent.",
        });
      }
      console.error("resetPasswordForEmail failed:", resetErr);
    } else {
      console.error(
        "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY; cannot send recovery email via Supabase."
      );
    }

    // Fallback: generate link with service role and deliver via SendGrid (if configured).
    const admin = getSupabaseClient();
    const { data: resetData, error: resetError } =
      await admin.auth.admin.generateLink({
        type: "recovery",
        email: normalizedEmail,
        options: { redirectTo },
      });

    if (resetError || !resetData?.properties?.action_link) {
      console.error("generateLink recovery failed:", resetError);
      return NextResponse.json({
        success: true,
        message:
          "If an account exists for this email, a password reset link has been sent.",
      });
    }

    const actionLink = resetData.properties.action_link;

    if (process.env.SENDGRID_API_KEY) {
      try {
        await sendPasswordResetActionLink(normalizedEmail, actionLink);
      } catch (e) {
        console.error("SendGrid send failed:", e);
      }
    } else if (process.env.NODE_ENV === "development") {
      console.log("=".repeat(80));
      console.log("🔗 PASSWORD RESET LINK (no SendGrid, dev log):");
      console.log(actionLink);
      console.log("=".repeat(80));
    } else {
      console.error(
        "Recovery link generated but email not sent: configure Supabase Auth email or SENDGRID_API_KEY."
      );
    }

    return NextResponse.json({
      success: true,
      message:
        "If an account exists for this email, a password reset link has been sent.",
    });
  } catch (error: unknown) {
    console.error("Password reset error:", error);
    const errorMessage =
      process.env.NODE_ENV === "development" && error instanceof Error
        ? `An error occurred: ${error.message}. Check server logs for details.`
        : "An error occurred. Please try again.";

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
