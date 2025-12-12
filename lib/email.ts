import sgMail from '@sendgrid/mail';

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

export async function sendPasswordResetEmail(email: string, resetToken: string) {
  if (!process.env.SENDGRID_API_KEY) {
    console.error('SENDGRID_API_KEY is not set');
    throw new Error('Email service not configured');
  }

  const resetUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/reset-password/${resetToken}`;

  const msg = {
    to: email,
    from: process.env.SENDGRID_FROM_EMAIL || 'mgr@tri-two.com',
    subject: 'Reset Your Password - SEO Grader',
    html: `
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
    `,
    text: `You requested to reset your password. Click this link to set a new password: ${resetUrl}\n\nThis link will expire in 24 hours.`,
  };

  try {
    await sgMail.send(msg);
    console.log('Password reset email sent to:', email);
    return true;
  } catch (error: any) {
    console.error('Error sending email:', error);
    throw error;
  }
}
