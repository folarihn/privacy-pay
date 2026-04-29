"use client";

import { useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

const UnifiedWalletButton = dynamic(
  async () => (await import("@jup-ag/wallet-adapter")).UnifiedWalletButton,
  { ssr: false }
);

gsap.registerPlugin(useGSAP);

export default function LandingPage() {
  const container = useRef<HTMLElement>(null);
  const { connected } = useWallet();
  const router = useRouter();

  useEffect(() => {
    if (connected) router.push('/dashboard');
  }, [connected]);

  useGSAP(() => {
    const radiusX = window.innerWidth < 640 ? 120 : 200;
    const radiusY = window.innerWidth < 640 ? 40 : 60;
    const coins = [".coin-1", ".coin-2", ".coin-3"];
    const offsets = [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3]; // 120° apart

    // Set initial positions
    coins.forEach((coin, i) => {
      gsap.set(coin, {
        x: Math.cos(offsets[i]) * radiusX,
        y: Math.sin(offsets[i]) * radiusY,
        scale: 1 + Math.sin(offsets[i]) * 0.15,
        zIndex: Math.round(50 + Math.sin(offsets[i]) * 50),
      });
    });

    // Entrance animation
    gsap.from(".coin-model", {
      opacity: 0,
      scale: 0.3,
      duration: 1.2,
      stagger: 0.15,
      ease: "back.out(1.7)",
    });

    // Clockwise orbital motion
    const duration = 8;
    coins.forEach((coin, i) => {
      gsap.to({ angle: offsets[i] }, {
        angle: offsets[i] + Math.PI * 2,
        duration: duration,
        repeat: -1,
        ease: "none",
        delay: 1.2,
        onUpdate: function () {
          const a = this.targets()[0].angle;
          const x = Math.cos(a) * radiusX;
          const y = Math.sin(a) * radiusY;
          const scale = 1 + Math.sin(a) * 0.2;
          const z = Math.round(50 + Math.sin(a) * 50);
          gsap.set(coin, { x, y, scale, zIndex: z });
        },
      });
    });

    // Gentle self-rotation on each coin
    gsap.to(".coin-1", { rotation: 360, duration: 20, repeat: -1, ease: "none" });
    gsap.to(".coin-2", { rotation: -360, duration: 25, repeat: -1, ease: "none" });
    gsap.to(".coin-3", { rotation: 360, duration: 22, repeat: -1, ease: "none" });

  }, { scope: container });

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-black text-white selection:bg-solana-green selection:text-black overflow-hidden relative" ref={container}>
      {/* Background Concentric Circles visible only behind hero */}
      <div className="absolute top-0 inset-x-0 h-screen flex items-center justify-center pointer-events-none -translate-y-20">
        <div className="absolute w-[40vw] h-[40vw] min-w-[300px] min-h-[300px] rounded-full bg-white/[0.015] shadow-[0_0_100px_rgba(255,255,255,0.01)_inset]" />
        <div className="absolute w-[60vw] h-[60vw] min-w-[500px] min-h-[500px] rounded-full bg-white/[0.015] border border-white/[0.02]" />
        <div className="absolute w-[80vw] h-[80vw] min-w-[700px] min-h-[700px] rounded-full bg-white/[0.01] border border-white/[0.02]" />
        <div className="absolute w-[100vw] h-[100vw] min-w-[900px] min-h-[900px] rounded-full bg-white/[0.005] border border-white/[0.02]" />
        <div className="absolute w-[120vw] h-[120vw] min-w-[1100px] min-h-[1100px] rounded-full border border-white/[0.02]" />
        <div className="absolute w-[140vw] h-[140vw] min-w-[1300px] min-h-[1300px] rounded-full border border-white/[0.02]" />
      </div>

      {/* Hero Section */}
      <div className="relative z-10 flex flex-col items-center justify-center text-center w-full px-6 h-screen max-h-[900px] min-h-[600px] pt-16">

        {/* 3D Assets Container */}
        <div className="relative flex items-center justify-center w-full h-[250px] sm:h-[350px] mt-4 mb-8">
          <div className="coin-model coin-1 absolute drop-shadow-2xl">
            <Image
              src="/1.svg"
              alt="left coin"
              width={200} height={200}
              className="w-32 h-32 sm:w-56 sm:h-56 object-contain drop-shadow-xl"
              priority
            />
          </div>

          <div className="coin-model coin-2 absolute drop-shadow-[0_0_50px_rgba(255,180,0,0.2)]">
            <Image
              src="/2.svg"
              alt="center coin"
              width={280} height={280}
              className="w-40 h-40 sm:w-72 sm:h-72 object-contain drop-shadow-xl"
              priority
            />
          </div>

          <div className="coin-model coin-3 absolute drop-shadow-2xl">
            <Image
              src="/3.svg"
              alt="right coin"
              width={240} height={240}
              className="w-36 h-36 sm:w-60 sm:h-60 object-contain drop-shadow-xl"
              priority
            />
          </div>
        </div>

        {/* Typography */}
        <div className="space-y-4 sm:space-y-6 flex flex-col items-center w-full z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] sm:text-xs font-medium text-solana-purple">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-solana-purple opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-solana-purple"></span>
            </span>
            Live on Solana Devnet
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white leading-tight max-w-4xl text-center">
            <span style={{ fontFamily: 'var(--font-hago)' }} className="text-5xl sm:text-6xl md:text-7xl">Privacy</span> on Solana, <br className="hidden sm:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400">
              Simplified.
            </span>
          </h1>

          <div className="hero-wallet-btn pt-2">
            <UnifiedWalletButton />
          </div>
        </div>

      </div>

      {/* Transition: black hero → white features */}
      <div className="w-full h-32 bg-gradient-to-b from-black to-white shrink-0" />

      {/* About / Features Section */}
      <section className="w-full bg-white text-black py-24 px-6">
        <div className="max-w-6xl mx-auto">
          {/* Section Heading */}
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-tight mb-16 max-w-xl">
            Built for <span style={{ fontFamily: 'var(--font-hago)' }}>Web3</span>, <br />Rebuilt for <span style={{ fontFamily: 'var(--font-hago)' }}>Privacy</span>.
          </h2>

          {/* Bento Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 auto-rows-[280px]">

            {/* Card 1 — Universal Gas Wallet */}
            <div className="relative bg-[#f2f2f2] rounded-3xl p-6 flex flex-col justify-end overflow-hidden group hover:shadow-lg transition-shadow">
              <div className="absolute top-4 left-4 right-4 bottom-24 flex items-center justify-center">
                <Image src="/lock.gif" alt="Shielded Accounts" width={240} height={240} unoptimized className="object-contain w-full h-full drop-shadow-md group-hover:scale-105 transition-transform duration-500" />
              </div>
              <div className="relative z-10">
                <h3 className="text-lg font-bold text-black mb-1">Shielded Accounts</h3>
                <p className="text-sm text-gray-500 leading-relaxed">Convert public SOL into private, ZK-compressed SOL. Your balance is visible only to you.</p>
              </div>
            </div>

            {/* Card 2 — Center Statement + Chain Visual (spans 2 rows) */}
            <div className="relative bg-[#f2f2f2] rounded-3xl p-6 flex flex-col items-center justify-between overflow-hidden md:row-span-2 group hover:shadow-lg transition-shadow">
              <div className="flex-1 flex items-center justify-center">
                <h3 className="text-2xl sm:text-3xl font-black text-black text-center tracking-tight leading-snug uppercase">
                  ONE TOKEN.<br />ALL ROUND PRIVACY.
                </h3>
              </div>
              <div className="w-full flex items-center justify-center flex-1">
                <Image src="/eye-icons.png" alt="One Token All Round Privacy" width={500} height={500} className="object-contain w-[400px] h-[400px] drop-shadow-lg group-hover:scale-105 transition-transform duration-500" />
              </div>
            </div>

            {/* Card 3 — Unified Token Tracker */}
            <div className="relative bg-[#f2f2f2] rounded-3xl p-6 flex flex-col justify-end overflow-hidden group hover:shadow-lg transition-shadow">
              <div className="absolute top-4 left-4 right-4 bottom-24 flex items-center justify-center">
                <Image src="/memos.gif" alt="Encrypted Memos" width={240} height={240} unoptimized className="object-contain w-full h-full drop-shadow-md group-hover:scale-105 transition-transform duration-500" />
              </div>
              <div className="relative z-10">
                <h3 className="text-lg font-bold text-black mb-1">Encrypted Memos</h3>
                <p className="text-sm text-gray-500 leading-relaxed">Attach private notes to payments. Encrypted client-side, ensuring only the recipient can read them.</p>
              </div>
            </div>

            {/* Card 4 — Seedless Recovery */}
            <div className="relative bg-[#f2f2f2] rounded-3xl p-6 flex flex-col justify-end overflow-hidden group hover:shadow-lg transition-shadow">
              <div className="absolute top-4 left-4 right-4 bottom-24 flex items-center justify-center">
                <Image src="/zk-proof.png" alt="ZK Compression" width={240} height={240} className="object-contain w-full h-full drop-shadow-md group-hover:scale-105 transition-transform duration-500" />
              </div>
              <div className="relative z-10">
                <h3 className="text-lg font-bold text-black mb-1">ZK Compression</h3>
                <p className="text-sm text-gray-500 leading-relaxed">Powered by Light Protocol. Enjoy the speed of Solana with the privacy of Zero-Knowledge proofs.</p>
              </div>
            </div>

            {/* Card 5 — Built in Trustworthy */}
            <div className="relative bg-[#f2f2f2] rounded-3xl p-6 flex flex-col justify-end overflow-hidden group hover:shadow-lg transition-shadow">
              <div className="absolute top-4 left-4 right-4 bottom-24 flex items-center justify-center">
                <Image src="/shajky6.png" alt="Built-in Trust" width={240} height={240} className="object-contain w-full h-full drop-shadow-md group-hover:scale-105 transition-transform duration-500" />
              </div>
              <div className="relative z-10">
                <h3 className="text-lg font-bold text-black mb-1">Built-in Trust</h3>
                <p className="text-sm text-gray-500 leading-relaxed">Open-source, transparent, and community-verified. You control your keys, always.</p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full bg-black text-white px-6 py-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">

          <div className="flex items-center gap-4">
            <span style={{ fontFamily: 'var(--font-hago)' }} className="text-lg font-bold text-white">CipherPay</span>
            <a
              href="https://x.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/40 hover:text-white transition-colors"
              aria-label="X (Twitter)"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622Zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
          </div>

          <div className="flex items-center gap-4">
            <p className="text-xs text-white/25">© 2026 CipherPay</p>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10">
              <span className="w-1.5 h-1.5 rounded-full bg-white/50 animate-pulse" />
              <span className="text-[10px] text-white/40">Devnet</span>
            </div>
          </div>

        </div>
      </footer>
    </main>
  );
}
