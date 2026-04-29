import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function getHeliusApiKey(): string {
  const rpcUrl = process.env.HELIUS_RPC_URL ?? process.env.NEXT_PUBLIC_RPC_URL ?? "";
  return rpcUrl.match(/api-key=([^&]+)/)?.[1] ?? process.env.HELIUS_API_KEY ?? "";
}

const HELIUS_API_BASE = "https://api-devnet.helius-rpc.com/v0";

type RegisterBody = {
  walletAddress?: string;
  webhookUrl?: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RegisterBody;
    const walletAddress = body.walletAddress;
    const webhookUrl = body.webhookUrl;

    if (!walletAddress || !webhookUrl) {
      return NextResponse.json(
        { error: "walletAddress and webhookUrl required" },
        { status: 400 },
      );
    }

    const apiKey = getHeliusApiKey();
    if (!apiKey) {
      return NextResponse.json(
        { error: "Helius API key not configured", mock: true },
        { status: 200 },
      );
    }

    const existingWebhookId = process.env.HELIUS_WEBHOOK_ID;
    const authHeader = process.env.HELIUS_WEBHOOK_AUTH_TOKEN ?? "";

    if (existingWebhookId) {
      const response = await fetch(
        `${HELIUS_API_BASE}/webhooks/${existingWebhookId}?api-key=${apiKey}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            webhookURL: webhookUrl,
            transactionTypes: ["Any"],
            accountAddresses: [walletAddress],
            webhookType: "enhanced",
            authHeader,
          }),
        },
      );

      const data = (await response.json()) as { webhookID?: string; webhookId?: string };
      const webhookId = data.webhookID ?? data.webhookId ?? existingWebhookId;
      console.log("[Webhook] Updated webhook:", webhookId);
      return NextResponse.json({ success: true, webhookId });
    }

    const response = await fetch(`${HELIUS_API_BASE}/webhooks?api-key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        webhookURL: webhookUrl,
        transactionTypes: ["Any"],
        accountAddresses: [walletAddress],
        webhookType: "enhanced",
        authHeader,
      }),
    });

    const data = (await response.json()) as { webhookID?: string; webhookId?: string };
    const webhookId = data.webhookID ?? data.webhookId ?? "";
    console.log("[Webhook] Created webhook:", webhookId);

    if (webhookId) {
      console.log("[Webhook] IMPORTANT: Add to .env.local:\n" + `HELIUS_WEBHOOK_ID=${webhookId}`);
    }

    return NextResponse.json({
      success: true,
      webhookId,
      note: "Add HELIUS_WEBHOOK_ID to your .env.local",
    });
  } catch (e) {
    console.error("[Webhook] Registration error:", e);
    const message = e instanceof Error ? e.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

