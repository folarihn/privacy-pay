export type NotificationType =
  | "payment_received"
  | "payment_sent"
  | "shield_complete"
  | "unshield_complete";

export interface PaymentNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  signature: string;
  amount: number | null;
  token: "SOL" | "USDC" | null;
  timestamp: number;
  read: boolean;
  explorerUrl: string;
}

export interface NotificationState {
  notifications: PaymentNotification[];
  unreadCount: number;
  isConnected: boolean;
  isWatching: boolean;
}
