// Downloads the small English Vosk model for the in-browser (WASM) voice
// trigger into public/models/, where Vite serves it from the same origin.
// The model is ~41 MB and git-ignored; run this once after cloning:
//
//   bun run fetch:model
//
// This is a developer step only. At runtime the app never downloads the
// model from the internet; it loads /models/<file> from its own origin.
import { mkdir, rename, stat, unlink } from "node:fs/promises";
import { join } from "node:path";

const MODEL_FILE = "vosk-model-small-en-us-0.15.tar.gz";
// Same tarball the vosk-browser demo serves (gzipped tar of the model folder).
const MODEL_URL = `https://ccoreilly.github.io/vosk-browser/models/${MODEL_FILE}`;
const EXPECTED_BYTES = 41_184_862;
const OUT_DIR = join(import.meta.dir, "..", "public", "models");
const OUT_PATH = join(OUT_DIR, MODEL_FILE);

async function existingSize(path: string): Promise<number | null> {
  try {
    return (await stat(path)).size;
  } catch {
    return null;
  }
}

function isGzip(bytes: Uint8Array): boolean {
  return bytes.length > 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
}

async function main(): Promise<void> {
  const force = process.argv.includes("--force");
  if (!force && (await existingSize(OUT_PATH)) === EXPECTED_BYTES) {
    console.log(`Model already present: ${OUT_PATH}`);
    return;
  }
  await mkdir(OUT_DIR, { recursive: true });
  console.log(`Downloading ${MODEL_URL}`);
  const res = await fetch(MODEL_URL);
  if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (!isGzip(bytes)) throw new Error("Downloaded file is not a gzip archive");
  if (bytes.length !== EXPECTED_BYTES) {
    throw new Error(`Unexpected size ${bytes.length} (expected ${EXPECTED_BYTES})`);
  }
  const tmp = `${OUT_PATH}.part`;
  await Bun.write(tmp, bytes);
  await unlink(OUT_PATH).catch(() => undefined);
  await rename(tmp, OUT_PATH);
  console.log(`Saved ${(bytes.length / 1e6).toFixed(1)} MB to ${OUT_PATH}`);
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
