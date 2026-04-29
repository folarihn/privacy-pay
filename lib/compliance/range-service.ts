import { PublicKey } from "@solana/web3.js";
import { getCachedResult, setCachedResult } from "./cache";

export type RiskLevel = "safe" | "flagged" | "unknown";

export interface RiskCheckResult {
  address: string;
  riskLevel: RiskLevel;
  isFlagged: boolean;
  reason: string | null;
  checkedAt: number;
  mock: boolean;
}

export interface ComplianceCheckOptions {
  throwOnFlagged?: boolean;
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function isValidSolanaAddress(address: string) {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

function normalizeAddress(address: string) {
  return address.trim();
}

function parseRangeResponse(payload: unknown): { isFlagged: boolean; reason: string | null } {
  if (typeof payload !== "object" || payload === null) {
    return { isFlagged: false, reason: null };
  }

  const obj = payload as Record<string, unknown>;

  const flaggedField =
    obj.flagged ??
    obj.is_flagged ??
    obj.isFlagged ??
    obj.is_sanctioned ??
    obj.isSanctioned ??
    obj.sanctioned ??
    obj.is_ofac_sanctioned ??
    obj.is_token_blacklisted;

  const riskScore =
    typeof obj.riskScore === "number"
      ? obj.riskScore
      : typeof obj.risk_score === "number"
        ? obj.risk_score
        : null;

  const riskLevelStr = typeof obj.riskLevel === "string" ? obj.riskLevel : null;
  const reasoningStr = typeof obj.reasoning === "string" ? obj.reasoning : null;

  const isFlagged = (() => {
    if (typeof flaggedField === "boolean") return flaggedField;
    if (typeof riskScore === "number") return riskScore >= 8;
    if (typeof riskLevelStr === "string") {
      const t = riskLevelStr.toLowerCase();
      if (t.includes("critical")) return true;
      if (t.includes("extremely high")) return true;
    }
    return false;
  })();

  const reasonCandidate =
    (typeof obj.reason === "string" && obj.reason) ||
    reasoningStr ||
    riskLevelStr ||
    (typeof obj.category === "string" && obj.category) ||
    (typeof obj.label === "string" && obj.label) ||
    null;

  return {
    isFlagged,
    reason: isFlagged ? reasonCandidate ?? "Flagged by Range risk screening" : null,
  };
}

export async function checkAddressRisk(
  address: string,
  options?: ComplianceCheckOptions,
): Promise<RiskCheckResult> {
  const normalized = normalizeAddress(address);

  if (!isValidSolanaAddress(normalized)) {
    throw new Error("Invalid Solana address");
  }

  const cached = getCachedResult(normalized);
  if (cached) return cached;

  const apiKey = (process.env.RANGE_API_KEY ?? "").trim();
  const apiUrl = (process.env.RANGE_API_URL ?? "https://api.range.org/v1").trim().replace(/\/+$/g, "");

  if (!apiKey) {
    console.warn(
      "[Compliance] Running in mock mode — set RANGE_API_KEY in .env.local for real screening",
    );

    const result: RiskCheckResult = {
      address: normalized,
      riskLevel: "safe",
      isFlagged: false,
      reason: null,
      checkedAt: Date.now(),
      mock: true,
    };
    setCachedResult(normalized, result);
    return result;
  }

  try {
    const url = `${apiUrl}/risk/address?address=${encodeURIComponent(normalized)}&network=solana`;
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-App-Name": "cipher-pay",
      },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[Compliance] Range API error:", res.status, res.statusText, text);

      const result: RiskCheckResult = {
        address: normalized,
        riskLevel: "unknown",
        isFlagged: false,
        reason: `Range API error: ${res.status} ${res.statusText}`,
        checkedAt: Date.now(),
        mock: false,
      };
      setCachedResult(normalized, result);
      return result;
    }

    const payload = (await res.json()) as unknown;
    const parsed = parseRangeResponse(payload);

    const result: RiskCheckResult = {
      address: normalized,
      riskLevel: parsed.isFlagged ? "flagged" : "safe",
      isFlagged: parsed.isFlagged,
      reason: parsed.reason,
      checkedAt: Date.now(),
      mock: false,
    };

    setCachedResult(normalized, result);

    if (options?.throwOnFlagged && result.isFlagged) {
      throw new Error(`Address ${normalized.slice(0, 8)}... flagged by compliance screening`);
    }

    return result;
  } catch (error: unknown) {
    if (
      options?.throwOnFlagged &&
      error instanceof Error &&
      error.message.includes("flagged by compliance screening")
    ) {
      throw error;
    }

    const message =
      error instanceof Error ? error.message : typeof error === "string" ? error : JSON.stringify(error);
    console.error("[Compliance] Range API request failed:", message);

    const result: RiskCheckResult = {
      address: normalized,
      riskLevel: "unknown",
      isFlagged: false,
      reason: message,
      checkedAt: Date.now(),
      mock: false,
    };
    setCachedResult(normalized, result);
    return result;
  }
}

export async function checkAddressesBatch(
  addresses: string[],
): Promise<Map<string, RiskCheckResult>> {
  const results = new Map<string, RiskCheckResult>();
  const input = addresses.map(normalizeAddress).filter(Boolean);

  const chunks: string[][] = [];
  for (let i = 0; i < input.length; i += 10) {
    chunks.push(input.slice(i, i + 10));
  }

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const chunkResults = await Promise.all(
      chunk.map(async (addr) => {
        try {
          return await checkAddressRisk(addr);
        } catch (e: unknown) {
          const message =
            e instanceof Error ? e.message : typeof e === "string" ? e : JSON.stringify(e);
          const fallback: RiskCheckResult = {
            address: addr,
            riskLevel: "unknown",
            isFlagged: false,
            reason: message,
            checkedAt: Date.now(),
            mock: false,
          };
          return fallback;
        }
      }),
    );

    for (const r of chunkResults) {
      results.set(r.address, r);
    }

    if (i < chunks.length - 1) {
      await sleep(100);
    }
  }

  return results;
}

export async function isAddressSafe(address: string): Promise<boolean> {
  const result = await checkAddressRisk(address);
  return result.riskLevel !== "flagged";
}
