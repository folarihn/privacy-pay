import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

interface HeliusWebhookPayload {
  signature: string;
  type: string;
  timestamp: number;
  fee: number;
  feePayer: string;
  nativeTransfers?: Array<{
    fromUserAccount: string;
    toUserAccount: string;
    amount: number;
  }>;
  tokenTransfers?: Array<{
    fromUserAccount: string;
    toUserAccount: string;
    mint: string;
    tokenAmount: number;
  }>;
  accountData?: Array<{
    account: string;
    nativeBalanceChange: number;
  }>;
}

async function processWebhookTransaction(tx: HeliusWebhookPayload): Promise<void> {
  console.log("[Webhook] Processing tx type:", tx.type);
  console.log("[Webhook] Native transfers:", tx.nativeTransfers?.length ?? 0);
  console.log("[Webhook] Token transfers:", tx.tokenTransfers?.length ?? 0);
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const expectedToken = process.env.HELIUS_WEBHOOK_AUTH_TOKEN;

    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = (await request.json()) as unknown;
    if (!Array.isArray(payload)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    for (const item of payload) {
      if (typeof item !== "object" || item === null) continue;
      const tx = item as Partial<HeliusWebhookPayload>;
      if (!tx.signature || typeof tx.signature !== "string") continue;
      console.log("[Webhook] Received transaction:", tx.signature);
      await processWebhookTransaction(tx as HeliusWebhookPayload);
    }

    return NextResponse.json({ received: true });
  } catch (e) {
    console.error("[Webhook] Error processing:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: "Cipher Pay webhook receiver active" });
}

