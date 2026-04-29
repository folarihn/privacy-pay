"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { TokenSelector } from "@/components/TokenSelector";
import { useBatchSend } from "@/hooks/useBatchSend";
import { DEFAULT_SOLANA_CLUSTER, getExplorerTxUrl } from "@/lib/constants";
import { lightRpc } from "@/lib/solana/lightProtocol";

function downloadTextFile(filename: string, content: string, mime = "text/plain") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function countCsvRecipients(csvText: string): number {
  const lines = csvText.trim().split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (!lines.length) return 0;
  const first = lines[0].trim().toLowerCase();
  const dataLines = first.startsWith("address") ? lines.slice(1) : lines;
  return dataLines.filter((line) => {
    const parts = line.split(",").map((s) => s.trim());
    return Boolean(parts[0]) && Boolean(parts[1]);
  }).length;
}

function StatusDot(props: { status: string }) {
  const { status } = props;

  const base = "h-4 w-4 rounded-full border flex items-center justify-center text-[12px] leading-none";

  if (status === "checking") {
    return (
      <span className={`${base} border-[color:var(--color-amber)] cipher-batch-pulse`} />
    );
  }
  if (status === "ready") {
    return <span className={`${base} border-[color:var(--color-emerald)] bg-[color:var(--color-emerald)]`} />;
  }
  if (status === "flagged") {
    return <span className={`${base} border-[#EF4444] bg-[#EF4444]`} />;
  }
  if (status === "sending") {
    return <span className={`${base} border-[color:var(--color-accent)] cipher-batch-spin`} />;
  }
  if (status === "sent") {
    return (
      <span className={`${base} border-[color:var(--color-emerald)] bg-[color:var(--color-emerald)] text-black`}>
        ✓
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className={`${base} border-[#EF4444] bg-[#EF4444] text-black`}>
        ✕
      </span>
    );
  }

  return <span className={`${base} border-[color:var(--color-border)]`} />;
}

export default function BatchSendPage() {
  const wallet = useWallet();
  const { connection } = useConnection();

  const {
    session,
    phase,
    setPhase,
    isSending,
    addRecipient,
    updateRecipient,
    removeRecipient,
    setToken,
    setLabel,
    importCSV,
    checkAllCompliance,
    sendAll,
    totalAmount,
    readyCount,
    flaggedCount,
    sentCount,
    failedCount,
    checkingCount,
    reset,
  } = useBatchSend();

  const [pasteCsv, setPasteCsv] = useState("");
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const progressPct = useMemo(() => {
    if (readyCount <= 0) return 0;
    const done = sentCount + failedCount;
    return Math.min(100, Math.max(0, (done / readyCount) * 100));
  }, [failedCount, readyCount, sentCount]);

  useEffect(() => {
    if (phase !== "sending") return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [phase]);

  function downloadTemplate() {
    const csv =
      "address,amount,memo\n" +
      "7xKX...abc,100,April salary\n" +
      "9mP...xyz,50,Bonus\n";
    downloadTextFile("cipher-pay-batch-template.csv", csv, "text/csv");
  }

  async function onFileSelected(file: File) {
    const text = await file.text();
    const n = countCsvRecipients(text);
    importCSV(text);
    setImportStatus(`✓ ${n} recipients imported`);
  }

  function exportResults() {
    const header = "address,amount,token,status,signature,memo\n";
    const rows = session.recipients.map((r) => {
      const safe = (v: string) => `"${v.replace(/"/g, '""')}"`;
      return [
        safe(r.address),
        safe(r.amount),
        safe(session.token),
        safe(r.status),
        safe(r.signature ?? ""),
        safe(r.memo),
      ].join(",");
    });
    const csv = header + rows.join("\n") + "\n";
    const date = new Date().toISOString().slice(0, 10);
    downloadTextFile(`cipher-pay-batch-${date}.csv`, csv, "text/csv");
  }

  const hasRecipients = session.recipients.length > 0;

  return (
    <main className="min-h-screen bg-[color:var(--color-bg)] px-6 pt-[104px] pb-16 text-[color:var(--color-text-secondary)]">
      <style jsx global>{`
        @keyframes batchPulse {
          0% {
            opacity: 1;
          }
          50% {
            opacity: 0.4;
          }
          100% {
            opacity: 1;
          }
        }
        .cipher-batch-pulse {
          animation: batchPulse 1.2s ease-in-out infinite;
        }
        @keyframes batchSpin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        .cipher-batch-spin {
          border-top-color: transparent;
          animation: batchSpin 0.8s linear infinite;
        }
      `}</style>

      <div className="mx-auto w-full max-w-[800px] pt-12">
        <div className="cipher-label">PAYROLL &amp; BATCH PAYMENTS</div>
        <div className="mt-2 text-[24px] font-semibold text-[color:var(--color-text-primary)]">
          Send privately to multiple recipients
        </div>
        <div className="mt-1 text-[14px] text-[color:var(--color-text-secondary)]">
          Each recipient receives a shielded transfer with their own encrypted memo. Transactions are sent sequentially to avoid state tree conflicts.
        </div>

        {phase === "sending" && (
          <div className="cipher-card mt-6">
            <div className="text-[15px] font-medium text-[color:var(--color-text-primary)]">
              Sending in progress...
            </div>
            <div className="mt-4 h-1 w-full rounded bg-[color:var(--color-surface)]">
              <div
                className="h-1 rounded bg-[color:var(--color-accent)] transition-[width] duration-300 ease-out"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="mt-2 text-[13px] text-[color:var(--color-text-secondary)]">
              {sentCount + failedCount} of {readyCount} sent
            </div>
          </div>
        )}

        {phase === "complete" && (
          <div className="cipher-card-accent-left mt-6">
            <div className="flex items-start gap-4">
              <div className="text-[color:var(--color-emerald)]">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M20 6 9 17l-5-5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <div className="min-w-0">
                <div className="text-[18px] font-semibold text-[color:var(--color-text-primary)]">
                  Batch complete
                </div>
                <div className="mt-2 text-[13px] text-[color:var(--color-emerald)]">
                  {sentCount} sent successfully
                </div>
                {failedCount > 0 && (
                  <div className="mt-1 text-[13px] text-[#EF4444]">{failedCount} failed</div>
                )}
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    className="cipher-btn-ghost px-4 py-2 text-[13px]"
                    onClick={exportResults}
                  >
                    Export report
                  </button>
                  <button
                    type="button"
                    className="cipher-btn-primary px-4 py-2 text-[13px]"
                    onClick={reset}
                  >
                    Start new batch
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="cipher-card mt-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <div className="cipher-label">BATCH LABEL</div>
              <input
                className="cipher-input mt-2 w-full"
                placeholder="e.g. April Payroll 2025"
                value={session.label}
                onChange={(e) => setLabel(e.target.value)}
                disabled={phase !== "compose"}
              />
            </div>
            <div>
              <div className="cipher-label">TOKEN</div>
              <div className="mt-2">
                <TokenSelector
                  selected={session.token}
                  onChange={(t) => setToken(t)}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="cipher-card mt-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[14px] font-medium text-[color:var(--color-text-primary)]">
              Import from CSV
            </div>
            <button
              type="button"
              className="text-[12px] text-[color:var(--color-accent)] hover:text-[color:var(--color-text-primary)] transition-colors duration-150"
              onClick={downloadTemplate}
            >
              Download template
            </button>
          </div>

          <div className="mt-3 flex flex-col gap-3 md:flex-row">
            <div
              className="cipher-card flex-1 border border-dashed border-[color:var(--color-border)] rounded-[var(--radius-md)] p-6 text-center cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
              }}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files?.[0];
                if (!file) return;
                void onFileSelected(file);
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  void onFileSelected(file);
                  e.target.value = "";
                }}
              />
              <div className="mx-auto w-fit text-[color:var(--color-text-muted)]">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M12 3v12"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                  <path
                    d="M7 8l5-5 5 5"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M4 21h16"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <div className="mt-2 text-[13px] text-[color:var(--color-text-muted)]">
                Drop CSV here
              </div>
              <div className="mt-1 text-[12px] text-[color:var(--color-text-muted)]">or</div>
              <div className="mt-1 text-[12px] text-[color:var(--color-accent)]">Browse file</div>
              {importStatus && (
                <div className="mt-2 text-[12px] text-[color:var(--color-emerald)]">
                  {importStatus}
                </div>
              )}
            </div>

            <div className="flex-1">
              <div className="cipher-label">OR PASTE CSV</div>
              <textarea
                className="cipher-input mt-2 w-full min-h-[88px] font-mono text-[12px]"
                placeholder={`address,amount,memo\n7xKX...abc,100,April salary\n9mP...xyz,50,Bonus`}
                value={pasteCsv}
                onChange={(e) => setPasteCsv(e.target.value)}
              />
              <button
                type="button"
                className="cipher-btn-ghost mt-2 px-3 py-1 text-[12px]"
                onClick={() => {
                  const n = countCsvRecipients(pasteCsv);
                  importCSV(pasteCsv);
                  if (n > 0) setImportStatus(`✓ ${n} recipients imported`);
                }}
              >
                Import
              </button>
            </div>
          </div>
        </div>

        <div className="mt-8 flex items-center justify-between gap-3">
          <div className="cipher-label">RECIPIENTS ({session.recipients.length})</div>
          <button
            type="button"
            className="cipher-btn-ghost px-3 py-1 text-[12px]"
            onClick={addRecipient}
            disabled={phase !== "compose"}
          >
            Add recipient +
          </button>
        </div>

        {session.recipients.length === 0 ? (
          <div className="cipher-card mt-3 text-center px-6 py-10">
            <div className="text-[14px] text-[color:var(--color-text-muted)]">
              No recipients yet
            </div>
            <div className="mt-2 text-[12px] text-[color:var(--color-text-muted)]">
              Import a CSV or add recipients manually
            </div>
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            {session.recipients.map((r, idx) => {
              const readOnly = phase !== "compose";
              return (
                <div key={r.id} className="cipher-card">
                  <div className="flex gap-3 items-start">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface)] font-mono text-[12px] text-[color:var(--color-text-muted)]">
                      {idx + 1}
                    </div>

                    <div className="min-w-0 flex-1 grid grid-cols-1 gap-3 md:grid-cols-3">
                      <div>
                        <div className="cipher-label">ADDRESS</div>
                        <input
                          className="cipher-input mt-2 w-full font-mono text-[12px]"
                          placeholder="Solana wallet address"
                          value={r.address}
                          onChange={(e) =>
                            updateRecipient(r.id, {
                              address: e.target.value,
                              status: "idle",
                              complianceResult: null,
                              error: null,
                            })
                          }
                          readOnly={readOnly}
                        />
                      </div>
                      <div>
                        <div className="cipher-label">AMOUNT ({session.token})</div>
                        <input
                          type="number"
                          min={0}
                          step="0.000001"
                          className="cipher-input mt-2 w-full"
                          placeholder="0.00"
                          value={r.amount}
                          onChange={(e) => updateRecipient(r.id, { amount: e.target.value })}
                          readOnly={readOnly}
                        />
                      </div>
                      <div>
                        <div className="cipher-label">MEMO (ENCRYPTED)</div>
                        <input
                          className="cipher-input mt-2 w-full"
                          placeholder="Private note..."
                          value={r.memo}
                          onChange={(e) => updateRecipient(r.id, { memo: e.target.value })}
                          readOnly={readOnly}
                        />
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <StatusDot status={r.status} />
                      {(r.status === "flagged" || r.status === "failed") && r.error && (
                        <div className="max-w-[120px] text-right text-[11px] text-[#EF4444]">
                          {r.error}
                        </div>
                      )}
                      {r.status !== "sending" && r.status !== "sent" && phase === "compose" && (
                        <button
                          type="button"
                          className="bg-transparent p-0 text-[14px] text-[color:var(--color-text-muted)] hover:text-[#EF4444] transition-colors duration-150"
                          onClick={() => removeRecipient(r.id)}
                        >
                          ✕
                        </button>
                      )}
                      {r.status === "sent" && r.signature && (
                        <a
                          href={getExplorerTxUrl(r.signature, DEFAULT_SOLANA_CLUSTER)}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[12px] text-[color:var(--color-accent)] hover:text-[color:var(--color-text-primary)] transition-colors duration-150"
                        >
                          View tx →
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {hasRecipients && phase === "compose" && (
          <div className="sticky bottom-6 mt-8">
            <div className="cipher-card flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-wrap items-center gap-6 text-[13px] text-[color:var(--color-text-secondary)]">
                <div>{session.recipients.length} recipients</div>
                <div className="font-mono text-[color:var(--color-text-primary)]">
                  Total: {totalAmount.toFixed(4)} {session.token}
                </div>
                {flaggedCount > 0 && <div className="text-[#EF4444]">{flaggedCount} flagged</div>}
                {checkingCount > 0 && <div className="text-[color:var(--color-text-muted)]">{checkingCount} checking</div>}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  className="cipher-btn-ghost px-4 py-2 text-[13px]"
                  onClick={() => void checkAllCompliance()}
                  disabled={session.recipients.filter((r) => r.address.trim().length > 30).length === 0}
                >
                  Check compliance
                </button>
                <button
                  type="button"
                  className="cipher-btn-primary px-4 py-2 text-[13px]"
                  onClick={() => setPhase("review")}
                  disabled={readyCount === 0}
                >
                  Review &amp; send →
                </button>
              </div>
            </div>
          </div>
        )}

        {phase === "review" && (
          <div className="mt-6">
            <div className="cipher-card-accent-left mb-6">
              <div className="text-[15px] font-medium text-[color:var(--color-text-primary)]">
                Review before sending
              </div>
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <div className="text-[12px] text-[color:var(--color-text-muted)]">Ready to send</div>
                  <div className="mt-1 text-[14px] font-medium text-[color:var(--color-emerald)]">
                    {readyCount}
                  </div>
                </div>
                <div>
                  <div className="text-[12px] text-[color:var(--color-text-muted)]">Flagged (skipped)</div>
                  <div className="mt-1 text-[14px] font-medium text-[#EF4444]">
                    {flaggedCount}
                  </div>
                </div>
                <div>
                  <div className="text-[12px] text-[color:var(--color-text-muted)]">Total amount</div>
                  <div className="mt-1 font-mono text-[14px] text-[color:var(--color-text-primary)]">
                    {totalAmount.toFixed(4)} {session.token}
                  </div>
                </div>
              </div>

              {flaggedCount > 0 && (
                <div className="mt-3 text-[13px] text-[color:var(--color-amber)]">
                  {flaggedCount} flagged recipients will be skipped. Only cleared addresses will receive funds.
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  className="cipher-btn-ghost px-4 py-2 text-[13px]"
                  onClick={() => setPhase("compose")}
                  disabled={isSending}
                >
                  ← Back to edit
                </button>
                <button
                  type="button"
                  className="cipher-btn-primary px-4 py-2 text-[13px]"
                  onClick={() => void sendAll(lightRpc, connection, wallet)}
                  disabled={!wallet.connected || !wallet.publicKey || isSending || readyCount === 0}
                >
                  <span className="inline-flex items-center gap-2">
                    {isSending && <span className="animate-spin">↻</span>}
                    {isSending ? "Sending..." : `Send to ${readyCount} recipients`}
                  </span>
                </button>
              </div>
              {!wallet.connected && (
                <div className="mt-3 text-[13px] text-[color:var(--color-amber)]">
                  Connect a wallet to continue
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mt-10">
          <Link
            href="/dashboard"
            className="text-[13px] text-[color:var(--color-text-muted)] hover:text-[color:var(--color-accent)] transition-colors duration-150"
          >
            ← Back to dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
