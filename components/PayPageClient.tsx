"use client";

import { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { sendZkPayment, getCompressedBalance } from "@/lib/solana/engines/zkCompressedTransfer";
import { getMemoryKeypair, getOrCreateInboxKeypair } from "@/lib/crypto/keys";
import { encryptMemo } from "@/lib/crypto/encrypt";
import { saveContact, getContacts } from "@/lib/contacts";
import { Shield, Wallet, UserPlus } from "lucide-react";
import bs58 from "bs58";

export function PayPageClient() {
  const searchParams = useSearchParams();
  const wallet = useWallet();

  const [to, setTo] = useState(searchParams.get("to") ?? "");
  const [receiverPk, setReceiverPk] = useState(searchParams.get("pk") ?? "");
  const [rawM, setRawM] = useState(searchParams.get("m") ?? "");
  const [memoInput, setMemoInput] = useState("");
  const [refFromLink, setRefFromLink] = useState(searchParams.get("ref") ?? "");
  const [isVerified, setIsVerified] = useState(false);
  const [isContact, setIsContact] = useState(false);
  const [sendAsPublic, setSendAsPublic] = useState(false);

  useEffect(() => {
    if (to) {
        const contacts = getContacts();
        setIsContact(contacts.some(c => c.address === to));
    }
  }, [to]);

  const [amountSol, setAmountSol] = useState(() => {
    const paramAmount = searchParams.get("amountLamports");
    if (paramAmount) {
       const parsed = Number(paramAmount);
       if (Number.isFinite(parsed) && parsed > 0) {
          return (parsed / 1_000_000_000).toString();
       }
    }
    return "";
  });

  // Payment Mode State - Default to Private only
  const payMode = 'private';
  const [zkBalance, setZkBalance] = useState<number | null>(null);

  // Fetch ZK Balance
  useEffect(() => {
    if (wallet.publicKey) {
        getCompressedBalance(wallet.publicKey.toBase58())
            .then(lamports => setZkBalance(lamports / LAMPORTS_PER_SOL))
            .catch(err => console.error("Failed to fetch ZK balance", err));
    } else {
        setZkBalance(null);
    }
  }, [wallet.publicKey]);

  // Basic "Verification" Logic (Mock)
  useEffect(() => {
    if (to && to.length >= 32) {
      setIsVerified(false); 
    }
  }, [to]);

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash) {
      try {
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        
        const hashTo = params.get("to");
        if (hashTo) setTo(hashTo);
        
        const hashPk = params.get("pk");
        if (hashPk) setReceiverPk(hashPk);

        const hashM = params.get("m");
        if (hashM) setRawM(hashM);
        
        const hashRef = params.get("ref");
        if (hashRef) setRefFromLink(hashRef);

        const hashAmount = params.get("amountLamports");
        if (hashAmount) {
           const parsed = Number(hashAmount);
           if (Number.isFinite(parsed) && parsed > 0) {
              setAmountSol((parsed / 1_000_000_000).toString());
           }
        }
      } catch (e) {
        console.error("Failed to parse hash params", e);
      }
    }
  }, []);

  const encryptedMemoBlob = rawM;
  const hasEncryptedMemo = !!encryptedMemoBlob;

  const [sending, setSending] = useState(false);
  const [signature, setSignature] = useState("");
  const [explorerUrl, setExplorerUrl] = useState("");
  const [receipt, setReceipt] = useState("");
  const [claimLink, setClaimLink] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const isSelfSend = useMemo(() => {
      if (!wallet.publicKey || !to) return false;
      return wallet.publicKey.toBase58() === to;
  }, [wallet.publicKey, to]);

  const amountLamportsDisplay = useMemo(() => {
    const parsed = Number(amountSol);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return "";
    }
    return Math.round(parsed * 1_000_000_000).toString();
  }, [amountSol]);

  const handleAddContact = () => {
      if (!to) return;
      saveContact({
          name: `Contact ${to.slice(0,4)}...`,
          address: to,
          inboxPk: receiverPk || undefined,
          createdAt: Date.now()
      });
      setIsContact(true);
      setStatus("Contact saved!");
  };

  const handleSend = async () => {
    setStatus("");
    setError("");
    setSignature("");
    setExplorerUrl("");
    setReceipt("");

    try {
      if (!wallet.publicKey) {
        throw new Error("Connect your wallet to send a payment.");
      }

      if (!to.trim()) {
        throw new Error("Receiver address is missing in the link.");
      }

      try {
        const candidate = new PublicKey(to.trim());
        if (!PublicKey.isOnCurve(candidate.toBytes())) {
          throw new Error("Receiver address is not a valid Solana public key.");
        }
      } catch {
        throw new Error("Receiver address is not a valid Solana public key.");
      }

      const parsedSol = Number(amountSol);
      if (!Number.isFinite(parsedSol) || parsedSol <= 0) {
        throw new Error("Enter an amount in SOL greater than 0.");
      }

      const amountLamports = Math.round(parsedSol * 1_000_000_000);

      setSending(true);

      // Handle Memo Encryption
      let finalEncryptedMemo = encryptedMemoBlob;
      if (memoInput.trim()) {
          setStatus("Encrypting memo...");
          
          const myKeypair = getMemoryKeypair() || getOrCreateInboxKeypair();
          if (isSelfSend) {
              // Self-send: Encrypt for ourselves (fully readable)
              finalEncryptedMemo = encryptMemo(memoInput, myKeypair.publicKey);
          } else if (receiverPk) {
              // E2EE: Encrypt using Receiver's Public Key
              try {
                  const receiverPkBytes = bs58.decode(receiverPk);
                  finalEncryptedMemo = encryptMemo(memoInput, receiverPkBytes);
              } catch (e) {
                  console.warn("Invalid Receiver PK, falling back to Sender Key", e);
                  finalEncryptedMemo = encryptMemo(memoInput, myKeypair.publicKey);
              }
          } else {
              // Send to others without known PK: 
              if (sendAsPublic) {
                   // Plaintext fallback for usability
                   console.log("Sending memo as plaintext (Public)");
                   finalEncryptedMemo = JSON.stringify({ plaintext: memoInput });
              } else {
                  // Default privacy-preserving fallback (Sender only)
                  console.warn("Encrypting memo with Sender's key (Receiver cannot decrypt without key exchange).");
                  finalEncryptedMemo = encryptMemo(memoInput, myKeypair.publicKey);
              }
          }
      }

      let sig = "";

      // Private ZK Transfer
      if (zkBalance !== null && parsedSol > zkBalance) {
          throw new Error(`Insufficient Shielded Balance (${zkBalance.toFixed(4)} ZK-SOL)`);
      }
      
      sig = await sendZkPayment({
          payer: wallet,
          toPubkey: to.trim(),
          amountLamports,
          encryptedMemo: finalEncryptedMemo,
      });

      const explorer = `https://explorer.solana.com/tx/${sig}?cluster=devnet`;

      setSignature(sig);
      setExplorerUrl(explorer);

      // Use ref from link if available, otherwise generate fallback
      const ref = refFromLink || (typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `ref-${Date.now()}`);

      const receiptPayload = {
        ref,
        signature: sig,
        from: wallet.publicKey.toBase58(),
        to: to.trim(),
        amountLamports,
        encryptedMemo: finalEncryptedMemo || "",
        createdAt: Date.now(),
        type: payMode // 'public' or 'private'
      };

      setReceipt(JSON.stringify(receiptPayload, null, 2));
      
      // Save to "Sent" History
      if (typeof window !== "undefined" && wallet.publicKey) {
          try {
              const SENT_KEY = `pp_sent_receipts_${wallet.publicKey.toBase58()}`;
              const existing = window.localStorage.getItem(SENT_KEY);
              const history = existing ? JSON.parse(existing) : [];
              // Add memoText for sender's reference
              const sentItem = { ...receiptPayload, memoText: memoInput || (hasEncryptedMemo ? "[Encrypted]" : "") };
              history.unshift(sentItem); // Add to top
              // Limit history to 50 items
              if (history.length > 50) history.pop();
              window.localStorage.setItem(SENT_KEY, JSON.stringify(history));
          } catch (e) {
              console.warn("Failed to save sent history", e);
          }
      }
      
      // Generate Claim Link
      if (typeof window !== "undefined") {
        const receiptJson = JSON.stringify(receiptPayload);
        const encodedReceipt = encodeURIComponent(receiptJson);
        const link = `${window.location.origin}/inbox#receipt=${encodedReceipt}`;
        setClaimLink(link);
      }

      setStatus("Payment sent on devnet. Receipt generated.");
    } catch (e: any) {
      console.error("Payment Error (Raw):", e);
      if (typeof e === 'object' && e !== null) {
          console.error("Payment Error (JSON):", JSON.stringify(e, Object.getOwnPropertyNames(e), 2));
      }
      
      if (e instanceof Error) {
        // Detailed error for debugging
        setError(e.message);
      } else if (e?.message) {
        setError(e.message);
      } else {
        setError(`Failed to send payment: ${JSON.stringify(e)}`);
      }
    } finally {
      setSending(false);
    }
  };

  const handleCopyClaimLink = async () => {
    if (!claimLink) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(claimLink);
        setStatus("Claim Link copied! Send this to the receiver.");
      } else {
        setStatus("Clipboard is not available.");
      }
    } catch {
      setStatus("Failed to copy link.");
    }
  };

  const handleCopyReceipt = async () => {
    if (!receipt) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(receipt);
        setStatus("Receipt JSON copied to clipboard.");
      } else {
        setStatus("Clipboard is not available in this browser.");
      }
    } catch {
      setStatus("Failed to copy receipt.");
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center bg-black text-white pt-24 md:pt-28 px-4 md:px-6 pb-24 md:pb-8">
      <div className="w-full max-w-lg">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Send Payment</h1>
          <p className="mt-1 text-sm text-slate-400">Securely send funds with an encrypted memo.</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-xl p-6 shadow-xl">
          <div className="space-y-6">
            <div className="flex flex-col gap-2 p-3 rounded-lg bg-black/30 border border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400">Receiver</span>
                <div className="flex gap-2">
                    {!isContact && to && (
                        <button onClick={handleAddContact} className="text-[10px] bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded border border-indigo-500/30 hover:bg-indigo-500/30 transition-colors flex items-center gap-1">
                            <UserPlus className="w-3 h-3" /> Save
                        </button>
                    )}
                    {isVerified ? (
                      <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded border border-green-500/30">Verified</span>
                    ) : (
                      <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/30">Unverified Address</span>
                    )}
                </div>
              </div>
              <code className="text-xs font-mono text-white break-all">
                {to || "not specified"}
              </code>
              {!isVerified && to && (
                <div className="text-[10px] text-amber-500/80 mt-1">
                  ⚠️ Verify this address carefully before sending funds.
                </div>
              )}
            </div>

            <div>
              <div className="flex justify-between items-end mb-1.5 ml-1">
                <label className="block text-xs font-semibold text-slate-300">
                    Amount (ZK-SOL)
                </label>
                {zkBalance !== null && (
                    <span className="text-xs text-emerald-400 font-mono">
                        Available: {zkBalance.toFixed(4)} ZK-SOL
                    </span>
                )}
              </div>
              <div className="relative">
                <input
                  type="text"
                  className="w-full rounded-lg border bg-black px-4 py-3 text-lg font-bold text-white placeholder-slate-600 focus:outline-none focus:ring-1 font-mono transition-colors border-emerald-900/50 focus:border-emerald-500 focus:ring-emerald-500"
                  value={amountSol}
                  onChange={(e) => setAmountSol(e.target.value)}
                  placeholder="0.00"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-500 pointer-events-none">
                  ZK
                </div>
              </div>
              {amountLamportsDisplay && (
                <p className="mt-1 text-[10px] text-slate-500 font-mono text-right px-1">
                  ≈ {amountLamportsDisplay} lamports
                </p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5 ml-1">
                <label className="block text-xs font-semibold text-slate-300">
                  Private Memo
                </label>
                {hasEncryptedMemo ? (
                   <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium bg-emerald-900/30 px-2 py-0.5 rounded-full border border-emerald-900/50">
                    Encrypted & Attached
                  </span>
                ) : receiverPk ? (
                    <span className="flex items-center gap-1 text-[10px] text-indigo-400 font-medium bg-indigo-900/30 px-2 py-0.5 rounded-full border border-indigo-900/50">
                      <Shield className="w-3 h-3" /> End-to-End Encrypted
                    </span>
                ) : (
                  <span className="text-[10px] text-slate-500 italic">
                      {isSelfSend ? "Optional" : "Disabled"}
                  </span>
                )}
              </div>
              
              {hasEncryptedMemo ? (
                <div className="rounded-lg border border-indigo-900/50 bg-indigo-900/10 p-4">
                  <p className="text-xs text-slate-400 italic mb-2">
                    This memo is encrypted. Only the receiver can read it.
                  </p>
                  <div className="p-3 rounded-lg bg-black/30 border border-slate-800 font-mono text-[10px] text-slate-500 break-all">
                    {encryptedMemoBlob}
                  </div>
                </div>
              ) : (
                <textarea
                  className="w-full h-24 rounded-lg border border-slate-800 bg-black/40 p-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-mono resize-none transition-all"
                  value={memoInput}
                  onChange={(e) => setMemoInput(e.target.value)}
                  placeholder={
                    isSelfSend 
                      ? "Write a private note for yourself..." 
                      : receiverPk 
                        ? "Write a private memo (End-to-End Encrypted)" 
                        : "Write a memo (Note: Receiver may not be able to decrypt without key exchange)"
                  }
                />
              )}

              {/* Warning / Toggle Area for Missing Key */}
              {!isSelfSend && !receiverPk && !hasEncryptedMemo && to && (
                  <div className="mt-4 p-3 rounded-lg bg-amber-900/10 border border-amber-900/30">
                      <div className="flex items-start gap-3">
                          <span className="text-amber-500 text-lg mt-0.5">⚠️</span>
                          <div>
                              <p className="text-xs font-bold text-amber-400 mb-1">
                                  Missing Encryption Key
                              </p>
                              <p className="text-xs text-amber-200/80 mb-3 leading-relaxed">
                                  The receiver has not shared their Privacy Key. 
                                  By default, this memo will be encrypted for <strong>YOUR history only</strong>.
                              </p>
                              
                              <label className="flex items-center gap-2 cursor-pointer group">
                                  <input 
                                      type="checkbox" 
                                      checked={sendAsPublic}
                                      onChange={(e) => setSendAsPublic(e.target.checked)}
                                      className="w-5 h-5 rounded border-amber-500/50 bg-black/50 text-amber-500 focus:ring-amber-500/50"
                                  />
                                  <span className="text-xs text-slate-300 group-hover:text-white transition-colors">
                                      Send as <strong>Public Memo</strong> (Readable by Receiver)
                                  </span>
                              </label>
                          </div>
                      </div>
                  </div>
              )}
            </div>

            {error && (
              <div className="p-4 rounded-lg bg-red-900/20 border border-red-900/50">
                <p className="text-sm font-medium text-red-400 flex items-center gap-3">
                  {error}
                </p>
              </div>
            )}

            {signature ? (
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-emerald-900/20 border border-emerald-900/50">
                  <p className="text-sm font-bold text-emerald-400 flex items-center gap-2 mb-2">
                    Payment Successful!
                  </p>
                  <p className="text-xs text-slate-400 mb-3">
                    Your private transaction has been confirmed on the Solana Devnet.
                  </p>
                  {explorerUrl && (
                    <a
                      href={explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium text-indigo-400 hover:text-white transition-colors underline"
                    >
                      View on Solana Explorer
                    </a>
                  )}
                </div>

                <div className="rounded-lg border border-slate-800 bg-black/30 p-4">
                  <h3 className="text-sm font-bold text-white mb-2">
                    Payment Receipt
                  </h3>
                  <p className="text-xs text-slate-400 mb-3">
                    Share this receipt with the receiver so they can add it to their inbox.
                  </p>
                  
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={handleCopyReceipt}
                      className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-indigo-600/20 border border-indigo-500/30 px-4 py-3 text-sm font-bold text-indigo-400 hover:bg-indigo-600/30 transition-colors"
                    >
                      Copy Receipt
                    </button>
                    {claimLink && (
                       <button
                        type="button"
                        onClick={handleCopyClaimLink}
                        className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-emerald-900/30 border border-emerald-900/50 px-4 py-3 text-sm font-bold text-emerald-400 hover:bg-emerald-900/50 transition-colors"
                      >
                        Copy Receipt Link
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500 text-center mt-2">
                      Share the <strong>Receipt Link</strong> with the receiver so they can verify and decrypt the payment in their Inbox.
                  </p>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleSend}
                disabled={sending || !wallet.connected}
                className="w-full rounded-lg px-4 py-4 text-sm font-bold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-emerald-600 hover:bg-emerald-500"
              >
                {sending ? (
                  <span className="flex items-center justify-center gap-2">
                    Processing...
                  </span>
                ) : !wallet.connected ? (
                  "Connect Wallet to Pay"
                ) : (
                  "Send Private Payment"
                )}
              </button>
            )}

            {!wallet.connected && (
              <div className="mt-4 text-center">
                 <p className="text-xs text-amber-400/80 bg-amber-900/20 border border-amber-900/50 px-3 py-2 rounded-lg inline-block">
                    Please connect your Solana wallet (Devnet)
                 </p>
              </div>
            )}
            
            {status && !signature && (
               <div className="mt-2 text-center">
                 <p className="text-xs text-emerald-400">{status}</p>
               </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
