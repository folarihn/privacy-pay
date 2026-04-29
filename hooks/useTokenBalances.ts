"use client";

import { useCallback, useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { getAssociatedTokenAddress } from "@solana/spl-token";
import type { PublicKey } from "@solana/web3.js";
import {
  SOL_DECIMALS,
  type TokenSymbol,
  USDC_DECIMALS,
  USDC_MINT_DEVNET,
  USDC_MINT_MAINNET,
} from "@/lib/constants";
import { getCompressedTokenBalance, type TokenBalance } from "@/lib/token-service";
import { lightRpc } from "@/lib/solana/lightProtocol";

function humanizeLamports(lamports: number): number {
  return lamports / 1e9;
}

function inferUsdcMint(rpcEndpoint: string) {
  return /devnet|localhost/i.test(rpcEndpoint) ? USDC_MINT_DEVNET : USDC_MINT_MAINNET;
}

async function getPublicUsdcBalance(params: {
  connection: ReturnType<typeof useConnection>["connection"];
  owner: PublicKey;
}): Promise<number> {
  const { connection, owner } = params;
  const mint = inferUsdcMint(connection.rpcEndpoint);
  try {
    const ata = await getAssociatedTokenAddress(mint, owner);
    const bal = await connection.getTokenAccountBalance(ata, "confirmed");
    return bal.value.uiAmount ?? 0;
  } catch {
    return 0;
  }
}

export function useTokenBalances() {
  const wallet = useWallet();
  const { connection } = useConnection();

  const [selectedToken, setSelectedToken] = useState<TokenSymbol>("SOL");
  const [balances, setBalances] = useState<Record<TokenSymbol, TokenBalance | null>>({
    SOL: null,
    USDC: null,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!wallet.connected || !wallet.publicKey) {
      setBalances({ SOL: null, USDC: null });
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const owner = wallet.publicKey;

      const usdcMint = inferUsdcMint(connection.rpcEndpoint);

      const [shieldedSol, shieldedUsdc, publicSolLamports, publicUsdc] =
        await Promise.all([
          getCompressedTokenBalance(lightRpc, owner, null),
          getCompressedTokenBalance(lightRpc, owner, usdcMint),
          connection.getBalance(owner, "confirmed"),
          getPublicUsdcBalance({ connection, owner }),
        ]);

      setBalances({
        SOL: {
          symbol: "SOL",
          mint: null,
          shieldedBalance: shieldedSol,
          publicBalance: humanizeLamports(publicSolLamports),
          decimals: SOL_DECIMALS,
        },
        USDC: {
          symbol: "USDC",
          mint: usdcMint,
          shieldedBalance: shieldedUsdc,
          publicBalance: publicUsdc,
          decimals: USDC_DECIMALS,
        },
      });
    } catch (e: unknown) {
      const message =
        e instanceof Error
          ? e.message
          : typeof e === "string"
            ? e
            : JSON.stringify(e);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [connection, wallet.connected, wallet.publicKey]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    selectedToken,
    setSelectedToken,
    balances,
    isLoading,
    error,
    refresh,
  };
}
