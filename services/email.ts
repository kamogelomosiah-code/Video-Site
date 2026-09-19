export interface SendResult {
  ok: boolean;
  provider: string;
  error?: string;
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<SendResult> {
  const subject = "Reset your Elysian password";
  const html = buildResetHtml(resetUrl);
  const text = `Reset your Elysian password: ${resetUrl}\n\nThis link expires in 30 minutes.\n\nIf you did not request this, please ignore this email.`;

  if (process.env.RESEND_API_KEY) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || "onboarding@resend.dev",
          to: [to],
          subject,
          html,
          text
        })
      });
      if (!res.ok) {
        const err = await res.text();
        return { ok: false, provider: "resend", error: err };
      }
      return { ok: true, provider: "resend" };
    } catch (e: any) {
      return { ok: false, provider: "resend", error: e.message };
    }
  }

  if (process.env.SENDGRID_API_KEY) {
    try {
      const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.SENDGRID_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: to }] }],
          from: { email: process.env.EMAIL_FROM || "no-reply@elysian.com" },
          subject,
          content: [{ type: "text/html", value: html }]
        })
      });
      if (!res.ok) {
        const err = await res.text();
        return { ok: false, provider: "sendgrid", error: err };
      }
      return { ok: true, provider: "sendgrid" };
    } catch (e: any) {
      return { ok: false, provider: "sendgrid", error: e.message };
    }
  }

  console.log(`[email] Password reset link for ${to}: ${resetUrl}`);
  return { ok: true, provider: "console" };
}

function buildResetHtml(resetUrl: string): string {
  return `<div style="font-family: sans-serif; max-width: 480px; margin: auto; padding: 24px; background: #09090b; color: #fafafa; border-radius: 12px; border: 1px solid #27272a;">
  <h2 style="color: #fff; margin: 0 0 16px;">Reset your Elysian password</h2>
  <p style="color: #a1a1aa; line-height: 1.6;">We received a request to reset the password for your Elysian account. Click the button below to choose a new one.</p>
  <a href="${resetUrl}" style="display: inline-block; margin: 24px 0; padding: 14px 24px; background: #eab308; color: #09090b; text-decoration: none; font-weight: bold; border-radius: 8px;">Reset Password</a>
  <p style="color: #71717a; font-size: 12px; line-height: 1.6;">This link expires in 30 minutes. If you did not request this, ignore this email.</p>
</div>`;
}
