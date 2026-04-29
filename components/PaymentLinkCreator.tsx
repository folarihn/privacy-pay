"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { getOrCreateInboxKeypair, getMemoryKeypair, deriveKeysFromSignature, setMemoryKeypair } from "@/lib/crypto/keys";
import { createPrivatePaymentLink, generateBlinkUrl, generatePaymentLink, parsePaymentLink, toBase64, type PaymentLinkPayload } from "@/lib/memo-sdk";

export function PaymentLinkCreator() {
  const { publicKey, signMessage } = useWallet();
  const [toAddress, setToAddress] = useState("");
  const [amountLamports, setAmountLamports] = useState("");
  const [memoText, setMemoText] = useState("");
  const [link, setLink] = useState("");
  const [blinkUrl, setBlinkUrl] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [usingTempKey, setUsingTempKey] = useState(false);

  // Check which key is active
  useEffect(() => {
    // If no memory keypair, we are using the temp device key
    setUsingTempKey(!getMemoryKeypair());
  }, [status, link]); // Re-check when status changes (e.g. after generating)

  const handleUnlock = async () => {
    try {
        if (!signMessage) throw new Error("Wallet does not support signing");
        const message = new TextEncoder().encode("Unlock Privacy Pay Inbox");
        const signature = await signMessage(message);
        const keypair = deriveKeysFromSignature(signature);
        setMemoryKeypair(keypair);
        setUsingTempKey(false);
        setStatus("Switched to Wallet Identity Key.");
    } catch (e) {
        console.error(e);
        setError("Failed to unlock wallet identity.");
    }
  };

  // Auto-fill receiver address from connected wallet
  useEffect(() => {
    if (publicKey) {
      setToAddress(publicKey.toBase58());
    }
  }, [publicKey]);

  const handleGenerateLink = async () => {
    setStatus("");
    setError("");
    setBlinkUrl("");

    if (!toAddress.trim()) {
      setError("Receiver address is required.");
      return;
    }

    try {
      // Prefer the "Unlocked" Identity Key (Derived) if available.
      // Otherwise fallback to the Device Key (Local/Random).
      // Note: If using Device Key, the user must decrypt on this same device without Unlocking first.
      const receiverKeypair = getMemoryKeypair() || getOrCreateInboxKeypair();

      if (typeof window === "undefined") {
        throw new Error("Cannot generate link outside the browser.");
      }

      const baseUrl = window.location.origin;
      const amount = amountLamports.trim() ? Number(amountLamports.trim()) : 0;
      if (!Number.isFinite(amount) || amount < 0) {
        throw new Error("Amount (Lamports) must be a valid number.");
      }

      const recipient = toAddress.trim();
      let fullLink = "";

      if (memoText.trim()) {
        fullLink = await createPrivatePaymentLink({
          recipient,
          amount,
          token: "SOL",
          memoText: memoText.trim(),
          recipientMemoPublicKey: toBase64(receiverKeypair.publicKey),
          senderKeyPair: receiverKeypair,
          baseUrl,
        });
      } else {
        const payload: PaymentLinkPayload = {
          recipient,
          amount,
          token: "SOL",
          memo: null,
          expiresAt: null,
          label: null,
        };
        fullLink = generatePaymentLink(payload, baseUrl);
      }

      setLink(fullLink);
      const parsed = parsePaymentLink(fullLink);
      if (parsed) {
        setBlinkUrl(generateBlinkUrl(parsed, baseUrl));
      }
      setStatus("Payment link generated.");
    } catch (e) {
      if (e instanceof Error) {
        setError(e.message);
      } else {
        setError("Failed to generate payment link.");
      }
    }
  };

  const handleCopyLink = async () => {
    if (!link) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(link);
        setStatus("Payment link copied to clipboard.");
      } else {
        setStatus("Clipboard is not available in this browser.");
      }
    } catch {
      setStatus("Failed to copy payment link.");
    }
  };

  const handleCopyBlink = async () => {
    if (!blinkUrl) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(blinkUrl);
        setStatus("Blink URL copied to clipboard.");
      } else {
        setStatus("Clipboard is not available in this browser.");
      }
    } catch {
      setStatus("Failed to copy Blink URL.");
    }
  };

  return (
    <section className="cipher-card w-full">
      <div className="relative z-10">
        <div className="mb-6">
          <div>
            <h2 className="text-[16px] font-medium text-[color:var(--color-text-primary)]">
              Create payment link
            </h2>
            <p className="mt-1 text-[13px] text-[color:var(--color-text-secondary)]">
              Generate a secure link to receive Private ZK-SOL
            </p>
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <label className="cipher-label mb-2 block">
              Receiver Address
            </label>
            <input
              className="cipher-input"
              value={toAddress}
              onChange={(e) => setToAddress(e.target.value)}
              placeholder="Receiver Solana address"
            />
          </div>

          <div>
            <label className="cipher-label mb-2 block">
              Amount (Lamports)
            </label>
            <input
              className="cipher-input"
              value={amountLamports}
              onChange={(e) => setAmountLamports(e.target.value)}
              placeholder="e.g. 1000000"
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="text-[color:var(--color-emerald)]">
                  <LockMini />
                </div>
                <div className="cipher-label">Private memo</div>
              </div>
              <div className="flex items-center gap-2">
                {usingTempKey && (
                  <button
                    onClick={handleUnlock}
                    className="cipher-badge-devnet"
                    title="Switch to Wallet Identity Key"
                    type="button"
                  >
                    Using Device Key
                  </button>
                )}
                <span className="cipher-badge-shielded">End-to-End Encrypted</span>
              </div>
            </div>
            <textarea
              className="cipher-input min-h-[88px] resize-y font-sans"
              value={memoText}
              onChange={(e) => setMemoText(e.target.value)}
              placeholder="Write a private note... Only the receiver can read this."
            />
          </div>
        </div>

        <div className="mt-6">
          <button
            type="button"
            onClick={handleGenerateLink}
            className="cipher-btn-primary mt-2 flex w-full items-center justify-center gap-2 py-3 text-[14px]"
          >
            <KeyMark />
            Generate Secure Link
          </button>
        </div>

        {link && (
          <div className="mt-6">
            <label className="cipher-label mb-2 block">
              Your Secure Link
            </label>
            <textarea
              className="cipher-input h-20 resize-none"
              value={link}
              readOnly
            />
            <div className="mt-2 flex items-center justify-end">
              <button
                type="button"
                onClick={handleCopyLink}
                className="cipher-btn-ghost px-5 py-[10px] text-[13px]"
              >
                Copy
              </button>
            </div>
          </div>
        )}

        {blinkUrl && (
          <div className="cipher-card mt-3">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="cipher-label">BLINK URL</div>
                <div className="mt-1 text-[12px] text-[color:var(--color-text-muted)]">
                  Works in Twitter/X, Phantom, and Blink clients
                </div>
              </div>
              <span className="cipher-badge-shielded">NEW</span>
            </div>

            <input
              className="cipher-input mt-3 w-full truncate font-mono text-[11px]"
              value={blinkUrl}
              readOnly
            />

            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={handleCopyBlink}
                className="cipher-btn-ghost px-4 py-[10px] text-[12px]"
              >
                Copy Blink
              </button>
              <button
                type="button"
                onClick={() => window.open(blinkUrl, "_blank", "noopener,noreferrer")}
                className="cipher-btn-ghost px-4 py-[10px] text-[12px]"
              >
                Test Blink ↗
              </button>
            </div>

            <div className="mt-2 text-[11px] text-[color:var(--color-text-muted)]">
              Share this link on Twitter/X — it will render as an interactive payment button.
              Register at dial.to for full X.com unfurling.
            </div>
          </div>
        )}

        {status && (
          <div className="mt-4 rounded-[8px] border border-[color:var(--color-emerald-dim)] bg-[color:var(--color-emerald-dim)]/30 p-3">
            <p className="text-[13px] text-[color:var(--color-emerald)]">
              {status}
            </p>
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-[8px] border border-red-900/40 bg-red-950/30 p-3">
            <p className="text-[13px] text-red-200">
              {error}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function LockMini() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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

function KeyMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M14.5 10.5a4.5 4.5 0 1 1-4.2-4.48"
        stroke="#FAFAFA"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M10.3 6.02 21 6v4l-2 2-2-2-2 2-2-2-2 2"
        stroke="#FAFAFA"
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

