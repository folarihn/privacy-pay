import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import "@solana/wallet-adapter-react-ui/styles.css";
import { WalletConnectionProvider } from "@/components/WalletConnectionProvider";
import { NavBar } from "@/components/NavBar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const hago = localFont({
  src: "../public/fonts/Hago-Regular.otf",
  variable: "--font-hago",
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
        className={`${geistSans.variable} ${geistMono.variable} ${hago.variable} antialiased`}
        suppressHydrationWarning
      >
        <WalletConnectionProvider>
          <NavBar />
          {children}
        </WalletConnectionProvider>
      </body>
    </html>
  );
}
