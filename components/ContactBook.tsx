"use client";

import { useState, useEffect } from "react";
import { Contact, getContacts, saveContact, removeContact } from "@/lib/contacts";
import { Trash2, Send, Plus, X } from "lucide-react";
import Link from "next/link";

export function ContactBook() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newInboxPk, setNewInboxPk] = useState("");

  useEffect(() => { setContacts(getContacts()); }, []);

  const handleSave = () => {
    if (!newName || !newAddress) return;
    saveContact({ name: newName, address: newAddress, inboxPk: newInboxPk || undefined, createdAt: Date.now() });
    setContacts(getContacts());
    setShowAdd(false);
    setNewName(""); setNewAddress(""); setNewInboxPk("");
  };

  const handleDelete = (address: string) => {
    removeContact(address);
    setContacts(getContacts());
  };

  const inputCls = "w-full bg-black border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/30 transition-all";

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4">

      {/* Header row */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-white/40">{contacts.length} saved</p>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1.5 text-xs bg-white text-black hover:bg-white/90 px-3 py-2 rounded-xl font-bold transition-colors"
        >
          {showAdd ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          {showAdd ? "Cancel" : "Add Contact"}
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] space-y-3">
          <input
            placeholder="Name"
            className={inputCls}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <input
            placeholder="Solana Address"
            className={`${inputCls} font-mono`}
            value={newAddress}
            onChange={(e) => setNewAddress(e.target.value)}
          />
          <input
            placeholder="Inbox Public Key (optional — enables E2EE)"
            className={`${inputCls} font-mono`}
            value={newInboxPk}
            onChange={(e) => setNewInboxPk(e.target.value)}
          />
          <button
            onClick={handleSave}
            className="w-full bg-white text-black text-sm font-bold py-2.5 rounded-xl hover:bg-white/90 transition-colors"
          >
            Save Contact
          </button>
        </div>
      )}

      {/* List */}
      <div className="space-y-2">
        {contacts.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-white/[0.07] rounded-2xl">
            <p className="text-sm text-white/30">No contacts saved yet.</p>
          </div>
        ) : (
          contacts.map((c) => (
            <div
              key={c.address}
              className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.12] transition-colors"
            >
              <div className="min-w-0">
                <div className="font-semibold text-white text-sm">{c.name}</div>
                <div className="text-[11px] font-mono text-white/30 truncate">{c.address}</div>
                {c.inboxPk && (
                  <div className="text-[10px] text-white/25 mt-0.5">E2EE enabled</div>
                )}
              </div>
              <div className="flex items-center gap-2 ml-4 shrink-0">
                <Link
                  href={`/pay?to=${c.address}${c.inboxPk ? `&pk=${c.inboxPk}` : ""}`}
                  className="p-2 bg-white/[0.05] text-white/60 rounded-xl hover:bg-white/10 hover:text-white transition-colors"
                  title="Pay"
                >
                  <Send className="w-4 h-4" />
                </Link>
                <button
                  onClick={() => handleDelete(c.address)}
                  className="p-2 bg-white/[0.03] text-white/30 rounded-xl hover:bg-white/[0.07] hover:text-white/60 transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
