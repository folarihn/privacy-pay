import { NextRequest, NextResponse } from "next/server";
import {
  Keypair,
  Connection,
  Transaction,
  clusterApiUrl,
  sendAndConfirmRawTransaction,
} from "@solana/web3.js";
import bs58 from "bs58";

function getRelayerKeypair(): Keypair {
  const key = process.env.RELAYER_PRIVATE_KEY;
  if (!key) throw new Error("RELAYER_PRIVATE_KEY not configured");
  return Keypair.fromSecretKey(bs58.decode(key));
}

export async function POST(request: NextRequest) {
  try {
    const origin = request.headers.get("origin");
    const urlOrigin = request.nextUrl.origin;
    if (origin && origin !== urlOrigin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await request.json()) as { transaction: string };
    if (!body.transaction) {
      return NextResponse.json({ error: "Missing transaction" }, { status: 400 });
    }

    const relayer = getRelayerKeypair();
    const rpcUrl = process.env.HELIUS_RPC_URL ?? clusterApiUrl("mainnet-beta");
    const connection = new Connection(rpcUrl, "confirmed");

    // Deserialize the partially-signed transaction from the client
    const txBytes = Buffer.from(body.transaction, "base64");
    const transaction = Transaction.from(txBytes);

    // Verify the transaction has the relayer as fee payer
    if (!transaction.feePayer?.equals(relayer.publicKey)) {
      return NextResponse.json(
        { error: "Transaction fee payer must be the relayer" },
        { status: 400 }
      );
    }

    // Relayer co-signs as fee payer
    transaction.partialSign(relayer);

    // Verify all required signatures are present
    const missingSigners = transaction.signatures.filter(
      (s) => s.signature === null
    );
    if (missingSigners.length > 0) {
      return NextResponse.json(
        { error: `Missing ${missingSigners.length} signature(s)` },
        { status: 400 }
      );
    }

    // Submit to chain
    const rawTx = transaction.serialize();
    const signature = await connection.sendRawTransaction(rawTx, {
      skipPreflight: true,
    });

    // Confirm
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    const confirmation = await connection.confirmTransaction(
      { signature, blockhash, lastValidBlockHeight },
      "confirmed"
    );

    if (confirmation.value.err) {
      // Fetch logs for better error message
      const tx = await connection.getTransaction(signature, {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
      }).catch(() => null);

      const logs = tx?.meta?.logMessages?.slice(-6).join("\n");
      return NextResponse.json(
        { error: `Transaction failed on-chain:\n${logs ?? JSON.stringify(confirmation.value.err)}` },
        { status: 400 }
      );
    }

    return NextResponse.json({ signature });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Relay failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
