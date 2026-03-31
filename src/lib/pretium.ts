/**
 * Pretium API SDK
 * On/off-ramp for Kenya M-Pesa
 * Used to collect KES deposits and disburse KES withdrawals
 */

const PRETIUM_API_URL = process.env.PRETIUM_API_URL || 'https://api.pretium.africa';
const PRETIUM_API_KEY = process.env.PRETIUM_API_KEY || '';
const PRETIUM_SECRET_KEY = process.env.PRETIUM_SECRET_KEY || '';

interface PretiumResponse {
  code: number;
  message: string;
  data?: {
    status: string;
    transaction_code: string;
    message: string;
  };
}

interface OnrampRequest {
  phone: string;
  amountKes: number;
  callbackUrl: string;
}

interface OfframpRequest {
  phone: string;
  amountKes: number;
}

async function pretiumRequest(
  endpoint: string,
  method: 'GET' | 'POST' = 'POST',
  body?: object
): Promise<PretiumResponse> {
  const response = await fetch(`${PRETIUM_API_URL}${endpoint}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': PRETIUM_API_KEY,
      'x-secret-key': PRETIUM_SECRET_KEY,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Pretium API error: ${response.status} - ${error}`);
  }

  return response.json();
}

export const pretium = {
  /**
   * Initiate KES collection via M-Pesa (STK Push)
   * User receives prompt on phone to enter PIN
   */
  async onramp({ phone, amountKes, callbackUrl }: OnrampRequest): Promise<{
    transactionCode: string;
    status: string;
  }> {
    // Format phone number (remove + if present, ensure starts with 254)
    const formattedPhone = phone.replace(/^\+/, '').replace(/^0/, '254');

    const response = await pretiumRequest('/v1/onramp/KES', 'POST', {
      shortcode: formattedPhone,
      amount: amountKes,
      mobile_network: 'Safaricom', // Default to Safaricom, can detect from prefix
      callback_url: callbackUrl,
    });

    if (response.code !== 200) {
      throw new Error(`Pretium onramp failed: ${response.message}`);
    }

    return {
      transactionCode: response.data?.transaction_code || '',
      status: response.data?.status || 'PENDING',
    };
  },

  /**
   * Disburse KES to M-Pesa (withdrawal)
   */
  async offramp({ phone, amountKes }: OfframpRequest): Promise<{
    transactionCode: string;
    status: string;
  }> {
    const formattedPhone = phone.replace(/^\+/, '').replace(/^0/, '254');

    const response = await pretiumRequest('/v1/offramp/KES', 'POST', {
      shortcode: formattedPhone,
      amount: amountKes,
      mobile_network: 'Safaricom',
    });

    if (response.code !== 200) {
      throw new Error(`Pretium offramp failed: ${response.message}`);
    }

    return {
      transactionCode: response.data?.transaction_code || '',
      status: response.data?.status || 'PENDING',
    };
  },

  /**
   * Get transaction status
   */
  async getTransaction(transactionCode: string): Promise<{
    status: string;
    amount: number;
    phone: string;
  }> {
    const response = await pretiumRequest(`/v1/transactions/${transactionCode}`, 'GET');

    return {
      status: response.data?.status || 'UNKNOWN',
      amount: 0, // Parse from response
      phone: '',
    };
  },

  /**
   * Verify webhook signature
   */
  verifyWebhook(payload: string, signature: string): boolean {
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', PRETIUM_SECRET_KEY)
      .update(payload)
      .digest('hex');
    return signature === expectedSignature;
  },
};

export default pretium;
