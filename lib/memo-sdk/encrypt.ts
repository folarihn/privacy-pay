import nacl from "tweetnacl";
import { Buffer } from "buffer";
import type { EncryptedMemo } from "./types";

function getBtoa(): ((data: string) => string) | null {
  if (typeof globalThis.btoa === "function") return globalThis.btoa.bind(globalThis);
  return null;
}

function getAtob(): ((data: string) => string) | null {
  if (typeof globalThis.atob === "function") return globalThis.atob.bind(globalThis);
  return null;
}

export function toBase64(bytes: Uint8Array): string {
  const btoaFn = getBtoa();
  if (btoaFn) {
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoaFn(binary);
  }

  return Buffer.from(bytes).toString("base64");
}

export function fromBase64(b64: string): Uint8Array {
  const atobFn = getAtob();
  if (atobFn) {
    const binary = atobFn(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  return new Uint8Array(Buffer.from(b64, "base64"));
}

export function encryptMemo(
  plaintext: string,
  recipientPublicKey: Uint8Array,
  senderSecretKey: Uint8Array,
): EncryptedMemo {
  const message = new TextEncoder().encode(plaintext);
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const senderPublicKey = nacl.box.keyPair.fromSecretKey(senderSecretKey).publicKey;
  const cipher = nacl.box(message, nonce, recipientPublicKey, senderSecretKey);

  return {
    ciphertext: toBase64(cipher),
    nonce: toBase64(nonce),
    senderPublicKey: toBase64(senderPublicKey),
    version: "1",
  };
}

export function decryptMemo(encrypted: EncryptedMemo, recipientSecretKey: Uint8Array): string | null {
  try {
    if (encrypted.version !== "1") return null;
    const cipher = fromBase64(encrypted.ciphertext);
    const nonce = fromBase64(encrypted.nonce);
    const senderPublicKey = fromBase64(encrypted.senderPublicKey);

    const plain = nacl.box.open(cipher, nonce, senderPublicKey, recipientSecretKey);
    if (!plain) return null;
    return new TextDecoder().decode(plain);
  } catch {
    return null;
  }
}

export function encryptedMemoToLegacyBlob(encrypted: EncryptedMemo): string {
  return JSON.stringify({
    cipher: encrypted.ciphertext,
    nonce: encrypted.nonce,
    ephemPub: encrypted.senderPublicKey,
    version: encrypted.version,
  });
}

export function encryptedMemoFromLegacyBlob(blob: string): EncryptedMemo | null {
  if (!blob) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(blob);
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) return null;
  if (!("cipher" in parsed) || !("nonce" in parsed) || !("ephemPub" in parsed)) return null;

  const p = parsed as { cipher: unknown; nonce: unknown; ephemPub: unknown; version?: unknown };
  if (typeof p.cipher !== "string" || typeof p.nonce !== "string" || typeof p.ephemPub !== "string") {
    return null;
  }

  return {
    ciphertext: p.cipher,
    nonce: p.nonce,
    senderPublicKey: p.ephemPub,
    version: "1",
  };
}
