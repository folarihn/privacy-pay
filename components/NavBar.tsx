"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { NotificationBell } from "@/components/NotificationBell";
import { WalletStatus } from "@/components/WalletStatus";

export function NavBar() {
  const pathname = usePathname();
  const { connected } = useWallet();

  const isDashboard = pathname === "/dashboard";
  const isInbox = pathname === "/inbox";
  const isSettings = pathname === "/settings";

  const linkBase =
    "text-[14px] text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)] transition-colors duration-150 no-underline";

  return (
    <header className="fixed left-0 top-0 z-50 h-14 w-full border-b border-[color:var(--color-border-subtle)] bg-[rgba(9,9,11,0.85)] backdrop-blur-[12px]">
      <div className="mx-auto flex h-14 w-full max-w-[1200px] items-center justify-between px-6">
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="text-[15px] font-medium text-[color:var(--color-text-primary)] no-underline"
          >
            Cipher Pay
          </Link>
          <span className="cipher-badge-devnet">Devnet</span>
        </div>

        <nav className="flex items-center gap-6">
          <Link
            href="/dashboard"
            className={`${linkBase} ${isDashboard ? "text-[color:var(--color-text-primary)] font-medium" : ""}`}
          >
            Dashboard
          </Link>
          <Link
            href="/inbox"
            className={`${linkBase} ${isInbox ? "text-[color:var(--color-text-primary)] font-medium" : ""}`}
          >
            Inbox
          </Link>
          <Link
            href="/settings"
            className={`${linkBase} ${isSettings ? "text-[color:var(--color-text-primary)] font-medium" : ""}`}
          >
            Settings
          </Link>
        </nav>

        <div className="flex items-center justify-end gap-2">
          {connected && <NotificationBell />}
          <WalletStatus />
        </div>
      </div>
    </header>
  );
}
