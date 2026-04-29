import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "@solana/wallet-adapter-react-ui/styles.css";
import { WalletConnectionProvider } from "@/components/WalletConnectionProvider";
import { NavBar } from "@/components/NavBar";
import { DemoBanner } from "@/components/DemoBanner";
import { DemoModeProvider } from "@/hooks/useDemoMode";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Cipher Pay (Devnet)",
  description: "Simple link-based payments on Solana Devnet with client-side encrypted memos and receipt-based inbox syncing.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <WalletConnectionProvider>
          <DemoModeProvider>
            <NavBar />
            <DemoBanner />
            {children}
          </DemoModeProvider>
        </WalletConnectionProvider>
      </body>
    </html>
  );
}
