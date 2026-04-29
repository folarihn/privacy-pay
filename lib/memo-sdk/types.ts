import { PublicKey } from "@solana/web3.js";

export interface MemoKeyPair {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
}

export interface EncryptedMemo {
  ciphertext: string;
  nonce: string;
  senderPublicKey: string;
  version: "1";
}

export interface PaymentLinkPayload {
  recipient: string;
  amount: number;
  token: "SOL" | "USDC";
  memo: EncryptedMemo | null;
  expiresAt: number | null;
  label: string | null;
}

export interface PaymentReceipt {
  id: string;
  sender: string;
  recipient: string;
  amount: number;
  token: "SOL" | "USDC";
  decryptedMemo: string | null;
  timestamp: number;
  verified: boolean;
}

export const MEMO_PROGRAM_ID = new PublicKey(
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
);

export const MEMO_V1_PROGRAM_ID = new PublicKey(
  "Memo1UhkJRfHyvLMcVucJwxXeuD728EqVDDwQDxFMNo",
);

export const NOOP_PROGRAM_ID = new PublicKey(
  "noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV",
);
