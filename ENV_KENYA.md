# Kenya Integration - Environment Variables

Add these to your `.env` file:

```bash
# Pretium API (Kenya M-Pesa on/off-ramp)
PRETIUM_API_URL=https://api.pretium.africa
PRETIUM_API_KEY=your_pretium_api_key
PRETIUM_SECRET_KEY=your_pretium_secret_key

# NKES Token (Kenyan Shilling Stablecoin)
NKES_CONTRACT_ADDRESS=0x...  # Deploy contract first
NKES_MINTER_PRIVATE_KEY=0x...  # Private key with minting rights
BASE_RPC_URL=https://mainnet.base.org
```

## Setup Steps

1. **Deploy NKES Contract**
   - Use Remix or Hardhat to deploy `contracts/NKES.sol` to Base
   - Copy the deployed contract address to `NKES_CONTRACT_ADDRESS`
   - The deployer wallet becomes the minter

2. **Configure Pretium**
   - Get API credentials from Pretium dashboard
   - Set webhook URL to: `https://guap.gold/api/webhooks/pretium`

3. **Run Migration**
   ```bash
   npx prisma migrate dev --name add-kenya-support
   ```

4. **Test Flow**
   - Register with Kenya phone (254xxx)
   - Deposit via M-Pesa KE
   - Pretium webhook triggers NKES mint
   - User sees KES balance in app
