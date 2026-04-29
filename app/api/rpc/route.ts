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
    // This prevents attackers from using your API key for heavy/unauthorized calls (e.g. getProgramAccounts, airdrop)
    const allowedMethods = [
      'getLatestBlockhash',
      'getBalance',
      'getAccountInfo',
      'sendTransaction',
      'getMultipleAccounts',
      'getRecentPrioritizationFees',
      'getFeeForMessage',
      'simulateTransaction',
      'getSlot',
      'getHealth',
      // Light Protocol / ZK Compression methods
      'getProgramAccounts', // Required for fetching state trees
      'getValidityProof',   // Required for ZK transactions
      'getCompressedAccount',
      'getCompressedTokenAccountsByOwner',
      'getCompressedTransaction',
      'getCompressedTransactionsByOwner',
      'getAsset',
      'getAssetProof',
      'getAssetsByOwner'
    ];

    if (!allowedMethods.includes(body.method)) {
      console.warn(`Blocked unauthorized RPC method: ${body.method}`);
      return NextResponse.json({ error: 'Method not allowed' }, { status: 403 });
    }

    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

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
