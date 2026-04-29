import Link from "next/link";
import { DemoStatsRow } from "@/components/DemoStatsRow";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[color:var(--color-bg)] text-[color:var(--color-text-secondary)]">
      <section className="px-6 pt-24 text-center">
        <div className="mx-auto w-full max-w-[680px]">
          <div className="mb-5 font-mono text-[11px] tracking-[0.06em] text-[color:var(--color-text-muted)]">
            ⬡&nbsp;&nbsp;ZK COMPRESSION&nbsp;&nbsp;·&nbsp;&nbsp;END-TO-END ENCRYPTED&nbsp;&nbsp;·&nbsp;&nbsp;LIGHT PROTOCOL
          </div>

          <h1 className="font-bold tracking-[-0.02em] leading-[1.1]">
            <span className="block text-[clamp(42px,6vw,64px)] text-[color:var(--color-text-primary)]">
              Privacy on Solana,
            </span>
            <span className="block text-[clamp(42px,6vw,64px)] text-[color:var(--color-accent)]">
              Simplified.
            </span>
          </h1>

          <p className="mx-auto mt-5 max-w-[480px] text-[16px] leading-[1.7] text-[color:var(--color-text-secondary)]">
            Shield assets with ZK compression, attach end-to-end encrypted memos, and ship receipts that can be verified on-chain.
          </p>

          <div className="mt-6 flex items-center justify-center text-[13px] text-[color:var(--color-text-secondary)]">
            <span>✓ Non-custodial</span>
            <span className="mx-4 h-[14px] w-px bg-[color:var(--color-border)]" />
            <span>✓ Open source</span>
            <span className="mx-4 h-[14px] w-px bg-[color:var(--color-border)]" />
            <span>✓ ZK-compressed</span>
          </div>

          <div className="mt-8 flex items-center justify-center gap-3">
            <Link href="/dashboard" className="cipher-btn-primary px-7 py-3 text-[15px]">
              Use Tech Now →
            </Link>
            <Link
              href="https://github.com/yomite47/privacy-pay"
              target="_blank"
              className="cipher-btn-ghost px-7 py-3 text-[15px]"
            >
              View Code
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto mt-20 w-full max-w-[960px] px-6">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <FeatureCard
            accentColor="var(--color-accent)"
            eyebrow="PRIVACY"
            title="Shielded accounts"
            description="Convert public SOL into private, ZK-compressed SOL. Your balance is stored in a compressed state tree."
            icon={<ShieldIcon />}
            footer={
              <div className="flex flex-wrap gap-2">
                <span className="cipher-badge-shielded">ZK Compressed</span>
                <span className="cipher-badge-shielded">Light Protocol</span>
              </div>
            }
          />

          <FeatureCard
            accentColor="var(--color-emerald)"
            eyebrow="MESSAGING"
            title="Encrypted memos"
            description="Attach private notes to payments. Encrypted client-side using wallet-derived keys so only the recipient can read them."
            icon={<LockIcon />}
            footer={
              <div className="flex flex-wrap gap-2">
                <span className="cipher-badge-shielded">E2E Encrypted</span>
                <span className="cipher-badge-shielded">Wallet Derived Keys</span>
              </div>
            }
          />

          <FeatureCard
            accentColor="var(--color-amber)"
            eyebrow="PERFORMANCE"
            title="Light speed"
            description="Powered by Light Protocol and Helius. Fast settlement, minimal friction, and verification-first receipts."
            icon={<BoltIcon />}
            footer={
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center rounded-[20px] bg-[color:var(--color-amber-dim)] px-2 py-[2px] text-[11px] font-medium text-[color:var(--color-amber)]">
                  Helius RPC
                </span>
                <span className="inline-flex items-center rounded-[20px] bg-[color:var(--color-amber-dim)] px-2 py-[2px] text-[11px] font-medium text-[color:var(--color-amber)]">
                  &lt; 400ms
                </span>
              </div>
            }
          />
        </div>
      </section>

      <DemoStatsRow />

      <footer className="mt-20 w-full border-t border-[color:var(--color-border-subtle)] p-6">
        <div className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center justify-between gap-3">
          <div className="text-[14px] font-medium text-[color:var(--color-text-primary)]">
            Cipher Pay
          </div>
          <div className="text-[13px] text-[color:var(--color-text-muted)]">
            Built for Solana Renaissance Hackathon 2026
          </div>
          <div className="flex items-center gap-4 text-[13px] text-[color:var(--color-text-muted)]">
            <a
              href="https://lightprotocol.com"
              target="_blank"
              rel="noreferrer"
              className="transition-colors duration-150 hover:text-[color:var(--color-text-primary)]"
            >
              Light Protocol
            </a>
            <a
              href="https://helius.xyz"
              target="_blank"
              rel="noreferrer"
              className="transition-colors duration-150 hover:text-[color:var(--color-text-primary)]"
            >
              Helius
            </a>
            <a
              href="https://nextjs.org"
              target="_blank"
              rel="noreferrer"
              className="transition-colors duration-150 hover:text-[color:var(--color-text-primary)]"
            >
              Next.js
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}

function FeatureCard({
  accentColor,
  icon,
  eyebrow,
  title,
  description,
  footer,
}: {
  accentColor: string;
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  footer: React.ReactNode;
}) {
  return (
    <div className="cipher-card" style={{ borderTopColor: accentColor }}>
      <div className="text-[color:var(--color-text-secondary)]">
        <div className="text-[color:var(--color-text-secondary)]" style={{ color: accentColor }}>
          {icon}
        </div>
        <div className="mt-4">
          <div className="cipher-label">{eyebrow}</div>
          <div className="mt-2 text-[15px] font-medium text-[color:var(--color-text-primary)]">
            {title}
          </div>
          <div className="mt-2 text-[14px] leading-[1.6] text-[color:var(--color-text-secondary)]">
            {description}
          </div>
        </div>
        <div className="mt-5">{footer}</div>
      </div>
    </div>
  );
}

function ShieldIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3 19 6.5v6.1c0 5.1-3.4 8.7-7 9.9-3.6-1.2-7-4.8-7-9.9V6.5L12 3Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M9.2 12.2 11 14l3.8-4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M7.5 11V8.5a4.5 4.5 0 0 1 9 0V11"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M6.75 11h10.5c.966 0 1.75.784 1.75 1.75v6.5c0 .966-.784 1.75-1.75 1.75H6.75A1.75 1.75 0 0 1 5 19.25v-6.5c0-.966.784-1.75 1.75-1.75Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M12 15v2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
