import {
  ACTIONS_CORS_HEADERS,
  type ActionGetResponse,
  type ActionPostRequest,
  createPostResponse,
} from "@solana/actions";
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";

const CONNECTION_URL =
  process.env.NEXT_PUBLIC_RPC_URL ?? "https://api.devnet.solana.com";

function decodeBase64UrlToJson(value: string): unknown {
  const b64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  const json = Buffer.from(`${b64}${pad}`, "base64").toString("utf8");
  return JSON.parse(json) as unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const encodedPayload = url.searchParams.get("payload");

  let title = "Cipher Pay — Private Payment";
  let description = "Send a private shielded payment";
  let amountLabel = "";
  let token: "SOL" | "USDC" = "SOL";

  if (encodedPayload) {
    try {
      const parsed = decodeBase64UrlToJson(encodedPayload);
      if (isRecord(parsed)) {
        if (parsed.token === "SOL" || parsed.token === "USDC") {
          token = parsed.token;
        }
        if (typeof parsed.label === "string" && parsed.label.trim()) {
          title = parsed.label;
        }
        if (typeof parsed.amount === "number" && Number.isFinite(parsed.amount) && parsed.amount > 0) {
          amountLabel =
            token === "USDC"
              ? String(parsed.amount / 1_000_000)
              : String(parsed.amount / 1_000_000_000);
        }
      }
    } catch {
      // ignore
    }
  }

  description =
    amountLabel && token
      ? `Pay ${amountLabel} ${token} privately via Cipher Pay`
      : "Send a private shielded payment";

  const response: ActionGetResponse = {
    title,
    icon: `${url.origin}/cipher-pay-icon.svg`,
    description,
    label: amountLabel ? `Pay ${amountLabel} ${token}` : "Pay privately",
    links: {
      actions: [
        {
          type: "transaction",
          label: amountLabel ? `Send ${amountLabel} ${token} privately` : "Send payment privately",
          href: `${url.origin}/api/actions/pay?payload=${encodedPayload ?? ""}`,
        },
      ],
    },
  };

  return Response.json(response, { headers: ACTIONS_CORS_HEADERS });
}

export const OPTIONS = GET;

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const encodedPayload = url.searchParams.get("payload");
    const body = (await request.json()) as ActionPostRequest;

    if (!body.account) {
      return Response.json(
        { error: "Account required" },
        { status: 400, headers: ACTIONS_CORS_HEADERS },
      );
    }

    if (!encodedPayload) {
      return Response.json(
        { error: "Payment payload required" },
        { status: 400, headers: ACTIONS_CORS_HEADERS },
      );
    }

    const senderPubkey = new PublicKey(body.account);
    const connection = new Connection(CONNECTION_URL, "confirmed");

    let recipientPubkey: PublicKey;
    let amountRaw: number;
    let token: "SOL" | "USDC" = "SOL";

    try {
      const payload = decodeBase64UrlToJson(encodedPayload);
      if (!isRecord(payload)) throw new Error("Invalid payload");

      if (payload.token === "SOL" || payload.token === "USDC") {
        token = payload.token;
      }
      if (token !== "SOL") {
        return Response.json(
          { error: "Only SOL is supported via Blink. Open the app for private USDC." },
          { status: 400, headers: ACTIONS_CORS_HEADERS },
        );
      }

      if (typeof payload.recipient !== "string") throw new Error("Invalid recipient");
      recipientPubkey = new PublicKey(payload.recipient);

      if (typeof payload.amount !== "number" || !Number.isFinite(payload.amount) || payload.amount <= 0) {
        throw new Error("Invalid amount");
      }
      amountRaw = payload.amount;
    } catch {
      return Response.json(
        { error: "Invalid payment payload" },
        { status: 400, headers: ACTIONS_CORS_HEADERS },
      );
    }

    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: senderPubkey,
        toPubkey: recipientPubkey,
        lamports: amountRaw,
      }),
    );

    const { blockhash } = await connection.getLatestBlockhash("confirmed");
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = senderPubkey;

    const response = await createPostResponse({
      fields: {
        type: "transaction",
        transaction,
        message: "Payment sent via Cipher Pay",
        links: {
          next: {
            type: "inline",
            action: {
              type: "completed",
              title: "Payment sent",
              icon: `${url.origin}/cipher-pay-icon.svg`,
              description: "Your payment has been processed via Cipher Pay.",
              label: "Done",
            },
          },
        },
      },
    });

    return Response.json(response, { headers: ACTIONS_CORS_HEADERS });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500, headers: ACTIONS_CORS_HEADERS },
    );
  }
}
