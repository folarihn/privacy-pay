"use client";

import { Sun, Moon } from "lucide-react";
import { useTheme } from "./ThemeProvider";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggle } = useTheme();

  return (
    <button
      onClick={toggle}
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className={`w-8 h-8 flex items-center justify-center rounded-xl
        bg-black/[0.05] dark:bg-white/[0.05]
        border border-black/[0.08] dark:border-white/[0.07]
        text-black/40 dark:text-white/40
        hover:text-black dark:hover:text-white
        hover:bg-black/10 dark:hover:bg-white/10
        transition-all duration-200 ${className}`}
    >
      {theme === "dark" ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
    </button>
  );
}
