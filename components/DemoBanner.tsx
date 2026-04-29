"use client";

import { useDemoMode } from "@/hooks/useDemoMode";

function Dot() {
  return <span className="demo-mode-dot h-2 w-2 rounded-full bg-[color:var(--color-amber)]" />;
}

export function DemoBanner() {
  const { isDemoMode, activeDemoWallet, setActiveDemoWallet } = useDemoMode();

  if (!isDemoMode) return null;

  const pillBase =
    "cursor-pointer rounded-[20px] px-3 py-[3px] text-[12px] transition-all duration-150";

  const active = "bg-[color:var(--color-amber)] text-black font-medium";
  const inactive =
    "text-[color:var(--color-amber)] border border-[rgba(245,158,11,0.4)] bg-transparent";

  return (
    <>
      <style jsx global>{`
        @keyframes demoDotPulse {
          0% {
            opacity: 1;
          }
          50% {
            opacity: 0.4;
          }
          100% {
            opacity: 1;
          }
        }
        .demo-mode-dot {
          animation: demoDotPulse 1.5s ease-in-out infinite;
        }
      `}</style>
      <div className="w-full border-b border-[rgba(245,158,11,0.3)] bg-[color:var(--color-amber-dim)] px-6 py-[10px]">
        <div className="mx-auto flex w-full max-w-[1200px] items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <Dot />
            <div className="text-[13px] text-[color:var(--color-amber)]">
              Demo mode — viewing pre-seeded wallets. Connect a wallet to use the real app.
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className={`${pillBase} ${activeDemoWallet === "alice" ? active : inactive}`}
              onClick={() => setActiveDemoWallet("alice")}
            >
              Alice
            </button>
            <button
              type="button"
              className={`${pillBase} ${activeDemoWallet === "bob" ? active : inactive}`}
              onClick={() => setActiveDemoWallet("bob")}
            >
              Bob
            </button>
            <button
              type="button"
              className={`${pillBase} ${activeDemoWallet === "carol" ? active : inactive}`}
              onClick={() => setActiveDemoWallet("carol")}
            >
              Carol
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
