"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  getOrCreateInboxKeypair,
  getMemoryKeypair,
  deriveKeysFromSignature,
  setMemoryKeypair,
} from "@/lib/crypto/keys";
import { encryptMemo } from "@/lib/crypto/encrypt";
import bs58 from "bs58";
import { Lock, Copy, RefreshCw } from "lucide-react";

export function PaymentLinkCreator() {
  const { publicKey, signMessage } = useWallet();
  const [toAddress, setToAddress] = useState("");
  const [amountLamports, setAmountLamports] = useState("");
  const [memoText, setMemoText] = useState("");
  const [link, setLink] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [usingTempKey, setUsingTempKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setUsingTempKey(!getMemoryKeypair());
  }, [status, link]);

  useEffect(() => {
    if (publicKey) setToAddress(publicKey.toBase58());
  }, [publicKey]);

  const handleUnlock = async () => {
    try {
      if (!signMessage) throw new Error("Wallet does not support signing");
      const message = new TextEncoder().encode("Unlock Privacy Pay Inbox");
      const signature = await signMessage(message);
      const keypair = deriveKeysFromSignature(signature);
      setMemoryKeypair(keypair);
      setUsingTempKey(false);
      setStatus("Switched to Wallet Identity Key.");
    } catch {
      setError("Failed to unlock wallet identity.");
    }
  };

  const handleGenerateLink = () => {
    setStatus(""); setError(""); setLink("");
    if (!toAddress.trim()) { setError("Receiver address is required."); return; }
    setLoading(true);
    try {
      const receiverKeypair = getMemoryKeypair() || getOrCreateInboxKeypair();
      const pkBase58 = bs58.encode(receiverKeypair.publicKey);
      let encryptedMemoBlob = "";
      if (memoText.trim()) encryptedMemoBlob = encryptMemo(memoText, receiverKeypair.publicKey);
      if (typeof window === "undefined") throw new Error("Cannot generate link outside the browser.");
      const baseUrl = `${window.location.origin}/pay`;
      const params = new URLSearchParams();
      if (toAddress.trim()) params.set("to", toAddress.trim());
      if (amountLamports.trim()) params.set("amountLamports", amountLamports.trim());
      if (pkBase58) params.set("pk", pkBase58);
      const ref =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `ref-${Date.now()}`;
      params.set("ref", ref);
      const parts = [params.toString()];
      if (encryptedMemoBlob) parts.push(`m=${encodeURIComponent(encryptedMemoBlob)}`);
      setLink(`${baseUrl}#${parts.join("&")}`);
      setStatus("Link ready.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate payment link.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Failed to copy.");
    }
  };

  return (
    <div className="space-y-6">

      {/* Receiver Address */}
      <div className="space-y-2">
        <label className="block text-xs font-semibold text-white/60 uppercase tracking-wider">
          Receiver Address
        </label>
        <input
          className="w-full rounded-xl border border-white/15 bg-white/[0.03] px-4 py-3 text-sm text-white placeholder-white/25 focus:outline-none focus:border-white/40 focus:bg-white/[0.05] font-mono transition-all"
          value={toAddress}
          onChange={(e) => setToAddress(e.target.value)}
          placeholder="Solana address"
        />
      </div>

      {/* Amount */}
      <div className="space-y-2">
        <label className="block text-xs font-semibold text-white/60 uppercase tracking-wider">
          Amount
        </label>
        <div className="relative">
          <input
            className="w-full rounded-xl border border-white/15 bg-white/[0.03] px-4 py-3 pr-20 text-sm text-white placeholder-white/25 focus:outline-none focus:border-white/40 focus:bg-white/[0.05] font-mono transition-all"
            value={amountLamports}
            onChange={(e) => setAmountLamports(e.target.value)}
            placeholder="1000000"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-white/30 pointer-events-none">
            lamports
          </span>
        </div>
      </div>

      {/* Private Memo */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-white/60 uppercase tracking-wider">
            Private Memo
          </label>
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-white/15 bg-white/[0.03]">
            <Lock className="w-3 h-3 text-white/50" />
            <span className="text-[10px] font-semibold text-white/50">E2E Encrypted</span>
          </div>
        </div>
        <textarea
          className="w-full h-[90px] rounded-xl border border-white/15 bg-white/[0.03] px-4 py-3 text-sm text-white placeholder-white/25 focus:outline-none focus:border-white/40 focus:bg-white/[0.05] resize-none transition-all"
          value={memoText}
          onChange={(e) => setMemoText(e.target.value)}
          placeholder="Write a private note — only the receiver can read this."
        />
        {usingTempKey && (
          <button
            onClick={handleUnlock}
            className="w-full text-xs text-white/50 hover:text-white border border-white/10 hover:border-white/25 bg-white/[0.02] hover:bg-white/[0.05] rounded-xl py-2 transition-all"
          >
            Using device key — click to switch to wallet identity key
          </button>
        )}
      </div>

      {/* Status / Error */}
      {error && (
        <div className="px-4 py-3 rounded-xl border border-white/10 bg-white/[0.03]">
          <p className="text-xs text-white/50">{error}</p>
        </div>
      )}
      {status && !link && (
        <div className="px-4 py-3 rounded-xl border border-white/10 bg-white/[0.04]">
          <p className="text-xs text-white/60">{status}</p>
        </div>
      )}

      {/* Generated link */}
      {link && (
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-white/60 uppercase tracking-wider">
            Payment Link
          </label>
          <div
            className="relative group cursor-pointer rounded-xl border border-white/15 bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.05] transition-all"
            onClick={handleCopyLink}
          >
            <p className="px-4 py-3 text-xs font-mono text-white/70 break-all leading-relaxed pr-12">
              {link}
            </p>
            <div className="absolute top-3 right-3 p-1.5 bg-white/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
              <Copy className="w-3.5 h-3.5 text-white" />
            </div>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={handleGenerateLink}
          disabled={loading}
          className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-white text-black hover:bg-white/90 px-4 py-3 text-sm font-bold transition-all disabled:opacity-50"
        >
          {loading && <RefreshCw className="w-4 h-4 animate-spin" />}
          Generate Link
        </button>
        {link && (
          <button
            type="button"
            onClick={handleCopyLink}
            className={`px-5 py-3 rounded-xl border text-sm font-semibold transition-all ${
              copied
                ? "border-white/30 bg-white/10 text-white"
                : "border-white/15 bg-white/[0.03] text-white/70 hover:bg-white/[0.08] hover:text-white hover:border-white/25"
            }`}
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        )}
      </div>

    </div>
  );
}
