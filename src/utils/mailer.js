const normalizeSecret = (secret) =>
  (secret || '')
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .replace(/\s+/g, '');

const sendGridApiKey = normalizeSecret(process.env.SENDGRID_API_KEY);
const mailFrom = (process.env.MAIL_FROM || '').trim();
const fromMatch = mailFrom.match(/^(.*)<([^<>@\s]+@[^<>@\s]+)>$/);
const fromName = fromMatch ? fromMatch[1].trim().replace(/^"|"$/g, '') : '';
const fromEmail = fromMatch ? fromMatch[2].trim() : mailFrom;

const sendViaSendGrid = async (to, subject, html) => {
  if (!sendGridApiKey) {
    throw new Error('SENDGRID_API_KEY is missing');
  }
  if (!mailFrom) {
    throw new Error('MAIL_FROM is missing');
  }
  if (!fromEmail) {
    throw new Error('MAIL_FROM must contain a valid sender email');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sendGridApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: {
          email: fromEmail,
          ...(fromName ? { name: fromName } : {}),
        },
        personalizations: [
          {
            to: [{ email: to }],
            subject,
          },
        ],
        content: [{ type: 'text/html', value: html }],
      }),
      signal: controller.signal,
    });

    if (response.status !== 202) {
      const body = await response.text();
      throw new Error(`SendGrid API error (${response.status}): ${body}`);
    }
  } finally {
    clearTimeout(timeout);
  }
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

  await sendViaSendGrid(to, subject, html);
};

module.exports = { sendOTPEmail };
