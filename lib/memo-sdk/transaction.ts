import { Buffer } from "buffer";
import bs58 from "bs58";
import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import type { EncryptedMemo } from "./types";
import { MEMO_PROGRAM_ID, MEMO_V1_PROGRAM_ID, NOOP_PROGRAM_ID } from "./types";
import { decryptMemo, encryptedMemoFromLegacyBlob } from "./encrypt";

export function attachMemoToTransaction(
  transaction: Transaction,
  encryptedMemo: EncryptedMemo,
  signerPublicKey: PublicKey,
): Transaction {
  const data = Buffer.from(JSON.stringify(encryptedMemo), "utf-8");

  const ix = new TransactionInstruction({
    programId: MEMO_PROGRAM_ID,
    keys: [{ pubkey: signerPublicKey, isSigner: true, isWritable: false }],
    data,
  });

  transaction.add(ix);
  return transaction;
}

function parseMemoFromInstructionData(data: string): EncryptedMemo | null {
  const maybe = encryptedMemoFromLegacyBlob(data);
  if (maybe) return maybe;

  try {
    const parsed = JSON.parse(data) as unknown;
    if (typeof parsed !== "object" || parsed === null) return null;
    if (!("ciphertext" in parsed) || !("nonce" in parsed) || !("senderPublicKey" in parsed) || !("version" in parsed)) {
      return null;
    }
    const p = parsed as EncryptedMemo;
    if (
      p.version !== "1" ||
      typeof p.ciphertext !== "string" ||
      typeof p.nonce !== "string" ||
      typeof p.senderPublicKey !== "string"
    ) {
      return null;
    }
    return p;
  } catch {
    return null;
  }
}

export async function extractMemoFromTransaction(
  connection: Connection,
  signature: string,
  recipientSecretKey: Uint8Array,
): Promise<string | null> {
  const tx = await connection.getParsedTransaction(signature, {
    maxSupportedTransactionVersion: 0,
    commitment: "confirmed",
  });
  if (!tx) return null;

  const instructions = tx.transaction.message.instructions;

  for (const ix of instructions) {
    const programId = "programId" in ix ? ix.programId : null;
    const programIdStr = programId ? programId.toBase58() : "";
    const isMemoProgram =
      programIdStr === MEMO_PROGRAM_ID.toBase58() ||
      programIdStr === MEMO_V1_PROGRAM_ID.toBase58() ||
      programIdStr === NOOP_PROGRAM_ID.toBase58() ||
      ("program" in ix && ix.program === "spl-memo");

    if (!isMemoProgram) continue;

    if ("program" in ix && ix.program === "spl-memo" && typeof ix.parsed === "string") {
      const encrypted = parseMemoFromInstructionData(ix.parsed);
      if (!encrypted) return null;
      return decryptMemo(encrypted, recipientSecretKey);
    }

    if ("data" in ix && typeof ix.data === "string") {
      try {
        const decoded = bs58.decode(ix.data);
        const text = new TextDecoder().decode(decoded);
        const encrypted = parseMemoFromInstructionData(text);
        if (!encrypted) return null;
        return decryptMemo(encrypted, recipientSecretKey);
      } catch {
        return null;
      }
    }
  }

  return null;
}
