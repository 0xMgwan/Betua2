// NTZS REST API client
// Strip quotes from env vars (common .env misconfiguration)
const NTZS_BASE_URL = (process.env.NTZS_BASE_URL || "https://www.ntzs.co.tz").replace(/^["']|["']$/g, "");
const NTZS_API_KEY = (process.env.NTZS_API_KEY || "").replace(/^["']|["']$/g, "");

async function ntzsRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const method = options.method || "GET";
  const url = `${NTZS_BASE_URL}/api/v1${path}`;

  // Log every outgoing request so we can see exactly what is sent to nTZS
  if (options.body) {
    console.log(`[nTZS →] ${method} ${url}`, options.body);
  }

  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${NTZS_API_KEY}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    const rawText = await res.text().catch(() => "");
    let body: Record<string, unknown> = {};
    try { body = JSON.parse(rawText); } catch { /* not JSON */ }

    // Always log the raw nTZS error response for server-side debugging
    console.error(
      `[nTZS ✗] ${method} ${path} → ${res.status} ${res.statusText}`,
      rawText || "(empty body)"
    );
    const code = String(
      body?.code ||
      (typeof body?.error === "string" ? body.error : null) ||
      "unknown_error"
    );
    const message = String(
      body?.message ||
      (typeof body?.error === "string" ? body.error : null) ||
      res.statusText
    );
    throw new NtzsApiError(res.status, code, message, body);
  }

  return res.json();
}

export class NtzsApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    // Preserve full response body for debugging
    public body: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = "NtzsApiError";
  }
}

export interface NtzsUser {
  id: string;
  externalId: string;
  email: string;
  phone?: string;
  walletAddress: string;
  balanceTzs: number;
  balanceUsdc?: number; // USDC balance as float (e.g., 6.50 = $6.50)
}

export interface NtzsSwapQuote {
  fromToken: string;
  toToken: string;
  fromAmount: number;
  toAmount: number;
  rate: number;
  fee: number;
}

export interface NtzsDeposit {
  id: string;
  userId: string;
  amountTzs: number;
  status: "pending" | "minted" | "failed";
  phone: string;
}

export interface NtzsTransfer {
  id: string;
  fromUserId: string;
  toUserId: string;
  amountTzs: number;
  // nTZS charges its own network fee; actual amount received may be less
  recipientAmountTzs: number;
  feeAmountTzs: number;
  status: "completed" | "failed";
  txHash: string;
}

export interface NtzsWithdrawal {
  id: string;
  userId: string;
  amountTzs: number;
  phone: string;
  status: "pending" | "completed" | "failed";
}

export const ntzs = {
  users: {
    create: (data: { externalId: string; email: string; phone?: string }) =>
      ntzsRequest<NtzsUser>("/users", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    get: (userId: string) =>
      ntzsRequest<NtzsUser>(`/users/${userId}`),

    getBalance: async (userId: string): Promise<{ balanceTzs: number; balanceUsdc: number }> => {
      const user = await ntzsRequest<NtzsUser>(`/users/${userId}`);
      return { balanceTzs: user.balanceTzs, balanceUsdc: user.balanceUsdc || 0 };
    },
  },

  deposits: {
    create: (data: { userId: string; amountTzs: number; phone: string }) => {
      // nTZS API expects 'phoneNumber' not 'phone' despite docs showing 'phone'
      const payload = {
        userId: data.userId,
        amountTzs: data.amountTzs,
        phoneNumber: data.phone,
      };
      console.log("[nTZS] Creating deposit with data:", JSON.stringify(payload, null, 2));
      return ntzsRequest<NtzsDeposit>("/deposits", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },

    get: (depositId: string) =>
      ntzsRequest<NtzsDeposit>(`/deposits/${depositId}`),
  },

  transfers: {
    create: (data: { fromUserId: string; toUserId: string; amountTzs: number }) => {
      console.log("[nTZS] Creating transfer with data:", JSON.stringify(data, null, 2));
      return ntzsRequest<NtzsTransfer>("/transfers", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
  },

  withdrawals: {
    create: (data: { userId: string; amountTzs: number; phone: string }) => {
      // nTZS API expects 'phoneNumber' not 'phone' (same as deposits)
      const payload = {
        userId: data.userId,
        amountTzs: data.amountTzs,
        phoneNumber: data.phone,
      };
      console.log("[nTZS] Creating withdrawal with data:", JSON.stringify(payload, null, 2));
      return ntzsRequest<NtzsWithdrawal>("/withdrawals", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
  },

  // Swap API - swap between nTZS and USDC on Base
  // Returns SSE stream with status updates
  swap: {
    // Execute a swap and wait for completion (handles SSE stream internally)
    // Returns the final txHash on success, throws on failure
    executeAndWait: async (data: { 
      userId: string; 
      fromToken: 'USDC' | 'NTZS'; 
      toToken: 'USDC' | 'NTZS'; 
      amount: number;
      slippageBps?: number; // default 100 (1%)
    }): Promise<{ txHash: string; status: string }> => {
      const url = `${NTZS_BASE_URL}/api/v1/swap`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${NTZS_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!res.ok || !res.body) {
        const errorText = await res.text();
        throw new Error(`Swap request failed: ${res.status} ${errorText}`);
      }

      // Read SSE stream and wait for FILLED or FAILED status
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let lastUpdate: { status: string; message: string; txHash?: string } | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const lines = decoder.decode(value).split('\n');
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const update = JSON.parse(line.slice(6));
            console.log(`[nTZS Swap] ${update.status}: ${update.message}`, update.txHash || '');
            lastUpdate = update;

            if (update.status === 'FILLED') {
              return { txHash: update.txHash, status: 'FILLED' };
            }
            if (update.status === 'FAILED') {
              throw new Error(`Swap failed: ${update.message}`);
            }
          } catch (parseErr) {
            // Ignore parse errors for incomplete lines
          }
        }
      }

      // Stream ended without FILLED status
      if (lastUpdate?.status === 'FILLED') {
        return { txHash: lastUpdate.txHash || '', status: 'FILLED' };
      }
      throw new Error(`Swap stream ended unexpectedly. Last status: ${lastUpdate?.status || 'unknown'}`);
    },
  },
};
