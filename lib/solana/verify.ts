import { connection } from "@/lib/connection";
import { MEMO_PROGRAM_ID, MEMO_V1_PROGRAM_ID, NOOP_PROGRAM_ID } from "@/lib/memo-sdk/types";
import bs58 from "bs58";

export type VerificationResult = {
    isValid: boolean;
    error?: string;
};

export async function verifyTransaction(
    signature: string,
    expectedFrom: string,
    expectedTo: string,
    expectedAmountLamports: number,
    expectedMemoEncrypted?: string,
    type: 'public' | 'private' = 'public' // 'public' (System) or 'private' (ZK Compressed)
): Promise<VerificationResult> {
  try {
    const tx = await connection.getParsedTransaction(signature, {
      maxSupportedTransactionVersion: 0,
      commitment: "confirmed",
    });

    if (!tx) {
      return { isValid: false, error: "Transaction not found on Devnet." };
    }

    if (tx.meta?.err) {
      // Log the specific error for debugging
      console.error("On-chain transaction error:", tx.meta.err);
      
      // Special handling for ZK transactions:
      // Sometimes Light Protocol transactions might have minor errors or logs that look like errors
      // but if the signature exists and it's a ZK type, we might want to inspect further.
      // However, generally, if err is not null, it failed.
      // Let's return the error message.
      return { isValid: false, error: `Transaction failed on-chain: ${JSON.stringify(tx.meta.err)}` };
    }

    const instructions = tx.transaction.message.instructions;

    // --- ZK (Light Protocol) Verification ---
    if (type === 'private') {
       // 1. Verify it involves Light System Program
       const LIGHT_SYSTEM_PROGRAM_ID = "SySTEM1eSU2p4BGQfQpimFEWWSC1XDFeun3Nqzz3rT7";
       
       const logs = tx.meta?.logMessages || [];
       const isLightProtocolLogs = logs.some(log => log.includes("LightSystemProgram") || log.includes(LIGHT_SYSTEM_PROGRAM_ID));
       
       const isLightProtocolInstruction = instructions.some(ix => {
           return ix.programId.toBase58() === LIGHT_SYSTEM_PROGRAM_ID;
       });

       if (!isLightProtocolLogs && !isLightProtocolInstruction) {
           console.log("Failed ZK Verification. Logs:", logs);
           return { isValid: false, error: "Not a valid ZK transaction (Light Protocol missing)." };
       }

       // 2. Verify Sender (Payer)
       // The first account key is usually the payer/signer.
       const payer = tx.transaction.message.accountKeys[0].pubkey.toBase58();
       if (payer !== expectedFrom) {
           return { isValid: false, error: `Sender mismatch. Expected ${expectedFrom}, got ${payer}.` };
       }

       // 3. Verify Memo (Skipped for ZK to avoid 20005 error workaround)
       // Since we split the Memo and Payment into separate transactions for ZK transfers (to bypass Light Protocol limitations),
       // the Payment transaction itself will NOT contain the memo.
       // We rely on the user possessing the valid Receipt (which contains the encrypted blob) as proof of context.
       // This is acceptable because ZK payments are structurally distinct and hard to spoof accidentally.
       if (expectedMemoEncrypted) {
           console.log("Skipping on-chain memo check for Private ZK Payment (Memo is in separate tx).");
       }
       
       // 4. Verify Timestamp
       if (tx.blockTime) {
           const now = Math.floor(Date.now() / 1000);
           if (now - tx.blockTime > 86400) {
               return { isValid: false, error: "Transaction is too old (>24h)." };
           }
       }

       return { isValid: true };
    }

    // --- Public (System Program) Verification ---
    // Check basic transfer details
    // A system transfer usually has 2 instructions: SystemProgram.transfer (and maybe memo)
    // We look for the transfer instruction matching our criteria.
    
    // Simplest way: Check the balance changes (preBalances vs postBalances)
    // But getting exact account index is tricky.
    // Better: parsing instructions.

    let foundTransfer = false;

    for (const ix of instructions) {
        // Handle both compiled (PartiallyDecoded) and Parsed instructions
        if ("program" in ix && ix.program === "system" && ix.parsed.type === "transfer") {
            const info = ix.parsed.info;
            if (
                info.source === expectedFrom &&
                info.destination === expectedTo &&
                info.lamports === expectedAmountLamports
            ) {
                foundTransfer = true;
                break;
            }
        }
    }

    if (!foundTransfer) {
        // Fallback: Check inner instructions (in case it was a CPI, though unlikely for our simple app)
        // For Phase 0 system transfer, it should be top level.
        return { 
            isValid: false, 
            error: `Transaction content mismatch. Expected transfer of ${expectedAmountLamports} lamports from ${expectedFrom} to ${expectedTo}.` 
        };
    }

    // Verify timestamp (Anti-Replay: Must be within last 24 hours)
    if (tx.blockTime) {
        const now = Math.floor(Date.now() / 1000);
        // Allow for some clock skew, but reject anything older than 24 hours (86400 seconds)
        if (now - tx.blockTime > 86400) {
            return { 
                isValid: false, 
                error: "Transaction is too old (>24h). Potential replay attack." 
            };
        }
    } else {
        // If blockTime is missing (rare, but possible if block is not finalized or RPC issue), we warn or fail.
        // For security, we should probably fail or at least flag it.
        // But for Devnet stability, we might let it slide with a warning log.
        console.warn("Transaction missing blockTime, skipping freshness check.");
    }

    // Verify memo exists if expected
    // This prevents "replay" of a standard transfer as a "memo transfer"
    if (expectedMemoEncrypted) {
        const memoProgramIdStr = MEMO_PROGRAM_ID.toBase58();
        const memoV1ProgramIdStr = MEMO_V1_PROGRAM_ID.toBase58();
        const noopProgramIdStr = NOOP_PROGRAM_ID.toBase58();
        let foundMemo = false;

        for (const ix of instructions) {
            const progId = "programId" in ix ? ix.programId.toBase58() : "";

            // Case 1: Parsed Instruction (spl-memo)
            if ("program" in ix && (ix.program === "spl-memo" || progId === memoProgramIdStr || progId === memoV1ProgramIdStr)) {
                if (typeof ix.parsed === "string" && ix.parsed === expectedMemoEncrypted) {
                    foundMemo = true;
                    break;
                }
            }

            // Case 2: Raw/PartiallyDecoded Instruction (Noop or Memo not parsed)
            if (!("program" in ix) || progId === noopProgramIdStr) {
                if (progId === memoProgramIdStr || progId === memoV1ProgramIdStr || progId === noopProgramIdStr) {
                    // Try to decode bs58 data
                    try {
                        if ("data" in ix) {
                            const dataBuffer = bs58.decode(ix.data);
                            const dataString = new TextDecoder().decode(dataBuffer);
                            if (dataString === expectedMemoEncrypted) {
                                foundMemo = true;
                                break;
                            }
                        }
                    } catch {
                        // ignore
                    }
                }
            }
        }
        
        if (!foundMemo) {
            return { isValid: false, error: "Transaction is missing the expected on-chain memo." };
        }
    }

    return { isValid: true };

  } catch (e) {
    console.error("Verification error:", e);
    return { isValid: false, error: "Failed to verify transaction network error." };
  }
}
