"use client";

import { useState } from "react";
import type { RiskCheckResult } from "@/lib/compliance";

function isRiskCheckResult(value: unknown): value is RiskCheckResult {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.address === "string" &&
    (v.riskLevel === "safe" || v.riskLevel === "flagged" || v.riskLevel === "unknown") &&
    typeof v.isFlagged === "boolean" &&
    (typeof v.reason === "string" || v.reason === null) &&
    typeof v.checkedAt === "number" &&
    typeof v.mock === "boolean"
  );
}

export function useComplianceCheck() {
  const [results, setResults] = useState<Map<string, RiskCheckResult>>(new Map());
  const [isChecking, setIsChecking] = useState(false);

  async function checkAddress(address: string): Promise<RiskCheckResult> {
    setIsChecking(true);
    try {
      const res = await fetch(`/api/compliance/check?address=${encodeURIComponent(address)}`);
      const data = (await res.json()) as unknown;
      if (!isRiskCheckResult(data)) {
        const message =
          typeof data === "object" && data !== null && "error" in data && typeof (data as { error?: unknown }).error === "string"
            ? (data as { error: string }).error
            : "Invalid compliance response";
        throw new Error(message);
      }

      setResults((prev) => {
        const next = new Map(prev);
        next.set(address, data);
        return next;
      });
      return data;
    } finally {
      setIsChecking(false);
    }
  }

  function getResult(address: string): RiskCheckResult | undefined {
    return results.get(address);
  }

  return { checkAddress, getResult, isChecking, results };
}

