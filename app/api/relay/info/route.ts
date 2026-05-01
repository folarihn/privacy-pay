import { NextResponse } from "next/server";
import { Keypair, Connection, clusterApiUrl } from "@solana/web3.js";
import bs58 from "bs58";

function getRelayerKeypair(): Keypair {
  const key = process.env.RELAYER_PRIVATE_KEY;
  if (!key) throw new Error("RELAYER_PRIVATE_KEY not configured");
  return Keypair.fromSecretKey(bs58.decode(key));
}

export async function GET() {
  try {
    const relayer = getRelayerKeypair();
    const rpcUrl = process.env.HELIUS_RPC_URL ?? clusterApiUrl("mainnet-beta");
    const connection = new Connection(rpcUrl, "confirmed");

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();

    return NextResponse.json({
      relayerPublicKey: relayer.publicKey.toBase58(),
      blockhash,
      lastValidBlockHeight,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Relayer unavailable";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
