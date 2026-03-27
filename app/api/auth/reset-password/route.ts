import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase";
import {
  isOutboundResetMailConfigured,
  sendPasswordResetActionLink,
} from "@/lib/email";

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
    m.includes("email rate limit") ||
    m.includes("too many requests") ||
    (m.includes("security") && m.includes("only request"))
  );
}

function trimEnv(value: string | undefined): string | undefined {
  const t = value?.trim();
  return t || undefined;
}

function isLoopbackOrigin(origin: string): boolean {
  try {
    const u = new URL(origin);
    return (
      u.hostname === "localhost" ||
      u.hostname.startsWith("127.") ||
      u.hostname === "0.0.0.0"
    );
  } catch {
    return false;
  }
}

/** Normalize NEXT_PUBLIC_BASE_URL (trim slash, add scheme if host-only). */
function originFromNextPublicBaseUrl(): string | undefined {
  const raw = trimEnv(process.env.NEXT_PUBLIC_BASE_URL);
  if (!raw) return undefined;
  const env = raw.replace(/\/$/, "");
  const out =
    env.startsWith("http://") || env.startsWith("https://")
      ? env
      : `https://${env}`;
  // Vercel projects often copy .env with localhost; that would poison recovery redirect_to.
  if (process.env.VERCEL === "1" && isLoopbackOrigin(out)) {
    return undefined;
  }
  return out;
}

function originFromVercelDeployment(): string | undefined {
  const vercel = trimEnv(process.env.VERCEL_URL)?.replace(/\/$/, "");
  if (!vercel) return undefined;
  return `https://${vercel}`;
}

/**
 * Canonical redirect origin for Supabase recovery links.
 * Prefer NEXT_PUBLIC_BASE_URL when set (production on Vercel). Otherwise infer from the
 * request (x-forwarded-host / host), with a guard so Vercel never uses a bogus localhost Host.
 */
function resolvePublicOrigin(req: NextRequest): string {
  const onVercel = process.env.VERCEL === "1";
  const fromEnv = originFromNextPublicBaseUrl();
  if (fromEnv) {
    return fromEnv;
  }

  const hostHeader =
    req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
  const host = hostHeader.split(",")[0].trim();
  let proto = (req.headers.get("x-forwarded-proto") || "")
    .split(",")[0]
    .trim();

  const isLoopbackHost =
    Boolean(host) &&
    (host.includes("localhost") || host.startsWith("127.") || host === "[::1]");

  if (host && !(onVercel && isLoopbackHost)) {
    if (host.includes("localhost") || host.startsWith("127.")) {
      return `http://${host}`;
    }
    if (proto !== "http" && proto !== "https") {
      proto = "https";
    }
    return `${proto}://${host}`;
  }

  const fromVercel = originFromVercelDeployment();
  if (fromVercel) {
    return fromVercel;
  }

  return "http://localhost:3000";
}

/**
 * Supabase requires an absolute http(s) redirect URL. A bare host like `www.example.com`
 * is treated as a path on supabase.co (e.g. .../www.example.com), which breaks recovery.
 */
function toAbsoluteHttpOrigin(origin: string): string {
  const t = (origin || "").trim().replace(/\/$/, "");
  if (!t) return "http://localhost:3000";
  if (/^https?:\/\//i.test(t)) return t;
  const host = t.replace(/^\/+/, "");
  if (host.includes("localhost") || host.startsWith("127.")) {
    return `http://${host}`;
  }
  return `https://${host}`;
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
    const origin = toAbsoluteHttpOrigin(resolvePublicOrigin(req));
    const redirectTo = `${origin}/reset-password/complete`;

    const admin = getSupabaseClient();
    const outboundMail = isOutboundResetMailConfigured();

    // Path A (preferred when Resend or SendGrid on Vercel): admin generateLink + our email — does NOT call /recover (avoids Supabase email rate limit).
    if (outboundMail) {
      const { data: resetData, error: resetError } =
        await admin.auth.admin.generateLink({
          type: "recovery",
          email: normalizedEmail,
          options: { redirectTo },
        });

      if (!resetError && resetData?.properties?.action_link) {
        try {
          await sendPasswordResetActionLink(
            normalizedEmail,
            resetData.properties.action_link
          );
          return NextResponse.json({
            success: true,
            message:
              "If an account exists for this email, a password reset link has been sent.",
          });
        } catch (e) {
          const detail = e instanceof Error ? e.message : String(e);
          console.error("Outbound reset email send failed:", e);
          return NextResponse.json(
            {
              error:
                "Could not send the reset email. Check Resend (API key, verified domain, from-address) on Vercel, or set the password in Supabase → Authentication → Users.",
              detail,
            },
            { status: 500 }
          );
        }
      }
      console.error(
        "generateLink recovery failed (outbound mail path):",
        resetError
      );
    }

    // Path B: Supabase-hosted email via /recover (rate-limited; only when no outbound mail or generateLink failed above).
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
      const recoverRateLimited = isAuthRecoverRateLimited(resetErr.message);
      console.error("resetPasswordForEmail failed:", resetErr);
      if (recoverRateLimited) {
        return NextResponse.json(
          {
            error:
              "Email rate limit: wait several minutes before another reset, or set your password in Supabase → Authentication → Users. Add RESEND_API_KEY on Vercel to send resets via Resend and avoid this limit.",
          },
          { status: 429 }
        );
      }
      return NextResponse.json(
        {
          error:
            resetErr.message ||
            "Could not send reset email. Try again later or set the password in Supabase → Authentication → Users.",
        },
        { status: 400 }
      );
    } else {
      console.error(
        "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY."
      );
    }

    // Path C: no outbound mail — try generateLink and log in dev only
    if (!outboundMail) {
      const { data: resetData, error: resetError } =
        await admin.auth.admin.generateLink({
          type: "recovery",
          email: normalizedEmail,
          options: { redirectTo },
        });
      if (!resetError && resetData?.properties?.action_link) {
        if (process.env.NODE_ENV === "development") {
          console.log("=".repeat(80));
          console.log("🔗 PASSWORD RESET LINK (dev, no Resend/SendGrid):");
          console.log(resetData.properties.action_link);
          console.log("=".repeat(80));
          return NextResponse.json({
            success: true,
            message:
              "Password reset link logged to the server console (development).",
          });
        }
      }
    }

    return NextResponse.json(
      {
        error:
          "Could not send a reset link. Add RESEND_API_KEY on Vercel (recommended), wait before retrying, or set the password in Supabase → Authentication → Users.",
      },
      { status: 503 }
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
