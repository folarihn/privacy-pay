import type { RiskCheckResult } from "@/lib/compliance";
import type { TokenSymbol } from "@/lib/constants";

export type BatchRecipientStatus =
  | "idle"
  | "checking"
  | "ready"
  | "flagged"
  | "sending"
  | "sent"
  | "failed";

export interface BatchRecipient {
  id: string;
  address: string;
  amount: string;
  memo: string;
  status: BatchRecipientStatus;
  error: string | null;
  signature: string | null;
  complianceResult: RiskCheckResult | null;
}

export interface BatchSession {
  id: string;
  token: TokenSymbol;
  recipients: BatchRecipient[];
  createdAt: number;
  label: string;
}

export type BatchSendPhase = "compose" | "review" | "sending" | "complete";
