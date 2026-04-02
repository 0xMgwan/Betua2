import nodemailer from 'nodemailer';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://guap.gold';

// SMTP config - works with Gmail, Outlook, or any SMTP provider
// For Gmail: use App Password (not regular password)
// SMTP_HOST=smtp.gmail.com, SMTP_PORT=587, SMTP_USER=your@gmail.com, SMTP_PASS=app_password
function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

interface Market {
  id: string;
  title: string;
  category: string;
}

export async function sendNewMarketsEmail(
  to: string,
  markets: Market[],
  locale: string = 'en',
  unsubscribeToken: string
) {
  const isSw = locale === 'sw';
  const subject = isSw 
    ? `🎯 Masoko Mapya - GUAP`
    : `🎯 New Markets on GUAP`;

  const marketList = markets.map(m => `
    <tr>
      <td style="padding:16px;border-bottom:1px solid #333;">
        <p style="margin:0 0 8px;font-size:16px;font-weight:bold;color:#fff;">${m.title}</p>
        <p style="margin:0 0 12px;font-size:12px;color:#888;">${m.category}</p>
        <a href="${BASE_URL}/markets/${m.id}" style="padding:10px 24px;background:#00e5a0;color:#000;text-decoration:none;font-weight:bold;font-size:14px;">
          ${isSw ? 'TABIRI' : 'PREDICT'} →
        </a>
      </td>
    </tr>
  `).join('');

  const html = `
<body style="margin:0;padding:40px 20px;background:#0a0a0a;font-family:monospace;">
  <table width="600" style="margin:0 auto;background:#111;border:1px solid #00e5a0;">
    <tr><td style="padding:24px;text-align:center;border-bottom:1px solid #333;">
      <h1 style="margin:0;color:#00e5a0;font-size:28px;">GUAP</h1>
      <p style="margin:8px 0 0;color:#888;font-size:12px;">${isSw ? 'TABIRI. BIASHARA. SHINDA.' : 'PREDICT. TRADE. WIN.'}</p>
    </td></tr>
    <tr><td style="padding:24px;color:#fff;font-size:14px;">
      ${isSw ? 'Masoko mapya yameongezwa!' : 'New markets have been added!'}
    </td></tr>
    <tr><td><table width="100%">${marketList}</table></td></tr>
    <tr><td style="padding:24px;text-align:center;">
      <a href="${BASE_URL}/markets" style="padding:14px 32px;border:2px solid #00e5a0;color:#00e5a0;text-decoration:none;font-weight:bold;">
        ${isSw ? 'TAZAMA YOTE' : 'VIEW ALL'} →
      </a>
    </td></tr>
    <tr><td style="padding:24px;border-top:1px solid #333;text-align:center;">
      <a href="${BASE_URL}/unsubscribe?token=${unsubscribeToken}" style="color:#888;font-size:11px;">
        ${isSw ? 'Jiondoe' : 'Unsubscribe'}
      </a>
    </td></tr>
  </table>
</body>`;

  const transporter = getTransporter();
  await transporter.sendMail({
    from: process.env.SMTP_FROM || `GUAP <${process.env.SMTP_USER}>`,
    to,
    subject,
    html,
  });
}
