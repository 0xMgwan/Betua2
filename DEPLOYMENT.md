# Deployment Guide for GUAP (Betua2)

## Required Environment Variables

Add these to your Vercel project settings:

### Essential Variables

```bash
# Database Connection (Required)
DATABASE_URL=postgresql://username:password@host/database?sslmode=require

# JWT Secret (Required) - Generate with: openssl rand -base64 32
JWT_SECRET=your-secret-key-here
```

### Optional Variables (for nTZS wallet integration)

```bash
NTZS_API_KEY=your-ntzs-api-key
NTZS_API_URL=https://api.ntzs.io
PLATFORM_NTZS_USER_ID=platform-wallet-id
SETTLEMENT_FEE_NTZS_USER_ID=fee-wallet-id
CREATION_FEE_NTZS_USER_ID=creation-fee-wallet-id
MARKET_CREATION_FEE_TZS=2000
TRANSACTION_FEE_PERCENT=5
```

## Setup Steps

### 1. Add Environment Variables to Vercel

1. Go to https://vercel.com/dashboard
2. Select your project (Betua2)
3. Navigate to **Settings** → **Environment Variables**
4. Add the required variables above
5. Click **Save**

### 2. Push Database Schema

After adding environment variables, run:

```bash
# Pull production environment variables locally
vercel env pull .env.production

# Push schema to production database
npx prisma db push
```

### 3. Redeploy

After setting up environment variables and pushing the schema:

1. Go to **Deployments** tab in Vercel
2. Click **Redeploy** on the latest deployment
3. Or push a new commit to trigger automatic deployment

## Troubleshooting

### "Server error" on login/register

- **Cause**: Missing `DATABASE_URL` or `JWT_SECRET`
- **Fix**: Add environment variables in Vercel settings and redeploy

### Database schema errors

- **Cause**: Schema not pushed to production database
- **Fix**: Run `npx prisma db push` with production DATABASE_URL

### "Wallet not provisioned" errors

- **Cause**: Missing nTZS API credentials (optional feature)
- **Fix**: Either add nTZS credentials or users can skip wallet features

## Generate JWT Secret

Run this command to generate a secure JWT secret:

```bash
openssl rand -base64 32
```

Copy the output and use it as your `JWT_SECRET` environment variable.
