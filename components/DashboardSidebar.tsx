"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { LayoutDashboard, Inbox, Users, Settings, Infinity } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";

function NavItem({
  href,
  icon: Icon,
  label,
  active,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
        active
          ? "bg-black/[0.08] dark:bg-white/10 text-black dark:text-white border border-black/15 dark:border-white/15"
          : "text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.04] border border-transparent"
      }`}
    >
      <Icon className="w-4 h-4 shrink-0" />
      {label}
    </Link>
  );
}

export function DashboardSidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const view = searchParams.get("view");

  return (
    <aside className="hidden md:flex w-[220px] shrink-0 flex-col h-full bg-[#f0f0f0] dark:bg-black border-r border-black/[0.06] dark:border-white/[0.06]">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 h-[65px] border-b border-black/[0.06] dark:border-white/[0.06] shrink-0">
        <Infinity className="w-6 h-6 text-black dark:text-white stroke-[2.5]" />
        <span
          style={{ fontFamily: "var(--font-hago)" }}
          className="text-xl font-bold text-black dark:text-white tracking-wide"
        >
          CipherPay
        </span>
      </div>

      {/* Main nav */}
      <div className="px-3 pt-6 flex-1">
        <p className="text-[10px] font-semibold text-black/20 dark:text-white/20 uppercase tracking-widest mb-2 px-2">
          Main
        </p>
        <nav className="space-y-0.5">
          <NavItem
            href="/dashboard"
            icon={LayoutDashboard}
            label="Dashboard"
            active={pathname === "/dashboard" && !view}
          />
          <NavItem
            href="/inbox"
            icon={Inbox}
            label="Inbox"
            active={pathname === "/inbox"}
          />
          <NavItem
            href="/dashboard?view=contacts"
            icon={Users}
            label="Contacts"
            active={pathname === "/dashboard" && view === "contacts"}
          />
        </nav>
      </div>

      {/* Tools nav + theme toggle */}
      <div className="px-3 pb-6 shrink-0">
        <p className="text-[10px] font-semibold text-black/20 dark:text-white/20 uppercase tracking-widest mb-2 px-2">
          Tools
        </p>
        <nav className="space-y-0.5 mb-4">
          <NavItem
            href="/settings"
            icon={Settings}
            label="Settings"
            active={pathname === "/settings"}
          />
        </nav>
        <div className="flex items-center gap-2 px-2">
          <ThemeToggle />
          <span className="text-xs text-black/30 dark:text-white/30">Theme</span>
        </div>
      </div>
    </aside>
  );
}
