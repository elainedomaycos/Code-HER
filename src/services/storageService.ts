// StorageService (mock == production for now): localStorage works inside the
// Android WebView too, so no native implementation is needed.
import type { Contact, Settings, StorageService } from "./types";

const K = { contacts: "codeher.contacts", settings: "codeher.settings" };

export const defaultContacts: Contact[] = [
  { id: "c1", name: "Elaine Domaycos", phone: "+639933950898" },
];
export const defaultSettings: Settings = {
  userName: "Kassandra",
  safePhrase: "help me",
  simulateNoSignal: false,
  onboarded: false,
  // Off by default: several PH carriers filter URL-bearing SMS as spam, and
  // a coordinates-only alert that arrives beats a linked one that doesn't.
  includeMapLink: false,
};

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
const write = (key: string, v: unknown): void => {
  localStorage.setItem(key, JSON.stringify(v));
};

export const mockStorageService: StorageService = {
  getContacts: () => Promise.resolve(read(K.contacts, defaultContacts)),
  saveContacts: (c) => Promise.resolve(write(K.contacts, c)),
  getSettings: () => Promise.resolve({ ...defaultSettings, ...read(K.settings, {}) }),
  saveSettings: (s) => Promise.resolve(write(K.settings, s)),
};
