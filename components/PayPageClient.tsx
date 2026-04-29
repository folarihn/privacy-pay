"use client";

import { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { sendZkPayment, getCompressedBalance } from "@/lib/solana/engines/zkCompressedTransfer";
import { getMemoryKeypair, getOrCreateInboxKeypair } from "@/lib/crypto/keys";
import { encryptMemo, encryptedMemoToLegacyBlob, parsePaymentLink } from "@/lib/memo-sdk";
import { DEFAULT_SOLANA_CLUSTER, getExplorerTxUrl } from "@/lib/constants";
import { saveContact, getContacts } from "@/lib/contacts";
import { Shield, UserPlus } from "lucide-react";
import bs58 from "bs58";

function shorten(value: string) {
  if (!value) return "n/a";
  if (value.length <= 10) return value;
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

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
        const parsedLink = parsePaymentLink(window.location.href);
        if (parsedLink) {
          setTo(parsedLink.recipient);
          if (parsedLink.token === "SOL") {
            setAmountSol((parsedLink.amount / 1_000_000_000).toString());
          }
          if (parsedLink.memo) {
            setRawM(encryptedMemoToLegacyBlob(parsedLink.memo));
          }
          return;
        }

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
              finalEncryptedMemo = encryptedMemoToLegacyBlob(
                encryptMemo(memoInput, myKeypair.publicKey, myKeypair.secretKey),
              );
          } else if (receiverPk) {
              // E2EE: Encrypt using Receiver's Public Key
              try {
                  const receiverPkBytes = bs58.decode(receiverPk);
                  finalEncryptedMemo = encryptedMemoToLegacyBlob(
                    encryptMemo(memoInput, receiverPkBytes, myKeypair.secretKey),
                  );
              } catch (e) {
                  console.warn("Invalid Receiver PK, falling back to Sender Key", e);
                  finalEncryptedMemo = encryptedMemoToLegacyBlob(
                    encryptMemo(memoInput, myKeypair.publicKey, myKeypair.secretKey),
                  );
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
                  finalEncryptedMemo = encryptedMemoToLegacyBlob(
                    encryptMemo(memoInput, myKeypair.publicKey, myKeypair.secretKey),
                  );
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

      const explorer = getExplorerTxUrl(sig, DEFAULT_SOLANA_CLUSTER);

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
    } catch (e: unknown) {
      console.error("Payment Error (Raw):", e);
      if (typeof e === 'object' && e !== null) {
          console.error("Payment Error (JSON):", JSON.stringify(e, Object.getOwnPropertyNames(e), 2));
      }
      
      if (e instanceof Error) {
        setError(e.message);
      } else if (typeof e === "object" && e !== null && "message" in e && typeof (e as { message?: unknown }).message === "string") {
        setError((e as { message: string }).message);
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
    <main className="flex min-h-screen flex-col items-center justify-center p-4 md:p-8 pb-24 md:pb-8 bg-[#09090B] text-[#A1A1AA]">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="text-[11px] font-mono uppercase tracking-[0.1em] text-[#71717A]">Pay</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#FAFAFA]">
            Make a Payment
          </h1>
          <p className="mt-2 text-sm text-[#A1A1AA]">
            Securely send funds with an encrypted memo.
          </p>
        </div>

        <div className="rounded-2xl border border-[#27272A] bg-[#111113] p-6">
          <div className="space-y-6">
            <div className="flex flex-col gap-2 p-4 rounded-xl bg-[#09090B] border border-[#27272A]">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono uppercase tracking-[0.1em] text-[#71717A]">Receiver</span>
                <div className="flex gap-2">
                    {!isContact && to && (
                        <button onClick={handleAddContact} className="text-[11px] font-mono bg-[#111113] text-[#A1A1AA] px-2 py-1 rounded-full border border-[#27272A] hover:bg-[#18181B] hover:text-[#FAFAFA] transition-all duration-150 flex items-center gap-1">
                            <UserPlus className="w-3 h-3" /> Save
                        </button>
                    )}
                    {isVerified ? (
                      <span className="text-[11px] font-mono bg-emerald-950/40 text-[#10B981] px-2 py-1 rounded-full border border-emerald-900/40">Verified</span>
                    ) : (
                      <span className="text-[11px] font-mono bg-[#451a03] text-[#F59E0B] px-2 py-1 rounded-full border border-[#78350F]">Unverified</span>
                    )}
                </div>
              </div>
              <code className="text-sm font-mono text-[#FAFAFA]" title={to || ""}>
                {to ? shorten(to) : "not specified"}
              </code>
              {!isVerified && to && (
                <div className="text-xs text-[#F59E0B] mt-1">
                  Verify this address carefully before sending funds.
                </div>
              )}
            </div>

            <div>
              <div className="flex justify-between items-end mb-1.5 ml-1">
                <label className="block text-[11px] font-mono uppercase tracking-[0.1em] text-[#71717A]">
                    Amount (ZK-SOL)
                </label>
                {zkBalance !== null && (
                    <span className="text-xs text-[#10B981] font-mono">
                        Available: {zkBalance.toFixed(4)} ZK-SOL
                    </span>
                )}
              </div>
              <div className="relative">
                <input
                  type="text"
                  className="w-full rounded-md border border-[#3F3F46] bg-[#09090B] px-3 py-3 text-lg font-semibold text-[#FAFAFA] placeholder-[#52525B] outline-none font-mono transition-all duration-150 focus:ring-2 focus:ring-[#7C3AED]"
                  value={amountSol}
                  onChange={(e) => setAmountSol(e.target.value)}
                  placeholder="0.00"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-500 pointer-events-none">
                  ZK
                </div>
              </div>
              {amountLamportsDisplay && (
                <p className="mt-1 text-[10px] text-[#71717A] font-mono text-right px-1">
                  ≈ {amountLamportsDisplay} lamports
                </p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5 ml-1">
                <label className="block text-[11px] font-mono uppercase tracking-[0.1em] text-[#71717A]">
                  Private Memo
                </label>
                {hasEncryptedMemo ? (
                   <span className="flex items-center gap-2 text-[11px] font-mono text-[#10B981] bg-emerald-950/40 px-2 py-1 rounded-full border border-emerald-900/40">
                    Encrypted & Attached
                  </span>
                ) : receiverPk ? (
                    <span className="flex items-center gap-2 text-[11px] font-mono text-[#10B981] bg-emerald-950/40 px-2 py-1 rounded-full border border-emerald-900/40">
                      <Shield className="w-3 h-3" /> End-to-End Encrypted
                    </span>
                ) : (
                  <span className="text-[10px] text-[#71717A] italic">
                      {isSelfSend ? "Optional" : "Disabled"}
                  </span>
                )}
              </div>
              
              {hasEncryptedMemo ? (
                <div className="rounded-xl border border-[#27272A] bg-[#09090B] p-4">
                  <p className="text-xs text-[#A1A1AA] italic mb-2">
                    This memo is encrypted. Only the receiver can read it.
                  </p>
                  <div className="p-3 rounded-lg bg-[#111113] border border-[#27272A] font-mono text-[10px] text-[#71717A] break-all">
                    {encryptedMemoBlob}
                  </div>
                </div>
              ) : (
                <textarea
                  className="w-full h-24 rounded-md border border-[#3F3F46] bg-[#09090B] p-3 text-sm text-[#FAFAFA] placeholder-[#52525B] outline-none focus:ring-2 focus:ring-[#7C3AED] font-mono resize-none transition-all duration-150"
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
                  <div className="mt-4 p-4 rounded-xl bg-[#09090B] border border-[#27272A]">
                      <div className="flex items-start gap-3">
                          <div>
                              <p className="text-[11px] font-mono text-[#F59E0B] uppercase tracking-[0.1em] mb-2">
                                  Missing Encryption Key
                              </p>
                              <p className="text-sm text-[#A1A1AA] mb-4 leading-relaxed">
                                  The receiver has not shared their Privacy Key. 
                                  By default, this memo will be encrypted for <strong>YOUR history only</strong>.
                              </p>
                              
                              <label className="flex items-center gap-2 cursor-pointer group">
                                  <input 
                                      type="checkbox" 
                                      checked={sendAsPublic}
                                      onChange={(e) => setSendAsPublic(e.target.checked)}
                                      className="w-5 h-5 rounded border-[#3F3F46] bg-[#09090B] text-[#7C3AED] focus:ring-[#7C3AED]"
                                  />
                                  <span className="text-sm text-[#A1A1AA] group-hover:text-[#FAFAFA] transition-all duration-150">
                                      Send as <strong>Public Memo</strong> (Readable by Receiver)
                                  </span>
                              </label>
                          </div>
                      </div>
                  </div>
              )}
            </div>

            {error && (
              <div className="p-4 rounded-lg bg-red-950/30 border border-red-900/40">
                <p className="text-sm text-red-200 flex items-center gap-3">
                  {error}
                </p>
              </div>
            )}

            {signature ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-900/40">
                  <p className="text-sm font-semibold text-emerald-200 flex items-center gap-2 mb-2">
                    Payment Successful!
                  </p>
                  <p className="text-xs text-[#A1A1AA] mb-3">
                    Your private transaction has been confirmed on the Solana Devnet.
                  </p>
                  {explorerUrl && (
                    <a
                      href={explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium text-[#A1A1AA] hover:text-[#FAFAFA] transition-all duration-150 underline"
                    >
                      View on Solana Explorer
                    </a>
                  )}
                </div>

                <div className="rounded-xl border border-[#27272A] bg-[#09090B] p-4">
                  <h3 className="text-sm font-semibold text-[#FAFAFA] mb-2">
                    Payment Receipt
                  </h3>
                  <p className="text-xs text-[#A1A1AA] mb-3">
                    Share this receipt with the receiver so they can add it to their inbox.
                  </p>
                  
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={handleCopyReceipt}
                      className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-[#111113] border border-[#27272A] px-4 py-3 text-sm font-medium text-[#FAFAFA] hover:bg-[#18181B] transition-all duration-150"
                    >
                      Copy Receipt
                    </button>
                    {claimLink && (
                       <button
                        type="button"
                        onClick={handleCopyClaimLink}
                        className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-[#7C3AED] border border-[#7C3AED] px-4 py-3 text-sm font-medium text-[#FAFAFA] hover:bg-[#6D28D9] transition-all duration-150"
                      >
                        Copy Receipt Link
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-[#71717A] text-center mt-2">
                      Share the <strong>Receipt Link</strong> with the receiver so they can verify and decrypt the payment in their Inbox.
                  </p>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleSend}
                disabled={sending || !wallet.connected}
                className="w-full rounded-lg px-4 py-4 text-sm font-medium text-[#FAFAFA] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed bg-[#7C3AED] hover:bg-[#6D28D9]"
              >
                {sending ? (
                  <span className="flex items-center justify-center gap-2">
                    Processing
                    <span className="inline-flex items-center gap-1">
                      <span className="cipher-loading-dot" />
                      <span className="cipher-loading-dot" />
                      <span className="cipher-loading-dot" />
                    </span>
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
                 <p className="text-xs text-[#F59E0B] bg-[#451a03] border border-[#78350F] px-3 py-2 rounded-lg inline-block font-mono">
                    Please connect your Solana wallet (Devnet)
                 </p>
              </div>
            )}
            
            {status && !signature && (
               <div className="mt-2 text-center">
                 <p className="text-xs text-[#A1A1AA]">{status}</p>
               </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
