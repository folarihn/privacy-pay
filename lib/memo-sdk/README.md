# Cipher Pay Memo SDK

## Overview
Cipher Pay Memo SDK provides end-to-end encrypted memos for Solana flows. It derives a memo keypair from a wallet signature (no key storage required) and encrypts memos client-side using NaCl box (X25519 + XSalsa20 + Poly1305). The chain and servers only ever see ciphertext.

## Installation
This SDK is currently local to the repository.

```ts
import { createPrivatePaymentLink, deriveMemoKeyPair } from "@/lib/memo-sdk";
```

## Quick start

```ts
import { PublicKey } from "@solana/web3.js";
import {
  createPrivatePaymentLink,
  deriveMemoKeyPair,
  decryptMemo,
  fromBase64,
  parsePaymentLink,
} from "@/lib/memo-sdk";

async function example(params: {
  signMessage: (message: Uint8Array) => Promise<Uint8Array>;
  walletPublicKey: PublicKey;
  baseUrl: string;
}) {
  const { signMessage, walletPublicKey, baseUrl } = params;

  const senderKeyPair = await deriveMemoKeyPair(signMessage, walletPublicKey);

  const recipientMemoPublicKeyBase64 = "BASE64_RECIPIENT_MEMO_PUBLIC_KEY";

  const link = await createPrivatePaymentLink({
    recipient: "RECIPIENT_SOLANA_ADDRESS_BASE58",
    amount: 1_000_000,
    token: "SOL",
    memoText: "Invoice #1042 — Design work",
    recipientMemoPublicKey: recipientMemoPublicKeyBase64,
    senderKeyPair,
    label: "Cipher Pay demo",
    expiresInHours: 24,
    baseUrl,
  });

  const parsed = parsePaymentLink(link);
  if (!parsed || !parsed.memo) return;

  const recipientSecretKey = fromBase64("BASE64_RECIPIENT_MEMO_SECRET_KEY");
  const plaintext = decryptMemo(parsed.memo, recipientSecretKey);
  return plaintext;
}
```

## API Reference

### Types
- `MemoKeyPair` — Derived memo keypair (never stored, always re-derived).
- `EncryptedMemo` — Encrypted memo payload (base64 fields, versioned).
- `PaymentLinkPayload` — JSON payload encoded into the payment link hash.
- `PaymentReceipt` — Normalized receipt shape for higher-level apps.

### Keys
- `deriveMemoKeyPair(signMessage, walletPublicKey): Promise<MemoKeyPair>` — Deterministically derives a memo keypair from a signed derivation message.
- `getMemoPublicKey(signMessage, walletPublicKey): Promise<string>` — Returns the derived memo public key as base64.

### Encryption
- `encryptMemo(plaintext, recipientPublicKey, senderSecretKey): EncryptedMemo` — Encrypts a memo using NaCl box.
- `decryptMemo(encrypted, recipientSecretKey): string | null` — Decrypts a memo (returns null on failure).
- `toBase64(bytes): string` — Base64 encodes bytes.
- `fromBase64(b64): Uint8Array` — Base64 decodes to bytes.
- `encryptedMemoToLegacyBlob(encrypted): string` — Serializes to Cipher Pay’s legacy JSON memo blob (`cipher`/`nonce`/`ephemPub`) for backwards compatibility.
- `encryptedMemoFromLegacyBlob(blob): EncryptedMemo | null` — Parses the legacy JSON memo blob into `EncryptedMemo`.

### Payment Links
- `generatePaymentLink(payload, baseUrl): string` — Encodes a payload as base64url JSON in the URL hash fragment.
- `parsePaymentLink(url): PaymentLinkPayload | null` — Decodes and validates a payment link (returns null if invalid/expired).
- `createPrivatePaymentLink(params): Promise<string>` — Creates an encrypted-memo payment link in one call.

### Transactions
- `attachMemoToTransaction(transaction, encryptedMemo, signerPublicKey): Transaction` — Adds a Memo Program instruction containing the encrypted memo JSON.
- `extractMemoFromTransaction(connection, signature, recipientSecretKey): Promise<string | null>` — Fetches a transaction, finds a memo instruction, and decrypts it.

## Security notes
- Keys are derived deterministically from wallet signatures. No private memo keys are ever sent to servers.
- Encryption uses NaCl box (X25519-XSalsa20-Poly1305).
- Memos are encrypted client-side before leaving the browser.
- The server/chain never sees plaintext memos.
- Losing wallet access means losing the ability to re-derive keys and decrypt past memos.
