import type { Contact, Settings } from "./types";

const K = { contacts: "codeher.contacts", settings: "codeher.settings" };

export const defaultContacts: Contact[] = [
  { id: "c1", name: "Mia Santos", phone: "+639172840612" },
  { id: "c2", name: "Leah Reyes", phone: "+639054472186" },
];
export const defaultSettings: Settings = { userName: "Kassandra", safePhrase: "Tulong", simulateNoSignal: false };

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
const write = (key: string, v: unknown) => localStorage.setItem(key, JSON.stringify(v));

export const loadContacts = async () => read(K.contacts, defaultContacts);
export const saveContacts = async (c: Contact[]) => write(K.contacts, c);
export const loadSettings = async () => ({ ...defaultSettings, ...read(K.settings, {}) });
export const saveSettings = async (s: Settings) => write(K.settings, s);
