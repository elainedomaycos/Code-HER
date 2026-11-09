import { useId, useState } from "react";
import { newId } from "@/lib/id";
import { normalizePH, formatPH } from "@/lib/phone";
import type { Contact } from "@/services/types";
import { cn } from "@/lib/utils";
import { btnInk, btnSecondary, cardCls, inputCls } from "./ui";

const NAME_MAX = 60;

export function ContactForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Contact | undefined;
  onSave: (c: Contact) => void;
  onCancel: () => void;
}) {
  const id = useId();
  const [name, setName] = useState(initial?.name ?? "");
  const [phone, setPhone] = useState(initial ? formatPH(initial.phone) : "");
  const [err, setErr] = useState("");
  const errId = `${id}-err`;
  const hintId = `${id}-hint`;

  return (
    <form
      aria-label={initial ? `Edit ${initial.name}` : "Add a contact"}
      className={cn(cardCls, "space-y-4 p-5")}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const n = name.trim();
        if (!n) return setErr("Enter their name.");
        const p = normalizePH(phone);
        if (!p) return setErr("Enter a PH mobile number, like 0917 123 4567.");
        onSave({ id: initial?.id ?? newId(), name: n.slice(0, NAME_MAX), phone: p });
      }}
    >
      <h2 className="text-lg font-extrabold">{initial ? "Edit contact" : "Add a contact"}</h2>
      <div>
        <label htmlFor={`${id}-name`} className="mb-1.5 block text-sm font-semibold">
          Name
        </label>
        <input
          id={`${id}-name`}
          autoFocus
          autoComplete="off"
          placeholder="e.g. Ana"
          value={name}
          maxLength={NAME_MAX}
          onChange={(e) => setName(e.target.value)}
          aria-describedby={err ? errId : undefined}
          className={inputCls}
        />
      </div>
      <div>
        <label htmlFor={`${id}-phone`} className="mb-1.5 block text-sm font-semibold">
          Mobile number
        </label>
        <input
          id={`${id}-phone`}
          type="tel"
          inputMode="tel"
          autoComplete="off"
          placeholder="e.g. 0917 123 4567"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          aria-describedby={err ? `${hintId} ${errId}` : hintId}
          className={inputCls}
        />
        <p id={hintId} className="mt-1.5 text-sm text-muted-foreground">
          Philippine mobile number. We add +63 for you.
        </p>
      </div>
      {err && (
        <p id={errId} role="alert" className="text-sm font-semibold text-destructive">
          {err}
        </p>
      )}
      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onCancel} className={btnSecondary}>
          Cancel
        </button>
        <button type="submit" className={cn(btnInk, "min-h-12")}>
          Save
        </button>
      </div>
    </form>
  );
}
