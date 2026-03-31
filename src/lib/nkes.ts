/**
 * NKES Token Service
 * Handles minting and burning of NKES tokens on Base
 */

import { ethers } from 'ethers';

const NKES_CONTRACT_ADDRESS = process.env.NKES_CONTRACT_ADDRESS || '';
const NKES_MINTER_PRIVATE_KEY = process.env.NKES_MINTER_PRIVATE_KEY || '';
const BASE_RPC_URL = process.env.BASE_RPC_URL || 'https://mainnet.base.org';

// Platform escrow wallet for NKES
const NKES_ESCROW_ADDRESS = process.env.NKES_ESCROW_ADDRESS || '';

// NKES ABI (only the functions we need)
const NKES_ABI = [
  'function mint(address to, uint256 amount) external',
  'function burn(address from, uint256 amount) external',
  'function transfer(address to, uint256 amount) external returns (bool)',
  'function transferFrom(address from, address to, uint256 amount) external returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
];

let provider: ethers.JsonRpcProvider | null = null;
let signer: ethers.Wallet | null = null;
let contract: ethers.Contract | null = null;

function getContract(): ethers.Contract {
  if (!contract) {
    if (!NKES_CONTRACT_ADDRESS || !NKES_MINTER_PRIVATE_KEY) {
      throw new Error('NKES contract address or minter key not configured');
    }
    provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
    signer = new ethers.Wallet(NKES_MINTER_PRIVATE_KEY, provider);
    contract = new ethers.Contract(NKES_CONTRACT_ADDRESS, NKES_ABI, signer);
  }
  return contract;
}

export const nkes = {
  /**
   * Mint NKES tokens to a user's wallet
   * Called when Pretium webhook confirms KES deposit
   * @param toAddress User's nTZS wallet address (ERC20 compatible)
   * @param amountKes Amount in KES (will be converted to token units)
   */
  async mint(toAddress: string, amountKes: number): Promise<string> {
    const nkesContract = getContract();
    
    // NKES has 2 decimals (like KES cents)
    const amount = ethers.parseUnits(amountKes.toString(), 2);
    
    console.log(`[NKES] Minting ${amountKes} NKES to ${toAddress}`);
    
    const tx = await nkesContract.mint(toAddress, amount);
    const receipt = await tx.wait();
    
    console.log(`[NKES] Mint successful: ${receipt.hash}`);
    
    return receipt.hash;
  },

  /**
   * Burn NKES tokens from a user's wallet
   * Called when user initiates KES withdrawal
   * @param fromAddress User's nTZS wallet address
   * @param amountKes Amount in KES
   */
  async burn(fromAddress: string, amountKes: number): Promise<string> {
    const nkesContract = getContract();
    
    const amount = ethers.parseUnits(amountKes.toString(), 2);
    
    console.log(`[NKES] Burning ${amountKes} NKES from ${fromAddress}`);
    
    const tx = await nkesContract.burn(fromAddress, amount);
    const receipt = await tx.wait();
    
    console.log(`[NKES] Burn successful: ${receipt.hash}`);
    
    return receipt.hash;
  },

  /**
   * Get NKES balance for an address
   * @param address Wallet address
   * @returns Balance in KES (human readable)
   */
  async getBalance(address: string): Promise<number> {
    const nkesContract = getContract();
    
    const balance = await nkesContract.balanceOf(address);
    const decimals = await nkesContract.decimals();
    
    return parseFloat(ethers.formatUnits(balance, decimals));
  },

  /**
   * Transfer NKES from user to platform escrow (for trades)
   * Note: This requires the platform to have approval to transfer on behalf of user
   * For now, we burn from user and mint to escrow (custodial model)
   * @param fromAddress User's wallet address
   * @param amountKes Amount in KES
   */
  async transferToEscrow(fromAddress: string, amountKes: number): Promise<string> {
    if (!NKES_ESCROW_ADDRESS) {
      throw new Error('NKES escrow address not configured');
    }
    
    const nkesContract = getContract();
    const amount = ethers.parseUnits(amountKes.toString(), 2);
    
    console.log(`[NKES] Transferring ${amountKes} NKES from ${fromAddress} to escrow`);
    
    // Burn from user and mint to escrow (custodial transfer)
    const burnTx = await nkesContract.burn(fromAddress, amount);
    await burnTx.wait();
    
    const mintTx = await nkesContract.mint(NKES_ESCROW_ADDRESS, amount);
    const receipt = await mintTx.wait();
    
    console.log(`[NKES] Transfer to escrow successful: ${receipt.hash}`);
    
    return receipt.hash;
  },

  /**
   * Transfer NKES from platform escrow to user (for redemptions)
   * @param toAddress User's wallet address
   * @param amountKes Amount in KES
   */
  async transferFromEscrow(toAddress: string, amountKes: number): Promise<string> {
    if (!NKES_ESCROW_ADDRESS) {
      throw new Error('NKES escrow address not configured');
    }
    
    const nkesContract = getContract();
    const amount = ethers.parseUnits(amountKes.toString(), 2);
    
    console.log(`[NKES] Transferring ${amountKes} NKES from escrow to ${toAddress}`);
    
    // Burn from escrow and mint to user (custodial transfer)
    const burnTx = await nkesContract.burn(NKES_ESCROW_ADDRESS, amount);
    await burnTx.wait();
    
    const mintTx = await nkesContract.mint(toAddress, amount);
    const receipt = await mintTx.wait();
    
    console.log(`[NKES] Transfer from escrow successful: ${receipt.hash}`);
    
    return receipt.hash;
  },

  /**
   * Get escrow address
   */
  getEscrowAddress(): string {
    return NKES_ESCROW_ADDRESS;
  },
};

export default nkes;
