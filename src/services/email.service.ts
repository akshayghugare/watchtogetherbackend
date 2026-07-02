import nodemailer from 'nodemailer';
import { env } from '../config/env';
import { logger } from '../utils/logger';

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_SECURE,
  auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
});

interface SendArgs {
  to: string;
  subject: string;
  html: string;
}

async function send({ to, subject, html }: SendArgs): Promise<void> {
  try {
    await transporter.sendMail({ from: env.EMAIL_FROM, to, subject, html });
  } catch (err) {
    // Email failures must not break auth flows; they are logged for ops.
    logger.error(`Failed to send email "${subject}" to ${to}: ${(err as Error).message}`);
  }
}

function layout(title: string, bodyHtml: string): string {
  return `
  <div style="font-family:Segoe UI,Arial,sans-serif;background:#0f1115;padding:32px">
    <div style="max-width:520px;margin:0 auto;background:#181b22;border-radius:12px;padding:32px;color:#e5e7eb">
      <h1 style="color:#8b5cf6;font-size:22px;margin:0 0 16px">🎬 CollabPlatform</h1>
      <h2 style="font-size:18px;margin:0 0 12px;color:#f3f4f6">${title}</h2>
      ${bodyHtml}
      <p style="color:#6b7280;font-size:12px;margin-top:28px">
        If you didn't request this, you can safely ignore this email.
      </p>
    </div>
  </div>`;
}

function button(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:#8b5cf6;color:#fff;
    padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0">${label}</a>`;
}

export async function sendVerificationEmail(to: string, username: string, token: string): Promise<void> {
  const url = `${env.CLIENT_URL}/verify-email/${token}`;
  await send({
    to,
    subject: 'Verify your email — CollabPlatform',
    html: layout(
      `Welcome, ${username}!`,
      `<p>Confirm your email address to activate your account. This link expires in 24 hours.</p>
       ${button(url, 'Verify Email')}
       <p style="color:#9ca3af;font-size:13px;word-break:break-all">Or paste this link: ${url}</p>`,
    ),
  });
}

export async function sendPasswordResetEmail(to: string, username: string, token: string): Promise<void> {
  const url = `${env.CLIENT_URL}/reset-password/${token}`;
  await send({
    to,
    subject: 'Reset your password — CollabPlatform',
    html: layout(
      `Hi ${username},`,
      `<p>We received a request to reset your password. This link expires in 30 minutes.</p>
       ${button(url, 'Reset Password')}
       <p style="color:#9ca3af;font-size:13px;word-break:break-all">Or paste this link: ${url}</p>`,
    ),
  });
}

export async function sendPasswordChangedEmail(to: string, username: string): Promise<void> {
  await send({
    to,
    subject: 'Your password was changed — CollabPlatform',
    html: layout(
      `Hi ${username},`,
      `<p>Your password was just changed and all other sessions were signed out.
       If this wasn't you, reset your password immediately.</p>`,
    ),
  });
}
