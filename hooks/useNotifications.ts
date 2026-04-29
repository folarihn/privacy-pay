"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { heliusWs, type NotificationState, type PaymentNotification } from "@/lib/notifications";

export function useNotifications() {
  const { publicKey, connected } = useWallet();

  const [state, setState] = useState<NotificationState>({
    notifications: [],
    unreadCount: 0,
    isConnected: false,
    isWatching: false,
  });

  useEffect(() => {
    if (!connected || !publicKey) {
      heliusWs.disconnect();
      void Promise.resolve().then(() => {
        setState((prev) => ({ ...prev, isConnected: false, isWatching: false }));
      });
      return;
    }

    heliusWs.connect(publicKey.toBase58());
    void Promise.resolve().then(() => {
      setState((prev) => ({ ...prev, isWatching: true }));
    });

    const host = typeof window !== "undefined" ? window.location.hostname : "";
    const isLocal =
      host.includes("localhost") || host === "127.0.0.1" || host === "" || host.endsWith(".local");

    if (!isLocal) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin;
      void fetch("/api/notifications/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: publicKey.toBase58(),
          webhookUrl: `${appUrl}/api/notifications/webhook`,
        }),
      })
        .then((r) => r.json())
        .then((data: unknown) => {
          if (typeof data === "object" && data !== null && "webhookId" in data) {
            const webhookId = (data as { webhookId?: unknown }).webhookId;
            if (typeof webhookId === "string" && webhookId) {
              console.log("[Notifications] Webhook registered:", webhookId);
            }
          }
        })
        .catch((e: unknown) => {
          console.warn("[Notifications] Webhook registration failed:", e);
        });
    }

    const unsubscribe = heliusWs.addListener((notification: PaymentNotification) => {
      setState((prev) => {
        const notifications = [notification, ...prev.notifications].slice(0, 50);
        const unreadCount = notifications.filter((n) => !n.read).length;
        return { ...prev, notifications, unreadCount, isConnected: heliusWs.isConnected };
      });
    });

    const statusInterval = setInterval(() => {
      setState((prev) => ({ ...prev, isConnected: heliusWs.isConnected, isWatching: heliusWs.isWatching }));
    }, 5000);

    return () => {
      unsubscribe();
      clearInterval(statusInterval);
    };
  }, [connected, publicKey]);

  function markAllRead(): void {
    setState((prev) => ({
      ...prev,
      unreadCount: 0,
      notifications: prev.notifications.map((n) => ({ ...n, read: true })),
    }));
  }

  function markRead(id: string): void {
    setState((prev) => {
      const notifications = prev.notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
      const unreadCount = notifications.filter((n) => !n.read).length;
      return { ...prev, notifications, unreadCount };
    });
  }

  function clearAll(): void {
    setState((prev) => ({ ...prev, notifications: [], unreadCount: 0 }));
  }

  return { ...state, markAllRead, markRead, clearAll };
}
