import type { Rpc } from "@lightprotocol/stateless.js";
import { LightSystemProgram, bn, selectStateTreeInfo } from "@lightprotocol/stateless.js";
import {
  CompressedTokenProgram,
  getTokenPoolInfos,
  selectMinCompressedTokenAccountsForTransfer,
  selectTokenPoolInfo,
  selectTokenPoolInfosForDecompression,
} from "@lightprotocol/compressed-token";
import type { WalletContextState } from "@solana/wallet-adapter-react";
import {
  type Connection,
  ComputeBudgetProgram,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import { Buffer } from "buffer";
import BN from "bn.js";
import { USDC_DECIMALS } from "@/lib/constants";
import { sendZkPayment, unshieldFunds } from "@/lib/solana/engines/zkCompressedTransfer";
import { simulateBeforeSend, throwWithOnChainLogs } from "@/lib/solana/simulate";

export interface TokenBalance {
  symbol: "SOL" | "USDC";
  mint: PublicKey | null;
  shieldedBalance: number;
  publicBalance: number;
  decimals: number;
}

export interface TransferParams {
  mint: PublicKey | null;
  amount: number;
  decimals: number;
  recipient: PublicKey;
}

function toRawAmountBn(amount: number, decimals: number): BN {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Invalid amount");
  }
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) {
    throw new Error("Invalid decimals");
  }

  const fixed = amount.toFixed(decimals);
  const [whole, frac = ""] = fixed.split(".");
  const paddedFrac = frac.padEnd(decimals, "0");
  const raw = `${whole}${paddedFrac}`.replace(/^0+(?=\d)/, "");
  return new BN(raw.length ? raw : "0", 10);
}

async function sendAndConfirm(params: {
  connection: Connection;
  wallet: WalletContextState;
  transaction: Transaction;
}): Promise<string> {
  const { connection, wallet, transaction } = params;

  if (!wallet.publicKey) {
    throw new Error("Wallet not connected");
  }

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.lastValidBlockHeight = lastValidBlockHeight;
  transaction.feePayer = wallet.publicKey;

  // Simulate first — catch real failures before any fee is charged.
  // ZK state-tree errors in simulation are expected false-negatives; we proceed for those.
  const sim = await simulateBeforeSend(connection, transaction);
  if (sim.action === "abort") {
    throw new Error(`Transaction would fail (no fee charged): ${sim.reason}`);
  }

  const signature = await wallet.sendTransaction(transaction, connection, {
    skipPreflight: true, // Already simulated above; skip redundant RPC preflight.
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

async function ensureAta(params: {
  connection: Connection;
  wallet: WalletContextState;
  mint: PublicKey;
}): Promise<PublicKey> {
  const { connection, wallet, mint } = params;

  if (!wallet.publicKey) {
    throw new Error("Wallet not connected");
  }

  const ata = await getAssociatedTokenAddress(mint, wallet.publicKey);
  const info = await connection.getAccountInfo(ata, "confirmed");
  if (info) return ata;

  const tx = new Transaction().add(
    createAssociatedTokenAccountInstruction(wallet.publicKey, ata, wallet.publicKey, mint),
  );
  tx.add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 250_000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1000 }),
  );

  await sendAndConfirm({ connection, wallet, transaction: tx });
  return ata;
}

export async function getCompressedTokenBalance(
  rpc: Rpc,
  owner: PublicKey,
  mint: PublicKey | null,
): Promise<number> {
  try {
    if (!mint) {
      const lamportsBn = await rpc.getCompressedBalanceByOwner(owner);
      return lamportsBn.toNumber() / 1e9;
    }

    const tokenAccounts = await rpc.getCompressedTokenAccountsByOwner(owner, { mint });
    const total = tokenAccounts.items.reduce((acc, item) => acc.add(item.parsed.amount), bn(0));
    return total.toNumber() / 10 ** USDC_DECIMALS;
  } catch (error) {
    console.error("Failed to fetch compressed token balance:", error);
    return 0;
  }
}

export async function compressToken(params: {
  rpc: Rpc;
  connection: Connection;
  wallet: WalletContextState;
  mint: PublicKey | null;
  amount: number;
  decimals: number;
}): Promise<string> {
  try {
    const { rpc, connection, wallet, mint, amount, decimals } = params;

    if (!wallet.publicKey) {
      throw new Error("Wallet not connected");
    }

    if (!mint) {
      const lamports = Math.floor(amount * 10 ** decimals);
      if (!Number.isFinite(lamports) || lamports <= 0) {
        throw new Error("Invalid SOL amount");
      }

      const trees = await rpc.getStateTreeInfos();
      const outputStateTreeInfo = selectStateTreeInfo(trees);
      const ix = await LightSystemProgram.compress({
        payer: wallet.publicKey,
        toAddress: wallet.publicKey,
        lamports,
        outputStateTreeInfo,
      });

      const tx = new Transaction().add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 500_000 }),
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1000 }),
        ix,
      );

      return await sendAndConfirm({ connection, wallet, transaction: tx });
    }

    const rawAmount = toRawAmountBn(amount, decimals);
    if (rawAmount.lte(bn(0))) {
      throw new Error("Invalid USDC amount");
    }

    const sourceAta = await getAssociatedTokenAddress(mint, wallet.publicKey);

    const trees = await rpc.getStateTreeInfos();
    const outputStateTreeInfo = selectStateTreeInfo(trees);

    const poolInfos = await getTokenPoolInfos(rpc, mint, "confirmed");
    if (!poolInfos.length) {
      throw new Error("USDC token pool not found (mint not registered for compression)");
    }

    const tokenPoolInfo = selectTokenPoolInfo(poolInfos);

    const ix = await CompressedTokenProgram.compress({
      payer: wallet.publicKey,
      owner: wallet.publicKey,
      source: sourceAta,
      toAddress: wallet.publicKey,
      amount: rawAmount,
      mint,
      outputStateTreeInfo,
      tokenPoolInfo,
    });

    const tx = new Transaction().add(
      ComputeBudgetProgram.setComputeUnitLimit({ units: 1_000_000 }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1000 }),
      ix,
    );

    return await sendAndConfirm({ connection, wallet, transaction: tx });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : JSON.stringify(error);
    console.error("compressToken failed:", error);
    throw new Error(`compressToken failed: ${message}`);
  }
}

export async function transferCompressedToken(params: {
  rpc: Rpc;
  connection: Connection;
  wallet: WalletContextState;
  mint: PublicKey | null;
  amount: number;
  decimals: number;
  recipient: PublicKey;
  encryptedMemo?: string | null;
}): Promise<string> {
  try {
    const { rpc, connection, wallet, mint, amount, decimals, recipient, encryptedMemo } = params;

    if (!wallet.publicKey) {
      throw new Error("Wallet not connected");
    }

    if (!mint) {
      const lamports = Math.floor(amount * 10 ** decimals);
      if (!Number.isFinite(lamports) || lamports <= 0) {
        throw new Error("Invalid SOL amount");
      }

      return await sendZkPayment({
        payer: wallet,
        toPubkey: recipient.toBase58(),
        amountLamports: lamports,
        encryptedMemo: encryptedMemo ?? undefined,
      });
    }

    const rawAmount = toRawAmountBn(amount, decimals);

    if (encryptedMemo) {
      const memoTx = new Transaction().add(
        new TransactionInstruction({
          keys: [],
          programId: new PublicKey("noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV"),
          data: Buffer.from(encryptedMemo, "utf-8"),
        }),
      );
      try {
        await sendAndConfirm({ connection, wallet, transaction: memoTx });
      } catch (e) {
        console.warn("Failed to send memo (non-fatal):", e);
      }
    }

    const tokenAccounts = await rpc.getCompressedTokenAccountsByOwner(wallet.publicKey, { mint });
    const [selectedAccounts, total] = selectMinCompressedTokenAccountsForTransfer(
      tokenAccounts.items,
      rawAmount,
    );

    if (total.lt(rawAmount)) {
      throw new Error("Insufficient USDC balance");
    }

    const hashes = selectedAccounts.map((a) => a.compressedAccount.hash);
    const proof = await rpc.getValidityProof(hashes, []);

    const ix = await CompressedTokenProgram.transfer({
      payer: wallet.publicKey,
      inputCompressedTokenAccounts: selectedAccounts,
      toAddress: recipient,
      amount: rawAmount,
      recentValidityProof: proof.compressedProof,
      recentInputStateRootIndices: proof.rootIndices,
    });

    const tx = new Transaction().add(
      ComputeBudgetProgram.setComputeUnitLimit({ units: 1_000_000 }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1000 }),
      ix,
    );

    return await sendAndConfirm({ connection, wallet, transaction: tx });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : JSON.stringify(error);
    console.error("transferCompressedToken failed:", error);
    throw new Error(`transferCompressedToken failed: ${message}`);
  }
}

export async function decompressToken(params: {
  rpc: Rpc;
  connection: Connection;
  wallet: WalletContextState;
  mint: PublicKey | null;
  amount: number;
  decimals: number;
}): Promise<string> {
  try {
    const { rpc, connection, wallet, mint, amount, decimals } = params;

    if (!wallet.publicKey) {
      throw new Error("Wallet not connected");
    }

    if (!mint) {
      const lamports = Math.floor(amount * 10 ** decimals);
      if (!Number.isFinite(lamports) || lamports <= 0) {
        throw new Error("Invalid SOL amount");
      }

      return await unshieldFunds({
        payer: wallet,
        toPubkey: wallet.publicKey.toBase58(),
        amountLamports: lamports,
      });
    }

    const rawAmount = toRawAmountBn(amount, decimals);
    if (rawAmount.lte(bn(0))) {
      throw new Error("Invalid USDC amount");
    }

    const destinationAta = await ensureAta({ connection, wallet, mint });

    const tokenAccounts = await rpc.getCompressedTokenAccountsByOwner(wallet.publicKey, { mint });
    const [selectedAccounts, total] = selectMinCompressedTokenAccountsForTransfer(
      tokenAccounts.items,
      rawAmount,
    );
    if (total.lt(rawAmount)) {
      throw new Error("Insufficient USDC balance");
    }

    const hashes = selectedAccounts.map((a) => a.compressedAccount.hash);
    const proof = await rpc.getValidityProof(hashes, []);

    const poolInfos = await getTokenPoolInfos(rpc, mint, "confirmed");
    if (!poolInfos.length) {
      throw new Error("USDC token pool not found (mint not registered for compression)");
    }
    const selectedPools = selectTokenPoolInfosForDecompression(poolInfos, rawAmount);

    const ix = await CompressedTokenProgram.decompress({
      payer: wallet.publicKey,
      inputCompressedTokenAccounts: selectedAccounts,
      toAddress: destinationAta,
      amount: rawAmount,
      recentValidityProof: proof.compressedProof,
      recentInputStateRootIndices: proof.rootIndices,
      tokenPoolInfos: selectedPools,
    });

    const tx = new Transaction().add(
      ComputeBudgetProgram.setComputeUnitLimit({ units: 1_000_000 }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1000 }),
      ix,
    );

    return await sendAndConfirm({ connection, wallet, transaction: tx });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : JSON.stringify(error);
    console.error("decompressToken failed:", error);
    throw new Error(`decompressToken failed: ${message}`);
  }
}
