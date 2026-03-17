/**
 * API Documentation
 * GET /api/v1/docs - Returns API documentation
 */

import { NextResponse } from "next/server";

export async function GET() {
  const docs = {
    name: "Betua Public API",
    version: "1.0.0",
    baseUrl: "/api/v1",
    description: "Public API for third-party integrations with Betua prediction markets platform",
    
    authentication: {
      type: "Bearer Token",
      header: "Authorization: Bearer gp_live_xxx...",
      description: "All endpoints require a valid API key. Contact admin to register as a partner.",
    },

    rateLimits: {
      FREE: "100 requests/minute",
      BASIC: "500 requests/minute",
      PRO: "2000 requests/minute",
      ENTERPRISE: "10000 requests/minute",
    },

    endpoints: {
      // Partner Management
      "POST /partners/register": {
        description: "Register a new partner (admin only)",
        headers: { "X-Admin-Secret": "Admin secret key" },
        body: {
          name: "string (required) - Partner name",
          email: "string (required) - Partner email",
          tier: "string (optional) - FREE, BASIC, PRO, ENTERPRISE",
          webhookUrl: "string (optional) - URL for webhook events",
        },
        response: {
          partnerId: "string",
          apiKey: "string - Store securely, shown only once",
          webhookSecret: "string",
        },
      },

      // User Management
      "POST /users": {
        description: "Create or get user by external ID",
        body: {
          externalId: "string (required) - Your user ID (e.g., phone number)",
          email: "string (optional) - User email",
          username: "string (optional) - Username",
          displayName: "string (optional) - Display name",
          phone: "string (optional) - Phone number",
          metadata: "object (optional) - Additional user data",
        },
        response: {
          userId: "string",
          externalId: "string",
          username: "string",
          balanceTzs: "number",
          isNew: "boolean",
        },
      },

      // Wallet
      "GET /wallet/balance": {
        description: "Get user's wallet balance",
        query: {
          externalId: "string (required)",
        },
        response: {
          externalId: "string",
          balanceTzs: "number",
          currency: "TZS",
        },
      },

      // Markets
      "GET /markets": {
        description: "List all markets",
        query: {
          status: "string (optional) - OPEN, RESOLVED, ALL (default: OPEN)",
          category: "string (optional) - Filter by category",
          limit: "number (optional) - Max 100, default 50",
          offset: "number (optional) - Pagination offset",
        },
        response: {
          markets: "array of market objects with prices",
          pagination: { total: "number", limit: "number", offset: "number", hasMore: "boolean" },
        },
      },

      "GET /markets/:id": {
        description: "Get single market details",
        response: {
          id: "string",
          title: "string",
          description: "string",
          category: "string",
          status: "OPEN | RESOLVED",
          type: "BINARY | MULTI",
          prices: "object - Current prices/probabilities",
          totalVolume: "number",
          totalShares: "object",
          resolvesAt: "datetime",
        },
      },

      // Trading
      "POST /trades": {
        description: "Place a trade",
        body: {
          externalId: "string (required) - Your user ID",
          marketId: "string (required) - Market to trade on",
          side: "string (required for binary) - YES or NO",
          optionIndex: "number (required for multi) - Option index (0-based)",
          amountTzs: "number (required) - Amount in TZS (min 100)",
        },
        response: {
          tradeId: "string",
          marketId: "string",
          side: "string",
          amountTzs: "number",
          shares: "number - Shares received",
          price: "number - Average price per share",
          fee: "number - 5% entry fee",
        },
      },

      "GET /trades": {
        description: "Get user's trade history",
        query: {
          externalId: "string (required)",
          limit: "number (optional)",
          offset: "number (optional)",
        },
        response: {
          trades: "array of trade objects",
          pagination: "object",
        },
      },

      // Positions
      "GET /positions": {
        description: "Get user's positions/portfolio",
        query: {
          externalId: "string (required)",
          status: "string (optional) - OPEN, RESOLVED, ALL",
        },
        response: {
          positions: "array of position objects with potential payouts",
          count: "number",
        },
      },

      "POST /positions/:id/redeem": {
        description: "Redeem winnings from a resolved market",
        body: {
          externalId: "string (required)",
        },
        response: {
          positionId: "string",
          marketId: "string",
          winningShares: "number",
          grossPayout: "number",
          settlementFee: "number - 5% fee",
          netPayout: "number - Amount credited",
        },
      },
    },

    fees: {
      entryFee: "5% of trade amount (deducted at trade time)",
      settlementFee: "5% of payout (deducted at redemption)",
      totalFee: "~9.75% per trade cycle",
      note: "All fees go to platform. Partners keep 100% of their own fees if any.",
    },

    errors: {
      400: "Bad Request - Invalid parameters",
      401: "Unauthorized - Invalid or missing API key",
      403: "Forbidden - Resource doesn't belong to user",
      404: "Not Found - Resource doesn't exist",
      429: "Rate Limit Exceeded",
      500: "Internal Server Error",
    },

    examples: {
      createUser: {
        request: `curl -X POST https://betua.com/api/v1/users \\
  -H "Authorization: Bearer gp_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"externalId": "255712345678"}'`,
      },
      placeTrade: {
        request: `curl -X POST https://betua.com/api/v1/trades \\
  -H "Authorization: Bearer gp_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"externalId": "255712345678", "marketId": "abc123", "side": "YES", "amountTzs": 5000}'`,
      },
    },
  };

  return NextResponse.json(docs);
}
