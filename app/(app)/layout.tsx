import type { ReactNode } from "react";
import { Suspense } from "react";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { ThemeProvider } from "@/components/ThemeProvider";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <Suspense
        fallback={
          <div className="hidden md:block w-[220px] shrink-0 border-r border-black/[0.06] dark:border-white/[0.06]" />
        }
      >
        <DashboardSidebar />
      </Suspense>
      {children}
    </ThemeProvider>
  );
}
