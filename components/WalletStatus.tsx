"use client";

import dynamic from "next/dynamic";
import { useWallet } from "@solana/wallet-adapter-react";

const WalletMultiButton = dynamic(
  async () => (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false }
);

function shorten(value: string) {
  if (!value) return "";
  if (value.length <= 10) return value;
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

export function WalletStatus() {
  const { connected, publicKey } = useWallet();

  const label = connected ? shorten(publicKey?.toBase58() ?? "") : "Connect Wallet";
  const className = connected
    ? "cipher-btn-ghost !h-[34px] !px-4 !py-0 !text-[13px] !font-mono"
    : "cipher-btn-primary !h-[34px] !px-4 !py-0 !text-[13px]";

  return (
    <WalletMultiButton className={className}>
      {label}
    </WalletMultiButton>
  );
}
