"use client";

import { useDemoMode } from "@/hooks/useDemoMode";

export function DemoStatsRow() {
  const { demoState } = useDemoMode();

  const count = demoState ? Object.keys(demoState.wallets).length : 3;

  return (
    <div className="mt-20 w-full">
      <div className="w-full border-t border-[color:var(--color-border-subtle)]" />
      <div className="px-6 py-12">
        <div className="mx-auto flex w-full max-w-[960px] flex-col items-center justify-center gap-10 md:flex-row md:gap-12">
          <div className="text-center">
            <div className="text-[32px] font-bold text-[color:var(--color-text-primary)]">
              {count}
            </div>
            <div className="mt-1 text-[13px] text-[color:var(--color-text-muted)]">
              Demo wallets seeded
            </div>
          </div>
          <div className="text-center">
            <div className="text-[32px] font-bold text-[color:var(--color-text-primary)]">ZK</div>
            <div className="mt-1 text-[13px] text-[color:var(--color-text-muted)]">
              Compression level
            </div>
          </div>
          <div className="text-center">
            <div className="text-[32px] font-bold text-[color:var(--color-text-primary)]">E2E</div>
            <div className="mt-1 text-[13px] text-[color:var(--color-text-muted)]">
              Memo encryption
            </div>
          </div>
        </div>
      </div>
      <div className="w-full border-b border-[color:var(--color-border-subtle)]" />
    </div>
  );
}
