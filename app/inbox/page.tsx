"use client";

import Link from "next/link";
import { useEffect, useState, Suspense } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useSearchParams } from "next/navigation";
import { useDemoMode } from "@/hooks/useDemoMode";
import { DEFAULT_SOLANA_CLUSTER, getExplorerTxUrl } from "@/lib/constants";
import { 
  getOrCreateInboxKeypair, 
  deriveKeysFromSignature, 
  setMemoryKeypair, 
  getMemoryKeypair 
} from "@/lib/crypto/keys";
import { decryptMemo } from "@/lib/crypto/encrypt";
import { verifyTransaction } from "@/lib/solana/verify";

type ReceiptRecord = {
  ref: string;
  signature: string;
  from: string;
  to: string;
  amountLamports: number;
  encryptedMemo: string;
  createdAt: number;
  type?: 'public' | 'private';
};

type InboxItem = {
  receipt: ReceiptRecord;
  decryptedMemo: string;
  decryptError: string;
};

type SentItem = ReceiptRecord & {
    memoText?: string;
};

const INBOX_STORAGE_KEY = "pp_inbox_receipts";
const SENT_STORAGE_KEY = "pp_sent_receipts";

function shorten(value: string) {
  if (!value) return "n/a";
  if (value.length <= 10) return value;
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function loadStoredReceipts(owner?: string): ReceiptRecord[] {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
    return [];
  }
  if (!owner) return [];

  try {
    const key = `${INBOX_STORAGE_KEY}_${owner}`;
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as ReceiptRecord[];
  } catch {
    return [];
  }
}

function loadSentReceipts(owner?: string): SentItem[] {
    if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
      return [];
    }
    if (!owner) return [];

    try {
      const key = `${SENT_STORAGE_KEY}_${owner}`;
      const raw = window.localStorage.getItem(key);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed as SentItem[];
    } catch {
      return [];
    }
  }

function saveStoredReceipts(receipts: ReceiptRecord[], owner?: string) {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined" || !owner) {
    return;
  }
  const key = `${INBOX_STORAGE_KEY}_${owner}`;
  window.localStorage.setItem(key, JSON.stringify(receipts));
}

function InboxContentWithDemo() {
  const { isDemoMode } = useDemoMode();
  if (isDemoMode) return <InboxDemo />;
  return <InboxContentReal />;
}

function truncateSig(sig: string) {
  if (!sig) return "—";
  return sig.length <= 12 ? sig : `${sig.slice(0, 8)}...`;
}

function InboxDemo() {
  const { demoState, activeDemoWallet } = useDemoMode();
  const [activeTab, setActiveTab] = useState<"received" | "sent">("received");

  const demoTxs = demoState?.demoTransactions ?? [];
  const receipts = demoTxs.filter((t) => t.to === activeDemoWallet);

  return (
    <main className="min-h-screen bg-[color:var(--color-bg)] px-6 pt-14 pb-12 text-[color:var(--color-text-secondary)]">
      <div className="mx-auto w-full max-w-4xl">
        <div className="pt-10 mb-7">
          <h1 className="text-[24px] font-semibold text-[color:var(--color-text-primary)]">
            Inbox
          </h1>
          <p className="mt-1 text-[14px] text-[color:var(--color-text-secondary)]">
            Verify receipts and decrypt end-to-end encrypted memos.
          </p>
        </div>

        <div
          className="mb-6 inline-flex rounded-[10px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-[3px]"
          role="tablist"
        >
          <button
            onClick={() => setActiveTab("received")}
            className={`cursor-pointer rounded-[8px] px-[18px] py-[8px] text-[14px] font-medium transition-all duration-150 ${
              activeTab === "received"
                ? "bg-[color:var(--color-accent)] text-white"
                : "text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)]"
            }`}
            role="tab"
            aria-selected={activeTab === "received"}
            type="button"
          >
            Received
          </button>
          <button
            onClick={() => setActiveTab("sent")}
            className={`cursor-pointer rounded-[8px] px-[18px] py-[8px] text-[14px] font-medium transition-all duration-150 ${
              activeTab === "sent"
                ? "bg-[color:var(--color-accent)] text-white"
                : "text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)]"
            }`}
            role="tab"
            aria-selected={activeTab === "sent"}
            type="button"
          >
            Sent
          </button>
        </div>

        {activeTab === "received" && (
          <div className="mt-6">
            <div className="cipher-label mb-3">YOUR RECEIPTS</div>

            {receipts.length === 0 ? (
              <div className="cipher-card text-center px-6 py-12">
                <div className="mx-auto w-fit text-[color:var(--color-border)]">
                  <InboxMark />
                </div>
                <p className="mt-3 text-[14px] text-[color:var(--color-text-muted)]">
                  No demo receipts for this wallet
                </p>
                <p className="mt-1 text-[12px] text-[color:var(--color-text-muted)]">
                  Switch persona in the demo banner to view different receipts
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {receipts.map((t) => (
                  <div key={t.id} className="cipher-card">
                    <div className="flex items-center justify-between gap-4">
                      <div className="text-[14px] font-medium text-[color:var(--color-text-primary)]">
                        From: {t.from.charAt(0).toUpperCase() + t.from.slice(1)}
                      </div>
                      <span className="cipher-badge-shielded">Received</span>
                    </div>

                    <div className="mt-2 font-mono text-[22px] font-medium text-[color:var(--color-text-primary)] tabular-nums">
                      +{t.amount.toFixed(2)} {t.token}
                    </div>

                    <div className="mt-3">
                      <div className="flex items-center gap-2 text-[13px] italic text-[color:var(--color-text-secondary)]">
                        <span className="text-[color:var(--color-emerald)]">
                          <LockTiny />
                        </span>
                        <span className="min-w-0 flex-1 truncate">{t.memo}</span>
                      </div>
                      <div className="mt-1 text-[11px] text-[color:var(--color-text-muted)]">
                        End-to-end encrypted · visible only to you
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-3 border-t border-[color:var(--color-border-subtle)] pt-3">
                      <div className="text-[12px] text-[color:var(--color-text-muted)]">
                        {new Date(t.timestamp).toLocaleString()}
                      </div>
                      <div className="font-mono text-[11px] text-[color:var(--color-text-muted)]">
                        {truncateSig(t.signature)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "sent" && (
          <div className="mt-6">
            <div className="cipher-label mb-3">YOUR RECEIPTS</div>
            <div className="cipher-card text-center px-6 py-12">
              <div className="mx-auto w-fit text-[color:var(--color-border)]">
                <InboxMark />
              </div>
              <p className="mt-3 text-[14px] text-[color:var(--color-text-muted)]">
                Demo inbox shows received payments only
              </p>
              <p className="mt-1 text-[12px] text-[color:var(--color-text-muted)]">
                Switch back to Received to view demo receipts
              </p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function LockTiny() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M7.5 11V8.5a4.5 4.5 0 0 1 9 0V11"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M6.75 11h10.5c.966 0 1.75.784 1.75 1.75v6.5c0 .966-.784 1.75-1.75 1.75H6.75A1.75 1.75 0 0 1 5 19.25v-6.5c0-.966.784-1.75 1.75-1.75Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function InboxContentReal() {
  const wallet = useWallet();
  const searchParams = useSearchParams();
  
  const [receiptInput, setReceiptInput] = useState("");
  const [items, setItems] = useState<InboxItem[]>([]);
  const [sentItems, setSentItems] = useState<SentItem[]>([]);
  const [activeTab, setActiveTab] = useState<'received' | 'sent'>('received');
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);

  // Check if keys are already in memory
  useEffect(() => {
    if (getMemoryKeypair()) {
      setIsUnlocked(true);
    }
  }, [wallet.publicKey]); // Re-check if wallet changes

  const handleUnlock = async () => {
    setError("");
    setStatus("");
    try {
      if (!wallet.connected || !wallet.signMessage) {
        throw new Error("Please connect a wallet that supports message signing.");
      }
      
      const message = new TextEncoder().encode("Unlock Privacy Pay Inbox");
      const signature = await wallet.signMessage(message);
      
      const keypair = deriveKeysFromSignature(signature);
      setMemoryKeypair(keypair);
      setIsUnlocked(true);
      setStatus("Inbox unlocked successfully.");
    } catch (e) {
      console.error(e);
      setError("Failed to unlock inbox. You must sign the message.");
    }
  };

  // Load receipt from URL if present (query param OR hash fragment)
  useEffect(() => {
    // Check query param (legacy/standard)
    const urlReceipt = searchParams.get("receipt");
    if (urlReceipt) {
      try {
        const decoded = decodeURIComponent(urlReceipt);
        setReceiptInput(decoded);
        setStatus("Receipt detected from link. Click 'Add Payment to Inbox' below.");
        return;
      } catch {
        setError("Invalid receipt link.");
      }
    }

    // Check hash fragment (privacy-preserving)
    if (typeof window !== "undefined" && window.location.hash) {
      const hash = window.location.hash.substring(1); // remove #
      const params = new URLSearchParams(hash);
      const hashReceipt = params.get("receipt");
      if (hashReceipt) {
         try {
          const decoded = decodeURIComponent(hashReceipt);
          setReceiptInput(decoded);
          setStatus("Receipt detected from secure link. Click 'Add Payment to Inbox' below.");
        } catch {
          setError("Invalid receipt link.");
        }
      }
    }
  }, [searchParams]);

  useEffect(() => {
    const owner = wallet.publicKey?.toBase58();
    const stored = loadStoredReceipts(owner);
    const inboxItems: InboxItem[] = stored.map((r) => ({
      receipt: r,
      decryptedMemo: "",
      decryptError: "",
    }));
    setItems(inboxItems);

    const sent = loadSentReceipts(owner);
    setSentItems(sent);
  }, [wallet.publicKey]);

  const handleAddReceipt = async () => {
    setStatus("");
    setError("");

    if (!receiptInput.trim()) {
      setError("Paste a receipt JSON first.");
      return;
    }

    let jsonString = receiptInput.trim();

    // Check if input is a URL (starts with http) or contains receipt= param
    if (jsonString.startsWith("http") || jsonString.includes("receipt=")) {
        try {
            // Attempt to parse as URL to extract receipt param
            // We use a dummy base if it's just a fragment/path
            const urlToParse = jsonString.startsWith("http") ? jsonString : `http://dummy.com/${jsonString}`;
            const urlObj = new URL(urlToParse);
            
            let extracted = urlObj.searchParams.get("receipt");
            
            if (!extracted && urlObj.hash) {
                // Check hash params (e.g. #receipt=...)
                const hashContent = urlObj.hash.startsWith("#") ? urlObj.hash.substring(1) : urlObj.hash;
                const hashParams = new URLSearchParams(hashContent);
                extracted = hashParams.get("receipt");
            }

            if (extracted) {
                jsonString = decodeURIComponent(extracted);
            } else {
                // If no receipt param found but it looks like a Pay Link
                if (jsonString.includes("/pay#") || jsonString.includes("/pay?")) {
                    throw new Error("This is a Payment Request link, not a Receipt. Please use the 'Receipt Link' generated after the payment is completed.");
                }
            }
        } catch (e) {
            if (e instanceof Error && e.message.includes("Payment Request link")) {
                throw e;
            }
            console.warn("Failed to parse receipt input as URL:", e);
            // Fallback: treat original input as potential JSON
        }
    }

    try {
      const parsed = JSON.parse(jsonString) as Partial<ReceiptRecord>;

      if (!parsed.ref && parsed.signature) {
        parsed.ref = parsed.signature;
      }

      if (!parsed.ref || typeof parsed.ref !== "string") {
        throw new Error("Receipt is missing ref.");
      }
      if (!parsed.signature || typeof parsed.signature !== "string") {
        throw new Error("Receipt is missing signature.");
      }
      if (!parsed.from || typeof parsed.from !== "string") {
        throw new Error("Receipt is missing from address.");
      }
      if (!parsed.to || typeof parsed.to !== "string") {
        throw new Error("Receipt is missing to address.");
      }
      if (typeof parsed.amountLamports !== "number" || parsed.amountLamports <= 0) {
        throw new Error("Receipt amountLamports must be a number greater than 0.");
      }
      if (
        typeof parsed.encryptedMemo !== "string" ||
        typeof parsed.createdAt !== "number"
      ) {
        throw new Error("Receipt must include encryptedMemo and createdAt.");
      }

      if (wallet.connected && wallet.publicKey && parsed.to !== wallet.publicKey.toBase58()) {
        throw new Error("Receipt is not addressed to your connected wallet.");
      }

      // Verify on-chain before adding!
      setStatus("Verifying transaction on Solana Devnet...");
      
      const verification = await verifyTransaction(
        parsed.signature,
        parsed.from,
        parsed.to,
        parsed.amountLamports,
        parsed.encryptedMemo,
        parsed.type || 'public'
      );

      if (!verification.isValid) {
        throw new Error(verification.error || "Transaction verification failed.");
      }

      const record: ReceiptRecord = {
        ref: parsed.ref,
        signature: parsed.signature,
        from: parsed.from,
        to: parsed.to,
        amountLamports: parsed.amountLamports,
        encryptedMemo: parsed.encryptedMemo,
        createdAt: parsed.createdAt,
        type: parsed.type || 'public'
      };

      setItems((prev) => {
        // Check for duplicates
        if (prev.some(p => p.receipt.signature === record.signature)) {
            return prev;
        }
        const next: InboxItem[] = [
          {
            receipt: record,
            decryptedMemo: "",
            decryptError: "",
          },
          ...prev,
        ];
        const toStore = next.map((item) => item.receipt);
        saveStoredReceipts(toStore, wallet.publicKey?.toBase58());
        return next;
      });

      setReceiptInput("");
      setStatus("Receipt verified and added to inbox.");
    } catch (e) {
      setStatus(""); // Clear verifying status
      if (e instanceof Error) {
        setError(e.message);
      } else {
        setError("Failed to parse or verify receipt.");
      }
    }
  };

  const handleDecrypt = (index: number) => {
    setStatus("");

    setItems((prev) => {
      const next = [...prev];
      const target = next[index];
      if (!target) return prev;

      try {
        const memoryKeypair = getMemoryKeypair();
        const localKeypair = getOrCreateInboxKeypair();
        
        let decrypted = "";
        let error = "";

        // Strategy 1: Try Memory Key (Wallet Identity) if available
        if (memoryKeypair) {
            try {
                decrypted = decryptMemo(target.receipt.encryptedMemo, memoryKeypair.secretKey);
            } catch {
                // If failed, fall through to Strategy 2
                console.warn("Failed to decrypt with Wallet Key, trying Device Key...");
            }
        }

        // Strategy 2: Try Local Key (Device Identity) if not already decrypted
        if (!decrypted && localKeypair) {
             try {
                decrypted = decryptMemo(target.receipt.encryptedMemo, localKeypair.secretKey);
                if (decrypted) {
                    setStatus("Memo decrypted using your local device key.");
                }
            } catch {
                error = "Unable to decrypt memo (wrong key or corrupted data).";
            }
        }

        if (!decrypted && !error) {
             if (!memoryKeypair && !localKeypair) {
                 error = "Inbox is locked and no device key found.";
             } else {
                 error = "Unable to decrypt memo (wrong key).";
             }
        }

        if (decrypted) {
            target.decryptedMemo = decrypted;
            target.decryptError = "";
        } else {
            target.decryptedMemo = "";
            target.decryptError = error;
        }

      } catch (e) {
        if (e instanceof Error) {
          target.decryptedMemo = "";
          target.decryptError = e.message;
        } else {
          target.decryptedMemo = "";
          target.decryptError = "Unable to decrypt memo.";
        }
      }

      return next;
    });
  };

  return (
    <main className="min-h-screen bg-[color:var(--color-bg)] px-6 pt-14 pb-12 text-[color:var(--color-text-secondary)]">
      <div className="mx-auto w-full max-w-4xl">
        <div className="pt-10 mb-7">
          <h1 className="text-[24px] font-semibold text-[color:var(--color-text-primary)]">
            Inbox
          </h1>
          <p className="mt-1 text-[14px] text-[color:var(--color-text-secondary)]">
            Verify receipts and decrypt end-to-end encrypted memos.
          </p>
        </div>

        <div
          className="mb-6 inline-flex rounded-[10px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-[3px]"
          role="tablist"
        >
          <button
            onClick={() => setActiveTab("received")}
            className={`cursor-pointer rounded-[8px] px-[18px] py-[8px] text-[14px] font-medium transition-all duration-150 ${
              activeTab === "received"
                ? "bg-[color:var(--color-accent)] text-white"
                : "text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)]"
            }`}
            role="tab"
            aria-selected={activeTab === "received"}
            type="button"
          >
            Received
          </button>
          <button
            onClick={() => setActiveTab("sent")}
            className={`cursor-pointer rounded-[8px] px-[18px] py-[8px] text-[14px] font-medium transition-all duration-150 ${
              activeTab === "sent"
                ? "bg-[color:var(--color-accent)] text-white"
                : "text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)]"
            }`}
            role="tab"
            aria-selected={activeTab === "sent"}
            type="button"
          >
            Sent
          </button>
        </div>

        {activeTab === "received" && (
          <section className="cipher-card-accent-left mb-4">
            <div className="text-[15px] font-medium text-[color:var(--color-text-primary)]">
              Unlock inbox
            </div>
            <p className="mt-1 text-[13px] leading-[1.6] text-[color:var(--color-text-secondary)]">
              Keys are derived from your wallet signature and never stored on disk.
            </p>
            <div className="mt-4 flex items-center justify-between gap-4">
              {!isUnlocked ? (
                <button
                  onClick={handleUnlock}
                  className="cipher-btn-primary text-[13px]"
                  type="button"
                >
                  Sign to unlock inbox
                </button>
              ) : (
                <span className="cipher-badge-active inline-flex items-center gap-2">
                  <UnlockMark />
                  Unlocked
                </span>
              )}
            </div>
          </section>
        )}

        {activeTab === "received" && (
          <section className="cipher-card mb-4">
            <div className="mb-4 text-[15px] font-medium text-[color:var(--color-text-primary)]">
              Add payment
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <div className="cipher-label">RECEIPT JSON</div>
                <div className="mt-1 text-[12px] text-[color:var(--color-text-muted)]">
                  Paste raw receipt JSON or use a Claim Link to auto-fill
                </div>
              </div>
              <div>
                <div className="cipher-label">DECRYPTION</div>
                <div className="mt-1 text-[12px] text-[color:var(--color-text-muted)]">
                  Only works if you have the matching key in local storage
                </div>
              </div>
            </div>

            <textarea
              className="cipher-input mt-4 min-h-[100px] resize-y text-[12px] font-mono"
              value={receiptInput}
              onChange={(e) => setReceiptInput(e.target.value)}
              placeholder='Paste receipt JSON: {"ref":"...","signature":"...","from":"...","to":"..."}'
            />

            <button
              onClick={handleAddReceipt}
              className="cipher-btn-primary mt-3 w-full text-[13px]"
              type="button"
            >
              Add payment to inbox
            </button>
          </section>
        )}

        {status && (
          <div className="rounded-lg border border-emerald-900/40 bg-emerald-950/30 p-4">
            <p className="text-sm text-emerald-200">{status}</p>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-900/40 bg-red-950/30 p-4">
            <p className="text-sm text-red-200">{error}</p>
          </div>
        )}

        {activeTab === "received" && (
        <div className="mt-6">
          <div className="cipher-label mb-3">YOUR RECEIPTS</div>
          
          {items.length === 0 ? (
            <div className="cipher-card text-center px-6 py-12">
                <div className="mx-auto w-fit text-[color:var(--color-border)]">
                  <InboxMark />
                </div>
                <p className="mt-3 text-[14px] text-[color:var(--color-text-muted)]">
                  No received payments found locally
                </p>
                <p className="mt-1 text-[12px] text-[color:var(--color-text-muted)]">
                  Use the Add Payment form above to import a receipt
                </p>
            </div>
          ) : (
            items.map((item, i) => (
            <div
              key={item.receipt.ref}
              className="rounded-2xl border border-[#27272A] bg-[#111113] p-6"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-[#71717A] bg-[#09090B] px-2 py-1 rounded border border-[#27272A]">
                      {new Date(item.receipt.createdAt).toLocaleString()}
                    </span>
                    {item.receipt.type === 'private' && (
                        <span className="text-[11px] font-mono text-[#10B981] bg-emerald-950/40 px-2 py-1 rounded-full border border-emerald-900/40 inline-flex items-center gap-2">
                            <ShieldMini />
                            ZK
                        </span>
                    )}
                    <a
                      href={getExplorerTxUrl(item.receipt.signature, DEFAULT_SOLANA_CLUSTER)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-[#A1A1AA] hover:text-[#FAFAFA] transition-all duration-150"
                    >
                      View Tx →
                    </a>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-xs text-slate-300">
                    <span className="text-[#71717A]">From:</span>
                    <span className="bg-[#09090B] px-2 py-1 rounded border border-[#27272A] text-[#FAFAFA]" title={item.receipt.from}>{shorten(item.receipt.from)}</span>
                    <Link 
                        href={`/pay?to=${item.receipt.from}&replyTo=${item.receipt.to}`}
                        className="ml-2 text-[11px] font-mono text-[#7C3AED] hover:text-[#6D28D9] bg-[#09090B] px-2 py-1 rounded-full border border-[#27272A] transition-all duration-150"
                    >
                        Reply
                    </Link>
                  </div>
                </div>
                
                <div className="text-left sm:text-right">
                  <div className="text-2xl font-mono font-semibold text-[#FAFAFA] tabular-nums">
                    {(item.receipt.amountLamports / 1_000_000_000).toLocaleString()}{" "}
                    <span className="text-sm text-[#71717A] font-normal">{item.receipt.type === 'private' ? 'ZK-SOL' : 'SOL'}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-[#27272A]">
                {item.decryptedMemo ? (
                  <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/30 p-4">
                    <p className="text-[10px] font-mono uppercase tracking-[0.1em] text-[#10B981] mb-2">
                      Decrypted Memo
                    </p>
                    <p className="text-sm text-[#FAFAFA]">
                      {item.decryptedMemo}
                    </p>
                  </div>
                ) : item.decryptError ? (
                  <div className="rounded-xl border border-red-900/40 bg-red-950/30 p-4 flex justify-between items-center gap-4">
                    <p className="text-xs text-red-200">
                      {item.decryptError}
                    </p>
                    <button 
                        onClick={() => handleDecrypt(i)}
                        className="text-[11px] font-mono text-red-200 underline hover:text-red-100 transition-all duration-150"
                    >
                        Retry
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-[#71717A]">
                      Encrypted Message
                    </div>
                    <button
                      onClick={() => handleDecrypt(i)}
                      className="px-3 py-2 rounded-lg bg-[#09090B] border border-[#27272A] text-xs font-medium text-[#FAFAFA] hover:bg-[#18181B] transition-all duration-150"
                    >
                      Decrypt Message
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
          )}
        </div>
        )}

        {activeTab === 'sent' && (
            <div className="mt-6">
            <div className="cipher-label mb-3">SENT HISTORY</div>
            {sentItems.length === 0 ? (
                 <div className="cipher-card text-center px-6 py-12">
                    <div className="mx-auto w-fit text-[color:var(--color-border)]">
                      <InboxMark />
                    </div>
                    <p className="mt-3 text-[14px] text-[color:var(--color-text-muted)]">No sent transactions saved locally.</p>
                 </div>
            ) : (
                sentItems.map((item) => (
                    <div
                    key={item.ref}
                    className="rounded-2xl border border-[#27272A] bg-[#111113] p-6 transition-all duration-150 hover:border-[#3F3F46]"
                    >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                        <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-[#71717A] bg-[#09090B] px-2 py-1 rounded border border-[#27272A]">
                            {new Date(item.createdAt).toLocaleString()}
                            </span>
                            {item.type === 'private' && (
                                <span className="text-[11px] font-mono text-[#10B981] bg-emerald-950/40 px-2 py-1 rounded-full border border-emerald-900/40 inline-flex items-center gap-2">
                                    <ShieldMini />
                                    ZK
                                </span>
                            )}
                            <a
                            href={getExplorerTxUrl(item.signature, DEFAULT_SOLANA_CLUSTER)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-medium text-[#A1A1AA] hover:text-[#FAFAFA] transition-all duration-150"
                            >
                            View Tx →
                            </a>
                        </div>
                        <div className="flex items-center gap-2 font-mono text-xs text-slate-300">
                            <span className="text-[#71717A]">To:</span>
                            <span className="bg-[#09090B] px-2 py-1 rounded border border-[#27272A] text-[#FAFAFA]" title={item.to}>{shorten(item.to)}</span>
                        </div>
                        </div>
                        
                        <div className="text-left sm:text-right">
                        <div className="text-2xl font-mono font-semibold text-[#FAFAFA] tabular-nums">
                            -{(item.amountLamports / 1_000_000_000).toLocaleString()} <span className="text-sm text-[#71717A] font-normal">{item.type === 'private' ? 'ZK-SOL' : 'SOL'}</span>
                        </div>
                        </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-[#27272A]">
                        {item.memoText ? (
                        <div className="rounded-xl border border-[#27272A] bg-[#09090B] p-4">
                            <p className="text-[10px] font-mono uppercase tracking-[0.1em] text-[#71717A] mb-2">
                            Memo (Raw Content)
                            </p>
                            <p className="text-xs text-[#A1A1AA] font-mono break-all">
                            {item.memoText}
                            </p>
                        </div>
                        ) : (
                        <p className="text-xs text-[#71717A] italic">No memo attached</p>
                        )}
                    </div>
                    </div>
                ))
            )}
            </div>
        )}
      </div>
    </main>
  );
}

function InboxMark() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4.5 7.5 7 4.5h10l2.5 3v12A2.5 2.5 0 0 1 17 22H7A2.5 2.5 0 0 1 4.5 19.5v-12Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M4.5 12h4l1.5 2h4l1.5-2h4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ShieldMini() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3 19 6.5v6.1c0 5.1-3.4 8.7-7 9.9-3.6-1.2-7-4.8-7-9.9V6.5L12 3Z"
        stroke="#10B981"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function UnlockMark() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M9 11V8.5A4.5 4.5 0 0 1 17.5 7"
        stroke="#10B981"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M6.75 11h10.5c.966 0 1.75.784 1.75 1.75v6.5c0 .966-.784 1.75-1.75 1.75H6.75A1.75 1.75 0 0 1 5 19.25v-6.5c0-.966.784-1.75 1.75-1.75Z"
        stroke="#10B981"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function InboxPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#09090B] pt-24 md:pt-28 text-center text-[#A1A1AA]">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-[#27272A] bg-[#111113] px-4 py-2 text-sm">
            Loading inbox
            <span className="inline-flex items-center gap-1">
              <span className="cipher-loading-dot" />
              <span className="cipher-loading-dot" />
              <span className="cipher-loading-dot" />
            </span>
          </div>
        </div>
      }
    >
      <InboxContentWithDemo />
    </Suspense>
  );
}
