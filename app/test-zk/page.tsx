"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { shieldFunds, getCompressedBalance, sendZkPayment } from "@/lib/solana/engines/zkCompressedTransfer";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";

export default function TestZkPage() {
  const wallet = useWallet();
  const [status, setStatus] = useState("Idle");
  const [logs, setLogs] = useState<string[]>([]);
  const [zkBalance, setZkBalance] = useState<number | null>(null);

  const addLog = (msg: string) => setLogs((prev) => [...prev, msg]);

  const fetchBalance = async () => {
      if (!wallet.publicKey) return;
      try {
          addLog("Fetching Compressed Balance...");
          const lamports = await getCompressedBalance(wallet.publicKey.toBase58());
          const sol = lamports / LAMPORTS_PER_SOL;
          setZkBalance(sol);
          addLog(`Balance: ${sol} ZK-SOL`);
      } catch (e: unknown) {
          const message =
            e instanceof Error ? e.message : typeof e === "string" ? e : JSON.stringify(e);
          addLog(`Error fetching balance: ${message}`);
      }
  };

  const runTest = async () => {
    setStatus("Running...");
    addLog("Starting ZK Test...");
    
    if (!wallet.publicKey) {
        addLog("Error: Wallet not connected!");
        setStatus("Error");
        return;
    }

    try {
      addLog("Calling shieldFunds (Deposit 0.001 SOL)...");
      const signature = await shieldFunds({
        payer: wallet,
        toPubkey: wallet.publicKey.toBase58(), // Shield to self
        amountLamports: 1_000_000, // 0.001 SOL
      });
      addLog(`Success! Signature: ${signature}`);
      setStatus("Success");
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : typeof e === "string" ? e : JSON.stringify(e);
      addLog(`Error: ${message}`);
      const logs = (e as { logs?: unknown }).logs;
      if (logs !== undefined) addLog(`Logs: ${JSON.stringify(logs)}`);
      setStatus("Error");
    }
  };

  const runTransfer = async () => {
      setStatus("Running...");
      addLog("Starting ZK Transfer...");

      if (!wallet.publicKey) {
          addLog("Error: Wallet not connected!");
          setStatus("Error");
          return;
      }

      try {
          addLog("Calling sendZkPayment (Transfer 0.0001 SOL)...");
          // Transfer to a random address for testing, or self
          // Let's transfer to self for now to verify balance changes
          const signature = await sendZkPayment({
              payer: wallet,
              toPubkey: wallet.publicKey.toBase58(), 
              amountLamports: 100_000, // 0.0001 SOL
          });
          addLog(`Success! Transfer Signature: ${signature}`);
          setStatus("Success");
          
          // Refresh balance
          setTimeout(fetchBalance, 2000);
      } catch (e: unknown) {
          const message =
            e instanceof Error ? e.message : typeof e === "string" ? e : JSON.stringify(e);
          addLog(`Error: ${message}`);
          const logs = (e as { logs?: unknown }).logs;
          if (logs !== undefined) addLog(`Logs: ${JSON.stringify(logs)}`);
          setStatus("Error");
      }
  };

  return (
    <div className="min-h-screen bg-black text-white p-8 font-mono">
      <h1 className="text-2xl mb-4">Phase 1: ZK Integration Test</h1>
      
      <div className="mb-4">
        <p className="mb-2">1. Connect Wallet (Top Right)</p>
        <p className="mb-2">2. Ensure you have Devnet SOL</p>
      </div>

      <div className="flex flex-wrap gap-4">
          <button
            onClick={runTest}
            disabled={!wallet.publicKey}
            className="px-4 py-2 bg-green-500 text-black font-bold rounded hover:bg-green-400 disabled:bg-gray-700"
          >
            Test Shield (Deposit 0.001)
          </button>

          <button
            onClick={fetchBalance}
            disabled={!wallet.publicKey}
            className="px-4 py-2 bg-blue-500 text-white font-bold rounded hover:bg-blue-400 disabled:bg-gray-700"
          >
            Check ZK Balance
          </button>

          <button
            onClick={runTransfer}
            disabled={!wallet.publicKey || zkBalance === 0}
            className="px-4 py-2 bg-purple-500 text-white font-bold rounded hover:bg-purple-400 disabled:bg-gray-700"
          >
            Test Transfer (Send 0.0001)
          </button>
      </div>

      {zkBalance !== null && (
          <div className="mt-4 p-4 bg-gray-800 rounded">
              <h3 className="text-xl">Current Compressed Balance:</h3>
              <p className="text-2xl font-bold text-green-400">{zkBalance} SOL</p>
          </div>
      )}

      <div className="mt-8 border border-gray-700 p-4 rounded">
        <h2 className="text-xl mb-2">Logs:</h2>
        {logs.map((log, i) => (
          <div key={i} className="text-sm text-gray-300 break-all">
            {log}
          </div>
        ))}
      </div>

      <div className="mt-4 text-xs text-gray-500">
        Status: {status}
      </div>
    </div>
  );
}
