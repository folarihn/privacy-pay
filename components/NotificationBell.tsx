"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNotifications } from "@/hooks/useNotifications";

function relativeTime(ts: number) {
  const diff = Math.max(0, Date.now() - ts);
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function BellIcon(props: { className?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true" className={props.className}>
      <path
        d="M12 22a2 2 0 0 0 2-2H10a2 2 0 0 0 2 2Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M18 16H6l1.2-1.4c.5-.6.8-1.3.8-2.1V10a4 4 0 1 1 8 0v2.5c0 .8.3 1.5.8 2.1L18 16Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M9 6a3 3 0 0 1 6 0"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CircleIcon(props: { children: ReactNode; className?: string }) {
  return (
    <div className={`flex h-7 w-7 items-center justify-center rounded-full ${props.className ?? ""}`}>
      {props.children}
    </div>
  );
}

function ArrowIn() {
  return <span className="text-[14px] leading-none">←</span>;
}
function ArrowOut() {
  return <span className="text-[14px] leading-none">→</span>;
}
function Shield() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3 19 6.5v6.1c0 5.1-3.4 8.7-7 9.9-3.6-1.2-7-4.8-7-9.9V6.5L12 3Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function Unlock() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M7 11V8.5a5 5 0 0 1 9.6-2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M6.75 11h10.5c.966 0 1.75.784 1.75 1.75v6.5c0 .966-.784 1.75-1.75 1.75H6.75A1.75 1.75 0 0 1 5 19.25v-6.5c0-.966.784-1.75 1.75-1.75Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function NotificationBell() {
  const { notifications, unreadCount, isConnected, isWatching, markAllRead, markRead, clearAll } =
    useNotifications();

  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      const node = ref.current;
      if (!node) return;
      if (e.target instanceof Node && !node.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [open]);

  const badgeText = useMemo(() => {
    if (unreadCount <= 0) return "";
    return unreadCount > 9 ? "9+" : String(unreadCount);
  }, [unreadCount]);

  const bellColor = useMemo(() => {
    if (!isWatching) return "text-[color:var(--color-text-secondary)]";
    if (!isConnected) return "text-[color:var(--color-text-muted)]";
    return "text-[color:var(--color-text-secondary)]";
  }, [isConnected, isWatching]);

  const connectionDot = useMemo(() => {
    if (!isWatching) return "bg-[color:var(--color-border)]";
    if (!isConnected) return "bg-[color:var(--color-amber)]";
    return "bg-[color:var(--color-emerald)]";
  }, [isConnected, isWatching]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-[var(--radius-md)] p-[6px] transition-colors duration-150 hover:bg-[color:var(--color-surface)]"
        aria-label="Notifications"
      >
        <BellIcon className={`${bellColor} transition-colors duration-150 hover:text-[color:var(--color-text-primary)]`} />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 inline-flex min-w-[16px] items-center justify-center rounded-full bg-[color:var(--color-accent)] px-[4px] py-[2px] font-mono text-[10px] font-medium text-white">
            {badgeText}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-[calc(100%+8px)] z-[100] w-[320px] max-h-[400px] overflow-y-auto rounded-[var(--radius-lg)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
          role="dialog"
          aria-label="Notifications"
        >
          <div className="flex items-center justify-between gap-3 border-b border-[color:var(--color-border-subtle)] px-4 py-[14px]">
            <div className="text-[14px] font-medium text-[color:var(--color-text-primary)]">
              Notifications
            </div>
            <div className="flex items-center gap-2">
              <span className={`h-[6px] w-[6px] rounded-full ${connectionDot}`} />
              {unreadCount > 0 && (
                <button
                  type="button"
                  className="cipher-btn-ghost px-2 py-[2px] text-[11px]"
                  onClick={() => markAllRead()}
                >
                  Mark all read
                </button>
              )}
            </div>
          </div>

          {notifications.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <div className="mx-auto w-fit text-[color:var(--color-border)]">
                <BellIcon className="h-7 w-7" />
              </div>
              <div className="mt-2 text-[13px] text-[color:var(--color-text-muted)]">
                No notifications yet
              </div>
              <div className="mt-1 text-[12px] text-[color:var(--color-text-muted)]">
                Notifications appear when your wallet receives activity
              </div>
            </div>
          ) : (
            <>
              <div>
                {notifications.map((n, idx) => {
                  const bg = n.read ? "bg-transparent" : "bg-[rgba(124,58,237,0.06)]";
                  const border =
                    idx === notifications.length - 1
                      ? ""
                      : "border-b border-[color:var(--color-border-subtle)]";

                  const icon = (() => {
                    if (n.type === "payment_received")
                      return (
                        <CircleIcon className="bg-[rgba(16,185,129,0.12)] text-[color:var(--color-emerald)]">
                          <ArrowIn />
                        </CircleIcon>
                      );
                    if (n.type === "payment_sent")
                      return (
                        <CircleIcon className="bg-[rgba(124,58,237,0.12)] text-[color:var(--color-accent)]">
                          <ArrowOut />
                        </CircleIcon>
                      );
                    if (n.type === "shield_complete")
                      return (
                        <CircleIcon className="bg-[rgba(124,58,237,0.12)] text-[color:var(--color-accent)]">
                          <Shield />
                        </CircleIcon>
                      );
                    return (
                      <CircleIcon className="bg-[rgba(245,158,11,0.12)] text-[color:var(--color-amber)]">
                        <Unlock />
                      </CircleIcon>
                    );
                  })();

                  return (
                    <div
                      key={n.id}
                      className={`cursor-pointer px-4 py-3 transition-colors duration-150 hover:bg-[color:var(--color-bg)] ${bg} ${border}`}
                      onClick={() => markRead(n.id)}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="flex items-start gap-[10px]">
                        {icon}
                        <div className="min-w-0 flex-1">
                          <div className="text-[13px] font-medium text-[color:var(--color-text-primary)]">
                            {n.title}
                          </div>
                          <div className="mt-1 text-[12px] leading-[1.5] text-[color:var(--color-text-secondary)]">
                            {n.message}
                          </div>
                          <div className="mt-2 flex items-center justify-between gap-3">
                            <div className="text-[11px] text-[color:var(--color-text-muted)]">
                              {relativeTime(n.timestamp)}
                            </div>
                            {n.signature && n.explorerUrl && (
                              <a
                                href={n.explorerUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[11px] text-[color:var(--color-accent)] hover:text-[color:var(--color-text-primary)] transition-colors duration-150"
                                onClick={(e) => e.stopPropagation()}
                              >
                                View tx →
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-[color:var(--color-border-subtle)] px-4 py-[10px]">
                <button
                  type="button"
                  onClick={() => clearAll()}
                  className="cursor-pointer bg-transparent p-0 text-[12px] text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text-primary)] transition-colors duration-150"
                >
                  Clear all
                </button>
                <div className="text-[12px] text-[color:var(--color-text-muted)]">
                  {notifications.length} notification{notifications.length === 1 ? "" : "s"}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
