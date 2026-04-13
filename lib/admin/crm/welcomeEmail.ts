import sgMail from "@sendgrid/mail";
import { Resend } from "resend";
import { isNodeDevelopment, trimEnv } from "./crmEnv";

const RESEND_DEV_FALLBACK = "TRI-TWO <onboarding@resend.dev>";

function normalizeQuotedEnv(raw: string | undefined): string | undefined {
  let v = trimEnv(raw);
  if (!v) return undefined;
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1).trim() || undefined;
  }
  return v;
}

function isResendDevSandboxFrom(from: string): boolean {
  return /onboarding@resend\.dev/i.test(from);
}

/**
 * Public site origin for links in outbound emails.
 * Development: allows localhost when NEXT_PUBLIC_BASE_URL is unset.
 * Preview/staging/production: requires NEXT_PUBLIC_BASE_URL.
 */
export function getPublicBaseUrlForInviteLinks(): string {
  const configured = trimEnv(process.env.NEXT_PUBLIC_BASE_URL);
  if (configured) {
    return configured.replace(/\/$/, "");
  }
  if (isNodeDevelopment()) {
    return "http://localhost:3000";
  }
  throw new Error(
    "NEXT_PUBLIC_BASE_URL is not set. Set it to your public app URL (for example https://your-domain.com) so welcome emails contain a working login link. A localhost fallback is only allowed when NODE_ENV is development."
  );
}

function resolveResendFromForSend(): string {
  const raw = normalizeQuotedEnv(process.env.RESEND_FROM_EMAIL);
  if (isNodeDevelopment()) {
    return raw || RESEND_DEV_FALLBACK;
  }
  if (!raw) {
    throw new Error(
      "RESEND_FROM_EMAIL is not set. Outside development you must configure a verified Resend sender identity (not the onboarding@resend.dev sandbox default)."
    );
  }
  if (isResendDevSandboxFrom(raw)) {
    throw new Error(
      "RESEND_FROM_EMAIL must not use onboarding@resend.dev outside development. Configure a verified domain sender in Resend."
    );
  }
  return raw;
}

function resolveSendGridFromForSend(): string {
  const raw = trimEnv(process.env.SENDGRID_FROM_EMAIL);
  if (isNodeDevelopment()) {
    return raw || "mgr@tri-two.com";
  }
  if (!raw) {
    throw new Error(
      "SENDGRID_FROM_EMAIL is not set. Outside development, set it to a verified SendGrid sender when using SENDGRID_API_KEY."
    );
  }
  return raw;
}

/**
 * Validates email provider + non-dev sender/base URL before provisioning auth/DB,
 * so misconfiguration fails with a clear message instead of after partial setup.
 */
export function assertWelcomeEmailDispatchReady(): void {
  const resendKey = trimEnv(process.env.RESEND_API_KEY);
  const sendgridKey = trimEnv(process.env.SENDGRID_API_KEY);
  if (!resendKey && !sendgridKey) {
    throw new Error(
      "No outbound email provider is configured. Set RESEND_API_KEY or SENDGRID_API_KEY so client welcome emails can be sent."
    );
  }
  if (!isNodeDevelopment()) {
    if (!trimEnv(process.env.NEXT_PUBLIC_BASE_URL)) {
      throw new Error(
        "NEXT_PUBLIC_BASE_URL is not set. Outside development this is required so invite links in emails point at your deployed app."
      );
    }
    if (resendKey) {
      const from = normalizeQuotedEnv(process.env.RESEND_FROM_EMAIL);
      if (!from || isResendDevSandboxFrom(from)) {
        throw new Error(
          "RESEND_FROM_EMAIL must be set to a verified sender (not onboarding@resend.dev) when using Resend outside development."
        );
      }
    }
    if (sendgridKey && !trimEnv(process.env.SENDGRID_FROM_EMAIL)) {
      throw new Error(
        "SENDGRID_FROM_EMAIL must be set when using SendGrid outside development."
      );
    }
  }
}

function welcomeHtml(args: {
  contact_name: string;
  company_name: string;
  email: string;
  loginUrl: string;
}): string {
  const { contact_name, company_name, email, loginUrl } = args;
  return `
<!DOCTYPE html>
<html>
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
  <body style="font-family: Georgia, 'Times New Roman', serif; line-height: 1.65; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 24px;">
    <p>Hi ${escapeHtml(contact_name)},</p>
    <p>Welcome to Arch.</p>
    <p>Your client portal has been created for <strong>${escapeHtml(company_name)}</strong>. This is where you will be able to complete your setup, review information tied to your account, and manage updates over time.</p>
    <p>To get started, please use the email address this message was sent to and follow these steps:</p>
    <ol>
      <li>Go to the <a href="${escapeHtml(loginUrl)}">login page</a></li>
      <li>Click &quot;Forgot password&quot;</li>
      <li>Enter your email address</li>
      <li>Use the reset link sent to your inbox to create your password</li>
      <li>Log in and complete your setup</li>
    </ol>
    <p><strong>Your account email:</strong><br/>${escapeHtml(email)}</p>
    <p>If you have any trouble getting in, just reply to this email and we will help you out.</p>
    <p>Welcome aboard,<br/>The TRI-TWO Team</p>
  </body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function welcomeText(args: {
  contact_name: string;
  company_name: string;
  email: string;
  loginUrl: string;
}): string {
  return `Hi ${args.contact_name},

Welcome to Arch.

Your client portal has been created for ${args.company_name}. This is where you'll be able to complete your setup, review information tied to your account, and manage updates over time.

To get started, please use the email address this message was sent to and follow these steps:

1. Go to the login page: ${args.loginUrl}
2. Click "Forgot password"
3. Enter your email address
4. Use the reset link sent to your inbox to create your password
5. Log in and complete your setup

Your account email:
${args.email}

If you have any trouble getting in, just reply to this email and we'll help you out.

Welcome aboard,
The TRI-TWO Team`;
}

const SUBJECT = "Welcome to Arch — Set Up Your Client Portal";

/**
 * Sends the Arch client welcome email via Resend (preferred) or SendGrid.
 * Re-validates base URL and From at send time so misconfiguration surfaces as a clear error.
 */
export async function sendArchClientWelcomeEmail(args: {
  to: string;
  contact_name: string;
  company_name: string;
}): Promise<void> {
  const loginUrl = `${getPublicBaseUrlForInviteLinks()}/login`;
  const html = welcomeHtml({
    contact_name: args.contact_name,
    company_name: args.company_name,
    email: args.to,
    loginUrl,
  });
  const text = welcomeText({
    contact_name: args.contact_name,
    company_name: args.company_name,
    email: args.to,
    loginUrl,
  });

  const resendKey = trimEnv(process.env.RESEND_API_KEY);
  if (resendKey) {
    const resend = new Resend(resendKey);
    const from = resolveResendFromForSend();
    const { error } = await resend.emails.send({
      from,
      to: args.to,
      subject: SUBJECT,
      html,
      text,
    });
    if (error) {
      throw new Error(error.message || "Resend send failed");
    }
    return;
  }

  const sendgridKey = trimEnv(process.env.SENDGRID_API_KEY);
  if (sendgridKey) {
    sgMail.setApiKey(sendgridKey);
    await sgMail.send({
      to: args.to,
      from: resolveSendGridFromForSend(),
      subject: SUBJECT,
      html,
      text,
    });
    return;
  }

  throw new Error(
    "No outbound email provider is configured. Set RESEND_API_KEY or SENDGRID_API_KEY."
  );
}
