"use client";

import { useState, useEffect } from "react";
import { Contact, getContacts, saveContact, removeContact } from "@/lib/contacts";
import { Trash2, Send, Plus, X } from "lucide-react";
import Link from "next/link";

function shorten(v: string) { return v?.length > 10 ? `${v.slice(0,4)}...${v.slice(-4)}` : v; }

export function ContactBook() {
  const [contacts, setContacts] = useState<Contact[]>(() => getContacts());
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newInboxPk, setNewInboxPk] = useState("");

  const handleSave = () => {
    if (!newName || !newAddress) return;
    saveContact({ name: newName, address: newAddress, inboxPk: newInboxPk || undefined, createdAt: Date.now() });
    setContacts(getContacts());
    setShowAdd(false);
    setNewName(""); setNewAddress(""); setNewInboxPk("");
  };

  const handleDelete = (address: string) => { removeContact(address); setContacts(getContacts()); };

  const inputCls = "w-full bg-white dark:bg-black border border-black/[0.1] dark:border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-black dark:text-white placeholder-black/25 dark:placeholder-white/20 focus:outline-none focus:border-black/30 dark:focus:border-white/30 transition-all";

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-black/40 dark:text-white/40">{contacts.length} saved</p>
        <button onClick={() => setShowAdd(!showAdd)} className="flex items-center gap-1.5 text-xs bg-black dark:bg-white text-white dark:text-black hover:bg-black/90 dark:hover:bg-white/90 px-3 py-2 rounded-xl font-bold transition-colors">
          {showAdd ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          {showAdd ? "Cancel" : "Add Contact"}
        </button>
      </div>

      {showAdd && (
        <div className="p-4 rounded-2xl bg-black/[0.03] dark:bg-white/[0.03] border border-black/[0.08] dark:border-white/[0.08] space-y-3">
          <input placeholder="Name" className={inputCls} value={newName} onChange={(e) => setNewName(e.target.value)} />
          <input placeholder="Solana Address" className={`${inputCls} font-mono`} value={newAddress} onChange={(e) => setNewAddress(e.target.value)} />
          <input placeholder="Inbox Public Key (optional — enables E2EE)" className={`${inputCls} font-mono`} value={newInboxPk} onChange={(e) => setNewInboxPk(e.target.value)} />
          <button onClick={handleSave} className="w-full bg-black dark:bg-white text-white dark:text-black text-sm font-bold py-2.5 rounded-xl hover:bg-black/90 dark:hover:bg-white/90 transition-colors">Save Contact</button>
        </div>
      )}

      <div className="space-y-2">
        {contacts.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-black/[0.07] dark:border-white/[0.07] rounded-2xl">
            <p className="text-sm text-black/30 dark:text-white/30">No contacts saved yet.</p>
          </div>
        ) : (
          contacts.map((c) => (
            <div key={c.address} className="flex items-center justify-between p-4 rounded-2xl bg-black/[0.03] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.06] hover:border-black/[0.12] dark:hover:border-white/[0.12] transition-colors">
              <div className="min-w-0">
                <div className="font-semibold text-black dark:text-white text-sm">{c.name}</div>
                <div className="text-[11px] font-mono text-black/30 dark:text-white/30 truncate">{c.address}</div>
                {c.inboxPk && <div className="text-[10px] text-black/25 dark:text-white/25 mt-0.5">E2EE enabled</div>}
              </div>
              <div className="flex items-center gap-2 ml-4 shrink-0">
                <Link href={`/pay?to=${c.address}${c.inboxPk ? `&pk=${c.inboxPk}` : ""}`} className="p-2 bg-black/[0.05] dark:bg-white/[0.05] text-black/60 dark:text-white/60 rounded-xl hover:bg-black/10 dark:hover:bg-white/10 hover:text-black dark:hover:text-white transition-colors" title="Pay">
                  <Send className="w-4 h-4" />
                </Link>
                <button onClick={() => handleDelete(c.address)} className="p-2 bg-black/[0.03] dark:bg-white/[0.03] text-black/30 dark:text-white/30 rounded-xl hover:bg-black/[0.07] dark:hover:bg-white/[0.07] hover:text-black/60 dark:hover:text-white/60 transition-colors" title="Delete">
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
