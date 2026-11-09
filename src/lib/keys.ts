import type { KeyboardEvent } from "react";

/** A key still held from the SOS hold must not fire the button that took focus. */
export function ignoreRepeat(e: KeyboardEvent<HTMLElement>): void {
  if (e.repeat) e.preventDefault();
}
