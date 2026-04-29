"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

const WalletMultiButton = dynamic(
  async () => (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false },
);

function ShieldIcon(props: { className?: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={props.className}
    >
      <path
        d="M12 3 19 6.5v6.1c0 5.1-3.4 8.7-7 9.9-3.6-1.2-7-4.8-7-9.9V6.5L12 3Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M9.2 12.2 11 14l3.8-4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LockIcon(props: { className?: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={props.className}
    >
      <path
        d="M7.5 11V8.5a4.5 4.5 0 0 1 9 0V11"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M6.75 11h10.5c.966 0 1.75.784 1.75 1.75v6.5c0 .966-.784 1.75-1.75 1.75H6.75A1.75 1.75 0 0 1 5 19.25v-6.5c0-.966.784-1.75 1.75-1.75Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function KeyIcon(props: { className?: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={props.className}
    >
      <path
        d="M15 8a5 5 0 1 1-3.1 9h-.9l-2.1 2.1H7v1.9H5.1V19l4.1-4.1v-.9A5 5 0 0 1 15 8Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M15 10.5h.01"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function CompliancePage() {
  const wallet = useWallet();
  const isConnected = wallet.connected && !!wallet.publicKey;

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [includeAmounts, setIncludeAmounts] = useState(true);
  const [includeTimestamps, setIncludeTimestamps] = useState(true);
  const [includeRecipients, setIncludeRecipients] = useState(false);
  const [showComingSoon, setShowComingSoon] = useState(false);

  return (
    <main className="min-h-screen bg-[color:var(--color-bg)] px-6 pt-[104px] pb-12 text-[color:var(--color-text-secondary)]">
      <div className="mx-auto w-full max-w-[680px] pt-12">
        <div className="cipher-label">COMPLIANCE</div>
        <h1 className="mt-2 text-[28px] font-semibold text-[color:var(--color-text-primary)]">
          Privacy by default, compliance when required
        </h1>
        <p className="mt-3 text-[16px] leading-[1.7] text-[color:var(--color-text-secondary)]">
          Cipher Pay screens all transactions against OFAC sanctions lists via Range Protocol. Your
          transaction contents remain encrypted — only whether an address is flagged or not is
          checked. No identity, KYC, or transaction history is shared with any third party.
        </p>

        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="cipher-card border-t border-t-[color:var(--color-emerald)]">
            <div className="text-[color:var(--color-emerald)]">
              <ShieldIcon />
            </div>
            <div className="mt-3 text-[14px] font-medium text-[color:var(--color-text-primary)]">
              Pre-send screening
            </div>
            <div className="mt-2 text-[13px] leading-[1.6] text-[color:var(--color-text-secondary)]">
              Every recipient address is checked against Range Protocol&apos;s real-time risk
              database before a transfer is executed. The check returns only a binary safe/flagged
              signal — no transaction details are shared.
            </div>
          </div>

          <div className="cipher-card border-t border-t-[color:var(--color-accent)]">
            <div className="text-[color:var(--color-accent)]">
              <LockIcon />
            </div>
            <div className="mt-3 text-[14px] font-medium text-[color:var(--color-text-primary)]">
              What stays private
            </div>
            <div className="mt-2 text-[13px] leading-[1.6] text-[color:var(--color-text-secondary)]">
              Transaction amounts, memo contents, sender identity, and recipient identity are never
              shared with Range or any third party. Only the recipient&apos;s public wallet address is
              checked.
            </div>
          </div>

          <div className="cipher-card border-t border-t-[color:var(--color-amber)]">
            <div className="text-[color:var(--color-amber)]">
              <KeyIcon />
            </div>
            <div className="mt-3 text-[14px] font-medium text-[color:var(--color-text-primary)]">
              Selective disclosure
            </div>
            <div className="mt-2 text-[13px] leading-[1.6] text-[color:var(--color-text-secondary)]">
              Generate a time-limited viewing key to share specific transactions with auditors,
              accountants, or for tax reporting — without revealing your full history.
            </div>
          </div>
        </div>

        <div className="mt-12 cipher-card">
          <div className="text-[16px] font-medium text-[color:var(--color-text-primary)]">
            Generate a compliance report
          </div>
          <div className="mt-1 text-[13px] text-[color:var(--color-text-secondary)]">
            Export a signed proof of your shielded transactions for a specific date range. Only
            transactions you select are included.
          </div>

          <div className="mt-5 flex flex-col gap-4">
            <div className="flex flex-col gap-3 md:flex-row md:gap-3">
              <div className="flex-1">
                <div className="cipher-label">FROM</div>
                <input
                  type="date"
                  className="cipher-input mt-2 w-full"
                  value={fromDate}
                  max={today}
                  onChange={(e) => {
                    const next = e.target.value;
                    setFromDate(next);
                    if (toDate && next && toDate < next) setToDate(next);
                  }}
                />
              </div>
              <div className="flex-1">
                <div className="cipher-label">TO</div>
                <input
                  type="date"
                  className="cipher-input mt-2 w-full"
                  value={toDate}
                  max={today}
                  min={fromDate || undefined}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </div>
            </div>

            <div>
              <div className="cipher-label">INCLUDE IN REPORT</div>
              <div className="mt-2 flex flex-col gap-2">
                <label className="flex items-center gap-2 text-[13px] text-[color:var(--color-text-secondary)]">
                  <input
                    type="checkbox"
                    checked={includeAmounts}
                    onChange={(e) => setIncludeAmounts(e.target.checked)}
                  />
                  Transaction amounts
                </label>
                <label className="flex items-center gap-2 text-[13px] text-[color:var(--color-text-secondary)]">
                  <input
                    type="checkbox"
                    checked={includeTimestamps}
                    onChange={(e) => setIncludeTimestamps(e.target.checked)}
                  />
                  Transaction timestamps
                </label>
                <label className="flex items-center gap-2 text-[13px] text-[color:var(--color-text-secondary)]">
                  <input
                    type="checkbox"
                    checked={includeRecipients}
                    onChange={(e) => setIncludeRecipients(e.target.checked)}
                  />
                  Recipient addresses (partial — first 4 + last 4 chars)
                </label>
              </div>
              <div className="mt-3 text-[12px] text-[color:var(--color-text-muted)]">
                Memo contents are never included in compliance reports.
              </div>
            </div>

            {!isConnected ? (
              <div className="mt-2 rounded-[var(--radius-lg)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4 border-l-[3px] border-l-[color:var(--color-amber)]">
                <div className="text-[13px] text-[color:var(--color-text-secondary)]">
                  Connect a wallet to generate a compliance report
                </div>
                <div className="mt-3">
                  <WalletMultiButton className="cipher-btn-primary w-full !h-auto !py-3 !text-[14px]">
                    Connect Wallet
                  </WalletMultiButton>
                </div>
              </div>
            ) : (
              <div className="mt-2">
                <button
                  type="button"
                  className="cipher-btn-primary w-full py-3 text-[14px]"
                  onClick={() => setShowComingSoon(true)}
                >
                  Generate signed report
                </button>

                {showComingSoon && (
                  <div className="cipher-card mt-3 px-4 py-4">
                    <div className="text-[13px] leading-[1.6] text-[color:var(--color-text-secondary)]">
                      Report generation is coming in the next release. Your viewing keys are already
                      being derived — transaction export will be available once the report format is
                      finalised.
                    </div>
                    <div className="mt-3 text-[12px] text-[color:var(--color-text-muted)]">
                      Selected: {includeAmounts ? "amounts" : "no amounts"},{" "}
                      {includeTimestamps ? "timestamps" : "no timestamps"},{" "}
                      {includeRecipients ? "recipient partials" : "no recipients"}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 text-center text-[13px] text-[color:var(--color-text-muted)]">
          Compliance screening powered by{" "}
          <a
            href="https://range.org"
            target="_blank"
            rel="noreferrer"
            className="text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)] transition-colors duration-150"
          >
            Range Protocol
          </a>{" "}
          · Binary risk signal only · No KYC required
        </div>

        <div className="mt-6 text-center text-[12px] text-[color:var(--color-text-muted)]">
          <Link
            href="/"
            className="text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)] transition-colors duration-150"
          >
            Back to Cipher Pay →
          </Link>
        </div>
      </div>
    </main>
  );
}
