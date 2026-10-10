// Domain types shared by the UI and the service layer.
export interface Contact {
  id: string;
  name: string;
  phone: string;
}
export interface Settings {
  userName: string;
  safePhrase: string;
  simulateNoSignal: boolean;
  onboarded: boolean;
  includeMapLink: boolean;
}
export type SendStatus = "sent" | "queued" | "failed";
export interface ContactResult {
  contact: Contact;
  status: SendStatus;
}

// ---- codeHER.md §4: service contracts ------------------------------------
// Every feature goes through these interfaces. Each has a mock implementation
// (browser/dev) and a native implementation (Capacitor HerNative plugin,
// Phase 2). UI components never import native plugins directly; they use the
// selector in src/services/index.ts.

export type ListeningStatus = "stopped" | "starting" | "listening" | "error";

export interface PhraseDetection {
  phrase: string;
  confidence: number;
  at: number;
}

export interface ListeningService {
  start(): Promise<void>;
  stop(): Promise<void>;
  getStatus(): Promise<ListeningStatus>;
  setPhrase(phrase: string): Promise<void>;
  onPhraseDetected(cb: (e: PhraseDetection) => void): () => void;
}

export interface LocationFix {
  lat: number;
  lng: number;
  accuracyM: number;
  at: number;
  source: "gps" | "last_known";
}

export interface LocationService {
  /** Best available fix, or null when nothing is available (send without location). */
  getCurrent(): Promise<LocationFix | null>;
}

export interface SmsResult {
  ok: boolean;
  error?: "no-signal" | "invalid-number" | "send-failed";
}

export interface SmsService {
  send(to: string, body: string): Promise<SmsResult>;
  queueForRetry(to: string, body: string): Promise<void>;
  flushQueue(): Promise<void>;
}

export interface StorageService {
  getContacts(): Promise<Contact[]>; // max 2 for MVP
  saveContacts(c: Contact[]): Promise<void>;
  getSettings(): Promise<Settings>;
  saveSettings(s: Settings): Promise<void>;
}

export interface StatusService {
  getConnectivity(): Promise<{ internet: boolean; cellular: boolean }>;
  getPermissions(): Promise<{
    mic: boolean;
    location: boolean;
    sms: boolean;
    batteryExempt: boolean;
  }>;
}
