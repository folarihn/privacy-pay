import nacl from "tweetnacl";
import type { PublicKey } from "@solana/web3.js";
import type { MemoKeyPair } from "./types";
import { toBase64 } from "./encrypt";

export async function deriveMemoKeyPair(
  signMessage: (message: Uint8Array) => Promise<Uint8Array>,
  walletPublicKey: PublicKey,
): Promise<MemoKeyPair> {
  const message = new TextEncoder().encode(
    `cipher-pay:derive-memo-key:${walletPublicKey.toBase58()}`,
  );
  const signature = await signMessage(message);
  const seed = nacl.hash(signature).slice(0, nacl.box.secretKeyLength);
  const keypair = nacl.box.keyPair.fromSecretKey(seed);
  return { publicKey: keypair.publicKey, secretKey: keypair.secretKey };
}

export async function getMemoPublicKey(
  signMessage: (message: Uint8Array) => Promise<Uint8Array>,
  walletPublicKey: PublicKey,
): Promise<string> {
  const keypair = await deriveMemoKeyPair(signMessage, walletPublicKey);
  return toBase64(keypair.publicKey);
}
