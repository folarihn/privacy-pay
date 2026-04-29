"use client";

import { LightSystemProgram } from "@lightprotocol/stateless.js";
import type { PaymentNotification } from "./types";
import { DEFAULT_SOLANA_CLUSTER, getExplorerTxUrl } from "@/lib/constants";

type NotificationListener = (notification: PaymentNotification) => void;

type RpcNotification = {
  method?: string;
  params?: unknown;
  result?: unknown;
};

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function getWsUrl(): string {
  const rpcUrl =
    process.env.NEXT_PUBLIC_RPC_URL ?? process.env.NEXT_PUBLIC_HELIUS_RPC_URL ?? "";
  const apiKey = rpcUrl.match(/api-key=([^&]+)/)?.[1];
  if (!apiKey) {
    console.warn("[Notifications] No Helius API key found — notifications disabled");
    return "";
  }
  const host =
    DEFAULT_SOLANA_CLUSTER === "devnet"
      ? "atlas-devnet.helius-rpc.com"
      : "atlas-mainnet.helius-rpc.com";
  return `wss://${host}/?api-key=${apiKey}`;
}

function tryExtractSignature(value: unknown): string | null {
  if (typeof value !== "object" || value === null) return null;
  const obj = value as Record<string, unknown>;

  if (typeof obj.signature === "string") return obj.signature;
  if (typeof obj.transaction === "object" && obj.transaction !== null) {
    const tx = obj.transaction as Record<string, unknown>;
    if (typeof tx.signatures === "object" && Array.isArray(tx.signatures) && typeof tx.signatures[0] === "string") {
      return tx.signatures[0];
    }
  }

  if (typeof obj.value === "object" && obj.value !== null) {
    const v = obj.value as Record<string, unknown>;
    if (typeof v.signature === "string") return v.signature;
  }

  return null;
}

export class HeliusWebSocketService {
  private ws: WebSocket | null = null;
  private listeners: Set<NotificationListener> = new Set();
  private watchedAddress: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private isIntentionallyClosed = false;

  connect(walletAddress: string): void {
    if (!walletAddress) return;

    if (this.watchedAddress === walletAddress && this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    this.watchedAddress = walletAddress;
    this.isIntentionallyClosed = false;
    this.reconnectAttempts = 0;
    this.openConnection();
  }

  private openConnection(): void {
    const wsUrl = getWsUrl();
    if (!wsUrl || !this.watchedAddress) return;

    this.cleanup(false);

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.startHeartbeat();
        this.subscribe();
      };

      this.ws.onmessage = (event) => {
        const data = typeof event.data === "string" ? event.data : "";
        this.handleMessage(data);
      };

      this.ws.onclose = () => {
        this.stopHeartbeat();
        if (!this.isIntentionallyClosed) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (error) => {
        console.warn("[Notifications] WebSocket error:", error);
      };
    } catch (e) {
      console.warn("[Notifications] Failed to open WebSocket:", e);
    }
  }

  private subscribe(): void {
    if (!this.ws || !this.watchedAddress) return;

    const wallet = this.watchedAddress;
    const lightProgramId = LightSystemProgram.programId.toBase58();

    this.ws.send(
      JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "accountSubscribe",
        params: [wallet, { encoding: "jsonParsed", commitment: "confirmed" }],
      }),
    );

    this.ws.send(
      JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "transactionSubscribe",
        params: [
          { accountInclude: [wallet], vote: false, failed: false },
          {
            commitment: "confirmed",
            encoding: "jsonParsed",
            transactionDetails: "full",
            maxSupportedTransactionVersion: 0,
          },
        ],
      }),
    );

    this.ws.send(
      JSON.stringify({
        jsonrpc: "2.0",
        id: 3,
        method: "transactionSubscribe",
        params: [
          { accountInclude: [lightProgramId], vote: false, failed: false },
          {
            commitment: "confirmed",
            encoding: "jsonParsed",
            transactionDetails: "full",
            maxSupportedTransactionVersion: 0,
          },
        ],
      }),
    );
  }

  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data) as RpcNotification;
      if (message.result !== undefined) return;
      if (message.method === "pong") return;

      const method = message.method;
      const params = message.params as { result?: unknown } | undefined;

      if (method === "transactionNotification" && params?.result) {
        this.processTransaction(params.result);
        return;
      }

      if (method === "accountNotification" && params?.result) {
        this.processAccountChange();
      }
    } catch {
      return;
    }
  }

  private processTransaction(tx: unknown): void {
    const signature = tryExtractSignature(tx);
    if (!signature) return;

    const notification: PaymentNotification = {
      id: crypto.randomUUID(),
      type: "payment_received",
      title: "New transaction detected",
      message: "Your shielded wallet has new activity. Refresh to see your updated balance.",
      signature,
      amount: null,
      token: null,
      timestamp: Date.now(),
      read: false,
      explorerUrl: getExplorerTxUrl(signature, DEFAULT_SOLANA_CLUSTER),
    };

    this.emit(notification);
  }

  private processAccountChange(): void {
    const notification: PaymentNotification = {
      id: crypto.randomUUID(),
      type: "payment_received",
      title: "Balance updated",
      message: "Your wallet balance has changed. Your shielded balance may have updated.",
      signature: "",
      amount: null,
      token: null,
      timestamp: Date.now(),
      read: false,
      explorerUrl: "",
    };

    this.emit(notification);
  }

  private emit(notification: PaymentNotification): void {
    for (const listener of this.listeners) {
      try {
        listener(notification);
      } catch {
        continue;
      }
    }
  }

  addListener(listener: NotificationListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method: "ping" }));
      }
    }, 30000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (!this.watchedAddress) return;
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn("[Notifications] Max reconnect attempts reached");
      return;
    }

    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 30000);
    this.reconnectAttempts += 1;

    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => this.openConnection(), delay);
  }

  disconnect(): void {
    this.isIntentionallyClosed = true;
    this.watchedAddress = null;
    this.cleanup(true);
  }

  private cleanup(clearListeners: boolean): void {
    this.stopHeartbeat();

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onclose = null;
      this.ws.onerror = null;

      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close();
      }

      this.ws = null;
    }

    if (clearListeners) this.listeners.clear();
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  get isWatching(): boolean {
    return !!this.watchedAddress;
  }

  async waitForConnection(timeoutMs = 5000): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (this.isConnected) return true;
      await sleep(200);
    }
    return false;
  }
}

export const heliusWs = new HeliusWebSocketService();
