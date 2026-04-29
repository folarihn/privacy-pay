const SOL_MINT = "So11111111111111111111111111111111111111112";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

export interface TokenPrices {
  SOL: number;
  USDC: number;
}

let cache: { prices: TokenPrices; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 30_000;

export async function getTokenPrices(): Promise<TokenPrices> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.prices;
  }

  try {
    const res = await fetch(
      `https://api.jup.ag/price/v2?ids=${SOL_MINT},${USDC_MINT}`,
      { headers: { Accept: "application/json" } },
    );

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = (await res.json()) as {
      data: Record<string, { price: string } | undefined>;
    };

    const solPrice = parseFloat(data.data[SOL_MINT]?.price ?? "0");
    const usdcPrice = parseFloat(data.data[USDC_MINT]?.price ?? "1");

    const prices: TokenPrices = {
      SOL: Number.isFinite(solPrice) ? solPrice : 0,
      USDC: Number.isFinite(usdcPrice) ? usdcPrice : 1,
    };

    cache = { prices, fetchedAt: Date.now() };
    return prices;
  } catch {
    return cache?.prices ?? { SOL: 0, USDC: 1 };
  }
}
