"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { getInboxPublicKeyBase58, exportInboxKeys, importInboxKeys, restoreKeysFromSignature } from "@/lib/crypto/keys";

export function InboxKeySection() {
  const wallet = useWallet();
  const [publicKey, setPublicKey] = useState<string>("");
  const [exported, setExported] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string>("");

  useEffect(() => { try { setTimeout(() => setPublicKey(getInboxPublicKeyBase58()), 0); } catch {} }, []);

  const handleCopyPublicKey = async () => {
    if (!publicKey) return;
    try { await navigator.clipboard.writeText(publicKey); setStatus("Public key copied."); }
    catch { setStatus("Clipboard not available."); }
  };

  const handleExport = () => {
    try { setExported(exportInboxKeys()); setStatus("Keys exported. Do not share the secret key."); setError(""); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed to export."); }
  };

  const handleImport = () => {
    if (!exported.trim()) { setError("Paste exported JSON first."); return; }
    try { importInboxKeys(exported); setPublicKey(getInboxPublicKeyBase58()); setStatus("Keys imported."); setError(""); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed to import."); }
  };

  const handleRestoreFromWallet = async () => {
    setStatus(""); setError("");
    if (!wallet.connected || !wallet.signMessage) { setError("Connect a wallet that supports message signing."); return; }
    try {
      const message = new TextEncoder().encode("Sign this message to restore your Cipher Pay inbox keys.\n\nThis will overwrite any existing keys in this browser.");
      const signature = await wallet.signMessage(message);
      await restoreKeysFromSignature(signature);
      setPublicKey(getInboxPublicKeyBase58());
      setStatus("Keys restored from wallet signature.");
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to restore keys."); }
  };

  return (
    <section className="w-full max-w-xl rounded-2xl border border-black/[0.08] dark:border-white/[0.08] bg-black/[0.03] dark:bg-white/[0.03] p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-base font-bold text-black dark:text-white">Inbox Encryption Keys</h2>
          <p className="mt-0.5 text-xs text-black/40 dark:text-white/40">Decrypt private memos</p>
        </div>
        <div className="px-3 py-1 rounded-full bg-black/[0.05] dark:bg-white/[0.05] border border-black/[0.08] dark:border-white/[0.08]">
          <span className="text-xs font-bold text-black/50 dark:text-white/50 uppercase tracking-wide">Active</span>
        </div>
      </div>

      <div className="space-y-6">
        <div>
          <button type="button" onClick={handleRestoreFromWallet} className="w-full rounded-xl bg-black dark:bg-white text-white dark:text-black hover:bg-black/90 dark:hover:bg-white/90 px-4 py-3.5 text-sm font-bold transition-all">
            Restore Keys from Wallet Signature
          </button>
          <p className="mt-2 text-center text-xs text-black/30 dark:text-white/30 max-w-xs mx-auto">
            Uses your wallet signature to generate consistent keys across all devices.
          </p>
        </div>

        <div className="pt-5 border-t border-black/[0.06] dark:border-white/[0.06]">
          <details className="group">
            <summary className="flex items-center justify-between cursor-pointer p-2 -m-2 rounded-xl hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors list-none">
              <span className="text-xs font-semibold text-black/40 dark:text-white/40 group-hover:text-black/70 dark:group-hover:text-white/70 transition-colors">Advanced Options</span>
              <svg className="w-4 h-4 text-black/30 dark:text-white/30 transition-transform duration-300 group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </summary>
            <div className="mt-4 space-y-4">
              <div className="p-4 rounded-xl bg-white dark:bg-black border border-black/[0.07] dark:border-white/[0.07]">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold text-black/30 dark:text-white/30 uppercase tracking-wider mb-1">Public Encryption Key</p>
                    <code className="block w-full truncate text-xs font-mono text-black/50 dark:text-white/50">{publicKey || "No key available..."}</code>
                  </div>
                  <button type="button" onClick={handleCopyPublicKey} className="p-2 rounded-lg bg-black/[0.05] dark:bg-white/[0.05] hover:bg-black/10 dark:hover:bg-white/10 text-black/50 dark:text-white/50 hover:text-black dark:hover:text-white transition-colors border border-black/[0.07] dark:border-white/[0.07]" title="Copy">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                  </button>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <button type="button" onClick={handleExport} className="flex-1 px-3 py-2.5 rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-black/[0.03] dark:bg-white/[0.03] hover:bg-black/[0.07] dark:hover:bg-white/[0.07] text-xs font-medium text-black/50 dark:text-white/50 hover:text-black dark:hover:text-white transition-colors">Export Backup</button>
                  <button type="button" onClick={handleImport} className="flex-1 px-3 py-2.5 rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-black/[0.03] dark:bg-white/[0.03] hover:bg-black/[0.07] dark:hover:bg-white/[0.07] text-xs font-medium text-black/50 dark:text-white/50 hover:text-black dark:hover:text-white transition-colors">Import Backup</button>
                </div>
                <textarea className="w-full h-24 rounded-xl border border-black/[0.07] dark:border-white/[0.07] bg-white dark:bg-black p-4 text-[10px] font-mono text-black/40 dark:text-white/40 placeholder-black/15 dark:placeholder-white/15 focus:outline-none focus:border-black/20 dark:focus:border-white/20 resize-none transition-all" placeholder="Paste exported keys JSON here..." value={exported} onChange={(e) => setExported(e.target.value)} />
              </div>
            </div>
          </details>
        </div>
      </div>

      {status && <div className="mt-5 p-3 rounded-xl bg-black/[0.04] dark:bg-white/[0.04] border border-black/[0.08] dark:border-white/[0.08]"><p className="text-xs text-black/60 dark:text-white/60">{status}</p></div>}
      {error && <div className="mt-5 p-3 rounded-xl bg-black/[0.03] dark:bg-white/[0.03] border border-black/[0.07] dark:border-white/[0.07]"><p className="text-xs text-black/40 dark:text-white/40">{error}</p></div>}
    </section>
  );
}
