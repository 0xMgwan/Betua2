import nodemailer from 'nodemailer';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://guap.gold';

function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

interface Market {
  id: string;
  title: string;
  category: string;
  imageUrl?: string | null;
}

function getName(email: string): string {
  return email.split('@')[0].replace(/[._]/g, ' ').split(' ')[0];
}

function getEmoji(cat: string): string {
  const e: Record<string, string> = { Sports: '⚽', Politics: '🏛️', Entertainment: '🎬', Business: '💼', 'FX & Commodities': '📈' };
  return e[cat] || '🎯';
}

export async function sendNewMarketsEmail(to: string, markets: Market[], locale: string = 'en', unsubscribeToken: string) {
  const isSw = locale === 'sw';
  const name = getName(to);
  const count = markets.length;
  
  const subject = isSw ? `🔥 ${name}, masoko ${count} mapya yanakungoja!` : `🔥 ${name}, ${count} hot markets just dropped!`;
  const greeting = isSw ? `Habari ${name}! 👋` : `Hey ${name}! 👋`;
  const intro = isSw ? `Masoko ${count} mapya yameongezwa. Tabiri sasa!` : `${count} fresh markets just landed. Predict now!`;

  const cards = markets.map((m, i) => {
    const img = m.imageUrl || 'https://guap.gold/og-image.png';
    return `<tr><td style="padding:16px;border-bottom:1px solid #333;">
      ${i === 0 ? `<img src="${img}" width="100%" height="140" style="display:block;object-fit:cover;border-radius:8px;margin-bottom:12px;" />` : ''}
      <p style="margin:0 0 4px;font-size:11px;color:#00e5a0;">${getEmoji(m.category)} ${m.category}</p>
      <p style="margin:0 0 12px;font-size:17px;font-weight:bold;color:#fff;">${m.title}</p>
      <a href="${BASE_URL}/markets/${m.id}" style="display:inline-block;padding:10px 24px;background:#00e5a0;color:#000;text-decoration:none;font-weight:bold;border-radius:6px;">${isSw ? '🎯 TABIRI' : '🎯 PREDICT'}</a>
    </td></tr>`;
  }).join('');

  const html = `<!DOCTYPE html><html><body style="margin:0;padding:40px 20px;background:#0a0a0a;font-family:sans-serif;">
  <table width="600" style="margin:0 auto;background:#111;border-radius:12px;overflow:hidden;">
    <tr><td style="padding:28px;text-align:center;border-bottom:2px solid #00e5a0;">
      <h1 style="margin:0;color:#00e5a0;font-size:32px;">GUAP</h1>
      <p style="margin:6px 0 0;color:#666;font-size:11px;">${isSw ? 'TABIRI • BIASHARA • SHINDA' : 'PREDICT • TRADE • WIN'}</p>
    </td></tr>
    <tr><td style="padding:24px;">
      <h2 style="margin:0 0 8px;color:#fff;font-size:22px;">${greeting}</h2>
      <p style="margin:0;color:#aaa;font-size:15px;">${intro}</p>
    </td></tr>
    <tr><td style="padding:0 24px;"><table width="100%">${cards}</table></td></tr>
    <tr><td style="padding:24px;text-align:center;">
      <a href="${BASE_URL}/markets" style="display:inline-block;padding:14px 32px;border:2px solid #00e5a0;color:#00e5a0;text-decoration:none;font-weight:bold;border-radius:8px;">${isSw ? '👀 TAZAMA YOTE' : '👀 VIEW ALL'}</a>
    </td></tr>
    <tr><td style="padding:20px;text-align:center;border-top:1px solid #333;">
      <a href="${BASE_URL}/unsubscribe?token=${unsubscribeToken}" style="color:#666;font-size:11px;">${isSw ? 'Jiondoe' : 'Unsubscribe'}</a>
    </td></tr>
  </table>
</body></html>`;

  await getTransporter().sendMail({
    from: process.env.SMTP_FROM || `GUAP <${process.env.SMTP_USER}>`,
    to, subject, html,
  });
}

export async function sendWelcomeEmail(to: string, locale: string = 'en', unsubscribeToken: string) {
  const isSw = locale === 'sw';
  const name = getName(to);
  const subject = isSw ? `🎉 Karibu GUAP, ${name}!` : `🎉 Welcome to GUAP, ${name}!`;

  const html = `<!DOCTYPE html><html><body style="margin:0;padding:40px 20px;background:#0a0a0a;font-family:sans-serif;">
  <table width="600" style="margin:0 auto;background:#111;border-radius:12px;overflow:hidden;">
    <tr><td style="padding:28px;text-align:center;border-bottom:2px solid #00e5a0;">
      <h1 style="margin:0;color:#00e5a0;font-size:32px;">GUAP</h1>
    </td></tr>
    <tr><td style="padding:32px;text-align:center;">
      <h2 style="margin:0 0 16px;color:#fff;font-size:26px;">${isSw ? `Karibu, ${name}! 🎉` : `Welcome, ${name}! 🎉`}</h2>
      <p style="margin:0 0 24px;color:#aaa;font-size:16px;line-height:1.6;">${isSw ? 'Sasa unaweza kutabiri matukio na kushinda pesa halisi!' : 'You can now predict real events and win real money!'}</p>
      <table width="100%" style="margin:24px 0;"><tr>
        <td width="33%" style="text-align:center;"><p style="margin:0;font-size:28px;">💰</p><p style="margin:4px 0 0;color:#888;font-size:12px;">${isSw ? 'Weka Pesa' : 'Deposit'}</p></td>
        <td width="33%" style="text-align:center;"><p style="margin:0;font-size:28px;">🎯</p><p style="margin:4px 0 0;color:#888;font-size:12px;">${isSw ? 'Tabiri' : 'Predict'}</p></td>
        <td width="33%" style="text-align:center;"><p style="margin:0;font-size:28px;">🏆</p><p style="margin:4px 0 0;color:#888;font-size:12px;">${isSw ? 'Shinda' : 'Win'}</p></td>
      </tr></table>
      <a href="${BASE_URL}/markets" style="display:inline-block;padding:16px 40px;background:#00e5a0;color:#000;text-decoration:none;font-weight:bold;border-radius:8px;font-size:16px;">${isSw ? '🚀 ANZA SASA' : '🚀 START NOW'}</a>
    </td></tr>
    <tr><td style="padding:20px;text-align:center;border-top:1px solid #333;">
      <a href="${BASE_URL}/unsubscribe?token=${unsubscribeToken}" style="color:#666;font-size:11px;">${isSw ? 'Jiondoe' : 'Unsubscribe'}</a>
    </td></tr>
  </table>
</body></html>`;

  await getTransporter().sendMail({
    from: process.env.SMTP_FROM || `GUAP <${process.env.SMTP_USER}>`,
    to, subject, html,
  });
}
