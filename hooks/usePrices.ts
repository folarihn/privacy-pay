"use client";

import { useEffect, useState } from "react";
import { getTokenPrices, type TokenPrices } from "@/lib/price-service";

const REFRESH_INTERVAL_MS = 30_000;

export function usePrices() {
  const [prices, setPrices] = useState<TokenPrices | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchPrices = async () => {
      try {
        const p = await getTokenPrices();
        if (!cancelled) setPrices(p);
      } catch {
        // fail silently — prices are decorative
      }
    };

    void fetchPrices();
    const id = setInterval(() => void fetchPrices(), REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return prices;
}
