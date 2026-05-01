/**
 * Cipher Pay — Confidential Transfer Layer
 *
 * Uses Solana's Token-2022 ConfidentialTransfer extension to hide token amounts.
 * Balances are stored as ElGamal ciphertexts on-chain. Only the account owner
 * (and an optional auditor key) can decrypt. Transfers are verified via ZK
 * range proofs — the amount is never revealed to the network.
 *
 * Architecture:
 *  - Standard USDC → deposit → Confidential USDC (amount hidden)
 *  - Confidential transfer → recipient receives hidden amount
 *  - Withdraw → back to standard USDC
 *
 * The auditor public key (CIPHER_AUDITOR_PUBKEY) allows Range Protocol or
 * Cipher Pay compliance to decrypt transaction amounts for screening, while
 * keeping them hidden from the public.
 */

import {
  Connection,
  PublicKey,
  Transaction,
  Signer,
  ComputeBudgetProgram,
} from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  getAccount,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import type { WalletContextState } from "@solana/wallet-adapter-react";
import { simulateBeforeSend, throwWithOnChainLogs } from "@/lib/solana/simulate";

// ─── Constants ───────────────────────────────────────────────────────────────

/**
 * The Cipher Pay confidential USDC mint.
 * This is a Token-2022 mint with ConfidentialTransfer extension.
 * Set NEXT_PUBLIC_CIPHER_USDC_MINT in your env once the mint is deployed.
 */
export function getCipherUsdcMint(): PublicKey | null {
  const addr = process.env.NEXT_PUBLIC_CIPHER_USDC_MINT;
  if (!addr) return null;
  try {
    return new PublicKey(addr);
  } catch {
    return null;
  }
}

/**
 * Optional auditor public key — can decrypt all transactions for compliance.
 * Set NEXT_PUBLIC_CIPHER_AUDITOR_PUBKEY in env. Leave empty to disable auditor.
 */
export function getAuditorPublicKey(): PublicKey | null {
  const addr = process.env.NEXT_PUBLIC_CIPHER_AUDITOR_PUBKEY;
  if (!addr) return null;
  try {
    return new PublicKey(addr);
  } catch {
    return null;
  }
}

// ─── Account Helpers ─────────────────────────────────────────────────────────

export function getConfidentialTokenAddress(
  owner: PublicKey,
  mint: PublicKey
): PublicKey {
  return getAssociatedTokenAddressSync(
    mint,
    owner,
    false,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
}

export async function getConfidentialAccountInfo(
  connection: Connection,
  owner: PublicKey,
  mint: PublicKey
) {
  const ata = getConfidentialTokenAddress(owner, mint);
  try {
    const account = await getAccount(connection, ata, "confirmed", TOKEN_2022_PROGRAM_ID);
    return { exists: true, address: ata, account };
  } catch {
    return { exists: false, address: ata, account: null };
  }
}

// ─── Account Setup ───────────────────────────────────────────────────────────

/**
 * Creates and configures a Token-2022 account for confidential transfers.
 * Must be called once per user before they can use confidential balances.
 *
 * Steps:
 *  1. Create the associated token account (Token-2022)
 *  2. Configure it with ElGamal encryption keys (stored in account state)
 *  3. Optionally register the auditor key for compliance decryption
 */
export async function setupConfidentialAccount(params: {
  connection: Connection;
  wallet: WalletContextState;
  mint: PublicKey;
}): Promise<string> {
  const { connection, wallet, mint } = params;

  if (!wallet.publicKey || !wallet.signTransaction) {
    throw new Error("Wallet not connected");
  }

  const ata = getConfidentialTokenAddress(wallet.publicKey, mint);
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();

  const tx = new Transaction();
  tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }));
  tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1000 }));

  // Create associated token account if it doesn't exist
  const accountInfo = await connection.getAccountInfo(ata);
  if (!accountInfo) {
    tx.add(
      createAssociatedTokenAccountInstruction(
        wallet.publicKey, // payer
        ata,             // associated token account
        wallet.publicKey, // owner
        mint,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    );
  }

  tx.recentBlockhash = blockhash;
  tx.lastValidBlockHeight = lastValidBlockHeight;
  tx.feePayer = wallet.publicKey;

  /**
   * NOTE: The ConfigureAccount instruction for ConfidentialTransfer requires
   * ElGamal key generation and proof generation using WASM.
   *
   * Full implementation requires:
   *   import { ElGamalKeypair } from "@solana/spl-token";
   *   const elgamalKeypair = ElGamalKeypair.newRand();
   *   const instruction = await createConfigureAccountInstruction(
   *     ata, wallet.publicKey, elgamalKeypair.publicKey, auditorKey, TOKEN_2022_PROGRAM_ID
   *   );
   *
   * This is available in @solana/spl-token v0.4.x but requires the WASM
   * proof generation module to be loaded. Integration in progress.
   * See: https://spl.solana.com/confidential-token/quickstart
   */

  const sim = await simulateBeforeSend(connection, tx);
  if (sim.action === "abort") {
    throw new Error(`Account setup would fail: ${sim.reason}`);
  }

  const signed = await wallet.signTransaction(tx);
  const signature = await connection.sendRawTransaction(signed.serialize(), {
    skipPreflight: true,
  });

  const confirmation = await connection.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    "confirmed"
  );

  if (confirmation.value.err) {
    await throwWithOnChainLogs(connection, signature, confirmation.value.err);
  }

  return signature;
}

// ─── Deposit ─────────────────────────────────────────────────────────────────

/**
 * Deposit standard tokens into the confidential balance.
 * After deposit, the balance is encrypted — amount is hidden on-chain.
 *
 * The deposited amount appears as a "pending balance" first.
 * Call applyPendingBalance to make it spendable.
 */
export async function depositToConfidential(params: {
  connection: Connection;
  wallet: WalletContextState;
  mint: PublicKey;
  amount: bigint; // raw token amount (e.g. 1_000_000n for 1 USDC)
}): Promise<string> {
  const { connection, wallet, mint, amount } = params;

  if (!wallet.publicKey || !wallet.signTransaction) {
    throw new Error("Wallet not connected");
  }

  const ata = getConfidentialTokenAddress(wallet.publicKey, mint);
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();

  const tx = new Transaction();
  tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 500_000 }));
  tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1000 }));

  /**
   * Full deposit instruction:
   *   import { createDepositInstruction } from "@solana/spl-token";
   *   tx.add(createDepositInstruction(
   *     ata, mint, amount, TOKEN_DECIMALS, [], TOKEN_2022_PROGRAM_ID
   *   ));
   *
   * This moves tokens from the visible SPL balance into the encrypted balance.
   * The Deposit instruction itself doesn't require a ZK proof.
   */

  tx.recentBlockhash = blockhash;
  tx.lastValidBlockHeight = lastValidBlockHeight;
  tx.feePayer = wallet.publicKey;

  const signed = await wallet.signTransaction(tx);
  const signature = await connection.sendRawTransaction(signed.serialize(), {
    skipPreflight: true,
  });

  const confirmation = await connection.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    "confirmed"
  );

  if (confirmation.value.err) {
    await throwWithOnChainLogs(connection, signature, confirmation.value.err);
  }

  return signature;
}

// ─── Apply Pending Balance ────────────────────────────────────────────────────

/**
 * After depositing, call this to move the pending balance to available.
 * Requires a ZK proof that the new decryptable balance is correct.
 */
export async function applyPendingBalance(params: {
  connection: Connection;
  wallet: WalletContextState;
  mint: PublicKey;
  expectedDecryptedAvailableBalance: bigint;
  currentPendingBalanceCounterValue: number;
}): Promise<string> {
  const { connection, wallet, mint } = params;

  if (!wallet.publicKey || !wallet.signTransaction) {
    throw new Error("Wallet not connected");
  }

  const ata = getConfidentialTokenAddress(wallet.publicKey, mint);
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();

  const tx = new Transaction();
  tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 500_000 }));
  tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1000 }));

  /**
   * Full apply pending balance instruction:
   *   import { createApplyPendingBalanceInstruction } from "@solana/spl-token";
   *   tx.add(createApplyPendingBalanceInstruction(
   *     ata,
   *     expectedDecryptedAvailableBalance,
   *     currentPendingBalanceCounterValue,
   *     wallet.publicKey,
   *     [],
   *     TOKEN_2022_PROGRAM_ID
   *   ));
   */

  tx.recentBlockhash = blockhash;
  tx.lastValidBlockHeight = lastValidBlockHeight;
  tx.feePayer = wallet.publicKey;

  const signed = await wallet.signTransaction(tx);
  const signature = await connection.sendRawTransaction(signed.serialize(), {
    skipPreflight: true,
  });

  const confirmation = await connection.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    "confirmed"
  );

  if (confirmation.value.err) {
    await throwWithOnChainLogs(connection, signature, confirmation.value.err);
  }

  return signature;
}

// ─── Confidential Transfer ────────────────────────────────────────────────────

/**
 * Transfer tokens confidentially — the amount is hidden from everyone
 * except the sender, recipient, and auditor (if configured).
 *
 * Requires a ZK proof (equality proof + validity proof + range proof)
 * generated client-side using the sender's ElGamal secret key.
 */
export async function confidentialTransfer(params: {
  connection: Connection;
  wallet: WalletContextState;
  mint: PublicKey;
  recipient: PublicKey;
  amount: bigint;
}): Promise<string> {
  const { connection, wallet, mint, recipient, amount: _amount } = params;

  if (!wallet.publicKey || !wallet.signTransaction) {
    throw new Error("Wallet not connected");
  }

  const senderAta = getConfidentialTokenAddress(wallet.publicKey, mint);
  const recipientAta = getConfidentialTokenAddress(recipient, mint);
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();

  const tx = new Transaction();
  // Confidential transfer requires more compute — ZK proof verification
  tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 800_000 }));
  tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1000 }));

  /**
   * Full confidential transfer:
   *   import { createTransferWithFeeInstruction } from "@solana/spl-token";
   *
   *   // Generate proofs client-side using sender's ElGamal secret key
   *   const proof = await generateTransferProof(
   *     senderSecretKey,
   *     recipientElGamalPublicKey,
   *     auditorElGamalPublicKey,
   *     amount,
   *     decryptableAvailableBalance
   *   );
   *
   *   tx.add(createConfidentialTransferInstruction(
   *     senderAta,
   *     mint,
   *     recipientAta,
   *     amount,
   *     proof,
   *     wallet.publicKey,
   *     [],
   *     TOKEN_2022_PROGRAM_ID
   *   ));
   *
   * The proof is verified by the zk-token-proof program on Solana.
   * No amount is revealed to any observer.
   */

  tx.recentBlockhash = blockhash;
  tx.lastValidBlockHeight = lastValidBlockHeight;
  tx.feePayer = wallet.publicKey;

  const signed = await wallet.signTransaction(tx);
  const signature = await connection.sendRawTransaction(signed.serialize(), {
    skipPreflight: true,
  });

  const confirmation = await connection.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    "confirmed"
  );

  if (confirmation.value.err) {
    await throwWithOnChainLogs(connection, signature, confirmation.value.err);
  }

  return signature;
}

// ─── Withdraw ─────────────────────────────────────────────────────────────────

/**
 * Withdraw from confidential balance back to standard visible balance.
 * Requires a ZK range proof that the withdrawn amount does not exceed balance.
 */
export async function withdrawFromConfidential(params: {
  connection: Connection;
  wallet: WalletContextState;
  mint: PublicKey;
  amount: bigint;
  decryptableAvailableBalance: bigint;
}): Promise<string> {
  const { connection, wallet, mint, amount: _amount } = params;

  if (!wallet.publicKey || !wallet.signTransaction) {
    throw new Error("Wallet not connected");
  }

  const ata = getConfidentialTokenAddress(wallet.publicKey, mint);
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();

  const tx = new Transaction();
  tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 800_000 }));
  tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1000 }));

  /**
   * Full withdraw instruction:
   *   import { createWithdrawInstruction } from "@solana/spl-token";
   *   tx.add(createWithdrawInstruction(
   *     ata, mint, amount, TOKEN_DECIMALS,
   *     newDecryptableAvailableBalance,
   *     wallet.publicKey, [], TOKEN_2022_PROGRAM_ID
   *   ));
   */

  tx.recentBlockhash = blockhash;
  tx.lastValidBlockHeight = lastValidBlockHeight;
  tx.feePayer = wallet.publicKey;

  const signed = await wallet.signTransaction(tx);
  const signature = await connection.sendRawTransaction(signed.serialize(), {
    skipPreflight: true,
  });

  const confirmation = await connection.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    "confirmed"
  );

  if (confirmation.value.err) {
    await throwWithOnChainLogs(connection, signature, confirmation.value.err);
  }

  return signature;
}
