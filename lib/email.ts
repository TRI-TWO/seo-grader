import sgMail from "@sendgrid/mail";
import { Resend } from "resend";

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

function trimEnv(value: string | undefined): string | undefined {
  const t = value?.trim();
  return t || undefined;
}

/** True when we can send password-reset links from the app (bypasses Supabase /recover). */
export function isOutboundResetMailConfigured(): boolean {
  return Boolean(
    trimEnv(process.env.RESEND_API_KEY) || trimEnv(process.env.SENDGRID_API_KEY)
  );
}

function passwordResetActionLinkHtml(actionLink: string): string {
  return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #1a1a1a; padding: 30px; border-radius: 8px;">
            <h1 style="color: #16b8a6; margin-top: 0;">Password Reset Request</h1>
            <p style="color: #ffffff;">You requested to reset your password for the SEO Grader account.</p>
            <p style="color: #ffffff;">Click the button below to set a new password:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${actionLink}" style="background-color: #16b8a6; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">Reset Password</a>
            </div>
            <p style="color: #ffffff; font-size: 14px;">Or copy and paste this link into your browser:</p>
            <p style="color: #cccccc; font-size: 12px; word-break: break-all;">${actionLink}</p>
            <p style="color: #ffffff; font-size: 14px; margin-top: 30px;">If you didn't request this, please ignore this email.</p>
          </div>
        </body>
      </html>
    `;
}

function passwordResetTokenHtml(resetUrl: string): string {
  return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #1a1a1a; padding: 30px; border-radius: 8px;">
            <h1 style="color: #16b8a6; margin-top: 0;">Password Reset Request</h1>
            <p style="color: #ffffff;">You requested to reset your password for the SEO Grader account.</p>
            <p style="color: #ffffff;">Click the button below to set a new password:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" style="background-color: #16b8a6; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">Reset Password</a>
            </div>
            <p style="color: #ffffff; font-size: 14px;">Or copy and paste this link into your browser:</p>
            <p style="color: #cccccc; font-size: 12px; word-break: break-all;">${resetUrl}</p>
            <p style="color: #ffffff; font-size: 14px; margin-top: 30px;">This link will expire in 24 hours.</p>
            <p style="color: #ffffff; font-size: 14px;">If you didn't request this, please ignore this email.</p>
          </div>
        </body>
      </html>
    `;
}

/**
 * Send a Supabase-generated recovery `action_link` (full URL).
 * Prefers Resend (RESEND_API_KEY), then SendGrid (SENDGRID_API_KEY).
 */
export async function sendPasswordResetActionLink(
  email: string,
  actionLink: string
) {
  const html = passwordResetActionLinkHtml(actionLink);
  const text = `You requested to reset your password. Open this link to continue: ${actionLink}`;
  const subject = "Reset Your Password - SEO Grader";

  const resendKey = trimEnv(process.env.RESEND_API_KEY);
  if (resendKey) {
    const resend = new Resend(resendKey);
    const from =
      trimEnv(process.env.RESEND_FROM_EMAIL) ||
      "TRI-TWO <onboarding@resend.dev>";
    const { data, error } = await resend.emails.send({
      from,
      to: email,
      subject,
      html,
      text,
    });
    if (error) {
      console.error("Resend send failed:", error);
      throw new Error(error.message || "Resend send failed");
    }
    console.log("Password reset action link sent via Resend to:", email, data?.id);
    return;
  }

  if (trimEnv(process.env.SENDGRID_API_KEY)) {
    await sgMail.send({
      to: email,
      from: process.env.SENDGRID_FROM_EMAIL || "mgr@tri-two.com",
      subject,
      html,
      text,
    });
    console.log("Password reset action link sent via SendGrid to:", email);
    return;
  }

  console.error("RESEND_API_KEY and SENDGRID_API_KEY are not set");
  throw new Error("Email service not configured");
}

export async function sendPasswordResetEmail(email: string, resetToken: string) {
  const resetUrl = `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/reset-password/${resetToken}`;
  const html = passwordResetTokenHtml(resetUrl);
  const text = `You requested to reset your password. Click this link to set a new password: ${resetUrl}\n\nThis link will expire in 24 hours.`;
  const subject = "Reset Your Password - SEO Grader";

  const resendKeyLegacy = trimEnv(process.env.RESEND_API_KEY);
  if (resendKeyLegacy) {
    const resend = new Resend(resendKeyLegacy);
    const from =
      trimEnv(process.env.RESEND_FROM_EMAIL) ||
      "TRI-TWO <onboarding@resend.dev>";
    const { error } = await resend.emails.send({
      from,
      to: email,
      subject,
      html,
      text,
    });
    if (error) {
      throw new Error(error.message || "Resend send failed");
    }
    console.log("Password reset email sent via Resend to:", email);
    return true;
  }

  if (!trimEnv(process.env.SENDGRID_API_KEY)) {
    console.error("RESEND_API_KEY and SENDGRID_API_KEY are not set");
    throw new Error("Email service not configured");
  }

  try {
    await sgMail.send({
      to: email,
      from: process.env.SENDGRID_FROM_EMAIL || "mgr@tri-two.com",
      subject,
      html,
      text,
    });
    console.log("Password reset email sent to:", email);
    return true;
  } catch (error: unknown) {
    console.error("Error sending email:", error);
    throw error;
  }
}
