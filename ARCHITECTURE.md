# Cipher Pay Architecture

Cipher Pay is designed to enable **privacy-preserving payment links** on Solana. The project evolves in two distinct phases, moving from cryptographic privacy (Phase 0) to zero-knowledge privacy (Phase 1).

## Phase 0: Client-Side Privacy (Current)

In this phase, we use standard Solana transfers but leverage **client-side encryption** to protect the "intent" and "content" of the payment (the memo) from public view.

### Workflow
1.  **Sender** generates a payment link with an *encrypted memo* (AES-GCM).
2.  **Sender** funds the link via a standard `SystemProgram.transfer` to the receiver.
3.  **Receiver** uses the link to decrypt the memo locally.
4.  **Inbox** validates the transaction on-chain and stores the decrypted receipt in local storage.

### Privacy Guarantees
*   **Content Privacy:** The memo content is encrypted and unreadable on-chain.
*   **Anonymity:** None. Sender and Receiver addresses are visible on-chain.

---

## Phase 1: ZK Shielded Privacy (Current & Roadmap)
*Leveraging Light Protocol & ZK Compression.*

In this phase, we transition to **true shielded transfers** by building on top of [Light Protocol](https://www.lightprotocol.com/). We use Light Protocol as the infrastructure layer for state compression and nullifiers, while Cipher Pay provides the application logic for shielded links.

### Implementation Status
- [x] **Shielding:** Convert Public SOL to Compressed SOL (`shieldFunds`).
- [x] **Balance Tracking:** View Compressed SOL Balance (`getCompressedBalance`).
- [ ] **Private Transfer:** Send Compressed SOL to another user (`transferCompressedSol`).
- [ ] **Unshielding:** Convert Compressed SOL back to Public SOL (`unshieldFunds`).
- [ ] **Relayer Integration:** Submit proofs via a relayer for gas-less/anonymous transactions.

### Architecture
We do not use a pre-made "shielded transfer" function. Instead, we compose Light Protocol primitives to build a **Private Payment Link Protocol**:

1.  **Private Funding (The UTXO)**
    *   Instead of a system transfer, the Sender creates a **Compressed UTXO** (Unspent Transaction Output).
    *   This UTXO contains the `amount` and a `secret` derived from the link.
    *   We use Light Protocol to store the **Hash** of this UTXO in a State Merkle Tree on Solana.
    *   *Result:* The funds are "shielded" because only the hash is visible on-chain.

2.  **Private Claiming (The Nullifier)**
    *   The Receiver (with the link) possesses the `secret`.
    *   Receiver generates a **Zero-Knowledge Proof (ZKP)** locally.
    *   The proof asserts: *"I know the secret for a valid UTXO in the Merkle Tree, and I am authorized to spend it."*
    *   We submit this proof to Light Protocol.
    *   Light Protocol verifies the proof and records a **Nullifier** to prevent double-spending.
    *   The funds are then "unshielded" to the Receiver's wallet (or re-shielded to their private balance).

### Why This Matters
*   **Infrastructure (Light Protocol):** Handles the hard math—Merkle Trees, Validity Proofs, Nullifier Sets.
*   **Application (Cipher Pay):** Handles the user intent—Link generation, Secret management, Proof coordination.

### Integration Status
*   `@lightprotocol/compressed-token` and `@lightprotocol/stateless.js` are installed in `package.json`.
*   The application structure (`lib/solana/engines`) is modular to support swapping the `SystemTransfer` engine with a `ZkCompressedTransfer` engine in the future.

---

## Roadmap to Full Completion

To consider Cipher Pay "Feature Complete", the following milestones must be achieved:

### 1. Full ZK Shielded Cycle
- **Objective:** Allow users to Shield -> Transfer Privately -> Unshield.
- **Tasks:**
    - Implement `transferCompressedSol` in `zkCompressedTransfer.ts`.
    - Implement `unshieldFunds` in `zkCompressedTransfer.ts`.
    - Connect UI "Send" and "Withdraw" buttons to these functions.

### 2. Private Payment Links (The "Killer Feature")
- **Objective:** Merge the "Link" concept with "ZK Shielding".
- **Tasks:**
    - Create a mechanism where a "Link" holds the private key to a Compressed UTXO.
    - When a user clicks the link, they generate a ZK Proof to "claim" (transfer/unshield) that UTXO to their wallet.
    - This enables *truly anonymous* payment links (sender doesn't know receiver, on-chain data is opaque).

### 3. Relayer Infrastructure
- **Objective:** Break the link between the gas payer and the transaction sender.
- **Tasks:**
    - Set up a Relayer service (or use a provider).
    - Update client to submit ZK proofs to the Relayer instead of directly to RPC.
    - This ensures the user's main wallet doesn't pay gas for private actions, preventing metadata leakage.

### 4. SPL Token Support
- **Objective:** Support USDC and other SPL tokens.
- **Tasks:**
    - Extend `zkCompressedTransfer.ts` to handle Compressed Token Accounts (not just SOL).

### 5. Production Readiness
- **Objective:** Prepare for Mainnet.
- **Tasks:**
    - Security Audit of the ZK coordination logic.
    - Mainnet RPC configuration.
    - Mobile browser testing (WASM performance).
