import { PublicKey } from "@solana/web3.js";

export type SolanaCluster = "devnet" | "mainnet-beta";

function inferClusterFromRpcUrl(rpcUrl: string): SolanaCluster {
  if (/devnet/i.test(rpcUrl) || /atlas-devnet/i.test(rpcUrl)) return "devnet";
  return "mainnet-beta";
}

export const DEFAULT_SOLANA_CLUSTER: SolanaCluster = (() => {
  const env = (process.env.NEXT_PUBLIC_SOLANA_CLUSTER ?? "").trim();
  if (env === "devnet" || env === "mainnet-beta") return env;
  const rpc = (process.env.NEXT_PUBLIC_RPC_URL ?? "").trim();
  if (rpc) return inferClusterFromRpcUrl(rpc);
  return "devnet";
})();

export function getExplorerTxUrl(signature: string, cluster: SolanaCluster = DEFAULT_SOLANA_CLUSTER) {
  if (!signature) return "";
  return `https://explorer.solana.com/tx/${signature}${cluster === "devnet" ? "?cluster=devnet" : ""}`;
}

export function getExplorerAddressUrl(address: string, cluster: SolanaCluster = DEFAULT_SOLANA_CLUSTER) {
  if (!address) return "";
  return `https://explorer.solana.com/address/${address}${cluster === "devnet" ? "?cluster=devnet" : ""}`;
}

// Devnet USDC mint (Circle's official devnet USDC)
export const USDC_MINT_DEVNET = new PublicKey(
  "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
);

// Mainnet USDC mint (Circle's official USDC)
export const USDC_MINT_MAINNET = new PublicKey(
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
);

export function getUsdcMint(cluster: SolanaCluster = DEFAULT_SOLANA_CLUSTER) {
  return cluster === "devnet" ? USDC_MINT_DEVNET : USDC_MINT_MAINNET;
}

// Devnet SOL token mint (native SOL wrapped)
export const WSOL_MINT = new PublicKey(
  "So11111111111111111111111111111111111111112",
);

// Token decimals
export const USDC_DECIMALS = 6;
export const SOL_DECIMALS = 9;

// Token display names
export const SUPPORTED_TOKENS = [
  { symbol: "SOL", mint: null, decimals: SOL_DECIMALS, label: "SOL" },
  {
    symbol: "USDC",
    mint: USDC_MINT_DEVNET,
    decimals: USDC_DECIMALS,
    label: "USDC",
  },
] as const;

export type TokenSymbol = "SOL" | "USDC";
