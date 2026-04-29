import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  CompressedTokenProgram,
  createTokenPool,
  getTokenPoolInfos,
  selectTokenPoolInfo,
} from "@lightprotocol/compressed-token";
import {
  LightSystemProgram,
  bn,
  createRpc,
  selectStateTreeInfo,
  type Rpc,
} from "@lightprotocol/stateless.js";
import {
  Connection,
  ComputeBudgetProgram,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import {
  createAssociatedTokenAccountInstruction,
  createMint,
  getAssociatedTokenAddress,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import BN from "bn.js";

import { USDC_DECIMALS, USDC_MINT_DEVNET } from "../lib/constants";

type PersonaKey = "alice" | "bob" | "carol";

type DemoWalletFile = Record<
  PersonaKey,
  {
    secretKey: number[];
  }
> & {
  usdcMint?: string;
};

type DemoState = {
  lastSeeded: string;
  usdcMint: string;
  wallets: Record<
    PersonaKey,
    {
      publicKey: string;
      shieldedSOL: number;
      shieldedUSDC: number;
      publicSOL: number;
      publicUSDC: number;
    }
  >;
  demoTransactions: Array<{
    id: string;
    from: PersonaKey;
    to: PersonaKey;
    amount: number;
    token: "SOL" | "USDC";
    memo: string;
    timestamp: string;
    signature: string;
  }>;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const scriptsDir = resolve(__dirname);
const demoWalletsPath = resolve(scriptsDir, "demo-wallets.json");
const publicDemoStatePath = resolve(scriptsDir, "..", "public", "demo-state.json");

async function loadEnvFileIfExists(path: string) {
  try {
    const raw = await readFile(path, "utf-8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;

      const key = trimmed.slice(0, eq).trim();
      const valueRaw = trimmed.slice(eq + 1).trim();
      if (!key) continue;
      if (process.env[key] !== undefined) continue;

      const value = valueRaw.replace(/^['"`]/, "").replace(/['"`]$/, "");
      process.env[key] = value;
    }
  } catch {
    return;
  }
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

async function airdropWithRetry(
  connection: Connection,
  pubkey: PublicKey,
  lamports: number,
  maxRetries = 5,
): Promise<void> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const sig = await connection.requestAirdrop(pubkey, lamports);
      await connection.confirmTransaction(sig, "confirmed");
      return;
    } catch (e) {
      if (i < maxRetries - 1) {
        console.log(`  Airdrop failed, retrying in 3s... (${i + 1}/${maxRetries})`);
        await sleep(3000);
      } else {
        throw e;
      }
    }
  }
}

async function loadOrCreateDemoWallets(): Promise<{
  wallets: Record<PersonaKey, Keypair>;
  usdcMint: PublicKey;
}> {
  await mkdir(scriptsDir, { recursive: true });

  try {
    const raw = await readFile(demoWalletsPath, "utf-8");
    const parsed = JSON.parse(raw) as DemoWalletFile;
    const usdcMint = parsed.usdcMint ? new PublicKey(parsed.usdcMint) : USDC_MINT_DEVNET;
    return {
      wallets: {
        alice: Keypair.fromSecretKey(Uint8Array.from(parsed.alice.secretKey)),
        bob: Keypair.fromSecretKey(Uint8Array.from(parsed.bob.secretKey)),
        carol: Keypair.fromSecretKey(Uint8Array.from(parsed.carol.secretKey)),
      },
      usdcMint,
    };
  } catch {
    const alice = Keypair.generate();
    const bob = Keypair.generate();
    const carol = Keypair.generate();

    const payload: DemoWalletFile = {
      alice: { secretKey: Array.from(alice.secretKey) },
      bob: { secretKey: Array.from(bob.secretKey) },
      carol: { secretKey: Array.from(carol.secretKey) },
      usdcMint: USDC_MINT_DEVNET.toBase58(),
    };

    await writeFile(demoWalletsPath, JSON.stringify(payload, null, 2), "utf-8");
    return { wallets: { alice, bob, carol }, usdcMint: USDC_MINT_DEVNET };
  }
}

async function persistUsdcMintToDemoWallets(params: {
  wallets: Record<PersonaKey, Keypair>;
  usdcMint: PublicKey;
}) {
  const { wallets, usdcMint } = params;
  const payload: DemoWalletFile = {
    alice: { secretKey: Array.from(wallets.alice.secretKey) },
    bob: { secretKey: Array.from(wallets.bob.secretKey) },
    carol: { secretKey: Array.from(wallets.carol.secretKey) },
    usdcMint: usdcMint.toBase58(),
  };
  await writeFile(demoWalletsPath, JSON.stringify(payload, null, 2), "utf-8");
}

async function sendAndConfirm(params: {
  connection: Connection;
  tx: Transaction;
  signer: Keypair;
}): Promise<string> {
  const { connection, tx, signer } = params;

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.lastValidBlockHeight = lastValidBlockHeight;
  tx.feePayer = signer.publicKey;

  const sig = await connection.sendTransaction(tx, [signer], { skipPreflight: true });

  const confirmation = await connection.confirmTransaction(
    { signature: sig, blockhash, lastValidBlockHeight },
    "confirmed",
  );
  if (confirmation.value.err) {
    throw new Error(`Transaction failed on-chain: ${JSON.stringify(confirmation.value.err)}`);
  }

  return sig;
}

async function ensureAta(params: {
  connection: Connection;
  owner: Keypair;
  mint: PublicKey;
}): Promise<PublicKey> {
  const { connection, owner, mint } = params;
  const ata = await getAssociatedTokenAddress(mint, owner.publicKey);
  const info = await connection.getAccountInfo(ata, "confirmed");
  if (info) return ata;

  const tx = new Transaction().add(
    createAssociatedTokenAccountInstruction(owner.publicKey, ata, owner.publicKey, mint),
  );
  await sendAndConfirm({ connection, tx, signer: owner });
  return ata;
}

function tryMintWithSplTokenCli(params: {
  mint: PublicKey;
  amountUi: number;
  destinationAta: PublicKey;
}): boolean {
  const { mint, amountUi, destinationAta } = params;

  const res = spawnSync(
    "spl-token",
    ["mint", mint.toBase58(), String(amountUi), destinationAta.toBase58(), "--url", "devnet"],
    { stdio: "inherit" },
  );

  if (res.error) return false;
  return res.status === 0;
}

async function getDevnetUSDC(toTokenAccount: PublicKey, amountUi: number): Promise<{ ok: boolean; signature?: string }> {
  try {
    const response = await fetch("https://spl-token-faucet.com/api/faucet/v1/mintTokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mintAddress: USDC_MINT_DEVNET.toBase58(),
        toTokenAccount: toTokenAccount.toBase58(),
        amount: amountUi * 1_000_000,
        network: "devnet",
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      const msg = body ? `${response.status} ${response.statusText}: ${body}` : `${response.status} ${response.statusText}`;
      throw new Error(msg);
    }

    const data = (await response.json()) as { signature?: string };
    return { ok: true, signature: data.signature };
  } catch (e: unknown) {
    console.error(e instanceof Error ? e.stack : e);
    return { ok: false };
  }
}

async function ensureTokenPoolForMint(params: { rpc: Rpc; payer: Keypair; mint: PublicKey }) {
  const { rpc, payer, mint } = params;
  let infos: Awaited<ReturnType<typeof getTokenPoolInfos>> = [];
  try {
    infos = await getTokenPoolInfos(rpc, mint, "confirmed");
  } catch {
    infos = [];
  }

  if (infos.some((i) => i.isInitialized)) return;

  await createTokenPool(rpc, payer, mint, { skipPreflight: true, commitment: "confirmed" });

  for (let i = 0; i < 5; i++) {
    try {
      const after = await getTokenPoolInfos(rpc, mint, "confirmed");
      if (after.some((x) => x.isInitialized)) return;
    } catch {
      await sleep(1200);
      continue;
    }
    await sleep(1200);
  }

  throw new Error(`TokenPool not found after createTokenPool for mint: ${mint.toBase58()}`);
}

async function createLocalUSDCMint(params: {
  connection: Connection;
  rpc: Rpc;
  payerKeypair: Keypair;
}): Promise<PublicKey> {
  const { connection, rpc, payerKeypair } = params;

  const mint = await createMint(
    connection,
    payerKeypair,
    payerKeypair.publicKey,
    null,
    USDC_DECIMALS,
    undefined,
    { skipPreflight: true, commitment: "confirmed" },
  );

  await ensureTokenPoolForMint({ rpc, payer: payerKeypair, mint });

  return mint;
}

async function shieldSol(params: {
  rpc: Rpc;
  connection: Connection;
  signer: Keypair;
  amountSol: number;
}): Promise<string> {
  const { rpc, connection, signer, amountSol } = params;
  const lamports = Math.floor(amountSol * 1e9);

  const trees = await rpc.getStateTreeInfos();
  const outputStateTreeInfo = selectStateTreeInfo(trees);

  const ix = await LightSystemProgram.compress({
    payer: signer.publicKey,
    toAddress: signer.publicKey,
    lamports,
    outputStateTreeInfo,
  });

  const tx = new Transaction().add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 500_000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1000 }),
    ix,
  );

  return await sendAndConfirm({ connection, tx, signer });
}

async function shieldUsdc(params: {
  rpc: Rpc;
  connection: Connection;
  signer: Keypair;
  sourceAta: PublicKey;
  amountUi: number;
  mint: PublicKey;
}): Promise<string> {
  const { rpc, connection, signer, sourceAta, amountUi, mint } = params;
  const rawAmount = new BN(String(Math.floor(amountUi * 10 ** USDC_DECIMALS)), 10);

  const trees = await rpc.getStateTreeInfos();
  const outputStateTreeInfo = selectStateTreeInfo(trees);

  const pools = await getTokenPoolInfos(rpc, mint, "confirmed");
  if (!pools.length) {
    throw new Error("USDC token pool not found (mint not registered for compression)");
  }
  const tokenPoolInfo = selectTokenPoolInfo(pools);

  const ix = await CompressedTokenProgram.compress({
    payer: signer.publicKey,
    owner: signer.publicKey,
    source: sourceAta,
    toAddress: signer.publicKey,
    amount: rawAmount,
    mint,
    outputStateTreeInfo,
    tokenPoolInfo,
  });

  const tx = new Transaction().add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 1_000_000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1000 }),
    ix,
  );

  return await sendAndConfirm({ connection, tx, signer });
}

async function getShieldedUsdcBalance(rpc: Rpc, owner: PublicKey, mint: PublicKey): Promise<number> {
  const tokenAccounts = await rpc.getCompressedTokenAccountsByOwner(owner, {
    mint,
  });
  const total = tokenAccounts.items.reduce((acc, item) => acc.add(item.parsed.amount), bn(0));
  return total.toNumber() / 10 ** USDC_DECIMALS;
}

async function main() {
  await loadEnvFileIfExists(resolve(scriptsDir, "..", ".env.local"));
  await loadEnvFileIfExists(resolve(scriptsDir, "..", ".env"));

  const HELIUS_DEVNET_RPC =
    process.env.HELIUS_RPC_URL ??
    process.env.NEXT_PUBLIC_HELIUS_RPC_URL ??
    process.env.NEXT_PUBLIC_RPC_URL ??
    "https://devnet.helius-rpc.com/?api-key=demo";

  console.log(`Using RPC Endpoint: ${HELIUS_DEVNET_RPC}`);

  const connection = new Connection(HELIUS_DEVNET_RPC, "confirmed");
  const rpc: Rpc = createRpc(HELIUS_DEVNET_RPC, HELIUS_DEVNET_RPC, HELIUS_DEVNET_RPC);

  const args = new Set(process.argv.slice(2));
  const skipAirdrop = args.has("--skip-airdrop");

  const walletBundle = await loadOrCreateDemoWallets();
  const wallets = walletBundle.wallets;
  let usdcMint = walletBundle.usdcMint;
  const payerKeypair = wallets.alice;
  await persistUsdcMintToDemoWallets({ wallets, usdcMint });

  const personas: Array<{ key: PersonaKey; label: string; kp: Keypair }> = [
    { key: "alice", label: "Alice", kp: wallets.alice },
    { key: "bob", label: "Bob", kp: wallets.bob },
    { key: "carol", label: "Carol", kp: wallets.carol },
  ];

  const now = new Date();
  const txTimes = [
    new Date(now.getTime() - 1000 * 60 * 60 * 24).toISOString(),
    new Date(now.getTime() - 1000 * 60 * 60 * 12).toISOString(),
    new Date(now.getTime() - 1000 * 60 * 60 * 2).toISOString(),
  ];

  const TARGET_PUBLIC_SOL = 2;
  const TARGET_SHIELDED_SOL = 0.5;
  const TARGET_PUBLIC_USDC = 500;
  const TARGET_SHIELDED_USDC = 100;

  const walletsState: DemoState["wallets"] = {
    alice: {
      publicKey: wallets.alice.publicKey.toBase58(),
      shieldedSOL: 0,
      shieldedUSDC: 0,
      publicSOL: 0,
      publicUSDC: 0,
    },
    bob: {
      publicKey: wallets.bob.publicKey.toBase58(),
      shieldedSOL: 0,
      shieldedUSDC: 0,
      publicSOL: 0,
      publicUSDC: 0,
    },
    carol: {
      publicKey: wallets.carol.publicKey.toBase58(),
      shieldedSOL: 0,
      shieldedUSDC: 0,
      publicSOL: 0,
      publicUSDC: 0,
    },
  };

  let hadFailure = false;
  let rpcHealthy = true;

  try {
    await connection.getLatestBlockhash("confirmed");
  } catch (e: unknown) {
    rpcHealthy = false;
    hadFailure = true;
    const message = e instanceof Error ? e.message : typeof e === "string" ? e : JSON.stringify(e);
    console.log(`⚠ RPC not usable: ${message}`);
    console.log(
      "  Set HELIUS_RPC_URL / NEXT_PUBLIC_HELIUS_RPC_URL to a valid Helius Devnet key (https://dev.helius.xyz).",
    );
  }

  if (rpcHealthy && skipAirdrop) {
    console.log("\n→ Funding wallets from the richest demo wallet (skip-airdrop)");
    const balances = await Promise.all(
      personas.map(async (p) => ({
        key: p.key,
        label: p.label,
        kp: p.kp,
        sol: (await connection.getBalance(p.kp.publicKey, "confirmed")) / LAMPORTS_PER_SOL,
      })),
    );

    const richest = balances.reduce((best, cur) => (cur.sol > best.sol ? cur : best), balances[0]);
    for (const b of balances) {
      if (b.key === richest.key) continue;
      if (b.sol >= TARGET_PUBLIC_SOL) continue;

      const richestNow = (await connection.getBalance(richest.kp.publicKey, "confirmed")) / LAMPORTS_PER_SOL;
      const needed = TARGET_PUBLIC_SOL - b.sol;
      if (needed <= 0) continue;

      if (richestNow <= needed + 0.05) {
        console.log(`  ⚠ Not enough SOL in ${richest.label} to fund ${b.label}`);
        continue;
      }

      console.log(`  → Funding ${b.label} with ${needed.toFixed(4)} SOL from ${richest.label}...`);
      try {
        const tx = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: richest.kp.publicKey,
            toPubkey: b.kp.publicKey,
            lamports: Math.floor(needed * LAMPORTS_PER_SOL),
          }),
        );
        await sendAndConfirm({ connection, tx, signer: richest.kp });
        const newBal = (await connection.getBalance(b.kp.publicKey, "confirmed")) / LAMPORTS_PER_SOL;
        console.log(`  ✓ ${b.label} SOL balance: ${newBal.toFixed(4)}`);
      } catch (e: unknown) {
        console.error(e instanceof Error ? e.stack : e);
        console.log(`  ⚠ Funding failed for ${b.label}`);
      }
    }
  }

  for (const p of rpcHealthy ? personas : []) {
    const walletState = walletsState[p.key];

    try {
      if (skipAirdrop) {
        console.log(`\n→ Skipping airdrop for ${p.label} (--skip-airdrop)`);
      } else {
        console.log(`\n→ Airdropping SOL to ${p.label}...`);
        await airdropWithRetry(connection, p.kp.publicKey, 2 * LAMPORTS_PER_SOL);
      }

      const sol = (await connection.getBalance(p.kp.publicKey, "confirmed")) / LAMPORTS_PER_SOL;
      walletState.publicSOL = sol;
      console.log(`✓ ${p.label} SOL balance: ${sol.toFixed(4)}`);

      try {
        const shieldedSol = (await rpc.getCompressedBalanceByOwner(p.kp.publicKey)).toNumber() / 1e9;
        walletState.shieldedSOL = shieldedSol;
      } catch {
        walletState.shieldedSOL = walletState.shieldedSOL;
      }

      try {
        const shieldedUsdc = await getShieldedUsdcBalance(rpc, p.kp.publicKey, usdcMint);
        walletState.shieldedUSDC = shieldedUsdc;
      } catch {
        walletState.shieldedUSDC = walletState.shieldedUSDC;
      }
    } catch (e: unknown) {
      hadFailure = true;
      const message =
        e instanceof Error ? e.message : typeof e === "string" ? e : JSON.stringify(e);
      console.log(`⚠ Airdrop failed for ${p.label}: ${message}`);
      console.log("  Visit https://faucet.solana.com for alternate sources of test SOL.");
      continue;
    }

    let usdcAta: PublicKey | null = null;
    try {
      console.log(`→ Creating USDC token account for ${p.label}...`);
      usdcAta = await ensureAta({ connection, owner: p.kp, mint: usdcMint });
      console.log(`✓ ${p.label} USDC ATA: ${usdcAta.toBase58()}`);
    } catch (e: unknown) {
      hadFailure = true;
      const message =
        e instanceof Error ? e.message : typeof e === "string" ? e : JSON.stringify(e);
      console.log(`⚠ Failed to create USDC ATA for ${p.label}: ${message}`);
    }

    let didMintUsdc = false;
    if (usdcAta) {
      try {
        let currentUsdc = 0;
        try {
          const bal = await connection.getTokenAccountBalance(usdcAta, "confirmed");
          currentUsdc = bal.value.uiAmount ?? 0;
        } catch {
          currentUsdc = 0;
        }

        const mintDelta = Math.max(0, TARGET_PUBLIC_USDC - currentUsdc);
        if (mintDelta <= 0) {
          didMintUsdc = true;
          walletState.publicUSDC = currentUsdc;
          console.log(`→ USDC already funded for ${p.label}: ${currentUsdc.toFixed(2)}`);
        } else {
          console.log(`→ Minting ${mintDelta} USDC for ${p.label}...`);

          if (usdcMint.equals(USDC_MINT_DEVNET)) {
            const didCli = tryMintWithSplTokenCli({
              mint: USDC_MINT_DEVNET,
              amountUi: mintDelta,
              destinationAta: usdcAta,
            });

            if (didCli) {
              didMintUsdc = true;
              console.log("  ✓ USDC minted via spl-token CLI");
            } else {
              const faucet = await getDevnetUSDC(usdcAta, mintDelta);
              if (faucet.ok) {
                didMintUsdc = true;
                console.log(`  ✓ USDC faucet success: ${faucet.signature ?? "ok"}`);
              } else {
                console.log("  Faucet failed, creating local test USDC mint instead...");
                try {
                  usdcMint = await createLocalUSDCMint({ connection, rpc, payerKeypair });
                  await persistUsdcMintToDemoWallets({ wallets, usdcMint });
                  console.log(`  ✓ Local test USDC mint created: ${usdcMint.toBase58()}`);
                } catch (e: unknown) {
                  console.log(
                    "  ⚠ USDC minting skipped — seed with SOL only. Run `spl-token mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU 500 <wallet-token-account> --url devnet` manually for USDC.",
                  );
                  throw e;
                }

                usdcAta = await ensureAta({ connection, owner: p.kp, mint: usdcMint });
                const tokenAccount = await getOrCreateAssociatedTokenAccount(
                  connection,
                  payerKeypair,
                  usdcMint,
                  p.kp.publicKey,
                  true,
                  "confirmed",
                  { skipPreflight: true, commitment: "confirmed" },
                );
                await mintTo(
                  connection,
                  payerKeypair,
                  usdcMint,
                  tokenAccount.address,
                  payerKeypair,
                  mintDelta * 1_000_000,
                  [],
                  { skipPreflight: true, commitment: "confirmed" },
                );
                didMintUsdc = true;
                console.log(`  ✓ Local test USDC minted: ${usdcMint.toBase58()}`);
              }
            }
          } else {
            const tokenAccount = await getOrCreateAssociatedTokenAccount(
              connection,
              payerKeypair,
              usdcMint,
              p.kp.publicKey,
              true,
              "confirmed",
              { skipPreflight: true, commitment: "confirmed" },
            );
            await mintTo(
              connection,
              payerKeypair,
              usdcMint,
              tokenAccount.address,
              payerKeypair,
              mintDelta * 1_000_000,
              [],
              { skipPreflight: true, commitment: "confirmed" },
            );
            didMintUsdc = true;
            console.log(`  ✓ Local test USDC minted: ${usdcMint.toBase58()}`);
          }

          if (didMintUsdc) {
            const balanceAta = usdcMint.equals(USDC_MINT_DEVNET)
              ? usdcAta
              : (
                  await getOrCreateAssociatedTokenAccount(
                    connection,
                    payerKeypair,
                    usdcMint,
                    p.kp.publicKey,
                    true,
                    "confirmed",
                    { skipPreflight: true, commitment: "confirmed" },
                  )
                ).address;
            const bal = await connection.getTokenAccountBalance(balanceAta, "confirmed");
            walletState.publicUSDC = bal.value.uiAmount ?? 0;
            console.log(`✓ ${p.label} USDC balance: ${walletState.publicUSDC.toFixed(2)}`);
          }
        }
      } catch (e: unknown) {
        hadFailure = true;
        const message =
          e instanceof Error ? e.message : typeof e === "string" ? e : JSON.stringify(e);
        console.log(`⚠ USDC mint failed for ${p.label}: ${message}`);
      }
    }

    try {
      console.log(`→ Shielding 0.5 SOL for ${p.label}...`);
      const currentShielded = (await rpc.getCompressedBalanceByOwner(p.kp.publicKey)).toNumber() / 1e9;
      const delta = Math.max(0, TARGET_SHIELDED_SOL - currentShielded);

      if (delta <= 0) {
        walletState.shieldedSOL = currentShielded;
      } else if (walletState.publicSOL < delta + 0.02) {
        hadFailure = true;
        console.log(`⚠ SOL shielding skipped for ${p.label}: insufficient SOL for fees`);
        console.log("  ⚠ The demo will show 0 shielded SOL — shield manually in the app");
      } else {
        await shieldSol({ rpc, connection, signer: p.kp, amountSol: delta });
      }

      const shieldedSol = (await rpc.getCompressedBalanceByOwner(p.kp.publicKey)).toNumber() / 1e9;
      walletState.shieldedSOL = shieldedSol;
      console.log(`✓ ${p.label} shielded balance: ${shieldedSol.toFixed(4)} SOL`);

      const sol = (await connection.getBalance(p.kp.publicKey, "confirmed")) / LAMPORTS_PER_SOL;
      walletState.publicSOL = sol;
    } catch (e: unknown) {
      hadFailure = true;
      const message = e instanceof Error ? e.message : typeof e === "string" ? e : JSON.stringify(e);
      console.error(e instanceof Error ? e.stack : e);
      console.log(`⚠ SOL shielding failed for ${p.label}: ${message}`);
      console.log("  ⚠ The demo will show 0 shielded SOL — shield manually in the app");
    }

    if (didMintUsdc && usdcAta) {
      try {
        console.log(`→ Shielding ${TARGET_SHIELDED_USDC} USDC for ${p.label}...`);
        const currentShielded = await getShieldedUsdcBalance(rpc, p.kp.publicKey, usdcMint);
        const delta = Math.max(0, TARGET_SHIELDED_USDC - currentShielded);

        if (delta <= 0) {
          walletState.shieldedUSDC = currentShielded;
        } else {
          const pools = await getTokenPoolInfos(rpc, usdcMint, "confirmed");
          if (!pools.length) {
            hadFailure = true;
            console.log(
              `⚠ USDC shielding skipped for ${p.label}: TokenPool not found for mint ${usdcMint.toBase58()}`,
            );
          } else {
            await shieldUsdc({
              rpc,
              connection,
              signer: p.kp,
              sourceAta: usdcAta,
              amountUi: delta,
              mint: usdcMint,
            });
          }
        }

        const shieldedUsdc = await getShieldedUsdcBalance(rpc, p.kp.publicKey, usdcMint);
        walletState.shieldedUSDC = shieldedUsdc;
        console.log(`✓ ${p.label} shielded balance: ${shieldedUsdc.toFixed(2)} USDC`);

        if (usdcMint.equals(USDC_MINT_DEVNET)) {
          const bal = await connection.getTokenAccountBalance(usdcAta, "confirmed");
          walletState.publicUSDC = bal.value.uiAmount ?? walletState.publicUSDC;
        }
      } catch (e: unknown) {
        hadFailure = true;
        const message =
          e instanceof Error ? e.message : typeof e === "string" ? e : JSON.stringify(e);
        console.error(e instanceof Error ? e.stack : e);
        console.log(`⚠ USDC shielding failed for ${p.label}: ${message}`);
      }
    }
  }

  const demoState: DemoState = {
    lastSeeded: now.toISOString(),
    usdcMint: usdcMint.toBase58(),
    wallets: walletsState,
    demoTransactions: [
      {
        id: "tx1",
        from: "alice",
        to: "bob",
        amount: 25,
        token: "USDC",
        memo: "Invoice #1042 — Design work",
        timestamp: txTimes[0],
        signature: "pending",
      },
      {
        id: "tx2",
        from: "carol",
        to: "alice",
        amount: 0.1,
        token: "SOL",
        memo: "Q4 contractor payment",
        timestamp: txTimes[1],
        signature: "pending",
      },
      {
        id: "tx3",
        from: "bob",
        to: "carol",
        amount: 50,
        token: "USDC",
        memo: "Reimbursement — team dinner",
        timestamp: txTimes[2],
        signature: "pending",
      },
    ],
  };

  await mkdir(dirname(publicDemoStatePath), { recursive: true });
  await writeFile(publicDemoStatePath, JSON.stringify(demoState, null, 2), "utf-8");
  console.log(`\n✓ Wrote demo state: ${publicDemoStatePath}`);
  console.log(`✓ Wallet secrets saved (gitignored): ${demoWalletsPath}`);

  if (hadFailure) {
    console.log("⚠ One or more seeding steps failed. Demo state was still written.");
  }
}

main().catch((e) => {
  console.error("Seed failed:", e);
  process.exitCode = 1;
});
