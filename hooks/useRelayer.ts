"use client";

import { useCallback, useEffect, useState } from "react";
import { getRelayerInfo } from "@/lib/solana/relayer";

export interface RelayerStatus {
  available: boolean;
  relayerPublicKey: string | null;
  checking: boolean;
}

/**
 * Hook that checks if the relayer is available and exposes its status.
 * When the relayer is available, users pay zero gas on transactions.
 */
export function useRelayer(): RelayerStatus {
  const [status, setStatus] = useState<RelayerStatus>({
    available: false,
    relayerPublicKey: null,
    checking: true,
  });

  const check = useCallback(async () => {
    try {
      const info = await getRelayerInfo();
      setStatus({
        available: true,
        relayerPublicKey: info.relayerPublicKey,
        checking: false,
      });
    } catch {
      setStatus({ available: false, relayerPublicKey: null, checking: false });
    }
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  return status;
}
