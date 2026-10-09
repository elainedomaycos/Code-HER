export interface Contact { id: string; name: string; phone: string }
export interface Location { lat: number; lng: number; accuracy: number; timestamp: number; isLastKnown: boolean }
export type SendStatus = "sent" | "queued" | "failed";
export interface ContactResult { contact: Contact; status: SendStatus }
export interface Settings { userName: string; safePhrase: string; simulateNoSignal: boolean }
