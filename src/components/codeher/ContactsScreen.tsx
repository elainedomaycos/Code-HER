import { useState } from "react";
import { Pencil, Plus, Trash2, Users } from "lucide-react";
import { formatPH } from "@/lib/phone";
import type { Contact } from "@/services/types";
import { cn } from "@/lib/utils";
import { MAX_CONTACTS, useCodeHer } from "./store";
import { ContactForm } from "./ContactForm";
import { Avatar, btnPrimary, btnSecondary, cardCls, ScreenTitle } from "./ui";

const iconBtn =
  "grid h-12 w-12 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted";

function ContactRow({
  contact,
  onEdit,
  onRemove,
}: {
  contact: Contact;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  if (confirming) {
    return (
      <li className="space-y-3 px-5 py-4">
        <p className="text-base font-semibold">Remove {contact.name}?</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="min-h-12 flex-1 rounded-2xl border border-border bg-card font-semibold"
          >
            Keep
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="min-h-12 flex-1 rounded-2xl bg-destructive font-bold text-destructive-foreground"
          >
            Remove
          </button>
        </div>
      </li>
    );
  }
  return (
    <li className="flex items-center gap-3 py-3 pl-5 pr-2">
      <Avatar name={contact.name} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-bold">{contact.name}</p>
        <p className="text-sm text-muted-foreground">{formatPH(contact.phone)}</p>
      </div>
      <button
        type="button"
        aria-label={`Edit ${contact.name}`}
        onClick={onEdit}
        className={iconBtn}
      >
        <Pencil className="h-5 w-5" aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-label={`Remove ${contact.name}`}
        onClick={() => setConfirming(true)}
        className={iconBtn}
      >
        <Trash2 className="h-5 w-5" aria-hidden="true" />
      </button>
    </li>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className={cn(cardCls, "px-6 py-8 text-center")}>
      <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-secondary text-coral-ink">
        <Users className="h-8 w-8" aria-hidden="true" />
      </span>
      <h2 className="mt-4 text-xl font-extrabold">No contacts yet</h2>
      <p className="mx-auto mt-2 max-w-xs text-base text-muted-foreground">
        Add someone you trust. When you send an alert, they get a text with your location.
      </p>
      <button type="button" onClick={onAdd} className={cn(btnPrimary, "mt-6")}>
        <Plus className="h-5 w-5" aria-hidden="true" /> Add a contact
      </button>
    </div>
  );
}

export function ContactsScreen() {
  const { contacts, setContacts } = useCodeHer();
  const [edit, setEdit] = useState<Contact | "new" | null>(null);
  const full = contacts.length >= MAX_CONTACTS;

  const save = (c: Contact) => {
    setContacts(edit === "new" ? [...contacts, c] : contacts.map((x) => (x.id === c.id ? c : x)));
    setEdit(null);
  };

  return (
    <div className="flex flex-1 flex-col gap-5 px-4 pb-6 pt-2">
      <ScreenTitle
        title="Trusted contacts"
        subtitle={`They get your alert by text. Up to ${MAX_CONTACTS} people.`}
      />
      {edit ? (
        <ContactForm
          initial={edit === "new" ? undefined : edit}
          onCancel={() => setEdit(null)}
          onSave={save}
        />
      ) : contacts.length === 0 ? (
        <EmptyState onAdd={() => setEdit("new")} />
      ) : (
        <>
          <ul className={cn(cardCls, "divide-y divide-border")}>
            {contacts.map((c) => (
              <ContactRow
                key={c.id}
                contact={c}
                onEdit={() => setEdit(c)}
                onRemove={() => setContacts(contacts.filter((x) => x.id !== c.id))}
              />
            ))}
          </ul>
          {full ? (
            <p className="text-center text-sm text-muted-foreground">
              You have {MAX_CONTACTS} of {MAX_CONTACTS} contacts. Remove one to add someone new.
            </p>
          ) : (
            <button type="button" onClick={() => setEdit("new")} className={btnSecondary}>
              <Plus className="h-5 w-5 text-coral-ink" aria-hidden="true" /> Add a contact
            </button>
          )}
        </>
      )}
    </div>
  );
}
