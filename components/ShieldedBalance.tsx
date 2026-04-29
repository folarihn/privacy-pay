"use client";

import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { useEffect, useState } from "react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { getShieldedHistory, type ShieldedActivity } from "@/lib/solana/lightProtocol";
import { shieldFunds, unshieldFunds, sendZkPayment, getCompressedBalance } from "@/lib/solana/engines/zkCompressedTransfer";
import { Shield, ArrowDownLeft, ArrowUpRight, Send, RefreshCw, History, Wallet, X, CheckCircle2, AlertCircle } from "lucide-react";

export function ShieldedBalance() {
  const wallet = useWallet();
  const { publicKey } = wallet;
  const { connection } = useConnection();
  const [balance, setBalance] = useState<number | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [history, setHistory] = useState<ShieldedActivity[]>([]);
  const [mode, setMode] = useState<"none" | "shield" | "unshield" | "transfer">("none");
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [processing, setProcessing] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  const fetchData = async () => {
    if (!publicKey) return;
    setLoadingBalance(true);
    try {
      const balLamports = await getCompressedBalance(publicKey.toBase58());
      setBalance(balLamports / LAMPORTS_PER_SOL);
      try {
        const hist = await getShieldedHistory(publicKey);
        setHistory(hist);
      } catch (e) { console.warn("Failed to fetch history", e); }
    } catch (e) { console.error("Failed to fetch data", e); }
    setLoadingBalance(false);
  };

  useEffect(() => {
    if (!publicKey) { setBalance(null); setHistory([]); return; }
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [publicKey]);

  const handleAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!publicKey || !amount) return;
    try {
      setProcessing(true);
      setStatusMsg("Initializing...");
      const val = parseFloat(amount);
      if (isNaN(val) || val <= 0) throw new Error("Invalid amount");
      const lamports = Math.floor(val * LAMPORTS_PER_SOL);
      let signature = "";
      if (mode === "shield") {
        setStatusMsg("Shielding funds...");
        signature = await shieldFunds({ payer: wallet, toPubkey: publicKey.toBase58(), amountLamports: lamports });
      } else if (mode === "unshield") {
        setStatusMsg("Unshielding funds...");
        signature = await unshieldFunds({ payer: wallet, toPubkey: publicKey.toBase58(), amountLamports: lamports });
      } else if (mode === "transfer") {
        if (!recipient) throw new Error("Recipient address is required");
        setStatusMsg("Sending...");
        signature = await sendZkPayment({ payer: wallet, toPubkey: recipient, amountLamports: lamports });
      } else return;
      setStatusMsg("Transaction confirmed!");
      setMode("none"); setAmount(""); setRecipient("");
      fetchData(); setTimeout(fetchData, 2000);
    } catch (error: any) {
      setStatusMsg(`Error: ${error.message || error.toString()}`);
    } finally { setProcessing(false); }
  };

  if (!publicKey) return null;

  const modeIcon = mode === "shield" ? <ArrowDownLeft className="w-5 h-5" /> : mode === "unshield" ? <ArrowUpRight className="w-5 h-5" /> : <Send className="w-5 h-5" />;
  const modeLabel = mode === "shield" ? "Deposit" : mode === "unshield" ? "Withdraw" : "Send";

  return (
    <div className="space-y-4 max-w-2xl mx-auto pb-6">

      {/* Balance Card */}
      <div className="rounded-2xl border border-black/[0.08] dark:border-white/[0.08] bg-black/[0.03] dark:bg-white/[0.03] p-6 md:p-8">
        <div className="flex justify-between items-start mb-8">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-black/[0.05] dark:bg-white/[0.05] border border-black/[0.08] dark:border-white/[0.08]">
            <Shield className="w-3.5 h-3.5 text-black/50 dark:text-white/50" />
            <span className="text-xs font-medium text-black/50 dark:text-white/50">ZK Compressed</span>
          </div>
          <button
            onClick={fetchData}
            disabled={loadingBalance}
            className={`p-2 rounded-full bg-black/[0.04] dark:bg-white/[0.04] hover:bg-black/[0.08] dark:hover:bg-white/[0.08] border border-black/[0.06] dark:border-white/[0.06] transition-all ${loadingBalance ? "animate-spin" : ""} text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white`}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs font-medium text-black/40 dark:text-white/40 uppercase tracking-wider mb-2">Shielded Balance</p>
        <div className="flex items-baseline gap-2">
          {loadingBalance && balance === null ? (
            <div className="h-14 w-48 bg-black/[0.06] dark:bg-white/[0.06] animate-pulse rounded-xl" />
          ) : (
            <span className="text-5xl md:text-6xl font-black tracking-tighter text-black dark:text-white">
              {balance?.toFixed(4) ?? "0.0000"}
            </span>
          )}
          <span className="text-xl font-bold text-black/40 dark:text-white/40 mb-1">SOL</span>
        </div>
      </div>

      {/* Actions */}
      {mode === "none" ? (
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setMode("shield")}
            className="group flex flex-col items-center justify-center gap-3 p-6 bg-black/[0.03] dark:bg-white/[0.03] hover:bg-black/[0.06] dark:hover:bg-white/[0.06] border border-black/[0.07] dark:border-white/[0.07] hover:border-black/20 dark:hover:border-white/20 rounded-2xl transition-all duration-200"
          >
            <div className="w-11 h-11 rounded-full bg-black/[0.06] dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/[0.08] flex items-center justify-center group-hover:scale-110 transition-all">
              <ArrowDownLeft className="w-5 h-5 text-black/60 dark:text-white/60" />
            </div>
            <div className="text-center">
              <div className="font-bold text-black dark:text-white text-sm">Deposit</div>
              <div className="text-xs text-black/40 dark:text-white/40">Shield funds</div>
            </div>
          </button>

          <button
            onClick={() => setMode("unshield")}
            className="group flex flex-col items-center justify-center gap-3 p-6 bg-black/[0.03] dark:bg-white/[0.03] hover:bg-black/[0.06] dark:hover:bg-white/[0.06] border border-black/[0.07] dark:border-white/[0.07] hover:border-black/20 dark:hover:border-white/20 rounded-2xl transition-all duration-200"
          >
            <div className="w-11 h-11 rounded-full bg-black/[0.06] dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/[0.08] flex items-center justify-center group-hover:scale-110 transition-all">
              <ArrowUpRight className="w-5 h-5 text-black/60 dark:text-white/60" />
            </div>
            <div className="text-center">
              <div className="font-bold text-black dark:text-white text-sm">Withdraw</div>
              <div className="text-xs text-black/40 dark:text-white/40">Unshield funds</div>
            </div>
          </button>

          <button
            onClick={() => setMode("transfer")}
            className="col-span-2 group flex items-center justify-between p-5 bg-black dark:bg-white text-white dark:text-black hover:bg-black/90 dark:hover:bg-white/90 rounded-2xl transition-all duration-200"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-white/10 dark:bg-black/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Send className="w-5 h-5" />
              </div>
              <div className="text-left">
                <div className="font-bold text-base">Send Private Payment</div>
                <div className="text-xs text-white/50 dark:text-black/50">Transfer encrypted assets instantly</div>
              </div>
            </div>
            <ArrowUpRight className="w-4 h-4 text-white/40 dark:text-black/40" />
          </button>
        </div>
      ) : (
        <div className="border border-black/[0.08] dark:border-white/[0.08] bg-black/[0.03] dark:bg-white/[0.03] rounded-2xl p-6 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-base font-bold text-black dark:text-white flex items-center gap-2">
              <span className="p-1.5 bg-black/[0.07] dark:bg-white/[0.07] rounded-lg text-black/60 dark:text-white/60">{modeIcon}</span>
              {modeLabel === "Send" ? "Send Private Payment" : mode === "shield" ? "Deposit Funds" : "Withdraw Funds"}
            </h3>
            <button
              type="button"
              onClick={() => { setMode("none"); setAmount(""); setRecipient(""); setStatusMsg(""); }}
              className="p-2 hover:bg-black/[0.06] dark:hover:bg-white/[0.06] rounded-full transition-colors"
            >
              <X className="w-4 h-4 text-black/40 dark:text-white/40" />
            </button>
          </div>

          <form onSubmit={handleAction} className="space-y-4">
            {mode === "transfer" && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-black/40 dark:text-white/40 uppercase tracking-wider">Recipient Address</label>
                <div className="relative">
                  <Wallet className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-black/30 dark:text-white/30" />
                  <input
                    type="text"
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    className="w-full bg-white dark:bg-black border border-black/[0.1] dark:border-white/[0.08] rounded-xl py-3.5 pl-11 pr-4 text-black dark:text-white placeholder-black/25 dark:placeholder-white/20 focus:ring-1 focus:ring-black/30 dark:focus:ring-white/30 focus:border-black/30 dark:focus:border-white/30 outline-none font-mono text-sm transition-all"
                    placeholder="Solana address"
                    disabled={processing}
                    autoFocus
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-black/40 dark:text-white/40 uppercase tracking-wider">Amount</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-black/30 dark:text-white/30">SOL</span>
                <input
                  type="number"
                  step="0.000000001"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-white dark:bg-black border border-black/[0.1] dark:border-white/[0.08] rounded-xl py-3.5 pl-14 pr-4 text-black dark:text-white placeholder-black/25 dark:placeholder-white/20 focus:ring-1 focus:ring-black/30 dark:focus:ring-white/30 focus:border-black/30 dark:focus:border-white/30 outline-none font-mono text-xl transition-all"
                  placeholder="0.00"
                  disabled={processing}
                  autoFocus={mode !== "transfer"}
                />
              </div>
            </div>

            {statusMsg && (
              <div className={`flex items-center gap-3 p-3.5 rounded-xl text-sm font-medium border ${
                statusMsg.startsWith("Error")
                  ? "bg-black/[0.03] dark:bg-white/[0.03] border-black/[0.08] dark:border-white/[0.08] text-black/50 dark:text-white/50"
                  : "bg-black/[0.05] dark:bg-white/[0.05] border-black/[0.1] dark:border-white/[0.1] text-black/70 dark:text-white/70"
              }`}>
                {statusMsg.startsWith("Error") ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
                {statusMsg}
              </div>
            )}

            <div className="pt-1">
              <button
                type="submit"
                disabled={processing || !amount || (mode === "transfer" && !recipient)}
                className="w-full py-3.5 px-6 rounded-xl font-bold bg-black dark:bg-white text-white dark:text-black hover:bg-black/90 dark:hover:bg-white/90 transition-all flex justify-center items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {processing ? <><RefreshCw className="w-4 h-4 animate-spin" /> Processing...</> : `Confirm ${modeLabel}`}
              </button>
              <button
                type="button"
                onClick={() => { setMode("none"); setAmount(""); setRecipient(""); setStatusMsg(""); }}
                className="w-full mt-2 py-2.5 text-sm text-black/30 dark:text-white/30 hover:text-black/60 dark:hover:text-white/60 transition-colors"
                disabled={processing}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Activity */}
      {history.length > 0 && (
        <div className="pt-4 border-t border-black/[0.06] dark:border-white/[0.06]">
          <div className="flex items-center gap-2 mb-3 px-1">
            <History className="w-3.5 h-3.5 text-black/30 dark:text-white/30" />
            <h3 className="text-xs font-bold text-black/30 dark:text-white/30 uppercase tracking-wider">Recent Activity</h3>
          </div>
          <div className="space-y-2">
            {history.map((activity) => (
              <div
                key={activity.signature}
                className="group flex items-center justify-between p-4 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.05] dark:border-white/[0.05] hover:bg-black/[0.05] dark:hover:bg-white/[0.05] hover:border-black/[0.1] dark:hover:border-white/[0.1] transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-black/[0.06] dark:bg-white/[0.06] border border-black/[0.07] dark:border-white/[0.07] flex items-center justify-center text-black/50 dark:text-white/50">
                    {activity.type === "shield" ? <ArrowDownLeft className="w-4 h-4" /> :
                     activity.type === "unshield" ? <ArrowUpRight className="w-4 h-4" /> :
                     activity.type === "transfer" ? <Send className="w-4 h-4" /> : <History className="w-4 h-4" />}
                  </div>
                  <div>
                    <div className="font-semibold text-black/80 dark:text-white/80 text-sm capitalize">
                      {activity.type === "shield" ? "Deposit" : activity.type === "unshield" ? "Withdrawal" : activity.type === "transfer" ? "Transfer" : "Interaction"}
                    </div>
                    <div className="text-xs text-black/30 dark:text-white/30">{new Date(activity.timestamp * 1000).toLocaleString()}</div>
                  </div>
                </div>
                <div className="text-right">
                  <a
                    href={`https://explorer.solana.com/tx/${activity.signature}?cluster=devnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-black/30 dark:text-white/30 group-hover:text-black/60 dark:group-hover:text-white/60 transition-colors"
                  >
                    Explorer <ArrowUpRight className="w-3 h-3" />
                  </a>
                  {activity.status === "failed" && <div className="text-xs text-black/40 dark:text-white/40 mt-0.5">Failed</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
