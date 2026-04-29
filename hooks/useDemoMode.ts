"use client";

import { createContext, createElement, useContext, useEffect, useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

export interface DemoWallet {
  publicKey: string;
  shieldedSOL: number;
  shieldedUSDC: number;
  publicSOL: number;
  publicUSDC: number;
}

export interface DemoTransaction {
  id: string;
  from: "alice" | "bob" | "carol";
  to: "alice" | "bob" | "carol";
  amount: number;
  token: "SOL" | "USDC";
  memo: string;
  timestamp: string;
  signature: string;
}

export interface DemoState {
  lastSeeded: string;
  wallets: Record<"alice" | "bob" | "carol", DemoWallet>;
  demoTransactions: DemoTransaction[];
}

type DemoModeContextValue = {
  demoState: DemoState | null;
  isDemoMode: boolean;
  activeDemoWallet: "alice" | "bob" | "carol";
  setActiveDemoWallet: (wallet: "alice" | "bob" | "carol") => void;
  isLoading: boolean;
};

const DemoModeContext = createContext<DemoModeContextValue | null>(null);

export function DemoModeProvider(props: { children: React.ReactNode }) {
  const { children } = props;
  const wallet = useWallet();

  const [demoState, setDemoState] = useState<DemoState | null>(null);
  const [activeDemoWallet, setActiveDemoWallet] = useState<"alice" | "bob" | "carol">("alice");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setIsLoading(true);
      try {
        const res = await fetch("/demo-state.json", { cache: "no-store" });
        if (!res.ok) {
          throw new Error(`Failed to load demo-state.json (${res.status})`);
        }
        const data = (await res.json()) as DemoState;
        if (mounted) setDemoState(data);
      } catch {
        if (mounted) setDemoState(null);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const isDemoMode = useMemo(() => {
    return !wallet.connected && !!demoState;
  }, [demoState, wallet.connected]);

  const value = useMemo<DemoModeContextValue>(
    () => ({
      demoState,
      isDemoMode,
      activeDemoWallet,
      setActiveDemoWallet,
      isLoading,
    }),
    [activeDemoWallet, demoState, isDemoMode, isLoading],
  );

  return createElement(DemoModeContext.Provider, { value }, children);
}

export function useDemoMode() {
  const ctx = useContext(DemoModeContext);
  if (!ctx) {
    throw new Error("useDemoMode must be used within DemoModeProvider");
  }
  return ctx;
}
