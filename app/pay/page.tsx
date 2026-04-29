import { Suspense } from "react";
import { PayPageClient } from "@/components/PayPageClient";

export const dynamic = "force-dynamic";

export default function PayPage() {
  return (
    <Suspense fallback={
      <main className="flex min-h-screen items-center justify-center bg-[#09090B] px-4 py-8 text-[#A1A1AA]">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#27272A] bg-[#111113] px-4 py-2 text-sm">
          Loading pay link
          <span className="inline-flex items-center gap-1">
            <span className="cipher-loading-dot" />
            <span className="cipher-loading-dot" />
            <span className="cipher-loading-dot" />
          </span>
        </div>
      </main>
    }
    >
      <PayPageClient />
    </Suspense>
  );
}
