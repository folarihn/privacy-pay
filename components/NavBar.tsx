"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletStatus } from "@/components/WalletStatus";
import { LayoutDashboard, Inbox, Settings, Infinity } from "lucide-react";

function MobileNavLink({ href, active, icon: Icon, label }: { href: string; active: boolean; icon: React.ElementType; label: string }) {
  return (
    <Link
      href={href}
      className={`flex flex-col items-center justify-center w-full py-2 transition-colors ${
        active ? "text-solana-green" : "text-slate-400 hover:text-slate-200"
      }`}
    >
      <Icon className={`w-5 h-5 mb-0.5 ${active ? "stroke-[2.5px]" : "stroke-2"}`} />
      <span className="text-[10px] font-medium">{label}</span>
    </Link>
  );
}

export function NavBar() {
  const pathname = usePathname();

  const isDashboard = pathname.startsWith("/dashboard");
  const isInbox = pathname.startsWith("/inbox");
  const isSettings = pathname.startsWith("/settings");

  // App routes use the sidebar — hide the floating top pill
  const isAppRoute = isDashboard || isInbox || isSettings;

  return (
    <>
      {!isAppRoute && (
        <header className="fixed top-6 left-0 right-0 z-50 flex justify-center w-full px-4">
          <div className="flex items-center justify-between w-full max-w-3xl px-6 py-3 border rounded-[2rem] bg-[#111111]/90 backdrop-blur-md border-white/10 shadow-2xl">

            <Link href="/" className="flex items-center text-white hover:opacity-80 transition-opacity">
              <Infinity className="w-8 h-8 stroke-[2.5]" />
            </Link>

            <span
              style={{ fontFamily: "var(--font-hago)" }}
              className="absolute left-1/2 -translate-x-1/2 text-2xl font-bold text-white tracking-wide"
            >
              CipherPay
            </span>

            <div className="[&_.wallet-adapter-button]:!bg-white [&_.wallet-adapter-button]:!text-black [&_.wallet-adapter-button]:!rounded-full [&_.wallet-adapter-button]:!font-bold [&_.wallet-adapter-button]:!px-6 [&_.wallet-adapter-button]:!h-10 hover:[&_.wallet-adapter-button]:!bg-gray-200 transition-colors">
              <WalletStatus />
            </div>

          </div>
        </header>
      )}

      {/* Mobile bottom nav — all app pages */}
      {isAppRoute && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-xl border-t border-white/10">
          <div className="flex items-center justify-around h-16 px-2">
            <MobileNavLink href="/dashboard" active={isDashboard} icon={LayoutDashboard} label="Dashboard" />
            <MobileNavLink href="/inbox" active={isInbox} icon={Inbox} label="Inbox" />
            <MobileNavLink href="/settings" active={isSettings} icon={Settings} label="Settings" />
          </div>
        </nav>
      )}
    </>
  );
}
