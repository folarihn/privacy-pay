import { InboxKeySection } from "@/components/InboxKeySection";

export default function SettingsPage() {
  return (
    <div className="flex flex-col flex-1 overflow-hidden text-white">

      {/* Header bar — matches dashboard */}
      <div className="flex items-center justify-between px-6 h-[65px] border-b border-white/[0.06] shrink-0">
        <h1 className="text-lg font-bold text-white">Settings</h1>
        <span className="text-xs text-red-400/70">Losing keys = losing access to past memos</span>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-6 pb-24 md:pb-6">
        <div className="max-w-xl space-y-6">
          <p className="text-sm text-slate-400">
            Manage your local encryption keys. Keys are derived from your wallet signature and never leave your device.
          </p>
          <InboxKeySection />
        </div>
      </div>

    </div>
  );
}

