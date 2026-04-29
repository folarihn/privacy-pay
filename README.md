# Cipher Pay (Privacy Layer for Solana)

Cipher Pay is a **shielded payments + private messaging app** on Solana. It brings financial privacy to everyday users by leveraging **Zero-Knowledge Compression (Light Protocol)**.

With Cipher Pay you can shield assets, send privately, and attach **end-to-end encrypted memos** that only the intended recipient can read. It reduces the “transparent ledger” problem (public balances, public transfer graphs, public notes).

---

## Key Features

### Shielded Wallet (Light Protocol)
- **Shield / Unshield:** Move SOL or devnet USDC between your public wallet and shielded balance.
- **Private sends:** Transfer from your shielded balance to a recipient with unlinkability benefits from compression.

### End-to-End Encrypted Memos (Memo SDK)
- **Client-side encryption:** Notes are encrypted before they hit the chain.
- **Reusable module:** Memo logic is extracted into a small SDK under `lib/memo-sdk/*`.

### Payment Links + Inbox
- **Request payments:** Generate a payment link that includes memo metadata for the sender.
- **Receipts inbox:** Add receipts and decrypt memos when you “unlock” your inbox with a wallet signature.

### Jupiter Swaps
- **Swap & Shield:** Swap supported tokens into SOL/USDC then shield in one flow (Jupiter Ultra).
- **Token-to-token swap:** A Swap panel lets users swap between common liquid tokens via Jupiter.

### Solana Actions / Blinks
- **Blinks support:** Payment links can be shared as Blink URLs (dial.to format) for Phantom / X / Blink clients.
- **Endpoints:** `GET /actions.json`, `GET|POST /api/actions/pay`.

### Compliance Screening (Range Protocol)
- **Recipient screening:** Send panel checks recipient risk and blocks flagged addresses.

### Notifications + Batch Send
- **Real-time activity:** Helius Enhanced WebSocket notifications with a navbar bell.
- **Batch private send:** CSV-driven multi-recipient private payouts (sequential execution to avoid state conflicts).

---

## User Guide

### Wallet setup
- Install Phantom / Solflare / Backpack.
- For shielding features, use **Devnet** (SOL faucet works on Devnet).

### Request a payment (link)
- Open **Dashboard → Request Payment** and generate a payment link.
- Share the link with the sender.

### Send privately
- Shield funds first (Dashboard → Shield).
- Use **Send → recipient → amount**, optionally with an encrypted memo.

### Inbox
- Open **Inbox** and unlock with a signature to decrypt private memos.

---

## For Developers

### Tech Stack
- **Frontend**: Next.js (App Router), React, TypeScript (strict), Tailwind v4
- **Blockchain**: `@solana/web3.js`, Wallet Adapter
- **Privacy Engine**: Light Protocol (ZK Compression + Compressed Tokens)
- **RPC Provider**: Helius (for compression support)
- **Swaps**: Jupiter Ultra REST API (no SDK)
- **Blinks**: `@solana/actions`

### Installation
1. **Clone the repo:**
   ```bash
   git clone https://github.com/yomite47/privacy-pay.git
   cd privacy-pay
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment** (`.env.local`):
   ```env
   # RPC (Devnet for shielding)
   NEXT_PUBLIC_RPC_URL=https://devnet.helius-rpc.com/?api-key=YOUR_KEY

   # Jupiter Ultra (Mainnet swaps only)
   NEXT_PUBLIC_JUPITER_API_KEY=YOUR_JUPITER_KEY

   # Range compliance screening
   RANGE_API_KEY=YOUR_RANGE_KEY
   RANGE_API_URL=https://api.range.org/v1
   ```

4. **Run the app:**
   ```bash
   npm run dev
   ```

### Demo Mode (optional)
- Seed demo wallets + balances:
  ```bash
  npm run seed:demo
  ```

### Swaps note (important)
- Jupiter Ultra swaps are **mainnet-only** and require an API key header.
- Set `NEXT_PUBLIC_HELIUS_RPC_URL` to a mainnet Helius endpoint to enable all mainnet features.

---

## ⚠️ Disclaimer
Cipher Pay is in active development. Privacy and compliance features are evolving — use responsibly and verify all transactions before sending real funds.
