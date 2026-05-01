import { Connection } from "@solana/web3.js";

export const SOLANA_CLUSTER = "devnet";

const getRpcUrl = () => {
  if (typeof window === "undefined") {
    // Server-side: use Helius directly (no proxy needed — server is trusted)
    return process.env.HELIUS_RPC_URL ?? "https://api.devnet.solana.com";
  }

  // Client-side: ALWAYS route through our proxy.
  // This means the Helius API key and the user's IP are never linked.
  // The proxy is at /api/rpc and handles all method routing + timeouts.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl) return `${appUrl}/api/rpc`;

  // Local dev fallback — use window origin so the proxy works on any port
  return `${window.location.origin}/api/rpc`;
};

export const SOLANA_RPC_ENDPOINT = getRpcUrl();

export function createConnection() {
  return new Connection(SOLANA_RPC_ENDPOINT, "confirmed");
}

export const connection = createConnection();

