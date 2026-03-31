import { ethers } from 'ethers';

const NKES_CONTRACT_ADDRESS = process.env.NKES_CONTRACT_ADDRESS || '';
const NKES_MINTER_PRIVATE_KEY = process.env.NKES_MINTER_PRIVATE_KEY || '';
const BASE_RPC_URL = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
const PLATFORM_NTZS_USER_ID = process.env.PLATFORM_NTZS_USER_ID || '';

const NKES_ABI = [
  'function mint(address to, uint256 amount) external',
  'function burn(address from, uint256 amount) external',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
];

let provider: ethers.JsonRpcProvider | null = null;
let signer: ethers.Wallet | null = null;
let contract: ethers.Contract | null = null;

function getContract(): ethers.Contract {
  if (!contract) {
    provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
    signer = new ethers.Wallet(NKES_MINTER_PRIVATE_KEY, provider);
    contract = new ethers.Contract(NKES_CONTRACT_ADDRESS, NKES_ABI, signer);
  }
  return contract;
}

async function getEscrowAddress(): Promise<string> {
  const { ntzs } = await import('@/lib/ntzs');
  const user = await ntzs.users.get(PLATFORM_NTZS_USER_ID);
  return user.walletAddress;
}

export const nkes = {
  async mint(toAddress: string, amountKes: number): Promise<string> {
    const nkesContract = getContract();
    const amount = ethers.parseUnits(amountKes.toString(), 2);
    const tx = await nkesContract.mint(toAddress, amount);
    const receipt = await tx.wait();
    return receipt.hash;
  },

  async burn(fromAddress: string, amountKes: number): Promise<string> {
    const nkesContract = getContract();
    const amount = ethers.parseUnits(amountKes.toString(), 2);
    const tx = await nkesContract.burn(fromAddress, amount);
    const receipt = await tx.wait();
    return receipt.hash;
  },

  async getBalance(address: string): Promise<number> {
    const nkesContract = getContract();
    const balance = await nkesContract.balanceOf(address);
    const decimals = await nkesContract.decimals();
    return parseFloat(ethers.formatUnits(balance, decimals));
  },

  async transferToEscrow(fromAddress: string, amountKes: number): Promise<string> {
    const escrowAddress = await getEscrowAddress();
    const nkesContract = getContract();
    const amount = ethers.parseUnits(amountKes.toString(), 2);
    const burnTx = await nkesContract.burn(fromAddress, amount);
    await burnTx.wait();
    const mintTx = await nkesContract.mint(escrowAddress, amount);
    const receipt = await mintTx.wait();
    return receipt.hash;
  },

  async transferFromEscrow(toAddress: string, amountKes: number): Promise<string> {
    const escrowAddress = await getEscrowAddress();
    const nkesContract = getContract();
    const amount = ethers.parseUnits(amountKes.toString(), 2);
    const burnTx = await nkesContract.burn(escrowAddress, amount);
    await burnTx.wait();
    const mintTx = await nkesContract.mint(toAddress, amount);
    const receipt = await mintTx.wait();
    return receipt.hash;
  },
};

export default nkes;
