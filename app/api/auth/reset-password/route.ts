import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase";
import { sendPasswordResetActionLink } from "@/lib/email";

const ALLOWED_RESET_EMAILS = new Set([
  "mgr@tri-two.com",
  "mjhanratty18@gmail.com",
]);

function isAuthRecoverRateLimited(message: string | undefined): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  return (
    m.includes("24 seconds") ||
    m.includes("rate limit") ||
    m.includes("too many requests") ||
    (m.includes("security") && m.includes("only request"))
  );
}

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

    let recoverRateLimited = false;

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
      recoverRateLimited = isAuthRecoverRateLimited(resetErr.message);
      console.error("resetPasswordForEmail failed:", resetErr);
    } else {
      console.error(
        "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY; cannot send recovery email via Supabase."
      );
    }

    // Fallback: admin generateLink (bypasses public /recover rate limit) + SendGrid when configured.
    const admin = getSupabaseClient();
    const { data: resetData, error: resetError } =
      await admin.auth.admin.generateLink({
        type: "recovery",
        email: normalizedEmail,
        options: { redirectTo },
      });

    if (resetError || !resetData?.properties?.action_link) {
      console.error("generateLink recovery failed:", resetError);
      if (
        recoverRateLimited ||
        isAuthRecoverRateLimited(resetError?.message)
      ) {
        return NextResponse.json(
          {
            error:
              "Too many reset requests. Please wait about one minute before trying again. If you already asked for a link, check your inbox and spam folder.",
          },
          { status: 429 }
        );
      }
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
        return NextResponse.json({
          success: true,
          message:
            "If an account exists for this email, a password reset link has been sent.",
        });
      } catch (e) {
        console.error("SendGrid send failed:", e);
        if (recoverRateLimited) {
          return NextResponse.json(
            {
              error:
                "Too many reset requests from Supabase. Please wait about one minute, then try again.",
            },
            { status: 429 }
          );
        }
        return NextResponse.json(
          {
            error:
              "Could not send the reset email. Wait about one minute and try again, or set the password in Supabase → Authentication → Users.",
          },
          { status: 500 }
        );
      }
    } else if (process.env.NODE_ENV === "development") {
      console.log("=".repeat(80));
      console.log("🔗 PASSWORD RESET LINK (no SendGrid, dev log):");
      console.log(actionLink);
      console.log("=".repeat(80));
      return NextResponse.json({
        success: true,
        message:
          "Password reset link logged to the server console (development).",
      });
    } else {
      console.error(
        "Recovery link generated but email not sent: configure Supabase Auth email or SENDGRID_API_KEY."
      );
      if (recoverRateLimited) {
        return NextResponse.json(
          {
            error:
              "Password reset is temporarily limited. Please wait about one minute and try again, or set your password in the Supabase dashboard under Authentication → Users.",
          },
          { status: 429 }
        );
      }
      return NextResponse.json(
        {
          error:
            "Reset link could not be emailed. Configure SENDGRID_API_KEY for fallback delivery, or wait a minute and use Supabase’s built-in recovery again.",
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: "Unable to complete password reset. Try again shortly." },
      { status: 500 }
    );
  } catch (error: unknown) {
    console.error("Password reset error:", error);
    const errorMessage =
      process.env.NODE_ENV === "development" && error instanceof Error
        ? `An error occurred: ${error.message}. Check server logs for details.`
        : "An error occurred. Please try again.";

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
