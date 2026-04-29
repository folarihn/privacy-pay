import { Buffer } from "buffer";
import type { WalletContextState } from "@solana/wallet-adapter-react";
import type { Connection } from "@solana/web3.js";
import { VersionedTransaction } from "@solana/web3.js";

function getApiKey() {
  return (process.env.NEXT_PUBLIC_JUPITER_API_KEY ?? process.env.JUPITER_API_KEY ?? "").trim();
}

function getBaseUrls(apiKey: string): string[] {
  const configured =
    (process.env.NEXT_PUBLIC_JUPITER_ULTRA_API_URL ?? process.env.JUPITER_ULTRA_API_URL ?? "").trim();

  const urls = [
    configured,
    "https://ultra-api.jup.ag",
    apiKey ? "https://lite-api.jup.ag/ultra/v1" : "",
    apiKey ? "https://api.jup.ag/ultra/v1" : "",
  ].filter((u) => u && typeof u === "string");

  return Array.from(new Set(urls.map((u) => u.replace(/\/+$/g, ""))));
}

export interface JupiterQuote {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  priceImpactPct: string;
  routePlan: unknown[];
  swapMode: string;
  raw: Record<string, unknown>;
}

export type JupiterQuoteResult = { quote: JupiterQuote | null; error: string | null };

async function fetchJson(
  input: string,
  init?: RequestInit,
): Promise<{ ok: boolean; status: number; json: unknown; text: string }> {
  const res = await fetch(input, init);
  const text = await res.text().catch(() => "");
  let json: unknown = null;
  try {
    json = text ? (JSON.parse(text) as unknown) : null;
  } catch {
    json = null;
  }
  return { ok: res.ok, status: res.status, json, text };
}

export async function getJupiterQuote(params: {
  inputMint: string;
  outputMint: string;
  amount: number;
  slippageBps?: number;
  taker?: string;
}): Promise<JupiterQuote | null> {
  const result = await getJupiterQuoteResult(params);
  return result.quote;
}

export async function getJupiterQuoteResult(params: {
  inputMint: string;
  outputMint: string;
  amount: number;
  slippageBps?: number;
  taker?: string;
}): Promise<JupiterQuoteResult> {
  try {
    const { inputMint, outputMint, amount, slippageBps, taker } = params;
    const bps = slippageBps ?? 50;
    const apiKey = getApiKey();
    const headers: Record<string, string> = apiKey ? { "x-api-key": apiKey } : {};

    const qs =
      `inputMint=${encodeURIComponent(inputMint)}` +
      `&outputMint=${encodeURIComponent(outputMint)}` +
      `&amount=${encodeURIComponent(String(amount))}` +
      `&slippageBps=${encodeURIComponent(String(bps))}` +
      (taker ? `&taker=${encodeURIComponent(taker)}` : "");

    let lastError: string | null = null;

    for (const base of getBaseUrls(apiKey)) {
      const url = `${base}/order?${qs}`;
      const res = await fetchJson(url, { method: "GET", headers });

      if (!res.ok) {
        lastError = res.text || `HTTP ${res.status}`;
        console.error("[Jupiter] Quote error:", base, res.status, res.text);
        continue;
      }

      if (typeof res.json !== "object" || res.json === null) {
        lastError = "Invalid response";
        continue;
      }
      const raw = res.json as Record<string, unknown>;

      const errorMessage =
        typeof raw.errorMessage === "string"
          ? raw.errorMessage
          : typeof raw.error === "string"
            ? raw.error
            : typeof raw.message === "string"
              ? raw.message
              : null;

      if (errorMessage) {
        console.error("[Jupiter] Quote error:", base, errorMessage);
        return { quote: null, error: errorMessage };
      }

      const inAmountStr =
        typeof raw.inAmount === "string"
          ? raw.inAmount
          : typeof raw.in_amount === "string"
            ? raw.in_amount
            : String(amount);

      const outAmountStr =
        typeof raw.outAmount === "string"
          ? raw.outAmount
          : typeof raw.out_amount === "string"
            ? raw.out_amount
            : "0";

      const priceImpactStr =
        typeof raw.priceImpactPct === "string"
          ? raw.priceImpactPct
          : typeof raw.priceImpact === "string"
            ? raw.priceImpact
            : "0";

      const routePlan = Array.isArray(raw.routePlan)
        ? raw.routePlan
        : Array.isArray(raw.route_plan)
          ? (raw.route_plan as unknown[])
          : [];

      const swapMode =
        typeof raw.swapMode === "string"
          ? raw.swapMode
          : typeof raw.swap_mode === "string"
            ? raw.swap_mode
            : "ExactIn";

      return {
        quote: {
          inputMint,
          outputMint,
          inAmount: inAmountStr,
          outAmount: outAmountStr,
          priceImpactPct: priceImpactStr,
          routePlan,
          swapMode,
          raw,
        },
        error: null,
      };
    }

    return { quote: null, error: lastError };
  } catch (e) {
    console.error("[Jupiter] Quote error:", e);
    const message = e instanceof Error ? e.message : typeof e === "string" ? e : JSON.stringify(e);
    return { quote: null, error: message };
  }
}

export async function executeJupiterSwap(params: {
  quote: JupiterQuote;
  wallet: WalletContextState;
  connection: Connection;
}): Promise<string> {
  const { quote, wallet } = params;

  if (!wallet.publicKey) throw new Error("Wallet not connected");
  if (!wallet.signTransaction) throw new Error("Wallet does not support signTransaction");

  const apiKey = getApiKey();
  if (!apiKey) throw new Error("Missing Jupiter API key");

  const taker = wallet.publicKey.toBase58();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-api-key": apiKey,
  };

  const orderAmount = Number(quote.inAmount);
  if (!Number.isFinite(orderAmount) || orderAmount <= 0) throw new Error("Invalid swap amount");

  const slippageBps =
    typeof quote.raw.slippageBps === "number"
      ? quote.raw.slippageBps
      : typeof quote.raw.slippage_bps === "number"
        ? quote.raw.slippage_bps
        : undefined;

  const qs =
    `inputMint=${encodeURIComponent(quote.inputMint)}` +
    `&outputMint=${encodeURIComponent(quote.outputMint)}` +
    `&amount=${encodeURIComponent(String(orderAmount))}` +
    `&taker=${encodeURIComponent(taker)}` +
    (typeof slippageBps === "number" ? `&slippageBps=${encodeURIComponent(String(slippageBps))}` : "");

  let orderBase: string | null = null;
  let orderJson: Record<string, unknown> | null = null;

  for (const base of getBaseUrls(apiKey)) {
    if (base === "https://ultra-api.jup.ag") continue;
    const res = await fetchJson(`${base}/order?${qs}`, { method: "GET", headers: { "x-api-key": apiKey } });
    if (!res.ok || typeof res.json !== "object" || res.json === null) {
      console.error("[Jupiter] Order error:", base, res.status, res.text);
      continue;
    }
    orderBase = base;
    orderJson = res.json as Record<string, unknown>;
    break;
  }

  if (!orderBase || !orderJson) throw new Error("Failed to get swap transaction from Jupiter");

  const txB64 = typeof orderJson.transaction === "string" ? orderJson.transaction : null;
  const requestId = typeof orderJson.requestId === "string" ? orderJson.requestId : null;

  if (!txB64 || !requestId) {
    const errorMessage =
      typeof orderJson.errorMessage === "string"
        ? orderJson.errorMessage
        : typeof orderJson.error === "string"
          ? orderJson.error
          : "No transaction returned";
    throw new Error(errorMessage);
  }

  const tx = VersionedTransaction.deserialize(Buffer.from(txB64, "base64"));
  const signed = await wallet.signTransaction(tx);
  const signedB64 = Buffer.from(signed.serialize()).toString("base64");

  const exec = await fetchJson(`${orderBase}/execute`, {
    method: "POST",
    headers,
    body: JSON.stringify({ signedTransaction: signedB64, requestId }),
  });

  if (!exec.ok || typeof exec.json !== "object" || exec.json === null) {
    const msg =
      typeof (exec.json as { error?: unknown } | null)?.error === "string"
        ? String((exec.json as { error?: unknown }).error)
        : exec.text || `Execute failed (${exec.status})`;
    throw new Error(msg);
  }

  const obj = exec.json as Record<string, unknown>;
  const sig =
    typeof obj.signature === "string"
      ? obj.signature
      : typeof obj.txid === "string"
        ? obj.txid
        : typeof obj.transactionSignature === "string"
          ? obj.transactionSignature
          : null;

  if (!sig) throw new Error("Jupiter execute succeeded but no signature returned");
  return sig;
}
