// NTZS REST API client
const NTZS_BASE_URL = process.env.NTZS_BASE_URL || "https://www.ntzs.co.tz";
const NTZS_API_KEY = process.env.NTZS_API_KEY!;

async function ntzsRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${NTZS_BASE_URL}/api/v1${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${NTZS_API_KEY}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    // Always log the raw nTZS error for server-side debugging
    console.error(
      `[nTZS] ${options.method || "GET"} ${path} → ${res.status}`,
      JSON.stringify(body)
    );
    const code =
      body?.code ||
      (typeof body?.error === "string" ? body.error : null) ||
      "unknown_error";
    const message =
      body?.message ||
      (typeof body?.error === "string" ? body.error : null) ||
      res.statusText;
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

    getBalance: async (userId: string): Promise<{ balanceTzs: number }> => {
      const user = await ntzsRequest<NtzsUser>(`/users/${userId}`);
      return { balanceTzs: user.balanceTzs };
    },
  },

  deposits: {
    // Docs field: 'phone' (not 'phoneNumber')
    create: (data: { userId: string; amountTzs: number; phone: string }) =>
      ntzsRequest<NtzsDeposit>("/deposits", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    get: (depositId: string) =>
      ntzsRequest<NtzsDeposit>(`/deposits/${depositId}`),
  },

  transfers: {
    create: (data: { fromUserId: string; toUserId: string; amountTzs: number }) =>
      ntzsRequest<NtzsTransfer>("/transfers", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },

  withdrawals: {
    // Docs field: 'phone' (not 'phoneNumber')
    create: (data: { userId: string; amountTzs: number; phone: string }) =>
      ntzsRequest<NtzsWithdrawal>("/withdrawals", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },
};
