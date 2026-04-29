"use client";

import Link from "next/link";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction } from "@solana/web3.js";
import { useEffect, useMemo, useState } from "react";
import { createCloseAccountInstruction, getAssociatedTokenAddress } from "@solana/spl-token";
import { TokenSelector } from "@/components/TokenSelector";
import { useTokenBalances } from "@/hooks/useTokenBalances";
import { useDemoMode } from "@/hooks/useDemoMode";
import { useComplianceCheck } from "@/hooks/useComplianceCheck";
import { useNotifications } from "@/hooks/useNotifications";
import type { RiskCheckResult } from "@/lib/compliance";
import type { JupiterQuote } from "@/lib/jupiter/swap-service";
import { executeJupiterSwap, getJupiterQuoteResult } from "@/lib/jupiter/swap-service";
import {
  type SolanaCluster,
  getExplorerTxUrl,
  SOL_DECIMALS,
  type TokenSymbol,
  USDC_DECIMALS,
  USDC_MINT_DEVNET,
  USDC_MINT_MAINNET,
} from "@/lib/constants";
import { lightRpc } from "@/lib/solana/lightProtocol";
import {
  compressToken,
  decompressToken,
  transferCompressedToken,
} from "@/lib/token-service";
import { usePrices } from "@/hooks/usePrices";
import { useShieldedHistory } from "@/hooks/useShieldedHistory";
import { isSolDomain, resolveSolDomain } from "@/lib/solana/sns";

export function ShieldedBalance() {
  const { isDemoMode } = useDemoMode();
  if (isDemoMode) return <ShieldedBalanceDemo />;
  return <ShieldedBalanceReal />;
}

function relativeTime(iso: string) {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);

  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hours ago`;

  const days = Math.floor(hours / 24);
  return `${days} days ago`;
}

function ShieldedBalanceDemo() {
  const { demoState, activeDemoWallet } = useDemoMode();
  const [selectedToken, setSelectedToken] = useState<TokenSymbol>("SOL");

  const walletData = demoState?.wallets[activeDemoWallet];
  const txs =
    demoState?.demoTransactions.filter(
      (t) => t.from === activeDemoWallet || t.to === activeDemoWallet,
    ) ?? [];

  const tokenConfig = useMemo(() => {
    if (selectedToken === "SOL") {
      return { symbol: "SOL" as const, mint: null, decimals: SOL_DECIMALS };
    }
    return { symbol: "USDC" as const, mint: USDC_MINT_DEVNET, decimals: USDC_DECIMALS };
  }, [selectedToken]);

  const publicBalance =
    tokenConfig.symbol === "SOL" ? walletData?.publicSOL ?? 0 : walletData?.publicUSDC ?? 0;
  const shieldedBalance =
    tokenConfig.symbol === "SOL"
      ? walletData?.shieldedSOL ?? 0
      : walletData?.shieldedUSDC ?? 0;

  return (
    <div className="space-y-6 pb-24 md:pb-0">
      <div className="flex items-center justify-between gap-4">
        <TokenSelector selected={selectedToken} onChange={setSelectedToken} />
        <button
          type="button"
          className="cipher-btn-ghost text-[12px] px-3 py-1 opacity-50"
          disabled
          title="Connect a wallet to use this feature"
        >
          <span className="inline-flex items-center gap-2">
            <span>↻</span>
            Refresh
          </span>
        </button>
      </div>

      <div className="cipher-card-accent-left">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <div className="cipher-label">SHIELDED BALANCE</div>
            <div className="mt-1.5 font-mono text-[32px] font-medium text-[color:var(--color-text-primary)] tabular-nums">
              {shieldedBalance.toFixed(4)} {tokenConfig.symbol}
            </div>
            {tokenConfig.symbol === "USDC" && (
              <div className="mt-1 font-mono text-[13px] text-[color:var(--color-text-muted)]">
                ≈ $0.00 USD
              </div>
            )}
            <div className="mt-1 font-mono text-[13px] text-[color:var(--color-text-muted)]">
              Wallet: {publicBalance.toFixed(4)} {tokenConfig.symbol}
            </div>
          </div>

          <div
            className={`opacity-90 ${
              tokenConfig.symbol === "SOL"
                ? "text-[color:var(--color-emerald)]"
                : "text-[color:var(--color-accent)]"
            }`}
          >
            <ShieldLarge />
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          className="cipher-btn-ghost flex-1 py-[14px] px-0 text-[13px] opacity-50"
          type="button"
          disabled
          title="Connect a wallet to use this feature"
        >
          <div className="font-mono">Shield ↓</div>
        </button>
        <button
          className="cipher-btn-ghost flex-1 py-[14px] px-0 text-[13px] opacity-50"
          type="button"
          disabled
          title="Connect a wallet to use this feature"
        >
          <div className="font-mono">Send →</div>
        </button>
        <button
          className="cipher-btn-ghost flex-1 py-[14px] px-0 text-[13px] opacity-50"
          type="button"
          disabled
          title="Connect a wallet to use this feature"
        >
          <div className="font-mono">Unshield ↑</div>
        </button>
      </div>

      <div className="pt-2">
        <div className="cipher-label">RECENT TRANSACTIONS</div>
        {txs.length === 0 ? (
          <div className="cipher-card mt-3 text-center py-10">
            <div className="mx-auto w-fit text-[color:var(--color-border)]">
              <LockSmall />
            </div>
            <div className="mt-3 text-[14px] text-[color:var(--color-text-muted)]">
              Transaction history coming soon
            </div>
            <div className="mt-1 text-[12px] text-[color:var(--color-text-muted)]">
              Shield, send, or unshield to see activity here
            </div>
          </div>
        ) : (
          <div className="cipher-card mt-3">
            {txs.map((t, idx) => {
              const outgoing = t.from === activeDemoWallet;
              const sign = outgoing ? "−" : "+";
              const direction = outgoing ? "→" : "←";
              const counterpart = outgoing ? t.to : t.from;
              return (
                <div
                  key={t.id}
                  className={`flex items-center gap-3 py-3 ${
                    idx === txs.length - 1
                      ? ""
                      : "border-b border-[color:var(--color-border-subtle)]"
                  }`}
                >
                  <div
                    className={`w-6 text-center text-[14px] ${
                      outgoing
                        ? "text-[color:var(--color-text-muted)]"
                        : "text-[color:var(--color-emerald)]"
                    }`}
                  >
                    {direction}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium text-[color:var(--color-text-primary)]">
                      {outgoing ? `To: ${capitalize(counterpart)}` : `From: ${capitalize(counterpart)}`}
                    </div>
                    <div className="mt-1 max-w-[280px] truncate text-[12px] italic text-[color:var(--color-text-secondary)]">
                      {t.memo}
                    </div>
                  </div>
                  <div className="text-right">
                    <div
                      className={`font-mono text-[13px] font-medium tabular-nums ${
                        outgoing
                          ? "text-[color:var(--color-text-secondary)]"
                          : "text-[color:var(--color-emerald)]"
                      }`}
                    >
                      {sign}
                      {t.amount.toFixed(2)} {t.token}
                    </div>
                    <div className="mt-1 text-[11px] text-[color:var(--color-text-muted)]">
                      {relativeTime(t.timestamp)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function capitalize(value: string) {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function ShieldedBalanceReal() {
  const wallet = useWallet();
  const { connection } = useConnection();
  const { selectedToken, setSelectedToken, balances, isLoading, error, refresh } =
    useTokenBalances();
  const { checkAddress } = useComplianceCheck();
  const { notifications } = useNotifications();
  const prices = usePrices();
  const { history: txHistory, isLoading: historyLoading, refresh: refreshHistory } =
    useShieldedHistory();

  type Panel = "shield" | "swap" | "send" | "unshield" | null;
  type TxState = { status: "idle" | "pending" | "success" | "error"; message: string; sig: string | null };

  const [openPanel, setOpenPanel] = useState<Panel>(null);
  const [shieldSubTab, setShieldSubTab] = useState<"direct" | "swap">("direct");

  const [shieldAmount, setShieldAmount] = useState("");
  const [swapTx, setSwapTx] = useState<TxState>({ status: "idle", message: "", sig: null });
  const [sendRecipient, setSendRecipient] = useState("");
  const [sendAmount, setSendAmount] = useState("");
  const [unshieldAmount, setUnshieldAmount] = useState("");

  const [shieldTx, setShieldTx] = useState<TxState>({ status: "idle", message: "", sig: null });
  const [sendTx, setSendTx] = useState<TxState>({ status: "idle", message: "", sig: null });
  const [unshieldTx, setUnshieldTx] = useState<TxState>({ status: "idle", message: "", sig: null });

  type SwapToken = "SOL" | "USDC" | "BONK" | "JTO" | "JUP" | "RAY";
  const [swapFromToken, setSwapFromToken] = useState<SwapToken>("SOL");
  const [swapFromAmount, setSwapFromAmount] = useState("");
  const [quote, setQuote] = useState<JupiterQuote | null>(null);
  const [isQuoting, setIsQuoting] = useState(false);
  const [swapError, setSwapError] = useState<string | null>(null);
  const [swapSig, setSwapSig] = useState<string | null>(null);
  const [shieldAfterSwapSig, setShieldAfterSwapSig] = useState<string | null>(null);

  const [swapOnlyFromToken, setSwapOnlyFromToken] = useState<SwapToken>("SOL");
  const [swapOnlyToToken, setSwapOnlyToToken] = useState<SwapToken>("USDC");
  const [swapOnlyAmount, setSwapOnlyAmount] = useState("");
  const [swapOnlyQuote, setSwapOnlyQuote] = useState<JupiterQuote | null>(null);
  const [isSwapOnlyQuoting, setIsSwapOnlyQuoting] = useState(false);
  const [swapOnlyError, setSwapOnlyError] = useState<string | null>(null);
  const [swapOnlySig, setSwapOnlySig] = useState<string | null>(null);

  const current = balances[selectedToken];

  const isConnected = wallet.connected && !!wallet.publicKey;
  const publicBalance = current?.publicBalance ?? 0;
  const shieldedBalance = current?.shieldedBalance ?? 0;

  const rpcEndpoint = connection.rpcEndpoint ?? "";
  const isDevnetRpc = /devnet/i.test(rpcEndpoint) || /localhost/i.test(rpcEndpoint);
  const explorerCluster: SolanaCluster = isDevnetRpc ? "devnet" : "mainnet-beta";
  const jupiterApiKey = (process.env.NEXT_PUBLIC_JUPITER_API_KEY ?? "").trim();
  const canSwapViaJupiter = !isDevnetRpc && jupiterApiKey.length > 0;
  const swapDisabledReason =
    isDevnetRpc
      ? "Swaps require mainnet + NEXT_PUBLIC_JUPITER_API_KEY (Jupiter Ultra is mainnet-only)"
      : jupiterApiKey.length === 0
        ? "Set NEXT_PUBLIC_JUPITER_API_KEY to enable swaps"
        : null;

  const tokenConfig = useMemo(() => {
    if (selectedToken === "SOL") {
      return { symbol: "SOL" as const, mint: null, decimals: SOL_DECIMALS };
    }
    return { symbol: "USDC" as const, mint: isDevnetRpc ? USDC_MINT_DEVNET : USDC_MINT_MAINNET, decimals: USDC_DECIMALS };
  }, [selectedToken, isDevnetRpc]);

  const [recipientRisk, setRecipientRisk] = useState<RiskCheckResult | null>(null);
  const [isCheckingRecipient, setIsCheckingRecipient] = useState(false);

  // SNS .sol domain resolution
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
  const [isResolvingDomain, setIsResolvingDomain] = useState(false);
  const [domainError, setDomainError] = useState<string | null>(null);

  const recipientValidation = useMemo(() => {
    if (openPanel !== "send") return { isValid: true, recipient: null as PublicKey | null };
    const input = sendRecipient.trim();
    if (!input) return { isValid: false, recipient: null as PublicKey | null };
    // If it's a .sol domain, use resolved address (may be null while resolving)
    if (isSolDomain(input)) {
      if (!resolvedAddress) return { isValid: false, recipient: null as PublicKey | null };
      try {
        return { isValid: true, recipient: new PublicKey(resolvedAddress) };
      } catch {
        return { isValid: false, recipient: null as PublicKey | null };
      }
    }
    try {
      return { isValid: true, recipient: new PublicKey(input) };
    } catch {
      return { isValid: false, recipient: null as PublicKey | null };
    }
  }, [openPanel, sendRecipient, resolvedAddress]);

  useEffect(() => {
    if (openPanel !== "send") {
      setRecipientRisk(null);
      setIsCheckingRecipient(false);
      return;
    }

    const rawInput = sendRecipient.trim();
    const address = isSolDomain(rawInput) ? resolvedAddress ?? "" : rawInput;
    setRecipientRisk(null);
    setIsCheckingRecipient(false);

    if (!address) return;
    if (!recipientValidation.isValid) return;

    const timer = setTimeout(() => {
      void (async () => {
        setIsCheckingRecipient(true);
        try {
          const result = await checkAddress(address);
          setRecipientRisk(result);
        } catch (e: unknown) {
          const message =
            e instanceof Error ? e.message : typeof e === "string" ? e : JSON.stringify(e);
          setRecipientRisk({
            address,
            riskLevel: "unknown",
            isFlagged: false,
            reason: message,
            checkedAt: Date.now(),
            mock: false,
          });
        } finally {
          setIsCheckingRecipient(false);
        }
      })();
    }, 600);

    return () => clearTimeout(timer);
  }, [checkAddress, openPanel, recipientValidation.isValid, resolvedAddress, sendRecipient]);

  // SNS .sol domain resolution
  useEffect(() => {
    if (openPanel !== "send") {
      setResolvedAddress(null);
      setDomainError(null);
      return;
    }

    const input = sendRecipient.trim();
    if (!isSolDomain(input)) {
      setResolvedAddress(null);
      setDomainError(null);
      return;
    }

    setIsResolvingDomain(true);
    setResolvedAddress(null);
    setDomainError(null);

    const timer = setTimeout(() => {
      void (async () => {
        const addr = await resolveSolDomain(input);
        setIsResolvingDomain(false);
        if (addr) {
          setResolvedAddress(addr);
        } else {
          setDomainError(`Could not resolve ${input}`);
        }
      })();
    }, 500);

    return () => clearTimeout(timer);
  }, [openPanel, sendRecipient]);

  useEffect(() => {
    const latest = notifications[0];
    if (!latest) return;
    const timer = setTimeout(() => {
      void refresh();
      void refreshHistory();
    }, 2000);
    return () => clearTimeout(timer);
  }, [notifications, refresh, refreshHistory]);

  function resetPanels() {
    setOpenPanel(null);
    setShieldSubTab("direct");
    setShieldAmount("");
    setResolvedAddress(null);
    setDomainError(null);
    setSwapTx({ status: "idle", message: "", sig: null });
    setSendRecipient("");
    setSendAmount("");
    setUnshieldAmount("");
    setSwapFromToken("SOL");
    setSwapFromAmount("");
    setQuote(null);
    setIsQuoting(false);
    setSwapError(null);
    setSwapSig(null);
    setShieldAfterSwapSig(null);
    setSwapOnlyFromToken("SOL");
    setSwapOnlyToToken("USDC");
    setSwapOnlyAmount("");
    setSwapOnlyQuote(null);
    setIsSwapOnlyQuoting(false);
    setSwapOnlyError(null);
    setSwapOnlySig(null);
    setShieldTx({ status: "idle", message: "", sig: null });
    setSendTx({ status: "idle", message: "", sig: null });
    setUnshieldTx({ status: "idle", message: "", sig: null });
  }

  function truncateSig(sig: string) {
    return sig.length <= 8 ? sig : `${sig.slice(0, 8)}...`;
  }

  function parseAmount(value: string) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return null;
    return n;
  }

  async function handleShield() {
    if (!isConnected || !wallet.publicKey) {
      setShieldTx({ status: "error", message: "Connect wallet to continue", sig: null });
      return;
    }
    const amt = parseAmount(shieldAmount);
    if (!amt) {
      setShieldTx({ status: "error", message: "Invalid amount", sig: null });
      return;
    }
    if (amt > publicBalance) {
      setShieldTx({ status: "error", message: `Insufficient ${tokenConfig.symbol} balance`, sig: null });
      return;
    }

    setShieldTx({ status: "pending", message: "", sig: null });
    try {
      const sig = await compressToken({
        rpc: lightRpc,
        connection,
        wallet,
        mint: tokenConfig.mint,
        amount: amt,
        decimals: tokenConfig.decimals,
      });
      setShieldTx({ status: "success", message: "", sig });
      await refresh();
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : typeof e === "string" ? e : JSON.stringify(e);
      setShieldTx({ status: "error", message, sig: null });
    }
  }

  const SWAP_TOKEN_CONFIG: Record<SwapToken, { mint: string; decimals: number }> = useMemo(
    () => ({
      SOL: { mint: "So11111111111111111111111111111111111111112", decimals: 9 },
      USDC: {
        mint: isDevnetRpc
          ? USDC_MINT_DEVNET.toBase58()
          : USDC_MINT_MAINNET.toBase58(),
        decimals: 6,
      },
      BONK: { mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", decimals: 5 },
      JTO: { mint: "jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL", decimals: 9 },
      JUP: { mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN", decimals: 6 },
      RAY: { mint: "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S8V3cA5HcjV9nK", decimals: 6 },
    }),
    [isDevnetRpc],
  );

  const swapOutput = useMemo(() => {
    if (tokenConfig.symbol === "SOL") {
      return {
        mint: "So11111111111111111111111111111111111111112",
        decimals: SOL_DECIMALS,
        symbol: "SOL" as const,
      };
    }
    return { mint: (isDevnetRpc ? USDC_MINT_DEVNET : USDC_MINT_MAINNET).toBase58(), decimals: USDC_DECIMALS, symbol: "USDC" as const };
  }, [tokenConfig.symbol, isDevnetRpc]);

  useEffect(() => {
    if (openPanel !== "swap") return;
    if (!wallet.publicKey) return;
    if (!canSwapViaJupiter) {
      setSwapOnlyQuote(null);
      setSwapOnlyError(swapDisabledReason ?? "Swaps unavailable");
      setIsSwapOnlyQuoting(false);
      return;
    }

    if (swapOnlyFromToken === swapOnlyToToken) {
      setSwapOnlyQuote(null);
      setSwapOnlyError("Select two different tokens");
      setIsSwapOnlyQuoting(false);
      return;
    }

    const amtUi = Number(swapOnlyAmount);
    if (!Number.isFinite(amtUi) || amtUi <= 0) {
      setSwapOnlyQuote(null);
      setSwapOnlyError(swapDisabledReason);
      setIsSwapOnlyQuoting(false);
      return;
    }

    const inputCfg = SWAP_TOKEN_CONFIG[swapOnlyFromToken];
    const outputCfg = SWAP_TOKEN_CONFIG[swapOnlyToToken];
    const raw = Math.floor(amtUi * 10 ** inputCfg.decimals);
    if (!Number.isFinite(raw) || raw <= 0) {
      setSwapOnlyQuote(null);
      setSwapOnlyError(swapDisabledReason);
      setIsSwapOnlyQuoting(false);
      return;
    }

    setIsSwapOnlyQuoting(true);
    setSwapOnlyError(null);

    const timer = setTimeout(() => {
      void (async () => {
        try {
          const res = await getJupiterQuoteResult({
            inputMint: inputCfg.mint,
            outputMint: outputCfg.mint,
            amount: raw,
            slippageBps: 50,
            taker: wallet.publicKey?.toBase58(),
          });
          setSwapOnlyQuote(res.quote);
          if (!res.quote) setSwapOnlyError(res.error ?? "No route found for this pair");
        } catch (e: unknown) {
          const message =
            e instanceof Error ? e.message : typeof e === "string" ? e : JSON.stringify(e);
          setSwapOnlyQuote(null);
          setSwapOnlyError(message);
        } finally {
          setIsSwapOnlyQuoting(false);
        }
      })();
    }, 800);

    return () => clearTimeout(timer);
  }, [
    SWAP_TOKEN_CONFIG,
    canSwapViaJupiter,
    openPanel,
    swapDisabledReason,
    swapOnlyAmount,
    swapOnlyFromToken,
    swapOnlyToToken,
    wallet.publicKey,
  ]);

  useEffect(() => {
    if (openPanel !== "shield") return;
    if (shieldSubTab !== "swap") return;
    if (!canSwapViaJupiter) {
      setQuote(null);
      setSwapError(swapDisabledReason ?? "Swaps unavailable");
      setIsQuoting(false);
      return;
    }

    const amtUi = Number(swapFromAmount);
    if (!Number.isFinite(amtUi) || amtUi <= 0) {
      setQuote(null);
      setSwapError(swapDisabledReason);
      setIsQuoting(false);
      return;
    }

    const inputCfg = SWAP_TOKEN_CONFIG[swapFromToken];
    const raw = Math.floor(amtUi * 10 ** inputCfg.decimals);
    if (!Number.isFinite(raw) || raw <= 0) {
      setQuote(null);
      setSwapError(swapDisabledReason);
      setIsQuoting(false);
      return;
    }

    setIsQuoting(true);
    setSwapError(null);

    const timer = setTimeout(() => {
      void (async () => {
        try {
          const res = await getJupiterQuoteResult({
            inputMint: inputCfg.mint,
            outputMint: swapOutput.mint,
            amount: raw,
            slippageBps: 50,
            taker: wallet.publicKey?.toBase58(),
          });
          setQuote(res.quote);
          if (!res.quote) setSwapError(res.error ?? "No route found for this pair");
        } catch (e: unknown) {
          const message =
            e instanceof Error ? e.message : typeof e === "string" ? e : JSON.stringify(e);
          setQuote(null);
          setSwapError(message);
        } finally {
          setIsQuoting(false);
        }
      })();
    }, 800);

    return () => clearTimeout(timer);
  }, [
    SWAP_TOKEN_CONFIG,
    canSwapViaJupiter,
    openPanel,
    shieldSubTab,
    swapDisabledReason,
    swapFromAmount,
    swapFromToken,
    swapOutput.mint,
    wallet.publicKey,
  ]);

  async function handleSwapAndShield() {
    if (!isConnected || !wallet.publicKey) {
      setSwapError("Connect wallet to continue");
      return;
    }
    if (!quote) {
      setSwapError("No route found for this pair");
      return;
    }

    setSwapError(null);
    setSwapSig(null);
    setShieldAfterSwapSig(null);

    setShieldTx({ status: "pending", message: "Swapping via Jupiter...", sig: null });
    try {
      const sig = await executeJupiterSwap({ quote, wallet, connection });
      setSwapSig(sig);

      if (swapOutput.symbol === "SOL") {
        try {
          const wsolMint = new PublicKey(swapOutput.mint);
          const ata = await getAssociatedTokenAddress(wsolMint, wallet.publicKey);
          const bal = await connection.getTokenAccountBalance(ata, "confirmed").catch(() => null);
          const ui = bal?.value.uiAmount ?? 0;
          if (ui > 0) {
            const tx = new Transaction().add(
              createCloseAccountInstruction(ata, wallet.publicKey, wallet.publicKey),
            );
            const closeSig = await wallet.sendTransaction(tx, connection, { skipPreflight: true });
            await connection.confirmTransaction(closeSig, "confirmed");
          }
        } catch {
          // ignore
        }
      }

      const outRaw = Number(quote.outAmount);
      const outUi = outRaw / 10 ** swapOutput.decimals;
      if (!Number.isFinite(outUi) || outUi <= 0) {
        throw new Error("Swap returned invalid output amount");
      }

      setShieldTx({ status: "pending", message: "Shielding swapped funds...", sig: null });
      const shieldSig = await compressToken({
        rpc: lightRpc,
        connection,
        wallet,
        mint: swapOutput.symbol === "SOL" ? null : (isDevnetRpc ? USDC_MINT_DEVNET : USDC_MINT_MAINNET),
        amount: outUi,
        decimals: swapOutput.decimals,
      });
      setShieldAfterSwapSig(shieldSig);
      setShieldTx({ status: "success", message: "Swap & Shield complete", sig: shieldSig });
      void refresh();
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : typeof e === "string" ? e : JSON.stringify(e);
      setShieldTx({ status: "error", message, sig: null });
      setSwapError(message);
    }
  }

  async function handleSwapOnly() {
    if (!isConnected || !wallet.publicKey) {
      setSwapTx({ status: "error", message: "Connect wallet to continue", sig: null });
      return;
    }
    if (!swapOnlyQuote) {
      setSwapTx({ status: "error", message: swapOnlyError ?? "No route found for this pair", sig: null });
      return;
    }

    setSwapTx({ status: "pending", message: "Swapping via Jupiter...", sig: null });
    setSwapOnlySig(null);

    try {
      const sig = await executeJupiterSwap({ quote: swapOnlyQuote, wallet, connection });
      setSwapOnlySig(sig);

      try {
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
        await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
      } catch {
        // ignore
      }

      if (swapOnlyToToken === "SOL") {
        try {
          const wsolMint = new PublicKey(SWAP_TOKEN_CONFIG.SOL.mint);
          const ata = await getAssociatedTokenAddress(wsolMint, wallet.publicKey);
          const bal = await connection.getTokenAccountBalance(ata, "confirmed").catch(() => null);
          const ui = bal?.value.uiAmount ?? 0;
          if (ui > 0) {
            const tx = new Transaction().add(
              createCloseAccountInstruction(ata, wallet.publicKey, wallet.publicKey),
            );
            const closeSig = await wallet.sendTransaction(tx, connection, { skipPreflight: true });
            await connection.confirmTransaction(closeSig, "confirmed");
          }
        } catch {
          // ignore
        }
      }

      setSwapTx({ status: "success", message: "", sig });
      void refresh();
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : typeof e === "string" ? e : JSON.stringify(e);
      setSwapTx({ status: "error", message, sig: null });
      setSwapOnlyError(message);
    }
  }

  async function handleSend() {
    if (!isConnected || !wallet.publicKey) {
      setSendTx({ status: "error", message: "Connect wallet to continue", sig: null });
      return;
    }
    if (!recipientValidation.isValid || !recipientValidation.recipient) {
      setSendTx({ status: "error", message: "Invalid address", sig: null });
      return;
    }
    if (recipientRisk?.riskLevel === "flagged") {
      setSendTx({
        status: "error",
        message: "Address flagged — transfer blocked",
        sig: null,
      });
      return;
    }
    const amt = parseAmount(sendAmount);
    if (!amt) {
      setSendTx({ status: "error", message: "Invalid amount", sig: null });
      return;
    }
    if (amt > shieldedBalance) {
      setSendTx({ status: "error", message: `Insufficient ${tokenConfig.symbol} balance`, sig: null });
      return;
    }

    setSendTx({ status: "pending", message: "", sig: null });
    try {
      const sig = await transferCompressedToken({
        rpc: lightRpc,
        connection,
        wallet,
        mint: tokenConfig.mint,
        amount: amt,
        decimals: tokenConfig.decimals,
        recipient: recipientValidation.recipient,
      });
      setSendTx({ status: "success", message: "", sig });
      await refresh();
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : typeof e === "string" ? e : JSON.stringify(e);
      setSendTx({ status: "error", message, sig: null });
    }
  }

  async function handleUnshield() {
    if (!isConnected || !wallet.publicKey) {
      setUnshieldTx({ status: "error", message: "Connect wallet to continue", sig: null });
      return;
    }
    const amt = parseAmount(unshieldAmount);
    if (!amt) {
      setUnshieldTx({ status: "error", message: "Invalid amount", sig: null });
      return;
    }
    if (amt > shieldedBalance) {
      setUnshieldTx({
        status: "error",
        message: `Insufficient ${tokenConfig.symbol} shielded balance`,
        sig: null,
      });
      return;
    }

    setUnshieldTx({ status: "pending", message: "", sig: null });
    try {
      const sig = await decompressToken({
        rpc: lightRpc,
        connection,
        wallet,
        mint: tokenConfig.mint,
        amount: amt,
        decimals: tokenConfig.decimals,
      });
      setUnshieldTx({ status: "success", message: "", sig });
      await refresh();
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : typeof e === "string" ? e : JSON.stringify(e);
      setUnshieldTx({ status: "error", message, sig: null });
    }
  }

  return (
    <div className="space-y-6 pb-24 md:pb-0">
      <style jsx global>{`
        @keyframes cipherAmountPulse {
          0% {
            opacity: 0.4;
          }
          50% {
            opacity: 1;
          }
          100% {
            opacity: 0.4;
          }
        }
        .cipher-amount-pulse {
          animation: cipherAmountPulse 1.2s ease-in-out infinite;
        }
        @keyframes cipherCompliancePulse {
          0% {
            opacity: 1;
          }
          50% {
            opacity: 0.4;
          }
          100% {
            opacity: 1;
          }
        }
        .cipher-compliance-dot {
          animation: cipherCompliancePulse 1.5s ease-in-out infinite;
        }
      `}</style>

      <div className="flex items-center justify-between gap-4">
        <TokenSelector
          selected={selectedToken}
          onChange={(t) => {
            setSelectedToken(t as TokenSymbol);
            resetPanels();
          }}
        />
        <button
          type="button"
          onClick={() => void refresh()}
          className="cipher-btn-ghost text-[12px] px-3 py-1"
        >
          <span className="inline-flex items-center gap-2">
            <span className={isLoading ? "animate-spin" : ""}>↻</span>
            Refresh
          </span>
        </button>
      </div>

      <div className="cipher-card-accent-left">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <div className="cipher-label">SHIELDED BALANCE</div>
            <div className="mt-1.5 font-mono text-[32px] font-medium text-[color:var(--color-text-primary)] tabular-nums">
              {isLoading ? (
                <span className="cipher-amount-pulse">——</span>
              ) : (
                <span>
                  {shieldedBalance.toFixed(4)} {tokenConfig.symbol}
                </span>
              )}
            </div>
            {prices && shieldedBalance > 0 && (
              <div className="mt-1 font-mono text-[13px] text-[color:var(--color-text-muted)]">
                ≈ ${(shieldedBalance * (prices[tokenConfig.symbol] ?? 0)).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
              </div>
            )}
            <div className="mt-1 font-mono text-[13px] text-[color:var(--color-text-muted)]">
              Wallet: {publicBalance.toFixed(4)} {tokenConfig.symbol}
              {prices && publicBalance > 0 && (
                <span className="ml-1 opacity-60">
                  (≈ ${(publicBalance * (prices[tokenConfig.symbol] ?? 0)).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                </span>
              )}
            </div>
          </div>

          <div
            className={`opacity-90 ${
              tokenConfig.symbol === "SOL"
                ? "text-[color:var(--color-emerald)]"
                : "text-[color:var(--color-accent)]"
            }`}
          >
            <ShieldLarge />
          </div>
        </div>
      </div>

      {error && (
        <div className="text-[13px] text-[color:var(--color-amber)]">⚠ {error}</div>
      )}

      <div className="flex gap-3">
        <button
          onClick={() => {
            setOpenPanel(openPanel === "shield" ? null : "shield");
            setShieldTx({ status: "idle", message: "", sig: null });
          }}
          disabled={!isConnected}
          className="cipher-btn-ghost flex-1 py-[14px] px-0 text-[13px] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-text-primary)] disabled:opacity-50"
          type="button"
        >
          <div className="font-mono">Shield ↓</div>
        </button>
        <button
          onClick={() => {
            setOpenPanel(openPanel === "swap" ? null : "swap");
            setSwapTx({ status: "idle", message: "", sig: null });
          }}
          disabled={!isConnected}
          className="cipher-btn-ghost flex-1 py-[14px] px-0 text-[13px] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-text-primary)] disabled:opacity-50"
          type="button"
        >
          <div className="font-mono">Swap ↔</div>
        </button>
        <button
          onClick={() => {
            setOpenPanel(openPanel === "send" ? null : "send");
            setSendTx({ status: "idle", message: "", sig: null });
          }}
          disabled={!isConnected}
          className="cipher-btn-ghost flex-1 py-[14px] px-0 text-[13px] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-text-primary)] disabled:opacity-50"
          type="button"
        >
          <div className="font-mono">Send →</div>
        </button>
        <button
          onClick={() => {
            setOpenPanel(openPanel === "unshield" ? null : "unshield");
            setUnshieldTx({ status: "idle", message: "", sig: null });
          }}
          disabled={!isConnected}
          className="cipher-btn-ghost flex-1 py-[14px] px-0 text-[13px] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-text-primary)] disabled:opacity-50"
          type="button"
        >
          <div className="font-mono">Unshield ↑</div>
        </button>
      </div>

      {!isConnected && (
        <div className="cipher-card-accent-left mt-3">
          <div className="text-[14px] text-[color:var(--color-text-primary)] font-medium">
            Connect wallet to continue
          </div>
          <div className="mt-1 text-[13px] text-[color:var(--color-text-secondary)]">
            Shielding, private sends, and unshielding require a connected wallet.
          </div>
        </div>
      )}

      {openPanel === "shield" && (
        <div className="cipher-card mt-3">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[15px] font-medium text-[color:var(--color-text-primary)]">
                {shieldSubTab === "direct"
                  ? `Shield ${tokenConfig.symbol}`
                  : `Swap & Shield ${tokenConfig.symbol}`}
              </div>
              <div className="mt-1 text-[13px] text-[color:var(--color-text-secondary)]">
                {shieldSubTab === "direct"
                  ? `Move ${tokenConfig.symbol} from your wallet into your shielded balance`
                  : `Swap any token into ${tokenConfig.symbol}, then shield it`}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpenPanel(null)}
              className="cipher-btn-ghost h-[30px] w-[30px] px-0 py-0 text-[14px]"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <div className="mt-4 inline-flex rounded-[10px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-[3px]">
            <button
              type="button"
              onClick={() => setShieldSubTab("direct")}
              className={`cursor-pointer rounded-[8px] px-[14px] py-[7px] text-[13px] font-medium transition-all duration-150 ${
                shieldSubTab === "direct"
                  ? "bg-[color:var(--color-accent)] text-white"
                  : "text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)]"
              }`}
            >
              Shield directly
            </button>
            <button
              type="button"
              onClick={() => setShieldSubTab("swap")}
              className={`cursor-pointer rounded-[8px] px-[14px] py-[7px] text-[13px] font-medium transition-all duration-150 ${
                shieldSubTab === "swap"
                  ? "bg-[color:var(--color-accent)] text-white"
                  : "text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)]"
              }`}
            >
              Swap &amp; Shield
            </button>
          </div>

          {shieldSubTab === "direct" && (
            <>
              <div className="mt-5 space-y-2">
                <div className="cipher-label">AMOUNT</div>
                <div className="cipher-input flex items-center gap-2 px-3 py-2">
                  <input
                    type="number"
                    min={0}
                    step="0.000001"
                    value={shieldAmount}
                    onChange={(e) => setShieldAmount(e.target.value)}
                    className="min-w-0 flex-1 bg-transparent font-mono text-[13px] text-[color:var(--color-text-primary)] outline-none"
                    placeholder="0"
                  />
                  <span className="font-mono text-[12px] text-[color:var(--color-text-muted)]">
                    {tokenConfig.symbol}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 text-[12px] text-[color:var(--color-text-muted)]">
                  <div>
                    Available: {publicBalance.toFixed(4)} {tokenConfig.symbol}
                  </div>
                  <button
                    type="button"
                    className="cipher-btn-ghost h-[26px] px-3 py-0 text-[12px]"
                    onClick={() => setShieldAmount(publicBalance.toFixed(6))}
                  >
                    Max
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => void handleShield()}
                disabled={shieldTx.status === "pending" || !isConnected}
                className="cipher-btn-primary mt-5 w-full disabled:opacity-50"
              >
                <span className="inline-flex items-center justify-center gap-2">
                  {shieldTx.status === "pending" && <span className="animate-spin">↻</span>}
                  Shield {shieldAmount || "0"} {tokenConfig.symbol}
                </span>
              </button>
            </>
          )}

          {shieldSubTab === "swap" && (
            <>
              <div className="mt-5 space-y-2">
                <div className="cipher-label">SWAP FROM</div>
                <div className="flex items-center gap-3">
                  <select
                    className="cipher-input w-[140px] font-mono text-[13px]"
                    value={swapFromToken}
                    onChange={(e) => setSwapFromToken(e.target.value as SwapToken)}
                  >
                    <option value="SOL">SOL</option>
                    <option value="USDC">USDC</option>
                    <option value="BONK">BONK</option>
                    <option value="JTO">JTO</option>
                    <option value="JUP">JUP</option>
                    <option value="RAY">RAY</option>
                  </select>
                  <input
                    type="number"
                    min={0}
                    step="0.000001"
                    className="cipher-input flex-1"
                    placeholder="Amount"
                    value={swapFromAmount}
                    onChange={(e) => setSwapFromAmount(e.target.value)}
                  />
                </div>
              </div>

              <div className="my-3 text-center text-[12px] text-[color:var(--color-text-muted)]">
                <div className="mx-auto w-fit">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M12 5v14"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                    <path
                      d="M7 14l5 5 5-5"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                swaps to →
              </div>

              <div className="space-y-2">
                <div className="cipher-label">YOU RECEIVE (SHIELDED)</div>
                <div className="cipher-card bg-[color:var(--color-bg)]">
                  {isQuoting && (
                    <div className="text-[12px] text-[color:var(--color-text-muted)]">
                      Getting best price...
                    </div>
                  )}
                  {!isQuoting && quote && (
                    <>
                      <div className="font-mono text-[18px] text-[color:var(--color-text-primary)]">
                        {(Number(quote.outAmount) / 10 ** swapOutput.decimals).toFixed(6)}{" "}
                        {tokenConfig.symbol}
                      </div>
                      <div
                        className={`mt-2 text-[12px] ${
                          Number(quote.priceImpactPct) > 3
                            ? "text-[#EF4444]"
                            : Number(quote.priceImpactPct) > 1
                              ? "text-[color:var(--color-amber)]"
                              : "text-[color:var(--color-text-muted)]"
                        }`}
                      >
                        Price impact: {quote.priceImpactPct}%
                        {Number(quote.priceImpactPct) > 3 && (
                          <span className="ml-2">High price impact</span>
                        )}
                      </div>
                    </>
                  )}
                  {!isQuoting && !quote && (swapError || swapFromAmount.trim()) && (
                    <div className="text-[12px] text-[color:var(--color-text-muted)]">
                      {swapError ?? "No route found for this pair"}
                    </div>
                  )}
                </div>
              </div>

              <button
                type="button"
                className="cipher-btn-primary mt-5 w-full disabled:opacity-50"
                onClick={() => void handleSwapAndShield()}
                disabled={
                  !isConnected ||
                  !canSwapViaJupiter ||
                  shieldTx.status === "pending" ||
                  !quote ||
                  Number(swapFromAmount) <= 0
                }
              >
                <span className="inline-flex items-center justify-center gap-2">
                  {shieldTx.status === "pending" && <span className="animate-spin">↻</span>}
                  Swap &amp; Shield
                </span>
              </button>

              <div className="mt-2 text-[11px] text-[color:var(--color-text-muted)]">
                Powered by Jupiter Ultra · Best price across all Solana DEXs
              </div>

              {swapSig && (
                <div className="mt-4 rounded-lg border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg)] px-4 py-3 text-[12px] text-[color:var(--color-text-secondary)]">
                  Swap tx:{" "}
                  <a
                    href={getExplorerTxUrl(swapSig, explorerCluster)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[color:var(--color-accent)] underline underline-offset-2"
                  >
                    {truncateSig(swapSig)}
                  </a>
                </div>
              )}
              {shieldAfterSwapSig && (
                <div className="mt-2 rounded-lg border border-emerald-900/40 bg-emerald-950/30 px-4 py-3 text-[12px] text-emerald-200">
                  Shield tx:{" "}
                  <a
                    href={getExplorerTxUrl(shieldAfterSwapSig, explorerCluster)}
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-2"
                  >
                    {truncateSig(shieldAfterSwapSig)}
                  </a>
                </div>
              )}
            </>
          )}

          {shieldTx.status === "success" && shieldTx.sig && (
            <div className="mt-4 rounded-lg border border-emerald-900/40 bg-emerald-950/30 px-4 py-3 text-[13px] text-emerald-200">
              <span className="mr-2">✓</span>
              <a
                href={getExplorerTxUrl(shieldTx.sig, explorerCluster)}
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2"
              >
                {truncateSig(shieldTx.sig)}
              </a>
            </div>
          )}

          {shieldTx.status === "error" && (
            <div className="mt-3 text-[13px] text-[color:var(--color-amber)]">
              {shieldTx.message}
            </div>
          )}
        </div>
      )}

      {openPanel === "swap" && (
        <div className="cipher-card mt-3">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[15px] font-medium text-[color:var(--color-text-primary)]">
                Swap tokens
              </div>
              <div className="mt-1 text-[13px] text-[color:var(--color-text-secondary)]">
                Swap any supported token in your wallet via Jupiter
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpenPanel(null)}
              className="cipher-btn-ghost h-[30px] w-[30px] px-0 py-0 text-[14px]"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <div className="mt-5 space-y-2">
            <div className="cipher-label">SWAP FROM</div>
            <div className="flex items-center gap-3">
              <select
                className="cipher-input w-[140px] font-mono text-[13px]"
                value={swapOnlyFromToken}
                onChange={(e) => setSwapOnlyFromToken(e.target.value as SwapToken)}
              >
                <option value="SOL">SOL</option>
                <option value="USDC">USDC</option>
                <option value="BONK">BONK</option>
                <option value="JTO">JTO</option>
                <option value="JUP">JUP</option>
                <option value="RAY">RAY</option>
              </select>
              <input
                type="number"
                min={0}
                step="0.000001"
                className="cipher-input flex-1"
                placeholder="Amount"
                value={swapOnlyAmount}
                onChange={(e) => setSwapOnlyAmount(e.target.value)}
              />
            </div>
          </div>

          <div className="my-3 text-center text-[12px] text-[color:var(--color-text-muted)]">
            <div className="mx-auto w-fit">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M12 5v14"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
                <path
                  d="M7 14l5 5 5-5"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            swaps to →
          </div>

          <div className="space-y-2">
            <div className="cipher-label">SWAP TO</div>
            <select
              className="cipher-input w-full font-mono text-[13px]"
              value={swapOnlyToToken}
              onChange={(e) => setSwapOnlyToToken(e.target.value as SwapToken)}
            >
              <option value="SOL">SOL</option>
              <option value="USDC">USDC</option>
              <option value="BONK">BONK</option>
              <option value="JTO">JTO</option>
              <option value="JUP">JUP</option>
              <option value="RAY">RAY</option>
            </select>
          </div>

          <div className="mt-4 space-y-2">
            <div className="cipher-label">YOU RECEIVE (EST.)</div>
            <div className="cipher-card bg-[color:var(--color-bg)]">
              {isSwapOnlyQuoting && (
                <div className="text-[12px] text-[color:var(--color-text-muted)]">
                  Getting best price...
                </div>
              )}
              {!isSwapOnlyQuoting && swapOnlyQuote && (
                <>
                  <div className="font-mono text-[18px] text-[color:var(--color-text-primary)]">
                    {(Number(swapOnlyQuote.outAmount) / 10 ** SWAP_TOKEN_CONFIG[swapOnlyToToken].decimals).toFixed(6)}{" "}
                    {swapOnlyToToken}
                  </div>
                  <div
                    className={`mt-2 text-[12px] ${
                      Number(swapOnlyQuote.priceImpactPct) > 3
                        ? "text-[#EF4444]"
                        : Number(swapOnlyQuote.priceImpactPct) > 1
                          ? "text-[color:var(--color-amber)]"
                          : "text-[color:var(--color-text-muted)]"
                    }`}
                  >
                    Price impact: {swapOnlyQuote.priceImpactPct}%
                    {Number(swapOnlyQuote.priceImpactPct) > 3 && (
                      <span className="ml-2">High price impact</span>
                    )}
                  </div>
                </>
              )}
              {!isSwapOnlyQuoting && !swapOnlyQuote && (swapOnlyError || swapOnlyAmount.trim()) && (
                <div className="text-[12px] text-[color:var(--color-text-muted)]">
                  {swapOnlyError ?? "No route found for this pair"}
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            className="cipher-btn-primary mt-5 w-full disabled:opacity-50"
            onClick={() => void handleSwapOnly()}
            disabled={
              !isConnected ||
              !canSwapViaJupiter ||
              swapTx.status === "pending" ||
              !swapOnlyQuote ||
              Number(swapOnlyAmount) <= 0 ||
              swapOnlyFromToken === swapOnlyToToken
            }
          >
            <span className="inline-flex items-center justify-center gap-2">
              {swapTx.status === "pending" && <span className="animate-spin">↻</span>}
              Swap
            </span>
          </button>

          <div className="mt-2 text-[11px] text-[color:var(--color-text-muted)]">
            Powered by Jupiter Ultra · Best price across all Solana DEXs
          </div>

          {swapOnlySig && (
            <div className="mt-4 rounded-lg border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg)] px-4 py-3 text-[12px] text-[color:var(--color-text-secondary)]">
              Swap tx:{" "}
              <a
                href={getExplorerTxUrl(swapOnlySig, explorerCluster)}
                target="_blank"
                rel="noreferrer"
                className="text-[color:var(--color-accent)] underline underline-offset-2"
              >
                {truncateSig(swapOnlySig)}
              </a>
            </div>
          )}

          {swapTx.status === "error" && (
            <div className="mt-3 text-[13px] text-[color:var(--color-amber)]">
              {swapTx.message}
            </div>
          )}
        </div>
      )}

      {openPanel === "send" && (
        <div className="cipher-card mt-3">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[15px] font-medium text-[color:var(--color-text-primary)]">
                Send {tokenConfig.symbol}
              </div>
              <div className="mt-1 text-[13px] text-[color:var(--color-text-secondary)]">
                Send {tokenConfig.symbol} privately from your shielded balance
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpenPanel(null)}
              className="cipher-btn-ghost h-[30px] w-[30px] px-0 py-0 text-[14px]"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <div className="mt-5 space-y-2">
            <div className="cipher-label">RECIPIENT ADDRESS</div>
            <input
              type="text"
              value={sendRecipient}
              onChange={(e) => setSendRecipient(e.target.value)}
              className="cipher-input w-full"
              placeholder="Solana address or .sol domain"
            />
            {isSolDomain(sendRecipient) && (
              <div className="text-[12px]">
                {isResolvingDomain && (
                  <span className="text-[color:var(--color-text-muted)]">Resolving {sendRecipient}…</span>
                )}
                {!isResolvingDomain && resolvedAddress && (
                  <span className="text-[color:var(--color-emerald)]">
                    ✓ Resolved: {resolvedAddress.slice(0, 8)}…{resolvedAddress.slice(-6)}
                  </span>
                )}
                {!isResolvingDomain && domainError && (
                  <span className="text-[color:var(--color-amber)]">{domainError}</span>
                )}
              </div>
            )}
            {sendRecipient.trim().length > 0 && !isSolDomain(sendRecipient) && !recipientValidation.isValid && (
              <div className="text-[12px] text-[color:var(--color-amber)]">Invalid address</div>
            )}

            {sendRecipient.trim().length > 0 && recipientValidation.isValid && (
              <div className="space-y-2">
                {isCheckingRecipient && (
                  <div className="flex items-center gap-2 text-[12px] text-[color:var(--color-text-muted)]">
                    <span className="cipher-compliance-dot h-[6px] w-[6px] rounded-full bg-[color:var(--color-amber)]" />
                    Checking address...
                  </div>
                )}

                {!isCheckingRecipient && recipientRisk?.riskLevel === "safe" && (
                  <div className="flex items-center gap-2 text-[12px] text-[color:var(--color-emerald)]">
                    <span className="h-[6px] w-[6px] rounded-full bg-[color:var(--color-emerald)]" />
                    <span>
                      Address cleared
                      {recipientRisk.mock && (
                        <span className="text-[color:var(--color-text-muted)]"> (mock mode)</span>
                      )}
                    </span>
                  </div>
                )}

                {!isCheckingRecipient && recipientRisk?.riskLevel === "unknown" && (
                  <div className="flex items-center gap-2 text-[12px] text-[color:var(--color-text-muted)]">
                    <span className="h-[6px] w-[6px] rounded-full bg-[color:var(--color-border)]" />
                    Unable to verify address — proceed with caution
                  </div>
                )}

                {!isCheckingRecipient && recipientRisk?.riskLevel === "flagged" && (
                  <>
                    <div className="flex items-center gap-2 text-[12px] text-[#EF4444]">
                      <span className="h-[6px] w-[6px] rounded-full bg-[#EF4444]" />
                      Address flagged — this wallet is associated with sanctioned or high-risk activity
                    </div>
                    <div className="mt-2 rounded-[var(--radius-md)] border border-[rgba(239,68,68,0.25)] bg-[rgba(239,68,68,0.08)] px-4 py-3">
                      <div className="flex items-start gap-3">
                        <div className="mt-[1px] text-[#EF4444]">
                          <WarningTriangle />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[13px] font-medium text-[#EF4444]">
                            Transaction blocked
                          </div>
                          <div className="mt-1 text-[12px] leading-[1.6] text-[color:var(--color-text-secondary)]">
                            Cipher Pay screens all recipient addresses against OFAC sanctions lists
                            and global risk databases via Range Protocol. This address cannot receive
                            funds.
                          </div>
                          <div className="mt-2">
                            <Link
                              href="/compliance"
                              className="text-[12px] text-[color:var(--color-accent)] hover:text-[color:var(--color-text-primary)] transition-colors duration-150 no-underline"
                            >
                              Learn about our compliance policy →
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="mt-5 space-y-2">
            <div className="cipher-label">AMOUNT</div>
            <div className="cipher-input flex items-center gap-2 px-3 py-2">
              <input
                type="number"
                min={0}
                step="0.000001"
                value={sendAmount}
                onChange={(e) => setSendAmount(e.target.value)}
                className="min-w-0 flex-1 bg-transparent font-mono text-[13px] text-[color:var(--color-text-primary)] outline-none"
                placeholder="0"
              />
              <span className="font-mono text-[12px] text-[color:var(--color-text-muted)]">
                {tokenConfig.symbol}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 text-[12px] text-[color:var(--color-text-muted)]">
              <div>
                Available: {shieldedBalance.toFixed(4)} {tokenConfig.symbol} (shielded)
              </div>
              <button
                type="button"
                className="cipher-btn-ghost h-[26px] px-3 py-0 text-[12px]"
                onClick={() => setSendAmount(shieldedBalance.toFixed(6))}
              >
                Max
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={
              sendTx.status === "pending" ||
              !isConnected ||
              !recipientValidation.isValid ||
              recipientRisk?.riskLevel === "flagged"
            }
            title={recipientRisk?.riskLevel === "flagged" ? "Address flagged — transfer blocked" : undefined}
            className={`cipher-btn-primary mt-5 w-full disabled:opacity-50 ${
              recipientRisk?.riskLevel === "flagged"
                ? "opacity-40 cursor-not-allowed pointer-events-none"
                : ""
            }`}
          >
            <span className="inline-flex items-center justify-center gap-2">
              {sendTx.status === "pending" && <span className="animate-spin">↻</span>}
              {recipientRisk?.riskLevel === "flagged"
                ? "Transfer blocked"
                : `Send ${sendAmount || "0"} ${tokenConfig.symbol}`}
            </span>
          </button>

          {sendTx.status === "success" && sendTx.sig && (
            <div className="mt-4 rounded-lg border border-emerald-900/40 bg-emerald-950/30 px-4 py-3 text-[13px] text-emerald-200">
              <span className="mr-2">✓</span>
              <a
                href={getExplorerTxUrl(sendTx.sig, explorerCluster)}
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2"
              >
                {truncateSig(sendTx.sig)}
              </a>
            </div>
          )}

          {sendTx.status === "error" && (
            <div className="mt-3 text-[13px] text-[color:var(--color-amber)]">
              {sendTx.message}
            </div>
          )}
        </div>
      )}

      {openPanel === "unshield" && (
        <div className="cipher-card mt-3">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[15px] font-medium text-[color:var(--color-text-primary)]">
                Unshield {tokenConfig.symbol}
              </div>
              <div className="mt-1 text-[13px] text-[color:var(--color-text-secondary)]">
                Move {tokenConfig.symbol} from your shielded balance back into your wallet
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpenPanel(null)}
              className="cipher-btn-ghost h-[30px] w-[30px] px-0 py-0 text-[14px]"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <div className="mt-5 space-y-2">
            <div className="cipher-label">AMOUNT</div>
            <div className="cipher-input flex items-center gap-2 px-3 py-2">
              <input
                type="number"
                min={0}
                step="0.000001"
                value={unshieldAmount}
                onChange={(e) => setUnshieldAmount(e.target.value)}
                className="min-w-0 flex-1 bg-transparent font-mono text-[13px] text-[color:var(--color-text-primary)] outline-none"
                placeholder="0"
              />
              <span className="font-mono text-[12px] text-[color:var(--color-text-muted)]">
                {tokenConfig.symbol}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 text-[12px] text-[color:var(--color-text-muted)]">
              <div>
                Available: {shieldedBalance.toFixed(4)} {tokenConfig.symbol} (shielded)
              </div>
              <button
                type="button"
                className="cipher-btn-ghost h-[26px] px-3 py-0 text-[12px]"
                onClick={() => setUnshieldAmount(shieldedBalance.toFixed(6))}
              >
                Max
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void handleUnshield()}
            disabled={unshieldTx.status === "pending" || !isConnected}
            className="cipher-btn-primary mt-5 w-full disabled:opacity-50"
          >
            <span className="inline-flex items-center justify-center gap-2">
              {unshieldTx.status === "pending" && <span className="animate-spin">↻</span>}
              Unshield {unshieldAmount || "0"} {tokenConfig.symbol}
            </span>
          </button>

          {unshieldTx.status === "success" && unshieldTx.sig && (
            <div className="mt-4 rounded-lg border border-emerald-900/40 bg-emerald-950/30 px-4 py-3 text-[13px] text-emerald-200">
              <span className="mr-2">✓</span>
              <a
                href={getExplorerTxUrl(unshieldTx.sig, explorerCluster)}
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2"
              >
                {truncateSig(unshieldTx.sig)}
              </a>
            </div>
          )}

          {unshieldTx.status === "error" && (
            <div className="mt-3 text-[13px] text-[color:var(--color-amber)]">
              {unshieldTx.message}
            </div>
          )}
        </div>
      )}

      <div className="pt-2">
        <div className="flex items-center justify-between gap-3">
          <div className="cipher-label">RECENT TRANSACTIONS</div>
          {!historyLoading && txHistory.length > 0 && (
            <button
              type="button"
              onClick={() => void refreshHistory()}
              className="cipher-btn-ghost text-[11px] px-2 py-0.5"
            >
              ↻
            </button>
          )}
        </div>

        {historyLoading && (
          <div className="cipher-card mt-3 text-center py-8">
            <div className="text-[13px] text-[color:var(--color-text-muted)] animate-pulse">
              Loading history…
            </div>
          </div>
        )}

        {!historyLoading && txHistory.length === 0 && (
          <div className="cipher-card mt-3 text-center py-10">
            <div className="mx-auto w-fit text-[color:var(--color-border)]">
              <LockSmall />
            </div>
            <div className="mt-3 text-[14px] text-[color:var(--color-text-muted)]">
              No shielded transactions yet
            </div>
            <div className="mt-1 text-[12px] text-[color:var(--color-text-muted)]">
              Shield, send, or unshield to see activity here
            </div>
          </div>
        )}

        {!historyLoading && txHistory.length > 0 && (
          <div className="cipher-card mt-3">
            {txHistory.map((tx, idx) => {
              const typeLabel =
                tx.type === "shield" ? "Shielded" :
                tx.type === "unshield" ? "Unshielded" :
                tx.type === "transfer" ? "Transfer" : "Activity";

              const typeColor =
                tx.type === "shield" ? "text-[color:var(--color-accent)]" :
                tx.type === "unshield" ? "text-[color:var(--color-amber)]" :
                tx.type === "transfer" ? "text-[color:var(--color-emerald)]" :
                "text-[color:var(--color-text-muted)]";

              const timeStr = new Date(tx.timestamp * 1000).toLocaleString(undefined, {
                month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
              });

              return (
                <div
                  key={tx.signature}
                  className={`flex items-center gap-3 py-3 ${
                    idx < txHistory.length - 1 ? "border-b border-[color:var(--color-border-subtle)]" : ""
                  }`}
                >
                  <div className={`w-6 text-center text-[13px] font-medium ${typeColor}`}>
                    {tx.type === "shield" ? "↓" : tx.type === "unshield" ? "↑" : "→"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={`text-[13px] font-medium ${typeColor}`}>{typeLabel}</div>
                    <div className="mt-0.5 text-[11px] text-[color:var(--color-text-muted)]">{timeStr}</div>
                  </div>
                  <div className="text-right">
                    <a
                      href={getExplorerTxUrl(tx.signature, explorerCluster)}
                      target="_blank"
                      rel="noreferrer"
                      className={`text-[11px] font-mono ${
                        tx.status === "failed"
                          ? "text-[color:var(--color-amber)]"
                          : "text-[color:var(--color-text-muted)]"
                      } hover:text-[color:var(--color-accent)] transition-colors`}
                    >
                      {tx.status === "failed" ? "failed" : tx.signature.slice(0, 8) + "…"}
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function ShieldLarge() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3 19 6.5v6.1c0 5.1-3.4 8.7-7 9.9-3.6-1.2-7-4.8-7-9.9V6.5L12 3Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M9.2 12.2 11 14l3.8-4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LockSmall() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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

function WarningTriangle() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 9v4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M12 17h.01"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M10.3 4.3 2.5 18a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}
