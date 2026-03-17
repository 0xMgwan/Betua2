# GUAP - Prediction Markets Platform

![GUAP Banner](https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1200&h=300&fit=crop&q=80)

**Tanzania's first prediction market platform.** Trade on real-world events and earn from your knowledge.

[![Live](https://img.shields.io/badge/status-live-success)](https://www.guap.gold)
[![API](https://img.shields.io/badge/API-v1.0-blue)](https://www.guap.gold/developers)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

---

## 🎯 What is GUAP?

GUAP is a **prediction market platform** where users can:
- **Trade on real-world events** (politics, sports, crypto, FX, commodities)
- **Earn from accurate predictions** through proportional pot distribution
- **Create custom markets** on any verifiable outcome
- **Compete on the leaderboard** for top trader status

### Key Features

✅ **No KYC Required** - Start trading immediately  
✅ **M-Pesa Integration** - Deposit and withdraw via mobile money  
✅ **Multi-Language Support** - English & Swahili  
✅ **Real-Time Prices** - Live market updates via WebSocket  
✅ **Referral System** - Earn 1% of referred users' first deposit  
✅ **Public API** - Integrate prediction markets into your app  

---

## 🏗️ Architecture

### Tech Stack

- **Frontend**: Next.js 14 (App Router), React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Prisma ORM
- **Database**: PostgreSQL (Neon)
- **Payments**: nTZS API (M-Pesa integration)
- **Price Feeds**: Pyth Network (crypto, FX, commodities)
- **Real-Time**: WebSocket for live market updates
- **Animations**: Framer Motion
- **Icons**: Phosphor Icons

### Core Systems

1. **Market Creation & Resolution**
   - Binary markets (YES/NO)
   - Multi-option markets (3+ outcomes)
   - Automated resolution via Pyth price feeds
   - Manual resolution by market creators

2. **Trading Engine**
   - Constant Product Market Maker (CPMM) AMM
   - Dynamic pricing based on liquidity pools
   - 5% entry fee + 5% settlement fee
   - Proportional pot distribution for winners

3. **Wallet System**
   - nTZS integration for deposits/withdrawals
   - M-Pesa support via nTZS
   - Internal balance tracking
   - Transaction history

4. **Referral System**
   - Auto-generated referral codes
   - 1% reward on first deposit only
   - Tracked via `ReferralReward` model

5. **Leaderboard**
   - Real-time P&L tracking
   - Win rate calculation
   - Total volume traded
   - Ranking system

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- nTZS API credentials

### Installation

```bash
# Clone the repository
git clone https://github.com/0xMgwan/Betua2.git
cd Betua2

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your credentials

# Run database migrations
npx prisma db push
npx prisma generate

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

### Environment Variables

```bash
# Database
DATABASE_URL="postgresql://..."

# nTZS API
NTZS_API_KEY="your-api-key"
NTZS_API_SECRET="your-api-secret"
PLATFORM_NTZS_USER_ID="platform-wallet-id"
SETTLEMENT_FEE_NTZS_USER_ID="fee-wallet-id"

# Fees
TRANSACTION_FEE_PERCENT="5"

# Admin
ADMIN_API_SECRET="your-admin-secret"

# Optional
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

---

## 📡 Public API

GUAP provides a **REST API** for third-party integrations. Banks, mobile money apps, and fintech platforms can integrate prediction markets into their apps.

### Quick Start

```bash
# 1. Create user
curl -X POST https://www.guap.gold/api/v1/users \
  -H "Authorization: Bearer gp_live_xxx" \
  -H "Content-Type: application/json" \
  -d '{"externalId": "255712345678"}'

# 2. Place trade
curl -X POST https://www.guap.gold/api/v1/trades \
  -H "Authorization: Bearer gp_live_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "externalId": "255712345678",
    "marketId": "clxyz123",
    "side": "YES",
    "amountTzs": 5000
  }'

# 3. Get positions
curl https://www.guap.gold/api/v1/positions?externalId=255712345678 \
  -H "Authorization: Bearer gp_live_xxx"

# 4. Redeem winnings
curl -X POST https://www.guap.gold/api/v1/positions/abc123/redeem \
  -H "Authorization: Bearer gp_live_xxx" \
  -d '{"externalId": "255712345678"}'
```

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/users` | POST | Create/get user |
| `/api/v1/wallet/balance` | GET | Get balance |
| `/api/v1/markets` | GET | List markets |
| `/api/v1/markets/:id` | GET | Market details |
| `/api/v1/trades` | POST | Place trade |
| `/api/v1/trades` | GET | Trade history |
| `/api/v1/positions` | GET | User portfolio |
| `/api/v1/positions/:id/redeem` | POST | Redeem winnings |

**Full documentation**: [www.guap.gold/developers](https://www.guap.gold/developers)

### Rate Limits

| Tier | Requests/Minute | Price |
|------|----------------|-------|
| FREE | 100 | Free |
| BASIC | 500 | Contact us |
| PRO | 2,000 | Contact us |
| ENTERPRISE | 10,000 | Contact us |

### Revenue Model

- **Platform keeps 100%** of trading fees (5% entry + 5% settlement)
- Partners pay API subscription fees
- Partners can add their own fees on deposits/withdrawals

---

## 💰 Fee Structure

### Trading Fees

- **5% Entry Fee** - Deducted when trade is placed
- **5% Settlement Fee** - Deducted when winnings are redeemed
- **Total: ~9.75%** per trade cycle

### Creator Rewards

- **1% of total volume** - Paid to market creators (non-admin only)
- Paid from settlement fee wallet
- Transferred when market resolves

### Referral Rewards

- **1% of first deposit** - Paid to referrer
- One-time reward per referred user
- Transferred immediately on deposit completion

---

## 🗂️ Database Schema

### Core Models

- **User** - User accounts, balances, referral codes
- **Market** - Prediction markets (binary/multi-option)
- **Position** - User's shares in markets
- **Trade** - Trade history
- **Transaction** - Wallet transactions
- **ReferralReward** - Referral earnings
- **Notification** - User notifications

### API Models

- **Partner** - API partners (banks, apps)
- **PartnerUser** - Maps partner users to Betua users
- **ApiLog** - API request logging

See `prisma/schema.prisma` for full schema.

---

## 🎨 UI/UX

### Design System

- **Terminal Aesthetic** - Monospace fonts, orange accents
- **Dark Mode** - Default dark theme
- **Responsive** - Mobile-first design
- **Animations** - Framer Motion for smooth transitions
- **Accessibility** - ARIA labels, keyboard navigation

### Color Palette

```css
--background: #0a0a0a
--foreground: #ffffff
--accent: #ff6b00 (orange)
--card: #1a1a1a
--card-border: #2a2a2a
--muted: #888888
```

---

## 📊 Market Resolution

### Automated (Pyth Price Feeds)

Markets using Pyth Network price feeds resolve automatically:
1. Market expires at `resolvesAt` timestamp
2. Pyth price is fetched for the symbol
3. Outcome determined by comparing price to target
4. Winners can redeem proportional share of pot

### Manual Resolution

Market creators can manually resolve markets:
1. Only creator or admin can resolve
2. Select winning outcome
3. System calculates payouts
4. Winners notified via notifications

---

## 🔐 Security

- **API Key Authentication** - SHA-256 hashed keys
- **Rate Limiting** - Per-partner request limits
- **Input Validation** - Zod schemas for all inputs
- **SQL Injection Protection** - Prisma ORM
- **CSRF Protection** - Next.js built-in
- **Environment Variables** - Sensitive data in `.env.local`

---

## 🚢 Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

### Environment Variables

Add all `.env.local` variables to Vercel project settings.

### Database

Use Neon PostgreSQL for production:
1. Create database at [neon.tech](https://neon.tech)
2. Copy connection string to `DATABASE_URL`
3. Run `npx prisma db push`

---

## 🤝 Contributing

We welcome contributions! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

---

## 📞 Contact

- **Website**: [www.guap.gold](https://www.guap.gold)
- **API Docs**: [www.guap.gold/developers](https://www.guap.gold/developers)
- **Twitter**: [@shindaguap](https://x.com/shindaguap)
- **WhatsApp**: [Join Community](https://chat.whatsapp.com/CfFU1jLmjDO8QLrH31Sv0C)
- **Email**: api@guap.gold

---

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

**Built with ❤️ for Africa 🌍**
