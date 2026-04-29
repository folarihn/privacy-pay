import { PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import { Buffer } from "buffer";
import type { SendPaymentParams, SendPaymentResult } from "@/lib/solana/paymentEngine";
import { connection } from "@/lib/connection";

// Use Noop Program for Devnet compatibility (Memo v2 is missing on Devnet)
const MEMO_PROGRAM_ID = new PublicKey("noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV");

export async function sendPaymentWithSystemTransfer(params: SendPaymentParams): Promise<SendPaymentResult> {
  const { payer, toPubkey, amountLamports, encryptedMemo } = params;

  if (!payer.publicKey) {
    throw new Error("Wallet must be connected to send a payment.");
  }

  const to = new PublicKey(toPubkey);

  const latestBlockhash = await connection.getLatestBlockhash("confirmed");

  const transaction = new Transaction({
    feePayer: payer.publicKey,
    recentBlockhash: latestBlockhash.blockhash,
  });
  
  /* 
  // Temporarily removing Compute Budget to isolate "ProgramAccountNotFound" error
  transaction.add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 10_000 }), 
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1000 }) 
  );
  */

  transaction.add(
    SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: to,
      lamports: amountLamports,
    }),
  );

  if (encryptedMemo) {
    transaction.add(
      new TransactionInstruction({
        keys: [{ pubkey: payer.publicKey, isSigner: true, isWritable: true }],
        programId: MEMO_PROGRAM_ID,
        data: Buffer.from(encryptedMemo, "utf-8"),
      })
    );
  }

  // Use the standard sendTransaction method from wallet adapter
  // We explicitly pass the connection and signers (none needed here as wallet signs)
  // We set skipPreflight: true to bypass potential RPC simulation failures (common on Devnet)
  const signature = await payer.sendTransaction(transaction, connection, {
    skipPreflight: true,
    preflightCommitment: "confirmed",
  });

  await connection.confirmTransaction(
    {
      signature,
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
    },
    "confirmed",
  );

  return { signature };
}
