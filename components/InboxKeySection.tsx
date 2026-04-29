"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  getInboxPublicKeyBase58,
  exportInboxKeys,
  importInboxKeys,
  restoreKeysFromSignature,
} from "@/lib/crypto/keys";

export function InboxKeySection() {
  const wallet = useWallet();
  const [publicKey, setPublicKey] = useState<string>("");
  const [exported, setExported] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [advancedOpen, setAdvancedOpen] = useState(false);

  useEffect(() => {
    try {
      const key = getInboxPublicKeyBase58();
      // Defer state update to avoid synchronous render warning
      setTimeout(() => setPublicKey(key), 0);
    } catch {
      // ignore
    }
  }, []);

  const handleCopyPublicKey = async () => {
    if (!publicKey) {
      return;
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(publicKey);
        setStatus("Public key copied to clipboard.");
      } else {
        setStatus("Clipboard is not available in this browser.");
      }
    } catch {
      setStatus("Failed to copy public key.");
    }
  };

  const handleExport = () => {
    try {
      const payload = exportInboxKeys();
      setExported(payload);
      setStatus("Inbox keys exported locally. Do not share the secret key.");
      setError("");
    } catch (e) {
      if (e instanceof Error) {
        setError(e.message);
      } else {
        setError("Failed to export inbox keys.");
      }
    }
  };

  const handleImport = () => {
    if (!exported.trim()) {
      setError("Nothing to import. Paste exported JSON first.");
      return;
    }

    try {
      importInboxKeys(exported);
      const key = getInboxPublicKeyBase58();
      setPublicKey(key);
      setStatus("Inbox keys imported successfully.");
      setError("");
    } catch (e) {
      if (e instanceof Error) {
        setError(e.message);
      } else {
        setError("Failed to import inbox keys.");
      }
    }
  };

  const handleRestoreFromWallet = async () => {
    setStatus("");
    setError("");

    if (!wallet.connected || !wallet.signMessage) {
      setError("Connect a wallet that supports message signing.");
      return;
    }

    try {
      const message = new TextEncoder().encode(
        "Sign this message to restore your Cipher Pay inbox keys.\n\nThis will overwrite any existing keys in this browser."
      );
      const signature = await wallet.signMessage(message);
      
      await restoreKeysFromSignature(signature);
      
      const key = getInboxPublicKeyBase58();
      setPublicKey(key);
      setStatus("Keys restored from wallet signature!");
    } catch (e) {
      if (e instanceof Error) {
        setError(e.message);
      } else {
        setError("Failed to restore keys from wallet.");
      }
    }
  };

  return (
    <>
      <section className="cipher-card">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <div className="text-[15px] font-medium text-[color:var(--color-text-primary)]">
              Inbox encryption keys
            </div>
            <div className="mt-0.5 text-[13px] text-[color:var(--color-text-secondary)]">
              Manage your keys to decrypt private memos
            </div>
          </div>
          <span className="cipher-badge-active">ACTIVE</span>
        </div>

        <button
          type="button"
          onClick={handleRestoreFromWallet}
          className="cipher-btn-primary w-full py-3 text-[14px]"
        >
          Restore keys from wallet signature
        </button>

        <div className="mt-2.5 text-center text-[12px] text-[color:var(--color-text-muted)]">
          Recommended: uses your wallet signature to generate consistent keys across all devices.
        </div>

        <div className="mt-5 border-t border-[color:var(--color-border-subtle)]" />

        <button
          type="button"
          onClick={() => setAdvancedOpen((v) => !v)}
          className="flex w-full cursor-pointer items-center justify-between py-3.5"
          aria-expanded={advancedOpen}
        >
          <span className="text-[14px] text-[color:var(--color-text-secondary)]">
            Advanced options
          </span>
          <span
            className={`text-[color:var(--color-text-muted)] transition-transform duration-200 ${
              advancedOpen ? "rotate-180" : ""
            }`}
          >
            <ChevronDown />
          </span>
        </button>

        {advancedOpen && (
          <div className="pt-2">
            <div className="cipher-label mb-2">PUBLIC ENCRYPTION KEY</div>
            <div className="flex items-center justify-between gap-3">
              <code className="cipher-mono truncate" title={publicKey}>
                {publicKey || "No inbox encryption key available..."}
              </code>
              <button
                type="button"
                onClick={handleCopyPublicKey}
                className="cipher-btn-ghost h-[34px] px-4 py-0 text-[13px]"
              >
                Copy
              </button>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                onClick={handleExport}
                className="cipher-btn-ghost h-[34px] px-4 py-0 text-[13px]"
              >
                Export Backup
              </button>
              <button
                type="button"
                onClick={handleImport}
                className="cipher-btn-ghost h-[34px] px-4 py-0 text-[13px]"
              >
                Import Backup
              </button>
            </div>

            <textarea
              className="cipher-input mt-3 h-28 resize-y text-[12px]"
              placeholder="Paste exported inbox keys JSON here..."
              value={exported}
              onChange={(e) => setExported(e.target.value)}
            />
          </div>
        )}

        {status && (
          <div className="mt-4 rounded-[8px] border border-[color:var(--color-emerald-dim)] bg-[color:var(--color-emerald-dim)]/30 p-3">
            <p className="text-[13px] text-[color:var(--color-emerald)]">{status}</p>
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-[8px] border border-red-900/40 bg-red-950/30 p-3">
            <p className="text-[13px] text-red-200">{error}</p>
          </div>
        )}
      </section>

      <div className="mt-4 flex items-start gap-[10px] rounded-[var(--radius-md)] border border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface)] px-4 py-3">
        <div className="shrink-0 text-[color:var(--color-text-muted)]">
          <LockLarge />
        </div>
        <div className="text-[13px] leading-[1.6] text-[color:var(--color-text-muted)]">
          Your keys are derived from your wallet signature and never stored on disk. Losing access to your wallet means losing access to past memos.
        </div>
      </div>
    </>
  );
}

function ChevronDown() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 9l6 6 6-6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LockLarge() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
        strokeLinejoin="round"
      />
    </svg>
  );
}
