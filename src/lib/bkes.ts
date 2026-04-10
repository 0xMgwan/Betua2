import { v4 as uuidv4 } from 'uuid';
import { ethers } from 'ethers';

// bKES API Configuration
const BKES_API_BASE_URL = process.env.BKES_API_BASE_URL || 'https://api.bpesa.net/api/v1/partner';
const BKES_API_KEY = process.env.BKES_API_KEY || '';
const BKES_PARTNER_ID = process.env.BKES_PARTNER_ID || '';

// bKES Token Contract (Base Mainnet)
const BKES_CONTRACT_ADDRESS = '0x4847Dd2cD3323Af3bb0d5572c17064E5aDd2c5de';
const BKES_DECIMALS = 18;
const BASE_RPC_URL = process.env.BASE_RPC_URL || 'https://mainnet.base.org';

// ERC-20 ABI for balance checking
const BKES_ABI = [
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function transfer(address to, uint256 amount) returns (bool)',
];

let provider: ethers.JsonRpcProvider | null = null;

function getProvider(): ethers.JsonRpcProvider {
  if (!provider) {
    provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
  }
  return provider;
}

function getContract(): ethers.Contract {
  return new ethers.Contract(BKES_CONTRACT_ADDRESS, BKES_ABI, getProvider());
}

export interface BkesApiError extends Error {
  statusCode?: number;
  code?: string;
}

export interface FeePreview {
  type: 'onramp' | 'offramp';
  grossAmount: number;
  currency: string;
  totalFeeAmount: number;
  netAmount: number;
  note: string;
}

export interface OnrampRequest {
  walletAddress: string;
  phoneNumber: string;
  amount: number; // KES amount
  mobileNetwork?: string; // e.g., "Safaricom"
}

export interface OfframpRequest {
  walletAddress: string;
  phoneNumber: string;
  amount: number; // bKES amount (will be burned)
  mobileNetwork?: string;
}

export interface TransactionStatus {
  id: string;
  type: 'LOAD' | 'WITHDRAW';
  status: 'PENDING' | 'CONFIRMED' | 'FAILED';
  amount: string; // wei (18 decimals)
  toAddress: string;
  reference: string;
  confirmedAt: string | null;
  createdAt: string;
  errorMsg: string | null;
}

async function apiRequest<T>(
  method: 'GET' | 'POST',
  endpoint: string,
  body?: Record<string, unknown>,
  idempotencyKey?: string
): Promise<T> {
  const url = `${BKES_API_BASE_URL}${endpoint}`;
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-API-Key': BKES_API_KEY,
  };

  if (method === 'POST' && idempotencyKey) {
    headers['Idempotency-Key'] = idempotencyKey;
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json();

  if (!response.ok || !data.ok) {
    const error = new Error(data.error || data.message || 'bKES API error') as BkesApiError;
    error.statusCode = response.status;
    error.code = data.code;
    throw error;
  }

  return data.data as T;
}

export const bkes = {
  // Get fee preview for onramp or offramp
  async getFees(amount: number, type: 'onramp' | 'offramp'): Promise<FeePreview> {
    const endpoint = `/fees?amount=${amount}&partnerId=${BKES_PARTNER_ID}&type=${type}`;
    return apiRequest<FeePreview>('GET', endpoint);
  },

  // Onramp: KES → bKES (user pays via M-Pesa, receives bKES)
  async onramp(request: OnrampRequest): Promise<TransactionStatus> {
    const idempotencyKey = uuidv4();
    return apiRequest<TransactionStatus>('POST', '/onramp', {
      walletAddress: request.walletAddress,
      phoneNumber: request.phoneNumber,
      amount: request.amount,
      currency: 'KES',
      mobileNetwork: request.mobileNetwork || 'Safaricom',
    }, idempotencyKey);
  },

  // Offramp: bKES → KES (burns bKES, sends KES to M-Pesa)
  async offramp(request: OfframpRequest): Promise<TransactionStatus> {
    const idempotencyKey = uuidv4();
    return apiRequest<TransactionStatus>('POST', '/offramp', {
      walletAddress: request.walletAddress,
      phoneNumber: request.phoneNumber,
      amount: request.amount,
      currency: 'KES',
      mobileNetwork: request.mobileNetwork || 'Safaricom',
    }, idempotencyKey);
  },

  // Get transaction status by reference
  async getTransactionStatus(reference: string): Promise<TransactionStatus> {
    return apiRequest<TransactionStatus>('GET', `/tx/${reference}`);
  },

  // Poll transaction until confirmed or failed
  async waitForTransaction(reference: string, maxAttempts = 60, intervalMs = 2000): Promise<TransactionStatus> {
    for (let i = 0; i < maxAttempts; i++) {
      const status = await this.getTransactionStatus(reference);
      if (status.status === 'CONFIRMED' || status.status === 'FAILED') {
        return status;
      }
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
    throw new Error(`Transaction ${reference} timed out after ${maxAttempts * intervalMs / 1000}s`);
  },

  // Get bKES balance for a wallet address (on-chain)
  async getBalance(walletAddress: string): Promise<number> {
    const contract = getContract();
    const balance = await contract.balanceOf(walletAddress);
    return parseFloat(ethers.formatUnits(balance, BKES_DECIMALS));
  },

  // Convert KES amount to bKES wei (18 decimals)
  toWei(amountKes: number): bigint {
    return ethers.parseUnits(amountKes.toString(), BKES_DECIMALS);
  },

  // Convert bKES wei to KES amount
  fromWei(amountWei: string | bigint): number {
    return parseFloat(ethers.formatUnits(amountWei, BKES_DECIMALS));
  },

  // Constants
  CONTRACT_ADDRESS: BKES_CONTRACT_ADDRESS,
  DECIMALS: BKES_DECIMALS,
};

export default bkes;
