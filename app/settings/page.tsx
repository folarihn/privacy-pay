"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { InboxKeySection } from "@/components/InboxKeySection";
import type { RiskCheckResult } from "@/lib/compliance";

export default function SettingsPage() {
  const [compliance, setCompliance] = useState<RiskCheckResult | null>(null);
  const [isLoadingCompliance, setIsLoadingCompliance] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function check() {
      setIsLoadingCompliance(true);
      try {
        const res = await fetch(
          "/api/compliance/check?address=11111111111111111111111111111111",
          { method: "GET" },
        );
        const data = (await res.json()) as unknown;
        if (typeof data === "object" && data !== null && "mock" in data) {
          if (mounted) setCompliance(data as RiskCheckResult);
        } else {
          if (mounted) setCompliance(null);
        }
      } catch {
        if (mounted) setCompliance(null);
      } finally {
        if (mounted) setIsLoadingCompliance(false);
      }
    }
    void check();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <main className="min-h-screen bg-[color:var(--color-bg)] px-6 pt-[104px] pb-12 text-[color:var(--color-text-secondary)]">
      <div className="mx-auto w-full max-w-[580px]">
        <div className="mb-7">
          <h1 className="text-[24px] font-semibold text-[color:var(--color-text-primary)]">
            Settings
          </h1>
          <p className="mt-1 text-[14px] text-[color:var(--color-text-secondary)]">
            Manage your local encryption keys.
          </p>
          <div className="mt-1.5 flex items-center gap-[6px] text-[13px] text-[color:var(--color-amber)]">
            <WarningMark />
            Warning: losing these keys means you cannot decrypt past memos.
          </div>
        </div>

        <InboxKeySection />

        <div className="cipher-card mt-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[15px] font-medium text-[color:var(--color-text-primary)]">
                Compliance screening
              </div>
              <div className="mt-1 text-[13px] text-[color:var(--color-text-secondary)]">
                Range Protocol wallet screening
              </div>
            </div>
            <span className="cipher-badge-active">ACTIVE</span>
          </div>

          <div className="mt-4 flex items-center gap-2 text-[13px] text-[color:var(--color-text-secondary)]">
            <span className="h-2 w-2 rounded-full bg-[color:var(--color-emerald)]" />
            Screening enabled for all outgoing transfers
          </div>

          <div className="mt-2 text-[12px]">
            {isLoadingCompliance && (
              <span className="text-[color:var(--color-text-muted)]">Checking Range API...</span>
            )}
            {!isLoadingCompliance && compliance?.mock === false && (
              <span className="text-[color:var(--color-emerald)]">
                Connected to Range Protocol API
              </span>
            )}
            {!isLoadingCompliance && compliance?.mock === true && (
              <span className="text-[color:var(--color-amber)]">
                Running in mock mode —{" "}
                <Link
                  href="/compliance"
                  className="text-[color:var(--color-amber)] underline underline-offset-2 hover:text-[color:var(--color-text-primary)] transition-colors duration-150"
                >
                  configure API key
                </Link>
              </span>
            )}
            {!isLoadingCompliance && !compliance && (
              <span className="text-[color:var(--color-text-muted)]">
                Unable to verify Range connection
              </span>
            )}
          </div>

          <div className="my-4 h-px w-full bg-[color:var(--color-border-subtle)]" />

          <Link
            href="/compliance"
            className="cipher-btn-ghost inline-flex items-center justify-center px-4 py-2 text-[13px]"
          >
            View compliance policy →
          </Link>
        </div>
      </div>
    </main>
  );
}

function WarningMark() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 9v5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M12 17h.01"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M10.3 4.7 2.9 18.5A2 2 0 0 0 4.7 21h14.6a2 2 0 0 0 1.8-2.5L13.7 4.7a2 2 0 0 0-3.4 0Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}
