// Email sending — plain JavaScript ES module.
//
// Pick ONE way to send, by setting environment variables:
//   SMTP (Gmail, Outlook, Zoho, your host…):  SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
//   Resend:                                   RESEND_API_KEY
//   SendGrid:                                 SENDGRID_API_KEY
// Plus EMAIL_FROM, e.g.  "Elysian <no-reply@yourdomain.com>"
//
// With none set (local development) emails are printed to the server log instead.

import nodemailer from 'nodemailer';

let transport = null;

/** Which delivery method is configured: "smtp" | "resend" | "sendgrid" | "console". */
export function mailProvider() {
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) return 'smtp';
  if (process.env.RESEND_API_KEY) return 'resend';
  if (process.env.SENDGRID_API_KEY) return 'sendgrid';
  return 'console';
}

function fromAddress() {
  return process.env.EMAIL_FROM || process.env.SMTP_USER || 'no-reply@example.com';
}

function smtp() {
  if (!transport) {
    const port = Number(process.env.SMTP_PORT) || 587;
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transport;
}

/**
 * Send one email.
 * @param {{ to: string, subject: string, text: string, html?: string }} msg
 * @returns {Promise<{ ok: boolean, provider: string, error?: string }>}
 */
export async function sendMail({ to, subject, text, html }) {
  const provider = mailProvider();
  try {
    if (provider === 'smtp') {
      await smtp().sendMail({ from: fromAddress(), to, subject, text, html });
    } else if (provider === 'resend') {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: fromAddress(), to: [to], subject, text, html }),
      });
      if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
    } else if (provider === 'sendgrid') {
      const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: to }] }],
          from: { email: fromAddress().replace(/^.*<|>$/g, '') },
          subject,
          content: [{ type: 'text/plain', value: text }, ...(html ? [{ type: 'text/html', value: html }] : [])],
        }),
      });
      if (!res.ok) throw new Error(`SendGrid ${res.status}: ${(await res.text()).slice(0, 200)}`);
    } else {
      console.log(`\n[mail] (no email service configured) To: ${to}\n[mail] Subject: ${subject}\n[mail] ${text}\n`);
    }
    return { ok: true, provider };
  } catch (err) {
    console.error(`[mail] Failed to send to ${to} via ${provider}:`, err.message);
    return { ok: false, provider, error: err.message };
  }
}

const escape = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/**
 * Email a 6-digit password reset code.
 * @param {string} to
 * @param {string} code
 * @param {{ siteName?: string, minutes?: number }} [opts]
 */
export function sendResetCode(to, code, { siteName = 'Elysian', minutes = 15 } = {}) {
  const subject = `${code} is your ${siteName} password reset code`;
  const text =
    `Your ${siteName} password reset code is: ${code}\n\n` +
    `Enter it on the reset page within ${minutes} minutes.\n\n` +
    `If you didn't ask to reset your password, you can ignore this email — your password won't change.`;
  const html = `<div style="font-family:Arial,sans-serif;max-width:460px;margin:auto;padding:24px;background:#09090b;color:#fafafa;border-radius:12px">
  <h2 style="margin:0 0 12px">Reset your ${escape(siteName)} password</h2>
  <p style="color:#a1a1aa">Enter this code on the reset page:</p>
  <p style="font-size:34px;letter-spacing:8px;font-weight:bold;color:#f59e0b;margin:18px 0">${escape(code)}</p>
  <p style="color:#a1a1aa;font-size:13px">It expires in ${minutes} minutes. If you didn't ask for this, ignore this email — your password won't change.</p>
</div>`;
  return sendMail({ to, subject, text, html });
}
