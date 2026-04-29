"use client";

import { useState } from "react";
import { Contact, getContacts, saveContact, removeContact } from "@/lib/contacts";
import { Trash2, User, Send, Plus } from "lucide-react";
import Link from "next/link";

function shorten(value: string) {
  if (!value) return "n/a";
  if (value.length <= 10) return value;
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

export function ContactBook() {
  const [contacts, setContacts] = useState<Contact[]>(() => getContacts());
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newInboxPk, setNewInboxPk] = useState("");

  const handleSave = () => {
    if (!newName || !newAddress) return;
    const contact: Contact = {
        name: newName,
        address: newAddress,
        inboxPk: newInboxPk || undefined,
        createdAt: Date.now()
    };
    saveContact(contact);
    setContacts(getContacts());
    setShowAdd(false);
    setNewName("");
    setNewAddress("");
    setNewInboxPk("");
  };

  const handleDelete = (address: string) => {
    removeContact(address);
    setContacts(getContacts());
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-[#FAFAFA] flex items-center gap-2">
            <User className="w-5 h-5 text-[#7C3AED]" /> Contacts
        </h2>
        <button 
            onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-1 text-xs bg-[#7C3AED] hover:bg-[#6D28D9] text-[#FAFAFA] px-3 py-2 rounded-lg transition-all duration-150"
        >
            <Plus className="w-4 h-4" /> Add Contact
        </button>
      </div>

      {showAdd && (
        <div className="mb-6 p-4 rounded-xl bg-[#111113] border border-[#27272A] space-y-3">
            <input 
                placeholder="Name" 
                className="w-full bg-[#09090B] border border-[#3F3F46] rounded-md px-3 py-2 text-sm text-[#FAFAFA] focus:outline-none focus:ring-2 focus:ring-[#7C3AED] transition-all duration-150"
                value={newName}
                onChange={e => setNewName(e.target.value)}
            />
            <input 
                placeholder="Solana Address" 
                className="w-full bg-[#09090B] border border-[#3F3F46] rounded-md px-3 py-2 text-sm font-mono text-[#FAFAFA] focus:outline-none focus:ring-2 focus:ring-[#7C3AED] transition-all duration-150"
                value={newAddress}
                onChange={e => setNewAddress(e.target.value)}
            />
            <input 
                placeholder="Inbox Public Key (Optional - for E2EE)" 
                className="w-full bg-[#09090B] border border-[#3F3F46] rounded-md px-3 py-2 text-sm font-mono text-[#FAFAFA] focus:outline-none focus:ring-2 focus:ring-[#7C3AED] transition-all duration-150"
                value={newInboxPk}
                onChange={e => setNewInboxPk(e.target.value)}
            />
            <button 
                onClick={handleSave}
                className="w-full bg-[#7C3AED] hover:bg-[#6D28D9] text-[#FAFAFA] text-sm font-medium py-2.5 rounded-lg transition-all duration-150"
            >
                Save Contact
            </button>
        </div>
      )}

      <div className="space-y-3">
        {contacts.length === 0 ? (
            <div className="text-center py-8 text-[#71717A] text-sm">
                No contacts saved yet.
            </div>
        ) : (
            contacts.map(c => (
                <div key={c.address} className="flex items-center justify-between p-4 rounded-xl bg-[#111113] border border-[#27272A] hover:border-[#3F3F46] transition-all duration-150">
                    <div>
                        <div className="font-medium text-[#FAFAFA]">{c.name}</div>
                        <div className="text-[11px] font-mono text-[#A1A1AA]" title={c.address}>{shorten(c.address)}</div>
                        {c.inboxPk && (
                             <div className="text-[11px] font-mono text-[#10B981] mt-1 flex items-center gap-2">
                                <LockMini /> End-to-End Encryption Enabled
                             </div>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <Link 
                            href={`/pay?to=${c.address}${c.inboxPk ? `&pk=${c.inboxPk}` : ''}`}
                            className="p-2 bg-[#09090B] text-[#A1A1AA] border border-[#27272A] rounded-lg hover:bg-[#18181B] hover:text-[#FAFAFA] transition-all duration-150"
                            title="Pay"
                        >
                            <Send className="w-4 h-4" />
                        </Link>
                        <button 
                            onClick={() => handleDelete(c.address)}
                            className="p-2 bg-[#09090B] text-red-200 border border-[#27272A] rounded-lg hover:bg-[#18181B] transition-all duration-150"
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

function LockMini() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M7.5 11V8.5a4.5 4.5 0 0 1 9 0V11"
        stroke="#10B981"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M6.75 11h10.5c.966 0 1.75.784 1.75 1.75v6.5c0 .966-.784 1.75-1.75 1.75H6.75A1.75 1.75 0 0 1 5 19.25v-6.5c0-.966.784-1.75 1.75-1.75Z"
        stroke="#10B981"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}
