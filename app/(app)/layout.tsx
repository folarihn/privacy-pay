import type { ReactNode } from "react";
import { Suspense } from "react";
import { DashboardSidebar } from "@/components/DashboardSidebar";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen text-white overflow-hidden">
      <Suspense
        fallback={
          <div className="hidden md:block w-[220px] shrink-0 border-r border-white/[0.06]" />
        }
      >
        <DashboardSidebar />
      </Suspense>
      {children}
    </div>
  );
}
