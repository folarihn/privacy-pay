import type { MemoKeyPair, PaymentLinkPayload } from "./types";
import { encryptMemo, fromBase64, toBase64 } from "./encrypt";

function base64ToBase64Url(b64: string) {
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBase64(b64url: string) {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  return `${b64}${pad}`;
}

export function generatePaymentLink(payload: PaymentLinkPayload, baseUrl: string): string {
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  const encoded = base64ToBase64Url(toBase64(bytes));
  const normalizedBase = baseUrl.replace(/\/+$/g, "");
  return `${normalizedBase}/pay#${encoded}`;
}

export function generateBlinkUrl(payload: PaymentLinkPayload, baseUrl: string): string {
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  const encoded = base64ToBase64Url(toBase64(bytes));
  const normalizedBase = baseUrl.replace(/\/+$/g, "");
  const actionUrl = `${normalizedBase}/api/actions/pay?payload=${encoded}`;
  return `https://dial.to/?action=solana-action:${encodeURIComponent(actionUrl)}`;
}

export function parsePaymentLink(url: string): PaymentLinkPayload | null {
  try {
    const u = new URL(url);
    const frag = u.hash.startsWith("#") ? u.hash.slice(1) : u.hash;
    if (!frag) return null;

    const jsonBytes = fromBase64(base64UrlToBase64(frag));
    const json = new TextDecoder().decode(jsonBytes);
    const parsed = JSON.parse(json) as unknown;

    if (typeof parsed !== "object" || parsed === null) return null;
    if (
      !("recipient" in parsed) ||
      !("amount" in parsed) ||
      !("token" in parsed) ||
      !("memo" in parsed) ||
      !("expiresAt" in parsed) ||
      !("label" in parsed)
    ) {
      return null;
    }

    const p = parsed as PaymentLinkPayload;
    if (typeof p.recipient !== "string") return null;
    if (typeof p.amount !== "number" || !Number.isFinite(p.amount) || p.amount < 0) return null;
    if (p.token !== "SOL" && p.token !== "USDC") return null;
    if (p.expiresAt !== null && (typeof p.expiresAt !== "number" || !Number.isFinite(p.expiresAt))) {
      return null;
    }
    if (p.label !== null && typeof p.label !== "string") return null;
    if (p.memo !== null) {
      if (
        typeof p.memo !== "object" ||
        !p.memo ||
        p.memo.version !== "1" ||
        typeof p.memo.ciphertext !== "string" ||
        typeof p.memo.nonce !== "string" ||
        typeof p.memo.senderPublicKey !== "string"
      ) {
        return null;
      }
    }

    if (p.expiresAt !== null && Math.floor(Date.now() / 1000) > p.expiresAt) {
      return null;
    }

    return p;
  } catch {
    return null;
  }
}

export async function createPrivatePaymentLink(params: {
  recipient: string;
  amount: number;
  token: "SOL" | "USDC";
  memoText: string;
  recipientMemoPublicKey: string;
  senderKeyPair: MemoKeyPair;
  label?: string;
  expiresInHours?: number;
  baseUrl: string;
}): Promise<string> {
  const {
    recipient,
    amount,
    token,
    memoText,
    recipientMemoPublicKey,
    senderKeyPair,
    label,
    expiresInHours,
    baseUrl,
  } = params;

  const recipientPk = fromBase64(recipientMemoPublicKey);
  const memo = encryptMemo(memoText, recipientPk, senderKeyPair.secretKey);
  const expiresAt =
    typeof expiresInHours === "number" && Number.isFinite(expiresInHours) && expiresInHours > 0
      ? Math.floor(Date.now() / 1000) + Math.floor(expiresInHours * 3600)
      : null;

  const payload: PaymentLinkPayload = {
    recipient,
    amount,
    token,
    memo,
    expiresAt,
    label: label ?? null,
  };

  return generatePaymentLink(payload, baseUrl);
}
