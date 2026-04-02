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
  
  const tagline = isSw ? 'TABIRI • BIASHARA • SHINDA' : 'PREDICT • TRADE • WIN';
  const welcomeTitle = isSw ? `Karibu, ${name}! 🎉` : `Welcome aboard, ${name}! 🎉`;
  const welcomeText = isSw 
    ? 'Umejiunga na jamii ya watabiri wenye akili zaidi Afrika Mashariki. Tabiri matukio halisi na ushinde pesa!'
    : "You've joined East Africa's smartest prediction community. Predict real events and win real money!";
  
  const step1Title = isSw ? '1. WEKA PESA' : '1. DEPOSIT';
  const step1Desc = isSw ? 'M-Pesa au Airtel' : 'M-Pesa or Airtel';
  const step2Title = isSw ? '2. TABIRI' : '2. PREDICT';
  const step2Desc = isSw ? 'Chagua Ndiyo/Hapana' : 'Pick Yes or No';
  const step3Title = isSw ? '3. SHINDA' : '3. WIN';
  const step3Desc = isSw ? 'Pata mara 2x+' : 'Get 2x+ returns';
  
  const cat1 = isSw ? 'Michezo' : 'Sports';
  const cat2 = isSw ? 'Siasa' : 'Politics';
  const cat3 = isSw ? 'Biashara' : 'Business';
  const cat4 = isSw ? 'Burudani' : 'Entertainment';
  
  const ctaText = isSw ? '🚀 ANZA KUTABIRI SASA' : '🚀 START PREDICTING NOW';
  
  const bonus1 = isSw ? 'Pata Bonus' : 'Get Bonus';
  const bonus1Desc = isSw ? 'Alika marafiki' : 'Invite friends';
  const bonus2Desc = isSw ? 'Shindana na wengine' : 'Compete with others';
  const bonus3 = isSw ? 'Malipo Haraka' : 'Fast Payouts';
  const bonus3Desc = isSw ? 'Ondoa mara moja' : 'Withdraw instantly';
  
  const copyright = isSw ? 'Haki zote zimehifadhiwa.' : 'All rights reserved.';
  const unsub = isSw ? 'Jiondoe' : 'Unsubscribe';

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#000;font-family:'Courier New',monospace;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#000;padding:20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#0a0a0a;border:1px solid #00e5a0;">
        
        <tr><td style="background:#1a1a1a;padding:12px 20px;border-bottom:1px solid #333;">
          <span style="display:inline-block;width:12px;height:12px;background:#ff5f56;border-radius:50%;margin-right:8px;"></span>
          <span style="display:inline-block;width:12px;height:12px;background:#ffbd2e;border-radius:50%;margin-right:8px;"></span>
          <span style="display:inline-block;width:12px;height:12px;background:#27ca40;border-radius:50%;"></span>
        </td></tr>
        
        <tr><td style="padding:40px;text-align:center;background:linear-gradient(180deg,#0a0a0a,#111);">
          <h1 style="margin:0;color:#00e5a0;font-size:48px;font-weight:900;letter-spacing:-2px;">GUAP</h1>
          <p style="margin:8px 0 0;color:#00e5a0;font-size:11px;letter-spacing:4px;">${tagline}</p>
        </td></tr>
        
        <tr><td style="padding:30px 40px;">
          <p style="margin:0 0 8px;color:#00e5a0;font-size:12px;font-family:monospace;">$ ./welcome --user="${name}"</p>
          <h2 style="margin:0 0 16px;color:#fff;font-size:26px;">${welcomeTitle}</h2>
          <p style="margin:0;color:#aaa;font-size:15px;line-height:1.7;">${welcomeText}</p>
        </td></tr>
        
        <tr><td style="padding:0 40px 30px;">
          <p style="margin:0 0 16px;color:#00e5a0;font-size:12px;font-family:monospace;">$ cat how_it_works.txt</p>
          <table width="100%" style="background:#111;border:1px solid #333;border-radius:8px;">
            <tr>
              <td style="padding:20px;text-align:center;border-right:1px solid #333;">
                <div style="width:50px;height:50px;margin:0 auto 12px;background:#1a1a1a;border:2px solid #00e5a0;border-radius:50%;line-height:50px;font-size:24px;">💰</div>
                <p style="margin:0;color:#00e5a0;font-size:14px;font-weight:bold;">${step1Title}</p>
                <p style="margin:8px 0 0;color:#888;font-size:12px;">${step1Desc}</p>
              </td>
              <td style="padding:20px;text-align:center;border-right:1px solid #333;">
                <div style="width:50px;height:50px;margin:0 auto 12px;background:#1a1a1a;border:2px solid #00e5a0;border-radius:50%;line-height:50px;font-size:24px;">🎯</div>
                <p style="margin:0;color:#00e5a0;font-size:14px;font-weight:bold;">${step2Title}</p>
                <p style="margin:8px 0 0;color:#888;font-size:12px;">${step2Desc}</p>
              </td>
              <td style="padding:20px;text-align:center;">
                <div style="width:50px;height:50px;margin:0 auto 12px;background:#1a1a1a;border:2px solid #00e5a0;border-radius:50%;line-height:50px;font-size:24px;">🏆</div>
                <p style="margin:0;color:#00e5a0;font-size:14px;font-weight:bold;">${step3Title}</p>
                <p style="margin:8px 0 0;color:#888;font-size:12px;">${step3Desc}</p>
              </td>
            </tr>
          </table>
        </td></tr>
        
        <tr><td style="padding:0 40px 30px;">
          <p style="margin:0 0 16px;color:#00e5a0;font-size:12px;font-family:monospace;">$ ls /markets/categories/</p>
          <table width="100%"><tr>
            <td style="padding:8px;text-align:center;"><span style="display:inline-block;padding:8px 16px;background:#1a1a1a;border:1px solid #333;border-radius:4px;color:#fff;font-size:13px;">⚽ ${cat1}</span></td>
            <td style="padding:8px;text-align:center;"><span style="display:inline-block;padding:8px 16px;background:#1a1a1a;border:1px solid #333;border-radius:4px;color:#fff;font-size:13px;">🏛️ ${cat2}</span></td>
            <td style="padding:8px;text-align:center;"><span style="display:inline-block;padding:8px 16px;background:#1a1a1a;border:1px solid #333;border-radius:4px;color:#fff;font-size:13px;">📈 ${cat3}</span></td>
            <td style="padding:8px;text-align:center;"><span style="display:inline-block;padding:8px 16px;background:#1a1a1a;border:1px solid #333;border-radius:4px;color:#fff;font-size:13px;">🎬 ${cat4}</span></td>
          </tr></table>
        </td></tr>
        
        <tr><td style="padding:0 40px 40px;text-align:center;">
          <a href="${BASE_URL}/markets" style="display:inline-block;padding:18px 50px;background:linear-gradient(135deg,#00e5a0,#00b4d8);color:#000;text-decoration:none;font-weight:bold;font-size:16px;border-radius:8px;box-shadow:0 4px 15px rgba(0,229,160,0.3);">${ctaText}</a>
        </td></tr>
        
        <tr><td style="padding:20px 40px;background:#111;border-top:1px solid #333;">
          <table width="100%"><tr>
            <td style="text-align:center;"><p style="margin:0;color:#00e5a0;font-size:20px;">🎁</p><p style="margin:4px 0 0;color:#fff;font-size:13px;font-weight:bold;">${bonus1}</p><p style="margin:4px 0 0;color:#888;font-size:11px;">${bonus1Desc}</p></td>
            <td style="text-align:center;"><p style="margin:0;color:#00e5a0;font-size:20px;">📊</p><p style="margin:4px 0 0;color:#fff;font-size:13px;font-weight:bold;">Leaderboard</p><p style="margin:4px 0 0;color:#888;font-size:11px;">${bonus2Desc}</p></td>
            <td style="text-align:center;"><p style="margin:0;color:#00e5a0;font-size:20px;">⚡</p><p style="margin:4px 0 0;color:#fff;font-size:13px;font-weight:bold;">${bonus3}</p><p style="margin:4px 0 0;color:#888;font-size:11px;">${bonus3Desc}</p></td>
          </tr></table>
        </td></tr>
        
        <tr><td style="padding:20px;text-align:center;border-top:1px solid #222;">
          <p style="margin:0 0 8px;color:#666;font-size:11px;">© 2026 GUAP. ${copyright}</p>
          <a href="${BASE_URL}/unsubscribe?token=${unsubscribeToken}" style="color:#666;font-size:11px;">${unsub}</a>
        </td></tr>
        
      </table>
    </td></tr>
  </table>
</body></html>`;

  await getTransporter().sendMail({
    from: process.env.SMTP_FROM || `GUAP <${process.env.SMTP_USER}>`,
    to, subject, html,
  });
}
