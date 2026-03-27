const nodemailer = require('nodemailer');
const dns = require('dns');

const normalizeSecret = (secret) =>
  (secret || '')
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .replace(/\s+/g, '');

const emailUser = (process.env.EMAIL_USER || '').trim();
// App passwords are often pasted with spaces/quotes; normalize before SMTP auth.
const emailPass = normalizeSecret(process.env.EMAIL_PASS);
const resendApiKey = normalizeSecret(process.env.RESEND_API_KEY);
const resendFrom =
  (process.env.MAIL_FROM || '').trim() ||
  (emailUser ? `"NestEase" <${emailUser}>` : '"NestEase" <onboarding@resend.dev>');

const baseTransportConfig = {
  auth: {
    user: emailUser,
    pass: emailPass,
  },
  // Render/hosted environments may not have outbound IPv6 routing.
  // Force IPv4 DNS resolution for SMTP to avoid ENETUNREACH on AAAA records.
  family: 4,
  lookup: (hostname, options, callback) =>
    dns.lookup(hostname, { ...(options || {}), family: 4, all: false }, callback),
  connectionTimeout: 15000,
  greetingTimeout: 15000,
  socketTimeout: 20000,
};

const transportProfiles = [
  // Primary: SSL SMTP
  {
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
  },
  // Fallback: STARTTLS SMTP (works on environments where 465 is blocked)
  {
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    requireTLS: true,
  },
  // Final fallback: service preset
  {
    service: 'gmail',
  },
];

const sendViaResend = async (to, subject, html) => {
  if (!resendApiKey) {
    throw new Error('RESEND_API_KEY is missing');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: resendFrom,
        to: [to],
        subject,
        html,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Resend API error (${response.status}): ${body}`);
    }
  } finally {
    clearTimeout(timeout);
  }
};

const sendViaSmtp = async (to, subject, html) => {
  if (!emailUser || !emailPass) {
    throw new Error('SMTP is not configured. EMAIL_USER/EMAIL_PASS missing.');
  }

  const mailOptions = {
    from: resendFrom,
    to,
    subject,
    html,
  };

  let lastError;
  for (const profile of transportProfiles) {
    try {
      const transporter = nodemailer.createTransport({
        ...baseTransportConfig,
        ...profile,
      });
      await transporter.sendMail(mailOptions);
      return;
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(lastError?.message || 'Failed to send OTP email');
};

const sendOTPEmail = async (to, otp) => {
  const subject = 'Verify your NestEase account';
  const html = `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto; padding: 32px; background: #f9f9f9; border-radius: 8px;">
        <h2 style="color: #1A6B6B; margin-bottom: 8px;">NestEase</h2>
        <p style="color: #2D2D2D; font-size: 16px;">Your email verification OTP is:</p>
        <div style="background: #1A6B6B; color: #fff; font-size: 32px; font-weight: bold; letter-spacing: 8px; text-align: center; padding: 16px; border-radius: 8px; margin: 24px 0;">
          ${otp}
        </div>
        <p style="color: #666; font-size: 14px;">This OTP is valid for <strong>10 minutes</strong>. Do not share it with anyone.</p>
        <p style="color: #aaa; font-size: 12px; margin-top: 24px;">If you did not request this, please ignore this email.</p>
      </div>
    `;

  // Prefer HTTP API in production networks where SMTP can be blocked.
  if (resendApiKey) {
    try {
      await sendViaResend(to, subject, html);
      return;
    } catch (error) {
      // fallback to SMTP below
    }
  }

  await sendViaSmtp(to, subject, html);
};

module.exports = { sendOTPEmail };
