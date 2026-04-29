"use client";

import dynamic from "next/dynamic";

const UnifiedWalletButton = dynamic(
  async () => (await import("@jup-ag/wallet-adapter")).UnifiedWalletButton,
  { ssr: false }
);

export function WalletStatus() {
  return <UnifiedWalletButton />;
}
