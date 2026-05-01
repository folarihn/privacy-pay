import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const origin = request.headers.get("origin");
    const urlOrigin = request.nextUrl.origin;
    if (origin && origin !== urlOrigin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const rpcUrl = process.env.HELIUS_RPC_URL;

    if (!rpcUrl) {
      console.error("RPC URL not configured");
      return NextResponse.json({ error: 'RPC configuration error' }, { status: 500 });
    }

    // Security: Whitelist allowed RPC methods to prevent abuse
    const allowedMethods = [
      // Standard Solana
      'getLatestBlockhash',
      'getBalance',
      'getAccountInfo',
      'getMultipleAccounts',
      'getProgramAccounts',
      'getRecentPrioritizationFees',
      'getFeeForMessage',
      'simulateTransaction',
      'sendTransaction',
      'getTransaction',
      'getSignaturesForAddress',
      'getParsedTransaction',
      'getParsedTransactions',
      'getTokenAccountBalance',
      'getTokenAccountsByOwner',
      'getSlot',
      'getHealth',
      'getVersion',
      'getBlockTime',
      // Light Protocol / ZK Compression
      'getValidityProof',
      'getCompressedAccount',
      'getCompressedAccountBalance',
      'getCompressedAccountsByOwner',
      'getCompressedBalanceByOwner',
      'getCompressedBalance',
      'getCompressedTokenAccountsByOwner',
      'getCompressedTokenAccountsByDelegate',
      'getCompressedTokenAccountBalance',
      'getCompressedTransaction',
      'getCompressedTransactionsByOwner',
      'getIndexerSlot',
      'getIndexerHealth',
      'getStateTreeInfos',
      // DAS / Helius
      'getAsset',
      'getAssetProof',
      'getAssetsByOwner',
      'getAssetsByGroup',
    ];

    if (!allowedMethods.includes(body.method)) {
      console.warn(`Blocked unauthorized RPC method: ${body.method}`);
      return NextResponse.json({ error: 'Method not allowed' }, { status: 403 });
    }

    // ZK proof generation calls can take longer — use extended timeout
    const isHeavyMethod = ['getValidityProof', 'simulateTransaction'].includes(body.method);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), isHeavyMethod ? 30000 : 10000);

    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (!response.ok) {
      return NextResponse.json(
        { error: `RPC provider error: ${response.statusText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("RPC proxy error:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
