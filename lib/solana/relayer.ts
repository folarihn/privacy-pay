import {
  Connection,
  PublicKey,
  Transaction,
} from "@solana/web3.js";
import type { WalletContextState } from "@solana/wallet-adapter-react";

export interface RelayerInfo {
  relayerPublicKey: string;
  blockhash: string;
  lastValidBlockHeight: number;
}

/**
 * Fetch the relayer's public key and a fresh blockhash.
 * The relayer will be the fee payer — user pays nothing for gas.
 */
export async function getRelayerInfo(): Promise<RelayerInfo> {
  const res = await fetch("/api/relay/info");
  if (!res.ok) {
    const err = (await res.json()) as { error?: string };
    throw new Error(err.error ?? "Relayer unavailable");
  }
  return res.json() as Promise<RelayerInfo>;
}

/**
 * Submit a transaction through the relayer.
 * The relayer pays the gas — the user's wallet is not the on-chain fee payer.
 *
 * Flow:
 *  1. Build your transaction instructions (do NOT set feePayer or recentBlockhash)
 *  2. Call sendViaRelayer — it handles feePayer, blockhash, signing, and submission
 *  3. Returns the confirmed transaction signature
 */
export async function sendViaRelayer(params: {
  wallet: WalletContextState;
  connection: Connection;
  buildInstructions: (params: {
    relayerPublicKey: PublicKey;
    blockhash: string;
    lastValidBlockHeight: number;
  }) => Promise<Transaction> | Transaction;
}): Promise<string> {
  const { wallet, connection: _connection, buildInstructions } = params;

  if (!wallet.publicKey || !wallet.signTransaction) {
    throw new Error("Wallet not connected");
  }

  // 1. Get relayer info (pubkey + blockhash)
  const info = await getRelayerInfo();
  const relayerPublicKey = new PublicKey(info.relayerPublicKey);

  // 2. Build the transaction — caller adds their instructions
  const transaction = await buildInstructions({
    relayerPublicKey,
    blockhash: info.blockhash,
    lastValidBlockHeight: info.lastValidBlockHeight,
  });

  // 3. Set relayer as fee payer so the user pays no gas
  transaction.feePayer = relayerPublicKey;
  transaction.recentBlockhash = info.blockhash;
  transaction.lastValidBlockHeight = info.lastValidBlockHeight;

  // 4. User signs (as authority — NOT fee payer)
  const signedTx = await wallet.signTransaction(transaction);

  // 5. Serialize and send to relayer
  const serialized = signedTx.serialize({
    requireAllSignatures: false, // Relayer co-signs server-side
    verifySignatures: false,
  });

  const res = await fetch("/api/relay/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transaction: serialized.toString("base64") }),
  });

  const data = (await res.json()) as { signature?: string; error?: string };

  if (!res.ok || !data.signature) {
    throw new Error(data.error ?? "Relay submission failed");
  }

  return data.signature;
}
