"use client";

import { useCallback, useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { getShieldedHistory, type ShieldedActivity } from "@/lib/solana/lightProtocol";

export function useShieldedHistory() {
  const wallet = useWallet();
  const [history, setHistory] = useState<ShieldedActivity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!wallet.publicKey) {
      setHistory([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const activities = await getShieldedHistory(wallet.publicKey);
      setHistory(activities);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : JSON.stringify(e);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [wallet.publicKey]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { history, isLoading, error, refresh };
}
