"use client";

import Link from "next/link";
import { useState } from "react";
import { InboxKeySection } from "@/components/InboxKeySection";
import { PaymentLinkCreator } from "@/components/PaymentLinkCreator";
import { ShieldedBalance } from "@/components/ShieldedBalance";
import { ContactBook } from "@/components/ContactBook";

export default function Home() {
  const [activeTab, setActiveTab] = useState<'shield' | 'keys' | 'link' | 'contacts'>('shield');

  const descriptions: Record<typeof activeTab, string> = {
    shield: "Manage your private assets with Zero-Knowledge compression. Shield public SOL, send privately, or unshield back to your wallet.",
    link: "Generate secure payment links with end-to-end encrypted memos. Share links to receive funds privately.",
    keys: "Manage your inbox encryption keys. Your keys are derived from your wallet signature and never leave your device.",
    contacts: "Save frequent addresses and their encryption keys for easy access.",
  };

  return (
    <main className="min-h-screen bg-[#09090B] pt-24 md:pt-28 pb-24 md:pb-10 text-[#A1A1AA]">
      <div className="mx-auto w-full max-w-5xl px-4 md:px-8">
        <div className="mb-8 md:mb-10">
          <div className="text-[11px] font-mono uppercase tracking-[0.1em] text-[#71717A]">
            Dashboard
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#FAFAFA] md:text-4xl">
            Cipher Pay
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#A1A1AA]">
            {descriptions[activeTab]}
          </p>
        </div>

        <div className="mb-6 flex items-center justify-between gap-4">
          <div
            className="inline-flex rounded-[10px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-[3px]"
            role="tablist"
          >
            <button
              onClick={() => setActiveTab("shield")}
              className={`cursor-pointer rounded-[8px] px-[18px] py-[8px] text-[14px] font-medium transition-all duration-150 ${
                activeTab === "shield"
                  ? "bg-[color:var(--color-accent)] text-white"
                  : "text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)]"
              }`}
              role="tab"
              aria-selected={activeTab === "shield"}
            >
              Shielded Wallet
            </button>
            <button
              onClick={() => setActiveTab("link")}
              className={`cursor-pointer rounded-[8px] px-[18px] py-[8px] text-[14px] font-medium transition-all duration-150 ${
                activeTab === "link"
                  ? "bg-[color:var(--color-accent)] text-white"
                  : "text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)]"
              }`}
              role="tab"
              aria-selected={activeTab === "link"}
            >
              Request Payment
            </button>
            <button
              onClick={() => setActiveTab("contacts")}
              className={`cursor-pointer rounded-[8px] px-[18px] py-[8px] text-[14px] font-medium transition-all duration-150 ${
                activeTab === "contacts"
                  ? "bg-[color:var(--color-accent)] text-white"
                  : "text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)]"
              }`}
              role="tab"
              aria-selected={activeTab === "contacts"}
            >
              Contacts
            </button>
            <button
              onClick={() => setActiveTab("keys")}
              className={`cursor-pointer rounded-[8px] px-[18px] py-[8px] text-[14px] font-medium transition-all duration-150 ${
                activeTab === "keys"
                  ? "bg-[color:var(--color-accent)] text-white"
                  : "text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)]"
              }`}
              role="tab"
              aria-selected={activeTab === "keys"}
            >
              Inbox Keys
            </button>
          </div>

          <Link
            href="/batch"
            className="text-[13px] text-[color:var(--color-text-muted)] hover:text-[color:var(--color-accent)] transition-colors duration-150"
          >
            ↗ Batch send
          </Link>
        </div>

        <div className="transition-all duration-150">
          {activeTab === "shield" && <ShieldedBalance />}
          {activeTab === "link" && <PaymentLinkCreator />}
          {activeTab === "keys" && <InboxKeySection />}
          {activeTab === "contacts" && <ContactBook />}
        </div>
      </div>
    </main>
  );
}
