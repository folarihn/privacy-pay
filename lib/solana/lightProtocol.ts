import { createRpc, Rpc } from "@lightprotocol/stateless.js";
import { PublicKey } from "@solana/web3.js";
import { SOLANA_RPC_ENDPOINT, connection } from "@/lib/connection";

export type ShieldedActivity = {
  signature: string;
  type: 'shield' | 'unshield' | 'transfer' | 'unknown';
  timestamp: number;
  status: 'success' | 'failed';
  amount?: number; // Approximation
};

// Create a singleton RPC instance for Light Protocol
export const lightRpc: Rpc = createRpc(SOLANA_RPC_ENDPOINT, SOLANA_RPC_ENDPOINT, SOLANA_RPC_ENDPOINT);

export async function getShieldedHistory(owner: PublicKey): Promise<ShieldedActivity[]> {
  try {
    // 1. Get recent signatures for the user
    // Limit to 10 to avoid 429 Rate Limits on getParsedTransactions
    const signatures = await connection.getSignaturesForAddress(owner, { limit: 10 });
    
    // 2. Parse transactions to find Light Protocol interactions
    const activities: ShieldedActivity[] = [];
    
    if (signatures.length === 0) return [];

    // Process in parallel chunks
    const txs = await connection.getParsedTransactions(signatures.map(s => s.signature), {
      maxSupportedTransactionVersion: 0
    });

    for (let i = 0; i < txs.length; i++) {
      const tx = txs[i];
      const sigInfo = signatures[i];
      
      if (!tx || !tx.meta) continue;

      // Check logs for Light System Program instructions
      const logs = tx.meta.logMessages || [];
      const isLightProtocol = logs.some(log => log.includes("LightSystemProgram"));
      
      if (isLightProtocol) {
        let type: ShieldedActivity['type'] = 'unknown';
        
        // Simple heuristic based on logs or instruction presence
        // Note: Real production apps should parse inner instructions more carefully
        if (logs.some(log => log.includes("Instruction: Compress"))) {
          type = 'shield';
        } else if (logs.some(log => log.includes("Instruction: Decompress"))) {
          type = 'unshield';
        } else if (logs.some(log => log.includes("Instruction: Transfer"))) {
          type = 'transfer';
        }

        activities.push({
          signature: sigInfo.signature,
          type,
          timestamp: sigInfo.blockTime || Date.now() / 1000,
          status: sigInfo.err ? 'failed' : 'success'
        });
      }
    }
    
    return activities;
  } catch (error) {
    console.error("Failed to fetch shielded history:", error);
    return [];
  }
}

export async function getShieldedBalance(owner: PublicKey): Promise<number> {
  try {
    const balanceBn = await lightRpc.getCompressedBalanceByOwner(owner);
    // Convert BN to number (lamports to SOL)
    // Note: BN might be large, but for display 53-bit integer is usually fine for SOL unless huge whale
    // Better to return number in SOL directly
    const lamports = balanceBn.toNumber(); 
    return lamports / 1e9;
  } catch (error) {
    console.error("Failed to fetch shielded balance:", error);
    return 0;
  }
}

