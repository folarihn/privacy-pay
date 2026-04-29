import { LightSystemProgram, selectStateTreeInfo, selectMinCompressedSolAccountsForTransfer, bn } from "@lightprotocol/stateless.js";
import type { WalletContextState } from "@solana/wallet-adapter-react";
import { ComputeBudgetProgram, PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import { connection } from "@/lib/connection";
import { lightRpc } from "@/lib/solana/lightProtocol";
import { simulateBeforeSend, throwWithOnChainLogs } from "@/lib/solana/simulate";
import BN from "bn.js";

// Define the shape of our ZK Transfer params
export interface ZkSendParams {
  payer: WalletContextState;
  toPubkey: string;
  amountLamports: number;
  encryptedMemo?: string;
}

export async function shieldFunds(params: ZkSendParams) {
  const { payer, amountLamports } = params;

  if (!payer.publicKey) {
    throw new Error("Wallet not connected");
  }

  // 1. Get State Tree Information (valid Merkle Trees for compressed assets)
  const infos = await lightRpc.getStateTreeInfos();
  const outputStateTreeInfo = selectStateTreeInfo(infos);

  // 2. Build Compress Instruction (Public SOL → Compressed SOL)
  const { blockhash } = await connection.getLatestBlockhash();

  const shieldIx = await LightSystemProgram.compress({
    payer: payer.publicKey,
    toAddress: payer.publicKey, // We are shielding to ourselves
    lamports: amountLamports,
    outputStateTreeInfo,
  });

  // 4. Build Transaction
  const transaction = new Transaction();
  
  // Add Compute Budget (ZK ops are heavy)
  transaction.add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 500_000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1000 })
  );

  transaction.add(shieldIx);
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = payer.publicKey;

  // 5. Simulate then send
  const sim = await simulateBeforeSend(connection, transaction);
  if (sim.action === "abort") {
    throw new Error(`Shield would fail (no fee charged): ${sim.reason}`);
  }

  const signature = await payer.sendTransaction(transaction, connection, {
    skipPreflight: true,
  });

  const { lastValidBlockHeight } = await connection.getLatestBlockhash();
  const confirmation = await connection.confirmTransaction(
    { signature, blockhash: transaction.recentBlockhash!, lastValidBlockHeight },
    "confirmed",
  );
  if (confirmation.value.err) {
    await throwWithOnChainLogs(connection, signature, confirmation.value.err);
  }

  return signature;
}

export async function getCompressedBalance(ownerPubkey: string) {
    const owner = new PublicKey(ownerPubkey);
    const balance = await lightRpc.getCompressedBalanceByOwner(owner);
    return balance.toNumber();
}

export async function sendZkPayment(params: ZkSendParams) {
    const { payer, toPubkey, amountLamports } = params;

    if (!payer.publicKey) {
        throw new Error("Wallet not connected");
    }

    // 1. Fetch Input UTXOs (My Compressed Accounts)
    const accounts = await lightRpc.getCompressedAccountsByOwner(payer.publicKey);

    // 2. Select minimal accounts to cover the amount
    const [selectedAccounts, totalInput] = selectMinCompressedSolAccountsForTransfer(
        accounts.items,
        amountLamports
    );

    if (totalInput.lt(bn(amountLamports))) {
        throw new Error(`Insufficient compressed balance. Have: ${totalInput.toNumber()} lamports, Need: ${amountLamports} lamports`);
    }

    // 3. Fetch Validity Proof
    const inputHashes = selectedAccounts.map(acc => acc.hash);
    const proofResult = await lightRpc.getValidityProof(inputHashes, []);
    const { compressedProof, rootIndices } = proofResult;

    if (!compressedProof || !rootIndices) {
        throw new Error(`Failed to get validity proof or root indices. Proof: ${!!compressedProof}, Indices: ${!!rootIndices}`);
    }

    if (rootIndices.length === 0) {
        throw new Error("Root indices are empty. Cannot verify proof.");
    }

    // 4. Handle Memo (Separate Transaction)
    // Light Protocol fails with error 20005 if extra instructions are present in the same tx.
    if (params.encryptedMemo) {
        const memoTx = new Transaction();
        memoTx.add(
            new TransactionInstruction({
                keys: [],
                programId: new PublicKey("noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV"),
                data: Buffer.from(params.encryptedMemo, "utf-8"),
            })
        );
        
        try {
             const memoSig = await payer.sendTransaction(memoTx, connection, { skipPreflight: true });
             await connection.confirmTransaction(memoSig, "confirmed");
        } catch (e) {
            console.warn("Failed to send memo (non-fatal):", e);
            // We continue with the payment even if memo fails, or we could throw.
            // For now, logging it is safer than blocking the payment.
        }
    }

    // 5. Create Transfer Instruction
    // LightSystemProgram.transfer handles output state creation automatically.
    // It creates a new compressed account for the recipient and a change account if needed.
    const transferIx = await LightSystemProgram.transfer({
        payer: payer.publicKey,
        inputCompressedAccounts: selectedAccounts,
        toAddress: new PublicKey(toPubkey),
        lamports: new BN(amountLamports),
        recentInputStateRootIndices: rootIndices,
        recentValidityProof: compressedProof,
    });

    // 6. Build Transaction
    const transaction = new Transaction();
    transaction.add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 1_000_000 }),
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1000 })
    );

    transaction.add(transferIx);

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();

    transaction.recentBlockhash = blockhash;
    transaction.lastValidBlockHeight = lastValidBlockHeight;
    transaction.feePayer = payer.publicKey;

    // 7. Simulate then send
    const sim = await simulateBeforeSend(connection, transaction);
    if (sim.action === "abort") {
        throw new Error(`Transfer would fail (no fee charged): ${sim.reason}`);
    }

    let signature: string;
    try {
        signature = await payer.sendTransaction(transaction, connection, {
            skipPreflight: true,
        });
    } catch (e: unknown) {
        throw e instanceof Error ? e : new Error(typeof e === "string" ? e : JSON.stringify(e));
    }

    const confirmation = await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight
    }, "confirmed");

    if (confirmation.value.err) {
        await throwWithOnChainLogs(connection, signature, confirmation.value.err);
    }

    return signature;
}

export async function unshieldFunds(params: ZkSendParams) {
    const { payer, toPubkey, amountLamports } = params;

    if (!payer.publicKey) {
        throw new Error("Wallet not connected");
    }

    // 1. Fetch Input UTXOs (My Compressed Accounts)
    const accounts = await lightRpc.getCompressedAccountsByOwner(payer.publicKey);
    let inputAccounts = accounts.items;

    if (inputAccounts.length === 0) {
        throw new Error("No compressed funds found.");
    }

    inputAccounts = inputAccounts.filter(acc => acc.lamports && acc.lamports.gt(new BN(0)));

    // UTXO Selection
    const targetAmount = new BN(amountLamports);
    const selectedAccounts: typeof inputAccounts = [];
    let selectedAmount = new BN(0);

    for (const acc of inputAccounts) {
        selectedAccounts.push(acc);
        selectedAmount = selectedAmount.add(acc.lamports);
        if (selectedAmount.gte(targetAmount)) break;
    }

    if (selectedAmount.lt(targetAmount)) {
        throw new Error(`Insufficient compressed balance. Have: ${selectedAmount.toString()} lamports, Need: ${targetAmount.toString()} lamports`);
    }

    // 2. Fetch Validity Proof
    const inputHashes = selectedAccounts.map(acc => acc.hash);
    const proofResult = await lightRpc.getValidityProof(inputHashes, []);
    const { compressedProof, rootIndices } = proofResult;

    if (!compressedProof) {
        throw new Error("Failed to get validity proof");
    }

    // 3. Create Decompress Instruction
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();

    const decompressIx = await LightSystemProgram.decompress({
        payer: payer.publicKey,
        toAddress: new PublicKey(toPubkey),
        lamports: amountLamports,
        inputCompressedAccounts: selectedAccounts,
        recentInputStateRootIndices: rootIndices,
        recentValidityProof: compressedProof,
    });

    // 4. Build Transaction
    const transaction = new Transaction();
    transaction.add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 500_000 }),
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1000 })
    );
    transaction.add(decompressIx);
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = payer.publicKey;

    // 5. Simulate then send
    const sim = await simulateBeforeSend(connection, transaction);
    if (sim.action === "abort") {
        throw new Error(`Unshield would fail (no fee charged): ${sim.reason}`);
    }

    const signature = await payer.sendTransaction(transaction, connection, {
        skipPreflight: true,
    });

    const confirmation = await connection.confirmTransaction(
        { signature, blockhash, lastValidBlockHeight },
        "confirmed",
    );
    if (confirmation.value.err) {
        await throwWithOnChainLogs(connection, signature, confirmation.value.err);
    }

    return signature;
}
