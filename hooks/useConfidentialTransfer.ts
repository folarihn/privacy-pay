"use client";

import { useCallback, useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useConnection } from "@solana/wallet-adapter-react";
import {
  getCipherUsdcMint,
  getConfidentialAccountInfo,
  setupConfidentialAccount,
  depositToConfidential,
  applyPendingBalance,
  confidentialTransfer,
  withdrawFromConfidential,
} from "@/lib/solana/confidential-transfer";
import type { PublicKey } from "@solana/web3.js";

export interface ConfidentialAccountState {
  exists: boolean;
  address: string | null;
  isReady: boolean; // exists AND configured with ElGamal keys
}

export function useConfidentialTransfer() {
  const wallet = useWallet();
  const { connection } = useConnection();

  const [accountState, setAccountState] = useState<ConfidentialAccountState>({
    exists: false,
    address: null,
    isReady: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mint = getCipherUsdcMint();

  const refreshAccountState = useCallback(async () => {
    if (!wallet.publicKey || !mint) return;

    try {
      const info = await getConfidentialAccountInfo(connection, wallet.publicKey, mint);
      setAccountState({
        exists: info.exists,
        address: info.address.toBase58(),
        // Account is ready if it exists and has ConfidentialTransfer extension configured
        // Full check requires parsing the account extension data
        isReady: info.exists,
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to check account";
      setError(message);
    }
  }, [connection, mint, wallet.publicKey]);

  useEffect(() => {
    void refreshAccountState();
  }, [refreshAccountState]);

  const setup = useCallback(async () => {
    if (!mint) throw new Error("Cipher USDC mint not configured");
    setIsLoading(true);
    setError(null);
    try {
      const sig = await setupConfidentialAccount({ connection, wallet, mint });
      await refreshAccountState();
      return sig;
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Setup failed";
      setError(message);
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, [connection, mint, refreshAccountState, wallet]);

  const deposit = useCallback(async (amountUi: number) => {
    if (!mint) throw new Error("Cipher USDC mint not configured");
    const amount = BigInt(Math.floor(amountUi * 1_000_000));
    setIsLoading(true);
    setError(null);
    try {
      return await depositToConfidential({ connection, wallet, mint, amount });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Deposit failed";
      setError(message);
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, [connection, mint, wallet]);

  const applyPending = useCallback(async (
    expectedBalance: bigint,
    pendingCounter: number
  ) => {
    if (!mint) throw new Error("Cipher USDC mint not configured");
    setIsLoading(true);
    setError(null);
    try {
      return await applyPendingBalance({
        connection, wallet, mint,
        expectedDecryptedAvailableBalance: expectedBalance,
        currentPendingBalanceCounterValue: pendingCounter,
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Apply pending failed";
      setError(message);
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, [connection, mint, wallet]);

  const transfer = useCallback(async (recipient: PublicKey, amountUi: number) => {
    if (!mint) throw new Error("Cipher USDC mint not configured");
    const amount = BigInt(Math.floor(amountUi * 1_000_000));
    setIsLoading(true);
    setError(null);
    try {
      return await confidentialTransfer({ connection, wallet, mint, recipient, amount });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Transfer failed";
      setError(message);
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, [connection, mint, wallet]);

  const withdraw = useCallback(async (amountUi: number, availableBalance: bigint) => {
    if (!mint) throw new Error("Cipher USDC mint not configured");
    const amount = BigInt(Math.floor(amountUi * 1_000_000));
    setIsLoading(true);
    setError(null);
    try {
      return await withdrawFromConfidential({
        connection, wallet, mint, amount,
        decryptableAvailableBalance: availableBalance,
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Withdrawal failed";
      setError(message);
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, [connection, mint, wallet]);

  return {
    mintAvailable: !!mint,
    accountState,
    isLoading,
    error,
    setup,
    deposit,
    applyPending,
    transfer,
    withdraw,
    refresh: refreshAccountState,
  };
}
