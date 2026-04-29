"use client";

import { Suspense, useState, useRef, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { ShieldedBalance } from "@/components/ShieldedBalance";
import { PaymentLinkCreator } from "@/components/PaymentLinkCreator";
import { ContactBook } from "@/components/ContactBook";
import { Bell, User, ChevronDown, Copy, LogOut } from "lucide-react";
import dynamic from "next/dynamic";

const UnifiedWalletButton = dynamic(
  async () => (await import("@jup-ag/wallet-adapter")).UnifiedWalletButton,
  { ssr: false }
);

function WalletPill({ address }: { address: string }) {
  const { disconnect } = useWallet();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const short = `${address.slice(0, 4)}...${address.slice(-4)}`;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleDisconnect = async () => {
    setOpen(false);
    await disconnect();
    router.push("/");
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 pl-2 pr-2.5 py-1 rounded-full bg-black/[0.06] dark:bg-white/[0.06] border border-black/[0.1] dark:border-white/[0.1] hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
      >
        <span className="w-2 h-2 rounded-full bg-black dark:bg-white shrink-0" />
        <span className="text-xs font-mono text-black/80 dark:text-white/80 font-medium">{short}</span>
        <ChevronDown className={`w-3 h-3 text-black/40 dark:text-white/40 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-2 w-56 rounded-2xl border border-black/[0.08] dark:border-white/[0.08] bg-white/95 dark:bg-black/95 backdrop-blur-xl shadow-2xl z-50 overflow-hidden">
          {/* Address display */}
          <div className="px-4 py-3 border-b border-black/[0.06] dark:border-white/[0.06]">
            <p className="text-[10px] text-black/40 dark:text-white/40 uppercase tracking-wider mb-1">Connected wallet</p>
            <p className="text-xs font-mono text-black/70 dark:text-white/70 break-all">{address}</p>
          </div>
          {/* Actions */}
          <div className="p-1.5 space-y-0.5">
            <button
              onClick={handleCopy}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white hover:bg-black/[0.05] dark:hover:bg-white/[0.05] transition-colors text-left"
            >
              <Copy className="w-4 h-4 shrink-0" />
              {copied ? "Copied!" : "Copy address"}
            </button>
            <button
              onClick={handleDisconnect}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white hover:bg-black/[0.05] dark:hover:bg-white/[0.05] transition-colors text-left"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              Disconnect
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const view = searchParams.get("view") || "wallet";
  const { publicKey } = useWallet();

  const pageTitle = view === "contacts" ? "Contacts" : "Wallet";

  return (
    <div className="flex flex-1 overflow-hidden min-w-0">

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Header bar */}
        <div className="flex items-center justify-between px-6 h-[65px] border-b border-black/[0.06] dark:border-white/[0.06] bg-[#f8f8f8] dark:bg-black shrink-0">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-black dark:text-white">{pageTitle}</h1>
            {publicKey && <WalletPill address={publicKey.toBase58()} />}
          </div>

          <div className="flex items-center gap-2">
            {!publicKey && (
              <div className="[&_button]:!h-9 [&_button]:!rounded-full [&_button]:!text-xs [&_button]:!font-bold [&_button]:!px-4">
                <UnifiedWalletButton />
              </div>
            )}
            <button className="w-9 h-9 flex items-center justify-center rounded-full bg-black/[0.05] dark:bg-white/[0.05] border border-black/[0.07] dark:border-white/[0.07] text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white transition-colors">
              <User className="w-4 h-4" />
            </button>
            <button className="w-9 h-9 flex items-center justify-center rounded-full bg-black/[0.05] dark:bg-white/[0.05] border border-black/[0.07] dark:border-white/[0.07] text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white transition-colors relative">
              <Bell className="w-4 h-4" />
              <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-black/40 dark:bg-white/60" />
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-6 pb-24 md:pb-6 bg-[#f8f8f8] dark:bg-black">
          {!publicKey ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
              <div className="w-16 h-16 rounded-2xl bg-black/[0.05] dark:bg-white/[0.05] border border-black/[0.08] dark:border-white/[0.08] flex items-center justify-center">
                <span className="text-2xl">🔒</span>
              </div>
              <div>
                <p className="text-black dark:text-white font-bold text-lg">Connect your wallet</p>
                <p className="text-black/40 dark:text-white/40 text-sm mt-1">Connect a Solana wallet to access your shielded balance.</p>
              </div>
              <UnifiedWalletButton />
            </div>
          ) : view === "contacts" ? (
            <ContactBook />
          ) : (
            <ShieldedBalance />
          )}
        </div>
      </div>

      {/* ── Right panel: Request Payment ── */}
      <div className="hidden lg:flex w-[340px] shrink-0 flex-col border-l border-black/[0.06] dark:border-white/[0.06] bg-white dark:bg-black overflow-hidden">

        {/* Panel header */}
        <div className="flex items-center justify-between px-5 h-[65px] border-b border-black/[0.06] dark:border-white/[0.06] shrink-0">
          <h2 className="text-base font-bold text-black dark:text-white">Request Payment</h2>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/[0.05] dark:bg-white/[0.05] border border-black/[0.07] dark:border-white/[0.07]">
            <span className="w-1.5 h-1.5 rounded-full bg-black/50 dark:bg-white/60 animate-pulse" />
            <span className="text-[10px] font-medium text-black/50 dark:text-white/50">Devnet</span>
          </div>
        </div>

        {/* Panel content */}
        <div className="flex-1 overflow-y-auto p-5">
          <PaymentLinkCreator />
        </div>
      </div>

    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
        Loading...
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}
