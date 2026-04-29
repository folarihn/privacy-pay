import { Suspense } from "react";
import { PayPageClient } from "@/components/PayPageClient";

export const dynamic = "force-dynamic";

export default function PayPage() {
  return (
    <Suspense fallback={
      <main className="flex min-h-screen items-center justify-center bg-black px-4 py-8 text-slate-50">
        <p className="text-sm text-slate-400">Loading...</p>
      </main>
    }
    >
      <PayPageClient />
    </Suspense>
  );
}

