"use client";

import { useMemo, useState } from "react";
import { useWallet, type WalletContextState } from "@solana/wallet-adapter-react";
import type { Connection, PublicKey } from "@solana/web3.js";
import { PublicKey as PublicKeyCtor } from "@solana/web3.js";
import type { Rpc } from "@lightprotocol/stateless.js";
import bs58 from "bs58";
import { SUPPORTED_TOKENS, type TokenSymbol } from "@/lib/constants";
import type {
  BatchRecipient,
  BatchSendPhase,
  BatchSession,
} from "@/lib/batch/types";
import { transferCompressedToken } from "@/lib/token-service";
import { getContacts } from "@/lib/contacts";
import { getMemoryKeypair, getOrCreateInboxKeypair } from "@/lib/crypto/keys";
import { encryptMemo, encryptedMemoToLegacyBlob } from "@/lib/memo-sdk";

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function newRecipient(overrides?: Partial<BatchRecipient>): BatchRecipient {
  return {
    id: crypto.randomUUID(),
    address: "",
    amount: "",
    memo: "",
    status: "idle",
    error: null,
    signature: null,
    complianceResult: null,
    ...overrides,
  };
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === "," && !inQuotes) {
      out.push(cur.trim());
      cur = "";
      continue;
    }

    cur += ch;
  }

  out.push(cur.trim());
  return out;
}

function isLikelySolanaAddress(addr: string) {
  const a = addr.trim();
  if (a.length < 32) return false;
  try {
    new PublicKeyCtor(a);
    return true;
  } catch {
    return false;
  }
}

export function useBatchSend() {
  const { publicKey, connected } = useWallet();

  const [session, setSession] = useState<BatchSession>(() => ({
    id: crypto.randomUUID(),
    token: "USDC",
    recipients: [],
    createdAt: Date.now(),
    label: "",
  }));
  const [phase, setPhase] = useState<BatchSendPhase>("compose");
  const [isSending, setIsSending] = useState(false);

  function addRecipient(): void {
    setSession((prev) => ({
      ...prev,
      recipients: [...prev.recipients, newRecipient()],
    }));
  }

  function updateRecipient(id: string, updates: Partial<BatchRecipient>): void {
    setSession((prev) => ({
      ...prev,
      recipients: prev.recipients.map((r) => (r.id === id ? { ...r, ...updates } : r)),
    }));
  }

  function removeRecipient(id: string): void {
    setSession((prev) => ({
      ...prev,
      recipients: prev.recipients.filter((r) => r.id !== id),
    }));
  }

  function setToken(token: TokenSymbol): void {
    setSession((prev) => ({ ...prev, token }));
  }

  function setLabel(label: string): void {
    setSession((prev) => ({ ...prev, label }));
  }

  function importCSV(csvText: string): void {
    const lines = csvText.trim().split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (!lines.length) return;

    const first = lines[0].trim().toLowerCase();
    const dataLines = first.startsWith("address") ? lines.slice(1) : lines;

    const newRecipients = dataLines
      .map((line) => {
        const [addressRaw, amountRaw, ...memoParts] = parseCsvLine(line);
        const address = (addressRaw ?? "").trim().replace(/^"|"$/g, "");
        const amount = (amountRaw ?? "").trim().replace(/^"|"$/g, "");
        const memo = memoParts.join(",").trim().replace(/^"|"$/g, "");
        if (!address || !amount) return null;
        return newRecipient({ address, amount, memo });
      })
      .filter((r): r is BatchRecipient => r !== null);

    if (!newRecipients.length) return;

    setSession((prev) => ({ ...prev, recipients: [...prev.recipients, ...newRecipients] }));
  }

  async function checkAllCompliance(): Promise<void> {
    const candidates = session.recipients.filter((r) => isLikelySolanaAddress(r.address));

    for (const r of candidates) {
      updateRecipient(r.id, { status: "checking" });
    }

    const chunkSize = 5;
    for (let i = 0; i < candidates.length; i += chunkSize) {
      const chunk = candidates.slice(i, i + chunkSize);
      await Promise.all(
        chunk.map(async (r) => {
          try {
            const res = await fetch(`/api/compliance/check?address=${encodeURIComponent(r.address)}`);
            const result = (await res.json()) as unknown;
            if (typeof result !== "object" || result === null || !("isFlagged" in result)) {
              updateRecipient(r.id, { status: "ready", error: null });
              return;
            }
            const isFlagged = Boolean((result as { isFlagged?: unknown }).isFlagged);
            updateRecipient(r.id, {
              status: isFlagged ? "flagged" : "ready",
              complianceResult: result as BatchRecipient["complianceResult"],
              error: isFlagged ? "Address flagged by compliance screening" : null,
            });
          } catch {
            updateRecipient(r.id, { status: "ready", error: null });
          }
        }),
      );

      if (i + chunkSize < candidates.length) {
        await sleep(200);
      }
    }
  }

  function getRecipientMemoPublicKeyBytes(address: string): Uint8Array | null {
    const contacts = getContacts();
    const hit = contacts.find((c) => c.address === address);
    if (!hit?.inboxPk) return null;

    try {
      return bs58.decode(hit.inboxPk);
    } catch {
      return null;
    }
  }

  function encryptRecipientMemo(plaintext: string, recipientAddress: string): string | null {
    const text = plaintext.trim();
    if (!text) return null;

    const senderKeypair = getMemoryKeypair() || getOrCreateInboxKeypair();
    const recipientMemoPk = getRecipientMemoPublicKeyBytes(recipientAddress) ?? senderKeypair.publicKey;
    const encrypted = encryptMemo(text, recipientMemoPk, senderKeypair.secretKey);
    return encryptedMemoToLegacyBlob(encrypted);
  }

  async function sendAll(rpc: Rpc, connection: Connection, wallet: WalletContextState): Promise<void> {
    if (!publicKey || !connected) {
      throw new Error("Wallet not connected");
    }

    const readyRecipients = session.recipients.filter((r) => r.status === "ready");
    if (readyRecipients.length === 0) {
      throw new Error("No recipients ready to send");
    }

    setIsSending(true);
    setPhase("sending");

    const tokenInfo = SUPPORTED_TOKENS.find((t) => t.symbol === session.token);
    if (!tokenInfo) {
      setIsSending(false);
      throw new Error("Unsupported token");
    }

    for (const recipient of readyRecipients) {
      updateRecipient(recipient.id, { status: "sending" });
      try {
        const amount = Number(recipient.amount);
        if (!Number.isFinite(amount) || amount <= 0) {
          throw new Error("Invalid amount");
        }

        const to = new PublicKeyCtor(recipient.address) as PublicKey;
        const encryptedMemo = encryptRecipientMemo(recipient.memo, recipient.address);

        const sig = await transferCompressedToken({
          rpc,
          connection,
          wallet,
          mint: tokenInfo.mint,
          amount,
          decimals: tokenInfo.decimals,
          recipient: to,
          encryptedMemo,
        });

        updateRecipient(recipient.id, {
          status: "sent",
          signature: sig,
          error: null,
        });

        await sleep(800);
      } catch (e: unknown) {
        const message =
          e instanceof Error ? e.message : typeof e === "string" ? e : JSON.stringify(e);
        updateRecipient(recipient.id, { status: "failed", error: message });
        await sleep(400);
      }
    }

    setIsSending(false);
    setPhase("complete");
  }

  const totalAmount = useMemo(() => {
    return session.recipients.reduce((sum, r) => {
      const n = Number(r.amount);
      return sum + (Number.isFinite(n) ? n : 0);
    }, 0);
  }, [session.recipients]);

  const readyCount = useMemo(
    () => session.recipients.filter((r) => r.status === "ready").length,
    [session.recipients],
  );

  const flaggedCount = useMemo(
    () => session.recipients.filter((r) => r.status === "flagged").length,
    [session.recipients],
  );

  const sentCount = useMemo(
    () => session.recipients.filter((r) => r.status === "sent").length,
    [session.recipients],
  );

  const failedCount = useMemo(
    () => session.recipients.filter((r) => r.status === "failed").length,
    [session.recipients],
  );

  const checkingCount = useMemo(
    () => session.recipients.filter((r) => r.status === "checking").length,
    [session.recipients],
  );

  function reset(): void {
    setSession({
      id: crypto.randomUUID(),
      token: "USDC",
      recipients: [],
      createdAt: Date.now(),
      label: "",
    });
    setPhase("compose");
    setIsSending(false);
  }

  return {
    session,
    phase,
    setPhase,
    isSending,
    addRecipient,
    updateRecipient,
    removeRecipient,
    setToken,
    setLabel,
    importCSV,
    checkAllCompliance,
    sendAll,
    totalAmount,
    readyCount,
    flaggedCount,
    sentCount,
    failedCount,
    checkingCount,
    reset,
  };
}
