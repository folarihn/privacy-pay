import type { Connection, Transaction } from "@solana/web3.js";

// Simulation errors from Light Protocol that are expected to appear
// even on valid transactions — the simulation RPC can't access ZK state trees.
// If we see these we treat the result as ambiguous and proceed to chain.
const ZK_AMBIGUOUS_PATTERNS: RegExp[] = [
  /custom program error: 0x4e25/i,  // Light Protocol error 20005
  /LightSystemProgram/i,
  /state.?tree/i,
  /merkle/i,
  /compressedProof/i,
  /validity.?proof/i,
  /AccountNotFound/i,
  /Program \S+ failed: custom program error/i, // generic ZK program errors
];

// Errors that unambiguously mean the tx will fail on-chain too —
// don't send, don't charge the fee.
const REAL_ERROR_PATTERNS: RegExp[] = [
  /insufficient.*(funds|lamports)/i,
  /custom program error: 0x1\b/i,   // SPL token InsufficientFunds
  /already.*initialized/i,
  /invalid.*account.*owner/i,
  /account.*does not exist/i,
  /unauthorized/i,
];

type SimResult =
  | { action: "proceed" }                        // simulation passed cleanly
  | { action: "warn" }                           // ZK ambiguous — proceed anyway
  | { action: "abort"; reason: string };         // real error — don't send

export async function simulateBeforeSend(
  connection: Connection,
  transaction: Transaction,
): Promise<SimResult> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sim = await (connection.simulateTransaction as any)(transaction, {
      sigVerify: false,
      commitment: "processed",
    });

    if (!sim.value.err) return { action: "proceed" };

    const logs = sim.value.logs ?? [];
    const fullText = [...logs, JSON.stringify(sim.value.err)].join("\n");

    if (REAL_ERROR_PATTERNS.some((p) => p.test(fullText))) {
      const detail = logs.slice(-5).join("\n") || JSON.stringify(sim.value.err);
      return { action: "abort", reason: detail };
    }

    if (ZK_AMBIGUOUS_PATTERNS.some((p) => p.test(fullText))) {
      return { action: "warn" };
    }

    // Unknown simulation error — fail safe: don't send
    const detail = logs.slice(-3).join("\n") || JSON.stringify(sim.value.err);
    return { action: "abort", reason: detail };
  } catch {
    // simulateTransaction itself threw (network hiccup, unsupported method on node).
    // Don't block the user — the send might succeed.
    return { action: "warn" };
  }
}

/**
 * After a confirmed on-chain failure, fetch transaction logs and throw with detail.
 * Call this inside the `if (confirmation.value.err)` branch.
 */
export async function throwWithOnChainLogs(
  connection: Connection,
  signature: string,
  fallbackErr: unknown,
): Promise<never> {
  try {
    const tx = await connection.getTransaction(signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });
    const logs = tx?.meta?.logMessages;
    if (logs?.length) {
      throw new Error(`Transaction failed on-chain:\n${logs.slice(-8).join("\n")}`);
    }
  } catch (inner: unknown) {
    if (inner instanceof Error && inner.message.startsWith("Transaction failed")) {
      throw inner;
    }
  }
  throw new Error(
    `Transaction failed on-chain: ${JSON.stringify(fallbackErr)}`,
  );
}
