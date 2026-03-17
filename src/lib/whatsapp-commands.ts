// WhatsApp command handler for GUAP bot

import { prisma } from "@/lib/prisma";
import { ntzs } from "@/lib/ntzs";
import { getPrice } from "@/lib/amm";
import { sendWhatsAppMessage, sendWhatsAppList } from "@/lib/whatsapp";
import {
  getCachedUser,
  setCachedUser,
  invalidateUserCache,
  getCachedBalance,
  setCachedBalance,
  invalidateBalanceCache,
} from "@/lib/whatsapp-cache";

// User session state (in production, use Redis)
const userSessions: Map<string, { step: string; data: Record<string, unknown> }> = new Map();

// Format TZS amount
function formatTZS(amount: number): string {
  return new Intl.NumberFormat("sw-TZ").format(Math.round(amount));
}

// Main command handler
export async function handleCommand(phone: string, text: string): Promise<void> {
  const command = text.toLowerCase().trim();
  const session = userSessions.get(phone);

  // Check if user is in a flow
  if (session) {
    await handleSessionFlow(phone, text, session);
    return;
  }

  // Parse commands
  if (command === "hi" || command === "hello" || command === "menu" || command === "start") {
    await sendWelcome(phone);
  } else if (command === "register" || command === "sajili") {
    await startRegistration(phone);
  } else if (command === "balance" || command === "salio") {
    await showBalance(phone);
  } else if (command === "deposit" || command === "weka") {
    await startDeposit(phone);
  } else if (command === "withdraw" || command === "toa") {
    await startWithdraw(phone);
  } else if (command === "markets" || command === "masoko") {
    await showMarkets(phone);
  } else if (command === "portfolio" || command === "hisa") {
    await showPortfolio(phone);
  } else if (command.startsWith("buy ") || command.startsWith("nunua ")) {
    await handleBuy(phone, command);
  } else if (command.startsWith("sell ") || command.startsWith("uza ")) {
    await handleSell(phone, command);
  } else if (command === "help" || command === "msaada") {
    await sendHelp(phone);
  } else {
    await sendWhatsAppMessage(phone,
      `❓ Sijui amri hiyo.\n\nAndika *menu* kuona chaguzi zote.`
    );
  }
}

// Welcome message
async function sendWelcome(phone: string): Promise<void> {
  const user = await findUserByPhone(phone);
  
  if (user) {
    const balance = await getUserBalance(user.id, phone);
    await sendWhatsAppMessage(phone,
      `🎯 *Karibu GUAP!*\n\n` +
      `Salio lako: *${formatTZS(balance)} TZS*\n\n` +
      `📋 *Amri:*\n` +
      `• *markets* - Tazama masoko\n` +
      `• *balance* - Angalia salio\n` +
      `• *deposit* - Weka pesa\n` +
      `• *withdraw* - Toa pesa\n` +
      `• *portfolio* - Hisa zako\n` +
      `• *help* - Msaada\n\n` +
      `Chagua moja kuendelea! 🚀`
    );
  } else {
    await sendWhatsAppMessage(phone,
      `🎯 *Karibu GUAP!*\n\n` +
      `GUAP ni soko la utabiri la kwanza Afrika.\n` +
      `Tabiri matukio, nunua hisa, shinda pesa!\n\n` +
      `📱 Andika *register* kujiandikisha sasa!`
    );
  }
}

// Start registration
async function startRegistration(phone: string): Promise<void> {
  const existingUser = await findUserByPhone(phone);
  
  if (existingUser) {
    await sendWhatsAppMessage(phone,
      `✅ Tayari umejiandikisha!\n\nAndika *menu* kuona chaguzi.`
    );
    return;
  }

  userSessions.set(phone, { step: "register_name", data: { phone } });
  await sendWhatsAppMessage(phone,
    `📝 *Jiandikishe GUAP*\n\nTafadhali andika jina lako:`
  );
}

// Handle session flows
async function handleSessionFlow(
  phone: string,
  text: string,
  session: { step: string; data: Record<string, unknown> }
): Promise<void> {
  const { step, data } = session;

  if (step === "register_name") {
    data.name = text.trim();
    userSessions.set(phone, { step: "register_confirm", data });
    await sendWhatsAppMessage(phone,
      `Jina: *${data.name}*\n\nAndika *ndio* kuthibitisha au *hapana* kurekebisha.`
    );
  } else if (step === "register_confirm") {
    if (text.toLowerCase() === "ndio" || text.toLowerCase() === "yes") {
      await completeRegistration(phone, data);
    } else {
      userSessions.set(phone, { step: "register_name", data: { phone } });
      await sendWhatsAppMessage(phone, `Tafadhali andika jina lako:`);
    }
  } else if (step === "deposit_phone") {
    // Normalize phone number
    let mpesaPhone = text.replace(/[^0-9]/g, "");
    if (mpesaPhone.startsWith("0")) {
      mpesaPhone = "255" + mpesaPhone.substring(1);
    }
    if (!mpesaPhone.startsWith("255") || mpesaPhone.length !== 12) {
      await sendWhatsAppMessage(phone,
        `❌ Nambari si sahihi.\n\nAndika nambari ya M-Pesa (mfano: 0712345678):`
      );
      return;
    }
    data.mpesaPhone = mpesaPhone;
    userSessions.set(phone, { step: "deposit_amount", data });
    await sendWhatsAppMessage(phone,
      `✅ Nambari: ${mpesaPhone}\n\n` +
      `Andika kiasi unachotaka kuweka (TZS):\n\n` +
      `Mfano: *10000*`
    );
  } else if (step === "deposit_amount") {
    const amount = parseInt(text.replace(/[^0-9]/g, ""));
    if (isNaN(amount) || amount < 1000) {
      await sendWhatsAppMessage(phone,
        `❌ Kiasi si sahihi. Weka angalau 1,000 TZS.\n\nAndika kiasi (mfano: 10000):`
      );
      return;
    }
    await processDeposit(phone, amount, data.mpesaPhone as string);
  } else if (step === "withdraw_amount") {
    const amount = parseInt(text.replace(/[^0-9]/g, ""));
    if (isNaN(amount) || amount < 1000) {
      await sendWhatsAppMessage(phone,
        `❌ Kiasi si sahihi. Toa angalau 1,000 TZS.\n\nAndika kiasi:`
      );
      return;
    }
    await processWithdraw(phone, amount);
  } else if (step === "buy_market") {
    await handleMarketSelection(phone, text, "buy");
  } else if (step === "buy_side") {
    data.side = text.toLowerCase();
    userSessions.set(phone, { step: "buy_amount", data });
    await sendWhatsAppMessage(phone,
      `💰 Unataka kuweka kiasi gani? (TZS)\n\nAndika kiasi (mfano: 5000):`
    );
  } else if (step === "buy_amount") {
    const amount = parseInt(text.replace(/[^0-9]/g, ""));
    if (isNaN(amount) || amount < 100) {
      await sendWhatsAppMessage(phone, `❌ Kiasi si sahihi. Weka angalau 100 TZS.`);
      return;
    }
    await executeTrade(phone, data, amount);
  } else {
    userSessions.delete(phone);
    await sendWelcome(phone);
  }
}

// Complete registration
async function completeRegistration(
  phone: string,
  data: Record<string, unknown>
): Promise<void> {
  try {
    // Create nTZS user
    const ntzsUser = await ntzs.users.create({
      externalId: `wa_${phone}`,
      email: `${phone}@whatsapp.guap.gold`,
      phone: phone,
    });

    // Create GUAP user
    await prisma.user.create({
      data: {
        username: data.name as string,
        displayName: data.name as string,
        email: `${phone}@whatsapp.guap.gold`,
        phone: phone,
        ntzsUserId: ntzsUser.id,
        passwordHash: "",
      },
    });

    // Invalidate cache for new user
    invalidateUserCache(phone);
    
    userSessions.delete(phone);
    await sendWhatsAppMessage(phone,
      `✅ *Umefanikiwa kujiandikisha!*\n\n` +
      `Karibu GUAP, ${data.name}! 🎉\n\n` +
      `Andika *deposit* kuweka pesa na kuanza kutabiri!`
    );
  } catch (error) {
    console.error("Registration error:", error);
    userSessions.delete(phone);
    await sendWhatsAppMessage(phone,
      `❌ Tatizo limetokea. Tafadhali jaribu tena baadaye.`
    );
  }
}

// Show balance
async function showBalance(phone: string): Promise<void> {
  const user = await findUserByPhone(phone);
  if (!user) {
    await sendWhatsAppMessage(phone,
      `❌ Hujajiandikisha bado.\n\nAndika *register* kujiandikisha.`
    );
    return;
  }

  const balance = await getUserBalance(user.id);
  await sendWhatsAppMessage(phone,
    `💰 *Salio Lako*\n\n` +
    `Pesa: *${formatTZS(balance)} TZS*\n\n` +
    `• *deposit* - Weka pesa\n` +
    `• *withdraw* - Toa pesa\n` +
    `• *portfolio* - Hisa zako`
  );
}

// Start deposit
async function startDeposit(phone: string): Promise<void> {
  const user = await findUserByPhone(phone);
  if (!user) {
    await sendWhatsAppMessage(phone,
      `❌ Hujajiandikisha bado.\n\nAndika *register* kujiandikisha.`
    );
    return;
  }

  userSessions.set(phone, { step: "deposit_phone", data: { userId: user.id, whatsappPhone: phone } });
  await sendWhatsAppMessage(phone,
    `💳 *Weka Pesa*\n\n` +
    `Andika nambari ya simu yako:\n\n` +
    `Mfano: *0712345678* au *255712345678*`
  );
}

// Process deposit
async function processDeposit(whatsappPhone: string, amount: number, mpesaPhone: string): Promise<void> {
  const user = await findUserByPhone(whatsappPhone);
  if (!user || !user.ntzsUserId) {
    userSessions.delete(whatsappPhone);
    await sendWhatsAppMessage(whatsappPhone, `❌ Tatizo limetokea. Jaribu tena.`);
    return;
  }

  try {
    // Create deposit request via nTZS with M-Pesa phone number
    const deposit = await ntzs.deposits.create({
      userId: user.ntzsUserId,
      amountTzs: amount,
      phone: mpesaPhone,
    });

    // Invalidate balance cache since deposit initiated
    invalidateBalanceCache(whatsappPhone);
    
    userSessions.delete(whatsappPhone);
    await sendWhatsAppMessage(whatsappPhone,
      `✅ *Ombi la Kuweka Pesa Limetumwa!*\n\n` +
      `Kiasi: *${formatTZS(amount)} TZS*\n\n` +
      `📱 Angalia simu yako (${mpesaPhone}) kwa STK push ya M-Pesa.\n` +
      `Weka PIN yako kuthibitisha malipo.\n\n` +
      `Pesa itaonekana kwenye wallet yako ndani ya dakika 1 baada ya kuthibitisha.`
    );
  } catch (error) {
    console.error("Deposit error:", error);
    userSessions.delete(whatsappPhone);
    await sendWhatsAppMessage(whatsappPhone,
      `❌ Tatizo limetokea. Tafadhali jaribu tena.`
    );
  }
}

// Start withdraw
async function startWithdraw(phone: string): Promise<void> {
  const user = await findUserByPhone(phone);
  if (!user) {
    await sendWhatsAppMessage(phone,
      `❌ Hujajiandikisha bado.\n\nAndika *register* kujiandikisha.`
    );
    return;
  }

  const balance = await getUserBalance(user.id);
  userSessions.set(phone, { step: "withdraw_amount", data: { userId: user.id, balance } });
  await sendWhatsAppMessage(phone,
    `💸 *Toa Pesa*\n\n` +
    `Salio: *${formatTZS(balance)} TZS*\n\n` +
    `Andika kiasi unachotaka kutoa:`
  );
}

// Process withdraw
async function processWithdraw(phone: string, amount: number): Promise<void> {
  const session = userSessions.get(phone);
  const balance = (session?.data?.balance as number) || 0;

  if (amount > balance) {
    await sendWhatsAppMessage(phone,
      `❌ Salio haitoshi.\n\nSalio lako: ${formatTZS(balance)} TZS`
    );
    return;
  }

  const user = await findUserByPhone(phone);
  if (!user || !user.ntzsUserId) {
    userSessions.delete(phone);
    await sendWhatsAppMessage(phone, `❌ Tatizo limetokea.`);
    return;
  }

  try {
    await ntzs.withdrawals.create({
      userId: user.ntzsUserId,
      amountTzs: amount,
      phone: phone,
    });

    // Invalidate balance cache since withdrawal initiated
    invalidateBalanceCache(phone);
    
    userSessions.delete(phone);
    await sendWhatsAppMessage(phone,
      `✅ *Pesa Imetumwa!*\n\n` +
      `Kiasi: *${formatTZS(amount)} TZS*\n` +
      `Nambari: *${phone}*\n\n` +
      `Utapokea M-Pesa ndani ya dakika 5.`
    );
  } catch (error) {
    console.error("Withdraw error:", error);
    userSessions.delete(phone);
    await sendWhatsAppMessage(phone, `❌ Tatizo limetokea. Jaribu tena.`);
  }
}

// Show markets
async function showMarkets(phone: string): Promise<void> {
  const markets = await prisma.market.findMany({
    where: { status: "ACTIVE" },
    orderBy: { totalVolume: "desc" },
    take: 10,
  });

  if (markets.length === 0) {
    await sendWhatsAppMessage(phone, `📊 Hakuna masoko yanayofanya kazi sasa.`);
    return;
  }

  const sections = [{
    title: "Masoko Yanayotrend",
    rows: markets.map((m, i) => {
      const price = getPrice(m.yesPool, m.noPool);
      return {
        id: `market_${m.id}`,
        title: m.title.slice(0, 24),
        description: `YES ${Math.round(price.yes * 100)}% | NO ${Math.round(price.no * 100)}%`,
      };
    }),
  }];

  await sendWhatsAppList(
    phone,
    `📊 *Masoko ya GUAP*\n\nChagua soko kutabiri:`,
    "Tazama Masoko",
    sections
  );
}

// Handle buy command
async function handleBuy(phone: string, command: string): Promise<void> {
  const user = await findUserByPhone(phone);
  if (!user) {
    await sendWhatsAppMessage(phone,
      `❌ Hujajiandikisha bado.\n\nAndika *register* kujiandikisha.`
    );
    return;
  }

  // Parse: "buy yes 5000 simba" or "buy yes simba 5000"
  const parts = command.split(/\s+/).slice(1);
  
  if (parts.length < 2) {
    await sendWhatsAppMessage(phone,
      `📝 *Jinsi ya Kununua*\n\n` +
      `Andika: *buy yes 5000* au *buy no 5000*\n\n` +
      `Kwanza andika *markets* kuona masoko.`
    );
    return;
  }

  const side = parts[0].toLowerCase();
  if (side !== "yes" && side !== "no") {
    await sendWhatsAppMessage(phone,
      `❌ Chagua *yes* au *no*.\n\nMfano: *buy yes 5000*`
    );
    return;
  }

  const amount = parseInt(parts[1].replace(/[^0-9]/g, ""));
  if (isNaN(amount) || amount < 100) {
    await sendWhatsAppMessage(phone,
      `❌ Kiasi si sahihi. Weka angalau 100 TZS.\n\nMfano: *buy yes 5000*`
    );
    return;
  }

  // Get active market (simplified - in production, let user select)
  const market = await prisma.market.findFirst({
    where: { status: "ACTIVE" },
    orderBy: { totalVolume: "desc" },
  });

  if (!market) {
    await sendWhatsAppMessage(phone, `❌ Hakuna soko linalopatikana.`);
    return;
  }

  await executeTrade(phone, { marketId: market.id, side, userId: user.id }, amount);
}

// Execute trade
async function executeTrade(
  phone: string,
  data: Record<string, unknown>,
  amount: number
): Promise<void> {
  const user = await findUserByPhone(phone);
  if (!user) {
    userSessions.delete(phone);
    await sendWhatsAppMessage(phone, `❌ Tatizo limetokea.`);
    return;
  }

  const balance = await getUserBalance(user.id);
  if (amount > balance) {
    userSessions.delete(phone);
    await sendWhatsAppMessage(phone,
      `❌ Salio haitoshi.\n\nSalio: ${formatTZS(balance)} TZS\n\nAndika *deposit* kuweka pesa.`
    );
    return;
  }

  try {
    const marketId = data.marketId as string;
    const side = data.side as string;
    const isYes = side === "yes";

    const market = await prisma.market.findUnique({ where: { id: marketId } });
    if (!market) {
      userSessions.delete(phone);
      await sendWhatsAppMessage(phone, `❌ Soko halipatikani.`);
      return;
    }

    // Execute trade via internal API
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || "https://guap.gold"}/api/trades`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        marketId,
        userId: user.id,
        side: isYes ? "YES" : "NO",
        amountTzs: amount,
      }),
    });

    if (!response.ok) {
      throw new Error("Trade failed");
    }

    const result = await response.json();
    const price = getPrice(market.yesPool, market.noPool);

    userSessions.delete(phone);
    await sendWhatsAppMessage(phone,
      `✅ *Umenunua Hisa!*\n\n` +
      `📊 ${market.title}\n` +
      `📈 Upande: *${isYes ? "YES" : "NO"}*\n` +
      `💰 Kiasi: *${formatTZS(amount)} TZS*\n` +
      `🎫 Hisa: *${result.shares?.toFixed(1) || "?"}*\n\n` +
      `Bei sasa: YES ${Math.round(price.yes * 100)}% | NO ${Math.round(price.no * 100)}%\n\n` +
      `Andika *portfolio* kuona hisa zako.`
    );
  } catch (error) {
    console.error("Trade error:", error);
    userSessions.delete(phone);
    await sendWhatsAppMessage(phone, `❌ Tatizo limetokea. Jaribu tena.`);
  }
}

// Handle sell command
async function handleSell(phone: string, command: string): Promise<void> {
  await sendWhatsAppMessage(phone,
    `ℹ️ *Kuuza Hisa*\n\n` +
    `Hisa zinaweza kuuzwa tu baada ya soko kufungwa na matokeo kutangazwa.\n\n` +
    `Andika *portfolio* kuona hisa zako.`
  );
}

// Show portfolio
async function showPortfolio(phone: string): Promise<void> {
  const user = await findUserByPhone(phone);
  if (!user) {
    await sendWhatsAppMessage(phone,
      `❌ Hujajiandikisha bado.\n\nAndika *register* kujiandikisha.`
    );
    return;
  }

  const positions = await prisma.position.findMany({
    where: { userId: user.id },
    include: { market: true },
  });

  if (positions.length === 0) {
    await sendWhatsAppMessage(phone,
      `📂 *Hisa Zako*\n\n` +
      `Huna hisa bado.\n\n` +
      `Andika *markets* kuona masoko na kuanza kutabiri!`
    );
    return;
  }

  let message = `📂 *Hisa Zako*\n\n`;
  
  for (const pos of positions) {
    const price = getPrice(pos.market.yesPool, pos.market.noPool);
    if (pos.yesShares > 0) {
      message += `📈 *${pos.market.title}*\n`;
      message += `   YES: ${pos.yesShares.toFixed(1)} hisa (${Math.round(price.yes * 100)}%)\n\n`;
    }
    if (pos.noShares > 0) {
      message += `📉 *${pos.market.title}*\n`;
      message += `   NO: ${pos.noShares.toFixed(1)} hisa (${Math.round(price.no * 100)}%)\n\n`;
    }
  }

  await sendWhatsAppMessage(phone, message);
}

// Handle market selection from list
async function handleMarketSelection(
  phone: string,
  text: string,
  action: string
): Promise<void> {
  const marketId = text.replace("market_", "");
  const market = await prisma.market.findUnique({ where: { id: marketId } });

  if (!market) {
    userSessions.delete(phone);
    await sendWhatsAppMessage(phone, `❌ Soko halipatikani.`);
    return;
  }

  const price = getPrice(market.yesPool, market.noPool);
  userSessions.set(phone, { step: "buy_side", data: { marketId: market.id } });

  await sendWhatsAppMessage(phone,
    `📊 *${market.title}*\n\n` +
    `YES: *${Math.round(price.yes * 100)}%* (${formatTZS(price.yes * 1000)}/hisa)\n` +
    `NO: *${Math.round(price.no * 100)}%* (${formatTZS(price.no * 1000)}/hisa)\n\n` +
    `Andika *yes* au *no* kuchagua upande:`
  );
}

// Send help
async function sendHelp(phone: string): Promise<void> {
  await sendWhatsAppMessage(phone,
    `📖 *Msaada wa GUAP*\n\n` +
    `*Amri Zote:*\n` +
    `• *register* - Jiandikishe\n` +
    `• *balance* - Angalia salio\n` +
    `• *deposit* - Weka pesa\n` +
    `• *withdraw* - Toa pesa\n` +
    `• *markets* - Tazama masoko\n` +
    `• *portfolio* - Hisa zako\n` +
    `• *buy yes 5000* - Nunua YES\n` +
    `• *buy no 5000* - Nunua NO\n` +
    `• *menu* - Menyu kuu\n\n` +
    `❓ Msaada: wa.me/255123456789`
  );
}

// Helper: Find user by phone (with caching)
async function findUserByPhone(phone: string) {
  // Check cache first
  const cached = getCachedUser(phone);
  if (cached) {
    return cached;
  }

  // Query database
  const user = await prisma.user.findFirst({
    where: { phone },
    select: {
      id: true,
      phone: true,
      ntzsUserId: true,
      username: true,
    },
  });

  // Cache result (only if phone is not null)
  if (user && user.phone) {
    setCachedUser(user.phone, {
      id: user.id,
      phone: user.phone,
      ntzsUserId: user.ntzsUserId,
      username: user.username,
    });
  }

  return user;
}

// Helper: Get user balance (with caching)
async function getUserBalance(userId: string, phone?: string): Promise<number> {
  // Check cache first if phone provided
  if (phone) {
    const cached = getCachedBalance(phone);
    if (cached !== null) return cached;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { ntzsUserId: true },
  });

  if (!user?.ntzsUserId) return 0;

  try {
    const ntzUser = await ntzs.users.get(user.ntzsUserId);
    const balance = ntzUser.balanceTzs || 0;
    
    // Cache the balance
    if (phone) {
      setCachedBalance(phone, balance);
    }
    
    return balance;
  } catch {
    return 0;
  }
}
